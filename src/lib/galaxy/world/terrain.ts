/**
 * CPU twin of shaders/planet.wgsl: terrain height, climate and biome
 * weights. The camera stands on this height, landing sites are chosen with it
 * and the HUD names the biome under the player. Keep in lock-step with WGSL.
 */
import { cellular, fbm, gnoise, ridged } from './noise';
import { RELIEF_STYLES } from './biomes';
import type { PlanetData } from './system';

export type Vec3 = [number, number, number];

/** GPU-facing numbers derived from a PlanetData. */
export interface TerrainParams {
  offset: Vec3;
  continentFreq: number;
  seaThreshold: number;
  relief: number;
  giant: boolean;
  biomes: { climate: [number, number]; amp: number; freq: number; style: number }[];
}

const paramsCache = new WeakMap<PlanetData, TerrainParams>();

/** Base relief in planet radii: oceans and continental shelves. */
const BASE_RELIEF = 0.011;

export function terrainParams(planet: PlanetData): TerrainParams {
  let params = paramsCache.get(planet);
  if (params) return params;
  params = {
    offset: planet.offset,
    continentFreq: planet.continentFreq,
    seaThreshold: 0,
    relief: BASE_RELIEF * planet.relief * (120e3 / planet.meters) ** 0.5,
    giant: planet.giant,
    biomes: planet.biomes.map((b) => ({
      climate: b.climate,
      amp: b.amp * planet.relief,
      freq: b.freq,
      style: RELIEF_STYLES.indexOf(b.spec.relief),
    })),
  };
  params.seaThreshold = calibrateSea(params, planet.sea);
  paramsCache.set(planet, params);
  return params;
}

/** Pick the continent threshold that floods the requested surface fraction. */
function calibrateSea(params: TerrainParams, fraction: number) {
  if (fraction <= 0.001) return -1;
  const samples: number[] = [];
  const count = 900;
  for (let i = 0; i < count; i++) {
    // Fibonacci sphere: an even, deterministic sample of the surface.
    const y = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.399963229728653;
    samples.push(continent(params, Math.cos(a) * r, y, Math.sin(a) * r));
  }
  samples.sort((a, b) => a - b);
  return samples[Math.min(count - 1, Math.floor(fraction * count))];
}

function continent(params: TerrainParams, x: number, y: number, z: number) {
  const f = params.continentFreq;
  const px = x * f + params.offset[0];
  const py = y * f + params.offset[1];
  const pz = z * f + params.offset[2];
  return fbm(px, py, pz, 5) + fbm(px * 4.3 + 3.1, py * 4.3 + 7.7, pz * 4.3 + 1.9, 3) * 0.18;
}

export function climate(params: TerrainParams, x: number, y: number, z: number): [number, number] {
  const qx = x * 1.7 + params.offset[0] * 0.37 + 11.3;
  const qy = y * 1.7 + params.offset[1] * 0.37;
  const qz = z * 1.7 + params.offset[2] * 0.37;
  const tn = fbm(qx, qy, qz, 3);
  const mn = fbm(qx * 1.3 + 31.7, qy * 1.3 + 5.1, qz * 1.3 + 2.3, 3);
  const t = 0.5 + tn * 0.8 + (0.35 - Math.pow(Math.abs(y), 1.5)) * 0.75;
  const m = 0.5 + mn;
  return [Math.min(1, Math.max(0, t)), Math.min(1, Math.max(0, m))];
}

const SHARPNESS = 60;
const weight = (c: [number, number], center: [number, number]) => {
  const dx = c[0] - center[0];
  const dy = c[1] - center[1];
  return Math.exp(-(dx * dx + dy * dy) * SHARPNESS);
};

/** Index of the dominant biome and the per-biome weights. */
export function biomeAt(params: TerrainParams, x: number, y: number, z: number) {
  const c = climate(params, x, y, z);
  let best = -1;
  let index = 0;
  const weights = params.biomes.map((b, i) => {
    const w = weight(c, b.climate);
    if (w > best) {
      best = w;
      index = i;
    }
    return w;
  });
  return { index, weights, climate: c };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const fract = (v: number) => v - Math.floor(v);

function reliefShape(
  style: number,
  x: number,
  y: number,
  z: number,
  freq: number,
  o: Vec3,
  octaves: number,
): number {
  const k = 70 * freq;
  const px = x * k + o[0];
  const py = y * k + o[1];
  const pz = z * k + o[2];
  switch (style) {
    case 0:
      return 0.25 + fbm(px * 0.6, py * 0.6, pz * 0.6, octaves - 2) * 0.5;
    case 1:
      return 0.5 + fbm(px, py, pz, octaves) * 0.9;
    case 2: {
      const wx = gnoise(px * 0.5, py * 0.5, pz * 0.5) * 0.6;
      const wy = gnoise(px * 0.5 + 5.2, py * 0.5 + 5.2, pz * 0.5 + 5.2) * 0.6;
      const wz = gnoise(px * 0.5 + 9.7, py * 0.5 + 9.7, pz * 0.5 + 9.7) * 0.6;
      const r = ridged(px * 0.8 + wx, py * 0.8 + wy, pz * 0.8 + wz, octaves);
      return Math.pow(Math.max(r, 0), 1.35) * 1.4;
    }
    case 3: {
      const warp = fbm(px * 0.35, py * 0.35, pz * 0.35, 3) * 2.2;
      const l = Math.hypot(0.8, 0.15, 0.58);
      const s = ((px * 0.8 + py * 0.15 + pz * 0.58) / l) * 5.2 + warp;
      const xx = fract(s);
      const dune = xx < 0.72 ? xx / 0.72 : 1 - (xx - 0.72) / 0.28;
      const crest = Math.pow(Math.min(1, Math.max(0, dune)), 1.6);
      return (
        crest * (0.55 + 0.45 * gnoise(px * 0.21, py * 0.21, pz * 0.21)) +
        fbm(px * 2, py * 2, pz * 2, octaves - 3) * 0.08 +
        0.2
      );
    }
    case 4: {
      const v = 0.5 + fbm(px * 0.7, py * 0.7, pz * 0.7, octaves - 1) * 1.1;
      const steps = 4;
      const level = Math.floor(v * steps);
      const edge = smoothstep(0.74, 1, fract(v * steps));
      return (level + edge) / steps + fbm(px * 3, py * 3, pz * 3, 3) * 0.03;
    }
    case 5: {
      const plateau = 0.75 + fbm(px * 0.5, py * 0.5, pz * 0.5, 4) * 0.35;
      const w = fbm(px * 0.2, py * 0.2, pz * 0.2, 2) * 1.5;
      const channel = Math.abs(gnoise(px * 0.45 + w, py * 0.45 + w, pz * 0.45 + w));
      const carve = smoothstep(0, 0.16, channel);
      const shelf = carve * 5 + 0.5;
      const terraces = (Math.floor(shelf) + smoothstep(0.72, 1, fract(shelf))) / 5;
      return (
        plateau * (carve + (terraces - carve) * 0.45) +
        fbm(px * 2.5, py * 2.5, pz * 2.5, octaves - 3) * 0.05
      );
    }
    case 6: {
      let h = 0.35 + fbm(px * 0.6, py * 0.6, pz * 0.6, octaves - 2) * 0.4;
      let s = 0.35;
      let amp = 1;
      for (let kk = 0; kk < 2; kk++) {
        const [dist, id] = cellular(px * s + kk * 17, py * s + kk * 17, pz * s + kk * 17);
        const radius = 0.18 + id * 0.3;
        const r = dist / radius;
        if (r < 1.6) {
          const bowl = (r * r - 1) * 0.55;
          const rim = Math.exp(-Math.pow((r - 1) / 0.22, 2)) * 0.35;
          h += (Math.min(bowl, 0) + rim) * amp * smoothstep(1.6, 1.2, r) * (id >= 0.35 ? 1 : 0);
        }
        s *= 2.6;
        amp *= 0.45;
      }
      return h;
    }
    case 7: {
      const [dist, id] = cellular(px * 1.8, py * 1.8, pz * 1.8);
      const spire = Math.pow(Math.max(0, 1 - dist * 1.5), 2.2) * (id >= 0.45 ? 1 : 0) * (0.8 + id);
      return 0.25 + fbm(px * 0.5, py * 0.5, pz * 0.5, octaves - 2) * 0.35 + spire * 1.5;
    }
    case 8: {
      const [r, id] = cellular(px * 0.3, py * 0.3, pz * 0.3);
      const cone = Math.max(0, 1 - r * 1.25) * (0.5 + id);
      const caldera = smoothstep(0.18, 0.05, r) * 0.45 * id;
      const flows = fbm(px * 1.1, py * 1.1, pz * 1.1, octaves - 1) * 0.35;
      return 0.2 + cone * cone * 1.6 - caldera + flows;
    }
    default: {
      const base = 0.45 + fbm(px * 0.5, py * 0.5, pz * 0.5, octaves - 2) * 0.5;
      const crack = 1 - smoothstep(0, 0.05, Math.abs(gnoise(px * 1.7, py * 1.7, pz * 1.7)));
      return base - crack * 0.12;
    }
  }
}

/** Height above sea level in planet radii for the unit direction (x, y, z). */
export function terrainHeight(
  params: TerrainParams,
  x: number,
  y: number,
  z: number,
  octaves = 11,
): number {
  if (params.giant) {
    const o = params.offset;
    return 0.0004 * fbm(x * 40 + o[0], y * 40 + o[1], z * 40 + o[2], 4);
  }
  const e = continent(params, x, y, z) - params.seaThreshold;
  let h = e > 0 ? e * params.relief * 0.55 : e * params.relief * 1.6;
  const land = smoothstep(-0.012, 0.22, e);
  const c = climate(params, x, y, z);
  let total = 0;
  let relief = 0;
  params.biomes.forEach((b, i) => {
    const w = weight(c, b.climate);
    total += w;
    if (w > 0.004) {
      const o: Vec3 = [
        params.offset[0] + i * 13.1,
        params.offset[1] + i * 13.1,
        params.offset[2] + i * 13.1,
      ];
      relief += w * reliefShape(b.style, x, y, z, b.freq, o, octaves) * b.amp;
    }
  });
  h += (relief / Math.max(total, 1e-6)) * land;
  return h;
}
