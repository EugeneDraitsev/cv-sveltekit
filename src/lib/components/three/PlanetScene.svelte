<script lang="ts">
  import {
    PlaneGeometry,
    SphereGeometry,
    ShaderMaterial,
    MeshStandardMaterial,
    InstancedMesh,
    Mesh,
    Object3D,
    Color,
    Vector2,
    Vector3,
    Fog,
    BackSide,
    DynamicDrawUsage,
  } from 'three';
  import { onDestroy, untrack } from 'svelte';
  import { T, useTask, useThrelte } from '@threlte/core';

  import terrainVertexShader from './terrainVertexShader.glsl';
  import terrainFragmentShader from './terrainFragmentShader.glsl';
  import skyVertexShader from './skyVertexShader.glsl';
  import skyFragmentShader from './skyFragmentShader.glsl';
  import planetVertexShader from './planetVertexShader.glsl';
  import planetFragmentShader from './planetFragmentShader.glsl';
  import { createFloraGeometry } from './flora';
  import { fbm5 } from './noise';
  import { mulberry32 } from './rng';
  import { easeInCubic, easeOutCubic, prefersReducedMotion, smoothstepJs } from './cameraTween';
  import { lightenHex } from './starSystem';
  import type { StarSystemData, PlanetData, FloraKind } from './starSystem';

  const { renderer, scene } = useThrelte();
  const cameraCtx = useThrelte().camera;

  const {
    animationActive = false,
    system = undefined as unknown as StarSystemData,
    planet = undefined as unknown as PlanetData,
    /** 'descend' plays the atmospheric-entry drop, 'rest' starts in flight. */
    entry = 'descend' as 'descend' | 'rest',
    /** When true, the camera climbs back toward space (hand-off to SystemScene). */
    departing = false,
    /** Motion-locked transition veil: (opacity, colorHex) driven per frame. */
    onVeil = undefined as ((opacity: number, colorHex: number) => void) | undefined,
  } = $props();

  // These props are immutable for the lifetime of a mount — the scene is
  // remounted per journey leg — so capture them once for the scene build.
  const sys: StarSystemData = untrack(() => system);
  const pl: PlanetData = untrack(() => planet);
  const entryMode = untrack(() => entry);

  const surface = pl.surface;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  // ─── World constants ───────────────────────────────────────────────────
  const PLANE_SIZE = 220;
  const HALF = PLANE_SIZE / 2;
  const EXIT_Z = 36; // flora past this world-z respawns at the horizon

  const segments = (() => {
    const cores = navigator.hardwareConcurrency ?? 8;
    if (isMobile) return 128;
    if (cores <= 4) return 192;
    return 256;
  })();

  const fogNear = surface.cloudMode ? 16 : 42;
  const fogFar = surface.cloudMode ? 92 : 138;
  const fogColor = new Color(surface.fogColor);

  const sunDir = new Vector3(0.42, 0.52, -0.72).normalize();
  const lightColor = new Color(sys.starLightColor);

  const waterKindCode = { none: 0, water: 1, lava: 2, ice: 3 }[surface.waterKind];

  // Per-planet wind: liquids travel along it, independent of the flight scroll.
  const windRng = mulberry32(pl.seed ^ 0x77aa11);
  const windAngle = windRng() * Math.PI * 2;
  const windDir = new Vector2(Math.cos(windAngle), Math.sin(windAngle));
  const flowSpeed = { none: 0, water: 0.55, lava: 0.1, ice: 0.25 }[surface.waterKind];

  let time = 0;

  // ─── Terrain ───────────────────────────────────────────────────────────
  let terrainMesh = $state<Mesh>();
  const terrainGeometry = new PlaneGeometry(PLANE_SIZE, PLANE_SIZE, segments, segments);
  const terrainMaterial = new ShaderMaterial({
    vertexShader: terrainVertexShader,
    fragmentShader: terrainFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: new Vector2(0, 0) },
      uSeedOffset: { value: new Vector2(surface.offsetX, surface.offsetY) },
      uTerrainScale: { value: surface.terrainScale },
      uHeightScale: { value: surface.heightScale },
      uWaterLevel: { value: surface.waterLevel },
      uWaterKind: { value: waterKindCode },
      uCloudMode: { value: surface.cloudMode ? 1 : 0 },
      uBiomeVariation: { value: surface.biomeVariation },
      uPalWater: { value: new Color(surface.palette.water) },
      uPalLow: { value: new Color(surface.palette.low) },
      uPalMid: { value: new Color(surface.palette.mid) },
      uPalHigh: { value: new Color(surface.palette.high) },
      uPalPeak: { value: new Color(surface.palette.peak) },
      uPalCliff: { value: new Color(surface.palette.cliff) },
      uAltLow: { value: new Color(surface.altPalette.low) },
      uAltMid: { value: new Color(surface.altPalette.mid) },
      uAltHigh: { value: new Color(surface.altPalette.high) },
      uLightDir: { value: sunDir.clone() },
      uLightColor: { value: lightColor.clone() },
      uFogColor: { value: fogColor.clone() },
      uFogNear: { value: fogNear },
      uFogFar: { value: fogFar },
      uWindDir: { value: windDir.clone() },
      uFlowSpeed: { value: flowSpeed },
    },
  });

  // ─── Sky dome ──────────────────────────────────────────────────────────
  const skyGeometry = new SphereGeometry(500, 32, 16);
  const skyMaterial = new ShaderMaterial({
    vertexShader: skyVertexShader,
    fragmentShader: skyFragmentShader,
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uHorizon: { value: new Color(surface.skyHorizon) },
      uZenith: { value: new Color(surface.skyZenith) },
      uSunDir: { value: sunDir.clone() },
      uSunColor: { value: new Color(lightenHex(sys.starColor, 0.25)) },
      uSunDisc: { value: surface.cloudMode ? 0.3 : 1 },
      uStars: { value: surface.skyStars },
      uTime: { value: 0 },
    },
  });

  // ─── Moons hanging in the sky ──────────────────────────────────────────
  const moonRng = mulberry32(pl.seed ^ 0x51ab3c);
  const moonGeometry = new SphereGeometry(1, 28, 18);
  const moonRecords = pl.moons.slice(0, 3).map((moon, i) => {
    const material = new ShaderMaterial({
      vertexShader: planetVertexShader,
      fragmentShader: planetFragmentShader,
      uniforms: {
        uColorA: { value: new Color(moon.color) },
        uColorB: { value: new Color(0x55504a) },
        uColorC: { value: new Color(0xc4beb2) },
        uAtmosphere: { value: new Color(0x000000) },
        uLightDir: { value: sunDir.clone() },
        uLightColor: { value: lightColor.clone() },
        uTime: { value: 0 },
        uSeed: { value: (pl.seed % 641) * 0.29 + i },
        uNoiseScale: { value: 3.2 },
        uBand: { value: 0 },
        uCloudiness: { value: 0 },
        uEmissive: { value: 0 },
      },
    });
    const mesh = new Mesh(moonGeometry, material);
    const size = Math.min(Math.max((moon.size / pl.radius) * 60, 8), 24);
    mesh.scale.setScalar(size);
    return {
      mesh,
      material,
      azimuth: -1.1 + i * 1.05 + moonRng() * 0.5,
      elevation: 0.28 + moonRng() * 0.34,
      drift: 0.004 + moonRng() * 0.004,
    };
  });

  function placeMoons() {
    for (const record of moonRecords) {
      const { azimuth: az, elevation: el } = record;
      record.mesh.position.set(
        Math.sin(az) * Math.cos(el) * 430,
        Math.sin(el) * 430,
        -Math.cos(az) * Math.cos(el) * 430,
      );
    }
  }
  placeMoons();

  // ─── Flight state ──────────────────────────────────────────────────────
  // Declared before the flora pools — initial spawning reads these offsets.
  let scrollX = 0;
  let scrollY = 0;
  let speed = 1.5;
  let speedTarget = 1.5;
  let strafe = 0;

  // ─── Flora (instanced, CPU-placed on the shared heightfield) ───────────
  interface FloraItem {
    a: number; // noise-space X
    b: number; // noise-space Y (forward)
    y: number;
    scale: number;
    rotY: number;
    visible: boolean;
  }

  interface FloraPool {
    mesh: InstancedMesh;
    material: MeshStandardMaterial;
    items: FloraItem[];
  }

  const floraRng = mulberry32(pl.seed ^ 0x9e3779b9);
  const dummy = new Object3D();
  const pools: FloraPool[] = [];

  const heightAt = (a: number, b: number) =>
    fbm5(
      (a + surface.offsetX) * surface.terrainScale,
      (b + surface.offsetY) * surface.terrainScale,
    ) * surface.heightScale;

  const normalizedHeight = (h: number) =>
    Math.min(Math.max(h / (surface.heightScale * 1.6) + 0.5, 0), 1);

  /** Land band (0 at waterline → 1 at peaks), matching the fragment shader. */
  function landBand(nh: number): number {
    const wl = Math.max(surface.waterLevel, 0.12);
    return Math.min(Math.max((nh - wl) / Math.max(1 - wl, 0.001), 0), 1);
  }

  const BAND_RANGES: Record<Exclude<FloraKind, 'none'>, [number, number]> = {
    trees: [0.04, 0.58],
    palms: [0.01, 0.16],
    cacti: [0.03, 0.62],
    shards: [0.04, 0.8],
    rocks: [0.02, 0.85],
  };

  function trySpawn(item: FloraItem, kind: Exclude<FloraKind, 'none'>, initial: boolean) {
    const [bandMin, bandMax] = BAND_RANGES[kind];
    for (let attempt = 0; attempt < 8; attempt++) {
      const a = scrollX + (floraRng() * 2 - 1) * (HALF * 0.94);
      const b = initial
        ? scrollY - EXIT_Z + floraRng() * (HALF + EXIT_Z) * 0.96
        : scrollY + HALF * (0.88 + floraRng() * 0.08);

      const h = heightAt(a, b);
      const nh = normalizedHeight(h);
      if (surface.waterLevel >= 0 && nh < surface.waterLevel + 0.015) continue;
      const band = landBand(nh);
      if (band < bandMin || band > bandMax) continue;
      // Skip steep slopes so nothing floats off a cliff face.
      const grade = Math.abs(heightAt(a + 1.4, b) - h) + Math.abs(heightAt(a, b + 1.4) - h);
      if (grade > 1.6) continue;

      item.a = a;
      item.b = b;
      item.y = h;
      item.scale = 0.75 + floraRng() * 0.85;
      item.rotY = floraRng() * Math.PI * 2;
      item.visible = true;
      return;
    }
    item.visible = false;
    // Park far ahead so it retries once that stretch scrolls past.
    item.b = scrollY + HALF;
  }

  function createPool(
    kind: Exclude<FloraKind, 'none'>,
    count: number,
    colorA: number,
    colorB: number,
  ): FloraPool {
    const geometry = createFloraGeometry(kind);
    const material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.95,
      metalness: 0,
    });
    const mesh = new InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);

    const tintA = new Color(colorA);
    const tintB = new Color(colorB);
    const tint = new Color();
    const items: FloraItem[] = [];
    for (let i = 0; i < count; i++) {
      const item: FloraItem = { a: 0, b: 0, y: 0, scale: 1, rotY: 0, visible: false };
      trySpawn(item, kind, true);
      items.push(item);
      tint.copy(tintA).lerp(tintB, floraRng());
      const shade = 0.85 + floraRng() * 0.3;
      mesh.setColorAt(i, tint.multiplyScalar(shade));
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    const pool: FloraPool = { mesh, material, items };
    pools.push(pool);
    return pool;
  }

  const densityScale = isMobile ? 0.55 : 1;
  const primaryKind = surface.flora;
  const primaryPool =
    primaryKind !== 'none'
      ? createPool(
          primaryKind,
          Math.round(170 * surface.floraDensity * densityScale),
          surface.floraColors[0],
          surface.floraColors[1],
        )
      : null;
  // Scatter rocks alongside vegetation for texture (unless rocks already are
  // the vegetation, or there is nothing at all).
  const rockPool =
    primaryKind !== 'none' && primaryKind !== 'rocks'
      ? createPool(
          'rocks',
          Math.round(55 * densityScale),
          surface.palette.cliff,
          lightenHex(surface.palette.cliff, 0.25),
        )
      : null;
  function updatePool(pool: FloraPool, kind: Exclude<FloraKind, 'none'>) {
    const { mesh, items } = pool;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const worldZ = scrollY - item.b;
      if (worldZ > EXIT_Z) {
        trySpawn(item, kind, false);
      }
      let worldX = item.a - scrollX;
      if (worldX > HALF) {
        item.a -= PLANE_SIZE * 0.94;
        trySpawnInPlace(item, kind);
        worldX = item.a - scrollX;
      } else if (worldX < -HALF) {
        item.a += PLANE_SIZE * 0.94;
        trySpawnInPlace(item, kind);
        worldX = item.a - scrollX;
      }

      if (item.visible) {
        dummy.position.set(worldX, item.y - 0.14 * item.scale, scrollY - item.b);
        dummy.rotation.set(0, item.rotY, 0);
        dummy.scale.setScalar(item.scale);
      } else {
        dummy.position.set(0, -1000, 0);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.001);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  /** Re-validate an item after a lateral wrap (its terrain sample changed). */
  function trySpawnInPlace(item: FloraItem, kind: Exclude<FloraKind, 'none'>) {
    const h = heightAt(item.a, item.b);
    const nh = normalizedHeight(h);
    const [bandMin, bandMax] = BAND_RANGES[kind];
    if (surface.waterLevel >= 0 && nh < surface.waterLevel + 0.015) {
      item.visible = false;
      return;
    }
    const band = landBand(nh);
    if (band < bandMin || band > bandMax) {
      item.visible = false;
      return;
    }
    item.y = h;
    item.visible = true;
  }

  // ─── Flight controls ───────────────────────────────────────────────────
  const keysHeld = new Set<string>();
  let pointerInside = false;
  let dragging = false;
  let lastDragX = 0;
  let lastDragY = 0;

  const canvasEl = renderer.domElement;

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const key = e.key.toLowerCase();
    if (['w', 'a', 's', 'd'].includes(key)) {
      keysHeld.add(key);
    } else if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      // Arrows double as flight controls, but only while the pointer is over
      // the scene — never steal page scrolling.
      if (!pointerInside) return;
      e.preventDefault();
      keysHeld.add(key);
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    keysHeld.delete(e.key.toLowerCase());
  }

  function onPointerEnter() {
    pointerInside = true;
  }

  function onPointerLeave() {
    pointerInside = false;
    dragging = false;
  }

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dx = e.clientX - lastDragX;
    const dy = e.clientY - lastDragY;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    scrollX += dx * 0.045;
    speedTarget = Math.min(Math.max(speedTarget - dy * 0.012, 0.15), 3.6);
  }

  function onPointerUp() {
    dragging = false;
  }

  $effect(() => {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvasEl.addEventListener('pointerenter', onPointerEnter);
    canvasEl.addEventListener('pointerleave', onPointerLeave);
    canvasEl.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvasEl.removeEventListener('pointerenter', onPointerEnter);
      canvasEl.removeEventListener('pointerleave', onPointerLeave);
      canvasEl.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      keysHeld.clear();
    };
  });

  // ─── Camera ────────────────────────────────────────────────────────────
  const baseY = Math.max(surface.heightScale + 5, 11);
  const lookTarget = new Vector3();

  // Atmospheric entry / departure. Entry starts high with the fog pulled in
  // tight (the cut from the system scene lands inside the haze), then the
  // camera sinks to flight level while the fog opens up. Departure reverses it.
  const reduceMotion = prefersReducedMotion();
  let entryProgress = entryMode === 'descend' && !reduceMotion ? 0 : 1;
  let departProgress = 0;
  const ENTRY_ALTITUDE = 62;
  const DEPART_CLIMB = 55;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  // The arrival haze dissolves on its own rAF clock (survives task pauses),
  // motion-matched to the first stretch of the descent.
  $effect(() => {
    if (entryMode !== 'descend' || reduceMotion) return;
    const DISSOLVE_MS = 850;
    const t0 = performance.now();
    let raf: number | undefined;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / DISSOLVE_MS);
      onVeil?.(1 - easeOutCubic(p), surface.fogColor);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      if (raf !== undefined) cancelAnimationFrame(raf);
    };
  });

  // ─── Renderer / scene environment ──────────────────────────────────────
  $effect(() => {
    renderer.setClearColor(fogColor, 1);
    renderer.setPixelRatio(pixelRatio);
    // Scene fog covers the standard-material flora with the same falloff the
    // terrain shader applies manually, so instances fade instead of popping.
    scene.fog = new Fog(fogColor.getHex(), fogNear, fogFar);
    return () => {
      scene.fog = null;
    };
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

  onDestroy(() => {
    terrainGeometry.dispose();
    terrainMaterial.dispose();
    skyGeometry.dispose();
    skyMaterial.dispose();
    moonGeometry.dispose();
    for (const record of moonRecords) record.material.dispose();
    for (const pool of pools) {
      pool.mesh.geometry.dispose();
      pool.material.dispose();
      pool.mesh.dispose();
    }
  });

  // ─── Frame loop ────────────────────────────────────────────────────────
  const { start, stop } = useTask(
    (delta) => {
      time += delta;

      // Ease speed/strafe toward their targets for a floaty flight feel.
      const strafeTarget =
        (keysHeld.has('d') || keysHeld.has('arrowright') ? 7 : 0) -
        (keysHeld.has('a') || keysHeld.has('arrowleft') ? 7 : 0);
      if (keysHeld.has('w') || keysHeld.has('arrowup')) {
        speedTarget = Math.min(speedTarget + delta * 2.4, 3.6);
      }
      if (keysHeld.has('s') || keysHeld.has('arrowdown')) {
        speedTarget = Math.max(speedTarget - delta * 2.4, 0.15);
      }
      speed += (speedTarget - speed) * Math.min(1, delta * 3);
      strafe += (strafeTarget - strafe) * Math.min(1, delta * 4.5);

      scrollY += speed * delta;
      scrollX += strafe * delta;

      terrainMaterial.uniforms.uTime.value = time;
      // Snap the noise-sampling offset to whole grid cells and slide the mesh
      // by the fractional remainder. Every vertex then re-samples identical
      // heightfield positions between snaps, so landforms and shorelines move
      // rigidly instead of morphing/shimmering through the vertex grid.
      const cell = PLANE_SIZE / segments;
      const snapX = Math.floor(scrollX / cell) * cell;
      const snapY = Math.floor(scrollY / cell) * cell;
      (terrainMaterial.uniforms.uScroll.value as Vector2).set(snapX, snapY);
      if (terrainMesh) {
        terrainMesh.position.x = -(scrollX - snapX);
        terrainMesh.position.z = scrollY - snapY;
      }
      skyMaterial.uniforms.uTime.value = time;

      for (const record of moonRecords) {
        record.azimuth += delta * record.drift;
        record.material.uniforms.uTime.value = time;
      }
      placeMoons();

      if (primaryPool && primaryKind !== 'none') updatePool(primaryPool, primaryKind);
      if (rockPool) updatePool(rockPool, 'rocks');

      // Atmospheric entry sinks the camera in from altitude while the fog
      // opens; departure climbs back out while it closes. The departure also
      // drives the transition veil toward the surface fog color, so the cut
      // back to space happens inside the haze — no curtain.
      if (entryProgress < 1) entryProgress = Math.min(1, entryProgress + delta / 1.6);
      if (departing && !reduceMotion) {
        departProgress = Math.min(1, departProgress + delta / 0.85);
        onVeil?.(smoothstepJs(0.35, 0.94, departProgress), surface.fogColor);
      }
      const de = easeOutCubic(entryProgress);
      const dp = easeInCubic(departProgress);

      const fogNearNow = lerp(lerp(4, fogNear, de), 3, dp);
      const fogFarNow = lerp(lerp(26, fogFar, de), 16, dp);
      terrainMaterial.uniforms.uFogNear.value = fogNearNow;
      terrainMaterial.uniforms.uFogFar.value = fogFarNow;
      if (scene.fog instanceof Fog) {
        scene.fog.near = fogNearNow;
        scene.fog.far = fogFarNow;
      }

      // Gentle bob + banking into strafes.
      const cam = cameraCtx.current;
      if (cam) {
        const altitude = baseY + (1 - de) * ENTRY_ALTITUDE + dp * DEPART_CLIMB;
        cam.position.set(0, altitude + Math.sin(time * 0.8) * 0.16, 30);
        lookTarget.set(strafe * 0.55, baseY * 0.32 - (1 - de) * 26 + dp * 46, -26);
        cam.lookAt(lookTarget);
        cam.rotateZ(-strafe * 0.03);
      }
    },
    { autoStart: false },
  );

  $effect(() => {
    if (animationActive) {
      start();
    } else {
      stop();
    }
  });
</script>

<T.PerspectiveCamera makeDefault position={[0, baseY, 30]} fov={62} />

<T.DirectionalLight
  color={lightColor}
  intensity={1.5}
  position={[sunDir.x * 120, sunDir.y * 120, sunDir.z * 120]}
/>
<T.HemisphereLight args={[surface.skyHorizon, surface.palette.low, 0.8]} />

<T.Mesh bind:ref={terrainMesh} rotation.x={-Math.PI / 2} frustumCulled={false}>
  <T is={terrainGeometry} />
  <T is={terrainMaterial} />
</T.Mesh>

<T.Mesh frustumCulled={false}>
  <T is={skyGeometry} />
  <T is={skyMaterial} />
</T.Mesh>

{#each moonRecords as record, i (i)}
  <T is={record.mesh} />
{/each}

{#each pools as pool, i (i)}
  <T is={pool.mesh} />
{/each}
