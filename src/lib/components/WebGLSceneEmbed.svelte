<script module lang="ts">
  let activeSceneLabel: string | null = null;
  const activeSceneListeners = new Set<(label: string | null) => void>();

  const selectActiveScene = (label: string | null) => {
    activeSceneLabel = label;

    for (const listener of activeSceneListeners) {
      listener(activeSceneLabel);
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
    /** Still frame from the scene, shown on the launcher before the iframe mounts. */
    poster?: string;
    desktopOverview?: boolean;
    tall?: boolean;
  };

  const {
    title,
    src,
    description,
    label,
    poster = undefined,
    desktopOverview = false,
    tall = false,
  }: Props = $props();

  let isActive = $state(false);
  let iframeLoaded = $state(false);

  onMount(() => {
    const updateActiveScene = (activeLabel: string | null) => {
      isActive = activeLabel === label;
      if (!isActive) iframeLoaded = false;
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
      <iframe
        {src}
        {title}
        allow="autoplay; fullscreen; gamepad; pointer-lock"
        allowfullscreen
        onload={() => (iframeLoaded = true)}
      ></iframe>
      {#if !iframeLoaded}
        <div class="scene-loading" aria-hidden="true">
          <span class="scene-spinner"></span>
          <span>Booting WebGL…</span>
        </div>
      {/if}
      <button class="scene-stop" type="button" onclick={toggleScene}>Close scene</button>
      <span class="live-badge">
        <span aria-hidden="true"></span>
        Live WebGL
      </span>
    {:else}
      <button class="scene-launcher" class:has-poster={poster} type="button" onclick={toggleScene}>
        {#if poster}
          <img class="scene-poster" src={poster} alt="" loading="lazy" decoding="async" />
          <span class="scene-poster-shade" aria-hidden="true"></span>
        {/if}
        <span class="launcher-content">
          <span class="launch-icon" aria-hidden="true">▶</span>
          <strong>Launch live scene</strong>
          <small>Real game code · one scene at a time</small>
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

  .scene-viewport.desktop-overview iframe {
    width: 150%;
    height: 150%;
    transform: scale(0.6667);
    transform-origin: top left;
  }

  .scene-loading {
    position: absolute;
    inset: 0;
    display: grid;
    place-content: center;
    gap: 0.7rem;
    justify-items: center;
    color: rgb(232 247 237 / 0.62);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: #050807;
    pointer-events: none;
  }

  .scene-spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid rgb(85 229 138 / 0.25);
    border-top-color: #55e58a;
    border-radius: 999px;
    animation: scene-spin 0.9s linear infinite;
  }

  @keyframes scene-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scene-spinner {
      animation-duration: 2.4s;
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
    background:
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

    .scene-viewport,
    .scene-viewport.tall {
      height: 430px;
    }

    .scene-viewport.desktop-overview iframe {
      width: 100%;
      height: 100%;
      transform: none;
    }
  }
</style>
