uniform float uTime;
uniform vec3 uWarm;
uniform vec3 uCool;
uniform float uAlpha;

varying float vSeed;

// Distant background stars: round points, subtle twinkle, slight temperature
// variation between warm and cool white.
void main() {
  float dist = distance(gl_PointCoord, vec2(0.5));
  if (dist > 0.5) discard;

  float strength = 1.0 - smoothstep(0.1, 0.5, dist);
  float twinkle = 0.72 + 0.28 * sin(uTime * (1.2 + vSeed * 1.8) + vSeed * 40.0);

  vec3 color = mix(uWarm, uCool, fract(vSeed * 7.31));

  gl_FragColor = vec4(color, strength * twinkle * uAlpha);
  #include <colorspace_fragment>
}
