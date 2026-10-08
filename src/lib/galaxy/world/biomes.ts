/**
 * The biome catalogue. Every planet draws a handful of these (by archetype,
 * see planetTypes.ts), jitters their colours and relief, and places them in
 * its own climate space. Colours are sRGB hex; the packer linearises them.
 */

export type ReliefStyle =
  | 'plains'
  | 'hills'
  | 'mountains'
  | 'dunes'
  | 'mesas'
  | 'canyons'
  | 'craters'
  | 'spires'
  | 'volcanic'
  | 'glacial';

export const RELIEF_STYLES: ReliefStyle[] = [
  'plains',
  'hills',
  'mountains',
  'dunes',
  'mesas',
  'canyons',
  'craters',
  'spires',
  'volcanic',
  'glacial',
];

/** Surface texture family, drives the fragment shader's detail pattern. */
export type Material =
  | 'grass'
  | 'forest'
  | 'sand'
  | 'rock'
  | 'snow'
  | 'ice'
  | 'ash'
  | 'lava'
  | 'crystal'
  | 'moss'
  | 'mud'
  | 'salt'
  | 'regolith'
  | 'alien';

export const MATERIALS: Material[] = [
  'grass',
  'forest',
  'sand',
  'rock',
  'snow',
  'ice',
  'ash',
  'lava',
  'crystal',
  'moss',
  'mud',
  'salt',
  'regolith',
  'alien',
];

export type FloraKind =
  | 'broadleaf'
  | 'pine'
  | 'palm'
  | 'birch'
  | 'acacia'
  | 'baobab'
  | 'willow'
  | 'deadTree'
  | 'cactus'
  | 'bush'
  | 'fern'
  | 'reeds'
  | 'boulder'
  | 'rocks'
  | 'mushroom'
  | 'crystal'
  | 'iceSpike'
  | 'lavaRock'
  | 'glowPlant'
  | 'coral'
  | 'boneArch'
  | 'tendril'
  | 'basalt'
  | 'blossom'
  | 'autumn'
  | 'flowers';

export interface FloraSpec {
  kind: FloraKind;
  /** Probability that a slot of this kind is occupied inside the biome. */
  density: number;
  /** Uniform scale range. */
  scale: [number, number];
  /** Optional foliage tint (otherwise the biome's foliage colour). */
  tint?: number;
}

export interface BiomeSpec {
  id: string;
  name: string;
  relief: ReliefStyle;
  /** Relief amplitude range in metres. */
  amp: [number, number];
  /** Feature frequency multiplier range (1 ≈ 6 km features). */
  freq: [number, number];
  material: Material;
  /** Ground colours: valley / mid / high / exposed rock. */
  low: number;
  mid: number;
  high: number;
  rock: number;
  /** Grass and foliage colour. */
  foliage: number;
  /** 0..1 coverage of grass blades near the camera. */
  grass: number;
  /** Grass blade height in metres. */
  grassHeight?: number;
  flora: FloraSpec[];
  /** Night-time emission (bioluminescence, lava, crystals). */
  glow?: number;
  glowStrength?: number;
  /** Home position in (temperature, moisture) climate space, 0..1 each. */
  climate: [number, number];
  /** The region is covered in snow when colder than this (0..1). */
  snowBelow?: number;
}

const b = (spec: BiomeSpec) => spec;

export const BIOMES: BiomeSpec[] = [
  // ── Temperate ─────────────────────────────────────────────────────────
  b({
    id: 'meadow',
    name: 'Flower meadows',
    relief: 'hills',
    amp: [180, 420],
    freq: [0.8, 1.3],
    material: 'grass',
    low: 0x6f8f3a,
    mid: 0x7fa548,
    high: 0x8d9a62,
    rock: 0x7d776a,
    foliage: 0x6aa344,
    grass: 0.95,
    grassHeight: 0.55,
    flora: [
      { kind: 'flowers', density: 0.55, scale: [0.8, 1.2] },
      { kind: 'broadleaf', density: 0.08, scale: [0.8, 1.3] },
      { kind: 'bush', density: 0.2, scale: [0.6, 1.2] },
      { kind: 'rocks', density: 0.12, scale: [0.5, 1.2] },
    ],
    climate: [0.55, 0.55],
  }),
  b({
    id: 'forest',
    name: 'Old-growth forest',
    relief: 'hills',
    amp: [260, 620],
    freq: [0.9, 1.4],
    material: 'forest',
    low: 0x3f5a26,
    mid: 0x4a6a2c,
    high: 0x5b6e3e,
    rock: 0x6c6658,
    foliage: 0x3d7a2e,
    grass: 0.7,
    grassHeight: 0.4,
    flora: [
      { kind: 'broadleaf', density: 0.85, scale: [0.9, 1.6] },
      { kind: 'fern', density: 0.6, scale: [0.6, 1.2] },
      { kind: 'bush', density: 0.35, scale: [0.6, 1.1] },
      { kind: 'boulder', density: 0.08, scale: [0.5, 1.2] },
    ],
    climate: [0.55, 0.78],
  }),
  b({
    id: 'taiga',
    name: 'Pine taiga',
    relief: 'hills',
    amp: [300, 700],
    freq: [0.8, 1.3],
    material: 'moss',
    low: 0x4d5a3a,
    mid: 0x5a6646,
    high: 0x7b8073,
    rock: 0x6e6c66,
    foliage: 0x2f4f2c,
    grass: 0.35,
    grassHeight: 0.3,
    flora: [
      { kind: 'pine', density: 0.85, scale: [0.9, 1.7] },
      { kind: 'boulder', density: 0.15, scale: [0.5, 1.4] },
      { kind: 'bush', density: 0.2, scale: [0.5, 0.9] },
    ],
    climate: [0.28, 0.6],
    snowBelow: 0.22,
  }),
  b({
    id: 'alpine',
    name: 'Alpine highlands',
    relief: 'mountains',
    amp: [1400, 2800],
    freq: [0.9, 1.4],
    material: 'rock',
    low: 0x6b7a4c,
    mid: 0x7e8471,
    high: 0x9a9890,
    rock: 0x83807a,
    foliage: 0x5c7f3e,
    grass: 0.45,
    grassHeight: 0.25,
    flora: [
      { kind: 'pine', density: 0.25, scale: [0.7, 1.3] },
      { kind: 'boulder', density: 0.3, scale: [0.6, 2] },
      { kind: 'rocks', density: 0.4, scale: [0.6, 1.4] },
    ],
    climate: [0.35, 0.45],
    snowBelow: 0.4,
  }),
  b({
    id: 'savanna',
    name: 'Golden savanna',
    relief: 'plains',
    amp: [80, 220],
    freq: [0.6, 1],
    material: 'grass',
    low: 0xb79a4f,
    mid: 0xc6a85a,
    high: 0xb49864,
    rock: 0x8f7a5c,
    foliage: 0xc9ad55,
    grass: 0.9,
    grassHeight: 0.75,
    flora: [
      { kind: 'acacia', density: 0.18, scale: [0.9, 1.5] },
      { kind: 'baobab', density: 0.05, scale: [0.9, 1.4] },
      { kind: 'bush', density: 0.2, scale: [0.6, 1.1], tint: 0x6b7a33 },
      { kind: 'rocks', density: 0.08, scale: [0.6, 1.3] },
    ],
    climate: [0.78, 0.32],
  }),
  b({
    id: 'jungle',
    name: 'Rainforest',
    relief: 'hills',
    amp: [300, 800],
    freq: [1, 1.6],
    material: 'forest',
    low: 0x2f5a22,
    mid: 0x356b26,
    high: 0x4a6e34,
    rock: 0x5e5c4c,
    foliage: 0x2e8a2a,
    grass: 0.85,
    grassHeight: 0.6,
    flora: [
      { kind: 'broadleaf', density: 0.9, scale: [1.2, 2.2], tint: 0x2a7f2a },
      { kind: 'palm', density: 0.45, scale: [0.9, 1.5] },
      { kind: 'fern', density: 0.8, scale: [0.8, 1.6] },
      { kind: 'bush', density: 0.4, scale: [0.6, 1.2] },
    ],
    climate: [0.86, 0.85],
  }),
  b({
    id: 'swamp',
    name: 'Mangrove wetlands',
    relief: 'plains',
    amp: [30, 90],
    freq: [0.8, 1.4],
    material: 'mud',
    low: 0x3b4a2c,
    mid: 0x4a5a32,
    high: 0x5c6440,
    rock: 0x55503f,
    foliage: 0x4f7a34,
    grass: 0.75,
    grassHeight: 0.8,
    flora: [
      { kind: 'willow', density: 0.4, scale: [0.9, 1.5] },
      { kind: 'reeds', density: 0.7, scale: [0.8, 1.3] },
      { kind: 'mushroom', density: 0.06, scale: [0.2, 0.4] },
    ],
    climate: [0.66, 0.95],
  }),
  b({
    id: 'tundra',
    name: 'Lichen tundra',
    relief: 'plains',
    amp: [90, 260],
    freq: [0.8, 1.3],
    material: 'moss',
    low: 0x7a8064,
    mid: 0x8b8c72,
    high: 0x9d9b8c,
    rock: 0x7f7c75,
    foliage: 0x8a8f5c,
    grass: 0.4,
    grassHeight: 0.18,
    flora: [
      { kind: 'rocks', density: 0.45, scale: [0.5, 1.4] },
      { kind: 'boulder', density: 0.12, scale: [0.5, 1.5] },
      { kind: 'bush', density: 0.12, scale: [0.3, 0.6], tint: 0x7a5a3a },
    ],
    climate: [0.15, 0.4],
    snowBelow: 0.12,
  }),
  b({
    id: 'autumn',
    name: 'Autumn woods',
    relief: 'hills',
    amp: [220, 520],
    freq: [0.9, 1.4],
    material: 'forest',
    low: 0x6a5a30,
    mid: 0x7a6334,
    high: 0x82734e,
    rock: 0x756c5e,
    foliage: 0xc46a24,
    grass: 0.6,
    grassHeight: 0.35,
    flora: [
      { kind: 'autumn', density: 0.75, scale: [0.9, 1.5] },
      { kind: 'birch', density: 0.35, scale: [0.9, 1.4] },
      { kind: 'bush', density: 0.25, scale: [0.6, 1], tint: 0xa8442a },
    ],
    climate: [0.42, 0.62],
  }),
  b({
    id: 'steppe',
    name: 'Windswept steppe',
    relief: 'plains',
    amp: [60, 180],
    freq: [0.6, 1],
    material: 'grass',
    low: 0x9b9157,
    mid: 0xa79c63,
    high: 0x9d9278,
    rock: 0x80786a,
    foliage: 0xa6a05a,
    grass: 0.85,
    grassHeight: 0.45,
    flora: [
      { kind: 'bush', density: 0.25, scale: [0.4, 0.9], tint: 0x6f7244 },
      { kind: 'rocks', density: 0.15, scale: [0.5, 1.2] },
    ],
    climate: [0.48, 0.25],
  }),
  b({
    id: 'blossom',
    name: 'Blossom valleys',
    relief: 'hills',
    amp: [160, 420],
    freq: [0.9, 1.4],
    material: 'grass',
    low: 0x6a8f48,
    mid: 0x79a050,
    high: 0x8f9a70,
    rock: 0x86807a,
    foliage: 0xf0a6c8,
    grass: 0.85,
    grassHeight: 0.4,
    flora: [
      { kind: 'blossom', density: 0.55, scale: [0.8, 1.4] },
      { kind: 'flowers', density: 0.5, scale: [0.8, 1.2] },
      { kind: 'rocks', density: 0.1, scale: [0.4, 1] },
    ],
    climate: [0.6, 0.68],
  }),
  b({
    id: 'mushroom',
    name: 'Giant fungus groves',
    relief: 'hills',
    amp: [200, 480],
    freq: [1, 1.5],
    material: 'alien',
    low: 0x4a3f5c,
    mid: 0x5a4a6a,
    high: 0x6f6178,
    rock: 0x5e5664,
    foliage: 0x8a5ad0,
    grass: 0.55,
    grassHeight: 0.3,
    flora: [
      { kind: 'mushroom', density: 0.65, scale: [1, 3.2] },
      { kind: 'glowPlant', density: 0.4, scale: [0.6, 1.2] },
      { kind: 'fern', density: 0.3, scale: [0.6, 1], tint: 0x6a4aa0 },
    ],
    glow: 0x6fe0ff,
    glowStrength: 1.2,
    climate: [0.62, 0.9],
  }),
  // ── Arid ──────────────────────────────────────────────────────────────
  b({
    id: 'dunes',
    name: 'Golden dune sea',
    relief: 'dunes',
    amp: [140, 380],
    freq: [0.8, 1.2],
    material: 'sand',
    low: 0xd2a868,
    mid: 0xdcb476,
    high: 0xe6c48c,
    rock: 0xb08458,
    foliage: 0x7a8a46,
    grass: 0.04,
    flora: [
      { kind: 'cactus', density: 0.03, scale: [0.8, 1.3] },
      { kind: 'rocks', density: 0.04, scale: [0.5, 1] },
    ],
    climate: [0.85, 0.08],
  }),
  b({
    id: 'redCanyons',
    name: 'Red rock canyons',
    relief: 'canyons',
    amp: [700, 1500],
    freq: [0.9, 1.3],
    material: 'rock',
    low: 0xb0623a,
    mid: 0xc2723f,
    high: 0xd08a52,
    rock: 0x9a4e2e,
    foliage: 0x6f7a3c,
    grass: 0.08,
    grassHeight: 0.3,
    flora: [
      { kind: 'boulder', density: 0.25, scale: [0.6, 2.2] },
      { kind: 'deadTree', density: 0.05, scale: [0.6, 1.2] },
      { kind: 'bush', density: 0.1, scale: [0.4, 0.8], tint: 0x6a6a3a },
    ],
    climate: [0.75, 0.2],
  }),
  b({
    id: 'mesas',
    name: 'Painted mesas',
    relief: 'mesas',
    amp: [500, 1100],
    freq: [0.8, 1.2],
    material: 'rock',
    low: 0xc89a6a,
    mid: 0xb8754c,
    high: 0xd9b08a,
    rock: 0xa8603c,
    foliage: 0x7f8a4a,
    grass: 0.12,
    grassHeight: 0.3,
    flora: [
      { kind: 'cactus', density: 0.12, scale: [0.8, 1.5] },
      { kind: 'boulder', density: 0.15, scale: [0.5, 1.6] },
      { kind: 'bush', density: 0.12, scale: [0.4, 0.8], tint: 0x6f7840 },
    ],
    climate: [0.7, 0.14],
  }),
  b({
    id: 'saltFlats',
    name: 'Mirror salt flats',
    relief: 'plains',
    amp: [8, 25],
    freq: [0.5, 0.8],
    material: 'salt',
    low: 0xe8e4dc,
    mid: 0xf0ece4,
    high: 0xe2dccf,
    rock: 0xb8ae9c,
    foliage: 0x9a9a7a,
    grass: 0,
    flora: [{ kind: 'rocks', density: 0.02, scale: [0.3, 0.7] }],
    climate: [0.68, 0.02],
  }),
  b({
    id: 'badlands',
    name: 'Stone badlands',
    relief: 'hills',
    amp: [300, 700],
    freq: [1.2, 1.8],
    material: 'rock',
    low: 0x9a8064,
    mid: 0xa8886a,
    high: 0xb39a80,
    rock: 0x8a7058,
    foliage: 0x7d7a50,
    grass: 0.1,
    grassHeight: 0.25,
    flora: [
      { kind: 'boulder', density: 0.35, scale: [0.6, 2] },
      { kind: 'deadTree', density: 0.08, scale: [0.6, 1.2] },
      { kind: 'rocks', density: 0.3, scale: [0.5, 1.2] },
    ],
    climate: [0.6, 0.12],
  }),
  b({
    id: 'cactusScrub',
    name: 'Cactus scrubland',
    relief: 'plains',
    amp: [80, 220],
    freq: [0.8, 1.2],
    material: 'sand',
    low: 0xc39b6a,
    mid: 0xcca673,
    high: 0xc4a684,
    rock: 0x9e7c5a,
    foliage: 0x6b8a44,
    grass: 0.25,
    grassHeight: 0.3,
    flora: [
      { kind: 'cactus', density: 0.35, scale: [0.8, 1.6] },
      { kind: 'bush', density: 0.3, scale: [0.4, 0.9], tint: 0x7a7a42 },
      { kind: 'rocks', density: 0.15, scale: [0.5, 1.1] },
    ],
    climate: [0.8, 0.22],
  }),
  b({
    id: 'blackDunes',
    name: 'Black sand dunes',
    relief: 'dunes',
    amp: [120, 320],
    freq: [0.8, 1.2],
    material: 'sand',
    low: 0x2e2c2c,
    mid: 0x3a3634,
    high: 0x4a4440,
    rock: 0x2a2624,
    foliage: 0x4a5a3a,
    grass: 0.02,
    flora: [{ kind: 'basalt', density: 0.05, scale: [0.6, 1.4] }],
    climate: [0.7, 0.05],
  }),
  // ── Frozen ────────────────────────────────────────────────────────────
  b({
    id: 'snowfields',
    name: 'Powder snowfields',
    relief: 'hills',
    amp: [160, 420],
    freq: [0.7, 1.1],
    material: 'snow',
    low: 0xe6eef4,
    mid: 0xf1f5f8,
    high: 0xfafcfd,
    rock: 0x8a929a,
    foliage: 0x3e5a46,
    grass: 0,
    flora: [
      { kind: 'pine', density: 0.08, scale: [0.6, 1.2], tint: 0x2c4a38 },
      { kind: 'rocks', density: 0.1, scale: [0.5, 1.2] },
    ],
    climate: [0.08, 0.5],
    snowBelow: 1,
  }),
  b({
    id: 'glacier',
    name: 'Blue glaciers',
    relief: 'glacial',
    amp: [300, 800],
    freq: [0.8, 1.2],
    material: 'ice',
    low: 0x9cc8e0,
    mid: 0xb6d8ea,
    high: 0xd8ecf6,
    rock: 0x6a8aa0,
    foliage: 0x7a9aa0,
    grass: 0,
    flora: [
      { kind: 'iceSpike', density: 0.08, scale: [0.6, 1.6] },
      { kind: 'boulder', density: 0.05, scale: [0.5, 1.2], tint: 0x9ab8c8 },
    ],
    climate: [0.04, 0.7],
    snowBelow: 1,
  }),
  b({
    id: 'iceSpires',
    name: 'Ice spire forest',
    relief: 'spires',
    amp: [450, 950],
    freq: [0.9, 1.3],
    material: 'ice',
    low: 0xb8dcef,
    mid: 0xcfe7f5,
    high: 0xeef7fc,
    rock: 0x7ba6c4,
    foliage: 0x9ac4dc,
    grass: 0,
    flora: [
      { kind: 'iceSpike', density: 0.55, scale: [0.8, 2.6] },
      { kind: 'crystal', density: 0.1, scale: [0.5, 1.2], tint: 0x9fe0ff },
    ],
    glow: 0x8fd8ff,
    glowStrength: 0.3,
    climate: [0.02, 0.3],
    snowBelow: 1,
  }),
  b({
    id: 'frostPlains',
    name: 'Frost plains',
    relief: 'plains',
    amp: [50, 150],
    freq: [0.7, 1.1],
    material: 'snow',
    low: 0xd2dde4,
    mid: 0xdde6ec,
    high: 0xe8eef2,
    rock: 0x8e98a0,
    foliage: 0x6a7a74,
    grass: 0.15,
    grassHeight: 0.15,
    flora: [{ kind: 'rocks', density: 0.25, scale: [0.4, 1.2], tint: 0x9aa4ac }],
    climate: [0.1, 0.25],
    snowBelow: 0.2,
  }),
  // ── Volcanic ──────────────────────────────────────────────────────────
  b({
    id: 'lavaFields',
    name: 'Lava fields',
    relief: 'volcanic',
    amp: [500, 1400],
    freq: [0.9, 1.3],
    material: 'lava',
    low: 0x221a18,
    mid: 0x2c2220,
    high: 0x3a2e2a,
    rock: 0x1a1414,
    foliage: 0x3a2a24,
    grass: 0,
    flora: [
      { kind: 'lavaRock', density: 0.35, scale: [0.6, 1.8] },
      { kind: 'basalt', density: 0.15, scale: [0.6, 1.6] },
    ],
    glow: 0xff5a1a,
    glowStrength: 3,
    climate: [0.95, 0.3],
  }),
  b({
    id: 'ashPlains',
    name: 'Ash plains',
    relief: 'plains',
    amp: [100, 300],
    freq: [0.8, 1.2],
    material: 'ash',
    low: 0x5a5654,
    mid: 0x6a6664,
    high: 0x7a7672,
    rock: 0x403c3a,
    foliage: 0x4a4440,
    grass: 0.05,
    grassHeight: 0.2,
    flora: [
      { kind: 'deadTree', density: 0.18, scale: [0.7, 1.4] },
      { kind: 'rocks', density: 0.25, scale: [0.5, 1.3], tint: 0x3a3634 },
    ],
    climate: [0.82, 0.5],
  }),
  b({
    id: 'obsidian',
    name: 'Obsidian ridges',
    relief: 'mountains',
    amp: [1000, 2200],
    freq: [1, 1.5],
    material: 'rock',
    low: 0x1c1a22,
    mid: 0x24222c,
    high: 0x2e2c38,
    rock: 0x17151c,
    foliage: 0x3a3048,
    grass: 0,
    flora: [
      { kind: 'crystal', density: 0.12, scale: [0.6, 1.6], tint: 0x6a3aff },
      { kind: 'basalt', density: 0.25, scale: [0.6, 1.8] },
    ],
    glow: 0xa060ff,
    glowStrength: 0.6,
    climate: [0.88, 0.7],
  }),
  b({
    id: 'sulfur',
    name: 'Sulfur springs',
    relief: 'craters',
    amp: [150, 400],
    freq: [0.9, 1.3],
    material: 'ash',
    low: 0xc6b03a,
    mid: 0xd4c050,
    high: 0xb8a668,
    rock: 0x8a7a3a,
    foliage: 0x9a8a2a,
    grass: 0,
    flora: [
      { kind: 'lavaRock', density: 0.12, scale: [0.4, 1] },
      { kind: 'crystal', density: 0.08, scale: [0.4, 0.9], tint: 0xf0e050 },
    ],
    glow: 0xffd040,
    glowStrength: 0.4,
    climate: [0.78, 0.82],
  }),
  // ── Barren ────────────────────────────────────────────────────────────
  b({
    id: 'regolith',
    name: 'Regolith plains',
    relief: 'craters',
    amp: [200, 600],
    freq: [0.8, 1.3],
    material: 'regolith',
    low: 0x6c6a66,
    mid: 0x7c7a76,
    high: 0x8e8b86,
    rock: 0x5a5854,
    foliage: 0x5a5854,
    grass: 0,
    flora: [
      { kind: 'boulder', density: 0.12, scale: [0.4, 1.6] },
      { kind: 'rocks', density: 0.35, scale: [0.4, 1.2] },
    ],
    climate: [0.5, 0.5],
  }),
  b({
    id: 'craterHighlands',
    name: 'Crater highlands',
    relief: 'craters',
    amp: [600, 1500],
    freq: [1, 1.6],
    material: 'regolith',
    low: 0x8a847a,
    mid: 0x9a9488,
    high: 0xaca598,
    rock: 0x76716a,
    foliage: 0x6a6660,
    grass: 0,
    flora: [{ kind: 'boulder', density: 0.25, scale: [0.5, 2.2] }],
    climate: [0.3, 0.3],
  }),
  b({
    id: 'rustPlains',
    name: 'Rust plains',
    relief: 'hills',
    amp: [200, 600],
    freq: [0.8, 1.2],
    material: 'sand',
    low: 0x9a4a2a,
    mid: 0xaa5a34,
    high: 0xb8704a,
    rock: 0x7a3a22,
    foliage: 0x6a4a3a,
    grass: 0,
    flora: [
      { kind: 'rocks', density: 0.45, scale: [0.4, 1.3] },
      { kind: 'boulder', density: 0.15, scale: [0.5, 1.8] },
    ],
    climate: [0.55, 0.15],
  }),
  b({
    id: 'basaltShelves',
    name: 'Basalt shelves',
    relief: 'mesas',
    amp: [300, 800],
    freq: [0.9, 1.3],
    material: 'rock',
    low: 0x3c3a3a,
    mid: 0x4a4646,
    high: 0x5a5552,
    rock: 0x2e2c2c,
    foliage: 0x4a5040,
    grass: 0.1,
    grassHeight: 0.2,
    flora: [
      { kind: 'basalt', density: 0.22, scale: [0.6, 1.8] },
      { kind: 'rocks', density: 0.2, scale: [0.4, 1] },
    ],
    climate: [0.4, 0.2],
  }),
  // ── Alien ─────────────────────────────────────────────────────────────
  b({
    id: 'crystalFields',
    name: 'Crystal fields',
    relief: 'spires',
    amp: [300, 900],
    freq: [1, 1.5],
    material: 'crystal',
    low: 0x3a3a5a,
    mid: 0x4a4a6e,
    high: 0x6a6a8e,
    rock: 0x2e2e48,
    foliage: 0x7af0ff,
    grass: 0.2,
    grassHeight: 0.2,
    flora: [
      { kind: 'crystal', density: 0.6, scale: [0.8, 3] },
      { kind: 'rocks', density: 0.15, scale: [0.4, 1], tint: 0x4a4a6a },
    ],
    glow: 0x6af0ff,
    glowStrength: 1.6,
    climate: [0.35, 0.2],
  }),
  b({
    id: 'glowForest',
    name: 'Bioluminescent forest',
    relief: 'hills',
    amp: [240, 600],
    freq: [0.9, 1.4],
    material: 'alien',
    low: 0x1e2a3e,
    mid: 0x24324a,
    high: 0x34405a,
    rock: 0x222838,
    foliage: 0x3a6ad8,
    grass: 0.8,
    grassHeight: 0.5,
    flora: [
      { kind: 'tendril', density: 0.6, scale: [0.9, 2] },
      { kind: 'glowPlant', density: 0.7, scale: [0.6, 1.4] },
      { kind: 'mushroom', density: 0.15, scale: [0.4, 1.2] },
    ],
    glow: 0x40ffd0,
    glowStrength: 2.2,
    climate: [0.55, 0.88],
  }),
  b({
    id: 'violetPrairie',
    name: 'Violet prairie',
    relief: 'plains',
    amp: [80, 240],
    freq: [0.7, 1.1],
    material: 'grass',
    low: 0x5a3a6a,
    mid: 0x6a447a,
    high: 0x7a5888,
    rock: 0x5a4a5a,
    foliage: 0x9a5ac0,
    grass: 0.95,
    grassHeight: 0.7,
    flora: [
      { kind: 'tendril', density: 0.12, scale: [0.8, 1.4] },
      { kind: 'glowPlant', density: 0.25, scale: [0.5, 1] },
      { kind: 'rocks', density: 0.08, scale: [0.4, 1] },
    ],
    glow: 0xff70d0,
    glowStrength: 0.7,
    climate: [0.65, 0.5],
  }),
  b({
    id: 'coralHighlands',
    name: 'Coral highlands',
    relief: 'hills',
    amp: [260, 700],
    freq: [1.1, 1.6],
    material: 'alien',
    low: 0xc87a6a,
    mid: 0xd88a74,
    high: 0xe4a48a,
    rock: 0xa86a5a,
    foliage: 0xff7a5a,
    grass: 0.3,
    grassHeight: 0.25,
    flora: [
      { kind: 'coral', density: 0.6, scale: [0.6, 2] },
      { kind: 'glowPlant', density: 0.15, scale: [0.4, 0.9] },
    ],
    glow: 0xffa060,
    glowStrength: 0.5,
    climate: [0.75, 0.65],
  }),
  b({
    id: 'toxicMarsh',
    name: 'Acid marsh',
    relief: 'plains',
    amp: [30, 100],
    freq: [0.8, 1.3],
    material: 'mud',
    low: 0x3a4a1a,
    mid: 0x4a5a22,
    high: 0x5a6a30,
    rock: 0x3a3a24,
    foliage: 0x9adf2a,
    grass: 0.6,
    grassHeight: 0.6,
    flora: [
      { kind: 'mushroom', density: 0.35, scale: [0.5, 1.8], tint: 0xc8e040 },
      { kind: 'reeds', density: 0.5, scale: [0.8, 1.4], tint: 0x7a9a2a },
      { kind: 'deadTree', density: 0.1, scale: [0.6, 1.2] },
    ],
    glow: 0xb0ff40,
    glowStrength: 0.9,
    climate: [0.7, 0.95],
  }),
  b({
    id: 'boneDesert',
    name: 'Ossuary desert',
    relief: 'dunes',
    amp: [120, 340],
    freq: [0.8, 1.2],
    material: 'sand',
    low: 0xd8ccb0,
    mid: 0xe0d6be,
    high: 0xe8e0cc,
    rock: 0xb0a490,
    foliage: 0x8a8a6a,
    grass: 0,
    flora: [
      { kind: 'boneArch', density: 0.08, scale: [0.8, 2] },
      { kind: 'rocks', density: 0.08, scale: [0.4, 1] },
    ],
    climate: [0.85, 0.15],
  }),
  // ── Coast / ocean ─────────────────────────────────────────────────────
  b({
    id: 'tropicalIsles',
    name: 'Tropical isles',
    relief: 'hills',
    amp: [150, 500],
    freq: [1, 1.6],
    material: 'grass',
    low: 0xe2cf9c,
    mid: 0x6aa34a,
    high: 0x5a8a3e,
    rock: 0x7a7060,
    foliage: 0x46a03a,
    grass: 0.75,
    grassHeight: 0.45,
    flora: [
      { kind: 'palm', density: 0.6, scale: [0.9, 1.5] },
      { kind: 'bush', density: 0.3, scale: [0.5, 1] },
      { kind: 'fern', density: 0.3, scale: [0.6, 1.1] },
    ],
    climate: [0.85, 0.7],
  }),
  b({
    id: 'cliffs',
    name: 'Sea stacks',
    relief: 'spires',
    amp: [300, 800],
    freq: [1, 1.4],
    material: 'rock',
    low: 0x8a8476,
    mid: 0x6f8a52,
    high: 0x7a9a5a,
    rock: 0x7a746a,
    foliage: 0x5a8a3e,
    grass: 0.6,
    grassHeight: 0.3,
    flora: [
      { kind: 'bush', density: 0.25, scale: [0.4, 0.9] },
      { kind: 'boulder', density: 0.2, scale: [0.5, 1.6] },
    ],
    climate: [0.45, 0.75],
  }),
];

export const BIOME_INDEX = new Map(BIOMES.map((biome, i) => [biome.id, i]));
export const biomeById = (id: string) => BIOMES[BIOME_INDEX.get(id) ?? 0];
