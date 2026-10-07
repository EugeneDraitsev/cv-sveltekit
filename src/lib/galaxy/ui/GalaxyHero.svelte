<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import themeStore from '$lib/stores/theme.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { startGalaxy, type GalaxyHost } from '../host';
  import {
    DEFAULT_SETTINGS,
    type FromEngine,
    type HudInfo,
    type Instrument as InstrumentData,
    type Mode,
    type PlanetSummary,
    type Settings,
    type SystemSummary,
    type ToEngine,
    type TouchFlight as TouchInput,
  } from '../engine/protocol';
  import Hud from './Hud.svelte';
  import Dock from './Dock.svelte';
  import Instrument from './Instrument.svelte';
  import TouchFlight from './TouchFlight.svelte';
  import TunePanel from './TunePanel.svelte';

  let root = $state<HTMLDivElement>();
  let canvas = $state<HTMLCanvasElement>();
  let host: GalaxyHost | null = null;
  let shown = $state(false);
  let failed = $state(false);
  let hud = $state<HudInfo | null>(null);
  let cursor = $state('grab');
  let backendName = $state('');
  let mode = $state<Mode>('galaxy');
  let travelling = $state(false);
  let travelLabel = $state('');
  let system = $state<SystemSummary | null>(null);
  let planet = $state<PlanetSummary | null>(null);
  let instrument = $state<InstrumentData | null>(null);
  let expanded = $state(false);
  let playing = $state(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  let tuneOpen = $state(false);
  let settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  let showPlanets = $state(false);
  const touchQuery = matchMedia('(hover: none) and (pointer: coarse)');
  let touch = $state(touchQuery.matches);
  let engaged = false;

  const onDark = $derived(mode !== 'galaxy');

  function send(message: ToEngine) {
    host?.send(message);
  }

  function onMessage(message: FromEngine) {
    switch (message.type) {
      case 'firstFrame':
        shown = true;
        break;
      case 'ready':
        backendName = message.backend;
        break;
      case 'error':
        console.error('[galaxy]', message.message);
        failed = true;
        break;
      case 'hud':
        hud = message.hud;
        break;
      case 'cursor':
        cursor = message.cursor;
        break;
      case 'instrument':
        instrument = message.instrument;
        break;
      case 'fps':
        (window as unknown as { galaxyFps?: object }).galaxyFps = message;
        break;
      case 'state':
        if (message.mode !== mode) {
          tuneOpen = false;
          showPlanets = false;
        }
        mode = message.mode;
        travelling = message.travelling;
        travelLabel = message.label;
        system = message.system;
        planet = message.planet;
        if (mode !== 'planet') instrument = null;
        break;
    }
  }

  function pointer(phase: 'down' | 'move' | 'up' | 'cancel' | 'leave') {
    return (event: PointerEvent) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      if (phase === 'down') {
        engaged = true;
        canvas.setPointerCapture?.(event.pointerId);
      }
      send({
        type: 'pointer',
        phase,
        id: event.pointerId,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        button: event.button,
        pointerType: event.pointerType,
      });
    };
  }

  function onWheel(event: WheelEvent) {
    // The hero sits in a scrolling page: zoom only once the visitor engaged
    // with the scene (or when it fills the screen), otherwise let the page scroll.
    if (!engaged && !expanded && mode === 'galaxy') return;
    event.preventDefault();
    send({ type: 'wheel', x: event.offsetX, y: event.offsetY, delta: event.deltaY });
  }

  const FLIGHT_KEYS = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyQ',
    'KeyE',
    'KeyC',
    'KeyF',
    'KeyT',
    'Space',
    'ShiftLeft',
    'ShiftRight',
    'ControlLeft',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
  ]);

  function onKey(event: KeyboardEvent, phase: 'down' | 'up') {
    if (!engaged && !expanded) return;
    if (event.repeat && phase === 'down') return;
    const target = event.target as HTMLElement | null;
    if (target && /INPUT|SELECT|TEXTAREA/.test(target.tagName)) return;
    const flying = mode === 'planet' && FLIGHT_KEYS.has(event.code);
    if (!flying && event.code !== 'Escape') return;
    if (flying) event.preventDefault();
    if (event.code === 'Escape' && expanded && mode === 'galaxy' && phase === 'down') {
      expanded = false;
      return;
    }
    send({ type: 'key', phase, code: event.code, shift: event.shiftKey });
  }

  function onDocumentPointer(event: PointerEvent) {
    if (root && !root.contains(event.target as Node)) engaged = false;
  }

  function updateSettings(patch: Partial<Settings>) {
    settings = { ...settings, ...patch };
    send({ type: 'settings', settings: patch });
  }

  onMount(() => {
    if (!canvas || !root) return;
    const rect = root.getBoundingClientRect();
    let disposed = false;
    startGalaxy({
      canvas,
      width: rect.width,
      height: rect.height,
      theme: themeStore.theme === 'light' ? 'light' : 'dark',
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      onMessage,
    })
      .then((h) => {
        if (disposed) h.dispose();
        else host = h;
      })
      .catch((error) => {
        console.error(error);
        failed = true;
      });
    const resize = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      send({
        type: 'resize',
        width: box.width,
        height: box.height,
        dpr: window.devicePixelRatio || 1,
      });
    });
    resize.observe(root);
    let intersecting = true;
    const updateVisibility = () =>
      send({ type: 'visibility', visible: intersecting && !document.hidden });
    const visibility = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      updateVisibility();
    });
    visibility.observe(root);
    document.addEventListener('visibilitychange', updateVisibility);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('pointerdown', onDocumentPointer, true);
    const syncTouch = () => (touch = touchQuery.matches);
    touchQuery.addEventListener('change', syncTouch);
    // Test hook for automated visual checks.
    (window as unknown as { galaxyHook?: object }).galaxyHook = {
      send,
      state: () => ({ mode, travelling, system, planet, instrument }),
    };
    return () => {
      disposed = true;
      resize.disconnect();
      visibility.disconnect();
      document.removeEventListener('visibilitychange', updateVisibility);
      canvas?.removeEventListener('wheel', onWheel);
      document.removeEventListener('pointerdown', onDocumentPointer, true);
      touchQuery.removeEventListener('change', syncTouch);
    };
  });

  $effect(() => {
    send({ type: 'theme', theme: themeStore.theme === 'light' ? 'light' : 'dark' });
  });

  $effect(() => {
    send({ type: 'playing', playing });
  });

  onDestroy(() => host?.dispose());
</script>

<svelte:window onkeydown={(e) => onKey(e, 'down')} onkeyup={(e) => onKey(e, 'up')} />

<div
  bind:this={root}
  class="galaxy-app theme-grayscale"
  class:shown
  class:expanded
  data-backend={backendName}
  data-mode={mode}
  data-travelling={travelling}
>
  <canvas
    bind:this={canvas}
    class="galaxy-canvas"
    class:locked={mode === 'planet'}
    style:cursor
    aria-hidden="true"
    onpointerdown={pointer('down')}
    onpointermove={pointer('move')}
    onpointerup={pointer('up')}
    onpointercancel={pointer('cancel')}
    onpointerleave={pointer('leave')}
  ></canvas>

  <Hud {hud} onActivate={() => send({ type: 'command', action: 'activateHover' })} />

  {#if mode !== 'galaxy' && system}
    <div class="crumbs" class:dim={travelling}>
      <button
        type="button"
        class="back"
        onclick={() => send({ type: 'command', action: 'back' })}
        disabled={travelling}
      >
        <Icon icon="mdi:arrow-left" width="16" height="16" />
        {mode === 'planet' ? 'Orbit' : 'Galaxy'}
      </button>
      <span class="chip">
        {planet?.name ?? system.name}
        <span class="dim-text">
          · {planet
            ? `${planet.label}${planet.biomes ? ` · ${planet.biomes} biomes` : ''}`
            : system.subtitle}
        </span>
      </span>
      {#if mode === 'system' && !travelling}
        <button
          type="button"
          class="back"
          aria-expanded={showPlanets}
          onclick={() => (showPlanets = !showPlanets)}
        >
          <Icon icon="mdi:orbit" width="16" height="16" />
          Planets
        </button>
      {/if}
      {#if mode === 'planet' && !touch}
        <button
          type="button"
          class="help"
          aria-label="Flight controls: WASD fly, drag to look, Space or E up, C or Q down, Shift boost, wheel speed, F walk, T time-lapse, Escape to orbit"
        >
          <Icon icon="mdi:help-circle-outline" width="18" height="18" />
          <span class="tip">
            WASD fly · drag to look · Space/E up · C/Q down · Shift boost · wheel speed · F walk · T
            time-lapse · Esc orbit
          </span>
        </button>
      {/if}
    </div>
  {/if}

  {#if showPlanets && system && mode === 'system'}
    <ul class="planet-list" aria-label="Planets of {system.name}">
      {#each system.planets as p, i (p.name)}
        <li>
          <button
            type="button"
            onclick={() => {
              showPlanets = false;
              send({ type: 'goto', target: 'planet', index: i });
            }}
          >
            <b>{p.name}</b><span>{p.label}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}

  {#if mode === 'planet' && !travelling && instrument}
    <Instrument data={instrument} />
  {/if}

  {#if mode === 'planet' && touch && !travelling}
    <TouchFlight onInput={(input: TouchInput) => send({ type: 'touchFlight', input })} />
  {/if}

  {#if travelling}
    <p class="status" role="status">{travelLabel}</p>
  {/if}

  {#if tuneOpen && mode === 'galaxy'}
    <TunePanel {settings} onChange={updateSettings} onClose={() => (tuneOpen = false)} />
  {/if}

  <Dock
    {mode}
    {expanded}
    {playing}
    {tuneOpen}
    busy={travelling}
    walking={instrument?.walking ?? false}
    timeLapse={instrument?.timeLapse ?? false}
    {onDark}
    onExpand={() => (expanded = !expanded)}
    onPlay={() => (playing = !playing)}
    onTune={() => (tuneOpen = !tuneOpen)}
    onWalk={() => {
      send({ type: 'key', phase: 'down', code: 'KeyF', shift: false });
      send({ type: 'key', phase: 'up', code: 'KeyF', shift: false });
    }}
    onTimeLapse={() => send({ type: 'command', action: 'timeLapse' })}
  />

  {#if failed}
    <p class="galaxy-error">The galaxy could not start on this device.</p>
  {/if}
</div>

<style>
  /* Own stacking context: overlays stay inside the hero, under the fixed nav. */
  .galaxy-app {
    position: relative;
    z-index: 0;
    height: var(--galaxy-height);
    overflow: hidden;
    background: var(--color-base-100);
    transition: height 220ms ease;
  }
  .galaxy-app.expanded {
    height: 100dvh;
  }
  .galaxy-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    transition: opacity 900ms ease;
    touch-action: pan-y;
  }
  .galaxy-canvas.locked {
    touch-action: none;
  }
  .shown .galaxy-canvas {
    opacity: 1;
  }
  /* Space dissolves into the page instead of ending at a hard edge. */
  .galaxy-app:not(.expanded) .galaxy-canvas {
    mask-image: linear-gradient(to bottom, #000 80%, transparent);
  }
  .galaxy-app[data-travelling='true'] .galaxy-canvas {
    pointer-events: none;
  }
  .crumbs {
    position: absolute;
    top: 3.4rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: calc(100% - 2rem);
    pointer-events: none;
    transition: opacity 200ms ease;
  }
  .crumbs.dim {
    opacity: 0.55;
  }
  .back,
  .chip {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    min-height: 44px;
    padding: 0.4rem 0.85rem;
    border-radius: 0.55rem;
    border: 1px solid #dfe2ee44;
    background: #0c0e16b3;
    color: #e8ebf5;
    font: inherit;
    font-size: 0.82rem;
    white-space: nowrap;
    backdrop-filter: blur(8px);
  }
  .back {
    cursor: pointer;
    flex-shrink: 0;
  }
  .back:hover:not(:disabled),
  .back[aria-expanded='true'] {
    border-color: #ffd9a088;
  }
  .back:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 3px;
  }
  .back:disabled {
    opacity: 0.5;
  }
  .chip {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    color: #ffd9a0;
    letter-spacing: 0.04em;
  }
  .dim-text {
    color: #e8ebf5aa;
  }
  .help {
    position: relative;
    pointer-events: auto;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    border: 1px solid #dfe2ee44;
    background: #0c0e16b3;
    color: #e8ebf5cc;
    cursor: help;
  }
  .tip {
    position: absolute;
    top: calc(100% + 0.45rem);
    right: 0;
    width: max-content;
    max-width: min(30rem, calc(100vw - 2rem));
    padding: 0.4rem 0.8rem;
    border-radius: 0.6rem;
    background: #0c0e16e6;
    color: #e8ebf5;
    font-size: 0.72rem;
    white-space: normal;
    opacity: 0;
    visibility: hidden;
    transition: opacity 140ms ease;
  }
  .help:hover .tip,
  .help:focus-visible .tip {
    opacity: 1;
    visibility: visible;
  }
  .planet-list {
    position: absolute;
    top: 6.8rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 6;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
    width: min(46rem, calc(100% - 2rem));
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .planet-list button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-height: 44px;
    padding: 0.35rem 0.75rem;
    border-radius: 0.55rem;
    border: 1px solid #dfe2ee33;
    background: #0c0e16cc;
    color: #e8ebf5;
    font: inherit;
    font-size: 0.72rem;
    cursor: pointer;
    backdrop-filter: blur(8px);
  }
  .planet-list button:hover,
  .planet-list button:focus-visible {
    border-color: #ffd9a088;
  }
  .planet-list b {
    color: #ffd9a0;
    font-weight: 600;
  }
  .planet-list span {
    opacity: 0.75;
  }
  .status {
    position: absolute;
    bottom: 9.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 7;
    margin: 0;
    padding: 0.4rem 0.9rem;
    border-radius: 999px;
    background: #0c0e16b3;
    color: #e8ebf5;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    pointer-events: none;
    backdrop-filter: blur(8px);
  }
  .galaxy-error {
    position: absolute;
    inset: auto 0 45% 0;
    margin: 0;
    text-align: center;
    color: var(--color-identifier);
    font-size: 0.8rem;
  }
  @media (max-width: 640px) {
    .crumbs {
      top: 3rem;
    }
    .back,
    .chip {
      font-size: 0.75rem;
      padding-inline: 0.6rem;
    }
  }
</style>
