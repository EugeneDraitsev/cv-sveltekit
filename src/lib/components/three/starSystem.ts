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
  let r = 0;
  let g = 0;
  let b = 0;
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
  /** How strongly the lateral biome noise swaps palettes (Minecraft-style patches). */
  biomeVariation: number;
  /** Height-band palette, low → peak, plus flooded + cliff colors. */
  palette: {
    water: number;
    low: number;
    mid: number;
    high: number;
    peak: number;
    cliff: number;
  };
  /** Secondary biome palette blended in via the lateral biome noise. */
  altPalette: {
    low: number;
    mid: number;
    high: number;
  };
  skyHorizon: number;
  skyZenith: number;
  fogColor: number;
  /** 0..1 — how visible background stars are from the surface (thin atmosphere → 1). */
  skyStars: number;
  flora: FloraKind;
  /** 0..1 relative instance density. */
  floraDensity: number;
  /** Primary / secondary foliage tints. */
  floraColors: [number, number];
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

function buildSurface(archetype: PlanetArchetype, rng: Rng): SurfaceParams {
  const offsetX = range(rng, -500, 500);
  const offsetY = range(rng, -500, 500);
  const common = { offsetX, offsetY, cloudMode: false, biomeVariation: 0.55 };

  switch (archetype) {
    case 'terran': {
      const grass = pick(rng, [0x63a24e, 0x6fae52, 0x559446]);
      return {
        ...common,
        heightScale: range(rng, 7, 10),
        terrainScale: range(rng, 0.02, 0.028),
        waterLevel: range(rng, 0.34, 0.4),
        waterKind: 'water',
        palette: {
          water: 0x1d5e8c,
          low: 0xd8c48c,
          mid: grass,
          high: 0x2f6b3c,
          peak: 0xf4f7fa,
          cliff: 0x6f6658,
        },
        altPalette: { low: 0xc4b184, mid: 0x8fae52, high: 0x4a7a44 },
        skyHorizon: 0xa9d4f5,
        skyZenith: 0x3372c4,
        fogColor: 0xa9cfe8,
        skyStars: 0.08,
        flora: 'trees',
        floraDensity: range(rng, 0.65, 0.9),
        floraColors: [darkenHex(grass, 0.25), 0x2f6b3c],
      };
    }
    case 'ocean':
      return {
        ...common,
        heightScale: range(rng, 6, 8),
        terrainScale: range(rng, 0.018, 0.024),
        waterLevel: range(rng, 0.52, 0.6),
        waterKind: 'water',
        palette: {
          water: 0x1a5480,
          low: 0xe6d7a3,
          mid: 0x58a460,
          high: 0x3d7a4a,
          peak: 0xe8f0f2,
          cliff: 0x77705e,
        },
        altPalette: { low: 0xd8c48c, mid: 0x6cb06e, high: 0x2f6b4c },
        skyHorizon: 0xbfe0f7,
        skyZenith: 0x2f7fc4,
        fogColor: 0xb4dcf4,
        skyStars: 0.05,
        flora: 'palms',
        floraDensity: range(rng, 0.4, 0.6),
        floraColors: [0x3f8a4f, 0x63a24e],
      };
    case 'desert': {
      const martian = chance(rng, 0.4);
      const sand = martian ? 0xc46a3f : 0xe0ba7e;
      const dune = martian ? 0x9c4c2c : 0xc98f52;
      return {
        ...common,
        biomeVariation: 0.4,
        heightScale: range(rng, 5, 8),
        terrainScale: range(rng, 0.016, 0.024),
        waterLevel: -1,
        waterKind: 'none',
        palette: {
          water: sand,
          low: sand,
          mid: dune,
          high: martian ? 0x7d3a22 : 0xa06b3d,
          peak: martian ? 0xd8956a : 0xeadcb4,
          cliff: martian ? 0x5f2d1c : 0x7d4e2e,
        },
        altPalette: {
          low: lightenHex(sand, 0.18),
          mid: darkenHex(dune, 0.12),
          high: martian ? 0x8a4a2e : 0x8a6a48,
        },
        skyHorizon: martian ? 0xe8a476 : 0xf0cf96,
        skyZenith: martian ? 0x8a5038 : 0x9db4cc,
        fogColor: martian ? 0xd39670 : 0xdec090,
        skyStars: 0.18,
        flora: 'cacti',
        floraDensity: range(rng, 0.25, 0.4),
        floraColors: [0x4a7a3d, 0x6b8a4a],
      };
    }
    case 'ice':
      return {
        ...common,
        heightScale: range(rng, 7, 10),
        terrainScale: range(rng, 0.02, 0.028),
        waterLevel: range(rng, 0.38, 0.44),
        waterKind: 'ice',
        palette: {
          water: 0xbcd8e8,
          low: 0xdfe9f2,
          mid: 0xc9dbe8,
          high: 0xedf4fa,
          peak: 0xffffff,
          cliff: 0x8fa8ba,
        },
        altPalette: { low: 0xcfdfe8, mid: 0xb0cadb, high: 0xdcebf4 },
        skyHorizon: 0xcfe0ee,
        skyZenith: 0x39597a,
        fogColor: 0xc4d9e8,
        skyStars: 0.4,
        flora: 'shards',
        floraDensity: range(rng, 0.22, 0.38),
        floraColors: [0xcfe6f5, 0x9fc4dd],
      };
    case 'lava':
      return {
        ...common,
        biomeVariation: 0.35,
        heightScale: range(rng, 8, 11),
        terrainScale: range(rng, 0.024, 0.032),
        waterLevel: range(rng, 0.32, 0.38),
        waterKind: 'lava',
        palette: {
          water: 0xff5a1f,
          low: 0x3a2420,
          mid: 0x2c1c18,
          high: 0x241512,
          peak: 0x4a3a34,
          cliff: 0x1a100e,
        },
        altPalette: { low: 0x452a1e, mid: 0x33201a, high: 0x2a1812 },
        skyHorizon: 0x542218,
        skyZenith: 0x160a0c,
        fogColor: 0x331412,
        skyStars: 0.25,
        flora: 'rocks',
        floraDensity: range(rng, 0.18, 0.3),
        floraColors: [0x1f1721, 0x2b1f2b],
      };
    case 'barren':
      return {
        ...common,
        biomeVariation: 0.3,
        heightScale: range(rng, 8, 12),
        terrainScale: range(rng, 0.024, 0.034),
        waterLevel: -1,
        waterKind: 'none',
        palette: {
          water: 0x6f655c,
          low: 0x6f655c,
          mid: 0x857a6e,
          high: 0x9a9083,
          peak: 0xb8b0a4,
          cliff: 0x4a423c,
        },
        altPalette: { low: 0x60564e, mid: 0x776b60, high: 0x8d8375 },
        skyHorizon: 0x585049,
        skyZenith: 0x101318,
        fogColor: 0x4c453f,
        skyStars: 0.85,
        flora: 'rocks',
        floraDensity: range(rng, 0.25, 0.4),
        floraColors: [0x5c544c, 0x6e655c],
      };
    case 'gas': {
      const hue = range(rng, 0, 360);
      const base = hslToHex(hue, 0.42, 0.6);
      const deep = hslToHex(hue + 18, 0.48, 0.42);
      const light = hslToHex(hue + 36, 0.36, 0.78);
      return {
        ...common,
        cloudMode: true,
        biomeVariation: 0.5,
        heightScale: range(rng, 3.5, 5.5),
        terrainScale: range(rng, 0.01, 0.015),
        waterLevel: -1,
        waterKind: 'none',
        palette: {
          water: deep,
          low: deep,
          mid: base,
          high: light,
          peak: lightenHex(light, 0.5),
          cliff: darkenHex(deep, 0.2),
        },
        altPalette: {
          low: darkenHex(deep, 0.15),
          mid: hslToHex(hue - 20, 0.4, 0.55),
          high: lightenHex(base, 0.3),
        },
        skyHorizon: base,
        skyZenith: darkenHex(deep, 0.45),
        fogColor: mixHex(base, deep, 0.5),
        skyStars: 0,
        flora: 'none',
        floraDensity: 0,
        floraColors: [base, light],
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

  // System-view surface colors: reuse the surface palette so the planet you
  // orbit is recognizably the planet you land on.
  const p = surface.palette;
  let colorA = p.mid;
  let colorB = p.low;
  let colorC = p.high;
  if (archetype === 'terran' || archetype === 'ocean') {
    colorA = p.water; // oceans dominate from orbit
    colorB = p.mid;
    colorC = p.low;
  } else if (archetype === 'ice') {
    colorA = p.low;
    colorB = p.water;
    colorC = p.peak;
  } else if (archetype === 'lava') {
    colorA = p.low;
    colorB = 0xff5a1f;
    colorC = p.peak;
  }

  const atmosphereColor = isGas ? lightenHex(p.mid, 0.35) : ATMOSPHERES[archetype];

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
        color: lightenHex(p.high, 0.3),
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
