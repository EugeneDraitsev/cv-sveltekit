/// <reference lib="webworker" />
import { Engine } from './engine';
import type { FromEngine, ToEngine } from './protocol';

// The whole renderer lives here, on its own thread: parsing TypeGPU, building
// shaders and drawing frames never block the page's main thread.
const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (message: FromEngine) => scope.postMessage(message, []);
let engine: Engine | null = null;
let ready = false;
const pending: ToEngine[] = [];

scope.addEventListener('message', async (event: MessageEvent<ToEngine>) => {
  const message = event.data;
  if (message.type === 'init') {
    engine = new Engine(post);
    try {
      await engine.init(message);
      ready = true;
      for (const queued of pending.splice(0)) engine.handle(queued);
    } catch (error) {
      console.error(error);
      post({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (!ready || !engine) {
    pending.push(message);
    return;
  }
  engine.handle(message);
});
