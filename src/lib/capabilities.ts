import type { GenerationRequest, GenerationSettings, Resolution } from './types';

// Documented LTX-2.5 presets: https://docs.ltx.io/models/ltx-2-5
// These are frontend presets, not an assumption about a hosted LTX provider.
// A self-hosted worker must map Fast/Pro to its pipelines, pad/crop spatial
// dimensions, and map duration to valid frame counts (8n+1) as needed.
export const DEFAULT_SETTINGS: GenerationSettings = {
  model: 'ltx-2-5-fast', resolution: '720p', aspectRatio: '16:9', fps: 24, duration: 6,
};
export const RESOLUTIONS: Resolution[] = ['720p', '1080p', '1440p', '4K'];
export const FPS_OPTIONS = [24, 25, 48, 50] as const;
const DIMENSIONS: Record<Resolution, [number, number]> = {
  '720p': [1280, 720], '1080p': [1920, 1080], '1440p': [2560, 1440], '4K': [3840, 2160],
};
export function dimensions(settings: GenerationSettings): [number, number] {
  const [w, h] = DIMENSIONS[settings.resolution];
  return settings.aspectRatio === '16:9' ? [w, h] : [h, w];
}
export function allowedDurations(settings: GenerationSettings): number[] {
  const extended = settings.model === 'ltx-2-5-fast' &&
    ['720p', '1080p'].includes(settings.resolution) && [24, 25].includes(settings.fps);
  return extended ? [6, 8, 10, 12, 14, 16, 18, 20] : [6, 8, 10];
}
export function normalizeSettings(settings: GenerationSettings): GenerationSettings {
  return { ...settings, duration: allowedDurations(settings).includes(settings.duration) ? settings.duration : 6 };
}
export function maximumAudioDuration(settings: GenerationSettings): number {
  // Audio endpoint follows the input; it has a separate resolution/model limit.
  // https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-audio-to-video
  return settings.model === 'ltx-2-5-fast' && ['720p', '1080p'].includes(settings.resolution) ? 20 : 10;
}
export function validateRequest(request: GenerationRequest): string | null {
  const s = request.settings;
  if (!['ltx-2-5-fast', 'ltx-2-5-pro'].includes(s.model) ||
      !RESOLUTIONS.includes(s.resolution) || !FPS_OPTIONS.includes(s.fps) ||
      !['16:9', '9:16'].includes(s.aspectRatio)) return 'Choose supported generation settings.';
  if (request.prompt.length > 5000) return 'Keep your prompt under 5,000 characters.';
  if ((request.mode === 'text' || request.mode === 'audio') && !request.prompt.trim())
    return 'Describe the scene you want to create.';
  if (request.mode !== 'audio' && !allowedDurations(s).includes(s.duration))
    return 'Choose a supported duration for these settings.';
  if (request.mode === 'image') {
    if (!request.image) return 'Upload a source image first.';
    const error = validateFile(request.image, 'image') || (request.finalFrame && validateFile(request.finalFrame, 'image'));
    if (error) return error;
  }
  if (request.mode === 'audio') {
    const error = validateFile(request.audio, 'audio');
    if (error) return error;
    if (!Number.isFinite(request.audioDuration) || request.audioDuration <= 0)
      return 'Wait for the audio preview to load, or choose a playable audio file.';
    if (request.audioDuration > maximumAudioDuration(s))
      return `Audio must be ${maximumAudioDuration(s)} seconds or shorter with these settings. Choose a shorter clip or a compatible model and resolution.`;
  }
  return null;
}
export function validateFile(file: File, kind: 'image' | 'audio'): string | null {
  const extensions = kind === 'image' ? /\.(png|jpe?g|webp)$/i : /\.(mp3|wav|m4a|ogg)$/i;
  const limit = kind === 'image' ? 15 : 32;
  if (!extensions.test(file.name)) return kind === 'image' ? 'Use a PNG, JPG, or WebP image.' : 'Use an MP3, WAV, M4A, or OGG audio file.';
  if (file.size === 0) return 'This file is empty. Choose another file.';
  if (file.size > limit * 1024 * 1024) return `Choose a file smaller than ${limit} MB.`;
  return null;
}
