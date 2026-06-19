varying vec2 vUv;
varying float vElevation;
varying vec3 vPosition;
varying float vBiomeMix;
varying float vBiomeIndex;

uniform float uTime;
uniform float uElevationScale;
uniform float uNoiseScale;
uniform vec2 uOffset;
uniform vec2 uNoiseOffset;
uniform float uBiomeOverride;

// Simplex 2D noise
vec3 permute(vec3 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
            -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

// Re-implement hash2 using permutation (Stable, no Sine)
vec2 hash2(vec2 p) {
    p = mod(p, 289.0);
    float t = p.x + 31.32 * p.y;
    // Pseudo-random via permutation
    // This is a cheap approximation of a stable hash
    float idx = mod(t, 289.0);
    // Return something in 0..1
    // Using fract(idx / 41.0) is a simple PRNG
    return fract(vec2(idx, idx + 42.0) / 41.0);
}

// Cellular Noise (Voronoi) - Precision-safe version
vec2 cellular(vec2 P) {
    #define K 0.142857142857
    #define K2 0.0714285714286
    #define jitter 0.8
    vec2 Pi = floor(P);
    vec2 Pf = fract(P);
    vec2 P2 = Pf * Pf;
    float d = 1.0;

    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            vec2 tp = vec2(x, y);
            vec2 o = hash2(Pi + tp);
            vec2 r = tp + o * jitter - Pf;
            float dist = dot(r, r);
            if (dist < d) d = dist;
        }
    }
    return vec2(sqrt(d));
}

float smoothAbs(float x, float k) {
    return sqrt(x * x + k);
}

float softenFloor(float h, float floorHeight, float softness) {
    float t = smoothstep(floorHeight - softness, floorHeight + softness, h);
    return mix(floorHeight, h, t);
}

// --- TOPOGRAPHY GENERATORS ---

// 1. Ice: Sharp Ridges
float getIceHeight(vec2 p) {
    float base = snoise(p * 0.08) * 0.6;
    float ridges = 1.0 - smoothAbs(snoise(p * 0.45), 0.02);
    ridges = pow(ridges, 2.2) * 1.8;
    float detail = 1.0 - smoothAbs(snoise(p * 1.2), 0.02);
    detail = pow(detail, 3.0) * 0.5;
    float h = base + ridges + detail;
    return h * uElevationScale * 2.2;
}

// 2. Volcano: Organic Ridged
float volcanoBase(vec2 p) {
    float macro = snoise(p * 0.05);
    float ridged = 1.0 - smoothAbs(snoise(p * 0.45), 0.02);
    ridged = pow(ridged, 2.2);
    float detail = smoothAbs(snoise(p * 1.1), 0.02) * 0.16;
    float vents = 1.0 - smoothstep(0.18, 0.45, cellular(p * 1.0).x);
    vents = pow(vents, 3.0) * 1.2;
    float caldera = snoise(p * 0.12) * 0.5 + 0.5;
    float rocky = smoothAbs(snoise(p * 2.2), 0.02);
    rocky = pow(rocky, 1.6) * 0.4;
    float h = ridged + detail + vents + rocky - caldera * 0.45;
    float multiplier = 3.3 + macro * 1.4;
    return h * uElevationScale * multiplier;
}

float getVolcanoHeight(vec2 p) {
    vec2 blur = vec2(0.025, 0.0);
    float h = volcanoBase(p);
    float hx1 = volcanoBase(p + blur);
    float hx2 = volcanoBase(p - blur);
    float hy1 = volcanoBase(p + blur.yx);
    float hy2 = volcanoBase(p - blur.yx);
    return h * 0.4 + (hx1 + hx2 + hy1 + hy2) * 0.15;
}

// 3. Forest: Voronoi Crystal Pillars + Lakes
float forestBase(vec2 p) {
    float h = snoise(p * 0.35) * 0.45;
    vec2 c = cellular(p * 2.7);
    float core = clamp(1.0 - c.x * 2.2, 0.0, 1.0);
    float canopy = pow(core, 2.3) * 3.0;
    float trunk = pow(clamp(1.0 - c.x * 4.2, 0.0, 1.0), 5.0) * 1.3;
    float variation = 0.75 + 0.25 * (snoise(p * 0.5) * 0.5 + 0.5);
    float trees = (canopy + trunk) * variation;
    float elevation = (h + trees) * uElevationScale * 0.85;
    return softenFloor(elevation, -0.4, 0.12);
}

float getForestHeight(vec2 p) {
    vec2 blur = vec2(0.028, 0.0);
    float h = forestBase(p);
    float hx1 = forestBase(p + blur);
    float hx2 = forestBase(p - blur);
    float hy1 = forestBase(p + blur.yx);
    float hy2 = forestBase(p - blur.yx);
    return h * 0.4 + (hx1 + hx2 + hy1 + hy2) * 0.15;
}

// 4. Desert: Rolling Dunes
float desertBase(vec2 p) {
    float macro = snoise(p * 0.05);
    float dunesA = sin(p.x * 0.22 + p.y * 0.38) * 1.5;
    float dunesB = sin(p.x * 0.14 - p.y * 0.28 + 1.7) * 0.9;
    float ripples = smoothAbs(snoise(p * 1.4), 0.02) * 0.4;
    float h = dunesA + dunesB + ripples;
    h *= (1.0 + macro * 0.35);
    float mesas = 1.0 - smoothstep(0.25, 0.55, cellular(p * 0.7).x);
    h += pow(mesas, 2.0) * 0.6;
    return h * uElevationScale;
}

float getDesertHeight(vec2 p) {
    vec2 blur = vec2(0.022, 0.0);
    float h = desertBase(p);
    float hx1 = desertBase(p + blur);
    float hx2 = desertBase(p - blur);
    float hy1 = desertBase(p + blur.yx);
    float hy2 = desertBase(p - blur.yx);
    return h * 0.4 + (hx1 + hx2 + hy1 + hy2) * 0.15;
}

float getElevation(float biome, vec2 p) {
    float elevation = getDesertHeight(p);
    if (biome < 0.5) {
        elevation = getIceHeight(p);
    } else if (biome < 1.5) {
        elevation = getVolcanoHeight(p);
    } else if (biome < 2.5) {
        elevation = getForestHeight(p);
    }
    return elevation;
}

void main() {
    vUv = uv;
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    float biomeProgress = -uOffset.y * 0.005;

    float biomeLocal = fract(biomeProgress);
    float biomeIndexFloat = mod(floor(biomeProgress), 4.0);

    if (uBiomeOverride > -0.5) {
        biomeIndexFloat = uBiomeOverride;
        biomeLocal = 0.0;
    }

    vBiomeIndex = biomeIndexFloat;
    vBiomeMix = smoothstep(0.8, 1.0, biomeLocal);

    // --- NOISE COORDINATE ---
    // modelPosition.xz = world position of vertex (mesh at origin, so same as local)
    // uNoiseOffset = fractional offset (0 to 1000, always small)
    // Total is at most ~1060 - good float32 precision
    float noiseScale = uNoiseScale * 0.02;
    vec2 noiseCoord = modelPosition.xz * noiseScale + uNoiseOffset * noiseScale;

    float currentBiome = floor(biomeIndexFloat + 0.5);
    float nextBiome = mod(currentBiome + 1.0, 4.0);

    float h1 = getElevation(currentBiome, noiseCoord);
    float h2 = getElevation(nextBiome, noiseCoord);

    float elevation = mix(h1, h2, vBiomeMix);

    elevation = max(elevation, -2.0);

    modelPosition.y += elevation;

    vec4 viewPosition = viewMatrix * modelPosition;
    gl_Position = projectionMatrix * viewPosition;

    vElevation = elevation;
    vPosition = modelPosition.xyz;
}
