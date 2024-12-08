<script lang="ts">
  import Icon from '@iconify/svelte';

  const LOCAL_STORAGE_KEY = 'cv-theme';
  const THEME_ATTRIBUTE = 'data-theme';

  type Theme = 'light' | 'dark';

  let theme = $state<Theme>();

  function setNewTheme(newTheme: Theme) {
    document.documentElement.removeAttribute(THEME_ATTRIBUTE);
    document.documentElement.setAttribute(THEME_ATTRIBUTE, newTheme);
    localStorage.setItem(LOCAL_STORAGE_KEY, newTheme);
    theme = newTheme;
  }

  $effect(() => {
    const savedTheme = localStorage.getItem(LOCAL_STORAGE_KEY);
    theme = savedTheme as Theme;
  });
</script>

<div class="text-2xl text-identifier max-w-[1300px] mx-auto py-4 px-6 flex justify-end">
  <button
    class="cursor-pointer h-6"
    aria-label="theme-switcher"
    onclick={() => setNewTheme(theme === 'light' ? 'dark' : 'light')}
  >
    {#if theme === 'light'}
      <Icon icon="mdi:weather-night" />
    {:else if theme === 'dark'}
      <Icon icon="mdi:weather-sunny" />
    {/if}
  </button>
</div>
