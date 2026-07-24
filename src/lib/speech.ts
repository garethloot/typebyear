import type { Language } from '$lib/words';

const LANG_TAG: Record<Language, string> = {
	en: 'en-US',
	nl: 'nl-NL',
	ts: 'en-US'
};

const VOICE_BOOST: Array<{ match: RegExp; score: number }> = [
	{ match: /neural|natural|premium|enhanced/i, score: 60 },
	{ match: /google us english|google uk english|google nederlands/i, score: 55 },
	{ match: /google/i, score: 40 },
	{ match: /microsoft.*(aria|guy|jenny|sonia|davis|emma|brian)/i, score: 45 },
	{ match: /samantha|daniel|karen|moira|ellen|claire|xander/i, score: 30 },
	// Harsh / novelty / low-quality system voices
	{ match: /compact|whisper|zarvox|trinoids|bad news|good news|bells|boing|bubbles|cellos|pipe|organ|albert|bahh|barito|boing|deranged|hysterical|junior|kathy|princess|ralph|wobble/i, score: -100 },
	{ match: /fred|bruce|victoria|alex(?!a)/i, score: -20 }
];

let speakGeneration = 0;
let speakTimer: ReturnType<typeof setTimeout> | null = null;
let resumeWatch: ReturnType<typeof setInterval> | null = null;

export function isSpeechAvailable(): boolean {
	return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function scoreVoice(voice: SpeechSynthesisVoice, lang: Language): number {
	const tag = LANG_TAG[lang];
	let score = 0;

	if (voice.lang === tag) score += 30;
	else if (voice.lang.toLowerCase().startsWith(`${lang}-`)) score += 18;
	else if (voice.lang.toLowerCase().startsWith(lang)) score += 12;
	else return -1;

	if (voice.default) score += 8;

	for (const { match, score: boost } of VOICE_BOOST) {
		if (match.test(voice.name)) score += boost;
	}

	// Prefer non-compact cloud/neural voices when available
	if (!voice.localService) score += 12;

	return score;
}

function pickVoice(lang: Language): SpeechSynthesisVoice | undefined {
	const voices = window.speechSynthesis.getVoices();
	let best: SpeechSynthesisVoice | undefined;
	let bestScore = -1;

	for (const voice of voices) {
		const score = scoreVoice(voice, lang);
		if (score > bestScore) {
			bestScore = score;
			best = voice;
		}
	}

	// Don't force a bad match — let the browser default handle it
	if (bestScore < 0) return undefined;
	return best;
}

function clearTimers() {
	if (speakTimer !== null) {
		clearTimeout(speakTimer);
		speakTimer = null;
	}
	if (resumeWatch !== null) {
		clearInterval(resumeWatch);
		resumeWatch = null;
	}
}

function whenIdle(then: () => void, generation: number, attempts = 0) {
	if (generation !== speakGeneration) return;

	const busy = window.speechSynthesis.speaking || window.speechSynthesis.pending;
	if (busy && attempts < 20) {
		window.speechSynthesis.cancel();
		speakTimer = setTimeout(() => whenIdle(then, generation, attempts + 1), 40);
		return;
	}

	then();
}

/**
 * Speak a practice word once, at a natural pace.
 * `onComplete` fires when speech ends (or immediately if unavailable).
 */
export function speak(text: string, lang: Language, onComplete?: () => void): void {
	if (!isSpeechAvailable()) {
		onComplete?.();
		return;
	}

	const generation = ++speakGeneration;
	clearTimers();
	window.speechSynthesis.cancel();

	const finish = () => {
		if (generation !== speakGeneration) return;
		clearTimers();
		onComplete?.();
	};

	const run = () => {
		if (generation !== speakGeneration) return;

		window.speechSynthesis.resume();

		// Bare word + natural rate — slow rates + trailing "." sound slurred on many voices
		const utterance = new SpeechSynthesisUtterance(text);
		utterance.lang = LANG_TAG[lang];
		utterance.rate = 1;
		utterance.pitch = 1;
		utterance.volume = 1;

		const voice = pickVoice(lang);
		if (voice) {
			utterance.voice = voice;
			utterance.lang = voice.lang;
		}

		utterance.onend = finish;
		utterance.onerror = finish;

		window.speechSynthesis.speak(utterance);

		resumeWatch = setInterval(() => {
			if (generation !== speakGeneration) {
				clearTimers();
				return;
			}
			if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
				clearTimers();
				return;
			}
			if (window.speechSynthesis.paused) {
				window.speechSynthesis.resume();
			}
		}, 200);
	};

	const start = () => {
		if (generation !== speakGeneration) return;

		const go = () => whenIdle(run, generation);

		if (window.speechSynthesis.getVoices().length === 0) {
			let started = false;
			const once = () => {
				if (started || generation !== speakGeneration) return;
				started = true;
				go();
			};
			window.speechSynthesis.addEventListener('voiceschanged', once, { once: true });
			speakTimer = setTimeout(once, 200);
			return;
		}

		go();
	};

	speakTimer = setTimeout(start, 120);
}

export function cancelSpeech(): void {
	speakGeneration += 1;
	clearTimers();
	if (!isSpeechAvailable()) return;
	window.speechSynthesis.cancel();
}
