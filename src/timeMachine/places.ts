export interface Place {
  id: string;
  name: string;
  description: string;
  kind: 'pond' | 'union' | 'library' | 'mall';
  photo?: string;
}

// Add the team's own photos under public/places and set photo to /places/<name>.jpg.
// Until then, the UI explicitly shows concept illustrations, never stock campus photos.
export const PLACES: Place[] = [
  { id: 'reflecting-pond', name: 'Reflecting Pond', description: 'the Reflecting Pond on the UCF campus', kind: 'pond' },
  { id: 'student-union', name: 'Student Union', description: 'the Student Union on the UCF campus', kind: 'union' },
  { id: 'library', name: 'Library', description: 'the John C. Hitt Library on the UCF campus', kind: 'library' },
  { id: 'memory-mall', name: 'Memory Mall', description: 'Memory Mall on the UCF campus', kind: 'mall' },
];
