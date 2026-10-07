import { describe, expect, it } from 'vitest';
import { SYSTEM_COUNT } from './galaxyMap';
import { MAX_PLANETS, PLANET_TEX_ROWS, PLANET_TEX_WIDTH, packSystem } from './pack';
import { generateSystem, getSystem } from './system';

const ALL = Array.from({ length: SYSTEM_COUNT }, (_, seed) => generateSystem(seed));

describe('star systems', () => {
  it('are reproducible from their seed', () => {
    expect(JSON.stringify(generateSystem(42))).toBe(JSON.stringify(generateSystem(42)));
    expect(getSystem(7)).toBe(getSystem(7));
  });

  it('stay within what the renderer can hold', () => {
    for (const system of ALL) {
      expect(system.stars.length).toBeGreaterThanOrEqual(1);
      expect(system.stars.length).toBeLessThanOrEqual(2);
      expect(system.planets.length).toBeGreaterThanOrEqual(1);
      expect(system.planets.length).toBeLessThanOrEqual(MAX_PLANETS);
      let previous = 0;
      for (const planet of system.planets) {
        expect(planet.orbit).toBeGreaterThan(previous);
        previous = planet.orbit;
        expect(planet.radius).toBeGreaterThan(0);
        expect(planet.meters).toBeGreaterThan(10_000);
        // Gas giants have no ground, rocky worlds always do.
        expect(planet.biomes.length).toBeGreaterThanOrEqual(planet.giant ? 0 : 1);
        expect(planet.biomes.length).toBeLessThanOrEqual(8);
        for (const biome of planet.biomes) {
          expect(biome.climate.every((c) => c >= 0 && c <= 1)).toBe(true);
          expect(biome.spec.flora.length).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it('fill the galaxy with varied worlds', () => {
    const planets = ALL.flatMap((s) => s.planets);
    const archetypes = new Set(planets.map((p) => p.archetype));
    const biomes = new Set(planets.flatMap((p) => p.biomes.map((b) => b.spec.id)));
    expect(archetypes.size).toBeGreaterThanOrEqual(10);
    expect(biomes.size).toBeGreaterThanOrEqual(30);
    expect(planets.some((p) => p.giant)).toBe(true);
    expect(planets.some((p) => p.rings)).toBe(true);
    expect(planets.some((p) => p.moons.length > 0)).toBe(true);
    expect(ALL.some((s) => s.stars.length === 2)).toBe(true);
  });

  it('pack into the planet data texture without NaNs', () => {
    for (const system of ALL.slice(0, 40)) {
      const data = packSystem(system);
      expect(data.length).toBe(PLANET_TEX_WIDTH * PLANET_TEX_ROWS * 4);
      expect(data.every(Number.isFinite)).toBe(true);
    }
  });
});
