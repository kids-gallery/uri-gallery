# Implementation Plan: 우리 아이 미술관 (P0 우선 · P0.5 · P1 조건부)

**Status**: Draft
**Version**: 1.1
**Created**: 2026-09-28
**Last Updated**: 2026-09-28
**Spec**: [spec.md](./spec.md) v2.2 — main `5a774f0` 기준(D18 `5fb8cc4`·`9f45a8b`, U1 확정 `ee62c57`, 공동 보호자 `c736817`·`5a774f0`, 모두 B 조건부 승인 뒤 병합)
**Branch**: `main` (작업은 `a/model-serving` · `b/api` · `c/web`, 병합 요청으로 합침 — `docs/역할분담.md`)
**입력**: `Intent-Plan.md`(Vue.js + Node.js, **Docker 없이 전개**), `design/` 설계 전체 — REF 재작성 공통기준(§3~§11, D1~D18), SD_01 프로세스설계서(개정 3, P0~P10, G0~G27, H1~H16), SD_02 UI/UX 설계서(S0·S0b·S1~S12, C1~C10), **SD_03 데이터베이스 설계서·`uri_gallery_ddl.sql`(스키마 정본)**, UC_00~UC_14·UC_ALL(BR), 스타일가이드
**산출물**: [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/](./contracts/) (`openapi.yaml`, `model-api.openapi.yaml`, `stage-job.md`, `llm-contract.md`) · [quickstart.md](./quickstart.md)

### 개정 이력

| 버전 | 날짜 | 내용 |
|---|---|---|
| 1.0 | 2026-09-28 | spec v2.1·SD_01·SD_02·UC_ALL 기준 첫 계획. 자체 데이터 모델 21개 테이블 |
| 1.1 | 2026-09-28 | U1 확정(공동 보호자 초대·같은 권한, UC15·G28·G29·`family_invite`)과 clarify 결정(삭제 미완료는 운영 도구, 첫 버전 문제는 모델 비활성화, 제안 전 선택지 즉시 표시) 반영. SD_03(`15d63f8`)를 스키마 정본으로 채택하고 data-model을 "SD_03 구현 뷰 + 보완 S1~S9"로 교체. D18(보호자 이메일 가입·찾기, UC13·UC14, G26·G27, 결정 ①~⑥) 반영. LLM 서빙을 `llm-server`(내부 동기 서버)로 명확화. 모델을 체크포인트 수준으로 구체화(R-22). 메일 발송 Mailpit + nodemailer(R-23) |

## Summary

가족이 휴대폰으로 올린 아이 작품 사진을 공개 사전학습 모델(M1~M7, 학습 없음)을 이어 붙여 **움직임 / 2.5D 입체 부조 / 원본 액자**로 만들고, 보호자가 제안을 확정·결과를 승인·이야기를 적으면 가족 전시에 거는 서비스다. 보호자는 **이메일로 가입·로그인**하고, 가족 공간을 만든 보호자가 **공동 보호자를 초대**해 같은 권한으로 함께 관리한다(D18, U1 확정). 보호자 앱은 **Vue 3 웹 + Node 20/Express API + 팀 MariaDB(SD_03 스키마)**로, 모델 기능은 **Python 3.11 가상환경 + FastAPI/uvicorn**의 model-api와 서빙군별 실행 프로세스(CPU 비전 큐 워커·GPU 큐 워커·LLM 동기 서버)로 나누고, 둘은 **SD_03 `stage_job` 기록 하나의 계약**으로 만난다. Docker 없이 pm2 + 네이티브 nginx로 한 대의 팀 서버에 올리며, 품질 미달은 낮춤 체인으로, 인프라 장애는 최대 3회 재시도 후 "처리하지 못함"으로 분리해 기록한다.

## Technical Context

| 항목 | 결정 | 근거 |
|------|------|------|
| 웹 프론트엔드 | Vue 3.4+ (Composition API) · TypeScript 5.x · Vite 5.x · Pinia 2.x · Vue Router 4. 화면 구현 기준은 `design/style-guide/스타일가이드_우리아이미술관.html`(사용자 지시) | Intent-Plan 웹스택, R-01, R-20 |
| 보호자 앱 API | Node.js 20 LTS · Express 4.x · TypeScript 5.x · mysql2 3.x (SQL 직접, ORM 없음) | Intent-Plan, U7 닫음(R-01) |
| 모델 기능 API | Python 3.11 venv · FastAPI · uvicorn (`model-api` :8100, 외부 `/v1/models/*`) · 모델마다 어댑터 | R3·BR-API-01, BR-MDL-02, R-01·R-10 |
| 서빙 3종 실체 | CPU 비전 = `worker-cpu`(큐 워커) · GPU = `worker-gpu`(큐 워커, 모델 상주) · LLM = `llm-server`(내부 동기 HTTP :8200, 큐 없음, P0.5) | BR-SRV-01, SD_01 P4 4.4, R-18 |
| 모델 | M1 BiRefNet `ZhengPeng7/BiRefNet` · M2 OpenCLIP `ViT-B-32`/`laion2b_s34b_b79k` · M3 Animated Drawings(`.mar` 2종, TorchServe 네이티브) · M4 기하 규칙 파일 · M5 `depth-anything/Depth-Anything-V2-Small-hf` · (P0.5) M6 **Qwen3-4B**(`Qwen/Qwen3-4B`, GGUF Q4_K_M, thinking 끔, 실행기 Ollama) · (P1) M7 `stabilityai/TripoSR` | REF §2, D16, R-22 |
| 저장소(DB) | 팀 MariaDB 12.0.2 `ABC10pioneer1` (utf8mb4). 스키마 정본 SD_03 `uri_gallery_ddl.sql`(D18·공동 보호자·구현 보완 S1~S9 포함, 테이블 35). 도메인 + 작업 큐(`FOR UPDATE SKIP LOCKED`) + 세션 | SD_03, data-model §6, R-04 |
| 저장소(파일) | `StoragePort` 인터페이스 + 로컬 파일시스템 드라이버(`family/`·`tmp/`·`ext/` 분리), 참조는 SD_03 `stored_object`. S3 호환 드라이버 교체 가능 | R-06 |
| 결과 파일 형식 | 움직임 MP4(H.264) · 2.5D 컷아웃 PNG + 깊이 PNG16(WebGL 시차) · 액자 = 원본 참조(새 파일 없음, `frame_compose` 작업) · P1 GLB | U9 닫음(R-07) |
| 보호자 인증·가족 | 이메일이 로그인 아이디(D18), argon2id, 가입 확인·재설정 메일 링크(1회용·해시 저장·UTC), 인증 경로 7개, 재설정 시 모든 세션 무효, 이메일·IP 요청 한도. 공동 보호자 초대·수락·해제·나가기 경로 7개, 해제·나가기 시 그 계정 세션 즉시 삭제, 가족 소속은 요청마다 DB 확인 | FR-9·31·32, 결정 ③④⑥, R-24·R-25 |
| 팀원·외부 인증 | 팀원 세션 쿠키 분리(`team_member` + 보완 S5 비밀번호) · 외부 `X-API-Key`(해시 저장, `team_internal`·`course_internal`·`external`·`test`) | U8 닫음(R-08) |
| 메일 발송 | nodemailer(SMTP) → P0 로컬 **Mailpit**(Homebrew, :1025/:8025). 실제 발송 제품은 U19 | 결정 ⑤, R-23 |
| API 형식 | REST JSON, 오류 RFC 9457 Problem Details + `code`, OpenAPI 3.1 | U8·U18 닫음(R-10) |
| 화면 갱신 | 폴링(3→6→10초, 전이 중 상태만, 숨김 탭 정지). 푸시 없음 | U8 닫음(R-12) |
| 배포 | Docker 없음 · pm2(app-api, model-api, worker-cpu, worker-gpu, sweeper, P0.5 llm-server) · Homebrew nginx(HTTPS·라우팅) · GitLab CI는 검사만 | Intent-Plan 첫 줄, R-02 |
| 시험 | Vitest·Supertest·Playwright(390/1440px) · pytest · 가짜 어댑터 장애 주입 · Redocly 계약 lint · Mailpit API로 메일 시험 | R-19 |
| 관측 | `/live`·`/ready`(모델별)·`/metrics`(prom-client, SD_03 `v_metrics_*` 뷰) · pino/structlog JSON 허용 목록 로그 | FR-12·13·26, BR-PRV-01, R-17 |
| 규모 가정 | P0 팀 내부 검증, 동시 사용자 10명 이하, 한 장 20MB 이하, 서버 1대 | spec Assumptions |
| 성능 목표(잠정) | 움직임 경로 확정→확인 대기 p95 3분 · 액자 경로 p95 30초 | spec SC(v1.0 잠정) |

### Unresolved

- [NEEDS CLARIFICATION: U2 — 팀 서버 GPU 유무. 기본 `GPU_ENABLED=false`(M5 CPU, M7 비노출)]
- [NEEDS CLARIFICATION: U5·U6 — 모델별 품질 임계값과 시간 상한·동시 처리 수. 설정 파일 기본값 `[추론]`으로 시작, 재현·1차 측정 뒤 교체]
- [NEEDS CLARIFICATION: U10 — 판정 제안·낮춤·상태 문구 확정. `web/src/copy/ko.ts` 한 곳에 SD_02 문구로 시작]
- [NEEDS CLARIFICATION: U12 — API 키 발급 주체·한도 수치는 예시값 적용(R-09). 팀 밖 키 발급은 확정 뒤]
- [NEEDS CLARIFICATION: U14 — 팀 서버 모델 파일 경로. `MODEL_ROOT` 환경변수로 둠]
- [NEEDS CLARIFICATION: U19 — 실제 메일 발송 제품·발신 주소·비밀번호 규칙·토큰 유효 시간·재가입 정책. P0는 Mailpit·예시값(R-23·R-24)]
- [NEEDS CLARIFICATION: U20 — 만든 보호자 탈퇴·권한 이전, 가족 없이 남은 계정(나간·해제된 계정)의 재로그인 동작. P0 기본값 `[추론]`: 가족 없는 계정은 자동으로 가족을 만들지 않고 "초대 대기 / 새 가족 공간 만들기" 중 보호자가 고름]
- (P0.5 착수 전) U3 · U11 · U16 / (P1 착수 전) U2·U4 / (운영 전) U13 · U15 · U19 — 각 착수 게이트에서 확인
- **이 계획에서 닫은 항목**: U7(R-01) · U8(R-08·R-10·R-12) · U9(R-07) · U17(R-11) · U18(R-10). **clarify로 닫힌 항목**: U1(공동 보호자, `ee62c57`), U10 중 화면 동작(선택지 즉시 표시·기본 선택 없음)

## Constitution Check

`.specify/memory/constitution.md`가 **없다**(setup: `HAS_CONSTITUTION=false`). 대신 모든 설계 문서가 따르는 **REF §9 핵심 원칙**과 이를 강제하는 BR을 게이트로 쓴다. 강제 수단은 가능한 한 **SD_03 DDL의 제약·트리거·뷰 이름**으로 적었다. 헌장이 만들어지면(`/speckit.constitution`) 이 표를 헌장 원칙으로 다시 점검한다.

| 원칙 (REF §9 · BR) | 준수 여부 | 계획상 강제 수단 |
|------|-----------|------|
| 승인 전 비전시 (BR-APR-01, BR-EXH-01) | PASS | 전시 판정은 `v_exhibit_gate` 한 곳, `/v1/gallery`는 `v_gallery`만 읽음, 계약 시험 |
| 원본 불변 (BR-INT-04, BR-APR-03) | PASS | 파일 `O_EXCL`·0440, `trg_artwork_original_bu`, 액자는 원본 참조, `uq_rs_first` |
| 결과는 늘 돌아온다 (BR-FBK-01~03) | PASS | stage-job.md §6 낮춤 체인, `frame_compose`는 모델 없이 동작(`chk_sj_frame_no_model`) |
| 원인 분리 (BR-FBK-04, FR-5) | PASS | `artwork_outcome.result_cause` 5값, `chk_sj_cause_exclusive`, `chk_sj_downgrade_no_retry`, 장애 주입 시험 |
| 제안은 제안까지 (BR-SUG-01~05) | PASS | 응답 스키마에 점수 필드 없음(`judgment.person_score`는 비노출), 확정값으로만 경로, 기본 선택 없는 UI |
| 최소 수집 (BR-CHD-01, BR-ACC-07, BR-CAP-01, BR-API-05) | PASS | 아이는 별칭만, 보호자는 이메일·비밀번호만(D18), 토큰·비밀번호·요청 한도 대상은 해시로만, 설명 입력 허용 목록, `external_job`에 내용 컬럼 없음 |
| 가입 여부 비노출 (D18 결정 ④, FR-31·32) | PASS | signup·resend·recovery 항상 202, 토큰 오류 한 코드, 로그인 타이밍 균일화(R-24) |
| 기억 왜곡 금지 (BR-STY-03, BR-CAP-02·07) | PASS (P0.5) | `story.utterance` 원문, 통과 문장만 `caption.body`, 걸린 초안은 `caption_check_failure` 분류만, `ai_badge` 생성 컬럼 |
| 가족 격리·역할 분리 (BR-ACC-01~05) | PASS | 세션에서만 가족 결정, 다른 가족 404, 보호자/팀원 세션·라우터 분리, `team_member_role`, 외부 키는 model-api에서만 |
| 로그 정보 보호 (BR-PRV-01) | PASS | 허용 목록 로거, 오류는 코드로만, `gate_event.reason_code`는 분류 코드만, 이메일·토큰 원문 로그 금지 |
| 모델–계약 분리 (BR-MDL-02·05, BR-API-02) | PASS | app-api는 모델 import 없음, `stage_job` 기록 하나, 어댑터 응답 ↔ status/error_class/downgrade_cause 1:1 |
| 라이선스 조건부 활성화 (BR-MDL-07) | PASS | `chk_mv_license_active`, `trg_stage_job_bi`·`trg_external_job_bi`(활성 버전만), `classify` 503 |
| 런타임 격리 (BR-MDL-06, BR-SRV-04) | **PASS(대체 수단)** | Docker 고정 이미지 대신 고정 venv·해시 잠금·체크섬·127.0.0.1 바인딩 — Complexity Tracking 1 |
| Docker 미사용 (Intent-Plan) | PASS | pm2 + 네이티브 nginx/TorchServe/Ollama/Mailpit |

**Gate (Phase 0 전)**: PASS — 위반 1건(BR-MDL-06의 "고정 이미지")은 Intent-Plan 지시에 따른 대체 수단으로 정당화함.
**Gate (Phase 1 설계 뒤 재점검, v1.1)**: PASS — data-model·contracts가 SD_03 제약·뷰를 그대로 쓰고, SD_03에 없는 부분은 보완 S1~S9로 명시했다(스키마를 우회하는 규칙 없음). 새 위반 없음.

## Architecture

### Component Overview

```text
                        ┌──────────────── 팀 서버 1대 (Docker 없음, pm2) ────────────────┐
 보호자 휴대폰 웹 ─┐     │                                                                │
 팀원 운영 화면 ──┼─HTTPS─▶ nginx ──┬─ /, /app/*, /ops/*  → web/dist (Vue SPA)             │
 외부 클라이언트 ─┘     │           ├─ /v1/*, /live, /ready → app-api :3000 (Node/Express) │
                        │           ├─ /v1/models/*         → model-api :8100 (FastAPI)    │
                        │           └─ /_files/* (internal) ← X-Accel-Redirect             │
                        │                                                                │
                        │  app-api ──SQL──▶ MariaDB(팀 DB, SD_03): 도메인·stage_job 큐·세션 ◀──SQL── 워커
                        │     │  ├─HTTP(127.0.0.1)─▶ model-api :8100 /internal/ready      │
                        │     │  ├─HTTP 동기(127.0.0.1)─▶ llm-server :8200 /v1/caption (P0.5)
                        │     │  └─SMTP(127.0.0.1)─▶ Mailpit :1025 (가입·찾기 메일, P0)    │
                        │     └─▶ STORAGE_ROOT/family, tmp  ◀── 워커 읽기·쓰기             │
                        │                                                                │
                        │  [큐 워커 — stage_job 점유]                                     │
                        │  worker-cpu : M1·M2·M3(→TorchServe :8080)·M4·frame_compose       │
                        │               [+M5 if no GPU]                                   │
                        │  worker-gpu : M5·(P1)M7  (모델 상주)                             │
                        │  [동기 서버 — 큐 없음]                                          │
                        │  llm-server : (P0.5) M6 Qwen3-4B → Ollama :11434                 │
                        │  [보조]                                                          │
                        │  sweeper    : 이어받기·임시 파일·삭제 재시도·외부 결과 만료·만료 토큰 │
                        └────────────────────────────────────────────────────────────────┘
```

| 모듈 | 위치 | 담당 | 주도 UC | 쓰기 소유(data-model §3) |
|---|---|---|---|---|
| web (보호자 `/app`) | `web/src/app/` | C | UC1~UC7, UC10, UC13~UC15 | — |
| web (운영 `/ops`) | `web/src/ops/` | C(화면)·B(API 연동) | UC8, UC9, UC11 | — |
| app-api: 인증·가족 | `api/src/modules/{auth,family}` | B | UC13, UC14, UC15, INC1·INC2 | `family`, `guardian_account`, `auth_email_token`, `family_invite`, `app_session`, `auth_rate_event` |
| app-api: 가족·작품·이야기·결정·삭제 | `api/src/modules/{children,artworks,gallery,deletion}` | B | UC1~UC7 | `child`, `artwork`, `artwork_original`, `artwork_outcome`(확정·결정), `decision`, `story`, `deletion_request`, `stage_job` 생성·취소 |
| app-api: 설명 | `api/src/modules/captions` | B(경로)·C(규칙) | UC10 | `caption*`, `stage_job(caption)` |
| app-api: 운영·관리 | `api/src/modules/{ops,admin,apiGuide}` | B | UC8, UC9, UC11 | `model_version`, `feature_setting`, `eval_item`, `evaluation`, `release_event`, `api_key` |
| model-api | `serving/model_api/` | A(모델)·B(인증·한도) | UC12 | `external_job` 생성·전달, `external_call_log` |
| 워커·어댑터 | `serving/workers/`, `serving/adapters/m1…m7` | A | UC3(모델 단계), UC9 실행 | `stage_job` 실행 컬럼, `judgment`, `tag_candidate`, `result`, `stored_object`, `artwork_outcome`(결과 원인), `eval_item_result`, `external_job` 실행 |
| llm-server (P0.5) | `serving/llm_server/` | A(M6 재현·Ollama)·C(규칙 검사 연결) | UC10, UC12 `caption` | — (쓰기 없음. 기록은 호출자 app-api가) |
| caption 패키지 | `caption/` | C | UC10 | — (llm-server가 import하는 라이브러리) |
| sweeper | `serving/workers/sweeper.py` | B | UC7(G19), FR-11 | `deletion_request` 진행, 삭제 트랜잭션, 만료 행 정리 |
| 메일 | `api/src/modules/mail` + Mailpit | B | UC13, UC14 | — |

### Data Flow

0. **가입·로그인(UC13·UC14, G26·G27)**: `POST /v1/auth/signup`(항상 202) → 트랜잭션(family + guardian_account + verify 토큰) → Mailpit으로 확인 메일 → 링크 → `POST /v1/auth/email/verify` → 로그인(`/v1/auth/login`). 찾기는 `/recovery`(항상 202) → 재설정 메일 → `/recovery/reset` → 모든 세션 무효. 공동 보호자는 `/v1/family/invites`(항상 202) → 초대 메일 → 수락(G28) → 같은 가족·같은 권한. 해제(만든 보호자만)·나가기(공동 보호자만, G29)는 그 계정 세션을 즉시 삭제.
1. **접수(P2, G5·G6)**: 웹이 `Idempotency-Key`와 함께 `POST /v1/artworks` → 형식·용량·판독 검사 → 원본 tmp 저장 → 트랜잭션(artwork + stored_object + artwork_original + stage_job split/judge) → rename → **202**.
2. **분리·판정(P0-1)**: worker-cpu가 `split` 점유 → M1 → 마스크·컷아웃 → `judge` 열기 → M2+M3 관절+M4 → `judgment` → `awaiting_confirm`. 소진 시 `suggestion_state='exhausted'`(D1).
3. **확정(P2 2.6, G8·G17)**: `POST …/confirm` → `artwork_outcome`(제안값·확정값) → 경로별 `animate_render`·`depth_relief`·`frame_compose` 등록 → `processing`.
4. **결과 생성(P0-2)**: 워커가 `result` 저장 → `awaiting_review`. 품질 미달은 `done_downgraded` + 체인 다음 작업(재시도 없음), 인프라는 10초·60초 뒤 재시도, 결과 단계 3회 소진은 `failed` + `not_delivered`.
5. **확인·이야기·전시(P3, G10~G12)**: `decision` → `approved`(또는 `use_lower`로 `processing`, `retake`로 `deleting`) → `PUT story` → `v_exhibit_gate`가 참이면 전시 → `/v1/gallery`(`v_gallery`).
6. **삭제(P6, G18·G19)**: `DELETE` → `deleting` + 취소 요청 + `deletion_request` → 워커 중단(`stopped_at`) → sweeper가 `v_deletion_hold`로 멈춤 확인 → 파일·객체·행 삭제 → 집계만 남음.
7. **운영(P7)·평가(P8)·API활용(P9)·외부 호출(P10)**: 운영 화면은 `v_metrics_*` 뷰(식별 정보 없음), 평가는 같은 어댑터로 `origin='eval'`·`priority=50` 작업(보완 S3), 외부 호출은 model-api가 키·한도 확인 뒤 `external_job`(서빙군별 1건) → 결과 1회 전달 후 삭제.

## Phase 0: Research

**Output**: [research.md](./research.md) — R-01~R-25. 스택·배포·M3 네이티브 실행·큐·응답 분류·저장소·결과 형식·인증·요청 한도·오류 분류·API활용 메뉴·폴링·HEIC·원자성·삭제·매니페스트·지표·`llm-server`·시험·디자인 토큰·비밀 관리·**모델 구체 사양(R-22)**·**메일 발송(R-23)**·**보호자 가입·찾기(R-24)**·**공동 보호자(R-25)**. U7·U8·U9·U17·U18을 닫고, 나머지 미해결은 설정값·문구로 격리했다.

## Phase 1: Design & Contracts

**Output**:
- [data-model.md](./data-model.md) — **SD_03 DDL을 정본으로** 한 구현 뷰: 테이블 35개(SD_03 33 + 보완 2)의 쓰기 소유, 상태·코드 대응표, 결과 원인 5분류 기록 규칙, 트랜잭션(가입·확인·재설정 포함), `gate_event` 기록 규칙, **SD_03 보완 S1~S9**, 파일 객체와 결과 형식, 마이그레이션 순서.
- [contracts/openapi.yaml](./contracts/openapi.yaml) — app-api 경로 43개(인증 7 + `/v1/me` + 가족 8 + 팀원 로그인 + 보호자 앱·운영·관리·API활용), SD_03 코드값 사용, Redocly lint 통과.
- [contracts/model-api.openapi.yaml](./contracts/model-api.openapi.yaml) — `/v1/models/{segment|classify|pose|relief}`, `caption`(P0.5, `llm-server` 동기 프록시), 외부 작업 상태·결과 1회 수령, 키 종류 4개.
- [contracts/stage-job.md](./contracts/stage-job.md) — 경계 계약 1(A↔B), SD_03 이름: 작업 종류 7개(`split`~`sculpture`, `frame_compose` 포함), 점유·이어받기, 응답 분류 ↔ status/error_class/downgrade_cause, 소진 처리, 제안 규칙, 낮춤 체인, 취소, 상한, LLM 동기 예외(§11).
- [contracts/llm-contract.md](./contracts/llm-contract.md) — P0.5 `llm-server` 경로, Qwen3-4B 호출 설정, 입력 허용 목록·규칙 검사·템플릿·승인 고정.
- [quickstart.md](./quickstart.md) — Docker 없는 설치·pm2·nginx 라우팅·Mailpit·가입부터 전시까지 시나리오·장애 주입·외부 호출 확인.
- 에이전트 컨텍스트: `.specify/scripts/bash/update-agent-context.sh claude` → 프로젝트 `CLAUDE.md` 관리 블록.

설계 문서와의 대응: SD_03 보완 S1~S9은 B가 SD_03 개정(설계서·DDL)으로 되돌려 넣는다. `contracts/stage-job.md`·`contracts/openapi.yaml`은 구현 착수 시 저장소 루트 `contracts/`로 복사해 B가 소유한다. `models/manifest.yaml`은 SD_03 `model_version` 컬럼과 R-22 고정 방법을 따른다. SD_04(아키텍처)는 이 계획의 Architecture 절을 입력으로 작성한다.

## Phase 2: Implementation Sequencing

제안 작업일 8일(`docs/역할분담.md`) 기준. **P0 흐름이 가짜 모델로 한 번 끝까지 돈 뒤**에 실제 모델을 끼우고, P0 완료 전에는 P0.5를 착수하지 않는다(spec Risks 범위 확장). 세부 작업·완료 조건은 `/speckit.tasks`에서 A/B/C 담당·UC·BR과 함께 만든다.

| 단계 | 범위 | 산출물 | 선행 조건 | 담당 |
|------|------|--------|-----------|------|
| 0 (1일차) | **완료(2026-09-28)** — SD_03 보완 S1~S9를 설계서·DDL에 반영, 임시 MariaDB 검증 17/17. D18·공동 보호자는 main `5a774f0`에 병합 완료 | SD_03 §18-2 | — | B |
| 1 (1일차) | 저장소 골격(`web/`·`api/`·`serving/`·`caption/`·`eval/`·`ops/`), `.nvmrc`, lint·타입·CI 검사, 계약 사본을 루트 `contracts/`로 | 빈 앱이 `/live` 응답, CI 녹색 | 이 계획 | B(골격)·A·C |
| 2 (1~2일차) | DB: `0001_sd03_baseline`(= `uri_gallery_ddl.sql`, 보완 S1~S9 포함), 로컬 `uam_test` | 무오류·재실행·위반 거부(SD_03 DDL 검증 3종) | 0, 1 | B |
| 3 (1~2일차) | 팀 서버 자원·GPU 확인(U2), M1·M2·M3·M5 재현·시간 측정(R-22 체크포인트), TorchServe 네이티브 헤드리스 렌더 확인(R-03 위험), 라이선스 확정 기록(U4, A2) | `docs/A_팀서버_자원확인.md`, `docs/A_모델재현기록.md`, `docs/A_모델_라이선스_확정.md`, `models/manifest.yaml` 초안 | 없음(병행) | A |
| 4 (2~4일차) | app-api P0: **인증 7경로 + 가족 7경로 + Mailpit 메일(UC13·UC14·UC15)**, 팀원 로그인, children, artworks(접수·상세·목록·확정·결정·이야기), gallery, files 토큰, 삭제(G18), `/live`·`/ready`, `gate_event` 기록 | openapi.yaml 계약 시험, Scenario 1·3·9·10·12·13 + 가입·찾기(가입 여부 비노출·토큰 1회용·재설정 뒤 세션 무효) + 공동 보호자(같은 권한·해제 즉시 접근 불가·자료 유지·동시 결정은 첫 결정만) | 2 | B |
| 5 (2~4일차) | 워커 골격: 점유·heartbeat·이어받기·재시도·소진·취소·낮춤 체인·`frame_compose`, 가짜 어댑터(`UAM_FAKE_MODELS`), sweeper | stage-job.md 전 항목 pytest, 장애 주입으로 Scenario 4·5·6·7·11 | 2 | A(워커 절)·B(sweeper·트랜잭션) |
| 6 (2~5일차) | 웹 보호자 S0 가입·S0b 찾기·S1·S1b 가족 보호자·S2~S6·S8·S9: 토큰·C1~C9 컴포넌트, 폴링, 문구 `copy/ko.ts`, 접근성(aria-disabled, 390/1440px) | Playwright 주 흐름(가입 → 전시), 점수·미리 선택·토스트 없음 점검 | 4 계약(모킹 가능) | C |
| 7 (3~6일차) | 실제 어댑터 M1·M2·M3·M4·M5, 매니페스트 동기화, 활성화 게이트(라이선스·평가) | 가짜 → 실제 전환 뒤 같은 시험 통과, 활성 버전 매니페스트 필드 누락 0 | 3, 5 | A |
| 8 (4~6일차) | 운영·관리: 지표 API(`v_metrics_*`)·`/metrics`·p95, 미도달 목록, 매니페스트·평가(`origin='eval'`)·승격·롤백·비활성, 평가 묶음 등록, 웹 S10·S11 | Scenario 14·15, 지표에 식별 정보 0 | 4, 5 | B(API)·C(화면)·A(평가 실행기 `eval/`) |
| 9 (5~6일차) | model-api: 키 인증·한도(`external_call_log`)·크기·`external_job`·결과 1회 수령·만료, `pose` 팀 내부·시험 키 전용, `classify` 라이선스 게이트, 운영 CLI(`ops:key`), API활용 S12·시험 호출 | Scenario 16·18, 외부 입력 잔존 0, 401/403/413/422/429/503 계약 시험 | 5, 7 | B(인증·한도)·A(어댑터 공유)·C(S12) |
| 10 (7~8일차) | 통합 시험: 장애 주입 5종 × 결과 단계, 삭제 완전성, 가족 교차 접근, 가입 여부 비노출, 로그 표본 점검, 성능 1차(움직임 p95·액자 p95), 평가 1차 측정·임계값 제안(U5) | `docs/B_통합시험.md`, `docs/A_평가묶음_1차측정.md` — spec SC 정량 항목 점검표 | 4~9 | B·A |
| 11 (7~8일차) | 사용 관찰(팀원 보호자 역할), 막힌 지점 기록 | `docs/C_사용관찰.md` | 10 | C |
| P0.5 (P0 완료 뒤) | M6 Qwen3-4B 재현(Q4_K_M 다이제스트 고정), `llm-server`, caption 패키지·규칙 검사·템플릿, S7, `/captions`, 외부 `caption`, 약관 | llm-contract.md 시험, Scenario 17 | U3·U11·U16·U12(약관) 확정 | C·A·B |
| P1 (GPU 확인 뒤) | M7 재현·어댑터, sculpture 확정·전시(`<model-viewer>`), 노출 설정 | Scenario 19 | U2 GPU 확인, U4 TRELLIS 제외 확인 | A·C |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Docker 없이 Animated Drawings·TorchServe 네이티브 설치·헤드리스 렌더가 재현되지 않음(개인 PC 실측은 Docker 기반) | High | 1~2일차 최우선 확인(단계 3). 실패 시 M3를 `model_not_ready`로 두고 2.5D·액자 경로로 P0 흐름 검증 계속. 예비 YOLOv8(AGPL)은 U4 결정 전 비활성 유지 |
| SD_03에 구현 필수 컬럼이 없음(재시도 시각·우선순위·평가 작업·외부 작업 점유·팀원 비밀번호·세션·요청 한도) | Medium | 보완 S1~S9을 별도 마이그레이션으로 두고 SD_03 개정으로 되돌려 넣음(B). 정본과 구현이 갈라지지 않게 개정 전까지 data-model §6에 목록 유지 |
| SD_03 트리거(`trg_stage_job_bi`)가 활성 버전 없는 단계 작업 등록을 막음 | Low | clarify(`ee62c57`)로 해소: 비활성 모델이 필요한 선택지는 확정 화면·API에서 막아 새 작업을 만들지 않고, 이미 대기 중인 작업만 `model_not_ready` 규칙(stage-job.md §3 2) |
| 팀 DB가 외부 인터넷 경로(원격 호스트·포트)라 지연·단절 시 큐 점유·트랜잭션이 느려짐 | Medium | 연결 풀·짧은 트랜잭션, 점유 60초·heartbeat 20초, DB 오류는 `db` 분류로 재시도. 시험은 로컬 MariaDB `uam_test`에서 |
| 가입·찾기 메일 남용(메일 폭탄)·가입 여부 노출 | Medium | 이메일·IP 요청 한도(해시 저장), 항상 같은 응답, 로그인 타이밍 균일화(R-24) |
| 팀 DB 비밀번호가 커밋 안 된 `Intent-Plan.md` 작업 사본에 평문으로 있음(이력에는 없음). 그대로 커밋하면 git에 들어감 | Medium | 계획·계약·코드에는 `.env`만 사용(R-21). 비밀번호 교체·문서 정리 여부를 팀이 결정 |
| GPU 없음(U2) → M5 CPU 처리 시간 미측정 | Medium | 2.5D 시간 상한 CPU 600초 `[추론]`로 시작, 재현 뒤 교체. 움직임·액자 경로는 영향 없음 |
| OpenCLIP 가중치 라이선스 미확정(U4) → M2 비활성 → 판정이 늘 "제안 없음" | Medium | 보호자 직접 확정 경로(G7) 정상 동작을 P0 수용 시험에 포함. A2 기록 뒤 활성 |
| 단일 서버에 app-api·워커·렌더가 함께 돌아 자원 경합 | Medium | 서빙군·단계별 동시 처리 1~2, 외부 호출 서빙군별 1, 큐 적체 지표로 감시 |
| 파일 저장소가 로컬 FS라 서버를 나누면(GPU 서버 분리) 공유 불가 | Low | `StoragePort` 인터페이스, S3 호환 드라이버(MinIO 네이티브) 교체 경로 확보 |
| 문구 미확정(U10)·스타일가이드와 SD_02 문구 충돌 | Low | SD_02 우선, `copy/ko.ts` 단일 파일로 확정 시 한 번에 교체 |
| 8일 일정 대비 범위(모델 5종 + 인증·메일 + 운영·평가·외부 API) | High | 가짜 어댑터로 B·C가 A와 독립 진행, P0.5·P1 착수 금지, 단계 10 통합 시험을 일정에 고정 |

## Complexity Tracking

| 설계 편차 | 필요한 이유 | 더 단순한 대안을 택하지 않은 이유 |
|---|---|---|
| 1. BR-MDL-06 "Docker 고정 이미지"를 고정 venv·해시 잠금·체크섬·루프백 바인딩으로 대체, `model_version.image_digest`에 실행 환경 다이제스트 저장 | Intent-Plan "Docker 컨테이너를 사용하지 않고 전개" | Docker 예외 허용은 Intent 위반. 필드 이름 변경은 SD_03·BR 문구와 어긋나 이름은 유지 |
| 2. Intent-Plan 본문 "개발환경/배포: Docker·Nginx·GitLab CI" 중 Docker 항목 미채택 | 같은 파일 첫 줄의 명시 지시가 우선 | — (Nginx·GitLab CI는 유지) |
| 3. 앱 API(Node)와 모델 API(Python) 두 런타임 | R3(모델은 Python venv + uvicorn) + Intent-Plan(Node) 동시 충족 | 한 언어로 통일하면 둘 중 하나의 명시 요구를 어김. 경계는 DB 계약 하나로 최소화 |
| 4. `stage_job`·`artwork`·`artwork_outcome`의 컬럼 단위 쓰기 소유 분할(app-api/워커) | 큐를 DB 테이블로 두어 내구 접수와 같은 트랜잭션에 넣기 위함 | 별도 브로커는 서버·운영 요소 추가(Docker 없음 조건에서 부담). 소유 컬럼을 data-model §3에 고정 |
| 5. SD_03 보완 S1~S9(2026-09-28 SD_03에 반영 완료) | 구현에 필요한 컬럼(재시도 시각·우선순위·평가 작업·외부 점유·팀원 비밀번호·세션·요청 한도)이 SD_03에 없음 | SD_03 개정을 기다리면 단계 2가 막힘. 보완은 추가만 하고 SD_03 제약을 약화하지 않음 |
| 6. LLM 서빙군만 큐가 아닌 동기 HTTP(`llm-server`) | 원천이 LLM 서빙을 "짧은 동기"로 정함(BR-SRV-01, SD_01 P4) | 큐로 만들면 원천과 어긋나고 보호자 화면이 폴링해야 함. 기록은 `stage_job`으로 통일 |

## Open Questions

- [x] D18·공동 보호자 main 병합 — `5a774f0`(보완 반영 확인)
- [x] SD_03 개정: 보완 S1~S9 반영(평가 작업 트리거·운영 뷰 분리, `deactivate` 포함) — 2026-09-28 완료, 검증 17/17
- [ ] `artwork_outcome.result_cause='infra_failure'`의 기록 시점 정의(SD_03 §19 #16) — B
- [ ] U20 만든 보호자 탈퇴·권한 이전 — 열림. 가족 없는 계정 재로그인은 P0 기본값 `[추론]`: 자동 생성 없이 "초대 대기 / 새 가족 공간 만들기" 중 보호자가 고름
- [ ] U2 팀 서버 GPU·사양, U14 모델 경로 — 단계 3에서 A가 확인
- [ ] U10 제안·낮춤·상태 문구 확정 — SD_02 문구로 시작
- [ ] U12 API 키 발급 주체·한도 확정 — 예시값으로 시작, 팀 밖 키 발급 보류
- [ ] U19 실제 메일 발송 제품·발신 주소·비밀번호 규칙·토큰 유효 시간 — P0는 Mailpit·예시값
- [ ] 스타일가이드 글꼴 CDN vs 자체 호스팅 — 자체 호스팅으로 시작 `[추론]`
- [x] 삭제 미완료 건 처리 주체 — clarify 확정: 서비스 운영자가 원인 해결 뒤 운영 도구로 다시 삭제(운영 CLI `ops:purge-retry`, 화면 없음)
- [ ] 3D 노출 설정을 켜는 주체·절차(SD_01 §17 #3) — P1 착수 시
- [ ] `Intent-Plan.md` 작업 사본의 평문 DB 비밀번호 — 커밋 전에 지우거나 `.env` 참조로 바꿀지 팀 결정(이력에는 아직 없음)
- [ ] (P0.5 전) U3·U11·U16, 외부 API 약관 / (운영 전) U13·U15
