# Frontend behavior

Notes on the campus workspace, mock (demo) mode, and what the browser stores. Map details are in
[frontend-map.md](frontend-map.md).

## Campus studio polish

Free mode is no longer mounted or linked; the campus map and Journey Wall are the single workspace. Film
is no longer selectable in mock or HTTP mode. Legacy services and saved Film jobs remain readable for compatibility.
The header credits AMD and keeps the Hugging Face model link visible on mobile.

The interface uses [UCF Black and Bold Gold](https://www.ucf.edu/brand/visual-expression/)
(`#000000` / `#EDB80D`), with charcoal surfaces, neutral text, and black text on gold primary actions.
Shared palette tokens live in `src/styles.css`; selected waypoints, quality controls, progress animations,
and the Journey Wall use them through `timeMachine.css`. The locally exported basemap uses charcoal and
muted warm lines; its color changes do not alter geographic paths or waypoint coordinates. Semantic error
colors and source photos stay distinct from the interface palette.

Video quality uses native radios: Quick (352p, 6 steps), Standard (352p, 10 steps, default), High Detail
(480p, 10 steps). All use 24 FPS and a 3-second Snapshot. The optional `quality` identifier is sent to the
relay, validated there, and recorded in the local journey ticket for reload recovery. Old tickets default
to Standard. Time estimates are approximate and exclude queueing; Quick warns about quieter audio.

Generation uses layered photo frames, a scanning light, and a progress bar instead of a spinning wheel.
Queued, preparing, rendering, and exporting stages use actual worker status/progress. Unknown or mock progress
stays indeterminate. Reduced motion disables the animation. Stop waiting stops local polling without canceling
the server job. Playback, download, before/after comparison, and Wall behavior are unchanged.

## Campus Time Machine

Select a waypoint on the map (or in the place dropdown) to open that place's photo and moment options below the
map. The Journey Wall is on the same page, with playback, filtering, and downloads.

- Only **Snapshot** is offered, with three tested quality presets.
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
