<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { pwaInfo } from 'virtual:pwa-info';
	import '../app.css';

	let { children } = $props();

	onMount(() => {
		if (!pwaInfo) return;
		void import('virtual:pwa-register').then(({ registerSW }) => {
			registerSW({ immediate: true });
		});
	});
</script>

<svelte:head>
	<title>TypeByEar</title>
	<meta
		name="description"
		content="Audio-first touch typing — hear the word, type it from memory."
	/>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
