<script lang="ts">
  import {
    Group,
    Mesh,
    SphereGeometry,
    PlaneGeometry,
    RingGeometry,
    BufferGeometry,
    BufferAttribute,
    ShaderMaterial,
    LineBasicMaterial,
    LineLoop,
    AdditiveBlending,
    DoubleSide,
    Color,
    Vector3,
    NormalBlending,
  } from 'three';
  import type { PerspectiveCamera } from 'three';
  import type { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { onDestroy, untrack } from 'svelte';
  import { flightMemory } from './flightMemory';
  import { sceneWarmup } from './sceneWarmup.svelte';
  import { getSceneQuality } from './quality';
  import { T, useTask, useThrelte } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';

  import starVertexShader from './starVertexShader.glsl';
  import starFragmentShader from './starFragmentShader.glsl';
  import coronaVertexShader from './coronaVertexShader.glsl';
  import coronaFragmentShader from './coronaFragmentShader.glsl';
  import planetVertexShader from './planetVertexShader.glsl';
  import planetFragmentShader from './planetFragmentShader.glsl';
  import ringVertexShader from './ringVertexShader.glsl';
  import ringFragmentShader from './ringFragmentShader.glsl';
  import starfieldVertexShader from './starfieldVertexShader.glsl';
  import starfieldFragmentShader from './starfieldFragmentShader.glsl';
  import type { StarSystemData, PlanetData, MoonData } from './starSystem';
  import { mulberry32 } from './rng';
  import { showHud, hideHud, setHudScreenPosition } from './hud.svelte';
  import {
    createCameraFlight,
    type CameraFlight,
    prefersReducedMotion,
    smoothstepJs,
  } from './cameraTween';
  import { lightenHex } from './starSystem';
  import themeStore from '$lib/stores/theme.svelte';

  const { renderer, dpr, scene } = useThrelte();
  let sceneCamera = $state<import('three').PerspectiveCamera>();
  const warmup = sceneWarmup(renderer, scene, () => sceneCamera);
  let cameraFlight: CameraFlight | undefined;

  // Our own OrbitControls instance via bind:ref. Deliberately NOT the
  // useOrbitControls() registry: when the galaxy scene swaps out, its
  // OrbitControls' unregister runs after ours registers and wipes the shared
  // store — leaving the registry empty for this scene's whole lifetime. That
  // let Threlte's per-frame controls.update() force lookAt(star) and hijack
  // the first planet approach.
  let controls = $state<ThreeOrbitControls>();

  const {
    animationActive = false,
    worldActive = false,
    system = undefined as unknown as StarSystemData,
    /**
     * 'warp' plays the drop-out-of-warp arrival, 'fromPlanet' pulls back from
     * the planet we just departed, 'return' mounts at rest.
     */
    entry = 'warp' as 'warp' | 'return' | 'fromPlanet',
    /** Planet index we are returning from (entry === 'fromPlanet'). */
    returnPlanetIndex = null as number | null,
    /** While set, the camera glides toward this planet (hand-off to PlanetScene). */
    approachPlanetIndex = null as number | null,
    /** When true, the camera accelerates away from the system (back to galaxy). */
    departing = false,
    /** Motion-locked transition veil: (opacity, colorHex) driven per frame. */
    onDeparted = undefined as (() => void) | undefined,
    onArrived = undefined as (() => void) | undefined,
    onVeil = undefined as ((opacity: number, colorHex: number) => void) | undefined,
    onSelectPlanet = undefined as ((index: number) => void) | undefined,
  } = $props();

  const quality = getSceneQuality();
  const pixelRatio = Math.min(window.devicePixelRatio, quality.maxDpr);
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  let time = 0;

  // These props are immutable for the lifetime of a mount — the scene is
  // remounted per journey leg — so capture them once for the imperative
  // scene-graph build below.
  const sys: StarSystemData = untrack(() => system);
  const entryMode = untrack(() => entry);
  const savedView = flightMemory.system?.seed === sys.seed ? flightMemory.system : undefined;
  time = savedView?.time ?? 0;
  function saveView(cam: PerspectiveCamera) {
    flightMemory.system = {
      seed: sys.seed,
      time,
      position: cam.position.toArray(),
      target: controls?.target.toArray() ?? [0, 0, 0],
      fov: cam.fov,
    };
  }
  onDestroy(() => {
    if (flightMemory.system?.seed === sys.seed) flightMemory.system.time = time;
  });

  const tmpVec = new Vector3();

  // ─── Camera framing derived from the system's size ─────────────────────
  const outermost = sys.planets[sys.planets.length - 1].orbitRadius;
  const systemFov = isMobile ? 56 : 40;
  const restDistance = Math.min(
    Math.max(outermost * (isMobile ? 3.35 : 1.5), isMobile ? 24 : 12),
    isMobile ? 92 : 44,
  );
  const restPosition = (() => {
    if (entryMode === 'fromPlanet' && savedView) return new Vector3(...savedView.position);
    const elevation = isMobile ? 0.58 : 0.42; // mobile needs a wider, more readable overview
    const azimuth = -0.6;
    return new Vector3(
      restDistance * Math.cos(elevation) * Math.sin(azimuth),
      restDistance * Math.sin(elevation),
      restDistance * Math.cos(elevation) * Math.cos(azimuth),
    );
  })();

  // ─── Scene graph (imperative — dynamic per-system structure) ───────────
  const root = new Group();
  const disposables: { dispose: () => void }[] = [];

  function track<T extends { dispose: () => void }>(resource: T): T {
    disposables.push(resource);
    return resource;
  }

  const starSeed = (sys.seed % 977) * 0.173;

  const starMaterial = track(
    new ShaderMaterial({
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      uniforms: {
        uColor: { value: new Color(sys.starColor) },
        uTime: { value: 0 },
        uSeed: { value: starSeed },
      },
    }),
  );
  const starMesh = new Mesh(
    track(new SphereGeometry(sys.starRadius, quality.bodySegments, 24)),
    starMaterial,
  );
  root.add(starMesh);

  const coronaMaterial = track(
    new ShaderMaterial({
      vertexShader: coronaVertexShader,
      fragmentShader: coronaFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uColor: { value: new Color(sys.starColor) },
        uTime: { value: 0 },
        uSeed: { value: starSeed },
      },
    }),
  );
  const coronaMesh = new Mesh(track(new PlaneGeometry(1, 1)), coronaMaterial);
  coronaMesh.scale.setScalar(sys.starRadius * 7);
  coronaMesh.renderOrder = 2;
  root.add(coronaMesh);

  // Shared unit sphere for planets and moons (scaled per body).
  const bodyGeometry = track(new SphereGeometry(1, quality.bodySegments, 20));

  interface MoonRecord {
    data: MoonData;
    mesh: Mesh;
    material: ShaderMaterial;
  }

  interface PlanetRecord {
    data: PlanetData;
    index: number;
    group: Group; // moves along the orbit
    mesh: Mesh;
    material: ShaderMaterial;
    moons: MoonRecord[];
    spinSpeed: number;
  }

  function createBodyMaterial(
    colorA: number,
    colorB: number,
    colorC: number,
    atmosphere: number,
    seed: number,
    opts: { noiseScale: number; band: number; cloudiness: number; emissive: number },
  ): ShaderMaterial {
    return track(
      new ShaderMaterial({
        vertexShader: planetVertexShader,
        fragmentShader: planetFragmentShader,
        uniforms: {
          uColorA: { value: new Color(colorA) },
          uColorB: { value: new Color(colorB) },
          uColorC: { value: new Color(colorC) },
          uAtmosphere: { value: new Color(atmosphere) },
          uLightDir: { value: new Vector3(0, 0, 1) },
          uLightColor: { value: new Color(sys.starLightColor) },
          uTime: { value: 0 },
          uSeed: { value: seed },
          uNoiseScale: { value: opts.noiseScale },
          uBand: { value: opts.band },
          uCloudiness: { value: opts.cloudiness },
          uEmissive: { value: opts.emissive },
        },
      }),
    );
  }

  const orbitLineMaterial = track(
    new LineBasicMaterial({ color: 0xaab4cc, transparent: true, opacity: 0.14 }),
  );

  function createOrbitLine(radius: number): LineLoop {
    const segments = 128;
    const positions = new Float32Array(segments * 3);
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const geometry = track(new BufferGeometry());
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    return new LineLoop(geometry, orbitLineMaterial);
  }

  const planetRecords: PlanetRecord[] = sys.planets.map((planet, index) => {
    const orbitGroup = new Group();
    orbitGroup.rotation.x = planet.inclination;
    root.add(orbitGroup);

    orbitGroup.add(createOrbitLine(planet.orbitRadius));

    const group = new Group();
    orbitGroup.add(group);

    const seedRng = mulberry32(planet.seed);
    const material = createBodyMaterial(
      planet.colorA,
      planet.colorB,
      planet.colorC,
      planet.atmosphereColor,
      (planet.seed % 883) * 0.211,
      {
        noiseScale: planet.archetype === 'gas' ? 1.9 : 2.7,
        band: planet.bandAmount,
        cloudiness: planet.cloudiness,
        emissive: planet.emissive,
      },
    );
    const mesh = new Mesh(bodyGeometry, material);
    mesh.scale.setScalar(planet.radius);
    group.add(mesh);

    if (planet.rings) {
      const ringGeometry = track(
        new RingGeometry(planet.rings.innerRadius, planet.rings.outerRadius, 96),
      );
      const ringMaterial = track(
        new ShaderMaterial({
          vertexShader: ringVertexShader,
          fragmentShader: ringFragmentShader,
          transparent: true,
          depthWrite: false,
          side: DoubleSide,
          uniforms: {
            uColor: { value: new Color(planet.rings.color) },
            uOpacity: { value: planet.rings.opacity },
            uInner: { value: planet.rings.innerRadius },
            uOuter: { value: planet.rings.outerRadius },
            uSeed: { value: seedRng() * 10 },
          },
        }),
      );
      const ringMesh = new Mesh(ringGeometry, ringMaterial);
      ringMesh.rotation.x = -Math.PI / 2 + 0.32 + planet.inclination * 2;
      group.add(ringMesh);
    }

    const moons: MoonRecord[] = planet.moons.map((moon) => {
      const moonMaterial = createBodyMaterial(
        moon.color,
        0x55504a,
        0xc4beb2,
        0x000000,
        (planet.seed % 719) * 0.31 + moon.orbitRadius,
        { noiseScale: 3.4, band: 0, cloudiness: 0, emissive: 0 },
      );
      const moonMesh = new Mesh(bodyGeometry, moonMaterial);
      moonMesh.scale.setScalar(moon.size);
      group.add(moonMesh);
      return { data: moon, mesh: moonMesh, material: moonMaterial };
    });

    return {
      data: planet,
      index,
      group,
      mesh,
      material,
      moons,
      spinSpeed: 0.05 + seedRng() * 0.16,
    };
  });

  function getPlanetWorldPosition(record: PlanetRecord, target: Vector3): Vector3 {
    record.mesh.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(record.mesh.matrixWorld);
  }

  // ─── Background starfield ──────────────────────────────────────────────
  const starfieldGeometry = track(new BufferGeometry());
  {
    const count = quality.stars;
    const rng = mulberry32(sys.seed * 31 + 7);
    const positions = new Float32Array(count * 3);
    const scalesArr = new Float32Array(count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Uniform direction on the sphere, pushed to a far shell.
      const u = rng() * 2 - 1;
      const theta = rng() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const radius = 240 + rng() * 160;
      positions[i * 3] = s * Math.cos(theta) * radius;
      positions[i * 3 + 1] = u * radius;
      positions[i * 3 + 2] = s * Math.sin(theta) * radius;
      scalesArr[i] = 0.5 + rng() * 1.3;
      seeds[i] = rng();
    }
    starfieldGeometry.setAttribute('position', new BufferAttribute(positions, 3));
    starfieldGeometry.setAttribute('aScale', new BufferAttribute(scalesArr, 1));
    starfieldGeometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
  }
  const starfieldMaterial = track(
    new ShaderMaterial({
      vertexShader: starfieldVertexShader,
      fragmentShader: starfieldFragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: pixelRatio },
        uWarm: { value: new Color(0xffead1) },
        uCool: { value: new Color(0xd2e5ff) },
        uAlpha: { value: 0.85 },
      },
    }),
  );

  onDestroy(() => {
    for (const resource of disposables) resource.dispose();
  });

  // ─── Renderer state ────────────────────────────────────────────────────
  $effect(() => {
    const isDark = themeStore.theme === 'dark';
    renderer.setClearColor(isDark ? 0x05060e : 0xf7f8fc, 1);

    orbitLineMaterial.color.set(isDark ? 0xaab4cc : 0x465064);
    orbitLineMaterial.opacity = isDark ? 0.14 : 0.2;

    (starfieldMaterial.uniforms.uWarm.value as Color).set(isDark ? 0xffead1 : 0x39445a);
    (starfieldMaterial.uniforms.uCool.value as Color).set(isDark ? 0xd2e5ff : 0x60708c);
    starfieldMaterial.uniforms.uAlpha.value = isDark ? 0.85 : 0.34;
    starfieldMaterial.blending = isDark ? AdditiveBlending : NormalBlending;
    starfieldMaterial.needsUpdate = true;

    // Additive corona glow vanishes on the light theme's paper background —
    // fall back to normal alpha blending there (straight-alpha shader).
    coronaMaterial.blending = isDark ? AdditiveBlending : NormalBlending;
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

  // ─── Entry: drop out of warp / pull back from a departed planet ────────
  const reduceMotion = prefersReducedMotion();
  let entryTweenActive = $state(entryMode !== 'return' && !reduceMotion);
  let entryDone = false;

  $effect(() => {
    if (entryDone || !warmup.ready) return;
    const cam = sceneCamera;
    const ctrl = controls;
    if (!cam || !ctrl) return;
    entryDone = true;
    let veilColor = sys.starColor;
    if (entryMode === 'warp' && !reduceMotion) {
      cam.position.copy(restPosition).multiplyScalar(3.4);
    } else if (entryMode === 'fromPlanet' && returnPlanetIndex != null && !reduceMotion) {
      const record = planetRecords[returnPlanetIndex];
      getPlanetWorldPosition(record, tmpVec);
      const away = restPosition.clone().sub(tmpVec).normalize();
      cam.position
        .copy(tmpVec)
        .addScaledVector(away, record.data.radius * 1.7)
        .add(new Vector3(0, record.data.radius * 0.55, 0));
      cam.lookAt(tmpVec);
      ctrl.target.copy(tmpVec);
      veilColor = record.data.surface.fogColor;
    } else {
      entryTweenActive = false;
      cam.position.copy(restPosition);
      ctrl.target.set(0, 0, 0);
      ctrl.update();
      return;
    }
    const flight = createCameraFlight(
      cam,
      ctrl,
      {
        position: restPosition.toArray(),
        target: entryMode === 'fromPlanet' ? (savedView?.target ?? [0, 0, 0]) : [0, 0, 0],
        fov: savedView?.fov ?? systemFov,
        arc: entryMode === 'fromPlanet' ? -0.08 : 0.06,
      },
      2.6,
      {
        onProgress: (p) => onVeil?.(1 - smoothstepJs(0.02, 0.2, p), veilColor),
        onComplete: () => {
          entryTweenActive = false;
          onArrived?.();
        },
      },
    );
    cameraFlight = flight;
    return () => {
      flight.cancel();
      if (cameraFlight === flight) cameraFlight = undefined;
    };
  });

  // Pull out on the same frame clock as rendering, without a final orbit clamp.
  $effect(() => {
    if (!departing || !warmup.ready) return;
    const cam = sceneCamera;
    if (!cam || reduceMotion) return;
    hoveredIndex = null;
    focusIndex = null;
    hideHud();
    saveView(cam);
    const end = cam.position
      .clone()
      .normalize()
      .multiplyScalar(Math.max(cam.position.length() * 3.2, restDistance * 3.6))
      .add(new Vector3(0, restDistance * 0.3, 0));
    const flight = createCameraFlight(
      cam,
      untrack(() => controls),
      {
        position: end.toArray(),
        target: [0, 0, 0],
        arc: 0.04,
        bank: 0.018,
      },
      2.8,
      {
        handoff: true,
        onProgress: (p) => onVeil?.(smoothstepJs(0.86, 1, p), sys.starColor),
        onComplete: onDeparted,
      },
    );
    cameraFlight = flight;
    return () => {
      flight.cancel();
      if (cameraFlight === flight) cameraFlight = undefined;
    };
  });

  // Freeze orbital translation while approaching; both sides of the scale change
  // meet at rest, with acceleration and deceleration instead of an abrupt kick.
  $effect(() => {
    if (approachPlanetIndex == null || !warmup.ready) return;
    const record = planetRecords[approachPlanetIndex];
    const cam = sceneCamera;
    if (!record || !cam) return;
    hoveredIndex = null;
    focusIndex = null;
    hideHud();
    saveView(cam);
    getPlanetWorldPosition(record, tmpVec);
    const target = tmpVec.clone();
    const end = cam.position
      .clone()
      .sub(target)
      .normalize()
      .multiplyScalar(record.data.radius * 1.035)
      .add(target)
      .add(new Vector3(0, record.data.radius * 0.12, 0));
    const flight = createCameraFlight(
      cam,
      untrack(() => controls),
      {
        position: end.toArray(),
        target: target.toArray(),
        fov: 60,
        arc: 0.1,
        bank: -0.025,
      },
      3.1,
      {
        handoff: true,
        onProgress: (p) => onVeil?.(smoothstepJs(0.86, 1, p), record.data.surface.fogColor),
        onComplete: onDeparted,
      },
    );
    cameraFlight = flight;
    return () => {
      flight.cancel();
      if (cameraFlight === flight) cameraFlight = undefined;
    };
  });

  function updateCameraFocus(delta: number) {
    const ctrl = controls;
    if (!ctrl || !ctrl.enabled || approachPlanetIndex != null || entryTweenActive || departing)
      return;

    const record = focusIndex != null ? planetRecords[focusIndex] : undefined;
    if (record && interactive) {
      getPlanetWorldPosition(record, focusTarget);
    } else {
      focusTarget.set(0, 0, 0);
    }

    const followSpeed = record ? 5.2 : 2.8;
    ctrl.target.lerp(focusTarget, Math.min(1, delta * followSpeed));
    ctrl.update();
  }

  // ─── Per-frame updates ─────────────────────────────────────────────────
  function updateOrbits(delta: number) {
    for (const record of planetRecords) {
      const { data } = record;
      const angle = data.phase + time * data.orbitSpeed;
      record.group.position.set(
        Math.cos(angle) * data.orbitRadius,
        0,
        Math.sin(angle) * data.orbitRadius,
      );
      record.mesh.rotation.y += delta * record.spinSpeed;
      record.material.uniforms.uTime.value = time;

      // Star sits at the origin — light direction is simply -position.
      getPlanetWorldPosition(record, tmpVec);
      (record.material.uniforms.uLightDir.value as Vector3).copy(tmpVec).negate().normalize();

      for (const moon of record.moons) {
        const m = moon.data;
        const moonAngle = m.phase + time * m.orbitSpeed;
        moon.mesh.position.set(
          Math.cos(moonAngle) * m.orbitRadius,
          Math.sin(moonAngle) * Math.sin(m.inclination) * m.orbitRadius,
          Math.sin(moonAngle) * Math.cos(m.inclination) * m.orbitRadius,
        );
        moon.mesh.rotation.y += delta * 0.1;
        (moon.material.uniforms.uLightDir.value as Vector3).copy(
          record.material.uniforms.uLightDir.value as Vector3,
        );
      }
    }
  }

  // Position everything once at t=0 — the 'fromPlanet' entry reads planet
  // world positions before the first task frame runs.
  updateOrbits(0);
  root.updateMatrixWorld(true);

  const { start, stop } = useTask(
    (delta) => {
      const dt = Math.min(delta, 0.05);
      if (worldActive) time += dt;
      starfieldMaterial.uniforms.uPixelRatio.value = dpr.current;
      starMaterial.uniforms.uTime.value = time;
      coronaMaterial.uniforms.uTime.value = time;
      starfieldMaterial.uniforms.uTime.value = time;

      const cam = sceneCamera;
      if (cam) coronaMesh.quaternion.copy(cam.quaternion);

      updateOrbits(worldActive ? dt : 0);
      updateCameraFocus(dt);
      cameraFlight?.advance(dt);
      updateHudPosition();
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

  // ─── Hover + click (planets) ───────────────────────────────────────────
  let hoveredIndex = $state<number | null>(null);
  let touchPreviewIndex = $state<number | null>(null);
  let focusIndex = $state<number | null>(null);
  let downX = 0;
  let downY = 0;
  let downCandidate: number | null = null;
  const focusTarget = new Vector3();

  const interactive = $derived(approachPlanetIndex == null && !departing);
  const canvasEl = renderer.domElement;

  function ndcFromEvent(e: { clientX: number; clientY: number }, rect: DOMRect) {
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -(((e.clientY - rect.top) / rect.height) * 2 - 1),
    };
  }

  function findHoveredPlanet(ndcX: number, ndcY: number): number | null {
    const cam = sceneCamera;
    if (!cam) return null;
    let best: number | null = null;
    let bestDist = 1;
    for (const record of planetRecords) {
      getPlanetWorldPosition(record, tmpVec);
      const distance = Math.max(cam.position.distanceTo(tmpVec), record.data.radius);
      const screenRadius =
        (record.data.radius * cam.projectionMatrix.elements[5] * canvasEl.clientHeight) /
        (2 * distance);
      tmpVec.project(cam);
      if (tmpVec.z < -1 || tmpVec.z > 1) continue;
      // Match the visible sphere and keep small planets at least a finger wide.
      // Pixel distances also avoid stretched hit areas in portrait viewports.
      const radius = Math.max(isMobile ? 24 : 16, screenRadius * 1.1);
      const d =
        Math.hypot(
          ((tmpVec.x - ndcX) * canvasEl.clientWidth) / 2,
          ((tmpVec.y - ndcY) * canvasEl.clientHeight) / 2,
        ) / radius;
      if (d < bestDist) {
        bestDist = d;
        best = record.index;
      }
    }
    return best;
  }

  function onPointerMove(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    if (!interactive || entryTweenActive) {
      hoveredIndex = null;
      touchPreviewIndex = null;
      focusIndex = null;
      canvasEl.style.cursor = '';
      return;
    }
    const { x, y } = ndcFromEvent(e, canvasEl.getBoundingClientRect());
    hoveredIndex = findHoveredPlanet(x, y);
    touchPreviewIndex = null;
    focusIndex = null;
    canvasEl.style.cursor = hoveredIndex != null ? 'pointer' : '';
    updateHudPosition();
  }

  function onPointerDown(e: PointerEvent) {
    downX = e.clientX;
    downY = e.clientY;
    if (!interactive || entryTweenActive) {
      downCandidate = null;
      return;
    }
    const { x, y } = ndcFromEvent(e, canvasEl.getBoundingClientRect());
    downCandidate = findHoveredPlanet(x, y);
  }

  function onWindowPointerUp(e: PointerEvent) {
    const candidate = downCandidate;
    downCandidate = null;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
    if (e.pointerType === 'touch') {
      if (candidate == null) {
        hoveredIndex = null;
        touchPreviewIndex = null;
        focusIndex = null;
        hideHud();
        return;
      }
      if (touchPreviewIndex !== candidate) {
        hoveredIndex = candidate;
        touchPreviewIndex = candidate;
        focusIndex = candidate;
        updateCameraFocus(1 / 30);
        updateHudPosition();
        return;
      }
    }
    if (candidate == null || !interactive) return;
    onSelectPlanet?.(candidate);
  }

  function onPointerLeave(e: PointerEvent) {
    if (e.pointerType === 'touch') return;
    hoveredIndex = null;
    touchPreviewIndex = null;
    focusIndex = null;
    canvasEl.style.cursor = '';
  }

  $effect(() => {
    const previousTouchAction = canvasEl.style.touchAction;
    canvasEl.style.touchAction = 'none';
    canvasEl.addEventListener('pointermove', onPointerMove);
    canvasEl.addEventListener('pointerdown', onPointerDown);
    canvasEl.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('pointerup', onWindowPointerUp);
    return () => {
      canvasEl.removeEventListener('pointermove', onPointerMove);
      canvasEl.removeEventListener('pointerdown', onPointerDown);
      canvasEl.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('pointerup', onWindowPointerUp);
      canvasEl.style.touchAction = previousTouchAction;
      canvasEl.style.cursor = '';
    };
  });

  $effect(() => {
    const ctrl = controls;
    if (!ctrl) return;
    const onChange = () => updateHudPosition();
    ctrl.addEventListener('change', onChange);
    return () => ctrl.removeEventListener('change', onChange);
  });

  $effect(() => {
    if (hoveredIndex == null || !interactive) {
      hideHud();
      return;
    }
    const index = hoveredIndex;
    const planet = sys.planets[index];
    const moonCount = planet.moons.length;
    const moonsLabel =
      moonCount === 0 ? 'no moons' : moonCount === 1 ? '1 moon' : `${moonCount} moons`;
    showHud({
      title: planet.name,
      subtitle: `${planet.archetypeLabel} · ${planet.surface.biomes.length} biomes · ${moonsLabel}`,
      hint: 'Land',
      onDark: themeStore.theme === 'dark',
      onActivate: () => onSelectPlanet?.(index),
    });
  });

  function updateHudPosition() {
    if (hoveredIndex == null) return;
    const cam = sceneCamera;
    const record = planetRecords[hoveredIndex];
    if (!cam || !record) return;
    getPlanetWorldPosition(record, tmpVec);
    tmpVec.project(cam);
    const x = (tmpVec.x * 0.5 + 0.5) * canvasEl.clientWidth;
    const y = (-tmpVec.y * 0.5 + 0.5) * canvasEl.clientHeight;
    setHudScreenPosition(x, y);
  }
</script>

<T.PerspectiveCamera
  bind:ref={sceneCamera}
  makeDefault
  position={restPosition.toArray()}
  fov={systemFov}
  near={0.05}
>
  <OrbitControls
    bind:ref={controls}
    enabled={animationActive &&
      warmup.ready &&
      !entryTweenActive &&
      approachPlanetIndex == null &&
      !departing}
    enableDamping={animationActive &&
      warmup.ready &&
      !entryTweenActive &&
      approachPlanetIndex == null &&
      !departing}
    enablePan={false}
    rotateSpeed={isMobile ? 0.45 : 0.65}
    zoomSpeed={0.7}
    minDistance={isMobile ? sys.starRadius * 3.2 : sys.starRadius * 2.4}
    maxDistance={restDistance * (isMobile ? 1.45 : 2.4)}
    minPolarAngle={0.22}
    maxPolarAngle={Math.PI * 0.68}
  />
</T.PerspectiveCamera>

<T is={root} />

<T.Points frustumCulled={false}>
  <T is={starfieldGeometry} />
  <T is={starfieldMaterial} />
</T.Points>
