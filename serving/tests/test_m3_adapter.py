"""M3 어댑터 연결부 — 가짜 TorchServe와 가짜 AD 스크립트로(T081 실제 재현 전)."""
from __future__ import annotations

import json
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from PIL import Image

from adapters.base import JobInput
from rules.m4_geometry import evaluate_file

# COCO 17점: 좌우 대칭 사람
KP = [[50, 10, 1], [47, 8, 1], [53, 8, 1], [45, 10, 1], [55, 10, 1], [40, 25, 1], [60, 25, 1], [32, 37, 1], [68, 37, 1],
      [26, 47, 1], [74, 47, 1], [44, 60, 1], [56, 60, 1], [42, 78, 1], [58, 78, 1], [40, 94, 1], [60, 94, 1]]


@pytest.fixture()
def torchserve(monkeypatch):
    calls = []

    class H(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def _send(self, body):
            data = json.dumps(body).encode()
            self.send_response(200); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)

        def do_GET(self):
            self._send({"status": "Healthy"})

        def do_POST(self):
            n = int(self.headers["Content-Length"]); body = self.rfile.read(n)
            calls.append((self.path, b"image/png" in body and b"\x89PNG" in body))
            if self.path.endswith("drawn_humanoid_detector"):
                return self._send([{"bbox": [10, 10, 110, 110], "score": 0.9}, {"bbox": [0, 0, 5, 5], "score": 0.1}])
            self._send([{"keypoints": KP}])

    srv = ThreadingHTTPServer(("127.0.0.1", 0), H)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    monkeypatch.setenv("TORCHSERVE_URL", f"http://127.0.0.1:{srv.server_port}")
    yield calls
    srv.shutdown()


def test_joints_mapping_passes_m4(tmp_path, torchserve):
    from adapters.m3_render import AnimatedDrawingsAdapter
    src = tmp_path / "o.png"; Image.new("RGB", (200, 200), "white").save(src)
    a = AnimatedDrawingsAdapter(); a.ensure_loaded()
    r = a.run(JobInput(1, "judge", tmp_path, {"original": src}, threading.Event()))
    assert r.outcome == "ok" and r.score == 0.9
    skel = {j["name"]: j["loc"] for j in json.loads(open(r.outputs["joints"]).read())["skeleton"]}
    assert skel["root"] == [50, 60] and skel["torso"] == [50, 25] and skel["neck"] == [50, 10]
    assert evaluate_file(r.outputs["joints"]) is True
    assert [p for p, _ in torchserve] == ["/predictions/drawn_humanoid_detector", "/predictions/drawn_humanoid_pose_estimator"]
    assert all(ok for _, ok in torchserve)


def test_render_gif_to_mp4_and_cancel(tmp_path, torchserve, monkeypatch):
    pytest.importorskip("imageio_ffmpeg")
    ad = tmp_path / "ad"; (ad / "examples").mkdir(parents=True)
    (ad / "examples" / "image_to_animation.py").write_text(
        "import sys,os,time\nfrom PIL import Image\nout=sys.argv[2]; os.makedirs(out, exist_ok=True)\n"
        "if os.environ.get('SLOW'): time.sleep(30)\n"
        "fr=[Image.new('RGB',(64,64),(i*20,0,0)) for i in range(12)]\n"
        "fr[0].save(os.path.join(out,'video.gif'),save_all=True,append_images=fr[1:],duration=40)\n")
    monkeypatch.setenv("M3_AD_PYTHON", sys.executable); monkeypatch.setenv("M3_AD_ROOT", str(ad))
    from adapters.m3_render import AnimatedDrawingsAdapter
    src = tmp_path / "o.png"; Image.new("RGB", (64, 64), "white").save(src)
    a = AnimatedDrawingsAdapter()
    a.min_bytes = 100
    r = a.run(JobInput(1, "animate_render", tmp_path, {"original": src}, threading.Event()))
    assert r.outcome == "ok", r.diagnostic
    assert open(r.outputs["result_animated"], "rb").read(12)[4:8] == b"ftyp"
    monkeypatch.setenv("SLOW", "1")
    ev = threading.Event(); threading.Timer(0.5, ev.set).start()
    t = time.monotonic()
    r = a.run(JobInput(2, "animate_render", tmp_path / "x", {"original": src}, ev))
    assert r.diagnostic == "cancelled_midway" and time.monotonic() - t < 7     # SIGTERM → 5초 뒤 SIGKILL 안에 끝남
