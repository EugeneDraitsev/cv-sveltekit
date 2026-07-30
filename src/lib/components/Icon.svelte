<script lang="ts">
  import { ICONS } from '$lib/icons';

  type Props = {
    icon: string;
    width?: string | number;
    height?: string | number;
    class?: string;
  };

  // API mirrors @iconify/svelte (same prop names, same 1em default sizing) so
  // call sites only had to swap the import. Icon data is inlined at build time.
  const { icon, width = '1em', height = '1em', class: className = '' }: Props = $props();

  const def = $derived(ICONS[icon]);
</script>

{#if def}
  <svg
    class={className}
    {width}
    {height}
    viewBox={def.viewBox}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags — static build-time icon data -->
    {@html def.body}
  </svg>
{/if}
