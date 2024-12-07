<script lang="ts">
  import { Canvas } from '@threlte/core';
  import Icon from '@iconify/svelte';

  import Scene from './Scene.svelte';

  let expanded = $state(false);
</script>

<div
  class="app relative overflow-hidden transition-all ease-in-out duration-200"
  style="height: {expanded ? '100dvh' : '500px'};"
>
  <Canvas>
    <Scene />
  </Canvas>

  <div class="hidden lg:block relative mx-auto max-w-[1200px] w-full">
    <Icon
      class="absolute bottom-6 left-2 w-8 h-8 m-2 text-identifier/90 cursor-pointer transition-transform ease-in-out duration-200 {expanded
        ? ''
        : 'rotate-180'}"
      icon="icons8:chevron-up-round"
      onclick={() => (expanded = !expanded)}
    />
  </div>

  <div
    class="absolute bottom-0 left-0 w-full h-[100px] bg-gradient-to-t from-base-100 to-transparent pointer-events-none pointer-events-none"
  ></div>
</div>
