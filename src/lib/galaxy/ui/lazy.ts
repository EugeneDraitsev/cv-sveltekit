// The layout loads the hero through this module: a named export lets a
// retried import (see importAgain) tell the hero from one of its dependencies,
// which would all answer to `default`.
export { default as GalaxyHero } from './GalaxyHero.svelte';
