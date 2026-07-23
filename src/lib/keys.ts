import { SESSION_SIZE, shuffle, type Language } from '$lib/words';

/** Minimum correct hits before a key ranks as "slow". */
export const SLOW_KEY_MIN_SAMPLES = 3;

export const KEYS_STORAGE_KEY = 'typebyear.keys.selection';

/** Physical QWERTY rows: [unshifted, shifted] per key. */
export const KEYBOARD_ROWS: Array<Array<[string, string]>> = [
	[
		['`', '~'],
		['1', '!'],
		['2', '@'],
		['3', '#'],
		['4', '$'],
		['5', '%'],
		['6', '^'],
		['7', '&'],
		['8', '*'],
		['9', '('],
		['0', ')'],
		['-', '_'],
		['=', '+']
	],
	[
		['q', 'Q'],
		['w', 'W'],
		['e', 'E'],
		['r', 'R'],
		['t', 'T'],
		['y', 'Y'],
		['u', 'U'],
		['i', 'I'],
		['o', 'O'],
		['p', 'P'],
		['[', '{'],
		[']', '}'],
		['\\', '|']
	],
	[
		['a', 'A'],
		['s', 'S'],
		['d', 'D'],
		['f', 'F'],
		['g', 'G'],
		['h', 'H'],
		['j', 'J'],
		['k', 'K'],
		['l', 'L'],
		[';', ':'],
		["'", '"']
	],
	[
		['z', 'Z'],
		['x', 'X'],
		['c', 'C'],
		['v', 'V'],
		['b', 'B'],
		['n', 'N'],
		['m', 'M'],
		[',', '<'],
		['.', '>'],
		['/', '?']
	]
];

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const TOP_ROW = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'];
const HOME_ROW = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';'];
const BOTTOM_ROW = ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'];
const NUMBERS = '0123456789'.split('');

function allSelectableChars(): string[] {
	const set = new Set<string>();
	for (const row of KEYBOARD_ROWS) {
		for (const [unshifted, shifted] of row) {
			set.add(unshifted);
			set.add(shifted);
		}
	}
	return [...set];
}

export const ALL_KEYS = allSelectableChars();

const LETTER_SET = new Set(LETTERS);
const NUMBER_SET = new Set(NUMBERS);

export function isLetterKey(char: string): boolean {
	return LETTER_SET.has(char.toLowerCase()) && char.length === 1 && /[a-zA-Z]/.test(char);
}

export function isSymbolKey(char: string): boolean {
	return char.length === 1 && !LETTER_SET.has(char.toLowerCase()) && !NUMBER_SET.has(char);
}

export type KeyPresetId =
	| 'letters'
	| 'toprow'
	| 'homerow'
	| 'bottomrow'
	| 'numbers'
	| 'symbols'
	| 'all';

export type KeyPreset = {
	id: KeyPresetId;
	label: string;
	keys: string[];
};

export const KEY_PRESETS: KeyPreset[] = [
	{ id: 'letters', label: 'Letters', keys: [...LETTERS] },
	{ id: 'toprow', label: 'Top row', keys: [...TOP_ROW] },
	{ id: 'homerow', label: 'Home row', keys: [...HOME_ROW] },
	{ id: 'bottomrow', label: 'Bottom row', keys: [...BOTTOM_ROW] },
	{ id: 'numbers', label: 'Numbers', keys: [...NUMBERS] },
	{
		id: 'symbols',
		label: 'Symbols',
		keys: ALL_KEYS.filter((c) => isSymbolKey(c))
	},
	{ id: 'all', label: 'All', keys: [...ALL_KEYS] }
];

export function pickKeySession(selected: string[], count = SESSION_SIZE): string[] {
	const unique = [...new Set(selected.filter((c) => c.length === 1))];
	if (unique.length === 0 || count <= 0) return [];

	const picked: string[] = [];
	const bag = shuffle(unique);
	let i = 0;
	while (picked.length < count) {
		if (i >= bag.length) {
			bag.push(...shuffle(unique));
		}
		picked.push(bag[i]!);
		i += 1;
	}
	return picked;
}

export type SlowKeyRank = {
	key: string;
	medianTttMs: number;
	samples: number;
};

/**
 * Build a practice list from slowest keys (highest median reaction first).
 * Cycles the ranked list when the unique pool is smaller than a full session.
 */
export function pickSlowKeySession(ranked: SlowKeyRank[], count = SESSION_SIZE): string[] {
	if (ranked.length === 0 || count <= 0) return [];

	const unique = ranked.map((r) => r.key);
	if (unique.length >= count) {
		return shuffle(unique.slice(0, count));
	}

	// Weight slower keys a bit more (top of list gets extra reps).
	const pool: string[] = [];
	ranked.forEach((item, index) => {
		const reps = Math.max(1, ranked.length - index);
		for (let i = 0; i < reps; i++) pool.push(item.key);
	});

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

const SYMBOL_NAMES_EN: Record<string, string> = {
	'`': 'backtick',
	'~': 'tilde',
	'!': 'exclamation mark',
	'@': 'at sign',
	'#': 'hash',
	$: 'dollar sign',
	'%': 'percent',
	'^': 'caret',
	'&': 'ampersand',
	'*': 'asterisk',
	'(': 'left parenthesis',
	')': 'right parenthesis',
	'-': 'hyphen',
	_: 'underscore',
	'=': 'equals',
	'+': 'plus',
	'[': 'left bracket',
	']': 'right bracket',
	'{': 'left brace',
	'}': 'right brace',
	'\\': 'backslash',
	'|': 'pipe',
	';': 'semicolon',
	':': 'colon',
	"'": 'apostrophe',
	'"': 'quote',
	',': 'comma',
	'<': 'less than',
	'.': 'period',
	'>': 'greater than',
	'/': 'slash',
	'?': 'question mark'
};

const SYMBOL_NAMES_NL: Record<string, string> = {
	'`': 'accent grave',
	'~': 'tilde',
	'!': 'uitroepteken',
	'@': 'apenstaartje',
	'#': 'hekje',
	$: 'dollarteken',
	'%': 'procent',
	'^': 'dakje',
	'&': 'ampersand',
	'*': 'sterretje',
	'(': 'haakje openen',
	')': 'haakje sluiten',
	'-': 'streepje',
	_: 'underscore',
	'=': 'is-gelijkteken',
	'+': 'plus',
	'[': 'vierkant haakje openen',
	']': 'vierkant haakje sluiten',
	'{': 'accolade openen',
	'}': 'accolade sluiten',
	'\\': 'backslash',
	'|': 'streep',
	';': 'puntkomma',
	':': 'dubbele punt',
	"'": 'apostrof',
	'"': 'aanhalingsteken',
	',': 'komma',
	'<': 'kleiner dan',
	'.': 'punt',
	'>': 'groter dan',
	'/': 'schuine streep',
	'?': 'vraagteken'
};

/** Readable TTS label for a single practice key. */
export function keySpeechText(char: string, lang: Language): string {
	if (char.length !== 1) return char;

	if (/[a-z]/.test(char)) {
		return char;
	}

	if (/[A-Z]/.test(char)) {
		return lang === 'nl' ? `hoofdletter ${char.toLowerCase()}` : `capital ${char.toLowerCase()}`;
	}

	if (/[0-9]/.test(char)) {
		return char;
	}

	const names = lang === 'nl' ? SYMBOL_NAMES_NL : SYMBOL_NAMES_EN;
	return names[char] ?? char;
}

export function loadSavedKeySelection(): string[] | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(KEYS_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return null;
		const keys = parsed.filter((c): c is string => typeof c === 'string' && c.length === 1);
		return keys.length > 0 ? keys : null;
	} catch {
		return null;
	}
}

export function saveKeySelection(keys: string[]): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify([...new Set(keys)]));
	} catch {
		// quota / private mode — ignore
	}
}

export function isKeysPracticeMode(mode: string): boolean {
	return mode === 'keys' || mode === 'slow-keys';
}
