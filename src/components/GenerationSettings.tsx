import { Check, ChevronDown, Gauge, Zap } from 'lucide-react';
import { allowedDurations, dimensions, estimatedSeconds, FPS_OPTIONS, RESOLUTIONS, STEPS } from '../lib/capabilities';
import type { AspectRatio, Fps, GenerationSettings as Settings, Model, Resolution } from '../lib/types';

interface Props {
  settings: Settings;
  onChange: (next: Partial<Settings>) => void;
}

const MODELS: { id: Model; label: string; icon: typeof Zap }[] = [
  { id: 'k6-lite-fast', label: 'Fast', icon: Zap },
  { id: 'k6-lite-quality', label: 'Quality', icon: Gauge },
];

export function GenerationSettings({ settings, onChange }: Props) {
  const [width, height] = dimensions(settings);
  const estimate = estimatedSeconds(settings);
  return <div className="settings">
    <h3>Generation settings</h3>
    <span id="model-label" className="sr-only">Model</span>
    <div className="model-picker" role="radiogroup" aria-labelledby="model-label">
      {MODELS.map(({ id, label, icon: Icon }) => <label key={id} className={`model-option ${settings.model === id ? 'selected' : ''}`}>
        <input type="radio" name="model" value={id} checked={settings.model === id}
          onChange={() => onChange({ model: id })} className="sr-only" />
        <Icon size={15} aria-hidden="true" />
        <span>{label} · {STEPS[id]} steps</span>
        {settings.model === id && <Check size={14} className="model-check" aria-hidden="true" />}
      </label>)}
    </div>
    <div className="settings-grid">
      <label><span className="field-label">Resolution</span><div className="select-wrap"><select value={settings.resolution} onChange={event => onChange({ resolution: event.target.value as Resolution })}>{RESOLUTIONS.map(resolution => <option key={resolution}>{resolution}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div></label>
      <label><span className="field-label">Aspect ratio</span><div className="select-wrap"><select value={settings.aspectRatio} onChange={event => onChange({ aspectRatio: event.target.value as AspectRatio })}><option value="16:9">16:9 · Landscape</option><option value="9:16">9:16 · Portrait</option></select><ChevronDown size={14} aria-hidden="true" /></div></label>
      <label><span className="field-label">Frame rate</span><div className="select-wrap"><select value={settings.fps} onChange={event => onChange({ fps: Number(event.target.value) as Fps })}>{FPS_OPTIONS.map(fps => <option key={fps} value={fps}>{fps} FPS</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div></label>
      <label><span className="field-label">Duration</span><div className="select-wrap"><select value={settings.duration} onChange={event => onChange({ duration: Number(event.target.value) })}>{allowedDurations(settings).map(duration => <option key={duration} value={duration}>{duration} seconds</option>)}</select><ChevronDown size={14} aria-hidden="true" /></div></label>
    </div>
    <p className="settings-note">{width.toLocaleString()} × {height.toLocaleString()} px{estimate && <> · ~{estimate}s on the GPU</>}</p>
  </div>;
}
