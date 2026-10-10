import { useEffect, useRef, useState } from 'react';
import { Crosshair, MapPin, Minus, MousePointer2, Plus, RotateCcw } from 'lucide-react';
import { PLACES } from './places';
import { constrainMap, DEFAULT_MAP_VIEW, WAYPOINTS } from './mapData';

interface Props { selected?: string; onSelect: (id: string) => void; disabled: boolean }
export function CampusMap({ selected, onSelect, disabled }: Props) {
  const [view, setView] = useState(DEFAULT_MAP_VIEW);
  const viewport = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ x: number; y: number; distance?: number } | undefined>(undefined);
  const zoom = (delta: number) => setView(value => constrainMap({ ...value, zoom: value.zoom + delta }));
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      // Preserve page scrolling. Ctrl/Command-wheel and trackpad pinch zoom the map.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setView(value => constrainMap({ ...value, zoom: value.zoom - event.deltaY * .005 }));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);
  function locate() {
    const point = WAYPOINTS.find(point => point.placeId === selected);
    if (point) setView(constrainMap({ zoom: 1.8, x: (50 - point.x) * 1.8, y: (50 - point.y) * 1.8 }));
    else setView(DEFAULT_MAP_VIEW);
  }
  function stopPointer(id: number) { pointers.current.delete(id); gesture.current = undefined; }
  return <section className="campus-map" aria-labelledby="map-title">
    <div className="map-viewport" ref={viewport} tabIndex={0} role="region" aria-label="Interactive campus map" aria-describedby="map-help"
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        const direction: Record<string, [number, number]> = { ArrowLeft: [6, 0], ArrowRight: [-6, 0], ArrowUp: [0, 6], ArrowDown: [0, -6] };
        if (direction[event.key]) { event.preventDefault(); setView(value => constrainMap({ ...value, x: value.x + direction[event.key][0], y: value.y + direction[event.key][1] })); }
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
        const bounds = event.currentTarget.getBoundingClientRect();
        if (last) setView(value => constrainMap({ zoom: distance && last.distance ? value.zoom * distance / last.distance : value.zoom,
          x: value.x + (x - last.x) / bounds.width * 100, y: value.y + (y - last.y) / bounds.height * 100 }));
        gesture.current = { x, y, distance };
      }}
      onPointerUp={event => stopPointer(event.pointerId)} onPointerCancel={event => stopPointer(event.pointerId)} onLostPointerCapture={event => stopPointer(event.pointerId)}>
      <div className="map-world" style={{ transform: `translate(${view.x}%, ${view.y}%) scale(${view.zoom})` }}>
        <svg viewBox="0 0 1200 800" preserveAspectRatio="none" className="map-art" aria-hidden="true">
          <defs><pattern id="map-grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#413550" strokeWidth=".5" /></pattern><radialGradient id="map-glow"><stop stopColor="#42304e" /><stop offset="1" stopColor="#15121f" /></radialGradient></defs>
          <path fill="url(#map-glow)" d="M0 0h1200v800H0z" /><path fill="url(#map-grid)" d="M0 0h1200v800H0z" />
          <g className="map-greenery"><path d="M0 0H450L352 125 278 156 175 114 65 209 0 180Z" /><path d="M839 0H1200V307L1075 258 948 122Z" /><path d="M0 501L195 542 205 685 340 800H0Z" /><path d="M942 544L1200 444V800H947L1001 674Z" /></g>
          <g className="map-roads"><path d="M-50 352Q242 324 329 190T719 40Q992 114 1032 349T896 700Q586 866 319 650T-50 352Z" /><path d="M-30 640Q276 600 336 412T622 236Q880 231 1200 397" /><path d="M741 -40L733 179 882 335 965 556 1200 615" /><path d="M201 800L263 598 466 443 512 211 451 -20" /><path d="M125 0L200 200 86 328" /></g>
          <g className="map-road-centers"><path d="M-50 352Q242 324 329 190T719 40Q992 114 1032 349T896 700Q586 866 319 650T-50 352Z" /><path d="M-30 640Q276 600 336 412T622 236Q880 231 1200 397" /><path d="M741 -40L733 179 882 335 965 556 1200 615" /></g>
          <g className="map-paths"><ellipse cx="588" cy="412" rx="233" ry="192" /><ellipse cx="588" cy="412" rx="254" ry="214" /><path d="M361 430H831M588 218V597M400 284L758 556M397 558L768 296M693 97L684 634M510 268L665 306 628 436 723 571M232 101L413 230M140 545L426 559M727 744L843 603M869 201L1062 134" /></g>
          <g className="map-buildings">
            <path d="M127 225h115v57H133v-20h-18v-22h12ZM158 414h102v51H158ZM167 498h126v37H167ZM259 102h87v60h-87ZM305 210h70v65h-70ZM345 306h53v46h-53ZM376 660h67v58h-67ZM463 674h53v83h-53ZM838 335h50v128h-50ZM1020 241h91v144h-91ZM945 431h98v61h-98ZM953 530h110v38h-110ZM301 525h79v50h-79ZM478 92h52v88h-52ZM803 586l74 -20 43 83 -80 29ZM881 654h50v67h-50ZM734 653h58v65h-58Z" />
            <path d="M731 377h80v37h-80ZM738 448l92 -21 24 46 -89 34ZM685 509l52 -34 37 32 -59 37ZM784 526l62 -24 44 57 -68 30Z" />
          </g>
          <g className="map-parking">{[0, 1, 2, 3, 4, 5].map(i => <path key={i} d={`M${888 + i * 23} 121l60 117M${92 + i * 23} 683l85 70`} />)}</g>
          <g className="map-water"><path d="M581 297Q621 266 664 286L654 302 625 305 601 320 587 317Z" /><path d="M701 344Q748 373 727 423L706 450 709 408 695 389Z" /><ellipse cx="693" cy="638" rx="42" ry="20" /><ellipse cx="693" cy="638" rx="12" ry="8" fill="none" /></g>
          <g className="map-landmarks"><path className={selected === 'memory-mall' ? 'selected' : ''} d="M645 108H721V253H645Z" /><path className={selected === 'student-union' ? 'selected' : ''} d="M478 345l81 20 12 -12 30 15 12 -8 55 25 -17 36 -26 -6 -9 21 -31 -9 -9 19 -45 -19 -19 13 -23 -14 13 -25 -30 -11Z" /><path className={selected === 'library' ? 'selected' : ''} d="M478 521h107v82H478v-22h-15v-38h15Z" /><ellipse className={selected === 'reflecting-pond' ? 'selected' : ''} cx="693" cy="638" rx="58" ry="35" /></g>
          <g className="map-text"><text x="345" y="203" transform="rotate(-28 345 203)">GEMINI BOULEVARD</text><text x="918" y="394" transform="rotate(70 918 394)">GEMINI BOULEVARD</text><text x="759" y="343">ENGINEERING</text><text x="1034" y="311">GARAGE C</text><text x="834" y="635">HEC</text><text x="163" y="542">CAMPUS GREEN</text></g>
        </svg>
        <div className="map-waypoints" role="group" aria-label="Campus waypoints">
          {WAYPOINTS.map(point => <button key={point.placeId} type="button" className={`map-waypoint ${selected === point.placeId ? 'selected' : ''}`} style={{ left: `${point.x}%`, top: `${point.y}%` }}
            aria-label={`Explore ${PLACES.find(place => place.id === point.placeId)!.name}`} aria-pressed={selected === point.placeId} disabled={disabled} onClick={() => onSelect(point.placeId)}>
            <span className="waypoint-dot"><MapPin size={17} aria-hidden="true" /></span><span className="waypoint-name"><small>{point.number}</small>{point.label}</span>
          </button>)}
        </div>
      </div>
    </div>
    <div className="map-heading"><span className="map-overline">UCF / ORLANDO, FL</span><h1 id="map-title">Same campus.<br /><span>Different timeline.</span></h1><p>Choose a waypoint. See where time takes it.</p></div>
    <label className="map-place-select"><MapPin size={16} aria-hidden="true" /><span className="sr-only">Choose a campus waypoint</span><select value={selected || ''} disabled={disabled} onChange={event => { if (event.target.value) onSelect(event.target.value); }}><option value="">Campus · Choose a place</option>{PLACES.map(place => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
    <div className="map-tools" role="group" aria-label="Map controls"><button type="button" aria-label="Zoom in" onClick={() => zoom(.25)} disabled={view.zoom >= 3}><Plus size={19} /></button><button type="button" aria-label="Zoom out" onClick={() => zoom(-.25)} disabled={view.zoom <= 1}><Minus size={19} /></button><button type="button" aria-label="Reset map view" onClick={() => setView(DEFAULT_MAP_VIEW)}><RotateCcw size={17} /></button><button type="button" aria-label="Center selected waypoint" onClick={locate} disabled={!selected}><Crosshair size={18} /></button></div>
    <div className="map-bottom"><p id="map-help"><MousePointer2 size={13} />Select a pin · drag to pan · pinch or Ctrl-scroll to zoom</p><span className="map-scale"><i />ILLUSTRATED CAMPUS MAP · APPROXIMATE LAYOUT</span></div>
  </section>;
}
