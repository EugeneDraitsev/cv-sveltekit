import { describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createCameraFlight } from './cameraTween';
import type { CameraFlight } from './cameraTween';
import { createLandingPath } from './landingPath';
import { getStarSystem } from './starSystem';
import { sampleGround, createClimate } from './terrain';

function advance(flight: CameraFlight, seconds: number) {
  for (let time = 0; time < seconds; time += 1 / 60) flight.advance(1 / 60);
}
describe('camera flights', () => {
  it('starts gently, flies a curve, and reports the exact destination once', () => {
    const camera = new PerspectiveCamera(45);
    camera.position.set(0, 0, 20);
    const arrived = vi.fn();
    const progress = vi.fn();
    const flight = createCameraFlight(
      camera,
      undefined,
      { position: [0, 0, 3], target: [0, 0, 0], arc: 0.2, fov: 60 },
      1,
      { onComplete: arrived, onProgress: progress },
    );
    flight.advance(1 / 60);
    expect(camera.position.distanceTo(new Vector3(0, 0, 20))).toBeLessThan(0.002);
    advance(flight, 0.48);
    expect(Math.abs(camera.position.x)).toBeGreaterThan(2);
    expect(arrived).not.toHaveBeenCalled();
    advance(flight, 0.8);
    expect(camera.position.distanceTo(new Vector3(0, 0, 3))).toBeLessThan(1e-8);
    expect(camera.fov).toBe(60);
    expect(progress).toHaveBeenLastCalledWith(1, 1);
    expect(arrived).toHaveBeenCalledTimes(1);
  });
  it('does not snap a departure back to OrbitControls maxDistance', () => {
    const camera = new PerspectiveCamera();
    camera.position.set(0, 0, 20);
    const controls = new OrbitControls(camera);
    controls.maxDistance = 30;
    controls.enableDamping = true;
    const original = controls.update;
    const atHandoff = vi.fn(() => camera.position.clone());
    const flight = createCameraFlight(
      camera,
      controls,
      { position: [0, 0, 150], target: [0, 0, 0] },
      1,
      { handoff: true, onComplete: atHandoff },
    );
    advance(flight, 1.2);
    expect(camera.position.z).toBeCloseTo(150, 8);
    expect(atHandoff.mock.results[0].value.z).toBeCloseTo(150, 8);
    expect(controls.update).toBe(original);
    flight.cancel();
    expect(camera.position.z).toBeCloseTo(150, 8);
  });
  it('a stopped scene clock holds the flight and cancellation never signals arrival', () => {
    const camera = new PerspectiveCamera();
    camera.position.z = 20;
    const arrived = vi.fn();
    const flight = createCameraFlight(
      camera,
      undefined,
      { position: [0, 0, 2], target: [0, 0, 0] },
      1,
      { onComplete: arrived },
    );
    advance(flight, 0.2);
    const position = camera.position.clone();
    flight.advance(0);
    expect(camera.position.equals(position)).toBe(true);
    flight.cancel();
    advance(flight, 2);
    expect(camera.position.equals(position)).toBe(true);
    expect(arrived).not.toHaveBeenCalled();
  });
});
describe('atmospheric entry', () => {
  it('has matching initial/final poses and clears terrain without following every bump', () => {
    for (const seed of [0, 7, 42, 1234]) {
      for (const { surface } of getStarSystem(seed).planets) {
        const climate = createClimate(surface);
        const ground = (x: number, z: number) => sampleGround(x, z, surface, climate).ground;
        const path = createLandingPath(ground);
        expect(path(0).height).toBe(ground(0, 0) + 96);
        expect(path(1).height).toBeCloseTo(ground(0, -80) + 6, 8);
        expect(Math.abs(path(0.001).height - path(0).height)).toBeLessThan(0.001);
        expect(Math.abs(path(0.999).height - path(1).height)).toBeLessThan(0.001);
        for (let i = 0; i <= 256; i++) {
          const point = path(i / 256);
          expect(point.height - ground(point.x, point.z)).toBeGreaterThan(2);
        }
      }
    }
  });
});
