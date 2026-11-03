"""컷아웃의 숨은 배경(마스터플랜 3-4) — 합성 그림만 쓴다. 모델은 가짜 대역이다.
알파를 강제로 255로 해도 배경이 복원되지 않는지, 보이는 화소와 부드러운 경계가 그대로인지 본다."""
import threading

import pytest

np = pytest.importorskip("numpy")

from PIL import Image  # noqa: E402

from adapters.base import JobInput  # noqa: E402
from common.cutout import cutout_image  # noqa: E402

W, H = 64, 48


def _photo():
    """배경은 잡음(복원되면 눈에 띄는 값), 가운데는 빨강"""
    a = np.random.default_rng(1).integers(30, 255, (H, W, 3), dtype=np.uint8)
    a[12:36, 16:48] = (220, 30, 30)
    return Image.fromarray(a, "RGB")


def _alpha():
    """가운데 불투명, 그 둘레 한 줄은 128(부드러운 경계), 나머지 0"""
    a = np.zeros((H, W), np.uint8)
    a[11:37, 15:49] = 128
    a[12:36, 16:48] = 255
    return Image.fromarray(a, "L")


def test_hidden_background_is_not_restorable(tmp_path):
    p = tmp_path / "cut.png"
    cutout_image(_photo(), _alpha()).save(p)
    with Image.open(p) as im:
        im.load()
        forced = np.array(im.convert("RGBA"))
    a = np.asarray(_alpha())
    forced[..., 3] = 255                                                   # 알파를 지워 숨은 색을 본다
    assert forced[a == 0][:, :3].max() == 0


def test_without_clearing_background_would_be_restorable():
    """시험이 의미 있는지 확인한다: 지우지 않으면 숨은 색이 남는다"""
    plain = _photo().copy()
    plain.putalpha(_alpha())
    a = np.asarray(_alpha())
    assert np.asarray(plain)[a == 0][:, :3].max() > 0


def test_visible_and_soft_edge_pixels_are_kept():
    src, alpha = np.asarray(_photo()), np.asarray(_alpha())
    out = np.asarray(cutout_image(_photo(), _alpha()))
    assert (out[alpha > 0][:, :3] == src[alpha > 0]).all()
    assert (out[..., 3] == alpha).all()


def test_input_is_not_changed():
    rgb = _photo()
    before = np.asarray(rgb).copy()
    cutout_image(rgb, _alpha())
    assert (np.asarray(rgb) == before).all()


def test_file_gets_smaller_when_background_is_noise(tmp_path):
    plain = _photo().copy()
    plain.putalpha(_alpha())
    plain.save(tmp_path / "plain.png")
    cutout_image(_photo(), _alpha()).save(tmp_path / "clear.png")
    assert (tmp_path / "clear.png").stat().st_size < (tmp_path / "plain.png").stat().st_size


def test_white_composite_for_m5_is_the_same():
    """M5는 흰 바탕에 합성해 읽는다. 투명한 곳의 색은 합성 결과에 영향이 없다"""
    white = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    plain = _photo().copy()
    plain.putalpha(_alpha())
    assert (np.asarray(Image.alpha_composite(white, plain)) == np.asarray(Image.alpha_composite(white, cutout_image(_photo(), _alpha())))).all()


def test_m7_style_composite_is_the_same():
    """M7은 색에 알파를 곱한다(m7_run.py). 투명한 곳의 색은 결과에 영향이 없다"""
    def blend(im):
        a = np.asarray(im.convert("RGBA")).astype(np.float32) / 255
        return a[..., :3] * a[..., 3:4] + (1 - a[..., 3:4]) * 0.5
    plain = _photo().copy()
    plain.putalpha(_alpha())
    assert np.allclose(blend(plain), blend(cutout_image(_photo(), _alpha())))


def test_m1_adapter_writes_cleared_cutout(tmp_path):
    torch = pytest.importorskip("torch")
    pytest.importorskip("torchvision")
    pytest.importorskip("scipy")
    from adapters.m1_birefnet import BiRefNetAdapter, SIZE

    a = BiRefNetAdapter()
    out = torch.full((1, 1, SIZE, SIZE), -8.0)
    out[0, 0, SIZE // 4:3 * SIZE // 4, SIZE // 4:3 * SIZE // 4] = 8.0
    a.model = lambda _x: [out]
    a._loaded = True
    src = tmp_path / "photo.png"
    _photo().save(src)
    r = a.run(JobInput(job_id=1, stage_kind="split", tmp_dir=tmp_path, inputs={"original": src}, cancel=threading.Event()))
    assert r.outcome == "ok"
    with Image.open(r.outputs["cutout"]) as im:
        px = np.asarray(im.convert("RGBA"))
    assert (px[..., 3] == 0).any() and (px[..., 3] == 255).any()
    assert px[px[..., 3] == 0][:, :3].max() == 0
