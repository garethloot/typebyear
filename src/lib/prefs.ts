import {
	isWordListId,
	migrateWordListId,
	SESSION_SIZE,
	type WordListId
} from '$lib/words';

export type SessionLength = 10 | 25 | 50;

export const SESSION_LENGTHS: readonly SessionLength[] = [10, 25, 50];

export type Prefs = {
	wordList: WordListId;
	sessionLength: SessionLength;
};

const PREFS_STORAGE_KEY = 'typebyear:prefs';

const DEFAULT_PREFS: Prefs = {
	wordList: 'english_1k',
	sessionLength: SESSION_SIZE as SessionLength
};

export function isSessionLength(value: unknown): value is SessionLength {
	return value === 10 || value === 25 || value === 50;
}

function normalizePrefs(raw: unknown): Prefs {
	if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS };

	const obj = raw as Record<string, unknown>;
	const fromWordList =
		typeof obj.wordList === 'string' && isWordListId(obj.wordList) ? obj.wordList : null;
	const fromLegacy =
		typeof obj.language === 'string' ? migrateWordListId(obj.language) : null;
	const wordList = fromWordList ?? fromLegacy ?? DEFAULT_PREFS.wordList;
	const sessionLength = isSessionLength(obj.sessionLength)
		? obj.sessionLength
		: DEFAULT_PREFS.sessionLength;

	return { wordList, sessionLength };
}

export function loadPrefs(): Prefs {
	if (typeof localStorage === 'undefined') return { ...DEFAULT_PREFS };
	try {
		const raw = localStorage.getItem(PREFS_STORAGE_KEY);
		if (!raw) return { ...DEFAULT_PREFS };
		return normalizePrefs(JSON.parse(raw) as unknown);
	} catch {
		return { ...DEFAULT_PREFS };
	}
}

export function savePrefs(partial: Partial<Prefs>): Prefs {
	const next = normalizePrefs({ ...loadPrefs(), ...partial });
	if (typeof localStorage === 'undefined') return next;
	try {
		localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
	} catch {
		// quota / private mode — ignore
	}
	return next;
}
