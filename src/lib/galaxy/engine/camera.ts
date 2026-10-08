import {
  add,
  basisFromForward,
  clamp,
  cross,
  damp,
  direction,
  dot,
  ease,
  length,
  lerp,
  normalize,
  scale,
  slerp,
  sub,
  type Basis,
  type Vec3,
} from './math';

/** A camera pose in one coordinate frame. */
export interface Pose {
  eye: Vec3;
  forward: Vec3;
  up: Vec3;
  fov: number;
}

export function poseBasis(pose: Pose): Basis {
  const forward = normalize(pose.forward);
  const right = normalize(cross(forward, pose.up));
  return { forward, right, up: cross(right, forward) };
}

/** The pose an orbit rig with these parameters looks from. */
export function orbitPose(
  target: Vec3,
  yaw: number,
  pitch: number,
  distance: number,
  roll: number,
  fov: number,
): Pose {
  const back = direction(yaw, pitch);
  const basis = basisFromForward(scale(back, -1), [0, 1, 0], roll);
  return {
    eye: add(target, scale(back, distance)),
    forward: basis.forward,
    up: basis.up,
    fov,
  };
}

/**
 * Perspective draws the near half of a tilted disk larger, so a view aimed at
 * its centre leaves it sitting low (and to one side) in the frame. Slide the
 * camera parallel to the screen until the projected rim of the disk
 * (`radius` around `centre`, level with it) is centred: `wx` and `wy` of the
 * way across and up. The view still turns around the disk's centre.
 */
export function centreDisk(
  pose: Pose,
  centre: Vec3,
  radius: number,
  aspect: number,
  wx = 1,
  wy = wx,
): Pose {
  if (wx <= 0 && wy <= 0) return pose;
  const b = poseBasis(pose);
  const tanHalf = Math.tan((pose.fov * Math.PI) / 360);
  let eye = pose.eye;
  // The rim points sit at different depths: a second pass settles the shift.
  // Both passes find the full shift; the weights scale the result once.
  for (let pass = 0; pass < 2; pass++) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const rim: Vec3 = [Math.cos(a) * radius, 0, Math.sin(a) * radius];
      const rel = sub(add(centre, rim), eye);
      const z = dot(rel, b.forward);
      // Part of the rim is beside or behind the camera: nothing to centre.
      if (z < radius * 0.25) return pose;
      x0 = Math.min(x0, dot(rel, b.right) / (z * tanHalf * aspect));
      x1 = Math.max(x1, dot(rel, b.right) / (z * tanHalf * aspect));
      y0 = Math.min(y0, dot(rel, b.up) / (z * tanHalf));
      y1 = Math.max(y1, dot(rel, b.up) / (z * tanHalf));
    }
    const depth = dot(sub(centre, eye), b.forward);
    const dx = ((x0 + x1) / 2) * depth * tanHalf * aspect;
    const dy = ((y0 + y1) / 2) * depth * tanHalf;
    eye = add(eye, add(scale(b.right, dx), scale(b.up, dy)));
  }
  const shift = sub(eye, pose.eye);
  const across = scale(b.right, dot(shift, b.right) * wx);
  const up = scale(b.up, dot(shift, b.up) * wy);
  return { ...pose, eye: add(pose.eye, add(across, up)) };
}

/** An orbit rig around a target: drag to rotate, wheel / pinch to zoom. */
export class OrbitRig {
  target: Vec3 = [0, 0, 0];
  yaw = 0.55;
  pitch = 0.5;
  distance = 30;
  roll = 0;
  fov = 38;
  want = { target: [0, 0, 0] as Vec3, yaw: 0.55, pitch: 0.5, distance: 30, roll: 0, fov: 38 };
  minDistance = 1;
  maxDistance = 100;
  /** Follow a moving point (e.g. an orbiting planet). */
  follow: (() => Vec3) | null = null;
  /**
   * Frame a disk around the target by its outline rather than its centre
   * (see centreDisk); fades out as the camera closes in on it.
   */
  disk: { radius: number; aspect: number } | null = null;
  /**
   * Added to pitch and roll when the pose is built, never to the rig's own
   * state, so drags and flights are unaffected: the galaxy view's idle float.
   */
  drift = { pitch: 0, roll: 0 };

  set(values: Partial<OrbitRig['want']>, snap = false) {
    Object.assign(this.want, values);
    if (values.target) this.want.target = [...values.target];
    if (snap) {
      this.target = [...this.want.target];
      this.yaw = this.want.yaw;
      this.pitch = this.want.pitch;
      this.distance = this.want.distance;
      this.roll = this.want.roll;
      this.fov = this.want.fov;
    }
  }

  drag(dx: number, dy: number) {
    this.want.yaw -= dx * 0.005;
    this.want.pitch = clamp(this.want.pitch + dy * 0.005, -1.45, 1.45);
  }

  zoom(factor: number) {
    this.want.distance = clamp(this.want.distance * factor, this.minDistance, this.maxDistance);
  }

  update(dt: number) {
    const k = dt <= 0 ? 1 : damp(7, dt);
    if (this.follow) this.want.target = this.follow();
    this.yaw += (this.want.yaw - this.yaw) * k;
    this.pitch += (this.want.pitch - this.pitch) * k;
    this.distance = Math.exp(
      Math.log(this.distance) + (Math.log(this.want.distance) - Math.log(this.distance)) * k,
    );
    this.roll += (this.want.roll - this.roll) * k;
    this.fov += (this.want.fov - this.fov) * k;
    const kt = this.follow ? damp(12, dt) : k;
    for (let i = 0; i < 3; i++) this.target[i] += (this.want.target[i] - this.target[i]) * kt;
  }

  moving() {
    return (
      Math.abs(this.want.yaw - this.yaw) > 1e-4 ||
      Math.abs(this.want.pitch - this.pitch) > 1e-4 ||
      Math.abs(Math.log(this.want.distance / this.distance)) > 1e-4
    );
  }

  pose(): Pose {
    const pose = orbitPose(
      this.target,
      this.yaw,
      this.pitch + this.drift.pitch,
      this.distance,
      this.roll + this.drift.roll,
      this.fov,
    );
    if (!this.disk) return pose;
    const { radius, aspect } = this.disk;
    const weight = clamp((this.distance / radius - 1.4) / 0.8, 0, 1);
    // The far side of a galaxy's disk fades out well inside its rim: centring
    // the full outline lifts the visible glow too high (measured on renders).
    return centreDisk(pose, this.target, radius, aspect, weight, weight * 0.6);
  }

  /** Adopt an arbitrary pose (e.g. the end of a flight) as orbit parameters. */
  adopt(pose: Pose, target: Vec3) {
    const offset = sub(pose.eye, target);
    const distance = length(offset);
    const back = normalize(offset);
    this.set(
      {
        target,
        distance,
        yaw: Math.atan2(back[0], back[2]),
        pitch: Math.asin(clamp(back[1], -1, 1)),
        roll: 0,
        fov: pose.fov,
      },
      true,
    );
  }
}

/**
 * A reversible flight between two poses around a focus point. The eye moves
 * on a logarithmic radial path (so huge changes of scale feel uniform), the
 * gaze settles on the destination early, and nothing ever cuts.
 */
export function flightPose(
  from: Pose,
  to: Pose,
  focusFrom: Vec3,
  focusTo: Vec3,
  t: number,
  settle = 0.42,
  /** When (0..1) the focus starts and finishes moving from focusFrom to focusTo. */
  focusSpan: [number, number] = [0, 0.7],
): Pose {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const e = ease(t);
  const k = ease((t - focusSpan[0]) / (focusSpan[1] - focusSpan[0]));
  const focus: Vec3 = [
    lerp(focusFrom[0], focusTo[0], k),
    lerp(focusFrom[1], focusTo[1], k),
    lerp(focusFrom[2], focusTo[2], k),
  ];
  const a = sub(from.eye, focusFrom);
  const b = sub(to.eye, focusTo);
  const ra = Math.max(length(a), 1e-9);
  const rb = Math.max(length(b), 1e-9);
  const dir = slerp(scale(a, 1 / ra), scale(b, 1 / rb), e);
  const radius = Math.exp(lerp(Math.log(ra), Math.log(rb), e));
  const eye = add(focus, scale(dir, radius));
  // The gaze turns toward the destination early, then eases into the final
  // framing, so the target never drifts out of view during the flight.
  const aim = normalize(sub(focus, eye));
  const toward = slerp(normalize(from.forward), aim, ease(t / settle));
  const forward = normalize(slerp(toward, normalize(to.forward), ease((t - 0.45) / 0.55)));
  const up = normalize(slerp(normalize(from.up), normalize(to.up), e));
  // Re-orthogonalise up against the blended forward.
  const right = normalize(cross(forward, up));
  return { eye, forward, up: cross(right, forward), fov: lerp(from.fov, to.fov, e) };
}

/** Pose looking from `eye` at `target` with a preferred world up. */
export function lookAt(eye: Vec3, target: Vec3, up: Vec3, fov: number): Pose {
  const forward = normalize(sub(target, eye));
  const b = basisFromForward(forward, up);
  return { eye, forward: b.forward, up: b.up, fov };
}

export const distanceTo = (a: Vec3, b: Vec3) => length(sub(a, b));
export { dot };
