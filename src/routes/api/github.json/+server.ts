import { SITE_DATA } from '$lib/constants.js';

let cachedData: any[] | null = null;
let lastFetchTime = 0;

export async function GET() {
  const now = Date.now();
  const refreshInterval = 60 * 60 * 1000; // 60 minutes

  if (!cachedData || now - lastFetchTime > refreshInterval) {
    const githubProfileUrl = `https://api.github.com/users/${SITE_DATA.githubUsername}/repos?type=owner&sort=updated&per_page=5&page=1`;
    const response = await fetch(githubProfileUrl);
    if (response.ok) {
      cachedData = await response.json();
      lastFetchTime = now;
    } else {
      cachedData = []; // fallback
    }
  }

  return new Response(JSON.stringify(cachedData), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=3600', // browsers can cache for 3600 seconds
    },
  });
}
