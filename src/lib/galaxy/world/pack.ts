/**
 * Packs a star system into the `planetTex` data texture: one row of 144
 * RGBA32F texels per planet (moons get short rows after the planets).
 * The layout is mirrored by loadPlanet / loadBiome / the shading helpers.
 */
import { MATERIALS, RELIEF_STYLES } from './biomes';
import { FLORA_KINDS } from './floraMeshes';
import { srgbToLinear, hexToRgb, type Rgb } from './color';
import type { StarSystemData } from './system';
import { terrainParams } from './terrain';

export const PLANET_TEX_WIDTH = 144;
/** Texels per biome block (starting at texel 16). */
export const BIOME_STRIDE = 16;
export const PLANET_TEX_ROWS = 32;
export const MAX_PLANETS = 8;
export const MAX_MOONS = 16;

const WATER_IDS = { none: 0, water: 1, lava: 2, ice: 3, acid: 4 } as const;
const MOON_KINDS = { rock: 0, ice: 1, sulfur: 2, rust: 3 } as const;

export function packSystem(system: StarSystemData): Float32Array {
  const data = new Float32Array(PLANET_TEX_WIDTH * PLANET_TEX_ROWS * 4);
  const put = (row: number, texel: number, x: number, y = 0, z = 0, w = 0) => {
    const o = (row * PLANET_TEX_WIDTH + texel) * 4;
    data[o] = x;
    data[o + 1] = y;
    data[o + 2] = z;
    data[o + 3] = w;
  };
  const putRgb = (row: number, texel: number, c: Rgb, w = 0) => {
    const l = srgbToLinear(c);
    put(row, texel, l[0], l[1], l[2], w);
  };

  system.planets.slice(0, MAX_PLANETS).forEach((planet, row) => {
    const t = terrainParams(planet);
    const atm = planet.atmosphere;
    put(row, 0, t.offset[0], t.offset[1], t.offset[2], t.continentFreq);
    put(row, 1, t.seaThreshold, t.relief, planet.biomes.length, planet.giant ? 1 : 0);
    put(
      row,
      2,
      WATER_IDS[planet.water],
      planet.meters / 1e5,
      planet.seed % 1000,
      planet.turbulence,
    );
    putRgb(row, 3, planet.shallow, planet.sea);
    putRgb(row, 4, planet.deep, planet.clouds);
    // Rayleigh weights stay as-is (they are coefficients, not colours).
    put(row, 5, atm.rayleigh[0], atm.rayleigh[1], atm.rayleigh[2], atm.density);
    putRgb(row, 6, atm.hazeColor, atm.haze);
    putRgb(row, 7, planet.cloudColor, atm.height);
    planet.bands.forEach((band, i) => putRgb(row, 8 + i, band));
    putRgb(row, 12, planet.tint, planet.rings ? 1 : 0);
    planet.biomes.forEach((b, i) => {
      const base = 16 + i * BIOME_STRIDE;
      const tb = t.biomes[i];
      put(row, base, b.climate[0], b.climate[1], tb.amp, tb.freq);
      put(
        row,
        base + 1,
        RELIEF_STYLES.indexOf(b.spec.relief),
        MATERIALS.indexOf(b.spec.material),
        b.spec.snowBelow ?? 0,
        b.spec.grass,
      );
      putRgb(row, base + 2, b.low, b.spec.grassHeight ?? 0.4);
      putRgb(row, base + 3, b.mid, b.spec.glowStrength ?? 0);
      putRgb(row, base + 4, b.high);
      putRgb(row, base + 5, b.rock);
      putRgb(row, base + 6, b.foliage);
      putRgb(row, base + 7, b.spec.glow ? hexToRgb(b.spec.glow) : [0, 0, 0]);
      // Up to four flora kinds: (kind, density, min scale, max scale) and tint.
      b.spec.flora.slice(0, 4).forEach((f, k) => {
        put(row, base + 8 + k, FLORA_KINDS.indexOf(f.kind), f.density, f.scale[0], f.scale[1]);
        if (f.tint !== undefined) putRgb(row, base + 12 + k, hexToRgb(f.tint), 1);
        else putRgb(row, base + 12 + k, b.foliage, 0);
      });
      for (let k = b.spec.flora.length; k < 4; k++) put(row, base + 8 + k, -1, 0, 0, 0);
    });
  });

  let moonRow = MAX_PLANETS;
  for (const planet of system.planets) {
    for (const moon of planet.moons) {
      if (moonRow >= MAX_PLANETS + MAX_MOONS) break;
      put(
        moonRow,
        0,
        (moon.seed % 997) * 0.37,
        (moon.seed % 991) * 0.29,
        (moon.seed % 983) * 0.31,
        MOON_KINDS[moon.kind],
      );
      putRgb(moonRow, 1, moon.color);
      moonRow++;
    }
  }
  return data;
}
