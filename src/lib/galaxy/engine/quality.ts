export interface Quality {
  name: 'low' | 'medium' | 'high';
  /** Render-scale multiplier on top of the device pixel ratio cap. */
  scale: number;
  /** Max rendered pixels in space and on a planet surface. */
  pixelBudget: number;
  surfaceBudget: number;
  maxDpr: number;
  /** Galaxy volume atlas resolution (x, slices, z). */
  volume: [number, number, number];
  steps: number;
  stars: number;
  skyStars: number;
}

export interface DeviceHints {
  compact: boolean;
  touch: boolean;
  cores: number;
  memory: number;
  software: boolean;
}

/**
 * A conservative starting point; the engine lowers the render scale further
 * when sustained frame times show it is needed.
 */
export function pickQuality(h: DeviceHints): Quality {
  if (h.software) {
    return {
      name: 'low',
      scale: 0.5,
      pixelBudget: 250_000,
      surfaceBudget: 200_000,
      maxDpr: 1,
      volume: [96, 24, 96],
      steps: 40,
      stars: 30_000,
      skyStars: 1500,
    };
  }
  const weak = h.compact || h.touch || h.cores <= 4 || h.memory <= 4;
  if (weak) {
    return {
      name: 'medium',
      scale: 1,
      pixelBudget: 900_000,
      surfaceBudget: 650_000,
      maxDpr: 1.5,
      volume: [128, 32, 128],
      steps: 64,
      stars: 90_000,
      skyStars: 4000,
    };
  }
  return {
    name: 'high',
    scale: 1,
    pixelBudget: 2_100_000,
    surfaceBudget: 1_300_000,
    maxDpr: 1.5,
    volume: [192, 48, 192],
    steps: 112,
    stars: 240_000,
    skyStars: 6000,
  };
}

/**
 * Apply a user-chosen preset on top of the device pick. Only the knobs that
 * can change at runtime move; buffer sizes stay as the device pick made them.
 */
export function withPreset(device: Quality, preset: 'auto' | Quality['name']): Quality {
  if (preset === 'auto') return device;
  const hints: DeviceHints =
    preset === 'low'
      ? { compact: true, touch: true, cores: 2, memory: 2, software: true }
      : preset === 'medium'
        ? { compact: true, touch: true, cores: 4, memory: 4, software: false }
        : { compact: false, touch: false, cores: 16, memory: 16, software: false };
  const p = pickQuality(hints);
  return {
    ...device,
    scale: p.scale,
    pixelBudget: p.pixelBudget,
    surfaceBudget: p.surfaceBudget,
    maxDpr: p.maxDpr,
    steps: p.steps,
  };
}

/** Render size for a CSS-pixel canvas, bounded by the pixel budget. */
export function renderSize(
  cssWidth: number,
  cssHeight: number,
  dpr: number,
  quality: Quality,
  adaptive: number,
  surface: boolean,
): [number, number] {
  const ratio = Math.min(dpr || 1, quality.maxDpr) * quality.scale * adaptive;
  const budget = surface ? quality.surfaceBudget : quality.pixelBudget;
  const fit = Math.min(1, Math.sqrt(budget / Math.max(1, cssWidth * cssHeight * ratio * ratio)));
  return [
    Math.max(1, Math.round(cssWidth * ratio * fit)),
    Math.max(1, Math.round(cssHeight * ratio * fit)),
  ];
}
