<script lang="ts">
	import { onMount } from 'svelte';
	import AppNav from '$lib/components/AppNav.svelte';
	import {
		createCustomList,
		deleteCustomList,
		loadCustomLists,
		newPromptId,
		updateCustomList,
		type CustomList,
		type CustomSpeechLanguage
	} from '$lib/customLists';

	type DraftPrompt = {
		id: string;
		spoken: string;
		typed: string;
	};

	type Draft = {
		id: string | null;
		name: string;
		speechLang: CustomSpeechLanguage;
		prompts: DraftPrompt[];
	};

	let lists = $state.raw<CustomList[]>([]);
	let draft = $state<Draft | null>(null);
	let error = $state('');

	function refresh() {
		lists = loadCustomLists();
	}

	function emptyPrompt(): DraftPrompt {
		return { id: newPromptId(), spoken: '', typed: '' };
	}

	function startCreate() {
		error = '';
		draft = {
			id: null,
			name: '',
			speechLang: 'en',
			prompts: [emptyPrompt()]
		};
	}

	function startEdit(list: CustomList) {
		error = '';
		draft = {
			id: list.id,
			name: list.name,
			speechLang: list.speechLang,
			prompts:
				list.prompts.length > 0
					? list.prompts.map((p) => ({ id: p.id, spoken: p.spoken, typed: p.typed }))
					: [emptyPrompt()]
		};
	}

	function cancelEdit() {
		draft = null;
		error = '';
	}

	function addPromptRow() {
		if (!draft) return;
		draft = { ...draft, prompts: [...draft.prompts, emptyPrompt()] };
	}

	function removePromptRow(id: string) {
		if (!draft) return;
		const next = draft.prompts.filter((p) => p.id !== id);
		draft = { ...draft, prompts: next.length > 0 ? next : [emptyPrompt()] };
	}

	function updatePromptField(id: string, field: 'spoken' | 'typed', value: string) {
		if (!draft) return;
		draft = {
			...draft,
			prompts: draft.prompts.map((p) => (p.id === id ? { ...p, [field]: value } : p))
		};
	}

	function saveDraft() {
		if (!draft) return;
		const name = draft.name.trim();
		if (!name) {
			error = 'Give the list a name.';
			return;
		}
		const prompts = draft.prompts
			.map((p) => ({
				id: p.id,
				spoken: p.spoken.trim(),
				typed: p.typed.trim()
			}))
			.filter((p) => p.typed.length > 0);

		if (prompts.length === 0) {
			error = 'Add at least one typed target.';
			return;
		}

		if (draft.id) {
			updateCustomList(draft.id, {
				name,
				speechLang: draft.speechLang,
				prompts
			});
		} else {
			createCustomList({
				name,
				speechLang: draft.speechLang,
				prompts
			});
		}

		error = '';
		draft = null;
		refresh();
	}

	function removeList(id: string) {
		if (!confirm('Delete this list? Practice history for it will keep the old name as “Deleted list”.')) {
			return;
		}
		deleteCustomList(id);
		if (draft?.id === id) draft = null;
		refresh();
	}

	onMount(() => {
		refresh();
	});
</script>

<main class="lists-page">
	<AppNav />

	<header class="head">
		<h1>Custom lists</h1>
		<p class="lede">
			Build your own practice banks. Spoken is what you hear; typed is what you must enter — useful
			for text expansions like hearing “obsidian task” and typing <code>?task</code>.
		</p>
		{#if !draft}
			<button type="button" class="primary" onclick={startCreate}>New list</button>
		{/if}
	</header>

	{#if draft}
		<section class="editor" aria-labelledby="editor-title">
			<h2 id="editor-title">{draft.id ? 'Edit list' : 'New list'}</h2>

			<div class="field">
				<label class="label" for="list-name">Name</label>
				<input
					id="list-name"
					class="input"
					type="text"
					bind:value={draft.name}
					placeholder="e.g. Text expansions"
					autocomplete="off"
				/>
			</div>

			<div class="field">
				<p class="label" id="speech-label">Speech language</p>
				<div class="langs" role="group" aria-labelledby="speech-label">
					<button
						type="button"
						class={['lang', draft.speechLang === 'en' && 'active']}
						onclick={() => {
							if (draft) draft = { ...draft, speechLang: 'en' };
						}}
						aria-pressed={draft.speechLang === 'en'}
					>
						English
					</button>
					<button
						type="button"
						class={['lang', draft.speechLang === 'nl' && 'active']}
						onclick={() => {
							if (draft) draft = { ...draft, speechLang: 'nl' };
						}}
						aria-pressed={draft.speechLang === 'nl'}
					>
						Dutch
					</button>
				</div>
			</div>

			<div class="prompts">
				<div class="prompt-head">
					<span>Spoken</span>
					<span>Typed</span>
					<span class="sr-only">Remove</span>
				</div>
				{#each draft.prompts as prompt (prompt.id)}
					<div class="prompt-row">
						<input
							class="input"
							type="text"
							value={prompt.spoken}
							oninput={(e) =>
								updatePromptField(prompt.id, 'spoken', (e.currentTarget as HTMLInputElement).value)}
							placeholder="What you hear (optional)"
							autocomplete="off"
							aria-label="Spoken"
						/>
						<input
							class="input mono"
							type="text"
							value={prompt.typed}
							oninput={(e) =>
								updatePromptField(prompt.id, 'typed', (e.currentTarget as HTMLInputElement).value)}
							placeholder="What you type"
							autocomplete="off"
							spellcheck="false"
							aria-label="Typed"
						/>
						<button
							type="button"
							class="icon-btn"
							onclick={() => removePromptRow(prompt.id)}
							aria-label="Remove prompt"
						>
							×
						</button>
					</div>
				{/each}
				<button type="button" class="secondary" onclick={addPromptRow}>Add word</button>
			</div>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<div class="actions">
				<button type="button" class="primary" onclick={saveDraft}>Save list</button>
				<button type="button" class="secondary" onclick={cancelEdit}>Cancel</button>
			</div>
		</section>
	{:else if lists.length === 0}
		<p class="empty">No custom lists yet. Create one to practice your own words and expansions.</p>
	{:else}
		<ul class="list">
			{#each lists as list (list.id)}
				<li class="card">
					<div class="card-main">
						<h2>{list.name}</h2>
						<p class="meta">
							{list.prompts.length}
							{list.prompts.length === 1 ? 'word' : 'words'} · {list.speechLang === 'nl'
								? 'Dutch'
								: 'English'}
						</p>
					</div>
					<div class="card-actions">
						<button type="button" class="secondary" onclick={() => startEdit(list)}>Edit</button>
						<button type="button" class="danger" onclick={() => removeList(list.id)}>Delete</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.lists-page {
		min-height: 100dvh;
		padding: clamp(1.5rem, 5vw, 3.5rem);
		max-width: 44rem;
		margin: 0 auto;
	}

	.head {
		margin-bottom: 2rem;
		animation: rise 0.6s ease-out both;
	}

	h1 {
		font-family: var(--font-display);
		font-size: clamp(1.5rem, 4vw, 2rem);
		font-weight: 500;
		margin: 0 0 0.65rem;
		color: var(--ink);
	}

	.lede {
		margin: 0 0 1.25rem;
		font-size: 1.05rem;
		line-height: 1.55;
		color: var(--ink-soft);
		max-width: 36rem;
	}

	.lede code {
		font-family: var(--font-mono);
		font-size: 0.92em;
		color: var(--teal-deep);
	}

	.empty {
		margin: 0;
		color: var(--ink-soft);
		font-size: 1rem;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.85rem;
		animation: rise 0.6s ease-out 0.08s both;
	}

	.card {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.85rem 1.25rem;
		padding: 1rem 0;
		border-bottom: 1px solid color-mix(in srgb, var(--ink-soft) 22%, transparent);
	}

	.card h2 {
		margin: 0 0 0.25rem;
		font-family: var(--font-display);
		font-size: 1.15rem;
		font-weight: 500;
		color: var(--ink);
	}

	.meta {
		margin: 0;
		font-size: 0.9rem;
		color: var(--ink-soft);
	}

	.card-actions {
		display: flex;
		gap: 0.5rem;
	}

	.editor {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		animation: rise 0.55s ease-out both;
	}

	.editor h2 {
		margin: 0;
		font-family: var(--font-display);
		font-size: 1.25rem;
		font-weight: 500;
	}

	.field {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
	}

	.label {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--ink-soft);
		text-transform: uppercase;
	}

	.input {
		border: 1px solid color-mix(in srgb, var(--teal) 35%, transparent);
		background: color-mix(in srgb, white 55%, transparent);
		color: var(--ink);
		padding: 0.55rem 0.75rem;
		border-radius: 0.35rem;
		font: inherit;
		width: 100%;
		max-width: 28rem;
	}

	.input.mono {
		font-family: var(--font-mono);
	}

	.input:focus-visible {
		outline: 2px solid var(--teal);
		outline-offset: 2px;
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

	.prompts {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.prompt-head {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.5rem;
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		color: var(--ink-soft);
		padding-right: 2.25rem;
	}

	.prompt-row {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 0.5rem;
		align-items: center;
	}

	.prompt-row .input {
		max-width: none;
	}

	.icon-btn {
		border: none;
		background: transparent;
		color: var(--ink-soft);
		font-size: 1.35rem;
		line-height: 1;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.35rem;
	}

	.icon-btn:hover {
		color: var(--incorrect);
		background: color-mix(in srgb, var(--incorrect) 10%, transparent);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.primary {
		border: none;
		background: var(--teal-deep);
		color: #f4fbfa;
		padding: 0.75rem 1.35rem;
		border-radius: 0.4rem;
		font-weight: 600;
		font-size: 0.95rem;
	}

	.primary:hover {
		background: var(--teal);
	}

	.secondary {
		border: 1px solid color-mix(in srgb, var(--teal) 40%, transparent);
		background: transparent;
		color: var(--teal-deep);
		padding: 0.7rem 1.2rem;
		border-radius: 0.4rem;
		font-weight: 600;
		font-size: 0.95rem;
	}

	.secondary:hover {
		background: color-mix(in srgb, var(--teal) 10%, transparent);
		border-color: var(--teal);
	}

	.danger {
		border: 1px solid color-mix(in srgb, var(--incorrect) 40%, transparent);
		background: transparent;
		color: var(--incorrect);
		padding: 0.7rem 1.2rem;
		border-radius: 0.4rem;
		font-weight: 600;
		font-size: 0.95rem;
	}

	.danger:hover {
		background: color-mix(in srgb, var(--incorrect) 10%, transparent);
	}

	.error {
		margin: 0;
		color: var(--incorrect);
		font-size: 0.95rem;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.55rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 36rem) {
		.prompt-head {
			display: none;
		}

		.prompt-row {
			grid-template-columns: 1fr auto;
			grid-template-rows: auto auto;
		}

		.prompt-row .input:first-child {
			grid-column: 1;
		}

		.prompt-row .input.mono {
			grid-column: 1;
		}

		.prompt-row .icon-btn {
			grid-column: 2;
			grid-row: 1 / span 2;
		}
	}
</style>
