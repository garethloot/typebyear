export type CustomSpeechLanguage = 'en' | 'nl';

export type CustomPrompt = {
	id: string;
	spoken: string;
	typed: string;
};

export type CustomList = {
	id: string;
	name: string;
	speechLang: CustomSpeechLanguage;
	prompts: CustomPrompt[];
};

const STORAGE_KEY = 'typebyear:custom-lists';
const CUSTOM_ID_PREFIX = 'custom_';

export function isCustomListId(value: string | null | undefined): boolean {
	return typeof value === 'string' && value.startsWith(CUSTOM_ID_PREFIX);
}

function newId(prefix: string): string {
	const uuid =
		typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
			? crypto.randomUUID()
			: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
	return `${prefix}${uuid}`;
}

export function newCustomListId(): string {
	return newId(CUSTOM_ID_PREFIX);
}

export function newPromptId(): string {
	return newId('prompt_');
}

function isSpeechLanguage(value: unknown): value is CustomSpeechLanguage {
	return value === 'en' || value === 'nl';
}

function normalizePrompt(raw: unknown): CustomPrompt | null {
	if (!raw || typeof raw !== 'object') return null;
	const obj = raw as Record<string, unknown>;
	const typed = typeof obj.typed === 'string' ? obj.typed.trim() : '';
	if (!typed) return null;
	const spokenRaw = typeof obj.spoken === 'string' ? obj.spoken.trim() : '';
	const spoken = spokenRaw || typed;
	const id = typeof obj.id === 'string' && obj.id ? obj.id : newPromptId();
	return { id, spoken, typed };
}

function normalizeList(raw: unknown): CustomList | null {
	if (!raw || typeof raw !== 'object') return null;
	const obj = raw as Record<string, unknown>;
	const id = typeof obj.id === 'string' ? obj.id : '';
	if (!isCustomListId(id)) return null;
	const name = typeof obj.name === 'string' ? obj.name.trim() : '';
	if (!name) return null;
	const speechLang = isSpeechLanguage(obj.speechLang) ? obj.speechLang : 'en';
	const promptsRaw = Array.isArray(obj.prompts) ? obj.prompts : [];
	const prompts = promptsRaw
		.map(normalizePrompt)
		.filter((p): p is CustomPrompt => p != null);
	return { id, name, speechLang, prompts };
}

export function loadCustomLists(): CustomList[] {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.map(normalizeList).filter((list): list is CustomList => list != null);
	} catch {
		return [];
	}
}

function saveAll(lists: CustomList[]): CustomList[] {
	if (typeof localStorage === 'undefined') return lists;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
	} catch {
		// quota / private mode — ignore
	}
	return lists;
}

/** Normalize a raw custom-list array; drops invalid entries. */
export function parseCustomLists(raw: unknown): CustomList[] {
	if (!Array.isArray(raw)) return [];
	return raw.map(normalizeList).filter((list): list is CustomList => list != null);
}

/** Replace all custom lists. Throws on storage failure (quota / private mode). */
export function replaceCustomLists(lists: CustomList[]): void {
	if (typeof localStorage === 'undefined') {
		throw new Error('localStorage unavailable');
	}
	localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
}

export function getCustomList(id: string): CustomList | null {
	if (!isCustomListId(id)) return null;
	return loadCustomLists().find((list) => list.id === id) ?? null;
}

export type CustomListInput = {
	name: string;
	speechLang: CustomSpeechLanguage;
	prompts: Array<{ id?: string; spoken?: string; typed: string }>;
};

function toStoredPrompts(
	prompts: CustomListInput['prompts']
): CustomPrompt[] {
	const out: CustomPrompt[] = [];
	for (const prompt of prompts) {
		const typed = prompt.typed.trim();
		if (!typed) continue;
		const spoken = (prompt.spoken ?? '').trim() || typed;
		out.push({
			id: prompt.id && prompt.id.length > 0 ? prompt.id : newPromptId(),
			spoken,
			typed
		});
	}
	return out;
}

export function createCustomList(input: CustomListInput): CustomList {
	const list: CustomList = {
		id: newCustomListId(),
		name: input.name.trim() || 'Untitled list',
		speechLang: input.speechLang,
		prompts: toStoredPrompts(input.prompts)
	};
	saveAll([...loadCustomLists(), list]);
	return list;
}

export function updateCustomList(id: string, input: CustomListInput): CustomList | null {
	const lists = loadCustomLists();
	const index = lists.findIndex((list) => list.id === id);
	if (index < 0) return null;
	const next: CustomList = {
		id,
		name: input.name.trim() || 'Untitled list',
		speechLang: input.speechLang,
		prompts: toStoredPrompts(input.prompts)
	};
	const updated = [...lists];
	updated[index] = next;
	saveAll(updated);
	return next;
}

export function deleteCustomList(id: string): boolean {
	const lists = loadCustomLists();
	const next = lists.filter((list) => list.id !== id);
	if (next.length === lists.length) return false;
	saveAll(next);
	return true;
}
