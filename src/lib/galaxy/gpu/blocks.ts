import { d } from 'typegpu';

/**
 * Uniform blocks are declared once here. A block only contains `vec4f`,
 * `mat4x4f` and `vec4f` arrays, so the WGSL uniform layout and GLSL std140
 * are byte-identical and one Float32Array feeds both backends.
 */
export type BlockField = 'vec4' | 'mat4' | readonly ['vec4', number];
export type BlockFields = Record<string, BlockField>;
type BlockSchemaField = d.Vec4f | d.Mat4x4f | d.WgslArray<d.Vec4f>;

export interface UniformBlock<F extends BlockFields = BlockFields> {
  readonly name: string;
  readonly fields: F;
  /** Float offset of each field inside the block. */
  readonly offsets: { readonly [K in keyof F]: number };
  readonly floats: number;
  /** The TypeGPU schema; `tgpu.resolve` emits the WGSL struct from it. */
  readonly schema: d.WgslStruct<Record<string, BlockSchemaField>>;
  /** `layout(std140) uniform …` body for the WebGL2 backend. */
  glslBlock(instance: string): string;
}

const fieldSize = (field: BlockField) =>
  field === 'vec4' ? 4 : field === 'mat4' ? 16 : field[1] * 4;

export function uniformBlock<F extends BlockFields>(name: string, fields: F): UniformBlock<F> {
  const offsets = {} as Record<string, number>;
  const props: Record<string, BlockSchemaField> = {};
  let floats = 0;
  for (const [key, field] of Object.entries(fields)) {
    offsets[key] = floats;
    floats += fieldSize(field);
    props[key] =
      field === 'vec4' ? d.vec4f : field === 'mat4' ? d.mat4x4f : d.arrayOf(d.vec4f, field[1]);
  }
  const schema = d.struct(props).$name(name);
  return {
    name,
    fields,
    offsets: offsets as UniformBlock<F>['offsets'],
    floats,
    schema,
    glslBlock(instance: string) {
      const body = Object.entries(fields)
        .map(([key, field]) =>
          field === 'vec4'
            ? `  vec4 ${key};`
            : field === 'mat4'
              ? `  mat4 ${key};`
              : `  vec4 ${key}[${field[1]}];`,
        )
        .join('\n');
      return `layout(std140) uniform ${name}Block {\n${body}\n} ${instance};`;
    },
  };
}

/** A CPU-side mirror of a block with named setters. */
export class BlockData<F extends BlockFields = BlockFields> {
  readonly data: Float32Array;
  constructor(readonly block: UniformBlock<F>) {
    this.data = new Float32Array(block.floats);
  }
  set(field: keyof F & string, x: number, y = 0, z = 0, w = 0) {
    const o = this.block.offsets[field];
    const a = this.data;
    a[o] = x;
    a[o + 1] = y;
    a[o + 2] = z;
    a[o + 3] = w;
    return this;
  }
  vec(field: keyof F & string, v: ArrayLike<number>, w?: number) {
    const o = this.block.offsets[field];
    for (let i = 0; i < v.length && i < 4; i++) this.data[o + i] = v[i];
    if (w !== undefined) this.data[o + 3] = w;
    return this;
  }
  /** Write element `index` of a `vec4` array field. */
  item(field: keyof F & string, index: number, x: number, y = 0, z = 0, w = 0) {
    const o = this.block.offsets[field] + index * 4;
    const a = this.data;
    a[o] = x;
    a[o + 1] = y;
    a[o + 2] = z;
    a[o + 3] = w;
    return this;
  }
  mat(field: keyof F & string, m: ArrayLike<number>) {
    this.data.set(m, this.block.offsets[field]);
    return this;
  }
}
