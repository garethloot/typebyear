import {
	keyPresetLabel,
	SLOW_KEY_MIN_SAMPLES,
	type SlowKeyRank,
	type StoredKeyPreset
} from '$lib/keys';
import { isCustomListId } from '$lib/customLists';
import {
	isPracticeMode,
	isWordListId,
	migrateWordListId,
	type PracticeListId,
	type PracticeMode
} from '$lib/words';

const DB_NAME = 'tabtype';
const DB_VERSION = 2;
const STORE = 'sessions';

export type StoredWord = {
	word: string;
	correct: boolean;
	/** Reaction time (TTS end → submit), ms — set for keys sessions and newer word sessions. */
	tttMs?: number;
};

export type StoredSession = {
	id?: number;
	completedAt: number;
	wordList: PracticeListId;
	mode: PracticeMode;
	/**
	 * Keys-mode preset used for the session (`'custom'` if the selection
	 * didn’t match a named preset). Absent on older rows and non-keys modes.
	 */
	keyPreset?: StoredKeyPreset;
	total: number;
	correct: number;
	accuracy: number;
	tttMs: number;
	cpm: number;
	words: StoredWord[];
};

export type SessionResultInput = {
	wordList: PracticeListId;
	mode: PracticeMode;
	keyPreset?: StoredKeyPreset;
	total: number;
	correct: number;
	accuracy: number;
	tttMs: number;
	cpm: number;
	words: StoredWord[];
};

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE)) {
				const store = db.createObjectStore(STORE, {
					keyPath: 'id',
					autoIncrement: true
				});
				store.createIndex('byCompletedAt', 'completedAt', { unique: false });
			}
		};
	});
}

function req<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
	});
}

type RawStoredSession = Omit<StoredSession, 'wordList'> & {
	wordList?: string;
	/** Legacy field from before word-list ids. */
	language?: string;
};

function normalizeListId(value: string | null | undefined): PracticeListId | null {
	if (value == null) return null;
	if (isWordListId(value)) return value;
	// Keep custom ids even if the list was deleted so history labels still resolve.
	if (isCustomListId(value)) return value;
	return migrateWordListId(value);
}

function normalizeSession(raw: RawStoredSession): StoredSession {
	const wordList =
		normalizeListId(raw.wordList) ?? migrateWordListId(raw.language) ?? 'english_1k';
	return {
		id: raw.id,
		completedAt: raw.completedAt,
		wordList,
		mode: raw.mode ?? 'random',
		...(raw.keyPreset != null ? { keyPreset: raw.keyPreset } : {}),
		total: raw.total,
		correct: raw.correct,
		accuracy: raw.accuracy,
		tttMs: raw.tttMs,
		cpm: raw.cpm,
		words: raw.words
	};
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function normalizeStoredWord(raw: unknown): StoredWord | null {
	if (!raw || typeof raw !== 'object') return null;
	const obj = raw as Record<string, unknown>;
	if (typeof obj.word !== 'string' || obj.word.length === 0) return null;
	if (typeof obj.correct !== 'boolean') return null;
	const word: StoredWord = { word: obj.word, correct: obj.correct };
	if (isFiniteNumber(obj.tttMs) && obj.tttMs > 0) word.tttMs = obj.tttMs;
	return word;
}

/** Normalize a raw session record for import; returns null if required fields are invalid. */
export function parseSessionRecord(raw: unknown): StoredSession | null {
	if (!raw || typeof raw !== 'object') return null;
	const obj = raw as Record<string, unknown>;
	if (!isFiniteNumber(obj.completedAt)) return null;
	if (!isFiniteNumber(obj.total) || !isFiniteNumber(obj.correct)) return null;
	if (!isFiniteNumber(obj.accuracy) || !isFiniteNumber(obj.cpm)) return null;
	if (!Array.isArray(obj.words)) return null;

	const words = obj.words
		.map(normalizeStoredWord)
		.filter((w): w is StoredWord => w != null);
	if (words.length !== obj.words.length) return null;

	const tttMs = isFiniteNumber(obj.tttMs) ? obj.tttMs : 0;
	const mode =
		typeof obj.mode === 'string' && isPracticeMode(obj.mode) ? obj.mode : ('random' as const);
	const normalized = normalizeSession({
		...(obj as RawStoredSession),
		completedAt: obj.completedAt,
		total: obj.total,
		correct: obj.correct,
		accuracy: obj.accuracy,
		cpm: obj.cpm,
		tttMs,
		mode,
		words
	});

	// Drop autoIncrement id so imports reassign cleanly.
	const { id: _id, ...rest } = normalized;
	return rest;
}

function sessionWithoutId(session: StoredSession): Omit<StoredSession, 'id'> {
	const { id: _id, ...rest } = session;
	return rest;
}

export function isIndexedDbAvailable(): boolean {
	return typeof indexedDB !== 'undefined';
}

export async function saveSession(result: SessionResultInput): Promise<number> {
	if (!isIndexedDbAvailable()) {
		throw new Error('IndexedDB unavailable');
	}

	const db = await openDb();
	try {
		const record: StoredSession = {
			completedAt: Date.now(),
			wordList: result.wordList,
			mode: result.mode,
			...(result.keyPreset != null ? { keyPreset: result.keyPreset } : {}),
			total: result.total,
			correct: result.correct,
			accuracy: result.accuracy,
			tttMs: result.tttMs,
			cpm: result.cpm,
			words: result.words
		};

		const tx = db.transaction(STORE, 'readwrite');
		const store = tx.objectStore(STORE);
		const id = await req(store.add(record));
		await waitForTx(tx);

		return id as number;
	} finally {
		db.close();
	}
}

/** Newest first. */
export async function listSessions(limit = 20): Promise<StoredSession[]> {
	if (!isIndexedDbAvailable()) return [];

	const db = await openDb();
	try {
		const tx = db.transaction(STORE, 'readonly');
		const index = tx.objectStore(STORE).index('byCompletedAt');
		const results: StoredSession[] = [];

		await new Promise<void>((resolve, reject) => {
			const cursorReq = index.openCursor(null, 'prev');
			cursorReq.onerror = () => reject(cursorReq.error ?? new Error('Cursor failed'));
			cursorReq.onsuccess = () => {
				const cursor = cursorReq.result;
				if (!cursor || results.length >= limit) {
					resolve();
					return;
				}
				results.push(normalizeSession(cursor.value as RawStoredSession));
				cursor.continue();
			};
		});

		return results;
	} finally {
		db.close();
	}
}

/** All sessions, newest first. */
export async function getAllSessions(): Promise<StoredSession[]> {
	if (!isIndexedDbAvailable()) return [];

	const db = await openDb();
	try {
		const tx = db.transaction(STORE, 'readonly');
		const index = tx.objectStore(STORE).index('byCompletedAt');
		const results: StoredSession[] = [];

		await new Promise<void>((resolve, reject) => {
			const cursorReq = index.openCursor(null, 'prev');
			cursorReq.onerror = () => reject(cursorReq.error ?? new Error('Cursor failed'));
			cursorReq.onsuccess = () => {
				const cursor = cursorReq.result;
				if (!cursor) {
					resolve();
					return;
				}
				results.push(normalizeSession(cursor.value as RawStoredSession));
				cursor.continue();
			};
		});

		return results;
	} finally {
		db.close();
	}
}

/**
 * Wipe sessions and insert the given rows (ids stripped; autoIncrement reassigns).
 * Preserves completedAt and session content.
 */
export async function replaceAllSessions(sessions: StoredSession[]): Promise<void> {
	if (!isIndexedDbAvailable()) {
		throw new Error('IndexedDB unavailable');
	}

	const db = await openDb();
	try {
		const tx = db.transaction(STORE, 'readwrite');
		const store = tx.objectStore(STORE);
		await req(store.clear());
		for (const session of sessions) {
			store.add(sessionWithoutId(session));
		}
		await waitForTx(tx);
	} finally {
		db.close();
	}
}

async function waitForTx(tx: IDBTransaction): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
		tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
	});
}

export async function deleteSession(id: number): Promise<void> {
	if (!isIndexedDbAvailable()) {
		throw new Error('IndexedDB unavailable');
	}

	const db = await openDb();
	try {
		const tx = db.transaction(STORE, 'readwrite');
		await req(tx.objectStore(STORE).delete(id));
		await waitForTx(tx);
	} finally {
		db.close();
	}
}

export async function clearSessions(): Promise<void> {
	if (!isIndexedDbAvailable()) {
		throw new Error('IndexedDB unavailable');
	}

	const db = await openDb();
	try {
		const tx = db.transaction(STORE, 'readwrite');
		await req(tx.objectStore(STORE).clear());
		await waitForTx(tx);
	} finally {
		db.close();
	}
}

export function formatSessionDate(ts: number): string {
	return new Intl.DateTimeFormat(undefined, {
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(new Date(ts));
}

export type MissedWordRank = {
	word: string;
	misses: number;
};

/**
 * Rank target words that were marked incorrect, for one word list.
 * Higher miss count first; ties broken alphabetically.
 */
export async function rankMissedWords(
	wordList: PracticeListId,
	sessionLimit = 200
): Promise<MissedWordRank[]> {
	const sessions = await listSessions(sessionLimit);
	const counts = new Map<string, number>();

	for (const session of sessions) {
		if (session.wordList !== wordList) continue;
		if (session.mode === 'keys' || session.mode === 'slow-keys') continue;
		for (const item of session.words) {
			if (item.correct) continue;
			counts.set(item.word, (counts.get(item.word) ?? 0) + 1);
		}
	}

	return [...counts.entries()]
		.map(([word, misses]) => ({ word, misses }))
		.sort((a, b) => b.misses - a.misses || a.word.localeCompare(b.word));
}

/** Unique misspelled targets from a single session, most recent order preserved. */
export function missedWordsFromSession(session: StoredSession): string[] {
	if (session.mode === 'keys' || session.mode === 'slow-keys') return [];
	const seen = new Set<string>();
	const words: string[] = [];
	for (const item of session.words) {
		if (item.correct || seen.has(item.word)) continue;
		seen.add(item.word);
		words.push(item.word);
	}
	return words;
}

function median(values: number[]): number {
	if (values.length === 0) return 0;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 1) return sorted[mid]!;
	return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

/**
 * Rank keys by median reaction time among correct presses (slowest first).
 * Only includes keys with at least SLOW_KEY_MIN_SAMPLES correct timed hits.
 */
export async function rankSlowKeys(
	wordList: PracticeListId,
	sessionLimit = 200
): Promise<SlowKeyRank[]> {
	const sessions = await listSessions(sessionLimit);
	const samples = new Map<string, number[]>();

	for (const session of sessions) {
		if (session.wordList !== wordList) continue;
		if (session.mode !== 'keys' && session.mode !== 'slow-keys') continue;
		for (const item of session.words) {
			if (!item.correct) continue;
			if (item.tttMs == null || item.tttMs <= 0) continue;
			if (item.word.length !== 1) continue;
			const list = samples.get(item.word) ?? [];
			list.push(item.tttMs);
			samples.set(item.word, list);
		}
	}

	return [...samples.entries()]
		.map(([key, times]) => ({
			key,
			medianTttMs: median(times),
			samples: times.length
		}))
		.filter((r) => r.samples >= SLOW_KEY_MIN_SAMPLES)
		.sort(
			(a, b) =>
				b.medianTttMs - a.medianTttMs || a.key.localeCompare(b.key, undefined, { sensitivity: 'variant' })
		);
}

export function isKeysSession(session: StoredSession): boolean {
	return session.mode === 'keys' || session.mode === 'slow-keys';
}

export function modeLabel(mode: PracticeMode): string {
	switch (mode) {
		case 'missed':
			return 'Misspellings';
		case 'keys':
			return 'Keys';
		case 'slow-keys':
			return 'Slow keys';
		default:
			return 'Words';
	}
}

/** e.g. "Keys · Home row", "Keys · Custom", "Slow keys", "Words". */
export function sessionModeLabel(session: StoredSession): string {
	const base = modeLabel(session.mode);
	if (session.mode !== 'keys') return base;
	const preset = keyPresetLabel(session.keyPreset);
	return preset ? `${base} · ${preset}` : base;
}
