// 휴대폰 실측 값과 계산(3D미술관_재설계 §2-22 13, 출시불가 지시문 6의 1~2). 화면은 WorldMeasure.vue.
// 개발 서버나 측정용 빌드(VITE_MEASURE=1)에서 주소에 ?measure가 있을 때만 WorldView가 불러온다. 일반 배포본에는 들어가지 않는다.
// WorldView가 window에 보내는 'uam-measure' 이벤트(detail = 이름)를 받은 시각을 performance.now()로 적는다(이 탭을 연 때부터 잰 ms).
// 판단 값(재는 시간, 백분위, 자릿수, 저장 열쇠)은 MEASURE 표 한 곳에만 둔다.
import { reactive } from 'vue';

export const MEASURE = {
  windowMs: 10_000, // 미술관 안 프레임 간격을 재는 시간(§2-22 13)
  p50: 50, // 백분위. 계산 방법은 frameStats 주석
  p95: 95,
  secDigits: 2, // 시각은 0.01초까지 쓴다
  msDigits: 1, // 프레임 간격은 0.1ms까지 쓴다
  event: 'uam-measure', // WorldView가 window에 보내는 이벤트 이름
  markPrefix: 'uam-measure:', // WorldView가 performance.mark(이 앞말+이름)도 남기면, 이 파일이 늦게 받아져도 앞선 값을 채운다
  loadsKey: 'uam-measure-loads', // sessionStorage: 이 탭에서 측정 표시를 연 횟수
  lastKey: 'uam-measure-last', // sessionStorage: 마지막으로 적은 값(다시 열렸을 때 앞선 기록을 보인다)
} as const;

export type MarkName = 'title-shown' | 'start-ready' | 'start-pressed' | 'inside' | 'photo-picked' | 'first-saved';
/**
 * 적는 순간들(표 순서가 보고 순서). 'photo-picked'는 WorldView가 보내지 않고, 이 파일이 사진 선택 칸(input[type=file])의 change를 직접 듣는다.
 * 같은 이름이 다시 오면 처음 값을 둔다. lastUntil이 있으면 그 이름이 적히기 전까지는 마지막 값으로 바꾼다(첫 작품 전에 마지막으로 고른 사진).
 * frames: 처음 적힐 때 프레임 간격 재기를 시작한다.
 */
export const MARKS: readonly { name: MarkName; label: string; lastUntil?: MarkName; frames?: true }[] = [
  { name: 'title-shown', label: '첫 화면 표시' },
  { name: 'start-ready', label: '시작 버튼 누를 수 있음' },
  { name: 'start-pressed', label: '시작 누름' },
  { name: 'inside', label: '미술관 안 도착', frames: true },
  { name: 'photo-picked', label: '사진 고름', lastUntil: 'first-saved' },
  { name: 'first-saved', label: '첫 작품 걸림' },
];
/** 보고에 함께 쓰는 구간. '사진 고른 뒤 → 걸림'은 사람이 고르는 시간을 뺀 기기 처리 시간이다 */
export const SPANS: readonly { from: MarkName; to: MarkName; label: string }[] = [
  { from: 'start-pressed', to: 'first-saved', label: '시작 → 첫 작품 걸림' },
  { from: 'photo-picked', to: 'first-saved', label: '사진 고른 뒤 → 걸림' },
];
export const FRAME_FROM = { inside: '도착 직후', button: '직접 시작' } as const;
/** 재기가 끝난 까닭. 사진 고르기 창과 다른 앱으로 가린 동안의 간격은 3D 화면의 끊김이 아니므로 거기서 멈춘다 */
export const FRAME_END = { done: '끝', hidden: '멈춤(화면이 가려짐)', picker: '멈춤(사진 고르기를 엶)' } as const;
export type FrameFrom = keyof typeof FRAME_FROM;
export type FrameEnd = keyof typeof FRAME_END;

export interface FrameStats { n: number; p50: number; p95: number; max: number }
/**
 * 프레임 간격(ms)의 개수·p50·p95·최대.
 * 백분위는 가장 가까운 순위 방법(nearest-rank)이다: 오름차순으로 놓고 p 백분위 = ceil(p × n / 100)번째 값(1부터 셈).
 * 보간하지 않으므로 늘 실제로 잰 간격 하나가 나온다(n = 1이면 셋 다 그 값). p95는 "간격의 95%가 이 값 이하"라는 뜻이다.
 * 유한수가 아닌 값은 뺀다. 값이 없으면 n = 0이고 나머지는 NaN이다. 넘긴 배열은 바꾸지 않는다.
 */
export function frameStats(deltas: readonly number[]): FrameStats {
  const xs = deltas.filter(Number.isFinite).sort((a, b) => a - b), n = xs.length;
  const rank = (p: number) => (n ? xs[Math.min(n, Math.max(1, Math.ceil((p * n) / 100))) - 1]! : NaN);
  return { n, p50: rank(MEASURE.p50), p95: rank(MEASURE.p95), max: n ? xs[n - 1]! : NaN };
}

/** requestAnimationFrame 시각을 하나씩 받아 간격을 모은다. 첫 시각부터 windowMs를 채우면 push가 true를 낸다 */
export function frameWindow(windowMs: number) {
  const deltas: number[] = [];
  let first = NaN, last = NaN;
  return {
    deltas,
    push(t: number) { if (Number.isNaN(first)) first = t; else deltas.push(t - last); last = t; return t - first >= windowMs; },
    elapsed: () => (Number.isNaN(first) ? 0 : last - first),
  };
}

export interface Reopen { loads: number | null; navType: string; discarded: boolean | null; reopened: boolean | null }
/**
 * 이 탭이 다시 열렸는지. 휴대폰이 메모리가 모자라 탭을 닫았다가 다시 연 경우를 잡으려는 것이다.
 * - loads: sessionStorage에 적은 이 탭의 열기 횟수(이번 포함). sessionStorage는 탭마다 따로이고 새로 고침·브라우저가 다시 연 탭에서도
 *   남으며, 새 탭은 1부터 센다. 저장소를 못 쓰면 null.
 * - navType: Navigation Timing의 type(navigate·reload·back_forward·prerender). iOS Safari가 메모리 부족 뒤 다시 열 때 어떤 값을 주는지는
 *   실기기에서 확인하지 않았다. 그래서 값을 그대로 보인다.
 * - discarded: document.wasDiscarded. Chromium(Android Chrome)에만 있고, 메모리 때문에 버린 탭을 다시 열면 true. 없으면 null.
 * 한계: 사람이 직접 새로 고친 것과 브라우저가 다시 연 것을 구별하지 못한다(둘 다 2번째 이상·reload). 그래서 측정 중에는 직접 새로
 * 고치지 않고, 새로 잴 때는 새 탭(또는 다른 포트)을 연다. Safari 앱 자체가 종료된 뒤 탭을 복원할 때 sessionStorage가 남는지도 확인하지 않았다.
 * 판정: 2번째 이상, reload, 버린 탭 가운데 하나면 예. 저장소를 못 쓰고 나머지 둘도 아니면 알 수 없음(null).
 */
export function detectReopen(storage: Pick<Storage, 'getItem' | 'setItem'> | null, navType?: string, wasDiscarded?: boolean): Reopen {
  let loads: number | null = null;
  try {
    if (storage) { loads = (Number(storage.getItem(MEASURE.loadsKey)) || 0) + 1; storage.setItem(MEASURE.loadsKey, String(loads)); }
  } catch { loads = null; } // 저장소가 막힌 브라우저
  const discarded = typeof wasDiscarded === 'boolean' ? wasDiscarded : null, nav = navType ?? '알 수 없음';
  const yes = (loads ?? 0) > 1 || nav === 'reload' || discarded === true;
  return { loads, navType: nav, discarded, reopened: yes ? true : loads === null ? null : false };
}

function sessionStore(): Storage | null { try { return window.sessionStorage; } catch { return null; } }
/** 브라우저 값으로 detectReopen을 부른다(열기 횟수를 하나 올린다) */
export function readReopen(): Reopen {
  const nav = typeof performance.getEntriesByType === 'function' ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type : undefined;
  return detectReopen(sessionStore(), nav, (document as Document & { wasDiscarded?: boolean }).wasDiscarded);
}

export interface FrameRun { from: FrameFrom; end: FrameEnd; ms: number; at: number; stats: FrameStats }
export interface MeasureState {
  marks: Partial<Record<MarkName, number>>;
  frames: FrameRun[];
  /** 재는 중이면 시작한 곳과 남은 초. 1초마다만 바꿔 화면 갱신이 측정을 흔들지 않게 한다 */
  running: { from: FrameFrom; left: number } | null;
  reopen: Reopen;
  /** 이 탭이 다시 열렸다면 앞선 열기에서 마지막으로 적은 값 */
  previous: string | null;
}
export interface ReportInfo { when: string; build: string; device: string }

export const sec = (ms: number) => `${(ms / 1000).toFixed(MEASURE.secDigits)}초`;
const msText = (ms: number) => `${ms.toFixed(MEASURE.msDigits)}ms`;
const yesNo = (v: boolean | null) => (v === null ? '알 수 없음' : v ? '예' : '아니요');
export const statsText = (x: FrameStats) => (x.n ? `p50 ${msText(x.p50)} · p95 ${msText(x.p95)} · 최대 ${msText(x.max)} · ${x.n}개` : '값 없음');

/** 복사·화면용 글. 값이 없으면 '없음'. withPrevious가 false면 앞선 열기의 기록을 넣지 않는다(저장할 때 겹겹이 쌓이지 않게) */
export function report(s: MeasureState, info: ReportInfo, withPrevious = true): string[] {
  const lines = ['우리 아이 미술관 측정(설계 2-22 13)', `판: ${info.build} · 적은 때: ${info.when}`, `기기: ${info.device}`, '[이 탭을 연 때부터]'];
  for (const m of MARKS) { const t = s.marks[m.name]; lines.push(`${m.label}: ${t === undefined ? '없음' : sec(t)}`); }
  lines.push('[구간]');
  for (const p of SPANS) { const a = s.marks[p.from], b = s.marks[p.to]; lines.push(`${p.label}: ${a === undefined || b === undefined ? '없음' : sec(b - a)}`); }
  lines.push(`[미술관 안 프레임 간격 ${MEASURE.windowMs / 1000}초]`);
  s.frames.forEach((f, i) => lines.push(`${i + 1}회 ${FRAME_FROM[f.from]}, ${FRAME_END[f.end]} ${sec(f.ms)}: ${statsText(f.stats)}`));
  if (s.running) lines.push(`재는 중(${FRAME_FROM[s.running.from]}): ${s.running.left}초 남음`);
  else if (!s.frames.length) lines.push('없음');
  const r = s.reopen;
  lines.push('[다시 열림]', `${yesNo(r.reopened)} · 이 탭 열기 ${r.loads === null ? '알 수 없음' : `${r.loads}번째`} · 열린 방식 ${r.navType} · 크롬이 메모리 때문에 닫았던 탭 ${yesNo(r.discarded)}`);
  if (withPrevious && s.previous) lines.push('[이전 열기의 마지막 기록]', ...s.previous.split('\n'));
  return lines;
}

/** 보고 머리에 쓰는 판(첫 화면 스크립트 파일 이름, 개발 서버면 main.ts)·시각·기기 */
export function pageInfo(): ReportInfo {
  const src = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].at(-1)?.src ?? '';
  return { when: new Date().toLocaleString('ko-KR'), build: src.split('/').pop() || '알 수 없음', device: `${navigator.userAgent} · 화면 ${innerWidth}×${innerHeight} · 배율 ${devicePixelRatio}` };
}

const isMark = (x: unknown): x is MarkName => MARKS.some((m) => m.name === x);
const isFileInput = (t: EventTarget | null): t is HTMLInputElement => t instanceof HTMLInputElement && t.type === 'file';

/** 측정 하나: 이벤트를 듣고, 값을 적고, 프레임 간격을 잰다. 바꾸는 값은 state에만 있다 */
export function createMeasure() {
  const storage = sessionStore(), reopen = readReopen();
  let previous: string | null = null;
  try { if (reopen.reopened) previous = storage?.getItem(MEASURE.lastKey) ?? null; } catch { previous = null; }
  const s = reactive<MeasureState>({ marks: {}, frames: [], running: null, reopen, previous });
  let raf = 0, run = 0, stop: ((end: FrameEnd) => void) | null = null;
  const save = () => { try { storage?.setItem(MEASURE.lastKey, report(s, pageInfo(), false).join('\n')); } catch { /* 못 적어도 화면 값은 그대로 */ } };

  function record(name: MarkName, t: number) {
    const row = MARKS.find((m) => m.name === name);
    if (!row) return;
    const had = s.marks[name] !== undefined;
    if (row.lastUntil ? s.marks[row.lastUntil] !== undefined : had) return;
    s.marks[name] = t;
    save();
    if (row.frames && !had) startFrames('inside');
  }

  /** windowMs 동안 requestAnimationFrame 간격을 모은다. 재는 중에는 새로 시작하지 않는다 */
  function startFrames(from: FrameFrom) {
    if (s.running) return;
    const id = ++run, w = frameWindow(MEASURE.windowMs);
    s.running = { from, left: Math.ceil(MEASURE.windowMs / 1000) };
    stop = (end) => {
      if (id !== run || !s.running) return;
      cancelAnimationFrame(raf); stop = null; s.running = null;
      s.frames.push({ from, end, ms: w.elapsed(), at: performance.now(), stats: frameStats(w.deltas) });
      save();
    };
    const step = (t: number) => {
      if (id !== run || !s.running) return;
      if (w.push(t)) { stop?.('done'); return; }
      const left = Math.ceil((MEASURE.windowMs - w.elapsed()) / 1000);
      if (s.running.left !== left) s.running.left = left;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  const onMark = (e: Event) => { const n = (e as CustomEvent<unknown>).detail; if (isMark(n)) record(n, performance.now()); };
  const onClick = (e: Event) => { if (isFileInput(e.target)) stop?.('picker'); };
  const onChange = (e: Event) => { if (isFileInput(e.target) && e.target.files?.length) record('photo-picked', performance.now()); };
  const onVisibility = () => { if (document.visibilityState === 'hidden') stop?.('hidden'); };
  window.addEventListener(MEASURE.event, onMark);
  document.addEventListener('click', onClick, true); // 앞 단계(capture)에서 들어야 화면 코드가 칸을 비우기 전에 고른 파일을 본다
  document.addEventListener('change', onChange, true);
  document.addEventListener('visibilitychange', onVisibility);
  // 이 파일이 늦게 받아졌을 때: WorldView가 performance.mark도 남겼다면 그 시각으로 앞선 값을 채운다
  if (typeof performance.getEntriesByName === 'function') {
    for (const m of MARKS) { const e = performance.getEntriesByName(MEASURE.markPrefix + m.name, 'mark')[0]; if (e) record(m.name, e.startTime); }
  }

  function dispose() {
    run++; stop = null; cancelAnimationFrame(raf); s.running = null;
    window.removeEventListener(MEASURE.event, onMark);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('change', onChange, true);
    document.removeEventListener('visibilitychange', onVisibility);
  }
  return { state: s, record, startFrames, dispose };
}

let shared: ReturnType<typeof createMeasure> | null = null;
/** 이 탭에서 한 번만 만든다. 화면이 다시 그려져도 값과 열기 횟수는 그대로다 */
export function useMeasure() { return (shared ??= createMeasure()); }
