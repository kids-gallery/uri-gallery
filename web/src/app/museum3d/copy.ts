// 아이 미술관(CSS 3D) 화면 문구(D40, SD_02 §17-13 B · C · F). 해요체 · 개발 용어 없음.
// ko.ts와 같은 규칙: '점수' · '확률' · '%' · '실패했' · '!'를 쓰지 않는다(museum3d.spec이 검사).
export const m3 = {
  title: (alias: string) => `${alias}의 미술관`,
  scene: (alias: string) => `${alias}의 미술관 — 1인칭 장면`,
  plaque: (alias: string) => `${alias}의 미술관`,
  untitled: '제목 없는 그림',
  artButton: (title: string) => `${title} — 가까이 가기`,

  // 방 이름 — 방문자는 번호만(§17-13 F)
  ageRoom: (age: number) => `${age}살 전시실`,
  noAgeRoom: '나이 미정 전시실',
  visitRoom: (n: number) => `전시실 ${n}`,
  mergedAges: (from: number, to: number) => `${from}~${to}살 전시실`,
  mergedMore: (label: string) => `${label} 외`,
  emptyRoom: '다음 전시실',
  lobby: '로비',
  hall: '가운데 홀', // 팀장 요구(2026-09-30): 방 버튼 줄과 같은 이름 — 설계서 §17-13 B는 "중앙 홀"
  roomCount: (label: string, n: number) => `${label} · ${n}점`,

  pedestalEmpty: '입체로 만들면 여기에 놓여요',
  plinthEmpty: '여기에 만들기 작품이 놓여요',
  nearOpen: '눌러서 크게 보기',

  exit: '밖으로',
  exitLabel: '밖으로 — 마을로 나가기',
  map: '안내도 크게 보기',
  mapTitle: '미술관 안내도',
  mapRooms: '전시실로 가기',
  mapNote: '점을 누르면 그 작품 앞으로 걸어가요. 전시실 이름을 눌러도 돼요.',
  mapHere: '지금 여기',
  roomBar: '전시실 바로 가기',
  mapTap: '안내도를 눌러 그곳으로 걸어가기',
  close: '닫기',

  keys: '끌어서 둘러보기 · 바닥을 두 번 눌러 걷기 · W A S D 걷기 · Shift 빨리',
  touchKeys: '끌어서 둘러보고, 바닥을 두 번 눌러 걸어가요',

  loading: '미술관 문을 여는 중이에요',
  empty: '아직 걸린 그림이 없어요. 그림을 올리면 여기에 걸려요.',
  emptyVisit: '아직 걸린 그림이 없어요',
  visitLocked: '이웃이 되면 들어갈 수 있어요',
  visitBadge: '이웃의 미술관',
  retry: '다시 열기',
  toTown: '마을로 가기',

  play: '움직여 보기',
  stop: '멈추기',
} as const;
