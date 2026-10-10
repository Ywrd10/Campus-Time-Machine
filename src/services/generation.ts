import { validateRequest, dimensions } from '../lib/capabilities';
import type { GenerationRequest, GenerationService, JobStatusResponse, JobSubmission, Mp4Output } from '../lib/types';

export const isMockProvider = import.meta.env.VITE_GENERATION_PROVIDER !== 'http';

export class MockGenerationService implements GenerationService {
  private jobs = new Map<string, { started: number; fail: boolean }>();
  constructor(private shouldFail = false, private now = () => Date.now()) {}
  async submit(request: GenerationRequest, signal?: AbortSignal): Promise<JobSubmission> {
    signal?.throwIfAborted();
    const error = validateRequest(request);
    if (error) throw new Error(error);
    const jobId = crypto.randomUUID();
    this.jobs.set(jobId, { started: this.now(), fail: this.shouldFail });
    // Keep the mock in-memory and bounded; no files are uploaded or stored.
    if (this.jobs.size > 50) this.jobs.delete(this.jobs.keys().next().value!);
    return { jobId, createdAt: new Date(this.now()).toISOString() };
  }
  async getStatus(jobId: string, signal?: AbortSignal): Promise<JobStatusResponse> {
    signal?.throwIfAborted();
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('This demo job is no longer available. Generate again.');
    const elapsed = this.now() - job.started;
    if (elapsed < 6500) return { jobId, status: elapsed < 1000 ? 'queued' : 'processing', progress: Math.min(96, Math.round(elapsed / 6500 * 100)) };
    if (job.fail) return { jobId, status: 'failed', error: 'The demo worker could not finish this job. Try again.' };
    return {
      jobId, status: 'completed', progress: 100,
      // Actual sample metadata, independent of requested settings.
      output: { url: '/demo.mp4', filename: 'knight-studio-demo.mp4', mimeType: 'video/mp4', width: 1280, height: 720, fps: 24, durationSeconds: 6, isMock: true },
    };
  }
}

// Contract for your team's backend. Change this adapter if the wire format differs.
// No calls to api.ltx.io and no model credentials in the browser.
export class HttpGenerationService implements GenerationService {
  constructor(private baseUrl: string) {}
  private async fetchJson(path: string, init: RequestInit): Promise<unknown> {
    const timeout = AbortSignal.timeout(30_000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, { ...init, signal });
    if (!response.ok) throw new Error(`Backend request failed (${response.status}). Please try again.`);
    return response.json();
  }
  async submit(request: GenerationRequest, signal?: AbortSignal): Promise<JobSubmission> {
    const error = validateRequest(request);
    if (error) throw new Error(error);
    const [width, height] = dimensions(request.settings);
    const body = new FormData();
    body.set('request', JSON.stringify({
      mode: request.mode, prompt: request.prompt.trim(), model: request.settings.model,
      width, height, fps: request.settings.fps,
      durationSeconds: request.mode === 'audio' ? request.audioDuration : request.settings.duration,
    }));
    if (request.mode === 'image') {
      body.set('image', request.image);
      if (request.finalFrame) body.set('finalFrame', request.finalFrame);
    }
    if (request.mode === 'audio') body.set('audio', request.audio);
    const data = await this.fetchJson('/generations', { method: 'POST', body, signal });
    if (!isObject(data) || typeof data.jobId !== 'string' || !data.jobId || typeof data.createdAt !== 'string')
      throw new Error('The backend returned an invalid job response.');
    return { jobId: data.jobId, createdAt: data.createdAt };
  }
  async getStatus(jobId: string, signal?: AbortSignal): Promise<JobStatusResponse> {
    const data = await this.fetchJson(`/generations/${encodeURIComponent(jobId)}`, { signal });
    if (!isObject(data) || data.jobId !== jobId || !['queued', 'processing', 'completed', 'failed'].includes(String(data.status)))
      throw new Error('The backend returned an invalid status response.');
    if (data.status === 'completed' && !isOutput(data.output))
      throw new Error('The backend did not return a valid MP4 output.');
    return {
      jobId, status: data.status as JobStatusResponse['status'],
      progress: typeof data.progress === 'number' && Number.isFinite(data.progress) ? Math.max(0, Math.min(100, data.progress)) : undefined,
      output: data.status === 'completed' ? data.output as Mp4Output : undefined,
      error: typeof data.error === 'string' ? data.error : undefined,
    };
  }
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function isOutput(value: unknown): value is Mp4Output {
  if (!isObject(value) || value.mimeType !== 'video/mp4' || typeof value.url !== 'string' ||
      typeof value.filename !== 'string') return false;
  // Disallow executable URL protocols while accepting same-origin and HTTPS/HTTP assets.
  try { if (!['http:', 'https:'].includes(new URL(value.url, window.location.origin).protocol)) return false; } catch { return false; }
  return ['width', 'height', 'fps', 'durationSeconds'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]) && Number(value[key]) > 0);
}
export const generationService: GenerationService = isMockProvider
  ? new MockGenerationService(import.meta.env.VITE_MOCK_FAIL === 'true')
  : new HttpGenerationService(import.meta.env.VITE_API_BASE_URL || '/api');

export async function downloadOutput(output: Mp4Output): Promise<void> {
  const response = await fetch(output.url);
  if (!response.ok) throw new Error('Download failed. Please try again.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = output.filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
