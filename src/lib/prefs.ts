import { getCustomList, isCustomListId } from '$lib/customLists';
import {
	isWordListId,
	migrateWordListId,
	SESSION_SIZE,
	type PracticeListId
} from '$lib/words';

export type SessionLength = 10 | 25 | 50;

export const SESSION_LENGTHS: readonly SessionLength[] = [10, 25, 50];

export type Prefs = {
	wordList: PracticeListId;
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

function resolveStoredListId(value: unknown): PracticeListId | null {
	if (typeof value !== 'string') return null;
	if (isWordListId(value)) return value;
	if (isCustomListId(value) && getCustomList(value) != null) return value;
	return migrateWordListId(value);
}

function normalizePrefs(raw: unknown): Prefs {
	if (!raw || typeof raw !== 'object') return { ...DEFAULT_PREFS };

	const obj = raw as Record<string, unknown>;
	const fromWordList = resolveStoredListId(obj.wordList);
	const fromLegacy = typeof obj.language === 'string' ? migrateWordListId(obj.language) : null;
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

/** Normalize prefs from a backup payload. */
export function parsePrefs(raw: unknown): Prefs {
	return normalizePrefs(raw);
}

/** Overwrite prefs entirely. Throws on storage failure (quota / private mode). */
export function replacePrefs(prefs: Prefs): Prefs {
	const next = normalizePrefs(prefs);
	if (typeof localStorage === 'undefined') {
		throw new Error('localStorage unavailable');
	}
	localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
	return next;
}
