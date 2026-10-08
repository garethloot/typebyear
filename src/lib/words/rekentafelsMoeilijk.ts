const FACTORS_MIN = 1;
const FACTORS_MAX = 12;

/** Tables included in the harder set. The 10 tafel is intentionally omitted. */
const TABLES = [6, 7, 8, 9, 11, 12] as const;

type RekentafelPrompt = {
	typed: string;
	spoken: string;
};

/**
 * Tafels 6, 7, 8, 9, 11, and 12, each times 1–12.
 * Spoken as "<a> keer <b> is", typed as the product.
 */
function buildRekentafelsMoeilijk(): RekentafelPrompt[] {
	const prompts: RekentafelPrompt[] = [];
	for (const a of TABLES) {
		for (let b = FACTORS_MIN; b <= FACTORS_MAX; b++) {
			prompts.push({
				spoken: `${a} keer ${b} is`,
				typed: String(a * b)
			});
		}
	}
	return prompts;
}

export const rekentafelsMoeilijk: RekentafelPrompt[] = buildRekentafelsMoeilijk();
