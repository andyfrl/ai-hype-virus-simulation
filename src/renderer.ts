import * as d3 from 'd3';
import * as R from 'ramda';
import type { GameState, Planet, Particle, Virus, Vec2 } from './types';
import { lerp } from './simulation';

// ── Geo path context wrapper ──────────────────────────────────────────────────
// d3-geo renders to a canvas 2D context via d3.geoPath with a context target.

function lerpColor(a: string, b: string, t: number): string {
  // Quick hex lerp for infection tinting
  const parse = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  };
  const ca = parse(a), cb = parse(b);
  const r = Math.round(lerp(ca[0], cb[0], t));
  const g = Math.round(lerp(ca[1], cb[1], t));
  const bl = Math.round(lerp(ca[2], cb[2], t));
  return `rgb(${r},${g},${bl})`;
}

// ── Draw starfield (cached) ───────────────────────────────────────────────────

interface Star { x: number; y: number; r: number; a: number }

let cachedStars: Star[] | null = null;

function getStars(width: number, height: number): Star[] {
  if (!cachedStars) {
    // Ramda: R.map over range to create star objects
    cachedStars = R.map(
      (_: number): Star => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 0.8 + 0.2,
      }),
      R.range(0, 300)
    );
  }
  return cachedStars;
}

function drawStars(ctx: CanvasRenderingContext2D, width: number, height: number, tick: number): void {
  const stars = getStars(width, height);
  for (const s of stars) {
    const twinkle = 0.5 + 0.5 * Math.sin(tick * 0.05 + s.x);
    ctx.globalAlpha = s.a * twinkle;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Draw Sun ──────────────────────────────────────────────────────────────────

function drawSun(ctx: CanvasRenderingContext2D, pos: Vec2, tick: number): void {
  const pulse = 28 + 4 * Math.sin(tick * 0.04);
  const grd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, pulse * 2.2);
  grd.addColorStop(0, '#fff7a0');
  grd.addColorStop(0.3, '#ffcc00');
  grd.addColorStop(0.7, '#ff8800');
  grd.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, pulse * 2.2, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, pulse, 0, Math.PI * 2);
  ctx.fillStyle = '#fffde0';
  ctx.fill();
}

// ── Draw orbit ring ───────────────────────────────────────────────────────────

function drawOrbitRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ── Draw planet using d3.geoOrthographic ─────────────────────────────────────

function drawPlanet(ctx: CanvasRenderingContext2D, planet: Planet): void {
  const { screenPos: { x, y }, radius, rotation, infectionLevel, glowColor, id } = planet;

  // Glow / atmosphere
  const grd = ctx.createRadialGradient(x, y, radius * 0.7, x, y, radius * 1.8);
  grd.addColorStop(0, glowColor + '55');
  grd.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.8, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();

  // ── d3 geoOrthographic sphere ────────────────────────────────────────────
  // Build a projection centred on the planet's screen position
  const projection = d3.geoOrthographic()
    .scale(radius)
    .translate([x, y])
    .rotate([rotation * (180 / Math.PI), -20, 0])
    .clipAngle(90);

  const pathGen = d3.geoPath(projection, ctx);

  // Base sphere fill (gradient from pole to equator)
  const baseFill = ctx.createRadialGradient(
    x - radius * 0.3, y - radius * 0.3, radius * 0.05,
    x, y, radius
  );
  const baseColor = id === 'earth'
    ? lerpColor('#1a6bcc', '#00aa00', infectionLevel > 0.3 ? infectionLevel - 0.3 : 0)
    : lerpColor('#c1440e', '#22aa00', infectionLevel);
  const infectedColor = id === 'earth' ? '#33cc00' : '#55ff00';
  baseFill.addColorStop(0, lerpColor(baseColor, '#ffffff', 0.25));
  baseFill.addColorStop(0.6, baseColor);
  baseFill.addColorStop(1, lerpColor(baseColor, '#000000', 0.5));

  ctx.save();
  // Clip to sphere disc
  ctx.beginPath();
  pathGen({ type: 'Sphere' });
  ctx.fillStyle = baseFill;
  ctx.fill();
  ctx.clip();

  // Infected patches as filled circles (geo graticule gives the sphere lines)
  const patchCount = Math.floor(infectionLevel * 12);
  if (patchCount > 0) {
    // Ramda: R.map to generate infection patch draw calls
    R.map(
      (i: number) => {
        const lon = ((i * 137.5) % 360) - 180;
        const lat = ((i * 97.3) % 180) - 90;
        const patchProj = projection([lon, lat]);
        if (!patchProj) return;
        const pr = radius * (0.25 + (i % 3) * 0.12) * infectionLevel;
        ctx.beginPath();
        ctx.arc(patchProj[0], patchProj[1], pr, 0, Math.PI * 2);
        ctx.fillStyle = infectedColor + 'bb';
        ctx.fill();
      },
      R.range(0, patchCount)
    );
  }

  // Graticule lines for the pseudo-3D grid feel
  const graticule = d3.geoGraticule().step([30, 30])();
  ctx.beginPath();
  pathGen(graticule);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Highlight (specular)
  ctx.restore();
  const spec = ctx.createRadialGradient(
    x - radius * 0.35, y - radius * 0.35, 0,
    x, y, radius
  );
  spec.addColorStop(0, 'rgba(255,255,255,0.4)');
  spec.addColorStop(0.45, 'transparent');
  ctx.beginPath();
  pathGen({ type: 'Sphere' });
  ctx.fillStyle = spec;
  ctx.fill();

  // Label
  ctx.fillStyle = '#fff';
  ctx.font = `bold 11px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(planet.label, x, y + radius + 14);

  // Infection bar
  const barW = radius * 2;
  const barH = 4;
  const bx = x - barW / 2, by = y + radius + 18;
  ctx.fillStyle = '#333';
  ctx.fillRect(bx, by, barW, barH);
  const barColor = infectionLevel > 0.7 ? '#f00' : infectionLevel > 0.4 ? '#f80' : '#0f0';
  ctx.fillStyle = barColor;
  ctx.fillRect(bx, by, barW * infectionLevel, barH);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(bx, by, barW, barH);

  const pct = (infectionLevel * 100).toFixed(1);
  ctx.fillStyle = '#aaa';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${pct}% infected`, x, by + barH + 10);
}

// ── Draw rocket ───────────────────────────────────────────────────────────────

function drawRocket(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { rocket } = state;
  if (rocket.phase === 0) return;

  const { pos, heading } = rocket;

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(heading);

  // Body
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-8, -7);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-8, 7);
  ctx.closePath();
  ctx.fillStyle = '#e8e8e8';
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Nose cone
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(10, -4);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fillStyle = '#f00';
  ctx.fill();

  // Window
  ctx.beginPath();
  ctx.arc(2, 0, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#4af';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // Fins
  ctx.beginPath();
  ctx.moveTo(-8, -7);
  ctx.lineTo(-16, -14);
  ctx.lineTo(-14, -7);
  ctx.fillStyle = '#c00';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-8, 7);
  ctx.lineTo(-16, 14);
  ctx.lineTo(-14, 7);
  ctx.fillStyle = '#c00';
  ctx.fill();

  ctx.restore();

  // Passengers (emojis behind the rocket)
  if (rocket.phase === 1 || rocket.phase === 3) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(heading);
    ctx.font = '9px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const bro of rocket.passengers) {
      ctx.fillText(bro.emoji, bro.offsetX, bro.offsetY);
    }
    ctx.restore();
  }
}

// ── Draw exhaust particles ────────────────────────────────────────────────────

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 0.9);
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, Math.max(0.1, p.size), 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Draw virus particles ──────────────────────────────────────────────────────

function drawViruses(ctx: CanvasRenderingContext2D, viruses: Virus[], tick: number): void {
  for (const v of viruses) {
    const pulse = 0.6 + 0.4 * Math.sin(tick * 0.2 + v.pos.x);
    ctx.globalAlpha = v.life * pulse;
    ctx.font = '10px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦠', v.pos.x, v.pos.y);
  }
  ctx.globalAlpha = 1;
}

// ── Draw HUD ──────────────────────────────────────────────────────────────────

function updateHUD(state: GameState): void {
  const hud = document.getElementById('hud');
  if (!hud) return;

  const [earth, mars] = state.planets;
  const rPhase = ['Docked on Earth', 'In Flight', '', 'Landed on Mars', 'Crashed'][state.rocket.phase];

  const classFor = (lvl: number) => lvl > 0.7 ? 'danger' : lvl > 0.35 ? 'warn' : '';

  hud.innerHTML = `
    <div>☣ AI HYPE VIRUS OUTBREAK</div>
    <div>Tick: ${state.tick}</div>
    <div class="${classFor(earth.infectionLevel)}">🌍 Earth: ${(earth.infectionLevel * 100).toFixed(1)}%</div>
    <div class="${classFor(mars.infectionLevel)}">🔴 Mars: ${(mars.infectionLevel * 100).toFixed(1)}%</div>
    <div>🚀 Rocket: ${rPhase}</div>
    <div>${state.phase}</div>
    ${state.victoryAchieved ? '<div class="danger">🏆 MELON TUSK WINS THE SOLAR SYSTEM</div>' : ''}
  `.trim();
}

// ── Victory overlay ───────────────────────────────────────────────────────────

function drawVictory(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (!state.victoryAchieved) return;
  const elapsed = state.tick - state.victoryTick;
  const alpha = Math.min(1, elapsed / 120);
  ctx.fillStyle = `rgba(0,180,0,${alpha * 0.18})`;
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#0f0';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('☣ AI HYPE VIRUS CONQUERS THE SOLAR SYSTEM ☣', state.width / 2, state.height / 2);
  ctx.font = '20px monospace';
  ctx.fillStyle = '#8f8';
  ctx.fillText('Melon Tusk & Tech Bros infected every planet. GG.', state.width / 2, state.height / 2 + 50);
  ctx.globalAlpha = 1;
}

// ── Master render call ────────────────────────────────────────────────────────

export function render(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height, sunPos, tick } = state;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  drawStars(ctx, width, height, tick);
  drawSun(ctx, sunPos, tick);

  // Orbit rings
  drawOrbitRing(ctx, sunPos.x, sunPos.y, state.planets[0].orbitRadius);
  drawOrbitRing(ctx, sunPos.x, sunPos.y, state.planets[1].orbitRadius);

  drawParticles(ctx, state.particles);

  for (const planet of state.planets) {
    drawPlanet(ctx, planet);
  }

  drawRocket(ctx, state);
  drawViruses(ctx, state.viruses, tick);
  drawVictory(ctx, state);
  updateHUD(state);
}
