/**
 * Procedural low-poly meshes for every flora kind. Built once on the CPU;
 * every instance on every planet reuses them, tinted per biome on the GPU.
 *
 * Vertex layout (8 floats): position xyz, normal xyz, part, sway.
 * part: 0 bark/stone, 1 foliage, 2 accent (blossom, birch bark, petals),
 *       3 glow (lit at night).  sway: 0 rigid … 1 moves most in the wind.
 * Units are metres for a scale-1 instance; +y is up.
 */
import type { FloraKind } from './biomes';
import { mulberry32, range, type Rng } from './rng';

type V3 = [number, number, number];

export const FLORA_KINDS: FloraKind[] = [
  'broadleaf',
  'pine',
  'palm',
  'birch',
  'acacia',
  'baobab',
  'willow',
  'deadTree',
  'cactus',
  'bush',
  'fern',
  'reeds',
  'boulder',
  'rocks',
  'mushroom',
  'crystal',
  'iceSpike',
  'lavaRock',
  'glowPlant',
  'coral',
  'boneArch',
  'tendril',
  'basalt',
  'blossom',
  'autumn',
  'flowers',
];

/** Typical spacing between instances in metres (drives the placement grid). */
export const FLORA_SPACING: Record<FloraKind, number> = {
  broadleaf: 9,
  autumn: 9,
  blossom: 9,
  pine: 7,
  palm: 9,
  birch: 6,
  acacia: 16,
  baobab: 22,
  willow: 12,
  deadTree: 12,
  cactus: 7,
  bush: 4,
  fern: 2.6,
  reeds: 1.8,
  boulder: 9,
  rocks: 3.2,
  mushroom: 7,
  crystal: 6,
  iceSpike: 7,
  lavaRock: 6,
  glowPlant: 3,
  coral: 5,
  boneArch: 26,
  tendril: 10,
  basalt: 7,
  flowers: 1.4,
};

class MeshBuilder {
  data: number[] = [];
  constructor(private rng: Rng) {}

  tri(
    a: V3,
    b: V3,
    c: V3,
    na: V3,
    nb: V3,
    nc: V3,
    part: number,
    sa: number,
    sb: number,
    sc: number,
  ) {
    this.data.push(...a, ...na, part, sa, ...b, ...nb, part, sb, ...c, ...nc, part, sc);
  }

  flatTri(a: V3, b: V3, c: V3, part: number, sway: (p: V3) => number) {
    const n = normalize(cross(sub(b, a), sub(c, a)));
    this.tri(a, b, c, n, n, n, part, sway(a), sway(b), sway(c));
  }

  /** Tapered cylinder from `a` to `b` (radii ra, rb). */
  cylinder(
    a: V3,
    b: V3,
    ra: number,
    rb: number,
    sides: number,
    part: number,
    sway: (p: V3) => number,
  ) {
    const axis = normalize(sub(b, a));
    const t = perpendicular(axis);
    const u = cross(axis, t);
    const ring = (c: V3, r: number, i: number): [V3, V3] => {
      const ang = (i / sides) * Math.PI * 2;
      const dir = add(scale(t, Math.cos(ang)), scale(u, Math.sin(ang)));
      return [add(c, scale(dir, r)), dir];
    };
    for (let i = 0; i < sides; i++) {
      const [p0, n0] = ring(a, ra, i);
      const [p1, n1] = ring(a, ra, i + 1);
      const [q0, m0] = ring(b, rb, i);
      const [q1, m1] = ring(b, rb, i + 1);
      this.tri(p0, q0, p1, n0, m0, n1, part, sway(p0), sway(q0), sway(p1));
      this.tri(p1, q0, q1, n1, m0, m1, part, sway(p1), sway(q0), sway(q1));
    }
    if (rb > 0.001) {
      for (let i = 0; i < sides; i++) {
        const [q0] = ring(b, rb, i);
        const [q1] = ring(b, rb, i + 1);
        this.tri(b, q0, q1, axis, axis, axis, part, sway(b), sway(q0), sway(q1));
      }
    }
  }

  /** A lumpy ellipsoid from a subdivided icosahedron with smooth normals. */
  blob(
    c: V3,
    radii: V3,
    jitter: number,
    part: number,
    sway: (p: V3) => number,
    detail = 1,
    flat = false,
  ) {
    const { vertices, faces } = icosphere(detail);
    const pts = vertices.map((v) => {
      const k = 1 + range(this.rng, -jitter, jitter);
      return add(c, [v[0] * radii[0] * k, v[1] * radii[1] * k, v[2] * radii[2] * k] as V3);
    });
    const normals = vertices.map((v) =>
      normalize([v[0] / radii[0], v[1] / radii[1], v[2] / radii[2]]),
    );
    for (const [i, j, k] of faces) {
      if (flat) this.flatTri(pts[i], pts[j], pts[k], part, sway);
      else
        this.tri(
          pts[i],
          pts[j],
          pts[k],
          normals[i],
          normals[j],
          normals[k],
          part,
          sway(pts[i]),
          sway(pts[j]),
          sway(pts[k]),
        );
    }
  }

  /** A double-sided ribbon through `points` with per-point width. */
  ribbon(points: V3[], widths: number[], side: V3, part: number, sway: (p: V3) => number) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const wa = scale(side, widths[i] / 2);
      const wb = scale(side, widths[i + 1] / 2);
      const a0 = sub(a, wa);
      const a1 = add(a, wa);
      const b0 = sub(b, wb);
      const b1 = add(b, wb);
      this.flatTri(a0, b0, a1, part, sway);
      this.flatTri(a1, b0, b1, part, sway);
      this.flatTri(a1, b0, a0, part, sway);
      this.flatTri(b1, b0, a1, part, sway);
    }
  }

  /** A hexagonal prism with a pointed tip (crystals, basalt with tip = 0). */
  prism(
    base: V3,
    dir: V3,
    radius: number,
    length: number,
    tip: number,
    sides: number,
    part: number,
    sway: (p: V3) => number,
  ) {
    const axis = normalize(dir);
    const t = perpendicular(axis);
    const u = cross(axis, t);
    const top = add(base, scale(axis, length));
    const apex = add(top, scale(axis, tip));
    const ring = (c: V3, i: number) => {
      const ang = (i / sides) * Math.PI * 2;
      return add(c, add(scale(t, Math.cos(ang) * radius), scale(u, Math.sin(ang) * radius)));
    };
    for (let i = 0; i < sides; i++) {
      const p0 = ring(base, i);
      const p1 = ring(base, i + 1);
      const q0 = ring(top, i);
      const q1 = ring(top, i + 1);
      this.flatTri(p0, q0, p1, part, sway);
      this.flatTri(p1, q0, q1, part, sway);
      this.flatTri(q0, apex, q1, part, sway);
    }
  }

  build(): Float32Array {
    return new Float32Array(this.data);
  }
}

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const perpendicular = (n: V3): V3 =>
  normalize(Math.abs(n[1]) < 0.9 ? cross(n, [0, 1, 0]) : cross(n, [1, 0, 0]));

let icoCache: Map<number, { vertices: V3[]; faces: [number, number, number][] }> | null = null;
function icosphere(detail: number) {
  icoCache ??= new Map();
  const cached = icoCache.get(detail);
  if (cached) return cached;
  const t = (1 + Math.sqrt(5)) / 2;
  let vertices: V3[] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ].map((v) => normalize(v as V3));
  let faces: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  for (let d = 0; d < detail; d++) {
    const mid = new Map<string, number>();
    const midpoint = (a: number, b: number) => {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      let i = mid.get(key);
      if (i === undefined) {
        i = vertices.length;
        vertices.push(normalize(scale(add(vertices[a], vertices[b]), 0.5)));
        mid.set(key, i);
      }
      return i;
    };
    const next: [number, number, number][] = [];
    for (const [a, b, c] of faces) {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  const result = { vertices, faces };
  icoCache.set(detail, result);
  return result;
}

const byHeight =
  (h: number, power = 1.5) =>
  (p: V3) =>
    Math.min(1, Math.max(0, p[1] / h)) ** power;
const rigid = () => 0;

type Generator = (m: MeshBuilder, rng: Rng) => void;

function canopyTree(
  m: MeshBuilder,
  rng: Rng,
  height: number,
  spread: number,
  blobs: number,
  part = 1,
  trunkPart = 0,
) {
  const sway = byHeight(height);
  const lean: V3 = [range(rng, -0.4, 0.4), 0, range(rng, -0.4, 0.4)];
  const top: V3 = add([0, height * 0.62, 0], lean);
  m.cylinder([0, -0.3, 0], top, height * 0.045, height * 0.025, 6, trunkPart, sway);
  // A couple of branches carry the outer blobs.
  for (let i = 0; i < blobs; i++) {
    const a = (i / blobs) * Math.PI * 2 + range(rng, -0.4, 0.4);
    const r = i === 0 ? 0 : spread * range(rng, 0.45, 0.8);
    const c: V3 = add(top, [
      Math.cos(a) * r,
      i === 0 ? height * 0.18 : range(rng, -0.05, 0.12) * height,
      Math.sin(a) * r,
    ]);
    if (i > 0)
      m.cylinder(
        add(top, [0, -height * 0.08, 0]),
        c,
        height * 0.018,
        height * 0.01,
        4,
        trunkPart,
        sway,
      );
    const s = spread * (i === 0 ? 0.75 : range(rng, 0.45, 0.62));
    m.blob(c, [s, s * range(rng, 0.7, 0.9), s], 0.22, part, sway, 0);
  }
}

const GENERATORS: Record<FloraKind, Generator> = {
  broadleaf: (m, rng) => canopyTree(m, rng, 9, 3.4, 6),
  autumn: (m, rng) => canopyTree(m, rng, 8, 3, 5),
  blossom: (m, rng) => {
    canopyTree(m, rng, 6.5, 2.8, 5, 2);
  },
  pine: (m, rng) => {
    const h = 13;
    const sway = byHeight(h, 2);
    m.cylinder([0, -0.3, 0], [0, h * 0.9, 0], 0.32, 0.08, 6, 0, sway);
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const y = h * (0.22 + (i / tiers) * 0.66);
      const r = 2.6 * (1 - i / (tiers + 0.6)) * range(rng, 0.9, 1.08);
      m.cylinder([0, y, 0], [0, y + h * 0.26, 0], r, 0.05, 8, 1, sway);
    }
  },
  palm: (m, rng) => {
    const h = 9;
    const sway = byHeight(h, 1.6);
    const bend = range(rng, 1, 2.2);
    const pts: V3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      pts.push([bend * t * t, h * t, 0]);
    }
    for (let i = 0; i < 6; i++)
      m.cylinder(pts[i], pts[i + 1], 0.28 - i * 0.025, 0.25 - i * 0.025, 6, 0, sway);
    const crown = pts[6];
    for (let f = 0; f < 8; f++) {
      const a = (f / 8) * Math.PI * 2 + range(rng, -0.2, 0.2);
      const dir: V3 = [Math.cos(a), 0, Math.sin(a)];
      const frond: V3[] = [];
      const widths: number[] = [];
      for (let k = 0; k <= 5; k++) {
        const t = k / 5;
        frond.push(add(crown, add(scale(dir, t * 4.2), [0, 0.8 * t - 2.6 * t * t, 0])));
        widths.push(Math.sin(t * Math.PI) * 1.1 + 0.05);
      }
      m.ribbon(frond, widths, cross(dir, [0, 1, 0]), 1, () => 1);
    }
  },
  birch: (m, rng) => {
    const h = 10;
    const sway = byHeight(h);
    m.cylinder([0, -0.3, 0], [range(rng, -0.3, 0.3), h * 0.7, 0], 0.2, 0.1, 6, 2, sway);
    for (let i = 0; i < 4; i++) {
      const c: V3 = [range(rng, -1, 1), h * range(rng, 0.6, 0.92), range(rng, -1, 1)];
      m.blob(c, [1.3, 1.9, 1.3], 0.25, 1, sway, 0);
    }
  },
  acacia: (m, rng) => {
    const h = 7;
    const sway = byHeight(h);
    const fork: V3 = [0, h * 0.45, 0];
    m.cylinder([0, -0.3, 0], fork, 0.3, 0.22, 6, 0, sway);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + range(rng, -0.3, 0.3);
      const end: V3 = [Math.cos(a) * 2.2, h * 0.85, Math.sin(a) * 2.2];
      m.cylinder(fork, end, 0.16, 0.08, 5, 0, sway);
    }
    m.blob([0, h * 0.92, 0], [5, 0.9, 5], 0.18, 1, sway, 1);
  },
  baobab: (m, rng) => {
    const h = 11;
    const sway = byHeight(h, 3);
    m.cylinder([0, -0.5, 0], [0, h * 0.75, 0], 2.2, 1.3, 9, 0, sway);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + range(rng, -0.2, 0.2);
      const end: V3 = [Math.cos(a) * 3, h * range(rng, 0.85, 1), Math.sin(a) * 3];
      m.cylinder([0, h * 0.72, 0], end, 0.4, 0.15, 5, 0, sway);
      m.blob(end, [1.1, 0.7, 1.1], 0.3, 1, sway, 0);
    }
  },
  willow: (m, rng) => {
    const h = 9;
    const sway = byHeight(h, 1.2);
    m.cylinder([0, -0.3, 0], [0, h * 0.6, 0], 0.45, 0.3, 7, 0, sway);
    m.blob([0, h * 0.78, 0], [3.6, 2, 3.6], 0.2, 1, sway, 0);
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + range(rng, -0.1, 0.1);
      const r = range(rng, 2.4, 3.5);
      const top: V3 = [Math.cos(a) * r, h * 0.8, Math.sin(a) * r];
      const length = range(rng, 3.5, 5.5);
      m.ribbon(
        [
          top,
          add(top, [0, -length * 0.5, 0]),
          add(top, [Math.cos(a) * 0.4, -length, Math.sin(a) * 0.4]),
        ],
        [0.5, 0.4, 0.15],
        [-Math.sin(a), 0, Math.cos(a)],
        1,
        () => 1,
      );
    }
  },
  deadTree: (m, rng) => {
    const h = 7;
    const sway = byHeight(h, 2);
    const branch = (a: V3, dir: V3, length: number, radius: number, depth: number) => {
      const b = add(a, scale(normalize(dir), length));
      m.cylinder(a, b, radius, radius * 0.6, 5, 0, sway);
      if (depth <= 0) return;
      for (let i = 0; i < 2; i++) {
        const nd: V3 = add(normalize(dir), [
          range(rng, -0.9, 0.9),
          range(rng, 0.1, 0.6),
          range(rng, -0.9, 0.9),
        ]);
        branch(b, nd, length * 0.68, radius * 0.6, depth - 1);
      }
    };
    branch([0, -0.3, 0], [0, 1, 0], h * 0.45, 0.32, 3);
  },
  cactus: (m, rng) => {
    const h = 6;
    const sway = rigid;
    m.cylinder([0, -0.3, 0], [0, h, 0], 0.42, 0.36, 8, 1, sway);
    m.blob([0, h, 0], [0.36, 0.3, 0.36], 0, 1, sway, 1);
    const arms = 1 + Math.floor(rng() * 2.5);
    for (let i = 0; i < arms; i++) {
      const a = (i / arms) * Math.PI * 2 + range(rng, -0.5, 0.5);
      const y = h * range(rng, 0.35, 0.6);
      const out: V3 = [Math.cos(a) * 1.1, y + 0.4, Math.sin(a) * 1.1];
      m.cylinder([0, y, 0], out, 0.26, 0.26, 7, 1, sway);
      const up: V3 = add(out, [0, h * range(rng, 0.25, 0.4), 0]);
      m.cylinder(out, up, 0.26, 0.22, 7, 1, sway);
      m.blob(up, [0.22, 0.2, 0.22], 0, 1, sway, 1);
    }
    for (let i = 0; i < 4; i++)
      m.blob(
        [range(rng, -0.2, 0.2), h + 0.2, range(rng, -0.2, 0.2)],
        [0.12, 0.1, 0.12],
        0,
        2,
        sway,
        0,
      );
  },
  bush: (m, rng) => {
    const sway = byHeight(2.2);
    for (let i = 0; i < 4; i++) {
      const c: V3 = [range(rng, -0.8, 0.8), range(rng, 0.4, 1), range(rng, -0.8, 0.8)];
      m.blob(c, [range(rng, 0.8, 1.2), range(rng, 0.7, 1), range(rng, 0.8, 1.2)], 0.25, 1, sway, 0);
    }
  },
  fern: (m, rng) => {
    for (let f = 0; f < 9; f++) {
      const a = (f / 9) * Math.PI * 2 + range(rng, -0.2, 0.2);
      const dir: V3 = [Math.cos(a), 0, Math.sin(a)];
      const length = range(rng, 1, 1.5);
      const pts: V3[] = [];
      const widths: number[] = [];
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        pts.push(add(scale(dir, t * length), [0, Math.sin(t * 2.2) * 0.9, 0]));
        widths.push(Math.sin(t * Math.PI) * 0.45 + 0.02);
      }
      m.ribbon(pts, widths, cross(dir, [0, 1, 0]), 1, (p) => Math.min(1, Math.hypot(p[0], p[2])));
    }
  },
  reeds: (m, rng) => {
    for (let i = 0; i < 12; i++) {
      const base: V3 = [range(rng, -0.5, 0.5), 0, range(rng, -0.5, 0.5)];
      const h = range(rng, 1.2, 2.2);
      const lean: V3 = [range(rng, -0.3, 0.3), h, range(rng, -0.3, 0.3)];
      const side = normalize(cross(lean, [0.3, 0, 1]));
      m.ribbon(
        [base, add(base, scale(lean, 0.5)), add(base, lean)],
        [0.07, 0.05, 0.01],
        side,
        1,
        (p) => p[1] / 2,
      );
      if (i % 4 === 0)
        m.cylinder(
          add(base, scale(lean, 0.92)),
          add(base, scale(lean, 1.05)),
          0.05,
          0.04,
          4,
          2,
          () => 1,
        );
    }
  },
  boulder: (m, rng) => {
    m.blob(
      [0, 0.5, 0],
      [range(rng, 1.4, 2), range(rng, 1, 1.4), range(rng, 1.3, 1.8)],
      0.28,
      0,
      rigid,
      1,
      true,
    );
  },
  rocks: (m, rng) => {
    for (let i = 0; i < 4; i++) {
      const s = range(rng, 0.2, 0.55);
      m.blob(
        [range(rng, -0.8, 0.8), s * 0.4, range(rng, -0.8, 0.8)],
        [s * 1.2, s * 0.8, s],
        0.3,
        0,
        rigid,
        0,
        true,
      );
    }
  },
  mushroom: (m, rng) => {
    const h = range(rng, 2.4, 3.2);
    const sway = byHeight(h, 3);
    m.cylinder([0, -0.2, 0], [range(rng, -0.2, 0.2), h, 0], 0.28, 0.22, 7, 2, sway);
    m.blob([0, h, 0], [1.6, 0.6, 1.6], 0.08, 1, sway, 1);
    m.blob([0, h - 0.15, 0], [1.4, 0.18, 1.4], 0.02, 3, sway, 1);
  },
  crystal: (m, rng) => {
    for (let i = 0; i < 6; i++) {
      const dir: V3 = normalize([range(rng, -0.5, 0.5), 1, range(rng, -0.5, 0.5)]);
      const base: V3 = [range(rng, -0.5, 0.5), -0.2, range(rng, -0.5, 0.5)];
      m.prism(
        base,
        dir,
        range(rng, 0.15, 0.32),
        range(rng, 0.8, 2.6),
        range(rng, 0.3, 0.6),
        6,
        3,
        rigid,
      );
    }
  },
  iceSpike: (m, rng) => {
    for (let i = 0; i < 4; i++) {
      const dir: V3 = normalize([range(rng, -0.25, 0.25), 1, range(rng, -0.25, 0.25)]);
      const base: V3 = [range(rng, -1, 1), -0.3, range(rng, -1, 1)];
      m.prism(
        base,
        dir,
        range(rng, 0.35, 0.8),
        range(rng, 2.5, 6),
        range(rng, 1.5, 3),
        5,
        2,
        rigid,
      );
    }
  },
  lavaRock: (m, rng) => {
    m.blob(
      [0, 0.4, 0],
      [range(rng, 1, 1.5), range(rng, 0.7, 1), range(rng, 1, 1.4)],
      0.35,
      0,
      rigid,
      1,
      true,
    );
    for (let i = 0; i < 3; i++)
      m.blob(
        [range(rng, -0.8, 0.8), 0.1, range(rng, -0.8, 0.8)],
        [0.3, 0.12, 0.3],
        0.2,
        3,
        rigid,
        0,
      );
  },
  glowPlant: (m, rng) => {
    for (let i = 0; i < 3; i++) {
      const h = range(rng, 0.6, 1.4);
      const base: V3 = [range(rng, -0.4, 0.4), 0, range(rng, -0.4, 0.4)];
      const top: V3 = add(base, [range(rng, -0.2, 0.2), h, range(rng, -0.2, 0.2)]);
      m.cylinder(base, top, 0.04, 0.03, 4, 1, (p) => p[1] / 1.4);
      m.blob(top, [0.16, 0.22, 0.16], 0.1, 3, () => 1, 1);
    }
  },
  coral: (m, rng) => {
    const branch = (a: V3, dir: V3, length: number, radius: number, depth: number) => {
      const b = add(a, scale(normalize(dir), length));
      m.cylinder(a, b, radius, radius * 0.75, 6, 1, rigid);
      if (depth <= 0) {
        m.blob(b, [radius * 1.3, radius * 1.3, radius * 1.3], 0.1, 3, rigid, 0);
        return;
      }
      for (let i = 0; i < 2; i++)
        branch(
          b,
          add(dir, [range(rng, -0.8, 0.8), 0.4, range(rng, -0.8, 0.8)]),
          length * 0.75,
          radius * 0.72,
          depth - 1,
        );
    };
    branch([0, -0.2, 0], [0, 1, 0], 0.9, 0.22, 3);
  },
  boneArch: (m, rng) => {
    const r = range(rng, 5, 7);
    const pts: V3[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI;
      pts.push([Math.cos(a) * r, Math.sin(a) * r * 1.2 - 0.5, 0]);
    }
    for (let i = 0; i < 10; i++)
      m.cylinder(
        pts[i],
        pts[i + 1],
        0.55 - Math.abs(i - 5) * 0.05,
        0.55 - Math.abs(i - 4) * 0.05,
        7,
        2,
        rigid,
      );
  },
  tendril: (m) => {
    const h = 11;
    const sway = byHeight(h, 1.3);
    const pts: V3[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push([Math.sin(t * 5) * 0.6, h * t, Math.cos(t * 5) * 0.6 - 0.6]);
    }
    for (let i = 0; i < 8; i++)
      m.cylinder(pts[i], pts[i + 1], 0.35 - i * 0.035, 0.32 - i * 0.035, 6, 0, sway);
    for (let i = 2; i <= 8; i++) {
      const a = i * 2.4;
      const dir: V3 = [Math.cos(a), 0.3, Math.sin(a)];
      m.ribbon(
        [pts[i], add(pts[i], scale(dir, 1.6)), add(pts[i], add(scale(dir, 2.6), [0, -0.6, 0]))],
        [0.2, 0.9, 0.1],
        cross(normalize(dir), [0, 1, 0]),
        1,
        sway,
      );
    }
    m.blob(pts[8], [0.45, 0.55, 0.45], 0.1, 3, sway, 1);
  },
  basalt: (m, rng) => {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = i === 0 ? 0 : 0.85;
      m.prism(
        [Math.cos(a) * r, -0.4, Math.sin(a) * r],
        [0, 1, 0],
        0.48,
        range(rng, 1, 3.6),
        0,
        6,
        0,
        rigid,
      );
    }
  },
  flowers: (m, rng) => {
    for (let i = 0; i < 7; i++) {
      const base: V3 = [range(rng, -0.5, 0.5), 0, range(rng, -0.5, 0.5)];
      const h = range(rng, 0.25, 0.5);
      const top = add(base, [0, h, 0]);
      m.ribbon([base, top], [0.02, 0.02], [1, 0, 0], 1, (p) => p[1] * 2);
      m.blob(top, [0.09, 0.05, 0.09], 0.15, 2, () => 1, 0);
    }
  },
};

export interface FloraMesh {
  kind: FloraKind;
  vertices: Float32Array;
  count: number;
  /** Bounding height in metres, for fades and culling. */
  height: number;
}

/** Build every flora mesh (a few hundred kilobytes, built once per session). */
export function buildFloraMeshes(): Map<FloraKind, FloraMesh> {
  const out = new Map<FloraKind, FloraMesh>();
  FLORA_KINDS.forEach((kind, i) => {
    const rng = mulberry32(9157 + i * 131);
    const m = new MeshBuilder(rng);
    GENERATORS[kind](m, rng);
    const vertices = m.build();
    let height = 0;
    for (let v = 1; v < vertices.length; v += 8) height = Math.max(height, vertices[v]);
    out.set(kind, { kind, vertices, count: vertices.length / 8, height });
  });
  return out;
}

/** A clump of curved grass blades, 1 m tall (scaled by the biome's grass height). */
export function buildGrassMesh(): FloraMesh {
  const rng = mulberry32(4242);
  const data: number[] = [];
  const push = (p: V3, n: V3, sway: number) => data.push(...p, ...n, 1, sway);
  for (let b = 0; b < 7; b++) {
    const a = range(rng, 0, Math.PI * 2);
    const base: V3 = [Math.cos(a) * range(rng, 0, 0.32), 0, Math.sin(a) * range(rng, 0, 0.32)];
    const facing = range(rng, 0, Math.PI * 2);
    const side: V3 = [Math.cos(facing), 0, Math.sin(facing)];
    const bend: V3 = [-side[2] * range(rng, 0.15, 0.4), 0, side[0] * range(rng, 0.15, 0.4)];
    const h = range(rng, 0.55, 1);
    const width = range(rng, 0.035, 0.06);
    const normal = normalize(cross(side, [0, 1, 0]));
    const pts: V3[] = [];
    for (let s = 0; s <= 3; s++) {
      const t = s / 3;
      pts.push(add(base, add([0, h * t, 0], scale(bend, t * t))));
    }
    for (let s = 0; s < 3; s++) {
      const w0 = width * (1 - s / 3);
      const w1 = width * (1 - (s + 1) / 3);
      const a0 = sub(pts[s], scale(side, w0));
      const a1 = add(pts[s], scale(side, w0));
      const b0 = sub(pts[s + 1], scale(side, w1));
      const b1 = add(pts[s + 1], scale(side, w1));
      const s0 = (s / 3) ** 1.5;
      const s1 = ((s + 1) / 3) ** 1.5;
      push(a0, normal, s0);
      push(b0, normal, s1);
      push(a1, normal, s0);
      push(a1, normal, s0);
      push(b0, normal, s1);
      push(b1, normal, s1);
    }
  }
  const vertices = new Float32Array(data);
  return { kind: 'flowers', vertices, count: vertices.length / 8, height: 1 };
}
