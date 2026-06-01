import { animationFrameScheduler, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { createInitialState, stepState } from './simulation';
import { render, getPlanetHitRadius, largeDetailRadius } from './renderer';
import { loadGeoData, loadMarsGeoData } from './geo';
import type { GameState, UIState } from './types';

// ── Canvas setup ──────────────────────────────────────────────────────────────

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize(): void {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();

// ── Simulation state ──────────────────────────────────────────────────────────

let state: GameState = createInitialState(canvas.width, canvas.height);

// ── UI / interaction state ────────────────────────────────────────────────────

const ui: UIState = {
  selectedPlanet:  null,
  isDragging:      false,
  hasDragged:      false,
  dragStart:       null,
  earthRotation:   [-10, -20],  // show Europe/Africa on first open
  marsRotation:    [-134, -18], // centre on Olympus Mons region
  mousePos:        { x: -999, y: -999 },
};

// ── Geo data ──────────────────────────────────────────────────────────────────

loadGeoData().catch(console.error);
loadMarsGeoData().catch(console.error);

// ── Window resize ─────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  resize();
  state = { ...state, width: canvas.width, height: canvas.height };
});

// ── Cursor helpers ────────────────────────────────────────────────────────────

function updateCursor(): void {
  if (ui.isDragging) {
    canvas.style.cursor = 'grabbing';
    return;
  }
  if (ui.selectedPlanet) {
    canvas.style.cursor = 'grab';
    return;
  }
  // Hover over a small planet in solar system view?
  for (const planet of state.planets) {
    const d = Math.hypot(ui.mousePos.x - planet.screenPos.x, ui.mousePos.y - planet.screenPos.y);
    if (d < getPlanetHitRadius(planet)) {
      canvas.style.cursor = 'pointer';
      return;
    }
  }
  canvas.style.cursor = 'default';
}

// ── Mouse events ──────────────────────────────────────────────────────────────

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  ui.mousePos = { x: mx, y: my };

  if (ui.isDragging && ui.dragStart) {
    const dx = mx - ui.dragStart.x;
    const dy = my - ui.dragStart.y;

    if (!ui.hasDragged && Math.hypot(dx, dy) > 4) {
      ui.hasDragged = true;
    }

    if (ui.hasDragged) {
      // Sensitivity: dragging 2× the radius rotates ~180°
      const r = largeDetailRadius(canvas.width, canvas.height);
      const sens = 180 / (2 * r);

      if (ui.selectedPlanet === 'earth') {
        ui.earthRotation[0] -= dx * sens;
      } else if (ui.selectedPlanet === 'mars') {
        ui.marsRotation[0] -= dx * sens;
      }
      ui.dragStart = { x: mx, y: my };
    }
  }

  updateCursor();
});

canvas.addEventListener('mousedown', (e) => {
  if (!ui.selectedPlanet) return;
  const rect = canvas.getBoundingClientRect();
  ui.isDragging = true;
  ui.hasDragged = false;
  ui.dragStart  = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  updateCursor();
});

canvas.addEventListener('mouseup', () => {
  ui.isDragging = false;
  ui.dragStart  = null;
  updateCursor();
});

canvas.addEventListener('mouseleave', () => {
  ui.isDragging = false;
  ui.dragStart  = null;
});

canvas.addEventListener('click', (e) => {
  if (ui.hasDragged) return; // was a drag, not a click

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // ── In detail view: check "back" button or click outside sphere ──────────
  if (ui.selectedPlanet) {
    // Back button: top-left area (x 16–126, y 16–44)
    if (mx >= 16 && mx <= 126 && my >= 16 && my <= 44) {
      ui.selectedPlanet = null;
      return;
    }
    // Click outside the large sphere → deselect
    const r = largeDetailRadius(canvas.width, canvas.height);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    if (Math.hypot(mx - cx, my - cy) > r + 20) {
      ui.selectedPlanet = null;
    }
    return;
  }

  // ── Solar system view: select a planet ───────────────────────────────────
  for (const planet of state.planets) {
    const d = Math.hypot(mx - planet.screenPos.x, my - planet.screenPos.y);
    if (d < getPlanetHitRadius(planet)) {
      ui.selectedPlanet = planet.id;
      return;
    }
  }
});

// ── Keyboard ──────────────────────────────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') ui.selectedPlanet = null;
});

// ── Animation frame stream via RxJS ──────────────────────────────────────────

const frame$ = interval(0, animationFrameScheduler);

frame$
  .pipe(
    map(() => {
      state = stepState(state);
      return state;
    })
  )
  .subscribe({
    next: (s: GameState) => {
      try {
        render(ctx, s, ui);
      } catch (err) {
        console.error('render error', err);
      }
    },
    error: (err: unknown) => {
      console.error('stream error', err);
    },
  });
