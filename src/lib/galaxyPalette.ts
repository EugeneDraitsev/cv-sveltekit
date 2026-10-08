import type { Theme } from '$lib/stores/theme.svelte';

type Linear = { r: number; g: number; b: number };

/** One 0..255 sRGB channel → linear. */
function channel(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** sRGB hex → linear RGB (what the footer shader expects). */
function linear(hex: string): Linear {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: channel((n >> 16) & 255), g: channel((n >> 8) & 255), b: channel(n & 255) };
}

/** The site's galaxy palette, shared with the footer's interactive shader. */
export function getGalaxyColorPalette(theme: Theme = 'dark') {
  const dark = theme === 'dark';
  const galaxyInsideColor = linear('#0b1d95');
  const galaxyOutsideColor = linear(dark ? '#c3c5d8' : '#aa5a09');
  return {
    galaxyInsideColor,
    galaxyOutsideColor,
    nebulaInsideColor: dark ? galaxyInsideColor : linear('#2d345c'),
    nebulaOutsideColor: dark ? galaxyOutsideColor : linear('#000000'),
  };
}
