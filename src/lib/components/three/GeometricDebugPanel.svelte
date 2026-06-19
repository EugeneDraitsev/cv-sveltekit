<script lang="ts">
  import { Pane, Slider, Folder, Checkbox, List } from 'svelte-tweakpane-ui';
  import type { GeometricParams } from '$lib/types/threlte.types';

  let { params = $bindable() } = $props<{ params: GeometricParams }>();

  // Biome Options
  const biomeOptions = {
    Auto: -1,
    Ice: 0,
    Volcano: 1,
    Forest: 2,
    Desert: 3,
  };
</script>

<div
  class="absolute pane-container right-4 top-4 z-10 w-75 overflow-auto rounded-lg bg-base-100/90 shadow-lg"
>
  <Pane title="Geometric Settings" expanded={true}>
    <Folder title="Movement">
      <Slider bind:value={params.speed} label="Speed" min={0} max={5} step={0.1} />
    </Folder>

    <Folder title="Terrain">
      <!-- Adjusted ranges as requested (Default is 2.5) -->
      <Slider bind:value={params.elevationScale} label="Elevation" min={0} max={20} step={0.1} />
      <Slider bind:value={params.noiseScale} label="Noise Scale" min={0.1} max={5.0} step={0.1} />
      <List bind:value={params.biome} label="Biome" options={biomeOptions} />
      <Slider bind:value={params.fogDist} label="Fog Dist" min={20} max={200} step={1} />
      <Checkbox bind:value={params.freeLook} label="Free Look" />
      <Checkbox bind:value={params.wireframe} label="Wireframe" />
    </Folder>
  </Pane>
</div>

<style>
  :global(.pane-container > div) {
    max-height: 80vh;
    overflow: auto;
  }
</style>
