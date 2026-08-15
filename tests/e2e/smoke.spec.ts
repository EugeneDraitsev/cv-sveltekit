import { expect, test } from '@playwright/test';

test('direct pages expose useful titles and landmarks', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Eugene Draitsev | Senior Full-Stack / Platform Engineer');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('main')).toHaveAttribute('id', 'main-content');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://eugene-draitsev.vercel.app/',
  );

  const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
  expect(JSON.parse(jsonLd ?? '{}')).toMatchObject({
    '@type': 'Person',
    name: 'Eugene Draitsev',
  });
});

test('search-engine discovery endpoints list the public routes', async ({ request }) => {
  const robots = await request.get('/robots.txt');
  await expect(robots).toBeOK();
  expect(await robots.text()).toContain('/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  await expect(sitemap).toBeOK();
  expect(await sitemap.text()).toContain('/blog/gamedevjs-2026');
});

test('the decorative galaxy stays unloaded for passive visitors', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(4_000);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('client navigation restores route-specific titles', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Blog', exact: true }).click();
  await expect(page).toHaveTitle('Blog | Eugene Draitsev');

  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page).toHaveTitle('Eugene Draitsev | Senior Full-Stack / Platform Engineer');

  await page.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page).toHaveTitle('About this site | Eugene Draitsev');
});

test('controls and blog cards have accessible names', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /monochrome|full color/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /dark theme|light theme/i })).toBeVisible();

  await page.goto('/blog');
  await expect(
    page.getByRole('link', {
      name: 'Read Telegram agent architecture: from commands to asynchronous workers',
    }),
  ).toBeVisible();
});

test('the full Lighthouse report is embedded, but deferred', async ({ page }) => {
  await page.goto('/about');
  const report = page.getByTitle(/Lighthouse report captured/i);
  await expect(report).toHaveAttribute('loading', 'lazy');

  await report.scrollIntoViewIfNeeded();
  await expect(report.contentFrame().locator('body')).toContainText('Performance');
});

test.describe('mobile first screen', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('opens on the profile, with the CV a tap away', async ({ page }) => {
    await page.goto('/');
    const heading = page.getByRole('heading', { level: 1, name: 'About me' });
    await expect(heading).toBeVisible();
    await expect(page.getByText('Eugene Draitsev').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download CV' })).toBeVisible();

    // The hero is decorative: the profile itself has to be on the first screen.
    const headingBox = await heading.boundingBox();
    expect(headingBox?.y).toBeLessThan(844);
  });
});
