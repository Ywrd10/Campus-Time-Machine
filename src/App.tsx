import { ArrowUpRight, Orbit } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { About } from './about/About';
import { TimeMachine } from './timeMachine/TimeMachine';
import './timeMachine/timeMachine.css';

export default function App() {
  const [page, setPage] = useState<'campus' | 'about'>(() => ['#about', '#about-content'].includes(window.location.hash) ? 'about' : 'campus');
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    function navigate() {
      // Other anchors (including the skip link) should not change workspaces.
      if (['#about', '#about-content'].includes(window.location.hash)) setPage('about');
      else if (window.location.hash === '#campus' || !window.location.hash) setPage('campus');
    }
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  useEffect(() => {
    document.title = `${page === 'about' ? 'About the team — ' : ''}Campus Time Machine — Knight Hacks IX`;
    main.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [page]);
  return <div className="app-shell time-shell">
    <a className="skip-link" href={page === 'about' ? '#about-content' : '#main-workspace'}>Skip to workspace</a>
    <header className="machine-header">
      <a className="machine-brand" href="#campus" aria-label="Campus Time Machine home"><span className="machine-mark"><Orbit size={24} strokeWidth={1.5} /></span><span>CAMPUS<span>TIME MACHINE</span></span></a>
      <nav className="machine-nav" aria-label="Main navigation"><a href="#campus" aria-current={page === 'campus' ? 'page' : undefined}>Campus</a><a href="#about" aria-current={page === 'about' ? 'page' : undefined}>About</a></nav>
      <div className="machine-header-right">
        <span className="amd-credit">Powered by <strong>AMD <svg width="15" height="15" viewBox="0 0 20 20" aria-hidden="true"><path fill="currentColor" d="M4 0h16v16h-5V5H4zM0 7h5v8h8v5H0z" /></svg></strong></span>
        <span className="hugging-face-credit" role="group" aria-label="Hugging Face"><span aria-hidden="true">🤗</span>
          <a href="https://huggingface.co/kandinskylab/Kandinsky-6.0-Lite-distill-5s-Diffusers" target="_blank" rel="noreferrer" aria-label="Kandinsky 6 Lite model on Hugging Face">Model <ArrowUpRight size={12} aria-hidden="true" /></a>
          <a href="https://huggingface.co/buckets/brocw/ucf-time-machine" target="_blank" rel="noreferrer" aria-label="Journey storage bucket on Hugging Face">Bucket <ArrowUpRight size={12} aria-hidden="true" /></a>
        </span>
      </div>
    </header>
    <main id={page === 'about' ? 'about-content' : 'main-workspace'} ref={main} tabIndex={-1}>
      <div id="campus" hidden={page !== 'campus'}><TimeMachine active={page === 'campus'} /></div>
      {page === 'about' && <About />}
    </main>
  </div>;
}
