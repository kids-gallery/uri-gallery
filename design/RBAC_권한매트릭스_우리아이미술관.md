# RBAC 권한 매트릭스 — 우리 아이 미술관

> 작성: A 최호준 · 2026-09-29 · 결정 D24(RBAC 정본) 후속 · 기준 main `51dba7b`
> **출처(추측 없음)**: 앱 API 계약 `contracts/openapi.yaml`(보안 범위·`x-permission`) · 팀원 권한 정본 `api/src/auth/policy.ts` · 보호자 가드 `guardianAuth(requireFamily)`와 가족 규칙 `api/src/modules/family/routes.ts`(G28·G29) · 모델 API 계약 `contracts/model-api.openapi.yaml`과 키 규칙(DDL `trg` G2 `pose_team_internal_only`, `ops:key` external 발급 금지 D17)
> 팀원 부분은 SD_02 §2-1 역할별 메뉴 표(D21)와 같다. 표·코드·계약이 같은지는 `api/tests/rbac.test.ts`가 확인한다.

## 1. 사용자 유형 (유스케이스 액터 → 시스템 역할)

| 기호 | 사용자 유형 | 유스케이스 액터 | 인증 | 판정 근거 |
|:--:|---|---|---|---|
| 익 | 비로그인 | — | 없음 | — |
| 무 | 보호자 — 가족 없음 | 보호자(나가거나 해제된 뒤, UC15 A4) | 보호자 세션 `uam_sid` | `guardian_account.family_id IS NULL` |
| 만 | 보호자 — 만든 보호자 | 보호자(owner) | 보호자 세션 | `role = 'owner'` |
| 공 | 보호자 — 공동 보호자 | 보호자(co, 부모 2명까지) | 보호자 세션 | `role = 'co'` |
| 운 | 서비스 운영자 | 서비스 운영자(UC8·UC11) | 팀원 세션 `uam_ops_sid` | `team_member_role = operator` |
| 평 | 평가 담당 팀원 | 평가 담당(UC9) | 팀원 세션 | `evaluator` |
| 연 | 연동 개발 팀원 | 연동 개발(UC11) | 팀원 세션 | `integrator` |
| 키A | 외부 클라이언트 — 팀 내부·시험 키 | 외부 클라이언트(UC12) | `X-API-Key` | `key_kind ∈ {team_internal, test}` |
| 키B | 외부 클라이언트 — 과정·외부 키 | 외부 클라이언트(UC12) | `X-API-Key` | `key_kind ∈ {course_internal, external}`. **external은 U12 확정 전 발급하지 않음**(D17) |

- 한 팀원이 역할을 여러 개 가질 수 있다. 그러면 가진 역할의 허용을 합친다(BR-ACC-05).
- 메일 확인 전 보호자는 로그인할 수 없다(403 `email_unverified`). 그래서 **익**과 같다.
- 보호자와 팀원은 쿠키·경로·화면이 분리돼 있어 서로의 경로에 들어가지 못한다(보호자 → 팀원 경로 401, 팀원 → 보호자 경로 401, BR-ACC-03).
- 팀원은 가족의 사진·이야기에 접근하지 않는다.

표기: ✅ 허용 · ❌ 거부(괄호 안은 응답·사유) · — 해당 없음(그 유형이 쓸 이유가 없거나 다른 인증 경로) · ◐ 조건부

## 2. 매트릭스

### 2-1 계정·인증 (UC13·UC14, D18·D24)

| 기능 | 경로 | 익 | 무 | 만 | 공 | 운 | 평 | 연 | 키A | 키B |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 보호자 가입(메일 확인) | `POST /v1/auth/signup` · `/email/verify` · `/verify/resend` | ✅ | — | — | — | — | — | — | — | — |
| 보호자 로그인 | `POST /v1/auth/login` | ✅ | — | — | — | — | — | — | — | — |
| 로그인 정보 찾기·재설정 | `POST /v1/auth/recovery` · `/recovery/reset` | ✅ | — | — | — | — | — | — | — | — |
| 로그아웃 · 내 상태 | `POST /v1/auth/logout` · `GET /v1/me` | ❌ 401 | ✅ | ✅ | ✅ | ❌ 401 | ❌ 401 | ❌ 401 | — | — |
| **비밀번호 변경(로그인 상태)** | `POST /v1/auth/password`(D24 ④) | ❌ 401 | ✅ | ✅ | ✅ | ❌ 401 | ❌ 401 | ❌ 401 | — | — |
| 팀원 로그인 | `POST /v1/ops/auth/login` | ✅(팀원 계정) | — | — | — | ✅ | ✅ | ✅ | — | — |
| 팀원 로그아웃 · 내 역할 | `POST /v1/ops/auth/logout` · `GET /v1/ops/me` | ❌ 401 | ❌ 401 | ❌ 401 | ❌ 401 | ✅ | ✅ | ✅ | — | — |

### 2-2 가족·공동 보호자 (UC15, G28·G29, U1·U20)

| 기능 | 경로 | 익 | 무 | 만 | 공 | 운·평·연 |
|---|---|:--:|:--:|:--:|:--:|:--:|
| 초대 링크 확인 | `GET /v1/family/invites/lookup` | ✅ | ✅ | ✅ | ✅ | — |
| 새 가족 공간 만들기 | `POST /v1/family` | ❌ 401 | ✅(만든 보호자가 됨) | ❌ 409 `already_in_family` | ❌ 409 `already_in_family` | ❌ 401 |
| 초대 수락 | `POST /v1/family/invites/accept` | ❌ 401 | ✅(초대 메일 주소 일치, 아니면 403 `invite_email_mismatch`, G28) | ❌ 409 `already_in_family` | ❌ 409 `already_in_family` | ❌ 401 |
| 보호자 목록 · 초대 목록 | `GET /v1/family/members` · `GET /v1/family/invites` | ❌ 401 | ❌ 409 `no_family` | ✅ | ✅ | ❌ 401 |
| 초대하기 · 초대 취소 | `POST /v1/family/invites` · `DELETE …/invites/{id}` | ❌ 401 | ❌ 409 | ✅(두 명 차면 409 `co_guardian_full`) | ❌ 403 `invite_owner_only` | ❌ 401 |
| 공동 보호자 해제 | `DELETE /v1/family/members/{id}` | ❌ 401 | ❌ 409 | ✅ | ❌ 403 `not_family_owner` | ❌ 401 |
| 가족에서 나가기 | `POST /v1/family/leave` | ❌ 401 | ❌ 409 | ❌ 409 `family_owner_cannot_leave` | ✅ | ❌ 401 |

키A·키B는 이 표의 경로에 쓰지 않는다(모델 API 전용).

### 2-3 아이·작품·전시 — 가족 데이터 (UC1~UC7, UC10, G0)

만든 보호자와 공동 보호자는 **같은 권한**이다(U1 확정). 모든 경로는 요청마다 DB로 가족 소속을 확인하고, **자기 가족 데이터만** 본다. 다른 가족의 자료는 404다(BR-ACC-01~04).

| 기능 | 경로 | 익 | 무 | 만 | 공 | 운·평·연 | 키A·키B |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 아이 등록·목록·별칭 수정·삭제·삭제 진행 | `/v1/children` · `/{id}` · `/{id}/deletion` | ❌ 401 | ❌ 409 `no_family` | ✅ | ✅ | ❌ 401 | ❌ |
| 작품 올리기 · 목록 · 상세 | `POST·GET /v1/artworks` · `GET /{id}` | ❌ 401 | ❌ 409 | ✅ | ✅ | ❌ 401 | ❌ |
| 판정 제안 확정 · 결과 결정 · 이야기 | `POST …/confirm` · `…/decision` · `PUT …/story` | ❌ 401 | ❌ 409 | ✅ | ✅(동시 결정은 첫 결정만) | ❌ 401 | ❌ |
| 작품 삭제 · 삭제 진행 | `DELETE /v1/artworks/{id}` · `…/deletion` | ❌ 401 | ❌ 409 | ✅ | ✅ | ❌ 401 | ❌ |
| 가족 전시 | `GET /v1/gallery` | ❌ 401 | ❌ 409 | ✅ | ✅ | ❌ 401 | ❌ |
| 결과 파일 보기 | `GET /v1/files/{token}`(토큰 가족 = 세션 가족) | ❌ 401 | ❌ 409 | ✅ | ✅ | ❌ 401 | ❌ |
| (P0.5) 설명 초안·수정·모델 대기 | `…/captions` · `GET /v1/captions/model-status` | ❌ 401 | ❌ 409 | ◐(`CAPTION_ENABLED` 켤 때) | ◐ | ❌ 401 | ❌ |

### 2-4 운영·모델·API활용 — 팀원 (UC8·UC9·UC11, D20·D21·D24 — 권한 이름은 `policy.ts`)

| 기능 | 경로 | 권한 이름 | 익 | 보호자(무·만·공) | 운 | 평 | 연 |
|---|---|---|:--:|:--:|:--:|:--:|:--:|
| 생존 확인 | `GET /live` | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| 준비 상태 | `GET /ready` | — | ◐ 상위 상태만 | ◐ 상위 상태만 | ✅ 모델별 | ✅ 모델별 | ✅ 모델별 |
| Prometheus 지표 | `GET /metrics` | — | ❌(서버 안에서만, nginx) | ❌ | ❌(서버 안에서만) | ❌ | ❌ |
| S10 서비스·모델 지표 | `GET /v1/admin/metrics` | `metrics.read` | ❌ 401 | ❌ 401 | ✅ | ✅ | ✅ |
| S10 결과 미도달 추적 | `GET /v1/admin/unreached` | `unreached.read` | ❌ 401 | ❌ 401 | ✅ | ❌ 403 | ❌ 403 |
| S11 매니페스트·모델 상태·평가 항목 보기 | `GET /v1/ops/models` · `GET /v1/admin/models` · `GET /v1/admin/eval-items` | `models.read` | ❌ 401 | ❌ 401 | ✅ | ✅ | ✅ |
| S11 지금 불러오기 | `POST /v1/ops/models/{id}/warmup` | `models.warmup` | ❌ 401 | ❌ 401 | ✅ | ✅ | ❌ 403 |
| S11 모델 점검 실행(D20) | `POST /v1/ops/models/{id}/check` | `models.check` | ❌ 401 | ❌ 401 | ✅ | ✅ | ❌ 403 |
| S11 마지막 점검 보기(D20) | `GET /v1/ops/model-checks` · `/{id}` | `models.check.read` | ❌ 401 | ❌ 401 | ✅ | ✅ | ✅ |
| S11 후보 등록·평가·판단·승격·롤백·비활성화·평가 항목 등록 | `POST /v1/admin/models/{id}/versions·evaluate·promote·rollback·deactivate` · `GET·PATCH /v1/admin/eval-runs/{id}` · `POST /v1/admin/eval-items` | `models.manage` | ❌ 401 | ❌ 401 | ❌ 403 | ✅ | ❌ 403 |
| S12 API활용 명세·시험 호출 | `GET /v1/admin/api-guide/spec` · `POST …/test-call` · `GET …/test-call/{id}` | `apiGuide.use` | ❌ 401 | ❌ 401 | ✅ | ❌ 403 | ✅ |

### 2-5 외부 모델 기능 — API 키 (UC12, D17, model-api)

| 기능 | 경로 | 익(키 없음) | 키A(team_internal·test) | 키B(course_internal·external) | 조건 |
|---|---|:--:|:--:|:--:|---|
| 명세 보기 | `GET /v1/models/openapi.json` | ✅ | ✅ | ✅ | — |
| 분리 · 판정 · 2.5D | `POST /v1/models/segment·classify·relief` | ❌ 401 | ✅ | ✅(external은 발급 전) | 활성 버전만(G25). `classify`는 M2 라이선스 보류로 현재 막힘 |
| 관절(자세) | `POST /v1/models/pose` | ❌ 401 | ✅ | ❌ 403 `forbidden_scope`(`pose_team_internal_only`, G2) | 보관 처리된 M3를 팀 밖 요청이 부르지 않게 한다 |
| 작업 상태 · 결과 1회 수령 | `GET /v1/models/jobs/{id}` · `…/result` | ❌ 401 | ✅(자기 키로 등록한 작업만) | ✅(자기 키 작업만) | 결과는 한 번 받으면 삭제된다(D8) |
| (P0.5) 설명 | `POST /v1/models/caption` | ❌ 401 | ◐ P0에서 404 | ◐ P0에서 404 | P0.5·약관 뒤 |
| 요청 한도 | 분당·하루·동시(`ext-limits.yaml`) | — | ✅ 적용 | ✅ 적용 | 넘으면 429(G25) |

보호자·팀원 세션으로는 모델 API를 부를 수 없다. 모델 API는 키만 받는다.

### 2-6 서버 관리 — 운영 CLI (액터 아님, 서버 셸에 들어갈 수 있는 사람)

| 기능 | 명령 | 비고 |
|---|---|---|
| 팀원 추가·역할 부여·회수·정지·해제·비밀번호·목록 | `npm run ops:staff -- add·grant·revoke·disable·enable·passwd·list` | D24 ③. 회수·정지는 다음 요청부터, 정지·비밀번호 변경은 세션 삭제 |
| API 키 발급·폐기·목록 | `npm run ops:key -- issue --kind team_internal·course_internal·test` · `revoke` · `list` | external은 U12 전 발급 거부. 원문은 발급 때 한 번만 보임 |
| 모델 실행 환경 다이제스트·후보 등록 본문 | `python -m ops.models digest·register` | 등록 자체는 평가 담당이 API로(SD_04 §9-2) |

## 3. 확인 방법 (체크리스트)

| 확인 | 방법 | 자동 |
|---|---|:--:|
| 팀원 권한표 = 계약 = 실제 응답 | `cd api && npx vitest run tests/rbac.test.ts` — 한 역할만 가진 팀원 셋으로 권한마다 허용·거부 확인 | ✅ |
| 보호자 가족 격리·공동 보호자 규칙 | `tests/family.test.ts`(초대는 만든 보호자만·해제 즉시 접근 불가·나가기), `tests/children.test.ts` 등(다른 가족 404) | ✅ |
| 보호자 비밀번호 변경 | `tests/rbac.test.ts` "보호자 비밀번호 변경" | ✅ |
| 외부 키 종류별 | `serving/tests/test_model_api.py`(pose 팀 내부 키 전용·한도·결과 1회) | ✅ |
| 실제 서비스에서 | p1.sumzip.com에서 역할별 계정으로 운영 메뉴가 표대로 보이는지 확인(메뉴는 SD_02 §2-1대로 그린다) | 수동 |

## 4. 바뀔 때

- 팀원 권한을 바꾸려면 **SD_02 §2-1 → `policy.ts` → 계약 보안 범위·`x-permission` → 이 표** 순서로 고친다(D24, 설계 먼저). 시험이 셋의 어긋남을 잡는다.
- 보호자 탈퇴(U19)와 팀원 관리 화면이 들어오면 2-1·2-6에 행을 더한다.
