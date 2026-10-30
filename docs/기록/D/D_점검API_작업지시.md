# D 점검 API(D20) — A·B 작업 지시

> 작성: 2026-09-29 (점검 API 담당 D) · 근거: REF D20 · SD_01 §10-4 · SD_02 §14 · SD_03 §18-3 · SD_04 §8 · stage-job §13 · tasks T155·T157
> D 몫(설계·계약·DDL·app-api, T151~T154)은 끝났다. 아래는 다른 담당의 몫이다.

## 지금 상태

- app-api 점검 경로 3개가 있다: `POST /v1/ops/models/{modelId}/check`(202) · `GET /v1/ops/model-checks` · `GET /v1/ops/model-checks/{checkId}`. `/ready`는 팀원 세션이면 모델별 `lastCheck`를 싣는다.
- 점검 요청은 `model_check` 1행 + `stage_job`(`origin='check'`, `priority` 30, `model_check_id`, `eval_item_id`) 1행을 만든다.
- **`MODEL_CHECK_ENABLED`는 기본 꺼짐**이다. 꺼져 있으면 점검 요청이 503 `check_runner_missing`으로 막힌다. 워커가 아직 점검 작업을 모르기 때문이다(아래 A 1번).

## A (최호준) — T155 serving 점검 실행기

1. **먼저**: `serving/workers/runner.py:159`의 보호자 작업 점유 조건 `origin <> 'eval'`을 `origin NOT IN ('eval','check')`로 바꾼다. 지금 조건이면 점검 작업을 보호자 작업으로 잡는다.
2. 점유 순서를 보호자 → **점검** → 평가 → 외부로 둔다. `serving/config/limits.yaml`의 `priority`에 `check: 30`.
3. 점검 실행기(`workers/stages/check.py` 권장, `stages/eval.py`와 같은 모양):
   - 입력: `eval_item.object_id` → `stored_object`(`evalset/…`).
   - 그 모델 어댑터만 한 번. M2는 분류만, M3는 관절 추정까지(렌더 제외), M5는 깊이 추정까지(부조 합성 제외).
   - 판정은 **재시도 없이** stage-job §13 표대로. 출력 형식 기준은 SD_01 §10-4 표(M1 마스크 크기·전경 · M2 제안 값 · M3 관절 개수 · M5 깊이 크기·값 분산 · M7 GLB 다시 읽기·면 수). 기준값은 A가 확정해 SD_01 표에 적어 달라.
   - 기록: `model_check.status`(`running` → `passed`/`failed`), `outcome`, `fail_reason`, `processing_ms`(적재 제외), `memory_mb`, `started_at`·`finished_at`. `stage_job`은 `done` 또는 `failed`.
   - 출력은 `tmp/{job_id}/`에만 두고 판정 뒤 지운다. `stored_object`·`result`에 쓰지 않는다. 로그는 허용 목록만.
4. 점유 만료 점검은 app-api sweeper가 `failed`·`engine_down`으로 닫는다(이미 구현). 실행기에서 따로 할 일 없다.
5. 배포한 뒤 app-api 환경에 `MODEL_CHECK_ENABLED=true`를 켜고 D에게 알린다.

## B (이제민) — T157 S11 화면

SD_02 §14(와이어프레임·14-2·14-3·14-4)와 §16 G30 행대로 만든다.

- 모델 상태 표에 "마지막 점검" 열(`GET /v1/ops/model-checks`)과 [점검] 버튼. 버튼은 운영자·평가 담당에게만, M1·M2·M3·M5·M7 행에만 둔다.
- 점검 요청 뒤 `GET /v1/ops/model-checks/{id}`를 3→6→10초 폴링한다(R-12). 끝나면 행을 갱신한다.
- 오류: 409 `check_in_progress` → C3 "(비활성) - 점검 중이에요" · G30(`no_check_sample`·`not_check_sample`·`version_retired`) → C2(해제 주체 평가 담당) · 503 `check_runner_missing` → C2 "점검을 아직 쓸 수 없어요".
- 점수는 없다. 통과/실패 사유·처리 시간·끝난 시각만 보인다.
- S10 준비 표에는 `/ready`의 `lastCheck`를 읽기만 한다.
