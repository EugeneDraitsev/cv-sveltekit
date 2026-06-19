<script lang="ts">
  import { T, useTask, useThrelte } from '@threlte/core';
  import { ShaderMaterial, BackSide, Vector3 } from 'three';
  import type { GeometricParams } from '$lib/types/threlte.types';

  import fragmentShader from '$lib/shaders/geometric/sky.fragment.glsl?raw';

  let { params, animationActive = true } = $props<{
    params: GeometricParams;
    animationActive?: boolean;
  }>();

  let time = 0;
  let offset = new Vector3(0, 0, 0);

  const { size } = useThrelte();

  const material = new ShaderMaterial({
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uBiomeIndex: { value: 0 },
      uBiomeMix: { value: 0 },
      uAspectRatio: { value: 1.0 },
    },
    side: BackSide,
  });

  $effect(() => {
    material.uniforms.uAspectRatio.value = $size.width / $size.height;
  });

  const { start, stop } = useTask(
    (delta) => {
      time += delta;
      offset.y -= params.speed * delta * 15;

      const biomeProgress = -offset.y * 0.005;
      let biomeLocal = 0;

      if (params.biome > -0.5) {
        material.uniforms.uBiomeIndex.value = params.biome;
        material.uniforms.uBiomeMix.value = 0.0;
      } else {
        const idx = Math.floor(biomeProgress) % 4;
        biomeLocal = biomeProgress - Math.floor(biomeProgress);
        material.uniforms.uBiomeIndex.value = idx;
        material.uniforms.uBiomeMix.value = biomeLocal > 0.8 ? (biomeLocal - 0.8) * 5.0 : 0.0;
      }

      material.uniforms.uTime.value = time;
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

<T.Mesh>
  <T.SphereGeometry args={[400, 32, 32]} />
  <T is={material} />
</T.Mesh>
