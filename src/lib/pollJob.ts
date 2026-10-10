import type { JobStatusResponse } from './types';

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

// Shared by Free mode and timeline jobs. Progress and shot states come from the service.
export async function pollJob<T extends JobStatusResponse>(
  getStatus: () => Promise<T>, signal: AbortSignal, onUpdate: (job: T) => void,
) {
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    signal.throwIfAborted();
    const job = await getStatus();
    signal.throwIfAborted();
    if (job.status === 'failed') {
      onUpdate(job);
      throw new Error(job.error || 'Generation failed. Please try again.');
    }
    if (job.status === 'completed' && !job.output) throw new Error('Generation finished without a video. Please try again.');
    onUpdate(job);
    if (job.status === 'completed') return;
    await wait(800, signal);
  }
  throw new Error('This job is taking too long. Check the backend and try again.');
}
