<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';

  const {
    expanded,
    animationActive,
    showSettings,
    settingsOpen = false,
    busy = false,
    onDark = false,
    onToggleExpanded,
    onToggleAnimation,
    onToggleControls,
  }: {
    expanded: boolean;
    animationActive: boolean;
    showSettings: boolean;
    settingsOpen?: boolean;
    busy?: boolean;
    onDark?: boolean;
    onToggleExpanded: () => void;
    onToggleAnimation: () => void;
    onToggleControls: () => void;
  } = $props();
</script>

<div class="galaxy-controls" class:on-dark={onDark}>
  <div class="control-dock" role="group" aria-label="Scene controls">
    <button
      onclick={onToggleExpanded}
      aria-label={expanded ? 'Collapse scene' : 'Expand scene'}
      aria-pressed={expanded}
      title={expanded ? 'Collapse scene' : 'Expand scene'}
    >
      <Icon
        icon="icons8:chevron-up-round"
        width="20"
        height="20"
        class={expanded ? '' : 'rotate-180'}
      />
      <span>{expanded ? 'Collapse' : 'Expand'}</span>
    </button>
    <span class="separator" aria-hidden="true"></span>
    <button
      onclick={onToggleAnimation}
      disabled={busy}
      aria-label={animationActive ? 'Pause animation' : 'Play animation'}
      aria-pressed={!animationActive}
      title={animationActive ? 'Pause animation' : 'Play animation'}
    >
      <Icon
        icon={animationActive
          ? 'material-symbols:pause-circle-outline-rounded'
          : 'material-symbols:play-circle-outline-rounded'}
        width="20"
        height="20"
      />
      <span>{animationActive ? 'Pause' : 'Play'}</span>
    </button>
    {#if showSettings}
      <span class="separator" aria-hidden="true"></span>
      <button
        onclick={onToggleControls}
        disabled={busy}
        aria-label="Galaxy settings"
        aria-expanded={settingsOpen}
        title="Galaxy settings"
      >
        <Icon icon="material-symbols:tune" width="20" height="20" />
        <span>Tune</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .galaxy-controls {
    position: absolute;
    bottom: 5.5rem;
    left: 1.25rem;
    right: 1.25rem;
    z-index: 8;
    display: flex;
    justify-content: center;
    pointer-events: none;
    --dock-ink: var(--color-identifier);
    --dock-bg: var(--color-base-100);
  }
  .on-dark {
    --dock-ink: #e5eaf5;
    --dock-bg: #111524;
  }
  .control-dock {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    padding: 0.3rem;
    border: 1px solid color-mix(in srgb, var(--dock-ink) 20%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--dock-bg) 85%, transparent);
    box-shadow: 0 8px 28px #0002;
    backdrop-filter: blur(12px);
    pointer-events: auto;
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 44px;
    min-width: 44px;
    padding: 0.5rem 0.85rem;
    border: 0;
    border-radius: 999px;
    color: var(--dock-ink);
    font: inherit;
    font-size: 0.75rem;
    cursor: pointer;
    transition:
      background 150ms ease,
      color 150ms ease;
  }
  button:hover:not(:disabled),
  button[aria-expanded='true'] {
    background: color-mix(in srgb, var(--dock-ink) 12%, transparent);
  }
  button:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 3px;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .separator {
    width: 1px;
    height: 16px;
    background: color-mix(in srgb, var(--dock-ink) 18%, transparent);
  }
  @media (max-width: 400px) {
    button {
      padding-inline: 0.6rem;
    }
  }
</style>
