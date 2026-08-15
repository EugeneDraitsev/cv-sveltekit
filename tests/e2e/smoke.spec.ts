import { expect, test } from '@playwright/test';

test('direct pages expose useful titles and landmarks', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Eugene Draitsev | Senior Full-Stack / Platform Engineer');
  await expect(page.getByRole('heading', { level: 1, name: 'Eugene Draitsev' })).toBeVisible();
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

test('the full Lighthouse report loads only on request', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByTitle(/Lighthouse report captured/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Load full report' }).click();
  await expect(page.getByTitle(/Lighthouse report captured/i)).toBeVisible();
});

test.describe('mobile first screen', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows identity and a useful action without scrolling', async ({ page }) => {
    await page.goto('/');
    const heading = page.getByRole('heading', { level: 1, name: 'Eugene Draitsev' });
    const action = page.getByRole('link', { name: 'Download CV' });
    await expect(heading).toBeVisible();
    await expect(action).toBeVisible();

    const headingBox = await heading.boundingBox();
    expect(headingBox?.y).toBeLessThan(844);
  });
});
