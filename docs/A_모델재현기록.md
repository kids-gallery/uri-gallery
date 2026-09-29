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
| 호출 | `/api/chat`, `think:false`, 끝에 `/no_think`, `keep_alive "5m"`, **`num_ctx 8192`(공유 서버 고정값)**, `temperature 0.3`, `num_predict 160`, 타임아웃 300초, 동시 1 |
| 규칙 정본 | `docs/Ollama 유저 가이드.md`(원본 `/Users/Shared/ollama/ollama-user-guide.md`, 2026-09-28판) |
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
| instruct 콜드 적재(`num_ctx 8192`, 디스크 캐시 있음) | **1.07초** — 미리 올린 뒤 첫 호출 재적재 0초, `/api/ps` `context_length=8192` 확인(가이드 §2.4) |

### 공유 서버 가이드 반영(2026-09-28판)

| 가이드 | 구현 |
|---|---|
| §1.3 `num_ctx` 8192 고정 | `ollama_client`가 호출자 값을 무시하고 8192로 넣는다. llm-contract §3의 2048을 대체 |
| §1.7-2 `num_predict` 기본 1024 | 기본 1024, 설명은 160으로 더 줄여 쓴다(상한만 강제) |
| §1.7-5 동시 1건 | `ollama_client`의 프로세스 잠금(미리 올리기와 생성도 겹치지 않음) + llm-server 대기열 |
| §1.7-6 `/api/ps`·`/api/tags` 폴링 금지, `/api/version` 1분 1회 이하 | 설치·다이제스트·상주 확인은 llm-server 기동 때 1회. 이후 상주 여부는 마지막 성공 응답 + 5분으로 **짐작**(`estimated: true`). 404가 나면 1분 뒤 설치 목록을 한 번 다시 본다 |
| §1.7-10 미리 올리기는 기동 때 1회 | 운영 화면의 M6 "지금 불러오기" 제거(model-api 409 `m6_preload_at_start_only`) |
| §1.2 `qwen3:4b` 사용하지 않음 | 이미 `qwen3:4b-instruct-2507-q4_K_M`로 바꿈(가이드 권장과 같음) |
| §1.4 `</think>` 안전장치 | 여는 태그 없이 새어 나온 경우도 `</think>` 앞을 잘라 낸다 |

### 주의 — `localhost`가 아니라 `127.0.0.1`

`curl localhost:11434`는 IPv6 `::1`로 붙어 **다른 Ollama 인스턴스**(LaunchAgent, 거의 비어 있음)를 본다 — 이 호스트에는 Ollama가 둘 떠 있고, 실제 공유 서버는 IPv4 `127.0.0.1`에만 있다. 적재 여부(`/api/ps`)가 다르게 나와 측정을 헷갈렸다. 코드·설정·수동 확인 모두 `http://127.0.0.1:11434`를 쓴다.
측정 도구가 "이미 올라가 있음"을 보고하며 부른 짧은 요청도 keep_alive를 5분 늘린다 — 콜드 측정은 5분 동안 아무 요청 없이 기다린 뒤 한 번만 한다.

### 프롬프트(규칙 검사 정본은 C `caption/`, U11)

예시 없이 쓰면 입력에 없는 물건("배")을 지어내고 반말로 끝났다. 예시 2개(few-shot)와 "words가 없으면 '말했어요'를 쓰지 않는다"를 넣은 뒤 3건 모두 해요체 2문장, 입력 낱말만 썼다. 한 건은 words 없이 아이 말을 지어내서 최소 검사(`말했`)를 넣었다 — 내용 규칙은 C 패키지가 대신한다.

## M1·M2·M5 — 재현 (T070·T082, 2026-09-28, Studio-B, torch 2.4.1)

| | M1 BiRefNet | M2 OpenCLIP ViT-B-32 | M5 Depth Anything V2 Small |
|---|---|---|---|
| 출처 | `ZhengPeng7/BiRefNet` | `laion/CLIP-ViT-B-32-laion2B-s34B-b79K` | `depth-anything/Depth-Anything-V2-Small-hf` |
| HF 리비전 | `e2bf8e4460fc8fa32bba5ea4d94b3233d367b0e4` | `1a25a446712ba5ee05982a381eed697ef9b435cf` | `5426e4f0f36572d16453bbda7a8389317b1bef99` |
| 가중치 파일 | `model.safetensors` 444,473,596B | `open_clip_model.safetensors` | `model.safetensors` 99,173,660B |
| SHA-256 | `9ab37426…a154` | `ac4f8c4b…56e6` | `3152477c…6b70` |
| 장치 | **CPU만** — MPS에 `torchvision::deform_conv2d` 없음 | MPS | MPS(`exec_device='gpu'`, runtime `torch-2.4.1-mps`) |
| 적재(캐시 있음) | 0.7~2.4초(첫 내려받기 포함 14.8초) | 1.9~3.9초(첫 내려받기 포함 20초) | 0.2~1.5초 |
| 추론 | 9~10초/장(1024 입력, CPU) | 0.03초/장(MPS, 첫 장 0.1초) | MPS 0.16초 · CPU 0.52초/장(1024×1024) |
| 최대 RSS | **8.5GB**(CPU 추론 중) | 1.0GB | 1.3GB |

전체 SHA-256은 `models/manifest.yaml`. 가중치 캐시는 `models/hf/`(git 제외).

확인한 것:
- M1: 막대 사람 그림 → 전경 5.7%, 컷아웃 RGB가 원본과 픽셀 단위로 같음(FR-22). 빈 종이 → 전경 0% → `quality_below`(split_fail).
- M2: 같은 그림 → `person` 0.952, 태그 `사람`·`해`(노란 얼굴을 해로 봄 — 후보일 뿐, 보호자가 고른다).
- M5: 정사각형이 아닌 입력에서 DINOv2 위치 임베딩 보간(bicubic)이 MPS에 없어 실패 → `PYTORCH_ENABLE_MPS_FALLBACK=1`(`serving/adapters/__init__.py`)로 그 연산만 CPU.
- M2는 open_clip 기본이 pickle(`open_clip_pytorch_model.bin`, `torch.load`)이라 safetensors를 직접 읽게 바꿨다. M1은 HF 원격 코드(`trust_remote_code`)라 리비전 고정 없이는 적재하지 않는다.
- 실모델 연결 시험(임시 DB, M3만 가짜): 그림 → split(M1 10.7초) → judge(M2+M4, `animated` 제안) → relief 확정 → depth_relief(M5, 16bit 800×600) → `awaiting_review`, `result_cause=guardian_choice`.

위험(T068로 넘김): **M1 CPU 추론 중 8.5GB**. worker-cpu 동시 2건(limits.yaml)이면 17GB 이상 — 팀 서버 RAM 확인 전에는 split 동시 처리를 1로 두는 것을 권한다.

## M3 Animated Drawings — 재현 (T081, 2026-09-29, Studio-B, 네이티브)

Docker 없이 재현했다(research R-03 2026-09-29 개정). 예상했던 33GB는 Docker 이미지 기준이었고, 네이티브 설치는 약 3GB다.

### 환경

| 항목 | 값 |
|---|---|
| 환경 | conda 접두사 환경 `serving/.venv-m3`(micromamba 2.9.0 — 공용 conda 24.1.0은 solver 오류로 쓰지 못함, `~/.local/bin/micromamba`). Homebrew에는 아무것도 설치하지 않음 |
| 잠금 | `serving/conda-m3.lock`(Python 3.8.13 · openjdk 17.0.18 · mesalib 25.0.5, md5 포함), `serving/requirements-m3.lock`(pip 설치 결과) |
| 주요 패키지 | torch 1.13.0 · torchvision 0.14.0 · torchserve 0.12.0 · mmcv-full 1.7.0(소스 빌드 5분 22초, `MMCV_WITH_OPS=1`) · mmdet 2.27.0 · mmpose 0.29.0 · xtcocotools(git `17252e74`) · numpy 1.24.4 · PyOpenGL 3.1.6 |
| AD 저장소 | `models/m3/AnimatedDrawings` 커밋 `b859684857519c7424da51a0b0862fbd1fd258f4`(2025-09-03 보관 시점), `pip install -e` |
| `.mar` | `models/m3/model-store/` — `drawn_humanoid_detector.mar` 327,104,441B SHA-256 `1a2654c8c4fc52faeeeb9cb2f12ba7ecd01f01f5aeef7ff6723cd0a18133abfb`, `drawn_humanoid_pose_estimator.mar` 374,824,711B SHA-256 `40ebdc69f1727dfe475161ae751fb066013e590f8894fe0016f0b69b336ee42f`(릴리스 v0.0.1) |
| TorchServe | `ops/torchserve/config.properties` — 127.0.0.1:9561(예측)·9562(관리)·9563(지표), 워커 1개, 토큰 인증 해제(`disable_token_authorization=true`) |
| 렌더 | `serving/adapters/m3_ad_run.py` — OSMesa 헤드리스(`USE_MESA: True`), `DYLD_FALLBACK_LIBRARY_PATH=serving/.venv-m3/lib`, AD 스크립트의 `localhost:8080`을 `TORCHSERVE_URL`로 바꿈 |
| 매니페스트 | `models/manifest.yaml` M3 — `weights_sha256` `a739c067…f868`(두 `.mar` 해시를 이은 값), `image_digest` `sha256:22e60b57…60fc`(잠금 2개 + 설정 + `.mar` 해시), `config_hash` `677c843a…534c` |

기동:

```bash
E=serving/.venv-m3; export JAVA_HOME=$E/lib/jvm PATH="$E/bin:$E/lib/jvm/bin:$PATH"
cd serving/.run/torchserve && torchserve --start --ncs --ts-config ../../../ops/torchserve/config.properties \
  --model-store ../../../models/m3/model-store --models drawn_humanoid_detector.mar drawn_humanoid_pose_estimator.mar
curl -s http://127.0.0.1:9561/ping    # {"status": "Healthy"}
```

### 측정 (AD 예제 그림 `examples/drawings/garlic.png` 4032×3024 — 팀원 그림이 아니므로 평가 묶음 측정이 아니라 재현 확인용)

| 항목 | 값 |
|---|---|
| TorchServe 기동 → 두 모델 READY | 128초(첫 기동, `.mar` 풀기 포함) |
| TorchServe 메모리(RSS) | Java 0.34GB + 워커 2개 0.81·0.83GB = **약 2.0GB**(개인 PC Docker 1차 3.1GB보다 적음) |
| 관절 추출(검출 + 자세, 긴 변 1000px) | 7.2~9.1초(검출 5.9~7.8초 · 자세 1.3~1.4초), 검출 점수 0.998, 관절 17점 |
| 렌더 전체(`m3_ad_run.py`) | **125.5초**(주석 약 11초 + OSMesa 렌더 약 114초), 최대 RSS 1.59GB, 결과 GIF 500×500 339프레임 |
| 결과 확인 | 프레임 3장을 뽑아 눈으로 확인 — 팔다리가 움직이고 텍스처가 입혀짐 |

- 개인 PC Docker 실측(한 장 53~62초, 렌더 약 40초)보다 **렌더가 약 3배 느리다.** OSMesa는 CPU 소프트웨어 렌더라서다. 시간 상한 `animate_render.timeout_s: 600`(limits.yaml) 안에는 들어온다. U6(시간 상한)은 T137에서 팀원 그림으로 다시 잰다.
- 렌더 중 CPU 사용률이 높다(user 293초 / real 125초 ≈ 2.3코어). worker-cpu 동시 처리 1(limits.yaml `animate_render.concurrency: 1`)을 유지한다.

### 확인한 것 · 어댑터에 넘길 것(T072·T083)

- **요청 크기**: TorchServe 기본 요청 상한은 6.5MB다. 어댑터 `joints()`가 원본을 그대로 PNG로 다시 저장하면 12MP 사진이 약 19MB가 되어 연결이 끊긴다. AD 스크립트처럼 **긴 변 1000px로 줄여 보내야 한다.** 그래야 관절 좌표도 AD `char_cfg`와 같은 좌표계가 된다.
- **렌더 호출**: 어댑터 `render()`는 지금 AD `examples/image_to_animation.py`(창 모드 고정)를 부른다. `m3_ad_run.py`를 부르고 `DYLD_FALLBACK_LIBRARY_PATH`·`TORCHSERVE_URL`·`M3_AD_ROOT`를 넘기도록 바꾼다.
- **관절 skeleton에는 `head`가 없다**(`neck`이 코 위치) — M4 규칙의 필수 관절에서 `head`를 뺐다(기존).
- **GIF→MP4**: 호스트 Homebrew ffmpeg가 깨져 있어(`libx265.215.dylib` 없음) `imageio-ffmpeg 0.6.0`의 고정 바이너리(ffmpeg 7.1 arm64)를 쓴다(기존).
- **포트**: 8080(다른 사용자 컨테이너 UI)·8081(다른 사용자 Express)이 쓰이고 있어 9561~9563으로 옮겼다(R-03).
- **pioneer1은 SSH 세션만 있다**(콘솔 사용자는 다른 계정). GLFW 창 렌더는 불가 — OSMesa가 필수다.
- TorchServe 로그에 `nvidia-smi` 없음 오류가 모델 조회마다 찍힌다. 동작에는 영향이 없다.
- U14: `MODEL_ROOT=<저장소>/models`로 닫았다(research U14, 팀 확인 필요).
