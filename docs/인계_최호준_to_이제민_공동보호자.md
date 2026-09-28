# 인계 — 최호준(A) → 이제민(B): 공동 보호자 결정 후속과 tasks.md 확인

> 작성일: 2026-09-28 · 작성: A 최호준 세션
> 세션 메시지가 승인 전에 만료돼 전달되지 않아(3회) 저장소 문서로 남긴다.
> 기준 커밋: `1c460b0` 공동 보호자: 부모 두 명까지·초대는 만든 보호자만

## 1. 새 tasks.md의 A 담당 작업 확인 — 문제 없음

B 세션이 plan v1.1(main `5a774f0`) 기준으로 다시 만든 `.specify/features/우리-아이-미술관/tasks.md`의 A 담당 작업을 확인했다. 고칠 곳이 없다.

| 작업 | 확인 내용 |
|---|---|
| T027~T034 | 서빙 공통·워커 실행기·응답 분류·상한 설정·계약 시험. T030 "활성 버전이 없으면 새 작업을 만들지 않고 이미 대기 중인 작업만 `model_not_ready`"는 spec clarify 결정(첫 버전 비활성화)과 같다 |
| T064~T072 | split·judge 단계, M1 `ZhengPeng7/BiRefNet`·M2 `ViT-B-32`/`laion2b_s34b_b79k` 재현(M2는 A2 라이선스 기록 전 비활성), 실제 어댑터 |
| T076~T083 | 결과 단계·낮춤 체인, M3 네이티브 재현, M5 `depth-anything/Depth-Anything-V2-Small-hf`(MPS는 `exec_device='gpu'`, runtime에 mps) |
| T117·T118·T122·T126·T131·T132·T137 | 평가 실행기·평가 묶음·외부 작업·M6 Qwen3-4B + `llm-server`(127.0.0.1:8200, 큐 없음)·M7·1차 측정 — research R-18·R-22, stage-job §11과 일치 |

A는 앞으로 tasks.md를 고치지 않는다. 고칠 일이 생기면 B에게 요청한다.

## 2. 공동 보호자 결정 (사용자 확정, main `1c460b0`)

넷플릭스 계정 공유를 벤치마킹해 사용자가 정했다.

| 항목 | 결정 |
|---|---|
| 인원 | 보호자는 **부모 두 명까지**: 만든 보호자 1명 + 공동 보호자 1명 |
| 초대 | **만든 보호자만** 초대한다. 공동 보호자의 초대 시도는 403 |
| 자리가 찼을 때 | 공동 보호자가 이미 있으면 초대하지 않고 409 `co_guardian_full`("보호자는 두 명까지예요"). 대기 중 초대는 1건만 두고, 새로 초대하면 이전 초대는 무효 `[추론]` |
| 다른 가족 소속 계정 | UC15 E3 그대로 — 409 `already_in_family`, 나간 뒤 수락 |
| 그 밖(이미 반영됨) | 이메일 초대 링크(1회용·예시 7일), 해제는 만든 보호자만, 공동 보호자는 스스로 나가기만, 만든 보호자는 나갈 수 없음(소유권 이전 없음), 한 계정 한 가족, 이야기 동시 수정 충돌 안내 |

`1c460b0`에서 바꾼 곳: spec FR-9 수용 기준 + Clarifications · UC15(A1 개정, E9 신설) · UC_ALL 사본 · BR-ACC-09(REF·UC15·UC_ALL) · SD_01 1.I1과 G29(이름 "보호자 관리 권한", 1.I1 포함) · SD_02 S1b(초대하기도 만든 보호자에게만, 두 명 차면 이유 달린 비활성).

## 3. B에게 넘기는 후속 작업

| # | 대상 | 할 일 |
|:--:|---|---|
| 1 | `design/uri_gallery_ddl.sql` · SD_03 | 가족당 공동 보호자 1명 강제(트리거 또는 생성 컬럼 + UNIQUE), 대기 초대 1건, 초대 요청자가 만든 보호자인지 확인, `gate_catalog` G29 이름을 "보호자 관리 권한"으로. DDL 검증 3종(실행·재실행·위반 거부) 다시 돌리기 |
| 2 | `contracts/openapi.yaml`(및 `.specify/…/contracts` 사본) | `POST /v1/family/invites`에 403(공동 보호자)·409 `co_guardian_full` 추가 |
| 3 | `.specify/features/우리-아이-미술관/tasks.md` | US6(T104~T106)에 위 1·2를 반영 |
| 4 | SD_01 P1 공동 보호자 도면(판단에 맡김) | 표(1.I1·G29)만 고쳤고 도면 소스는 그대로다. 도면에 "만든 보호자·빈 자리 확인" 단계를 넣을지 결정 |

끝나면 이 문서 아래에 처리 결과(커밋 번호)를 적어 주면 된다.

## 4. 처리 결과 (B 이제민, 2026-09-28)

| # | 처리 |
|:--:|---|
| 1 | `design/uri_gallery_ddl.sql`·SD_03: `guardian_account.co_family_id` + `uq_guardian_co_family`(가족당 공동 보호자 1명), `family_invite.pending_family_key` + `uq_invite_one_pending`(대기 초대 1건 `[추론]`), `trg_family_invite_bi`(초대는 만든 보호자만 `G29 invite_owner_only`, 자리 차면 `G29 co_guardian_full`), G29 이름 "보호자 관리 권한"(시드 + 멱등 UPDATE). 임시 MariaDB 12.0.2에서 실행·재실행·위반 거부 **24/24**(구현 보완 S1~S9 17건 포함, SD_03 §18-2) |
| 2 | `contracts/openapi.yaml`(`.specify/…/contracts` 정본): `POST /v1/family/invites`에 403 `invite_owner_only`·409 `co_guardian_full`, "공동 보호자도 초대 가능 [추론]" 삭제. Redocly 오류 0 |
| 3 | `tasks.md` US6: 목표·T102(시험)·T103(초대)·T107(화면) 반영 |
| 4 | SD_01 P1 도면: 표(1.I1·G29)가 이미 규칙을 담고 있어 도면 소스는 바꾸지 않는다(B 판단) |

커밋: 이 문서를 포함한 B 계획 커밋(`git log --grep "B 계획"`으로 확인).
