export type Setting = 'inside' | 'outside';
export interface PlaceView {
  id: string;
  setting: Setting;
  label: string;
  // Fills the {place} slot in the moment prompts, so it describes this exact photo.
  description: string;
  photo: string;
}
export interface Place {
  id: string;
  name: string;
  description: string;
  kind: 'pond' | 'union' | 'library' | 'mall' | 'hall';
  views: PlaceView[];
}

// Team photos live in public/places as <ABBR>_<Inside|Outside>[n].jpg; each one is a view of its place.
function view(file: string, label: string, description: string): PlaceView {
  const [, setting, n] = file.match(/_(Inside|Outside)(\d*)$/)!;
  return { id: `${setting.toLowerCase()}${n ? `-${n}` : ''}`, setting: setting.toLowerCase() as Setting, label, description, photo: `/places/${file}.jpg` };
}

export const PLACES: Place[] = [
  { id: 'reflecting-pond', name: 'Reflecting Pond', description: 'the Reflecting Pond on the UCF campus', kind: 'pond', views: [
    view('REF_Inside', 'Fountain', 'the fountain in the Reflecting Pond on the UCF campus, with the library behind it'),
    view('REF_Outside', 'Walkway', 'the Reflecting Pond and its fountain on the UCF campus, seen from a lakeside walkway'),
  ] },
  { id: 'student-union', name: 'Student Union', description: 'the Student Union on the UCF campus', kind: 'union', views: [
    view('SU_Outside', 'Bike racks', 'the bike racks under the oak trees outside the Student Union on the UCF campus'),
    view('SU_Outside2', 'Plaza', 'the brick plaza with palm trees outside the Student Union on the UCF campus'),
  ] },
  { id: 'library', name: 'Library', description: 'the John C. Hitt Library on the UCF campus', kind: 'library', views: [
    view('LIB_Inside', 'Stacks', 'an aisle of book stacks inside the John C. Hitt Library on the UCF campus'),
    view('LIB_Inside2', 'Study desk', 'a computer study desk inside the John C. Hitt Library on the UCF campus'),
  ] },
  { id: 'memory-mall', name: 'Memory Mall', description: 'Memory Mall on the UCF campus', kind: 'mall', views: [
    view('MEM_Outside', 'Lawn', 'the open lawn of Memory Mall on the UCF campus'),
  ] },
  { id: 'engineering-1', name: 'Engineering I', description: 'the Engineering I building on the UCF campus', kind: 'hall', views: [
    view('ENG1_Inside', 'Hallway', 'a long hallway inside the Engineering I building on the UCF campus'),
  ] },
  { id: 'engineering-2', name: 'Engineering II', description: 'the Engineering II building on the UCF campus', kind: 'hall', views: [
    view('ENG2_Outside', 'Front', 'the Engineering II building on the UCF campus, seen across a lawn and walkway'),
    view('ENG2_Outside2', 'Courtyard', 'the courtyard entrance of the Engineering II building on the UCF campus'),
  ] },
  { id: 'research-1', name: 'Research I', description: 'the Research I building on the UCF campus', kind: 'hall', views: [
    view('RES_Outside', 'Street', 'the Research I building on the UCF campus, seen from the street beside it'),
    view('RES_Outside2', 'Approach', 'the road leading up to the Research I building on the UCF campus'),
  ] },
  { id: 'health-sciences-1', name: 'Health Sciences I', description: 'the Health Sciences I building on the UCF campus', kind: 'hall', views: [
    view('HS1_Outside', 'Sculpture', 'the white spiral sculpture on the lawn outside Health Sciences I on the UCF campus'),
  ] },
  { id: 'john-t-washington', name: 'John T. Washington Center', description: 'the John T. Washington Center on the UCF campus', kind: 'hall', views: [
    view('JOHN_Inside', 'Concourse', 'the skylit concourse inside the John T. Washington Center on the UCF campus'),
    view('JOHN_Outside', 'Lawn', 'the oak-shaded lawn with a red sculpture outside the John T. Washington Center on the UCF campus'),
  ] },
  { id: 'cypress-dome', name: 'Cypress Dome', description: 'the Cypress Dome wetland on the UCF campus', kind: 'mall', views: [
    view('CYP_Inside', 'Boardwalk', 'the wooden boardwalk through the cypress trees of the Cypress Dome on the UCF campus'),
  ] },
];

// The requested view, else the place's first photo.
export function placeView(place: Place, viewId?: string | null): PlaceView | undefined {
  return place.views.find(view => view.id === viewId) || place.views[0];
}
