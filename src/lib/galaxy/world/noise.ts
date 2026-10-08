/**
 * CPU twin of shaders/noise.wgsl. The hash is pure 32-bit integer maths
 * (Math.imul), so it is bit-identical to the GPU; the float parts differ only
 * by f32 rounding. Written allocation-free: collision and landing-site
 * searches call it thousands of times.
 */

const hx = new Uint32Array(3);

function pcg3(x: number, y: number, z: number) {
  let qx = (Math.imul(x >>> 0, 1664525) + 1013904223) >>> 0;
  let qy = (Math.imul(y >>> 0, 1664525) + 1013904223) >>> 0;
  let qz = (Math.imul(z >>> 0, 1664525) + 1013904223) >>> 0;
  qx = (qx + Math.imul(qy, qz)) >>> 0;
  qy = (qy + Math.imul(qz, qx)) >>> 0;
  qz = (qz + Math.imul(qx, qy)) >>> 0;
  qx = (qx ^ (qx >>> 16)) >>> 0;
  qy = (qy ^ (qy >>> 16)) >>> 0;
  qz = (qz ^ (qz >>> 16)) >>> 0;
  qx = (qx + Math.imul(qy, qz)) >>> 0;
  qy = (qy + Math.imul(qz, qx)) >>> 0;
  qz = (qz + Math.imul(qx, qy)) >>> 0;
  hx[0] = qx;
  hx[1] = qy;
  hx[2] = qz;
}

function gradDot(ix: number, iy: number, iz: number, fx: number, fy: number, fz: number) {
  pcg3(ix, iy, iz);
  return (
    ((hx[0] & 65535) / 32767.5 - 1) * fx +
    ((hx[1] & 65535) / 32767.5 - 1) * fy +
    ((hx[2] & 65535) / 32767.5 - 1) * fz
  );
}

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function gnoise(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fade(fx);
  const uy = fade(fy);
  const uz = fade(fz);
  const a = gradDot(ix, iy, iz, fx, fy, fz);
  const b = gradDot(ix + 1, iy, iz, fx - 1, fy, fz);
  const c = gradDot(ix, iy + 1, iz, fx, fy - 1, fz);
  const d = gradDot(ix + 1, iy + 1, iz, fx - 1, fy - 1, fz);
  const e = gradDot(ix, iy, iz + 1, fx, fy, fz - 1);
  const g = gradDot(ix + 1, iy, iz + 1, fx - 1, fy, fz - 1);
  const h = gradDot(ix, iy + 1, iz + 1, fx, fy - 1, fz - 1);
  const k = gradDot(ix + 1, iy + 1, iz + 1, fx - 1, fy - 1, fz - 1);
  return mix(mix(mix(a, b, ux), mix(c, d, ux), uy), mix(mix(e, g, ux), mix(h, k, ux), uy), uz);
}

export function fbm(x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.5;
  for (let i = 0; i < octaves; i++) {
    sum += gnoise(x, y, z) * amp;
    x = x * 2.03 + 1.7;
    y = y * 2.03 + 9.2;
    z = z * 2.03 + 4.3;
    amp *= 0.5;
  }
  return sum;
}

export function ridged(x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amp = 0.55;
  let prev = 1;
  for (let i = 0; i < octaves; i++) {
    const g = gnoise(x, y, z);
    let n = Math.max(1 - Math.sqrt(g * g * 2.56 + 0.004), 0);
    n *= n;
    sum += n * amp * (0.35 + 0.65 * prev);
    prev = n;
    x = x * 2.07 + 5.1;
    y = y * 2.07 + 1.3;
    z = z * 2.07 + 8.7;
    amp *= 0.48;
  }
  return sum;
}

/** Nearest feature distance and the hash of its cell; see cellular() in WGSL. */
export function cellular(x: number, y: number, z: number): [number, number] {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const cz = Math.floor(z);
  let best = 9;
  let id = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ix = cx + dx;
        const iy = cy + dy;
        const iz = cz + dz;
        pcg3((ix + 7919) | 0, (iy + 7919) | 0, (iz + 7919) | 0);
        const rx = (hx[0] & 65535) / 65535;
        const ry = (hx[1] & 65535) / 65535;
        const rz = (hx[2] & 65535) / 65535;
        const px = ix + 0.15 + rx * 0.7 - x;
        const py = iy + 0.15 + ry * 0.7 - y;
        const pz = iz + 0.15 + rz * 0.7 - z;
        const dist = Math.sqrt(px * px + py * py + pz * pz);
        if (dist < best) {
          best = dist;
          id = rx;
        }
      }
    }
  }
  return [best, id];
}
