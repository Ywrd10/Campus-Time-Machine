# Long-lived Kandinsky 6.0 Video Lite (distilled) job worker. Drop-in replacement for worker.py (LTX-2.5): same
# file queue, same status.json contract, so relay/server.mjs doesn't change.
# Watches /workspace/jobs/<id>/request.json (written last by the relay), runs jobs FIFO one at a time,
# and writes status.json atomically: {status, progress, error?, output?}.
# Launch once from a notebook:
#   subprocess.Popen(["python", "/workspace/worker_k6.py"], start_new_session=True,
#                    stdout=open("/workspace/jobs/worker.log", "a"), stderr=subprocess.STDOUT)
#
# Unlike LTX, all weights (~27 GB) fit on the 48 GB GPU at once, so the whole pipeline stays resident: no CPU
# offload (whose host-RAM copies are what killed two instances), no per-job model reloads, and one pipeline for
# both text- and image-to-video. OFFLOAD=1 falls back to enable_model_cpu_offload() if VRAM turns out too tight
# (~27 GB host RAM, still well under the 59 GB cgroup limit).
import os, time, gc, json, shutil, threading, traceback, random
os.environ["HF_HOME"] = "/workspace/hf"
import numpy as np
import torch
from diffusers import Kandinsky6TI2VAPipeline
from diffusers.utils import encode_video

ROOT = os.environ.get("ROOT", "/workspace/k6lite")
JOBS = os.environ.get("JOBS", "/workspace/jobs")
ENHANCE = os.environ.get("ENHANCE", "1") == "1"  # Qwen2.5-VL prompt expansion; reuses the text encoder
OFFLOAD = os.environ.get("OFFLOAD", "0") == "1"
STEPS = int(os.environ.get("STEPS", 10))  # model card: 10; pipeline docstring: 16. Benchmark both.
MAX_FRAMES = int(os.environ.get("MAX_FRAMES", 121))  # 4k+1; 121 = the 5 s the model was trained on
TE_ATTN = os.environ.get("TE_ATTN", "eager")  # SDPA was silently wrong for Gemma 4 here; k6_checks.py te decides
JOB_TTL = float(os.environ.get("JOB_TTL_HOURS", 6)) * 3600
# Native Kandinsky 6 SD sizes (divisible by 16).
SIZES = {"16:9": (864, 480), "9:16": (480, 864), "1:1": (512, 512)}

def anon():
    return int(dict(l.split() for l in open("/sys/fs/cgroup/memory.stat"))["anon"]) / 1e9
def log(*a):
    print(f"[{time.strftime('%H:%M:%S')}] ram {anon():.1f}G vram {torch.cuda.memory_allocated()/1e9:.1f}G |", *a, flush=True)

def write_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f)
    os.replace(tmp, path)

# memory.oom.group=1 on this container: if the cgroup OOM killer fires, it kills *every* process, Jupyter
# included, and the instance is lost. Best-effort guard only: one big allocation can jump past the margin
# between polls, which is why this worker avoids CPU offload in the first place.
RAM_LIMIT = int(open("/sys/fs/cgroup/memory.max").read()) / 1e9
RAM_ABORT = float(os.environ.get("RAM_ABORT_GB", RAM_LIMIT - 5))

def watchdog():
    while True:
        used = anon()
        if used > RAM_ABORT:
            print(f"[watchdog] anon RAM {used:.1f}G > {RAM_ABORT:.1f}G (limit {RAM_LIMIT:.1f}G); exiting to protect Jupyter", flush=True)
            os._exit(3)
        time.sleep(0.05)

def heartbeat():
    while True:
        write_json(os.path.join(JOBS, "worker.heartbeat"), {"time": time.time(), "pid": os.getpid()})
        time.sleep(10)

# --- pipeline (resident) ---------------------------------------------------------------------------
t0 = time.time()
os.makedirs(JOBS, exist_ok=True)
threading.Thread(target=watchdog, daemon=True).start()
pipe = Kandinsky6TI2VAPipeline.from_pretrained(ROOT, torch_dtype=torch.bfloat16)
pipe.text_encoder.set_attn_implementation(TE_ATTN)
if OFFLOAD:
    pipe.enable_model_cpu_offload()
else:
    # Module by module so a failure points at the component that didn't fit.
    for name, module in pipe.components.items():
        if isinstance(module, torch.nn.Module):
            module.to("cuda")
            log(f"{name} on GPU")
# Untiled decode of a full 864x480x121 clip tried to allocate 24 GiB on top of the resident pipeline and OOM'd.
if os.environ.get("VAE_TILING", "1") == "1":
    pipe.vae.enable_tiling()
# The video VAE's attention uses a causal mask, and on this ROCm stack the memory-efficient SDPA kernel returns
# NaNs with masks (78% NaN frames, shown as black tiles). Force the math kernel for VAE encode/decode only; tiles
# are small, so it costs ~3 s per clip. The transformer's attention checked fine (k6_checks.py dit).
from torch.nn.attention import sdpa_kernel, SDPBackend
def _math_sdpa(fn):
    def wrapped(*args, **kwargs):
        with sdpa_kernel([SDPBackend.MATH]):
            return fn(*args, **kwargs)
    return wrapped
pipe.vae.decode = _math_sdpa(pipe.vae.decode)
pipe.vae.encode = _math_sdpa(pipe.vae.encode)
gc.collect()
SAMPLE_RATE = pipe.audio_sample_rate
threading.Thread(target=heartbeat, daemon=True).start()  # only advertise online once the model is ready
log(f"pipeline loaded in {time.time()-t0:.0f}s (offload={OFFLOAD}, steps={STEPS}, max_frames={MAX_FRAMES}, te_attn={TE_ATTN})")

class UserError(Exception):
    pass

def frames_for(fps, seconds):
    need = max(1, round(fps * seconds))
    return min(MAX_FRAMES, 4 * -(-(need - 1) // 4) + 1)

@torch.no_grad()
def expand(prompt, image, seed):
    out = pipe.expand_prompts(prompt, pipe.tokenizer, pipe.text_encoder, torch.device("cuda"), image=image,
                              generator=torch.Generator("cuda").manual_seed(seed))
    out = out[0] if isinstance(out, (list, tuple)) else out
    return out if out and out.strip() else prompt

def run(job_dir, req, status):
    mode = req.get("mode")
    if mode == "audio":
        raise UserError("Audio-to-video isn't available on this backend yet.")
    if mode not in ("text", "image"):
        raise UserError(f"Unknown mode: {mode!r}")
    prompt = (req.get("prompt") or "").strip()
    # Trained at 23-25 fps; other rates would mean more frames than the model handles, so generate at 24.
    fps = float(req.get("fps") or 24)
    fps = int(fps) if fps.is_integer() and 23 <= fps <= 25 else 24
    w, h = SIZES["9:16" if int(req.get("height", 0)) > int(req.get("width", 0)) else "16:9"]
    frames = frames_for(fps, float(req.get("durationSeconds") or 5))
    seed = int(req.get("seed", random.randrange(2**31)))
    # Exact size/steps. The relay sets these from the frontend's tested presets; hand-written jobs can too.
    bench = req.get("bench") or {}
    if "size" in bench:
        w, h = (int(x) // 16 * 16 for x in bench["size"])
    if "frames" in bench:
        frames = min(MAX_FRAMES, (int(bench["frames"]) - 1) // 4 * 4 + 1)
    steps = int(bench.get("steps", STEPS))
    enhance = bool(bench.get("enhance", ENHANCE))
    image = None
    if mode == "image":
        from PIL import Image
        if req.get("finalFrame"):
            raise UserError("Final-frame conditioning isn't available on this backend yet. Remove the final frame and try again.")
        image = Image.open(os.path.join(job_dir, req["image"])).convert("RGB")  # pipeline resizes + center-crops
        if not prompt:
            prompt = "The scene comes to life with natural, smooth motion."

    status(progress=2)
    t = time.time()
    if enhance:
        prompt = expand(prompt, image, seed)
        log(f"expanded in {time.time()-t:.0f}s:", prompt[:200])
    status(progress=10)
    log(f"generating {w}x{h}x{frames} @ {fps}fps seed {seed} steps {steps}")

    def on_step(_p, i, _t, kw):
        status(progress=min(90, 10 + round(80 * (i + 1) / steps)))
        return kw
    torch.cuda.reset_peak_memory_stats()
    t = time.time()
    with torch.no_grad():
        result = pipe(
            prompt=prompt, image=image, height=h, width=w, num_frames=frames, frame_rate=fps,
            num_inference_steps=steps, guidance_scale=1.0, expand_prompts=False, sample_audio=True,
            generator=torch.Generator("cuda").manual_seed(seed),
            output_type="np", callback_on_step_end=on_step,
        )
    gen_s = time.time() - t
    log(f"generated in {gen_s:.0f}s, peak vram {torch.cuda.max_memory_allocated()/1e9:.1f}G")
    status(progress=92)
    # output_type="np" gives float frames in [0, 1]; this diffusers' encode_video needs uint8.
    clip = (np.clip(result.frames[0], 0, 1) * 255).round().astype(np.uint8)
    audio = torch.as_tensor(result.audio[0]).float().cpu()[None]  # (1, samples) as in the diffusers example
    out = os.path.join(job_dir, "out.mp4")
    try:
        encode_video(clip, fps=fps, output_path=out, audio=audio, audio_sample_rate=SAMPLE_RATE)
    except Exception:
        # Keep a finished generation even if export breaks; re-encode by hand from these.
        np.save(os.path.join(job_dir, "frames.npy"), clip); torch.save(audio, os.path.join(job_dir, "audio.pt"))
        raise
    n, oh, ow = clip.shape[0], clip.shape[1], clip.shape[2]
    return {"filename": "out.mp4", "mimeType": "video/mp4", "width": int(ow), "height": int(oh),
            "fps": fps, "durationSeconds": round(n / fps, 3), "seed": seed, "prompt": prompt,
            "steps": steps, "generateSeconds": round(gen_s, 1),
            "peakVramGB": round(torch.cuda.max_memory_allocated() / 1e9, 1)}

def next_job():
    ready = []
    for name in os.listdir(JOBS):
        d = os.path.join(JOBS, name)
        rq = os.path.join(d, "request.json")
        if os.path.isfile(rq) and not os.path.exists(os.path.join(d, "status.json")):
            ready.append((os.path.getmtime(rq), d))
    return min(ready)[1] if ready else None

def cleanup():
    now = time.time()
    for name in os.listdir(JOBS):
        d = os.path.join(JOBS, name)
        if os.path.isdir(d) and now - os.path.getmtime(d) > JOB_TTL:
            shutil.rmtree(d, ignore_errors=True)

def recover():
    # A job left "processing" means the previous worker died mid-run.
    for name in os.listdir(JOBS):
        sp = os.path.join(JOBS, name, "status.json")
        try:
            if json.load(open(sp)).get("status") == "processing":
                write_json(sp, {"status": "failed", "progress": 0, "error": "The GPU worker restarted during this job. Try again."})
        except (OSError, ValueError):
            pass

def main():
    recover()
    last_clean = 0
    while True:
        if time.time() - last_clean > 600:
            cleanup(); last_clean = time.time()
        d = next_job()
        if d is None:
            time.sleep(1); continue
        sp = os.path.join(d, "status.json")
        state = {"status": "processing", "progress": 0}
        def status(**kw):
            state.update(kw); write_json(sp, state)
        status()
        t = time.time()
        try:
            req = json.load(open(os.path.join(d, "request.json")))
            log("job", os.path.basename(d), req.get("mode"), repr((req.get("prompt") or "")[:80]), f"| abort at {RAM_ABORT:.1f}G")
            output = run(d, req, status)
            status(status="completed", progress=100, output=output)
            log(f"job done in {time.time()-t:.0f}s")
        except UserError as e:
            status(status="failed", error=str(e))
        except torch.OutOfMemoryError:
            log("OOM\n" + traceback.format_exc())
            status(status="failed", error="The GPU ran out of memory for this job. Try a shorter clip.")
        except Exception as e:
            log("ERROR\n" + traceback.format_exc())
            status(status="failed", error=f"Generation failed: {type(e).__name__}: {str(e)[:300]}")
        finally:
            gc.collect(); torch.cuda.empty_cache()

if __name__ == "__main__":
    main()
