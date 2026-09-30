# API활용 메뉴 — 가이드라인 · 매뉴얼 본문 (S12 탭 원천)

> 작성: 2026-09-29 B 이제민 · 쓰는 곳: 운영 화면 S12 "가이드라인"·"매뉴얼" 탭(`web/src/ops/apiGuideContent.ts`가 이 문서를 그대로 옮긴다) · 근거: UC11 §1 표(BR-API-07), `serving/config/limits.yaml`, `serving/config/ext-limits.yaml`, `ops/DEPLOY.md`
> 값이 바뀌면 이 문서 → 화면 순서로 고친다. `[예시값]`은 U12 확정 전 값이다.

## 가이드라인 — 부르는 규칙

1. **서빙 3종**: CPU 비전 워커(분리·판정·움직임), GPU 워커(깊이 부조·3D, GPU가 없으면 CPU), LLM 서버(설명, P0.5). 모델 기능 API는 `/v1/models/{function}`(model-api :9541)로만 부른다 — 내부 런타임(TorchServe 9561~9563, Ollama 11434, llm-server 8200)은 내부망 전용이다(BR-SRV-04).
2. **비동기 호출**: 기능 호출은 202와 작업 번호를 돌려준다. `GET /v1/models/jobs/{id}`로 상태를, `…/result`로 결과를 받는다. 결과는 1시간 보관 뒤 지워진다(D8).
3. **재시도와 낮춤은 다르다**: 인프라 실패(엔진 다운·시간 초과·저장소·DB·모델 미준비)는 서버가 최대 3회(10초·60초 간격) 다시 시도한다. 품질 미달은 다시 시도하지 않고 낮은 결과로 바꾼다(움직임 → 2.5D → 액자). 둘은 지표에서 따로 센다(BR-PRC-02·03).
4. **단계별 시간 상한**: 분리 60초 · 판정 120초 · 움직임 렌더 600초 · 깊이 부조 180초(CPU 600초) · 액자 10초 · 3D 600초 · 설명 30초. 모델 적재는 300초.
5. **외부 호출 한도** `[예시값]`: 키당 분당 30회 · 하루 1000회 · 동시 2건, 이미지 한 장 20MB(JPEG·PNG·HEIC). 넘으면 429·413(G24).
6. **인증**: `X-API-Key`(해시만 저장). 키 종류 team_internal·course_internal·external·test. `pose`는 팀 내부·시험 키만. 키는 운영 CLI로만 발급·폐기한다.
7. **입력 비보존·가족 데이터 차단**: 외부 입력은 결과 보관 기간이 지나면 지운다. 가족 작품 ID로는 부를 수 없고, 결과는 가족 저장소에 쓰지 않는다(BR-API-05·06).
8. **로그 금지**: 이메일·토큰·별칭·파일 경로·이미지·원문 텍스트를 로그에 남기지 않는다. 허용 목록(요청 번호·경로·상태·코드·단계·모델·버전·결과·시간)만(BR-PRV-01).
9. **라이선스**: 라이선스 팀 확정 전 모델은 활성화·호출할 수 없다(G22·G25, BR-MDL-07).

## 매뉴얼 — 켜고 바꾸고 고치기

1. **기동**: `pm2 start ops/p1/ecosystem.config.cjs && pm2 save` — app-api(9521)·model-api(9541)·worker-cpu·worker-gpu·sweeper·p1-nginx(9501)·mailpit·torchserve. 재부팅 뒤에는 `pm2 resurrect`(pm2 startup 미설정).
2. **상태 보기**: 운영 화면 S10 상태·지표, 또는 `curl https://<도메인>/ready`.
3. **웹 배포**: `ops/p1/deploy-web.sh`(main 커밋을 빌드해 교체). **API 배포**: `cd api && npm run build && pm2 reload app-api sweeper`.
4. **모델 파일 경로**: `MODEL_ROOT`(비우면 `<저장소>/models`). HF 캐시 `models/hf/`, M3 `models/m3/`.
5. **GPU 설정**: `GPU_ENABLED=true`(Studio-B는 Apple GPU·MPS). GPU가 없으면 false — 깊이 부조는 CPU로, 3D는 비노출(BR-SRV-02).
6. **모델 교체(UC9)**: 후보 등록(`python -m ops.models register <M>` 출력 JSON → `POST /v1/admin/models/<M>/versions`) → S11 평가 요청 → 판단 기록 → 승격. 문제가 생기면 S11 롤백(후보 없으면 비활성화).
7. **키 발급**: `npm run ops:key -- issue --kind <종류>` — 원문은 한 번만 보인다. 시험 호출용 test 키는 app-api 환경 변수 `API_GUIDE_TEST_KEY`에 둔다.
8. **장애 대응**: S10에서 "미준비·적재 실패" 모델은 S11 [지금 불러오기]. 결과 미도달이 생기면 S10 미도달 탭(운영자)에서 단계 작업 번호·오류 분류를 보고 해당 프로세스 로그(`pm2 logs <이름>`)를 확인한다.
