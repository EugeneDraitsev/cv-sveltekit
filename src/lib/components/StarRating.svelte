<script lang="ts">
  const { rating = 0 } = $props();
  const percentage = $derived(Math.min(100, Math.max(0, rating * 10)));
</script>

<div class="relative flex indent-0 text-[20px]">
  <span class="text-identifier/15">★★★★★</span>

  <!-- Same five stars, clipped to the score — the fractional width is what
       renders half stars, so counting glyphs would only fight it. -->
  <span class="absolute top-0 left-0 overflow-hidden text-identifier" style:width="{percentage}%"
    >★★★★★</span
  >
</div>
