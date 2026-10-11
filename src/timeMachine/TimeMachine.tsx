import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Clock3, Film, Grid2X2, LoaderCircle, MapPin, Orbit, RotateCcw, ScanLine, TriangleAlert, X } from 'lucide-react';
import { isMockProvider } from '../services/generation';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { PlacePicker } from './PlacePicker';
import { MomentPicker } from './MomentPicker';
import { TimelineProgress } from './TimelineProgress';
import { ArrivalView } from './ArrivalView';
import { CampusScene } from './CampusScene';
import { CampusMap } from './CampusMap';
import { Wall } from './Wall';
import { PLACES, placeView } from './places';
import { MOMENTS } from './moments';
import { useTimeline } from './useTimeline';
import type { JourneyLength, TimelineRequest } from './types';

function scrollTo(element: HTMLElement | null) {
  element?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}
export function TimeMachine({ active }: { active: boolean }) {
  const [placeId, setPlaceId] = useState<string>();
  const [viewId, setViewId] = useState<string>();
  const [momentId, setMomentId] = useState(MOMENTS[0].id);
  const [length, setLength] = useState<JourneyLength>(isMockProvider ? 'film' : 'snapshot');
  const [image, setImage] = useState<File>();
  const [validation, setValidation] = useState<string>();
  const [wallRevision, setWallRevision] = useState(0);
  const configuration = useRef<HTMLElement>(null);
  const mapArea = useRef<HTMLDivElement>(null);
  const wallArea = useRef<HTMLDivElement>(null);
  const photoUrl = useObjectUrl(image);
  const journey = useTimeline();
  const busy = journey.status === 'processing';
  const arrived = journey.status === 'completed';
  const ticket = journey.ticket;
  // Uploaded waypoint photos use the wire `image` field; recover selection from local ticket metadata.
  const restoredPlace = ticket?.place || PLACES.find(place => place.name === ticket?.placeName)?.id;
  const selectedId = restoredPlace || placeId;
  const place = PLACES.find(place => place.id === selectedId) || (ticket ? PLACES[0] : undefined);
  const moment = MOMENTS.find(moment => moment.id === (ticket?.moment || momentId)) || MOMENTS[0];
  const film = (ticket?.length || length) === 'film';
  const view = place && placeView(place, ticket ? ticket.view : viewId);
  const source = photoUrl || view?.photo;
  const locked = journey.status !== 'idle';
  useEffect(() => { if (arrived) setWallRevision(value => value + 1); }, [arrived]);
  useEffect(() => { if (placeId && !ticket) scrollTo(configuration.current); }, [placeId]);

  function reset() {
    if (restoredPlace) { setPlaceId(restoredPlace); setViewId(ticket?.view); }
    if (ticket) { setMomentId(ticket.moment); setLength(isMockProvider ? ticket.length : 'snapshot'); }
    journey.reset(); setValidation(undefined);
  }
  function selectPlace(id: string) {
    if (busy) return;
    journey.reset(); setPlaceId(id); setViewId(undefined); setImage(undefined); setValidation(undefined);
    if (id === placeId) scrollTo(configuration.current);
  }
  function closePlace() {
    if (busy) return;
    journey.reset(); setPlaceId(undefined); setViewId(undefined); setImage(undefined); setValidation(undefined); scrollTo(mapArea.current);
  }
  function travel() {
    if (!place) return;
    setValidation(undefined);
    if (ticket && !ticket.place && !image) { setValidation('Upload your campus photo again to start a new journey.'); return; }
    if (!isMockProvider && !image && !view) { setValidation(`Upload a photo of ${place.name} before generating from this waypoint.`); return; }
    const request: TimelineRequest = { place: image ? undefined : ticket?.place || place.id, view: image ? undefined : view?.id, image, moment: ticket?.moment || momentId, length: isMockProvider ? ticket?.length || length : 'snapshot' };
    void journey.start(request, place.name);
  }
  function showWall() { setWallRevision(value => value + 1); scrollTo(wallArea.current); }
  return <div className="time-workspace map-workspace">
    <div ref={mapArea} className="map-area"><CampusMap selected={place?.id} onSelect={selectPlace} disabled={busy} />
      <div className="map-archive-shortcut"><button type="button" onClick={showWall}><Grid2X2 size={17} /><span>Journey Wall<small>Explore saved arrivals</small></span><ArrowDown size={16} /></button><span>{PLACES.length} WAYPOINTS / {MOMENTS.length} MOMENTS</span></div>
    </div>
    {place ? <section ref={configuration} className="waypoint-workspace" aria-label={`${place.name} journey options`}>
      <div className="waypoint-section-heading"><div><p className="eyebrow"><span /> YOUR NEXT DEPARTURE</p><h2>A new time for <span>{place.name}.</span></h2></div><button className="secondary-button" type="button" onClick={closePlace} disabled={busy}><X size={14} /> Back to map</button></div>
      <div className="time-grid">
        <div className="journey-controls" aria-label="Journey configuration">
          <PlacePicker place={place} view={view} onView={id => { setViewId(id); setImage(undefined); setValidation(undefined); }} image={image} onImage={file => { setImage(file); setValidation(undefined); }} disabled={locked} />
          <MomentPicker selected={ticket?.moment || momentId} onSelect={setMomentId} disabled={locked} kind={place.kind} />
          <section className="journey-section length-section" aria-labelledby="length-heading">
            <div className="section-caption"><span className="step-number">03</span><h2 id="length-heading">Set your journey</h2><Clock3 size={15} aria-hidden="true" /></div>
            <div className="length-picker" role="group" aria-label="Journey length">
              <button type="button" aria-pressed={!film} disabled={locked} onClick={() => setLength('snapshot')}><ScanLine size={17} /><span><strong>Snapshot</strong><small>One shot · Arrive</small></span></button>
              <button type="button" aria-pressed={film} disabled={locked || !isMockProvider} onClick={() => setLength('film')}><Film size={17} /><span><strong>Film</strong><small>{isMockProvider ? 'Now → Shift → Arrive' : 'Coming soon'}</small></span></button>
            </div>
            {validation && <p className="field-error" role="alert">{validation}</p>}
            <button className="travel-button" type="button" disabled={busy} onClick={arrived ? reset : travel}>
              {busy ? <LoaderCircle size={17} className="animate-spin" /> : arrived ? <RotateCcw size={17} /> : <Orbit size={18} />}<span>{busy ? 'Traveling through time…' : arrived ? 'Start another journey' : 'Generate from this waypoint'}</span>{!busy && !arrived && <ArrowRight size={17} />}
            </button><p className="journey-control-note">{isMockProvider ? 'Demo journey · about 8 seconds. No files leave your browser.' : 'About a minute per Snapshot, plus any queue.'}</p>
          </section>
        </div>
        <section className={`time-preview ${busy ? 'is-traveling' : ''}`} aria-labelledby="destination-heading" aria-busy={busy}>
          <div className="preview-caption"><span><span className="live-dot" />{arrived ? 'ARRIVAL CONFIRMED' : busy ? 'JOURNEY IN PROGRESS' : 'YOUR TIMELINE'}</span><span>{isMockProvider ? 'DEMO / 16:9' : 'IMAGE → VIDEO'}</span></div>
          <div className="destination-row"><div><span className="small-label">SELECTED PLACE</span><h2 id="destination-heading">{ticket?.placeName || place.name}</h2></div><MapPin size={18} /></div>
          <div className="time-readouts"><div><span>DEPARTURE</span><strong>NOW</strong></div><div className="travel-connector"><span /><ArrowRight size={18} /><span /></div><div className="destination-readout"><span>DESTINATION</span><strong>{moment.destination}</strong></div></div>
          {arrived && journey.job && ticket ? <ArrivalView key={journey.job.jobId} job={journey.job} ticket={ticket} beforeUrl={source} kind={place.kind} onReset={reset} onWall={showWall} onSaved={() => setWallRevision(value => value + 1)} />
            : <div className="departure-scene">{source ? <img src={source} alt={`${place.name} source photo`} /> : <CampusScene kind={place.kind} />}<div className="viewfinder"><span /><span /><span /><span /></div><div className="scene-tag">{source ? 'SOURCE PHOTO' : 'CONCEPT ILLUSTRATION · ADD A CAMPUS PHOTO'}</div>
              {busy ? <div className="travel-overlay"><div className="portal-rings"><Orbit size={44} strokeWidth={1} /></div><h3>Shifting the scene</h3><p>{isMockProvider ? 'Simulating the timeline for this interface demo.' : journey.job?.status === 'queued' ? 'Waiting for the generation worker.' : 'The worker is building your journey.'}</p><button className="secondary-button" type="button" onClick={reset}>Stop waiting</button><small>{isMockProvider ? 'You can leave this view and return.' : 'Stops local polling; the server job may continue.'}</small></div>
                : journey.status === 'failed' ? <div className="travel-overlay failure-overlay"><TriangleAlert size={30} /><h3>Journey interrupted</h3><p role="alert">{journey.error}</p><button className="secondary-button" type="button" onClick={travel}><RotateCcw size={14} /> Retry journey</button><button className="text-button" type="button" onClick={reset}>Choose another destination</button></div>
                  : <div className="scene-coordinate"><span>FRAME 00 / PRESENT DAY</span><ScanLine size={17} /></div>}
            </div>}
          <TimelineProgress job={journey.job} film={film} /><div className="moment-description"><span className="small-label">{arrived ? 'ARRIVED AT' : 'NEXT STOP'}</span><strong>{moment.label}</strong><p>{moment.caption}</p></div>
          {moment.id === 'opening-day' && <p className="history-note">Imagined 1968 styling, not a historical reconstruction. <a href="https://library.ucf.edu/about/departments/special-collections-university-archives/university-history/" target="_blank" rel="noreferrer">UCF history ↗</a></p>}
          {!journey.storageAvailable && <p className="field-error" role="status">Browser storage is unavailable. Keep this page open to follow this journey.</p>}
          <span className="sr-only" role="status" aria-live="polite">{arrived ? 'Journey complete. Your video is ready.' : busy ? 'Your journey is processing.' : journey.status === 'failed' ? 'The journey failed.' : 'Ready to start a journey.'}</span>
        </section>
      </div>
    </section> : <div className="map-start-note"><MapPin size={18} /><span><strong>Your next story starts with a place.</strong> Choose a pin on the map to unlock its moment options.</span></div>}
    <div ref={wallArea} className="inline-wall"><Wall active={active} onTravel={() => scrollTo(mapArea.current)} refreshKey={wallRevision} /></div>
    <footer className="time-footer"><span>KNIGHT HACKS IX <span>/</span> CAMPUS TIME MACHINE</span><span>{isMockProvider ? 'MOCK PROVIDER' : 'TEAM RELAY'} <span>·</span> KANDINSKY 6 LITE</span></footer>
  </div>;
}
