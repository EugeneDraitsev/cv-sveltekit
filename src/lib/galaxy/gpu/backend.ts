import type { UniformBlock } from './blocks';

/**
 * The renderer talks to the GPU through this deliberately small interface.
 * Two implementations exist: WebGPU (through TypeGPU) and a WebGL2 fallback.
 * Both execute the same shader source; see `shader.ts` for how a pipeline's
 * dialect code becomes WGSL or GLSL.
 */

export type TextureFormat = 'rgba16float' | 'rgba8unorm' | 'rgba32float' | 'depth32float';
export type ColorFormat = 'rgba16float' | 'rgba8unorm' | 'rgba32float' | 'canvas';
export type BlendMode = 'none' | 'add' | 'premultiplied' | 'alpha';
export type DepthCompare = 'less' | 'less-equal' | 'greater' | 'always';

export interface TextureDesc {
  width: number;
  height: number;
  format: TextureFormat;
  /** Linear filtering (ignored for rgba32float and depth, which are fetch-only). */
  filter?: 'linear' | 'nearest';
  wrap?: 'clamp' | 'repeat';
  /** The texture is rendered into. */
  render?: boolean;
  label?: string;
}

export interface Texture {
  readonly id: number;
  readonly width: number;
  readonly height: number;
  readonly format: TextureFormat;
}

export interface GpuBuffer {
  readonly id: number;
  readonly size: number;
}

export interface UniformBuffer {
  readonly id: number;
  readonly block: UniformBlock;
}

export type VertexFormat = 'float32' | 'float32x2' | 'float32x3' | 'float32x4' | 'unorm8x4';

export interface VertexAttribute {
  name: string;
  format: VertexFormat;
  offset: number;
}

export interface VertexBufferLayout {
  stride: number;
  step: 'vertex' | 'instance';
  attributes: VertexAttribute[];
}

export type VaryingType = 'f32' | 'vec2f' | 'vec3f' | 'vec4f' | 'u32' | 'i32';

export interface PipelineDesc {
  label: string;
  /**
   * Dialect source: helper functions plus `fn vs(vsIn: VertexIn) -> Varyings`
   * and `fn fs(fsIn: Varyings) -> FragOut`. The structs and bindings are
   * generated from the rest of this descriptor.
   */
  code: string;
  uniforms: { name: string; block: UniformBlock }[];
  textures?: { name: string; kind?: 'float' | 'unfilterable' | 'depth' }[];
  vertexBuffers?: VertexBufferLayout[];
  varyings: { name: string; type: VaryingType; flat?: boolean }[];
  outputs: { format: ColorFormat; blend?: BlendMode }[];
  /** `FragOut.depth` is written as the fragment depth. */
  fragDepth?: boolean;
  depth?: { write: boolean; compare: DepthCompare };
  cull?: 'none' | 'back' | 'front';
  topology?: 'triangle-list' | 'triangle-strip';
}

export interface Pipeline {
  readonly id: number;
  readonly desc: PipelineDesc;
}

export interface DrawCommand {
  pipeline: Pipeline;
  uniforms: UniformBuffer[];
  textures?: Texture[];
  vertexBuffers?: GpuBuffer[];
  indexBuffer?: GpuBuffer;
  /** Vertex count, or index count when `indexBuffer` is set. */
  count: number;
  instances?: number;
  firstInstance?: number;
}

export interface PassDesc {
  color: (Texture | 'canvas')[];
  depth?: Texture;
  /** `null` keeps the previous contents. */
  clearColor?: readonly [number, number, number, number] | null;
  clearDepth?: number | null;
  label?: string;
}

export interface Pass {
  draw(command: DrawCommand): void;
  end(): void;
}

export interface Backend {
  readonly kind: 'webgpu' | 'webgl2';
  /** Human-readable adapter description, used for software-renderer detection. */
  readonly adapterInfo: string;
  readonly software: boolean;
  /** Whether the HDR targets really hold half floats (false on some WebGL2 devices). */
  readonly floatTargets: boolean;
  resize(width: number, height: number): void;
  createTexture(desc: TextureDesc): Texture;
  writeTexture(texture: Texture, data: ArrayBufferView): void;
  destroyTexture(texture: Texture): void;
  createBuffer(kind: 'vertex' | 'index', data: ArrayBufferView | number): GpuBuffer;
  writeBuffer(buffer: GpuBuffer, data: ArrayBufferView, byteOffset?: number): void;
  destroyBuffer(buffer: GpuBuffer): void;
  createUniform(block: UniformBlock): UniformBuffer;
  /** Upload a block's data. Call at most once per frame per buffer. */
  writeUniform(buffer: UniformBuffer, data: Float32Array): void;
  createPipeline(desc: PipelineDesc): Promise<Pipeline>;
  beginFrame(): void;
  beginPass(desc: PassDesc): Pass;
  endFrame(): void;
  /** No more than this many frames should be queued on the GPU. */
  canRender(): boolean;
  readonly lost: boolean;
  destroy(): void;
}

let nextId = 1;
export const newId = () => nextId++;
