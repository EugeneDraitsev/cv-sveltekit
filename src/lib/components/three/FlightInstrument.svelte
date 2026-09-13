<script lang="ts">
  import { flightHud } from './flightHud.svelte';
</script>

<div class="flight-instrument" aria-label="Flight instruments">
  <span class="biome"><i aria-hidden="true"></i>{flightHud.biome}</span>
  <div class="readings">
    <span><b>{flightHud.altitude}</b><small> m AGL</small></span>
    <span><b>{flightHud.speed}</b><small> m/s</small></span>
    <span><b>{String(flightHud.heading).padStart(3, '0')}°</b><small> HDG</small></span>
  </div>
</div>

<style>
  .flight-instrument {
    position: absolute;
    left: 50%;
    bottom: 9.5rem;
    transform: translateX(-50%);
    z-index: 4;
    pointer-events: none;
    color: #e5eaf5;
    font-size: 0.68rem;
    text-shadow: 0 1px 3px #0008;
    text-align: center;
  }
  .biome {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.3rem 0.65rem;
    background: #111524d9;
    border-radius: 999px;
  }
  i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #a4c591;
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
    color: #e5eaf5;
  }
  @media (max-width: 600px) {
    .readings {
      gap: 0.5rem;
    }
    .flight-instrument {
      top: 6.5rem;
      bottom: auto;
    }
  }
</style>
