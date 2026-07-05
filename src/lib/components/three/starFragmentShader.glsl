#include ./chunks/simplex3d.glsl;

uniform vec3 uColor;
uniform float uTime;
uniform float uSeed;

varying vec3 vObjNormal;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec3 n = normalize(vObjNormal);
  vec3 p = n * 2.6 + vec3(uSeed);

  // Domain-warped fbm — boiling granulation drifting over the surface.
  float warp = fbm3(p + vec3(uTime * 0.05));
  float cells = fbm3(p * 1.9 + warp * 0.85 + vec3(0.0, uTime * 0.045, uTime * 0.03));
  float t = cells * 0.5 + 0.5;

  vec3 deep = uColor * 0.32;
  vec3 hot = mix(uColor, vec3(1.0), 0.78);
  vec3 color = mix(deep, uColor, smoothstep(0.12, 0.58, t));
  color = mix(color, hot, smoothstep(0.58, 0.94, t));

  // Limb darkening toward the edge + a chromatic rim flare on top of it.
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float ndv = clamp(dot(normalize(vWorldNormal), viewDir), 0.0, 1.0);
  color *= 0.6 + 0.55 * ndv;
  color += uColor * pow(1.0 - ndv, 2.0) * 0.9;

  color *= 1.35;

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
