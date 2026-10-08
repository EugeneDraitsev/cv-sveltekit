import { mulberry32 } from './rng';
import { rotateY, type Vec3 } from '../engine/math';

/**
 * The explorable systems: a deterministic, stratified scatter along the four
 * spiral arms of the procedural galaxy. Each entry seeds a whole star system
 * (see system.ts); the GPU star field around them is decorative.
 */
export interface GalaxySystemSite {
  index: number;
  /** Position in the un-rotated galaxy frame. */
  position: Vec3;
  /** Seed for the system generator. */
  seed: number;
}

export const SYSTEM_COUNT = 160;

export const GALAXY_SITES: GalaxySystemSite[] = (() => {
  const random = mulberry32(92741);
  return Array.from({ length: SYSTEM_COUNT }, (_, index) => {
    const r = 2.7 + 10.2 * Math.sqrt((index + 0.5) / SYSTEM_COUNT);
    const arm = (index % 4) * Math.PI * 0.5;
    const a = 3.5 * Math.log(1 + r / 1.4) + arm + (random() - 0.5) * 0.3;
    const y = (random() - 0.5) * 0.5 + Math.sin(a * 2 + r * 0.3) * Math.max(0, (r - 7) / 7) * 0.38;
    return {
      index,
      position: [Math.cos(a) * r, y, Math.sin(a) * r] as Vec3,
      seed: Math.floor(random() * 0x7fffffff),
    };
  });
})();

/** World position of a site for the current galaxy rotation and thickness. */
export function siteWorld(site: GalaxySystemSite, angle: number, thickness = 1): Vec3 {
  const p = site.position;
  return rotateY([p[0], p[1] * thickness, p[2]], angle);
}
