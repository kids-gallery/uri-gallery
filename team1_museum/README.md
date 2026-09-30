# team1_museum — 1팀 우리 아이 미술관 · 수업 점검 규격 모델 API

MS 과정 API 서비스 점검(`docs/B/API_서비스_점검.pdf` 5쪽)의 **수업본 8파일 구조**를 우리 모델로 갖춘 폴더다.
아이 그림 사진 한 장을 받아 **무엇을 그렸는지**(사람·동물·집·사물 그림) 답하고, 확신이 낮으면 **판단보류**를 돌려준다.
모델은 서비스와 같은 **M2 OpenCLIP ViT-B-32**(같은 가중치·같은 프롬프트)다. 설계: `design/SD_04_아키텍처설계서_우리아이미술관.md` §3-4b.

## 파일

| 파일 | 역할 | 비고 |
|---|---|---|
| `app.py` · `metrics.py` · `bench.py` | 공용(수업본 그대로, md5 같음) | 고치지 않는다 |
| `predict.py` | 모델을 부르는 유일한 곳 | `_load()` 기동 시 1회 · TAU 미만 판단보류 |
| `schemas.py` | 계약 | `extra="forbid"` · PNG·JPEG base64 한 장 · 배치 1~32 · 응답 3칸(점수 없음) |
| `settings.py` | 설정 | `.env`로 바꾼다 |
| `test_app.py` | 배포 전 3분 5종 | |
| `model/` | 팀 산출물 | 가중치 지문(`weights.json`) · 프롬프트(`m2_prompts.yaml`) — 가중치 파일은 `../models/hf` 캐시 |
| `examples/` | 예시 요청 | `request.json`(사람 그림) · `request_batch.json`(사람·집·고양이) · `images/`(코드로 그린 선 그림, 실제 아동 그림 아님) |
| `requirements.txt` · `.env.example` · `모듈카드_team1.md` | 부속 | |

## 띄우기

```bash
cd team1_museum
python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt   # 한 번
.venv/bin/python -m pytest -q test_app.py                                # 배포 전 3분 — 5 passed
.venv/bin/uvicorn app:app --host 127.0.0.1 --port <포트> --root-path /model-api --workers 1
```

- 포트: 수업 규칙은 9541이지만 **지금 9541은 서비스의 model-api가 쓴다.** 공개 범위 팀 결정(A·D) 전에는 서버로 띄우지 않고 `pytest`(TestClient)로만 확인한다.
- `bench.py`(공용)는 `http://127.0.0.1:8000`을 잰다 — 재려면 `--port 8000`으로 잠깐 띄운다.
- 가중치는 내려받지 않는다(`HF_HUB_OFFLINE=1`). 기동할 때 sha256을 `model/weights.json`과 대조하고 다르면 기동을 멈춘다.

## 경로

| 경로 | 메서드 | 하는 일 |
|---|---|---|
| `/health` | GET | 준비됐나 — 적재 전 `loading`, 뒤 `ok` |
| `/predict` | POST | 한 장 판단 `{"image_base64": "..."}` → `{"label", "warnings", "model_version"}` |
| `/predict/batch` | POST | 여러 장(1~32) |
| `/metrics` | GET | 다섯 숫자 |
| `/docs` · `/openapi.json` | GET | 계약 문서(FastAPI 자동) |

| 상태코드 | 뜻 | 누가 고치나 |
|---|---|---|
| 200 | 판단함(판단보류 포함) | — |
| 422 | 계약 위반(모르는 칸·base64 아님·PNG/JPEG 아님·20MB 초과·64px 미만·배치 0개/33개) | 부르는 쪽 |
| 500 | 서버 판단 실패 | 우리 |
| 503 | 모델 준비 중 | 우리(기다렸다 다시) |

문의: 1팀 우리 아이 미술관 팀 슬랙 채널(응답 헤더 `X-Request-ID`를 함께).
