export type Phase = 'now' | 'shift' | 'arrive';
export interface Moment {
  id: string;
  label: string;
  destination: string;
  caption: string;
  theme: string;
  prompts: Record<Phase, string>;
}

const now = 'A steady cinematic view of {place} as photographed today. Gentle ambient motion and natural campus sound. Preserve the camera, layout, and landmarks. No logos or readable signs.';
const preserve = ' Keep the location recognizable and the camera steady. Preserve the composition of the source photograph. Include matching ambient sound. No official logos, mascots, seals, or readable signs.';
function moment(id: string, label: string, destination: string, caption: string, theme: string, shift: string, arrive: string): Moment {
  return { id, label, destination, caption, theme, prompts: { now, shift: `${shift}${preserve}`, arrive: `${arrive}${preserve}` } };
}

export const MOMENTS: Moment[] = [
  moment('future', 'The year 2125', '2125', 'A familiar campus, a century ahead.', 'future', 'Transform {place} gradually into an imagined campus in 2125. Subtle futuristic architecture, quiet transport, and warm evening lights emerge.', 'An imagined {place} in 2125, settled and alive with subtle futuristic activity.'),
  // First classes: October 7, 1968. This is an imagined period treatment of a present-day
  // photograph, not a claim that every pictured landmark existed then.
  // https://library.ucf.edu/about/departments/special-collections-university-archives/university-history/
  moment('opening-day', 'Opening day, 1968', '1968', 'An imagined look at the first day.', 'past', 'Give {place} an imagined 1968 period treatment. Modern details give way to period clothing, cars, warm light, and subtle film grain.', 'An imagined opening-day atmosphere at {place}, with 1960s clothing and subdued campus bustle. Do not claim historical reconstruction.'),
  moment('hurricane', 'Hurricane landfall', 'STORM', 'Wind, water, and a changing sky.', 'storm', 'A hurricane approaches {place}. Clouds gather, heavy rain sweeps across the scene, vegetation bends, and water ripples in the wind.', 'The storm has arrived at {place}. Rain, wind, and moving water dominate the scene, with no injured people or destruction of people.'),
  moment('rocket', 'Rocket on the horizon', 'LAUNCH', 'A trail of light beyond campus.', 'rocket', 'Beyond {place}, a distant rocket ascends on the horizon with a glowing exhaust and smoke trail. A delayed low rumble reaches campus.', 'The rocket trail hangs in the distant sky above {place}, with calm campus ambience and a fading rumble.'),
  moment('nature', 'Nature reclaims', '+500Y', 'Five centuries of quiet growth.', 'nature', 'Time accelerates over {place}. Vines and roots grow, buildings weather gradually, and wildlife returns as human activity fades.', 'An imagined {place} reclaimed by nature five centuries later. Dense plants, birdsong, and gently weathered architecture.'),
  moment('medieval', 'Medieval Knights', 'MEDIEVAL', 'Stone, banners, and torchlight.', 'medieval', 'Reimagine {place} as a medieval campus. Stone textures, unmarked banners, and torchlight emerge while the layout remains recognizable.', 'A settled medieval interpretation of {place}, with warm torchlight and soft footsteps. No official Knights branding.'),
  moment('snow', 'Snow day in Orlando', 'SNOW', 'An impossible winter afternoon.', 'snow', 'Soft snow begins falling over {place}. Roofs and paths turn white as the light cools and a few distant silhouettes react with wonder.', 'An imagined snowy {place} in Orlando. Fresh snow, soft wind, quiet ambience, and no recognizable faces.'),
];

export function buildShots(moment: Moment, place: string, length: 'snapshot' | 'film') {
  const phases: Phase[] = length === 'film' ? ['now', 'shift', 'arrive'] : ['arrive'];
  return phases.map(phase => ({ phase, prompt: moment.prompts[phase].replaceAll('{place}', place) }));
}
