import { defineConfig } from 'vite';
import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      // adapter-auto does nothing locally and picks the Vercel adapter in CI;
      // see "Deploy" in the README for why it is not adapter-vercel directly.
      adapter: adapter(),
      preprocess: vitePreprocess(),
      // Inline the (small, tree-shaken) stylesheet into the HTML head so first paint
      // doesn't wait on a separate render-blocking CSS round-trip on slow connections.
      inlineStyleThreshold: 65_536,
    }),
  ],
  // The renderer runs as a module worker (see src/lib/galaxy/host.ts).
  worker: { format: 'es' },
});
