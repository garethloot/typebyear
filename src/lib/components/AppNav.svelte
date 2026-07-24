<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import BrandLockup from '$lib/components/BrandLockup.svelte';

	type Props = {
		/** Optional brand click handler (e.g. reset practice session). */
		onBrandClick?: () => void;
		/** Whether to render the brand lockup. Defaults to true. */
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
		<BrandLockup onclick={onBrandClick} />
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
		<a
			class="link"
			href="https://github.com/garethloot/typebyear"
			target="_blank"
			rel="noopener noreferrer"
		>
			GitHub
		</a>
		<a class="link" href="https://x.com/garethloot" target="_blank" rel="noopener noreferrer">
			X
		</a>
	</div>
</nav>

<style>
	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 1.75rem;
		width: 100%;
		min-width: 0;
	}

	.nav-links-only {
		justify-content: flex-end;
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
		.links {
			gap: 0.65rem;
		}

		.link {
			font-size: 0.85rem;
		}
	}
</style>
