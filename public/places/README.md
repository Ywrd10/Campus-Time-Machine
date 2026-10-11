# Campus photos

Name files `<ABBR>_<Inside|Outside>[n].jpg` (e.g. `LIB_Inside2.jpg`) and add each as a `view(...)` of its place in
`src/timeMachine/places.ts`, with a short label and a description (it fills `{place}` in the moment prompts).
New places also need a pin in `src/timeMachine/mapData.ts`. Avoid recognizable faces and official marks.

| Abbr | Place | Abbr | Place |
|---|---|---|---|
| CYP | Cypress Dome | LIB | John C. Hitt Library |
| ENG1 | Engineering I | MEM | Memory Mall |
| ENG2 | Engineering II | REF | Reflecting Pond |
| HS1 | Health Sciences I | RES | Research I |
| JOHN | John T. Washington Center | SU | Student Union |

Snapshots render at 640×352, so the worker center-crops portrait photos to the middle band.
