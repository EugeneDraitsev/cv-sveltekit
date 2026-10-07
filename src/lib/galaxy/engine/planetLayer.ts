import type { Backend, GpuBuffer, Pipeline, Texture, UniformBuffer } from '../gpu/backend';
import { BlockData } from '../gpu/blocks';
import { CascadeBlock, PlanetBlock } from './blocks';
import {
  atmosphereProgram,
  patchBuildProgram,
  terrainProgram,
  terrainShadowProgram,
} from './planetPrograms';
import { FACES, Quadtree, faceDirection, type PatchNode } from './quadtree';
import type { Basis, Vec3 } from './math';
import type { Quality } from './quality';
import { FloraLayer } from './floraLayer';
import type { PlanetData } from '../world/system';

export interface PlanetView {
  /** Eye in the body frame (planet radius = 1), double precision. */
  eye: Vec3;
  basis: Basis;
  tanHalf: number;
  aspect: number;
}

/** Half extents of the two sun-shadow cascades, in metres. */
const CASCADES = [150, 2600];
const SHADOW_DEPTH_RANGE = 6000;

/** Where inside a node its grid error is sampled (fractions of its size). */
const GRID_ERROR_SITES = [
  [0.27, 0.31],
  [0.71, 0.56],
  [0.42, 0.83],
] as const;

/**
 * The planet under the camera: quadtree selection, patch builds into the
 * atlas, sun shadows, the terrain and flora draw and the atmosphere pass.
 */
export class PlanetLayer {
  readonly tree: Quadtree;
  readonly resolution: number;
  readonly slotSize: number;
  readonly perRow: number;
  readonly atlasSize: number;
  readonly atlas: Texture;
  private grid: GpuBuffer;
  private indices: GpuBuffer;
  private indexCount: number;
  private patchBuffer: GpuBuffer;
  private jobBuffer: GpuBuffer;
  private patchData: Float32Array;
  private jobData: Float32Array;
  private pipelines!: {
    build: Pipeline;
    terrain: Pipeline;
    atmosphere: Pipeline;
    shadow: Pipeline;
  };
  readonly uniform: UniformBuffer;
  depth: Texture | null = null;
  dist: Texture | null = null;
  output: Texture | null = null;
  private width = 0;
  private height = 0;
  private jobs: PatchNode[] = [];
  row = 0;
  readonly flora: FloraLayer;
  maxPatches: number;
  leafCount = 0;
  // Shadows.
  readonly shadowSize: number;
  private shadowMaps: Texture[];
  private cascadeUniforms: UniformBuffer[] = [];
  private shadowBuffers: GpuBuffer[] = [];
  private shadowCounts = [0, 0];
  /** Reused every frame for the caster list of one cascade. */
  private shadowData: Float32Array;
  private shadowsOn = false;

  constructor(
    private readonly backend: Backend,
    quality: Quality,
  ) {
    const compact = quality.name !== 'high';
    this.resolution = compact ? 17 : 33;
    this.slotSize = this.resolution + 2;
    this.atlasSize = compact ? 768 : 1280;
    this.perRow = Math.floor(this.atlasSize / this.slotSize);
    const slots = this.perRow * this.perRow;
    this.maxPatches = Math.min(slots - 64, 900);
    this.tree = new Quadtree({
      resolution: this.resolution,
      slots,
      maxLevel: compact ? 12 : 13,
      splitFactor: compact ? 1.7 : 1.45,
      errorTolerance: compact ? 0.006 : 0.004,
    });
    this.atlas = backend.createTexture({
      width: this.atlasSize,
      height: this.atlasSize,
      format: 'rgba32float',
      render: true,
      label: 'patch atlas',
    });
    const { vertices, indices } = buildGrid(this.resolution);
    this.grid = backend.createBuffer('vertex', vertices);
    this.indices = backend.createBuffer('index', indices);
    this.indexCount = indices.length;
    this.patchData = new Float32Array(this.maxPatches * 20);
    this.shadowData = new Float32Array(this.maxPatches * 20);
    this.jobData = new Float32Array(64 * 8);
    this.patchBuffer = backend.createBuffer('vertex', this.patchData.byteLength);
    this.jobBuffer = backend.createBuffer('vertex', this.jobData.byteLength);
    this.uniform = backend.createUniform(PlanetBlock);
    this.flora = new FloraLayer(backend, {
      grass: quality.name === 'high' ? 112 : quality.name === 'medium' ? 72 : 0,
      maxGrid: quality.name === 'high' ? 64 : 40,
      layers: quality.name === 'high' ? 8 : 5,
    });
    this.shadowSize = quality.name === 'high' ? 2048 : 1024;
    this.shadowMaps = [0, 1].map((i) =>
      backend.createTexture({
        width: this.shadowSize,
        height: this.shadowSize,
        format: 'depth32float',
        render: true,
        label: `shadow cascade ${i}`,
      }),
    );
    for (let i = 0; i < 2; i++) {
      const u = backend.createUniform(CascadeBlock);
      backend.writeUniform(u, new BlockData(CascadeBlock).set('cascade', i).data);
      this.cascadeUniforms.push(u);
      this.shadowBuffers.push(backend.createBuffer('vertex', this.patchData.byteLength));
    }
    this.shadowsOn = quality.name !== 'low';
  }

  async init() {
    const b = this.backend;
    const [build, terrain, atmosphere, shadow] = await Promise.all([
      b.createPipeline(patchBuildProgram()),
      b.createPipeline(terrainProgram()),
      b.createPipeline(atmosphereProgram()),
      b.createPipeline(terrainShadowProgram()),
    ]);
    this.pipelines = { build, terrain, atmosphere, shadow };
    await this.flora.init();
  }

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    const b = this.backend;
    for (const t of [this.depth, this.dist, this.output]) if (t) b.destroyTexture(t);
    this.width = width;
    this.height = height;
    this.depth = b.createTexture({
      width,
      height,
      format: 'depth32float',
      render: true,
      label: 'terrain depth',
    });
    this.dist = b.createTexture({
      width,
      height,
      format: 'rgba32float',
      render: true,
      label: 'distance',
    });
    this.output = b.createTexture({
      width,
      height,
      format: 'rgba16float',
      render: true,
      label: 'hdr after air',
    });
  }

  /**
   * Height octaves for a level: the finest octave stays at least four vertex
   * spacings wide, so the grid never aliases it into stripes. Finer detail is
   * added per pixel in the terrain shader.
   */
  octaves(level: number) {
    const spacing = Math.PI / 2 / 2 ** level / (this.resolution - 1);
    const finest = Math.log(1 / (70 * 4 * spacing)) / Math.log(2.03);
    return Math.max(4, Math.min(10, Math.floor(finest) + 1));
  }

  /**
   * Switch to a new planet: forget every patch. `height` is the CPU terrain
   * twin, used to find patches whose vertex grid is too coarse for the
   * ridges and cliffs inside them.
   */
  setPlanet(row: number, maxRelief: number, height?: (n: Vec3, octaves: number) => number) {
    this.row = row;
    this.tree.reset();
    this.tree.maxRelief = maxRelief;
    this.tree.measure = height
      ? (face, level, x, y) => this.gridError(height, face, level, x, y)
      : null;
  }

  /**
   * Mean height of a node and how far its terrain strays from straight lines
   * between neighbouring vertices, sampled at a few spots inside it.
   */
  private gridError(
    height: (n: Vec3, octaves: number) => number,
    face: number,
    level: number,
    x: number,
    y: number,
  ) {
    const size = 2 / 2 ** level;
    const step = size / (this.resolution - 1);
    const octaves = Math.min(10, this.octaves(level) + 3);
    const at = (u: number, v: number) => height(faceDirection(face, u, v), octaves);
    let error = 0;
    let sum = 0;
    for (const [fu, fv] of GRID_ERROR_SITES) {
      const u = -1 + (x + fu) * size;
      const v = -1 + (y + fv) * size;
      const h = at(u, v);
      sum += h;
      error = Math.max(
        error,
        Math.abs(h - (at(u - step, v) + at(u + step, v)) / 2),
        Math.abs(h - (at(u, v - step) + at(u, v + step)) / 2),
      );
    }
    return { error, height: Math.max(0, sum / GRID_ERROR_SITES.length) };
  }

  /** Select patches for this frame and lay out the instance data. */
  update(view: PlanetView, buildBudget: number, planet: PlanetData, now: number) {
    this.flora.update(planet, view.eye, now);
    const { eye, basis, tanHalf, aspect } = view;
    const frustum = (center: Vec3, radius: number) => {
      const v: Vec3 = [center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]];
      const z = v[0] * basis.forward[0] + v[1] * basis.forward[1] + v[2] * basis.forward[2];
      if (z < -radius) return false;
      const x = Math.abs(v[0] * basis.right[0] + v[1] * basis.right[1] + v[2] * basis.right[2]);
      const y = Math.abs(v[0] * basis.up[0] + v[1] * basis.up[1] + v[2] * basis.up[2]);
      const zz = Math.max(z, 0);
      return (
        x - radius < zz * tanHalf * aspect * 1.2 + radius &&
        y - radius < zz * tanHalf * 1.2 + radius
      );
    };
    this.tree.update(eye, frustum);
    const budget = this.tree.leaves.length ? buildBudget : Math.max(buildBudget, 48);
    this.jobs = this.tree.pending.slice(0, Math.min(budget, 64));
    const jd = this.jobData;
    this.jobs.forEach((n, i) => {
      const o = i * 8;
      jd[o] = n.slot % this.perRow;
      jd[o + 1] = Math.floor(n.slot / this.perRow);
      jd[o + 2] = n.face;
      jd[o + 3] = n.level;
      jd[o + 4] = n.x;
      jd[o + 5] = n.y;
      jd[o + 6] = this.row;
      jd[o + 7] = this.octaves(n.level);
    });
    const leaves = this.tree.leaves.slice(0, this.maxPatches);
    leaves.forEach((n, i) => this.writePatch(this.patchData, i, n, eye));
    this.leafCount = leaves.length;
    if (this.jobs.length)
      this.backend.writeBuffer(this.jobBuffer, jd.subarray(0, this.jobs.length * 8));
    if (leaves.length)
      this.backend.writeBuffer(this.patchBuffer, this.patchData.subarray(0, leaves.length * 20));
    this.leaves = leaves;
  }

  private leaves: PatchNode[] = [];

  private writePatch(pd: Float32Array, i: number, n: PatchNode, eye: Vec3) {
    const o = i * 20;
    const size = 2 / 2 ** n.level;
    const uc = -1 + (n.x + 0.5) * size;
    const vc = -1 + (n.y + 0.5) * size;
    const [N, U, V] = FACES[n.face];
    const tu = Math.tan((uc * Math.PI) / 4);
    const tv = Math.tan((vc * Math.PI) / 4);
    const F: Vec3 = [
      N[0] + U[0] * tu + V[0] * tv,
      N[1] + U[1] * tu + V[1] * tv,
      N[2] + U[2] * tu + V[2] * tv,
    ];
    const L = Math.hypot(F[0], F[1], F[2]);
    const f: Vec3 = [F[0] / L, F[1] / L, F[2] / L];
    pd[o] = n.slot % this.perRow;
    pd[o + 1] = Math.floor(n.slot / this.perRow);
    pd[o + 2] = n.face;
    pd[o + 3] = n.level;
    pd[o + 4] = n.x;
    pd[o + 5] = n.y;
    pd[o + 6] = 0;
    pd[o + 7] = 0;
    pd[o + 8] = f[0];
    pd[o + 9] = f[1];
    pd[o + 10] = f[2];
    pd[o + 11] = L;
    // Eye-relative centre in double precision: the key to jitter-free ground.
    pd[o + 12] = f[0] - eye[0];
    pd[o + 13] = f[1] - eye[1];
    pd[o + 14] = f[2] - eye[2];
    pd[o + 15] = size / 2;
    pd[o + 16] = uc;
    pd[o + 17] = vc;
    pd[o + 18] = 0;
    pd[o + 19] = 0;
  }

  /**
   * Fill the per-frame planet uniforms the layer owns: patch layout and the
   * sun-shadow cascades (light basis snapped to whole texels so shadow edges
   * do not crawl as the camera moves).
   */
  writeUniform(data: BlockData<typeof PlanetBlock.fields>, eye: Vec3, meters: number) {
    data.set('info', this.row, this.resolution, this.slotSize, this.perRow);
    const s = data.data;
    const state = PlanetBlock.offsets.state;
    s[state + 2] = this.atlasSize;
    s[state + 3] = this.atlasSize;
    const so = PlanetBlock.offsets.sun0;
    const sun: Vec3 = [s[so], s[so + 1], s[so + 2]];
    const r = Math.hypot(eye[0], eye[1], eye[2]);
    const up: Vec3 = [eye[0] / r, eye[1] / r, eye[2] / r];
    const elevation = sun[0] * up[0] + sun[1] * up[1] + sun[2] * up[2];
    const enabled = this.shadowsOn && elevation > -0.02 && r - 1 < 0.04;
    const z = sun;
    const helper: Vec3 = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const x = normalize(cross(helper, z));
    const y = cross(z, x);
    data.vec('shadowX', x, 0).vec('shadowY', y, 0).vec('shadowZ', z, 0);
    const ex = x[0] * eye[0] + x[1] * eye[1] + x[2] * eye[2];
    const ey = y[0] * eye[0] + y[1] * eye[1] + y[2] * eye[2];
    CASCADES.forEach((m, i) => {
      const extent = m / meters;
      const texel = (2 * extent) / this.shadowSize;
      const cx = Math.round(ex / texel) * texel - ex;
      const cy = Math.round(ey / texel) * texel - ey;
      data.set(i === 0 ? 'cascade0' : 'cascade1', cx, cy, 0, extent);
    });
    data.set('shadow', SHADOW_DEPTH_RANGE / meters, this.shadowSize, enabled ? 1 : 0, 0);
    this.backend.writeUniform(this.uniform, s);
    if (enabled) this.selectShadowCasters(x, y, eye, meters);
    else this.shadowCounts.fill(0);
  }

  /** Patches whose light-space footprint overlaps each cascade. */
  private selectShadowCasters(x: Vec3, y: Vec3, eye: Vec3, meters: number) {
    const relief = this.tree.maxRelief;
    CASCADES.forEach((m, c) => {
      const extent = m / meters;
      let count = 0;
      const data = this.shadowData;
      for (const n of this.leaves) {
        const vx = n.center[0] - eye[0];
        const vy = n.center[1] - eye[1];
        const vz = n.center[2] - eye[2];
        const lx = Math.abs(vx * x[0] + vy * x[1] + vz * x[2]);
        const ly = Math.abs(vx * y[0] + vy * y[1] + vz * y[2]);
        const radius = n.angle * 1.1 + relief;
        if (lx - radius < extent && ly - radius < extent) this.writePatch(data, count++, n, eye);
      }
      this.shadowCounts[c] = count;
      if (count) this.backend.writeBuffer(this.shadowBuffers[c], data.subarray(0, count * 20));
    });
  }

  /** Patch builds; must be recorded before `drawTerrain` in the same frame. */
  build(planetTex: Texture) {
    if (!this.jobs.length) return;
    const pass = this.backend.beginPass({
      color: [this.atlas],
      clearColor: null,
      label: 'patch build',
    });
    pass.draw({
      pipeline: this.pipelines.build,
      uniforms: [this.uniform],
      textures: [planetTex],
      vertexBuffers: [this.jobBuffer],
      count: 6,
      instances: this.jobs.length,
    });
    pass.end();
    this.tree.markBuilt(this.jobs);
  }

  placeFlora(planetTex: Texture) {
    this.flora.place(this.uniform, planetTex);
  }

  /** Depth from the sun for both cascades (terrain and plants). */
  drawShadows(planetTex: Texture) {
    for (let c = 0; c < 2; c++) {
      const pass = this.backend.beginPass({
        color: [],
        depth: this.shadowMaps[c],
        clearDepth: 1,
        label: `shadow ${c}`,
      });
      if (this.shadowCounts[c]) {
        pass.draw({
          pipeline: this.pipelines.shadow,
          uniforms: [this.uniform, this.cascadeUniforms[c]],
          textures: [this.atlas, planetTex],
          vertexBuffers: [this.grid, this.shadowBuffers[c]],
          indexBuffer: this.indices,
          count: this.indexCount,
          instances: this.shadowCounts[c],
        });
        this.flora.drawShadow(pass, this.uniform, this.cascadeUniforms[c]);
      }
      pass.end();
    }
  }

  drawTerrain(hdr: Texture, planetTex: Texture) {
    const pass = this.backend.beginPass({
      color: [hdr, this.dist!],
      depth: this.depth!,
      clearColor: null,
      clearDepth: 1,
      label: 'terrain',
    });
    const shadows = this.shadowMaps;
    if (this.leafCount) {
      pass.draw({
        pipeline: this.pipelines.terrain,
        uniforms: [this.uniform],
        textures: [this.atlas, planetTex, shadows[0], shadows[1]],
        vertexBuffers: [this.grid, this.patchBuffer],
        indexBuffer: this.indices,
        count: this.indexCount,
        instances: this.leafCount,
      });
    }
    this.flora.draw(pass, this.uniform, planetTex, shadows);
    pass.end();
  }

  /** Clears the distance target where the terrain did not draw. */
  clearDistance() {
    const pass = this.backend.beginPass({
      color: [this.dist!],
      clearColor: [0, 0, 0, 0],
      label: 'clear distance',
    });
    pass.end();
  }

  drawAtmosphere(hdr: Texture, planetTex: Texture) {
    const pass = this.backend.beginPass({
      color: [this.output!],
      clearColor: [0, 0, 0, 1],
      label: 'atmosphere',
    });
    pass.draw({
      pipeline: this.pipelines.atmosphere,
      uniforms: [this.uniform],
      textures: [hdr, this.dist!, planetTex],
      count: 3,
    });
    pass.end();
  }
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** One N×N grid plus a skirt along every border; shared by every patch. */
function buildGrid(n: number) {
  const vertices: number[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) vertices.push(i, j, 0);
  const skirtStart = n * n;
  const edges: [number, number][][] = [
    Array.from({ length: n }, (_, i) => [i, 0] as [number, number]),
    Array.from({ length: n }, (_, i) => [n - 1, i] as [number, number]),
    Array.from({ length: n }, (_, i) => [n - 1 - i, n - 1] as [number, number]),
    Array.from({ length: n }, (_, i) => [0, n - 1 - i] as [number, number]),
  ];
  for (const edge of edges) for (const [i, j] of edge) vertices.push(i, j, 1);
  const indices: number[] = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      indices.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
    }
  }
  edges.forEach((edge, e) => {
    for (let k = 0; k < n - 1; k++) {
      const [i0, j0] = edge[k];
      const [i1, j1] = edge[k + 1];
      const top0 = j0 * n + i0;
      const top1 = j1 * n + i1;
      const bottom0 = skirtStart + e * n + k;
      const bottom1 = bottom0 + 1;
      indices.push(top0, bottom0, top1, top1, bottom0, bottom1);
    }
  });
  return { vertices: new Float32Array(vertices), indices: new Uint32Array(indices) };
}
