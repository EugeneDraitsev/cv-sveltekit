<script lang="ts">
	export let rating = 0; // Rating from 0 to 10 (increments of 1)
	export let max = 5; // Total number of stars (default is 5)
</script>

<div class="flex">
	{#each Array(max) as _, i}
		<span class="relative inline-block text-[20px]">
			<!-- Empty Star -->
			<span class="text-identifier/15">★</span>

			<!-- Filled Star -->
			{#if rating >= (i + 1) * 2}
				<span class="text-identifier absolute top-0 left-0">★</span>
			{:else if rating === i * 2 + 1}
				<span class="text-identifier absolute top-0 left-0 w-[50%] overflow-hidden"> ★ </span>
			{/if}
		</span>
	{/each}
</div>
