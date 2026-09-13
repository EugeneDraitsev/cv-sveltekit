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
    Euler,
    Vector2,
    Vector3,
    Vector4,
    Fog,
    BackSide,
    DynamicDrawUsage,
  } from 'three';
  import { onDestroy, untrack } from 'svelte';
  import { flightHud } from './flightHud.svelte';
  import { getSceneQuality } from './quality';
  import { SvelteSet } from 'svelte/reactivity';
  import { T, useTask, useThrelte } from '@threlte/core';

  import terrainVertexShader from './terrainVertexShader.glsl';
  import terrainFragmentShader from './terrainFragmentShader.glsl';
  import skyVertexShader from './skyVertexShader.glsl';
  import skyFragmentShader from './skyFragmentShader.glsl';
  import planetVertexShader from './planetVertexShader.glsl';
  import planetFragmentShader from './planetFragmentShader.glsl';
  import speedLinesVertexShader from './speedLinesVertexShader.glsl';
  import speedLinesFragmentShader from './speedLinesFragmentShader.glsl';
  import { createFloraGeometry } from './flora';
  import { touchInput } from './touchInput.svelte';
  import { createClimate, sampleGround } from './terrain';
  import { createLandingPath } from './landingPath';
  import { sceneWarmup } from './sceneWarmup.svelte';
  import { mulberry32 } from './rng';
  import { easeInOutQuint, prefersReducedMotion, smoothstepJs } from './cameraTween';
  import { lightenHex } from './starSystem';
  import type { StarSystemData, PlanetData, FloraKind } from './starSystem';

  const { renderer, scene } = useThrelte();
  let sceneCamera = $state<import('three').PerspectiveCamera>();
  const warmup = sceneWarmup(renderer, scene, () => sceneCamera);

  const {
    animationActive = false,
    system = undefined as unknown as StarSystemData,
    planet = undefined as unknown as PlanetData,
    /** 'descend' plays the atmospheric-entry drop, 'rest' starts in flight. */
    entry = 'descend' as 'descend' | 'rest',
    /** When true, the camera climbs back toward space (hand-off to SystemScene). */
    departing = false,
    /** Motion-locked transition veil: (opacity, colorHex) driven per frame. */
    onDeparted = undefined as (() => void) | undefined,
    onArrived = undefined as (() => void) | undefined,
    onVeil = undefined as ((opacity: number, colorHex: number) => void) | undefined,
  } = $props();

  // These props are immutable for the lifetime of a mount — the scene is
  // remounted per journey leg — so capture them once for the scene build.
  const sys: StarSystemData = untrack(() => system);
  const pl: PlanetData = untrack(() => planet);
  const entryMode = untrack(() => entry);

  const surface = pl.surface;
  const biomes = surface.biomes;
  const quality = getSceneQuality();
  // Two different questions: isMobile sizes the workload (small screen ≈ small
  // GPU), isTouch decides how input behaves. A narrow desktop window is the
  // first without being the second.
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const reduceMotion = prefersReducedMotion();

  // ─── World constants ───────────────────────────────────────────────────
  const PLANE_SIZE = isMobile ? 240 : 312;
  const FLORA_RADIUS = 105; // flora lives in this square around the player

  const segments = quality.terrainSegments;

  // Fog has to clear before the grid runs out, or its straight edge hangs in
  // the air and the planet reads as one square tile. So the reach is derived
  // from the plane instead of being picked on its own.
  const fogFar = Math.min(surface.cloudMode ? 92 : 138, (PLANE_SIZE / 2) * 0.88);
  const fogNear = Math.min(surface.cloudMode ? 16 : 42, fogFar * 0.4);
  const fogColor = new Color(surface.fogColor);

  // Altitude selects a coverage level; geometry and fog ease toward it together
  // instead of jumping at the threshold. The vertex budget stays constant.
  const MAX_GRID_SCALE = 4;
  const MAX_ALTITUDE = fogFar * MAX_GRID_SCALE * 0.72;
  let gridScale = 1;
  let targetGridScale = 1;
  let floraShown = true;

  /** Hysteresis picks the budget; continuous morphing avoids terrain/fog jumps. */
  function updateGridScale(altitude: number, dt: number) {
    while (targetGridScale < MAX_GRID_SCALE && altitude > fogFar * targetGridScale * 0.62)
      targetGridScale *= 2;
    while (targetGridScale > 1 && altitude < fogFar * targetGridScale * 0.22) targetGridScale /= 2;
    gridScale += (targetGridScale - gridScale) * (1 - Math.exp(-dt * 4));
    if (Math.abs(targetGridScale - gridScale) < 0.001) gridScale = targetGridScale;
    return gridScale;
  }

  const sunDir = new Vector3(0.42, 0.52, -0.72).normalize();
  const lightColor = new Color(sys.starLightColor);

  const waterKindCode = { none: 0, water: 1, lava: 2, ice: 3 }[surface.waterKind];

  // Per-planet wind: liquids travel along it, independent of player movement.
  const windRng = mulberry32(pl.seed ^ 0x77aa11);
  const windAngle = windRng() * Math.PI * 2;
  const windDir = new Vector2(Math.cos(windAngle), Math.sin(windAngle));
  const flowSpeed = { none: 0, water: 0.55, lava: 0.1, ice: 0.25 }[surface.waterKind];

  let time = 0;

  // ─── CPU heightfield (must mirror the terrain shaders exactly) ─────────
  const climate = createClimate(surface);
  const groundInfo = (wx: number, wz: number) => sampleGround(wx, wz, surface, climate);
  const landingPath = createLandingPath((x, z) => groundInfo(x, z).ground);

  const normalizedHeight = (h: number) =>
    Math.min(Math.max(h / (surface.heightScale * 1.6) + 0.5, 0), 1);

  /** Land band (0 at waterline → 1 at peaks), matching the fragment shader. */
  function landBand(nh: number): number {
    const wl = Math.max(surface.waterLevel, 0.12);
    return Math.min(Math.max((nh - wl) / Math.max(1 - wl, 0.001), 0), 1);
  }

  // ─── Terrain (floating grid parked under the player) ───────────────────
  const paddedBiomes = [0, 1, 2, 3].map((i) => biomes[Math.min(i, biomes.length - 1)]);

  let terrainMesh = $state<Mesh>();
  const terrainGeometry = new PlaneGeometry(PLANE_SIZE, PLANE_SIZE, segments, segments);
  const terrainMaterial = new ShaderMaterial({
    vertexShader: terrainVertexShader,
    fragmentShader: terrainFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uScroll: { value: new Vector2(0, 0) },
      uGridScale: { value: 1 },
      uSeedOffset: { value: new Vector2(surface.offsetX, surface.offsetY) },
      uTerrainScale: { value: surface.terrainScale },
      uHeightScale: { value: surface.heightScale },
      uWaterLevel: { value: surface.waterLevel },
      uWaterKind: { value: waterKindCode },
      uCloudMode: { value: surface.cloudMode ? 1 : 0 },
      uWindDir: { value: windDir.clone() },
      uFlowSpeed: { value: flowSpeed },
      // Biome climate blending
      uBiomeCount: { value: biomes.length },
      uBioClimate: { value: paddedBiomes.map((b) => new Vector2(b.climate[0], b.climate[1])) },
      uClimateScale: { value: surface.climateScale },
      uClimOffT: { value: new Vector2(surface.climOffTX, surface.climOffTY) },
      uClimOffM: { value: new Vector2(surface.climOffMX, surface.climOffMY) },
      uBioHeightMul: { value: new Vector4(...paddedBiomes.map((b) => b.heightMul)) },
      uBioDunes: { value: new Vector4(...paddedBiomes.map((b) => (b.relief === 1 ? 1 : 0))) },
      uBioRidges: { value: new Vector4(...paddedBiomes.map((b) => (b.relief === 2 ? 1 : 0))) },
      uBioTerraces: { value: new Vector4(...paddedBiomes.map((b) => (b.relief === 3 ? 1 : 0))) },
      uBioLow: { value: paddedBiomes.map((b) => new Color(b.low)) },
      uBioMid: { value: paddedBiomes.map((b) => new Color(b.mid)) },
      uBioHigh: { value: paddedBiomes.map((b) => new Color(b.high)) },
      uBioPeak: { value: paddedBiomes.map((b) => new Color(b.peak)) },
      uWaterColor: { value: new Color(surface.waterColor) },
      uCliffColor: { value: new Color(surface.cliffColor) },
      uLightDir: { value: sunDir.clone() },
      uLightColor: { value: lightColor.clone() },
      uFogColor: { value: fogColor.clone() },
      uFogNear: { value: fogNear },
      uFogFar: { value: fogFar },
      uSkyHorizon: { value: new Color(surface.skyHorizon) },
      uSkyZenith: { value: new Color(surface.skyZenith) },
    },
  });

  // ─── Sky dome (follows the player) ─────────────────────────────────────
  let skyMesh = $state<Mesh>();
  // Wide enough to still sit outside the grid at full zoom-out.
  const skyGeometry = new SphereGeometry(1600, 32, 16);
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

  function placeMoons(cx: number, cy: number, cz: number) {
    for (const record of moonRecords) {
      const { azimuth: az, elevation: el } = record;
      record.mesh.position.set(
        cx + Math.sin(az) * Math.cos(el) * 430,
        cy + Math.sin(el) * 430,
        cz - Math.cos(az) * Math.cos(el) * 430,
      );
    }
  }

  // ─── Player state (free flight) ────────────────────────────────────────
  const FLY_SPEED = 15;
  const FLY_VERT = 9;
  const BOOST_MULT = 2.1; // Shift / long-press: speed ×(1 + BOOST_MULT)
  const EYE = 1.7;
  const HOVER_MIN = 1.0; // never clip into the ground while skimming

  let camX = 0;
  let camZ = 0;
  let feetY = 0;
  let vy = 0;
  let yaw = 0;
  let pitch = -0.45;
  let boostFactor = 0;
  let lookYaw = yaw;
  let lookPitch = pitch;
  let velocityX = 0;
  let velocityZ = 0;
  let hudTime = 0;

  const keys = new SvelteSet<string>();
  // Starts true: the player reached this scene by clicking the canvas, so the
  // keyboard is theirs immediately (Space must not scroll the page).
  let pointerInside = true;
  // Sticky game focus: engaged from arrival / any canvas press, released only
  // by interacting with the page OUTSIDE the hero. Keeps Space/arrows working
  // when a look-drag ends past the canvas edge.
  let engaged = true;
  let dragging = false;
  let lastDragX = 0;
  let lastDragY = 0;
  // Long-press (no drag) = boost, mirroring Shift on touch devices.
  let pressStart = 0;
  let pressMoved = false;

  const canvasEl = renderer.domElement;
  const cameraEuler = new Euler(0, 0, 0, 'YXZ');

  // Entry / departure choreography.
  let entryProgress = entryMode === 'descend' && !reduceMotion ? 0 : 1;
  let departProgress = 0;
  let departBaseY = 0;
  let departBaseX = 0;
  let departBaseZ = 0;
  let departPitch = 0;
  let arrivalReported = entryProgress === 1;
  let departureReported = false;

  // Spawn on solid ground at the world origin (seed offsets randomize it).
  {
    const spawn = groundInfo(0, 0);
    feetY = entryProgress < 1 ? landingPath(0).height : spawn.ground + 2;
    pitch = entryProgress < 1 ? landingPath(0).pitch : pitch;
    lookPitch = pitch;
    updateGridScale(feetY - spawn.ground, 10);
    Object.assign(flightHud, {
      biome: biomes[spawn.biomeIndex].name,
      altitude: Math.round(feetY - spawn.ground + EYE),
      speed: 0,
      heading: 0,
    });
  }

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const initialCameraPosition: [number, number, number] = [camX, feetY + EYE, camZ];
  const initialCameraRotation: [number, number, number] = [pitch, 0, 0];

  $effect(() => {
    if (!departing) return;
    departBaseY = feetY;
    departBaseX = camX;
    departBaseZ = camZ;
    departPitch = pitch;
    keys.clear();
  });

  // ─── Look + movement input ─────────────────────────────────────────────
  function applyLook(dx: number, dy: number, sensitivity: number) {
    if (entryProgress < 1 || departing || !animationActive) return;
    lookYaw -= dx * sensitivity;
    lookPitch = Math.min(1.4, Math.max(-1.4, lookPitch - dy * sensitivity));
  }

  function onKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (
      !animationActive ||
      entryProgress < 1 ||
      departing ||
      target?.closest('input, textarea, select, button, a, [contenteditable]')
    )
      return;
    const captured = pointerInside || engaged;
    if (!captured) return;

    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'KeyC',
        'Space',
        'ShiftLeft',
        'ShiftRight',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
      ].includes(e.code)
    )
      keys.add(e.code);
  }

  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code);
  }

  // The hero container: transition veils and journey chrome live inside it.
  const heroRoot = canvasEl.closest('.threlte-app');

  function onPointerEnter() {
    pointerInside = true;
  }

  function onPointerLeave(e: PointerEvent) {
    // The transition veil (pointer-events: auto while covering) steals the
    // hit test and fires a bogus pointerleave without the mouse moving —
    // ignore departures that stay inside the hero container, otherwise Space
    // would fall through to page scrolling after every arrival.
    const to = e.relatedTarget as Node | null;
    if (to && heroRoot?.contains(to)) return;
    pointerInside = false;
    // NOTE: dragging intentionally survives leaving the canvas — like orbit
    // controls, the look-drag follows the pointer until the button releases.
  }

  // Track exactly ONE pointer for look-drag. On touch this is essential: a
  // second finger, a browser-hijacked scroll gesture, or a lost pointerup all
  // corrupt the drag state otherwise (the classic "camera sticks" bug).
  let activePointerId: number | null = null;
  // Touch look wants a bit more travel than a mouse for the same feel.
  const lookSensitivity = isTouch ? 0.006 : 0.0042;

  function onPointerDown(e: PointerEvent) {
    if (entryProgress < 1 || departing || !animationActive || activePointerId !== null) return; // already dragging with another pointer
    activePointerId = e.pointerId;
    // Capture routes every move/up/cancel for this pointer back to the canvas,
    // even if the finger slides off it — no more lost pointerups on mobile.
    try {
      canvasEl.setPointerCapture(e.pointerId);
    } catch {
      // pointer already gone; ignore
    }
    pointerInside = true;
    engaged = true;
    dragging = true;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    pressStart = performance.now();
    pressMoved = false;
  }

  /** Clicking anywhere outside the hero hands the keyboard back to the page. */
  function onWindowPointerDown(e: PointerEvent) {
    const target = e.target as Node | null;
    if (target && heroRoot && !heroRoot.contains(target)) {
      engaged = false;
      keys.clear();
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging || e.pointerId !== activePointerId) return;
    const dx = e.clientX - lastDragX;
    const dy = e.clientY - lastDragY;
    lastDragX = e.clientX;
    lastDragY = e.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 3) pressMoved = true;
    // Dragging grabs the world (orbit-style): swipe down looks up. The pointer
    // stays free for the rest of the page.
    applyLook(-dx, -dy, lookSensitivity);
  }

  function endDrag(e: PointerEvent) {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    dragging = false;
  }

  function clearInput() {
    keys.clear();
    dragging = false;
    activePointerId = null;
    velocityX = 0;
    velocityZ = 0;
    vy = 0;
  }

  $effect(() => {
    if (!animationActive) clearInput();
  });

  $effect(() => {
    window.addEventListener('blur', clearInput);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvasEl.addEventListener('pointerenter', onPointerEnter);
    canvasEl.addEventListener('pointermove', onPointerEnter);
    canvasEl.addEventListener('pointerleave', onPointerLeave);
    canvasEl.addEventListener('pointerdown', onPointerDown);
    canvasEl.addEventListener('pointermove', onPointerMove);
    canvasEl.addEventListener('pointerup', endDrag);
    // pointercancel is the mobile killer: a scroll/pinch/zoom gesture the
    // browser steals fires cancel (not up), so without this the drag sticks on.
    canvasEl.addEventListener('pointercancel', endDrag);
    canvasEl.addEventListener('lostpointercapture', endDrag);
    window.addEventListener('pointerdown', onWindowPointerDown);

    // Own touch gestures inside the flyover: no native page-scroll / pinch to
    // fight the look-drag. Restored when the scene unmounts (galaxy/system
    // want their normal touch behavior back).
    const prevTouchAction = canvasEl.style.touchAction;
    canvasEl.style.touchAction = 'none';

    return () => {
      window.removeEventListener('blur', clearInput);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvasEl.removeEventListener('pointerenter', onPointerEnter);
      canvasEl.removeEventListener('pointermove', onPointerEnter);
      canvasEl.removeEventListener('pointerleave', onPointerLeave);
      canvasEl.removeEventListener('pointerdown', onPointerDown);
      canvasEl.removeEventListener('pointermove', onPointerMove);
      canvasEl.removeEventListener('pointerup', endDrag);
      canvasEl.removeEventListener('pointercancel', endDrag);
      canvasEl.removeEventListener('lostpointercapture', endDrag);
      window.removeEventListener('pointerdown', onWindowPointerDown);
      canvasEl.style.touchAction = prevTouchAction;
      keys.clear();
    };
  });

  // ─── Boost speed lines (fullscreen overlay, bypasses the camera) ───────
  const speedLinesGeometry = new PlaneGeometry(2, 2);
  const speedLinesMaterial = new ShaderMaterial({
    vertexShader: speedLinesVertexShader,
    fragmentShader: speedLinesFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uBoost: { value: 0 },
      uAspect: { value: 1.6 },
    },
  });
  const speedLinesMesh = new Mesh(speedLinesGeometry, speedLinesMaterial);
  speedLinesMesh.frustumCulled = false;
  speedLinesMesh.renderOrder = 100;
  speedLinesMesh.visible = false;

  // ─── Flora (instanced, one pool per biome flora kind) ──────────────────
  interface FloraItem {
    wx: number;
    wz: number;
    y: number;
    scale: number;
    rotY: number;
    visible: boolean;
  }

  interface FloraPool {
    kind: Exclude<FloraKind, 'none'>;
    /** Extra scatter pool (rocks everywhere) vs biome-owned vegetation. */
    scatter: boolean;
    mesh: InstancedMesh;
    material: MeshStandardMaterial;
    items: FloraItem[];
    colorDirty: boolean;
    matrixDirty: boolean;
    pending: number;
  }

  const floraRng = mulberry32(pl.seed ^ 0x9e3779b9);
  const dummy = new Object3D();
  const tintA = new Color();
  const tintB = new Color();
  const tintOut = new Color();
  const pools: FloraPool[] = [];

  const BAND_RANGES: Record<Exclude<FloraKind, 'none'>, [number, number]> = {
    trees: [0.04, 0.58],
    palms: [0.01, 0.16],
    cacti: [0.03, 0.62],
    shards: [0.04, 0.8],
    rocks: [0.02, 0.85],
  };

  function placeItem(pool: FloraPool, index: number, wx: number, wz: number): boolean {
    const item = pool.items[index];
    const gi = groundInfo(wx, wz);
    const nh = normalizedHeight(gi.h);
    if (surface.waterLevel >= 0 && nh < surface.waterLevel + 0.015) return false;
    const band = landBand(nh);
    const [bandMin, bandMax] = BAND_RANGES[pool.kind];
    if (band < bandMin || band > bandMax) return false;
    if (pool.scatter) {
      if (floraRng() > 0.22) return false;
      tintA.set(surface.cliffColor);
      tintB.set(lightenHex(surface.cliffColor, 0.25));
    } else {
      // A transition zone can host both neighbours' vegetation. Density and
      // palette come from the same climate weights that colour the terrain.
      const density = biomes.reduce(
        (sum, b, i) => sum + (b.flora === pool.kind ? gi.weights[i] * b.floraDensity : 0),
        0,
      );
      if (density <= 0 || floraRng() > density) return false;
      let choice = floraRng() * density;
      let b = biomes[gi.biomeIndex];
      for (let i = 0; i < biomes.length; i++) {
        if (biomes[i].flora !== pool.kind) continue;
        choice -= gi.weights[i] * biomes[i].floraDensity;
        b = biomes[i];
        if (choice <= 0) break;
      }
      tintA.set(b.floraColors[0]);
      tintB.set(b.floraColors[1]);
    }
    // Skip steep slopes so nothing floats off a cliff face.
    const grade =
      Math.abs(groundInfo(wx + 1.4, wz).h - gi.h) + Math.abs(groundInfo(wx, wz + 1.4).h - gi.h);
    if (grade > 1.6) return false;

    item.wx = wx;
    item.wz = wz;
    item.y = gi.h;
    item.scale = 0.75 + floraRng() * 0.85;
    item.rotY = floraRng() * Math.PI * 2;
    item.visible = true;
    tintOut
      .copy(tintA)
      .lerp(tintB, floraRng())
      .multiplyScalar(0.85 + floraRng() * 0.3);
    pool.mesh.setColorAt(index, tintOut);
    pool.colorDirty = true;
    return true;
  }

  function trySpawn(pool: FloraPool, index: number) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const wx = camX + (floraRng() * 2 - 1) * FLORA_RADIUS * 0.96;
      const wz = camZ + (floraRng() * 2 - 1) * FLORA_RADIUS * 0.96;
      if (placeItem(pool, index, wx, wz)) return;
    }
    pool.items[index].visible = false;
    // Park far out; it re-rolls the next time the player moves past it.
    pool.items[index].wx = camX + FLORA_RADIUS;
    pool.items[index].wz = camZ + FLORA_RADIUS;
  }

  function createPool(
    kind: Exclude<FloraKind, 'none'>,
    count: number,
    scatter: boolean,
  ): FloraPool {
    const geometry = createFloraGeometry(kind);
    const material = new MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.95,
      metalness: 0,
    });
    const mesh = new InstancedMesh(geometry, material, count);
    mesh.setColorAt(0, new Color(0xffffff));
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    const pool: FloraPool = {
      kind,
      scatter,
      mesh,
      material,
      items: [],
      colorDirty: false,
      matrixDirty: true,
      pending: 0,
    };
    for (let i = 0; i < count; i++) {
      pool.items.push({ wx: 0, wz: 0, y: 0, scale: 1, rotY: 0, visible: false });
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    pool.colorDirty = false;
    pools.push(pool);
    return pool;
  }

  {
    const densityScale = isMobile ? 0.55 : 1;
    const kinds = [...new Set(biomes.map((b) => b.flora))].filter(
      (k): k is Exclude<FloraKind, 'none'> => k !== 'none',
    );
    for (const kind of kinds) createPool(kind, Math.round(130 * densityScale), false);
    if (!kinds.includes('rocks')) createPool('rocks', Math.round(45 * densityScale), true);
  }

  function updatePool(pool: FloraPool) {
    const { mesh, items } = pool;
    // Bound CPU generation per frame; landing on a forest must not freeze input.
    let budget = quality.constrained ? 4 : 12;
    while (pool.pending < items.length && budget-- > 0) {
      trySpawn(pool, pool.pending++);
      pool.matrixDirty = true;
    }
    let changed = pool.matrixDirty;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      // Torus-wrap around the player: re-enter on the far side and re-roll
      // against the biome there (it may be a different one now).
      const dx = item.wx - camX;
      const dz = item.wz - camZ;
      const wrapped =
        i < pool.pending && (Math.abs(dx) > FLORA_RADIUS || Math.abs(dz) > FLORA_RADIUS);
      if (wrapped) {
        changed = true;
        const wx =
          Math.abs(dx) > FLORA_RADIUS ? item.wx - Math.sign(dx) * FLORA_RADIUS * 1.92 : item.wx;
        const wz =
          Math.abs(dz) > FLORA_RADIUS ? item.wz - Math.sign(dz) * FLORA_RADIUS * 1.92 : item.wz;
        if (!placeItem(pool, i, wx, wz)) {
          item.visible = false;
          item.wx = wx;
          item.wz = wz;
        }
      }

      if (!wrapped && !pool.matrixDirty) continue;
      if (item.visible) {
        dummy.position.set(item.wx, item.y - 0.14 * item.scale, item.wz);
        dummy.rotation.set(0, item.rotY, 0);
        dummy.scale.setScalar(item.scale);
      } else {
        dummy.position.set(item.wx, -1000, item.wz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(0.001);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    if (changed) mesh.instanceMatrix.needsUpdate = true;
    mesh.count = pool.pending > 0 ? items.length : 0;
    pool.matrixDirty = false;
    if (pool.colorDirty && mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
      pool.colorDirty = false;
    }
  }

  // ─── Renderer / scene environment ──────────────────────────────────────
  $effect(() => {
    renderer.setClearColor(fogColor, 1);
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
    speedLinesGeometry.dispose();
    speedLinesMaterial.dispose();
    moonGeometry.dispose();
    for (const record of moonRecords) record.material.dispose();
    for (const pool of pools) {
      pool.mesh.geometry.dispose();
      pool.material.dispose();
      pool.mesh.dispose();
    }
  });

  // ─── Frame loop ────────────────────────────────────────────────────────
  // Reduced-motion visits start paused but still need a complete static scene.
  placeMoons(...initialCameraPosition);
  terrainMaterial.uniforms.uGridScale.value = gridScale;
  terrainMaterial.uniforms.uFogNear.value = fogNear * gridScale;
  terrainMaterial.uniforms.uFogFar.value = fogFar * gridScale;
  for (const pool of pools) updatePool(pool);

  const { start, stop } = useTask(
    (delta) => {
      const dt = Math.min(delta, 0.05); // clamp so tab-switch spikes can't launch the player
      time += dt;

      if (entryProgress >= 1 && !departing) {
        const damping = 1 - Math.exp(-dt * 14);
        yaw += (lookYaw - yaw) * damping;
        pitch += (lookPitch - pitch) * damping;
      }

      // Boost: Shift or a long-press without dragging. Eased so the FOV kick
      // and the speed lines swell in instead of snapping.
      const longPress = dragging && !pressMoved && performance.now() - pressStart > 350;
      const boostHeld =
        (keys.has('ShiftLeft') || keys.has('ShiftRight') || longPress || touchInput.boost) &&
        entryProgress >= 1 &&
        !departing;
      boostFactor += ((boostHeld ? 1 : 0) - boostFactor) * Math.min(1, dt * 5);

      // Flight along the look direction: W/S follow the full 3D view vector
      // (look down + W = descend), A/D strafe on the horizon plane, Space
      // climbs straight up.
      const mForward =
        (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
        (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) +
        touchInput.moveY;
      const mRight =
        (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
        (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) +
        touchInput.moveX;
      const cosP = Math.cos(pitch);
      const fwdX = -Math.sin(yaw);
      const fwdZ = -Math.cos(yaw);
      const rightX = -fwdZ;
      const rightZ = fwdX;
      // Normalize diagonals but keep sub-unit analog magnitudes from the stick.
      const mLen = Math.max(1, Math.hypot(mForward, mRight));
      let moveX = (fwdX * cosP * mForward + rightX * mRight) / mLen;
      let moveY = (Math.sin(pitch) * mForward) / mLen;
      let moveZ = (fwdZ * cosP * mForward + rightZ * mRight) / mLen;
      if (isTouch && !touchInput.active && entryProgress >= 1 && !departing) {
        // Touch device with no joystick mounted and no keyboard to fall back
        // on — cruise gently forward so a drag still steers something.
        moveX += fwdX * cosP * 0.4;
        moveY += Math.sin(pitch) * 0.4;
        moveZ += fwdZ * cosP * 0.4;
      }

      const speed = FLY_SPEED * (1 + boostFactor * BOOST_MULT);
      const steering = 1 - Math.exp(-dt * 7);
      velocityX += (moveX * speed - velocityX) * steering;
      velocityZ += (moveZ * speed - velocityZ) * steering;
      if (entryProgress < 1) {
        entryProgress = Math.min(1, entryProgress + dt / 3.2);
        const point = landingPath(entryProgress);
        camX = point.x;
        camZ = point.z;
      } else if (departing && !reduceMotion) {
        departProgress = Math.min(1, departProgress + dt / 2.6);
        const travel = easeInOutQuint(departProgress) * 110;
        camX = departBaseX - Math.sin(yaw) * travel;
        camZ = departBaseZ - Math.cos(yaw) * travel;
      } else {
        camX += velocityX * dt;
        camZ += velocityZ * dt;
      }

      const gi = groundInfo(camX, camZ);
      const support = gi.ground;

      if (!arrivalReported) {
        // Guided atmospheric entry: sink from altitude to a low hover.
        const point = landingPath(entryProgress);
        feetY = point.height;
        vy = 0;
        pitch = point.pitch;
        lookPitch = pitch;
        lookYaw = yaw;
        onVeil?.(1 - smoothstepJs(0.02, 0.2, entryProgress), surface.fogColor);
        if (entryProgress === 1) {
          arrivalReported = true;
          onArrived?.();
        }
      } else if (departing && !reduceMotion) {
        // Climb back toward space; the veil saturates with the haze.
        onVeil?.(smoothstepJs(0.86, 1, departProgress), surface.fogColor);
        feetY = departBaseY + easeInOutQuint(departProgress) * 120;
        pitch = lerp(departPitch, 0.18, easeInOutQuint(departProgress));
        if (departProgress === 1 && !departureReported) {
          departureReported = true;
          onDeparted?.();
        }
        vy = 0;
      } else {
        const vertIn =
          (keys.has('Space') || touchInput.up ? 1 : 0) -
          (keys.has('KeyC') || touchInput.down ? 1 : 0);
        vy += (vertIn * FLY_VERT - vy) * Math.min(1, dt * 8);
        feetY += vy * dt + moveY * speed * dt;
        // Skim the terrain, never clip into it.
        feetY = Math.max(feetY, support + HOVER_MIN);
        // Ceiling where the grid stops zooming out — past it the ground would
        // just fade into empty haze, so hold the climb here instead.
        if (feetY > support + MAX_ALTITUDE) {
          feetY = support + MAX_ALTITUDE;
          vy = Math.min(vy, 0);
        }
      }

      // Gentle hover sway keeps the craft feeling alive when idle.
      const bob = reduceMotion ? 0 : Math.sin(time * 1.1) * 0.035;

      // Grid zoom follows altitude; fog follows the grid, so the haze always
      // closes in before the plane's edge can show.
      const scale = updateGridScale(feetY - support, dt);

      // Keep terrain visible during the flight; fog follows the grid's reach.
      const fogNearNow = fogNear * scale;
      const fogFarNow = fogFar * scale;
      terrainMaterial.uniforms.uFogNear.value = fogNearNow;
      terrainMaterial.uniforms.uFogFar.value = fogFarNow;
      if (scene.fog instanceof Fog) {
        scene.fog.near = fogNearNow;
        scene.fog.far = fogFarNow;
      }

      // Keep the origin on base-grid cells even while coverage morphs. Changing
      // the snap interval with scale would jump the entire grid under the camera.
      const cell = PLANE_SIZE / segments;
      const snapX = Math.round(camX / cell) * cell;
      const snapZ = Math.round(camZ / cell) * cell;
      terrainMaterial.uniforms.uGridScale.value = scale;
      (terrainMaterial.uniforms.uScroll.value as Vector2).set(snapX, -snapZ);
      if (terrainMesh) terrainMesh.position.set(snapX, 0, snapZ);

      terrainMaterial.uniforms.uTime.value = time;
      skyMaterial.uniforms.uTime.value = time;

      const eyeY = feetY + EYE + bob;
      const cam = sceneCamera;
      if (cam) {
        cam.position.set(camX, eyeY, camZ);
        cameraEuler.set(pitch, yaw, reduceMotion ? 0 : landingPath(entryProgress).bank);
        cam.quaternion.setFromEuler(cameraEuler);
        // FOV kick sells the acceleration.
        const targetFov = 68 + boostFactor * 10;
        if (Math.abs((cam as import('three').PerspectiveCamera).fov - targetFov) > 0.05) {
          (cam as import('three').PerspectiveCamera).fov = targetFov;
          (cam as import('three').PerspectiveCamera).updateProjectionMatrix();
        }
      }
      if (skyMesh) skyMesh.position.set(camX, eyeY, camZ);
      placeMoons(camX, eyeY, camZ);
      for (const record of moonRecords) record.material.uniforms.uTime.value = time;

      // Speed lines swell in at the edges while boosting.
      const flightRush = reduceMotion
        ? 0
        : Math.max(
            boostFactor,
            Math.sin(Math.PI * entryProgress) * 0.3,
            Math.sin(Math.PI * departProgress) * 0.4,
          );
      speedLinesMesh.visible = flightRush > 0.02;
      speedLinesMaterial.uniforms.uBoost.value = flightRush;
      speedLinesMaterial.uniforms.uTime.value = time;
      speedLinesMaterial.uniforms.uAspect.value =
        canvasEl.clientWidth / Math.max(canvasEl.clientHeight, 1);

      // Zoomed out, plants are sub-pixel and their scatter square would draw
      // its own visible edge — park them until the camera comes back down.
      if (floraShown !== scale < 1.05) {
        floraShown = scale < 1.05;
        for (const pool of pools) {
          pool.mesh.visible = floraShown;
          // The player may have crossed the map while up there, so re-roll the
          // whole pool around the new position instead of letting the per-frame
          // wrap crawl after them.
          if (floraShown) {
            pool.pending = 0;
            for (const item of pool.items) item.visible = false;
            pool.matrixDirty = true;
          }
        }
      }
      if (floraShown) for (const pool of pools) updatePool(pool);
      hudTime += dt;
      if (hudTime >= 0.25) {
        hudTime = 0;
        flightHud.biome = biomes[gi.biomeIndex].name;
        flightHud.altitude = Math.round(feetY - support + EYE);
        flightHud.speed = Math.round(Math.hypot(velocityX, velocityZ, vy + moveY * speed));
        flightHud.heading = ((Math.round((-yaw * 180) / Math.PI) % 360) + 360) % 360;
      }
    },
    { autoStart: false },
  );

  $effect(() => {
    if (animationActive && warmup.ready) {
      start();
    } else {
      stop();
    }
  });
</script>

<T.PerspectiveCamera
  bind:ref={sceneCamera}
  makeDefault
  position={initialCameraPosition}
  rotation={initialCameraRotation}
  fov={68}
  near={0.2}
  far={2600}
/>

<T.DirectionalLight
  color={lightColor}
  intensity={1.5}
  position={[sunDir.x * 10000, sunDir.y * 10000, sunDir.z * 10000]}
/>
<T.HemisphereLight args={[surface.skyHorizon, biomes[0].low, 0.8]} />

<T.Mesh bind:ref={terrainMesh} rotation.x={-Math.PI / 2} frustumCulled={false}>
  <T is={terrainGeometry} />
  <T is={terrainMaterial} />
</T.Mesh>

<T.Mesh bind:ref={skyMesh} frustumCulled={false}>
  <T is={skyGeometry} />
  <T is={skyMaterial} />
</T.Mesh>

{#each moonRecords as record, i (i)}
  <T is={record.mesh} />
{/each}

{#each pools as pool, i (i)}
  <T is={pool.mesh} />
{/each}

<T is={speedLinesMesh} />
