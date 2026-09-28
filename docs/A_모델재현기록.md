# 모델 재현 기록 (A)

> 매니페스트: `models/manifest.yaml` · 측정 도구: `serving/ops/models.py`
> 호스트: Studio-B.local (Apple M1 Ultra, 공유 Ollama v0.34.0, 127.0.0.1:11434)

## M6 작품 설명 — Qwen3-4B (T126, 2026-09-28)

### 결론

| 항목 | 값 |
|---|---|
| Ollama 태그 | **`qwen3:4b-instruct-2507-q4_K_M`** (Qwen3-4B-Instruct-2507, GGUF Q4_K_M, 2,497,280,480바이트) |
| weights_sha256 | `85e4a5b7b8ef0e48af0e8658f5aaab9c2324c76c1641493f4d1e25fce54b18b9` (`ollama show --modelfile`의 FROM 블롭) |
| config_hash | `ops.models`가 시스템 지시·예시·생성 옵션으로 계산(매니페스트) |
| 호출 | `/api/chat`, `think:false`, 끝에 `/no_think`, `keep_alive "5m"`, `num_ctx 2048`, `temperature 0.3`, `num_predict 160`, 타임아웃 300초, 동시 1 |
| 응답 시간 | 적재된 상태 0.3~0.5초/건 |
| 라이선스 | 모델 카드 Apache-2.0. **팀 확정 기록 전 `license_confirmed=false`**(U4) — llm-server는 `disabled` |

### R-22와 다른 점 — `qwen3:4b` 대신 instruct 태그

- 공유 서버의 `qwen3:4b`(블롭 `sha256:3e4cb1417446…`)는 레지스트리 `qwen3:4b-thinking-2507-q4_K_M`과 **같은 블롭**이다. 태그가 생각 전용 모델로 바뀌어 있었다.
- 이 모델은 생각 과정을 끌 수 없었다(실측):

  | 시도 | 결과 |
  |---|---|
  | `think:false` + `/no_think` | 태그 없이 영어 생각 과정이 본문에 나옴("Okay, let me…"), 160토큰에서 잘림 |
  | `think` 생략 + `/no_think` | 생각은 `thinking` 필드로 가고 본문 빈 문자열 |
  | raw 프롬프트에 빈 `<think></think>` 미리 채우기 | 여전히 영어 생각 과정 |
  | `num_predict 1200`으로 생각하게 둠 | 10.6초, 생각 4,402자, 본문 빈 문자열 |

- 같은 4B·같은 크기(2.5GB)·같은 라이선스인 **Instruct-2507**을 `ollama pull qwen3:4b-instruct-2507-q4_K_M`으로 받았다(공유 서버 규칙 §7.3·§7.5: 10GB 이하, 태그 명시 — 50초).
- 비교(같은 입력): `qwen3:8b` + `think:false`는 정상(3.9초 첫 적재, 5.2GB)이나 크기가 두 배. `gemma3:4b`는 입력에 없는 감정("사랑스럽네요")을 더 많이 붙였다.
- **research R-22·llm-contract §3의 "`qwen3:4b`"는 이 태그로 바꿔야 한다**(문서 소유자에게 인계).

### 적재 시간

| 측정 | 값 |
|---|---|
| `qwen3:4b`(생각 모델) 첫 적재 | 13.47초(공유 서버, 디스크 캐시 없음) |
| instruct 첫 요청의 `load_duration` | 1.1초(pull 직후, 디스크 캐시 있음) |
| 웜업과 실제 호출의 `num_ctx`가 다를 때 | 첫 실제 호출에서 **다시 적재 2.9초** — 웜업도 `num_ctx 2048`로 맞췄다 |
| instruct 콜드 적재 | `python -m ops.models measure M6 --write` 결과를 매니페스트 `load.expected_seconds`에 기록 |

### 프롬프트(규칙 검사 정본은 C `caption/`, U11)

예시 없이 쓰면 입력에 없는 물건("배")을 지어내고 반말로 끝났다. 예시 2개(few-shot)와 "words가 없으면 '말했어요'를 쓰지 않는다"를 넣은 뒤 3건 모두 해요체 2문장, 입력 낱말만 썼다. 한 건은 words 없이 아이 말을 지어내서 최소 검사(`말했`)를 넣었다 — 내용 규칙은 C 패키지가 대신한다.

## M1·M2·M3·M5 — 미실시 (T070·T081·T082)

어댑터 틀과 가짜 어댑터로 흐름 시험만 끝났다. 실제 가중치 재현·SHA-256·적재 시간은 `ops.models measure <ID> --write`로 채운다.
