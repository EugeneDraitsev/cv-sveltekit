<script lang="ts">
  import { resolve } from '$app/paths';

  const posts = [
    {
      title: 'Telegram bot: from local chat utility to agentic system',
      href: '/blog/telegram-bot-app',
      label: 'Personal build',
      image: '/blog/telegram-bot/architecture-light.svg',
      imageMode: 'contain',
      description:
        'A Telegram bot first committed in July 2015: from local chat features to async AWS workers, reply gating, tool execution, memory, metrics and live stats.',
      tags: ['Agents', 'AWS Lambda', 'Tools', 'Memory', 'Metrics'],
    },
    {
      title: 'Orb Knight: AI-assisted game jam experiment',
      href: '/blog/gamedevjs-2026',
      label: 'Game jam experiment',
      image: '/blog/gamedevjs-2026/orb-knight-splash.webp',
      imageMode: 'cover',
      description:
        'A browser 3D game built with Codex and Claude Code under hackathon constraints, finishing 12th overall and 6th in Gameplay at Gamedev.js Jam 2026.',
      tags: ['Codex', 'Claude Code', 'SvelteKit', 'Three.js', 'Rapier'],
    },
  ] as const;
</script>

<svelte:head>
  <title>Blog | Eugene Draitsev</title>
  <meta
    name="description"
    content="Personal projects by Eugene Draitsev: bots, AI agents, game development experiments and long-running hobby builds."
  />
</svelte:head>

<main class="overlapped blog-page">
  <div class="relative mx-auto mt-[-72px] max-w-4xl px-3 pb-10 sm:px-4">
    <div class="card">
      <div class="mb-8">
        <p class="mb-3 text-xs uppercase text-keyword sm:text-sm">Blog</p>
        <h1 class="blog-title">Personal projects</h1>
        <p class="blog-lead">
          Things I build outside work: long-running bots, AI experiments, WebGL sketches and game
          jam projects. The useful part is usually how they change over time: architecture,
          iteration, model behavior, feedback and trade-offs.
        </p>
      </div>

      <div class="grid gap-7">
        {#each posts as post}
          <article class="grid gap-5 border-t border-base-300 pt-6 md:grid-cols-[240px_1fr]">
            <a
              href={resolve(post.href)}
              class="block overflow-hidden rounded border border-base-300"
            >
              <img
                src={post.image}
                alt=""
                class="aspect-[16/10] h-full w-full bg-base-100 {post.imageMode === 'contain'
                  ? 'object-contain p-2'
                  : 'object-cover'}"
                loading="lazy"
              />
            </a>
            <div>
              <div class="mb-2 flex flex-wrap gap-3 text-xs uppercase text-keyword">
                <span>{post.label}</span>
              </div>
              <h2 class="blog-post-title text-constant">
                <a href={resolve(post.href)} class="underline">{post.title}</a>
              </h2>
              <p class="mt-3">{post.description}</p>
              <div class="mt-4 flex flex-wrap gap-2">
                {#each post.tags as tag}
                  <span class="rounded border border-base-300 px-2 py-1 text-xs">{tag}</span>
                {/each}
              </div>
            </div>
          </article>
        {/each}
      </div>
    </div>
  </div>
</main>
