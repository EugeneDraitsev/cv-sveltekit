uniform float uTime;
uniform float uBoost;  // 0..1 — eased boost factor
uniform float uAspect;

varying vec2 vUv;

float hash1(float n) {
  return fract(sin(n) * 43758.5453);
}

// Classic anime-style speed lines: sparse radial streaks rushing past at the
// screen edges while the center stays clear.
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  float r = length(p);
  float angle = atan(p.y, p.x);

  // 140 angular sectors, each hosting one potential streak.
  float sectorPos = (angle / 6.28318 + 0.5) * 140.0;
  float sector = floor(sectorPos);
  float h = hash1(sector * 12.9898);

  // Thin line profile inside the sector — streaks, not slabs.
  float across = abs(fract(sectorPos) - 0.5);
  float thin = 1.0 - smoothstep(0.04, 0.16, across);

  // Streak dashes race outward, each sector at its own phase and speed.
  float phase = fract(r * 1.4 - uTime * (2.6 + h * 2.4) - h * 7.0);
  float dash = smoothstep(0.45, 0.95, phase) * step(0.62, h);

  // Confined to the edges; the middle of the view stays readable.
  float edge = smoothstep(0.45, 1.1, r);

  float alpha = dash * thin * edge * uBoost * 0.5;
  gl_FragColor = vec4(vec3(1.0), alpha);
}
