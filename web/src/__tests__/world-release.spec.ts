// 3D미술관_재설계 §2-22 — 1차 출시 전 수정 묶음 중 단위 시험으로 고정할 수 있는 것.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKUP_NUDGE, backupDue, isIOS, needsTabGate, storageMode } from '@/app/world/deviceStorage';
import { EMPTY_USAGE, bump, dayNumber, normalizeUsage, visit } from '@/app/world/usage';
import { cardText } from '@/app/world/shareCard';
import { SUBJECTS } from '@/app/world/subjects';
import { cutoutQueue, cutoutTry, sha256, withCutout, withInfo, withRotation, type Artwork, type CutoutResult } from '@/app/world/store';
import { mount } from '@vue/test-utils';
import WorldStorageState from '@/app/world/WorldStorageState.vue';
import WorldPrivacy from '@/app/world/WorldPrivacy.vue';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
};

describe('홈 화면 앱 판정(§2-22 5)', () => {
  it('서버 판은 아이폰 탭에서도 저장 안내 없이 바로 올린다. 작품이 서버에 있어 7일 삭제 대상이 아니다', () => {
    expect(needsTabGate('ios-tab', true)).toBe(false);
    expect(needsTabGate('ios-tab', false)).toBe(true);
    expect(needsTabGate('browser', false)).toBe(false);
    expect(needsTabGate('home-app', false)).toBe(false);
  });
  it('iPhone 브라우저 탭만 7일 삭제 위험으로 본다', () => {
    expect(storageMode({ ua: UA.iphone, maxTouchPoints: 5, standalone: false })).toBe('ios-tab');
    expect(storageMode({ ua: UA.iphone, maxTouchPoints: 5, standalone: true })).toBe('home-app');
    expect(storageMode({ ua: UA.android, maxTouchPoints: 5, standalone: false })).toBe('browser');
    expect(storageMode({ ua: UA.mac, maxTouchPoints: 0, standalone: false })).toBe('browser');
  });
  it('Mac처럼 알리는 iPad는 터치 지점 수로 가른다', () => {
    expect(isIOS({ ua: UA.ipad, maxTouchPoints: 5, standalone: false })).toBe(true);
    expect(isIOS({ ua: UA.ipad, maxTouchPoints: 0, standalone: false })).toBe(false);
  });
});

describe('백업 권유 조건(§2-22 7)', () => {
  const DAY = 24 * 60 * 60 * 1000, now = Date.UTC(2026, 9, 28);
  const works = (n: number, from: number) => Array.from({ length: n }, (_, i) => from + i * 1000);
  it('작품이 없거나 모두 백업에 있으면 권하지 않는다', () => {
    expect(backupDue({}, [], now)).toBe(false);
    expect(backupDue({ lastAt: now }, works(12, now - 5 * DAY), now)).toBe(false);
  });
  it('백업에 없는 작품이 10점이면 바로, 9점이면 30일이 지나야 권한다', () => {
    expect(backupDue({}, works(BACKUP_NUDGE.works, now - DAY), now)).toBe(true);
    expect(backupDue({}, works(BACKUP_NUDGE.works - 1, now - DAY), now)).toBe(false);
    expect(backupDue({}, works(1, now - BACKUP_NUDGE.days * DAY), now)).toBe(true);
  });
  it('[나중에]를 누르면 그때부터 다시 센다', () => {
    const later = now - DAY;
    expect(backupDue({ laterAt: later }, works(12, now - 40 * DAY), now)).toBe(false);
    expect(backupDue({ laterAt: later }, [...works(12, now - 40 * DAY), ...works(10, later + 1)], now)).toBe(true);
    expect(backupDue({ laterAt: now - 31 * DAY }, works(3, now - 40 * DAY), now)).toBe(true);
  });
  it('마지막 백업 기록 뒤에 올린 작품만 백업에 없는 작품이다', () => {
    const last = now - 10 * DAY;
    expect(backupDue({ lastAt: last }, [...works(20, last - DAY), ...works(2, last + 1)], now)).toBe(false);
    expect(backupDue({ lastAt: last }, works(2, last + 1), last + 1 + BACKUP_NUDGE.days * DAY)).toBe(true); // 백업 뒤 2점, 30일 지남
  });
});

describe('사용 기록은 숫자만(§2-22 11)', () => {
  it('저장된 값에서 숫자 칸만 남기고, 지우면 0이 된다', () => {
    const read = normalizeUsage({ uploads: 3, plays: '7', shares: 1.6, days: -2, lastDay: 20261028, title: '호랑이', photo: new Blob(['x']) });
    expect(read).toEqual({ uploads: 3, plays: 0, shares: 1, days: 0, lastDay: 20261028 });
    expect(Object.values(read).every((v) => typeof v === 'number')).toBe(true);
    expect(normalizeUsage({ ...EMPTY_USAGE })).toEqual({ uploads: 0, plays: 0, shares: 0, days: 0, lastDay: 0 });
  });
  it('올린 수·움직인 수는 1씩, 들어온 날은 하루에 한 번만 오른다', () => {
    let u = bump(bump(EMPTY_USAGE, 'uploads'), 'plays');
    u = visit(visit(u, dayNumber('2026-10-28')), dayNumber('2026-10-28'));
    u = visit(u, dayNumber('2026-10-29'));
    expect(u).toEqual({ uploads: 1, plays: 1, shares: 0, days: 2, lastDay: 20261029 });
  });
});

describe('자랑하기 카드 글(§2-22 10)', () => {
  const work = { no: 3, title: '어흥 호랑이', kind: 'drawing' as const, subject: 'tiger', material: '', age: 5, madeOn: '2026-10-03', words: '' };
  it('이름·나이를 끄면 그 글자가 없다(기본값)', () => {
    const t = cardText(work, '하늘', { child: false, age: false });
    expect(JSON.stringify(t)).not.toContain('하늘');
    expect(JSON.stringify(t)).not.toContain('5세');
    expect(t).toEqual({ title: '어흥 호랑이', lines: ['2026년 10월'], brand: '우리 아이 미술관' });
  });
  it('고르면 넣고, 만든 날·나이가 없으면 지어 쓰지 않는다', () => {
    expect(cardText(work, '하늘', { child: true, age: true }).lines).toEqual(['하늘의 작품, 5세', '2026년 10월']);
    expect(cardText({ ...work, age: 0, madeOn: '' }, '하늘', { child: false, age: true }).lines).toEqual([]);
    expect(cardText({ ...work, title: '' }, '', { child: true, age: false }, 'example.org').title).toBe('호랑이 그림');
    expect(cardText(work, '', { child: false, age: false }, 'example.org').brand).toBe('우리 아이 미술관 · example.org');
  });
});

describe('올린 뒤 배경 지우기(§2-22 1~3)', () => {
  const original = new Blob(['원본 사진 바이트'], { type: 'image/jpeg' });
  const base: Artwork = { id: 'w1', no: 1, title: '', kind: 'drawing', subject: 'etc', material: '', age: 0, madeOn: '', words: '', original, display: new Blob(['화면용']), cutout: null, cutoutState: 'pending', sample: false, createdAt: 1, rotation: 0 };
  it('사본만 붙이고 원본·작품 ID는 그대로 둔다', async () => {
    const cut = new Blob(['배경 지운 사본'], { type: 'image/png' });
    const next = withCutout(base, 0, cut)!;
    expect(next.id).toBe(base.id);
    expect(next.original).toBe(original);
    expect(await sha256(next.original)).toBe(await sha256(original));
    expect(next).toMatchObject({ cutout: cut, cutoutState: 'done' });
  });
  it('배경을 못 찾으면 두께판(none), 처리 중 돌렸거나 이미 처리했으면 버린다', () => {
    expect(withCutout(base, 0, null)).toMatchObject({ cutout: null, cutoutState: 'none' });
    expect(withCutout({ ...base, rotation: 90 }, 0, new Blob(['x']))).toBeNull();
    expect(withCutout({ ...base, cutoutState: 'done' }, 0, new Blob(['x']))).toBeNull();
    expect(withCutout({ ...base, cutoutState: undefined }, 0, new Blob(['x']))).toBeNull(); // 값이 없는 기존 작품은 다시 처리하지 않는다(§2-18)
  });
});

describe('돌리기와 질문 저장이 서로 덮지 않는다(§2-22 검토 2)', () => {
  const original = new Blob(['원본'], { type: 'image/jpeg' });
  const base: Artwork = { id: 'w1', no: 1, title: '', kind: 'drawing', subject: 'etc', material: '', age: 0, madeOn: '', words: '', original, display: new Blob(['화면용']), cutout: new Blob(['사본']), cutoutState: 'done', sample: false, createdAt: 1, rotation: 0 };
  it('돌리기는 사본·처리 상태·각도만 바꾸고, 그 사이 고른 나이·주제·이야기를 남긴다', () => {
    const answered = { ...base, age: 5, subject: 'tiger', words: '어흥' }; // 돌리는 동안 저장된 지금 기록
    const turned = new Blob(['돌린 화면용']);
    const next = withRotation(answered, turned, 90);
    expect(next).toMatchObject({ age: 5, subject: 'tiger', words: '어흥', display: turned, cutout: null, cutoutState: 'pending', rotation: 90 });
    expect(next.original).toBe(original);
  });
  it('정보 저장은 정보 칸만 바꾸고, 그 사이 끝난 배경 지우기·돌리기를 남긴다', () => {
    const turned = { ...base, display: new Blob(['돌린 화면용']), cutout: null, cutoutState: 'pending' as const, rotation: 270 };
    const next = withInfo(turned, { title: '  호랑이 ', age: 5, madeOn: '', words: '', material: '', kind: 'drawing', subject: 'tiger' });
    expect(next).toMatchObject({ title: '호랑이', age: 5, subject: 'tiger', rotation: 270, cutoutState: 'pending', cutout: null });
    expect(next.display).toBe(turned.display);
  });
});

describe('배경 지우기 시도 횟수는 방향마다(§2-22 검토 8)', () => {
  it('같은 작품도 돌린 방향이 다르면 다른 열쇠, 각도가 없는 기존 작품은 0°', () => {
    expect(cutoutTry({ id: 'w1', rotation: 90 })).not.toBe(cutoutTry({ id: 'w1', rotation: 180 }));
    expect(cutoutTry({ id: 'w1' })).toBe(cutoutTry({ id: 'w1', rotation: 0 }));
    expect(cutoutTry({ id: 'w1', rotation: 90 })).not.toBe(cutoutTry({ id: 'w2', rotation: 90 }));
  });
});

describe('배경 지우기 차례(§2-22 검토 8)', () => {
  type W = { id: string; rotation: number; cutoutState: 'pending' | 'done' | 'none' };
  const run = async (list: W[], make: (id: string) => Promise<CutoutResult>, after: () => Promise<boolean> = async () => true) => {
    let calls = 0;
    await cutoutQueue({ pending: () => list.filter((a) => a.cutoutState === 'pending'), make: (id) => { calls += 1; return make(id); }, after, tries: 2 });
    return calls;
  };
  it('처리하는 동안 오가며 돌려도(↻↺↻↺) 처리 전으로 남지 않고 마지막 방향으로 처리한다', async () => {
    const x: W = { id: 'x', rotation: 0, cutoutState: 'pending' };
    const turns = [90, 0, 90, 0]; // 처리하는 동안 보호자가 돌린 방향
    const calls = await run([x], async () => { const r = turns.shift(); if (r !== undefined) { x.rotation = r; return 'moved'; } x.cutoutState = 'done'; return 'done'; });
    expect(x).toMatchObject({ cutoutState: 'done', rotation: 0 });
    expect(calls).toBe(5);
  });
  it('결과가 나지 않는 처리는 같은 작품·방향에서 두 번 뒤 멈춘다', async () => {
    const x: W = { id: 'x', rotation: 0, cutoutState: 'pending' };
    expect(await run([x], async () => 'skip')).toBe(2);
    expect(x.cutoutState).toBe('pending');
  });
  it('한 장씩 차례로 하고, after가 false면 멈추며, 처리 실패는 부른 쪽으로 던진다', async () => {
    const a: W = { id: 'a', rotation: 0, cutoutState: 'pending' }, b: W = { id: 'b', rotation: 0, cutoutState: 'pending' };
    const order: string[] = [];
    await run([a, b], async (id) => { order.push(id); (id === 'a' ? a : b).cutoutState = 'none'; return 'none'; });
    expect(order).toEqual(['a', 'b']);
    const c: W = { id: 'c', rotation: 0, cutoutState: 'pending' }, d: W = { id: 'd', rotation: 0, cutoutState: 'pending' };
    expect(await run([c, d], async (id) => { (id === 'c' ? c : d).cutoutState = 'done'; return 'done'; }, async () => false)).toBe(1);
    await expect(run([{ id: 'e', rotation: 0, cutoutState: 'pending' }], async () => { throw new Error('저장 실패'); })).rejects.toThrow('저장 실패');
  });
});

describe('저장 상태 묶음(§2-22 6·검토 4)', () => {
  it('유지 허용 여부 세 경우와 마지막 백업 날짜, Safari 탭 위험을 보인다', () => {
    const at = new Date(2026, 9, 28).getTime();
    expect(mount(WorldStorageState, { props: { persisted: true, lastBackup: at, mode: 'browser' } }).text()).toContain('지우지 않기로 했어요');
    expect(mount(WorldStorageState, { props: { persisted: false, lastBackup: null, mode: 'browser' } }).text()).toMatch(/지울 수 있어요.*아직 없어요/s);
    const tab = mount(WorldStorageState, { props: { persisted: null, lastBackup: at, mode: 'ios-tab' } }).text();
    expect(tab).toContain('7일 동안 열지 않으면');
    expect(tab).toContain('알려 주지 않아요');
    expect(tab).toContain(new Date(at).toLocaleDateString('ko-KR'));
  });
  it('개인정보·이용 안내는 같은 부품을 쓴다', () => {
    const w = mount(WorldPrivacy, { props: { persisted: false, lastBackup: null, mode: 'ios-tab' } });
    expect(w.findComponent(WorldStorageState).exists()).toBe(true);
  });
});

describe('학습 자료 출처 안내(마스터플랜 3-6)', () => {
  const link = () => mount(WorldPrivacy, { props: { persisted: false, lastBackup: null, mode: 'ios-tab' } }).find('a[href="/licenses/MODEL_DATA.txt"]');
  afterEach(() => { vi.unstubAllEnvs(); });

  it('기본 빌드는 자체 모델로 배운 기능이 없으므로 안내하지 않는다', () => {
    expect(link().exists()).toBe(false);
  });
  it('깊이를 켠 빌드는 출처를 안내한다', () => {
    vi.stubEnv('VITE_RELIEF_DEPTH', '1');
    expect(link().exists()).toBe(true);
  });
});

describe('주제 그림 단추(§2-22 4)', () => {
  it('모든 주제에 그림이 있고 이름이 겹치지 않는다', () => {
    expect(SUBJECTS.every((s) => s.icon.length > 0)).toBe(true);
    expect(new Set(SUBJECTS.map((s) => s.id)).size).toBe(SUBJECTS.length);
  });
});
