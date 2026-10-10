import { Check, MapPin } from 'lucide-react';
import { FileInput } from '../components/FileInput';
import { CampusScene } from './CampusScene';
import { PLACES } from './places';

interface Props { selected: string; onSelect: (id: string) => void; image?: File; onImage: (file?: File) => void; disabled: boolean }
export function PlacePicker({ selected, onSelect, image, onImage, disabled }: Props) {
  return <section className="journey-section" aria-labelledby="place-heading">
    <div className="section-caption"><span className="step-number">01</span><h2 id="place-heading">Choose a place</h2><MapPin size={15} aria-hidden="true" /></div>
    <div className="place-grid" role="group" aria-label="Campus places">
      {PLACES.map(place => <button type="button" key={place.id} aria-pressed={!image && selected === place.id}
        className={`place-card ${!image && selected === place.id ? 'selected' : ''}`} disabled={disabled}
        onClick={() => { onImage(undefined); onSelect(place.id); }}>
        <div className="place-art">{place.photo ? <img src={place.photo} alt="" /> : <CampusScene kind={place.kind} />}<span>{place.photo ? 'Campus photo' : 'Concept'}</span></div>
        <div className="place-name"><span>{place.name}</span>{!image && selected === place.id && <Check size={14} aria-hidden="true" />}</div>
      </button>)}
    </div>
    <details className="photo-upload" open={Boolean(image)}><summary>Use your own campus photo</summary>
      <fieldset disabled={disabled}><FileInput kind="image" label="Campus photo" file={image} onChange={onImage} compact /></fieldset>
    </details>
  </section>;
}
