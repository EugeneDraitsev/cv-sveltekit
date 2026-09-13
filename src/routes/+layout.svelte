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
  let galaxyLoading = $state(false);
  let galaxyError = $state(false);
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

  async function loadGalaxy() {
    if (galaxyLoadStarted || !galaxyAllowed) return;
    galaxyLoadStarted = true;
    galaxyLoading = true;
    galaxyError = false;
    try {
      const { default: App } = await import('$lib/components/three/ThrelteApp.svelte');
      ThrelteApp = App;
    } catch (error) {
      galaxyLoadStarted = false;
      galaxyError = true;
      console.error('Unable to load the interactive galaxy', error);
    } finally {
      galaxyLoading = false;
    }
  }

  $effect(() => {
    if (!galaxyRegion || !galaxyAllowed) return;
    const region = galaxyRegion;
    // Desktop hover inside the hero is intent. Page scrolling, CV downloads,
    // navigation and touch scrolling shouldn't parse a 3D engine.
    const onEnter = (event: PointerEvent) => {
      if (
        !galaxyError &&
        event.pointerType === 'mouse' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      )
        void loadGalaxy();
    };
    region.addEventListener('pointerenter', onEnter);
    return () => region.removeEventListener('pointerenter', onEnter);
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
    <div class="galaxy-placeholder theme-grayscale w-full">
      <button
        class="galaxy-launch"
        onclick={() => (galaxyError ? location.reload() : loadGalaxy())}
        disabled={galaxyLoading}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
          <ellipse
            cx="12"
            cy="12"
            rx="10"
            ry="4"
            transform="rotate(-30 12 12)"
            stroke="currentColor"
            stroke-width="1.3"
          />
          <path d="m12 5 1.6 5.4L19 12l-5.4 1.6L12 19l-1.6-5.4L5 12l5.4-1.6Z" fill="currentColor" />
        </svg>
        {galaxyLoading
          ? 'Opening the galaxy…'
          : galaxyError
            ? 'Reload to try the galaxy again'
            : 'Explore the galaxy'}
      </button>
    </div>
  {/if}
</div>

{@render children?.()}

<Footer />
