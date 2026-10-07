// Double-precision vector helpers for the CPU side of the camera and journey.
export type Vec3 = [number, number, number];

export const v3 = (x = 0, y = 0, z = 0): Vec3 => [x, y, z];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a: Vec3): Vec3 => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
/** Quintic ease: zero velocity and acceleration at both ends. */
export const ease = (t: number) => {
  t = clamp(t, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
/** Shortest signed angular difference b - a. */
export const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** Frame-rate independent exponential approach factor. */
export const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

export function rotateY(p: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c * p[0] - s * p[2], p[1], s * p[0] + c * p[2]];
}

/** Rotate `v` around unit `axis` by `angle` (Rodrigues). */
export function rotateAxis(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = dot(axis, v) * (1 - c);
  const x = cross(axis, v);
  return [
    v[0] * c + x[0] * s + axis[0] * k,
    v[1] * c + x[1] * s + axis[1] * k,
    v[2] * c + x[2] * s + axis[2] * k,
  ];
}

/** Direction for yaw (around +Y, 0 → +Z) and pitch (positive looks up). */
export const direction = (yaw: number, pitch: number): Vec3 => [
  Math.sin(yaw) * Math.cos(pitch),
  Math.sin(pitch),
  Math.cos(yaw) * Math.cos(pitch),
];

/** Any unit vector perpendicular to `n`. */
export function perpendicular(n: Vec3): Vec3 {
  return normalize(Math.abs(n[1]) < 0.9 ? cross(n, [0, 1, 0]) : cross(n, [1, 0, 0]));
}

/** Spherical interpolation between unit vectors. */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const d = clamp(dot(a, b), -1, 1);
  const theta = Math.acos(d);
  if (theta < 1e-6) return normalize(lerp3(a, b, t));
  const s = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / s;
  const wb = Math.sin(t * theta) / s;
  return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb];
}

/** An orthonormal camera basis. `up` is the camera's up vector. */
export interface Basis {
  forward: Vec3;
  right: Vec3;
  up: Vec3;
}

export function basisFromForward(forward: Vec3, worldUp: Vec3, roll = 0): Basis {
  const f = normalize(forward);
  let r = cross(f, worldUp);
  if (length(r) < 1e-6) r = perpendicular(f);
  r = normalize(r);
  const u = cross(r, f);
  if (roll === 0) return { forward: f, right: r, up: u };
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  return {
    forward: f,
    right: normalize(add(scale(r, c), scale(u, s))),
    up: normalize(add(scale(u, c), scale(r, -s))),
  };
}

/** Unit quaternion `[x, y, z, w]`. */
export type Quat = [number, number, number, number];

/**
 * The rotation that maps camera axes (right, up, back) onto a view basis.
 * `up` only needs to be roughly perpendicular to `forward`.
 */
export function quatFromView(forward: Vec3, up: Vec3): Quat {
  const f = normalize(forward);
  let r = cross(f, up);
  if (length(r) < 1e-9) r = perpendicular(f);
  r = normalize(r);
  const u = cross(r, f);
  // Rotation matrix columns: right, up, back (= −forward).
  const [m00, m10, m20] = r;
  const [m01, m11, m21] = u;
  const [m02, m12, m22] = [-f[0], -f[1], -f[2]];
  const trace = m00 + m11 + m22;
  let q: Quat;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    q = [(m21 - m12) * s, (m02 - m20) * s, (m10 - m01) * s, 0.25 / s];
  } else if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  } else if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  } else {
    const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
    q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
  }
  const n = Math.hypot(...q);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** Shortest-arc spherical interpolation between unit quaternions. */
export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const s = d < 0 ? -1 : 1;
  d *= s;
  let wa = 1 - t;
  let wb = t * s;
  if (d < 0.9995) {
    const theta = Math.acos(d);
    const sin = Math.sin(theta);
    wa = Math.sin((1 - t) * theta) / sin;
    wb = (Math.sin(t * theta) / sin) * s;
  }
  const q: Quat = [
    a[0] * wa + b[0] * wb,
    a[1] * wa + b[1] * wb,
    a[2] * wa + b[2] * wb,
    a[3] * wa + b[3] * wb,
  ];
  const n = Math.hypot(...q);
  return [q[0] / n, q[1] / n, q[2] / n, q[3] / n];
}

/** Rotate `v` by unit quaternion `q`. */
export function quatRotate(q: Quat, v: Vec3): Vec3 {
  const u: Vec3 = [q[0], q[1], q[2]];
  const t = scale(cross(u, v), 2);
  return add(add(v, scale(t, q[3])), cross(u, t));
}

/** Forward and up of the view a quaternion describes. */
export function quatView(q: Quat): { forward: Vec3; up: Vec3 } {
  return { forward: quatRotate(q, [0, 0, -1]), up: quatRotate(q, [0, 1, 0]) };
}
