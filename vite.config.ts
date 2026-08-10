import adapter from '@sveltejs/adapter-static';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const base = (process.argv.includes('dev') ? '' : (process.env.BASE_PATH ?? '')) as
	| ''
	| `/${string}`;
const pwaBase = base ? `${base}/` : '/';

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
				base
			}
		}),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			injectRegister: null,
			manifest: {
				name: 'TypeByEar',
				short_name: 'TypeByEar',
				description: 'Audio-first touch typing — hear the word, type it from memory.',
				theme_color: '#0f4a47',
				background_color: '#e8f1f0',
				display: 'standalone',
				start_url: './',
				scope: './',
				icons: [
					{
						src: 'icons/icon-192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: 'icons/icon-512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: 'icons/icon-512-maskable.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			},
			workbox: {
				navigateFallback: pwaBase
			},
			kit: {
				base: pwaBase,
				adapterFallback: '404.html'
			},
			devOptions: {
				enabled: false
			}
		})
	]
});
