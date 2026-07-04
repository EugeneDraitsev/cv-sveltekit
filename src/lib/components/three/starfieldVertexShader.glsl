uniform float uPixelRatio;

attribute float aScale;
attribute float aSeed;

varying float vSeed;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = 2.2 * aScale * uPixelRatio;
  vSeed = aSeed;
}
