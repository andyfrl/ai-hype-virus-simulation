import * as d3 from 'd3';
import type { GameState, UIState } from '../types';
import { marsGeoReady, getMarsTerrain } from '../geo';
import type { PlanetDetailRenderer } from './planet-detail-renderer';
import { registerPlanetRenderer } from './planet-detail-renderer';

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

const TERRAIN_COLORS: Record<string, string> = {
  northlow:  '#cc5828',
  southhigh: '#9c3e1c',
  highland:  '#b44820',
  plain:     '#be4e24',
  lowland:   '#3c1608',
  volcanic:  '#c05828',
  canyon:    '#2c1006',
  crater:    '#3a1608',
};

const ELEVATED = new Set(['volcanic', 'highland', 'plain']);
const DEPRESSED = new Set(['crater', 'lowland', 'canyon']);

function drawMarsDetail(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ui: UIState,
): void {
  const { width, height } = state;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;
  const rot = ui.marsRotation;

  const projection = d3.geoOrthographic()
    .scale(radius)
    .translate([cx, cy])
    .rotate([rot[0], rot[1], 0])
    .clipAngle(90);

  const pathGen = d3.geoPath(projection, ctx);

  const atmosColor = '#a04820';
  const atmos = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, radius * 1.18);
  atmos.addColorStop(0, atmosColor + '55');
  atmos.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.18, 0, Math.PI * 2);
  ctx.fillStyle = atmos;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  pathGen({ type: 'Sphere' });

  const marsGrad = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
  marsGrad.addColorStop(0.00, '#d05e2c');
  marsGrad.addColorStop(0.35, '#c45028');
  marsGrad.addColorStop(0.50, '#b84420');
  marsGrad.addColorStop(0.65, '#a83c1c');
  marsGrad.addColorStop(1.00, '#8c3018');
  ctx.fillStyle = marsGrad;
  ctx.fill();
  ctx.clip();

  if (marsGeoReady()) {
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

        ctx.beginPath();
        pathGen(feat);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        pathGen(feat);
        ctx.clip();
        ctx.translate(3, 4);
        ctx.beginPath();
        pathGen(feat);
        ctx.fillStyle = 'rgba(95, 38, 10, 0.45)';
        ctx.fill();
        ctx.restore();

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

    const limb = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    limb.addColorStop(0.4, 'transparent');
    limb.addColorStop(1, 'rgba(12, 4, 2, 0.65)');
    ctx.beginPath();
    pathGen({ type: 'Sphere' });
    ctx.fillStyle = limb;
    ctx.fill();
  }

  const graticule = d3.geoGraticule().step([20, 20])();
  ctx.beginPath();
  pathGen(graticule);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.lineWidth = 0.6;
  ctx.stroke();

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

  ctx.restore();

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

  ctx.setLineDash([]);
  ctx.beginPath();
  pathGen({ type: 'Sphere' });
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

const marsRenderer: PlanetDetailRenderer = {
  planetId: 'mars',
  render: drawMarsDetail,
};

registerPlanetRenderer(marsRenderer);
