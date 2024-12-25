#version 300 es
precision highp float;

in vec3 v_color;
in float v_distance;
out vec4 out_color;

uniform float u_size;

void main() {
  // Light point
  float strength = distance(gl_PointCoord, vec2(0.5));
  float alpha = 1.0 - strength;

  // Discard pixels below a certain threshold
  if (alpha < 0.15) discard;

  // Scale alpha based on distance
  alpha /= (v_distance * 0.1); // Adjust the factor (0.1 here) to control the scaling

  // Simulate additive blending with alpha
  alpha = pow(alpha, 2.0); // You can adjust the exponent (e.g., 1.5, 2.5)

  // Final color
  vec3 color = v_color * alpha;

  out_color = vec4(color, alpha);
}