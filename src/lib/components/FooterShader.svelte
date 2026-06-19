<script lang="ts">
  import { untrack } from 'svelte';
  import themeStore from '$lib/stores/theme.svelte';
  import type { Theme } from '$lib/stores/theme.svelte';
  import {
    getGalaxyColorPalette,
    customGalaxyColors,
    customNebulaColors,
  } from '$lib/components/three/galaxy.utils.svelte';

  let { active = false } = $props<{ active?: boolean }>();
  let canvas = $state<HTMLCanvasElement>();
  let hover = $state(0);
  let pointer = { x: 0.5, y: 0.5 };
  const trailLength = 16;
  const trail = Array.from({ length: trailLength }, () => ({ x: 0.5, y: 0.5 }));
  let colors = $state({
    galaxyInside: [0.04, 0.11, 0.58] as [number, number, number],
    galaxyOutside: [0.76, 0.77, 0.85] as [number, number, number],
    nebulaInside: [0.04, 0.11, 0.58] as [number, number, number],
    nebulaOutside: [0.76, 0.77, 0.85] as [number, number, number],
    base: [0.07, 0.07, 0.07] as [number, number, number],
    isLight: 0,
  });

  const vertexShaderSource = `
    attribute vec2 aPosition;

    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  const fragmentShaderSource = `
    precision mediump float;

    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec3 uTrail[16];
    uniform vec3 uGalaxyInside;
    uniform vec3 uGalaxyOutside;
    uniform vec3 uNebulaInside;
    uniform vec3 uNebulaOutside;
    uniform vec3 uBase;
    uniform float uIsLight;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);

      return mix(
        mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      mat2 m = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < 3; i++) {
        v += a * noise(p);
        p = m * p * 2.0;
        a *= 0.5;
      }
      return v;
    }

    float galaxyCell(vec2 uv, vec2 center, float seed, float scale, float t) {
      vec2 p = (uv - center) / scale;
      float rotation = seed * 0.58 + sin(t * 0.11 + seed) * 0.26;
      mat2 rotate = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation));
      p = rotate * p;
      p.x *= 0.72 + 0.42 * hash(vec2(seed, 1.3));
      p.y *= 0.82 + 0.28 * hash(vec2(seed, 2.7));

      float d = length(p);
      float angle = atan(p.y, p.x);
      float armCount = 2.0 + floor(hash(vec2(seed, 4.1)) * 3.0);
      float turbulence = noise(p * (5.2 + seed * 0.3) + vec2(seed, t * 0.16));
      float arms = sin(
        angle * armCount +
        d * (17.0 + hash(vec2(seed, 5.9)) * 14.0) -
        t * (1.1 + seed * 0.05) +
        turbulence * (1.8 + hash(vec2(seed, 7.2)) * 1.2) +
        seed
      );
      float armMask = smoothstep(0.2, 1.0, arms) * exp(-d * (1.58 + seed * 0.04));
      float core = exp(-d * (5.7 + hash(vec2(seed, 8.4)) * 3.8));
      float halo = exp(-d * (1.42 + hash(vec2(seed, 9.6)) * 0.78)) * 0.46;
      float dust = noise(vec2(angle * 2.1 + seed, d * 7.4 - t * 0.2)) * 0.18;

      return max(core, armMask + halo + dust * exp(-d * 2.3));
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
      float t = uTime * 0.6;
      float aspect = uResolution.x / uResolution.y;
      float pattern = 0.0;
      vec2 rippleUv = uv;
      float waterShift = 0.0;

      // We use the first 6 trail points to smoothly displace/push coordinates (stronger, wider push)
      for (int i = 0; i < 6; i++) {
        float fi = float(i);
        vec3 trailPoint = uTrail[i];
        vec2 trailUv = (trailPoint.xy - 0.5) * vec2(aspect, 1.0);
        vec2 trailVector = uv - trailUv;
        float rawDistance = length(trailVector);
        float distance = length(trailVector * vec2(1.0, 1.36));
        vec2 direction = trailVector / max(rawDistance, 0.001);
        float strength = trailPoint.z * (1.0 - fi * 0.12);

        // Smooth exponential push force that displaces coordinates outwards with wider radius
        float push = exp(-distance * (4.2 + fi * 0.35)) * strength;

        rippleUv += direction * push * 0.22;
        waterShift += push * 0.15;
      }

      // Calculate smoke distortion once per pixel for performance
      vec2 smokeQ = vec2(fbm(rippleUv * 2.5 + t * 0.1), fbm(rippleUv * 2.5 + vec2(5.2, 1.3) + t * 0.1));
      vec2 smokeR = vec2(fbm(rippleUv * 2.5 + smokeQ * 1.2 + t * 0.15), fbm(rippleUv * 2.5 + smokeQ * 1.2 + vec2(8.3, 2.8) + t * 0.15));
      float smoke = fbm(rippleUv * 2.5 + smokeR * 0.6);
      vec2 distortedUv = rippleUv + smokeR * 0.08;

      vec3 trailColorAcc = vec3(0.0);
      float trailAlphaAcc = 0.0;

      // Accumulate glowing smoke trail from 16 points
      for (int i = 0; i < 16; i++) {
        vec3 trailPoint = uTrail[i];
        float intensity = trailPoint.z;
        if (intensity > 0.01) {
          vec2 trailUv = (trailPoint.xy - 0.5) * vec2(aspect, 1.0);

          float radius = 0.28 * (1.0 - float(i) * 0.045);
          float dist = length(distortedUv - trailUv);

          // Core sharp smoke
          float coreFactor = 1.0 - smoothstep(0.0, radius, dist);
          float coreAlpha = pow(smoke, 1.8) * coreFactor;

          // Soft wide glow halo simulating UnrealBloom
          float glowFactor = exp(-dist * 12.0);

          float alpha = (coreAlpha * 0.55 + glowFactor * 0.45) * intensity;

          // Use pure/slightly boosted galaxy colors for a colorful, non-white core
          vec3 c1 = mix(uGalaxyInside, vec3(1.0), 0.04);
          vec3 c2 = mix(uGalaxyOutside, vec3(1.0), 0.07);
          vec3 col = mix(c1, c2, sin(t * 0.8 + float(i) * 0.3) * 0.5 + 0.5);

          trailColorAcc += col * alpha;
          trailAlphaAcc += alpha;
        }
      }

      for (int i = 0; i < 9; i++) {
        float fi = float(i);
        float seed = fi + 1.0;
        float spread = (fi + sin(fi * 2.17) * 0.24 + cos(fi * 0.91) * 0.16) / 8.0;
        float x = mix(-aspect * 0.62, aspect * 0.62, spread);
        float y = (hash(vec2(seed, 12.0)) - 0.5) * 0.52 + sin(fi * 1.71 + t * 0.28) * 0.06;
        float scale = 0.76 + hash(vec2(seed, 13.0)) * 0.68;
        float weight = 0.52 + hash(vec2(seed, 14.0)) * 0.78;
        vec2 center = vec2(x + sin(t * 0.18 + fi) * 0.07, y);
        pattern += galaxyCell(rippleUv, center, seed, scale, t) * weight;
      }

      float band = smoothstep(0.68, 0.0, abs(rippleUv.y + 0.02));
      float drift = noise(vec2(rippleUv.x * 0.42 - t * 0.04, rippleUv.y * 2.1 + t * 0.08));
      float strands = smoothstep(
        0.35,
        1.0,
        sin(rippleUv.x * (7.0 + drift * 4.0) + rippleUv.y * 3.2 - t * 0.8)
      );
      float scan = smoothstep(
        0.06,
        0.0,
        abs(fract((rippleUv.y + rippleUv.x * 0.025 + drift * 0.035) * 12.0 + t * 0.22) - 0.5)
      );
      float grain = noise(gl_FragCoord.xy * 0.8 + t);

      pattern = clamp(
        pattern * 0.36 +
        strands * band * 0.3 +
        scan * 0.1,
        0.0,
        1.0
      );

      vec3 lightBase = vec3(1.0);
      vec3 galaxyInside = mix(uGalaxyInside, mix(lightBase, uGalaxyInside, 0.24), uIsLight);
      vec3 galaxyOutside = mix(uGalaxyOutside, mix(lightBase, uGalaxyOutside, 0.42), uIsLight);

      // Override nebula colors to be bright pastel in light mode, avoiding muddy grey/black tones
      vec3 nebulaInside = uNebulaInside;
      vec3 nebulaOutside = uNebulaOutside;
      if (uIsLight > 0.5) {
        nebulaInside = mix(uGalaxyInside, lightBase, 0.5); // Soft blue pastel
        nebulaOutside = mix(uGalaxyOutside, lightBase, 0.6); // Soft orange/gold pastel
      } else {
        nebulaInside = mix(uNebulaInside, mix(lightBase, uNebulaInside, 0.18), uIsLight);
        nebulaOutside = mix(uNebulaOutside, mix(lightBase, uNebulaOutside, 0.08), uIsLight);
      }

      vec3 galaxy = mix(galaxyOutside, galaxyInside, clamp(pattern * 1.15, 0.0, 1.0));
      vec3 nebula = mix(nebulaOutside, nebulaInside, pattern);
      vec3 signal = mix(galaxy, nebula, mix(0.42 + 0.14 * sin(t), 0.26, uIsLight));
      signal = mix(signal, galaxyOutside, waterShift);
      signal += grain * (uIsLight > 0.5 ? 0.012 : 0.032);

      float strength = mix(1.0, 0.78, uIsLight); // Softened pattern strength to make footer less bright/contrasty

      // Dynamic cosmic base backgrounds that use the main core color (uGalaxyInside)
      vec3 finalBase = uBase;
      if (uIsLight > 0.5) {
        // Light mode: blend a soft pastel space-blue cream from uGalaxyInside to avoid flat white
        finalBase = mix(vec3(0.96, 0.96, 0.98), uGalaxyInside, 0.04);
      } else {
        // Dark mode: blend a rich deep space navy from uGalaxyInside to avoid flat black/grey
        finalBase = mix(vec3(0.015, 0.015, 0.025), uGalaxyInside, 0.08);
      }

      // Boost and tweak signal colors (softened multiplier on both themes to reduce brightness)
      vec3 boostedSignal = signal;
      if (uIsLight > 0.5) {
        boostedSignal = mix(signal, mix(uGalaxyOutside, uGalaxyInside, pattern), 0.4) * 1.12; // Less bright, softer pastel
      } else {
        boostedSignal = signal * 1.25; // Softer pop in dark mode (reduced from 1.6)
      }

      // Compute the background color with galaxy pattern
      float mixFactor = clamp(pattern * strength * 1.1, 0.0, 1.0); // Reduced multiplier to soften overall pattern
      vec3 finalColor = mix(finalBase, boostedSignal, mixFactor);

      // Add galaxy core glow in dark mode (reduced from 0.5 to 0.25 to make footer less bright)
      if (uIsLight < 0.5) {
        finalColor += boostedSignal * pow(pattern, 3.0) * 0.25;
      }

      // Blend the trailing smoke using mix/soft screen to avoid burning to white
      float trailAlpha = clamp(trailAlphaAcc, 0.0, 1.0);
      if (trailAlpha > 0.01) {
        vec3 avgTrailColor = trailColorAcc / max(trailAlphaAcc, 0.001);
        if (uIsLight > 0.5) {
          finalColor = mix(finalColor, avgTrailColor, trailAlpha * 0.28); // Softer hover blend in light mode (down from 0.35)
        } else {
          // Mix the trail color and add a very soft glow proportional to density
          finalColor = mix(finalColor, avgTrailColor, trailAlpha * 0.45); // Softer hover mix in dark mode (down from 0.55)
          finalColor += avgTrailColor * trailAlpha * 0.08; // Softer glow (down from 0.12)
        }
      }

      gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
    }
  `;

  function handlePointerMove(event: PointerEvent) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointer = {
      x: (event.clientX - rect.left) / rect.width,
      y: 1 - (event.clientY - rect.top) / rect.height,
    };
  }

  function handlePointerEnter(event: PointerEvent) {
    handlePointerMove(event);
    if (hover === 0) {
      for (const point of trail) {
        point.x = pointer.x;
        point.y = pointer.y;
      }
    }
    hover = 1;
  }

  function handlePointerLeave() {
    hover = 0;
  }

  function colorToTuple(
    color: { r: number; g: number; b: number } | undefined,
    fallback: [number, number, number],
  ) {
    if (!color) return fallback;
    return [color.r, color.g, color.b] as [number, number, number];
  }

  function getDocumentTheme(): Theme {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function updateColorsFromDocument() {
    const theme = (themeStore.theme ?? 'dark') as Theme;
    const palette = getGalaxyColorPalette(theme);
    const isLight = theme === 'light';

    colors = {
      galaxyInside: colorToTuple(palette.galaxyInsideColor, [0.04, 0.11, 0.58]),
      galaxyOutside: colorToTuple(palette.galaxyOutsideColor, [0.76, 0.77, 0.85]),
      nebulaInside: colorToTuple(palette.nebulaInsideColor, [0.04, 0.11, 0.58]),
      nebulaOutside: colorToTuple(palette.nebulaOutsideColor, [0.76, 0.77, 0.85]),
      base: isLight ? [1, 1, 1] : [0.07, 0.07, 0.07],
      isLight: isLight ? 1 : 0,
    };
  }

  function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return null;

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }

    return shader;
  }

  function createProgram(gl: WebGLRenderingContext) {
    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = gl.createProgram();

    if (!vertexShader || !fragmentShader || !program) return null;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }

  $effect(() => {
    if (!canvas || !active) return;

    const targetCanvas = canvas;
    const glContext = targetCanvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });

    if (!glContext) return;

    const gl = glContext;

    const program = createProgram(gl);
    if (!program) return;

    const buffer = gl.createBuffer();
    if (!buffer) {
      gl.deleteProgram(program);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, 'aPosition');
    const resolutionLocation = gl.getUniformLocation(program, 'uResolution');
    const timeLocation = gl.getUniformLocation(program, 'uTime');
    const trailLocation = gl.getUniformLocation(program, 'uTrail[0]');
    const galaxyInsideLocation = gl.getUniformLocation(program, 'uGalaxyInside');
    const galaxyOutsideLocation = gl.getUniformLocation(program, 'uGalaxyOutside');
    const nebulaInsideLocation = gl.getUniformLocation(program, 'uNebulaInside');
    const nebulaOutsideLocation = gl.getUniformLocation(program, 'uNebulaOutside');
    const baseLocation = gl.getUniformLocation(program, 'uBase');
    const isLightLocation = gl.getUniformLocation(program, 'uIsLight');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrame = 0;
    let start = performance.now();
    let trailIntensity = 0;
    const trailUniform = new Float32Array(trailLength * 3);

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(targetCanvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(targetCanvas.clientHeight * ratio));

      if (targetCanvas.width !== width || targetCanvas.height !== height) {
        targetCanvas.width = width;
        targetCanvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    }

    function updateTrail() {
      trailIntensity += (hover - trailIntensity) * (hover ? 0.2 : 0.08);

      trail[0].x += (pointer.x - trail[0].x) * 0.38;
      trail[0].y += (pointer.y - trail[0].y) * 0.38;

      for (let i = 1; i < trail.length; i++) {
        const follow = trail[i - 1];
        const point = trail[i];
        const speed = Math.max(0.06, 0.24 - i * 0.015);
        point.x += (follow.x - point.x) * speed;
        point.y += (follow.y - point.y) * speed;
      }

      for (let i = 0; i < trail.length; i++) {
        const offset = i * 3;
        trailUniform[offset] = trail[i].x;
        trailUniform[offset + 1] = trail[i].y;
        trailUniform[offset + 2] = trailIntensity * Math.pow(0.82, i);
      }
    }

    function render(now: number) {
      updateTrail();
      updateColorsFromDocument();
      resize();
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(resolutionLocation, targetCanvas.width, targetCanvas.height);
      gl.uniform1f(timeLocation, reducedMotion ? 0.8 : (now - start) / 1000);
      gl.uniform3fv(trailLocation, trailUniform);
      gl.uniform3fv(galaxyInsideLocation, colors.galaxyInside);
      gl.uniform3fv(galaxyOutsideLocation, colors.galaxyOutside);
      gl.uniform3fv(nebulaInsideLocation, colors.nebulaInside);
      gl.uniform3fv(nebulaOutsideLocation, colors.nebulaOutside);
      gl.uniform3fv(baseLocation, colors.base);
      gl.uniform1f(isLightLocation, colors.isLight);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!reducedMotion) {
        animationFrame = requestAnimationFrame(render);
      }
    }

    $effect(() => {
      themeStore.theme;
      customGalaxyColors.inside;
      customGalaxyColors.outside;
      customNebulaColors.inside;
      customNebulaColors.outside;

      untrack(() => {
        if (targetCanvas) {
          updateColorsFromDocument();
          gl.useProgram(program);
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
          gl.enableVertexAttribArray(positionLocation);
          gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

          gl.uniform2f(resolutionLocation, targetCanvas.width, targetCanvas.height);
          gl.uniform1f(timeLocation, (performance.now() - start) / 1000);
          gl.uniform3fv(trailLocation, trailUniform);
          gl.uniform3fv(galaxyInsideLocation, colors.galaxyInside);
          gl.uniform3fv(galaxyOutsideLocation, colors.galaxyOutside);
          gl.uniform3fv(nebulaInsideLocation, colors.nebulaInside);
          gl.uniform3fv(nebulaOutsideLocation, colors.nebulaOutside);
          gl.uniform3fv(baseLocation, colors.base);
          gl.uniform1f(isLightLocation, colors.isLight);

          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
      });
    });

    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(targetCanvas);

    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  });

  if (typeof document !== 'undefined') {
    updateColorsFromDocument();
  }
</script>

<canvas
  bind:this={canvas}
  class="h-full w-full bg-base-100"
  aria-hidden="true"
  onpointerenter={handlePointerEnter}
  onpointermove={handlePointerMove}
  onpointerleave={handlePointerLeave}
></canvas>
