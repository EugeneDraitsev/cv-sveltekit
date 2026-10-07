<script lang="ts">
  import type { HudInfo } from '../engine/protocol';

  const { hud, onActivate }: { hud: HudInfo | null; onActivate: () => void } = $props();

  let layer = $state<HTMLDivElement>();
  let card = $state<HTMLButtonElement>();

  // Keep the card on screen: flip sides near the right edge and below near the top.
  const placement = $derived.by(() => {
    const width = layer?.clientWidth ?? 800;
    const height = layer?.clientHeight ?? 500;
    const cardWidth = card?.offsetWidth ?? 220;
    const x = hud?.x ?? 0;
    const y = hud?.y ?? 0;
    const compact = width <= 640;
    return {
      left: !compact && x > width - cardWidth - 72,
      below: y < 110,
      x: Math.min(width - 24, Math.max(24, x)),
      y: Math.min(height - 24, Math.max(24, y)),
    };
  });
</script>

<div class="hud-layer" bind:this={layer}>
  <div
    class="hud-anchor"
    class:visible={hud?.visible}
    class:side-left={placement.left}
    class:below={placement.below}
    data-on-dark={hud?.onDark}
    style:transform={`translate3d(${placement.x.toFixed(1)}px, ${placement.y.toFixed(1)}px, 0)`}
  >
    <div class="hud-reticle" aria-hidden="true">
      <span class="hud-tick" style:--angle="0deg"></span>
      <span class="hud-tick" style:--angle="90deg"></span>
      <span class="hud-tick" style:--angle="180deg"></span>
      <span class="hud-tick" style:--angle="270deg"></span>
    </div>
    <div class="hud-leader" aria-hidden="true"></div>
    <button
      bind:this={card}
      class="hud-card"
      type="button"
      tabindex={hud?.visible ? 0 : -1}
      disabled={!hud?.actionable}
      aria-label={hud?.title ? `${hud.title}: ${hud.hint}` : 'Hovered object'}
      onclick={(event) => {
        event.stopPropagation();
        onActivate();
      }}
    >
      <span class="hud-title">{hud?.title ?? ''}</span>
      {#if hud?.subtitle}<span class="hud-subtitle">{hud.subtitle}</span>{/if}
      {#if hud?.hint}<span class="hud-hint">{hud.hint}</span>{/if}
    </button>
  </div>
</div>

<style>
  .hud-layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 4;
  }
  .hud-anchor {
    --hud-line: var(--color-identifier);
    --hud-strong: var(--color-primary);
    --hud-bg: var(--color-base-100);
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
    opacity: 0;
    transition: opacity 140ms ease;
  }
  .hud-anchor[data-on-dark='true'] {
    --hud-line: #dfe2ee;
    --hud-strong: #ffd9a0;
    --hud-bg: #0c0e16;
  }
  .hud-anchor.visible {
    opacity: 1;
  }
  .hud-reticle {
    position: absolute;
    left: -19px;
    top: -19px;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--hud-line) 60%, transparent);
    box-shadow: 0 0 14px color-mix(in srgb, var(--hud-strong) 22%, transparent);
    animation: hud-spin 10s linear infinite;
  }
  .hud-tick {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1.5px;
    height: 7px;
    margin-left: -0.75px;
    background: color-mix(in srgb, var(--hud-strong) 85%, transparent);
    transform: rotate(var(--angle)) translateY(-24px);
    transform-origin: center 0;
  }
  .hud-leader {
    position: absolute;
    left: 14px;
    top: -14px;
    width: 26px;
    height: 1px;
    background: color-mix(in srgb, var(--hud-line) 60%, transparent);
    transform: rotate(-45deg);
    transform-origin: left center;
  }
  .side-left .hud-leader {
    left: auto;
    right: 14px;
    transform: rotate(45deg);
    transform-origin: right center;
  }
  .below .hud-leader {
    top: 14px;
    transform: rotate(45deg);
  }
  .side-left.below .hud-leader {
    transform: rotate(-45deg);
  }
  .hud-card {
    position: absolute;
    left: 33px;
    bottom: 27px;
    display: flex;
    flex-direction: column;
    padding: 0.4rem 0.75rem 0.45rem;
    border-radius: 0.55rem;
    border: 1px solid color-mix(in srgb, var(--hud-line) 28%, transparent);
    background: color-mix(in srgb, var(--hud-bg) 78%, transparent);
    backdrop-filter: blur(8px);
    font: inherit;
    text-align: left;
    white-space: nowrap;
    box-shadow: 0 4px 18px rgb(0 0 0 / 0.18);
    pointer-events: none;
    cursor: pointer;
  }
  .visible .hud-card:not(:disabled) {
    pointer-events: auto;
  }
  .hud-card:not(:disabled):hover,
  .hud-card:focus-visible {
    border-color: color-mix(in srgb, var(--hud-strong) 45%, transparent);
  }
  .hud-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--hud-strong) 70%, transparent);
    outline-offset: 3px;
  }
  .side-left .hud-card {
    right: 33px;
    left: auto;
    text-align: right;
  }
  .below .hud-card {
    top: 27px;
    bottom: auto;
  }
  .hud-title {
    font-size: 0.85rem;
    font-weight: 650;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--hud-strong);
  }
  .hud-subtitle {
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    color: color-mix(in srgb, var(--hud-line) 85%, transparent);
    margin-top: 0.1rem;
  }
  .hud-hint {
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--hud-line) 60%, transparent);
    margin-top: 0.28rem;
  }
  @keyframes hud-spin {
    to {
      rotate: 360deg;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .hud-reticle {
      animation: none;
    }
  }
  @media (max-width: 640px) {
    .hud-card {
      left: -6rem;
      width: 12rem;
      white-space: normal;
    }
    .hud-leader {
      display: none;
    }
  }
</style>
