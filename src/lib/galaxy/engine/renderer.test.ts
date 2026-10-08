import { describe, expect, it } from 'vitest';
import type { Backend, TextureDesc } from '../gpu/backend';
import { BlockData } from '../gpu/blocks';
import { PlanetBlock } from './blocks';
import type { Vec3 } from './math';
import { PlanetLayer } from './planetLayer';
import { pickQuality } from './quality';
import { Renderer } from './renderer';

/**
 * A backend that only keeps track of the textures and buffers still alive
 * and of the passes recorded.
 */
function countingBackend() {
  const live = new Set<object>();
  const passes: string[] = [];
  let id = 0;
  const make = <T extends object>(fields: T) => {
    const resource = { id: ++id, ...fields };
    live.add(resource);
    return resource;
  };
  const backend: Backend = {
    kind: 'webgpu',
    adapterInfo: 'test',
    software: false,
    floatTargets: true,
    floatBlend: true,
    lost: false,
    resize() {},
    createTexture: (desc: TextureDesc) =>
      make({ width: desc.width, height: desc.height, format: desc.format }),
    writeTexture() {},
    destroyTexture: (texture) => void live.delete(texture),
    createBuffer: (_kind, data) =>
      make({ size: typeof data === 'number' ? data : data.byteLength }),
    writeBuffer() {},
    destroyBuffer: (buffer) => void live.delete(buffer),
    createUniform: () => ({ id: ++id }) as ReturnType<Backend['createUniform']>,
    writeUniform() {},
    createPipeline: async () => ({ id: ++id }) as Awaited<ReturnType<Backend['createPipeline']>>,
    beginFrame() {},
    beginPass: (desc) => {
      passes.push(desc.label ?? '');
      return { draw() {}, end() {} };
    },
    endFrame() {},
    canRender: () => true,
    destroy() {},
  };
  return { backend, live, passes };
}

const quality = pickQuality({ compact: false, touch: false, cores: 8, memory: 8, software: false });
const lowQuality = pickQuality({ compact: true, touch: true, cores: 2, memory: 2, software: true });

describe('Renderer planet layer', () => {
  it('frees a planet layer whose pipelines failed to compile', async () => {
    const { backend, live } = countingBackend();
    const renderer = new Renderer(backend, quality);
    const before = live.size;
    backend.createPipeline = () => Promise.reject(new Error('driver said no'));
    await expect(renderer.ensurePlanet()).rejects.toThrow('driver said no');
    expect(renderer.planet).toBeNull();
    expect(live.size).toBe(before);
  });

  it('frees everything a planet layer allocated', async () => {
    const { backend, live } = countingBackend();
    const renderer = new Renderer(backend, quality);
    const before = live.size;
    const layer = await renderer.ensurePlanet();
    layer.resize(64, 32);
    expect(live.size).toBeGreaterThan(before);
    layer.destroy();
    expect(live.size).toBe(before);
  });
});

describe('PlanetLayer shadows', () => {
  /** Shadow passes recorded for one frame with the sun along `sun`. */
  function shadowPasses(q: typeof quality, sun: Vec3, altitude: number) {
    const { backend, passes } = countingBackend();
    const layer = new PlanetLayer(backend, q);
    const data = new BlockData(PlanetBlock).vec('sun0', sun, 0);
    layer.writeUniform(data, [0, 1 + altitude, 0], 6_000_000);
    layer.drawShadows(backend.createTexture({ width: 1, height: 1, format: 'rgba32float' }));
    return passes.filter((label) => label.startsWith('shadow')).length;
  }

  it('renders both cascades by day near the ground', () => {
    expect(shadowPasses(quality, [0, 1, 0], 0.001)).toBe(2);
  });

  it('skips the cascades while the shaders ignore them', () => {
    expect(lowQuality.name).toBe('low');
    expect(shadowPasses(lowQuality, [0, 1, 0], 0.001)).toBe(0);
    // Night: the sun is below the horizon.
    expect(shadowPasses(quality, [0, -1, 0], 0.001)).toBe(0);
    // Too high above the ground for the cascades to cover anything.
    expect(shadowPasses(quality, [0, 1, 0], 0.2)).toBe(0);
  });
});
