<script lang="ts">
  import { Canvas } from '@threlte/core';
  import { fade } from 'svelte/transition';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';

  import GalaxyControls from './GalaxyControls.svelte';
  import GalaxyDebugPanel from './GalaxyDebugPanel.svelte';
  import GeometricDebugPanel from './GeometricDebugPanel.svelte';
  import Galaxy from './Galaxy.svelte';
  import Geometric from './Geometric.svelte';
  import {
    parameters,
    regenerateGalaxy,
    setGalaxyColors,
    setNebulaColors,
    clearColorOverrides,
  } from './galaxy.utils.svelte';
  import { colorToHex, createParamsSnapshot, DEFAULT_CAMERA } from '$lib/utils';
  import type { CameraParams, GalaxyParams, GeometricParams } from '$lib/types/threlte.types';

  import { untrack } from 'svelte';

  // Props
  const { interactiveAnimation = false, scene = 'galaxy' } = $props<{
    interactiveAnimation?: boolean;
    scene?: 'galaxy' | 'geometric';
  }>();

  // UI State
  let isPlaying = $derived(!interactiveAnimation);
  let isExpanded = $state(false);
  let isDebugOpen = $derived(page.url.searchParams.get('debug') === 'true');
  let containerRef = $state<HTMLDivElement>();

  // Galaxy & Camera State
  let galaxy = $state<GalaxyParams>({ ...parameters });
  let geometricParams = $state<GeometricParams>({
    speed: 0.7,
    elevationScale: 2.4,
    noiseScale: 1.35,
    biomeThreshold: 0.2,
    wireframe: false,
    biome: -1,
    fogDist: 120,
    freeLook: false,
  });
  let camera = $state<CameraParams>({ ...DEFAULT_CAMERA });
  let version = $state(0);

  // Color hex values for UI
  let colors = $state({
    galaxyInner: colorToHex(parameters.galaxyInsideColor),
    galaxyOuter: colorToHex(parameters.galaxyOutsideColor),
    nebulaInner: colorToHex(parameters.nebulaInsideColor),
    nebulaOuter: colorToHex(parameters.nebulaOutsideColor),
  });

  function toggleDebug() {
    const newUrl = new URL(page.url);
    newUrl.searchParams.set('debug', (!isDebugOpen).toString());
    goto(newUrl, { replaceState: true, keepFocus: true, noScroll: true });
  }

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

  // Effect: Start animation on first user interaction
  $effect(() => {
    if (!containerRef || !interactiveAnimation) return;

    const events = ['scroll', 'mousemove', 'touchstart', 'click'] as const;
    const startAnimation = () => {
      isPlaying = true;
      events.forEach((e) => window.removeEventListener(e, startAnimation));
    };

    events.forEach((e) => window.addEventListener(e, startAnimation));
    return () => events.forEach((e) => window.removeEventListener(e, startAnimation));
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
  bind:this={containerRef}
  class="threlte-app theme-grayscale relative overflow-hidden transition-all duration-200"
  style:height={isExpanded ? '100dvh' : '540px'}
>
  <Canvas>
    {#if scene === 'galaxy'}
      <Galaxy
        animationActive={isPlaying}
        cameraFov={camera.fov}
        cameraPosition={[camera.positionX, camera.positionY, camera.positionZ]}
        cameraDistance={camera.distance}
        particleSize={galaxy.particleSize}
        nebulaIntensity={galaxy.nebulaIntensity}
        regenVersion={version}
      />
    {:else if scene === 'geometric'}
      <Geometric bind:params={geometricParams} animationActive={isPlaying} />
    {/if}
  </Canvas>

  {#if isDebugOpen}
    {#if scene === 'galaxy'}
      <div transition:fade={{ duration: 200 }}>
        <GalaxyDebugPanel
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
      </div>
    {:else if scene === 'geometric'}
      <div transition:fade={{ duration: 200 }} class="relative z-50">
        <GeometricDebugPanel bind:params={geometricParams} />
      </div>
    {/if}
  {/if}

  <GalaxyControls
    expanded={isExpanded}
    animationActive={isPlaying}
    showDebugButton={true}
    onToggleExpanded={() => (isExpanded = !isExpanded)}
    onToggleAnimation={() => (isPlaying = !isPlaying)}
    onToggleControls={toggleDebug}
  />
</div>
