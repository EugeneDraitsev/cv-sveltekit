<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { ShaderMaterial, Vector3, Vector2, DoubleSide } from 'three';
  import type { GeometricParams } from '$lib/types/threlte.types';

  import vertexShader from '$lib/shaders/geometric/terrain.vertex.glsl?raw';
  import fragmentShader from '$lib/shaders/geometric/terrain.fragment.glsl?raw';

  let { params, animationActive = true } = $props<{
    params: GeometricParams;
    animationActive?: boolean;
  }>();

  let time = 0;

  // Offset tracking (64-bit precision in JS)
  let offsetX = 0;
  let offsetY = 0;

  let targetX = 0;
  let currentX = 0;

  export const getBanking = () => Math.max(-0.34, Math.min(0.34, (targetX - currentX) * 0.08));

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uOffset: { value: new Vector3(0, 0, 0) },
      uNoiseOffset: { value: new Vector2(0, 0) },
      uElevationScale: { value: 2.0 },
      uNoiseScale: { value: 1.5 },
      uBiomeOverride: { value: -1 },
      uFogDist: { value: 90 },
    },
    wireframe: false,
    side: DoubleSide,
  });

  $effect(() => {
    const biome = params.biome;
    const elevationScale = params.elevationScale;
    const noiseScale = params.noiseScale;
    const fogDist = params.fogDist;
    const wireframe = params.wireframe;

    material.uniforms.uBiomeOverride.value = biome;
    material.uniforms.uElevationScale.value = elevationScale;
    material.uniforms.uNoiseScale.value = noiseScale;
    material.uniforms.uFogDist.value = fogDist;
    material.wireframe = wireframe;
  });

  let isDragging = false;
  let startX = 0;

  function onPointerDown(e: PointerEvent) {
    if (params.freeLook) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('input') ||
      target.closest('select') ||
      target.closest('.tp-dfwv')
    ) {
      return;
    }
    if (e.button === 0) {
      isDragging = true;
      startX = e.clientX;
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (params.freeLook || !isDragging) return;
    const deltaX = (e.clientX - startX) * 0.05;
    targetX += deltaX;
    startX = e.clientX;
  }

  function onPointerUp() {
    isDragging = false;
  }

  $effect(() => {
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  });

  const { start, stop } = useTask(
    (delta) => {
      time += delta;
      const speed = params.speed;

      offsetY -= speed * delta * 15;
      currentX += (targetX - currentX) * delta * 5;
      offsetX = currentX;

      material.uniforms.uTime.value = time;
      material.uniforms.uOffset.value.set(offsetX, offsetY, 0);
      material.uniforms.uNoiseOffset.value.set(offsetX, offsetY);
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

<T.Mesh rotation.x={-Math.PI / 2} frustumCulled={false}>
  <T.PlaneGeometry args={[140, 140, 320, 320]} />
  <T is={material} />
</T.Mesh>
