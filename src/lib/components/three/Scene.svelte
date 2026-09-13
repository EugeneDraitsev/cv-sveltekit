<script lang="ts">
  import {
    ShaderMaterial,
    BufferGeometry,
    BufferAttribute,
    AdditiveBlending,
    MultiplyBlending,
    NormalBlending,
    Color,
    Vector3,
    Mesh,
    PlaneGeometry,
  } from 'three';
  import type { PerspectiveCamera } from 'three';
  import type { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { onDestroy, untrack } from 'svelte';
  import { flightMemory } from './flightMemory';
  import { sceneWarmup } from './sceneWarmup.svelte';
  import { getSceneQuality } from './quality';
  import { T, useTask, useThrelte } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';

  import themeStore from '$lib/stores/theme.svelte';
  import vertexShader from './galaxyVertexShader.glsl';
  import fragmentShader from './galaxyFragmentShader.glsl';
  import coronaVertexShader from './coronaVertexShader.glsl';
  import coronaFragmentShader from './coronaFragmentShader.glsl';
  import {
    colors,
    parameters,
    positions,
    randomness,
    scales,
    isNebula,
    syncGalaxyColor,
  } from '$lib/components/three/galaxy.utils.svelte';
  import {
    selectSystemIndices,
    getSystemWorldPosition,
    findHoveredSystem,
  } from '$lib/components/three/systems.utils.svelte';
  import { getStarSystem } from '$lib/components/three/starSystem';
  import { showHud, hideHud, setHudScreenPosition } from '$lib/components/three/hud.svelte';
  import {
    createCameraFlight,
    type CameraFlight,
    prefersReducedMotion,
    smoothstepJs,
  } from '$lib/components/three/cameraTween';

  const { renderer, dpr, scene } = useThrelte();
  let sceneCamera = $state<import('three').PerspectiveCamera>();
  const warmup = sceneWarmup(renderer, scene, () => sceneCamera);
  let cameraFlight: CameraFlight | undefined;

  // Local OrbitControls instance via bind:ref — the shared useOrbitControls()
  // registry gets wiped when scenes swap (the outgoing scene's unregister can
  // run after the incoming one's register), so it can't be trusted here.
  let controls = $state<ThreeOrbitControls>();

  const {
    animationActive = false,
    worldActive = false,
    cameraFov = 20,
    cameraPosition = [-20, 24, 20] as [x: number, y: number, z: number],
    cameraDistance = 30,
    particleSize = parameters.particleSize as number,
    nebulaIntensity = parameters.nebulaIntensity,
    regenVersion = 0,
    /** When set, the camera dives toward this system (warp-out phase). */
    warpTargetIndex = null as number | null,
    /** When set, the camera arrives back FROM this system (reverse dive). */
    returnFromIndex = null as number | null,
    /** Motion-locked transition veil: (opacity, colorHex) driven per frame. */
    onDeparted = undefined as (() => void) | undefined,
    onArrived = undefined as (() => void) | undefined,
    onVeil = undefined as ((opacity: number, colorHex: number) => void) | undefined,
    onSelectSystem = undefined as ((index: number) => void) | undefined,
  } = $props();
  const quality = getSceneQuality();
  const pixelRatio = Math.min(window.devicePixelRatio, quality.maxDpr);

  // we have not to use $state here, because we don't need to re-create the material on every change
  let time = flightMemory.galaxy?.time ?? 0;

  const geometry = $state(new BufferGeometry());

  const material = $derived.by(() => {
    return new ShaderMaterial({
      depthWrite: false,
      transparent: true,
      premultipliedAlpha: themeStore.theme !== 'dark',
      blending: themeStore.theme === 'dark' ? AdditiveBlending : MultiplyBlending,
      vertexColors: true,
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: time },
        uSize: { value: particleSize * pixelRatio },
        uNebulaIntensity: { value: nebulaIntensity },
      },
    });
  });

  $effect(() => {
    void regenVersion;
    syncGalaxyColor();

    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setAttribute('aScale', new BufferAttribute(scales, 1));
    geometry.setAttribute('aRandomness', new BufferAttribute(randomness, 3));
    geometry.setAttribute('aIsNebula', new BufferAttribute(isNebula, 1));

    renderer.setClearColor(themeStore.theme === 'dark' ? 0x121212 : 0xffffff, 1.0);
  });

  $effect(() => {
    if (animationActive && warmup.ready) {
      start();
    } else {
      stop();
    }
  });

  function blackOut() {
    renderer.setAnimationLoop(null);
  }

  $effect(() => {
    window.addEventListener('pagehide', blackOut, { once: true });
    window.addEventListener('beforeunload', blackOut, { once: true });
    return () => {
      window.removeEventListener('pagehide', blackOut);
      window.removeEventListener('beforeunload', blackOut);
    };
  });

  // ─── Planetary-system selection ────────────────────────────────────────
  // Recompute the clickable system subset whenever the galaxy regenerates.
  // Plain (non-$state) on purpose: only event handlers and the frame loop
  // read it, and keeping it reactive would make the effect below retrigger
  // itself through rebuildSystemMarkers.
  let systemIndices = selectSystemIndices();
  $effect(() => {
    void regenVersion;
    systemIndices = selectSystemIndices();
    rebuildSystemMarkers();
    updateSystemMarkers();
  });

  // ─── Visible system markers ────────────────────────────────────────────
  // One small beacon per clickable system: a crisp core dot with a thin halo
  // ring, gently breathing. Theme-aware — additive warm glow on the dark
  // theme, a solid deep-ink mark on the light theme (additive would vanish
  // on a white background).
  const systemGeometry = $state(new BufferGeometry());
  const systemMaterial = $derived.by(() => {
    const isDark = themeStore.theme === 'dark';
    return new ShaderMaterial({
      depthWrite: false,
      transparent: true,
      blending: isDark ? AdditiveBlending : NormalBlending,
      uniforms: {
        uTime: { value: time },
        uPixelRatio: { value: pixelRatio },
        uColor: { value: new Color(isDark ? 0xffdfae : 0x3a3524) },
        uAlpha: { value: isDark ? 0.85 : 0.6 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uPixelRatio;
        attribute float aSeed;
        varying float vSeed;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          float pulse = 0.9 + 0.1 * sin(uTime * 1.7 + aSeed * 6.2831);
          gl_PointSize = 11.0 * uPixelRatio * pulse;
          vSeed = aSeed;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uAlpha;
        uniform float uTime;
        varying float vSeed;
        void main() {
          float dist = distance(gl_PointCoord, vec2(0.5));
          if (dist > 0.5) discard;
          float core = 1.0 - smoothstep(0.0, 0.14, dist);
          float ring = smoothstep(0.32, 0.37, dist) * (1.0 - smoothstep(0.42, 0.47, dist));
          float twinkle = 0.8 + 0.2 * sin(uTime * 2.3 + vSeed * 12.566);
          float alpha = (core * 0.9 + ring * 0.45) * uAlpha * twinkle;
          gl_FragColor = vec4(uColor, alpha);
          #include <colorspace_fragment>
        }
      `,
    });
  });

  function rebuildSystemMarkers() {
    const count = systemIndices.length;
    const posArr = new Float32Array(count * 3);
    const seedArr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const s = Math.sin(systemIndices[i] * 12.9898) * 43758.5453;
      seedArr[i] = s - Math.floor(s);
    }
    systemGeometry.setAttribute('position', new BufferAttribute(posArr, 3));
    systemGeometry.setAttribute('aSeed', new BufferAttribute(seedArr, 1));
  }

  function updateSystemMarkers() {
    const attr = systemGeometry.getAttribute('position') as BufferAttribute | undefined;
    if (!attr) return;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < systemIndices.length; i++) {
      getSystemWorldPosition(systemIndices[i], time, tmpVec);
      const i3 = i * 3;
      arr[i3] = tmpVec.x;
      arr[i3 + 1] = tmpVec.y;
      arr[i3 + 2] = tmpVec.z;
    }
    attr.needsUpdate = true;
  }

  // ─── useTask: animation + per-frame updates ────────────────────────────
  const { start, stop } = useTask(
    (delta) => {
      if (material) {
        if (worldActive && warpTargetIndex == null && !returnActive) time += Math.min(delta, 0.05);
        material.uniforms.uSize.value = particleSize * dpr.current;
        systemMaterial.uniforms.uPixelRatio.value = dpr.current;
        material.uniforms.uTime.value = time;
      }
      systemMaterial.uniforms.uTime.value = time;
      updateSystemMarkers();
      cameraFlight?.advance(delta);
      updateHudPosition();
    },
    { autoStart: false },
  );

  // ─── Hover + click interaction ─────────────────────────────────────────
  let hoveredIndex = $state<number | null>(null);
  let touchPreviewIndex = $state<number | null>(null);
  let downX = 0;
  let downY = 0;
  const tmpVec = new Vector3();

  const interactive = $derived(warpTargetIndex == null);

  function ndcFromEvent(e: { clientX: number; clientY: number }, rect: DOMRect) {
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((e.clientY - rect.top) / rect.height) * 2 - 1),
    };
  }

  function onPointerMove(e: PointerEvent) {
    const c = canvasEl;
    const cam = sceneCamera;
    if (!c || !cam) return;
    if (e.pointerType === 'touch') return;
    if (!interactive || returnActive) {
      hoveredIndex = null;
      touchPreviewIndex = null;
      c.style.cursor = '';
      return;
    }
    const { x: ndcX, y: ndcY } = ndcFromEvent(e, c.getBoundingClientRect());
    // 0.12 NDC ≈ 6% of half-screen — generous enough to snap to the nearest
    // of ~120 systems spread across the galaxy view without pixel-perfect aim.
    const idx = findHoveredSystem(cam, systemIndices, time, ndcX, ndcY, 0.12);
    hoveredIndex = idx;
    touchPreviewIndex = null;
    c.style.cursor = idx != null ? 'pointer' : '';
    updateHudPosition();
  }

  // On pointerdown, capture the candidate system under the cursor BEFORE
  // OrbitControls runs setPointerCapture (which can suppress later canvas
  // pointerup/click events). We commit the selection on a window-level
  // pointerup, which is guaranteed to fire regardless of pointer capture.
  let downCandidate: number | null = null;

  function onPointerDown(e: PointerEvent) {
    downX = e.clientX;
    downY = e.clientY;
    if (!interactive || returnActive) {
      downCandidate = null;
      return;
    }
    const c = canvasEl;
    const cam = sceneCamera;
    if (!c || !cam) {
      downCandidate = null;
      return;
    }
    const { x: ndcX, y: ndcY } = ndcFromEvent(e, c.getBoundingClientRect());
    downCandidate = findHoveredSystem(cam, systemIndices, time, ndcX, ndcY, 0.12);
  }

  function onWindowPointerUp(e: PointerEvent) {
    const candidate = downCandidate;
    downCandidate = null;
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved > 6) return; // drag, not a click — let OrbitControls keep it
    if (e.pointerType === 'touch') {
      if (candidate == null) {
        hoveredIndex = null;
        touchPreviewIndex = null;
        hideHud();
        return;
      }
      if (touchPreviewIndex !== candidate) {
        hoveredIndex = candidate;
        touchPreviewIndex = candidate;
        updateHudPosition();
        return;
      }
    }
    if (candidate == null || !interactive) return;
    onSelectSystem?.(candidate);
  }

  function onPointerLeave(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    hoveredIndex = null;
    touchPreviewIndex = null;
    if (canvasEl) canvasEl.style.cursor = '';
  }

  // Use renderer.domElement (the actual WebGL canvas) rather than useDOM(),
  // which may not expose the canvas reliably during early effect runs.
  const canvasEl = renderer.domElement;

  $effect(() => {
    const c = renderer.domElement;
    if (!c) return;
    c.addEventListener('pointermove', onPointerMove);
    c.addEventListener('pointerdown', onPointerDown);
    c.addEventListener('pointerleave', onPointerLeave);
    // pointerup on window: survives OrbitControls' setPointerCapture which
    // can swallow pointerup/click on the canvas itself.
    window.addEventListener('pointerup', onWindowPointerUp);
    return () => {
      c.removeEventListener('pointermove', onPointerMove);
      c.removeEventListener('pointerdown', onPointerDown);
      c.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerup', onWindowPointerUp);
    };
  });

  // ─── Hover HUD (label + reticle overlay) ───────────────────────────────
  $effect(() => {
    if (hoveredIndex == null || !interactive) {
      hideHud();
      return;
    }
    const system = getStarSystem(hoveredIndex);
    const index = hoveredIndex;
    showHud({
      title: system.name,
      subtitle: system.subtitle,
      hint: 'Travel',
      onDark: themeStore.theme === 'dark',
      onActivate: () => onSelectSystem?.(index),
    });
  });

  // Project the hovered system to canvas pixels and pin the HUD to it. Runs
  // per-frame while the galaxy spins and on pointermove while paused.
  function updateHudPosition() {
    if (hoveredIndex == null) return;
    const cam = sceneCamera;
    if (!cam) return;
    getSystemWorldPosition(hoveredIndex, time, tmpVec);
    tmpVec.project(cam);
    const x = (tmpVec.x * 0.5 + 0.5) * canvasEl.clientWidth;
    const y = (-tmpVec.y * 0.5 + 0.5) * canvasEl.clientHeight;
    setHudScreenPosition(x, y);
  }

  // ─── Warp glow ─────────────────────────────────────────────────────────
  // A corona billboard parked on the destination star. During the dive it
  // swells until it floods the viewport with the star's color, so the scene
  // cut happens under matching in-scene glare — a real zoom, not a curtain.
  const warpGlowMaterial = new ShaderMaterial({
    vertexShader: coronaVertexShader,
    fragmentShader: coronaFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uColor: { value: new Color(0xffffff) },
      uTime: { value: 0 },
      uSeed: { value: 0 },
    },
  });
  const warpGlowMesh = new Mesh(new PlaneGeometry(1, 1), warpGlowMaterial);
  warpGlowMesh.visible = false;
  warpGlowMesh.renderOrder = 30;
  warpGlowMesh.frustumCulled = false;

  // Additive glow is invisible on the light theme's white galaxy — switch to
  // normal alpha blending there (the corona shader outputs straight alpha).
  $effect(() => {
    warpGlowMaterial.blending = themeStore.theme === 'dark' ? AdditiveBlending : NormalBlending;
  });

  onDestroy(() => {
    warpGlowMesh.geometry.dispose();
    warpGlowMaterial.dispose();
  });

  // ─── Warp-out dive ─────────────────────────────────────────────────────
  // Accelerate the camera straight into the chosen star while its glow grows
  // to cover the frame; the orchestrator cuts scenes at the moment of
  // "impact" under that glare.
  const warpPos = new Vector3();

  $effect(() => {
    if (warpTargetIndex == null || !warmup.ready) return;
    const cam = sceneCamera;
    if (!cam) return;

    hoveredIndex = null;
    hideHud();
    canvasEl.style.cursor = '';

    const ctrl = untrack(() => controls);
    flightMemory.galaxy = {
      time,
      position: cam.position.toArray(),
      target: ctrl?.target.toArray() ?? [0, 0, 0],
      fov: cam.fov,
    };
    getSystemWorldPosition(warpTargetIndex, time, warpPos);
    const dir = new Vector3().subVectors(warpPos, cam.position);
    const dist = dir.length() || 1;
    dir.multiplyScalar(1 / dist);
    // Stop just short of the star so we never overshoot through the disk.
    const endPos = new Vector3().copy(warpPos).addScaledVector(dir, -1.2);

    const targetSystem = getStarSystem(warpTargetIndex);
    (warpGlowMaterial.uniforms.uColor.value as Color).set(targetSystem.starColor);
    warpGlowMaterial.uniforms.uSeed.value = (warpTargetIndex % 977) * 0.173;
    warpGlowMesh.position.copy(warpPos);
    warpGlowMesh.visible = true;
    const flight = createCameraFlight(
      cam,
      ctrl,
      {
        position: endPos.toArray(),
        target: warpPos.toArray(),
        fov: cameraFov + 14,
        arc: 0.15,
        bank: -0.04,
      },
      2.6,
      {
        handoff: true,
        onProgress: (p, e) => {
          warpGlowMesh.scale.setScalar(0.3 + 2.8 * e * e * e);
          warpGlowMesh.quaternion.copy(cam.quaternion);
          warpGlowMaterial.uniforms.uTime.value = p * 2.6;
          onVeil?.(smoothstepJs(0.86, 1, p), targetSystem.starColor);
        },
        onComplete: onDeparted,
      },
    );
    cameraFlight = flight;
    return () => {
      flight.cancel();
      if (cameraFlight === flight) cameraFlight = undefined;
      warpGlowMesh.visible = false;
    };
  });

  // ─── Return dive (system → galaxy) ─────────────────────────────────────
  // Mount right at the departed star inside its glare and pull back out to
  // the overview — the exact reverse of the warp-out dive.
  // Captured at mount — a return entry only ever starts life with the scene.
  let returnActive = $state(untrack(() => returnFromIndex) != null && !prefersReducedMotion());
  let returnStarted = false;

  $effect(() => {
    if (returnFromIndex == null || returnStarted || !warmup.ready) return;
    const cam = sceneCamera;
    const returnControls = controls;
    if (!cam || !returnControls) return;
    returnStarted = true;
    if (prefersReducedMotion()) return;

    getSystemWorldPosition(returnFromIndex, time, warpPos);
    const overview = new Vector3(...(flightMemory.galaxy?.position ?? cameraPosition));
    const dir = new Vector3().subVectors(overview, warpPos).normalize();
    cam.position.copy(warpPos).addScaledVector(dir, 1.4);
    cam.lookAt(warpPos);
    returnControls?.target.copy(warpPos);

    const returnSystem = getStarSystem(returnFromIndex);
    (warpGlowMaterial.uniforms.uColor.value as Color).set(returnSystem.starColor);
    warpGlowMaterial.uniforms.uSeed.value = (returnFromIndex % 977) * 0.173;
    warpGlowMesh.position.copy(warpPos);
    warpGlowMesh.visible = true;
    const flight = createCameraFlight(
      cam,
      returnControls,
      {
        position: overview.toArray(),
        target: flightMemory.galaxy?.target ?? [0, 0, 0],
        fov: flightMemory.galaxy?.fov ?? cameraFov,
        arc: -0.1,
        bank: 0.035,
      },
      2.7,
      {
        onProgress: (p, e) => {
          warpGlowMesh.scale.setScalar(Math.max(0.001, 2.8 * (1 - e)));
          warpGlowMesh.quaternion.copy(cam.quaternion);
          warpGlowMaterial.uniforms.uTime.value = p * 2.7;
          onVeil?.(1 - smoothstepJs(0.02, 0.2, p), returnSystem.starColor);
        },
        onComplete: () => {
          returnActive = false;
          warpGlowMesh.visible = false;
          onArrived?.();
        },
      },
    );
    cameraFlight = flight;
    return () => {
      flight.cancel();
      if (cameraFlight === flight) cameraFlight = undefined;
      warpGlowMesh.visible = false;
      returnActive = false;
    };
  });
</script>

<T.PerspectiveCamera bind:ref={sceneCamera} makeDefault position={cameraPosition} fov={cameraFov}>
  <OrbitControls
    bind:ref={controls}
    enabled={animationActive && warmup.ready && warpTargetIndex == null && !returnActive}
    enableDamping={animationActive && warmup.ready && warpTargetIndex == null && !returnActive}
    target.y={0}
    minDistance={Math.max(10, cameraDistance - 20)}
    maxDistance={cameraDistance + 40}
  />
</T.PerspectiveCamera>

<T.Group position.y={0}>
  <T.Points frustumCulled={false}>
    <T is={geometry} />
    <T is={material} />
  </T.Points>

  <!-- Beacons marking clickable planetary systems. -->
  <T.Points frustumCulled={false}>
    <T is={systemGeometry} />
    <T is={systemMaterial} />
  </T.Points>

  <!-- Warp glow billboard: floods the frame with the destination star's
       color at the moment the scenes cut over. -->
  <T is={warpGlowMesh} />
</T.Group>
