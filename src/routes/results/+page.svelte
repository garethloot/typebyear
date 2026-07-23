<script lang="ts">
	import { onMount } from 'svelte';
	import ProgressChart from '$lib/components/ProgressChart.svelte';
	import {
		formatSessionDate,
		isKeysSession,
		listSessions,
		missedWordsFromSession,
		modeLabel,
		rankSlowKeys,
		type StoredSession
	} from '$lib/history';
	import { formatTtt } from '$lib/session.svelte';
	import type { Language } from '$lib/words';

	type Metric = 'accuracy' | 'cpm' | 'ttt';

	let sessions = $state.raw<StoredSession[]>([]);
	let loading = $state(true);
	let metric = $state<Metric>('ttt');
	let openId = $state<number | null>(null);
	let slowKeyLangs = $state.raw<Language[]>([]);

	/** Oldest → newest for trend reading. */
	const chronological = $derived([...sessions].reverse());

	const chartPoints = $derived(
		chronological.map((s) => {
			const value =
				metric === 'accuracy' ? s.accuracy : metric === 'cpm' ? s.cpm : s.tttMs / 1000;
			return {
				x: s.completedAt,
				y: value,
				value,
				label: formatSessionDate(s.completedAt)
			};
		})
	);

	const yMax = $derived.by(() => {
		if (metric === 'accuracy') return 100;
		const peak = Math.max(...chartPoints.map((p) => p.value), 1);
		return Math.ceil(peak * 1.15);
	});

	const formatValue = $derived(
		metric === 'accuracy'
			? (v: number) => `${Math.round(v)}%`
			: metric === 'cpm'
				? (v: number) => `${Math.round(v)}`
				: (v: number) => `${v.toFixed(1)}s`
	);

	onMount(() => {
		void listSessions(100)
			.then(async (rows) => {
				sessions = rows;
				const langs = [...new Set(rows.map((r) => r.language))];
				const available: Language[] = [];
				for (const lang of langs) {
					const ranked = await rankSlowKeys(lang);
					if (ranked.length > 0) available.push(lang);
				}
				slowKeyLangs = available;
			})
			.catch(() => {
				sessions = [];
			})
			.finally(() => {
				loading = false;
			});
	});

	function langLabel(lang: Language): string {
		return lang === 'nl' ? 'NL' : 'EN';
	}

	function toggle(id: number | undefined) {
		if (id == null) return;
		openId = openId === id ? null : id;
	}
</script>

<main class="results">
	<header class="top">
		<a class="brand" href="/">TypeByEar</a>
		<a class="back" href="/">Home</a>
	</header>

	<h1>Results</h1>
	<p class="lede">Sessions saved in this browser.</p>

	{#if loading}
		<p class="status">Loading…</p>
	{:else if sessions.length === 0}
		<p class="status">No sessions yet. Finish a practice run to see results here.</p>
		<p><a href="/">Start practicing</a></p>
	{:else}
		{#if slowKeyLangs.length > 0}
			<p class="slow-link">
				{#each slowKeyLangs as lang, i (lang)}
					{#if i > 0}<span aria-hidden="true"> · </span>{/if}
					<a href={`/practice?lang=${lang}&mode=slow-keys`}
						>Train slow keys ({langLabel(lang)})</a
					>
				{/each}
			</p>
		{/if}

		<section class="chart-block" aria-labelledby="trend-title">
			<div class="chart-head">
				<h2 id="trend-title">Trend</h2>
				<div class="metrics" role="group" aria-label="Chart metric">
					<button
						type="button"
						class={['metric', metric === 'ttt' && 'active']}
						onclick={() => (metric = 'ttt')}
						aria-pressed={metric === 'ttt'}
					>
						TTT
					</button>
					<button
						type="button"
						class={['metric', metric === 'accuracy' && 'active']}
						onclick={() => (metric = 'accuracy')}
						aria-pressed={metric === 'accuracy'}
					>
						Accuracy
					</button>
					<button
						type="button"
						class={['metric', metric === 'cpm' && 'active']}
						onclick={() => (metric = 'cpm')}
						aria-pressed={metric === 'cpm'}
					>
						CPM
					</button>
				</div>
			</div>

			<ProgressChart
				points={chartPoints}
				yMin={0}
				{yMax}
				{formatValue}
				ariaLabel={`${metric} over recent sessions`}
			/>
		</section>

		<section class="list-block" aria-labelledby="list-title">
			<h2 id="list-title">All sessions</h2>
			<ul class="sessions">
				{#each sessions as row (row.id)}
					<li class="session">
						<button
							type="button"
							class="row"
							onclick={() => toggle(row.id)}
							aria-expanded={openId === row.id}
						>
							<span class="when">{formatSessionDate(row.completedAt)}</span>
							<span class="meta">
								{langLabel(row.language)} · {modeLabel(row.mode)} · {row.accuracy}% · {formatTtt(
									row.tttMs
								)}
							</span>
						</button>

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
									<a href={`/practice?lang=${row.language}&mode=missed`}>Practice misspellings</a>
								</p>
							{/if}
							{#if isKeysSession(row)}
								<p class="practice-link">
									<a href={`/practice?lang=${row.language}&mode=slow-keys`}>Practice slow keys</a>
									·
									<a href={`/practice?lang=${row.language}&mode=keys`}>Choose keys</a>
								</p>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</main>

<style>
	.results {
		min-height: 100dvh;
		padding: clamp(1.25rem, 4vw, 2.5rem);
		max-width: 44rem;
		margin: 0 auto;
	}

	.top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.75rem;
	}

	.brand {
		font-family: var(--font-display);
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--teal-deep);
		text-decoration: none;
	}

	.back {
		font-size: 0.95rem;
		color: var(--ink-soft);
	}

	h1 {
		font-family: var(--font-display);
		font-size: clamp(1.75rem, 4vw, 2.25rem);
		font-weight: 700;
		margin: 0 0 0.4rem;
		color: var(--teal-deep);
	}

	.lede {
		margin: 0 0 2rem;
		color: var(--ink-soft);
	}

	.status {
		color: var(--ink-soft);
	}

	.chart-block,
	.list-block {
		margin-bottom: 2.5rem;
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

	.metric {
		border: 1px solid color-mix(in srgb, var(--teal) 35%, transparent);
		background: transparent;
		color: var(--ink-soft);
		padding: 0.35rem 0.7rem;
		border-radius: 0.3rem;
		font-size: 0.85rem;
	}

	.metric.active {
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

	.row {
		width: 100%;
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
		margin: -1rem 0 1.5rem;
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
