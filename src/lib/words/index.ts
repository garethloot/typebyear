import dutch from './dutch.json';
import dutch_1k from './dutch_1k.json';
import english from './english.json';
import english_1k from './english_1k.json';
import ts from './ts.json';

/** Language tag used for TTS / key speech names. */
export type SpeechLanguage = 'en' | 'nl';

export type WordListId = 'english' | 'english_1k' | 'dutch' | 'dutch_1k' | 'typescript';

export type WordList = {
	id: WordListId;
	name: string;
	speechLang: SpeechLanguage;
	words: string[];
};

/**
 * `random` = bank sample; `missed` = drilled from past incorrect words;
 * `keys` = custom character drill; `slow-keys` = slowest reaction keys.
 */
export type PracticeMode = 'random' | 'missed' | 'keys' | 'slow-keys';

export const SESSION_SIZE = 25;

export const WORD_LISTS: WordList[] = [
	{ id: 'english', name: 'English', speechLang: 'en', words: english },
	{ id: 'english_1k', name: 'English 1k', speechLang: 'en', words: english_1k },
	{ id: 'dutch', name: 'Dutch', speechLang: 'nl', words: dutch },
	{ id: 'dutch_1k', name: 'Dutch 1k', speechLang: 'nl', words: dutch_1k },
	{ id: 'typescript', name: 'TypeScript', speechLang: 'en', words: ts }
];

const WORD_LIST_BY_ID = Object.fromEntries(WORD_LISTS.map((list) => [list.id, list])) as Record<
	WordListId,
	WordList
>;

/** Map legacy language codes (and current list ids) to a word list id. */
export function migrateWordListId(value: string | null | undefined): WordListId | null {
	if (value == null) return null;
	if (isWordListId(value)) return value;
	if (value === 'en') return 'english_1k';
	if (value === 'nl') return 'dutch_1k';
	if (value === 'ts') return 'typescript';
	return null;
}

export function isWordListId(value: string | null | undefined): value is WordListId {
	return (
		value === 'english' ||
		value === 'english_1k' ||
		value === 'dutch' ||
		value === 'dutch_1k' ||
		value === 'typescript'
	);
}

export function getWordList(id: WordListId): WordList {
	return WORD_LIST_BY_ID[id];
}

export function wordListLabel(id: WordListId): string {
	return WORD_LIST_BY_ID[id].name;
}

export function speechLangFor(id: WordListId): SpeechLanguage {
	return WORD_LIST_BY_ID[id].speechLang;
}

/** Canonical list id for a speech language, keeping `preferred` when it already matches. */
export function listIdForSpeechLang(
	lang: SpeechLanguage,
	preferred?: WordListId
): WordListId {
	if (preferred && speechLangFor(preferred) === lang) return preferred;
	return lang === 'nl' ? 'dutch_1k' : 'english_1k';
}

export function shuffle<T>(items: T[]): T[] {
	const arr = [...items];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

export function pickSessionWords(listId: WordListId, count = SESSION_SIZE): string[] {
	const bank = WORD_LIST_BY_ID[listId].words;
	return shuffle(bank).slice(0, Math.min(count, bank.length));
}

/**
 * Build a practice list from ranked misspelled words (highest miss count first).
 * Fills up to `count` by cycling the ranked list so hard words get more reps
 * when the unique pool is smaller than a full session.
 */
export function pickMissedSessionWords(
	ranked: { word: string; misses: number }[],
	count = SESSION_SIZE
): string[] {
	if (ranked.length === 0 || count <= 0) return [];

	const unique = ranked.map((r) => r.word);
	if (unique.length >= count) {
		return shuffle(unique.slice(0, count));
	}

	// Weight repeats by miss count so the reddest words show up more often.
	const pool: string[] = [];
	for (const { word, misses } of ranked) {
		const reps = Math.max(1, misses);
		for (let i = 0; i < reps; i++) pool.push(word);
	}

	const picked: string[] = [];
	const bag = shuffle(pool);
	let i = 0;
	while (picked.length < count) {
		if (i >= bag.length) {
			bag.push(...shuffle(pool));
		}
		picked.push(bag[i]!);
		i += 1;
	}
	return picked;
}

export function isPracticeMode(value: string | null): value is PracticeMode {
	return value === 'random' || value === 'missed' || value === 'keys' || value === 'slow-keys';
}
