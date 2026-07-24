<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	type Props = {
		/** Optional brand click handler (e.g. reset practice session). */
		onBrandClick?: () => void;
		/** Whether to render the "TypeByEar" brand link. Defaults to true. */
		showBrand?: boolean;
	};

	let { onBrandClick, showBrand = true }: Props = $props();

	const path = $derived(page.url.pathname);
	const practicePath = resolve('/practice');
	const resultsPath = resolve('/results');

	const practiceActive = $derived(path === practicePath || path.startsWith(`${practicePath}/`));
	const resultsActive = $derived(path === resultsPath || path.startsWith(`${resultsPath}/`));
</script>

<nav class={['nav', !showBrand && 'nav-links-only']} aria-label="Main">
	{#if showBrand}
		<a class="brand" href={resolve('/')} onclick={onBrandClick}>TypeByEar</a>
	{/if}
	<div class="links">
		<a
			class={['link', practiceActive && 'active']}
			href={resolve('/')}
			aria-current={practiceActive ? 'page' : undefined}
		>
			Practice
		</a>
		<a
			class={['link', resultsActive && 'active']}
			href={resolve('/results')}
			aria-current={resultsActive ? 'page' : undefined}
		>
			Results
		</a>
	</div>
</nav>

<style>
	.nav {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1.75rem;
		width: 100%;
		min-width: 0;
	}

	.nav-links-only {
		justify-content: flex-end;
	}

	.brand {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--teal-deep);
		text-decoration: none;
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.links {
		display: flex;
		flex: 0 0 auto;
		gap: 0.85rem;
	}

	.link {
		font-size: 0.9rem;
		color: var(--ink-soft);
		text-decoration: none;
		white-space: nowrap;
	}

	.link:hover {
		color: var(--teal);
	}

	.link.active {
		color: var(--teal-deep);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.22em;
	}

	@media (max-width: 30rem) {
		.brand {
			font-size: 1.15rem;
		}

		.links {
			gap: 0.65rem;
		}

		.link {
			font-size: 0.85rem;
		}
	}
</style>
