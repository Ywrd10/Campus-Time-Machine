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
// Audio goes in <AUDCAP>…<ENDAUDCAP>, the format the model uses. The relay sends these prompts as written,
// skipping the instance's prompt expander, which added camera pans that wandered off the photo.
//
// Image->video pins frame 0 to the photo, and in a 3 s clip the model won't restyle the whole scene: a 1968 film
// look, medieval stone, or 500 years of vines barely changed anything. What works is something that moves through
// the unchanged place (drones, balloons, a distant rocket or tornado), so every moment is written that way. If the
// photo has no room for the effect (snow on the ground in a sky-filled shot), the model dissolves into a different
// view to find some; a camera move toward it (Snow's tilt) keeps the place in frame instead. Lightning was
// dropped: its flashes read as cuts. Tested on the instance, 2026-10-10, 640x352, 3 s, 10 steps.
const fixed = 'One continuous shot from a fixed camera';
const layout = 'with the same buildings, trees, and layout as the photo.';
const now = `A calm view of {place}, as it looks today. Light shifts gently and leaves stir in the breeze. ${fixed}, ${layout} <AUDCAP>Natural campus ambience: birds, distant footsteps, a light breeze.<ENDAUDCAP>`;
function moment(id: string, label: string, destination: string, caption: string, theme: string, shift: string, arrive: string, audio: string, camera = fixed): Moment {
  const end = ` ${camera}, ${layout} <AUDCAP>${audio}<ENDAUDCAP>`;
  return { id, label, destination, caption, theme, prompts: { now, shift: `${shift}${end}`, arrive: `${arrive}${end}` } };
}

export const MOMENTS: Moment[] = [
  moment('future', 'The year 2125', '2125', 'A familiar campus, a century ahead.', 'future',
    'The year 2125 arrives at {place}: thin lines of soft blue light switch on along the edges of the buildings, and the first small white drones glide into view.',
    'The same view of {place} in the year 2125. Small sleek white drones glide smoothly across the frame, a transparent hover pod floats slowly past, and thin lines of soft blue light glow along the edges of the existing buildings.',
    'A futuristic electric hum, drones whirring loudly past, and bright synth chimes.'),
  moment('homecoming', 'Homecoming', 'GO KNIGHTS', 'Black and gold fill the air.', 'homecoming',
    'The first black and gold balloons drift up into view at {place}, and a few flecks of gold confetti flutter down.',
    'Homecoming at {place}: hundreds of black and gold balloons float upward through the scene, rising past the camera, while shiny gold confetti tumbles down through the air.',
    'A cheering crowd, a marching band drumline, and balloons rustling.'),
  moment('hurricane', 'Hurricane landfall', 'STORM', 'A twister on the horizon.', 'storm',
    'A hurricane closes in on {place}: black storm clouds roll in beyond the buildings, the trees start to sway, and the first rain sweeps across.',
    'A hurricane hits {place}. In the distance beyond the buildings, a dark twisting tornado funnel reaches down from the black storm clouds and churns up debris, while the trees thrash in the wind and sheets of rain sweep across the scene.',
    'Howling wind, pounding rain, rolling thunder, and thrashing leaves.'),
  moment('rocket', 'Rocket on the horizon', 'LAUNCH', 'A trail of fire beyond campus.', 'rocket',
    'Far beyond {place}, a bright orange flame appears on the horizon and starts to lift into the sky.',
    'Above {place}, a rocket climbs straight up into the sky from beyond the horizon, its bright orange flame trailing a thick white plume of exhaust that billows and curves as it rises, while everything on the ground stays calm and still.',
    'A deep rocket rumble that builds and crackles over quiet campus ambience.'),
  moment('wildlife', 'Wild Florida', 'WILD', 'The locals take a stroll.', 'nature',
    'At {place}, a huge alligator starts to crawl into view at the edge of the frame.',
    'A huge alligator walks slowly across the ground right in front of the camera at {place}, its scaly tail swinging side to side, and a tall white heron steps past behind it.',
    'Loud birdsong, croaking frogs, buzzing cicadas, and a low alligator hiss.'),
  moment('knights', 'Charge of the Knights', 'CHARGE', 'A knight rides through campus.', 'medieval',
    'At {place}, a knight in shining silver armor on a white horse appears at the edge of the frame.',
    'A knight in shining silver armor rides a white horse across {place} from left to right at a gallop, a plain black and gold pennant streaming from the lance and the hooves kicking up dust.',
    'Galloping hooves, clanking armor, and a distant trumpet fanfare.'),
  moment('snow', 'Snow day in Orlando', 'SNOW', 'An impossible winter afternoon.', 'snow',
    'The first snowflakes start to fall on {place}, drifting down through the cool grey light.',
    'Heavy snow falls on {place}. Dense white snowflakes stream down through the air in front of the buildings and trees, and thick snow piles up on the ground, the paths, and the bushes, turning everything white.',
    'Soft wind, the quiet hush of falling snow, and footsteps crunching in fresh snow.',
    'One continuous shot as the camera slowly tilts down toward the snow-covered ground'),
];

export function buildShots(moment: Moment, place: string, length: 'snapshot' | 'film') {
  const phases: Phase[] = length === 'film' ? ['now', 'shift', 'arrive'] : ['arrive'];
  return phases.map(phase => ({ phase, prompt: moment.prompts[phase].replaceAll('{place}', place) }));
}
