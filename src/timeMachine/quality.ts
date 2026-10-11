// Snapshot presets use only settings already supported by the AMD worker.
export type JourneyQuality = 'quick' | 'standard' | 'high';
export const DEFAULT_JOURNEY_QUALITY: JourneyQuality = 'standard';
export const JOURNEY_QUALITIES = [
  { id: 'quick', label: 'Quick', description: 'A faster first look', model: 'k6-lite-fast', width: 640, height: 352, resolution: '352p', timeLabel: 'About 1 minute' },
  { id: 'standard', label: 'Standard', description: 'Balanced detail', model: 'k6-lite-quality', width: 640, height: 352, resolution: '352p', timeLabel: 'About 1–2 minutes' },
  { id: 'high', label: 'High Detail', description: 'A sharper arrival', model: 'k6-lite-quality', width: 864, height: 480, resolution: '480p', timeLabel: 'About 2–3 minutes' },
] as const;
export function journeyQuality(value: unknown) {
  return JOURNEY_QUALITIES.find(preset => preset.id === value);
}
