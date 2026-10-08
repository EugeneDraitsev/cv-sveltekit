<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Mode } from '../engine/protocol';

  const {
    mode,
    expanded,
    playing,
    tuneOpen,
    systemsOpen = false,
    busy,
    walking,
    canWalk = true,
    timeLapse,
    onDark,
    onExpand,
    onPlay,
    onTune,
    onSystems,
    onWalk,
    onTimeLapse,
  }: {
    mode: Mode;
    expanded: boolean;
    playing: boolean;
    tuneOpen: boolean;
    systemsOpen?: boolean;
    busy: boolean;
    walking: boolean;
    /** False over a giant: there is no ground to walk on. */
    canWalk?: boolean;
    timeLapse: boolean;
    onDark: boolean;
    onExpand: () => void;
    onPlay: () => void;
    onTune: () => void;
    /** Open the list of star systems (galaxy view). */
    onSystems?: () => void;
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
      <Icon icon={expanded ? 'mdi:fullscreen-exit' : 'mdi:fullscreen'} width="18" height="18" />
      <span>{expanded ? 'Collapse' : 'Expand'}</span>
    </button>
    {#if mode === 'planet'}
      <span class="separator" aria-hidden="true"></span>
      {#if canWalk}
        <button
          type="button"
          onclick={onWalk}
          disabled={busy}
          aria-pressed={walking}
          aria-label={walking ? 'Switch to flying' : 'Switch to walking'}
          title={walking ? 'Fly (F)' : 'Walk (F)'}
        >
          <Icon icon={walking ? 'mdi:airplane' : 'mdi:walk'} width="18" height="18" />
          <span>{walking ? 'Fly' : 'Walk'}</span>
        </button>
      {/if}
      <button
        type="button"
        onclick={onTimeLapse}
        disabled={busy}
        aria-pressed={timeLapse}
        aria-label={timeLapse ? 'Normal time' : 'Fast-forward the day'}
        title="Time-lapse (T)"
      >
        <Icon icon="mdi:weather-sunset" width="18" height="18" />
        <span>Time-lapse</span>
        {#if timeLapse}<em>×40</em>{/if}
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
      {#if onSystems}
        <button
          type="button"
          onclick={onSystems}
          disabled={busy}
          aria-expanded={systemsOpen}
          aria-label="Star systems"
          title="Star systems"
        >
          <Icon icon="mdi:star-four-points-outline" width="18" height="18" />
          <span>Systems</span>
        </button>
      {/if}
      <button
        type="button"
        onclick={onTune}
        disabled={busy}
        aria-expanded={tuneOpen}
        aria-label="Galaxy settings"
        title="Tune"
      >
        <Icon icon="material-symbols:tune" width="18" height="18" />
        <span>Tune</span>
      </button>
    {/if}
  </div>
</div>

<style>
  .dock-wrap {
    position: absolute;
    bottom: 5.4rem;
    left: 1rem;
    right: 1rem;
    z-index: 8;
    display: flex;
    justify-content: center;
    pointer-events: none;
    --dock-ink: var(--color-identifier);
    --dock-accent: var(--color-primary);
    --dock-glass: color-mix(in srgb, var(--color-base-100) 70%, transparent);
    --dock-edge: color-mix(in srgb, var(--color-identifier) 14%, transparent);
  }
  .on-dark {
    --dock-ink: #e9ecf6;
    --dock-accent: #ffd9a0;
    --dock-glass: rgb(10 12 20 / 0.55);
    --dock-edge: rgb(233 236 246 / 0.14);
  }
  .dock {
    display: flex;
    align-items: center;
    gap: 0.15rem;
    padding: 0.2rem;
    border: 1px solid var(--dock-edge);
    border-radius: 999px;
    background: var(--dock-glass);
    backdrop-filter: blur(16px) saturate(150%);
    box-shadow:
      0 10px 28px rgb(0 0 0 / 0.22),
      inset 0 1px 0 rgb(255 255 255 / 0.06);
    pointer-events: auto;
  }
  button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    height: 2.25rem;
    min-width: 2.25rem;
    padding: 0 0.75rem;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: color-mix(in srgb, var(--dock-ink) 86%, transparent);
    font: inherit;
    font-size: 0.72rem;
    letter-spacing: 0.02em;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }
  /* Hover only where there is a pointer that hovers: on touch it would
     stick after a tap and hide the real on/off state. */
  @media (hover: hover) {
    button:hover:not(:disabled) {
      background: color-mix(in srgb, var(--dock-ink) 10%, transparent);
      color: var(--dock-ink);
    }
  }
  /* On: accent text on an accent-tinted pill, with a small indicator. */
  button[aria-pressed='true'],
  button[aria-expanded='true'] {
    background: color-mix(in srgb, var(--dock-accent) 18%, transparent);
    color: var(--dock-accent);
  }
  button[aria-pressed='true']::after {
    content: '';
    position: absolute;
    bottom: 0.2rem;
    left: 50%;
    width: 0.25rem;
    height: 0.25rem;
    margin-left: -0.125rem;
    border-radius: 50%;
    background: var(--dock-accent);
  }
  button:focus {
    outline: none;
  }
  button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--dock-accent) 70%, transparent);
    outline-offset: 2px;
  }
  button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  em {
    font-style: normal;
    font-size: 0.66rem;
    opacity: 0.85;
  }
  .separator {
    width: 1px;
    height: 14px;
    margin-inline: 0.1rem;
    background: var(--dock-edge);
  }
  /* Narrow screens: a slim row of icons tucked into the bottom-right corner,
     so the scene keeps the centre (where you are sits top-left). */
  @media (max-width: 900px) {
    .dock-wrap {
      left: auto;
      right: 0.75rem;
    }
    .dock {
      gap: 0.1rem;
      padding: 0.15rem;
    }
    .separator,
    button span,
    button em {
      display: none;
    }
    button {
      width: 2.4rem;
      height: 2.4rem;
      padding: 0;
    }
  }
</style>
