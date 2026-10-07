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
  <span class="reading" title="Height above ground"><b>{altitude}</b><small>alt</small></span>
  <span class="reading"><b>{fmt.format(data.speed)}</b><small>m/s</small></span>
  <span class="reading" title={data.light}>
    <b>{clock}</b>{#if data.timeLapse}<small class="fast">×40</small>{/if}
  </span>
</div>

<style>
  .instrument {
    position: absolute;
    left: 50%;
    bottom: 8.6rem;
    transform: translateX(-50%);
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 0.15rem;
    max-width: calc(100% - 2rem);
    padding: 0.2rem 0.3rem;
    border: 1px solid rgb(233 236 246 / 0.12);
    border-radius: 999px;
    background: rgb(10 12 20 / 0.5);
    backdrop-filter: blur(14px) saturate(150%);
    color: #e9ecf6;
    font-size: 0.68rem;
    white-space: nowrap;
    pointer-events: none;
  }
  .biome {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.15rem 0.55rem;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: 0.03em;
    color: #ffd9a0;
  }
  i {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #ffd27a;
    box-shadow: 0 0 6px currentColor;
  }
  i.dusk {
    background: #ff8a5c;
  }
  i.night {
    background: #8aa4ff;
  }
  .reading {
    display: inline-flex;
    align-items: baseline;
    gap: 0.2rem;
    padding: 0.15rem 0.5rem;
    border-left: 1px solid rgb(233 236 246 / 0.12);
  }
  b {
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  small {
    font-size: 0.6rem;
    color: rgb(233 236 246 / 0.6);
  }
  .fast {
    color: #ffd9a0;
  }
  @media (max-width: 600px) {
    .instrument {
      top: 6.6rem;
      bottom: auto;
    }
  }
</style>
