import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, Clock3, History, Grid2X2, MapPin, Orbit, RotateCcw, ScanLine, TriangleAlert, X } from 'lucide-react';
import { isMockProvider } from '../services/generation';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { PlacePicker } from './PlacePicker';
import { MOMENT_ICONS, MomentPicker } from './MomentPicker';
import { TimelineProgress } from './TimelineProgress';
import { ArrivalView } from './ArrivalView';
import { CampusScene } from './CampusScene';
import { CampusMap } from './CampusMap';
import { Wall } from './Wall';
import { PLACES, placeView } from './places';
import { MOMENTS } from './moments';
import { useTimeline } from './useTimeline';
import type { TimelineRequest } from './types';
import { DEFAULT_JOURNEY_QUALITY, JOURNEY_QUALITIES, journeyQuality, type JourneyQuality } from './quality';
import { JourneyLoading } from './JourneyLoading';

function scrollTo(element: HTMLElement | null) {
  element?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}
// Places that take "the" mid-sentence ("A new time for the Library").
const THE_PLACES = new Set(['library', 'reflecting-pond', 'john-t-washington', 'student-union', 'cypress-dome', 'memory-mall']);

export function TimeMachine({ active }: { active: boolean }) {
  const [placeId, setPlaceId] = useState<string>();
  const [viewId, setViewId] = useState<string>();
  const [momentId, setMomentId] = useState(MOMENTS[0].id);
  const [quality, setQuality] = useState<JourneyQuality>(DEFAULT_JOURNEY_QUALITY);
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
  const MomentIcon = MOMENT_ICONS[moment.id] || History;
  const preset = journeyQuality(ticket?.quality || quality)!;
  const view = place && placeView(place, ticket ? ticket.view : viewId);
  const source = photoUrl || view?.photo;
  const locked = journey.status !== 'idle';
  useEffect(() => { if (arrived) setWallRevision(value => value + 1); }, [arrived]);
  useEffect(() => { if (placeId && !ticket) scrollTo(configuration.current); }, [placeId]);

  function reset() {
    if (restoredPlace) { setPlaceId(restoredPlace); setViewId(ticket?.view); }
    if (ticket) { setMomentId(ticket.moment); setQuality(ticket.quality || DEFAULT_JOURNEY_QUALITY); }
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
    const request: TimelineRequest = { place: image ? undefined : ticket?.place || place.id, view: image ? undefined : view?.id, image, moment: ticket?.moment || momentId, length: 'snapshot', quality: preset.id };
    void journey.start(request, place.name);
  }
  function showWall() { setWallRevision(value => value + 1); scrollTo(wallArea.current); }
  return <div className="time-workspace map-workspace">
    <div ref={mapArea} className="map-area"><CampusMap selected={place?.id} onSelect={selectPlace} disabled={busy} />
      <div className="map-archive-shortcut"><button type="button" onClick={showWall}><Grid2X2 size={17} /><span>Journey Wall<small>Explore saved arrivals</small></span><ArrowDown size={16} /></button></div>
    </div>
    {place ? <section ref={configuration} className="waypoint-workspace" aria-label={`${place.name} journey options`}>
      <div className="waypoint-section-heading"><div><h2>A new time for {THE_PLACES.has(place.id) ? 'the ' : ''}<span>{place.name}.</span></h2><p className="time-subtitle">Your next departure.</p></div><button className="secondary-button" type="button" onClick={closePlace} disabled={busy}><X size={14} /> Back to map</button></div>
      <div className="time-grid">
        <div className="journey-controls" aria-label="Journey configuration">
          <PlacePicker place={place} view={view} onView={id => { setViewId(id); setImage(undefined); setValidation(undefined); }} image={image} onImage={file => { setImage(file); setValidation(undefined); }} disabled={locked} />
          <MomentPicker selected={ticket?.moment || momentId} onSelect={setMomentId} disabled={locked} kind={place.kind} />
          <section className="journey-section length-section" aria-labelledby="length-heading">
            <div className="section-caption"><span className="step-number">03</span><h2 id="length-heading">Video quality</h2><Clock3 size={15} aria-hidden="true" /></div>
            <fieldset className="quality-fieldset" disabled={locked}>
              <legend className="sr-only">Video quality</legend>
              <div className="quality-options">{JOURNEY_QUALITIES.map(option => <label key={option.id} className={`quality-option ${preset.id === option.id ? 'selected' : ''}`}>
                <input type="radio" name="journey-quality" value={option.id} checked={preset.id === option.id} onChange={() => setQuality(option.id)} />
                <span><strong>{option.label}</strong><small>{option.resolution}</small></span>
              </label>)}</div>
              <p className="quality-description">{preset.description}{preset.id === 'standard' && <span>Recommended</span>}</p>
            </fieldset>
            <div className="snapshot-details"><ScanLine size={14} aria-hidden="true" /><span>3-second Snapshot</span><span>{preset.width} × {preset.height} · 24 FPS</span></div>
            {validation && <p className="field-error" role="alert">{validation}</p>}
            <button className="travel-button" type="button" disabled={busy} onClick={arrived ? reset : travel}>
              {busy ? <span className="processing-pulse" aria-hidden="true" /> : arrived ? <RotateCcw size={17} /> : <Orbit size={18} />}<span>{busy ? 'Creating your journey…' : arrived ? 'Start another journey' : 'Generate from this waypoint'}</span>{!busy && !arrived && <ArrowRight size={17} />}
            </button><p className="journey-control-note">{isMockProvider ? 'Demo journey · about 8 seconds. No files leave your browser.' : `${preset.timeLabel}, plus any queue.${preset.id === 'quick' ? ' Quick renders have quieter audio.' : ''}`}</p>
          </section>
        </div>
        <section className={`time-preview ${busy ? 'is-traveling' : ''}`} aria-labelledby="destination-heading" aria-busy={busy}>
          <div className="preview-caption"><span><span className="live-dot" />{arrived ? 'ARRIVAL CONFIRMED' : busy ? 'JOURNEY IN PROGRESS' : 'YOUR TIMELINE'}</span><span>{isMockProvider ? 'DEMO / 16:9' : 'IMAGE → VIDEO'}</span></div>
          <div className="destination-row"><div><span className="small-label">SELECTED PLACE</span><h2 id="destination-heading">{ticket?.placeName || place.name}</h2></div><span className="moment-chip"><MomentIcon size={14} aria-hidden="true" />{moment.label}</span></div>
          {arrived && journey.job && ticket ? <ArrivalView key={journey.job.jobId} job={journey.job} ticket={ticket} onReset={reset} onWall={showWall} onSaved={() => setWallRevision(value => value + 1)} />
            : <div className="departure-scene">{source ? <img src={source} alt={`${place.name} source photo`} /> : <CampusScene kind={place.kind} />}<div className="viewfinder"><span /><span /><span /><span /></div><div className="scene-tag">{source ? 'SOURCE PHOTO' : 'CONCEPT ILLUSTRATION · ADD A CAMPUS PHOTO'}</div>
              {busy ? <JourneyLoading job={journey.job} source={source} demo={isMockProvider} onStop={reset} />
                : journey.status === 'failed' ? <div className="travel-overlay failure-overlay"><TriangleAlert size={30} /><h3>Journey interrupted</h3><p role="alert">{journey.error}</p><button className="secondary-button" type="button" onClick={travel}><RotateCcw size={14} /> Retry journey</button><button className="text-button" type="button" onClick={reset}>Choose another destination</button></div>
                  : <div className="scene-coordinate"><span>FRAME 00 / PRESENT DAY</span><ScanLine size={17} /></div>}
            </div>}
          <TimelineProgress job={journey.job} film={false} /><div className="moment-description"><span className="small-label">{arrived ? 'ARRIVED AT' : 'NEXT STOP'}</span><strong>{moment.label}</strong><p>{moment.caption}</p></div>
          {!journey.storageAvailable && <p className="field-error" role="status">Browser storage is unavailable. Keep this page open to follow this journey.</p>}
          <span className="sr-only" role="status" aria-live="polite">{arrived ? 'Journey complete. Your video is ready.' : busy ? 'Your journey is processing.' : journey.status === 'failed' ? 'The journey failed.' : 'Ready to start a journey.'}</span>
        </section>
      </div>
    </section> : <div className="map-start-note"><MapPin size={18} /><span><strong>Your next story starts with a place.</strong> Choose a pin on the map to unlock its moment options.</span></div>}
    <div ref={wallArea} className="inline-wall"><Wall active={active} onTravel={() => scrollTo(mapArea.current)} refreshKey={wallRevision} /></div>
  </div>;
}
