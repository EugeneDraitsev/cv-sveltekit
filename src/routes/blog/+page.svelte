<script lang="ts">
  import { resolve } from '$app/paths';
  import { BLOG_POSTS, formatPostDate } from '$lib/blog';
  import { SITE_DATA } from '$lib/constants';

  const canonicalUrl = new URL('blog', SITE_DATA.siteUrl).href;
  const socialImageUrl = new URL(BLOG_POSTS[0].image, SITE_DATA.siteUrl).href;
</script>

<svelte:head>
  <title>Blog | Eugene Draitsev</title>
  <meta
    name="description"
    content="Build notes by Eugene Draitsev: a decade-old Telegram agent, a robot mower fleet dashboard, and a 3D browser game built in 13 days with AI coding agents."
  />
  <link rel="canonical" href={canonicalUrl} />
  <meta property="og:title" content="Blog | Eugene Draitsev" />
  <meta
    property="og:description"
    content="Build notes from production agent systems, a robot-mower fleet dashboard and a 3D browser game."
  />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:image" content={socialImageUrl} />
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<main id="main-content" class="overlapped blog-page" tabindex="-1">
  <div class="relative mx-auto mt-[-72px] max-w-4xl px-3 pb-10 sm:px-4">
    <div class="card">
      <div class="mb-8">
        <p class="mb-3 text-xs text-keyword uppercase sm:text-sm">Build notes · real systems</p>
        <h1 class="blog-title">Things I run, break and occasionally ship</h1>
        <p class="blog-lead">
          Write-ups from systems I actually operate: a Telegram agent that has lived in the same
          group chats since 2015, an operations dashboard for robot mower fleets, and a 3D game
          built in 13 days with coding agents. Real constraints, honest numbers, and the odd WebGL
          scene you can poke at.
        </p>
      </div>

      <div class="grid gap-7">
        {#each BLOG_POSTS as post (post.slug)}
          <article class="grid gap-5 border-t border-base-300 pt-6 md:grid-cols-[240px_1fr]">
            <a
              href={resolve(`/blog/${post.slug}`)}
              class="block overflow-hidden rounded border border-base-300"
              aria-label={`Read ${post.title}`}
            >
              <img
                src={post.image}
                alt={post.imageAlt}
                class="aspect-[16/10] h-full w-full bg-base-100 {post.imageMode === 'contain'
                  ? 'object-contain p-2'
                  : 'object-cover'}"
                loading="lazy"
              />
            </a>
            <div>
              <div class="mb-2 flex flex-wrap gap-3 text-xs text-keyword uppercase">
                <span>{post.label}</span>
                <time datetime={post.datePublished}>{formatPostDate(post.datePublished)}</time>
              </div>
              <h2 class="blog-post-title text-constant">
                <a href={resolve(`/blog/${post.slug}`)} class="underline">{post.title}</a>
              </h2>
              <p class="mt-3">{post.description}</p>
              <div class="mt-4 flex flex-wrap gap-2">
                {#each post.tags as tag (tag)}
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
