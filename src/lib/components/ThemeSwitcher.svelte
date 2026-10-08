<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';

  import themeStore, { setTheme } from '$lib/stores/theme.svelte';
</script>

<div class="flex gap-4">
  <button
    class="h-8 cursor-pointer text-2xl"
    aria-label={themeStore.theme === 'light' ? 'Use dark theme' : 'Use light theme'}
    title={themeStore.theme === 'light' ? 'Use dark theme' : 'Use light theme'}
    onclick={() => setTheme(themeStore.theme === 'light' ? 'dark' : 'light')}
  >
    {#if themeStore.theme === 'light'}
      <Icon icon="mdi:weather-night" />
    {:else if themeStore.theme === 'dark'}
      <Icon icon="mdi:weather-sunny" />
    {/if}
  </button>
</div>
