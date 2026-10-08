import type { Backend } from '../gpu/backend';
import { BlockData } from '../gpu/blocks';
import { WebGlBackend } from '../gpu/webgl';
import { GalaxyBlock, PlanetBlock, PostBlock, SystemBlock } from './blocks';
import { OrbitRig, flightPose, orbitPose, poseBasis, type Pose } from './camera';
import {
  add,
  clamp,
  damp,
  dot,
  length,
  lerp,
  normalize,
  scale,
  smoothstep,
  sub,
  type Vec3,
} from './math';
import {
  DEFAULT_SETTINGS,
  type FromEngine,
  type HudInfo,
  type Mode,
  type Settings,
  type ToEngine,
  type TouchFlight,
} from './protocol';
import { pickQuality, renderSize, withPreset, type DeviceHints, type Quality } from './quality';
import { Renderer } from './renderer';
import { SystemState, fromBody, toBody, type Orientation, type PlanetState } from './systemState';
import {
  LANDING_EYE_HEIGHT,
  PlanetRig,
  ascentPose,
  chooseLandingSite,
  emptyInput,
  planetFlightPose,
} from './planetRig';
import { GALAXY_SITES, siteWorld, type GalaxySystemSite } from '../world/galaxyMap';
import { getSystem, type StarSystemData } from '../world/system';
import { packSystem } from '../world/pack';
import { kelvinRgb } from '../world/color';
import { terrainHeight } from '../world/terrain';

type Post = (message: FromEngine) => void;
type Frame = 'G' | 'S' | 'P';

/**
 * The page colour (--color-base-100), which space's black is lifted to so the
 * hero has no seam against the page.
 */
const PAGE: [number, number, number] = [0.0706, 0.0706, 0.0706];

/**
 * Light a star casts, in renderer units. Red dwarfs are lifted toward the
 * brightness of yellow stars so their worlds stay readable, only redder.
 */
function starLight(star: { color: [number, number, number]; luminosity: number }, gain = 1): Vec3 {
  const [r, g, b] = star.color;
  const k =
    star.luminosity *
    gain *
    Math.pow(0.8 / Math.max(0.5, 0.2126 * r + 0.7152 * g + 0.0722 * b), 0.7);
  return [r * k, g * k, b * k];
}
/** Galaxy units out to where the disk's glow fades (its sites reach ~13). */
const GALAXY_DISK_RADIUS = 13;
const FLIGHT_SECONDS = 3.2;
/**
 * Turn rates per unit of the rotation setting (radians a second): the disk,
 * and the deep sky behind it at under half that, so the two drift apart.
 */
const GALAXY_TURN = 0.026;
const SKY_TURN = 0.012;
/** From a planet's orbit out to the whole system: a ~25× change of scale. */
const ORBIT_EXIT_SECONDS = 3.6;
const LANDING_SECONDS = 5.6;
/** A body-frame pose in planet-centred axes that do not spin. */
const poseFromBody = (o: Orientation, p: Pose): Pose => ({
  eye: fromBody(o, p.eye),
  forward: fromBody(o, p.forward),
  up: fromBody(o, p.up),
  fov: p.fov,
});

/** The inverse of poseFromBody. */
const poseToBody = (o: Orientation, p: Pose): Pose => ({
  eye: toBody(o, p.eye),
  forward: toBody(o, p.forward),
  up: toBody(o, p.up),
  fov: p.fov,
});

const ASCENT_SECONDS = 6.4;

/** Altitudes (radii) between which the surface and orbital renderers cross-fade. */
const HANDOFF_LOW = 0.08;
const HANDOFF_HIGH = 0.3;

/** 1 near the ground, 0 from about one radius up: how much to use surface tuning. */
const surfaceness = (altitude: number) => 1 - smoothstep(0.04, 1.2, altitude);
/** Orbit distance after a take-off, in planet radii. */
const ASCENT_RADII = 4.8;
const WATER_KIND = { none: 0, water: 1, lava: 2, ice: 3, acid: 4 } as const;
/** Galaxy units per system unit (a site's marker matches its sun's size). */
const systemScale = (system: StarSystemData) => 0.024 / system.stars[0].radius;

interface Flight {
  frame: Frame;
  from: Pose;
  to: Pose;
  path: (t: number) => Pose;
  elapsed: number;
  duration: number;
  label: string;
  done: () => void;
}

/** Everything that runs off the main thread: input, cameras, journeys and GPU. */
export class Engine {
  private backend!: Backend;
  private renderer!: Renderer;
  /** False until init has a working renderer. */
  private running = false;
  private quality!: Quality;
  /** What the device pick chose; the Tune panel preset applies on top. */
  private deviceQuality!: Quality;
  private hints!: DeviceHints;
  private cssWidth = 1;
  private cssHeight = 1;
  private dpr = 1;
  private adaptive = 1;
  private reducedMotion = false;
  private visible = true;
  private playing = true;
  private settings: Settings = { ...DEFAULT_SETTINGS };
  private raf = 0;
  private last = 0;
  private time = 0;
  private systemTime = 0;
  private angle = 0;
  /** The deep sky's turn about its tilted axis (radians). */
  private skyAngle = 0;
  /**
   * Clock of the sky's shimmer and cloud flow. Unlike `time`, which a planet's
   * surface keeps running, it stops with playback (and so for reduced motion).
   */
  private skyTime = 0;
  /** The galaxy camera's idle float: its own clock, and how much of it shows (0..1). */
  private floatTime = 0;
  private floatWeight = 0;
  private timeLapse = false;
  /** The planet surface pipelines could not be built on this GPU. */
  private surfaceFailed = false;
  /** Bumped by every planet chosen while its shaders compile: the last wins. */
  private planetRequest = 0;
  /** A one-off frame is owed (settings, resize) while nothing animates. */
  private redraw = false;
  private disposed = false;
  /** Delayed compile of the planet pipelines; cancelled on dispose. */
  private warmUp: ReturnType<typeof setTimeout> | undefined;
  private surfaceBudgetUntil = 0;
  /** Orbit-line opacity, eased toward its target instead of switching. */
  private orbitInk = 0;
  private sunSample: { time: number; sun: Vec3; rising: boolean } = {
    time: -1,
    sun: [0, 1, 0],
    rising: true,
  };
  private sentFirstFrame = false;
  private lastInteraction = 0;
  private nextFrameAt = 0;
  private fpsFrames = 0;
  private fpsTime = 0;
  private slowSeconds = 0;

  // Journey state.
  private mode: Mode = 'galaxy';
  private flight: Flight | null = null;
  private site: GalaxySystemSite | null = null;
  private system: StarSystemData | null = null;
  private state: SystemState | null = null;
  private k = 0.01;
  private galaxyReturn: Pose | null = null;
  private planetIndex = -1;
  private rig: PlanetRig | null = null;
  /** Test hook: the next journey completes immediately. */
  private instant = false;

  // Cameras.
  private galaxyRig = new OrbitRig();
  private systemRig = new OrbitRig();
  private camera: { frame: Frame; pose: Pose } = {
    frame: 'G',
    pose: { eye: [0, 0, 30], forward: [0, 0, -1], up: [0, 1, 0], fov: 38 },
  };

  // Input.
  private pointers = new Map<number, { x: number; y: number; type: string }>();
  private dragDistance = 0;
  private pinchStart = 0;
  private hoverPointer: { x: number; y: number } | null = null;
  private hover: { kind: 'site' | 'planet'; index: number } | null = null;
  private armed: { kind: string; index: number } | null = null;
  private keys = new Set<string>();
  private look = [0, 0];
  private touch: TouchFlight = { stick: [0, 0], up: false, down: false, boost: false };
  private jumpQueued = false;
  private lastHud = '';
  private cursor = '';
  private lastState = '';
  private lastInstrument = 0;

  // GPU-facing data.
  private galaxyData = new BlockData(GalaxyBlock);
  private systemData = new BlockData(SystemBlock);
  private planetData = new BlockData(PlanetBlock);
  private postData = new BlockData(PostBlock);
  private markerData = new Float32Array(GALAXY_SITES.length * 12);

  constructor(private readonly post: Post) {
    this.galaxyRig.minDistance = 6;
    this.galaxyRig.maxDistance = 90;
    this.galaxyRig.set({ yaw: 0.55, pitch: 0.5, roll: 0.2, fov: 38, distance: 34 }, true);
  }

  async init(message: Extract<ToEngine, { type: 'init' }>) {
    this.hints = message.hints;
    this.reducedMotion = message.reducedMotion;
    this.playing = !message.reducedMotion;
    this.cssWidth = message.width;
    this.cssHeight = message.height;
    this.dpr = message.dpr;
    const onLost = (reason: string) => this.post({ type: 'error', message: reason });
    const progress = (value: number, label: string) =>
      this.post({ type: 'progress', value, label });
    // Shader compilation is most of the wait: it spans 30–90 %.
    const compiled = (fraction: number) => progress(0.3 + 0.6 * fraction, 'Compiling shaders');
    progress(0.15, 'Waking the GPU');
    let backend: Backend | null = null;
    let renderer: Renderer | null = null;
    let canvasTaken = false;
    if (message.renderer !== 'webgl' && 'gpu' in navigator) {
      try {
        const { WebGpuBackend } = await import('../gpu/webgpu');
        backend = await WebGpuBackend.create(message.canvas, onLost).catch((error: unknown) => {
          // create() may fail after binding the canvas (e.g. configure()).
          if (error instanceof Error && error.name === 'CanvasClaimedError') canvasTaken = true;
          throw error;
        });
        canvasTaken = true;
        this.deviceQuality = pickQuality({
          ...this.hints,
          software: backend.software || this.hints.software,
        });
        this.quality = withPreset(this.deviceQuality, this.settings.quality);
        renderer = new Renderer(backend, this.deviceQuality);
        progress(0.3, 'Compiling shaders');
        await renderer.init(compiled);
        if (this.abandoned(backend, renderer)) return;
      } catch (error) {
        if (this.abandoned(backend, renderer)) return;
        // Any WebGPU failure (adapter, shader validation) falls back to WebGL2.
        console.warn('WebGPU unavailable, using WebGL2', error);
        backend?.destroy();
        backend = null;
        renderer = null;
        if (canvasTaken) {
          // This canvas is WebGPU's for good; the host restarts on a new one.
          this.post({ type: 'error', message: String(error), retry: 'webgl' });
          return;
        }
      }
    }
    if (!backend || !renderer) {
      backend = WebGlBackend.create(message.canvas, onLost);
      this.deviceQuality = pickQuality({
        ...this.hints,
        software: backend.software || this.hints.software,
      });
      this.quality = withPreset(this.deviceQuality, this.settings.quality);
      renderer = new Renderer(backend, this.deviceQuality);
      progress(0.3, 'Compiling shaders');
      try {
        await renderer.init(compiled);
      } catch (error) {
        if (this.abandoned(backend, renderer)) return;
        // Nothing left to fall back to: free the context, pipelines and
        // targets built so far before the error is reported.
        renderer.destroy();
        throw error;
      }
      if (this.abandoned(backend, renderer)) return;
    }
    this.backend = backend;
    this.renderer = renderer;
    this.running = true;
    this.frameDisk();
    this.frameGalaxy(true);
    this.camera.pose = this.galaxyRig.pose();
    this.post({ type: 'ready', backend: backend.kind, info: backend.adapterInfo });
    this.post({ type: 'progress', value: 0.95, label: 'Lighting the stars' });
    this.publishState();
    this.renderFrame();
    this.schedule();
    // Planet shaders compile in the background, long before any landing.
    if (this.renderer.surfaceSupported) {
      this.warmUp = setTimeout(() => {
        if (this.disposed) return;
        this.renderer.ensurePlanet().catch((error: unknown) => {
          if (this.disposed) return;
          console.error('Planet renderer failed', error);
          this.surfaceFailed = true;
        });
      }, 1500);
    }
  }

  /** Pull the camera back on tall/narrow viewports so the whole disk fits. */
  private framingScale() {
    return (
      Math.max(1, (1.15 * this.cssHeight) / Math.max(1, this.cssWidth)) *
      (this.cssWidth < 700 ? 1.08 : 1)
    );
  }

  private frameGalaxy(snap = false) {
    this.galaxyRig.set({ distance: 34 * this.framingScale() }, snap);
  }

  /** Centre the galaxy by its outline, which perspective pulls low. */
  private frameDisk() {
    this.galaxyRig.disk = {
      radius: GALAXY_DISK_RADIUS,
      aspect: this.cssWidth / Math.max(1, this.cssHeight),
    };
  }

  handle(message: ToEngine) {
    // Nothing to drive if init handed the canvas back for a WebGL2 restart.
    if (!this.running) return;
    switch (message.type) {
      case 'resize':
        this.cssWidth = message.width;
        this.cssHeight = message.height;
        this.dpr = message.dpr;
        this.frameDisk();
        if (this.mode === 'galaxy' && !this.flight) this.frameGalaxy();
        this.kick();
        break;
      case 'visibility':
        this.visible = message.visible;
        if (!message.visible) this.keys.clear();
        this.kick();
        break;
      case 'playing':
        this.playing = message.playing;
        this.kick();
        break;
      case 'settings':
        this.settings = { ...this.settings, ...message.settings };
        if (message.settings.quality && this.deviceQuality) {
          this.quality = withPreset(this.deviceQuality, this.settings.quality);
          this.adaptive = 1;
        }
        this.kick();
        break;
      case 'pointer':
        this.onPointer(message);
        break;
      case 'wheel':
        this.onWheel(message.delta);
        break;
      case 'key':
        this.onKey(message.phase, message.code);
        break;
      case 'touchFlight':
        this.touch = message.input;
        this.interact();
        break;
      case 'catalog':
        this.post({
          type: 'catalog',
          systems: GALAXY_SITES.map((site) => {
            const system = getSystem(site.seed);
            return { name: system.name, subtitle: system.subtitle };
          }),
        });
        break;
      case 'goto':
        this.instant = Boolean(message.instant);
        if (message.target === 'galaxy') this.resetToGalaxy();
        else if (message.target === 'system') this.enterSystem(message.index);
        else this.selectPlanet(message.index);
        this.instant = false;
        break;
      case 'command':
        if (message.action === 'back') this.back();
        if (message.action === 'activateHover' && this.hover) this.activate(this.hover);
        if (message.action === 'reset') this.resetView();
        if (message.action === 'timeLapse') this.timeLapse = !this.timeLapse;
        this.interact();
        break;
      default:
        break;
    }
  }

  private interact() {
    this.lastInteraction = performance.now();
    this.kick();
  }

  private get orbit() {
    return this.mode === 'galaxy' ? this.galaxyRig : this.systemRig;
  }

  // ─── Input ────────────────────────────────────────────────────────────
  private onKey(phase: 'down' | 'up', code: string) {
    if (phase === 'up') {
      this.keys.delete(code);
      return;
    }
    if (code === 'Escape' || code === 'Backspace') {
      this.back();
      return;
    }
    if (this.mode === 'planet' && !this.flight) {
      if (code === 'KeyF' && this.rig && !this.planetState()?.data.giant) {
        this.rig.walking = !this.rig.walking;
        this.rig.velocity = [0, 0, 0];
      }
      if (code === 'KeyT') this.timeLapse = !this.timeLapse;
      if (code === 'Space') this.jumpQueued = true;
    }
    this.keys.add(code);
    this.interact();
  }

  private onPointer(m: Extract<ToEngine, { type: 'pointer' }>) {
    if (m.phase === 'down') {
      this.pointers.set(m.id, { x: m.x, y: m.y, type: m.pointerType });
      this.dragDistance = 0;
      if (this.pointers.size === 2) this.pinchStart = this.pinchDistance();
      this.interact();
      return;
    }
    if (m.phase === 'move') {
      const p = this.pointers.get(m.id);
      if (p) {
        const dx = m.x - p.x;
        const dy = m.y - p.y;
        p.x = m.x;
        p.y = m.y;
        this.dragDistance += Math.hypot(dx, dy);
        if (!this.flight) {
          if (this.mode === 'planet') {
            // Mouse drags look like a mouse-look; a finger grabs the sky.
            const sign = p.type === 'mouse' ? 1 : -1;
            const gain = p.type === 'mouse' ? 1 : 1.4;
            this.look[0] += dx * sign * gain;
            this.look[1] += dy * sign * gain;
          } else if (this.pointers.size === 1) this.orbit.drag(dx, dy);
          else if (this.pointers.size === 2) {
            const d = this.pinchDistance();
            if (this.pinchStart > 0 && d > 0) this.orbit.zoom(this.pinchStart / d);
            this.pinchStart = d;
          }
        }
        this.interact();
      }
      if (m.pointerType === 'mouse') this.hoverPointer = { x: m.x, y: m.y };
      return;
    }
    if (m.phase === 'up') {
      const p = this.pointers.get(m.id);
      this.pointers.delete(m.id);
      if (p && this.dragDistance < 8) this.onTap(m.x, m.y, m.pointerType);
      this.interact();
      return;
    }
    this.pointers.delete(m.id);
    if (m.phase === 'leave') this.hoverPointer = null;
  }

  private pinchDistance() {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  private onWheel(delta: number) {
    if (this.flight) return;
    if (this.mode === 'planet' && this.rig) {
      this.rig.speedLevel = clamp(this.rig.speedLevel * Math.exp(-delta * 0.0015), 0.2, 12);
    } else this.orbit.zoom(Math.exp(delta * 0.0012));
    this.interact();
  }

  private onTap(x: number, y: number, pointerType: string) {
    if (this.flight || this.mode === 'planet') return;
    const target = this.pick(x, y, pointerType === 'mouse' ? 26 : 34);
    if (!target) {
      this.armed = null;
      if (pointerType !== 'mouse') this.hover = null;
      return;
    }
    // Touch: the first tap previews, a second tap on the same target acts.
    if (
      pointerType !== 'mouse' &&
      (this.armed?.kind !== target.kind || this.armed.index !== target.index)
    ) {
      this.armed = target;
      this.hover = target;
      this.hoverPointer = null;
      return;
    }
    this.armed = null;
    this.activate(target);
  }

  private activate(target: { kind: string; index: number }) {
    if (target.kind === 'site') this.enterSystem(target.index);
    else if (target.kind === 'planet') this.selectPlanet(target.index);
  }

  private flightInput() {
    const k = this.keys;
    const axis = (pos: string[], neg: string[]) =>
      (pos.some((c) => k.has(c)) ? 1 : 0) - (neg.some((c) => k.has(c)) ? 1 : 0);
    const input = emptyInput();
    input.forward = clamp(
      axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) + this.touch.stick[1],
      -1,
      1,
    );
    input.strafe = clamp(
      axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']) + this.touch.stick[0],
      -1,
      1,
    );
    input.vertical = clamp(
      axis(['Space', 'KeyE'], ['KeyC', 'KeyQ', 'ControlLeft']) +
        (this.touch.up ? 1 : 0) -
        (this.touch.down ? 1 : 0),
      -1,
      1,
    );
    input.boost = k.has('ShiftLeft') || k.has('ShiftRight') || this.touch.boost;
    input.lookX = this.look[0];
    input.lookY = this.look[1];
    input.jump = this.jumpQueued || this.touch.up;
    this.look = [0, 0];
    this.jumpQueued = false;
    return input;
  }

  private resetView() {
    if (this.flight) return;
    if (this.mode === 'galaxy') {
      this.galaxyRig.set({ target: [0, 0, 0], yaw: 0.55, pitch: 0.5, roll: 0.2, fov: 38 });
      this.frameGalaxy();
    } else if (this.mode === 'system' && this.system) {
      this.systemRig.follow = null;
      this.systemRig.set({ target: [0, 0, 0], ...this.systemOverview() });
    }
  }

  // ─── Frames ───────────────────────────────────────────────────────────
  private planetState(): PlanetState | null {
    return this.state && this.planetIndex >= 0 ? this.state.planets[this.planetIndex] : null;
  }

  /** Body frame (planet radius = 1) → system frame. */
  private pToS(pose: Pose): Pose {
    const p = this.planetState()!;
    const o = p.orientation;
    return {
      eye: add(p.position, scale(fromBody(o, pose.eye), p.radius)),
      forward: fromBody(o, pose.forward),
      up: fromBody(o, pose.up),
      fov: pose.fov,
    };
  }

  private sToP(pose: Pose, planet = this.planetState()!): Pose {
    const o = planet.orientation;
    return {
      eye: scale(toBody(o, sub(pose.eye, planet.position)), 1 / planet.radius),
      forward: toBody(o, pose.forward),
      up: toBody(o, pose.up),
      fov: pose.fov,
    };
  }

  /** The current camera expressed in the system frame. */
  private systemPose(): Pose | null {
    if (!this.system) return null;
    if (this.camera.frame === 'S') return this.camera.pose;
    if (this.camera.frame === 'P') return this.pToS(this.camera.pose);
    const p = this.camera.pose;
    return { ...p, eye: scale(sub(p.eye, this.starInGalaxy()), 1 / this.k) };
  }

  private starInGalaxy() {
    return this.site
      ? siteWorld(this.site, this.angle, this.settings.thickness)
      : ([0, 0, 0] as Vec3);
  }

  private galaxyEye(): Vec3 {
    if (this.camera.frame === 'G') return this.camera.pose.eye;
    return add(this.starInGalaxy(), scale(this.systemPose()!.eye, this.k));
  }

  /** 0 in the galaxy … 1 once the camera is among the planets. */
  private presence() {
    const pose = this.systemPose();
    if (!pose || !this.system) return 0;
    return 1 - smoothstep(2.5, 60, length(pose.eye) / this.system.extent);
  }

  // ─── Journeys ─────────────────────────────────────────────────────────
  private systemOverview() {
    const extent = this.system?.extent ?? 40;
    const aspect = this.cssWidth / Math.max(1, this.cssHeight);
    return {
      yaw: 0.65,
      pitch: 0.42,
      distance: extent * (aspect < 1 ? 2.4 : 1.6),
      roll: 0,
      fov: 40,
    };
  }

  private loadSystem(site: GalaxySystemSite) {
    this.site = site;
    this.system = getSystem(site.seed);
    this.state = new SystemState(this.system);
    this.k = systemScale(this.system);
    this.systemTime = 0;
    this.state.update(this.systemTime);
    this.renderer.setPlanetData(packSystem(this.system));
  }

  private enterSystem(index: number) {
    if (this.flight || this.mode !== 'galaxy') return;
    const site = GALAXY_SITES[index];
    if (!site) return;
    this.loadSystem(site);
    this.hover = null;
    const star = this.starInGalaxy();
    const from = this.galaxyRig.pose();
    // The way back ends on the rig's own pose: the float has faded out by
    // then, so the orbit picks up exactly where the flight stops.
    this.galaxyReturn = this.galaxyRig.pose(false);
    const local: Pose = { ...from, eye: scale(sub(from.eye, star), 1 / this.k) };
    this.systemRig.minDistance = 3;
    this.systemRig.maxDistance = this.system!.extent * 4;
    this.systemRig.follow = null;
    this.systemRig.set({ target: [0, 0, 0], ...this.systemOverview() }, true);
    const to = this.systemRig.pose();
    this.startFlight({
      frame: 'S',
      from: local,
      to,
      path: (t) => flightPose(local, to, [0, 0, 0], [0, 0, 0], t),
      label: `Approaching ${this.system!.name}`,
      duration: FLIGHT_SECONDS,
      done: () => {
        this.mode = 'system';
      },
    });
  }

  private leaveSystem() {
    if (this.flight || this.mode !== 'system' || !this.system) return;
    const star = this.starInGalaxy();
    const back = this.galaxyReturn ?? this.galaxyRig.pose();
    const from = this.camera.pose;
    const to: Pose = { ...back, eye: scale(sub(back.eye, star), 1 / this.k) };
    this.mode = 'galaxy';
    this.startFlight({
      frame: 'S',
      from,
      to,
      path: (t) => flightPose(from, to, [0, 0, 0], [0, 0, 0], t),
      label: 'Returning to the galaxy',
      duration: FLIGHT_SECONDS,
      done: () => {
        this.camera = { frame: 'G', pose: back };
        this.system = null;
        this.state = null;
        this.site = null;
      },
    });
  }

  /** Land on a planet: a continuous flight from orbit down to the surface. */
  private selectPlanet(index: number) {
    if (this.flight || this.mode !== 'system' || !this.state) return;
    const planet = this.state.planets[index];
    if (!planet) return;
    if (!this.renderer.surfaceSupported || this.surfaceFailed) {
      this.orbitPlanet(index);
      return;
    }
    const layer = this.renderer.planet;
    if (!layer) {
      // Shaders still compiling: try again once they are ready, or settle for
      // an orbit if this GPU cannot build them. Only the latest choice counts,
      // and only while the visitor is still in the system it was made in.
      const request = ++this.planetRequest;
      const state = this.state;
      const current = () =>
        !this.disposed && request === this.planetRequest && this.state === state;
      this.renderer.ensurePlanet().then(
        () => {
          if (current()) this.selectPlanet(index);
        },
        (error: unknown) => {
          if (this.disposed) return;
          console.error('Planet renderer failed', error);
          this.surfaceFailed = true;
          if (current()) this.orbitPlanet(index);
        },
      );
      return;
    }
    this.planetIndex = index;
    const rig = new PlanetRig(planet.data);
    this.rig = rig;
    const maxRelief = Math.max(
      0.01,
      ...planet.data.biomes.map((b) => b.amp * planet.data.relief * 2.2),
    );
    layer.setPlanet(planet.row, maxRelief, (n, octaves) =>
      terrainHeight(rig.params, n[0], n[1], n[2], octaves),
    );
    const sun = normalize(
      toBody(planet.orientation, sub(this.state.stars[0].position, planet.position)),
    );
    const from = this.sToP(this.camera.pose, planet);
    const { site, heading } = chooseLandingSite(planet.data, sun, normalize(from.eye), from.up);
    const ground = rig.ground(site);
    // Over a giant, arrive above the cloud deck rather than skimming it.
    const eyeHeight = planet.data.giant ? 450 : LANDING_EYE_HEIGHT;
    const eye = scale(site, 1 + ground + eyeHeight / planet.data.meters);
    const pitch = -0.1;
    const forward = normalize(add(scale(heading, Math.cos(pitch)), scale(site, Math.sin(pitch))));
    const to: Pose = { eye, forward, up: site, fov: 62 };
    this.startFlight({
      frame: 'P',
      from,
      to,
      path: (t) => planetFlightPose(from, to, t, (n) => rig.ground(n)),
      label: `Descending to ${planet.data.name}`,
      duration: LANDING_SECONDS,
      done: () => {
        this.mode = 'planet';
        rig.adopt(to);
      },
    });
  }

  private ascend() {
    if (this.flight || this.mode !== 'planet' || !this.rig) return;
    const index = this.planetIndex;
    const planet = this.planetState()!;
    // Fly in a frame that keeps the planet's centre but not its spin, so the
    // sky does not wheel around while climbing.
    const from = this.camera.pose;
    const start = poseFromBody(planet.orientation, from);
    // End on exactly the pose the orbit rig will hold, looking down on the
    // take-off site from 4.8 radii.
    const back = normalize(start.eye);
    const orbit = {
      yaw: Math.atan2(back[0], back[2]),
      pitch: clamp(Math.asin(clamp(back[1], -1, 1)), -1.1, 1.1),
      distance: ASCENT_RADII,
      roll: 0,
      fov: 40,
    };
    const end = orbitPose([0, 0, 0], orbit.yaw, orbit.pitch, orbit.distance, 0, orbit.fov);
    const toBodyPose = (p: Pose) => poseToBody(this.state!.planets[index].orientation, p);
    this.mode = 'system';
    this.timeLapse = false;
    this.startFlight({
      frame: 'P',
      from,
      to: toBodyPose(end),
      path: (t) => toBodyPose(ascentPose(start, end, t)),
      label: 'Returning to orbit',
      duration: ASCENT_SECONDS,
      done: () => {
        const current = this.state!.planets[index];
        this.systemRig.minDistance = current.radius * 1.6;
        this.systemRig.set(
          { target: current.position, ...orbit, distance: orbit.distance * current.radius },
          true,
        );
        this.systemRig.follow = () => this.state!.planets[index].position;
        this.camera = { frame: 'S', pose: this.systemRig.pose() };
        this.planetIndex = -1;
        this.rig = null;
      },
    });
  }

  /** Without a surface renderer: fly into orbit around the planet instead of landing. */
  private orbitPlanet(index: number) {
    if (this.flight || this.mode !== 'system' || !this.state) return;
    const planet = this.state.planets[index];
    if (!planet) return;
    const at = () => this.state!.planets[index].position;
    const from = this.camera.pose;
    const focusFrom: Vec3 = [...this.systemRig.target];
    const toward = normalize(sub(from.eye, planet.position));
    const orbit = {
      yaw: Math.atan2(toward[0], toward[2]),
      pitch: clamp(Math.asin(clamp(toward[1], -1, 1)), -0.6, 0.9),
      distance: ASCENT_RADII * planet.radius,
      roll: 0,
      fov: 40,
    };
    const target = () => orbitPose(at(), orbit.yaw, orbit.pitch, orbit.distance, 0, orbit.fov);
    this.startFlight({
      frame: 'S',
      from,
      to: target(),
      path: (t) => flightPose(from, target(), focusFrom, at(), t),
      label: `Orbiting ${planet.data.name}`,
      duration: FLIGHT_SECONDS,
      done: () => {
        this.systemRig.minDistance = planet.radius * 1.6;
        this.systemRig.set({ target: at(), ...orbit }, true);
        this.systemRig.follow = at;
        this.camera = { frame: 'S', pose: this.systemRig.pose() };
      },
    });
  }

  private back() {
    if (this.flight) return;
    if (this.mode === 'planet') this.ascend();
    else if (this.mode === 'system') {
      if (this.systemRig.follow) this.leavePlanetOrbit();
      else this.leaveSystem();
    }
    this.interact();
  }

  /**
   * From the orbit around one planet back out to the whole system: a real
   * flight, not a damped jump. Its start rides along with the planet, which
   * keeps moving on its orbit during the flight.
   */
  private leavePlanetOrbit() {
    const follow = this.systemRig.follow;
    if (!follow || !this.state) return;
    const from = this.camera.pose;
    const anchor = follow();
    const overview = this.systemOverview();
    const to = orbitPose(
      [0, 0, 0],
      overview.yaw,
      overview.pitch,
      overview.distance,
      overview.roll,
      overview.fov,
    );
    this.systemRig.follow = null;
    this.startFlight({
      frame: 'S',
      from,
      to,
      path: (t) => {
        const planet = follow();
        const moved = sub(planet, anchor);
        const start = { ...from, eye: add(from.eye, moved) };
        // Pull back from the planet first; only then swing the focus over
        // to the star, so the camera never grazes it on the way out.
        return flightPose(start, to, planet, [0, 0, 0], t, 0.42, [0.3, 0.9]);
      },
      label: `Back to ${this.system?.name ?? 'the system'}`,
      duration: ORBIT_EXIT_SECONDS,
      done: () => {
        this.systemRig.minDistance = 3;
        this.systemRig.set({ target: [0, 0, 0], ...overview }, true);
        this.camera = { frame: 'S', pose: this.systemRig.pose() };
      },
    });
  }

  /** Test hook: drop any journey and return to the galaxy overview at once. */
  private resetToGalaxy() {
    this.flight = null;
    this.mode = 'galaxy';
    this.system = null;
    this.state = null;
    this.site = null;
    this.planetIndex = -1;
    this.rig = null;
    this.systemRig.follow = null;
    this.camera = { frame: 'G', pose: this.galaxyRig.pose() };
    this.interact();
  }

  private startFlight(f: Omit<Flight, 'elapsed'>) {
    this.flight = {
      ...f,
      elapsed: 0,
      // Reduced motion shortens flights but keeps them: a 0.3 s jump between
      // orbit and ground is more jarring than a brief, smooth move.
      duration: this.instant
        ? 0.001
        : this.reducedMotion
          ? Math.max(1.6, f.duration * 0.5)
          : f.duration,
    };
    this.camera = { frame: f.frame, pose: f.from };
    this.pointers.clear();
    this.keys.clear();
    this.hover = null;
    this.interact();
  }

  private updateFlight(dt: number) {
    const f = this.flight!;
    f.elapsed += dt;
    const t = Math.min(1, f.elapsed / f.duration);
    this.camera = { frame: f.frame, pose: f.path(t) };
    if (t >= 1) {
      this.flight = null;
      this.camera = { frame: f.frame, pose: f.to };
      f.done();
      this.lastInteraction = performance.now();
    }
  }

  // ─── Picking ──────────────────────────────────────────────────────────
  private project(rel: Vec3, pose: Pose): [number, number, number] | null {
    const b = poseBasis(pose);
    const z = dot(rel, b.forward);
    if (z < 1e-6) return null;
    const tanHalf = Math.tan((pose.fov * Math.PI) / 360);
    const aspect = this.cssWidth / this.cssHeight;
    const x = dot(rel, b.right) / (tanHalf * aspect * z);
    const y = dot(rel, b.up) / (tanHalf * z);
    return [(x * 0.5 + 0.5) * this.cssWidth, (0.5 - y * 0.5) * this.cssHeight, z];
  }

  private pick(
    x: number,
    y: number,
    radius: number,
  ): { kind: 'site' | 'planet'; index: number } | null {
    if (this.mode === 'galaxy') {
      let best = -1;
      let bestDistance = radius;
      const eye = this.galaxyEye();
      for (const site of GALAXY_SITES) {
        const s = this.project(
          sub(siteWorld(site, this.angle, this.settings.thickness), eye),
          this.camera.pose,
        );
        if (!s) continue;
        const d = Math.hypot(s[0] - x, s[1] - y);
        if (d < bestDistance) {
          bestDistance = d;
          best = site.index;
        }
      }
      return best >= 0 ? { kind: 'site', index: best } : null;
    }
    if (this.mode === 'system' && this.state) {
      const pose = this.systemPose()!;
      const tanHalf = Math.tan((pose.fov * Math.PI) / 360);
      let best: { kind: 'planet'; index: number } | null = null;
      let bestScore = Infinity;
      for (const planet of this.state.planets) {
        const s = this.project(sub(planet.position, pose.eye), pose);
        if (!s) continue;
        const pixels = (planet.radius / (s[2] * tanHalf)) * this.cssHeight * 0.5;
        const d = Math.hypot(s[0] - x, s[1] - y);
        if (d < Math.max(radius, pixels + 10) && d - pixels < bestScore) {
          bestScore = d - pixels;
          best = { kind: 'planet', index: planet.index };
        }
      }
      return best;
    }
    return null;
  }

  private updateHover() {
    if (this.flight || this.mode === 'planet') {
      this.hover = null;
    } else if (this.hoverPointer && this.pointers.size === 0) {
      this.hover = this.pick(this.hoverPointer.x, this.hoverPointer.y, 26);
    } else if (this.hoverPointer === null && !this.armed && this.pointers.size === 0) {
      this.hover = null;
    }
    let hud: HudInfo = {
      visible: false,
      title: '',
      subtitle: '',
      hint: '',
      x: 0,
      y: 0,
      onDark: false,
      actionable: false,
    };
    const touch = this.armed && this.hover && this.armed.index === this.hover.index;
    if (this.hover?.kind === 'site') {
      const site = GALAXY_SITES[this.hover.index];
      const s = this.project(
        sub(siteWorld(site, this.angle, this.settings.thickness), this.galaxyEye()),
        this.camera.pose,
      );
      if (s) {
        const system = getSystem(site.seed);
        hud = {
          visible: true,
          title: system.name,
          subtitle: system.subtitle,
          hint: touch ? 'Tap again to fly in' : 'Click to fly in',
          x: s[0],
          y: s[1],
          onDark: false,
          actionable: true,
        };
      }
    } else if (this.hover?.kind === 'planet' && this.state) {
      const planet = this.state.planets[this.hover.index];
      const pose = this.systemPose()!;
      const s = this.project(sub(planet.position, pose.eye), pose);
      if (s) {
        const data = planet.data;
        hud = {
          visible: true,
          title: data.name,
          subtitle: data.giant ? data.label : `${data.label} · ${data.biomes.length} biomes`,
          hint: touch ? 'Tap again to land' : 'Click to land',
          x: s[0],
          y: s[1],
          onDark: true,
          actionable: true,
        };
      }
    }
    const key = `${hud.visible}|${hud.title}|${hud.hint}|${hud.x.toFixed(1)}|${hud.y.toFixed(1)}`;
    if (key !== this.lastHud) {
      this.lastHud = key;
      this.post({ type: 'hud', hud });
    }
    const cursor = this.flight
      ? 'default'
      : this.mode === 'planet'
        ? this.pointers.size
          ? 'grabbing'
          : 'crosshair'
        : this.pointers.size
          ? 'grabbing'
          : this.hover && this.hoverPointer
            ? 'pointer'
            : 'grab';
    if (cursor !== this.cursor) {
      this.cursor = cursor;
      this.post({ type: 'cursor', cursor });
    }
  }

  private publishState() {
    const system = this.system;
    const planet = this.planetState();
    const message: FromEngine = {
      type: 'state',
      mode: this.mode,
      travelling: Boolean(this.flight),
      label: this.flight?.label ?? '',
      system: system
        ? {
            name: system.name,
            subtitle: system.subtitle,
            planets: system.planets.map((p) => ({ name: p.name, label: p.label })),
          }
        : null,
      planet:
        planet && (this.mode === 'planet' || this.flight?.frame === 'P')
          ? {
              name: planet.data.name,
              label: planet.data.label,
              biomes: planet.data.biomes.length,
              giant: planet.data.giant,
            }
          : null,
    };
    const key = JSON.stringify(message);
    if (key !== this.lastState) {
      this.lastState = key;
      this.post(message);
    }
  }

  private publishInstrument(now: number, sun: Vec3) {
    if (!this.rig || now - this.lastInstrument < 120) return;
    this.lastInstrument = now;
    const rig = this.rig;
    const up = rig.up;
    const elevation = dot(up, sun);
    // Local solar time from the sun's elevation and whether it is rising,
    // judged from how the elevation actually changed: spin and orbit both move
    // the sun, so no fixed side of the sky is "east".
    if (this.systemTime !== this.sunSample.time) {
      // Compare against the same local vertical so walking does not count.
      this.sunSample.rising = elevation >= dot(up, this.sunSample.sun);
      this.sunSample.time = this.systemTime;
      this.sunSample.sun = sun;
    }
    const rising = this.sunSample.rising;
    const angle = Math.asin(clamp(elevation, -1, 1));
    const daytime = rising ? 0.25 + angle / (2 * Math.PI) : 0.75 - angle / (2 * Math.PI);
    this.post({
      type: 'instrument',
      instrument: {
        biome: rig.biomeName(),
        altitude: rig.altitude,
        speed: length(rig.velocity) * rig.meters,
        heading: 0,
        daytime: ((daytime % 1) + 1) % 1,
        light: elevation > 0.08 ? 'day' : elevation > -0.12 ? 'dusk' : 'night',
        walking: rig.walking,
        timeLapse: this.timeLapse,
      },
    });
  }

  // ─── Frame loop ───────────────────────────────────────────────────────
  /** Something changed: draw at least one frame, even when idle or paused. */
  private kick() {
    this.redraw = true;
    if (!this.raf && this.renderer) this.schedule();
  }

  private schedule() {
    if (this.raf) return;
    const raf = (globalThis as { requestAnimationFrame?: (cb: (t: number) => void) => number })
      .requestAnimationFrame;
    this.raf = raf
      ? raf((t) => this.tick(t))
      : (setTimeout(() => this.tick(performance.now()), 16) as unknown as number);
  }

  private moving() {
    if (this.flight || this.pointers.size > 0) return true;
    if (this.mode === 'planet')
      return this.keys.size > 0 || length(this.rig?.velocity ?? [0, 0, 0]) > 1e-9;
    return this.orbit.moving();
  }

  /** 60 fps while something moves, slower when idle, nothing when hidden. */
  private frameLimit(now: number) {
    const interacting = now - this.lastInteraction < 2500 || this.moving();
    return interacting || this.mode === 'planet' ? 60 : this.mode === 'galaxy' ? 30 : 45;
  }

  /**
   * In the galaxy view the camera floats a little over a minute or two: it
   * tilts and leans, so the disk shifts against the turning sky. It never
   * swings about the disk's axis, where it would add to or cancel the disk's
   * own spin and make the galaxy seem to speed up and stall. It fades out for
   * flights and the other views (a flight back to the galaxy ends on the bare
   * orbit pose) and only fades in while playing, so a paused or reduced-motion
   * view never moves on its own.
   */
  private floatGalaxy(dt: number) {
    const target = this.mode === 'galaxy' && !this.flight ? 1 : 0;
    if (target < this.floatWeight || this.playing) {
      this.floatWeight += (target - this.floatWeight) * damp(target ? 0.4 : 3, dt);
    }
    const t = this.floatTime;
    this.galaxyRig.drift.pitch =
      this.floatWeight * (0.035 * Math.sin(t * 0.083 + 0.6) + 0.015 * Math.sin(t * 0.031 + 2.1));
    this.galaxyRig.drift.roll = this.floatWeight * 0.02 * Math.sin(t * 0.057 + 1.1);
  }

  private tick(now: number) {
    this.raf = 0;
    if (!this.visible) {
      this.last = 0;
      return;
    }
    const animate =
      this.playing || this.moving() || this.mode === 'planet' || now - this.lastInteraction < 2500;
    if (!animate && this.sentFirstFrame && !this.redraw) {
      this.last = 0;
      return;
    }
    // A lost device never comes back: stop the loop instead of spinning.
    if (this.renderer.backend.lost) return;
    const limit = this.frameLimit(now);
    if (now + 0.5 < this.nextFrameAt || !this.renderer.backend.canRender()) {
      this.schedule();
      return;
    }
    this.nextFrameAt = Math.max(now, this.nextFrameAt + 1000 / limit);
    const elapsed = this.last ? (now - this.last) / 1000 : 1 / 60;
    this.last = now;
    const dt = Math.min(elapsed, 0.05);
    if (this.playing) this.skyTime += dt;
    if (this.playing || this.mode === 'planet') {
      this.time += dt;
      if (this.mode === 'galaxy' && !this.flight) {
        this.angle += dt * this.settings.rotation * GALAXY_TURN;
        this.skyAngle += dt * this.settings.rotation * SKY_TURN;
        this.floatTime += dt;
      }
      // Time-lapse is a surface feature: in orbit it would whirl the moons.
      const lapse = this.timeLapse && this.mode === 'planet' && !this.flight;
      if (this.state) this.systemTime += dt * (lapse ? 40 : 1);
    }
    this.state?.update(this.systemTime);
    this.floatGalaxy(dt);
    if (this.flight) {
      // Flights follow wall time so a slow GPU cannot stretch them.
      this.updateFlight(Math.min(elapsed, 0.1));
    } else if (this.mode === 'planet' && this.rig) {
      this.rig.update(this.flightInput(), dt);
      this.camera = { frame: 'P', pose: this.rig.pose() };
    } else {
      this.orbit.update(dt);
      this.camera = { frame: this.mode === 'galaxy' ? 'G' : 'S', pose: this.orbit.pose() };
    }
    const ink =
      this.mode === 'system' && !this.flight
        ? 1
        : this.mode === 'planet' || this.camera.frame === 'P'
          ? 0
          : 0.35 * this.presence();
    this.orbitInk += (ink - this.orbitInk) * damp(4, elapsed);
    this.updateHover();
    this.publishState();
    this.renderFrame(now);
    this.redraw = false;
    this.measure(elapsed, limit);
    this.schedule();
  }

  private measure(elapsed: number, limit: number) {
    this.fpsFrames++;
    this.fpsTime += elapsed;
    if (this.fpsTime < 1) return;
    const fps = this.fpsFrames / this.fpsTime;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    const layer = this.renderer.planet;
    const debug =
      layer && this.camera.frame === 'P'
        ? `leaves ${layer.tree.leaves.length} pending ${layer.tree.pending.length} alt ${((length(this.camera.pose.eye) - 1) * (this.planetState()?.data.meters ?? 0)).toFixed(0)}m`
        : '';
    this.post({ type: 'fps', fps: Math.round(fps), scale: this.adaptive, debug });
    if (this.flight) return;
    // Sustained misses of the target rate lower the render scale; an
    // intentional idle cap is not evidence of a slow GPU.
    if (fps < Math.min(limit, 60) * 0.72) this.slowSeconds++;
    else this.slowSeconds = Math.max(0, this.slowSeconds - 1);
    if (this.slowSeconds >= 3 && this.adaptive > 0.55) {
      this.adaptive = Math.max(0.55, this.adaptive - 0.12);
      this.slowSeconds = 0;
    } else if (this.slowSeconds === 0 && fps > limit * 0.95 && this.adaptive < 1) {
      this.adaptive = Math.min(1, this.adaptive + 0.02);
    }
  }

  private writeMarkers(presence: number, focusIndex: number) {
    const d = this.markerData;
    for (const site of GALAXY_SITES) {
      const system = getSystem(site.seed);
      const color = kelvinRgb(system.stars[0].temperature);
      const o = site.index * 12;
      d[o] = site.position[0];
      d[o + 1] = site.position[1];
      d[o + 2] = site.position[2];
      d[o + 3] = 0.024;
      d[o + 4] = color[0];
      d[o + 5] = color[1];
      d[o + 6] = color[2];
      d[o + 7] = 1.6;
      const hovered = this.hover?.kind === 'site' && this.hover.index === site.index;
      d[o + 8] = hovered && !this.flight ? 1 : 0;
      d[o + 9] = 0;
      d[o + 10] = 0;
      // The entered system's marker hands over to its real sun.
      d[o + 11] = site.index === focusIndex ? 1 - smoothstep(0.0, 0.35, presence) : 1 - presence;
    }
    this.renderer.setMarkers(d);
  }

  private writeSystem(pose: Pose, excludePlanet: number) {
    const s = this.state!;
    const eye = pose.eye;
    const basis = poseBasis(pose);
    const d = this.systemData;
    const [w, h] = [this.renderer.width, this.renderer.height];
    d.set('eye', 0, 0, 0, Math.tan((pose.fov * Math.PI) / 360))
      .vec('right', basis.right, 0)
      .vec('up', basis.up, 0)
      .vec('forward', basis.forward, 0)
      .set('viewport', w, h, this.time, w / h)
      .set('counts', s.stars.length, s.planets.length, s.moons.length, s.rings.length)
      .set(
        'options',
        excludePlanet,
        0,
        this.orbitInk,
        this.hover?.kind === 'planet' ? this.hover.index : -1,
      )
      .vec('origin', sub([0, 0, 0], eye), 0);
    s.stars.forEach((star, i) => {
      const rel = sub(star.position, eye);
      d.item('stars', i, rel[0], rel[1], rel[2], star.radius);
      d.item('starColor', i, ...starLight(star), 0);
    });
    s.planets.forEach((p, i) => {
      const rel = sub(p.position, eye);
      d.item('planets', i, rel[0], rel[1], rel[2], p.radius);
      d.item('planetInfo', i, p.row, p.data.orbit, p.cloudPhase, 0);
      d.item('axisX', i, ...p.orientation.x, 0);
      d.item('axisY', i, ...p.orientation.y, 0);
      d.item('axisZ', i, ...p.orientation.z, 0);
    });
    s.moons.forEach((m, i) => {
      const rel = sub(m.position, eye);
      d.item('moons', i, rel[0], rel[1], rel[2], m.radius);
      d.item('moonInfo', i, m.row, m.planet, 0, 0);
    });
    s.rings.forEach((r, i) => {
      d.item('rings', i, r.planet, r.inner, r.outer, r.opacity);
      d.item('ringNormal', i, ...r.normal, r.seed);
    });
    return d;
  }

  /** Planet-frame uniforms for the surface, atmosphere and clouds. */
  private writePlanet(pose: Pose, now: number) {
    const planet = this.planetState()!;
    const data = planet.data;
    const s = this.state!;
    const o = planet.orientation;
    const basis = poseBasis(pose);
    const [w, h] = [this.renderer.width, this.renderer.height];
    const toSun = (i: number) => normalize(toBody(o, sub(s.stars[i].position, planet.position)));
    const sun0 = toSun(0);
    const light = (i: number) => starLight(s.stars[i], 2.6);
    const meters = data.meters;
    const near = 0.04 / meters;
    const far = 40;
    const altitude = length(pose.eye) - 1;
    const up = normalize(pose.eye);
    // Above the air, the sky is space again: stars and the galaxy come back.
    const airTop = data.atmosphere.height;
    const daylight =
      smoothstep(-0.12, 0.2, dot(up, sun0)) * (1 - smoothstep(airTop, airTop * 4, altitude));
    // Brightest moon in the sky lights the night.
    let moonDir: Vec3 = [0, 1, 0];
    let moonPhase = 0;
    for (const m of s.moons) {
      if (m.planet !== planet.index) continue;
      const dir = normalize(toBody(o, sub(m.position, planet.position)));
      const phase =
        (1 +
          dot(
            normalize(sub(s.stars[0].position, m.position)),
            normalize(sub(planet.position, m.position)),
          )) *
        0.5;
      const score = Math.max(0, dot(dir, up)) * phase;
      if (score > moonPhase) {
        moonPhase = score;
        moonDir = dir;
      }
    }
    const d = this.planetData;
    d.set('eye', pose.eye[0], pose.eye[1], pose.eye[2], Math.tan((pose.fov * Math.PI) / 360))
      .vec('right', basis.right, 0)
      .vec('up', basis.up, 0)
      .vec('forward', basis.forward, 0)
      .set('viewport', w, h, this.time, w / h)
      .vec('sun0', sun0, 1)
      // Surfaces here are lit 2.6× (tuned on the ground); the orbital view
      // lights them 1.6× and its air 1×. Up high, scale the air to match.
      .vec('sun0Color', light(0), lerp(1 / 1.6, 1, surfaceness(altitude)))
      .set('clip', 1 / near, 1 / Math.log2(1 + far / near), 0.06, WATER_KIND[data.water])
      .vec('moon', moonDir, moonPhase)
      .set('cloud', planet.cloudPhase, 2600 / meters, data.giant ? 0 : data.clouds, 900 / meters)
      .set('state', altitude, daylight, 0, 0);
    if (s.stars.length > 1) d.vec('sun1', toSun(1), 1).vec('sun1Color', light(1), 1);
    else d.set('sun1', 0, 1, 0, 0).set('sun1Color', 0, 0, 0, 0);
    this.publishInstrument(now, sun0);
    return { d, daylight, basis };
  }

  private renderFrame(now = performance.now()) {
    const inPlanet = this.camera.frame === 'P' && this.planetState() && this.renderer.planet;
    // The surface budget holds for a moment after take-off: resizing every
    // target mid-flight is a visible hitch, a beat later it is not.
    if (inPlanet) this.surfaceBudgetUntil = now + 1500;
    const [w, h] = renderSize(
      this.cssWidth,
      this.cssHeight,
      this.dpr,
      this.quality,
      this.adaptive,
      Boolean(inPlanet) || now < this.surfaceBudgetUntil,
    );
    this.renderer.resize(w, h);
    const presence = this.presence();
    const systemPose = this.systemPose();
    const viewPose = systemPose ?? this.camera.pose;
    const basis = poseBasis(viewPose);
    const eyeG = this.galaxyEye();
    const focus = this.starInGalaxy();
    this.writeMarkers(presence, this.site?.index ?? -1);
    const tanHalf = Math.tan((viewPose.fov * Math.PI) / 360);

    let planetFrame = null;
    let daylight = 0;
    let sunUp = 0;
    let exclude = -1;
    let surfaceWeight = 0;
    if (inPlanet) {
      surfaceWeight = surfaceness(length(this.camera.pose.eye) - 1);
      const { d, daylight: day } = this.writePlanet(this.camera.pose, now);
      sunUp = day;
      daylight = day * Math.min(1, this.planetState()!.data.atmosphere.density);
      const layer = this.renderer.planet!;
      const pose = this.camera.pose;
      // Close in, the streamed surface; high up, the orbital sphere, which is
      // sharper there. In between they cross-fade, so neither pops in.
      const meshWeight =
        layer.tree.leaves.length >= 6
          ? 1 - smoothstep(HANDOFF_LOW, HANDOFF_HIGH, length(pose.eye) - 1)
          : 0;
      d.set('handoff', meshWeight, 0, 0, 0);
      planetFrame = {
        data: d,
        mix: meshWeight,
        view: {
          eye: pose.eye,
          basis: poseBasis(pose),
          tanHalf: Math.tan((pose.fov * Math.PI) / 360),
          aspect: w / h,
        },
        budget: this.quality.name === 'high' ? 16 : 8,
        info: this.planetState()!.data,
        now,
      };
      if (meshWeight >= 0.999) exclude = this.planetIndex;
    }

    this.galaxyData
      .set('eye', eyeG[0], eyeG[1], eyeG[2], tanHalf)
      .vec('right', basis.right, 0)
      .vec('up', basis.up, 0)
      .vec('forward', basis.forward, 0)
      .set('viewport', w, h, this.time, w / h)
      .set(
        'look',
        this.settings.exposure,
        this.settings.bloom,
        this.settings.nebula,
        this.settings.dust,
      )
      .set(
        'detail',
        this.quality.steps * (1 - presence * 0.45),
        this.angle,
        this.settings.thickness,
        1,
      )
      .vec('volume', this.renderer.volumeDims)
      .set(
        'atlas',
        this.renderer.atlasSize[0],
        this.renderer.atlasSize[1],
        1 - presence,
        presence * (1 - daylight),
      )
      .set('focus', focus[0], focus[1], focus[2], this.site ? presence : 0)
      .set('adapt', (1 - presence * 0.94) * (1 - daylight), 1, this.skyAngle, this.skyTime);
    // Exposure follows the sun itself (airless worlds have a black sky but a
    // harshly lit ground) and opens up at night like dark-adapted eyes.
    // Surface exposure fades back to the space value with altitude, so the
    // hand-off to the orbital view on take-off does not jump in brightness.
    // Up high it eases to 1.6 / 2.6, the orbital view's light balance.
    const surfaceExposure = 1.5 - sunUp * 0.9 - (sunUp - daylight) * 0.12;
    const orbitExposure = inPlanet ? 1.6 / 2.6 : 1;
    const exposure = this.settings.exposure * lerp(orbitExposure, surfaceExposure, surfaceWeight);
    this.postData
      .set('viewport', w, h, this.time, 0)
      .set('look', exposure, this.settings.bloom, 0, 0)
      .vec('paper', PAGE, 0.36);
    this.renderer.render({
      galaxy: this.galaxyData,
      volume: daylight < 0.98,
      galaxyStars: presence < 0.999,
      skyStars: presence > 0.001 && daylight < 0.98,
      markers: presence < 0.999,
      system: this.state && systemPose ? this.writeSystem(systemPose, exclude) : null,
      post: this.postData,
      planet: planetFrame,
    });
    if (!this.sentFirstFrame) {
      this.sentFirstFrame = true;
      this.post({ type: 'firstFrame' });
    }
  }

  /** Debug: compare GPU patch heights with the CPU twin for a few leaves. */
  dispose() {
    this.disposed = true;
    clearTimeout(this.warmUp);
    this.visible = false;
    this.running = false;
    this.renderer?.destroy();
  }

  /** init() outlived the engine: free what it built and stop there. */
  private abandoned(backend: Backend | null, renderer: Renderer | null) {
    if (!this.disposed) return false;
    if (renderer) renderer.destroy();
    else backend?.destroy();
    return true;
  }
}
