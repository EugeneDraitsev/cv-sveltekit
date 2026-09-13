<script lang="ts">
  import './three.css';
  import { Canvas } from '@threlte/core';
  import type { Component, ComponentProps } from 'svelte';
  import { onDestroy, untrack } from 'svelte';
  import RenderBudget from './RenderBudget.svelte';
  import FlightInstrument from './FlightInstrument.svelte';
  import { getSceneQuality } from './quality';

  import GalaxyControls from './GalaxyControls.svelte';
  import PlanetTouchControls from './PlanetTouchControls.svelte';
  import type GalaxyDebugPanelType from './GalaxyDebugPanel.svelte';
  import type SystemSceneType from './SystemScene.svelte';
  import type PlanetSceneType from './PlanetScene.svelte';
  import Scene from './Scene.svelte';
  import HeroHud from './HeroHud.svelte';
  import {
    parameters,
    regenerateGalaxy,
    setGalaxyColors,
    setNebulaColors,
    clearColorOverrides,
  } from './galaxy.utils.svelte';
  import { getStarSystem, hexCss, lightenHex, darkenHex, type StarSystemData } from './starSystem';
  import { hideHud } from './hud.svelte';
  import { prefersReducedMotion } from './cameraTween';
  import { colorToHex, createParamsSnapshot, DEFAULT_CAMERA } from '$lib/utils';
  import type { CameraParams, GalaxyParams, HeroMode } from '$lib/types/threlte.types';

  const reduceMotion = prefersReducedMotion();
  const quality = getSceneQuality();
  let isPlaying = $state(!reduceMotion);
  let isExpanded = $state(false);
  let isDebugOpen = $state(false);
  let rootElement = $state<HTMLElement>();
  let isSceneVisible = $state(true);
  let pageVisible = $state(!document.hidden);
  let mode = $state<HeroMode>('overview');
  let phase = $state<'idle' | 'warping'>('idle');
  let travelLabel = $state('');
  let travelError = $state('');
  const sceneActive = $derived(isSceneVisible && pageVisible && (phase === 'warping' || isPlaying));
  let currentSystem = $state<StarSystemData | null>(null);
  let currentPlanetIndex = $state<number | null>(null);
  let warpTargetIndex = $state<number | null>(null);
  let returnFromIndex = $state<number | null>(null);
  let approachPlanetIndex = $state<number | null>(null);
  let systemEntry = $state<'warp' | 'return' | 'fromPlanet'>('warp');
  let returnPlanetIndex = $state<number | null>(null);
  let systemDeparting = $state(false);
  let planetEntry = $state<'descend' | 'rest'>('descend');
  let planetDeparting = $state(false);
  const currentPlanet = $derived(
    currentSystem && currentPlanetIndex != null ? currentSystem.planets[currentPlanetIndex] : null,
  );
  const touchQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
  let isTouch = $state(touchQuery.matches);
  let overlayOpacity = $state(0);
  let overlayBackground = $state('transparent');
  let veilColorCache: number | null = null;

  function driveVeil(opacity: number, colorHex: number) {
    if (phase !== 'warping') return;
    if (colorHex !== veilColorCache) {
      veilColorCache = colorHex;
      overlayBackground = `radial-gradient(ellipse at center, ${hexCss(lightenHex(colorHex, 0.25))}, ${hexCss(darkenHex(colorHex, 0.35))})`;
    }
    overlayOpacity = Math.min(1, Math.max(0, opacity));
  }

  // Each scene reports the actual end of its flight. A slow frame or a hidden
  // tab cannot cut an unfinished move, and controls stay locked until arrival.
  type Leg = 'departure' | 'arrival';
  let pending: { leg: Leg; resolve: (finished: boolean) => void } | undefined;
  let alive = true;
  function waitForLeg(leg: Leg) {
    return new Promise<boolean>((resolve) => {
      pending = { leg, resolve };
    });
  }
  function finishLeg(leg: Leg) {
    if (pending?.leg !== leg) return;
    const done = pending.resolve;
    pending = undefined;
    done(true);
  }
  const onDeparted = () => finishLeg('departure');
  const onArrived = () => finishLeg('arrival');
  onDestroy(() => {
    alive = false;
    pending?.resolve(false);
    pending = undefined;
  });

  async function journey(
    label: string,
    load: () => Promise<void>,
    depart: () => void,
    arrive: () => void,
  ) {
    phase = 'warping';
    travelLabel = label;
    travelError = '';
    isDebugOpen = false;
    hideHud();
    try {
      // Fetch the next scene before takeoff; don't park the visitor in a flash
      // while a slow connection downloads shaders and geometry code.
      await load();
      if (!alive) return;
      if (!reduceMotion) {
        const departure = waitForLeg('departure');
        depart();
        if (!(await departure)) return;
      }
      const arrival = reduceMotion ? Promise.resolve(true) : waitForLeg('arrival');
      arrive();
      if (!(await arrival) || !alive) return;
    } catch (error) {
      console.error('Unable to prepare the next scene', error);
      travelError = 'Could not load this destination.';
    } finally {
      if (alive) {
        overlayOpacity = 0;
        warpTargetIndex = null;
        approachPlanetIndex = null;
        systemDeparting = false;
        planetDeparting = false;
        phase = 'idle';
      }
    }
  }

  function travelToSystem(index: number) {
    if (phase !== 'idle' || mode !== 'overview') return;
    const destination = getStarSystem(index);
    void journey(
      'Approaching ' + destination.name,
      ensureSystemScene,
      () => {
        warpTargetIndex = index;
      },
      () => {
        currentSystem = destination;
        returnFromIndex = null;
        returnPlanetIndex = null;
        systemEntry = reduceMotion ? 'return' : 'warp';
        mode = 'system';
      },
    );
  }

  function travelToPlanet(index: number) {
    if (phase !== 'idle' || mode !== 'system' || !currentSystem) return;
    const destination = currentSystem.planets[index];
    if (!destination) return;
    void journey(
      'Descending to ' + destination.name,
      ensurePlanetScene,
      () => {
        approachPlanetIndex = index;
      },
      () => {
        currentPlanetIndex = index;
        planetEntry = reduceMotion ? 'rest' : 'descend';
        mode = 'planet';
      },
    );
  }

  function backToSystem() {
    if (phase !== 'idle' || mode !== 'planet' || !currentSystem) return;
    void journey(
      'Returning to orbit',
      ensureSystemScene,
      () => {
        planetDeparting = true;
      },
      () => {
        returnPlanetIndex = currentPlanetIndex;
        currentPlanetIndex = null;
        systemEntry = reduceMotion ? 'return' : 'fromPlanet';
        mode = 'system';
      },
    );
  }

  function backToGalaxy() {
    if (phase !== 'idle' || mode !== 'system' || !currentSystem) return;
    const seed = currentSystem.seed;
    void journey(
      'Returning to the galaxy',
      () => Promise.resolve(),
      () => {
        systemDeparting = true;
      },
      () => {
        returnFromIndex = reduceMotion ? null : seed;
        currentSystem = null;
        currentPlanetIndex = null;
        mode = 'overview';
      },
    );
  }

  function onJourneyKey(event: KeyboardEvent) {
    if (event.code !== 'Escape' || phase !== 'idle') return;
    if (isDebugOpen) isDebugOpen = false;
    else if (mode === 'planet') backToSystem();
    else if (mode === 'system') backToGalaxy();
    else isExpanded = false;
  }

  $effect(() => {
    const syncTouch = () => {
      isTouch = touchQuery.matches;
    };
    const syncPage = () => {
      pageVisible = !document.hidden;
    };
    touchQuery.addEventListener('change', syncTouch);
    document.addEventListener('visibilitychange', syncPage);
    return () => {
      touchQuery.removeEventListener('change', syncTouch);
      document.removeEventListener('visibilitychange', syncPage);
    };
  });

  // The debug panel pulls in svelte-tweakpane-ui (~heavy). Load it on demand only
  // when the visitor actually opens the controls, keeping it out of the main 3D chunk.
  let DebugPanel = $state<Component<ComponentProps<typeof GalaxyDebugPanelType>>>();
  let SystemScene = $state<Component<ComponentProps<typeof SystemSceneType>>>();
  let PlanetScene = $state<Component<ComponentProps<typeof PlanetSceneType>>>();
  let systemSceneLoad: Promise<void> | undefined;
  let planetSceneLoad: Promise<void> | undefined;

  function ensureSystemScene() {
    systemSceneLoad ??= import('./SystemScene.svelte')
      .then((m) => {
        SystemScene = m.default;
      })
      .catch((error) => {
        systemSceneLoad = undefined;
        throw error;
      });
    return systemSceneLoad;
  }

  function ensurePlanetScene() {
    planetSceneLoad ??= import('./PlanetScene.svelte')
      .then((m) => {
        PlanetScene = m.default;
      })
      .catch((error) => {
        planetSceneLoad = undefined;
        throw error;
      });
    return planetSceneLoad;
  }

  $effect(() => {
    if (isDebugOpen && !DebugPanel) {
      import('./GalaxyDebugPanel.svelte').then((m) => (DebugPanel = m.default));
    }
  });

  $effect(() => {
    if (!rootElement || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isSceneVisible = entry?.isIntersecting ?? true;
      },
      { threshold: 0.01 },
    );

    observer.observe(rootElement);

    return () => observer.disconnect();
  });

  // Galaxy & Camera State
  let galaxy = $state<GalaxyParams>({ ...parameters });
  let camera = $state<CameraParams>({ ...DEFAULT_CAMERA });
  let version = $state(0);

  // Color hex values for UI
  let colors = $state({
    galaxyInner: colorToHex(parameters.galaxyInsideColor),
    galaxyOuter: colorToHex(parameters.galaxyOutsideColor),
    nebulaInner: colorToHex(parameters.nebulaInsideColor),
    nebulaOuter: colorToHex(parameters.nebulaOutsideColor),
  });

  // Effect: Sync galaxy params → regenerate when structural params change
  let prevSnapshot = untrack(() => createParamsSnapshot(galaxy));

  $effect(() => {
    Object.assign(parameters, galaxy);

    const snapshot = createParamsSnapshot(galaxy);
    if (snapshot !== prevSnapshot) {
      regenerateGalaxy();
      version++;
      prevSnapshot = snapshot;
    }
  });

  // Handlers
  function regenerate() {
    regenerateGalaxy();
    version++;
  }

  function applyColors() {
    setGalaxyColors(colors.galaxyInner, colors.galaxyOuter);
    setNebulaColors(colors.nebulaInner, colors.nebulaOuter);
  }

  function resetColors() {
    clearColorOverrides();
    colors = {
      galaxyInner: colorToHex(parameters.galaxyInsideColor),
      galaxyOuter: colorToHex(parameters.galaxyOutsideColor),
      nebulaInner: colorToHex(parameters.nebulaInsideColor),
      nebulaOuter: colorToHex(parameters.nebulaOutsideColor),
    };
  }
</script>

<svelte:window onkeydown={onJourneyKey} />

<div
  data-mode={mode}
  data-travelling={phase !== 'idle'}
  bind:this={rootElement}
  class="threlte-app theme-grayscale relative overflow-hidden transition-all duration-200"
  style:height={isExpanded ? '100dvh' : 'var(--galaxy-height)'}
>
  <Canvas dpr={[0.75, quality.maxDpr]} shadows={false}>
    <RenderBudget active={sceneActive} travelling={phase === 'warping'} />
    {#if mode === 'planet' && currentSystem && currentPlanet && PlanetScene}
      <PlanetScene
        animationActive={sceneActive}
        system={currentSystem}
        planet={currentPlanet}
        entry={planetEntry}
        departing={planetDeparting}
        onVeil={driveVeil}
        {onDeparted}
        {onArrived}
      />
    {:else if mode === 'system' && currentSystem && SystemScene}
      <SystemScene
        animationActive={sceneActive}
        worldActive={isPlaying && phase === 'idle'}
        system={currentSystem}
        entry={systemEntry}
        {returnPlanetIndex}
        {approachPlanetIndex}
        departing={systemDeparting}
        onVeil={driveVeil}
        {onDeparted}
        {onArrived}
        onSelectPlanet={travelToPlanet}
      />
    {:else}
      <Scene
        animationActive={sceneActive}
        worldActive={isPlaying && phase === 'idle'}
        cameraFov={camera.fov}
        cameraPosition={[camera.positionX, camera.positionY, camera.positionZ]}
        cameraDistance={camera.distance}
        particleSize={galaxy.particleSize}
        nebulaIntensity={galaxy.nebulaIntensity}
        regenVersion={version}
        {warpTargetIndex}
        {returnFromIndex}
        onVeil={driveVeil}
        {onDeparted}
        {onArrived}
        onSelectSystem={travelToSystem}
      />
    {/if}
  </Canvas>

  <HeroHud />
  {#if mode === 'planet' && phase === 'idle'}
    <FlightInstrument />
  {/if}

  {#if isDebugOpen && mode === 'overview' && DebugPanel}
    <DebugPanel
      bind:galaxyParams={galaxy}
      bind:cameraParams={camera}
      bind:galaxyInsideHex={colors.galaxyInner}
      bind:galaxyOutsideHex={colors.galaxyOuter}
      bind:nebulaInsideHex={colors.nebulaInner}
      bind:nebulaOutsideHex={colors.nebulaOuter}
      onRegenerate={regenerate}
      onSetColors={applyColors}
      onResetColors={resetColors}
    />
  {/if}

  <!-- Journey breadcrumb: where you are + the way back. -->
  {#if mode === 'system' && currentSystem}
    <div class="hero-journey-overlay">
      <button class="hero-journey-btn" onclick={backToGalaxy} disabled={phase !== 'idle'}>
        ← Galaxy
      </button>
      <span class="hero-journey-chip">
        {currentSystem.name}
        <span class="hero-journey-dim">· {currentSystem.subtitle}</span>
      </span>
    </div>
  {:else if mode === 'planet' && currentSystem && currentPlanet}
    <div class="hero-journey-overlay">
      <button class="hero-journey-btn" onclick={backToSystem} disabled={phase !== 'idle'}>
        ← {currentSystem.name}
      </button>
      <span class="hero-journey-chip">
        {currentPlanet.name}
        <span class="hero-journey-dim">
          · {currentPlanet.archetypeLabel} · {currentPlanet.surface.biomes.length} biomes
        </span>
      </span>
      {#if !isTouch}
        <button
          class="hero-flight-help"
          type="button"
          aria-label="Flight controls: WASD fly, Space up, C down, Shift boost, drag look, Escape back"
        >
          <span class="hero-flight-badge" aria-hidden="true">?</span>
          <span class="hero-flight-tip" role="tooltip">
            WASD — fly · Space / C — up / down · Shift — boost · drag — look · Esc — back
          </span>
        </button>
      {/if}
    </div>
  {/if}

  <!-- Touch flight controls: joystick + climb/boost, touch devices only. -->
  {#if mode === 'planet' && isTouch && phase === 'idle'}
    <PlanetTouchControls />
  {/if}

  <!-- Warp flash: tinted by the destination, hides the scene swap. -->
  <div
    class="warp-overlay"
    class:blocking={overlayOpacity > 0}
    style:opacity={overlayOpacity}
    style:background={overlayBackground}
    aria-hidden="true"
  ></div>

  {#if phase === 'warping' || travelError}
    <div class="journey-status" role="status">
      {phase === 'warping' ? travelLabel : travelError}
      {#if travelError}
        <button class="journey-retry" onclick={() => location.reload()}>Reload to try again</button>
      {/if}
    </div>
  {/if}

  <GalaxyControls
    expanded={isExpanded}
    animationActive={isPlaying}
    showSettings={mode === 'overview'}
    settingsOpen={isDebugOpen}
    busy={phase !== 'idle'}
    onDark={mode !== 'overview'}
    onToggleExpanded={() => (isExpanded = !isExpanded)}
    onToggleAnimation={() => (isPlaying = !isPlaying)}
    onToggleControls={() => (isDebugOpen = !isDebugOpen)}
  />
</div>

<style>
  .journey-status {
    position: absolute;
    bottom: 9.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 7;
    color: var(--color-identifier);
    background: color-mix(in srgb, var(--color-base-100) 85%, transparent);
    border-radius: 999px;
    padding: 0.4rem 0.85rem;
    font-size: 0.75rem;
    text-align: center;
    pointer-events: none;
  }
  .journey-retry {
    display: block;
    margin-inline: auto;
    min-height: 44px;
    color: inherit;
    text-decoration: underline;
    cursor: pointer;
    pointer-events: auto;
  }
  .threlte-app[data-travelling='true'] :global(canvas) {
    pointer-events: none;
  }

  .hero-journey-overlay {
    position: absolute;
    top: 3.4rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    pointer-events: none;
    max-width: calc(100% - 2rem);
  }

  /* Theme-aware chrome: follows the site palette on both themes, matching
     the pre-journey look of main. */
  .hero-journey-btn {
    pointer-events: auto;
    min-height: 44px;
    flex-shrink: 0;
    cursor: pointer;
    padding: 0.4rem 0.9rem;
    border-radius: 0.5rem;
    border: 1px solid color-mix(in srgb, var(--color-identifier) 30%, transparent);
    background: color-mix(in srgb, var(--color-base-100) 70%, transparent);
    color: var(--color-identifier);
    font-size: 0.85rem;
    white-space: nowrap;
    backdrop-filter: blur(8px);
    transition:
      transform 160ms ease,
      background-color 160ms ease,
      box-shadow 160ms ease,
      opacity 160ms ease;
  }

  .hero-journey-btn:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-identifier) 12%, var(--color-base-100) 70%);
    box-shadow: 0 0 18px color-mix(in srgb, var(--color-primary) 25%, transparent);
    transform: translateY(-1px);
  }

  .hero-journey-btn:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .hero-journey-chip {
    min-width: 0;
    padding: 0.4rem 0.9rem;
    border-radius: 0.5rem;
    border: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
    background: color-mix(in srgb, var(--color-base-100) 70%, transparent);
    color: var(--color-primary);
    font-size: 0.85rem;
    letter-spacing: 0.05em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    backdrop-filter: blur(8px);
  }

  .hero-journey-dim {
    color: color-mix(in srgb, var(--color-identifier) 65%, transparent);
    letter-spacing: 0.02em;
  }

  /* Desktop-only flight hint. Keep the scene clean until the visitor asks. */
  .hero-flight-help {
    position: relative;
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--color-identifier) 22%, transparent);
    background: color-mix(in srgb, var(--color-base-100) 60%, transparent);
    color: color-mix(in srgb, var(--color-identifier) 70%, transparent);
    padding: 0;
    font: inherit;
    font-size: 0.85rem;
    line-height: 1;
    pointer-events: auto;
    cursor: help;
    backdrop-filter: blur(6px);
    transition:
      color 160ms ease,
      border-color 160ms ease,
      background-color 160ms ease;
  }

  .hero-flight-help:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--color-primary) 70%, transparent);
    outline-offset: 3px;
  }

  .hero-flight-badge {
    pointer-events: none;
  }

  .hero-flight-tip {
    position: absolute;
    top: calc(100% + 0.45rem);
    right: 0;
    z-index: 1;
    width: max-content;
    max-width: min(30rem, calc(100vw - 2rem));
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--color-identifier) 18%, transparent);
    background: color-mix(in srgb, var(--color-base-100) 66%, transparent);
    color: color-mix(in srgb, var(--color-identifier) 80%, transparent);
    font-size: 0.72rem;
    letter-spacing: 0.06em;
    white-space: nowrap;
    backdrop-filter: blur(6px);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transform: translateY(-0.25rem);
    transition:
      opacity 140ms ease,
      transform 140ms ease,
      visibility 140ms ease;
  }

  .hero-flight-help:hover .hero-flight-tip,
  .hero-flight-help:focus-visible .hero-flight-tip {
    opacity: 1;
    visibility: visible;
    transform: translateY(0);
  }

  .hero-flight-help:hover,
  .hero-flight-help:focus-visible {
    background: color-mix(in srgb, var(--color-base-100) 78%, transparent);
    color: color-mix(in srgb, var(--color-primary) 85%, transparent);
    border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
  }

  .warp-overlay {
    position: absolute;
    inset: 0;
    z-index: 6;
    opacity: 0;
    pointer-events: none;
    transition-property: opacity;
    transition-timing-function: ease-in-out;
  }

  .warp-overlay.blocking {
    pointer-events: auto;
  }
</style>
