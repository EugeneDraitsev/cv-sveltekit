<script module lang="ts">
  import { SvelteSet } from 'svelte/reactivity';

  let activeSceneLabel: string | null = null;
  const activeSceneListeners = new SvelteSet<(label: string | null) => void>();

  const selectActiveScene = (label: string | null) => {
    activeSceneLabel = label;

    for (const listener of activeSceneListeners) {
      listener(activeSceneLabel);
    }
  };

  /**
   * What a scene that speaks to its embedder reports (the Orb Knight Storybook
   * does, from its preview): stages in order, then `ready` once, on a clean
   * frame. Scenes that say nothing are revealed when their page loads.
   */
  type SceneMessage = {
    type: 'live-scene';
    stage: 'engine' | 'assets' | 'shaders' | 'ready';
    loaded?: number;
    total?: number;
  };

  type Stage = 'page' | 'engine' | 'assets' | 'shaders';

  const STEPS: { stage: Stage; name: string }[] = [
    { stage: 'page', name: 'Page' },
    { stage: 'engine', name: 'Engine' },
    { stage: 'assets', name: 'Assets' },
    { stage: 'shaders', name: 'Shaders' },
  ];

  /** The part of the bar each stage owns: it starts there and creeps towards the end. */
  const BANDS: Record<Stage, [number, number]> = {
    page: [0, 0.16],
    engine: [0.16, 0.28],
    assets: [0.28, 0.76],
    shaders: [0.76, 0.97],
  };

  // A scene that never reports is shown anyway; one that is slow says why.
  const SLOW_MS = 14_000;
  const GIVE_UP_MS = 60_000;
  // A Storybook story that predates the bridge only says it rendered.
  const UNBRIDGED_MS = 1_500;
  // A frame that loads and then says nothing at all.
  const SILENT_MS = 5_000;
  const REVEAL_MS = 450;

  const isSceneMessage = (data: unknown): data is SceneMessage =>
    typeof data === 'object' && data !== null && (data as SceneMessage).type === 'live-scene';

  const storybookEvent = (data: unknown) => {
    if (typeof data !== 'string' || !data.includes('"storybook-channel"')) return null;

    try {
      return (JSON.parse(data) as { event?: { type?: string } }).event?.type ?? null;
    } catch {
      return null;
    }
  };
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  type Props = {
    title: string;
    src: string;
    description: string;
    label: string;
    /** Still frame from the scene, shown on the launcher and behind the loader. */
    poster?: string;
    desktopOverview?: boolean;
    tall?: boolean;
    /** What draws the scene: named on the launcher and the live badge. */
    renderer?: 'WebGL' | 'WebGPU';
    /**
     * Keep the loader up until the scene reports it is ready (see SceneMessage)
     * rather than until its page loads, which for a game is long before.
     */
    waitForScene?: boolean;
    /** Said on the launcher when a WebGPU scene meets a browser without it. */
    withoutWebGPU?: string;
  };

  const {
    title,
    src,
    description,
    label,
    poster = undefined,
    desktopOverview = false,
    tall = false,
    renderer = 'WebGL',
    waitForScene = false,
    withoutWebGPU = 'This browser has no WebGPU, which the scene needs.',
  }: Props = $props();

  let isActive = $state(false);
  let phase = $state<'loading' | 'revealing' | 'live'>('loading');
  let stage = $state<Stage>('page');
  let assets = $state({ loaded: 0, total: 0 });
  let progress = $state(0);
  let slow = $state(false);
  let hasWebGPU = $state(true);
  let iframe = $state<HTMLIFrameElement>();

  const percent = $derived(Math.round(progress * 100));
  const stageIndex = $derived(STEPS.findIndex((step) => step.stage === stage));
  const stageText = $derived.by(() => {
    if (phase !== 'loading') return 'Ready';
    if (stage === 'page') return 'Fetching the scene';
    if (stage === 'engine') return 'Starting the engine';
    if (stage === 'assets') {
      return assets.total ? `Loading assets · ${assets.loaded}/${assets.total}` : 'Loading assets';
    }
    return 'Compiling shaders';
  });

  onMount(() => {
    hasWebGPU = 'gpu' in navigator;

    const updateActiveScene = (activeLabel: string | null) => {
      isActive = activeLabel === label;
    };

    activeSceneListeners.add(updateActiveScene);
    updateActiveScene(activeSceneLabel);

    return () => {
      activeSceneListeners.delete(updateActiveScene);

      if (activeSceneLabel === label) {
        selectActiveScene(null);
      }
    };
  });

  const toggleScene = () => selectActiveScene(isActive ? null : label);

  /** Moves forward only: a scene may report an earlier stage again (a late texture). */
  const advance = (next: Stage) => {
    if (STEPS.findIndex((step) => step.stage === next) > stageIndex) stage = next;
  };

  $effect(() => {
    const frame = iframe;
    if (!isActive || !frame) return;

    phase = 'loading';
    stage = 'page';
    assets = { loaded: 0, total: 0 };
    progress = 0;
    slow = false;

    const origin = new URL(src).origin;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const later = (callback: () => void, ms: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        callback();
      }, ms);
      timers.add(timer);
    };
    // Whether the scene reports its stages, and whether its frame said anything at all.
    let bridged = false;
    let spoke = false;

    const reveal = () => {
      if (phase !== 'loading') return;

      progress = 1;
      phase = 'revealing';
      later(() => {
        phase = 'live';
        // Hand the keyboard to the game, unless the reader has scrolled on meanwhile.
        const box = frame.getBoundingClientRect();
        if (box.top < window.innerHeight && box.bottom > 0) frame.focus({ preventScroll: true });
      }, REVEAL_MS);
    };

    const onLoad = () => {
      // As far as the loader can tell, a page that reports nothing is ready once it has loaded.
      if (!waitForScene) {
        reveal();
        return;
      }

      advance('engine');
      later(() => {
        if (!spoke) reveal();
      }, SILENT_MS);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== origin) return;

      if (isSceneMessage(event.data)) {
        bridged = spoke = true;
        const message = event.data;

        if (message.stage === 'ready') {
          reveal();
          return;
        }

        if (message.total) assets = { loaded: message.loaded ?? 0, total: message.total };
        advance(message.stage);
        return;
      }

      const storybook = storybookEvent(event.data);
      if (!waitForScene || !storybook) return;

      spoke = true;
      if (storybook === 'storyRendered') {
        // A story that predates the bridge goes no further than this.
        later(() => {
          if (!bridged) reveal();
        }, UNBRIDGED_MS);
      } else if (/^story(Errored|ThrewException|Missing)$/.test(storybook)) {
        // Storybook draws its own error page; show it rather than a loader that never ends.
        reveal();
      }
    };

    const creep = setInterval(() => {
      if (phase !== 'loading') return;

      const [start, end] = waitForScene ? BANDS[stage] : [0, 0.92];
      const share = stage === 'assets' && assets.total ? assets.loaded / assets.total : 0;
      // Within a stage the bar eases towards its end, never past it.
      progress = Math.max(progress, start + (end - start) * share);
      progress += (end - progress) * 0.035;
    }, 100);

    frame.addEventListener('load', onLoad);
    window.addEventListener('message', onMessage);
    later(() => (slow = true), SLOW_MS);
    later(reveal, GIVE_UP_MS);

    return () => {
      frame.removeEventListener('load', onLoad);
      window.removeEventListener('message', onMessage);
      clearInterval(creep);
      for (const timer of timers) clearTimeout(timer);
    };
  });
</script>

<article class="scene-embed">
  <header class="scene-header">
    <div>
      <p>{label}</p>
      <h3>{title}</h3>
    </div>
    <a href={src} target="_blank" rel="noreferrer">
      Open full scene
      <span aria-hidden="true">↗</span>
    </a>
  </header>

  <div class:desktop-overview={desktopOverview} class:tall class="scene-viewport">
    {#if isActive}
      <iframe bind:this={iframe} {src} {title} allow="autoplay; fullscreen; gamepad"></iframe>

      {#if phase !== 'live'}
        <div class="scene-loader" class:leaving={phase === 'revealing'} role="status">
          {#if poster}
            <img class="loader-poster" src={poster} alt="" decoding="async" />
          {/if}
          <div class="loader-card">
            <p class="loader-kicker">Loading {renderer} scene</p>
            <div
              class="loader-bar"
              role="progressbar"
              aria-label={`Loading ${title}`}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={percent}
            >
              <span style:transform={`scaleX(${progress})`}></span>
            </div>
            <p class="loader-stage">
              <span>{stageText}</span>
              <span class="loader-percent">{percent}%</span>
            </p>
            {#if waitForScene}
              <ol class="loader-steps" aria-hidden="true">
                {#each STEPS as step, index (step.stage)}
                  <li
                    class:done={phase !== 'loading' || index < stageIndex}
                    class:current={phase === 'loading' && index === stageIndex}
                  >
                    {step.name}
                  </li>
                {/each}
              </ol>
            {/if}
            {#if slow}
              <p class="loader-slow">
                Still going: compiling the shaders is the slow part of a first launch.
              </p>
            {/if}
          </div>
        </div>
      {/if}

      <button class="scene-stop" type="button" onclick={toggleScene}>Close scene</button>
      {#if phase === 'live'}
        <span class="live-badge">
          <span aria-hidden="true"></span>
          Live {renderer}
        </span>
      {/if}
    {:else}
      <button class="scene-launcher" class:has-poster={poster} type="button" onclick={toggleScene}>
        {#if poster}
          <img class="scene-poster" src={poster} alt="" loading="lazy" decoding="async" />
          <span class="scene-poster-shade" aria-hidden="true"></span>
        {/if}
        <span class="launcher-content">
          <span class="launch-icon" aria-hidden="true">▶</span>
          <strong>Launch live scene</strong>
          <small>Real game code · {renderer} · one scene at a time</small>
          {#if renderer === 'WebGPU' && !hasWebGPU}
            <small class="launcher-note">{withoutWebGPU}</small>
          {/if}
        </span>
      </button>
    {/if}
  </div>

  <p class="scene-description">{description}</p>
</article>

<style>
  .scene-embed {
    overflow: hidden;
    border: 1px solid var(--color-base-300);
    border-radius: 8px;
    background: var(--color-base-100);
  }

  .scene-header {
    display: flex;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--color-base-300);
  }

  .scene-header > div {
    min-width: 0;
  }

  .scene-header p {
    margin: 0 0 0.2rem;
    color: var(--color-keyword);
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .scene-header h3 {
    margin: 0;
    color: var(--color-constant);
    font-size: 1rem;
    line-height: 1.25;
  }

  .scene-header a {
    flex: 0 0 auto;
    color: var(--color-declaration);
    font-size: 0.75rem;
    text-decoration: underline;
  }

  .scene-viewport {
    position: relative;
    height: clamp(340px, 42vw, 480px);
    overflow: hidden;
    background: #050807;
  }

  .scene-viewport.tall {
    height: clamp(440px, 68vw, 640px);
  }

  iframe {
    width: 100%;
    height: 100%;
    border: 0;
    background: #050807;
  }

  /* Zoomed out to show the desktop layout. Zoom, unlike a scale transform, carries
     into the frame, so the scene is drawn at the size it is shown and stays sharp. */
  .scene-viewport.desktop-overview iframe {
    zoom: 0.6667;
  }

  /* One loader from the click until the scene's first clean frame. */
  .scene-loader {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 1.25rem;
    overflow: hidden;
    background: #050807;
    transition: opacity 450ms ease;
  }

  .scene-loader.leaving {
    opacity: 0;
    pointer-events: none;
  }

  .loader-poster {
    position: absolute;
    inset: -24px;
    width: calc(100% + 48px);
    height: calc(100% + 48px);
    object-fit: cover;
    filter: blur(14px) brightness(0.42) saturate(1.15);
    transform: scale(1.04);
    animation: loader-drift 18s ease-in-out infinite alternate;
  }

  @keyframes loader-drift {
    to {
      transform: scale(1.12) translate(-1.5%, -1%);
    }
  }

  .loader-card {
    position: relative;
    display: grid;
    gap: 0.6rem;
    width: min(20rem, 100%);
    padding: 1rem 1.1rem 1.05rem;
    color: #e8f7ed;
    background: rgb(3 10 8 / 0.62);
    border: 1px solid rgb(255 255 255 / 0.14);
    border-radius: 10px;
    box-shadow: 0 18px 50px rgb(0 0 0 / 0.45);
    backdrop-filter: blur(10px);
  }

  .loader-kicker {
    margin: 0;
    color: #55e58a;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .loader-bar {
    position: relative;
    height: 6px;
    overflow: hidden;
    background: rgb(255 255 255 / 0.1);
    border-radius: 999px;
  }

  .loader-bar span {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #2fae63, #55e58a 70%, #b8ffd2);
    border-radius: inherit;
    transform-origin: left center;
    transition: transform 180ms linear;
  }

  /* A light passing along the bar, so a long stage still reads as working. */
  .loader-bar::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.35), transparent);
    transform: translateX(-100%);
    animation: loader-sheen 1.6s ease-in-out infinite;
  }

  @keyframes loader-sheen {
    to {
      transform: translateX(100%);
    }
  }

  .loader-stage {
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    margin: 0;
    font-size: 0.78rem;
  }

  .loader-percent {
    color: rgb(232 247 237 / 0.6);
    font-variant-numeric: tabular-nums;
  }

  .loader-steps {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.35rem;
    margin: 0.15rem 0 0;
    padding: 0;
    list-style: none;
  }

  .loader-steps li {
    padding-top: 0.4rem;
    color: rgb(232 247 237 / 0.38);
    font-size: 0.6rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-top: 2px solid rgb(255 255 255 / 0.12);
    transition:
      color 200ms ease,
      border-color 200ms ease;
  }

  .loader-steps li.done {
    color: rgb(232 247 237 / 0.72);
    border-color: #2fae63;
  }

  .loader-steps li.current {
    color: #e8f7ed;
    border-color: #55e58a;
  }

  .loader-slow {
    margin: 0.1rem 0 0;
    color: rgb(232 247 237 / 0.6);
    font-size: 0.7rem;
    line-height: 1.45;
  }

  @media (prefers-reduced-motion: reduce) {
    .loader-poster,
    .loader-bar::after {
      animation: none;
    }

    .scene-loader {
      transition: none;
    }
  }

  .scene-launcher {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    width: 100%;
    padding: 2rem;
    color: rgb(232 247 237 / 0.68);
    text-align: center;
    cursor: pointer;
    background:
      radial-gradient(circle at 50% 42%, rgb(85 229 138 / 0.12), transparent 32%),
      linear-gradient(145deg, #07110f, #040706);
    border: 0;
  }

  .scene-poster {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.02);
    transition: transform 400ms ease;
  }

  .scene-poster-shade {
    position: absolute;
    inset: 0;
    /* Darkest behind the button and its words, so they read on a bright poster too. */
    background:
      radial-gradient(ellipse 34% 26% at 50% 52%, rgb(4 8 6 / 0.5), transparent),
      radial-gradient(circle at 50% 46%, rgb(4 8 6 / 0.08), rgb(4 8 6 / 0.45) 82%),
      linear-gradient(to top, rgb(4 8 6 / 0.55), transparent 36%);
    transition: background-color 200ms ease;
  }

  .launcher-content {
    position: relative;
    display: grid;
    gap: 0.8rem;
    justify-items: center;
  }

  .scene-launcher.has-poster .launcher-content {
    text-shadow: 0 1px 10px rgb(0 0 0 / 0.65);
  }

  .launch-icon {
    display: grid;
    place-content: center;
    width: 3.25rem;
    height: 3.25rem;
    margin: 0 auto;
    padding-left: 0.2rem;
    color: #07110f;
    font-size: 1rem;
    background: #55e58a;
    border-radius: 999px;
    box-shadow: 0 0 2rem rgb(85 229 138 / 0.35);
    transition: transform 160ms ease;
  }

  .scene-launcher strong {
    color: #e8f7ed;
    font-size: 0.9rem;
  }

  .scene-launcher small {
    font-size: 0.68rem;
  }

  .scene-launcher .launcher-note {
    max-width: 18rem;
    padding: 0.3rem 0.6rem;
    color: #ffc66d;
    background: rgb(3 10 8 / 0.7);
    border-radius: 6px;
  }

  .scene-launcher:hover .launch-icon,
  .scene-launcher:focus-visible .launch-icon {
    transform: scale(1.08);
  }

  .scene-launcher:hover .scene-poster,
  .scene-launcher:focus-visible .scene-poster {
    transform: scale(1.06);
  }

  @media (prefers-reduced-motion: reduce) {
    .scene-poster,
    .launch-icon {
      transition: none;
    }
  }

  .scene-launcher:focus-visible {
    outline: 2px solid #55e58a;
    outline-offset: -4px;
  }

  .scene-stop {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 2;
    padding: 0.35rem 0.55rem;
    color: #e8f7ed;
    font-size: 0.65rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    cursor: pointer;
    background: rgb(3 10 8 / 0.86);
    border: 1px solid rgb(255 255 255 / 0.18);
    border-radius: 999px;
    backdrop-filter: blur(8px);
  }

  .live-badge {
    position: absolute;
    right: 0.75rem;
    bottom: 0.75rem;
    display: inline-flex;
    gap: 0.4rem;
    align-items: center;
    padding: 0.35rem 0.55rem;
    color: #e8f7ed;
    font-size: 0.65rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    pointer-events: none;
    background: rgb(3 10 8 / 0.82);
    border: 1px solid rgb(255 255 255 / 0.16);
    border-radius: 999px;
    backdrop-filter: blur(8px);
  }

  .live-badge span {
    width: 0.45rem;
    height: 0.45rem;
    background: #55e58a;
    border-radius: 999px;
    box-shadow: 0 0 0.5rem #55e58a;
  }

  .scene-description {
    margin: 0;
    padding: 0.9rem 1rem 1rem;
    color: color-mix(in srgb, var(--color-identifier) 82%, transparent);
    font-size: 0.82rem;
    line-height: 1.6;
    border-top: 1px solid var(--color-base-300);
  }

  @media (max-width: 560px) {
    .scene-header {
      align-items: flex-start;
    }

    .scene-header a {
      max-width: 5rem;
      text-align: right;
    }

    .scene-viewport {
      height: 430px;
    }

    /* A portrait frame no taller than 500px reads as a phone on its side to some pages
       (the character creator puts its panel beside a sliver of stage), so the tall
       scenes stay taller than that. */
    .scene-viewport.tall {
      height: min(600px, 80svh);
    }

    .scene-viewport.desktop-overview iframe {
      zoom: 1;
    }
  }
</style>
