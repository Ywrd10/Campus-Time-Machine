# Queues a Kandinsky 6 speed/quality sweep through worker_k6.py (uses the request "bench" overrides).
# Same prompt and seed everywhere, prompt expansion off, so only the swept parameter changes between clips.
#   python /workspace/k6_sweep_submit.py            -> jobs/sweep_<w>x<h>_f<frames>_s<steps>/
import json, os, time

PROMPT = ("A red ball rolls off a wooden table and bounces across a tiled kitchen floor, "
          "warm morning light through a window, the soft thud of each bounce.")
# (width, height, frames, steps): ordered fastest-expected first so early results arrive quickly.
GRID = [
    (640, 352, 49, 10),
    (864, 480, 49, 10),
    (640, 352, 73, 10),
    (640, 352, 73, 6),
    (640, 352, 73, 4),
    (864, 480, 73, 10),
    (864, 480, 73, 6),
    (640, 352, 121, 10),
]

for w, h, frames, steps in GRID:
    d = f"/workspace/jobs/sweep_{w}x{h}_f{frames}_s{steps}"
    os.makedirs(d, exist_ok=True)
    req = {"mode": "text", "prompt": PROMPT, "width": 1280, "height": 720, "fps": 24, "durationSeconds": 5,
           "seed": 42, "bench": {"size": [w, h], "frames": frames, "steps": steps, "enhance": False}}
    with open(d + "/request.json.tmp", "w") as f:
        json.dump(req, f)
    os.replace(d + "/request.json.tmp", d + "/request.json")
    time.sleep(0.05)  # distinct mtimes keep the worker's FIFO order
    print("queued", os.path.basename(d))
