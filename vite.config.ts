import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // The renderer runs as a module worker (see src/lib/galaxy/host.ts).
  worker: { format: 'es' },
});
