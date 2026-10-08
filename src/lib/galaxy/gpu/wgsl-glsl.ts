/**
 * A WGSL → GLSL ES 3.00 translator for the deliberately small WGSL dialect the
 * galaxy shaders are written in. WebGPU gets the WGSL as-is (through
 * `tgpu.resolve`); the WebGL2 fallback gets this translation, so every effect
 * has exactly one source.
 *
 * The dialect:
 *  - every `let` / `var` declares its type (`let x: f32 = …;`),
 *  - functions are declared on one line (`fn name(a: f32, b: vec3f) -> f32 {`),
 *  - no pointers, `switch`, `loop` or vector comparison operators,
 *  - float `%` is not used (call `fmod` instead), literals carry no `f`/`i` suffix.
 *
 * Anything outside the dialect is a bug in the shader, not in the translator;
 * `bun run test:unit` exercises the cases the shaders rely on.
 */

const TYPE_MAP: Record<string, string> = {
  f32: 'float',
  i32: 'int',
  u32: 'uint',
  bool: 'bool',
  vec2f: 'vec2',
  vec3f: 'vec3',
  vec4f: 'vec4',
  vec2i: 'ivec2',
  vec3i: 'ivec3',
  vec4i: 'ivec4',
  vec2u: 'uvec2',
  vec3u: 'uvec3',
  vec4u: 'uvec4',
  mat2x2f: 'mat2',
  mat3x3f: 'mat3',
  mat4x4f: 'mat4',
};

const FUNCTION_RENAMES: Record<string, string> = {
  atan2: 'atan',
  dpdx: 'dFdx',
  dpdy: 'dFdy',
  // GLSL ES has no explicit fine variant; dFdx is as fine as the driver gives.
  dpdxFine: 'dFdx',
  dpdyFine: 'dFdy',
  fwidthFine: 'fwidth',
  inverseSqrt: 'inversesqrt',
};

/** Convert a WGSL type expression (`array<vec2f, 6>` included) to GLSL parts. */
export function glslType(type: string): { base: string; suffix: string } {
  const trimmed = type.trim();
  const array = /^array<\s*(.+?)\s*,\s*(\w+)\s*>$/.exec(trimmed);
  if (array) {
    const inner = glslType(array[1]);
    return { base: inner.base, suffix: `[${array[2]}]${inner.suffix}` };
  }
  return { base: TYPE_MAP[trimmed] ?? trimmed, suffix: '' };
}

function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Index of the parenthesis that closes the one opened at `open`. */
function matchParen(source: string, open: number) {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`Unbalanced parenthesis at ${open}`);
}

/** Split a call's argument list on top-level commas. */
function splitArgs(inner: string) {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '(' || c === '[' || c === '<') depth++;
    else if (c === ')' || c === ']' || c === '>') depth--;
    else if (c === ',' && depth === 0) {
      args.push(inner.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = inner.slice(start).trim();
  if (last) args.push(last);
  return args;
}

/**
 * Rewrite every call of `name(…)` with `rewrite(args)`. Nested calls are
 * rewritten first, so arguments are already translated when `rewrite` runs.
 */
export function rewriteCalls(
  source: string,
  name: string,
  rewrite: (args: string[]) => string,
): string {
  const pattern = new RegExp(`\\b${name}\\s*\\(`, 'g');
  let out = '';
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const open = match.index + match[0].length - 1;
    const close = matchParen(source, open);
    const inner = rewriteCalls(source.slice(open + 1, close), name, rewrite);
    out += source.slice(cursor, match.index) + rewrite(splitArgs(inner));
    cursor = close + 1;
    pattern.lastIndex = close + 1;
  }
  return out + source.slice(cursor);
}

export interface TranslateOptions {
  /** Names of `texture_depth_2d` bindings: `textureLoad` on them yields `.r`. */
  depthTextures?: readonly string[];
}

/** Translate shader code (helpers, structs, entry bodies) from the dialect. */
export function wgslToGlsl(source: string, options: TranslateOptions = {}): string {
  let code = stripComments(source);
  const depth = new Set(options.depthTextures ?? []);

  code = code.replace(/diagnostic\([^)]*\);/g, '');
  // Attributes never survive into the GLSL program body.
  code = code.replace(/@(?:group|binding|location|builtin|interpolate)\([^)]*\)\s*/g, '');

  // Structs: `struct S { a: vec3f, b: f32, }` → `struct S { vec3 a; float b; };`
  code = code.replace(/struct\s+(\w+)\s*\{([^}]*)\}/g, (_, name: string, body: string) => {
    const fields = body
      .split(/[,;]/)
      .map((f) => f.trim())
      .filter(Boolean)
      .map((f) => {
        const [field, type] = f.split(/\s*:\s*/);
        const t = glslType(type);
        return `  ${t.base} ${field}${t.suffix};`;
      });
    return `struct ${name} {\n${fields.join('\n')}\n}`;
  });
  code = code.replace(/(struct\s+\w+\s*\{[^}]*\})(?!\s*;)/g, '$1;');

  // Function signatures.
  code = code.replace(
    /fn\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([\w<>, ]+?))?\s*\{/g,
    (_, name: string, params: string, ret: string | undefined) => {
      const list = params
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
          const [n, t] = p.split(/\s*:\s*/);
          const g = glslType(t);
          return `${g.base} ${n}${g.suffix}`;
        });
      return `${ret ? glslType(ret).base : 'void'} ${name}(${list.join(', ')}) {`;
    },
  );

  // Module constants and private globals.
  code = code.replace(/\bconst\s+(\w+)\s*:\s*([\w<>, ]+?)\s*=/g, (_, n: string, t: string) => {
    const g = glslType(t);
    return `const ${g.base} ${n}${g.suffix} =`;
  });
  code = code.replace(
    /\bvar<private>\s+(\w+)\s*:\s*([\w<>, ]+?)\s*;/g,
    (_, n: string, t: string) => {
      const g = glslType(t);
      return `${g.base} ${n}${g.suffix};`;
    },
  );

  // Typed locals. `let` and `var` both become plain declarations.
  code = code.replace(
    /\b(?:let|var)\s+(\w+)\s*:\s*([\w<>, ]+?)\s*(=|;)/g,
    (_, n: string, t: string, end: string) => {
      const g = glslType(t);
      return `${g.base} ${n}${g.suffix}${end === '=' ? ' =' : ';'}`;
    },
  );

  // Array constructors: `array<vec2f, 6>(` → `vec2[6](`.
  code = code.replace(/array<\s*([\w]+)\s*,\s*(\w+)\s*>\s*\(/g, (_, t: string, n: string) => {
    return `${glslType(t).base}[${n}](`;
  });

  // Built-in calls whose shape differs.
  code = rewriteCalls(code, 'select', ([f, t, c]) => `((${c}) ? (${t}) : (${f}))`);
  code = rewriteCalls(
    code,
    'textureSampleLevel',
    ([t, , uv, lod]) => `textureLod(${t}, ${uv}, ${lod})`,
  );
  code = rewriteCalls(code, 'textureSample', ([t, , uv]) => `texture(${t}, ${uv})`);
  code = rewriteCalls(code, 'textureLoad', ([t, coord, lod]) =>
    depth.has(t) ? `texelFetch(${t}, ${coord}, ${lod}).r` : `texelFetch(${t}, ${coord}, ${lod})`,
  );
  code = rewriteCalls(code, 'textureDimensions', ([t]) => `textureSize(${t}, 0)`);
  code = code.replace(/\bbitcast<u32>\s*\(/g, 'floatBitsToUint(');
  code = code.replace(/\bbitcast<i32>\s*\(/g, 'floatBitsToInt(');
  code = code.replace(/\bbitcast<f32>\s*\(/g, 'uintBitsToFloat(');

  for (const [from, to] of Object.entries(FUNCTION_RENAMES)) {
    code = code.replace(new RegExp(`\\b${from}\\s*\\(`, 'g'), `${to}(`);
  }
  for (const [from, to] of Object.entries(TYPE_MAP)) {
    code = code.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }
  return code;
}

/** Helpers WGSL has natively and GLSL ES 3.00 lacks. */
export const GLSL_PRELUDE = `
float saturate(float x) { return clamp(x, 0.0, 1.0); }
vec2 saturate(vec2 x) { return clamp(x, vec2(0.0), vec2(1.0)); }
vec3 saturate(vec3 x) { return clamp(x, vec3(0.0), vec3(1.0)); }
vec4 saturate(vec4 x) { return clamp(x, vec4(0.0), vec4(1.0)); }
`;
