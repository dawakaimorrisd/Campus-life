import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  envDir: '../..', // the single root .env also feeds VITE_* variables
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true, // Codespaces serves the app from *.app.github.dev
    fs: { allow: ['../..'] } // let Vite read packages/shared outside this app folder
  },
  ssr: { noExternal: ['@campus/shared'] },
  optimizeDeps: { include: ['phaser'] }
});
