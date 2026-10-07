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
    const back = direction(this.yaw, this.pitch);
    const basis = basisFromForward(scale(back, -1), [0, 1, 0], this.roll);
    return {
      eye: add(this.target, scale(back, this.distance)),
      forward: basis.forward,
      up: basis.up,
      fov: this.fov,
    };
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
): Pose {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const e = ease(t);
  const focus: Vec3 = [
    lerp(focusFrom[0], focusTo[0], ease(t / 0.7)),
    lerp(focusFrom[1], focusTo[1], ease(t / 0.7)),
    lerp(focusFrom[2], focusTo[2], ease(t / 0.7)),
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
