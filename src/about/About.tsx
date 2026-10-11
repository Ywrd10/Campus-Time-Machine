import { ArrowRight, ArrowUpRight, Github, Linkedin } from 'lucide-react';
import brocHeadshot from './assets/broc-weselmann.png';
import diegoHeadshot from './assets/diego-rolon.png';
import './about.css';

const TEAM = [
  { name: 'Broc Weselmann', initials: 'BW', headshot: brocHeadshot, focus: 'Game development · Godot', bio: 'Game developer focused on Godot, with a Steam release under Sledgehog Software and experience in web development and Linux.', linkedin: 'https://www.linkedin.com/in/brocweselmann/' },
  { name: 'Diego Rolon', initials: 'DR', headshot: diegoHeadshot, focus: 'Computer Science · UCF', bio: 'UCF Computer Science student on an accelerated B.S. → M.S. path, focused on backend engineering, distributed systems, cloud infrastructure, and applied AI.', linkedin: 'https://www.linkedin.com/in/diego-rolon-487026338/' },
];

export function About() {
  return <div id="about" className="about-workspace">
    <section className="about-team" aria-labelledby="team-heading">
      <div className="about-section-heading"><p className="eyebrow">01 / THE BUILDERS</p><h1 id="team-heading">Meet the team<span className="title-period">.</span></h1></div>
      <p className="about-team-intro">Two builders bringing a campus explorer and AI video generation together.
        Connect with us to see what we build next.</p>
      <div className="about-team-grid">{TEAM.map(member => <article className="about-member" key={member.linkedin} aria-labelledby={`member-${member.initials}`}>
        <div className="about-member-identity"><img className="about-headshot" src={member.headshot} alt={`${member.name} headshot`} width={72} height={72} />
          <div><p className="small-label">CAMPUS TIME MACHINE TEAM</p><h2 id={`member-${member.initials}`}>{member.name}</h2></div>
        </div>
        <p className="about-member-focus">{member.focus}</p>
        <p className="about-member-bio">{member.bio}</p>
        <a className="about-profile" href={member.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${member.name} on LinkedIn (opens in a new tab)`}>
          <Linkedin size={16} aria-hidden="true" /><span>Connect on LinkedIn</span><ArrowUpRight size={15} aria-hidden="true" />
        </a>
      </article>)}</div>
    </section>

    <div className="about-return"><div><p className="eyebrow"><span /> YOUR NEXT DEPARTURE</p><h2>See where time takes you.</h2></div>
      <div className="about-return-actions"><a className="about-studio-link" href="#studio">Explore the campus <ArrowRight size={17} aria-hidden="true" /></a><a className="about-source-link" href="https://github.com/Ywrd10/KnightHacksIX" target="_blank" rel="noopener noreferrer"><Github size={16} aria-hidden="true" /> View the project <ArrowUpRight size={13} aria-hidden="true" /></a></div>
    </div>
    <section className="about-tech" aria-labelledby="about-tech-heading">
      <h2 id="about-tech-heading">Built with</h2>
      <div className="about-built-with"><span>React · TypeScript · Vite · Tailwind CSS</span><span>AMD Radeon Cloud + ROCm</span><a href="https://huggingface.co/kandinskylab/Kandinsky-6.0-Lite-distill-5s-Diffusers" target="_blank" rel="noopener noreferrer">Kandinsky 6 Lite on Hugging Face <ArrowUpRight size={12} aria-hidden="true" /></a></div>
    </section>
    <footer className="time-footer"><span>KNIGHT HACKS IX <span>/</span> CAMPUS TIME MACHINE</span><span>BUILT WITH CURIOSITY</span></footer>
  </div>;
}
