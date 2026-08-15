#include ./chunks/simplex2d.glsl;
#include ./chunks/biomes.glsl;

uniform float uTime;
uniform vec2 uScroll;      // world-anchored snap of the camera position
uniform float uGridScale;  // grid zoom: 1 near the ground, higher as you climb
uniform vec2 uSeedOffset;  // per-planet offset so no two worlds share terrain
uniform float uTerrainScale;
uniform float uHeightScale;
uniform vec4 uBioHeightMul; // per-biome relief multipliers (packed)
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

float rawHeight(vec2 p, float mul) {
  float h = fbm5(p * uTerrainScale);
  // Cloud mode: flatten the spectrum into soft, billowy swells.
  h = mix(h, h * 0.5 + 0.3 * snoise2(p * uTerrainScale * 0.5), uCloudMode);
  return h * uHeightScale * mul;
}

// Final displaced height: flooded areas flatten to the water line with
// traveling waves. Waves move ALONG THE WIND, independent of the terrain
// scroll — liquids get their own motion instead of being painted onto the
// streaming landscape.
float surfaceHeight(vec2 p, float mul) {
  float h = rawHeight(p, mul);
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
  // Local plane XY becomes world XZ after the mesh's -PI/2 X rotation. The
  // mesh is a floating grid parked on whole grid cells under the camera, and
  // uScroll carries that same snap — so every vertex samples a WORLD-anchored
  // noise position: terrain is a fixed field the player moves through.
  // uGridScale spreads the same vertex budget over more ground as the camera
  // climbs; the snap on the CPU side uses the scaled cell size to match.
  vec2 local = position.xy * uGridScale;
  vec2 scrolled = local + uScroll + uSeedOffset;

  // Per-biome relief: one climate lookup per vertex, the multiplier is
  // reused for the normal taps (noise.ts mirrors this for flora placement).
  vec4 bw = biomeWeights(scrolled);
  float mul = dot(bw, uBioHeightMul);

  float hRaw = rawHeight(scrolled, mul);
  float h = surfaceHeight(scrolled, mul);

  vHeight = hRaw;
  vNoisePos = scrolled;

  vec3 displaced = vec3(local, position.z + h);

  // Normals via finite differences of the *flattened* height, so water reads
  // as a level plane and shorelines shade correctly.
  float eps = 1.1;
  float hL = surfaceHeight(scrolled + vec2(-eps, 0.0), mul);
  float hR = surfaceHeight(scrolled + vec2(eps, 0.0), mul);
  float hD = surfaceHeight(scrolled + vec2(0.0, -eps), mul);
  float hU = surfaceHeight(scrolled + vec2(0.0, eps), mul);

  vec3 localNormal = normalize(vec3((hL - hR) / (2.0 * eps), (hD - hU) / (2.0 * eps), 1.0));
  vNormal = normalize(normalMatrix * localNormal);

  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = worldPos.xyz;

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
