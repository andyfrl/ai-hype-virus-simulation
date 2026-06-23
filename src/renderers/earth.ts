import * as d3 from 'd3';
import type { GameState, UIState } from '../types';
import { geoReady, getLand, getBorders } from '../geo';
import { lerpColor } from '../utils/color';
import type { PlanetDetailRenderer } from './planet-detail-renderer';
import { registerPlanetRenderer } from './planet-detail-renderer';

function drawEarthDetail(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ui: UIState,
): void {
  const { width, height } = state;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.38;
  const rot = ui.earthRotation;

  const projection = d3.geoOrthographic()
    .scale(radius)
    .translate([cx, cy])
    .rotate([rot[0], rot[1], 0])
    .clipAngle(90);

  const pathGen = d3.geoPath(projection, ctx);

  const atmosColor = '#2255cc';
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

  const oceanColor = '#0a1f3c';
  const earthFill = ctx.createRadialGradient(
    cx - radius * 0.3, cy - radius * 0.3, radius * 0.05,
    cx, cy, radius
  );
  earthFill.addColorStop(0, lerpColor(oceanColor, '#ffffff', 0.18));
  earthFill.addColorStop(0.6, oceanColor);
  earthFill.addColorStop(1, lerpColor(oceanColor, '#000000', 0.60));
  ctx.fillStyle = earthFill;
  ctx.fill();
  ctx.clip();

  if (geoReady()) {
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

  const graticule = d3.geoGraticule().step([30, 30])();
  ctx.beginPath();
  pathGen(graticule);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  ctx.restore();

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

  ctx.setLineDash([]);
  ctx.beginPath();
  pathGen({ type: 'Sphere' });
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

const earthRenderer: PlanetDetailRenderer = {
  planetId: 'earth',
  render: drawEarthDetail,
};

registerPlanetRenderer(earthRenderer);
