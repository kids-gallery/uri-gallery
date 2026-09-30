"""predict.py — 1팀 우리 아이 미술관 · 그림 종류 판정(M2 OpenCLIP)의 «한 건 판단» 진입점.

우리 서빙의 M2 어댑터(serving/adapters/m2_openclip.py)와 같은 가중치·같은 프롬프트로, 한 건 단위 함수로 연다.

    from predict import predict
    predict({"image_base64": "<PNG base64>"})
    → {"label": "사람 그림", "warnings": [], "model_version": "M2-1a25a44-u4"}

모델은 _load() 에서 한 번만 읽는다(전역 _MODEL, 해설 7쪽). 요청 경로에는 적재가 없다.
최고 확률이 TAU(settings.tau) 미만이면 «판단보류» — 오류가 아니라 200 이다. 점수는 밖으로 내지 않는다(BR-SUG-02).
입력 문제는 ValueError → app.py 가 422 로 바꾼다.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import os
from pathlib import Path

import yaml
from PIL import Image

from settings import settings

HERE = Path(__file__).resolve().parent
MODEL_DIR = HERE / settings.model_dir
KIND_LABEL = {"person": "사람 그림", "animal": "동물 그림", "house": "집 그림", "object": "사물 그림"}

_MODEL = None


def _load():
    """가중치 지문을 확인하고 한 번만 올린다. 두 번째부터는 담아 둔 것을 돌려준다."""
    global _MODEL
    if _MODEL is not None:
        return _MODEL
    os.environ.setdefault("HF_HUB_OFFLINE", "1")                      # 받아 둔 캐시만 — 요청 중 내려받기 없음
    import open_clip
    import torch
    from huggingface_hub import hf_hub_download
    from safetensors.torch import load_file

    w = json.loads((MODEL_DIR / "weights.json").read_text("utf-8"))
    path = hf_hub_download(w["hf_repo"], w["file"], revision=w["revision"], cache_dir=settings.hf_cache)
    h = hashlib.sha256(Path(path).read_bytes()).hexdigest()
    if h != w["weights_sha256"]:
        raise RuntimeError("가중치 지문이 model/weights.json 과 다르다")   # 서버 문제 → 기동 실패(조용히 틀린 값 금지)
    prompts = yaml.safe_load((MODEL_DIR / "m2_prompts.yaml").read_text("utf-8"))
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model, _, preprocess = open_clip.create_model_and_transforms("ViT-B-32", pretrained=None)
    model.load_state_dict(load_file(path), strict=True)               # pickle(.bin) 대신 safetensors(서빙과 같다)
    model.to(device).eval()
    kinds = list(prompts["kinds"])
    tok = open_clip.get_tokenizer("ViT-B-32")
    with torch.inference_mode():
        k = model.encode_text(tok([prompts["kinds"][x] for x in kinds]).to(device))
    _MODEL = {"model": model, "preprocess": preprocess, "device": device, "kinds": kinds,
              "k_emb": k / k.norm(dim=-1, keepdim=True)}
    return _MODEL


def warmup() -> None:
    """lifespan 에서 한 번 — 적재 + 추론 한 번(첫 요청이 느리지 않게, 해설 7쪽)."""
    m = _load()
    _probs(m, Image.new("RGB", (224, 224), "white"))


def _probs(m, img: Image.Image):
    import torch
    with torch.inference_mode():
        f = m["model"].encode_image(m["preprocess"](img).unsqueeze(0).to(m["device"]))
        f = f / f.norm(dim=-1, keepdim=True)
        return (m["model"].logit_scale.exp() * f @ m["k_emb"].T).softmax(dim=-1)[0].cpu()


def predict(payload: dict) -> dict:
    m = _load()                                                        # 재사용 — 적재는 한 번뿐
    try:
        img = Image.open(io.BytesIO(base64.b64decode(payload["image_base64"]))).convert("RGB")
    except Exception:
        raise ValueError("이미지를 열 수 없습니다 — 깨지지 않은 PNG·JPEG 파일을 보내 주세요")
    if min(img.size) < settings.min_side_px:
        raise ValueError(f"이미지가 너무 작습니다({img.size[0]}×{img.size[1]}px) — 짧은 변이 {settings.min_side_px}px 이상이어야 합니다")
    p = _probs(m, img)
    top = float(p.max())
    kind = m["kinds"][int(p.argmax())]
    if top < settings.tau:                                             # TAU=0.5 근거: settings.py 주석 · MS04 §3
        return {"label": "판단보류", "warnings": [f"확신이 낮아 판단을 미룹니다(가장 가까운 것: {KIND_LABEL[kind]})"],
                "model_version": settings.model_version}
    return {"label": KIND_LABEL[kind], "warnings": [], "model_version": settings.model_version}
