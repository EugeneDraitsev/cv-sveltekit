<script lang="ts">
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import '../global.css';
</script>

<svelte:head>
  <title>CV | Eugene Draitsev</title>
  <meta name="description" content="Eugene Draitsev CV" />
</svelte:head>

<slot />
<ThemeSwitcher />
