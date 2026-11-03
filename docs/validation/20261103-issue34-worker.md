# #34 가짜 모델 worker·준비 상태 확인

## 환경

2026-11-03, Windows Docker Desktop / WSL Ubuntu, Linux amd64. #77 + #84, 파일 기반 임시 secrets, 분리된 compose 프로젝트·볼륨·포트 19501/18025. 시험 뒤 컨테이너와 시험 볼륨을 정리했다. 실제 모델 가중치를 받거나 실행하지 않았다.

## 결과

- 가입과 메일 확인, 아이 생성 후 합성 PNG 업로드 202. split·judge 각각 done, relief 확정 후 depth_relief done, like 결정 200 및 `hungResultKind=relief`.
- 실행 중 model-api `/internal/ready`: `groups.cpu=true`, M1·M2·M3·M5가 ready.
- `docker compose stop worker-cpu` 이후 `groups.cpu=false`. 정상 중단 시 워커가 자기 상태 파일을 지우는 경로다. 강제 종료 후 상태 파일이 60초 지나 만료되는 경로는 이번에 측정하지 않았다.
- 워커 중단 상태에서 model-api의 `POST /internal/models/M1/warmup` → 202. 공유 폴더 `/data/run/warmup/M1` 파일 생성을 확인하고 worker-cpu를 다시 시작한 후 파일이 사라지는 것을 확인했다. 이는 요청 파일을 worker가 소비한 결과이며 별도의 실제 모델 적재 측정은 아니다.

## 재현에 쓰인 핵심 명령

```bash
docker compose -p <시험프로젝트> stop worker-cpu
docker compose -p <시험프로젝트> exec model-api python -c 'import urllib.request; print(urllib.request.urlopen("http://localhost:9541/internal/ready").read().decode())'
docker compose -p <시험프로젝트> exec model-api python -c 'import urllib.request; print(urllib.request.urlopen(urllib.request.Request("http://localhost:9541/internal/models/M1/warmup", data=b"", method="POST")).status)'
docker compose -p <시험프로젝트> exec model-api test -f /data/run/warmup/M1
docker compose -p <시험프로젝트> start worker-cpu
docker compose -p <시험프로젝트> exec model-api test ! -f /data/run/warmup/M1
```

마지막 파일 검사는 워커의 주기적 처리 뒤에 확인한다. 위 시험은 #84의 활성 행 생성이 선행된 상태였다.
