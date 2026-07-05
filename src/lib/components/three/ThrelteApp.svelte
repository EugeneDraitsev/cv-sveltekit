<script lang="ts">
  import { Canvas } from '@threlte/core';
  import type { Component, ComponentProps } from 'svelte';
  import { untrack } from 'svelte';

  import GalaxyControls from './GalaxyControls.svelte';
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

  // UI State — the scene only mounts after the visitor interacts, so play immediately.
  let isPlaying = $state(true);
  let isExpanded = $state(false);
  let isDebugOpen = $state(false);
  let rootElement = $state<HTMLElement>();
  let isSceneVisible = $state(true);

  // ─── Hero journey state ────────────────────────────────────────────────
  // galaxy overview → warp into a star system → land on one of its planets.
  let mode = $state<HeroMode>('overview');
  let phase = $state<'idle' | 'warping'>('idle');
  const sceneActive = $derived(phase === 'warping' || (isPlaying && isSceneVisible));
  let currentSystem = $state<StarSystemData | null>(null);
  let currentPlanetIndex = $state<number | null>(null);
  /** While set, the galaxy scene dives the camera toward this system. */
  let warpTargetIndex = $state<number | null>(null);
  /** Set on return: the galaxy scene pulls back out of this system's star. */
  let returnFromIndex = $state<number | null>(null);
  /** While set, the system scene glides the camera toward this planet. */
  let approachPlanetIndex = $state<number | null>(null);
  /** How the system scene mounts: warp arrival / pull-back / at rest. */
  let systemEntry = $state<'warp' | 'return' | 'fromPlanet'>('warp');
  /** Planet the system scene pulls back from (systemEntry === 'fromPlanet'). */
  let returnPlanetIndex = $state<number | null>(null);
  /** System scene dives into its star before cutting back to the galaxy. */
  let systemDeparting = $state(false);
  /** Planet scene: atmospheric-entry descent vs mounting mid-flight. */
  let planetEntry = $state<'descend' | 'rest'>('descend');
  /** Planet scene climbs out before cutting back to the system. */
  let planetDeparting = $state(false);

  const currentPlanet = $derived(
    currentSystem && currentPlanetIndex != null ? currentSystem.planets[currentPlanetIndex] : null,
  );

  // ─── Warp flash overlay ────────────────────────────────────────────────
  // A radial flash tinted by the destination (star color / planet atmosphere)
  // hides the scene swap so the two camera moves read as one continuous dive.
  let overlayOpacity = $state(0);
  let overlayBackground = $state('transparent');
  let overlayDuration = $state(400);

  const reduceMotion = prefersReducedMotion();
  // Flight keys (WASD / Space / Shift) only apply on desktop, so the controls
  // hint is desktop-only; touch just drags to look.
  const isDesktop =
    typeof window !== 'undefined' && !window.matchMedia('(max-width: 768px)').matches;
  let seq = 0;
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  function overlayShow(colorHex: number, ms: number) {
    const core = hexCss(lightenHex(colorHex, 0.6));
    const mid = hexCss(colorHex);
    const edge = hexCss(darkenHex(colorHex, 0.55));
    overlayBackground = `radial-gradient(circle at 50% 42%, ${core} 0%, ${mid} 46%, ${edge} 100%)`;
    overlayDuration = ms;
    overlayOpacity = 1;
  }

  /**
   * Cover the frame INSTANTLY. Used at the cut point of the seamless dives:
   * by then the motion-locked veil has already saturated to the same color,
   * so the snap is invisible — the overlay only bridges the swap and then
   * dissolves over the incoming scene.
   */
  function overlaySnap(colorHex: number) {
    overlayShow(colorHex, 0);
  }

  function overlayHide(ms: number) {
    overlayDuration = ms;
    overlayOpacity = 0;
  }

  // ─── Motion-locked veil ────────────────────────────────────────────────
  // Outgoing scenes drive the overlay opacity per frame from their own
  // flight progress (dive into glare, plunge into atmosphere, climb into
  // haze), so the cover IS the motion — not a timed curtain.
  let veilColorCache: number | null = null;

  function driveVeil(opacity: number, colorHex: number) {
    if (phase !== 'warping') return;
    if (colorHex !== veilColorCache) {
      veilColorCache = colorHex;
      const core = hexCss(lightenHex(colorHex, 0.6));
      const mid = hexCss(colorHex);
      const edge = hexCss(darkenHex(colorHex, 0.55));
      overlayBackground = `radial-gradient(circle at 50% 42%, ${core} 0%, ${mid} 46%, ${edge} 100%)`;
    }
    overlayDuration = 0;
    overlayOpacity = Math.min(1, Math.max(0, opacity));
  }

  /**
   * After a cut, the INCOMING scene dissolves the veil from its own entry
   * motion. Wait it out, then sweep up any residue (e.g. the tab got
   * backgrounded mid-transition) so the overlay can never stick.
   */
  async function settleVeil(my: number, ms: number): Promise<boolean> {
    await sleep(ms);
    if (my !== seq) return false;
    if (overlayOpacity > 0.04) {
      overlayHide(250);
      await sleep(260);
      if (my !== seq) return false;
    }
    return true;
  }

  async function travelToSystem(index: number) {
    if (phase !== 'idle' || mode !== 'overview') return;
    const my = ++seq;
    const system = getStarSystem(index);
    const loadSystemScene = ensureSystemScene();
    phase = 'warping';
    isDebugOpen = false;
    hideHud();
    currentSystem = system;
    returnFromIndex = null;
    returnPlanetIndex = null;

    if (reduceMotion) {
      overlayShow(system.starColor, 200);
      await sleep(210);
      if (my !== seq) return;
      await loadSystemScene;
      if (my !== seq) return;
      mode = 'system';
      systemEntry = 'return';
      await sleep(160);
      if (my !== seq) return;
      overlayHide(500);
      await sleep(500);
      if (my !== seq) return;
      phase = 'idle';
      return;
    }

    // Dive: the camera accelerates into the star while its glow swells to
    // fill the frame; the scene drives the veil to 1 over the last stretch,
    // and we cut at the moment of "impact" — already fully covered.
    warpTargetIndex = index;
    await sleep(1490);
    if (my !== seq) return;

    overlaySnap(system.starColor); // safety: guarantee full cover at the cut
    await sleep(30);
    if (my !== seq) return;
    await loadSystemScene;
    if (my !== seq) return;

    mode = 'system';
    systemEntry = 'warp';
    warpTargetIndex = null;
    // The system scene dissolves the glare from its own arrival motion.
    if (!(await settleVeil(my, 950))) return;
    phase = 'idle';
  }

  async function travelToPlanet(planetIndex: number) {
    if (phase !== 'idle' || mode !== 'system' || !currentSystem) return;
    const planet = currentSystem.planets[planetIndex];
    if (!planet) return;
    const my = ++seq;
    const loadPlanetScene = ensurePlanetScene();
    phase = 'warping';
    hideHud();
    returnPlanetIndex = null;

    if (reduceMotion) {
      overlayShow(planet.atmosphereColor, 200);
      await sleep(210);
      if (my !== seq) return;
      await loadPlanetScene;
      if (my !== seq) return;
      currentPlanetIndex = planetIndex;
      planetEntry = 'rest';
      mode = 'planet';
      await sleep(160);
      if (my !== seq) return;
      overlayHide(500);
      await sleep(500);
      if (my !== seq) return;
      phase = 'idle';
      return;
    }

    // Glide until the planet fills the frame, then keep plunging: the scene
    // drives the veil toward the planet's surface FOG color while the camera
    // skims the sphere, and the flyover starts inside identical haze — an
    // atmospheric entry with no visible seam.
    approachPlanetIndex = planetIndex;
    await sleep(1780);
    if (my !== seq) return;

    overlaySnap(planet.surface.fogColor); // safety: full cover at the cut
    await sleep(30);
    if (my !== seq) return;
    await loadPlanetScene;
    if (my !== seq) return;

    currentPlanetIndex = planetIndex;
    planetEntry = 'descend';
    mode = 'planet';
    approachPlanetIndex = null;
    // The flyover dissolves the haze as the camera sinks to flight level.
    if (!(await settleVeil(my, 1000))) return;
    phase = 'idle';
  }

  async function backToSystem() {
    if (phase !== 'idle' || mode !== 'planet' || !currentSystem) return;
    const my = ++seq;
    const haze = currentPlanet?.surface.fogColor ?? 0x11131f;
    const loadSystemScene = ensureSystemScene();
    phase = 'warping';
    hideHud();

    if (!reduceMotion) {
      planetDeparting = true; // climb back up into the haze (drives the veil)
      await sleep(860);
      if (my !== seq) return;
    }

    overlaySnap(haze);
    await sleep(30);
    if (my !== seq) return;
    await loadSystemScene;
    if (my !== seq) return;

    mode = 'system';
    systemEntry = reduceMotion ? 'return' : 'fromPlanet';
    returnPlanetIndex = currentPlanetIndex;
    currentPlanetIndex = null;
    planetDeparting = false;
    if (reduceMotion) {
      await sleep(180);
      if (my !== seq) return;
      overlayHide(500);
      await sleep(500);
      if (my !== seq) return;
      phase = 'idle';
      return;
    }
    // The system scene dissolves the haze while pulling back from the planet.
    if (!(await settleVeil(my, 1000))) return;
    phase = 'idle';
  }

  async function backToGalaxy() {
    if (phase !== 'idle' || mode !== 'system' || !currentSystem) return;
    const my = ++seq;
    const star = currentSystem;
    phase = 'warping';
    hideHud();

    if (!reduceMotion) {
      systemDeparting = true; // accelerate away — system shrinks behind us
      await sleep(920);
      if (my !== seq) return;
    }

    overlaySnap(lightenHex(star.starColor, 0.15));
    await sleep(30);
    if (my !== seq) return;

    returnFromIndex = reduceMotion ? null : star.seed;
    mode = 'overview';
    systemDeparting = false;
    currentSystem = null;
    currentPlanetIndex = null;
    returnPlanetIndex = null;
    if (reduceMotion) {
      await sleep(180);
      if (my !== seq) return;
      overlayHide(500);
      await sleep(500);
      if (my !== seq) return;
      phase = 'idle';
      return;
    }
    // The galaxy scene dissolves the glare as it recedes from the star.
    if (!(await settleVeil(my, 1000))) return;
    phase = 'idle';
  }

  // The debug panel pulls in svelte-tweakpane-ui (~heavy). Load it on demand only
  // when the visitor actually opens the controls, keeping it out of the main 3D chunk.
  let DebugPanel = $state<Component<ComponentProps<typeof GalaxyDebugPanelType>>>();
  let SystemScene = $state<Component<ComponentProps<typeof SystemSceneType>>>();
  let PlanetScene = $state<Component<ComponentProps<typeof PlanetSceneType>>>();
  let systemSceneLoad: Promise<void> | undefined;
  let planetSceneLoad: Promise<void> | undefined;

  function ensureSystemScene() {
    systemSceneLoad ??= import('./SystemScene.svelte').then((m) => {
      SystemScene = m.default;
    });
    return systemSceneLoad;
  }

  function ensurePlanetScene() {
    planetSceneLoad ??= import('./PlanetScene.svelte').then((m) => {
      PlanetScene = m.default;
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

<div
  bind:this={rootElement}
  class="threlte-app theme-grayscale relative overflow-hidden transition-all duration-200"
  style:height={isExpanded ? '100dvh' : '540px'}
>
  <Canvas>
    {#if mode === 'planet' && currentSystem && currentPlanet}
      <PlanetScene
        animationActive={sceneActive}
        system={currentSystem}
        planet={currentPlanet}
        entry={planetEntry}
        departing={planetDeparting}
        onVeil={driveVeil}
      />
    {:else if mode === 'system' && currentSystem}
      <SystemScene
        animationActive={sceneActive}
        system={currentSystem}
        entry={systemEntry}
        {returnPlanetIndex}
        {approachPlanetIndex}
        departing={systemDeparting}
        onVeil={driveVeil}
        onSelectPlanet={travelToPlanet}
      />
    {:else}
      <Scene
        animationActive={sceneActive}
        cameraFov={camera.fov}
        cameraPosition={[camera.positionX, camera.positionY, camera.positionZ]}
        cameraDistance={camera.distance}
        particleSize={galaxy.particleSize}
        nebulaIntensity={galaxy.nebulaIntensity}
        regenVersion={version}
        {warpTargetIndex}
        {returnFromIndex}
        onVeil={driveVeil}
        onSelectSystem={travelToSystem}
      />
    {/if}
  </Canvas>

  <HeroHud />

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
      {#if isDesktop}
        <button
          class="hero-flight-help"
          type="button"
          aria-label="Flight controls: WASD fly, Space up, Shift boost, drag look"
        >
          <span class="hero-flight-badge" aria-hidden="true">?</span>
          <span class="hero-flight-tip" role="tooltip">
            WASD — fly&ensp;·&ensp;Space — up&ensp;·&ensp;Shift — boost&ensp;·&ensp;drag — look
          </span>
        </button>
      {/if}
    </div>
  {/if}

  <!-- Warp flash: tinted by the destination, hides the scene swap. -->
  <div
    class="warp-overlay"
    class:blocking={overlayOpacity > 0}
    style:opacity={overlayOpacity}
    style:background={overlayBackground}
    style:transition-duration="{overlayDuration}ms"
    aria-hidden="true"
  ></div>

  <GalaxyControls
    expanded={isExpanded}
    animationActive={isPlaying}
    showSettings={mode === 'overview'}
    onToggleExpanded={() => (isExpanded = !isExpanded)}
    onToggleAnimation={() => (isPlaying = !isPlaying)}
    onToggleControls={() => (isDebugOpen = !isDebugOpen)}
  />
</div>

<style>
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
    width: 1.7rem;
    height: 1.7rem;
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
