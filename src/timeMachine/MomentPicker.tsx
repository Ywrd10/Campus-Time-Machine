import { Bird, CloudLightning, History, PartyPopper, Rocket, Snowflake, Sparkles, Swords } from 'lucide-react';
import { CampusScene } from './CampusScene';
import { MOMENTS } from './moments';
import type { Place } from './places';

const ICONS = [Sparkles, PartyPopper, CloudLightning, Rocket, Bird, Swords, Snowflake];
export function MomentPicker({ selected, onSelect, disabled, kind }: { selected: string; onSelect: (id: string) => void; disabled: boolean; kind: Place['kind'] }) {
  return <section className="journey-section" aria-labelledby="moment-heading">
    <div className="section-caption"><span className="step-number">02</span><h2 id="moment-heading">Choose a moment</h2><History size={15} aria-hidden="true" /></div>
    <div className="moment-grid" role="group" aria-label="Destination moments">
      {MOMENTS.map((moment, index) => {
        const Icon = ICONS[index];
        return <button type="button" key={moment.id} aria-pressed={selected === moment.id} disabled={disabled}
          className={`moment-card ${selected === moment.id ? 'selected' : ''}`} onClick={() => onSelect(moment.id)}>
          <span className="moment-thumb"><CampusScene kind={kind} theme={moment.theme} /></span><span><Icon size={13} aria-hidden="true" />{moment.label}</span>
        </button>;
      })}
    </div>
    <p className="concept-note">Thumbnails are concept illustrations. Moments are imagined transformations.</p>
  </section>;
}
