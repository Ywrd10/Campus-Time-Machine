import { Sparkles } from 'lucide-react';
import type { GenerationMode } from '../lib/types';
import { FileInput } from './FileInput';

export const EXAMPLES = [
  { name: 'Otherworldly', prompt: 'A slow cinematic flight over an otherworldly mountain range at dusk. A luminous violet sun sits low on the horizon, mist drifts through the valleys, and the camera glides gently forward. Dreamlike atmosphere, soft light, rich purple tones.' },
  { name: 'City after dark', prompt: 'A cinematic tracking shot through a rain-soaked city at night. Neon signs reflect on the pavement as a lone cyclist passes. Slow camera movement, atmospheric haze, realistic detail.' },
  { name: 'Into the wild', prompt: 'Golden morning light spills through a lush forest. The camera slowly follows a butterfly between moss-covered trees. Dew sparkles on the leaves, peaceful atmosphere, shallow depth of field.' },
];
interface Props {
  mode: GenerationMode;
  prompt: string;
  onPrompt: (prompt: string) => void;
  image?: File;
  onImage: (file?: File) => void;
  finalFrame?: File;
  onFinalFrame: (file?: File) => void;
  audio?: File;
  onAudio: (file?: File) => void;
  onAudioDuration: (duration: number) => void;
}
function PromptInput({ label, optional, prompt, onPrompt }: { label: string; optional?: boolean; prompt: string; onPrompt: (value: string) => void }) {
  return <div className="prompt-field">
    <div className="field-heading"><label htmlFor="prompt" className="field-label">{label}</label><span>{optional ? 'Optional' : 'Be descriptive'}</span></div>
    <textarea id="prompt" value={prompt} onChange={event => onPrompt(event.target.value)} maxLength={5000}
      placeholder="Describe your subject, setting, camera movement, and mood…" rows={6} />
    <div className="prompt-footer"><span><Sparkles size={13} /> A little detail goes a long way</span><span>{prompt.length.toLocaleString()} / 5,000</span></div>
  </div>;
}
export function TextInputs({ prompt, onPrompt }: Pick<Props, 'prompt' | 'onPrompt'>) {
  return <>
    <PromptInput label="Your prompt" prompt={prompt} onPrompt={onPrompt} />
    <div className="examples"><span>Try an idea</span><div>{EXAMPLES.map(example => <button type="button" key={example.name} onClick={() => onPrompt(example.prompt)}>{example.name}</button>)}</div></div>
  </>;
}
export function ImageInputs(props: Props) {
  return <>
    <FileInput kind="image" label="First frame" file={props.image} onChange={props.onImage} />
    <PromptInput label="Motion instructions" optional prompt={props.prompt} onPrompt={props.onPrompt} />
    <details className="final-frame"><summary>Add a final frame <span>Optional</span></summary><FileInput kind="image" label="Final frame" file={props.finalFrame} onChange={props.onFinalFrame} compact /></details>
  </>;
}
export function AudioInputs(props: Props) {
  return <>
    <FileInput kind="audio" label="Source audio" file={props.audio} onChange={props.onAudio} onDuration={props.onAudioDuration} />
    <PromptInput label="Visual direction" prompt={props.prompt} onPrompt={props.onPrompt} />
    <p className="input-note">Your audio sets the timing. Describe the scene to give it a visual direction.</p>
  </>;
}
export function ModeInputs(props: Props) {
  if (props.mode === 'image') return <ImageInputs {...props} />;
  if (props.mode === 'audio') return <AudioInputs {...props} />;
  return <TextInputs {...props} />;
}
