<script lang="ts">
  import { tick } from 'svelte';
  import type { Component, ComponentProps } from 'svelte';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';
  import { browser } from '$app/environment';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';

  import { SITE_DATA } from '$lib/constants';
  import Footer from '$lib/components/Footer.svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import type ThrelteAppType from '$lib/components/three/ThrelteApp.svelte';
  import '../global.css';

  // Vercel analytics scripts only exist on real deployments — skip them locally so
  // a preview build doesn't log 404s to the console (which lowers Best Practices).
  if (browser && !['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(location.hostname)) {
    injectAnalytics({ debug: false });
  }

  const headerLinks = SITE_DATA.headerLinks;
  const { children } = $props();
  let ThrelteApp = $state<Component<ComponentProps<typeof ThrelteAppType>>>();
  let galaxyLoadStarted = false;
  let galaxyRegion = $state<HTMLElement>();
  let galaxyHeroVisible = $state(true);
  let tabsElement = $state<HTMLElement>();
  let linkElements = $state<(HTMLAnchorElement | undefined)[]>([]);
  let activeIndicator = $state({ left: 0, width: 0, visible: false });
  const hasEmbeddedGameScene = $derived(page.url.pathname.startsWith('/blog/gamedevjs-2026'));
  const galaxyAllowed = $derived(!hasEmbeddedGameScene || galaxyHeroVisible);

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
    if (!galaxyRegion || !hasEmbeddedGameScene) {
      galaxyHeroVisible = true;
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        galaxyHeroVisible = entry.isIntersecting;
      },
      { rootMargin: '160px 0px' },
    );

    observer.observe(galaxyRegion);

    return () => observer.disconnect();
  });

  $effect(() => {
    // The 3D galaxy is a heavy, decorative enhancement (Three.js parse + particle
    // generation). Loading it eagerly blocks the main thread during initial load.
    // Defer it until the visitor shows engagement. Passive readers keep the static
    // backdrop and never pay the parsing or synchronous particle-generation cost.
    let cancelled = false;

    if (!galaxyAllowed) return;

    const events = [
      'pointerdown',
      'mousemove',
      'touchstart',
      'wheel',
      'keydown',
      'scroll',
    ] as const;

    async function loadGalaxy() {
      if (galaxyLoadStarted || cancelled) return;
      galaxyLoadStarted = true;
      teardown();
      try {
        const { default: App } = await import('$lib/components/three/ThrelteApp.svelte');
        if (cancelled) {
          galaxyLoadStarted = false;
          return;
        }
        ThrelteApp = App;
      } catch (error) {
        galaxyLoadStarted = false;
        console.error('Unable to load the interactive galaxy', error);
      }
    }

    function teardown() {
      events.forEach((event) => window.removeEventListener(event, loadGalaxy));
    }

    events.forEach((event) => window.addEventListener(event, loadGalaxy, { passive: true }));

    return () => {
      cancelled = true;
      teardown();
    };
  });

  $effect(() => {
    void activeLinkIndex;
    void page.url.pathname;
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
  <meta name="description" content={SITE_DATA.siteDescription} />
  <meta property="og:site_name" content={SITE_DATA.siteTitle} />
</svelte:head>

<a
  href="#main-content"
  class="sr-only fixed top-2 left-2 z-50 rounded bg-base-100 px-3 py-2 text-identifier focus:not-sr-only"
>
  Skip to main content
</a>

<nav
  aria-label="Primary"
  class="theme-grayscale fixed top-0 z-10 w-full bg-linear-to-br from-background/30 to-indigo-900/20 backdrop-blur-[1px]"
>
  <div class="mx-auto flex max-w-325 items-center justify-between px-6 py-1 text-identifier">
    <div bind:this={tabsElement} class="nav-tabs relative flex gap-4 pb-1">
      {#each headerLinks as { label, href }, index (href)}
        <a
          bind:this={linkElements[index]}
          href={resolve(href)}
          class="relative z-1 text-identifier transition-colors duration-200 hover:text-identifier/90"
          aria-current={isHeaderLinkActive(href, normalizePathname(page.url.pathname))
            ? 'page'
            : undefined}
        >
          {label}
        </a>
      {/each}
      <span class="nav-active-indicator" style={activeIndicatorStyle} aria-hidden="true"></span>
    </div>

    <ThemeSwitcher />
  </div>
</nav>

<div bind:this={galaxyRegion}>
  {#if galaxyAllowed && ThrelteApp}
    <ThrelteApp />
  {:else}
    <div class="galaxy-placeholder theme-grayscale w-full" aria-hidden="true"></div>
  {/if}
</div>

{@render children?.()}

<Footer />
