import { tick } from 'svelte';
import type { Camera, Scene, WebGLRenderer } from 'three';

/** Compile the mounted scene before uncovering its first moving frame. */
export function sceneWarmup(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: () => Camera | undefined,
) {
  let ready = $state(false);
  $effect(() => {
    const current = camera();
    if (!current) return;
    let mounted = true;
    void tick()
      .then(() => {
        if (mounted) return renderer.compileAsync(scene, current);
      })
      .catch((error) => console.error('Unable to warm scene shaders', error))
      .finally(() => {
        if (mounted) ready = true;
      });
    return () => {
      mounted = false;
    };
  });
  return {
    get ready() {
      return ready;
    },
  };
}
