import * as R from 'ramda';
import type { GameState, Planet, Rocket, Particle, Virus, Vec2, TechBro, RocketInput } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const EARTH_ORBIT_AU = 180;   // pixels
const MARS_ORBIT_AU  = 290;
const INFECTION_RATE_EARTH = 0.0008;
const INFECTION_RATE_MARS  = 0.0004;
const INFECTION_SPREAD_DIST = 70;
const VIRUS_SPAWN_INTERVAL  = 6;
const EXHAUST_INTERVAL      = 2;

// ── Rocket physics constants ──────────────────────────────────────────────────

const MAX_FUEL          = 1200;
const FUEL_BURN_RATE    = 1;
const THRUST_ACCEL      = 0.12;  // px/frame²
const MAX_SPEED         = 4;     // px/frame
const ROTATION_SPEED    = 0.045; // rad/frame
const LANDING_PAD       = 10;    // px past planet radius
const MAX_LANDING_SPEED = 1.5;   // px/frame
const LANDING_ANGLE_TOL = 40;    // degrees
const DRAG              = 0.999;
const DOCK_OFFSET       = 6;     // px above surface when docked
const BOUNCE_DAMPING    = 0.55;  // velocity multiplier on screen-edge bounce

export { MAX_FUEL, LANDING_PAD, MAX_LANDING_SPEED };

// ── Helpers ───────────────────────────────────────────────────────────────────

function vec2(x: number, y: number): Vec2 { return { x, y }; }

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function randomRange(lo: number, hi: number): number {
  return lo + Math.random() * (hi - lo);
}

function angleTo(from: Vec2, to: Vec2): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

// Ramda: build passengers list via R.map over an index array
function buildPassengers(): TechBro[] {
  const emojis = ['🤖', '👾', '💻', '🦾', '🧠'];
  return R.map(
    (i: number): TechBro => ({
      id: i,
      offsetX: -6 + i * 3,
      offsetY: randomRange(-2, 2),
      emoji: emojis[i % emojis.length],
    }),
    R.range(0, 5)
  );
}

// ── Initial state factory ─────────────────────────────────────────────────────

export function createInitialState(width: number, height: number): GameState {
  const cx = width / 2, cy = height / 2;
  const sun: Vec2 = vec2(cx, cy);

  const earth: Planet = {
    id: 'earth',
    label: 'Earth',
    orbitRadius: EARTH_ORBIT_AU,
    angle: Math.PI * 0.3,
    angularVelocity: 0.004,
    radius: 22,
    color: '#1a6bcc',
    glowColor: '#44aaff',
    screenPos: vec2(cx, cy),
    infectionLevel: 0.02,
    rotation: 0,
    rotationVelocity: 0.018,
  };

  const mars: Planet = {
    id: 'mars',
    label: 'Mars',
    orbitRadius: MARS_ORBIT_AU,
    angle: Math.PI * 1.1,
    angularVelocity: 0.0026,
    radius: 16,
    color: '#c1440e',
    glowColor: '#ff8844',
    screenPos: vec2(cx, cy),
    infectionLevel: 0,
    rotation: 0,
    rotationVelocity: 0.022,
  };

  const earthInitPos = vec2(
    cx + Math.cos(Math.PI * 0.3) * EARTH_ORBIT_AU,
    cy + Math.sin(Math.PI * 0.3) * EARTH_ORBIT_AU,
  );

  const rocket: Rocket = {
    pos: vec2(
      earthInitPos.x + Math.cos(-Math.PI / 2) * (22 + DOCK_OFFSET),
      earthInitPos.y + Math.sin(-Math.PI / 2) * (22 + DOCK_OFFSET),
    ),
    vel: vec2(0, 0),
    phase: 0,
    passengers: buildPassengers(),
    heading: -Math.PI / 2,
    exhaustTimer: 0,
    fuel: MAX_FUEL,
  };

  return {
    tick: 0,
    planets: [earth, mars],
    rocket,
    particles: [],
    viruses: [],
    phase: 'Patient Zero incubating on Earth…',
    victoryAchieved: false,
    victoryTick: 0,
    sunPos: sun,
    width,
    height,
    auScale: 1,
    rocketInput: { rotate: 0, thrust: false, brake: false },
  };
}

// ── Planet orbit update ───────────────────────────────────────────────────────

function updatePlanet(planet: Planet, sunPos: Vec2): Planet {
  const angle = planet.angle + planet.angularVelocity;
  const screenPos = vec2(
    sunPos.x + Math.cos(angle) * planet.orbitRadius,
    sunPos.y + Math.sin(angle) * planet.orbitRadius
  );
  return {
    ...planet,
    angle,
    screenPos,
    rotation: planet.rotation + planet.rotationVelocity,
  };
}

// ── Rocket state machine ──────────────────────────────────────────────────────

function dockedPos(planet: Planet): Vec2 {
  return vec2(
    planet.screenPos.x + Math.cos(-Math.PI / 2) * (planet.radius + DOCK_OFFSET),
    planet.screenPos.y + Math.sin(-Math.PI / 2) * (planet.radius + DOCK_OFFSET),
  );
}

function nozzleAngle(heading: number): number {
  return heading + Math.PI;
}

function angleDiffDeg(a: number, b: number): number {
  let d = ((b - a) * 180 / Math.PI) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return Math.abs(d);
}

function updateRocket(rocket: Rocket, earth: Planet, mars: Planet, input: RocketInput, width: number, height: number): Rocket {
  const updated = { ...rocket, exhaustTimer: rocket.exhaustTimer + 1 };

  // ── Docked on Earth ────────────────────────────────────────────────────────
  if (rocket.phase === 0) {
    const pos = dockedPos(earth);
    if (input.thrust) {
      const vel = vec2(Math.cos(updated.heading) * THRUST_ACCEL, Math.sin(updated.heading) * THRUST_ACCEL);
      return { ...updated, pos, vel, phase: 1, fuel: rocket.fuel - FUEL_BURN_RATE };
    }
    return { ...updated, pos };
  }

  // ── Docked on Mars ─────────────────────────────────────────────────────────
  if (rocket.phase === 3) {
    const pos = dockedPos(mars);
    if (input.thrust) {
      const vel = vec2(Math.cos(updated.heading) * THRUST_ACCEL, Math.sin(updated.heading) * THRUST_ACCEL);
      return { ...updated, pos, vel, phase: 1, fuel: rocket.fuel - FUEL_BURN_RATE };
    }
    return { ...updated, pos };
  }

  // ── Crashed ────────────────────────────────────────────────────────────────
  if (rocket.phase === 4) return updated;

  // ── In flight (phase 1) ────────────────────────────────────────────────────
  let { heading, vel, fuel } = updated;

  heading += input.rotate * ROTATION_SPEED;

  if (input.thrust) {
    vel = vec2(vel.x + Math.cos(heading) * THRUST_ACCEL, vel.y + Math.sin(heading) * THRUST_ACCEL);
    fuel -= FUEL_BURN_RATE;
  }

  if (input.brake) {
    vel = vec2(vel.x + Math.cos(heading + Math.PI) * THRUST_ACCEL, vel.y + Math.sin(heading + Math.PI) * THRUST_ACCEL);
    fuel -= FUEL_BURN_RATE;
  }

  let speed = Math.sqrt(vel.x ** 2 + vel.y ** 2);

  vel = vec2(vel.x * DRAG, vel.y * DRAG);
  if (speed > MAX_SPEED) {
    vel = vec2((vel.x / speed) * MAX_SPEED, (vel.y / speed) * MAX_SPEED);
  }

  let pos = vec2(updated.pos.x + vel.x, updated.pos.y + vel.y);

  // ── Screen boundary bounce ─────────────────────────────────────────────────
  if (pos.x < 0)      { pos = vec2(0,     pos.y); vel = vec2(Math.abs(vel.x) * BOUNCE_DAMPING,  vel.y); }
  if (pos.x > width)  { pos = vec2(width, pos.y); vel = vec2(-Math.abs(vel.x) * BOUNCE_DAMPING, vel.y); }
  if (pos.y < 0)      { pos = vec2(pos.x, 0);      vel = vec2(vel.x,  Math.abs(vel.y) * BOUNCE_DAMPING); }
  if (pos.y > height) { pos = vec2(pos.x, height);  vel = vec2(vel.x, -Math.abs(vel.y) * BOUNCE_DAMPING); }

  // ── Landing / crash check ──────────────────────────────────────────────────
  for (const planet of [earth, mars] as Planet[]) {
    const d = dist(pos, planet.screenPos);
    if (d > planet.radius + LANDING_PAD) continue;

    // Only evaluate when actually approaching — skip if moving away (e.g. just launched)
    const toPlanetX = planet.screenPos.x - pos.x;
    const toPlanetY = planet.screenPos.y - pos.y;
    const approaching = vel.x * toPlanetX + vel.y * toPlanetY > 0;
    if (!approaching) continue;

    const dirToPlanet = angleTo(pos, planet.screenPos);
    const nozzle = nozzleAngle(heading);
    const aligned = angleDiffDeg(nozzle, dirToPlanet) <= LANDING_ANGLE_TOL;
    const slow = speed <= MAX_LANDING_SPEED;

    if (aligned && slow) {
      const dockedPhase: 0 | 3 = planet.id === 'earth' ? 0 : 3;
      return { ...updated, pos: dockedPos(planet), vel: vec2(0, 0), heading: -Math.PI / 2, phase: dockedPhase, fuel: MAX_FUEL };
    }
    return { ...updated, pos, vel, heading, fuel, phase: 4 };
  }

  if (fuel <= 0) {
    return { ...updated, pos, vel, heading, fuel: 0, phase: 4 };
  }

  return { ...updated, pos, vel, heading, fuel };
}

// ── Infection spread ──────────────────────────────────────────────────────────

function updateInfection(
  planets: [Planet, Planet],
  rocket: Rocket,
  tick: number
): [Planet, Planet] {
  // Ramda: use R.map over planets tuple to apply infection updates
  const updated = R.map((p: Planet): Planet => {
    let rate = p.id === 'earth' ? INFECTION_RATE_EARTH : INFECTION_RATE_MARS;

    // Rocket on Mars massively accelerates Mars infection
    if (p.id === 'mars' && rocket.phase === 3) {
      rate = 0.003 + (tick % 300 === 0 ? 0.01 : 0);
    }
    return { ...p, infectionLevel: Math.min(1, p.infectionLevel + rate) };
  }, planets as Planet[]) as [Planet, Planet];

  return updated;
}

// ── Virus spawning ────────────────────────────────────────────────────────────

function spawnViruses(state: GameState): Virus[] {
  if (state.tick % VIRUS_SPAWN_INTERVAL !== 0) return state.viruses;

  const [earth, mars] = state.planets;

  // Ramda: R.filter to only keep alive viruses
  const alive = R.filter((v: Virus) => v.life > 0, state.viruses);

  const newViruses: Virus[] = [];

  const trySpawn = (planet: Planet) => {
    if (planet.infectionLevel < 0.05) return;
    const angle = Math.random() * Math.PI * 2;
    const r = planet.radius * (0.5 + Math.random() * 0.6);
    newViruses.push({
      pos: vec2(
        planet.screenPos.x + Math.cos(angle) * r,
        planet.screenPos.y + Math.sin(angle) * r
      ),
      vel: vec2(randomRange(-0.6, 0.6), randomRange(-0.6, 0.6)),
      life: 1,
      planet: planet.id,
    });
  };

  trySpawn(earth);
  if (state.rocket.phase === 3) trySpawn(mars);

  return [...alive, ...newViruses];
}

// ── Particle spawning (exhaust) ───────────────────────────────────────────────

function spawnExhaust(state: GameState): Particle[] {
  const { rocket } = state;

  // Ramda: R.filter out dead particles
  const alive = R.filter((p: Particle) => p.life > 0, state.particles);

  if (rocket.phase !== 1) return alive;
  if (rocket.exhaustTimer % EXHAUST_INTERVAL !== 0) return alive;

  const { thrust, brake } = state.rocketInput;
  if (!thrust && !brake) return alive;

  const newParticles: Particle[] = [];

  if (thrust) {
    const back = rocket.heading + Math.PI;
    const spread = 0.5;
    const exhaust: Particle[] = R.map(
      (_: number): Particle => ({
        pos: vec2(
          rocket.pos.x + Math.cos(back) * 24 + randomRange(-2, 2),
          rocket.pos.y + Math.sin(back) * 24 + randomRange(-2, 2)
        ),
        vel: vec2(
          Math.cos(back + randomRange(-spread, spread)) * randomRange(1, 3),
          Math.sin(back + randomRange(-spread, spread)) * randomRange(1, 3)
        ),
        life: 1,
        color: Math.random() > 0.5 ? '#ff9500' : '#ff4400',
        size: randomRange(2, 5),
      }),
      R.range(0, 4)
    );
    newParticles.push(...exhaust);
  }

  if (brake) {
    const forward = rocket.heading;
    const spread = 0.3;
    const rcs: Particle[] = R.map(
      (_: number): Particle => ({
        pos: vec2(
          rocket.pos.x + Math.cos(forward) * 18 + randomRange(-1, 1),
          rocket.pos.y + Math.sin(forward) * 18 + randomRange(-1, 1)
        ),
        vel: vec2(
          Math.cos(forward + randomRange(-spread, spread)) * randomRange(0.8, 2),
          Math.sin(forward + randomRange(-spread, spread)) * randomRange(0.8, 2)
        ),
        life: 0.6,
        color: Math.random() > 0.5 ? '#88ccff' : '#c0e8ff',
        size: randomRange(1, 2.5),
      }),
      R.range(0, 2)
    );
    newParticles.push(...rcs);
  }

  return [...alive, ...newParticles];
}

// ── Tick particles / viruses ──────────────────────────────────────────────────

function tickParticles(particles: Particle[]): Particle[] {
  // Ramda: R.map to advance each particle
  return R.filter(
    (p: Particle) => p.life > 0,
    R.map(
      (p: Particle): Particle => ({
        ...p,
        pos: vec2(p.pos.x + p.vel.x, p.pos.y + p.vel.y),
        vel: vec2(p.vel.x * 0.95, p.vel.y * 0.95),
        life: p.life - (p.decay ?? 0.025),
        size: p.size * 0.97,
      }),
      particles
    )
  );
}

function tickViruses(viruses: Virus[], planets: [Planet, Planet]): Virus[] {
  const [earth, mars] = planets;
  return R.filter(
    (v: Virus) => v.life > 0,
    R.map(
      (v: Virus): Virus => {
        const planet = v.planet === 'earth' ? earth : mars;
        // Drift toward planet centre weakly
        const dx = planet.screenPos.x - v.pos.x;
        const dy = planet.screenPos.y - v.pos.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
        const pull = 0.04;
        const newVel = vec2(
          v.vel.x + (dx / d) * pull,
          v.vel.y + (dy / d) * pull
        );
        const speed = Math.sqrt(newVel.x ** 2 + newVel.y ** 2);
        const cap = 1.2;
        const capped = speed > cap
          ? vec2((newVel.x / speed) * cap, (newVel.y / speed) * cap)
          : newVel;

        // Despawn if far outside planet or inside (absorbed)
        const newPos = vec2(v.pos.x + capped.x, v.pos.y + capped.y);
        const distToPlanet = dist(newPos, planet.screenPos);
        const newLife = distToPlanet < planet.radius * 0.4
          ? 0
          : distToPlanet > INFECTION_SPREAD_DIST
          ? 0
          : v.life - 0.008;

        return { ...v, pos: newPos, vel: capped, life: newLife };
      },
      viruses
    )
  );
}

// ── Explosion burst ───────────────────────────────────────────────────────────

function spawnExplosion(pos: Vec2): Particle[] {
  // Core: slow, large, white-hot — creates the intense bright centre
  const core: Particle[] = R.map(
    (_: number): Particle => {
      const angle = Math.random() * Math.PI * 2;
      return {
        pos: vec2(pos.x + randomRange(-2, 2), pos.y + randomRange(-2, 2)),
        vel: vec2(Math.cos(angle) * randomRange(0.05, 0.6), Math.sin(angle) * randomRange(0.05, 0.6)),
        life: 1,
        color: Math.random() > 0.4 ? '#ffffff' : '#ffee88',
        size: randomRange(14, 24),
        decay: 0.014,
      };
    },
    R.range(0, 20)
  );

  // Debris: faster but small and tight — edgy ring around the centre
  const debris: Particle[] = R.map(
    (_: number): Particle => {
      const angle = Math.random() * Math.PI * 2;
      return {
        pos: vec2(pos.x + randomRange(-3, 3), pos.y + randomRange(-3, 3)),
        vel: vec2(Math.cos(angle) * randomRange(0.4, 2.5), Math.sin(angle) * randomRange(0.4, 2.5)),
        life: 1,
        color: Math.random() > 0.5 ? '#ff4400' : '#ff8800',
        size: randomRange(1.5, 4),
        decay: 0.014,
      };
    },
    R.range(0, 50)
  );

  return [...core, ...debris];
}

// ── HUD phase label ───────────────────────────────────────────────────────────

function computePhaseLabel(state: GameState): string {
  const [, mars] = state.planets;
  const { rocket } = state;

  if (state.victoryAchieved) return '🦠 SOLAR SYSTEM INFECTED — Melon Tusk wins!';
  if (rocket.phase === 4) return '💥 CRASHED — Press R to restart';
  if (rocket.phase === 0) return '🌍 Docked on Earth — hold ↑ to launch';
  if (rocket.phase === 1) return '🚀 In flight';
  if (rocket.phase === 3 && mars.infectionLevel < 0.5) return '👾 Docked on Mars — tech bros spreading the virus…';
  if (rocket.phase === 3 && mars.infectionLevel >= 0.5) return '☣ Mars heavily infected! Hype spreading fast!';
  return '…';
}

// ── Master step function ──────────────────────────────────────────────────────

export function stepState(state: GameState): GameState {
  const [rawEarth, rawMars] = state.planets;

  const earth = updatePlanet(rawEarth, state.sunPos);
  const mars  = updatePlanet(rawMars,  state.sunPos);

  const rocket = updateRocket(state.rocket, earth, mars, state.rocketInput, state.width, state.height);

  const [infEarth, infMars] = updateInfection([earth, mars], rocket, state.tick);

  const viruses   = tickViruses(spawnViruses({ ...state, planets: [infEarth, infMars], rocket }), [infEarth, infMars]);
  const exhausted = spawnExhaust({ ...state, rocket });
  const exploded  = (rocket.phase === 4 && state.rocket.phase !== 4)
    ? [...exhausted, ...spawnExplosion(rocket.pos)]
    : exhausted;
  const particles = tickParticles(exploded);

  const victoryAchieved = infEarth.infectionLevel >= 1 && infMars.infectionLevel >= 0.99;

  const next: GameState = {
    ...state,
    tick: state.tick + 1,
    planets: [infEarth, infMars],
    rocket,
    particles,
    viruses,
    phase: '',
    victoryAchieved,
    victoryTick: victoryAchieved && !state.victoryAchieved ? state.tick : state.victoryTick,
  };
  next.phase = computePhaseLabel(next);
  return next;
}

export { dist, lerp, angleTo };
