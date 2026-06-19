/**
 * Galaxy particle and structure parameters
 */
export interface GalaxyParams {
  particleSize: number;
  count: number;
  radius: number;
  branches: number;
  spin: number;
  randomness: number;
  randomnessPower: number;
  armWidth: number;
  diskThickness: number;
  nebulaIntensity: number;
  nebulaSize: number;
  nebulaParticleSize: number;
  nebulaParticleRatio: number;
}

/**
 * Camera position and settings
 */
export interface CameraParams {
  fov: number;
  distance: number;
  positionX: number;
  positionY: number;
  positionZ: number;
}

/**
 * Props for the GalaxyDebugPanel component
 */
export interface GalaxyDebugPanelProps {
  galaxyParams: GalaxyParams;
  cameraParams: CameraParams;
  galaxyInsideHex: string;
  galaxyOutsideHex: string;
  nebulaInsideHex: string;
  nebulaOutsideHex: string;
  onRegenerate: () => void;
  onSetColors: () => void;
  onResetColors: () => void;
}

/**
 * Geometric scene parameters
 */
export interface GeometricParams {
  speed: number;
  elevationScale: number;
  noiseScale: number;
  biomeThreshold: number;
  wireframe: boolean;
  biome: number; // -1 for Auto, 0..3 for override
  fogDist: number;
  freeLook: boolean;
}

