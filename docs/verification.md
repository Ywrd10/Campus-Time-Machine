# Verification log

## Automated

`npm run build` (strict TypeScript + Vite build) and `npm test` pass. The Vitest checks cover Free mode
settings/validation/jobs, timeline lifecycle and persistence, waypoint IDs, map navigation bounds, semantic
controls, and frontend-to-relay integration. No lint script is configured.

The relay integration test (`tests/relay.integration.test.ts`) copies the real relay to a disposable directory
and runs it against a local Jupyter fixture. It checks Snapshot requests, server-side prompt construction,
source-image streaming, MP4 Range responses, Wall results, the unsupported Film/missing-photo errors, and Free
mode. It uses no credentials, GPU, or real Wall data.

## Browser checks

- Free mode: text generation, MP4 playback and download, image previews, setting constraints, keyboard tab
  navigation, failed-job retry; 1366×768 desktop and 390×844 mobile viewports. These predate the switch to the
  Kandinsky presets.
- Campus Time Machine: place/moment selection, one-shot Snapshot and three-shot Film structure, custom photo
  upload, journey completion and reload recovery, comparison controls, local Wall saving and archived playback,
  failed-job retry, and Free mode generation continuing across view changes. No horizontal overflow at 320 px.

## Against the live instance (2026-10-10)

- Relay against a local fake Jupyter first: Free-mode text from the UI through the Vite proxy (reached the worker
  as 640×352, 10 steps), rejection of untested sizes, Snapshot with an uploaded photo, readable Film and
  missing-place-photo errors, MP4/source-image streaming.
- Free-mode text→video from the UI (640×352, 3 s, 10 steps): 48 s GPU time, plays in the browser.
- Image→video through the relay: 52 s with a 1024 px photo. The same photo at 2560×1707 ran the prompt enhancer
  out of GPU memory; the worker's `MAX_IMAGE_SIDE` resize fixed it (full-size photo then ran in 52 s).
- Time Machine Snapshot with an uploaded photo (`snow`): 52.6 s, peak 28.7 GB. `finalFrameUrl`, shot thumbnail,
  and Wall thumbnail served and cached; `last.png` matches the MP4's last frame.

Not yet verified: real campus films and multi-shot (Film) chaining, which need campus photos and worker chaining.
