// Single-scattering atmosphere (Rayleigh + Mie) around a unit-radius planet.
// Light optical depth uses Schüler's Chapman approximation, so there is no
// lookup table and the same code serves the view from orbit and from the
// ground. Requires common.wgsl.

const SKY_GAIN: f32 = 3.4;

struct Air {
  rayleigh: vec3f,
  density: f32,
  hazeColor: vec3f,
  haze: f32,
  height: f32,
}

struct Scatter {
  light: vec3f,
  transmittance: vec3f,
}

fn rayleighBeta(air: Air) -> vec3f {
  let hr: f32 = air.height * 0.2;
  return air.rayleigh * 0.30 * air.density / hr;
}

fn mieBeta(air: Air) -> f32 {
  let hm: f32 = air.height * 0.07;
  return 0.07 * air.haze * max(air.density, 0.15) / hm;
}

// Ray / sphere intersection: (near, far), far < 0 when missed.
fn sphereHit(ro: vec3f, rd: vec3f, radius: f32) -> vec2f {
  let b: f32 = dot(ro, rd);
  let c: f32 = dot(ro, ro) - radius * radius;
  let h: f32 = b * b - c;
  if (h < 0.0) {
    return vec2f(1.0, -1.0);
  }
  let s: f32 = sqrt(h);
  return vec2f(-b - s, -b + s);
}

// Chapman grazing-incidence function (Schüler, GPU Pro 3).
fn chapman(x: f32, h: f32, cosZenith: f32) -> f32 {
  let c: f32 = sqrt(x + h);
  if (cosZenith >= 0.0) {
    return c / (c * cosZenith + 1.0) * exp(-h);
  }
  let x0: f32 = sqrt(1.0 - cosZenith * cosZenith) * (x + h);
  let c0: f32 = sqrt(x0);
  return 2.0 * c0 * exp(min(x - x0, 60.0)) - c / (1.0 - c * cosZenith) * exp(-h);
}

// Optical depth (Rayleigh, Mie) from point `p` toward `dir`, scale-height units.
fn lightDepth(p: vec3f, dir: vec3f, air: Air) -> vec2f {
  let r: f32 = length(p);
  let cosZ: f32 = dot(p, dir) / r;
  let hr: f32 = air.height * 0.2;
  let hm: f32 = air.height * 0.07;
  let alt: f32 = max(r - 1.0, 0.0);
  let dr: f32 = chapman(1.0 / hr, alt / hr, cosZ) * hr;
  let dm: f32 = chapman(1.0 / hm, alt / hm, cosZ) * hm;
  return vec2f(min(dr, 1e4), min(dm, 1e4));
}

fn sunTransmittance(p: vec3f, sun: vec3f, air: Air) -> vec3f {
  if (air.density <= 0.0) {
    return vec3f(1.0);
  }
  let depth: vec2f = lightDepth(p, sun, air);
  return exp(-(rayleighBeta(air) * depth.x + vec3f(mieBeta(air) * 1.1 * depth.y)));
}

fn phaseRayleigh(mu: f32) -> f32 {
  return 0.0596831 * (1.0 + mu * mu);
}

fn phaseMie(mu: f32) -> f32 {
  let g: f32 = 0.76;
  let g2: f32 = g * g;
  return 0.1193662 * (1.0 - g2) * (1.0 + mu * mu) / ((2.0 + g2) * pow(max(1.0 + g2 - 2.0 * g * mu, 0.0001), 1.5));
}

// Light scattered toward the eye along ro + rd·t for t in [0, tMax]
// (planet-local units, unit radius), lit by up to two suns.
fn scatterAlong(ro: vec3f, rd: vec3f, tMax: f32, air: Air, sun0: vec3f, sunColor0: vec3f, sun1: vec3f, sunColor1: vec3f, steps: i32) -> Scatter {
  var result: Scatter;
  result.light = vec3f(0.0);
  result.transmittance = vec3f(1.0);
  if (air.density <= 0.0) {
    return result;
  }
  let top: f32 = 1.0 + air.height;
  let shell: vec2f = sphereHit(ro, rd, top);
  if (shell.y <= 0.0) {
    return result;
  }
  let t0: f32 = max(shell.x, 0.0);
  let t1: f32 = min(shell.y, tMax);
  if (t1 <= t0) {
    return result;
  }
  let hr: f32 = air.height * 0.2;
  let hm: f32 = air.height * 0.07;
  let br: vec3f = rayleighBeta(air);
  let bm: f32 = mieBeta(air);
  let mu0: f32 = dot(rd, sun0);
  let mu1: f32 = dot(rd, sun1);
  let pr0: f32 = phaseRayleigh(mu0);
  let pm0: f32 = phaseMie(mu0);
  let pr1: f32 = phaseRayleigh(mu1);
  let pm1: f32 = phaseMie(mu1);
  let ds: f32 = (t1 - t0) / f32(steps);
  var odr: f32 = 0.0;
  var odm: f32 = 0.0;
  var sumR: vec3f = vec3f(0.0);
  var sumM: vec3f = vec3f(0.0);
  for (var i: i32 = 0; i < 24; i = i + 1) {
    if (i >= steps) {
      break;
    }
    let t: f32 = t0 + (f32(i) + 0.5) * ds;
    let p: vec3f = ro + rd * t;
    let alt: f32 = max(length(p) - 1.0, 0.0);
    let dR: f32 = exp(-alt / hr) * ds;
    let dM: f32 = exp(-alt / hm) * ds;
    odr = odr + dR * 0.5;
    odm = odm + dM * 0.5;
    let l0: vec2f = lightDepth(p, sun0, air);
    let tau0: vec3f = br * (odr + l0.x) + vec3f(bm * 1.1 * (odm + l0.y));
    let att0: vec3f = exp(-tau0) * sunColor0;
    var att: vec3f = att0 * pr0;
    var attM: vec3f = att0 * pm0;
    if (dot(sunColor1, sunColor1) > 0.0) {
      let l1: vec2f = lightDepth(p, sun1, air);
      let tau1: vec3f = br * (odr + l1.x) + vec3f(bm * 1.1 * (odm + l1.y));
      let att1: vec3f = exp(-tau1) * sunColor1;
      att = att + att1 * pr1;
      attM = attM + att1 * pm1;
    }
    sumR = sumR + att * dR;
    sumM = sumM + attM * dM;
    odr = odr + dR * 0.5;
    odm = odm + dM * 0.5;
  }
  // ×π matches the surfaces (albedo · irradiance, no 1/π) and stands in for
  // the multiple scattering a single-scattering model leaves out.
  result.light = (sumR * br + sumM * bm * air.hazeColor) * SKY_GAIN;
  result.transmittance = exp(-(br * odr + vec3f(bm * 1.1 * odm)));
  return result;
}

// Cheap sky irradiance for lighting the ground: zenith colour scaled by sun height.
fn skyAmbient(up: vec3f, sun: vec3f, sunColor: vec3f, air: Air) -> vec3f {
  let h: f32 = dot(up, sun);
  let day: f32 = smoothstep(-0.18, 0.25, h);
  let tint: vec3f = normalize(air.rayleigh + vec3f(0.05)) * 0.8 + air.hazeColor * air.haze * 0.25;
  return tint * sunColor * day * 0.35 * min(air.density, 1.5);
}
