# Backend API contract

The HTTP contract between the frontend and `relay/server.mjs`. `src/services/generation.ts` (Free mode) and
`src/services/timeline.ts` (Campus Time Machine) are the only places that call it; if a backend uses different
routes or field names, update those adapters alone. The UI consumes the `GenerationService` interface in
`src/lib/types.ts`.

## Free mode: `/api/generations`

`POST /api/generations` accepts multipart FormData:

- `request`: JSON string with `mode` (`text` / `image`), `prompt`, `model` (`k6-lite-fast` / `k6-lite-quality`),
  `width`, `height`, `fps`, and `durationSeconds`, matching a preset in `src/lib/capabilities.ts`.
- `image`: source File for image mode (PNG/JPG/WebP, up to 15 MB).

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
    "url": "/api/outputs/abc-123.mp4",
    "filename": "abc-123.mp4",
    "mimeType": "video/mp4",
    "width": 640,
    "height": 352,
    "fps": 24,
    "durationSeconds": 3
  },
  "finalFrameUrl": "/api/outputs/abc-123/last.png"
}
```

Failure: `{ "jobId": "abc-123", "status": "failed", "error": "Worker ran out of memory." }`

`progress` is optional; without it the UI shows an indeterminate state.

## Campus Time Machine: `/api/timelines`, `/api/wall`

- `POST /api/timelines`: multipart `place` (+ optional `view`, a view id from `places.ts`; default first) **or** `image`, plus `moment`, `length` (`snapshot`), and optional `quality` (`quick` / `standard` / `high`; defaults to `standard`);
  returns `{ "jobId": "..." }`.
- `GET /api/timelines/:id`: the job status/output contract above plus `shots` (one for Snapshot, three for Film).
  Each shot has `status`, optional `phase` (`now` / `shift` / `arrive`), optional numeric `progress`, optional
  `output`, and optional `thumbnail`. Phases are inferred by order if omitted. `beforeImageUrl` and
  `finalFrameUrl` are optional top-level image URLs (the source photo and the clip's last frame; the UI uses the latter as the video poster).
- `GET /api/wall`: an array of `{ "id", "place", "moment", "thumbnail", "url" }` for completed journeys.
  `moment` uses the IDs in `src/timeMachine/moments.ts`; `place` is a display name. Completed real jobs appear
  on the Wall automatically; the frontend has no publishing endpoint.

With remote storage configured (`HF_BUCKET`, see `relay/.env.example`), finished journeys live in a public Hugging
Face Storage Bucket and the Wall is read from it. Archived journeys' `url`, `thumbnail`, `finalFrameUrl`,
`beforeImageUrl`, and `output.url` are absolute `https://huggingface.co/buckets/<ns>/<bucket>/resolve/journeys/...`
URLs (302 to HF's CDN, `Range` supported), so the browser plays them without the relay. A journey shows relay
`/api/outputs/...` URLs until its upload finishes, usually a few seconds after completion.

The relay owns prompt construction and source photos. The browser sends selection IDs, never arbitrary shot
templates. `src/timeMachine/quality.ts` is shared by the UI and relay. All Snapshots are 3 seconds at 24 FPS:

| Quality ID | Dimensions | Steps |
| --- | --- | --- |
| `quick` | 640×352 | 6 |
| `standard` (default) | 640×352 | 10 |
| `high` | 864×480 | 10 |

The relay checks each preset against `src/lib/capabilities.ts` and forwards its exact `bench.size` and
`bench.steps` to the existing worker. Unknown quality IDs receive HTTP 400 before queueing. Old callers that omit
quality keep their previous Standard preset. Film is rejected and no longer exposed in the UI. The legacy
`/api/generations` adapter remains available for backend compatibility; Free mode is no longer mounted.

## Other relay routes

- `GET /api/outputs/:id.mp4`, `GET /api/outputs/:id/<file>`: MP4 (with `Range` support), last frame, and
  source image.
- `GET /api/health`: instance login state and worker heartbeat freshness.

## Client behavior

- Polling (`src/lib/pollJob.ts`, shared by both workspaces): every 800 ms, aborts on reset/unmount, prevents
  duplicate submissions, stops after 15 minutes. **Stop waiting** stops local polling; it doesn't cancel the job.
- Each HTTP request has a 30-second timeout. A failed request ends the local job flow with an error and allows retry.
- Runtime guards reject invalid status/output shapes and executable media URL protocols.
- Any other backend must allow the frontend origin through CORS (or sit behind a same-origin `/api` proxy), and
  its MP4 URLs must be browser-accessible. `VITE_` variables are public; never put credentials in them.
