#include ./chunks/simplex2d.glsl;

uniform float uTime;
uniform float uTerrainScale;
uniform float uHeightScale;
uniform float uWaterLevel;
uniform float uWaterKind;      // 0 none · 1 water · 2 lava · 3 ice
uniform float uCloudMode;
uniform vec2 uWindDir;         // per-planet wind — liquid surfaces travel along it
uniform float uFlowSpeed;      // how fast the liquid surface pattern travels

// Per-biome elevation palettes, blended by the climate weights.
uniform vec3 uBioLow[4];
uniform vec3 uBioMid[4];
uniform vec3 uBioHigh[4];
uniform vec3 uBioPeak[4];
uniform vec3 uWaterColor;
uniform vec3 uCliffColor;

uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
// Sky gradient, mirrored from skyFragmentShader so fog can land on the exact
// backdrop colour behind it.
uniform vec3 uSkyHorizon;
uniform vec3 uSkyZenith;

varying float vHeight;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vNoisePos;
varying vec4 vBiomeWeights;

// Depth of the flooded column at this fragment (world units).
float waterDepth() {
  float w = (uWaterLevel - 0.5) * 1.6 * uHeightScale;
  return max(w - vHeight, 0.0);
}

void main() {
  float nh = clamp(vHeight / (uHeightScale * 1.6) + 0.5, 0.0, 1.0);
  vec3 normal = normalize(vNormal);
  float slope = 1.0 - normal.y;

  // Blend the elevation palettes of up to 4 biomes by the climate weights —
  // Minecraft-style regions with soft borders, one set of bands per biome.
  vec4 bw = vBiomeWeights / max(dot(vBiomeWeights, vec4(1.0)), 0.00001);
  vec3 low = uBioLow[0] * bw.x + uBioLow[1] * bw.y + uBioLow[2] * bw.z + uBioLow[3] * bw.w;
  vec3 mid = uBioMid[0] * bw.x + uBioMid[1] * bw.y + uBioMid[2] * bw.z + uBioMid[3] * bw.w;
  vec3 high = uBioHigh[0] * bw.x + uBioHigh[1] * bw.y + uBioHigh[2] * bw.z + uBioHigh[3] * bw.w;
  vec3 peak = uBioPeak[0] * bw.x + uBioPeak[1] * bw.y + uBioPeak[2] * bw.z + uBioPeak[3] * bw.w;

  // Height bands measured above the water line so beaches hug shorelines.
  float wl = max(uWaterLevel, 0.12);
  float t = clamp((nh - wl) / max(1.0 - wl, 0.001), 0.0, 1.0);

  vec3 color = low;
  color = mix(color, mid, smoothstep(0.09, 0.24, t));
  color = mix(color, high, smoothstep(0.44, 0.62, t));
  color = mix(color, peak, smoothstep(0.76, 0.9, t));

  // Rocky cliffs on steep land (skipped for cloud tops).
  float rockW = smoothstep(0.42, 0.72, slope) * (1.0 - uCloudMode);
  color = mix(color, uCliffColor, rockW * 0.85);

  // Flooded surfaces: water / lava / ice sheets. The shoreline is resolved
  // per-pixel from the interpolated raw height (not per-vertex), so it stays
  // crisp and stable while the terrain scrolls. Liquid surface patterns
  // travel along the planet's wind, giving them motion of their own instead
  // of being painted onto the streaming landscape.
  float shore = 1.0; // 0 = liquid, 1 = land
  float isLava = 0.0;
  if (uWaterLevel >= 0.0) {
    float waterH = (uWaterLevel - 0.5) * 1.6 * uHeightScale;
    shore = smoothstep(waterH - 0.05, waterH + 0.05, vHeight);

    vec2 flow = uWindDir * (uTime * uFlowSpeed);
    vec2 crossDir = vec2(-uWindDir.y, uWindDir.x);

    float depthN = clamp((waterDepth()) / (uHeightScale * 0.45), 0.0, 1.0);
    vec3 liquid = mix(uWaterColor, uWaterColor * 0.42, depthN);

    if (uWaterKind == 1.0) {
      // Shallows show the sand through the water.
      liquid = mix(mix(low, uWaterColor, 0.55), liquid, smoothstep(0.0, 0.3, depthN));

      // Waves: domain-warped so crests reshape while slowly drifting
      // downwind — an evolving surface, not a sliding decal.
      float warpN = snoise2(vNoisePos * 0.35 + flow * 0.4 + 7.3);
      float waveA = snoise2(vNoisePos * 0.55 - flow + warpN * 0.45);
      float waveB = snoise2(vNoisePos * 1.3 - flow * 0.6 - warpN * 0.3 + vec2(3.1, -1.7));
      liquid += vec3(0.03, 0.042, 0.055) * (waveA * 0.6 + waveB * 0.4);

      // Grazing angles mirror the sky.
      vec3 viewDir = normalize(cameraPosition - vWorldPos);
      float fres = pow(1.0 - clamp(dot(viewDir, normal), 0.0, 1.0), 3.0);
      liquid = mix(liquid, uFogColor, fres * 0.5);

      // Twinkling sun glints stretched along the wind, strongest at grazing.
      vec2 glintUV = vec2(dot(vNoisePos, uWindDir) * 0.3, dot(vNoisePos, crossDir) * 2.4);
      float glint = snoise2(glintUV - vec2(uTime * uFlowSpeed * 0.5, 0.0));
      float twinkle = snoise2(glintUV * 3.1 + vec2(uTime * 0.55, 0.0));
      liquid += uLightColor * smoothstep(0.25, 0.75, glint * twinkle) * (0.05 + fres * 0.2);

      // Foam collar, dissolving and reforming along the shoreline.
      float foamBand = 1.0 - smoothstep(0.0, 0.14, abs(vHeight - waterH));
      float foamNoise = snoise2(vNoisePos * 2.0 - flow * 0.7 + warpN * 0.5) * 0.5 + 0.5;
      liquid = mix(liquid, vec3(0.9, 0.94, 0.96), foamBand * smoothstep(0.42, 0.8, foamNoise) * 0.4);
    } else if (uWaterKind == 2.0) {
      // Lava: bright, slowly creeping downwind, unlit (handled below).
      float churn = fbm3o(vNoisePos * 0.35 - flow);
      liquid = uWaterColor * (1.05 + 0.35 * churn);
      liquid += vec3(0.9, 0.35, 0.05) * smoothstep(0.3, 0.75, churn) * 0.6;
      // Darker cooled plates drifting on the surface.
      float crust = smoothstep(0.45, 0.7, fbm3o(vNoisePos * 0.8 - flow * 0.4 + 11.3));
      liquid = mix(liquid, liquid * 0.55, crust * 0.5);
    } else if (uWaterKind == 3.0) {
      // Ice sheets: frozen solid — cracks stay locked to the landscape,
      // only a faint sheen sweeps across.
      float crack = abs(snoise2(vNoisePos * 0.28));
      liquid = mix(liquid, liquid * 0.62, 1.0 - smoothstep(0.0, 0.02, crack));
      liquid = mix(liquid, vec3(1.0), 0.12);
      float sheen = snoise2(vNoisePos * 0.5 - flow);
      liquid += vec3(0.05) * smoothstep(0.4, 0.9, sheen);
    }

    color = mix(liquid, color, shore);
    isLava = uWaterKind == 2.0 ? 1.0 - shore : 0.0;
  }

  // Fine grain so large fields don't band.
  float detail = fbm3o(vNoisePos * uTerrainScale * 9.0);
  color *= 0.88 + 0.12 * (detail * 0.5 + 0.5) * (1.0 - uCloudMode * 0.5);

  // Lighting: star-tinted lambert + hemispheric sky/ground ambient.
  vec3 lightDir = normalize(uLightDir);
  float diffuse = max(dot(normal, lightDir), 0.0);
  float diffuseStrength = mix(0.78, 0.45, uCloudMode);
  float ambientStrength = mix(0.55, 0.85, uCloudMode);
  vec3 ambient = mix(vec3(0.16), uFogColor, normal.y * 0.5 + 0.5) * ambientStrength;
  vec3 lit = color * (ambient + uLightColor * diffuse * diffuseStrength);

  // Lava is emissive — ignore lighting and warm up nearby lowlands.
  lit = mix(lit, color, isLava);
  if (uWaterKind == 2.0) {
    float lowGlow = pow(1.0 - t, 2.0) * shore;
    lit += uWaterColor * lowGlow * 0.22;
  }

  // Distance fog hides the far-edge morph of the infinite scroll. Measured in
  // 3D: a horizontal-only distance leaves the ground crisp no matter how high
  // you climb, which turns the grid into a visibly floating square slab. The
  // fog range grows with the grid scale (see PlanetScene), so climbing still
  // shows the landscape — just with more air in front of it.
  float dist = length(vWorldPos - cameraPosition);
  float fogFactor = smoothstep(uFogNear, uFogFar, dist);

  // Fully fogged terrain is a flat slab of uFogColor. Where that colour differs
  // from the sky behind it, the grid's straight edge shows up as a silhouette —
  // so over the last stretch of the ramp, drift the fog to the sky colour in
  // this exact view direction and let the edge dissolve into the backdrop.
  vec3 viewDir = normalize(vWorldPos - cameraPosition);
  vec3 skyTint = mix(uSkyHorizon, uSkyZenith, smoothstep(-0.06, 0.6, viewDir.y));
  float skyHaze = 1.0 - smoothstep(0.0, 0.26, abs(viewDir.y + 0.02));
  skyTint = mix(skyTint, uSkyHorizon, skyHaze * 0.55);

  lit = mix(lit, mix(uFogColor, skyTint, smoothstep(0.55, 1.0, fogFactor)), fogFactor);

  gl_FragColor = vec4(lit, 1.0);
  #include <colorspace_fragment>
}
