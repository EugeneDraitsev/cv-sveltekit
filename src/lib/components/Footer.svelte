<script lang="ts">
  import Icon from '@iconify/svelte';

  import { SITE_DATA } from '$lib/constants';
  import FooterShader from '$lib/components/FooterShader.svelte';

  let shaderActive = $state(false);

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
    let visibilityPoll: number | undefined;
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
      document.removeEventListener('scroll', checkFooterVisibility, true);

      if (visibilityPoll) {
        window.clearInterval(visibilityPoll);
        visibilityPoll = undefined;
      }

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

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;

          activateShader();
        },
        { rootMargin: '0px', threshold: 0 },
      );

      observer.observe(node);
    }

    window.addEventListener('scroll', checkFooterVisibility, { passive: true });
    window.addEventListener('resize', checkFooterVisibility);
    document.addEventListener('scroll', checkFooterVisibility, { capture: true, passive: true });
    visibilityPoll = window.setInterval(checkFooterVisibility, 75);
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
  class="footer-galaxy theme-grayscale relative overflow-hidden border-t border-base-300"
>
  <div class="absolute inset-0 z-0">
    <FooterShader active={shaderActive} />
  </div>
  <div class="footer-galaxy-overlay pointer-events-none absolute inset-0 z-[1]"></div>

  <div
    class="pointer-events-none relative z-10 mx-auto flex max-w-325 flex-col gap-5 px-4 pt-8 sm:px-6"
  >
    <div class="w-fit max-w-full">
      <p class="text-sm uppercase text-keyword">End of file</p>
      <nav class="mt-4 flex flex-wrap gap-2" aria-label="Footer links">
        {#each links as link}
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
</footer>
