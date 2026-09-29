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
