import { MapPin } from 'lucide-react';
import { FileInput } from '../components/FileInput';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { isMockProvider } from '../services/generation';
import { CampusScene } from './CampusScene';
import type { Place, PlaceView } from './places';

export function PlacePicker({ place, view, onView, image, onImage, disabled }: {
  place: Place; view?: PlaceView; onView: (id: string) => void; image?: File; onImage: (file?: File) => void; disabled: boolean;
}) {
  const uploaded = useObjectUrl(image);
  const source = uploaded || view?.photo;
  return <section className="selected-place" aria-labelledby="place-heading">
    <div className="selected-place-photo">{source ? <img src={source} alt={`${place.name} source photo`} /> : <CampusScene kind={place.kind} />}{/* The view picker below already names multi-view photos. */}
      {(uploaded || place.views.length < 2) && <span>{uploaded ? 'YOUR PHOTO' : view ? `${view.setting.toUpperCase()} · ${view.label.toUpperCase()}` : 'CONCEPT PREVIEW'}</span>}</div>
    <div className="selected-place-heading"><h2 id="place-heading">{place.name}</h2><span className="location-chip" aria-hidden="true"><MapPin size={15} /></span></div>
    {place.views.length > 1 && <div className="place-views" role="group" aria-label={`${place.name} photos`}>
      {place.views.map(option => <button key={option.id} type="button" aria-pressed={!uploaded && option.id === view?.id} disabled={disabled} onClick={() => onView(option.id)}>
        <img src={option.photo} alt="" loading="lazy" /><span><small>{option.setting.toUpperCase()}</small>{option.label}</span>
      </button>)}
    </div>}
    <details className="photo-upload" open={(!isMockProvider && !view) || Boolean(image)}><summary>{source ? 'Use your own photo instead' : 'Add a photo of this place'}</summary>
      {!isMockProvider && !view && <p className="photo-requirement">Upload a photo of {place.name} to generate from this waypoint. A map illustration cannot be used as a source photo.</p>}
      <fieldset disabled={disabled}><FileInput kind="image" label="Campus photo" file={image} onChange={onImage} compact /></fieldset>
    </details>
  </section>;
}
