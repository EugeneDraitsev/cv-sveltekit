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
    Quaternion,
    Matrix4,
    NormalBlending,
  } from 'three';
  import type { PerspectiveCamera } from 'three';
  import type { OrbitControls as ThreeOrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
  import { onDestroy, untrack } from 'svelte';
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
    tweenCamera,
    easeInCubic,
    easeOutCubic,
    easeInOutCubic,
    prefersReducedMotion,
    smoothstepJs,
  } from './cameraTween';
  import { lightenHex } from './starSystem';
  import themeStore from '$lib/stores/theme.svelte';

  const { renderer } = useThrelte();
  const cameraCtx = useThrelte().camera;

  // Our own OrbitControls instance via bind:ref. Deliberately NOT the
  // useOrbitControls() registry: when the galaxy scene swaps out, its
  // OrbitControls' unregister runs after ours registers and wipes the shared
  // store — leaving the registry empty for this scene's whole lifetime. That
  // let Threlte's per-frame controls.update() force lookAt(star) and hijack
  // the first planet approach.
  let controls = $state<ThreeOrbitControls>();

  const {
    animationActive = false,
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
    onVeil = undefined as ((opacity: number, colorHex: number) => void) | undefined,
    onSelectPlanet = undefined as ((index: number) => void) | undefined,
  } = $props();

  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  let time = 0;

  // These props are immutable for the lifetime of a mount — the scene is
  // remounted per journey leg — so capture them once for the imperative
  // scene-graph build below.
  const sys: StarSystemData = untrack(() => system);
  const entryMode = untrack(() => entry);

  const tmpVec = new Vector3();
  const tmpUp = new Vector3();

  // ─── Camera framing derived from the system's size ─────────────────────
  const outermost = sys.planets[sys.planets.length - 1].orbitRadius;
  const systemFov = isMobile ? 56 : 40;
  const restDistance = Math.min(
    Math.max(outermost * (isMobile ? 3.35 : 1.5), isMobile ? 24 : 12),
    isMobile ? 92 : 44,
  );
  const restPosition = (() => {
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
  const starMesh = new Mesh(track(new SphereGeometry(sys.starRadius, 48, 32)), starMaterial);
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
  const bodyGeometry = track(new SphereGeometry(1, 40, 24));

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
    const count = 1600;
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
    renderer.setPixelRatio(pixelRatio);

    orbitLineMaterial.color.set(isDark ? 0xaab4cc : 0x465064);
    orbitLineMaterial.opacity = isDark ? 0.14 : 0.2;

    (starfieldMaterial.uniforms.uWarm.value as Color).set(isDark ? 0xffead1 : 0x39445a);
    (starfieldMaterial.uniforms.uCool.value as Color).set(isDark ? 0xd2e5ff : 0x60708c);
    starfieldMaterial.uniforms.uAlpha.value = isDark ? 0.85 : 0.34;
    starfieldMaterial.blending = isDark ? AdditiveBlending : NormalBlending;
    starfieldMaterial.needsUpdate = true;
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
  let entryTweenActive = entryMode !== 'return' && !reduceMotion;
  let entryDone = false;

  /** Dissolve the transition veil on an rAF clock, matched to the entry move. */
  function dissolveVeil(colorHex: number, durationMs: number): () => void {
    const t0 = performance.now();
    let raf: number | undefined;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      onVeil?.(1 - easeOutCubic(p), colorHex);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      if (raf !== undefined) cancelAnimationFrame(raf);
    };
  }

  $effect(() => {
    if (entryDone) return;
    const cam = cameraCtx.current as PerspectiveCamera | undefined;
    if (!cam) return;
    entryDone = true;
    const ctrl = untrack(() => controls);

    if (entryMode === 'warp' && !reduceMotion) {
      cam.position.copy(restPosition).multiplyScalar(2.7);
      const cancel = tweenCamera(
        cam,
        ctrl,
        {
          position: restPosition.toArray() as [number, number, number],
          target: [0, 0, 0],
        },
        1700,
        () => (entryTweenActive = false),
        easeOutCubic,
      );
      const stopVeil = dissolveVeil(sys.starColor, 750);
      return () => {
        cancel();
        stopVeil();
      };
    }

    if (entryMode === 'fromPlanet' && returnPlanetIndex != null && !reduceMotion) {
      const record = planetRecords[returnPlanetIndex];
      if (record) {
        // Start right off the planet we just left, LOOKING AT IT — it fills
        // the frame exactly like the climb-out did — then pull back to the
        // rest framing while the view pans from the planet to the star.
        getPlanetWorldPosition(record, tmpVec);
        const away = restPosition.clone().sub(tmpVec).normalize();
        cam.position
          .copy(tmpVec)
          .addScaledVector(away, record.data.radius * 1.7)
          .add(new Vector3(0, record.data.radius * 0.55, 0));
        cam.lookAt(tmpVec);
        // Seed the tween's look-target with the planet so the camera starts
        // on it and glides toward the star — not the other way around.
        if (ctrl) ctrl.target.copy(tmpVec);
        const cancel = tweenCamera(
          cam,
          ctrl,
          {
            position: restPosition.toArray() as [number, number, number],
            target: [0, 0, 0],
          },
          1500,
          () => (entryTweenActive = false),
          easeInOutCubic,
        );
        const stopVeil = dissolveVeil(record.data.surface.fogColor, 800);
        return () => {
          cancel();
          stopVeil();
        };
      }
    }

    entryTweenActive = false;
    cam.position.copy(restPosition);
    if (ctrl) {
      ctrl.target.set(0, 0, 0);
      ctrl.update();
    }
  });

  // ─── Departure: accelerate AWAY from the system (back to the galaxy) ───
  // The system shrinks behind us as we pull out; a star-tinted veil saturates
  // only at the acceleration peak, and the galaxy side continues the same
  // outward motion from the star — one continuous zoom-out.
  $effect(() => {
    if (!departing) return;
    const cam = cameraCtx.current as PerspectiveCamera | undefined;
    if (!cam || reduceMotion) return;

    hoveredIndex = null;
    focusIndex = null;
    hideHud();

    const DEPART_MS = 950;
    const end = cam.position
      .clone()
      .normalize()
      .multiplyScalar(restDistance * 3.6)
      .add(new Vector3(0, restDistance * 0.55, 0));
    const cancel = tweenCamera(
      cam,
      untrack(() => controls),
      {
        position: end.toArray() as [number, number, number],
        target: [0, 0, 0],
      },
      DEPART_MS,
      undefined,
      easeInCubic,
    );

    // Veil tied to the recede progress — flashes at peak velocity.
    const veilColor = lightenHex(sys.starColor, 0.15);
    const t0 = performance.now();
    let raf: number | undefined;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / DEPART_MS);
      onVeil?.(smoothstepJs(0.62, 0.96, p), veilColor);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancel();
      if (raf !== undefined) cancelAnimationFrame(raf);
    };
  });

  // ─── Approach: glide toward a clicked planet ───────────────────────────
  // Follows the live (still orbiting) planet each frame, so it can't be a
  // fixed-endpoint tween; runs inside useTask instead.
  interface ApproachState {
    record: PlanetRecord;
    fromPosition: Vector3;
    fromQuaternion: Quaternion;
    side: Vector3;
    startDistance: number;
    startTime: number;
    duration: number;
  }
  let approach: ApproachState | null = null;
  let restoreControls: (() => void) | undefined;

  $effect(() => {
    if (approachPlanetIndex == null) return;
    const record = planetRecords[approachPlanetIndex];
    const cam = cameraCtx.current as PerspectiveCamera | undefined;
    if (!record || !cam) return;

    hoveredIndex = null;
    focusIndex = null;
    hideHud();

    // Silence OrbitControls for the glide: Threlte calls update() every frame
    // while damping is on, and update() forces lookAt(target) — which would
    // pin the view to the star instead of the planet we are flying to.
    const ctrl = untrack(() => controls);
    if (ctrl) {
      const originalUpdate = ctrl.update.bind(ctrl);
      ctrl.enabled = false;
      ctrl.update = (() => true) as typeof ctrl.update;
      restoreControls = () => {
        ctrl.update = originalUpdate;
        ctrl.enabled = true;
        restoreControls = undefined;
      };
    }

    getPlanetWorldPosition(record, tmpVec);
    const side = new Vector3()
      .subVectors(tmpVec, cam.position)
      .cross(new Vector3(0, 1, 0))
      .normalize();

    approach = {
      record,
      fromPosition: cam.position.clone(),
      fromQuaternion: cam.quaternion.clone(),
      side,
      startDistance: cam.position.distanceTo(tmpVec),
      startTime: time,
      duration: 1.8,
    };

    return () => {
      approach = null;
      restoreControls?.();
    };
  });

  const approachTarget = new Vector3();
  const approachOffset = new Vector3();
  const approachPos = new Vector3();
  const approachLookMatrix = new Matrix4();
  const approachLookQuat = new Quaternion();

  function updateCameraFocus(delta: number) {
    const ctrl = controls;
    if (!ctrl || !ctrl.enabled || approach || entryTweenActive || departing) return;

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

  function updateApproach() {
    if (!approach) return;
    const cam = cameraCtx.current as PerspectiveCamera | undefined;
    if (!cam) return;
    const { record, fromPosition, fromQuaternion, side, startDistance, startTime, duration } =
      approach;
    const t = Math.min((time - startTime) / duration, 1);
    const e = easeInOutCubic(t);

    getPlanetWorldPosition(record, approachTarget);
    // Fly in until the planet fills the frame, then keep plunging until we
    // skim the surface. The last stretch drives the transition veil toward
    // the planet's surface fog color — the same color the flyover scene's
    // haze starts from — so the cut is two identical frames: a real
    // atmospheric entry, not a curtain.
    approachOffset.copy(fromPosition).sub(approachTarget).normalize();
    approachPos
      .copy(approachTarget)
      .addScaledVector(approachOffset, record.data.radius * 1.02)
      .add(tmpUp.set(0, record.data.radius * 0.16, 0));

    // Gentle arc instead of a straight rail.
    cam.position
      .lerpVectors(fromPosition, approachPos, e)
      .addScaledVector(side, Math.sin(Math.PI * e) * startDistance * 0.12);

    // Bank the view onto the target over the first stretch instead of
    // snapping lookAt on the click frame.
    approachLookMatrix.lookAt(cam.position, approachTarget, tmpUp.set(0, 1, 0));
    approachLookQuat.setFromRotationMatrix(approachLookMatrix);
    cam.quaternion.copy(fromQuaternion).slerp(approachLookQuat, smoothstepJs(0, 0.42, t));

    onVeil?.(smoothstepJs(0.66, 0.97, t), record.data.surface.fogColor);
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
      time += delta;
      starMaterial.uniforms.uTime.value = time;
      coronaMaterial.uniforms.uTime.value = time;
      starfieldMaterial.uniforms.uTime.value = time;

      const cam = cameraCtx.current as PerspectiveCamera | undefined;
      if (cam) coronaMesh.quaternion.copy(cam.quaternion);

      updateOrbits(delta);
      updateCameraFocus(delta);
      updateApproach();
      updateHudPosition();
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
    const cam = cameraCtx.current as PerspectiveCamera | undefined;
    if (!cam) return null;
    let best: number | null = null;
    let bestDist = 0.11;
    for (const record of planetRecords) {
      getPlanetWorldPosition(record, tmpVec);
      tmpVec.project(cam);
      if (tmpVec.z < -1 || tmpVec.z > 1) continue;
      const d = Math.hypot(tmpVec.x - ndcX, tmpVec.y - ndcY);
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
      subtitle: `${planet.archetypeLabel} · ${moonsLabel}`,
      hint: 'Land',
      onDark: themeStore.theme === 'dark',
      onActivate: () => onSelectPlanet?.(index),
    });
  });

  function updateHudPosition() {
    if (hoveredIndex == null) return;
    const cam = cameraCtx.current as PerspectiveCamera | undefined;
    const record = planetRecords[hoveredIndex];
    if (!cam || !record) return;
    getPlanetWorldPosition(record, tmpVec);
    tmpVec.project(cam);
    const x = (tmpVec.x * 0.5 + 0.5) * canvasEl.clientWidth;
    const y = (-tmpVec.y * 0.5 + 0.5) * canvasEl.clientHeight;
    setHudScreenPosition(x, y);
  }
</script>

<T.PerspectiveCamera makeDefault position={restPosition.toArray()} fov={systemFov} near={0.05}>
  <OrbitControls
    bind:ref={controls}
    enableDamping
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
