"""한 점 투시 사진 → Tour Into the Picture 3D 상자 5면 조각 webp 두 벌 + manifest 갱신 (SD_04 §3-3 사진 자산, kind "tip").

세션2(docs/C/louvre-walk/tip.py, 2026-09-30)의 변환을 그대로 옮기고, 상수를 인자로·두 벌(desktop·mobile)·예산·manifest를 더했다.
새 의존성 없이 serving/.venv의 numpy·Pillow만 쓴다.

  serving/.venv/bin/python ops/museum/tip2faces.py <사진.jpg> --node grande-galerie-v1 \\
      --title "Intérieur de la Grande Galerie du Louvre" \\
      --source https://commons.wikimedia.org/wiki/File:Int%C3%A9rieur_de_la_Grande_Galerie_du_Louvre.jpg \\
      --author Touzania18 --license "CC BY-SA 4.0" [--camera 1468,1896,5780] [--box -5.4,4.4,1.5,-6.3,150] \\
      [--cuts 8,12,18,26,38,56,85,150] [--out web/public/museum/photos] [--dry-run]

카메라: 사진 찍은 자리(원점), -z 방향을 봄. 1m = 100 CSS px. 사진 좌표 x = VX + F*X/Z, y = VY + F*Y/Z (Y 아래가 +).
각 면은 깊이 구간으로 잘라(큰 평면은 GPU 텍스처 한도 초과) 구간마다 알맞은 해상도(px/m = min(CAP, F/z0))로 뽑는다.
두 벌: desktop CAP 200 · mobile CAP 110. 예산(노드 합계): desktop ≤ 2MB · mobile ≤ 900KB — 넘으면 webp 품질을 낮추고, 40에서도 넘으면 실패.
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

VARIANTS = {"desktop": (200, 2 * 1024 * 1024), "mobile": (110, 900 * 1024)}   # CAP px/m · 예산 B
LICENSE = re.compile(r"^(PD|CC0|CC BY( \d\.\d)?|CC BY-SA( \d\.\d)?)$")
NODE = re.compile(r"^[a-z0-9][a-z0-9-]{1,60}$")


def floats(s: str, n: int | None = None) -> list[float]:
    v = [float(x) for x in s.split(",")]
    if n is not None and len(v) != n:
        raise SystemExit(f"값 {n}개가 필요하다: {s}")
    return v


def build(im: np.ndarray, cam, box, cuts, cap: int) -> list[dict]:
    """세션2 tip.py의 면 생성 — 조각마다 RGBA 배열과 CSS 배치를 돌려준다."""
    H, W = im.shape[:2]
    VX, VY, F = cam
    XL, XR, YF, YC, ZB = box

    def sample(xs, ys):
        """이중선형 표본 + 사진 밖은 투명"""
        inside = (xs >= 0) & (xs <= W - 1) & (ys >= 0) & (ys <= H - 1)
        x = np.clip(xs, 0, W - 1.001); y = np.clip(ys, 0, H - 1.001)
        x0 = x.astype(int); y0 = y.astype(int); dx = (x - x0)[..., None]; dy = (y - y0)[..., None]
        c = im[y0, x0] * (1 - dx) * (1 - dy) + im[y0, x0 + 1] * dx * (1 - dy) + im[y0 + 1, x0] * (1 - dx) * dy + im[y0 + 1, x0 + 1] * dx * dy
        a = inside.astype(np.float32)[..., None] * 255
        return np.concatenate([c, a], -1).clip(0, 255).astype(np.uint8)

    out: list[dict] = []

    def emit(name, pts_fn, w_m, h_m, z0, css):
        dens = min(cap, F / z0)
        pw, ph = max(8, int(w_m * dens)), max(8, int(h_m * dens))
        u = (np.arange(pw) + .5) / pw; v = (np.arange(ph) + .5) / ph
        U, V = np.meshgrid(u, v)
        X, Y, Z = pts_fn(U, V)
        rgba = sample(VX + F * X / Z, VY + F * Y / Z)
        out.append({"name": name, "rgba": rgba, "w": round(w_m * 100), "h": round(h_m * 100), "tf": css,
                    "empty": rgba[..., 3].max() == 0})

    for z0, z1 in zip(cuts, cuts[1:]):
        d = z1 - z0; zc = (z0 + z1) / 2
        emit(f"floor_{int(z0)}", lambda U, V: (XL + U * (XR - XL), np.full_like(U, YF), z1 - V * d), XR - XL, d, z0,
             f"translate3d({(XL+XR)/2*100:.0f}px,{YF*100:.0f}px,{-zc*100:.0f}px) rotateX(90deg)")
        emit(f"ceil_{int(z0)}", lambda U, V: (XL + U * (XR - XL), np.full_like(U, YC), z0 + V * d), XR - XL, d, z0,
             f"translate3d({(XL+XR)/2*100:.0f}px,{YC*100:.0f}px,{-zc*100:.0f}px) rotateX(-90deg)")
        emit(f"wallL_{int(z0)}", lambda U, V: (np.full_like(U, XL), YC + V * (YF - YC), z0 + U * d), d, YF - YC, z0,
             f"translate3d({XL*100:.0f}px,{(YC+YF)/2*100:.0f}px,{-zc*100:.0f}px) rotateY(90deg)")
        emit(f"wallR_{int(z0)}", lambda U, V: (np.full_like(U, XR), YC + V * (YF - YC), z1 - U * d), d, YF - YC, z0,
             f"translate3d({XR*100:.0f}px,{(YC+YF)/2*100:.0f}px,{-zc*100:.0f}px) rotateY(-90deg)")
    emit("back", lambda U, V: (XL + U * (XR - XL), YC + V * (YF - YC), np.full_like(U, ZB)), XR - XL, YF - YC, ZB,
         f"translate3d({(XL+XR)/2*100:.0f}px,{(YC+YF)/2*100:.0f}px,{-ZB*100:.0f}px)")
    return out


def encode(faces: list[dict], budget: int) -> tuple[dict[str, bytes], int]:
    total = 0
    for q in (78, 72, 66, 60, 54, 48, 42, 40):
        enc = {}
        for f in faces:
            b = io.BytesIO(); Image.fromarray(f["rgba"], "RGBA").save(b, "WEBP", quality=q, method=6); enc[f["name"]] = b.getvalue()
        total = sum(len(v) for v in enc.values())
        if total <= budget:
            return enc, q
    raise SystemExit(f"예산 초과: 품질 40에서도 {total}B > {budget}B — CAP·구간을 줄이거나 예산을 설계서에서 바꾼다")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("photo"); ap.add_argument("--node", required=True); ap.add_argument("--title", required=True)
    ap.add_argument("--source", required=True); ap.add_argument("--author", required=True); ap.add_argument("--license", required=True)
    ap.add_argument("--camera", default="1468,1896,5780", help="VX,VY,F (그랑드 갤러리 값이 기본)")
    ap.add_argument("--box", default="-5.4,4.4,1.5,-6.3,150", help="XL,XR,YF,YC,ZB (m)")
    ap.add_argument("--cuts", default="8,12,18,26,38,56,85,150", help="깊이 구간 경계(m)")
    ap.add_argument("--out", default="web/public/museum/photos"); ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    if not NODE.match(a.node): raise SystemExit("--node는 소문자·숫자·하이픈(바꿀 때는 이름에 -v2처럼 버전)")
    if not LICENSE.match(a.license): raise SystemExit(f"허용 밖 라이선스 {a.license!r} — PD·CC0·CC BY·CC BY-SA만(SD_04 §3-3)")
    if not a.source.startswith("https://"): raise SystemExit("--source는 원본 페이지 https URL")
    cam, box, cuts = floats(a.camera, 3), floats(a.box, 5), floats(a.cuts)
    img = Image.open(a.photo).convert("RGB")
    W, H = img.size
    im = np.asarray(img).astype(np.float32)
    out_dir = Path(a.out); node_dir = out_dir / a.node
    if node_dir.exists() and not a.dry_run: raise SystemExit(f"{node_dir} 가 이미 있다 — 사진을 바꾸면 노드 이름을 바꾼다(immutable 캐시)")
    sizes: dict[str, int] = {}
    meta_faces: list[dict] | None = None
    for variant, (cap, budget) in VARIANTS.items():
        faces = [f for f in build(im, cam, box, cuts, cap) if not f["empty"]]   # 사진 밖뿐인 조각은 두 벌 모두 빠진다(기하가 같다)
        enc, q = encode(faces, budget)
        sizes[variant] = sum(len(v) for v in enc.values())
        print(f"{a.node} {variant}(CAP {cap}px/m): {len(enc)}조각 {sizes[variant]:,}B (예산 {budget:,}B, 품질 {q})")
        if meta_faces is None:
            meta_faces = [{"name": f["name"], "src": f"{f['name']}.webp", "w": f["w"], "h": f["h"], "tf": f["tf"]} for f in faces]
        if not a.dry_run:
            (node_dir / variant).mkdir(parents=True, exist_ok=True)
            for name, b in enc.items(): (node_dir / variant / f"{name}.webp").write_bytes(b)
    if a.dry_run:
        print("--dry-run: 파일·manifest를 쓰지 않았다"); return 0
    mf = out_dir / "manifest.json"
    doc = json.loads(mf.read_text("utf-8")) if mf.exists() else {"nodes": []}
    doc["nodes"] = [n for n in doc.get("nodes", []) if n["id"] != a.node] + [{
        "id": a.node, "kind": "tip", "title": a.title, "source": a.source, "author": a.author, "license": a.license,
        "derivative": "3D 상자 면으로 펴서 자름(Tour Into the Picture) — 원본과 같은 라이선스로 배포",
        "original": {"width": W, "height": H}, "camera": {"vx": cam[0], "vy": cam[1], "f": cam[2]},
        "box": dict(zip(("xl", "xr", "yf", "yc", "zb"), box)), "faces": meta_faces, "bytes": sizes}]
    mf.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", "utf-8")
    print(f"manifest 갱신: {mf} (노드 {len(doc['nodes'])}개)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
