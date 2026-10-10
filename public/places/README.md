# Campus photo handoff

Add the team's own landscape JPGs here (at least 1280 pixels wide). Avoid recognizable faces and official marks.

Set `photo` in `src/timeMachine/places.ts`, for example:

```ts
{ id: 'reflecting-pond', name: 'Reflecting Pond', description: 'the Reflecting Pond on the UCF campus', kind: 'pond', photo: '/places/reflecting-pond.jpg' }
```

The UI uses labeled vector concepts until each photo is supplied. The relay also needs the same place IDs and its own source photo registry. An uploaded photo bypasses preset place selection and is sent as multipart `image` in HTTP mode.
