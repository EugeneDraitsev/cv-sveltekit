<script lang="ts">
  import { T, useTask } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import { onMount } from 'svelte';
  import {
    ShaderMaterial,
    BufferGeometry,
    Color,
    Points,
    BufferAttribute,
    AdditiveBlending,
  } from 'three';

  import vertexShader from './galaxyVertexShader.glsl';
  import fragmentShader from './galaxyFragmentShader.glsl';

  let time = 0;

  const parameters = {
    particleSize: 115,
    count: 200000,
    radius: 11,
    branches: 5,
    spin: 1,
    randomness: 0.82,
    randomnessPower: 4.8,
    insideColor: '#0b1d95',
    outsideColor: '#aa837e',
  };

  let geometry: BufferGeometry;
  let material: ShaderMaterial;
  let points: Points;

  onMount(() => {
    generateGalaxy();
    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  });

  function generateGalaxy() {
    if (points) {
      geometry.dispose();
      material.dispose();
    }

    geometry = new BufferGeometry();

    const positions = new Float32Array(parameters.count * 3);
    const colors = new Float32Array(parameters.count * 3);
    const scales = new Float32Array(parameters.count);
    const randomness = new Float32Array(parameters.count * 3);

    const colorInside = new Color(parameters.insideColor);
    const colorOutside = new Color(parameters.outsideColor);

    for (let i = 0; i < parameters.count; i++) {
      const i3 = i * 3;

      // Position
      const radius = Math.random() * parameters.radius;
      const branchAngle = ((i % parameters.branches) / parameters.branches) * Math.PI * 2;

      const randomX =
        Math.pow(Math.random(), parameters.randomnessPower) *
        (Math.random() < 0.5 ? 1 : -1) *
        parameters.randomness *
        radius;
      const randomY =
        Math.pow(Math.random(), parameters.randomnessPower) *
        (Math.random() < 0.5 ? 1 : -1) *
        parameters.randomness *
        radius;
      const randomZ =
        Math.pow(Math.random(), parameters.randomnessPower) *
        (Math.random() < 0.5 ? 1 : -1) *
        parameters.randomness *
        radius;

      randomness[i3] = randomX;
      randomness[i3 + 1] = randomY;
      randomness[i3 + 2] = randomZ;

      positions[i3] = Math.cos(branchAngle) * radius;
      positions[i3 + 1] = 0.0;
      positions[i3 + 2] = Math.sin(branchAngle) * radius;

      // Color
      const mixedColor = colorInside.clone();
      mixedColor.lerp(colorOutside, radius / parameters.radius);

      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;

      // Scale
      scales[i] = Math.random();
    }

    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setAttribute('aScale', new BufferAttribute(scales, 1));
    geometry.setAttribute('aRandomness', new BufferAttribute(randomness, 3));

    material = new ShaderMaterial({
      depthWrite: false,
      blending: AdditiveBlending,
      vertexColors: true,
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: parameters.particleSize },
      },
    });

    points = new Points(geometry, material);
  }

  useTask((delta) => {
    if (material) {
      time += delta;
      material.uniforms.uTime.value = time;
    }
  });
</script>

<T.PerspectiveCamera makeDefault position={[-10, 7, 10]} fov={20}>
  <OrbitControls enableDamping target.y={0.25} minDistance={10} maxDistance={30} />
</T.PerspectiveCamera>

<T.DirectionalLight intensity={0.8} position.x={5} position.y={10} />
<T.AmbientLight intensity={0.2} />

<!--<Grid-->
<!--  position.y={-0.001}-->
<!--  cellColor="#ffffff"-->
<!--  sectionColor="#ffffff"-->
<!--  sectionThickness={0}-->
<!--  fadeDistance={38}-->
<!--  gridSize={52}-->
<!--  cellSize={2}-->
<!--/>-->

<!--<ContactShadows scale={10} blur={2} far={2.5} opacity={0.5} />-->

<T.Group position.y={0.75}>
  {#if points}
    <T.Points geometry={points.geometry} material={points.material} />
  {/if}
</T.Group>
