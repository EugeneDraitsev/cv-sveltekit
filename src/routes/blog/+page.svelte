<script lang="ts">
  import { resolve } from '$app/paths';

  const posts = [
    {
      title: 'Telegram agent architecture: from commands to asynchronous workers',
      href: '/blog/telegram-bot-app',
      label: 'Personal build · since 2015',
      image: '/blog/telegram-bot/architecture-light.svg',
      imageMode: 'contain',
      description:
        'Ten years of the same bot: how a currency-command script grew Lambda ingress, async workers, reply gating, tools, scoped memory and provider failover — without ever leaving its group chats.',
      tags: ['Agents', 'AWS Lambda', 'Tools', 'Memory', 'Metrics'],
    },
    {
      title: 'Orb Knight: a 3D browser roguelite in 13 days',
      href: '/blog/gamedevjs-2026',
      label: 'Game jam · built with AI agents',
      image: '/blog/gamedevjs-2026/orb-knight-splash.webp',
      imageMode: 'cover',
      description:
        'A machine knight with a sword, a gun and a chargeable laser — 6th in Gameplay of 495 jam entries. Build log, honest scores and live WebGL scenes from the actual game, embedded in the post.',
      tags: ['Codex', 'Claude Code', 'SvelteKit', 'Three.js', 'Rapier'],
    },
    {
      title: 'MowFleet Control Center: operating an autonomous mower fleet',
      href: '/blog/mowfleet-dashboard',
      label: 'Hobby-freelance project',
      image: '/blog/mowfleet-dashboard/architecture-light.svg',
      imageMode: 'contain',
      description:
        'The dashboard that answers "did the robots actually mow my lawn?" — a Next.js app and serverless AWS pipeline turning Husqvarna telemetry into coverage, utilization, errors and reports.',
      tags: ['Next.js', 'Serverless', 'AWS Lambda', 'DynamoDB', 'Fleet data'],
    },
  ] as const;
</script>

<svelte:head>
  <title>Blog | Eugene Draitsev</title>
  <meta
    name="description"
    content="Build notes by Eugene Draitsev: a decade-old Telegram agent, a robot mower fleet dashboard, and a 3D browser game built in 13 days with AI coding agents."
  />
</svelte:head>

<main class="overlapped blog-page">
  <div class="relative mx-auto mt-[-72px] max-w-4xl px-3 pb-10 sm:px-4">
    <div class="card">
      <div class="mb-8">
        <p class="mb-3 text-xs uppercase text-keyword sm:text-sm">Build notes · real systems</p>
        <h1 class="blog-title">Things I run, break and occasionally ship</h1>
        <p class="blog-lead">
          Write-ups from systems I actually operate: a Telegram agent that has lived in the same
          group chats since 2015, an operations dashboard for robot mower fleets, and a 3D game
          built in 13 days with coding agents. Real constraints, honest numbers, and the odd WebGL
          scene you can poke at.
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
