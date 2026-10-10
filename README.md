# Knight Studio

A frontend prototype for Knight Hacks IX: React, TypeScript, Vite, Tailwind CSS, and Lucide icons. All inference belongs to your team's separate backend.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

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
2. Keep the defaults: LTX-2.5 Fast, 1280×720, 24 FPS, 6 seconds.
3. Generate, watch the simulated job progress, then play and download the MP4.
4. Change to Image-to-Video for a source image, optional motion prompt, and optional final frame.
5. Change to Audio-to-Video for an audio preview and visual prompt. Clip duration comes from audio metadata; it is not manually selectable.

All three modes use the same mock adapter. Uploaded files stay in the browser during mock mode. The bundled MP4 is a fixed 6-second sample, independent of the prompt, uploaded media, aspect ratio, or selected settings. It is explicitly labeled as a demo; output metadata describes the actual file. Image/audio conditioning is UI scaffolding until a real backend is connected. Download errors and video playback errors are shown separately from generation errors.

The sample is an original illustrated mountain landscape with a slow camera zoom, encoded as H.264 MP4 (1280×720, 24 FPS, 6 seconds, no audio). No remote media service is required for the demo.

To exercise the failed job state, copy `.env.example` to `.env.local`, set `VITE_MOCK_FAIL=true`, and restart Vite. Set it back to false to restore successful demo jobs. Form validation errors can also be tested by submitting an empty prompt or an audio clip above the selected limit.

## Supported settings and inference boundary

The preset catalog in `src/lib/capabilities.ts` follows the [official LTX-2.5 support matrix](https://docs.ltx.io/models/ltx-2-5):

- Fast at 720p/1080p and 24/25 FPS: 6–20 seconds in steps of 2.
- Fast at 48/50 FPS, or at 1440p/4K: 6, 8, 10 seconds.
- Pro at all offered resolutions and FPS values: 6, 8, 10 seconds.
- FPS: 24, 25, 48, 50. Aspect ratios: 16:9 and 9:16.
- Audio length: Fast at 720p/1080p allows up to 20 seconds; other presets allow up to 10 seconds, following the [audio reference](https://docs.ltx.io/api-documentation/api-reference/async-video-generation/submit-audio-to-video).

Changing a setting that invalidates the current duration resets it to 6 seconds and announces the adjustment. File extension and size checks are browser-side convenience checks; the backend must validate actual formats/codecs and inputs. Images allow PNG/JPG/WebP up to 15 MB; audio allows MP3/WAV/M4A/OGG up to 32 MB. Browser playback support may vary.

These are documented frontend/output presets, not claims that raw model inference accepts identical parameters. The [open-source text workflow](https://docs.ltx.io/open-source-model/usage-guides/text-to-video) requires spatial dimensions divisible by 32 and frame counts of 8n+1. Your AMD worker should map output presets to padded/cropped working dimensions and frame counts, then encode/trim to the requested output. The self-hosted backend must decide which pipelines/checkpoints correspond to the Fast/Pro UI names, enforce available hardware limits, and return actual MP4 metadata. Update the capability catalog if the team exposes a narrower subset. No AMD/ROCm performance or compatibility is claimed or tested by this frontend.

## Connect your team's backend

Copy `.env.example` to `.env.local` and set:

```dotenv
VITE_GENERATION_PROVIDER=http
VITE_API_BASE_URL=http://localhost:8000/api
```

The centralized adapter in `src/services/generation.ts` targets your own server, not `api.ltx.io`. Your backend must allow the frontend origin through CORS, or use a same-origin reverse proxy with `/api`. For MP4 playback and blob download, the output URL must be browser-accessible and allow CORS when hosted on another origin. Use HTTPS for deployed frontends and backends. `VITE_` variables are public; never add API keys, cloud credentials, or model access tokens.

### Suggested backend contract

`POST /api/generations` accepts multipart FormData:

- `request`: JSON string with `mode` (`text` / `image` / `audio`), `prompt`, `model`, `width`, `height`, `fps`, and `durationSeconds`.
- `image`: source File for image mode.
- `finalFrame`: optional File for image mode.
- `audio`: source File for audio mode.

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

The hook polls every 800ms, aborts browser requests on reset/unmount, prevents duplicate submissions, and stops after 15 minutes. Cancel preview stops local polling; it does not cancel a backend job. There is no persistence across page reloads. Update the HTTP adapter alone if your backend uses different routes or field names. The UI consumes the `GenerationService` interface in `src/lib/types.ts`.

Each HTTP request has a 30-second timeout. A failed network request ends the local job flow with an error and allows retry.

## AMD backend integration plan

Status (2026-10-10): **worker and relay written; UI end-to-end not yet tested.** The instance runs
`worker_k6.py` (Kandinsky 6.0 Video Lite distilled), verified by hand-written jobs. `relay/server.mjs` and the Vite
proxy exist but haven't been exercised against `worker_k6.py`. Instance facts and current numbers live in `AGENTS.md`.

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
  │  POST /api/generations, GET /api/generations/:id, GET /api/outputs/:id.mp4
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
- The previous LTX-2.5 `worker.py` is kept for reference only; its host RAM grew until the instance died.

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

The UI catalog (720p–4K, 6–20 s, 24–50 fps) comes from the hosted LTX API. Kandinsky 6 Lite generates at SD
sizes, up to 121 frames (5 s) at 24 fps. `worker_k6.py` currently maps every request like this:

1. **Size:** 864×480, or 480×864 when the requested height exceeds the width.
2. **Frames:** 4k+1 ≥ fps × duration, capped at 121. **fps:** 23–25 honored, anything else becomes 24.
3. **Steps / guidance:** 10 steps, guidance 1.0 (distilled checkpoint). Qwen prompt expansion on by default.
4. **Modes:** text→video and image→video work. Final-frame conditioning and audio→video return
   `failed` with a readable message.

At those defaults a 5 s clip takes ~4 min. For the live demo, ~640×352 at 2–3 s takes 35–50 s (measured table in
`outputs/k6/README.md`). Next: narrow `src/lib/capabilities.ts` to a Kandinsky preset set (16:9/9:16, 24 fps, ≤5 s)
and pick the demo default from the sweep; the adapter already shows the real output metadata.

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
4. Run end-to-end text→video from the UI; then narrow `capabilities.ts` and update this README's
   Verification section with what was actually tested.
5. ~~Image→video in the worker~~ done. Audio→video isn't supported by Kandinsky 6.
6. Demo hardening: show a queue position in `status.json` (`queued` with `progress: 0`) and a
   `GET /api/health` on the relay that reports the worker's heartbeat file (`/workspace/jobs/worker.heartbeat`,
   touched every 10 s), so the UI can say "GPU worker offline" instead of polling forever.

## Project map

- `src/components/ModeInputs.tsx`: modular text, image, and audio panels.
- `src/components/GenerationSettings.tsx`: shared configuration controls.
- `src/components/VideoOutput.tsx`: player, progress, failure, and download UI.
- `src/lib/types.ts`: request, submission, status, service, and MP4 contracts.
- `src/lib/capabilities.ts`: settings and input validation.
- `src/services/generation.ts`: interchangeable mock and HTTP adapters.
- `src/hooks/useGeneration.ts`: asynchronous job lifecycle and polling.
- `public/demo.mp4`: bundled sample output; replace with a teammate's generated clip if desired, then update its metadata in the mock adapter.

No authentication, accounts, database, payments, or credentials are included.

## Verification

Strict TypeScript and the Vite production build pass. Seven Vitest checks pass, covering the documented configuration matrix, defaults, portrait dimensions, prompt validation, audio limits, simulated queued/processing/completed/failed jobs, and abort handling. The bundled MP4 was encoded and decoded with FFmpeg. Vite starts and reports its local URL.

Browser visual checks and interactive playback/download/upload checks could not be completed in the authoring environment because localhost connections timed out. Run `npm run dev` in your terminal and check the demo walkthrough in your browser before the hackathon presentation. The AMD inference backend (`worker_k6.py` on the Radeon instance) is verified with hand-written jobs; it has not yet been tested through the UI and relay.
