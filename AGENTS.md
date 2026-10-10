# Knight Hacks IX — open video+audio generation on AMD Radeon Cloud

Hackathon project generating video with synchronized audio (text→video and image→video) on an
**AMD Radeon Pro W7900D** (48 GB, gfx1100, ROCm). The model is **Kandinsky 6.0 Video Lite (distilled)** since
2026-10-10 ~19:30 UTC; it replaced Lightricks **LTX-2.5** after LTX's host-RAM use killed two instances
(history below). Presentation slot is 6 minutes including Q&A, so a live clip must take well under a minute.

## Current status (2026-10-10, ~20:30 UTC)
- Instance `rgapi-hackathon-22798-4f66cae3` (third one under that id) is up. **`worker_k6.py` is running and idle**
  on `/workspace/k6lite` (`kandinskylab/Kandinsky-6.0-Lite-distill-5s-Diffusers`, 25 GB; downloaded in 6 min).
  LTX-2.5 is not on this instance.
- Whole pipeline resident on the GPU: 24.6 GB idle, ~29 GB peak per job. **Host RAM ~2.5 GB** (LTX: 20–45 GB).
  Worker loads in 14 s. One pipeline serves text and image modes.
- Verified: text→video and image→video with audio (astronaut i2v: frame 0 matches the input, audio −35 dB).
- Speed (pipeline call, excl. prompt expansion and MP4 export; full table + clips in `outputs/k6/README.md`):

  | Size | Frames | Steps | Gen |
  |---|---|---|---|
  | 640×352 | 49 (2 s) | 10 | 36 s |
  | 640×352 | 73 (3 s) | 4 / 6 / 10 | 31 / 37 / 49 s |
  | 640×352 | 121 (5 s) | 10 | 93 s |
  | 864×480 | 49 / 73 (2 / 3 s) | 10 | 69 / 110 s |
  | 864×480 | 73 (3 s) | 6 | 83 s |
  | 864×480 | 121 (5 s) | 10 | 223–233 s |

  Frame count dominates (attention is quadratic in tokens); steps matter less. 4–6 steps look close to 10 but the
  audio gets quieter (−31 → −41 dB). Live-demo candidate: 640×352, 2–3 s, 6–10 steps (≈35–50 s).
- **Frontend connected (branch `amd-backend-relay`, main merged in):** `src/lib/capabilities.ts` offers only the
  tested presets: 640×352 / 864×480 (either orientation), 24 fps, 2/3/5 s, Fast = 6 steps / Quality = 10 steps.
  The relay imports that file (Node ≥ 22.18 type stripping) and forwards `bench: {size, steps}` to the worker.
- Teammate's **Campus Time Machine** view (`src/timeMachine/`) is served by the relay: `/api/timelines` (Snapshot
  only: one i2v shot, 640×352, 3 s, 10 steps, prompt from `moments.ts`), `/api/wall` (index in `relay/wall.json`).
  Film (three chained shots) is disabled in HTTP mode until the worker chains shots. Preset places have no photos
  yet, so real journeys need an uploaded photo.
- **UI → relay → live worker verified** (2026-10-10 ~20:48 UTC): Free-mode text→video, 640×352, 3 s, 10 steps, 48 s gen,
  plays in the browser. Image→video through the relay works (2560×1707 photo, 52 s) with the resize fix deployed.
  Time Machine Snapshot not yet run live.

## The instance
- Dashboard: https://radeon-global.anruicloud.com/ → "Open notebook" (sets the access cookie; direct
  Jupyter URLs return nginx 403 without it, and the cookie eventually expires — re-open from the dashboard).
- Only actions are Open / Logs / **Destroy**. Destroying (or a cgroup OOM, see gotchas) deletes everything.
- `/workspace` is a separate 98 GB ext4 volume (~69 GB free now) and the Jupyter root. Everything lives there.
- Fresh instances ship Python 3.14 and torch 2.13.0+rocm10.0.0 only. `k6_setup.sh` installs diffusers main
  (0.41.0.dev0, via codeload), transformers 5.19, accelerate, av, and pins `huggingface_hub>=1.32,<2`.
- Platform presets `HF_HOME`/`HF_ENDPOINT` env vars; our scripts force `HF_HOME=/workspace/hf` and use
  `HF_ENDPOINT=https://hf-mirror.com`. The Kandinsky repos are MIT-licensed and appear ungated (the download started before any login was confirmed). To log in,
  in a JupyterLab terminal: `export HF_HOME=/workspace/hf HF_ENDPOINT=https://hf-mirror.com && hf auth login`
  (don't `pip install -U huggingface_hub` — 2.x breaks diffusers).

### Layout on /workspace (current instance)
- `k6lite/` — the model. `hf/` — HF_HOME. `jobs/` — worker queue (`<id>/request.json`, `status.json`, `out.mp4`),
  `jobs/worker.log`, `jobs/worker.heartbeat`.
- Scripts (copies of `instance_scripts/`): `k6_setup.sh`, `k6_download.py`, `k6_checks.py`, `worker_k6.py`,
  `k6_sweep_submit.py`.
- Scratch, safe to delete: `vae_debug*.py`, `vae_decode_test*.py`, `te_mask_check.py`, `k6_bench_submit.py`,
  `jobstat.py`, `vae_debug_latents.pt`, `vae_tiled_math.pt`, `check_*.log`, `vae_decode_test*.log`, `k6_*.log`.

## Setting up a fresh instance (≈10 min)
1. Upload `instance_scripts/k6_*.py`, `k6_setup.sh`, `worker_k6.py` to `/workspace` (Contents API `PUT`; verify md5).
2. `bash k6_setup.sh > k6_setup.log 2>&1 && python k6_download.py > k6_download.log 2>&1` via `Popen(start_new_session=True)`.
   Download ends with `DONE - all shards present and readable`.
3. Optional sanity checks (each prints a `VERDICT` line): `python k6_checks.py sdpa|te|dit`.
4. Start the worker: `Popen(["python", "/workspace/worker_k6.py"], start_new_session=True, stdout=open("/workspace/jobs/worker.log", "a"), stderr=STDOUT)`.

## Generating a clip
Drop a job folder into `/workspace/jobs/<id>/` (media first, `request.json` **last** via tmp + `os.replace`):
```json
{"mode": "text" | "image", "prompt": "...", "image": "image.jpg", "width": 1280, "height": 720,
 "fps": 24, "durationSeconds": 3, "seed": 42,
 "bench": {"size": [640, 352], "frames": 73, "steps": 6, "enhance": false}}
```
- Without `bench`, the worker picks 864×480 (or 480×864 if height > width), frames = 4k+1 ≥ fps × duration capped
  at 121 (5 s), fps 23–25 honored else 24, 10 steps, Qwen prompt expansion on. `finalFrame` and `mode: "audio"`
  return a readable failure.
- `bench`: `size` (multiples of 16), `frames`, `steps`, `enhance`. The relay sets `size` and `steps` from the UI preset;
  `frames` and `enhance` are hand-written-job only.
- Worker env: `STEPS`, `MAX_FRAMES`, `MAX_IMAGE_SIDE`, `ENHANCE`, `OFFLOAD` (CPU offload fallback), `VAE_TILING` (default 1), `TE_ATTN` (default eager).
- `status.json`: `{status, progress, error?, output?}`; `output` has width/height/fps/durationSeconds/seed/prompt
  (expanded), steps, generateSeconds, peakVramGB.
- `k6_sweep_submit.py` queues the 8-job speed/quality grid used for `outputs/k6/`.

## Gotchas (all hit and verified)
- **Masked SDPA is wrong on this ROCm stack.** Unmasked `F.scaled_dot_product_attention` is correct and fast (flash
  path; cos 0.999997 vs fp32, 1 GB peak at 50k tokens, `k6_checks.py sdpa`). With an attention mask it silently
  dispatches to the memory-efficient kernel, which returns garbage/NaNs (flash has no masked kernel: "No available
  kernel"). Every masked model must use eager attention or the math kernel:
  - Gemma 4 (LTX text encoder + enhancer): enhancer emitted only `<pad>`, embeddings ~0.70 cosine vs eager.
  - Qwen2.5-VL (Kandinsky text encoder): cosine down to 0.46 on real tokens → `set_attn_implementation("eager")`.
  - Hunyuan video VAE (causal mask): tiled decode 78% NaN → black tiles. Fixed by wrapping `vae.decode`/`vae.encode` in
    `sdpa_kernel([SDPBackend.MATH])` (tiled: 13.7 s, 4.5 GB, correct). MIOpen is not the cause (same NaNs with
    `torch.backends.cudnn.enabled=False`).
  - Kandinsky transformer is fine on native SDPA (vs math: cosine 0.995 video / 0.996 audio after 10 steps).
- **Untiled Hunyuan VAE decode is huge here:** 52 s and 48 GB peak for a 2 s 640×352 clip; a 5 s 864×480 decode tried
  to allocate 24 GiB on top of the resident pipeline and OOM'd. Keep tiling on (with the math-SDPA wrap).
- **`diffusers.utils.encode_video` needs uint8 frames**; `output_type="np"` gives float [0, 1]. A float array raised
  `ValueError: Expected numpy array with dtype uint8` after a 4-min generation. The worker converts, and dumps
  `frames.npy` + `audio.pt` if export still fails.
- **Container RAM limit is 59 GB** (`/sys/fs/cgroup/memory.max`), not the 503 GB `free` shows. Dashboard RAM %
  includes page cache. Weights load mmap'd (cheap); CPU-offload copies are what cost anon memory.
- **`memory.oom.group = 1`:** hitting the cgroup limit kills *every* process, Jupyter (PID 1) included, and the
  instance is gone. This destroyed the first two instances (both LTX). Watch `anon` in `/sys/fs/cgroup/memory.stat`.
  Workers exit themselves at limit − 5 GB, but a single big host allocation can jump that margin between 50 ms
  polls — the real protection is not offloading (Kandinsky Lite fits on the GPU).
- **The gateway's nginx 403s any write (PUT/DELETE) without a same-origin `Origin` header**, even with a valid cookie
  (GETs pass). The relay sends `Origin` on every upstream call.
- **Large input images OOM the prompt enhancer** (found 2026-10-10 with `tests/test.jpg`, 2560×1707): Qwen2.5-VL with
  eager attention asked for 15.8 GB at the vision encoder; the same photo at 1024×683 ran fine (52 s). The repo's
  `worker_k6.py` shrinks images to `MAX_IMAGE_SIDE` (1024) before use. Deployed ~20:57 UTC; the full-size photo then ran
  in 52 s (peak 28.7 GB).
- **A VRAM OOM is harmless** (Python exception; the worker marks the job failed and continues).
- **Egress proxy:** `github.com` blocked (use `codeload.github.com/.../tar.gz/...` for pip), pip uses a mirror,
  `huggingface.co` returns proxy 503 → use `HF_ENDPOINT=https://hf-mirror.com`. The mirror throws read timeouts on
  big files; `snapshot_download` resumes on retry.
- **`pip install -U huggingface_hub` pulls 2.x, which diffusers main rejects** (`requires huggingface-hub<2.0`).
- `transformers from_pretrained(..., device_map="cuda")` stages the whole model in host RAM (+24 GB for Gemma).
  Kandinsky's pipeline `from_pretrained` + `.to("cuda")` stays at ~2.4 GB anon (mmap), so no custom loader needed.
- Background `&`/nohup from `!` cells is unreliable; use `subprocess.Popen(..., start_new_session=True)` + a log file.
- A worker killed from a later kernel stays a zombie (`State: Z`) because its parent was the kernel that launched it.
  It holds no memory; don't wait on `/proc/<pid>` existing, check `State`.
- `pkill -f <pattern>`/`pgrep -f <pattern>` run through a shell match that shell's own command line (pgrep then
  reports a phantom process; pkill kills the shell). Use the PID from `jobs/worker.heartbeat`, or `pkill` without a shell.

## How Claude drives the notebook
No SSH or tunnel. Claude in Chrome on a JupyterLab tab opened from the dashboard. `javascript_tool` defines
`window.runPy(code)` (creates a kernel via `/api/kernels`, executes over the websocket, returns stdout), `sh(cmd)`
on top of it, `putFile(path, text)` (Contents API `PUT`, paths relative to `/workspace`), and `grab(jobId, name)`
(blob download of `/files/jobs/<id>/out.mp4` → `~/Downloads` → `mv` into `outputs/`). They vanish on page reload.
- Browser tool calls time out at ~45 s: run anything longer with `Popen` and poll the log.
- The tool shows only ~1 KB of output, and blocks results containing URLs with query strings or `?&=`-heavy text
  (signed download URLs in HF logs trigger this). Sanitize and summarize before returning.
- Upload code inside ``String.raw`...` `` so `\n` escapes survive, and avoid `${...}` in the payload (template
  interpolation). Verify every upload with md5 against `instance_scripts/`. Hand-copying base64 corrupted an image.

## LTX-2.5 history (2026-10-10, superseded)
- Worked: 640×384×49 t2v ~72–92 s (smoke.py) / 85 s per job via `worker.py` (FP8 storage, 27 s denoise); i2v via
  `LTX2ImageToVideoPipeline` 113 s per job, peak VRAM 27.9 GB. Samples: `outputs/t2v_ball_fp8.mp4`,
  `outputs/i2v_astronaut.mp4` (silent audio, cause unconfirmed).
- Costs: 77 GB download (~35 min; `redownload.py` skips `transformer_full`), peak RAM ~51/59 GB in `smoke.py`.
- `worker.py` host RAM grew on every t2v↔i2v switch (re-running `enable_model_cpu_offload()` over shared modules):
  20 → 36.8 → 45 GB, then the instance died mid-job (~19:15 UTC). Unfixed; don't revive `worker.py` without fixing it.
- LTX-specific helpers (no longer in `instance_scripts/`): `smoke.py`, `redownload.py`, `gemma_loader.py` (loads Gemma
  straight to GPU, +0.4 GB RAM), `worker.py`.

## Next steps
0. **Run the UI against the live instance:** refresh `relay/.env.local`, `npm run relay`,
   `VITE_GENERATION_PROVIDER=http npm run dev`; try text, image, and a Time Machine Snapshot. The worker runs
   the repo's `worker_k6.py` (PID 7582 since ~20:57 UTC; the old PID 6067 is a harmless zombie).
1. **Real-time demo tuning:** pick the live preset (640×352, 2–3 s, 6–10 steps), try 512×288 and 1–2 s clips,
   `pipe.transformer.compile_repeated_blocks(fullgraph=True)`, and expansion off/on. Pre-render backup clips.
2. **Time Machine:** campus photos in `public/places/` + `places.ts`; worker-side Film chaining (last frame → next
   shot, stitch with PyAV) and a `finalFrameUrl` for the before/after slider.
3. Decide the project angle — the model's odd physics (balls floating off tables, duplicating) could anchor a
   "what does the world model get wrong?" demo.
4. Optional: Kandinsky 6 VSR (super-resolution) needs flex attention + `torch.compile` — untested on ROCm.
5. Clean scratch files on `/workspace`. After the hackathon: revoke any HF token, destroy the instance.
