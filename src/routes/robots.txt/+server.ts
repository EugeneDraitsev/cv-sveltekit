import { SITE_DATA } from '$lib/constants';

export const prerender = true;

export function GET() {
  const sitemapUrl = new URL('sitemap.xml', SITE_DATA.siteUrl).href;
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
