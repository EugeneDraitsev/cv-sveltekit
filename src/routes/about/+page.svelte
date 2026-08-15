<script lang="ts">
  import { SITE_DATA } from '$lib/constants';

  let reportVisible = $state(false);

  const canonicalUrl = new URL('about', SITE_DATA.siteUrl).href;
  const lighthouseScores = [
    { label: 'Performance', score: 100 },
    { label: 'Accessibility', score: 100 },
    { label: 'Best Practices', score: 100 },
    { label: 'SEO', score: 100 },
  ] as const;
</script>

<svelte:head>
  <title>About this site | {SITE_DATA.siteTitle}</title>
  <meta
    name="description"
    content="How Eugene Draitsev built this SvelteKit portfolio: procedural WebGL, custom shaders, progressive loading and measured performance."
  />
  <link rel="canonical" href={canonicalUrl} />
  <meta property="og:title" content={`About this site | ${SITE_DATA.siteTitle}`} />
  <meta
    property="og:description"
    content="A technical tour of a prerendered SvelteKit CV with a progressively loaded procedural galaxy."
  />
  <meta property="og:type" content="website" />
  <meta property="og:url" content={canonicalUrl} />
  <meta name="twitter:card" content="summary" />
</svelte:head>

<main id="main-content" class="overlapped blog-page" tabindex="-1">
  <article class="relative mx-auto mt-[-72px] max-w-4xl px-3 pb-10 sm:px-4">
    <div class="card">
      <header class="mb-10">
        <p class="mb-3 text-xs text-keyword uppercase sm:text-sm">Engineering notes</p>
        <h1 class="blog-title">A CV with an unnecessarily explorable galaxy</h1>
        <p class="blog-lead">
          This site has two jobs: make the experience behind my CV easy to evaluate, and show the
          kind of engineering I enjoy. The content is prerendered and usable without WebGL; the
          galaxy is a progressively loaded enhancement built with Threlte, Three.js and custom
          shaders.
        </p>
      </header>

      <section class="mb-10">
        <h2 class="subtitle">What the current iteration explores</h2>
        <div class="grid gap-4 md:grid-cols-2">
          <article class="about-card">
            <h3 class="text-lg text-constant">Procedural continuity</h3>
            <p class="mt-2 text-sm leading-6">
              Marked stars resolve to deterministic systems, planets, biomes and moons. The same
              generated data drives hover details, orbital scenes and terrain visits.
            </p>
          </article>
          <article class="about-card">
            <h3 class="text-lg text-constant">Progressive runtime cost</h3>
            <p class="mt-2 text-sm leading-6">
              CV content arrives as static HTML. Three.js, debug controls and deeper scenes are
              split into interaction-driven chunks, and particle density adapts to the device.
            </p>
          </article>
          <article class="about-card">
            <h3 class="text-lg text-constant">CPU and GPU agreement</h3>
            <p class="mt-2 text-sm leading-6">
              Terrain height and biome math have matching TypeScript and GLSL implementations so
              flight collision and flora placement follow the rendered surface.
            </p>
          </article>
          <article class="about-card">
            <h3 class="text-lg text-constant">Content as proof</h3>
            <p class="mt-2 text-sm leading-6">
              The blog now documents real systems: an agent used since 2015, a robot-mower
              operations dashboard and a game-jam build with live production scenes.
            </p>
          </article>
        </div>
      </section>

      <section class="mb-10">
        <h2 class="subtitle">Source and lineage</h2>
        <p>
          The source for this SvelteKit iteration is
          <a
            href="https://github.com/EugeneDraitsev/cv-sveltekit"
            class="text-keyword underline"
            target="_blank"
            rel="noreferrer">available on GitHub</a
          >. Earlier versions were built with
          <a
            href="https://github.com/EugeneDraitsev/cv-nextjs"
            class="text-keyword underline"
            target="_blank"
            rel="noreferrer">Next.js</a
          >
          and
          <a
            href="https://github.com/EugeneDraitsev/cv-gatsby"
            class="text-keyword underline"
            target="_blank"
            rel="noreferrer">Gatsby</a
          >.
        </p>
        <p class="mt-4">
          The original galaxy study was inspired by Bruno Simon's
          <a
            href="https://threejs-journey.com/lessons/animated-galaxy"
            class="text-keyword underline"
            target="_blank"
            rel="noreferrer">Three.js Journey lesson</a
          >. The current scene extends that starting point with navigation, generated star systems,
          planet surfaces and a free-flight mode.
        </p>
      </section>

      <section aria-labelledby="lighthouse-heading">
        <h2 id="lighthouse-heading" class="subtitle">Measured first-load performance</h2>
        <p class="mb-5 max-w-3xl">
          A production mobile Lighthouse run captured on June 19, 2026 scored 100 in all four
          categories. It is a useful regression signal for initial delivery, not a substitute for
          runtime profiling or manual accessibility testing.
        </p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {#each lighthouseScores as item (item.label)}
            <div class="rounded border border-base-300 p-4 text-center">
              <strong class="block text-3xl text-number">{item.score}</strong>
              <span class="mt-1 block text-xs text-identifier/70">{item.label}</span>
            </div>
          {/each}
        </div>

        <div class="mt-6 flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            class="rounded border border-declaration px-3 py-2 text-declaration transition-colors hover:bg-declaration/10"
            aria-expanded={reportVisible}
            aria-controls="lighthouse-report"
            onclick={() => (reportVisible = !reportVisible)}
          >
            {reportVisible ? 'Hide full report' : 'Load full report'}
          </button>
          <a
            class="rounded border border-base-300 px-3 py-2 text-constant transition-colors hover:bg-constant/10"
            href="/lighthouse-report.data"
            target="_blank"
            rel="noreferrer"
          >
            Open report separately
          </a>
        </div>

        {#if reportVisible}
          <div
            id="lighthouse-report"
            class="mt-6 h-[75dvh] min-h-120 overflow-hidden rounded border border-base-300"
          >
            <iframe
              class="h-full w-full border-none bg-gray-100"
              src="/lighthouse-report.data"
              title="Lighthouse report captured June 19, 2026"
            ></iframe>
          </div>
        {/if}
      </section>
    </div>
  </article>
</main>

<style>
  .about-card {
    border: 1px solid var(--color-base-300);
    border-radius: 8px;
    background: color-mix(in srgb, var(--color-base-100) 55%, transparent);
    padding: 1rem;
  }
</style>
