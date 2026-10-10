import { useEffect, useRef, useState } from 'react';
import { pollJob } from '../lib/pollJob';
import { timelineService } from '../services/timeline';
import { isMockProvider } from '../services/generation';
import { readTicket, storeValue, TICKET_KEY } from './storage';
import type { JourneyTicket, TimelineJob, TimelineRequest } from './types';

interface State {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  ticket?: JourneyTicket;
  job?: TimelineJob;
  error?: string;
}
export function useTimeline() {
  const [state, setState] = useState<State>({ status: 'idle' });
  const [storageAvailable, setStorageAvailable] = useState(true);
  const controller = useRef<AbortController | null>(null);

  async function watch(ticket: JourneyTicket, abort: AbortController) {
    try {
      await pollJob(() => timelineService.getStatus(ticket.jobId, abort.signal), abort.signal,
        job => setState({ status: job.status === 'completed' ? 'completed' : 'processing', ticket, job }));
    } catch (error) {
      if (!abort.signal.aborted) setState(previous => ({ status: 'failed', ticket, job: previous.job,
        error: error instanceof Error ? error.message : 'The journey could not finish.' }));
    } finally {
      if (controller.current === abort) controller.current = null;
    }
  }
  async function start(request: TimelineRequest, placeName: string) {
    if (controller.current) return;
    const abort = new AbortController();
    controller.current = abort;
    setState({ status: 'processing' });
    try {
      const { jobId } = await timelineService.submit(request, abort.signal);
      abort.signal.throwIfAborted();
      const ticket: JourneyTicket = { jobId, provider: isMockProvider ? 'mock' : 'http', place: request.place, placeName, moment: request.moment, length: request.length };
      setStorageAvailable(storeValue(TICKET_KEY, ticket));
      setState({ status: 'processing', ticket });
      await watch(ticket, abort);
    } catch (error) {
      if (!abort.signal.aborted) setState({ status: 'failed', error: error instanceof Error ? error.message : 'The journey could not start.' });
      if (controller.current === abort) controller.current = null;
    }
  }
  function reset() {
    controller.current?.abort();
    controller.current = null;
    storeValue(TICKET_KEY, null);
    setState({ status: 'idle' });
  }
  useEffect(() => {
    const ticket = readTicket();
    if (ticket && ticket.provider === (isMockProvider ? 'mock' : 'http')) {
      const abort = new AbortController();
      controller.current = abort;
      setState({ status: 'processing', ticket });
      void watch(ticket, abort);
    }
    return () => { controller.current?.abort(); controller.current = null; };
  }, []);
  return { ...state, start, reset, storageAvailable };
}
