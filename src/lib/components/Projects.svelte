<script lang="ts">
  import { resolve } from '$app/paths';
  import type { GitHubRepository } from '$lib/types/github';

  const featuredProjects = [
    {
      href: '/blog/gamedevjs-2026',
      eyebrow: 'Game jam · AI-assisted build',
      title: 'Orb Knight: shipping my first 3D game with AI agents',
      text: 'A browser 3D action game built through tight agent and playtest loops. It placed 12th overall and 6th in Gameplay at Gamedev.js Jam 2026.',
      signal: '#6 Gameplay · 37 ratings',
      tags: ['SvelteKit', 'Three.js', 'Rapier', 'Codex'],
    },
    {
      href: '/blog/telegram-bot-app',
      eyebrow: 'Long-running side project',
      title: 'The Telegram bot that grew up with the web',
      text: 'A 2015 chat utility that evolved into an asynchronous agent system with reply gating, tools, memory, fallbacks, metrics and a companion UI.',
      signal: '10+ years of real use',
      tags: ['Agents', 'AWS Lambda', 'Tools', 'Metrics'],
    },
    {
      href: '/blog/mowfleet-dashboard',
      eyebrow: 'Production B2B product',
      title: 'MowFleet Control Center',
      text: 'A from-scratch dashboard and serverless backend that turn autonomous mower telemetry into zone coverage, operational insight and reports.',
      signal: 'Full-stack ownership · Low-touch ops',
      tags: ['Next.js', 'AWS', 'DynamoDB', 'Fleet data'],
    },
  ] as const;

  const repositoryDateFormatter = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  export const loadRepositories = async (): Promise<GitHubRepository[]> => {
    const response = await fetch(resolve('/api/github.json'));
    if (response.ok) {
      return await response.json();
    }
    throw new Error("Can't fetch GitHub repositories");
  };
</script>

<div>
  <h2 class="mb-2 text-3xl font-normal text-declaration">Featured project stories</h2>
  <p class="mb-6 max-w-3xl text-sm leading-6 text-identifier/75">
    Not just the stack and a screenshot: what I owned, how each system works and which trade-offs
    survived contact with real users.
  </p>
  <div class="mb-10 grid gap-4 md:grid-cols-3">
    {#each featuredProjects as project (project.href)}
      <article class="project-card">
        <p class="mb-3 text-[11px] tracking-wide text-keyword uppercase">{project.eyebrow}</p>
        <h3 class="text-lg leading-snug text-constant">
          <a href={resolve(project.href)} class="underline">{project.title}</a>
        </h3>
        <p class="mt-3 text-sm leading-6">{project.text}</p>
        <p class="mt-4 text-xs text-number">{project.signal}</p>
        <div class="mt-4 flex flex-wrap gap-1.5">
          {#each project.tags as tag (tag)}
            <span class="project-tag">{tag}</span>
          {/each}
        </div>
      </article>
    {/each}
  </div>

  <h2 class="mb-5 text-3xl font-normal text-declaration">Latest repositories on GitHub</h2>

  {#await loadRepositories()}
    <div class="flex h-40 w-full items-center justify-center" role="status">
      <span
        class="h-10 w-10 animate-spin rounded-full border-2 border-base-300 border-t-keyword"
        aria-hidden="true"
      ></span>
      <span class="sr-only">Loading GitHub repositories</span>
    </div>
  {:then repositories}
    {#if repositories.length > 0}
      {#each repositories as repository (repository.html_url)}
        <div class="mb-3 flex items-center justify-between border-b border-gray-500 pb-3">
          <div class="flex-1">
            <a
              href={repository.html_url}
              class="cursor-pointer font-bold text-constant underline"
              target="_blank"
              rel="noreferrer"
            >
              {repository.name}
            </a>
            <p class="py-1 text-sm">{repository.description}</p>
            <p class="text-xs">
              Updated: {repositoryDateFormatter.format(new Date(repository.updated_at))}
            </p>
          </div>
          <div class="ml-1.5 flex min-w-7.5 items-center space-x-2 text-identifier">
            <p class="mb-0.75 text-lg" aria-hidden="true">★</p>
            <span class="sr-only">GitHub stars:</span>
            <div>{repository.stargazers_count}</div>
          </div>
        </div>
      {/each}
    {:else}
      <p>No repositories found</p>
    {/if}
  {:catch error}
    <p role="status">
      {error instanceof Error ? error.message : "Can't fetch GitHub repositories"}
    </p>
  {/await}
</div>

<style>
  .project-card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-base-300);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-base-100) 40%, transparent);
    padding: 1rem;
  }

  .project-tag {
    border: 1px solid var(--color-base-300);
    border-radius: 4px;
    padding: 0.2rem 0.4rem;
    font-size: 0.7rem;
  }
</style>
