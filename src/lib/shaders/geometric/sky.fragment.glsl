varying vec2 vUv;
uniform float uTime;
uniform float uBiomeIndex;
uniform float uBiomeMix;
// Uniform Aspect Ratio to fix oval moons
uniform float uAspectRatio; 

float gold_noise(in vec2 xy, in float seed){
   return fract(tan(distance(xy*1.61803398874989484820459, xy)*seed)*xy.x);
}

float clamp01(float value) {
    return clamp(value, 0.0, 1.0);
}

vec3 getSkyGradient(int biome, float y) {
    vec3 bottom, top;
    if (biome == 0) { // ICE
        bottom = vec3(0.0, 0.05, 0.15); 
        top = vec3(0.0, 0.0, 0.05);    
    } else if (biome == 1) { // VOLCANO
        bottom = vec3(0.15, 0.02, 0.0); 
        top = vec3(0.05, 0.0, 0.0);     
    } else if (biome == 2) { // FOREST
        bottom = vec3(0.1, 0.0, 0.15);  
        top = vec3(0.0, 0.02, 0.05);    
    } else { // DESERT
        bottom = vec3(0.2, 0.1, 0.0);  
        top = vec3(0.0, 0.05, 0.2);     
    }
    return mix(bottom, top, y);
}

vec3 getSkyAccent(int biome) {
    if (biome == 0) return vec3(0.3, 0.85, 1.0);
    if (biome == 1) return vec3(1.0, 0.28, 0.08);
    if (biome == 2) return vec3(0.45, 1.0, 0.55);
    return vec3(1.0, 0.72, 0.25);
}

float circleMask(vec2 uv, vec2 pos, float r, float soft) {
    vec2 d = uv - pos;
    d.x *= uAspectRatio; 
    return 1.0 - smoothstep(r - soft, r + soft, length(d));
}

float circleHalo(vec2 uv, vec2 pos, float r, float spread) {
    vec2 d = uv - pos;
    d.x *= uAspectRatio;
    return 1.0 - smoothstep(r, r + spread, length(d));
}

float auroraBand(vec2 uv, float seed) {
    float wave = 0.57
        + sin(uv.x * 8.0 + uTime * 0.25 + seed) * 0.055
        + sin(uv.x * 18.0 - uTime * 0.14 + seed * 1.7) * 0.025;
    float curtain = 1.0 - smoothstep(0.0, 0.11, abs(uv.y - wave));
    float verticalFade = smoothstep(0.22, 0.52, uv.y) * (1.0 - smoothstep(0.86, 1.0, uv.y));
    float shimmer = 0.72 + 0.28 * sin(uv.x * 34.0 + uTime * 0.9 + seed);
    return curtain * verticalFade * shimmer;
}

float meteor(vec2 uv, float seed) {
    float cycle = fract(uTime * 0.035 + seed);
    float activity = smoothstep(0.04, 0.12, cycle) * (1.0 - smoothstep(0.78, 0.95, cycle));
    vec2 p = uv;
    p.x *= uAspectRatio;
    vec2 head = vec2(mix(-0.15, 1.15, cycle) * uAspectRatio, mix(0.9, 0.48, cycle));
    vec2 direction = normalize(vec2(0.96 * uAspectRatio, -0.34));
    vec2 rel = p - head;
    float along = dot(rel, direction);
    float cross = length(rel - direction * along);
    float tail = smoothstep(-0.55, -0.08, along) * (1.0 - smoothstep(-0.04, 0.04, along));
    float width = mix(0.02, 0.004, clamp01(-along / 0.55));
    return activity * tail * (1.0 - smoothstep(width, width * 2.5, cross));
}

void main() {
    // Star Field - SLOW & STEADY
    float star = 0.0;
    float n = gold_noise(gl_FragCoord.xy, 1.0);
    
    if (n > 0.998) { 
        star = 1.0; 
        float speed = 0.2 + fract(n * 10.0) * 0.5; // VERY SLOW
        float phase = fract(n * 100.0) * 6.28; 
        star *= (0.7 + 0.3 * sin(uTime * speed + phase));
    }

    int current = int(uBiomeIndex);
    int next = int(mod(uBiomeIndex + 1.0, 4.0));
    vec3 g1 = getSkyGradient(current, vUv.y);
    vec3 g2 = getSkyGradient(next, vUv.y);
    vec3 color = mix(g1, g2, uBiomeMix);
    vec3 accent = mix(getSkyAccent(current), getSkyAccent(next), uBiomeMix);
    
    color += vec3(star) * smoothstep(0.1, 0.5, vUv.y);
    color += accent * smoothstep(0.05, 0.35, vUv.y) * (1.0 - smoothstep(0.38, 0.78, vUv.y)) * 0.24;
    color += accent * (auroraBand(vUv, 0.0) * 0.46 + auroraBand(vUv, 2.4) * 0.28);
    color += vec3(1.0, 0.95, 0.78) * (meteor(vUv, 0.12) + meteor(vUv, 0.63) * 0.75);
    
    // MOONS - FIXED ASPECT RATIO & SLOW MOVEMENT
    // Moons now move very slowly 
    
    // Moon 1: Large Center
    vec2 mPos1 = vec2(0.5, 0.65 + 0.02 * cos(uTime * 0.01)); // Barely moves
    float m1 = circleMask(vUv, mPos1, 0.07, 0.004); 
    float h1 = circleHalo(vUv, mPos1, 0.07, 0.12);
    
    // Moon 2: Left
    vec2 mPos2 = vec2(0.2, 0.5 + 0.03 * sin(uTime * 0.02));
    float m2 = circleMask(vUv, mPos2, 0.03, 0.003);
    float h2 = circleHalo(vUv, mPos2, 0.03, 0.07);
    
    // Moon 3: Right
    vec2 mPos3 = vec2(0.8, 0.6 + 0.03 * cos(uTime * 0.02));
    float m3 = circleMask(vUv, mPos3, 0.02, 0.002);
    float h3 = circleHalo(vUv, mPos3, 0.02, 0.05);
    
    vec3 moonColor = vec3(1.2, 1.2, 1.1); // Warm White
    
    color += moonColor * m1;
    color += moonColor * m2;
    color += moonColor * m3;
    color += accent * (h1 * 0.13 + h2 * 0.1 + h3 * 0.08);
    
    gl_FragColor = vec4(color, 1.0);
}
