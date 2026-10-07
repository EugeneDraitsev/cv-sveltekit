import type { Vec3 } from './math';

/**
 * Cube-sphere quadtree for the planet surface. Each node is one patch of an
 * N×N vertex grid whose heights are generated once on the GPU into a slot of
 * the patch atlas and then reused every frame. Selection runs on the CPU in
 * double precision; the GPU receives eye-relative values only.
 */

/** Face frames: normal, u axis, v axis. */
export const FACES: [Vec3, Vec3, Vec3][] = [
  [
    [1, 0, 0],
    [0, 0, -1],
    [0, 1, 0],
  ],
  [
    [-1, 0, 0],
    [0, 0, 1],
    [0, 1, 0],
  ],
  [
    [0, 1, 0],
    [1, 0, 0],
    [0, 0, -1],
  ],
  [
    [0, -1, 0],
    [1, 0, 0],
    [0, 0, 1],
  ],
  [
    [0, 0, 1],
    [1, 0, 0],
    [0, 1, 0],
  ],
  [
    [0, 0, -1],
    [-1, 0, 0],
    [0, 1, 0],
  ],
];

const QUARTER = Math.PI / 4;

/** Unit direction of face coordinates (u, v) in [-1, 1] (tangent-warped). */
export function faceDirection(face: number, u: number, v: number): Vec3 {
  const [n, a, b] = FACES[face];
  const tu = Math.tan(u * QUARTER);
  const tv = Math.tan(v * QUARTER);
  const x = n[0] + a[0] * tu + b[0] * tv;
  const y = n[1] + a[1] * tu + b[1] * tv;
  const z = n[2] + a[2] * tu + b[2] * tv;
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

export interface PatchNode {
  key: number;
  face: number;
  level: number;
  x: number;
  y: number;
  /** Centre direction and the node's angular radius. */
  center: Vec3;
  angle: number;
  slot: number;
  /** Frame number at which the patch data became valid (−1: not built). */
  built: number;
  /** How far the terrain strays from this node's vertex grid, in radii. */
  error: number;
  /** Mean terrain height over the node, in radii (0 until measured). */
  height: number;
  lastUsed: number;
}

export interface QuadtreeOptions {
  resolution: number;
  slots: number;
  maxLevel: number;
  /** Split while distance < splitFactor × node size. */
  splitFactor: number;
  /**
   * Also split while a node's geometric error exceeds this fraction of its
   * distance, so sharp ridges far away still get enough vertices.
   */
  errorTolerance?: number;
}

/** Mean height and geometric error of a node, in planet radii; see PlanetLayer. */
export type ErrorMeasure = (
  face: number,
  level: number,
  x: number,
  y: number,
) => { error: number; height: number };

const nodeKey = (face: number, level: number, x: number, y: number) =>
  ((face * 32 + level) * 2 ** 22 + x) * 2 ** 22 + y;

export class Quadtree {
  private nodes = new Map<number, PatchNode>();
  private freeSlots: number[] = [];
  /** Leaves selected by the last update. */
  leaves: PatchNode[] = [];
  /** Nodes waiting for their patch data, nearest first. */
  pending: PatchNode[] = [];
  frame = 0;
  /** Max relief in planet radii, for horizon culling and bounds. */
  maxRelief = 0.03;
  /** Geometric error estimate for new nodes; none means distance only. */
  measure: ErrorMeasure | null = null;
  /**
   * Slots that error-driven refinement may hold: whatever distance-driven
   * refinement left free last frame, so it never starves the ground nearby.
   */
  private errorBudget = 0;
  /** Nodes allowed to split for their error this frame, the worst first. */
  private rough = new Set<number>();

  constructor(readonly options: QuadtreeOptions) {
    for (let i = options.slots - 1; i >= 0; i--) this.freeSlots.push(i);
  }

  reset() {
    this.nodes.clear();
    this.errorBudget = 0;
    this.rough.clear();
    this.freeSlots = [];
    for (let i = this.options.slots - 1; i >= 0; i--) this.freeSlots.push(i);
    this.leaves = [];
    this.pending = [];
  }

  private node(face: number, level: number, x: number, y: number): PatchNode {
    const key = nodeKey(face, level, x, y);
    let node = this.nodes.get(key);
    if (!node) {
      const size = 2 / 2 ** level;
      const u = -1 + (x + 0.5) * size;
      const v = -1 + (y + 0.5) * size;
      const center = faceDirection(face, u, v);
      const corner = faceDirection(face, u - size / 2, v - size / 2);
      const angle = Math.acos(
        Math.min(1, center[0] * corner[0] + center[1] * corner[1] + center[2] * corner[2]),
      );
      const { error, height } =
        this.measure && level >= 4 ? this.measure(face, level, x, y) : { error: 0, height: 0 };
      node = {
        key,
        face,
        level,
        x,
        y,
        center,
        angle,
        slot: -1,
        built: -1,
        lastUsed: 0,
        error,
        height,
      };
      this.nodes.set(key, node);
    }
    node.lastUsed = this.frame;
    return node;
  }

  /** Make sure a node owns an atlas slot, evicting stale nodes if needed. */
  private claim(node: PatchNode) {
    if (node.slot >= 0) return true;
    if (!this.freeSlots.length) this.evict();
    const slot = this.freeSlots.pop();
    if (slot === undefined) return false;
    node.slot = slot;
    node.built = -1;
    return true;
  }

  private evict() {
    const stale = [...this.nodes.values()]
      .filter((n) => n.slot >= 0 && n.lastUsed < this.frame - 1 && n.level > 1)
      .toSorted((a, b) => a.lastUsed - b.lastUsed || b.level - a.level);
    for (const n of stale.slice(0, 64)) {
      this.freeSlots.push(n.slot);
      n.slot = -1;
      n.built = -1;
      this.nodes.delete(n.key);
    }
  }

  /**
   * Choose the leaves for an eye at `eye` (planet radii, body frame). A node
   * whose children are not built yet stays a leaf, so refinement streams in
   * without holes.
   */
  update(eye: Vec3, frustum: (center: Vec3, radius: number) => boolean) {
    this.frame++;
    const r = Math.hypot(eye[0], eye[1], eye[2]);
    const eyeDir: Vec3 = [eye[0] / r, eye[1] / r, eye[2] / r];
    // Anything beyond the horizon (padded by the tallest relief) is hidden.
    const horizon =
      Math.acos(Math.min(1, 1 / Math.max(r, 1.000001))) + Math.acos(1 / (1 + this.maxRelief));
    const leaves: PatchNode[] = [];
    const pending: PatchNode[] = [];
    const { maxLevel, splitFactor } = this.options;
    const tolerance = this.options.errorTolerance ?? Infinity;

    let distanceNodes = 6;
    let errorNodes = 0;
    // Distance-driven refinement still streaming in, or out of slots.
    let streaming = false;
    let starved = false;
    const candidates: { key: number; ratio: number }[] = [];
    const visit = (node: PatchNode, refined: boolean) => {
      const c = node.center;
      const cosAngle = c[0] * eyeDir[0] + c[1] * eyeDir[1] + c[2] * eyeDir[2];
      const angular = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
      if (angular - node.angle > horizon && node.level > 0) return;
      const boundRadius = Math.max(node.angle * 1.05, this.maxRelief);
      if (node.level > 1 && !frustum(c, boundRadius + this.maxRelief)) return;
      // Measure from the ground the node actually carries, not sea level:
      // on a high plateau the datum is hundreds of metres below the camera.
      const lift = 1 + node.height;
      const dx = c[0] * lift - eye[0];
      const dy = c[1] * lift - eye[1];
      const dz = c[2] * lift - eye[2];
      const distance = Math.max(Math.hypot(dx, dy, dz) - node.angle, 1e-7);
      const near = node.level < maxLevel && distance < splitFactor * node.angle * 2;
      const coarse = !near && node.level < maxLevel && node.error > distance * tolerance;
      if (coarse) candidates.push({ key: node.key, ratio: node.error / distance });
      const rough = coarse && this.rough.has(node.key) && errorNodes + 4 <= this.errorBudget;
      if (!this.claim(node)) return;
      if (node.built < 0) pending.push(node);
      if (near || rough) {
        const byError = refined || rough;
        const children = [0, 1, 2, 3].map((i) =>
          this.node(node.face, node.level + 1, node.x * 2 + (i & 1), node.y * 2 + (i >> 1)),
        );
        let ready = true;
        for (const child of children) {
          if (!this.claim(child)) {
            ready = false;
            if (!byError) starved = true;
          } else {
            if (byError) errorNodes++;
            else distanceNodes++;
            if (child.built < 0) {
              pending.push(child);
              ready = false;
            }
          }
        }
        if (ready) {
          for (const child of children) visit(child, byError);
          return;
        }
        if (!byError) streaming = true;
      }
      if (node.built >= 0) leaves.push(node);
    };

    for (let face = 0; face < 6; face++) visit(this.node(face, 0, 0, 0), false);
    if (starved) this.errorBudget = Math.max(0, errorNodes - 64);
    else if (streaming) this.errorBudget = Math.min(this.errorBudget, errorNodes + 16);
    else this.errorBudget = Math.max(0, Math.floor(this.options.slots * 0.85) - distanceNodes);
    // Next frame, spend that budget on the most visible errors.
    this.rough = new Set(
      candidates
        .toSorted((p, q) => q.ratio - p.ratio)
        .slice(0, Math.floor(this.errorBudget / 4))
        .map((c) => c.key),
    );
    // Deduplicate and build the nearest first.
    const seen = new Set<number>();
    this.pending = pending
      .filter((n) => (seen.has(n.key) ? false : (seen.add(n.key), true)))
      .toSorted((a, b) => a.level - b.level || this.distance(a, eye) - this.distance(b, eye));
    this.leaves = leaves;
  }

  private distance(node: PatchNode, eye: Vec3) {
    const c = node.center;
    return Math.hypot(c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]);
  }

  markBuilt(nodes: PatchNode[]) {
    for (const n of nodes) n.built = this.frame;
  }

  /** True once the whole planet is covered by built patches. */
  get ready() {
    return this.leaves.length > 0 && this.pending.every((n) => n.level > 2);
  }
}
