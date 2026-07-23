<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children } = $props();
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
