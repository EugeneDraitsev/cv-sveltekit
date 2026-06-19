<script lang="ts">
  import Icon from '@iconify/svelte';

  interface Props {
    expanded: boolean;
    animationActive: boolean;
    showDebugButton?: boolean;
    onToggleExpanded: () => void;
    onToggleAnimation: () => void;
    onToggleControls: () => void;
  }

  const {
    expanded,
    animationActive,
    showDebugButton = true,
    onToggleExpanded,
    onToggleAnimation,
    onToggleControls,
  }: Props = $props();

  // Icon definitions for cleaner template
  const ICONS = {
    expand: 'icons8:chevron-up-round',
    play: 'material-symbols:play-circle-outline-rounded',
    pause: 'material-symbols:pause-circle-outline-rounded',
    settings: 'material-symbols:tune',
  } as const;
</script>

<div
  class="absolute bottom-0 left-4 h-25 w-full from-base-100 to-transparent lg:left-0 z-50"
  class:bg-gradient-to-t={!expanded}
>
  <div class="mx-auto flex h-full w-full max-w-300 items-end gap-2 py-6">
    <!-- Expand/Collapse -->
    <button class="h-6 cursor-pointer" onclick={onToggleExpanded} aria-label="Toggle scene height">
      <Icon
        class="h-8 w-8 cursor-pointer text-identifier/90 transition-transform duration-200 {!expanded
          ? 'rotate-180'
          : ''}"
        icon={ICONS.expand}
      />
    </button>

    <!-- Play/Pause -->
    <button class="h-6 cursor-pointer" onclick={onToggleAnimation} aria-label="Toggle animation">
      <Icon
        class="h-8 w-8 cursor-pointer text-identifier/90 transition-transform duration-200"
        icon={animationActive ? ICONS.pause : ICONS.play}
      />
    </button>

    <!-- Settings -->
    {#if showDebugButton}
      <button class="h-6 cursor-pointer" onclick={onToggleControls} aria-label="Toggle controls">
        <Icon
          class="h-8 w-8 cursor-pointer text-identifier/90 transition-transform duration-200"
          icon={ICONS.settings}
        />
      </button>
    {/if}
  </div>
</div>
