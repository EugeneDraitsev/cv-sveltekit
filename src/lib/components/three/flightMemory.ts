type Point = [number, number, number];
interface ViewMemory {
  time: number;
  position: Point;
  target: Point;
  fov: number;
}

/** Keep the frame we left, so the return flight ends at the visitor's view. */
export const flightMemory: {
  galaxy?: ViewMemory;
  system?: ViewMemory & { seed: number };
} = {};
