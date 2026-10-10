import { useId, useState } from 'react';
import { ImagePlus, Music2, Upload, X } from 'lucide-react';
import { validateFile } from '../lib/capabilities';
import { useObjectUrl } from '../hooks/useObjectUrl';

interface Props {
  kind: 'image' | 'audio';
  label: string;
  file?: File;
  onChange: (file?: File) => void;
  onDuration?: (duration: number) => void;
  compact?: boolean;
}
export function FileInput({ kind, label, file, onChange, onDuration, compact }: Props) {
  const id = useId();
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const url = useObjectUrl(file);
  const Icon = kind === 'image' ? ImagePlus : Music2;
  function select(next?: File) {
    if (!next) return;
    const message = validateFile(next, kind);
    setError(message || undefined);
    if (!message) { onDuration?.(0); onChange(next); }
  }
  return <div className={`file-field ${compact ? 'compact' : ''}`}>
    <span className="field-label">{label}</span>
    {!file ? <label htmlFor={id} className={`dropzone ${dragging ? 'dragging' : ''}`}
      onDragOver={event => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={event => { event.preventDefault(); setDragging(false); if (!event.currentTarget.closest('fieldset')?.disabled) select(event.dataTransfer.files[0]); }}>
      <input id={id} type="file" className="sr-only"
        accept={kind === 'image' ? '.png,.jpg,.jpeg,.webp' : '.mp3,.wav,.m4a,.ogg'}
        onChange={event => { select(event.target.files?.[0]); event.target.value = ''; }} />
      <Icon size={23} />
      <strong>Drop {kind === 'image' ? 'an image' : 'an audio clip'} or <span>browse</span></strong>
      <small>{kind === 'image' ? 'PNG, JPG, WebP · up to 15 MB' : 'MP3, WAV, M4A, OGG · up to 32 MB'}</small>
    </label> : <div className="file-preview">
      {kind === 'image' && url && <img src={url} alt={label} onError={() => { setError('This image could not be opened. Choose another file.'); onChange(undefined); }} />}
      <div className="file-name"><Upload size={14} /><span title={file.name}>{file.name}</span><button type="button" className="icon-button" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => { onChange(undefined); onDuration?.(0); setError(undefined); }}><X size={15} /></button></div>
      {kind === 'audio' && url && <audio key={url} controls src={url} aria-label="Input audio preview"
        onLoadedMetadata={event => onDuration?.(event.currentTarget.duration)}
        onError={() => { setError('Your browser could not play this audio. Try an MP3 file.'); onDuration?.(0); }} />}
    </div>}
    {error && <p className="field-error" role="alert">{error}</p>}
  </div>;
}
