uniform float uTime;

varying float vSeed;

// Distant background stars: round points, subtle twinkle, slight temperature
// variation between warm and cool white.
void main() {
  float dist = distance(gl_PointCoord, vec2(0.5));
  if (dist > 0.5) discard;

  float strength = 1.0 - smoothstep(0.1, 0.5, dist);
  float twinkle = 0.72 + 0.28 * sin(uTime * (1.2 + vSeed * 1.8) + vSeed * 40.0);

  vec3 warm = vec3(1.0, 0.92, 0.82);
  vec3 cool = vec3(0.82, 0.9, 1.0);
  vec3 color = mix(warm, cool, fract(vSeed * 7.31));

  gl_FragColor = vec4(color, strength * twinkle * 0.85);
  #include <colorspace_fragment>
}
