#include ./chunks/simplex3d.glsl;

uniform vec3 uColor;
uniform float uTime;
uniform float uSeed;

varying vec2 vUv;

// Additive billboard glow around the star: radial falloff with slowly
// flickering angular streamers.
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;

  float angle = atan(vUv.y, vUv.x);
  vec3 ap = vec3(cos(angle), sin(angle), uTime * 0.1) * 2.2 + vec3(uSeed);
  float streamers = snoise3(ap) * 0.5 + 0.5;

  float falloff = pow(clamp(1.0 - r, 0.0, 1.0), 2.4);
  float inner = smoothstep(0.45, 0.16, r);

  float alpha = falloff * (0.5 + 0.5 * streamers) * 0.85 + inner * 0.35;
  vec3 color = mix(uColor, vec3(1.0), 0.3);

  // Straight alpha: works under AdditiveBlending (dark theme) and
  // NormalBlending (light theme paper background) alike.
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
