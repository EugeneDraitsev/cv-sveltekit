// Shared hashing, noise and colour helpers. Written in the translatable WGSL
// dialect (typed lets, one-line signatures) so WebGL2 runs the same code.

const PI: f32 = 3.14159265;
const TAU: f32 = 6.28318531;
// Half extents of the galaxy volume in galaxy units.
const GALAXY_BOUNDS: vec3f = vec3f(15.0, 3.0, 15.0);

fn hash31(p: vec3f) -> f32 {
  var q: vec3f = fract(p * 0.1031);
  q = q + vec3f(dot(q, q.yzx + vec3f(33.33)));
  return fract((q.x + q.y) * q.z);
}

fn hash21(p: vec2f) -> f32 {
  var q: vec3f = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  q = q + vec3f(dot(q, q.yzx + vec3f(33.33)));
  return fract((q.x + q.y) * q.z);
}

fn hash33(p: vec3f) -> vec3f {
  var q: vec3f = fract(p * vec3f(0.1031, 0.1030, 0.0973));
  q = q + vec3f(dot(q, q.yxz + vec3f(33.33)));
  return fract((q.xxy + q.yxx) * q.zyx);
}

// Integer PCG hash: identical on every GPU, used for per-instance randomness.
fn pcg(v: u32) -> u32 {
  let state: u32 = v * 747796405u + 2891336453u;
  let word: u32 = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn rand01(seed: u32) -> f32 {
  return f32(pcg(seed) >> 8u) / 16777216.0;
}

fn noise3(p: vec3f) -> f32 {
  let i: vec3f = floor(p);
  let f: vec3f = fract(p);
  let v: vec3f = f * f * (vec3f(3.0) - 2.0 * f);
  return mix(
    mix(mix(hash31(i), hash31(i + vec3f(1.0, 0.0, 0.0)), v.x),
        mix(hash31(i + vec3f(0.0, 1.0, 0.0)), hash31(i + vec3f(1.0, 1.0, 0.0)), v.x), v.y),
    mix(mix(hash31(i + vec3f(0.0, 0.0, 1.0)), hash31(i + vec3f(1.0, 0.0, 1.0)), v.x),
        mix(hash31(i + vec3f(0.0, 1.0, 1.0)), hash31(i + vec3f(1.0, 1.0, 1.0)), v.x), v.y),
    v.z);
}

fn fbm3(p: vec3f) -> f32 {
  var q: vec3f = p;
  var sum: f32 = 0.0;
  var amp: f32 = 0.53;
  for (var i: i32 = 0; i < 5; i = i + 1) {
    sum = sum + noise3(q) * amp;
    q = q * 2.03 + vec3f(19.1, 7.7, 3.4);
    amp = amp * 0.48;
  }
  return sum;
}

fn rotateY(p: vec3f, a: f32) -> vec3f {
  let c: f32 = cos(a);
  let s: f32 = sin(a);
  return vec3f(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
}

fn luminance(c: vec3f) -> f32 {
  return dot(c, vec3f(0.2126, 0.7152, 0.0722));
}

// Approximate black-body tint for 2300–14000 K, matching world/color.ts.
fn kelvinColor(kelvin: f32) -> vec3f {
  let t: f32 = clamp(kelvin, 2300.0, 14000.0);
  if (t < 5000.0) {
    let f: f32 = (t - 2300.0) / 2700.0;
    return vec3f(1.0, 0.34 + f * 0.4, 0.12 + f * 0.47);
  }
  let g: f32 = min(1.0, (t - 5000.0) / 7000.0);
  return vec3f(1.0 - g * 0.37, 0.76 + g * 0.13, 0.68 + g * 0.32);
}

// Primary-ray direction for a fullscreen pass. `ndc` has y pointing up.
fn cameraRay(ndc: vec2f, forward: vec3f, right: vec3f, up: vec3f, tanHalf: f32, aspect: f32) -> vec3f {
  return normalize(forward + (right * ndc.x * aspect + up * ndc.y) * tanHalf);
}

fn fullscreenPosition(index: u32) -> vec2f {
  return vec2f(f32((index << 1u) & 2u), f32(index & 2u)) * 2.0 - vec2f(1.0);
}
