#include ./chunks/simplex3d.glsl;

// Universal procedural planet surface — one shader covers every archetype via
// uniforms: gas giants raise uBand (latitude striping), lava worlds raise
// uEmissive (glowing cracks), living worlds raise uCloudiness. Moons are just
// small planets with muted colors.

uniform vec3 uColorA;      // dominant surface color
uniform vec3 uColorB;      // secondary / lowlands
uniform vec3 uColorC;      // highlights / caps
uniform vec3 uAtmosphere;  // fresnel rim tint
uniform vec3 uLightDir;    // surface → star, world space
uniform vec3 uLightColor;
uniform float uTime;
uniform float uSeed;
uniform float uNoiseScale;
uniform float uBand;        // 0..1 latitude banding (gas giants)
uniform float uCloudiness;  // 0..1 drifting cloud layer
uniform float uEmissive;    // 0..1 lava crack glow

varying vec3 vObjNormal;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
  vec3 n = normalize(vObjNormal);
  vec3 p = n * uNoiseScale + vec3(uSeed);

  float base = fbm3(p) * 0.5 + 0.5;

  // Latitude bands, warped so gas giants get turbulent stripe edges.
  float warp = fbm3(p * 0.7 + vec3(0.0, uTime * 0.008, 0.0));
  float bands = 0.5 + 0.5 * sin((n.y + warp * 0.26) * 9.5 + uSeed);
  float f = mix(base, bands, uBand);

  vec3 color = mix(uColorB, uColorA, smoothstep(0.22, 0.6, f));
  color = mix(color, uColorC, smoothstep(0.66, 0.92, f));

  // Fine grain so close-ups don't look airbrushed.
  float detail = snoise3(p * 5.0) * 0.5 + 0.5;
  color *= 0.9 + 0.16 * detail;

  // Drifting clouds on living worlds.
  if (uCloudiness > 0.001) {
    float clouds = fbm3(p * 2.4 + vec3(uTime * 0.014, 0.0, uTime * 0.01));
    color = mix(color, vec3(0.96), smoothstep(0.16, 0.55, clouds) * uCloudiness);
  }

  // Day/night with a soft terminator.
  vec3 wn = normalize(vWorldNormal);
  float nl = dot(wn, normalize(uLightDir));
  float day = smoothstep(-0.12, 0.32, nl);
  vec3 lit = color * (0.05 + uLightColor * day);

  // Atmosphere: fresnel rim, strongest on the lit limb.
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - clamp(dot(wn, viewDir), 0.0, 1.0), 2.6);
  lit += uAtmosphere * fresnel * (0.15 + 0.85 * day) * 0.9;

  // Lava cracks glow through the night side.
  if (uEmissive > 0.001) {
    float cracks = smoothstep(0.55, 0.75, fbm3(p * 3.2) * 0.5 + 0.5);
    lit += vec3(1.0, 0.4, 0.1) * cracks * uEmissive * 1.5;
  }

  gl_FragColor = vec4(lit, 1.0);
  #include <colorspace_fragment>
}
