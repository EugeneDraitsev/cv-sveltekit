<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Mode } from '../engine/protocol';

  const {
    mode,
    expanded,
    playing,
    tuneOpen,
    busy,
    walking,
    timeLapse,
    onDark,
    onExpand,
    onPlay,
    onTune,
    onWalk,
    onTimeLapse,
  }: {
    mode: Mode;
    expanded: boolean;
    playing: boolean;
    tuneOpen: boolean;
    busy: boolean;
    walking: boolean;
    timeLapse: boolean;
    onDark: boolean;
    onExpand: () => void;
    onPlay: () => void;
    onTune: () => void;
    onWalk: () => void;
    onTimeLapse: () => void;
  } = $props();
</script>

<div class="dock-wrap" class:on-dark={onDark}>
  <div class="dock" role="group" aria-label="Scene controls">
    <button
      type="button"
      onclick={onExpand}
      aria-pressed={expanded}
      aria-label={expanded ? 'Collapse scene' : 'Expand scene'}
      title={expanded ? 'Collapse' : 'Expand'}
    >
      <Icon icon={expanded ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'} width="20" height="20" />
      <span>{expanded ? 'Collapse' : 'Expand'}</span>
    </button>
    {#if mode === 'planet'}
      <span class="separator" aria-hidden="true"></span>
      <button
        type="button"
        onclick={onWalk}
        disabled={busy}
        aria-pressed={walking}
        aria-label={walking ? 'Switch to flying' : 'Switch to walking'}
        title={walking ? 'Fly (F)' : 'Walk (F)'}
      >
        <Icon icon={walking ? 'mdi:airplane' : 'mdi:walk'} width="20" height="20" />
        <span>{walking ? 'Fly' : 'Walk'}</span>
      </button>
      <button
        type="button"
        onclick={onTimeLapse}
        disabled={busy}
        aria-pressed={timeLapse}
        aria-label={timeLapse ? 'Normal time' : 'Fast-forward the day'}
        title="Time-lapse (T)"
      >
        <Icon icon="mdi:weather-sunset" width="20" height="20" />
        <span>{timeLapse ? 'Real time' : 'Time-lapse'}</span>
      </button>
    {:else}
      <span class="separator" aria-hidden="true"></span>
      <button
        type="button"
        onclick={onPlay}
        disabled={busy}
        aria-pressed={!playing}
        aria-label={playing ? 'Pause animation' : 'Play animation'}
        title={playing ? 'Pause' : 'Play'}
      >
        <Icon
          icon={playing
            ? 'material-symbols:pause-circle-outline-rounded'
            : 'material-symbols:play-circle-outline-rounded'}
          width="20"
          height="20"
        />
        <span>{playing ? 'Pause' : 'Play'}</span>
      </button>
    {/if}
    {#if mode === 'galaxy'}
      <span class="separator" aria-hidden="true"></span>
      <button
        type="button"
        onclick={onTune}
        disabled={busy}
        aria-expanded={tuneOpen}
        aria-label="Galaxy settings"
        title="Tune"
      >
        <Icon icon="material-symbols:tune" width="20" height="20" />
        <span>Tune</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .dock-wrap {
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
  .dock {
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
    transition: background 150ms ease;
  }
  button:hover:not(:disabled),
  button[aria-expanded='true'],
  button[aria-pressed='true'] {
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
  @media (max-width: 520px) {
    button span {
      display: none;
    }
    button {
      padding-inline: 0.7rem;
    }
  }
</style>
