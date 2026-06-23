import './styles/sidebar.css';
import { showCrewModal } from './modal';
import type { SidebarState } from './types';
import { CREW_MEMBERS } from './data/crew';

export const SIDEBAR_WIDTH = 200;

interface TileData {
  id: string;
  icon: string;      // emoji, or empty string when image is used
  image?: string;    // path relative to public root
  name: string;
  cost: number;
}

const BUILDINGS: TileData[] = [
  { id: 'launch-pad', icon: '🚀', name: 'Launch Pad',   cost: 100 },
  { id: 'power-core', icon: '⚡', name: 'Power Core',   cost:  75 },
  { id: 'radar',      icon: '📡', name: 'Radar Array',  cost:  80 },
  { id: 'ore-silo',   icon: '🏗️', name: 'Ore Silo',    cost:  50 },
  { id: 'barracks',   icon: '🏢', name: 'Barracks',     cost:  90 },
  { id: 'turret',     icon: '🗼', name: 'Turret',       cost: 120 },
  { id: 'research',   icon: '🔬', name: 'Research Lab', cost: 150 },
  { id: 'med-bay',    icon: '💊', name: 'Med Bay',      cost:  85 },
];

const CREW: TileData[] = CREW_MEMBERS.map(m => ({ id: m.id, icon: '', image: m.image, name: m.name, cost: m.cost }));

export function initSidebar(): SidebarState {
  const state: SidebarState = { mode: 'build', selectedTile: null };

  const tilesEl  = document.getElementById('sidebar-tiles')!;
  const btnBuild = document.getElementById('btn-build')!;
  const btnCrew  = document.getElementById('btn-crew')!;

  function renderTiles(): void {
    const items = state.mode === 'build' ? BUILDINGS : CREW;
    tilesEl.innerHTML = items.map(t => `
      <div class="tile${state.selectedTile === t.id ? ' selected' : ''}" data-id="${t.id}">
        ${t.image
          ? `<img class="tile-img" src="${t.image}" alt="${t.name}" />`
          : `<span class="tile-icon">${t.icon}</span>`}
        <span class="tile-name">${t.name}</span>
        <span class="tile-cost">◈${t.cost}</span>
      </div>
    `).join('');

    tilesEl.querySelectorAll<HTMLElement>('.tile').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id!;
        state.selectedTile = state.selectedTile === id ? null : id;
        renderTiles();
        if (state.mode === 'crew') {
          showCrewModal(id, () => { /* hire logic TBD */ });
        }
      });
    });
  }

  btnBuild.addEventListener('click', () => {
    state.mode = 'build';
    state.selectedTile = null;
    btnBuild.classList.add('active');
    btnCrew.classList.remove('active');
    renderTiles();
  });

  btnCrew.addEventListener('click', () => {
    state.mode = 'crew';
    state.selectedTile = null;
    btnBuild.classList.remove('active');
    btnCrew.classList.add('active');
    renderTiles();
  });

  renderTiles();
  return state;
}
