import type { Color } from 'three';

/**
 * Default camera settings for the galaxy scene
 */
export const DEFAULT_CAMERA = {
  fov: 20,
  distance: 30,
  positionX: -20,
  positionY: 16,
  positionZ: 20,
} as const;

/**
 * Keys that trigger galaxy regeneration when changed
 */
export const STRUCTURAL_KEYS = [
  'count',
  'radius',
  'branches',
  'spin',
  'randomness',
  'randomnessPower',
  'armWidth',
  'diskThickness',
  'nebulaSize',
  'nebulaParticleSize',
  'nebulaParticleRatio',
] as const;

/**
 * Convert Three.js Color to hex string for UI color pickers
 */
export function colorToHex(c: Color | undefined): string {
  return c ? `#${c.getHexString()}` : '#ffffff';
}

/**
 * Create a snapshot string for comparing structural parameters
 */
export function createParamsSnapshot<T extends object>(
  obj: T,
  keys: readonly (keyof T)[] = STRUCTURAL_KEYS as unknown as (keyof T)[],
): string {
  return JSON.stringify(keys.map((k) => obj[k]));
}
