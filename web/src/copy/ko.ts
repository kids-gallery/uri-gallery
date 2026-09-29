// 화면 문구 사전(T035, U10, R-20). 정본은 docs/C_화면문구.md — 문구를 바꿀 때는 그 문서 → SD_02 → 이 파일 순서로 고친다(D22 ⑦).
// [추론] 표시 문구는 문서와 같은 검토 대상이다.

/** 차단 블록 변형(SD_02 C2 · §17). */
export type BlockVariant = 'block' | 'hold' | 'final';

/** 오류 사유 → 차단 블록 문구(docs/C_화면문구.md §3). */
export interface ProblemCopy {
  variant: BlockVariant;
  /** 블록 제목 옆 요약 */
  summary: string;
  /** 사유 */
  reason: string;
  /** 해제 주체 */
  releaser: string;
  /** 해제 주체가 지금 사용자면 true — 해제 버튼을 준다(§16 규칙 ③) */
  self: boolean;
  /** 다음 행동(버튼 라벨 또는 안내) */
  actions: string[];
}

const SELF = '보호자 - 지금 이 화면';

export const ko = {
  state: {
    received: '접수됨',
    judging: '판정 중',
    awaiting_confirm: '확정 대기',
    processing: '처리 중',
    processing_queued: '처리 중 - 순서를 기다리는 중',
    retrying: '다시 시도 중',
    awaiting_review: '확인 대기',
    approved: '승인됨',
    exhibited: '전시 중',
    not_delivered: '처리하지 못함',
    deleting: '삭제 중',
  },
  stage: {
    queued: '대기',
    running: '진행 중',
    done: '완료',
    retry_wait: '다시 시도 중',
    failed: '처리하지 못함',
    cancelled: '취소',
  },
  rail: {
    leaveOk: '화면을 닫아도 계속돼요',
    showBlock: '막힌 자리 보기',
  },
  model: {
    ready: '준비됨',
    not_loaded: '미준비',
    loading: '불러오는 중',
    loadingSlow: '예상보다 오래 걸려요',
    failed: '적재 실패 · 60초마다 다시 시도해요',
    cold: '내려감 짐작 · 첫 요청 때 올라가요',
    inactive_license: '비활성 · 라이선스 확인 전',
    inactive_tier: '비활성 · P0.5 예정',
    cpu: 'CPU 실행',
    hidden: '비노출 · P1',
    unknown: '확인 불가',
  },
  wait: {
    model: '그림을 볼 준비를 하고 있어요. 조금만 기다려 주세요',
    modelEta: (s: number) => `약 ${s}초`,
  },
  fail: {
    file: '지금은 불러올 수 없어요',
    fileRetry: '다시 불러오기',
    opsStale: (at: string) => `갱신 불가 · 마지막 확인 ${at}`,
    draftRestored: '저장하지 못한 입력이 있어요',
    draftFill: '채워 넣기',
    draftDiscard: '버리기',
    generic: '잠시 뒤 다시 해 주세요', // [추론]
  },
  block: {
    blockTitle: '막힘',
    holdTitle: '기다리는 중',
    finalTitle: '되돌릴 수 없어요',
    reasonLabel: '사유',
    releaserLabel: '해제 주체',
    actionsLabel: '다음 행동',
    disabled: '(비활성)',
  },
  auth: {
    loginTitle: '로그인',
    opsLoginTitle: '팀원 로그인',
    email: '이메일',
    password: '비밀번호',
    passwordConfirm: '비밀번호 확인',
    login: '로그인',
    logout: '로그아웃',
    signup: '가입하기',
    forgot: '로그인 정보를 잊었어요',
    emailIsId: '이메일이 로그인 아이디예요 - 따로 아이디를 만들지 않아요',
    notCollected: '이름 - 전화번호 - 아이 정보는 받지 않아요',
    checkMailbox: '메일함을 확인해 주세요',
    checkMailboxBody: '확인 링크를 보냈어요. 이미 가입한 주소라면 안내 메일이 가요',
    verified: '이제 아이를 등록해 주세요',
    resetDone: '이메일과 새 비밀번호로 로그인해 주세요',
    // S0·S0b 화면(T052·T053, docs/C_화면문구.md §4 S0 — 2026-09-29 추가)
    signupTitle: '이메일로 가입',
    signupLead: '이메일과 비밀번호만 받아요',
    mailboxHint: '메일이 없으면 스팸함을 보거나 잠시 뒤 다시 받아 주세요',
    resendVerify: '확인 메일 다시 받기',
    haveAccount: '이미 가입하셨나요? 로그인',
    needEmail: '이메일을 적어 주세요', // [추론]
    badEmail: '이메일 형식을 확인해 주세요', // [추론]
    needPassword: '비밀번호를 적어 주세요', // [추론]
    shortPassword: '비밀번호는 8자 이상이에요', // [추론 — U19 예시값]
    mismatch: '비밀번호 확인이 같지 않아요', // [추론]
    verifying: '메일을 확인하고 있어요', // [추론]
    recoveryTitle: '로그인 정보 찾기',
    recoveryEmail: '가입한 이메일',
    recoverySend: '메일 받기',
    recoveryIdHint: '로그인 아이디는 가입한 이메일이에요',
    recoverySent: '가입된 이메일이면 메일을 보냈어요',
    recoverySentBody: '메일의 링크로 비밀번호를 새로 정해 주세요',
    recoveryOnce: '링크는 한 번만 - 정해진 시간 안에만 쓸 수 있어요',
    recoveryAgain: '메일 다시 받기',
    toLogin: '로그인으로',
    resetTitle: '새 비밀번호 정하기', // [추론]
    newPassword: '새 비밀번호',
    newPasswordConfirm: '새 비밀번호 확인',
    save: '저장',
  },
  /** 보호자 여정 레일(C1 여정 변형, SD_02 §2-3 · S0 와이어프레임). */
  journey: {
    signup: '가입', verify: '메일 확인', child: '아이 등록', upload: '작품 올리기',
    confirm: '확정', review: '결과 확인', story: '이야기', exhibit: '전시',
  },
  /** S1 아이 관리(T054, docs/C_화면문구.md §4 S1). */
  child: {
    title: '우리 아이',
    count: (n: number) => `우리 아이 ${n}명`,
    colAlias: '별칭', colArtworks: '작품 수', colActions: '조작',
    edit: '별칭 고치기', remove: '아이 삭제',
    addTitle: '아이 추가 - 별칭만 받아요',
    alias: '별칭',
    aliasHint: '실명 대신 가족이 부르는 별칭을 적어 주세요',
    remaining: (n: number) => `남은 글자 ${n}/20`,
    notCollected: '실명 - 생년월일 - 출생연도는 받지 않아요',
    save: '저장',
    toUpload: '작품 올리기로',
    needChild: '아이를 먼저 등록해 주세요',
    empty: '아직 등록한 아이가 없어요', // [추론]
    dupTitle: '같은 별칭',
    dup: (alias: string) => `같은 별칭 ${alias}이 이미 있어요. 그대로 둘까요, 고칠까요?`,
    dupSaved: '저장은 됐어요',
    dupWhy: '아이는 시스템이 따로 구분해요 - 이용자 중복은 이메일 계정으로 막아요',
    keep: '그대로 두기',
    cancel: '취소',
  },
  /** S2~S8 구현 문구(docs/C_화면문구.md §4 "S2~S8 구현 문구", 2026-09-29 이제민 — 신지현 위임). */
  kind: { animated: '움직임', relief: '2.5D 입체 부조', frame: '원본 액자', sculpture: '3D 조각' } as Record<string, string>,
  /** 낮춤 안내(C6)에 쓰는 결과 이름 — 앞 결과를 만들지 못해 뒤 결과로 바꿨다 */
  downgrade: {
    animated_to_relief: ['움직임', '입체 부조'], animated_to_frame: ['움직임', '원본 액자'], relief_to_frame: ['입체 부조', '원본 액자'],
    split_fail: ['입체 부조', '원본 액자'], sculpture_to_relief: ['3D 조각', '입체 부조'],
  } as Record<string, readonly [string, string]>,
  downgradeNote: (from: string, to: string) => `${from}를 만들지 못해 ${to}로 바꿨어요. 원본 액자로 걸 수도 있어요`,
  stageName: {
    split: '분리', judge: '판정', animate_render: '움직임 만들기', depth_relief: '깊이 부조', frame_compose: '액자', sculpture: '3D 조각', caption: '설명',
  } as Record<string, string>,
  stageStatus: { waiting: '대기', running: '진행 중', done: '완료', retrying: '다시 시도 중', failed: '처리하지 못함', cancelled: '취소' } as Record<string, string>,
  list: {
    colTitle: '작품', colChild: '아이', colState: '상태', colStage: '현재 단계',
    untitled: '제목 없음', // [추론]
    toConfirm: '고르러 가기', toReview: '결과 확인으로', toStory: '이야기 쓰기', toGallery: '전시 보기', // [추론] 이야기 쓰기·전시 보기
    empty: '아직 올린 작품이 없어요', // [추론]
    detailTitle: (t: string) => `${t} - 단계별 진행`,
    progress: '단계별 진행',
    colStep: '단계', colStepState: '상태', colNote: '안내',
    retried: (n: number) => `${n}번 다시 시도했어요`,
    backToList: '작품 목록',
  },
  notDelivered: {
    summary: '결과를 만들지 못했어요',
    reason: (what: string) => `서버 문제로 ${what}를 만들지 못했어요 - 낮춘 결과가 아니에요`,
    releaser: '보호자 - 원본 액자로 걸기 또는 다시 찍기',
  },
  upload: {
    whose: '누구의 작품인가요', child: '아이', photo: '사진',
    camera: '사진 찍기', album: '앨범에서 고르기', rule: 'JPEG - PNG - HEIC  한 장 20MB 이하',
    submit: '올리기',
    afterTitle: '올린 뒤', after1: '접수 완료되면 작품을 살펴보기 시작해요', after2: '기다리지 않고 화면을 닫아도 계속돼요',
    needChild: '아이를 골라 주세요', // [추론]
    needPhoto: '사진을 골라 주세요',
    tooBig: '20MB 이하 사진을 골라 주세요',
    sending: '올리는 중이에요', // [추론]
  },
  confirm: {
    cutout: '잘라 낸 작품', originalFallback: '원본 사진 - 액자 권장',
    suggestionTitle: '제안', judging: '살펴보는 중', noSuggestion: '제안을 준비하지 못했어요 - 직접 골라 주세요',
    suggestion: { animated: '움직일 수 있을 것 같아요', relief: '입체 부조로 만들어 볼까요?', frame: '원본 액자로 걸어 볼까요?' } as Record<string, string>, // U10 [추론 — UC 문구]
    howTitle: '어떻게 걸까요', submit: '확정하기', pickOne: '하나를 골라 주세요', later: '나중에 고르기',
    started: '만들기 시작했어요',
    g7Reason: '작품을 살펴보는 서버에 문제가 있었어요', g7Releaser: '보호자 - 셋 중 하나를 직접 고르기', g7Next: '아래에서 고르면 확정할 수 있어요',
  },
  review: {
    original: '원본', originalSub: '올린 그대로', result: (k: string) => `결과 - ${k}`,
    play: '재생', pause: '정지', showOriginal: '원본 보기', showResult: '결과 보기', // [추론]
    decision: { like: '좋아요', use_lower: '낮춘 결과로 걸기', frame: '액자로 걸기', retake: '다시 찍기' } as Record<string, string>,
    unavailable: { needs_result: '결과가 없어요', original_unreadable: '원본을 읽을 수 없어요', model_disabled: '지금은 이 방식을 쓸 수 없어요' } as Record<string, string>,
    retakeTitle: '다시 찍을까요?', // [추론]
    retakeBody: '이전 작품은 지워져요', cancel: '취소',
    afterApprove: '이야기를 채우면 전시돼요', afterLower: '입체 부조를 새로 만들어요',
  },
  story: {
    required: '필수', title: '제목', madeOn: '그린 날', age: '그때 나이',
    words: '아이의 한마디 - 선택 - 적은 그대로 보여요',
    save: '저장', saved: '저장했어요', // [추론] 저장했어요
    exhibited: '전시에 걸렸어요',
    exhibitTitle: '전시 조건', condReview: '결과 확인 완료', condStory: '제목 - 그린 날 - 나이 저장', condNote: '두 가지가 갖춰지면 전시에 걸려요',
    fixDate: '그린 날을 고쳐 주세요', ageRange: '나이는 0살부터 18살까지예요', titleLong: '제목은 100자까지예요', // [추론] 나이·제목
    mine: '내가 적은 내용', // [추론]
  },
  gallery: {
    child: '아이', search: '제목 - 그린 날 찾기', age: (n: number) => `${n}살`,
    words: '아이의 한마디', aiCaption: '작품 설명 - AI 작성', backside: '뒷면은 AI가 추정했어요',
    empty: '아직 걸린 작품이 없어요', noMatch: '찾는 작품이 없어요', // [추론] noMatch
    toList: '목록으로', toUpload: '작품 올리기',
  },
  /** S9 삭제(docs/C_화면문구.md §4 "S9 구현 문구", T101). */
  del: {
    artwork: '작품 삭제', child: '아이 삭제',
    title: '되돌릴 수 없어요 - 지워지는 것',
    artworkItems: ['원본 사진 - 잘라 낸 그림 - 깊이 정보 - 결과물', '이야기 - 작품 설명 - 임시 파일'],
    childItems: (alias: string, n: number) => `${alias}과 작품 ${n}개가 모두 지워져요`, // [추론]
    keeps: '통계용 숫자만 남고 누구의 작품인지는 남지 않아요',
    confirm: '삭제', cancel: '취소',
    progress: { accepted: '접수했어요', waiting_stop: '만들던 작업이 멈추기를 기다리는 중이에요', deleting_files: '파일을 지우는 중이에요', done: '삭제했어요' } as Record<string, string>,
    noWait: '기다리지 않아도 돼요', toList: '목록으로',
    locked: '삭제 중 - 이 작품의 모든 조작이 잠겼어요',
  },
  /** S10·S11 운영(docs/C_화면문구.md §4 "S10~S11 구현 문구", 2026-09-29 이제민). 비율은 소수 둘째 자리(퍼센트 기호 없음). */
  ops: {
    alive: '생존', aliveOk: '응답함', aliveNo: '응답 없음', // [추론] 응답 없음
    ready: '준비', readyAll: '준비됨', readySome: '일부 모델 미준비', readyNo: '준비 안 됨', // [추론] 준비됨·준비 안 됨
    period: '기간', periods: { d7: '최근 7일', d30: '최근 30일', all: '전체' } as Record<string, string>, // [추론] 30일·전체
    readyTitle: '준비 - 모델별', colModel: '모델', colGroup: '서빙군', colState: '상태', colImpact: '영향',
    group: { cpu_vision: 'CPU 비전', gpu: 'GPU', llm: 'LLM', external: '외부' } as Record<string, string>,
    shortName: { M1: 'M1 분리', M2: 'M2 판정', M3: 'M3 움직임', M5: 'M5 깊이', M6: 'M6 설명', M7: 'M7 3D' } as Record<string, string>,
    longName: { M4: 'M4 관절 기하 규칙', M1: 'M1 BiRefNet', M2: 'M2 OpenCLIP', M3: 'M3 Animated Drawings', M5: 'M5 Depth Anything', M6: 'M6 Qwen3-4B', M7: 'M7 TripoSR' } as Record<string, string>,
    impact: {
      M1: '잘라 내기 없이 원본으로', M2: '제안 없이 확정', M3: '움직임 - 액자 경로는 동작', M5: '입체 부조 - 액자 경로는 동작',
      M6: '설명 - 기본 문장·직접 쓰기', M7: '3D 비노출', cpu: '처리 시간 증가',
    } as Record<string, string>, // [추론] M1·M5·M6·M7
    metricsTitle: '지표 - 정의와 검증 계획이며 실적 아님',
    firstApproval: '첫 결과 승인율', modifyRate: '판정 수정률', unreached: '결과 미도달 수 - 목표 0', delIncomplete: '삭제 미완료 수',
    captionFail: '설명 규칙 검사 실패율 - P0.5', na: '해당 없음',
    tabs: { models: '모델별', causes: '원인 5분류', unreached: '결과 미도달 추적' } as Record<string, string>,
    colVersion: '버전', colAttempts: '시도', colDowngrade: '낮춤률', colP95: 'p95', colRetry: '재시도율',
    colWaiting: '대기', colOldest: '가장 오래 기다림', colFunction: '기능', colCalls: '호출', colRejected: '한도 초과', // [추론] 가장 오래 기다림
    causes: { guardianChoice: '보호자 선택', modelDowngrade: '모델 낮춤', guardianSwitch: '보호자 전환', infraFailure: '인프라 실패', unreached: '결과 미도달' } as Record<string, string>, // [추론] 보호자 전환
    colJob: '단계 작업 번호', colModelVersion: '모델 버전', colErrorClass: '오류 분류',
    errorClass: { engine_down: '엔진 다운', timeout: '시간 초과', storage: '저장소', db: 'DB', model_not_ready: '모델 미준비' } as Record<string, string>, // [추론] 엔진 다운 외
    noFamilyPath: '운영 화면에는 가족 사진과 이야기로 가는 경로가 없어요',
    // S11
    colActive: '활성', colRollback: '롤백 후보', colCandidate: '후보', colLicense: '라이선스', colHash: '해시',
    licenseOk: '확인', licenseNo: '확인 전', none: '없음',
    statusTitle: '모델 상태', colDevice: '장치', colLoad: '적재', colQueue: '대기', colAction: '동작',
    warmup: '지금 불러오기', lastLoad: (n: number) => `마지막 적재 ${n}초`,
    loading: (e: number, r: number | null) => (r != null ? `${e}초 - 남은 약 ${r}초` : `${e}초`),
    evalTitle: (m: string, v: string) => `${m} 후보 ${v} 평가`,
    evalProgress: (d: number, t: number, inc: number) => `진행 ${d} / ${t} 완료 - 평가 미완료 ${inc}`,
    evalNone: '평가 전이에요', // [추론]
    evalRequest: '평가 요청', report: '보고서 열기', judge: '판단 기록', verdict: { pass: '통과', hold: '보류' } as Record<string, string>, // [추론] 통과·보류
    rationale: '판단 근거', promote: '승격', rollback: '롤백', deactivate: '비활성화', reason: '사유', // [추론] 판단 근거·사유
    needRationale: '판단 근거를 적어 주세요', needReason: '사유를 적어 주세요', pickVerdict: '통과 또는 보류를 골라 주세요', // [추론]
    notEligible: '평가 미완료 또는 통과 판단 전이에요', // [추론]
    noRollback: '되돌릴 후보가 없어요',
    deactivateConfirm: '이 모델이 필요한 선택지가 보호자 화면에서 막혀요. 비활성화할까요?',
    readOnly: '읽기 전용이에요 - 조작은 평가 담당만', // [추론]
    colItem: '평가 항목', colStatus: '상태', colExpected: '기대', colActual: '결과', colDowngradeReason: '낮춤', colMisclass: '오인', colTime: '시간', // [추론]
  },
  shell: {
    appName: '우리 아이 미술관',
    opsName: '운영 화면',
    role: { operator: '서비스 운영자', evaluator: '평가 담당', integrator: '연동 개발' } as Record<string, string>,
    menu: { status: '상태-지표', models: '모델 평가', modelsRead: '모델 평가(읽기)', apiGuide: 'API활용' },
    appMenu: { artworks: '작품 목록', children: '우리 아이', family: '가족 보호자', gallery: '가족 전시', upload: '작품 올리기' },
  },
} as const;

/** gate·reason 사전(docs/C_화면문구.md §3). 키는 `G번호:reason`, gate 없는 사유는 `-:reason`. */
const P: Record<string, ProblemCopy> = {
  'G0:not_found': { variant: 'final', summary: '찾을 수 없어요', reason: '찾을 수 없어요', releaser: '없음', self: false, actions: ['목록으로'] },
  '-:not_found': { variant: 'final', summary: '찾을 수 없어요', reason: '찾을 수 없어요', releaser: '없음', self: false, actions: ['목록으로'] },
  'G0:bad_credentials': { variant: 'block', summary: '로그인하지 못했어요', reason: '이메일 또는 비밀번호가 맞지 않아요', releaser: SELF, self: true, actions: ['다시 입력하기', '로그인 정보를 잊었어요'] },
  '-:bad_credentials': { variant: 'block', summary: '로그인하지 못했어요', reason: '이메일 또는 비밀번호가 맞지 않아요', releaser: SELF, self: true, actions: ['다시 입력하기', '로그인 정보를 잊었어요'] },
  '-:email_unverified': { variant: 'block', summary: '메일 확인 전이에요', reason: '메일 확인을 아직 하지 않았어요', releaser: '보호자', self: true, actions: ['확인 메일 다시 받기'] }, // [추론]
  '-:login_attempts': { variant: 'hold', summary: '잠시 뒤 다시', reason: '로그인 시도가 많아요. 잠시 뒤 다시 해 주세요', releaser: '시스템 - 시간이 지나면 풀림', self: false, actions: ['로그인 정보를 잊었어요'] }, // [추론]
  'G1:role_missing': { variant: 'block', summary: '역할 없음', reason: '이 화면을 볼 역할이 없어요', releaser: '서비스 운영자 - 운영 CLI로 역할 부여', self: false, actions: ['다른 계정으로 로그인'] },
  'G1:bad_credentials': { variant: 'block', summary: '로그인하지 못했어요', reason: '이메일 또는 비밀번호가 맞지 않아요', releaser: '팀원 - 지금 이 화면', self: true, actions: ['다시 입력하기'] },
  'G3:child_not_saved': { variant: 'block', summary: '저장되지 않았어요', reason: '저장되지 않았어요', releaser: SELF, self: true, actions: ['다시 저장'] },
  'G3:decision_not_saved': { variant: 'block', summary: '반영되지 않았어요', reason: '반영되지 않았어요', releaser: SELF, self: true, actions: ['다시 저장'] },
  'G4:alias_blank': { variant: 'block', summary: '별칭 확인', reason: '별칭을 적어 주세요', releaser: SELF, self: true, actions: ['별칭 고치기'] }, // [추론]
  'G4:alias_too_long': { variant: 'block', summary: '별칭 확인', reason: '별칭은 20자까지예요', releaser: SELF, self: true, actions: ['별칭 고치기'] }, // [추론, D22]
  'G4:invalid_fields': { variant: 'block', summary: '별칭 확인', reason: '별칭만 적어 주세요', releaser: SELF, self: true, actions: ['별칭 고치기'] }, // [추론]
  'G5:format': { variant: 'block', summary: '올릴 수 없는 사진', reason: '이 사진은 올릴 수 없어요 - 형식을 확인해 주세요', releaser: SELF, self: true, actions: ['다른 사진 고르기'] }, // [추론 세부]
  'G5:unreadable': { variant: 'block', summary: '올릴 수 없는 사진', reason: '이 사진은 읽을 수 없어요', releaser: SELF, self: true, actions: ['다른 사진 고르기'] }, // [추론 세부]
  'G5:missing_photo': { variant: 'block', summary: '사진 없음', reason: '사진을 골라 주세요', releaser: SELF, self: true, actions: ['다른 사진 고르기'] }, // [추론 세부]
  'G5:over_20mb': { variant: 'block', summary: '용량 초과', reason: '사진이 20MB보다 커요', releaser: SELF, self: true, actions: ['다른 사진 고르기'] }, // [추론]
  'G6:intake_failed': { variant: 'block', summary: '접수되지 않았어요', reason: '접수되지 않았어요, 다시 올려 주세요', releaser: SELF, self: true, actions: ['다시 올리기'] },
  'G8:already_processing': { variant: 'block', summary: '확정할 수 없어요', reason: '이미 만들기 시작했어요', releaser: '보호자 - 결과 확인에서 결정', self: false, actions: ['결과 확인으로'] },
  'G8:deleting': { variant: 'final', summary: '삭제 중', reason: '삭제 중이에요', releaser: '없음', self: false, actions: ['목록으로'] },
  'G8:model_disabled': { variant: 'block', summary: '쓸 수 없는 방식', reason: '지금은 이 방식을 쓸 수 없어요', releaser: '평가 담당 팀원 - 새 버전 승격', self: false, actions: ['다른 방식 고르기'] },
  'G10:decision_not_allowed_in_state': { variant: 'block', summary: '결정할 수 없어요', reason: '지금은 이 결정을 할 수 없어요', releaser: '보호자', self: false, actions: ['목록으로'] }, // [추론]
  'G10:deleting': { variant: 'final', summary: '삭제 중', reason: '삭제 중인 작품이에요', releaser: '없음', self: false, actions: ['목록으로'] },
  'G11:made_on_in_future': { variant: 'block', summary: '저장하지 못했어요', reason: '그린 날은 오늘 이후일 수 없어요', releaser: SELF, self: true, actions: ['그린 날 고치기'] },
  'G11:title_blank': { variant: 'block', summary: '저장하지 못했어요', reason: '제목·그린 날·나이를 확인해 주세요', releaser: SELF, self: true, actions: ['값 고치기'] }, // [추론]
  'G11:invalid_fields': { variant: 'block', summary: '저장하지 못했어요', reason: '제목·그린 날·나이를 확인해 주세요', releaser: SELF, self: true, actions: ['값 고치기'] }, // [추론]
  'G11:story_conflict': { variant: 'block', summary: '먼저 고친 내용이 있어요', reason: '다른 보호자가 먼저 고쳤어요', releaser: SELF, self: true, actions: ['최신 내용 불러오기'] },
  'G11:artwork_deleting': { variant: 'final', summary: '삭제 중', reason: '삭제 중인 작품이에요', releaser: '없음', self: false, actions: ['목록으로'] },
  'G13:model_disabled': { variant: 'block', summary: 'AI 초안 준비 중', reason: 'AI 초안 기능은 아직 사용 조건 확인 중이에요', releaser: '평가 담당 팀원 - 조건 확인 뒤 활성화', self: false, actions: ['기본 문장으로 받기', '직접 쓰기'] },
  'G14:keywords_required': { variant: 'block', summary: '키워드 필요', reason: '키워드를 하나 이상 적거나 골라 주세요', releaser: SELF, self: true, actions: ['키워드 입력'] },
  'G14:tag_not_candidate': { variant: 'block', summary: '키워드 필요', reason: '키워드를 하나 이상 적거나 골라 주세요', releaser: SELF, self: true, actions: ['키워드 입력'] },
  '-:llm_unavailable': { variant: 'block', summary: 'AI 초안 없음', reason: 'AI 초안을 지금 만들 수 없어요', releaser: '시스템', self: false, actions: ['기본 문장으로 받기', '나중에', '직접 쓰기'] }, // [추론]
  'G17:sculpture_not_exposed': { variant: 'block', summary: '3D 준비 전', reason: '3D 조각은 아직 열리지 않았어요', releaser: '서비스 운영자 - 노출 설정(운영 CLI)', self: false, actions: ['다른 방식 고르기'] }, // [추론]
  'G18:deletion_not_saved': { variant: 'block', summary: '삭제되지 않았어요', reason: '삭제되지 않았어요 - 아무것도 바뀌지 않았어요', releaser: SELF, self: true, actions: ['다시 삭제하기'] },
  'G19:waiting_stop': { variant: 'hold', summary: '멈춤 대기', reason: '만들던 작업이 멈추기를 기다리는 중이에요', releaser: '시스템 - 멈춤 확인 또는 시간 상한', self: false, actions: ['목록으로'] },
  'G20:maker_or_fields': { variant: 'block', summary: '등록할 수 없어요', reason: '팀원이 만든 작품만 등록할 수 있어요', releaser: '평가 담당 - 지금 이 화면', self: true, actions: ['조건 채워 다시 등록'] },
  'G20:input_mismatch': { variant: 'block', summary: '등록할 수 없어요', reason: '팀원이 만든 작품만 등록할 수 있어요', releaser: '평가 담당 - 지금 이 화면', self: true, actions: ['조건 채워 다시 등록'] },
  'G21:hash_mismatch': { variant: 'block', summary: '평가를 시작할 수 없어요', reason: '평가를 시작할 수 없어요 - 해시 불일치', releaser: '평가 담당', self: true, actions: ['재설치·격리 조치 뒤 다시 요청'] }, // [추론 세부]
  'G21:no_eval_items': { variant: 'block', summary: '평가를 시작할 수 없어요', reason: '평가를 시작할 수 없어요 - 평가 항목 없음', releaser: '평가 담당', self: true, actions: ['평가 항목 등록'] }, // [추론 세부]
  'G21:rule_not_evaluated': { variant: 'block', summary: '평가를 시작할 수 없어요', reason: '평가를 시작할 수 없어요 - 규칙 미평가', releaser: '평가 담당', self: true, actions: ['다시 요청'] }, // [추론 세부]
  'G21:version_retired': { variant: 'block', summary: '평가를 시작할 수 없어요', reason: '평가를 시작할 수 없어요 - 폐기된 버전', releaser: '평가 담당', self: true, actions: ['다른 버전 고르기'] }, // [추론 세부]
  'G22:license_unconfirmed': { variant: 'block', summary: '승격할 수 없어요', reason: '승격할 수 없어요 - 라이선스 확인 전', releaser: '평가 담당', self: true, actions: ['라이선스 확인'] }, // [추론 세부]
  'G22:eval_incomplete': { variant: 'block', summary: '승격할 수 없어요', reason: '승격할 수 없어요 - 평가 미완료', releaser: '평가 담당', self: true, actions: ['미완료 재평가'] }, // [추론 세부]
  '-:no_rollback_candidate': { variant: 'final', summary: '되돌릴 후보 없음', reason: '되돌릴 후보가 없어요', releaser: '없음', self: false, actions: ['비활성화'] },
  'G23:not_eval_item': { variant: 'block', summary: '시험 호출할 수 없어요', reason: '평가 묶음 작품만 시험 호출할 수 있어요', releaser: '연동 개발', self: true, actions: ['평가 묶음에서 다시 고르기'] }, // [추론]
  'G27:token_invalid': { variant: 'block', summary: '링크 무효', reason: '링크를 쓸 수 없어요', releaser: '보호자', self: true, actions: ['메일 다시 받기'] },
  'G28:token_invalid': { variant: 'block', summary: '초대 링크 무효', reason: '초대 링크를 쓸 수 없어요. 초대한 분께 다시 요청해 주세요', releaser: '초대한 보호자', self: false, actions: [] },
  'G28:invite_email_mismatch': { variant: 'block', summary: '다른 이메일', reason: '초대받은 이메일로 로그인해 주세요', releaser: '초대받은 사람', self: true, actions: ['로그아웃하고 다시 로그인'] },
  'G28:already_in_family': { variant: 'block', summary: '이미 가족 공간이 있어요', reason: '이미 다른 가족 공간에 속해 있어요', releaser: '초대받은 사람', self: false, actions: ['다른 가족에서 나오기'] }, // [추론]
  'G28:co_guardian_full': { variant: 'block', summary: '두 명 찼어요', reason: '보호자는 두 명까지예요', releaser: '만든 보호자', self: false, actions: [] },
  'G29:co_guardian_full': { variant: 'block', summary: '두 명 찼어요', reason: '보호자는 두 명까지예요', releaser: '만든 보호자', self: false, actions: ['해제하면 다시 초대할 수 있어요'] },
  'G29:invite_owner_only': { variant: 'block', summary: '만든 보호자만', reason: '초대와 해제는 가족 공간을 만든 보호자만 할 수 있어요', releaser: '만든 보호자', self: false, actions: [] }, // [추론]
  'G29:not_family_owner': { variant: 'block', summary: '만든 보호자만', reason: '초대와 해제는 가족 공간을 만든 보호자만 할 수 있어요', releaser: '만든 보호자', self: false, actions: [] }, // [추론]
  'G29:family_owner_cannot_leave': { variant: 'final', summary: '나갈 수 없어요', reason: '가족 공간을 만든 보호자는 나갈 수 없어요', releaser: '없음(U20)', self: false, actions: [] }, // [추론]
};

const FALLBACK: ProblemCopy = { variant: 'block', summary: '저장되지 않았어요', reason: '저장되지 않았어요. 잠시 뒤 다시 해 주세요', releaser: '보호자', self: true, actions: ['다시 하기'] }; // [추론]

/** gate+reason 으로 문구를 찾는다. 순서: `G:reason` → `-:reason` → `-:code` → 기본(docs §3 마지막 줄). */
export function problemCopy(p: { gate?: string | null; reason?: string | null; code?: string | null }): ProblemCopy {
  const keys = [p.gate && p.reason ? `${p.gate}:${p.reason}` : '', p.reason ? `-:${p.reason}` : '', p.code ? `-:${p.code}` : ''];
  for (const k of keys) if (k && P[k]) return P[k];
  return FALLBACK;
}

/** 시험·문서 대조용. */
export const problemKeys = Object.keys(P);
