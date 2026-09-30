"""360° 파노라마(등장방형) → 큐브 6면 webp 두 벌 + manifest 갱신 (SD_04 §3-3 사진 자산, 2026-09-30).

새 의존성 없이 serving/.venv의 numpy·Pillow만 쓴다.

  serving/.venv/bin/python ops/museum/pano2cube.py <파노라마.jpg> --node grande-galerie-v1 \\
      --title "그랑드 갤러리" --source https://commons.wikimedia.org/wiki/File:... \\
      --author "작가" --license "CC BY-SA 4.0" --pos 0,0 [--out web/public/museum/photos] [--dry-run]

면 방향: 파노라마 가운데 = 정면 pz(+z), 오른쪽 px(+x), 위 py(+y), 뒤 nz, 왼쪽 nx, 아래 ny.
각 면은 그 면을 바깥에서가 아니라 안(관람자 자리)에서 본 모습이다.
예산: 1024판 6면 합 ≤ 900KB, 2048판 ≤ 3MB — 넘으면 webp 품질을 낮춰 다시 굽고, 품질 40에서도 넘으면 실패.
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image

FACES = ("px", "nx", "py", "ny", "pz", "nz")
BUDGET = {1024: 900 * 1024, 2048: 3 * 1024 * 1024}
LICENSE = re.compile(r"^(PD|CC0|CC BY( \d\.\d)?|CC BY-SA( \d\.\d)?)$")
NODE = re.compile(r"^[a-z0-9][a-z0-9-]{1,60}$")


def face_dirs(face: str, n: int) -> np.ndarray:
    """면 한 장의 픽셀마다 관람자 자리에서 나가는 방향 벡터(n×n×3)."""
    a = (np.arange(n) + 0.5) / n * 2 - 1          # -1..1, 왼→오
    u, v = np.meshgrid(a, a)                         # v: 위→아래
    one = np.ones_like(u)
    x, y, z = {
        "px": (one, -v, -u), "nx": (-one, -v, u),
        "py": (u, one, v), "ny": (u, -one, -v),
        "pz": (u, -v, one), "nz": (-u, -v, -one),
    }[face]
    return np.stack([x, y, z], axis=-1)


def sample(pano: np.ndarray, d: np.ndarray) -> np.ndarray:
    """방향 → 등장방형 좌표, 쌍선형 보간."""
    h, w = pano.shape[:2]
    x, y, z = d[..., 0], d[..., 1], d[..., 2]
    lon = np.arctan2(x, z)                           # 정면(+z) = 0
    lat = np.arctan2(y, np.hypot(x, z))
    fx = (lon / (2 * np.pi) + 0.5) * w - 0.5
    fy = (0.5 - lat / np.pi) * h - 0.5
    x0 = np.floor(fx).astype(int); y0 = np.floor(fy).astype(int)
    tx = (fx - x0)[..., None]; ty = (fy - y0)[..., None]
    x0w, x1w = x0 % w, (x0 + 1) % w                  # 경도는 둘러 이어진다
    y0c, y1c = np.clip(y0, 0, h - 1), np.clip(y0 + 1, 0, h - 1)
    p = pano.astype(np.float32)
    top = p[y0c, x0w] * (1 - tx) + p[y0c, x1w] * tx
    bot = p[y1c, x0w] * (1 - tx) + p[y1c, x1w] * tx
    return np.clip(top * (1 - ty) + bot * ty, 0, 255).astype(np.uint8)


def encode(faces: dict[str, Image.Image], budget: int) -> tuple[dict[str, bytes], int]:
    for q in (82, 76, 70, 64, 58, 52, 46, 40):
        out = {}
        for k, im in faces.items():
            b = io.BytesIO(); im.save(b, "WEBP", quality=q, method=6); out[k] = b.getvalue()
        total = sum(len(v) for v in out.values())
        if total <= budget:
            return out, q
    raise SystemExit(f"예산 초과: 품질 40에서도 {total}B > {budget}B — 원본을 줄이거나 예산을 설계서에서 바꾼다")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pano"); ap.add_argument("--node", required=True); ap.add_argument("--title", required=True)
    ap.add_argument("--source", required=True); ap.add_argument("--author", required=True); ap.add_argument("--license", required=True)
    ap.add_argument("--pos", required=True, help="걸음 전환 좌표 x,z"); ap.add_argument("--out", default="web/public/museum/photos")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    if not NODE.match(a.node): raise SystemExit("--node는 소문자·숫자·하이픈(바꿀 때는 이름에 -v2처럼 버전)")
    if not LICENSE.match(a.license): raise SystemExit(f"허용 밖 라이선스 {a.license!r} — PD·CC0·CC BY·CC BY-SA만(SD_04 §3-3)")
    if not a.source.startswith("https://"): raise SystemExit("--source는 원본 페이지 https URL")
    x, z = (float(v) for v in a.pos.split(","))
    img = Image.open(a.pano).convert("RGB")
    W, H = img.size
    if abs(W / H - 2) > 0.02: raise SystemExit(f"등장방형 파노라마는 가로:세로 2:1이어야 한다(지금 {W}×{H})")
    pano = np.asarray(img)
    out_dir = Path(a.out); node_dir = out_dir / a.node
    if node_dir.exists() and not a.dry_run: raise SystemExit(f"{node_dir} 가 이미 있다 — 사진을 바꾸면 노드 이름을 바꾼다(immutable 캐시)")
    sizes = {}
    for n in (1024, 2048):
        faces = {f: Image.fromarray(sample(pano, face_dirs(f, n))) for f in FACES}
        enc, q = encode(faces, BUDGET[n])
        sizes[n] = sum(len(v) for v in enc.values())
        print(f"{a.node} {n}판: 6면 {sizes[n]:,}B (예산 {BUDGET[n]:,}B, 품질 {q})")
        if not a.dry_run:
            (node_dir / str(n)).mkdir(parents=True, exist_ok=True)
            for f, b in enc.items(): (node_dir / str(n) / f"{f}.webp").write_bytes(b)
    if a.dry_run:
        print("--dry-run: 파일·manifest를 쓰지 않았다"); return 0
    mf = out_dir / "manifest.json"
    doc = json.loads(mf.read_text("utf-8")) if mf.exists() else {"nodes": []}
    doc["nodes"] = [n for n in doc.get("nodes", []) if n["id"] != a.node] + [{
        "id": a.node, "title": a.title, "source": a.source, "author": a.author, "license": a.license,
        "original": {"width": W, "height": H}, "position": {"x": x, "z": z}, "bytes": {"1024": sizes[1024], "2048": sizes[2048]}}]
    mf.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"manifest 갱신: {mf} (노드 {len(doc['nodes'])}개)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
