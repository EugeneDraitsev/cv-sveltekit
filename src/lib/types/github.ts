export interface GitHubRepository {
  name: string;
  html_url: string;
  description: string | null;
  updated_at: string;
  stargazers_count: number;
}

export function isGitHubRepository(value: unknown): value is GitHubRepository {
  if (!value || typeof value !== 'object') return false;
  const repository = value as Record<string, unknown>;
  return (
    typeof repository.name === 'string' &&
    typeof repository.html_url === 'string' &&
    (typeof repository.description === 'string' || repository.description === null) &&
    typeof repository.updated_at === 'string' &&
    typeof repository.stargazers_count === 'number'
  );
}
