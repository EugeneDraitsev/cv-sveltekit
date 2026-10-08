// Galaxy stars are generated on the GPU from their instance index: no CPU
// arrays, no upload, identical on every backend. Requires common.wgsl and
// galaxy.wgsl (for dust occlusion).

struct Star {
  position: vec3f,
  size: f32,
  color: vec3f,
  brightness: f32,
}

fn gauss(seed: u32) -> f32 {
  let u1: f32 = max(rand01(seed), 0.000001);
  let u2: f32 = rand01(seed + 7919u);
  return sqrt(-2.0 * log(u1)) * cos(TAU * u2);
}

fn galaxyStar(index: u32) -> Star {
  let base: u32 = pcg(index * 16u + 0x9e3779b9u);
  var star: Star;
  let population: f32 = rand01(base);
  let bulge: bool = population < 0.14;
  let halo: bool = population >= 0.94;
  let diffuse: bool = rand01(base + 1u) < 0.27;
  var p: vec3f = vec3f(0.0);
  var r: f32 = 0.0;
  if (bulge) {
    p = vec3f(gauss(base + 2u) * 1.6, gauss(base + 3u) * 0.86, gauss(base + 4u) * 1.6);
    r = length(p.xz);
  } else if (halo) {
    p = vec3f(gauss(base + 2u) * 5.2, gauss(base + 3u) * 2.4, gauss(base + 4u) * 5.2);
    let len: f32 = length(p);
    if (len > 18.0) {
      p = p * (18.0 * rand01(base + 5u) / len);
    }
    r = length(p.xz);
  } else {
    r = -log(max(0.000001, rand01(base + 2u) * rand01(base + 3u))) * 2.24 + 0.25;
    if (r > 13.7) {
      r = 0.25 + rand01(base + 6u) * 13.4;
    }
    let branch: bool = rand01(base + 4u) < 0.26;
    var arm: f32 = floor(rand01(base + 5u) * 2.0) * PI;
    if (branch) {
      arm = arm + PI * 0.5;
    }
    var angle: f32 = 3.5 * log(1.0 + r / 1.4) + arm + gauss(base + 7u) * (0.055 + 0.011 * r);
    if (diffuse) {
      angle = rand01(base + 8u) * TAU;
    }
    var spread: f32 = 0.14 + 0.12 * exp(-r * 0.2);
    if (diffuse) {
      spread = 0.4;
    }
    p = vec3f(cos(angle) * r, gauss(base + 9u) * spread + sin(angle * 2.0 + r * 0.3) * smoothstep(7.0, 14.0, r) * 0.38, sin(angle) * r);
  }
  let rare: f32 = rand01(base + 10u);
  let prominent: bool = rare > 0.99965;
  star.position = p;
  star.size = select(0.0025 + rand01(base + 11u) * 0.005, 0.018 + rand01(base + 11u) * 0.025, prominent);
  let warm: bool = bulge || halo || r < 2.9 || rand01(base + 12u) < 0.22;
  let pink: bool = !warm && !diffuse && rand01(base + 13u) < 0.065;
  let c1: f32 = rand01(base + 14u);
  let c2: f32 = rand01(base + 15u);
  if (warm) {
    star.color = vec3f(1.0, 0.63 + c1 * 0.24, 0.34 + c2 * 0.29);
  } else if (pink) {
    star.color = vec3f(1.0, 0.28 + c1 * 0.19, 0.62 + c2 * 0.2);
  } else {
    star.color = vec3f(0.42 + c1 * 0.3, 0.61 + c2 * 0.25, 1.0);
  }
  let b: f32 = rand01(base + 16u);
  var dim: f32 = 0.04;
  if (halo) {
    dim = 0.065;
  }
  star.brightness = select(dim + pow(b, 5.0) * 0.26, 0.65 + b * 1.6, prominent);
  return star;
}

// Background stars far beyond the galaxy: directions only, never parallax.
fn skyStar(index: u32) -> Star {
  let base: u32 = pcg(index * 8u + 0x6a09e667u);
  var star: Star;
  let y: f32 = 1.0 - 2.0 * rand01(base);
  let a: f32 = rand01(base + 1u) * TAU;
  let planar: f32 = sqrt(max(0.0, 1.0 - y * y));
  star.position = vec3f(cos(a) * planar, y, sin(a) * planar);
  let prominent: bool = rand01(base + 2u) > 0.975;
  star.size = select(0.65 + rand01(base + 3u) * 0.7, 2.6, prominent);
  star.color = kelvinColor(3300.0 + rand01(base + 4u) * 8500.0);
  star.brightness = select(0.25 + pow(rand01(base + 5u), 3.0) * 0.6, 1.6, prominent);
  return star;
}

// Optical depth of dust between a galaxy-space star and the eye. `star` is
// where the star is drawn (arm twist included); the dust is sampled through the
// same twist as renderGalaxy, so lanes dim the stars that lie behind them.
fn dustOcclusion(star: vec3f, eye: vec3f) -> f32 {
  let shape: vec3f = twistShape();
  let ray: vec3f = eye - star;
  let distance: f32 = length(ray);
  let dir: vec3f = ray / max(distance, 0.0001);
  let inv: vec3f = vec3f(1.0) / (dir + vec3f(0.000001));
  let bounds: vec3f = GALAXY_BOUNDS;
  let a: vec3f = (-bounds - star) * inv;
  let b: vec3f = (bounds - star) * inv;
  let nearV: vec3f = min(a, b);
  let farV: vec3f = max(a, b);
  let start: f32 = max(0.0, max(nearV.x, max(nearV.y, nearV.z)));
  let end: f32 = min(distance, min(farV.x, min(farV.y, farV.z)));
  if (end <= start) {
    return 1.0;
  }
  let stepLength: f32 = (end - start) / 6.0;
  var depth: f32 = 0.0;
  for (var i: i32 = 0; i < 6; i = i + 1) {
    let p: vec3f = star + dir * (start + (f32(i) + 0.5) * stepLength);
    depth = depth + sampleVolume(rotateY(p, -armTwist(p.xz, shape))).a * stepLength;
  }
  return exp(-depth * galaxy.look.w);
}

fn starCorner(index: u32) -> vec2f {
  var corners: array<vec2f, 6> = array<vec2f, 6>(vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0));
  return corners[index];
}

fn starProfile(q: vec2f) -> f32 {
  let r2: f32 = dot(q, q);
  let profile: f32 = exp(-r2 * 4.5) + exp(-r2 * 1.8) * 0.035;
  return profile * (1.0 - smoothstep(0.72, 1.0, r2));
}
