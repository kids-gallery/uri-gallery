# Quickstart: 우리 아이 미술관 — Docker 없이 로컬·팀 서버 전개

**Created**: 2026-09-28 · **Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) R-01·R-02·R-03
**대상**: 구현 담당 A(모델 서빙)·B(API)·C(웹) 팀원

> Docker 컨테이너를 쓰지 않는다(Intent-Plan). 모든 구성요소는 호스트 네이티브 프로세스이며 pm2로 관리한다.
> 비밀번호는 이 문서에 적지 않는다. 팀 DB 접속 정보는 `.env`(git 제외)에서만 읽는다.

## 0. 준비물

| 항목 | 버전 | 설치(macOS, Homebrew) | 비고 |
|---|---|---|---|
| Node.js | **20 LTS** | `brew install node@20` 또는 nvm `nvm install 20` | 저장소 `.nvmrc`=20 |
| Python | 3.11 | `brew install python@3.11` | model-api·워커 |
| Python(M3 전용) | 3.8.13 | conda 접두사 환경 `serving/.venv-m3`(research R-03) | Homebrew에 설치하지 않음 |
| Java · OSMesa | 17 · Mesa<25.1 | 같은 conda 환경(conda-forge `openjdk=17`, `mesalib<25.1`) | TorchServe(M3)·헤드리스 렌더 |
| MariaDB 클라이언트 | 12.x | `brew install mariadb` | 로컬 시험 DB `uam_test`도 여기서 |
| nginx | 1.2x | `brew install nginx` | 리버스 프록시 |
| ffmpeg | (설치 불필요) | 서빙은 `imageio-ffmpeg` 고정 바이너리 사용 | GIF → MP4(research R-07). Homebrew ffmpeg는 Studio-B에서 깨져 있음(`libx265` 없음) — 다른 용도로 필요하면 `brew reinstall ffmpeg` |
| pm2 | 최신 | `npm i -g pm2` | 프로세스 관리 |
| Mailpit | 최신 | `brew install mailpit` | P0 메일 수신함(SMTP :1025, 웹 :8025) — 실제 발송 없음(R-23) |
| Ollama (P0.5) | 최신 | `brew install ollama` | M6 **Qwen3-4B** 실행기 — 공유 Ollama(127.0.0.1:11434 — IPv6 `localhost`가 아닌 IPv4로)에 `qwen3:4b-instruct-2507-q4_K_M` 1회 pull(사람이, 런타임 코드에는 없음). 매니페스트 다이제스트 확인(R-22) |

## 1. 저장소 배치

```
project2610/
├── web/                # C  Vue 3 + TS + Vite + Pinia
├── api/                # B  Node 20 + Express + TS + mysql2
├── db/migrations/      # B  NNNN_*.sql
├── serving/            # A  Python: model_api(FastAPI) · workers · adapters · config
├── caption/            # C  Python 패키지 (P0.5 규칙 검사·템플릿)
├── eval/               # A  평가 묶음 실행기·항목 메타
├── models/manifest.yaml# A  버전 매니페스트 원천
├── contracts/          # B  stage-job.md · openapi.yaml (→ .specify/features/…/contracts 사본과 동기)
└── ops/                #    nginx.conf · ecosystem.config.cjs · 운영 CLI
```

## 2. 환경 변수 (`.env`, git 제외)

`.env.example`의 키에 아래를 더한다.

```dotenv
DB_HOST=            # 팀 DB (외부 접속 호스트)
DB_PORT=
DB_USER=
DB_NAME=ABC10pioneer1
DB_PASSWORD=        # 문서·커밋에 적지 않음

APP_PORT=9521                      # app-api (127.0.0.1)
MODEL_API_PORT=9541                # model-api (127.0.0.1)
MODEL_API_INTERNAL_URL=http://127.0.0.1:9541
SESSION_SECRET=                    # openssl rand -hex 32
STORAGE_ROOT=/srv/uam/store        # 로컬 개발은 ./.data/store
MODEL_ROOT=/srv/uam/models         # U14 — 팀 서버 확인 후
GPU_ENABLED=false                  # U2
UAM_FAKE_MODELS=1                  # 모델 없이 흐름 개발·장애 주입 시험
TORCHSERVE_URL=http://127.0.0.1:8080
OLLAMA_URL=http://127.0.0.1:11434  # P0.5
LLM_SERVER_URL=http://127.0.0.1:8200 # P0.5 llm-server
MAIL_SMTP_URL=smtp://127.0.0.1:1025 # P0 Mailpit (U19 확정 시 교체)
MAIL_FROM=no-reply@localhost       # U19
APP_BASE_URL=http://127.0.0.1:9501 # 메일 링크 기준 주소
AUTH_HMAC_SECRET=                  # 요청 한도용 이메일·IP 해시 키
```

## 3. 처음 설치

```bash
# DB 스키마 (팀 DB 또는 로컬 uam_test)
#   0001_sd03_baseline = design/uri_gallery_ddl.sql(SD_03 정본, 구현 보완 S1~S9 포함)
cd api && npm ci && npm run db:migrate          # 재실행 안전

# 메일 수신함 (P0)
mailpit &                                       # http://127.0.0.1:8025 에서 가입·찾기·초대 메일 확인

# 앱 API
npm run dev                                     # http://127.0.0.1:9521  (/live, /ready)

# 웹
cd ../web && npm ci && npm run dev              # http://127.0.0.1:9501  (/app, /ops)

# 모델 API·워커 (가짜 모델로 먼저)
cd ../serving
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.lock --require-hashes
UAM_FAKE_MODELS=1 uvicorn model_api.main:app --host 127.0.0.1 --port 9541
UAM_FAKE_MODELS=1 python -m workers.run --group cpu
UAM_FAKE_MODELS=1 python -m workers.run --group gpu
```

실제 모델(A 담당, 1~2일차 재현 뒤):

```bash
# M1·M2·M5: 같은 .venv, 가중치를 MODEL_ROOT에 두고 매니페스트 해시 확인
python -m serving.tools.verify_manifest ../models/manifest.yaml

# M3: 별도 가상환경 + TorchServe 네이티브 (127.0.0.1 바인딩)
conda activate ./.venv-m3   # conda 접두사 환경(R-03)
torchserve --start --ncs --ts-config ../ops/torchserve/config.properties \
  --model-store "$MODEL_ROOT/m3/model-store" --models drawn_humanoid_detector.mar drawn_humanoid_pose_estimator.mar
curl -s http://127.0.0.1:8080/ping              # {"status": "Healthy"}
```

## 4. pm2로 함께 띄우기

```bash
cd ops && pm2 start ecosystem.config.cjs        # app-api · model-api · worker-cpu · worker-gpu · sweeper
# 서빙 진입점(A, serving/): model-api = `.venv/bin/python -m model_api.main`,
#   worker-cpu = `-m workers.main --group cpu_vision`, worker-gpu = `-m workers.main --group gpu`(kill_timeout 10000),
#   llm-server = `-m llm_server.main`(P0.5). 워커는 프로세스당 작업 1건 — 단계별 동시 처리는 pm2 인스턴스 수로 맞춘다.
#   M1 CPU 추론 중 RSS 8.5GB(A 실측)라 팀 서버 RAM 확인(T068) 전에는 worker-cpu 인스턴스 1개
# (P0.5) llm-server: 큐 워커가 아닌 내부 동기 서버 — 127.0.0.1:8200 → Ollama(qwen3:4b-instruct-2507-q4_K_M)
#   공유 Ollama는 http://127.0.0.1:11434 로만 부른다(localhost는 ::1의 다른 인스턴스로 붙을 수 있음)
#   pm2 start ecosystem.config.cjs --only llm-server
#   curl -s http://127.0.0.1:8200/v1/ready
pm2 status && pm2 logs --lines 50
pm2 save && pm2 startup                          # 재부팅 시 자동 시작(launchd)
```

nginx(`ops/nginx.conf`) 핵심 라우팅:

| 경로 | 대상 |
|---|---|
| `/` , `/app/*`, `/ops/*` | `web/dist` 정적 파일(SPA fallback) |
| `/v1/models/*` | model-api `127.0.0.1:9541` |
| `/v1/*`, `/live`, `/ready`, `/openapi.json` | app-api `127.0.0.1:9521` |
| `/metrics` | app-api, 내부망 allow 목록만 |
| `/_files/*` | `internal;` — app-api의 `X-Accel-Redirect`로만 |
| TorchServe 8080~8082, Ollama 11434, llm-server 8200, `/internal/*` | 노출 안 함 |

`client_max_body_size 21m;`(20MB 상한 + 여유, BR-INT-01).

## 5. 동작 확인 (P0 수용 시나리오 축약)

`UAM_FAKE_MODELS=1`로 모델 없이 확인할 수 있다.

```bash
BASE=http://127.0.0.1:9521
curl -s $BASE/live                                        # {"status":"live"}
curl -s $BASE/ready | jq                                   # db/queue/storage true, M1~M7 상태

# 보호자 가입(D18) → 메일 링크 확인 → 로그인
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/v1/auth/signup -H 'content-type: application/json' \
  -d '{"email":"guardian@test.local","password":"********","passwordConfirm":"********"}'   # 202 (이미 가입돼 있어도 202)
TOKEN=$(curl -s http://127.0.0.1:8025/api/v1/message/latest | jq -r '.Text' | grep -o 'token=[A-Za-z0-9_-]*' | cut -d= -f2)
curl -s -o /dev/null -w '%{http_code}\n' -X POST $BASE/v1/auth/email/verify -H 'content-type: application/json' -d "{\"token\":\"$TOKEN\"}"   # 204 (재사용하면 400 token_invalid)
curl -c jar -s -X POST $BASE/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"guardian@test.local","password":"********"}'                                # 204

# 아이 등록 → 사진 접수
CHILD=$(curl -b jar -s -X POST $BASE/v1/children -H 'content-type: application/json' \
  -d '{"alias":"하늘"}' | jq -r .id)                     # 같은 별칭이 있어도 저장, aliasDuplicate=true 안내(D18)
ART=$(curl -b jar -s -X POST $BASE/v1/artworks -H "Idempotency-Key: $(uuidgen)" \
  -F childId=$CHILD -F photo=@eval/samples/person_01.jpg | jq -r .id)   # 202

# 판정 → 확정 → 결과 → 결정 → 이야기 → 전시
curl -b jar -s $BASE/v1/artworks/$ART | jq '.state,.suggestion'           # awaiting_confirm, "animated" (선택지는 제안 전에도 3개 모두, 기본 선택 없음)
curl -b jar -s -X POST $BASE/v1/artworks/$ART/confirm -H 'content-type: application/json' -d '{"kind":"animated"}'
curl -b jar -s $BASE/v1/artworks/$ART | jq '.state,.result.kind'          # awaiting_review, "animated"
curl -b jar -s -X POST $BASE/v1/artworks/$ART/decision -H 'content-type: application/json' -d '{"decision":"like"}'
curl -b jar -s -X PUT $BASE/v1/artworks/$ART/story -H 'content-type: application/json' \
  -d '{"title":"우리 가족","madeOn":"2026-09-20","ageAtMaking":5,"childWords":"엄마랑 바다 갔어"}'
curl -b jar -s "$BASE/v1/gallery?child=$CHILD" | jq '.groups[0].items[0].title'   # "우리 가족"
```

장애 주입(원인 분리 정확도, `docs/B_통합시험.md`):

```bash
# 어댑터가 지정 분류를 돌려주게 함: stage=outcome 쌍
UAM_FAKE_MODELS=1 UAM_FAKE_OUTCOMES="animate_render=storage" python -m workers.run --group cpu
# → 3회 시도 뒤 artwork.status=failed, artwork_outcome.result_cause='not_delivered', downgrade_cause 비어 있음(모델 낮춤 아님)
UAM_FAKE_OUTCOMES="animate_render=quality_below" …
# → depth_relief 작업 등록, stage_job.status=done_downgraded, downgrade_cause=animated_to_relief, attempt_count=1
```

외부 모델 기능(UC12, 내부 키):

```bash
KEY=$(cd api && npm run -s ops:key -- issue --kind team_internal)
curl -s -X POST http://127.0.0.1:9541/v1/models/segment -H "X-API-Key: $KEY" -F image=@eval/samples/house_01.jpg
# 202 {"jobId":…,"status":"queued"}
curl -s http://127.0.0.1:9541/v1/models/jobs/<jobId> -H "X-API-Key: $KEY"
curl -s http://127.0.0.1:9541/v1/models/jobs/<jobId>/result -H "X-API-Key: $KEY"   # 1회, 재조회 404
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:9541/v1/models/segment -F image=@x.jpg   # 401
```

## 6. 시험 실행

```bash
cd api && npm test                 # Vitest + Supertest (로컬 MariaDB uam_test)
cd web && npm test && npx playwright test   # 390px·1440px
cd serving && pytest               # 어댑터·워커·장애 주입
npx @redocly/cli lint .specify/features/우리-아이-미술관/contracts/*.yaml
```

## 7. 배포(팀 서버)

GitLab CI는 lint·타입·단위 시험만. 배포는 수동 또는 CI의 ssh 단계:

```bash
ssh <team-server> 'cd ~/project2610 && git pull --ff-only \
  && (cd api && npm ci && npm run build && npm run db:migrate) \
  && (cd web && npm ci && npm run build) \
  && (cd serving && .venv/bin/pip install -r requirements.lock --require-hashes) \
  && pm2 reload ops/ecosystem.config.cjs'
```

팀 서버 사양·GPU·모델 경로는 `docs/A_팀서버_자원확인.md`(U2·U14) 확인 뒤 이 절을 갱신한다.
