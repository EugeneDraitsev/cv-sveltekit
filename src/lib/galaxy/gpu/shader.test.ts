import { describe, expect, it } from 'vitest';
import type { PipelineDesc } from './backend';
import { buildGlsl, buildWgsl } from './shader';
import { wgslToGlsl } from './wgsl-glsl';
import * as space from '../engine/programs';
import * as planet from '../engine/planetPrograms';
import * as flora from '../engine/floraPrograms';

const PROGRAMS: PipelineDesc[] = [space, planet, flora].flatMap((module) =>
  Object.entries(module)
    .filter(([name, value]) => name.endsWith('Program') && typeof value === 'function')
    .map(([, make]) => (make as () => PipelineDesc)()),
);

describe('WGSL → GLSL translation', () => {
  it('rewrites declarations, signatures and built-ins', () => {
    const glsl = wgslToGlsl(
      `diagnostic(off, derivative_uniformity);
struct Hit { t: f32, n: vec3f, }
const LIMIT: f32 = 4.0;
fn shade(p: vec3f, k: i32) -> vec4f {
  let a: f32 = select(1.0, 2.0, k > 0);
  var c: vec3f = vec3f(a);
  let d: f32 = textureLoad(shadow0, vec2i(1, 2), 0);
  let e: vec4f = textureLoad(atlasTex, vec2i(0), 0);
  let pts: array<vec2f, 2> = array<vec2f, 2>(vec2f(0.0), vec2f(1.0));
  let bits: u32 = bitcast<u32>(a);
  return vec4f(c * dpdx(d) + e.rgb, atan2(pts[1].x, f32(bits)));
}`,
      { depthTextures: ['shadow0'] },
    );
    expect(glsl).not.toContain('diagnostic');
    expect(glsl).toContain('struct Hit {\n  float t;\n  vec3 n;\n};');
    expect(glsl).toContain('const float LIMIT = 4.0;');
    expect(glsl).toContain('vec4 shade(vec3 p, int k) {');
    expect(glsl).toContain('float a = ((k > 0) ? (2.0) : (1.0));');
    expect(glsl).toContain('vec3 c = vec3(a);');
    expect(glsl).toContain('texelFetch(shadow0, ivec2(1, 2), 0).r');
    expect(glsl).toContain('texelFetch(atlasTex, ivec2(0), 0)');
    expect(glsl).toContain('vec2 pts[2] = vec2[2](vec2(0.0), vec2(1.0));');
    expect(glsl).toContain('uint bits = floatBitsToUint(a);');
    expect(glsl).toContain('dFdx(d)');
    expect(glsl).toContain('atan(pts[1].x, float(bits))');
  });
});

describe('every pipeline', () => {
  it('was collected', () => {
    expect(PROGRAMS.length).toBeGreaterThanOrEqual(14);
  });

  it.each(PROGRAMS.map((p) => [p.label, p] as const))('%s builds as WGSL', (_, desc) => {
    const code = buildWgsl(desc);
    expect(code).toContain('@vertex');
    expect(code.includes('@fragment')).toBe(desc.outputs.length > 0);
  });

  it.each(PROGRAMS.map((p) => [p.label, p] as const))(
    '%s translates to GLSL ES 3.00',
    (_, desc) => {
      const { vertex, fragment } = buildGlsl(desc);
      for (const stage of [vertex, fragment]) {
        expect(stage.startsWith('#version 300 es')).toBe(true);
        // No WGSL syntax may survive the translation.
        expect(stage).not.toMatch(/\b(?:let|var|fn)\s|\bvec[234][fiu]\b|\b[fiu]32\b|->|@\w+/);
      }
    },
  );
});

describe('shader sources', () => {
  // WGSL leaves smoothstep undefined when low >= high, so a falling edge must
  // be written as 1 - smoothstep(low, high, x) to match the CPU twin everywhere.
  const sources = import.meta.glob('../shaders/*.wgsl', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  it('never call smoothstep with reversed literal edges', () => {
    const reversed: string[] = [];
    for (const [file, code] of Object.entries(sources)) {
      for (const m of (code as string).matchAll(
        /smoothstep\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,/g,
      )) {
        if (Number(m[1]) >= Number(m[2])) reversed.push(`${file}: ${m[0]}`);
      }
    }
    expect(reversed).toEqual([]);
  });
});
