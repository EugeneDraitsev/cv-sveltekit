import { browser } from '$app/environment';
import { injectSpeedInsights } from '@vercel/speed-insights/sveltekit';

// Vercel's analytics scripts are served only from Vercel deployments. In a local
// preview build they 404 and log console errors (which drag down Best Practices),
// so only enable them when we're actually running on a real (non-local) host.
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];

if (browser && !LOCAL_HOSTS.includes(location.hostname)) {
  injectSpeedInsights();
}
