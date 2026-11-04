"""자체 모델 own3 — M1·M5 자리(마스터플랜 3-6). `UAM_OWN_MODEL=M1,M5`일 때만 쓴다.

합성 그림과 Quick, Draw!(CC BY 4.0)로 시작 가중치 없이 학습한 모델을 TorchScript로 바꾼 파일이다. 추가 의존성이 없다.
한 번 실행하면 마스크와 앞면 깊이가 함께 나오므로 두 단계가 모델 하나를 나눠 쓴다. 값은 config/own3.yaml에서 읽는다.
후처리: 약한 문턱의 조각 중 강한 문턱 화소가 있는 조각만 남기고 틈을 닫는다. 구멍은 채우지 않는다(모델이 속을 찾는다).
"""
from __future__ import annotations

import hashlib
import io
import threading
from pathlib import Path

from common.config import load_manifest, load_settings, load_yaml
from common.cutout import cutout_image
from common.images import open_upright
from common.logging import get_logger

from .base import Adapter, AdapterResult, JobInput

_lock = threading.Lock()
_model = None
_sha = None


def _check_sha(sha: str, want: str) -> None:
    """이력에는 매니페스트 해시가 남는다. 파일이 다르면 결과가 다른 모델의 이력이 되므로 올리지 않는다."""
    if sha != want:
        get_logger().warning("model_load", load_state="failed", diagnostic="weights_sha_mismatch")
        raise RuntimeError("weights_sha_mismatch")


def shared_model(path: Path, want: str):
    """M1과 M5가 같은 가중치를 두 번 올리지 않게 한다. 읽은 내용을 비교하고 그 내용을 그대로 올린다."""
    global _model, _sha
    with _lock:
        if _model is None:
            import torch

            data = path.read_bytes()
            sha = hashlib.sha256(data).hexdigest()
            _check_sha(sha, want)
            _model, _sha = torch.jit.load(io.BytesIO(data), map_location="cpu").eval(), sha
        else:
            _check_sha(_sha, want)
        return _model


def predict(model, rgb, cfg: dict):
    """RGB 그림 → (마스크 확률, 앞면 깊이). 긴 변을 입력 크기로 줄이고 가장자리 색으로 여백을 채운다. 결과는 여백을 뺀 크기다."""
    import numpy as np
    import torch
    from PIL import Image

    size = cfg["input"]
    s = size / max(rgb.size)
    w, h = max(1, round(rgb.width * s)), max(1, round(rgb.height * s))
    small = rgb.resize((w, h), Image.BILINEAR)
    a = np.asarray(small)
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).mean(0).astype(np.uint8)
    canvas = Image.new("RGB", (size, size), tuple(int(v) for v in edge))
    ox, oy = (size - w) // 2, (size - h) // 2
    canvas.paste(small, (ox, oy))
    mean, std = np.array(cfg["mean"], np.float32), np.array(cfg["std"], np.float32)
    x = torch.from_numpy((np.asarray(canvas, np.float32) / 255 - mean) / std).permute(2, 0, 1)[None]
    with torch.inference_mode():
        out = torch.sigmoid(model(x)[0]).numpy()
    return out[cfg["mask_channel"]][oy:oy + h, ox:ox + w], out[cfg["front_channel"]][oy:oy + h, ox:ox + w]


def mask_from_prob(p, cfg: dict):
    """확률 지도 → 참거짓 마스크."""
    import numpy as np
    from scipy import ndimage

    lab, n = ndimage.label(p > cfg["low"])
    size = np.bincount(lab.ravel(), minlength=n + 1)
    strong = np.bincount(lab[p > cfg["high"]], minlength=n + 1)
    keep = np.nonzero((strong > 0) & (size >= p.size * cfg["min_piece_ratio"]))[0]
    m = np.isin(lab, keep[keep > 0])
    g = cfg["fill_gap"]
    if not g:
        return m
    st = ndimage.iterate_structure(ndimage.generate_binary_structure(2, 1), g)
    return ndimage.binary_closing(np.pad(m, g + 1), st)[g + 1:-g - 1, g + 1:-g - 1] | m


class _Own3(Adapter):
    device = "cpu"

    def __init__(self):
        super().__init__()
        self.cfg = load_yaml("own3")
        self.CONFIG = {"model": "own3", **self.cfg}
        self.path = load_settings().model_root / self.cfg["weights"]

    def load(self) -> None:
        if not self.path.exists():
            raise RuntimeError("weights_missing")
        want = ((load_manifest().get("models") or {}).get(self.model_id) or {}).get("weights_sha256")
        if not want:
            raise RuntimeError("weights_sha_missing")
        self.model = shared_model(self.path, want)


class Own3SplitAdapter(_Own3):
    model_id = "M1"

    def __init__(self):
        super().__init__()
        self.th = load_yaml("thresholds")["split"]

    def run(self, job: JobInput) -> AdapterResult:
        import numpy as np
        from PIL import Image

        try:
            img = open_upright(job.inputs.get("original"))
        except (OSError, TypeError):
            return AdapterResult("storage", diagnostic="input_unreadable")
        rgb = img.convert("RGB")
        p, _ = predict(self.model, rgb, self.cfg)
        if job.cancel.is_set():
            return AdapterResult("engine_down", diagnostic="cancelled_midway")
        small = Image.fromarray((mask_from_prob(p, self.cfg) * 255).astype(np.uint8), "L")
        mask = np.asarray(small.resize(rgb.size, Image.BILINEAR)) > 127
        ratio = float(mask.mean())
        if not (self.th["min_foreground_ratio"] <= ratio <= self.th["max_foreground_ratio"]):
            return AdapterResult("quality_below", downgrade_cause="split_fail", score=ratio, diagnostic="foreground_ratio")
        mask_img = Image.fromarray((mask * 255).astype(np.uint8), "L")
        mask_p, cut_p = job.tmp_dir / "mask.png", job.tmp_dir / "cutout.png"
        mask_img.save(mask_p)
        cutout_image(rgb, mask_img).save(cut_p)
        return AdapterResult("ok", score=ratio, outputs={"mask": str(mask_p), "cutout": str(cut_p)})


class Own3DepthAdapter(_Own3):
    model_id = "M5"

    def __init__(self):
        super().__init__()
        self.min_std = load_yaml("thresholds")["depth_relief"]["min_depth_std"]

    def run(self, job: JobInput) -> AdapterResult:
        import numpy as np
        from PIL import Image

        src = job.inputs.get("cutout")
        if src is None or not Path(src).exists():
            return AdapterResult("quality_below", diagnostic="no_cutout")   # 체인이 액자로 낮춘다
        try:
            rgba = Image.open(src).convert("RGBA")
            original = job.inputs.get("original")
            # 모델은 사진으로 배웠으므로 원본을 먼저 쓰고, 크기가 다르면 흰 바탕에 올린 컷아웃을 쓴다
            rgb = open_upright(original).convert("RGB") if original and Path(original).exists() else None
        except OSError:
            return AdapterResult("storage", diagnostic="input_unreadable")
        if rgb is None or rgb.size != rgba.size:
            rgb = Image.alpha_composite(Image.new("RGBA", rgba.size, (255, 255, 255, 255)), rgba).convert("RGB")
        _, front = predict(self.model, rgb, self.cfg)
        if job.cancel.is_set():
            return AdapterResult("engine_down", diagnostic="cancelled_midway")
        pred = np.asarray(Image.fromarray(front.astype(np.float32), "F").resize(rgb.size, Image.BILINEAR))
        mask = np.asarray(rgba.getchannel("A")) > 127
        if mask.sum() < 16:
            return AdapterResult("quality_below", diagnostic="empty_mask")
        vals = pred[mask]
        lo, hi = float(vals.min()), float(vals.max())
        norm = np.zeros_like(pred)
        if hi > lo:
            norm = (pred - lo) / (hi - lo)
        norm[~mask] = 0.0
        std255 = float((norm[mask] * 255).std())
        score = round(std255 / 255, 4)
        if std255 < self.min_std:
            return AdapterResult("quality_below", score=score, diagnostic="flat_depth")
        out = job.tmp_dir / "depth.png"
        Image.fromarray((norm * 65535).astype(np.uint16), mode="I;16").save(out)
        return AdapterResult("ok", score=score, outputs={"result_relief": str(out)})
