import { describe, expect, it } from 'vitest';
import { chooseLandingSite } from '../engine/planetRig';
import { dot, length, normalize, type Vec3 } from '../engine/math';
import { cellular, fbm, gnoise } from './noise';
import { generateSystem, type PlanetData } from './system';
import { biomeAt, terrainHeight, terrainParams } from './terrain';

const ROCKY: PlanetData[] = Array.from({ length: 24 }, (_, seed) => generateSystem(seed).planets)
  .flat()
  .filter((p) => !p.giant);

const DIRECTIONS: Vec3[] = [
  [1, 0, 0],
  [0.3, 0.8, -0.52],
  [-0.61, -0.2, 0.77],
  [0.05, -0.99, 0.1],
  [-0.4, 0.4, -0.82],
].map((d) => normalize(d as Vec3));

describe('noise', () => {
  it('is deterministic, bounded and continuous', () => {
    for (let i = 0; i < 200; i++) {
      const p: Vec3 = [i * 0.37, i * -0.11 + 3, i * 0.73 - 9];
      const n = gnoise(...p);
      expect(n).toBe(gnoise(...p));
      expect(Math.abs(n)).toBeLessThanOrEqual(1);
      expect(Math.abs(gnoise(p[0] + 1e-4, p[1], p[2]) - n)).toBeLessThan(1e-3);
      expect(Number.isFinite(fbm(...p, 6))).toBe(true);
      const [f1, id] = cellular(...p);
      expect(f1).toBeGreaterThanOrEqual(0);
      expect(id).toBeGreaterThanOrEqual(0);
      expect(id).toBeLessThanOrEqual(1);
    }
  });
});

describe('terrain', () => {
  it('is finite, continuous and converges with more octaves', () => {
    for (const planet of ROCKY) {
      const params = terrainParams(planet);
      for (const d of DIRECTIONS) {
        const h = terrainHeight(params, ...d, 11);
        expect(Number.isFinite(h)).toBe(true);
        // ~1 m sideways never jumps more than a few dozen metres.
        const step = 1 / planet.meters;
        const near = terrainHeight(params, ...normalize([d[0] + step, d[1], d[2]]), 11);
        expect(Math.abs(near - h) * planet.meters).toBeLessThan(60);
        // Octaves past the eleventh only add sub-metre detail.
        expect(Math.abs(terrainHeight(params, ...d, 14) - h) * planet.meters).toBeLessThan(2);
        expect(biomeAt(params, ...d).index).toBeLessThan(planet.biomes.length);
      }
    }
  });

  it('gives each world real relief', () => {
    for (const planet of ROCKY.slice(0, 20)) {
      const params = terrainParams(planet);
      const heights = DIRECTIONS.map((d) => terrainHeight(params, ...d, 9) * planet.meters);
      expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(20);
    }
  });
});

describe('landing', () => {
  it('lands on dry ground facing along the surface', () => {
    let dry = 0;
    for (const planet of ROCKY) {
      const params = terrainParams(planet);
      const sun = normalize([0.4, 0.3, 0.86]);
      const { site, heading } = chooseLandingSite(planet, sun, sun);
      expect(length(site)).toBeCloseTo(1, 6);
      expect(Math.abs(dot(site, heading))).toBeLessThan(1e-6);
      if (planet.water === 'none' || terrainHeight(params, ...site, 10) > 0) dry++;
    }
    expect(dry / ROCKY.length).toBeGreaterThan(0.9);
  });
});
