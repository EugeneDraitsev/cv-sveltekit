uniform float uTime;
uniform float uSize;
uniform float uNebulaIntensity;

attribute float aScale;
attribute vec3 aRandomness;
attribute float aIsNebula;

varying vec3 vColor;
varying float vIsNebula;
varying float vSeed;

void main() {
  // Position
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);

  // Pass isNebula to fragment shader
  vIsNebula = aIsNebula;

  // Spin the galaxy - nebula particles spin slower
  float angle = atan(modelPosition.x, modelPosition.z);
  float distanceToCenter = length(modelPosition.xz);
  float safeDist = max(distanceToCenter, 0.001);

  // Nebula particles spin slower than regular galaxy particles
  float spinFactor = mix(0.2, 0.05, aIsNebula);
  float angleOffset = 1.0 / safeDist * uTime * spinFactor;
  angle += angleOffset;

  modelPosition.x = cos(angle) * distanceToCenter;
  modelPosition.z = sin(angle) * distanceToCenter;

  // Randomness - maintain disk shape during animation
  vec3 finalRandomness = aRandomness;

  // Add subtle pulsing movement to nebula particles
  if (aIsNebula > 0.5) {
    // Apply pulsing primarily to horizontal dimensions (X and Z)
    float pulseFactor = sin(uTime * 0.5) * 0.2 + 0.8; // 0.6 to 1.0 range
    finalRandomness.x *= pulseFactor;
    finalRandomness.z *= pulseFactor;

    // Apply much less pulsing to vertical dimension (Y) to maintain disk shape
    finalRandomness.y *= mix(0.9, 1.0, pulseFactor); // Very subtle vertical pulsing

    // No additional vertical oscillation to maintain disk shape
  }

  // Ensure particles stay close to galactic plane
  finalRandomness.y *= 0.8; // Further reduce vertical randomness for all particles

  modelPosition.xyz += finalRandomness;

  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectionPosition = projectionMatrix * viewPosition;
  gl_Position = projectionPosition;

  // Size - nebula particles can have a pulsing size
  float sizeMultiplier = 1.0;

  // Add subtle size pulsing to nebula particles
  if (aIsNebula > 0.5) {
    // Different frequency for size pulsing to avoid synchronization with position
    float sizePulse = sin(uTime * 0.7 + distanceToCenter * 3.0) * 0.2 + 0.9; // 0.7 to 1.1 range
    sizeMultiplier *= sizePulse;
    // Subtly scale nebula size with intensity
    float nebulaScale = mix(0.8, 1.8, clamp(uNebulaIntensity * 0.5, 0.0, 1.0));
    sizeMultiplier *= nebulaScale;
  }

  gl_PointSize = uSize * aScale * sizeMultiplier;
  gl_PointSize *= 1.0 / -viewPosition.z;

  // Seed for per-particle twinkle
  vSeed = fract(sin(dot(aRandomness, vec3(12.9898, 78.233, 37.719))) * 43758.5453);

  // Color
  vColor = color;
}
