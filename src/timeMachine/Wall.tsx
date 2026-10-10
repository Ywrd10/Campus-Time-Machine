import { useEffect, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, Grid2X2, LoaderCircle, Play, RefreshCw, X } from 'lucide-react';
import { downloadOutput, isMockProvider } from '../services/generation';
import { timelineService } from '../services/timeline';
import { MOMENTS } from './moments';
import type { WallEntry } from './types';

export function Wall({ active, onTravel }: { active: boolean; onTravel: () => void }) {
  const [entries, setEntries] = useState<WallEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<WallEntry>();
  const [filter, setFilter] = useState('all');
  const [refresh, setRefresh] = useState(0);
  const [downloadError, setDownloadError] = useState<string>();
  const [downloading, setDownloading] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!active) return;
    const abort = new AbortController();
    setLoading(true); setError(undefined);
    timelineService.getWall(abort.signal).then(data => { if (!abort.signal.aborted) setEntries(data); })
      .catch(error => { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load the wall.'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [active, refresh]);
  useEffect(() => {
    if (selected) { setDownloadError(undefined); dialog.current?.showModal(); }
  }, [selected]);
  async function download() {
    if (!selected) return;
    setDownloading(true); setDownloadError(undefined);
    try { await downloadOutput({ url: selected.url, filename: `campus-journey-${selected.id}.mp4` }); }
    catch (error) { setDownloadError(error instanceof Error ? error.message : 'Download failed.'); }
    finally { setDownloading(false); }
  }
  const visible = entries.filter(entry => filter === 'all' || entry.moment === filter);
  const momentLabel = (id: string) => MOMENTS.find(moment => moment.id === id)?.label || id;
  return <div className="time-workspace wall-workspace">
    <div className="time-title-row"><div><p className="eyebrow"><span /> JOURNEY ARCHIVE</p><h1>The Time Machine Wall<span className="title-period">.</span></h1><p className="time-subtitle">{isMockProvider ? 'Your saved demo journeys, stored in this browser.' : 'Completed journeys shared by the timeline relay.'}</p></div>
      <button type="button" className="secondary-button" onClick={() => setRefresh(value => value + 1)} disabled={loading}><RefreshCw size={14} /> Refresh</button></div>
    <div className="wall-toolbar"><span>{entries.length} {entries.length === 1 ? 'journey' : 'journeys'}</span><label>Moment<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All moments</option>{MOMENTS.map(moment => <option key={moment.id} value={moment.id}>{moment.label}</option>)}</select></label></div>
    {loading ? <div className="wall-empty"><LoaderCircle size={26} className="animate-spin" /><p>Loading journeys…</p></div>
      : error ? <div className="wall-empty"><p className="field-error" role="alert">{error}</p><button className="secondary-button" onClick={() => setRefresh(value => value + 1)}>Try again</button></div>
        : visible.length ? <div className="wall-grid">{visible.map(entry => <button className="wall-card" type="button" key={entry.id} onClick={() => setSelected(entry)}>
          <div className="wall-thumbnail">{entry.thumbnail ? <img src={entry.thumbnail} alt="" /> : <Grid2X2 size={32} />}<span className="wall-play"><Play size={20} /></span>{entry.isMock && <small>DEMO SAMPLE</small>}</div><div><span className="small-label">{momentLabel(entry.moment)}</span><h2>{entry.place}</h2><span className="wall-open">Play journey <ArrowRight size={13} /></span></div>
        </button>)}</div>
          : <div className="wall-empty"><Grid2X2 size={34} strokeWidth={1} /><h2>{entries.length ? 'No journeys for this moment' : 'Every journey starts somewhere'}</h2><p>{entries.length ? 'Choose another moment to explore the archive.' : 'Travel to a moment, then save your arrival here.'}</p><button className="secondary-button" onClick={onTravel}>Start a journey <ArrowRight size={14} /></button></div>}
    {selected && <dialog ref={dialog} className="wall-dialog" aria-labelledby="wall-video-title" onClose={() => setSelected(undefined)}>
      <div className="wall-dialog-heading"><div><span className="small-label">{momentLabel(selected.moment)}</span><h2 id="wall-video-title">{selected.place}</h2></div><button type="button" className="icon-button" aria-label="Close journey" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
      <video src={selected.url} controls playsInline preload="metadata" aria-label="Archived journey video" />
      {selected.isMock && <p className="journey-demo-note">Fixed interface sample, not a generated campus journey.</p>}
      <button className="secondary-button" disabled={downloading} type="button" onClick={download}>{downloading ? <LoaderCircle className="animate-spin" size={14} /> : <ArrowDownToLine size={14} />} Download MP4</button>
      {downloadError && <p className="field-error" role="alert">{downloadError}</p>}
    </dialog>}
  </div>;
}
