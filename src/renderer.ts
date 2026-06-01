import * as d3 from 'd3';
import * as R from 'ramda';
import type { GameState, Planet, Particle, Virus, Vec2, UIState } from './types';
import { lerp } from './simulation';
import { geoReady, getLand, getBorders, marsGeoReady, getMarsTerrain } from './geo';

// ── Geo path context wrapper ──────────────────────────────────────────────────
// d3-geo renders to a canvas 2D context via d3.geoPath with a context target.

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  };
  const ca = parse(a), cb = parse(b);
  const r  = Math.round(lerp(ca[0], cb[0], t));
  const g  = Math.round(lerp(ca[1], cb[1], t));
  const bl = Math.round(lerp(ca[2], cb[2], t));
  return `rgb(${r},${g},${bl})`;
}

// ── Draw starfield (cached) ───────────────────────────────────────────────────

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

// ── Draw planet (solar system view) ──────────────────────────────────────────

function drawPlanet(ctx: CanvasRenderingContext2D, planet: Planet, isHovered: boolean): void {
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

  // "Click to explore" indicator when hovered
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

// ── Draw rocket ───────────────────────────────────────────────────────────────

function drawRocket(ctx: CanvasRenderingContext2D, state: GameState): void {
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

function updateHUD(state: GameState, ui: UIState): void {
  const hud = document.getElementById('hud');
  if (!hud) return;

  if (ui.selectedPlanet) {
    // Minimal HUD in detail view
    const planet = state.planets.find(p => p.id === ui.selectedPlanet)!;
    const classFor = (lvl: number) => lvl > 0.7 ? 'danger' : lvl > 0.35 ? 'warn' : '';
    hud.innerHTML = `
      <div class="${classFor(planet.infectionLevel)}">${planet.label} — ${(planet.infectionLevel * 100).toFixed(1)}% infected</div>
      <div style="color:#666;font-size:11px">drag to rotate • ESC to return</div>
    `.trim();
    return;
  }

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
  `.trim();
}

// ── Draw victory overlay ──────────────────────────────────────────────────────

function drawVictory(_ctx: CanvasRenderingContext2D, _state: GameState): void {}

// ── Planet detail (selected) view ─────────────────────────────────────────────

const MARS_LABELS: Array<{ name: string; lon: number; lat: number }> = [
  { name: 'Olympus Mons',     lon: -134, lat:  18 },
  { name: 'Valles Marineris', lon:  -59, lat: -14 },
  { name: 'Hellas Basin',     lon:   70, lat: -42 },
  { name: 'Tharsis',         lon: -112, lat:   0 },
];

function drawPlanetDetail(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ui: UIState,
): void {
  if (!ui.selectedPlanet) return;

  const planet = state.planets.find(p => p.id === ui.selectedPlanet)!;
  const { width, height } = state;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;

  // Dark overlay – solar system still visible behind
  ctx.fillStyle = 'rgba(0, 0, 10, 0.82)';
  ctx.fillRect(0, 0, width, height);

  const rot = ui.selectedPlanet === 'earth' ? ui.earthRotation : ui.marsRotation;

  const projection = d3.geoOrthographic()
    .scale(radius)
    .translate([cx, cy])
    .rotate([rot[0], rot[1], 0])
    .clipAngle(90);

  const pathGen = d3.geoPath(projection, ctx);

  // ── Atmosphere glow ──────────────────────────────────────────────────────
  const atmosColor = planet.id === 'earth' ? '#2255cc' : '#cc4411';
  const atmos = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.18);
  atmos.addColorStop(0, atmosColor + '55');
  atmos.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.18, 0, Math.PI * 2);
  ctx.fillStyle = atmos;
  ctx.fill();

  // ── Ocean / base sphere fill ─────────────────────────────────────────────
  const oceanColor = planet.id === 'earth' ? '#0a1f3c' : '#2a0e05';

  const sphereFill = ctx.createRadialGradient(
    cx - radius * 0.3, cy - radius * 0.3, radius * 0.05,
    cx, cy, radius
  );
  sphereFill.addColorStop(0, lerpColor(oceanColor, '#ffffff', 0.18));
  sphereFill.addColorStop(0.6, oceanColor);
  sphereFill.addColorStop(1, lerpColor(oceanColor, '#000000', 0.6));

  ctx.save();
  ctx.beginPath();
  pathGen({ type: 'Sphere' });
  ctx.fillStyle = sphereFill;
  ctx.fill();
  ctx.clip(); // clip all subsequent drawing to the sphere

  // ── Earth: continent land fill + country borders ─────────────────────────
  if (planet.id === 'earth' && geoReady()) {
    const land = getLand();
    const borders = getBorders();
    const landBase  = '#2a5a1a';
    const landLight = lerpColor(landBase, '#ffffff', 0.22);
    const landDark  = lerpColor(landBase, '#000000', 0.45);

    const landFill = ctx.createRadialGradient(
      cx - radius * 0.3, cy - radius * 0.3, radius * 0.05,
      cx, cy, radius
    );
    landFill.addColorStop(0, landLight);
    landFill.addColorStop(0.6, landBase);
    landFill.addColorStop(1, landDark);

    if (land) {
      ctx.beginPath();
      pathGen(land);
      ctx.fillStyle = landFill;
      ctx.fill();
    }

    // Country borders
    if (borders) {
      ctx.beginPath();
      pathGen(borders);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }

  // ── Mars: terrain from GeoJSON ────────────────────────────────────────────
  if (planet.id === 'mars' && marsGeoReady()) {
    const TERRAIN_COLORS: Record<string, string> = {
      northlow:  '#301410',  // northern volcanic plains — slightly darker/cooler
      southhigh: '#582015',  // ancient southern highlands — distinctly reddish
      highland:  '#b84020',
      plain:     '#6a2010',
      lowland:   '#1a0806',
      volcanic:  '#0e0404',
      canyon:    '#0a0202',
      crater:    '#8a3018',
    };
    const terrain = getMarsTerrain()!;
    for (const feat of terrain.features) {
      ctx.beginPath();
      pathGen(feat);
      ctx.fillStyle = TERRAIN_COLORS[feat.properties?.terrain ?? 'plain'] ?? '#2e1208';
      ctx.fill();
    }

  }

  // ── Graticule ────────────────────────────────────────────────────────────
  const step = planet.id === 'mars' ? 20 : 30;
  const graticule = d3.geoGraticule().step([step, step])();
  ctx.beginPath();
  pathGen(graticule);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  ctx.restore(); // restore clip

  // ── Specular highlight ───────────────────────────────────────────────────
  const spec = ctx.createRadialGradient(
    cx - radius * 0.38, cy - radius * 0.38, 0,
    cx, cy, radius
  );
  spec.addColorStop(0, 'rgba(255,255,255,0.35)');
  spec.addColorStop(0.45, 'transparent');
  ctx.beginPath();
  pathGen({ type: 'Sphere' });
  ctx.fillStyle = spec;
  ctx.fill();

  // ── Mars: landmark labels ────────────────────────────────────────────────
  if (planet.id === 'mars') {
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    for (const lm of MARS_LABELS) {
      const pt = projection([lm.lon, lm.lat]);
      if (!pt) continue;
      // Check visible hemisphere: geoOrthographic clips, but projection returns null for back side
      ctx.fillStyle = 'rgba(255, 180, 100, 0.85)';
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 220, 180, 0.9)';
      ctx.fillText(lm.name, pt[0], pt[1] - 7);
    }
  }

  // ── Planet sphere outline ────────────────────────────────────────────────
  ctx.beginPath();
  pathGen({ type: 'Sphere' });
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // ── Back button ──────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.roundRect(16, 16, 110, 28, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = '#ccc';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('◀  back to system', 26, 34);

  // ── Drag hint (fades after first drag) ──────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('drag to rotate', cx, cy + radius + 36);
}

// ── Hit test helpers (exported for main.ts) ───────────────────────────────────

export function getPlanetHitRadius(planet: Planet): number {
  return planet.radius + 12;
}

export function largeDetailRadius(width: number, height: number): number {
  return Math.min(width, height) * 0.38;
}

// ── Master render call ────────────────────────────────────────────────────────

export function render(ctx: CanvasRenderingContext2D, state: GameState, ui: UIState): void {
  const { width, height, sunPos, tick } = state;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  drawStars(ctx, width, height, tick);
  drawSun(ctx, sunPos, tick);

  drawOrbitRing(ctx, sunPos.x, sunPos.y, state.planets[0].orbitRadius);
  drawOrbitRing(ctx, sunPos.x, sunPos.y, state.planets[1].orbitRadius);

  drawParticles(ctx, state.particles);

  for (const planet of state.planets) {
    const hovered = !ui.selectedPlanet &&
      Math.hypot(ui.mousePos.x - planet.screenPos.x, ui.mousePos.y - planet.screenPos.y)
        < getPlanetHitRadius(planet);
    drawPlanet(ctx, planet, hovered);
  }

  drawRocket(ctx, state);
  drawViruses(ctx, state.viruses, tick);
  drawVictory(ctx, state);

  // Detail overlay drawn last so it sits on top of everything
  drawPlanetDetail(ctx, state, ui);

  updateHUD(state, ui);
}
