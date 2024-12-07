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

<!-- TODO: Use bg-base-300/50 -->
<nav class="fixed top-0 w-full">
  <div
    class="text-2xl text-identifier max-w-[1300px] mx-auto py-4 px-6 flex justify-end"
  >
    {#if theme === 'light'}
      <button class="cursor-pointer h-6" onclick={() => setNewTheme('dark')}>
        <Icon icon="mdi:weather-night" />
      </button>
    {:else if theme === 'dark'}
      <button class="cursor-pointer h-6" onclick={() => setNewTheme('light')}>
        <Icon icon="mdi:weather-sunny" />
      </button>
    {:else}
      <div class="h-6"></div>
    {/if}
  </div>
</nav>
