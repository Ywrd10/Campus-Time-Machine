import { Check, ChevronDown, Gauge, SlidersHorizontal, Zap } from 'lucide-react';
import { allowedDurations, dimensions, FPS_OPTIONS, maximumAudioDuration, RESOLUTIONS } from '../lib/capabilities';
import type { AspectRatio, Fps, GenerationMode, GenerationSettings as Settings, Resolution } from '../lib/types';

interface Props { settings: Settings; onChange: (next: Partial<Settings>) => void; mode: GenerationMode; audioDuration: number }
export function GenerationSettings({ settings, onChange, mode, audioDuration }: Props) {
  const [width, height] = dimensions(settings);
  return <div className="settings">
    <div className="section-heading"><h3><SlidersHorizontal size={15} /> Generation settings</h3><span>LTX-2.5</span></div>
    <span className="field-label">Model</span>
    <div className="model-picker" role="radiogroup" aria-label="Generation model">
      {(['fast', 'pro'] as const).map(variant => <label key={variant} className={`model-option ${settings.model.endsWith(variant) ? 'selected' : ''}`}>
        <input type="radio" name="model" value={variant} checked={settings.model.endsWith(variant)} onChange={() => onChange({ model: `ltx-2-5-${variant}` })} className="sr-only" />
        {variant === 'fast' ? <Zap size={17} /> : <Gauge size={17} />}
        <span><strong>LTX-2.5 {variant === 'fast' ? 'Fast' : 'Pro'}</strong><small>{variant === 'fast' ? 'Made for exploration' : 'More detail, more fidelity'}</small></span>
        {settings.model.endsWith(variant) && <Check size={14} className="model-check" />}
      </label>)}
    </div>
    <div className="settings-grid">
      <label><span className="field-label">Resolution</span><div className="select-wrap"><select value={settings.resolution} onChange={event => onChange({ resolution: event.target.value as Resolution })}>{RESOLUTIONS.map(resolution => <option key={resolution}>{resolution}</option>)}</select><ChevronDown size={14} /></div></label>
      <label><span className="field-label">Aspect ratio</span><div className="select-wrap"><select value={settings.aspectRatio} onChange={event => onChange({ aspectRatio: event.target.value as AspectRatio })}><option value="16:9">16:9 · Landscape</option><option value="9:16">9:16 · Portrait</option></select><ChevronDown size={14} /></div></label>
      <label><span className="field-label">Frame rate</span><div className="select-wrap"><select value={settings.fps} onChange={event => onChange({ fps: Number(event.target.value) as Fps })}>{FPS_OPTIONS.map(fps => <option key={fps} value={fps}>{fps} FPS</option>)}</select><ChevronDown size={14} /></div></label>
      {mode === 'audio' ? <div><span className="field-label">Duration</span><div className="audio-duration">{audioDuration > 0 ? `${audioDuration.toFixed(1)}s · From audio` : 'From input audio'}</div></div> : <label><span className="field-label">Duration</span><div className="select-wrap"><select value={settings.duration} onChange={event => onChange({ duration: Number(event.target.value) })}>{allowedDurations(settings).map(duration => <option key={duration} value={duration}>{duration} seconds</option>)}</select><ChevronDown size={14} /></div></label>}
    </div>
    <p className="settings-note">{width.toLocaleString()} × {height.toLocaleString()} px <span>·</span> {mode === 'audio' ? `Audio up to ${maximumAudioDuration(settings)} seconds` : `${settings.fps} FPS · ${settings.duration} seconds`}</p>
  </div>;
}
