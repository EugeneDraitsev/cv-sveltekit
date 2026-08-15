import { describe, expect, it } from 'vitest';

import { generateStarSystem, getStarSystem } from './starSystem';

describe('procedural star systems', () => {
  it('is deterministic for every seed', () => {
    for (const seed of [0, 1, 42, 12345, 0x7fffffff]) {
      expect(generateStarSystem(seed)).toEqual(generateStarSystem(seed));
    }
  });

  it('memoizes generated systems', () => {
    expect(getStarSystem(90210)).toBe(getStarSystem(90210));
  });

  it('keeps generated values inside scene constraints', () => {
    for (let seed = 0; seed < 500; seed += 1) {
      const system = generateStarSystem(seed);
      expect(system.planets.length).toBeGreaterThanOrEqual(2);
      expect(system.planets.length).toBeLessThanOrEqual(6);
      expect(Number.isFinite(system.starRadius)).toBe(true);

      for (const [index, planet] of system.planets.entries()) {
        expect(planet.radius).toBeGreaterThan(0);
        expect(planet.orbitRadius).toBeGreaterThan(0);
        expect(Number.isFinite(planet.surface.heightScale)).toBe(true);
        if (index > 0) {
          expect(planet.orbitRadius).toBeGreaterThan(system.planets[index - 1].orbitRadius);
        }
      }
    }
  });
});
