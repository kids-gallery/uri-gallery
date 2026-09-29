# Data Model: 우리 아이 미술관 (Phase 1) — SD_03 기준 구현 뷰

**Created**: 2026-09-28 · **Revised**: 2026-09-28 (SD_03 `15d63f8` + D18 `e2091c0` 기준 전면 개정, 이어서 U1 확정 `ee62c57`·공동 보호자 `c736817`·`5a774f0` 반영 — main 병합 완료. `gate_event` 대상에 `family_invite`·`guardian_account` 포함)
**Plan**: [plan.md](./plan.md) · **Research**: [research.md](./research.md) · **Spec**: [spec.md](./spec.md) v2.2
**DBMS**: MariaDB 12.0.2 (`utf8mb4`, `lower_case_table_names=2`) · 스키마 `ABC10pioneer1`

> **정본은 `design/uri_gallery_ddl.sql`(SD_03, B 소유)이다.** 이 문서는 새 스키마를 정의하지 않는다. SD_03 DDL을 구현이 어떻게 쓰는지(상태 코드·쓰기 소유·트랜잭션·뷰), 그리고 **구현을 위해 SD_03에 더한 보완 S1~S9**(§6, 2026-09-28 SD_03에 반영 완료)의 기록을 적는다.
> 이 문서의 이전 초안(자체 스키마 21개 테이블)은 SD_03과 이름·구조가 달라 폐기했다.
> **표기**: `[추론]` = 원천에 없고 계획에서 정함.

## 1. 테이블 목록 (SD_03 영역 A~H, 33개 + 보완 2개)

| 영역 | 테이블 | 쓰기 주체 | 비고 |
|---|---|---|---|
| H 상수 | `gate_catalog`, `model` | 시드 | G0~G27, M1~M7 |
| A 가족·계정 | `family`, `guardian_account`, `auth_email_token`(D18), `family_invite`(U1), `child`, `team_member`, `team_member_role` | app-api | 보호자는 이메일이 로그인 아이디(BR-ACC-06), 별칭 중복 검사 없음(D18). 한 가족에 만든 보호자(`role='owner'`, 가족당 1명 `uq_guardian_owner_family`)와 공동 보호자(`co`, 가족당 1명 `uq_guardian_co_family` — 부모 두 명까지, 같은 권한, 초대·해제는 불가, BR-ACC-09) |
| F 모델 | `model_version`, `feature_setting` | app-api(관리) | 모델당 활성 1건 `uq_mv_one_active`, 라이선스·해시 없으면 활성 불가 |
| B 작품·판정 | `artwork`, `stored_object`, `artwork_original`, `judgment`, `tag_candidate`, `result` | app-api(접수·확정) + 워커(판정·결과) | 파일 참조는 모두 `stored_object` |
| C 처리 | `stage_job` | app-api(생성·취소) + 워커(실행) | 큐 겸 기록 |
| D 보호자 기록 | `decision`, `story`, `caption`, `caption_selected_tag`, `caption_check_failure` | app-api | 한마디(`story.utterance`)·보호자 감상평(`story.guardian_note`, D24)과 설명(`caption`)은 다른 테이블 |
| E 삭제·집계 | `artwork_outcome`, `deletion_request` | app-api + sweeper | 삭제 뒤 남는 집계는 `artwork_outcome`(SET NULL) |
| F 평가 | `eval_item`, `evaluation`, `eval_item_result`, `release_event` | app-api(관리) + 워커(평가 실행) | 승격 판정은 `v_promotion_eligibility` 한 곳 |
| G 외부 | `api_key`, `external_job`, `external_call_log` | model-api + 워커 | 키 종류 `team_internal`·`course_internal`·`external`·`test` |
| H 추적 | `gate_event` | app-api·model-api·워커 | 게이트 차단·해제를 1급 기록으로(§5) |
| **보완** | `app_session`, `auth_rate_event` | app-api | §6 — SD_03에 없음 |

뷰 16개(`v_story_complete`, `v_exhibit_gate`, `v_current_result`, `v_artwork_display`, `v_job_progress`, `v_child_artwork_count`, `v_gallery`, `v_deletion_hold`, `v_promotion_eligibility`, `v_metrics_service`, `v_metrics_model`, `v_cause_breakdown`, `v_not_delivered_trace`, `v_external_usage`, `v_team_member_masked`, `v_gate_event_orphans`)는 **게이트·유도 속성의 단일 판정 지점**이다. app-api는 같은 판정을 코드로 다시 만들지 않고 뷰를 읽는다(예: 전시 여부는 `v_exhibit_gate.exhibitable`만).

## 2. 코드 대응표 (SD_03 값 → API·화면)

### 2.1 작품 상태 `artwork.status` + 유도 `v_artwork_display.display_status`

| DB 값 | API `state` | 화면 문구(SD_02) | 비고 |
|---|---|---|---|
| `received` | `received` | 접수됨 | |
| `judging` | `judging` | 판정 중 / 판정 중(대기) | 대기 여부는 판정 작업 `status='queued'` |
| `awaiting_confirm` | `awaiting_confirm` | 확정 대기 | 판정 소진이면 `judgment.suggestion_state='exhausted'`(G7) |
| `processing` | `processing` | 처리 중 | |
| `awaiting_review` | `awaiting_review` | 확인 대기 | |
| `failed` | `failed` | 처리하지 못함 | 결과 단계 소진(G9). 이전 초안의 `unprocessable` |
| `approved` | `approved` | 승인됨 | |
| (저장 안 함) | `exhibited` | 전시 중 | `v_artwork_display.display_status='exhibited'` = 승인 + 필수 이야기(G12) |
| `deleting` | (목록에서 제외) | 삭제 중 | 과도 상태(D4). 트리거가 새 작업·이야기·설명을 막음 |

### 2.2 단계 작업 `stage_job`

| 컬럼 | 값 |
|---|---|
| `stage_kind` | `split`(M1) · `judge`(M2+M3 관절+M4) · `animate_render`(M3) · `depth_relief`(M1 마스크+M5) · `frame_compose`(모델 없음) · `caption`(M6, P0.5) · `sculpture`(M7, P1) |
| `origin` | `intake` · `confirm` · `use_lower` · `downgrade` · `caption` (+ 보완 `eval`, §6) |
| `serving_group` | `cpu_vision` · `gpu` · `llm` |
| `status` | `queued` · `running` · `retry_wait` · `done` · `done_downgraded` · `failed`(재시도 소진) · `cancelled` |
| `downgrade_cause` | `animated_to_relief` · `animated_to_frame`(마스크 없음) · `relief_to_frame` · `split_fail`(분리 품질 미달 → 액자) · `sculpture_to_relief` · `llm_to_template` |
| `error_class` | `engine_down` · `timeout` · `storage` · `db` · `model_not_ready` |

`downgrade_cause`와 `error_class`는 동시에 기입할 수 없다(`chk_sj_cause_exclusive`). 낮춘 작업은 다시 시도하지 않는다(`trg_stage_job_bu` — `done_downgraded`에서 상태·시도 수 변경 거부). 인프라 재시도 뒤 두 번째 시도에서 낮추는 것은 허용(SD_03 §19 #19). `frame_compose`만 `model_version_id`가 NULL이다.

어댑터 응답 분류(contracts/stage-job.md §4)와의 1:1 대응(BR-API-02):

| 어댑터 outcome | `status` | `error_class` / `downgrade_cause` |
|---|---|---|
| `ok` | `done` | NULL / NULL |
| `quality_below` | `done_downgraded` | NULL / 구간 코드 |
| 인프라 5종 | `retry_wait`(attempt<3) · `failed`(attempt=3) | 해당 코드 / NULL |
| `cancelled` | `cancelled` | NULL / NULL (지표에서 제외, `v_metrics_model`) |

### 2.3 판정·확정·결과·결정

| 위치 | 값 |
|---|---|
| `judgment.suggestion` | `animated` · `relief` · `frame` (NULL = 없음) |
| `judgment.suggestion_state` | `pending`(제안 전) · `presented` · `exhausted`(판정 소진, G7) |
| `judgment.person_score` | 기록만. 어떤 API 응답에도 싣지 않음(BR-SUG-02, BR-PRC-04) |
| `artwork_outcome.suggestion_at_confirm` | 3종 · `before`(제안 전 직접 확정) · `none`(판정 소진) — 판정 수정률 분모는 3종만(D14) |
| `artwork_outcome.confirmed_path` | `animated` · `relief` · `frame` · `sculpture`(노출 설정 켜짐일 때만, 트리거 G17). 한 번만(트리거 G8) |
| `artwork_outcome.is_modified` | 생성 컬럼 |
| `result.result_kind` | `animated` · `relief` · `frame` · `sculpture`. `uq_rs_first`(작품·종류당 처음 1건) |
| `decision.decision_code` | `like` · `use_lower` · `frame` · `retake`. `uq_dc_round`(회차당 1건), 회차는 1·2(2회차에 `use_lower` 없음) |

### 2.4 결과 원인 5분류 — `artwork_outcome.result_cause` 한 곳 (BR-FBK-04, SD_03 결정)

| 값 | 기록 시점 |
|---|---|
| `guardian_choice` | 확정값이 `relief`·`frame`이고 그대로 결과 도달 |
| `model_downgrade` | 결과 단계에서 `done_downgraded` 발생(최종 결과가 낮춘 결과) |
| `guardian_switch` | 결정 `use_lower`, 또는 액자가 아닌 결과에 `frame` (D2 경우 제외) |
| `infra_failure` | 결과 단계가 재시도 중 인프라로 끝나지 않은 채 다른 경로로 닫힘(예: H6 `use_lower`용 2.5D 소진 뒤 처음 결과 유지) `[추론 — SD_03 문서 정의 확인 필요]` |
| `not_delivered` | 결과 단계 재시도 소진(G9). 뒤에 `frame`을 골라도 유지, `in_approval_base=FALSE`(D2) |
| NULL | 확정값(`animated`)대로 결과 도달 |

`artwork_outcome.first_decision`과 `in_approval_base`가 첫 결과 승인율(`v_metrics_service`)의 원천이다. 기간별 지표(FR-13)를 위해 `confirmed_at`(확정 때)·`first_decided_at`(첫 결정 때)을 앱이 UTC로 적는다(SD_03 §19 #18). 기간 없는 조회는 뷰, 기간 조회는 같은 식에 기간 조건을 더한다.

## 3. 쓰기 소유 (SD_04 모듈 경계 기준 1)

| 테이블·컬럼 | app-api | 워커(`worker-cpu`·`worker-gpu`) | model-api | sweeper |
|---|---|---|---|---|
| `family`, `guardian_account`, `auth_email_token`, `family_invite`, `child`, `app_session`, `auth_rate_event` | 쓰기 | — | — | 만료 행 정리 |
| `artwork` | 행 생성, `received→judging`, 확정·결정·삭제 전이 | `judging→awaiting_confirm`, `processing→awaiting_review` 또는 `failed` | — | 삭제 완료 시 행 삭제 |
| `stored_object`, `artwork_original` | 원본 | 마스크·컷아웃·관절·깊이·결과·임시 | — | 삭제 |
| `stage_job` | 행 생성(`queued`), `cancel_requested_at`, P0.5 `caption` 행 전체 | 점유·실행 컬럼(`status`, `attempt_count`, `claimed_by`, `claim_expires_at`, 시각, `error_class`, `downgrade_cause`, `model_version_id`), `stopped_at` | — | 이어받기(`running`+만료 → `retry_wait`) |
| `judgment`, `tag_candidate`, `result` | — (`frame_compose`도 워커) | 쓰기 | — | — |
| `artwork_outcome` | 확정 시 생성(`suggestion_at_confirm`, `confirmed_path`), 결정(`first_decision`, `in_approval_base`, `guardian_switch`) | `result_kind`, `result_cause`(`model_downgrade`·`not_delivered`·`guardian_choice`) | — | — |
| `decision`, `story`, `caption*` | 쓰기 | — | — | — |
| `deletion_request` | 생성(`accepted`→`waiting_stop`) | — | — | `deleting_files`→`completed` 또는 `incomplete` |
| `model_version`, `feature_setting`, `eval_item`, `evaluation`, `release_event` | 쓰기(평가 담당) | — | — | — |
| `eval_item_result` | — | 쓰기(평가 실행) | — | — |
| `api_key` | 발급·폐기(운영 CLI) | — | 읽기 | — |
| `external_job`, `external_call_log` | — | 실행 컬럼 | 생성·전달·호출 기록 | 결과 만료 정리 |
| `gate_event` | 보호자·운영 게이트 | G7·G9·G19 | G2·G24·G25 | G19 해제 |

## 4. 주요 트랜잭션

| 이름 | 게이트 | 내용 |
|---|---|---|
| 가입(FR-31) | G26 | `family` + `guardian_account`(email, password_hash) + `auth_email_token(verify)` INSERT 한 트랜잭션. 이미 있는 `email_norm`이면 INSERT 없이 안내 메일만, 응답은 같은 202(결정 ④). 동시 가입은 `uq_guardian_email`이 최종 판정 |
| 초대(UC15) | G29 | 요청자가 만든 보호자인지·공동 보호자 자리가 비었는지 확인(트리거 `trg_family_invite_bi`가 최종 판정 → 403 `invite_owner_only` / 409 `co_guardian_full`) → 같은 가족의 대기 초대 `revoked_at`(대기 1건, `uq_invite_one_pending`) → `family_invite` INSERT(토큰 해시, 7일 `[예시값]`) → 초대 메일 |
| 초대 수락 | G28 | 토큰 해시 조회 `FOR UPDATE` → 유효·로그인 계정 이메일 일치·`family_id IS NULL` 확인 → `guardian_account.family_id`, `role='co'` + `accepted_at`·`accepted_account`. 초대 링크로 새로 가입한 계정은 가족 공간을 만들지 않고 합류(UC13 A4) |
| 해제·나가기 | G29 | 해제는 `role='owner'`만(대상은 `co`), 나가기는 `co`만. `family_id=NULL`, `role`은 `co` 유지 + **그 계정의 `app_session` 전부 DELETE**(즉시 접근 불가, FR-9). 올린 자료는 가족에 남음 |
| 이메일 확인 | G27 | 토큰 해시 조회 `FOR UPDATE` → 만료·사용·무효 검사(UTC) → `used_at`, `email_verified_at` |
| 재설정(FR-32) | G27 | 토큰 사용 + `password_hash`·`password_changed_at=UTC_TIMESTAMP()` + 같은 계정 `app_session` 전부 DELETE(결정 ⑥). 재발급 시 같은 목적 이전 토큰 `revoked_at`(`ix_token_account_purpose`) |
| 접수 | G5·G6 | `artwork` + `stored_object(original)` + `artwork_original` + `stage_job(split)` + `stage_job(judge, available_at=먼 미래)` 한 트랜잭션. `uq_artwork_request(family_id, request_no)`로 멱등. 파일은 보상 삭제(research R-14) |
| 확정 | G8·G17 | `artwork` `FOR UPDATE` 상태 확인 → `artwork_outcome` INSERT(`suggestion_at_confirm` = 제안값/`before`/`none`) → 경로별 `stage_job`(`animate_render`·`depth_relief`·`frame_compose`·`sculpture`) → `processing`. `relief` 확정인데 `judgment.split_ok=FALSE`면 `frame_compose`(+`downgrade_cause='split_fail'`는 워커가 결과 기록 시) |
| 결과 저장 | H5 | 워커: `artwork` 삭제 중 재확인 → `stored_object` + `result` + `artwork_outcome.result_kind/result_cause` + `stage_job` 종료 + `awaiting_review` |
| 낮춤 | BR-PRC-02 | 워커: 현재 작업 `done_downgraded` + 다음 작업(`depth_relief` 또는 `frame_compose`, `origin='downgrade'`) INSERT |
| 결정 frame의 전시 | — | "액자로 걸기"(UC4 A2·A5)는 결과 행을 만들지 않는다. `v_gallery`가 결정 `frame`이면 원본 액자로 보이고, 앱은 `artwork_outcome.result_kind='frame'`을 기록한다(SD_03 §19 #17) |
| 결정 | G10·G3 | `decision` INSERT(트리거가 상태 검사, `uq_dc_round`로 중복 차단 → 중복이면 기존 결정 반환) + `artwork_outcome` 갱신 + 전이(`approved` / `use_lower`면 2.5D 없을 때 `depth_relief` 작업·`processing` / `retake`면 `deleting` + `deletion_request(origin='retake')`) |
| 이야기 | G11·G12 | `story` UPSERT(트리거: 미래 제작일·삭제 중·전시 작품 필수 항목 비우기 거절). 전시 여부는 저장하지 않고 뷰로 |
| 삭제 요청 | G18 | `artwork.status='deleting'`, `deleting_since` + 작품의 `stage_job.cancel_requested_at` + `deletion_request(accepted→waiting_stop)` → 202 |
| 삭제 완료 | G19·H13 | sweeper: `v_deletion_hold`에 없음(또는 점유 만료+유예) 확인 → 파일 삭제 → `stored_object` 삭제 → `artwork` 삭제(연결 FK는 CASCADE/SET NULL, `artwork_outcome`·`stage_job`에는 집계만 남음) → `deletion_request` 연결 NULL + `completed`(트리거 `trg_deletion_bu`) |

## 5. `gate_event` 기록 규칙

SD_03은 게이트를 1급 엔티티로 둔다. 구현은 **차단이 일어난 게이트**만 기록한다(통과는 기록하지 않음 `[추론]` — 행 수 억제). `reason_code`는 Problem Details의 `reason`과 같은 코드(예 `made_on_in_future`, `pose_team_internal_only`), 자유 입력·오류 원문 금지(BR-PRV-01). 보류형(G19)은 `released_at`·`release_action`으로 해제를 남긴다. 트리거가 `SIGNAL`로 거절한 경우 app-api가 `MESSAGE_TEXT`의 게이트 번호·코드를 파싱해 409/422와 `gate_event`로 바꾼다.

## 6. 구현 보완 S1~S9 — **SD_03에 반영 완료** (2026-09-28, `uri_gallery_ddl.sql` 개정, 임시 MariaDB 검증 17/17 — SD_03 §18-2)

> 처음에는 별도 마이그레이션(`0100`·`0101`)으로 둘 계획이었으나 SD_03 정본에 되돌려 넣어 기준 마이그레이션 하나로 합쳤다. 아래 표는 무엇을 왜 더했는지의 기록이다. 반영 중 달라진 점: S3의 "평가 작업에 작품 연결 없음"은 MariaDB ERROR 1901(SET NULL FK 컬럼은 CHECK 불가)로 `trg_stage_job_bi`에 넣었고, 평가 작업이 retired 버전을 쓰는 것도 거부한다. S9는 `chk_re_deactivate`(사유 필수)로 넣었다. S6 컬럼 이름은 `sid_hash`·`subject_kind`·`subject_id`·`data`·`created_at`·`expires_at`, S7은 `subject_type`에 `family`(초대 한도용)를 더했다.

| # | 대상 | 보완 | 이유 |
|:--:|---|---|---|
| S1 | `stage_job` | `available_at DATETIME NOT NULL DEFAULT (UTC_TIMESTAMP())` | 재시도 간격(10초·60초, BR-PRC-03 "간격을 늘려")과 `judge`를 `split` 뒤에 여는 데 필요. 점유 쿼리 조건 |
| S2 | `stage_job` | `priority SMALLINT NOT NULL DEFAULT 10` + 인덱스 `ix_sj_claim (serving_group, status, available_at, priority, queued_at)` | 보호자 10 · 평가 50(D17 낮은 우선순위 원칙을 평가에도 적용) |
| S3 | `stage_job` + 트리거·뷰 | `origin`에 `eval` 추가, `evaluation_id`·`eval_item_id` NULL FK, `chk_sj_eval_owner CHECK ((origin = 'eval') = (evaluation_id IS NOT NULL AND eval_item_id IS NOT NULL))`(작품 연결 없음은 ERROR 1901로 CHECK 불가 — `trg_stage_job_bi`). **`trg_stage_job_bi`의 활성 버전 검사를 `origin <> 'eval'`일 때만 하도록 교체**(평가는 후보 버전을 돌려야 함). **`v_metrics_model`·`v_not_delivered_trace`에 `origin <> 'eval'` 조건 추가**(평가 작업이 운영 지표를 왜곡하지 않게) | 평가 실행(UC9 8.4)이 같은 어댑터·큐를 쓰게. SD_03에는 평가 실행 작업의 자리가 없고, 현재 트리거는 후보 버전 작업을 거부함(2026-09-28 점검에서 발견) |
| S4 | `external_job` | `claimed_by`, `claim_expires_at`, `available_at` | 외부 작업도 점유·이어받기·재시도가 필요(BR-PRC-05) |
| S5 | `team_member` | `password_hash VARCHAR(255) NOT NULL`, `disabled_at` | 팀원 로그인(INC2, G1) 수단이 SD_03에 없음 |
| S6 | 신규 `app_session` | `sid CHAR(64) PK`(해시), `subject_kind ENUM('guardian','staff')`, `subject_id BIGINT`, `created_at DATETIME`(UTC), `expires_at`, `data JSON`(자유 입력 없음) | express-session 저장소. 요청마다 `created_at < guardian_account.password_changed_at`이면 무효(결정 ⑥). **가족 ID는 세션에 캐시하지 않고 요청마다 `guardian_account.family_id`로 확인**(해제 즉시 반영, U1) |
| S7 | 신규 `auth_rate_event` | `subject_hash CHAR(64)`(정규화 이메일 또는 IP의 HMAC-SHA256), `subject_type ENUM('email','ip')`, `action ENUM('signup','resend','recovery','login','invite')`, `occurred_at` + 인덱스 | FR-31·32 요청 한도(같은 이메일 10분 3회, 같은 IP 1시간 20회 `[추론]`). 이메일·IP 원문을 저장하지 않음(BR-PRV-01) |
| S9 | 모델 비활성화(ee62c57 clarify) | 평가 담당이 활성 버전을 내리는 조치. SD_03 `release_state`에 별도 값이 없어 `retired`로 두고 `release_event.kind`에 `deactivate`를 추가하는 SD_03 개정을 요청 `[추론]`. 비활성 모델이 필요한 확정 선택지는 화면·API에서 막고(새 작업 없음), 이미 대기 중인 작업은 `model_not_ready` 규칙 | 원천이 "미준비(장애)와 구분되는 운영 상태"를 요구 |
| S8 | `model_version.exec_device` | 값은 `gpu`·`cpu` 그대로 두고, Apple Silicon MPS는 `gpu`로 적고 `runtime`에 `mps` 표기 `[추론]` | 스키마 변경 없이 R-22 장치 표기 |

외부 키 한도(분당 30·하루 1,000, U12 예시값)는 새 테이블 없이 `external_call_log`를 `ix_ecl_key_time`으로 세어 판정한다. 동시 진행 2건은 `external_job` `status IN ('queued','running')` 수로 판정한다. `feature_setting`에는 `sculpture_exposure`만 있으므로 `gpu.enabled`·`caption.enabled`·`external_keys_enabled`는 DB가 아니라 **환경 설정**(`.env`/`serving/config`)으로 둔다.

## 7. 파일 객체 (`stored_object.object_kind`)와 결과 형식(research R-07)

| 결과 | `result.object_id` → kind | 함께 쓰는 객체 |
|---|---|---|
| 움직임 | `result_animated` — MP4(H.264) | 없음(포스터는 `<video preload="metadata">` 첫 프레임, 별도 파일 없음) |
| 2.5D | `result_relief` — 깊이맵 16bit PNG | `judgment.cutout_object_id`(컷아웃 RGBA PNG) |
| 액자 | NULL (원본 참조, 새 파일 없음) | `artwork_original` |
| 3D(P1) | `result_glb` — GLB | — |

외부 호출 파일은 `stored_object`에 넣지 않는다(D8). 경로 규칙 `STORAGE_ROOT/ext/{ext_job_id}/`로만 찾는다.

## 8. 마이그레이션 순서

1. `0001_sd03_baseline.sql` = `design/uri_gallery_ddl.sql` 그대로(D18·공동 보호자·보완 S1~S9 포함 판, 2026-09-28). 멱등.
2. 이후 스키마 변경은 SD_03 개정과 함께 `0002_…`부터 추가한다.
3. 시드: 팀원 계정·역할(운영 CLI), 모델 버전(매니페스트 동기화 CLI).

검증(SD_03 DDL 규칙 3종): 무오류 실행 · 재실행 · 위반 INSERT 거부. 실행기 `api/scripts/migrate.ts`, 기록 `schema_migration(version, checksum, applied_at)`. 시험은 로컬 Homebrew MariaDB의 `uam_test` 스키마에서 먼저 돌린다.
