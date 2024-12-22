<script lang="ts">
  import { Canvas } from '@threlte/core';
  import Icon from '@iconify/svelte';

  import Scene from './Scene.svelte';

  let expanded = $state(false);
</script>

<div
  class="app theme-grayscale relative overflow-hidden transition-all ease-in-out duration-200"
  style:height={expanded ? '100dvh' : '540px'}
>
  <Canvas>
    <Scene />
  </Canvas>

  <div class="relative mx-auto max-w-[1200px] w-full">
    <button
      class="absolute bottom-28 lg:bottom-6 left-2 m-2 cursor-pointer h-6"
      onclick={() => (expanded = !expanded)}
      aria-label="Toggle 3d scene height"
    >
      <Icon
        class="h-8 w-8 text-identifier/90 cursor-pointer transition-transform ease-in-out duration-200 {expanded
          ? ''
          : 'rotate-180'}"
        icon="icons8:chevron-up-round"
      />
    </button>
  </div>

  <div
    class="{expanded
      ? 'hidden'
      : 'absolute'} bottom-0 left-0 w-full h-[100px] bg-gradient-to-t from-base-100 to-transparent pointer-events-none pointer-events-none"
  ></div>
</div>
