<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		formatSessionDate,
		listSessions,
		modeLabel,
		rankMissedWords,
		rankSlowKeys,
		type StoredSession
	} from '$lib/history';
	import { formatTtt } from '$lib/session.svelte';
	import { isSpeechAvailable } from '$lib/speech';
	import type { Language } from '$lib/words';

	let language = $state<Language>('en');
	let speechOk = $state(true);
	let recent = $state.raw<StoredSession[]>([]);
	let missedCount = $state(0);
	let slowKeyCount = $state(0);

	async function loadDrillCounts(lang: Language) {
		try {
			const [missed, slow] = await Promise.all([rankMissedWords(lang), rankSlowKeys(lang)]);
			missedCount = missed.length;
			slowKeyCount = slow.length;
		} catch {
			missedCount = 0;
			slowKeyCount = 0;
		}
	}

	function setLanguage(lang: Language) {
		language = lang;
		void loadDrillCounts(lang);
	}

	onMount(() => {
		speechOk = isSpeechAvailable();
		void listSessions(8)
			.then((rows) => {
				recent = rows;
			})
			.catch(() => {
				recent = [];
			});
		void loadDrillCounts(language);
	});

	function start() {
		goto(`/practice?lang=${language}`);
	}

	function startKeys() {
		goto(`/practice?lang=${language}&mode=keys`);
	}

	function startMissed() {
		goto(`/practice?lang=${language}&mode=missed`);
	}

	function startSlowKeys() {
		goto(`/practice?lang=${language}&mode=slow-keys`);
	}

	function langLabel(lang: Language): string {
		return lang === 'nl' ? 'NL' : 'EN';
	}
</script>

<main class="home">
	<p class="brand">TypeByEar</p>
	<h1>Hear it. Type it.</h1>
	<p class="lede">
		Words stay hidden. The app speaks one; you type from memory. Letter colors show how you’re
		doing as you go.
	</p>

	{#if !speechOk}
		<p class="warn" role="status">
			Speech isn’t available in this browser. You can still practice — wrong answers will reveal
			the word.
		</p>
	{/if}

	<div class="controls">
		<div class="langs" role="group" aria-label="Language">
			<button
				type="button"
				class={['lang', language === 'en' && 'active']}
				onclick={() => setLanguage('en')}
				aria-pressed={language === 'en'}
			>
				English
			</button>
			<button
				type="button"
				class={['lang', language === 'nl' && 'active']}
				onclick={() => setLanguage('nl')}
				aria-pressed={language === 'nl'}
			>
				Nederlands
			</button>
		</div>

		<button type="button" class="start" onclick={start}>Start session</button>
		<button type="button" class="secondary" onclick={startKeys}>Train keys</button>

		{#if missedCount > 0}
			<button type="button" class="secondary" onclick={startMissed}>Train misspellings</button>
			<p class="drill-hint">{missedCount} words you’ve missed</p>
		{/if}

		{#if slowKeyCount > 0}
			<button type="button" class="secondary" onclick={startSlowKeys}>Train slow keys</button>
			<p class="drill-hint">{slowKeyCount} keys with slower reactions</p>
		{/if}
	</div>

	<p class="hint">25 prompts · Esc to hear again · Keys mode trains letters, numbers & symbols</p>

	<section class="why" aria-labelledby="why-title">
		<h2 id="why-title">Why train this way?</h2>
		<p>
			Most typing apps show you the text and ask you to copy it. That trains your eyes to chase
			characters on screen — not the skill you use when you’re actually writing.
		</p>
		<p>
			Real typing is generative: you think a word (or hear one), then produce it on the keyboard
			without looking it up letter by letter. TypeByEar practices that loop:
		</p>
		<ul>
			<li>
				<strong>No peeking</strong> — the target isn’t on screen, so you can’t “cheat” by matching
				shapes. You have to retrieve the spelling and fire the keys.
			</li>
			<li>
				<strong>Closer to real work</strong> — dictation, notes from a call, coding from thought,
				chat replies: you type from sound or intention, not from a line of text beside the caret.
			</li>
			<li>
				<strong>Spelling under pressure</strong> — hearing a word and typing it forces orthography
				and muscle memory together, instead of letting your eyes carry the spelling for you.
			</li>
			<li>
				<strong>Attention on the keyboard feel</strong> — without visual copy to lean on, you’re
				nudged toward touch typing: listen, trust your hands, glance at feedback only when you need
				it.
			</li>
			<li>
				<strong>Honest speed</strong> — time-to-type starts after the word is spoken. The metric
				reflects how fast you produce the word, not how fast you can read and mirror it.
			</li>
		</ul>
		<p>
			Short 25-word sessions keep the focus on accuracy and recall, with history so you can see
			whether that skill is actually improving.
		</p>
	</section>

	{#if recent.length > 0}
		<section class="recent" aria-labelledby="recent-title">
			<div class="recent-head">
				<h2 id="recent-title">Recent sessions</h2>
				<a class="all" href="/results">View all results</a>
			</div>
			<ul>
				{#each recent as row (row.id)}
					<li>
						<span class="when">{formatSessionDate(row.completedAt)}</span>
						<span class="meta">
							{langLabel(row.language)} · {modeLabel(row.mode)} · {row.accuracy}% · {formatTtt(
								row.tttMs
							)}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="results-link"><a href="/results">View results</a></p>
	{/if}
</main>

<style>
	.home {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		justify-content: flex-start;
		padding: clamp(1.5rem, 5vw, 3.5rem);
		max-width: 40rem;
	}

	.brand {
		font-family: var(--font-display);
		font-size: clamp(2.75rem, 8vw, 4.5rem);
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1;
		margin: 0 0 1.25rem;
		color: var(--teal-deep);
		animation: rise 0.7s ease-out both;
	}

	h1 {
		font-family: var(--font-display);
		font-size: clamp(1.35rem, 3.5vw, 1.85rem);
		font-weight: 500;
		margin: 0 0 0.75rem;
		color: var(--ink);
		animation: rise 0.7s ease-out 0.08s both;
	}

	.lede {
		margin: 0 0 2rem;
		font-size: 1.1rem;
		line-height: 1.55;
		color: var(--ink-soft);
		max-width: 32rem;
		animation: rise 0.7s ease-out 0.16s both;
	}

	.warn {
		margin: 0 0 1.5rem;
		padding: 0.75rem 0;
		border-top: 1px solid color-mix(in srgb, var(--incorrect) 35%, transparent);
		border-bottom: 1px solid color-mix(in srgb, var(--incorrect) 35%, transparent);
		color: var(--incorrect);
		font-size: 0.95rem;
	}

	.controls {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 1.25rem;
		animation: rise 0.7s ease-out 0.24s both;
	}

	.langs {
		display: flex;
		gap: 0.5rem;
	}

	.lang {
		border: 1px solid color-mix(in srgb, var(--teal) 35%, transparent);
		background: transparent;
		color: var(--ink-soft);
		padding: 0.55rem 1rem;
		border-radius: 0.35rem;
		transition:
			background 0.2s ease,
			color 0.2s ease,
			border-color 0.2s ease;
	}

	.lang.active {
		background: var(--teal);
		border-color: var(--teal);
		color: #f4fbfa;
	}

	.start {
		border: none;
		background: var(--teal-deep);
		color: #f4fbfa;
		padding: 0.85rem 1.6rem;
		border-radius: 0.4rem;
		font-weight: 600;
		font-size: 1.05rem;
		transition:
			transform 0.15s ease,
			background 0.2s ease;
	}

	.start:hover {
		background: var(--teal);
	}

	.start:active {
		transform: translateY(1px);
	}

	.secondary {
		border: 1px solid color-mix(in srgb, var(--teal) 40%, transparent);
		background: transparent;
		color: var(--teal-deep);
		padding: 0.7rem 1.35rem;
		border-radius: 0.4rem;
		font-weight: 600;
		font-size: 0.95rem;
		transition:
			background 0.2s ease,
			border-color 0.2s ease;
	}

	.secondary:hover {
		background: color-mix(in srgb, var(--teal) 10%, transparent);
		border-color: var(--teal);
	}

	.drill-hint {
		margin: -0.35rem 0 0;
		font-size: 0.85rem;
		color: var(--ink-soft);
		opacity: 0.9;
	}

	.hint {
		margin: 2.5rem 0 0;
		font-size: 0.9rem;
		color: var(--ink-soft);
		opacity: 0.85;
		animation: rise 0.7s ease-out 0.32s both;
	}

	.why {
		margin-top: 2.75rem;
		padding-top: 1.5rem;
		border-top: 1px solid color-mix(in srgb, var(--ink-soft) 25%, transparent);
		animation: rise 0.7s ease-out 0.4s both;
	}

	.why h2 {
		margin: 0 0 0.85rem;
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 500;
		color: var(--ink);
	}

	.why p {
		margin: 0 0 0.85rem;
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--ink-soft);
	}

	.why ul {
		margin: 0 0 0.85rem;
		padding: 0 0 0 1.15rem;
		display: grid;
		gap: 0.55rem;
	}

	.why li {
		font-size: 0.95rem;
		line-height: 1.55;
		color: var(--ink-soft);
	}

	.why li strong {
		color: var(--ink);
		font-weight: 600;
	}

	.why p:last-child {
		margin-bottom: 0;
	}

	.recent {
		margin-top: 2.75rem;
		padding-top: 1.5rem;
		border-top: 1px solid color-mix(in srgb, var(--ink-soft) 25%, transparent);
		animation: rise 0.7s ease-out 0.48s both;
	}

	.recent h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.1rem;
		font-weight: 500;
		color: var(--ink);
	}

	.recent-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.85rem;
	}

	.all,
	.results-link a {
		font-size: 0.95rem;
		color: var(--teal-deep);
	}

	.results-link {
		margin: 2.5rem 0 0;
		animation: rise 0.7s ease-out 0.48s both;
	}

	.recent ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.65rem;
	}

	.recent li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.35rem 1rem;
		font-size: 0.95rem;
	}

	.when {
		color: var(--ink-soft);
	}

	.meta {
		font-variant-numeric: tabular-nums;
		color: var(--teal-deep);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.6rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
