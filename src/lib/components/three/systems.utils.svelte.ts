import { Vector3 } from 'three';
import type { Camera } from 'three';

import { positions, randomness, isNebula, scales, parameters } from './galaxy.utils.svelte';

/**
 * How many clickable "planetary systems" to expose on top of the galaxy.
 * These are a deterministic subset of the larger/brighter non-nebula stars;
 * hovering one shows a halo and clicking dives the camera in.
 */
export const SYSTEM_TARGET_COUNT = 120;

/**
 * Scale threshold above which a regular (non-nebula) particle is considered
 * bright enough to host a planetary system. Matches the upper end of the
 * regular-particle scale distribution in galaxy.utils.svelte.ts.
 */
const SYSTEM_SCALE_MIN = 14;

/**
 * Deterministic hash in 0..1 for stable per-index decisions.
 */
function hash(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Pick a deterministic, evenly-spread subset of particle indices to treat as
 * planetary systems. Scanned once on mount and whenever the galaxy regenerates
 * (count/structure change) so the systems always reference valid particles.
 */
export function selectSystemIndices(): number[] {
  const count = parameters.count;
  const candidates: number[] = [];
  for (let i = 0; i < count; i++) {
    if (isNebula[i] > 0.5) continue;
    if (scales[i] < SYSTEM_SCALE_MIN) continue;
    candidates.push(i);
  }
  if (candidates.length <= SYSTEM_TARGET_COUNT) return candidates;

  // Evenly stride across candidates so systems are spread over all arms/radii
  // instead of clumping at the low-index end.
  const stride = candidates.length / SYSTEM_TARGET_COUNT;
  const out: number[] = [];
  for (let j = 0; j < SYSTEM_TARGET_COUNT; j++) {
    out.push(candidates[Math.floor(j * stride)]);
  }
  return out;
}

const tmpVec = new Vector3();

/**
 * Compute the current world position of a particle by replicating the
 * vertex-shader spin math on the CPU. The shader rotates each particle around
 * the galactic Y axis with an angular speed inversely proportional to its
 * radius, then adds the per-particle randomness offset. Systems are always
 * non-nebula particles, so the nebula pulsing branch is intentionally skipped.
 */
export function getSystemWorldPosition(index: number, time: number, out: Vector3): Vector3 {
  const i3 = index * 3;
  const baseX = positions[i3];
  const baseY = positions[i3 + 1];
  const baseZ = positions[i3 + 2];

  const rx = randomness[i3];
  const ry = randomness[i3 + 1] * 0.8; // shader applies finalRandomness.y *= 0.8
  const rz = randomness[i3 + 2];

  const dist = Math.hypot(baseX, baseZ);
  const safeDist = Math.max(dist, 0.001);
  const spinFactor = 0.2; // regular (non-nebula) particle
  const angle = Math.atan2(baseX, baseZ) + (1.0 / safeDist) * time * spinFactor;

  const spunX = Math.cos(angle) * dist;
  const spunZ = Math.sin(angle) * dist;

  out.set(spunX + rx, baseY + ry, spunZ + rz);
  return out;
}

/**
 * Find the system whose projected screen position is closest to the pointer
 * NDC, within `maxNdcDist`. Returns the system index or null.
 *
 * Screen-space matching is more forgiving than raycasting a 150k-point cloud
 * and lets the visitor snap to a system without pixel-perfect aim.
 */
export function findHoveredSystem(
  camera: Camera,
  systemIndices: number[],
  time: number,
  ndcX: number,
  ndcY: number,
  maxNdcDist: number,
): number | null {
  let bestIndex: number | null = null;
  let bestDist = maxNdcDist;

  for (const index of systemIndices) {
    getSystemWorldPosition(index, time, tmpVec);
    tmpVec.project(camera);

    // Behind the camera or outside the frustum horizontally — skip.
    if (tmpVec.z < -1 || tmpVec.z > 1) continue;

    const dx = tmpVec.x - ndcX;
    const dy = tmpVec.y - ndcY;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = index;
    }
  }

  return bestIndex;
}

export { tmpVec as systemTmpVec };
