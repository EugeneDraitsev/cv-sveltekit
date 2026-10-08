import { describe, expect, it } from 'vitest';
import { FACES, Quadtree, faceDirection } from './quadtree';

/** No frustum culling: every node in front of the horizon counts. */
const visible = () => true;

describe('cube-sphere quadtree', () => {
  it('maps every face onto the unit sphere', () => {
    for (let face = 0; face < 6; face++) {
      const centre = faceDirection(face, 0, 0);
      expect(centre).toEqual(FACES[face][0].map((v) => v + 0));
      for (const [u, v] of [
        [-1, -1],
        [1, 1],
        [0.3, -0.7],
      ]) {
        expect(Math.hypot(...faceDirection(face, u, v))).toBeCloseTo(1, 12);
      }
    }
    // Neighbouring faces share their edges.
    const a = faceDirection(0, 1, 0);
    const b = (() => {
      for (let face = 1; face < 6; face++) {
        for (const [u, v] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ]) {
          const p = faceDirection(face, u, v);
          if (Math.hypot(p[0] - a[0], p[1] - a[1], p[2] - a[2]) < 1e-9) return p;
        }
      }
      return null;
    })();
    expect(b).not.toBeNull();
  });

  it('refines toward the eye and streams patches in without holes', () => {
    // The high preset's atlas: 36 × 36 slots of 33 + 2 texels.
    const tree = new Quadtree({ resolution: 33, slots: 1296, maxLevel: 12, splitFactor: 1.6 });
    tree.maxRelief = 0.005;
    const eye: [number, number, number] = [0, 1.0004, 0];
    for (let i = 0; i < 400 && (i === 0 || tree.pending.length); i++) {
      tree.update(eye, visible);
      tree.markBuilt(tree.pending.slice(0, 16));
    }
    tree.update(eye, visible);
    const levels = tree.leaves.map((n) => n.level);
    expect(Math.max(...levels)).toBe(12);
    expect(new Set(tree.leaves.map((n) => n.key)).size).toBe(tree.leaves.length);
    expect(tree.leaves.every((n) => n.slot >= 0 && n.slot < 1296 && n.built >= 0)).toBe(true);
    // The finest leaf is the one under the camera.
    const finest = tree.leaves.find((n) => n.level === 12)!;
    expect(finest.center[1]).toBeGreaterThan(0.999);
  });
});
