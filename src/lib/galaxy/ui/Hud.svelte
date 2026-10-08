<script lang="ts">
  import type { HudInfo } from '../engine/protocol';

  const { hud, onActivate }: { hud: HudInfo | null; onActivate: () => void } = $props();

  let layer = $state<HTMLDivElement>();
  let card = $state<HTMLButtonElement>();

  // The engine clears the target (and its position) the moment the pointer
  // leaves it; keep showing the last one while it fades out where it was.
  let last = $state<HudInfo | null>(null);
  $effect(() => {
    if (hud?.visible) last = hud;
  });
  const visible = $derived(Boolean(hud?.visible));

  // Keep the card on screen: flip to the left near the right edge and below
  // near the top. Narrow screens centre it under the target instead.
  const placement = $derived.by(() => {
    const width = layer?.clientWidth ?? 800;
    const height = layer?.clientHeight ?? 500;
    const cardWidth = card?.offsetWidth ?? 220;
    const cardHeight = card?.offsetHeight ?? 64;
    const x = last?.x ?? width / 2;
    const y = last?.y ?? height / 2;
    const compact = width <= 640;
    return {
      compact,
      left: !compact && x > width - cardWidth - 64,
      below: compact ? y < height - cardHeight - 72 : y < cardHeight + 56,
      x: compact
        ? Math.min(width - cardWidth / 2 - 12, Math.max(cardWidth / 2 + 12, x))
        : Math.min(width - 16, Math.max(16, x)),
      ring: x,
      y: Math.min(height - 16, Math.max(16, y)),
    };
  });
</script>

<div class="hud-layer" bind:this={layer}>
  <div
    class="hud-anchor"
    class:visible
    class:side-left={placement.left}
    class:below={placement.below}
    class:compact={placement.compact}
    data-on-dark={last?.onDark}
    style:transform={`translate3d(${placement.ring.toFixed(1)}px, ${placement.y.toFixed(1)}px, 0)`}
  >
    <svg class="hud-ring" viewBox="-24 -24 48 48" aria-hidden="true">
      <circle class="hud-orbit" r="15" />
      <path
        class="hud-corners"
        d="M-21 -11 V-21 H-11 M11 -21 H21 V-11 M21 11 V21 H11 M-11 21 H-21 V11"
      />
      <circle class="hud-core" r="1.6" />
    </svg>
    <span class="hud-leader" aria-hidden="true"></span>
    <button
      bind:this={card}
      class="hud-card"
      type="button"
      style:--shift={`${(placement.x - placement.ring).toFixed(1)}px`}
      tabindex={visible ? 0 : -1}
      disabled={!last?.actionable}
      aria-label={last?.title ? `${last.title}: ${last.hint}` : 'Hovered object'}
      onclick={(event) => {
        event.stopPropagation();
        onActivate();
      }}
    >
      <span class="hud-title">{last?.title ?? ''}</span>
      {#if last?.subtitle}<span class="hud-subtitle">{last.subtitle}</span>{/if}
      {#if last?.hint}
        <span class="hud-hint">
          {last.hint}
          {#if last.actionable}<span class="hud-arrow" aria-hidden="true">→</span>{/if}
        </span>
      {/if}
    </button>
  </div>
</div>

<style>
  /* Positions come in canvas pixels: share the canvas frame (GalaxyHero). */
  .hud-layer {
    position: absolute;
    left: 0;
    right: 0;
    top: var(--frame-top, 0);
    height: var(--frame-height, 100%);
    overflow: hidden;
    pointer-events: none;
    z-index: 4;
  }
  .hud-anchor {
    --hud-ink: var(--color-identifier);
    --hud-accent: var(--color-primary);
    --hud-glass: color-mix(in srgb, var(--color-base-100) 72%, transparent);
    --hud-edge: color-mix(in srgb, var(--color-identifier) 16%, transparent);
    position: absolute;
    top: 0;
    left: 0;
    will-change: transform;
    opacity: 0;
    transition: opacity 180ms ease;
  }
  .hud-anchor[data-on-dark='true'] {
    --hud-ink: #e9ecf6;
    --hud-accent: #ffd9a0;
    --hud-glass: rgb(10 12 20 / 0.62);
    --hud-edge: rgb(233 236 246 / 0.14);
  }
  .hud-anchor.visible {
    opacity: 1;
  }

  /* Target lock: a thin orbit and four corner brackets that close in. */
  .hud-ring {
    position: absolute;
    left: -24px;
    top: -24px;
    width: 48px;
    height: 48px;
    overflow: visible;
    fill: none;
    transform: scale(1.35);
    transition: transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .visible .hud-ring {
    transform: scale(1);
  }
  .hud-orbit {
    stroke: color-mix(in srgb, var(--hud-ink) 38%, transparent);
    stroke-width: 0.8;
  }
  .hud-corners {
    stroke: var(--hud-accent);
    stroke-width: 1.4;
    stroke-linecap: round;
  }
  .hud-core {
    fill: var(--hud-accent);
  }

  /* A short leader from the ring to the card. */
  .hud-leader {
    position: absolute;
    left: 18px;
    top: -18px;
    width: 22px;
    height: 1px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--hud-accent) 70%, transparent),
      transparent
    );
    transform: rotate(-35deg);
    transform-origin: left center;
  }
  .side-left .hud-leader {
    left: auto;
    right: 18px;
    background: linear-gradient(
      270deg,
      color-mix(in srgb, var(--hud-accent) 70%, transparent),
      transparent
    );
    transform: rotate(35deg);
    transform-origin: right center;
  }
  .below .hud-leader {
    top: 18px;
    transform: rotate(35deg);
  }
  .side-left.below .hud-leader {
    transform: rotate(-35deg);
  }

  .hud-card {
    position: absolute;
    left: 38px;
    bottom: 22px;
    display: flex;
    flex-direction: column;
    gap: 0.12rem;
    min-width: 9.5rem;
    padding: 0.5rem 0.85rem 0.55rem 0.95rem;
    border-radius: 0.7rem;
    border: 1px solid var(--hud-edge);
    background: var(--hud-glass);
    backdrop-filter: blur(14px) saturate(140%);
    box-shadow:
      0 10px 30px rgb(0 0 0 / 0.28),
      inset 0 1px 0 rgb(255 255 255 / 0.06);
    font: inherit;
    text-align: left;
    white-space: nowrap;
    color: var(--hud-ink);
    pointer-events: none;
    cursor: pointer;
    translate: 0 4px;
    transition:
      translate 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
      border-color 150ms ease;
  }
  /* An accent bar down the leading edge. */
  .hud-card::before {
    content: '';
    position: absolute;
    left: 0.4rem;
    top: 0.6rem;
    bottom: 0.6rem;
    width: 2px;
    border-radius: 2px;
    background: linear-gradient(
      var(--hud-accent),
      color-mix(in srgb, var(--hud-accent) 20%, transparent)
    );
  }
  .visible .hud-card {
    translate: 0 0;
  }
  .visible .hud-card:not(:disabled) {
    pointer-events: auto;
  }
  .hud-card:not(:disabled):hover,
  .hud-card:focus-visible {
    border-color: color-mix(in srgb, var(--hud-accent) 50%, transparent);
  }
  .hud-card:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--hud-accent) 70%, transparent);
    outline-offset: 3px;
  }
  .side-left .hud-card {
    right: 38px;
    left: auto;
  }
  .below .hud-card {
    top: 22px;
    bottom: auto;
  }
  .hud-title {
    font-size: 0.86rem;
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--hud-accent);
  }
  .hud-subtitle {
    font-size: 0.72rem;
    color: color-mix(in srgb, var(--hud-ink) 78%, transparent);
  }
  .hud-hint {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.3rem;
    font-size: 0.64rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--hud-ink) 58%, transparent);
  }
  .hud-arrow {
    color: var(--hud-accent);
    transition: translate 150ms ease;
  }
  .hud-card:not(:disabled):hover .hud-arrow {
    translate: 3px 0;
  }

  /* Phones: the card sits centred under (or over) the target, wide enough to read. */
  .compact .hud-leader {
    display: none;
  }
  .compact .hud-card {
    left: calc(var(--shift) - 6.5rem);
    right: auto;
    width: 13rem;
    white-space: normal;
    top: auto;
    bottom: 30px;
  }
  .compact.below .hud-card {
    top: 30px;
    bottom: auto;
  }

  @media (prefers-reduced-motion: reduce) {
    .hud-ring,
    .hud-card {
      transition: none;
    }
  }
</style>
