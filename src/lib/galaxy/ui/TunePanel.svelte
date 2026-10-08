<script lang="ts">
  import { onMount } from 'svelte';
  import type { Settings } from '../engine/protocol';

  const {
    settings,
    onChange,
    onClose,
  }: { settings: Settings; onChange: (patch: Partial<Settings>) => void; onClose: () => void } =
    $props();

  let panel = $state<HTMLDivElement>();
  // The dialog sits before the dock in DOM order: take focus so keyboard
  // users land on the controls instead of tabbing out of the hero.
  onMount(() => {
    panel?.querySelector<HTMLElement>('input, select')?.focus({ preventScroll: true });
  });

  const sliders: { key: keyof Settings; label: string; min: number; max: number; step: number }[] =
    [
      { key: 'exposure', label: 'Exposure', min: 0.4, max: 2.5, step: 0.01 },
      { key: 'bloom', label: 'Glow', min: 0, max: 1, step: 0.01 },
      { key: 'nebula', label: 'Nebulae', min: 0, max: 1.2, step: 0.01 },
      { key: 'dust', label: 'Dust lanes', min: 0, max: 2.5, step: 0.01 },
      { key: 'thickness', label: 'Disk thickness', min: 0.4, max: 2, step: 0.01 },
      { key: 'rotation', label: 'Rotation speed', min: 0, max: 3, step: 0.01 },
    ];
</script>

<div bind:this={panel} class="tune" role="dialog" aria-label="Galaxy settings">
  <div class="head">
    <span>Galaxy</span>
    <button type="button" onclick={onClose} aria-label="Close settings">×</button>
  </div>
  {#each sliders as s (s.key)}
    <label>
      <span>{s.label}<output>{Number(settings[s.key]).toFixed(2)}</output></span>
      <input
        type="range"
        min={s.min}
        max={s.max}
        step={s.step}
        value={settings[s.key]}
        oninput={(e) => onChange({ [s.key]: Number((e.currentTarget as HTMLInputElement).value) })}
      />
    </label>
  {/each}
  <label>
    <span>Quality</span>
    <select
      value={settings.quality}
      onchange={(e) =>
        onChange({ quality: (e.currentTarget as HTMLSelectElement).value as Settings['quality'] })}
    >
      <option value="auto">Auto</option>
      <option value="low">Low</option>
      <option value="medium">Balanced</option>
      <option value="high">High</option>
    </select>
  </label>
</div>

<style>
  .tune {
    position: absolute;
    right: 1.25rem;
    top: 3.6rem;
    z-index: 9;
    width: min(17rem, calc(100% - 2.5rem));
    /* Ends above the content that overlaps the hero; scroll for the rest. */
    max-height: calc(100% - 3.6rem - var(--galaxy-inset-bottom) - 0.75rem);
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    padding: 0.75rem 0.9rem 0.85rem;
    border-radius: 0.8rem;
    border: 1px solid color-mix(in srgb, var(--color-identifier) 20%, transparent);
    background: color-mix(in srgb, var(--color-base-100) 88%, transparent);
    backdrop-filter: blur(12px);
    color: var(--color-identifier);
    font-size: 0.72rem;
    box-shadow: 0 10px 30px #0003;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.4rem;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .head button {
    min-width: 44px;
    min-height: 44px;
    margin: -0.6rem -0.6rem -0.6rem 0;
    font-size: 1.1rem;
    color: inherit;
    cursor: pointer;
  }
  label {
    display: block;
    margin-top: 0.45rem;
  }
  label > span {
    display: flex;
    justify-content: space-between;
  }
  output {
    font-variant-numeric: tabular-nums;
    opacity: 0.7;
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--color-primary);
  }
  /* Narrow screens keep the dock in the bottom-right corner: stop above it. */
  @media (max-width: 900px) {
    .tune {
      max-height: calc(100% - 3.6rem - 5.4rem - 3rem);
    }
  }
  select {
    width: 100%;
    margin-top: 0.25rem;
    padding: 0.3rem;
    border-radius: 0.4rem;
    background: var(--color-base-100);
    color: inherit;
    border: 1px solid color-mix(in srgb, var(--color-identifier) 25%, transparent);
  }
</style>
