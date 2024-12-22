<script lang="ts">
  import Icon from '@iconify/svelte';

  import theme from '$lib/components/theme.svelte';

  $effect(() => {
    theme.sync();
  });
</script>

<button
  class="cursor-pointer h-8 text-2xl"
  aria-label="theme-switcher"
  onclick={() => theme.set(theme.value === 'light' ? 'dark' : 'light')}
>
  {#if theme.value === 'light'}
    <Icon icon="mdi:weather-night" />
  {:else if theme.value === 'dark'}
    <Icon icon="mdi:weather-sunny" />
  {/if}
</button>
