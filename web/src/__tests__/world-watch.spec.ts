// #37 시험: 3D 화면 상태 묻기(마스터플랜 3-3, 3-5 5번) — 진행 중일 때만 3→6→10초, 숨긴 탭, 실패 세 종류, 다시 시도, 늦게 온 옛 응답.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { autoStep, isMoving, useArtworkWatch } from '@/app/world/server/watch';

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

  it('화면을 벗어난 뒤 작품을 더해도(새로 고침 뒤 늦게 온 목록) 묻지 않는다', async () => {
    const f = server(() => art('a1', 'running'));
    const w = start();
    scope.stop();
    w.add(['a1']);
    await flush(60000);
    expect(f).toHaveBeenCalledTimes(0);
    await w.retry();
    expect(f).toHaveBeenCalledTimes(0);
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

  describe('서버 목록 이어 보기(#40, #85 리뷰)', () => {
    const down = () => Promise.reject(new TypeError('network'));
    it('목록 첫 요청이 실패해도 복구 뒤 다시 시도하면 대기 작품을 읽는다', async () => {
      const f = server((u) => art(u.split('/').pop()!, 'succeeded', { choices: ['like'] }));
      const list = vi.fn<() => Promise<string[]>>().mockImplementationOnce(down).mockResolvedValue(['a1']);
      const w = start();
      await w.resume(list);
      expect(w.failure.value?.kind).toBe('offline');
      expect(f).not.toHaveBeenCalled();
      await w.retry();
      expect(list).toHaveBeenCalledTimes(2);
      expect(w.failure.value).toBeNull();
      expect(w.details.value.get('a1')?.choices).toEqual(['like']);
    });
    it('다시 시도에도 목록을 못 읽으면 안내가 남고, 묻던 작품의 성공 응답이 안내를 지우지 않는다', async () => {
      server((u) => art(u.split('/').pop()!, 'running'));
      const list = vi.fn<() => Promise<string[]>>(down);
      const w = start();
      w.add(['m1']);
      await w.resume(list);
      await flush(3_000);
      expect(w.failure.value?.kind).toBe('offline');
      await w.retry();
      expect(list).toHaveBeenCalledTimes(2);
      expect(w.failure.value?.kind).toBe('offline');
      expect(w.details.value.get('m1')).toBeTruthy();
    });
    it('화면을 벗어난 뒤 실패한 목록은 안내를 띄우지 않는다', async () => {
      server(() => art('x', 'running'));
      let fail!: (e: Error) => void;
      const w = start();
      const p = w.resume(() => new Promise((_, no) => { fail = no; }));
      scope.stop();
      fail(new TypeError('network'));
      await p;
      expect(w.failure.value).toBeNull();
    });
    it('로그아웃 뒤 도착한 목록은 성공이든 실패든 버린다', async () => {
      const f = server(() => art('old', 'running'));
      let ok!: (ids: string[]) => void;
      const w = start();
      const p = w.resume(() => new Promise((res) => { ok = res; }));
      w.clear();
      ok(['old']);
      await p;
      await flush(3_000);
      expect(f).not.toHaveBeenCalled();
      let no!: (e: Error) => void;
      const q = w.resume(() => new Promise((_, rej) => { no = rej; }));
      w.clear();
      no(new TypeError('network'));
      await q;
      expect(w.failure.value).toBeNull();
      await w.retry();
      expect(f).not.toHaveBeenCalled();
    });
    it('목록을 기다리는 동안 묻기가 한 번 돌아도 목록을 버리지 않는다', async () => {
      server((u) => art(u.split('/').pop()!, 'running'));
      let ok!: (ids: string[]) => void;
      const w = start();
      const p = w.resume(() => new Promise((res) => { ok = res; }));
      w.add(['m1']);
      await flush(3_000);
      ok(['a1']);
      await p;
      await flush(6_000);
      expect(w.details.value.get('a1')).toBeTruthy();
    });
    it('지운 작품은 상세에서 빠지고, 삭제 전에 출발한 응답이 되살리지 못한다', async () => {
      let answer!: (r: Response) => void;
      const f = server((u) => (u.endsWith('/gone') && f.mock.calls.length > 1 ? new Promise((res) => { answer = res; }) : art(u.split('/').pop()!, 'running')));
      const w = start();
      w.add(['gone']);
      await flush(3_000);
      expect(w.details.value.has('gone')).toBe(true);
      await flush(6_000);
      w.forget('gone');
      expect(w.details.value.has('gone')).toBe(false);
      answer(art('gone', 'running'));
      await flush(0);
      expect(w.details.value.has('gone')).toBe(false);
      const n = f.mock.calls.length;
      await flush(20_000);
      expect(f.mock.calls.length).toBe(n);
    });
    it('로그아웃하면 못 읽은 목록을 잊는다', async () => {
      server(() => art('x', 'running'));
      const list = vi.fn<() => Promise<string[]>>(down);
      const w = start();
      await w.resume(list);
      w.clear();
      await w.retry();
      expect(list).toHaveBeenCalledTimes(1);
      expect(w.failure.value).toBeNull();
    });
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

describe('체험 서버 자동 전시(마스터플랜 3-3 #137)', () => {
  const at = (state: string, confirmedKind: string | null, choices: string[]) => ({ state, confirmedKind, choices }) as never;
  it('확정 전이면 입체로 확정한다', () => {
    expect(autoStep(at('exhibited', null, ['animated', 'relief', 'frame']))).toEqual({ confirm: 'relief' });
    expect(autoStep(at('awaiting_confirm', null, ['relief', 'frame']))).toEqual({ confirm: 'relief' });
  });
  it('결과가 나오면 좋아요를 보낸다', () => {
    expect(autoStep(at('awaiting_review', 'relief', ['like', 'frame', 'retake']))).toEqual({ decide: 'like' });
  });
  it('입체를 고를 수 없거나 실패했으면 사람에게 넘긴다', () => {
    expect(autoStep(at('awaiting_confirm', null, ['frame']))).toBeNull();
    expect(autoStep(at('failed', 'relief', ['frame', 'retake']))).toBeNull();
    expect(autoStep(at('awaiting_review', 'relief', ['frame', 'retake']))).toBeNull();
  });
  it('이미 확정했거나 걸린 작품은 다시 보내지 않는다', () => {
    expect(autoStep(at('processing', 'relief', []))).toBeNull();
    expect(autoStep(at('exhibited', 'relief', []))).toBeNull();
  });
});
