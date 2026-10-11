import { ArrowUpRight, Orbit } from 'lucide-react';
import { TimeMachine } from './timeMachine/TimeMachine';
import './timeMachine/timeMachine.css';

export default function App() {
  return <div className="app-shell time-shell">
    <a className="skip-link" href="#main-workspace">Skip to workspace</a>
    <header className="machine-header">
      <a className="machine-brand" href="#main-workspace" aria-label="Campus Time Machine home"><span className="machine-mark"><Orbit size={24} strokeWidth={1.5} /></span><span>CAMPUS<span>TIME MACHINE</span></span></a>
      <div className="machine-header-right">
        <span className="amd-credit">Powered by <strong>AMD <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M4 0h16v16h-5V5H4zM0 7h5v8h8v5H0z" /></svg></strong></span>
        <a className="hugging-face-credit" href="https://huggingface.co/kandinskylab/Kandinsky-6.0-Lite-distill-5s-Diffusers" target="_blank" rel="noreferrer" aria-label="Hugging Face — Kandinsky 6 Lite model"><span aria-hidden="true">🤗</span> Hugging Face <ArrowUpRight size={13} aria-hidden="true" /></a>
      </div>
    </header>
    <main id="main-workspace" tabIndex={-1}>
      <TimeMachine active />
    </main>
  </div>;
}
