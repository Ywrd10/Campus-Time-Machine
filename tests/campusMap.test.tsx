import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CampusMap } from '../src/timeMachine/CampusMap';
import { constrainMap, DEFAULT_MAP_VIEW, WAYPOINTS, waypointPlace } from '../src/timeMachine/mapData';
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
  });
  it('exposes semantic waypoint buttons and reflects the selected place', () => {
    const html = renderToStaticMarkup(<CampusMap selected="library" disabled={false} onSelect={() => {}} />);
    expect(html).toMatch(/aria-label="Explore Library" aria-pressed="true"/);
    expect(html).toContain('aria-label="Explore Student Union"');
    expect(html).toContain('<span class="sr-only">Choose a campus waypoint</span><select>');
    expect(html).toContain('APPROXIMATE LAYOUT');
  });
  it('locks place changes while generation runs without removing navigation controls', () => {
    const html = renderToStaticMarkup(<CampusMap selected="library" disabled onSelect={() => {}} />);
    expect(html).toMatch(/aria-label="Explore Library" aria-pressed="true" disabled=""/);
    expect(html).toContain('aria-label="Reset map view"');
  });
});
