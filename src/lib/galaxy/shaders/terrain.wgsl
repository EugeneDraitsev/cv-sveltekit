// Planet surface mesh. Patches of a cube-sphere quadtree read their heights
// from a GPU-built atlas; positions are rebuilt relative to the eye with
// cancellation-free maths, so the ground stays rock-steady at walking
// height. Requires common, noise, planet, atmosphere, surface and the `pl`
// uniform block.

fn faceN(i: i32) -> vec3f {
  var a: array<vec3f, 6> = array<vec3f, 6>(vec3f(1.0, 0.0, 0.0), vec3f(-1.0, 0.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, -1.0, 0.0), vec3f(0.0, 0.0, 1.0), vec3f(0.0, 0.0, -1.0));
  return a[i];
}
fn faceU(i: i32) -> vec3f {
  var a: array<vec3f, 6> = array<vec3f, 6>(vec3f(0.0, 0.0, -1.0), vec3f(0.0, 0.0, 1.0), vec3f(1.0, 0.0, 0.0), vec3f(1.0, 0.0, 0.0), vec3f(1.0, 0.0, 0.0), vec3f(-1.0, 0.0, 0.0));
  return a[i];
}
fn faceV(i: i32) -> vec3f {
  var a: array<vec3f, 6> = array<vec3f, 6>(vec3f(0.0, 1.0, 0.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 0.0, -1.0), vec3f(0.0, 0.0, 1.0), vec3f(0.0, 1.0, 0.0), vec3f(0.0, 1.0, 0.0));
  return a[i];
}

const QUARTER_PI: f32 = 0.785398163;

fn cubeDir(face: i32, u: f32, v: f32) -> vec3f {
  return normalize(faceN(face) + faceU(face) * tan(u * QUARTER_PI) + faceV(face) * tan(v * QUARTER_PI));
}

// d(u, v) − f for the node centre direction f = normalize(F(uc, vc)), L = |F(uc, vc)|,
// evaluated without subtracting two nearly equal unit vectors.
fn dirDelta(face: i32, uc: f32, vc: f32, du: f32, dv: f32, f: vec3f, L: f32) -> vec3f {
  let ac: f32 = uc * QUARTER_PI;
  let bc: f32 = vc * QUARTER_PI;
  let a: f32 = ac + du * QUARTER_PI;
  let b: f32 = bc + dv * QUARTER_PI;
  let tu: f32 = sin(du * QUARTER_PI) / (cos(a) * cos(ac));
  let tv: f32 = sin(dv * QUARTER_PI) / (cos(b) * cos(bc));
  let g: vec3f = (faceU(face) * tu + faceV(face) * tv) / L;
  let x: f32 = 2.0 * dot(f, g) + dot(g, g);
  let s: f32 = sqrt(1.0 + x);
  return (g - f * (x / (1.0 + s))) / s;
}

// Logarithmic depth in WebGPU clip convention (z in [0, w]).
fn logDepth(z: f32) -> f32 {
  return log2(1.0 + max(z, 0.0) * pl.clip.x) * pl.clip.y;
}

// w stays the true view depth, negative behind the eye, so the rasteriser
// clips triangles that straddle the camera plane instead of smearing a
// vertex pushed to w ≈ 0 across the whole screen.
fn viewClip(rel: vec3f) -> vec4f {
  let x: f32 = dot(rel, pl.right.xyz);
  let y: f32 = dot(rel, pl.up.xyz);
  let z: f32 = dot(rel, pl.forward.xyz);
  return vec4f(x / (pl.eye.w * pl.viewport.w), y / pl.eye.w, logDepth(z) * z, z);
}

fn atlasTexel(coord: vec2i) -> vec4f {
  return textureLoad(atlasTex, coord, 0);
}

// Water, ice and lava surfaces: shaded at sea level.
fn shadeLiquid(row: i32, planet: Planet, n: vec3f, h: f32, viewDir: vec3f, dist: f32, sun: vec3f, sunLight: vec3f, ambient: vec3f) -> vec3f {
  let kind: f32 = planet.water;
  let meters: f32 = planetTexel(row, 2).y * 100000.0;
  let depthM: f32 = max(-h * meters, 0.0);
  let shallow: vec3f = planetTexel(row, 3).rgb;
  let deep: vec3f = planetTexel(row, 4).rgb;
  let time: f32 = pl.viewport.z;
  let footprint: f32 = dist * 2.0 * pl.eye.w / pl.viewport.y;
  let tangentU: vec3f = normalize(cross(n, vec3f(0.31, 0.95, 0.12)));
  let tangentV: vec3f = cross(n, tangentU);
  let p: vec3f = n * meters;
  if (kind > 2.5 && kind < 3.5) {
    // Frozen sea: cracked plates under a dusting of snow.
    let crack: f32 = 1.0 - smoothstep(0.0, 0.04, abs(gnoise(p * 0.02)));
    let base: vec3f = mix(shallow, deep, 0.25) * (0.85 + 0.15 * gnoise(p * 0.11));
    let lit: vec3f = base * (sunLight * max(dot(n, sun), 0.0) + ambient);
    return lit * (1.0 - crack * 0.35);
  }
  // Waves fade with the pixel footprint to keep distant water calm.
  let fade: f32 = exp(-footprint * meters * 0.004);
  let w1: f32 = gnoise(vec3f(p.x * 0.05 + time * 0.4, p.y * 0.05, p.z * 0.05 - time * 0.3));
  let w2: f32 = gnoise(vec3f(p.x * 0.17 - time * 0.6, p.y * 0.17 + time * 0.2, p.z * 0.17));
  let ripple: vec3f = (tangentU * (w1 * 0.6 + w2 * 0.25) + tangentV * (w2 * 0.6 - w1 * 0.2)) * 0.18 * fade;
  let wn: vec3f = normalize(n + ripple);
  let fresnel: f32 = 0.03 + 0.97 * pow(1.0 - max(dot(wn, -viewDir), 0.0), 5.0);
  let absorb: f32 = 1.0 - exp(-depthM * 0.06);
  var body: vec3f = mix(shallow, deep, absorb);
  let diffuse: vec3f = body * (sunLight * max(dot(n, sun), 0.0) * 0.6 + ambient);
  let reflected: vec3f = reflect(viewDir, wn);
  // The sky it mirrors: hazy and bright near the horizon, deeper overhead
  // (measured from the local vertical, not the body frame's y axis).
  let skyTint: vec3f = (ambient * 3.4 + sunLight * 0.1) * mix(vec3f(1.0), vec3f(0.62, 0.76, 1.0), clamp(dot(reflected, n), 0.0, 1.0));
  var color: vec3f = mix(diffuse, skyTint, fresnel);
  // Sun glitter widens (and dims, keeping its energy) once a pixel covers many
  // ripples; a needle-sharp lobe would sparkle into isolated fireflies.
  let sharpness: f32 = 900.0 / (1.0 + footprint * meters * 0.8);
  let glint: f32 = pow(max(dot(reflected, sun), 0.0), sharpness) * 60.0 * (sharpness / 900.0) + pow(max(dot(reflected, sun), 0.0), 90.0) * 1.2;
  color = color + sunLight * glint * fade;
  // Foam where the water is shallow.
  let foam: f32 = (1.0 - smoothstep(0.0, 1.6, depthM)) * smoothstep(0.2, 0.7, gnoise(p * 0.3 + vec3f(time * 0.5)) + 0.5);
  color = mix(color, (sunLight * max(dot(n, sun), 0.0) + ambient) * 0.85, foam * 0.7);
  if (kind > 1.5 && kind < 2.5) {
    // Lava: a cooling crust over incandescent flow.
    // Fine flow octaves and a sharp crust edge only where pixels resolve them;
    // from orbit the sea averages into a smooth glow instead of sparkling.
    let footprintM: f32 = footprint * meters;
    let q: vec3f = p * 0.004 + vec3f(time * 0.02, 0.0, 0.0);
    let small: f32 = mix(fbm(q, 2), fbm(q, 4), exp(-footprintM / 40.0)) * (1.0 - smoothstep(60.0, 250.0, footprintM));
    let flow: f32 = fbm(p * 0.00025, 3) * 0.7 + small;
    let edge: f32 = 0.15 + min(footprintM / 300.0, 0.6);
    let crust: f32 = smoothstep(0.1 - edge, 0.1 + edge, flow);
    let hot: vec3f = mix(vec3f(4.0, 0.9, 0.12), vec3f(1.6, 0.18, 0.02), crust);
    color = mix(hot, vec3f(0.05, 0.03, 0.03) * (sunLight * max(dot(n, sun), 0.0) + ambient), crust * 0.85);
  }
  if (kind > 3.5) {
    color = color + shallow * 0.08 * (0.5 + 0.5 * sin(time * 0.7 + gnoise(p * 0.01) * 6.0));
  }
  return color;
}

// Starlight and moonlight: enough for the land to read as a cool silhouette
// at night, brighter under a high, full moon.
fn nightAmbient(up: vec3f) -> vec3f {
  let moon: f32 = pl.moon.w * smoothstep(-0.05, 0.25, dot(up, pl.moon.xyz));
  return vec3f(0.02, 0.028, 0.05) + vec3f(0.05, 0.066, 0.105) * moon;
}

// ─── Sun shadows: two orthographic cascades around the eye ─────────────────
fn cascadeData(index: i32) -> vec4f {
  return select(pl.cascade1, pl.cascade0, index == 0);
}

fn lightSpace(rel: vec3f, index: i32) -> vec3f {
  let c: vec4f = cascadeData(index);
  let lp: vec3f = vec3f(dot(rel, pl.shadowX.xyz), dot(rel, pl.shadowY.xyz), dot(rel, pl.shadowZ.xyz)) - c.xyz;
  return vec3f(lp.xy / c.w, 0.5 - lp.z / (2.0 * pl.shadow.x));
}

fn shadowClip(rel: vec3f, index: i32) -> vec4f {
  let l: vec3f = lightSpace(rel, index);
  return vec4f(l.xy, clamp(l.z, 0.0, 1.0), 1.0);
}

fn shadowTap(index: i32, coord: vec2i) -> f32 {
  if (index == 0) {
    return textureLoad(shadow0, coord, 0);
  }
  return textureLoad(shadow1, coord, 0);
}

// 1 = fully lit. 3×3 PCF; the far cascade fades out at its edge.
fn sunShadow(rel: vec3f, ndl: f32) -> f32 {
  if (pl.shadow.z < 0.5) {
    return 1.0;
  }
  var index: i32 = 0;
  var l: vec3f = lightSpace(rel, 0);
  if (max(abs(l.x), abs(l.y)) > 0.94) {
    index = 1;
    l = lightSpace(rel, 1);
    if (max(abs(l.x), abs(l.y)) > 0.98) {
      return 1.0;
    }
  }
  let size: f32 = pl.shadow.y;
  let uv: vec2f = ndcToUv(l.xy) * size;
  let texel: f32 = 2.0 * cascadeData(index).w / size;
  let bias: f32 = (texel * (1.5 + 3.0 * (1.0 - clamp(ndl, 0.0, 1.0)))) / (2.0 * pl.shadow.x);
  var lit: f32 = 0.0;
  for (var y: i32 = -1; y <= 1; y = y + 1) {
    for (var x: i32 = -1; x <= 1; x = x + 1) {
      let coord: vec2i = clamp(vec2i(floor(uv)) + vec2i(x, y), vec2i(0), vec2i(i32(size) - 1));
      lit = lit + select(0.0, 1.0, l.z - bias <= shadowTap(index, coord));
    }
  }
  var result: f32 = lit / 9.0;
  if (index == 1) {
    result = mix(result, 1.0, smoothstep(0.8, 0.98, max(abs(l.x), abs(l.y))));
  }
  return result;
}
