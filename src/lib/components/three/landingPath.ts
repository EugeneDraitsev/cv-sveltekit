import { easeInOutQuint } from './cameraTween';

/** A continuous flight in world space, independent of bumps under the camera. */
export function createLandingPath(groundAt: (x: number, z: number) => number) {
  const startHeight = groundAt(0, 0) + 96;
  const endHeight = groundAt(0, -80) + 6;
  let controlHeight = Math.max(startHeight, endHeight + 45);
  // Lift the curve over intermediate ridges once, before the flight starts.
  for (let i = 1; i < 64; i++) {
    const e = i / 64;
    const ground = groundAt(Math.sin(Math.PI * e) * 18, -80 * e) + 6;
    controlHeight = Math.max(
      controlHeight,
      (ground - startHeight * (1 - e) ** 2 - endHeight * e * e) / (2 * e * (1 - e)),
    );
  }
  return (progress: number) => {
    const e = easeInOutQuint(Math.min(1, Math.max(0, progress)));
    return {
      x: Math.sin(Math.PI * e) * 18,
      z: -80 * e,
      height: (1 - e) ** 2 * startHeight + 2 * e * (1 - e) * controlHeight + e * e * endHeight,
      pitch: -0.55 + e * 0.47,
      bank: -0.035 * Math.sin(Math.PI * e) ** 2,
    };
  };
}
