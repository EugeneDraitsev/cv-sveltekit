// Planet terrain, climate and biomes. Requires common.wgsl, noise.wgsl and a
// `planetTex` data texture (one row per body, see world/pack.ts). Every
// function here has a CPU twin in world/terrain.ts; keep them in lock-step.

struct Planet {
  offset: vec3f,
  continentFreq: f32,
  seaThreshold: f32,
  relief: f32,
  biomeCount: i32,
  giant: f32,
  water: f32,
  turbulence: f32,
}

struct Biome {
  climate: vec2f,
  amp: f32,
  freq: f32,
  style: i32,
  material: i32,
  snowBelow: f32,
  grass: f32,
}

// Each biome occupies BIOME_STRIDE texels starting at texel 16 (see pack.ts).
const BIOME_STRIDE: i32 = 16;

fn biomeTexel(row: i32, biome: i32, slot: i32) -> vec4f {
  return textureLoad(planetTex, vec2i(16 + biome * BIOME_STRIDE + slot, row), 0);
}

fn planetTexel(row: i32, i: i32) -> vec4f {
  return textureLoad(planetTex, vec2i(i, row), 0);
}

fn loadPlanet(row: i32) -> Planet {
  let a: vec4f = planetTexel(row, 0);
  let b: vec4f = planetTexel(row, 1);
  let c: vec4f = planetTexel(row, 2);
  var p: Planet;
  p.offset = a.xyz;
  p.continentFreq = a.w;
  p.seaThreshold = b.x;
  p.relief = b.y;
  p.biomeCount = i32(b.z);
  p.giant = b.w;
  p.water = c.x;
  p.turbulence = c.w;
  return p;
}

fn loadBiome(row: i32, index: i32) -> Biome {
  let a: vec4f = biomeTexel(row, index, 0);
  let b: vec4f = biomeTexel(row, index, 1);
  var bio: Biome;
  bio.climate = a.xy;
  bio.amp = a.z;
  bio.freq = a.w;
  bio.style = i32(b.x);
  bio.material = i32(b.y);
  bio.snowBelow = b.z;
  bio.grass = b.w;
  return bio;
}

// Relative climate in 0..1: x = temperature (cold poles), y = moisture.
fn planetClimate(n: vec3f, planet: Planet) -> vec2f {
  let q: vec3f = n * 1.7 + planet.offset * 0.37 + vec3f(11.3, 0.0, 0.0);
  let tn: f32 = fbm(q, 3);
  let mn: f32 = fbm(q * 1.3 + vec3f(31.7, 5.1, 2.3), 3);
  let t: f32 = 0.5 + tn * 0.8 + (0.35 - pow(abs(n.y), 1.5)) * 0.75;
  let m: f32 = 0.5 + mn * 1.0;
  return clamp(vec2f(t, m), vec2f(0.0), vec2f(1.0));
}

const BIOME_SHARPNESS: f32 = 60.0;

fn biomeWeight(climate: vec2f, center: vec2f) -> f32 {
  let d: vec2f = climate - center;
  return exp(-dot(d, d) * BIOME_SHARPNESS);
}

// The two strongest biomes: x, y = indices, z = weight of x in the blend.
fn topBiomes(row: i32, planet: Planet, climate: vec2f) -> vec3f {
  var best: f32 = -1.0;
  var second: f32 = -1.0;
  var bi: i32 = 0;
  var si: i32 = 0;
  for (var i: i32 = 0; i < 8; i = i + 1) {
    if (i >= planet.biomeCount) {
      break;
    }
    let w: f32 = biomeWeight(climate, biomeTexel(row, i, 0).xy);
    if (w > best) {
      second = best;
      si = bi;
      best = w;
      bi = i;
    } else if (w > second) {
      second = w;
      si = i;
    }
  }
  let total: f32 = max(best + max(second, 0.0), 0.000001);
  return vec3f(f32(bi), f32(si), best / total);
}

// One relief style, roughly 0..1 (craters and canyons dip below zero).
fn reliefShape(style: i32, n: vec3f, freq: f32, offset: vec3f, octaves: i32) -> f32 {
  let p: vec3f = n * (70.0 * freq) + offset;
  if (style == 0) {
    return 0.25 + fbm(p * 0.6, octaves - 2) * 0.5;
  }
  if (style == 1) {
    return 0.5 + fbm(p, octaves) * 0.9;
  }
  if (style == 2) {
    let warp: vec3f = vec3f(gnoise(p * 0.5), gnoise(p * 0.5 + vec3f(5.2)), gnoise(p * 0.5 + vec3f(9.7))) * 0.6;
    let r: f32 = ridged(p * 0.8 + warp, octaves);
    return pow(max(r, 0.0), 1.35) * 1.4;
  }
  if (style == 3) {
    let warp: f32 = fbm(p * 0.35, 3) * 2.2;
    let s: f32 = dot(p, normalize(vec3f(0.8, 0.15, 0.58))) * 5.2 + warp;
    let x: f32 = fract(s);
    let dune: f32 = select(1.0 - (x - 0.72) / 0.28, x / 0.72, x < 0.72);
    let crest: f32 = pow(clamp(dune, 0.0, 1.0), 1.6);
    return crest * (0.55 + 0.45 * gnoise(p * 0.21)) + fbm(p * 2.0, octaves - 3) * 0.08 + 0.2;
  }
  if (style == 4) {
    let v: f32 = 0.5 + fbm(p * 0.7, octaves - 1) * 1.1;
    let steps: f32 = 4.0;
    let level: f32 = floor(v * steps);
    let edge: f32 = smoothstep(0.74, 1.0, fract(v * steps));
    return (level + edge) / steps + fbm(p * 3.0, 3) * 0.03;
  }
  if (style == 5) {
    let plateau: f32 = 0.75 + fbm(p * 0.5, 4) * 0.35;
    let channel: f32 = abs(gnoise(p * 0.45 + vec3f(fbm(p * 0.2, 2) * 1.5)));
    let carve: f32 = smoothstep(0.0, 0.16, channel);
    // Rounded steps: a hard floor() makes walls the vertex grid cannot resolve.
    let shelf: f32 = carve * 5.0 + 0.5;
    let terraces: f32 = (floor(shelf) + smoothstep(0.72, 1.0, fract(shelf))) / 5.0;
    return plateau * mix(carve, terraces, 0.45) + fbm(p * 2.5, octaves - 3) * 0.05;
  }
  if (style == 6) {
    var h: f32 = 0.35 + fbm(p * 0.6, octaves - 2) * 0.4;
    var scale: f32 = 0.35;
    var amp: f32 = 1.0;
    for (var k: i32 = 0; k < 2; k = k + 1) {
      let cell: vec2f = cellular(p * scale + vec3f(f32(k) * 17.0));
      let radius: f32 = 0.18 + cell.y * 0.3;
      let r: f32 = cell.x / radius;
      if (r < 1.6) {
        let bowl: f32 = (r * r - 1.0) * 0.55;
        let rim: f32 = exp(-pow((r - 1.0) / 0.22, 2.0)) * 0.35;
        h = h + (min(bowl, 0.0) + rim) * amp * smoothstep(1.6, 1.2, r) * step(0.35, cell.y);
      }
      scale = scale * 2.6;
      amp = amp * 0.45;
    }
    return h;
  }
  if (style == 7) {
    let cell: vec2f = cellular(p * 1.8);
    // Broad enough at the base for the patch grid to resolve from afar.
    let spire: f32 = pow(max(0.0, 1.0 - cell.x * 1.5), 2.2) * step(0.45, cell.y) * (0.8 + cell.y);
    return 0.25 + fbm(p * 0.5, octaves - 2) * 0.35 + spire * 1.5;
  }
  if (style == 8) {
    let cell: vec2f = cellular(p * 0.3);
    let r: f32 = cell.x;
    let cone: f32 = max(0.0, 1.0 - r * 1.25) * (0.5 + cell.y);
    let caldera: f32 = smoothstep(0.18, 0.05, r) * 0.45 * cell.y;
    let flows: f32 = fbm(p * 1.1, octaves - 1) * 0.35;
    return 0.2 + cone * cone * 1.6 - caldera + flows;
  }
  // 9: glacial plates with crevasses.
  let base: f32 = 0.45 + fbm(p * 0.5, octaves - 2) * 0.5;
  let crack: f32 = 1.0 - smoothstep(0.0, 0.05, abs(gnoise(p * 1.7)));
  return base - crack * 0.12;
}

// Height above sea level in planet radii. `octaves` trades detail for speed.
fn terrainHeight(row: i32, planet: Planet, n: vec3f, octaves: i32) -> f32 {
  if (planet.giant > 0.5) {
    return 0.0004 * fbm(n * 40.0 + planet.offset, 4);
  }
  let p: vec3f = n * planet.continentFreq + planet.offset;
  let c: f32 = fbm(p, 5) + fbm(p * 4.3 + vec3f(3.1, 7.7, 1.9), 3) * 0.18;
  let e: f32 = c - planet.seaThreshold;
  var h: f32 = select(e * planet.relief * 1.6, e * planet.relief * 0.55, e > 0.0);
  // Relief fades in over a broad coastal belt; a narrow ramp raised whole
  // mountain ranges as sheer walls along the shore.
  let land: f32 = smoothstep(-0.012, 0.22, e);
  let climate: vec2f = planetClimate(n, planet);
  var total: f32 = 0.0;
  var relief: f32 = 0.0;
  for (var i: i32 = 0; i < 8; i = i + 1) {
    if (i >= planet.biomeCount) {
      break;
    }
    let bio: Biome = loadBiome(row, i);
    let w: f32 = biomeWeight(climate, bio.climate);
    total = total + w;
    if (w > 0.004) {
      relief = relief + w * reliefShape(bio.style, n, bio.freq, planet.offset + vec3f(f32(i) * 13.1), octaves) * bio.amp;
    }
  }
  h = h + relief / max(total, 0.000001) * land;
  return h;
}
