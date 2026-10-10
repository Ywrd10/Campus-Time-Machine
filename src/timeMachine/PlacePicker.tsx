import { MapPin } from 'lucide-react';
import { FileInput } from '../components/FileInput';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { isMockProvider } from '../services/generation';
import { CampusScene } from './CampusScene';
import type { Place } from './places';

export function PlacePicker({ place, image, onImage, disabled }: {
  place: Place; image?: File; onImage: (file?: File) => void; disabled: boolean;
}) {
  const uploaded = useObjectUrl(image);
  const source = uploaded || place.photo;
  return <section className="selected-place" aria-labelledby="place-heading">
    <div className="selected-place-photo">{source ? <img src={source} alt={`${place.name} source photo`} /> : <CampusScene kind={place.kind} />}<span>{source ? 'SOURCE PHOTO' : 'CONCEPT PREVIEW'}</span></div>
    <div className="selected-place-heading"><div><p className="eyebrow"><MapPin size={12} /> SELECTED WAYPOINT</p><h2 id="place-heading">{place.name}</h2><p>{place.description}</p></div><span className="location-chip">UCF</span></div>
    <details className="photo-upload" open={(!isMockProvider && !place.photo) || Boolean(image)}><summary>{source ? 'Change source photo' : 'Add a photo of this place'}</summary>
      {!isMockProvider && !place.photo && <p className="photo-requirement">Upload a photo of {place.name} to generate from this waypoint. A map illustration cannot be used as a source photo.</p>}
      <fieldset disabled={disabled}><FileInput kind="image" label="Campus photo" file={image} onChange={onImage} compact /></fieldset>
    </details>
  </section>;
}
