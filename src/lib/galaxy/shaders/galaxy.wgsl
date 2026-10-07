// The galaxy: a baked 3D emission/extinction field (stored as a 2D atlas of
// horizontal slices so WebGL2 can sample it), integrated per pixel together
// with an analytic stellar bulge. Requires: common.wgsl, `galaxy` uniforms.

// The atlas stores `volume.y` horizontal slices of `volume.x` × `volume.z`
// texels, `volume.w` slices per atlas row.
fn atlasUv(xz: vec2f, slice: f32) -> vec2f {
  let tile: vec2f = galaxy.volume.xz;
  let cols: f32 = galaxy.volume.w;
  let row: f32 = floor(slice / cols);
  let col: f32 = slice - row * cols;
  let inTile: vec2f = clamp(xz * tile, vec2f(0.5), tile - vec2f(0.5));
  return (vec2f(col, row) * tile + inTile) / galaxy.atlas.xy;
}

fn sampleVolume(p: vec3f) -> vec4f {
  let uvw: vec3f = p / (GALAXY_BOUNDS * 2.0) + vec3f(0.5);
  let s: f32 = clamp(uvw.y * galaxy.volume.y - 0.5, 0.0, galaxy.volume.y - 1.0);
  let s0: f32 = floor(s);
  let s1: f32 = min(s0 + 1.0, galaxy.volume.y - 1.0);
  let a: vec4f = textureSampleLevel(volumeTex, linearSampler, atlasUv(uvw.xz, s0), 0.0);
  let b: vec4f = textureSampleLevel(volumeTex, linearSampler, atlasUv(uvw.xz, s1), 0.0);
  return mix(a, b, s - s0);
}

fn erfApprox(x: f32) -> f32 {
  let t: f32 = 1.0 / (1.0 + 0.3275911 * abs(x));
  let k: f32 = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return sign(x) * (1.0 - k * exp(-x * x));
}

fn gaussianIntegral(ro: vec3f, rd: vec3f, sigma: vec3f, limit: f32) -> f32 {
  let o: vec3f = ro / sigma;
  let d: vec3f = rd / sigma;
  let a: f32 = dot(d, d);
  let b: f32 = dot(o, d);
  let near: f32 = -b / a;
  let height: f32 = exp(-max(0.0, dot(o, o) - b * b / a));
  return height * 0.886226925 / sqrt(a) * (erfApprox(sqrt(a) * (limit - near)) - erfApprox(-sqrt(a) * near));
}

fn coreIntegral(ro: vec3f, rd: vec3f, limit: f32) -> vec3f {
  let th: f32 = galaxy.detail.z;
  return vec3f(2.3, 1.5, 0.76) * gaussianIntegral(ro, rd, vec3f(0.44, 0.36 * th, 0.44), limit) * 4.4
    + vec3f(1.6, 0.94, 0.43) * gaussianIntegral(ro, rd, vec3f(1.20, 0.85 * th, 1.20), limit) * 0.95
    + vec3f(1.1, 0.73, 0.42) * gaussianIntegral(ro, rd, vec3f(2.7, 1.25 * th, 2.7), limit) * 0.070;
}

fn coreDensity(p: vec3f) -> vec3f {
  let th: f32 = galaxy.detail.z;
  let a: vec3f = p / vec3f(0.44, 0.36 * th, 0.44);
  let b: vec3f = p / vec3f(1.20, 0.85 * th, 1.20);
  let c: vec3f = p / vec3f(2.7, 1.25 * th, 2.7);
  return vec3f(2.3, 1.5, 0.76) * exp(-dot(a, a)) * 4.4 + vec3f(1.6, 0.94, 0.43) * exp(-dot(b, b)) * 0.95
    + vec3f(1.1, 0.73, 0.42) * exp(-dot(c, c)) * 0.070;
}

// Faint intergalactic clouds far behind the disk, fixed to the sky.
fn deepSky(rd: vec3f) -> vec3f {
  let a: f32 = exp(-(1.0 - dot(rd, normalize(vec3f(0.62, 0.38, 0.69)))) * 40.0);
  let b: f32 = exp(-(1.0 - dot(rd, normalize(vec3f(-0.71, -0.33, 0.62)))) * 37.0);
  let n: f32 = fbm3(rd * 8.0 + vec3f(2.6, 7.1, 1.2));
  let detail: f32 = fbm3(rd * 35.0 + vec3f(n * 2.0));
  let ridges: f32 = pow(max(0.0, 1.0 - abs(n * 2.0 - 0.94)), 8.0);
  let cloud: f32 = smoothstep(0.42, 0.66, n) * (0.1 + detail * detail * 1.7);
  let rim: f32 = ridges * smoothstep(0.42, 0.70, detail);
  let tint: vec3f = mix(vec3f(0.20, 0.046, 0.38), vec3f(0.025, 0.29, 0.43), smoothstep(0.37, 0.65, detail));
  return vec3f(0.00012, 0.00020, 0.00040) + tint * (cloud * 0.17 + rim * 0.10) * (a + b) * galaxy.look.z;
}

// Integrate gas, dust and bulge light along a ray in galaxy space.
fn renderGalaxy(eye: vec3f, rdWorld: vec3f, pixel: vec2f) -> vec3f {
  let background: vec3f = deepSky(rdWorld);
  let ro: vec3f = rotateY(eye, -galaxy.detail.y);
  let rd: vec3f = rotateY(rdWorld, -galaxy.detail.y);
  let bounds: vec3f = vec3f(GALAXY_BOUNDS.x, GALAXY_BOUNDS.y * galaxy.detail.z, GALAXY_BOUNDS.z);
  let inv: vec3f = vec3f(1.0) / (rd + vec3f(0.000001));
  let a: vec3f = (-bounds - ro) * inv;
  let b: vec3f = (bounds - ro) * inv;
  let nearV: vec3f = min(a, b);
  let farV: vec3f = max(a, b);
  let start: f32 = max(0.0, max(nearV.x, max(nearV.y, nearV.z)));
  let end: f32 = min(farV.x, min(farV.y, farV.z));
  if (end <= start) {
    return background + coreIntegral(ro, rd, 1000.0);
  }
  let steps: f32 = galaxy.detail.x;
  let dt: f32 = (end - start) / steps;
  let jitter: f32 = hash21(pixel + vec2f(fract(galaxy.viewport.z * 7.13) * 31.0, 0.73));
  var t: f32 = start + dt * jitter;
  var transmission: vec3f = vec3f(1.0);
  var color: vec3f = coreIntegral(ro, rd, start);
  let coreAfter: vec3f = max(coreIntegral(ro, rd, 1000.0) - coreIntegral(ro, rd, end), vec3f(0.0));
  let squash: vec3f = vec3f(1.0, 1.0 / galaxy.detail.z, 1.0);
  for (var i: i32 = 0; i < 160; i = i + 1) {
    if (f32(i) >= steps) {
      break;
    }
    let p: vec3f = ro + rd * t;
    let gas: vec4f = sampleVolume(p * squash);
    let extinction: vec3f = vec3f(0.70, 1.04, 1.42) * gas.a * galaxy.look.w + vec3f(0.0001);
    let attenuation: vec3f = exp(-extinction * dt);
    let emission: vec3f = gas.rgb * galaxy.look.z * 2.8 + coreDensity(p);
    // Analytic per-step integration keeps brightness stable across step counts.
    color = color + transmission * emission * (vec3f(1.0) - attenuation) / extinction;
    transmission = transmission * attenuation;
    t = t + dt;
  }
  // Inside a star system the eye adapts to the sun: the galaxy dims to a band.
  return (color + (background + coreAfter) * transmission) * galaxy.adapt.x;
}
