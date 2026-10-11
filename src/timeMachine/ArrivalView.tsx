import { useState } from 'react';
import { ArrowDownToLine, Check, Grid2X2, LoaderCircle, RotateCcw } from 'lucide-react';
import { downloadOutput, isMockProvider } from '../services/generation';
import { saveToWall } from './storage';
import type { JourneyTicket, TimelineJob } from './types';

export function ArrivalView({ job, ticket, onReset, onWall, onSaved }: {
  job: TimelineJob; ticket: JourneyTicket; onReset: () => void; onWall: () => void; onSaved?: () => void;
}) {
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string>();
  const [mediaError, setMediaError] = useState(false);
  const output = job.output!;
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
    <video src={output.url} controls playsInline preload="metadata" poster={job.finalFrameUrl}
      aria-label="Time Machine journey video" className="journey-video" onError={() => setMediaError(true)} />
    {mediaError && <p className="field-error" role="alert">This video could not be played. Try downloading the MP4.</p>}
    <div className="arrival-meta"><span>{output.width} × {output.height}</span><span>{output.fps} FPS</span><span>{output.durationSeconds}s</span><span>MP4</span></div>
    {output.isMock && <p className="journey-demo-note">Interface demo · the fixed sample MP4 is not a campus render and does not match the selected moment.</p>}
    <div className="arrival-actions">
      <button className="secondary-button" type="button" onClick={onReset}><RotateCcw size={14} /> Another moment</button>
      <button className="secondary-button" type="button" disabled={downloading} onClick={download}>{downloading ? <LoaderCircle size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />} Download</button>
      {isMockProvider ? <button className="secondary-button" type="button" onClick={saved ? onWall : save}>{saved ? <Check size={14} /> : <Grid2X2 size={14} />}{saved ? 'View in Wall' : 'Add to Wall'}</button>
        : <button className="secondary-button" type="button" onClick={onWall}><Grid2X2 size={14} /> View Wall</button>}
    </div>
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
