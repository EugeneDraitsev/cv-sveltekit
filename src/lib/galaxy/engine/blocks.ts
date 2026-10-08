import { uniformBlock } from '../gpu/blocks';

/** Galaxy-space camera and look parameters (galaxy volume and star passes). */
export const GalaxyBlock = uniformBlock('GalaxyParams', {
  /** xyz: eye in galaxy space, w: tan(fov / 2). */
  eye: 'vec4',
  right: 'vec4',
  up: 'vec4',
  forward: 'vec4',
  /** target width, height, time (s), aspect. */
  viewport: 'vec4',
  /** exposure, bloom, nebula, dust. */
  look: 'vec4',
  /** volume steps, galaxy angle, disk thickness, star brightness. */
  detail: 'vec4',
  /** atlas tile x, slices, tile z, tiles per row. */
  volume: 'vec4',
  /** atlas width, height, galaxy-star visibility, sky-star visibility. */
  atlas: 'vec4',
  /** xyz: galaxy-space position of the system being entered, w: its fade (0..1). */
  focus: 'vec4',
  /** x: galaxy brightness (eye adaptation inside a system), y: background star field strength. */
  adapt: 'vec4',
});

/** A star system around the eye: every position is relative to the camera. */
export const SystemBlock = uniformBlock('SystemParams', {
  /** w: tan(fov / 2). */
  eye: 'vec4',
  right: 'vec4',
  up: 'vec4',
  forward: 'vec4',
  /** target width, height, time, aspect. */
  viewport: 'vec4',
  /** stars, planets, moons, rings. */
  counts: 'vec4',
  /** planet drawn as a mesh instead (-1: none), unused, orbit-line alpha, selected planet. */
  options: 'vec4',
  /** System origin relative to the eye. */
  origin: 'vec4',
  stars: ['vec4', 2],
  starColor: ['vec4', 2],
  planets: ['vec4', 8],
  /** data row, orbit radius, cloud drift, unused. */
  planetInfo: ['vec4', 8],
  axisX: ['vec4', 8],
  axisY: ['vec4', 8],
  axisZ: ['vec4', 8],
  moons: ['vec4', 16],
  moonInfo: ['vec4', 16],
  rings: ['vec4', 8],
  ringNormal: ['vec4', 8],
});

/** The planet the camera is on (body frame, planet radius = 1). */
export const PlanetBlock = uniformBlock('PlanetParams', {
  /** xyz: eye in the body frame, w: tan(fov / 2). */
  eye: 'vec4',
  right: 'vec4',
  up: 'vec4',
  forward: 'vec4',
  /** target width, height, time, aspect. */
  viewport: 'vec4',
  /** Sun directions (body frame) with intensity, and their colours. */
  sun0: 'vec4',
  sun0Color: 'vec4',
  sun1: 'vec4',
  sun1Color: 'vec4',
  /** data row, patch resolution, atlas slot size, slots per atlas row. */
  info: 'vec4',
  /** log-depth scale, 1 / log2(1 + far·scale), skirt depth, liquid kind (0 none). */
  clip: 'vec4',
  /** Moon direction (body frame), illuminated fraction. */
  moon: 'vec4',
  /** cloud drift angle, cloud altitude (radii), cover, thickness (radii). */
  cloud: 'vec4',
  /** x: altitude in radii, y: daylight 0..1, zw: patch atlas size in texels. */
  state: 'vec4',
  /** Light-space basis (z points at the sun), body frame. */
  shadowX: 'vec4',
  shadowY: 'vec4',
  shadowZ: 'vec4',
  /** Per cascade: light-space centre relative to the eye, half extent (radii). */
  cascade0: 'vec4',
  cascade1: 'vec4',
  /** depth range (radii), map size (texels), enabled, unused. */
  shadow: 'vec4',
  /**
   * x: weight of the surface renderer against the orbital sphere drawn
   * beneath it (0..1), for a cross-fade between the two in flight.
   */
  handoff: 'vec4',
});

/** Which shadow cascade a depth-only draw renders. */
export const CascadeBlock = uniformBlock('CascadeParams', {
  cascade: 'vec4',
});

/** Flora placement grids around the camera (one entry per layer). */
export const FLORA_LAYERS = 10;
export const FloraBlock = uniformBlock('FloraParams', {
  /** atlas x, atlas y, grid size, flora kind (-1: grass). */
  layerA: ['vec4', FLORA_LAYERS],
  /** grid origin cell (u, v), cells per face edge, cube face. */
  layerB: ['vec4', FLORA_LAYERS],
  /** origin cell centre direction, |F| of its cube point. */
  layerC: ['vec4', FLORA_LAYERS],
  /** origin centre minus eye (body frame, radii), fade radius (radii). */
  layerD: ['vec4', FLORA_LAYERS],
  /** layer count, metres per radius, height octaves, placement atlas size. */
  params: 'vec4',
});

/** Per-draw selector of the flora layer. */
export const FloraDrawBlock = uniformBlock('FloraDraw', {
  layer: 'vec4',
});

export const PostBlock = uniformBlock('PostParams', {
  /** HDR target width, height, time, unused. */
  viewport: 'vec4',
  /** exposure, bloom strength, light-theme mix, angle of the space cloud. */
  look: 'vec4',
  /** page colour space's black is lifted to (sRGB), vignette strength. */
  paper: 'vec4',
  /** Light theme: the galaxy disk's projected ellipse (screen units): centre, semi-axes. */
  cloud: 'vec4',
});
