"""M3 Meta Animated Drawings — TorchServe(네이티브, 127.0.0.1) 관절 추출 + 헤드리스 렌더(T072·T083).

- 관절(judge): drawn_humanoid_detector → 가장 높은 점수 상자로 자르기 → drawn_humanoid_pose_estimator(COCO 17점)
  → Animated Drawings char_cfg와 같은 skeleton(root·hip·torso·neck·어깨·팔꿈치·손·엉덩이·무릎·발) JSON
- 렌더(animate_render): 별도 venv의 Animated Drawings `examples/image_to_animation.py` 하위 프로세스 → GIF → ffmpeg MP4(H.264, 무음)
  취소·시간 초과: SIGTERM → 5초 뒤 SIGKILL(stage-job §7)
환경: TORCHSERVE_URL(예측 8080), M3_AD_PYTHON(AD venv 파이썬), M3_AD_ROOT(AD 저장소), FFMPEG(없으면 imageio-ffmpeg 고정 바이너리).

⚠️ T081(TorchServe·AD 네이티브 재현) 전이라 실제 환경에서 돌려 보지 않았다. 형식은 AD 저장소 image_to_annotations.py 기준.
"""
from __future__ import annotations

import json
import os
import signal
import subprocess
import time
import urllib.request
import uuid
from pathlib import Path

from common.config import load_settings, load_yaml

from .base import Adapter, AdapterResult, JobInput

DETECTOR, POSE = "drawn_humanoid_detector", "drawn_humanoid_pose_estimator"
# COCO 17점 → AD skeleton (image_to_annotations.py와 같은 대응)
_PAIRS = [("neck", 0), ("right_shoulder", 6), ("right_elbow", 8), ("right_hand", 10), ("left_shoulder", 5),
          ("left_elbow", 7), ("left_hand", 9), ("right_hip", 12), ("right_knee", 14), ("right_foot", 16),
          ("left_hip", 11), ("left_knee", 13), ("left_foot", 15)]


def _bundled_ffmpeg() -> str:
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def _multipart(field: str, data: bytes) -> tuple[bytes, str]:
    b = uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"x.png\"\r\n"
            f"Content-Type: image/png\r\n\r\n").encode() + data + f"\r\n--{b}--\r\n".encode()
    return body, f"multipart/form-data; boundary={b}"


class AnimatedDrawingsAdapter(Adapter):
    model_id = "M3"
    CONFIG = {"detector": DETECTOR, "pose": POSE, "motion": "default", "video": "mp4-h264-24fps"}

    def __init__(self):
        super().__init__()
        s = load_settings()
        self.ts = s.torchserve_url.rstrip("/")
        self.ad_python = os.environ.get("M3_AD_PYTHON")
        self.ad_root = os.environ.get("M3_AD_ROOT")
        self.ffmpeg = os.environ.get("FFMPEG") or _bundled_ffmpeg()
        self.min_bytes = load_yaml("thresholds")["animate_render"]["min_output_bytes"]

    # 적재 = TorchServe에 두 모델이 올라가 있는지 확인(가중치는 TorchServe가 들고 있다)
    def load(self) -> None:
        with urllib.request.urlopen(self.ts + "/ping", timeout=5) as r:
            if json.load(r).get("status") != "Healthy":
                raise RuntimeError("torchserve_unhealthy")

    def _predict(self, model: str, png: bytes):
        body, ctype = _multipart("data", png)
        req = urllib.request.Request(f"{self.ts}/predictions/{model}", data=body, headers={"Content-Type": ctype})
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)

    def joints(self, job: JobInput) -> AdapterResult:
        import io

        from PIL import Image

        try:
            img = Image.open(job.inputs["original"]).convert("RGB")
        except (OSError, KeyError):
            return AdapterResult("storage", diagnostic="input_unreadable")
        buf = io.BytesIO(); img.save(buf, "PNG")
        try:
            det = sorted(self._predict(DETECTOR, buf.getvalue()), key=lambda d: d["score"], reverse=True)
        except OSError:
            return AdapterResult("engine_down", diagnostic="torchserve_detector")
        if not det:
            return AdapterResult("ok", values={}, diagnostic="no_humanoid")   # 관절 없음 → geometry_pass 없음 → animated 제안 안 함
        x1, y1, x2, y2 = [int(v) for v in det[0]["bbox"]]
        crop = img.crop((x1, y1, x2, y2))
        buf = io.BytesIO(); crop.save(buf, "PNG")
        try:
            kp = self._predict(POSE, buf.getvalue())[0]["keypoints"]
        except (OSError, IndexError, KeyError):
            return AdapterResult("engine_down", diagnostic="torchserve_pose")
        mid = lambda a, b: [round((kp[a][0] + kp[b][0]) / 2), round((kp[a][1] + kp[b][1]) / 2)]
        skel = [{"name": "root", "loc": mid(11, 12)}, {"name": "hip", "loc": mid(11, 12)}, {"name": "torso", "loc": mid(5, 6)}]
        skel += [{"name": n, "loc": [round(kp[i][0]), round(kp[i][1])]} for n, i in _PAIRS]
        out = job.tmp_dir / "joints.json"
        out.write_text(json.dumps({"skeleton": skel, "bbox": [x1, y1, x2, y2]}))
        return AdapterResult("ok", score=float(det[0]["score"]), outputs={"joints": str(out)})

    def _run_proc(self, args: list[str], job: JobInput, cwd: str | None) -> int | None:
        p = subprocess.Popen(args, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        while p.poll() is None:
            if job.cancel.wait(0.5):
                os.killpg(p.pid, signal.SIGTERM)
                try:
                    p.wait(5)
                except subprocess.TimeoutExpired:
                    os.killpg(p.pid, signal.SIGKILL)
                return None
        return p.returncode

    def render(self, job: JobInput) -> AdapterResult:
        if not (self.ad_python and self.ad_root):
            return AdapterResult("model_not_ready", diagnostic="ad_env_missing")
        out_dir = job.tmp_dir / "ad"
        rc = self._run_proc([self.ad_python, "image_to_animation.py", str(job.inputs["original"]), str(out_dir)],
                            job, cwd=str(Path(self.ad_root) / "examples"))
        if rc is None:
            return AdapterResult("engine_down", diagnostic="cancelled_midway")
        gif = out_dir / "video.gif"
        if rc != 0 or not gif.exists():
            # 사람 모양을 못 찾으면 AD가 실패한다 — 품질 미달로 낮춘다(인프라 오류와 구분: TorchServe가 살아 있을 때만)
            try:
                self.load()
            except Exception:
                return AdapterResult("engine_down", diagnostic="torchserve_down")
            return AdapterResult("quality_below", diagnostic="ad_failed")
        mp4 = job.tmp_dir / "animated.mp4"
        rc = self._run_proc([self.ffmpeg, "-y", "-loglevel", "error", "-i", str(gif), "-an", "-c:v", "libx264",
                             "-pix_fmt", "yuv420p", "-r", "24", "-movflags", "+faststart",
                             "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", str(mp4)], job, cwd=None)
        if rc is None:
            return AdapterResult("engine_down", diagnostic="cancelled_midway")
        if rc != 0 or not mp4.exists():
            return AdapterResult("engine_down", diagnostic="ffmpeg_failed")
        if mp4.stat().st_size < self.min_bytes:
            return AdapterResult("quality_below", diagnostic="empty_render")
        return AdapterResult("ok", outputs={"result_animated": str(mp4)})

    def run(self, job: JobInput) -> AdapterResult:
        if job.stage_kind == "judge":
            return self.joints(job)
        if job.stage_kind == "animate_render":
            return self.render(job)
        return AdapterResult("engine_down", diagnostic="unsupported_stage")
