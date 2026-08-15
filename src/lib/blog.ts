export const BLOG_POSTS = [
  {
    slug: 'telegram-bot-app',
    title: 'Telegram agent architecture: from commands to asynchronous workers',
    label: 'Personal build · since 2015',
    datePublished: '2026-06-19',
    dateModified: '2026-07-30',
    image: '/blog/telegram-bot/architecture-light.svg',
    imageAlt: 'Architecture diagram for the Telegram agent and its asynchronous workers',
    imageMode: 'contain',
    description:
      'Ten years of the same bot: how a currency-command script grew Lambda ingress, async workers, reply gating, tools, scoped memory and provider failover — without ever leaving its group chats.',
    tags: ['Agents', 'AWS Lambda', 'Tools', 'Memory', 'Metrics'],
  },
  {
    slug: 'gamedevjs-2026',
    title: 'Orb Knight: a 3D browser roguelite in 13 days',
    label: 'Game jam · built with AI agents',
    datePublished: '2026-06-19',
    dateModified: '2026-07-30',
    image: '/blog/gamedevjs-2026/orb-knight-splash.webp',
    imageAlt: 'Orb Knight facing a mechanical castle on the game title screen',
    imageMode: 'cover',
    description:
      'A machine knight with a sword, a gun and a chargeable laser — 6th in Gameplay of 495 jam entries. Build log, honest scores and live WebGL scenes from the actual game, embedded in the post.',
    tags: ['Codex', 'Claude Code', 'SvelteKit', 'Three.js', 'Rapier'],
  },
  {
    slug: 'mowfleet-dashboard',
    title: 'MowFleet Control Center: operating an autonomous mower fleet',
    label: 'Hobby-freelance project',
    datePublished: '2026-06-20',
    dateModified: '2026-07-30',
    image: '/blog/mowfleet-dashboard/architecture-light.svg',
    imageAlt: 'Architecture diagram for the MowFleet operations dashboard and AWS services',
    imageMode: 'contain',
    description:
      'The dashboard that answers "did the robots actually mow my lawn?" — a Next.js app and serverless AWS pipeline turning Husqvarna telemetry into coverage, utilization, errors and reports.',
    tags: ['Next.js', 'Serverless', 'AWS Lambda', 'DynamoDB', 'Fleet data'],
  },
] as const;

export type BlogPost = (typeof BLOG_POSTS)[number];

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
