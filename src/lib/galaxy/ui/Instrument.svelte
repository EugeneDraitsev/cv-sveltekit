<script lang="ts">
  import type { Instrument } from '../engine/protocol';

  const { data }: { data: Instrument } = $props();

  const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
  const clock = $derived.by(() => {
    const minutes = Math.round(data.daytime * 24 * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });
  const altitude = $derived(
    data.altitude >= 10_000
      ? `${(data.altitude / 1000).toFixed(1)} km`
      : `${fmt.format(Math.max(0, data.altitude))} m`,
  );
</script>

<div class="instrument" aria-live="off">
  <span class="biome"><i class={data.light} aria-hidden="true"></i>{data.biome}</span>
  <div class="readings">
    <span><b>{altitude}</b><small> above ground</small></span>
    <span><b>{fmt.format(data.speed)}</b><small> m/s</small></span>
    <span><b>{clock}</b><small> {data.light}{data.timeLapse ? ' · fast' : ''}</small></span>
  </div>
</div>

<style>
  .instrument {
    position: absolute;
    left: 50%;
    bottom: 9.5rem;
    transform: translateX(-50%);
    z-index: 4;
    pointer-events: none;
    color: #e5eaf5;
    font-size: 0.68rem;
    text-shadow: 0 1px 3px #0009;
    text-align: center;
  }
  .biome {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.3rem 0.7rem;
    background: #111524d9;
    border-radius: 999px;
    letter-spacing: 0.04em;
  }
  i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ffd27a;
  }
  i.dusk {
    background: #ff8a5c;
  }
  i.night {
    background: #8aa4ff;
  }
  .readings {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 0.4rem;
    white-space: nowrap;
  }
  b {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  small {
    font-size: 0.6rem;
    opacity: 0.85;
  }
  @media (max-width: 600px) {
    .readings {
      gap: 0.6rem;
    }
    .instrument {
      top: 6.4rem;
      bottom: auto;
    }
  }
</style>
