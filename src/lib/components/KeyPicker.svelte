<script lang="ts">
	import ShortcutHints from '$lib/components/ShortcutHints.svelte';
	import { KEYBOARD_ROWS, KEY_PRESETS, saveKeySelection } from '$lib/keys';

	let {
		selected = $bindable<string[]>([]),
		onStart
	}: {
		selected?: string[];
		onStart: () => void;
	} = $props();

	let shiftLayer = $state(false);

	function applyPreset(keys: string[]) {
		selected = [...keys];
		saveKeySelection(selected);
	}

	function toggleGlyph(glyph: string) {
		if (selected.includes(glyph)) {
			selected = selected.filter((c) => c !== glyph);
		} else {
			selected = [...selected, glyph];
		}
		saveKeySelection(selected);
	}

	function isSelected(glyph: string): boolean {
		return selected.includes(glyph);
	}
</script>

<div class="picker">
	<div class="presets" role="group" aria-label="Key presets">
		{#each KEY_PRESETS as preset (preset.id)}
			<button type="button" class="preset" onclick={() => applyPreset(preset.keys)}>
				{preset.label}
			</button>
		{/each}
		<button
			type="button"
			class={['layer', shiftLayer && 'active']}
			onclick={() => (shiftLayer = !shiftLayer)}
			aria-pressed={shiftLayer}
		>
			{shiftLayer ? 'Showing shifted' : 'Shift layer'}
		</button>
	</div>

	<div class="keyboard" role="group" aria-label="Character keyboard">
		{#each KEYBOARD_ROWS as row, rowIndex (rowIndex)}
			<div class="row">
				{#each row as [unshifted, shifted] (unshifted)}
					{@const glyph = shiftLayer ? shifted : unshifted}
					<button
						type="button"
						class={['key', isSelected(glyph) && 'selected']}
						onclick={() => toggleGlyph(glyph)}
						aria-pressed={isSelected(glyph)}
					>
						{glyph}
					</button>
				{/each}
			</div>
		{/each}
	</div>

	<div class="footer">
		<p class="count" aria-live="polite">{selected.length} keys selected</p>
		<button type="button" class="start" onclick={onStart} disabled={selected.length === 0}>
			Start
		</button>
	</div>
	{#if selected.length > 0}
		<ShortcutHints items={[{ keys: 'Enter', label: 'start training' }]} />
	{/if}
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		width: 100%;
		max-width: 42rem;
		min-width: 0;
	}

	.presets {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.preset,
	.layer {
		border: 1px solid color-mix(in srgb, var(--teal) 35%, transparent);
		background: transparent;
		color: var(--ink-soft);
		padding: 0.45rem 0.85rem;
		border-radius: 0.35rem;
		font-size: 0.9rem;
		transition:
			background 0.2s ease,
			color 0.2s ease,
			border-color 0.2s ease;
	}

	.preset:hover,
	.layer:hover {
		background: color-mix(in srgb, var(--teal) 10%, transparent);
		border-color: var(--teal);
		color: var(--teal-deep);
	}

	.layer.active {
		background: var(--teal);
		border-color: var(--teal);
		color: #f4fbfa;
	}

	.keyboard {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		width: 100%;
		min-width: 0;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		padding-bottom: 0.15rem;
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.25rem;
	}

	.key {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		min-width: 1.85rem;
		height: 1.85rem;
		padding: 0 0.3rem;
		border: 1px solid color-mix(in srgb, var(--ink-soft) 40%, transparent);
		border-radius: 0.3rem;
		background: color-mix(in srgb, var(--surface) 85%, white);
		color: var(--ink);
		line-height: 1;
		transition:
			background 0.15s ease,
			color 0.15s ease,
			border-color 0.15s ease;
	}

	.key:hover {
		border-color: var(--teal);
		background: color-mix(in srgb, var(--teal) 8%, transparent);
	}

	.key.selected {
		background: var(--teal);
		border-color: var(--teal);
		color: #f4fbfa;
	}

	.footer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-top: 0.15rem;
	}

	@media (max-width: 520px) {
		.footer {
			position: sticky;
			bottom: 0;
			padding: 0.65rem 0 0.15rem;
			background: linear-gradient(
				to top,
				color-mix(in srgb, var(--paper) 92%, transparent) 60%,
				transparent
			);
			z-index: 1;
		}
	}

	.count {
		margin: 0;
		font-size: 0.9rem;
		color: var(--ink-soft);
	}

	.start {
		border: none;
		background: var(--teal-deep);
		color: #f4fbfa;
		padding: 0.7rem 1.4rem;
		border-radius: 0.4rem;
		font-weight: 600;
		font-size: 1rem;
		transition:
			transform 0.15s ease,
			background 0.2s ease,
			opacity 0.2s ease;
	}

	.start:hover:not(:disabled) {
		background: var(--teal);
	}

	.start:active:not(:disabled) {
		transform: translateY(1px);
	}

	.start:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	@media (max-width: 520px) {
		.preset,
		.layer {
			padding: 0.35rem 0.65rem;
			font-size: 0.82rem;
		}

		.key {
			min-width: 1.55rem;
			height: 1.55rem;
			font-size: 0.75rem;
			padding: 0 0.2rem;
		}

		.row {
			gap: 0.18rem;
		}

		.start {
			padding: 0.6rem 1.15rem;
			font-size: 0.95rem;
		}
	}
</style>
