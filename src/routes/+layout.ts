// Every route is static content — prerender the whole site at build time.
// This removes per-request SSR from TTFB (locally and on Vercel: pages come
// straight from the CDN), which is what LCP hangs off in Lighthouse.
export const prerender = true;
