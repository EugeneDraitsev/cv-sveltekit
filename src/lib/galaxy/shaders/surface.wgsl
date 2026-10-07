// Surface materials shared by the orbital view and the terrain mesh, so a
// planet looks the same from 50 000 km and from 2 m. Requires common.wgsl,
// noise.wgsl, planet.wgsl and atmosphere.wgsl.

struct Material {
  albedo: vec3f,
  roughness: f32,
  emission: vec3f,
  snow: f32,
  foliage: vec3f,
  grass: f32,
}

fn biomeColor(row: i32, index: i32, slot: i32) -> vec3f {
  return biomeTexel(row, index, slot).rgb;
}

fn loadAir(row: i32) -> Air {
  let r: vec4f = planetTexel(row, 5);
  let h: vec4f = planetTexel(row, 6);
  var air: Air;
  air.rayleigh = r.rgb;
  air.density = r.w;
  air.hazeColor = h.rgb;
  air.haze = h.w;
  air.height = planetTexel(row, 7).w;
  return air;
}

// Ground colour of one biome at relative height `t` (0 valley … 1 peak).
fn biomeGround(row: i32, index: i32, t: f32, slope: f32, wet: f32, detail: f32, climate: vec2f, n: vec3f, air: f32) -> Material {
  let low: vec3f = biomeColor(row, index, 2);
  let mid: vec3f = biomeColor(row, index, 3);
  let high: vec3f = biomeColor(row, index, 4);
  let rock: vec3f = biomeColor(row, index, 5);
  let foliage: vec3f = biomeColor(row, index, 6);
  let info: vec4f = biomeTexel(row, index, 1);
  let material: i32 = i32(info.y);
  var c: vec3f = mix(low, mid, smoothstep(0.0, 0.4, t));
  c = mix(c, high, smoothstep(0.55, 1.0, t));
  // Vegetated materials tint the ground with their foliage.
  if (material == 0 || material == 1 || material == 9 || material == 13) {
    let patches: f32 = smoothstep(-0.25, 0.35, detail);
    c = mix(c, foliage * 0.85, info.w * 0.45 * patches);
  }
  var m: Material;
  m.roughness = 0.9;
  m.emission = vec3f(0.0);
  m.foliage = foliage;
  m.grass = info.w;
  // Cliffs and steep slopes show bare rock.
  let cliff: f32 = smoothstep(0.32, 0.62, slope + detail * 0.08);
  c = mix(c, rock, cliff);
  m.grass = m.grass * (1.0 - cliff);
  // Snow on cold biomes, and on high ground anywhere temperate. Without an
  // atmosphere nothing falls: only a thin frost settles on the coldest ground.
  let snowfall: f32 = smoothstep(0.0, 0.05, air);
  var snow: f32 = smoothstep(info.z + 0.04, info.z - 0.04, climate.x) * mix(0.45, 1.0, snowfall);
  snow = max(snow, smoothstep(0.78, 0.95, t + (0.45 - climate.x) * 0.6 + detail * 0.1) * step(climate.x, 0.75) * snowfall);
  snow = snow * (1.0 - smoothstep(0.45, 0.75, slope));
  if (material == 4 || material == 5) {
    snow = max(snow, 0.85);
  }
  m.snow = snow;
  let snowColor: vec3f = select(vec3f(0.92, 0.95, 1.0), vec3f(0.72, 0.86, 0.96), material == 5);
  c = mix(c, snowColor, snow);
  m.grass = m.grass * (1.0 - snow);
  if (material == 5 || material == 8) {
    m.roughness = 0.25;
  }
  if (material == 11) {
    m.roughness = 0.35;
  }
  // Wet sand / mud near shores.
  c = c * (1.0 - wet * 0.35);
  m.albedo = c;
  // Night-time glow: lava cracks, bioluminescence, crystals.
  let glow: vec3f = biomeColor(row, index, 7);
  let strength: f32 = biomeTexel(row, index, 3).w;
  if (strength > 0.0) {
    // Patches of glow; once a pixel spans many of them, their average.
    let glowAa: f32 = smoothstep(0.15, 0.6, length(fwidth(n * 900.0)));
    var pattern: f32 = mix(smoothstep(0.55, 0.85, 0.5 + detail), 0.16, glowAa);
    if (material == 7) {
      // Glowing cracks; once a pixel spans several cracks, use their mean
      // brightness instead of sparkling.
      let q: vec3f = n * 900.0;
      let crackAa: f32 = smoothstep(0.15, 0.6, length(fwidth(q)));
      let cracks: f32 = mix(pow(1.0 - abs(gnoise(q)), 14.0), 0.07, crackAa);
      pattern = cracks * (1.0 - cliff * 0.5) + smoothstep(0.1, 0.0, t) * 0.4;
    }
    m.emission = glow * strength * pattern;
  }
  return m;
}

// Full surface material at direction `n` with height `h` (planet radii).
fn surfaceMaterial(row: i32, planet: Planet, n: vec3f, h: f32, slope: f32, climate: vec2f, detail: f32) -> Material {
  let top: vec3f = topBiomes(row, planet, climate);
  let ia: i32 = i32(top.x);
  let ib: i32 = i32(top.y);
  let ampA: f32 = max(biomeTexel(row, ia, 0).z, 0.0005);
  let ampB: f32 = max(biomeTexel(row, ib, 0).z, 0.0005);
  let meters: f32 = planetTexel(row, 2).y * 100000.0;
  let shore: f32 = select(0.0, 1.0 - smoothstep(0.0, 9.0 / meters, h), planet.water > 0.5 && planet.water < 1.5);
  let air: f32 = planetTexel(row, 5).w;
  let a: Material = biomeGround(row, ia, h / ampA, slope, shore * 0.5, detail, climate, n, air);
  let b: Material = biomeGround(row, ib, h / ampB, slope, shore * 0.5, detail, climate, n, air);
  let w: f32 = smoothstep(0.0, 1.0, top.z + (detail - 0.0) * 0.18);
  var m: Material;
  m.albedo = mix(b.albedo, a.albedo, w);
  m.roughness = mix(b.roughness, a.roughness, w);
  m.emission = mix(b.emission, a.emission, w);
  m.snow = mix(b.snow, a.snow, w);
  m.foliage = mix(b.foliage, a.foliage, w);
  m.grass = mix(b.grass, a.grass, w);
  // Beaches on water worlds.
  if (shore > 0.0) {
    let sand: vec3f = vec3f(0.76, 0.68, 0.5);
    let beach: f32 = smoothstep(0.0, 0.6, shore) * (1.0 - m.snow) * (1.0 - smoothstep(0.4, 0.7, slope));
    m.albedo = mix(m.albedo, sand, beach);
    m.grass = m.grass * (1.0 - beach);
  }
  // Fine colour variation.
  m.albedo = m.albedo * (0.9 + detail * 0.2);
  return m;
}

// Banded gas-giant cloud tops (rows 8..11 hold the band palette).
fn gasColor(row: i32, planet: Planet, n: vec3f, time: f32) -> vec3f {
  let turbulence: f32 = planet.turbulence;
  let q: vec3f = n * 3.0 + planet.offset * 0.1;
  let warp: f32 = fbm(q * vec3f(1.0, 3.0, 1.0) + vec3f(time * 0.01, 0.0, 0.0), 4) * 0.35 * turbulence;
  let lat: f32 = n.y + warp * 0.25;
  let band: f32 = sin(lat * 18.0 + fbm(q * 0.7, 2) * 3.0) * 0.5 + 0.5;
  let fine: f32 = sin(lat * 61.0 + warp * 8.0) * 0.5 + 0.5;
  let storm: f32 = smoothstep(0.55, 0.8, fbm(q * vec3f(2.0, 6.0, 2.0) + vec3f(warp * 4.0), 4) + 0.2);
  var c: vec3f = mix(planetTexel(row, 8).rgb, planetTexel(row, 9).rgb, band);
  c = mix(c, planetTexel(row, 10).rgb, fine * 0.35);
  c = mix(c, planetTexel(row, 11).rgb, storm * 0.45 * turbulence);
  return c;
}

// Cloud cover in 0..1 at body direction n (already rotated by the cloud drift).
fn cloudDensity(n: vec3f, offset: vec3f, cover: f32, octaves: i32) -> f32 {
  let q: vec3f = n * 3.2 + offset * 0.2;
  let warp: vec3f = vec3f(fbm(q * 0.7, 2), fbm(q * 0.7 + vec3f(7.3), 2), fbm(q * 0.7 + vec3f(3.1), 2)) * 1.4;
  let d: f32 = 0.5 + (fbm(q + warp, octaves) + fbm(q * 4.1 + warp, 2) * 0.22) * 1.55;
  return smoothstep(1.0 - cover, 1.0 - cover + 0.3, d);
}

// Flora kinds that form a canopy (see FLORA_KINDS in world/floraMeshes.ts).
fn isTreeKind(kind: i32) -> bool {
  return kind <= 6 || kind == 14 || kind == 21 || kind == 23 || kind == 24;
}

// How densely trees cover a biome (0..1), for distant forest colouring.
fn canopyDensity(row: i32, biome: i32) -> f32 {
  var density: f32 = 0.0;
  for (var k: i32 = 0; k < 4; k = k + 1) {
    let entry: vec4f = biomeTexel(row, biome, 8 + k);
    if (entry.x >= 0.0 && isTreeKind(i32(entry.x))) {
      density = density + entry.y;
    }
  }
  return min(density, 1.0);
}
