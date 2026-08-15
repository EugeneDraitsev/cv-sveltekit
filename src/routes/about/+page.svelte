<script lang="ts">
  import { SITE_DATA } from '$lib/constants';

  const canonicalUrl = new URL('about', SITE_DATA.siteUrl).href;
  const pageSpeedUrl =
    'https://pagespeed.web.dev/analysis/https-eugene-draitsev-vercel-app/8q328u6yb7?form_factor=mobile';
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
        <h2 class="subtitle">How the galaxy works</h2>
        <p class="mb-4">
          Every marked star is a seed. It resolves to the same star class, planets, biomes and moons
          for everyone, and the hover label, the orbital view and the surface you land on all read
          that one generated result.
        </p>
        <p>
          The part I like most is the least visible: terrain height and biome blending are
          implemented twice, once in GLSL for rendering and once in TypeScript for placing plants
          and keeping the camera above ground. They have to agree, or plants float and you fly
          through hills. Unit tests compare CPU samples against recorded values so the two cannot
          quietly drift apart.
        </p>
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
          Google's own PageSpeed Insights run against production scores 100 in all four categories
          on mobile, throttled to slow 4G on an emulated Moto G Power. It is a regression signal for
          initial delivery, not a substitute for runtime profiling or manual accessibility testing.
        </p>

        <p class="mb-8 text-sm">
          <a class="text-constant underline" href={pageSpeedUrl} target="_blank" rel="noreferrer">
            Open the live PageSpeed Insights report
          </a>
        </p>

        <h3 class="mb-4 text-xl text-constant">The full Lighthouse report</h3>
        <!-- The report is a 700 KB HTML document, so the iframe is lazy: it
             sits here in full, but the bytes only arrive once you scroll to it. -->
        <div
          id="lighthouse-report"
          class="h-[85dvh] min-h-120 overflow-hidden rounded border border-base-300"
        >
          <iframe
            class="h-full w-full border-none bg-gray-100"
            src="/lighthouse-report.html"
            title="Lighthouse report captured June 19, 2026"
            loading="lazy"
          ></iframe>
        </div>

        <p class="mt-4 text-sm">
          <a
            class="text-constant underline"
            href="/lighthouse-report.html"
            target="_blank"
            rel="noreferrer"
          >
            Open the report in its own tab
          </a>
        </p>
      </section>
    </div>
  </article>
</main>
