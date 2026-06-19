<script lang="ts">
  import { tick } from 'svelte';
  import type { Component, ComponentProps } from 'svelte';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';

  import { SITE_DATA } from '$lib/constants';
  import Footer from '$lib/components/Footer.svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import type ThrelteAppType from '$lib/components/three/ThrelteApp.svelte';
  import '../global.css';

  injectAnalytics({ debug: false });

  const headerLinks = SITE_DATA.headerLinks;
  const { children, data } = $props();
  let ThrelteApp = $state<Component<ComponentProps<typeof ThrelteAppType>>>();
  let tabsElement = $state<HTMLElement>();
  let linkElements = $state<(HTMLAnchorElement | undefined)[]>([]);
  let activeIndicator = $state({ left: 0, width: 0, visible: false });

  const activeLinkIndex = $derived.by(() => {
    const pathname = normalizePathname(page.url.pathname);
    return headerLinks.findIndex(({ href }) => isHeaderLinkActive(href, pathname));
  });

  const activeIndicatorStyle = $derived(
    `transform: translateX(${activeIndicator.left}px); width: ${activeIndicator.width}px; opacity: ${
      activeIndicator.visible ? 1 : 0
    };`,
  );

  function normalizePathname(pathname: string) {
    return pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  }

  function isHeaderLinkActive(href: string, pathname: string) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function updateActiveIndicator() {
    const activeLink = linkElements[activeLinkIndex];
    if (!tabsElement || !activeLink) {
      activeIndicator = { left: 0, width: 0, visible: false };
      return;
    }

    const tabsRect = tabsElement.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();
    activeIndicator = {
      left: linkRect.left - tabsRect.left,
      width: linkRect.width,
      visible: true,
    };
  }

  function updateScrollbarState() {
    const root = document.documentElement;
    const hasScrollbar = root.scrollHeight > root.clientHeight;
    root.classList.toggle('has-scrollbar', hasScrollbar);
  }

  function updateViewportState() {
    updateActiveIndicator();
    updateScrollbarState();
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

  $effect(() => {
    activeLinkIndex;
    page.url.pathname;
    tick().then(updateViewportState);
  });

  $effect(() => {
    if (!tabsElement) return;

    const resizeObserver = new ResizeObserver(updateViewportState);
    resizeObserver.observe(tabsElement);
    resizeObserver.observe(document.body);

    return () => resizeObserver.disconnect();
  });
</script>

<svelte:window onresize={updateViewportState} />

<svelte:head>
  <title>CV | {SITE_DATA.siteTitle}</title>
  <meta name="description" content="Eugene Draitsev CV" />
  <meta name="keywords" content={SITE_DATA.keyWords?.join(', ')} />
</svelte:head>

<nav
  class="fixed theme-grayscale top-0 w-full z-10 bg-linear-to-br from-background/30 to-indigo-900/20 backdrop-blur-[1px]"
>
  <div class="text-identifier max-w-325 mx-auto px-6 flex items-center justify-between py-1">
    <div bind:this={tabsElement} class="nav-tabs relative flex gap-4 pb-1">
      {#each headerLinks as { label, href }, index (href)}
        <a
          bind:this={linkElements[index]}
          href={resolve(href)}
          class="relative z-1 text-identifier hover:text-identifier/90 transition-colors duration-200"
          aria-current={isHeaderLinkActive(href, normalizePathname(page.url.pathname))
            ? 'page'
            : undefined}
        >
          {label}
        </a>
      {/each}
      <span class="nav-active-indicator" style={activeIndicatorStyle}></span>
    </div>

    <ThemeSwitcher />
  </div>
</nav>

{#if ThrelteApp}
  <ThrelteApp interactiveAnimation={data.interactiveAnimation} />
{:else}
  <div class="min-h-135 w-full"></div>
{/if}

{@render children?.()}

<Footer />
