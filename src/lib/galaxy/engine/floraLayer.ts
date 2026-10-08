import type { Backend, GpuBuffer, Pass, Pipeline, Texture, UniformBuffer } from '../gpu/backend';
import { BlockData } from '../gpu/blocks';
import { FLORA_LAYERS, FloraBlock, FloraDrawBlock } from './blocks';
import { floraDrawProgram, floraPlacementProgram, floraShadowProgram } from './floraPrograms';
import { FACES, faceDirection } from './quadtree';
import type { Vec3 } from './math';
import { FLORA_KINDS, FLORA_SPACING, buildFloraMeshes, buildGrassMesh } from '../world/floraMeshes';
import type { FloraKind } from '../world/biomes';
import type { PlanetData } from '../world/system';
import { biomeAt, terrainParams } from '../world/terrain';

const ATLAS = 256;
/** Placement regions: the grass grid first, then 64×64 slots. */
const SLOTS: [number, number][] = [
  [128, 0],
  [192, 0],
  [128, 64],
  [192, 64],
  [0, 128],
  [64, 128],
  [128, 128],
  [192, 128],
  [0, 192],
];

/** How far each kind is drawn, in metres. */
const REACH: Partial<Record<FloraKind, number>> = {
  flowers: 34,
  reeds: 40,
  fern: 48,
  rocks: 60,
  glowPlant: 60,
  bush: 110,
};

interface Layer {
  kind: number;
  grid: number;
  spacing: number;
  vertices: GpuBuffer;
  count: number;
}

export interface FloraQuality {
  grass: number;
  maxGrid: number;
  layers: number;
}

/**
 * Plants around the camera: chooses which kinds grow nearby, runs the GPU
 * placement pass and issues one instanced draw per kind.
 */
export class FloraLayer {
  private placeA: Texture;
  private placeB: Texture;
  private meshes = new Map<FloraKind, { buffer: GpuBuffer; count: number }>();
  private grassMesh: { buffer: GpuBuffer; count: number };
  private pipelines!: { place: Pipeline; draw: Pipeline; shadow: Pipeline };
  readonly uniform: UniformBuffer;
  private drawUniforms: UniformBuffer[] = [];
  private data = new BlockData(FloraBlock);
  private layers: Layer[] = [];
  private lastProbe = 0;
  /** The planet the last probe ran on; a new planet always probes at once. */
  private probed: PlanetData | null = null;
  private kinds: number[] = [];

  constructor(
    private readonly backend: Backend,
    private readonly quality: FloraQuality,
  ) {
    const target = (label: string) =>
      backend.createTexture({
        width: ATLAS,
        height: ATLAS,
        format: 'rgba32float',
        render: true,
        label,
      });
    this.placeA = target('flora placement A');
    this.placeB = target('flora placement B');
    for (const [kind, mesh] of buildFloraMeshes()) {
      this.meshes.set(kind, {
        buffer: backend.createBuffer('vertex', mesh.vertices),
        count: mesh.count,
      });
    }
    const grass = buildGrassMesh();
    this.grassMesh = { buffer: backend.createBuffer('vertex', grass.vertices), count: grass.count };
    this.uniform = backend.createUniform(FloraBlock);
    for (let i = 0; i < FLORA_LAYERS; i++) {
      const u = backend.createUniform(FloraDrawBlock);
      const d = new BlockData(FloraDrawBlock).set('layer', i, 0, 0, 0);
      backend.writeUniform(u, d.data);
      this.drawUniforms.push(u);
    }
  }

  /** Free the placement targets and plant meshes (the backend outlives us). */
  destroy() {
    const b = this.backend;
    b.destroyTexture(this.placeA);
    b.destroyTexture(this.placeB);
    for (const { buffer } of this.meshes.values()) b.destroyBuffer(buffer);
    b.destroyBuffer(this.grassMesh.buffer);
    this.meshes.clear();
  }

  async init() {
    const [place, draw, shadow] = await Promise.all([
      this.backend.createPipeline(floraPlacementProgram()),
      this.backend.createPipeline(floraDrawProgram()),
      this.backend.createPipeline(floraShadowProgram()),
    ]);
    this.pipelines = { place, draw, shadow };
  }

  /** Which flora kinds grow within reach of the camera, most common first. */
  private nearbyKinds(planet: PlanetData, eye: Vec3, now: number) {
    // Throttled whether or not the last probe found anything: giants and
    // barren ground would otherwise re-probe every frame.
    if (planet === this.probed && now - this.lastProbe < 400) return this.kinds;
    this.probed = planet;
    this.lastProbe = now;
    if (planet.giant || !planet.biomes.length) {
      this.kinds = [];
      return this.kinds;
    }
    const params = terrainParams(planet);
    const r = Math.hypot(eye[0], eye[1], eye[2]);
    const n: Vec3 = [eye[0] / r, eye[1] / r, eye[2] / r];
    const score = new Map<number, number>();
    const probe = (d: Vec3, weight: number) => {
      const { weights } = biomeAt(params, d[0], d[1], d[2]);
      const total = weights.reduce((s, w) => s + w, 0) || 1;
      planet.biomes.forEach((b, i) => {
        const w = (weights[i] / total) * weight;
        if (w < 0.02) return;
        for (const f of b.spec.flora) {
          const kind = FLORA_KINDS.indexOf(f.kind);
          score.set(kind, (score.get(kind) ?? 0) + w * f.density);
        }
      });
    };
    probe(n, 2);
    // A ring of probes ~400 m out catches the next biome before it arrives.
    const t =
      Math.abs(n[1]) < 0.9 ? normalizeV(crossV(n, [0, 1, 0])) : normalizeV(crossV(n, [1, 0, 0]));
    const b = crossV(n, t);
    const reach = 400 / planet.meters;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const d = normalizeV([
        n[0] + (t[0] * Math.cos(a) + b[0] * Math.sin(a)) * reach,
        n[1] + (t[1] * Math.cos(a) + b[1] * Math.sin(a)) * reach,
        n[2] + (t[2] * Math.cos(a) + b[2] * Math.sin(a)) * reach,
      ]);
      probe(d, 1);
    }
    this.kinds = [...score.entries()]
      .filter(([, s]) => s > 0.01)
      .toSorted((x, y) => y[1] - x[1])
      .slice(0, Math.min(SLOTS.length, this.quality.layers))
      .map(([kind]) => kind);
    return this.kinds;
  }

  /** Lay out the placement grids for this frame (eye in the body frame). */
  update(planet: PlanetData, eye: Vec3, now: number) {
    const meters = planet.meters;
    const kinds = this.nearbyKinds(planet, eye, now);
    const hasGrass = planet.biomes.some((b) => b.spec.grass > 0.02);
    this.layers = [];
    const d = this.data;
    const r = Math.hypot(eye[0], eye[1], eye[2]);
    const dir: Vec3 = [eye[0] / r, eye[1] / r, eye[2] / r];
    // The grid is anchored to the cube face under the camera.
    let face = 0;
    let best = -Infinity;
    FACES.forEach(([n], i) => {
      const s = n[0] * dir[0] + n[1] * dir[1] + n[2] * dir[2];
      if (s > best) {
        best = s;
        face = i;
      }
    });
    const [N, U, V] = FACES[face];
    const dn = dir[0] * N[0] + dir[1] * N[1] + dir[2] * N[2];
    const u = (Math.atan((dir[0] * U[0] + dir[1] * U[1] + dir[2] * U[2]) / dn) * 4) / Math.PI;
    const v = (Math.atan((dir[0] * V[0] + dir[1] * V[1] + dir[2] * V[2]) / dn) * 4) / Math.PI;
    const add = (
      kind: number,
      grid: number,
      spacing: number,
      at: [number, number],
      mesh: { buffer: GpuBuffer; count: number },
    ) => {
      const i = this.layers.length;
      const cells = Math.max(16, Math.round(((Math.PI / 2) * meters) / spacing));
      const iu0 = Math.floor(((u + 1) / 2) * cells);
      const iv0 = Math.floor(((v + 1) / 2) * cells);
      const uc = -1 + ((iu0 + 0.5) * 2) / cells;
      const vc = -1 + ((iv0 + 0.5) * 2) / cells;
      const tu = Math.tan((uc * Math.PI) / 4);
      const tv = Math.tan((vc * Math.PI) / 4);
      const F: Vec3 = [
        N[0] + U[0] * tu + V[0] * tv,
        N[1] + U[1] * tu + V[1] * tv,
        N[2] + U[2] * tu + V[2] * tv,
      ];
      const L = Math.hypot(F[0], F[1], F[2]);
      const o = faceDirection(face, uc, vc);
      d.item('layerA', i, at[0], at[1], grid, kind);
      d.item('layerB', i, iu0, iv0, cells, face);
      d.item('layerC', i, o[0], o[1], o[2], L);
      d.item(
        'layerD',
        i,
        o[0] - eye[0],
        o[1] - eye[1],
        o[2] - eye[2],
        ((grid * spacing) / 2 / meters) * 0.98,
      );
      this.layers.push({ kind, grid, spacing, vertices: mesh.buffer, count: mesh.count });
    };
    if (hasGrass && this.quality.grass > 0)
      add(-1, this.quality.grass, 0.85, [0, 0], this.grassMesh);
    kinds.forEach((kind, i) => {
      const name = FLORA_KINDS[kind];
      const spacing = FLORA_SPACING[name];
      const reach = REACH[name] ?? 260;
      const grid = Math.min(this.quality.maxGrid, Math.max(16, Math.round((reach * 2) / spacing)));
      add(kind, grid, spacing, SLOTS[i], this.meshes.get(name)!);
    });
    d.set('params', this.layers.length, meters, 10, ATLAS);
    this.backend.writeUniform(this.uniform, d.data);
  }

  /** The placement pass (before the terrain pass in the same frame). */
  place(planetUniform: UniformBuffer, planetTex: Texture) {
    if (!this.layers.length) return;
    const pass = this.backend.beginPass({
      color: [this.placeA, this.placeB],
      clearColor: null,
      label: 'flora placement',
    });
    pass.draw({
      pipeline: this.pipelines.place,
      uniforms: [planetUniform, this.uniform],
      textures: [planetTex],
      count: 6,
      instances: this.layers.length,
    });
    pass.end();
  }

  draw(pass: Pass, planetUniform: UniformBuffer, planetTex: Texture, shadows: Texture[]) {
    this.layers.forEach((layer, i) => {
      pass.draw({
        pipeline: this.pipelines.draw,
        uniforms: [planetUniform, this.uniform, this.drawUniforms[i]],
        textures: [this.placeA, this.placeB, planetTex, shadows[0], shadows[1]],
        vertexBuffers: [layer.vertices],
        count: layer.count,
        instances: layer.grid * layer.grid,
      });
    });
  }

  /** Plants into a shadow cascade; grass is too fine to matter. */
  drawShadow(pass: Pass, planetUniform: UniformBuffer, cascade: UniformBuffer) {
    this.layers.forEach((layer, i) => {
      if (layer.kind < 0) return;
      pass.draw({
        pipeline: this.pipelines.shadow,
        uniforms: [planetUniform, this.uniform, this.drawUniforms[i], cascade],
        textures: [this.placeA, this.placeB],
        vertexBuffers: [layer.vertices],
        count: layer.count,
        instances: layer.grid * layer.grid,
      });
    });
  }
}

function crossV(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function normalizeV(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
