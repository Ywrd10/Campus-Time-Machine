import { useState } from 'react';
import { ArrowDownToLine, ArrowLeftRight, Check, Grid2X2, LoaderCircle, RotateCcw } from 'lucide-react';
import { downloadOutput, isMockProvider } from '../services/generation';
import { saveToWall } from './storage';
import { CampusScene } from './CampusScene';
import type { Place } from './places';
import type { JourneyTicket, TimelineJob } from './types';

export function ArrivalView({ job, ticket, beforeUrl, kind, onReset, onWall, onSaved }: {
  job: TimelineJob; ticket: JourneyTicket; beforeUrl?: string; kind: Place['kind']; onReset: () => void; onWall: () => void; onSaved?: () => void;
}) {
  const [compare, setCompare] = useState(false);
  const [position, setPosition] = useState(50);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string>();
  const [mediaError, setMediaError] = useState(false);
  const output = job.output!;
  const source = job.beforeImageUrl || beforeUrl;
  async function download() {
    setDownloading(true); setError(undefined);
    try { await downloadOutput(output); } catch (error) { setError(error instanceof Error ? error.message : 'Download failed.'); }
    finally { setDownloading(false); }
  }
  function save() {
    const ok = saveToWall({ id: job.jobId, place: ticket.placeName, moment: ticket.moment, thumbnail: job.finalFrameUrl,
      url: output.url, isMock: true });
    setSaved(ok);
    if (ok) onSaved?.();
    if (!ok) setError('This browser could not save the journey. You can still download the video.');
  }
  return <div className="arrival-view">
    <div className="arrival-tabs" role="group" aria-label="Arrival preview">
      <button type="button" aria-pressed={!compare} onClick={() => setCompare(false)}>Play journey</button>
      <button type="button" aria-pressed={compare} disabled={!job.finalFrameUrl || (!source && !(output.isMock && ticket.place))} onClick={() => setCompare(true)}><ArrowLeftRight size={13} /> Before / after</button>
    </div>
    {compare ? <div className="comparison-wrap">
      <div className="comparison-scene">
        <img src={job.finalFrameUrl} alt="Arrival frame" />
        <div className="comparison-before" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          {source ? <img src={source} alt="Original campus photo" /> : <CampusScene kind={kind} />}
        </div>
        <span className="comparison-line" style={{ left: `${position}%` }}><ArrowLeftRight size={16} /></span>
        <span className="comparison-label before">{source ? 'Original photo' : 'Concept illustration'}</span><span className="comparison-label after">{output.isMock ? 'Sample frame' : 'Arrival'}</span>
      </div>
      <label className="comparison-control">Compare frames<input type="range" min="0" max="100" value={position} onChange={event => setPosition(Number(event.target.value))} aria-label="Before and after comparison" /></label>
    </div> : <video src={output.url} controls playsInline preload="metadata" poster={job.finalFrameUrl}
      aria-label="Time Machine journey video" className="journey-video" onError={() => setMediaError(true)} />}
    {mediaError && <p className="field-error" role="alert">This video could not be played. Try downloading the MP4.</p>}
    <div className="arrival-meta"><span>{output.width} × {output.height}</span><span>{output.fps} FPS</span><span>{output.durationSeconds}s</span><span>MP4</span></div>
    {output.isMock && <p className="journey-demo-note">Interface demo · the fixed sample MP4 is not a campus render and does not match the selected moment. Comparison uses its poster frame.</p>}
    {!job.finalFrameUrl && <p className="journey-demo-note">The relay has not supplied an arrival frame for comparison.</p>}
    {!source && !ticket.place && <p className="journey-demo-note">Uploaded photos are not stored locally. Reload recovery keeps the video job, but comparison needs the original photo from the relay.</p>}
    <div className="arrival-actions">
      <button className="secondary-button" type="button" onClick={onReset}><RotateCcw size={14} /> Another moment</button>
      <button className="secondary-button" type="button" disabled={downloading} onClick={download}>{downloading ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />} Download</button>
      {isMockProvider ? <button className="secondary-button" type="button" onClick={saved ? onWall : save}>{saved ? <Check size={14} /> : <Grid2X2 size={14} />}{saved ? 'View in Wall' : 'Add to Wall'}</button>
        : <button className="secondary-button" type="button" onClick={onWall}><Grid2X2 size={14} /> View Wall</button>}
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
