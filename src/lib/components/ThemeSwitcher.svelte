<script lang="ts">
  import Icon from '@iconify/svelte';

  import themeStore, { setGrayscale, setTheme } from '$lib/stores/theme.svelte';
</script>

<div class="flex gap-4">
  <button
    class="cursor-pointer h-8 text-2xl"
    aria-label="theme-switcher"
    onclick={() => setGrayscale(!themeStore.grayscale)}
  >
    <Icon icon="ic:twotone-invert-colors" />
  </button>

  <button
    class="cursor-pointer h-8 text-2xl"
    aria-label="theme-switcher"
    onclick={() => setTheme(themeStore.theme === 'light' ? 'dark' : 'light')}
  >
    {#if themeStore.theme === 'light'}
      <Icon icon="mdi:weather-night" />
    {:else if themeStore.theme === 'dark'}
      <Icon icon="mdi:weather-sunny" />
    {/if}
  </button>
</div>
