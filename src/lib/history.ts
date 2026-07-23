import type { Language } from '$lib/words';

const DB_NAME = 'tabtype';
const DB_VERSION = 1;
const STORE = 'sessions';

export type StoredWord = {
	word: string;
	correct: boolean;
};

export type StoredSession = {
	id?: number;
	completedAt: number;
	language: Language;
	total: number;
	correct: number;
	accuracy: number;
	tttMs: number;
	cpm: number;
	words: StoredWord[];
};

export type SessionResultInput = {
	language: Language;
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
			language: result.language,
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
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
			tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
		});

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
				results.push(cursor.value as StoredSession);
				cursor.continue();
			};
		});

		return results;
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
 * Rank target words that were marked incorrect, for one language.
 * Higher miss count first; ties broken alphabetically.
 */
export async function rankMissedWords(
	language: Language,
	sessionLimit = 200
): Promise<MissedWordRank[]> {
	const sessions = await listSessions(sessionLimit);
	const counts = new Map<string, number>();

	for (const session of sessions) {
		if (session.language !== language) continue;
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
	const seen = new Set<string>();
	const words: string[] = [];
	for (const item of session.words) {
		if (item.correct || seen.has(item.word)) continue;
		seen.add(item.word);
		words.push(item.word);
	}
	return words;
}
