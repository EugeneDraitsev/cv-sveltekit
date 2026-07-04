#include ./chunks/simplex2d.glsl;

uniform float uTime;
uniform vec2 uScroll;      // accumulated (strafe, forward) offsets in noise space
uniform vec2 uSeedOffset;  // per-planet offset so no two worlds share terrain
uniform float uTerrainScale;
uniform float uHeightScale;
uniform float uWaterLevel; // normalized 0..1; negative disables flooding
uniform float uWaterKind;  // 0 none · 1 water · 2 lava · 3 ice
uniform float uCloudMode;  // gas giants: rolling cloud tops
uniform vec2 uWindDir;     // per-planet wind — liquids move in THIS direction

varying float vHeight;   // raw terrain height (pre-flood), world units
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vNoisePos;  // scrolled noise-space coords for biome sampling

float waterWorldHeight() {
  return (uWaterLevel - 0.5) * 1.6 * uHeightScale;
}

float rawHeight(vec2 p) {
  float h = fbm5(p * uTerrainScale);
  // Cloud mode: flatten the spectrum into soft, billowy swells.
  h = mix(h, h * 0.5 + 0.3 * snoise2(p * uTerrainScale * 0.5), uCloudMode);
  return h * uHeightScale;
}

// Final displaced height: flooded areas flatten to the water line with
// traveling waves. Waves move ALONG THE WIND, independent of the terrain
// scroll — liquids get their own motion instead of being painted onto the
// streaming landscape.
float surfaceHeight(vec2 p) {
  float h = rawHeight(p);
  if (uWaterLevel >= 0.0) {
    float w = waterWorldHeight();
    if (h < w) {
      float ripple = 0.0;
      if (uWaterKind == 1.0) {
        // Slow, lazy swells rolling downwind.
        vec2 crossDir = vec2(-uWindDir.y, uWindDir.x);
        float swellA = sin(dot(p, uWindDir) * 0.7 - uTime * 1.05);
        float swellB = sin(dot(p, crossDir) * 1.5 - uTime * 0.65 + 1.7);
        ripple = (swellA * 0.7 + swellB * 0.3) * 0.05;
      } else if (uWaterKind == 2.0) {
        // Lava heaves very slowly along its flow direction.
        ripple = sin(dot(p, uWindDir) * 0.45 - uTime * 0.28) * 0.035;
      }
      return w + ripple;
    }
  }
  return h;
}

void main() {
  // Local plane XY becomes world XZ after the mesh's -PI/2 X rotation.
  // uScroll arrives SNAPPED to whole grid cells (the CPU slides the mesh by
  // the fractional remainder), so every vertex re-samples the exact same
  // noise positions frame after frame — features move rigidly instead of
  // morphing through the grid.
  vec2 scrolled = position.xy + uScroll + uSeedOffset;

  float hRaw = rawHeight(scrolled);
  float h = surfaceHeight(scrolled);

  vHeight = hRaw;
  vNoisePos = scrolled;

  vec3 displaced = position;
  displaced.z += h;

  // Normals via finite differences of the *flattened* height, so water reads
  // as a level plane and shorelines shade correctly.
  float eps = 1.1;
  float hL = surfaceHeight(scrolled + vec2(-eps, 0.0));
  float hR = surfaceHeight(scrolled + vec2(eps, 0.0));
  float hD = surfaceHeight(scrolled + vec2(0.0, -eps));
  float hU = surfaceHeight(scrolled + vec2(0.0, eps));

  vec3 localNormal = normalize(vec3((hL - hR) / (2.0 * eps), (hD - hU) / (2.0 * eps), 1.0));
  vNormal = normalize(normalMatrix * localNormal);

  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = worldPos.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
