<script lang="ts">
  import { untrack } from 'svelte';
  import themeStore from '$lib/stores/theme.svelte';

  type ColorTuple = [number, number, number];
  type FooterColors = {
    base: ColorTuple;
    dust: ColorTuple;
    cool: ColorTuple;
    mist: ColorTuple;
    warm: ColorTuple;
    hot: ColorTuple;
    isLight: number;
  };

  let { active = false } = $props<{ active?: boolean }>();
  let canvas = $state<HTMLCanvasElement>();
  let hover = 0;
  let pointer = { x: 0.5, y: 0.5 };
  let touchReleaseTimer: ReturnType<typeof setTimeout> | undefined;
  const trailLength = 16;
  const trail = Array.from({ length: trailLength }, () => ({ x: 0.5, y: 0.5 }));

  /** Brightness ramp first, then the two glyphs the cursor decodes cells into. */
  const GLYPHS = ' .:-=+*#%@01';
  const RAMP = 10;
  /** One character cell, in CSS pixels. */
  const CELL = { width: 6, height: 11 };

  let colors: FooterColors = {
    base: [0.07, 0.07, 0.07],
    dust: [0.82, 0.82, 0.82],
    cool: [0.62, 0.84, 1],
    mist: [0.84, 0.58, 0.98],
    warm: [0.8, 0.47, 0.2],
    hot: [1, 0.78, 0.43],
    isLight: 0,
  };

  const vertexShaderSource = `
    attribute vec2 aPosition;

    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  // The page ends the way a source file would: in monospace. A ringed gas
  // giant turns over a drifting nebula, all drawn with characters coloured
  // like the site's syntax highlighting. Every pixel finds its character
  // cell, evaluates the scene once at the cell's centre and copies the
  // matching glyph out of a pixel-exact atlas.
  const fragmentShaderSource = `
    precision mediump float;

    uniform vec2 uResolution;
    uniform float uTime;
    uniform vec3 uTrail[16];
    uniform vec2 uCell;
    uniform sampler2D uAtlas;
    uniform vec3 uBase;
    uniform vec3 uDust;
    uniform vec3 uCool;
    uniform vec3 uMist;
    uniform vec3 uWarm;
    uniform vec3 uHot;
    uniform float uIsLight;

    const float GLYPHS = ${GLYPHS.length.toFixed(1)};
    const float RAMP = ${RAMP.toFixed(1)};

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

    void main() {
      vec2 cell = floor(gl_FragCoord.xy / uCell);
      vec2 centre = (cell + 0.5) * uCell;
      vec2 uv = (centre - 0.5 * uResolution.xy) / uResolution.y;
      float t = uTime;
      float aspect = uResolution.x / uResolution.y;

      // The cursor pushes the scene aside and lights up the cells it crosses.
      vec2 p = uv;
      float touch = 0.0;
      for (int i = 0; i < 8; i++) {
        vec3 trailPoint = uTrail[i];
        vec2 trailUv = (trailPoint.xy - 0.5) * vec2(aspect, 1.0);
        vec2 trailVector = uv - trailUv;
        float distance = length(trailVector * vec2(1.0, 1.3));
        float push = exp(-distance * (5.0 + float(i) * 0.4)) * trailPoint.z;
        p += trailVector / max(length(trailVector), 0.001) * push * 0.16;
        touch = max(touch, exp(-distance * 9.0) * trailPoint.z * (1.0 - float(i) * 0.09));
      }

      // Nebula: two octaves drifting sideways, kept sparse and dim.
      vec2 q = p * vec2(1.6, 3.2) + vec2(t * 0.035, 0.0);
      float cloud = noise(q) * 0.65 + noise(q * 2.3 + vec2(3.1, t * 0.05)) * 0.35;
      float level = smoothstep(0.46, 0.95, cloud) * 0.46;
      vec3 color = mix(uMist, uCool, noise(q * 0.5 + 7.0));

      // Still stars twinkle in the gaps.
      float star = hash(cell * 0.731 + 17.0);
      if (star > 0.972) {
        float twinkle = 0.12 + 0.1 * sin(t * (1.1 + star * 2.6) + star * 40.0);
        if (twinkle > level) {
          level = twinkle;
          color = uDust;
        }
      }

      // The planet: a banded gas giant with a ring, lit from the upper left.
      // Wide footers keep it to the right of the links; narrow ones let it
      // peek in from the bottom-right corner.
      float wide = step(3.0, aspect);
      float radius = mix(0.22, 0.36, wide);
      vec2 planet = mix(
        vec2(aspect * 0.5 - radius * 0.45, -0.5 + radius * 0.55),
        vec2(aspect * 0.5 - radius * 3.1, -0.03),
        wide
      );
      vec2 s = (p - planet) / radius;
      // Ring plane, tilted towards the viewer and turned a little on screen.
      float roll = -0.32;
      s = mat2(cos(roll), sin(roll), -sin(roll), cos(roll)) * s;
      float tilt = 0.32;
      float ringZ = -s.y * cos(tilt) / sin(tilt);
      float ringR = length(vec3(s, ringZ));
      float sphere = 1.0 - dot(s, s);
      float sphereZ = sphere > 0.0 ? sqrt(sphere) : -1.0;
      vec3 light = normalize(vec3(-0.62, 0.48, 0.62));

      if (sphere > 0.0) {
        vec3 n = vec3(s, sphereZ);
        // Undo the screen roll so the bands run along the ring plane.
        float lat = n.y * cos(tilt) - n.z * sin(tilt);
        float lon = atan(n.x, n.z) + t * 0.12;
        float bands = sin(lat * 13.0 + noise(vec2(lon * 2.0, lat * 6.0)) * 2.4);
        float diffuse = max(dot(n, light), 0.0);
        float shade = diffuse * (0.78 + 0.22 * bands) + pow(1.0 - sphereZ, 3.0) * 0.12;
        // The night side keeps a faint fill, so the disc still reads as round.
        level = 0.22 + 0.78 * clamp(shade, 0.0, 1.0);
        vec3 lit = mix(uWarm, uHot, smoothstep(-0.3, 0.8, bands) * diffuse);
        color = mix(mix(uMist, uWarm, 0.45), lit, smoothstep(0.0, 0.35, diffuse));
      }

      // The ring shows wherever it is in front of the planet (or clear of it).
      bool ringVisible = ringR > 1.32 && ringR < 2.25 && (sphere <= 0.0 || ringZ > sphereZ);
      if (ringVisible) {
        // One wide gap (a Cassini division) and gentle banding.
        float gaps = (0.75 + 0.25 * sin(ringR * 17.0)) * (1.0 - 0.8 * smoothstep(0.07, 0.0, abs(ringR - 1.78)));
        // The planet's shadow falls across the far side of the ring.
        float shadowed = (ringZ < 0.0 && abs(s.x) < 1.0) ? 0.35 : 1.0;
        float ring = clamp(gaps * shadowed * (1.0 - smoothstep(2.0, 2.25, ringR)), 0.0, 1.0);
        level = max(level * 0.4, 0.22 + 0.32 * ring);
        color = mix(uCool, uDust, 0.35 + 0.4 * ring);
      }

      float glyph = floor(clamp(level, 0.0, 0.999) * RAMP);
      // Under the cursor the scene decodes into flickering binary.
      float flicker = hash(cell + floor(t * 14.0));
      if (touch > 0.2 && flicker < touch) {
        glyph = RAMP + step(0.5, hash(cell * 1.37 + floor(t * 9.0)));
        color = mix(color, uHot, 0.7);
      }

      // The atlas holds one glyph per cell, pixel for pixel (no filtering).
      vec2 local = floor(mod(gl_FragCoord.xy, uCell));
      vec2 atlasUv = vec2(
        (glyph * uCell.x + local.x + 0.5) / (GLYPHS * uCell.x),
        (uCell.y - 1.0 - local.y + 0.5) / uCell.y
      );
      float ink = texture2D(uAtlas, atlasUv).a;

      float strength = 0.45 + 0.55 * smoothstep(0.05, 0.6, level) + touch * 0.35;
      vec3 base = mix(uBase, uCool, mix(0.03, 0.012, uIsLight));
      vec3 finalColor = mix(base, color, clamp(ink * strength, 0.0, 1.0));

      gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
    }
  `;

  function updatePointerFromEvent(event: PointerEvent) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    pointer = {
      x: (event.clientX - rect.left) / rect.width,
      y: 1 - (event.clientY - rect.top) / rect.height,
    };
  }

  function resetTrailToPointer() {
    for (const point of trail) {
      point.x = pointer.x;
      point.y = pointer.y;
    }
  }

  function clearTouchReleaseTimer() {
    if (!touchReleaseTimer) return;
    clearTimeout(touchReleaseTimer);
    touchReleaseTimer = undefined;
  }

  function releaseTouchHover(delay = 120) {
    clearTouchReleaseTimer();
    touchReleaseTimer = setTimeout(() => {
      hover = 0;
      touchReleaseTimer = undefined;
    }, delay);
  }

  function handlePointerMove(event: PointerEvent) {
    updatePointerFromEvent(event);
  }

  function handlePointerEnter(event: PointerEvent) {
    if (event.pointerType === 'touch') return;

    updatePointerFromEvent(event);
    if (hover === 0) {
      resetTrailToPointer();
    }
    hover = 1;
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType !== 'touch') return;

    updatePointerFromEvent(event);
    resetTrailToPointer();
    hover = 1;
    releaseTouchHover(220);
  }

  function handlePointerUp(event: PointerEvent) {
    if (event.pointerType !== 'touch') return;

    updatePointerFromEvent(event);
    releaseTouchHover();
  }

  function handlePointerLeave(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      releaseTouchHover();
      return;
    }

    clearTouchReleaseTimer();
    hover = 0;
  }

  /** Any CSS colour (custom properties included) as linear-ish 0–1 RGB. */
  function cssColor(probe: CanvasRenderingContext2D, value: string, fallback: ColorTuple) {
    if (!value) return fallback;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = '#000';
    probe.fillStyle = value;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
    return [r / 255, g / 255, b / 255] as ColorTuple;
  }

  function updateColorsFromDocument() {
    const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!probe) return;
    const style = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: ColorTuple) =>
      cssColor(probe, style.getPropertyValue(name).trim(), fallback);

    colors = {
      base: read('--color-base-100', colors.base),
      dust: read('--color-identifier', colors.dust),
      cool: read('--color-number', colors.cool),
      mist: read('--color-constant', colors.mist),
      warm: read('--color-keyword', colors.warm),
      hot: read('--color-declaration', colors.hot),
      isLight: themeStore.theme === 'light' ? 1 : 0,
    };
  }

  /** Draw the glyphs, one cell each, at exactly the cell size the shader samples. */
  function drawAtlas(width: number, height: number) {
    const atlas = document.createElement('canvas');
    atlas.width = width * GLYPHS.length;
    atlas.height = height;
    const context = atlas.getContext('2d');
    if (!context) return atlas;
    const family = getComputedStyle(document.body).fontFamily || 'monospace';
    context.font = `${Math.round(height * 0.84)}px ${family}`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#fff';
    [...GLYPHS].forEach((glyph, i) => context.fillText(glyph, (i + 0.5) * width, height * 0.54));
    return atlas;
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
    const texture = gl.createTexture();
    if (!buffer || !texture) {
      if (buffer) gl.deleteBuffer(buffer);
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
    const cellLocation = gl.getUniformLocation(program, 'uCell');
    const atlasLocation = gl.getUniformLocation(program, 'uAtlas');
    const colorLocations = {
      base: gl.getUniformLocation(program, 'uBase'),
      dust: gl.getUniformLocation(program, 'uDust'),
      cool: gl.getUniformLocation(program, 'uCool'),
      mist: gl.getUniformLocation(program, 'uMist'),
      warm: gl.getUniformLocation(program, 'uWarm'),
      hot: gl.getUniformLocation(program, 'uHot'),
    };
    const isLightLocation = gl.getUniformLocation(program, 'uIsLight');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrame: number | undefined;
    let isVisible = true;
    let start = performance.now();
    let trailIntensity = 0;
    const trailUniform = new Float32Array(trailLength * 3);
    // Character cell in device pixels: whole pixels, so glyphs stay crisp.
    let cell = { width: CELL.width, height: CELL.height };
    let atlasReady = false;

    function uploadAtlas() {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        drawAtlas(cell.width, cell.height),
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(targetCanvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(targetCanvas.clientHeight * ratio));

      if (targetCanvas.width !== width || targetCanvas.height !== height) {
        targetCanvas.width = width;
        targetCanvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      const next = {
        width: Math.max(4, Math.round(CELL.width * ratio)),
        height: Math.max(7, Math.round(CELL.height * ratio)),
      };
      if (next.width !== cell.width || next.height !== cell.height || !atlasReady) {
        cell = next;
        uploadAtlas();
        atlasReady = true;
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

    function draw(now: number) {
      updateTrail();
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.uniform2f(resolutionLocation, targetCanvas.width, targetCanvas.height);
      gl.uniform1f(timeLocation, reducedMotion ? 0.8 : (now - start) / 1000);
      gl.uniform3fv(trailLocation, trailUniform);
      gl.uniform2f(cellLocation, cell.width, cell.height);
      gl.uniform1i(atlasLocation, 0);
      gl.uniform3fv(colorLocations.base, colors.base);
      gl.uniform3fv(colorLocations.dust, colors.dust);
      gl.uniform3fv(colorLocations.cool, colors.cool);
      gl.uniform3fv(colorLocations.mist, colors.mist);
      gl.uniform3fv(colorLocations.warm, colors.warm);
      gl.uniform3fv(colorLocations.hot, colors.hot);
      gl.uniform1f(isLightLocation, colors.isLight);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    function render(now: number) {
      draw(now);
      animationFrame = undefined;

      if (!reducedMotion && isVisible) {
        animationFrame = requestAnimationFrame(render);
      }
    }

    function requestRender() {
      if (animationFrame !== undefined) return;
      animationFrame = requestAnimationFrame(render);
    }

    $effect(() => {
      void themeStore.theme;

      untrack(() => {
        if (targetCanvas) {
          updateColorsFromDocument();
          draw(performance.now());
        }
      });
    });

    updateColorsFromDocument();
    resize();
    draw(performance.now());

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(performance.now());
    });
    resizeObserver.observe(targetCanvas);

    const visibilityObserver =
      'IntersectionObserver' in window
        ? new IntersectionObserver(
            ([entry]) => {
              isVisible = entry?.isIntersecting ?? true;
              if (isVisible) requestRender();
            },
            { threshold: 0 },
          )
        : undefined;

    visibilityObserver?.observe(targetCanvas);
    requestRender();

    return () => {
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      clearTouchReleaseTimer();
      resizeObserver.disconnect();
      visibilityObserver?.disconnect();
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  });
</script>

<canvas
  bind:this={canvas}
  class="h-full w-full bg-base-100"
  aria-hidden="true"
  onpointerenter={handlePointerEnter}
  onpointermove={handlePointerMove}
  onpointerdown={handlePointerDown}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerUp}
  onpointerleave={handlePointerLeave}
></canvas>
