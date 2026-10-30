# D M3 Animated Drawings 시험 기록

> 기록: D 이진우 · 2026-09-29 · 원본 폴더 `/Users/pioneer1/project2610`, Studio-B.local(M1 Ultra, 128GB)
> 목적: 최호준(A)이 오전에 마친 M3 재현(T081)과 실제 어댑터(T072·T083)를 **다른 세션에서 다시 돌려** 같은 결과가 나오는지 확인한다. 새로 내려받지 않고, 이미 받은 파일을 검증한 뒤 시험했다.
> 관련: `docs/A_모델재현기록.md` M3 절 · research R-03 · `models/manifest.yaml` M3 · `serving/tests/test_real_m3.py`

## 1. 결론

| 항목 | 결과 |
|---|---|
| 파일 무결성 | ✅ `.mar` 2개의 SHA-256과 AD 커밋이 기록과 같다 |
| TorchServe 기동 | ✅ 127.0.0.1:9561 `Healthy`, 두 모델 적재 |
| 실제 시험 `test_real_m3.py` | ✅ **3 passed**(53.5초) |
| 관절 추출 | ✅ 2.4초, 검출 점수 0.9975, M4 `geometry_pass=True` |
| 영상 렌더 | ✅ 51.0초, MP4(H.264) 정상 |
| 눈으로 확인 | ✅ 프레임 3장에서 팔다리가 움직이고 그림 텍스처가 입혀짐 |

M3 엔진과 어댑터는 **정상 동작**한다. 다만 시험 입력은 AD 예제 그림이라 **평가 묶음 측정이 아니다**(BR-MDL-04). 팀원 그림 측정은 T118·T137에서 한다.

## 2. 대상과 위치

| 무엇 | 경로 | 비고 |
|---|---|---|
| 모델 파일 | `models/m3/model-store/drawn_humanoid_detector.mar` · `drawn_humanoid_pose_estimator.mar` | git 제외 |
| AD 소스 | `models/m3/AnimatedDrawings/` | git 제외 |
| 전용 환경 | `serving/.venv-m3/`(Python 3.8 · Java 17 · OSMesa, 1.5GB) | git 제외 |
| TorchServe 설정 | `ops/torchserve/config.properties` | 127.0.0.1:9561(예측)·9562(관리)·9563(지표), 워커 1개 |
| 어댑터 | `serving/adapters/m3_joints.py` · `m3_render.py` · `m3_ad_run.py` | |
| 시험 | `serving/tests/test_real_m3.py` | `UAM_REAL_MODELS=1`일 때만 실행 |

## 3. 파일 검증

| 파일 | 기록값(`docs/A_모델재현기록.md`) | 실측 SHA-256 | 일치 |
|---|---|---|:--:|
| `drawn_humanoid_detector.mar` | `1a2654c8…abfb` | `1a2654c8c4fc52faeeeb9cb2f12ba7ecd01f01f5aeef7ff6723cd0a18133abfb` | ✅ |
| `drawn_humanoid_pose_estimator.mar` | `40ebdc69…e42f` | `40ebdc69f1727dfe475161ae751fb066013e590f8894fe0016f0b69b336ee42f` | ✅ |
| AD 저장소 커밋 | `b859684857519c7424da51a0b0862fbd1fd258f4` | `b859684857519c7424da51a0b0862fbd1fd258f4` | ✅ |

## 4. 절차

```bash
# 1) TorchServe 기동 (시험 전 9561~9563 사용 중인 프로세스 없음 확인)
E=$PWD/serving/.venv-m3; export JAVA_HOME=$E/lib/jvm PATH="$E/bin:$E/lib/jvm/bin:$PATH"
mkdir -p serving/.run/torchserve && cd serving/.run/torchserve
torchserve --start --ncs --ts-config ../../../ops/torchserve/config.properties \
  --model-store ../../../models/m3/model-store --models drawn_humanoid_detector.mar drawn_humanoid_pose_estimator.mar
curl -s http://127.0.0.1:9561/ping          # {"status": "Healthy"}
curl -s http://127.0.0.1:9562/models        # 두 모델

# 2) 실제 시험
cd serving
UAM_REAL_MODELS=1 M3_AD_PYTHON=$PWD/.venv-m3/bin/python M3_AD_ROOT=$PWD/../models/m3/AnimatedDrawings \
TORCHSERVE_URL=http://127.0.0.1:9561 .venv/bin/python -m pytest -q -s tests/test_real_m3.py

# 3) 결과 영상 확인 — 어댑터로 한 번 더 렌더해 임시 폴더에 남기고 ffmpeg로 0·80·160번째 프레임을 이어 붙임

# 4) 정리 — 시험 전에 꺼져 있었으므로 다시 끔(공유 서버 메모리 약 2GB 반환)
torchserve --stop
```

입력 그림: `models/m3/AnimatedDrawings/examples/drawings/garlic.png`(AD 저장소 예제, 4032×3024).

## 5. 결과

### 5-1 시험 3건

| 시험 | 확인 내용 | 결과 |
|---|---|---|
| `test_joints_real` | 관절 추출 `outcome=ok`, 점수 > 0.9, skeleton 16점, 긴 변 1000px | ✅ 2.4초, 점수 0.9975, M4 `geometry_pass=True` |
| `test_render_real` | 렌더 `outcome=ok`, 결과가 MP4(`ftyp`)이고 최소 크기 이상 | ✅ 51.0초, `diag=None` |
| `test_torchserve_loopback_only` | 설정 파일의 9561·9562·9563이 모두 `127.0.0.1`이고 `/ping`이 `Healthy`(BR-SRV-04) | ✅ |

전체 53.5초(real 53.98초 · user 239.32초 · sys 80.50초). 렌더 중 CPU를 여러 코어 쓴다.

### 5-2 결과 영상

| 항목 | 값 |
|---|---|
| 형식 | MP4, H.264 High, yuv420p |
| 크기 | 500×500, 24fps, 약 581kb/s |
| 파일 크기 | 749,003바이트 |
| 확인 | 0·80·160번째 프레임에서 두 팔과 두 다리의 위치가 서로 달라 움직임이 보이고, 원본 그림의 선·색이 그대로 입혀져 있다 |

### 5-3 기존 기록과 비교

| 항목 | 최호준 T081(재현) | 최호준 T072·T083(어댑터) | 이 시험 |
|---|---|---|---|
| 관절 | 7.2~9.1초 | 2.8~8.0초 | **2.4초** |
| 렌더 | 125.5초(GIF) | 59.1~108초(MP4) | **51.0초(MP4)** |
| 점수 | 0.998 | 0.998 | 0.9975 |

같은 그림에서 같은 결과가 나왔다. 시간은 호스트 부하에 따라 달라지며, 시간 상한 `animate_render.timeout_s: 600`(limits.yaml) 안에 여유 있게 들어온다.

## 6. 서비스 안의 상태 (같은 날 후속 확인)

시험 뒤 p1 배포로 pm2 서비스가 켜졌다(11:24~). 그 상태를 읽기만 해서 확인했다.

| 항목 | 상태 |
|---|---|
| pm2 `torchserve` | online, 127.0.0.1:9561 `Healthy` |
| 워커 설정 | `UAM_FAKE_MODELS=0`(실제 모델), `M3_AD_PYTHON`·`M3_AD_ROOT`·`TORCHSERVE_URL` 들어가 있음 |
| model-api `/internal/models`의 M3 | **활성 버전 없음, `licenseConfirmed=false`** |

그래서 엔진은 떠 있어도 **워커가 M3를 부르지 않는다**(활성 버전·라이선스 확인이 없는 모델은 부르지 않음, BR-MDL-01·07). 실제 작품 처리에 쓰려면 다음 순서가 필요하다.

1. `docs/A_모델_라이선스_확정.md` §4 팀 확정 칸 채우기(M3 권고: 켬, 내부망 격리 조건)
2. 후보 버전 등록 — app-api `POST /v1/admin/models/M3/versions`(SD_04 §9-2)
3. 평가(G21) → 승격(G22)

## 7. 한계와 남은 일

| 항목 | 내용 | 담당 |
|---|---|---|
| 입력 그림 | AD 예제 한 장뿐. 팀원 그림 측정·처리 시간 p95·오인율은 T118 → T137 | A |
| 활성화 | 라이선스 팀 확정 → 등록 → 평가 → 승격 | 팀 · 평가 담당 |
| 렌더 속도 | OSMesa(CPU 소프트웨어 렌더)라 개인 PC Docker(렌더 약 40초)보다 느릴 수 있다. 동시 처리 1 유지(limits.yaml) | A |
| 보안 | 개발이 중단된 엔진이라 보안 수정이 없다. 127.0.0.1에만 열고 외부 `pose` 기능은 팀 내부 키만(BR-MDL-06, D17) | — |
