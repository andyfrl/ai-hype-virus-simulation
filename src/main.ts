import { animationFrameScheduler, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { createInitialState, stepState } from './simulation';
import { render } from './renderer';
import type { GameState } from './types';

// ── Canvas setup ──────────────────────────────────────────────────────────────

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize(): void {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();

// ── Mutable simulation state ──────────────────────────────────────────────────
// Updated inside the RxJS subscription each frame.

let state: GameState = createInitialState(canvas.width, canvas.height);

// ── Window resize ─────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  resize();
  state = { ...state, width: canvas.width, height: canvas.height };
});

// ── Animation frame stream via RxJS ──────────────────────────────────────────
// interval(0, animationFrameScheduler) fires once per animation frame (~60 fps).

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
        render(ctx, s);
      } catch (e) {
        console.error('render error', e);
      }
    },
    error: (e: unknown) => {
      console.error('stream error', e);
    },
  });
