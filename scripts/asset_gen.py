"""모드 자산 만들기(3D미술관_재설계 §2-21): Tripo 구조를 공개 모델로 재구성.

① 글 → 그림: FLUX.1-schnell 공개 데모(Apache-2.0). 글에 흰 바탕을 넣는다.
② 배경 분리: 흰 바탕을 밝기로 지운다.
③ 형상·질감: TripoSR(MIT)을 이 맥에서 돌려 꼭짓점 색이 있는 메시를 만든다.
④ 출력: GLB + 원본 그림 + 출처 기록(JSON)을 _claude/자산생성/에 남긴다. 사람이 채택한 GLB만 web/public/museum/world/models/로 옮긴다(§2-23 H).

환경: ~/.cache/uam-asset-gen (TripoSR 커밋 107cefd 클론, venv, HF_HOME=hf). 설치 명령은 설계 §2-21.
사용: ~/.cache/uam-asset-gen/venv/bin/python scripts/asset_gen.py <이름> "<글>" [--seed 7] [--resolution 192]
보내는 것은 우리가 쓴 글뿐이다. 아이 그림은 넣지 않는다.
"""
import argparse
import datetime
import json
import os
import sys
import types
from pathlib import Path

GEN = Path.home() / ".cache/uam-asset-gen"
OUT = Path(__file__).resolve().parents[1] / "_claude/자산생성"  # 배포본(web/public) 밖. 채택한 GLB만 사람이 옮긴다
IMAGE_SPACE = "black-forest-labs/FLUX.1-schnell"
WHITE = 242  # ② 이 밝기 넘는 픽셀(세 채널 모두)을 바탕으로 본다


def text_to_image(prompt: str, seed: int):
    from gradio_client import Client
    from PIL import Image
    path, _ = Client(IMAGE_SPACE, verbose=False).predict(prompt, seed, False, 1024, 1024, 4, api_name="/infer")
    return Image.open(path).convert("RGB")


def cut_white(img):
    import numpy as np
    from PIL import Image
    a = np.asarray(img).astype(int)
    alpha = np.where(a.min(axis=2) > WHITE, 0, 255).astype("uint8")
    return Image.fromarray(np.dstack([a.astype("uint8"), alpha]), "RGBA")


def image_to_mesh(rgba, resolution: int):
    import numpy as np
    import torch
    from PIL import Image
    from skimage.measure import marching_cubes as sk_mc
    # TripoSR은 rembg·torchmcubes를 불러오지만 ②에서 배경을 지웠고, 메시 추출은 scikit-image로 대신한다(10/20 실험과 같다)
    sys.modules["rembg"] = types.ModuleType("rembg")
    tm = types.ModuleType("torchmcubes")
    def marching_cubes(vol, level):
        v, f, _, _ = sk_mc(vol.cpu().numpy(), level)
        return torch.from_numpy(v[:, [2, 1, 0]].copy()).float(), torch.from_numpy(f.astype(np.int64))
    tm.marching_cubes = marching_cubes
    sys.modules["torchmcubes"] = tm
    sys.path.insert(0, str(GEN / "TripoSR"))
    from tsr.system import TSR
    from tsr.utils import resize_foreground
    model = TSR.from_pretrained("stabilityai/TripoSR", config_name="config.yaml", weight_name="model.ckpt")
    model.renderer.set_chunk_size(8192)
    im = resize_foreground(rgba, 0.85)
    a = np.asarray(im).astype(np.float32) / 255
    a = a[:, :, :3] * a[:, :, 3:4] + (1 - a[:, :, 3:4]) * 0.5  # TripoSR 입력 규칙: 바탕은 회색 0.5
    with torch.no_grad():
        codes = model([Image.fromarray((a * 255).astype(np.uint8))], device="cpu")
        return model.extract_mesh(codes, True, resolution=resolution)[0]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("name")
    ap.add_argument("prompt")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--resolution", type=int, default=192)
    a = ap.parse_args()
    os.environ.setdefault("HF_HOME", str(GEN / "hf"))
    OUT.mkdir(parents=True, exist_ok=True)
    img = text_to_image(a.prompt, a.seed)
    img.save(OUT / f"{a.name}_source.png")
    mesh = image_to_mesh(cut_white(img), a.resolution)
    glb = OUT / f"{a.name}.glb"
    mesh.export(glb)
    log = {"name": a.name, "prompt": a.prompt, "seed": a.seed, "resolution": a.resolution, "made": datetime.date.today().isoformat(),
           "steps": [{"step": "글→그림", "model": "FLUX.1-schnell (Apache-2.0)", "where": IMAGE_SPACE},
                     {"step": "배경 분리", "rule": f"세 채널 모두 {WHITE} 초과 = 바탕"},
                     {"step": "형상·질감", "model": "TripoSR 107cefd (MIT), DINO ViT-B/16 (Apache-2.0)", "where": "이 맥 CPU"}],
           "faces": int(len(mesh.faces)), "bytes": glb.stat().st_size}
    (OUT / f"{a.name}.json").write_text(json.dumps(log, ensure_ascii=False, indent=2))
    print(json.dumps(log, ensure_ascii=False))


if __name__ == "__main__":
    main()
