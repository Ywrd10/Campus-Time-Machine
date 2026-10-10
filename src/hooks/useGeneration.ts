import { useEffect, useRef, useState } from 'react';
import { generationService } from '../services/generation';
import { pollJob } from '../lib/pollJob';
import type { GenerationRequest, JobStatusResponse } from '../lib/types';

type GenerationState = {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  job?: JobStatusResponse;
  request?: GenerationRequest;
  error?: string;
};
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
      await pollJob(() => generationService.getStatus(submitted.jobId, abort.signal), abort.signal,
        job => setState({ status: job.status === 'completed' ? 'completed' : 'processing', job, request }));
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
