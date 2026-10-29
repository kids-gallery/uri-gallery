// 실제 사진 시험 세트 평가(3D미술관_재설계 2-22의 12번, 지시문 2의 5번 "수정 전 기록" 준비). 로컬 확인 전용.
// 사용: 개발 서버(기본 http://127.0.0.1:9501, 다르면 WORLD_URL)를 켠 뒤 `node web/scripts/photo-set-eval.mjs [--dir <사진 폴더>] [--out <결과 JSON>]`
// 정답이 있는 사진마다 지금 앱의 배경 지우기(cutout.ts 기본값 E)를 돌려 촬영 조건별 표를 낸다. 알고리즘은 옮겨 적지 않고 cutout.ts를 그대로 부른다.
// cutout-eval.mjs처럼 개발 서버가 변환한 /src/app/world/cutout.ts를 브라우저에서 import한다. 3D 화면은 띄우지 않고 같은 주소의 빈 페이지에서
// 부른다(무겁지 않고, 다른 화면 파일이 고쳐져도 페이지가 새로 고쳐지지 않는다). 순서는 앱의 올리기(store.ts processImage)와 같다:
// blobToImage → drawToCanvas(WORK_SIDE) → removeBackground. IoU는 그 마스크와, 정답 바깥선(outline + extraOutlines)을 같은 해상도로 칠한
// 넓이를 비교한다. ok=false여도 IoU는 마스크 그대로 재고 실패로 센다. 정답 좌표 규칙은 label-photos.mjs 머리말에 있다.
// 모서리 오차는 모서리 찾기를 아직 만들지 않아 "미구현"이다(사진과 정답이 들어온 뒤 기준값을 먼저 고정하고 만든다, 2-19 기준 2의 ②).
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { DEFAULT_DIR, MIN_TOTAL, PHOTO_TYPES, REPO, parseArgs, scanPhotoSet } from './label-photos.mjs';

/** 판정 기준(표). 값을 바꾸려면 측정 전에 바꾼다(지시문 2의 4번) */
const JUDGE = {
  /** IoU가 이 값 미만이면 실패로 센다 */
  failIouBelow: 0.5,
  /** 앱이 배경을 찾지 못했다고 본 사진(ok=false, 앱은 사각형 두께판으로 건다)을 실패로 센다 */
  failWhenNotOk: true,
  /** 정답과 평가에서 읽은 사진의 가로세로 비가 이 비율보다 더 다르면 방향이 다르게 읽힌 것으로 보고 평가에서 뺀다 */
  aspectTolerance: 0.02,
};
const CUTOUT_SRC = resolve(REPO, 'web/src/app/world/cutout.ts');
const BLANK = '/__photo-set-eval__';

/** 브라우저 안에서 사진 한 장을 잰다. 앱의 올리기 경로와 같은 함수를 같은 순서로 부른다 */
async function measure({ b64, type, label, tol }) {
  const cut = await import('/src/app/world/cutout.ts');
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  let img;
  try { img = await cut.blobToImage(new Blob([bytes], { type })); } catch { return { error: 'open' }; }
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (Math.abs(iw / ih - label.width / label.height) > tol * (label.width / label.height)) return { error: 'aspect', iw, ih };
  const work = cut.drawToCanvas(img, cut.WORK_SIDE);
  const t0 = performance.now();
  const m = cut.removeBackground(work);
  const ms = Math.round(performance.now() - t0);
  // 정답 바깥선을 마스크 해상도로 칠한다(원본 좌표 → 비율로 축소)
  const g = document.createElement('canvas');
  g.width = m.w; g.height = m.h;
  const gx = g.getContext('2d');
  const sx = m.w / label.width, sy = m.h / label.height;
  gx.fillStyle = '#000';
  for (const poly of [label.outline, ...(label.extraOutlines ?? [])]) {
    gx.beginPath();
    poly.forEach(([x, y], i) => (i ? gx.lineTo(x * sx, y * sy) : gx.moveTo(x * sx, y * sy)));
    gx.closePath();
    gx.fill();
  }
  const gt = gx.getImageData(0, 0, m.w, m.h).data;
  let inter = 0, uni = 0, extra = 0, miss = 0;
  for (let i = 0; i < m.w * m.h; i++) {
    const a = m.data[i] ? 1 : 0, b = gt[i * 4 + 3] > 127 ? 1 : 0;
    inter += a & b; uni += a | b; extra += a & (1 - b); miss += b & (1 - a);
  }
  const gtN = inter + miss;
  return { iw, ih, w: m.w, h: m.h, ok: m.ok, ratio: m.ratio, iou: inter / Math.max(1, uni), extra: extra / Math.max(1, gtN), miss: miss / Math.max(1, gtN), ms };
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const sha = () => createHash('sha256').update(readFileSync(CUTOUT_SRC)).digest('hex');

function judge(c, p, r) {
  const L = p.saved.label;
  const row = { file: `${c.id}/${p.name}`, condition: c.id, label: [L.width, L.height], hasCorners: Boolean(L.corners), cornerError: null };
  if (r.error === 'open') return { ...row, error: '사진을 열지 못함(앱은 사각형 두께판으로 건다)', fail: true };
  if (r.error === 'aspect') return { ...row, error: `정답(${L.width}×${L.height})과 읽은 사진(${r.iw}×${r.ih})의 방향이 다름. 정답을 다시 표시`, excluded: true };
  const fail = (JUDGE.failWhenNotOk && !r.ok) || r.iou < JUDGE.failIouBelow;
  return { ...row, read: [r.iw, r.ih], mask: [r.w, r.h], ok: r.ok, ratio: r3(r.ratio), iou: r3(r.iou), extra: r3(r.extra), miss: r3(r.miss), ms: r.ms, fail };
}

function summarize(label, rows, photoCount) {
  const scored = rows.filter((x) => typeof x.iou === 'number');
  return {
    label,
    photos: photoCount,
    labeled: rows.length,
    meanIoU: scored.length ? r3(scored.reduce((s, x) => s + x.iou, 0) / scored.length) : null,
    fails: rows.filter((x) => x.fail).length,
    excluded: rows.filter((x) => x.excluded).length,
    cornersLabeled: rows.filter((x) => x.hasCorners).length,
    cornerError: '미구현',
  };
}

const args = parseArgs(process.argv.slice(2), ['dir', 'out']);
if (!args) {
  console.error('사용: node web/scripts/photo-set-eval.mjs [--dir <사진 폴더>] [--out <결과 JSON>]');
  process.exit(2);
}
const dir = resolve(args.dir ?? DEFAULT_DIR);
const base = process.env.WORLD_URL ?? 'http://127.0.0.1:9501';
const set = scanPhotoSet(dir);
const photos = set.conditions.flatMap((c) => c.photos.map((p) => ({ c, p })));
const todo = photos.filter((x) => x.p.saved?.label);
if (!todo.length) {
  console.log(existsSync(dir)
    ? `정답을 표시한 사진이 없습니다(사진 ${photos.length}장, 폴더 ${dir}).`
    : `사진 폴더가 없습니다: ${dir} (label-photos.mjs를 한 번 켜면 조건별 폴더가 만들어집니다).`);
  console.log('사진을 촬영 조건별 폴더에 넣고 `node web/scripts/label-photos.mjs`로 정답을 표시한 뒤 다시 돌려 주세요.');
  process.exit(0);
}

const before = sha();
try {
  const r = await fetch(`${base}/src/app/world/cutout.ts`);
  if (!r.ok) throw new Error(String(r.status));
} catch {
  console.error(`개발 서버가 필요합니다: web에서 npm run dev (지금 찾은 주소 ${base}, 다르면 WORLD_URL로 알려 주세요)`);
  process.exit(2);
}

const browser = await chromium.launch();
const rows = [];
let method;
try {
  const page = await browser.newPage();
  await page.route(`${base}${BLANK}`, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><title>photo-set-eval</title>' }));
  await page.goto(`${base}${BLANK}`);
  method = await page.evaluate(async () => {
    const cut = await import('/src/app/world/cutout.ts');
    return { WORK_SIDE: cut.WORK_SIDE, CUTOUT: { ...cut.CUTOUT } };
  });
  // 한 장씩 보낸다(사진이 커도 한 번에 메모리에 다 올리지 않는다)
  for (const { c, p } of todo) {
    const b64 = readFileSync(join(dir, c.id, p.name)).toString('base64');
    const r = await page.evaluate(measure, { b64, type: PHOTO_TYPES[extname(p.name).toLowerCase()], label: p.saved.label, tol: JUDGE.aspectTolerance });
    rows.push(judge(c, p, r));
  }
} finally {
  await browser.close();
}
const after = sha();

const table = set.conditions.map((c) => ({ id: c.id, min: c.min, ...summarize(c.label, rows.filter((x) => x.condition === c.id), c.photos.length) }));
const total = summarize('전체', rows, photos.length);
const notLabeled = photos.filter((x) => !x.p.saved).map((x) => `${x.c.id}/${x.p.name}`);
const badLabels = photos.filter((x) => x.p.saved?.error).map((x) => ({ file: `${x.c.id}/${x.p.name}`, error: x.p.saved.error }));
const unsupported = set.conditions.flatMap((c) => c.unsupported.map((n) => `${c.id}/${n}`));
const short = table.filter((t) => t.photos < t.min).map((t) => `${t.label} ${t.photos}/${t.min}장`);

console.log(`실제 사진 시험 세트 평가: 방식 E(cutout.ts 기본값), 계산 해상도 긴 변 ${method.WORK_SIDE}px, cutout.ts sha256 ${before.slice(0, 12)}`);
console.log(`사진 폴더: ${dir}`);
console.log('');
console.log('| 조건 | 장수 | 정답 있는 장수 | IoU 평균 | 실패 수 | 모서리 오차 |');
console.log('|---|---:|---:|---:|---:|---|');
for (const t of [...table, total]) {
  console.log(`| ${t.label} | ${t.photos} | ${t.labeled} | ${t.meanIoU === null ? '-' : t.meanIoU.toFixed(3)} | ${t.labeled ? t.fails : '-'} | ${t.cornerError} |`);
}
console.log('');
console.log(`실패 기준: IoU ${JUDGE.failIouBelow} 미만${JUDGE.failWhenNotOk ? ', 또는 앱이 배경을 찾지 못함(ok=false, 앱은 사각형 두께판으로 건다)' : ''}. IoU 평균은 잰 사진만의 평균이고, 전체 줄은 사진 단위 평균이다.`);
const failed = rows.filter((x) => x.fail);
if (failed.length) {
  console.log('실패한 사진');
  for (const x of failed) console.log(`- ${x.file}: ${x.error ?? `IoU ${x.iou.toFixed(3)}${x.ok ? '' : ', 배경을 찾지 못함'}. 정답 넓이를 1로 볼 때 정답 밖으로 더 남은 넓이 ${x.extra}, 놓친 넓이 ${x.miss}`}`);
}
const excluded = rows.filter((x) => x.excluded);
if (excluded.length) {
  console.log('평가에서 뺀 사진');
  for (const x of excluded) console.log(`- ${x.file}: ${x.error}`);
}
if (notLabeled.length) console.log(`정답을 아직 표시하지 않은 사진 ${notLabeled.length}장: ${notLabeled.join(', ')}`);
if (badLabels.length) console.log(`정답 파일이 맞지 않아 뺀 사진: ${badLabels.map((b) => `${b.file}(${b.error})`).join(', ')}`);
if (unsupported.length) console.log(`열 수 없는 형식이라 뺀 사진(JPG로 바꿔 넣기): ${unsupported.join(', ')}`);
if (set.strays.length) console.log(`조건 폴더 밖에 있어 뺀 것: ${set.strays.join(', ')}`);
console.log(`모은 사진 ${photos.length}장, 목표 ${MIN_TOTAL}장 이상${short.length ? `. 장수가 모자란 조건: ${short.join(', ')}` : ''}`);
if (before !== after) console.log('주의: 평가하는 동안 cutout.ts가 바뀌었습니다. 결과를 버리고 다시 돌려 주세요.');

if (args.out) {
  const out = resolve(args.out);
  mkdirSync(dirname(out), { recursive: true });
  const result = {
    createdAt: new Date().toISOString(),
    photoDir: dir,
    method: { name: 'E(cutout.ts 기본값)', file: 'web/src/app/world/cutout.ts', sha256: before, changedDuringRun: before !== after, ...method },
    judge: JUDGE,
    minTotal: MIN_TOTAL,
    conditions: table,
    total,
    photos: rows,
    notLabeled,
    badLabels,
    unsupported,
    strays: set.strays,
  };
  writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`결과 JSON: ${out}`);
}
