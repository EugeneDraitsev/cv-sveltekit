<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Component, ComponentProps } from 'svelte';

  import { SITE_DATA } from '$lib/constants';
  import type FooterShaderType from '$lib/components/FooterShader.svelte';

  let shaderActive = $state(false);

  // Lazy-load the WebGL footer shader (and its galaxy palette) only
  // once the footer scrolls into view — keeps it out of the initial page bundle.
  let FooterShader = $state<Component<ComponentProps<typeof FooterShaderType>>>();
  $effect(() => {
    if (shaderActive && !FooterShader) {
      import('$lib/components/FooterShader.svelte').then((m) => (FooterShader = m.default));
    }
  });

  const currentYear = new Date().getFullYear();
  const links = [
    {
      label: 'GitHub',
      href: SITE_DATA.socials.github,
      icon: 'mdi:github',
      hoverClass: 'hover:border-gray-500 hover:text-gray-500',
    },
    {
      label: 'LinkedIn',
      href: SITE_DATA.socials.linkedin,
      icon: 'mdi:linkedin',
      hoverClass: 'hover:border-blue-600 hover:text-blue-600',
    },
    {
      label: 'Telegram',
      href: SITE_DATA.socials.telergam,
      icon: 'mdi:telegram',
      hoverClass: 'hover:border-blue-400 hover:text-blue-400',
    },
    {
      label: 'Email',
      href: `mailto:${SITE_DATA.socials.email}`,
      icon: 'mdi:email-outline',
      hoverClass: 'hover:border-red-600 hover:text-red-600',
    },
    {
      label: 'CV',
      href: SITE_DATA.pdf,
      icon: 'mdi:file-document-outline',
      hoverClass: 'hover:border-declaration hover:text-declaration',
    },
  ] as const;

  function activateFooterShader(node: HTMLElement) {
    let observer: IntersectionObserver | undefined;
    let firstVisibilityCheck: number | undefined;
    let activated = false;

    function isFooterVisible() {
      const rect = node.getBoundingClientRect();
      return rect.top < window.innerHeight && rect.bottom > 0;
    }

    function cleanup() {
      observer?.disconnect();
      window.removeEventListener('scroll', checkFooterVisibility);
      window.removeEventListener('resize', checkFooterVisibility);

      if (firstVisibilityCheck) {
        window.clearTimeout(firstVisibilityCheck);
        firstVisibilityCheck = undefined;
      }
    }

    function activateShader() {
      if (activated) return;

      activated = true;
      shaderActive = true;
      cleanup();
    }

    function checkFooterVisibility() {
      if (isFooterVisible()) {
        activateShader();
      }
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;

        activateShader();
      },
      { rootMargin: '0px', threshold: 0 },
    );

    observer.observe(node);

    firstVisibilityCheck = window.setTimeout(checkFooterVisibility, 0);
    checkFooterVisibility();

    return {
      destroy() {
        cleanup();
      },
    };
  }
</script>

<footer
  use:activateFooterShader
  class="footer-galaxy relative overflow-hidden border-t border-base-300"
>
  <div class="absolute inset-0 z-0">
    {#if FooterShader}
      <FooterShader active={shaderActive} />
    {/if}
  </div>
  <div class="footer-galaxy-overlay pointer-events-none absolute inset-0 z-[1]"></div>

  <!-- Phones: the label and the place on the left, the planet across from them, then a row of icon buttons. -->
  <div class="pointer-events-none relative z-10 px-4 pt-8 pb-8 sm:hidden">
    <p class="text-sm text-keyword uppercase">End of file</p>
    <p class="mt-1 text-sm text-identifier/80">Stockholm {currentYear}</p>
    <nav class="mt-7 flex gap-2" aria-label="Footer links">
      {#each links as link (link.href)}
        <a
          class={`footer-link pointer-events-auto grid size-12 place-items-center rounded border border-base-300 bg-base-100/55 text-identifier backdrop-blur-[1px] ${link.hoverClass}`}
          aria-label={link.label}
          title={link.label}
          href={link.href}
          target={link.href.startsWith('http') ? '_blank' : undefined}
          rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
        >
          {#if link.label === 'CV'}
            <span class="text-sm font-bold">CV</span>
          {:else}
            <Icon icon={link.icon} height="22" width="22" />
          {/if}
        </a>
      {/each}
    </nav>
  </div>

  <div class="hidden sm:block">
    <div class="pointer-events-none relative z-10 mx-auto flex max-w-325 flex-col gap-5 px-6 pt-8">
      <div class="w-fit max-w-full">
        <p class="text-sm text-keyword uppercase">End of file</p>
        <nav class="mt-4 flex flex-wrap gap-2" aria-label="Footer links">
          {#each links as link (link.href)}
            <a
              class={`footer-link pointer-events-auto inline-flex items-center gap-2 rounded border border-base-300 bg-base-100/55 px-3 py-2 text-sm text-identifier backdrop-blur-[1px] ${link.hoverClass}`}
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
            >
              <Icon icon={link.icon} height="18" width="18" />
              {link.label}
            </a>
          {/each}
        </nav>
      </div>
    </div>

    <p class="pointer-events-none relative z-10 mt-3 pb-8 text-center text-sm text-identifier/80">
      Stockholm {currentYear}
    </p>
  </div>
</footer>
