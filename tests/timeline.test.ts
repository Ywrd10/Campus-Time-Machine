import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpTimelineService, MockTimelineService, parseTimelineStatus, validateTimeline } from '../src/services/timeline';
import { MOMENTS, buildShots } from '../src/timeMachine/moments';
import { readLocalWall, readTicket, saveToWall, storeValue, TICKET_KEY, WALL_KEY } from '../src/timeMachine/storage';
import { pollJob } from '../src/lib/pollJob';
import type { TimelineRequest } from '../src/timeMachine/types';

const request: TimelineRequest = { place: 'reflecting-pond', moment: 'future', length: 'film' };
const output = { url: '/demo.mp4', filename: 'demo.mp4', mimeType: 'video/mp4', width: 1280, height: 720, fps: 24, durationSeconds: 6 };
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) || null,
    setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Campus timelines', () => {
  it('builds ordered film templates and a single arrival snapshot', () => {
    for (const moment of MOMENTS) {
      const shots = buildShots(moment, 'our campus photo', 'film');
      expect(shots.map(shot => shot.phase)).toEqual(['now', 'shift', 'arrive']);
      expect(shots.every(shot => shot.prompt.includes('our campus photo') && !shot.prompt.includes('{place}'))).toBe(true);
      expect(buildShots(moment, 'our campus photo', 'snapshot').map(shot => shot.phase)).toEqual(['arrive']);
    }
  });
  it('validates the place, moment, length, and uploaded image', () => {
    expect(validateTimeline(request)).toBeNull();
    expect(validateTimeline({ ...request, moment: 'unknown' })).toBeTruthy();
    expect(validateTimeline({ ...request, place: undefined })).toBeTruthy();
    expect(validateTimeline({ ...request, image: new File(['audio'], 'clip.mp3') })).toContain('PNG');
  });
  it('restores mock jobs in a fresh service and advances shots without fabricated percentages', async () => {
    let time = 1000;
    const first = new MockTimelineService(false, () => time);
    const { jobId } = await first.submit(request);
    expect((await first.getStatus(jobId)).status).toBe('queued');
    time = 4000;
    const restored = new MockTimelineService(false, () => time);
    const processing = await restored.getStatus(jobId);
    expect(processing.shots.map(shot => shot.status)).toEqual(['completed', 'processing', 'queued']);
    expect(processing.progress).toBeUndefined();
    expect(processing.shots.every(shot => shot.progress === undefined)).toBe(true);
    time = 9000;
    const completed = await restored.getStatus(jobId);
    expect(completed.status).toBe('completed');
    expect(completed.output?.durationSeconds).toBe(6);
    expect(completed.shots.every(shot => shot.status === 'completed')).toBe(true);
  });
  it('supports snapshots, failed timelines, and aborts', async () => {
    let time = 0;
    const service = new MockTimelineService(true, () => time);
    const { jobId } = await service.submit({ ...request, length: 'snapshot' });
    expect((await service.getStatus(jobId)).shots.map(shot => shot.phase)).toEqual(['arrive']);
    time = 8000;
    expect((await service.getStatus(jobId)).status).toBe('failed');
    await expect(service.getStatus(jobId, AbortSignal.abort())).rejects.toThrow();
  });
  it('sends only relay-owned identifiers or an image, never browser shot templates', async () => {
    let body: FormData | undefined;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      body = init.body as FormData;
      return new Response(JSON.stringify({ jobId: 'timeline-1' }));
    }));
    const service = new HttpTimelineService('/api');
    await service.submit(request);
    expect(body?.get('place')).toBe('reflecting-pond');
    expect(body?.get('moment')).toBe('future');
    expect(body?.get('length')).toBe('film');
    expect(body?.has('shots')).toBe(false);
    await service.submit({ ...request, length: 'snapshot', quality: 'high' });
    expect(body?.get('quality')).toBe('high');
    await service.submit({ ...request, image: new File(['image'], 'campus.jpg') });
    expect(body?.has('place')).toBe(false);
    expect(body?.get('image')).toBeInstanceOf(File);
  });
  it('validates real outputs and infers phases for the planned relay contract', () => {
    const data = { jobId: 'a', status: 'completed', output, shots: [0, 1, 2].map(() => ({ status: 'completed', progress: 120 })) };
    expect(parseTimelineStatus(data, 'a').shots.map(shot => shot.phase)).toEqual(['now', 'shift', 'arrive']);
    expect(parseTimelineStatus(data, 'a').shots[0].progress).toBe(100);
    expect(() => parseTimelineStatus({ ...data, output: { ...output, url: 'javascript:alert(1)' } }, 'a')).toThrow();
    expect(() => parseTimelineStatus({ ...data, shots: [] }, 'a')).toThrow();
    expect(() => parseTimelineStatus(data, 'other-job')).toThrow();
  });
  it('deduplicates local wall entries and ignores malformed or unsafe stored data', () => {
    const entry = { id: 'a', place: 'Reflecting Pond', moment: 'future', url: '/demo.mp4', isMock: true };
    expect(saveToWall(entry)).toBe(true);
    saveToWall(entry);
    expect(readLocalWall()).toHaveLength(1);
    storeValue(WALL_KEY, [entry, { ...entry, id: 'bad', url: 'javascript:alert(1)' }]);
    expect(readLocalWall()).toHaveLength(1);
    storeValue(TICKET_KEY, { jobId: 'a', provider: 'mock', placeName: 'Reflecting Pond', ...request });
    expect(readTicket()?.jobId).toBe('a');
    storeValue(TICKET_KEY, { jobId: 'a', provider: 'mock', placeName: 'Reflecting Pond', ...request, quality: 'high' });
    expect(readTicket()?.quality).toBe('high');
    storeValue(TICKET_KEY, { jobId: 'a', provider: 'mock', placeName: 'Reflecting Pond', ...request, quality: '4k' });
    expect(readTicket()).toBeUndefined();
    storeValue(TICKET_KEY, { jobId: 'a', provider: 'mock', placeName: 'Reflecting Pond', ...request, moment: 'unknown' });
    expect(readTicket()).toBeUndefined();
  });
  it('keeps generation usable if browser storage is unavailable', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('disabled'); }, setItem: () => { throw new Error('disabled'); } });
    expect(readTicket()).toBeUndefined();
    expect(storeValue(TICKET_KEY, request)).toBe(false);
    const service = new MockTimelineService();
    const { jobId } = await service.submit(request);
    expect((await service.getStatus(jobId)).status).toBe('queued');
  });
  it('shared polling stops on completion and reports worker failures', async () => {
    const update = vi.fn();
    await pollJob(async () => ({ jobId: 'a', status: 'completed' as const, output: { ...output, mimeType: 'video/mp4' as const } }), new AbortController().signal, update);
    expect(update).toHaveBeenCalledTimes(1);
    await expect(pollJob(async () => ({ jobId: 'a', status: 'failed' as const, error: 'Worker failed' }), new AbortController().signal, update)).rejects.toThrow('Worker failed');
  });
});
