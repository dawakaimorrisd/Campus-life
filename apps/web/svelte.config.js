import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Pure browser app: the realtime game lives on the separate game server.
    adapter: adapter({ pages: 'build', assets: 'build', fallback: 'index.html', strict: false }),
    // One .env at the repo root serves both the web app and the game server.
    env: { dir: '../..' }
  }
};
