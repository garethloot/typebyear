import { compareChars, isExactMatch, type CharStatus } from '$lib/compare';
import { saveSession } from '$lib/history';
import { cancelSpeech, speak } from '$lib/speech';
import {
	pickSessionWords,
	SESSION_SIZE,
	type Language,
	type PracticeMode
} from '$lib/words';

export type SessionPhase = 'idle' | 'active' | 'done';

export type WordTiming = {
	tttMs: number;
	chars: number;
	cpm: number;
};

export type CompletedWord = {
	word: string;
	correct: boolean;
};

export type SessionSummary = {
	total: number;
	correct: number;
	accuracy: number;
	/** Median time-to-type from TTS end to submit, in ms */
	tttMs: number;
	/** Median characters-per-minute over the TTT window */
	cpm: number;
	language: Language;
	mode: PracticeMode;
};

export type StartOptions = {
	/** When set, use these words instead of a random bank sample. */
	words?: string[];
	mode?: PracticeMode;
};

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[mid];
	return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Format TTT for display, e.g. 1420 → "1.4s". */
export function formatTtt(ms: number): string {
	const seconds = ms / 1000;
	if (seconds < 10) return `${seconds.toFixed(1)}s`;
	return `${Math.round(seconds)}s`;
}

class TypingSession {
	language = $state<Language>('en');
	mode = $state<PracticeMode>('random');
	words = $state.raw<string[]>([]);
	index = $state(0);
	input = $state('');
	phase = $state<SessionPhase>('idle');
	correctCount = $state(0);
	/** Words already submitted this session — stays visible as a growing list. */
	completed = $state.raw<CompletedWord[]>([]);

	/** Per-word timings recorded at submit (TTS end → submit). */
	wordTimings = $state.raw<WordTiming[]>([]);
	/** When the current word's TTS finished; null until then / after replay. */
	typingStartedAt = $state<number | null>(null);
	/** Keystrokes for the current word (gross CPM numerator). Reset on speak/replay. */
	wordCharsTyped = $state(0);

	target = $derived(this.words[this.index] ?? '');
	progress = $derived({
		current: Math.min(this.index + 1, this.words.length),
		total: this.words.length
	});
	charStatuses = $derived<CharStatus[]>(compareChars(this.input, this.target));
	isDone = $derived(this.phase === 'done');

	summary = $derived.by((): SessionSummary | null => {
		if (this.phase !== 'done') return null;
		const total = this.words.length;
		const accuracy = total === 0 ? 0 : Math.round((this.correctCount / total) * 100);
		return {
			total,
			correct: this.correctCount,
			accuracy,
			tttMs: median(this.wordTimings.map((w) => w.tttMs)),
			cpm: median(this.wordTimings.map((w) => w.cpm)),
			language: this.language,
			mode: this.mode
		};
	});

	start(lang: Language, options: StartOptions = {}) {
		const mode = options.mode ?? (options.words ? 'missed' : 'random');
		const words =
			options.words && options.words.length > 0
				? options.words
				: pickSessionWords(lang, SESSION_SIZE);

		cancelSpeech();
		this.language = lang;
		this.mode = mode;
		this.words = words;
		this.index = 0;
		this.input = '';
		this.phase = 'active';
		this.correctCount = 0;
		this.completed = [];
		this.wordTimings = [];
		this.typingStartedAt = null;
		this.wordCharsTyped = 0;
		this.speakCurrent();
	}

	speakCurrent() {
		if (!this.target || this.phase !== 'active') return;

		this.typingStartedAt = null;

		const wordIndex = this.index;
		speak(this.target, this.language, () => {
			if (this.phase !== 'active') return;
			if (this.index !== wordIndex) return;
			this.typingStartedAt = Date.now();
		});
	}

	replay() {
		if (this.phase !== 'active') return;
		this.speakCurrent();
	}

	typeChar(char: string) {
		if (this.phase !== 'active') return;
		if (!/^[a-z]$/.test(char)) return;
		this.input += char;
		this.wordCharsTyped += 1;
	}

	backspace() {
		if (this.phase !== 'active') return;
		if (this.input.length === 0) return;
		this.input = this.input.slice(0, -1);
	}

	submit() {
		if (this.phase !== 'active' || !this.target) return;
		if (this.input.length === 0) return;

		this.recordWordTiming();

		const correct = isExactMatch(this.input, this.target);
		if (correct) this.correctCount += 1;

		this.completed = [...this.completed, { word: this.target, correct }];
		this.advance();
	}

	private recordWordTiming() {
		if (this.typingStartedAt === null) return;

		const tttMs = Math.max(Date.now() - this.typingStartedAt, 1);
		const chars = this.wordCharsTyped;
		const cpm = Math.round(chars / (tttMs / 60000));
		this.wordTimings = [...this.wordTimings, { tttMs, chars, cpm }];
	}

	private advance() {
		const next = this.index + 1;
		if (next >= this.words.length) {
			this.phase = 'done';
			this.input = '';
			this.typingStartedAt = null;
			this.wordCharsTyped = 0;
			cancelSpeech();
			void this.persistResult();
			return;
		}

		this.index = next;
		this.input = '';
		this.phase = 'active';
		this.typingStartedAt = null;
		this.wordCharsTyped = 0;
		this.speakCurrent();
	}

	private async persistResult() {
		const total = this.words.length;
		const accuracy = total === 0 ? 0 : Math.round((this.correctCount / total) * 100);
		const tttValues = this.wordTimings.map((w) => w.tttMs);
		const cpmValues = this.wordTimings.map((w) => w.cpm);

		try {
			await saveSession({
				language: this.language,
				total,
				correct: this.correctCount,
				accuracy,
				tttMs: median(tttValues),
				cpm: median(cpmValues),
				words: this.completed.map((w) => ({ word: w.word, correct: w.correct }))
			});
		} catch (err) {
			console.warn('Could not save session to IndexedDB', err);
		}
	}

	reset() {
		cancelSpeech();
		this.words = [];
		this.index = 0;
		this.input = '';
		this.phase = 'idle';
		this.mode = 'random';
		this.correctCount = 0;
		this.completed = [];
		this.wordTimings = [];
		this.typingStartedAt = null;
		this.wordCharsTyped = 0;
	}
}

export const session = new TypingSession();
