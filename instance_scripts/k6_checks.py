# ROCm sanity checks for Kandinsky 6 before trusting worker_k6.py output. Each stage prints one verdict line.
#   python /workspace/k6_checks.py sdpa     # raw SDPA kernels vs fp32 reference at video-sized sequence lengths
#   python /workspace/k6_checks.py te       # Qwen2.5-VL + CLIP prompt embeddings: eager vs sdpa (Gemma 4 was wrong with sdpa)
#   python /workspace/k6_checks.py dit      # tiny generation: transformer on native SDPA vs math backend, same seed
# Run stages one at a time with Popen + a log file; `te` and `dit` load the pipeline (~27 GB weights, mmap'd).
import os, sys, time, threading, contextlib
os.environ["HF_HOME"] = "/workspace/hf"
import torch
import torch.nn.functional as F

ROOT = os.environ.get("ROOT", "/workspace/k6lite")
RAM_LIMIT = int(open("/sys/fs/cgroup/memory.max").read()) / 1e9

def anon():
    return int(dict(l.split() for l in open("/sys/fs/cgroup/memory.stat"))["anon"]) / 1e9
def log(*a):
    print(f"[{time.strftime('%H:%M:%S')}] ram {anon():.1f}G vram {torch.cuda.memory_allocated()/1e9:.1f}G |", *a, flush=True)
def watchdog():
    # memory.oom.group=1: hitting the cgroup limit kills Jupyter too. Bail out early instead.
    while True:
        if anon() > RAM_LIMIT - 5:
            print("[watchdog] RAM near cgroup limit; exiting", flush=True); os._exit(3)
        time.sleep(0.05)
threading.Thread(target=watchdog, daemon=True).start()

def cos(a, b):
    a, b = a.float().flatten(), b.float().flatten()
    return F.cosine_similarity(a, b, dim=0).item()

def ref_attention(q, k, v, chunk=1024):
    # fp32 softmax(QK^T/sqrt(d))V, chunked over queries so memory stays bounded.
    out = torch.empty_like(q, dtype=torch.float32)
    scale = q.shape[-1] ** -0.5
    kf, vf = k.float(), v.float()
    for i in range(0, q.shape[2], chunk):
        s = (q[:, :, i:i + chunk].float() @ kf.transpose(-1, -2)) * scale
        out[:, :, i:i + chunk] = s.softmax(-1) @ vf
    return out

def stage_sdpa():
    from torch.nn.attention import sdpa_kernel, SDPBackend
    # ~50k tokens is a full 864x480x121 clip; time that one only on the default path.
    for n, d in [(4096, 64), (4096, 128), (16384, 128), (50000, 128)]:
        g = torch.Generator("cuda").manual_seed(0)
        q, k, v = (torch.randn(1, 16, n, d, device="cuda", dtype=torch.bfloat16, generator=g) for _ in range(3))
        ref = ref_attention(q, k, v) if n <= 16384 else None
        for name, backends in [("default", None), ("flash", [SDPBackend.FLASH_ATTENTION]),
                               ("efficient", [SDPBackend.EFFICIENT_ATTENTION])]:
            if n == 50000 and name != "default":
                continue
            try:
                torch.cuda.synchronize(); torch.cuda.reset_peak_memory_stats()
                ctx = sdpa_kernel(backends) if backends else contextlib.nullcontext()
                with ctx:
                    F.scaled_dot_product_attention(q, k, v)  # warmup
                    torch.cuda.synchronize(); t = time.time()
                    out = F.scaled_dot_product_attention(q, k, v)
                    torch.cuda.synchronize(); dt = time.time() - t
                err = f"cos {cos(out, ref):.6f} maxabs {(out.float() - ref).abs().max().item():.4f}" if ref is not None else "no ref"
                log(f"SDPA n={n} d={d} {name:9s} {dt*1000:8.1f} ms  peak {torch.cuda.max_memory_allocated()/1e9:5.1f}G  {err}")
            except Exception as e:
                log(f"SDPA n={n} d={d} {name:9s} FAILED {type(e).__name__}: {str(e)[:120]}")
        del q, k, v, ref
        torch.cuda.empty_cache()
    log("VERDICT sdpa: need cos > 0.999 on every working backend, and the n=50000 default run must not OOM")

def load_pipe():
    from diffusers import Kandinsky6TI2VAPipeline
    t = time.time()
    pipe = Kandinsky6TI2VAPipeline.from_pretrained(ROOT, torch_dtype=torch.bfloat16)
    log(f"pipeline loaded in {time.time()-t:.0f}s")
    return pipe

PROMPT = ("A red ball rolls off a wooden table and bounces across a tiled kitchen floor, "
          "warm morning light through a window, the soft thud of each bounce.")

def stage_te():
    pipe = load_pipe()
    pipe.text_encoder.to("cuda"); pipe.text_encoder_2.to("cuda")
    log("text encoders on GPU")
    outs = {}
    for impl in ("eager", "sdpa"):
        pipe.text_encoder.set_attn_implementation(impl)
        with torch.no_grad():
            res = pipe.encode_prompt(PROMPT, do_classifier_free_guidance=False,
                                     device=torch.device("cuda"), dtype=torch.bfloat16)
        outs[impl] = [r for r in (res if isinstance(res, (tuple, list)) else [res]) if torch.is_tensor(r)]
        log(impl, "->", [tuple(r.shape) for r in outs[impl]])
    worst = min(cos(a, b) for a, b in zip(outs["eager"], outs["sdpa"]) if a.is_floating_point())
    log(f"VERDICT te: eager-vs-sdpa worst cosine {worst:.6f} ({'sdpa OK' if worst > 0.999 else 'KEEP TE_ATTN=eager'})")

def stage_dit():
    pipe = load_pipe()
    pipe.text_encoder.set_attn_implementation("eager")
    pipe.to("cuda")
    log("pipeline on GPU")
    kw = dict(prompt=PROMPT, height=256, width=448, num_frames=25, num_inference_steps=int(os.environ.get("STEPS", 10)),
              guidance_scale=1.0, output_type="latent", sample_audio=True)
    outs = {}
    for backend in ("native", "_native_math"):
        pipe.transformer.set_attention_backend(backend)
        t = time.time()
        with torch.no_grad():
            r = pipe(generator=torch.Generator("cuda").manual_seed(0), **kw)
        outs[backend] = (r.frames, r.audio)
        log(f"{backend}: {time.time()-t:.1f}s, video latents {tuple(r.frames.shape)}")
    cv = cos(outs["native"][0], outs["_native_math"][0])
    ca = cos(outs["native"][1], outs["_native_math"][1]) if outs["native"][1] is not None else float("nan")
    log(f"VERDICT dit: native-vs-math cosine video {cv:.5f} audio {ca:.5f} ({'native OK' if min(cv, ca) > 0.99 else 'INVESTIGATE'})")

if __name__ == "__main__":
    log(torch.cuda.get_device_name(0), "torch", torch.__version__)
    {"sdpa": stage_sdpa, "te": stage_te, "dit": stage_dit}[sys.argv[1]]()
