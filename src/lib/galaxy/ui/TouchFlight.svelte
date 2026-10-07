<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { TouchFlight } from '../engine/protocol';

  const { onInput }: { onInput: (input: TouchFlight) => void } = $props();

  /** Max knob travel from the pad centre, px. */
  const RADIUS = 40;
  const DEADZONE = 0.12;

  let pad = $state<HTMLDivElement>();
  let knob = $state({ x: 0, y: 0 });
  let stickPointer: number | null = null;
  const input: TouchFlight = { stick: [0, 0], up: false, down: false, boost: false };

  function send() {
    onInput({ ...input, stick: [...input.stick] });
  }

  function moveStick(clientX: number, clientY: number) {
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) {
      dx = (dx / len) * RADIUS;
      dy = (dy / len) * RADIUS;
    }
    knob = { x: dx, y: dy };
    const nx = dx / RADIUS;
    const ny = dy / RADIUS;
    const mag = Math.hypot(nx, ny);
    if (mag < DEADZONE) input.stick = [0, 0];
    else {
      // Rescale so the dead-zone edge maps to 0 and the rim to 1.
      const k = (mag - DEADZONE) / (1 - DEADZONE) / mag;
      input.stick = [nx * k, -ny * k];
    }
    send();
  }

  function release() {
    stickPointer = null;
    knob = { x: 0, y: 0 };
    input.stick = [0, 0];
    send();
  }

  function hold(key: 'up' | 'down' | 'boost', on: boolean) {
    return (event: PointerEvent) => {
      input[key] = on;
      if (on) (event.currentTarget as Element).setPointerCapture(event.pointerId);
      event.preventDefault();
      send();
    };
  }

  onMount(() => {
    const releaseAll = () => {
      input.up = input.down = input.boost = false;
      release();
    };
    window.addEventListener('blur', releaseAll);
    return () => {
      window.removeEventListener('blur', releaseAll);
      releaseAll();
    };
  });
</script>

<div
  class="touch"
  role="group"
  aria-label="Touch flight controls"
  oncontextmenu={(e) => e.preventDefault()}
>
  <div
    bind:this={pad}
    class="pad"
    role="application"
    aria-label="Movement joystick"
    onpointerdown={(e) => {
      if (stickPointer !== null) return;
      stickPointer = e.pointerId;
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      moveStick(e.clientX, e.clientY);
      e.preventDefault();
    }}
    onpointermove={(e) => e.pointerId === stickPointer && moveStick(e.clientX, e.clientY)}
    onpointerup={(e) => e.pointerId === stickPointer && release()}
    onpointercancel={(e) => e.pointerId === stickPointer && release()}
    onlostpointercapture={(e) => e.pointerId === stickPointer && release()}
  >
    <span class="ring" aria-hidden="true"></span>
    <span class="knob" aria-hidden="true" style:transform={`translate(${knob.x}px, ${knob.y}px)`}
    ></span>
  </div>
  <div class="actions">
    {#each [['boost', 'mdi:lightning-bolt', 'Boost'], ['up', 'mdi:arrow-up-bold', 'Up or jump'], ['down', 'mdi:arrow-down-bold', 'Down']] as [key, icon, label] (key)}
      <button
        type="button"
        aria-label={label}
        onpointerdown={hold(key as 'up' | 'down' | 'boost', true)}
        onpointerup={hold(key as 'up' | 'down' | 'boost', false)}
        onpointercancel={hold(key as 'up' | 'down' | 'boost', false)}
        onlostpointercapture={hold(key as 'up' | 'down' | 'boost', false)}
      >
        <Icon {icon} width="22" height="22" />
      </button>
    {/each}
  </div>
</div>

<style>
  .touch {
    position: absolute;
    inset: auto 0 9rem 0;
    z-index: 7;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding: 0 1rem;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .pad {
    position: relative;
    width: 116px;
    height: 116px;
    border-radius: 50%;
    pointer-events: auto;
    touch-action: none;
  }
  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1.5px solid #e5eaf566;
    background: radial-gradient(circle, #11152455, #11152499);
    backdrop-filter: blur(6px);
  }
  .knob {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 46px;
    height: 46px;
    margin: -23px 0 0 -23px;
    border-radius: 50%;
    background: #e5eaf5cc;
    box-shadow: 0 2px 10px #0006;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    pointer-events: auto;
  }
  button {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    border: 1.5px solid #e5eaf566;
    background: #111524aa;
    color: #e5eaf5;
    backdrop-filter: blur(6px);
    touch-action: none;
  }
  button:active {
    background: #e5eaf540;
  }
</style>
