import themeStore from '$lib/stores/theme.svelte';
import { Color } from 'three';

function getGalaxyColors() {
  return {
    insideColor: new Color(themeStore.theme === 'dark' ? '#0b1d95' : '#bdc2f1'),
    outsideColor: new Color(themeStore.theme === 'dark' ? '#aa837e' : '#aa5a09'),
  };
}

export const parameters = {
  particleSize: 7,
  count: 100_000,
  radius: 20,
  branches: 5,
  spin: 1,
  randomness: 0.82,
  randomnessPower: 7.8,
  ...getGalaxyColors(),
};

export const generateGalaxy = (newParameters = parameters) => {
  const positions = new Float32Array(newParameters.count * 3);
  const randomness = new Float32Array(newParameters.count * 3);
  const colors = new Float32Array(newParameters.count * 3);
  const radii = new Array(newParameters.count);
  const scales = new Float32Array(newParameters.count);

  for (let i = 0; i < newParameters.count; i++) {
    const i3 = i * 3;
    const radius = Math.random() * newParameters.radius;
    const branchAngle = ((i % newParameters.branches) / newParameters.branches) * Math.PI * 2;
    radii[i] = radius;

    // Position
    positions[i3] = Math.cos(branchAngle) * radius;
    positions[i3 + 1] = 0.0;
    positions[i3 + 2] = Math.sin(branchAngle) * radius;

    // Randomness
    const randomX =
      Math.pow(Math.random(), newParameters.randomnessPower) *
      (Math.random() < 0.5 ? 1 : -1) *
      newParameters.randomness *
      radius;
    const randomY =
      Math.pow(Math.random(), newParameters.randomnessPower) *
      (Math.random() < 0.5 ? 1 : -1) *
      newParameters.randomness *
      radius;
    const randomZ =
      Math.pow(Math.random(), newParameters.randomnessPower) *
      (Math.random() < 0.5 ? 1 : -1) *
      newParameters.randomness *
      radius;

    randomness[i3] = randomX;
    randomness[i3 + 1] = randomY;
    randomness[i3 + 2] = randomZ;

    const mixedColor = newParameters.insideColor.clone();
    mixedColor.lerp(newParameters.outsideColor, radius / newParameters.radius);

    colors[i3] = mixedColor.r;
    colors[i3 + 1] = mixedColor.g;
    colors[i3 + 2] = mixedColor.b;

    // Scale
    scales[i] = Math.random() * 25;
  }

  return { positions, randomness, colors, scales, radii };
};

const initialData = generateGalaxy();

export const positions = initialData.positions;
export const randomness = initialData.randomness;
export const colors = initialData.colors;
export const scales = initialData.scales;
const radii = initialData.radii;

export function syncGalaxyColor() {
  const { insideColor, outsideColor } = getGalaxyColors();

  if (insideColor.equals(parameters.insideColor) && outsideColor.equals(parameters.outsideColor)) {
    return;
  }

  parameters.insideColor = insideColor;
  parameters.outsideColor = outsideColor;

  for (let i = 0; i < parameters.count; i++) {
    const i3 = i * 3;
    const radius = radii[i];
    const mixedColor = insideColor.clone();
    mixedColor.lerp(outsideColor, radius / parameters.radius);

    colors[i3] = mixedColor.r;
    colors[i3 + 1] = mixedColor.g;
    colors[i3 + 2] = mixedColor.b;
  }
}
