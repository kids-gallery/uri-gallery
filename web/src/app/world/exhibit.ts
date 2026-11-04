// 전시용 판(마스터플랜 3-3 전시 목록): 걸린 부조는 벽에 자른 사진 대신 작품만 남긴 판을 건다.
// 컷아웃을 종이색 위에 놓고 색만 맞춘다. 그림을 다시 그리지 않는다. 원본은 보관함에 그대로 둔다.
const PAPER = [248, 244, 234] as const;
const MAX_GAIN = 1.35; // 어두운 작품(스크래치 등)을 억지로 밝히지 않는다
const BRIGHT = 0.95;   // 작품 안에서 이 분위의 밝기를 흰색 기준으로 삼는다

/** 알파가 있는 RGBA 화소에 종이색을 깔고 색을 맞춘다. 입력을 바꾸지 않는다 */
export function exhibitPixels(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let seen = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3]! < 128) continue;
    seen++;
    for (let c = 0; c < 3; c++) hist[c]![rgba[i + c]!]!++;
  }
  const gain = hist.map((h) => {
    let left = seen * BRIGHT, v = 0;
    while (v < 255 && left > h[v]!) left -= h[v++]!;
    return v ? Math.min(MAX_GAIN, Math.max(1, 245 / v)) : 1;
  });
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3]! / 255;
    for (let c = 0; c < 3; c++) out[i + c] = rgba[i + c]! * gain[c]! * a + PAPER[c]! * (1 - a);
    out[i + 3] = 255;
  }
  return out;
}

const SOLID = 128;     // 이 이상이면 종이가 있는 화소로 친다
const FULL = 250;      // 이 미만은 경계로 보고 다시 칠한다
const MIN_COVER = 0.6; // 남은 화소가 볼록 껍질의 이만큼도 안 되면 도화지가 아니라 그림만 따낸 것이다
const TRIM = 5;        // 구멍 둘레를 이만큼 깎는다. 손 색이 번지지 않게 한다
const RING = 24;       // 구멍 둘레 이 너비에서 도화지 색을 잰다
const GROW = 14;       // 구멍에 붙은 손 그림자처럼 도화지와 다른 색은 이 너비까지 함께 메꾼다
const NEAR = 90;       // 도화지 색과 RGB 합이 이만큼 안에서 다르면 도화지로 본다
const VIVID = 100;     // 채도가 이보다 높으면 손 그림자가 아니라 스티커나 그림으로 보고 남긴다
const SEAM = 8;        // 경계에서 이 너비에 걸쳐 둘레 색과 섞어 자국을 없앤다

/** 가장 큰 덩어리의 화소 표. 떨어진 티끌이 볼록 껍질을 키우지 않게 한다 */
function biggestPiece(rgba: Uint8ClampedArray, w: number, h: number): Uint8Array | null {
  const n = w * h, labels = new Int32Array(n), stack = new Int32Array(n);
  let id = 0, best = 0, bestSize = 0;
  for (let start = 0; start < n; start++) {
    if (labels[start] || rgba[start * 4 + 3]! < SOLID) continue;
    id++;
    let top = 0, size = 0;
    const visit = (q: number) => { if (!labels[q] && rgba[q * 4 + 3]! >= SOLID) { labels[q] = id; stack[top++] = q; } };
    visit(start);
    while (top) {
      const p = stack[--top]!, x = p % w;
      size++;
      if (x > 0) visit(p - 1);
      if (x < w - 1) visit(p + 1);
      if (p >= w) visit(p - w);
      if (p + w < n) visit(p + w);
    }
    if (size > bestSize) { bestSize = size; best = id; }
  }
  if (!best) return null;
  const piece = new Uint8Array(n);
  for (let p = 0; p < n; p++) if (labels[p] === best) piece[p] = 1;
  return piece;
}

/** 행마다 볼록 껍질의 왼쪽·오른쪽 끝. side=1이 오른쪽, -1이 왼쪽이다 */
function hullEdge(rows: number[], xs: number[], side: 1 | -1, h: number): Float64Array {
  const st: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    while (st.length >= 2) {
      const a = st[st.length - 2]!, b = st[st.length - 1]!;
      const cross = (rows[b]! - rows[a]!) * (xs[i]! - xs[a]!) - (xs[b]! - xs[a]!) * (rows[i]! - rows[a]!);
      if (cross * side >= 0) st.pop(); else break;
    }
    st.push(i);
  }
  const edge = new Float64Array(h).fill(NaN);
  for (let k = 0; k < st.length; k++) {
    const a = st[k]!, b = st[Math.min(k + 1, st.length - 1)]!;
    for (let y = rows[a]!; y <= rows[b]!; y++) edge[y] = rows[a] === rows[b] ? xs[a]! : xs[a]! + (xs[b]! - xs[a]!) * (y - rows[a]!) / (rows[b]! - rows[a]!);
  }
  return edge;
}

/** 구멍 둘레에서 가장 많은 색. 은박이나 무늬가 섞여도 도화지 색을 고른다(가운데 값은 두 색을 섞어 버린다) */
function ringColor(rgba: Uint8ClampedArray, hole: number[], width: number, around: (p: number) => number[], known: Uint8Array): number[] | null {
  const bins = new Uint32Array(4096), sums = new Float64Array(4096 * 3);
  const seen = new Set<number>();
  let edge = hole, best = -1;
  for (let t = 0; t < width && edge.length; t++) {
    const next: number[] = [];
    for (const p of edge) for (const n of around(p)) {
      if (!known[n] || seen.has(n)) continue;
      seen.add(n); next.push(n);
      const r = rgba[n * 4]!, g = rgba[n * 4 + 1]!, b = rgba[n * 4 + 2]!, bin = (r >> 4) << 8 | (g >> 4) << 4 | b >> 4;
      bins[bin]!++;
      sums[bin * 3]! += r; sums[bin * 3 + 1]! += g; sums[bin * 3 + 2]! += b;
      if (best < 0 || bins[bin]! > bins[best]!) best = bin;
    }
    edge = next;
  }
  if (best < 0) return null;
  return [0, 1, 2].map((c) => sums[best * 3 + c]! / bins[best]!);
}

/**
 * 도화지의 빈 자리(손을 지운 자리)를 둘레 도화지 색으로 메꾼다. 입력을 바꾸지 않는다. 입력을 바꾸지 않는다.
 * 메꿀 것이 없거나 도화지가 아니면 입력을 그대로 돌려준다.
 */
export function fillPaperHoles(rgba: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const piece = biggestPiece(rgba, w, h);
  if (!piece) return rgba;
  const rows: number[] = [], lefts: number[] = [], rights: number[] = [];
  let solid = 0;
  for (let y = 0; y < h; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) if (piece[y * w + x]) { if (l < 0) l = x; r = x; solid++; }
    if (l >= 0) { rows.push(y); lefts.push(l); rights.push(r); }
  }
  const left = hullEdge(rows, lefts, -1, h), right = hullEdge(rows, rights, 1, h);
  const inHull = new Uint8Array(w * h), known = new Uint8Array(w * h);
  const holes: number[] = [];
  let area = 0;
  for (const y of rows) {
    for (let x = Math.ceil(left[y]!); x <= Math.floor(right[y]!); x++) {
      const p = y * w + x;
      inHull[p] = 1; area++;
      if (rgba[p * 4 + 3]! >= FULL) known[p] = 1; else holes.push(p);
    }
  }
  if (!holes.length || solid / area < MIN_COVER) return rgba;
  const around = (p: number, all = false) => {
    const x = p % w, out = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
    if (all) out.push(x > 0 ? p - w - 1 : -1, x < w - 1 ? p - w + 1 : -1, x > 0 ? p + w - 1 : -1, x < w - 1 ? p + w + 1 : -1);
    return out.filter((n) => n >= 0 && n < w * h && inHull[n]);
  };
  const filled: number[] = [];
  let edge = holes;
  for (let t = 0; t < TRIM; t++) {
    const next: number[] = [];
    for (const p of edge) for (const n of around(p)) if (known[n]) { known[n] = 0; next.push(n); }
    edge = next;
  }
  const out = rgba.slice(), seen = new Uint8Array(w * h);
  const shadow = (p: number, c: number[]) => {
    const r = rgba[p * 4]!, g = rgba[p * 4 + 1]!, b = rgba[p * 4 + 2]!;
    return Math.max(r, g, b) - Math.min(r, g, b) < VIVID && Math.abs(r - c[0]!) + Math.abs(g - c[1]!) + Math.abs(b - c[2]!) > NEAR;
  };
  for (let start = 0; start < w * h; start++) {
    if (!inHull[start] || known[start] || seen[start]) continue;
    const hole = [start];
    seen[start] = 1;
    for (let i = 0; i < hole.length; i++) for (const n of around(hole[i]!)) if (!known[n] && !seen[n]) { seen[n] = 1; hole.push(n); }
    const paper = ringColor(rgba, hole, RING, around, known);
    if (!paper) continue;
    let grow = hole; // 도화지와 다른 색이 구멍에 붙어 있으면 손 그림자로 보고 함께 메꾼다
    for (let t = 0; t < GROW && grow.length; t++) {
      const next: number[] = [];
      for (const p of grow) for (const n of around(p)) if (known[n] && shadow(n, paper)) { known[n] = 0; seen[n] = 1; next.push(n); }
      hole.push(...next);
      grow = next;
    }
    for (const p of hole) { out.set(paper, p * 4); out[p * 4 + 3] = 255; }
    filled.push(...hole);
  }
  let layer = filled.filter((p) => around(p, true).some((n) => known[n]));
  for (let s = 0; s < SEAM && layer.length; s++) {
    const mix = (s + 1) / (SEAM + 1), next = new Set<number>();
    for (const p of layer) {
      const sum = [0, 0, 0];
      let n = 0;
      for (const q of around(p, true)) {
        if (!known[q]) { next.add(q); continue; }
        const gap = Math.abs(out[q * 4]! - out[p * 4]!) + Math.abs(out[q * 4 + 1]! - out[p * 4 + 1]!) + Math.abs(out[q * 4 + 2]! - out[p * 4 + 2]!);
        if (gap > NEAR) continue; // 작품 색은 섞지 않는다
        for (let c = 0; c < 3; c++) sum[c]! += out[q * 4 + c]!;
        n++;
      }
      if (n) for (let c = 0; c < 3; c++) out[p * 4 + c] = (sum[c]! / n) * (1 - mix) + out[p * 4 + c]! * mix;
    }
    for (const p of layer) known[p] = 1;
    layer = [...next];
  }
  return out;
}

/** 그림의 컷아웃 파일 → 손 자리를 메꾼 PNG. 크기는 그대로다. 메꿀 것이 없으면 받은 파일을 돌려준다 */
export async function fillPaperBlob(cutout: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(cutout);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas');
  g.drawImage(bmp, 0, 0);
  bmp.close();
  const data = g.getImageData(0, 0, c.width, c.height);
  const filled = fillPaperHoles(data.data, c.width, c.height);
  if (filled === data.data) return cutout;
  data.data.set(filled);
  g.putImageData(data, 0, 0);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('blob'))), 'image/png'));
}

/** 컷아웃 파일 → 벽에 걸 JPEG. 입체가 컷아웃 윤곽을 쓰므로 크기와 비율은 컷아웃과 같게 둔다 */
export async function exhibitBlob(cutout: Blob, maxSide = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(cutout);
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas');
  g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const data = g.getImageData(0, 0, c.width, c.height);
  data.data.set(exhibitPixels(data.data));
  g.putImageData(data, 0, 0);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('blob'))), 'image/jpeg', 0.92));
}
