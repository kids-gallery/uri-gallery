# 우리아이미술관 UI 실행 계약

현행 소스 기준 142개 template 제어요소를 추적한 문서다. v-for 인스턴스 수나 UI 시험 통과 수가 아니다. 이번 작업은 문서/JSON만 보완했으며 제품 수정·새 브라우저 시험·커밋·push를 하지 않았다. 300개 단위 테스트 통과를 이 142개 UI 전수 통과로 환산하지 않는다. 각 검증 절차는 다음 담당자가 실행할 명세이며 모두 NOT_RUN_THIS_REVISION이다. 기존 핵심12개 설명만으로 전수 계약이 완성되었다던 인상을 정정한다.

## 먼저 읽을 현행 결함과 정정

- WorldArchive-009는 버튼 click이 아니라 상위 form submit.prevent→saveInfo→updateArtworkInfo→saveArtworkAndRoom이다. updated emit의 부모 reload는 별도 Promise다.
- WorldAvatar-015는 emit save→부모 saveAvatar→store.savePrefs→IndexedDB prefs 저장→토스트/closePanel이다. 저장중 버튼 비활성/중복 가드가 없다.
- WorldView-045는 account.value를 DB 저장 전에 바꾸며 실패시 rollback하지 않는다. WorldView-011 소리도 같은 종류의 메모리/저장값 불일치 위험이 있다.
- WorldUpload-006 처리 실패는 pick 화면으로 돌아간다. 사라진 배경 버튼을 다시 누르라는 이전 공통 문구는 틀렸다.
- WorldAvatar-007은 방향키0.01/포인터 드래그이며 Enter/Space 이동이나 핀치 편집이 아니다. 28px 관절점을44px완료로표현하지 않는다.
- 현행 E: engine.onKeyDown(KeyE)→interact→faceWork→onSelect→onView→WorldView.openView. 작품 직접 클릭은 명패 선택, E는 가까이 보기까지 연다. 가까이보기/퍼즐의 원본보기는 display 축소본이며 원본바이트 다운로드는 WorldArchive-013이다. 목표 UX와 섞어쓰지 않는다.
- 보관함 저장중 ESC, 가까이보기 이야기 저장중 닫기, 모드 전환중 닫기는 진행중 Promise를 취소하지 않는다. 모든 취소가 원상복구라고 일반화하면 안 된다.
- 원본 다운로드의 실패 UI, account/sound rollback, 모든 비동기 요청의 중복 차단, 관절/도화지 완전한 키보드 대체는 현행에 일괄 구현되어 있지 않다.
- resetAll은 모든 로컬store를 각각 지운다. 이름이 테스트 자료 지우기여도 현재가족만/견본만 지운다는 계약이 아니다. 부분실패 rollback없음. 실제 사용자자료로 시험하지 않는다.

## 적용 범위와 다음 AI의 작업 지침

현행은 아래 계약의 코드 근거로 판단한다. 개선 목표(44px 터치영역, 저장중 안전취소/중복차단, 실패 rollback 등)는 미구현 과제로 별도 승인 후 구현한다. 문서의 기대 결과가 결함 재현을 포함할 수 있으며 이를 기능 합격으로 표시하지 않는다. 오류 주입은 격리 테스트만 사용하고 제품 소스를 문서 검증 때문에 바꾸지 않는다. sourceEvidence는 로컬 미커밋 구현 스냅샷에 대한 행 번호다. HEAD는1d89bd55이지만 해당HEAD원본과 동일 코드라는 뜻은 아니다.

## 공통 규약과 구현 한계

### focus

WorldView watch(panel): 열 때 첫 활성 button 또는 input에 focus; Tab/Shift+Tab은 보이는 dialog 제어요소에서 순환. 닫으면 연결된 원래 트리거, 재생성된 같은 글자 명패 버튼, 마지막으로 사용법/더보기 순서로 복귀 시도. 각 내부 탭/확인영역 전환에는 별도 focus 이동 코드 없음. 모바일 가상키보드·스크린리더 복귀는 미검증.

### archive

ESC는 WorldView.closePanel 직접 호출. 닫기 버튼은 busy=info일 때 disabled지만 ESC에는 같은 guard 없음. 입력 수정 후 ESC/작품전환은 미저장 확인 없음. 저장 중 ESC도 진행 중 Promise를 abort하지 않음.

### avatar

ESC/닫기/그만두기는 closePanel에서 저장된 prefs의 아바타를 engine.setAvatar로 복원 후 닫음. Promise rejection catch 없음. 저장 emit은 await되지 않으며 취소로 이미 시작된 저장을 중단하지 못함.

### upload

ESC/닫기는 requestClose. working/saving은 무동작, file 있으면 confirmDiscard, 없으면 emit close. 계속 보관하기는 확인만 닫음; 보관하지 않고 닫기는 초안 폐기. 파일 선택창 취소와 패널 닫기는 구별.

### play

ESC/닫기는 leave. busy이면 무동작, strokes 있으면 confirmLeave. 계속 그리기는 draw 복귀, 보관하지 않고 닫기는 pendingDraft 완료 후 deleteDraft 시도. 삭제실패를 숨기고 닫아 다음에 초안이 복원될 수 있음.

### social

ESC/닫기는 closePanel. inviteToken 있으면 URL을 /app/world로 정리. create/accept/cancel/unlink 진행 중 요청 취소 없음. 확인 취소는 관계를 보존하나 확정 완료 후 되돌리기는 없음.

### settings

ESC/닫기는 closePanel로 panel=null,confirmReset=false. 이름/나이 미저장 초안 폐기. 이미 시작한 saveChild/resetAll 취소·rollback 기능 없음.

### view

ESC/닫기는 closeView에서 display URL revoke 후 panel=null. storyDraft 미저장 확인 없음. 저장 진행 중 닫기/ESC 차단 없음; 이미 시작한 DB 작업은 계속될 수 있음.

### theme

ESC/닫기는 선택을 되돌리지 않음. 모드/양식은 각 선택 때 즉시 저장. changeScene 중 닫기 허용이며 작업 취소 없음.

### hud

대화상자 없는 HUD에서는 WorldView.onKey가 ESC를 처리하지 않음. 해당 버튼에 취소 동작이 없다면 자동 되돌림을 기대하지 않는다. 패널을 여는 버튼은 focus 규약 적용.

### errors

아래 오류 주입은 향후 격리 테스트용 명세이며 이번에 실행하지 않음. 제품파일 수정 없이 테스트 하네스의 모듈 mock/spy 또는 테스트용 IndexedDB adapter에서 명시 호출을 1회 reject하거나 거래 abort. 실제 가족 DB 삭제·네트워크 차단으로 흉내내지 않음. 코드에 catch/복구가 없으면 실패 UI를 가정하지 않고 거절/부분완료를 관찰한다.

### mobile

이번 수정은 정적 코드 확인. 실제 휴대폰 테스트도 142개 전수 브라우저 테스트도 하지 않았다. 아래 CSS/입력 계약은 구현 근거이며 실기 통과 표시가 아니다.

## ID 대응표

|기존 Markdown ID|JSON 안정 ID|이름|소스|
|---|---|---|---|
|UI-001|WorldArchive-001|닫기|WorldArchive.vue:129|
|UI-002|WorldArchive-002|draft.title|WorldArchive.vue:153|
|UI-003|WorldArchive-003|{{n}} 세|WorldArchive.vue:154|
|UI-004|WorldArchive-004|draft.madeOn|WorldArchive.vue:155|
|UI-005|WorldArchive-005|그림 만들기|WorldArchive.vue:156|
|UI-006|WorldArchive-006|{{s.label}}|WorldArchive.vue:157|
|UI-007|WorldArchive-007|draft.material|WorldArchive.vue:158|
|UI-008|WorldArchive-008|draft.words|WorldArchive.vue:159|
|UI-009|WorldArchive-009|{{busy==='info'?'저장 중…':'추억 저장'}}|WorldArchive.vue:160|
|UI-010|WorldArchive-010|취소|WorldArchive.vue:160|
|UI-011|WorldArchive-011|제목·추억 고치기|WorldArchive.vue:163|
|UI-012|WorldArchive-012|{{busy === 'glb' ? '만드는 중…' : '입체 내려받기'}}|WorldArchive.vue:164|
|UI-013|WorldArchive-013|원본 내려받기|WorldArchive.vue:165|
|UI-014|WorldArchive-014|미술관에서 보기|WorldArchive.vue:166|
|UI-015|WorldArchive-015|지우기|WorldArchive.vue:167|
|UI-016|WorldArchive-016|지우기|WorldArchive.vue:172|
|UI-017|WorldArchive-017|그만두기|WorldArchive.vue:173|
|UI-018|WorldArchive-018|a.title // '작품' {{a.age}} 세 ·  {{a.title // defaultTitle(a.subject, a.kind)}}|WorldArchive.vue:181|
|UI-019|WorldAvatar-001|닫기|WorldAvatar.vue:90|
|UI-020|WorldAvatar-002|기본 캐릭터|WorldAvatar.vue:93|
|UI-021|WorldAvatar-003|내 그림·사진으로|WorldAvatar.vue:94|
|UI-022|WorldAvatar-004|{{o.label}}|WorldAvatar.vue:101|
|UI-023|WorldAvatar-005|`${s.label} 색 ${c}`|WorldAvatar.vue:104|
|UI-024|WorldAvatar-006|무작위|WorldAvatar.vue:111|
|UI-025|WorldAvatar-007|JOINT_LABELS[n]+' 점'|WorldAvatar.vue:119|
|UI-026|WorldAvatar-008|이름 미지정|WorldAvatar.vue:122|
|UI-027|WorldAvatar-009|{{busy ? '배경을 지우는 중…' : '사진 고르기'}}|WorldAvatar.vue:123|
|UI-028|WorldAvatar-010|a.title // '작품'|WorldAvatar.vue:128|
|UI-029|WorldAvatar-011|자동으로 다시 맞추기|WorldAvatar.vue:133|
|UI-030|WorldAvatar-012|형태를 유지하며 움직이기|WorldAvatar.vue:134|
|UI-031|WorldAvatar-013|팔다리 움직임 조정  {{advanced ? '접기' : '열기'}}|WorldAvatar.vue:135|
|UI-032|WorldAvatar-014|자동 관절로 움직여 보기|WorldAvatar.vue:138|
|UI-033|WorldAvatar-015|저장|WorldAvatar.vue:146|
|UI-034|WorldAvatar-016|그만두기|WorldAvatar.vue:147|
|UI-035|WorldFamilies-001|테스트 가족 추가|WorldFamilies.vue:10|
|UI-036|WorldFamilies-002|가족을 골라 주세요 {{f.child}}|WorldFamilies.vue:10|
|UI-037|WorldPlay-001|닫기|WorldPlay.vue:54|
|UI-038|WorldPlay-002|✎ 함께 그리기 {{restored?'그리던 그림을 이어서 그려요':'선을 하나씩 더해 우리 그림을 만들어요'}}|WorldPlay.vue:57|
|UI-039|WorldPlay-003|▧ 우리 작품 짝 찾기 같은 작품 두 장을 함께 찾아요|WorldPlay.vue:57|
|UI-040|WorldPlay-004|▦ 작품 퍼즐 우리 작품을 다시 맞춰 봐요|WorldPlay.vue:57|
|UI-041|WorldPlay-005|'그림 색 '+c|WorldPlay.vue:63|
|UI-042|WorldPlay-006|width|WorldPlay.vue:63|
|UI-043|WorldPlay-007|한 번 되돌리기|WorldPlay.vue:63|
|UI-044|WorldPlay-008|다음 사람 차례|WorldPlay.vue:65|
|UI-045|WorldPlay-009|{{busy?'그림을 보관하는 중…':'우리 그림 보관하기'}}|WorldPlay.vue:65|
|UI-046|WorldPlay-010|4쌍|WorldPlay.vue:68|
|UI-047|WorldPlay-011|6쌍|WorldPlay.vue:68|
|UI-048|WorldPlay-012|다시 섞기|WorldPlay.vue:68|
|UI-049|WorldPlay-013|flipped.includes(i)//matched.includes(c.art.id)?(c.art.title//'작품'):(i+1)+'번 카드 뒤집기'|WorldPlay.vue:69|
|UI-050|WorldPlay-014|함께 그리기|WorldPlay.vue:70|
|UI-051|WorldPlay-015|{{a.title//'우리 작품'}}|WorldPlay.vue:73|
|UI-052|WorldPlay-016|4조각|WorldPlay.vue:73|
|UI-053|WorldPlay-017|9조각|WorldPlay.vue:73|
|UI-054|WorldPlay-018|원본 보기|WorldPlay.vue:73|
|UI-055|WorldPlay-019|(i+1)+'번 자리, 그림 조각 '+(v+1)|WorldPlay.vue:73|
|UI-056|WorldPlay-020|다시 섞기|WorldPlay.vue:73|
|UI-057|WorldPlay-021|함께 그리기|WorldPlay.vue:73|
|UI-058|WorldPlay-022|다른 놀이|WorldPlay.vue:77|
|UI-059|WorldPlay-023|계속 그리기|WorldPlay.vue:78|
|UI-060|WorldPlay-024|보관하지 않고 닫기|WorldPlay.vue:78|
|UI-061|WorldSocial-001|닫기|WorldSocial.vue:16|
|UI-062|WorldSocial-002|{{copy.acceptGo}}|WorldSocial.vue:16|
|UI-063|WorldSocial-003|친구 초대 링크 만들기|WorldSocial.vue:16|
|UI-064|WorldSocial-004|이름 미지정|WorldSocial.vue:16|
|UI-065|WorldSocial-005|{{copy.cancelInvite}}|WorldSocial.vue:16|
|UI-066|WorldSocial-006|{{f.child}} 의 미술관|WorldSocial.vue:16|
|UI-067|WorldSocial-007|{{copy.unlink}}|WorldSocial.vue:16|
|UI-068|WorldSocial-008|끊기|WorldSocial.vue:16|
|UI-069|WorldSocial-009|그만두기|WorldSocial.vue:16|
|UI-070|WorldTestEntry-001|테스트 계정으로 들어가기|WorldTestEntry.vue:7|
|UI-071|WorldUpload-001|닫기|WorldUpload.vue:92|
|UI-072|WorldUpload-002|이름 미지정|WorldUpload.vue:97|
|UI-073|WorldUpload-003|이름 미지정|WorldUpload.vue:98|
|UI-074|WorldUpload-004|사진 찍기|WorldUpload.vue:99|
|UI-075|WorldUpload-005|앨범에서 고르기|WorldUpload.vue:99|
|UI-076|WorldUpload-006|{{removeBg ? '배경 지우기 안 함' : '배경 지우기'}}|WorldUpload.vue:111|
|UI-077|WorldUpload-007|제목·추억 더하기  {{details ? '접기' : '(선택)'}}|WorldUpload.vue:113|
|UI-078|WorldUpload-008|그림이에요|WorldUpload.vue:118|
|UI-079|WorldUpload-009|만들기예요|WorldUpload.vue:119|
|UI-080|WorldUpload-010|{{s.label}}|WorldUpload.vue:128|
|UI-081|WorldUpload-011|title|WorldUpload.vue:133|
|UI-082|WorldUpload-012|{{m}}|WorldUpload.vue:138|
|UI-083|WorldUpload-013|재료 직접 적기|WorldUpload.vue:140|
|UI-084|WorldUpload-014|{{n}} 세|WorldUpload.vue:145|
|UI-085|WorldUpload-015|madeOn|WorldUpload.vue:147|
|UI-086|WorldUpload-016|words|WorldUpload.vue:151|
|UI-087|WorldUpload-017|{{step === 'saving' ? '보관하는 중…' : '이대로 보관하기'}}|WorldUpload.vue:157|
|UI-088|WorldUpload-018|다른 사진|WorldUpload.vue:158|
|UI-089|WorldUpload-019|계속 보관하기|WorldUpload.vue:162|
|UI-090|WorldUpload-020|보관하지 않고 닫기|WorldUpload.vue:162|
|UI-091|WorldView-001|들어가기|WorldView.vue:392|
|UI-092|WorldView-002|밖으로|WorldView.vue:393|
|UI-093|WorldView-003|작품 남기기|WorldView.vue:394|
|UI-094|WorldView-004|함께 놀기|WorldView.vue:395|
|UI-095|WorldView-005|{{moreTools?'접기':'더보기'}}|WorldView.vue:396|
|UI-096|WorldView-006|사용법|WorldView.vue:398|
|UI-097|WorldView-007|보관함|WorldView.vue:399|
|UI-098|WorldView-008|캐릭터|WorldView.vue:400|
|UI-099|WorldView-009|모드|WorldView.vue:401|
|UI-100|WorldView-010|전시실 추가|WorldView.vue:402|
|UI-101|WorldView-011|{{prefs?.sound ? '소리 끄기' : '소리 켜기'}}|WorldView.vue:403|
|UI-102|WorldView-012|설정|WorldView.vue:404|
|UI-103|WorldView-013|미술관 마을|WorldView.vue:405|
|UI-104|WorldView-014|친구 초대|WorldView.vue:406|
|UI-105|WorldView-015|우리 미술관으로|WorldView.vue:407|
|UI-106|WorldView-016|{{b.child}}|WorldView.vue:412|
|UI-107|WorldView-017|들어가기|WorldView.vue:412|
|UI-108|WorldView-018|한 장 더 남기기|WorldView.vue:414|
|UI-109|WorldView-019|보관한 작품 보기|WorldView.vue:414|
|UI-110|WorldView-020|미술관에서 만나기|WorldView.vue:414|
|UI-111|WorldView-021|닫기|WorldView.vue:414|
|UI-112|WorldView-022|가까이 보기|WorldView.vue:423|
|UI-113|WorldView-023|움직이기|WorldView.vue:424|
|UI-114|WorldView-024|들려주기|WorldView.vue:425|
|UI-115|WorldView-025|대표작으로 걸기|WorldView.vue:426|
|UI-116|WorldView-026|보관함에서 보기|WorldView.vue:428|
|UI-117|WorldView-027|storyDraft|WorldView.vue:443|
|UI-118|WorldView-028|이야기 남기기|WorldView.vue:448|
|UI-119|WorldView-029|닫기|WorldView.vue:449|
|UI-120|WorldView-030|닫기|WorldView.vue:459|
|UI-121|WorldView-031|E   {{interaction.label}}|WorldView.vue:462|
|UI-122|WorldView-032|사용법|WorldView.vue:467|
|UI-123|WorldView-033|닫기|WorldView.vue:467|
|UI-124|WorldView-034|손 흔들기|WorldView.vue:474|
|UI-125|WorldView-035|춤|WorldView.vue:474|
|UI-126|WorldView-036|점프|WorldView.vue:474|
|UI-127|WorldView-037|시점 되돌리기|WorldView.vue:486|
|UI-128|WorldView-038|닫기|WorldView.vue:486|
|UI-129|WorldView-039|{{t.label}} {{t.note}}|WorldView.vue:494|
|UI-130|WorldView-040|미술관 밝은 전시실, 고른 모드의 모습|WorldView.vue:502|
|UI-131|WorldView-041|대성당 고른 모드의 재료와 동선을 유지한 높은 특별전시 홀|WorldView.vue:503|
|UI-132|WorldView-042|닫기|WorldView.vue:505|
|UI-133|WorldView-043|childName|WorldView.vue:514|
|UI-134|WorldView-044|{{n}} 세|WorldView.vue:516|
|UI-135|WorldView-045|저장|WorldView.vue:518|
|UI-136|WorldView-046|미술관 모양|WorldView.vue:519|
|UI-137|WorldView-047|로비로 가기|WorldView.vue:522|
|UI-138|WorldView-048|{{hasSamples ? '견본 치우기' : '견본 다시 걸기'}}|WorldView.vue:523|
|UI-139|WorldView-049|테스트 자료 지우기|WorldView.vue:527|
|UI-140|WorldView-050|모두 지우기|WorldView.vue:532|
|UI-141|WorldView-051|그만두기|WorldView.vue:533|
|UI-142|WorldView-052|닫기|WorldView.vue:536|

## 요소별 상세 계약

### WorldArchive-001 · UI-001 · 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `닫기`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"class": "g-btn", "type": "button", ":disabled": "busy === 'info'", "@click": "emit('close')"}`.
- 준비/이전 상태: 보관함 열기, busy 비어 있음
- 입력: @click=emit('close') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=emit('close') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: 닫기 emit→WorldView.closePanel→panel=null. 편집 중이면 별도 미저장 확인 없이 닫힌다
- 데이터·저장 시점: DB 쓰기 없음. 미저장 draft는 컴포넌트 해제 후 소실
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldArchive.vue", "event": "close", "to": "WorldView.vue", "receiver": "closePanel", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 보관함 열기, busy 비어 있음. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. DB 쓰기 없음. 미저장 draft는 컴포넌트 해제 후 소실; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: DB 쓰기 없음. 미저장 draft는 컴포넌트 해제 후 소실 / 이 요소의 전환 후 상태: 닫기 emit→WorldView.closePanel→panel=null. 편집 중이면 별도 미저장 확인 없이 닫힌다 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 탭으로 @click=emit('close') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:129; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 보관함 열기, busy 비어 있음 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-001 에 @click=emit('close') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 닫기 emit→WorldView.closePanel→panel=null. 편집 중이면 별도 미저장 확인 없이 닫힌다
4. 예상저장/불변필드: DB 쓰기 없음. 미저장 draft는 컴포넌트 해제 후 소실
5. 취소·복귀검사: DB 쓰기 없음. 미저장 draft는 컴포넌트 해제 후 소실 / 이 요소의 전환 후 상태: 닫기 emit→WorldView.closePanel→panel=null. 편집 중이면 별도 미저장 확인 없이 닫힌다 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=emit('close')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-002 · UI-002 · draft.title

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `제목`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}, {"tag": "form", "conditions": {"v-if": "editing"}}]`; 자체속성 `{"v-model": "draft.title", "maxlength": "40"}`.
- 준비/이전 상태: 합성 A 선택→제목·추억 고치기, 기존 제목 A
- 입력: ; v-model=draft.title / 키보드: native input의텍스트/날짜입력. readonly이면편집불가. 폼내Enter의submit여부는formSubmit/조상form근거를따름. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: draft.title을 새 제목 B로 입력; 최대40자. 명시적 추억 저장 전 DB title=A
- 데이터·저장 시점: WorldArchive-009로 저장. 취소010 후 다시 편집하면 저장된 제목을 다시 복사
- 실행 연결: WorldArchive.vue::saveInfo, store.ts::updateArtworkInfo, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldArchive.vue", "event": "updated", "to": "WorldView.vue", "receiver": "reload", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A 선택→제목·추억 고치기, 기존 제목 A. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. WorldArchive-009로 저장. 취소010 후 다시 편집하면 저장된 제목을 다시 복사
- 취소·ESC·포커스: WorldArchive-009로 저장. 취소010 후 다시 편집하면 저장된 제목을 다시 복사 / 이 요소의 전환 후 상태: draft.title을 새 제목 B로 입력; 최대40자. 명시적 추억 저장 전 DB title=A / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:153; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A 선택→제목·추억 고치기, 기존 제목 A 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-002 에 ; v-model=draft.title 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: draft.title을 새 제목 B로 입력; 최대40자. 명시적 추억 저장 전 DB title=A
4. 예상저장/불변필드: WorldArchive-009로 저장. 취소010 후 다시 편집하면 저장된 제목을 다시 복사
5. 취소·복귀검사: WorldArchive-009로 저장. 취소010 후 다시 편집하면 저장된 제목을 다시 복사 / 이 요소의 전환 후 상태: draft.title을 새 제목 B로 입력; 최대40자. 명시적 추억 저장 전 DB title=A / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. draft.title 변경 후 saveInfo의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::updateArtworkInfo를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. WorldArchive-009로 저장. 취소010 후 다시 편집하면 저장된 제목을 다시 복사

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-003 · UI-003 · {{n}} 세

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `그때 나이 {{n}} 세`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}, {"tag": "form", "conditions": {"v-if": "editing"}}]`; 자체속성 `{"v-model.number": "draft.age"}`.
- 준비/이전 상태: 합성 A.age=4 편집
- 입력: ; v-model.number=draft.age / 키보드: native select: 방향키로항목변경,Enter/Space/Alt+Down등OS기본선택. v-model.number면숫자변환. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 나이 5 선택→draft.age 숫자5. 즉시 전시실 이동 없음
- 데이터·저장 시점: 009 저장 시 A.age=5와 rooms에5 추가; 기존4세관 삭제 코드는 없음
- 실행 연결: WorldArchive.vue::saveInfo, store.ts::updateArtworkInfo, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldArchive.vue", "event": "updated", "to": "WorldView.vue", "receiver": "reload", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A.age=4 편집. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 009 저장 시 A.age=5와 rooms에5 추가; 기존4세관 삭제 코드는 없음
- 취소·ESC·포커스: 009 저장 시 A.age=5와 rooms에5 추가; 기존4세관 삭제 코드는 없음 / 이 요소의 전환 후 상태: 나이 5 선택→draft.age 숫자5. 즉시 전시실 이동 없음 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:154; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A.age=4 편집 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-003 에 ; v-model.number=draft.age 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 나이 5 선택→draft.age 숫자5. 즉시 전시실 이동 없음
4. 예상저장/불변필드: 009 저장 시 A.age=5와 rooms에5 추가; 기존4세관 삭제 코드는 없음
5. 취소·복귀검사: 009 저장 시 A.age=5와 rooms에5 추가; 기존4세관 삭제 코드는 없음 / 이 요소의 전환 후 상태: 나이 5 선택→draft.age 숫자5. 즉시 전시실 이동 없음 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. draft.age 변경 후 saveInfo의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::updateArtworkInfo를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 009 저장 시 A.age=5와 rooms에5 추가; 기존4세관 삭제 코드는 없음

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-004 · UI-004 · draft.madeOn

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `만든 날`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}, {"tag": "form", "conditions": {"v-if": "editing"}}]`; 자체속성 `{"v-model": "draft.madeOn", "type": "date"}`.
- 준비/이전 상태: 합성 A.madeOn 빈 값 편집
- 입력: ; v-model=draft.madeOn / 키보드: native input의텍스트/날짜입력. readonly이면편집불가. 폼내Enter의submit여부는formSubmit/조상form근거를따름. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 2026-10-01 입력→draft.madeOn 변경. 달력은 브라우저 네이티브
- 데이터·저장 시점: 009 저장 시 madeOn만 해당 입력으로 반영; 날짜 해석의 기기별 차이는 미검증
- 실행 연결: WorldArchive.vue::saveInfo, store.ts::updateArtworkInfo, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldArchive.vue", "event": "updated", "to": "WorldView.vue", "receiver": "reload", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A.madeOn 빈 값 편집. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 009 저장 시 madeOn만 해당 입력으로 반영; 날짜 해석의 기기별 차이는 미검증
- 취소·ESC·포커스: 009 저장 시 madeOn만 해당 입력으로 반영; 날짜 해석의 기기별 차이는 미검증 / 이 요소의 전환 후 상태: 2026-10-01 입력→draft.madeOn 변경. 달력은 브라우저 네이티브 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:155; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A.madeOn 빈 값 편집 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-004 에 ; v-model=draft.madeOn 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 2026-10-01 입력→draft.madeOn 변경. 달력은 브라우저 네이티브
4. 예상저장/불변필드: 009 저장 시 madeOn만 해당 입력으로 반영; 날짜 해석의 기기별 차이는 미검증
5. 취소·복귀검사: 009 저장 시 madeOn만 해당 입력으로 반영; 날짜 해석의 기기별 차이는 미검증 / 이 요소의 전환 후 상태: 2026-10-01 입력→draft.madeOn 변경. 달력은 브라우저 네이티브 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. draft.madeOn 변경 후 saveInfo의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::updateArtworkInfo를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 009 저장 시 madeOn만 해당 입력으로 반영; 날짜 해석의 기기별 차이는 미검증

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-005 · UI-005 · 그림 만들기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `종류 그림 만들기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}, {"tag": "form", "conditions": {"v-if": "editing"}}]`; 자체속성 `{"v-model": "draft.kind"}`.
- 준비/이전 상태: 합성 A.kind=drawing 편집
- 입력: ; v-model=draft.kind / 키보드: native select: 방향키로항목변경,Enter/Space/Alt+Down등OS기본선택. v-model.number면숫자변환. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 만들기 선택→draft.kind=making
- 데이터·저장 시점: 009 저장 전 kind 불변; 저장 후 같은 A.id의 종류 변경
- 실행 연결: WorldArchive.vue::saveInfo, store.ts::updateArtworkInfo, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldArchive.vue", "event": "updated", "to": "WorldView.vue", "receiver": "reload", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A.kind=drawing 편집. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 009 저장 전 kind 불변; 저장 후 같은 A.id의 종류 변경
- 취소·ESC·포커스: 009 저장 전 kind 불변; 저장 후 같은 A.id의 종류 변경 / 이 요소의 전환 후 상태: 만들기 선택→draft.kind=making / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:156; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A.kind=drawing 편집 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-005 에 ; v-model=draft.kind 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 만들기 선택→draft.kind=making
4. 예상저장/불변필드: 009 저장 전 kind 불변; 저장 후 같은 A.id의 종류 변경
5. 취소·복귀검사: 009 저장 전 kind 불변; 저장 후 같은 A.id의 종류 변경 / 이 요소의 전환 후 상태: 만들기 선택→draft.kind=making / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. draft.kind 변경 후 saveInfo의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::updateArtworkInfo를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 009 저장 전 kind 불변; 저장 후 같은 A.id의 종류 변경

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-006 · UI-006 · {{s.label}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `주제 {{s.label}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}, {"tag": "form", "conditions": {"v-if": "editing"}}]`; 자체속성 `{"v-model": "draft.subject"}`.
- 준비/이전 상태: 합성 A.subject=etc 편집
- 입력: ; v-model=draft.subject / 키보드: native select: 방향키로항목변경,Enter/Space/Alt+Down등OS기본선택. v-model.number면숫자변환. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: SUBJECTS의 유효 항목 선택→draft.subject=선택 id
- 데이터·저장 시점: 009 저장 후 주제에 따른 동작 재구성; original/display/cutout 불변
- 실행 연결: WorldArchive.vue::saveInfo, store.ts::updateArtworkInfo, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldArchive.vue", "event": "updated", "to": "WorldView.vue", "receiver": "reload", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A.subject=etc 편집. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 009 저장 후 주제에 따른 동작 재구성; original/display/cutout 불변
- 취소·ESC·포커스: 009 저장 후 주제에 따른 동작 재구성; original/display/cutout 불변 / 이 요소의 전환 후 상태: SUBJECTS의 유효 항목 선택→draft.subject=선택 id / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:157; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A.subject=etc 편집 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-006 에 ; v-model=draft.subject 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: SUBJECTS의 유효 항목 선택→draft.subject=선택 id
4. 예상저장/불변필드: 009 저장 후 주제에 따른 동작 재구성; original/display/cutout 불변
5. 취소·복귀검사: 009 저장 후 주제에 따른 동작 재구성; original/display/cutout 불변 / 이 요소의 전환 후 상태: SUBJECTS의 유효 항목 선택→draft.subject=선택 id / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. draft.subject 변경 후 saveInfo의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::updateArtworkInfo를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 009 저장 후 주제에 따른 동작 재구성; original/display/cutout 불변

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-007 · UI-007 · draft.material

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `재료`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}, {"tag": "form", "conditions": {"v-if": "editing"}}]`; 자체속성 `{"v-model": "draft.material", "maxlength": "20"}`.
- 준비/이전 상태: 합성 A.material 빈 값 편집
- 입력: ; v-model=draft.material / 키보드: native input의텍스트/날짜입력. readonly이면편집불가. 폼내Enter의submit여부는formSubmit/조상form근거를따름. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 색연필 입력→draft.material, 최대20자
- 데이터·저장 시점: 009에서 trim 후20자 제한; 010 취소는 DB material 보존
- 실행 연결: WorldArchive.vue::saveInfo, store.ts::updateArtworkInfo, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldArchive.vue", "event": "updated", "to": "WorldView.vue", "receiver": "reload", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A.material 빈 값 편집. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 009에서 trim 후20자 제한; 010 취소는 DB material 보존
- 취소·ESC·포커스: 009에서 trim 후20자 제한; 010 취소는 DB material 보존 / 이 요소의 전환 후 상태: 색연필 입력→draft.material, 최대20자 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:158; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A.material 빈 값 편집 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-007 에 ; v-model=draft.material 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 색연필 입력→draft.material, 최대20자
4. 예상저장/불변필드: 009에서 trim 후20자 제한; 010 취소는 DB material 보존
5. 취소·복귀검사: 009에서 trim 후20자 제한; 010 취소는 DB material 보존 / 이 요소의 전환 후 상태: 색연필 입력→draft.material, 최대20자 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. draft.material 변경 후 saveInfo의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::updateArtworkInfo를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 009에서 trim 후20자 제한; 010 취소는 DB material 보존

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-008 · UI-008 · draft.words

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `아이가 한 말`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}, {"tag": "form", "conditions": {"v-if": "editing"}}]`; 자체속성 `{"v-model": "draft.words", "maxlength": "200", "rows": "2"}`.
- 준비/이전 상태: 합성 A.words=옛 이야기 편집
- 입력: ; v-model=draft.words / 키보드: 텍스트입력/붙여넣기,Enter는줄바꿈. maxlength준수;Enter를저장단축키로가정하지않음. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 새 이야기 입력→draft.words, 최대200자
- 데이터·저장 시점: 009 저장 전 words 불변; 010 취소 후 재편집은 옛 이야기
- 실행 연결: WorldArchive.vue::saveInfo, store.ts::updateArtworkInfo, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldArchive.vue", "event": "updated", "to": "WorldView.vue", "receiver": "reload", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A.words=옛 이야기 편집. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 009 저장 전 words 불변; 010 취소 후 재편집은 옛 이야기
- 취소·ESC·포커스: 009 저장 전 words 불변; 010 취소 후 재편집은 옛 이야기 / 이 요소의 전환 후 상태: 새 이야기 입력→draft.words, 최대200자 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:159; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A.words=옛 이야기 편집 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-008 에 ; v-model=draft.words 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 새 이야기 입력→draft.words, 최대200자
4. 예상저장/불변필드: 009 저장 전 words 불변; 010 취소 후 재편집은 옛 이야기
5. 취소·복귀검사: 009 저장 전 words 불변; 010 취소 후 재편집은 옛 이야기 / 이 요소의 전환 후 상태: 새 이야기 입력→draft.words, 최대200자 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. draft.words 변경 후 saveInfo의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::updateArtworkInfo를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 009 저장 전 words 불변; 010 취소 후 재편집은 옛 이야기

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-009 · UI-009 · {{busy==='info'?'저장 중…':'추억 저장'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `{{busy==='info'?'저장 중…':'추억 저장'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}, {"tag": "form", "conditions": {"v-if": "editing"}}]`; 자체속성 `{"class": "g-btn g-btn--primary", "type": "submit", ":disabled": "!!busy"}`.
- 준비/이전 상태: 합성 A 편집, 제목 B·나이5·말 새 이야기 입력, busy 비어 있음
- 입력: ; enclosing form [['@submit.prevent', 'saveInfo']] / 키보드: 버튼 Enter/Space 또는 form 내부 단일행 입력의 브라우저 implicit submit. textarea Enter는 줄바꿈. @submit.prevent가 native 문서전환을 막음. / 터치: 탭으로 ; enclosing form [['@submit.prevent', 'saveInfo']] 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: type=submit→상위 form @submit.prevent=saveInfo. busy=info→저장 완료 시 editing=false, updated emit, 성공문구. 실패 시 편집과 입력 유지, busy 해제
- 데이터·저장 시점: saveInfo→store.updateArtworkInfo(A.id,draft)→가족 소유·나이1..13 검사→saveArtworkAndRoom 거래 완료. 원본 바이트·ID 유지; 부모 reload는 emit으로 비동기 시작되어 자식이 await하지 않음
- 실행 연결: WorldArchive.vue::saveInfo, store.ts::updateArtworkInfo, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldArchive.vue", "event": "updated", "to": "WorldView.vue", "receiver": "reload", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A 편집, 제목 B·나이5·말 새 이야기 입력, busy 비어 있음. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: updateArtworkInfo를 거래 전 1회 reject: editing=true와 draft7필드 유지, '저장하지 못했어요. 적은 내용은 남아 있어요. 다시 저장해 주세요', busy=''. 재시도는 같은 submit. 별도 reload reject는 emit 수신자 Promise라 자식 성공문구 후 실패할 수 있고 전용 복구 UI 없음.
- 취소·ESC·포커스: busy=info 동안 submit/취소/닫기 버튼 disabled. ESC는 guard 없이 closePanel이므로 DB 저장 취소가 아님. 완료 전 닫아도 이미 시작한 거래는 계속될 수 있음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 탭으로 ; enclosing form [['@submit.prevent', 'saveInfo']] 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:160; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A 편집, 제목 B·나이5·말 새 이야기 입력, busy 비어 있음 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-009 에 ; enclosing form [['@submit.prevent', 'saveInfo']] 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: type=submit→상위 form @submit.prevent=saveInfo. busy=info→저장 완료 시 editing=false, updated emit, 성공문구. 실패 시 편집과 입력 유지, busy 해제
4. 예상저장/불변필드: saveInfo→store.updateArtworkInfo(A.id,draft)→가족 소유·나이1..13 검사→saveArtworkAndRoom 거래 완료. 원본 바이트·ID 유지; 부모 reload는 emit으로 비동기 시작되어 자식이 await하지 않음
5. 취소·복귀검사: busy=info 동안 submit/취소/닫기 버튼 disabled. ESC는 guard 없이 closePanel이므로 DB 저장 취소가 아님. 완료 전 닫아도 이미 시작한 거래는 계속될 수 있음.
6. 실패/경계검사: store.ts::updateArtworkInfo를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. updateArtworkInfo를 거래 전 1회 reject: editing=true와 draft7필드 유지, '저장하지 못했어요. 적은 내용은 남아 있어요. 다시 저장해 주세요', busy=''. 재시도는 같은 submit. 별도 reload reject는 emit 수신자 Promise라 자식 성공문구 후 실패할 수 있고 전용 복구 UI 없음.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-010 · UI-010 · 취소

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `취소`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}, {"tag": "form", "conditions": {"v-if": "editing"}}]`; 자체속성 `{"class": "g-btn", "type": "button", ":disabled": "!!busy", "@click": "editing=false"}`.
- 준비/이전 상태: 편집 중 draft를 변경, busy 비어 있음
- 입력: @click=editing=false / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=editing=false 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: editing=false로 편집 폼 닫힘. 즉시 draft 자체를 초기화하지 않음; 다음 editInfo에서 저장값 재복사
- 데이터·저장 시점: 저장 호출 없음. A의 모든 DB 필드·원본 불변
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 편집 중 draft를 변경, busy 비어 있음. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 저장 호출 없음. A의 모든 DB 필드·원본 불변; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 저장 호출 없음. A의 모든 DB 필드·원본 불변 / 이 요소의 전환 후 상태: editing=false로 편집 폼 닫힘. 즉시 draft 자체를 초기화하지 않음; 다음 editInfo에서 저장값 재복사 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 탭으로 @click=editing=false 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:160; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 편집 중 draft를 변경, busy 비어 있음 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-010 에 @click=editing=false 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: editing=false로 편집 폼 닫힘. 즉시 draft 자체를 초기화하지 않음; 다음 editInfo에서 저장값 재복사
4. 예상저장/불변필드: 저장 호출 없음. A의 모든 DB 필드·원본 불변
5. 취소·복귀검사: 저장 호출 없음. A의 모든 DB 필드·원본 불변 / 이 요소의 전환 후 상태: editing=false로 편집 폼 닫힘. 즉시 draft 자체를 초기화하지 않음; 다음 editInfo에서 저장값 재복사 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=editing=false의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-011 · UI-011 · 제목·추억 고치기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `제목·추억 고치기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}]`; 자체속성 `{"class": "g-btn", "type": "button", ":disabled": "!!busy", "@click": "editInfo"}`.
- 준비/이전 상태: 합성 A 상세 선택, busy 비어 있음
- 입력: @click=editInfo / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=editInfo 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: editInfo가 A의7개 정보 필드를 draft에 복사하고 editing=true
- 데이터·저장 시점: 읽기/초안만. DB 변경 없음
- 실행 연결: WorldArchive.vue::editInfo (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A 상세 선택, busy 비어 있음. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 읽기/초안만. DB 변경 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 읽기/초안만. DB 변경 없음 / 이 요소의 전환 후 상태: editInfo가 A의7개 정보 필드를 draft에 복사하고 editing=true / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 탭으로 @click=editInfo 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:163; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A 상세 선택, busy 비어 있음 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-011 에 @click=editInfo 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: editInfo가 A의7개 정보 필드를 draft에 복사하고 editing=true
4. 예상저장/불변필드: 읽기/초안만. DB 변경 없음
5. 취소·복귀검사: 읽기/초안만. DB 변경 없음 / 이 요소의 전환 후 상태: editInfo가 A의7개 정보 필드를 draft에 복사하고 editing=true / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=editInfo의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-012 · UI-012 · {{busy === 'glb' ? '만드는 중…' : '입체 내려받기'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `{{busy === 'glb' ? '만드는 중…' : '입체 내려받기'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}]`; 자체속성 `{"class": "g-btn g-btn--primary", "type": "button", ":disabled": "!!busy", "@click": "glb"}`.
- 준비/이전 상태: 합성 A 선택, busy 비어 있음
- 입력: @click=glb / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=glb 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: busy=glb→exportGlb→safeName 기반 .glb 다운로드 요청→성공 또는 실패 msg→busy 해제
- 데이터·저장 시점: GLB 파생 파일 생성만. 작품 DB/원본 변경 없음; 브라우저의 실제 파일 저장 완료까지 확인하는 API 아님
- 실행 연결: WorldArchive.vue::glb (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A 선택, busy 비어 있음. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. GLB 파생 파일 생성만. 작품 DB/원본 변경 없음; 브라우저의 실제 파일 저장 완료까지 확인하는 API 아님
- 취소·ESC·포커스: GLB 파생 파일 생성만. 작품 DB/원본 변경 없음; 브라우저의 실제 파일 저장 완료까지 확인하는 API 아님 / 이 요소의 전환 후 상태: busy=glb→exportGlb→safeName 기반 .glb 다운로드 요청→성공 또는 실패 msg→busy 해제 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 탭으로 @click=glb 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:164; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A 선택, busy 비어 있음 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-012 에 @click=glb 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: busy=glb→exportGlb→safeName 기반 .glb 다운로드 요청→성공 또는 실패 msg→busy 해제
4. 예상저장/불변필드: GLB 파생 파일 생성만. 작품 DB/원본 변경 없음; 브라우저의 실제 파일 저장 완료까지 확인하는 API 아님
5. 취소·복귀검사: GLB 파생 파일 생성만. 작품 DB/원본 변경 없음; 브라우저의 실제 파일 저장 완료까지 확인하는 API 아님 / 이 요소의 전환 후 상태: busy=glb→exportGlb→safeName 기반 .glb 다운로드 요청→성공 또는 실패 msg→busy 해제 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=glb의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-013 · UI-013 · 원본 내려받기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `원본 내려받기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "original"}`.
- 준비/이전 상태: 합성 A.original PNG 보유
- 입력: @click=original / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=original 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: download(a.original,safeName(title 또는 artwork-no)+_원본+확장자) 호출
- 데이터·저장 시점: 원본 바이트 그대로 다운로드 요청. try/catch·완료확인 UI 없음; 다운로드 차단을 성공으로 판정하면 안 됨
- 실행 연결: WorldArchive.vue::original (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A.original PNG 보유. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: download 또는 URL.createObjectURL 예외/브라우저다운로드차단을분리검사. 함수에try/catch·성공/실패msg변경없음. 전용재시도안내미구현;원래버튼재클릭은가능하나저장완료보장아님.
- 취소·ESC·포커스: 원본 바이트 그대로 다운로드 요청. try/catch·완료확인 UI 없음; 다운로드 차단을 성공으로 판정하면 안 됨 / 이 요소의 전환 후 상태: download(a.original,safeName(title 또는 artwork-no)+_원본+확장자) 호출 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 탭으로 @click=original 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:165; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A.original PNG 보유 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-013 에 @click=original 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: download(a.original,safeName(title 또는 artwork-no)+_원본+확장자) 호출
4. 예상저장/불변필드: 원본 바이트 그대로 다운로드 요청. try/catch·완료확인 UI 없음; 다운로드 차단을 성공으로 판정하면 안 됨
5. 취소·복귀검사: 원본 바이트 그대로 다운로드 요청. try/catch·완료확인 UI 없음; 다운로드 차단을 성공으로 판정하면 안 됨 / 이 요소의 전환 후 상태: download(a.original,safeName(title 또는 artwork-no)+_원본+확장자) 호출 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=original의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-014 · UI-014 · 미술관에서 보기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `미술관에서 보기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "emit('goto', current.id)"}`.
- 준비/이전 상태: 합성 A 선택
- 입력: @click=emit('goto', current.id) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=emit('goto', current.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: goto(A.id) emit→부모 closePanel(); engine.goTo(A.id,false). 자동 이동 요청; 재생하지 않음
- 데이터·저장 시점: 저장 없음. closePanel Promise를 goto 람다가 await하지 않음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldArchive.vue", "event": "goto", "to": "WorldView.vue", "receiver": "id => { closePanel(); engine?.goTo(id,false) }", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A 선택. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 저장 없음. closePanel Promise를 goto 람다가 await하지 않음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 저장 없음. closePanel Promise를 goto 람다가 await하지 않음 / 이 요소의 전환 후 상태: goto(A.id) emit→부모 closePanel(); engine.goTo(A.id,false). 자동 이동 요청; 재생하지 않음 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 탭으로 @click=emit('goto', current.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:166; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A 선택 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-014 에 @click=emit('goto', current.id) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: goto(A.id) emit→부모 closePanel(); engine.goTo(A.id,false). 자동 이동 요청; 재생하지 않음
4. 예상저장/불변필드: 저장 없음. closePanel Promise를 goto 람다가 await하지 않음
5. 취소·복귀검사: 저장 없음. closePanel Promise를 goto 람다가 await하지 않음 / 이 요소의 전환 후 상태: goto(A.id) emit→부모 closePanel(); engine.goTo(A.id,false). 자동 이동 요청; 재생하지 않음 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=emit('goto', current.id)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-015 · UI-015 · 지우기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `지우기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}]`; 자체속성 `{"v-if": "!confirmDel", "class": "g-btn", "type": "button", "@click": "confirmDel = true"}`.
- 준비/이전 상태: 합성 A 상세에서 삭제 확인 닫힘
- 입력: @click=confirmDel = true / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=confirmDel = true 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: confirmDel=true, 삭제/그만두기 확인 영역 표시
- 데이터·저장 시점: 이 단계는 삭제 없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A 상세에서 삭제 확인 닫힘. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 이 단계는 삭제 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 이 단계는 삭제 없음 / 이 요소의 전환 후 상태: confirmDel=true, 삭제/그만두기 확인 영역 표시 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 탭으로 @click=confirmDel = true 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:167; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A 상세에서 삭제 확인 닫힘 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-015 에 @click=confirmDel = true 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: confirmDel=true, 삭제/그만두기 확인 영역 표시
4. 예상저장/불변필드: 이 단계는 삭제 없음
5. 취소·복귀검사: 이 단계는 삭제 없음 / 이 요소의 전환 후 상태: confirmDel=true, 삭제/그만두기 확인 영역 표시 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=confirmDel = true의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-016 · UI-016 · 지우기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `지우기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}, {"tag": "div", "conditions": {"v-if": "confirmDel"}}]`; 자체속성 `{"class": "g-btn g-btn--primary", "type": "button", "@click": "del"}`.
- 준비/이전 상태: 합성 A 삭제 확인 표시
- 입력: @click=del / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=del 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: del→delete(A.id) emit. 확인 닫고 남은 마지막 작품을 낙관적으로 선택. 부모 onDelete가 삭제→reload→토스트
- 데이터·저장 시점: store.deleteArtwork는 현재 가족 소유 확인 후 삭제. 실패 시 자식 선택은 이미 바뀔 수 있음; 부모 실패 토스트. 원본 불변이 아니라 A레코드 삭제가 목적
- 실행 연결: WorldArchive.vue::del, store.ts::deleteArtwork (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldArchive.vue", "event": "delete", "to": "WorldView.vue", "receiver": "onDelete", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A 삭제 확인 표시. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. store.deleteArtwork는 현재 가족 소유 확인 후 삭제. 실패 시 자식 선택은 이미 바뀔 수 있음; 부모 실패 토스트. 원본 불변이 아니라 A레코드 삭제가 목적
- 취소·ESC·포커스: store.deleteArtwork는 현재 가족 소유 확인 후 삭제. 실패 시 자식 선택은 이미 바뀔 수 있음; 부모 실패 토스트. 원본 불변이 아니라 A레코드 삭제가 목적 / 이 요소의 전환 후 상태: del→delete(A.id) emit. 확인 닫고 남은 마지막 작품을 낙관적으로 선택. 부모 onDelete가 삭제→reload→토스트 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 탭으로 @click=del 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:172; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A 삭제 확인 표시 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-016 에 @click=del 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: del→delete(A.id) emit. 확인 닫고 남은 마지막 작품을 낙관적으로 선택. 부모 onDelete가 삭제→reload→토스트
4. 예상저장/불변필드: store.deleteArtwork는 현재 가족 소유 확인 후 삭제. 실패 시 자식 선택은 이미 바뀔 수 있음; 부모 실패 토스트. 원본 불변이 아니라 A레코드 삭제가 목적
5. 취소·복귀검사: store.deleteArtwork는 현재 가족 소유 확인 후 삭제. 실패 시 자식 선택은 이미 바뀔 수 있음; 부모 실패 토스트. 원본 불변이 아니라 A레코드 삭제가 목적 / 이 요소의 전환 후 상태: del→delete(A.id) emit. 확인 닫고 남은 마지막 작품을 낙관적으로 선택. 부모 onDelete가 삭제→reload→토스트 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::deleteArtwork를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. store.deleteArtwork는 현재 가족 소유 확인 후 삭제. 실패 시 자식 선택은 이미 바뀔 수 있음; 부모 실패 토스트. 원본 불변이 아니라 A레코드 삭제가 목적

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-017 · UI-017 · 그만두기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `그만두기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "current && info"}}, {"tag": "div", "conditions": {"v-if": "confirmDel"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "confirmDel = false"}`.
- 준비/이전 상태: 합성 A 삭제 확인 표시
- 입력: @click=confirmDel = false / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=confirmDel = false 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: confirmDel=false로 확인만 닫음
- 데이터·저장 시점: A와 전체 작품·원본 불변. 삭제 호출 없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A 삭제 확인 표시. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. A와 전체 작품·원본 불변. 삭제 호출 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: A와 전체 작품·원본 불변. 삭제 호출 없음 / 이 요소의 전환 후 상태: confirmDel=false로 확인만 닫음 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 탭으로 @click=confirmDel = false 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:173; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A 삭제 확인 표시 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-017 에 @click=confirmDel = false 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: confirmDel=false로 확인만 닫음
4. 예상저장/불변필드: A와 전체 작품·원본 불변. 삭제 호출 없음
5. 취소·복귀검사: A와 전체 작품·원본 불변. 삭제 호출 없음 / 이 요소의 전환 후 상태: confirmDel=false로 확인만 닫음 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=confirmDel = false의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldArchive-018 · UI-018 · a.title || '작품' {{a.age}} 세 ·  {{a.title || defaultTitle(a.subject, a.kind)}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 이름 근거 `a.title || '작품' {{a.age}} 세 ·  {{a.title || defaultTitle(a.subject, a.kind)}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "li", "conditions": {"v-for": "a in [...artworks].reverse()"}}]`; 자체속성 `{"type": "button", "class": "thumb", ":aria-pressed": "a.id === sel", "@click": "sel = a.id"}`.
- 준비/이전 상태: 합성 A,B 보관함 목록, A 편집 중
- 입력: @click=sel = a.id / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=sel = a.id 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: B 썸네일 클릭→sel=B.id; watch(sel)가 editing/confirmDel/msg 초기화, B의 입체 보기 갱신
- 데이터·저장 시점: DB 쓰기 없음. A 미저장 편집은 확인 없이 폐기; 같은 B 재선택은 sel watcher가 재실행되지 않을 수 있음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 A,B 보관함 목록, A 편집 중. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. DB 쓰기 없음. A 미저장 편집은 확인 없이 폐기; 같은 B 재선택은 sel watcher가 재실행되지 않을 수 있음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: DB 쓰기 없음. A 미저장 편집은 확인 없이 폐기; 같은 B 재선택은 sel watcher가 재실행되지 않을 수 있음 / 이 요소의 전환 후 상태: B 썸네일 클릭→sel=B.id; watch(sel)가 editing/confirmDel/msg 초기화, B의 입체 보기 갱신 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `archive` 및 `focus` 참조.
- PC/모바일: 전체 sheet 안 상세/목록. 해당요소 조상 class/role과 source 행을 위치 기준으로 사용. 화면폭에 따른 CSS 정확문은 layoutEvidence에 수록. 탭으로 @click=sel = a.id 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldArchive.vue:181; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 A,B 보관함 목록, A 편집 중 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldArchive-018 에 @click=sel = a.id 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: B 썸네일 클릭→sel=B.id; watch(sel)가 editing/confirmDel/msg 초기화, B의 입체 보기 갱신
4. 예상저장/불변필드: DB 쓰기 없음. A 미저장 편집은 확인 없이 폐기; 같은 B 재선택은 sel watcher가 재실행되지 않을 수 있음
5. 취소·복귀검사: DB 쓰기 없음. A 미저장 편집은 확인 없이 폐기; 같은 B 재선택은 sel watcher가 재실행되지 않을 수 있음 / 이 요소의 전환 후 상태: B 썸네일 클릭→sel=B.id; watch(sel)가 editing/confirmDel/msg 초기화, B의 입체 보기 갱신 / ESC·패널닫기는 공통 archive 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=sel = a.id의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-001 · UI-019 · 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `닫기`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "emit('close')"}`.
- 준비/이전 상태: 캐릭터 패널에서 저장 전 외형 변경
- 입력: @click=emit('close') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=emit('close') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: close emit→부모 closePanel이 prefs의 아바타/이미지를 engine.setAvatar로 복원 후 패널 닫음
- 데이터·저장 시점: prefs DB 불변. 복원 setAvatar 거절 시 closePanel에 catch 없어 패널 닫힘/포커스 복귀 보장 없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "close", "to": "WorldView.vue", "receiver": "closePanel", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 캐릭터 패널에서 저장 전 외형 변경. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. prefs DB 불변. 복원 setAvatar 거절 시 closePanel에 catch 없어 패널 닫힘/포커스 복귀 보장 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: prefs DB 불변. 복원 setAvatar 거절 시 closePanel에 catch 없어 패널 닫힘/포커스 복귀 보장 없음 / 이 요소의 전환 후 상태: close emit→부모 closePanel이 prefs의 아바타/이미지를 engine.setAvatar로 복원 후 패널 닫음 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=emit('close') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:90; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 캐릭터 패널에서 저장 전 외형 변경 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-001 에 @click=emit('close') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: close emit→부모 closePanel이 prefs의 아바타/이미지를 engine.setAvatar로 복원 후 패널 닫음
4. 예상저장/불변필드: prefs DB 불변. 복원 setAvatar 거절 시 closePanel에 catch 없어 패널 닫힘/포커스 복귀 보장 없음
5. 취소·복귀검사: prefs DB 불변. 복원 setAvatar 거절 시 closePanel에 catch 없어 패널 닫힘/포커스 복귀 보장 없음 / 이 요소의 전환 후 상태: close emit→부모 closePanel이 prefs의 아바타/이미지를 engine.setAvatar로 복원 후 패널 닫음 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=emit('close')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-002 · UI-020 · 기본 캐릭터

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `기본 캐릭터`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"role": "tab", "type": "button", "class": "g-btn", ":aria-selected": "tab === 'basic'", ":aria-pressed": "tab === 'basic'", "@click": "useBasic"}`.
- 준비/이전 상태: 사진 탭에서 기본 탭 선택
- 입력: @click=useBasic / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=useBasic 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: tab=basic, cfg.mode=basic, preview emit→부모 previewAvatar→engine.setAvatar
- 데이터·저장 시점: 초안 cfg/미리보기만. 015 저장 전 prefs 불변
- 실행 연결: WorldAvatar.vue::useBasic, WorldAvatar.vue::set (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "preview", "to": "WorldView.vue", "receiver": "previewAvatar", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 사진 탭에서 기본 탭 선택. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 초안 cfg/미리보기만. 015 저장 전 prefs 불변; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 초안 cfg/미리보기만. 015 저장 전 prefs 불변 / 이 요소의 전환 후 상태: tab=basic, cfg.mode=basic, preview emit→부모 previewAvatar→engine.setAvatar / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=useBasic 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:93; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 사진 탭에서 기본 탭 선택 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-002 에 @click=useBasic 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: tab=basic, cfg.mode=basic, preview emit→부모 previewAvatar→engine.setAvatar
4. 예상저장/불변필드: 초안 cfg/미리보기만. 015 저장 전 prefs 불변
5. 취소·복귀검사: 초안 cfg/미리보기만. 015 저장 전 prefs 불변 / 이 요소의 전환 후 상태: tab=basic, cfg.mode=basic, preview emit→부모 previewAvatar→engine.setAvatar / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=useBasic의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-003 · UI-021 · 내 그림·사진으로

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `내 그림·사진으로`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"role": "tab", "type": "button", "class": "g-btn", ":aria-selected": "tab === 'image'", ":aria-pressed": "tab === 'image'", "@click": "tab = 'image'"}`.
- 준비/이전 상태: 기본 탭에서 내 그림·사진으로 선택
- 입력: @click=tab = 'image' / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=tab = 'image' 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: tab=image만 변경. cfg.mode는 사진 선택 또는 작품 선택 때 변경
- 데이터·저장 시점: 탭 선택 자체는 저장/캐릭터 mode 변경 없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 기본 탭에서 내 그림·사진으로 선택. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 탭 선택 자체는 저장/캐릭터 mode 변경 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 탭 선택 자체는 저장/캐릭터 mode 변경 없음 / 이 요소의 전환 후 상태: tab=image만 변경. cfg.mode는 사진 선택 또는 작품 선택 때 변경 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=tab = 'image' 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:94; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 기본 탭에서 내 그림·사진으로 선택 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-003 에 @click=tab = 'image' 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: tab=image만 변경. cfg.mode는 사진 선택 또는 작품 선택 때 변경
4. 예상저장/불변필드: 탭 선택 자체는 저장/캐릭터 mode 변경 없음
5. 취소·복귀검사: 탭 선택 자체는 저장/캐릭터 mode 변경 없음 / 이 요소의 전환 후 상태: tab=image만 변경. cfg.mode는 사진 선택 또는 작품 선택 때 변경 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=tab = 'image'의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-004 · UI-022 · {{o.label}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `{{o.label}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "tab === 'basic'"}}, {"tag": "section", "conditions": {"v-for": "s in sections"}}, {"tag": "div", "conditions": {"v-if": "s.options"}}]`; 자체속성 `{"v-for": "o in s.options", ":key": "o.id", "type": "button", "class": "chip", ":aria-pressed": "cfg[s.key] === o.id", "@click": "set(s.key, o.id as never)"}`.
- 준비/이전 상태: 기본 탭, 머리 등 옵션 있는 분류 s
- 입력: @click=set(s.key, o.id as never) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=set(s.key, o.id as never) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: 옵션 o 클릭→cfg[s.key]=o.id, aria-pressed와 월드 preview 변경
- 데이터·저장 시점: 015 저장 전 메모리 초안만; 닫기는 prefs 외형 복원
- 실행 연결: WorldAvatar.vue::set (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "preview", "to": "WorldView.vue", "receiver": "previewAvatar", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 기본 탭, 머리 등 옵션 있는 분류 s. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 015 저장 전 메모리 초안만; 닫기는 prefs 외형 복원; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 015 저장 전 메모리 초안만; 닫기는 prefs 외형 복원 / 이 요소의 전환 후 상태: 옵션 o 클릭→cfg[s.key]=o.id, aria-pressed와 월드 preview 변경 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=set(s.key, o.id as never) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:101; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 기본 탭, 머리 등 옵션 있는 분류 s 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-004 에 @click=set(s.key, o.id as never) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 옵션 o 클릭→cfg[s.key]=o.id, aria-pressed와 월드 preview 변경
4. 예상저장/불변필드: 015 저장 전 메모리 초안만; 닫기는 prefs 외형 복원
5. 취소·복귀검사: 015 저장 전 메모리 초안만; 닫기는 prefs 외형 복원 / 이 요소의 전환 후 상태: 옵션 o 클릭→cfg[s.key]=o.id, aria-pressed와 월드 preview 변경 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=set(s.key, o.id as never)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-005 · UI-023 · `${s.label} 색 ${c}`

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 ``${s.label} 색 ${c}``.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "tab === 'basic'"}}, {"tag": "section", "conditions": {"v-for": "s in sections"}}, {"tag": "div", "conditions": {"v-if": "s.colors"}}]`; 자체속성 `{"v-for": "c in s.colors", ":key": "c", "type": "button", "class": "swatch", ":style": "{ background: c }", ":aria-pressed": "(s.colorKey ? cfg[s.colorKey] : cfg[s.key]) === c", ":aria-label": "`${s.label} 색 ${c}`", "@click": "set((s.colorKey ?? s.key) as 'skin', c)"}`.
- 준비/이전 상태: 기본 탭, 피부/머리/옷 색상 s,c
- 입력: @click=set((s.colorKey ?? s.key) as 'skin', c) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=set((s.colorKey ?? s.key) as 'skin', c) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: cfg[s.colorKey 또는 s.key]=c, 선택 테두리와 preview 변경
- 데이터·저장 시점: 015 저장 전 prefs 색상 불변
- 실행 연결: WorldAvatar.vue::set (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "preview", "to": "WorldView.vue", "receiver": "previewAvatar", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 기본 탭, 피부/머리/옷 색상 s,c. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 015 저장 전 prefs 색상 불변; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 015 저장 전 prefs 색상 불변 / 이 요소의 전환 후 상태: cfg[s.colorKey 또는 s.key]=c, 선택 테두리와 preview 변경 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=set((s.colorKey ?? s.key) as 'skin', c) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:104; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 기본 탭, 피부/머리/옷 색상 s,c 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-005 에 @click=set((s.colorKey ?? s.key) as 'skin', c) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: cfg[s.colorKey 또는 s.key]=c, 선택 테두리와 preview 변경
4. 예상저장/불변필드: 015 저장 전 prefs 색상 불변
5. 취소·복귀검사: 015 저장 전 prefs 색상 불변 / 이 요소의 전환 후 상태: cfg[s.colorKey 또는 s.key]=c, 선택 테두리와 preview 변경 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=set((s.colorKey ?? s.key) as 'skin', c)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-006 · UI-024 · 무작위

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `무작위`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "tab === 'basic'"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "random"}`.
- 준비/이전 상태: 기본 탭, 현재 cfg 기록
- 입력: @click=random / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=random 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: randomAvatar 결과로 cfg 교체, tab=basic, preview emit
- 데이터·저장 시점: 랜덤 값 자체를 고정 성공값으로 기대하지 않음; 유효 옵션 범위 검사. 저장은015
- 실행 연결: WorldAvatar.vue::random (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "preview", "to": "WorldView.vue", "receiver": "previewAvatar", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 기본 탭, 현재 cfg 기록. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 랜덤 값 자체를 고정 성공값으로 기대하지 않음; 유효 옵션 범위 검사. 저장은015; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 랜덤 값 자체를 고정 성공값으로 기대하지 않음; 유효 옵션 범위 검사. 저장은015 / 이 요소의 전환 후 상태: randomAvatar 결과로 cfg 교체, tab=basic, preview emit / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=random 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:111; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 기본 탭, 현재 cfg 기록 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-006 에 @click=random 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: randomAvatar 결과로 cfg 교체, tab=basic, preview emit
4. 예상저장/불변필드: 랜덤 값 자체를 고정 성공값으로 기대하지 않음; 유효 옵션 범위 검사. 저장은015
5. 취소·복귀검사: 랜덤 값 자체를 고정 성공값으로 기대하지 않음; 유효 옵션 범위 검사. 저장은015 / 이 요소의 전환 후 상태: randomAvatar 결과로 cfg 교체, tab=basic, preview emit / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=random의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-007 · UI-025 · JOINT_LABELS[n]+' 점'

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `JOINT_LABELS[n]+' 점'`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "image"}}, {"tag": "template", "conditions": {"v-if": "advanced && cfg.joints && cfg.motion !== 'whole'"}}]`; 자체속성 `{"v-for": "n in JOINT_NAMES", ":key": "n", "type": "button", "class": "w-joint", ":style": "{left:cfg.joints[n].x*100+'%',top:cfg.joints[n].y*100+'%'}", ":aria-label": "JOINT_LABELS[n]+' 점'", ":title": "JOINT_LABELS[n]", "@pointerdown.prevent": "startJoint(n,$event)", "@keydown": "keyJoint(n,$event)"}`.
- 준비/이전 상태: image 존재, advanced=true, cfg.joints 존재, motion≠whole
- 입력: @pointerdown.prevent=startJoint(n,$event); @keydown=keyJoint(n,$event) / 키보드: ArrowLeft/Right: x±0.01, ArrowUp/Down: y±0.01;0..1 clamp,preventDefault. Enter/Space 이동 기능 없음. / 터치: 점 pointerdown.prevent→setPointerCapture→부모캔버스 pointermove→pointerup/cancel 종료. 핀치 편집 없음; 두손가락을 확대라고 문서화하지 않는다.
- 실행 후 UI·카메라·씬: 점 n pointerdown→capture→moveJoint, 부모 canvas pointermove로 0..1 정규화 좌표 갱신. 방향키는 x/y를0.01 이동·경계 clamp. motion=joints, articulation=experimental, preview emit
- 데이터·저장 시점: 015 저장 전 joints 초안만. pointerup/cancel은 editing=false이며 이동 전 좌표로 되돌리지 않음. 핀치 조작 구현 없음
- 실행 연결: WorldAvatar.vue::startJoint, WorldAvatar.vue::keyJoint, WorldAvatar.vue::moveJoint (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "preview", "to": "WorldView.vue", "receiver": "previewAvatar", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: image 존재, advanced=true, cfg.joints 존재, motion≠whole. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 015 저장 전 joints 초안만. pointerup/cancel은 editing=false이며 이동 전 좌표로 되돌리지 않음. 핀치 조작 구현 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: pointercancel은 editing=false만; 이미바뀐좌표는남음. 이전좌표복원은없고패널닫기에서저장prefs를복원. 포커스는점button에남음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 점 pointerdown.prevent→setPointerCapture→부모캔버스 pointermove→pointerup/cancel 종료. 핀치 편집 없음; 두손가락을 확대라고 문서화하지 않는다. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:119; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. image 존재, advanced=true, cfg.joints 존재, motion≠whole 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-007 에 @pointerdown.prevent=startJoint(n,$event); @keydown=keyJoint(n,$event) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 점 n pointerdown→capture→moveJoint, 부모 canvas pointermove로 0..1 정규화 좌표 갱신. 방향키는 x/y를0.01 이동·경계 clamp. motion=joints, articulation=experimental, preview emit
4. 예상저장/불변필드: 015 저장 전 joints 초안만. pointerup/cancel은 editing=false이며 이동 전 좌표로 되돌리지 않음. 핀치 조작 구현 없음
5. 취소·복귀검사: pointercancel은 editing=false만; 이미바뀐좌표는남음. 이전좌표복원은없고패널닫기에서저장prefs를복원. 포커스는점button에남음.
6. 실패/경계검사: joints[n]을 (0,0)/(1,1)로 준비,방향키와영역밖pointer를입력해clamp검사. pointercancel후editing=false·좌표유지확인. 저장실패검사는015에위임.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-008 · UI-026 · 이름 미지정

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `이름 미지정`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"ref": "input", "class": "hidden", "type": "file", "accept": "image/*", "@change": "onPick"}`.
- 준비/이전 상태: 사진 탭, 숨김 file input
- 입력: @change=onPick / 키보드: display:none입력에는직접Tab접근없음. 대응사진선택button Enter/Space→OS선택창,Esc는OS선택취소. / 터치: OS사진선택UI;capture힌트는실제기기마다다름
- 실행 후 UI·카메라·씬: image/*20MB 이하 합성 PNG 선택→value 초기화→busy→processImage→original=file·image=cutout/display·cfg.mode=image·imageSource=upload→prepareJoints
- 데이터·저장 시점: 원본은 초안 original로 보존, prefs 저장은015. 파일선택 취소 시 f없음으로 return
- 실행 연결: WorldAvatar.vue::onPick, WorldAvatar.vue::prepareJoints (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "preview", "to": "WorldView.vue", "receiver": "previewAvatar", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 사진 탭, 숨김 file input. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 원본은 초안 original로 보존, prefs 저장은015. 파일선택 취소 시 f없음으로 return
- 취소·ESC·포커스: 원본은 초안 original로 보존, prefs 저장은015. 파일선택 취소 시 f없음으로 return / 이 요소의 전환 후 상태: image/*20MB 이하 합성 PNG 선택→value 초기화→busy→processImage→original=file·image=cutout/display·cfg.mode=image·imageSource=upload→prepareJoints / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. OS사진선택UI;capture힌트는실제기기마다다름 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:122; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 사진 탭, 숨김 file input 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-008 에 @change=onPick 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: image/*20MB 이하 합성 PNG 선택→value 초기화→busy→processImage→original=file·image=cutout/display·cfg.mode=image·imageSource=upload→prepareJoints
4. 예상저장/불변필드: 원본은 초안 original로 보존, prefs 저장은015. 파일선택 취소 시 f없음으로 return
5. 취소·복귀검사: 원본은 초안 original로 보존, prefs 저장은015. 파일선택 취소 시 f없음으로 return / 이 요소의 전환 후 상태: image/*20MB 이하 합성 PNG 선택→value 초기화→busy→processImage→original=file·image=cutout/display·cfg.mode=image·imageSource=upload→prepareJoints / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::processImage를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 원본은 초안 original로 보존, prefs 저장은015. 파일선택 취소 시 f없음으로 return

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-009 · UI-027 · {{busy ? '배경을 지우는 중…' : '사진 고르기'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `{{busy ? '배경을 지우는 중…' : '사진 고르기'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn g-btn--primary", "type": "button", ":disabled": "busy", "@click": "input?.click()"}`.
- 준비/이전 상태: 사진 탭, busy=false
- 입력: @click=input?.click() / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=input?.click() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: 숨김 input.click()로 OS 파일 선택창 열림. 이후008 change 흐름
- 데이터·저장 시점: 이 버튼만 누르고 파일 선택 취소하면 cfg/prefs 불변
- 실행 연결: WorldAvatar.vue::onPick, WorldAvatar.vue::prepareJoints (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "preview", "to": "WorldView.vue", "receiver": "previewAvatar", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 사진 탭, busy=false. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 이 버튼만 누르고 파일 선택 취소하면 cfg/prefs 불변
- 취소·ESC·포커스: 이 버튼만 누르고 파일 선택 취소하면 cfg/prefs 불변 / 이 요소의 전환 후 상태: 숨김 input.click()로 OS 파일 선택창 열림. 이후008 change 흐름 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=input?.click() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:123; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 사진 탭, busy=false 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-009 에 @click=input?.click() 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 숨김 input.click()로 OS 파일 선택창 열림. 이후008 change 흐름
4. 예상저장/불변필드: 이 버튼만 누르고 파일 선택 취소하면 cfg/prefs 불변
5. 취소·복귀검사: 이 버튼만 누르고 파일 선택 취소하면 cfg/prefs 불변 / 이 요소의 전환 후 상태: 숨김 input.click()로 OS 파일 선택창 열림. 이후008 change 흐름 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::processImage를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 이 버튼만 누르고 파일 선택 취소하면 cfg/prefs 불변

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-010 · UI-028 · a.title || '작품'

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `a.title || '작품'`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "template", "conditions": {"v-if": "withCutout.length"}}, {"tag": "li", "conditions": {"v-for": "a in withCutout"}}]`; 자체속성 `{"type": "button", "class": "thumb", "@click": "useArtwork(a)"}`.
- 준비/이전 상태: cutout 있는 합성 작품 A, 최근12개 목록
- 입력: @click=useArtwork(a) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=useArtwork(a) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: useArtwork(A)→original=A.original, image=A.cutout 또는 display, mode=image,imageSource=artwork→prepareJoints
- 데이터·저장 시점: 작품 A는 수정 안 함. 015에서 prefs.avatarImage에 원본 Blob 저장
- 실행 연결: WorldAvatar.vue::useArtwork, WorldAvatar.vue::prepareJoints (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "preview", "to": "WorldView.vue", "receiver": "previewAvatar", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: cutout 있는 합성 작품 A, 최근12개 목록. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 작품 A는 수정 안 함. 015에서 prefs.avatarImage에 원본 Blob 저장; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 작품 A는 수정 안 함. 015에서 prefs.avatarImage에 원본 Blob 저장 / 이 요소의 전환 후 상태: useArtwork(A)→original=A.original, image=A.cutout 또는 display, mode=image,imageSource=artwork→prepareJoints / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=useArtwork(a) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:128; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. cutout 있는 합성 작품 A, 최근12개 목록 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-010 에 @click=useArtwork(a) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: useArtwork(A)→original=A.original, image=A.cutout 또는 display, mode=image,imageSource=artwork→prepareJoints
4. 예상저장/불변필드: 작품 A는 수정 안 함. 015에서 prefs.avatarImage에 원본 Blob 저장
5. 취소·복귀검사: 작품 A는 수정 안 함. 015에서 prefs.avatarImage에 원본 Blob 저장 / 이 요소의 전환 후 상태: useArtwork(A)→original=A.original, image=A.cutout 또는 display, mode=image,imageSource=artwork→prepareJoints / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=useArtwork(a)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-011 · UI-029 · 자동으로 다시 맞추기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `자동으로 다시 맞추기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "image"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "prepareJoints"}`.
- 준비/이전 상태: 사진 image 존재, 관절 임의 수정
- 입력: @click=prepareJoints / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=prepareJoints 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: estimateJoints(mask) 결과로 cfg.joints 재계산, motion=whole, 안내문구와 preview
- 데이터·저장 시점: 추정값 정확도는 별도 시각 검증 필요. 015 전 저장 없음
- 실행 연결: WorldAvatar.vue::prepareJoints (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "preview", "to": "WorldView.vue", "receiver": "previewAvatar", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 사진 image 존재, 관절 임의 수정. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 추정값 정확도는 별도 시각 검증 필요. 015 전 저장 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 추정값 정확도는 별도 시각 검증 필요. 015 전 저장 없음 / 이 요소의 전환 후 상태: estimateJoints(mask) 결과로 cfg.joints 재계산, motion=whole, 안내문구와 preview / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=prepareJoints 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:133; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 사진 image 존재, 관절 임의 수정 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-011 에 @click=prepareJoints 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: estimateJoints(mask) 결과로 cfg.joints 재계산, motion=whole, 안내문구와 preview
4. 예상저장/불변필드: 추정값 정확도는 별도 시각 검증 필요. 015 전 저장 없음
5. 취소·복귀검사: 추정값 정확도는 별도 시각 검증 필요. 015 전 저장 없음 / 이 요소의 전환 후 상태: estimateJoints(mask) 결과로 cfg.joints 재계산, motion=whole, 안내문구와 preview / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=prepareJoints의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-012 · UI-030 · 형태를 유지하며 움직이기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `형태를 유지하며 움직이기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "image"}}]`; 자체속성 `{"class": "g-btn", "type": "button", ":aria-pressed": "cfg.motion === 'whole'", "@click": "set('motion','whole')"}`.
- 준비/이전 상태: 사진 image 존재, motion=joints
- 입력: @click=set('motion','whole') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=set('motion','whole') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: set motion=whole→형태 유지 움직임 preview, 해당 aria-pressed=true
- 데이터·저장 시점: joints 값 삭제 안 함. 저장은015
- 실행 연결: WorldAvatar.vue::set (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "preview", "to": "WorldView.vue", "receiver": "previewAvatar", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 사진 image 존재, motion=joints. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. joints 값 삭제 안 함. 저장은015; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: joints 값 삭제 안 함. 저장은015 / 이 요소의 전환 후 상태: set motion=whole→형태 유지 움직임 preview, 해당 aria-pressed=true / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=set('motion','whole') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:134; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 사진 image 존재, motion=joints 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-012 에 @click=set('motion','whole') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: set motion=whole→형태 유지 움직임 preview, 해당 aria-pressed=true
4. 예상저장/불변필드: joints 값 삭제 안 함. 저장은015
5. 취소·복귀검사: joints 값 삭제 안 함. 저장은015 / 이 요소의 전환 후 상태: set motion=whole→형태 유지 움직임 preview, 해당 aria-pressed=true / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=set('motion','whole')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-013 · UI-031 · 팔다리 움직임 조정  {{advanced ? '접기' : '열기'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `팔다리 움직임 조정  {{advanced ? '접기' : '열기'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "image"}}]`; 자체속성 `{"class": "g-btn", "type": "button", ":aria-expanded": "advanced", "@click": "advanced=!advanced"}`.
- 준비/이전 상태: 사진 image 존재
- 입력: @click=advanced=!advanced / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=advanced=!advanced 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: advanced 반전, 조정 안내/자동 관절 버튼 표시 또는 접기
- 데이터·저장 시점: cfg와 prefs 변경 없음. 접어도 기존 joints/motion 유지
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 사진 image 존재. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. cfg와 prefs 변경 없음. 접어도 기존 joints/motion 유지; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: cfg와 prefs 변경 없음. 접어도 기존 joints/motion 유지 / 이 요소의 전환 후 상태: advanced 반전, 조정 안내/자동 관절 버튼 표시 또는 접기 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=advanced=!advanced 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:135; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 사진 image 존재 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-013 에 @click=advanced=!advanced 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: advanced 반전, 조정 안내/자동 관절 버튼 표시 또는 접기
4. 예상저장/불변필드: cfg와 prefs 변경 없음. 접어도 기존 joints/motion 유지
5. 취소·복귀검사: cfg와 prefs 변경 없음. 접어도 기존 joints/motion 유지 / 이 요소의 전환 후 상태: advanced 반전, 조정 안내/자동 관절 버튼 표시 또는 접기 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=advanced=!advanced의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-014 · UI-032 · 자동 관절로 움직여 보기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `자동 관절로 움직여 보기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "image"}}, {"tag": "template", "conditions": {"v-if": "advanced"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "set('articulation','experimental');set('motion','joints')"}`.
- 준비/이전 상태: 사진 image 존재, advanced=true
- 입력: @click=set('articulation','experimental');set('motion','joints') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=set('articulation','experimental');set('motion','joints') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: set articulation=experimental 후 set motion=joints; preview 두 번 호출 가능, 관절 점 표시
- 데이터·저장 시점: 시험 기능 상태 저장은015. 실패 복구 catch 없음
- 실행 연결: WorldAvatar.vue::set (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "preview", "to": "WorldView.vue", "receiver": "previewAvatar", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 사진 image 존재, advanced=true. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 시험 기능 상태 저장은015. 실패 복구 catch 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 시험 기능 상태 저장은015. 실패 복구 catch 없음 / 이 요소의 전환 후 상태: set articulation=experimental 후 set motion=joints; preview 두 번 호출 가능, 관절 점 표시 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=set('articulation','experimental');set('motion','joints') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:138; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 사진 image 존재, advanced=true 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-014 에 @click=set('articulation','experimental');set('motion','joints') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: set articulation=experimental 후 set motion=joints; preview 두 번 호출 가능, 관절 점 표시
4. 예상저장/불변필드: 시험 기능 상태 저장은015. 실패 복구 catch 없음
5. 취소·복귀검사: 시험 기능 상태 저장은015. 실패 복구 catch 없음 / 이 요소의 전환 후 상태: set articulation=experimental 후 set motion=joints; preview 두 번 호출 가능, 관절 점 표시 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=set('articulation','experimental');set('motion','joints')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-015 · UI-033 · 저장

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `저장`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"class": "g-btn g-btn--primary", "type": "button", "@click": "emit('save', cfg, cfg.mode === 'image' ? original : null)"}`.
- 준비/이전 상태: 유효 cfg와 prefs 존재, 사진 모드는 original Blob 준비
- 입력: @click=emit('save', cfg, cfg.mode === 'image' ? original : null) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=emit('save', cfg, cfg.mode === 'image' ? original : null) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: save emit→WorldView.saveAvatar→savePrefs(next) await→prefs=next→성공토스트→closePanel(저장된 아바타 재적용). 실패 토스트 후 패널/초안 유지
- 데이터·저장 시점: prefs의 avatar와 avatarImage 저장. store.savePrefs→activeFamily→put(prefs,...,familyId)→IndexedDB 거래. 버튼 busy/중복저장 guard 없음. emit은 부모 Promise를 await하지 않음
- 실행 연결: store.ts::savePrefs (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "save", "to": "WorldView.vue", "receiver": "saveAvatar", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 유효 cfg와 prefs 존재, 사진 모드는 original Blob 준비. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: store.savePrefs reject→부모 say(캐릭터를 저장하지 못했어요); panel과cfg/이미지초안은 유지, prefs는이전값. 재시도는저장버튼. 자식버튼busy/disabled없어중복요청가능. 저장성공후closePanel의setAvatar reject는비await closePanel이라saveAvatar catch로포착안됨.
- 취소·ESC·포커스: 그만두기/ESC는진행중savePrefs를abort하지않음. 성공과취소경합미검증;완료후closePanel이prefs에저장된아바타복원. focus규약은실제로panel이null된경우만적용. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=emit('save', cfg, cfg.mode === 'image' ? original : null) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:146; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 유효 cfg와 prefs 존재, 사진 모드는 original Blob 준비 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-015 에 @click=emit('save', cfg, cfg.mode === 'image' ? original : null) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: save emit→WorldView.saveAvatar→savePrefs(next) await→prefs=next→성공토스트→closePanel(저장된 아바타 재적용). 실패 토스트 후 패널/초안 유지
4. 예상저장/불변필드: prefs의 avatar와 avatarImage 저장. store.savePrefs→activeFamily→put(prefs,...,familyId)→IndexedDB 거래. 버튼 busy/중복저장 guard 없음. emit은 부모 Promise를 await하지 않음
5. 취소·복귀검사: 그만두기/ESC는진행중savePrefs를abort하지않음. 성공과취소경합미검증;완료후closePanel이prefs에저장된아바타복원. focus규약은실제로panel이null된경우만적용.
6. 실패/경계검사: store.ts::savePrefs를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. store.savePrefs reject→부모 say(캐릭터를 저장하지 못했어요); panel과cfg/이미지초안은 유지, prefs는이전값. 재시도는저장버튼. 자식버튼busy/disabled없어중복요청가능. 저장성공후closePanel의setAvatar reject는비await closePanel이라saveAvatar catch로포착안됨.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldAvatar-016 · UI-034 · 그만두기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 이름 근거 `그만두기`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "emit('close')"}`.
- 준비/이전 상태: 캐릭터 초안 변경 후 그만두기
- 입력: @click=emit('close') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=emit('close') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: 001과 같은 close emit, 저장된 prefs 외형 복원 후 닫기
- 데이터·저장 시점: 미저장 cfg와 original 초안 폐기. 이미 진행 중인015 저장을 취소하는 기능은 없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldAvatar.vue", "event": "close", "to": "WorldView.vue", "receiver": "closePanel", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 캐릭터 초안 변경 후 그만두기. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 미저장 cfg와 original 초안 폐기. 이미 진행 중인015 저장을 취소하는 기능은 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 미저장 cfg와 original 초안 폐기. 이미 진행 중인015 저장을 취소하는 기능은 없음 / 이 요소의 전환 후 상태: 001과 같은 close emit, 저장된 prefs 외형 복원 후 닫기 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `avatar` 및 `focus` 참조.
- PC/모바일: 오른쪽 side 폭min(400px,화면-24px);600px이하는하단56vh. 관절점28px,색상36px여서44px최소영역을충족했다고표현하지않음. 탭으로 @click=emit('close') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldAvatar.vue:147; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 캐릭터 초안 변경 후 그만두기 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldAvatar-016 에 @click=emit('close') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 001과 같은 close emit, 저장된 prefs 외형 복원 후 닫기
4. 예상저장/불변필드: 미저장 cfg와 original 초안 폐기. 이미 진행 중인015 저장을 취소하는 기능은 없음
5. 취소·복귀검사: 미저장 cfg와 original 초안 폐기. 이미 진행 중인015 저장을 취소하는 기능은 없음 / 이 요소의 전환 후 상태: 001과 같은 close emit, 저장된 prefs 외형 복원 후 닫기 / ESC·패널닫기는 공통 avatar 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=emit('close')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldFamilies-001 · UI-035 · 테스트 가족 추가

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 설정패널 안 테스트가족 section;DEV/localtest 전용, select 최소44px. 이름 근거 `테스트 가족 추가`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"class": "g-btn", "type": "button", ":disabled": "busy", "@click": "add"}`.
- 준비/이전 상태: DEV/localtest 설정에서 합성 가족만 준비, busy=false
- 입력: @click=add / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=add 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: createTestAccount→새 가족 이름 지정→saveAccount→listFamilies→change emit→부모 familyChanged/boot
- 데이터·저장 시점: 새 테스트 가족과 견본 생성·활성 가족 변경. 중간 단계 실패 시 이미 생긴 가족을 rollback하지 않음
- 실행 연결: WorldFamilies.vue::add, store.ts::saveAccount, store.ts::saveRooms, store.ts::savePrefs (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldFamilies.vue", "event": "change", "to": "WorldView.vue", "receiver": "familyChanged", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: DEV/localtest 설정에서 합성 가족만 준비, busy=false. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 새 테스트 가족과 견본 생성·활성 가족 변경. 중간 단계 실패 시 이미 생긴 가족을 rollback하지 않음
- 취소·ESC·포커스: 새 테스트 가족과 견본 생성·활성 가족 변경. 중간 단계 실패 시 이미 생긴 가족을 rollback하지 않음 / 이 요소의 전환 후 상태: createTestAccount→새 가족 이름 지정→saveAccount→listFamilies→change emit→부모 familyChanged/boot / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: 설정패널 안 테스트가족 section;DEV/localtest 전용, select 최소44px. 탭으로 @click=add 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldFamilies.vue:10; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. DEV/localtest 설정에서 합성 가족만 준비, busy=false 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldFamilies-001 에 @click=add 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: createTestAccount→새 가족 이름 지정→saveAccount→listFamilies→change emit→부모 familyChanged/boot
4. 예상저장/불변필드: 새 테스트 가족과 견본 생성·활성 가족 변경. 중간 단계 실패 시 이미 생긴 가족을 rollback하지 않음
5. 취소·복귀검사: 새 테스트 가족과 견본 생성·활성 가족 변경. 중간 단계 실패 시 이미 생긴 가족을 rollback하지 않음 / 이 요소의 전환 후 상태: createTestAccount→새 가족 이름 지정→saveAccount→listFamilies→change emit→부모 familyChanged/boot / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::saveAccount를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 새 테스트 가족과 견본 생성·활성 가족 변경. 중간 단계 실패 시 이미 생긴 가족을 rollback하지 않음

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldFamilies-002 · UI-036 · 가족을 골라 주세요 {{f.child}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 설정패널 안 테스트가족 section;DEV/localtest 전용, select 최소44px. 이름 근거 `가족 바꾸기 가족을 골라 주세요 {{f.child}}`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"class": "w-family-select", ":disabled": "busy", "@change": "choose(($event.target as HTMLSelectElement).value)"}`.
- 준비/이전 상태: DEV/localtest, 합성 가족 A와B 존재
- 입력: @change=choose(($event.target as HTMLSelectElement).value) / 키보드: native select: 방향키로항목변경,Enter/Space/Alt+Down등OS기본선택. v-model.number면숫자변환. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: B 선택→selectFamily(B.id)→change emit→부모 방문/패널/선택 초기화 후 boot
- 데이터·저장 시점: meta active와 sessionStorage uam-world-family, 모듈 selectedFamily 변경. 선택 실패는 message; choose 자체 busy 설정 없음
- 실행 연결: WorldFamilies.vue::choose, store.ts::saveRooms (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldFamilies.vue", "event": "change", "to": "WorldView.vue", "receiver": "familyChanged", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: DEV/localtest, 합성 가족 A와B 존재. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. meta active와 sessionStorage uam-world-family, 모듈 selectedFamily 변경. 선택 실패는 message; choose 자체 busy 설정 없음
- 취소·ESC·포커스: meta active와 sessionStorage uam-world-family, 모듈 selectedFamily 변경. 선택 실패는 message; choose 자체 busy 설정 없음 / 이 요소의 전환 후 상태: B 선택→selectFamily(B.id)→change emit→부모 방문/패널/선택 초기화 후 boot / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: 설정패널 안 테스트가족 section;DEV/localtest 전용, select 최소44px. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldFamilies.vue:10; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. DEV/localtest, 합성 가족 A와B 존재 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldFamilies-002 에 @change=choose(($event.target as HTMLSelectElement).value) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: B 선택→selectFamily(B.id)→change emit→부모 방문/패널/선택 초기화 후 boot
4. 예상저장/불변필드: meta active와 sessionStorage uam-world-family, 모듈 selectedFamily 변경. 선택 실패는 message; choose 자체 busy 설정 없음
5. 취소·복귀검사: meta active와 sessionStorage uam-world-family, 모듈 selectedFamily 변경. 선택 실패는 message; choose 자체 busy 설정 없음 / 이 요소의 전환 후 상태: B 선택→selectFamily(B.id)→change emit→부모 방문/패널/선택 초기화 후 boot / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @change=choose(($event.target as HTMLSelectElement).value)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-001 · UI-037 · 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `닫기`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"class": "g-btn", ":disabled": "busy", "@click": "leave"}`.
- 준비/이전 상태: 놀이 패널, busy=false; 획 없음/있음 두 경우
- 입력: @click=leave / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=leave 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: leave: 획 있으면 confirmLeave=true, 없으면 close emit. busy이면 무동작
- 데이터·저장 시점: 닫기 자체 작품 저장 없음; 기존 자동저장 초안은 삭제하지 않음
- 실행 연결: WorldPlay.vue::leave (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldPlay.vue", "event": "close", "to": "WorldView.vue", "receiver": "closePanel", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 놀이 패널, busy=false; 획 없음/있음 두 경우. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 닫기 자체 작품 저장 없음; 기존 자동저장 초안은 삭제하지 않음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 닫기 자체 작품 저장 없음; 기존 자동저장 초안은 삭제하지 않음 / 이 요소의 전환 후 상태: leave: 획 있으면 confirmLeave=true, 없으면 close emit. busy이면 무동작 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=leave 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:54; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 놀이 패널, busy=false; 획 없음/있음 두 경우 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-001 에 @click=leave 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: leave: 획 있으면 confirmLeave=true, 없으면 close emit. busy이면 무동작
4. 예상저장/불변필드: 닫기 자체 작품 저장 없음; 기존 자동저장 초안은 삭제하지 않음
5. 취소·복귀검사: 닫기 자체 작품 저장 없음; 기존 자동저장 초안은 삭제하지 않음 / 이 요소의 전환 후 상태: leave: 획 있으면 confirmLeave=true, 없으면 close emit. busy이면 무동작 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=leave의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-002 · UI-038 · ✎ 함께 그리기 {{restored?'그리던 그림을 이어서 그려요':'선을 하나씩 더해 우리 그림을 만들어요'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `✎ 함께 그리기 {{restored?'그리던 그림을 이어서 그려요':'선을 하나씩 더해 우리 그림을 만들어요'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='menu'"}}]`; 자체속성 `{"@click": "choose('draw')"}`.
- 준비/이전 상태: 놀이 메뉴, 저장된 합성 초안 유무 각각
- 입력: @click=choose('draw') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=choose('draw') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: choose draw→game=draw, msg/celebrate/confirmLeave 초기화, nextTick redraw
- 데이터·저장 시점: getDraft로 복원된 strokes 유지. 선택 자체 DB 쓰기 없음
- 실행 연결: WorldPlay.vue::choose, WorldPlay.vue::resetPairs, WorldPlay.vue::resetPuzzle, WorldPlay.vue::shuffled, WorldPlay.vue::signatures, WorldPlay.vue::image (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 놀이 메뉴, 저장된 합성 초안 유무 각각. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. getDraft로 복원된 strokes 유지. 선택 자체 DB 쓰기 없음
- 취소·ESC·포커스: getDraft로 복원된 strokes 유지. 선택 자체 DB 쓰기 없음 / 이 요소의 전환 후 상태: choose draw→game=draw, msg/celebrate/confirmLeave 초기화, nextTick redraw / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=choose('draw') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:57; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 놀이 메뉴, 저장된 합성 초안 유무 각각 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-002 에 @click=choose('draw') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: choose draw→game=draw, msg/celebrate/confirmLeave 초기화, nextTick redraw
4. 예상저장/불변필드: getDraft로 복원된 strokes 유지. 선택 자체 DB 쓰기 없음
5. 취소·복귀검사: getDraft로 복원된 strokes 유지. 선택 자체 DB 쓰기 없음 / 이 요소의 전환 후 상태: choose draw→game=draw, msg/celebrate/confirmLeave 초기화, nextTick redraw / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=choose('draw')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-003 · UI-039 · ▧ 우리 작품 짝 찾기 같은 작품 두 장을 함께 찾아요

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `▧ 우리 작품 짝 찾기 같은 작품 두 장을 함께 찾아요`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='menu'"}}]`; 자체속성 `{"@click": "choose('pairs')"}`.
- 준비/이전 상태: 합성 작품4개 이상, 놀이 메뉴
- 입력: @click=choose('pairs') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=choose('pairs') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: choose pairs→resetPairs, 4쌍 카드와 pairTurn1, matched/flipped 빈 배열
- 데이터·저장 시점: 게임 진행은 메모리만; 작품 불변
- 실행 연결: WorldPlay.vue::choose, WorldPlay.vue::resetPairs, WorldPlay.vue::resetPuzzle, WorldPlay.vue::shuffled, WorldPlay.vue::signatures, WorldPlay.vue::image (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성 작품4개 이상, 놀이 메뉴. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 게임 진행은 메모리만; 작품 불변
- 취소·ESC·포커스: 게임 진행은 메모리만; 작품 불변 / 이 요소의 전환 후 상태: choose pairs→resetPairs, 4쌍 카드와 pairTurn1, matched/flipped 빈 배열 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=choose('pairs') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:57; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성 작품4개 이상, 놀이 메뉴 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-003 에 @click=choose('pairs') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: choose pairs→resetPairs, 4쌍 카드와 pairTurn1, matched/flipped 빈 배열
4. 예상저장/불변필드: 게임 진행은 메모리만; 작품 불변
5. 취소·복귀검사: 게임 진행은 메모리만; 작품 불변 / 이 요소의 전환 후 상태: choose pairs→resetPairs, 4쌍 카드와 pairTurn1, matched/flipped 빈 배열 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=choose('pairs')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-004 · UI-040 · ▦ 작품 퍼즐 우리 작품을 다시 맞춰 봐요

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `▦ 작품 퍼즐 우리 작품을 다시 맞춰 봐요`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='menu'"}}]`; 자체속성 `{"@click": "choose('puzzle')"}`.
- 준비/이전 상태: 서로 구분되는 합성 작품1개 이상
- 입력: @click=choose('puzzle') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=choose('puzzle') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: choose puzzle→resetPuzzle 비동기, 원비율 유지 판과 섞인4조각
- 데이터·저장 시점: 퍼즐 선택 자체 저장 없음; 이미지 decode 실패 시 번호 기반 판정 대체
- 실행 연결: WorldPlay.vue::choose, WorldPlay.vue::resetPairs, WorldPlay.vue::resetPuzzle, WorldPlay.vue::shuffled, WorldPlay.vue::signatures, WorldPlay.vue::image (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 서로 구분되는 합성 작품1개 이상. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 퍼즐 선택 자체 저장 없음; 이미지 decode 실패 시 번호 기반 판정 대체
- 취소·ESC·포커스: 퍼즐 선택 자체 저장 없음; 이미지 decode 실패 시 번호 기반 판정 대체 / 이 요소의 전환 후 상태: choose puzzle→resetPuzzle 비동기, 원비율 유지 판과 섞인4조각 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=choose('puzzle') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:57; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 서로 구분되는 합성 작품1개 이상 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-004 에 @click=choose('puzzle') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: choose puzzle→resetPuzzle 비동기, 원비율 유지 판과 섞인4조각
4. 예상저장/불변필드: 퍼즐 선택 자체 저장 없음; 이미지 decode 실패 시 번호 기반 판정 대체
5. 취소·복귀검사: 퍼즐 선택 자체 저장 없음; 이미지 decode 실패 시 번호 기반 판정 대체 / 이 요소의 전환 후 상태: choose puzzle→resetPuzzle 비동기, 원비율 유지 판과 섞인4조각 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=choose('puzzle')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-005 · UI-041 · '그림 색 '+c

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `'그림 색 '+c`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='draw'"}}]`; 자체속성 `{"v-for": "c in colors", ":key": "c", ":style": "{background:c}", "class": "w-color", ":aria-label": "'그림 색 '+c", ":aria-pressed": "color===c", ":disabled": "busy", "@click": "color=c"}`.
- 준비/이전 상태: 그리기 화면, busy=false
- 입력: @click=color=c / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=color=c 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: 색 c 선택→color=c, aria-pressed. 이미 그린 획 색은 유지
- 데이터·저장 시점: 새 획부터 c 사용; 선택 자체 draft DB에 color 설정 저장 안 함
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 그리기 화면, busy=false. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 새 획부터 c 사용; 선택 자체 draft DB에 color 설정 저장 안 함; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 새 획부터 c 사용; 선택 자체 draft DB에 color 설정 저장 안 함 / 이 요소의 전환 후 상태: 색 c 선택→color=c, aria-pressed. 이미 그린 획 색은 유지 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=color=c 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:63; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 그리기 화면, busy=false 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-005 에 @click=color=c 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 색 c 선택→color=c, aria-pressed. 이미 그린 획 색은 유지
4. 예상저장/불변필드: 새 획부터 c 사용; 선택 자체 draft DB에 color 설정 저장 안 함
5. 취소·복귀검사: 새 획부터 c 사용; 선택 자체 draft DB에 color 설정 저장 안 함 / 이 요소의 전환 후 상태: 색 c 선택→color=c, aria-pressed. 이미 그린 획 색은 유지 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=color=c의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-006 · UI-042 · width

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `선 굵기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='draw'"}}]`; 자체속성 `{"v-model.number": "width", "type": "range", "min": "3", "max": "30", ":disabled": "busy"}`.
- 준비/이전 상태: 그리기 화면, width10
- 입력: ; v-model.number=width / 키보드: native range 방향키로1씩(기본step),Home/End범위끝. 포커스후월드걷기로전파되지않는지검사. / 터치: 슬라이더손잡이를가로로끌어3..30 변경;월드회전이아님.
- 실행 후 UI·카메라·씬: range를12로→width 숫자12, 범위3..30. 기존 획 굵기 불변
- 데이터·저장 시점: 새 획부터12 사용; range 자체 저장 없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 그리기 화면, width10. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 새 획부터12 사용; range 자체 저장 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 새 획부터12 사용; range 자체 저장 없음 / 이 요소의 전환 후 상태: range를12로→width 숫자12, 범위3..30. 기존 획 굵기 불변 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 슬라이더손잡이를가로로끌어3..30 변경;월드회전이아님. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:63; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 그리기 화면, width10 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-006 에 ; v-model.number=width 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: range를12로→width 숫자12, 범위3..30. 기존 획 굵기 불변
4. 예상저장/불변필드: 새 획부터12 사용; range 자체 저장 없음
5. 취소·복귀검사: 새 획부터12 사용; range 자체 저장 없음 / 이 요소의 전환 후 상태: range를12로→width 숫자12, 범위3..30. 기존 획 굵기 불변 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. ; v-model.number=width의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-007 · UI-043 · 한 번 되돌리기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `한 번 되돌리기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='draw'"}}]`; 자체속성 `{"class": "g-btn", ":disabled": "!strokes.length||busy", "@click": "undo"}`.
- 준비/이전 상태: 그리기 획2개, busy=false
- 입력: @click=undo / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=undo 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: undo→마지막 획 pop→redraw→persistDraft 순차 저장
- 데이터·저장 시점: 남은1획을 가족 drafts에 저장; 마지막 획까지 취소하면 deleteDraft. 실패 시 draftWarn
- 실행 연결: WorldPlay.vue::undo, WorldPlay.vue::redraw, WorldPlay.vue::persistDraft, store.ts::saveDraft, store.ts::deleteDraft (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 그리기 획2개, busy=false. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 남은1획을 가족 drafts에 저장; 마지막 획까지 취소하면 deleteDraft. 실패 시 draftWarn
- 취소·ESC·포커스: 남은1획을 가족 drafts에 저장; 마지막 획까지 취소하면 deleteDraft. 실패 시 draftWarn / 이 요소의 전환 후 상태: undo→마지막 획 pop→redraw→persistDraft 순차 저장 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=undo 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:63; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 그리기 획2개, busy=false 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-007 에 @click=undo 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: undo→마지막 획 pop→redraw→persistDraft 순차 저장
4. 예상저장/불변필드: 남은1획을 가족 drafts에 저장; 마지막 획까지 취소하면 deleteDraft. 실패 시 draftWarn
5. 취소·복귀검사: 남은1획을 가족 drafts에 저장; 마지막 획까지 취소하면 deleteDraft. 실패 시 draftWarn / 이 요소의 전환 후 상태: undo→마지막 획 pop→redraw→persistDraft 순차 저장 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::saveDraft를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 남은1획을 가족 drafts에 저장; 마지막 획까지 취소하면 deleteDraft. 실패 시 draftWarn

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-008 · UI-044 · 다음 사람 차례

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `다음 사람 차례`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='draw'"}}]`; 자체속성 `{"class": "g-btn", ":disabled": "busy", "@click": "nextTurn"}`.
- 준비/이전 상태: 그리기 turn1, busy=false
- 입력: @click=nextTurn / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=nextTurn 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: nextTurn→turn2→persistDraft
- 데이터·저장 시점: 획 있을 때 turn2 포함 drafts 저장. 획 없으면 deleteDraft; 실패 시 경고, turn rollback 없음
- 실행 연결: WorldPlay.vue::nextTurn, WorldPlay.vue::persistDraft, store.ts::saveDraft, store.ts::deleteDraft (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 그리기 turn1, busy=false. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 획 있을 때 turn2 포함 drafts 저장. 획 없으면 deleteDraft; 실패 시 경고, turn rollback 없음
- 취소·ESC·포커스: 획 있을 때 turn2 포함 drafts 저장. 획 없으면 deleteDraft; 실패 시 경고, turn rollback 없음 / 이 요소의 전환 후 상태: nextTurn→turn2→persistDraft / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=nextTurn 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:65; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 그리기 turn1, busy=false 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-008 에 @click=nextTurn 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: nextTurn→turn2→persistDraft
4. 예상저장/불변필드: 획 있을 때 turn2 포함 drafts 저장. 획 없으면 deleteDraft; 실패 시 경고, turn rollback 없음
5. 취소·복귀검사: 획 있을 때 turn2 포함 drafts 저장. 획 없으면 deleteDraft; 실패 시 경고, turn rollback 없음 / 이 요소의 전환 후 상태: nextTurn→turn2→persistDraft / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::saveDraft를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 획 있을 때 turn2 포함 drafts 저장. 획 없으면 deleteDraft; 실패 시 경고, turn rollback 없음

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-009 · UI-045 · {{busy?'그림을 보관하는 중…':'우리 그림 보관하기'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `{{busy?'그림을 보관하는 중…':'우리 그림 보관하기'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='draw'"}}]`; 자체속성 `{"class": "g-btn g-btn--primary", ":disabled": "!strokes.length||busy", "@click": "saveDrawing"}`.
- 준비/이전 상태: 그리기 합성 획1개 이상, busy=false
- 입력: @click=saveDrawing / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=saveDrawing 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: pendingDraft 완료→canvas PNG→processImage(false)→작품 저장→saved emit→부모 onSaved 패널닫기/reload/완료 카드
- 데이터·저장 시점: 동일 saveId, title=함께 그린 그림, original=PNG, clearDraft=true 동일 거래. 실패 시 획 유지·msg·busy 해제. 부모 reload 실패는 자식 catch 밖
- 실행 연결: WorldPlay.vue::saveDrawing, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldPlay.vue", "event": "saved", "to": "WorldView.vue", "receiver": "onSaved", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 그리기 합성 획1개 이상, busy=false. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 동일 saveId, title=함께 그린 그림, original=PNG, clearDraft=true 동일 거래. 실패 시 획 유지·msg·busy 해제. 부모 reload 실패는 자식 catch 밖
- 취소·ESC·포커스: 동일 saveId, title=함께 그린 그림, original=PNG, clearDraft=true 동일 거래. 실패 시 획 유지·msg·busy 해제. 부모 reload 실패는 자식 catch 밖 / 이 요소의 전환 후 상태: pendingDraft 완료→canvas PNG→processImage(false)→작품 저장→saved emit→부모 onSaved 패널닫기/reload/완료 카드 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=saveDrawing 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:65; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 그리기 합성 획1개 이상, busy=false 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-009 에 @click=saveDrawing 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: pendingDraft 완료→canvas PNG→processImage(false)→작품 저장→saved emit→부모 onSaved 패널닫기/reload/완료 카드
4. 예상저장/불변필드: 동일 saveId, title=함께 그린 그림, original=PNG, clearDraft=true 동일 거래. 실패 시 획 유지·msg·busy 해제. 부모 reload 실패는 자식 catch 밖
5. 취소·복귀검사: 동일 saveId, title=함께 그린 그림, original=PNG, clearDraft=true 동일 거래. 실패 시 획 유지·msg·busy 해제. 부모 reload 실패는 자식 catch 밖 / 이 요소의 전환 후 상태: pendingDraft 완료→canvas PNG→processImage(false)→작품 저장→saved emit→부모 onSaved 패널닫기/reload/완료 카드 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::saveArtworkAndRoom를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 동일 saveId, title=함께 그린 그림, original=PNG, clearDraft=true 동일 거래. 실패 시 획 유지·msg·busy 해제. 부모 reload 실패는 자식 catch 밖

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-010 · UI-046 · 4쌍

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `4쌍`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='pairs'"}}]`; 자체속성 `{"class": "g-btn", ":aria-pressed": "pairCount===4", "@click": "pairCount=4;resetPairs()"}`.
- 준비/이전 상태: 짝 찾기, 합성 작품4개 이상
- 입력: @click=pairCount=4;resetPairs() / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=pairCount=4;resetPairs() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: pairCount=4, resetPairs→카드8개, matched/flipped0, pairTurn1
- 데이터·저장 시점: 저장 없음. 이전 게임 진행 폐기
- 실행 연결: WorldPlay.vue::resetPairs, WorldPlay.vue::shuffled (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 짝 찾기, 합성 작품4개 이상. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 저장 없음. 이전 게임 진행 폐기; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 저장 없음. 이전 게임 진행 폐기 / 이 요소의 전환 후 상태: pairCount=4, resetPairs→카드8개, matched/flipped0, pairTurn1 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=pairCount=4;resetPairs() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:68; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 짝 찾기, 합성 작품4개 이상 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-010 에 @click=pairCount=4;resetPairs() 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: pairCount=4, resetPairs→카드8개, matched/flipped0, pairTurn1
4. 예상저장/불변필드: 저장 없음. 이전 게임 진행 폐기
5. 취소·복귀검사: 저장 없음. 이전 게임 진행 폐기 / 이 요소의 전환 후 상태: pairCount=4, resetPairs→카드8개, matched/flipped0, pairTurn1 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=pairCount=4;resetPairs()의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-011 · UI-047 · 6쌍

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `6쌍`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='pairs'"}}]`; 자체속성 `{"class": "g-btn", ":aria-pressed": "pairCount===6", "@click": "pairCount=6;resetPairs()"}`.
- 준비/이전 상태: 짝 찾기, 합성 작품6개 이상
- 입력: @click=pairCount=6;resetPairs() / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=pairCount=6;resetPairs() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: pairCount=6, resetPairs→카드12개, matched/flipped0, pairTurn1
- 데이터·저장 시점: 6개 미만이면 enough=false 안내; 작품을 생성하지 않음
- 실행 연결: WorldPlay.vue::resetPairs, WorldPlay.vue::shuffled (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 짝 찾기, 합성 작품6개 이상. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 6개 미만이면 enough=false 안내; 작품을 생성하지 않음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 6개 미만이면 enough=false 안내; 작품을 생성하지 않음 / 이 요소의 전환 후 상태: pairCount=6, resetPairs→카드12개, matched/flipped0, pairTurn1 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=pairCount=6;resetPairs() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:68; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 짝 찾기, 합성 작품6개 이상 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-011 에 @click=pairCount=6;resetPairs() 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: pairCount=6, resetPairs→카드12개, matched/flipped0, pairTurn1
4. 예상저장/불변필드: 6개 미만이면 enough=false 안내; 작품을 생성하지 않음
5. 취소·복귀검사: 6개 미만이면 enough=false 안내; 작품을 생성하지 않음 / 이 요소의 전환 후 상태: pairCount=6, resetPairs→카드12개, matched/flipped0, pairTurn1 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=pairCount=6;resetPairs()의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-012 · UI-048 · 다시 섞기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `다시 섞기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='pairs'"}}]`; 자체속성 `{"class": "g-btn", "@click": "resetPairs"}`.
- 준비/이전 상태: 진행 중 짝 찾기
- 입력: @click=resetPairs / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=resetPairs 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: resetPairs→다시 섞고 matched/flipped 초기화·차례1·축하해제
- 데이터·저장 시점: 진행 저장 없음. 취소/되돌리기 없음
- 실행 연결: WorldPlay.vue::resetPairs, WorldPlay.vue::shuffled (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 진행 중 짝 찾기. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 진행 저장 없음. 취소/되돌리기 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 진행 저장 없음. 취소/되돌리기 없음 / 이 요소의 전환 후 상태: resetPairs→다시 섞고 matched/flipped 초기화·차례1·축하해제 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=resetPairs 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:68; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 진행 중 짝 찾기 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-012 에 @click=resetPairs 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: resetPairs→다시 섞고 matched/flipped 초기화·차례1·축하해제
4. 예상저장/불변필드: 진행 저장 없음. 취소/되돌리기 없음
5. 취소·복귀검사: 진행 저장 없음. 취소/되돌리기 없음 / 이 요소의 전환 후 상태: resetPairs→다시 섞고 matched/flipped 초기화·차례1·축하해제 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=resetPairs의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-013 · UI-049 · flipped.includes(i)||matched.includes(c.art.id)?(c.art.title||'작품'):(i+1)+'번 카드 뒤집기'

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `flipped.includes(i)||matched.includes(c.art.id)?(c.art.title||'작품'):(i+1)+'번 카드 뒤집기'`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='pairs'"}}, {"tag": "template", "conditions": {"v-if": "enough"}}]`; 자체속성 `{"v-for": "(c,i) in cards", ":key": "c.id", "class": "w-pair", ":class": "{'w-open':flipped.includes(i)||matched.includes(c.art.id),'w-matched':matched.includes(c.art.id)}", ":disabled": "matched.includes(c.art.id)", ":aria-label": "flipped.includes(i)||matched.includes(c.art.id)?(c.art.title||'작품'):(i+1)+'번 카드 뒤집기'", "@click": "flip(i)"}`.
- 준비/이전 상태: 짝 찾기, 아직 안 맞춘 카드 i
- 입력: @click=flip(i) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=flip(i) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: 1장 선택은 flipped에i 추가. 같은작품2장은 matched 추가; 다른작품2장은900ms 후 닫고 차례교대. 모두맞춤 celebrate
- 데이터·저장 시점: matched 카드 disabled;2장 열린 동안추가입력 guard. 작품 DB 불변
- 실행 연결: WorldPlay.vue::flip (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 짝 찾기, 아직 안 맞춘 카드 i. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. matched 카드 disabled;2장 열린 동안추가입력 guard. 작품 DB 불변; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: matched 카드 disabled;2장 열린 동안추가입력 guard. 작품 DB 불변 / 이 요소의 전환 후 상태: 1장 선택은 flipped에i 추가. 같은작품2장은 matched 추가; 다른작품2장은900ms 후 닫고 차례교대. 모두맞춤 celebrate / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=flip(i) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:69; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 짝 찾기, 아직 안 맞춘 카드 i 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-013 에 @click=flip(i) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 1장 선택은 flipped에i 추가. 같은작품2장은 matched 추가; 다른작품2장은900ms 후 닫고 차례교대. 모두맞춤 celebrate
4. 예상저장/불변필드: matched 카드 disabled;2장 열린 동안추가입력 guard. 작품 DB 불변
5. 취소·복귀검사: matched 카드 disabled;2장 열린 동안추가입력 guard. 작품 DB 불변 / 이 요소의 전환 후 상태: 1장 선택은 flipped에i 추가. 같은작품2장은 matched 추가; 다른작품2장은900ms 후 닫고 차례교대. 모두맞춤 celebrate / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=flip(i)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-014 · UI-050 · 함께 그리기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `함께 그리기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='pairs'"}}, {"tag": "p", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn", "@click": "choose('draw')"}`.
- 준비/이전 상태: 짝 찾기 작품 부족 안내
- 입력: @click=choose('draw') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=choose('draw') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: choose draw→빈/복원 도화지로 이동
- 데이터·저장 시점: 부족 작품을 자동생성하지 않음; 다른 게임 진행은 저장 안 함
- 실행 연결: WorldPlay.vue::choose, WorldPlay.vue::resetPairs, WorldPlay.vue::resetPuzzle, WorldPlay.vue::shuffled, WorldPlay.vue::signatures, WorldPlay.vue::image (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 짝 찾기 작품 부족 안내. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 부족 작품을 자동생성하지 않음; 다른 게임 진행은 저장 안 함
- 취소·ESC·포커스: 부족 작품을 자동생성하지 않음; 다른 게임 진행은 저장 안 함 / 이 요소의 전환 후 상태: choose draw→빈/복원 도화지로 이동 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=choose('draw') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:70; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 짝 찾기 작품 부족 안내 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-014 에 @click=choose('draw') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: choose draw→빈/복원 도화지로 이동
4. 예상저장/불변필드: 부족 작품을 자동생성하지 않음; 다른 게임 진행은 저장 안 함
5. 취소·복귀검사: 부족 작품을 자동생성하지 않음; 다른 게임 진행은 저장 안 함 / 이 요소의 전환 후 상태: choose draw→빈/복원 도화지로 이동 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=choose('draw')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-015 · UI-051 · {{a.title||'우리 작품'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `맞출 작품 {{a.title||'우리 작품'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='puzzle'"}}, {"tag": "template", "conditions": {"v-if": "puzzle"}}]`; 자체속성 `{"v-model": "puzzleArt"}`.
- 준비/이전 상태: 퍼즐 화면, 합성 A/B 존재
- 입력: ; v-model=puzzleArt / 키보드: native select: 방향키로항목변경,Enter/Space/Alt+Down등OS기본선택. v-model.number면숫자변환. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: puzzleArt=B.id; watcher가 resetPuzzle 호출→B판, selected=null,showOriginal=false
- 데이터·저장 시점: DB 불변. resetPuzzle token으로 오래된 비동기 결과 무시
- 실행 연결: WorldPlay.vue::resetPuzzle, WorldPlay.vue::signatures, WorldPlay.vue::image (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 퍼즐 화면, 합성 A/B 존재. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. DB 불변. resetPuzzle token으로 오래된 비동기 결과 무시
- 취소·ESC·포커스: DB 불변. resetPuzzle token으로 오래된 비동기 결과 무시 / 이 요소의 전환 후 상태: puzzleArt=B.id; watcher가 resetPuzzle 호출→B판, selected=null,showOriginal=false / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:73; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 퍼즐 화면, 합성 A/B 존재 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-015 에 ; v-model=puzzleArt 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: puzzleArt=B.id; watcher가 resetPuzzle 호출→B판, selected=null,showOriginal=false
4. 예상저장/불변필드: DB 불변. resetPuzzle token으로 오래된 비동기 결과 무시
5. 취소·복귀검사: DB 불변. resetPuzzle token으로 오래된 비동기 결과 무시 / 이 요소의 전환 후 상태: puzzleArt=B.id; watcher가 resetPuzzle 호출→B판, selected=null,showOriginal=false / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. ; v-model=puzzleArt의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-016 · UI-052 · 4조각

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `4조각`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='puzzle'"}}, {"tag": "template", "conditions": {"v-if": "puzzle"}}]`; 자체속성 `{"class": "g-btn", ":aria-pressed": "size===2", "@click": "size=2;resetPuzzle()"}`.
- 준비/이전 상태: 퍼즐 A, size3
- 입력: @click=size=2;resetPuzzle() / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=size=2;resetPuzzle() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: size=2→resetPuzzle→4조각, 선택/원본표시/축하 초기화
- 데이터·저장 시점: 현재 배열 폐기, 저장 없음
- 실행 연결: WorldPlay.vue::resetPuzzle, WorldPlay.vue::signatures, WorldPlay.vue::image (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 퍼즐 A, size3. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 현재 배열 폐기, 저장 없음
- 취소·ESC·포커스: 현재 배열 폐기, 저장 없음 / 이 요소의 전환 후 상태: size=2→resetPuzzle→4조각, 선택/원본표시/축하 초기화 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=size=2;resetPuzzle() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:73; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 퍼즐 A, size3 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-016 에 @click=size=2;resetPuzzle() 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: size=2→resetPuzzle→4조각, 선택/원본표시/축하 초기화
4. 예상저장/불변필드: 현재 배열 폐기, 저장 없음
5. 취소·복귀검사: 현재 배열 폐기, 저장 없음 / 이 요소의 전환 후 상태: size=2→resetPuzzle→4조각, 선택/원본표시/축하 초기화 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=size=2;resetPuzzle()의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-017 · UI-053 · 9조각

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `9조각`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='puzzle'"}}, {"tag": "template", "conditions": {"v-if": "puzzle"}}]`; 자체속성 `{"class": "g-btn", ":aria-pressed": "size===3", "@click": "size=3;resetPuzzle()"}`.
- 준비/이전 상태: 퍼즐 A, size2
- 입력: @click=size=3;resetPuzzle() / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=size=3;resetPuzzle() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: size=3→resetPuzzle→9조각, 선택/원본표시/축하 초기화
- 데이터·저장 시점: 현재 배열 폐기, 저장 없음
- 실행 연결: WorldPlay.vue::resetPuzzle, WorldPlay.vue::signatures, WorldPlay.vue::image (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 퍼즐 A, size2. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 현재 배열 폐기, 저장 없음
- 취소·ESC·포커스: 현재 배열 폐기, 저장 없음 / 이 요소의 전환 후 상태: size=3→resetPuzzle→9조각, 선택/원본표시/축하 초기화 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=size=3;resetPuzzle() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:73; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 퍼즐 A, size2 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-017 에 @click=size=3;resetPuzzle() 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: size=3→resetPuzzle→9조각, 선택/원본표시/축하 초기화
4. 예상저장/불변필드: 현재 배열 폐기, 저장 없음
5. 취소·복귀검사: 현재 배열 폐기, 저장 없음 / 이 요소의 전환 후 상태: size=3→resetPuzzle→9조각, 선택/원본표시/축하 초기화 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=size=3;resetPuzzle()의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-018 · UI-054 · 원본 보기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `원본 보기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='puzzle'"}}, {"tag": "template", "conditions": {"v-if": "puzzle"}}]`; 자체속성 `{"class": "g-btn", ":aria-pressed": "showOriginal", "@click": "showOriginal=!showOriginal"}`.
- 준비/이전 상태: 퍼즐 A와 tiles 표시
- 입력: @click=showOriginal=!showOriginal / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=showOriginal=!showOriginal 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: showOriginal 토글→a.display를 미리보기 img로 표시/숨김
- 데이터·저장 시점: 이름은 원본 보기지만 실제 source는 display; original Blob 다운로드 아님
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 퍼즐 A와 tiles 표시. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 이름은 원본 보기지만 실제 source는 display; original Blob 다운로드 아님; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 이름은 원본 보기지만 실제 source는 display; original Blob 다운로드 아님 / 이 요소의 전환 후 상태: showOriginal 토글→a.display를 미리보기 img로 표시/숨김 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=showOriginal=!showOriginal 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:73; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 퍼즐 A와 tiles 표시 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-018 에 @click=showOriginal=!showOriginal 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: showOriginal 토글→a.display를 미리보기 img로 표시/숨김
4. 예상저장/불변필드: 이름은 원본 보기지만 실제 source는 display; original Blob 다운로드 아님
5. 취소·복귀검사: 이름은 원본 보기지만 실제 source는 display; original Blob 다운로드 아님 / 이 요소의 전환 후 상태: showOriginal 토글→a.display를 미리보기 img로 표시/숨김 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=showOriginal=!showOriginal의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-019 · UI-055 · (i+1)+'번 자리, 그림 조각 '+(v+1)

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `(i+1)+'번 자리, 그림 조각 '+(v+1)`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='puzzle'"}}, {"tag": "template", "conditions": {"v-if": "puzzle"}}, {"tag": "div", "conditions": {"v-if": "tiles.length"}}]`; 자체속성 `{"v-for": "(v,i) in tiles", ":key": "i", ":style": "tileStyle(v)", ":class": "{'w-selected':selected===i,'w-correct':solved}", ":aria-label": "(i+1)+'번 자리, 그림 조각 '+(v+1)", ":aria-pressed": "selected===i", "@click": "tile(i)"}`.
- 준비/이전 상태: 풀리지 않은 퍼즐, 조각i와j
- 입력: @click=tile(i) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=tile(i) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: 첫 클릭 selected=i; 같은 i는 선택취소; 다른 j는 두 tiles 교환. solved면 celebrate와 축하영역 focus
- 데이터·저장 시점: 드래그 교환이 아니라 두 번 클릭/탭. DB 불변
- 실행 연결: WorldPlay.vue::tile (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 풀리지 않은 퍼즐, 조각i와j. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 드래그 교환이 아니라 두 번 클릭/탭. DB 불변; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 드래그 교환이 아니라 두 번 클릭/탭. DB 불변 / 이 요소의 전환 후 상태: 첫 클릭 selected=i; 같은 i는 선택취소; 다른 j는 두 tiles 교환. solved면 celebrate와 축하영역 focus / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=tile(i) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:73; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 풀리지 않은 퍼즐, 조각i와j 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-019 에 @click=tile(i) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 첫 클릭 selected=i; 같은 i는 선택취소; 다른 j는 두 tiles 교환. solved면 celebrate와 축하영역 focus
4. 예상저장/불변필드: 드래그 교환이 아니라 두 번 클릭/탭. DB 불변
5. 취소·복귀검사: 드래그 교환이 아니라 두 번 클릭/탭. DB 불변 / 이 요소의 전환 후 상태: 첫 클릭 selected=i; 같은 i는 선택취소; 다른 j는 두 tiles 교환. solved면 celebrate와 축하영역 focus / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=tile(i)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-020 · UI-056 · 다시 섞기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `다시 섞기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='puzzle'"}}, {"tag": "template", "conditions": {"v-if": "puzzle"}}]`; 자체속성 `{"class": "g-btn", "@click": "resetPuzzle"}`.
- 준비/이전 상태: 퍼즐 진행 중
- 입력: @click=resetPuzzle / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=resetPuzzle 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: resetPuzzle→현재작품/size로 다시 섞기, 선택·원본표시 초기화
- 데이터·저장 시점: 저장 없음; 동일모양이 많아 섞기불가면 다른작품 안내
- 실행 연결: WorldPlay.vue::resetPuzzle, WorldPlay.vue::signatures, WorldPlay.vue::image (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 퍼즐 진행 중. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 저장 없음; 동일모양이 많아 섞기불가면 다른작품 안내
- 취소·ESC·포커스: 저장 없음; 동일모양이 많아 섞기불가면 다른작품 안내 / 이 요소의 전환 후 상태: resetPuzzle→현재작품/size로 다시 섞기, 선택·원본표시 초기화 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=resetPuzzle 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:73; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 퍼즐 진행 중 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-020 에 @click=resetPuzzle 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: resetPuzzle→현재작품/size로 다시 섞기, 선택·원본표시 초기화
4. 예상저장/불변필드: 저장 없음; 동일모양이 많아 섞기불가면 다른작품 안내
5. 취소·복귀검사: 저장 없음; 동일모양이 많아 섞기불가면 다른작품 안내 / 이 요소의 전환 후 상태: resetPuzzle→현재작품/size로 다시 섞기, 선택·원본표시 초기화 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=resetPuzzle의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-021 · UI-057 · 함께 그리기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `함께 그리기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "game==='puzzle'"}}, {"tag": "p", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn", "@click": "choose('draw')"}`.
- 준비/이전 상태: 작품0개 퍼즐 빈 상태
- 입력: @click=choose('draw') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=choose('draw') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: choose draw→그리기 화면
- 데이터·저장 시점: 없는 작품을 저장하거나 외부 이미지 요청하지 않음
- 실행 연결: WorldPlay.vue::choose, WorldPlay.vue::resetPairs, WorldPlay.vue::resetPuzzle, WorldPlay.vue::shuffled, WorldPlay.vue::signatures, WorldPlay.vue::image (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 작품0개 퍼즐 빈 상태. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 없는 작품을 저장하거나 외부 이미지 요청하지 않음
- 취소·ESC·포커스: 없는 작품을 저장하거나 외부 이미지 요청하지 않음 / 이 요소의 전환 후 상태: choose draw→그리기 화면 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=choose('draw') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:73; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 작품0개 퍼즐 빈 상태 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-021 에 @click=choose('draw') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: choose draw→그리기 화면
4. 예상저장/불변필드: 없는 작품을 저장하거나 외부 이미지 요청하지 않음
5. 취소·복귀검사: 없는 작품을 저장하거나 외부 이미지 요청하지 않음 / 이 요소의 전환 후 상태: choose draw→그리기 화면 / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=choose('draw')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-022 · UI-058 · 다른 놀이

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `다른 놀이`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"v-if": "game!=='menu'", "class": "g-btn w-back", ":disabled": "busy", "@click": "choose('menu')"}`.
- 준비/이전 상태: draw/pairs/puzzle에서 busy=false
- 입력: @click=choose('menu') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=choose('menu') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: choose menu→놀이 메뉴, msg/축하/닫기확인 해제, 타이머 clear
- 데이터·저장 시점: strokes 유지; 이미 저장된 초안 삭제 안 함. 카드/퍼즐 재진입은 재설정
- 실행 연결: WorldPlay.vue::choose, WorldPlay.vue::resetPairs, WorldPlay.vue::resetPuzzle, WorldPlay.vue::shuffled, WorldPlay.vue::signatures, WorldPlay.vue::image (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: draw/pairs/puzzle에서 busy=false. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. strokes 유지; 이미 저장된 초안 삭제 안 함. 카드/퍼즐 재진입은 재설정
- 취소·ESC·포커스: strokes 유지; 이미 저장된 초안 삭제 안 함. 카드/퍼즐 재진입은 재설정 / 이 요소의 전환 후 상태: choose menu→놀이 메뉴, msg/축하/닫기확인 해제, 타이머 clear / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=choose('menu') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:77; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. draw/pairs/puzzle에서 busy=false 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-022 에 @click=choose('menu') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: choose menu→놀이 메뉴, msg/축하/닫기확인 해제, 타이머 clear
4. 예상저장/불변필드: strokes 유지; 이미 저장된 초안 삭제 안 함. 카드/퍼즐 재진입은 재설정
5. 취소·복귀검사: strokes 유지; 이미 저장된 초안 삭제 안 함. 카드/퍼즐 재진입은 재설정 / 이 요소의 전환 후 상태: choose menu→놀이 메뉴, msg/축하/닫기확인 해제, 타이머 clear / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=choose('menu')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-023 · UI-059 · 계속 그리기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `계속 그리기`.
- 표시/활성: 조상조건 `[{"tag": "section", "conditions": {"v-if": "confirmLeave"}}]`; 자체속성 `{"class": "g-btn g-btn--primary", ":disabled": "busy", "@click": "choose('draw')"}`.
- 준비/이전 상태: confirmLeave=true, 미저장 획 존재
- 입력: @click=choose('draw') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=choose('draw') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: choose draw→확인닫힘·그리기 복귀·기존 strokes redraw
- 데이터·저장 시점: 초안/작품 불변
- 실행 연결: WorldPlay.vue::choose, WorldPlay.vue::resetPairs, WorldPlay.vue::resetPuzzle, WorldPlay.vue::shuffled, WorldPlay.vue::signatures, WorldPlay.vue::image (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: confirmLeave=true, 미저장 획 존재. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 초안/작품 불변
- 취소·ESC·포커스: 초안/작품 불변 / 이 요소의 전환 후 상태: choose draw→확인닫힘·그리기 복귀·기존 strokes redraw / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=choose('draw') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:78; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. confirmLeave=true, 미저장 획 존재 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-023 에 @click=choose('draw') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: choose draw→확인닫힘·그리기 복귀·기존 strokes redraw
4. 예상저장/불변필드: 초안/작품 불변
5. 취소·복귀검사: 초안/작품 불변 / 이 요소의 전환 후 상태: choose draw→확인닫힘·그리기 복귀·기존 strokes redraw / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=choose('draw')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldPlay-024 · UI-060 · 보관하지 않고 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 이름 근거 `보관하지 않고 닫기`.
- 표시/활성: 조상조건 `[{"tag": "section", "conditions": {"v-if": "confirmLeave"}}]`; 자체속성 `{"class": "g-btn", ":disabled": "busy", "@click": "discard"}`.
- 준비/이전 상태: confirmLeave=true, busy=false
- 입력: @click=discard / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=discard 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: saved=true→pendingDraft 대기→deleteDraft 시도→close emit
- 데이터·저장 시점: 초안 삭제 실패도 catch 후 닫힘; 다음 진입에 초안 재등장 가능. 작품레코드는 생성 안 함
- 실행 연결: WorldPlay.vue::discard, store.ts::deleteDraft (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldPlay.vue", "event": "close", "to": "WorldView.vue", "receiver": "closePanel", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: confirmLeave=true, busy=false. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: deleteDraft reject→catch에서무시하고close emit;다음getDraft에서이전초안재등장가능. 실패알림/재시도메뉴없음.
- 취소·ESC·포커스: 초안 삭제 실패도 catch 후 닫힘; 다음 진입에 초안 재등장 가능. 작품레코드는 생성 안 함 / 이 요소의 전환 후 상태: saved=true→pendingDraft 대기→deleteDraft 시도→close emit / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `play` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대780px/94dvh,600px이하놀이메뉴1열·색버튼34px. 도화지touch-action:none,퍼즐은탭2회. 탭으로 @click=discard 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldPlay.vue:78; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. confirmLeave=true, busy=false 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldPlay-024 에 @click=discard 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: saved=true→pendingDraft 대기→deleteDraft 시도→close emit
4. 예상저장/불변필드: 초안 삭제 실패도 catch 후 닫힘; 다음 진입에 초안 재등장 가능. 작품레코드는 생성 안 함
5. 취소·복귀검사: 초안 삭제 실패도 catch 후 닫힘; 다음 진입에 초안 재등장 가능. 작품레코드는 생성 안 함 / 이 요소의 전환 후 상태: saved=true→pendingDraft 대기→deleteDraft 시도→close emit / ESC·패널닫기는 공통 play 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::deleteDraft를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. deleteDraft reject→catch에서무시하고close emit;다음getDraft에서이전초안재등장가능. 실패알림/재시도메뉴없음.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldSocial-001 · UI-061 · 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 이름 근거 `닫기`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "emit('close')"}`.
- 준비/이전 상태: 친구 패널, token 유무 각각
- 입력: @click=emit('close') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=emit('close') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: close emit→closePanel; inviteToken 있으면 비우고 URL /app/world로 교체
- 데이터·저장 시점: 친구관계/초대 DB 불변. 진행중 create/accept Promise 취소 안 됨
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldSocial.vue", "event": "close", "to": "WorldView.vue", "receiver": "closePanel", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 친구 패널, token 유무 각각. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 친구관계/초대 DB 불변. 진행중 create/accept Promise 취소 안 됨; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 친구관계/초대 DB 불변. 진행중 create/accept Promise 취소 안 됨 / 이 요소의 전환 후 상태: close emit→closePanel; inviteToken 있으면 비우고 URL /app/world로 교체 / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `social` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 탭으로 @click=emit('close') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldSocial.vue:16; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 친구 패널, token 유무 각각 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldSocial-001 에 @click=emit('close') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: close emit→closePanel; inviteToken 있으면 비우고 URL /app/world로 교체
4. 예상저장/불변필드: 친구관계/초대 DB 불변. 진행중 create/accept Promise 취소 안 됨
5. 취소·복귀검사: 친구관계/초대 DB 불변. 진행중 create/accept Promise 취소 안 됨 / 이 요소의 전환 후 상태: close emit→closePanel; inviteToken 있으면 비우고 URL /app/world로 교체 / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=emit('close')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldSocial-002 · UI-062 · {{copy.acceptGo}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 이름 근거 `{{copy.acceptGo}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "token"}}]`; 자체속성 `{"class": "g-btn g-btn--primary", "type": "button", ":disabled": "busy", "@click": "accept"}`.
- 준비/이전 상태: 격리 프로필의 다른 합성 가족 유효초대 token
- 입력: @click=accept / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=accept 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: accept→social.accept→history.replaceState→town emit→부모 showTown(id)
- 데이터·저장 시점: socialTransaction으로 초대사용/친구연결 저장. 오류는 explain; busy 해제. 이미 수락된 DB를 부모 마을 실패로 rollback 안 함
- 실행 연결: WorldSocial.vue::accept, WorldSocial.vue::explain (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldSocial.vue", "event": "town", "to": "WorldView.vue", "receiver": "showTown", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 격리 프로필의 다른 합성 가족 유효초대 token. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. socialTransaction으로 초대사용/친구연결 저장. 오류는 explain; busy 해제. 이미 수락된 DB를 부모 마을 실패로 rollback 안 함
- 취소·ESC·포커스: socialTransaction으로 초대사용/친구연결 저장. 오류는 explain; busy 해제. 이미 수락된 DB를 부모 마을 실패로 rollback 안 함 / 이 요소의 전환 후 상태: accept→social.accept→history.replaceState→town emit→부모 showTown(id) / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `social` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 탭으로 @click=accept 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldSocial.vue:16; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 격리 프로필의 다른 합성 가족 유효초대 token 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldSocial-002 에 @click=accept 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: accept→social.accept→history.replaceState→town emit→부모 showTown(id)
4. 예상저장/불변필드: socialTransaction으로 초대사용/친구연결 저장. 오류는 explain; busy 해제. 이미 수락된 DB를 부모 마을 실패로 rollback 안 함
5. 취소·복귀검사: socialTransaction으로 초대사용/친구연결 저장. 오류는 explain; busy 해제. 이미 수락된 DB를 부모 마을 실패로 rollback 안 함 / 이 요소의 전환 후 상태: accept→social.accept→history.replaceState→town emit→부모 showTown(id) / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: social.ts::accept를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. socialTransaction으로 초대사용/친구연결 저장. 오류는 explain; busy 해제. 이미 수락된 DB를 부모 마을 실패로 rollback 안 함

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldSocial-003 · UI-063 · 친구 초대 링크 만들기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 이름 근거 `친구 초대 링크 만들기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn", "type": "button", ":disabled": "busy", "@click": "create"}`.
- 준비/이전 상태: token 없는 친구 패널, 현재 합성 가족
- 입력: @click=create / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=create 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: createInvite→link 설정→refresh pending/friends; busy 해제
- 데이터·저장 시점: 로컬 social 초대기록 생성. 실제 외부친구 전송 없음. refresh 실패면 초대 생성은 이미 완료됐을 수 있음
- 실행 연결: WorldSocial.vue::create, WorldSocial.vue::refresh, WorldSocial.vue::explain (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: token 없는 친구 패널, 현재 합성 가족. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 로컬 social 초대기록 생성. 실제 외부친구 전송 없음. refresh 실패면 초대 생성은 이미 완료됐을 수 있음
- 취소·ESC·포커스: 로컬 social 초대기록 생성. 실제 외부친구 전송 없음. refresh 실패면 초대 생성은 이미 완료됐을 수 있음 / 이 요소의 전환 후 상태: createInvite→link 설정→refresh pending/friends; busy 해제 / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `social` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 탭으로 @click=create 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldSocial.vue:16; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. token 없는 친구 패널, 현재 합성 가족 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldSocial-003 에 @click=create 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: createInvite→link 설정→refresh pending/friends; busy 해제
4. 예상저장/불변필드: 로컬 social 초대기록 생성. 실제 외부친구 전송 없음. refresh 실패면 초대 생성은 이미 완료됐을 수 있음
5. 취소·복귀검사: 로컬 social 초대기록 생성. 실제 외부친구 전송 없음. refresh 실패면 초대 생성은 이미 완료됐을 수 있음 / 이 요소의 전환 후 상태: createInvite→link 설정→refresh pending/friends; busy 해제 / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: social.ts::createInvite를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 로컬 social 초대기록 생성. 실제 외부친구 전송 없음. refresh 실패면 초대 생성은 이미 완료됐을 수 있음

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldSocial-004 · UI-064 · 이름 미지정

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 이름 근거 `{{copy.linkLabel}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "label", "conditions": {"v-if": "link"}}]`; 자체속성 `{"class": "w-link", "readonly": true, ":value": "link", "@focus": "($event.target as HTMLInputElement).select()"}`.
- 준비/이전 상태: 초대 생성 후 link 표시
- 입력: @focus=($event.target as HTMLInputElement).select() / 키보드: native input의텍스트/날짜입력. readonly이면편집불가. 폼내Enter의submit여부는formSubmit/조상form근거를따름. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: readonly input focus→select() 전체선택. Ctrl/Cmd+C 또는 모바일 선택메뉴로 사용자가 복사
- 데이터·저장 시점: 자동 clipboard.writeText 호출 없음. 편집/저장 없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 초대 생성 후 link 표시. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 자동 clipboard.writeText 호출 없음. 편집/저장 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 자동 clipboard.writeText 호출 없음. 편집/저장 없음 / 이 요소의 전환 후 상태: readonly input focus→select() 전체선택. Ctrl/Cmd+C 또는 모바일 선택메뉴로 사용자가 복사 / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `social` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldSocial.vue:16; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 초대 생성 후 link 표시 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldSocial-004 에 @focus=($event.target as HTMLInputElement).select() 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: readonly input focus→select() 전체선택. Ctrl/Cmd+C 또는 모바일 선택메뉴로 사용자가 복사
4. 예상저장/불변필드: 자동 clipboard.writeText 호출 없음. 편집/저장 없음
5. 취소·복귀검사: 자동 clipboard.writeText 호출 없음. 편집/저장 없음 / 이 요소의 전환 후 상태: readonly input focus→select() 전체선택. Ctrl/Cmd+C 또는 모바일 선택메뉴로 사용자가 복사 / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @focus=($event.target as HTMLInputElement).select()의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldSocial-005 · UI-065 · {{copy.cancelInvite}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 이름 근거 `{{copy.cancelInvite}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-for": "i in pending"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "cancel(i.id)"}`.
- 준비/이전 상태: pending 합성 초대 i
- 입력: @click=cancel(i.id) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=cancel(i.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: cancelInvite(family,i.id)→link 빈값→refresh
- 데이터·저장 시점: 초대 취소 DB 변경. 버튼 busy/중복가드 없음; 실패 explain, refresh 단계 실패는 취소 완료 가능
- 실행 연결: WorldSocial.vue::cancel, WorldSocial.vue::refresh, WorldSocial.vue::explain (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: pending 합성 초대 i. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 초대 취소 DB 변경. 버튼 busy/중복가드 없음; 실패 explain, refresh 단계 실패는 취소 완료 가능
- 취소·ESC·포커스: 초대 취소 DB 변경. 버튼 busy/중복가드 없음; 실패 explain, refresh 단계 실패는 취소 완료 가능 / 이 요소의 전환 후 상태: cancelInvite(family,i.id)→link 빈값→refresh / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `social` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 탭으로 @click=cancel(i.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldSocial.vue:16; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. pending 합성 초대 i 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldSocial-005 에 @click=cancel(i.id) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: cancelInvite(family,i.id)→link 빈값→refresh
4. 예상저장/불변필드: 초대 취소 DB 변경. 버튼 busy/중복가드 없음; 실패 explain, refresh 단계 실패는 취소 완료 가능
5. 취소·복귀검사: 초대 취소 DB 변경. 버튼 busy/중복가드 없음; 실패 explain, refresh 단계 실패는 취소 완료 가능 / 이 요소의 전환 후 상태: cancelInvite(family,i.id)→link 빈값→refresh / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: social.ts::cancelInvite를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 초대 취소 DB 변경. 버튼 busy/중복가드 없음; 실패 explain, refresh 단계 실패는 취소 완료 가능

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldSocial-006 · UI-066 · {{f.child}} 의 미술관

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 이름 근거 `{{f.child}} 의 미술관`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "li", "conditions": {"v-for": "f in friends"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "emit('town',f.id)"}`.
- 준비/이전 상태: 친구 목록 합성 B
- 입력: @click=emit('town',f.id) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=emit('town',f.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: town(B.id) emit→부모 showTown(B.id), 친구 패널닫고 마을로
- 데이터·저장 시점: 친구 전시 입장이 아니라 마을에서 B에 초점; 입장은WorldView-017. 저장 없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldSocial.vue", "event": "town", "to": "WorldView.vue", "receiver": "showTown", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 친구 목록 합성 B. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 친구 전시 입장이 아니라 마을에서 B에 초점; 입장은WorldView-017. 저장 없음
- 취소·ESC·포커스: 친구 전시 입장이 아니라 마을에서 B에 초점; 입장은WorldView-017. 저장 없음 / 이 요소의 전환 후 상태: town(B.id) emit→부모 showTown(B.id), 친구 패널닫고 마을로 / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `social` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 탭으로 @click=emit('town',f.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldSocial.vue:16; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 친구 목록 합성 B 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldSocial-006 에 @click=emit('town',f.id) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: town(B.id) emit→부모 showTown(B.id), 친구 패널닫고 마을로
4. 예상저장/불변필드: 친구 전시 입장이 아니라 마을에서 B에 초점; 입장은WorldView-017. 저장 없음
5. 취소·복귀검사: 친구 전시 입장이 아니라 마을에서 B에 초점; 입장은WorldView-017. 저장 없음 / 이 요소의 전환 후 상태: town(B.id) emit→부모 showTown(B.id), 친구 패널닫고 마을로 / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=emit('town',f.id)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldSocial-007 · UI-067 · {{copy.unlink}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 이름 근거 `{{copy.unlink}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "li", "conditions": {"v-for": "f in friends"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "confirm=f.id"}`.
- 준비/이전 상태: 친구 목록 합성 B, 확인 없음
- 입력: @click=confirm=f.id / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=confirm=f.id 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: confirm=B.id→그 친구 끊기 확인 표시
- 데이터·저장 시점: 친구연결 불변
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 친구 목록 합성 B, 확인 없음. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 친구연결 불변; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 친구연결 불변 / 이 요소의 전환 후 상태: confirm=B.id→그 친구 끊기 확인 표시 / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `social` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 탭으로 @click=confirm=f.id 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldSocial.vue:16; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 친구 목록 합성 B, 확인 없음 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldSocial-007 에 @click=confirm=f.id 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: confirm=B.id→그 친구 끊기 확인 표시
4. 예상저장/불변필드: 친구연결 불변
5. 취소·복귀검사: 친구연결 불변 / 이 요소의 전환 후 상태: confirm=B.id→그 친구 끊기 확인 표시 / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=confirm=f.id의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldSocial-008 · UI-068 · 끊기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 이름 근거 `끊기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "li", "conditions": {"v-for": "f in friends"}}, {"tag": "template", "conditions": {"v-if": "confirm===f.id"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "unlink(f.id)"}`.
- 준비/이전 상태: confirm=B.id
- 입력: @click=unlink(f.id) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=unlink(f.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: unlink(family,B.id)→confirm 비움→refresh→친구관계종료 message
- 데이터·저장 시점: 로컬 관계 삭제. 실패 explain; unlink 성공 후 refresh 실패일 수 있음. 되돌리기 없음
- 실행 연결: WorldSocial.vue::unlink, WorldSocial.vue::refresh, WorldSocial.vue::explain (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: confirm=B.id. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 로컬 관계 삭제. 실패 explain; unlink 성공 후 refresh 실패일 수 있음. 되돌리기 없음
- 취소·ESC·포커스: 로컬 관계 삭제. 실패 explain; unlink 성공 후 refresh 실패일 수 있음. 되돌리기 없음 / 이 요소의 전환 후 상태: unlink(family,B.id)→confirm 비움→refresh→친구관계종료 message / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `social` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 탭으로 @click=unlink(f.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldSocial.vue:16; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. confirm=B.id 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldSocial-008 에 @click=unlink(f.id) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: unlink(family,B.id)→confirm 비움→refresh→친구관계종료 message
4. 예상저장/불변필드: 로컬 관계 삭제. 실패 explain; unlink 성공 후 refresh 실패일 수 있음. 되돌리기 없음
5. 취소·복귀검사: 로컬 관계 삭제. 실패 explain; unlink 성공 후 refresh 실패일 수 있음. 되돌리기 없음 / 이 요소의 전환 후 상태: unlink(family,B.id)→confirm 비움→refresh→친구관계종료 message / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: social.ts::unlink를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 로컬 관계 삭제. 실패 explain; unlink 성공 후 refresh 실패일 수 있음. 되돌리기 없음

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldSocial-009 · UI-069 · 그만두기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 이름 근거 `그만두기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "li", "conditions": {"v-for": "f in friends"}}, {"tag": "template", "conditions": {"v-if": "confirm===f.id"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "confirm=''"}`.
- 준비/이전 상태: confirm=B.id
- 입력: @click=confirm='' / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=confirm='' 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: confirm=''로 끊기 확인만 닫음
- 데이터·저장 시점: 친구관계 불변
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: confirm=B.id. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 친구관계 불변; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 친구관계 불변 / 이 요소의 전환 후 상태: confirm=''로 끊기 확인만 닫음 / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `social` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대520px/85vh,목록버튼줄바꿈;readonly링크입력최소44px. 탭으로 @click=confirm='' 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldSocial.vue:16; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. confirm=B.id 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldSocial-009 에 @click=confirm='' 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: confirm=''로 끊기 확인만 닫음
4. 예상저장/불변필드: 친구관계 불변
5. 취소·복귀검사: 친구관계 불변 / 이 요소의 전환 후 상태: confirm=''로 끊기 확인만 닫음 / ESC·패널닫기는 공통 social 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=confirm=''의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldTestEntry-001 · UI-070 · 테스트 계정으로 들어가기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 입장화면의 DEV/localtest 전용 버튼. 일반production에서보인다고가정하지않음. 이름 근거 `테스트 계정으로 들어가기`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"class": "g-btn g-btn--primary g-btn--big", "type": "button", "@click": "emit('enter')"}`.
- 준비/이전 상태: DEV/localtest 빌드, phase=entrance, active account 없음
- 입력: @click=emit('enter') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=emit('enter') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: enter emit→WorldView.enterTest→phase creating/샘플진행→createTestAccount→boot. 실패 entrance와토스트
- 데이터·저장 시점: 로컬 테스트 계정·견본 생성; 일반 production 빌드에는 컴포넌트 없음
- 실행 연결: store.ts::saveAccount, store.ts::saveRooms, store.ts::savePrefs (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldTestEntry.vue", "event": "enter", "to": "WorldView.vue", "receiver": "enterTest", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: DEV/localtest 빌드, phase=entrance, active account 없음. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 로컬 테스트 계정·견본 생성; 일반 production 빌드에는 컴포넌트 없음
- 취소·ESC·포커스: 로컬 테스트 계정·견본 생성; 일반 production 빌드에는 컴포넌트 없음 / 이 요소의 전환 후 상태: enter emit→WorldView.enterTest→phase creating/샘플진행→createTestAccount→boot. 실패 entrance와토스트 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: 입장화면의 DEV/localtest 전용 버튼. 일반production에서보인다고가정하지않음. 탭으로 @click=emit('enter') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldTestEntry.vue:7; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. DEV/localtest 빌드, phase=entrance, active account 없음 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldTestEntry-001 에 @click=emit('enter') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: enter emit→WorldView.enterTest→phase creating/샘플진행→createTestAccount→boot. 실패 entrance와토스트
4. 예상저장/불변필드: 로컬 테스트 계정·견본 생성; 일반 production 빌드에는 컴포넌트 없음
5. 취소·복귀검사: 로컬 테스트 계정·견본 생성; 일반 production 빌드에는 컴포넌트 없음 / 이 요소의 전환 후 상태: enter emit→WorldView.enterTest→phase creating/샘플진행→createTestAccount→boot. 실패 entrance와토스트 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::saveAccount를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 로컬 테스트 계정·견본 생성; 일반 production 빌드에는 컴포넌트 없음

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-001 · UI-071 · 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `닫기`.
- 표시/활성: 조상조건 `[]`; 자체속성 `{"class": "g-btn", "type": "button", ":disabled": "step === 'saving' || step === 'working'", "@click": "requestClose"}`.
- 준비/이전 상태: 사진 선택/편집 화면, working/saving 아닌 상태
- 입력: @click=requestClose / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=requestClose 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: requestClose: file없으면 close emit; 있으면 confirmDiscard=true. working/saving이면 무동작
- 데이터·저장 시점: 작성중 draft만; 아직 작품저장 안 함. ESC도 requestClose
- 실행 연결: WorldUpload.vue::requestClose (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldUpload.vue", "event": "close", "to": "WorldView.vue", "receiver": "closePanel", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 사진 선택/편집 화면, working/saving 아닌 상태. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 작성중 draft만; 아직 작품저장 안 함. ESC도 requestClose; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 작성중 draft만; 아직 작품저장 안 함. ESC도 requestClose / 이 요소의 전환 후 상태: requestClose: file없으면 close emit; 있으면 confirmDiscard=true. working/saving이면 무동작 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=requestClose 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:92; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 사진 선택/편집 화면, working/saving 아닌 상태 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-001 에 @click=requestClose 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: requestClose: file없으면 close emit; 있으면 confirmDiscard=true. working/saving이면 무동작
4. 예상저장/불변필드: 작성중 draft만; 아직 작품저장 안 함. ESC도 requestClose
5. 취소·복귀검사: 작성중 draft만; 아직 작품저장 안 함. ESC도 requestClose / 이 요소의 전환 후 상태: requestClose: file없으면 close emit; 있으면 confirmDiscard=true. working/saving이면 무동작 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=requestClose의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-002 · UI-072 · 이름 미지정

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `이름 미지정`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "step === 'pick'"}}]`; 자체속성 `{"ref": "input", "class": "hidden", "type": "file", "accept": "image/*", "@change": "onPick"}`.
- 준비/이전 상태: pick 화면, 합성20MB이하 PNG
- 입력: @change=onPick / 키보드: display:none입력에는직접Tab접근없음. 대응사진선택button Enter/Space→OS선택창,Esc는OS선택취소. / 터치: OS사진선택UI;capture힌트는실제기기마다다름
- 실행 후 UI·카메라·씬: 숨김 앨범 input change→onPick; type/size 검사→file=f→run→working→form
- 데이터·저장 시점: 처리된 display/cutout과 원본file 메모리만. 파일창 취소 시 무동작
- 실행 연결: WorldUpload.vue::onPick, WorldUpload.vue::run (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: pick 화면, 합성20MB이하 PNG. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 처리된 display/cutout과 원본file 메모리만. 파일창 취소 시 무동작
- 취소·ESC·포커스: 처리된 display/cutout과 원본file 메모리만. 파일창 취소 시 무동작 / 이 요소의 전환 후 상태: 숨김 앨범 input change→onPick; type/size 검사→file=f→run→working→form / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. OS사진선택UI;capture힌트는실제기기마다다름 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:97; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. pick 화면, 합성20MB이하 PNG 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-002 에 @change=onPick 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 숨김 앨범 input change→onPick; type/size 검사→file=f→run→working→form
4. 예상저장/불변필드: 처리된 display/cutout과 원본file 메모리만. 파일창 취소 시 무동작
5. 취소·복귀검사: 처리된 display/cutout과 원본file 메모리만. 파일창 취소 시 무동작 / 이 요소의 전환 후 상태: 숨김 앨범 input change→onPick; type/size 검사→file=f→run→working→form / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::processImage를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 처리된 display/cutout과 원본file 메모리만. 파일창 취소 시 무동작

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-003 · UI-073 · 이름 미지정

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `이름 미지정`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "step === 'pick'"}}]`; 자체속성 `{"ref": "camera", "class": "hidden", "type": "file", "accept": "image/*", "capture": "environment", "@change": "onPick"}`.
- 준비/이전 상태: pick 화면, 합성 이미지 제공하는 capture input
- 입력: @change=onPick / 키보드: display:none입력에는직접Tab접근없음. 대응사진선택button Enter/Space→OS선택창,Esc는OS선택취소. / 터치: OS사진선택UI;capture힌트는실제기기마다다름
- 실행 후 UI·카메라·씬: onPick 경로는002와 같음. capture=environment는 모바일 후면카메라 요청 힌트
- 데이터·저장 시점: 실제 카메라 실행/권한 획득 검증 아님. 파일 취소 시 DB 불변
- 실행 연결: WorldUpload.vue::onPick, WorldUpload.vue::run (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: pick 화면, 합성 이미지 제공하는 capture input. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 실제 카메라 실행/권한 획득 검증 아님. 파일 취소 시 DB 불변
- 취소·ESC·포커스: 실제 카메라 실행/권한 획득 검증 아님. 파일 취소 시 DB 불변 / 이 요소의 전환 후 상태: onPick 경로는002와 같음. capture=environment는 모바일 후면카메라 요청 힌트 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. OS사진선택UI;capture힌트는실제기기마다다름 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:98; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. pick 화면, 합성 이미지 제공하는 capture input 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-003 에 @change=onPick 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: onPick 경로는002와 같음. capture=environment는 모바일 후면카메라 요청 힌트
4. 예상저장/불변필드: 실제 카메라 실행/권한 획득 검증 아님. 파일 취소 시 DB 불변
5. 취소·복귀검사: 실제 카메라 실행/권한 획득 검증 아님. 파일 취소 시 DB 불변 / 이 요소의 전환 후 상태: onPick 경로는002와 같음. capture=environment는 모바일 후면카메라 요청 힌트 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::processImage를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 실제 카메라 실행/권한 획득 검증 아님. 파일 취소 시 DB 불변

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-004 · UI-074 · 사진 찍기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `사진 찍기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "step === 'pick'"}}]`; 자체속성 `{"class": "g-btn g-btn--primary g-btn--big", "type": "button", "@click": "camera?.click()"}`.
- 준비/이전 상태: pick 화면
- 입력: @click=camera?.click() / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=camera?.click() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: camera.click()→capture input 선택창→003 change 경로
- 데이터·저장 시점: 사진 찍기 버튼 자체 촬영/저장 안 함. PC는 파일창일 수 있음
- 실행 연결: WorldUpload.vue::onPick, WorldUpload.vue::run (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: pick 화면. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 사진 찍기 버튼 자체 촬영/저장 안 함. PC는 파일창일 수 있음
- 취소·ESC·포커스: 사진 찍기 버튼 자체 촬영/저장 안 함. PC는 파일창일 수 있음 / 이 요소의 전환 후 상태: camera.click()→capture input 선택창→003 change 경로 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=camera?.click() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:99; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. pick 화면 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-004 에 @click=camera?.click() 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: camera.click()→capture input 선택창→003 change 경로
4. 예상저장/불변필드: 사진 찍기 버튼 자체 촬영/저장 안 함. PC는 파일창일 수 있음
5. 취소·복귀검사: 사진 찍기 버튼 자체 촬영/저장 안 함. PC는 파일창일 수 있음 / 이 요소의 전환 후 상태: camera.click()→capture input 선택창→003 change 경로 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::processImage를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 사진 찍기 버튼 자체 촬영/저장 안 함. PC는 파일창일 수 있음

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-005 · UI-075 · 앨범에서 고르기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `앨범에서 고르기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-if": "step === 'pick'"}}]`; 자체속성 `{"class": "g-btn g-btn--big", "type": "button", "@click": "input?.click()"}`.
- 준비/이전 상태: pick 화면
- 입력: @click=input?.click() / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=input?.click() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: input.click()→파일창→002 change 경로
- 데이터·저장 시점: OS 선택취소 시 file/draft/DB 불변
- 실행 연결: WorldUpload.vue::onPick, WorldUpload.vue::run (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: pick 화면. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. OS 선택취소 시 file/draft/DB 불변
- 취소·ESC·포커스: OS 선택취소 시 file/draft/DB 불변 / 이 요소의 전환 후 상태: input.click()→파일창→002 change 경로 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=input?.click() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:99; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. pick 화면 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-005 에 @click=input?.click() 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: input.click()→파일창→002 change 경로
4. 예상저장/불변필드: OS 선택취소 시 file/draft/DB 불변
5. 취소·복귀검사: OS 선택취소 시 file/draft/DB 불변 / 이 요소의 전환 후 상태: input.click()→파일창→002 change 경로 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::processImage를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. OS 선택취소 시 file/draft/DB 불변

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-006 · UI-076 · {{removeBg ? '배경 지우기 안 함' : '배경 지우기'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `{{removeBg ? '배경 지우기 안 함' : '배경 지우기'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn", "type": "button", ":disabled": "step === 'saving'", "@click": "toggleBg"}`.
- 준비/이전 상태: form 화면, removeBg=true, 유효 file
- 입력: @click=toggleBg / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=toggleBg 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: removeBg=false로 반전→run working→성공 form. processImage 실패 시 step=pick, 사진열기실패 안내
- 데이터·저장 시점: 기존 원본file는 메모리에 남음. 실패 후 같은 토글버튼은 사라지므로 사진을 다시 골라 run 재시도; DB 쓰기 없음
- 실행 연결: WorldUpload.vue::toggleBg, WorldUpload.vue::run (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: form 화면, removeBg=true, 유효 file. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: processImage 1회 reject→step='pick',error='사진을 열지 못했어요. 다른 사진을 골라 주세요'. removeBg는이미반전,원본file는남음. 재시도는사진찍기/앨범선택→onPick→run;form의토글버튼은현재숨겨짐.
- 취소·ESC·포커스: working중닫기/ESC무동작. 실패pick에서닫기하면file가남아confirmDiscard가뜰수있음. 사진다시선택취소는기존file를지우지않음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=toggleBg 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:111; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. form 화면, removeBg=true, 유효 file 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-006 에 @click=toggleBg 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: removeBg=false로 반전→run working→성공 form. processImage 실패 시 step=pick, 사진열기실패 안내
4. 예상저장/불변필드: 기존 원본file는 메모리에 남음. 실패 후 같은 토글버튼은 사라지므로 사진을 다시 골라 run 재시도; DB 쓰기 없음
5. 취소·복귀검사: working중닫기/ESC무동작. 실패pick에서닫기하면file가남아confirmDiscard가뜰수있음. 사진다시선택취소는기존file를지우지않음.
6. 실패/경계검사: store.ts::processImage를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. processImage 1회 reject→step='pick',error='사진을 열지 못했어요. 다른 사진을 골라 주세요'. removeBg는이미반전,원본file는남음. 재시도는사진찍기/앨범선택→onPick→run;form의토글버튼은현재숨겨짐.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-007 · UI-077 · 제목·추억 더하기  {{details ? '접기' : '(선택)'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `제목·추억 더하기  {{details ? '접기' : '(선택)'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn", "type": "button", ":aria-expanded": "details", ":disabled": "step === 'saving'", "@click": "details=!details"}`.
- 준비/이전 상태: form 화면, details=false, saving 아님
- 입력: @click=details=!details / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=details=!details 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: details=true로 선택정보 펼침; 재클릭 false
- 데이터·저장 시점: 접어도 제목/추억 draft 유지. DB 쓰기 없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: form 화면, details=false, saving 아님. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 접어도 제목/추억 draft 유지. DB 쓰기 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 접어도 제목/추억 draft 유지. DB 쓰기 없음 / 이 요소의 전환 후 상태: details=true로 선택정보 펼침; 재클릭 false / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=details=!details 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:113; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. form 화면, details=false, saving 아님 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-007 에 @click=details=!details 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: details=true로 선택정보 펼침; 재클릭 false
4. 예상저장/불변필드: 접어도 제목/추억 draft 유지. DB 쓰기 없음
5. 취소·복귀검사: 접어도 제목/추억 draft 유지. DB 쓰기 없음 / 이 요소의 전환 후 상태: details=true로 선택정보 펼침; 재클릭 false / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=details=!details의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-008 · UI-078 · 그림이에요

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `그림이에요`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "fieldset", "conditions": {"v-if": "details", ":disabled": "step === 'saving'"}}]`; 자체속성 `{"type": "button", "class": "chip", ":aria-pressed": "kind === 'drawing'", "@click": "kind = 'drawing'"}`.
- 준비/이전 상태: details 펼침, kind=making
- 입력: @click=kind = 'drawing' / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=kind = 'drawing' 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: kind=drawing, 그림 버튼 pressed
- 데이터·저장 시점: 017 저장 시 작품.kind=drawing
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: details 펼침, kind=making. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 017 저장 시 작품.kind=drawing; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 017 저장 시 작품.kind=drawing / 이 요소의 전환 후 상태: kind=drawing, 그림 버튼 pressed / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=kind = 'drawing' 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:118; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. details 펼침, kind=making 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-008 에 @click=kind = 'drawing' 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: kind=drawing, 그림 버튼 pressed
4. 예상저장/불변필드: 017 저장 시 작품.kind=drawing
5. 취소·복귀검사: 017 저장 시 작품.kind=drawing / 이 요소의 전환 후 상태: kind=drawing, 그림 버튼 pressed / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=kind = 'drawing'의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-009 · UI-079 · 만들기예요

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `만들기예요`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "fieldset", "conditions": {"v-if": "details", ":disabled": "step === 'saving'"}}]`; 자체속성 `{"type": "button", "class": "chip", ":aria-pressed": "kind === 'making'", "@click": "kind = 'making'"}`.
- 준비/이전 상태: details 펼침, kind=drawing
- 입력: @click=kind = 'making' / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=kind = 'making' 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: kind=making, 만들기 버튼 pressed
- 데이터·저장 시점: 017 저장 시 작품.kind=making
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: details 펼침, kind=drawing. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 017 저장 시 작품.kind=making; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 017 저장 시 작품.kind=making / 이 요소의 전환 후 상태: kind=making, 만들기 버튼 pressed / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=kind = 'making' 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:119; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. details 펼침, kind=drawing 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-009 에 @click=kind = 'making' 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: kind=making, 만들기 버튼 pressed
4. 예상저장/불변필드: 017 저장 시 작품.kind=making
5. 취소·복귀검사: 017 저장 시 작품.kind=making / 이 요소의 전환 후 상태: kind=making, 만들기 버튼 pressed / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=kind = 'making'의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-010 · UI-080 · {{s.label}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `{{s.label}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "fieldset", "conditions": {"v-if": "details", ":disabled": "step === 'saving'"}}, {"tag": "div", "conditions": {"v-for": "g in SUBJECT_GROUPS"}}]`; 자체속성 `{"v-for": "s in SUBJECTS.filter((x) => x.group === g)", ":key": "s.id", "type": "button", "class": "chip", ":aria-pressed": "subject === s.id", "@click": "subject = s.id"}`.
- 준비/이전 상태: details 펼침, 주제 s
- 입력: @click=subject = s.id / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=subject = s.id 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: subject=s.id, 선택표시 및 기본제목 placeholder 변경
- 데이터·저장 시점: 017 저장 시 subject 저장; 이미 입력한title을 자동교체하지 않음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: details 펼침, 주제 s. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 017 저장 시 subject 저장; 이미 입력한title을 자동교체하지 않음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 017 저장 시 subject 저장; 이미 입력한title을 자동교체하지 않음 / 이 요소의 전환 후 상태: subject=s.id, 선택표시 및 기본제목 placeholder 변경 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=subject = s.id 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:128; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. details 펼침, 주제 s 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-010 에 @click=subject = s.id 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: subject=s.id, 선택표시 및 기본제목 placeholder 변경
4. 예상저장/불변필드: 017 저장 시 subject 저장; 이미 입력한title을 자동교체하지 않음
5. 취소·복귀검사: 017 저장 시 subject 저장; 이미 입력한title을 자동교체하지 않음 / 이 요소의 전환 후 상태: subject=s.id, 선택표시 및 기본제목 placeholder 변경 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=subject = s.id의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-011 · UI-081 · title

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `제목`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "fieldset", "conditions": {"v-if": "details", ":disabled": "step === 'saving'"}}]`; 자체속성 `{"v-model": "title", "class": "w-input", "maxlength": "40", ":placeholder": "placeholder"}`.
- 준비/이전 상태: details 펼침, title 빈값
- 입력: ; v-model=title / 키보드: native input의텍스트/날짜입력. readonly이면편집불가. 폼내Enter의submit여부는formSubmit/조상form근거를따름. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 합성 새 제목 입력, maxlength40
- 데이터·저장 시점: 017 저장시 trim·40자. 선택 입력이므로 빈제목도 허용; DB 즉시변경 없음
- 실행 연결: WorldUpload.vue::hang, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldUpload.vue", "event": "saved", "to": "WorldView.vue", "receiver": "onSaved", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: details 펼침, title 빈값. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 017 저장시 trim·40자. 선택 입력이므로 빈제목도 허용; DB 즉시변경 없음
- 취소·ESC·포커스: 017 저장시 trim·40자. 선택 입력이므로 빈제목도 허용; DB 즉시변경 없음 / 이 요소의 전환 후 상태: 합성 새 제목 입력, maxlength40 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:133; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. details 펼침, title 빈값 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-011 에 ; v-model=title 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 합성 새 제목 입력, maxlength40
4. 예상저장/불변필드: 017 저장시 trim·40자. 선택 입력이므로 빈제목도 허용; DB 즉시변경 없음
5. 취소·복귀검사: 017 저장시 trim·40자. 선택 입력이므로 빈제목도 허용; DB 즉시변경 없음 / 이 요소의 전환 후 상태: 합성 새 제목 입력, maxlength40 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. title 변경 후 hang의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::saveArtworkAndRoom를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 017 저장시 trim·40자. 선택 입력이므로 빈제목도 허용; DB 즉시변경 없음

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-012 · UI-082 · {{m}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `{{m}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "fieldset", "conditions": {"v-if": "details", ":disabled": "step === 'saving'"}}]`; 자체속성 `{"v-for": "m in MATERIALS", ":key": "m", "type": "button", "class": "chip", ":aria-pressed": "material === m", "@click": "pickMaterial(m)"}`.
- 준비/이전 상태: details 펼침, material 빈값
- 입력: @click=pickMaterial(m) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=pickMaterial(m) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: 재료 m 클릭→material=m; 같은m 다시클릭→빈값
- 데이터·저장 시점: 017 저장시 trim·20자. 다른 재료 여러개 누적 아님
- 실행 연결: WorldUpload.vue::pickMaterial (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: details 펼침, material 빈값. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 017 저장시 trim·20자. 다른 재료 여러개 누적 아님; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 017 저장시 trim·20자. 다른 재료 여러개 누적 아님 / 이 요소의 전환 후 상태: 재료 m 클릭→material=m; 같은m 다시클릭→빈값 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=pickMaterial(m) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:138; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. details 펼침, material 빈값 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-012 에 @click=pickMaterial(m) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 재료 m 클릭→material=m; 같은m 다시클릭→빈값
4. 예상저장/불변필드: 017 저장시 trim·20자. 다른 재료 여러개 누적 아님
5. 취소·복귀검사: 017 저장시 trim·20자. 다른 재료 여러개 누적 아님 / 이 요소의 전환 후 상태: 재료 m 클릭→material=m; 같은m 다시클릭→빈값 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=pickMaterial(m)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-013 · UI-083 · 재료 직접 적기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `재료 직접 적기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "fieldset", "conditions": {"v-if": "details", ":disabled": "step === 'saving'"}}]`; 자체속성 `{"v-model": "material", "class": "w-input", "maxlength": "20", "placeholder": "직접 적기", "aria-label": "재료 직접 적기"}`.
- 준비/이전 상태: details 펼침
- 입력: ; v-model=material / 키보드: native input의텍스트/날짜입력. readonly이면편집불가. 폼내Enter의submit여부는formSubmit/조상form근거를따름. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 직접 재료 텍스트 입력, maxlength20
- 데이터·저장 시점: 017 저장 대상 material.012 칩과 같은 draft를 공유
- 실행 연결: WorldUpload.vue::hang, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldUpload.vue", "event": "saved", "to": "WorldView.vue", "receiver": "onSaved", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: details 펼침. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 017 저장 대상 material.012 칩과 같은 draft를 공유
- 취소·ESC·포커스: 017 저장 대상 material.012 칩과 같은 draft를 공유 / 이 요소의 전환 후 상태: 직접 재료 텍스트 입력, maxlength20 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:140; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. details 펼침 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-013 에 ; v-model=material 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 직접 재료 텍스트 입력, maxlength20
4. 예상저장/불변필드: 017 저장 대상 material.012 칩과 같은 draft를 공유
5. 취소·복귀검사: 017 저장 대상 material.012 칩과 같은 draft를 공유 / 이 요소의 전환 후 상태: 직접 재료 텍스트 입력, maxlength20 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. material 변경 후 hang의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::saveArtworkAndRoom를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 017 저장 대상 material.012 칩과 같은 draft를 공유

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-014 · UI-084 · {{n}} 세

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `그때 나이  {{n}} 세`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "fieldset", "conditions": {"v-if": "details", ":disabled": "step === 'saving'"}}]`; 자체속성 `{"v-model.number": "age", "class": "w-input"}`.
- 준비/이전 상태: details 펼침, 초기 age=childAge범위보정
- 입력: ; v-model.number=age / 키보드: native select: 방향키로항목변경,Enter/Space/Alt+Down등OS기본선택. v-model.number면숫자변환. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 나이5 선택→age 숫자5, 상단5세관 안내
- 데이터·저장 시점: 017 saveArtworkAndRoom에서5세관 포함 저장
- 실행 연결: WorldUpload.vue::hang, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldUpload.vue", "event": "saved", "to": "WorldView.vue", "receiver": "onSaved", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: details 펼침, 초기 age=childAge범위보정. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 017 saveArtworkAndRoom에서5세관 포함 저장
- 취소·ESC·포커스: 017 saveArtworkAndRoom에서5세관 포함 저장 / 이 요소의 전환 후 상태: 나이5 선택→age 숫자5, 상단5세관 안내 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:145; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. details 펼침, 초기 age=childAge범위보정 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-014 에 ; v-model.number=age 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 나이5 선택→age 숫자5, 상단5세관 안내
4. 예상저장/불변필드: 017 saveArtworkAndRoom에서5세관 포함 저장
5. 취소·복귀검사: 017 saveArtworkAndRoom에서5세관 포함 저장 / 이 요소의 전환 후 상태: 나이5 선택→age 숫자5, 상단5세관 안내 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. age 변경 후 hang의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::saveArtworkAndRoom를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 017 saveArtworkAndRoom에서5세관 포함 저장

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-015 · UI-085 · madeOn

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `만든 날`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "fieldset", "conditions": {"v-if": "details", ":disabled": "step === 'saving'"}}]`; 자체속성 `{"v-model": "madeOn", "class": "w-input", "type": "date"}`.
- 준비/이전 상태: details 펼침
- 입력: ; v-model=madeOn / 키보드: native input의텍스트/날짜입력. readonly이면편집불가. 폼내Enter의submit여부는formSubmit/조상form근거를따름. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 날짜2026-10-01 입력→madeOn
- 데이터·저장 시점: 017 저장까지 DB 불변; 빈날짜 허용
- 실행 연결: WorldUpload.vue::hang, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldUpload.vue", "event": "saved", "to": "WorldView.vue", "receiver": "onSaved", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: details 펼침. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 017 저장까지 DB 불변; 빈날짜 허용
- 취소·ESC·포커스: 017 저장까지 DB 불변; 빈날짜 허용 / 이 요소의 전환 후 상태: 날짜2026-10-01 입력→madeOn / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:147; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. details 펼침 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-015 에 ; v-model=madeOn 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 날짜2026-10-01 입력→madeOn
4. 예상저장/불변필드: 017 저장까지 DB 불변; 빈날짜 허용
5. 취소·복귀검사: 017 저장까지 DB 불변; 빈날짜 허용 / 이 요소의 전환 후 상태: 날짜2026-10-01 입력→madeOn / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. madeOn 변경 후 hang의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::saveArtworkAndRoom를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 017 저장까지 DB 불변; 빈날짜 허용

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-016 · UI-086 · words

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `아이가 한 말`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "fieldset", "conditions": {"v-if": "details", ":disabled": "step === 'saving'"}}]`; 자체속성 `{"v-model": "words", "class": "w-input", "rows": "2", "maxlength": "200", "placeholder": "아이가 한 말을 그대로 적어 주세요"}`.
- 준비/이전 상태: details 펼침
- 입력: ; v-model=words / 키보드: 텍스트입력/붙여넣기,Enter는줄바꿈. maxlength준수;Enter를저장단축키로가정하지않음. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 합성 이야기 입력→words, maxlength200
- 데이터·저장 시점: 017 저장시에 words200자 제한; 원본file 바이트 불변
- 실행 연결: WorldUpload.vue::hang, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldUpload.vue", "event": "saved", "to": "WorldView.vue", "receiver": "onSaved", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: details 펼침. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 017 저장시에 words200자 제한; 원본file 바이트 불변
- 취소·ESC·포커스: 017 저장시에 words200자 제한; 원본file 바이트 불변 / 이 요소의 전환 후 상태: 합성 이야기 입력→words, maxlength200 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:151; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. details 펼침 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-016 에 ; v-model=words 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 합성 이야기 입력→words, maxlength200
4. 예상저장/불변필드: 017 저장시에 words200자 제한; 원본file 바이트 불변
5. 취소·복귀검사: 017 저장시에 words200자 제한; 원본file 바이트 불변 / 이 요소의 전환 후 상태: 합성 이야기 입력→words, maxlength200 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. words 변경 후 hang의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::saveArtworkAndRoom를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 017 저장시에 words200자 제한; 원본file 바이트 불변

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-017 · UI-087 · {{step === 'saving' ? '보관하는 중…' : '이대로 보관하기'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `{{step === 'saving' ? '보관하는 중…' : '이대로 보관하기'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn g-btn--primary g-btn--big", "type": "button", ":disabled": "step === 'saving'", "@click": "hang"}`.
- 준비/이전 상태: form, file와processed 존재
- 입력: @click=hang / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=hang 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: hang→saving→listArtworks no최대+1→saveArtworkAndRoom→saved emit→부모 onSaved
- 데이터·저장 시점: 컴포넌트 고정 artworkId로 원본file·파생display/cutout·정보 저장. 실패 form·draft유지·오류문구. 부모reload는 emit후 별도 비동기
- 실행 연결: WorldUpload.vue::hang, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldUpload.vue", "event": "saved", "to": "WorldView.vue", "receiver": "onSaved", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: form, file와processed 존재. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 컴포넌트 고정 artworkId로 원본file·파생display/cutout·정보 저장. 실패 form·draft유지·오류문구. 부모reload는 emit후 별도 비동기
- 취소·ESC·포커스: 컴포넌트 고정 artworkId로 원본file·파생display/cutout·정보 저장. 실패 form·draft유지·오류문구. 부모reload는 emit후 별도 비동기 / 이 요소의 전환 후 상태: hang→saving→listArtworks no최대+1→saveArtworkAndRoom→saved emit→부모 onSaved / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=hang 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:157; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. form, file와processed 존재 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-017 에 @click=hang 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: hang→saving→listArtworks no최대+1→saveArtworkAndRoom→saved emit→부모 onSaved
4. 예상저장/불변필드: 컴포넌트 고정 artworkId로 원본file·파생display/cutout·정보 저장. 실패 form·draft유지·오류문구. 부모reload는 emit후 별도 비동기
5. 취소·복귀검사: 컴포넌트 고정 artworkId로 원본file·파생display/cutout·정보 저장. 실패 form·draft유지·오류문구. 부모reload는 emit후 별도 비동기 / 이 요소의 전환 후 상태: hang→saving→listArtworks no최대+1→saveArtworkAndRoom→saved emit→부모 onSaved / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::saveArtworkAndRoom를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 컴포넌트 고정 artworkId로 원본file·파생display/cutout·정보 저장. 실패 form·draft유지·오류문구. 부모reload는 emit후 별도 비동기

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-018 · UI-088 · 다른 사진

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `다른 사진`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn", "type": "button", ":disabled": "step === 'saving'", "@click": "step = 'pick'; processed = null; file = null"}`.
- 준비/이전 상태: form, saving 아님, draft입력 존재
- 입력: @click=step = 'pick'; processed = null; file = null / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=step = 'pick'; processed = null; file = null 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: step=pick, processed=null,file=null
- 데이터·저장 시점: title/kind/subject/material/age/madeOn/words는 초기화하지 않음. 다음사진에 이전입력이 남는 현행 동작; DB쓰기없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: form, saving 아님, draft입력 존재. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. title/kind/subject/material/age/madeOn/words는 초기화하지 않음. 다음사진에 이전입력이 남는 현행 동작; DB쓰기없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: title/kind/subject/material/age/madeOn/words는 초기화하지 않음. 다음사진에 이전입력이 남는 현행 동작; DB쓰기없음 / 이 요소의 전환 후 상태: step=pick, processed=null,file=null / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=step = 'pick'; processed = null; file = null 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:158; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. form, saving 아님, draft입력 존재 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-018 에 @click=step = 'pick'; processed = null; file = null 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: step=pick, processed=null,file=null
4. 예상저장/불변필드: title/kind/subject/material/age/madeOn/words는 초기화하지 않음. 다음사진에 이전입력이 남는 현행 동작; DB쓰기없음
5. 취소·복귀검사: title/kind/subject/material/age/madeOn/words는 초기화하지 않음. 다음사진에 이전입력이 남는 현행 동작; DB쓰기없음 / 이 요소의 전환 후 상태: step=pick, processed=null,file=null / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=step = 'pick'; processed = null; file = null의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-019 · UI-089 · 계속 보관하기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `계속 보관하기`.
- 표시/활성: 조상조건 `[{"tag": "section", "conditions": {"v-if": "confirmDiscard"}}]`; 자체속성 `{"class": "g-btn g-btn--primary", ":disabled": "step==='saving'||step==='working'", "@click": "confirmDiscard=false"}`.
- 준비/이전 상태: confirmDiscard=true
- 입력: @click=confirmDiscard=false / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=confirmDiscard=false 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: confirmDiscard=false, 사진편집 계속
- 데이터·저장 시점: file/processed/정보 draft와 기존DB 불변
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: confirmDiscard=true. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. file/processed/정보 draft와 기존DB 불변; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: file/processed/정보 draft와 기존DB 불변 / 이 요소의 전환 후 상태: confirmDiscard=false, 사진편집 계속 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=confirmDiscard=false 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:162; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. confirmDiscard=true 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-019 에 @click=confirmDiscard=false 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: confirmDiscard=false, 사진편집 계속
4. 예상저장/불변필드: file/processed/정보 draft와 기존DB 불변
5. 취소·복귀검사: file/processed/정보 draft와 기존DB 불변 / 이 요소의 전환 후 상태: confirmDiscard=false, 사진편집 계속 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=confirmDiscard=false의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldUpload-020 · UI-090 · 보관하지 않고 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 이름 근거 `보관하지 않고 닫기`.
- 표시/활성: 조상조건 `[{"tag": "section", "conditions": {"v-if": "confirmDiscard"}}]`; 자체속성 `{"class": "g-btn", ":disabled": "step==='saving'||step==='working'", "@click": "emit('close')"}`.
- 준비/이전 상태: confirmDiscard=true, working/saving 아님
- 입력: @click=emit('close') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=emit('close') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: close emit→부모closePanel→업로드 컴포넌트해제
- 데이터·저장 시점: 미저장 file/processed/draft 폐기, 작품 생성 없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[{"from": "WorldUpload.vue", "event": "close", "to": "WorldView.vue", "receiver": "closePanel", "awaitedByEmitter": false}]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: confirmDiscard=true, working/saving 아님. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 미저장 file/processed/draft 폐기, 작품 생성 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 미저장 file/processed/draft 폐기, 작품 생성 없음 / 이 요소의 전환 후 상태: close emit→부모closePanel→업로드 컴포넌트해제 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `upload` 및 `focus` 참조.
- PC/모바일: 가운데카드 최대680px/92vh;480px이하나이/날짜1열,주제그룹1열. 저장행sticky. capture입력은기기별차이있음. 탭으로 @click=emit('close') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldUpload.vue:162; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. confirmDiscard=true, working/saving 아님 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldUpload-020 에 @click=emit('close') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: close emit→부모closePanel→업로드 컴포넌트해제
4. 예상저장/불변필드: 미저장 file/processed/draft 폐기, 작품 생성 없음
5. 취소·복귀검사: 미저장 file/processed/draft 폐기, 작품 생성 없음 / 이 요소의 전환 후 상태: close emit→부모closePanel→업로드 컴포넌트해제 / ESC·패널닫기는 공통 upload 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=emit('close')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-001 · UI-091 · 들어가기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `들어가기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"v-if": "space==='plaza' && !visiting", "class": "g-btn g-btn--primary", "type": "button", "@click": "enterMuseum"}`.
- 준비/이전 상태: 내 광장, 계정 ready, engine존재
- 입력: @click=enterMuseum / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=enterMuseum 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: enterMuseum→실내 입구 spawn/카메라 초기화, 테마 환경음 설정
- 데이터·저장 시점: prefs/작품DB 변경 없음
- 실행 연결: WorldView.vue::enterMuseum (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내 광장, 계정 ready, engine존재. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. prefs/작품DB 변경 없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: prefs/작품DB 변경 없음 / 이 요소의 전환 후 상태: enterMuseum→실내 입구 spawn/카메라 초기화, 테마 환경음 설정 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=enterMuseum 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:392; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내 광장, 계정 ready, engine존재 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-001 에 @click=enterMuseum 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: enterMuseum→실내 입구 spawn/카메라 초기화, 테마 환경음 설정
4. 예상저장/불변필드: prefs/작품DB 변경 없음
5. 취소·복귀검사: prefs/작품DB 변경 없음 / 이 요소의 전환 후 상태: enterMuseum→실내 입구 spawn/카메라 초기화, 테마 환경음 설정 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=enterMuseum의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-002 · UI-092 · 밖으로

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `밖으로`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"v-if": "space==='inside'", "class": "g-btn", "type": "button", "@click": "outside"}`.
- 준비/이전 상태: 내 실내 또는 친구 실내
- 입력: @click=outside / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=outside 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: outside: 내관은showPlaza, 방문중이면showTown
- 데이터·저장 시점: 내관은즉시광장;친구는비동기마을reload. 실패토스트 경로있음; 작품DB쓰기없음
- 실행 연결: WorldView.vue::outside, WorldView.vue::showTown, WorldView.vue::reload, WorldView.vue::say (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내 실내 또는 친구 실내. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 내관은즉시광장;친구는비동기마을reload. 실패토스트 경로있음; 작품DB쓰기없음
- 취소·ESC·포커스: 내관은즉시광장;친구는비동기마을reload. 실패토스트 경로있음; 작품DB쓰기없음 / 이 요소의 전환 후 상태: outside: 내관은showPlaza, 방문중이면showTown / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=outside 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:393; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내 실내 또는 친구 실내 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-002 에 @click=outside 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: outside: 내관은showPlaza, 방문중이면showTown
4. 예상저장/불변필드: 내관은즉시광장;친구는비동기마을reload. 실패토스트 경로있음; 작품DB쓰기없음
5. 취소·복귀검사: 내관은즉시광장;친구는비동기마을reload. 실패토스트 경로있음; 작품DB쓰기없음 / 이 요소의 전환 후 상태: outside: 내관은showPlaza, 방문중이면showTown / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=outside의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-003 · UI-093 · 작품 남기기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `작품 남기기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"v-if": "!visiting", "class": "g-btn g-btn--primary", "type": "button", "@click": "openPanel('upload')"}`.
- 준비/이전 상태: 내관, 방문중아님
- 입력: @click=openPanel('upload') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openPanel('upload') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: openPanel upload→업로드 대화상자,moreTools=false,월드입력정지
- 데이터·저장 시점: 초안은WorldUpload에서 생성. 이 버튼은 저장없음
- 실행 연결: WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내관, 방문중아님. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 초안은WorldUpload에서 생성. 이 버튼은 저장없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 초안은WorldUpload에서 생성. 이 버튼은 저장없음 / 이 요소의 전환 후 상태: openPanel upload→업로드 대화상자,moreTools=false,월드입력정지 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openPanel('upload') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:394; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내관, 방문중아님 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-003 에 @click=openPanel('upload') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: openPanel upload→업로드 대화상자,moreTools=false,월드입력정지
4. 예상저장/불변필드: 초안은WorldUpload에서 생성. 이 버튼은 저장없음
5. 취소·복귀검사: 초안은WorldUpload에서 생성. 이 버튼은 저장없음 / 이 요소의 전환 후 상태: openPanel upload→업로드 대화상자,moreTools=false,월드입력정지 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openPanel('upload')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-004 · UI-094 · 함께 놀기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `함께 놀기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"v-if": "!visiting", "class": "g-btn", "type": "button", "@click": "openPanel('play')"}`.
- 준비/이전 상태: 내관, 방문중아님
- 입력: @click=openPanel('play') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openPanel('play') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: openPanel play→비동기 WorldPlay 로드·대화상자,월드입력정지
- 데이터·저장 시점: 초안조회는자식onMounted; 이 버튼은 저장없음
- 실행 연결: WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내관, 방문중아님. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 초안조회는자식onMounted; 이 버튼은 저장없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 초안조회는자식onMounted; 이 버튼은 저장없음 / 이 요소의 전환 후 상태: openPanel play→비동기 WorldPlay 로드·대화상자,월드입력정지 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openPanel('play') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:395; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내관, 방문중아님 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-004 에 @click=openPanel('play') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: openPanel play→비동기 WorldPlay 로드·대화상자,월드입력정지
4. 예상저장/불변필드: 초안조회는자식onMounted; 이 버튼은 저장없음
5. 취소·복귀검사: 초안조회는자식onMounted; 이 버튼은 저장없음 / 이 요소의 전환 후 상태: openPanel play→비동기 WorldPlay 로드·대화상자,월드입력정지 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openPanel('play')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-005 · UI-095 · {{moreTools?'접기':'더보기'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `{{moreTools?'접기':'더보기'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn w-more-tools", "type": "button", ":aria-expanded": "moreTools", "aria-controls": "w-secondary-menu", "@click": "moreTools=!moreTools"}`.
- 준비/이전 상태: 모바일 HUD 더보기 접힘
- 입력: @click=moreTools=!moreTools / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=moreTools=!moreTools 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: moreTools 반전, aria-expanded와 w-expanded클래스 변경
- 데이터·저장 시점: 패널을 열지 않음, 월드 전체pause 적용 아님; DB쓰기없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 모바일 HUD 더보기 접힘. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 패널을 열지 않음, 월드 전체pause 적용 아님; DB쓰기없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 패널을 열지 않음, 월드 전체pause 적용 아님; DB쓰기없음 / 이 요소의 전환 후 상태: moreTools 반전, aria-expanded와 w-expanded클래스 변경 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=moreTools=!moreTools 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:396; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 모바일 HUD 더보기 접힘 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-005 에 @click=moreTools=!moreTools 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: moreTools 반전, aria-expanded와 w-expanded클래스 변경
4. 예상저장/불변필드: 패널을 열지 않음, 월드 전체pause 적용 아님; DB쓰기없음
5. 취소·복귀검사: 패널을 열지 않음, 월드 전체pause 적용 아님; DB쓰기없음 / 이 요소의 전환 후 상태: moreTools 반전, aria-expanded와 w-expanded클래스 변경 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=moreTools=!moreTools의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-006 · UI-096 · 사용법

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `사용법`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn w-help-trigger", "type": "button", "@click": "openPanel('help')"}`.
- 준비/이전 상태: 메뉴 사용법
- 입력: @click=openPanel('help') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openPanel('help') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: openPanel help→조작설명과 시점되돌리기 표시
- 데이터·저장 시점: 저장없음; PC/모바일 coarse에 따라 설명분기
- 실행 연결: WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 메뉴 사용법. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 저장없음; PC/모바일 coarse에 따라 설명분기; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 저장없음; PC/모바일 coarse에 따라 설명분기 / 이 요소의 전환 후 상태: openPanel help→조작설명과 시점되돌리기 표시 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openPanel('help') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:398; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 메뉴 사용법 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-006 에 @click=openPanel('help') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: openPanel help→조작설명과 시점되돌리기 표시
4. 예상저장/불변필드: 저장없음; PC/모바일 coarse에 따라 설명분기
5. 취소·복귀검사: 저장없음; PC/모바일 coarse에 따라 설명분기 / 이 요소의 전환 후 상태: openPanel help→조작설명과 시점되돌리기 표시 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openPanel('help')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-007 · UI-097 · 보관함

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `보관함`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"v-if": "!visiting", "class": "g-btn", "type": "button", "@click": "openArchive(null)"}`.
- 준비/이전 상태: 내관 보관함
- 입력: @click=openArchive(null) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openArchive(null) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: archiveFocus=null,openPanel archive→기본 마지막 작품 상세 또는 빈목록
- 데이터·저장 시점: 작품조회상태만, 저장없음
- 실행 연결: WorldView.vue::openArchive, WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내관 보관함. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 작품조회상태만, 저장없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 작품조회상태만, 저장없음 / 이 요소의 전환 후 상태: archiveFocus=null,openPanel archive→기본 마지막 작품 상세 또는 빈목록 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openArchive(null) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:399; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내관 보관함 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-007 에 @click=openArchive(null) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: archiveFocus=null,openPanel archive→기본 마지막 작품 상세 또는 빈목록
4. 예상저장/불변필드: 작품조회상태만, 저장없음
5. 취소·복귀검사: 작품조회상태만, 저장없음 / 이 요소의 전환 후 상태: archiveFocus=null,openPanel archive→기본 마지막 작품 상세 또는 빈목록 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openArchive(null)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-008 · UI-098 · 캐릭터

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `캐릭터`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"v-if": "!visiting", "class": "g-btn", "type": "button", ":disabled": "webglFailed", "@click": "openPanel('avatar')"}`.
- 준비/이전 상태: 내관 WebGL정상
- 입력: @click=openPanel('avatar') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openPanel('avatar') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: openPanel avatar→engine.setCustomizing(true),캐릭터패널
- 데이터·저장 시점: 저장전 preview만;WorldAvatar-015 저장경로 별도
- 실행 연결: WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내관 WebGL정상. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 저장전 preview만;WorldAvatar-015 저장경로 별도; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 저장전 preview만;WorldAvatar-015 저장경로 별도 / 이 요소의 전환 후 상태: openPanel avatar→engine.setCustomizing(true),캐릭터패널 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openPanel('avatar') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:400; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내관 WebGL정상 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-008 에 @click=openPanel('avatar') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: openPanel avatar→engine.setCustomizing(true),캐릭터패널
4. 예상저장/불변필드: 저장전 preview만;WorldAvatar-015 저장경로 별도
5. 취소·복귀검사: 저장전 preview만;WorldAvatar-015 저장경로 별도 / 이 요소의 전환 후 상태: openPanel avatar→engine.setCustomizing(true),캐릭터패널 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openPanel('avatar')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-009 · UI-099 · 모드

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `모드`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn", "type": "button", ":disabled": "webglFailed", "@click": "openPanel('theme')"}`.
- 준비/이전 상태: WebGL정상,내관또는친구관
- 입력: @click=openPanel('theme') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openPanel('theme') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: openPanel theme→모드4종과미술관안2종선택표시
- 데이터·저장 시점: 이 버튼은변경없음.039~041이 저장
- 실행 연결: WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: WebGL정상,내관또는친구관. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 이 버튼은변경없음.039~041이 저장; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 이 버튼은변경없음.039~041이 저장 / 이 요소의 전환 후 상태: openPanel theme→모드4종과미술관안2종선택표시 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openPanel('theme') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:401; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. WebGL정상,내관또는친구관 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-009 에 @click=openPanel('theme') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: openPanel theme→모드4종과미술관안2종선택표시
4. 예상저장/불변필드: 이 버튼은변경없음.039~041이 저장
5. 취소·복귀검사: 이 버튼은변경없음.039~041이 저장 / 이 요소의 전환 후 상태: openPanel theme→모드4종과미술관안2종선택표시 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openPanel('theme')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-010 · UI-100 · 전시실 추가

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `전시실 추가`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"v-if": "space==='inside' && !visiting", "class": "g-btn", "type": "button", "@click": "addRoom"}`.
- 준비/이전 상태: 내 실내, 현재최고나이4
- 입력: @click=addRoom / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=addRoom 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: addRoom→5 추가saveRooms→reload→5세관토스트.13이상이면안내후종료
- 데이터·저장 시점: 현재가족 rooms 저장;실패토스트. 작품/원본불변
- 실행 연결: WorldView.vue::addRoom, store.ts::saveRooms, WorldView.vue::say, WorldView.vue::reload (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내 실내, 현재최고나이4. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 현재가족 rooms 저장;실패토스트. 작품/원본불변
- 취소·ESC·포커스: 현재가족 rooms 저장;실패토스트. 작품/원본불변 / 이 요소의 전환 후 상태: addRoom→5 추가saveRooms→reload→5세관토스트.13이상이면안내후종료 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=addRoom 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:402; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내 실내, 현재최고나이4 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-010 에 @click=addRoom 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: addRoom→5 추가saveRooms→reload→5세관토스트.13이상이면안내후종료
4. 예상저장/불변필드: 현재가족 rooms 저장;실패토스트. 작품/원본불변
5. 취소·복귀검사: 현재가족 rooms 저장;실패토스트. 작품/원본불변 / 이 요소의 전환 후 상태: addRoom→5 추가saveRooms→reload→5세관토스트.13이상이면안내후종료 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=addRoom의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-011 · UI-101 · {{prefs?.sound ? '소리 끄기' : '소리 켜기'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `{{prefs?.sound ? '소리 끄기' : '소리 켜기'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn", "type": "button", ":aria-pressed": "!prefs?.sound", "@click": "toggleSound"}`.
- 준비/이전 상태: prefs.sound=true
- 입력: @click=toggleSound / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=toggleSound 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: prefs.sound=false를 먼저대입→setSoundEnabled(false),stopSpeaking→savePrefs
- 데이터·저장 시점: 저장실패토스트만, 메모리/소리 rollback없음. 재진입때DB값과달라질수있는현행결함
- 실행 연결: WorldView.vue::toggleSound, store.ts::savePrefs, WorldView.vue::say (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: prefs.sound=true. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: savePrefs reject→실패토스트, prefs.sound와실제음성상태는반전된채. rollback없음. 재클릭은저장재시도가아니라소리값을다시반전한다.
- 취소·ESC·포커스: 저장실패토스트만, 메모리/소리 rollback없음. 재진입때DB값과달라질수있는현행결함 / 이 요소의 전환 후 상태: prefs.sound=false를 먼저대입→setSoundEnabled(false),stopSpeaking→savePrefs / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=toggleSound 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:403; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. prefs.sound=true 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-011 에 @click=toggleSound 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: prefs.sound=false를 먼저대입→setSoundEnabled(false),stopSpeaking→savePrefs
4. 예상저장/불변필드: 저장실패토스트만, 메모리/소리 rollback없음. 재진입때DB값과달라질수있는현행결함
5. 취소·복귀검사: 저장실패토스트만, 메모리/소리 rollback없음. 재진입때DB값과달라질수있는현행결함 / 이 요소의 전환 후 상태: prefs.sound=false를 먼저대입→setSoundEnabled(false),stopSpeaking→savePrefs / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::savePrefs를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. savePrefs reject→실패토스트, prefs.sound와실제음성상태는반전된채. rollback없음. 재클릭은저장재시도가아니라소리값을다시반전한다.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-012 · UI-102 · 설정

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `설정`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"v-if": "!visiting", "class": "g-btn", "type": "button", "@click": "openSettings"}`.
- 준비/이전 상태: 내관 설정
- 입력: @click=openSettings / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openSettings 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: openSettings가account의이름/나이를draft로복사→settings패널
- 데이터·저장 시점: 열기만으로DB변경없음
- 실행 연결: WorldView.vue::openSettings, WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내관 설정. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 열기만으로DB변경없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 열기만으로DB변경없음 / 이 요소의 전환 후 상태: openSettings가account의이름/나이를draft로복사→settings패널 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openSettings 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:404; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내관 설정 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-012 에 @click=openSettings 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: openSettings가account의이름/나이를draft로복사→settings패널
4. 예상저장/불변필드: 열기만으로DB변경없음
5. 취소·복귀검사: 열기만으로DB변경없음 / 이 요소의 전환 후 상태: openSettings가account의이름/나이를draft로복사→settings패널 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openSettings의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-013 · UI-103 · 미술관 마을

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `미술관 마을`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"v-if": "space!=='inside' && !visiting", "class": "g-btn", "type": "button", "@click": "showTown()"}`.
- 준비/이전 상태: 내 광장/마을, 방문중아님
- 입력: @click=showTown() / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=showTown() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: showTown→panel닫음·visiting선택초기화·reload→social.town→마을/주민구성
- 데이터·저장 시점: DB읽기만. 오류토스트, 이전카메라/상태완전복구는구현없음
- 실행 연결: WorldView.vue::showTown, WorldView.vue::reload, WorldView.vue::say (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내 광장/마을, 방문중아님. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. DB읽기만. 오류토스트, 이전카메라/상태완전복구는구현없음
- 취소·ESC·포커스: DB읽기만. 오류토스트, 이전카메라/상태완전복구는구현없음 / 이 요소의 전환 후 상태: showTown→panel닫음·visiting선택초기화·reload→social.town→마을/주민구성 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=showTown() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:405; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내 광장/마을, 방문중아님 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-013 에 @click=showTown() 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: showTown→panel닫음·visiting선택초기화·reload→social.town→마을/주민구성
4. 예상저장/불변필드: DB읽기만. 오류토스트, 이전카메라/상태완전복구는구현없음
5. 취소·복귀검사: DB읽기만. 오류토스트, 이전카메라/상태완전복구는구현없음 / 이 요소의 전환 후 상태: showTown→panel닫음·visiting선택초기화·reload→social.town→마을/주민구성 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=showTown()의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-014 · UI-104 · 친구 초대

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `친구 초대`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"v-if": "!visiting", "class": "g-btn", "type": "button", "@click": "openPanel('social')"}`.
- 준비/이전 상태: 내관 친구초대
- 입력: @click=openPanel('social') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openPanel('social') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: openPanel social→로컬친구패널
- 데이터·저장 시점: 자동초대생성/전송없음;WorldSocial-003이생성
- 실행 연결: WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내관 친구초대. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 자동초대생성/전송없음;WorldSocial-003이생성; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 자동초대생성/전송없음;WorldSocial-003이생성 / 이 요소의 전환 후 상태: openPanel social→로컬친구패널 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openPanel('social') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:406; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내관 친구초대 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-014 에 @click=openPanel('social') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: openPanel social→로컬친구패널
4. 예상저장/불변필드: 자동초대생성/전송없음;WorldSocial-003이생성
5. 취소·복귀검사: 자동초대생성/전송없음;WorldSocial-003이생성 / 이 요소의 전환 후 상태: openPanel social→로컬친구패널 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openPanel('social')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-015 · UI-105 · 우리 미술관으로

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `우리 미술관으로`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"v-if": "space==='town'", "class": "g-btn", "type": "button", "@click": "familyChanged"}`.
- 준비/이전 상태: 마을화면
- 입력: @click=familyChanged / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=familyChanged 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: familyChanged→visiting/selectedBuilding/panel/selection/nearId 초기화→boot 내광장
- 데이터·저장 시점: 활성가족DB는바꾸지않음. boot읽기실패catch없음
- 실행 연결: WorldView.vue::familyChanged, WorldView.vue::boot, WorldView.vue::openView, WorldView.vue::visitSelected, WorldView.vue::addRoom, WorldView.vue::onSpaceFade, WorldView.vue::closeView, WorldView.vue::openPanel, WorldView.vue::say, WorldView.vue::showTown, store.ts::saveRooms, WorldView.vue::reload (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 마을화면. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 활성가족DB는바꾸지않음. boot읽기실패catch없음
- 취소·ESC·포커스: 활성가족DB는바꾸지않음. boot읽기실패catch없음 / 이 요소의 전환 후 상태: familyChanged→visiting/selectedBuilding/panel/selection/nearId 초기화→boot 내광장 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=familyChanged 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:407; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 마을화면 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-015 에 @click=familyChanged 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: familyChanged→visiting/selectedBuilding/panel/selection/nearId 초기화→boot 내광장
4. 예상저장/불변필드: 활성가족DB는바꾸지않음. boot읽기실패catch없음
5. 취소·복귀검사: 활성가족DB는바꾸지않음. boot읽기실패catch없음 / 이 요소의 전환 후 상태: familyChanged→visiting/selectedBuilding/panel/selection/nearId 초기화→boot 내광장 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=familyChanged의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-016 · UI-106 · {{b.child}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `{{b.child}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "section", "conditions": {"v-if": "space==='town' && !panel"}}]`; 자체속성 `{"v-for": "b in townBuildings", ":key": "b.id", "type": "button", "class": "g-btn", "@click": "selectedBuilding=b;engine?.showTown(townBuildings,b.id);engine?.setResidents(townBuildings)"}`.
- 준비/이전 상태: 마을,합성건물B
- 입력: @click=selectedBuilding=b;engine?.showTown(townBuildings,b.id);engine?.setResidents(townBuildings) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=selectedBuilding=b;engine?.showTown(townBuildings,b.id);engine?.setResidents(townBuildings) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: selectedBuilding=B,showTown(...,B.id),setResidents;입장버튼표시
- 데이터·저장 시점: 건물선택/초점만;아직gallery읽기/입장아님
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 마을,합성건물B. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 건물선택/초점만;아직gallery읽기/입장아님; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 건물선택/초점만;아직gallery읽기/입장아님 / 이 요소의 전환 후 상태: selectedBuilding=B,showTown(...,B.id),setResidents;입장버튼표시 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=selectedBuilding=b;engine?.showTown(townBuildings,b.id);engine?.setResidents(townBuildings) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:412; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 마을,합성건물B 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-016 에 @click=selectedBuilding=b;engine?.showTown(townBuildings,b.id);engine?.setResidents(townBuildings) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: selectedBuilding=B,showTown(...,B.id),setResidents;입장버튼표시
4. 예상저장/불변필드: 건물선택/초점만;아직gallery읽기/입장아님
5. 취소·복귀검사: 건물선택/초점만;아직gallery읽기/입장아님 / 이 요소의 전환 후 상태: selectedBuilding=B,showTown(...,B.id),setResidents;입장버튼표시 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=selectedBuilding=b;engine?.showTown(townBuildings,b.id);engine?.setResidents(townBuildings)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-017 · UI-107 · 들어가기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `들어가기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "section", "conditions": {"v-if": "space==='town' && !panel"}}, {"tag": "template", "conditions": {"v-if": "selectedBuilding"}}]`; 자체속성 `{"class": "g-btn g-btn--primary", "type": "button", "@click": "visitSelected"}`.
- 준비/이전 상태: 마을에서B선택
- 입력: @click=visitSelected / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=visitSelected 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: 내건물이면familyChanged후enterMuseum;친구면social.gallery→visiting/작품교체→건물·월드→enterMuseum
- 데이터·저장 시점: 친구original은빈Blob로구성,편집메뉴숨김. 실패안내후showTown 복귀시도
- 실행 연결: WorldView.vue::visitSelected, WorldView.vue::familyChanged, WorldView.vue::say, WorldView.vue::showTown, WorldView.vue::boot, WorldView.vue::reload, WorldView.vue::openView, WorldView.vue::addRoom, WorldView.vue::onSpaceFade, WorldView.vue::closeView, WorldView.vue::openPanel, store.ts::saveRooms (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 마을에서B선택. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 친구original은빈Blob로구성,편집메뉴숨김. 실패안내후showTown 복귀시도
- 취소·ESC·포커스: 친구original은빈Blob로구성,편집메뉴숨김. 실패안내후showTown 복귀시도 / 이 요소의 전환 후 상태: 내건물이면familyChanged후enterMuseum;친구면social.gallery→visiting/작품교체→건물·월드→enterMuseum / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=visitSelected 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:412; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 마을에서B선택 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-017 에 @click=visitSelected 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 내건물이면familyChanged후enterMuseum;친구면social.gallery→visiting/작품교체→건물·월드→enterMuseum
4. 예상저장/불변필드: 친구original은빈Blob로구성,편집메뉴숨김. 실패안내후showTown 복귀시도
5. 취소·복귀검사: 친구original은빈Blob로구성,편집메뉴숨김. 실패안내후showTown 복귀시도 / 이 요소의 전환 후 상태: 내건물이면familyChanged후enterMuseum;친구면social.gallery→visiting/작품교체→건물·월드→enterMuseum / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=visitSelected의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-018 · UI-108 · 한 장 더 남기기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `한 장 더 남기기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "section", "conditions": {"v-if": "recentSaved && !panel"}}]`; 자체속성 `{"class": "g-btn", "@click": "openPanel('upload');recentSaved=null"}`.
- 준비/이전 상태: 보관완료카드 recentSaved=A
- 입력: @click=openPanel('upload');recentSaved=null / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openPanel('upload');recentSaved=null 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: openPanel upload;recentSaved=null→새사진선택
- 데이터·저장 시점: 이미저장된A불변;새작품아직없음
- 실행 연결: WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 보관완료카드 recentSaved=A. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 이미저장된A불변;새작품아직없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 이미저장된A불변;새작품아직없음 / 이 요소의 전환 후 상태: openPanel upload;recentSaved=null→새사진선택 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openPanel('upload');recentSaved=null 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:414; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 보관완료카드 recentSaved=A 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-018 에 @click=openPanel('upload');recentSaved=null 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: openPanel upload;recentSaved=null→새사진선택
4. 예상저장/불변필드: 이미저장된A불변;새작품아직없음
5. 취소·복귀검사: 이미저장된A불변;새작품아직없음 / 이 요소의 전환 후 상태: openPanel upload;recentSaved=null→새사진선택 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openPanel('upload');recentSaved=null의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-019 · UI-109 · 보관한 작품 보기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `보관한 작품 보기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "section", "conditions": {"v-if": "recentSaved && !panel"}}]`; 자체속성 `{"class": "g-btn", "@click": "openArchive(recentSaved);recentSaved=null"}`.
- 준비/이전 상태: 보관완료카드 recentSaved=A
- 입력: @click=openArchive(recentSaved);recentSaved=null / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openArchive(recentSaved);recentSaved=null 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: openArchive(A);recentSaved=null→A상세보관함
- 데이터·저장 시점: A조회만; 저장없음
- 실행 연결: WorldView.vue::openArchive, WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 보관완료카드 recentSaved=A. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. A조회만; 저장없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: A조회만; 저장없음 / 이 요소의 전환 후 상태: openArchive(A);recentSaved=null→A상세보관함 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openArchive(recentSaved);recentSaved=null 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:414; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 보관완료카드 recentSaved=A 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-019 에 @click=openArchive(recentSaved);recentSaved=null 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: openArchive(A);recentSaved=null→A상세보관함
4. 예상저장/불변필드: A조회만; 저장없음
5. 취소·복귀검사: A조회만; 저장없음 / 이 요소의 전환 후 상태: openArchive(A);recentSaved=null→A상세보관함 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openArchive(recentSaved);recentSaved=null의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-020 · UI-110 · 미술관에서 만나기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `미술관에서 만나기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "section", "conditions": {"v-if": "recentSaved && !panel"}}]`; 자체속성 `{"class": "g-btn g-btn--primary", "@click": "engine?.reveal(recentSaved);recentSaved=null"}`.
- 준비/이전 상태: 보관완료카드 recentSaved=A
- 입력: @click=engine?.reveal(recentSaved);recentSaved=null / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=engine?.reveal(recentSaved);recentSaved=null 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: engine.reveal(A);recentSaved=null→전시장A로안내/시선
- 데이터·저장 시점: 저장없음;자동재생여부는engine.reveal소스증거로확인, UI는play직접호출없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 보관완료카드 recentSaved=A. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 저장없음;자동재생여부는engine.reveal소스증거로확인, UI는play직접호출없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 저장없음;자동재생여부는engine.reveal소스증거로확인, UI는play직접호출없음 / 이 요소의 전환 후 상태: engine.reveal(A);recentSaved=null→전시장A로안내/시선 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=engine?.reveal(recentSaved);recentSaved=null 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:414; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 보관완료카드 recentSaved=A 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-020 에 @click=engine?.reveal(recentSaved);recentSaved=null 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: engine.reveal(A);recentSaved=null→전시장A로안내/시선
4. 예상저장/불변필드: 저장없음;자동재생여부는engine.reveal소스증거로확인, UI는play직접호출없음
5. 취소·복귀검사: 저장없음;자동재생여부는engine.reveal소스증거로확인, UI는play직접호출없음 / 이 요소의 전환 후 상태: engine.reveal(A);recentSaved=null→전시장A로안내/시선 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=engine?.reveal(recentSaved);recentSaved=null의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-021 · UI-111 · 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `닫기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "section", "conditions": {"v-if": "recentSaved && !panel"}}]`; 자체속성 `{"class": "g-btn", "@click": "recentSaved=null"}`.
- 준비/이전 상태: 보관완료카드 recentSaved=A
- 입력: @click=recentSaved=null / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=recentSaved=null 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: recentSaved=null→완료카드닫힘
- 데이터·저장 시점: 저장된A는삭제되지않음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 보관완료카드 recentSaved=A. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 저장된A는삭제되지않음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 저장된A는삭제되지않음 / 이 요소의 전환 후 상태: recentSaved=null→완료카드닫힘 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=recentSaved=null 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:414; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 보관완료카드 recentSaved=A 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-021 에 @click=recentSaved=null 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: recentSaved=null→완료카드닫힘
4. 예상저장/불변필드: 저장된A는삭제되지않음
5. 취소·복귀검사: 저장된A는삭제되지않음 / 이 요소의 전환 후 상태: recentSaved=null→완료카드닫힘 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=recentSaved=null의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-022 · UI-112 · 가까이 보기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `가까이 보기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "section", "conditions": {"v-if": "shownPlaque && shownWork && !panel"}}]`; 자체속성 `{"class": "g-btn g-btn--primary", "type": "button", "@click": "openView(shownWork)"}`.
- 준비/이전 상태: 합성A 명패표시
- 입력: @click=openView(shownWork) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openView(shownWork) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: openView(A)→display Blob URL,viewWork=A,storyDraft=A.words,view패널
- 데이터·저장 시점: 화면용축소본감상. original파일은보관함다운로드;카메라자동재생없음
- 실행 연결: WorldView.vue::openView, WorldView.vue::closeView, WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성A 명패표시. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 화면용축소본감상. original파일은보관함다운로드;카메라자동재생없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 화면용축소본감상. original파일은보관함다운로드;카메라자동재생없음 / 이 요소의 전환 후 상태: openView(A)→display Blob URL,viewWork=A,storyDraft=A.words,view패널 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openView(shownWork) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:423; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성A 명패표시 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-022 에 @click=openView(shownWork) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: openView(A)→display Blob URL,viewWork=A,storyDraft=A.words,view패널
4. 예상저장/불변필드: 화면용축소본감상. original파일은보관함다운로드;카메라자동재생없음
5. 취소·복귀검사: 화면용축소본감상. original파일은보관함다운로드;카메라자동재생없음 / 이 요소의 전환 후 상태: openView(A)→display Blob URL,viewWork=A,storyDraft=A.words,view패널 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openView(shownWork)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-023 · UI-113 · 움직이기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `움직이기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "section", "conditions": {"v-if": "shownPlaque && shownWork && !panel"}}]`; 자체속성 `{"class": "g-btn", "type": "button", ":disabled": "webglFailed", "@click": "playShown"}`.
- 준비/이전 상태: 합성A 명패,WebGL정상
- 입력: @click=playShown / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=playShown 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: playShown→engine.play(A.id),명시적작품움직임시작
- 데이터·저장 시점: 저장없음. 가까이보기와독립
- 실행 연결: WorldView.vue::playShown (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성A 명패,WebGL정상. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 저장없음. 가까이보기와독립; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 저장없음. 가까이보기와독립 / 이 요소의 전환 후 상태: playShown→engine.play(A.id),명시적작품움직임시작 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=playShown 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:424; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성A 명패,WebGL정상 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-023 에 @click=playShown 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: playShown→engine.play(A.id),명시적작품움직임시작
4. 예상저장/불변필드: 저장없음. 가까이보기와독립
5. 취소·복귀검사: 저장없음. 가까이보기와독립 / 이 요소의 전환 후 상태: playShown→engine.play(A.id),명시적작품움직임시작 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=playShown의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-024 · UI-114 · 들려주기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `들려주기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "section", "conditions": {"v-if": "shownPlaque && shownWork && !panel"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "listen"}`.
- 준비/이전 상태: 합성A 명패,guide존재
- 입력: @click=listen / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=listen 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: speak(guide);미지원반환시토스트
- 데이터·저장 시점: DB저장없음. 브라우저음성지원/소리설정에영향, 실제기기음성미검증
- 실행 연결: WorldView.vue::listen, WorldView.vue::say (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 합성A 명패,guide존재. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. DB저장없음. 브라우저음성지원/소리설정에영향, 실제기기음성미검증
- 취소·ESC·포커스: DB저장없음. 브라우저음성지원/소리설정에영향, 실제기기음성미검증 / 이 요소의 전환 후 상태: speak(guide);미지원반환시토스트 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=listen 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:425; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 합성A 명패,guide존재 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-024 에 @click=listen 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: speak(guide);미지원반환시토스트
4. 예상저장/불변필드: DB저장없음. 브라우저음성지원/소리설정에영향, 실제기기음성미검증
5. 취소·복귀검사: DB저장없음. 브라우저음성지원/소리설정에영향, 실제기기음성미검증 / 이 요소의 전환 후 상태: speak(guide);미지원반환시토스트 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=listen의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-025 · UI-115 · 대표작으로 걸기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `대표작으로 걸기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "section", "conditions": {"v-if": "shownPlaque && shownWork && !panel"}}]`; 자체속성 `{"v-if": "!visiting && featuredId!==shownWork.id", "class": "g-btn", "type": "button", "@click": "setFeatured(shownWork.id)"}`.
- 준비/이전 상태: 내A명패,현재대표작B
- 입력: @click=setFeatured(shownWork.id) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=setFeatured(shownWork.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: savePrefs({...prefs,featured:A.id})성공후prefs·engine대표작교체·토스트
- 데이터·저장 시점: 실패시이전prefs유지,오류토스트.작품ID/바이트불변
- 실행 연결: WorldView.vue::setFeatured, store.ts::savePrefs, WorldView.vue::say (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내A명패,현재대표작B. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 실패시이전prefs유지,오류토스트.작품ID/바이트불변
- 취소·ESC·포커스: 실패시이전prefs유지,오류토스트.작품ID/바이트불변 / 이 요소의 전환 후 상태: savePrefs({...prefs,featured:A.id})성공후prefs·engine대표작교체·토스트 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=setFeatured(shownWork.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:426; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내A명패,현재대표작B 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-025 에 @click=setFeatured(shownWork.id) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: savePrefs({...prefs,featured:A.id})성공후prefs·engine대표작교체·토스트
4. 예상저장/불변필드: 실패시이전prefs유지,오류토스트.작품ID/바이트불변
5. 취소·복귀검사: 실패시이전prefs유지,오류토스트.작품ID/바이트불변 / 이 요소의 전환 후 상태: savePrefs({...prefs,featured:A.id})성공후prefs·engine대표작교체·토스트 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::savePrefs를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 실패시이전prefs유지,오류토스트.작품ID/바이트불변

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-026 · UI-116 · 보관함에서 보기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `보관함에서 보기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "section", "conditions": {"v-if": "shownPlaque && shownWork && !panel"}}]`; 자체속성 `{"v-if": "!visiting", "class": "g-btn", "type": "button", "@click": "openArchive(shownWork.id)"}`.
- 준비/이전 상태: 내A명패
- 입력: @click=openArchive(shownWork.id) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openArchive(shownWork.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: openArchive(A.id)→A선택보관함
- 데이터·저장 시점: 저장없음. 원본내려받기/정보편집은보관함개별버튼
- 실행 연결: WorldView.vue::openArchive, WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내A명패. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 저장없음. 원본내려받기/정보편집은보관함개별버튼; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 저장없음. 원본내려받기/정보편집은보관함개별버튼 / 이 요소의 전환 후 상태: openArchive(A.id)→A선택보관함 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openArchive(shownWork.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:428; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내A명패 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-026 에 @click=openArchive(shownWork.id) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: openArchive(A.id)→A선택보관함
4. 예상저장/불변필드: 저장없음. 원본내려받기/정보편집은보관함개별버튼
5. 취소·복귀검사: 저장없음. 원본내려받기/정보편집은보관함개별버튼 / 이 요소의 전환 후 상태: openArchive(A.id)→A선택보관함 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openArchive(shownWork.id)의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-027 · UI-117 · storyDraft

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `아이가 한 말, 그때 이야기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'view' && viewWork"}}, {"tag": "template", "conditions": {"v-if": "!visiting"}}]`; 자체속성 `{"v-model": "storyDraft", "class": "w-input", "maxlength": "200", "rows": "4", "placeholder": "아이에게 이 그림 이야기를 들려 달라고 해 보세요"}`.
- 준비/이전 상태: 내A가까이보기,storyDraft=옛말
- 입력: ; v-model=storyDraft / 키보드: 텍스트입력/붙여넣기,Enter는줄바꿈. maxlength준수;Enter를저장단축키로가정하지않음. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 새이야기입력200자이하→storyDraft,저장버튼활성
- 데이터·저장 시점: 이 입력만으로A.words변경없음. 닫기확인없이초안소실
- 실행 연결: WorldView.vue::saveStory, store.ts::updateArtworkInfo, WorldView.vue::reload, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내A가까이보기,storyDraft=옛말. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 이 입력만으로A.words변경없음. 닫기확인없이초안소실
- 취소·ESC·포커스: 이 입력만으로A.words변경없음. 닫기확인없이초안소실 / 이 요소의 전환 후 상태: 새이야기입력200자이하→storyDraft,저장버튼활성 / ESC·패널닫기는 공통 view 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `view` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:443; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내A가까이보기,storyDraft=옛말 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-027 에 ; v-model=storyDraft 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 새이야기입력200자이하→storyDraft,저장버튼활성
4. 예상저장/불변필드: 이 입력만으로A.words변경없음. 닫기확인없이초안소실
5. 취소·복귀검사: 이 입력만으로A.words변경없음. 닫기확인없이초안소실 / 이 요소의 전환 후 상태: 새이야기입력200자이하→storyDraft,저장버튼활성 / ESC·패널닫기는 공통 view 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. storyDraft 변경 후 saveStory의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::updateArtworkInfo를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 이 입력만으로A.words변경없음. 닫기확인없이초안소실

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-028 · UI-118 · 이야기 남기기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `이야기 남기기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'view' && viewWork"}}]`; 자체속성 `{"v-if": "!visiting", "class": "g-btn g-btn--primary", "type": "button", ":disabled": "storyBusy || storyDraft === viewWork.words", "@click": "saveStory"}`.
- 준비/이전 상태: 내A가까이보기,storyDraft≠A.words,storyBusy=false
- 입력: @click=saveStory / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=saveStory 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: updateArtworkInfo→reload→viewWork갱신→성공문구;실패문구와초안유지;busy해제
- 데이터·저장 시점: A의기존정보를그대로넘기고words변경. 원본/ID불변. 저장중닫기를막거나요청취소하는구현없음
- 실행 연결: WorldView.vue::saveStory, store.ts::updateArtworkInfo, WorldView.vue::reload, store.ts::saveArtworkAndRoom (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 내A가까이보기,storyDraft≠A.words,storyBusy=false. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. A의기존정보를그대로넘기고words변경. 원본/ID불변. 저장중닫기를막거나요청취소하는구현없음
- 취소·ESC·포커스: A의기존정보를그대로넘기고words변경. 원본/ID불변. 저장중닫기를막거나요청취소하는구현없음 / 이 요소의 전환 후 상태: updateArtworkInfo→reload→viewWork갱신→성공문구;실패문구와초안유지;busy해제 / ESC·패널닫기는 공통 view 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `view` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=saveStory 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:448; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 내A가까이보기,storyDraft≠A.words,storyBusy=false 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-028 에 @click=saveStory 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: updateArtworkInfo→reload→viewWork갱신→성공문구;실패문구와초안유지;busy해제
4. 예상저장/불변필드: A의기존정보를그대로넘기고words변경. 원본/ID불변. 저장중닫기를막거나요청취소하는구현없음
5. 취소·복귀검사: A의기존정보를그대로넘기고words변경. 원본/ID불변. 저장중닫기를막거나요청취소하는구현없음 / 이 요소의 전환 후 상태: updateArtworkInfo→reload→viewWork갱신→성공문구;실패문구와초안유지;busy해제 / ESC·패널닫기는 공통 view 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::updateArtworkInfo를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. A의기존정보를그대로넘기고words변경. 원본/ID불변. 저장중닫기를막거나요청취소하는구현없음

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-029 · UI-119 · 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `닫기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'view' && viewWork"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "closePanel"}`.
- 준비/이전 상태: 가까이보기패널,초안변경또는저장중
- 입력: @click=closePanel / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=closePanel 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: closePanel→closeView URLrevoke·viewWork=null→panel=null
- 데이터·저장 시점: 미저장words저장안함;이미시작된saveStory는취소안됨. ESC동일
- 실행 연결: WorldView.vue::closePanel, WorldView.vue::closeView (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 가까이보기패널,초안변경또는저장중. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 미저장words저장안함;이미시작된saveStory는취소안됨. ESC동일; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 미저장words저장안함;이미시작된saveStory는취소안됨. ESC동일 / 이 요소의 전환 후 상태: closePanel→closeView URLrevoke·viewWork=null→panel=null / ESC·패널닫기는 공통 view 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `view` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=closePanel 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:449; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 가까이보기패널,초안변경또는저장중 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-029 에 @click=closePanel 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: closePanel→closeView URLrevoke·viewWork=null→panel=null
4. 예상저장/불변필드: 미저장words저장안함;이미시작된saveStory는취소안됨. ESC동일
5. 취소·복귀검사: 미저장words저장안함;이미시작된saveStory는취소안됨. ESC동일 / 이 요소의 전환 후 상태: closePanel→closeView URLrevoke·viewWork=null→panel=null / ESC·패널닫기는 공통 view 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=closePanel의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-030 · UI-120 · 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `닫기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "section", "conditions": {"v-if": "masterpiece && !panel && !visiting"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "selection = null"}`.
- 준비/이전 상태: 공개명화 masterpiece 명패
- 입력: @click=selection = null / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=selection = null 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: selection=null→명화명패닫힘
- 데이터·저장 시점: 아이대표작설정과무관. DB쓰기없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 공개명화 masterpiece 명패. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 아이대표작설정과무관. DB쓰기없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 아이대표작설정과무관. DB쓰기없음 / 이 요소의 전환 후 상태: selection=null→명화명패닫힘 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=selection = null 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:459; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 공개명화 masterpiece 명패 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-030 에 @click=selection = null 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: selection=null→명화명패닫힘
4. 예상저장/불변필드: 아이대표작설정과무관. DB쓰기없음
5. 취소·복귀검사: 아이대표작설정과무관. DB쓰기없음 / 이 요소의 전환 후 상태: selection=null→명화명패닫힘 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=selection = null의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-031 · UI-121 · E   {{interaction.label}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `E   {{interaction.label}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"v-if": "interaction && (interaction.kind==='building' || !shownWork) && !panel && !recentSaved", "class": "w-interaction g-btn g-btn--primary", "@click": "engine?.interact()"}`.
- 준비/이전 상태: interaction prompt 있고패널/완료카드없음
- 입력: @click=engine?.interact() / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=engine?.interact() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: engine.interact:work면faceWork→onSelect→onView(가까이보기);building이면입장/선택관방문
- 데이터·저장 시점: E도같은interact. 화면작품직접클릭의명패선택과구별. 저장없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: interaction prompt 있고패널/완료카드없음. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. E도같은interact. 화면작품직접클릭의명패선택과구별. 저장없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: E도같은interact. 화면작품직접클릭의명패선택과구별. 저장없음 / 이 요소의 전환 후 상태: engine.interact:work면faceWork→onSelect→onView(가까이보기);building이면입장/선택관방문 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=engine?.interact() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:462; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. interaction prompt 있고패널/완료카드없음 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-031 에 @click=engine?.interact() 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: engine.interact:work면faceWork→onSelect→onView(가까이보기);building이면입장/선택관방문
4. 예상저장/불변필드: E도같은interact. 화면작품직접클릭의명패선택과구별. 저장없음
5. 취소·복귀검사: E도같은interact. 화면작품직접클릭의명패선택과구별. 저장없음 / 이 요소의 전환 후 상태: engine.interact:work면faceWork→onSelect→onView(가까이보기);building이면입장/선택관방문 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=engine?.interact()의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-032 · UI-122 · 사용법

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `사용법`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "aside", "conditions": {"v-if": "coarse && helpTip && space==='plaza' && !panel && !interaction && !shownWork && !recentSaved && !webglFailed"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "openPanel('help')"}`.
- 준비/이전 상태: coarse·첫도움말·광장조건
- 입력: @click=openPanel('help') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=openPanel('help') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: openPanel help→모바일조작도움말
- 데이터·저장 시점: helpTip세션값은그대로;닫기버튼033과다름
- 실행 연결: WorldView.vue::openPanel (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: coarse·첫도움말·광장조건. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. helpTip세션값은그대로;닫기버튼033과다름; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: helpTip세션값은그대로;닫기버튼033과다름 / 이 요소의 전환 후 상태: openPanel help→모바일조작도움말 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=openPanel('help') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:467; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. coarse·첫도움말·광장조건 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-032 에 @click=openPanel('help') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: openPanel help→모바일조작도움말
4. 예상저장/불변필드: helpTip세션값은그대로;닫기버튼033과다름
5. 취소·복귀검사: helpTip세션값은그대로;닫기버튼033과다름 / 이 요소의 전환 후 상태: openPanel help→모바일조작도움말 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=openPanel('help')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-033 · UI-123 · 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `닫기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "aside", "conditions": {"v-if": "coarse && helpTip && space==='plaza' && !panel && !interaction && !shownWork && !recentSaved && !webglFailed"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "dismissHelpTip"}`.
- 준비/이전 상태: 첫도움말표시
- 입력: @click=dismissHelpTip / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=dismissHelpTip 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: helpTip=false,sessionStorage uam-world-help-seen=yes 시도
- 데이터·저장 시점: 저장차단catch에서도현재도움말숨김;재로딩시다시보일수있음
- 실행 연결: WorldView.vue::dismissHelpTip (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 첫도움말표시. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 저장차단catch에서도현재도움말숨김;재로딩시다시보일수있음
- 취소·ESC·포커스: 저장차단catch에서도현재도움말숨김;재로딩시다시보일수있음 / 이 요소의 전환 후 상태: helpTip=false,sessionStorage uam-world-help-seen=yes 시도 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=dismissHelpTip 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:467; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 첫도움말표시 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-033 에 @click=dismissHelpTip 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: helpTip=false,sessionStorage uam-world-help-seen=yes 시도
4. 예상저장/불변필드: 저장차단catch에서도현재도움말숨김;재로딩시다시보일수있음
5. 취소·복귀검사: 저장차단catch에서도현재도움말숨김;재로딩시다시보일수있음 / 이 요소의 전환 후 상태: helpTip=false,sessionStorage uam-world-help-seen=yes 시도 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=dismissHelpTip의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-034 · UI-124 · 손 흔들기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `손 흔들기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "!panel && !webglFailed"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "engine?.gesture('wave')"}`.
- 준비/이전 상태: 패널없음·WebGL정상
- 입력: @click=engine?.gesture('wave') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=engine?.gesture('wave') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: engine.gesture wave→손흔들기
- 데이터·저장 시점: 일시동작만;아바타cfg저장없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 패널없음·WebGL정상. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 일시동작만;아바타cfg저장없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 일시동작만;아바타cfg저장없음 / 이 요소의 전환 후 상태: engine.gesture wave→손흔들기 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=engine?.gesture('wave') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:474; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 패널없음·WebGL정상 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-034 에 @click=engine?.gesture('wave') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: engine.gesture wave→손흔들기
4. 예상저장/불변필드: 일시동작만;아바타cfg저장없음
5. 취소·복귀검사: 일시동작만;아바타cfg저장없음 / 이 요소의 전환 후 상태: engine.gesture wave→손흔들기 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=engine?.gesture('wave')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-035 · UI-125 · 춤

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `춤`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "!panel && !webglFailed"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "engine?.gesture('dance')"}`.
- 준비/이전 상태: 패널없음·WebGL정상
- 입력: @click=engine?.gesture('dance') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=engine?.gesture('dance') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: engine.gesture dance→춤동작
- 데이터·저장 시점: 일시동작만;아바타cfg저장없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 패널없음·WebGL정상. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 일시동작만;아바타cfg저장없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 일시동작만;아바타cfg저장없음 / 이 요소의 전환 후 상태: engine.gesture dance→춤동작 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=engine?.gesture('dance') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:474; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 패널없음·WebGL정상 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-035 에 @click=engine?.gesture('dance') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: engine.gesture dance→춤동작
4. 예상저장/불변필드: 일시동작만;아바타cfg저장없음
5. 취소·복귀검사: 일시동작만;아바타cfg저장없음 / 이 요소의 전환 후 상태: engine.gesture dance→춤동작 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=engine?.gesture('dance')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-036 · UI-126 · 점프

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `점프`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "!panel && !webglFailed"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "engine?.gesture('jump')"}`.
- 준비/이전 상태: 패널없음·WebGL정상
- 입력: @click=engine?.gesture('jump') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=engine?.gesture('jump') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: engine.gesture jump→점프동작
- 데이터·저장 시점: 일시동작만;아바타cfg저장없음
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 패널없음·WebGL정상. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 일시동작만;아바타cfg저장없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 일시동작만;아바타cfg저장없음 / 이 요소의 전환 후 상태: engine.gesture jump→점프동작 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=engine?.gesture('jump') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:474; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 패널없음·WebGL정상 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-036 에 @click=engine?.gesture('jump') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: engine.gesture jump→점프동작
4. 예상저장/불변필드: 일시동작만;아바타cfg저장없음
5. 취소·복귀검사: 일시동작만;아바타cfg저장없음 / 이 요소의 전환 후 상태: engine.gesture jump→점프동작 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=engine?.gesture('jump')의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-037 · UI-127 · 시점 되돌리기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `시점 되돌리기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'help'"}}]`; 자체속성 `{"class": "g-btn", "type": "button", ":disabled": "webglFailed", "@click": "engine?.resetView();closePanel()"}`.
- 준비/이전 상태: 사용법패널,시점변경,WebGL정상
- 입력: @click=engine?.resetView();closePanel() / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=engine?.resetView();closePanel() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: engine.resetView();closePanel()→시점복귀후도움말닫힘
- 데이터·저장 시점: R키는패널없을때동작;저장없음
- 실행 연결: WorldView.vue::closePanel, WorldView.vue::closeView (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 사용법패널,시점변경,WebGL정상. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. R키는패널없을때동작;저장없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: R키는패널없을때동작;저장없음 / 이 요소의 전환 후 상태: engine.resetView();closePanel()→시점복귀후도움말닫힘 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=engine?.resetView();closePanel() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:486; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 사용법패널,시점변경,WebGL정상 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-037 에 @click=engine?.resetView();closePanel() 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: engine.resetView();closePanel()→시점복귀후도움말닫힘
4. 예상저장/불변필드: R키는패널없을때동작;저장없음
5. 취소·복귀검사: R키는패널없을때동작;저장없음 / 이 요소의 전환 후 상태: engine.resetView();closePanel()→시점복귀후도움말닫힘 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=engine?.resetView();closePanel()의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-038 · UI-128 · 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `닫기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'help'"}}]`; 자체속성 `{"class": "g-btn g-btn--primary", "type": "button", "@click": "closePanel"}`.
- 준비/이전 상태: 사용법패널
- 입력: @click=closePanel / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=closePanel 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: closePanel→패널닫고월드입력복귀
- 데이터·저장 시점: 시점reset하지않음,DB불변
- 실행 연결: WorldView.vue::closePanel, WorldView.vue::closeView (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 사용법패널. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 시점reset하지않음,DB불변; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 시점reset하지않음,DB불변 / 이 요소의 전환 후 상태: closePanel→패널닫고월드입력복귀 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `hud` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=closePanel 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:486; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 사용법패널 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-038 에 @click=closePanel 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: closePanel→패널닫고월드입력복귀
4. 예상저장/불변필드: 시점reset하지않음,DB불변
5. 취소·복귀검사: 시점reset하지않음,DB불변 / 이 요소의 전환 후 상태: closePanel→패널닫고월드입력복귀 / ESC·패널닫기는 공통 hud 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=closePanel의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-039 · UI-129 · {{t.label}} {{t.note}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `{{t.label}} {{t.note}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'theme'"}}]`; 자체속성 `{"v-for": "t in THEMES", ":key": "t.id", "type": "button", "class": "theme", ":disabled": "changingScene", ":aria-pressed": "prefs?.theme === t.id", "@click": "setTheme(t.id)"}`.
- 준비/이전 상태: 모드패널,theme classic,changingScene=false
- 입력: @click=setTheme(t.id) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=setTheme(t.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: t선택→changeScene theme:씬먼저교체→savePrefs성공후prefs·환경음.실패이전씬복구시도
- 데이터·저장 시점: theme만변경,interior유지.복구실패는새로열기토스트;선택중buttons disabled
- 실행 연결: WorldView.vue::setTheme, WorldView.vue::changeScene, store.ts::savePrefs, WorldView.vue::say (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 모드패널,theme classic,changingScene=false. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. theme만변경,interior유지.복구실패는새로열기토스트;선택중buttons disabled
- 취소·ESC·포커스: theme만변경,interior유지.복구실패는새로열기토스트;선택중buttons disabled / 이 요소의 전환 후 상태: t선택→changeScene theme:씬먼저교체→savePrefs성공후prefs·환경음.실패이전씬복구시도 / ESC·패널닫기는 공통 theme 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `theme` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=setTheme(t.id) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:494; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 모드패널,theme classic,changingScene=false 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-039 에 @click=setTheme(t.id) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: t선택→changeScene theme:씬먼저교체→savePrefs성공후prefs·환경음.실패이전씬복구시도
4. 예상저장/불변필드: theme만변경,interior유지.복구실패는새로열기토스트;선택중buttons disabled
5. 취소·복귀검사: theme만변경,interior유지.복구실패는새로열기토스트;선택중buttons disabled / 이 요소의 전환 후 상태: t선택→changeScene theme:씬먼저교체→savePrefs성공후prefs·환경음.실패이전씬복구시도 / ESC·패널닫기는 공통 theme 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::savePrefs를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. theme만변경,interior유지.복구실패는새로열기토스트;선택중buttons disabled

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-040 · UI-130 · 미술관 밝은 전시실, 고른 모드의 모습

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `미술관 밝은 전시실, 고른 모드의 모습`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'theme'"}}]`; 자체속성 `{"type": "button", "class": "theme", ":disabled": "changingScene", ":aria-pressed": "(prefs?.interior ?? 'gallery') === 'gallery'", "@click": "setInterior('gallery')"}`.
- 준비/이전 상태: 모드패널,interior cathedral
- 입력: @click=setInterior('gallery') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=setInterior('gallery') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: setInterior gallery→모드별일반미술관씬→savePrefs
- 데이터·저장 시점: theme유지,interior=gallery 저장.실패이전cathedral복구시도
- 실행 연결: WorldView.vue::setInterior, WorldView.vue::changeScene, store.ts::savePrefs, WorldView.vue::say (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 모드패널,interior cathedral. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. theme유지,interior=gallery 저장.실패이전cathedral복구시도
- 취소·ESC·포커스: theme유지,interior=gallery 저장.실패이전cathedral복구시도 / 이 요소의 전환 후 상태: setInterior gallery→모드별일반미술관씬→savePrefs / ESC·패널닫기는 공통 theme 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `theme` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=setInterior('gallery') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:502; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 모드패널,interior cathedral 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-040 에 @click=setInterior('gallery') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: setInterior gallery→모드별일반미술관씬→savePrefs
4. 예상저장/불변필드: theme유지,interior=gallery 저장.실패이전cathedral복구시도
5. 취소·복귀검사: theme유지,interior=gallery 저장.실패이전cathedral복구시도 / 이 요소의 전환 후 상태: setInterior gallery→모드별일반미술관씬→savePrefs / ESC·패널닫기는 공통 theme 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::savePrefs를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. theme유지,interior=gallery 저장.실패이전cathedral복구시도

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-041 · UI-131 · 대성당 고른 모드의 재료와 동선을 유지한 높은 특별전시 홀

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `대성당 고른 모드의 재료와 동선을 유지한 높은 특별전시 홀`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'theme'"}}]`; 자체속성 `{"type": "button", "class": "theme", ":disabled": "changingScene", ":aria-pressed": "prefs?.interior === 'cathedral'", "@click": "setInterior('cathedral')"}`.
- 준비/이전 상태: 모드패널,interior gallery
- 입력: @click=setInterior('cathedral') / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=setInterior('cathedral') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: setInterior cathedral→선택모드구조/재료를유지하는높은홀→savePrefs
- 데이터·저장 시점: theme유지,interior=cathedral.대성당아치완성여부와동작저장은별도
- 실행 연결: WorldView.vue::setInterior, WorldView.vue::changeScene, store.ts::savePrefs, WorldView.vue::say (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 모드패널,interior gallery. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. theme유지,interior=cathedral.대성당아치완성여부와동작저장은별도
- 취소·ESC·포커스: theme유지,interior=cathedral.대성당아치완성여부와동작저장은별도 / 이 요소의 전환 후 상태: setInterior cathedral→선택모드구조/재료를유지하는높은홀→savePrefs / ESC·패널닫기는 공통 theme 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `theme` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=setInterior('cathedral') 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:503; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 모드패널,interior gallery 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-041 에 @click=setInterior('cathedral') 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: setInterior cathedral→선택모드구조/재료를유지하는높은홀→savePrefs
4. 예상저장/불변필드: theme유지,interior=cathedral.대성당아치완성여부와동작저장은별도
5. 취소·복귀검사: theme유지,interior=cathedral.대성당아치완성여부와동작저장은별도 / 이 요소의 전환 후 상태: setInterior cathedral→선택모드구조/재료를유지하는높은홀→savePrefs / ESC·패널닫기는 공통 theme 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::savePrefs를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. theme유지,interior=cathedral.대성당아치완성여부와동작저장은별도

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-042 · UI-132 · 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `닫기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'theme'"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "closePanel"}`.
- 준비/이전 상태: 모드패널,변경전또는저장진행중
- 입력: @click=closePanel / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=closePanel 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: closePanel→패널닫힘
- 데이터·저장 시점: 이미저장된모드는유지.진행중changeScene취소기능없음;닫기disabled없음
- 실행 연결: WorldView.vue::closePanel, WorldView.vue::closeView (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 모드패널,변경전또는저장진행중. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 이미저장된모드는유지.진행중changeScene취소기능없음;닫기disabled없음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 이미저장된모드는유지.진행중changeScene취소기능없음;닫기disabled없음 / 이 요소의 전환 후 상태: closePanel→패널닫힘 / ESC·패널닫기는 공통 theme 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `theme` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=closePanel 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:505; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 모드패널,변경전또는저장진행중 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-042 에 @click=closePanel 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: closePanel→패널닫힘
4. 예상저장/불변필드: 이미저장된모드는유지.진행중changeScene취소기능없음;닫기disabled없음
5. 취소·복귀검사: 이미저장된모드는유지.진행중changeScene취소기능없음;닫기disabled없음 / 이 요소의 전환 후 상태: closePanel→패널닫힘 / ESC·패널닫기는 공통 theme 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=closePanel의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-043 · UI-133 · childName

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `아이 이름`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'settings'"}}]`; 자체속성 `{"v-model": "childName", "class": "w-input", "maxlength": "20"}`.
- 준비/이전 상태: 설정패널,childName=기존이름
- 입력: ; v-model=childName / 키보드: native input의텍스트/날짜입력. readonly이면편집불가. 폼내Enter의submit여부는formSubmit/조상form근거를따름. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 새이름입력maxlength20→childName초안
- 데이터·저장 시점: 045누르기전account/DB불변;닫으면미저장초안폐기
- 실행 연결: WorldView.vue::saveChild, store.ts::saveAccount, WorldView.vue::say, WorldView.vue::reload (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 설정패널,childName=기존이름. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 045누르기전account/DB불변;닫으면미저장초안폐기
- 취소·ESC·포커스: 045누르기전account/DB불변;닫으면미저장초안폐기 / 이 요소의 전환 후 상태: 새이름입력maxlength20→childName초안 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `settings` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:514; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 설정패널,childName=기존이름 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-043 에 ; v-model=childName 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 새이름입력maxlength20→childName초안
4. 예상저장/불변필드: 045누르기전account/DB불변;닫으면미저장초안폐기
5. 취소·복귀검사: 045누르기전account/DB불변;닫으면미저장초안폐기 / 이 요소의 전환 후 상태: 새이름입력maxlength20→childName초안 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. childName 변경 후 saveChild의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::saveAccount를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 045누르기전account/DB불변;닫으면미저장초안폐기

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-044 · UI-134 · {{n}} 세

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `지금 나이  {{n}} 세`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'settings'"}}]`; 자체속성 `{"v-model.number": "childAge", "class": "w-input"}`.
- 준비/이전 상태: 설정패널,childAge=4
- 입력: ; v-model.number=childAge / 키보드: native select: 방향키로항목변경,Enter/Space/Alt+Down등OS기본선택. v-model.number면숫자변환. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: 5선택→childAge숫자5
- 데이터·저장 시점: 045누르기전account/DB불변;기존작품age를일괄변경하지않음
- 실행 연결: WorldView.vue::saveChild, store.ts::saveAccount, WorldView.vue::say, WorldView.vue::reload (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 설정패널,childAge=4. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 045누르기전account/DB불변;기존작품age를일괄변경하지않음
- 취소·ESC·포커스: 045누르기전account/DB불변;기존작품age를일괄변경하지않음 / 이 요소의 전환 후 상태: 5선택→childAge숫자5 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `settings` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:516; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 설정패널,childAge=4 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-044 에 ; v-model.number=childAge 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: 5선택→childAge숫자5
4. 예상저장/불변필드: 045누르기전account/DB불변;기존작품age를일괄변경하지않음
5. 취소·복귀검사: 045누르기전account/DB불변;기존작품age를일괄변경하지않음 / 이 요소의 전환 후 상태: 5선택→childAge숫자5 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: 이 입력 자체는 저장을 호출하지 않는다. childAge 변경 후 saveChild의 명시적 저장 버튼을 누르는 별도 단계에서만 오류 주입한다. store.ts::saveAccount를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. 045누르기전account/DB불변;기존작품age를일괄변경하지않음

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-045 · UI-135 · 저장

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `저장`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'settings'"}}]`; 자체속성 `{"class": "g-btn g-btn--primary", "type": "button", "@click": "saveChild(childName, childAge)"}`.
- 준비/이전 상태: 설정,이름새이름·나이5,account존재
- 입력: @click=saveChild(childName, childAge) / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=saveChild(childName, childAge) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: trim20자·빈이름거절;account.value를먼저교체→saveAccount→reload→성공토스트
- 데이터·저장 시점: 실패시토스트만,account메모리rollback없음. 저장실패와reload실패를한catch로처리하므로DB성공후실패안내도가능
- 실행 연결: WorldView.vue::saveChild, store.ts::saveAccount, WorldView.vue::say, WorldView.vue::reload (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 설정,이름새이름·나이5,account존재. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: saveAccount를거래전reject: account.value는이미새이름/나이,DB는옛값,실패토스트만. rollback미구현. saveAccount성공후reload reject면DB는새값인데실패토스트. 두경우를분리검사하고새로열어DB값확인.
- 취소·ESC·포커스: 이름/나이입력후저장전닫기는DB불변. 저장클릭후닫기/ESC는진행중저장취소아님. 실패후취소해도메모리account원복없음. 공통 `settings` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=saveChild(childName, childAge) 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:518; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 설정,이름새이름·나이5,account존재 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-045 에 @click=saveChild(childName, childAge) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: trim20자·빈이름거절;account.value를먼저교체→saveAccount→reload→성공토스트
4. 예상저장/불변필드: 실패시토스트만,account메모리rollback없음. 저장실패와reload실패를한catch로처리하므로DB성공후실패안내도가능
5. 취소·복귀검사: 이름/나이입력후저장전닫기는DB불변. 저장클릭후닫기/ESC는진행중저장취소아님. 실패후취소해도메모리account원복없음.
6. 실패/경계검사: store.ts::saveAccount를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. saveAccount를거래전reject: account.value는이미새이름/나이,DB는옛값,실패토스트만. rollback미구현. saveAccount성공후reload reject면DB는새값인데실패토스트. 두경우를분리검사하고새로열어DB값확인.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-046 · UI-136 · 미술관 모양

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `미술관 모양`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'settings'"}}]`; 자체속성 `{"aria-label": "미술관 모양", "class": "w-input", ":value": "prefs?.building", "@change": "setBuilding(($event.target as HTMLSelectElement).value as MuseumStyle)"}`.
- 준비/이전 상태: 설정,건물양식선택
- 입력: @change=setBuilding(($event.target as HTMLSelectElement).value as MuseumStyle) / 키보드: native select: 방향키로항목변경,Enter/Space/Alt+Down등OS기본선택. v-model.number면숫자변환. / 터치: 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분.
- 실행 후 UI·카메라·씬: setBuilding선택→savePrefs성공후prefs와engine건물교체
- 데이터·저장 시점: building만저장.실패prefs유지·토스트;native select시각선택복귀는실기미검증
- 실행 연결: WorldView.vue::setBuilding, store.ts::savePrefs, WorldView.vue::say (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 설정,건물양식선택. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. building만저장.실패prefs유지·토스트;native select시각선택복귀는실기미검증
- 취소·ESC·포커스: building만저장.실패prefs유지·토스트;native select시각선택복귀는실기미검증 / 이 요소의 전환 후 상태: setBuilding선택→savePrefs성공후prefs와engine건물교체 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `settings` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 터치로입력에포커스→OS키보드/네이티브선택기. 스크롤과값변경을구분. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:519; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 설정,건물양식선택 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-046 에 @change=setBuilding(($event.target as HTMLSelectElement).value as MuseumStyle) 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: setBuilding선택→savePrefs성공후prefs와engine건물교체
4. 예상저장/불변필드: building만저장.실패prefs유지·토스트;native select시각선택복귀는실기미검증
5. 취소·복귀검사: building만저장.실패prefs유지·토스트;native select시각선택복귀는실기미검증 / 이 요소의 전환 후 상태: setBuilding선택→savePrefs성공후prefs와engine건물교체 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::savePrefs를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. building만저장.실패prefs유지·토스트;native select시각선택복귀는실기미검증

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-047 · UI-137 · 로비로 가기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `로비로 가기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'settings'"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "engine?.goLobby(); closePanel()"}`.
- 준비/이전 상태: 설정패널,실내다른방
- 입력: @click=engine?.goLobby(); closePanel() / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=engine?.goLobby(); closePanel() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: engine.goLobby();closePanel()→로비이동·패널닫힘
- 데이터·저장 시점: DB불변. 모드나interior를바꾸지않음
- 실행 연결: WorldView.vue::closePanel, WorldView.vue::closeView (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 설정패널,실내다른방. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. DB불변. 모드나interior를바꾸지않음; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: DB불변. 모드나interior를바꾸지않음 / 이 요소의 전환 후 상태: engine.goLobby();closePanel()→로비이동·패널닫힘 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `settings` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=engine?.goLobby(); closePanel() 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:522; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 설정패널,실내다른방 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-047 에 @click=engine?.goLobby(); closePanel() 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: engine.goLobby();closePanel()→로비이동·패널닫힘
4. 예상저장/불변필드: DB불변. 모드나interior를바꾸지않음
5. 취소·복귀검사: DB불변. 모드나interior를바꾸지않음 / 이 요소의 전환 후 상태: engine.goLobby();closePanel()→로비이동·패널닫힘 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=engine?.goLobby(); closePanel()의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-048 · UI-138 · {{hasSamples ? '견본 치우기' : '견본 다시 걸기'}}

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `{{hasSamples ? '견본 치우기' : '견본 다시 걸기'}}`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'settings'"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "toggleSamples"}`.
- 준비/이전 상태: 설정,합성견본존재/없음각각
- 입력: @click=toggleSamples / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=toggleSamples 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: hasSamples면removeSamples,없으면addSamples→토스트→reload
- 데이터·저장 시점: sample작품만추가/제거의도;일반작품불변을별도검사.중간실패rollback보장없음
- 실행 연결: WorldView.vue::toggleSamples, WorldView.vue::say, WorldView.vue::reload, store.ts::deleteArtwork (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 설정,합성견본존재/없음각각. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. sample작품만추가/제거의도;일반작품불변을별도검사.중간실패rollback보장없음
- 취소·ESC·포커스: sample작품만추가/제거의도;일반작품불변을별도검사.중간실패rollback보장없음 / 이 요소의 전환 후 상태: hasSamples면removeSamples,없으면addSamples→토스트→reload / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `settings` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=toggleSamples 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:523; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 설정,합성견본존재/없음각각 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-048 에 @click=toggleSamples 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: hasSamples면removeSamples,없으면addSamples→토스트→reload
4. 예상저장/불변필드: sample작품만추가/제거의도;일반작품불변을별도검사.중간실패rollback보장없음
5. 취소·복귀검사: sample작품만추가/제거의도;일반작품불변을별도검사.중간실패rollback보장없음 / 이 요소의 전환 후 상태: hasSamples면removeSamples,없으면addSamples→토스트→reload / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::deleteArtwork를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 직접/전이 handler의 catch 근거를 아래 failureEvidence에서 확인. 실행 순서별 부분 완료 가능성을 구분한다. sample작품만추가/제거의도;일반작품불변을별도검사.중간실패rollback보장없음

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-049 · UI-139 · 테스트 자료 지우기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `테스트 자료 지우기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'settings'"}}, {"tag": "template", "conditions": {"v-if": "!confirmReset"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "confirmReset = true"}`.
- 준비/이전 상태: 설정,confirmReset=false
- 입력: @click=confirmReset = true / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=confirmReset = true 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: confirmReset=true→모두지우기/그만두기확인표시
- 데이터·저장 시점: 아직clearAll호출없음. 실제가족자료로검사금지
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 설정,confirmReset=false. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 아직clearAll호출없음. 실제가족자료로검사금지; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 아직clearAll호출없음. 실제가족자료로검사금지 / 이 요소의 전환 후 상태: confirmReset=true→모두지우기/그만두기확인표시 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `settings` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=confirmReset = true 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:527; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 설정,confirmReset=false 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-049 에 @click=confirmReset = true 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: confirmReset=true→모두지우기/그만두기확인표시
4. 예상저장/불변필드: 아직clearAll호출없음. 실제가족자료로검사금지
5. 취소·복귀검사: 아직clearAll호출없음. 실제가족자료로검사금지 / 이 요소의 전환 후 상태: confirmReset=true→모두지우기/그만두기확인표시 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=confirmReset = true의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-050 · UI-140 · 모두 지우기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `모두 지우기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'settings'"}}, {"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn g-btn--primary", "type": "button", "@click": "resetAll"}`.
- 준비/이전 상태: 격리프로필합성자료만,삭제확인표시
- 입력: @click=resetAll / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=resetAll 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: clearAll→engine.dispose→account/패널/방문/선택초기화→boot
- 데이터·저장 시점: 모든STORES를각각별도거래로clear;현재가족만이아님.중간실패부분삭제가능·rollback없음·undo없음
- 실행 연결: WorldView.vue::resetAll, store.ts::clearAll, WorldView.vue::boot, WorldView.vue::say, WorldView.vue::openView, WorldView.vue::visitSelected, WorldView.vue::addRoom, WorldView.vue::onSpaceFade, WorldView.vue::closeView, WorldView.vue::openPanel, WorldView.vue::familyChanged, WorldView.vue::showTown, store.ts::saveRooms, WorldView.vue::reload (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 격리프로필합성자료만,삭제확인표시. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 격리모듈테스트에서 clearAll의두번째store거래abort→앞store는이미삭제됐을수있음. 실패토스트만,전체rollback/undo없음. 실제사용자자료로오류주입금지.
- 취소·ESC·포커스: 모든STORES를각각별도거래로clear;현재가족만이아님.중간실패부분삭제가능·rollback없음·undo없음 / 이 요소의 전환 후 상태: clearAll→engine.dispose→account/패널/방문/선택초기화→boot / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `settings` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=resetAll 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:532; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 격리프로필합성자료만,삭제확인표시 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-050 에 @click=resetAll 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: clearAll→engine.dispose→account/패널/방문/선택초기화→boot
4. 예상저장/불변필드: 모든STORES를각각별도거래로clear;현재가족만이아님.중간실패부분삭제가능·rollback없음·undo없음
5. 취소·복귀검사: 모든STORES를각각별도거래로clear;현재가족만이아님.중간실패부분삭제가능·rollback없음·undo없음 / 이 요소의 전환 후 상태: clearAll→engine.dispose→account/패널/방문/선택초기화→boot / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: store.ts::clearAll를 격리 mock에서 해당 요소 입력 직후 1회 reject/abort. 입력前후 필드와 원본 해시, 오류문구를 함께 수집. 격리모듈테스트에서 clearAll의두번째store거래abort→앞store는이미삭제됐을수있음. 실패토스트만,전체rollback/undo없음. 실제사용자자료로오류주입금지.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-051 · UI-141 · 그만두기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `그만두기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'settings'"}}, {"tag": "template", "conditions": {"v-else": true}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "confirmReset = false"}`.
- 준비/이전 상태: 설정삭제확인표시
- 입력: @click=confirmReset = false / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=confirmReset = false 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: confirmReset=false→확인닫고설정유지
- 데이터·저장 시점: 전체DB불변,clearAll미호출
- 실행 연결: inline 바인딩 및 부모 수신 참조 (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 설정삭제확인표시. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 전체DB불변,clearAll미호출; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 전체DB불변,clearAll미호출 / 이 요소의 전환 후 상태: confirmReset=false→확인닫고설정유지 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `settings` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=confirmReset = false 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:533; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 설정삭제확인표시 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-051 에 @click=confirmReset = false 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: confirmReset=false→확인닫고설정유지
4. 예상저장/불변필드: 전체DB불변,clearAll미호출
5. 취소·복귀검사: 전체DB불변,clearAll미호출 / 이 요소의 전환 후 상태: confirmReset=false→확인닫고설정유지 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=confirmReset = false의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

### WorldView-052 · UI-142 · 닫기

- 상태: 문서 보완 / 제품 코드 변경 없음; 현행 소스 바인딩 확인; 모든 성공·실패 경로 실기 검증 미실시
- 위치/접근성: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 이름 근거 `닫기`.
- 표시/활성: 조상조건 `[{"tag": "template", "conditions": {"v-else": true}}, {"tag": "div", "conditions": {"v-if": "panel === 'settings'"}}]`; 자체속성 `{"class": "g-btn", "type": "button", "@click": "closePanel"}`.
- 준비/이전 상태: 설정패널,이름초안변경
- 입력: @click=closePanel / 키보드: 포커스된 native button의 Enter/Space로 click. 별도 전역 단축키는 action 증거에 명시된 경우만. / 터치: 탭으로 @click=closePanel 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만.
- 실행 후 UI·카메라·씬: closePanel→confirmReset=false·패널닫힘
- 데이터·저장 시점: 미저장childName/age는DB에쓰지않음. 이미진행중saveChild/clearAll취소안됨
- 실행 연결: WorldView.vue::closePanel, WorldView.vue::closeView (전체 함수 근거는 JSON implementationEvidence. 정적 참조 집합은 단일 실행 순서가 아니다).
- 부모 수신: `[]`
- 로딩/빈상태: 해당요소disabled/상위fieldset 조건과 아래 handler의 busy/step 대입을 그대로 적용. 없는 로딩 UI는 추가 구현된 것으로 취급하지 않음. 준비조건: 설정패널,이름초안변경. 대상이없을때의조건은 conditions 및 handler guard. 전용빈화면이없으면없음으로기록.
- 실패/재시도: 이 요소의 직접 경로에 전용 오류 UI/복구를 확인하지 못함. 미저장childName/age는DB에쓰지않음. 이미진행중saveChild/clearAll취소안됨; 오류 안내나 rollback이 구현됐다고 가정하지 않는다.
- 취소·ESC·포커스: 미저장childName/age는DB에쓰지않음. 이미진행중saveChild/clearAll취소안됨 / 이 요소의 전환 후 상태: closePanel→confirmReset=false·패널닫힘 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음. 공통 `settings` 및 `focus` 참조.
- PC/모바일: HUD·명패·패널의 source 조상과조건참조.600px이하더보기,가까이보기700px이하1열. coarse는뷰포트폭이아닌pointer능력으로분기. 탭으로 @click=closePanel 실행. 드래그/핀치 대체동작은 이 요소에 구현된 pointer 이벤트가 있을 때만. 실제 휴대폰 미검증.
- 코드근거: WorldView.vue:536; 연결 함수 위치와 전문은 JSON implementationEvidence 참조.
- 검증상태: **미실행 명세**. 기존 시나리오 일부 통과가 이 요소의 성공/실패/취소 전체 검증을 뜻하지 않는다.

**검증 절차와 예상 결과**

1. 설정패널,이름초안변경 상태와DB스냅샷·포커스요소를기록한다.
2. 대상 WorldView-052 에 @click=closePanel 를 일으키는 native 입력을1회실행한다.
3. 예상 UI/씬: closePanel→confirmReset=false·패널닫힘
4. 예상저장/불변필드: 미저장childName/age는DB에쓰지않음. 이미진행중saveChild/clearAll취소안됨
5. 취소·복귀검사: 미저장childName/age는DB에쓰지않음. 이미진행중saveChild/clearAll취소안됨 / 이 요소의 전환 후 상태: closePanel→confirmReset=false·패널닫힘 / ESC·패널닫기는 공통 settings 규약. 내부 전환 직후 자동 focus 이동은 별도 코드가 없으면 없음.
6. 실패/경계검사: DB/network 실패 주입 대상 없는 UI 상태 전환. @click=closePanel의 경계(빈목록·비활성·없는대상)를 격리 fixture로 만들고 아래 예상 결과의 guard/무동작을 확인. 함수가예외를전파하면전용복구UI없음으로기록.

증거: 입력전후 UI, 해당필드 DB/재진입값, 보존대상 원본해시, 오류주입 결과, activeElement와 월드위치. JSON에는 handler 전문·저장/실패 함수 위치를 포함한다.

## 142개 밖의 직접 조작 표면

이전142개집계는 button/input/select/textarea만 포함한다. 이를 전체조작전부라고표현하면안된다. 다음표면은별도로추적한다.

|표면|현행입력·결과|저장/취소·한계|
|---|---|---|
|WorldView 조이스틱 div|pointerdown capture→joyMove 정규화→setJoystick;pointerup/cancel→0|일시이동. 키보드대체WASD/방향키는engine. 조이스틱자체키보드handler없음|
|WorldPlay canvas|pointerdown start획→pointermove좌표→pointerup/cancel end→persistDraft|640×480좌표, touch-action:none. 핀치확대없음. 키보드로동일획그리기기능없음|
|WorldAvatar jointCanvas|자식점startJoint에서capture,부모pointermove moveJoint,up/cancel editing=false|007방향키대체;cancel은좌표undo아님|
|3D renderer canvas|바닥클릭경로이동/작품클릭선택,드래그시점,휠/핀치거리,키보드IJKL·+/−·R·E|패널열면setInputPaused. 화면별세부입력은engine.ts 근거;이번재시험없음|

## 보완 통계

```json
{
  "records": 142,
  "legacyIdMappings": 142,
  "authoredBeforeAfter": 142,
  "distinctExpectedResults": 142,
  "distinctValidationSequences": 142,
  "formSubmitResolved": 1,
  "elementsWithParentEmitTrace": 42,
  "modelsWithExplicitCommitOrWatcher": 16,
  "elementsWithStaticPersistenceReferences": 46,
  "newBrowserTests": 0,
  "all142RuntimePass": false,
  "productChangesThisRevision": 0
}
```

완성 주장 범위: 142개 ID 대응·요소별 상태/데이터 서술·검증 명세를 작성하고 정적 연결을 보완했다. 실기142개 통과, 접근성 완성, 실패복구 구현완료, 실제휴대폰검증을 주장하지 않는다. 남은 상세 위험은 각 항목과 JSON failureEvidence를 확인한다.
