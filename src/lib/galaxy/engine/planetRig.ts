import type { Pose } from './camera';
import {
  add,
  clamp,
  cross,
  damp,
  dot,
  ease,
  length,
  lerp,
  normalize,
  perpendicular,
  quatFromView,
  quatSlerp,
  quatView,
  rotateAxis,
  quatDot,
  quatFromTo,
  quatMul,
  quatNeg,
  scale,
  slerp,
  sub,
  type Vec3,
} from './math';
import type { PlanetData } from '../world/system';
import { biomeAt, terrainHeight, terrainParams, type TerrainParams } from '../world/terrain';

export interface FlightInput {
  forward: number;
  strafe: number;
  vertical: number;
  boost: boolean;
  /** Look deltas in pixels since the last frame. */
  lookX: number;
  lookY: number;
  jump: boolean;
}

export const emptyInput = (): FlightInput => ({
  forward: 0,
  strafe: 0,
  vertical: 0,
  boost: false,
  lookX: 0,
  lookY: 0,
  jump: false,
});

/**
 * Free camera on a planet, in its body frame (radius = 1). Flying is a
 * damped drone whose speed scales with height above ground; walking adds
 * gravity, jumps and a fixed eye height. The ground comes from the same
 * terrain function the GPU draws (world/terrain.ts).
 */
export class PlanetRig {
  position: Vec3 = [0, 1.001, 0];
  velocity: Vec3 = [0, 0, 0];
  /** Unit tangent heading, kept perpendicular to the local vertical. */
  heading: Vec3 = [1, 0, 0];
  pitch = -0.05;
  roll = 0;
  fov = 62;
  walking = false;
  grounded = false;
  speedLevel = 1;
  readonly params: TerrainParams;
  readonly meters: number;
  private lookVelocity = [0, 0];

  constructor(readonly planet: PlanetData) {
    this.params = terrainParams(planet);
    this.meters = planet.meters;
  }

  /** Ground (or liquid) surface height in planet radii under direction `n`. */
  ground(n: Vec3) {
    const h = terrainHeight(this.params, n[0], n[1], n[2], 10);
    return this.planet.water !== 'none' ? Math.max(h, 0) : h;
  }

  /** Metres above the surface. */
  get altitude() {
    const r = length(this.position);
    return (r - 1 - this.ground(scale(this.position, 1 / r))) * this.meters;
  }

  get up(): Vec3 {
    return normalize(this.position);
  }

  biomeName() {
    const n = this.up;
    const { index } = biomeAt(this.params, n[0], n[1], n[2]);
    const h = terrainHeight(this.params, n[0], n[1], n[2]);
    if (h < 0 && this.planet.water !== 'none') {
      return {
        water: 'Open ocean',
        lava: 'Lava sea',
        ice: 'Frozen sea',
        acid: 'Acid sea',
        none: '',
      }[this.planet.water];
    }
    return this.planet.biomes[index]?.name ?? this.planet.label;
  }

  /** Look and movement for one frame. */
  update(input: FlightInput, dt: number) {
    const up = this.up;
    // Parallel-transport the heading into the new tangent plane.
    this.heading = normalize(sub(this.heading, scale(up, dot(this.heading, up))));
    if (!Number.isFinite(this.heading[0])) this.heading = perpendicular(up);

    // Smoothed look.
    const k = damp(18, dt);
    this.lookVelocity[0] += (input.lookX - this.lookVelocity[0]) * k;
    this.lookVelocity[1] += (input.lookY - this.lookVelocity[1]) * k;
    // Uneven pointer deltas are smoothed; over a drag the total turn still
    // equals the total input.
    const yaw = -this.lookVelocity[0] * 0.0042;
    this.heading = normalize(rotateAxis(this.heading, up, yaw));
    this.pitch = clamp(this.pitch - this.lookVelocity[1] * 0.0042, -1.45, 1.45);

    const right = normalize(cross(this.heading, up));
    const altitude = Math.max(this.altitude, 0);
    let target: Vec3;
    if (this.walking) {
      const speed = (input.boost ? 14 : 6) / this.meters;
      target = add(scale(this.heading, input.forward * speed), scale(right, input.strafe * speed));
      const vertical = dot(this.velocity, up);
      const horizontal = sub(this.velocity, scale(up, vertical));
      const blended = add(
        horizontal,
        scale(sub(target, horizontal), damp(this.grounded ? 10 : 1.5, dt)),
      );
      let vy = vertical - (9.8 / this.meters) * dt;
      if (input.jump && this.grounded) vy = 5.2 / this.meters;
      this.velocity = add(blended, scale(up, vy));
    } else {
      // Faster the higher you are; boost for crossing continents.
      const base =
        clamp(10 + Math.sqrt(altitude) * 4 + altitude * 0.04, 8, 3000) *
        (input.boost ? 4 : 1) *
        this.speedLevel;
      const speed = base / this.meters;
      const forward = add(
        scale(this.heading, Math.cos(this.pitch)),
        scale(up, Math.sin(this.pitch)),
      );
      target = add(
        add(scale(forward, input.forward * speed), scale(right, input.strafe * speed)),
        scale(up, input.vertical * speed),
      );
      this.velocity = add(this.velocity, scale(sub(target, this.velocity), damp(3.2, dt)));
      const bank = -input.strafe * 0.07 - yaw * 4;
      this.roll += (clamp(bank, -0.35, 0.35) - this.roll) * damp(4, dt);
    }
    if (this.walking) this.roll += (0 - this.roll) * damp(6, dt);
    this.position = add(this.position, scale(this.velocity, dt));
    this.collide();
  }

  /** Keep the eye above ground; walking glues the feet to it. */
  collide() {
    const r = length(this.position);
    const n = scale(this.position, 1 / r);
    const ground = this.ground(n);
    const eye = (this.walking ? 1.7 : 2.2) / this.meters;
    const floor = 1 + ground + eye;
    this.grounded = false;
    if (r < floor) {
      this.position = scale(n, floor);
      const vertical = dot(this.velocity, n);
      if (vertical < 0) this.velocity = sub(this.velocity, scale(n, vertical));
      this.grounded = true;
    } else if (this.walking && r < floor + 0.15 / this.meters) {
      this.grounded = true;
    }
  }

  pose(): Pose {
    const up = this.up;
    const forward = normalize(
      add(scale(this.heading, Math.cos(this.pitch)), scale(up, Math.sin(this.pitch))),
    );
    const right = normalize(cross(forward, up));
    const camUp = cross(right, forward);
    const c = Math.cos(this.roll);
    const s = Math.sin(this.roll);
    return {
      eye: [...this.position],
      forward,
      up: normalize(add(scale(camUp, c), scale(right, s))),
      fov: this.fov,
    };
  }

  /** Adopt a pose (e.g. the end of a landing flight). */
  adopt(pose: Pose) {
    this.position = [...pose.eye];
    const up = this.up;
    const f = normalize(pose.forward);
    const tangent = sub(f, scale(up, dot(f, up)));
    this.heading = length(tangent) > 1e-6 ? normalize(tangent) : perpendicular(up);
    this.pitch = Math.asin(clamp(dot(f, up), -1, 1));
    this.roll = 0;
    this.velocity = [0, 0, 0];
    this.fov = pose.fov;
  }
}

/** A good arrival point: daylight, dry land, gentle slope, a rich biome. */
export function chooseLandingSite(
  planet: PlanetData,
  sun: Vec3,
  near: Vec3,
  /** Prefer headings close to this (e.g. the incoming camera's screen-up). */
  prefer?: Vec3,
): { site: Vec3; heading: Vec3 } {
  const params = terrainParams(planet);
  const side = perpendicular(sun);
  let best: Vec3 = normalize(add(sun, side));
  let bestScore = -Infinity;
  for (let i = 0; i < 72; i++) {
    const elevation = (25 + (i % 6) * 9) * (Math.PI / 180);
    const around = (i / 72) * Math.PI * 2 * 7.3;
    const axis = rotateAxis(side, sun, around);
    const n = normalize(rotateAxis(sun, axis, Math.PI / 2 - elevation));
    if (Math.abs(n[1]) > 0.8) continue;
    const h = terrainHeight(params, n[0], n[1], n[2], 7);
    const land = h > 0 || planet.water === 'none';
    // The ground under the camera should be walkable, the view around it not.
    const step = 0.0004;
    const t = perpendicular(n);
    const b = cross(n, t);
    const hx = terrainHeight(params, ...normalize(add(n, scale(t, step))), 7);
    const hy = terrainHeight(params, ...normalize(add(n, scale(b, step))), 7);
    const slope = (Math.hypot(hx - h, hy - h) / step) * 1.4;
    let low = h;
    let high = h;
    for (let k = 0; k < 8; k++) {
      const d = rotateAxis(t, n, (k * Math.PI) / 4);
      const far = terrainHeight(params, ...normalize(add(n, scale(d, 0.018))), 6);
      low = Math.min(low, far);
      high = Math.max(high, far);
    }
    const relief = Math.min((high - low) * planet.meters, 1600) / 400;
    // Grand relief belongs in the view, not right beside the camera: a
    // spire or cliff within a few hundred metres fills half the screen.
    let wall = 0;
    for (let k = 0; k < 8; k++) {
      const d = rotateAxis(t, n, (k * Math.PI) / 4 + 0.39);
      for (const distM of [150, 400, 800]) {
        const rise =
          (terrainHeight(params, ...normalize(add(n, scale(d, distM / planet.meters))), 7) - h) *
          planet.meters;
        wall = Math.max(wall, rise - distM * 0.6);
      }
    }
    const { index } = biomeAt(params, n[0], n[1], n[2]);
    const biome = planet.biomes[index];
    const richness = biome
      ? biome.spec.flora.reduce((s, f) => s + f.density, 0) + biome.spec.grass
      : 0;
    const score =
      (land ? 2 : -3) +
      richness * 0.6 +
      relief -
      Math.max(0, slope - 0.25) * 8 -
      Math.max(0, wall) / 60 -
      Math.abs(elevation - 0.6) * 0.5 +
      dot(n, near) * 0.4 +
      (i % 7) * 0.01;
    if (score > bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return { site: best, heading: viewHeading(params, planet.meters, best, sun, prefer) };
}

/** Camera height above the ground right after landing, in metres. */
export const LANDING_EYE_HEIGHT = 38;

const VIEW_SAMPLES = [40, 90, 180, 350, 650, 1100, 1800, 2900, 4500, 7000];

/**
 * Face the most dramatic open direction: distant relief that rises above the
 * near horizon, never a wall right in front of the camera, and the sun from
 * the side if possible.
 */
function viewHeading(
  params: TerrainParams,
  meters: number,
  site: Vec3,
  sun: Vec3,
  prefer?: Vec3,
): Vec3 {
  const t = perpendicular(site);
  const toSun = normalize(sub(sun, scale(site, dot(sun, site))));
  const eyeM = terrainHeight(params, ...site, 8) * meters + LANDING_EYE_HEIGHT;
  let heading = normalize(rotateAxis(toSun, site, 1.1));
  let bestView = -Infinity;
  for (let k = 0; k < 16; k++) {
    const d = rotateAxis(t, site, (k * Math.PI) / 8);
    let horizon = -1;
    let blocked = 0;
    let drama = 0;
    for (const distM of VIEW_SAMPLES) {
      const n = normalize(add(site, scale(d, distM / meters)));
      const drop = (distM * distM) / (2 * meters);
      const angle = Math.atan2(terrainHeight(params, ...n, 7) * meters - eyeM - drop, distM);
      if (distM < 600) blocked = Math.max(blocked, angle - 0.12);
      else if (angle > horizon) drama += Math.min(angle - Math.max(horizon, -0.06), 0.3);
      horizon = Math.max(horizon, angle);
    }
    // Side light shows relief best; looking into the sun washes the view out.
    const facing = dot(d, toSun);
    // Facing where the incoming camera's screen-up points means the landing
    // needs little roll.
    const aligned = prefer ? dot(d, prefer) * 0.8 : 0;
    const view =
      drama * 4 -
      Math.max(0, blocked) * 12 -
      Math.max(0, facing) * 0.9 -
      Math.abs(facing) * 0.25 +
      aligned;
    if (view > bestView) {
      bestView = view;
      heading = d;
    }
  }
  return heading;
}

/**
 * A landing path between two body-frame poses. Altitude moves in log space
 * (so 30 000 km and 30 m feel alike), the ground track turns early while
 * high, and the gaze tilts from the planet to the horizon at the end. The
 * view turns as a quaternion: looking straight down with a radial `up` would
 * otherwise make the roll spin.
 */
export function planetFlightPose(
  from: Pose,
  to: Pose,
  t: number,
  groundAt: (n: Vec3) => number,
): Pose {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const ra = length(from.eye);
  const rb = length(to.eye);
  const da = scale(from.eye, 1 / ra);
  const db = scale(to.eye, 1 / rb);
  const altA = Math.max(ra - 1, 1e-7);
  const altB = Math.max(rb - 1, 1e-7);
  const start = quatFromView(from.forward, from.up);
  const final = quatFromView(to.forward, to.up);

  /** Eye position and the early view (start turned toward the site) at time s. */
  const sample = (s: number) => {
    const alt = Math.exp(lerp(Math.log(altA), Math.log(altB), ease(s)));
    // A glide slope: the ground still to cover shrinks with the altitude, so
    // the gaze toward the site holds a steady angle instead of whipping round.
    const remaining = clamp((alt - altB) / Math.max(altA - altB, 1e-9), 0, 1);
    const dir = slerp(db, da, remaining);
    const ground = groundAt(dir);
    const radius = Math.max(1 + alt, 1 + ground + (alt - Math.max(altB, 0)) * 0.02 + 6e-6);
    const eye = scale(dir, radius);
    const site = scale(db, 1 + Math.max(ground, 0));
    // Look at the landing site by turning the starting orientation along the
    // shortest arc (parallel transport): the roll changes only as much as the
    // gaze does, with no screen-up hint that could swing round.
    const look = quatMul(quatFromTo(from.forward, sub(site, eye), from.up), start);
    return { eye, early: quatSlerp(start, look, ease(s / 0.35)) };
  };

  const { eye, early } = sample(t);
  // Settle onto the arrival view. The turning direction is fixed once, from
  // where the camera is when settling begins: re-picking the shorter way every
  // frame flips it the moment the remaining turn passes 180°.
  const settle = ease((t - 0.55) / 0.45);
  let view = early;
  if (settle > 0) {
    const reference = sample(0.55).early;
    const target = quatDot(reference, final) < 0 ? quatNeg(final) : final;
    view = quatSlerp(early, target, settle, false);
  }
  const { forward, up } = quatView(view);
  return { eye, forward, up, fov: lerp(from.fov, to.fov, ease(t)) };
}

/**
 * Take-off from the surface to an orbit pose, in a frame that does not spin
 * with the planet (origin at its centre, radius 1). The camera rises along
 * the local vertical, turns once to its orbit framing, and ends exactly on
 * `to` so the orbit rig can take over without a jump.
 */
export function ascentPose(from: Pose, to: Pose, t: number): Pose {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const e = ease(t);
  const ra = length(from.eye);
  const rb = length(to.eye);
  const alt = Math.exp(lerp(Math.log(Math.max(ra - 1, 1e-7)), Math.log(rb - 1), e));
  const dir = slerp(scale(from.eye, 1 / ra), scale(to.eye, 1 / rb), ease((t - 0.15) / 0.85));
  const view = quatView(
    quatSlerp(
      quatFromView(from.forward, from.up),
      quatFromView(to.forward, to.up),
      ease((t - 0.08) / 0.62),
    ),
  );
  return {
    eye: scale(dir, 1 + alt),
    forward: view.forward,
    up: view.up,
    fov: lerp(from.fov, to.fov, e),
  };
}
