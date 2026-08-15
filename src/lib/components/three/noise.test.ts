import { describe, expect, it } from 'vitest';

import { biomeWeights, fbm3o, fbm5, snoise2 } from './noise';

describe('CPU terrain noise contract', () => {
  it('keeps golden samples stable for the GLSL mirror', () => {
    expect(snoise2(0.125, -0.75)).toBeCloseTo(-0.4092557255687033, 12);
    expect(fbm5(0.125, -0.75)).toBeCloseTo(-0.1905677585370934, 12);
    expect(fbm3o(0.125, -0.75)).toBeCloseTo(-0.24873668067698074, 12);
    expect(snoise2(12.34, 56.78)).toBeCloseTo(-0.5639787971337703, 12);
    expect(fbm5(12.34, 56.78)).toBeCloseTo(-0.44297795395801337, 12);
  });

  it('normalizes biome weights', () => {
    const weights = biomeWeights(1.25, -3.5, {
      climateScale: 0.1,
      climOffTX: 1,
      climOffTY: 2,
      climOffMX: 3,
      climOffMY: 4,
      centers: [
        [0, 0],
        [0.5, -0.25],
        [-0.4, 0.6],
      ],
    });

    expect(weights).toHaveLength(3);
    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 12);
    expect(weights.every((weight) => weight >= 0 && weight <= 1)).toBe(true);
  });
});
