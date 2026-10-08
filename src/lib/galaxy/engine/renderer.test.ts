import { describe, expect, it } from 'vitest';
import type { Backend, TextureDesc } from '../gpu/backend';
import { pickQuality } from './quality';
import { Renderer } from './renderer';

/** A backend that only keeps track of the textures and buffers still alive. */
function countingBackend() {
  const live = new Set<object>();
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
    beginPass: () => ({ draw() {}, end() {} }),
    endFrame() {},
    canRender: () => true,
    destroy() {},
  };
  return { backend, live };
}

const quality = pickQuality({ compact: false, touch: false, cores: 8, memory: 8, software: false });

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
