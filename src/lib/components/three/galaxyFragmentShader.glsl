varying vec3 vColor;
varying float vIsNebula;
varying float vSeed;
uniform float uNebulaIntensity;
uniform float uTime;

void main() {
  // Calculate distance from center of point
  float dist = distance(gl_PointCoord, vec2(0.5));
  float alpha = 1.0 - dist;
  float strength;

  // Different rendering for nebula vs regular particles
  if (vIsNebula > 0.5) {
    // Nebula particles - more spherical, less glowing appearance
    // More even falloff for a more spherical appearance
    strength = pow(alpha, 2.0); // More even falloff for spherical look

    // Add some internal texture to nebula particles
    float noise = fract(sin(gl_PointCoord.x * 12.0 + gl_PointCoord.y * 34.0) * 5678.0);
    strength *= mix(0.9, 1.0, noise); // More subtle internal texture

    // Wider cutoff for nebula particles to make them appear wider
    if (dist > 0.95) discard; // Hard edge at 95% of radius for wider appearance

    // Apply nebula intensity
    strength *= uNebulaIntensity;
  } else {
    // Regular galaxy particles - perfect circles with sharp edges
    // Use step function for perfect circle with no falloff
    if (dist > 0.5) discard; // Hard cutoff at edge of circle

    // Add a slight glow effect while maintaining circular shape
    strength = 1.0 - smoothstep(0.35, 0.5, dist);
  }

  // Final color - nebula particles can have a slight color shift
  vec3 finalColor;

  if (vIsNebula > 0.5) {
    // For nebula, even less luminous appearance
    finalColor = mix(vec3(0.0), vColor * 0.8, alpha); // Reduced brightness by 20%

    // Add a more subtle reddish/pink tint to nebula
    float tintFactor = 0.2; // Even less tint for more subtle color
    finalColor.r = mix(finalColor.r, finalColor.r * 1.3, tintFactor); // Less red enhancement
    finalColor.b = mix(finalColor.b, finalColor.b * 1.1, tintFactor * 0.7); // Less blue for subtler pink effect
    finalColor.g *= 0.85; // Less green reduction for subtler color
  } else {
    // Regular stars with reduced brightness
    finalColor = mix(vec3(0.0), vColor * 0.85, alpha); // Reduced brightness by 15%
  }

  // Subtle twinkle and breathing
  float amp = mix(0.15, 0.06, vIsNebula);
  float twinkle = 0.85 + amp * sin(uTime * 2.0 + vSeed * 6.2831);
  strength *= twinkle;

  float breath = 0.97 + 0.03 * sin(uTime * 0.35 + vSeed * 3.14159);
  finalColor *= breath;

  // Subtle per-star color temperature variation
  vec3 warm = vec3(1.03, 1.0, 0.97);
  vec3 cool = vec3(0.97, 1.0, 1.03);
  vec3 tempTint = mix(warm, cool, fract(vSeed + 0.137));
  finalColor *= tempTint;

  // Use strength as alpha to create circular particles
  gl_FragColor = vec4(finalColor, strength);
  #include <colorspace_fragment>
}
