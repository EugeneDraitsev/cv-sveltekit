<script lang="ts">
  import { Canvas } from '@threlte/core';
  import Scene from './Scene.svelte';
</script>

<div class="relative h-[450px] overflow-hidden">
  <Canvas>
    <Scene />
  </Canvas>
  <div
    class="absolute bottom-0 left-0 w-full h-[100px] bg-gradient-to-t from-base-100 to-transparent pointer-events-none"
  ></div>
</div>

<style>
  :global(canvas) {
    width: 100%;
    height: 450px !important;
  }
</style>
