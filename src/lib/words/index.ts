import en from './en.json';
import nl from './nl.json';

export type Language = 'en' | 'nl';

/** `random` = bank sample; `missed` = drilled from past incorrect words. */
export type PracticeMode = 'random' | 'missed';

export const SESSION_SIZE = 25;

const banks: Record<Language, string[]> = {
	en,
	nl
};

export function shuffle<T>(items: T[]): T[] {
	const arr = [...items];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

export function pickSessionWords(lang: Language, count = SESSION_SIZE): string[] {
	const bank = banks[lang];
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

export function isLanguage(value: string | null): value is Language {
	return value === 'en' || value === 'nl';
}

export function isPracticeMode(value: string | null): value is PracticeMode {
	return value === 'random' || value === 'missed';
}
