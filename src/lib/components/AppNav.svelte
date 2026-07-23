<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	type Props = {
		/** Optional brand click handler (e.g. reset practice session). */
		onBrandClick?: () => void;
	};

	let { onBrandClick }: Props = $props();

	const path = $derived(page.url.pathname);
	const homePath = resolve('/');
	const practicePath = resolve('/practice');
	const resultsPath = resolve('/results');

	const practiceActive = $derived(
		path === homePath || path === practicePath || path.startsWith(`${practicePath}/`)
	);
	const resultsActive = $derived(path === resultsPath || path.startsWith(`${resultsPath}/`));
</script>

<nav class="nav" aria-label="Main">
	<a class="brand" href={resolve('/')} onclick={onBrandClick}>TypeByEar</a>
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
		gap: 1rem;
		margin-bottom: 1.75rem;
	}

	.brand {
		font-family: var(--font-display);
		font-size: 1.35rem;
		font-weight: 700;
		color: var(--teal-deep);
		text-decoration: none;
	}

	.links {
		display: flex;
		gap: 1.1rem;
	}

	.link {
		font-size: 0.95rem;
		color: var(--ink-soft);
		text-decoration: none;
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
</style>
