import { range, type Rng } from './rng';

/** sRGB components in 0..1. */
export type Rgb = [number, number, number];

export const hexToRgb = (hex: number): Rgb => [
  ((hex >> 16) & 255) / 255,
  ((hex >> 8) & 255) / 255,
  (hex & 255) / 255,
];

export const rgbToCss = (c: Rgb) =>
  `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`;

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const srgbToLinear = (c: Rgb): Rgb =>
  c.map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))) as Rgb;

/** Small brightness / hue jitter so two planets never share exact colours. */
export function jitterColor(rng: Rng, c: Rgb, amount: number): Rgb {
  const k = 1 + range(rng, -amount, amount);
  const shift = range(rng, -amount, amount) * 0.5;
  return [
    Math.min(1, Math.max(0, c[0] * k + shift)),
    Math.min(1, Math.max(0, c[1] * k)),
    Math.min(1, Math.max(0, c[2] * k - shift)),
  ];
}

/** Approximate black-body tint; keep in sync with kelvinColor in common.wgsl. */
export function kelvinRgb(kelvin: number): Rgb {
  const t = Math.min(14000, Math.max(2300, kelvin));
  if (t < 5000) {
    const f = (t - 2300) / 2700;
    return [1, 0.34 + f * 0.4, 0.12 + f * 0.47];
  }
  const f = Math.min(1, (t - 5000) / 7000);
  return [1 - f * 0.37, 0.76 + f * 0.13, 0.68 + f * 0.32];
}
