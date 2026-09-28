# 모델 적재 시간과 화면 — A가 제공하는 것, B·C가 붙일 것

> 작성: A 최호준 · 2026-09-28 · 브랜치 `a/model-serving`
> 요청: "모델을 추가하거나 로딩할 때 소요되는 시간을 고려하여 사용자 또는 관리자 인터페이스를 구성하라"

## 1. 왜 필요한가 (실측)

| 모델 | 적재에 걸리는 시간 | 언제 다시 겪나 |
|---|---|---|
| M6 설명(Ollama) | 첫 적재 1~14초. 공유 서버가 붐비면 앞 사람 요청까지 기다린다(§7.4 "첫 요청 10~30초") | Ollama `keep_alive` 5분(공유 서버 규칙상 5분 초과 금지). **5분 동안 요청이 없으면 다음 요청이 다시 적재를 기다린다** |
| M1·M2·M5(파이썬 워커) | 가중치 크기 99~605MB — 실측은 T070·T082에서 `ops.models measure`로 | 워커 기동·재시작 때마다 |
| M3(TorchServe) | 1차 실측 RAM 3.1GB, 기동 수십 초 `[추론]` | TorchServe 재시작 때 |

적재 중은 **오류가 아니다**. 작업은 큐에서 기다리고, 끝나면 그대로 처리된다.

## 2. A가 제공한 것 (구현 완료)

### 2.1 적재 상태 값

| `load.state` | 뜻 | 작업 처리 |
|---|---|---|
| `ready` | 올라가 있음 | 정상 |
| `loading` | 올리는 중. `elapsedSeconds`, `remainingSeconds`(= 매니페스트 `expected_seconds` − 경과, 짐작) | 그 모델이 필요한 단계는 **점유하지 않고 기다림** |
| `not_loaded` | 워커가 아직 올리지 않음(기동 직후 순서 대기) | 기다림 |
| `cold` | (M6만) Ollama가 5분 뒤 내림 — 다음 요청이 적재를 겪음 | 요청은 받음. 첫 응답이 느림 |
| `failed` | 적재 실패. 60초마다 다시 시도 | 점유해서 `model_not_ready`로 기록 → 10초·60초 재시도 → 소진 규칙(D1) |
| `disabled` | 활성 버전 없음·라이선스 미확인(G25) | app-api가 작업을 만들지 않음, 확정 선택지를 이유와 함께 막음 |

### 2.2 경로 (model-api 127.0.0.1:8100, 내부 전용 — nginx로 내보내지 않음)

| 경로 | 쓰는 곳 | 응답 요지 |
|---|---|---|
| `GET /internal/ready` | app-api `/ready` | 계약 필드(`groups`·`runtimes`·`gpuEnabled`) + **`models[]`**(보완) |
| `GET /internal/models` | app-api 운영 경로 → S11 | `models[]{modelId, activeVersion, execDevice, runtime, licenseConfirmed, workers, load{state, elapsedSeconds, remainingSeconds, expectedSeconds, lastLoadSeconds, expiresAt}, hint, queue}` |
| `POST /internal/models/{id}/warmup` | S11 "지금 불러오기" | 202 + 그 모델의 현재 상태. 파이썬 모델은 워커에 신호, M6는 llm-server로 |
| `GET /internal/console` | A 운영(임시) | 위 두 경로를 쓰는 단독 HTML 화면(2초 폴링). S11이 생기면 개발·장애 대응용으로만 남긴다 |
| llm-server `GET /v1/ready` | model-api가 합침 | `model{state, loaded, expiresAt, expectedLoadSeconds, lastLoadSeconds, elapsedSeconds, remainingSeconds}`, `queue{inFlight, waiting}` |

`hint` 코드: `model_loading` · `model_cold` · `model_failed` · `model_disabled` · `null`(정상).

### 2.3 모델을 추가할 때 (운영 CLI, `serving/`에서)

```bash
python -m ops.models prepare M6                 # 준비 절차 안내(공유 Ollama pull은 사람이 1회, 런타임 코드에는 없음)
python -m ops.models check M6                   # 태그·블롭 다이제스트 = 매니페스트
python -m ops.models measure M6 --write         # 적재 시간 실측 → models/manifest.yaml load.expected_seconds
python -m ops.models register M6 --label … [--apply]   # model_version 후보 등록(활성화는 승격 절차 G22)
python -m ops.models status                     # 매니페스트·DB 활성 버전·워커 적재 상태·llm-server
```

`expected_seconds`가 있어야 화면이 "약 N초"를 보여 준다. 없으면 "잠시만 기다려 주세요"만.

## 3. C에게 — 화면 요구 (S3·S4·S7·S11)

### 3.1 보호자 화면 (오류처럼 보이지 않게)

| 화면 | 조건 | 문구 `[추론]` | 동작 |
|---|---|---|---|
| S4 진행 상세, S3 판정 대기 | 작업 `queued`이고 그 단계 모델 `hint=model_loading` | "그림을 볼 준비를 하고 있어요. 조금만 기다려 주세요." (남은 시간 있으면 "약 N초") | 폴링 계속. 진행 막대는 "대기" 단계에 머묾. 빨간 표시·오류 블록 금지 |
| S7 설명 만들기 | llm `model.state = cold` 또는 `loading` | 버튼 아래 "처음 만들 때는 10~30초쯤 걸릴 수 있어요." | 버튼을 누른 뒤 스피너 + 경과 초. 30초(호출자 상한)를 넘기면 G15 선택지 |
| S7 | `queue.waiting > 0` | "다른 설명을 먼저 만들고 있어요." | 같음 |
| S3 확정 | `hint=model_disabled` | 기존 clarify 결정대로 그 선택지를 이유와 함께 막음 | — |

- 점수·모델 이름·버전·장치는 보호자 화면에 보이지 않는다(BR-SUG-02, D3).
- `model_failed`는 보호자에게 적재 실패라고 말하지 않는다 — 작업은 "다시 시도하는 중"(S4 기존 문구)으로 보인다.

### 3.2 운영 화면 S11 "모델 상태" 표 (팀원 `operator`·`integrator`)

| 열 | 값 |
|---|---|
| 모델 | M1~M7 이름 |
| 활성 버전·장치 | `activeVersion` · `execDevice`/`runtime`(MPS 표기 포함) |
| 적재 | 상태 배지 + `loading`이면 진행 막대(경과/예상) · 마지막 적재 초 · M6는 "내려갈 시각" |
| 대기 | M6 `queue` · 그 밖은 `v_metrics_model.queue_backlog`(B) |
| 동작 | "지금 불러오기"(`not_loaded`·`failed`·`cold`일 때만) → `POST …/warmup`, 결과는 폴링으로 |

폴링 2초 `[추론]`, 화면이 안 보일 때(document.hidden) 멈춤. 참고 구현: `serving/model_api/console.html`.

## 4. B에게 — app-api에 붙일 것

1. `/ready` 합성 시 `models[]`를 그대로 두거나 요약(`anyLoading`)으로 넣는다. 공개 `/ready`에는 버전·장치를 내보내지 않는다.
2. 운영 경로 `GET /v1/ops/models`(requireStaff) → model-api `/internal/models` 프록시, `POST /v1/ops/models/{id}/warmup` → `…/warmup`. `gate_event` 없음(운영 동작).
3. 보호자 `GET /v1/artworks/{id}` 진행 응답에 단계별 `waitingForModel: boolean`(해당 단계 모델 `hint=model_loading`)과 `etaSeconds`(있으면)만 붙인다 — 모델 이름·상태 원문은 넣지 않는다.
4. `contracts/model-api.openapi.yaml` `/internal/ready`에 `models[]` 스키마 추가(A 보완, 위 2.2).
