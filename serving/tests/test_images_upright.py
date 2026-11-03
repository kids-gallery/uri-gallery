"""입력 사진 방향과 HEIC(마스터플랜 3-4) — 모델 없이 본다. 합성 그림만 쓴다.
세로 그림을 가로로 저장하고 EXIF 방향 6을 준다. 위쪽 절반만 빨간 그림이라 돌렸는지 픽셀로 알 수 있다."""
import random
import struct
import threading
from types import SimpleNamespace

import pytest

np = pytest.importorskip("numpy")
pytest.importorskip("pillow_heif")

from PIL import Image  # noqa: E402

from adapters.base import JobInput  # noqa: E402
from common import images  # noqa: E402
from workers.stages import check  # noqa: E402

W, H = 60, 100   # 표시 방향


def _picture():
    im = Image.new("RGB", (W, H), (255, 255, 255))
    im.paste((220, 30, 30), (0, 0, W, H // 2))
    return im


def _is_upright(im):
    a = np.asarray(im.convert("RGB")).astype(int)
    return im.size == (W, H) and a[H // 4, W // 2, 1] < 120 and a[3 * H // 4, W // 2, 1] > 200


@pytest.fixture
def exif6(tmp_path):
    p = tmp_path / "exif6.jpg"
    ex = Image.Exif()
    ex[images.ORIENTATION] = 6
    _picture().rotate(90, expand=True).save(p, quality=95, exif=ex)
    with Image.open(p) as im:
        assert im.size == (H, W)   # 저장은 가로
    return p


@pytest.fixture
def plain(tmp_path):
    p = tmp_path / "plain.jpg"
    _picture().save(p, quality=95)
    return p


@pytest.fixture
def heic(tmp_path):
    images._register_heif()
    p = tmp_path / "plain.heic"
    _picture().save(p, quality=95)
    return p


def test_open_upright_turns_exif6(exif6):
    assert _is_upright(images.open_upright(exif6))


def test_open_upright_leaves_plain_and_opens_heic(plain, heic):
    assert _is_upright(images.open_upright(plain))
    assert _is_upright(images.open_upright(heic))


@pytest.fixture
def heic_exif6(tmp_path):
    """저장은 가로, 회전 정보(irot)와 EXIF 방향 6이 함께 있다. 휴대폰 HEIC와 같은 구조로 만든다.
    EXIF를 바이트로 줘야 pillow_heif가 irot을 쓴다. 열 때 irot을 적용하고 EXIF를 1로 되돌린다."""
    images._register_heif()
    p = tmp_path / "exif6.heic"
    ex = Image.Exif()
    ex[images.ORIENTATION] = 6
    _picture().rotate(90, expand=True).save(p, quality=95, exif=ex.tobytes())
    assert b"irot" in p.read_bytes()
    return p


def test_heic_with_exif_orientation_is_not_turned_twice(heic_exif6, tmp_path):
    with Image.open(heic_exif6) as im:
        assert im.getexif().get(images.ORIENTATION, 1) == 1   # 플러그인이 이미 적용하고 되돌렸다
        assert im.info.get("original_orientation") == 6
    assert _is_upright(images.open_upright(heic_exif6))
    assert images.upright_size(heic_exif6) == (W, H)
    with Image.open(images.upright_file(heic_exif6, tmp_path)) as im:
        assert _is_upright(im)


def test_unreadable_is_oserror(tmp_path):
    p = tmp_path / "broken.jpg"
    p.write_bytes(b"not an image")
    with pytest.raises(OSError):
        images.open_upright(p)


def _broken_exif_jpeg(tmp_path):
    """JFIF dpi가 있으면 PIL이 열 때 EXIF를 읽지 않아, 깨진 EXIF가 getexif에서 드러난다"""
    p = tmp_path / "broken_exif.jpg"
    _picture().save(p, quality=95, dpi=(72, 72), exif=b"Exif\x00\x00garbage!")
    return p


def _broken_exif_png(tmp_path):
    p = tmp_path / "broken_exif.png"
    _picture().save(p, exif=b"garbage!")
    return p


@pytest.mark.parametrize("make", [_broken_exif_jpeg, _broken_exif_png], ids=["JPEG", "PNG"])
def test_broken_exif_is_a_photo_without_direction(make, tmp_path):
    """픽셀이 멀쩡하면 전처럼 처리한다"""
    p = make(tmp_path)
    assert _is_upright(images.open_upright(p))
    assert images.upright_size(p) == (W, H)
    assert images.upright_file(p, tmp_path) == p


def _truncated_png(tmp_path):
    """PIL이 Image.open에서 ValueError를 내는 파일(IHDR이 13바이트보다 짧다)"""
    p = tmp_path / "cut.png"
    p.write_bytes(b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 5) + b"IHDR" + bytes(9))
    return p


def test_truncated_png_header_is_oserror(tmp_path):
    p = _truncated_png(tmp_path)
    for call in (images.open_upright, images.upright_size, lambda f: images.upright_file(f, tmp_path)):
        with pytest.raises(OSError):
            call(p)


@pytest.mark.parametrize("error", [ValueError("Invalid input"), RuntimeError("Security limit exceeded"), SyntaxError("broken PNG file")],
                         ids=["잘린 HEIC", "큰 HEIC", "깨진 PNG"])
def test_decode_failure_is_oserror(plain, monkeypatch, error):
    def fail(_self):
        raise error
    monkeypatch.setattr(type(Image.open(plain)), "load", fail)
    with pytest.raises(OSError):
        images.open_upright(plain)


@pytest.mark.parametrize("fmt, name", [("JPEG", "x.jpg"), ("PNG", "x.png")])
def test_corrupted_files_only_raise_oserror(tmp_path, fmt, name):
    """정한 씨앗으로 바이트를 망가뜨려도 OSError나 정상 결과만 나온다. 다른 예외는 인프라 실패가 된다.
    HEIC는 뺀다. 망가진 HEIC 일부는 libheif 안에서 프로세스가 죽어 시험을 함께 끝낸다(마스터플랜 3-4)."""
    ex = Image.Exif()
    ex[images.ORIENTATION] = 6
    src = tmp_path / ("src." + name.split(".")[1])
    _picture().save(src, fmt, exif=ex, dpi=(72, 72))
    data, rng, p = src.read_bytes(), random.Random(7), tmp_path / name
    for _ in range(300):
        b = bytearray(data)
        if rng.random() < 0.3:
            b = b[:rng.randrange(1, len(b))]
        else:
            for _ in range(rng.randrange(1, 8)):
                b[rng.randrange(min(len(b), 400))] = rng.randrange(256)
        p.write_bytes(bytes(b))
        for call in (images.open_upright, images.upright_size, lambda f: images.upright_file(f, tmp_path)):
            try:
                call(p)
            except OSError:
                pass


def test_upright_size_without_decoding(exif6, plain, heic):
    assert images.upright_size(exif6) == (W, H)
    assert images.upright_size(plain) == (W, H)
    assert images.upright_size(heic) == (W, H)


def test_upright_file_copies_only_when_needed(exif6, plain, heic, tmp_path):
    assert images.upright_file(plain, tmp_path) == plain
    out = images.upright_file(exif6, tmp_path)
    assert out != exif6 and out.suffix == ".png"
    with Image.open(out) as im:
        assert _is_upright(im) and images.ORIENTATION not in im.getexif()
    with Image.open(images.upright_file(heic, tmp_path)) as im:
        assert im.format == "PNG" and _is_upright(im)


def test_original_bytes_are_not_changed(exif6, tmp_path):
    before = exif6.read_bytes()
    images.open_upright(exif6)
    images.upright_file(exif6, tmp_path)
    assert exif6.read_bytes() == before


def test_check_compares_with_display_size(exif6):
    assert check._image_size(exif6) == (W, H)


def _job(path, tmp_path, stage="split", **more):
    d = tmp_path / stage
    d.mkdir()
    return JobInput(job_id=1, stage_kind=stage, tmp_dir=d, inputs={"original": path, **more}, cancel=threading.Event())


@pytest.fixture
def m1(tmp_path):
    torch = pytest.importorskip("torch")
    pytest.importorskip("torchvision")
    pytest.importorskip("scipy")
    from adapters.m1_birefnet import BiRefNetAdapter, SIZE

    a = BiRefNetAdapter()
    out = torch.full((1, 1, SIZE, SIZE), -8.0)
    out[0, 0, SIZE // 4:3 * SIZE // 4, SIZE // 4:3 * SIZE // 4] = 8.0
    a.model = lambda _x: [out]
    a._loaded = True
    return a


def test_m1_mask_and_cutout_follow_display_direction(m1, exif6, tmp_path):
    r = m1.run(_job(exif6, tmp_path))
    assert r.outcome == "ok"
    assert Image.open(r.outputs["mask"]).size == (W, H)
    assert Image.open(r.outputs["cutout"]).size == (W, H)
    assert check.output_ok("M1", r, images.upright_size(exif6))


def test_m1_finishes_with_broken_exif_and_check_reads_its_size(m1, tmp_path):
    """전에는 engine_down이 되어 재시도만 되풀이했다"""
    p = _broken_exif_jpeg(tmp_path)
    r = m1.run(_job(p, tmp_path))
    assert r.outcome == "ok"
    assert check._image_size(p) == (W, H)


def test_m1_unreadable_ends_as_storage(m1, tmp_path):
    p = _truncated_png(tmp_path)
    r = m1.run(_job(p, tmp_path))
    assert r.outcome == "storage" and r.diagnostic == "input_unreadable"
    assert check._image_size(p) is None


def test_m1_reads_heic(m1, heic, tmp_path):
    r = m1.run(_job(heic, tmp_path))
    assert r.outcome == "ok" and Image.open(r.outputs["mask"]).size == (W, H)


def test_m5_depth_follows_cutout_direction(m1, exif6, tmp_path):
    torch = pytest.importorskip("torch")
    from adapters.m5_depth import DepthAnythingAdapter

    r1 = m1.run(_job(exif6, tmp_path))
    a = DepthAnythingAdapter.__new__(DepthAnythingAdapter)
    a.device, a.min_std = "cpu", 0.5

    class Inputs(dict):
        def to(self, _device):
            return self

    a.processor = lambda images, return_tensors: Inputs()
    a.model = lambda **_kw: SimpleNamespace(predicted_depth=torch.linspace(0, 1, 64).reshape(1, 8, 8))
    from pathlib import Path

    r = a.run(_job(exif6, tmp_path, "depth_relief", cutout=Path(r1.outputs["cutout"])))
    assert r.outcome == "ok" and Image.open(r.outputs["result_relief"]).size == (W, H)


def test_m2_gets_display_direction(exif6, tmp_path):
    pytest.importorskip("torch")
    pytest.importorskip("open_clip")
    from adapters.m2_openclip import OpenClipAdapter

    seen = {}

    class Stop(Exception):
        pass

    def preprocess(img):
        seen["size"] = img.size
        raise Stop

    a = OpenClipAdapter.__new__(OpenClipAdapter)
    a.preprocess, a.device, a.model = preprocess, "cpu", SimpleNamespace(encode_image=None)
    with pytest.raises(Stop):
        a.run(_job(exif6, tmp_path, "judge"))
    assert seen["size"] == (W, H)


def test_m3_joints_get_display_direction(exif6, tmp_path, monkeypatch):
    from adapters import m3_joints, m3_render

    seen = {}

    def extract(_ts, img):
        seen["size"] = img.size
        raise m3_joints.NoHumanoid

    monkeypatch.setattr(m3_joints, "extract", extract)
    a = m3_render.AnimatedDrawingsAdapter.__new__(m3_render.AnimatedDrawingsAdapter)
    a.ts = "http://unused"
    r = a.joints(_job(exif6, tmp_path, "judge"))
    assert r.outcome == "ok" and seen["size"] == (W, H)
