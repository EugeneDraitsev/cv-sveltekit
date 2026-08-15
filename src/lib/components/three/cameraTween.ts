import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface TweenTarget {
  position: [number, number, number];
  target: [number, number, number];
  /** Optional FOV animation — a slight widening sells the warp acceleration. */
  fov?: number;
}

export type Easing = (t: number) => number;

export const easeInOutCubic: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Accelerating — used for the dive into a star (slow start, fast arrival). */
export const easeInCubic: Easing = (t) => t * t * t;

/** Decelerating — used for dropping out of warp inside a system. */
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** GLSL-style smoothstep — used to shape motion-locked transition veils. */
export function smoothstepJs(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Smoothly tween the camera position and the OrbitControls target over the
 * given duration.
 *
 * OrbitControls.update() recalculates camera position from its internal
 * spherical coordinates every frame, which fights a direct position lerp.
 * To avoid that, we completely bypass controls during the tween:
 *   - disable controls (no input, no internal update)
 *   - set camera.position directly each frame
 *   - use camera.lookAt() to aim at the interpolated target
 *   - stash the interpolated target so we can sync controls once at the end
 *
 * On completion (or cancellation), we write the final target into controls
 * and call controls.update() a single time so OrbitControls picks up the new
 * position/target without fighting the animation.
 *
 * Runs on its own requestAnimationFrame loop (independent of Threlte's render
 * loop) so it keeps animating even while the galaxy's useTask is paused.
 *
 * Returns a cancel function.
 */
export function tweenCamera(
  camera: PerspectiveCamera,
  controls: OrbitControls | undefined,
  to: TweenTarget,
  durationMs: number,
  onComplete?: () => void,
  ease: Easing = easeInOutCubic,
): () => void {
  const fromPos = camera.position.clone();
  const fromTarget = controls ? controls.target.clone() : new Vector3();
  const fromFov = camera.fov;
  const toPos = new Vector3(...to.position);
  const toTarget = new Vector3(...to.target);

  const wasEnabled = controls?.enabled ?? true;
  if (controls) controls.enabled = false;

  // Neutralize controls.update() for the duration of the tween. Threlte's
  // <OrbitControls> runs controls.update() every frame while enableDamping is
  // true, and update() recomputes camera.position from spherical coordinates —
  // which would override our position lerp and snap the camera back. Reactively
  // disabling enableDamping handles most of it, but patching update() to a
  // no-op guarantees no call site (Threlte task, follow logic, etc.) can
  // fight the tween, regardless of prop-propagation timing.
  const originalUpdate = controls ? controls.update.bind(controls) : undefined;
  if (controls) {
    controls.update = (() => true) as typeof controls.update;
  }

  const start = performance.now();
  let raf: number | undefined;
  let done = false;
  const lastTarget = fromTarget.clone();

  function frame(now: number) {
    const t = Math.min(1, (now - start) / durationMs);
    const e = ease(t);

    // Lerp position in world space.
    camera.position.lerpVectors(fromPos, toPos, e);

    if (to.fov !== undefined) {
      camera.fov = fromFov + (to.fov - fromFov) * e;
      camera.updateProjectionMatrix();
    }

    // Lerp the look-at target and aim the camera directly — bypassing
    // OrbitControls.update() which would snap the camera back.
    lastTarget.lerpVectors(fromTarget, toTarget, e);
    camera.lookAt(lastTarget);

    if (t < 1) {
      raf = requestAnimationFrame(frame);
    } else {
      done = true;
      // Restore controls.update() and sync OrbitControls internal state with
      // the final camera position and target so it picks up smoothly.
      if (controls && originalUpdate) {
        controls.update = originalUpdate;
        controls.target.copy(lastTarget);
        controls.update();
        controls.enabled = wasEnabled;
      }
      onComplete?.();
    }
  }

  raf = requestAnimationFrame(frame);

  return () => {
    if (raf !== undefined) cancelAnimationFrame(raf);
    if (!done && controls) {
      // Restore update() and sync controls to the last known target so the
      // camera doesn't jump when controls re-enable.
      if (originalUpdate) controls.update = originalUpdate;
      controls.target.copy(lastTarget);
      controls.update();
      controls.enabled = wasEnabled;
    }
    done = true;
  };
}
