export type Phase = 'now' | 'shift' | 'arrive';
export interface Moment {
  id: string;
  label: string;
  destination: string;
  caption: string;
  theme: string;
  prompts: Record<Phase, string>;
}

// {place} is a view description with its own article ("the brick plaza outside the Student Union..."), so
// it never opens a sentence. Kandinsky Lite is distilled (guidance 1.0): there is no negative prompt, and naming
// what to avoid ("no logos or signs") puts it in the scene, so templates only describe what should be there.
// Audio goes in <AUDCAP>…<ENDAUDCAP>, the format the model and its prompt expander use.
const shot = ' One continuous shot from a fixed camera, with the same buildings, trees, and layout as the photo.';
const now = `A calm view of {place}, as it looks today. Light shifts gently and leaves stir in the breeze.${shot} <AUDCAP>Natural campus ambience: birds, distant footsteps, a light breeze.<ENDAUDCAP>`;
function moment(id: string, label: string, destination: string, caption: string, theme: string, shift: string, arrive: string, audio: string): Moment {
  const sound = ` <AUDCAP>${audio}<ENDAUDCAP>`;
  return { id, label, destination, caption, theme, prompts: { now, shift: `${shift}${shot}${sound}`, arrive: `${arrive}${shot}${sound}` } };
}

export const MOMENTS: Moment[] = [
  moment('future', 'The year 2125', '2125', 'A familiar campus, a century ahead.', 'future',
    'Over a few seconds, the scene at {place} moves forward to the year 2125: glass and living greenery grow into the existing buildings and soft lights switch on.',
    'The same view of {place} in the year 2125: sleek glass and hanging gardens are woven into the existing buildings, small quiet drones glide past, and warm lights glow in the evening air.',
    'A soft electric hum, gentle chimes, and distant relaxed voices.'),
  // First classes: October 7, 1968. This is an imagined period treatment of a present-day
  // photograph, not a claim that every pictured landmark existed then.
  // https://library.ucf.edu/about/departments/special-collections-university-archives/university-history/
  moment('opening-day', 'Opening day, 1968', '1968', 'An imagined look at the first day.', 'past',
    'The scene at {place} slips back to 1968: colors warm and fade like old film, soft grain appears, and people in 1960s clothing begin to walk through.',
    'The same view of {place} on an autumn day in 1968, filmed on faded color film with soft grain. Students in 1960s clothing walk past carrying books, and the light is warm and hazy.',
    'Lively chatter, footsteps, and a distant transistor radio playing.'),
  moment('hurricane', 'Hurricane landfall', 'STORM', 'Wind, water, and a changing sky.', 'storm',
    'A hurricane closes in on {place}: dark clouds race in, the light drops, and the first bands of rain sweep across.',
    'A hurricane reaches {place}: dark clouds race overhead, heavy rain sweeps sideways in sheets, palm trees and branches whip in the wind, and puddles ripple and spread.',
    'Howling wind, pounding rain, and rustling, thrashing leaves.'),
  moment('rocket', 'Rocket on the horizon', 'LAUNCH', 'A trail of light beyond campus.', 'rocket',
    'In the distance beyond {place}, a bright point of light rises from the horizon and starts to climb.',
    'Beyond {place}, a rocket climbs high in the distant sky, leaving a bright, curving exhaust trail, while everything nearby stays calm and still.',
    'A low, rolling rumble that builds slowly over quiet campus ambience.'),
  moment('nature', 'Nature reclaims', '+500Y', 'Five centuries of quiet growth.', 'nature',
    'Time speeds up at {place}: vines creep up the walls, grass spreads across the paths, and the surfaces slowly weather.',
    'Five centuries from now, nature has reclaimed {place}: thick vines cover the walls, roots crack the paths, tall grass sways, and birds flit between the branches.',
    'Birdsong, buzzing insects, and wind moving through leaves.'),
  moment('medieval', 'Medieval Knights', 'MEDIEVAL', 'Stone, banners, and torchlight.', 'medieval',
    'The surfaces at {place} turn to rough stone and dark timber, plain cloth banners unfurl, and torches flicker to life.',
    'A medieval version of {place}: rough stone walls, heavy timber beams, plain cloth banners, and flickering torches, with figures in hooded cloaks walking by.',
    'Crackling torches, footsteps on stone, and a distant bell.'),
  moment('snow', 'Snow day in Orlando', 'SNOW', 'An impossible winter afternoon.', 'snow',
    'Snow begins to fall on {place}: the light cools and the first flakes settle on the ground and branches.',
    'Snow falls steadily on {place}. A fresh white layer covers the ground, the roofs, and the trees, and big flakes drift slowly past the camera.',
    'Soft wind and the quiet hush of falling snow.'),
];

export function buildShots(moment: Moment, place: string, length: 'snapshot' | 'film') {
  const phases: Phase[] = length === 'film' ? ['now', 'shift', 'arrive'] : ['arrive'];
  return phases.map(phase => ({ phase, prompt: moment.prompts[phase].replaceAll('{place}', place) }));
}
