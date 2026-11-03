"""자체 모델 own3 어댑터(마스터플랜 3-6) — 실제 가중치 없이 작은 TorchScript로 계약을 본다.
numpy·scipy·torch는 모델 묶음에만 있다. 가짜 모델용 기본 잠금만 깐 환경(CI 포함)에서는 건너뛴다."""
import threading

import pytest

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


@pytest.fixture
def weights(tmp_path, monkeypatch):
    p = tmp_path / CFG["weights"]
    p.parent.mkdir(parents=True)
    torch.jit.trace(_Box(), torch.zeros(1, 3, CFG["input"], CFG["input"])).save(str(p))
    monkeypatch.setenv("MODEL_ROOT", str(tmp_path))
    monkeypatch.setattr(own3, "_model", None)
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


def test_missing_weights_is_load_failure(tmp_path, monkeypatch):
    monkeypatch.setenv("MODEL_ROOT", str(tmp_path))
    monkeypatch.setattr(own3, "_model", None)
    with pytest.raises(RuntimeError, match="weights_missing"):
        own3.Own3SplitAdapter().load()


def test_registry_uses_own_model_only_when_switched_on(monkeypatch):
    monkeypatch.setenv("UAM_OWN_MODEL", "M1,M5")
    assert type(registry.build_adapter("M1", fake=False)).__name__ == "Own3SplitAdapter"
    assert type(registry.build_adapter("M5", fake=False)).__name__ == "Own3DepthAdapter"
    assert type(registry.build_adapter("M1", fake=True)).__name__ == "FakeAdapter"
    monkeypatch.delenv("UAM_OWN_MODEL")
    assert type(registry.build_adapter("M1", fake=False)).__name__ == "BiRefNetAdapter"
