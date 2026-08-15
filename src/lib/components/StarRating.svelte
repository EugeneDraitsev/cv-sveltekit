<script lang="ts">
  const { rating = 0 } = $props();
  let ref = $state<HTMLSpanElement>();
  const width = $derived(ref?.getBoundingClientRect()?.width ?? 83);
</script>

<div class="relative flex indent-0 text-[20px]" bind:this={ref}>
  <span class="text-identifier/15">★★★★★</span>

  <!-- Same five stars, clipped to the score — the fractional width is what
       renders half stars, so counting glyphs would only fight it. -->
  <span
    class="absolute top-0 left-0 overflow-hidden text-identifier"
    style="width: {(width * rating) / 10}px;">★★★★★</span
  >
</div>
