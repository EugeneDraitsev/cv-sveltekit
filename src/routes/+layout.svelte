<script lang="ts">
  import type { Component, ComponentProps } from 'svelte';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { goto } from '$app/navigation';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';
  import Icon from '@iconify/svelte';

  import { SITE_DATA } from '$lib/constants';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import type ThrelteAppType from '$lib/components/three/ThrelteApp.svelte';
  import '../global.css';

  injectAnalytics({ debug: false });

  const headerLinks = SITE_DATA.headerLinks;
  const { children, data } = $props();
  let ThrelteApp = $state<Component<ComponentProps<typeof ThrelteAppType>>>();

  // URL State Sync
  let activeScene = $derived(
    (page.url.searchParams.get('scene') as 'galaxy' | 'geometric') || 'galaxy',
  );

  function setScene(scene: 'galaxy' | 'geometric') {
    const newUrl = new URL(page.url);
    newUrl.searchParams.set('scene', scene);
    goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true });
  }

  $effect(() => {
    // Wait until the main thread is idle, then import and render 3D
    requestAnimationFrame(async () => {
      // wait 500ms to show the 3D in case of interactive animation
      if (data.interactiveAnimation) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
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
  class="fixed theme-grayscale top-0 w-full z-10 bg-linear-to-br from-background/30 to-indigo-900/20 backdrop-blur-[1px]"
>
  <div class="text-identifier max-w-325 mx-auto px-6 flex items-center justify-between py-1">
    <div class="flex gap-4">
      {#each headerLinks as { label, href } (href)}
        <a
          href={resolve(href)}
          class="text-identifier hover:text-identifier/90 transition-colors duration-200"
          class:border-b={page?.url?.pathname === href}
        >
          {label}
        </a>
      {/each}
    </div>

    <div class="flex items-center gap-4">
      <!-- Scene Switcher -->
      <div
        class="flex items-center rounded-lg border border-identifier/20 bg-background/50 p-1 backdrop-blur-md"
      >
        <button
          class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-all duration-200 {activeScene ===
          'galaxy'
            ? 'bg-identifier/20 text-identifier shadow-sm'
            : 'text-muted-foreground hover:text-identifier/70'}"
          onclick={() => setScene('galaxy')}
          aria-label="Galaxy Scene"
          title="Galaxy Scene"
        >
          <Icon icon="ph:sparkle" class="h-4 w-4" />
        </button>
        <button
          class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-all duration-200 {activeScene ===
          'geometric'
            ? 'bg-identifier/20 text-identifier shadow-sm'
            : 'text-muted-foreground hover:text-identifier/70'}"
          onclick={() => setScene('geometric')}
          aria-label="Geometric Scene"
          title="Geometric Scene"
        >
          <Icon icon="ph:cube" class="h-4 w-4" />
        </button>
      </div>

      <ThemeSwitcher />
    </div>
  </div>
</nav>

{#if ThrelteApp}
  <ThrelteApp interactiveAnimation={data.interactiveAnimation} scene={activeScene} />
{:else}
  <div class="min-h-135 w-full"></div>
{/if}

{@render children?.()}
