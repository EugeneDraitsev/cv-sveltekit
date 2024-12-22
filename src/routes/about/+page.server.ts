import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
  // Construct the absolute URL by combining the origin and the relative path
  const absoluteUrl = new URL('/lighthouse-report.html', url.origin).href;
  const response = await fetch(absoluteUrl);
  const lighthouseData = await response.text();

  // Return data to the +page.svelte file
  return { lighthouseData };
};
