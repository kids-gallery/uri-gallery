// #37 시험: 3D 화면 상태 묻기(마스터플랜 3-3, 3-5 5번) — 진행 중일 때만 3→6→10초, 숨긴 탭, 실패 세 종류, 다시 시도, 늦게 온 옛 응답.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { isMoving, useArtworkWatch } from '@/app/world/server/watch';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' } });
const stage = (status: string) => ({ stage: 'split', status, attempt: 0, downgraded: false, waitingForModel: false, etaSeconds: null });
const art = (id: string, status: string, extra: object = {}) => json(200, { id, state: 'exhibited', choices: [], stages: [stage(status)], ...extra });
const problem = (status: number, code: string, reason: string) => json(status, { type: 'x', title: 't', status, code, reason, gate: 'G0' });

/** 요청마다 next(주소)로 답한다. 값 대신 Promise를 주면 원하는 때까지 응답을 늦출 수 있다 */
function server(next: (url: string) => Response | Error | Promise<Response>) {
  const f = vi.fn(async (url: string) => {
    const r = await next(url);
    if (r instanceof Error) throw r;
    return r;
  });
  vi.stubGlobal('fetch', f);
  return f;
}
const flush = (ms: number) => vi.advanceTimersByTimeAsync(ms);

let visibility: DocumentVisibilityState = 'visible';
let scope: ReturnType<typeof effectScope>;
const start = () => scope.run(() => useArtworkWatch())!;

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
  scope = effectScope();
});
afterEach(() => { scope.stop(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('진행 중 판단', () => {
  it('대기·실행·다시 시도 중이면 진행 중이고, state가 exhibited여도 그렇다', () => {
    for (const s of ['waiting', 'running', 'retrying']) expect(isMoving({ stages: [stage(s)] } as never)).toBe(true);
    for (const s of ['done', 'failed', 'cancelled']) expect(isMoving({ stages: [stage(s)] } as never)).toBe(false);
    expect(isMoving({ stages: [] })).toBe(false);
  });
});

describe('언제 묻는가', () => {
  it('3→6→10초 간격으로 묻고, 끝나면 멈춘다', async () => {
    let n = 0;
    const f = server(() => art('a1', ++n < 4 ? 'running' : 'done'));
    const w = start();
    w.add(['a1']);
    await flush(2999); expect(f).toHaveBeenCalledTimes(0);
    await flush(1); expect(f).toHaveBeenCalledTimes(1);
    await flush(6000); expect(f).toHaveBeenCalledTimes(2);
    await flush(10000); expect(f).toHaveBeenCalledTimes(3);
    await flush(10000); expect(f).toHaveBeenCalledTimes(4);
    await flush(60000); expect(f).toHaveBeenCalledTimes(4);
    expect(w.details.value.get('a1')?.stages[0]?.status).toBe('done');
  });

  it('확정 선택지가 와도 단계가 진행 중이면 계속 묻는다(컷아웃을 받아야 한다)', async () => {
    let n = 0;
    const f = server(() => (++n === 1
      ? art('a1', 'running', { choices: ['relief', 'frame'], confirmedKind: null, cutoutUrl: null })
      : art('a1', 'done', { choices: ['relief', 'frame'], confirmedKind: null, cutoutUrl: '/v1/files/c' })));
    const w = start();
    w.add(['a1']);
    await flush(3000 + 6000);
    expect(f).toHaveBeenCalledTimes(2);
    expect(w.details.value.get('a1')?.cutoutUrl).toBe('/v1/files/c');
  });

  it('진행 중인 작품만 계속 묻고, 같은 작품을 두 번 더해도 한 번만 묻는다', async () => {
    const f = server((u) => (u.endsWith('a1') ? art('a1', 'done') : art('a2', 'running')));
    const w = start();
    w.add(['a1', 'a2', 'a1']);
    await flush(3000);
    expect(f.mock.calls.map(([u]) => u)).toEqual(['/v1/artworks/a1', '/v1/artworks/a2']);
    await flush(6000);
    expect(f.mock.calls.slice(2).map(([u]) => u)).toEqual(['/v1/artworks/a2']);
  });

  it('숨긴 탭에서는 묻지 않고, 다시 보이면 바로 묻는다', async () => {
    const f = server(() => art('a1', 'running'));
    start().add(['a1']);
    visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
    await flush(60000); expect(f).toHaveBeenCalledTimes(0);
    visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange'));
    await flush(0); expect(f).toHaveBeenCalledTimes(1);
  });

  it('화면을 벗어나면 멈춘다', async () => {
    const f = server(() => art('a1', 'running'));
    start().add(['a1']);
    scope.stop();
    await flush(60000);
    expect(f).toHaveBeenCalledTimes(0);
  });

  it('작품을 더하지 않으면(기기 판) 요청이 없다', async () => {
    const f = server(() => art('a1', 'running'));
    const w = start();
    w.add([]);
    await flush(60000);
    expect(f).toHaveBeenCalledTimes(0);
    expect(w.failure.value).toBeNull();
  });
});

describe('실패', () => {
  it('연결이 끊기면 알리고 계속 묻다가, 돌아오면 안내가 저절로 사라진다', async () => {
    let up = false;
    const f = server(() => (up ? art('a1', 'running') : new TypeError('Failed to fetch')));
    const w = start();
    w.add(['a1']);
    await flush(3000);
    expect(w.failure.value).toEqual({ kind: 'offline' });
    await flush(6000);
    expect(f).toHaveBeenCalledTimes(2);
    up = true;
    await flush(10000);
    expect(w.failure.value).toBeNull();
  });

  it('nginx가 앱에 닿지 못한 502도 연결 실패다', async () => {
    server(() => new Response('bad gateway', { status: 502 }));
    const w = start();
    w.add(['a1']);
    await flush(3000);
    expect(w.failure.value).toEqual({ kind: 'offline' });
  });

  it('다시 시도는 기다리지 않고 바로 묻고, 간격을 처음부터 다시 잰다', async () => {
    let up = false;
    const f = server(() => (up ? art('a1', 'running') : new TypeError('x')));
    const w = start();
    w.add(['a1']);
    await flush(3000);
    up = true;
    await w.retry();
    expect(f).toHaveBeenCalledTimes(2);
    expect(w.failure.value).toBeNull();
    await flush(2999); expect(f).toHaveBeenCalledTimes(2);
    await flush(1); expect(f).toHaveBeenCalledTimes(3);
  });

  it('로그인이 풀리면 멈추고, 다시 시도하면 이어서 묻는다', async () => {
    let session = false;
    const f = server(() => (session ? art('a1', 'running') : problem(401, 'unauthorized', 'login_required')));
    const w = start();
    w.add(['a1']);
    await flush(3000);
    expect(w.failure.value).toEqual({ kind: 'login' });
    await flush(60000);
    expect(f).toHaveBeenCalledTimes(1);
    session = true;
    await w.retry();
    expect(w.failure.value).toBeNull();
    await flush(3000);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('거절된 작품만 묻기를 그만두고 이유를 보이며, 닫으면 안내가 사라진다', async () => {
    const f = server((u) => (u.endsWith('a1') ? problem(404, 'not_found', 'not_found') : art('a2', 'running')));
    const w = start();
    w.add(['a1', 'a2']);
    await flush(3000);
    expect(w.failure.value).toMatchObject({ kind: 'refused' });
    await flush(6000);
    expect(f.mock.calls.slice(2).map(([u]) => u)).toEqual(['/v1/artworks/a2']);
    expect(w.failure.value).toBeNull();
    server(() => problem(404, 'not_found', 'not_found'));
    w.add(['a3']);
    await flush(10000);
    expect(w.failure.value).toMatchObject({ kind: 'refused' });
  });

  it('물을 작품이 없을 때 다시 시도(닫기)는 요청 없이 안내만 닫는다', async () => {
    const f = server(() => problem(404, 'not_found', 'not_found'));
    const w = start();
    w.add(['a1']);
    await flush(3000);
    expect(w.failure.value).toMatchObject({ kind: 'refused' });
    await w.retry();
    expect(w.failure.value).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('늦게 도착한 옛 응답', () => {
  it('다시 시도 뒤에 도착한 옛 응답을 버린다', async () => {
    let release: (r: Response) => void = () => undefined;
    let n = 0;
    server(() => (++n === 1 ? new Promise<Response>((r) => { release = r; }) : art('a1', 'running', { cutoutUrl: '/new' })));
    const w = start();
    w.add(['a1']);
    await flush(3000);
    await w.retry();
    expect(w.details.value.get('a1')?.cutoutUrl).toBe('/new');
    release(art('a1', 'done', { cutoutUrl: '/old' }));
    await flush(0);
    expect(w.details.value.get('a1')?.cutoutUrl).toBe('/new');
    await flush(6000); // 옛 요청이 끝나며 간격이 한 단계 늘어난다
    expect(n).toBeGreaterThanOrEqual(3); // 옛 응답의 done 때문에 멈추지 않는다
  });

  it('다시 시도를 기다리는 중에 화면을 벗어나면, 응답이 와도 묻기가 되살아나지 않는다', async () => {
    let release: (r: Response) => void = () => undefined;
    const f = server(() => new Promise<Response>((r) => { release = r; }));
    const w = start();
    w.add(['a1']);
    const retried = w.retry();
    scope.stop();
    release(art('a1', 'running'));
    await retried;
    expect(w.details.value.size).toBe(0);
    await flush(60000);
    expect(f).toHaveBeenCalledTimes(1);
    visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange'));
    visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange'));
    await flush(0);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('자동 묻기를 기다리는 중에 화면을 벗어나도 늦은 응답을 넣지 않는다', async () => {
    let release: (r: Response) => void = () => undefined;
    const f = server(() => new Promise<Response>((r) => { release = r; }));
    const w = start();
    w.add(['a1']);
    await flush(3000);
    scope.stop();
    release(art('a1', 'running'));
    await flush(60000);
    expect(w.details.value.size).toBe(0);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('다시 시도 뒤에 도착한 옛 실패는 안내를 띄우지 않는다', async () => {
    let fail: (r: Response) => void = () => undefined;
    let n = 0;
    server(() => (++n === 1 ? new Promise<Response>((r) => { fail = r; }) : art('a1', 'running')));
    const w = start();
    w.add(['a1']);
    await flush(3000);
    await w.retry();
    fail(new Response('x', { status: 502 }));
    await flush(0);
    expect(w.failure.value).toBeNull();
  });

  it('로그아웃하면 지우고, 그 뒤에 온 응답을 넣지 않는다', async () => {
    let release: (r: Response) => void = () => undefined;
    const f = server(() => new Promise<Response>((r) => { release = r; }));
    const w = start();
    w.add(['a1']);
    await flush(3000);
    w.clear();
    release(art('a1', 'running'));
    await flush(60000);
    expect(w.details.value.size).toBe(0);
    expect(w.failure.value).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
  });
});
