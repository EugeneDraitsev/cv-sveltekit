import { tgpu, type TgpuRoot } from 'typegpu';
import type {
  Backend,
  BlendMode,
  DrawCommand,
  GpuBuffer,
  Pass,
  PassDesc,
  Pipeline,
  PipelineDesc,
  Texture,
  TextureDesc,
  UniformBuffer,
} from './backend';
import { newId } from './backend';
import type { UniformBlock } from './blocks';
import { bindingLayout, buildWgsl } from './shader';

interface WgpuTexture extends Texture {
  texture: GPUTexture;
  view: GPUTextureView;
  filter: 'linear' | 'nearest';
}
interface WgpuBuffer extends GpuBuffer {
  buffer: GPUBuffer;
}
interface WgpuUniform extends UniformBuffer {
  buffer: GPUBuffer;
}
interface WgpuPipeline extends Pipeline {
  pipeline: GPURenderPipeline;
  layout: GPUBindGroupLayout;
  indexFormats: Map<number, GPUIndexFormat>;
}

const BLENDS: Record<Exclude<BlendMode, 'none'>, GPUBlendState> = {
  add: {
    color: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'add' },
  },
  premultiplied: {
    color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  },
  alpha: {
    color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  },
};

export class WebGpuBackend implements Backend {
  readonly kind = 'webgpu' as const;
  lost = false;
  floatTargets = true;
  /** Blend state is per target in WebGPU; float32 targets are never blended. */
  floatBlend = true;
  private encoder: GPUCommandEncoder | null = null;
  private inFlight = 0;
  private samplers: GPUSampler[];
  private bindGroups = new Map<string, GPUBindGroup>();
  private indexFormat = new WeakMap<GpuBuffer, GPUIndexFormat>();
  private canvasFormat: GPUTextureFormat;

  private constructor(
    readonly root: TgpuRoot,
    readonly device: GPUDevice,
    private readonly context: GPUCanvasContext,
    private readonly canvas: OffscreenCanvas | HTMLCanvasElement,
    readonly adapterInfo: string,
    readonly software: boolean,
    onLost: (reason: string) => void,
  ) {
    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format: this.canvasFormat, alphaMode: 'opaque' });
    const sampler = (filter: GPUFilterMode, address: GPUAddressMode) =>
      device.createSampler({
        minFilter: filter,
        magFilter: filter,
        mipmapFilter: 'nearest',
        addressModeU: address,
        addressModeV: address,
      });
    this.samplers = [
      sampler('linear', 'clamp-to-edge'),
      sampler('nearest', 'clamp-to-edge'),
      sampler('linear', 'repeat'),
    ];
    device.lost.then((info) => {
      this.lost = true;
      if (info.reason !== 'destroyed') onLost(info.message);
    });
    device.addEventListener('uncapturederror', (event) => {
      onLost((event as GPUUncapturedErrorEvent).error.message);
    });
  }

  static async create(
    canvas: OffscreenCanvas | HTMLCanvasElement,
    onLost: (reason: string) => void,
  ): Promise<WebGpuBackend> {
    if (!navigator.gpu) throw new Error('WebGPU is unavailable');
    // TypeGPU owns the adapter and device; the renderer reaches the raw device
    // only for pipeline and pass recording.
    const root = await tgpu.init({ adapter: { powerPreference: 'high-performance' } });
    const device = root.device;
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) {
      root.destroy();
      throw new Error('Could not create a WebGPU canvas context');
    }
    let info = '';
    let software = false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      const ai = adapter?.info;
      info = [ai?.vendor, ai?.architecture, ai?.description].filter(Boolean).join(' ');
      software = Boolean(
        (ai as GPUAdapterInfo & { isFallbackAdapter?: boolean })?.isFallbackAdapter ||
        /swiftshader|llvmpipe|software|basic render/i.test(info),
      );
    } catch {
      // Adapter info is a hint only.
    }
    return new WebGpuBackend(root, device, context, canvas, info || 'WebGPU', software, onLost);
  }

  resize(width: number, height: number) {
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  createTexture(desc: TextureDesc): Texture {
    const format: GPUTextureFormat = desc.format;
    const texture = this.device.createTexture({
      label: desc.label,
      size: [desc.width, desc.height],
      format,
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.COPY_SRC |
        (desc.render ? GPUTextureUsage.RENDER_ATTACHMENT : 0),
    });
    const handle: WgpuTexture = {
      id: newId(),
      width: desc.width,
      height: desc.height,
      format: desc.format,
      texture,
      view: texture.createView(),
      filter: desc.filter ?? 'linear',
    };
    return handle;
  }

  writeTexture(texture: Texture, data: ArrayBufferView) {
    const t = texture as WgpuTexture;
    const bytesPerTexel = t.format === 'rgba32float' ? 16 : t.format === 'rgba16float' ? 8 : 4;
    this.device.queue.writeTexture(
      { texture: t.texture },
      data as GPUAllowSharedBufferSource,
      { bytesPerRow: t.width * bytesPerTexel, rowsPerImage: t.height },
      [t.width, t.height],
    );
  }

  destroyTexture(texture: Texture) {
    (texture as WgpuTexture).texture.destroy();
    this.bindGroups.clear();
  }

  createBuffer(kind: 'vertex' | 'index', data: ArrayBufferView | number): GpuBuffer {
    const size = typeof data === 'number' ? data : data.byteLength;
    const buffer = this.device.createBuffer({
      size: Math.max(16, Math.ceil(size / 4) * 4),
      usage:
        (kind === 'vertex' ? GPUBufferUsage.VERTEX : GPUBufferUsage.INDEX) |
        GPUBufferUsage.COPY_DST,
    });
    const handle: WgpuBuffer = { id: newId(), size, buffer };
    if (typeof data !== 'number') {
      this.writeBuffer(handle, data);
      if (kind === 'index')
        this.indexFormat.set(handle, data instanceof Uint16Array ? 'uint16' : 'uint32');
    }
    return handle;
  }

  writeBuffer(buffer: GpuBuffer, data: ArrayBufferView, byteOffset = 0) {
    const padded =
      data.byteLength % 4 === 0 ? data : new Uint8Array(Math.ceil(data.byteLength / 4) * 4);
    if (padded !== data)
      (padded as Uint8Array).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    this.device.queue.writeBuffer(
      (buffer as WgpuBuffer).buffer,
      byteOffset,
      padded.buffer as ArrayBuffer,
      padded.byteOffset,
      padded.byteLength,
    );
  }

  destroyBuffer(buffer: GpuBuffer) {
    (buffer as WgpuBuffer).buffer.destroy();
  }

  createUniform(block: UniformBlock): UniformBuffer {
    // The schema-typed TypeGPU buffer gives the exact uniform size and usage;
    // per-frame data is streamed into the raw buffer as a Float32Array.
    const typed = this.root.createBuffer(block.schema).$usage('uniform');
    const handle: WgpuUniform = { id: newId(), block, buffer: this.root.unwrap(typed) };
    return handle;
  }

  writeUniform(buffer: UniformBuffer, data: Float32Array) {
    this.device.queue.writeBuffer(
      (buffer as WgpuUniform).buffer,
      0,
      data.buffer as ArrayBuffer,
      data.byteOffset,
      data.byteLength,
    );
  }

  async createPipeline(desc: PipelineDesc): Promise<Pipeline> {
    const code = buildWgsl(desc);
    const module = this.device.createShaderModule({ label: desc.label, code });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((m) => m.type === 'error');
    if (errors.length) {
      throw new Error(
        `${desc.label}: ${errors.map((m) => `${m.lineNum}:${m.linePos} ${m.message}`).join('\n')}\n${code}`,
      );
    }
    const { uniforms, textures, samplerBase } = bindingLayout(desc);
    const visibility = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
    const layout = this.device.createBindGroupLayout({
      label: desc.label,
      entries: [
        ...uniforms.map((u) => ({
          binding: u.binding,
          visibility,
          buffer: { type: 'uniform' as const },
        })),
        ...textures.map((t) => ({
          binding: t.binding,
          visibility,
          texture:
            t.kind === 'depth'
              ? { sampleType: 'depth' as const }
              : {
                  sampleType:
                    t.kind === 'unfilterable'
                      ? ('unfilterable-float' as const)
                      : ('float' as const),
                },
        })),
        { binding: samplerBase, visibility, sampler: { type: 'filtering' as const } },
        { binding: samplerBase + 1, visibility, sampler: { type: 'filtering' as const } },
        { binding: samplerBase + 2, visibility, sampler: { type: 'filtering' as const } },
      ],
    });
    let location = 0;
    const buffers: GPUVertexBufferLayout[] = (desc.vertexBuffers ?? []).map((b) => ({
      arrayStride: b.stride,
      stepMode: b.step,
      attributes: b.attributes.map((a) => ({
        shaderLocation: location++,
        offset: a.offset,
        format: a.format as GPUVertexFormat,
      })),
    }));
    const pipeline = await this.device.createRenderPipelineAsync({
      label: desc.label,
      layout: this.device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      vertex: { module, entryPoint: 'vertexMain', buffers },
      fragment: !desc.outputs.length
        ? undefined
        : {
            module,
            entryPoint: 'fragmentMain',
            targets: desc.outputs.map((o) => ({
              format: o.format === 'canvas' ? this.canvasFormat : o.format,
              blend: o.blend && o.blend !== 'none' ? BLENDS[o.blend] : undefined,
            })),
          },
      primitive: {
        topology: desc.topology ?? 'triangle-list',
        cullMode: desc.cull ?? 'none',
      },
      depthStencil: desc.depth
        ? {
            format: 'depth32float',
            depthWriteEnabled: desc.depth.write,
            depthCompare: desc.depth.compare,
          }
        : undefined,
    });
    const handle: WgpuPipeline = { id: newId(), desc, pipeline, layout, indexFormats: new Map() };
    return handle;
  }

  beginFrame() {
    this.encoder = this.device.createCommandEncoder();
  }

  private bindGroup(p: WgpuPipeline, command: DrawCommand) {
    const textures = (command.textures ?? []) as WgpuTexture[];
    const key = `${p.id}|${command.uniforms.map((u) => u.id).join(',')}|${textures.map((t) => t.id).join(',')}`;
    let group = this.bindGroups.get(key);
    if (!group) {
      const { samplerBase } = bindingLayout(p.desc);
      const entries: GPUBindGroupEntry[] = [
        ...command.uniforms.map((u, i) => ({
          binding: i,
          resource: { buffer: (u as WgpuUniform).buffer },
        })),
        ...textures.map((t, i) => ({ binding: command.uniforms.length + i, resource: t.view })),
        { binding: samplerBase, resource: this.samplers[0] },
        { binding: samplerBase + 1, resource: this.samplers[1] },
        { binding: samplerBase + 2, resource: this.samplers[2] },
      ];
      group = this.device.createBindGroup({ layout: p.layout, entries });
      this.bindGroups.set(key, group);
    }
    return group;
  }

  beginPass(desc: PassDesc): Pass {
    if (!this.encoder) throw new Error('beginPass outside a frame');
    const canvasView = desc.color.includes('canvas')
      ? this.context.getCurrentTexture().createView()
      : null;
    const clear = desc.clearColor;
    const pass = this.encoder.beginRenderPass({
      label: desc.label,
      colorAttachments: desc.color.map((c) => ({
        view: c === 'canvas' ? canvasView! : (c as WgpuTexture).view,
        loadOp: clear ? 'clear' : 'load',
        storeOp: 'store',
        clearValue: clear ? { r: clear[0], g: clear[1], b: clear[2], a: clear[3] } : undefined,
      })),
      depthStencilAttachment: desc.depth
        ? {
            view: (desc.depth as WgpuTexture).view,
            depthLoadOp: desc.clearDepth != null ? 'clear' : 'load',
            depthStoreOp: 'store',
            depthClearValue: desc.clearDepth ?? 1,
          }
        : undefined,
    });
    let current: WgpuPipeline | null = null;
    return {
      draw: (command: DrawCommand) => {
        const p = command.pipeline as WgpuPipeline;
        if (current !== p) {
          pass.setPipeline(p.pipeline);
          current = p;
        }
        pass.setBindGroup(0, this.bindGroup(p, command));
        (command.vertexBuffers ?? []).forEach((b, i) =>
          pass.setVertexBuffer(i, (b as WgpuBuffer).buffer),
        );
        if (command.indexBuffer) {
          pass.setIndexBuffer(
            (command.indexBuffer as WgpuBuffer).buffer,
            this.indexFormat.get(command.indexBuffer) ?? 'uint32',
          );
          pass.drawIndexed(command.count, command.instances ?? 1, 0, 0, command.firstInstance ?? 0);
        } else {
          pass.draw(command.count, command.instances ?? 1, 0, command.firstInstance ?? 0);
        }
      },
      end: () => pass.end(),
    };
  }

  endFrame() {
    if (!this.encoder) return;
    this.device.queue.submit([this.encoder.finish()]);
    this.encoder = null;
    this.inFlight++;
    this.device.queue.onSubmittedWorkDone().then(
      () => this.inFlight--,
      () => this.inFlight--,
    );
  }

  canRender() {
    return this.inFlight < 2 && !this.lost;
  }

  /** Debug readback of an rgba32float texture region. */
  async readTexture(texture: Texture, x: number, y: number, width: number, height: number) {
    const t = texture as WgpuTexture;
    const bytesPerRow = Math.ceil((width * 16) / 256) * 256;
    const buffer = this.device.createBuffer({
      size: bytesPerRow * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });
    const encoder = this.device.createCommandEncoder();
    encoder.copyTextureToBuffer({ texture: t.texture, origin: [x, y] }, { buffer, bytesPerRow }, [
      width,
      height,
    ]);
    this.device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    const raw = new Float32Array(buffer.getMappedRange().slice(0));
    buffer.destroy();
    const out = new Float32Array(width * height * 4);
    for (let row = 0; row < height; row++)
      out.set(
        raw.subarray((row * bytesPerRow) / 4, (row * bytesPerRow) / 4 + width * 4),
        row * width * 4,
      );
    return out;
  }

  destroy() {
    this.bindGroups.clear();
    try {
      this.context.unconfigure();
    } catch {
      // The context may already be gone with the device.
    }
    this.root.destroy();
  }
}
