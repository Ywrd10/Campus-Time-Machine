import { describe, expect, it } from 'vitest';
import { allowedDurations, DEFAULT_SETTINGS, dimensions, FPS_OPTIONS, maximumAudioDuration, normalizeSettings, RESOLUTIONS, validateRequest } from '../src/lib/capabilities';
import { HttpGenerationService, MockGenerationService } from '../src/services/generation';
import type { GenerationRequest, Model } from '../src/lib/types';

const request: GenerationRequest = { mode: 'text', prompt: 'A cinematic mountain scene', settings: DEFAULT_SETTINGS };
describe('Documented LTX-2.5 combinations', () => {
  it('defaults to Fast, landscape 720p, 24 FPS, and 6 seconds', () => {
    expect(dimensions(DEFAULT_SETTINGS)).toEqual([1280, 720]);
    expect(DEFAULT_SETTINGS.fps).toBe(24);
    expect(DEFAULT_SETTINGS.duration).toBe(6);
    expect(DEFAULT_SETTINGS.model).toBe('ltx-2-5-fast');
  });
  it('matches every model/resolution/FPS row and clamps unsupported duration', () => {
    for (const model of ['ltx-2-5-fast', 'ltx-2-5-pro'] as Model[]) {
      for (const resolution of RESOLUTIONS) for (const fps of FPS_OPTIONS) {
        const settings = { ...DEFAULT_SETTINGS, model, resolution, fps, duration: 20 };
        const extended = model === 'ltx-2-5-fast' && ['720p', '1080p'].includes(resolution) && [24, 25].includes(fps);
        expect(allowedDurations(settings)).toEqual(extended ? [6, 8, 10, 12, 14, 16, 18, 20] : [6, 8, 10]);
        expect(normalizeSettings(settings).duration).toBe(extended ? 20 : 6);
      }
    }
  });
  it('reverses portrait dimensions and validates prompts/settings before submitting', () => {
    expect(dimensions({ ...DEFAULT_SETTINGS, aspectRatio: '9:16', resolution: '4K' })).toEqual([2160, 3840]);
    expect(validateRequest({ ...request, prompt: '   ' })).toContain('Describe');
    expect(validateRequest({ ...request, settings: { ...DEFAULT_SETTINGS, model: 'ltx-2-5-pro', duration: 20 } })).toContain('duration');
  });
  it('derives audio length from the input and applies its separate limits', () => {
    const audio = new File([new Uint8Array(12)], 'sound.mp3', { type: 'audio/mpeg' });
    const audioRequest: GenerationRequest = { ...request, mode: 'audio', audio, audioDuration: 12.5 };
    expect(validateRequest(audioRequest)).toBeNull();
    expect(maximumAudioDuration(DEFAULT_SETTINGS)).toBe(20);
    expect(validateRequest({ ...audioRequest, settings: { ...DEFAULT_SETTINGS, model: 'ltx-2-5-pro' } })).toContain('10 seconds');
    expect(validateRequest({ ...audioRequest, audioDuration: 0 })).toContain('preview');
  });
});
describe('Async generation adapters', () => {
  it('moves through queued, processing, and completed with actual sample metadata', async () => {
    let time = 0;
    const service = new MockGenerationService(false, () => time);
    const submitted = await service.submit(request);
    expect((await service.getStatus(submitted.jobId)).status).toBe('queued');
    time = 3000;
    expect((await service.getStatus(submitted.jobId)).status).toBe('processing');
    time = 7000;
    const job = await service.getStatus(submitted.jobId);
    expect(job.status).toBe('completed');
    expect(job.output?.mimeType).toBe('video/mp4');
    expect(job.output?.durationSeconds).toBe(6);
  });
  it('reports simulated failures and respects abort', async () => {
    let time = 0;
    const service = new MockGenerationService(true, () => time);
    const submitted = await service.submit(request);
    time = 7000;
    expect((await service.getStatus(submitted.jobId)).status).toBe('failed');
    const controller = new AbortController(); controller.abort();
    await expect(service.getStatus(submitted.jobId, controller.signal)).rejects.toThrow();
  });
  it('rejects an invalid request without making an HTTP call', async () => {
    const service = new HttpGenerationService('/api');
    await expect(service.submit({ ...request, prompt: '' })).rejects.toThrow('Describe');
  });
});
