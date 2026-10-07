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
  VertexFormat,
} from './backend';
import { newId } from './backend';
import type { UniformBlock } from './blocks';
import { bindingLayout, buildGlsl } from './shader';

type GL = WebGL2RenderingContext;

/** Shader source with line numbers, for compile error reports. */
const numbered = (src: string) =>
  src
    .split('\n')
    .map((l, i) => `${i + 1}: ${l}`)
    .join('\n');

interface GlTexture extends Texture {
  texture: WebGLTexture;
}
interface GlBuffer extends GpuBuffer {
  buffer: WebGLBuffer;
  kind: 'vertex' | 'index';
  indexType: number;
}
interface GlUniform extends UniformBuffer {
  buffer: WebGLBuffer;
}
interface GlPipeline extends Pipeline {
  program: WebGLProgram;
  units: { location: WebGLUniformLocation | null }[];
  vaos: Map<string, WebGLVertexArrayObject>;
}

const VERTEX_FORMATS: Record<VertexFormat, { size: number; type: number; normalized: boolean }> = {
  float32: { size: 1, type: 0x1406, normalized: false },
  float32x2: { size: 2, type: 0x1406, normalized: false },
  float32x3: { size: 3, type: 0x1406, normalized: false },
  float32x4: { size: 4, type: 0x1406, normalized: false },
  unorm8x4: { size: 4, type: 0x1401, normalized: true },
};

export class WebGlBackend implements Backend {
  readonly kind = 'webgl2' as const;
  lost = false;
  readonly floatTargets: boolean;
  readonly floatBlend: boolean;
  /** Per-attachment blend state (OES_draw_buffers_indexed), when available. */
  private indexed: {
    enableiOES(target: number, index: number): void;
    disableiOES(target: number, index: number): void;
    blendFunciOES(buf: number, src: number, dst: number): void;
    blendFuncSeparateiOES(
      buf: number,
      srcRGB: number,
      dstRGB: number,
      srcA: number,
      dstA: number,
    ): void;
  } | null;
  private parallel: { COMPLETION_STATUS_KHR: number } | null;
  private framebuffers = new Map<string, WebGLFramebuffer>();
  private width = 1;
  private height = 1;
  private fenceQueue: WebGLSync[] = [];

  private constructor(
    private readonly gl: GL,
    private readonly canvas: OffscreenCanvas | HTMLCanvasElement,
    readonly adapterInfo: string,
    readonly software: boolean,
  ) {
    this.floatTargets = Boolean(gl.getExtension('EXT_color_buffer_float'));
    gl.getExtension('EXT_color_buffer_half_float');
    this.indexed = gl.getExtension('OES_draw_buffers_indexed');
    // Blending into a 32-bit float attachment needs EXT_float_blend, unless
    // blending can be switched off for that attachment alone.
    this.floatBlend = Boolean(gl.getExtension('EXT_float_blend')) || Boolean(this.indexed);
    this.parallel = gl.getExtension('KHR_parallel_shader_compile');
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  static create(
    canvas: OffscreenCanvas | HTMLCanvasElement,
    onLost: (reason: string) => void,
  ): WebGlBackend {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    }) as GL | null;
    if (!gl) throw new Error('WebGL2 is unavailable');
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const info = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'WebGL2';
    const software = /swiftshader|llvmpipe|software|basic render|softpipe/i.test(info);
    const backend = new WebGlBackend(gl, canvas, info, software);
    canvas.addEventListener('webglcontextlost', ((event: Event) => {
      event.preventDefault();
      backend.lost = true;
      onLost('WebGL context lost');
    }) as EventListener);
    return backend;
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
  }

  createTexture(desc: TextureDesc): Texture {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const formats = {
      rgba16float: [
        this.floatTargets || !desc.render ? gl.RGBA16F : gl.RGBA8,
        gl.RGBA,
        this.floatTargets || !desc.render ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
      ],
      rgba8unorm: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE],
      rgba32float: [gl.RGBA32F, gl.RGBA, gl.FLOAT],
      depth32float: [gl.DEPTH_COMPONENT32F, gl.DEPTH_COMPONENT, gl.FLOAT],
    }[desc.format];
    gl.texStorage2D(gl.TEXTURE_2D, 1, formats[0], desc.width, desc.height);
    const fetchOnly = desc.format === 'rgba32float' || desc.format === 'depth32float';
    const filter = !fetchOnly && desc.filter !== 'nearest' ? gl.LINEAR : gl.NEAREST;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    const wrap = desc.wrap === 'repeat' ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    const handle: GlTexture = {
      id: newId(),
      width: desc.width,
      height: desc.height,
      format: desc.format,
      texture,
    };
    return handle;
  }

  writeTexture(texture: Texture, data: ArrayBufferView) {
    const gl = this.gl;
    const t = texture as GlTexture;
    gl.bindTexture(gl.TEXTURE_2D, t.texture);
    const type =
      t.format === 'rgba32float'
        ? gl.FLOAT
        : t.format === 'rgba16float'
          ? gl.HALF_FLOAT
          : gl.UNSIGNED_BYTE;
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, t.width, t.height, gl.RGBA, type, data);
  }

  destroyTexture(texture: Texture) {
    this.gl.deleteTexture((texture as GlTexture).texture);
    for (const [key, fb] of this.framebuffers) {
      if (key.split(/[|,]/).includes(String(texture.id))) {
        this.gl.deleteFramebuffer(fb);
        this.framebuffers.delete(key);
      }
    }
  }

  createBuffer(kind: 'vertex' | 'index', data: ArrayBufferView | number): GpuBuffer {
    const gl = this.gl;
    const buffer = gl.createBuffer()!;
    const target = kind === 'vertex' ? gl.ARRAY_BUFFER : gl.ELEMENT_ARRAY_BUFFER;
    gl.bindVertexArray(null);
    gl.bindBuffer(target, buffer);
    if (typeof data === 'number') gl.bufferData(target, data, gl.DYNAMIC_DRAW);
    else gl.bufferData(target, data, gl.STATIC_DRAW);
    const handle: GlBuffer = {
      id: newId(),
      size: typeof data === 'number' ? data : data.byteLength,
      buffer,
      kind,
      indexType: data instanceof Uint16Array ? gl.UNSIGNED_SHORT : gl.UNSIGNED_INT,
    };
    return handle;
  }

  writeBuffer(buffer: GpuBuffer, data: ArrayBufferView, byteOffset = 0) {
    const gl = this.gl;
    const b = buffer as GlBuffer;
    const target = b.kind === 'vertex' ? gl.ARRAY_BUFFER : gl.ELEMENT_ARRAY_BUFFER;
    gl.bindVertexArray(null);
    gl.bindBuffer(target, b.buffer);
    gl.bufferSubData(target, byteOffset, data);
  }

  destroyBuffer(buffer: GpuBuffer) {
    this.gl.deleteBuffer((buffer as GlBuffer).buffer);
  }

  createUniform(block: UniformBlock): UniformBuffer {
    const gl = this.gl;
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
    gl.bufferData(gl.UNIFORM_BUFFER, block.floats * 4, gl.DYNAMIC_DRAW);
    const handle: GlUniform = { id: newId(), block, buffer };
    return handle;
  }

  writeUniform(buffer: UniformBuffer, data: Float32Array) {
    const gl = this.gl;
    gl.bindBuffer(gl.UNIFORM_BUFFER, (buffer as GlUniform).buffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
  }

  private compile(type: number, source: string) {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  async createPipeline(desc: PipelineDesc): Promise<Pipeline> {
    const gl = this.gl;
    const { vertex, fragment } = buildGlsl(desc);
    const vs = this.compile(gl.VERTEX_SHADER, vertex);
    const fs = this.compile(gl.FRAGMENT_SHADER, fragment);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    let location = 0;
    for (const layout of desc.vertexBuffers ?? []) {
      for (const a of layout.attributes) gl.bindAttribLocation(program, location++, `a_${a.name}`);
    }
    gl.linkProgram(program);
    // Poll the driver instead of blocking the thread on a synchronous status query.
    if (this.parallel) {
      const status = this.parallel.COMPLETION_STATUS_KHR;
      // A lost context never reports completion: stop polling instead.
      while (!gl.isContextLost() && !gl.getProgramParameter(program, status)) {
        // oxlint-disable-next-line no-await-in-loop -- polling one program, nothing to parallelise
        await new Promise((resolve) => setTimeout(resolve, 4));
      }
    }
    // A lost context fails every link with an empty log: say so plainly.
    if (gl.isContextLost()) throw new Error(`${desc.label}: WebGL context lost`);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = [gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs), gl.getProgramInfoLog(program)]
        .filter(Boolean)
        .join('\n');
      throw new Error(
        `${desc.label}: ${log}\n--- vertex\n${numbered(vertex)}\n--- fragment\n${numbered(fragment)}`,
      );
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    const { uniforms, textures } = bindingLayout(desc);
    gl.useProgram(program);
    for (const u of uniforms) {
      const index = gl.getUniformBlockIndex(program, `${u.block.name}Block`);
      if (index !== gl.INVALID_INDEX) gl.uniformBlockBinding(program, index, u.binding);
    }
    const units = textures.map((t, unit) => {
      const location = gl.getUniformLocation(program, t.name);
      if (location) gl.uniform1i(location, unit);
      return { location };
    });
    const handle: GlPipeline = { id: newId(), desc, program, units, vaos: new Map() };
    return handle;
  }

  private vao(p: GlPipeline, command: DrawCommand) {
    const gl = this.gl;
    const buffers = (command.vertexBuffers ?? []) as GlBuffer[];
    const key = `${buffers.map((b) => b.id).join(',')}|${command.indexBuffer?.id ?? 0}`;
    let vao = p.vaos.get(key);
    if (!vao) {
      vao = gl.createVertexArray()!;
      gl.bindVertexArray(vao);
      let location = 0;
      (p.desc.vertexBuffers ?? []).forEach((layout, i) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers[i].buffer);
        for (const a of layout.attributes) {
          const f = VERTEX_FORMATS[a.format];
          gl.enableVertexAttribArray(location);
          gl.vertexAttribPointer(location, f.size, f.type, f.normalized, layout.stride, a.offset);
          gl.vertexAttribDivisor(location, layout.step === 'instance' ? 1 : 0);
          location++;
        }
      });
      if (command.indexBuffer)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, (command.indexBuffer as GlBuffer).buffer);
      p.vaos.set(key, vao);
    }
    return vao;
  }

  private framebuffer(desc: PassDesc) {
    const gl = this.gl;
    if (desc.color.length === 1 && desc.color[0] === 'canvas' && !desc.depth) return null;
    const colors = desc.color as GlTexture[];
    const key = `${colors.map((c) => c.id).join(',')}|${desc.depth?.id ?? 0}`;
    let fb = this.framebuffers.get(key);
    if (!fb) {
      fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      colors.forEach((c, i) =>
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.COLOR_ATTACHMENT0 + i,
          gl.TEXTURE_2D,
          c.texture,
          0,
        ),
      );
      if (desc.depth) {
        gl.framebufferTexture2D(
          gl.FRAMEBUFFER,
          gl.DEPTH_ATTACHMENT,
          gl.TEXTURE_2D,
          (desc.depth as GlTexture).texture,
          0,
        );
      }
      gl.drawBuffers(colors.length ? colors.map((_, i) => gl.COLOR_ATTACHMENT0 + i) : [gl.NONE]);
      this.framebuffers.set(key, fb);
    }
    return fb;
  }

  private blendFactors(mode: BlendMode): [number, number, number, number] {
    const gl = this.gl;
    if (mode === 'add') return [gl.ONE, gl.ONE, gl.ONE, gl.ONE];
    if (mode === 'premultiplied') {
      return [gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
    }
    return [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
  }

  /**
   * Blend state for a pipeline's outputs. With per-attachment control each
   * output gets its own (so a 32-bit float attachment is never blended);
   * otherwise the first output's mode applies to all of them.
   */
  private blend(outputs: PipelineDesc['outputs']) {
    const gl = this.gl;
    const ext = this.indexed;
    if (ext && outputs.length > 1) {
      outputs.forEach((out, i) => {
        const mode = out.blend;
        if (!mode || mode === 'none' || out.format === 'rgba32float') {
          ext.disableiOES(gl.BLEND, i);
          return;
        }
        ext.enableiOES(gl.BLEND, i);
        const [src, dst, srcA, dstA] = this.blendFactors(mode);
        ext.blendFuncSeparateiOES(i, src, dst, srcA, dstA);
      });
      return;
    }
    const mode = outputs[0]?.blend;
    if (!mode || mode === 'none') {
      gl.disable(gl.BLEND);
      return;
    }
    gl.enable(gl.BLEND);
    const [src, dst, srcA, dstA] = this.blendFactors(mode);
    gl.blendFuncSeparate(src, dst, srcA, dstA);
  }

  beginFrame() {}

  beginPass(desc: PassDesc): Pass {
    const gl = this.gl;
    const fb = this.framebuffer(desc);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const target = desc.color[0] ?? desc.depth!;
    const width = target === 'canvas' ? this.width : (target as Texture).width;
    const height = target === 'canvas' ? this.height : (target as Texture).height;
    gl.viewport(0, 0, width, height);
    let mask = 0;
    if (desc.clearColor) {
      gl.colorMask(true, true, true, true);
      gl.clearColor(...desc.clearColor);
      mask |= gl.COLOR_BUFFER_BIT;
    }
    if (desc.depth && desc.clearDepth != null) {
      gl.depthMask(true);
      gl.clearDepth(desc.clearDepth);
      mask |= gl.DEPTH_BUFFER_BIT;
    }
    if (mask) {
      gl.disable(gl.SCISSOR_TEST);
      gl.clear(mask);
    }
    const hasDepth = Boolean(desc.depth);
    return {
      draw: (command: DrawCommand) => {
        const p = command.pipeline as GlPipeline;
        const d = p.desc;
        gl.useProgram(p.program);
        this.blend(d.outputs);
        if (hasDepth && d.depth) {
          gl.enable(gl.DEPTH_TEST);
          gl.depthMask(d.depth.write);
          gl.depthFunc(
            { less: gl.LESS, 'less-equal': gl.LEQUAL, greater: gl.GREATER, always: gl.ALWAYS }[
              d.depth.compare
            ],
          );
        } else {
          gl.disable(gl.DEPTH_TEST);
          gl.depthMask(false);
        }
        if (d.cull && d.cull !== 'none') {
          gl.enable(gl.CULL_FACE);
          gl.cullFace(d.cull === 'back' ? gl.BACK : gl.FRONT);
        } else gl.disable(gl.CULL_FACE);
        command.uniforms.forEach((u, i) =>
          gl.bindBufferBase(gl.UNIFORM_BUFFER, i, (u as GlUniform).buffer),
        );
        (command.textures ?? []).forEach((t, unit) => {
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, (t as GlTexture).texture);
        });
        gl.bindVertexArray(this.vao(p, command));
        const mode = d.topology === 'triangle-strip' ? gl.TRIANGLE_STRIP : gl.TRIANGLES;
        const instances = command.instances ?? 1;
        if (command.indexBuffer) {
          const type = (command.indexBuffer as GlBuffer).indexType;
          gl.drawElementsInstanced(mode, command.count, type, 0, instances);
        } else {
          gl.drawArraysInstanced(mode, 0, command.count, instances);
        }
        gl.bindVertexArray(null);
      },
      end: () => {},
    };
  }

  endFrame() {
    const gl = this.gl;
    gl.flush();
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (fence) this.fenceQueue.push(fence);
  }

  canRender() {
    const gl = this.gl;
    while (this.fenceQueue.length) {
      const status = gl.getSyncParameter(this.fenceQueue[0], gl.SYNC_STATUS);
      if (status !== gl.SIGNALED) break;
      gl.deleteSync(this.fenceQueue.shift()!);
    }
    return this.fenceQueue.length < 2 && !this.lost;
  }

  destroy() {
    for (const fb of this.framebuffers.values()) this.gl.deleteFramebuffer(fb);
    this.framebuffers.clear();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
