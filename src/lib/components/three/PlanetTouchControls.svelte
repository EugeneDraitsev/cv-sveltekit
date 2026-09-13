<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';

  import { touchInput, resetTouchInput } from './touchInput.svelte';

  /** Max knob travel from the pad center, px. */
  const RADIUS = 38;
  const DEADZONE = 0.14;

  let padEl = $state<HTMLDivElement>();
  let knobX = $state(0);
  let knobY = $state(0);
  let stickPointer: number | null = null;

  onMount(() => {
    touchInput.active = true;
    const releaseAll = () => {
      releaseStick();
      resetTouchInput();
    };
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('blur', releaseAll);
      touchInput.active = false;
      resetTouchInput();
    };
  });

  function updateStick(clientX: number, clientY: number) {
    if (!padEl) return;
    const rect = padEl.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    knobX = dx;
    knobY = dy;

    const nx = dx / RADIUS;
    const ny = dy / RADIUS;
    const mag = Math.hypot(nx, ny);
    if (mag < DEADZONE) {
      touchInput.moveX = 0;
      touchInput.moveY = 0;
      return;
    }
    // Rescale so the deadzone edge maps to 0 and the rim to 1.
    const scale = (mag - DEADZONE) / (1 - DEADZONE) / mag;
    touchInput.moveX = nx * scale;
    touchInput.moveY = -ny * scale; // stick up = fly forward
  }

  function releaseStick() {
    stickPointer = null;
    knobX = 0;
    knobY = 0;
    touchInput.moveX = 0;
    touchInput.moveY = 0;
  }

  function onStickDown(event: PointerEvent) {
    if (stickPointer !== null) return;
    stickPointer = event.pointerId;
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    updateStick(event.clientX, event.clientY);
    event.preventDefault();
  }

  function onStickMove(event: PointerEvent) {
    if (event.pointerId !== stickPointer) return;
    updateStick(event.clientX, event.clientY);
  }

  function onStickUp(event: PointerEvent) {
    if (event.pointerId !== stickPointer) return;
    releaseStick();
  }

  function holdButton(key: 'up' | 'down' | 'boost') {
    return (event: PointerEvent) => {
      touchInput[key] = true;
      (event.currentTarget as Element).setPointerCapture(event.pointerId);
      event.preventDefault();
    };
  }

  function releaseButton(key: 'up' | 'down' | 'boost') {
    return () => {
      touchInput[key] = false;
    };
  }
</script>

<div
  class="touch-controls"
  role="group"
  aria-label="Touch flight controls"
  oncontextmenu={(e) => e.preventDefault()}
>
  <div
    bind:this={padEl}
    class="stick-pad"
    role="application"
    aria-label="Flight joystick"
    onpointerdown={onStickDown}
    onpointermove={onStickMove}
    onpointerup={onStickUp}
    onpointercancel={onStickUp}
    onlostpointercapture={onStickUp}
  >
    <span class="stick-ring" aria-hidden="true"></span>
    <span
      class="stick-knob"
      aria-hidden="true"
      style:transform={`translate(${knobX}px, ${knobY}px)`}
    ></span>
  </div>

  <div class="action-cluster">
    <button
      class="action-btn"
      class:held={touchInput.boost}
      type="button"
      aria-label="Boost"
      onpointerdown={holdButton('boost')}
      onpointerup={releaseButton('boost')}
      onpointercancel={releaseButton('boost')}
      onlostpointercapture={releaseButton('boost')}
    >
      <Icon icon="mdi:lightning-bolt" width="22" height="22" />
    </button>
    <button
      class="action-btn"
      class:held={touchInput.up}
      type="button"
      aria-label="Fly up"
      onpointerdown={holdButton('up')}
      onpointerup={releaseButton('up')}
      onpointercancel={releaseButton('up')}
      onlostpointercapture={releaseButton('up')}
    >
      <Icon icon="mdi:arrow-up-bold" width="22" height="22" />
    </button>
    <button
      class="action-btn"
      class:held={touchInput.down}
      type="button"
      aria-label="Fly down"
      onpointerdown={holdButton('down')}
      onpointerup={releaseButton('down')}
      onpointercancel={releaseButton('down')}
      onlostpointercapture={releaseButton('down')}
    >
      <span class="descend-icon" aria-hidden="true"
        ><Icon icon="mdi:arrow-up-bold" width="22" height="22" /></span
      >
    </button>
  </div>
</div>

<style>
  .touch-controls {
    position: absolute;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }

  .stick-pad {
    position: absolute;
    left: 1.1rem;
    bottom: 10rem;
    width: 7rem;
    height: 7rem;
    display: grid;
    place-items: center;
    pointer-events: auto;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .stick-ring {
    position: absolute;
    inset: 0.35rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--color-identifier) 32%, transparent);
    background: color-mix(in srgb, var(--color-base-100) 42%, transparent);
    backdrop-filter: blur(6px);
  }

  .stick-knob {
    position: relative;
    width: 2.9rem;
    height: 2.9rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--color-identifier) 40%, transparent);
    background: color-mix(in srgb, var(--color-identifier) 22%, var(--color-base-100) 60%);
    box-shadow: 0 2px 12px rgb(0 0 0 / 0.35);
    will-change: transform;
  }

  .action-cluster {
    position: absolute;
    right: 1.1rem;
    bottom: 10rem;
    display: grid;
    gap: 0.45rem;
    pointer-events: none;
  }

  .action-btn {
    display: grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--color-identifier) 32%, transparent);
    background: color-mix(in srgb, var(--color-base-100) 46%, transparent);
    color: color-mix(in srgb, var(--color-identifier) 88%, transparent);
    pointer-events: auto;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    backdrop-filter: blur(6px);
    transition:
      background-color 120ms ease,
      color 120ms ease,
      border-color 120ms ease,
      transform 120ms ease;
  }

  .descend-icon {
    transform: rotate(180deg);
  }
  .action-btn:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 4px;
  }

  .action-btn.held {
    background: color-mix(in srgb, var(--color-primary) 26%, var(--color-base-100) 55%);
    border-color: color-mix(in srgb, var(--color-primary) 55%, transparent);
    color: var(--color-primary);
    transform: scale(0.94);
  }
</style>
