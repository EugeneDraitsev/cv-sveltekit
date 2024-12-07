<script lang="ts">
  export let rating = 0;
</script>

<div class="relative flex text-[20px]">
  <span class="text-identifier/15">★★★★★</span>

  <span
    class="text-identifier absolute top-0 left-0 overflow-hidden"
    style="width: {(17 * rating) / 2 - 1}px;"
  >
    {#each Array(Math.round(rating / 2)) as _, i}
      ★
    {/each}
  </span>
</div>
