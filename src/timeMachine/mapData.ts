import { PLACES } from './places';
import geography from './campusGeography.json';
import { geographicPath, MAP_SIZE, projectCoordinate } from './mapProjection';
export { geographicPath, MAP_SIZE, projectCoordinate } from './mapProjection';

export const MAP_FEATURES = geography.osm.landmarks.map(feature => ({ ...feature, path: geographicPath(feature.coordinates, feature.closed) }));
export const MEMORY_MALL_PATH = geography.ucf.memoryMall.map(ring => geographicPath(ring, true)).join(' ');
export const MAP_SOURCES = { osm: geography.osm.source, ucf: geography.ucf.source, fetched: geography.fetched };
const waypointDefinitions = [
  { placeId: 'memory-mall', sourceId: 'memorymall', label: 'MEMORY MALL', number: '01' },
  { placeId: 'student-union', sourceId: '52', label: 'STUDENT UNION', number: '02' },
  { placeId: 'library', sourceId: '2', label: 'LIBRARY', number: '03' },
  { placeId: 'reflecting-pond', sourceId: '360', label: 'REFLECTING POND', number: '04' },
  { placeId: 'engineering-1', sourceId: '40', label: 'ENGINEERING I', number: '05' },
  { placeId: 'engineering-2', sourceId: '91', label: 'ENGINEERING II', number: '06' },
  { placeId: 'research-1', sourceId: '120', label: 'RESEARCH I', number: '07' },
  { placeId: 'health-sciences-1', sourceId: '80', label: 'HEALTH SCIENCES I', number: '08' },
  { placeId: 'john-t-washington', sourceId: '26', label: 'JOHN T. WASHINGTON CTR', number: '09' },
  // Hand-placed anchor (no UCF registry entry); see scripts/refresh-campus-map.mjs.
  { placeId: 'cypress-dome', sourceId: 'cypress-dome', label: 'CYPRESS DOME', number: '10' },
] as const;
export const WAYPOINTS = waypointDefinitions.map(definition => {
  const anchor = geography.ucf.anchors.find(anchor => anchor.id === definition.sourceId)!;
  const point = projectCoordinate(anchor.coordinates);
  return { ...definition, coordinates: anchor.coordinates, x: point.x / MAP_SIZE.width * 100, y: point.y / MAP_SIZE.height * 100 };
});
export const LANDMARK_IDS: Record<string, string> = {
  '154245264': 'student-union', '154245274': 'library', '272718812': 'reflecting-pond',
  '307647104': 'engineering-1', '307646411': 'engineering-2', '827224010': 'research-1',
  '154245252': 'health-sciences-1', '154245217': 'john-t-washington', '334882442': 'cypress-dome',
};

export interface MapView { zoom: number; x: number; y: number }
export const DEFAULT_MAP_VIEW: MapView = { zoom: 1, x: 0, y: 0 };
export function constrainMap(view: MapView, coverage = { width: 1, height: 1 }): MapView {
  const zoom = Math.min(3, Math.max(1, view.zoom));
  // The map may already extend beyond one viewport axis before zooming. Allow
  // panning across that cropped area without revealing space outside the map.
  const limitX = Math.max(0, zoom - coverage.width) * 50;
  const limitY = Math.max(0, zoom - coverage.height) * 50;
  return { zoom, x: limitX ? Math.min(limitX, Math.max(-limitX, view.x)) : 0, y: limitY ? Math.min(limitY, Math.max(-limitY, view.y)) : 0 };
}
export function waypointPlace(id?: string) {
  return WAYPOINTS.some(point => point.placeId === id) ? PLACES.find(place => place.id === id) : undefined;
}
