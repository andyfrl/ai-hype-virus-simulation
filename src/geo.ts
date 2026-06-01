import * as topojson from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { FeatureCollection, MultiLineString, Geometry, GeoJsonProperties } from 'geojson';

// ── Earth ─────────────────────────────────────────────────────────────────────

let _land: FeatureCollection<Geometry, GeoJsonProperties> | null = null;
let _borders: MultiLineString | null = null;
let _earthReady = false;

export async function loadGeoData(): Promise<void> {
  const resp = await fetch('/countries-110m.json');
  const topo = await resp.json() as Topology;
  const objects = topo.objects as Record<string, GeometryCollection>;
  _land    = topojson.feature(topo, objects['land']);
  _borders = topojson.mesh(topo, objects['countries'], (a, b) => a !== b);
  _earthReady = true;
}

export function geoReady(): boolean { return _earthReady; }
export function getLand(): FeatureCollection<Geometry, GeoJsonProperties> | null { return _land; }
export function getBorders(): MultiLineString | null { return _borders; }

// ── Mars ──────────────────────────────────────────────────────────────────────

export interface MarsFeatureProps { terrain: string; name?: string }
export type MarsTerrainFC = FeatureCollection<Geometry, MarsFeatureProps>;

let _marsTerrain: MarsTerrainFC | null = null;

export async function loadMarsGeoData(): Promise<void> {
  const resp = await fetch('/mars-terrain.json');
  _marsTerrain = await resp.json() as MarsTerrainFC;
}

export function marsGeoReady(): boolean { return _marsTerrain !== null; }
export function getMarsTerrain(): MarsTerrainFC | null { return _marsTerrain; }
