/** A conservative starting budget; the renderer can lower resolution during flight. */
export function getSceneQuality() {
  const compact = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const cores = typeof navigator === 'undefined' ? 8 : navigator.hardwareConcurrency;
  const constrained = compact || cores <= 4;
  return {
    constrained,
    maxDpr: constrained ? 1.25 : 1.75,
    terrainSegments: constrained ? 112 : 192,
    bodySegments: constrained ? 28 : 40,
    stars: constrained ? 800 : 1600,
  };
}
