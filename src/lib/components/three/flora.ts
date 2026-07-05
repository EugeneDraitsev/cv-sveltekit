/**
 * Low-poly flora geometry for the planet flyover, one merged BufferGeometry
 * per kind so each biome's vegetation renders as a single InstancedMesh.
 *
 * Two-tone look: structural parts (trunks) carry fixed vertex colors while
 * foliage is white — the per-instance color tint applies mostly to foliage,
 * giving biome-colored canopies over consistent bark.
 */

import {
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  IcosahedronGeometry,
  Float32BufferAttribute,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FloraKind } from './starSystem';

function paint(geometry: BufferGeometry, r: number, g: number, b: number): BufferGeometry {
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

const BARK = [0.42, 0.3, 0.2] as const;
const FOLIAGE = [1, 1, 1] as const;

function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  return merged;
}

function buildTree(): BufferGeometry {
  const trunk = paint(new CylinderGeometry(0.05, 0.09, 0.55, 5), ...BARK);
  trunk.translate(0, 0.27, 0);
  const crownLower = paint(new ConeGeometry(0.52, 0.9, 6), ...FOLIAGE);
  crownLower.translate(0, 0.9, 0);
  const crownUpper = paint(new ConeGeometry(0.36, 0.7, 6), ...FOLIAGE);
  crownUpper.translate(0, 1.4, 0);
  return merge([trunk, crownLower, crownUpper]);
}

function buildPalm(): BufferGeometry {
  const trunk = paint(new CylinderGeometry(0.04, 0.07, 1.15, 5), ...BARK);
  trunk.translate(0, 0.57, 0);
  const fronds = paint(new ConeGeometry(0.6, 0.42, 6), ...FOLIAGE);
  fronds.translate(0, 1.25, 0);
  const tuft = paint(new ConeGeometry(0.3, 0.3, 5), ...FOLIAGE);
  tuft.translate(0, 1.48, 0);
  return merge([trunk, fronds, tuft]);
}

function buildCactus(): BufferGeometry {
  const body = paint(new CylinderGeometry(0.11, 0.13, 1.0, 6), ...FOLIAGE);
  body.translate(0, 0.5, 0);
  const armLeft = paint(new CylinderGeometry(0.06, 0.07, 0.42, 5), ...FOLIAGE);
  armLeft.translate(0.2, 0.72, 0);
  const armRight = paint(new CylinderGeometry(0.06, 0.07, 0.34, 5), ...FOLIAGE);
  armRight.translate(-0.2, 0.58, 0);
  return merge([body, armLeft, armRight]);
}

function buildShard(): BufferGeometry {
  const main = paint(new ConeGeometry(0.16, 1.15, 4), ...FOLIAGE);
  main.translate(0, 0.55, 0);
  const side = paint(new ConeGeometry(0.1, 0.6, 4), ...FOLIAGE);
  side.rotateZ(0.42);
  side.translate(0.2, 0.24, 0.05);
  return merge([main, side]);
}

function buildRock(): BufferGeometry {
  const rock = paint(new IcosahedronGeometry(0.34, 0), ...FOLIAGE);
  rock.scale(1, 0.72, 1);
  rock.translate(0, 0.18, 0);
  return merge([rock]);
}

export function createFloraGeometry(kind: Exclude<FloraKind, 'none'>): BufferGeometry {
  switch (kind) {
    case 'trees':
      return buildTree();
    case 'palms':
      return buildPalm();
    case 'cacti':
      return buildCactus();
    case 'shards':
      return buildShard();
    case 'rocks':
      return buildRock();
  }
}
