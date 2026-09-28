# Specification Quality Checklist: 우리 아이 미술관 (v2.0 — P0 / P0.5 / P1)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-23
**Last Updated**: 2026-09-28
**Feature**: [spec.md](../spec.md) (v2.0 Draft)

## Content Quality

- [ ] No implementation details (languages, frameworks, APIs) — 의도적 예외 있음(아래 Notes 참조)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [ ] No [NEEDS CLARIFICATION] markers remain — 공통 미해결 U1~U18, 18건 남음(U16~U18은 통합 결정 D15에서 추가)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [ ] Success criteria are technology-agnostic (no implementation details) — 매니페스트 필드, `/openapi.json` 일치, 모델 ID(M1~M7) 기준 항목이 있음
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded — P0 / P0.5 / P1 / 후속 구간으로 나눔
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria — FR-1~FR-30 모두 수용기준 있음
- [x] User scenarios cover primary flows — 시나리오 19개(P0 16, P0.5 2, P1 1)
- [ ] Feature meets measurable outcomes defined in Success Criteria — 모델별 품질 임계값(U5)과 처리 시간 상한(U6)이 미측정이라 일부 목표는 측정 뒤 확정
- [ ] No implementation details leak into specification — 첫 항목과 같은 의도적 예외

## Model & Serving Coverage (v2.0 추가)

- [x] 모델 카탈로그 M1~M7의 역할·채택/예비·라이선스·서빙군·구간이 Dependencies에 있음
- [x] 제외·후순위 모델(Hunyuan3D, Depth Anything V2 Base·Large, Stable Fast 3D)이 명시됨
- [x] 서빙 3종(CPU 비전 워커 · GPU 워커 · LLM 서버)과 GPU 부재 시 동작이 정해짐(FR-25)
- [x] 낮춤 체인(움직임→2.5D→액자, 3D→2.5D→액자, LLM 설명→템플릿→직접 입력)이 고정됨(FR-23)
- [x] 인프라 장애(최대 3회 재시도)와 모델 낮춤이 분리됨(FR-5)
- [x] 결과 원인 5분류(보호자 선택·모델 낮춤·보호자 전환·인프라 실패·결과 미도달)가 FR·지표·엔티티에 일관되게 쓰임
- [x] 2.5D 마스크 출처 규칙(M1 기본, M1 실패 시 액자)이 있음(FR-22)
- [x] 판정은 제안까지만, 점수 비노출, 보호자 확정값으로 경로 결정(FR-3, FR-21)
- [x] 서빙 지표가 Intent [미션] 서빙 지표 정의를 따르고, 정의·검증 계획으로 표시됨(FR-13, FR-26)
- [x] 삭제 범위에 마스크·깊이·설명·GLB가 포함됨(FR-10)
- [x] 준비 상태가 모델별로 표시됨(FR-12)
- [x] 외부 LLM 전송 금지와 설명 입력 제한(이미지·이름 제외)이 있음(FR-14, FR-27)
- [x] P0.5(FR-27, FR-28)·P1(FR-29) 요구사항에 구간 표시가 있고, P1은 GPU 확인 전 비노출
- [x] 라이선스 미확인 모델은 활성화하지 않는 규칙이 있음(FR-24)
- [x] 서비스 이름이 "우리 아이 미술관"으로 통일됨(옛 이름은 개정 이력에서 한 번만 언급)

## Notes

- 검증 1회차(2026-09-23, v1.0): 15개 항목 중 14개 통과, 1개 미결(FR-9 [NEEDS CLARIFICATION]).
- 검증 2회차(2026-09-28, v2.0): 기본 16개 항목 중 12개 통과, 4개 미통과. v2.0 추가 15개 항목은 모두 통과.
  - **구현 세부 사항의 의도적 예외**: v2.0은 "공개 사전학습 모델을 이어 붙여 서빙한다"는 것이 제품의 본질이므로, 모델 이름·라이선스·서빙 구조를 Dependencies와 FR-16·FR-24·FR-25에 적었다. FR-30의 "Python 가상환경 + uvicorn"과 'API활용' 메뉴는 추가 요구 R3·R4를 그대로 옮긴 요구사항이다. `/v1/models/{…}`, `/live`, `/ready`, `/metrics`, `/openapi.json`은 Intent·공통 기준에서 가져온 경로이며 최종 이름은 `/speckit.plan`에서 확정한다(U8). 보호자 앱 API의 언어·프레임워크·DB는 명세에 넣지 않고 U7로 남겼다.
  - **미해결 18건(U1~U18)**: `/speckit.clarify`로 답을 받을 항목은 U1(가족 계정 모델), U10(판정 제안 문구·지연 화면)이다. U7·U8·U9·U17·U18은 `/speckit.plan`에서, U2·U6·U14는 팀 서버 재현 시험에서, U5·U11은 평가 묶음 1차 측정 뒤, U3·U4·U12·U13·U15·U16은 외부 조건 확인이나 해당 구간 착수·운영 전에 정한다.
  - **통합 결정 반영**: 공통 기준 §11의 D1~D14(재시도 횟수 정의, 결과 미도달 적용 단계, 삭제 중 과도 상태, 승격·롤백 규칙, 설명 표시·비저장, 외부 입력 임시 보관, 3D 노출 설정, 결정 1회 반영, 시험 호출 P0.5, 첫 결과 승인율 분모)를 `[추론 — 통합 결정 Dn]`으로 표시해 반영했다.
  - `/speckit.plan`으로 넘어가기 전에 최소한 U1과 U10을 해소한다. 나머지는 계획·측정 단계에서 해소할 수 있으나, 해소 전까지 관련 수용기준은 "미확정"으로 둔다.
- 목표값 중 움직임 경로 p95 3분, 액자 경로 p95 30초, 완료율 80%, 조작 시간 3분, 다시 찾기 30초는 v1.0의 **잠정 검증 목표**를 이어받은 것이며 원천에 없는 값이다. Success Criteria에 "(v1.0 잠정)"으로 표시했다.
- `[추론]` 표시 항목(제안 지연 시 직접 확정, "제안 없음" 기록, 낮춘 결과로 걸기 시 2.5D 후속 생성, 액자·2.5D의 좋아요 선택지, 재생성 상한 2회, 판정 수정률·설명 규칙 검사 실패율의 분모 등)은 `/speckit.clarify` 또는 `/speckit.plan`에서 확인한다.
