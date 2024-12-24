<script lang="ts">
  import { Canvas } from '@threlte/core';
  import Icon from '@iconify/svelte';

  import Scene from './Scene.svelte';

  const { interactiveAnimation = false } = $props();
  let animationActive = $state(!interactiveAnimation);
  let expanded = $state(false);
  let container = $state<HTMLDivElement>();

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
    <Scene {animationActive} />
  </Canvas>

  <div
    class="absolute bottom-24 lg:bottom-0 left-4 lg:left-0 w-full h-[100px] from-base-100 to-transparent"
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
        aria-label="Toggle 3d scene height"
      >
        <Icon
          class="h-8 w-8 text-identifier/90 cursor-pointer transition-transform ease-in-out duration-200"
          icon={animationActive
            ? 'material-symbols:pause-circle-outline-rounded'
            : 'material-symbols:play-circle-outline-rounded'}
        />
      </button>
    </div>
  </div>
</div>
