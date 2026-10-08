export const BLOG_POSTS = [
  {
    slug: 'rainroam',
    title: 'Rainroam: one action RPG, drawn by two renderers',
    label: 'RevenueCat Shipaton 2026',
    datePublished: '2026-10-08',
    dateModified: '2026-10-08',
    image: '/blog/rainroam/hero-split.webp',
    imageAlt:
      'The same evening in Bellwether, drawn in 3D on the left and in pixel art on the right',
    imageMode: 'cover',
    socialImage: '/og/rainroam.jpg',
    description:
      'A souls-lite adventure for phones, played with one thumb, that switches between soft 3D and pixel art mid-fight. Six weeks from first sketch to the web, Galaxy Store and the Mac App Store, and four of its scenes run live in the post.',
    tags: ['TypeGPU', 'WebGPU', 'Phaser', 'Capacitor', 'RevenueCat'],
  },
  {
    slug: 'telegram-bot-app',
    title: 'Telegram agent architecture: from commands to asynchronous workers',
    label: 'Personal build · since 2015',
    datePublished: '2024-03-12',
    dateModified: '2026-10-08',
    image: '/blog/telegram-bot/architecture-overview-dark.svg',
    imageAlt: 'Architecture diagram for the Telegram agent and its asynchronous workers',
    socialImage: '/og/telegram-bot-app.jpg',
    imageMode: 'contain',
    description:
      'Eleven years of the same bot: how a small image-search webhook became a routing-only ingress with FIFO queues, idempotent workers, a fail-closed authorization gate and a gated agent, in the same group chats throughout.',
    tags: ['Agents', 'AWS Lambda', 'SQS', 'Idempotency', 'Tools'],
  },
  {
    slug: 'gamedevjs-2026',
    title: 'Orb Knight: a 3D browser roguelite in 13 days',
    label: 'Game jam · built with AI agents',
    datePublished: '2026-05-12',
    dateModified: '2026-10-08',
    image: '/blog/gamedevjs-2026/orb-knight-splash.webp',
    imageAlt: 'Orb Knight facing a mechanical castle on the game title screen',
    socialImage: '/og/gamedevjs-2026.jpg',
    imageMode: 'cover',
    description:
      'A machine knight with a sword, a gun and a chargeable laser, 6th in Gameplay of 483 ranked jam entries. Build log, scores and live WebGL scenes from the game, embedded in the post.',
    tags: ['Codex', 'Claude Code', 'SvelteKit', 'Three.js', 'Rapier'],
  },
  {
    slug: 'mowfleet-dashboard',
    title: 'MowFleet Control Center: operating an autonomous mower fleet',
    label: 'Hobby-freelance project',
    datePublished: '2025-06-17',
    dateModified: '2026-10-08',
    image: '/blog/mowfleet-dashboard/architecture-dark.svg',
    imageAlt: 'Architecture diagram for the MowFleet operations dashboard and AWS services',
    socialImage: '/og/mowfleet-dashboard.jpg',
    imageMode: 'contain',
    description:
      'A dashboard that shows whether the robots mowed the site: a Next.js app and a serverless AWS pipeline turning Husqvarna fleet data into coverage, utilization, errors, live warnings and reports.',
    tags: ['Next.js', 'Serverless', 'AWS Lambda', 'DynamoDB', 'Fleet data'],
  },
] as const;

export type BlogPost = (typeof BLOG_POSTS)[number];

/** Newest first by the date a post was added, or by its last substantial update. */
export type PostOrder = 'added' | 'updated';

export function sortPosts<T extends { datePublished: string; dateModified: string }>(
  posts: readonly T[],
  order: PostOrder,
): T[] {
  const key = (post: T) => (order === 'added' ? post.datePublished : post.dateModified);
  // ISO dates compare correctly as strings; ties fall back to the added date.
  return posts.toSorted(
    (a, b) => key(b).localeCompare(key(a)) || b.datePublished.localeCompare(a.datePublished),
  );
}

export function getBlogPost(slug: BlogPost['slug']): BlogPost {
  const post = BLOG_POSTS.find((candidate) => candidate.slug === slug);
  if (!post) throw new Error(`Unknown blog post: ${slug}`);
  return post;
}

export function formatPostDate(date: string): string {
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
