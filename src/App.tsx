import { useState } from 'react';
import { ArrowUpRight, Grid2X2, Orbit, SlidersHorizontal } from 'lucide-react';
import FreeStudio from './FreeStudio';
import { TimeMachine } from './timeMachine/TimeMachine';
import { Wall } from './timeMachine/Wall';
import { isMockProvider } from './services/generation';
import './timeMachine/timeMachine.css';

type View = 'time' | 'free' | 'wall';
const VIEWS = [
  { id: 'time' as const, label: 'Time Machine', icon: Orbit },
  { id: 'free' as const, label: 'Free mode', icon: SlidersHorizontal },
  { id: 'wall' as const, label: 'Wall', icon: Grid2X2 },
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
      <div className="machine-header-right"><span className="machine-provider"><span />{isMockProvider ? 'DEMO MODE' : 'RELAY MODE'}</span><a href="https://docs.ltx.io/" target="_blank" rel="noreferrer" aria-label="LTX model documentation">LTX-2.5 <ArrowUpRight size={13} /></a></div>
    </header>
    <main id="main-workspace" tabIndex={-1}>
      {/* Keep views mounted so tab changes preserve uploads and ongoing polling. */}
      <div hidden={view !== 'time'}><TimeMachine onWall={() => setView('wall')} /></div>
      <div hidden={view !== 'free'}><FreeStudio /></div>
      <div hidden={view !== 'wall'}><Wall active={view === 'wall'} onTravel={() => setView('time')} /></div>
    </main>
  </div>;
}
