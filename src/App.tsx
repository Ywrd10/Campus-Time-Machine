import { useRef, useState } from 'react';
import { ArrowRight, AudioLines, Film, Image, LoaderCircle, Plus, Sparkles, Type, Zap } from 'lucide-react';
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
  { id: 'audio' as const, name: 'Audio-to-Video', icon: AudioLines },
];
export default function App() {
  const [mode, setMode] = useState<GenerationMode>('text');
  const [prompts, setPrompts] = useState<Record<GenerationMode, string>>({ text: '', image: '', audio: '' });
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [image, setImage] = useState<File>();
  const [finalFrame, setFinalFrame] = useState<File>();
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
    setSettingsNotice(candidate.duration !== normalized.duration ? 'Duration adjusted to 6 seconds for this combination.' : undefined);
    setSettings(normalized); setValidation(undefined);
  }
  function createRequest(): GenerationRequest | undefined {
    const base = { settings: { ...settings }, prompt: prompts[mode] };
    if (mode === 'image') {
      if (!image) { setValidation('Upload a source image first.'); return; }
      return { ...base, mode, image, finalFrame };
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
  function newScene() {
    reset(); setPrompts({ text: '', image: '', audio: '' }); setImage(undefined); setFinalFrame(undefined); setAudio(undefined); setAudioDuration(0); setValidation(undefined); setSettingsNotice(undefined);
  }
  return <div className="app-shell">
    <header className="app-header"><a href="/" className="brand" aria-label="Knight Studio home"><span className="brand-symbol">K<span /></span><span>knight<span className="brand-light">studio</span><sup> / </sup></span></a><div className="header-center"><Film size={15} /> CREATIVE WORKSPACE</div><div className="header-right"><span className="hackathon-tag">KNIGHT HACKS <b>IX</b></span><a className="docs-link" href="https://docs.ltx.io/models/ltx-2-5" target="_blank" rel="noreferrer">Model docs <ArrowRight size={14} /></a></div></header>
    <main>
      <div className="page-heading"><div><div className="eyebrow"><span className="tiny-line" /> IMAGINATION, IN MOTION</div><h1>Make something <span>unreal.</span></h1><p>Your ideas. A little AI. Endless possibilities.</p></div><button type="button" className="secondary-button new-scene" onClick={newScene} disabled={busy}><Plus size={16} /> New scene</button></div>
      <div className="studio-grid">
        <section className="input-panel" aria-label="Generation input">
          <div className="input-heading"><h2><Sparkles size={18} /> Create a video</h2><span className="panel-step">01 / INPUT</span></div>
          <div className="mode-tabs" role="tablist" aria-label="Generation mode">{MODES.map(({ id, name, icon: Icon }, index) => <button key={id} ref={element => { tabs.current[index] = element; }} type="button" role="tab" id={`tab-${id}`} aria-controls={`panel-${id}`} aria-selected={mode === id} tabIndex={mode === id ? 0 : -1} className={mode === id ? 'active' : ''} disabled={busy} onClick={() => { setMode(id); setValidation(undefined); }} onKeyDown={event => {
            const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
            if (next >= 0) { event.preventDefault(); setMode(MODES[next].id); setValidation(undefined); tabs.current[next]?.focus(); }
          }}><Icon size={15} /><span>{name}</span></button>)}</div>
          <form onSubmit={event => { event.preventDefault(); submit(); }}>
            <fieldset disabled={busy}>
              <div id={`panel-${mode}`} role="tabpanel" aria-labelledby={`tab-${mode}`} className="mode-inputs"><ModeInputs mode={mode} prompt={prompts[mode]} onPrompt={value => { setPrompts(previous => ({ ...previous, [mode]: value })); setValidation(undefined); }} image={image} onImage={setImage} finalFrame={finalFrame} onFinalFrame={setFinalFrame} audio={audio} onAudio={setAudio} onAudioDuration={setAudioDuration} /></div>
              <GenerationSettings settings={settings} onChange={updateSettings} mode={mode} audioDuration={audioDuration} />
              {settingsNotice && <p className="settings-adjustment" role="status">{settingsNotice}</p>}
              {validation && <p className="field-error" role="alert">{validation}</p>}
              <button type="submit" className="generate-button" disabled={busy}>{busy ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}<span>{busy ? 'Creating your scene…' : 'Generate video'}</span>{!busy && <ArrowRight size={18} />}</button>
            </fieldset>
          </form>
          <div className="provider-note"><span className="provider-dot" /><span>{isMockProvider ? 'Demo mode' : 'Backend mode'} <span className="separator">·</span> {isMockProvider ? 'Local sample, real possibilities' : 'Your generation server'}</span></div>
        </section>
        <VideoOutput key={`${state.status}-${state.job?.jobId || 'new'}`} {...state} onReset={reset} onRetry={() => { if (state.request) void generate(state.request); else submit(); }} />
      </div>
      <div className="studio-footer"><div><Zap size={14} /><span>Built for creative exploration</span><span className="footer-dot">·</span><span>LTX-2.5</span></div><div>Inference target <span className="amd-mark">AMD</span> Radeon Cloud <span className="footer-dot">/</span> ROCm</div></div>
    </main>
    <footer className="app-footer"><span>KNIGHT STUDIO <span>© 2026</span></span><span>A Knight Hacks IX project <span className="footer-dot">·</span> AI / ML</span><span>THINK IT. MAKE IT. PLAY IT.</span></footer>
  </div>;
}
