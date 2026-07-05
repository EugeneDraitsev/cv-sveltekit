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
  onActivate?: () => void;
}

export const hudState = $state<
  HudContent & { visible: boolean; side: 'left' | 'right'; vertical: 'above' | 'below' }
>({
  visible: false,
  title: '',
  subtitle: '',
  hint: '',
  onDark: false,
  onActivate: undefined,
  side: 'right',
  vertical: 'above',
});

let hudElement: HTMLElement | null = null;

export function bindHudElement(el: HTMLElement | null) {
  hudElement = el;
}

export function setHudScreenPosition(x: number, y: number) {
  if (hudElement) {
    const layer = hudElement.parentElement;
    const card = hudElement.querySelector<HTMLElement>('.hud-card');
    const width = layer?.clientWidth ?? window.innerWidth;
    const height = layer?.clientHeight ?? window.innerHeight;
    const cardWidth = card?.offsetWidth ?? 220;
    const cardHeight = card?.offsetHeight ?? 86;
    const margin = 28;
    const compact = width <= 640;

    const side = !compact && x > width - cardWidth - 72 ? 'left' : 'right';
    const vertical = y < cardHeight + 58 ? 'below' : 'above';
    if (hudState.side !== side) hudState.side = side;
    if (hudState.vertical !== vertical) hudState.vertical = vertical;

    const measuredCardWidth = Math.min(cardWidth, Math.max(0, width - margin * 2));
    const minCompactX = margin + measuredCardWidth / 2;
    const maxCompactX = width - margin - measuredCardWidth / 2;
    const clampedX = compact
      ? minCompactX <= maxCompactX
        ? Math.min(maxCompactX, Math.max(minCompactX, x))
        : width / 2
      : Math.min(width - margin, Math.max(margin, x));
    const clampedY = Math.min(height - margin, Math.max(margin, y));
    hudElement.style.transform = `translate3d(${clampedX.toFixed(1)}px, ${clampedY.toFixed(1)}px, 0)`;
  }
}

export function showHud(content: Partial<HudContent>) {
  hudState.title = content.title ?? '';
  hudState.subtitle = content.subtitle ?? '';
  hudState.hint = content.hint ?? '';
  hudState.onDark = content.onDark ?? false;
  hudState.onActivate = content.onActivate;
  hudState.visible = true;
}

export function hideHud() {
  hudState.visible = false;
  hudState.onActivate = undefined;
}

export function activateHud() {
  hudState.onActivate?.();
}
