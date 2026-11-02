import json
import resource
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageDraw
from adapters.base import JobInput
from adapters.m2_openclip import OpenClipAdapter

mode = sys.argv[1]
adapter = OpenClipAdapter()

# 프로세스당 모델을 한 번만 적재합니다.
started = time.perf_counter()
adapter.ensure_loaded()
load_s = time.perf_counter() - started

if mode == "prepare":
    print(json.dumps({
        "mode": mode,
        "preparation_s": round(load_s, 3),
        "revision": adapter.revision,
        "note": "다운로드가 포함될 수 있어 적재 성능과 구분",
    }, ensure_ascii=False, indent=2))

elif mode == "measure":
    with tempfile.TemporaryDirectory() as directory:
        tmp = Path(directory)

        image = Image.new("RGB", (256, 256), (245, 243, 236))
        draw = ImageDraw.Draw(image)
        draw.ellipse(
            (80, 20, 176, 116),
            fill="gold", outline="black", width=4,
        )
        draw.rectangle((100, 116, 156, 235), fill="blue")

        source = tmp / "input.png"
        image.save(source)
        image.save("/results/M2-input.png")

        started = time.perf_counter()
        result = adapter.run(JobInput(
            job_id=1,
            stage_kind="judge",
            tmp_dir=tmp,
            inputs={"original": source},
        ))
        inference_s = time.perf_counter() - started

        report = {
            "model": "M2",
            "device": adapter.device,
            "revision": adapter.revision,
            "input": "256x256 합성 그림 한 장",
            "load_s": round(load_s, 3),
            "inference_s": round(inference_s, 3),
            "process_peak_rss_mib": round(
                resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024,
                1,
            ),
            "outcome": result.outcome,
            "diagnostic": result.diagnostic,
        }

        Path("/results/M2-measure.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))

        if result.outcome != "ok":
            raise SystemExit(2)
else:
    raise SystemExit("prepare 또는 measure를 지정하세요.")
