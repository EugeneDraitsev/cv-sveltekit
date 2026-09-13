import { describe, expect, it } from 'vitest';
import { getStarSystem } from './starSystem';
import { createClimate, sampleGround } from './terrain';

describe('terrain and biome boundaries', () => {
  it('keeps collision above flooded terrain across procedural worlds', () => {
    for (const seed of [0, 7, 42, 1234, 99999]) {
      for (const { surface } of getStarSystem(seed).planets) {
        const climate = createClimate(surface);
        for (const [x, z] of [
          [0, 0],
          [18, -80],
          [-172, 125],
          [1000, -900],
        ]) {
          const sample = sampleGround(x, z, surface, climate);
          expect(Number.isFinite(sample.h)).toBe(true);
          expect(sample.ground).toBeGreaterThanOrEqual(sample.h);
          expect(sample.weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
          expect(sample.biomeIndex).toBeLessThan(surface.biomes.length);
          const neighbour = sampleGround(x + 0.001, z, surface, climate);
          expect(Math.abs(neighbour.h - sample.h)).toBeLessThan(0.02);
        }
      }
    }
  });

  it('gives dunes, ridges and terraces distinct continuous profiles', () => {
    const base = getStarSystem(42).planets[0].surface;
    const profiles = [0, 1, 2, 3].map((relief) => {
      const surface = structuredClone(base);
      surface.cloudMode = false;
      for (const biome of surface.biomes) biome.relief = relief;
      return [0, 20, 50, 100].map((x) => sampleGround(x, -30, surface).h);
    });
    expect(new Set(profiles.map((profile) => profile.join(','))).size).toBe(4);
  });
});
