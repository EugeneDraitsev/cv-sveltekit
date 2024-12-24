<script lang="ts">
  import { page } from '$app/state';

  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { SITE_DATA } from '$lib/constants';
  import '../global.css';

  const headerLinks = SITE_DATA.headerLinks;
  const { children, data } = $props();
</script>

<svelte:head>
  <title>CV | {SITE_DATA.siteTitle}</title>
  <meta name="description" content="Eugene Draitsev CV" />
  <meta name="keywords" content={SITE_DATA.keyWords?.join(', ')} />
</svelte:head>

<nav
  class="fixed theme-grayscale top-0 w-full z-10 bg-gradient-to-br from-background/30 to-indigo-900/20 backdrop-blur-[1px]"
>
  <div class="text-identifier max-w-[1300px] mx-auto px-6 flex items-center justify-between py-1">
    <div class="flex gap-4">
      {#each headerLinks as { label, href } (href)}
        <a
          {href}
          class="text-identifier hover:text-identifier/90 transition-colors duration-200"
          class:border-b={page?.url?.pathname === href}
        >
          {label}
        </a>
      {/each}
    </div>

    <ThemeSwitcher />
  </div>
</nav>

<!-- Some static fallback while 3D is not loaded yet -->
{#await import('$lib/components/three/ThrelteApp.svelte')}
  <div class="min-h-[540px] w-full"></div>
{:then { default: ThrelteApp }}
  <ThrelteApp interactiveAnimation={data.interactiveAnimation} />
{:catch error}
  <div class="min-h-[540px] w-full flex items-center justify-center">
    <div class="mt-[-100px]">Can't load 3d scene</div>
  </div>
{/await}

{@render children?.()}
