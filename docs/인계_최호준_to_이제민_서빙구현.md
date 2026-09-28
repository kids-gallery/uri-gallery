# 인계 — 최호준(A) → 이제민(B)·신지현(C): 서빙 구현 1차와 계약 보완 요청

> 작성: 2026-09-28 · A 최호준 세션 · 브랜치 `a/model-serving`(main에 병합 전)
> A는 tasks.md·계약 정본·DDL을 고치지 않는다. 아래는 소유자에게 요청하는 것이다.

## 1. 구현한 것 (A 담당, 시험 49건 통과 + 실모델 시험 3건·공유 Ollama 실호출 1건)

| 작업 | 파일 |
|---|---|
| T005 | `serving/pyproject.toml`, `serving/requirements.lock`(해시 잠금), Python 3.11 `.venv` |
| T027·T028 | `serving/common/{config,db,storage,logging}.py` — UTC 세션, `family/·tmp/·ext/` 경로, 허용 목록 로거 |
| T029 | `serving/adapters/{base,fake,registry}.py` — `AdapterResult`(+`values` 보완), `UAM_FAKE_FAULTS="stage=outcome*n"` |
| T030·T031·T032 | `serving/workers/{runner,outcome,context,records,main}.py`, `serving/config/*.yaml` |
| T034·T073 | `serving/tests/test_stage_job_contract.py`, `test_downgrade_chain.py`(5종 오류 × 결과 단계 2종) |
| T064·T065 | `serving/workers/stages/{split,judge}.py`, `serving/rules/m4_geometry.py` |
| T076·T077 | `serving/workers/stages/results.py`, `serving/workers/chain.py` |
| T109 | `serving/model_api/{internal,app,main}.py`, `console.html` — 적재 상태·웜업(`docs/A_모델적재_화면요구.md`) |
| T126 | `serving/llm_server/{app,ollama_client,caption,main}.py`, `models/manifest.yaml` M6, `docs/A_모델재현기록.md` |
| T070·T071·T082 | M1·M2·M5 재현(리비전·SHA-256·적재·추론·메모리) + 실제 어댑터 `serving/adapters/{m1_birefnet,m2_openclip,m5_depth}.py`, `requirements-models.lock` |
| (T072·T083 일부) | M3 어댑터 `m3_render.py` — 가짜 TorchServe·가짜 AD로만 시험. 실제는 T081 뒤 |
| 운영 CLI | `serving/ops/models.py` — prepare·check·measure·register·status |

재현 전 모델만 가짜로: `UAM_FAKE_MODELS=M3`(목록) — 지금은 M1·M2·M5 실제 + M3 가짜로 전체 흐름이 돈다.

시험 DB는 임시 mariadbd(소켓 `/tmp/uamt*`)에 `design/uri_gallery_ddl.sql` + 큐 보완 대역(`serving/tests/sql/impl_queue_fixture.sql`)을 넣는다. `db/migrations/0100_impl_queue.sql`(T014)이 생기면 그것을 먼저 쓴다.

## 2. B에게 요청

| # | 대상 | 내용 | 이유 |
|:--:|---|---|---|
| 1 | T014 `0100_impl_queue.sql` | S3의 `CHECK (origin <> 'eval' OR (artwork_id IS NULL AND evaluation_id IS NOT NULL))`는 **MariaDB가 거부한다**(ERROR 1901 — `artwork_id`가 `ON DELETE SET NULL` FK). `trg_stage_job_bi` 안의 `SIGNAL`로 옮긴다. 대역 파일에 동작하는 예시가 있다 | 2026-09-28 실측 |
| 2 | `contracts/model-api.openapi.yaml` | `/internal/ready` 응답에 `models[]` 추가, `/internal/models`·`/internal/models/{id}/warmup`·`/internal/console` 경로 추가(형식: `docs/A_모델적재_화면요구.md` §2.2) | 적재 시간 화면 요구 |
| 3 | T008 `ops/ecosystem.config.cjs` | 아래 §4 항목 | 진입점이 생겼다 |
| 4 | llm-contract §1 호출자 상한 30초 | 공유 Ollama 규칙은 **클라이언트 타임아웃 300초 이상**(앞 사람 요청 대기 포함). llm-server→Ollama는 300초로 두었다. app-api→llm-server 30초는 유지하되, 30초에 끊기면 G15 선택지로 가는 것이 정상 동작임을 계약에 적어 달라 | 규칙 충돌 |
| 5 | research R-22 · llm-contract §3 · tasks T126 | M6 태그 `qwen3:4b` → **`qwen3:4b-instruct-2507-q4_K_M`**. 공유 서버의 `qwen3:4b`는 생각 전용 모델(Thinking-2507)과 같은 블롭이라 생각 과정을 끌 수 없다(`docs/A_모델재현기록.md`) | 실측 |
| 6 | `api` 진행 응답·운영 경로 | `docs/A_모델적재_화면요구.md` §4 | 적재 중을 오류와 구별 |
| 8 | `limits.yaml`·pm2 | M1(BiRefNet) CPU 추론 중 RSS 8.5GB — 팀 서버 RAM 확인(T068) 전에는 worker-cpu를 1개로 | 실측 |
| 9 | 팀 서버 준비 | Homebrew ffmpeg가 깨져 있다(`libx265.215.dylib` 없음). 서빙은 `imageio-ffmpeg` 고정 바이너리를 쓰므로 영향 없음 — 다른 용도로 ffmpeg가 필요하면 `brew reinstall ffmpeg` | 실측 |
| 7 | US5 이야기(T085·T090) | 공동 보호자 두 명이 같은 이야기를 동시에 고치는 충돌: `story`에 버전 컬럼(또는 `updated_at` 비교) + 409 `story_conflict`("다른 보호자가 먼저 고쳤어요") 작업이 tasks.md에 없다. spec 인계 문서 §2의 "이야기 동시 수정 충돌 안내"에 해당 | 누락 |

## 3. C에게 요청

- S3·S4·S7·S11 문구와 동작: `docs/A_모델적재_화면요구.md` §3.
- `caption/` 패키지가 생기면 `build_messages(inp)`, `rule_check(text, inp) -> None|fail_*`, `template(inp)`를 내보내 달라. llm-server가 자동으로 그것을 쓴다(없으면 `serving/llm_server/caption.py`의 최소 구현). 최소 구현의 예시 2개·규칙 문구는 실측으로 고른 것이니 참고만.

## 4. pm2 항목 (T008에 붙일 것)

```js
// serving/ 아래, venv 파이썬. 모두 127.0.0.1
{ name: "model-api",  cwd: "serving", script: ".venv/bin/python", args: "-m model_api.main" },
{ name: "worker-cpu", cwd: "serving", script: ".venv/bin/python", args: "-m workers.main --group cpu_vision", kill_timeout: 10000 },
{ name: "worker-gpu", cwd: "serving", script: ".venv/bin/python", args: "-m workers.main --group gpu", kill_timeout: 10000 },
// P0.5
// { name: "llm-server", cwd: "serving", script: ".venv/bin/python", args: "-m llm_server.main",
//   env: { OLLAMA_URL: "http://127.0.0.1:11434", OLLAMA_CHAT_MODEL: "qwen3:4b-instruct-2507-q4_K_M" } },
```

## 5. 남은 A 작업

T068·T069(자원 확인·라이선스 기록), T072(M3 관절 실제 확인), T081·T083(M3 TorchServe 재현·렌더 실제 확인), T117·T118·T122(평가·외부 작업), T131·T132·T137. 워커는 한 프로세스에 작업 1건씩 처리한다 — 단계별 동시 처리 상한(`limits.yaml concurrency`)은 pm2 인스턴스 수로 맞춘다.
