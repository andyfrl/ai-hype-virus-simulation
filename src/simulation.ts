import * as R from 'ramda';
import type { GameState, Planet, Rocket, Particle, Virus, Vec2, TechBro } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const EARTH_ORBIT_AU = 180;   // pixels
const MARS_ORBIT_AU  = 290;
const ROCKET_SPEED   = 1.4;   // px/frame while cruising
const INFECTION_RATE_EARTH = 0.0008;
const INFECTION_RATE_MARS  = 0.0004;
const INFECTION_SPREAD_DIST = 70;
const VIRUS_SPAWN_INTERVAL  = 6;
const EXHAUST_INTERVAL      = 2;

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
      offsetX: -14 - i * 7,
      offsetY: randomRange(-4, 4),
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

  const rocket: Rocket = {
    pos: vec2(cx, cy),
    vel: vec2(0, 0),
    phase: 0,
    passengers: buildPassengers(),
    heading: 0,
    exhaustTimer: 0,
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

function updateRocket(rocket: Rocket, earth: Planet, mars: Planet, tick: number): Rocket {
  const updated = { ...rocket, exhaustTimer: rocket.exhaustTimer + 1 };

  if (rocket.phase === 0) {
    // Idle on Earth — launch after 200 ticks
    if (tick > 200) {
      return { ...updated, phase: 1, pos: { ...earth.screenPos } };
    }
    return { ...updated, pos: { ...earth.screenPos } };
  }

  if (rocket.phase === 1) {
    // Launch — fly toward Mars
    const target = mars.screenPos;
    const heading = angleTo(updated.pos, target);
    const speed = ROCKET_SPEED;
    const newPos = vec2(
      updated.pos.x + Math.cos(heading) * speed,
      updated.pos.y + Math.sin(heading) * speed
    );
    const arrived = dist(newPos, target) < mars.radius + 4;
    return {
      ...updated,
      pos: newPos,
      vel: vec2(Math.cos(heading) * speed, Math.sin(heading) * speed),
      heading,
      phase: arrived ? 3 : 1,
    };
  }

  if (rocket.phase === 3) {
    // Landing on Mars — stay attached
    return { ...updated, pos: { ...mars.screenPos }, vel: vec2(0, 0), phase: 3 };
  }

  return updated;
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

  const back = rocket.heading + Math.PI;
  const spread = 0.5;
  const newParticles: Particle[] = R.map(
    (_: number): Particle => ({
      pos: vec2(
        rocket.pos.x + Math.cos(back) * 8 + randomRange(-2, 2),
        rocket.pos.y + Math.sin(back) * 8 + randomRange(-2, 2)
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
        life: p.life - 0.025,
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

// ── HUD phase label ───────────────────────────────────────────────────────────

function computePhaseLabel(state: GameState): string {
  const [, mars] = state.planets;
  const { rocket } = state;

  if (state.victoryAchieved) return '🦠 SOLAR SYSTEM INFECTED — Melon Tusk wins!';
  if (rocket.phase === 0) return '🌍 Patient Zero incubating on Earth…';
  if (rocket.phase === 1) return '🚀 Melon Tusk departing for Mars!';
  if (rocket.phase === 3 && mars.infectionLevel < 0.5) return '👾 Tech bros spreading AI Hype Virus on Mars…';
  if (rocket.phase === 3 && mars.infectionLevel >= 0.5) return '☣ Mars heavily infected! Hype spreading fast!';
  return '…';
}

// ── Master step function ──────────────────────────────────────────────────────

export function stepState(state: GameState): GameState {
  const [rawEarth, rawMars] = state.planets;

  const earth = updatePlanet(rawEarth, state.sunPos);
  const mars  = updatePlanet(rawMars,  state.sunPos);

  const rocket = updateRocket(state.rocket, earth, mars, state.tick);

  const [infEarth, infMars] = updateInfection([earth, mars], rocket, state.tick);

  const viruses   = tickViruses(spawnViruses({ ...state, planets: [infEarth, infMars], rocket }), [infEarth, infMars]);
  const particles = tickParticles(spawnExhaust({ ...state, rocket }));

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
