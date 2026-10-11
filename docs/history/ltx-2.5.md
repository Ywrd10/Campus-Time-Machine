# LTX-2.5 on the AMD instance (2026-10-10, superseded)

The project started on Lightricks LTX-2.5 and switched to Kandinsky 6.0 Video Lite at ~19:30 UTC on 2026-10-10,
after LTX's host-RAM use killed two instances (see the cgroup gotchas in `AGENTS.md`). None of the LTX scripts
are in this repo any more.

- Worked: 640×384×49 t2v ~72–92 s (smoke.py) / 85 s per job via `worker.py` (FP8 storage, 27 s denoise); i2v via
  `LTX2ImageToVideoPipeline` 113 s per job, peak VRAM 27.9 GB. Samples: `outputs/t2v_ball_fp8.mp4`,
  `outputs/i2v_astronaut.mp4` (silent audio, cause unconfirmed).
- Costs: 77 GB download (~35 min; `redownload.py` skips `transformer_full`), peak RAM ~51/59 GB in `smoke.py`.
- `worker.py` host RAM grew on every t2v↔i2v switch (re-running `enable_model_cpu_offload()` over shared modules):
  20 → 36.8 → 45 GB, then the instance died mid-job (~19:15 UTC). Unfixed; don't revive `worker.py` without fixing it.
- LTX-specific helpers (no longer in `instance_scripts/`): `smoke.py`, `redownload.py`, `gemma_loader.py` (loads Gemma
  straight to GPU, +0.4 GB RAM), `worker.py`.
