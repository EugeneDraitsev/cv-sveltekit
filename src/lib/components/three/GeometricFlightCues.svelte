<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { AdditiveBlending, DoubleSide } from 'three';
  import type { GeometricParams } from '$lib/types/threlte.types';

  let { params, animationActive = true } = $props<{
    params: GeometricParams;
    animationActive?: boolean;
  }>();

  let time = $state(0);

  const rings = Array.from({ length: 9 }, (_, index) => index);
  const beacons = Array.from({ length: 14 }, (_, index) => index);
  const farZ = -102;
  const nearZ = 10;
  const palettes = [
    ['#7dd3fc', '#c4b5fd'],
    ['#fb923c', '#fde047'],
    ['#34d399', '#a7f3d0'],
    ['#fbbf24', '#38bdf8'],
  ];

  const smoothstep = (edge0: number, edge1: number, value: number) => {
    const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
  };

  const travelSpeed = () => Math.max(params.speed, 0.08) * 0.12;
  const progress = (index: number, count: number) => (time * travelSpeed() + index / count) % 1;
  const zAt = (index: number, count: number) => farZ + (nearZ - farZ) * progress(index, count);
  const fadeAt = (index: number, count: number) => {
    const p = progress(index, count);
    return smoothstep(0.02, 0.18, p) * (1 - smoothstep(0.78, 0.98, p));
  };

  const cueColor = (index: number) => {
    const biome = params.biome > -0.5 ? params.biome : index % palettes.length;
    const palette = palettes[Math.max(0, Math.min(palettes.length - 1, Math.round(biome)))];
    return palette[index % palette.length];
  };

  const ringX = (index: number) => Math.sin(index * 1.73 + time * 0.22) * 4.8;
  const ringY = (index: number) => 5.2 + Math.sin(index * 0.91 + time * 0.35) * 0.7;
  const ringScale = (index: number) => 0.85 + Math.sin(index * 1.37 + time * 0.5) * 0.08;
  const beaconX = (index: number) => (index % 2 === 0 ? -1 : 1) * (15 + (index % 3) * 3.5);
  const beaconY = (index: number) => 1.4 + Math.sin(index * 1.11 + time * 0.6) * 0.45;

  const { start, stop } = useTask(
    (delta) => {
      time += delta;
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

<T.Group>
  {#each rings as index}
    <T.Mesh
      position={[ringX(index), ringY(index), zAt(index, rings.length)]}
      rotation.z={Math.sin(index * 0.8 + time * 0.2) * 0.1}
      scale={[ringScale(index), ringScale(index) * 0.46, 1]}
      renderOrder={2}
    >
      <T.TorusGeometry args={[6.4, 0.04, 8, 96]} />
      <T.MeshBasicMaterial
        color={cueColor(index)}
        transparent
        opacity={fadeAt(index, rings.length) * 0.48}
        blending={AdditiveBlending}
        depthWrite={false}
        side={DoubleSide}
      />
    </T.Mesh>
  {/each}

  {#each beacons as index}
    <T.Mesh
      position={[beaconX(index), beaconY(index), zAt(index, beacons.length)]}
      rotation.x={time * 0.7 + index}
      rotation.y={time * 0.45 + index * 0.6}
      scale={[1, 1.8, 1]}
      renderOrder={1}
    >
      <T.OctahedronGeometry args={[0.42, 0]} />
      <T.MeshBasicMaterial
        color={cueColor(index)}
        transparent
        opacity={fadeAt(index, beacons.length) * 0.62}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </T.Mesh>
  {/each}
</T.Group>
