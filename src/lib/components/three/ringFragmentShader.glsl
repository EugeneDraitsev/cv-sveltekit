uniform vec3 uColor;
uniform float uOpacity;
uniform float uInner;
uniform float uOuter;
uniform float uSeed;

varying vec2 vLocal;

// Banded translucent planetary rings with softly faded edges.
void main() {
  float r = length(vLocal);
  float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);

  float bands = 0.6 + 0.4 * sin(t * 42.0 + uSeed * 6.28);
  bands *= 0.75 + 0.25 * sin(t * 137.0 + uSeed * 12.9);

  float edges = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.82, 1.0, t));
  // A darker Cassini-style gap partway through.
  float gap = 1.0 - 0.75 * smoothstep(0.6, 0.63, t) * (1.0 - smoothstep(0.68, 0.71, t));

  float alpha = bands * edges * gap * uOpacity;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
