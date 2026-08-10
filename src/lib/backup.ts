import { loadCustomLists, parseCustomLists, replaceCustomLists, type CustomList } from '$lib/customLists';
import {
	getAllSessions,
	parseSessionRecord,
	replaceAllSessions,
	type StoredSession
} from '$lib/history';
import { loadSavedKeySelection, parseKeySelection, replaceKeySelection } from '$lib/keys';
import { loadPrefs, parsePrefs, replacePrefs, type Prefs } from '$lib/prefs';

export const BACKUP_FORMAT = 'typebyear-backup' as const;
export const BACKUP_VERSION = 1;

export type TypeByEarBackup = {
	format: typeof BACKUP_FORMAT;
	version: number;
	exportedAt: string;
	data: {
		prefs: Prefs;
		customLists: CustomList[];
		keySelection: string[];
		sessions: StoredSession[];
	};
};

export class BackupError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BackupError';
	}
}

function sessionForExport(session: StoredSession): StoredSession {
	const { id: _id, ...rest } = session;
	return rest;
}

function prefsWithKnownCustomLists(raw: unknown, customLists: CustomList[]): Prefs {
	const parsed = parsePrefs(raw);
	if (!raw || typeof raw !== 'object') return parsed;
	const wordList = (raw as Record<string, unknown>).wordList;
	if (typeof wordList === 'string' && customLists.some((list) => list.id === wordList)) {
		return { ...parsed, wordList };
	}
	return parsed;
}

export async function buildBackup(): Promise<TypeByEarBackup> {
	const sessions = await getAllSessions();
	return {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		data: {
			prefs: loadPrefs(),
			customLists: loadCustomLists(),
			keySelection: loadSavedKeySelection() ?? [],
			sessions: sessions.map(sessionForExport)
		}
	};
}

export function backupFilename(exportedAt = new Date()): string {
	const y = exportedAt.getFullYear();
	const m = String(exportedAt.getMonth() + 1).padStart(2, '0');
	const d = String(exportedAt.getDate()).padStart(2, '0');
	return `typebyear-backup-${y}-${m}-${d}.json`;
}

export async function downloadBackup(): Promise<void> {
	const backup = await buildBackup();
	const json = JSON.stringify(backup, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = backupFilename(new Date(backup.exportedAt));
	a.rel = 'noopener';
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

export function parseBackup(raw: unknown): TypeByEarBackup {
	if (!raw || typeof raw !== 'object') {
		throw new BackupError('Invalid backup file.');
	}

	const obj = raw as Record<string, unknown>;
	if (obj.format !== BACKUP_FORMAT) {
		throw new BackupError('Not a TypeByEar backup file.');
	}
	if (obj.version !== BACKUP_VERSION) {
		throw new BackupError(
			typeof obj.version === 'number' && obj.version > BACKUP_VERSION
				? 'This backup was made with a newer app version. Update TypeByEar and try again.'
				: 'Unsupported backup version.'
		);
	}
	if (!obj.data || typeof obj.data !== 'object') {
		throw new BackupError('Backup file is missing data.');
	}

	const data = obj.data as Record<string, unknown>;
	if (!Array.isArray(data.customLists)) {
		throw new BackupError('Backup custom lists are invalid.');
	}
	if (!Array.isArray(data.sessions)) {
		throw new BackupError('Backup sessions are invalid.');
	}
	if (data.keySelection != null && !Array.isArray(data.keySelection)) {
		throw new BackupError('Backup key selection is invalid.');
	}

	const customLists = parseCustomLists(data.customLists);
	if (customLists.length !== data.customLists.length) {
		throw new BackupError('Backup custom lists contain invalid entries.');
	}

	const sessions: StoredSession[] = [];
	for (const row of data.sessions) {
		const parsed = parseSessionRecord(row);
		if (!parsed) {
			throw new BackupError('Backup sessions contain invalid entries.');
		}
		sessions.push(parsed);
	}

	const exportedAt =
		typeof obj.exportedAt === 'string' && obj.exportedAt.length > 0
			? obj.exportedAt
			: new Date().toISOString();

	return {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		exportedAt,
		data: {
			prefs: prefsWithKnownCustomLists(data.prefs, customLists),
			customLists,
			keySelection: parseKeySelection(data.keySelection),
			sessions
		}
	};
}

export async function parseBackupText(text: string): Promise<TypeByEarBackup> {
	let raw: unknown;
	try {
		raw = JSON.parse(text) as unknown;
	} catch {
		throw new BackupError('Backup file is not valid JSON.');
	}
	return parseBackup(raw);
}

export async function parseBackupFile(file: File): Promise<TypeByEarBackup> {
	const text = await file.text();
	return parseBackupText(text);
}

/**
 * Replace all local data with the backup contents.
 * Writes custom lists before prefs so selected custom list ids resolve.
 */
export async function applyBackup(backup: TypeByEarBackup): Promise<void> {
	try {
		replaceCustomLists(backup.data.customLists);
		replacePrefs(backup.data.prefs);
		replaceKeySelection(backup.data.keySelection);
	} catch (err) {
		if (err instanceof BackupError) throw err;
		throw new BackupError(
			'Could not save imported settings. Storage may be full or unavailable.'
		);
	}

	try {
		await replaceAllSessions(backup.data.sessions);
	} catch {
		throw new BackupError('Could not save imported sessions. IndexedDB may be unavailable.');
	}
}
