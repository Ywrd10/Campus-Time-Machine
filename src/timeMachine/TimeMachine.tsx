import { useState } from 'react';
import { ArrowRight, Clock3, Film, LoaderCircle, Orbit, RotateCcw, ScanLine, TriangleAlert } from 'lucide-react';
import { isMockProvider } from '../services/generation';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { PlacePicker } from './PlacePicker';
import { MomentPicker } from './MomentPicker';
import { TimelineProgress } from './TimelineProgress';
import { ArrivalView } from './ArrivalView';
import { CampusScene } from './CampusScene';
import { PLACES } from './places';
import { MOMENTS } from './moments';
import { useTimeline } from './useTimeline';
import type { JourneyLength, TimelineRequest } from './types';

export function TimeMachine({ onWall }: { onWall: () => void }) {
  const [placeId, setPlaceId] = useState(PLACES[0].id);
  const [momentId, setMomentId] = useState(MOMENTS[0].id);
  const [length, setLength] = useState<JourneyLength>('film');
  const [image, setImage] = useState<File>();
  const [validation, setValidation] = useState<string>();
  const photoUrl = useObjectUrl(image);
  const journey = useTimeline();
  const busy = journey.status === 'processing';
  const arrived = journey.status === 'completed';
  const ticket = journey.ticket;
  const place = PLACES.find(place => place.id === (ticket?.place || placeId)) || PLACES[0];
  const moment = MOMENTS.find(moment => moment.id === (ticket?.moment || momentId)) || MOMENTS[0];
  const placeName = ticket?.placeName || (image ? 'Your campus photo' : place.name);
  const film = (ticket?.length || length) === 'film';
  const source = photoUrl || place.photo;
  const locked = journey.status !== 'idle';

  function reset() {
    if (ticket) {
      if (ticket.place) setPlaceId(ticket.place);
      setMomentId(ticket.moment);
      setLength(ticket.length);
    }
    journey.reset(); setValidation(undefined);
  }
  function travel() {
    setValidation(undefined);
    if (ticket && !ticket.place && !image) { setValidation('Upload your campus photo again to start a new journey.'); return; }
    if (!isMockProvider && !image && !place.photo) { setValidation('Add a real campus photo before generating. The place illustrations are demo placeholders.'); return; }
    const request: TimelineRequest = { place: image ? undefined : ticket?.place || placeId, image, moment: ticket?.moment || momentId, length: ticket?.length || length };
    void journey.start(request, image ? 'Your campus photo' : place.name);
  }
  return <div className="time-workspace">
    <div className="time-title-row"><div><p className="eyebrow"><span /> UCF CAMPUS / TEMPORAL EXPLORER</p><h1>Campus Time Machine<span className="title-period">.</span></h1><p className="time-subtitle">Choose a place. Pick a moment. See what changes.</p></div>
      <div className="system-readout"><span>ENGINE</span><strong>LTX-2.5</strong><small>{isMockProvider ? 'DEMO ONLINE' : 'RELAY MODE'}</small></div>
    </div>
    <div className="time-grid">
      <aside className="journey-controls" aria-label="Journey configuration">
        <PlacePicker selected={ticket?.place || placeId} onSelect={id => { setPlaceId(id); setValidation(undefined); }} image={image} onImage={file => { setImage(file); setValidation(undefined); }} disabled={locked} />
        <MomentPicker selected={ticket?.moment || momentId} onSelect={setMomentId} disabled={locked} kind={place.kind} />
        <section className="journey-section length-section" aria-labelledby="length-heading">
          <div className="section-caption"><span className="step-number">03</span><h2 id="length-heading">Set your journey</h2><Clock3 size={15} aria-hidden="true" /></div>
          <div className="length-picker" role="group" aria-label="Journey length">
            <button type="button" aria-pressed={!film} disabled={locked} onClick={() => setLength('snapshot')}><ScanLine size={17} /><span><strong>Snapshot</strong><small>One shot · Arrive</small></span></button>
            <button type="button" aria-pressed={film} disabled={locked} onClick={() => setLength('film')}><Film size={17} /><span><strong>Film</strong><small>Now → Shift → Arrive</small></span></button>
          </div>
          {validation && <p className="field-error" role="alert">{validation}</p>}
          <button className="travel-button" type="button" disabled={busy} onClick={arrived ? reset : travel}>
            {busy ? <LoaderCircle size={17} className="animate-spin" /> : arrived ? <RotateCcw size={17} /> : <Orbit size={18} />}
            <span>{busy ? 'Traveling through time…' : arrived ? 'Start another journey' : 'Travel through time'}</span>{!busy && !arrived && <ArrowRight size={17} />}
          </button>
          <p className="journey-control-note">{isMockProvider ? 'Demo journey · about 8 seconds. No files leave your browser.' : 'Render time depends on the worker and queue.'}</p>
        </section>
      </aside>
      <section className={`time-preview ${busy ? 'is-traveling' : ''}`} aria-labelledby="destination-heading" aria-busy={busy}>
        <div className="preview-caption"><span><span className="live-dot" />{arrived ? 'ARRIVAL CONFIRMED' : busy ? 'JOURNEY IN PROGRESS' : 'DEPARTURE FRAME'}</span><span>{isMockProvider ? 'DEMO / 16:9' : 'IMAGE → VIDEO'}</span></div>
        <div className="destination-row"><div><span className="small-label">LOCATION</span><h2 id="destination-heading">{placeName}</h2></div><div className="coordinates"><span>ORIGIN</span><strong>UCF · ORLANDO</strong></div></div>
        <div className="time-readouts"><div><span>DEPARTURE</span><strong>NOW</strong></div><div className="travel-connector"><span /><ArrowRight size={18} /><span /></div><div className="destination-readout"><span>DESTINATION</span><strong>{moment.destination}</strong></div></div>
        {arrived && journey.job && ticket ? <ArrivalView key={journey.job.jobId} job={journey.job} ticket={ticket} beforeUrl={source} kind={place.kind} onReset={reset} onWall={onWall} />
          : <div className="departure-scene">
            {source ? <img src={source} alt={image ? 'Uploaded campus photo' : `${place.name} source photo`} /> : <CampusScene kind={place.kind} />}
            <div className="viewfinder"><span /><span /><span /><span /></div>
            <div className="scene-tag">{source ? 'SOURCE PHOTO' : 'CONCEPT ILLUSTRATION · ADD A CAMPUS PHOTO'}</div>
            {busy ? <div className="travel-overlay"><div className="portal-rings"><Orbit size={44} strokeWidth={1} /></div><h3>Shifting the scene</h3><p>{isMockProvider ? 'Simulating the timeline for this interface demo.' : journey.job?.status === 'queued' ? 'Waiting for the generation worker.' : 'The worker is building your journey.'}</p>
              <button className="secondary-button" type="button" onClick={reset}>Stop waiting</button><small>{isMockProvider ? 'You can leave this view and return.' : 'Stops local polling; the server job may continue.'}</small></div>
              : journey.status === 'failed' ? <div className="travel-overlay failure-overlay"><TriangleAlert size={30} /><h3>Journey interrupted</h3><p role="alert">{journey.error}</p><button className="secondary-button" type="button" onClick={travel}><RotateCcw size={14} /> Retry journey</button><button className="text-button" type="button" onClick={reset}>Choose another destination</button></div>
                : <div className="scene-coordinate"><span>FRAME 00 / PRESENT DAY</span><ScanLine size={17} /></div>}
          </div>}
        <TimelineProgress job={journey.job} film={film} />
        <div className="moment-description"><span className="small-label">{arrived ? 'ARRIVED AT' : 'NEXT STOP'}</span><strong>{moment.label}</strong><p>{moment.caption}</p></div>
        {moment.id === 'opening-day' && <p className="history-note">Imagined 1968 styling, not a historical reconstruction. <a href="https://library.ucf.edu/about/departments/special-collections-university-archives/university-history/" target="_blank" rel="noreferrer">UCF history ↗</a></p>}
        {!journey.storageAvailable && <p className="field-error" role="status">Browser storage is unavailable. Keep this page open to follow this journey.</p>}
        <span className="sr-only" role="status" aria-live="polite">{arrived ? 'Journey complete. Your video is ready.' : busy ? 'Your journey is processing.' : journey.status === 'failed' ? 'The journey failed.' : 'Ready to start a journey.'}</span>
      </section>
    </div>
    <footer className="time-footer"><span>KNIGHT HACKS IX <span>/</span> CAMPUS TIME MACHINE</span><span>{isMockProvider ? 'MOCK PROVIDER' : 'TEAM RELAY'} <span>·</span> LTX-2.5</span></footer>
  </div>;
}
