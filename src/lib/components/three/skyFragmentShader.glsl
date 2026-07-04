uniform vec3 uHorizon;
uniform vec3 uZenith;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunDisc;  // 1 = crisp disc, lower = hazy (thick atmospheres)
uniform float uStars;    // 0..1 background-star visibility
uniform float uTime;

varying vec3 vWorldPos;

// Per-planet sky dome: vertical gradient, the system's star as the sun,
// and (for thin atmospheres) a field of twinkling background stars.
void main() {
  vec3 dir = normalize(vWorldPos - cameraPosition);
  float h = clamp(dir.y, -1.0, 1.0);

  vec3 color = mix(uHorizon, uZenith, smoothstep(-0.06, 0.6, h));

  // Sun: sharp disc plus a broad chromatic glow.
  float d = clamp(dot(dir, normalize(uSunDir)), 0.0, 1.0);
  float disc = smoothstep(0.99915, 0.99965, d) * uSunDisc;
  float glow = pow(d, 160.0) * 0.75 + pow(d, 10.0) * 0.16;
  color += uSunColor * (disc * 1.25 + glow);

  // Background stars fade in near the zenith on thin-atmosphere worlds.
  if (uStars > 0.001) {
    vec3 cell = floor(dir * 210.0);
    float hash = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float star = step(1.0 - uStars * 0.014, hash);
    float twinkle = 0.6 + 0.4 * sin(uTime * 2.2 + hash * 61.0);
    color += vec3(0.88, 0.93, 1.0) * star * twinkle * smoothstep(0.02, 0.35, h) * 0.85;
  }

  // Haze band hugging the horizon.
  float haze = 1.0 - smoothstep(0.0, 0.26, abs(h + 0.02));
  color = mix(color, uHorizon, haze * 0.55);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
