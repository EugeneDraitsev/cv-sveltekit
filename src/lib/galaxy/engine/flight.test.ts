import { describe, expect, it } from 'vitest';
import { orbitPose, poseBasis, type Pose } from './camera';
import {
  add,
  cross,
  dot,
  length,
  normalize,
  quatFromView,
  quatView,
  scale,
  type Vec3,
} from './math';
import { ascentPose, planetFlightPose } from './planetRig';

const close = (a: Vec3, b: Vec3, eps = 1e-6) =>
  length([a[0] - b[0], a[1] - b[1], a[2] - b[2]]) < eps;

/** Largest change of the rendered forward or up between consecutive samples, in radians. */
function maxTurn(path: (t: number) => Pose, steps = 400) {
  let worst = 0;
  let prev = poseBasis(path(0));
  for (let i = 1; i <= steps; i++) {
    const pose = poseBasis(path(i / steps));
    for (const key of ['forward', 'up'] as const) {
      const d = Math.min(1, dot(prev[key], pose[key]));
      worst = Math.max(worst, Math.acos(d));
    }
    prev = pose;
  }
  return worst;
}

/** A surface pose: 38 m above `site`, looking along `heading`, slightly down. */
function groundPose(site: Vec3, heading: Vec3): Pose {
  const up = normalize(site);
  const h = normalize(add(heading, scale(up, -dot(heading, up))));
  const forward = normalize(add(scale(h, Math.cos(-0.1)), scale(up, Math.sin(-0.1))));
  return { eye: scale(up, 1.0003), forward, up, fov: 62 };
}

const SITES: [Vec3, Vec3][] = [
  [
    [0, 1, 0],
    [1, 0, 0],
  ],
  [
    [0.3, 0.2, 0.93],
    [0, 1, 0],
  ],
  [
    [-0.7, -0.1, 0.7],
    [0.2, 0.9, 0.3],
  ],
  [
    [0.01, -0.99, 0.05],
    [0, 0, 1],
  ],
];

describe('camera quaternions', () => {
  it('round-trip a view basis', () => {
    for (const [forward, up] of [
      [
        [0, 0, -1],
        [0, 1, 0],
      ],
      [
        [0.3, -0.9, 0.2],
        [0, 1, 0],
      ],
      [
        [0, -1, 0],
        [1, 0, 0],
      ],
    ] as [Vec3, Vec3][]) {
      const view = quatView(quatFromView(forward, up));
      expect(close(view.forward, normalize(forward))).toBe(true);
      const right = normalize(cross(normalize(forward), up));
      expect(close(view.up, cross(right, normalize(forward)))).toBe(true);
    }
  });
});

describe('landing and take-off paths', () => {
  it('turn smoothly, without a spinning roll', () => {
    for (const [site, heading] of SITES) {
      const ground = groundPose(site, heading);
      const from = orbitPose([0, 0, 0], 0.4, 0.3, 4.8, 0, 40);
      const landing = maxTurn((t) => planetFlightPose(from, ground, t, () => 0));
      const orbit = orbitPose([0, 0, 0], Math.atan2(site[0], site[2]), 0.2, 4.8, 0, 40);
      const takeOff = maxTurn((t) => ascentPose(ground, orbit, t));
      // 400 steps: a smooth path never turns more than a few degrees a step.
      expect(landing).toBeLessThan(0.08);
      expect(takeOff).toBeLessThan(0.08);
    }
  });

  it('never flip, whatever the approach', () => {
    // A fixed pseudo-random spread of orbits, sites and headings, including
    // approaches from behind the planet and straight over a pole.
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let i = 0; i < 60; i++) {
      const site = normalize([rand(), rand(), rand()]);
      const ground = groundPose(site, [rand(), rand(), rand()]);
      const from = orbitPose(
        [0, 0, 0],
        rand() * 3.2,
        rand() * 1.4,
        3 + Math.abs(rand()) * 25,
        0,
        40,
      );
      expect(maxTurn((t) => planetFlightPose(from, ground, t, () => 0))).toBeLessThan(0.08);
    }
  });

  it('end exactly where the orbit rig takes over', () => {
    const ground = groundPose([0.3, 0.2, 0.93], [0, 1, 0]);
    const orbit = orbitPose([0, 0, 0], 0.31, 0.2, 4.8, 0, 40);
    const end = ascentPose(ground, orbit, 1);
    expect(close(end.eye, orbit.eye)).toBe(true);
    expect(close(end.forward, orbit.forward)).toBe(true);
    expect(close(end.up, orbit.up)).toBe(true);
    // And the step just before the end is already almost there.
    const before = ascentPose(ground, orbit, 0.995);
    expect(dot(before.up, orbit.up)).toBeGreaterThan(0.9999);
  });
});
