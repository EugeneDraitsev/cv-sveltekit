#version 300 es
in vec4 a_position;
in vec3 a_color;
in float a_scale;
in vec3 a_randomness;

uniform float u_time;
uniform float u_size;
uniform mat4 u_modelViewProjection;

out vec3 v_color;
out float v_distance;

void main() {
  // Position
  vec4 position = a_position;

  // Time based animation
  float angle = atan(position.x, position.z);
  float distanceToCenter = length(position.xz);
  float angleOffset = (1.0 / distanceToCenter) * u_time * 0.2;
  angle += angleOffset;
  position.x = cos(angle) * distanceToCenter;
  position.z = sin(angle) * distanceToCenter;

  // Randomness
  vec3 randomnessDisplacement = a_randomness * (sin(u_time * 0.1) * 0.5 + 0.5);
  position.xyz += randomnessDisplacement;

  vec4 viewPosition = inverse(u_modelViewProjection) * gl_Position;
  // Calculate distance to camera
  v_distance = abs(viewPosition.z);

  gl_Position = u_modelViewProjection * vec4(position.xyz, 1.0);

  // Size
  gl_PointSize = u_size * a_scale;
  gl_PointSize *= 1.0 / -viewPosition.z;

  // Color
  v_color = a_color;
}