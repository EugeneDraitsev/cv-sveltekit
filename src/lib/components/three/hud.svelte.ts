/**
 * Shared state for the hover HUD (reticle + label) drawn over the 3D canvas.
 *
 * Identity (title/subtitle/visibility) flows through reactive $state — it
 * changes rarely. Screen position updates every frame while the galaxy spins,
 * so it bypasses reactivity entirely and writes transform onto the registered
 * element directly.
 */

export interface HudContent {
  title: string;
  subtitle: string;
  hint: string;
  /** Force the light HUD palette over always-dark scene backdrops. */
  onDark: boolean;
}

export const hudState = $state<HudContent & { visible: boolean }>({
  visible: false,
  title: '',
  subtitle: '',
  hint: '',
  onDark: false,
});

let hudElement: HTMLElement | null = null;

export function bindHudElement(el: HTMLElement | null) {
  hudElement = el;
}

export function setHudScreenPosition(x: number, y: number) {
  if (hudElement) {
    hudElement.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }
}

export function showHud(content: Partial<HudContent>) {
  hudState.title = content.title ?? '';
  hudState.subtitle = content.subtitle ?? '';
  hudState.hint = content.hint ?? '';
  hudState.onDark = content.onDark ?? false;
  hudState.visible = true;
}

export function hideHud() {
  hudState.visible = false;
}
