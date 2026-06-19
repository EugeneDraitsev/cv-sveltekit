varying float vElevation;
varying vec3 vPosition;
varying float vBiomeMix; // Keep for legacy/debug, but we recompute
varying float vBiomeIndex; // Keep for legacy/debug, but we recompute

uniform vec2 uOffset;
uniform float uNoiseScale;
uniform float uFogDist;
uniform float uBiomeOverride; // Add Override logic
uniform float uTime;

float clamp01(float value) {
    return clamp(value, 0.0, 1.0);
}

vec3 getBiomeAccent(float biome) {
    if (biome < 0.5) return vec3(0.35, 0.85, 1.0);
    if (biome < 1.5) return vec3(1.0, 0.35, 0.05);
    if (biome < 2.5) return vec3(0.25, 1.0, 0.55);
    return vec3(1.0, 0.72, 0.25);
}

vec3 getFogColor(float biome) {
    if (biome < 0.5) return vec3(0.02, 0.07, 0.16);
    if (biome < 1.5) return vec3(0.12, 0.015, 0.0);
    if (biome < 2.5) return vec3(0.015, 0.08, 0.06);
    return vec3(0.12, 0.07, 0.025);
}

vec3 getBiomeColor(float biome, float h) {
    vec3 colA = vec3(0.4, 0.2, 0.1);
    vec3 colB = vec3(0.8, 0.4, 0.1);
    vec3 colC = vec3(1.0, 0.7, 0.3);
    vec3 colD = vec3(1.0, 0.9, 0.7);
    vec3 color = colA;
    bool hasWater = false;
    
    // Adjusted Thresholds
    float t1 = 0.5;
    float t2 = 5.0;
    float t3 = 14.0;
    float bandSoftness = 1.0;
    
    if (biome < 0.5) { // ICE
        colA = vec3(0.02, 0.05, 0.2);     
        colB = vec3(0.1, 0.3, 0.8);       
        colC = vec3(0.4, 0.7, 0.9);       
        colD = vec3(0.9, 0.95, 1.0);      
    } else if (biome < 1.5) { // VOLCANO
        colA = vec3(0.2, 0.0, 0.0);       
        colB = vec3(0.6, 0.05, 0.0);      
        colC = vec3(1.0, 0.4, 0.0);       
        colD = vec3(1.0, 0.8, 0.2);       
        t1 = -0.5; t2 = 1.0; t3 = 2.0;    
    } else if (biome < 2.5) { // FOREST
        colA = vec3(0.05, 0.1, 0.05);     
        colB = vec3(0.1, 0.3, 0.15);       
        colC = vec3(0.2, 0.6, 0.3);       
        colD = vec3(0.7, 0.9, 0.5);       
        hasWater = true;
    }
        
    if (hasWater) {
        // SOFT WATER EDGE
        // Mix water color based on elevation
        // -0.4 is deep water, -0.35 is shoreline
        vec3 waterCol = vec3(0.0, 0.4, 0.8);
        float waterMix = smoothstep(-0.4, -0.35, h);
        
        // Apply bands first
        vec3 landCol = colA; 
        landCol = mix(landCol, colB, smoothstep(t1, t1 + bandSoftness, h));
        landCol = mix(landCol, colC, smoothstep(t2, t2 + bandSoftness, h));
        landCol = mix(landCol, colD, smoothstep(t3, t3 + bandSoftness, h));
        
        color = mix(waterCol, landCol, waterMix);
    } else {
        color = colA; 
        color = mix(color, colB, smoothstep(t1, t1 + bandSoftness, h));
        color = mix(color, colC, smoothstep(t2, t2 + bandSoftness, h));
        color = mix(color, colD, smoothstep(t3, t3 + bandSoftness, h));
    }
    
    return color;
}

void main() {
  // --- RECALCULATE BIOME LOGIC (Fixing Precision) ---
  float biomeProgress = -uOffset.y * 0.005; 
  float biomeLocal = fract(biomeProgress);
  float idx = mod(floor(biomeProgress), 4.0);
  
  if (uBiomeOverride > -0.5) {
      idx = uBiomeOverride;
      biomeLocal = 0.0; 
  }

  // FORCE INT CASTING (Rounding)
  // idx is exactly 0.0, 1.0, 2.0 etc.
  // Add 0.5 for safety against float errors like 0.9999
  float current = floor(idx + 0.5);
  float next = mod(current + 1.0, 4.0);
  
  float mixFactor = smoothstep(0.8, 1.0, biomeLocal); 

  vec3 c1 = getBiomeColor(current, vElevation);
  vec3 c2 = getBiomeColor(next, vElevation);
  
  vec3 color = mix(c1, c2, mixFactor);
  vec3 accent = mix(getBiomeAccent(current), getBiomeAccent(next), mixFactor);
  
  // DEBUG RED if logic is failing 
  // if (current == 1 && c1.b > 0.1) color = vec3(1.0, 0.0, 1.0); // Pink detection

  float contour = smoothstep(0.47, 0.5, abs(fract(vElevation * 0.34 + uTime * 0.045) - 0.5));
  contour *= smoothstep(-0.4, 5.0, vElevation);

  float laneMask = exp(-pow(abs(abs(vPosition.x) - 8.0) * 0.58, 2.0));
  float lanePulse = pow(0.5 + 0.5 * sin(vPosition.z * 0.52 - uTime * 5.8), 7.0);
  float scanWave = smoothstep(0.46, 0.5, abs(fract((-vPosition.z + uTime * 18.0) * 0.035) - 0.5));
  float centerGlow = exp(-pow(abs(vPosition.x) * 0.16, 2.0)) * (1.0 - smoothstep(-18.0, 8.0, vPosition.z));

  color += accent * contour * 0.18;
  color += accent * laneMask * lanePulse * 0.5;
  color += accent * scanWave * centerGlow * 0.28;
  
  // Fog
  float depth = gl_FragCoord.z / gl_FragCoord.w;
  float fogStart = uFogDist * 0.2;
  float fogEnd = uFogDist;
  float fogFactor = smoothstep(fogStart, fogEnd, depth);
  
  vec3 fogColor = mix(getFogColor(current), getFogColor(next), mixFactor);
  float horizonGlow = smoothstep(fogStart, fogEnd, depth) * (1.0 - clamp01(fogFactor * 0.85));
  fogColor += accent * horizonGlow * 0.12;
  
  gl_FragColor = vec4(mix(color, fogColor, fogFactor), 1.0);
}
