// 서버 판 친구(마스터플랜 3-3 #137): 마을 걸러내기, 초대 링크, 오류 이름, 방문 자료
import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/app/world/exhibit', () => ({ exhibitBlob: vi.fn(async () => new Blob(['plate'])), fillPaperBlob: vi.fn(async () => new Blob(['filled-paper'])) }));
vi.mock('@/app/world/store', async (real) => ({ ...(await real<typeof import('@/app/world/store')>()), processImage: vi.fn(async (b: Blob) => ({ display: b, cutout: null, maskOk: false, previewUrl: '' })) }));
import { ServerSocialStore } from '@/app/world/server/social';
import { SocialError, VISIT_PANELS } from '@/app/world/social';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });
const routes = (map: Record<string, () => Response>) => vi.stubGlobal('fetch', vi.fn(async (url: string) => {
  const key = Object.keys(map).find((k) => url.startsWith(k));
  return key ? map[key]!() : new Response('img', { headers: { 'content-type': 'image/png' } });
}));
const mine = { id: 'b_m', relation: 'mine', style: null, children: [{ id: '1', alias: '우리' }] };
const friend = { id: 'b_f', relation: 'neighbor', style: 'hanok_roof', children: [{ id: '9', alias: '친구아이' }] };
const stranger = { id: 'b_s', relation: 'stranger', style: null };
afterEach(() => { vi.unstubAllGlobals(); });

describe('서버 판 친구', () => {
  it('마을에는 내 건물과 친구 건물만 그린다', async () => {
    routes({ '/v1/town': () => json(200, { buildings: [mine, friend, stranger] }) });
    const list = await new ServerSocialStore().town();
    expect(list.map((b) => [b.id, b.child, b.mine])).toEqual([['b_m', '우리', true], ['b_f', '친구아이', false]]);
  });
  it('초대 링크는 3D 화면 주소로 바꾼다', async () => {
    routes({ '/v1/neighbors/invites': () => json(201, { id: '1', link: 'https://x.test/app/neighbor?token=abc', expiresAt: '2026-11-11T00:00:00Z' }) });
    const i = await new ServerSocialStore().createInvite();
    expect(i.link).toBe(`${location.origin}/app/world?invite=abc`);
  });
  it('서버 오류를 화면이 아는 이름으로 바꾼다', async () => {
    routes({ '/v1/neighbors/accept': () => json(409, { type: 'x', title: 't', status: 409, code: 'conflict', reason: 'own_family' }) });
    const e = await new ServerSocialStore().accept('', 'tok').catch((x) => x);
    expect(e).toBeInstanceOf(SocialError);
    expect((e as SocialError).reason).toBe('own_family');
  });
  it('수락하면 새 친구의 건물을 돌려주고, 이미 친구면 빈 값이다', async () => {
    let list: unknown[] = [];
    routes({
      '/v1/neighbors/accept': () => { list = [{ ...friend, online: true }]; return new Response(null, { status: 204 }); },
      '/v1/neighbors': () => json(200, list),
    });
    const s = new ServerSocialStore();
    expect(await s.accept('', 'tok')).toBe('b_f');
    expect(await s.accept('', 'tok')).toBe('');
    expect((await s.neighbors()).map((b) => b.online)).toEqual([true]);
  });
  it('친구 미술관에서는 움직여 보기를 열고, 내 설정을 바꾸는 창은 열지 않는다(#186)', () => {
    expect(VISIT_PANELS.has('motion')).toBe(true);
    for (const p of ['avatar', 'settings', 'upload', 'archive', 'social']) expect(VISIT_PANELS.has(p)).toBe(false);
  });

  it('방문: 친구 그림도 M2 태그로 움직이고 손 자리를 메꾼다. 만들기는 윤곽을 그대로 둔다(#186)', async () => {
    routes({
      '/v1/neighbors': () => json(200, [friend]),
      '/v1/visit/children/9/gallery': () => json(200, { child: {}, rooms: [{ room: 1, items: [
        { id: 'a', kind: 'relief', title: '물고기', primaryUrl: null, auxUrl: '/f/c', making: false, motionTags: ['바다', '물고기'] },
        { id: 'b', kind: 'relief', title: '배', primaryUrl: null, auxUrl: '/f/c2', making: true },
      ] }] }),
    });
    const { works } = await new ServerSocialStore().gallery('', 'b_f');
    expect(works.map((w) => w.behavior)).toEqual(['fish', 'etc']);
    expect(works[0]!.cutout!.size).toBe('filled-paper'.length);
    expect(works[1]!.cutout!.size).not.toBe('filled-paper'.length);
  });

  it('방문: 부조는 컷아웃과 전시용 판, 액자는 사진. 친구가 아니면 들어가지 않는다', async () => {
    routes({
      '/v1/neighbors': () => json(200, [friend]),
      '/v1/visit/children/9/gallery': () => json(200, { child: {}, rooms: [{ room: 1, items: [
        { id: 'a', kind: 'relief', title: '배', primaryUrl: '/f/d', auxUrl: '/f/c', making: true },
        { id: 'b', kind: 'frame', title: null, primaryUrl: '/f/p', auxUrl: null, making: false },
      ] }] }),
    });
    const s = new ServerSocialStore();
    const g = await s.gallery('', 'b_f');
    expect(g.rooms).toEqual([1]);
    expect(g.works.map((w) => [w.id, w.kind, !!w.cutout, !!w.depth])).toEqual([['a', 'making', true, true], ['b', 'drawing', false, false]]);
    await expect(s.gallery('', 'b_other')).rejects.toBeInstanceOf(SocialError);
  });
});
