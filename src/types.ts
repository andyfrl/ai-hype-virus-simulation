// ── Domain types ──────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

/** Extend this union when adding a new planet */
export type PlanetId = 'earth' | 'mars';

export interface Planet {
  id: PlanetId;
  label: string;
  /** Emoji used in the HUD readout */
  emoji: string;
  /** Orbital radius in AU-screen units */
  orbitRadius: number;
  /** Current orbital angle (radians) */
  angle: number;
  /** Orbital angular velocity (rad/frame) */
  angularVelocity: number;
  /** Display radius (pixels) */
  radius: number;
  /** Base fill colour */
  color: string;
  /** Atmosphere / glow colour */
  glowColor: string;
  /** Current screen-space centre after projection */
  screenPos: Vec2;
  /** Infection fraction 0–1 */
  infectionLevel: number;
  /** Base infection growth per frame while visited (boosted while the rocket is docked) */
  infectionRate: number;
  /** True once the rocket has docked here — infection only grows on visited planets */
  visited: boolean;
  /** Pseudo-3D rotation angle (for geo projection sphere) */
  rotation: number;
  /** Rotation velocity (rad/frame) */
  rotationVelocity: number;
}

export interface TechBro {
  id: number;
  /** Position relative to rocket nose */
  offsetX: number;
  offsetY: number;
  /** Tiny face emoji for fun */
  emoji: string;
}

// ── Rocket phase constants ────────────────────────────────────────────────────

export const RocketPhase = {
  Docked: 'docked',
  Flight: 'flight',
  Crashed: 'crashed',
} as const;

export type RocketPhase = (typeof RocketPhase)[keyof typeof RocketPhase];

export interface Rocket {
  /** Current world position */
  pos: Vec2;
  /** Velocity vector */
  vel: Vec2;
  phase: RocketPhase;
  /** Planet the rocket is docked on (only when phase === Docked) */
  dockedOn: PlanetId | null;
  /** Passengers */
  passengers: TechBro[];
  /** Heading angle (radians, 0 = right) */
  heading: number;
  /** Exhaust particle timer */
  exhaustTimer: number;
  /** Current fuel 0–MAX_FUEL */
  fuel: number;
}

export interface Particle {
  pos: Vec2;
  vel: Vec2;
  life: number;   // 0–1
  color: string;
  size: number;
  /** Life reduction per frame. Defaults to 0.025 (~40 frames at 60fps). */
  decay?: number;
}

export interface Virus {
  pos: Vec2;
  vel: Vec2;
  life: number;
  planet: PlanetId;
}

export interface RocketInput {
  /** -1 = rotate left, 0 = none, +1 = rotate right */
  rotate: number;
  /** true while Up arrow held — thrust in heading direction */
  thrust: boolean;
  /** true while Down arrow held — retro-thrust opposite to velocity */
  brake: boolean;
}

export interface GameState {
  tick: number;
  planets: Planet[];
  rocket: Rocket;
  particles: Particle[];
  viruses: Virus[];
  /** Phase label for HUD */
  phase: string;
  /** Did Melon Tusk win? */
  victoryAchieved: boolean;
  victoryTick: number;
  sunPos: Vec2;
  /** Canvas dimensions */
  width: number;
  height: number;
  /** Projection scale – AU to pixels */
  auScale: number;
  /** Player input this frame, written by main.ts before stepState */
  rocketInput: RocketInput;
}

// ── Sidebar state ─────────────────────────────────────────────────────────────

export type SidebarMode = 'build' | 'crew';

export interface SidebarState {
  mode: SidebarMode;
  selectedTile: string | null;
}

// ── UI / interaction state (not part of simulation) ───────────────────────────

export interface UIState {
  /** Currently selected planet, or null */
  selectedPlanet: PlanetId | null;
  /** True while mouse button is held on the large planet */
  isDragging: boolean;
  /** True once the drag has moved > 4px (suppresses click-to-deselect) */
  hasDragged: boolean;
  dragStart: { x: number; y: number } | null;
  /** Independent interactive rotation per planet — [lambda, phi] in degrees */
  rotations: Record<PlanetId, [number, number]>;
  /** Current mouse canvas position (for hover cursor changes) */
  mousePos: { x: number; y: number };
}
