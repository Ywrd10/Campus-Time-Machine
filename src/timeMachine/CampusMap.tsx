import { useEffect, useRef, useState } from 'react';
import { Crosshair, MapPin, Minus, MousePointer2, Plus, RotateCcw } from 'lucide-react';
import { PLACES } from './places';
import { constrainMap, DEFAULT_MAP_VIEW, MAP_SIZE, WAYPOINTS } from './mapData';
import { CampusBasemap } from './CampusBasemap';

interface Props { selected?: string; onSelect: (id: string) => void; disabled: boolean }
export function CampusMap({ selected, onSelect, disabled }: Props) {
  const [view, setView] = useState(DEFAULT_MAP_VIEW);
  // The intro heading fades out once the visitor first pans, zooms, or picks a waypoint.
  const [touched, setTouched] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const [worldSize, setWorldSize] = useState({ ...MAP_SIZE, viewportWidth: MAP_SIZE.width, viewportHeight: MAP_SIZE.height });
  const coverage = { width: worldSize.viewportWidth / worldSize.width, height: worldSize.viewportHeight / worldSize.height };
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; distance?: number } | undefined>(undefined);
  const zoom = (delta: number) => setView(value => constrainMap({ ...value, zoom: value.zoom + delta }, coverage));
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(entries => {
      const bounds = entries[0].contentRect;
      if (!bounds.width || !bounds.height) return;
      const width = Math.max(bounds.width, bounds.height * MAP_SIZE.width / MAP_SIZE.height);
      const height = width * MAP_SIZE.height / MAP_SIZE.width;
      setWorldSize({ width, height, viewportWidth: bounds.width, viewportHeight: bounds.height });
      setView(value => constrainMap(value, { width: bounds.width / width, height: bounds.height / height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      // Preserve page scrolling. Ctrl/Command-wheel and trackpad pinch zoom the map.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setTouched(true);
      setView(value => constrainMap({ ...value, zoom: value.zoom - event.deltaY * .005 }, coverage));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [coverage.width, coverage.height]);
  function locate() {
    const point = WAYPOINTS.find(point => point.placeId === selected);
    if (point) setView(constrainMap({ zoom: 2, x: (50 - point.x) * 2, y: (50 - point.y) * 2 }, coverage));
    else setView(DEFAULT_MAP_VIEW);
  }
  function stopPointer(id: number) { pointers.current.delete(id); gesture.current = undefined; }
  return <section className="campus-map" aria-labelledby="map-title" onPointerDownCapture={() => setTouched(true)}
    onKeyDownCapture={event => { if (!['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape'].includes(event.key)) setTouched(true); }}>
    <div className="map-viewport" ref={viewport} tabIndex={0} role="region" aria-label="Interactive campus map" aria-describedby="map-help"
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        const direction: Record<string, [number, number]> = { ArrowLeft: [6, 0], ArrowRight: [-6, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] };
        if (direction[event.key]) { event.preventDefault(); setView(value => constrainMap({ ...value, x: value.x + direction[event.key][0], y: value.y + direction[event.key][1] }, coverage)); }
        else if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(.25); }
        else if (event.key === '-') { event.preventDefault(); zoom(-.25); }
        else if (event.key === '0') { event.preventDefault(); setView(DEFAULT_MAP_VIEW); }
      }}
      onPointerDown={event => {
        if ((event.target as HTMLElement).closest('button')) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        gesture.current = undefined;
      }}
      onPointerMove={event => {
        if (!pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const points = [...pointers.current.values()];
        const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        const distance = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : undefined;
        const last = gesture.current;
        if (last) setView(value => constrainMap({ zoom: distance && last.distance ? value.zoom * distance / last.distance : value.zoom,
          x: value.x + (x - last.x) / worldSize.width * 100, y: value.y + (y - last.y) / worldSize.height * 100 }, coverage));
        gesture.current = { x, y, distance };
      }}
      onPointerUp={event => stopPointer(event.pointerId)} onPointerCancel={event => stopPointer(event.pointerId)} onLostPointerCapture={event => stopPointer(event.pointerId)}>
      <div className="map-world" style={{ width: worldSize.width, height: worldSize.height, left: `calc(50% - ${worldSize.width / 2}px)`, top: `calc(50% - ${worldSize.height / 2}px)`, transform: `translate(${view.x}%, ${view.y}%) scale(${view.zoom})` }}>
        <CampusBasemap selected={selected} />
        <div className="map-waypoints" role="group" aria-label="Campus waypoints">
          {WAYPOINTS.map(point => <button key={point.placeId} type="button" className={`map-waypoint waypoint-${point.placeId} ${selected === point.placeId ? 'selected' : ''}`} style={{ left: `${point.x}%`, top: `${point.y}%` }}
            aria-label={`Explore ${PLACES.find(place => place.id === point.placeId)!.name}`} aria-pressed={selected === point.placeId} disabled={disabled} onClick={() => onSelect(point.placeId)}>
            <span className="waypoint-dot"><MapPin size={17} aria-hidden="true" /></span><span className="waypoint-name"><small>{point.number}</small>{point.label}</span>
          </button>)}
        </div>
      </div>
    </div>
    <div className={`map-heading${touched ? ' dismissed' : ''}`}><span className="map-overline">UCF / ORLANDO, FL</span><h1 id="map-title">Same campus.<br /><span>Different timeline.</span></h1><p>Choose a waypoint. See where time takes it.</p></div>
    <label className="map-place-select"><MapPin size={16} aria-hidden="true" /><span className="sr-only">Choose a campus waypoint</span><select value={selected || ''} disabled={disabled} onChange={event => { if (event.target.value) onSelect(event.target.value); }}><option value="">Campus · Choose a place</option>{PLACES.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
    <div className="map-tools" role="group" aria-label="Map controls"><button type="button" aria-label="Zoom in" onClick={() => zoom(.25)} disabled={view.zoom >= 3}><Plus size={19} /></button><button type="button" aria-label="Zoom out" onClick={() => zoom(-.25)} disabled={view.zoom <= 1}><Minus size={19} /></button><button type="button" aria-label="Reset map view" onClick={() => setView(DEFAULT_MAP_VIEW)}><RotateCcw size={17} /></button><button type="button" aria-label="Center selected waypoint" onClick={locate} disabled={!selected}><Crosshair size={18} /></button></div>
    <div className="map-compass" aria-label="North is up"><span>N</span><span aria-hidden="true">↑</span></div>
    <div className="map-bottom"><p id="map-help"><MousePointer2 size={13} />Select a pin · drag to pan · pinch or Ctrl-scroll to zoom</p></div>
    <div className="map-attribution"><a href="https://www.map.ucf.edu/" target="_blank" rel="noreferrer">UCF Campus Map</a><span> · </span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a></div>
  </section>;
}
