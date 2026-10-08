<script lang="ts">
  import { SITE_DATA } from '$lib/constants';

  // A 1200 x 630 JPEG card from static/og/ (rendered from the site itself),
  // with the tags link previews read: Open Graph and the large Twitter card.
  // Raster on purpose: Telegram, LinkedIn, Facebook and X ignore SVG here.
  const { src, alt }: { src: string; alt: string } = $props();
  const url = $derived(new URL(src, SITE_DATA.siteUrl).href);
</script>

<svelte:head>
  <meta property="og:image" content={url} />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={alt} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content={url} />
  <meta name="twitter:image:alt" content={alt} />
</svelte:head>
