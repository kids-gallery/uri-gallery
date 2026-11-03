// 작품 입체화(3D미술관_재설계 §2-3): 배경 지우기 → 윤곽 → 두께 있는 입체. 브라우저에서만 처리한다.
// 서버 모델(M1 분리 · M5 깊이)로 바꿀 때는 removeBackground()와 buildRelief()만 바꿔 끼운다.
import * as THREE from 'three';

export const WORK_SIDE = 384; // 배경 지우기 계산 해상도(긴 변)
export const DISPLAY_SIDE = 1024; // 화면 질감 해상도(긴 변)

export interface Mask { w: number; h: number; data: Uint8Array; ok: boolean; ratio: number; surface?: Surface }

export async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // 디코드가 끝난 뒤에는 주소가 없어도 그려진다
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function fit(w: number, h: number, side: number): { w: number; h: number } {
  const s = Math.min(1, side / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

export function drawToCanvas(img: CanvasImageSource & { width: number; height: number }, side: number): HTMLCanvasElement {
  const iw = (img as HTMLImageElement).naturalWidth || img.width;
  const ih = (img as HTMLImageElement).naturalHeight || img.height;
  const { w, h } = fit(iw, ih, side);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return c;
}

/**
 * 배경 지우기 조정값(§2-18·§2-19). 근거는 docs/개인_이제민/출시준비_REA.md 3절의 비교 실험이다.
 * 길이는 모두 계산 해상도 긴 변에 대한 비율이다.
 */
export const CUTOUT = {
  /** 조명 펴기: 종이 바탕 밝기를 재는 범위. 이보다 큰 색칠 면은 바탕으로 읽힐 수 있다 */
  lightWindow: 0.06,
  /** 틈 메우기 첫 반지름(384px에서 5px). 반지름의 두 배 폭까지 틈을 막는다 */
  gapStart: 0.012,
  /** 첫 반지름의 1배부터 이 배수까지 키워 본다(4배면 긴 변의 약 9.6% 틈까지) */
  gapSteps: 4,
  /** 채운 넓이가 메우기 전의 이 배수 이상이면 '막힌 안쪽이 생겼다'고 보고 멈춘다 */
  gapGain: 1.5,
} as const;

/**
 * 조명 펴기(§2-19). 밝기의 넓은 범위 최댓값(선과 작은 색칠은 사라진다)을 흐리게 해 종이 바탕의 밝기로 보고,
 * 픽셀마다 그 값으로 나눠 그늘진 종이도 흰 종이처럼 만든다. 문서 스캔 앱의 그림자 지우기와 같은 원리다.
 */
export function flattenLight(px: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const r = Math.max(4, Math.round(Math.max(w, h) * CUTOUT.lightWindow));
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (px[i * 4]! * 299 + px[i * 4 + 1]! * 587 + px[i * 4 + 2]! * 114) / 1000;
  const tmp = new Float32Array(w * h), M = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.max(m, L[y * w + k]!);
    tmp[y * w + x] = m;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let m = 0;
    for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.max(m, tmp[k * w + x]!);
    M[y * w + x] = m;
  }
  const S = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += M[y * w + x]!; S[(y + 1) * (w + 1) + x + 1] = S[y * (w + 1) + x + 1]! + row; } }
  const out = new Uint8ClampedArray(px.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    const bg = (S[y1 * (w + 1) + x1]! - S[y0 * (w + 1) + x1]! - S[y1 * (w + 1) + x0]! + S[y0 * (w + 1) + x0]!) / ((x1 - x0) * (y1 - y0));
    const k = 255 / Math.max(16, bg), i = (y * w + x) * 4;
    out[i] = px[i]! * k; out[i + 1] = px[i + 1]! * k; out[i + 2] = px[i + 2]! * k; out[i + 3] = px[i + 3]!;
  }
  return out;
}

/** 비교 실험(web/scripts/cutout-eval.mjs)에서 단계를 끌 때만 쓴다. 앱은 기본값(둘 다 켬)을 쓴다 */
export interface CutoutOptions { flatten?: boolean; closeGaps?: boolean }

/**
 * 배경 지우기 순서(§2-18·§2-19): ① 조명 펴기 → ② 가장자리 픽셀의 중앙값을 종이색으로 보고 가장자리에서 이어지는 비슷한 색을
 * 배경으로 칠하기(flood fill) → ③ 윤곽선 틈 메우기와 안쪽 채우기 → ④ 잡티·작은 덩어리 지우기.
 */
export function removeBackground(src: HTMLCanvasElement, opts: CutoutOptions = {}): Mask {
  const w = src.width, h = src.height;
  const raw = src.getContext('2d')!.getImageData(0, 0, w, h).data;
  const px = opts.flatten === false ? raw : flattenLight(raw, w, h);
  const border: number[][] = [[], [], []];
  const take = (x: number, y: number) => { const i = (y * w + x) * 4; border[0]!.push(px[i]!); border[1]!.push(px[i + 1]!); border[2]!.push(px[i + 2]!); };
  for (let x = 0; x < w; x++) { take(x, 0); take(x, h - 1); }
  for (let y = 0; y < h; y++) { take(0, y); take(w - 1, y); }
  const med = border.map((a) => a.sort((p, q) => p - q)[a.length >> 1] ?? 255);
  // 가장자리 색의 퍼짐으로 허용 거리를 정한다(조명 얼룩이 있는 사진도 받도록)
  let spread = 0;
  for (let i = 0; i < border[0]!.length; i++) {
    const d = Math.hypot(border[0]![i]! - med[0]!, border[1]![i]! - med[1]!, border[2]![i]! - med[2]!);
    spread += d;
  }
  spread /= Math.max(1, border[0]!.length);
  const tol = Math.min(90, Math.max(38, spread * 2.5 + 20));
  const bgLike = (i: number) => Math.hypot(px[i * 4]! - med[0]!, px[i * 4 + 1]! - med[1]!, px[i * 4 + 2]! - med[2]!) < tol;

  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (i: number) => { if (!bg[i] && bgLike(i)) { bg[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (y > 0) seed(i - w);
    if (y < h - 1) seed(i + w);
  }
  // 전경 = 배경이 아닌 것(안쪽 구멍은 가장자리와 이어지지 않으니 전경으로 채워진다)
  let fg: Uint8Array = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) fg[i] = bg[i] ? 0 : 1;
  // 윤곽선에 틈이 있으면 이어 칠하기가 안쪽 색칠까지 지운다. 틈을 막고 안쪽을 다시 채운다(§2-18)
  if (opts.closeGaps !== false) fg = closeOutline(fg, w, h);
  fg = open(fg, w, h);
  fg = keepLargeComponents(fg, w, h);
  let n = 0;
  for (let i = 0; i < w * h; i++) n += fg[i]!;
  const ratio = n / (w * h);
  return { w, h, data: fg, ok: ratio >= 0.03 && ratio <= 0.95, ratio };
}

/** 각 칸에서 가장 가까운 전경 칸까지의 거리(두 번 훑는 근사 유클리드 거리, 가로세로 1 · 대각 √2) */
function distanceTo(m: Uint8Array, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h), D = Math.SQRT2;
  for (let i = 0; i < w * h; i++) d[i] = m[i] ? 0 : 1e9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    let v = d[i]!;
    if (x > 0) v = Math.min(v, d[i - 1]! + 1);
    if (y > 0) {
      v = Math.min(v, d[i - w]! + 1);
      if (x > 0) v = Math.min(v, d[i - w - 1]! + D);
      if (x < w - 1) v = Math.min(v, d[i - w + 1]! + D);
    }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    let v = d[i]!;
    if (x < w - 1) v = Math.min(v, d[i + 1]! + 1);
    if (y < h - 1) {
      v = Math.min(v, d[i + w]! + 1);
      if (x < w - 1) v = Math.min(v, d[i + w + 1]! + D);
      if (x > 0) v = Math.min(v, d[i + w - 1]! + D);
    }
    d[i] = v;
  }
  return d;
}

function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const d = distanceTo(m, w, h), out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = d[i]! <= r ? 1 : 0;
  return out;
}

/**
 * 틈 메우기(§2-18). 전경을 r칸 불려 폭 약 2r 이하의 틈을 막고, 가장자리와 이어지지 않는 안쪽을 찾는다.
 * 그 안쪽을 r칸 다시 불려 원래 전경과 합친다. 바깥(가장자리와 이어진 곳)으로는 넓히지 않는다. 입력·출력은 0/1.
 */
export function fillEnclosed(fg: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const grown = dilate(fg, w, h, r);
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const seed = (i: number) => { if (!grown[i] && !outside[i]) { outside[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (y > 0) seed(i - w);
    if (y < h - 1) seed(i + w);
  }
  const inner = new Uint8Array(w * h);
  let any = false;
  for (let i = 0; i < w * h; i++) if (!grown[i] && !outside[i]) { inner[i] = 1; any = true; }
  if (!any) return fg;
  const back = dilate(inner, w, h, r);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = fg[i] || (back[i] && !outside[i]) ? 1 : 0;
  return out;
}

/**
 * §2-18: 메우기 반지름을 CUTOUT.gapStart부터 gapSteps배까지 키워 가며, 채운 넓이가 메우기 전의 gapGain배 이상이 되는 첫 반지름에서 멈춘다.
 * 작은 반지름을 먼저 써서 귀 사이처럼 일부러 벌어진 곳은 메우지 않는다. 끝까지 안 되면 가장 작은 반지름의 결과를 쓴다.
 */
export function closeOutline(fg: Uint8Array, w: number, h: number): Uint8Array {
  const r0 = Math.max(2, Math.round(Math.max(w, h) * CUTOUT.gapStart));
  let before = 0;
  for (let i = 0; i < w * h; i++) before += fg[i]!;
  let first: Uint8Array | null = null;
  for (let k = 1; k <= CUTOUT.gapSteps; k++) {
    const filled = fillEnclosed(fg, w, h, r0 * k);
    first ??= filled;
    let n = 0;
    for (let i = 0; i < w * h; i++) n += filled[i]!;
    if (n >= before * CUTOUT.gapGain) return filled;
  }
  return first!;
}

/** 잡티 지우기: 1픽셀 깎았다가 다시 불린다 */
function open(m: Uint8Array, w: number, h: number): Uint8Array {
  const er = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    er[i] = m[i] && m[i - 1] && m[i + 1] && m[i - w] && m[i + w] ? 1 : 0;
  }
  const di = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    di[i] = er[i] || er[i - 1] || er[i + 1] || er[i - w] || er[i + w] ? 1 : 0;
  }
  return di;
}

/** 덩어리 중 전경의 2% 이상인 것만 남긴다(최대 8개). 각 칸에 덩어리 번호(1~)를 적어 돌려준다. */
function keepLargeComponents(m: Uint8Array, w: number, h: number): Uint8Array {
  const label = new Int32Array(w * h);
  const sizes: number[] = [0];
  let total = 0;
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || label[i]) continue;
    const id = sizes.length;
    let size = 0;
    const st = [i];
    label[i] = id;
    while (st.length) {
      const j = st.pop()!;
      size++;
      const x = j % w, y = (j / w) | 0;
      const nb = [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1];
      for (const k of nb) if (k >= 0 && m[k] && !label[k]) { label[k] = id; st.push(k); }
    }
    sizes.push(size);
    total += size;
  }
  const keep = sizes
    .map((s, id) => ({ s, id }))
    .filter((c) => c.id > 0 && c.s >= Math.max(30, total * 0.02))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8);
  const order = new Map(keep.map((c, k) => [c.id, k + 1]));
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = order.get(label[i]!) ?? 0;
  return out;
}

const DX = [1, 0, 1, 1, -1, 0, -1, 1, 0, 0, 0, 0, -1, 0, -1, NaN];
const DY = [0, -1, 0, 0, 0, -1, 0, 0, 1, -1, 1, 1, 0, -1, 0, NaN];

/** 덩어리 하나의 바깥 윤곽(marching squares, 픽셀 모서리 격자). */
function traceOuter(m: Uint8Array, w: number, h: number, id: number): Array<[number, number]> {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === id;
  let sx = -1, sy = -1;
  for (let i = 0; i < w * h && sx < 0; i++) if (m[i] === id) { sx = i % w; sy = (i / w) | 0; }
  if (sx < 0) return [];
  const pts: Array<[number, number]> = [];
  let x = sx, y = sy, pdx = NaN, pdy = NaN, guard = 0;
  do {
    let k = 0;
    if (at(x - 1, y - 1)) k += 1;
    if (at(x, y - 1)) k += 2;
    if (at(x - 1, y)) k += 4;
    if (at(x, y)) k += 8;
    let dx: number, dy: number;
    if (k === 6) { dx = pdy === -1 ? -1 : 1; dy = 0; }
    else if (k === 9) { dx = 0; dy = pdx === 1 ? -1 : 1; }
    else { dx = DX[k]!; dy = DY[k]!; }
    if (Number.isNaN(dx)) break;
    if (dx !== pdx && dy !== pdy) { pts.push([x, y]); pdx = dx; pdy = dy; }
    x += dx; y += dy;
  } while ((x !== sx || y !== sy) && ++guard < w * h * 4);
  return pts;
}

/** 점 줄이기(Douglas-Peucker, 닫힌 선) */
export function simplify(pts: Array<[number, number]>, eps: number): Array<[number, number]> {
  if (pts.length < 8) return pts;
  const rdp = (a: Array<[number, number]>): Array<[number, number]> => {
    if (a.length < 3) return a;
    const [x1, y1] = a[0]!, [x2, y2] = a[a.length - 1]!;
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    let dmax = 0, idx = 0;
    for (let i = 1; i < a.length - 1; i++) {
      const [x, y] = a[i]!;
      const d = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / L;
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax <= eps) return [a[0]!, a[a.length - 1]!];
    const l = rdp(a.slice(0, idx + 1));
    return [...l.slice(0, -1), ...rdp(a.slice(idx))];
  };
  const half = pts.length >> 1;
  const out = [...rdp(pts.slice(0, half + 1)).slice(0, -1), ...rdp([...pts.slice(half), pts[0]!]).slice(0, -1)];
  return out.length >= 3 ? out : pts;
}

export function contours(mask: Mask): Array<Array<[number, number]>> {
  if (!mask.ok) return [];
  let maxId = 0;
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i]! > maxId) maxId = mask.data[i]!;
  const out: Array<Array<[number, number]>> = [];
  for (let id = 1; id <= maxId; id++) {
    const c = simplify(traceOuter(mask.data, mask.w, mask.h, id), 0.9);
    if (c.length >= 3) out.push(c);
  }
  return out;
}

/** 화면용 그림(배경 투명). 마스크를 부드럽게 키워 알파로 쓴다. */
export function cutoutCanvas(display: HTMLCanvasElement, mask: Mask): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = display.width; c.height = display.height;
  const ctx = c.getContext('2d')!;
  if (!mask.ok) { ctx.drawImage(display, 0, 0); return c; }
  const mc = document.createElement('canvas');
  mc.width = mask.w; mc.height = mask.h;
  const mctx = mc.getContext('2d')!;
  const id = mctx.createImageData(mask.w, mask.h);
  for (let i = 0; i < mask.data.length; i++) { id.data[i * 4 + 3] = mask.data[i] ? 255 : 0; }
  mctx.putImageData(id, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(mc, 0, 0, c.width, c.height);
  ctx.globalCompositeOperation = 'source-in';
  ctx.drawImage(display, 0, 0);
  return c;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png', q?: number): Promise<Blob> {
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), type, q));
}

/** 서버 깊이로 만드는 둥근 입체(마스터플랜 3-6). 값은 여기 한 곳에만 둔다 */
export const RELIEF_SURFACE = {
  /** 격자의 긴 변(칸). 작품 하나의 삼각형 수를 정한다 */
  grid: 128,
  /** 앞면 최대 높이(작품 높이 대비) */
  thickness: 0.2,
  /** 깊이가 가장 먼 곳의 앞면 높이 비율. 0이면 먼 곳이 납작해진다 */
  base: 0.35,
  /** 가장자리에서 둥글어지는 폭(긴 변 대비) */
  taper: 0.07,
  /** 뒷면 두께(앞면 대비) */
  back: 0.6,
} as const;

export interface Surface { w: number; h: number; data: Float32Array }

/** 깊이 그림 → 격자 크기의 0~1 값. 화면에서는 8비트면 충분하다 */
export async function surfaceFromBlob(blob: Blob, side: number = RELIEF_SURFACE.grid): Promise<Surface> {
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
  const { w, h } = fit(bmp.width, bmp.height, side);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const px = ctx.getImageData(0, 0, w, h).data, data = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = px[i * 4]! / 255;
  return { w, h, data };
}

/** 안쪽 칸마다 바깥까지의 거리(칸). 앞뒤 두 번 훑는 근사다 */
function insideDistance(inside: Uint8Array, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h), far = w + h, D = Math.SQRT2;
  for (let i = 0; i < w * h; i++) d[i] = inside[i] ? far : 0;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]!);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside[y * w + x]) d[y * w + x] = Math.min(d[y * w + x]!, at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + D, at(x + 1, y - 1) + D);
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) if (inside[y * w + x]) d[y * w + x] = Math.min(d[y * w + x]!, at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + D, at(x - 1, y + 1) + D);
  return d;
}

/** 앞뒤 두 장을 만든다. 가장자리에서 높이가 0이 되어 두 장이 만나고, 실제 윤곽은 마스크가 자른다 */
export function surfaceGeometry(mask: Mask, s: Surface, W: number, H: number): { geo: THREE.BufferGeometry; depth: number } {
  const { w, h, data } = s, R = RELIEF_SURFACE, inside = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) inside[y * w + x] = mask.data[Math.floor((y + 0.5) / h * mask.h) * mask.w + Math.floor((x + 0.5) / w * mask.w)]!;
  const dist = insideDistance(inside, w, h), taper = Math.max(1, R.taper * Math.max(w, h)), on = new Uint8Array(w * h), z = new Float32Array(w * h);
  let top = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!inside[i]) continue;
    for (let b = Math.max(0, y - 1); b <= Math.min(h - 1, y + 1); b++) for (let a = Math.max(0, x - 1); a <= Math.min(w - 1, x + 1); a++) on[b * w + a] = 1;
    const t = Math.min(1, Math.max(0, dist[i]! - 1) / taper), round = Math.sqrt(1 - (1 - t) ** 2);
    z[i] = H * R.thickness * (R.base + (1 - R.base) * data[i]!) * round;
    top = Math.max(top, z[i]!);
  }
  const index = new Int32Array(w * h).fill(-1), pos: number[] = [], uv: number[] = [];
  const mid = top * (1 - R.back) / 2;
  for (let sheet = 0; sheet < 2; sheet++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!on[i]) continue;
    if (!sheet) index[i] = pos.length / 3;
    pos.push(((x + 0.5) / w - 0.5) * W, (0.5 - (y + 0.5) / h) * H, (sheet ? -R.back * z[i]! : z[i]!) - mid);
    uv.push((x + 0.5) / w, 1 - (y + 0.5) / h);
  }
  const n = pos.length / 6, faces: number[] = [];
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const a = index[y * w + x]!, b = index[y * w + x + 1]!, c = index[(y + 1) * w + x]!, d = index[(y + 1) * w + x + 1]!;
    if (a < 0 || b < 0 || c < 0 || d < 0) continue;
    faces.push(a, c, b, b, c, d, a + n, b + n, c + n, b + n, d + n, c + n);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(faces);
  geo.computeVertexNormals();
  return { geo, depth: top * (1 + R.back) };
}

/** 마스크를 윤곽을 자르는 알파 지도로 바꾼다. 행 0이 v=0이므로 위아래를 뒤집는다 */
function maskAlpha(mask: Mask): THREE.DataTexture {
  const px = new Uint8Array(mask.w * mask.h * 4);
  for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
    const v = mask.data[(mask.h - 1 - y) * mask.w + x] ? 255 : 0, o = (y * mask.w + x) * 4;
    px[o] = px[o + 1] = px[o + 2] = v; px[o + 3] = 255;
  }
  const t = new THREE.DataTexture(px, mask.w, mask.h);
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

export interface ReliefOptions { height: number; depth?: number }

/**
 * 두께 있는 입체. 윤곽이 없으면 사각형 판. 모든 면의 UV를 그림 위치로 맞춰, 옆면은 가장자리 색을 띤다.
 * 반환 그룹의 원점은 바닥 가운데가 아니라 그림 가운데다.
 */
export function buildRelief(texture: THREE.Texture, mask: Mask | null, aspect: number, opts: ReliefOptions): THREE.Mesh {
  const H = opts.height;
  const W = H * aspect;
  if (mask?.surface) {
    const { geo, depth } = surfaceGeometry(mask, mask.surface, W, H), alphaMap = maskAlpha(mask);
    const mat = new THREE.MeshStandardMaterial({ map: texture, alphaMap, alphaTest: 0.5, roughness: 0.75, metalness: 0, emissive: new THREE.Color(0xffffff), emissiveMap: texture, emissiveIntensity: 0.18 });
    mat.addEventListener('dispose', () => alphaMap.dispose());
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.size = { w: W, h: H, d: depth };
    return mesh;
  }
  const depth = opts.depth ?? Math.max(0.03, H * 0.045);
  const shapes: THREE.Shape[] = [];
  const cs = mask ? contours(mask) : [];
  if (cs.length && mask) {
    for (const c of cs) {
      const s = new THREE.Shape();
      c.forEach(([x, y], i) => {
        const X = (x / mask.w - 0.5) * W;
        const Y = (0.5 - y / mask.h) * H;
        if (i === 0) s.moveTo(X, Y); else s.lineTo(X, Y);
      });
      s.closePath();
      shapes.push(s);
    }
  } else {
    const s = new THREE.Shape();
    s.moveTo(-W / 2, -H / 2); s.lineTo(W / 2, -H / 2); s.lineTo(W / 2, H / 2); s.lineTo(-W / 2, H / 2); s.closePath();
    shapes.push(s);
  }
  const bevel = Math.min(depth * 0.35, 0.02);
  const geo = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 1, curveSegments: 1 });
  geo.translate(0, 0, -depth / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / W + 0.5;
    uv[i * 2 + 1] = pos.getY(i) / H + 0.5;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.75, metalness: 0, emissive: new THREE.Color(0xffffff), emissiveMap: texture, emissiveIntensity: 0.18 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.size = { w: W, h: H, d: depth };
  return mesh;
}

/** 마스크 → 원본 비율의 사본(저장용 · 다시 만들 때 같은 결과) */
export function maskFromCutout(cut: HTMLCanvasElement, side = WORK_SIDE): Mask {
  const { w, h } = fit(cut.width, cut.height, side);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(cut, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = d[i * 4 + 3]! > 127 ? 1 : 0;
  const lab = keepLargeComponents(m, w, h);
  let n = 0;
  for (let i = 0; i < w * h; i++) n += lab[i] ? 1 : 0;
  const ratio = n / (w * h);
  return { w, h, data: lab, ok: ratio >= 0.03 && ratio <= 0.98, ratio };
}
