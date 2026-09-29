# 팀 서버 자원 확인 — 모델 5종 실행 위치 (A1 · T068 · U2)

> 작성: A 최호준 · 2026-09-29 · 기준: `docs/팀원별_작업지시_프롬프트.md` A1, REF BR-SRV-01~04·D10, research R-02·R-03·R-22, `docs/A_모델재현기록.md`
> 확인 방법: 읽기 전용 명령(`sysctl`, `system_profiler SPDisplaysDataType`, `df`, `vm_stat`, `top`, `who`, Ollama `/api/ps`). 설치·삭제·재시작은 하지 않았다.

## 0. 대상 서버

| 항목 | 값 |
|---|---|
| 호스트 | Studio-B.local (192.168.0.53) |
| 팀 서버 여부 | **[추론] 팀 서버로 본다** — 팀 DB(MariaDB 12.0.2 `ABC10pioneer1`)와 지금까지의 개발·시험이 모두 이 호스트에서 돌았다(research 실측 사실 2026-09-28). 팀 확인 필요 |
| OS | macOS 26.3.1 (빌드 25D2128) |
| 공유 여부 | **여러 사용자가 함께 쓴다.** 확인 시점 로그인 계정 5개(euclidsoft·pioneer1~4). 콘솔(화면) 사용자는 euclidsoft이고 pioneer1은 SSH 세션만 있다 |

## 1. 자원

| 항목 | 값 | 비고 |
|---|---|---|
| CPU | Apple M1 Ultra, 20코어(성능 16 · 효율 4) | |
| 메모리 | 128GB | 확인 시점 시스템 여유 약 50%. 다른 사용자 프로세스가 약 70GB 사용(OrbStack 25GB, llama-server 2개 27GB, MariaDB 8.6GB, 그 밖의 python·node) |
| GPU | **NVIDIA GPU 없음(CUDA 불가, `nvidia-smi` 없음).** Apple GPU 64코어, Metal 4 → PyTorch MPS 사용 가능 | M2·M5 MPS 실측(A_모델재현기록) |
| 디스크 | 데이터 볼륨 1.8TB 중 약 338GB 여유(사용률 82%) | M3 환경 약 3GB(2026-09-29 설치분, T081) |
| Docker | OrbStack(`/usr/local/bin/docker`, `orb`) 있음 | **쓰지 않는다**(Intent-Plan, R-02). 확인만 함 |
| 공유 Ollama | `127.0.0.1:11434`, 다른 사용자 모델(gemma3:12b 등)이 적재된 상태 | M6은 이 공유 Ollama를 쓴다(`docs/Ollama 유저 가이드.md` 규칙) |
| 사용 중인 포트 | 8080(다른 사용자 컨테이너 UI), 8081(다른 사용자 Express), 9501(프로토타입 공유 서버) | TorchServe는 9561~9563으로 옮김(R-03 개정안, 브랜치 `a/t081-m3`) |

## 2. 모델별 실행 위치

프롬프트가 정한 배치(BR-SRV-01)와 이 서버 실측을 함께 적는다. 메모리는 `docs/A_모델재현기록.md` 값이다.

| 모델 | 서빙군(BR-SRV-01) | 이 서버의 장치 | 실측 메모리(최대 RSS) | 처리 시간(1장) |
|---|---|---|---|---|
| M1 BiRefNet | CPU 비전 워커 | CPU(MPS에 `deform_conv2d` 없음) | **8.5GB** | 9~10초 |
| M2 OpenCLIP ViT-B-32 | CPU 비전 워커 | MPS | 1.0GB | 0.03초 |
| M3 Animated Drawings | CPU 비전 워커(TorchServe 네이티브) | CPU | 자료 없음 — 확인 필요(T081 중단. 개인 PC Docker 1차 실측 3.1GB) | 자료 없음 — 확인 필요(개인 PC 53~62초) |
| M4 기하 규칙 | CPU 비전 워커 | CPU | 무시할 수준 | — |
| M5 Depth Anything V2 Small | GPU 워커(없으면 CPU, BR-SRV-02) | **MPS** | 1.3GB | MPS 0.16초 · CPU 0.52초 |
| M6 Qwen3-4B-Instruct-2507 (P0.5) | LLM 서버 → 공유 Ollama | Metal | 파일 2.5GB(실행 메모리 자료 없음) | 적재 상태 0.3~0.5초/건 |
| M7 TripoSR (P1) | GPU 워커 | **비노출 유지** | — | — |

모두 올렸을 때 합계는 약 15GB + M3·M6 실행 메모리다. 128GB 서버에서 여유는 있지만, 다른 사용자가 70GB를 쓰는 공유 호스트라 M1 동시 처리 2건(17GB 이상)은 부담이 된다.

## 3. GPU가 없을 때의 영향 — 이 서버에서의 판단

BR-SRV-02는 "GPU가 없으면 M5는 CPU로 실행하고 M7(3D)은 비노출"이다. 이 서버에는 CUDA GPU는 없고 Apple GPU(MPS)만 있다.

| 대상 | 판단 | 근거 |
|---|---|---|
| M5 | **[추론] MPS를 GPU로 보고 GPU 워커에서 돌린다**(`GPU_ENABLED=true`). MPS가 없는 서버로 옮기면 `GPU_ENABLED=false`로 두고 cpu_vision 워커가 M5를 맡는다(`serving/workers/runner.py`) | MPS 0.16초 vs CPU 0.52초. 매니페스트가 이미 `exec_device: gpu`, `runtime: torch-2.4.1-mps`로 기록 |
| M7 | **비노출 유지.** 노출 설정은 켜지 않는다(D10) | TripoSR의 MPS 동작은 재현하지 않았다 — 자료 없음. P1 착수 게이트에서 확인 |
| worker-cpu 동시 처리 | **[추론] split 동시 처리를 1로 둔다**(지금 `serving/config/limits.yaml`은 2) | M1 8.5GB × 2 + 다른 사용자 70GB. 설정 변경은 U6·T137과 함께 제안 |
| M3 | TorchServe 워커 1개, 127.0.0.1(R-03 개정) | 공유 호스트 메모리 보호, BR-SRV-04 |

## 4. U2 판정

U2 = "팀 서버 GPU 유무 — M5 속도, M7(P1) 가능 여부".

- **GPU 유무: 닫을 수 있다.** CUDA GPU 없음, Apple GPU(MPS) 있음.
- **M5 속도: 닫을 수 있다.** MPS 0.16초/장으로 실측됨.
- **M7 가능 여부: 닫지 못한다.** TripoSR의 MPS 재현 자료가 없다. P1 착수 전에 확인한다(plan P1 선행 조건).
- **결론: P0 범위(M5)는 닫고, M7 부분은 P1 게이트로 넘긴다.** 단, "Studio-B = 팀 서버"라는 전제(§0)를 팀이 확인해야 확정된다.

## 5. U14(모델 파일 경로) 관련 — 확인만

- `.env.example`의 `MODEL_ROOT=/srv/uam/models`에서 상위 폴더 `/srv`가 이 서버에 없다. 만들려면 관리자 권한이 필요하다.
- 지금 실제로 쓰는 경로는 `serving/common/config.py`의 기본값인 저장소 안 `models/`(M1·M2·M5 캐시 `models/hf/`, M3 `models/m3/`)다.
- U14는 A3(재현과 매니페스트)에서 닫는다. 제안: `/srv` 대신 저장소 안 `models/`를 정본 경로로 둔다. 확정 전이다.

## 6. 기준 문서와 어긋나는 점

- `.env.example`의 `MODEL_ROOT=/srv/uam/models`와 `GPU_ENABLED=false`가 이 서버 실측과 다르다. U14·U2 확정 뒤 B(이제민, `.env.example` 담당)에게 고쳐 달라고 요청한다.
- `serving/config/limits.yaml`의 split 동시 처리 2는 이 서버에서는 부담이 된다(§3). U6 확정(T137) 때 함께 고친다.
- `ops/DEPLOY.md`의 "팀 서버 사양·GPU·모델 경로 칸"은 이 문서가 확정된 뒤에 채운다.
