import { BLOG_POSTS } from '$lib/blog';
import { SITE_DATA } from '$lib/constants';

export const prerender = true;

const pages = [
  { path: '', changefreq: 'monthly', priority: '1.0' },
  { path: 'blog', changefreq: 'monthly', priority: '0.8' },
  { path: 'about', changefreq: 'yearly', priority: '0.4' },
  ...BLOG_POSTS.map((post) => ({
    path: `blog/${post.slug}`,
    changefreq: 'yearly',
    priority: '0.7',
    lastmod: post.dateModified,
  })),
];

export function GET() {
  const entries = pages
    .map((page) => {
      const location = new URL(page.path, SITE_DATA.siteUrl).href;
      const lastModified = 'lastmod' in page ? `\n    <lastmod>${page.lastmod}</lastmod>` : '';
      return `  <url>\n    <loc>${location}</loc>${lastModified}\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>`;
    })
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
}
