# D M7 TripoSR 보완 사항 2건 (Apple GPU·MPS 동작 조건)

> 기록: 2026-09-29(D 시험기록을 바탕으로 정리) · Studio-B.local(Apple M1 Ultra, CUDA 없음)
> 근거: `docs/D/D_M7_TripoSR_시험기록.md` §1 결론 · §5-3 MPS 호환성 · §6 #1·#2
> 대상: T131 어댑터 `serving/adapters/m7_triposr.py`(A 담당) · worker-gpu(MPS)
> 범위: 정리만 했다. 서빙 코드·공식 코드(`models/m3/TripoSR-src/`)는 바꾸지 않았다.

## 요약

TripoSR는 이 서버의 MPS에서 **보완 2건을 전제로** 돌아간다. 보완 없이 그대로 돌리면 예제 4장이 모두 실패하고, 2건을 모두 넣으면 4장 모두 GLB가 나온다(한 장 약 6초).

| # | 보완 | 막히는 곳 | 증상 | 조치 | 상태 |
|:--:|---|---|---|---|---|
| ① | MPS 연산 대체 켜기 | 추론(DINO 이미지 인코더) | `NotImplementedError: aten::upsample_bicubic2d.out` (MPS에 없음) | `PYTORCH_ENABLE_MPS_FALLBACK=1` | 서빙에 이미 있음(M5 때문에) — 적재 순서만 지키면 된다 |
| ② | 메시 추출 입력을 CPU로 넘기기 | 메시 추출(`torchmcubes`) | `RuntimeError: vol must be a CPU tensor` | `marching_cubes` 입력을 `.cpu()`로 넘기는 감싸기 | **어댑터에 새로 넣어야 한다** |

---

## 보완 ① MPS 연산 대체(`PYTORCH_ENABLE_MPS_FALLBACK=1`)

### 문제

- TripoSR 이미지 인코더(`facebook/dino-vitb16`)가 위치 임베딩을 입력 크기에 맞춰 보간할 때 `aten::upsample_bicubic2d.out`을 쓴다. 이 연산은 torch 2.4.1 MPS에 구현돼 있지 않다.
- 결과: 추론 단계(`model(image)`)에서 **4장 모두 실패**(시험기록 §5-3 ①).
- M5 Depth Anything V2(DINOv2 위치 임베딩 보간)에서 이미 만난 문제와 **같은 원인**이다.

### 조치

- 환경 변수 `PYTORCH_ENABLE_MPS_FALLBACK=1` — MPS에 없는 연산만 CPU로 돌리고 나머지는 MPS에서 돈다.
- 서빙은 이미 `serving/adapters/__init__.py` 5행에서 켠다:

  ```python
  os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
  ```

### 적용 시 지킬 것

| 항목 | 내용 |
|---|---|
| 적재 순서 | **torch를 처음 import하기 전에** 정해져야 한다. M7 어댑터는 `serving.adapters` 패키지 아래에 두어 `__init__.py`가 먼저 실행되게 한다. 어댑터 모듈을 단독으로(패키지 밖에서) import하는 시험·스크립트는 직접 환경 변수를 준다 |
| pm2 | `worker-gpu` 설정에 같은 환경 변수를 명시해 두면 import 순서에 기대지 않아도 된다(권장, 이중 안전) |
| 성능 영향 | 대체되는 연산은 보간 1곳뿐이다. MPS 추론 약 0.45초(워밍업 뒤) — CPU(약 1.8초)보다 약 4배 빠르다(시험기록 §5-4·5-5) |
| 확인 | 적재 후 한 장 추론이 `NotImplementedError` 없이 끝나는지 `/ready` 점검 또는 어댑터 시험에 넣는다 |

---

## 보완 ② 메시 추출 입력을 CPU로 넘기기

### 문제

- 메시 추출(`TSR.extract_mesh` → `MarchingCubeHelper.forward`)은 `torchmcubes.marching_cubes`를 부른다. `torchmcubes`는 이 서버에서 **CPU 전용으로만 빌드**된다(CUDA 없음, MPS 지원 없음).
- 공식 코드(`tsr/models/isosurface.py`)는 CPU 대체를 **CUDA 미빌드 경우(`AttributeError`)만** 처리한다:

  ```python
  try:
      v_pos, t_pos_idx = self.mc_func(level.detach(), 0.0)
  except AttributeError:   # CUDA 미빌드일 때만 CPU로 다시 시도
      v_pos, t_pos_idx = self.mc_func(level.detach().cpu(), 0.0)
  ```

- MPS 텐서를 넘기면 `RuntimeError: vol must be a CPU tensor`가 나고, 이 예외는 잡히지 않는다.
- 결과: 보완 ①만 넣으면 추론은 되지만 메시 추출에서 **4장 모두 실패**(시험기록 §5-3 ②).

### 조치

- `marching_cubes`에 넘기는 밀도 격자(`vol`)를 `.detach().cpu()`로 옮겨서 부른다. 결과 정점·면은 공식 코드가 원래 장치(`level.device`)로 되돌린다.
- **공식 코드는 고치지 않는다**(커밋 `107cefd` 그대로 두어 매니페스트의 코드 커밋과 재현성을 지킨다). 어댑터에서 감싼다.
- 시험에서 쓴 방식(`models/m3/TripoSR-test_m7.py` 9~11행):

  ```python
  import tsr.models.isosurface as _iso
  _mc = _iso.marching_cubes
  _iso.marching_cubes = lambda vol, th: _mc(vol.detach().cpu(), th)  # torchmcubes는 CPU 빌드 — MPS 텐서를 CPU로 넘긴다
  from tsr.system import TSR
  ```

### 적용 시 지킬 것

| 항목 | 내용 |
|---|---|
| 감싸는 위치 | **모듈 전역 `tsr.models.isosurface.marching_cubes`를 바꾼다.** `MarchingCubeHelper`는 `extract_mesh` 안에서 늦게 만들어지고(`set_marching_cubes_resolution`), 해상도가 바뀌면 새로 만들어진다. 그때마다 모듈 전역을 읽어 `mc_func`에 넣으므로, 인스턴스의 `mc_func`만 바꾸면 해상도 변경 뒤 감싸기가 풀린다 |
| 순서 | 감싸기는 `extract_mesh`를 처음 부르기 전에 한 번. 어댑터 적재(`load`) 단계에서 한다 |
| 장치 조건 | CPU 실행에서도 `.cpu()`는 그대로 통과하므로 장치별로 나눌 필요가 없다 |
| 시간 | 메시 추출은 CPU에서 돈다 — 한 장 약 5초(MPS 워커 기준, 해상도 256). 한 건 전체 약 6초로 `sculpture.timeout_s: 600` 안에 든다 |
| 확인 | 어댑터 시험에 "MPS에서 GLB가 나오고 다시 읽을 때 면 수가 같다"를 넣는다(시험기록 §5-4 GLB 확인 열) |

---

## 두 보완을 모두 넣었을 때(시험기록 §5-4 기준)

| 항목 | 값 |
|---|---|
| 결과 | 예제 4장(chair·hamburger·robot·실제 사진 captured) 모두 GLB 생성·다시 읽기 성공 |
| 한 장 시간 | 추론 약 0.5초 + 메시 약 5초 ≈ **6초**, 적재 3.4초 |
| 메모리 | 최대 RSS 3.8GB, 통합 메모리 포함 최대 약 8.3GB |
| CPU 대비 | 추론 약 4배, 메시 약 2.5배 빠르다 |

## 관련 환경 전제(보완 2건과 별개)

- `numpy<2`(1.26.4) 고정 — `trimesh 4.0.5`가 numpy 2에서 GLB 내보내기에 실패한다. 장치와 무관한 환경 문제라 위 2건에 넣지 않았다(시험기록 §5-3 ③·§6 #3).

## 남은 일

| 항목 | 담당 |
|---|---|
| T131 어댑터에 보완 ②(모듈 전역 감싸기) 넣기, 보완 ①은 패키지 import 순서 확인 + `worker-gpu` pm2 환경 변수 명시 | A |
| 어댑터 시험: MPS에서 추론 오류 없음 · GLB 생성·다시 읽기 | A |
| 팀원 입체 작품 사진(T118)으로 같은 조건 재측정 | A(T118·T137) |
