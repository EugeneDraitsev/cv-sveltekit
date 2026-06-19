<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import type { GeometricParams } from '$lib/types/threlte.types';
  import GeometricFlightCues from './GeometricFlightCues.svelte';
  import GeometricTerrain from './GeometricTerrain.svelte';
  import GeometricSky from './GeometricSky.svelte';

  const { renderer } = useThrelte();

  // Params - accept from parent or use defaults
  let {
    params = $bindable({
      speed: 1.0,
      elevationScale: 2.4,
      noiseScale: 1.35,
      biomeThreshold: 0.1,
      wireframe: false,
      biome: -1,
      fogDist: 120,
      freeLook: false,
    }),
    animationActive = true,
  } = $props<{ params?: GeometricParams; animationActive?: boolean }>();

  const BG_COLOR = '#020617';

  $effect(() => {
    renderer.setClearColor(BG_COLOR, 1.0);
  });

  let terrainComponent: GeometricTerrain | undefined;
  let banking = $state(0);

  const { start, stop } = useTask(
    (delta) => {
      const targetBanking = params.freeLook ? 0 : (terrainComponent?.getBanking() ?? 0);
      banking += (targetBanking - banking) * Math.min(delta * 7, 1);
    },
    { autoStart: false },
  );

  $effect(() => {
    if (animationActive) {
      start();
    } else {
      stop();
    }
  });
</script>

<!-- Camera Logic -->
{#if params.freeLook}
  <T.PerspectiveCamera makeDefault position={[0, 10, 20]} fov={60}>
    <OrbitControls enableDamping target={[0, 0, -20]} />
  </T.PerspectiveCamera>
{:else}
  <!-- Standard Flight Camera -->
  <T.PerspectiveCamera
    makeDefault
    position={[0, 14.5, 13]}
    fov={62}
    rotation.x={-0.43}
    rotation.z={banking}
  />
{/if}

<GeometricSky {params} {animationActive} />
<GeometricFlightCues {params} {animationActive} />
<GeometricTerrain {params} {animationActive} bind:this={terrainComponent} />
