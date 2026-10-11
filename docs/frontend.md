# Frontend behavior

Notes on the two workspaces, mock (demo) mode, and what the browser stores. Map details are in
[frontend-map.md](frontend-map.md).

## Free mode (the studio)

1. Select an example prompt or write your own.
2. Keep the defaults: Quality (10 steps), 640×352, 24 FPS, 3 seconds.
3. Generate, wait for the job to complete, then play and download the MP4.
4. Switch to Image-to-Video for a source image and an optional motion prompt.

The studio uses a two-column workspace on desktop and stacked panels on smaller screens. Example prompts are
collapsible. Download errors and video playback errors are shown separately from generation errors. Switching
between Free mode and the Time Machine preserves inputs and active polling.

## Campus Time Machine

Select a waypoint on the map (or in the place dropdown) to open that place's photo and moment options below the
map. The Journey Wall is on the same page, with playback, filtering, and downloads.

- In HTTP mode only **Snapshot** is offered: Film needs the worker to chain shots from each previous last frame.
- Ten preset places, each with one or more team photos ("views", Inside/Outside) from `public/places/`
  (`src/timeMachine/places.ts`). The picker under the place photo switches views; the relay receives
  `place` + `view` and uses that photo and its description in the prompt. An upload still overrides both.
- The before/after slider compares the source photo (`beforeImageUrl`) with the clip's last frame (`finalFrameUrl`).
- Every moment adds something that moves through the unchanged photo (drones, balloons, a rocket, a knight, an
  alligator, rain, snow) rather than restyling it, and the relay sends the prompts verbatim (no expansion). See the
  comment in `src/timeMachine/moments.ts`. Moment templates avoid official logos, mascots, and seals.

### Local state

- Reloading restores the current timeline job ID and its place/moment/length from localStorage, including mock
  jobs. Uploaded image bytes and credentials are never stored. If storage is unavailable, generation still works
  without reload recovery.
- After a reload, the uploaded-photo comparison needs the relay's `beforeImageUrl`; stale blob URLs aren't persisted.
- Mock **Add to Wall** saves journey metadata in this browser only, not to a server.
- Tabs share saved metadata but don't coordinate concurrent renders.

## Mock (demo) mode

The default (`VITE_GENERATION_PROVIDER=mock`), needing no backend or env file.

- Every job returns `public/demo.mp4`: an original illustrated mountain landscape with a slow zoom (H.264,
  1280×720, 24 FPS, 6 s, no audio), independent of prompt, media, or settings. It's labeled as a demo and its
  metadata describes the actual file. Replace it with a real clip if desired, then update its metadata in the
  mock adapter (`src/services/generation.ts`) and in `src/services/timeline.ts`.
- Jobs show queued/processing states without invented percentages; Time Machine stages are explicitly simulated.
- Campus locations and moment thumbnails are original vector concept illustrations, labeled as such.
- Uploaded files stay in the browser.
- To exercise the failed-job state, set `VITE_MOCK_FAIL=true` in `.env.local` and restart Vite. Submitting an
  empty prompt tests form validation.
