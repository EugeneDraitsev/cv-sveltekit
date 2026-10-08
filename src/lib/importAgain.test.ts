import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importAgain } from './importAgain';

type Protocol = typeof import('./galaxy/engine/protocol');

// What Chromium reports for a failed import().
const failure = (url: string) =>
  new TypeError(`Failed to fetch dynamically imported module: ${url}`);
const protocol = new URL('./galaxy/engine/protocol.ts', import.meta.url).href;
const math = new URL('./galaxy/engine/math.ts', import.meta.url).href;

describe('importAgain', () => {
  beforeEach(() => vi.stubGlobal('location', { href: 'http://localhost/' }));
  afterEach(() => vi.unstubAllGlobals());

  it('returns the first load when it works', async () => {
    const module = { DEFAULT_SETTINGS: {} } as Protocol;
    await expect(importAgain(() => Promise.resolve(module), 'DEFAULT_SETTINGS')).resolves.toBe(
      module,
    );
  });

  it('refetches the module named in the error', async () => {
    const module = await importAgain<Protocol>(
      () => Promise.reject(failure(protocol)),
      'DEFAULT_SETTINGS',
    );
    expect(module.DEFAULT_SETTINGS.exposure).toBeTypeOf('number');
  });

  it('rethrows when the error names a dependency instead', async () => {
    const error = failure(math);
    await expect(
      importAgain<Protocol>(() => Promise.reject(error), 'DEFAULT_SETTINGS'),
    ).rejects.toBe(error);
  });

  it('rethrows errors that name no module', async () => {
    const error = new TypeError('Importing a module script failed.');
    await expect(
      importAgain<Protocol>(() => Promise.reject(error), 'DEFAULT_SETTINGS'),
    ).rejects.toBe(error);
  });
});
