<script lang="ts">
  import { hudState, bindHudElement } from './hud.svelte';

  let anchor = $state<HTMLDivElement>();

  $effect(() => {
    bindHudElement(anchor ?? null);
    return () => bindHudElement(null);
  });
</script>

<!-- Decorative pointer layer — screen readers get the journey buttons instead. -->
<div class="hud-layer" aria-hidden="true">
  <div
    bind:this={anchor}
    class="hud-anchor"
    class:visible={hudState.visible}
    data-on-dark={hudState.onDark}
  >
    <div class="hud-reticle">
      <span class="hud-tick" style:--angle="0deg"></span>
      <span class="hud-tick" style:--angle="90deg"></span>
      <span class="hud-tick" style:--angle="180deg"></span>
      <span class="hud-tick" style:--angle="270deg"></span>
    </div>
    <div class="hud-leader"></div>
    <div class="hud-card">
      <div class="hud-title">{hudState.title}</div>
      {#if hudState.subtitle}
        <div class="hud-subtitle">{hudState.subtitle}</div>
      {/if}
      {#if hudState.hint}
        <div class="hud-hint">{hudState.hint}</div>
      {/if}
    </div>
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

  /* System/planet scenes always render on a dark backdrop, regardless of the
     site theme — force the light HUD palette there. */
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

  .hud-anchor.visible .hud-reticle {
    animation:
      hud-spin 10s linear infinite,
      hud-lock 260ms cubic-bezier(0.2, 0.8, 0.3, 1.15);
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
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--hud-line) 70%, transparent),
      color-mix(in srgb, var(--hud-line) 25%, transparent)
    );
    transform: rotate(-45deg);
    transform-origin: left center;
  }

  .hud-card {
    position: absolute;
    left: 33px;
    bottom: 27px;
    padding: 0.4rem 0.75rem 0.45rem;
    border-radius: 0.55rem;
    border: 1px solid color-mix(in srgb, var(--hud-line) 28%, transparent);
    background: color-mix(in srgb, var(--hud-bg) 76%, transparent);
    backdrop-filter: blur(8px);
    white-space: nowrap;
    box-shadow: 0 4px 18px rgb(0 0 0 / 0.18);
  }

  .hud-title {
    font-size: 0.85rem;
    font-weight: 650;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--hud-strong);
    line-height: 1.25;
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
    color: color-mix(in srgb, var(--hud-line) 55%, transparent);
    margin-top: 0.28rem;
  }

  @keyframes hud-spin {
    from {
      rotate: 0deg;
    }
    to {
      rotate: 360deg;
    }
  }

  @keyframes hud-lock {
    from {
      scale: 1.7;
      opacity: 0;
    }
    to {
      scale: 1;
      opacity: 1;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hud-reticle,
    .hud-anchor.visible .hud-reticle {
      animation: none;
    }
  }
</style>
