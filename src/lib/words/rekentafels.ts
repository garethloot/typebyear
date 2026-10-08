const TABLE_MIN = 1;
const TABLE_MAX = 12;

type RekentafelPrompt = {
	typed: string;
	spoken: string;
};

/** Tafels 1-12: every ordered pair, spoken as "<a> keer <b> is", typed as the product. */
function buildRekentafels(): RekentafelPrompt[] {
	const prompts: RekentafelPrompt[] = [];
	for (let a = TABLE_MIN; a <= TABLE_MAX; a++) {
		for (let b = TABLE_MIN; b <= TABLE_MAX; b++) {
			prompts.push({
				spoken: `${a} keer ${b} is`,
				typed: String(a * b)
			});
		}
	}
	return prompts;
}

export const rekentafels: RekentafelPrompt[] = buildRekentafels();
