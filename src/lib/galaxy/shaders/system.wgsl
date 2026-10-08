diagnostic(off, derivative_uniformity);
// Star systems, ray traced per pixel: suns, planets (with the same biome
// materials as the surface), clouds, atmospheres, rings, moons and orbit
// lines. Body positions arrive relative to the eye, so precision holds from
// the galaxy approach down to low orbit. Requires common, noise, planet,
// atmosphere and surface.

struct Hit {
  t: f32,
  kind: i32,
  index: i32,
  coverage: f32,
}

fn planetRow(i: i32) -> i32 {
  return i32(sys.planetInfo[i].x);
}

fn toBody(i: i32, v: vec3f) -> vec3f {
  return vec3f(dot(sys.axisX[i].xyz, v), dot(sys.axisY[i].xyz, v), dot(sys.axisZ[i].xyz, v));
}

fn pixelAngle() -> f32 {
  return 2.0 * sys.eye.w / sys.viewport.y;
}

// Anti-aliased sphere test; returns (t, coverage) or t < 0.
fn traceSphere(center: vec3f, radius: f32, rd: vec3f) -> vec2f {
  let along: f32 = dot(center, rd);
  if (along <= 0.0) {
    return vec2f(-1.0, 0.0);
  }
  let perp: f32 = length(center - rd * along);
  let pixel: f32 = along * pixelAngle();
  if (perp > radius + pixel * 0.7) {
    return vec2f(-1.0, 0.0);
  }
  let coverage: f32 = 1.0 - smoothstep(radius - pixel * 0.7, radius + pixel * 0.7, perp);
  let inside: f32 = max(radius * radius - perp * perp, 0.0);
  return vec2f(along - sqrt(inside), coverage);
}

fn starLight(i: i32) -> vec3f {
  return sys.starColor[i].rgb;
}

// Direct light reaching `p` from every star, with eclipses by planets.
fn eclipse(p: vec3f, toLight: vec3f, lightDist: f32, skip: i32) -> f32 {
  var shadow: f32 = 1.0;
  for (var j: i32 = 0; j < 8; j = j + 1) {
    if (j >= i32(sys.counts.y)) {
      break;
    }
    if (j == skip) {
      continue;
    }
    let c: vec3f = sys.planets[j].xyz - p;
    let along: f32 = dot(c, toLight);
    if (along > 0.0 && along < lightDist) {
      let d: f32 = length(c - toLight * along);
      shadow = shadow * smoothstep(sys.planets[j].w * 0.92, sys.planets[j].w * 1.08, d);
    }
  }
  return shadow;
}

// Optical thickness of a ring at radius r (in planet radii from the ring planet).
fn ringDensity(r: f32, ring: vec4f, seed: f32) -> f32 {
  let inner: f32 = ring.y;
  let outer: f32 = ring.z;
  let x: f32 = (r - inner) / (outer - inner);
  if (x < 0.0 || x > 1.0) {
    return 0.0;
  }
  let bands: f32 = 0.55 + 0.45 * gnoise(vec3f(x * 38.0, seed, 0.0)) + 0.25 * gnoise(vec3f(x * 140.0, seed * 1.7, 2.0));
  let gap: f32 = 1.0 - exp(-pow((x - 0.62) / 0.03, 2.0)) * 0.9;
  let edge: f32 = smoothstep(0.0, 0.04, x) * (1.0 - smoothstep(0.94, 1.0, x));
  return clamp(bands * gap * edge, 0.0, 1.0) * ring.w;
}

// Shadow cast by any ring onto point p (light direction toLight).
fn ringShadow(p: vec3f, toLight: vec3f) -> f32 {
  var shadow: f32 = 1.0;
  for (var k: i32 = 0; k < 8; k = k + 1) {
    if (k >= i32(sys.counts.w)) {
      break;
    }
    let ring: vec4f = sys.rings[k];
    let pi: i32 = i32(ring.x);
    let center: vec3f = sys.planets[pi].xyz;
    let normal: vec3f = sys.ringNormal[k].xyz;
    let denom: f32 = dot(toLight, normal);
    if (abs(denom) > 0.0001) {
      let t: f32 = dot(center - p, normal) / denom;
      if (t > 0.0) {
        let q: vec3f = p + toLight * t - center;
        let r: f32 = length(q) / sys.planets[pi].w;
        shadow = shadow * (1.0 - ringDensity(r, ring, sys.ringNormal[k].w) * 0.75);
      }
    }
  }
  return shadow;
}

fn shadeStar(i: i32, rd: vec3f, t: f32) -> vec3f {
  let center: vec3f = sys.stars[i].xyz;
  let radius: f32 = sys.stars[i].w;
  let p: vec3f = rd * t;
  let n: vec3f = normalize(p - center);
  let mu: f32 = max(dot(n, -rd), 0.0);
  let time: f32 = sys.viewport.z;
  let q: vec3f = rotateY(n, time * 0.01) * 9.0;
  // Granulation cells, sunspots and a limb-darkened photosphere.
  let cells: f32 = cellular(q * 3.0 + vec3f(time * 0.03)).x;
  let gran: f32 = 0.82 + 0.18 * smoothstep(0.1, 0.6, cells);
  let spots: f32 = smoothstep(0.62, 0.72, fbm(q * 0.35 + vec3f(f32(i) * 7.0), 3) + 0.25);
  let limb: f32 = 0.42 + 0.58 * pow(mu, 0.55);
  let warm: vec3f = mix(starLight(i), starLight(i) * vec3f(1.15, 0.72, 0.45), 1.0 - mu);
  return warm * limb * gran * (1.0 - spots * 0.75) * 3.2;
}

// Corona, streamers and glare around each star.
fn starGlow(rd: vec3f, limit: f32) -> vec3f {
  var glow: vec3f = vec3f(0.0);
  for (var i: i32 = 0; i < 2; i = i + 1) {
    if (i >= i32(sys.counts.x)) {
      break;
    }
    let center: vec3f = sys.stars[i].xyz;
    let radius: f32 = sys.stars[i].w;
    let along: f32 = dot(center, rd);
    if (along <= 0.0 || along - radius > limit) {
      continue;
    }
    let offset: vec3f = rd * along - center;
    let d: f32 = length(offset) / radius;
    let pixel: f32 = along * pixelAngle() / radius;
    // Sub-pixel stars become an energy-preserving point, matching the
    // galaxy star splat they replace during the approach.
    let size: f32 = sqrt(1.0 + pixel * pixel * 3.0);
    let point: f32 = exp(-d * d / (size * size) * 1.6) / (size * size);
    let side: vec3f = normalize(offset + vec3f(0.0001));
    let angle: f32 = atan2(dot(side, sys.up.xyz), dot(side, sys.right.xyz));
    let streak: f32 = 0.6 + 0.4 * gnoise(vec3f(angle * 3.0, f32(i) * 5.0, sys.viewport.z * 0.05));
    let outside: f32 = max(d - 1.0, 0.0);
    let corona: f32 = exp(-outside * 4.0) * 0.55 * smoothstep(0.98, 1.02, d) + exp(-outside * 1.1) * 0.12 * streak;
    let halo: f32 = 0.018 / (1.0 + outside * outside * 0.35);
    glow = glow + starLight(i) * (corona + halo) * smoothstep(0.97, 1.0, d) + starLight(i) * point * 6.0 * step(1.5, pixel);
  }
  return glow;
}

fn moonColor(m: i32, n: vec3f) -> vec3f {
  let row: i32 = i32(sys.moonInfo[m].x);
  let seed: vec4f = planetTexel(row, 0);
  let base: vec3f = planetTexel(row, 1).rgb;
  let p: vec3f = n * 6.0 + seed.xyz;
  var shade: f32 = 0.75 + fbm(p, 4) * 0.4;
  let crater: vec2f = cellular(p * 0.9);
  let r: f32 = crater.x / (0.25 + crater.y * 0.25);
  shade = shade - (1.0 - smoothstep(0.6, 1.0, r)) * 0.18 * step(0.3, crater.y) + exp(-pow((r - 1.0) / 0.15, 2.0)) * 0.1;
  let maria: f32 = smoothstep(0.1, 0.3, fbm(p * 0.4 + vec3f(3.0), 3));
  var c: vec3f = base * shade * (1.0 - maria * 0.35);
  if (seed.w > 1.5 && seed.w < 2.5) {
    c = mix(c, vec3f(0.95, 0.75, 0.2), smoothstep(0.2, 0.5, fbm(p * 1.5, 3) + 0.2) * 0.6);
  }
  return c;
}

fn orbitLines(rd: vec3f, limit: f32) -> vec3f {
  var ink: vec3f = vec3f(0.0);
  let denom: f32 = rd.y;
  if (abs(denom) < 0.00001 || sys.options.z < 0.001) {
    return ink;
  }
  // Orbits lie (almost) in the system's y = 0 plane around its origin.
  let t: f32 = sys.origin.y / denom;
  if (t <= 0.0 || t > limit) {
    return ink;
  }
  let q: vec3f = rd * t - sys.origin.xyz;
  let r: f32 = length(q.xz);
  let width: f32 = max(t * pixelAngle() * 0.55 / max(abs(denom), 0.12), 0.0004);
  let angle: f32 = atan2(q.z, q.x);
  for (var i: i32 = 0; i < 8; i = i + 1) {
    if (i >= i32(sys.counts.y)) {
      break;
    }
    let line: f32 = exp(-pow((r - sys.planetInfo[i].y) / width, 2.0));
    // Each orbit glows a little brighter around its planet.
    let at: vec3f = sys.planets[i].xyz - sys.origin.xyz;
    var gap: f32 = abs(angle - atan2(at.z, at.x));
    gap = min(gap, TAU - gap);
    let trail: f32 = 0.45 + 0.9 * exp(-gap * gap * 2.5);
    let selected: f32 = select(0.0, 1.0, f32(i) == sys.options.w);
    ink = ink + mix(vec3f(0.026, 0.03, 0.038) * trail, vec3f(0.07, 0.15, 0.23), selected) * line;
  }
  return ink * sys.options.z;
}

// Colour (premultiplied) and coverage of everything in the system along rd.
fn renderSystem(rd: vec3f, limit: f32) -> vec4f {
  var hit: Hit;
  hit.t = limit;
  hit.kind = -1;
  hit.index = -1;
  hit.coverage = 0.0;
  for (var i: i32 = 0; i < 2; i = i + 1) {
    if (i >= i32(sys.counts.x)) {
      break;
    }
    let s: vec2f = traceSphere(sys.stars[i].xyz, sys.stars[i].w, rd);
    if (s.x > 0.0 && s.x < hit.t) {
      hit.t = s.x;
      hit.kind = 0;
      hit.index = i;
      hit.coverage = s.y;
    }
  }
  for (var i: i32 = 0; i < 8; i = i + 1) {
    if (i >= i32(sys.counts.y)) {
      break;
    }
    if (f32(i) == sys.options.x) {
      continue;
    }
    let s: vec2f = traceSphere(sys.planets[i].xyz, sys.planets[i].w, rd);
    if (s.x > 0.0 && s.x < hit.t) {
      hit.t = s.x;
      hit.kind = 1;
      hit.index = i;
      hit.coverage = s.y;
    }
  }
  for (var i: i32 = 0; i < 16; i = i + 1) {
    if (i >= i32(sys.counts.z)) {
      break;
    }
    let s: vec2f = traceSphere(sys.moons[i].xyz, sys.moons[i].w, rd);
    if (s.x > 0.0 && s.x < hit.t) {
      hit.t = s.x;
      hit.kind = 2;
      hit.index = i;
      hit.coverage = s.y;
    }
  }

  var color: vec3f = vec3f(0.0);
  var alpha: f32 = 0.0;
  if (hit.kind == 0) {
    color = shadeStar(hit.index, rd, hit.t) * hit.coverage;
    alpha = hit.coverage;
  } else if (hit.kind == 1) {
    let i: i32 = hit.index;
    let row: i32 = planetRow(i);
    let planet: Planet = loadPlanet(row);
    let center: vec3f = sys.planets[i].xyz;
    let radius: f32 = sys.planets[i].w;
    let p: vec3f = rd * hit.t;
    let worldN: vec3f = normalize(p - center);
    let n: vec3f = toBody(i, worldN);
    let footprint: f32 = hit.t * pixelAngle() / radius;
    var albedo: vec3f = vec3f(0.5);
    var normal: vec3f = worldN;
    var spec: f32 = 0.0;
    var emission: vec3f = vec3f(0.0);
    let climate: vec2f = planetClimate(n, planet);
    if (planet.giant > 0.5) {
      albedo = gasColor(row, planet, n, sys.viewport.z);
    } else {
      // Only octaves wider than ~12 px. Slope (rock, snow) comes from screen
      // derivatives of this height, and finer octaves flip it pixel by pixel
      // into a checkerboard, worst at the low render scales phones use.
      let octaves: i32 = clamp(i32(log2(0.0238 / max(footprint, 0.000001))) + 1, 2, 8);
      let h: f32 = terrainHeight(row, planet, n, octaves);
      let hx: f32 = dpdxFine(h);
      let hy: f32 = dpdyFine(h);
      let px: vec3f = dpdxFine(p);
      let py: vec3f = dpdyFine(p);
      // Fine colour variation only where a pixel resolves it.
      let detail: f32 = gnoise(n * 900.0) * (1.0 - smoothstep(0.0002, 0.0006, footprint));
      if (h < 0.0 && planet.water > 0.5) {
        let depth: f32 = clamp(-h / max(planet.relief, 0.0001) * 3.0, 0.0, 1.0);
        albedo = mix(planetTexel(row, 3).rgb, planetTexel(row, 4).rgb, sqrt(depth));
        spec = select(0.55, 0.15, planet.water > 2.5 && planet.water < 3.5);
        if (planet.water > 1.5 && planet.water < 2.5) {
          emission = planetTexel(row, 3).rgb * (2.5 - depth * 1.5);
        }
      } else {
        // Derivative bump: relief shading without extra height samples. Where
        // the height jumps by a good share of the relief within one pixel
        // (canyon walls, terraces seen from orbit), the feature is
        // undersampled: fade the bump and the rocky-slope look instead of
        // letting them alias into a pixel maze.
        let perPixel: f32 = (abs(hx) + abs(hy)) / max(planet.relief, 0.00001);
        let resolved: f32 = 1.0 - smoothstep(0.015, 0.06, perPixel);
        let scale: f32 = radius;
        let cx: vec3f = cross(worldN, py);
        let cy: vec3f = cross(px, worldN);
        let det: f32 = dot(px, cx);
        if (abs(det) > 0.0) {
          let grad: vec3f = (cx * hx + cy * hy) * scale / det * sign(det);
          let g: vec3f = grad * 1.6 * resolved;
          normal = normalize(worldN - g / max(1.0, length(g) * 1.4));
        }
        let slope: f32 = clamp(1.0 - dot(normal, worldN), 0.0, 1.0) * 6.0 * resolved;
        let m: Material = surfaceMaterial(row, planet, n, max(h, 0.0), slope, climate, detail * 0.5);
        albedo = m.albedo;
        emission = m.emission;
      }
    }
    // Clouds, drifting in their own slow rotation.
    let cover: f32 = planetTexel(row, 4).w;
    if (cover > 0.01) {
      let cn: vec3f = rotateY(n, sys.planetInfo[i].z);
      let clouds: f32 = cloudDensity(cn, planet.offset, cover, 5) * select(1.0, 0.0, planet.giant > 0.5);
      albedo = mix(albedo, planetTexel(row, 7).rgb, clouds * 0.92);
      spec = spec * (1.0 - clouds);
    }
    var light: vec3f = vec3f(0.0);
    for (var s: i32 = 0; s < 2; s = s + 1) {
      if (s >= i32(sys.counts.x)) {
        break;
      }
      let toStar: vec3f = sys.stars[s].xyz - p;
      let dist: f32 = length(toStar);
      let l: vec3f = toStar / dist;
      let ndl: f32 = max(dot(normal, l), 0.0) * smoothstep(-0.05, 0.08, dot(worldN, l));
      let shadow: f32 = eclipse(p, l, dist, i) * ringShadow(p, l);
      light = light + starLight(s) * ndl * shadow;
      let hv: vec3f = normalize(l - rd);
      light = light + starLight(s) * pow(max(dot(worldN, hv), 0.0), 60.0) * spec * 4.0 * shadow * step(0.0, dot(worldN, l));
    }
    let air: Air = loadAir(row);
    let night: f32 = 1.0 - smoothstep(0.0, 0.12, length(light));
    // A faint fill (reflected starlight, the galaxy) keeps night sides from
    // reading as holes in space.
    var surface: vec3f = albedo * light * 1.6 + emission * night + albedo * vec3f(0.028, 0.032, 0.042);
    // Atmosphere in planet-local units.
    if (air.density > 0.0) {
      let ro: vec3f = -center / radius;
      let s0: vec3f = normalize(sys.stars[0].xyz - center);
      var s1: vec3f = s0;
      var c1: vec3f = vec3f(0.0);
      if (sys.counts.x > 1.5) {
        s1 = normalize(sys.stars[1].xyz - center);
        c1 = starLight(1) * 1.0;
      }
      let sc: Scatter = scatterAlong(ro, rd, hit.t / radius, air, s0, starLight(0) * 1.0, s1, c1, 10);
      surface = surface * sc.transmittance + sc.light;
    }
    color = surface * hit.coverage;
    alpha = hit.coverage;
  } else if (hit.kind == 2) {
    let m: i32 = hit.index;
    let center: vec3f = sys.moons[m].xyz;
    let p: vec3f = rd * hit.t;
    let n: vec3f = normalize(p - center);
    let albedo: vec3f = moonColor(m, n);
    var light: vec3f = vec3f(0.0);
    for (var s: i32 = 0; s < 2; s = s + 1) {
      if (s >= i32(sys.counts.x)) {
        break;
      }
      let toStar: vec3f = sys.stars[s].xyz - p;
      let dist: f32 = length(toStar);
      let l: vec3f = toStar / dist;
      light = light + starLight(s) * max(dot(n, l), 0.0) * eclipse(p, l, dist, -1);
    }
    color = (albedo * light * 1.5 + albedo * vec3f(0.028, 0.032, 0.042)) * hit.coverage;
    alpha = hit.coverage;
  }

  // Rings in front of the hit (alpha-blended over it).
  for (var k: i32 = 0; k < 8; k = k + 1) {
    if (k >= i32(sys.counts.w)) {
      break;
    }
    let ring: vec4f = sys.rings[k];
    let pi: i32 = i32(ring.x);
    let center: vec3f = sys.planets[pi].xyz;
    let normal: vec3f = sys.ringNormal[k].xyz;
    let denom: f32 = dot(rd, normal);
    if (abs(denom) < 0.00001) {
      continue;
    }
    let t: f32 = dot(center, normal) / denom;
    if (t <= 0.0 || t >= hit.t) {
      continue;
    }
    let q: vec3f = rd * t - center;
    let r: f32 = length(q) / sys.planets[pi].w;
    let density: f32 = ringDensity(r, ring, sys.ringNormal[k].w);
    if (density <= 0.001) {
      continue;
    }
    let p: vec3f = rd * t;
    let toStar: vec3f = sys.stars[0].xyz - p;
    let l: vec3f = normalize(toStar);
    // Planet shadow on the rings and forward-scattered glow.
    let along: f32 = dot(center - p, l);
    var lit: f32 = 1.0;
    if (along > 0.0) {
      lit = smoothstep(sys.planets[pi].w * 0.95, sys.planets[pi].w * 1.05, length(center - p - l * along));
    }
    let tint: vec3f = planetTexel(planetRow(pi), 12).rgb;
    let base: vec3f = mix(tint, vec3f(0.85, 0.8, 0.72), 0.55) * (0.75 + 0.25 * gnoise(vec3f(r * 90.0, 3.0, 1.0)));
    let face: f32 = 0.25 + 0.75 * abs(dot(l, normal));
    let forward: f32 = pow(max(dot(rd, l), 0.0), 6.0) * 0.6;
    let ringColor: vec3f = base * starLight(0) * (face + forward) * lit * 1.4;
    color = mix(color, ringColor, density);
    alpha = mix(alpha, 1.0, density);
  }

  // Atmospheric halos of planets the ray only grazes.
  for (var i: i32 = 0; i < 8; i = i + 1) {
    if (i >= i32(sys.counts.y)) {
      break;
    }
    if (f32(i) == sys.options.x || (hit.kind == 1 && hit.index == i)) {
      continue;
    }
    let center: vec3f = sys.planets[i].xyz;
    let radius: f32 = sys.planets[i].w;
    let row: i32 = planetRow(i);
    let air: Air = loadAir(row);
    if (air.density <= 0.0) {
      continue;
    }
    let along: f32 = dot(center, rd);
    let perp: f32 = length(center - rd * along) / radius;
    if (along <= 0.0 || perp > 1.0 + air.height || along - radius > hit.t) {
      continue;
    }
    let ro: vec3f = -center / radius;
    let s0: vec3f = normalize(sys.stars[0].xyz - center);
    let sc: Scatter = scatterAlong(ro, rd, hit.t / radius, air, s0, starLight(0) * 1.0, s0, vec3f(0.0), 8);
    color = color * mix(vec3f(1.0), sc.transmittance, alpha) + sc.light;
  }

  color = color + starGlow(rd, hit.t) + orbitLines(rd, hit.t) * (1.0 - alpha);
  return vec4f(color, alpha);
}
