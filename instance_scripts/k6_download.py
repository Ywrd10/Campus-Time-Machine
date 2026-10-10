# Downloads Kandinsky 6.0 Video Lite (distilled) to /workspace/k6lite and checks every shard is readable.
# Launch from a notebook so it survives the kernel:
#   subprocess.Popen(["python", "/workspace/k6_download.py"], start_new_session=True,
#                    stdout=open("/workspace/k6_download.log", "a"), stderr=subprocess.STDOUT)
import json, os, glob, sys
os.environ["HF_HOME"] = "/workspace/hf"
os.environ["HF_HUB_DISABLE_XET"] = "1"
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")  # huggingface.co is 503 through the egress proxy

from huggingface_hub import snapshot_download
from safetensors import safe_open

R = os.environ.get("REPO", "kandinskylab/Kandinsky-6.0-Lite-distill-5s-Diffusers")
DEST = os.environ.get("DEST", "/workspace/k6lite")

# The mirror throws read timeouts on big files; snapshot_download resumes partial files on retry.
for attempt in range(1, 9):
    try:
        snapshot_download(R, local_dir=DEST, max_workers=8)
        break
    except Exception as e:
        print(f"attempt {attempt} failed: {e!r}", flush=True)
else:
    sys.exit("download failed 8 times")

bad = []
for index in glob.glob(f"{DEST}/*/*.safetensors.index.json"):
    folder = os.path.dirname(index)
    for f in set(json.load(open(index))["weight_map"].values()):
        if not os.path.exists(os.path.join(folder, f)):
            bad.append((os.path.join(folder, f), "missing"))
for p in sorted(glob.glob(f"{DEST}/*/*.safetensors")):
    try:
        with safe_open(p, framework="pt") as fh:
            fh.keys()
    except Exception as e:
        bad.append((p, repr(e)))

os.system(f"du -sh {DEST}/*; du -sh {DEST}; df -h /workspace")
if bad:
    print("PROBLEM FILES:", *bad, sep="\n")
else:
    print("DONE - all shards present and readable")
