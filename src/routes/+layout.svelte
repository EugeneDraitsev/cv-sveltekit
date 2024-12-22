<script lang="ts">
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import '../global.css';
</script>

<svelte:head>
  <title>CV | Eugene Draitsev</title>
  <meta name="description" content="Eugene Draitsev CV" />
</svelte:head>

<!-- TODO: Use bg-base-300/50 -->
<nav
  class="fixed top-0 w-full z-10 bg-gradient-to-br from-background/30 to-indigo-900/20 backdrop-blur-[1px]"
>
  <ThemeSwitcher />
</nav>
<slot />
