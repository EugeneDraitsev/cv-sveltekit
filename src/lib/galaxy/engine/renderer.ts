import type { Backend, GpuBuffer, Pipeline, Texture, UniformBuffer } from '../gpu/backend';
import { BlockData } from '../gpu/blocks';
import { GalaxyBlock, PostBlock, SystemBlock } from './blocks';
import {
  bakeVolumeProgram,
  bloomProgram,
  compositeProgram,
  galaxySkyProgram,
  galaxyStarsProgram,
  skyStarsProgram,
  systemProgram,
  systemStarsProgram,
} from './programs';
import type { Quality } from './quality';
import { PLANET_TEX_ROWS, PLANET_TEX_WIDTH } from '../world/pack';
import { PlanetLayer, type PlanetView } from './planetLayer';
import type { PlanetBlock } from './blocks';
import type { PlanetData } from '../world/system';

export interface FrameDesc {
  galaxy: BlockData<typeof GalaxyBlock.fields>;
  /** Draw the volume / galaxy stars / sky stars / markers. */
  volume: boolean;
  galaxyStars: boolean;
  skyStars: boolean;
  markers: boolean;
  system: BlockData<typeof SystemBlock.fields> | null;
  post: BlockData<typeof PostBlock.fields>;
  planet: {
    data: BlockData<typeof PlanetBlock.fields>;
    view: PlanetView;
    budget: number;
    info: PlanetData;
    now: number;
    /** Surface renderer weight (0: only the orbital sphere shows). */
    mix: number;
  } | null;
}

/**
 * Owns GPU resources and records each frame: galaxy volume, star layers,
 * the analytic star system, bloom and the final grade.
 */
export class Renderer {
  width = 0;
  height = 0;
  private hdr!: Texture;
  private blooms: Texture[] = [];
  private volume!: Texture;
  private planetTex: Texture;
  private pipelines!: Record<
    'galaxy' | 'stars' | 'systems' | 'sky' | 'system' | 'bloom' | 'composite',
    Pipeline
  >;
  private galaxyUniform: UniformBuffer;
  private systemUniform: UniformBuffer;
  private postUniform: UniformBuffer;
  private markerBuffer: GpuBuffer | null = null;
  private markerCount = 0;
  planet: PlanetLayer | null = null;
  private planetLoad: Promise<PlanetLayer> | null = null;
  readonly volumeDims: [number, number, number, number];
  readonly atlasSize: [number, number];

  constructor(
    readonly backend: Backend,
    private quality: Quality,
  ) {
    this.galaxyUniform = backend.createUniform(GalaxyBlock);
    this.systemUniform = backend.createUniform(SystemBlock);
    this.postUniform = backend.createUniform(PostBlock);
    const [vx, vy, vz] = quality.volume;
    const cols = Math.ceil(Math.sqrt(vy * (vz / vx)));
    this.volumeDims = [vx, vy, vz, cols];
    this.atlasSize = [vx * cols, vz * Math.ceil(vy / cols)];
    this.planetTex = backend.createTexture({
      width: PLANET_TEX_WIDTH,
      height: PLANET_TEX_ROWS,
      format: 'rgba32float',
      label: 'planet data',
    });
  }

  async init() {
    const b = this.backend;
    const [bake, galaxy, stars, systems, sky, system, bloom, composite] = await Promise.all([
      b.createPipeline(bakeVolumeProgram()),
      b.createPipeline(galaxySkyProgram()),
      b.createPipeline(galaxyStarsProgram()),
      b.createPipeline(systemStarsProgram()),
      b.createPipeline(skyStarsProgram()),
      b.createPipeline(systemProgram()),
      b.createPipeline(bloomProgram()),
      b.createPipeline(compositeProgram()),
    ]);
    this.pipelines = { galaxy, stars, systems, sky, system, bloom, composite };
    this.volume = b.createTexture({
      width: this.atlasSize[0],
      height: this.atlasSize[1],
      format: 'rgba16float',
      render: true,
      label: 'galaxy volume atlas',
    });
    // Bake the field once; it never changes afterwards.
    const data = new BlockData(GalaxyBlock);
    data.vec('volume', this.volumeDims).set('atlas', this.atlasSize[0], this.atlasSize[1], 1, 1);
    b.writeUniform(this.galaxyUniform, data.data);
    b.beginFrame();
    const pass = b.beginPass({
      color: [this.volume],
      clearColor: [0, 0, 0, 0],
      label: 'bake volume',
    });
    pass.draw({ pipeline: bake, uniforms: [this.galaxyUniform], count: 3 });
    pass.end();
    b.endFrame();
  }

  /**
   * Planet surfaces render into 32-bit float targets (patch atlas, plant
   * placement, distances), and blended passes also write those distances:
   * WebGL2 needs EXT_color_buffer_float and float blending (or per-attachment
   * blend state) for that.
   */
  get surfaceSupported() {
    return this.backend.floatTargets && this.backend.floatBlend;
  }

  /** Compile the planet pipelines (in the background, before any landing). */
  ensurePlanet() {
    this.planetLoad ??= (async () => {
      if (!this.surfaceSupported) throw new Error('Planet surfaces need float render targets');
      const layer = new PlanetLayer(this.backend, this.quality);
      await layer.init();
      layer.resize(this.width, this.height);
      this.planet = layer;
      return layer;
    })();
    return this.planetLoad;
  }

  resize(width: number, height: number) {
    this.planet?.resize(width, height);
    if (width === this.width && height === this.height) return;
    const b = this.backend;
    this.width = width;
    this.height = height;
    b.resize(width, height);
    if (this.hdr) b.destroyTexture(this.hdr);
    for (const t of this.blooms) b.destroyTexture(t);
    this.hdr = b.createTexture({
      width,
      height,
      format: 'rgba16float',
      render: true,
      label: 'hdr',
    });
    this.blooms = [];
    let w = width;
    let h = height;
    for (let i = 0; i < 4; i++) {
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
      this.blooms.push(
        b.createTexture({ width: w, height: h, format: 'rgba16float', render: true }),
      );
    }
  }

  /** Instance data for the explorable systems: 12 floats per system. */
  setMarkers(data: Float32Array) {
    const b = this.backend;
    if (!this.markerBuffer || this.markerBuffer.size < data.byteLength) {
      if (this.markerBuffer) b.destroyBuffer(this.markerBuffer);
      this.markerBuffer = b.createBuffer('vertex', data.byteLength);
    }
    b.writeBuffer(this.markerBuffer, data);
    this.markerCount = data.length / 12;
  }

  /** Upload a packed star system (see world/pack.ts). */
  setPlanetData(data: Float32Array) {
    this.backend.writeTexture(this.planetTex, data);
  }

  render(frame: FrameDesc) {
    const b = this.backend;
    b.writeUniform(this.galaxyUniform, frame.galaxy.data);
    b.writeUniform(this.postUniform, frame.post.data);
    if (frame.system) b.writeUniform(this.systemUniform, frame.system.data);

    const p = this.pipelines;
    b.beginFrame();
    const scene = b.beginPass({ color: [this.hdr], clearColor: [0, 0, 0, 1], label: 'scene' });
    if (frame.volume) {
      scene.draw({
        pipeline: p.galaxy,
        uniforms: [this.galaxyUniform],
        textures: [this.volume],
        count: 3,
      });
    }
    if (frame.skyStars) {
      scene.draw({
        pipeline: p.sky,
        uniforms: [this.galaxyUniform],
        count: 6,
        instances: this.quality.skyStars,
      });
    }
    if (frame.galaxyStars) {
      scene.draw({
        pipeline: p.stars,
        uniforms: [this.galaxyUniform],
        textures: [this.volume],
        count: 6,
        instances: this.quality.stars,
      });
    }
    if (frame.markers && this.markerBuffer && this.markerCount) {
      scene.draw({
        pipeline: p.systems,
        uniforms: [this.galaxyUniform],
        textures: [this.volume],
        vertexBuffers: [this.markerBuffer],
        count: 6,
        instances: this.markerCount,
      });
    }
    if (frame.system) {
      scene.draw({
        pipeline: p.system,
        uniforms: [this.systemUniform],
        textures: [this.planetTex],
        count: 3,
      });
    }
    scene.end();

    let source = this.hdr;
    const planet = frame.planet && this.planet ? this.planet : null;
    if (planet && frame.planet) {
      planet.update(frame.planet.view, frame.planet.budget, frame.planet.info, frame.planet.now);
      planet.writeUniform(frame.planet.data, frame.planet.view.eye, frame.planet.info.meters);
      // Patches keep streaming in while the orbital sphere stands in, so the
      // surface is ready when the view hands over to it.
      planet.build(this.planetTex);
      if (frame.planet.mix > 0) {
        planet.placeFlora(this.planetTex);
        planet.drawShadows(this.planetTex);
        planet.clearDistance();
        planet.drawTerrain(this.hdr, this.planetTex);
        planet.drawAtmosphere(this.hdr, this.planetTex);
        source = planet.output!;
      }
    }
    const graded = source;
    for (const target of this.blooms) {
      const pass = b.beginPass({ color: [target], clearColor: [0, 0, 0, 1], label: 'bloom' });
      pass.draw({ pipeline: p.bloom, uniforms: [this.postUniform], textures: [source], count: 3 });
      pass.end();
      source = target;
    }
    const out = b.beginPass({ color: ['canvas'], clearColor: [0, 0, 0, 1], label: 'composite' });
    out.draw({
      pipeline: p.composite,
      uniforms: [this.postUniform],
      textures: [graded, ...this.blooms],
      count: 3,
    });
    out.end();
    b.endFrame();
  }

  destroy() {
    this.backend.destroy();
  }
}
