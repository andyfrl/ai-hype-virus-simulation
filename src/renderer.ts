import type { GameState, Planet, UIState } from './types';
import { getPlanetRenderer } from './renderers';
import {
  drawStars,
  drawSun,
  drawOrbitRing,
  drawPlanet,
  drawRocket,
  drawParticles,
  drawViruses,
} from './renderers/solar-system';

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

  if (ui.selectedPlanet) {
    drawDetailOverlay(ctx, state, ui);
  }
}

// ── Detail overlay: dark backdrop + planet-specific renderer + shared chrome ──

function drawDetailOverlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  ui: UIState,
): void {
  const { width, height } = state;

  ctx.fillStyle = 'rgba(0, 0, 10, 0.82)';
  ctx.fillRect(0, 0, width, height);

  const planetRenderer = getPlanetRenderer(ui.selectedPlanet!);
  planetRenderer?.render(ctx, state, ui);

  drawDetailChrome(ctx, state);
}

function drawDetailChrome(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { width, height } = state;
  const cx = width / 2;
  const cy = height / 2;
  const radius = largeDetailRadius(width, height);

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

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('drag to rotate', cx, cy + radius + 36);
}
