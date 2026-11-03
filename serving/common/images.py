"""입력 사진을 여는 곳(마스터플랜 3-4). 표시 방향으로 돌리고 HEIC도 연다.

API는 받은 바이트를 그대로 저장한다(FR-22). 그래서 휴대폰 사진은 저장 방향과 표시 방향이 다를 수 있다.
화면은 표시 방향으로 그리므로 모델 입력과 결과도 표시 방향에 맞춘다. 저장된 원본은 바꾸지 않는다.
"""
from __future__ import annotations

from pathlib import Path

ORIENTATION = 0x0112
SWAPS_SIDES = {5, 6, 7, 8}   # 가로와 세로가 바뀌는 EXIF 방향
_heif_registered = False


def _register_heif() -> None:
    """API가 HEIC를 받으므로 PIL이 열 수 있게 한다. 한 프로세스에 한 번이면 된다."""
    global _heif_registered
    if not _heif_registered:
        import pillow_heif

        pillow_heif.register_heif_opener()
        _heif_registered = True


def open_upright(path):
    """표시 방향의 PIL 그림. 읽지 못하면 OSError(형식 불명 포함)."""
    from PIL import Image, ImageOps

    _register_heif()
    with Image.open(path) as im:
        im.load()
        return ImageOps.exif_transpose(im)


def upright_size(path) -> tuple[int, int]:
    """표시 방향의 (가로, 세로). 픽셀을 풀지 않는다. 읽지 못하면 OSError."""
    from PIL import Image

    _register_heif()
    with Image.open(path) as im:
        w, h = im.size
        return (h, w) if im.getexif().get(ORIENTATION) in SWAPS_SIDES else (w, h)


def upright_file(path, tmp_dir) -> Path:
    """표시 방향의 파일 경로. 경로를 넘겨야 하는 외부 프로세스용이다.
    그대로 써도 되면 원본 경로를 돌려주고, 돌려야 하거나 HEIC면 tmp_dir에 PNG 사본을 만든다."""
    from PIL import Image

    _register_heif()
    with Image.open(path) as im:
        same = im.format != "HEIF" and im.getexif().get(ORIENTATION, 1) == 1
    if same:
        return Path(path)
    out = Path(tmp_dir) / "upright.png"
    open_upright(path).convert("RGB").save(out)
    return out
