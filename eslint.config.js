import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import oxlint from 'eslint-plugin-oxlint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

import svelteConfig from './svelte.config.js';

export default defineConfig(
  {
    ignores: [
      '.svelte-kit/**',
      '.vercel/**',
      '.playwright-cli/**',
      'build/**',
      'node_modules/**',
      'output/**',
      'playwright-report/**',
      'test-results/**',
      'static/lighthouse-report.data',
    ],
  },
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig,
      },
    },
    rules: {
      // Dynamic hrefs in this site are either typed external URLs or static assets;
      // internal application routes still use SvelteKit's resolve() explicitly.
      'svelte/no-navigation-without-resolve': ['error', { ignoreLinks: true }],
    },
  },
  ...oxlint.buildFromOxlintConfigFile('./.oxlintrc.json'),
);
