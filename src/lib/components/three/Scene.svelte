<script lang="ts">
  import {
    ShaderMaterial,
    BufferGeometry,
    Color,
    BufferAttribute,
    AdditiveBlending,
    MultiplyBlending,
  } from 'three';
  import { T, useTask, useThrelte } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';

  import theme from '$lib/components/theme.svelte';
  import vertexShader from './galaxyVertexShader.glsl';
  import fragmentShader from './galaxyFragmentShader.glsl';

  let time = 0;

  const parameters = {
    particleSize: 7,
    count: 100_000,
    radius: 20,
    branches: 5,
    spin: 1,
    randomness: 0.82,
    randomnessPower: 7.8,
    insideColor: '',
    outsideColor: '',
  };

  let geometry = $state<BufferGeometry>();
  let material = $state<ShaderMaterial>();

  const { renderer } = useThrelte();
  const pixelRatio = Math.min(window.devicePixelRatio, 2);

  $effect(() => {
    parameters.insideColor = theme.value === 'dark' ? '#0b1d95' : '#bdc2f1';
    parameters.outsideColor = theme.value === 'dark' ? '#aa837e' : '#aa5a09';

    renderer.setClearColor(theme.value === 'dark' ? 0x121212 : 0xffffff, 1.0);
    renderer.setPixelRatio(pixelRatio);
    generateGalaxy();

    return () => {
      geometry?.dispose();
      material?.dispose();
    };
  });

  function generateGalaxy() {
    const newGeometry = new BufferGeometry();

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
      scales[i] = Math.random() * 25;
    }

    newGeometry.setAttribute('position', new BufferAttribute(positions, 3));
    newGeometry.setAttribute('color', new BufferAttribute(colors, 3));
    newGeometry.setAttribute('aScale', new BufferAttribute(scales, 1));
    newGeometry.setAttribute('aRandomness', new BufferAttribute(randomness, 3));

    geometry = newGeometry;

    material = new ShaderMaterial({
      depthWrite: false,
      blending: theme.value === 'dark' ? AdditiveBlending : MultiplyBlending,
      vertexColors: true,
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: parameters.particleSize * pixelRatio },
      },
    });
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

<T.Group position.y={0.55}>
  <T.Points>
    <T is={geometry} />
    <T is={material} />
  </T.Points>
</T.Group>
