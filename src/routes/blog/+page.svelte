<script lang="ts">
  import SocialImage from '$lib/components/SocialImage.svelte';
  import { resolve } from '$app/paths';
  import PostDates from '$lib/components/PostDates.svelte';
  import { BLOG_POSTS, sortPosts, type PostOrder } from '$lib/blog';
  import { SITE_DATA } from '$lib/constants';

  const canonicalUrl = new URL('blog', SITE_DATA.siteUrl).href;
  const orders: { value: PostOrder; label: string }[] = [
    { value: 'added', label: 'Added' },
    { value: 'updated', label: 'Updated' },
  ];
  let order = $state<PostOrder>('added');
  const posts = $derived(sortPosts(BLOG_POSTS, order));
</script>

<svelte:head>
  <title>Blog | Eugene Draitsev</title>
  <meta
    name="description"
    content="Build notes by Eugene Draitsev: Rainroam, a one-thumb action RPG in 3D and pixel art; Orb Knight, a 3D browser game built in 13 days with coding agents; a Telegram agent running since 2015; and a robot-mower fleet dashboard."
  />
  <link rel="canonical" href={canonicalUrl} />
  <meta property="og:title" content="Blog | Eugene Draitsev" />
  <meta
    property="og:description"
    content="Build notes on two browser games, a Telegram agent and a robot-mower fleet dashboard."
  />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonicalUrl} />
</svelte:head>

<SocialImage src="/og/blog.jpg" alt="Build notes by Eugene Draitsev" />

<main id="main-content" class="overlapped blog-page" tabindex="-1">
  <div class="relative mx-auto mt-[-72px] max-w-4xl px-3 pb-10 sm:px-4">
    <div class="card">
      <div class="mb-8">
        <p class="mb-3 text-xs text-keyword uppercase sm:text-sm">Blog</p>
        <h1 class="blog-title">Build notes</h1>
        <p class="blog-lead">
          Write-ups about things I built and still run: two browser games, a Telegram agent that has
          been in the same group chats since 2015, and a dashboard for a fleet of robot mowers. What
          was built, how, and what went wrong along the way.
        </p>
      </div>

      <div class="sort" role="group" aria-label="Sort posts">
        <span class="sort-label">Sort by</span>
        {#each orders as option (option.value)}
          <button
            type="button"
            class="sort-option"
            aria-pressed={order === option.value}
            onclick={() => (order = option.value)}
          >
            {option.label}
          </button>
        {/each}
      </div>

      <div class="grid gap-7">
        {#each posts as post (post.slug)}
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
                <PostDates added={post.datePublished} updated={post.dateModified} />
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

<style>
  .sort {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
    font-size: 0.8rem;
  }
  .sort-label {
    margin-right: 0.25rem;
    color: color-mix(in srgb, var(--color-identifier) 70%, transparent);
  }
  .sort-option {
    border: 1px solid var(--color-base-300);
    border-radius: 999px;
    padding: 0.2rem 0.75rem;
    color: var(--color-identifier);
    cursor: pointer;
    transition:
      border-color 150ms ease,
      color 150ms ease;
  }
  .sort-option:hover {
    border-color: var(--color-constant);
  }
  .sort-option[aria-pressed='true'] {
    border-color: var(--color-declaration);
    color: var(--color-declaration);
  }
  .sort-option:focus-visible {
    outline: 1px solid var(--color-declaration);
    outline-offset: 2px;
  }
</style>
