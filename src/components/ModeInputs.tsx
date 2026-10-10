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
    <div className="field-heading"><label htmlFor="prompt" className="field-label">{label}</label>{optional && <span>Optional</span>}</div>
    <textarea id="prompt" value={prompt} onChange={event => onPrompt(event.target.value)} maxLength={5000}
      placeholder="Describe the scene, camera movement, and action…" rows={4} aria-describedby="prompt-count" />
    <div className="prompt-footer"><span id="prompt-count">{prompt.length.toLocaleString()} / 5,000 characters</span></div>
  </div>;
}
export function TextInputs({ prompt, onPrompt }: Pick<Props, 'prompt' | 'onPrompt'>) {
  return <>
    <PromptInput label="Text prompt" prompt={prompt} onPrompt={onPrompt} />
    <details className="prompt-examples"><summary>Use an example prompt</summary><div>{EXAMPLES.map(example => <button type="button" key={example.name} onClick={() => onPrompt(example.prompt)}>{example.name}</button>)}</div></details>
  </>;
}
export function ImageInputs(props: Props) {
  return <>
    <FileInput kind="image" label="First frame" file={props.image} onChange={props.onImage} />
    <PromptInput label="Motion prompt" optional prompt={props.prompt} onPrompt={props.onPrompt} />
    <details className="final-frame"><summary>Final frame <span>Optional</span></summary><FileInput kind="image" label="Final frame" file={props.finalFrame} onChange={props.onFinalFrame} compact /></details>
  </>;
}
export function AudioInputs(props: Props) {
  return <>
    <FileInput kind="audio" label="Source audio" file={props.audio} onChange={props.onAudio} onDuration={props.onAudioDuration} />
    <PromptInput label="Visual direction" prompt={props.prompt} onPrompt={props.onPrompt} />
  </>;
}
export function ModeInputs(props: Props) {
  if (props.mode === 'image') return <ImageInputs {...props} />;
  if (props.mode === 'audio') return <AudioInputs {...props} />;
  return <TextInputs {...props} />;
}
