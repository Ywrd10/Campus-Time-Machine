#!/bin/bash
# One-time environment setup for Kandinsky 6 on a fresh Radeon Cloud instance. Run from a notebook cell:
#   !bash /workspace/k6_setup.sh 2>&1 | tail -20
# github.com is blocked by the egress proxy; codeload.github.com works. pip uses the platform's mirror.
set -e
python -c "import torch; print('torch', torch.__version__, 'hip', torch.version.hip, torch.cuda.get_device_name(0))"
# Kandinsky 6 landed in diffusers main on 2026-10-06; released wheels may not have it yet.
pip install -q "diffusers @ https://codeload.github.com/huggingface/diffusers/tar.gz/refs/heads/main"
# Don't let -U pull huggingface_hub 2.x: diffusers main requires <2.0.
pip install -q -U "transformers>=5" accelerate safetensors "huggingface_hub>=1.32,<2" av pillow
python - <<'EOF'
import diffusers, transformers
from diffusers import Kandinsky6TI2VAPipeline
print("diffusers", diffusers.__version__, "transformers", transformers.__version__, "Kandinsky6TI2VAPipeline OK")
EOF
cat /sys/fs/cgroup/memory.max /sys/fs/cgroup/memory.oom.group 2>/dev/null
df -h /workspace | tail -1
