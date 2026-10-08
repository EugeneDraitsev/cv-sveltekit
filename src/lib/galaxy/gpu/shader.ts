import { tgpu } from 'typegpu';
import type { PipelineDesc, VertexFormat, VaryingType } from './backend';
import { GLSL_PRELUDE, glslType, wgslToGlsl } from './wgsl-glsl';

const ATTRIBUTE_TYPES: Record<VertexFormat, string> = {
  float32: 'f32',
  float32x2: 'vec2f',
  float32x3: 'vec3f',
  float32x4: 'vec4f',
  unorm8x4: 'vec4f',
};

function attributes(desc: PipelineDesc) {
  const list: { name: string; type: string; location: number }[] = [];
  let location = 0;
  for (const layout of desc.vertexBuffers ?? []) {
    for (const attribute of layout.attributes) {
      list.push({
        name: attribute.name,
        type: ATTRIBUTE_TYPES[attribute.format],
        location: location++,
      });
    }
  }
  return list;
}

/** Bindings: uniforms first, then textures, then the three shared samplers. */
export function bindingLayout(desc: PipelineDesc) {
  const uniforms = desc.uniforms.map((u, i) => ({ ...u, binding: i }));
  const textures = (desc.textures ?? []).map((t, i) => ({
    name: t.name,
    kind: t.kind ?? 'float',
    binding: uniforms.length + i,
  }));
  const samplerBase = uniforms.length + textures.length;
  return { uniforms, textures, samplerBase };
}

const isInteger = (t: VaryingType) => t === 'u32' || t === 'i32';

/** The complete WGSL module for the WebGPU backend. */
export function buildWgsl(desc: PipelineDesc): string {
  const { uniforms, textures, samplerBase } = bindingLayout(desc);
  const depthOnly = desc.outputs.length === 0;
  const attrs = attributes(desc);
  const lines: string[] = [];
  for (const u of uniforms) {
    lines.push(`@group(0) @binding(${u.binding}) var<uniform> ${u.name}: ${u.block.name};`);
  }
  for (const t of textures) {
    const type = t.kind === 'depth' ? 'texture_depth_2d' : 'texture_2d<f32>';
    lines.push(`@group(0) @binding(${t.binding}) var ${t.name}: ${type};`);
  }
  lines.push(
    `@group(0) @binding(${samplerBase}) var linearSampler: sampler;`,
    `@group(0) @binding(${samplerBase + 1}) var nearestSampler: sampler;`,
    `@group(0) @binding(${samplerBase + 2}) var repeatSampler: sampler;`,
    'var<private> gFragCoord: vec4f;',
    'struct VertexIn {',
    '  @builtin(vertex_index) vertexIndex: u32,',
    '  @builtin(instance_index) instanceIndex: u32,',
    ...attrs.map((a) => `  @location(${a.location}) ${a.name}: ${a.type},`),
    '}',
    'struct Varyings {',
    '  @builtin(position) position: vec4f,',
    ...desc.varyings.map(
      (v, i) =>
        `  @location(${i})${v.flat || isInteger(v.type) ? ' @interpolate(flat)' : ''} ${v.name}: ${v.type},`,
    ),
    '}',
    ...(depthOnly
      ? []
      : [
          'struct FragOut {',
          ...desc.outputs.map((_, i) => `  @location(${i}) color${i}: vec4f,`),
          ...(desc.fragDepth ? ['  @builtin(frag_depth) depth: f32,'] : []),
          '}',
        ]),
    'fn ndcToUv(p: vec2f) -> vec2f { return vec2f(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); }',
    'fn uvToNdc(p: vec2f) -> vec2f { return vec2f(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0); }',
    'fn clipDepth(p: vec4f) -> vec4f { return p; }',
    pruneFunctions(desc.code, depthOnly ? ['vs'] : ['vs', 'fs'], 'wgsl'),
    '@vertex fn vertexMain(vsIn: VertexIn) -> Varyings { return vs(vsIn); }',
    ...(depthOnly
      ? []
      : [
          '@fragment fn fragmentMain(fsIn: Varyings) -> FragOut { gFragCoord = fsIn.position; return fs(fsIn); }',
        ]),
  );
  const externals: Record<string, object> = {};
  for (const u of desc.uniforms) externals[u.block.name] = u.block.schema;
  // Diagnostic directives must precede every declaration TypeGPU emits.
  const directives = [...new Set(desc.code.match(/diagnostic\([^)]*\);/g) ?? [])];
  const template = lines.join('\n').replace(/diagnostic\([^)]*\);/g, '');
  return `${directives.join('\n')}\n${tgpu.resolve({ template, externals })}`;
}

const GLSL_HEADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

/**
 * Keep only the functions reachable from `roots`. Shader files are shared
 * libraries: WGSL rejects unused functions that touch unbound textures, and
 * GLSL rejects e.g. dFdx anywhere in vertex code.
 */
export function pruneFunctions(
  code: string,
  roots: string[],
  language: 'glsl' | 'wgsl' = 'glsl',
): string {
  type Fn = { name: string; start: number; end: number };
  const fns: Fn[] = [];
  const header =
    language === 'wgsl'
      ? /^[ \t]*fn[ \t]+([A-Za-z_]\w*)[ \t]*\([^)]*\)[^{\n]*\{/gm
      : /^[ \t]*(?:highp |mediump |lowp )?[A-Za-z_]\w*(?:\[\w+\])?[ \t]+([A-Za-z_]\w*)[ \t]*\([^)]*\)[ \t]*\{/gm;
  let match: RegExpExecArray | null;
  while ((match = header.exec(code))) {
    const name = match[1];
    if (['if', 'for', 'while', 'switch', 'return', 'else'].includes(name)) continue;
    let depth = 0;
    let i = match.index + match[0].length - 1;
    for (; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    fns.push({ name, start: match.index, end: i + 1 });
    header.lastIndex = i + 1;
  }
  const byName = new Map<string, Fn[]>();
  for (const fn of fns) byName.set(fn.name, [...(byName.get(fn.name) ?? []), fn]);
  const keep = new Set<string>();
  const queue = roots.filter((r) => byName.has(r));
  while (queue.length) {
    const name = queue.pop()!;
    if (keep.has(name)) continue;
    keep.add(name);
    for (const fn of byName.get(name) ?? []) {
      const body = code.slice(fn.start, fn.end);
      for (const other of byName.keys()) {
        if (!keep.has(other) && new RegExp(`\\b${other}\\s*\\(`).test(body)) queue.push(other);
      }
    }
  }
  let out = '';
  let cursor = 0;
  for (const fn of fns) {
    out += code.slice(cursor, fn.start);
    if (keep.has(fn.name)) out += code.slice(fn.start, fn.end);
    cursor = fn.end;
  }
  return out + code.slice(cursor);
}

/** Vertex and fragment GLSL for the WebGL2 backend. */
export function buildGlsl(desc: PipelineDesc): { vertex: string; fragment: string } {
  const { textures } = bindingLayout(desc);
  const depthOnly = desc.outputs.length === 0;
  const attrs = attributes(desc);
  const decls = [
    ...desc.uniforms.map((u) => u.block.glslBlock(u.name)),
    ...textures.map((t) => `uniform highp sampler2D ${t.name};`),
    'vec4 gFragCoord;',
    GLSL_PRELUDE,
  ];
  const structs = [
    'struct VertexIn {',
    '  uint vertexIndex;',
    '  uint instanceIndex;',
    ...attrs.map((a) => `  ${glslType(a.type).base} ${a.name};`),
    '};',
    'struct Varyings {',
    '  vec4 position;',
    ...desc.varyings.map((v) => `  ${glslType(v.type).base} ${v.name};`),
    '};',
    ...(depthOnly
      ? []
      : [
          'struct FragOut {',
          ...desc.outputs.map((_, i) => `  vec4 color${i};`),
          ...(desc.fragDepth ? ['  float depth;'] : []),
          '};',
        ]),
    'vec2 ndcToUv(vec2 p) { return p * 0.5 + 0.5; }',
    'vec2 uvToNdc(vec2 p) { return p * 2.0 - 1.0; }',
    // WebGPU clip space has z in [0, w]; GL expects [-w, w].
    'vec4 clipDepth(vec4 p) { return p; }',
  ];

  const body = wgslToGlsl(desc.code, {
    depthTextures: textures.filter((t) => t.kind === 'depth').map((t) => t.name),
  });

  const flat = (v: { type: VaryingType; flat?: boolean }) =>
    v.flat || isInteger(v.type) ? 'flat ' : '';
  const vertexMain = [
    ...attrs.map((a) => `in ${glslType(a.type).base} a_${a.name};`),
    ...desc.varyings.map((v) => `${flat(v)}out ${glslType(v.type).base} v_${v.name};`),
    'void main() {',
    '  VertexIn vsIn;',
    '  vsIn.vertexIndex = uint(gl_VertexID);',
    '  vsIn.instanceIndex = uint(gl_InstanceID);',
    ...attrs.map((a) => `  vsIn.${a.name} = a_${a.name};`),
    '  Varyings o = vs(vsIn);',
    '  gl_Position = vec4(o.position.xy, o.position.z * 2.0 - o.position.w, o.position.w);',
    ...desc.varyings.map((v) => `  v_${v.name} = o.${v.name};`),
    '}',
  ];
  const fragmentMain = depthOnly
    ? ['void main() {}']
    : [
        ...desc.varyings.map((v) => `${flat(v)}in ${glslType(v.type).base} v_${v.name};`),
        ...desc.outputs.map((_, i) => `layout(location = ${i}) out vec4 o_color${i};`),
        'void main() {',
        '  Varyings fsIn;',
        '  fsIn.position = gl_FragCoord;',
        ...desc.varyings.map((v) => `  fsIn.${v.name} = v_${v.name};`),
        '  gFragCoord = gl_FragCoord;',
        '  FragOut o = fs(fsIn);',
        ...desc.outputs.map((_, i) => `  o_color${i} = o.color${i};`),
        ...(desc.fragDepth ? ['  gl_FragDepth = o.depth;'] : []),
        '}',
      ];
  const shared = [...decls, ...structs].join('\n');
  return {
    vertex: GLSL_HEADER + pruneFunctions(`${shared}\n${body}\n${vertexMain.join('\n')}`, ['main']),
    fragment:
      GLSL_HEADER + pruneFunctions(`${shared}\n${body}\n${fragmentMain.join('\n')}`, ['main']),
  };
}
