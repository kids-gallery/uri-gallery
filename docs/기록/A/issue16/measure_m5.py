import json
import resource
import shutil
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageDraw
from adapters.base import JobInput
from adapters.m5_depth import DepthAnythingAdapter

mode = sys.argv[1]
if mode not in ("prepare", "measure"):
    raise SystemExit("prepare 또는 measure를 지정하세요.")

adapter = DepthAnythingAdapter()

started = time.perf_counter()
adapter.ensure_loaded()
load_s = time.perf_counter() - started

if mode == "prepare":
    print(json.dumps({
        "model": "M5",
        "preparation_s": round(load_s, 3),
        "revision": adapter.revision,
        "note": "다운로드가 포함될 수 있는 준비 시간",
    }, ensure_ascii=False, indent=2))

else:
    with tempfile.TemporaryDirectory() as directory:
        tmp = Path(directory)

        image = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)
        draw.ellipse(
            (60, 30, 196, 150),
            fill=(250, 200, 60, 255),
            outline=(0, 0, 0, 255),
            width=4,
        )
        draw.rectangle(
            (100, 150, 156, 240),
            fill=(60, 120, 220, 255),
            outline=(0, 0, 0, 255),
            width=4,
        )

        source = tmp / "cutout.png"
        image.save(source)
        image.save("/results/M5-input.png")

        started = time.perf_counter()
        result = adapter.run(JobInput(
            job_id=1,
            stage_kind="depth_relief",
            tmp_dir=tmp,
            inputs={"cutout": source},
        ))
        inference_s = time.perf_counter() - started

        output_valid = False
        if result.outcome == "ok":
            output = Path(result.outputs["result_relief"])
            with Image.open(output) as depth:
                output_valid = depth.size == (256, 256)
            shutil.copy2(output, "/results/M5-depth.png")

        report = {
            "model": "M5",
            "device": adapter.device,
            "revision": adapter.revision,
            "input": "256x256 합성 컷아웃 한 장",
            "load_s": round(load_s, 3),
            "inference_s": round(inference_s, 3),
            "process_peak_rss_mib": round(
                resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024,
                1,
            ),
            "outcome": result.outcome,
            "diagnostic": result.diagnostic,
            "output_valid": output_valid,
        }

        Path("/results/M5-measure.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))

        if result.outcome != "ok" or not output_valid:
            raise SystemExit(2)
