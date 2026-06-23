import type { GameState, UIState } from '../types';

export interface PlanetDetailRenderer {
  readonly planetId: string;
  render(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    ui: UIState,
  ): void;
}

const registry = new Map<string, PlanetDetailRenderer>();

export function registerPlanetRenderer(r: PlanetDetailRenderer): void {
  registry.set(r.planetId, r);
}

export function getPlanetRenderer(planetId: string): PlanetDetailRenderer | undefined {
  return registry.get(planetId);
}
