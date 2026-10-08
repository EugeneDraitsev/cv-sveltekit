import type { PlanetData, StarSystemData } from '../world/system';
import { MAX_MOONS, MAX_PLANETS } from '../world/pack';
import type { Vec3 } from './math';

/** Body-fixed orientation: rows map system-frame vectors into the body frame. */
export interface Orientation {
  x: Vec3;
  y: Vec3;
  z: Vec3;
}

export interface BodyState {
  position: Vec3;
  radius: number;
}

export interface PlanetState extends BodyState {
  data: PlanetData;
  index: number;
  row: number;
  orientation: Orientation;
  /** Spin angle (radians) and cloud drift. */
  spin: number;
  cloudPhase: number;
}

export interface MoonState extends BodyState {
  planet: number;
  row: number;
  name: string;
}

export interface RingState {
  planet: number;
  inner: number;
  outer: number;
  opacity: number;
  normal: Vec3;
  seed: number;
}

/** Positions of every body of a system at a moment, in system units. */
export class SystemState {
  stars: { position: Vec3; radius: number; color: [number, number, number]; luminosity: number }[] =
    [];
  planets: PlanetState[] = [];
  moons: MoonState[] = [];
  rings: RingState[] = [];

  constructor(readonly system: StarSystemData) {
    this.update(0);
  }

  update(time: number) {
    const sys = this.system;
    this.stars = sys.stars.map((star) => {
      const a = star.phase + time * star.orbitSpeed;
      return {
        position: [
          Math.cos(a) * star.orbit,
          0.6 * Math.sign(star.orbit),
          Math.sin(a) * star.orbit,
        ] as Vec3,
        radius: star.radius,
        color: star.color,
        luminosity: star.luminosity,
      };
    });
    this.planets = sys.planets.slice(0, MAX_PLANETS).map((planet, index) => {
      const a = planet.phase + time * planet.orbitSpeed;
      const r = planet.orbit;
      const position: Vec3 = [
        Math.cos(a) * r,
        Math.sin(a) * r * Math.sin(planet.inclination),
        Math.sin(a) * r * Math.cos(planet.inclination),
      ];
      const spin = time * planet.spin + planet.phase * 3.1;
      return {
        data: planet,
        index,
        row: index,
        position,
        radius: planet.radius,
        orientation: bodyOrientation(planet.tilt, spin),
        spin,
        cloudPhase: time * planet.spin * 0.12,
      };
    });
    this.moons = [];
    let row = MAX_PLANETS;
    this.planets.forEach((p) => {
      for (const moon of p.data.moons) {
        if (this.moons.length >= MAX_MOONS) break;
        const a = moon.phase + time * moon.speed;
        const c = Math.cos(a) * moon.orbit;
        const s = Math.sin(a) * moon.orbit;
        this.moons.push({
          planet: p.index,
          row: row++,
          name: moon.name,
          radius: moon.radius,
          position: [
            p.position[0] + c,
            p.position[1] + s * Math.sin(moon.inclination),
            p.position[2] + s * Math.cos(moon.inclination),
          ],
        });
      }
    });
    this.rings = this.planets
      .filter((p) => p.data.rings)
      .map((p) => {
        const ring = p.data.rings!;
        // Rings lie in the planet's equatorial plane (body y axis).
        const normal: Vec3 = [...p.orientation.y];
        return {
          planet: p.index,
          inner: ring.inner / p.radius,
          outer: ring.outer / p.radius,
          opacity: ring.opacity,
          normal,
          seed: (ring.seed % 1000) * 0.13,
        };
      });
  }
}

/** World→body rotation for axial tilt (around z) followed by spin (around y). */
export function bodyOrientation(tilt: number, spin: number): Orientation {
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const cs = Math.cos(spin);
  const ss = Math.sin(spin);
  // body→world = Rz(tilt) · Ry(spin); rows of its transpose map world→body.
  const m = [
    [ct * cs, -st, ct * ss],
    [st * cs, ct, st * ss],
    [-ss, 0, cs],
  ];
  return {
    x: [m[0][0], m[1][0], m[2][0]],
    y: [m[0][1], m[1][1], m[2][1]],
    z: [m[0][2], m[1][2], m[2][2]],
  };
}

export const toBody = (o: Orientation, v: Vec3): Vec3 => [
  o.x[0] * v[0] + o.x[1] * v[1] + o.x[2] * v[2],
  o.y[0] * v[0] + o.y[1] * v[1] + o.y[2] * v[2],
  o.z[0] * v[0] + o.z[1] * v[1] + o.z[2] * v[2],
];

export const fromBody = (o: Orientation, v: Vec3): Vec3 => [
  o.x[0] * v[0] + o.y[0] * v[1] + o.z[0] * v[2],
  o.x[1] * v[0] + o.y[1] * v[1] + o.z[1] * v[2],
  o.x[2] * v[0] + o.y[2] * v[1] + o.z[2] * v[2],
];
