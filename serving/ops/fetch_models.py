"""모델 가중치 받기(SD_04 10-4·10-7) — 저장소에 넣지 않는 가중치를 MODEL_ROOT/hf에 한 번 받는다.

models/manifest.yaml의 출처·커밋으로 받고, 받은 가중치의 SHA-256이 매니페스트와 다르면 실패로 끝낸다.
  python -m ops.fetch_models [M1 M2 M5]
"""
from __future__ import annotations

import hashlib
import os
import sys
from pathlib import Path

from huggingface_hub import hf_hub_download, snapshot_download

from common.config import load_manifest, load_settings

# 어댑터가 읽는 파일과 같은 것만 받는다(serving/adapters/m1_birefnet.py·m2_openclip.py·m5_depth.py)
PLAN = {
    "M1": ("snapshot", ["*.py", "*.json", "*.txt", "model.safetensors"], "model.safetensors"),
    "M2": ("file", "open_clip_model.safetensors", "open_clip_model.safetensors"),
    "M5": ("snapshot", ["*.json", "*.safetensors"], "model.safetensors"),
}


def sha256(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def main(argv: list[str]) -> int:
    os.environ.pop("HF_HUB_OFFLINE", None)
    cache = load_settings().model_root / "hf"
    cache.mkdir(parents=True, exist_ok=True)
    models = load_manifest()["models"]
    bad = 0
    for mid in argv or list(PLAN):
        m = models[mid]
        kind, what, weights = PLAN[mid]
        if kind == "snapshot":
            d = Path(snapshot_download(m["source"], revision=m["revision"], cache_dir=str(cache), allow_patterns=what))
            f = d / weights
        else:
            f = Path(hf_hub_download(m["source"], what, revision=m["revision"], cache_dir=str(cache)))
        got = sha256(f.resolve())
        ok = got == m["weights_sha256"]
        bad += not ok
        print(f"{mid}: {'일치' if ok else '다름'} {got[:16]}… ({f.resolve().stat().st_size / 1e6:.0f}MB)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
