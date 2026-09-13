/**
 * Procedural star-system generator.
 *
 * A system is derived entirely from a numeric seed (the galaxy particle index),
 * so every clickable star resolves to a stable, unique system: star class,
 * color and size, planet roster with archetypes, palettes, moons, rings, and
 * the full set of surface parameters the planet flyover scene needs.
 *
 * Pure data — no three.js imports — so it stays cheap to generate (~µs) and
 * easy to reason about. Colors are packed as 0xRRGGBB numbers.
 */

import { mulberry32, range, rangeInt, chance, pick, pickWeighted, type Rng } from './rng';

// ─── Color helpers ─────────────────────────────────────────────────────────

export function hexCss(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}

function mixHex(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export function lightenHex(hex: number, t: number): number {
  return mixHex(hex, 0xffffff, t);
}

export function darkenHex(hex: number, t: number): number {
  return mixHex(hex, 0x000000, t);
}

function hslToHex(h: number, s: number, l: number): number {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r: number;
  let g: number;
  let b: number;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return (
    (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255)
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────

export type StarClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';

export type PlanetArchetype = 'terran' | 'ocean' | 'desert' | 'ice' | 'lava' | 'barren' | 'gas';

export type FloraKind = 'trees' | 'palms' | 'cacti' | 'shards' | 'rocks' | 'none';

export interface MoonData {
  size: number;
  orbitRadius: number;
  orbitSpeed: number;
  phase: number;
  inclination: number;
  color: number;
}

export interface RingData {
  innerRadius: number;
  outerRadius: number;
  color: number;
  opacity: number;
}

/**
 * One biome: a full elevation palette plus flora and a relief multiplier.
 * `climate` is the biome's home in the 2D climate space (temperature ×
 * moisture noise); terrain blends biomes by their distance to the local
 * climate — Minecraft-style regions with soft borders.
 */
export interface BiomeDef {
  name: string;
  low: number;
  mid: number;
  high: number;
  peak: number;
  /** Relief multiplier — lets one biome be flats and its neighbor mountains. */
  heightMul: number;
  /** 0 rolling hills, 1 dunes, 2 ridges, 3 terraces. Blends at biome borders. */
  relief: number;
  flora: FloraKind;
  floraColors: [number, number];
  /** 0..1 spawn probability inside this biome. */
  floraDensity: number;
  climate: [number, number];
}

/** Everything the planet flyover scene needs to render this world's surface. */
export interface SurfaceParams {
  /** Vertical amplitude of the terrain displacement. */
  heightScale: number;
  /** Noise frequency — lower produces larger landforms. */
  terrainScale: number;
  /** Normalized (0..1) level below which terrain floods; -1 disables. */
  waterLevel: number;
  waterKind: 'water' | 'lava' | 'ice' | 'none';
  /** Gas giants: render soft rolling cloud tops instead of rock. */
  cloudMode: boolean;
  waterColor: number;
  cliffColor: number;
  /** 2–4 procedural biomes drawn from the archetype's logical pool. */
  biomes: BiomeDef[];
  /** Climate-noise frequency (fraction of terrainScale → biome patch size). */
  climateScale: number;
  /** Decorrelated offsets for the temperature / moisture noise channels. */
  climOffTX: number;
  climOffTY: number;
  climOffMX: number;
  climOffMY: number;
  skyHorizon: number;
  skyZenith: number;
  fogColor: number;
  /** 0..1 — how visible background stars are from the surface (thin atmosphere → 1). */
  skyStars: number;
  /** Noise-space offset so two same-archetype planets never share terrain. */
  offsetX: number;
  offsetY: number;
}

export interface PlanetData {
  name: string;
  archetype: PlanetArchetype;
  archetypeLabel: string;
  seed: number;
  /** Visual radius in system-scene units. */
  radius: number;
  orbitRadius: number;
  orbitSpeed: number;
  phase: number;
  inclination: number;
  /** Surface shader palette (system view). */
  colorA: number;
  colorB: number;
  colorC: number;
  atmosphereColor: number;
  atmosphereCss: string;
  /** 0..1 — cloud layer opacity in the system view (terran/ocean). */
  cloudiness: number;
  /** 0..1 — latitude banding (gas giants). */
  bandAmount: number;
  /** 0..1 — emissive crack glow (lava worlds). */
  emissive: number;
  rings: RingData | null;
  moons: MoonData[];
  surface: SurfaceParams;
}

export interface StarSystemData {
  seed: number;
  name: string;
  subtitle: string;
  starClass: StarClass;
  starColor: number;
  starColorCss: string;
  /** Warm-white tint used for scene lighting so planets don't go monochrome. */
  starLightColor: number;
  starRadius: number;
  planets: PlanetData[];
}

// ─── Star classes ──────────────────────────────────────────────────────────

const STAR_CLASSES: readonly (readonly [
  { cls: StarClass; color: number; sizeMin: number; sizeMax: number },
  number,
])[] = [
  [{ cls: 'M', color: 0xff8a5c, sizeMin: 0.9, sizeMax: 1.25 }, 30],
  [{ cls: 'K', color: 0xffb072, sizeMin: 1.05, sizeMax: 1.45 }, 22],
  [{ cls: 'G', color: 0xffdfa0, sizeMin: 1.2, sizeMax: 1.65 }, 18],
  [{ cls: 'F', color: 0xfff3da, sizeMin: 1.3, sizeMax: 1.8 }, 12],
  [{ cls: 'A', color: 0xdde8ff, sizeMin: 1.5, sizeMax: 2.1 }, 9],
  [{ cls: 'B', color: 0xbcd2ff, sizeMin: 1.8, sizeMax: 2.5 }, 6],
  [{ cls: 'O', color: 0xa4bfff, sizeMin: 2.1, sizeMax: 2.9 }, 3],
];

// ─── Names ─────────────────────────────────────────────────────────────────

const SYL_START = [
  'Ka',
  'Ve',
  'Tho',
  'Za',
  'Ael',
  'Or',
  'Ny',
  'Cy',
  'Ser',
  'Mar',
  'Tal',
  'Ish',
  'Ran',
  'Vel',
  'Dra',
  'Pha',
  'Lu',
  'Xan',
  'Bel',
  'Ery',
  'Kep',
  'Al',
  'Ori',
  'Rhe',
  'Sol',
  'Und',
  'Vor',
  'Nim',
  'Cal',
  'Teg',
];
const SYL_END = [
  'ra',
  'lis',
  'dun',
  'veth',
  'mir',
  'on',
  'ari',
  'eus',
  'ione',
  'ath',
  'em',
  'ys',
  'una',
  'or',
  'an',
  'iel',
  'os',
  'ea',
  'ax',
  'ium',
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function generateName(rng: Rng): string {
  let name = pick(rng, SYL_START) + pick(rng, SYL_END);
  if (chance(rng, 0.3)) name += pick(rng, SYL_END);
  if (chance(rng, 0.32)) name += `-${rangeInt(rng, 2, 9)}`;
  else if (chance(rng, 0.12)) name += pick(rng, [' Prime', ' Major', ' Minor']);
  return name;
}

const ARCHETYPE_LABELS: Record<PlanetArchetype, string> = {
  terran: 'Terran world',
  ocean: 'Ocean world',
  desert: 'Desert world',
  ice: 'Ice world',
  lava: 'Volcanic world',
  barren: 'Barren world',
  gas: 'Gas giant',
};

// ─── Surface builders ──────────────────────────────────────────────────────

type BiomeSeed = Omit<BiomeDef, 'climate' | 'relief'>;

/** Small per-planet tint so two planets never share exact biome colors. */
function tint(rng: Rng, hex: number, amount = 0.1): number {
  const t = range(rng, -amount, amount);
  return t >= 0 ? lightenHex(hex, t) : darkenHex(hex, -t);
}

function biome(
  rng: Rng,
  name: string,
  low: number,
  mid: number,
  high: number,
  peak: number,
  heightMul: [number, number],
  flora: FloraKind,
  floraColors: [number, number],
  floraDensity: [number, number],
): BiomeSeed {
  return {
    name,
    low: tint(rng, low),
    mid: tint(rng, mid),
    high: tint(rng, high),
    peak: tint(rng, peak, 0.05),
    heightMul: range(rng, heightMul[0], heightMul[1]),
    flora,
    floraColors: [tint(rng, floraColors[0]), tint(rng, floraColors[1])],
    floraDensity: range(rng, floraDensity[0], floraDensity[1]),
  };
}

// Logical biome pools per archetype. Each planet draws 2–4 DISTINCT entries,
// then jitters colors/relief/density — endless variety that stays plausible:
// a terran world mixes meadows with forests and highlands, a gas giant mixes
// cloud decks, never a snowfield next to a lava flat.
const BIOME_POOLS: Record<PlanetArchetype, ((rng: Rng) => BiomeSeed)[]> = {
  terran: [
    (r) =>
      biome(
        r,
        'Meadow',
        0xd8c48c,
        0x6fae52,
        0x3f7a42,
        0xf4f7fa,
        [0.8, 0.95],
        'trees',
        [0x4a8a3e, 0x63a24e],
        [0.35, 0.55],
      ),
    (r) =>
      biome(
        r,
        'Forest',
        0xc4b184,
        0x3f7f3a,
        0x2a5c30,
        0xe8f0ea,
        [0.95, 1.15],
        'trees',
        [0x24501f, 0x2f6b3c],
        [0.8, 1],
      ),
    (r) =>
      biome(
        r,
        'Savanna',
        0xe0c98c,
        0xb0a24e,
        0x8a7a3c,
        0xd8cfa8,
        [0.6, 0.78],
        'trees',
        [0x6e7a34, 0x8a8a42],
        [0.15, 0.3],
      ),
    (r) =>
      biome(
        r,
        'Highlands',
        0x8a9478,
        0x74806a,
        0x8c887c,
        0xe8ecef,
        [1.25, 1.5],
        'rocks',
        [0x6a6458, 0x7d766a],
        [0.3, 0.45],
      ),
    (r) =>
      biome(
        r,
        'Tundra',
        0xaab49a,
        0x9aa88e,
        0xc8d2c8,
        0xf4f7fa,
        [0.7, 0.85],
        'shards',
        [0xd8e4ea, 0xb8ccd8],
        [0.08, 0.18],
      ),
    (r) =>
      biome(
        r,
        'Wetlands',
        0x6a8a4e,
        0x3d7a44,
        0x2f6b3c,
        0x9ab88a,
        [0.45, 0.6],
        'palms',
        [0x2f7a3c, 0x4a9a50],
        [0.4, 0.6],
      ),
  ],
  ocean: [
    (r) =>
      biome(
        r,
        'Atolls',
        0xe6d7a3,
        0x76b868,
        0x3d8a4a,
        0xf0f4ea,
        [0.62, 0.78],
        'palms',
        [0x3f8a4f, 0x63a24e],
        [0.5, 0.7],
      ),
    (r) =>
      biome(
        r,
        'Tropics',
        0xd8c48c,
        0x3f9a52,
        0x2e7a40,
        0xe8f0f2,
        [0.95, 1.15],
        'palms',
        [0x2e7a40, 0x4a9a50],
        [0.75, 0.95],
      ),
    (r) =>
      biome(
        r,
        'Skerries',
        0x9a958a,
        0x7a7568,
        0x8c887c,
        0xeef2f4,
        [1.2, 1.45],
        'rocks',
        [0x6a6458, 0x8a8478],
        [0.25, 0.4],
      ),
    (r) =>
      biome(
        r,
        'Kelp shallows',
        0xb8c98c,
        0x5a9a5e,
        0x3f7a4a,
        0xd8e8da,
        [0.5, 0.65],
        'none',
        [0x3f8a4f, 0x63a24e],
        [0, 0],
      ),
  ],
  desert: [
    (r) =>
      biome(
        r,
        'Golden dunes',
        0xe8c98c,
        0xdcb26e,
        0xc49a54,
        0xf0e2b8,
        [0.68, 0.85],
        'cacti',
        [0x4a7a3d, 0x6b8a4a],
        [0.2, 0.35],
      ),
    (r) =>
      biome(
        r,
        'Red mesa',
        0xc46a3f,
        0x9c4c2c,
        0x7d3a22,
        0xd8956a,
        [1.3, 1.55],
        'rocks',
        [0x6e3a24, 0x8a4a2e],
        [0.28, 0.42],
      ),
    (r) =>
      biome(
        r,
        'Salt flats',
        0xece4d4,
        0xe0d8c4,
        0xcfc7b2,
        0xf8f4ea,
        [0.28, 0.42],
        'none',
        [0xd8cfc0, 0xe8e0d0],
        [0, 0],
      ),
    (r) =>
      biome(
        r,
        'Cracked clay',
        0xb8794a,
        0x9a6238,
        0x7d4e2e,
        0xc99a6e,
        [0.55, 0.7],
        'rocks',
        [0x7d5638, 0x9a6e48],
        [0.18, 0.3],
      ),
  ],
  ice: [
    (r) =>
      biome(
        r,
        'Snowfields',
        0xdfe9f2,
        0xd4e2ee,
        0xe8f0f8,
        0xffffff,
        [0.78, 0.95],
        'shards',
        [0xcfe6f5, 0x9fc4dd],
        [0.18, 0.32],
      ),
    (r) =>
      biome(
        r,
        'Glaciers',
        0xb0cadb,
        0x9fc4dd,
        0xcfe4f2,
        0xf4faff,
        [1.25, 1.5],
        'shards',
        [0xbcdcf0, 0x8ab4d4],
        [0.3, 0.45],
      ),
    (r) =>
      biome(
        r,
        'Frozen sea',
        0xc8dae8,
        0xbcd4e4,
        0xd8e8f2,
        0xf0f6fa,
        [0.35, 0.5],
        'none',
        [0xcfe6f5, 0x9fc4dd],
        [0, 0.06],
      ),
    (r) =>
      biome(
        r,
        'Firn drifts',
        0xc4ccd4,
        0xb4bec8,
        0xd0d8e0,
        0xf4f7fa,
        [0.62, 0.8],
        'rocks',
        [0x8a929a, 0xa4aeb8],
        [0.14, 0.24],
      ),
  ],
  lava: [
    (r) =>
      biome(
        r,
        'Ashlands',
        0x3a2e2a,
        0x2e2422,
        0x3f3833,
        0x5a504a,
        [0.78, 0.95],
        'rocks',
        [0x241d20, 0x33282e],
        [0.25, 0.38],
      ),
    (r) =>
      biome(
        r,
        'Ember fields',
        0x452a1e,
        0x33201a,
        0x2a1812,
        0x4a3a34,
        [0.5, 0.65],
        'rocks',
        [0x2b1a14, 0x3a241c],
        [0.15, 0.28],
      ),
    (r) =>
      biome(
        r,
        'Obsidian hills',
        0x241d2e,
        0x1a1524,
        0x2e2440,
        0x4a3f5c,
        [1.3, 1.55],
        'shards',
        [0x2e2440, 0x453a5c],
        [0.28, 0.42],
      ),
  ],
  barren: [
    (r) =>
      biome(
        r,
        'Regolith plains',
        0x6f655c,
        0x857a6e,
        0x9a9083,
        0xb8b0a4,
        [0.82, 1],
        'rocks',
        [0x5c544c, 0x6e655c],
        [0.25, 0.4],
      ),
    (r) =>
      biome(
        r,
        'Cratered lowlands',
        0x5c544c,
        0x4e463e,
        0x6e655c,
        0x8a8074,
        [0.6, 0.75],
        'rocks',
        [0x453e36, 0x554c42],
        [0.32, 0.48],
      ),
    (r) =>
      biome(
        r,
        'Oxide hills',
        0x8a5638,
        0x7a4a30,
        0x9a6844,
        0xb88a64,
        [1.1, 1.3],
        'rocks',
        [0x6e4228, 0x84543a],
        [0.22, 0.35],
      ),
    (r) =>
      biome(
        r,
        'Pale uplands',
        0x8d8375,
        0x9a9083,
        0xb0a898,
        0xd0c8ba,
        [1.3, 1.55],
        'rocks',
        [0x7d766a, 0x948c7e],
        [0.18, 0.3],
      ),
  ],
  gas: [], // cloud decks are generated procedurally from the planet's hue
};

/** Gas giants: banded cloud decks hue-shifted around the planet's base hue. */
function gasDeck(rng: Rng, hue: number, shift: number): BiomeSeed {
  const h = hue + shift;
  return {
    name: 'Cloud deck',
    low: hslToHex(h + 18, 0.48, 0.42),
    mid: hslToHex(h, 0.42, 0.6),
    high: hslToHex(h + 36, 0.36, 0.78),
    peak: hslToHex(h + 36, 0.3, 0.9),
    heightMul: range(rng, 0.5, 1.1),
    flora: 'none',
    floraColors: [hslToHex(h, 0.42, 0.6), hslToHex(h + 36, 0.36, 0.78)],
    floraDensity: 0,
  };
}

/** Spread N climate centers apart so every picked biome actually shows up. */
const CLIMATE_LAYOUTS: [number, number][][] = [
  [],
  [[0, 0]],
  [
    [-0.42, -0.28],
    [0.42, 0.3],
  ],
  [
    [-0.48, -0.34],
    [0.5, -0.18],
    [0, 0.5],
  ],
  [
    [-0.5, -0.42],
    [0.48, -0.34],
    [-0.42, 0.44],
    [0.5, 0.4],
  ],
];

function pickBiomes(rng: Rng, archetype: PlanetArchetype): BiomeDef[] {
  const count = pickWeighted(rng, [
    [2, 25],
    [3, 45],
    [4, 30],
  ] as const);

  let seeds: BiomeSeed[];
  if (archetype === 'gas') {
    const hue = range(rng, 0, 360);
    const shifts = [0, 28, -34, 58];
    seeds = shifts.slice(0, count).map((shift) => gasDeck(rng, hue, shift));
  } else {
    const pool = BIOME_POOLS[archetype];
    const order = pool.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    seeds = order.slice(0, Math.min(count, pool.length)).map((i) => pool[i](rng));
  }

  const layout = CLIMATE_LAYOUTS[seeds.length];
  return seeds.map((seed, i) =>
    Object.assign(seed, {
      relief: /dune|sand|erg/i.test(seed.name)
        ? 1
        : /mesa|badland|plateau|salt/i.test(seed.name)
          ? 3
          : /alpine|highland|glacier|crag|basalt|volcan|ridge/i.test(seed.name)
            ? 2
            : archetype === 'desert'
              ? 1
              : archetype === 'lava' || archetype === 'ice'
                ? 2
                : archetype === 'barren'
                  ? 3
                  : 0,
      climate: [layout[i][0] + range(rng, -0.1, 0.1), layout[i][1] + range(rng, -0.1, 0.1)] as [
        number,
        number,
      ],
    }),
  );
}

function buildSurface(archetype: PlanetArchetype, rng: Rng): SurfaceParams {
  const biomes = pickBiomes(rng, archetype);

  const common = {
    biomes,
    cloudMode: false,
    offsetX: range(rng, -500, 500),
    offsetY: range(rng, -500, 500),
    climOffTX: range(rng, -500, 500),
    climOffTY: range(rng, -500, 500),
    climOffMX: range(rng, -500, 500),
    climOffMY: range(rng, -500, 500),
  };

  switch (archetype) {
    case 'terran': {
      const terrainScale = range(rng, 0.02, 0.028);
      return {
        ...common,
        heightScale: range(rng, 7, 10),
        terrainScale,
        climateScale: terrainScale * range(rng, 0.24, 0.34),
        waterLevel: range(rng, 0.34, 0.4),
        waterKind: 'water',
        waterColor: 0x1d5e8c,
        cliffColor: 0x6f6658,
        skyHorizon: 0xa9d4f5,
        skyZenith: 0x3372c4,
        fogColor: 0xa9cfe8,
        skyStars: 0.08,
      };
    }
    case 'ocean': {
      const terrainScale = range(rng, 0.018, 0.024);
      return {
        ...common,
        heightScale: range(rng, 6, 8),
        terrainScale,
        climateScale: terrainScale * range(rng, 0.24, 0.34),
        waterLevel: range(rng, 0.52, 0.6),
        waterKind: 'water',
        waterColor: 0x1a5480,
        cliffColor: 0x77705e,
        skyHorizon: 0xbfe0f7,
        skyZenith: 0x2f7fc4,
        fogColor: 0xb4dcf4,
        skyStars: 0.05,
      };
    }
    case 'desert': {
      const terrainScale = range(rng, 0.016, 0.024);
      return {
        ...common,
        heightScale: range(rng, 5.5, 8),
        terrainScale,
        climateScale: terrainScale * range(rng, 0.24, 0.34),
        waterLevel: -1,
        waterKind: 'none',
        waterColor: 0xe0ba7e,
        cliffColor: 0x7d4e2e,
        skyHorizon: 0xf0cf96,
        skyZenith: 0x9db4cc,
        fogColor: 0xdec090,
        skyStars: 0.18,
      };
    }
    case 'ice': {
      const terrainScale = range(rng, 0.02, 0.028);
      return {
        ...common,
        heightScale: range(rng, 7, 10),
        terrainScale,
        climateScale: terrainScale * range(rng, 0.24, 0.34),
        waterLevel: range(rng, 0.38, 0.46),
        waterKind: 'ice',
        waterColor: 0xbcd8e8,
        cliffColor: 0x8fa8ba,
        skyHorizon: 0xcfe0ee,
        skyZenith: 0x39597a,
        fogColor: 0xc4d9e8,
        skyStars: 0.4,
      };
    }
    case 'lava': {
      const terrainScale = range(rng, 0.024, 0.032);
      return {
        ...common,
        heightScale: range(rng, 8, 11),
        terrainScale,
        climateScale: terrainScale * range(rng, 0.24, 0.34),
        waterLevel: range(rng, 0.32, 0.38),
        waterKind: 'lava',
        waterColor: 0xff5a1f,
        cliffColor: 0x1a100e,
        skyHorizon: 0x542218,
        skyZenith: 0x160a0c,
        fogColor: 0x331412,
        skyStars: 0.25,
      };
    }
    case 'barren': {
      const terrainScale = range(rng, 0.024, 0.034);
      return {
        ...common,
        heightScale: range(rng, 8, 12),
        terrainScale,
        climateScale: terrainScale * range(rng, 0.24, 0.34),
        waterLevel: -1,
        waterKind: 'none',
        waterColor: 0x6f655c,
        cliffColor: 0x4a423c,
        skyHorizon: 0x585049,
        skyZenith: 0x101318,
        fogColor: 0x4c453f,
        skyStars: 0.85,
      };
    }
    case 'gas': {
      const terrainScale = range(rng, 0.01, 0.015);
      const deck = biomes[0];
      return {
        ...common,
        cloudMode: true,
        heightScale: range(rng, 3.5, 5.5),
        terrainScale,
        climateScale: terrainScale * range(rng, 0.28, 0.4),
        waterLevel: -1,
        waterKind: 'none',
        waterColor: deck.low,
        cliffColor: darkenHex(deck.low, 0.2),
        skyHorizon: deck.mid,
        skyZenith: darkenHex(deck.low, 0.45),
        fogColor: mixHex(deck.mid, deck.low, 0.5),
        skyStars: 0,
      };
    }
  }
}

// ─── Planet generation ─────────────────────────────────────────────────────

const ATMOSPHERES: Record<PlanetArchetype, number> = {
  terran: 0x7fb8ff,
  ocean: 0x6fc4ff,
  desert: 0xffcf8a,
  ice: 0xcfe4ff,
  lava: 0xff7a4d,
  barren: 0xb8c2cc,
  gas: 0xffffff, // replaced with palette-derived color below
};

function archetypeForZone(rng: Rng, zone: number): PlanetArchetype {
  if (zone < 0.34) {
    return pickWeighted(rng, [
      ['lava', 25],
      ['barren', 35],
      ['desert', 30],
      ['terran', 10],
    ] as const);
  }
  if (zone < 0.62) {
    return pickWeighted(rng, [
      ['terran', 32],
      ['ocean', 22],
      ['desert', 18],
      ['barren', 13],
      ['gas', 15],
    ] as const);
  }
  return pickWeighted(rng, [
    ['gas', 42],
    ['ice', 38],
    ['barren', 20],
  ] as const);
}

function generatePlanet(
  rng: Rng,
  systemName: string,
  index: number,
  count: number,
  orbitRadius: number,
): PlanetData {
  const zone = count > 1 ? index / (count - 1) : 0.5;
  const archetype = archetypeForZone(rng, zone);
  const surface = buildSurface(archetype, rng);

  const isGas = archetype === 'gas';
  const radius = isGas ? range(rng, 1.1, 1.7) : range(rng, 0.42, 0.88);

  // System-view surface colors: reuse the dominant biome's palette so the
  // planet you orbit is recognizably the planet you land on.
  const b0 = surface.biomes[0];
  let colorA = b0.mid;
  let colorB = b0.low;
  let colorC = b0.high;
  if (archetype === 'terran' || archetype === 'ocean') {
    colorA = surface.waterColor; // oceans dominate from orbit
    colorB = b0.mid;
    colorC = b0.low;
  } else if (archetype === 'ice') {
    colorA = b0.low;
    colorB = surface.waterColor;
    colorC = b0.peak;
  } else if (archetype === 'lava') {
    colorA = b0.low;
    colorB = 0xff5a1f;
    colorC = b0.peak;
  }

  const atmosphereColor = isGas ? lightenHex(b0.mid, 0.35) : ATMOSPHERES[archetype];

  const moonCount = isGas
    ? rangeInt(rng, 1, 3)
    : archetype === 'terran' || archetype === 'ocean' || archetype === 'ice'
      ? rangeInt(rng, 0, 2)
      : chance(rng, 0.3)
        ? 1
        : 0;

  const moons: MoonData[] = [];
  for (let m = 0; m < moonCount; m++) {
    moons.push({
      size: radius * range(rng, 0.14, 0.24),
      orbitRadius: radius * range(rng, 1.9, 2.6) + m * radius * 0.9,
      orbitSpeed: range(rng, 0.25, 0.55) * (chance(rng, 0.25) ? -1 : 1),
      phase: range(rng, 0, Math.PI * 2),
      inclination: range(rng, -0.35, 0.35),
      color: pick(rng, [0x9a9083, 0x857a6e, 0xb0a89c]),
    });
  }

  const hasRings = isGas ? chance(rng, 0.45) : archetype === 'ice' && chance(rng, 0.18);
  const rings: RingData | null = hasRings
    ? {
        innerRadius: radius * range(rng, 1.35, 1.55),
        outerRadius: radius * range(rng, 2.0, 2.6),
        color: lightenHex(b0.high, 0.3),
        opacity: range(rng, 0.35, 0.6),
      }
    : null;

  return {
    name: `${systemName} ${ROMAN[index]}`,
    archetype,
    archetypeLabel: ARCHETYPE_LABELS[archetype],
    seed: Math.floor(rng() * 1e9),
    radius,
    orbitRadius,
    orbitSpeed: (range(rng, 1.8, 2.6) / Math.pow(orbitRadius, 1.5)) * (chance(rng, 0.08) ? -1 : 1),
    phase: range(rng, 0, Math.PI * 2),
    inclination: range(rng, -0.09, 0.09),
    colorA,
    colorB,
    colorC,
    atmosphereColor,
    atmosphereCss: hexCss(atmosphereColor),
    cloudiness: archetype === 'terran' || archetype === 'ocean' ? range(rng, 0.35, 0.6) : 0,
    bandAmount: isGas ? range(rng, 0.7, 1) : 0,
    emissive: archetype === 'lava' ? range(rng, 0.7, 1) : 0,
    rings,
    moons,
    surface,
  };
}

// ─── System generation ─────────────────────────────────────────────────────

const systemCache = new Map<number, StarSystemData>();

/**
 * Memoized accessor — hover, click handling and the scenes all resolve the
 * same seed repeatedly, so cache the generated data (it's tiny).
 */
export function getStarSystem(seed: number): StarSystemData {
  let system = systemCache.get(seed);
  if (!system) {
    system = generateStarSystem(seed);
    systemCache.set(seed, system);
  }
  return system;
}

export function generateStarSystem(seed: number): StarSystemData {
  const rng = mulberry32(seed * 2654435761 + 1013904223);

  const star = pickWeighted(rng, STAR_CLASSES);
  const starRadius = range(rng, star.sizeMin, star.sizeMax);
  const name = generateName(rng);

  const planetCount = pickWeighted(rng, [
    [2, 10],
    [3, 22],
    [4, 30],
    [5, 24],
    [6, 14],
  ] as const);

  const planets: PlanetData[] = [];
  let orbit = starRadius * 2.4 + range(rng, 1.6, 2.6);
  for (let i = 0; i < planetCount; i++) {
    planets.push(generatePlanet(rng, name, i, planetCount, orbit));
    orbit = orbit * range(rng, 1.32, 1.52) + 0.7;
  }

  return {
    seed,
    name,
    subtitle: `${star.cls}-class star · ${planetCount} planets`,
    starClass: star.cls,
    starColor: star.color,
    starColorCss: hexCss(star.color),
    starLightColor: lightenHex(star.color, 0.55),
    starRadius,
    planets,
  };
}
