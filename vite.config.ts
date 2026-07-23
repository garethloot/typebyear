import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// Kit options are top-level here (not nested under `kit`) when configuring via Vite.
			adapter: adapter({
				fallback: '404.html'
			}),
			paths: {
				// GitHub Pages serves project sites from /<repo>; leave empty for local `vite dev`.
				base: (process.argv.includes('dev') ? '' : (process.env.BASE_PATH ?? '')) as
					| ''
					| `/${string}`
			}
		})
	]
});
