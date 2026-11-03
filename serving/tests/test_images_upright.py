"""입력 사진 방향과 HEIC(마스터플랜 3-4) — 모델 없이 본다. 합성 그림만 쓴다.
세로 그림을 가로로 저장하고 EXIF 방향 6을 준다. 위쪽 절반만 빨간 그림이라 돌렸는지 픽셀로 알 수 있다."""
import base64
import os
import random
import signal
import struct
import subprocess
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
_CRASHING_HEIC = base64.b64decode(
    "AAAAHGZ0eXBoZWljAAAAAG1pZjFoZX5jbWlhZgAAAbVtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAA"
    "AA5waXRtAAAAAAABAAAANGlsb2MAAAAAREAAAgABAAAAAAHZAAEAAAAAAAAAVAACAAAAAAItAAEAAAAAAAAAJAAAADhpaW5mAAAA"
    "AAACAAAAFWluZmUCAAAAAAEAAGh2YzEAAAAAFWluZmUCAAABAAIAAEX8aWYAAAAA9GlwcnAAAADUaXBjbwAAAHdodmNDAQNwAAAA"
    "AAAAAAAAHvAA/P34+AAADwMgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQCEAAQArQgEBA3AAAAMAkAAAAwAAAwAeoCCBp95b"
    "q5Ka5uAhoMCAAAADAIAAAAMAhCIAAQAGRAHBc8CJAAAAFGlzcGUAAAAAAAAAQAAAAGQAAAAoY2xhcAAAADwAAAABAAAAZAAAAAH/"
    "///8AAAAAgAAAAAAAAACAAAACWlyb3QDAAAAEHBpeGkAAAAAAwgICAAAABhpcG1hAAAAAAAAAAEAAQWBAoMEBQAAABppcmVmAAAA"
    "AAAAAA5jZHNjAAIAAQABAAAAgG1kYXQAAABQKAGvE4D4EOGn//tAo//gEzw/J7zuzltg4Q3pm+L/zvA6TZ52LKt4wvzfVXRUMz5w"
    "eaR9LKyyH7kD5HmbYXM6u1o502qwEOP7qTUqzmAAIKAAAAAGRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAA="
)   # 합성 HEIC 머리 바이트를 뒤집은 파일. 부모에서 열면 libheif 안에서 신호 11로 죽는다. API 검사(heic-decode)는 통과한다


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


def _broken_exif_heic(tmp_path):
    p = tmp_path / "broken_exif.heic"
    _picture().save(p, "HEIF", quality=90, exif=b"Exif\x00\x00garbage!")
    return p


@pytest.mark.parametrize("make", [_broken_exif_jpeg, _broken_exif_png, _broken_exif_heic], ids=["JPEG", "PNG", "HEIC"])
def test_broken_exif_is_a_photo_without_direction(make, tmp_path):
    """픽셀이 멀쩡하면 전처럼 처리한다. HEIC도 자식 검사에서 떨어지지 않는다"""
    p = make(tmp_path)
    assert _is_upright(images.open_upright(p))
    assert images.upright_size(p) == (W, H)
    assert _is_upright(Image.open(images.upright_file(p, tmp_path)))     # HEIC는 사본, 나머지는 원본 경로


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
    HEIC는 사진마다 자식 프로세스가 돌아 느리므로 아래 시험에서 따로 본다."""
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


@pytest.fixture
def fresh_heif_cache():
    images._heif_decodes.cache_clear()
    yield
    images._heif_decodes.cache_clear()


def _crashing(tmp_path):
    p = tmp_path / "crash.heic"
    p.write_bytes(_CRASHING_HEIC)
    return p


def test_crashing_heic_is_oserror_and_this_process_lives(tmp_path, fresh_heif_cache):
    """전에는 이 파일에서 파이썬 프로세스가 신호 11로 죽었다. 이 시험이 끝나면 살아 있는 것이다"""
    p = _crashing(tmp_path)
    for call in (images.open_upright, images.upright_size, lambda f: images.upright_file(f, tmp_path)):
        with pytest.raises(OSError):
            call(p)


def test_child_killed_by_signal_is_oserror(heic, monkeypatch, fresh_heif_cache):
    monkeypatch.setattr(images, "_HEIF_CHECK", "import os, signal; os.kill(os.getpid(), signal.SIGSEGV)")
    with pytest.raises(OSError, match=f"heif_check_rc_{-signal.SIGSEGV}"):
        images.open_upright(heic)


def test_child_over_time_limit_is_oserror(heic, monkeypatch, fresh_heif_cache):
    monkeypatch.setattr(images, "_HEIF_CHECK", "import time; time.sleep(30)")
    monkeypatch.setattr(images, "load_yaml", lambda _: {"image": {"heif_check_timeout_s": 0.2}})
    with pytest.raises(OSError, match="heif_check_timeout"):
        images.upright_size(heic)


def test_heic_checked_once_until_file_changes_and_others_never(heic, plain, monkeypatch, fresh_heif_cache):
    calls = []
    real = subprocess.run
    monkeypatch.setattr(images.subprocess, "run", lambda *a, **k: (calls.append(a), real(*a, **k))[1])
    assert _is_upright(images.open_upright(plain)) and not calls        # JPEG는 자식을 만들지 않는다
    images.open_upright(heic); images.upright_size(heic); images.upright_file(heic, heic.parent)
    assert len(calls) == 1
    os.utime(heic, ns=(1, 1))
    images.upright_size(heic)
    assert len(calls) == 2


def test_failed_check_is_not_remembered(heic, monkeypatch, fresh_heif_cache):
    """일시적인 실패(메모리 부족, 시간 초과)가 재시도까지 막으면 안 된다"""
    monkeypatch.setattr(images, "_HEIF_CHECK", "raise SystemExit(1)")
    with pytest.raises(OSError):
        images.upright_size(heic)
    monkeypatch.setattr(images, "_HEIF_CHECK", "pass")
    assert images.upright_size(heic)


def test_worker_lives_through_crashing_heic_and_next_jpeg_succeeds(env, m1, tmp_path, fresh_heif_cache):
    """한 작품의 입력이 워커와 다른 작업을 멈추지 않는다(마스터플랜 3-4). 진짜 Worker와 진짜 M1 어댑터 코드로 본다"""
    from tests.test_stage_job_contract import make_worker

    def with_original(data):
        a = env.artwork()
        key = env.one("SELECT so.object_key FROM artwork_original ao JOIN stored_object so ON so.object_id = ao.object_id WHERE ao.artwork_id = %s", a)["object_key"]
        (env.store / key).write_bytes(data)
        return env.job(a, "split")

    bad, good = with_original(_CRASHING_HEIC), None
    b = tmp_path / "ok.jpg"
    _picture().save(b, quality=95)
    good = with_original(b.read_bytes())
    w = make_worker(extra={"M1": m1})
    first = w.run_once()
    assert first == "retry_wait"                                          # 파일 오류로 기록되고 프로세스는 살아 있다
    row = env.job_row(bad)
    assert (row["status"], row["error_class"]) == ("retry_wait", "storage")
    assert w.run_once() == "done"
    assert env.job_row(good)["status"] == "done"


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
    """전에는 engine_down으로 기록되었다"""
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


def _m3_render(tmp_path):
    """렌더 프로세스만 대역이다. AD는 파일 경로를 받으므로 넘긴 경로를 본다"""
    from adapters import m3_render

    a = m3_render.AnimatedDrawingsAdapter.__new__(m3_render.AnimatedDrawingsAdapter)
    a.ad_python, a.ad_root, a.runner, a.ts = "python", str(tmp_path), "runner.py", "http://unused"
    a.load, a._render_env = (lambda: None), (lambda: {})
    seen = []

    def run_proc(args, _job, cwd, env=None):
        seen.append(args[2])
        return 1
    a._run_proc = run_proc
    return a, seen


def test_m3_render_gets_display_direction_file(exif6, tmp_path):
    a, seen = _m3_render(tmp_path)
    r = a.render(_job(exif6, tmp_path, "animate_render"))
    assert r.outcome == "quality_below"                                   # 대역 프로세스가 실패로 끝난다
    assert len(seen) == 1 and _is_upright(Image.open(seen[0]))


def test_m3_render_unreadable_is_storage_without_process(tmp_path):
    a, seen = _m3_render(tmp_path)
    p = tmp_path / "broken.jpg"
    p.write_bytes(b"not an image")
    r = a.render(_job(p, tmp_path, "animate_render"))
    assert r.outcome == "storage" and seen == []


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
