// #28 시험: 3D 화면 서버 연결 층(마스터플랜 3-3) — 요청 경로·쿠키·응답, 401에 화면 이동 없음, 오류 세 종류.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setNavigator } from '../api/client';
import * as server from '../app/world/server';

const json = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });
const problem = (status: number, code: string, reason: string, gate: string | null, extra: object = {}) =>
  json(status, { type: 'x', title: 't', status, code, reason, gate, ...extra });

function stub(...res: (Response | Error)[]) {
  const f = vi.fn();
  for (const r of res) r instanceof Error ? f.mockRejectedValueOnce(r) : f.mockResolvedValueOnce(r);
  vi.stubGlobal('fetch', f);
  return f;
}
const call = (f: ReturnType<typeof vi.fn>, i = 0) => { const [url, init] = f.mock.calls[i]!; return { url: url as string, init: init as RequestInit }; };
const caught = (p: Promise<unknown>) => p.then(() => { throw new Error('성공하면 안 됨'); }, (e: unknown) => e);

afterEach(() => { vi.unstubAllGlobals(); setNavigator(null); });

describe('요청 경로·쿠키·응답', () => {
  it('사진 올리기: multipart(childId·photo), Idempotency-Key, 같은 출처 쿠키, 202 응답을 그대로', async () => {
    const f = stub(json(202, { id: 'a1', exhibited: true, hungResultKind: 'frame' }));
    const a = await server.uploadArtwork('c1', new Blob(['x'], { type: 'image/png' }), 'k-1');
    const { url, init } = call(f);
    expect([url, init.method, init.credentials]).toEqual(['/v1/artworks', 'POST', 'same-origin']);
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('k-1');
    const form = init.body as FormData;
    expect(form.get('childId')).toBe('c1');
    expect(form.get('photo')).toBeInstanceOf(Blob);
    expect(a).toMatchObject({ id: 'a1', exhibited: true, hungResultKind: 'frame' });
  });

  it('로그인·확정·결정은 JSON 본문, 작품 번호는 주소에 맞게 인코딩', async () => {
    const f = stub(new Response(null, { status: 204 }), json(200, { id: 'a/1' }), json(200, { artwork: null, retake: { childId: 'c1' } }));
    await server.login({ email: 'a@b.c', password: 'pw' });
    await server.confirmKind('a/1', 'relief');
    const d = await server.decide('a/1', 'retake');
    expect(call(f, 0)).toMatchObject({ url: '/v1/auth/login', init: { method: 'POST', body: JSON.stringify({ email: 'a@b.c', password: 'pw' }) } });
    expect((call(f, 0).init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(call(f, 1)).toMatchObject({ url: '/v1/artworks/a%2F1/confirm', init: { body: JSON.stringify({ kind: 'relief' }) } });
    expect(call(f, 2)).toMatchObject({ url: '/v1/artworks/a%2F1/decision', init: { body: JSON.stringify({ decision: 'retake' }) } });
    expect(d).toEqual({ artwork: null, retake: { childId: 'c1' } });
  });

  it('전시 목록은 아이를 지정해 읽는다(계약상 필수)', async () => {
    const f = stub(json(200, {}));
    await server.gallery('c1');
    expect(call(f).url).toBe('/v1/gallery?child=c1');
  });

  it('작품 지우기: DELETE를 보내고 화면을 옮기지 않는다', async () => {
    const nav = { toLogin: vi.fn(), toNoFamily: vi.fn() };
    setNavigator(nav);
    const f = stub(new Response(null, { status: 202 }), problem(401, 'unauthorized', 'login_required', 'G0'));
    await server.deleteArtwork('a/1');
    expect(call(f)).toMatchObject({ url: '/v1/artworks/a%2F1', init: { method: 'DELETE' } });
    expect(server.failureOf(await caught(server.deleteArtwork('a1')))).toEqual({ kind: 'login' });
    expect(nav.toLogin).not.toHaveBeenCalled();
  });
});

describe('오류 전달(failureOf)', () => {
  it('401은 /app/login으로 옮기지 않고 login으로 넘긴다', async () => {
    const nav = { toLogin: vi.fn(), toNoFamily: vi.fn() };
    setNavigator(nav);
    stub(problem(401, 'unauthorized', 'login_required', 'G0'));
    expect(server.failureOf(await caught(server.me()))).toEqual({ kind: 'login' });
    expect(nav.toLogin).not.toHaveBeenCalled();
  });

  it('작품 상세의 401·409 no_family도 화면을 옮기지 않고 3D 화면에 넘긴다', async () => {
    const nav = { toLogin: vi.fn(), toNoFamily: vi.fn() };
    setNavigator(nav);
    const f = stub(problem(401, 'unauthorized', 'login_required', 'G0'), problem(409, 'conflict', 'no_family', 'G0'));
    expect(server.failureOf(await caught(server.getArtwork('a/1')))).toEqual({ kind: 'login' });
    expect(server.failureOf(await caught(server.getArtwork('a/1')))).toMatchObject({ kind: 'refused' });
    expect(call(f).url).toBe('/v1/artworks/a%2F1');
    expect(nav.toLogin).not.toHaveBeenCalled();
    expect(nav.toNoFamily).not.toHaveBeenCalled();
  });

  it('네트워크 실패와 5xx는 offline', async () => {
    stub(new TypeError('Failed to fetch'), problem(502, 'internal', 'internal', null));
    expect(server.failureOf(await caught(server.listChildren()))).toEqual({ kind: 'offline' });
    expect(server.failureOf(await caught(server.listChildren()))).toEqual({ kind: 'offline' });
  });

  it('거절은 /app과 같은 사전의 이유 문장과 칸별 이유', async () => {
    stub(
      problem(422, 'validation_failed', 'invalid_fields', 'G4', { fields: [{ name: 'alias', reason: 'too_long' }] }),
      problem(413, 'payload_too_large', 'over_20mb', 'G5'),
      problem(503, 'not_saved', 'intake_failed', 'G6'),
    );
    expect(server.failureOf(await caught(server.addChild('x'.repeat(99))))).toEqual({ kind: 'refused', reason: '별칭만 적어 주세요', fields: [{ name: 'alias', reason: 'too_long' }] });
    const up = () => server.uploadArtwork('c1', new Blob(['x']), 'k');
    expect(server.failureOf(await caught(up()))).toMatchObject({ kind: 'refused', reason: '사진이 너무 커요' });
    expect(server.failureOf(await caught(up()))).toMatchObject({ kind: 'refused', reason: '접수되지 않았어요, 다시 올려 주세요' });
  });

  it('ApiError가 아닌 예외도 offline(창이 다시 시도만 보이게)', () => {
    expect(server.failureOf(new Error('x'))).toEqual({ kind: 'offline' });
  });
});

it('잘못된 비밀번호와 failureOf는 만료를 알리지 않고 인증된 작품 호출만 알린다', async () => {
  const expired = vi.fn();
  window.addEventListener('world-session-expired', expired);
  try {
    stub(problem(401, 'unauthorized', 'login_required', 'G0'));
    const e = await caught(server.login({email:'a@b.c',password:'wrong'}));
    expect(server.failureOf(e)).toEqual({kind:'login'});
    expect(expired).not.toHaveBeenCalled();
    stub(problem(401, 'unauthorized', 'login_required', 'G0'));
    await caught(server.getArtwork('a1'));
    expect(expired).toHaveBeenCalledTimes(1);
    stub(problem(401, 'unauthorized', 'login_required', 'G0'));
    await caught(server.me());
    expect(expired).toHaveBeenCalledTimes(2);
  } finally {
    window.removeEventListener('world-session-expired', expired);
  }
});


it('가족 방 설정은 같은 출처 쿠키로 읽고 revision과 함께 저장하며 충돌을 알린다', async () => {
  const f = stub(json(200, { exists: true, revision: 3, rooms: [4, 8], decor: [] }), problem(409, 'conflict', 'layout_changed', null));
  const layout = await server.getWorldLayout();
  expect(layout.rooms).toEqual([4, 8]);
  const err = await caught(server.putWorldLayout({ revision: layout.revision, rooms: [4, 8, 9], decor: [] }));
  expect(call(f, 0)).toMatchObject({ url: '/v1/family/world-layout', init: { method: 'GET', credentials: 'same-origin' } });
  expect(call(f, 1)).toMatchObject({ url: '/v1/family/world-layout', init: { method: 'PUT', body: JSON.stringify({ revision: 3, rooms: [4, 8, 9], decor: [] }) } });
  expect(server.failureOf(err).kind).not.toBe('login');
});
