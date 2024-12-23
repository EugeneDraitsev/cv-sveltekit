<script lang="ts">
  import { onMount } from 'svelte';

  import { page } from '$app/state';

  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { SITE_DATA } from '$lib/constants';
  import '../global.css';

  const headerLinks = SITE_DATA.headerLinks;
  const { children } = $props();
  let ThrelteApp = $state<any>();

  onMount(() => {
    // Wait until the main thread is idle, then import and render 3D
    requestIdleCallback(async () => {
      const { default: App } = await import('$lib/components/three/ThrelteApp.svelte');
      // once imported, show the 3D
      ThrelteApp = App;
    });
  });
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
{#if ThrelteApp}
  <ThrelteApp />
{:else}
  <div class="min-h-[540px] w-full"></div>
{/if}
<!--{#await import('$lib/components/three/ThrelteApp.svelte')}-->
<!--  <div class="min-h-[540px] w-full"></div>-->
<!--{:then { default: LazyComponent }}-->
<!--  <LazyComponent />-->
<!--{:catch error}-->
<!--  <div class="min-h-[540px] w-full flex items-center justify-center">-->
<!--    <div class="mt-[-100px]">Can't load 3d scene in your browser</div>-->
<!--  </div>-->
<!--{/await}-->

{@render children?.()}
