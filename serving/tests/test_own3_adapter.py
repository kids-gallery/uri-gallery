"""자체 모델 own3 어댑터(마스터플랜 3-6) — 실제 가중치 없이 작은 TorchScript로 계약을 본다.
numpy·scipy·torch는 모델 묶음에만 있다. 가짜 모델용 기본 잠금만 깐 환경(CI 포함)에서는 건너뛴다."""
import hashlib
import threading
from pathlib import Path

import pytest
import yaml

np = pytest.importorskip("numpy")
pytest.importorskip("scipy")
torch = pytest.importorskip("torch")

from PIL import Image  # noqa: E402

from adapters import own3, registry  # noqa: E402
from adapters.base import JobInput  # noqa: E402
from common.config import load_yaml  # noqa: E402

CFG = load_yaml("own3")


class _Box(torch.nn.Module):
    """가운데 네모를 전경으로, 그 안의 위쪽을 더 가깝게 내는 모델"""

    def forward(self, x):
        _, _, h, w = x.shape
        out = torch.full((1, 24, h, w), -8.0)
        out[0, 0, h // 4:3 * h // 4, w // 4:3 * w // 4] = 8.0
        out[0, 22, :, :] = torch.linspace(4.0, -4.0, h)[:, None]
        return out


def _manifest(tmp_path, monkeypatch, **shas):
    """M1=해시 꼴로 받아 시험용 매니페스트를 쓴다. 값이 None이면 자리만 있고 해시가 없다"""
    p = tmp_path / "manifest.yaml"
    p.write_text(yaml.safe_dump({"models": {m: {"weights_sha256": s} for m, s in shas.items()}}))
    monkeypatch.setenv("MODEL_MANIFEST", str(p))


@pytest.fixture
def weight_file(tmp_path, monkeypatch):
    """작은 합성 TorchScript 파일. 매니페스트는 시험이 정한다"""
    p = tmp_path / CFG["weights"]
    p.parent.mkdir(parents=True)
    torch.jit.trace(_Box(), torch.zeros(1, 3, CFG["input"], CFG["input"])).save(str(p))
    monkeypatch.setenv("MODEL_ROOT", str(tmp_path))
    monkeypatch.setattr(own3, "_model", None)
    monkeypatch.setattr(own3, "_sha", None)
    return p


@pytest.fixture
def weights(tmp_path, monkeypatch, weight_file):
    sha = hashlib.sha256(weight_file.read_bytes()).hexdigest()
    _manifest(tmp_path, monkeypatch, M1=sha, M5=sha)
    return tmp_path


def _job(tmp_path, stage, **inputs):
    d = tmp_path / stage
    d.mkdir()
    return JobInput(job_id=1, stage_kind=stage, tmp_dir=d, inputs=inputs, cancel=threading.Event())


def _photo(tmp_path, size=(640, 480)):
    p = tmp_path / "original.png"
    Image.new("RGB", size, (240, 240, 235)).save(p)
    return p


def test_weak_piece_without_strong_pixel_is_dropped():
    p = np.zeros((100, 100), np.float32)
    p[10:30, 10:30] = 0.9
    p[60:80, 60:80] = 0.1
    m = own3.mask_from_prob(p, CFG)
    assert m[20, 20] and not m[70, 70]


def test_hole_between_limbs_stays_open():
    """다리 사이처럼 크게 막힌 곳은 채우지 않는다(자동차 밑이 메워지던 원인)"""
    p = np.zeros((100, 100), np.float32)
    p[10:90, 10:90] = 0.9
    p[35:65, 35:65] = 0.0
    assert not own3.mask_from_prob(p, CFG)[50, 50]


def test_split_writes_mask_and_cutout_with_same_size(weights, tmp_path):
    a = own3.Own3SplitAdapter()
    a.ensure_loaded()
    r = a.run(_job(tmp_path, "split", original=_photo(tmp_path)))
    assert r.outcome == "ok" and set(r.outputs) == {"mask", "cutout"}
    assert Image.open(r.outputs["mask"]).size == (640, 480)
    assert Image.open(r.outputs["cutout"]).mode == "RGBA"


def test_split_empty_foreground_is_quality_below(weights, tmp_path, monkeypatch):
    a = own3.Own3SplitAdapter()
    a.ensure_loaded()
    monkeypatch.setattr(own3, "predict", lambda *_: (np.zeros((60, 80), np.float32), None))
    r = a.run(_job(tmp_path, "split", original=_photo(tmp_path)))
    assert r.outcome == "quality_below" and r.downgrade_cause == "split_fail"


def test_depth_is_png16_inside_mask_only(weights, tmp_path):
    a = own3.Own3DepthAdapter()
    a.ensure_loaded()
    orig = _photo(tmp_path)
    cut = Image.new("RGBA", (640, 480), (0, 0, 0, 0))
    cut.paste((200, 50, 50, 255), (160, 120, 480, 360))
    cut_p = tmp_path / "cutout.png"
    cut.save(cut_p)
    r = a.run(_job(tmp_path, "depth_relief", original=orig, cutout=cut_p))
    assert r.outcome == "ok"
    d = np.asarray(Image.open(r.outputs["result_relief"]))
    assert d.dtype == np.uint16 and d[0, 0] == 0
    assert d[130, 320] > d[350, 320]                                      # 위쪽이 더 가깝다(큰 값)


def test_depth_without_cutout_lets_chain_downgrade(weights, tmp_path):
    a = own3.Own3DepthAdapter()
    a.ensure_loaded()
    r = a.run(_job(tmp_path, "depth_relief", original=_photo(tmp_path)))
    assert r.outcome == "quality_below" and r.diagnostic == "no_cutout"


def _turned_photo(tmp_path):
    """표시 방향은 세로 400×600이고 위쪽 절반이 빨갛다. 저장은 가로이고 EXIF 방향 6이다"""
    im = Image.new("RGB", (400, 600), (240, 240, 235))
    im.paste((220, 30, 30), (0, 0, 400, 300))
    p = tmp_path / "turned.jpg"
    ex = Image.Exif()
    ex[0x0112] = 6
    im.rotate(90, expand=True).save(p, quality=95, exif=ex)
    assert Image.open(p).size == (600, 400)
    return p


def test_split_follows_display_direction(weights, tmp_path):
    """휴대폰 사진은 저장 방향과 표시 방향이 다르다. 3D 화면은 표시 방향으로 그린다"""
    a = own3.Own3SplitAdapter()
    a.ensure_loaded()
    r = a.run(_job(tmp_path, "split", original=_turned_photo(tmp_path)))
    assert r.outcome == "ok"
    assert Image.open(r.outputs["mask"]).size == (400, 600)
    cut = np.asarray(Image.open(r.outputs["cutout"]).convert("RGBA")).astype(int)
    assert cut.shape[:2] == (600, 400)
    assert cut[200, 200, 0] > 180 and cut[200, 200, 1] < 90              # 안쪽 위는 빨강
    assert cut[400, 200, 1] > 200                                        # 안쪽 아래는 바탕색


def test_depth_reads_original_in_display_direction(weights, tmp_path, monkeypatch):
    """저장 방향으로 읽으면 크기가 달라 흰 바탕 컷아웃으로 넘어간다"""
    a = own3.Own3SplitAdapter()
    a.ensure_loaded()
    photo = _turned_photo(tmp_path)
    cut = a.run(_job(tmp_path, "split", original=photo)).outputs["cutout"]
    seen = []
    real = own3.predict
    monkeypatch.setattr(own3, "predict", lambda m, rgb, cfg: (seen.append(rgb), real(m, rgb, cfg))[1])
    b = own3.Own3DepthAdapter()
    b.ensure_loaded()
    r = b.run(_job(tmp_path, "depth_relief", cutout=cut, original=photo))
    assert r.outcome == "ok"
    assert Image.open(r.outputs["result_relief"]).size == (400, 600)
    corner = np.asarray(seen[0])[590, 5].astype(int)
    assert seen[0].size == (400, 600) and corner[2] < 245 and corner[0] > 225   # 원본 바탕색이다(흰 바탕이 아니다)


def test_cutout_keeps_no_background_under_transparent_pixels(weights, tmp_path):
    """컷아웃은 이웃 화면으로도 나간다. 알파를 지워도 배경이 복원되면 안 된다"""
    a = own3.Own3SplitAdapter()
    a.ensure_loaded()
    r = a.run(_job(tmp_path, "split", original=_photo(tmp_path)))
    cut = np.asarray(Image.open(r.outputs["cutout"]).convert("RGBA"))
    alpha = cut[..., 3]
    assert (alpha == 0).any() and (alpha > 0).any()
    assert cut[alpha == 0][:, :3].max() == 0
    assert tuple(cut[240, 320, :3]) == (240, 240, 235)                   # 보이는 곳의 색은 그대로다


def test_unreadable_photo_is_storage(weights, tmp_path):
    p = tmp_path / "broken.png"
    p.write_bytes(b"not an image")
    a = own3.Own3SplitAdapter()
    a.ensure_loaded()
    r = a.run(_job(tmp_path, "split", original=p))
    assert r.outcome == "storage" and r.diagnostic == "input_unreadable"


def test_missing_weights_is_load_failure(tmp_path, monkeypatch):
    monkeypatch.setenv("MODEL_ROOT", str(tmp_path))
    monkeypatch.setattr(own3, "_model", None)
    with pytest.raises(RuntimeError, match="weights_missing"):
        own3.Own3SplitAdapter().load()


def test_matching_sha_loads_and_both_stages_share_one_model(weights):
    a, b = own3.Own3SplitAdapter(), own3.Own3DepthAdapter()
    a.ensure_loaded()
    b.ensure_loaded()
    assert a.model is b.model


def test_different_file_with_manifest_sha_is_not_loaded(tmp_path, monkeypatch, weight_file):
    """같은 경로에 다른 가중치가 있으면 올리지 않는다"""
    _manifest(tmp_path, monkeypatch, M1="0" * 64, M5="0" * 64)
    a = own3.Own3SplitAdapter()
    with pytest.raises(RuntimeError, match="weights_sha_mismatch"):
        a.ensure_loaded()
    assert not a.loaded and own3._model is None


def test_file_is_never_deserialized_on_mismatch(tmp_path, monkeypatch, weight_file):
    _manifest(tmp_path, monkeypatch, M1="0" * 64)
    monkeypatch.setattr(torch.jit, "load", lambda *_, **__: pytest.fail("해시가 다른데 올렸다"))
    with pytest.raises(RuntimeError, match="weights_sha_mismatch"):
        own3.Own3SplitAdapter().load()


def test_second_stage_with_other_sha_is_refused_even_when_model_is_up(tmp_path, monkeypatch, weight_file):
    """M1이 올린 모델을 M5가 다른 해시로 기록하면 안 된다"""
    sha = hashlib.sha256(weight_file.read_bytes()).hexdigest()
    _manifest(tmp_path, monkeypatch, M1=sha, M5="0" * 64)
    own3.Own3SplitAdapter().ensure_loaded()
    with pytest.raises(RuntimeError, match="weights_sha_mismatch"):
        own3.Own3DepthAdapter().ensure_loaded()


@pytest.mark.parametrize("shas", [{}, {"M1": None}], ids=["자리 없음", "해시 없음"])
def test_manifest_without_sha_is_load_failure(tmp_path, monkeypatch, weight_file, shas):
    _manifest(tmp_path, monkeypatch, **shas)
    with pytest.raises(RuntimeError, match="weights_sha_missing"):
        own3.Own3SplitAdapter().ensure_loaded()


def test_load_recovers_after_right_file_is_restored(tmp_path, monkeypatch, weight_file):
    """실패를 기억하지 않는다. 파일을 바로잡으면 다음 적재가 된다(워커는 failed면 다시 시도한다)"""
    good = weight_file.read_bytes()
    _manifest(tmp_path, monkeypatch, M1=hashlib.sha256(good).hexdigest())
    weight_file.write_bytes(good + b"x")
    a = own3.Own3SplitAdapter()
    with pytest.raises(RuntimeError, match="weights_sha_mismatch"):
        a.ensure_loaded()
    weight_file.write_bytes(good)
    a.ensure_loaded()
    assert a.loaded


def test_real_manifest_points_both_stages_at_one_file():
    """두 단계가 모델 하나를 나눠 쓰므로 해시가 다르면 M5가 올라오지 못한다"""
    m = yaml.safe_load(open(Path(__file__).parents[2] / "models" / "manifest.own3.yaml", encoding="utf-8"))["models"]
    assert m["M1"]["weights_sha256"] == m["M5"]["weights_sha256"]


def test_repository_manifest_cannot_activate_own_model():
    """활성화 코드는 용도를 구분하지 못한다. 저장소 값이 true면 겹침 파일만으로 범위 밖에서 켜진다"""
    m = yaml.safe_load(open(Path(__file__).parents[2] / "models" / "manifest.own3.yaml", encoding="utf-8"))["models"]
    assert m["M1"]["license_confirmed"] is False
    assert m["M5"]["license_confirmed"] is False


def test_registry_uses_own_model_only_when_switched_on(monkeypatch):
    monkeypatch.setenv("UAM_OWN_MODEL", "M1,M5")
    assert type(registry.build_adapter("M1", fake=False)).__name__ == "Own3SplitAdapter"
    assert type(registry.build_adapter("M5", fake=False)).__name__ == "Own3DepthAdapter"
    assert type(registry.build_adapter("M1", fake=True)).__name__ == "FakeAdapter"
    monkeypatch.delenv("UAM_OWN_MODEL")
    assert type(registry.build_adapter("M1", fake=False)).__name__ == "BiRefNetAdapter"
