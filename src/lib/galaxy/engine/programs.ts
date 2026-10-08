import type { PipelineDesc, VertexBufferLayout } from '../gpu/backend';
import { GalaxyBlock, PostBlock, SystemBlock } from './blocks';
import COMMON from '../shaders/common.wgsl?raw';
import NOISE from '../shaders/noise.wgsl?raw';
import PLANET from '../shaders/planet.wgsl?raw';
import ATMOSPHERE from '../shaders/atmosphere.wgsl?raw';
import SURFACE from '../shaders/surface.wgsl?raw';
import SYSTEM from '../shaders/system.wgsl?raw';
import GALAXY from '../shaders/galaxy.wgsl?raw';
import VOLUME from '../shaders/volume.wgsl?raw';
import STARS from '../shaders/stars.wgsl?raw';
import POST from '../shaders/post.wgsl?raw';

const FULLSCREEN_VS = /* wgsl */ `
fn vs(vsIn: VertexIn) -> Varyings {
  var o: Varyings;
  let p: vec2f = fullscreenPosition(vsIn.vertexIndex);
  o.position = vec4f(p, 0.0, 1.0);
  o.ndc = p;
  return o;
}`;

const galaxyUniform = [{ name: 'galaxy', block: GalaxyBlock }];
const postUniform = [{ name: 'post', block: PostBlock }];

export const bakeVolumeProgram = (): PipelineDesc => ({
  label: 'galaxy volume bake',
  code: `${COMMON}\n${VOLUME}
${FULLSCREEN_VS}
fn fs(fsIn: Varyings) -> FragOut {
  var o: FragOut;
  let texel: vec2f = floor(fsIn.position.xy);
  let tile: vec2f = galaxy.volume.xz;
  let cell: vec2f = floor(texel / tile);
  let slice: f32 = cell.y * galaxy.volume.w + cell.x;
  let inTile: vec2f = texel - cell * tile;
  let uvw: vec3f = vec3f((inTile.x + 0.5) / tile.x, (slice + 0.5) / galaxy.volume.y, (inTile.y + 0.5) / tile.y);
  let p: vec3f = (uvw - vec3f(0.5)) * GALAXY_BOUNDS * 2.0;
  o.color0 = volumeAt(p);
  return o;
}`,
  uniforms: galaxyUniform,
  varyings: [{ name: 'ndc', type: 'vec2f' }],
  outputs: [{ format: 'rgba16float' }],
});

export const galaxySkyProgram = (): PipelineDesc => ({
  label: 'galaxy volume',
  code: `${COMMON}\n${GALAXY}
${FULLSCREEN_VS}
fn fs(fsIn: Varyings) -> FragOut {
  var o: FragOut;
  let rd: vec3f = cameraRay(fsIn.ndc, galaxy.forward.xyz, galaxy.right.xyz, galaxy.up.xyz, galaxy.eye.w, galaxy.viewport.w);
  o.color0 = vec4f(renderGalaxy(galaxy.eye.xyz, rd, floor(fsIn.position.xy)), 1.0);
  return o;
}`,
  uniforms: galaxyUniform,
  textures: [{ name: 'volumeTex' }],
  varyings: [{ name: 'ndc', type: 'vec2f' }],
  outputs: [{ format: 'rgba16float' }],
});

const STAR_FS = /* wgsl */ `
fn fs(fsIn: Varyings) -> FragOut {
  var o: FragOut;
  o.color0 = vec4f(fsIn.tint.rgb * starProfile(fsIn.corner) * fsIn.tint.a, 0.0);
  return o;
}`;

/** Project a galaxy-space point; returns ndc.xy, pixel radius, view depth. */
const STAR_PROJECT = /* wgsl */ `
fn starScreen(world: vec3f, size: f32, maxPixels: f32) -> vec4f {
  let rel: vec3f = world - galaxy.eye.xyz;
  let z: f32 = dot(rel, galaxy.forward.xyz);
  let tanHalf: f32 = galaxy.eye.w;
  let ndc: vec2f = vec2f(dot(rel, galaxy.right.xyz) / (tanHalf * galaxy.viewport.w), dot(rel, galaxy.up.xyz) / tanHalf) / max(z, 0.0001);
  let raw: f32 = size * galaxy.viewport.y / (max(z, 0.08) * tanHalf);
  // Convolve tiny stars with a pixel footprint instead of dropping their energy.
  let pixels: f32 = min(sqrt(raw * raw + 3.24), maxPixels);
  return vec4f(ndc, pixels, z);
}
fn starEnergy(size: f32, z: f32, pixels: f32, maxPixels: f32) -> f32 {
  let raw: f32 = min(size * galaxy.viewport.y / (max(z, 0.08) * galaxy.eye.w), maxPixels);
  return max(raw * raw, 0.65) / (pixels * pixels);
}`;

export const galaxyStarsProgram = (): PipelineDesc => ({
  label: 'galaxy stars',
  code: `${COMMON}\n${GALAXY}\n${STARS}\n${STAR_PROJECT}
fn vs(vsIn: VertexIn) -> Varyings {
  var o: Varyings;
  let star: Star = galaxyStar(vsIn.instanceIndex);
  let q: vec2f = starCorner(vsIn.vertexIndex);
  o.corner = q;
  let world: vec3f = rotateY(star.position * vec3f(1.0, galaxy.detail.z, 1.0), galaxy.detail.y);
  let s: vec4f = starScreen(world, star.size, 24.0);
  // Stars of the system being entered make way for its real sun.
  let focusFade: f32 = 1.0 - galaxy.focus.w * (1.0 - smoothstep(0.0, 0.25, length(world - galaxy.focus.xyz)));
  let visibility: f32 = galaxy.atlas.z * focusFade;
  if (s.w < 0.01 || visibility < 0.0001) {
    o.position = vec4f(2.0, 2.0, 2.0, 1.0);
    o.tint = vec4f(0.0);
    return o;
  }
  o.position = vec4f(s.xy + q * s.z * 2.0 / galaxy.viewport.xy, 0.5, 1.0);
  let occlusion: f32 = dustOcclusion(star.position, rotateY(galaxy.eye.xyz, -galaxy.detail.y));
  o.tint = vec4f(star.color, star.brightness * galaxy.detail.w * occlusion * starEnergy(star.size, s.w, s.z, 24.0) * visibility);
  return o;
}
${STAR_FS}`,
  uniforms: galaxyUniform,
  textures: [{ name: 'volumeTex' }],
  varyings: [
    { name: 'corner', type: 'vec2f' },
    { name: 'tint', type: 'vec4f' },
  ],
  outputs: [{ format: 'rgba16float', blend: 'add' }],
});

export const SYSTEM_STAR_LAYOUT: VertexBufferLayout = {
  stride: 48,
  step: 'instance',
  attributes: [
    { name: 'site', format: 'float32x4', offset: 0 },
    { name: 'tint', format: 'float32x4', offset: 16 },
    { name: 'flags', format: 'float32x4', offset: 32 },
  ],
};

/** The explorable systems: bright stars with a hover / selection ring. */
export const systemStarsProgram = (): PipelineDesc => ({
  label: 'system markers',
  code: `${COMMON}\n${GALAXY}\n${STARS}\n${STAR_PROJECT}
fn vs(vsIn: VertexIn) -> Varyings {
  var o: Varyings;
  let q: vec2f = starCorner(vsIn.vertexIndex);
  o.corner = q;
  let world: vec3f = rotateY(vsIn.site.xyz * vec3f(1.0, galaxy.detail.z, 1.0), galaxy.detail.y);
  let s: vec4f = starScreen(world, vsIn.site.w, 40.0);
  let visibility: f32 = vsIn.flags.w;
  if (s.w < 0.01 || visibility < 0.0001) {
    o.position = vec4f(2.0, 2.0, 2.0, 1.0);
    o.tint = vec4f(0.0);
    o.ring = vec2f(0.0);
    return o;
  }
  // Rings stay a readable size; the core keeps physical scale.
  let ringPixels: f32 = max(s.z * 1.8, 9.0 + vsIn.flags.x * 5.0);
  let pixels: f32 = select(s.z, ringPixels, vsIn.flags.x > 0.01 || vsIn.flags.y > 0.01);
  o.position = vec4f(s.xy + q * pixels * 2.0 / galaxy.viewport.xy, 0.5, 1.0);
  let occlusion: f32 = mix(dustOcclusion(vsIn.site.xyz, rotateY(galaxy.eye.xyz, -galaxy.detail.y)), 1.0, 0.55);
  o.tint = vec4f(vsIn.tint.rgb, vsIn.tint.a * occlusion * starEnergy(vsIn.site.w, s.w, s.z, 40.0) * visibility * (s.z * s.z) / (pixels * pixels));
  o.ring = vec2f(max(vsIn.flags.x, vsIn.flags.y * 0.6) * visibility, pixels / max(s.z, 0.001));
  return o;
}
fn fs(fsIn: Varyings) -> FragOut {
  var o: FragOut;
  let r: f32 = length(fsIn.corner);
  let core: f32 = starProfile(fsIn.corner * fsIn.ring.y);
  let ring: f32 = smoothstep(0.78, 0.86, r) * (1.0 - smoothstep(0.90, 0.98, r)) * fsIn.ring.x;
  o.color0 = vec4f(fsIn.tint.rgb * core * fsIn.tint.a + vec3f(1.0, 0.86, 0.62) * ring * 0.9, 0.0);
  return o;
}`,
  uniforms: galaxyUniform,
  textures: [{ name: 'volumeTex' }],
  vertexBuffers: [SYSTEM_STAR_LAYOUT],
  varyings: [
    { name: 'corner', type: 'vec2f' },
    { name: 'tint', type: 'vec4f' },
    { name: 'ring', type: 'vec2f' },
  ],
  outputs: [{ format: 'rgba16float', blend: 'add' }],
});

export const skyStarsProgram = (): PipelineDesc => ({
  label: 'sky stars',
  code: `${COMMON}\n${GALAXY}\n${STARS}
fn vs(vsIn: VertexIn) -> Varyings {
  var o: Varyings;
  let star: Star = skyStar(vsIn.instanceIndex);
  let q: vec2f = starCorner(vsIn.vertexIndex);
  o.corner = q;
  let z: f32 = dot(star.position, galaxy.forward.xyz);
  if (z < 0.01 || galaxy.atlas.w < 0.0001) {
    o.position = vec4f(2.0, 2.0, 2.0, 1.0);
    o.tint = vec4f(0.0);
    return o;
  }
  let tanHalf: f32 = galaxy.eye.w;
  let ndc: vec2f = vec2f(dot(star.position, galaxy.right.xyz) / (tanHalf * galaxy.viewport.w), dot(star.position, galaxy.up.xyz) / tanHalf) / z;
  let pixels: f32 = sqrt(star.size * star.size + 2.2);
  o.position = vec4f(ndc + q * pixels * 2.0 / galaxy.viewport.xy, 0.5, 1.0);
  o.tint = vec4f(star.color, star.brightness * galaxy.atlas.w * (star.size * star.size + 0.4) / (pixels * pixels) * 0.12);
  return o;
}
${STAR_FS}`,
  uniforms: galaxyUniform,
  varyings: [
    { name: 'corner', type: 'vec2f' },
    { name: 'tint', type: 'vec4f' },
  ],
  outputs: [{ format: 'rgba16float', blend: 'add' }],
});

/** The analytic star-system pass, composited over the sky (premultiplied). */
export const systemProgram = (): PipelineDesc => ({
  label: 'star system',
  code: `${COMMON}\n${NOISE}\n${PLANET}\n${ATMOSPHERE}\n${SURFACE}\n${SYSTEM}
${FULLSCREEN_VS}
fn fs(fsIn: Varyings) -> FragOut {
  var o: FragOut;
  let rd: vec3f = cameraRay(fsIn.ndc, sys.forward.xyz, sys.right.xyz, sys.up.xyz, sys.eye.w, sys.viewport.w);
  o.color0 = renderSystem(rd, 1e9);
  return o;
}`,
  uniforms: [{ name: 'sys', block: SystemBlock }],
  textures: [{ name: 'planetTex', kind: 'unfilterable' }],
  varyings: [{ name: 'ndc', type: 'vec2f' }],
  outputs: [{ format: 'rgba16float', blend: 'premultiplied' }],
});

export const bloomProgram = (): PipelineDesc => ({
  label: 'bloom',
  code: `${COMMON}\n${POST}\n${FULLSCREEN_VS}
fn fs(fsIn: Varyings) -> FragOut {
  var o: FragOut;
  o.color0 = bloomDown(ndcToUv(fsIn.ndc));
  return o;
}`,
  uniforms: postUniform,
  textures: [{ name: 'srcTex' }],
  varyings: [{ name: 'ndc', type: 'vec2f' }],
  outputs: [{ format: 'rgba16float' }],
});

export const compositeProgram = (): PipelineDesc => ({
  label: 'composite',
  code: `${COMMON}\n${POST}\n${FULLSCREEN_VS}
fn fs(fsIn: Varyings) -> FragOut {
  var o: FragOut;
  o.color0 = composite(ndcToUv(fsIn.ndc), floor(fsIn.position.xy));
  return o;
}`,
  uniforms: postUniform,
  textures: [
    { name: 'srcTex' },
    { name: 'bloom0' },
    { name: 'bloom1' },
    { name: 'bloom2' },
    { name: 'bloom3' },
  ],
  varyings: [{ name: 'ndc', type: 'vec2f' }],
  outputs: [{ format: 'canvas' }],
});
