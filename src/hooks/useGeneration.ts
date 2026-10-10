import { useEffect, useRef, useState } from 'react';
import { generationService } from '../services/generation';
import type { GenerationRequest, JobStatusResponse } from '../lib/types';

type GenerationState = {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  job?: JobStatusResponse;
  request?: GenerationRequest;
  error?: string;
};
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
export function useGeneration() {
  const [state, setState] = useState<GenerationState>({ status: 'idle' });
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function generate(request: GenerationRequest) {
    // Synchronous guard prevents double clicks before React renders.
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: 'processing', request });
    try {
      const submitted = await generationService.submit(request, abort.signal);
      const deadline = Date.now() + 15 * 60 * 1000;
      while (Date.now() < deadline) {
        const job = await generationService.getStatus(submitted.jobId, abort.signal);
        abort.signal.throwIfAborted();
        if (job.status === 'failed') throw new Error(job.error || 'Generation failed. Please try again.');
        if (job.status === 'completed') {
          if (!job.output) throw new Error('Generation finished without a video. Please try again.');
          setState({ status: 'completed', job, request });
          return;
        }
        setState({ status: 'processing', job, request });
        await wait(800, abort.signal);
      }
      throw new Error('This job is taking too long. Check the backend and try again.');
    } catch (error) {
      if (abort.signal.aborted) return;
      setState({ status: 'failed', request, error: error instanceof Error ? error.message : 'Something went wrong. Please try again.' });
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }
  function reset() {
    controller.current?.abort();
    controller.current = null;
    setState({ status: 'idle' });
  }
  return { state, generate, reset };
}
