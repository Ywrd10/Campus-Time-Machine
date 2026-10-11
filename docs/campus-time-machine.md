# Campus Time Machine — plan

Status: **plan only.** Depends on the AMD worker/relay in [architecture.md](architecture.md) and on
image→video, which has not been run on the instance yet.

## Pitch

Pick a real UCF spot, pick a moment in time, and watch that exact place change. The first frame is always our own
photo of the location, so every clip is recognizably campus. LTX-2.5 then has to act as a *world model*: keep the
place consistent while simulating what happens to it — water, weather, light, crowds, decay — with matching sound.

## User flow

```
① PLACE                     ② MOMENT                       ③ TRAVELING              ④ ARRIVED
┌────────────────────┐      ┌──────────────────────────┐   ┌──────────────────┐    ┌──────────────────────────┐
│ [Reflecting Pond]  │      │ Reflecting Pond, today   │   │ ◐ now → 2125      │    │ ▶ film (with audio)      │
│ [Student Union]    │  →   │ ○ Homecoming             │ → │ [✓ now][◐ shift]  │ →  │ ⟷ before/after slider    │
│ [Library]          │      │ ● 2125                   │   │ [· arrive]        │    │ [Try another moment]     │
│ [Memory Mall] ...  │      │ ○ Hurricane landfall     │   │ ~6 min · safe to  │    │ [Download] [Add to Wall] │
│ (+ upload a photo) │      │ ○ Rocket launch ...      │   │ leave this page   │    └──────────────────────────┘
└────────────────────┘      │ Length: ○ Snapshot ● Film │   └──────────────────┘
                            └──────────────────────────┘
⑤ TIME MACHINE WALL: grid of places × moments from everyone's renders; click a cell to play.
```

- **Snapshot:** one shot from the photo (~2 min).
- **Film:** three shots, each starting from the previous shot's last frame (~6 min):
  1. *Now*: the place as photographed, with gentle ambient motion and sound.
  2. *Shift*: the change happening (storm rolls in, rocket rises, balloons rise).
  3. *Arrive*: the new moment, settled.

## Content

**Places** (`src/timeMachine/places.ts` + `public/places/*.jpg`): id, name, photo, and a one-line factual
description the prompts reuse ("the Reflecting Pond, a round fountain pond in front of the library"). The team takes
10–20 landscape photos, ideally without recognizable people, at ≥1280 px wide. They're cropped to 16:9 (or 9:16) to
match the worker's working size.

**Moments** (`src/timeMachine/moments.ts`): id, label, icon, and three prompt templates (`now`, `shift`,
`arrive`) with a `{place}` slot. Hand-written rather than LLM-generated: deterministic, no API key, easy to tune. The
The relay skips the instance's prompt enhancer for them: it added camera moves that left the photo. Starting set:

| Moment | What moves through the photo |
| --- | --- |
| The year 2125 | white drones and a transparent hover pod glide past, blue light lines on the buildings |
| Homecoming | hundreds of black and gold balloons rise past the camera, gold confetti falls |
| Hurricane landfall | a tornado funnel in the distance, black clouds, thrashing trees, wind and rain audio |
| Rocket on the horizon | a distant launch with a flame and billowing plume (campus is near the Space Coast) |
| Wild Florida | an alligator crawls across the foreground, a heron steps past |
| Charge of the Knights | a knight in silver armor gallops across on a white horse with a black and gold banner |
| Snow day in Orlando | snow falls and piles up; the camera tilts down to the white ground |

Whole-scene restyles (1968 film look, medieval stone, 500 years of overgrowth) were tried first and dropped: in a
3 s image→video clip they barely change the photo or dissolve into a different place. See `moments.ts`.

Keep official UCF marks (logos, Knightro, the Pegasus seal artwork) out of prompts and marketing.

## Backend changes

**Worker (`instance_scripts/worker.py`)**
- New request type `timeline`: `{type: "timeline", image, shots: [{prompt, seconds}], aspect}`. One job holds the
  whole film, so ordering and dependencies stay inside the worker, and a relay restart can't break the chain.
- Shot 1 is image→video from the uploaded photo. Shot *n+1* is image→video from shot *n*'s last decoded frame
  (taken straight from the numpy output, with no re-decode of the MP4).
- After the last shot, the shots are joined into `out.mp4` (video and audio) with PyAV. Each `shot<n>.mp4` is kept for
  the per-shot view.
- `status.json` gains `shots: [{status, progress}]`. Overall progress is the average across shots.
- Optional later: the prompt enhancer gets the *image* for shot 1 (I2V system prompt), so the description is
  grounded in the actual photo.

**Relay (`relay/server.mjs`)**
- `POST /api/timelines`: multipart `{place | image, moment, length}`. Builds the shot prompts from the place and
  moment templates on the server (the templates are shared JSON, so the browser can't send arbitrary multi-shot jobs),
  uploads the photo, and writes `request.json`.
- `GET /api/timelines/:id`: the same status contract plus `shots[]`, with per-shot URLs
  `/api/outputs/:id/shot<n>.mp4`.
- `GET /api/wall`: lists completed timeline jobs (Contents API directory listing, cached ~30 s) as
  `{id, place, moment, thumbnail, url}`.
- Jobs older than the worker's TTL vanish from the Wall. For the demo, raise `JOB_TTL_HOURS` or copy keepers to
  `/workspace/wall/`.

## Frontend changes

- New top-level view **Time Machine** next to the existing studio (rename that one **Free mode** and keep it for
  text/image prompts).
- Components: `PlacePicker` (photo grid + upload), `MomentPicker` (chips with a sample thumbnail each),
  `TimelineProgress` (three-segment strip, live per-shot progress, thumbnails as shots finish), `ArrivalView`
  (player, before/after slider of the original photo vs. the last frame, re-roll), `Wall`.
- Reuse `VideoOutput`, `downloadOutput`, and the polling in `useGeneration` (one job, richer status).
- Persist the current job ID in `localStorage` so a reload reattaches to the render instead of losing six minutes.
- Mock provider: ship 2–3 pre-rendered sample films so the full flow demos without the GPU.

## Build order

1. **Prerequisites (in progress):** finish the model download; measure FP8 memory and the longest safe clip. That
   fixes the seconds per shot (2 s at 49 frames today, maybe 4 s at 97).
2. **Prove image→video** on the instance with any landscape photo. If quality or adherence is poor, fall back to
   Snapshot only and re-plan.
3. Worker `timeline` jobs (chaining + stitching), tested with a hand-written `request.json`.
4. Relay `/api/timelines`, `/api/wall`.
5. Frontend: places/moments data, pickers, progress, arrival view, Wall.
6. Team takes the campus photos; tune the moment prompts on 3 places × 7 moments (~21 snapshots ≈ 45 min of GPU).
7. Demo prep: batch-render a full Wall overnight, plus a pre-rendered fallback reel in case the cookie or queue
   fails during judging.

## Risks

- **Image→video unverified** on ROCm/diffusers. This is the critical path, so it's tested first.
- **Drift across chained shots:** the place can stop looking like itself by shot 3. Mitigations: keep shots short;
  repeat the place description in every shot prompt; show the before/after slider so drift reads as "time travel".
- **Gateway cookie expires (~15 min observed):** the relay needs a quick way to refresh it during the demo, or the
  live part falls back to the pre-rendered Wall.
- **Throughput:** one GPU, ~6 min per Film. At an event, steer people to Snapshot and show their queue position.
- **Facts and trademarks:** check any UCF history used in prompts and copy; no official logos.
