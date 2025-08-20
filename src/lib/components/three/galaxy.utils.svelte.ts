import { Color } from 'three';

import themeStore from '$lib/stores/theme.svelte';

function toColor(input?: string | Color): Color | undefined {
  if (!input) return undefined;
  return input instanceof Color ? input : new Color(input);
}
// Optional color overrides for external control
export const customGalaxyColors: { inside?: Color; outside?: Color } = $state({});
export const customNebulaColors: { inside?: Color; outside?: Color } = $state({});

export const parameters = {
  particleSize: 3.5, // Reduced particle size for more realism
  count: 150_000, // Increased count for more detail
  radius: 20,
  branches: 3, // Reduced number of spiral arms for fewer, more prominent sleeves
  spin: 1.0, // Moderate spin for clear spiral pattern
  randomness: 0.5, // Reduced randomness for more defined structure
  randomnessPower: 6.0, // Increased power for less variability and more defined arms
  armWidth: 0.2, // Narrower arms for more defined structure
  diskThickness: 0.1, // Controls the thickness of the galaxy disk
  nebulaIntensity: 0.5, // Reduced intensity for less prominent nebula
  nebulaSize: 1.0, // Controls the size of the nebula relative to galaxy radius
  nebulaParticleSize: 1.0, // Controls the size of nebula particles
  nebulaParticleRatio: 0.5, // Controls what percentage of particles are nebula vs galaxy
  ...getGalaxyColors(),
};

// Generate initial galaxy data
const initialData = generateGalaxy();

// Export mutable references that will be updated when regenerateGalaxy is called
export let positions = initialData.positions;
export let randomness = initialData.randomness;
export let colors = initialData.colors;
export let scales = initialData.scales;
export let isNebula = initialData.isNebula;
let radii = initialData.radii;

function getGalaxyColors() {
  const isDark = themeStore.theme === 'dark';

  // Theme defaults
  const defaultGalaxyInside = new Color(isDark ? '#0b1d95' : '#0b1d95');
  const defaultGalaxyOutside = new Color(isDark ? '#c3c5d8' : '#aa5a09');
  const defaultNebulaInside = isDark ? defaultGalaxyInside.clone() : new Color('rgb(45,52,92)');
  const defaultNebulaOutside = isDark ? defaultGalaxyOutside.clone() : new Color('#000000');

  // Apply overrides independen tly if provided
  const galaxyInside = customGalaxyColors?.inside ?? defaultGalaxyInside;
  const galaxyOutside = customGalaxyColors?.outside ?? defaultGalaxyOutside;
  const nebulaInside = customNebulaColors?.inside ?? defaultNebulaInside;
  const nebulaOutside = customNebulaColors?.outside ?? defaultNebulaOutside;

  return {
    galaxyInsideColor: galaxyInside,
    galaxyOutsideColor: galaxyOutside,
    nebulaInsideColor: nebulaInside,
    nebulaOutsideColor: nebulaOutside,
    // Backward-compat fields used by older code paths (mirror galaxy colors)
    insideColor: galaxyInside,
    outsideColor: galaxyOutside,
  };
}

function generateGalaxy(newParameters = parameters) {
  const positions = new Float32Array(newParameters.count * 3);
  const randomness = new Float32Array(newParameters.count * 3);
  const colors = new Float32Array(newParameters.count * 3);
  const radii = new Array(newParameters.count);
  const scales = new Float32Array(newParameters.count);
  const isNebula = new Float32Array(newParameters.count); // Flag for nebula particles

  // Calculate how many particles should be part of the nebula (concentrated in center)
  const nebulaParticleCount = Math.floor(newParameters.count * newParameters.nebulaParticleRatio); // Configurable percentage of particles for nebula

  for (let i = 0; i < newParameters.count; i++) {
    const i3 = i * 3;

    // Determine if this particle is part of the nebula
    const isNebulaParticle = i < nebulaParticleCount;
    isNebula[i] = isNebulaParticle ? 1.0 : 0.0;

    // For nebula particles, concentrate them in the center with a different distribution
    let radius;
    if (isNebulaParticle) {
      // Nebula particles are concentrated in the center with exponential falloff
      // Use nebulaSize parameter to control the size of the nebula relative to galaxy radius
      radius = Math.pow(Math.random(), 1.8) * newParameters.radius * newParameters.nebulaSize;
    } else {
      // Regular galaxy particles follow the original distribution
      radius = Math.random() * newParameters.radius;
    }

    radii[i] = radius;

    // Branch angle (nebula particles can be more evenly distributed)
    let branchAngle;

    if (isNebulaParticle) {
      // Random angle for nebula
      branchAngle = Math.random() * Math.PI * 2;
    } else {
      // For regular galaxy particles, create a more natural spiral pattern
      // Base angle for the branch
      const branchBaseAngle = ((i % newParameters.branches) / newParameters.branches) * Math.PI * 2;

      // Add variation within each branch to make them wider
      // This creates a gaussian-like distribution around the branch center line
      const armWidthFactor = newParameters.armWidth || 0.4;
      const randomArmOffset = (Math.random() - 0.5) * armWidthFactor;

      // Add spiral effect based on radius
      const spiralFactor = radius * newParameters.spin;

      // Combine all factors for final angle
      branchAngle = branchBaseAngle + spiralFactor + randomArmOffset;
    }

    // Position with spiral pattern
    positions[i3] = Math.cos(branchAngle) * radius;
    // All particles at same height (y=0)
    positions[i3 + 1] = 0.0;
    positions[i3 + 2] = Math.sin(branchAngle) * radius;

    // Randomness - controlled to maintain disk shape
    const randomnessFactor = isNebulaParticle
      ? newParameters.randomness * 1.5 // More randomness for nebula to make it more spherical
      : newParameters.randomness * 0.8; // Less randomness for sleeves to make them less prominent

    const randomPower = isNebulaParticle
      ? newParameters.randomnessPower * 0.9 // Slightly less power for nebula
      : newParameters.randomnessPower;

    // Horizontal randomness (X and Z) - maintains the spiral arm structure
    const randomX =
      Math.pow(Math.random(), randomPower) *
      (Math.random() < 0.5 ? 1 : -1) *
      randomnessFactor *
      radius;

    // Vertical randomness (Y) - adjusted for different particle types
    // Use diskThickness parameter to control the vertical spread
    const diskThicknessFactor = newParameters.diskThickness || 0.1;
    const randomY = isNebulaParticle
      ? // For nebula particles - more vertical randomness for spherical shape
        Math.pow(Math.random(), randomPower * 0.8) * // Lower power for less concentration
        (Math.random() < 0.5 ? 1 : -1) *
        randomnessFactor *
        radius *
        0.6 // Much higher vertical spread for more spherical nebula (increased from 0.5)
      : // For sleeve particles - highly constrained to create disk shape
        Math.pow(Math.random(), randomPower * 1.5) * // Higher power for more concentration
        (Math.random() < 0.5 ? 1 : -1) *
        randomnessFactor *
        radius *
        diskThicknessFactor; // Apply disk thickness constraint

    const randomZ =
      Math.pow(Math.random(), randomPower) *
      (Math.random() < 0.5 ? 1 : -1) *
      randomnessFactor *
      radius;

    randomness[i3] = randomX;
    randomness[i3 + 1] = randomY;
    randomness[i3 + 2] = randomZ;

    // Color - special handling for nebula particles with separate palettes
    const baseInside = isNebulaParticle
      ? newParameters.nebulaInsideColor
      : newParameters.galaxyInsideColor;
    const baseOutside = isNebulaParticle
      ? newParameters.nebulaOutsideColor
      : newParameters.galaxyOutsideColor;
    const mixedColor = baseInside.clone();

    if (isNebulaParticle) {
      // Nebula particles have more of the inside color with a slight variation
      const nebulaColorMix = radius / (newParameters.radius * 0.5); // Normalized radius within nebula
      mixedColor.lerp(baseOutside, nebulaColorMix * 0.3); // Less outside color influence

      // Slightly brighten the nebula center (reduced brightness)
      if (radius < newParameters.radius * 0.1) {
        mixedColor.multiplyScalar(1.3); // Less bright center (reduced from 1.5)
      }
    } else {
      // Regular galaxy particles use the standard color lerp
      mixedColor.lerp(baseOutside, radius / newParameters.radius);
    }

    colors[i3] = mixedColor.r;
    colors[i3 + 1] = mixedColor.g;
    colors[i3 + 2] = mixedColor.b;

    // Scale - smaller and more variable
    if (isNebulaParticle) {
      // Nebula particles are generally smaller but with high variability
      // Use nebulaParticleSize parameter to control the size of nebula particles
      scales[i] = (Math.random() * 25 + 10) * newParameters.nebulaParticleSize; // Base range 10-35, scaled by parameter

      // Central nebula particles can be larger
      if (radius < newParameters.radius * 0.18 * newParameters.nebulaSize) {
        // Radius threshold adjusted by nebula size
        scales[i] *= 2.0; // Even larger particles in the center
      }
    } else {
      // Regular galaxy particles have a different size distribution
      // Exponential distribution for more small particles
      scales[i] = Math.pow(Math.random(), 1.5) * 20 + 2; // More small particles, fewer large ones
    }
  }

  return { positions, randomness, colors, scales, radii, isNebula };
}

/**
 * Regenerates the entire galaxy with current parameters
 * This function updates all the exported arrays with new data
 */
export function regenerateGalaxy() {
  const newData = generateGalaxy(parameters);

  // Update all the exported references with new data
  positions = newData.positions;
  randomness = newData.randomness;
  colors = newData.colors;
  scales = newData.scales;
  isNebula = newData.isNebula;
  radii = newData.radii;

  return newData;
}

export function setGalaxyColors(inside: string | Color, outside: string | Color) {
  customGalaxyColors.inside = toColor(inside);
  customGalaxyColors.outside = toColor(outside);
}

export function setNebulaColors(inside: string | Color, outside: string | Color) {
  customNebulaColors.inside = toColor(inside);
  customNebulaColors.outside = toColor(outside);
}

export function clearColorOverrides() {
  customGalaxyColors.inside = undefined;
  customGalaxyColors.outside = undefined;
  customNebulaColors.inside = undefined;
  customNebulaColors.outside = undefined;
}

export function syncGalaxyColor() {
  const {
    galaxyInsideColor,
    galaxyOutsideColor,
    nebulaInsideColor,
    nebulaOutsideColor,
    insideColor,
    outsideColor,
  } = getGalaxyColors();

  parameters.galaxyInsideColor = galaxyInsideColor;
  parameters.galaxyOutsideColor = galaxyOutsideColor;
  parameters.nebulaInsideColor = nebulaInsideColor;
  parameters.nebulaOutsideColor = nebulaOutsideColor;
  // Keep backward-compat mirrors
  parameters.insideColor = insideColor;
  parameters.outsideColor = outsideColor;

  for (let i = 0; i < parameters.count; i++) {
    const i3 = i * 3;
    const radius = radii[i];
    const nebula = isNebula[i] > 0.5;
    const baseInside = nebula ? nebulaInsideColor : galaxyInsideColor;
    const baseOutside = nebula ? nebulaOutsideColor : galaxyOutsideColor;

    const mixedColor = baseInside.clone();

    if (nebula) {
      // Nebula particles have more of the inside color with a slight variation
      const nebulaColorMix = radius / (parameters.radius * 0.5); // Normalized radius within nebula
      mixedColor.lerp(baseOutside, nebulaColorMix * 0.3); // Less outside color influence

      // Slightly brighten the nebula center (reduced brightness)
      if (radius < parameters.radius * 0.1) {
        mixedColor.multiplyScalar(1.3);
      }
    } else {
      // Regular galaxy particles use the standard color lerp
      mixedColor.lerp(baseOutside, radius / parameters.radius);
    }

    colors[i3] = mixedColor.r;
    colors[i3 + 1] = mixedColor.g;
    colors[i3 + 2] = mixedColor.b;
  }
}
