<script lang="ts">
  import { Canvas } from '@threlte/core';
  import type { Component, ComponentProps } from 'svelte';

  import GalaxyControls from './GalaxyControls.svelte';
  import type GalaxyDebugPanelType from './GalaxyDebugPanel.svelte';
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

  // UI State — the scene only mounts after the visitor interacts, so play immediately.
  let isPlaying = $state(true);
  let isExpanded = $state(false);
  let isDebugOpen = $state(false);

  // The debug panel pulls in svelte-tweakpane-ui (~heavy). Load it on demand only
  // when the visitor actually opens the controls, keeping it out of the main 3D chunk.
  let DebugPanel = $state<Component<ComponentProps<typeof GalaxyDebugPanelType>>>();
  $effect(() => {
    if (isDebugOpen && !DebugPanel) {
      import('./GalaxyDebugPanel.svelte').then((m) => (DebugPanel = m.default));
    }
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

  {#if isDebugOpen && DebugPanel}
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

  <GalaxyControls
    expanded={isExpanded}
    animationActive={isPlaying}
    onToggleExpanded={() => (isExpanded = !isExpanded)}
    onToggleAnimation={() => (isPlaying = !isPlaying)}
    onToggleControls={() => (isDebugOpen = !isDebugOpen)}
  />
</div>
