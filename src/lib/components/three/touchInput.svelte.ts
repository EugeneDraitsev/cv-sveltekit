/**
 * Shared state between the DOM touch-controls overlay (joystick + action
 * buttons in ThrelteApp) and the PlanetScene flight loop. The overlay writes,
 * the frame loop reads — no events, no timing coupling.
 */
export const touchInput = $state({
  /** True while the touch overlay is mounted; disables the passive auto-cruise. */
  active: false,
  /** Strafe, -1..1 (right positive). */
  moveX: 0,
  /** Forward along the look direction, -1..1. */
  moveY: 0,
  /** Climb (Space equivalent). */
  up: false,
  down: false,
  /** Boost (Shift equivalent). */
  boost: false,
});

export function resetTouchInput() {
  touchInput.moveX = 0;
  touchInput.moveY = 0;
  touchInput.up = false;
  touchInput.down = false;
  touchInput.boost = false;
}
