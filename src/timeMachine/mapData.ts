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
] as const;
export const WAYPOINTS = waypointDefinitions.map(definition => {
  const anchor = geography.ucf.anchors.find(anchor => anchor.id === definition.sourceId)!;
  const point = projectCoordinate(anchor.coordinates);
  return { ...definition, coordinates: anchor.coordinates, x: point.x / MAP_SIZE.width * 100, y: point.y / MAP_SIZE.height * 100 };
});
export const LANDMARK_IDS: Record<string, string> = { '154245264': 'student-union', '154245274': 'library', '272718812': 'reflecting-pond' };

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
