import { validateFile } from '../lib/capabilities';
import type { Mp4Output } from '../lib/types';
import { isMockProvider } from './generation';
import { MOMENTS, buildShots } from '../timeMachine/moments';
import { PLACES } from '../timeMachine/places';
import { isWallEntry, readLocalWall, readStored, safeMediaUrl, storeValue } from '../timeMachine/storage';
import type { TimelineJob, TimelineRequest, TimelineService, WallEntry } from '../timeMachine/types';

const MOCK_JOBS_KEY = 'campus-time-machine:mock-jobs:v1';
interface MockJob { id: string; started: number; moment: string; place?: string; length: 'snapshot' | 'film'; fail: boolean }
const SAMPLE: Mp4Output = { url: '/demo.mp4', filename: 'campus-time-machine-demo.mp4', mimeType: 'video/mp4', width: 1280, height: 720, fps: 24, durationSeconds: 6, isMock: true };

export function validateTimeline(request: TimelineRequest) {
  if (!MOMENTS.some(moment => moment.id === request.moment)) return 'Choose a destination moment.';
  if (!['snapshot', 'film'].includes(request.length)) return 'Choose Snapshot or Film.';
  if (!request.image && !PLACES.some(place => place.id === request.place)) return 'Choose a campus place or upload a photo.';
  if (request.image) return validateFile(request.image, 'image');
  return null;
}

export class MockTimelineService implements TimelineService {
  private jobs: MockJob[];
  constructor(private shouldFail = false, private now = () => Date.now()) {
    const stored = readStored(MOCK_JOBS_KEY);
    this.jobs = Array.isArray(stored) ? stored.filter((job): job is MockJob =>
      Boolean(job && typeof job.id === 'string' && typeof job.started === 'number' && Number.isFinite(job.started) &&
        MOMENTS.some(moment => moment.id === job.moment) && ['snapshot', 'film'].includes(job.length) &&
        (job.place === undefined || PLACES.some(place => place.id === job.place)) && typeof job.fail === 'boolean')) : [];
  }
  async submit(request: TimelineRequest, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const error = validateTimeline(request);
    if (error) throw new Error(error);
    const jobId = crypto.randomUUID();
    this.jobs = [{ id: jobId, started: this.now(), moment: request.moment, place: request.place, length: request.length, fail: this.shouldFail }, ...this.jobs].slice(0, 20);
    // Persist metadata only; uploaded image bytes never enter localStorage.
    storeValue(MOCK_JOBS_KEY, this.jobs);
    return { jobId };
  }
  async getStatus(jobId: string, signal?: AbortSignal): Promise<TimelineJob> {
    signal?.throwIfAborted();
    const job = this.jobs.find(job => job.id === jobId);
    if (!job) throw new Error('This demo journey is no longer available. Start another journey.');
    const elapsed = Math.max(0, this.now() - job.started);
    const completed = elapsed >= 7200;
    const phases = buildShots(MOMENTS.find(moment => moment.id === job.moment)!, '', job.length).map(shot => shot.phase);
    return {
      jobId, status: completed ? job.fail ? 'failed' : 'completed' : elapsed < 600 ? 'queued' : 'processing',
      error: completed && job.fail ? 'The demo journey could not finish. Retry the journey.' : undefined,
      output: completed && !job.fail ? { ...SAMPLE } : undefined,
      finalFrameUrl: completed && !job.fail ? '/demo-poster.jpg' : undefined,
      shots: phases.map((phase, index) => {
        const step = 7200 / phases.length;
        const done = elapsed >= step * (index + 1);
        return { phase, status: completed && job.fail && index === phases.length - 1 ? 'failed' : done ? 'completed' : elapsed >= step * index ? 'processing' : 'queued', thumbnail: done ? '/demo-poster.jpg' : undefined };
      }),
    };
  }
  async getWall(signal?: AbortSignal) {
    signal?.throwIfAborted();
    return readLocalWall();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function isMp4(value: unknown): value is Mp4Output {
  return isRecord(value) && value.mimeType === 'video/mp4' && safeMediaUrl(value.url) && typeof value.filename === 'string' &&
    ['width', 'height', 'fps', 'durationSeconds'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]) && Number(value[key]) > 0);
}
const statuses = ['queued', 'processing', 'completed', 'failed'];
export function parseTimelineStatus(data: unknown, jobId: string): TimelineJob {
  if (!isRecord(data) || data.jobId !== jobId || !statuses.includes(String(data.status)) || !Array.isArray(data.shots) || ![1, 3].includes(data.shots.length))
    throw new Error('The relay returned an invalid timeline status.');
  if (data.status === 'completed' && !isMp4(data.output)) throw new Error('The relay did not return a valid MP4.');
  const progress = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : undefined;
  return {
    jobId, status: data.status as TimelineJob['status'], progress: progress(data.progress),
    error: typeof data.error === 'string' ? data.error : undefined,
    output: data.status === 'completed' ? data.output as Mp4Output : undefined,
    beforeImageUrl: safeMediaUrl(data.beforeImageUrl) ? data.beforeImageUrl : undefined,
    finalFrameUrl: safeMediaUrl(data.finalFrameUrl) ? data.finalFrameUrl : undefined,
    shots: data.shots.map((shot, index) => {
      if (!isRecord(shot) || !statuses.includes(String(shot.status))) throw new Error('The relay returned an invalid shot status.');
      const phase = shot.phase ?? ((data.shots as unknown[]).length === 1 ? 'arrive' : ['now', 'shift', 'arrive'][index]);
      if (!['now', 'shift', 'arrive'].includes(String(phase))) throw new Error('The relay returned an invalid timeline phase.');
      return { phase: phase as TimelineJob['shots'][number]['phase'], status: shot.status as TimelineJob['status'],
        progress: progress(shot.progress), output: isMp4(shot.output) ? shot.output : undefined,
        thumbnail: safeMediaUrl(shot.thumbnail) ? shot.thumbnail : undefined };
    }),
  };
}

export class HttpTimelineService implements TimelineService {
  constructor(private baseUrl: string) {}
  private async json(path: string, init: RequestInit = {}): Promise<unknown> {
    const timeout = AbortSignal.timeout(30_000);
    const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}${path}`, { ...init, signal });
    if (!response.ok) {
      // The relay explains rejections (no photo for this place, Film unavailable, worker offline).
      const body: unknown = await response.json().catch(() => null);
      throw new Error(isRecord(body) && typeof body.error === 'string' ? body.error : `Timeline relay request failed (${response.status}). Please try again.`);
    }
    return response.json();
  }
  async submit(request: TimelineRequest, signal?: AbortSignal) {
    const error = validateTimeline(request);
    if (error) throw new Error(error);
    const body = new FormData();
    if (request.image) body.set('image', request.image);
    else if (request.place) body.set('place', request.place);
    body.set('moment', request.moment);
    body.set('length', request.length);
    // The relay owns prompt templates, shot durations, and worker configuration.
    const data = await this.json('/timelines', { method: 'POST', body, signal });
    if (!isRecord(data) || typeof data.jobId !== 'string' || !data.jobId) throw new Error('The relay returned an invalid job ID.');
    return { jobId: data.jobId };
  }
  async getStatus(jobId: string, signal?: AbortSignal) {
    return parseTimelineStatus(await this.json(`/timelines/${encodeURIComponent(jobId)}`, { signal }), jobId);
  }
  async getWall(signal?: AbortSignal): Promise<WallEntry[]> {
    const data = await this.json('/wall', { signal });
    if (!Array.isArray(data) || !data.every(isWallEntry)) throw new Error('The relay returned an invalid wall.');
    return data;
  }
}
export const timelineService: TimelineService = isMockProvider
  ? new MockTimelineService(import.meta.env.VITE_MOCK_FAIL === 'true')
  : new HttpTimelineService(import.meta.env.VITE_API_BASE_URL || '/api');
