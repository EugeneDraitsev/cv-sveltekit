import type { PipelineDesc, VertexBufferLayout } from '../gpu/backend';
import { CascadeBlock, PlanetBlock } from './blocks';
import COMMON from '../shaders/common.wgsl?raw';
import NOISE from '../shaders/noise.wgsl?raw';
import PLANET from '../shaders/planet.wgsl?raw';
import ATMOSPHERE from '../shaders/atmosphere.wgsl?raw';
import SURFACE from '../shaders/surface.wgsl?raw';
import TERRAIN from '../shaders/terrain.wgsl?raw';

const LIB = `${COMMON}\n${NOISE}\n${PLANET}\n${ATMOSPHERE}\n${SURFACE}\n${TERRAIN}`;
const planetUniform = [{ name: 'pl', block: PlanetBlock }];

export const BUILD_JOB_LAYOUT: VertexBufferLayout = {
  stride: 32,
  step: 'instance',
  attributes: [
    { name: 'job0', format: 'float32x4', offset: 0 },
    { name: 'job1', format: 'float32x4', offset: 16 },
  ],
};

/**
 * Writes one patch per instance into its atlas slot: height, temperature,
 * moisture — with a one-texel border so normals need no neighbour patches.
 */
export const patchBuildProgram = (): PipelineDesc => ({
  label: 'patch build',
  code: `${LIB}
fn vs(vsIn: VertexIn) -> Varyings {
  var o: Varyings;
  var corners: array<vec2f, 6> = array<vec2f, 6>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0), vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0));
  let slotSize: f32 = pl.info.z;
  let atlas: vec2f = pl.state.zw;
  let origin: vec2f = vsIn.job0.xy * slotSize;
  let texel: vec2f = origin + corners[vsIn.vertexIndex] * slotSize;
  o.position = vec4f(uvToNdc(texel / atlas), 0.0, 1.0);
  o.job0 = vsIn.job0;
  o.job1 = vsIn.job1;
  return o;
}
fn fs(fsIn: Varyings) -> FragOut {
  var o: FragOut;
  let slotSize: f32 = pl.info.z;
  let res: f32 = pl.info.y;
  let origin: vec2f = fsIn.job0.xy * slotSize;
  let local: vec2f = floor(fsIn.position.xy) - origin;
  let grid: vec2f = (local - vec2f(1.0)) / (res - 1.0);
  let level: f32 = fsIn.job0.w;
  let size: f32 = 2.0 / exp2(level);
  let u: f32 = -1.0 + (fsIn.job1.x + grid.x) * size;
  let v: f32 = -1.0 + (fsIn.job1.y + grid.y) * size;
  let n: vec3f = cubeDir(i32(fsIn.job0.z), u, v);
  let row: i32 = i32(fsIn.job1.z);
  let planet: Planet = loadPlanet(row);
  let h: f32 = terrainHeight(row, planet, n, i32(fsIn.job1.w));
  let climate: vec2f = planetClimate(n, planet);
  o.color0 = vec4f(h, climate.x, climate.y, 1.0);
  return o;
}`,
  uniforms: planetUniform,
  textures: [{ name: 'planetTex', kind: 'unfilterable' }],
  vertexBuffers: [BUILD_JOB_LAYOUT],
  varyings: [
    { name: 'job0', type: 'vec4f', flat: true },
    { name: 'job1', type: 'vec4f', flat: true },
  ],
  outputs: [{ format: 'rgba32float' }],
});

export const GRID_LAYOUT: VertexBufferLayout = {
  stride: 12,
  step: 'vertex',
  attributes: [{ name: 'grid', format: 'float32x3', offset: 0 }],
};

export const PATCH_LAYOUT: VertexBufferLayout = {
  stride: 80,
  step: 'instance',
  attributes: [
    { name: 'inst0', format: 'float32x4', offset: 0 },
    { name: 'inst1', format: 'float32x4', offset: 16 },
    { name: 'inst2', format: 'float32x4', offset: 32 },
    { name: 'inst3', format: 'float32x4', offset: 48 },
    { name: 'inst4', format: 'float32x4', offset: 64 },
  ],
};

/** Vertex work shared by the camera pass and the shadow passes. */
const TERRAIN_CORE = /* wgsl */ `
struct TerrainPoint {
  rel: vec3f,
  dir: vec3f,
  normal: vec3f,
  data: vec4f,
}
fn patchPoint(face: i32, uc: f32, vc: f32, du: f32, dv: f32, f: vec3f, L: f32, h: f32) -> vec3f {
  let d: vec3f = dirDelta(face, uc, vc, du, dv, f, L);
  return f * h + d * (1.0 + h);
}
fn terrainPoint(vsIn: VertexIn) -> TerrainPoint {
  var t: TerrainPoint;
  let res: f32 = pl.info.y;
  let slotSize: f32 = pl.info.z;
  let face: i32 = i32(vsIn.inst0.z);
  let i: i32 = i32(vsIn.grid.x);
  let j: i32 = i32(vsIn.grid.y);
  let base: vec2i = vec2i(vsIn.inst0.xy * slotSize) + vec2i(i + 1, j + 1);
  let data: vec4f = atlasTexel(base);
  let hl: f32 = atlasTexel(base - vec2i(1, 0)).x;
  let hr: f32 = atlasTexel(base + vec2i(1, 0)).x;
  let hd: f32 = atlasTexel(base - vec2i(0, 1)).x;
  let hu: f32 = atlasTexel(base + vec2i(0, 1)).x;
  let f: vec3f = vsIn.inst2.xyz;
  let L: f32 = vsIn.inst2.w;
  let hs: f32 = vsIn.inst3.w;
  let uc: f32 = vsIn.inst4.x;
  let vc: f32 = vsIn.inst4.y;
  let stepUv: f32 = 2.0 * hs / (res - 1.0);
  let du: f32 = -hs + f32(i) * stepUv;
  let dv: f32 = -hs + f32(j) * stepUv;
  let h: f32 = data.x;
  let water: bool = pl.clip.w > 0.5;
  var hv: f32 = h;
  if (water) {
    hv = max(h, 0.0);
  }
  let pl0: vec3f = patchPoint(face, uc, vc, du - stepUv, dv, f, L, select(hl, max(hl, 0.0), water));
  let pr0: vec3f = patchPoint(face, uc, vc, du + stepUv, dv, f, L, select(hr, max(hr, 0.0), water));
  let pd0: vec3f = patchPoint(face, uc, vc, du, dv - stepUv, f, L, select(hd, max(hd, 0.0), water));
  let pu0: vec3f = patchPoint(face, uc, vc, du, dv + stepUv, f, L, select(hu, max(hu, 0.0), water));
  t.dir = normalize(f + dirDelta(face, uc, vc, du, dv, f, L));
  var normal: vec3f = normalize(cross(pr0 - pl0, pu0 - pd0));
  if (dot(normal, t.dir) < 0.0) {
    normal = -normal;
  }
  // Curvature-based occlusion: valleys and creases darken a little.
  let spacing: f32 = length(pr0 - pl0) * 0.5;
  let crease: f32 = ((hl + hr + hd + hu) * 0.25 - h) / max(spacing, 0.0000001);
  let ao: f32 = clamp(1.0 - crease * 0.6, 0.6, 1.0);
  if (vsIn.grid.z > 0.5) {
    hv = hv - pl.clip.z * hs;
  }
  t.rel = patchPoint(face, uc, vc, du, dv, f, L, hv) + vsIn.inst3.xyz;
  t.normal = normal;
  t.data = vec4f(h, data.y, data.z, ao);
  return t;
}`;

export const terrainProgram = (): PipelineDesc => ({
  label: 'terrain',
  code: `diagnostic(off, derivative_uniformity);\n${LIB}\n${TERRAIN_CORE}
fn vs(vsIn: VertexIn) -> Varyings {
  var o: Varyings;
  let t: TerrainPoint = terrainPoint(vsIn);
  o.position = viewClip(t.rel);
  o.n = t.dir;
  o.rel = t.rel;
  o.normal = t.normal;
  o.data = t.data;
  return o;
}
// Bump mapping without tangents (Mikkelsen): perturb N by a scalar height.
fn bump(normal: vec3f, p: vec3f, height: f32) -> vec3f {
  let px: vec3f = dpdx(p);
  let py: vec3f = dpdy(p);
  let r1: vec3f = cross(py, normal);
  let r2: vec3f = cross(normal, px);
  let det: f32 = dot(px, r1);
  let grad: vec3f = sign(det) * (dpdx(height) * r1 + dpdy(height) * r2);
  let bumped: vec3f = abs(det) * normal - grad;
  return select(normal, normalize(bumped), dot(bumped, bumped) > 0.0);
}
fn fs(fsIn: Varyings) -> FragOut {
  var o: FragOut;
  let row: i32 = i32(pl.info.x);
  let planet: Planet = loadPlanet(row);
  let n: vec3f = normalize(fsIn.n);
  let h: f32 = fsIn.data.x;
  let climate: vec2f = fsIn.data.yz;
  let dist: f32 = length(fsIn.rel);
  let viewDir: vec3f = fsIn.rel / max(dist, 0.0000001);
  let air: Air = loadAir(row);
  let meters: f32 = planetTexel(row, 2).y * 100000.0;
  let distM: f32 = dist * meters;
  let surfaceP: vec3f = n * (1.0 + max(h, 0.0));
  let sun: vec3f = pl.sun0.xyz;
  var sunLight: vec3f = pl.sun0Color.rgb * sunTransmittance(surfaceP, sun, air) * smoothstep(-0.03, 0.03, dot(n, sun));
  var sunLight1: vec3f = vec3f(0.0);
  if (pl.sun1.w > 0.0) {
    sunLight1 = pl.sun1Color.rgb * sunTransmittance(surfaceP, pl.sun1.xyz, air) * smoothstep(-0.03, 0.03, dot(n, pl.sun1.xyz));
  }
  // Clouds shade the ground where the sun ray crosses the cloud deck.
  if (pl.cloud.z > 0.01 && planet.giant < 0.5) {
    let up: f32 = max(dot(n, sun), 0.12);
    let crossing: vec3f = normalize(surfaceP + sun * (pl.cloud.y / up));
    let cover: f32 = cloudDensity(rotateY(crossing, pl.cloud.x), planet.offset, pl.cloud.z, 4);
    sunLight = sunLight * (1.0 - cover * 0.7);
  }
  let night: vec3f = nightAmbient(n);
  // Sky light plus light bounced off the surrounding sunlit ground, which
  // keeps shadows readable on airless worlds.
  let bounce: vec3f = (sunLight * max(dot(n, sun), 0.0) + sunLight1 * max(dot(n, pl.sun1.xyz), 0.0)) * 0.05;
  let ambient: vec3f = skyAmbient(n, sun, pl.sun0Color.rgb, air) + night + bounce;
  var color: vec3f = vec3f(0.0);
  if (h < 0.0 && planet.water > 0.5) {
    let shade: f32 = sunShadow(fsIn.rel, max(dot(n, sun), 0.0));
    color = shadeLiquid(row, planet, n, h, viewDir, dist, sun, (sunLight + sunLight1) * (0.35 + 0.65 * shade), ambient);
  } else {
    // Three scales of variation: fields (≈200 m), patches (≈20 m), grain (≈1.5 m).
    // Each scale fades out before its wavelength drops under two pixels, so
    // the ground does not shimmer into moiré rings from altitude.
    let pm: vec3f = n * meters;
    let footprintM: f32 = distM * 2.0 * pl.eye.w / pl.viewport.y;
    let broadOctaves: i32 = select(3, 2, footprintM > 12.0);
    let broad: f32 = fbm(n * 900.0 + planet.offset, broadOctaves) * (1.0 - smoothstep(40.0, 120.0, footprintM));
    let meso: f32 = gnoise(pm * 0.05) * (1.0 - smoothstep(4.0, 12.0, footprintM));
    let near: f32 = exp(-distM * 0.012);
    let micro: f32 = gnoise(pm * 0.65) * near;
    let detail: f32 = broad + meso * 0.35 + micro * 0.2;
    let slope: f32 = clamp(1.0 - dot(fsIn.normal, n), 0.0, 1.0) * 4.0;
    let m: Material = surfaceMaterial(row, planet, n, h, slope, climate, detail);
    var albedo: vec3f = m.albedo;
    // Exposed rock shows sedimentary strata: warped horizontal layers a few
    // metres thick, each with its own tone, separated by darker seams.
    let strataH: f32 = h * meters + gnoise(pm * 0.004) * 14.0 + broad * 9.0;
    let rocky: f32 = smoothstep(0.32, 0.62, slope + detail * 0.08) * (1.0 - m.snow);
    // Thick formations (≈45 m) stay readable from kilometres away; their
    // colours blend over a few metres instead of meeting at a ruled line.
    let coarse: f32 = strataH / 45.0;
    let coarseAa: f32 = 1.0 - smoothstep(0.08, 0.3, fwidth(coarse));
    let coarseIndex: f32 = floor(coarse);
    let coarseTone: f32 = mix(hash21(vec2f(coarseIndex - 1.0, planet.offset.x)), hash21(vec2f(coarseIndex, planet.offset.x)), smoothstep(0.0, 0.14, fract(coarse)));
    var stratum: vec3f = mix(vec3f(0.8, 0.82, 0.86), vec3f(1.14, 1.0, 0.84), coarseTone);
    stratum = mix(vec3f(1.0), stratum, coarseAa);
    // Thin beds of uneven thickness (≈3–9 m) appear up close, each weathered
    // a little lighter toward its top.
    let bedBase: f32 = strataH / 5.5;
    let layer: f32 = bedBase + 0.4 * sin(bedBase * 2.39);
    let band: f32 = fract(layer);
    let fineAa: f32 = 1.0 - smoothstep(0.08, 0.3, fwidth(layer));
    let fineTone: f32 = hash21(vec2f(floor(layer), planet.offset.y));
    stratum = stratum * mix(1.0, (0.88 + fineTone * 0.22) * (0.88 + 0.14 * smoothstep(0.0, 0.9, band)), fineAa);
    albedo = albedo * mix(vec3f(1.0), stratum, rocky * 0.85);
    // Forests read as canopy from afar, where the instanced trees end.
    let top: vec3f = topBiomes(row, planet, climate);
    let forest: f32 = mix(canopyDensity(row, i32(top.y)), canopyDensity(row, i32(top.x)), top.z);
    let canopy: f32 = smoothstep(180.0, 420.0, distM) * forest * (1.0 - m.snow) * (1.0 - smoothstep(0.25, 0.6, slope / 4.0));
    albedo = mix(albedo, m.foliage * (0.45 + broad * 0.2), canopy * 0.85);
    // Grass reads brighter and greener close up, where the blades stand.
    albedo = mix(albedo, m.foliage * 0.8, m.grass * 0.35 * near);
    var normal: vec3f = normalize(fsIn.normal);
    // Cliffs span tall, thin triangles whose interpolated normals streak into
    // vertical ribs; shade them as facets instead, like the low-poly flora.
    // Near the horizon a triangle can be edge-on: no facet normal there (and
    // never a NaN, which bloom would smear into bright specks).
    let cr: vec3f = cross(dpdx(fsIn.rel), dpdy(fsIn.rel));
    let crLen: f32 = dot(cr, cr);
    let facet0: vec3f = select(normal, cr * inverseSqrt(max(crLen, 1e-36)), crLen > 1e-36);
    let facet: vec3f = select(-facet0, facet0, dot(facet0, viewDir) < 0.0);
    let faceted: f32 = smoothstep(0.3, 0.6, 1.0 - dot(normal, n)) * (1.0 - smoothstep(600.0, 1200.0, distM));
    if (faceted > 0.0) {
      normal = normalize(mix(normal, facet, faceted));
    }
    let relief: f32 = (meso * 0.35 + micro * 0.12 * (1.0 - m.snow * 0.7)) / meters;
    normal = bump(normal, fsIn.rel, relief);
    let ndl: f32 = max(dot(normal, sun), 0.0);
    let ndl1: f32 = max(dot(normal, pl.sun1.xyz), 0.0);
    let shade: f32 = sunShadow(fsIn.rel, ndl);
    let ao: f32 = fsIn.data.w * (1.0 - canopy * 0.3);
    let diffuse: vec3f = (sunLight * ndl + sunLight1 * ndl1) * shade + ambient * ao * (0.65 + 0.35 * dot(normal, n));
    color = albedo * diffuse;
    if (m.roughness < 0.5) {
      let hv: vec3f = normalize(sun - viewDir);
      color = color + sunLight * shade * pow(max(dot(normal, hv), 0.0), 80.0) * (1.0 - m.roughness) * 0.6;
    }
    let darkness: f32 = 1.0 - smoothstep(0.0, 0.15, luminance(sunLight) * max(dot(n, sun), 0.0) + luminance(ambient) * 2.0);
    color = color + m.emission * (0.15 + darkness * 0.85);
  }
  o.color0 = vec4f(color, 1.0);
  o.color1 = vec4f(dist, 0.0, 0.0, 1.0);
  return o;
}`,
  uniforms: planetUniform,
  textures: [
    { name: 'atlasTex', kind: 'unfilterable' },
    { name: 'planetTex', kind: 'unfilterable' },
    { name: 'shadow0', kind: 'depth' },
    { name: 'shadow1', kind: 'depth' },
  ],
  vertexBuffers: [GRID_LAYOUT, PATCH_LAYOUT],
  varyings: [
    { name: 'n', type: 'vec3f' },
    { name: 'rel', type: 'vec3f' },
    { name: 'normal', type: 'vec3f' },
    { name: 'data', type: 'vec4f' },
  ],
  outputs: [{ format: 'rgba16float' }, { format: 'rgba32float' }],
  depth: { write: true, compare: 'less' },
});

/** Terrain depth from the sun, for one shadow cascade. */
export const terrainShadowProgram = (): PipelineDesc => ({
  label: 'terrain shadow',
  code: `${LIB}\n${TERRAIN_CORE}
fn vs(vsIn: VertexIn) -> Varyings {
  var o: Varyings;
  let t: TerrainPoint = terrainPoint(vsIn);
  o.position = shadowClip(t.rel, i32(cascade.cascade.x));
  return o;
}`,
  uniforms: [...planetUniform, { name: 'cascade', block: CascadeBlock }],
  textures: [
    { name: 'atlasTex', kind: 'unfilterable' },
    { name: 'planetTex', kind: 'unfilterable' },
  ],
  vertexBuffers: [GRID_LAYOUT, PATCH_LAYOUT],
  varyings: [],
  outputs: [],
  depth: { write: true, compare: 'less' },
});

/**
 * Aerial perspective, sky and clouds for the planet the camera is on:
 * attenuates whatever the scene drew and adds the scattered light.
 */
export const atmosphereProgram = (): PipelineDesc => ({
  label: 'atmosphere',
  code: `${LIB}
fn vs(vsIn: VertexIn) -> Varyings {
  var o: Varyings;
  let p: vec2f = fullscreenPosition(vsIn.vertexIndex);
  o.position = vec4f(p, 0.0, 1.0);
  o.ndc = p;
  return o;
}
fn cloudSample(row: i32, planet: Planet, p: vec3f, rd: vec3f, sun: vec3f, sunColor: vec3f, air: Air, ambient: vec3f) -> vec4f {
  let n: vec3f = normalize(p);
  let cover: f32 = pl.cloud.z;
  let density: f32 = cloudDensity(rotateY(n, pl.cloud.x), planet.offset, cover, 6);
  if (density <= 0.001) {
    return vec4f(0.0);
  }
  let light: vec3f = sunColor * sunTransmittance(p, sun, air) * smoothstep(-0.08, 0.05, dot(n, sun));
  let mu: f32 = dot(rd, sun);
  let silver: f32 = pow(max(mu, 0.0), 12.0) * (1.0 - density) * 1.4;
  let thickness: f32 = 0.55 + 0.45 * (1.0 - density);
  let tint: vec3f = planetTexel(row, 7).rgb;
  let lit: vec3f = tint * (light * (thickness * 0.85 + silver) + ambient * 1.5);
  return vec4f(lit * density, min(density * 1.15, 1.0));
}
fn fs(fsIn: Varyings) -> FragOut {
  var o: FragOut;
  let coord: vec2i = vec2i(floor(fsIn.position.xy));
  let scene: vec3f = textureLoad(sceneTex, coord, 0).rgb;
  let stored: vec4f = textureLoad(distTex, coord, 0);
  let tMax: f32 = select(1000000.0, stored.x, stored.w > 0.5);
  let rd: vec3f = cameraRay(fsIn.ndc, pl.forward.xyz, pl.right.xyz, pl.up.xyz, pl.eye.w, pl.viewport.w);
  let ro: vec3f = pl.eye.xyz;
  let row: i32 = i32(pl.info.x);
  let planet: Planet = loadPlanet(row);
  let air: Air = loadAir(row);
  let sun: vec3f = pl.sun0.xyz;
  let sunColor: vec3f = pl.sun0Color.rgb;
  var sunColor1: vec3f = vec3f(0.0);
  if (pl.sun1.w > 0.0) {
    sunColor1 = pl.sun1Color.rgb;
  }
  let steps: i32 = select(12, 16, pl.state.x < 0.05);
  var color: vec3f = scene;
  // Cloud deck: find where this ray crosses it before hitting the ground.
  var cloud: vec4f = vec4f(0.0);
  var tc: f32 = -1.0;
  if (pl.cloud.z > 0.01 && planet.giant < 0.5) {
    let shell: vec2f = sphereHit(ro, rd, 1.0 + pl.cloud.y);
    if (shell.y > 0.0) {
      tc = select(shell.x, shell.y, shell.x < 0.0);
      if (tc > 0.0 && tc < tMax) {
        let ambient: vec3f = skyAmbient(normalize(ro + rd * tc), sun, sunColor, air);
        cloud = cloudSample(row, planet, ro + rd * tc, rd, sun, sunColor, air, ambient);
      } else {
        tc = -1.0;
      }
    }
  }
  if (cloud.a > 0.001) {
    let near: Scatter = scatterAlong(ro, rd, tc, air, sun, sunColor, pl.sun1.xyz, sunColor1, steps / 2);
    let far: Scatter = scatterAlong(ro + rd * tc, rd, tMax - tc, air, sun, sunColor, pl.sun1.xyz, sunColor1, steps / 2);
    let behind: vec3f = scene * far.transmittance + far.light;
    color = near.light + near.transmittance * (cloud.rgb + behind * (1.0 - cloud.a));
  } else {
    let sc: Scatter = scatterAlong(ro, rd, tMax, air, sun, sunColor, pl.sun1.xyz, sunColor1, steps);
    color = scene * sc.transmittance + sc.light;
  }
  o.color0 = vec4f(color, 1.0);
  return o;
}`,
  uniforms: planetUniform,
  textures: [
    { name: 'sceneTex', kind: 'unfilterable' },
    { name: 'distTex', kind: 'unfilterable' },
    { name: 'planetTex', kind: 'unfilterable' },
  ],
  varyings: [{ name: 'ndc', type: 'vec2f' }],
  outputs: [{ format: 'rgba16float' }],
});
