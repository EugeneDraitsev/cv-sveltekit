<script lang="ts">
  import { Canvas } from '@threlte/core';
  import Icon from '@iconify/svelte';
  import { Pane, Folder, Button, Slider } from 'svelte-tweakpane-ui';
  import { writable } from 'svelte/store';

  import Scene from './Scene.svelte';
  import { parameters, regenerateGalaxy } from './galaxy.utils';

  const { interactiveAnimation = false } = $props();
  let animationActive = $state(!interactiveAnimation);
  let expanded = $state(false);
  let container = $state<HTMLDivElement>();
  let showControls = $state(false);

  // Create a store for the parameters so we can modify them
  const galaxyParams = writable({
    particleSize: parameters.particleSize,
    count: parameters.count,
    radius: parameters.radius,
    branches: parameters.branches,
    spin: parameters.spin,
    randomness: parameters.randomness,
    randomnessPower: parameters.randomnessPower,
    armWidth: parameters.armWidth,
    diskThickness: parameters.diskThickness,
    nebulaIntensity: parameters.nebulaIntensity,
    nebulaSize: parameters.nebulaSize,
    nebulaParticleSize: parameters.nebulaParticleSize,
    nebulaParticleRatio: parameters.nebulaParticleRatio,
  });

  // Camera parameters
  const cameraParams = writable({
    fov: 20,
    distance: 30,
    positionX: -20,
    positionY: 16,
    positionZ: 20,
  });

  // Track previous values of structural parameters to detect changes
  let prevCount = $state(parameters.count);
  let prevRadius = $state(parameters.radius);
  let prevBranches = $state(parameters.branches);
  let prevSpin = $state(parameters.spin);
  let prevRandomness = $state(parameters.randomness);
  let prevRandomnessPower = $state(parameters.randomnessPower);
  let prevArmWidth = $state(parameters.armWidth);
  let prevDiskThickness = $state(parameters.diskThickness);
  let prevNebulaSize = $state(parameters.nebulaSize);
  let prevNebulaParticleSize = $state(parameters.nebulaParticleSize);
  let prevNebulaParticleRatio = $state(parameters.nebulaParticleRatio);

  // Update the actual parameters when the store changes
  $effect(() => {
    const params = $galaxyParams;

    // Update all parameters
    parameters.particleSize = params.particleSize;
    parameters.count = params.count;
    parameters.radius = params.radius;
    parameters.branches = params.branches;
    parameters.spin = params.spin;
    parameters.randomness = params.randomness;
    parameters.randomnessPower = params.randomnessPower;
    parameters.armWidth = params.armWidth;
    parameters.diskThickness = params.diskThickness;
    parameters.nebulaIntensity = params.nebulaIntensity;
    parameters.nebulaSize = params.nebulaSize;
    parameters.nebulaParticleSize = params.nebulaParticleSize;
    parameters.nebulaParticleRatio = params.nebulaParticleRatio;

    // Check if any structural parameter has changed
    const structuralParamChanged =
      prevCount !== params.count ||
      prevRadius !== params.radius ||
      prevBranches !== params.branches ||
      prevSpin !== params.spin ||
      prevRandomness !== params.randomness ||
      prevRandomnessPower !== params.randomnessPower ||
      prevArmWidth !== params.armWidth ||
      prevDiskThickness !== params.diskThickness ||
      prevNebulaSize !== params.nebulaSize ||
      prevNebulaParticleSize !== params.nebulaParticleSize ||
      prevNebulaParticleRatio !== params.nebulaParticleRatio;

    // Regenerate galaxy if structural parameters changed
    if (structuralParamChanged) {
      regenerateGalaxy();

      // Update previous values
      prevCount = params.count;
      prevRadius = params.radius;
      prevBranches = params.branches;
      prevSpin = params.spin;
      prevRandomness = params.randomness;
      prevRandomnessPower = params.randomnessPower;
      prevArmWidth = params.armWidth;
      prevDiskThickness = params.diskThickness;
      prevNebulaSize = params.nebulaSize;
      prevNebulaParticleSize = params.nebulaParticleSize;
      prevNebulaParticleRatio = params.nebulaParticleRatio;
    }
  });

  $effect(() => {
    if (container && interactiveAnimation) {
      const handleInteraction = () => {
        animationActive = true;

        window.removeEventListener('scroll', handleInteraction);
        window.removeEventListener('mousemove', handleInteraction);
        window.removeEventListener('touchstart', handleInteraction);
        window.removeEventListener('click', handleInteraction);
      };

      window.addEventListener('scroll', handleInteraction);
      window.addEventListener('mousemove', handleInteraction);
      window.addEventListener('touchstart', handleInteraction);
      window.addEventListener('click', handleInteraction);
    }
  });
</script>

<div
  bind:this={container}
  class="app theme-grayscale relative overflow-hidden transition-all ease-in-out duration-200"
  style:height={expanded ? '100dvh' : '540px'}
>
  <Canvas>
    <Scene
      {animationActive}
      cameraFov={$cameraParams.fov}
      cameraPosition={[$cameraParams.positionX, $cameraParams.positionY, $cameraParams.positionZ]}
      cameraDistance={$cameraParams.distance}
      particleSize={$galaxyParams.particleSize}
      nebulaIntensity={$galaxyParams.nebulaIntensity}
    />
  </Canvas>

  {#if showControls}
    <div
      class="absolute top-4 right-4 z-10 w-[300px] max-h-[80vh] overflow-auto bg-base-100/90 rounded-lg shadow-lg"
    >
      <Pane expanded>
        <Folder title="Galaxy">
          <Folder title="Structure">
            <Button
              label="Regenerate"
              on:click={() => {
                // Directly call regenerateGalaxy to create a new galaxy with current parameters
                regenerateGalaxy();
              }}
            />
            <Slider
              label="Particle Count"
              min={10000}
              max={500000}
              step={10000}
              bind:value={$galaxyParams.count}
            />
            <Slider
              label="Particle Size"
              min={0.5}
              max={10}
              step={0.1}
              bind:value={$galaxyParams.particleSize}
            />
            <Slider label="Radius" min={5} max={50} step={1} bind:value={$galaxyParams.radius} />
            <Slider
              label="Branches"
              min={2}
              max={10}
              step={1}
              bind:value={$galaxyParams.branches}
            />
            <Slider label="Spin" min={0.1} max={5} step={0.1} bind:value={$galaxyParams.spin} />
          </Folder>
          <Folder title="Distribution">
            <Slider
              label="Randomness"
              min={0}
              max={2}
              step={0.01}
              bind:value={$galaxyParams.randomness}
            />
            <Slider
              label="Randomness Power"
              min={1}
              max={10}
              step={0.1}
              bind:value={$galaxyParams.randomnessPower}
            />
            <Slider
              label="Arm Width"
              min={0.1}
              max={1}
              step={0.01}
              bind:value={$galaxyParams.armWidth}
            />
            <Slider
              label="Disk Thickness"
              min={0.01}
              max={0.5}
              step={0.01}
              bind:value={$galaxyParams.diskThickness}
            />
          </Folder>
        </Folder>

        <Folder title="Nebula">
          <Slider
            label="Intensity"
            min={0}
            max={2}
            step={0.01}
            bind:value={$galaxyParams.nebulaIntensity}
          />
          <Slider label="Size" min={0.1} max={3} step={0.1} bind:value={$galaxyParams.nebulaSize} />
          <Slider
            label="Particle Size"
            min={0.1}
            max={3}
            step={0.1}
            bind:value={$galaxyParams.nebulaParticleSize}
          />
          <Slider
            label="Particle Ratio"
            min={0.1}
            max={0.9}
            step={0.05}
            bind:value={$galaxyParams.nebulaParticleRatio}
          />
        </Folder>

        <Folder title="Camera">
          <Slider label="FOV" min={10} max={75} step={1} bind:value={$cameraParams.fov} />
          <Slider
            label="Distance"
            min={10}
            max={100}
            step={1}
            bind:value={$cameraParams.distance}
          />
          <Folder title="Position">
            <Slider label="X" min={-50} max={50} step={1} bind:value={$cameraParams.positionX} />
            <Slider label="Y" min={-50} max={50} step={1} bind:value={$cameraParams.positionY} />
            <Slider label="Z" min={-50} max={50} step={1} bind:value={$cameraParams.positionZ} />
          </Folder>
        </Folder>
      </Pane>
    </div>
  {/if}

  <div
    class="galaxy-controls absolute bottom-0 left-4 lg:left-0 w-full h-[100px] from-base-100 to-transparent"
    class:bg-gradient-to-t={!expanded}
  >
    <div class="flex items-end gap-2 py-6 h-full mx-auto max-w-[1200px] w-full">
      <button
        class="cursor-pointer h-6"
        onclick={() => (expanded = !expanded)}
        aria-label="Toggle 3d scene height"
      >
        <Icon
          class="h-8 w-8 text-identifier/90 cursor-pointer transition-transform ease-in-out duration-200 {!expanded
            ? 'rotate-180'
            : ''}"
          icon="icons8:chevron-up-round"
        />
      </button>

      <button
        class="cursor-pointer h-6"
        onclick={() => (animationActive = !animationActive)}
        aria-label="Toggle animation"
      >
        <Icon
          class="h-8 w-8 text-identifier/90 cursor-pointer transition-transform ease-in-out duration-200"
          icon={animationActive
            ? 'material-symbols:pause-circle-outline-rounded'
            : 'material-symbols:play-circle-outline-rounded'}
        />
      </button>

      <button
        class="cursor-pointer h-6"
        onclick={() => (showControls = !showControls)}
        aria-label="Toggle controls"
      >
        <Icon
          class="h-8 w-8 text-identifier/90 cursor-pointer transition-transform ease-in-out duration-200"
          icon="material-symbols:tune"
        />
      </button>
    </div>
  </div>
</div>
