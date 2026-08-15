import { json, type RequestHandler } from '@sveltejs/kit';
import { SITE_DATA } from '$lib/constants';
import { isGitHubRepository, type GitHubRepository } from '$lib/types/github';

let cachedData: GitHubRepository[] | null = null;
let lastFetchTime = 0;
const REFRESH_INTERVAL = 60 * 60 * 1000;
const CACHE_CONTROL = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

export const GET: RequestHandler = async ({ fetch }) => {
  const now = Date.now();

  if (!cachedData || now - lastFetchTime > REFRESH_INTERVAL) {
    const githubProfileUrl = `https://api.github.com/users/${SITE_DATA.githubUsername}/repos?type=owner&sort=updated&per_page=5&page=1`;
    try {
      const response = await fetch(githubProfileUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'EugeneDraitsev-cv-sveltekit',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
      if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);

      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) throw new Error('GitHub API returned an unexpected payload');

      cachedData = payload.filter(isGitHubRepository);
      lastFetchTime = now;
    } catch (error) {
      // Keep the last known-good response on transient provider failures. A cold
      // instance falls back to an empty list without taking the CV page down.
      console.warn('Unable to refresh GitHub repositories', error);
    }
  }

  return json(cachedData ?? [], {
    headers: {
      'Cache-Control': CACHE_CONTROL,
    },
  });
};
