<script lang="ts">
  const { rating = 0 } = $props();
  let ref = $state<HTMLSpanElement>();
  const width = $derived(ref?.getBoundingClientRect()?.width ?? 83);
</script>

<div class="relative flex text-[20px] indent-0" bind:this={ref}>
  <span class="text-identifier/15">★★★★★</span>

  <span
    class="text-identifier absolute top-0 left-0 overflow-hidden"
    style="width: {(width * rating) / 10}px;"
  >
    {#each Array(Math.round(rating / 2)) as _, i}
      ★
    {/each}
  </span>
</div>
