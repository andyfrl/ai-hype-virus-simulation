import './styles/base.css';
import './styles/hud.css';
import { animationFrameScheduler, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { createInitialState, stepState, MAX_FUEL, WIN_INFECTION_THRESHOLD } from './simulation';
import { render, getPlanetHitRadius, largeDetailRadius } from './renderer';
import { loadGeoData, loadMarsGeoData } from './geo';
import { initSidebar, setSidebarVisible, SIDEBAR_WIDTH } from './sidebar';
import type { GameState, UIState } from './types';
import { RocketPhase } from './types';

// ── Canvas setup ──────────────────────────────────────────────────────────────

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let activeSidebarWidth = 0;

function resize(): void {
  canvas.width  = window.innerWidth - activeSidebarWidth;
  canvas.height = window.innerHeight;
}

initSidebar(); // hides sidebar on init
resize();

// ── Simulation state ──────────────────────────────────────────────────────────

let state: GameState = createInitialState(canvas.width, canvas.height);

// ── UI / interaction state ────────────────────────────────────────────────────

const ui: UIState = {
  selectedPlanet:  null,
  isDragging:      false,
  hasDragged:      false,
  dragStart:       null,
  rotations: {
    earth: [-10, -20],  // show Europe/Africa on first open
    mars:  [-134, -18], // centre on Olympus Mons region
  },
  mousePos:        { x: -999, y: -999 },
};

function selectPlanet(id: UIState['selectedPlanet']): void {
  ui.selectedPlanet = id;
  const show = id !== null;
  setSidebarVisible(show);
  activeSidebarWidth = show ? SIDEBAR_WIDTH : 0;
  resize();
  state = { ...state, width: canvas.width, height: canvas.height };
}

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

      if (ui.selectedPlanet) {
        ui.rotations[ui.selectedPlanet][0] -= dx * sens;
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
      selectPlanet(null);
      return;
    }
    // Click outside the large sphere → deselect
    const r = largeDetailRadius(canvas.width, canvas.height);
    const cx = canvas.width / 2, cy = canvas.height / 2;
    if (Math.hypot(mx - cx, my - cy) > r + 20) {
      selectPlanet(null);
    }
    return;
  }

  // ── Solar system view: select a planet ───────────────────────────────────
  for (const planet of state.planets) {
    const d = Math.hypot(mx - planet.screenPos.x, my - planet.screenPos.y);
    if (d < getPlanetHitRadius(planet)) {
      selectPlanet(planet.id);
      return;
    }
  }
});

// ── HUD DOM update ────────────────────────────────────────────────────────────

function updateHUD(s: GameState, uiState: UIState): void {
  const hud = document.getElementById('hud');
  if (!hud) return;

  if (uiState.selectedPlanet) {
    const planet = s.planets.find(p => p.id === uiState.selectedPlanet)!;
    const classFor = (lvl: number) => lvl > 0.7 ? 'danger' : lvl > 0.35 ? 'warn' : '';
    hud.innerHTML = `
      <div class="${classFor(planet.infectionLevel)}">${planet.label} — ${(planet.infectionLevel * 100).toFixed(1)}% infected</div>
      <div style="color:#666;font-size:11px">drag to rotate • ESC to return</div>
    `.trim();
    return;
  }

  const classFor = (lvl: number) => lvl > 0.7 ? 'danger' : lvl > 0.35 ? 'warn' : '';
  const fuelPct = Math.round((s.rocket.fuel / MAX_FUEL) * 100);
  const fuelClass = fuelPct < 20 ? 'danger' : fuelPct < 40 ? 'warn' : '';
  const speed = Math.sqrt(s.rocket.vel.x ** 2 + s.rocket.vel.y ** 2).toFixed(2);

  const planetRows = s.planets.map(p => `
    <div class="${classFor(p.infectionLevel)}">${p.emoji} ${p.label}: ${
      p.visited ? `${(p.infectionLevel * 100).toFixed(1)}%` : 'not visited'
    }</div>`).join('');

  hud.innerHTML = `
    <div>☣ AI HYPE VIRUS OUTBREAK</div>
    <div>Goal: infect all planets to ${WIN_INFECTION_THRESHOLD * 100}%</div>
    ${planetRows}
    <div class="${fuelClass}">⛽ Fuel: ${fuelPct}%</div>
    ${s.rocket.phase === RocketPhase.Flight ? `<div>Speed: ${speed} px/f</div>` : ''}
    <div>${s.phase}</div>
    ${s.rocket.phase === RocketPhase.Crashed ? '<div class="danger">Press R to restart</div>' : ''}
  `.trim();
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

const keysHeld = new Set<string>();

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { selectPlanet(null); return; }
  if (e.key === 'r' || e.key === 'R') {
    if (state.rocket.phase === RocketPhase.Crashed) {
      state = createInitialState(canvas.width, canvas.height);
    }
    return;
  }
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
    keysHeld.add(e.key);
  }
});

window.addEventListener('keyup', (e) => {
  keysHeld.delete(e.key);
});

// ── Animation frame stream via RxJS ──────────────────────────────────────────

const frame$ = interval(0, animationFrameScheduler);

frame$
  .pipe(
    map(() => {
      const rotate = (keysHeld.has('ArrowRight') ? 1 : 0) - (keysHeld.has('ArrowLeft') ? 1 : 0);
      const thrust = keysHeld.has('ArrowUp');
      const brake  = keysHeld.has('ArrowDown');
      state = stepState({ ...state, rocketInput: { rotate, thrust, brake } });
      return state;
    })
  )
  .subscribe({
    next: (s: GameState) => {
      try {
        render(ctx, s, ui);
        updateHUD(s, ui);
      } catch (err) {
        console.error('render error', err);
      }
    },
    error: (err: unknown) => {
      console.error('stream error', err);
    },
  });
