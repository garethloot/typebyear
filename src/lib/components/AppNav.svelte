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
		<div class="social">
			<a
				class="icon-link"
				href="https://github.com/garethloot/typebyear"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="GitHub"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					width="18"
					height="18"
					aria-hidden="true"
					focusable="false"
				>
					<path
						fill="currentColor"
						d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.23c-3.34.73-4.03-1.42-4.03-1.42-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.4s2.04.13 3 .4c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.63-5.48 5.92.43.37.81 1.1.81 2.23v3.29c0 .32.22.69.83.57C20.56 21.8 24 17.3 24 12 24 5.37 18.63 0 12 0z"
					/>
				</svg>
			</a>
			<a
				class="icon-link"
				href="https://x.com/garethloot"
				target="_blank"
				rel="noopener noreferrer"
				aria-label="X (Twitter)"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					width="18"
					height="18"
					aria-hidden="true"
					focusable="false"
				>
					<path
						fill="currentColor"
						d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
					/>
				</svg>
			</a>
		</div>
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
		align-items: center;
		flex: 0 0 auto;
		gap: 0.85rem;
	}

	.link {
		font-size: 0.9rem;
		color: var(--ink);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.22em;
		white-space: nowrap;
	}

	.link:hover {
		color: var(--teal);
	}

	.link.active {
		color: var(--teal-deep);
		text-decoration-thickness: 2px;
	}

	.social {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		margin-left: 0.25rem;
	}

	.icon-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--ink);
		text-decoration: none;
		line-height: 0;
	}

	.icon-link:hover {
		color: var(--teal);
	}

	.icon-link svg {
		width: 1.1rem;
		height: 1.1rem;
		display: block;
	}

	@media (max-width: 30rem) {
		.links {
			gap: 0.65rem;
		}

		.link {
			font-size: 0.85rem;
		}

		.social {
			gap: 0.5rem;
		}
	}
</style>
