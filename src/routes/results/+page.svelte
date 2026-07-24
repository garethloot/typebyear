<script lang="ts">
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import AppNav from '$lib/components/AppNav.svelte';
	import ProgressChart from '$lib/components/ProgressChart.svelte';
	import {
		clearSessions,
		deleteSession,
		formatSessionDate,
		isKeysSession,
		listSessions,
		missedWordsFromSession,
		rankSlowKeys,
		sessionModeLabel,
		type StoredSession
	} from '$lib/history';
	import { KEY_PRESETS, keyPresetLabel, type StoredKeyPreset } from '$lib/keys';
	import { formatTtt } from '$lib/session.svelte';
	import type { Language } from '$lib/words';

	type Metric = 'accuracy' | 'cpm' | 'ttt';
	type ChartPoint = { x: number; y: number; value: number; label: string };
	type KeyPresetFilter = 'all' | StoredKeyPreset | 'slow-keys';

	let sessions = $state.raw<StoredSession[]>([]);
	let loading = $state(true);
	let wordMetric = $state<Metric>('ttt');
	let keyMetric = $state<Exclude<Metric, 'cpm'>>('ttt');
	let keyPresetFilter = $state<KeyPresetFilter>('all');
	let openId = $state<number | null>(null);
	let slowKeyLangs = $state.raw<Language[]>([]);

	const wordSessions = $derived(sessions.filter((s) => !isKeysSession(s)));
	const keySessions = $derived(sessions.filter((s) => isKeysSession(s)));

	const filteredKeySessions = $derived.by(() => {
		if (keyPresetFilter === 'all') return keySessions;
		if (keyPresetFilter === 'slow-keys') {
			return keySessions.filter((s) => s.mode === 'slow-keys');
		}
		return keySessions.filter((s) => s.mode === 'keys' && s.keyPreset === keyPresetFilter);
	});

	const availableKeyFilters = $derived.by(() => {
		const filters: KeyPresetFilter[] = [];
		if (keySessions.length === 0) return filters;
		filters.push('all');
		for (const preset of KEY_PRESETS) {
			if (keySessions.some((s) => s.mode === 'keys' && s.keyPreset === preset.id)) {
				filters.push(preset.id);
			}
		}
		if (keySessions.some((s) => s.mode === 'keys' && s.keyPreset === 'custom')) {
			filters.push('custom');
		}
		if (keySessions.some((s) => s.mode === 'slow-keys')) {
			filters.push('slow-keys');
		}
		return filters;
	});

	const wordChartPoints = $derived(chartPointsFor(wordSessions, wordMetric));
	const keyChartPoints = $derived(chartPointsFor(filteredKeySessions, keyMetric));

	const wordYMax = $derived(yMaxFor(wordMetric, wordChartPoints));
	const keyYMax = $derived(yMaxFor(keyMetric, keyChartPoints));

	const formatWordValue = $derived(formatValueFor(wordMetric));
	const formatKeyValue = $derived(formatValueFor(keyMetric));

	const keyChartAriaLabel = $derived(
		keyPresetFilter === 'all'
			? `Keys ${keyMetric} over recent sessions`
			: `Keys ${filterChipLabel(keyPresetFilter)} ${keyMetric} over recent sessions`
	);

	onMount(() => {
		void listSessions(100)
			.then(async (rows) => {
				sessions = rows;
				await refreshSlowKeyLangs(rows);
			})
			.catch(() => {
				sessions = [];
			})
			.finally(() => {
				loading = false;
			});
	});

	async function refreshSlowKeyLangs(rows: StoredSession[]) {
		const langs = [...new Set(rows.map((r) => r.language))];
		const available: Language[] = [];
		for (const lang of langs) {
			const ranked = await rankSlowKeys(lang);
			if (ranked.length > 0) available.push(lang);
		}
		slowKeyLangs = available;
	}

	function syncKeyPresetFilter(rows: StoredSession[]) {
		if (keyPresetFilter === 'all') return;
		const keys = rows.filter(isKeysSession);
		const stillValid =
			keyPresetFilter === 'slow-keys'
				? keys.some((s) => s.mode === 'slow-keys')
				: keys.some((s) => s.mode === 'keys' && s.keyPreset === keyPresetFilter);
		if (!stillValid) keyPresetFilter = 'all';
	}

	async function removeSession(id: number | undefined) {
		if (id == null) return;
		try {
			await deleteSession(id);
		} catch {
			return;
		}
		const next = sessions.filter((s) => s.id !== id);
		sessions = next;
		if (openId === id) openId = null;
		syncKeyPresetFilter(next);
		await refreshSlowKeyLangs(next);
	}

	async function clearAll() {
		if (!confirm('Delete all saved sessions? This can’t be undone.')) return;
		try {
			await clearSessions();
		} catch {
			return;
		}
		sessions = [];
		openId = null;
		keyPresetFilter = 'all';
		slowKeyLangs = [];
	}

	function chartPointsFor(rows: StoredSession[], metric: Metric): ChartPoint[] {
		return [...rows].reverse().map((s) => {
			const value =
				metric === 'accuracy' ? s.accuracy : metric === 'cpm' ? s.cpm : s.tttMs / 1000;
			return {
				x: s.completedAt,
				y: value,
				value,
				label: formatSessionDate(s.completedAt)
			};
		});
	}

	function yMaxFor(metric: Metric, points: ChartPoint[]): number {
		if (metric === 'accuracy') return 100;
		const peak = Math.max(...points.map((p) => p.value), 1);
		return Math.ceil(peak * 1.15);
	}

	function formatValueFor(metric: Metric): (v: number) => string {
		if (metric === 'accuracy') return (v) => `${Math.round(v)}%`;
		if (metric === 'cpm') return (v) => `${Math.round(v)}`;
		return (v) => `${v.toFixed(1)}s`;
	}

	function filterChipLabel(filter: KeyPresetFilter): string {
		if (filter === 'all') return 'All';
		if (filter === 'slow-keys') return 'Slow keys';
		return keyPresetLabel(filter) ?? filter;
	}

	function langLabel(lang: Language): string {
		return lang === 'nl' ? 'NL' : 'EN';
	}

	function toggle(id: number | undefined) {
		if (id == null) return;
		openId = openId === id ? null : id;
	}
</script>

<main class="results">
	<AppNav />

	<div class="heading">
		<div>
			<h1>Results</h1>
			<p class="lede">Sessions saved in this browser.</p>
		</div>
		{#if !loading && sessions.length > 0}
			<button type="button" class="clear-all" onclick={clearAll}>Clear all</button>
		{/if}
	</div>

	{#if loading}
		<p class="status muted" role="status">Loading sessions…</p>
	{:else if sessions.length === 0}
		<div class="empty-state">
			<p class="status">No sessions yet. Finish a practice run to see results here.</p>
			<a class="start-link" href={resolve('/')}>Start practicing</a>
		</div>
	{:else}
		<dl class="legend">
			<div>
				<dt>TTT</dt>
				<dd>Median reaction time from speech end to submit, in seconds. Lower is better.</dd>
			</div>
			<div>
				<dt>CPM</dt>
				<dd>
					Median typing speed over the TTT window (word sessions). Higher is better.
				</dd>
			</div>
			<div>
				<dt>Accuracy</dt>
				<dd>Percent of prompts typed correctly.</dd>
			</div>
		</dl>

		{#if slowKeyLangs.length > 0}
			<p class="slow-link">
				{#each slowKeyLangs as lang, i (lang)}
					{#if i > 0}<span aria-hidden="true"> · </span>{/if}
					<a href={resolve(`/practice?lang=${lang}&mode=slow-keys`)}
						>Train slow keys ({langLabel(lang)})</a
					>
				{/each}
			</p>
		{/if}

		{#snippet sessionList(rows: StoredSession[])}
			<ul class="sessions">
				{#each rows as row (row.id)}
					<li class="session">
						<div class="session-head">
							<button
								type="button"
								class="row"
								onclick={() => toggle(row.id)}
								aria-expanded={openId === row.id}
							>
								<span class="when">{formatSessionDate(row.completedAt)}</span>
								<span class="meta">
									{langLabel(row.language)} · {sessionModeLabel(row)} · {row.accuracy}% · {formatTtt(
										row.tttMs
									)}
								</span>
							</button>
							<button
								type="button"
								class="delete"
								onclick={() => void removeSession(row.id)}
								aria-label={`Delete session from ${formatSessionDate(row.completedAt)}`}
							>
								<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
									<path
										fill="currentColor"
										d="M6 1h4l.5 1H14v1.5H2V2h3.5L6 1Zm1 4.5V12h1.5V5.5H7Zm2.5 0V12H11V5.5H9.5ZM3.5 3.5h9l-.7 10.2A1.5 1.5 0 0 1 10.3 15H5.7a1.5 1.5 0 0 1-1.5-1.3L3.5 3.5Z"
									/>
								</svg>
							</button>
						</div>

						{#if openId === row.id}
							<p
								class="words"
								aria-label={isKeysSession(row)
									? 'Keys from this session'
									: 'Words from this session'}
							>
								{#each row.words as item, i (i + item.word)}
									<span class={['w', item.correct ? 'ok' : 'bad']}>
										{item.word}{#if isKeysSession(row) && item.tttMs != null}<span class="ttt"
												>{formatTtt(item.tttMs)}</span
											>{/if}
									</span>
								{/each}
							</p>
							{#if missedWordsFromSession(row).length > 0}
								<p class="practice-link">
									<a href={resolve(`/practice?lang=${row.language}&mode=missed`)}
										>Practice misspellings</a
									>
								</p>
							{/if}
							{#if isKeysSession(row)}
								<p class="practice-link">
									<a href={resolve(`/practice?lang=${row.language}&mode=slow-keys`)}
										>Practice slow keys</a
									>
									·
									<a href={resolve(`/practice?lang=${row.language}&mode=keys`)}>Choose keys</a>
								</p>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{/snippet}

		<div class="columns">
			<section class="column" aria-labelledby="words-title">
				{#if wordSessions.length === 0}
					<h2 id="words-title">Words</h2>
					<p class="empty">No word sessions yet.</p>
				{:else}
					<div class="chart-head">
						<h2 id="words-title">Words</h2>
						<div class="metrics" role="group" aria-label="Words chart metric">
							<button
								type="button"
								class={['metric', wordMetric === 'ttt' && 'active']}
								onclick={() => (wordMetric = 'ttt')}
								aria-pressed={wordMetric === 'ttt'}
							>
								TTT
							</button>
							<button
								type="button"
								class={['metric', wordMetric === 'accuracy' && 'active']}
								onclick={() => (wordMetric = 'accuracy')}
								aria-pressed={wordMetric === 'accuracy'}
							>
								Accuracy
							</button>
							<button
								type="button"
								class={['metric', wordMetric === 'cpm' && 'active']}
								onclick={() => (wordMetric = 'cpm')}
								aria-pressed={wordMetric === 'cpm'}
							>
								CPM
							</button>
						</div>
					</div>

					<ProgressChart
						points={wordChartPoints}
						yMin={0}
						yMax={wordYMax}
						formatValue={formatWordValue}
						ariaLabel={`Words ${wordMetric} over recent sessions`}
					/>
					{@render sessionList(wordSessions)}
				{/if}
			</section>

			<section class="column" aria-labelledby="keys-title">
				{#if keySessions.length === 0}
					<h2 id="keys-title">Keys</h2>
					<p class="empty">No key sessions yet.</p>
				{:else}
					<div class="chart-head">
						<h2 id="keys-title">Keys</h2>
						<div class="metrics" role="group" aria-label="Keys chart metric">
							<button
								type="button"
								class={['metric', keyMetric === 'ttt' && 'active']}
								onclick={() => (keyMetric = 'ttt')}
								aria-pressed={keyMetric === 'ttt'}
							>
								TTT
							</button>
							<button
								type="button"
								class={['metric', keyMetric === 'accuracy' && 'active']}
								onclick={() => (keyMetric = 'accuracy')}
								aria-pressed={keyMetric === 'accuracy'}
							>
								Accuracy
							</button>
						</div>
						{#if availableKeyFilters.length > 1}
							<div class="presets" role="group" aria-label="Filter by key preset">
								{#each availableKeyFilters as filter (filter)}
									<button
										type="button"
										class={['preset', keyPresetFilter === filter && 'active']}
										onclick={() => (keyPresetFilter = filter)}
										aria-pressed={keyPresetFilter === filter}
									>
										{filterChipLabel(filter)}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<ProgressChart
						points={keyChartPoints}
						yMin={0}
						yMax={keyYMax}
						formatValue={formatKeyValue}
						ariaLabel={keyChartAriaLabel}
					/>
					{@render sessionList(filteredKeySessions)}
				{/if}
			</section>
		</div>
	{/if}
</main>

<style>
	.results {
		min-height: 100dvh;
		padding: clamp(1.25rem, 4vw, 2.5rem);
		max-width: 60rem;
		margin: 0 auto;
		min-width: 0;
		overflow-x: clip;
	}

	.heading {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem 1.25rem;
		margin-bottom: 2rem;
	}

	h1 {
		font-family: var(--font-display);
		font-size: clamp(1.75rem, 4vw, 2.25rem);
		font-weight: 700;
		margin: 0 0 0.4rem;
		color: var(--teal-deep);
	}

	.lede {
		margin: 0;
		color: var(--ink-soft);
	}

	.legend {
		margin: -0.75rem 0 1.75rem;
		padding: 0;
		display: grid;
		gap: 0.4rem 1.5rem;
		font-size: 0.9rem;
		color: var(--ink-soft);
	}

	@media (min-width: 40rem) {
		.legend {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	.legend > div {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.3rem 0.55rem;
		align-items: baseline;
	}

	.legend dt {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 500;
		color: var(--teal-deep);
	}

	.legend dd {
		margin: 0;
	}

	.clear-all {
		border: 1px solid color-mix(in srgb, var(--ink-soft) 35%, transparent);
		background: transparent;
		color: var(--ink-soft);
		padding: 0.4rem 0.75rem;
		border-radius: 0.3rem;
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		margin-top: 0.35rem;
	}

	.clear-all:hover {
		border-color: var(--incorrect);
		color: var(--incorrect);
	}

	.status {
		color: var(--ink-soft);
	}

	.muted {
		opacity: 0.85;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1rem;
	}

	.start-link {
		display: inline-block;
		background: var(--teal-deep);
		color: #f4fbfa;
		padding: 0.7rem 1.4rem;
		border-radius: 0.4rem;
		font-weight: 600;
		text-decoration: none;
		transition: background 0.2s ease;
	}

	.start-link:hover {
		background: var(--teal);
	}

	.empty {
		margin: 0.85rem 0 0;
		color: var(--ink-soft);
		font-size: 0.95rem;
	}

	.columns {
		display: grid;
		gap: 2rem;
	}

	@media (min-width: 52rem) {
		.columns {
			grid-template-columns: 1fr 1fr;
			align-items: start;
			gap: 0;
		}

		.column:first-child {
			padding-right: 1.5rem;
		}

		.column + .column {
			position: relative;
			padding-left: 1.5rem;
		}

		.column + .column::before {
			content: '';
			position: absolute;
			left: 0;
			top: 0;
			bottom: 0;
			width: 1px;
			background: color-mix(in srgb, var(--ink-soft) 18%, transparent);
		}
	}

	.chart-head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1rem;
		margin-bottom: 0.85rem;
	}

	h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 500;
	}

	.metrics {
		display: flex;
		gap: 0.35rem;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		flex-basis: 100%;
	}

	.metric,
	.preset {
		border: 1px solid color-mix(in srgb, var(--teal) 35%, transparent);
		background: transparent;
		color: var(--ink-soft);
		padding: 0.35rem 0.7rem;
		border-radius: 0.3rem;
		font-size: 0.85rem;
	}

	.metric.active,
	.preset.active {
		background: var(--teal);
		border-color: var(--teal);
		color: #f4fbfa;
	}

	.sessions {
		list-style: none;
		margin: 0.85rem 0 0;
		padding: 0;
		display: grid;
		gap: 0.35rem;
	}

	.session {
		border-bottom: 1px solid color-mix(in srgb, var(--ink-soft) 18%, transparent);
		padding-bottom: 0.35rem;
	}

	.session-head {
		display: flex;
		align-items: flex-start;
		gap: 0.25rem;
	}

	.row {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.35rem 1rem;
		border: none;
		background: transparent;
		padding: 0.55rem 0;
		text-align: left;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.row:hover .meta {
		color: var(--teal);
	}

	.delete {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		margin-top: 0.2rem;
		border: none;
		border-radius: 0.3rem;
		background: transparent;
		color: color-mix(in srgb, var(--ink-soft) 70%, transparent);
		cursor: pointer;
		padding: 0;
	}

	.delete:hover {
		color: var(--incorrect);
		background: color-mix(in srgb, var(--incorrect) 10%, transparent);
	}

	.when {
		color: var(--ink-soft);
		font-size: 0.95rem;
	}

	.meta {
		font-variant-numeric: tabular-nums;
		color: var(--teal-deep);
		font-size: 0.95rem;
	}

	.slow-link {
		margin: -0.75rem 0 1.5rem;
		font-size: 0.95rem;
		color: var(--ink-soft);
	}

	.slow-link a {
		color: var(--teal-deep);
	}

	.words {
		margin: 0 0 0.75rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem 0.75rem;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		line-height: 1.6;
	}

	.w {
		display: inline-flex;
		align-items: baseline;
		gap: 0.3rem;
	}

	.w .ttt {
		font-family: var(--font-body);
		font-size: 0.75rem;
		color: var(--ink-soft);
	}

	.w.ok {
		color: color-mix(in srgb, var(--ink-soft) 75%, var(--correct));
	}

	.w.bad {
		color: var(--incorrect);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.18em;
	}

	.practice-link {
		margin: 0 0 0.85rem;
		font-size: 0.9rem;
	}

	.practice-link a {
		color: var(--teal-deep);
	}
</style>
