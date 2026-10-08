/**
 * Run a dynamic import that may already have failed once on this page.
 *
 * Browsers remember a failed module fetch for the life of the document, so
 * `import()` of the same URL keeps rejecting without touching the network and
 * a plain retry can never recover. When the error names the module (Chromium
 * and Firefox do), fetch it again under a fresh URL; otherwise rethrow.
 * Other chunks that import the failed one by its original URL still fail, so
 * this recovers the chunk itself, not every later importer of it.
 *
 * `name` is an export only the requested module has. The error may name a
 * dependency that failed instead; its namespace lacks `name`, and the original
 * error is rethrown rather than handing back the wrong module.
 */
export async function importAgain<T extends object>(
  load: () => Promise<T>,
  name: keyof T & string,
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    const url = /dynamically imported module:?\s+(\S+)/i.exec(
      error instanceof Error ? error.message : String(error),
    )?.[1];
    if (!url) throw error;
    const fresh = new URL(url, location.href);
    fresh.searchParams.set('retry', String(Date.now()));
    const module: object = await import(/* @vite-ignore */ fresh.href);
    if (!(name in module)) throw error;
    return module as T;
  }
}
