import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, setHeaders }) => {
  // cache the server data for the page for 1 hour
  setHeaders({
    'Cache-Control': 'max-age=3600',
  });

  // Construct the absolute URL by combining the origin and the relative path
  const absoluteUrl = new URL('/lighthouse-report.data', url.origin).href;
  const response = await fetch(absoluteUrl);
  const lighthouseData = await response.text();

  // Return data to the +page.svelte file
  return { lighthouseData };
};
