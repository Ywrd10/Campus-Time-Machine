import { useState } from 'react';
import { ArrowUpRight, Map, Orbit, SlidersHorizontal } from 'lucide-react';
import FreeStudio from './FreeStudio';
import { TimeMachine } from './timeMachine/TimeMachine';
import { isMockProvider } from './services/generation';
import './timeMachine/timeMachine.css';

type View = 'time' | 'free';
const VIEWS = [
  { id: 'time' as const, label: 'Campus explorer', icon: Map },
  { id: 'free' as const, label: 'Free mode', icon: SlidersHorizontal },
];
export default function App() {
  const [view, setView] = useState<View>('time');
  return <div className="app-shell time-shell">
    <a className="skip-link" href="#main-workspace">Skip to workspace</a>
    <header className="machine-header">
      <button type="button" className="machine-brand" onClick={() => setView('time')} aria-label="Campus Time Machine home"><span className="machine-mark"><Orbit size={24} strokeWidth={1.5} /></span><span>CAMPUS<span>TIME MACHINE</span></span></button>
      <nav className="workspace-nav" aria-label="Workspace">
        {VIEWS.map(({ id, label, icon: Icon }) => <button type="button" key={id} aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}><Icon size={15} aria-hidden="true" />{label}</button>)}
      </nav>
      <div className="machine-header-right"><span className="machine-provider"><span />{isMockProvider ? 'DEMO MODE' : 'RELAY MODE'}</span><a href="https://huggingface.co/kandinskylab/Kandinsky-6.0-Lite-distill-5s-Diffusers" target="_blank" rel="noreferrer" aria-label="Kandinsky 6 Lite model card">Kandinsky 6 Lite <ArrowUpRight size={13} /></a></div>
    </header>
    <main id="main-workspace" tabIndex={-1}>
      {/* Keep views mounted so tab changes preserve uploads and ongoing polling. */}
      <div hidden={view !== 'time'}><TimeMachine active={view === 'time'} /></div>
      <div hidden={view !== 'free'}><FreeStudio /></div>
    </main>
  </div>;
}
