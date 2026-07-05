varying vec2 vUv;

// Fullscreen overlay quad — bypasses the camera entirely.
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
