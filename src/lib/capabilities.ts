import type { GenerationRequest, GenerationSettings, Model, Resolution } from './types';

// Kandinsky 6.0 Video Lite (distilled) on the AMD W7900D worker. Every size, duration, and step count below was
// rendered on the instance; see outputs/k6/README.md for the clips. The relay imports this file too, so the browser
// and the worker agree on which presets exist.
export const DEFAULT_SETTINGS: GenerationSettings = {
  model: 'k6-lite-quality', resolution: '352p', aspectRatio: '16:9', fps: 24, duration: 3,
};
export const RESOLUTIONS: Resolution[] = ['352p', '480p'];
export const FPS_OPTIONS = [24] as const;
export const DURATIONS = [2, 3, 5];
// Denoising steps per model choice. 6 steps is ~25% faster but the audio comes out ~9 dB quieter.
export const STEPS: Record<Model, number> = { 'k6-lite-fast': 6, 'k6-lite-quality': 10 };
const DIMENSIONS: Record<Resolution, [number, number]> = { '352p': [640, 352], '480p': [864, 480] };

export function dimensions(settings: Pick<GenerationSettings, 'resolution' | 'aspectRatio'>): [number, number] {
  const [w, h] = DIMENSIONS[settings.resolution];
  return settings.aspectRatio === '16:9' ? [w, h] : [h, w];
}
export function validateRequest(request: GenerationRequest): string | null {
  const s = request.settings;
  if (!(s.model in STEPS) || !RESOLUTIONS.includes(s.resolution) || !FPS_OPTIONS.includes(s.fps) ||
      !['16:9', '9:16'].includes(s.aspectRatio)) return 'Choose supported generation settings.';
  if (request.prompt.length > 5000) return 'Keep your prompt under 5,000 characters.';
  if (request.mode === 'audio') return 'Audio-to-video isn’t available with Kandinsky 6 Lite.';
  if (request.mode === 'text' && !request.prompt.trim()) return 'Describe the scene you want to create.';
  if (!DURATIONS.includes(s.duration)) return 'Choose a supported duration for these settings.';
  if (request.mode === 'image') {
    if (!request.image) return 'Upload a source image first.';
    if (request.finalFrame) return 'Final-frame conditioning isn’t available with Kandinsky 6 Lite.';
    const error = validateFile(request.image, 'image');
    if (error) return error;
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
