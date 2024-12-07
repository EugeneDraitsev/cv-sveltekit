<script lang="ts">
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

<div class="fixed top-4 right-4 text-2xl">
  {#if theme === 'light'}
    <button class=" cursor-pointer" onclick={() => setNewTheme('dark')}>
      🌚
    </button>
  {:else}
    <button class="cursor-pointer" onclick={() => setNewTheme('light')}>
      🌞
    </button>
  {/if}
</div>
