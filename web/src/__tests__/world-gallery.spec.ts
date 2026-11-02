// #40 시험: 3D 화면 전시 목록(마스터플랜 3-3) — 승인 뒤에만 컷아웃, 파일은 한 번만, 만료 주소, 지워진 작품, 목록 실패.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/world/store', async (real) => ({
  ...(await real<typeof import('@/app/world/store')>()),
  processImage: vi.fn(async (b: Blob) => ({ display: b, cutout: null, maskOk: false, previewUrl: '' })),
  getRooms: vi.fn(async () => [4]),
  saveRooms: vi.fn(async () => undefined),
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });
const item = (id: string, extra: object = {}) => ({ id, kind: 'frame', primaryUrl: null, auxUrl: null, photoUrl: `/v1/files/${id}`, originalUrl: `/v1/files/${id}`, making: false, title: `제목 ${id}`, madeOn: '2026-11-02', ageAtMaking: 6, childWords: null, ...extra });

/** children: 아이별 작품. files: 파일 응답을 바꾸고 싶을 때. 받은 주소를 모두 남긴다 */
function server(children: Record<string, object[]>, files: (url: string) => Response = () => new Response('img', { headers: { 'content-type': 'image/png' } })) {
  const calls: string[] = [];
  const state = { children, down: false as boolean | number };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    calls.push(url);
    if (state.down === true) throw new TypeError('Failed to fetch');
    if (state.down) return json(state.down, { type: 'x', title: 't', status: state.down, code: 'unauthorized', reason: 'login_required', gate: 'G0' });
    if (url === '/v1/children') return json(200, Object.keys(state.children).map((id) => ({ id, alias: id })));
    if (url.startsWith('/v1/gallery')) {
      const id = new URL(url, 'http://x').searchParams.get('child')!;
      return json(200, { childId: id, groups: [{ ageAtMaking: 6, items: state.children[id] ?? [] }] });
    }
    if (url.startsWith('/v1/files/')) return files(url);
    throw new Error(`예상 못 한 요청 ${url}`);
  }));
  return { calls, state, fileCalls: () => calls.filter((u) => u.startsWith('/v1/files/')), reads: () => calls.filter((u) => u.startsWith('/v1/gallery')).length };
}
/** 전시 캐시는 모듈에 있으므로 시험마다 새로 불러온다 */
async function load() {
  vi.resetModules();
  return { g: await import('@/app/world/server/gallery'), store: await import('@/app/world/store') };
}
const detail = (id: string, extra: object) => ({ id, exhibited: true, hungResultKind: 'frame', stages: [], ...extra }) as never;

afterEach(() => { vi.unstubAllGlobals(); });
beforeEach(() => { vi.clearAllMocks(); });

describe('승인 전과 뒤', () => {
  it('액자로 걸린 작품은 컷아웃을 받지 않고, 정보를 서버 값으로 채운다', async () => {
    const s = server({ c1: [item('a1', { making: true, childWords: '해', ageAtMaking: 6 })] });
    const { g } = await load();
    const [a] = await g.galleryWorks(null);
    expect(a).toMatchObject({ id: 'a1', no: 1, title: '제목 a1', kind: 'making', age: 6, madeOn: '2026-11-02', words: '해', cutout: null, sample: false });
    expect(a!.cutoutState).toBeUndefined();
    expect(s.fileCalls()).toEqual(['/v1/files/a1']);
  });

  it('승인되어 부조가 걸리면 컷아웃으로 바꾸되, 사진은 다시 받지 않는다', async () => {
    const s = server({ c1: [item('a1')] });
    const { g } = await load();
    await g.galleryWorks(null);
    s.state.children = { c1: [item('a1', { kind: 'relief', primaryUrl: '/v1/files/depth', auxUrl: '/v1/files/cut' })] };
    const [a] = await g.galleryWorks(null);
    expect(a!.cutout?.size).toBeGreaterThan(0);
    expect(a!.cutoutState).toBe('done');
    expect(s.fileCalls()).toEqual(['/v1/files/a1', '/v1/files/cut']); // 부조 파일(primaryUrl)은 3D 화면이 쓰지 않는다
    await g.galleryWorks(null);
    expect(s.fileCalls()).toHaveLength(2); // 결과가 그대로면 다시 받지 않는다
  });

  it('부조가 아니면 aux가 와도 받지 않고 사진으로 둔다', async () => {
    const s = server({ c1: [item('a1', { kind: 'animated', primaryUrl: '/v1/files/mp4', auxUrl: '/v1/files/cut' })] });
    const { g } = await load();
    const [a] = await g.galleryWorks(null);
    expect(a!.cutout).toBeNull();
    expect(s.fileCalls()).toEqual(['/v1/files/a1']);
  });
});

describe('걸린 결과가 바뀌었는지(isStale)', () => {
  it('승인 전 결과는 다시 읽지 않고, 부조가 걸리면 다시 읽는다', async () => {
    server({ c1: [item('a1')] });
    const { g } = await load();
    await g.galleryWorks(null);
    expect(g.isStale(detail('a1', { hungResultKind: 'frame', cutoutUrl: '/v1/files/cut', state: 'awaiting_review', result: { kind: 'relief' } }))).toBe(false);
    expect(g.isStale(detail('a1', { hungResultKind: 'relief' }))).toBe(true);
    expect(g.isStale(detail('a1', { hungResultKind: null }))).toBe(false);
  });
  it('조각이 액자로 내려오는 경우는 끝없이 다시 읽지 않고, 전시 전 작품은 보지 않는다', async () => {
    server({ c1: [item('a1')] });
    const { g } = await load();
    await g.galleryWorks(null);
    expect(g.isStale(detail('a1', { hungResultKind: 'sculpture' }))).toBe(false);
    expect(g.isStale(detail('a2', { exhibited: false }))).toBe(false);
    expect(g.isStale(detail('a2', {}))).toBe(true);
  });
});

describe('목록', () => {
  it('아이를 고르지 않으면 가족의 모든 아이를, 고르면 그 아이만 읽는다', async () => {
    const s = server({ c1: [item('a1')], c2: [item('a2')] });
    const { g } = await load();
    expect((await g.galleryWorks(null)).map((a) => [a.id, a.no])).toEqual([['a1', 1], ['a2', 2]]);
    expect((await g.galleryWorks('c2')).map((a) => [a.id, a.no])).toEqual([['a2', 1]]);
    expect(s.calls.filter((u) => u === '/v1/children')).toHaveLength(1);
  });

  it('지워진 작품은 목록에서 사라지고, 나이 전시실을 만든다', async () => {
    const s = server({ c1: [item('a1'), item('a2', { ageAtMaking: null })] });
    const { g, store } = await load();
    await g.galleryWorks(null);
    expect(store.saveRooms).toHaveBeenCalledWith([4, 6, store.UNSORTED_AGE]);
    s.state.children = { c1: [item('a2', { ageAtMaking: null })] };
    expect((await g.galleryWorks(null)).map((a) => a.id)).toEqual(['a2']);
    s.state.down = true; // 지운 작품은 목록을 못 읽을 때도 되살아나지 않는다
    expect((await g.galleryWorks(null)).map((a) => a.id)).toEqual(['a2']);
  });

  it('파일 주소가 만료되면 목록을 다시 읽어 새 주소로 받는다', async () => {
    let expired = true;
    const s = server({ c1: [item('a1', { photoUrl: '/v1/files/old' })] }, (u) => {
      if (u.endsWith('old') && expired) { expired = false; s.state.children = { c1: [item('a1', { photoUrl: '/v1/files/new' })] }; return new Response('', { status: 404 }); }
      return new Response('img', { headers: { 'content-type': 'image/png' } });
    });
    const { g } = await load();
    expect((await g.galleryWorks(null)).map((a) => a.id)).toEqual(['a1']);
    expect(s.reads()).toBe(2);
    expect(s.fileCalls()).toEqual(['/v1/files/old', '/v1/files/new']);
    expect(g.galleryFailure.value).toBeNull();
  });

  it('한 장을 받지 못해도 나머지는 걸고, 무한히 다시 읽지 않는다', async () => {
    const s = server({ c1: [item('a1'), item('bad')] }, (u) => (u.endsWith('bad') ? new Response('', { status: 404 }) : new Response('img')));
    const { g } = await load();
    expect((await g.galleryWorks(null)).map((a) => a.id)).toEqual(['a1']);
    expect(s.reads()).toBe(2);
    expect(g.galleryFailure.value).toBeNull();
  });
});

describe('실패', () => {
  it('목록을 못 읽으면 보던 작품을 두고 알리며, 돌아오면 안내가 사라진다. 기기 저장으로 바꾸지 않는다', async () => {
    const s = server({ c1: [item('a1')] });
    const { g, store } = await load();
    const listSpy = vi.spyOn(store, 'listArtworks');
    await g.galleryWorks(null);
    s.state.down = true;
    expect((await g.galleryWorks(null)).map((a) => a.id)).toEqual(['a1']);
    expect(g.galleryFailure.value).toEqual({ kind: 'offline' });
    s.state.down = false;
    await g.galleryWorks(null);
    expect(g.galleryFailure.value).toBeNull();
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('로그인이 풀리면 login으로 알린다', async () => {
    const s = server({ c1: [] });
    s.state.down = 401;
    const { g } = await load();
    await g.galleryWorks(null);
    expect(g.galleryFailure.value).toEqual({ kind: 'login' });
  });
});

describe('올린 직후와 로그아웃', () => {
  it('올린 사진을 걸어 두면 목록을 읽을 때 다시 받지 않는다', async () => {
    const s = server({ c1: [item('a1')] });
    const { g } = await load();
    expect(await g.hangUploaded(detail('a1', { childId: 'c1', photoUrl: '/v1/files/a1' }))).toBe(true);
    await g.galleryWorks(null);
    expect(s.fileCalls()).toEqual(['/v1/files/a1']);
  });
  it('받지 못한 사진은 false를 돌려준다(보관은 끝났으므로 실패로 치지 않는다)', async () => {
    server({ c1: [] }, () => new Response('', { status: 404 }));
    const { g } = await load();
    expect(await g.hangUploaded(detail('a1', { photoUrl: '/v1/files/a1' }))).toBe(false);
  });
  it('로그아웃하면 다른 가족의 작품이 남지 않는다', async () => {
    const s = server({ c1: [item('a1')] });
    const { g } = await load();
    await g.galleryWorks(null);
    g.clearGallery();
    s.state.down = true;
    expect(await g.galleryWorks(null)).toEqual([]);
  });
});

describe('다른 가족·다른 아이의 작품이 남지 않는다', () => {
  /** 파일 응답을 원하는 때까지 붙잡는다 */
  function held() {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => { release = r; });
    let started: () => void = () => undefined;
    const reached = new Promise<void>((r) => { started = r; });
    return { release, reached, respond: async () => { started(); await gate; return new Response('img'); } };
  }
  function holdFiles(s: ReturnType<typeof server>, h: ReturnType<typeof held>) {
    const f = vi.mocked(fetch).getMockImplementation()!;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith('/v1/files/')) { s.calls.push(url); return h.respond(); }
      return f(url as never, init);
    }));
  }

  it('로그아웃 전에 시작한 목록 읽기가 늦게 끝나도 옛 가족 작품을 넣지 않는다', async () => {
    const s = server({ c1: [item('family-a')] });
    const h = held();
    holdFiles(s, h);
    const { g, store } = await load();
    const reading = g.galleryWorks(null);
    await h.reached;
    g.clearGallery();
    h.release();
    expect(await reading).toEqual([]);
    expect(store.saveRooms).not.toHaveBeenCalled();
    server({ c1: [] }).state.down = true;
    expect(await g.galleryWorks(null)).toEqual([]);
  });

  it('로그아웃 전에 시작한 올리기 걸기가 늦게 끝나도 넣지 않는다', async () => {
    const s = server({ c1: [] });
    const h = held();
    holdFiles(s, h);
    const { g } = await load();
    const hanging = g.hangUploaded(detail('family-a', { childId: 'c1', photoUrl: '/v1/files/family-a' }));
    await h.reached;
    g.clearGallery();
    h.release();
    expect(await hanging).toBe(false);
    server({ c1: [] }).state.down = true;
    expect(await g.galleryWorks(null)).toEqual([]);
  });

  it('로그아웃 전에 시작한 읽기가 늦게 실패해도 안내를 띄우지 않는다', async () => {
    let fail: (e: Error) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((_, rej) => { fail = rej; })));
    const { g } = await load();
    const reading = g.galleryWorks(null);
    g.clearGallery();
    fail(new TypeError('x'));
    expect(await reading).toEqual([]);
    expect(g.galleryFailure.value).toBeNull();
  });

  it.each(['getRooms', 'saveRooms'] as const)('%s를 기다리는 중에 로그아웃하면 옛 작품을 돌려주지 않고 방도 저장하지 않는다', async (at) => {
    server({ c1: [item('family-a')] });
    const { g, store } = await load();
    let release: () => void = () => undefined;
    let reached: () => void = () => undefined;
    const arrived = new Promise<void>((r) => { reached = r; });
    const hold = new Promise<void>((r) => { release = r; });
    if (at === 'getRooms') vi.mocked(store.getRooms).mockImplementation(async () => { reached(); await hold; return [4]; });
    else vi.mocked(store.saveRooms).mockImplementation(async () => { reached(); await hold; });
    const reading = g.galleryWorks(null);
    await arrived;
    g.clearGallery();
    release();
    expect(await reading).toEqual([]);
    expect(store.saveRooms).toHaveBeenCalledTimes(at === 'getRooms' ? 0 : 1);
    expect(g.galleryFailure.value).toBeNull();
  });

  it('방을 저장하지 못해도 전시는 그대로이고 연결 실패로 알리지 않는다', async () => {
    server({ c1: [item('a1')] });
    const { g, store } = await load();
    vi.mocked(store.saveRooms).mockRejectedValue(new Error('quota'));
    expect((await g.galleryWorks(null)).map((a) => a.id)).toEqual(['a1']);
    expect(g.galleryFailure.value).toBeNull();
  });

  it('다른 아이의 목록을 못 읽으면 이전 아이의 작품을 돌려주지 않는다', async () => {
    const s = server({ a: [item('child-a')], b: [item('child-b')] });
    const { g } = await load();
    expect((await g.galleryWorks('a')).map((x) => x.id)).toEqual(['child-a']);
    s.state.down = true;
    expect(await g.galleryWorks('b')).toEqual([]);
    expect(g.galleryFailure.value).toEqual({ kind: 'offline' });
    expect((await g.galleryWorks('a')).map((x) => x.id)).toEqual(['child-a']); // 같은 아이면 보던 작품을 둔다
  });

  it('올린 직후 목록을 못 읽어도 그 아이의 새 작품은 보인다', async () => {
    const s = server({ a: [item('child-a')] });
    const { g } = await load();
    await g.galleryWorks('a');
    await g.hangUploaded(detail('new', { childId: 'a', photoUrl: '/v1/files/new' }));
    s.state.down = true;
    expect((await g.galleryWorks('a')).map((x) => x.id)).toEqual(['child-a', 'new']);
    expect(await g.galleryWorks('b')).toEqual([]);
  });
});

describe('새로 고침 뒤 이어 묻기', () => {
  it('진행 중인 단계가 있는 작품만 고르고, 못 읽으면 빈 목록이다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, [{ id: 'a1', currentStage: 'split' }, { id: 'a2', currentStage: null }])));
    const { g } = await load();
    expect(await g.movingIds()).toEqual(['a1']);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('x'); }));
    expect(await g.movingIds()).toEqual([]);
  });
});
