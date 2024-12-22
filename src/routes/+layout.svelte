<script lang="ts">
  import { page } from '$app/state';

  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import '../global.css';
  import { SITE_DATA } from '$lib/constants';

  const headerLinks = SITE_DATA.headerLinks;
  const { children } = $props();
</script>

<svelte:head>
  <title>CV | Eugene Draitsev</title>
  <meta name="description" content="Eugene Draitsev CV" />
</svelte:head>

<nav
  class="fixed top-0 w-full z-10 bg-gradient-to-br from-background/30 to-indigo-900/20 backdrop-blur-[1px]"
>
  <div class="text-identifier max-w-[1300px] mx-auto px-6 flex items-center justify-between py-1">
    <div class="flex gap-4">
      {#each headerLinks as { label, href }, i}
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

{#await import('$lib/components/three/ThrelteApp.svelte')}
  <div class="min-h-[500px] w-full"></div>
{:then { default: LazyComponent }}
  <LazyComponent />
{:catch error}
  <div class="min-h-[500px] w-full flex items-center justify-center">
    <div class="mt-[-100px]">Can't load 3d scene in your browser</div>
  </div>
{/await}

{@render children?.()}
