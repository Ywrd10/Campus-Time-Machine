import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { CampusMap } from '../src/timeMachine/CampusMap';
import { constrainMap, DEFAULT_MAP_VIEW, geographicPath, MAP_FEATURES, MAP_SIZE, MAP_SOURCES, projectCoordinate, WAYPOINTS, waypointPlace } from '../src/timeMachine/mapData';
import { validateTimeline } from '../src/services/timeline';

describe('Campus waypoint navigation', () => {
  it('maps every visible waypoint to an existing relay-compatible place', () => {
    expect(new Set(WAYPOINTS.map(point => point.placeId)).size).toBe(WAYPOINTS.length);
    for (const point of WAYPOINTS) {
      expect(waypointPlace(point.placeId)?.name).toBeTruthy();
      expect(validateTimeline({ place: point.placeId, moment: 'future', length: 'snapshot' })).toBeNull();
      expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(100);
      expect(point.y).toBeGreaterThan(0); expect(point.y).toBeLessThan(100);
    }
    expect(waypointPlace('unregistered-building')).toBeUndefined();
  });
  it('keeps zoom and panning bounded and resets the overview', () => {
    expect(constrainMap({ zoom: .2, x: 99, y: -99 })).toEqual(DEFAULT_MAP_VIEW);
    expect(constrainMap({ zoom: 10, x: 500, y: -500 })).toEqual({ zoom: 3, x: 100, y: -100 });
    expect(constrainMap({ zoom: 2, x: 12, y: -15 })).toEqual({ zoom: 2, x: 12, y: -15 });
    expect(constrainMap({ zoom: 1, x: 60, y: 40 }, { width: .4, height: 1 })).toEqual({ zoom: 1, x: 30, y: 0 });
    expect(constrainMap({ zoom: 1, x: 30, y: -40 }, { width: 1, height: .8 })).toEqual({ zoom: 1, x: 0, y: expect.closeTo(-10, 6) });
  });
  it('exposes semantic waypoint buttons and reflects the selected place', () => {
    const html = renderToStaticMarkup(<CampusMap selected="library" disabled={false} onSelect={() => {}} />);
    expect(html).toMatch(/aria-label="Explore Library" aria-pressed="true"/);
    expect(html).toContain('aria-label="Explore Student Union"');
    expect(html).toContain('<span class="sr-only">Choose a campus waypoint</span><select>');
    expect(html).toContain('https://www.map.ucf.edu/');
    expect(html).toContain('https://www.openstreetmap.org/copyright');
    expect(html).toContain('maps/ucf-campus.svg');
    expect(html).not.toContain('APPROXIMATE LAYOUT');
    expect(html).not.toContain('preserveAspectRatio="none"');
  });
  it('locks place changes while generation runs without removing navigation controls', () => {
    const html = renderToStaticMarkup(<CampusMap selected="library" disabled onSelect={() => {}} />);
    expect(html).toMatch(/aria-label="Explore Library" aria-pressed="true" disabled=""/);
    expect(html).toContain('aria-label="Reset map view"');
  });
  it('uses official UCF coordinates and the real southwest-to-northeast campus axis', () => {
    const [mall, union, library, pond] = WAYPOINTS;
    expect(library.coordinates[0]).toBeCloseTo(-81.2015979232101, 6);
    expect(library.coordinates[1]).toBeCloseTo(28.6000504981664, 6);
    expect(union.coordinates[0]).toBeCloseTo(-81.2005277218132, 6);
    expect(union.coordinates[1]).toBeCloseTo(28.6016695019756, 6);
    expect(mall.y).toBeLessThan(union.y);
    expect(union.y).toBeLessThan(library.y);
    expect(library.y).toBeLessThan(pond.y);
    expect(pond.x).toBeLessThan(library.x);
    expect(library.x).toBeLessThan(union.x);
    expect(union.x).toBeLessThan(mall.x);
    expect(MAP_SOURCES.ucf).toBe('https://www.map.ucf.edu/locations.json');
  });
  it('preserves north-up geographic distances and locks the image and pin coordinate systems together', () => {
    const center = projectCoordinate([-81.2, 28.6029]);
    const north = projectCoordinate([-81.2, 28.6039]);
    const east = projectCoordinate([-81.2 + .001 / Math.cos(28.6029 * Math.PI / 180), 28.6029]);
    expect(center.y - north.y).toBeCloseTo(east.x - center.x, 6);
    expect(north.y).toBeLessThan(center.y);
    expect(east.x).toBeGreaterThan(center.x);
    const svg = readFileSync(new URL('../public/maps/ucf-campus.svg', import.meta.url), 'utf8');
    expect(svg).toContain(`viewBox="0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}"`);
    for (const landmark of MAP_FEATURES) {
      expect(svg).toContain(`id="osm-way-${landmark.id}" d="${geographicPath(landmark.coordinates, true)}"`);
    }
    expect(svg).not.toContain('preserveAspectRatio="none"');
  });
  it('ships real campus footprints, water and Gemini roads with OSM provenance', () => {
    const data = JSON.parse(readFileSync(new URL('../public/maps/ucf-osm.json', import.meta.url), 'utf8'));
    expect(data.license).toBe('ODbL-1.0');
    expect(data.source).toContain('api.openstreetmap.org/api/0.6/map?bbox=');
    expect(data.features).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: '154245264', name: 'Student Union', layer: 'buildings', closed: true }),
      expect.objectContaining({ id: '154245274', name: 'John C. Hitt Library', layer: 'buildings', closed: true }),
      expect.objectContaining({ id: '272718812', name: 'Reflecting Pond', layer: 'water', closed: true }),
      expect.objectContaining({ id: '75779027', name: 'Lake Claire', layer: 'water', closed: true }),
      expect.objectContaining({ name: 'Gemini Boulevard East', layer: 'roads' }),
    ]));
  });
});
