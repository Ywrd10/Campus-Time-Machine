import { PLACES } from './places';

// Frontend-only schematic positions. Generation uses the unchanged relay place IDs.
export const WAYPOINTS = [
  { placeId: 'memory-mall', x: 59, y: 22, label: 'MEMORY MALL', number: '01' },
  { placeId: 'student-union', x: 48, y: 47, label: 'STUDENT UNION', number: '02' },
  { placeId: 'library', x: 44, y: 70, label: 'LIBRARY', number: '03' },
  { placeId: 'reflecting-pond', x: 58, y: 79, label: 'REFLECTING POND', number: '04' },
  { placeId: 'engineering-1', x: 64, y: 48, label: 'ENGINEERING I', number: '05' },
  { placeId: 'engineering-2', x: 70, y: 66, label: 'ENGINEERING II', number: '06' },
  { placeId: 'research-1', x: 84, y: 57, label: 'RESEARCH I', number: '07' },
  { placeId: 'health-sciences-1', x: 40, y: 14, label: 'HEALTH SCIENCES I', number: '08' },
  { placeId: 'john-t-washington', x: 17, y: 55, label: 'JOHN T. WASHINGTON CTR', number: '09' },
  { placeId: 'cypress-dome', x: 86, y: 15, label: 'CYPRESS DOME', number: '10' },
] as const;

export interface MapView { zoom: number; x: number; y: number }
export const DEFAULT_MAP_VIEW: MapView = { zoom: 1, x: 0, y: 0 };
export function constrainMap(view: MapView): MapView {
  const zoom = Math.min(3, Math.max(1, view.zoom));
  if (zoom === 1) return { ...DEFAULT_MAP_VIEW };
  const limit = (zoom - 1) * 50;
  return { zoom, x: Math.min(limit, Math.max(-limit, view.x)), y: Math.min(limit, Math.max(-limit, view.y)) };
}
export function waypointPlace(id?: string) {
  return WAYPOINTS.some(point => point.placeId === id) ? PLACES.find(place => place.id === id) : undefined;
}
