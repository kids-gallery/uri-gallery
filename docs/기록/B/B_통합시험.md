# B 통합 시험 기록 (T136)

> 기록: B 이제민 · 2026-09-28 · 대상: main `380929b`(b/api 병합) · 원본 폴더 `/Users/pioneer1/project2610`에서 실행
> 환경: 모두 **임시 MariaDB**(팀 DB 아님) · 가짜 모델 어댑터(`UAM_FAKE_MODELS=1`) · Node 20.20.2 · Python 3.11
> 기준: spec Success Criteria, plan 단계 10. 요구 → 증거 연결은 `docs/기록/공통/추적성.md`.

## 1. 실행 결과

| 묶음 | 명령 | 결과 |
|---|---|---|
| app-api + DDL 검증 | `cd api && npm test` | **11 파일 · 99/99 통과** |
| 타입·lint | `npx tsc --noEmit` · `npm run lint` | 오류 0 |
| serving(워커·model-api·llm-server) | `cd serving && .venv/bin/python -m pytest -q --ignore=tests/test_real_m1.py --ignore=tests/test_real_m5.py` | **68 통과 · 3 건너뜀** |
| 계약 사본 일치 | `diff -r -x README.md .specify/…/contracts contracts` | 차이 0 |
| DDL 사본 일치 | `cmp design/uri_gallery_ddl.sql db/migrations/0001_sd03_baseline.sql` | 같음(시험으로도 확인) |

`test_real_m1.py`·`test_real_m5.py`는 실제 가중치용(`requirements-models.lock`의 numpy·torch 필요, `UAM_REAL_MODELS=1`일 때만 실행)이라 이 venv에서는 제외했다. A 환경에서는 건너뜀으로 처리된다.

## 2. 점검 항목별 결과

| 항목 | 방법 | 결과 | 증거 |
|---|---|---|---|
| 장애 주입 5종 × 결과 단계 | 인프라 분류 `engine_down`·`timeout`·`storage`·`db`·`model_not_ready` × `animate_render`·`depth_relief` 매개변수 시험 10건 | 3회 시도 뒤 처리하지 못함·결과 미도달, **낮춤으로 집계 0** | `serving/tests/test_stage_job_contract.py::test_infra_classes_retry_then_fail` |
| 품질 미달 → 낮춤 | 움직임→2.5D→액자, 분리 실패, use_lower 소진 | 재시도 없이 한 단계 낮춤, 원인 기록 | `serving/tests/test_downgrade_chain.py` |
| 인프라 재시도 뒤 낮춤 | 1차 timeout → 2차 템플릿 낮춤 | 허용(`attempt_count=2`, `llm_to_template`) — SD_03 §19 #19 | `api/tests/captions.test.ts`, `db/tests/ddl.verify.test.ts` |
| 원인 5분류 분리 | 보호자 선택·모델 낮춤·보호자 전환·인프라 실패·결과 미도달 지표 | 서로 다른 항목, 기간 식 = 뷰 | `api/tests/ops.test.ts` |
| 삭제 완전성 | 실행 중 작업 멈춤 확인(G19) 뒤 파일·기록 삭제, 저장소 실패 재시도·incomplete, 아이 삭제 | 파일 0, 집계 필드만 남음 | `api/tests/deletion-sweeper.test.ts` |
| 가족 교차 접근 | 다른 가족 아이·작품·결정·이야기·파일 토큰·설명·삭제 | 모두 404, 비로그인 401 | `intake-confirm`·`review-story-gallery`·`deletion-sweeper`·`captions` 시험 |
| 외부 작업 끝까지 | model-api 등록 → 워커 처리(보호자 작업 먼저, 서빙군별 1건) → 결과 1회 수령·삭제, 인프라 3회 뒤 failed, sweeper 이어받기 | 계약대로 | `serving/tests/test_external_worker.py` · `api/tests/deletion-sweeper.test.ts` |
| 판정 전 확정 순서 | 판정 중 확정 → 판정 끝난 뒤에만 결과 작업, relief+분리 실패 → split_fail·액자 | 계약대로 | `serving/tests/test_confirm_before_judge.py` |
| 외부 키 경로 | 키 없음·무효·폐기, `pose` 종류 제한, 한도, 크기·형식, 비활성 모델, 결과 1회 수령·만료 | 계약대로, 모든 호출 기록 | `serving/tests/test_model_api.py` |
| **로그 표본**(BR-PRV-01) | app-api 시험 전체 로그 582줄에서 객체 키 접두어(`family/…` 키·`evalset/`·`tmp/`), 제목·한마디·별칭·키워드 표본, 이메일, 비밀번호, API 키 원문 검색 | **0건**. 로그 필드는 `level·time·requestId·method·route·status·durationMs` 7개뿐(`/v1/family/…` 26줄은 라우트 이름) | 이 문서 §1 명령 + `grep` |

## 3. 하지 못한 것 (다음 단계)

| 항목 | 이유 | 할 일 |
|---|---|---|
| 성능 1차(움직임 p95 3분·액자 p95 30초 잠정) | 실제 모델·팀 서버 미준비(U2·U6·U14) | 팀 서버 첫 배포(`ops/server/DEPLOY.md`) 뒤 평가 묶음으로 측정 |
| 전체 흐름 수동 확인(웹 포함) | 웹(C) 화면 진행 중 | C 화면 연결 뒤 quickstart §5 시나리오 |
| serving 로그 표본 | structlog 허용 목록은 코드로 확인, 실제 출력 표본은 미점검 | A와 함께 워커 실행 로그 표본 검색 |
