import type { DeviceHints } from './quality';

export type Theme = 'dark' | 'light';
export type Mode = 'galaxy' | 'system' | 'planet';

export interface PointerMessage {
  type: 'pointer';
  phase: 'down' | 'move' | 'up' | 'cancel' | 'leave';
  id: number;
  x: number;
  y: number;
  button: number;
  pointerType: string;
}

export interface Settings {
  exposure: number;
  bloom: number;
  nebula: number;
  dust: number;
  thickness: number;
  rotation: number;
  quality: 'auto' | 'low' | 'medium' | 'high';
}

export const DEFAULT_SETTINGS: Settings = {
  exposure: 1.15,
  bloom: 0.26,
  nebula: 0.35,
  dust: 1,
  thickness: 1,
  rotation: 0.4,
  quality: 'auto',
};

export interface TouchFlight {
  stick: [number, number];
  up: boolean;
  down: boolean;
  boost: boolean;
}

export type ToEngine =
  | {
      type: 'init';
      canvas: OffscreenCanvas | HTMLCanvasElement;
      width: number;
      height: number;
      dpr: number;
      hints: DeviceHints;
      theme: Theme;
      reducedMotion: boolean;
      renderer: 'auto' | 'webgl';
    }
  | { type: 'resize'; width: number; height: number; dpr: number }
  | { type: 'visibility'; visible: boolean }
  | { type: 'theme'; theme: Theme }
  | { type: 'playing'; playing: boolean }
  | { type: 'engaged'; engaged: boolean; expanded: boolean }
  | { type: 'settings'; settings: Partial<Settings> }
  | PointerMessage
  | { type: 'wheel'; x: number; y: number; delta: number }
  | { type: 'key'; phase: 'down' | 'up'; code: string; shift: boolean }
  | { type: 'touchFlight'; input: TouchFlight }
  | { type: 'command'; action: 'back' | 'activateHover' | 'reset' | 'timeLapse' }
  | { type: 'goto'; target: 'galaxy' | 'system' | 'planet'; index: number; instant?: boolean }
  /** Ask for the list of marked star systems (a keyboard-friendly way in). */
  | { type: 'catalog' };

export interface HudInfo {
  visible: boolean;
  title: string;
  subtitle: string;
  hint: string;
  x: number;
  y: number;
  onDark: boolean;
  /** The hovered object can be entered with a click. */
  actionable: boolean;
}

export interface SystemSummary {
  name: string;
  subtitle: string;
  planets: { name: string; label: string }[];
}

export interface PlanetSummary {
  name: string;
  label: string;
  biomes: number;
  /** Gas and ice giants: cloud tops only, nothing to walk on. */
  giant: boolean;
}

export interface Instrument {
  biome: string;
  altitude: number;
  speed: number;
  heading: number;
  /** 0..1 local time of day (0.5 = noon). */
  daytime: number;
  light: 'day' | 'dusk' | 'night';
  walking: boolean;
  timeLapse: boolean;
}

export type FromEngine =
  | { type: 'ready'; backend: 'webgpu' | 'webgl2'; info: string }
  | { type: 'firstFrame' }
  /** Start-up progress (0..1) with a short label for the loading indicator. */
  | { type: 'progress'; value: number; label: string }
  /**
   * "retry: 'webgl'" asks the host for a fresh canvas: a canvas that once held
   * a WebGPU context can never give out a WebGL2 one. "retry: 'restart'"
   * means the worker never started (its canvas went with it): try again on a
   * new canvas later.
   */
  | { type: 'error'; message: string; retry?: 'webgl' | 'restart' }
  | { type: 'hud'; hud: HudInfo }
  | { type: 'catalog'; systems: { name: string; subtitle: string }[] }
  | {
      type: 'state';
      mode: Mode;
      travelling: boolean;
      label: string;
      system: SystemSummary | null;
      planet: PlanetSummary | null;
    }
  | { type: 'cursor'; cursor: string }
  | { type: 'instrument'; instrument: Instrument }
  | { type: 'fps'; fps: number; scale: number; debug?: string };
