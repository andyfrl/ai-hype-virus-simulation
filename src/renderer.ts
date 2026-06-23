import * as d3 from 'd3';
import * as R from 'ramda';
import type { GameState, Planet, Particle, Virus, Vec2, UIState } from './types';
import { geoReady, getLand, getBorders, marsGeoReady, getMarsTerrain } from './geo';
import { lerpColor } from './utils/color';

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

// ── Draw victory overlay ──────────────────────────────────────────────────────

function drawVictory(_ctx: CanvasRenderingContext2D, _state: GameState): void {}

// ── Planet detail (selected) view ─────────────────────────────────────────────

const MARS_LABELS: Array<{ name: string; lon: number; lat: number }> = [
  { name: 'Olympus Mons',      lon: -134, lat:  18 },
  { name: 'Valles Marineris',  lon:  -59, lat: -14 },
  { name: 'Hellas Planitia',   lon:   68, lat: -43 },
  { name: 'Tharsis',           lon: -105, lat:   2 },
  { name: 'Arabia Terra',      lon:   28, lat:  22 },
  { name: 'Amazonis Planitia', lon: -152, lat:  25 },
  { name: 'Vastitas Borealis', lon:   20, lat:  68 },
  { name: 'Acidalia Planitia', lon:  -28, lat:  46 },
  { name: 'Arcadia Planitia',  lon: -163, lat:  50 },
  { name: 'Utopia Planitia',   lon:  110, lat:  47 },
  { name: 'Isidis Planitia',   lon:   88, lat:  13 },
  { name: 'Argyre Planitia',   lon:  -43, lat: -50 },
  { name: 'Noachis Terra',     lon:  -22, lat: -48 },
  { name: 'Hesperia Planum',   lon:  112, lat: -22 },
  { name: 'Sirenum Planum',    lon: -158, lat: -46 },
  { name: 'Terra Cimmeria',    lon:  148, lat: -43 },
  { name: 'Syrtis Major',      lon:   67, lat:   9 },
  { name: 'Elysium Mons',      lon:  147, lat:  25 },
];

const MARS_REGIONS: Array<{ coords: [number, number][] }> = [
  { coords: [ // Arabia Terra
    [-25,  2], [ 20, -5], [ 55,  0], [ 65, 18], [ 58, 35],
    [ 40, 48], [ 10, 50], [-12, 42], [-22, 28], [-25,  2],
  ]},
  { coords: [ // Amazonis Planitia
    [-122,  5], [-150,  0], [-170,  8], [-176, 24], [-170, 45],
    [-148, 50], [-128, 40], [-118, 22], [-122,  5],
  ]},
  { coords: [ // Hellas Planitia
    [ 50, -32], [ 98, -32], [105, -48], [ 92, -65],
    [ 58, -65], [ 42, -50], [ 50, -32],
  ]},
  { coords: [ // Argyre Planitia
    [-65, -38], [-22, -38], [-18, -52], [-30, -65],
    [-58, -65], [-68, -52], [-65, -38],
  ]},
  { coords: [ // Isidis Planitia
    [ 72,  -2], [108,  -2], [112,  15], [ 96,  32],
    [ 76,  32], [ 68,  15], [ 72,  -2],
  ]},
  { coords: [ // Acidalia Planitia
    [-68, 22], [ 8, 22], [ 12, 48], [  2, 72],
    [-48, 74], [-72, 56], [-68, 22],
  ]},
  { coords: [ // Utopia Planitia
    [ 76, 30], [152, 30], [156, 55], [138, 76],
    [ 94, 78], [ 72, 58], [ 76, 30],
  ]},
  { coords: [ // Noachis Terra
    [-78, -28], [ 18, -28], [ 20, -50], [  8, -68],
    [-38, -72], [-78, -55], [-78, -28],
  ]},
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
  const atmosColor = planet.id === 'earth' ? '#2255cc' : '#a04820';
  const atmos = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.18);
  atmos.addColorStop(0, atmosColor + '55');
  atmos.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.18, 0, Math.PI * 2);
  ctx.fillStyle = atmos;
  ctx.fill();

  // ── Base sphere fill ─────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  pathGen({ type: 'Sphere' });

  if (planet.id === 'earth') {
    const oceanColor = '#0a1f3c';
    const earthFill = ctx.createRadialGradient(
      cx - radius * 0.3, cy - radius * 0.3, radius * 0.05,
      cx, cy, radius
    );
    earthFill.addColorStop(0, lerpColor(oceanColor, '#ffffff', 0.18));
    earthFill.addColorStop(0.6, oceanColor);
    earthFill.addColorStop(1, lerpColor(oceanColor, '#000000', 0.60));
    ctx.fillStyle = earthFill;
  } else {
    // N/S gradient: northern lowlands lighter-orange, southern highlands darker-rust,
    // with a wide blended band so there's no visible seam
    const marsGrad = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
    marsGrad.addColorStop(0.00, '#d05e2c'); // north pole area
    marsGrad.addColorStop(0.35, '#c45028'); // northern lowlands
    marsGrad.addColorStop(0.50, '#b84420'); // equatorial blend
    marsGrad.addColorStop(0.65, '#a83c1c'); // southern highlands
    marsGrad.addColorStop(1.00, '#8c3018'); // south pole area
    ctx.fillStyle = marsGrad;
  }
  ctx.fill();
  ctx.clip();

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

    if (borders) {
      ctx.beginPath();
      pathGen(borders);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }

  // ── Mars: terrain regions ────────────────────────────────────────────────
  if (planet.id === 'mars' && marsGeoReady()) {
    const TERRAIN_COLORS: Record<string, string> = {
      northlow:  '#cc5828',  // Vastitas Borealis — warm orange, northern lowlands are lighter
      southhigh: '#9c3e1c',  // southern highlands — darker brownish-rust
      highland:  '#b44820',  // cratered highland terrain
      plain:     '#be4e24',  // smooth plains
      lowland:   '#3c1608',  // Hellas / Argyre / Isidis basins — very dark like the image
      volcanic:  '#c05828',  // Tharsis plateau
      canyon:    '#2c1006',  // Valles Marineris — darkest feature
      crater:    '#3a1608',  // smaller impact craters
    };
    // Sun from upper-left: elevated features cast shadow bottom-right,
    // depressed features (craters/basins) show a warm lit outer rim.
    const ELEVATED = new Set(['volcanic', 'highland', 'plain']);
    const DEPRESSED = new Set(['crater', 'lowland', 'canyon']);

    const terrain = getMarsTerrain()!;
    for (const feat of terrain.features) {
      const t = feat.properties?.terrain ?? 'plain';
      if (t === 'northlow' || t === 'southhigh') continue;
      const color = TERRAIN_COLORS[t] ?? '#9a4828';

      if (ELEVATED.has(t)) {
        ctx.save();
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 4;
        ctx.shadowColor = 'rgba(8, 2, 0, 0.65)';
        ctx.beginPath();
        pathGen(feat);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      } else if (DEPRESSED.has(t)) {
        // Pass 1: wide warm rim stroke with drop shadow — rim casts shadow outward on terrain
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 4;
        ctx.shadowColor = 'rgba(5, 1, 0, 0.65)';
        ctx.beginPath();
        pathGen(feat);
        ctx.strokeStyle = 'rgba(148, 62, 20, 0.9)';
        ctx.lineWidth = 5;
        ctx.stroke();
        ctx.restore();

        // Pass 2: dark interior fill hides inner half of the stroke above
        ctx.beginPath();
        pathGen(feat);
        ctx.fillStyle = color;
        ctx.fill();

        // Pass 3: lit inner wall — sun from upper-left, so lower-right interior is illuminated
        ctx.save();
        ctx.beginPath();
        pathGen(feat);
        ctx.clip();
        ctx.translate(3, 4); // shift fill toward lower-right inside the clip
        ctx.beginPath();
        pathGen(feat);
        ctx.fillStyle = 'rgba(95, 38, 10, 0.45)';
        ctx.fill();
        ctx.restore();

        // Pass 4: thin warm rim line on top
        ctx.beginPath();
        pathGen(feat);
        ctx.strokeStyle = 'rgba(170, 80, 28, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.beginPath();
        pathGen(feat);
        ctx.fillStyle = color;
        ctx.fill();
      }
    }

    // Polar caps
    const nCap = d3.geoCircle().center([0, 90]).radius(13)();
    ctx.beginPath();
    pathGen(nCap);
    ctx.fillStyle = '#d8d0c4';
    ctx.fill();

    const sCap = d3.geoCircle().center([0, -90]).radius(10)();
    ctx.beginPath();
    pathGen(sCap);
    ctx.fillStyle = '#e0d8cc';
    ctx.fill();

    // Limb darkening over the whole sphere (base + terrain)
    const limb = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    limb.addColorStop(0.4, 'transparent');
    limb.addColorStop(1, 'rgba(12, 4, 2, 0.65)');
    ctx.beginPath();
    pathGen({ type: 'Sphere' });
    ctx.fillStyle = limb;
    ctx.fill();
  }

  // ── Graticule ────────────────────────────────────────────────────────────
  const step = planet.id === 'mars' ? 20 : 30;
  const graticule = d3.geoGraticule().step([step, step])();
  ctx.beginPath();
  pathGen(graticule);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // ── Mars: region borders (inside canvas clip, no-clipAngle projection) ──
  if (planet.id === 'mars') {
    const borderProj = d3.geoOrthographic()
      .scale(radius).translate([cx, cy]).rotate([rot[0], rot[1], 0]);
    const borderPath = d3.geoPath(borderProj, ctx);
    ctx.strokeStyle = 'rgba(220, 160, 90, 0.30)';
    ctx.lineWidth = 0.8;
    for (const region of MARS_REGIONS) {
      const feature = {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [region.coords] },
        properties: {},
      };
      ctx.beginPath();
      borderPath(feature);
      ctx.stroke();
    }
  }

  ctx.restore(); // restore clip

  // ── Specular highlight (Earth only — Mars is matte dust) ────────────────
  if (planet.id === 'earth') {
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
  }

  // ── Mars: landmark labels ────────────────────────────────────────────────
  if (planet.id === 'mars') {
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    for (const lm of MARS_LABELS) {
      const pt = projection([lm.lon, lm.lat]);
      if (!pt) continue;
      ctx.fillStyle = 'rgba(255, 180, 100, 0.85)';
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 220, 180, 0.9)';
      ctx.fillText(lm.name, pt[0], pt[1] - 7);
    }
  }

  // ── Planet sphere outline ────────────────────────────────────────────────
  ctx.setLineDash([]);
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
}
