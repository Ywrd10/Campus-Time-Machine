import { Check, Circle, LoaderCircle } from 'lucide-react';
import { isMockProvider } from '../services/generation';
import type { TimelineJob, TimelineShot } from './types';

const LABELS = { now: 'Now', shift: 'Shift', arrive: 'Arrive' };
export function TimelineProgress({ job, film }: { job?: TimelineJob; film: boolean }) {
  const shots: TimelineShot[] = job?.shots || (film ? ['now', 'shift', 'arrive'] as const : ['arrive'] as const).map(phase => ({ phase, status: 'queued' as const }));
  return <div className="timeline-strip" aria-label={isMockProvider ? 'Simulated timeline' : 'Journey timeline'}>
    {shots.map((shot, index) => <div key={shot.phase} className={`timeline-step ${shot.status}`}>
      <div className="timeline-marker">{shot.status === 'completed' ? <Check size={13} /> : shot.status === 'processing' ? <LoaderCircle size={13} className="animate-spin" /> : <Circle size={10} />}</div>
      <span className="timeline-label"><small>SHOT {String(index + 1).padStart(2, '0')}</small><strong>{LABELS[shot.phase]}</strong>
        {!isMockProvider && shot.progress !== undefined && shot.status === 'processing' && <progress aria-label={`${LABELS[shot.phase]} progress`} max={100} value={shot.progress} />}
      </span>
      {shot.thumbnail && <img className="shot-thumbnail" src={shot.thumbnail} alt={`${LABELS[shot.phase]} shot thumbnail`} />}
    </div>)}
  </div>;
}
