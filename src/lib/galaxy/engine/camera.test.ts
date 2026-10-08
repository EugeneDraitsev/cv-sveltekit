import { describe, expect, it } from 'vitest';
import { OrbitRig, centreDisk, orbitPose, poseBasis, projectDisk, type Pose } from './camera';
import type { Vec3 } from './math';

/** Vertical and horizontal middle of a disk's projected rim, in NDC. */
function rimMiddle(pose: Pose, radius: number, aspect: number) {
  const b = poseBasis(pose);
  const tanHalf = Math.tan((pose.fov * Math.PI) / 360);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const p: Vec3 = [Math.cos(a) * radius, 0, Math.sin(a) * radius];
    const rel = [0, 1, 2].map((k) => p[k] - pose.eye[k]);
    const dot = (v: Vec3) => rel[0] * v[0] + rel[1] * v[1] + rel[2] * v[2];
    const z = dot(b.forward);
    x0 = Math.min(x0, dot(b.right) / (z * tanHalf * aspect));
    x1 = Math.max(x1, dot(b.right) / (z * tanHalf * aspect));
    y0 = Math.min(y0, dot(b.up) / (z * tanHalf));
    y1 = Math.max(y1, dot(b.up) / (z * tanHalf));
  }
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

describe('centreDisk', () => {
  // The galaxy's opening view.
  const view = orbitPose([0, 0, 0], 0.55, 0.5, 34, 0.2, 38);

  it('starts off centre: perspective pulls the tilted disk low', () => {
    expect(rimMiddle(view, 13, 1.5).y).toBeLessThan(-0.1);
  });

  it('centres the projected rim and keeps the view direction', () => {
    const centred = centreDisk(view, [0, 0, 0], 13, 1.5);
    const middle = rimMiddle(centred, 13, 1.5);
    expect(Math.abs(middle.x)).toBeLessThan(0.01);
    expect(Math.abs(middle.y)).toBeLessThan(0.01);
    expect(centred.forward).toEqual(view.forward);
    expect(centred.up).toEqual(view.up);
  });

  it('applies the weights once, per axis', () => {
    const full = centreDisk(view, [0, 0, 0], 13, 1.5);
    const part = centreDisk(view, [0, 0, 0], 13, 1.5, 1, 0.6);
    const b = poseBasis(view);
    const up = (pose: Pose) =>
      [0, 1, 2].reduce((s, k) => s + (pose.eye[k] - view.eye[k]) * b.up[k], 0);
    expect(up(part) / up(full)).toBeCloseTo(0.6, 5);
  });

  it('leaves the rig alone once the camera is in among the stars', () => {
    const rig = new OrbitRig();
    rig.disk = { radius: 13, aspect: 1.5 };
    rig.set({ yaw: 0.55, pitch: 0.5, roll: 0.2, fov: 38, distance: 14 }, true);
    expect(rig.pose()).toEqual(orbitPose([0, 0, 0], 0.55, 0.5, 14, 0.2, 38));
  });
});

describe('projectDisk', () => {
  const tanHalf = Math.tan((38 * Math.PI) / 360);

  it('sees a disk from straight above as a circle', () => {
    const pose = orbitPose([0, 0, 0], 0, 1.45, 60, 0, 38);
    const disk = projectDisk(pose.eye, poseBasis(pose), tanHalf, 1.5, 13)!;
    expect(disk.b / disk.a).toBeGreaterThan(0.95);
    expect(Math.hypot(disk.cx, disk.cy)).toBeLessThan(0.01);
  });

  it('flattens a tilted disk into a wide ellipse', () => {
    const pose = orbitPose([0, 0, 0], 0.55, 0.5, 34, 0, 38);
    const disk = projectDisk(pose.eye, poseBasis(pose), tanHalf, 1.5, 13)!;
    expect(disk.a / disk.b).toBeGreaterThan(1.6);
    expect(Math.abs(disk.angle)).toBeLessThan(0.3);
  });

  it('gives up once the camera is inside the disk', () => {
    const pose = orbitPose([0, 0, 0], 0.55, 0.2, 6, 0, 38);
    expect(projectDisk(pose.eye, poseBasis(pose), tanHalf, 1.5, 13)).toBeNull();
  });
});
