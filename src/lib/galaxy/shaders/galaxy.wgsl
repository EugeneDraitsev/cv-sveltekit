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

// ─── The sky behind the galaxy ─────────────────────────────────────────────

// The deep sky turns slowly about a tilted axis (its angle is adapt.z), so the
// background drifts behind the spinning disk instead of standing still.
const SKY_AXIS: vec3f = vec3f(0.188, 0.972, 0.141);

fn skyFromWorld(rd: vec3f) -> vec3f {
  return rotateAxis(rd, SKY_AXIS, -galaxy.adapt.z);
}

fn worldFromSky(p: vec3f) -> vec3f {
  return rotateAxis(p, SKY_AXIS, galaxy.adapt.z);
}

// Cube-face coordinates of a direction: xy in -1..1, z = face id (0..5).
fn skyFace(rd: vec3f) -> vec3f {
  let a: vec3f = abs(rd);
  if (a.x >= a.y && a.x >= a.z) {
    return vec3f(rd.z / a.x, rd.y / a.x, select(1.0, 0.0, rd.x > 0.0));
  }
  if (a.y >= a.z) {
    return vec3f(rd.x / a.y, rd.z / a.y, select(3.0, 2.0, rd.y > 0.0));
  }
  return vec3f(rd.x / a.z, rd.y / a.z, select(5.0, 4.0, rd.z > 0.0));
}

// One layer of stars: at most one per cell of an n × n grid on each cube face,
// drawn as a pixel-sized Gaussian whose total light does not depend on the
// render resolution. `density` is the fraction of cells holding a star.
fn starLayer(face: vec3f, n: f32, seed: f32, density: f32, flux: f32, pixel: f32) -> vec3f {
  let g: vec2f = (face.xy * 0.5 + vec2f(0.5)) * n;
  let cell: vec2f = floor(g);
  let h: vec3f = hash33(vec3f(cell, face.z * 131.0 + seed));
  if (h.z > density) {
    return vec3f(0.0);
  }
  let h2: vec3f = hash33(vec3f(cell.yx + vec2f(seed), face.z + 17.0));
  let offset: vec2f = (g - cell) - (vec2f(0.3) + h2.xy * 0.4);
  // Angle per face unit shrinks toward the face edges (d atan x / dx).
  let radians: f32 = length(offset) * (2.0 / n) / (1.0 + dot(face.xy, face.xy));
  let sigma: f32 = pixel * 0.65;
  let b: f32 = flux * (0.12 + pow(h2.z, 7.0));
  // A slow shimmer, each star on its own beat: the field breathes, it does not flash.
  let twinkle: f32 = 1.0 + 0.3 * sin(galaxy.adapt.w * (0.7 + h2.x * 1.6) + h2.y * TAU);
  let color: vec3f = kelvinColor(2800.0 + hash31(vec3f(cell, seed + 3.0)) * 9500.0);
  return color * (b * twinkle * exp(-(radians * radians) / (sigma * sigma)));
}

// Distant galaxies: sparse, tiny and faint; ellipticals and inclined spirals.
fn farGalaxies(face: vec3f, pixel: f32) -> vec3f {
  let n: f32 = 9.0;
  let g: vec2f = (face.xy * 0.5 + vec2f(0.5)) * n;
  let cell: vec2f = floor(g);
  let h: vec3f = hash33(vec3f(cell, face.z * 57.0 + 401.0));
  if (h.z > 0.6) {
    return vec3f(0.0);
  }
  let h2: vec3f = hash33(vec3f(cell.yx, face.z + 913.0));
  let scale: f32 = (2.0 / n) / (1.0 + dot(face.xy, face.xy));
  let d: vec2f = ((g - cell) - (vec2f(0.3) + h.xy * 0.4)) * scale;
  let size: f32 = mix(0.005, 0.022, pow(h2.x, 2.5));
  let angle: f32 = h2.y * TAU;
  let q: f32 = mix(0.22, 1.0, h2.z);
  let ca: f32 = cos(angle);
  let sa: f32 = sin(angle);
  let local: vec2f = vec2f(ca * d.x + sa * d.y, -sa * d.x + ca * d.y);
  // Never sharper than a pixel or two: tiny galaxies read as soft smudges.
  let soft: f32 = max(size, pixel * 1.6);
  let r: f32 = length(vec2f(local.x, local.y / q)) / soft;
  if (r > 4.0) {
    return vec3f(0.0);
  }
  let spiral: bool = hash31(vec3f(cell, face.z + 77.0)) > 0.45;
  let bulge: f32 = exp(-r * r * 9.0);
  var disk: f32 = exp(-r * 2.4);
  var color: vec3f = vec3f(1.0, 0.86, 0.66);
  if (spiral) {
    let phi: f32 = atan2(local.y / q, local.x);
    let arms: f32 = 0.55 + 0.45 * sin(2.0 * phi - 5.5 * log(r + 0.08));
    disk = disk * mix(1.0, arms, smoothstep(0.15, 0.6, r)) * 0.8;
    color = mix(vec3f(0.62, 0.74, 1.0), vec3f(1.0, 0.85, 0.62), bulge);
  }
  let peak: f32 = 0.11 * mix(0.35, 1.0, h.x) * (size / soft) * (size / soft);
  return color * (disk + bulge * 1.4) * peak;
}

// Faint emission clouds (hydrogen red, oxygen teal) threaded with dark dust,
// fixed to the sky far behind the disk. Returns colour and a dust factor.
fn skyClouds(rd: vec3f) -> vec4f {
  let a: f32 = exp(-(1.0 - dot(rd, normalize(vec3f(-0.78, -0.18, -0.6)))) * 5.0);
  let b: f32 = exp(-(1.0 - dot(rd, normalize(vec3f(0.05, -0.62, -0.78)))) * 6.0);
  let c: f32 = exp(-(1.0 - dot(rd, normalize(vec3f(0.62, 0.38, 0.69)))) * 4.0);
  let field: f32 = a + b * 0.8 + c * 0.6;
  // The gas slowly flows through its own shapes.
  let flow: vec3f = vec3f(0.0, 0.0035, 0.0025) * galaxy.adapt.w;
  let warp: vec3f = vec3f(fbm3(rd * 3.0 + vec3f(1.3) + flow), fbm3(rd * 3.0 + vec3f(7.1) - flow), fbm3(rd * 3.0 + vec3f(4.7) + flow.zyx));
  let q: vec3f = rd * 5.5 + warp * 1.6;
  let gas: f32 = smoothstep(0.42, 0.82, fbm3(q));
  let fine: f32 = fbm3(q * 4.0 + vec3f(2.0));
  let knots: f32 = fine * fine * 2.2;
  let oxygen: f32 = smoothstep(0.45, 0.75, fbm3(q * 1.7 + vec3f(9.2)));
  // Dust: soft dark clouds with wispy edges, darkest where the gas is.
  let soot: f32 = smoothstep(0.5, 0.72, fbm3(q * 1.6 + warp * 0.8 + vec3f(5.5)));
  let dust: f32 = 1.0 - soot * 0.6 * smoothstep(0.05, 0.4, field);
  let tint: vec3f = mix(vec3f(0.78, 0.2, 0.36), vec3f(0.18, 0.52, 0.62), oxygen * 0.75);
  let glow: vec3f = tint * gas * (0.25 + knots) * field * 0.13 * galaxy.look.z;
  return vec4f(glow, dust);
}

// Everything behind the disk: clouds, distant galaxies and two layers of stars.
fn deepSky(rd: vec3f) -> vec3f {
  // The angle of one CSS pixel, so stars keep their size at every pixel density.
  let pixel: f32 = 2.0 * galaxy.eye.w * galaxy.screen.x / galaxy.viewport.y;
  let face: vec3f = skyFace(rd);
  let clouds: vec4f = skyClouds(rd);
  var stars: vec3f = starLayer(face, 260.0, 11.0, 0.7, 0.03, pixel);
  stars = stars + starLayer(face, 110.0, 23.0, 0.55, 0.12, pixel);
  stars = stars + starLayer(face, 34.0, 29.0, 0.6, 0.6, pixel);
  let field: f32 = galaxy.adapt.y;
  let base: vec3f = vec3f(0.00012, 0.00020, 0.00040);
  return base + (clouds.rgb + (stars + farGalaxies(face, pixel)) * field) * clouds.w;
}

// ─── A disk that does not turn like a picture ──────────────────────────────

// The disk's material turns a little more or less than the disk as a whole:
// the arms slowly wind and unwind (the core leads, then lags) and one side of
// the disk runs a few degrees ahead of the other, a lead that travels round.
// Bounded on purpose: true differential rotation would wind the arms into
// rings within minutes. It follows the disk's own angle, so it stops with the
// spin. twistShape() is per frame; armTwist() is the extra turn at a point.
fn twistShape() -> vec3f {
  let spin: f32 = galaxy.detail.y;
  let psi: f32 = spin * 4.0 + 1.0;
  return vec3f(0.22 * sin(spin * 7.0), cos(psi), sin(psi));
}

fn armTwist(xz: vec2f, shape: vec3f) -> f32 {
  let r: f32 = length(xz);
  // 0 at mid-disk (r = 6), about -0.66 at the core and +0.34 at the rim.
  let wind: f32 = (log(1.0 + r / 1.4) - 1.665) * 0.483 * shape.x;
  // sin(phi - psi) without atan2.
  let lead: f32 = (xz.y * shape.y - xz.x * shape.z) / max(r, 0.001);
  return wind + 0.06 * smoothstep(1.5, 9.0, r) * lead;
}

// Integrate gas, dust and bulge light along a ray in galaxy space.
fn renderGalaxy(eye: vec3f, rdWorld: vec3f, pixel: vec2f) -> vec3f {
  let background: vec3f = deepSky(skyFromWorld(rdWorld));
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
  let shape: vec3f = twistShape();
  for (var i: i32 = 0; i < 160; i = i + 1) {
    if (f32(i) >= steps) {
      break;
    }
    let p: vec3f = ro + rd * t;
    let gas: vec4f = sampleVolume(rotateY(p, -armTwist(p.xz, shape)) * squash);
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
