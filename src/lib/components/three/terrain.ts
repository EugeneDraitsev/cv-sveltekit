import { biomeWeights, fbm5, snoise2 } from './noise';
import type { ClimateParams } from './noise';
import type { SurfaceParams } from './starSystem';

export function createClimate(surface: SurfaceParams): ClimateParams {
  return { ...surface, centers: surface.biomes.map((biome) => biome.climate) };
}

/** Mirrors rawHeight in terrainVertexShader.glsl; flora and collision share it. */
export function terrainHeight(
  x: number,
  y: number,
  surface: SurfaceParams,
  weights: number[],
): number {
  const px = x * surface.terrainScale;
  const py = y * surface.terrainScale;
  const base = fbm5(px, py);
  const broad = snoise2(px * 0.5, py * 0.5);
  let mul = 0;
  let dunes = 0;
  let ridges = 0;
  let terraces = 0;
  surface.biomes.forEach((biome, i) => {
    mul += weights[i] * biome.heightMul;
    if (biome.relief === 1) dunes += weights[i];
    if (biome.relief === 2) ridges += weights[i];
    if (biome.relief === 3) terraces += weights[i];
  });
  let height = base;
  height += (Math.sin(px * 3 + broad * 2.4) * 0.24 + broad * 0.18 - base) * dunes;
  height += (0.38 - Math.abs(base) * 1.65 + broad * 0.2 - base) * ridges;
  // Smooth terraces, never discontinuous steps that can clip the camera.
  height += (base - Math.sin(base * 18) * 0.025 - base) * terraces;
  if (surface.cloudMode) height = base * 0.5 + broad * 0.3;
  return height * surface.heightScale * mul;
}

export function sampleGround(
  wx: number,
  wz: number,
  surface: SurfaceParams,
  climate = createClimate(surface),
) {
  const x = wx + surface.offsetX;
  const y = surface.offsetY - wz;
  const weights = biomeWeights(x, y, climate);
  const h = terrainHeight(x, y, surface, weights);
  const waterHeight = (surface.waterLevel - 0.5) * 1.6 * surface.heightScale;
  let biomeIndex = 0;
  for (let i = 1; i < weights.length; i++) if (weights[i] > weights[biomeIndex]) biomeIndex = i;
  return { h, ground: surface.waterLevel >= 0 ? Math.max(h, waterHeight) : h, biomeIndex, weights };
}
