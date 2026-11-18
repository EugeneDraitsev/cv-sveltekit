// Renders cv/eugene-draitsev.html to static/eugene-draitsev.pdf with headless
// Chromium. Run it with `bun run cv:pdf`. Set CHROMIUM_PATH to use a browser
// other than the one Playwright installed.
import { chromium } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(here, 'eugene-draitsev.html');
const target = path.join(here, '..', 'static', 'eugene-draitsev.pdf');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(source).href);
  await page.evaluate(() => document.fonts.ready);

  // A missing font package would silently fall back to a system face.
  const fontsLoaded = await page.evaluate(() =>
    ['400 12px Lato', 'italic 400 12px Lato', '700 12px Lato'].every((font) =>
      document.fonts.check(font),
    ),
  );
  if (!fontsLoaded) throw new Error('Lato did not load: run `bun install` first.');

  // Page size, margins and the running footer all come from @page in the HTML.
  await page.pdf({ path: target, preferCSSPageSize: true, printBackground: true, tagged: true });
  console.log(`Wrote ${path.relative(process.cwd(), target)}`);
} finally {
  await browser.close();
}
