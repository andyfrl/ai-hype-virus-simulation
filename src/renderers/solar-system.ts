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

export function drawRocket(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { rocket } = state;
  if (rocket.phase === 0) return;

  const { pos, heading } = rocket;

  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(heading);

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

  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(10, -4);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fillStyle = '#f00';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(2, 0, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#4af';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 0.8;
  ctx.stroke();

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
