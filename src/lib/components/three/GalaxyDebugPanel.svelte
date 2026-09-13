<script lang="ts">
  import { Pane, Folder, Button, Slider, Color as TPColor } from 'svelte-tweakpane-ui';
  import type { GalaxyDebugPanelProps as Props } from '$lib/types/threlte.types';

  let {
    galaxyParams = $bindable(),
    cameraParams = $bindable(),
    galaxyInsideHex = $bindable(),
    galaxyOutsideHex = $bindable(),
    nebulaInsideHex = $bindable(),
    nebulaOutsideHex = $bindable(),
    onRegenerate,
    onSetColors,
    onResetColors,
  }: Props = $props();
</script>

<div class="pane-container">
  <Pane position="inline" title="Galaxy settings" expanded>
    <!-- Galaxy Structure -->
    <Folder title="Galaxy">
      <Folder title="Structure">
        <Button title="Regenerate" on:click={onRegenerate} />
        <Slider
          label="Particles"
          bind:value={galaxyParams.count}
          min={10000}
          max={500000}
          step={10000}
        />
        <Slider label="Size" bind:value={galaxyParams.particleSize} min={0.5} max={10} step={0.1} />
        <Slider label="Radius" bind:value={galaxyParams.radius} min={5} max={50} step={1} />
        <Slider label="Arms" bind:value={galaxyParams.branches} min={2} max={10} step={1} />
        <Slider label="Spin" bind:value={galaxyParams.spin} min={0.1} max={5} step={0.1} />
      </Folder>

      <Folder title="Shape">
        <Slider label="Spread" bind:value={galaxyParams.randomness} min={0} max={2} step={0.01} />
        <Slider
          label="Falloff"
          bind:value={galaxyParams.randomnessPower}
          min={1}
          max={10}
          step={0.1}
        />
        <Slider
          label="Arm Width"
          bind:value={galaxyParams.armWidth}
          min={0.1}
          max={1}
          step={0.01}
        />
        <Slider
          label="Thickness"
          bind:value={galaxyParams.diskThickness}
          min={0.01}
          max={0.5}
          step={0.01}
        />
      </Folder>
    </Folder>

    <!-- Nebula -->
    <Folder title="Nebula">
      <Slider label="Glow" bind:value={galaxyParams.nebulaIntensity} min={0} max={2} step={0.01} />
      <Slider label="Size" bind:value={galaxyParams.nebulaSize} min={0.1} max={3} step={0.1} />
      <Slider
        label="Particle Size"
        bind:value={galaxyParams.nebulaParticleSize}
        min={0.1}
        max={3}
        step={0.1}
      />
      <Slider
        label="Density"
        bind:value={galaxyParams.nebulaParticleRatio}
        min={0.1}
        max={0.9}
        step={0.05}
      />
    </Folder>

    <!-- Colors -->
    <Folder title="Colors">
      <TPColor label="Galaxy Core" bind:value={galaxyInsideHex} on:change={onSetColors} />
      <TPColor label="Galaxy Edge" bind:value={galaxyOutsideHex} on:change={onSetColors} />
      <TPColor label="Nebula Core" bind:value={nebulaInsideHex} on:change={onSetColors} />
      <TPColor label="Nebula Edge" bind:value={nebulaOutsideHex} on:change={onSetColors} />
      <Button title="Reset colors" on:click={onResetColors} />
    </Folder>

    <!-- Camera -->
    <Folder title="Camera">
      <Slider label="FOV" bind:value={cameraParams.fov} min={10} max={75} step={1} />
      <Slider label="Zoom" bind:value={cameraParams.distance} min={10} max={100} step={1} />
      <Folder title="Position">
        <Slider label="X" bind:value={cameraParams.positionX} min={-50} max={50} step={1} />
        <Slider label="Y" bind:value={cameraParams.positionY} min={-50} max={50} step={1} />
        <Slider label="Z" bind:value={cameraParams.positionZ} min={-50} max={50} step={1} />
      </Folder>
    </Folder>
  </Pane>
</div>

<style>
  .pane-container {
    position: absolute;
    top: 3.5rem;
    right: 1rem;
    z-index: 9;
    width: min(320px, calc(100% - 2rem));
    max-height: calc(100% - 10rem);
    overflow: auto;
    border: 1px solid var(--color-base-300);
    border-radius: 12px;
    background: var(--color-base-100);
    box-shadow: 0 12px 32px #0004;
  }
</style>
