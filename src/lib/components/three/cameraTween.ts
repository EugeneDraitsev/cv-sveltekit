import { Matrix4, Quaternion, Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface TweenTarget {
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
  /** Lateral travel as a fraction of the route length. */
  arc?: number;
  /** Small roll into the turn, in radians. */
  bank?: number;
}
export type Easing = (t: number) => number;
export const easeInCubic: Easing = (t) => t * t * t;
export const easeOutCubic: Easing = (t) => 1 - Math.pow(1 - t, 3);
/** Quintic smootherstep: zero velocity and acceleration at both ends. */
export const easeInOutQuint: Easing = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
export function smoothstepJs(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
export interface CameraFlight {
  /** Advance in seconds, from the scene task immediately before rendering. */
  advance: (delta: number) => void;
  cancel: () => void;
}

/** Camera and transition share the renderer's clock; no competing rAF loops. */
export function createCameraFlight(
  camera: PerspectiveCamera,
  controls: OrbitControls | undefined,
  to: TweenTarget,
  duration: number,
  options: {
    onComplete?: () => void;
    onProgress?: (progress: number, eased: number) => void;
    ease?: Easing;
    /** Departures leave the scene, so must never reapply orbit distance limits. */
    handoff?: boolean;
  } = {},
): CameraFlight {
  const fromPos = camera.position.clone();
  const fromTarget = controls?.target.clone() ?? new Vector3();
  const fromFov = camera.fov;
  const toPos = new Vector3(...to.position);
  const toTarget = new Vector3(...to.target);
  const fromQuaternion = camera.quaternion.clone();
  const lookMatrix = new Matrix4();
  const lookQuaternion = new Quaternion();
  const side = new Vector3().subVectors(toPos, fromPos).cross(camera.up).normalize();
  const arcLength = fromPos.distanceTo(toPos) * (to.arc ?? 0.09);
  const originalUpdate = controls?.update;
  const wasEnabled = controls?.enabled ?? true;
  const lastTarget = fromTarget.clone();
  const ease = options.ease ?? easeInOutQuint;
  let elapsed = 0;
  let done = false;

  if (controls && originalUpdate) {
    // Consume residual drag/dolly damping without exposing its camera movement.
    const damping = controls.enableDamping;
    controls.enableDamping = false;
    originalUpdate.call(controls);
    camera.position.copy(fromPos);
    camera.quaternion.copy(fromQuaternion);
    controls.target.copy(fromTarget);
    controls.enableDamping = damping;
    controls.enabled = false;
    controls.update = (() => false) as typeof controls.update;
  }
  function release(sync: boolean) {
    if (!controls || !originalUpdate) return;
    controls.update = originalUpdate;
    controls.target.copy(lastTarget);
    if (sync) {
      const damping = controls.enableDamping;
      controls.enableDamping = false;
      originalUpdate.call(controls);
      controls.enableDamping = damping;
    }
    controls.enabled = wasEnabled;
  }
  return {
    advance(delta) {
      if (done) return;
      elapsed += Math.max(0, Math.min(delta, 0.05));
      const t = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
      const e = ease(t);
      const turn = Math.sin(Math.PI * e);
      camera.position.lerpVectors(fromPos, toPos, e).addScaledVector(side, turn * arcLength);
      if (to.fov !== undefined) {
        camera.fov = fromFov + (to.fov - fromFov) * e;
        camera.updateProjectionMatrix();
      }
      lastTarget.lerpVectors(fromTarget, toTarget, e);
      lookMatrix.lookAt(camera.position, lastTarget, camera.up);
      lookQuaternion.setFromRotationMatrix(lookMatrix);
      camera.quaternion
        .copy(fromQuaternion)
        .slerp(lookQuaternion, easeInOutQuint(Math.min(1, t / 0.65)));
      camera.rotateZ(turn * turn * (to.bank ?? 0.025));
      options.onProgress?.(t, e);
      if (t === 1) {
        done = true;
        release(!options.handoff);
        options.onComplete?.();
      }
    },
    cancel() {
      if (done) return;
      done = true;
      release(false);
    },
  };
}
