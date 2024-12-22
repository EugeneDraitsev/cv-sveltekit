<script lang="ts">
  import { SITE_DATA } from '$lib/constants';

  const { data } = $props();
</script>

<svelte:head>
  <title>CV | {SITE_DATA.siteTitle}</title>
</svelte:head>

<div class="container mx-auto flex flex-col justify-center px-6">
  <div class="title text-center text-3xl leading-none">About</div>
  <p class="my-4 text-center">
    The main goal of this site is not just to share my CV but also to showcase a SvelteKit app with
    a WebGL renderer that uses custom shader materials and achieves a full Google audit pass*. In
    the future, I plan to turn it into a personal blog, but for now, it’s simply a CV.
  </p>
  <div class="my-4 text-center">
    This is the third iteration of this site, based on Sveltekit. Source code can be found
    <a
      href="https://github.com/EugeneDraitsev/cv-sveltekit"
      class="text-keyword underline"
      target="_blank"
    >
      here
    </a>

    <ul>
      <li>
        Second iteration was built with Next.js, and you can find it
        <a
          href="https://github.com/EugeneDraitsev/cv-nextjs"
          class="text-keyword underline"
          target="_blank"
        >
          here
        </a>
      </li>
      <li>
        First iteration was built with Gatsby, and you can find it
        <a
          href="https://github.com/EugeneDraitsev/cv-gatsby"
          class="text-keyword underline"
          target="_blank"
        >
          here
        </a>.
      </li>
    </ul>
  </div>

  <div class="h-[100dvh]">
    {#if data.lighthouseData}
      <iframe
        class="h-full w-full border-none bg-gray-100"
        srcDoc={data.lighthouseData}
        title="Lighthouse results"
      ></iframe>
    {/if}
  </div>

  <p class="my-2 text-center text-xs">
    *Tested in Chrome Version 131.0.6778.205 in
    <span class="text-keyword">incognito mode</span>
  </p>
</div>
