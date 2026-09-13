<script lang="ts">
  import { useTask, useThrelte } from '@threlte/core';
  import { getSceneQuality } from './quality';

  const { active, travelling = false }: { active: boolean; travelling?: boolean } = $props();
  const { dpr } = useThrelte();
  const ceiling = Math.min(window.devicePixelRatio, getSceneQuality().maxDpr);
  let elapsed = 0;
  let frames = 0;
  let warmup = 2;

  $effect(() => {
    // Scene tasks and damping stop when inactive. Keep on-demand drawing so
    // a paused scene can still paint its first frame and respond to theme changes.
    if (active && !travelling) {
      warmup = 2;
      elapsed = 0;
      frames = 0;
      start();
    } else stop();
  });

  const { start, stop } = useTask(
    (delta) => {
      const frameTime = Math.min(delta, 0.25);
      if (warmup > 0) {
        warmup -= frameTime;
        return;
      }
      elapsed += frameTime;
      frames++;
      if (elapsed < 3) return;
      // Long windows and asymmetric thresholds avoid oscillation / allocation churn.
      const fps = frames / elapsed;
      const current = dpr.current;
      if (fps < 42) dpr.set(Math.max(0.75, current - 0.25));
      else if (fps > 57) dpr.set(Math.min(ceiling, current + 0.125));
      elapsed = 0;
      frames = 0;
    },
    { autoStart: false, autoInvalidate: false },
  );
</script>
