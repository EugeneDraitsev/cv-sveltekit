// Climate-driven biome weights, shared by the terrain vertex and fragment
// shaders. Two decorrelated fbm channels (temperature × moisture) locate the
// point in climate space; each biome pulls with a gaussian falloff around its
// own climate center. MUST stay in sync with biomeWeights() in noise.ts —
// flora placement runs the same math on the CPU.
// Requires chunks/simplex2d.glsl (fbm3o) to be included first.

uniform float uBiomeCount;
uniform vec2 uBioClimate[4];
uniform float uClimateScale;
uniform vec2 uClimOffT;
uniform vec2 uClimOffM;

vec4 biomeWeights(vec2 p) {
  float t = fbm3o(p * uClimateScale + uClimOffT);
  float m = fbm3o(p * uClimateScale + uClimOffM);
  vec4 w = vec4(0.0);
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uBiomeCount) break;
    vec2 c = uBioClimate[i];
    float d2 = (t - c.x) * (t - c.x) + (m - c.y) * (m - c.y);
    w[i] = exp(-d2 * 14.0);
  }
  return w / max(w.x + w.y + w.z + w.w, 1e-5);
}
