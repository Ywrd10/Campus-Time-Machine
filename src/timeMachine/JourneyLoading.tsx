import { Sparkles } from 'lucide-react';
import type { TimelineJob } from './types';

export function JourneyLoading({ job, source, demo, onStop }: { job?: TimelineJob; source?: string; demo: boolean; onStop: () => void }) {
  const queued = job?.status === 'queued';
  const progress = !demo && job?.progress !== undefined ? Math.min(100, Math.max(0, job.progress)) : undefined;
  const stage = queued ? 'Waiting for a render slot' : progress === undefined || progress < 10 ? 'Preparing your journey' : progress >= 92 ? 'Adding the final touches' : 'Creating your new timeline';
  return <div className="travel-overlay journey-loading">
    <div className="render-frames" aria-hidden="true">
      <span className="render-frame frame-back" /><span className="render-frame frame-middle" />
      <div className="render-frame frame-front">{source && <img src={source} alt="" />}<span className="frame-scan" /><Sparkles size={25} strokeWidth={1.3} /></div>
      <span className="frame-caption">NOW <span>→</span> THEN</span>
    </div>
    <h3>{stage}</h3>
    <p>{demo ? 'Previewing the journey with a sample clip.' : queued ? 'Your place in the timeline is reserved.' : 'Your campus photo is becoming a different moment in time.'}</p>
    <div className="render-progress" role="progressbar" aria-label={demo ? 'Demo journey processing' : 'Video generation progress'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
      <span className={progress === undefined ? 'progress-indeterminate' : ''} style={progress === undefined ? undefined : { width: `${progress}%` }} />
    </div>
    <span className="render-progress-label">{demo ? 'Interface demo' : progress === undefined ? 'Connecting to your journey' : queued ? 'In queue' : `${Math.round(progress)}% complete`}</span>
    <button className="secondary-button" type="button" onClick={onStop}>Stop waiting</button>
    <small>{demo ? 'Reload to return to this journey.' : 'Stops waiting here; your render may continue.'}</small>
  </div>;
}
