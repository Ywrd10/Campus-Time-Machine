# Campus Time Machine / Knight Studio

A frontend prototype for Knight Hacks IX: React, TypeScript, Vite, Tailwind CSS, and Lucide icons. All inference belongs to your team's separate backend.

## Campus Time Machine

The default workspace follows [the Campus Time Machine plan](docs/campus-time-machine.md). It has place and moment pickers, Snapshot/Film selection, a Now → Shift → Arrive timeline, an arrival player, a keyboard-accessible before/after comparison, and a Wall. The dark green instrument-panel styling uses brass accents, destination readouts, and a viewfinder. The original text/image/audio studio remains available as **Free mode**; switching views preserves inputs and active polling.

In demo mode, all journeys return the existing fixed 6-second MP4. Timeline stages are explicitly simulated and omit invented percentages. The sample is not a campus render and has no audio. Campus locations and moment thumbnails are original vector concept illustrations, labeled as such. There are no team campus photos or 2–3 genuine pre-rendered campus films in the repository yet. Add your own photos using `public/places/README.md` and `src/timeMachine/places.ts`; replace the mock sample and its actual metadata in `src/services/timeline.ts` when the team's films are ready. HTTP-mode generation requires a real photo in this frontend until the preset photos are added. In HTTP mode only **Snapshot** is offered: Film needs the worker to chain shots from each previous last frame, which it doesn't do yet.

Mock **Add to Wall** saves completed journey metadata in this browser, not to a shared server. Reloading restores the current timeline job ID and its place/moment/length from localStorage, including mock jobs. Uploaded image bytes and credentials are never stored there. If browser storage is unavailable, generation still works but reload recovery is unavailable. Uploaded-photo comparison after a reload requires the relay to return `beforeImageUrl`; a stale blob URL is not persisted. **Stop waiting** clears local tracking without canceling a server job. Browser tabs share the saved metadata but do not coordinate concurrent renders.

Opening day uses October 7, 1968, verified against [UCF University Archives](https://library.ucf.edu/about/departments/special-collections-university-archives/university-history/). Its scene is an imagined period treatment of a current photo, not a historically accurate reconstruction. Moment templates avoid official logos, mascots, and seals.

### Timeline relay contract

Time Machine uses the same provider/base URL environment variables as Free mode. `src/services/timeline.ts` centralizes these endpoints, which `relay/server.mjs` serves (Snapshot only so far):

- `POST /api/timelines`: multipart `place` **or** `image`, plus `moment` and `length` (`snapshot` / `film`); returns `{ "jobId": "..." }`.
- `GET /api/timelines/:id`: the existing job status/output contract plus `shots` (one for Snapshot, three for Film). Each shot has `status`, optional `phase` (`now` / `shift` / `arrive`), optional numeric `progress`, optional `output`, and optional `thumbnail`. Phases can be inferred by order if omitted. `beforeImageUrl` and `finalFrameUrl` are optional top-level image URLs for comparison.
- `GET /api/wall`: an array of `{ "id", "place", "moment", "thumbnail", "url" }` for completed journeys. `moment` uses the IDs in `src/timeMachine/moments.ts`; `place` is a display name. Completed real jobs appear on the relay's Wall automatically; the frontend does not invent a publishing endpoint.

The relay owns prompt construction, source photos for preset place IDs, safe shot durations, audio generation, and chaining/stitching. The browser sends selection IDs, never arbitrary shot templates; the relay imports `src/timeMachine/moments.ts` and `places.ts` directly, so the templates live in one place. A Snapshot renders the `arrive` prompt as image→video at 640×352, 3 s, 10 steps (about 50 s plus prompt expansion). The relay returns the uploaded photo as `beforeImageUrl` but no `finalFrameUrl` yet, so the before/after slider stays disabled for real renders. It records the timeline jobs it creates in `relay/wall.json` (gitignored), and `/api/wall` lists the completed ones. The UI only displays real numeric progress when the relay supplies it. Both workspaces use `src/lib/pollJob.ts`, with abort handling, 800ms polling, and a 15-minute limit. Runtime guards reject invalid status/output shapes and executable media URL protocols. Worker/relay changes remain the backend team's responsibility.

## Run locally

Requires Node.js 22.18+ and npm. The relay imports the shared `.ts` preset and prompt files using Node's built-in type stripping.

To create another local checkout:

```sh
git clone https://github.com/Ywrd10/KnightHacksIX.git
cd KnightHacksIX
```

Then install dependencies and start the frontend:

```sh
npm ci
npm run dev
```

Run these commands inside this project directory. No environment file is required for the demo. Vite prefers http://127.0.0.1:5173 and automatically selects the next available port if it is occupied. Open the Local URL printed in your terminal. To choose a port explicitly, run `npm run dev -- --port 5174`.

```sh
npm run build
npm test
npm run preview
```

`build` runs strict TypeScript checking and creates `dist/`. `preview` serves the build on port 4173.

## Demo walkthrough

1. Select an example prompt or write your own.
2. Keep the defaults: Quality (10 steps), 640×352, 24 FPS, 3 seconds.
3. Generate, wait for the simulated job to complete, then play and download the MP4.
4. Change to Image-to-Video for a source image and an optional motion prompt.

Both modes use the same mock adapter. Uploaded files stay in the browser during mock mode. The bundled MP4 is a fixed 6-second sample, independent of the prompt, uploaded media, aspect ratio, or selected settings. It is explicitly labeled as a demo; output metadata describes the actual file. Image/audio conditioning is UI scaffolding until a real backend is connected. Download errors and video playback errors are shown separately from generation errors.

The studio uses a compact two-column workspace on desktop and stacked panels on smaller screens. Example prompts are collapsible. Mock jobs show queued/processing states without fabricated percentages. A real backend can supply a numeric `progress` value; otherwise processing remains indeterminate.

The sample is an original illustrated mountain landscape with a slow camera zoom, encoded as H.264 MP4 (1280×720, 24 FPS, 6 seconds, no audio). No remote media service is required for the demo.

To exercise the failed job state, copy `.env.example` to `.env.local`, set `VITE_MOCK_FAIL=true`, and restart Vite. Set it back to false to restore successful demo jobs. Form validation errors can also be tested by submitting an empty prompt.

## Supported settings and inference boundary

`src/lib/capabilities.ts` offers only presets that were rendered with Kandinsky 6.0 Video Lite (distilled) on the
AMD W7900D (clips and the full table are in `outputs/k6/`, which is gitignored and stays local):

| Resolution | Durations | Model | Measured GPU time (16:9) |
| --- | --- | --- | --- |
| 352p · 640×352 | 2, 3, 5 s | Quality (10 steps) | 36 / 49 / 93 s |
| 352p · 640×352 | 3 s | Fast (6 steps) | 37 s |
| 480p · 864×480 | 2, 3, 5 s | Quality (10 steps) | 69 / 110 / 223 s |
| 480p · 864×480 | 3 s | Fast (6 steps) | 83 s |

- 24 FPS only (frames = 4k+1: 49 / 73 / 121). Aspect ratios 16:9 and 9:16 (portrait swaps width and height; not benchmarked separately).
- Fast is also offered at 2 and 5 s, which weren't benchmarked, so the settings panel shows no time estimate there. Fast audio is about 9 dB quieter.
- Times exclude Qwen prompt expansion (5–16 s) and MP4 export.
- Text→video and image→video only. Audio→video and final-frame conditioning aren't supported by the model, so those inputs are hidden and rejected.

The relay accepts exactly these sizes and durations, and passes the size and step count to the worker. Images allow PNG/JPG/WebP up to 15 MB; the pipeline resizes and center-crops them. File checks in the browser are a convenience; the relay checks them again.

## Connect your team's backend

Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_GENERATION_PROVIDER=http
VITE_API_BASE_URL=http://localhost:8000/api
```

The centralized adapter in `src/services/generation.ts` targets your own server, not `api.ltx.io`. Your backend must allow the frontend origin through CORS, or use a same-origin reverse proxy with `/api`. For MP4 playback and blob download, the output URL must be browser-accessible and allow CORS when hosted on another origin. Use HTTPS for deployed frontends and backends. `VITE_` variables are public; never add API keys, cloud credentials, or model access tokens.

### Suggested backend contract

`POST /api/generations` accepts multipart FormData:

- `request`: JSON string with `mode` (`text` / `image`), `prompt`, `model` (`k6-lite-fast` / `k6-lite-quality`), `width`, `height`, `fps`, and `durationSeconds`, matching a preset above.
- `image`: source File for image mode.

Returns a job immediately:

```json
{ "jobId": "abc-123", "createdAt": "2026-10-10T12:00:00Z" }
```

`GET /api/generations/abc-123` returns:

```json
{ "jobId": "abc-123", "status": "processing", "progress": 42 }
```

On completion:

```json
{
  "jobId": "abc-123",
  "status": "completed",
  "progress": 100,
  "output": {
    "url": "https://your-backend.example/outputs/abc-123.mp4",
    "filename": "abc-123.mp4",
    "mimeType": "video/mp4",
    "width": 1280,
    "height": 720,
    "fps": 24,
    "durationSeconds": 6
  }
}
```

Failure: `{ "jobId": "abc-123", "status": "failed", "error": "Worker ran out of memory." }`

The hook polls every 800ms, aborts browser requests on reset/unmount, prevents duplicate submissions, and stops after 15 minutes. Stop waiting stops local polling; it does not cancel a backend job. There is no persistence across page reloads. Update the HTTP adapter alone if your backend uses different routes or field names. The UI consumes the `GenerationService` interface in `src/lib/types.ts`. `progress` is optional in status responses.

Each HTTP request has a 30-second timeout. A failed network request ends the local job flow with an error and allows retry.

## AMD backend integration plan

Status (2026-10-10): **worker, relay, and frontend connected.** The instance runs `worker_k6.py` (Kandinsky 6.0
Video Lite distilled). A text→video clip has gone through the full UI → Vite proxy → relay → worker path on the
live instance. Instance facts and current numbers live in
`AGENTS.md`.

To run it: put the cookie in `relay/.env.local` (see `relay/.env.example`), then run `npm run relay` and
`VITE_GENERATION_PROVIDER=http npm run dev` in two terminals. `GET /api/health` reports whether the worker's
heartbeat is fresh.

### The constraint

The model runs on an AMD Radeon Cloud JupyterLab instance (W7900D 48 GB, ROCm). The only verified way in is
the JupyterLab web UI at `jupyter.anruicloud.com/instances/<id>/lab`, behind an nginx gate that needs a
cookie set by the dashboard's "Open notebook" button. There is no SSH, there are no exposed ports, and
`jupyter-server-proxy` is not installed. (Installing it would mean restarting the Jupyter server, which is the
container's only entry point and could cost us the instance.) Outbound traffic goes through an egress proxy, so
whether tunnels like cloudflared or ngrok work is **untested**.

So the frontend can't call a port on the instance directly. The plan uses only channels we have already used
successfully: the Jupyter **Contents API** (read/write files) and **`/files/`** (download), both over the
cookie-gated HTTPS host.

### Recommended architecture: file-queue relay over the Jupyter API

```
Browser (Vite :5173)
  │  /api/generations[/:id], /api/timelines[/:id], /api/wall, /api/outputs/:id.mp4, /api/health
  ▼
Vite dev proxy  /api → http://127.0.0.1:8000
  ▼
relay/ (laptop, Node, no deps)  ── HTTPS + gateway cookie + Jupyter XSRF ──►  jupyter.anruicloud.com
  │  PUT  /api/contents/jobs/<id>/…        (upload request + media)
  │  GET  /api/contents/jobs/<id>/status.json
  │  GET  /files/jobs/<id>/out.mp4         (stream back to browser)
  ▼
/workspace/jobs/<id>/  ◄── watched by ──  worker_k6.py (instance, long-lived, pipeline resident on GPU)
```

The frontend doesn't change: set `VITE_GENERATION_PROVIDER=http`, `VITE_API_BASE_URL=/api`, and add
`server.proxy: { '/api': 'http://127.0.0.1:8000' }` to `vite.config.ts`. The relay serves the contract above
exactly, and the MP4 `url` is same-origin (`/api/outputs/<id>.mp4`), so CORS and blob downloads just work.

**Instance side: `worker_k6.py`** (lives in `/workspace`, backed up to `instance_scripts/`)
- Launched once with `subprocess.Popen(..., start_new_session=True)` and logging to `/workspace/jobs/worker.log`.
  It survives kernel restarts and browser reloads, and writes `jobs/worker.heartbeat` every 10 s once the model is loaded.
- Keeps the whole Kandinsky pipeline resident on the GPU (~25 GB): no CPU offload, no per-job reloads, host RAM
  ~2.5 GB. One `Kandinsky6TI2VAPipeline` serves text and image modes (`image=` conditions the first frame).
- Single GPU, so jobs run one at a time in FIFO order. It scans `/workspace/jobs/*/request.json` (the relay
  writes this file **last**, as the "ready" marker) and handles the oldest job without a `status.json`.
- Writes `status.json` atomically (write `.tmp`, then `os.replace`). Shape: `{status, progress, error?, output?}`.
  Progress: 2% start, 10% after prompt expansion, 10–90% across the denoise steps, 92% while exporting.
- Maps the UI request to what the model can do (next section), writes `out.mp4`, and fills `output` with the
  **real** width, height, fps, and duration (plus seed, expanded prompt, steps, generateSeconds, peakVramGB).
- Catches `torch.OutOfMemoryError` and other exceptions, reports `failed` with a readable message, frees
  memory, and carries on. A job left `processing` by a dead worker is marked failed on restart.
- Deletes job folders older than `JOB_TTL_HOURS` (6). If MP4 export fails it keeps `frames.npy`/`audio.pt`.
- The previous LTX-2.5 `worker.py` is retired (its host RAM grew until the instance died) and isn't in this repo.

**Laptop side: `relay/server.mjs`** (Node built-ins only, port 8000)
- `POST /api/generations`: parses the multipart body (`request.formData()` on a `Request`), validates it, and
  creates a `jobId`. It uploads `image`/`finalFrame`/`audio`, then `request.json`, to `jobs/<jobId>/` with
  `PUT /api/contents/...` (base64 for binaries; the server limit is far above our 15/32 MB caps). Returns
  `{ jobId, createdAt }` immediately.
- `GET /api/generations/:id`: returns `queued` until `status.json` exists, otherwise its contents, with
  `output.url` rewritten to `/api/outputs/<id>.mp4`. It caches the upstream result for about 2 s so the
  browser's 800 ms polling doesn't hammer Jupyter. A `404` from upstream means `queued`.
- `GET /api/outputs/:id.mp4`: streams `/files/jobs/<id>/out.mp4`, passing `Range` headers through so the
  `<video>` element can seek.
- Secrets: the gateway cookie(s), the Jupyter `_xsrf` value, and the instance base path go in
  `relay/.env.local` (already gitignored via `.env.*`). They are **never** `VITE_` variables. Copy them from
  Chrome DevTools → Application → Cookies after clicking "Open notebook". If any upstream call returns
  401/403, the relay reports a clear "re-open the notebook and refresh the cookie" error.

**Why this approach:** no installs or restarts on the instance, no inbound ports, no new egress, and
every hop has already worked from this laptop. Jobs and outputs survive relay restarts because they live on
`/workspace`, and the frontend contract and adapter stay unchanged. The cost is polling latency of a second or
two, which doesn't matter next to roughly 90 s per clip.

### Mapping UI presets to what actually runs

The relay validates the request against `src/lib/capabilities.ts` and adds `bench: {size: [w, h], steps}` to
`request.json`. The worker then:

1. **Size and steps:** uses `bench` (640×352 or 864×480, either orientation; 6 or 10 steps). Without `bench`
   (hand-written jobs) it falls back to 864×480 / 480×864 at 10 steps.
2. **Frames:** 4k+1 ≥ fps × duration, capped at 121. **fps:** 23–25 honored, anything else becomes 24.
3. **Guidance:** 1.0 (distilled checkpoint). Qwen prompt expansion on by default (`ENHANCE` env).
4. **Modes:** text→video and image→video. Final-frame conditioning and audio→video return
   `failed` with a readable message (the relay and the UI already reject them).

### Alternatives considered

| Option | Verdict |
| --- | --- |
| **Outbound tunnel** (cloudflared quick tunnel / ngrok) from the instance to a public HTTPS URL; the worker becomes a normal FastAPI server | Simplest frontend story (point `VITE_API_BASE_URL` at it, add CORS), but egress is proxied and **untested**. It also exposes a GPU endpoint publicly, so it needs a shared-secret header and the team's explicit OK before anyone tries it. Worth a 10-minute test; if it works, the worker's HTTP layer can replace the relay. |
| `jupyter-server-proxy` (`/instances/<id>/proxy/8000/`) | Clean, but needs a Jupyter server restart on a container where that's the entry point. Too risky without a way to recover. |
| Relay that drives a **kernel over websocket** (like `runPy`) instead of files | Works, but kernels die on idle or restart and a websocket client adds complexity. File queue is sturdier. |
| Browser calls Jupyter directly from the frontend | Blocked: cross-origin, Jupyter sends no CORS headers, and it would put Jupyter credentials in the browser bundle. |

### Build order

1. **Prove the transport (about 15 min):** use `curl` from the laptop with the copied cookie + `_xsrf` to
   `PUT` and `GET` a small file under `/api/contents/jobs/test/` and fetch it via `/files/`. If the cookie
   doesn't work outside Chrome (e.g. it's bound to the browser), fall back to running the relay's upstream calls
   from the JupyterLab tab via the `runPy` helper, or try the tunnel option.
2. ~~**Worker**~~ done: `worker_k6.py`, tested with hand-written jobs (see `AGENTS.md`).
3. **`relay/server.mjs`** + `vite.config.ts` proxy; add `npm run relay` and a `relay/.env.example`
   listing the variable names only.
4. ~~Narrow `capabilities.ts`~~ done. **Run end-to-end text→video from the UI against the live instance**, then
   update this README's Verification section.
5. ~~Image→video in the worker~~ done. Audio→video isn't supported by Kandinsky 6.
6. Demo hardening: show a queue position in `status.json` (`queued` with `progress: 0`). `GET /api/health` exists,
   and a job submitted while the heartbeat is stale fails with "GPU worker is offline" instead of polling forever.
7. Time Machine Film: worker-side chaining (each shot starts from the previous shot's last frame) and stitching,
   plus a `finalFrameUrl` for the before/after slider.

## Project map

- `src/components/ModeInputs.tsx`: modular text and image panels (the audio panel is unused).
- `src/components/GenerationSettings.tsx`: shared configuration controls.
- `src/components/VideoOutput.tsx`: player, progress, failure, and download UI.
- `src/lib/types.ts`: request, submission, status, service, and MP4 contracts.
- `src/lib/capabilities.ts`: tested Kandinsky presets and input validation (shared with the relay).
- `src/services/timeline.ts`, `src/timeMachine/`: Campus Time Machine adapters, data, and views.
- `relay/server.mjs`: laptop-side relay to the Jupyter instance. `instance_scripts/`: worker and setup scripts for the instance.
- `src/services/generation.ts`: interchangeable mock and HTTP adapters.
- `src/hooks/useGeneration.ts`: asynchronous job lifecycle and polling.
- `public/demo.mp4`: bundled sample output; replace with a teammate's generated clip if desired, then update its metadata in the mock adapter.

No authentication, accounts, database, payments, or credentials are included.

## Verification

Strict TypeScript and the Vite production build pass. Sixteen Vitest checks cover the Free mode settings/validation/jobs and timeline ordering, snapshots, mock reload recovery, failed jobs, relay serialization, response validation, wall deduplication, unavailable storage, and shared polling. The bundled MP4 was encoded and decoded with FFmpeg. Vite starts and reports its local URL.

The frontend UI was checked in a local browser: text generation, native MP4 playback and download, image/final-frame previews, audio preview and duration, setting constraints, keyboard tab navigation, and failed-job retry. Responsive checks cover a 1366×768 desktop viewport and a 390×844 mobile viewport. No lint script is configured; `npm run build` provides strict TypeScript checking. These browser checks predate the switch to the Kandinsky presets.

Kandinsky presets and relay (2026-10-10): `relay/server.mjs` was run against a local fake Jupyter server that stands in for the Contents API, `/files`, and the worker. Checked: Free-mode text generation from the UI through the Vite proxy (the request reached the worker as 640×352, 10 steps), relay rejection of untested sizes, Time Machine Snapshot with an uploaded photo (prompt built from the moment template, `beforeImageUrl`, Wall listing), the readable Film and missing-place-photo errors, and MP4/source-image streaming. Then against the live instance: Free-mode text→video from the UI (640×352, 3 s, 10 steps) completed in 48 s of GPU time and played in the browser. Image→video through the relay also completed (52 s) with a 1024 px photo; the same photo at 2560×1707 ran the prompt enhancer out of GPU memory, which the worker's new `MAX_IMAGE_SIDE` resize fixes once deployed. Time Machine hasn't run live yet.

Campus Time Machine browser checks cover place/moment selection, one-shot Snapshot and three-shot Film structure, custom photo upload, journey completion and reload recovery, comparison range controls, local wall saving and archived playback, failed-job retry, and Free mode generation continuing across view changes. The 320px mobile viewport was also checked for horizontal overflow. Actual campus films and multi-shot chaining remain unverified until the campus photos and worker chaining exist.
