# eval/ — 모델 평가 (담당 A 최호준)

UC9 모델 평가·승격의 서빙 쪽이다(SD_01 P8 8.4·8.5, stage-job §12). 평가 요청·판단·승격은 app-api(`/v1/admin/models/*`, G20~G22)와 운영 화면 S11이 맡는다.

| 파일 | 역할 |
|---|---|
| `runner.py` | `run --group cpu_vision\|gpu` — pm2 없이 평가 작업만 처리하는 일회성 워커. `report <evaluation_id> [--json]` — 후보·활성 버전 나란히 보고서 |
| `items/manifest.yaml` | 평가 묶음 목록(T118, 팀원 제작 작품만 — BR-MDL-04). 아직 없음 |

평가 작업 자체는 운영 워커(`serving/workers/stages/eval.py`)도 보호자 작업이 없을 때 처리한다. 결과는 `eval_item_result`(결과 경로·처리 시간·메모리·점수 기록만)에 남는다.

```bash
# 저장소 루트에서, serving 가상환경의 파이썬으로
serving/.venv/bin/python eval/runner.py run --group cpu_vision
serving/.venv/bin/python eval/runner.py report 12
```

- 가족 작품·공개 이미지는 평가 묶음에 넣지 않는다(G20, BR-MDL-04, BR-ACC-03).
- 인프라 오류 3회 소진 항목은 "평가 미완료", 시간 상한 초과는 "시간 초과"로 남는다(UC9 E4). 미완료가 있으면 승격 근거가 되지 않는다(`v_promotion_eligibility`).
- 점수는 보고서에 싣지 않는다(BR-PRC-04).
