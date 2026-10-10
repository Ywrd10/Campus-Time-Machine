# AMD backend architecture

How the frontend reaches the Kandinsky 6.0 Video Lite worker on the AMD Radeon Cloud instance. Instance facts,
current numbers, and gotchas live in `AGENTS.md`; the HTTP contract the relay serves is in [api.md](api.md).

Status (2026-10-10): **worker, relay, and frontend connected.** Free-mode text→video and image→video and Time
Machine Snapshot have all run through the full UI → Vite proxy → relay → worker path on the live instance.

## The constraint

The model runs on an AMD Radeon Cloud JupyterLab instance (W7900D 48 GB, ROCm). The only verified way in is
the JupyterLab web UI at `jupyter.anruicloud.com/instances/<id>/lab`, behind an nginx gate that needs a
cookie set by the dashboard's "Open notebook" button. There is no SSH, there are no exposed ports, and
`jupyter-server-proxy` is not installed. (Installing it would mean restarting the Jupyter server, which is the
container's only entry point and could cost us the instance.) Outbound traffic goes through an allowlisting egress
proxy: `example.com`, `api.ngrok.com` and `www.cloudflare.com` all fail with `CONNECT tunnel failed, response 403`
(2026-10-10), so the worker can't call out to a tunnel or a hosted relay either.

So the frontend can't call a port on the instance directly. The design uses only channels that already worked:
the Jupyter **Contents API** (read/write files) and **`/files/`** (download), both over the cookie-gated HTTPS host.

## File-queue relay over the Jupyter API

```
Browser (Vite :5173)
  │  /api/generations[/:id], /api/timelines[/:id], /api/wall, /api/outputs/:id.mp4, /api/health
  ▼
Vite dev proxy  /api → http://127.0.0.1:8000
  ▼
relay/ (laptop, Node, no deps)  ── HTTPS + gateway cookie + Jupyter XSRF ──►  jupyter.anruicloud.com
  │  transport-jupyter.mjs: gets the cookie from radeon-global…/api/notebook/open with RADEON_SESSION
  │  PUT  /api/contents/jobs/<id>/…        (upload request + media)
  │  GET  /api/contents/jobs/<id>/status.json
  │  GET  /files/jobs/<id>/out.mp4         (stream back to browser)
  ▼
/workspace/jobs/<id>/  ◄── watched by ──  worker_k6.py (instance, long-lived, pipeline resident on GPU)
```

The MP4 `url` the browser sees is same-origin (`/api/outputs/<id>.mp4`), so CORS and blob downloads just work.

### Instance side: `worker_k6.py`

Lives in `/workspace`, backed up to `instance_scripts/`.

- Launched once with `subprocess.Popen(..., start_new_session=True)` and logging to `/workspace/jobs/worker.log`.
  It survives kernel restarts and browser reloads, and writes `jobs/worker.heartbeat` every 10 s once the model is loaded.
- Keeps the whole Kandinsky pipeline resident on the GPU (~25 GB): no CPU offload, no per-job reloads, host RAM
  ~2.5 GB. One `Kandinsky6TI2VAPipeline` serves text and image modes (`image=` conditions the first frame).
- Single GPU, so jobs run one at a time in FIFO order. It scans `/workspace/jobs/*/request.json` (the relay
  writes this file **last**, as the "ready" marker) and handles the oldest job without a `status.json`.
- Writes `status.json` atomically (write `.tmp`, then `os.replace`). Shape: `{status, progress, error?, output?}`.
  Progress: 2% start, 10% after prompt expansion, 10–90% across the denoise steps, 92% while exporting.
- Writes `out.mp4` and `last.png` (the clip's last frame), and fills `output` with the **real** width, height,
  fps, and duration (plus seed, expanded prompt, steps, generateSeconds, peakVramGB, `finalFrame`).
- Catches `torch.OutOfMemoryError` and other exceptions, reports `failed` with a readable message, frees
  memory, and carries on. A job left `processing` by a dead worker is marked failed on restart.
- Deletes job folders older than `JOB_TTL_HOURS` (6). If MP4 export fails it keeps `frames.npy`/`audio.pt`.

### Laptop side: `relay/server.mjs`

Node built-ins only, port 8000. `transport-jupyter.mjs` handles the upstream calls and gateway login.

- `POST /api/generations`: parses the multipart body, validates it against `src/lib/capabilities.ts`, and
  creates a `jobId`. It uploads the image, then `request.json`, to `jobs/<jobId>/` with `PUT /api/contents/...`
  and returns `{ jobId, createdAt }` immediately.
- `GET /api/generations/:id`: returns `queued` until `status.json` exists, otherwise its contents, with
  `output.url` rewritten to `/api/outputs/<id>.mp4` and `finalFrameUrl` to `/api/outputs/<id>/last.png`. It caches
  the upstream result for about 2 s so the browser's 800 ms polling doesn't hammer Jupyter. A `404` from
  upstream means `queued`.
- `GET /api/outputs/:id.mp4`: streams `/files/jobs/<id>/out.mp4`, passing `Range` headers through so the
  `<video>` element can seek. Finished MP4s and last frames are cached in `relay/cache/`.
- `/api/timelines` and `/api/wall` serve the Campus Time Machine (see [api.md](api.md)). Timeline jobs are
  recorded in `relay/wall.json` (gitignored).
- `GET /api/health` reports `instance` (`ok` / `login-expired` / `unreachable`) and whether the worker's
  heartbeat is fresh. A job submitted while the heartbeat is stale fails with "GPU worker is offline".
- Secrets live in `relay/.env.local` (gitignored), never in `VITE_` variables. `RADEON_SESSION` (the dashboard's
  `__Host-oneclick-manager` cookie) lets the relay follow "Open notebook" itself whenever the gateway 403s, and
  learn the instance URL from the redirect. See `relay/.env.example`.

**Why this approach:** no installs or restarts on the instance, no inbound ports, no new egress, and every hop
had already worked from the laptop. Jobs and outputs survive relay restarts because they live on `/workspace`.
The cost is a second or two of polling latency, which doesn't matter next to a ~50 s clip.

## Mapping UI presets to what actually runs

The relay validates the request against `src/lib/capabilities.ts` and adds `bench: {size: [w, h], steps}` to
`request.json`. The worker then:

1. **Size and steps:** uses `bench` (640×352 or 864×480, either orientation; 6 or 10 steps). Without `bench`
   (hand-written jobs) it falls back to 864×480 / 480×864 at 10 steps.
2. **Frames:** 4k+1 ≥ fps × duration, capped at 121. **fps:** 23–25 honored, anything else becomes 24.
3. **Guidance:** 1.0 (distilled checkpoint). Qwen prompt expansion on by default (`ENHANCE` env).
4. **Modes:** text→video and image→video. Final-frame conditioning and audio→video return
   `failed` with a readable message (the relay and the UI already reject them).

## Alternatives considered

| Option | Verdict |
| --- | --- |
| **Outbound tunnel** (cloudflared / ngrok) from the instance to a public HTTPS URL | Ruled out: the egress proxy blocks `api.ngrok.com` and `www.cloudflare.com`. It would also have exposed a GPU endpoint publicly. |
| `jupyter-server-proxy` (`/instances/<id>/proxy/8000/`) | Clean, but needs a Jupyter server restart on a container where that's the entry point. Too risky without a way to recover. |
| Relay that drives a **kernel over websocket** (like `runPy`) instead of files | Works, but kernels die on idle or restart and a websocket client adds complexity. The file queue is sturdier. |
| Browser calls Jupyter directly from the frontend | Blocked: cross-origin, Jupyter sends no CORS headers, and it would put Jupyter credentials in the browser bundle. |

## Remaining work

- Queue position in `status.json` (`queued` with `progress: 0`) for the demo.
- Time Machine Film: worker-side chaining (each shot starts from the previous shot's last frame) and stitching.
- The previous LTX-2.5 `worker.py` is retired (its host RAM grew until the instance died) and isn't in this repo;
  see the LTX history in `AGENTS.md`.
