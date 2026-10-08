// Flora and grass around the camera. A placement pass evaluates, for every
// cell of a planet-anchored grid, whether a plant of a given kind grows there
// (biome mix, height, water) and where exactly; instanced meshes then read
// the result. Requires common, noise, planet, atmosphere, surface, terrain
// and the `pl` / `fl` uniform blocks.

fn isStone(kind: i32) -> bool {
  return kind == 12 || kind == 13 || kind == 17 || kind == 22 || kind == 20;
}

// Density, scale range and tint of `kind` mixed over the local biomes.
struct FloraMix {
  density: f32,
  scale: vec2f,
  tint: vec3f,
}

fn floraMix(row: i32, planet: Planet, climate: vec2f, kind: i32, grassLayer: bool) -> FloraMix {
  var result: FloraMix;
  result.density = 0.0;
  result.scale = vec2f(1.0);
  result.tint = vec3f(0.3, 0.5, 0.2);
  var total: f32 = 0.0;
  var best: f32 = 0.0;
  for (var b: i32 = 0; b < 8; b = b + 1) {
    if (b >= planet.biomeCount) {
      break;
    }
    let w: f32 = biomeWeight(climate, biomeTexel(row, b, 0).xy);
    total = total + w;
    if (grassLayer) {
      let info: vec4f = biomeTexel(row, b, 1);
      result.density = result.density + w * info.w;
      if (w > best) {
        best = w;
        result.scale = vec2f(biomeTexel(row, b, 2).w);
        result.tint = biomeTexel(row, b, 6).rgb;
      }
    } else {
      for (var k: i32 = 0; k < 4; k = k + 1) {
        let entry: vec4f = biomeTexel(row, b, 8 + k);
        if (i32(entry.x) == kind) {
          result.density = result.density + w * entry.y;
          if (w > best) {
            best = w;
            result.scale = entry.zw;
            result.tint = biomeTexel(row, b, 12 + k).rgb;
          }
        }
      }
    }
  }
  result.density = result.density / max(total, 0.000001);
  return result;
}

fn floraHash(iu: f32, iv: f32, salt: f32) -> vec4f {
  let h: vec3u = pcg3(vec3u(vec3i(i32(iu), i32(iv), i32(salt))));
  let g: vec3u = pcg3(h + vec3u(1013u));
  return vec4f(vec3f(h & vec3u(65535u)) / 65535.0, f32(g.x & 65535u) / 65535.0);
}

// Wind: a slow gust field travelling over the ground.
fn windOffset(p: vec3f, sway: f32, phase: f32) -> f32 {
  let t: f32 = pl.viewport.z;
  let gust: f32 = 0.6 + 0.4 * sin(t * 0.35 + dot(p, vec3f(3000.0, 1700.0, 2300.0)));
  return sin(t * 1.9 + phase * 6.28) * sway * gust;
}
