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
  import type GalaxyHeroType from '$lib/galaxy/ui/GalaxyHero.svelte';
  import '../global.css';

  // Vercel analytics scripts only exist on real deployments — skip them locally so
  // a preview build doesn't log 404s to the console (which lowers Best Practices).
  if (browser && !['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(location.hostname)) {
    injectAnalytics({ debug: false });
  }

  const headerLinks = SITE_DATA.headerLinks;
  const { children } = $props();
  let GalaxyHero = $state<Component<ComponentProps<typeof GalaxyHeroType>>>();
  let galaxyLoadStarted = false;
  let galaxyAttempts = 0;
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

  /** Run when the main thread is idle (or soon, where idle callbacks are missing). */
  function whenIdle(callback: () => void): number {
    return typeof requestIdleCallback === 'function'
      ? requestIdleCallback(callback, { timeout: 1200 })
      : (setTimeout(callback, 200) as unknown as number);
  }

  async function loadGalaxy() {
    if (galaxyLoadStarted || !galaxyAllowed) return;
    galaxyLoadStarted = true;
    try {
      const { default: Hero } = await import('$lib/galaxy/ui/GalaxyHero.svelte');
      GalaxyHero = Hero;
    } catch (error) {
      galaxyLoadStarted = false;
      console.error('Unable to load the interactive galaxy', error);
      // A dropped connection or a stale chunk after a deploy: try again a bit
      // later, or as soon as the browser is back online, a few times at most.
      galaxyAttempts += 1;
      if (galaxyAttempts > 3) return;
      const retry = () => {
        window.removeEventListener('online', retry);
        clearTimeout(timer);
        void loadGalaxy();
      };
      const timer = setTimeout(retry, 2000 * 2 ** galaxyAttempts);
      window.addEventListener('online', retry);
    }
  }

  $effect(() => {
    if (!galaxyAllowed || galaxyLoadStarted) return;
    // The renderer runs on a worker thread, so it can start without waiting
    // for interaction: once the page has loaded and the main thread is idle,
    // fetch the small UI chunk; it hands the canvas to the worker.
    let cancelled = false;
    let idleHandle = 0;
    const start = () => {
      idleHandle = whenIdle(() => {
        if (!cancelled) void loadGalaxy();
      });
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', start);
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(idleHandle);
      else clearTimeout(idleHandle);
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
  class="fixed top-0 z-10 w-full bg-linear-to-br from-background/30 to-indigo-900/20 backdrop-blur-[1px]"
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
  {#if galaxyAllowed && GalaxyHero}
    <GalaxyHero />
  {:else}
    <div class="galaxy-placeholder w-full" aria-hidden="true">
      <div class="galaxy-backdrop"></div>
    </div>
  {/if}
</div>

{@render children?.()}

<Footer />
