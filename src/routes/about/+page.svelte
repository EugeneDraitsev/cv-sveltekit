<script lang="ts">
  const { data } = $props();
</script>

<div class="container mx-auto flex flex-col justify-center px-6">
  <div class="title text-center text-3xl leading-none">About</div>
  <p class="my-4 text-center">
    The main goal of this site is not just to share my CV but also to showcase a SvelteKit app
    featuring a WebGL renderer with custom shader materials that achieves perfect 100 scores across
    all Google Lighthouse* metrics. In the future, I plan to turn it into a personal blog, but for
    now, it’s simply a CV.
  </p>
  <p class="my-4 text-center">
    The galaxy header is inspired by and using shaders from the Bruno Simon's <a
      href="https://threejs-journey.com/lessons/animated-galaxy"
      class="text-keyword underline"
      target="_blank"
    >
      Three.js journey lesson
    </a>
  </p>
  <div class="my-4 text-center">
    This is the third iteration of this site, based on SvelteKit. Source code can be found
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

  <p class="mt-4 mb-6 text-center text-xs">
    *Tested in Chrome Version 131.0.6778.205 in
    <span class="text-keyword">incognito mode</span>
  </p>
</div>
