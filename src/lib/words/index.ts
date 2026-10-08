import { getCustomList, isCustomListId, loadCustomLists } from '$lib/customLists';
import dutch from './dutch.json';
import dutch_1k from './dutch_1k.json';
import english from './english.json';
import english_1k from './english_1k.json';
import { rekentafels } from './rekentafels';
import ts from './ts.json';

/** Language tag used for TTS / key speech names. */
export type SpeechLanguage = 'en' | 'nl';

export type WordListId =
	| 'english'
	| 'english_1k'
	| 'dutch'
	| 'dutch_1k'
	| 'typescript'
	| 'rekentafels';

/** Built-in or custom list id used across prefs, URLs, and history. */
export type PracticeListId = WordListId | string;

export type PracticePrompt = {
	typed: string;
	spoken: string;
};

type WordListBase = {
	id: WordListId;
	name: string;
	speechLang: SpeechLanguage;
};

/** Each entry is both spoken and typed. */
export type WordBankList = WordListBase & {
	words: string[];
};

/** Spoken prompt and typed answer differ (for example times tables). */
export type PromptBankList = WordListBase & {
	prompts: PracticePrompt[];
};

export type WordList = WordBankList | PromptBankList;

export type ResolvedList = {
	id: PracticeListId;
	name: string;
	speechLang: SpeechLanguage;
	prompts: PracticePrompt[];
	kind: 'builtin' | 'custom';
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
	{ id: 'rekentafels', name: 'Rekentafels', speechLang: 'nl', prompts: rekentafels },
	{ id: 'typescript', name: 'TypeScript', speechLang: 'en', words: ts }
];

const WORD_LIST_BY_ID = Object.fromEntries(WORD_LISTS.map((list) => [list.id, list])) as Record<
	WordListId,
	WordList
>;

function asPrompts(words: string[]): PracticePrompt[] {
	return words.map((word) => ({ typed: word, spoken: word }));
}

function builtinPrompts(list: WordList): PracticePrompt[] {
	if ('prompts' in list) {
		return list.prompts.map((prompt) => ({ typed: prompt.typed, spoken: prompt.spoken }));
	}
	return asPrompts(list.words);
}

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
		value === 'typescript' ||
		value === 'rekentafels'
	);
}

/** True when the id is a known built-in or a custom list currently in storage. */
export function isPracticeListId(value: string | null | undefined): value is PracticeListId {
	if (value == null) return false;
	if (isWordListId(value)) return true;
	return isCustomListId(value) && getCustomList(value) != null;
}

export function getWordList(id: WordListId): WordList {
	return WORD_LIST_BY_ID[id];
}

export function resolveList(id: PracticeListId): ResolvedList | null {
	if (isWordListId(id)) {
		const list = WORD_LIST_BY_ID[id];
		return {
			id: list.id,
			name: list.name,
			speechLang: list.speechLang,
			prompts: builtinPrompts(list),
			kind: 'builtin'
		};
	}
	if (!isCustomListId(id)) return null;
	const custom = getCustomList(id);
	if (!custom) return null;
	return {
		id: custom.id,
		name: custom.name,
		speechLang: custom.speechLang,
		prompts: custom.prompts.map((p) => ({ typed: p.typed, spoken: p.spoken })),
		kind: 'custom'
	};
}

export function wordListLabel(id: PracticeListId): string {
	const resolved = resolveList(id);
	if (resolved) return resolved.name;
	if (isCustomListId(id)) return 'Deleted list';
	return String(id);
}

export function speechLangFor(id: PracticeListId): SpeechLanguage {
	const resolved = resolveList(id);
	if (resolved) return resolved.speechLang;
	return 'en';
}

/** Canonical list id for a speech language, keeping `preferred` when it already matches. */
export function listIdForSpeechLang(
	lang: SpeechLanguage,
	preferred?: PracticeListId
): PracticeListId {
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

export function pickSessionPrompts(listId: PracticeListId, count = SESSION_SIZE): PracticePrompt[] {
	const resolved = resolveList(listId);
	if (!resolved || resolved.prompts.length === 0) return [];
	return shuffle(resolved.prompts).slice(0, Math.min(count, resolved.prompts.length));
}

/** @deprecated Prefer pickSessionPrompts — kept for callers that only need typed strings. */
export function pickSessionWords(listId: PracticeListId, count = SESSION_SIZE): string[] {
	return pickSessionPrompts(listId, count).map((p) => p.typed);
}

/**
 * Map typed targets to practice prompts, looking up spoken labels from the list.
 * Falls back to speaking the typed string when the item is missing.
 */
export function promptsForTypedWords(
	listId: PracticeListId,
	typedWords: string[]
): PracticePrompt[] {
	const resolved = resolveList(listId);
	const spokenByTyped = new Map<string, string>();
	if (resolved) {
		for (const prompt of resolved.prompts) {
			if (!spokenByTyped.has(prompt.typed)) {
				spokenByTyped.set(prompt.typed, prompt.spoken);
			}
		}
	}
	return typedWords.map((typed) => ({
		typed,
		spoken: spokenByTyped.get(typed) ?? typed
	}));
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

/** Custom lists currently available for the home picker. */
export function listCustomListOptions(): Array<{ id: string; name: string }> {
	return loadCustomLists().map((list) => ({ id: list.id, name: list.name }));
}
