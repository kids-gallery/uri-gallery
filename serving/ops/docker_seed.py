"""시험 환경 시드(SD_04 10-6) — 개발 묶음(compose.dev.yaml)에서만 한 번 돈다.

새 DB에는 활성 모델 버전이 없어 판정이 돌지 않는다. 정상 절차는 평가 → 승격(G22)이다.
시험 환경에서는 그 절차를 건너뛰고 models/manifest.yaml의 해시·라이선스 확인 값으로 버전을 active로 넣는다.
- 이미 활성 버전이 있는 모델은 건드리지 않는다(다시 돌려도 같은 결과).
- 매니페스트에 weights_sha256·config_hash가 없거나 license_confirmed가 참이 아니면 넣지 않는다(DB CHECK와 같은 조건).
- 배포 묶음에는 넣지 않는다. 모델은 진짜로 돈다(가짜 어댑터를 켜지 않는다).

  python -m ops.docker_seed [M1 M2 M3 M5]
"""
from __future__ import annotations

import sys

from common.config import load_manifest
from common.db import connect, tx

DEFAULT = ["M1", "M2", "M3", "M5"]


def main(argv: list[str]) -> int:
    want = argv or DEFAULT
    models = load_manifest()["models"]
    conn = connect()
    done = []
    with tx(conn) as cur:
        for mid in want:
            m = models.get(mid) or {}
            if not (m.get("weights_sha256") and m.get("config_hash") and m.get("license_confirmed") is True):
                print(f"{mid}: 건너뜀(매니페스트에 해시·라이선스 확인이 없음)")
                continue
            cur.execute("SELECT version_id FROM model_version WHERE model_id = %s AND release_state = 'active'", (mid,))
            if cur.fetchone():
                print(f"{mid}: 이미 활성 버전이 있음")
                continue
            label = f"seed-{str(m.get('revision') or 'none')[:8]}"
            cur.execute(
                """INSERT INTO model_version (model_id, version_label, weights_sha256, runtime, config_hash,
                       license_confirmed, release_state, exec_device)
                   VALUES (%s, %s, %s, %s, %s, TRUE, 'active', 'cpu')
                   ON DUPLICATE KEY UPDATE release_state = 'active'""",
                (mid, label, m["weights_sha256"], m.get("runtime"), m["config_hash"]))
            done.append(mid)
    conn.close()
    print("시험 시드 활성:", ", ".join(done) if done else "없음")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
