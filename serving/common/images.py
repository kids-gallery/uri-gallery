"""입력 사진을 여는 곳(마스터플랜 3-4). 표시 방향으로 돌리고 HEIC도 연다.

API는 받은 바이트를 그대로 저장한다(FR-22). 그래서 휴대폰 사진은 저장 방향과 표시 방향이 다를 수 있다.
화면은 표시 방향으로 그리므로 모델 입력과 결과도 표시 방향에 맞춘다. 저장된 원본은 바꾸지 않는다.
깨진 HEIC는 libheif 안에서 프로세스를 죽이므로 자식 프로세스에서 먼저 디코드한다.
"""
from __future__ import annotations

import os
import struct
import subprocess
import sys
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path

from common.config import load_yaml
from common.logging import get_logger

ORIENTATION = 0x0112
SWAPS_SIDES = {5, 6, 7, 8}   # 가로와 세로가 바뀌는 EXIF 방향
_EXIF_BROKEN = (SyntaxError, ValueError, TypeError, struct.error)   # PIL이 깨진 EXIF에서 내는 예외
_heif_registered = False
_HEIF_CHECK = """
import sys, pillow_heif
from PIL import Image
pillow_heif.register_heif_opener()
with Image.open(sys.argv[1]) as im:
    im.load()
"""


def _register_heif() -> None:
    """API가 HEIC를 받으므로 PIL이 열 수 있게 한다. 한 프로세스에 한 번이면 된다."""
    global _heif_registered
    if not _heif_registered:
        import pillow_heif

        pillow_heif.register_heif_opener()
        _heif_registered = True


def _is_heif(path) -> bool:
    with open(path, "rb") as f:
        return f.read(12)[4:8] == b"ftyp"


@lru_cache(maxsize=256)
def _heif_decodes(path: str, size: int, mtime_ns: int) -> None:
    """자식 프로세스에서 픽셀을 끝까지 디코드해 본다. EXIF는 보지 않는다(깨진 EXIF는 부모가 방향 없음으로 다룬다).
    죽거나 실패하거나 시간을 넘기면 OSError. 통과만 기억한다(예외는 캐시되지 않는다)."""
    try:
        p = subprocess.run([sys.executable, "-I", "-c", _HEIF_CHECK, path], capture_output=True,
                           timeout=load_yaml("limits")["image"]["heif_check_timeout_s"])
    except subprocess.TimeoutExpired as e:
        get_logger().warning("heif_check", diagnostic="timeout")
        raise OSError("heif_check_timeout") from e
    if p.returncode != 0:
        get_logger().warning("heif_check", diagnostic=f"rc_{p.returncode}")   # 경로는 남기지 않는다
        raise OSError(f"heif_check_rc_{p.returncode}")


@contextmanager
def _opened(path):
    """PIL 그림을 연다. 깨진 파일은 형식에 따라 다른 예외를 내므로(잘린 PNG·HEIC는 ValueError, 큰 HEIC는 RuntimeError) OSError로 모은다."""
    from PIL import Image

    if _is_heif(path):
        st = os.stat(path)
        _heif_decodes(str(path), st.st_size, st.st_mtime_ns)
    _register_heif()
    try:
        with Image.open(path) as im:
            yield im
    except (SyntaxError, ValueError, RuntimeError, struct.error, Image.DecompressionBombError) as e:
        raise OSError("image_unreadable") from e


def _orientation(im) -> int:
    """EXIF 방향. 깨진 EXIF는 방향 없음(1)으로 본다. 픽셀이 멀쩡한 사진을 EXIF 때문에 실패시키지 않는다."""
    try:
        return im.getexif().get(ORIENTATION, 1)
    except _EXIF_BROKEN:
        return 1


def open_upright(path):
    """표시 방향의 PIL 그림. 읽지 못하면 OSError(형식 불명 포함). 깨진 EXIF는 돌리지 않는다."""
    from PIL import ImageOps

    with _opened(path) as im:
        im.load()
        try:
            return ImageOps.exif_transpose(im)
        except _EXIF_BROKEN:
            return im.copy()


def upright_size(path) -> tuple[int, int]:
    """표시 방향의 (가로, 세로). 픽셀을 풀지 않는다. 읽지 못하면 OSError."""
    with _opened(path) as im:
        w, h = im.size
        return (h, w) if _orientation(im) in SWAPS_SIDES else (w, h)


def upright_file(path, tmp_dir) -> Path:
    """표시 방향의 파일 경로. 경로를 넘겨야 하는 외부 프로세스용이다.
    그대로 써도 되면 원본 경로를 돌려주고, 돌려야 하거나 HEIC면 tmp_dir에 PNG 사본을 만든다."""
    with _opened(path) as im:
        same = im.format != "HEIF" and _orientation(im) == 1
    if same:
        return Path(path)
    out = Path(tmp_dir) / "upright.png"
    open_upright(path).convert("RGB").save(out)
    return out
