# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start Vite dev server (hot-reload)
npm run build    # tsc type-check + Vite production build → dist/
npm run preview  # serve dist/ locally
```

There are no tests. Type-check alone: `npx tsc --noEmit`.

## Architecture

This is a **vanilla TypeScript + Vite** browser app — no framework. The entry point is `src/main.ts`.

### Rendering loop

`main.ts` drives everything via an RxJS `interval(0, animationFrameScheduler)` observable. Each tick:
1. `stepState(state)` in `simulation.ts` → returns a new immutable `GameState`
2. `render(ctx, state, ui)` in `renderer.ts` → draws to a `<canvas>`

`GameState` (pure simulation) and `UIState` (interaction: selected planet, drag state, per-planet rotation) are kept separate. `UIState` is mutated directly in event handlers in `main.ts`; `GameState` is never mutated — `stepState` always returns a new object.

### Module responsibilities

| File | Role |
|---|---|
| `types.ts` | All shared interfaces: `GameState`, `Planet`, `Rocket`, `Virus`, `Particle`, `UIState` |
| `simulation.ts` | Pure state machine: `createInitialState`, `stepState`. Uses Ramda (`R.map`, `R.filter`, `R.range`) for functional transforms over particles/viruses |
| `renderer.ts` | All canvas drawing. Two modes: solar-system view (small planets orbiting) and detail view (full-sphere `d3.geoOrthographic` projection). Exports `getPlanetHitRadius` and `largeDetailRadius` used by `main.ts` for hit-testing |
| `geo.ts` | Async loaders for Earth (`countries-110m.json` via topojson) and Mars (`mars-terrain.json`) geo data. Exposes ready-flags (`geoReady()`, `marsGeoReady()`) polled each render frame |
| `sidebar.ts` | Left sidebar (200px): Build/Crew mode tabs, tile grid. Calls `showCrewModal` on tile click |
| `modal.ts` | Crew character modal with cycling speech-bubble quotes loaded from `src/data/quotes/*.json` |

### Geo rendering

- **Earth detail**: d3-geo orthographic projection renders TopoJSON land + country borders. Data in `public/countries-110m.json`.
- **Mars detail**: Custom GeoJSON (`public/mars-terrain.json`) with `terrain` property on each feature (types: `northlow`, `southhigh`, `highland`, `plain`, `lowland`, `volcanic`, `canyon`, `crater`). Elevated terrain uses canvas `shadowBlur`; depressed features (craters/basins/canyons) use a 4-pass stroke+fill technique for rim lighting.

The canvas width is `window.innerWidth - SIDEBAR_WIDTH` (sidebar is an HTML overlay, not on canvas).

### Static assets

`public/` holds all runtime-fetched files: geo JSON, character JPEG images, SVG icons. Reference them as absolute paths (`/mtuga.jpeg`, etc.) — Vite copies them to `dist/` verbatim.

## Architectural Refactoring Standards
1. **File Splitting Criteria**: If a file has grown too large or holds multiple responsibilities, review the internal logic. Extract tightly coupled functions or secondary entities into separate, dedicated files inside the same folder or an adjacent modules folder.
2. **Implementation Extensibility (Generalization)**: Look for code paths that feel overly specific but should logically be extensible. Abstract these hardcoded implementations into generalized utilities and provide a clean internal API or design pattern (such as the Factory, Strategy, or Provider patterns).
3. **Safety Guardrails**: Because this project does not use testing or linting, you must run the project's Build command after every individual modification. If compilation fails or type definitions break, immediately revert the file.
