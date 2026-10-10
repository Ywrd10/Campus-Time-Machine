import { useRef, useState } from 'react';
import { Film, Image, LoaderCircle, Plus, Sparkles, Type } from 'lucide-react';
import { ModeInputs } from './components/ModeInputs';
import { GenerationSettings } from './components/GenerationSettings';
import { VideoOutput } from './components/VideoOutput';
import { DEFAULT_SETTINGS, normalizeSettings, validateRequest } from './lib/capabilities';
import type { GenerationMode, GenerationRequest, GenerationSettings as Settings } from './lib/types';
import { useGeneration } from './hooks/useGeneration';
import { isMockProvider } from './services/generation';

const MODES = [
  { id: 'text' as const, name: 'Text-to-Video', icon: Type },
  { id: 'image' as const, name: 'Image-to-Video', icon: Image },
  // Audio-to-video is hidden: Kandinsky 6 Lite generates its own soundtrack and can't be driven by input audio.
];
export default function FreeStudio() {
  const [mode, setMode] = useState<GenerationMode>('text');
  const [prompts, setPrompts] = useState<Record<GenerationMode, string>>({ text: '', image: '', audio: '' });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [image, setImage] = useState<File>();
  const [audio, setAudio] = useState<File>();
  const [audioDuration, setAudioDuration] = useState(0);
  const [validation, setValidation] = useState<string>();
  const [settingsNotice, setSettingsNotice] = useState<string>();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const { state, generate, reset } = useGeneration();
  const busy = state.status === 'processing';
  function updateSettings(next: Partial<Settings>) {
    const candidate = { ...settings, ...next };
    const normalized = normalizeSettings(candidate);
    setSettingsNotice(candidate.duration !== normalized.duration ? `Duration adjusted to ${normalized.duration} seconds for this combination.` : undefined);
    setSettings(normalized); setValidation(undefined);
  }
  function createRequest(): GenerationRequest | undefined {
    const base = { settings: { ...settings }, prompt: prompts[mode] };
    if (mode === 'image') {
      if (!image) { setValidation('Upload a source image first.'); return; }
      return { ...base, mode, image };
    }
    if (mode === 'audio') {
      if (!audio) { setValidation('Upload an audio clip first.'); return; }
      return { ...base, mode, audio, audioDuration };
    }
    return { ...base, mode: 'text' };
  }
  function submit() {
    const request = createRequest();
    if (!request) return;
    const error = validateRequest(request);
    setValidation(error || undefined);
    if (!error) void generate(request);
  }
  function newGeneration() {
    reset();
    setPrompts({ text: '', image: '', audio: '' });
    setImage(undefined);
    setAudio(undefined);
    setAudioDuration(0);
    setValidation(undefined);
    setSettingsNotice(undefined);
  }
  function selectMode(nextMode: GenerationMode) {
    setMode(nextMode);
    setValidation(undefined);
  }
  return <div className="workspace free-workspace">
      <div className="workspace-toolbar">
        <div className="workspace-title"><Film size={20} aria-hidden="true" /><h1>Free mode</h1></div>
        <button type="button" className="secondary-button" onClick={newGeneration} disabled={busy}>
          <Plus size={16} aria-hidden="true" /> New generation
        </button>
      </div>
      <div className="studio-grid">
        <section id="generation-controls" className="input-panel panel" aria-labelledby="controls-heading" tabIndex={-1}>
          <div className="panel-heading"><h2 id="controls-heading">Create video</h2></div>
          <div className="input-content">
          <div className="mode-tabs" role="tablist" aria-label="Generation mode">
            {MODES.map(({ id, name, icon: Icon }, index) => <button
              key={id}
              ref={element => { tabs.current[index] = element; }}
              type="button" role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`}
              aria-selected={mode === id} tabIndex={mode === id ? 0 : -1}
              className={mode === id ? 'active' : ''} disabled={busy}
              onClick={() => selectMode(id)}
              onKeyDown={event => {
                const next = event.key === 'ArrowRight' ? (index + 1) % MODES.length
                  : event.key === 'ArrowLeft' ? (index + MODES.length - 1) % MODES.length
                  : event.key === 'Home' ? 0 : event.key === 'End' ? MODES.length - 1 : -1;
                if (next >= 0) {
                  event.preventDefault();
                  selectMode(MODES[next].id);
                  tabs.current[next]?.focus();
                }
              }}
            ><Icon size={15} aria-hidden="true" /><span>{name}</span></button>)}
          </div>
          <form onSubmit={event => { event.preventDefault(); submit(); }}>
            <fieldset disabled={busy}>
              <div id={`panel-${mode}`} role="tabpanel" aria-labelledby={`tab-${mode}`} className="mode-inputs">
                <ModeInputs mode={mode} prompt={prompts[mode]}
                  onPrompt={value => {
                    setPrompts(previous => ({ ...previous, [mode]: value }));
                    setValidation(undefined);
                  }}
                  image={image} onImage={setImage}
                  audio={audio} onAudio={setAudio} onAudioDuration={setAudioDuration}
                />
              </div>
              <GenerationSettings settings={settings} onChange={updateSettings} />
              {settingsNotice && <p className="settings-adjustment" role="status">{settingsNotice}</p>}
              {validation && <p className="field-error" role="alert">{validation}</p>}
              <button type="submit" className="generate-button" disabled={busy}>
                {busy ? <LoaderCircle size={17} className="animate-spin" aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
                <span>{busy ? 'Processing…' : 'Generate'}</span>
              </button>
            </fieldset>
          </form>
          <p className="provider-note">{isMockProvider ? 'Demo generations return a fixed sample MP4.' : 'Jobs are sent to your configured backend.'}</p>
          </div>
        </section>
        <VideoOutput key={`${state.status}-${state.job?.jobId || 'new'}`} {...state}
          onReset={reset}
          onRetry={() => { if (state.request) void generate(state.request); else submit(); }}
        />
      </div>
      <footer className="workspace-footer">
        <span>Knight Hacks IX</span><span>{isMockProvider ? 'Mock provider' : 'HTTP provider'} · Kandinsky 6 Lite</span>
      </footer>
  </div>;
}
