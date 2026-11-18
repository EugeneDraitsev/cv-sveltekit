import { inject, pageview } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

/**
 * Vercel Web Analytics and Speed Insights, started from the root layout.
 *
 * Both packages ship a `/sveltekit` entry, but as of analytics 2.0.1 and
 * speed-insights 2.1.0 it reads `$app/stores`, which SvelteKit 3 removed. The
 * import still resolves and then throws on first use, which takes the layout
 * down with it, and only on a deployed host. These are the calls those entries
 * make, with the route passed in by the layout from `$app/state` instead.
 */

// Vercel serves the scripts only from its own deployments. On a local preview
// they 404 and log console errors (which lower Best Practices), so stay off.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export interface Insights {
  /** Report a page view: once for the first page, then after every navigation. */
  pageview(route: string, path: string): void;
}

/** Inject both scripts. Returns null in a local build and outside the browser. */
export function startInsights(route: string | null): Insights | null {
  if (typeof location === 'undefined' || LOCAL_HOSTS.has(location.hostname)) return null;

  // Set by Vercel at build time when observability is routed through the project.
  const basePath: string | undefined = import.meta.env.VITE_VERCEL_OBSERVABILITY_BASEPATH;
  const config: string | undefined = import.meta.env.VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG;

  inject({ debug: false, disableAutoTrack: true, framework: 'sveltekit', basePath }, config);
  const speed = injectSpeedInsights({ route, framework: 'sveltekit', basePath }, config);

  return {
    pageview(route, path) {
      pageview({ route, path });
      speed?.setRoute(route);
    },
  };
}
