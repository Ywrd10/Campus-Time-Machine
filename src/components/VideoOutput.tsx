import { useState } from 'react';
import { ArrowDownToLine, CircleCheck, Film, LoaderCircle, RotateCcw, TriangleAlert } from 'lucide-react';
import { STEPS } from '../lib/capabilities';
import type { GenerationRequest, JobStatusResponse } from '../lib/types';
import { downloadOutput, isMockProvider } from '../services/generation';

interface Props {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  job?: JobStatusResponse;
  request?: GenerationRequest;
  error?: string;
  onReset: () => void;
  onRetry: () => void;
}

const STATUS_LABELS = {
  idle: 'Ready', processing: 'Processing', completed: 'Generation complete', failed: 'Failed',
};

export function VideoOutput({ status, job, request, error, onReset, onRetry }: Props) {
  const [downloadError, setDownloadError] = useState<string>();
  const [mediaError, setMediaError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const output = status === 'completed' ? job?.output : undefined;
  // A real backend may omit progress. Do not invent a percentage or stage.
  const progress = !isMockProvider && typeof job?.progress === 'number' && Number.isFinite(job.progress)
    ? Math.max(0, Math.min(100, job.progress)) : undefined;
  const queued = job?.status === 'queued';

  async function download() {
    if (!output || downloading) return;
    setDownloading(true);
    setDownloadError(undefined);
    try {
      await downloadOutput(output);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return <section className="output-panel panel" aria-labelledby="output-heading">
    <div className="panel-heading">
      <h2 id="output-heading">Output preview</h2>
      <span className={`status-badge status-${status}`}><span aria-hidden="true" />{status === 'processing' && queued ? 'Queued' : STATUS_LABELS[status]}</span>
    </div>
    <div className={`canvas canvas-${status}`} aria-busy={status === 'processing'}>
      {output ? <>
        <video key={output.url} src={output.url} controls playsInline preload="metadata"
          poster={output.isMock ? '/demo-poster.jpg' : undefined}
          aria-label="Generated MP4 video" onError={() => setMediaError(true)} />
        {mediaError && <div className="media-error" role="alert">This video could not be played. Try downloading it or generate again.</div>}
      </> : <div className="canvas-message">
        {status === 'idle' && <>
          <Film size={30} strokeWidth={1.5} aria-hidden="true" />
          <h3>No video generated</h3>
          <p>Choose an input and select Generate.<br />Your video will appear here.</p>
        </>}
        {status === 'processing' && <>
          <LoaderCircle size={27} className="animate-spin" aria-hidden="true" />
          <h3>{queued ? 'Generation queued' : 'Processing video'}</h3>
          <p>{isMockProvider ? 'Running a simulated job. A local sample will be returned.' : queued ? 'Waiting for the generation worker.' : 'The generation worker is processing your input.'}</p>
          {progress !== undefined && <div className="generation-progress">
            <progress value={progress} max={100} aria-label="Generation progress" />
            <span>{Math.round(progress)}%</span>
          </div>}
          <button type="button" className="secondary-button" onClick={onReset}>Stop waiting</button>
          {!isMockProvider && <small>This stops polling; the server job may continue.</small>}
        </>}
        {status === 'failed' && <>
          <TriangleAlert size={28} className="error-icon" aria-hidden="true" />
          <h3>Generation failed</h3>
          <p className="output-error" role="alert">{error || 'Generation could not be completed. Please try again.'}</p>
          <button type="button" className="secondary-button" onClick={onRetry}><RotateCcw size={15} /> Retry generation</button>
        </>}
      </div>}
    </div>
    <div className="output-actions">
      <div className="output-file"><Film size={16} aria-hidden="true" /><span title={output?.filename}>{output?.filename || 'MP4 output'}</span></div>
      <button type="button" className="secondary-button download-button" disabled={!output || downloading} onClick={download}>
        {downloading ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowDownToLine size={16} />}
        {downloading ? 'Downloading…' : 'Download MP4'}
      </button>
    </div>
    {output && <div className="output-details">
      <dl className="output-metadata">
        <div><dt>Resolution</dt><dd>{output.width} × {output.height}</dd></div>
        <div><dt>Duration</dt><dd>{output.durationSeconds}s</dd></div>
        <div><dt>Frame rate</dt><dd>{output.fps} FPS</dd></div>
        {request && <div><dt>Requested model</dt><dd>Kandinsky 6 Lite · {STEPS[request.settings.model]} steps</dd></div>}
      </dl>
      {output.isMock && <p className="demo-result"><CircleCheck size={15} aria-hidden="true" /><span>Sample output · {output.durationSeconds}-second demo clip. It does not reflect your input or settings.</span></p>}
      {request?.prompt && <details className="output-prompt"><summary>Generation prompt</summary><p>{request.prompt}</p></details>}
    </div>}
    {downloadError && <div className="output-details"><p className="field-error" role="alert">{downloadError}</p></div>}
    <span className="sr-only" role="status" aria-live="polite">{status === 'processing' ? queued ? 'Generation queued.' : 'Generation is processing.' : status === 'completed' ? 'Video generation completed.' : status === 'idle' ? 'Ready to generate.' : 'Video generation failed.'}</span>
  </section>;
}
