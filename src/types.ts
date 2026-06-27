// ── Domain types ──────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

export interface Planet {
  id: 'earth' | 'mars';
  label: string;
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

export interface Rocket {
  /** Current world position */
  pos: Vec2;
  /** Velocity vector */
  vel: Vec2;
  /** 0=docked on Earth, 1=in flight, 3=docked on Mars, 4=crashed */
  phase: 0 | 1 | 3 | 4;
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
}

export interface Virus {
  pos: Vec2;
  vel: Vec2;
  life: number;
  planet: 'earth' | 'mars';
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
  planets: [Planet, Planet];   // [earth, mars]
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
  selectedPlanet: 'earth' | 'mars' | null;
  /** True while mouse button is held on the large planet */
  isDragging: boolean;
  /** True once the drag has moved > 4px (suppresses click-to-deselect) */
  hasDragged: boolean;
  dragStart: { x: number; y: number } | null;
  /** Independent interactive rotation per planet — [lambda, phi] in degrees */
  earthRotation: [number, number];
  marsRotation: [number, number];
  /** Current mouse canvas position (for hover cursor changes) */
  mousePos: { x: number; y: number };
}
