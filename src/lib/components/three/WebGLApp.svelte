<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { mat4 } from 'gl-matrix';

  import galaxyVertexShader from './webGLVertexShader.glsl';
  import galaxyFragmentShader from './webGLFragmentShader.glsl';
  import { parameters, colors, positions, randomness, scales } from './galaxy.utils.js';

  let canvas: HTMLCanvasElement;
  let gl: WebGL2RenderingContext;
  let animationActive = true;
  let then = 0;

  let cameraAngleX = 0; // Angle around the X-axis
  let cameraAngleY = 0.45; // Angle around the Y-axis
  let lastMouseX = 0;
  let lastMouseY = 0;

  let isDragging = false;
  let programInfo: {
    program: WebGLProgram;
    attribLocations: {
      position: number;
      color: number;
      scale: number;
      randomness: number;
    };
    uniformLocations: {
      time: WebGLUniformLocation | null;
      size: WebGLUniformLocation | null;
      modelViewProjection: WebGLUniformLocation | null;
    };
  };

  // const parameters = {
  //   count: 10000,
  //   particleSize: 15,
  //   radius: 5,
  //   branches: 3,
  //   spin: 1,
  //   randomnessPower: 3,
  //   insideColor: '#ff6030',
  //   outsideColor: '#1b3984',
  // };

  // let positions: Float32Array;
  // let colors: Float32Array;
  // let scales: Float32Array;
  // let randomness: Float32Array;

  let buffers: {
    position: WebGLBuffer | null;
    color: WebGLBuffer | null;
    scale: WebGLBuffer | null;
    randomness: WebGLBuffer | null;
  };

  // -- Helper Functions --
  function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(
    gl: WebGL2RenderingContext,
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader,
  ) {
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
      return null;
    }
    return program;
  }

  // function generateGalaxy() {
  //   positions = new Float32Array(parameters.count * 3);
  //   colors = new Float32Array(parameters.count * 3);
  //   scales = new Float32Array(parameters.count);
  //   randomness = new Float32Array(parameters.count * 3);
  //
  //   const insideColor = hexToRgb(parameters.insideColor);
  //   const outsideColor = hexToRgb(parameters.outsideColor);
  //
  //   for (let i = 0; i < parameters.count; i++) {
  //     const i3 = i * 3;
  //
  //     // Position
  //     const radius = Math.random() * parameters.radius;
  //     const branchAngle = ((i % parameters.branches) / parameters.branches) * 2 * Math.PI;
  //     const spinAngle = radius * parameters.spin;
  //
  //     const randomX =
  //       Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);
  //     const randomY =
  //       Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);
  //     const randomZ =
  //       Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : -1);
  //
  //     positions[i3] = Math.cos(branchAngle + spinAngle) * radius;
  //     positions[i3 + 1] = 0;
  //     positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius;
  //
  //     // Randomness
  //     randomness[i3] = randomX;
  //     randomness[i3 + 1] = randomY;
  //     randomness[i3 + 2] = randomZ;
  //
  //     // Color
  //     const mixedColor = {
  //       r: insideColor.r + (outsideColor.r - insideColor.r) * (radius / parameters.radius),
  //       g: insideColor.g + (outsideColor.g - insideColor.g) * (radius / parameters.radius),
  //       b: insideColor.b + (outsideColor.b - insideColor.b) * (radius / parameters.radius),
  //     };
  //
  //     colors[i3] = mixedColor.r;
  //     colors[i3 + 1] = mixedColor.g;
  //     colors[i3 + 2] = mixedColor.b;
  //
  //     // Scale
  //     scales[i] = Math.random();
  //   }
  // }

  function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16) / 255,
          g: parseInt(result[2], 16) / 255,
          b: parseInt(result[3], 16) / 255,
        }
      : { r: 0, g: 0, b: 0 };
  }

  function initBuffers(gl: WebGL2RenderingContext) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

    const scaleBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, scaleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, scales, gl.STATIC_DRAW);

    const randomnessBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, randomnessBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, randomness, gl.STATIC_DRAW);

    return {
      position: positionBuffer,
      color: colorBuffer,
      scale: scaleBuffer,
      randomness: randomnessBuffer,
    };
  }

  function enableAttribute(
    gl: WebGL2RenderingContext,
    buffer: WebGLBuffer | null,
    location: number,
    numComponents: number,
  ) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(location, numComponents, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(location);
  }

  function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }
  }

  function updateCamera() {
    const cameraDistance = parameters.radius / 2;

    // Calculate the camera position using spherical coordinates
    const cameraX = Math.sin(cameraAngleX) * Math.cos(cameraAngleY) * cameraDistance;
    const cameraY = Math.sin(cameraAngleY) * cameraDistance;
    const cameraZ = Math.cos(cameraAngleX) * Math.cos(cameraAngleY) * cameraDistance;

    const viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, [cameraX, cameraY, cameraZ], [0, 0, 0], [0, 1, 0]);

    const projectionMatrix = mat4.create();
    mat4.perspective(projectionMatrix, 20, gl.canvas.width / gl.canvas.height, 0.1, 100);

    const modelViewProjectionMatrix = mat4.create();
    mat4.multiply(modelViewProjectionMatrix, projectionMatrix, viewMatrix);

    gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelViewProjection,
      false,
      modelViewProjectionMatrix,
    );
  }

  function render(now: number) {
    now *= 0.001; // convert to seconds
    const deltaTime = now - then;
    then = now;

    resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.clearColor(0.07, 0.07, 0.07, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(programInfo.program);

    // Enable blending for transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Set uniforms
    gl.uniform1f(programInfo.uniformLocations.time, now);
    gl.uniform1f(
      programInfo.uniformLocations.size,
      parameters.particleSize * Math.min(window.devicePixelRatio, 2),
    );

    updateCamera();

    // Bind attributes
    enableAttribute(gl, buffers.position, programInfo.attribLocations.position, 3);
    enableAttribute(gl, buffers.color, programInfo.attribLocations.color, 3);
    enableAttribute(gl, buffers.scale, programInfo.attribLocations.scale, 1);
    enableAttribute(gl, buffers.randomness, programInfo.attribLocations.randomness, 3);

    // Draw
    gl.drawArrays(gl.POINTS, 0, parameters.count);

    if (animationActive) {
      requestAnimationFrame(render);
    }
  }

  onMount(() => {
    gl = canvas.getContext('webgl2')!;

    if (!gl) {
      alert('Unable to initialize WebGL. Your browser or machine may not support it.');
      return;
    }

    // -- Initialize Shaders --
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, galaxyVertexShader)!;
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, galaxyFragmentShader)!;
    const shaderProgram = createProgram(gl, vertexShader, fragmentShader)!;

    // -- Get Attribute and Uniform Locations --
    programInfo = {
      program: shaderProgram,
      attribLocations: {
        position: gl.getAttribLocation(shaderProgram, 'a_position'),
        color: gl.getAttribLocation(shaderProgram, 'a_color'),
        scale: gl.getAttribLocation(shaderProgram, 'a_scale'),
        randomness: gl.getAttribLocation(shaderProgram, 'a_randomness'),
      },
      uniformLocations: {
        time: gl.getUniformLocation(shaderProgram, 'u_time'),
        size: gl.getUniformLocation(shaderProgram, 'u_size'),
        modelViewProjection: gl.getUniformLocation(shaderProgram, 'u_modelViewProjection'),
      },
    };

    // generateGalaxy();
    buffers = initBuffers(gl);

    canvas.addEventListener('mousedown', (event) => {
      isDragging = true;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
    });

    canvas.addEventListener('mousemove', (event) => {
      if (isDragging) {
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;

        cameraAngleX += deltaX * 0.01;
        cameraAngleY += deltaY * 0.01;

        // Clamp cameraAngleY to prevent flipping over
        cameraAngleY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraAngleY));

        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
      }
    });

    canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
      isDragging = false;
    });

    canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      isDragging = true;
      lastMouseX = event.touches[0].clientX;
      lastMouseY = event.touches[0].clientY;
    });

    canvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      if (isDragging) {
        const deltaX = event.touches[0].clientX - lastMouseX;
        const deltaY = event.touches[0].clientY - lastMouseY;

        cameraAngleX += deltaX * 0.01;
        cameraAngleY += deltaY * 0.01;

        // Clamp cameraAngleY
        cameraAngleY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraAngleY));

        lastMouseX = event.touches[0].clientX;
        lastMouseY = event.touches[0].clientY;
      }
    });

    canvas.addEventListener('touchend', () => {
      isDragging = false;
    });

    then = performance.now() * 0.001;
    requestAnimationFrame(render);

    return () => {
      animationActive = false;
      // Clean up resources if needed
    };
  });

  onDestroy(() => {
    animationActive = false;
    // Clean up resources
  });
</script>

<canvas bind:this={canvas} />

<style>
  canvas {
    width: 100%;
    height: 540px;
  }
</style>
