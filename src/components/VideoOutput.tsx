import { useState } from 'react';
import { ArrowDownToLine, CircleCheck, Clapperboard, Expand, LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';
import type { GenerationRequest, JobStatusResponse } from '../lib/types';
import { downloadOutput } from '../services/generation';

interface Props {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  job?: JobStatusResponse;
  request?: GenerationRequest;
  error?: string;
  onReset: () => void;
  onRetry: () => void;
}
export function VideoOutput({ status, job, request, error, onReset, onRetry }: Props) {
  const [downloadError, setDownloadError] = useState<string>();
  const [mediaError, setMediaError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const output = job?.output;
  const progress = job?.progress ?? 0;
  async function download() {
    if (!output) return;
    setDownloading(true); setDownloadError(undefined);
    try { await downloadOutput(output); } catch (error) { setDownloadError(error instanceof Error ? error.message : 'Download failed.'); }
    finally { setDownloading(false); }
  }
  return <section className="output-panel" aria-label="Video output">
    <div className="output-heading"><div><span className="eyebrow">THE CANVAS</span><h2>Your next great scene.</h2></div><span className={`status-badge status-${status}`}><span />{status === 'idle' ? 'Ready to create' : status === 'processing' ? 'Generating' : status === 'completed' ? 'Complete' : 'Needs attention'}</span></div>
    <div className={`canvas canvas-${status}`}>
      {status === 'completed' && output ? <>
        <video key={output.url} src={output.url} controls playsInline preload="metadata" poster="/demo-poster.jpg" aria-label="Generated MP4 video" onError={() => setMediaError(true)} />
        {mediaError && <div className="media-error" role="alert">This video could not be played. Try downloading it or generate again.</div>}
      </> : <>
        <img src="/demo-poster.jpg" alt="Dreamlike violet mountain landscape under a glowing sun" className="canvas-art" />
        <div className="canvas-shade" />
        {status === 'idle' && <div className="canvas-message"><div className="canvas-icon"><Clapperboard size={25} /></div><h3>From a thought<br />to a moving world.</h3><p>Describe your vision. We’ll set it in motion.</p><span className="canvas-caption">YOUR VIDEO WILL APPEAR HERE</span></div>}
        {status === 'processing' && <div className="canvas-message processing-message"><div className="canvas-icon"><LoaderCircle size={27} className="animate-spin" /></div><h3>Bringing your<br />vision to life.</h3><p>{job?.status === 'queued' ? 'Your scene is in the queue.' : progress < 40 ? 'Setting the scene…' : progress < 75 ? 'Finding the motion…' : 'Adding the finishing touches…'}</p><div className="progress-track" role="progressbar" aria-label="Generation progress" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${Math.max(4, progress)}%` }} /></div><span className="progress-label">{progress}% <span>Keep this tab open</span></span><button className="text-button cancel-button" onClick={onReset}>Cancel preview</button></div>}
        {status === 'failed' && <div className="canvas-message"><div className="canvas-icon error-icon"><TriangleAlert size={25} /></div><h3>A small interruption.</h3><p role="alert">{error}</p><button className="secondary-button" onClick={onRetry}><RotateCcw size={15} /> Try again</button></div>}
      </>}
      {status === 'idle' && <><div className="canvas-corner">KNIGHT / STUDIO</div><span className="canvas-corner bottom">IMAGINATION, IN MOTION <Expand size={14} /></span></>}
    </div>
    <div className="output-bottom">
      <div><h3>{status === 'completed' ? 'Your scene is ready' : 'A space for your imagination'}</h3><p>{status === 'completed' && output ? `${output.width} × ${output.height} · ${output.fps} FPS · ${output.durationSeconds}s · MP4` : 'Create a clip. Play it back. Make it yours.'}</p></div>
      <button className="secondary-button download-button" disabled={!output || downloading} onClick={download}>{downloading ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />} {downloading ? 'Downloading…' : 'Download MP4'}</button>
    </div>
    {downloadError && <p className="field-error" role="alert">{downloadError}</p>}
    {status === 'completed' && output?.isMock && <div className="demo-result"><CircleCheck size={16} /><p><strong>Demo complete.</strong> This is a bundled 6-second sample. Your prompt and settings are ready for the real generation backend.</p><button className="icon-button" aria-label="Start a new generation" onClick={onReset}><RotateCcw size={16} /></button></div>}
    <div className="creative-note"><span className="note-number">01 — THE POSSIBILITIES</span><p>A world that doesn’t exist.<br /><span>Until you imagine it.</span></p><div className="note-footer"><span>Text, image, or sound. One creative workspace.</span><span className="note-star">✳</span></div></div>
    {request && status === 'completed' && <div className="last-prompt"><span className="eyebrow">SCENE NOTES</span><p>{request.prompt || 'Animation from your reference image.'}</p></div>}
    <span className="sr-only" role="status" aria-live="polite">{status === 'processing' ? 'Generation is processing.' : status === 'completed' ? 'Video generation completed.' : status === 'idle' ? 'Ready to generate.' : 'Video generation failed.'}</span>
  </section>;
}
