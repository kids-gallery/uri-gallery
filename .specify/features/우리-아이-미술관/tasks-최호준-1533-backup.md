# Tasks: 우리 아이 미술관 (P0 우선 · P0.5 · P1 조건부)

**Spec**: [spec.md](./spec.md) v2.2(D18 포함) · **Plan**: [plan.md](./plan.md) · **Data Model**: [data-model.md](./data-model.md) · **Contracts**: [contracts/](./contracts/) · **Quickstart**: [quickstart.md](./quickstart.md)
**Created**: 2026-09-28
**입력**: `Intent-Tasks.md`(작업에 붙일 스킬 5종) · `design/`(UC_00~UC_14 · SD_01 P0~P10·G0~G27·H1~H16 · SD_02 S0~S12·C1~C10 · SD_03 DDL `design/uri_gallery_ddl.sql` · REF D1~D18) · `docs/공통/역할분담.md` · spec clarify 2026-09-28(U1 공동 보호자 · U10 화면 동작 · 삭제 미완료 · 첫 버전 비활성화)

## 표기 규약

- `[P]` — 다른 파일을 건드리므로 **병렬 실행 가능**
- `[US1]` — 해당 사용자 스토리 전용 작업
- 같은 파일을 수정하는 작업에는 `[P]`를 붙이지 않는다 (순차 실행)
- 각 작업은 파일 경로를 명시한다
- **담당**: `A` 최호준(모델 서빙) · `B` 이제민(API·오케스트레이션) · `C` 신지현(보호자 경험·설명) — `docs/공통/역할분담.md`
- **스킬**(Intent-Tasks.md): `FD` Frontend Design · `RL` Responsive Layout · `API` API Development · `DB` Database Design · `AUTH` Authentication · `—` 해당 스킬 없음(모델 재현·문서)
- **근거**: FR(spec) · UC · G(게이트, SD_01 §15) · BR(업무규칙) · R(research) · S/C(SD_02 화면/컴포넌트)
- **시험 작업을 넣는다.** plan R-19(Vitest·Supertest·Playwright·pytest·계약 시험·장애 주입)와 SD_03 "DDL 검증 3종"이 시험을 명시적으로 요구한다. 스토리마다 시험 작업이 구현보다 앞선다.
- **이름 기준**: DB 이름은 SD_03 DDL(`artwork`·`stage_job`·`artwork_outcome`·`failed` 등)을 따른다. quickstart·research 일부에 남은 옛 이름(`process_job`·`unprocessable`·`staff_account`)은 쓰지 않는다(T134에서 정리).

## 사용자 스토리 구성

spec의 FR과 수용 시나리오(Scenario 1~19)를 유스케이스 단위로 묶었다. 우선순위는 spec 범위 구간(P0 → P0.5 → P1)과 UC 우선순위(High → Medium → Low)를 따른다.

| 스토리 | 제목 | 구간·우선 | UC | 프로세스 | 화면 | 수용 시나리오 |
|:--:|---|:--:|---|---|---|---|
| US1 | 보호자 가입·로그인·로그인 정보 찾기·아이 등록 | P0 · High | UC13 · UC14 · UC1 | P1 | S0 · S0b · S1 | FR-31 · FR-32 · FR-1 수용 기준 |
| US2 | 작품 접수와 판정 제안 확정 | P0 · High (MVP 핵심) | UC2 | P2 · P0-1 | S2 · S3 | 2 · 3 · 9 |
| US3 | 결과 생성·낮춤 체인·진행 확인 | P0 · High (MVP 핵심) | UC3 | P0-2 · P3(3.1~3.2) | S4 | 4 · 5 · 6 · 7 |
| US4 | 결과 확인·이야기·가족 전시 | P0 · High (MVP 핵심) | UC4 · UC5 · UC6 | P3 · P5 | S5 · S6 · S8 | 1 · 8 · 10 · 12 · 13 |
| US5 | 작품·아이 삭제와 실행 중 취소 | P0 · High | UC7 | P6 | S9 | 11 |
| US6 | 공동 보호자 초대·해제·나가기 | P0 · High | (신규 필요) | (신규 필요) | (신규 필요) | FR-9 수용 기준(clarify U1) |
| US7 | 서비스 상태와 모델별 지표 | P0 · Medium | UC8 | P7 | S10 | 14 |
| US8 | 모델 평가·승격·롤백·비활성 | P0 · Medium | UC9 | P8 | S11 | 15 |
| US9 | API활용 메뉴와 외부 모델 기능 호출 | P0 · Medium/Low | UC11 · UC12 | P9 · P10 | S12 | 16 · 18 |
| US10 | 키워드 작품 설명 초안 | P0.5 · Medium | UC10 · UC12(caption) | P4 | S7 | 17 |
| US11 | 만들기 작품 3D 조각 | P1 | UC6 A3 · UC2 A9 | P0-2(sculpture) | S3 · S5 · S8 | 19 |

---

## Phase 1: Setup

- [ ] T001 D18(보호자 이메일 가입·로그인 정보 찾기)을 이 저장소 `main`에 합친다: `~/project2610-신지현`의 커밋 `5fb8cc4`·`9f45a8b`를 병합 요청으로 가져오고, `design/uri_gallery_ddl.sql`이 `guardian_account.email_norm`·`auth_email_token`·G26·G27을 포함하는지, `uq_child_family_alias`가 없는지 확인한다 — `design/` · `.specify/features/우리-아이-미술관/spec.md` · 담당 B · 스킬 — · 근거 D18, data-model §1
- [ ] T002 저장소 골격을 만든다: `web/`·`api/`·`db/migrations/`·`serving/`·`caption/`·`eval/`·`models/`·`contracts/`·`ops/`와 각 폴더 `README.md`(담당·경계 한 줄) — 루트 · 담당 B · 스킬 — · 근거 quickstart §1
- [ ] T003 [P] 앱 API 프로젝트를 초기화한다: Node 20(`.nvmrc`), Express 4 · TypeScript 5 · mysql2 3 · pino · zod · Vitest · Supertest, ESLint·Prettier, `npm run build|test|lint|db:migrate` 스크립트 — `api/package.json` · `api/tsconfig.json` · 담당 B · 스킬 API · 근거 R-01
- [ ] T004 [P] 웹 프로젝트를 초기화한다: Vite 5 · Vue 3.4 · TypeScript · Pinia · Vue Router 4 · Vitest · Vue Test Utils · Playwright(390px·1440px 프로젝트 2개) — `web/package.json` · `web/vite.config.ts` · `web/playwright.config.ts` · 담당 C · 스킬 FD · 근거 R-01, R-19
- [ ] T005 [P] 서빙 Python 프로젝트를 초기화한다: Python 3.11 venv, FastAPI · uvicorn · PyMySQL · structlog · pillow · pillow-heif · pytest, 해시 잠금 파일 — `serving/pyproject.toml` · `serving/requirements.lock` · 담당 A · 스킬 API · 근거 R-01, R-03
- [ ] T006 [P] 환경 변수 견본과 비밀 제외를 둔다: `DB_HOST`·`DB_PORT`·`DB_USER`·`DB_NAME`·`DB_PASSWORD`·`SESSION_SECRET`·`STORAGE_ROOT`·`MODEL_ROOT`·`MODEL_API_INTERNAL_URL`·`UAM_FAKE_MODELS`·`GPU_ENABLED`·`SMTP_*`, `.gitignore`에 `.env` — `.env.example` · `.gitignore` · 담당 B · 스킬 — · 근거 R-21
- [ ] T007 [P] 계약 정본을 루트로 복사하고 lint를 건다: `.specify/…/contracts/*` → `contracts/`, Redocly 설정, `npm run contracts:lint` — `contracts/` · `redocly.yaml` · 담당 B · 스킬 API · 근거 plan Phase 1
- [ ] T008 [P] pm2 구성을 만든다: `app-api`(:3000) · `model-api`(:8100) · `worker-cpu` · `worker-gpu` · `sweeper`, `llm-server`(:8200)는 P0.5 주석 처리, 모두 127.0.0.1 — `ops/ecosystem.config.cjs` · 담당 B · 스킬 — · 근거 R-02
- [ ] T009 [P] nginx 라우팅을 만든다: `/`·`/app/*`·`/ops/*` → `web/dist`, `/v1/models/*` → :8100, 그 밖 `/v1/*`·`/live`·`/ready`·`/metrics` → :3000, `/_files/*` internal(X-Accel-Redirect), HTTPS — `ops/nginx.conf` · 담당 B · 스킬 — · 근거 R-02, plan Architecture
- [ ] T010 [P] GitLab CI를 lint·타입 검사·단위 시험·계약 lint만 돌게 만든다(배포 없음) — `.gitlab-ci.yml` · 담당 B · 스킬 — · 근거 R-02
- [ ] T011 [P] 디자인 토큰과 글꼴을 옮긴다: `design/style-guide/`의 `--color-*`·`--r-*`·`--s-*`·`.t-*` → CSS 변수, `@fontsource/inter`·`pretendard` 자체 호스팅 — `web/src/styles/tokens.css` · `web/src/styles/base.css` · 담당 C · 스킬 FD · 근거 R-20
- [ ] T012 `Intent-Plan.md`의 평문 DB 비밀번호 처리(교체 또는 문서 정리)를 팀에 결정 요청하고 결과를 기록한다 — `docs/공통/결정_DB비밀정보.md` · 담당 B · 스킬 — · 근거 R-21, plan Open Questions

**Checkpoint**: 세 프로젝트가 빌드되고 CI가 녹색이다.

---

## Phase 2: Foundational (모든 스토리의 선행 조건)

### DB (B)

- [ ] T013 SD_03 DDL(D18판)을 기준 마이그레이션으로 그대로 넣는다 — `db/migrations/0001_sd03_baseline.sql` · 담당 B · 스킬 DB · 근거 data-model §8
- [ ] T014 큐 보완 S1~S4를 추가한다: `stage_job.available_at`·`priority`·`ix_sj_claim`, `origin='eval'`+`evaluation_id`·`eval_item_id`+CHECK, `external_job.claimed_by`·`claim_expires_at`·`available_at` — `db/migrations/0100_impl_queue.sql` · 담당 B · 스킬 DB · 근거 data-model §6 S1~S4
- [ ] T015 인증 보완 S5~S7을 추가한다: `team_member.password_hash`·`disabled_at`, `app_session`, `auth_rate_event`(HMAC 해시만) — `db/migrations/0101_impl_auth.sql` · 담당 B · 스킬 DB, AUTH · 근거 data-model §6 S5~S7
- [ ] T016 마이그레이션 실행기를 만든다: `schema_migration(version, checksum, applied_at)`, 재실행 안전, 로컬 `uam_test` 먼저 — `api/scripts/migrate.ts` · 담당 B · 스킬 DB · 근거 data-model §8
- [ ] T017 DDL 검증 3종 시험을 만든다: 빈 스키마 실행 · 재실행 · SD_03 §18 위반 48건(D18로 바뀐 별칭 중복 1건은 "허용"으로 뒤집고 G26·G27 위반을 추가) 거부 확인 — `db/tests/ddl.verify.test.ts` · 담당 B · 스킬 DB · 근거 SD_03 §18
- [ ] T018 팀원 계정·역할 시드 CLI를 만든다(`npm run ops:staff -- add --email … --role operator|evaluator|integrator`, argon2id) — `api/scripts/ops/staff.ts` · 담당 B · 스킬 AUTH · 근거 BR-ACC-05, data-model §6 S5

### 앱 API 공통 (B)

- [ ] T019 [P] DB 풀과 트랜잭션 헬퍼(`withTx`, `FOR UPDATE`)를 만든다 — `api/src/db/pool.ts` · `api/src/db/tx.ts` · 담당 B · 스킬 API · 근거 data-model §4
- [ ] T020 [P] 오류 응답을 만든다: RFC 9457 Problem Details + `code`, 트리거 `SIGNAL` `MESSAGE_TEXT`(예 `G11 BR-STY-02 made_on_in_future`)를 파싱해 409/422 + `gate_event` 1행 — `api/src/lib/problem.ts` · `api/src/lib/gateEvent.ts` · 담당 B · 스킬 API · 근거 R-10, data-model §5
- [ ] T021 [P] 허용 목록 로거를 만든다(`request_id`·`route`·`status`·`code`·`stage`·`model_id`·`model_version`·`outcome`·`duration_ms`만) — `api/src/lib/logger.ts` · 담당 B · 스킬 API · 근거 BR-PRV-01, R-17
- [ ] T022 세션을 만든다: `express-session` + `app_session` 저장소, 보호자 `uam_sid`/팀원 `uam_ops_sid` 쿠키 분리, `HttpOnly; Secure; SameSite=Lax`, 유휴 30분, `created_at < password_changed_at`이면 무효 — `api/src/auth/session.ts` · 담당 B · 스킬 AUTH · 근거 R-08, FR-32
- [ ] T023 가드를 만든다: `requireGuardian`(가족 ID는 세션에서만, 다른 가족은 404), `requireStaff(role)`(G1), 외부 키는 app-api에서 거부 — `api/src/auth/guards.ts` · 담당 B · 스킬 AUTH · 근거 G0, G1, BR-ACC-01~05, BR-API-06
- [ ] T024 앱 부트스트랩을 만든다: 라우터 마운트, `/live`, 시험 모드 `express-openapi-validator` 응답 검증 — `api/src/app.ts` · `api/src/server.ts` · 담당 B · 스킬 API · 근거 FR-12, R-19
- [ ] T025 [P] 저장소 포트와 로컬 드라이버를 만든다: `put/get/delete/exists/listByPrefix`, `family/`·`tmp/`·`ext/` 분리, 원본 `O_EXCL`+0440 — `api/src/storage/StoragePort.ts` · `api/src/storage/LocalFsDriver.ts` · 담당 B · 스킬 API · 근거 R-06, BR-INT-04
- [ ] T026 [P] 파일 읽기 토큰을 만든다: 짧게 유효한 서명 토큰 `GET /v1/files/{token}` → `X-Accel-Redirect`, 가족 확인 뒤에만 발급, 로그에 객체 키 없음 — `api/src/modules/files/` · 담당 B · 스킬 API, AUTH · 근거 SD_03 §17

### 서빙 공통 (A)

- [ ] T027 [P] Python DB·저장소 공통을 만든다(앱 API와 같은 경로 규칙) — `serving/common/db.py` · `serving/common/storage.py` · 담당 A · 스킬 API · 근거 R-06
- [ ] T028 [P] structlog 허용 목록 로거를 만든다 — `serving/common/logging.py` · 담당 A · 스킬 — · 근거 BR-PRV-01, stage-job §10
- [ ] T029 어댑터 기반과 가짜 어댑터를 만든다: `AdapterResult`(outcome 8종), `FakeAdapter`(`UAM_FAKE_MODELS=1`, `stage=outcome` 쌍으로 장애 주입) — `serving/adapters/base.py` · `serving/adapters/fake.py` · 담당 A · 스킬 — · 근거 stage-job §4.1, R-19
- [ ] T030 워커 실행기를 만든다: `SELECT … FOR UPDATE SKIP LOCKED`(serving_group·status·available_at·priority), 점유 60초·heartbeat 20초, 활성 버전 기록, 취소 감지, **결과 쓰기 직전 `deleting` 재확인**, 임시 파일 정리 — `serving/workers/runner.py` · 담당 A · 스킬 — · 근거 stage-job §3, G19, BR-PRC-05·08
- [ ] T031 응답 분류 기록을 만든다: outcome → `stage_job.status`·`error_class`·`downgrade_cause` 1:1, 인프라 재시도 10초·60초, 소진 D1(판정 → `exhausted`, 결과 단계 → `failed`+`not_delivered`) — `serving/workers/outcome.py` · 담당 A · 스킬 — · 근거 stage-job §4, BR-API-02, BR-PRC-03, G7, G9
- [ ] T032 [P] 상한 설정 파일을 둔다: 시간 상한(움직임 렌더 600초만 원천, 나머지 `[추론]`)·동시 처리·GPU 유무, 품질 임계값은 U5 전 "명백한 실패"만 — `serving/config/limits.yaml` · `serving/config/thresholds.yaml` · 담당 A · 스킬 — · 근거 stage-job §8, U5, U6
- [ ] T033 sweeper 골격을 만든다: 점유 만료 이어받기(`deleting` 작품은 `cancelled`), 비정상 종료 임시 파일 정리(0.12) — `serving/workers/sweeper.py` · 담당 B · 스킬 — · 근거 BR-PRC-05, BR-PRC-08, stage-job §3
- [ ] T034 단계 작업 계약 시험을 가짜 어댑터로 만든다: 점유·이어받기·분류 8종·소진·취소·쓰기 직전 재확인 — `serving/tests/test_stage_job_contract.py` · 담당 A · 스킬 — · 근거 stage-job 전 항목

### 웹 공통 (C)

- [ ] T035 [P] 화면 문구를 한 파일에 모은다(SD_02 문구 기준, 스타일가이드와 다르면 SD_02 우선) — `web/src/copy/ko.ts` · 담당 C · 스킬 FD · 근거 U10, R-20
- [ ] T036 [P] API 클라이언트를 만든다: `openapi-typescript` 생성 타입, Problem Details → `BlockNotice` 모델 변환, 401 → 로그인 이동 — `web/src/api/client.ts` · `web/src/api/types.gen.ts` · 담당 C · 스킬 FD · 근거 R-10, G0
- [ ] T037 [P] 폴링 컴포저블을 만든다: 3→6→10초, 전이 중 상태만, `visibilitychange`에서 멈춤 — `web/src/composables/usePolling.ts` · 담당 C · 스킬 FD · 근거 R-12
- [ ] T038 [P] 공통 컴포넌트 C1·C2·C3를 만든다: `JourneyRail`(기본·막힘·대기·전시 보류·종결), `BlockNotice`(차단·보류·종결, 사유·해제 주체·다음 행동 필수), `ReasonButton`(`aria-disabled`+사유, hover·포커스 같은 문구) — `web/src/components/JourneyRail.vue` · `BlockNotice.vue` · `ReasonButton.vue` · 담당 C · 스킬 FD · 근거 SD_02 §3, UX6, G 사상 규칙 1·2
- [ ] T039 [P] 공통 컴포넌트 C4·C9를 만든다: `StatusBadge`, `RoleHeader`(보호자/팀원 셸, 계정 가림) — `web/src/components/StatusBadge.vue` · `RoleHeader.vue` · 담당 C · 스킬 FD · 근거 SD_02 §3-4, UX8
- [ ] T040 라우터와 레이아웃을 만든다: `/app/*`(보호자)·`/ops/*`(팀원) 분리, 역할 가드, 보호자↔운영 링크 없음, 모바일 390px 우선·1440px — `web/src/router/index.ts` · `web/src/layouts/AppLayout.vue` · `OpsLayout.vue` · 담당 C · 스킬 RL · 근거 SD_02 §2, R-11, UX8

**Checkpoint**: `npm run db:migrate` 두 번 성공·위반 거부 시험 통과, `/live` 200, 가짜 어댑터로 단계 작업 계약 시험 통과, 웹 셸이 열린다. 이제 스토리를 병렬로 시작할 수 있다.

---

## Phase 3+: User Stories (우선순위 순)

### User Story 1 — 보호자 가입·로그인·로그인 정보 찾기·아이 등록 (P0 · High)

**목표**: 보호자가 이메일로 가입해 확인 메일로 가족 공간을 열고, 로그인해 아이를 별칭으로 등록한다. 잊으면 이메일로 로그인 정보를 찾는다.
**독립 검증 기준**: Mailpit에서 확인 링크로 가입 완료 → 로그인 → 같은 별칭 아이 2명 등록(둘 다 저장, 안내만) → 로그아웃 → 찾기 메일의 재설정 링크로 비밀번호 변경 → 이전 세션이 끊긴다. 가입된 이메일로 다시 가입해도 응답은 같은 202다.

#### 시험

- [ ] T041 [P] [US1] 인증 엔드포인트 7개 계약 시험: signup·verify/resend·recovery 항상 202, verify·reset 성공 204·실패 400 `token_invalid`, login 204·401·403 `email_unverified`, logout — `api/tests/auth.contract.test.ts` · 담당 B · 스킬 AUTH · 근거 FR-31, FR-32, D18
- [ ] T042 [P] [US1] 가입 규칙 시험: 대소문자 무시 유일, 동시 가입 1건, 계정·가족 원자 저장(G26), 요청 한도(이메일 10분 3회·IP 1시간 20회), 재설정 뒤 모든 세션 무효, 로그에 이메일·토큰 원문 0 — `api/tests/auth.rules.test.ts` · 담당 B · 스킬 AUTH · 근거 G26, G27, BR-ACC-06~08, BR-PRV-01
- [ ] T043 [P] [US1] 아이 등록 시험: 별칭 빈 값 거부(G4), 같은 별칭 저장 + 안내 플래그(UC1 A5), 다른 가족 아이 404, 로그에 별칭 없음 — `api/tests/children.test.ts` · 담당 B · 스킬 API · 근거 FR-1, G0, G4, BR-CHD-01
- [ ] T044 [P] [US1] 가입→확인→로그인→아이 등록 E2E(390·1440px) — `web/e2e/us1-signup-child.spec.ts` · 담당 C · 스킬 FD · 근거 S0, S1

#### 구현

- [ ] T045 [P] [US1] 메일 발송을 만든다: nodemailer + Mailpit(P0), 확인·재설정·"이미 가입" 안내 3종, 가족 정보 없음 — `api/src/lib/mailer.ts` · `api/src/mail/templates/*.ts` · 담당 B · 스킬 AUTH · 근거 FR-31, FR-32, U19
- [ ] T046 [US1] 가입·확인·재발송을 만든다: `family`+`guardian_account`+`auth_email_token(verify)` 한 트랜잭션(G26), 기존 이메일이면 안내 메일만·같은 202, 토큰 해시·1회용·만료 — `api/src/modules/auth/signup.ts` · 담당 B · 스킬 AUTH · 근거 FR-31, data-model §4 가입·이메일 확인
- [ ] T047 [US1] 로그인·로그아웃을 만든다: argon2id, 확인 전 403 `email_unverified`, 세션 재생성 — `api/src/modules/auth/login.ts` · 담당 B · 스킬 AUTH · 근거 FR-31, R-08
- [ ] T048 [US1] 로그인 정보 찾기·재설정을 만든다: 가입 여부 비노출, 이전 토큰 `revoked_at`, `password_changed_at` 갱신 + 세션 전부 삭제, 확인 전 계정은 확인 메일 재발송 — `api/src/modules/auth/recovery.ts` · 담당 B · 스킬 AUTH · 근거 FR-32, G27
- [ ] T049 [US1] 인증 요청 한도를 만든다(`auth_rate_event`, 이메일·IP HMAC) — `api/src/modules/auth/rateLimit.ts` · 담당 B · 스킬 AUTH · 근거 FR-31, data-model §6 S7
- [ ] T050 [US1] 팀원 로그인을 만든다(`POST /v1/ops/auth/login`, `uam_ops_sid`) — `api/src/modules/auth/opsLogin.ts` · 담당 B · 스킬 AUTH · 근거 INC2, G1
- [ ] T051 [US1] 아이 API를 만든다: `GET/POST /v1/children`, `PATCH /v1/children/{id}`, 중복 검사 없음·같은 별칭 안내, 작품 수는 `v_child_artwork_count` — `api/src/modules/children/` · 담당 B · 스킬 API · 근거 FR-1, UC1 A1·A5, D18
- [ ] T052 [P] [US1] S0 가입·확인 화면을 만든다(이메일·비밀번호·확인만, 응답은 항상 같은 안내) — `web/src/app/views/SignupView.vue` · `VerifyView.vue` · 담당 C · 스킬 FD, RL · 근거 S0, FR-31
- [ ] T053 [P] [US1] 로그인·S0b 찾기·재설정 화면을 만든다 — `web/src/app/views/LoginView.vue` · `RecoveryView.vue` · `ResetView.vue` · 담당 C · 스킬 FD, RL · 근거 S0b, FR-32
- [ ] T054 [P] [US1] S1 아이 관리 화면을 만든다(별칭만, 실명·생년월일 칸 없음, 같은 별칭 안내, G4 차단 블록) — `web/src/app/views/ChildrenView.vue` · 담당 C · 스킬 FD, RL · 근거 S1, UX6
- [ ] T055 [P] [US1] 팀원 로그인 화면을 만든다 — `web/src/ops/views/OpsLoginView.vue` · 담당 C · 스킬 FD · 근거 G1

**Checkpoint**: US1 독립 검증 기준 통과.

### User Story 2 — 작품 접수와 판정 제안 확정 (P0 · High · MVP 핵심)

**목표**: 보호자가 사진을 올리면 내구 접수(202) 뒤 분리·판정 제안이 오고, 선택지 셋 중 하나를 확정한다. 제안이 늦거나 없어도 바로 확정할 수 있다.
**독립 검증 기준**(가짜 모델): 올리기 → 202 → 목록에 "판정 중" → 제안 도착 → 제안과 다르게 확정 → 수정 여부 기록·"처리 중". 저장 실패 주입 시 목록에 작품 없음. 판정 소진 주입 시 제안 없이 직접 확정.

#### 시험

- [ ] T056 [P] [US2] 접수 계약 시험: `POST /v1/artworks` 202·멱등(같은 요청 번호 1건), 형식 400·용량 413·판독 불가 400(G5), 원본·기록 저장 실패 시 흔적 0(G6) — `api/tests/intake.test.ts` · 담당 B · 스킬 API · 근거 FR-2, Scenario 9, BR-INT-01~03
- [ ] T057 [P] [US2] 확정 시험: 제안과 다른 확정 허용·`is_modified`, 제안 전 확정 `before`, 소진 `none`(G7), 이미 확정·삭제 중 409(G8), 노출 꺼진 `sculpture` 거부(G17), 응답에 점수 필드 없음 — `api/tests/confirm.test.ts` · 담당 B · 스킬 API · 근거 FR-3, FR-21, Scenario 3, D14
- [ ] T058 [P] [US2] 분리·판정 워커 시험(가짜): split 성공·품질 미달(액자 권장)·소진, judge 제안 규칙(점수 단독 금지, 집 그림 0.946 사례) — `serving/tests/test_split_judge.py` · 담당 A · 스킬 — · 근거 Scenario 2, stage-job §5.1, BR-SUG-04
- [ ] T059 [P] [US2] 올리기→확정 E2E: 선택지 즉시 표시·기본 선택 없음, "나중에 고르기" — `web/e2e/us2-intake-confirm.spec.ts` · 담당 C · 스킬 FD · 근거 S2, S3, U10 clarify

#### 구현

- [ ] T060 [US2] 사진 검사를 만든다: 매직 바이트 → JPEG·PNG는 `sharp`, HEIC는 `heic-decode` 판독, 20MB, 변환 없음 — `api/src/modules/artworks/validateUpload.ts` · 담당 B · 스킬 API · 근거 R-13, G5
- [ ] T061 [US2] 내구 접수를 만든다: tmp 쓰기+fsync → 트랜잭션(`artwork`+`stored_object(original)`+`artwork_original`+`stage_job(split)`+`stage_job(judge, available_at=먼 미래)`) → rename → 202, 실패 보상 삭제 — `api/src/modules/artworks/intake.ts` · 담당 B · 스킬 API, DB · 근거 R-14, data-model §4 접수, G6
- [ ] T062 [US2] 작품 상세를 만든다: `GET /v1/artworks/{id}`(상태·컷아웃 토큰·제안 코드·`suggestion_state`·단계 진행, 점수 없음, 다른 가족 404) — `api/src/modules/artworks/detail.ts` · 담당 B · 스킬 API · 근거 FR-4, BR-SUG-02
- [ ] T063 [US2] 확정을 만든다: `FOR UPDATE` → `artwork_outcome` INSERT → 경로별 `stage_job`(animate_render·depth_relief·frame_compose) → `processing`, 분리 실패+relief는 frame_compose — `api/src/modules/artworks/confirm.ts` · 담당 B · 스킬 API · 근거 data-model §4 확정, G8, G17, BR-PRC-01
- [ ] T064 [US2] split 단계를 만든다: M1 마스크·컷아웃 저장, `judgment.split_ok`, 성공·낮춤·소진 모두 judge를 연다 — `serving/workers/stages/split.py` · 담당 A · 스킬 — · 근거 stage-job §2, FR-20
- [ ] T065 [US2] judge 단계를 만든다: M2 종류·태그 → M3 관절 → M4 기하 규칙 → 제안 규칙, `tag_candidate`, `awaiting_confirm`, 소진 `exhausted` — `serving/workers/stages/judge.py` · `serving/rules/m4_geometry.py` · 담당 A · 스킬 — · 근거 stage-job §5.1, FR-21, G7
- [ ] T066 [P] [US2] S2 작품 올리기 화면을 만든다(아이 선택·사진·G5 차단 블록·"닫아도 계속돼요") — `web/src/app/views/UploadView.vue` · 담당 C · 스킬 FD, RL · 근거 S2
- [ ] T067 [P] [US2] S3 판정 제안 확정 화면을 만든다: 선택지 셋 같은 무게·기본 선택 없음, 제안은 도착하면 문구로, G7 차단 블록, 3D는 노출 설정 뒤만, 폴링 — `web/src/app/views/ConfirmView.vue` · 담당 C · 스킬 FD, RL · 근거 S3, UX2, U10 clarify

#### 실제 모델 (A — 가짜 흐름과 병행, 스토리 완료에는 가짜로 충분)

- [ ] T068 [P] [US2] 팀 서버 자원·GPU를 확인하고 기록한다(U2·U14) — `docs/A/A_팀서버_자원확인.md` · 담당 A · 스킬 — · 근거 plan 단계 3
- [ ] T069 [P] [US2] 모델 라이선스 확정 기록을 만든다(OpenCLIP 가중치 A2, Qwen3, TRELLIS 제외, AGPL 예비 모델) — `docs/A/A_모델_라이선스_확정.md` · 담당 A · 스킬 — · 근거 U4, BR-MDL-07, D17
- [ ] T070 [US2] M1 BiRefNet·M2 OpenCLIP을 재현하고 시간·메모리·SHA-256을 기록한다 — `docs/A/A_모델재현기록.md` · `models/manifest.yaml` · 담당 A · 스킬 — · 근거 FR-16, R-22
- [ ] T071 [US2] M1·M2 실제 어댑터를 만든다 — `serving/adapters/m1_birefnet.py` · `serving/adapters/m2_openclip.py` · 담당 A · 스킬 — · 근거 BR-MDL-02
- [ ] T072 [US2] M3 관절 추출(렌더 없이)과 M4 규칙 실제 어댑터를 만든다 — `serving/adapters/m3_joints.py` · `serving/rules/m4_geometry.py` · 담당 A · 스킬 — · 근거 FR-21

**Checkpoint**: US2 독립 검증 기준 통과(가짜 모델). US1과 함께 "가입 → 올리기 → 확정"이 이어진다.

### User Story 3 — 결과 생성·낮춤 체인·진행 확인 (P0 · High · MVP 핵심)

**목표**: 확정값대로 움직임·2.5D·액자를 만들고, 품질 미달은 한 단계 낮추고, 인프라 장애는 3회 재시도 뒤 "처리하지 못함"으로 알린다. 보호자는 목록에서 단계별 진행과 낮춤 사실을 본다.
**독립 검증 기준**(가짜 모델 장애 주입): 움직임 품질 미달 → 2.5D 등록·재시도 0, 분리 실패 → 2.5D 건너뛰고 액자, 엔진 다운 3회 → `failed`·`not_delivered`·`model_downgrade` 아님, M3 정지 중에도 액자 경로 확인 대기 도달.

#### 시험

- [ ] T073 [P] [US3] 낮춤 체인·재시도 장애 주입 시험: 5종 오류 × 결과 단계, 인프라가 낮춤으로 집계 0건 — `serving/tests/test_downgrade_chain.py` · 담당 A · 스킬 — · 근거 Scenario 4·5·6·7, FR-5, FR-23, BR-FBK-04
- [ ] T074 [P] [US3] 목록·진행 API 시험: 가족 작품만, `display_status`, 단계 진행에 점수·객체 키 없음 — `api/tests/progress.test.ts` · 담당 B · 스킬 API · 근거 FR-4, UC3
- [ ] T075 [P] [US3] 진행 확인 E2E(대기·다시 시도 중·낮춤 안내·처리하지 못함 블록) — `web/e2e/us3-progress.spec.ts` · 담당 C · 스킬 FD · 근거 S4

#### 구현

- [ ] T076 [US3] 결과 단계 핸들러를 만든다: `animate_render`(M3, 600초), `depth_relief`(M1 마스크+M5, GPU 없으면 cpu_vision), `frame_compose`(모델 없음·원본 참조) — `serving/workers/stages/results.py` · 담당 A · 스킬 — · 근거 stage-job §2, FR-5, FR-22, BR-SRV-02
- [ ] T077 [US3] 낮춤 체인과 결과 기록을 만든다: 움직임→2.5D→액자, 마스크 없으면 액자, `result`(종류당 처음 1건), `artwork_outcome.result_kind`·`result_cause`, `awaiting_review` — `serving/workers/chain.py` · 담당 A · 스킬 — · 근거 stage-job §6, data-model §4 결과 저장·낮춤, BR-APR-03
- [ ] T078 [US3] 작품 목록 API를 만든다: `GET /v1/artworks`(`v_artwork_display`, 현재 단계, 삭제 중 제외) — `api/src/modules/artworks/list.ts` · 담당 B · 스킬 API · 근거 FR-4, D13
- [ ] T079 [P] [US3] C6 낮춤 안내 컴포넌트를 만든다(S4·S5 전용) — `web/src/components/DowngradeNote.vue` · 담당 C · 스킬 FD · 근거 UX3, BR-EXH-07
- [ ] T080 [US3] S4 작품 목록·진행 상세 화면을 만든다(진입 홈, 상태 배지, 단계별 진행, G9 블록, 폴링) — `web/src/app/views/ArtworksView.vue` · 담당 C · 스킬 FD, RL · 근거 S4, UX7

#### 실제 모델 (A)

- [ ] T081 [US3] M3 Animated Drawings를 Docker 없이 재현한다: 별도 venv + TorchServe 네이티브 127.0.0.1, 헤드리스 렌더, 체크섬 — `docs/A/A_모델재현기록.md` · `ops/torchserve/config.properties` · 담당 A · 스킬 — · 근거 R-03, BR-MDL-06, plan 위험 1
- [ ] T082 [US3] M5 Depth Anything V2 Small을 재현하고 CPU/GPU 시간을 잰다 — `docs/A/A_모델재현기록.md` · `models/manifest.yaml` · 담당 A · 스킬 — · 근거 FR-22, U2, U6
- [ ] T083 [US3] M3 렌더·M5 깊이 실제 어댑터를 만든다(MP4 H.264, 깊이 PNG16) — `serving/adapters/m3_render.py` · `serving/adapters/m5_depth.py` · 담당 A · 스킬 — · 근거 R-07

**Checkpoint**: US3 독립 검증 기준 통과.

### User Story 4 — 결과 확인·이야기·가족 전시 (P0 · High · MVP 핵심)

**목표**: 보호자가 원본과 결과를 나란히 보고 좋아요·낮춘 결과로 걸기·액자로 걸기·다시 찍기 중 하나를 고르고, 이야기를 적으면 가족 전시에 걸린다.
**독립 검증 기준**: 좋아요 + 필수 이야기 → 전시 중, 승인 전·이야기 빠짐이면 전시에 없음, 낮춘 결과로 걸기 → 2.5D 생성 뒤 2회차 확인, 다시 찍기 → 새 접수 + 이전 작품 삭제, 다른 가족 주소 직접 입력 404.

#### 시험

- [ ] T084 [P] [US4] 결정 시험: 회차당 1건(중복은 첫 결정 반환), 처리하지 못함은 액자·다시 찍기만(G9), use_lower → depth_relief·`processing`, retake → `deleting`+`deletion_request(retake)`, 원인 분류(D2·D14) — `api/tests/decision.test.ts` · 담당 B · 스킬 API · 근거 FR-6, Scenario 8·10, BR-APR-02~06
- [ ] T085 [P] [US4] 이야기·전시 시험: 미래 제작일·연령 범위 거부(G11), 전시 중 필수 비우기 거부, 전시는 `v_exhibit_gate`만, 낮춤 원인 비노출, 3D는 노출 꺼지면 액자 — `api/tests/story-gallery.test.ts` · 담당 B · 스킬 API · 근거 FR-7, FR-8, Scenario 1·13, G12, BR-EXH-07
- [ ] T086 [P] [US4] 가족 교차 접근 시험: 목록·상세·파일 토큰·직접 주소 모두 0건 노출 — `api/tests/cross-family.test.ts` · 담당 B · 스킬 AUTH · 근거 Scenario 12, FR-9, G0
- [ ] T087 [P] [US4] 확인→이야기→전시 E2E: 자동 재생 없음, 원본 보기, 점수·토스트 없음 — `web/e2e/us4-review-story-gallery.spec.ts` · 담당 C · 스킬 FD · 근거 S5, S6, S8

#### 구현

- [ ] T088 [US4] 선택지 규칙 함수를 한 곳에 만든다(결과 종류·M1 마스크·상태 G9·G10) — `api/src/modules/artworks/decisionOptions.ts` · 담당 B · 스킬 API · 근거 SD_03 §2-3, BR-APR-02
- [ ] T089 [US4] 결정 API를 만든다: `POST /v1/artworks/{id}/decision` 트랜잭션(data-model §4 결정), H6·H7·H8 — `api/src/modules/artworks/decision.ts` · 담당 B · 스킬 API · 근거 FR-6, G3, G10
- [ ] T090 [US4] 이야기 API를 만든다: `PUT /v1/artworks/{id}/story` UPSERT, 트리거 거절 → 422 — `api/src/modules/artworks/story.ts` · 담당 B · 스킬 API · 근거 FR-7, G11
- [ ] T091 [US4] 전시 API를 만든다: `GET /v1/gallery?child=`(`v_gallery`, 연령 묶음 → 제작일, 제목·제작일 찾기) — `api/src/modules/gallery/` · 담당 B · 스킬 API · 근거 FR-8, BR-EXH-02
- [ ] T092 [P] [US4] C5 원본-결과 비교를 만든다(정지 우선, 재생·시차 토글, WebGL 시차, 형식 표시 불가 시 원본) — `web/src/components/SideBySide.vue` · `web/src/components/ParallaxRelief.vue` · 담당 C · 스킬 FD · 근거 UX4, R-07
- [ ] T093 [P] [US4] C7 이야기 카드·C8 전시 조건 체크를 만든다(한마디와 AI 작성 칸 분리) — `web/src/components/StoryCard.vue` · `ExhibitCheck.vue` · 담당 C · 스킬 FD · 근거 UX5, UX1
- [ ] T094 [US4] S5 결과 확인 화면을 만든다(선택지는 API가 준 것만, G9·G10 차단 블록, 다시 찍기 확인 창) — `web/src/app/views/ReviewView.vue` · 담당 C · 스킬 FD, RL · 근거 S5
- [ ] T095 [US4] S6 이야기 쓰기 화면을 만든다(부분 저장, G11 차단, P0에서는 설명 확장점 숨김) — `web/src/app/views/StoryView.vue` · 담당 C · 스킬 FD, RL · 근거 S6
- [ ] T096 [US4] S8 가족 전시 화면을 만든다(아이별·연령 묶음, 동등 크기, 자동 넘김 없음) — `web/src/app/views/GalleryView.vue` · 담당 C · 스킬 FD, RL · 근거 S8, BR-EXH-03·04

**Checkpoint**: US1~US4로 "가입 → 올리기 → 확정 → 결과 → 이야기 → 전시"가 가짜 모델로 끝까지 돈다(**MVP**).

### User Story 5 — 작품·아이 삭제와 실행 중 취소 (P0 · High)

**목표**: 보호자가 작품이나 아이를 지우면 즉시 목록에서 빠지고, 실행 중 작업을 멈춘 뒤 파일과 기록을 지워 집계 필드만 남긴다. 끝내 안 지워진 건은 운영자가 끝낸다.
**독립 검증 기준**: 처리 중 삭제 → 목록에서 즉시 제외 → 서빙 3종 멈춤 → 파일 0·설명 0·작품 연결 없는 집계 필드만 → `completed`. 아이 삭제는 작품 모두 지운 뒤 별칭 삭제.

- [ ] T097 [P] [US5] 삭제 완전성 시험: 서빙 3종 각각 처리 중 삭제, 남은 파일·설명·연결 0, 늦게 온 결과 폐기, 끝난 삭제에 연결 없음 — `api/tests/deletion.test.ts` · `serving/tests/test_cancel.py` · 담당 B · 스킬 API · 근거 FR-10, Scenario 11, G18, G19
- [ ] T098 [US5] 삭제 요청 API를 만든다: `DELETE /v1/artworks/{id}`·`/v1/children/{id}`, `deleting`+취소 플래그+`deletion_request` → 202 — `api/src/modules/deletion/request.ts` · 담당 B · 스킬 API · 근거 data-model §4 삭제 요청, BR-ACC-04
- [ ] T099 [US5] sweeper 삭제 완료를 만든다: `v_deletion_hold` 비면 파일 삭제 → `stored_object` → `artwork`(CASCADE·SET NULL) → `completed`, 실패 재시도 → `incomplete`, `gate_event` G19 해제 — `serving/workers/sweeper.py` · 담당 B · 스킬 DB · 근거 data-model §4 삭제 완료, BR-DEL-01~03
- [ ] T100 [US5] 삭제 미완료 처리 운영 도구를 만든다(건 번호만, 이미지 없음, 원인 해결 뒤 다시 삭제) — `api/scripts/ops/purge-retry.ts` · 담당 B · 스킬 — · 근거 spec clarify 2026-09-28(삭제 미완료), BR-ACC-03
- [ ] T101 [US5] S9 삭제 확인·진행 대화상자를 만든다(지워지는 항목, G19 보류 블록, 잠긴 조작) — `web/src/app/components/DeleteDialog.vue` · 담당 C · 스킬 FD · 근거 S9

**Checkpoint**: US5 독립 검증 기준 통과.

### User Story 6 — 공동 보호자 초대·해제·나가기 (P0 · High)

**목표**: 가족 공간을 만든 보호자가 다른 보호자를 초대하고, 수락한 계정은 같은 권한으로 관리한다. 해제는 만든 보호자만, 공동 보호자는 스스로 나간다(넷플릭스 계정 공유 방식).
**독립 검증 기준**: 초대 → 수락 → 공동 보호자가 작품 확정·삭제 가능 → 공동 보호자는 다른 보호자 해제 불가 → 만든 보호자가 해제 → 해제된 계정은 즉시 404, 올린 작품은 남음.
**선행**: 요구사항은 spec FR-9에 넷플릭스 계정 공유 기준으로 확정됐다. 유스케이스·화면·DB·계약에는 아직 반영되지 않았으므로 T102~T104를 먼저 끝낸다.

- [ ] T102 [US6] 공동 보호자 흐름을 유스케이스로 쓴다(넷플릭스 계정 공유 벤치마킹, spec FR-9에 확정): 이메일 초대 링크(1회용·예시 7일·수락 전 취소) → 초대받은 사람이 자기 이메일 계정으로 수락 → 같은 권한, 해제는 만든 보호자만, 공동 보호자는 나가기만, 만든 보호자는 나갈 수 없음(소유권 이전 없음), 공동 보호자 상한(예시 2명), 한 계정 한 가족, 이야기 동시 수정 충돌 안내 — `design/UC_15_공동보호자.md` · `design/UC_00_개요_우리아이미술관.md` · 담당 C · 스킬 — · 근거 FR-9, U1 clarify
- [ ] T103 [US6] SD_01·SD_02를 보강한다: 프로세스·게이트(초대 유효·해제 권한), 화면 "가족 구성원" — `design/SD_01_프로세스설계서_우리아이미술관.md` · `design/SD_02_UIUX설계서_우리아이미술관.md` · 담당 C · 스킬 — · 근거 T102
- [ ] T104 [US6] SD_03과 마이그레이션을 보강한다: `guardian_account.family_id` UNIQUE 해제 + `family_role`(owner/co, 가족당 owner 1명), `family_invite`(초대 이메일 해시·토큰 해시·만료·취소·수락), 공동 보호자 상한은 설정값, 해제 권한 트리거, `story` 낙관적 잠금용 `updated_at` 비교 — `design/uri_gallery_ddl.sql` · `db/migrations/0102_co_guardian.sql` · 담당 B · 스킬 DB · 근거 T102, data-model §6
- [ ] T105 [US6] 계약을 보강하고 시험을 쓴다: 초대·수락·구성원 목록·해제(owner만 403)·나가기 — `contracts/openapi.yaml` · `api/tests/co-guardian.test.ts` · 담당 B · 스킬 API, AUTH · 근거 FR-9
- [ ] T106 [US6] 공동 보호자 API를 만든다(해제 즉시 해당 계정 세션 무효) — `api/src/modules/family/` · 담당 B · 스킬 AUTH · 근거 FR-9
- [ ] T107 [US6] 가족 구성원 화면을 만든다(초대·수락·해제·나가기, 권한 없으면 이유 달린 비활성) — `web/src/app/views/FamilyView.vue` · `InviteAcceptView.vue` · 담당 C · 스킬 FD, RL · 근거 FR-9, UX6

**Checkpoint**: US6 독립 검증 기준 통과.

### User Story 7 — 서비스 상태와 모델별 지표 (P0 · Medium)

**목표**: 운영자가 생존·모델별 준비와 원인별·모델별 지표를 가족 이미지 없이 본다.
**독립 검증 기준**: 장애 주입 뒤 지표에서 인프라 실패와 모델 낮춤이 따로 집계되고, 미도달 목록에 작품 번호·이미지가 없으며, 운영자 외 역할은 403.

- [ ] T108 [P] [US7] 지표·준비 시험: 원인 5분류 분리, 라벨·응답에 식별 정보 0, `/ready` 모델별(미준비·비활성·CPU 실행·비노출 구분) — `api/tests/ops.test.ts` · 담당 B · 스킬 API · 근거 FR-12, FR-13, FR-26, Scenario 14, BR-OPS-04
- [ ] T109 [US7] model-api 내부 준비 확인을 만든다(`GET /internal/ready`, 모델별 활성 버전·장치) — `serving/model_api/internal.py` · 담당 A · 스킬 API · 근거 FR-12
- [ ] T110 [US7] 운영 API를 만든다: `/ready`(DB·저장소·model-api), `/metrics`(prom-client, 뷰 기반, p95는 여기서만), `/v1/admin/metrics`, `/v1/admin/unreached` — `api/src/modules/ops/` · 담당 B · 스킬 API · 근거 R-17, SD_03 §2-3
- [ ] T111 [P] [US7] C10 모델 상태 칩을 만든다 — `web/src/components/ModelStatusChip.vue` · 담당 C · 스킬 FD · 근거 SD_02 §3-4
- [ ] T112 [US7] S10 운영 화면을 만든다(생존·준비 요약 행, 지표, 원인 5분류, 미도달 추적) — `web/src/ops/views/OpsStatusView.vue` · 담당 C · 스킬 FD, RL · 근거 S10

**Checkpoint**: US7 독립 검증 기준 통과.

### User Story 8 — 모델 평가·승격·롤백·비활성 (P0 · Medium)

**목표**: 평가 담당이 팀원 제작 평가 묶음으로 후보 버전을 전부 다시 평가하고, 통과한 것만 승격한다. 문제가 생기면 롤백하고, 첫 버전이면 비활성화한다.
**독립 검증 기준**: 평가 미완료가 있으면 승격 버튼 비활성, 통과 뒤 승격 → 새 작업부터 새 버전, 롤백 즉시, 첫 버전 비활성 → 그 모델이 필요한 선택지가 확정 화면에서 비활성·대기 작업은 `model_not_ready`.

- [ ] T113 [P] [US8] 평가·승격 시험: 해시 불일치·격리 미충족 거부(G21), 미완료·라이선스·계약 불일치 승격 거부(G22), 가족 사진 평가 항목 거부(G20), 비활성화 뒤 선택지 비활성·낮춤으로 우회 0건 — `api/tests/models-admin.test.ts` · 담당 B · 스킬 API · 근거 FR-24, Scenario 15, spec clarify(첫 버전 비활성화)
- [ ] T114 [US8] 매니페스트 동기화 CLI를 만든다(`models/manifest.yaml` → `model_version` 후보) — `api/scripts/ops/manifest-sync.ts` · 담당 B · 스킬 DB · 근거 R-16
- [ ] T115 [US8] 관리 API를 만든다: 모델 목록·버전·평가 요청(`stage_job origin=eval`, priority 50)·평가 결과·승격·롤백·**비활성화**·평가 항목 등록 — `api/src/modules/admin/models.ts` · `api/src/modules/admin/evalItems.ts` · 담당 B · 스킬 API · 근거 contracts `/v1/admin/*`, BR-MDL-03·04·07
- [ ] T116 [US8] 확정 화면·확정 API가 비활성 모델의 선택지를 이유와 함께 막도록 연결한다(판정 모델 비활성이면 제안 없이 직접 확정) — `api/src/modules/artworks/confirm.ts` · `web/src/app/views/ConfirmView.vue` · 담당 B·C · 스킬 API, FD · 근거 spec clarify(첫 버전 비활성화), BR-FBK-04
- [ ] T117 [US8] 평가 실행기를 만든다(같은 어댑터로 항목별 결과·시간·메모리, 인프라 소진은 평가 미완료) — `eval/runner.py` · `serving/workers/stages/eval.py` · 담당 A · 스킬 — · 근거 UC9 BF4, FR-17
- [ ] T118 [P] [US8] 평가 묶음을 만든다(팀원 제작: 사람·비인물·촬영 조건·입체·설명 입력, 기대 경로) — `eval/items/manifest.yaml` · 담당 A · 스킬 — · 근거 FR-17, BR-MDL-04
- [ ] T119 [US8] S11 모델 평가·승격 화면을 만든다(매니페스트 표, 진행, G22 차단, 롤백·비활성화) — `web/src/ops/views/ModelsView.vue` · 담당 C · 스킬 FD, RL · 근거 S11

**Checkpoint**: US8 독립 검증 기준 통과.

### User Story 9 — API활용 메뉴와 외부 모델 기능 호출 (P0 · Medium/Low)

**목표**: 팀원이 API활용 메뉴에서 엔드포인트·가이드라인·매뉴얼을 보고 평가 묶음 작품으로 시험 호출한다. 외부 클라이언트는 API 키로 `segment`·`classify`·`pose`(팀 내부 키만)·`relief`를 부른다.
**독립 검증 기준**: 키 없음 401·권한 403(팀 밖 키로 pose)·한도 429·크기 413·형식 422·비활성 503·3D 404, 결과 1회 수령 뒤 404, 외부 입력 잔존 0, 가족 경로 403.

- [ ] T120 [P] [US9] 외부 호출 계약 시험 — `serving/tests/test_model_api.py` · 담당 B · 스킬 API, AUTH · 근거 FR-28, Scenario 18, G2, G24, G25, D17
- [ ] T121 [US9] model-api 키 인증·한도를 만든다(`X-API-Key` SHA-256, internal/external, 분당 30·하루 1,000·동시 2 예시값 설정) — `serving/model_api/auth.py` · `serving/config/ext-limits.yaml` · 담당 B · 스킬 AUTH · 근거 R-09, U12
- [ ] T122 [US9] 외부 작업을 만든다: `POST /v1/models/{function}` → `external_job`(메타만, 입력은 `ext/`), 상태 조회, 결과 1회 수령 후 삭제, 만료 정리, 서빙군별 외부 동시 1건·낮은 우선순위 — `serving/model_api/models.py` · `serving/workers/external.py` · 담당 A·B · 스킬 API · 근거 D8, D17, H16
- [ ] T123 [US9] 키 발급 운영 CLI를 만든다(원문 1회 표시, 팀 밖 키는 U12 확정 전 발급 금지) — `api/scripts/ops/key.ts` · 담당 B · 스킬 AUTH · 근거 R-09, D17
- [ ] T124 [US9] API활용 API를 만든다: 명세 조회(`/openapi.json` 기반)·시험 호출(평가 묶음 작품만, G23) — `api/src/modules/apiGuide/` · 담당 B · 스킬 API · 근거 R-11, BR-API-07~09
- [ ] T125 [US9] S12 API활용 메뉴 화면을 만든다(탭 3개, 버전 대조 경고, 시험 호출·G23·G25 차단) — `web/src/ops/views/ApiGuideView.vue` · 담당 C · 스킬 FD, RL · 근거 S12

**Checkpoint**: US9 독립 검증 기준 통과.

### User Story 10 — 키워드 작품 설명 초안 (P0.5 · Medium)

**착수 조건**: P0 완료 + U3(과정 제공 LLM)·U11(규칙 검사)·U16(승인 설명 교체)·U12(약관) 확정. 그 전에는 착수하지 않는다(plan 단계 P0.5).
**목표**: 보호자가 키워드·태그로 설명 초안을 받아 고치고 승인한다. 걸린 초안은 저장하지 않고, LLM 장애는 보호자가 고른다.
**독립 검증 기준**: llm-contract.md 전 항목, Scenario 17, 입력에 이미지·별칭 없음, 규칙 검사 반복 실패 → 템플릿 낮춤, 승인 뒤 재생성 409.

- [ ] T126 [P] [US10] M6 Qwen3-4B를 Ollama로 재현하고 llm-server를 만든다(:8200, 동기) — `serving/llm_server/` · `docs/A/A_모델재현기록.md` · 담당 A · 스킬 API · 근거 R-18
- [ ] T127 [P] [US10] caption 패키지를 만든다(허용 입력 조립·규칙 검사·템플릿) + 시험 — `caption/` · `caption/tests/` · 담당 C · 스킬 — · 근거 llm-contract.md, BR-CAP-01·02·07
- [ ] T128 [US10] 설명 API를 만든다(`/captions`, 승인 고정, G13~G16) — `api/src/modules/captions/` · 담당 B · 스킬 API · 근거 FR-27
- [ ] T129 [US10] S7 설명 초안 패널을 만든다(보낼 입력 미리보기, AI 작성 표시, G15 선택지) — `web/src/app/views/CaptionPanel.vue` · 담당 C · 스킬 FD, RL · 근거 S7
- [ ] T130 [US10] 외부 `caption` 엔드포인트와 약관을 연다 — `serving/model_api/caption.py` · 담당 B · 스킬 API · 근거 FR-28, D17

### User Story 11 — 만들기 작품 3D 조각 (P1)

**착수 조건**: U2 팀 서버 GPU 확인 + U4 TRELLIS 제외 확인 + 노출 설정을 켜는 주체 결정(SD_01 §17 #3).
**독립 검증 기준**: Scenario 19, 노출 설정 꺼짐이면 3D 선택지·결과 비노출(액자로 표시), 평면 그림에 쓰지 않음.

- [ ] T131 [P] [US11] M7 TripoSR을 재현하고 어댑터를 만든다(GLB) — `serving/adapters/m7_triposr.py` · 담당 A · 스킬 — · 근거 FR-29
- [ ] T132 [US11] `sculpture` 단계·낮춤(3D→2.5D→액자)과 노출 설정 변경 경로를 만든다 — `serving/workers/stages/results.py` · `api/src/modules/admin/featureSetting.ts` · 담당 A·B · 스킬 API · 근거 D10, G17
- [ ] T133 [US11] 3D 회전 보기를 만든다(`<model-viewer>`, "뒷면은 AI가 추정했어요", 원본 함께) — `web/src/components/SculptureViewer.vue` · 담당 C · 스킬 FD · 근거 BR-EXH-06

---

## Final Phase: Polish & Cross-Cutting

- [ ] T134 옛 이름을 정리한다: quickstart·research의 `process_job`·`unprocessable`·`staff_account`·`session` 테이블 표기를 SD_03 이름(`artwork_outcome`·`failed`·`team_member`·`app_session`)으로 — `.specify/features/우리-아이-미술관/quickstart.md` · `research.md` · 담당 B · 스킬 — · 근거 data-model §1
- [ ] T135 SD_03에 구현 보완 S1~S8과 공동 보호자 변경을 역반영한다(DDL 검증 3종 재실행) — `design/uri_gallery_ddl.sql` · `design/SD_03_데이터베이스설계서_우리아이미술관.md` · 담당 B · 스킬 DB · 근거 data-model §6
- [ ] T136 통합 시험을 하고 기록한다: 장애 주입 5종 × 결과 단계(인프라→낮춤 집계 0), 삭제 완전성, 가족 교차 접근, 로그 표본(이미지·객체 키·자유 입력 0), 성능 1차(움직임 p95 3분·액자 p95 30초 잠정) — `docs/B/B_통합시험.md` · 담당 B · 스킬 — · 근거 spec Success Criteria, plan 단계 10
- [ ] T137 [P] 평가 묶음 1차 측정과 임계값 제안(U5)·시간 상한 교체(U6) — `docs/A_평가묶음_1차측정.md` · `serving/config/thresholds.yaml` · `serving/config/limits.yaml` · 담당 A · 스킬 — · 근거 FR-17, U5, U6
- [ ] T138 [P] 접근성·반응형 점검: 390px·1440px, 키보드만 조작, 비활성 버튼 사유 낭독, 대비 4.5:1, 움직임 줄이기, 점수·미리 선택·토스트 0 — `web/e2e/a11y.spec.ts` · 담당 C · 스킬 RL, FD · 근거 SD_02 §17
- [ ] T139 [P] 사용 관찰(팀원 보호자 역할, 실제 아동 제외)과 막힌 지점 기록 — `docs/C/C_사용관찰.md` · 담당 C · 스킬 — · 근거 FR-18, U13
- [ ] T140 팀 서버 배포 절차를 정리하고 한 번 올린다(ssh·git pull·npm ci·build·pm2 reload, nginx HTTPS) — `ops/DEPLOY.md` · 담당 B · 스킬 — · 근거 R-02, quickstart §7
- [ ] T141 추적성 표를 만든다: FR → UC → 작업(T) → 검증 증거 — `docs/공통/추적성.md` · 담당 B · 스킬 — · 근거 FR-19

---

## Dependencies

```
Phase 1 Setup (T001 D18 병합이 맨 앞)
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
        ├── US6 공동 보호자 (US1 이후 + T102~T104 설계 선행)
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
- **같은 파일을 여러 스토리가 고치는 곳**: `api/src/modules/artworks/confirm.ts`(T063 → T116), `web/src/app/views/ConfirmView.vue`(T067 → T116), `serving/workers/sweeper.py`(T033 → T099), `serving/workers/stages/results.py`(T076 → T132), `contracts/openapi.yaml`(T007 → T105). 순서대로 한다.

## Parallel Execution Examples

- **Phase 1**: T003 · T004 · T005 · T006 · T007 · T008 · T009 · T010 · T011을 A·B·C가 동시에(T001·T002 뒤).
- **Phase 2**: B는 T013→T014→T015→T016→T017, 동시에 T019·T020·T021·T025·T026. A는 T027·T028·T032를 병렬로 하고 T029→T030→T031→T034. C는 T035·T036·T037·T038·T039를 병렬로 하고 T040.
- **US1**: 시험 T041·T042·T043·T044 병렬 → B는 T045 뒤 T046→T047→T048→T049, T050·T051 / C는 T052·T053·T054·T055 병렬.
- **US2**: 시험 T056·T057·T058·T059 병렬 → B T060→T061→T062→T063 / A T064→T065 / C T066·T067 병렬 / A 실제 모델 T068·T069 병렬 → T070→T071·T072.
- **US3**: T073·T074·T075 병렬 → A T076→T077 / B T078 / C T079 → T080 / A 실제 모델 T081·T082 병렬 → T083.
- **US4**: T084·T085·T086·T087 병렬 → B T088→T089, T090, T091 / C T092·T093 병렬 → T094·T095·T096.
- **스토리 간**: MVP(US1~US4) 뒤에는 US5(B·C)·US7(A·B·C)·US8(A·B·C)을 동시에, US6은 C가 T102·T103 설계를 쓰는 동안 B가 T104를 준비한다.

## Implementation Strategy

1. **MVP = US1~US4를 가짜 모델로 끝까지 한 번 돌리기.** plan 원칙("P0 흐름이 가짜 모델로 한 번 끝까지 돈 뒤 실제 모델을 끼운다")을 따른다. 이 시점에 가입 → 올리기 → 확정 → 결과(낮춤 포함) → 확인 → 이야기 → 전시가 된다.
2. **실제 모델 교체**: A가 T068~T072·T081~T083으로 어댑터를 바꿔 끼우고, US2·US3 시험이 실제 모델로도 통과하는지 본다. M3 네이티브 렌더가 안 되면(plan 위험 1) M3를 `model_not_ready`로 두고 2.5D·액자 경로로 계속 간다.
3. **P0 나머지**: US5 삭제 → US6 공동 보호자(설계 선행) → US7 지표 → US8 평가·승격 → US9 외부 호출. 각 스토리 체크포인트에서 독립 검증 기준으로 멈춰 확인한다.
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
| **합계** | **141** |
