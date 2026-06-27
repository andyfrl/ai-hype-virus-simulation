import * as d3 from 'd3';
import * as R from 'ramda';
import type { GameState, Planet, Particle, Virus, Vec2 } from '../types';
import { lerpColor } from '../utils/color';

interface Star { x: number; y: number; r: number; a: number }

let cachedStars: Star[] | null = null;

function getStars(width: number, height: number): Star[] {
  if (!cachedStars) {
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

export function drawStars(ctx: CanvasRenderingContext2D, width: number, height: number, tick: number): void {
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

export function drawSun(ctx: CanvasRenderingContext2D, pos: Vec2, tick: number): void {
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

export function drawOrbitRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawPlanet(ctx: CanvasRenderingContext2D, planet: Planet, isHovered: boolean): void {
  const { screenPos: { x, y }, radius, rotation, infectionLevel, glowColor, id } = planet;

  const glowRadius = isHovered ? radius * 2.2 : radius * 1.8;
  const grd = ctx.createRadialGradient(x, y, radius * 0.7, x, y, glowRadius);
  grd.addColorStop(0, glowColor + (isHovered ? '88' : '55'));
  grd.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();

  const projection = d3.geoOrthographic()
    .scale(radius)
    .translate([x, y])
    .rotate([rotation * (180 / Math.PI), -20, 0])
    .clipAngle(90);

  const pathGen = d3.geoPath(projection, ctx);

  const baseFill = ctx.createRadialGradient(
    x - radius * 0.3, y - radius * 0.3, radius * 0.05,
    x, y, radius
  );
  const baseColor = id === 'earth' ? '#1a6bcc' : '#c1440e';
  baseFill.addColorStop(0, lerpColor(baseColor, '#ffffff', 0.25));
  baseFill.addColorStop(0.6, baseColor);
  baseFill.addColorStop(1, lerpColor(baseColor, '#000000', 0.5));

  ctx.save();
  ctx.beginPath();
  pathGen({ type: 'Sphere' });
  ctx.fillStyle = baseFill;
  ctx.fill();
  ctx.clip();

  const graticule = d3.geoGraticule().step([30, 30])();
  ctx.beginPath();
  pathGen(graticule);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

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

  if (isHovered) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▶ explore', x, y - radius - 6);
  }

  ctx.fillStyle = '#fff';
  ctx.font = `bold 11px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(planet.label, x, y + radius + 14);

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

export function drawApproachRings(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { rocket, planets } = state;
  if (rocket.phase !== 1) return;

  for (const planet of planets) {
    const d = Math.sqrt((rocket.pos.x - planet.screenPos.x) ** 2 + (rocket.pos.y - planet.screenPos.y) ** 2);
    const approachRadius = planet.radius * 4;
    if (d > approachRadius) continue;

    ctx.save();
    ctx.beginPath();
    ctx.arc(planet.screenPos.x, planet.screenPos.y, approachRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}

export function drawRocket(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { rocket } = state;
  const { pos, heading, phase } = rocket;
  const crashed   = phase === 4;
  const flying    = phase === 1;
  const thrusting = flying && state.rocketInput.thrust;
  const braking   = flying && state.rocketInput.brake;

  ctx.save();
  if (crashed) ctx.globalAlpha = 0.4;
  ctx.translate(pos.x, pos.y);
  ctx.rotate(heading);

  // ── Main engine flame (behind body) ──────────────────────────────────────
  if (thrusting) {
    const fl = 12 + Math.random() * 10;
    ctx.beginPath();
    ctx.moveTo(-22, -5);
    ctx.lineTo(-22 - fl, 0);
    ctx.lineTo(-22, 5);
    ctx.closePath();
    ctx.fillStyle = `rgba(255,${(60 + Math.random() * 80) | 0},0,0.88)`;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-22, -2.5);
    ctx.lineTo(-22 - fl * 0.55, 0);
    ctx.lineTo(-22, 2.5);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,240,180,0.95)';
    ctx.fill();
  }

  // ── Nozzle bell ───────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(-14, -2.5);
  ctx.lineTo(-22, -5);
  ctx.lineTo(-22,  5);
  ctx.lineTo(-14,  2.5);
  ctx.closePath();
  ctx.fillStyle = crashed ? '#2a2a2a' : '#3a3a3a';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-14, -1.5);
  ctx.lineTo(-20, -3.5);
  ctx.lineTo(-20,  3.5);
  ctx.lineTo(-14,  1.5);
  ctx.closePath();
  ctx.fillStyle = thrusting ? 'rgba(255,180,60,0.7)' : (crashed ? '#111' : '#1a1a1a');
  ctx.fill();

  // ── Engine skirt ──────────────────────────────────────────────────────────
  ctx.fillStyle = crashed ? '#333' : '#4a4a4a';
  ctx.fillRect(-14, -4, 3, 8);

  // ── Aft body flaps ────────────────────────────────────────────────────────
  ctx.fillStyle = crashed ? '#333' : '#606060';
  ctx.beginPath();
  ctx.moveTo(-4, -4); ctx.lineTo(-11, -4); ctx.lineTo(-14, -13); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4,  4); ctx.lineTo(-11,  4); ctx.lineTo(-14,  13); ctx.closePath();
  ctx.fill();

  // ── Main body (stainless steel gradient) ─────────────────────────────────
  const steel = ctx.createLinearGradient(0, -5, 0, 5);
  steel.addColorStop(0,   crashed ? '#999' : '#e4e4e4');
  steel.addColorStop(0.4, crashed ? '#777' : '#c8c8c8');
  steel.addColorStop(1,   crashed ? '#555' : '#8a8a8a');
  ctx.beginPath();
  ctx.roundRect(-11, -4, 25, 8, 1.5);
  ctx.fillStyle = crashed ? '#777' : steel;
  ctx.fill();
  ctx.strokeStyle = crashed ? '#555' : '#aaa';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // ── Heat-tile band (dark lower strip) ────────────────────────────────────
  if (!crashed) {
    ctx.beginPath();
    ctx.roundRect(-11, 1.5, 25, 2.5, [0, 0, 1.5, 1.5]);
    ctx.fillStyle = 'rgba(40,40,40,0.45)';
    ctx.fill();
  }

  // ── Forward canards ───────────────────────────────────────────────────────
  ctx.fillStyle = crashed ? '#444' : '#909090';
  ctx.beginPath();
  ctx.moveTo(9, -4); ctx.lineTo(5, -4); ctx.lineTo(4, -9); ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9,  4); ctx.lineTo(5,  4); ctx.lineTo(4,  9); ctx.closePath();
  ctx.fill();

  // ── Nose dome ─────────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(14, -4);
  ctx.quadraticCurveTo(20, -4, 22, 0);
  ctx.quadraticCurveTo(20,  4, 14, 4);
  ctx.closePath();
  ctx.fillStyle = crashed ? '#666' : '#d4d4d4';
  ctx.fill();
  ctx.strokeStyle = crashed ? '#444' : '#aaa';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // ── Specular highlight ────────────────────────────────────────────────────
  if (!crashed) {
    ctx.beginPath();
    ctx.roundRect(-9, -3.5, 21, 2, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
  }

  // ── Forward RCS jets ──────────────────────────────────────────────────────
  if (braking) {
    const jl = 6 + Math.random() * 5;
    const a  = (0.6 + Math.random() * 0.35).toFixed(2);
    const c  = `rgba(140,210,255,${a})`;
    ctx.beginPath();
    ctx.moveTo(18, -3); ctx.lineTo(18 + jl, -3 - jl * 0.5); ctx.lineTo(18 + jl * 0.8, -3);
    ctx.closePath(); ctx.fillStyle = c; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(18,  3); ctx.lineTo(18 + jl,  3 + jl * 0.5); ctx.lineTo(18 + jl * 0.8,  3);
    ctx.closePath(); ctx.fillStyle = c; ctx.fill();
  }

  ctx.restore();

  // ── Passengers ────────────────────────────────────────────────────────────
  if (!crashed) {
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(heading);
    ctx.font = '7px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const bro of rocket.passengers) {
      ctx.fillText(bro.emoji, bro.offsetX, bro.offsetY);
    }
    ctx.restore();
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life * 0.9);
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, Math.max(0.1, p.size), 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawViruses(ctx: CanvasRenderingContext2D, viruses: Virus[], tick: number): void {
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
