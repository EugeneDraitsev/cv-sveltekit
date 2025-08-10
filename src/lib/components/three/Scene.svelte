<script lang="ts">
  import {
    ShaderMaterial,
    BufferGeometry,
    BufferAttribute,
    AdditiveBlending,
    MultiplyBlending,
  } from 'three';
  import { T, useTask, useThrelte } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';

  import themeStore from '$lib/stores/theme.svelte';
  import vertexShader from './galaxyVertexShader.glsl';
  import fragmentShader from './galaxyFragmentShader.glsl';
  import {
    colors,
    parameters,
    positions,
    randomness,
    scales,
    isNebula,
    syncGalaxyColor,
    galaxyRegenerated,
  } from '$lib/components/three/galaxy.utils';

  const { renderer } = useThrelte();
  const {
    animationActive = false,
    cameraFov = 20,
    cameraPosition = [-20, 24, 20] as [x: number, y: number, z: number],
    cameraDistance = 30,
    particleSize = parameters.particleSize as number,
    nebulaIntensity = parameters.nebulaIntensity,
  } = $props();
  const pixelRatio = Math.min(window.devicePixelRatio, 2);

  // we have not to use $state here, because we don't need to re-create the material on every change
  let time = 0;

  // Subscribe to the galaxyRegenerated store to know when to update the geometry
  let galaxyRegeneratedCount = $state(0);

  $effect(() => {
    // Update our local counter whenever the store changes
    galaxyRegeneratedCount = $galaxyRegenerated;
  });

  const geometry = $derived.by(() => {
    // This will be re-evaluated whenever galaxyRegeneratedCount changes
    void galaxyRegeneratedCount;

    syncGalaxyColor();

    const newGeometry = new BufferGeometry();
    newGeometry.setAttribute('position', new BufferAttribute(positions, 3));
    newGeometry.setAttribute('color', new BufferAttribute(colors, 3));
    newGeometry.setAttribute('aScale', new BufferAttribute(scales, 1));
    newGeometry.setAttribute('aRandomness', new BufferAttribute(randomness, 3));
    newGeometry.setAttribute('aIsNebula', new BufferAttribute(isNebula, 1));
    return newGeometry;
  });

  const material = $derived.by(() => {
    return new ShaderMaterial({
      depthWrite: false,
      transparent: true,
      blending: themeStore.theme === 'dark' ? AdditiveBlending : MultiplyBlending,
      vertexColors: true,
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: time },
        uSize: { value: particleSize * pixelRatio },
        uNebulaIntensity: { value: nebulaIntensity },
      },
    });
  });

  $effect(() => {
    renderer.setClearColor(themeStore.theme === 'dark' ? 0x121212 : 0xffffff, 1.0);
    renderer.setPixelRatio(pixelRatio);
  });

  $effect(() => {
    if (animationActive) {
      start();
    } else {
      stop();
    }
  });

  // Update material uniforms when relevant props change
  $effect(() => {
    if (material) {
      material.uniforms.uSize.value = particleSize * pixelRatio;
      material.uniforms.uNebulaIntensity.value = nebulaIntensity;
    }
  });

  const { start, stop } = useTask(
    (delta) => {
      if (material) {
        time += delta;
        material.uniforms.uTime.value = time;
      }
    },
    { autoStart: false },
  );
</script>

<T.PerspectiveCamera makeDefault position={cameraPosition} fov={cameraFov}>
  <OrbitControls
    enableDamping
    target.y={0}
    minDistance={Math.max(10, cameraDistance - 20)}
    maxDistance={cameraDistance + 40}
  />
</T.PerspectiveCamera>

<T.DirectionalLight intensity={0.8} position.x={5} position.y={10} />
<T.AmbientLight intensity={0.2} />

<T.Group position.y={0}>
  <T.Points>
    <T is={geometry} />
    <T is={material} />
  </T.Points>
</T.Group>
