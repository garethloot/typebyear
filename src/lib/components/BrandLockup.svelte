<script lang="ts">
	import { resolve } from '$app/paths';

	type Props = {
		href?: string;
		/** Visual size: nav chrome, home hero, or session summary echo. */
		size?: 'nav' | 'hero' | 'echo';
		onclick?: (event: MouseEvent) => void;
		/** When false, render as a non-link (e.g. decorative echo). */
		link?: boolean;
	};

	let { href = resolve('/'), size = 'nav', onclick, link = true }: Props = $props();
</script>

{#if link}
	<a class={['lockup', size]} {href} {onclick} aria-label="TypeByEar">
		<span class="wordmark">TypeByEar</span>
	</a>
{:else}
	<p class={['lockup', size]} aria-label="TypeByEar">
		<span class="wordmark">TypeByEar</span>
	</p>
{/if}

<style>
	.lockup {
		display: inline-flex;
		align-items: center;
		gap: 0;
		margin: 0;
		color: var(--teal-deep);
		text-decoration: none;
		min-width: 0;
		max-width: 100%;
	}

	.lockup.nav {
		flex: 1 1 auto;
	}

	.wordmark {
		font-family: var(--font-display);
		font-weight: 700;
		letter-spacing: -0.03em;
		line-height: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nav .wordmark {
		font-size: 1.35rem;
	}

	.hero {
		margin: 0 0 1.25rem;
		animation: rise 0.7s ease-out both;
	}

	.hero .wordmark {
		font-size: clamp(2.75rem, 8vw, 4.5rem);
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

	.echo {
		margin: 0 0 0.35rem;
	}

	.echo .wordmark {
		font-size: 1.5rem;
	}

	@media (max-width: 30rem) {
		.nav .wordmark {
			font-size: 1.15rem;
		}
	}
</style>
