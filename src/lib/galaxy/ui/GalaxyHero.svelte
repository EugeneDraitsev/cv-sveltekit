<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
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
  let disposed = false;
  // Whether the hero is on screen (the IntersectionObserver keeps it current).
  let intersecting = true;
  // Bumped to mount a brand-new canvas element for a WebGL2 restart.
  let canvasKey = $state(0);
  let restarted = false;
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
  let showSystems = $state(false);
  let catalog = $state<{ name: string; subtitle: string }[] | null>(null);
  let systemsPanel = $state<HTMLDivElement>();

  // Keyboard users land in the list as soon as it opens.
  $effect(() => {
    if (showSystems && catalog && systemsPanel) {
      systemsPanel.querySelector('button')?.focus({ preventScroll: true });
    }
  });
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
        if (message.retry === 'webgl' && !restarted) {
          console.warn('[galaxy] WebGPU failed, restarting on WebGL2:', message.message);
          void restartOnWebgl();
        } else {
          console.error('[galaxy]', message.message);
          failed = true;
        }
        break;
      case 'catalog':
        catalog = message.systems;
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
          showSystems = false;
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

  // Flight keys the engine currently holds down.
  const held = new Set<string>();

  function release(code: string) {
    held.delete(code);
    send({ type: 'key', phase: 'up', code, shift: false });
  }

  function onKey(event: KeyboardEvent, phase: 'down' | 'up') {
    // Releases always go through: a key held while the visitor clicks away
    // from the scene must not stay pressed in the engine.
    if (phase === 'up') {
      if (held.has(event.code)) release(event.code);
      return;
    }
    if (event.code === 'Escape' && showSystems) {
      showSystems = false;
      root?.querySelector<HTMLElement>('[aria-label="Star systems"][aria-expanded]')?.focus();
      return;
    }
    if (!engaged && !expanded) return;
    if (event.repeat && phase === 'down') return;
    const target = event.target as HTMLElement | null;
    // Text fields keep every key; a focused button or link keeps Space, its
    // activation key (WASD and the rest still fly).
    if (
      target?.closest('input, select, textarea, [contenteditable]:not([contenteditable="false"])')
    ) {
      return;
    }
    if (event.code === 'Space' && target?.closest('button, a[href], summary, [role="button"]'))
      return;
    const flying = mode === 'planet' && FLIGHT_KEYS.has(event.code);
    if (!flying && event.code !== 'Escape') return;
    if (flying) event.preventDefault();
    if (event.code === 'Escape' && expanded && mode === 'galaxy') {
      expanded = false;
      return;
    }
    if (flying) held.add(event.code);
    send({ type: 'key', phase, code: event.code, shift: event.shiftKey });
  }

  /** Switching windows or tabs swallows keyups: let go of everything. */
  function releaseAll() {
    // Deleting the current entry while iterating a Set is safe.
    for (const code of held) release(code);
  }

  function onDocumentPointer(event: PointerEvent) {
    if (root && !root.contains(event.target as Node)) engaged = false;
  }

  function updateSettings(patch: Partial<Settings>) {
    settings = { ...settings, ...patch };
    send({ type: 'settings', settings: patch });
  }

  /**
   * Messages sent before the host existed (theme, pause, Tune, resizes while
   * the engine chunk was still loading) were dropped: bring it up to date.
   */
  function syncHost() {
    if (!host || !root) return;
    const box = root.getBoundingClientRect();
    host.send({ type: 'resize', width: box.width, height: box.height, dpr: devicePixelRatio || 1 });
    host.send({ type: 'visibility', visible: intersecting && !document.hidden });
    host.send({ type: 'theme', theme: themeStore.theme === 'light' ? 'light' : 'dark' });
    host.send({ type: 'playing', playing });
    host.send({ type: 'settings', settings: { ...settings } });
  }

  function launch(renderer: 'auto' | 'webgl') {
    if (!canvas || !root) return;
    const rect = root.getBoundingClientRect();
    canvas.addEventListener('wheel', onWheel, { passive: false });
    startGalaxy({
      canvas,
      width: rect.width,
      height: rect.height,
      theme: themeStore.theme === 'light' ? 'light' : 'dark',
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      renderer,
      onMessage,
    })
      .then((h) => {
        if (disposed) {
          h.dispose();
          return;
        }
        host = h;
        syncHost();
      })
      .catch((error) => {
        console.error(error);
        failed = true;
      });
  }

  /**
   * WebGPU failed after it had claimed the canvas, and a canvas never changes
   * context type: start over with WebGL2 on a new canvas element.
   */
  async function restartOnWebgl() {
    restarted = true;
    host?.dispose();
    host = null;
    canvas?.removeEventListener('wheel', onWheel);
    canvasKey += 1;
    await tick();
    if (!disposed) launch('webgl');
  }

  onMount(() => {
    if (!canvas || !root) return;
    launch('auto');
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
    const updateVisibility = () =>
      send({ type: 'visibility', visible: intersecting && !document.hidden });
    const visibility = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      updateVisibility();
    });
    visibility.observe(root);
    document.addEventListener('visibilitychange', updateVisibility);
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

<svelte:window
  onkeydown={(e) => onKey(e, 'down')}
  onkeyup={(e) => onKey(e, 'up')}
  onblur={releaseAll}
/>

<div
  bind:this={root}
  class="galaxy-app"
  class:shown
  class:expanded
  data-backend={backendName}
  data-mode={mode}
  data-travelling={travelling}
>
  {#key canvasKey}
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
  {/key}

  <Hud {hud} onActivate={() => send({ type: 'command', action: 'activateHover' })} />

  {#if mode !== 'galaxy' && system}
    <nav class="crumbs" class:dim={travelling} aria-label="Where you are">
      <button
        type="button"
        class="nav-back"
        aria-label={mode === 'planet' ? 'Back to orbit' : 'Back to the galaxy'}
        title={mode === 'planet' ? 'Back to orbit' : 'Back to the galaxy'}
        onclick={() => send({ type: 'command', action: 'back' })}
        disabled={travelling}
      >
        <Icon icon="mdi:arrow-left" width="18" height="18" />
      </button>
      <div class="trail">
        <span class="path">
          Galaxy<span class="sep" aria-hidden="true">/</span>{#if planet}{system.name}<span
              class="sep"
              aria-hidden="true">/</span
            >{/if}
        </span>
        <span class="here">
          <b>{planet?.name ?? system.name}</b>
          <small>
            {planet
              ? `${planet.label}${planet.biomes ? ` · ${planet.biomes} biomes` : ''}`
              : system.subtitle}
          </small>
        </span>
      </div>
      {#if mode === 'system' && !travelling}
        <button
          type="button"
          class="nav-action"
          aria-expanded={showPlanets}
          onclick={() => (showPlanets = !showPlanets)}
        >
          <Icon icon="mdi:orbit" width="16" height="16" />
          <span>Planets</span>
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
    </nav>
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

  {#if showSystems && mode === 'galaxy' && !travelling}
    <div bind:this={systemsPanel} class="systems-panel" role="dialog" aria-label="Star systems">
      {#if catalog}
        <ul class="planet-list systems" aria-label="Star systems">
          {#each catalog as s, i (i)}
            <li>
              <button
                type="button"
                onclick={() => {
                  showSystems = false;
                  send({ type: 'goto', target: 'system', index: i });
                }}
              >
                <b>{s.name}</b><span>{s.subtitle}</span>
              </button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="systems-loading">Charting the galaxy…</p>
      {/if}
    </div>
  {/if}

  {#if mode === 'planet' && !travelling && instrument}
    <Instrument data={instrument} />
  {/if}

  {#if mode === 'planet' && touch && !travelling}
    <TouchFlight
      compact={!expanded}
      onInput={(input: TouchInput) => send({ type: 'touchFlight', input })}
    />
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
    canWalk={!planet?.giant}
    timeLapse={instrument?.timeLapse ?? false}
    {onDark}
    onExpand={() => (expanded = !expanded)}
    onPlay={() => (playing = !playing)}
    onTune={() => {
      showSystems = false;
      tuneOpen = !tuneOpen;
    }}
    systemsOpen={showSystems}
    onSystems={() => {
      tuneOpen = false;
      showSystems = !showSystems;
      if (showSystems && !catalog) send({ type: 'catalog' });
    }}
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
  /* One glass bar: back, where you are, and what you can do here. */
  .crumbs {
    --nav-ink: #e9ecf6;
    --nav-accent: #ffd9a0;
    --nav-edge: rgb(233 236 246 / 0.14);
    position: absolute;
    top: 3.4rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 6;
    display: flex;
    align-items: center;
    gap: 0.25rem;
    max-width: calc(100% - 2rem);
    padding: 0.3rem;
    border-radius: 999px;
    border: 1px solid var(--nav-edge);
    background: rgb(10 12 20 / 0.58);
    backdrop-filter: blur(16px) saturate(150%);
    box-shadow:
      0 12px 34px rgb(0 0 0 / 0.32),
      inset 0 1px 0 rgb(255 255 255 / 0.07);
    color: var(--nav-ink);
    transition: opacity 200ms ease;
  }
  .crumbs.dim {
    opacity: 0.6;
  }
  .nav-back,
  .nav-action,
  .help {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    flex-shrink: 0;
    height: 2.5rem;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }
  .nav-back,
  .help {
    width: 2.5rem;
  }
  .nav-back {
    background: rgb(255 255 255 / 0.07);
  }
  .nav-action {
    padding-inline: 0.85rem;
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    border: 1px solid var(--nav-edge);
  }
  .nav-back:hover:not(:disabled),
  .nav-action:hover,
  .nav-action[aria-expanded='true'],
  .help:hover {
    background: rgb(255 255 255 / 0.12);
    color: var(--nav-accent);
  }
  .nav-back:focus-visible,
  .nav-action:focus-visible,
  .help:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--nav-accent) 70%, transparent);
    outline-offset: 2px;
  }
  .nav-back:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .trail {
    display: flex;
    align-items: baseline;
    gap: 0.6rem;
    min-width: 0;
    padding-inline: 0.55rem 0.7rem;
    white-space: nowrap;
  }
  .path {
    font-size: 0.68rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgb(233 236 246 / 0.5);
  }
  .sep {
    margin-inline: 0.45rem;
    color: rgb(233 236 246 / 0.28);
  }
  .here {
    display: flex;
    align-items: baseline;
    gap: 0.55rem;
    min-width: 0;
  }
  .here b {
    font-size: 0.92rem;
    font-weight: 650;
    letter-spacing: 0.06em;
    color: var(--nav-accent);
  }
  .here small {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.72rem;
    color: rgb(233 236 246 / 0.62);
  }
  .help {
    position: relative;
    color: rgb(233 236 246 / 0.75);
    cursor: help;
  }
  .tip {
    position: absolute;
    top: calc(100% + 0.6rem);
    right: -0.3rem;
    width: max-content;
    max-width: min(30rem, calc(100vw - 2rem));
    padding: 0.5rem 0.85rem;
    border-radius: 0.7rem;
    border: 1px solid var(--nav-edge);
    background: rgb(10 12 20 / 0.86);
    backdrop-filter: blur(12px);
    color: var(--nav-ink);
    font-size: 0.72rem;
    line-height: 1.5;
    white-space: normal;
    text-align: left;
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
    top: 7rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 6;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr));
    gap: 0.3rem;
    width: min(40rem, calc(100% - 2rem));
    margin: 0;
    padding: 0.4rem;
    border-radius: 1rem;
    border: 1px solid rgb(233 236 246 / 0.14);
    background: rgb(10 12 20 / 0.62);
    backdrop-filter: blur(16px) saturate(150%);
    box-shadow: 0 12px 34px rgb(0 0 0 / 0.32);
    list-style: none;
  }
  .planet-list button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    min-height: 44px;
    padding: 0.4rem 0.7rem;
    border: 0;
    border-radius: 0.65rem;
    background: transparent;
    color: #e9ecf6;
    font: inherit;
    font-size: 0.72rem;
    text-align: left;
    cursor: pointer;
    transition: background-color 150ms ease;
  }
  .planet-list button:hover,
  .planet-list button:focus-visible {
    background: rgb(255 255 255 / 0.09);
    outline: none;
  }
  .planet-list b {
    color: #ffd9a0;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .planet-list span {
    color: rgb(233 236 246 / 0.62);
  }
  .systems-panel {
    position: absolute;
    top: 3.6rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 6;
    width: min(40rem, calc(100% - 2rem));
    /* Ends above the dock (5.4rem from the bottom, 2.6rem tall). */
    max-height: calc(100% - 12.8rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.4rem;
    border-radius: 1rem;
    border: 1px solid rgb(233 236 246 / 0.14);
    background: rgb(10 12 20 / 0.66);
    backdrop-filter: blur(16px) saturate(150%);
    box-shadow: 0 12px 34px rgb(0 0 0 / 0.32);
    scrollbar-width: thin;
  }
  .systems-panel .planet-list {
    position: static;
    transform: none;
    width: 100%;
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none;
    backdrop-filter: none;
  }
  .systems-loading {
    margin: 0.6rem 0.8rem;
    color: rgb(233 236 246 / 0.7);
    font-size: 0.75rem;
  }
  .status {
    position: absolute;
    bottom: 9.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 7;
    margin: 0;
    padding: 0.45rem 1rem;
    border-radius: 999px;
    border: 1px solid rgb(233 236 246 / 0.14);
    background: rgb(10 12 20 / 0.58);
    backdrop-filter: blur(16px);
    color: #e9ecf6;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    pointer-events: none;
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
      gap: 0.15rem;
    }
    .path {
      display: none;
    }
    .here {
      flex-direction: column;
      gap: 0;
    }
    .here b {
      font-size: 0.82rem;
    }
    .here small {
      font-size: 0.66rem;
    }
    .nav-action span {
      display: none;
    }
    .nav-action {
      width: 2.5rem;
      padding: 0;
    }
  }
</style>
