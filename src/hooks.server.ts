import type { Handle } from '@sveltejs/kit';

export const handle: Handle = ({ event, resolve }) =>
  resolve(event, {
    // Discover the route and entry modules early, without giving every shared
    // dependency its own competing preload on constrained mobile connections.
    preload: ({ type, path }) => type !== 'js' || /\/(entry|nodes)\//.test(path),
  });
