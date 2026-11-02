# #16 모델 CPU 측정 기록 — 최호준(A)

측정일: 2026-11-02. 이 문서는 부분 결과이며 #16의 전체 완료 보고가 아니다.

## 목적과 환경

Windows PC에서 실제 모델 실행 가능성을 판단한다. PC 메모리는 7.73GiB,
WSL 메모리는 약 3.8GiB, 스왑은 2GiB다. CPU 종류는 x86_64다.
M2·M5는 Git Bash에서 Docker Desktop Linux/amd64 컨테이너를 제어해 측정했다.
컨테이너는 `python:3.11-slim`, CPU 2개, 메모리 3GiB, 메모리+스왑 3GiB 제한이다.
패키지는 `serving/requirements-models-linux-x86_64.lock`의 버전·해시로 설치했다.
측정 당시 컨테이너의 정확한 Python 패치 버전과 이미지 다이제스트는 이 기록에 확보하지 못했다.

M1은 별도 비교 실험이다. Ubuntu의 Python 3.11.18 가상환경에서 같은 잠금 파일로
설치하고 CPU 스레드 환경 변수 `OMP_NUM_THREADS=2`, `MKL_NUM_THREADS=2`로 실행했다.
컨테이너의 3GiB 제한은 적용하지 않았고 실행 중 스왑 사용을 관찰했다.
가상환경 준비·M1 실행은 Codex가 수행했고, M2·M5는 작성자가 안내된 명령을 직접 실행했다.

## 결과

| 모델 | 실행 환경 | 적재 시간(초) | 추론 시간(초) | 프로세스 최대 RSS(MiB) | 결과 |
|---|---|---:|---:|---:|---|
| M1 | Ubuntu venv | 19.938 | 109.678 | 3284.7 | ok |
| M2 | Linux 컨테이너 | 9.154 | 0.157 | 1488.1 | ok |
| M5 | Linux 컨테이너 | 2.032 | 1.889 | 629.3 | ok |

원시 수치와 모델 리비전은 같은 폴더의 JSON에 보관한다.
M2·M5는 먼저 `prepare`로 가중치를 받은 뒤, 새 Python 프로세스에서
`HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`로 측정했다.
M1 적재 시간은 다운로드가 포함될 수 있어 M2·M5와 직접 비교하지 않는다.

## 측정 코드와 확인 방법

M2·M5에 실제 사용한 `measure_m2.py`, `measure_m5.py`를 보존했다.
코드의 `/results`는 호스트 결과 폴더를 마운트한 위치다. `PYTHONPATH`는
컨테이너의 `serving/`를, `MODEL_MANIFEST`는 저장소 매니페스트를 가리킨다.
`MODEL_ROOT`의 `hf/`에는 가중치를 준비한다.

```bash
# 해당 컨테이너에서 패키지 설치 후, 파일이 /results에 있을 때
python /results/measure_m2.py prepare
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 python /results/measure_m2.py measure
python /results/measure_m5.py prepare
HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 python /results/measure_m5.py measure
```

작성자가 보고한 패키지 설치·문법 검사·준비·측정 명령의 종료 코드는 모두 0이다.
M2는 `outcome=ok`, M5는 `outcome=ok`와 출력 크기 256×256 검사를 통과했다.
M5의 `output_valid`는 현재 코드상 크기 검사이며 깊이 품질 검증은 아니다.
M1은 종료 코드 0, 마스크·RGBA 컷아웃 생성 및 원본 RGB 보존을 확인했다.
M1 실험 스크립트·로그는 로컬에 보관했으며 이 PR에는 결과 JSON만 포함했다.

## 해석과 한계

- 각 모델에 256×256 합성 입력 한 장을 사용한 1회 측정이다. M1 어댑터는 내부에서 1024×1024로 리사이즈한다.
- RSS는 `resource.getrusage(RUSAGE_SELF).ru_maxrss`로 읽은 프로세스 최고 상주 메모리다.
  패키지 import·적재·추론을 포함하며 Docker 전체 메모리나 스왑을 합친 사용량이 아니다.
- 모델을 각각 별도 프로세스로 실행했다. 워커 하나에 여러 모델을 함께 적재하는 상황은 검증하지 않았다.
- 기존 M1 메모리 기록만으로 이 PC에서 실행 불가라고 판단했으나, 가상환경에서 실제 성공해 그 판단을 정정했다.
- M1 추론은 현재 `serving/config/limits.yaml`의 split 제한 60초를 초과했다.
  어댑터 직접 호출의 성공을 현재 서비스 제한 내 성공으로 해석하지 않는다.
- M2·M5의 개별 CPU 실행 가능성은 확인했다. 실제 사진 품질·평균 성능·최대 입력·DB 작업 큐 전체 흐름은 미검증이다.
- M1 Linux 컨테이너 실행과 컨테이너 전체 메모리 측정은 남아 있다. #16을 자동 종료하지 않는다.

제품 코드·모델 가중치·비밀값은 이 PR에 포함하지 않았다.
