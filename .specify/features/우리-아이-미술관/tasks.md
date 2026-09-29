# Tasks: 우리 아이 미술관 (P0 우선 · P0.5 · P1 조건부)

**Spec**: [spec.md](./spec.md) v2.2(D18·U1 확정 포함) · **Plan**: [plan.md](./plan.md) v1.1 · **Data Model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/](./contracts/) · **Quickstart**: [quickstart.md](./quickstart.md)
**Created**: 2026-09-28 · **Regenerated**: 2026-09-28 B(이제민) — plan v1.1(main `5a774f0` 기준: SD_03 정본 + 보완 S1~S9, D18, U1 공동 보호자, `llm-server`, 모델 체크포인트 R-22)을 입력으로 다시 만듦. 이전 판(최호준 작성, 15:33)은 [tasks-최호준-1533-backup.md](./tasks-최호준-1533-backup.md)에 보존. **작업 번호는 이전 판과 같게 유지**하고 내용만 고쳤다(바뀐 작업: T001·T006·T008·T015·T017·T030·T045·T049·T070·T082·T102~T107·T115·T121~T123·T126·T128·T130·T134·T135)
**입력**: `Intent-Tasks.md`(작업에 붙일 스킬 5종) · `design/`(UC_00~UC_15 · SD_01 P0~P10·G0~G29·H1~H16 · SD_02 S0~S12·S1b·C1~C10 · SD_03 DDL `design/uri_gallery_ddl.sql` · REF D1~D18) · `docs/역할분담.md` · spec clarify 2026-09-28(U1 공동 보호자 · U10 화면 동작 · 삭제 미완료 · 첫 버전 비활성화)

## 표기 규약

- `[P]` — 다른 파일을 건드리므로 **병렬 실행 가능**
- `[US1]` — 해당 사용자 스토리 전용 작업
- 같은 파일을 수정하는 작업에는 `[P]`를 붙이지 않는다 (순차 실행)
- 각 작업은 파일 경로를 명시한다
- **담당**: `A` 최호준(모델 서빙) · `B` 이제민(API·오케스트레이션) · `C` 신지현(보호자 경험·설명) — `docs/역할분담.md`
- **스킬**(Intent-Tasks.md): `FD` Frontend Design · `RL` Responsive Layout · `API` API Development · `DB` Database Design · `AUTH` Authentication · `—` 해당 스킬 없음(모델 재현·문서)
- **근거**: FR(spec) · UC · G(게이트, SD_01 §15) · BR(업무규칙) · R(research) · S/C(SD_02 화면/컴포넌트)
- **시험 작업을 넣는다.** plan R-19(Vitest·Supertest·Playwright·pytest·계약 시험·장애 주입)와 SD_03 "DDL 검증 3종"이 시험을 명시적으로 요구한다. 스토리마다 시험 작업이 구현보다 앞선다.
- **이름 기준**: DB 이름·코드값은 SD_03 DDL(`artwork`·`stage_job`·`artwork_outcome`·`failed`·`split`·`animate_render`·`depth_relief`·`frame_compose`·`done_downgraded`·`team_internal` 등)을 따른다. 계획 문서의 옛 이름은 plan v1.1에서 정리됐다.
- **웹 구현 기준(사용자 지시)**: 모든 웹 작업(FD·RL 스킬 작업, C1~C10 컴포넌트, S0~S12 화면)은 **`design/style-guide/스타일가이드_우리아이미술관.html`** 을 참조해 구현한다(토큰·클래스·반응형 기준점). 예외: 제안 선택지 미리 선택(`aria-pressed="true"`)은 따르지 않고(SD_02 UX2·BR-SUG-03), 문구가 다르면 SD_02를 따른다(research R-20).
- **LLM 서빙**: `llm-server`는 큐 워커가 아니라 내부 동기 HTTP 서버(127.0.0.1:8200)다(research R-18). `worker-llm`이라는 프로세스는 없다.

## 사용자 스토리 구성

spec의 FR과 수용 시나리오(Scenario 1~19)를 유스케이스 단위로 묶었다. 우선순위는 spec 범위 구간(P0 → P0.5 → P1)과 UC 우선순위(High → Medium → Low)를 따른다.

| 스토리 | 제목 | 구간·우선 | UC | 프로세스 | 화면 | 수용 시나리오 |
|:--:|---|:--:|---|---|---|---|
| US1 | 보호자 가입·로그인·로그인 정보 찾기·아이 등록 | P0 · High | UC13 · UC14 · UC1 | P1 | S0 · S0b · S1 | FR-31 · FR-32 · FR-1 수용 기준 |
| US2 | 작품 접수와 판정 제안 확정 | P0 · High (MVP 핵심) | UC2 | P2 · P0-1 | S2 · S3 | 2 · 3 · 9 |
| US3 | 결과 생성·낮춤 체인·진행 확인 | P0 · High (MVP 핵심) | UC3 | P0-2 · P3(3.1~3.2) | S4 | 4 · 5 · 6 · 7 |
| US4 | 결과 확인·이야기·가족 전시 | P0 · High (MVP 핵심) | UC4 · UC5 · UC6 | P3 · P5 | S5 · S6 · S8 | 1 · 8 · 10 · 12 · 13 |
| US5 | 작품·아이 삭제와 실행 중 취소 | P0 · High | UC7 | P6 | S9 | 11 |
| US6 | 공동 보호자 초대·해제·나가기 | P0 · High | UC15 · UC13 A4 | P1 §4-5(1.I1~1.I4) · G28 · G29 | S1b | FR-9 수용 기준(clarify U1) |
| US7 | 서비스 상태와 모델별 지표 | P0 · Medium | UC8 | P7 | S10 | 14 |
| US8 | 모델 평가·승격·롤백·비활성 | P0 · Medium | UC9 | P8 | S11 | 15 |
| US9 | API활용 메뉴와 외부 모델 기능 호출 | P0 · Medium/Low | UC11 · UC12 | P9 · P10 | S12 | 16 · 18 |
| US10 | 키워드 작품 설명 초안 | P0.5 · Medium | UC10 · UC12(caption) | P4 | S7 | 17 |
| US11 | 만들기 작품 3D 조각 | P1 | UC6 A3 · UC2 A9 | P0-2(sculpture) | S3 · S5 · S8 | 19 |

---

## Phase 1: Setup

- [x] T001 (B 완료 2026-09-28 — `design/uri_gallery_ddl.sql`에 email_norm·owner_family_id·auth_email_token·family_invite·G26~G29 확인) main이 계획 기준(`5a774f0`)인지 확인한다: `design/uri_gallery_ddl.sql`에 `guardian_account.email_norm`·`role`·`owner_family_id`, `auth_email_token`, `family_invite`, G26~G29, `gate_event.chk_ge_subject`의 `family_invite`·`guardian_account`가 있고 `uq_child_family_alias`·`uq_guardian_family`가 없는지 본다(D18·공동 보호자는 병합 완료, 확인만) — `design/` · `.specify/features/우리-아이-미술관/spec.md` · 담당 B · 스킬 — · 근거 D18, U1, data-model §1
- [ ] T002 (**일부** 2026-09-28 — `api`·`db`·`ops`·`models`·`serving`·`contracts` README 있음. `web`·`caption`·`eval`은 담당 C·A가 폴더를 만들 때 README 함께) 저장소 골격을 만든다: `web/`·`api/`·`db/migrations/`·`serving/`·`caption/`·`eval/`·`models/`·`contracts/`·`ops/`와 각 폴더 `README.md`(담당·경계 한 줄) — 루트 · 담당 B · 스킬 — · 근거 quickstart §1
- [x] T003 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] 앱 API 프로젝트를 초기화한다: Node 20(`.nvmrc`), Express 4 · TypeScript 5 · mysql2 3 · pino · zod · Vitest · Supertest, ESLint·Prettier, `npm run build|test|lint|db:migrate` 스크립트 — `api/package.json` · `api/tsconfig.json` · 담당 B · 스킬 API · 근거 R-01
- [x] T004 (완료 2026-09-29 — vue-tsc·Vitest 1/1·빌드·Playwright 390/1440 2/2, 로컬 확인은 WEB_PORT로 9501 대신) [P] 웹 프로젝트를 초기화한다: Vite 5 · Vue 3.4 · TypeScript · Pinia · Vue Router 4 · Vitest · Vue Test Utils · Playwright(390px·1440px 프로젝트 2개) — `web/package.json` · `web/vite.config.ts` · `web/playwright.config.ts` · 담당 C · 스킬 FD · 근거 R-01, R-19 · **D21 보정(2026-09-29)**: Vite 개발 서버 9501(D19)·프록시 `/v1`·`/live`·`/ready`·`/openapi.json` → `127.0.0.1:9521`(app-api에 CORS 없음), 개발용 `.env`에 `SECURE_COOKIES=0`. Node·Vite 버전은 착수 전 결정(Node 20은 2026-04 지원 종료). `web/README.md`(T002 몫) 함께. CI `web` 작업은 T148
- [x] T005 (A 완료 — `a/model-serving`, main 병합 전) [P] 서빙 Python 프로젝트를 초기화한다: Python 3.11 venv, FastAPI · uvicorn · PyMySQL · structlog · pillow · pillow-heif · pytest, 해시 잠금 파일 — `serving/pyproject.toml` · `serving/requirements.lock` · 담당 A · 스킬 API · 근거 R-01, R-03, FR-30
- [x] T006 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] 환경 변수 견본과 비밀 제외를 둔다: `DB_HOST`·`DB_PORT`·`DB_USER`·`DB_NAME`·`DB_PASSWORD`·`SESSION_SECRET`·`STORAGE_ROOT`·`MODEL_ROOT`·`MODEL_API_INTERNAL_URL`·`UAM_FAKE_MODELS`·`GPU_ENABLED`·`TORCHSERVE_URL`·`MAIL_SMTP_URL`·`MAIL_FROM`·`APP_BASE_URL`·`AUTH_HMAC_SECRET`, P0.5 `LLM_SERVER_URL`·`OLLAMA_URL`, `.gitignore`에 `.env` — `.env.example` · `.gitignore` · 담당 B · 스킬 — · 근거 R-21
- [x] T007 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] 계약 정본을 루트로 복사하고 lint를 건다: `.specify/…/contracts/*` → `contracts/`, Redocly 설정, `npm run contracts:lint` — `contracts/` · `redocly.yaml` · 담당 B · 스킬 API · 근거 plan Phase 1
- [x] T008 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] pm2 구성을 만든다: `app-api`(:9521) · `model-api`(:9541) · `worker-cpu` · `worker-gpu` · `sweeper`, `llm-server`(:8200, 큐 없는 동기 서버)는 P0.5 주석 처리, 모두 127.0.0.1. 서빙 진입점은 A 구현 기준(`serving/.venv/bin/python -m model_api.main` · `-m workers.main --group cpu_vision|gpu`(kill_timeout 10000) · `-m llm_server.main`, env `OLLAMA_URL=http://127.0.0.1:11434`·`OLLAMA_CHAT_MODEL=qwen3:4b-instruct-2507-q4_K_M`), worker-cpu는 T068 전까지 인스턴스 1개(M1 RSS 8.5GB). 로컬 부대 프로세스(Mailpit :1025/:8025, TorchServe :9561~9563 + Java 17) 기동 절차를 같은 파일 주석과 `ops/README.md`에 — `ops/ecosystem.config.cjs` · `ops/README.md` · 담당 B · 스킬 — · 근거 R-02, R-03, R-23
- [x] T009 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] nginx 라우팅을 만든다: `/`·`/app/*`·`/ops/*` → `web/dist`, `/v1/models/*` → :9541, 그 밖 `/v1/*`·`/live`·`/ready`·`/metrics` → :9521, `/_files/*` internal(X-Accel-Redirect), HTTPS — `ops/nginx.conf` · 담당 B · 스킬 — · 근거 R-02, plan Architecture
- [x] T010 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] GitLab CI를 lint·타입 검사·단위 시험·계약 lint만 돌게 만든다(배포 없음) — `.gitlab-ci.yml` · 담당 B · 스킬 — · 근거 R-02
- [x] T011 (완료 2026-09-29 — 토큰 일치 시험·자체 호스팅 글꼴 E2E 390/1440, 가변 Inter를 토큰 이름 "Inter"로 등록) [P] 디자인 토큰과 글꼴을 옮긴다: **`design/style-guide/스타일가이드_우리아이미술관.html`**(기준 파일)의 `:root` 변수·클래스를 그대로 옮기고, `design/style-guide/`의 `--color-*`·`--r-*`·`--s-*`·`.t-*` → CSS 변수, `@fontsource/inter`·`pretendard` 자체 호스팅 — `web/src/styles/tokens.css` · `web/src/styles/base.css` · 담당 C · 스킬 FD · 근거 R-20 · **D21 보정(2026-09-29)**: 글꼴은 가변 글꼴(`@fontsource-variable/inter`·Pretendard Variable) — 굵기 320·330·340·540. 상태 모양은 SD_02 §3-5 토큰 사상, 중단점 560·768·960 · **D21 보정(2026-09-29)**: 글꼴은 가변 글꼴(`@fontsource-variable/inter`·Pretendard Variable) — 굵기 320·330·340·540. 상태 모양은 SD_02 §3-5 토큰 사상, 중단점 560·768·960 · **D22**: §3-5 사상 확정, C1·C2·C10 시안은 스타일가이드 HTML `#states` 절
- [x] T012 (B 완료 2026-09-28; `docs/결정_DB비밀정보.md`) `Intent-Plan.md` 작업 사본의 평문 DB 비밀번호(커밋된 이력에는 없음)를 커밋 전에 지울지·`.env` 참조로 바꿀지 팀에 결정 요청하고 결과를 기록한다. 결정 전에는 이 파일을 커밋하지 않는다 — `docs/결정_DB비밀정보.md` · 담당 B · 스킬 — · 근거 R-21, plan Open Questions

**Checkpoint**: 세 프로젝트가 빌드되고 CI가 녹색이다.

---

## Phase 2: Foundational (모든 스토리의 선행 조건)

### DB (B)

- [x] T013 (B 완료 2026-09-28 — `b/api`, main 병합 전) SD_03 DDL(D18판)을 기준 마이그레이션으로 그대로 넣는다 — `db/migrations/0001_sd03_baseline.sql` · 담당 B · 스킬 DB · 근거 data-model §8
- [x] T014 (B 완료 2026-09-28 — `b/api`, main 병합 전; `db/tests/ddl.verify.test.ts`에 통합) 기준 마이그레이션이 보완 S1~S4(재시도 시각·우선순위·`ix_sj_claim`·평가 작업과 트리거·운영 뷰 분리·외부 작업 점유)를 담았는지 확인하는 시험을 둔다(SD_03 §18-2 시험 17건 중 S1~S4·S9를 자동화). 별도 `0100` 마이그레이션은 두지 않는다(SD_03에 반영 완료) — `db/tests/impl-supplement.test.ts` · 담당 B · 스킬 DB · 근거 data-model §6, SD_03 §18-2
- [x] T015 (B 완료 2026-09-28 — `b/api`, main 병합 전; `db/tests/ddl.verify.test.ts`에 통합) 기준 마이그레이션의 인증 보완 S5~S7(`team_member.password_hash`, `app_session`, `auth_rate_event`)을 확인하는 시험을 둔다(SD_03 §18-2 중 S5~S7 자동화). 별도 `0101` 마이그레이션은 두지 않는다 — `db/tests/impl-supplement.test.ts` · 담당 B · 스킬 DB, AUTH · 근거 data-model §6, SD_03 §18-2
- [x] T016 (B 완료 2026-09-28 — `b/api`, main 병합 전) 마이그레이션 실행기를 만든다: `schema_migration(version, checksum, applied_at)`, 재실행 안전, 로컬 `uam_test` 먼저 — `api/scripts/migrate.ts` · 담당 B · 스킬 DB · 근거 data-model §8
- [x] T017 (B 완료 2026-09-28 — `b/api`, main 병합 전) DDL 검증 3종 시험을 만든다: 빈 스키마 실행 · 재실행 · SD_03 §18 위반 48건(D18로 바뀐 별칭 중복 1건은 "허용"으로 뒤집고 G26~G29 위반(대소문자만 다른 이메일, 토큰 사용·무효 동시, 가족당 만든 보호자 2명, 만든 보호자 가족 NULL, 초대 수락·취소 동시)을 추가) 거부 확인 — `db/tests/ddl.verify.test.ts` · 담당 B · 스킬 DB · 근거 SD_03 §18
- [x] T018 (B 완료 2026-09-28 — `b/api`, main 병합 전) 팀원 계정·역할 시드 CLI를 만든다(`npm run ops:staff -- add --email … --role operator|evaluator|integrator`, argon2id) — `api/scripts/ops/staff.ts` · 담당 B · 스킬 AUTH · 근거 BR-ACC-05, data-model §6 S5

### 앱 API 공통 (B)

- [x] T019 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] DB 풀과 트랜잭션 헬퍼(`withTx`, `FOR UPDATE`)를 만든다 — `api/src/db/pool.ts` · `api/src/db/tx.ts` · 담당 B · 스킬 API · 근거 data-model §4
- [x] T020 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] 오류 응답을 만든다: RFC 9457 Problem Details + `code`, 트리거 `SIGNAL` `MESSAGE_TEXT`(예 `G11 BR-STY-02 made_on_in_future`)를 파싱해 409/422 + `gate_event` 1행 — `api/src/lib/problem.ts` · `api/src/lib/gateEvent.ts` · 담당 B · 스킬 API · 근거 R-10, data-model §5
- [x] T021 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] 허용 목록 로거를 만든다(`request_id`·`route`·`status`·`code`·`stage`·`model_id`·`model_version`·`outcome`·`duration_ms`만) — `api/src/lib/logger.ts` · 담당 B · 스킬 API · 근거 BR-PRV-01, R-17, FR-14
- [x] T022 (B 완료 2026-09-28 — `b/api`, main 병합 전) 세션을 만든다: `express-session` + `app_session` 저장소, 보호자 `uam_sid`/팀원 `uam_ops_sid` 쿠키 분리, `HttpOnly; Secure; SameSite=Lax`, 유휴 30분, `created_at < password_changed_at`이면 무효 — `api/src/auth/session.ts` · 담당 B · 스킬 AUTH · 근거 R-08, FR-32
- [x] T023 (B 완료 2026-09-28 — `b/api`, main 병합 전) 가드를 만든다: `requireGuardian`(가족 ID는 세션에 캐시하지 않고 요청마다 `guardian_account.family_id`로 확인 — 해제·나가기 즉시 반영, 가족 없는 계정은 가족 경로 409 `no_family`, 다른 가족은 404), `requireStaff(role)`(G1), 외부 키는 app-api에서 거부 — `api/src/auth/guards.ts` · 담당 B · 스킬 AUTH · 근거 G0, G1, BR-ACC-01~05, BR-API-06
- [x] T024 (B 완료 2026-09-28 — `b/api`, main 병합 전) 앱 부트스트랩을 만든다: 라우터 마운트, `/live`, 시험 모드 `express-openapi-validator` 응답 검증 — `api/src/app.ts` · `api/src/server.ts` · 담당 B · 스킬 API · 근거 FR-12, R-19
- [x] T025 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/storage/LocalFsDriver.ts`) [P] 저장소 포트와 로컬 드라이버를 만든다: `put/get/delete/exists/listByPrefix`, `family/`·`tmp/`·`ext/` 분리, 원본 `O_EXCL`+0440 — `api/src/storage/StoragePort.ts` · `api/src/storage/LocalFsDriver.ts` · 담당 B · 스킬 API · 근거 R-06, BR-INT-04
- [x] T026 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] 파일 읽기 토큰을 만든다: 짧게 유효한 서명 토큰 `GET /v1/files/{token}` → `X-Accel-Redirect`, 가족 확인 뒤에만 발급, 로그에 객체 키 없음 — `api/src/modules/files/` · 담당 B · 스킬 API, AUTH · 근거 SD_03 §17
- [x] T146 (신지현 대행 완료 2026-09-29 — `c/web-prep`, `api/tests/web-prep.test.ts`·`ops.test.ts`) [P] 팀원 세션 API와 지표 역할을 맞춘다(D21): `GET /v1/ops/me`(역할·가린 계정)·`POST /v1/ops/auth/logout`(204), `GET /v1/admin/metrics`를 운영자·평가 담당·연동 개발 읽기로(미도달은 운영자 전용 유지), 계약 시험 — `api/src/modules/auth/routes.ts` · `api/src/modules/ops/routes.ts` · `api/tests/` · 담당 B(신지현 대행, D21) · 스킬 API · 근거 SD_02 §2-1 · C9, UC9 A1, UC11 A5

### 서빙 공통 (A)

- [x] T027 (A 완료 — `a/model-serving`, main 병합 전) [P] Python DB·저장소 공통을 만든다(앱 API와 같은 경로 규칙) — `serving/common/db.py` · `serving/common/storage.py` · 담당 A · 스킬 API · 근거 R-06
- [x] T028 (A 완료 — `a/model-serving`, main 병합 전) [P] structlog 허용 목록 로거를 만든다 — `serving/common/logging.py` · 담당 A · 스킬 — · 근거 BR-PRV-01, stage-job §10, FR-14
- [x] T029 (A 완료 — `a/model-serving`, main 병합 전) 어댑터 기반과 가짜 어댑터를 만든다: `AdapterResult`(outcome 8종), `FakeAdapter`(`UAM_FAKE_MODELS=1`, `stage=outcome` 쌍으로 장애 주입) — `serving/adapters/base.py` · `serving/adapters/fake.py` · 담당 A · 스킬 — · 근거 stage-job §4.1, R-19
- [x] T030 (A 완료 — `a/model-serving`, main 병합 전) 워커 실행기를 만든다: `SELECT … FOR UPDATE SKIP LOCKED`(serving_group·status·available_at·priority), 점유 60초·heartbeat 20초, 활성 버전 기록(활성 버전이 없으면 `model_not_ready` — 새 작업은 app-api가 만들지 않으므로 이미 대기 중이던 작업만 해당), 취소 감지, **결과 쓰기 직전 `deleting` 재확인**, 임시 파일 정리 — `serving/workers/runner.py` · 담당 A · 스킬 — · 근거 stage-job §3, G19, BR-PRC-05·08, FR-4, FR-11, FR-25
- [x] T031 (A 완료 — `a/model-serving`, main 병합 전) 응답 분류 기록을 만든다: outcome → `stage_job.status`·`error_class`·`downgrade_cause` 1:1, 인프라 재시도 10초·60초, 소진 D1(판정 → `exhausted`, 결과 단계 → `failed`+`not_delivered`) — `serving/workers/outcome.py` · 담당 A · 스킬 — · 근거 stage-job §4, BR-API-02, BR-PRC-03, G7, G9
- [x] T032 (A 완료 — `a/model-serving`, main 병합 전) [P] 상한 설정 파일을 둔다: 시간 상한(움직임 렌더 600초만 원천, 나머지 `[추론]`)·동시 처리·GPU 유무, 품질 임계값은 U5 전 "명백한 실패"만 — `serving/config/limits.yaml` · `serving/config/thresholds.yaml` · 담당 A · 스킬 — · 근거 stage-job §8, U5, U6, FR-15, FR-25
- [x] T033 (B 완료 2026-09-28 — `b/api`, main 병합 전) sweeper 골격을 만든다(**Node, `api/src/sweeper/`** — B 스택·저장소 드라이버 공유, 2026-09-28 변경): 점유 만료 이어받기(`deleting` 작품은 `cancelled`, 3회 소진은 stage-job §4.3 소진 규칙 그대로), 비정상 종료 임시 파일 정리(0.12), 만료 세션·토큰 정리 — `api/src/sweeper/` · 담당 B · 스킬 — · 근거 BR-PRC-05, BR-PRC-08, stage-job §3·§4.3, FR-11
- [x] T034 (A 완료 — `a/model-serving`, main 병합 전) 단계 작업 계약 시험을 가짜 어댑터로 만든다: 점유·이어받기·분류 8종·소진·취소·쓰기 직전 재확인 — `serving/tests/test_stage_job_contract.py` · 담당 A · 스킬 — · 근거 stage-job 전 항목

### 웹 공통 (C)

- [ ] T035 [P] 화면 문구를 한 파일에 모은다(SD_02 문구 기준, 스타일가이드와 다르면 SD_02 우선) — `web/src/copy/ko.ts` · 담당 C · 스킬 FD · 근거 U10, R-20 · **D22**: 문구 정본은 `docs/C_화면문구.md`(ko.ts는 이 문서를 옮긴다)
- [ ] T036 [P] API 클라이언트를 만든다: `openapi-typescript` 생성 타입, Problem Details → `BlockNotice` 모델 변환, 401 → 로그인 이동 — `web/src/api/client.ts` · `web/src/api/types.gen.ts` · 담당 C · 스킬 FD · 근거 R-10, G0 · **D21 보정(2026-09-29)**: 타입은 `openapi.yaml`+`model-api.openapi.yaml`을 번들한 뒤 생성(외부 `$ref`). 오류 사상은 `reason`+`gate` 기준(`code` 아님, 예 `forbidden_role`/`invite_email_mismatch`), 409 `no_family` → S1d, 401 → 로그인(`next`). §17 전역 실패 규칙("지금은 불러올 수 없어요"·운영 "갱신 불가"+마지막 값)도 여기서
- [x] T037 (완료 2026-09-29 — Vitest 7건: 3→6→10초·전이 끝나면 멈춤·숨김 탭 정지·실패 뒤 계속·겹침 없음·S11 2초·범위 해제) [P] 폴링 컴포저블을 만든다: 3→6→10초, 전이 중 상태만, `visibilitychange`에서 멈춤 — `web/src/composables/usePolling.ts` · 담당 C · 스킬 FD · 근거 R-12
- [ ] T038 [P] 공통 컴포넌트 C1·C2·C3를 만든다: `JourneyRail`(기본·막힘·대기·전시 보류·종결), `BlockNotice`(차단·보류·종결, 사유·해제 주체·다음 행동 필수), `ReasonButton`(`aria-disabled`+사유, hover·포커스 같은 문구) — `web/src/components/JourneyRail.vue` · `BlockNotice.vue` · `ReasonButton.vue` · 담당 C · 스킬 FD · 근거 SD_02 §3, UX6, G 사상 규칙 1·2
- [ ] T039 [P] 공통 컴포넌트 C4·C9를 만든다: `StatusBadge`, `RoleHeader`(보호자/팀원 셸, 계정 가림) — `web/src/components/StatusBadge.vue` · `RoleHeader.vue` · 담당 C · 스킬 FD · 근거 SD_02 §3-4, UX8
- [ ] T040 라우터와 레이아웃을 만든다: `/app/*`(보호자)·`/ops/*`(팀원) 분리, 역할 가드, 보호자↔운영 링크 없음, 모바일 390px 우선·1440px — `web/src/router/index.ts` · `web/src/layouts/AppLayout.vue` · `OpsLayout.vue` · 담당 C · 스킬 RL · 근거 SD_02 §2, R-11, UX8 · **D21 보정(2026-09-29)**: 로그인 둘(S0a `/app/login`·S0o `/ops/login`), 운영 셸은 `GET /v1/ops/me`로 역할 복원·SD_02 §2-1 역할별 메뉴 표대로 메뉴, `?next=` 복귀(S1c 초대 링크), 메일 링크 경로 `/app/verify`·`/app/reset`·`/app/invite`

**Checkpoint**: `npm run db:migrate` 두 번 성공·위반 거부 시험 통과, `/live` 200, 가짜 어댑터로 단계 작업 계약 시험 통과, 웹 셸이 열린다. 이제 스토리를 병렬로 시작할 수 있다.

---

## Phase 3+: User Stories (우선순위 순)

### User Story 1 — 보호자 가입·로그인·로그인 정보 찾기·아이 등록 (P0 · High)

**목표**: 보호자가 이메일로 가입해 확인 메일로 가족 공간을 열고, 로그인해 아이를 별칭으로 등록한다. 잊으면 이메일로 로그인 정보를 찾는다.
**독립 검증 기준**: Mailpit에서 확인 링크로 가입 완료 → 로그인 → 같은 별칭 아이 2명 등록(둘 다 저장, 안내만) → 로그아웃 → 찾기 메일의 재설정 링크로 비밀번호 변경 → 이전 세션이 끊긴다. 가입된 이메일로 다시 가입해도 응답은 같은 202다.

#### 시험

- [x] T041 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/tests/auth.test.ts`) [P] [US1] 인증 엔드포인트 7개 계약 시험: signup·verify/resend·recovery 항상 202, verify·reset 성공 204·실패 400 `token_invalid`, login 204·401·403 `email_unverified`, logout — `api/tests/auth.contract.test.ts` · 담당 B · 스킬 AUTH · 근거 FR-31, FR-32, D18
- [x] T042 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/tests/auth.test.ts`) [P] [US1] 가입 규칙 시험: 대소문자 무시 유일, 동시 가입 1건, 계정·가족 원자 저장(G26), 요청 한도(이메일 10분 3회·IP 1시간 20회), 재설정 뒤 모든 세션 무효, 로그에 이메일·토큰 원문 0 — `api/tests/auth.rules.test.ts` · 담당 B · 스킬 AUTH · 근거 G26, G27, BR-ACC-06~08, BR-PRV-01
- [x] T043 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] [US1] 아이 등록 시험: 별칭 빈 값 거부(G4), 같은 별칭 저장 + 안내 플래그(UC1 A5), 다른 가족 아이 404, 로그에 별칭 없음 — `api/tests/children.test.ts` · 담당 B · 스킬 API · 근거 FR-1, G0, G4, BR-CHD-01
- [ ] T044 [P] [US1] 가입→확인→로그인→아이 등록 E2E(390·1440px) — `web/e2e/us1-signup-child.spec.ts` · 담당 C · 스킬 FD · 근거 S0, S1

#### 구현

- [x] T045 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/mail/mailer.ts`) [P] [US1] 메일 발송을 만든다: nodemailer + Mailpit(P0), 확인·재설정·"이미 가입" 안내·공동 보호자 초대 4종, 가족 정보 없음, 로그에 수신 주소·토큰 없음 — `api/src/lib/mailer.ts` · `api/src/mail/templates/*.ts` · 담당 B · 스킬 AUTH · 근거 FR-31, FR-32, U19
- [x] T046 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/auth/routes.ts`) [US1] 가입·확인·재발송을 만든다: `family`+`guardian_account`+`auth_email_token(verify)` 한 트랜잭션(G26), 기존 이메일이면 안내 메일만·같은 202, 토큰 해시·1회용·만료 — `api/src/modules/auth/signup.ts` · 담당 B · 스킬 AUTH · 근거 FR-31, data-model §4 가입·이메일 확인
- [x] T047 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/auth/routes.ts`) [US1] 로그인·로그아웃을 만든다: argon2id, 확인 전 403 `email_unverified`, 세션 재생성 — `api/src/modules/auth/login.ts` · 담당 B · 스킬 AUTH · 근거 FR-31, R-08
- [x] T048 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/auth/routes.ts`) [US1] 로그인 정보 찾기·재설정을 만든다: 가입 여부 비노출, 이전 토큰 `revoked_at`, `password_changed_at` 갱신 + 세션 전부 삭제, 확인 전 계정은 확인 메일 재발송 — `api/src/modules/auth/recovery.ts` · 담당 B · 스킬 AUTH · 근거 FR-32, G27
- [x] T049 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US1] 인증·초대 요청 한도를 만든다(`auth_rate_event`, 이메일·IP HMAC, 가입·재발송·찾기 같은 이메일 10분 3회·같은 IP 1시간 20회, 초대 같은 가족 하루 20건·같은 이메일 하루 3건 `[추론]`, 초과해도 응답 동일) — `api/src/modules/auth/rateLimit.ts` · 담당 B · 스킬 AUTH · 근거 FR-31, data-model §6 S7
- [x] T050 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/auth/routes.ts`) [US1] 팀원 로그인을 만든다(`POST /v1/ops/auth/login`, `uam_ops_sid`) — `api/src/modules/auth/opsLogin.ts` · 담당 B · 스킬 AUTH · 근거 INC2, G1
- [x] T051 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US1] 아이 API를 만든다: `GET/POST /v1/children`, `PATCH /v1/children/{id}`, 중복 검사 없음·같은 별칭 안내, 작품 수는 `v_child_artwork_count` — `api/src/modules/children/` · 담당 B · 스킬 API · 근거 FR-1, UC1 A1·A5, D18
- [ ] T149 [US1] 별칭 길이를 1~20자로 맞춘다(D22): `cleanAlias` 20자 초과 422 `alias_too_long`(G4) + 시험 — `api/src/modules/children/routes.ts` · `api/tests/children.test.ts` · 담당 B(신지현 대행, D22) · 스킬 API · 근거 UC1 E2, BR-CHD-01
- [ ] T052 [P] [US1] S0 가입·확인 화면을 만든다(이메일·비밀번호·확인만, 응답은 항상 같은 안내) — `web/src/app/views/SignupView.vue` · `VerifyView.vue` · 담당 C · 스킬 FD, RL · 근거 S0, FR-31 · **D21 보정(2026-09-29)**: G26 필드 사유·요청 한도 C2, G27 `token_invalid`, 확인 성공 뒤 S1 "이제 아이를 등록해 주세요", 초대 링크로 온 가입은 이메일 미리 채움(UC13 A4)
- [ ] T053 [P] [US1] 로그인·S0b 찾기·재설정 화면을 만든다 — `web/src/app/views/LoginView.vue` · `RecoveryView.vue` · `ResetView.vue` · 담당 C · 스킬 FD, RL · 근거 S0b, FR-32 · **D21 보정(2026-09-29)**: S0a 보호자 로그인(SD_02 §4-5 D21), 불일치는 한 문구, 메일 확인 전 계정 안내
- [ ] T054 [P] [US1] S1 아이 관리 화면을 만든다(별칭만, 실명·생년월일 칸 없음, 같은 별칭 안내, G4 차단 블록) — `web/src/app/views/ChildrenView.vue` · 담당 C · 스킬 FD, RL · 근거 S1, UX6 · **D22**: 별칭 앞뒤 공백 뺀 1~20자, 남은 글자 수 표시, 20자 초과 `alias_too_long`(G4)
- [ ] T055 [P] [US1] 팀원 로그인 화면을 만든다 — `web/src/ops/views/OpsLoginView.vue` · 담당 C · 스킬 FD · 근거 G1 · **D21 보정(2026-09-29)**: S0o(SD_02 §4-5 D21), 로그아웃 `POST /v1/ops/auth/logout`

**Checkpoint**: US1 독립 검증 기준 통과.

### User Story 2 — 작품 접수와 판정 제안 확정 (P0 · High · MVP 핵심)

**목표**: 보호자가 사진을 올리면 내구 접수(202) 뒤 분리·판정 제안이 오고, 선택지 셋 중 하나를 확정한다. 제안이 늦거나 없어도 바로 확정할 수 있다.
**독립 검증 기준**(가짜 모델): 올리기 → 202 → 목록에 "판정 중" → 제안 도착 → 제안과 다르게 확정 → 수정 여부 기록·"처리 중". 저장 실패 주입 시 목록에 작품 없음. 판정 소진 주입 시 제안 없이 직접 확정.

#### 시험

- [x] T056 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/tests/intake-confirm.test.ts`) [P] [US2] 접수 계약 시험: `POST /v1/artworks` 202·멱등(같은 요청 번호 1건), 형식 400·용량 413·판독 불가 400(G5), 원본·기록 저장 실패 시 흔적 0(G6) — `api/tests/intake.test.ts` · 담당 B · 스킬 API · 근거 FR-2, Scenario 9, BR-INT-01~03
- [x] T057 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/tests/intake-confirm.test.ts`) [P] [US2] 확정 시험: 제안과 다른 확정 허용·`is_modified`, 제안 전 확정 `before`, 소진 `none`(G7), 이미 확정·삭제 중 409(G8), 노출 꺼진 `sculpture` 거부(G17), 응답에 점수 필드 없음 — `api/tests/confirm.test.ts` · 담당 B · 스킬 API · 근거 FR-3, FR-21, Scenario 3, D14
- [x] T058 (A 완료 2026-09-29 — 17건: 집 그림 0.946·점수 단독 금지·관절 없음·분리 미달/소진 조합·제안 진리표. 기본 흐름은 test_stage_job_contract) [P] [US2] 분리·판정 워커 시험(가짜): split 성공·품질 미달(액자 권장)·소진, judge 제안 규칙(점수 단독 금지, 집 그림 0.946 사례) — `serving/tests/test_split_judge.py` · 담당 A · 스킬 — · 근거 Scenario 2, stage-job §5.1, BR-SUG-04
- [ ] T059 [P] [US2] 올리기→확정 E2E: 선택지 즉시 표시·기본 선택 없음, "나중에 고르기" — `web/e2e/us2-intake-confirm.spec.ts` · 담당 C · 스킬 FD · 근거 S2, S3, U10 clarify

#### 구현

- [x] T060 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US2] 사진 검사를 만든다: 매직 바이트 → JPEG·PNG는 `sharp`, HEIC는 `heic-decode` 판독, 20MB, 변환 없음 — `api/src/modules/artworks/validateUpload.ts` · 담당 B · 스킬 API · 근거 R-13, G5
- [x] T061 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/artworks/routes.ts`) [US2] 내구 접수를 만든다: tmp 쓰기+fsync → 트랜잭션(`artwork`+`stored_object(original)`+`artwork_original`+`stage_job(split)`+`stage_job(judge, available_at=먼 미래)`) → rename → 202, 실패 보상 삭제 — `api/src/modules/artworks/intake.ts` · 담당 B · 스킬 API, DB · 근거 R-14, data-model §4 접수, G6
- [x] T062 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/artworks/view.ts`) [US2] 작품 상세를 만든다: `GET /v1/artworks/{id}`(상태·컷아웃 토큰·제안 코드·`suggestion_state`·단계 진행, 점수 없음, 다른 가족 404) — `api/src/modules/artworks/detail.ts` · 담당 B · 스킬 API · 근거 FR-4, BR-SUG-02
- [x] T063 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/artworks/routes.ts`) [US2] 확정을 만든다: `FOR UPDATE` → `artwork_outcome` INSERT → 경로별 `stage_job`(animate_render·depth_relief·frame_compose) → `processing`, 분리 실패+relief는 frame_compose — `api/src/modules/artworks/confirm.ts` · 담당 B · 스킬 API · 근거 data-model §4 확정, G8, G17, BR-PRC-01
- [x] T064 (A 완료 — `a/model-serving`, main 병합 전) [US2] split 단계를 만든다: M1 마스크·컷아웃 저장, `judgment.split_ok`, 성공·낮춤·소진 모두 judge를 연다 — `serving/workers/stages/split.py` · 담당 A · 스킬 — · 근거 stage-job §2, FR-20
- [x] T065 (A 완료 — `a/model-serving`, main 병합 전) [US2] judge 단계를 만든다: M2 종류·태그 → M3 관절 → M4 기하 규칙 → 제안 규칙, `tag_candidate`, `awaiting_confirm`, 소진 `exhausted` — `serving/workers/stages/judge.py` · `serving/rules/m4_geometry.py` · 담당 A · 스킬 — · 근거 stage-job §5.1, FR-21, G7
- [ ] T066 [P] [US2] S2 작품 올리기 화면을 만든다(아이 선택·사진·G5 차단 블록·"닫아도 계속돼요") — `web/src/app/views/UploadView.vue` · 담당 C · 스킬 FD, RL · 근거 S2 · **D21 보정(2026-09-29)**: 접수 202 뒤 S3로 이동
- [ ] T067 [P] [US2] S3 판정 제안 확정 화면을 만든다: 선택지 셋 같은 무게·기본 선택 없음, 제안은 도착하면 문구로, G7 차단 블록, 3D는 노출 설정 뒤만, 폴링 — `web/src/app/views/ConfirmView.vue` · 담당 C · 스킬 FD, RL · 근거 S3, UX2, U10 clarify · **D21 보정(2026-09-29)**: "나중에 고르기"(S4로), 모델 적재 대기 "그림을 볼 준비를 하고 있어요"(`waitingForModel`·`etaSeconds`, 오류 색 없음), 비활성 모델 선택지 C3(`unavailable[]`)·409 `model_disabled` 처리 — T116의 C 몫

#### 실제 모델 (A — 가짜 흐름과 병행, 스토리 완료에는 가짜로 충분)

- [x] T068 (A 완료 2026-09-29 — Studio-B 기준[추론, 팀 확인 필요], U2는 P0 범위(GPU 유무·M5 속도)만 닫고 M7은 P1 게이트, U14는 T081에서) [P] [US2] 팀 서버 자원·GPU를 확인하고 기록한다(U2·U14) — `docs/A_팀서버_자원확인.md` · 담당 A · 스킬 — · 근거 plan 단계 3
- [x] T069 (A 완료 2026-09-29 — 기록·권고까지. 팀 확정 칸(§4) 채운 뒤 U4 닫음. M2는 모델 카드 배포 권고로 보류 권고, TRELLIS 제외, YOLOv8 비채택) [P] [US2] 모델 라이선스 확정 기록을 만든다(OpenCLIP 가중치 A2, Qwen3, TRELLIS 제외, AGPL 예비 모델) — `docs/A_모델_라이선스_확정.md` · 담당 A · 스킬 — · 근거 U4, BR-MDL-07, D17
- [x] T070 (A 완료 — `a/model-serving`, main 병합 전) [US2] M1 BiRefNet(`ZhengPeng7/BiRefNet`)·M2 OpenCLIP(`ViT-B-32` / `laion2b_s34b_b79k`)을 재현하고 HF 리비전·가중치 SHA-256·시간·메모리를 기록한다(M2는 A2 라이선스 기록 전 비활성) — `docs/A_모델재현기록.md` · `models/manifest.yaml` · 담당 A · 스킬 — · 근거 FR-16, R-22
- [x] T071 (A 완료 — `a/model-serving`, main 병합 전) [US2] M1·M2 실제 어댑터를 만든다 — `serving/adapters/m1_birefnet.py` · `serving/adapters/m2_openclip.py` · 담당 A · 스킬 — · 근거 BR-MDL-02
- [x] T072 (A 완료 2026-09-29 — `m3_joints.py` 분리, 긴 변 1000px(AD 좌표계·요청 상한), 실제 TorchServe 시험 통과, M4 `rules/m4_geometry.py` 기존) [US2] M3 관절 추출(렌더 없이)과 M4 규칙 실제 어댑터를 만든다 — `serving/adapters/m3_joints.py` · `serving/rules/m4_geometry.py` · 담당 A · 스킬 — · 근거 FR-21

**Checkpoint**: US2 독립 검증 기준 통과(가짜 모델). US1과 함께 "가입 → 올리기 → 확정"이 이어진다.

### User Story 3 — 결과 생성·낮춤 체인·진행 확인 (P0 · High · MVP 핵심)

**목표**: 확정값대로 움직임·2.5D·액자를 만들고, 품질 미달은 한 단계 낮추고, 인프라 장애는 3회 재시도 뒤 "처리하지 못함"으로 알린다. 보호자는 목록에서 단계별 진행과 낮춤 사실을 본다.
**독립 검증 기준**(가짜 모델 장애 주입): 움직임 품질 미달 → 2.5D 등록·재시도 0, 분리 실패 → 2.5D 건너뛰고 액자, 엔진 다운 3회 → `failed`·`not_delivered`·`model_downgrade` 아님, M3 정지 중에도 액자 경로 확인 대기 도달.

#### 시험

- [x] T073 (A 완료 — `a/model-serving`, main 병합 전) [P] [US3] 낮춤 체인·재시도 장애 주입 시험: 5종 오류 × 결과 단계, 인프라가 낮춤으로 집계 0건 — `serving/tests/test_downgrade_chain.py` · 담당 A · 스킬 — · 근거 Scenario 4·5·6·7, FR-5, FR-23, BR-FBK-04
- [x] T074 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/tests/intake-confirm.test.ts`) [P] [US3] 목록·진행 API 시험: 가족 작품만, `display_status`, 단계 진행에 점수·객체 키 없음 — `api/tests/progress.test.ts` · 담당 B · 스킬 API · 근거 FR-4, UC3
- [ ] T075 [P] [US3] 진행 확인 E2E(대기·다시 시도 중·낮춤 안내·처리하지 못함 블록) — `web/e2e/us3-progress.spec.ts` · 담당 C · 스킬 FD · 근거 S4

#### 구현

- [x] T076 (A 완료 — `a/model-serving`, main 병합 전) [US3] 결과 단계 핸들러를 만든다: `animate_render`(M3, 600초), `depth_relief`(M1 마스크+M5, GPU 없으면 cpu_vision), `frame_compose`(모델 없음·원본 참조) — `serving/workers/stages/results.py` · 담당 A · 스킬 — · 근거 stage-job §2, FR-5, FR-22, BR-SRV-02
- [x] T077 (A 완료 — `a/model-serving`, main 병합 전) [US3] 낮춤 체인과 결과 기록을 만든다: 움직임→2.5D→액자, 마스크 없으면 액자, `result`(종류당 처음 1건), `artwork_outcome.result_kind`·`result_cause`, `awaiting_review` — `serving/workers/chain.py` · 담당 A · 스킬 — · 근거 stage-job §6, data-model §4 결과 저장·낮춤, BR-APR-03
- [x] T144 (B가 A 몫까지 완료 2026-09-28 — `serving/workers/records.py` open_confirmed · `serving/tests/test_confirm_before_judge.py`) [US3] 판정 전 확정 순서를 지킨다(stage-job §2 "판정 전 확정의 순서", main 52b1d09): 워커가 `judge`를 닫을 때(성공·품질 미달·소진 모두) 같은 작품의 잠긴 `origin='confirm'` 결과 작업을 `available_at=UTC_TIMESTAMP()`로 열고, `relief` 확정인데 `split_ok`가 TRUE가 아니면 `depth_relief`를 `done_downgraded`·`split_fail`로 닫고 `frame_compose`를 등록한다. 시험: 판정 중 확정 → 판정 완료 뒤에만 결과 작업 실행 — `serving/workers/stages/judge.py` · `serving/tests/test_confirm_before_judge.py` · 담당 A · 스킬 — · 근거 BR-SUG-05, stage-job §2·§6 — **B 구현 중 발견(2026-09-28), A 세션 연결이 끊겨 작업으로 등록**
- [x] T078 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/artworks/view.ts`) [US3] 작품 목록 API를 만든다: `GET /v1/artworks`(`v_artwork_display`, 현재 단계, 삭제 중 제외) — `api/src/modules/artworks/list.ts` · 담당 B · 스킬 API · 근거 FR-4, D13
- [ ] T079 [P] [US3] C6 낮춤 안내 컴포넌트를 만든다(S4·S5 전용) — `web/src/components/DowngradeNote.vue` · 담당 C · 스킬 FD · 근거 UX3, BR-EXH-07
- [ ] T080 [US3] S4 작품 목록·진행 상세 화면을 만든다(진입 홈, 상태 배지, 단계별 진행, G9 블록, 폴링) — `web/src/app/views/ArtworksView.vue` · 담당 C · 스킬 FD, RL · 근거 S4, UX7 · **D21 보정(2026-09-29)**: 모델 적재 대기 문구(`waitingForModel`·`etaSeconds`), 목록 갱신은 `updatedAt`이 아니라 `state`로

#### 실제 모델 (A)

- [x] T081 (A 완료 2026-09-29 — TorchServe 9561 두 모델 READY 128초·RSS 약 2GB, 관절 7~9초, OSMesa 헤드리스 렌더 125초(GIF 339프레임), 잠금 파일·매니페스트 M3 해시, U14 닫음[팀 확인]) [US3] M3 Animated Drawings를 Docker 없이 재현한다: 별도 conda 환경 `serving/.venv-m3`(Python 3.8·Java 17·OSMesa, Homebrew 미사용) + TorchServe 네이티브 127.0.0.1·워커 1개, OSMesa 헤드리스 렌더, 잠금 파일·체크섬(R-03 2026-09-29 개정) — `docs/A_모델재현기록.md` · `ops/torchserve/config.properties` · `serving/conda-m3.lock` · `serving/requirements-m3.lock` · 담당 A · 스킬 — · 근거 R-03, BR-MDL-06, plan 위험 1
- [x] T082 (A 완료 — `a/model-serving`, main 병합 전) [US3] M5 Depth Anything V2 Small(`depth-anything/Depth-Anything-V2-Small-hf`)을 재현하고 CPU·MPS(`exec_device='gpu'`, runtime에 mps 표기)·GPU 시간을 잰다 — `docs/A_모델재현기록.md` · `models/manifest.yaml` · 담당 A · 스킬 — · 근거 FR-22, U2, U6
- [x] T083 (A 완료 2026-09-29 — M3 렌더를 `m3_ad_run.py`(OSMesa)로, 실제 렌더→MP4 59~108초, M5 실제 시험 통과(MPS)) [US3] M3 렌더·M5 깊이 실제 어댑터를 만든다(MP4 H.264, 깊이 PNG16) — `serving/adapters/m3_render.py` · `serving/adapters/m5_depth.py` · 담당 A · 스킬 — · 근거 R-07

**Checkpoint**: US3 독립 검증 기준 통과.

### User Story 4 — 결과 확인·이야기·가족 전시 (P0 · High · MVP 핵심)

**목표**: 보호자가 원본과 결과를 나란히 보고 좋아요·낮춘 결과로 걸기·액자로 걸기·다시 찍기 중 하나를 고르고, 이야기를 적으면 가족 전시에 걸린다.
**독립 검증 기준**: 좋아요 + 필수 이야기 → 전시 중, 승인 전·이야기 빠짐이면 전시에 없음, 낮춘 결과로 걸기 → 2.5D 생성 뒤 2회차 확인, 다시 찍기 → 새 접수 + 이전 작품 삭제, 다른 가족 주소 직접 입력 404.

#### 시험

- [x] T084 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/tests/review-story-gallery.test.ts`) [P] [US4] 결정 시험: 회차당 1건(중복은 첫 결정 반환), 처리하지 못함은 액자·다시 찍기만(G9), use_lower → depth_relief·`processing`, retake → `deleting`+`deletion_request(retake)`, 원인 분류(D2·D14) — `api/tests/decision.test.ts` · 담당 B · 스킬 API · 근거 FR-6, Scenario 8·10, BR-APR-02~06
- [x] T085 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/tests/review-story-gallery.test.ts`) [P] [US4] 이야기·전시 시험: 미래 제작일·연령 범위 거부(G11), 전시 중 필수 비우기 거부, 전시는 `v_exhibit_gate`만, 낮춤 원인 비노출, 3D는 노출 꺼지면 액자 — `api/tests/story-gallery.test.ts` · 담당 B · 스킬 API · 근거 FR-7, FR-8, Scenario 1·13, G12, BR-EXH-07
- [x] T086 (B 완료 2026-09-28 — `b/api`, main 병합 전; `intake-confirm`·`review-story-gallery`·`captions` 시험에 나눠 둠) [P] [US4] 가족 교차 접근 시험: 목록·상세·파일 토큰·직접 주소 모두 0건 노출 — `api/tests/cross-family.test.ts` · 담당 B · 스킬 AUTH · 근거 Scenario 12, FR-9, G0
- [ ] T087 [P] [US4] 확인→이야기→전시 E2E: 자동 재생 없음, 원본 보기, 점수·토스트 없음 — `web/e2e/us4-review-story-gallery.spec.ts` · 담당 C · 스킬 FD · 근거 S5, S6, S8

#### 구현

- [x] T088 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/artworks/decision.ts`) [US4] 선택지 규칙 함수를 한 곳에 만든다(결과 종류·M1 마스크·상태 G9·G10) — `api/src/modules/artworks/decisionOptions.ts` · 담당 B · 스킬 API · 근거 SD_03 §2-3, BR-APR-02
- [x] T089 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US4] 결정 API를 만든다: `POST /v1/artworks/{id}/decision` 트랜잭션(data-model §4 결정), H6·H7·H8 — `api/src/modules/artworks/decision.ts` · 담당 B · 스킬 API · 근거 FR-6, G3, G10
- [x] T090 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US4] 이야기 API를 만든다: `PUT /v1/artworks/{id}/story` UPSERT, 트리거 거절 → 422 — `api/src/modules/artworks/story.ts` · 담당 B · 스킬 API · 근거 FR-7, G11
- [x] T142 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US4] 이야기 동시 수정 충돌을 막는다: `PUT /v1/artworks/{id}/story` 요청의 `baseUpdatedAt`이 `story.updated_at`과 다르면 저장하지 않고 409 `story_conflict`("다른 보호자가 먼저 고쳤어요"), S6은 최신 이야기를 다시 불러와 보여 준다. 두 보호자 동시 수정 시험 포함 — `api/src/modules/artworks/story.ts` · `api/tests/story-gallery.test.ts` · `web/src/app/views/StoryView.vue` · 담당 B·C · 스킬 API, FD · 근거 FR-9(이야기 동시 수정 충돌 안내, 1c460b0), U1 — **A 인계에서 발견한 누락, 번호는 끝번호 다음(T142)**
- [x] T091 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US4] 전시 API를 만든다: `GET /v1/gallery?child=`(`v_gallery`, 연령 묶음 → 제작일, 제목·제작일 찾기) — `api/src/modules/gallery/` · 담당 B · 스킬 API · 근거 FR-8, BR-EXH-02
- [ ] T092 [P] [US4] C5 원본-결과 비교를 만든다(정지 우선, 재생·시차 토글, WebGL 시차, 형식 표시 불가 시 원본) — `web/src/components/SideBySide.vue` · `web/src/components/ParallaxRelief.vue` · 담당 C · 스킬 FD · 근거 UX4, R-07
- [ ] T093 [P] [US4] C7 이야기 카드·C8 전시 조건 체크를 만든다(한마디와 AI 작성 칸 분리) — `web/src/components/StoryCard.vue` · `ExhibitCheck.vue` · 담당 C · 스킬 FD · 근거 UX5, UX1
- [ ] T094 [US4] S5 결과 확인 화면을 만든다(선택지는 API가 준 것만, G9·G10 차단 블록, 다시 찍기 확인 창) — `web/src/app/views/ReviewView.vue` · 담당 C · 스킬 FD, RL · 근거 S5
- [ ] T095 [US4] S6 이야기 쓰기 화면을 만든다(부분 저장, G11 차단, P0에서는 설명 확장점 숨김) — `web/src/app/views/StoryView.vue` · 담당 C · 스킬 FD, RL · 근거 S6 · **D21 보정(2026-09-29)**: 동시 수정 409 `story_conflict` C2 + 최신 내용 불러오기(`baseUpdatedAt`) — T142의 C 몫 · **D22**: 세션 만료 시 입력을 이 기기 브라우저에만 임시 저장하고 다시 로그인하면 "저장하지 못한 입력이 있어요"로 복원(저장 성공·로그아웃 때 지움, 서버 저장 없음) — T129도 같은 규칙
- [ ] T096 [US4] S8 가족 전시 화면을 만든다(아이별·연령 묶음, 동등 크기, 자동 넘김 없음) — `web/src/app/views/GalleryView.vue` · 담당 C · 스킬 FD, RL · 근거 S8, BR-EXH-03·04 · **D21 보정(2026-09-29)**: 제목·그린 날 찾기, G12 직접 주소·G17·G0 C2, 빈 전시와 "작품 올리기"

**Checkpoint**: US1~US4로 "가입 → 올리기 → 확정 → 결과 → 이야기 → 전시"가 가짜 모델로 끝까지 돈다(**MVP**).

### User Story 5 — 작품·아이 삭제와 실행 중 취소 (P0 · High)

**목표**: 보호자가 작품이나 아이를 지우면 즉시 목록에서 빠지고, 실행 중 작업을 멈춘 뒤 파일과 기록을 지워 집계 필드만 남긴다. 끝내 안 지워진 건은 운영자가 끝낸다.
**독립 검증 기준**: 처리 중 삭제 → 목록에서 즉시 제외 → 서빙 3종 멈춤 → 파일 0·설명 0·작품 연결 없는 집계 필드만 → `completed`. 아이 삭제는 작품 모두 지운 뒤 별칭 삭제.

- [x] T097 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/tests/deletion-sweeper.test.ts`) [P] [US5] 삭제 완전성 시험: 서빙 3종 각각 처리 중 삭제, 남은 파일·설명·연결 0, 늦게 온 결과 폐기, 끝난 삭제에 연결 없음 — `api/tests/deletion.test.ts` · `serving/tests/test_cancel.py` · 담당 B · 스킬 API · 근거 FR-10, Scenario 11, G18, G19
- [x] T098 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US5] 삭제 요청 API를 만든다: `DELETE /v1/artworks/{id}`·`/v1/children/{id}`, `deleting`+취소 플래그+`deletion_request` → 202 — `api/src/modules/deletion/request.ts` · 담당 B · 스킬 API · 근거 data-model §4 삭제 요청, BR-ACC-04
- [x] T099 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US5] sweeper 삭제 완료를 만든다: `v_deletion_hold`가 비면(또는 점유 만료 + 30초) 파일 삭제 → `stored_object` → `artwork`(CASCADE·SET NULL) → `completed`, 아이 삭제는 작품이 모두 지워진 뒤 `child` 삭제, 실패는 1·5·30분 재시도 뒤 `incomplete`, `gate_event` G19 해제·삭제된 작품 이벤트의 `subject_id` NULL — `api/src/sweeper/deletion.ts` · 담당 B · 스킬 DB · 근거 data-model §4 삭제 완료, BR-DEL-01~03, SD_03 §16-3
- [x] T100 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US5] 삭제 미완료 처리 운영 도구를 만든다(건 번호만, 이미지 없음, 원인 해결 뒤 다시 삭제) — `api/scripts/ops/purge-retry.ts` · 담당 B · 스킬 — · 근거 spec clarify 2026-09-28(삭제 미완료), BR-ACC-03
- [x] T147 (신지현 대행 완료 2026-09-29 — `c/web-prep`, `api/tests/web-prep.test.ts`) [US5] 삭제 진행 조회를 만든다(D21): `GET /v1/artworks/{id}/deletion`·`GET /v1/children/{id}/deletion` → `accepted`/`waiting_stop`(G19)/`deleting_files`/`done`, 없는 번호·다른 가족·끝난 삭제(미완료 포함)는 `done`(존재 비노출) + 시험 — `api/src/modules/deletion/routes.ts` · `api/tests/` · 담당 B(신지현 대행, D21) · 스킬 API · 근거 SD_02 S9, UC7, G19, BR-ACC-01
- [ ] T101 [US5] S9 삭제 확인·진행 대화상자를 만든다(지워지는 항목, G19 보류 블록, 잠긴 조작) — `web/src/app/components/DeleteDialog.vue` · 담당 C · 스킬 FD · 근거 S9 · **D21 보정(2026-09-29)**: 진행은 `GET /v1/artworks/{id}/deletion`·`/v1/children/{id}/deletion` 폴링(T147)

**Checkpoint**: US5 독립 검증 기준 통과.

### User Story 6 — 공동 보호자 초대·해제·나가기 (P0 · High)

**목표**: 만든 보호자가 다른 보호자 한 명을 이메일로 초대하고(부모 두 명까지, 1c460b0), 수락한 계정은 같은 권한으로 관리한다. 초대·해제는 만든 보호자만, 공동 보호자는 스스로 나간다(넷플릭스 계정 공유 방식, U1 확정).
**독립 검증 기준**: 초대(항상 202) → Mailpit 링크 → 수락(G28) → 공동 보호자가 작품 확정·삭제 가능 → 공동 보호자는 해제 403 → 만든 보호자가 해제 → 해제된 계정의 세션이 즉시 끊기고 가족 경로 접근 불가, 올린 작품은 남음 → 만든 보호자 나가기 409. 두 보호자의 동시 결정은 첫 결정만.
**설계 상태**: UC15, SD_01 §4-5(1.I1~1.I4)·G28·G29, SD_02 S1b, SD_03 `family_invite`·`role`·`owner_family_id`는 main `5a774f0`에 반영 완료. 계약은 contracts/openapi.yaml 가족 경로 7개, 결정은 research R-25.

- [x] T102 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] [US6] 공동 보호자 계약·규칙 시험: 가족 경로 7개 응답 코드(invites 202·취소 204·수락 204/400 `token_invalid`/403 `invite_email_mismatch`/409 `already_in_family`·members·해제 204/403·나가기 204/409), 수락 이메일 불일치 거부, 해제·나가기 뒤 그 계정 세션 0·가족 경로 접근 0, 올린 자료 유지, 동시 결정 첫 결정만(`uq_dc_round`), 초대 한도 초과에도 202, 공동 보호자의 초대 403 `invite_owner_only`, 두 명 찬 뒤 초대 409 `co_guardian_full`, 대기 초대 1건 — `api/tests/family.test.ts` · 담당 B · 스킬 API, AUTH · 근거 FR-9, G28, G29, BR-ACC-09, BR-APR-06
- [x] T103 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US6] 초대 흐름을 만든다: `GET/POST /v1/family/invites`(**만든 보호자만**, 공동 보호자는 403 `invite_owner_only`, 공동 보호자 있으면 409 `co_guardian_full` — 트리거 `trg_family_invite_bi` 거절을 Problem으로 변환, 같은 가족 대기 초대 `revoked_at`(대기 1건), 토큰 해시, 7일 `[예시값]`, 초대 메일, 한도 T049), `DELETE /v1/family/invites/{id}` — `api/src/modules/family/invites.ts` · 담당 B · 스킬 API, AUTH · 근거 UC15, R-25, data-model §4 초대
- [x] T104 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/family/routes.ts`) [US6] 수락을 만든다: `POST /v1/family/invites/accept`(G28 — 토큰 유효(아니면 400 `token_invalid`)·로그인 이메일 일치(아니면 403 `invite_email_mismatch`)·`family_id IS NULL`(아니면 409 `already_in_family`), `role='co'`), 초대 링크 가입은 새 가족 없이 합류하고 확인 메일 생략(UC13 A4, `signup.ts`에 초대 토큰 분기) — `api/src/modules/family/accept.ts` · `api/src/modules/auth/signup.ts` · 담당 B · 스킬 AUTH · 근거 G28, UC13 A4
- [x] T105 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/family/routes.ts`) [US6] 구성원·해제·나가기를 만든다: `GET /v1/family/members`(역할·이메일 가림), `DELETE /v1/family/members/{id}`(만든 보호자만, G29), `POST /v1/family/leave`(공동 보호자만), 둘 다 `family_id=NULL` + 그 계정 `app_session` 전부 삭제 + `gate_event`(대상 `guardian_account`) — `api/src/modules/family/members.ts` · 담당 B · 스킬 AUTH · 근거 G29, FR-9 "즉시 접근 불가", R-25
- [x] T106 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/auth/guards.ts`) [US6] 가족 없는 계정 처리를 만든다: 나가거나 해제된 계정이 로그인하면 자동으로 가족을 만들지 않고 "초대 기다리기 / 새 가족 공간 만들기" 중 고르게 함(U20 P0 기본값 `[추론]`), 경로는 `GET /v1/me`(가족 소속·역할)와 `POST /v1/family`(새 가족 만들기, `family` + `role='owner'`, 이미 소속이면 409) — `api/src/modules/family/noFamily.ts` · 담당 B · 스킬 API, AUTH · 근거 U20
- [ ] T107 [US6] 가족 보호자 화면 S1b, 초대 수락 S1c, 가족 없음 S1d를 만든다(SD_02 `274018f` 기준): S1b — 초대하기는 만든 보호자에게만, 두 명 차면 C3 비활성("보호자는 두 명까지예요")·대기 초대 0건, 공동 보호자 화면은 나가기만(초대·해제 없음), 403 `invite_owner_only`·409 `co_guardian_full` 차단 블록 / S1c — 400 `token_invalid`·403 `invite_email_mismatch`(초대받은 이메일로 로그인 안내)·409 `already_in_family`(만든 보호자이면 "다른 이메일로 다시 초대받기" 안내 `[추론]`) / S1d — `GET /v1/me`의 `hasFamily=false`이면 G0 차단 블록과 "초대 기다리기 / 새 가족 공간 만들기"(`POST /v1/family` 201, 409이면 S4로), 만들면 다른 가족 초대를 못 받는다는 안내 `[추론]` — `web/src/app/views/FamilyView.vue` · `InviteAcceptView.vue` · `NoFamilyView.vue` · 담당 C · 스킬 FD, RL · 근거 S1b, S1c, S1d, UX6, G0, G28, G29, U20 · **D21 보정(2026-09-29)**: 오류 사상 정정: 403 `forbidden_role`·reason `invite_email_mismatch`(이메일 다름)·`invite_owner_only`, 409 `co_guardian_full`·`already_in_family` — reason 기준

**Checkpoint**: US6 독립 검증 기준 통과.

### User Story 7 — 서비스 상태와 모델별 지표 (P0 · Medium)

**목표**: 운영자가 생존·모델별 준비와 원인별·모델별 지표를 가족 이미지 없이 본다.
**독립 검증 기준**: 장애 주입 뒤 지표에서 인프라 실패와 모델 낮춤이 따로 집계되고, 미도달 목록에 작품 번호·이미지가 없으며, 운영자 외 역할은 403.

- [x] T108 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] [US7] 지표·준비 시험: 원인 5분류 분리, 라벨·응답에 식별 정보 0, `/ready` 모델별(미준비·비활성·CPU 실행·비노출 구분) — `api/tests/ops.test.ts` · 담당 B · 스킬 API · 근거 FR-12, FR-13, FR-26, Scenario 14, BR-OPS-04
- [x] T109 (A 완료 — `a/model-serving`, main 병합 전) [US7] model-api 내부 준비 확인을 만든다(`GET /internal/ready`, 모델별 활성 버전·장치) — `serving/model_api/internal.py` · 담당 A · 스킬 API · 근거 FR-12
- [x] T110 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US7] 운영 API를 만든다: `/ready`(DB·저장소·model-api), `/metrics`(prom-client, 뷰 기반, p95는 여기서만), `/v1/admin/metrics`, `/v1/admin/unreached` — `api/src/modules/ops/` · 담당 B · 스킬 API · 근거 R-17, SD_03 §2-3
- [x] T143 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/ops/routes.ts`·`artworks/view.ts`) [US7] 모델 적재 상태를 붙인다(A `docs/A_모델적재_화면요구.md` §4): `/ready`에 `models[]` 요약(`anyLoading`, 공개 응답엔 버전·장치 없음), 운영 경로 `GET /v1/ops/models`·`POST /v1/ops/models/{id}/warmup`(model-api `/internal/models*` 프록시, M6는 409 `m6_preload_at_start_only`), 보호자 `GET /v1/artworks/{id}` 단계에 `waitingForModel`·`etaSeconds`만 — `api/src/modules/ops/models.ts` · `api/src/modules/artworks/detail.ts` · 담당 B · 스킬 API · 근거 FR-12, T109, contracts/openapi.yaml — **A 인계로 추가(T143)**
- [ ] T111 [P] [US7] C10 모델 상태 칩을 만든다 — `web/src/components/ModelStatusChip.vue` · 담당 C · 스킬 FD · 근거 SD_02 §3-4 · **D21 보정(2026-09-29)**: 상태 추가: 불러오는 중(`loading`, 경과·남은 시간, 1.5배 초과 문구)·적재 실패(`failed`)·내려감 짐작(`cold`, M6) — SD_02 C10·§3-5
- [ ] T112 [US7] S10 운영 화면을 만든다(생존·준비 요약 행, 지표, 원인 5분류, 미도달 추적) — `web/src/ops/views/OpsStatusView.vue` · 담당 C · 스킬 FD, RL · 근거 S10 · **D21 보정(2026-09-29)**: 역할별: 미도달 추적 탭은 운영자에게만(§2-1)

**Checkpoint**: US7 독립 검증 기준 통과.

### User Story 8 — 모델 평가·승격·롤백·비활성 (P0 · Medium)

**목표**: 평가 담당이 팀원 제작 평가 묶음으로 후보 버전을 전부 다시 평가하고, 통과한 것만 승격한다. 문제가 생기면 롤백하고, 첫 버전이면 비활성화한다.
**독립 검증 기준**: 평가 미완료가 있으면 승격 버튼 비활성, 통과 뒤 승격 → 새 작업부터 새 버전, 롤백 즉시, 첫 버전 비활성 → 그 모델이 필요한 선택지가 확정 화면에서 비활성·대기 작업은 `model_not_ready`.

- [x] T113 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] [US8] 평가·승격 시험: 해시 불일치·격리 미충족 거부(G21), 미완료·라이선스·계약 불일치 승격 거부(G22), 가족 사진 평가 항목 거부(G20), 비활성화 뒤 선택지 비활성·낮춤으로 우회 0건 — `api/tests/models-admin.test.ts` · 담당 B · 스킬 API · 근거 FR-24, Scenario 15, spec clarify(첫 버전 비활성화)
- [x] T114 (A 도구로 대체 — `serving/ops/models.py register`가 `models/manifest.yaml`에서 `model_version` 후보를 등록, B CLI는 만들지 않음) 매니페스트 동기화 CLI — 담당 B·A · 스킬 DB · 근거 R-16
- [x] T115 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/admin/routes.ts`) [US8] 관리 API를 만든다: 모델 목록·버전·평가 요청(`stage_job origin=eval`, priority 50, 보완 S3)·평가 결과·승격(`v_promotion_eligibility`)·롤백·**비활성화**(활성 버전 → `retired`, `release_event.kind='deactivate'`는 보완 S9 — SD_03 개정 전에는 앱 감사 로그)·평가 항목 등록 — `api/src/modules/admin/models.ts` · `api/src/modules/admin/evalItems.ts` · 담당 B · 스킬 API · 근거 contracts `/v1/admin/*`, BR-MDL-03·04·07
- [x] T116 (B 완료 2026-09-28 — `b/api`, main 병합 전; `api/src/modules/artworks/models.ts`) [US8] 확정 화면·확정 API가 비활성 모델의 선택지를 이유와 함께 막도록 연결한다(판정 모델 비활성이면 제안 없이 직접 확정) — `api/src/modules/artworks/confirm.ts` · `web/src/app/views/ConfirmView.vue` · 담당 B·C · 스킬 API, FD · 근거 spec clarify(첫 버전 비활성화), BR-FBK-04
- [x] T117 (A 완료 2026-09-29 — stage-job §12 설계 먼저, 워커 점유 순서 보호자→평가→외부, 모델별 result_path, timeout 재시도 없음, 처리 시간·메모리, 이어받기 incomplete 채움, `eval/runner.py run·report`, 시험 17건. M6(P0.5)·M7(P1) 평가는 해당 구간에서) [US8] 평가 실행기를 만든다(같은 어댑터로 항목별 결과·시간·메모리, 인프라 소진은 평가 미완료) — `eval/runner.py` · `serving/workers/stages/eval.py` · 담당 A · 스킬 — · 근거 UC9 BF4, FR-17
- [ ] T118 (A 부분 2026-09-29 — `eval/items/manifest.yaml` 틀·구성 목표[추론]·등록 방법까지. 팀원 제작 작품 제작·등록이 남음) [P] [US8] 평가 묶음을 만든다(팀원 제작: 사람·비인물·촬영 조건·입체·설명 입력, 기대 경로) — `eval/items/manifest.yaml` · 담당 A · 스킬 — · 근거 FR-17, BR-MDL-04
- [ ] T119 [US8] S11 모델 평가·승격 화면을 만든다(매니페스트 표, 진행, G22 차단, 롤백·비활성화) — `web/src/ops/views/ModelsView.vue` · 담당 C · 스킬 FD, RL · 근거 S11 · **D21 보정(2026-09-29)**: 모델 상태 표 2초 폴링(`GET /v1/ops/models`)·지금 불러오기(운영자·평가 담당만)·M6 "첫 요청 때 올라가요", 롤백 후보 없으면 비활성화(clarify), 운영자·연동 개발은 읽기 전용

**Checkpoint**: US8 독립 검증 기준 통과.

### User Story 9 — API활용 메뉴와 외부 모델 기능 호출 (P0 · Medium/Low)

**목표**: 팀원이 API활용 메뉴에서 엔드포인트·가이드라인·매뉴얼을 보고 평가 묶음 작품으로 시험 호출한다. 외부 클라이언트는 API 키로 `segment`·`classify`·`pose`(팀 내부 키만)·`relief`를 부른다.
**독립 검증 기준**: 키 없음 401·권한 403(팀 밖 키로 pose)·한도 429·크기 413·형식 422·비활성 503·3D 404, 결과 1회 수령 뒤 404, 외부 입력 잔존 0, 가족 경로 403.

- [x] T120 (B 완료 2026-09-28 — `b/api`, main 병합 전) [P] [US9] 외부 호출 계약 시험 — `serving/tests/test_model_api.py` · 담당 B · 스킬 API, AUTH · 근거 FR-28, Scenario 18, G2, G24, G25, D17
- [x] T121 (B 완료 2026-09-28 — `b/api`, main 병합 전; `serving/model_api/auth.py`·`serving/config/ext-limits.yaml`) [US9] model-api 키 인증·한도를 만든다(`X-API-Key` SHA-256, 키 종류 `team_internal`·`course_internal`·`external`·`test`, `pose`는 `team_internal`·`test`만 403, 분당 30·하루 1,000은 `external_call_log` 창 집계·동시 2는 진행 중 `external_job` 수, 모든 호출을 `external_call_log`에 — 예시값은 설정 파일) — `serving/model_api/auth.py` · `serving/config/ext-limits.yaml` · 담당 B · 스킬 AUTH · 근거 R-09, U12
- [x] T122 (B가 A 몫까지 완료 2026-09-28 — model-api 등록·상태·결과 + 워커 `serving/workers/external.py` · sweeper 이어받기 · `serving/tests/test_external_worker.py`) (**model-api 쪽 B 완료** 2026-09-28 — 등록·상태·결과 1회 수령·만료, `b/api`. 워커 `serving/workers/external.py`는 A 남음) [US9] 외부 작업을 만든다: `POST /v1/models/{function}` → `external_job`(메타만, 입력은 `ext/{ext_job_id}/`, 점유 컬럼은 보완 S4), 상태 조회, 결과 1회 수령 후 삭제, 만료 정리, 서빙군별 외부 동시 1건·낮은 우선순위 — `serving/model_api/models.py` · `serving/workers/external.py` · 담당 A·B · 스킬 API · 근거 D8, D17, H16
- [x] T123 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US9] 키 발급 운영 CLI를 만든다(`npm run ops:key -- issue --kind team_internal|course_internal|test`, 원문 1회 표시, `external`은 U12 확정 전 발급 금지) — `api/scripts/ops/key.ts` · 담당 B · 스킬 AUTH · 근거 R-09, D17
- [x] T124 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US9] API활용 API를 만든다: 명세 조회(`/openapi.json` 기반)·시험 호출(평가 묶음 작품만, G23) — `api/src/modules/apiGuide/` · 담당 B · 스킬 API · 근거 R-11, BR-API-07~09, FR-30
- [ ] T125 [US9] S12 API활용 메뉴 화면을 만든다(탭 3개, 버전 대조 경고, 시험 호출·G23·G25 차단) — `web/src/ops/views/ApiGuideView.vue` · 담당 C · 스킬 FD, RL · 근거 S12 · **D22**: 키 발급·폐기 화면 없음 — 매뉴얼 탭에 `npm run ops:key` 절차 안내

**Checkpoint**: US9 독립 검증 기준 통과.

### User Story 10 — 키워드 작품 설명 초안 (P0.5 · Medium)

**착수 조건**: P0 완료 + U3(과정 제공 LLM)·U11(규칙 검사)·U16(승인 설명 교체)·U12(약관) 확정. 그 전에는 착수하지 않는다(plan 단계 P0.5).
**목표**: 보호자가 키워드·태그로 설명 초안을 받아 고치고 승인한다. 걸린 초안은 저장하지 않고, LLM 장애는 보호자가 고른다.
**독립 검증 기준**: llm-contract.md 전 항목, Scenario 17, 입력에 이미지·별칭 없음, 규칙 검사 반복 실패 → 템플릿 낮춤, 승인 뒤 재생성 409.

- [x] T126 (A 완료 — `a/model-serving`, main 병합 전) [P] [US10] M6 **Qwen3-4B-Instruct-2507**(`Qwen/Qwen3-4B-Instruct-2507`, GGUF Q4_K_M — Ollama 태그 `qwen3:4b-instruct-2507-q4_K_M`, `num_ctx 8192`)를 재현해 블롭 다이제스트를 매니페스트 `weights_sha256`에 기록하고, `llm-server`(127.0.0.1:8200, 큐 없는 동기 HTTP, `POST /v1/caption`·`GET /v1/ready`, 동시 1)를 만든다. Ollama는 실행기일 뿐이며 `llm-server`만 호출한다 — `serving/llm_server/` · `docs/A_모델재현기록.md` · 담당 A · 스킬 API · 근거 R-18
- [ ] T127 [P] [US10] caption 패키지를 만든다(허용 입력 조립·규칙 검사·템플릿) + 시험 — `caption/` · `caption/tests/` · 담당 C · 스킬 — · 근거 llm-contract.md, BR-CAP-01·02·07
- [x] T128 (B 완료 2026-09-28 — `b/api`, main 병합 전) [US10] 설명 API를 만든다(`/captions`, `GET /v1/captions/model-status`(S7 대기 요약 warming·maxWaitSeconds·busy, 모델 이름·원래 상태 없음), 승인 고정, G13~G16): 호출 전 `stage_job(stage_kind='caption', origin='caption', status='running')`를 만들고 응답으로 닫는다(`done` / `done_downgraded`+`llm_to_template` / 인프라), 걸린 초안은 `caption_check_failure`만, 인프라 재시도 1초·3초 뒤 소진 시 template·later·direct 선택지(stage-job §11) — `api/src/modules/captions/` · 담당 B · 스킬 API · 근거 FR-27
- [x] T145 (B가 A 몫까지 완료 2026-09-28 — `serving/llm_server/app.py` · `test_llm_server.py`) [US10] `llm-server` `POST /v1/caption` 응답에 `failClasses`(걸린 초안마다 분류, 순서대로, 길이 = `ruleFailCount`)를 싣는다(llm-contract §4, 2026-09-28 추가) — app-api가 `caption_check_failure`를 초안마다 1행씩 쓰는 근거. 시험: 두 번 걸리고 세 번째 통과 → `failClasses` 2개 — `serving/llm_server/app.py` · `serving/tests/test_llm_server.py` · 담당 A · 스킬 API · 근거 SD_03 `caption_check_failure`, FR-26 설명 규칙 검사 실패율 — **B 구현 중 발견(T128)**
- [ ] T129 [US10] S7 설명 초안 패널을 만든다(보낼 입력 미리보기, AI 작성 표시, G15 선택지) — `web/src/app/views/CaptionPanel.vue` · 담당 C · 스킬 FD, RL · 근거 S7 · **D21 보정(2026-09-29)**: 첫 생성 지연 안내(`GET /v1/captions/model-status`의 `warming`·`maxWaitSeconds`·`busy`) · **D22**: 입력 임시 저장 규칙은 T095와 같음
- [x] T130 (B 완료 2026-09-28 — `b/api`, main 병합 전; `serving/model_api/external.py`) [US10] 외부 `caption` 엔드포인트와 약관을 연다(model-api가 키·한도 확인 뒤 `llm-server`로 동기 프록시, `external_job` 없음, 이미지·이름 필드 422) — `serving/model_api/caption.py` · 담당 B · 스킬 API · 근거 FR-28, D17

### User Story 11 — 만들기 작품 3D 조각 (P1)

**착수 조건**: U2 팀 서버 GPU 확인 + U4 TRELLIS 제외 확인 + 노출 설정을 켜는 주체 결정(SD_01 §17 #3).
**독립 검증 기준**: Scenario 19, 노출 설정 꺼짐이면 3D 선택지·결과 비노출(액자로 표시), 평면 그림에 쓰지 않음.

- [ ] T131 [P] [US11] M7 TripoSR을 재현하고 어댑터를 만든다(GLB) — `serving/adapters/m7_triposr.py` · 담당 A · 스킬 — · 근거 FR-29
- [ ] T132 [US11] `sculpture` 단계·낮춤(3D→2.5D→액자)과 노출 설정 변경 경로를 만든다 — `serving/workers/stages/results.py` · `api/src/modules/admin/featureSetting.ts` · 담당 A·B · 스킬 API · 근거 D10, G17 · **D22**: 노출 설정은 서비스 운영자가 운영 CLI로 켠다(화면·API 없음) — `api/scripts/ops/feature.ts`로 대체
- [ ] T133 [US11] 3D 회전 보기를 만든다(`<model-viewer>`, "뒷면은 AI가 추정했어요", 원본 함께) — `web/src/components/SculptureViewer.vue` · 담당 C · 스킬 FD · 근거 BR-EXH-06

---

## Final Phase: Polish & Cross-Cutting

- [x] T134 (B 완료 2026-09-28 — `.gitlab-ci.yml` contracts(Redocly 오류 0·사본 diff)·api·serving 작업. 앱·모델 명세는 계약 파일을 그대로 내보냄) 계약 정본과 루트 사본의 일치를 CI로 점검한다: `.specify/features/우리-아이-미술관/contracts/*`와 `contracts/*` 차이 0, Redocly lint 오류 0, app-api `/openapi.json`·model-api `/v1/models/openapi.json`이 계약과 일치(BR-API-08) — `.gitlab-ci.yml` · `contracts/` · 담당 B · 스킬 API · 근거 plan Phase 1, BR-API-08
- [x] T135 (2026-09-28 완료 — SD_03 §18-2, 검증 17/17) SD_03에 구현 보완 S1~S9(재시도 시각·우선순위·평가 작업·외부 점유·팀원 비밀번호·세션·요청 한도·장치 표기·비활성화 `release_event.kind='deactivate'`)와 `infra_failure` 결과 원인 정의를 역반영한다(DDL 검증 3종 재실행) — `design/uri_gallery_ddl.sql` · `design/SD_03_데이터베이스설계서_우리아이미술관.md` · 담당 B · 스킬 DB · 근거 data-model §6
- [x] T136 (B 완료 2026-09-28; `docs/B_통합시험.md` — 성능 1차·웹 흐름은 팀 서버·C 화면 뒤) 통합 시험을 하고 기록한다: 장애 주입 5종 × 결과 단계(인프라→낮춤 집계 0), 삭제 완전성, 가족 교차 접근, 로그 표본(이미지·객체 키·자유 입력 0), 성능 1차(움직임 p95 3분·액자 p95 30초 잠정) — `docs/B_통합시험.md` · 담당 B · 스킬 — · 근거 spec Success Criteria, plan 단계 10
- [ ] T137 [P] 평가 묶음 1차 측정과 임계값 제안(U5)·시간 상한 교체(U6) — `docs/A_평가묶음_1차측정.md` · `serving/config/thresholds.yaml` · `serving/config/limits.yaml` · 담당 A · 스킬 — · 근거 FR-17, U5, U6
- [ ] T138 [P] 접근성·반응형 점검: 390px·1440px, 키보드만 조작, 비활성 버튼 사유 낭독, 대비 4.5:1, 움직임 줄이기, 점수·미리 선택·토스트 0 — `web/e2e/a11y.spec.ts` · 담당 C · 스킬 RL, FD · 근거 SD_02 §17
- [ ] T139 [P] 사용 관찰(팀원 보호자 역할, 실제 아동 제외)과 막힌 지점 기록 — `docs/C_사용관찰.md` · 담당 C · 스킬 — · 근거 FR-18, U13
- [x] T140 (B 완료 2026-09-28; `ops/DEPLOY.md` 절차 — 첫 배포는 팀 서버 확인(U2·U14) 뒤) 팀 서버 배포 절차를 정리하고 한 번 올린다(ssh·git pull·npm ci·build·pm2 reload, nginx HTTPS) — `ops/DEPLOY.md` · 담당 B · 스킬 — · 근거 R-02, quickstart §7
- [x] T141 (B 완료 2026-09-28; `docs/추적성.md`) 추적성 표를 만든다: FR → UC → 작업(T) → 검증 증거 — `docs/추적성.md` · 담당 B · 스킬 — · 근거 FR-19
- [ ] T148 [P] 웹 CI·배포 경로를 맞춘다: `.gitlab-ci.yml`에 `web` 작업(lint·type·Vitest), DEPLOY의 `web/dist`를 nginx `root /srv/uam/web/dist`로 복사하는 단계(지금은 빌드만 하고 옮기지 않음) — `.gitlab-ci.yml` · `ops/DEPLOY.md` · 담당 C(D21) · 스킬 — · 근거 R-19, T140
- [ ] T150 [P] 화면 문구 정본을 만든다(D22 ⑦): SD_02 문구를 화면·게이트·reason·근거 BR로 모은 `docs/C_화면문구.md` 초안 → 신지현 검토로 U10 닫음 — `docs/C_화면문구.md` · 담당 C · 스킬 — · 근거 U10, R-20

---

## Dependencies

```
Phase 1 Setup (T001 main 기준 확인이 맨 앞)
        │
Phase 2 Foundational ── DB(T013~T018) ─┬─ 앱 API 공통(T019~T026)
                                        ├─ 서빙 공통(T027~T034)
                                        └─ 웹 공통(T035~T040)
        │
        ├── US1 가입·아이 ─────────────┐
        ├── US2 접수·확정 ──┐          │   (US2~US4는 가짜 모델로 독립 진행)
        │                   ├── US3 결과·낮춤 ── US4 확인·이야기·전시 ══ MVP
        │                   │
        ├── US5 삭제 (US2 이후: 삭제할 작품과 실행 중 작업이 필요)
        ├── US6 공동 보호자 (US1 이후 — 설계는 main에 완료)
        ├── US7 지표 (US3 이후: 집계할 단계 작업이 필요)
        ├── US8 평가·승격 (서빙 공통 이후, US2·US3 실제 어댑터와 병행)
        └── US9 API활용·외부 호출 (서빙 공통 + US8 활성 버전)
                │
        P0 완료 ── US10 설명(P0.5, U3·U11·U16·U12 확정 뒤) ── US11 3D(P1, U2·U4 확인 뒤)
                │
        Final Phase (T136 통합 시험은 US1~US9 뒤)
```

- **스토리 간 의존**: US3 → US2(확정된 작품이 필요), US4 → US3(결과가 필요). US1은 로그인이 필요한 모든 스토리의 화면 흐름에 앞서지만, API 시험은 시드 계정으로 독립 진행한다.
- **실제 모델 작업(T068~T072, T081~T083)** 은 스토리 완료 조건이 아니다. 가짜 어댑터로 스토리를 끝낸 뒤 같은 시험이 실제 어댑터로도 통과해야 한다(plan 단계 7).
- **같은 파일을 여러 스토리가 고치는 곳**: `api/src/modules/artworks/confirm.ts`(T063 → T116), `web/src/app/views/ConfirmView.vue`(T067 → T116), `serving/workers/sweeper.py`(T033 → T099), `serving/workers/stages/results.py`(T076 → T132), `api/src/modules/auth/signup.ts`(T046 → T104). 순서대로 한다.

## Parallel Execution Examples

- **Phase 1**: T003 · T004 · T005 · T006 · T007 · T008 · T009 · T010 · T011을 A·B·C가 동시에(T001·T002 뒤).
- **Phase 2**: B는 T013→T016→T017, T014·T015(보완 확인 시험), 동시에 T019·T020·T021·T025·T026. A는 T027·T028·T032를 병렬로 하고 T029→T030→T031→T034. C는 T035·T036·T037·T038·T039를 병렬로 하고 T040.
- **US1**: 시험 T041·T042·T043·T044 병렬 → B는 T045 뒤 T046→T047→T048→T049, T050·T051 / C는 T052·T053·T054·T055 병렬.
- **US2**: 시험 T056·T057·T058·T059 병렬 → B T060→T061→T062→T063 / A T064→T065 / C T066·T067 병렬 / A 실제 모델 T068·T069 병렬 → T070→T071·T072.
- **US3**: T073·T074·T075 병렬 → A T076→T077 / B T078 / C T079 → T080 / A 실제 모델 T081·T082 병렬 → T083.
- **US4**: T084·T085·T086·T087 병렬 → B T088→T089, T090, T091 / C T092·T093 병렬 → T094·T095·T096.
- **스토리 간**: MVP(US1~US4) 뒤에는 US5(B·C)·US7(A·B·C)·US8(A·B·C)을 동시에, US6은 B가 T102 시험 → T103·T104·T105·T106을 만드는 동안 C가 T107 화면을 만든다.

## Implementation Strategy

1. **MVP = US1~US4를 가짜 모델로 끝까지 한 번 돌리기.** plan 원칙("P0 흐름이 가짜 모델로 한 번 끝까지 돈 뒤 실제 모델을 끼운다")을 따른다. 이 시점에 가입 → 올리기 → 확정 → 결과(낮춤 포함) → 확인 → 이야기 → 전시가 된다.
2. **실제 모델 교체**: A가 T068~T072·T081~T083으로 어댑터를 바꿔 끼우고, US2·US3 시험이 실제 모델로도 통과하는지 본다. M3 네이티브 렌더가 안 되면(plan 위험 1) M3를 `model_not_ready`로 두고 2.5D·액자 경로로 계속 간다.
3. **P0 나머지**: US5 삭제 → US6 공동 보호자 → US7 지표 → US8 평가·승격 → US9 외부 호출. 각 스토리 체크포인트에서 독립 검증 기준으로 멈춰 확인한다.
4. **통합 시험(T136)과 1차 측정(T137)** 으로 P0를 닫는다. spec Success Criteria 정량 항목을 점검표로 확인한다.
5. **P0.5(US10)·P1(US11)은 착수 조건이 풀린 뒤에만** 시작한다(spec Risks 범위 확장).

## 요약

| 구분 | 작업 수 |
|---|---:|
| Phase 1 Setup | 12 |
| Phase 2 Foundational | 28 |
| US1 가입·아이 | 15 |
| US2 접수·확정 | 17 |
| US3 결과·낮춤 | 11 |
| US4 확인·이야기·전시 | 13 |
| US5 삭제 | 5 |
| US6 공동 보호자 | 6 |
| US7 지표 | 5 |
| US8 평가·승격 | 7 |
| US9 외부 호출 | 6 |
| US10 설명(P0.5) | 5 |
| US11 3D(P1) | 3 |
| Final Phase | 8 |
| D21·D22 추가(T146~T150) | 5 |
| **합계** | **141 + T142~T145 + 5** |
