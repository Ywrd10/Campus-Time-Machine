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

Browser visual checks and interactive playback/download/upload checks could not be completed in the authoring environment because localhost connections timed out. Run `npm run dev` in your terminal and check the demo walkthrough in your browser before the hackathon presentation. The real AMD inference backend has not been integrated or tested.
