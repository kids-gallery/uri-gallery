// #31 시험: 3D 화면 사진 올리기(마스터플랜 3-3) — 요청 번호, 올리기 전 안내, 아이 고르기, 실패 뒤 다시 시도해도 작품 1건.
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/world/store', async (real) => ({
  ...(await real<typeof import('@/app/world/store')>()),
  processImage: vi.fn(async (b: Blob) => ({ display: b, cutout: null, maskOk: false, previewUrl: '' })),
  getRooms: vi.fn(async () => [4, 5]),
  saveRooms: vi.fn(async () => undefined),
}));

const PHOTO = () => new File(['jpeg-bytes'], 'a.jpg', { type: 'image/jpeg' });
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });
const problem = (status: number, code: string, reason: string, gate: string) => json(status, { type: 'x', title: 't', status, code, reason, gate });

/** 서버 흉내: 같은 Idempotency-Key면 기존 작품을 돌려준다. fail 큐의 응답을 먼저 소비한다 */
function fakeServer(children: { id: string; alias: string }[] = [{ id: 'c1', alias: '하나' }]) {
  const works = new Map<string, string>();
  const keys: string[] = [];
  const fail: (Response | Error)[] = [];
  const fetchStub = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/v1/children') return json(200, children);
    if (url === '/v1/artworks') {
      keys.push((init!.headers as Record<string, string>)['Idempotency-Key']!);
      const next = fail.shift();
      if (next instanceof Error) throw next;
      if (next) return next;
      const key = keys.at(-1)!;
      if (!works.has(key)) works.set(key, `a${works.size + 1}`);
      const id = works.get(key)!;
      return json(202, { id, childId: 'c1', state: 'exhibited', choices: [], stages: [], photoUrl: `/v1/files/${id}`, story: { title: '제목 없는 그림 1' } });
    }
    if (url.startsWith('/v1/gallery')) {
      const items = [...works.values()].map((id) => ({ id, kind: 'frame', photoUrl: `/v1/files/${id}`, originalUrl: `/v1/files/${id}`, title: '제목 없는 그림 1', madeOn: '2026-11-02', ageAtMaking: null, making: false }));
      return json(200, { childId: 'c1', groups: items.length ? [{ ageAtMaking: null, items }] : [] });
    }
    if (url.startsWith('/v1/files/')) return new Response('img', { headers: { 'content-type': 'image/jpeg' } });
    throw new Error(`예상 못 한 요청 ${url}`);
  });
  vi.stubGlobal('fetch', fetchStub);
  return { works, keys, fail, fetchStub };
}

/** SERVER_WORLD는 불러올 때 정해지므로 값을 넣고 새로 불러온다 */
async function load() {
  vi.stubEnv('VITE_WORLD_SERVER', '1');
  vi.resetModules();
  return {
    upload: await import('@/app/world/server/upload'),
    WorldUpload: (await import('@/app/world/WorldUpload.vue')).default,
  };
}

beforeEach(() => { vi.unstubAllEnvs(); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('요청 번호', () => {
  it('서버가 받는 UUID를, crypto.randomUUID가 없는 http 접속에서도 만든다', async () => {
    const { upload } = await load();
    const { getRandomValues } = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: getRandomValues.bind(globalThis.crypto) });
    const a = upload.newUploadKey(), b = upload.newUploadKey();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe('올리기 전 안내', () => {
  it('빈 파일·20MB 초과·다른 형식은 막고, JPEG·PNG·HEIC는 통과한다', async () => {
    const { upload } = await load();
    const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 + 1 });
    expect(upload.checkPhoto(new File([], 'empty.jpg', { type: 'image/jpeg' }))).toMatch('빈 파일');
    expect(upload.checkPhoto(big)).toMatch('20MB');
    expect(upload.checkPhoto(new File(['x'], 'a.gif', { type: 'image/gif' }))).toMatch('형식');
    expect(upload.checkPhoto(new File(['x'], 'a.txt', { type: 'text/plain' }))).toMatch('형식');
    for (const f of [PHOTO(), new File(['x'], 'b.png', { type: 'image/png' }), new File(['x'], 'c.HEIC', { type: '' })]) expect(upload.checkPhoto(f)).toBeNull();
  });
});

describe('어느 아이의 작품인가', () => {
  it('고른 아이가 먼저, 없으면 1명일 때만 그 아이, 그 밖에는 올리지 않는다', async () => {
    const { upload } = await load();
    const two = [{ id: 'c1', alias: '하나' }, { id: 'c2', alias: '둘' }];
    const childOf = (f: ReturnType<typeof fakeServer>) => (f.fetchStub.mock.calls.find((c) => c[0] === '/v1/artworks')?.[1]?.body as FormData | undefined)?.get('childId');

    let s = fakeServer(two);
    expect(await upload.sendPhoto(PHOTO(), 'k1')).toMatchObject({ ok: false, retryable: true, reason: expect.stringContaining('골라') });
    expect(s.keys).toEqual([]);

    s = fakeServer([]);
    expect(await upload.sendPhoto(PHOTO(), 'k2')).toMatchObject({ ok: false, reason: expect.stringContaining('등록') });
    expect(s.keys).toEqual([]);

    s = fakeServer(two);
    upload.selectedChild.value = 'c2';
    expect(await upload.sendPhoto(PHOTO(), 'k3')).toMatchObject({ ok: true });
    expect(childOf(s)).toBe('c2');
    upload.selectedChild.value = null;

    s = fakeServer([two[0]!]);
    expect(await upload.sendPhoto(PHOTO(), 'k4')).toMatchObject({ ok: true });
    expect(childOf(s)).toBe('c1');
  });
});

describe('실패 종류', () => {
  it('닿지 않음·로그인·저장 실패는 다시 시도할 수 있고, 깨진 사진·큰 사진은 아니다', async () => {
    const { upload } = await load();
    const s = fakeServer();
    s.fail.push(new TypeError('network'), problem(401, 'unauthorized', 'x', 'G1'), problem(503, 'not_saved', 'intake_failed', 'G6'), problem(400, 'invalid_input', 'unreadable', 'G5'), problem(413, 'payload_too_large', 'over_20mb', 'G5'));
    expect(await upload.sendPhoto(PHOTO(), 'k')).toMatchObject({ ok: false, retryable: true, reason: expect.stringContaining('연결되지') });
    expect(await upload.sendPhoto(PHOTO(), 'k')).toMatchObject({ ok: false, retryable: true, reason: expect.stringContaining('로그인') });
    expect(await upload.sendPhoto(PHOTO(), 'k')).toMatchObject({ ok: false, retryable: true });
    expect(await upload.sendPhoto(PHOTO(), 'k')).toMatchObject({ ok: false, retryable: false, reason: '이 사진은 읽을 수 없어요' });
    expect(await upload.sendPhoto(PHOTO(), 'k')).toMatchObject({ ok: false, retryable: false, reason: '사진이 너무 커요' });
  });

  it('서버 판은 실패해도 기기 저장소에 넣지 않고, 화면 목록에도 올리지 않는다', async () => {
    const { upload } = await load();
    const s = fakeServer();
    s.fail.push(new TypeError('network'));
    await upload.sendPhoto(PHOTO(), 'k');
    expect(await upload.worldWorks()).toEqual([]);
  });
});

describe('올리기 창', () => {
  const mountWith = (W: unknown, files: File[]) => mount(W as never, { props: { initialFiles: files } as never });

  it('정상: 202를 받으면 원본 액자로 걸고 보관한 작품 번호를 알린다', async () => {
    const { upload, WorldUpload } = await load();
    fakeServer();
    const w = mountWith(WorldUpload, [PHOTO()]);
    await vi.waitFor(() => expect(w.emitted('saved')).toBeTruthy());
    expect(w.emitted('saved')![0]).toEqual([['a1'], true]);
    expect((await upload.worldWorks()).map((a) => [a.id, a.title, a.cutoutState])).toEqual([['a1', '제목 없는 그림 1', undefined]]);
  });

  it('20MB 초과는 서버로 보내지 않고 이유를 보인다', async () => {
    const { WorldUpload } = await load();
    const s = fakeServer();
    const big = PHOTO();
    Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 + 1 });
    const w = mountWith(WorldUpload, [big]);
    await vi.waitFor(() => expect(w.text()).toContain('사진이 너무 커요'));
    expect(s.keys).toEqual([]);
    expect(w.find('.w-up-retry').exists()).toBe(false);
  });

  it('깨진 사진: 서버 이유를 보이고 다시 시도 버튼이 없다', async () => {
    const { WorldUpload } = await load();
    const s = fakeServer();
    s.fail.push(problem(400, 'invalid_input', 'unreadable', 'G5'));
    const w = mountWith(WorldUpload, [PHOTO()]);
    await vi.waitFor(() => expect(w.text()).toContain('이 사진은 읽을 수 없어요'));
    expect(w.find('.w-up-retry').exists()).toBe(false);
    expect(w.emitted('saved')).toBeFalsy();
  });

  it('응답을 못 받고 다시 시도해도 같은 요청 번호라 작품은 1건이다', async () => {
    const { upload, WorldUpload } = await load();
    const s = fakeServer();
    s.fail.push(new TypeError('network'));
    const w = mountWith(WorldUpload, [PHOTO()]);
    await vi.waitFor(() => expect(w.find('.w-up-retry').exists()).toBe(true));
    expect(w.text()).toContain('연결되지');
    await w.find('.w-up-retry').trigger('click');
    await vi.waitFor(() => expect(w.emitted('saved')).toBeTruthy());
    expect(s.keys).toHaveLength(2);
    expect(s.keys[0]).toBe(s.keys[1]);
    expect(s.works.size).toBe(1);
    expect((await upload.worldWorks()).map((a) => a.id)).toEqual(['a1']);
  });

  it('사진마다 요청 번호가 다르다', async () => {
    const { WorldUpload } = await load();
    const s = fakeServer();
    const w = mountWith(WorldUpload, [PHOTO(), PHOTO()]);
    await vi.waitFor(() => expect(w.emitted('saved')).toBeTruthy());
    expect(new Set(s.keys).size).toBe(2);
    expect(s.works.size).toBe(2);
  });

  it('보관됐지만 화면이 못 그리면 실패가 아니고, 걸지 못했다고 알린다', async () => {
    const { upload, WorldUpload } = await load();
    vi.mocked((await import('@/app/world/store')).processImage).mockRejectedValue(new Error('decode')); // 열 수 없는 사진은 목록을 다시 읽어도 열리지 않는다
    fakeServer();
    const w = mountWith(WorldUpload, [PHOTO()]);
    await vi.waitFor(() => expect(w.text()).toContain('걸지 못했어요'));
    expect(w.text()).toContain('1점을 보관했어요');
    expect(w.text()).not.toContain('실패');
    expect(w.emitted('saved')).toBeFalsy();
    expect(await upload.worldWorks()).toEqual([]);
  });
});

describe('기기 판', () => {
  it('값이 없으면 서버 판이 아니다', async () => {
    vi.resetModules();
    const { SERVER_WORLD } = await import('@/app/world/server/upload');
    expect(SERVER_WORLD).toBe(false);
  });
});
