import { importAgain } from '$lib/importAgain';
import type { FromEngine, Theme, ToEngine } from './engine/protocol';
import type { DeviceHints } from './engine/quality';

export interface GalaxyHost {
  send(message: ToEngine): void;
  /** True when rendering runs on a worker thread. */
  readonly threaded: boolean;
  dispose(): void;
}

export interface HostOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  theme: Theme;
  reducedMotion: boolean;
  /** Force WebGL2, e.g. on a fresh canvas after WebGPU failed on the first. */
  renderer?: 'auto' | 'webgl';
  onMessage: (message: FromEngine) => void;
}

export function deviceHints(): DeviceHints {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    compact: matchMedia('(max-width: 768px)').matches,
    touch: matchMedia('(hover: none) and (pointer: coarse)').matches,
    cores: nav.hardwareConcurrency ?? 8,
    memory: nav.deviceMemory ?? 8,
    software: false,
  };
}

/**
 * Start the renderer. Where OffscreenCanvas is available the engine runs in a
 * dedicated worker and the main thread only forwards input; otherwise the
 * same engine runs in-page.
 */
export async function startGalaxy(options: HostOptions): Promise<GalaxyHost> {
  const params = new URLSearchParams(location.search);
  const base = {
    width: options.width,
    height: options.height,
    dpr: window.devicePixelRatio || 1,
    hints: deviceHints(),
    theme: options.theme,
    reducedMotion: options.reducedMotion,
    renderer:
      options.renderer === 'webgl' || params.get('renderer') === 'webgl'
        ? ('webgl' as const)
        : ('auto' as const),
  };
  const canTransfer =
    'transferControlToOffscreen' in options.canvas && typeof Worker !== 'undefined';
  if (canTransfer && params.get('thread') !== 'main') {
    const worker = new Worker(new URL('./engine/worker.ts', import.meta.url), { type: 'module' });
    const offscreen = options.canvas.transferControlToOffscreen();
    // Until the engine reports in, a worker error means it never started (a
    // failed or stale chunk fetch): the canvas went with it, so ask the hero
    // to retry on a fresh one.
    let started = false;
    worker.addEventListener('message', (event: MessageEvent<FromEngine>) => {
      if (event.data.type === 'ready') started = true;
      options.onMessage(event.data);
    });
    worker.addEventListener('error', (event) =>
      options.onMessage({
        type: 'error',
        message: event.message || 'Renderer failed',
        retry: started ? undefined : 'restart',
      }),
    );
    worker.postMessage({ type: 'init', canvas: offscreen, ...base } satisfies ToEngine, [
      offscreen,
    ]);
    return {
      threaded: true,
      send: (message) => worker.postMessage(message, []),
      dispose: () => worker.terminate(),
    };
  }
  // A failed chunk fetch is retried by the hero; make sure it really refetches.
  const { Engine } = await importAgain(() => import('./engine/engine'));
  const engine = new Engine((message) => options.onMessage(message));
  // Debug handle for in-page runs (?thread=main).
  (window as unknown as { galaxyEngine?: unknown }).galaxyEngine = engine;
  let ready = false;
  const pending: ToEngine[] = [];
  engine
    .init({ type: 'init', canvas: options.canvas, ...base })
    .then(() => {
      ready = true;
      for (const message of pending.splice(0)) engine.handle(message);
    })
    .catch((error: unknown) =>
      options.onMessage({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  return {
    threaded: false,
    send: (message) => (ready ? engine.handle(message) : pending.push(message)),
    dispose: () => {
      engine.dispose();
      // The debug handle must not keep a disposed engine (and its GPU
      // resources and canvas) alive.
      const debug = window as unknown as { galaxyEngine?: unknown };
      if (debug.galaxyEngine === engine) delete debug.galaxyEngine;
    },
  };
}
