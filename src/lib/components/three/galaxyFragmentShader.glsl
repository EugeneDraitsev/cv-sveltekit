varying vec3 vColor;

void main() {
  // Disc
  //  float strength = distance(gl_PointCoord, vec2(0.5));
  //  strength = step(0.5, strength);
  //  strength = 1.0 - strength;

  // Diffuse point
  //  float strength = distance(gl_PointCoord, vec2(0.5));
  //  strength *= 2.0;
  //  strength = 1.0 - strength;

  // Light point
  float strength = distance(gl_PointCoord, vec2(0.5));
  float alpha = 1.0 - strength;
  strength = pow(alpha, 10.0);

  if (strength < 0.15) discard;

  // Final color
  vec3 color = mix(vec3(0.0), vColor, alpha);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
