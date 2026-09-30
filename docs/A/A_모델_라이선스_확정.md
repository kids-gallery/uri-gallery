# 모델 라이선스 확정 기록 (A2 · T069 · U4 · BR-MDL-07)

> 작성: A 최호준 · 확인일 2026-09-29 · 기준: `docs/공통/팀원별_작업지시_프롬프트.md` A2, REF §2 모델 표·BR-MDL-06·07·D17, research R-03·R-22
> 확인 방법: Hugging Face 모델 API(`/api/models/<id>`의 `cardData.license`)와 모델 카드, GitHub 저장소 API(`license.spdx_id`, `archived`)와 LICENSE 원문. 모두 같은 날 조회했다.
> 이 문서는 **기록과 권고**다. 매니페스트·DB의 `license_confirmed`를 켜는 것은 §4의 팀 확정 뒤에 한다(G21·G22, SD_03 `chk_mv_license_active`).

## 1. 채택 모델 5종 (+ P1 후보)

| ID | 체크포인트(리비전) | 코드 라이선스 | 가중치 라이선스 | 상업적 사용 | 가중치 크기 | 공식 배포 위치 |
|:--:|---|---|---|---|--:|---|
| M1 | `ZhengPeng7/BiRefNet` (`e2bf8e44…`) | MIT (GitHub `ZhengPeng7/BiRefNet`) | MIT (HF 카드) | 가능 | 444,473,596B | https://huggingface.co/ZhengPeng7/BiRefNet |
| M2 | `laion/CLIP-ViT-B-32-laion2B-s34B-b79K` (`1a25a446…`) — **이 가중치 하나로 정한다** | MIT 형식 원문(GitHub `mlfoundations/open_clip`, API는 NOASSERTION으로 표시하나 LICENSE 원문은 MIT 조항) | MIT (HF 카드) | 라이선스상 가능. **단, 모델 카드가 배포 용도를 권장 범위 밖으로 둔다(§2)** | 605MB(`open_clip_model.safetensors`) | https://huggingface.co/laion/CLIP-ViT-B-32-laion2B-s34B-b79K |
| M3 | `facebookresearch/AnimatedDrawings` 커밋 `b8596848…` + 릴리스 v0.0.1 `.mar` 2종 | MIT (저장소 보관 처리됨 `archived=true`) | 별도 표기 없음 — 같은 저장소 릴리스로 배포되어 저장소 MIT를 따른다고 본다 `[추론]` | 가능 `[추론]` | 327,104,441B + 374,824,711B | https://github.com/facebookresearch/AnimatedDrawings/releases/tag/v0.0.1 |
| M5 | `depth-anything/Depth-Anything-V2-Small-hf` (`5426e4f0…`) | Apache-2.0 (GitHub `DepthAnything/Depth-Anything-V2`) | **Apache-2.0 (Small만)** | 가능 | 99,173,660B | https://huggingface.co/depth-anything/Depth-Anything-V2-Small-hf |
| M6 (P0.5) | `Qwen/Qwen3-4B-Instruct-2507` (`cdbee75f…`), 실행은 Ollama `qwen3:4b-instruct-2507-q4_K_M`(블롭 `85e4a5b7…`) | GitHub `QwenLM/Qwen3`은 API에 라이선스 표시 없음 — 확인 필요 | Apache-2.0 (HF 카드와 저장소 `LICENSE` 원문) | 가능 | 2,497,280,480B(GGUF Q4_K_M) | https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507 |
| M7 (P1) | `stabilityai/TripoSR` (`5b521936…`) | MIT (GitHub `VAST-AI-Research/TripoSR`) | MIT (HF 카드) | 가능 | 1,677MB(`model.ckpt`) | https://huggingface.co/stabilityai/TripoSR |

실행 환경(모델이 아닌 런타임)의 라이선스:

| 대상 | 라이선스 | 비고 |
|---|---|---|
| TorchServe (M3) | Apache-2.0 | GitHub `pytorch/serve` **보관 처리됨**. 보안 수정이 없어 127.0.0.1에만 연다(BR-MDL-06, BR-SRV-04, R-03) |
| mmcv-full 1.7.0 · mmdet 2.27.0 · mmpose 0.29.0 (M3 `.mar` 실행) | Apache-2.0 | GitHub `open-mmlab/*` |
| PyTorch · open_clip_torch · transformers | BSD-3 · MIT · Apache-2.0 | 널리 쓰이는 표준 라이선스 `[추론 — 이번에 원문 재확인하지 않음]` |

## 2. 모델별 확인 사항

- **M2 OpenCLIP — 팀 판단이 필요하다.** 가중치 라이선스는 MIT다. 그러나 모델 카드 "Out-of-Scope Use"에 "**배포된 모든 사용 사례는 상업·비상업을 가리지 않고 현재 범위 밖**이며, 비배포 사용도 고정 분류 체계로 충분히 시험하지 않으면 권장하지 않는다"고 적혀 있다. 법적 금지가 아니라 사용 권고다.
  - 우리 사용 방식: 고정 레이블 4종(사람·동물·집·사물)으로 **제안만** 하고 확정은 보호자가 한다(FR-3, BR-PRC-04). 점수는 보여 주지 않는다. 평가 묶음(T118)으로 이 분류 체계를 시험한다.
  - 카드는 영어 사용만 권장한다. 우리 프롬프트도 영어다(`serving/config/m2_prompts.yaml`).
  - 학습 데이터(LAION-2B)의 공개 상태와 관련 논란은 이번에 확인하지 않았다 — 확인 필요.
  - **권고**: 평가 묶음 1차 측정(T137)에서 오인율을 본 뒤 켠다. 그 전에는 `classify`(D17)와 판정 제안을 비활성으로 둔다.
- **M3 Animated Drawings**: 코드는 MIT다. 엔진(저장소·TorchServe)이 모두 보관 처리돼 보안 수정이 없다. 라이선스 문제는 아니고 운영 격리 문제다(BR-MDL-06). 외부 키는 `pose`를 쓸 수 없다(D17). 저장소의 Amateur Drawings Dataset은 쓰지 않는다.
- **M5 Depth Anything V2**: **Small만 쓴다.** 같은 계열 Base는 HF 카드가 `cc-by-nc-4.0`(비상업)이다(Large도 비상업 — REF §2). 매니페스트에 Small 리비전만 둔다.
- **M6 Qwen3-4B**: 가중치는 Apache-2.0이다. 실제 실행 파일은 Ollama 레지스트리의 GGUF 변환본이라, 변환본의 라이선스 표기는 확인 필요로 둔다. 원본이 Apache-2.0이므로 조건은 같다고 본다 `[추론]`.

## 3. 채택하지 않는 것

| 대상 | 판단 | 근거 |
|---|---|---|
| Depth Anything V2 Base·Large | 쓰지 않음 | 비상업(`cc-by-nc-4.0`, HF 카드). REF §2 |
| TRELLIS (M7 대안) | **제외** | 모델과 코드 대부분은 MIT지만, 필수 하위 모듈 `diffoctreerast`는 Inria·MPII 원본에서 파생된 **연구·평가 전용(비상업)** 라이선스다. 설치 선택지의 `nvdiffrast`도 NVIDIA Source Code License(비상업은 연구·평가 목적만). 수정판 FlexiCubes는 Apache-2.0 |
| YOLOv8 그림 자세 모델 (M3 예비) | **채택하지 않음** | `ultralytics/ultralytics`는 AGPL-3.0이다. 서비스 소스 공개가 전제된다. R-03은 M3 실패 시에도 이 예비안으로 가지 않고 M3를 `model_not_ready`로 둔다 |

## 4. 팀 확정 (U4)

아래 칸은 팀이 확인한 뒤 채운다. 채워진 모델만 `license_confirmed`를 켤 수 있다(BR-MDL-07).

| ID | A 권고 | 팀 확정 | 확정일 | 확인자 |
|:--:|---|---|---|---|
| M1 | 켬 | 켬 | 2026-09-29 | 신지현 |
| M2 | **보류** — 모델 카드 권고(§2), T137 오인율 확인 뒤 | ~~보류~~(신지현) → **켬**(팀 합의로 보류 해제) | 2026-09-29 | 이진우 전달(팀 합의) |
| M3 | 켬 — 내부망 격리 조건(BR-MDL-06) | 켬(내부망 격리 조건) | 2026-09-29 | 신지현 |
| M5 | 켬 — Small만 | 켬(Small만) | 2026-09-29 | 신지현 |
| M6 | 켬 — P0.5 착수 시 | | | |
| M7 | 켬 — P1 착수 시(TripoSR만, TRELLIS 제외) | | | |
| YOLOv8 예비 | 채택하지 않음 | | | |

U4 판정: **기록은 끝났고, 팀 확정 칸이 채워지면 닫는다.** 2026-09-29 신지현이 권고대로 M1·M3·M5 켬, M2 보류로 확정했다(M6·M7은 해당 구간 착수 시). 매니페스트 `license_confirmed` 반영과 후보 버전 갱신은 A(최호준)가 한다 — 켬 확정은 활성화가 아니며, 평가 통과(G22) 뒤 승격해야 켜진다. 남은 확인 필요 항목은 Qwen3 GitHub 코드 라이선스 표기, Ollama GGUF 변환본 표기, LAION-2B 학습 데이터 상태 세 가지다. 셋 모두 가중치 라이선스 결론을 바꾸지는 않는다고 본다 `[추론]`.

**M2 보류 해제 (2026-09-29, 이진우 전달 — 팀 합의)**: 같은 날 팀이 M2 보류를 풀기로 합의했다. 매니페스트 `license_confirmed: true`로 바꿨다. 모델 카드의 배포 권고(§2)는 그대로 유효하므로 **평가 묶음 1차 측정(T137)에서 오인율을 보고 승격을 판단**한다 — 켬은 활성화가 아니다(G22). 판정 제안은 보호자가 확정하는 구조라(FR-3) 오인이 있어도 보호자가 바로잡을 수 있다.

## 5. 기준 문서와 어긋나는 점

- REF §2 M3 행의 "Docker 고정 이미지"는 R-03(네이티브 실행)으로 대체되었다. REF 수정은 문서 소유자에게 요청한다.
- research R-22 M2 행의 가중치 `laion2b_s34b_b79k`에 붙은 `[추론]`은 이 기록으로 확정할 수 있다(체크포인트 `laion/CLIP-ViT-B-32-laion2B-s34B-b79K`, 리비전 `1a25a446…`).
