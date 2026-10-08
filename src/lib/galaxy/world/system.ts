/**
 * Procedural star systems. A system is a pure function of its seed: stars,
 * planets, moons, rings, biomes, oceans, atmospheres and weather. Everything
 * the HUD, the system view and the planet surface show comes from here.
 */
import { BIOMES, biomeById, type BiomeSpec } from './biomes';
import { ARCHETYPES, ARCHETYPE_LIST, isGiant, type Archetype, type WaterKind } from './planetTypes';
import { chance, mulberry32, pick, pickWeighted, range, rangeInt, type Rng } from './rng';
import { hexToRgb, jitterColor, kelvinRgb, mixRgb, type Rgb } from './color';

export type StarClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';

export interface StarData {
  name: string;
  cls: StarClass;
  temperature: number;
  /** Visual radius in system units. */
  radius: number;
  color: Rgb;
  /** Light intensity multiplier. */
  luminosity: number;
  orbit: number;
  orbitSpeed: number;
  phase: number;
}

export interface PlanetBiome {
  spec: BiomeSpec;
  index: number;
  name: string;
  /** Climate centre (temperature, moisture). */
  climate: [number, number];
  /** Relief amplitude in planet radii, feature frequency multiplier. */
  amp: number;
  freq: number;
  low: Rgb;
  mid: Rgb;
  high: Rgb;
  rock: Rgb;
  foliage: Rgb;
}

export interface MoonData {
  name: string;
  kind: 'rock' | 'ice' | 'sulfur' | 'rust';
  radius: number;
  orbit: number;
  speed: number;
  phase: number;
  inclination: number;
  color: Rgb;
  seed: number;
}

export interface RingData {
  inner: number;
  outer: number;
  color: Rgb;
  opacity: number;
  seed: number;
  tilt: number;
}

export interface Atmosphere {
  /** Column density relative to Earth; 0 means airless. */
  density: number;
  /** Shell thickness in planet radii. */
  height: number;
  rayleigh: Rgb;
  haze: number;
  hazeColor: Rgb;
}

export interface PlanetData {
  name: string;
  archetype: Archetype;
  label: string;
  seed: number;
  index: number;
  /** Visual radius in system units and the illustrated radius in metres. */
  radius: number;
  meters: number;
  orbit: number;
  orbitSpeed: number;
  phase: number;
  inclination: number;
  /** Rotation in radians per second and axial tilt. */
  spin: number;
  tilt: number;
  giant: boolean;
  /** Noise-space offset that makes this planet's terrain unique. */
  offset: [number, number, number];
  /** Continental frequency and sea threshold of the continent noise. */
  continentFreq: number;
  seaThreshold: number;
  /** Fraction of the surface below sea level. */
  sea: number;
  water: WaterKind;
  shallow: Rgb;
  deep: Rgb;
  temperature: number;
  moisture: number;
  /** Base relief in planet radii. */
  relief: number;
  biomes: PlanetBiome[];
  atmosphere: Atmosphere;
  clouds: number;
  cloudColor: Rgb;
  /** Gas giant banding. */
  bands: Rgb[];
  turbulence: number;
  moons: MoonData[];
  rings: RingData | null;
  /** Average colour from orbit, used for markers and labels. */
  tint: Rgb;
}

export interface StarSystemData {
  seed: number;
  name: string;
  subtitle: string;
  stars: StarData[];
  planets: PlanetData[];
  /** Outer edge of the system in system units. */
  extent: number;
}

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
  'Hy',
  'Mi',
  'Sa',
  'Quo',
  'Ze',
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
  'ka',
  'tos',
];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const MOON_NAMES = ['a', 'b', 'c', 'd'];

function generateName(rng: Rng): string {
  let name = pick(rng, SYL_START) + pick(rng, SYL_END);
  if (chance(rng, 0.3)) name += pick(rng, SYL_END);
  if (chance(rng, 0.3)) name += `-${rangeInt(rng, 2, 9)}`;
  else if (chance(rng, 0.1)) name += pick(rng, [' Prime', ' Major', ' Minor']);
  return name;
}

const STAR_CLASSES: readonly (readonly [
  { cls: StarClass; t: [number, number]; r: [number, number]; l: number },
  number,
])[] = [
  [{ cls: 'M', t: [2900, 3700], r: [1.5, 1.9], l: 0.75 }, 28],
  [{ cls: 'K', t: [3900, 5100], r: [1.8, 2.3], l: 0.88 }, 22],
  [{ cls: 'G', t: [5300, 6000], r: [2.1, 2.6], l: 1 }, 20],
  [{ cls: 'F', t: [6100, 7400], r: [2.4, 2.9], l: 1.1 }, 12],
  [{ cls: 'A', t: [7600, 9800], r: [2.7, 3.3], l: 1.2 }, 9],
  [{ cls: 'B', t: [11000, 18000], r: [3.1, 3.8], l: 1.35 }, 6],
  [{ cls: 'O', t: [26000, 36000], r: [3.6, 4.4], l: 1.5 }, 3],
];

function makeStar(rng: Rng, name: string, companion: boolean): StarData {
  const s = pickWeighted(rng, STAR_CLASSES);
  const temperature = range(rng, s.t[0], s.t[1]);
  return {
    name,
    cls: s.cls,
    temperature,
    radius: range(rng, s.r[0], s.r[1]) * (companion ? 0.55 : 1),
    color: kelvinRgb(temperature),
    luminosity: s.l * (companion ? 0.6 : 1),
    orbit: 0,
    orbitSpeed: 0,
    phase: 0,
  };
}

function archetypeFor(rng: Rng, zone: number): Archetype {
  const entries = ARCHETYPE_LIST.map((a) => {
    const spec = ARCHETYPES[a];
    const [lo, hi] = spec.zone;
    const inside = zone >= lo - 0.08 && zone <= hi + 0.08;
    return [a, inside ? spec.weight : 0.4] as const;
  });
  return pickWeighted(rng, entries);
}

function shuffled<T>(rng: Rng, items: readonly T[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const span = (v: number[]) => [Math.min(...v), Math.max(...v)] as const;
const remap = (v: number, a: number, b: number) =>
  b - a < 0.05 ? 0.5 : 0.12 + ((v - a) / (b - a)) * 0.76;

/** Spread the chosen biomes over the climate space the planet actually spans. */
function resolveBiomes(rng: Rng, specs: BiomeSpec[], meters: number): PlanetBiome[] {
  const ts = specs.map((s) => s.climate[0]);
  const ms = specs.map((s) => s.climate[1]);
  const [t0, t1] = span(ts);
  const [m0, m1] = span(ms);
  return specs.map((spec, index) => {
    const amp = range(rng, spec.amp[0], spec.amp[1]) / meters;
    return {
      spec,
      index,
      name: spec.name,
      climate: [
        Math.min(0.95, Math.max(0.05, remap(spec.climate[0], t0, t1) + range(rng, -0.06, 0.06))),
        Math.min(0.95, Math.max(0.05, remap(spec.climate[1], m0, m1) + range(rng, -0.06, 0.06))),
      ],
      amp,
      freq: range(rng, spec.freq[0], spec.freq[1]),
      low: jitterColor(rng, hexToRgb(spec.low), 0.07),
      mid: jitterColor(rng, hexToRgb(spec.mid), 0.07),
      high: jitterColor(rng, hexToRgb(spec.high), 0.06),
      rock: jitterColor(rng, hexToRgb(spec.rock), 0.06),
      foliage: jitterColor(rng, hexToRgb(spec.foliage), 0.1),
    };
  });
}

function gasBands(rng: Rng, archetype: Archetype): Rgb[] {
  const palettes: Rgb[][] =
    archetype === 'iceGiant'
      ? [
          [hexToRgb(0x7ad0e0), hexToRgb(0x4aa0c8), hexToRgb(0xc8f0f4), hexToRgb(0x2a70a8)],
          [hexToRgb(0x6ab8f0), hexToRgb(0x3a68c8), hexToRgb(0xd0e8ff), hexToRgb(0x2a3a98)],
          [hexToRgb(0x8ae0c8), hexToRgb(0x4ab0a0), hexToRgb(0xe0fff4), hexToRgb(0x2a7a7a)],
        ]
      : [
          [hexToRgb(0xd8b48a), hexToRgb(0xa8704a), hexToRgb(0xf0e0c8), hexToRgb(0x8a4a2a)],
          [hexToRgb(0xe8d0a0), hexToRgb(0xc09060), hexToRgb(0xfff4e0), hexToRgb(0xa06a3a)],
          [hexToRgb(0xc8a0c8), hexToRgb(0x8a5a9a), hexToRgb(0xf0dcf0), hexToRgb(0x5a3a7a)],
          [hexToRgb(0xd0c088), hexToRgb(0x9a8a4a), hexToRgb(0xf4f0d0), hexToRgb(0x6a5a2a)],
          [hexToRgb(0xe0a080), hexToRgb(0xb0583a), hexToRgb(0xf8dcc8), hexToRgb(0x7a2a1a)],
        ];
  return pick(rng, palettes).map((c) => jitterColor(rng, c, 0.06));
}

function generatePlanet(
  rng: Rng,
  systemName: string,
  index: number,
  count: number,
  orbit: number,
): PlanetData {
  const zone = count > 1 ? index / (count - 1) : 0.5;
  const archetype = archetypeFor(rng, zone * 0.85 + range(rng, -0.08, 0.12));
  const spec = ARCHETYPES[archetype];
  const giant = isGiant(archetype);
  const radius = giant ? range(rng, 1.5, 2.2) : range(rng, 0.6, 1.05);
  const meters = giant ? range(rng, 380e3, 620e3) : range(rng, 80e3, 150e3) * (radius / 0.65);
  const biomeCount = giant ? 0 : rangeInt(rng, spec.biomeCount[0], spec.biomeCount[1]);
  const specs = giant
    ? []
    : shuffled(rng, spec.biomes).slice(0, Math.min(biomeCount, spec.biomes.length)).map(biomeById);
  const biomes = resolveBiomes(rng, specs, meters);
  const sea = range(rng, spec.sea[0], spec.sea[1]);
  const air = range(rng, spec.air[0], spec.air[1]);
  const offset: [number, number, number] = [
    range(rng, -200, 200),
    range(rng, -200, 200),
    range(rng, -200, 200),
  ];
  const continentFreq = range(rng, 1.2, 2.1);
  const temperature = range(rng, spec.temperature[0], spec.temperature[1]);
  const moisture = range(rng, spec.moisture[0], spec.moisture[1]);
  const clouds = range(rng, spec.clouds[0], spec.clouds[1]);
  const shallow = hexToRgb(spec.shallow);
  const deep = hexToRgb(spec.deep);

  const moonCount = giant ? rangeInt(rng, 1, 4) : chance(rng, 0.55) ? rangeInt(rng, 1, 2) : 0;
  const moons: MoonData[] = [];
  let moonOrbit = radius * range(rng, 2.6, 3.4);
  for (let m = 0; m < moonCount; m++) {
    const kind = pick(rng, ['rock', 'rock', 'ice', 'sulfur', 'rust'] as const);
    const color =
      kind === 'ice'
        ? hexToRgb(0xdfe8ee)
        : kind === 'sulfur'
          ? hexToRgb(0xd8c06a)
          : kind === 'rust'
            ? hexToRgb(0xa8705a)
            : jitterColor(rng, hexToRgb(0x9a958c), 0.1);
    moons.push({
      name: `${systemName} ${ROMAN[index]}${MOON_NAMES[m]}`,
      kind,
      radius: radius * range(rng, 0.13, giant ? 0.24 : 0.3),
      orbit: moonOrbit,
      speed: range(rng, 0.08, 0.16) * (chance(rng, 0.15) ? -1 : 1),
      phase: range(rng, 0, Math.PI * 2),
      inclination: range(rng, -0.3, 0.3),
      color,
      seed: Math.floor(rng() * 1e9),
    });
    moonOrbit += radius * range(rng, 0.9, 1.5);
  }

  const hasRings = giant ? chance(rng, 0.55) : archetype === 'frozen' && chance(rng, 0.2);
  const bands = giant ? gasBands(rng, archetype) : [];
  const avg = giant
    ? mixRgb(bands[0], bands[2], 0.5)
    : biomes.length
      ? mixRgb(
          mixRgb(biomes[0].mid, biomes[1 % biomes.length].mid, 0.5),
          spec.water === 'none' ? biomes[0].high : deep,
          sea * 0.7,
        )
      : [0.5, 0.5, 0.5];
  const rings: RingData | null = hasRings
    ? {
        inner: radius * range(rng, 1.3, 1.5),
        outer: radius * range(rng, 2.0, 2.6),
        color: giant ? mixRgb(bands[2], [0.85, 0.8, 0.72], 0.5) : [0.8, 0.86, 0.9],
        opacity: range(rng, 0.55, 0.85),
        seed: Math.floor(rng() * 1e6),
        tilt: range(rng, -0.35, 0.35),
      }
    : null;

  return {
    name: `${systemName} ${ROMAN[index]}`,
    archetype,
    label: spec.label,
    seed: Math.floor(rng() * 1e9),
    index,
    radius,
    meters,
    orbit,
    orbitSpeed: range(rng, 0.9, 1.3) / Math.pow(orbit, 1.5),
    phase: range(rng, 0, Math.PI * 2),
    inclination: range(rng, -0.05, 0.05),
    spin: (Math.PI * 2) / range(rng, 300, 620),
    tilt: range(rng, 0, 0.45),
    giant,
    offset,
    continentFreq,
    seaThreshold: 0,
    sea,
    water: spec.water,
    shallow,
    deep,
    temperature,
    moisture,
    relief: range(rng, spec.relief[0], spec.relief[1]),
    biomes,
    atmosphere: {
      density: air,
      height: giant ? 0.035 : 0.022 + air * 0.006,
      rayleigh: spec.rayleigh,
      haze: spec.haze,
      hazeColor: hexToRgb(spec.hazeColor),
    },
    clouds,
    cloudColor: hexToRgb(spec.cloudColor),
    bands,
    turbulence: range(rng, 0.4, 1),
    moons,
    rings,
    tint: avg as Rgb,
  };
}

const cache = new Map<number, StarSystemData>();

/** Memoized: the HUD, the system view and the surface ask for the same seed. */
export function getSystem(seed: number): StarSystemData {
  let system = cache.get(seed);
  if (!system) {
    system = generateSystem(seed);
    cache.set(seed, system);
  }
  return system;
}

export function generateSystem(seed: number): StarSystemData {
  const rng = mulberry32(Math.imul(seed, 2654435761) + 1013904223);
  const name = generateName(rng);
  const primary = makeStar(rng, name, false);
  const planetCount = pickWeighted(rng, [
    [3, 14],
    [4, 26],
    [5, 28],
    [6, 20],
    [7, 12],
  ] as const);
  const planets: PlanetData[] = [];
  let orbit = primary.radius * 2.4 + range(rng, 2.6, 3.6);
  for (let i = 0; i < planetCount; i++) {
    const planet = generatePlanet(rng, name, i, planetCount, orbit);
    planets.push(planet);
    const room =
      planet.radius + (planet.moons.at(-1)?.orbit ?? 0) * 0.6 + (planet.rings?.outer ?? 0) * 0.4;
    orbit += range(rng, 2.6, 3.8) + room * 1.6 + orbit * 0.08;
  }
  const stars = [primary];
  if (chance(rng, 0.16)) {
    const companion = makeStar(rng, `${name} B`, true);
    companion.orbit = orbit + range(rng, 6, 14);
    companion.orbitSpeed = range(rng, 0.004, 0.008);
    companion.phase = range(rng, 0, Math.PI * 2);
    stars.push(companion);
  }
  const extent = Math.max(orbit, stars.at(-1)!.orbit) + 4;
  return {
    seed,
    name,
    subtitle: `${primary.cls}-class star${stars.length > 1 ? ' · binary' : ''} · ${planetCount} planets`,
    stars,
    planets,
    extent,
  };
}

export const ALL_BIOMES = BIOMES;
