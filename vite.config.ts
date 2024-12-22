import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), glsl({ compress: true })],
});
