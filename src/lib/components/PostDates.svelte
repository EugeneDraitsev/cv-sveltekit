<script lang="ts">
  import { formatPostDate } from '$lib/blog';

  // When a post was added and when it last changed in substance. The second
  // date is left out until it differs from the first.
  const { added, updated }: { added: string; updated: string } = $props();
</script>

<span class="post-dates">
  <span>Added <time datetime={added}>{formatPostDate(added)}</time></span>
  {#if updated !== added}
    <span>Updated <time datetime={updated}>{formatPostDate(updated)}</time></span>
  {/if}
</span>

<style>
  .post-dates {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.25rem 0.9rem;
  }
</style>
