// Integer-hashed gradient noise. Mirrored exactly by world/noise.ts, so the
// CPU (camera collision, landing sites, HUD) and the GPU agree on terrain.

fn pcg3(v: vec3u) -> vec3u {
  var q: vec3u = v * 1664525u + vec3u(1013904223u);
  q.x = q.x + q.y * q.z;
  q.y = q.y + q.z * q.x;
  q.z = q.z + q.x * q.y;
  q = q ^ (q >> vec3u(16u));
  q.x = q.x + q.y * q.z;
  q.y = q.y + q.z * q.x;
  q.z = q.z + q.x * q.y;
  return q;
}

fn grad3(c: vec3i) -> vec3f {
  let h: vec3u = pcg3(vec3u(c));
  return vec3f(h & vec3u(65535u)) / 32767.5 - vec3f(1.0);
}

fn rand3(c: vec3i) -> vec3f {
  let h: vec3u = pcg3(vec3u(c) + vec3u(7919u));
  return vec3f(h & vec3u(65535u)) / 65535.0;
}

fn gnoise(p: vec3f) -> f32 {
  let fl: vec3f = floor(p);
  let i: vec3i = vec3i(fl);
  let f: vec3f = p - fl;
  let u: vec3f = f * f * f * (f * (f * 6.0 - vec3f(15.0)) + vec3f(10.0));
  let a: f32 = dot(grad3(i), f);
  let b: f32 = dot(grad3(i + vec3i(1, 0, 0)), f - vec3f(1.0, 0.0, 0.0));
  let c: f32 = dot(grad3(i + vec3i(0, 1, 0)), f - vec3f(0.0, 1.0, 0.0));
  let d: f32 = dot(grad3(i + vec3i(1, 1, 0)), f - vec3f(1.0, 1.0, 0.0));
  let e: f32 = dot(grad3(i + vec3i(0, 0, 1)), f - vec3f(0.0, 0.0, 1.0));
  let g: f32 = dot(grad3(i + vec3i(1, 0, 1)), f - vec3f(1.0, 0.0, 1.0));
  let h: f32 = dot(grad3(i + vec3i(0, 1, 1)), f - vec3f(0.0, 1.0, 1.0));
  let k: f32 = dot(grad3(i + vec3i(1, 1, 1)), f - vec3f(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);
}

fn fbm(p: vec3f, octaves: i32) -> f32 {
  var q: vec3f = p;
  var sum: f32 = 0.0;
  var amp: f32 = 0.5;
  for (var i: i32 = 0; i < octaves; i = i + 1) {
    sum = sum + gnoise(q) * amp;
    q = q * 2.03 + vec3f(1.7, 9.2, 4.3);
    amp = amp * 0.5;
  }
  return sum;
}

// Ridged multifractal in 0..~1: sharp crests, eroded-looking valleys.
fn ridged(p: vec3f, octaves: i32) -> f32 {
  var q: vec3f = p;
  var sum: f32 = 0.0;
  var amp: f32 = 0.55;
  var prev: f32 = 1.0;
  for (var i: i32 = 0; i < octaves; i = i + 1) {
    // Rounded crests: a sharp |n| crease turns into needles on a coarse grid.
    let g: f32 = gnoise(q);
    var n: f32 = max(1.0 - sqrt(g * g * 2.56 + 0.004), 0.0);
    n = n * n;
    sum = sum + n * amp * (0.35 + 0.65 * prev);
    prev = n;
    q = q * 2.07 + vec3f(5.1, 1.3, 8.7);
    amp = amp * 0.48;
  }
  return sum;
}

// Nearest feature point: x = distance, y = hash of its cell (0..1).
fn cellular(p: vec3f) -> vec2f {
  let fl: vec3f = floor(p);
  let c: vec3i = vec3i(fl);
  var best: f32 = 9.0;
  var id: f32 = 0.0;
  for (var z: i32 = -1; z <= 1; z = z + 1) {
    for (var y: i32 = -1; y <= 1; y = y + 1) {
      for (var x: i32 = -1; x <= 1; x = x + 1) {
        let cell: vec3i = c + vec3i(x, y, z);
        let r: vec3f = rand3(cell);
        let feature: vec3f = vec3f(cell) + vec3f(0.15) + r * 0.7;
        let dist: f32 = length(p - feature);
        if (dist < best) {
          best = dist;
          id = r.x;
        }
      }
    }
  }
  return vec2f(best, id);
}
