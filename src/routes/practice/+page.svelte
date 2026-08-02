<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { onMount, tick } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import AppNav from '$lib/components/AppNav.svelte';
	import BrandLockup from '$lib/components/BrandLockup.svelte';
	import KeyPicker from '$lib/components/KeyPicker.svelte';
	import ShortcutHints from '$lib/components/ShortcutHints.svelte';
	import { rankMissedWords, rankSlowKeys } from '$lib/history';
	import {
		keyPresetLabel,
		loadSavedKeySelection,
		matchKeyPreset,
		pickKeySession,
		pickSlowKeySession
	} from '$lib/keys';
	import { loadPrefs, savePrefs } from '$lib/prefs';
	import { formatTtt, session } from '$lib/session.svelte';
	import { isSpeechAvailable } from '$lib/speech';
	import {
		isPracticeMode,
		isWordListId,
		listIdForSpeechLang,
		migrateWordListId,
		pickMissedSessionWords,
		speechLangFor,
		type PracticeMode,
		type SpeechLanguage,
		type WordListId
	} from '$lib/words';

	const PEEK_HOLD_MS = 400;

	let speechOk = $state(true);
	let stageEl: HTMLElement | undefined;
	let setupMode = $state(false);
	let setupList = $state<WordListId>('english_1k');
	let selectedKeys = $state<string[]>([]);
	let peekVisible = $state(false);
	let peekTimer: ReturnType<typeof setTimeout> | null = null;

	const setupSpeechLang = $derived(speechLangFor(setupList));

	const stageRef: Attachment<HTMLElement> = (element) => {
		stageEl = element;
		return () => {
			if (stageEl === element) stageEl = undefined;
		};
	};

	function sessionCount() {
		return loadPrefs().sessionLength;
	}

	function clearPeek() {
		if (peekTimer != null) {
			clearTimeout(peekTimer);
			peekTimer = null;
		}
		peekVisible = false;
	}

	function isReplayKey(event: KeyboardEvent): boolean {
		return event.key === 'Escape' || event.code === 'Escape';
	}

	function isActivatable(target: EventTarget | null): boolean {
		if (!(target instanceof Element)) return false;
		return Boolean(target.closest('button, a, [role="button"]'));
	}

	function onKeyup(event: KeyboardEvent) {
		if (!isReplayKey(event)) return;
		clearPeek();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey && !event.altKey) {
			if (setupMode) {
				if (selectedKeys.length === 0) return;
				event.preventDefault();
				event.stopImmediatePropagation();
				startKeysFromSelection();
				return;
			}
			if (session.phase === 'done') {
				if (isActivatable(event.target)) return;
				event.preventDefault();
				event.stopImmediatePropagation();
				void again();
				return;
			}
		}

		if (setupMode || session.phase !== 'active') return;

		if (isReplayKey(event)) {
			event.preventDefault();
			event.stopImmediatePropagation();
			if (event.repeat) return;
			session.replay();
			if (peekTimer != null) clearTimeout(peekTimer);
			peekTimer = setTimeout(() => {
				peekVisible = true;
				peekTimer = null;
			}, PEEK_HOLD_MS);
			return;
		}

		if (session.isKeysMode) {
			if (
				event.key.length === 1 &&
				!event.metaKey &&
				!event.ctrlKey &&
				!event.altKey
			) {
				event.preventDefault();
				session.typeChar(event.key);
				session.submit();
			}
			return;
		}

		if (event.key === 'Backspace') {
			event.preventDefault();
			session.backspace();
			return;
		}

		if (event.key === ' ' || event.key === 'Enter') {
			event.preventDefault();
			session.submit();
			return;
		}

		if (
			event.key.length === 1 &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey
		) {
			event.preventDefault();
			session.typeChar(event.key.toLowerCase());
		}
	}

	async function focusStage() {
		await tick();
		stageEl?.focus({ preventScroll: true });
	}

	async function startMissedSession(listId: WordListId) {
		const ranked = await rankMissedWords(listId);
		const words = pickMissedSessionWords(ranked, sessionCount());
		if (words.length === 0) {
			goto(resolve('/'));
			return false;
		}
		session.start(listId, { words, mode: 'missed' });
		return true;
	}

	async function startSlowKeysSession(listId: WordListId) {
		const ranked = await rankSlowKeys(listId);
		const keys = pickSlowKeySession(ranked, sessionCount());
		if (keys.length === 0) {
			goto(resolve('/'));
			return false;
		}
		session.start(listId, { words: keys, mode: 'slow-keys' });
		return true;
	}

	function startKeysFromSelection() {
		const keys = pickKeySession(selectedKeys, sessionCount());
		if (keys.length === 0) return;
		setupMode = false;
		const keyPreset = matchKeyPreset(selectedKeys);
		session.start(setupList, {
			words: keys,
			mode: 'keys',
			selectedKeys,
			keyPreset
		});
		void focusStage();
	}

	function setSetupLanguage(lang: SpeechLanguage) {
		const next = listIdForSpeechLang(lang, setupList);
		if (next === setupList) return;
		setupList = next;
		savePrefs({ wordList: setupList });
		const url = new URL(page.url);
		url.searchParams.set('list', setupList);
		replaceState(url, {});
	}

	function resolveListParam(): WordListId | null {
		const listParam = page.url.searchParams.get('list');
		if (isWordListId(listParam)) return listParam;
		return migrateWordListId(page.url.searchParams.get('lang'));
	}

	onMount(() => {
		speechOk = isSpeechAvailable();
		let cancelled = false;

		document.addEventListener('keydown', onKeydown, true);
		document.addEventListener('keyup', onKeyup, true);

		void (async () => {
			const listId = resolveListParam();
			if (!listId) {
				goto(resolve('/'));
				return;
			}

			const modeParam = page.url.searchParams.get('mode');
			const mode: PracticeMode = isPracticeMode(modeParam) ? modeParam : 'random';

			if (mode === 'keys') {
				session.reset();
				setupList = listId;
				selectedKeys = loadSavedKeySelection() ?? [];
				setupMode = true;
				return;
			}

			if (mode === 'slow-keys') {
				const started = await startSlowKeysSession(listId);
				if (cancelled || !started) return;
			} else if (mode === 'missed') {
				const started = await startMissedSession(listId);
				if (cancelled || !started) return;
			} else {
				session.start(listId, { count: sessionCount() });
			}

			if (!cancelled) void focusStage();
		})();

		return () => {
			cancelled = true;
			document.removeEventListener('keydown', onKeydown, true);
			document.removeEventListener('keyup', onKeyup, true);
			clearPeek();
		};
	});

	async function again() {
		clearPeek();
		if (session.mode === 'missed') {
			const started = await startMissedSession(session.wordList);
			if (!started) return;
		} else if (session.mode === 'slow-keys') {
			const started = await startSlowKeysSession(session.wordList);
			if (!started) return;
		} else if (session.mode === 'keys') {
			const pool =
				session.selectedKeys.length > 0 ? session.selectedKeys : [...new Set(session.words)];
			const keys = pickKeySession(pool, sessionCount());
			if (keys.length === 0) return;
			session.start(session.wordList, {
				words: keys,
				mode: 'keys',
				selectedKeys: pool,
				keyPreset: session.keyPreset ?? matchKeyPreset(pool)
			});
		} else {
			session.start(session.wordList, { count: sessionCount() });
		}
		void focusStage();
	}

	function home() {
		clearPeek();
		session.reset();
		goto(resolve('/'));
	}

	function modeTag(mode: PracticeMode): string | null {
		if (mode === 'missed') return 'Misspellings';
		if (mode === 'keys') return 'Keys';
		if (mode === 'slow-keys') return 'Slow keys';
		return null;
	}

	function modeNote(mode: PracticeMode): string | null {
		if (mode === 'missed') return 'Misspellings drill';
		if (mode === 'keys') {
			const preset = keyPresetLabel(session.keyPreset);
			return preset ? `Keys drill · ${preset}` : 'Keys drill';
		}
		if (mode === 'slow-keys') return 'Slow keys drill';
		return null;
	}
</script>

<main class="practice">
	{#if setupMode || session.phase === 'done'}
		<AppNav onBrandClick={() => session.reset()} />
	{:else}
		<header class="top">
			<BrandLockup onclick={() => session.reset()} />
			<p class="progress" aria-live="polite">
				{#if modeTag(session.mode)}
					<span class="mode-tag">{modeTag(session.mode)}</span>
				{/if}
				{session.progress.current} / {session.progress.total}
			</p>
		</header>
	{/if}

	{#if setupMode}
		<section class="setup" aria-labelledby="setup-title">
			<h1 id="setup-title">Choose keys</h1>
			<p class="setup-lede">Select the characters to train, then start. Hear a key, type it.</p>
			<div class="control-group">
				<p class="control-label" id="setup-lang-label">Language</p>
				<div class="langs" role="group" aria-labelledby="setup-lang-label">
					<button
						type="button"
						class={['lang', setupSpeechLang === 'en' && 'active']}
						onclick={() => setSetupLanguage('en')}
						aria-pressed={setupSpeechLang === 'en'}
					>
						English
					</button>
					<button
						type="button"
						class={['lang', setupSpeechLang === 'nl' && 'active']}
						onclick={() => setSetupLanguage('nl')}
						aria-pressed={setupSpeechLang === 'nl'}
					>
						Dutch
					</button>
				</div>
			</div>
			<KeyPicker bind:selected={selectedKeys} onStart={startKeysFromSelection} />
		</section>
	{:else if session.phase === 'done' && session.summary}
		{@const s = session.summary}
		{@const keysMode = s.mode === 'keys' || s.mode === 'slow-keys'}
		<section class="summary" aria-labelledby="summary-title">
			<BrandLockup size="echo" link={false} />
			<h1 id="summary-title">Session complete</h1>
			{#if modeNote(s.mode)}
				<p class="mode-note">{modeNote(s.mode)}</p>
			{/if}
			<p class="saved" role="status">Saved on this device</p>
			<ul class="stats">
				{#if keysMode}
					<li>
						<span class="label">Reaction</span>
						<span class="value">{formatTtt(s.tttMs)}</span>
						<span class="sub">median hearing → key</span>
					</li>
					<li>
						<span class="label">Accuracy</span>
						<span class="value">{s.accuracy}%</span>
						<span class="sub">{s.correct} of {s.total} keys</span>
					</li>
				{:else}
					<li>
						<span class="label">Accuracy</span>
						<span class="value">{s.accuracy}%</span>
						<span class="sub">{s.correct} of {s.total} words</span>
					</li>
					<li>
						<span class="label">TTT</span>
						<span class="value">{formatTtt(s.tttMs)}</span>
						<span class="sub">median time to type</span>
					</li>
					<li>
						<span class="label">CPM</span>
						<span class="value">{s.cpm}</span>
						<span class="sub">median chars / min</span>
					</li>
				{/if}
			</ul>
			{#if session.completed.length > 0}
				<p class="done-words" aria-label={keysMode ? 'Keys from this session' : 'Words from this session'}>
					{#each session.completed as item, i (i + item.word)}
						<span class={['dw', item.correct ? 'ok' : 'bad']}>
							{item.word}{#if keysMode && item.tttMs != null}<span class="ttt"
									>{formatTtt(item.tttMs)}</span
								>{/if}
						</span>
					{/each}
				</p>
			{/if}
			<div class="actions">
				<button type="button" class="primary" onclick={again}>Practice again</button>
				<a class="ghost linkish" href={resolve('/results')}>Results</a>
				<button type="button" class="ghost" onclick={home}>Home</button>
			</div>
			<div class="shortcut-wrap">
				<ShortcutHints items={[{ keys: 'Enter', label: 'practice again' }]} />
			</div>
		</section>
	{:else}
		<section
			class="stage"
			{@attach stageRef}
			tabindex="-1"
			aria-label="Typing practice"
		>
			{#if !speechOk}
				<p class="warn" role="status">
					Speech unavailable — type by ear if you can, or wait for the reveal.
				</p>
			{/if}

			{#if session.completed.length > 0}
				<p
					class="history"
					aria-live="polite"
					aria-label={session.isKeysMode ? 'Revealed keys' : 'Revealed words'}
				>
					{#each session.completed as item, i (i + item.word)}
						<span class={['hw', item.correct ? 'ok' : 'bad']}>{item.word}</span>
					{/each}
				</p>
			{/if}

			{#if peekVisible}
				<p class="peek" aria-live="polite">{session.target}</p>
			{/if}

			<p class="typed" aria-live="polite">
				{#if session.input.length === 0}
					<span class="caret" aria-hidden="true"></span>
					<span class="placeholder">type what you hear</span>
				{:else}
					{#each session.charStatuses as status, i (session.index + '-' + i + '-' + session.input[i])}
						<span class={['ch', status]}>{session.input[i]}</span>
					{/each}
					<span class="caret" aria-hidden="true"></span>
				{/if}
			</p>

			<div class="bar">
				<button
					type="button"
					class="replay"
					tabindex="-1"
					onclick={() => session.replay()}
				>
					Hear again
				</button>
				{#if session.isKeysMode}
					<ShortcutHints items={[{ keys: 'Esc', label: 'hear again · hold to peek' }]} />
				{:else}
					<ShortcutHints
						items={[
							{ keys: 'Space', label: 'submit' },
							{ keys: 'Enter', label: 'submit' },
							{ keys: 'Esc', label: 'hear again · hold to peek' }
						]}
					/>
				{/if}
			</div>
		</section>
	{/if}
</main>

<style>
	.practice {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		padding: clamp(1.25rem, 4vw, 2.5rem);
		min-width: 0;
		overflow-x: clip;
	}

	.top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.progress {
		margin: 0;
		font-variant-numeric: tabular-nums;
		color: var(--ink-soft);
		font-size: 0.95rem;
		display: flex;
		align-items: baseline;
		gap: 0.55rem;
	}

	.mode-tag {
		font-size: 0.8rem;
		color: var(--teal-deep);
		opacity: 0.85;
	}

	.mode-note {
		margin: 0 0 0.35rem;
		font-size: 0.9rem;
		color: var(--teal-deep);
	}

	.setup {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.75rem;
		max-width: 42rem;
		margin: 0 auto;
		width: 100%;
		min-width: 0;
		animation: rise 0.45s ease-out;
	}

	.setup h1 {
		font-family: var(--font-display);
		font-weight: 500;
		font-size: clamp(1.35rem, 3.5vw, 1.75rem);
		margin: 0;
		color: var(--ink);
	}

	.setup-lede {
		margin: 0 0 0.5rem;
		color: var(--ink-soft);
		font-size: 1rem;
		line-height: 1.5;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0;
		margin-bottom: 0.25rem;
	}

	.control-label {
		margin: 0 0 0.4rem;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--ink-soft);
		text-transform: uppercase;
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
		font: inherit;
		cursor: pointer;
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

	.stage {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.75rem;
		text-align: center;
		outline: none;
	}

	.warn {
		margin: 0;
		max-width: 28rem;
		color: var(--incorrect);
		font-size: 0.95rem;
	}

	.history,
	.done-words {
		margin: 0;
		max-width: min(40rem, 100%);
		font-family: var(--font-mono);
		font-size: clamp(0.95rem, 2.2vw, 1.15rem);
		line-height: 1.7;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem 0.85rem;
		animation: rise 0.35s ease-out;
	}

	.hw.ok,
	.dw.ok {
		color: color-mix(in srgb, var(--ink-soft) 75%, var(--correct));
	}

	.hw.bad,
	.dw.bad {
		color: var(--incorrect);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.18em;
	}

	.dw {
		display: inline-flex;
		align-items: baseline;
		gap: 0.35rem;
	}

	.ttt {
		font-family: var(--font-body);
		font-size: 0.75rem;
		color: var(--ink-soft);
		opacity: 0.85;
	}

	.typed {
		margin: 0;
		min-height: 3.5rem;
		font-family: var(--font-mono);
		font-size: clamp(2rem, 6vw, 3.25rem);
		font-weight: 500;
		letter-spacing: 0.04em;
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: 0.05em;
	}

	.peek {
		margin: 0;
		font-family: var(--font-mono);
		font-size: clamp(1.1rem, 3vw, 1.45rem);
		font-weight: 500;
		letter-spacing: 0.04em;
		color: var(--ink-soft);
		opacity: 0.85;
	}

	.placeholder {
		font-family: var(--font-body);
		font-size: 1.1rem;
		font-weight: 400;
		letter-spacing: 0;
		color: color-mix(in srgb, var(--ink-soft) 70%, transparent);
	}

	.ch.correct {
		color: var(--correct);
	}

	.ch.incorrect {
		color: var(--incorrect);
	}

	.caret {
		display: inline-block;
		width: 0.12em;
		height: 1.05em;
		margin-left: 0.05em;
		background: var(--teal);
		animation: blink 1s steps(1) infinite;
		vertical-align: text-bottom;
	}

	.bar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
	}

	.replay {
		border: 1px solid color-mix(in srgb, var(--teal) 40%, transparent);
		background: var(--surface);
		color: var(--teal-deep);
		padding: 0.65rem 1.25rem;
		border-radius: 0.35rem;
		font-weight: 600;
		backdrop-filter: blur(6px);
		transition: background 0.2s ease;
	}

	.replay:hover {
		background: color-mix(in srgb, white 70%, var(--mist));
	}

	.summary {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		max-width: 28rem;
		margin: 0 auto;
		animation: rise 0.55s ease-out;
	}

	.summary h1 {
		font-family: var(--font-display);
		font-weight: 500;
		font-size: 1.5rem;
		margin: 0 0 0.5rem;
	}

	.saved {
		margin: 0 0 1.5rem;
		font-size: 0.9rem;
		color: var(--ink-soft);
	}

	.stats {
		list-style: none;
		margin: 0 0 1.5rem;
		padding: 0;
		display: grid;
		gap: 1.5rem;
	}

	.stats li {
		display: grid;
		grid-template-columns: 1fr auto;
		grid-template-rows: auto auto;
		column-gap: 1rem;
		align-items: baseline;
	}

	.label {
		grid-column: 1;
		color: var(--ink-soft);
		font-size: 0.95rem;
	}

	.value {
		grid-column: 2;
		grid-row: 1 / span 2;
		font-family: var(--font-display);
		font-size: 2.75rem;
		font-weight: 700;
		color: var(--teal-deep);
		line-height: 1;
	}

	.sub {
		grid-column: 1;
		font-size: 0.9rem;
		color: var(--ink-soft);
	}

	.done-words {
		margin: 0 0 2rem;
		justify-content: flex-start;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.shortcut-wrap {
		margin-top: 0.85rem;
	}

	.primary,
	.ghost {
		padding: 0.75rem 1.35rem;
		border-radius: 0.4rem;
		font-weight: 600;
	}

	.primary {
		border: none;
		background: var(--teal-deep);
		color: #f4fbfa;
	}

	.ghost {
		border: 1px solid color-mix(in srgb, var(--teal) 40%, transparent);
		background: transparent;
		color: var(--teal-deep);
	}

	a.ghost.linkish {
		display: inline-flex;
		align-items: center;
		text-decoration: none;
		padding: 0.75rem 1.35rem;
		border-radius: 0.4rem;
		font-weight: 600;
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.5rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
