import type { PipelineDesc, VertexBufferLayout } from '../gpu/backend';
import { CascadeBlock, FloraBlock, FloraDrawBlock, PlanetBlock } from './blocks';
import COMMON from '../shaders/common.wgsl?raw';
import NOISE from '../shaders/noise.wgsl?raw';
import PLANET from '../shaders/planet.wgsl?raw';
import ATMOSPHERE from '../shaders/atmosphere.wgsl?raw';
import SURFACE from '../shaders/surface.wgsl?raw';
import TERRAIN from '../shaders/terrain.wgsl?raw';
import FLORA from '../shaders/flora.wgsl?raw';

const LIB = `${COMMON}\n${NOISE}\n${PLANET}\n${ATMOSPHERE}\n${SURFACE}\n${TERRAIN}\n${FLORA}`;

/**
 * One instanced quad per layer covers that layer's region of the placement
 * atlas; each texel decides one plant.
 */
export const floraPlacementProgram = (): PipelineDesc => ({
  label: 'flora placement',
  code: `${LIB}
fn vs(vsIn: VertexIn) -> Varyings {
  var o: Varyings;
  var corners: array<vec2f, 6> = array<vec2f, 6>(vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0), vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0));
  let layer: i32 = i32(vsIn.instanceIndex);
  let a: vec4f = fl.layerA[layer];
  let texel: vec2f = a.xy + corners[vsIn.vertexIndex] * a.z;
  o.position = vec4f(uvToNdc(texel / fl.params.w), 0.0, 1.0);
  o.layer = f32(layer);
  return o;
}
fn fs(fsIn: Varyings) -> FragOut {
  var o: FragOut;
  let layer: i32 = i32(fsIn.layer + 0.5);
  let a: vec4f = fl.layerA[layer];
  let b: vec4f = fl.layerB[layer];
  let c: vec4f = fl.layerC[layer];
  let d: vec4f = fl.layerD[layer];
  let cell: vec2f = floor(fsIn.position.xy) - a.xy;
  let halfGrid: f32 = floor(a.z * 0.5);
  let iu: f32 = b.x - halfGrid + cell.x;
  let iv: f32 = b.y - halfGrid + cell.y;
  let kind: i32 = i32(a.w);
  let jitter: vec4f = floraHash(iu, iv, f32(kind + 7) + b.w * 101.0);
  let stepUv: f32 = 2.0 / b.z;
  let u0: f32 = -1.0 + (b.x + 0.5) * stepUv;
  let v0: f32 = -1.0 + (b.y + 0.5) * stepUv;
  let du: f32 = (iu - b.x + jitter.x - 0.5) * stepUv;
  let dv: f32 = (iv - b.y + jitter.y - 0.5) * stepUv;
  let face: i32 = i32(b.w);
  let delta: vec3f = dirDelta(face, u0, v0, du, dv, c.xyz, c.w);
  let n: vec3f = normalize(c.xyz + delta);
  let row: i32 = i32(pl.info.x);
  let planet: Planet = loadPlanet(row);
  let h: f32 = terrainHeight(row, planet, n, i32(fl.params.z));
  let climate: vec2f = planetClimate(n, planet);
  let fm: FloraMix = floraMix(row, planet, climate, kind, kind < 0);
  // Plants grow in groves, thickets and meadows with clearings between them;
  // the mean density stays roughly what the biome asks for.
  let meters: f32 = planetTexel(row, 2).y * 100000.0;
  var patchSize: f32 = 26.0;
  if (kind < 0) {
    patchSize = 16.0;
  } else if (isTreeKind(kind)) {
    patchSize = 75.0;
  } else if (isStone(kind)) {
    patchSize = 34.0;
  }
  let pm: vec3f = n * (meters / patchSize) + vec3f(f32(kind) * 17.3);
  let clump: f32 = gnoise(pm) + gnoise(pm * 2.7) * 0.35;
  let grove: f32 = 0.18 + 1.55 * smoothstep(-0.32, 0.38, clump + (fm.density - 0.4) * 0.5);
  var present: f32 = select(0.0, 1.0, jitter.z < fm.density * grove);
  if (pl.clip.w > 0.5 && h < 0.0) {
    present = 0.0;
  }
  let rel: vec3f = c.xyz * h + delta * (1.0 + h) + d.xyz;
  // Shrink plants toward the edge of the grid instead of popping them.
  let fade: f32 = 1.0 - smoothstep(d.w * 0.72, d.w, length(rel));
  let size: f32 = mix(fm.scale.x, fm.scale.y, jitter.w) * (0.8 + 0.25 * min(grove, 1.0)) * present * fade;
  o.color0 = vec4f(rel, size);
  // Every plant differs a little: some olive or sun-bleached, slightly muted
  // overall so whole forests do not read as one flat saturated green.
  let muted: vec3f = mix(vec3f(luminance(fm.tint)), fm.tint, 0.72);
  let varied: vec3f = mix(muted, muted * vec3f(1.18, 1.02, 0.66), floraHash(iu, iv, f32(kind) * 3.0 + 31.0).x * 0.7);
  o.color1 = vec4f(varied * (0.85 + jitter.w * 0.3), jitter.x * 6.2831853);
  return o;
}`,
  uniforms: [
    { name: 'pl', block: PlanetBlock },
    { name: 'fl', block: FloraBlock },
  ],
  textures: [{ name: 'planetTex', kind: 'unfilterable' }],
  varyings: [{ name: 'layer', type: 'f32', flat: true }],
  outputs: [{ format: 'rgba32float' }, { format: 'rgba32float' }],
});

export const FLORA_MESH_LAYOUT: VertexBufferLayout = {
  stride: 32,
  step: 'vertex',
  attributes: [
    { name: 'pos', format: 'float32x3', offset: 0 },
    { name: 'nrm', format: 'float32x3', offset: 12 },
    { name: 'extra', format: 'float32x2', offset: 24 },
  ],
};

/** Instance placement and wind, shared by the camera and shadow passes. */
const FLORA_CORE = /* wgsl */ `
struct FloraPoint {
  rel: vec3f,
  nrm: vec3f,
  info: vec4f,
  tint: vec3f,
  present: f32,
}
fn floraPoint(vsIn: VertexIn) -> FloraPoint {
  var t: FloraPoint;
  let layer: i32 = i32(draw.layer.x);
  let a: vec4f = fl.layerA[layer];
  let g: i32 = i32(a.z);
  let index: i32 = i32(vsIn.instanceIndex);
  let texel: vec2i = vec2i(i32(a.x) + index % g, i32(a.y) + index / g);
  let place: vec4f = textureLoad(placeA, texel, 0);
  let look: vec4f = textureLoad(placeB, texel, 0);
  t.present = select(0.0, 1.0, place.w > 0.0001);
  let up: vec3f = normalize(pl.eye.xyz + place.xyz);
  let refAxis: vec3f = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(up.y) > 0.9);
  let east0: vec3f = normalize(cross(refAxis, up));
  let north0: vec3f = cross(up, east0);
  let ca: f32 = cos(look.w);
  let sa: f32 = sin(look.w);
  let east: vec3f = east0 * ca + north0 * sa;
  let north: vec3f = cross(up, east);
  let k: f32 = place.w / fl.params.y;
  var local: vec3f = vsIn.pos;
  // Wind bends the upper parts; trees sway gently, grass a lot.
  let sway: f32 = vsIn.extra.y;
  let wind: f32 = windOffset(place.xyz, sway, look.w) * select(0.08, 0.22, i32(a.w) < 0);
  local = local + vec3f(wind, 0.0, wind * 0.4) * max(local.y, 0.0);
  t.rel = place.xyz + (east * local.x + up * local.y + north * local.z) * k;
  t.nrm = normalize(east * vsIn.nrm.x + up * vsIn.nrm.y + north * vsIn.nrm.z);
  t.info = vec4f(vsIn.extra.x, sway, a.w, clamp(vsIn.pos.y / 6.0, 0.0, 1.0));
  t.tint = look.rgb;
  return t;
}`;

export const floraDrawProgram = (): PipelineDesc => ({
  label: 'flora',
  code: `diagnostic(off, derivative_uniformity);\n${LIB}\n${FLORA_CORE}
fn vs(vsIn: VertexIn) -> Varyings {
  var o: Varyings;
  let t: FloraPoint = floraPoint(vsIn);
  o.position = select(vec4f(2.0, 2.0, 2.0, 1.0), viewClip(t.rel), t.present > 0.5);
  o.rel = t.rel;
  o.nrm = t.nrm;
  o.info = t.info;
  o.tint = t.tint;
  return o;
}
fn fs(fsIn: Varyings) -> FragOut {
  var o: FragOut;
  let row: i32 = i32(pl.info.x);
  let air: Air = loadAir(row);
  let part: f32 = fsIn.info.x;
  let kind: i32 = i32(fsIn.info.z);
  let up: vec3f = normalize(pl.eye.xyz + fsIn.rel);
  let sun: vec3f = pl.sun0.xyz;
  let p: vec3f = pl.eye.xyz + fsIn.rel;
  var normal: vec3f = normalize(fsIn.nrm);
  let dist: f32 = length(fsIn.rel);
  let viewDir: vec3f = fsIn.rel / max(dist, 0.0000001);
  if (dot(normal, viewDir) > 0.0 && part > 0.5 && part < 1.5) {
    normal = -normal;
  }
  let sunLight: vec3f = pl.sun0Color.rgb * sunTransmittance(p, sun, air) * smoothstep(-0.03, 0.03, dot(up, sun));
  let ambient: vec3f = skyAmbient(up, sun, pl.sun0Color.rgb, air) + nightAmbient(up) + sunLight * max(dot(up, sun), 0.0) * 0.05;
  let grain: f32 = fract(sin(dot(floor(fsIn.rel * 9000.0), vec3f(12.9898, 78.233, 37.719))) * 43758.5453);
  var albedo: vec3f = fsIn.tint;
  var emission: vec3f = vec3f(0.0);
  if (part < 0.5) {
    albedo = select(vec3f(0.17, 0.11, 0.07), fsIn.tint * 0.55 + vec3f(0.06), isStone(kind));
  } else if (part < 1.5) {
    // Darker inside the crown, lighter at the tips, a little per-leaf noise.
    albedo = fsIn.tint * (0.62 + 0.45 * fsIn.info.y) * (0.9 + grain * 0.2);
  } else if (part < 2.5) {
    albedo = select(vec3f(0.92, 0.9, 0.86), mix(fsIn.tint, vec3f(1.0, 0.75, 0.88), 0.55), kind == 23 || kind == 25 || kind == 14);
    if (kind == 25) {
      albedo = mix(vec3f(0.95, 0.85, 0.2), mix(vec3f(0.85, 0.25, 0.4), vec3f(0.55, 0.45, 0.95), step(0.5, grain)), step(0.33, grain));
    }
  } else {
    emission = fsIn.tint * 2.2;
    albedo = fsIn.tint * 0.4;
  }
  let ndl: f32 = max(dot(normal, sun), 0.0);
  // Leaves let light through: backlit foliage glows softly.
  let translucency: f32 = select(0.0, pow(max(dot(viewDir, sun), 0.0), 3.0) * 0.6, part > 0.5 && part < 1.5);
  let ao: f32 = 0.5 + 0.5 * clamp(fsIn.info.w + fsIn.info.y * 0.5, 0.0, 1.0);
  let shade: f32 = sunShadow(fsIn.rel, ndl);
  var color: vec3f = albedo * (sunLight * (ndl + translucency) * shade + ambient * ao);
  let darkness: f32 = 1.0 - smoothstep(0.0, 0.15, luminance(sunLight) * max(dot(up, sun), 0.0));
  color = color + emission * (0.2 + darkness * 0.8);
  if (kind == 16 || kind == 15) {
    let hv: vec3f = normalize(sun - viewDir);
    color = color + sunLight * shade * pow(max(dot(normal, hv), 0.0), 60.0) * 0.8;
  }
  o.color0 = vec4f(color, 1.0) * pl.handoff.x;
  o.color1 = vec4f(dist, 0.0, 0.0, 1.0);
  return o;
}`,
  uniforms: [
    { name: 'pl', block: PlanetBlock },
    { name: 'fl', block: FloraBlock },
    { name: 'draw', block: FloraDrawBlock },
  ],
  textures: [
    { name: 'placeA', kind: 'unfilterable' },
    { name: 'placeB', kind: 'unfilterable' },
    { name: 'planetTex', kind: 'unfilterable' },
    { name: 'shadow0', kind: 'depth' },
    { name: 'shadow1', kind: 'depth' },
  ],
  vertexBuffers: [FLORA_MESH_LAYOUT],
  varyings: [
    { name: 'rel', type: 'vec3f' },
    { name: 'nrm', type: 'vec3f' },
    { name: 'info', type: 'vec4f' },
    { name: 'tint', type: 'vec3f' },
  ],
  outputs: [{ format: 'rgba16float', blend: 'premultiplied' }, { format: 'rgba32float' }],
  depth: { write: true, compare: 'less' },
});

/** Flora depth from the sun (grass never casts). */
export const floraShadowProgram = (): PipelineDesc => ({
  label: 'flora shadow',
  code: `${LIB}\n${FLORA_CORE}
fn vs(vsIn: VertexIn) -> Varyings {
  var o: Varyings;
  let t: FloraPoint = floraPoint(vsIn);
  o.position = select(vec4f(2.0, 2.0, 2.0, 1.0), shadowClip(t.rel, i32(cascade.cascade.x)), t.present > 0.5);
  return o;
}`,
  uniforms: [
    { name: 'pl', block: PlanetBlock },
    { name: 'fl', block: FloraBlock },
    { name: 'draw', block: FloraDrawBlock },
    { name: 'cascade', block: CascadeBlock },
  ],
  textures: [
    { name: 'placeA', kind: 'unfilterable' },
    { name: 'placeB', kind: 'unfilterable' },
  ],
  vertexBuffers: [FLORA_MESH_LAYOUT],
  varyings: [],
  outputs: [],
  depth: { write: true, compare: 'less' },
});
