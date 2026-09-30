# 모듈카드 — team1 (우리 아이 미술관)

| # | 칸 | 내용 |
|---|---|---|
| 1 | 팀 · 폴더 | 1팀 · `team1_museum/` (저장소 최상위) |
| 2 | 포트 · 외부 주소 | 수업 규칙 9541 · https://p1.sumzip.com/model-api — **지금 9541은 서비스 model-api가 사용, 외부 `/model-api`는 공개 범위 팀 결정(A·D) 전이라 404** |
| 3 | 모델 | M2 OpenCLIP ViT-B-32 / laion2b_s34b_b79k (`M2-1a25a44-u4`, 서비스 활성 버전과 같은 가중치 sha256 `ac4f8c4b…`) |
| 4 | 입력 | `image_base64` 한 칸 — PNG·JPEG, 20MB 이하, 짧은 변 64px 이상. 모르는 칸은 422(`extra="forbid"`) |
| 5 | 출력 | `label`(사람·동물·집·사물 그림·판단보류) · `warnings` · `model_version` — **점수는 내지 않는다**(BR-SUG-02) |
| 6 | 판단보류 | 최고 확률 < TAU 0.5 → 200 + 판단보류 → `review_queue.jsonl`(req_id·사유만). TAU 근거: 네 갈래 균등 0.25의 두 배 [추론] — T137 측정 뒤 교체 |
| 7 | 적재 | lifespan 1회(가중치 지문 대조 + 추론 1회), 약 4초. 요청 경로에 적재 없음 |
| 8 | 시험 | `test_app.py` 5 passed · TAU를 0.3으로 낮추면 경계값 시험이 실패함을 확인(시험이 실제로 잡는다) |
| 9 | 공용 파일 대조 | 아래 표 — 수업본(`project2608/models/modelapi/team1_apt`)과 md5 같음, 고친 것 없음 |

| 파일 | md5 | 수업본과 |
|---|---|---|
| `app.py` | `30d7dda857b5fb28033110c1fbdfa435` | 같음 |
| `bench.py` | `d5ac2e7236a2e4a0796d7b17de7eea2c` | 같음 |
| `metrics.py` | `363dc2939723887be9721d93432efa12` | 같음 |
