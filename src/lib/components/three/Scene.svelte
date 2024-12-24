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
    syncGalaxyColor,
  } from '$lib/components/three/galaxy.utils.js';

  const { renderer } = useThrelte();
  const { animationActive = false } = $props();
  const pixelRatio = Math.min(window.devicePixelRatio, 2);

  // we have not to use $state here, because we don't need to re-create the material on every change
  let time = 0;

  const geometry = $derived.by(() => {
    syncGalaxyColor();

    const newGeometry = new BufferGeometry();
    newGeometry.setAttribute('position', new BufferAttribute(positions, 3));
    newGeometry.setAttribute('color', new BufferAttribute(colors, 3));
    newGeometry.setAttribute('aScale', new BufferAttribute(scales, 1));
    newGeometry.setAttribute('aRandomness', new BufferAttribute(randomness, 3));
    return newGeometry;
  });

  const material = $derived.by(() => {
    return new ShaderMaterial({
      depthWrite: false,
      blending: themeStore.theme === 'dark' ? AdditiveBlending : MultiplyBlending,
      vertexColors: true,
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: time },
        uSize: { value: parameters.particleSize * pixelRatio },
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

<T.PerspectiveCamera makeDefault position={[-10, 7, 10]} fov={20}>
  <OrbitControls enableDamping target.y={0.25} minDistance={10} maxDistance={30} />
</T.PerspectiveCamera>

<T.DirectionalLight intensity={0.8} position.x={5} position.y={10} />
<T.AmbientLight intensity={0.2} />

<T.Group position.y={0.55}>
  <T.Points>
    <T is={geometry} />
    <T is={material} />
  </T.Points>
</T.Group>
