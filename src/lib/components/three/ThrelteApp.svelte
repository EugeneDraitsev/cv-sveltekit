<script lang="ts">
  import { Canvas } from '@threlte/core';

  import GalaxyControls from './GalaxyControls.svelte';
  import GalaxyDebugPanel from './GalaxyDebugPanel.svelte';
  import Scene from './Scene.svelte';
  import {
    parameters,
    regenerateGalaxy,
    setGalaxyColors,
    setNebulaColors,
    clearColorOverrides,
  } from './galaxy.utils.svelte';
  import { colorToHex, createParamsSnapshot, DEFAULT_CAMERA } from '$lib/utils';
  import type { CameraParams, GalaxyParams } from '$lib/types/threlte.types';

  import { untrack } from 'svelte';

  // Props
  const { interactiveAnimation = false } = $props();

  // UI State
  let isPlaying = $derived(!interactiveAnimation);
  let isExpanded = $state(false);
  let isDebugOpen = $state(false);
  let containerRef = $state<HTMLDivElement>();

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
    <Scene
      animationActive={isPlaying}
      cameraFov={camera.fov}
      cameraPosition={[camera.positionX, camera.positionY, camera.positionZ]}
      cameraDistance={camera.distance}
      particleSize={galaxy.particleSize}
      nebulaIntensity={galaxy.nebulaIntensity}
      regenVersion={version}
    />
  </Canvas>

  {#if isDebugOpen}
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
  {/if}

  <GalaxyControls
    expanded={isExpanded}
    animationActive={isPlaying}
    onToggleExpanded={() => (isExpanded = !isExpanded)}
    onToggleAnimation={() => (isPlaying = !isPlaying)}
    onToggleControls={() => (isDebugOpen = !isDebugOpen)}
  />
</div>
