import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, dimensions, STEPS, validateRequest } from '../src/lib/capabilities';
import { HttpGenerationService, MockGenerationService } from '../src/services/generation';
import type { GenerationRequest } from '../src/lib/types';

const request: GenerationRequest = { mode: 'text', prompt: 'A cinematic mountain scene', settings: DEFAULT_SETTINGS };
describe('Tested Kandinsky 6 Lite presets', () => {
  it('defaults to Quality, landscape 640x352, 24 FPS, and 3 seconds', () => {
    expect(dimensions(DEFAULT_SETTINGS)).toEqual([640, 352]);
    expect(DEFAULT_SETTINGS.fps).toBe(24);
    expect(DEFAULT_SETTINGS.duration).toBe(3);
    expect(STEPS[DEFAULT_SETTINGS.model]).toBe(10);
  });
  it('reverses portrait dimensions and validates prompts/settings before submitting', () => {
    expect(dimensions({ ...DEFAULT_SETTINGS, aspectRatio: '9:16', resolution: '480p' })).toEqual([480, 864]);
    expect(validateRequest({ ...request, prompt: '   ' })).toContain('Describe');
    expect(validateRequest({ ...request, settings: { ...DEFAULT_SETTINGS, duration: 10 } })).toContain('duration');
  });
  it('rejects inputs the model cannot use', () => {
    const image = new File([new Uint8Array(12)], 'frame.png', { type: 'image/png' });
    const audio = new File([new Uint8Array(12)], 'sound.mp3', { type: 'audio/mpeg' });
    expect(validateRequest({ ...request, mode: 'image', image })).toBeNull();
    expect(validateRequest({ ...request, mode: 'image', image, finalFrame: image })).toContain('Final-frame');
    expect(validateRequest({ ...request, mode: 'audio', audio, audioDuration: 3 })).toContain('Audio-to-video');
  });
});
describe('Async generation adapters', () => {
  it('moves through queued, processing, and completed with actual sample metadata', async () => {
    let time = 0;
    const service = new MockGenerationService(false, () => time);
    const submitted = await service.submit(request);
    expect((await service.getStatus(submitted.jobId)).status).toBe('queued');
    time = 3000;
    const processing = await service.getStatus(submitted.jobId);
    expect(processing.status).toBe('processing');
    expect(processing.progress).toBeUndefined();
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
