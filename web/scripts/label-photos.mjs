// 실제 사진 정답 표시 도구(3D미술관_재설계 2-22의 12번). 개발용이며 이 컴퓨터(127.0.0.1)에서만 열린다. 배포본(src·public)과 무관하다.
// 사용: 저장소 맨 위에서 `node web/scripts/label-photos.mjs [--dir <사진 폴더>] [--port N]` 뒤 터미널에 나온 주소를 브라우저로 연다.
// 사진 폴더(기본 _claude/검증/실사진/, git 제외)에는 촬영 조건 id(photo-set/conditions.json)마다 하위 폴더가 있다. 처음 켜면 빈 폴더와 사진_넣는_법.txt를 만든다.
// 사람이 사진마다 종이 네 모서리와 그림 바깥선을 누르면 사진 옆 `<사진 이름>.label.json`에 저장하고, 사진 폴더의 목록.csv(사진 이름, 조건, 정답 여부)를 다시 쓴다.
//
// 정답 파일: { image, condition, width, height, corners, outline, extraOutlines?, labeledAt }
// - 좌표 규칙: 브라우저가 <img>로 보여 주는 그대로(EXIF 방향 적용, image-orientation: from-image)의 원본 픽셀 좌표다.
//   width·height는 그때의 naturalWidth·naturalHeight다. 원점은 왼쪽 위, x는 오른쪽, y는 아래로 커진다. 화면 축소 배율은 되돌려 정수로 저장한다.
//   평가(photo-set-eval.mjs)는 앱과 같은 방식(blobToImage)으로 읽은 사진 크기에 이 좌표를 비율로 옮긴다. 가로세로 비가 다르면
//   방향이 다르게 읽힌 것이므로 그 사진은 평가에서 빼고 알린다.
// - corners: 종이 네 모서리. 시계 방향, x+y가 가장 작은 점부터. 종이가 없거나 모서리가 사진 밖이면 null. paper=false 조건은 늘 null.
// - outline: 그림 바깥선을 따라 찍은 점(3점 이상). extraOutlines: 떨어진 조각의 바깥선(있을 때만). 평가는 둘을 합친 넓이를 정답으로 본다.
// 사진은 폴더에 실제로 있는 이름만 내주고, 바로가기로 폴더 밖을 가리키는 파일은 목록과 응답에서 뺀다.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = import.meta.dirname;
/** 저장소 맨 위(web/scripts의 두 단계 위) */
export const REPO = resolve(HERE, '../..');
export const DEFAULT_DIR = resolve(REPO, '_claude/검증/실사진');
const TABLE = JSON.parse(readFileSync(resolve(HERE, 'photo-set/conditions.json'), 'utf8'));
/** 촬영 조건 표(2-22의 12번). 코드는 표를 읽기만 한다 */
export const CONDITIONS = TABLE.conditions;
export const MIN_TOTAL = TABLE.minTotal;
/** 브라우저(평가용 Chromium 포함)가 바로 여는 사진 형식 */
export const PHOTO_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
/** 사진이지만 Chromium이 열지 못하는 형식. 목록에 "JPG로 바꿔 주세요"로 보인다 */
const OTHER_PHOTOS = new Set(['.heic', '.heif', '.dng', '.tif', '.tiff']);
const GUIDE = '사진_넣는_법.txt';
const LIST = '목록.csv';
const DEFAULT_PORT = 9590;
/** 저장 요청 한 번의 최대 크기와 바깥선 하나의 최대 점 수 */
const LIMIT = { body: 1 << 20, points: 5000, pieces: 50 };

/** `--dir x --port 1`, `--dir=x` 꼴 인자. 모르는 인자가 있으면 null */
export function parseArgs(argv, names) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([a-z]+)(?:=(.*))?$/.exec(argv[i]);
    if (!m || !names.includes(m[1])) return null;
    const v = m[2] ?? argv[++i];
    if (v === undefined) return null;
    out[m[1]] = v;
  }
  return out;
}

export const labelFile = (dir, condId, name) => join(dir, condId, `${name}.label.json`);

/** 사진 폴더 안의 실제 파일이면 그 경로, 아니면(바로가기로 밖을 가리킴, 폴더 등) null */
function inside(root, file) {
  try {
    const real = realpathSync(file);
    return real.startsWith(realpathSync(root) + sep) && statSync(real).isFile() ? real : null;
  } catch { return null; }
}

/** 사진 폴더를 읽는다. 조건 폴더 안의 사진만 센다. saved: 정답 없음 null, 정답 { label }, 맞지 않는 정답 { error } */
export function scanPhotoSet(dir) {
  const known = new Set(CONDITIONS.map((c) => c.id));
  const conditions = CONDITIONS.map((c) => {
    const folder = join(dir, c.id);
    const names = existsSync(folder) ? readdirSync(folder).filter((n) => !n.startsWith('.')).sort((a, b) => a.localeCompare(b, 'ko')) : [];
    const photos = [], unsupported = [];
    for (const name of names) {
      const ext = extname(name).toLowerCase();
      if (PHOTO_TYPES[ext] && inside(dir, join(folder, name))) photos.push({ name, saved: readLabel(dir, c, name) });
      else if (OTHER_PHOTOS.has(ext)) unsupported.push(name);
    }
    return { ...c, photos, unsupported };
  });
  const strays = existsSync(dir) ? readdirSync(dir).filter((n) => {
    if (n.startsWith('.') || known.has(n)) return false;
    const ext = extname(n).toLowerCase();
    return Boolean(PHOTO_TYPES[ext] || OTHER_PHOTOS.has(ext) || statSync(join(dir, n), { throwIfNoEntry: false })?.isDirectory());
  }) : [];
  return { conditions, strays };
}

export function readLabel(dir, cond, name) {
  const file = labelFile(dir, cond.id, name);
  if (!existsSync(file)) return null;
  let label;
  try { label = JSON.parse(readFileSync(file, 'utf8')); } catch { return { error: '정답 파일을 읽지 못했어요' }; }
  const error = checkLabel(label, cond, name);
  return error ? { error } : { label };
}

const area = (a) => a.reduce((s, [x, y], i) => { const [u, v] = a[(i + 1) % a.length]; return s + x * v - u * y; }, 0) / 2;
/** 네 점이 이 순서로 볼록한 사각형인지(화면 좌표에서 시계 방향이면 외적이 모두 양수) */
const convex = (q) => q.every((p, i) => { const a = q[(i + 1) % 4], b = q[(i + 2) % 4]; return (a[0] - p[0]) * (b[1] - a[1]) - (a[1] - p[1]) * (b[0] - a[0]) > 0; });

/** 네 모서리를 화면 기준 시계 방향(y는 아래로)으로, x+y가 가장 작은 점부터 둔다. 누른 순서는 상관없다 */
export function orderCorners(pts) {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const sorted = [...pts].sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
  const start = sorted.reduce((best, p, i) => (p[0] + p[1] < sorted[best][0] + sorted[best][1] ? i : best), 0);
  return [...sorted.slice(start), ...sorted.slice(0, start)];
}

/** 정답 형식 검사. 틀리면 이유(화면에 그대로 보이는 말), 맞으면 null */
export function checkLabel(L, cond, name) {
  if (!L || typeof L !== 'object') return '정답 형식이 아니에요';
  if (L.image !== name) return '정답 파일의 사진 이름이 달라요';
  if (L.condition !== cond.id) return '정답 파일의 조건이 폴더와 달라요';
  if (!Number.isInteger(L.width) || !Number.isInteger(L.height) || L.width < 1 || L.height < 1) return '사진 크기가 없어요';
  const inPhoto = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && p[0] >= 0 && p[1] >= 0 && p[0] <= L.width && p[1] <= L.height;
  const shape = (a) => Array.isArray(a) && a.length >= 3 && a.length <= LIMIT.points && a.every(inPhoto) && Math.abs(area(a)) > 0;
  if (L.corners !== null) {
    if (!cond.paper) return '이 조건은 종이 모서리를 두지 않아요';
    if (!Array.isArray(L.corners) || L.corners.length !== 4 || !L.corners.every(inPhoto)) return '종이 모서리는 사진 안의 네 점이어야 해요';
    if (!convex(orderCorners(L.corners))) return '네 모서리가 사각형이 되지 않아요. 다시 눌러 주세요';
  }
  if (!shape(L.outline)) return '그림 바깥선은 사진 안의 세 점 이상이어야 해요';
  if (L.extraOutlines !== undefined && (!Array.isArray(L.extraOutlines) || L.extraOutlines.length > LIMIT.pieces || !L.extraOutlines.every(shape))) return '떨어진 조각의 바깥선이 맞지 않아요';
  return null;
}

function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

/** 목록.csv: 사진 이름, 조건, 정답 여부(엑셀에서 한글이 깨지지 않게 BOM을 붙인다) */
function writeList(dir, set = scanPhotoSet(dir)) {
  const cell = (s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = [['사진 이름', '조건', '정답 여부']];
  for (const c of set.conditions) {
    for (const p of c.photos) rows.push([p.name, c.label, !p.saved ? '없음' : p.saved.error ? '다시 표시' : '있음']);
    for (const n of c.unsupported) rows.push([n, c.label, '열 수 없는 형식']);
  }
  writeAtomic(join(dir, LIST), `\uFEFF${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`);
}

function guideText() {
  return [
    '사진 넣는 법',
    '',
    '이 폴더는 배경 지우기를 실제 사진으로 재는 시험 사진 폴더예요. git에 올라가지 않고, 사진은 이 컴퓨터 밖으로 나가지 않아요.',
    '',
    `1. 사진을 촬영 조건에 맞는 폴더에 넣어 주세요. 조건마다 정한 장수 이상, 모두 ${MIN_TOTAL}장 이상이 목표예요.`,
    '2. 저장소 맨 위 폴더에서 정답 표시 도구를 켜요: node web/scripts/label-photos.mjs',
    '3. 터미널에 나온 주소를 브라우저로 열고, 사진마다 종이 네 모서리와 그림 바깥선을 눌러 저장해요.',
    `4. 정답은 사진 옆에 '사진 이름.label.json'으로, 전체 목록은 이 폴더의 ${LIST}로 저장돼요.`,
    '',
    '폴더와 찍는 법',
    ...CONDITIONS.map((c) => `- ${c.id} (${c.label}, ${c.min}장 이상): ${c.shoot}`),
    '',
    '알아 둘 것',
    '- JPG, PNG, WEBP 사진을 받아요. 아이폰 사진(HEIC)은 JPG로 바꿔 넣어 주세요. 맥 터미널에서는 sips -s format jpeg 사진.HEIC --out 사진.jpg',
    '- 그림이 여러 조각으로 떨어져 있으면 가장 큰 조각을 먼저 두르고, [조각 더 두르기]로 나머지를 둘러요.',
    '- 정답을 다 표시하면 개발 서버를 켠 채 node web/scripts/photo-set-eval.mjs 로 조건별 결과를 봐요.',
    '',
  ].join('\n');
}

function prepare(dir) {
  mkdirSync(dir, { recursive: true });
  for (const c of CONDITIONS) mkdirSync(join(dir, c.id), { recursive: true });
  if (!existsSync(join(dir, GUIDE))) writeFileSync(join(dir, GUIDE), guideText());
}

function listView(dir) {
  const set = scanPhotoSet(dir);
  writeList(dir, set);
  return {
    dir, minTotal: MIN_TOTAL, strays: set.strays,
    conditions: set.conditions.map((c) => ({
      id: c.id, label: c.label, shoot: c.shoot, min: c.min, paper: c.paper, unsupported: c.unsupported,
      photos: c.photos.map((p) => ({ name: p.name, state: !p.saved ? 'todo' : p.saved.error ? 'bad' : 'done' })),
    })),
  };
}

/** 주소의 조건·이름을 실제 파일로 바꾼다. 조건 표에 있는 폴더, 그 폴더에 실제로 있는 사진 이름만 받는다(경로를 만들어 내지 않는다) */
function findPhoto(dir, condEnc, nameEnc) {
  let condId, name;
  try { condId = decodeURIComponent(condEnc); name = decodeURIComponent(nameEnc); } catch { return null; }
  const cond = CONDITIONS.find((c) => c.id === condId);
  const type = PHOTO_TYPES[extname(name).toLowerCase()];
  if (!cond || !type || /[/\\\0]/.test(name) || name.startsWith('.')) return null;
  const folder = join(dir, cond.id);
  if (!existsSync(folder) || !readdirSync(folder).includes(name)) return null;
  const file = inside(dir, join(folder, name));
  return file ? { cond, name, file, type } : null;
}

function readBody(req) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => { n += c.length; if (n > LIMIT.body) { fail(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => ok(Buffer.concat(chunks).toString('utf8')));
    req.on('error', fail);
  });
}

const round = (a) => (Array.isArray(a) ? a.map((p) => (Array.isArray(p) ? p.map((v) => (typeof v === 'number' ? Math.round(v) : v)) : p)) : a);
function makeLabel(found, b) {
  const extra = Array.isArray(b?.extraOutlines) ? b.extraOutlines.map(round) : b?.extraOutlines;
  return {
    image: found.name,
    condition: found.cond.id,
    width: b?.width,
    height: b?.height,
    corners: b?.corners == null ? null : round(b.corners),
    outline: round(b?.outline),
    ...(extra === undefined || (Array.isArray(extra) && !extra.length) ? {} : { extraOutlines: extra }),
    labeledAt: new Date().toISOString(),
  };
}

function send(res, code, type, body, extra = {}) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra });
  res.end(body);
}
const json = (res, code, obj) => send(res, code, 'application/json; charset=utf-8', JSON.stringify(obj));
/** 화면은 이 도구가 준 파일만 쓰고 바깥으로 아무것도 보내지 않는다 */
const CSP = "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

async function handle(dir, port, req, res) {
  const origins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
  // 다른 사이트가 자기 주소를 이 컴퓨터로 돌려 사진을 읽지 못하게(DNS rebinding) Host를 확인한다
  if (!origins.includes(`http://${req.headers.host}`)) return send(res, 403, 'text/plain; charset=utf-8', '이 컴퓨터의 주소(127.0.0.1)로만 열 수 있어요.');
  const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
  if (req.method === 'GET' && path === '/') return send(res, 200, 'text/html; charset=utf-8', PAGE, { 'Content-Security-Policy': CSP });
  if (req.method === 'GET' && path === '/app.js') return send(res, 200, 'text/javascript; charset=utf-8', SCRIPT);
  if (req.method === 'GET' && path === '/api/list') return json(res, 200, listView(dir));
  const m = /^\/(photo|api\/label)\/([^/]+)\/([^/]+)$/.exec(path);
  const found = m && findPhoto(dir, m[2], m[3]);
  if (!found) return json(res, 404, { error: '사진을 찾지 못했어요.' });
  if (m[1] === 'photo' && req.method === 'GET') return send(res, 200, found.type, readFileSync(found.file));
  if (m[1] === 'api/label' && req.method === 'GET') {
    const saved = readLabel(dir, found.cond, found.name);
    return saved ? json(res, saved.error ? 422 : 200, saved) : json(res, 404, { error: '아직 정답이 없어요.' });
  }
  if (m[1] === 'api/label' && req.method === 'POST') {
    if (req.headers.origin && !origins.includes(req.headers.origin)) return json(res, 403, { error: '다른 사이트에서는 저장할 수 없어요.' });
    if (!/^application\/json\b/.test(req.headers['content-type'] ?? '')) return json(res, 415, { error: 'JSON으로 보내 주세요.' });
    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return json(res, 400, { error: '정답을 읽지 못했어요.' }); }
    const label = makeLabel(found, body);
    const error = checkLabel(label, found.cond, found.name);
    if (error) return json(res, 400, { error });
    if (label.corners) label.corners = orderCorners(label.corners);
    writeAtomic(labelFile(dir, found.cond.id, found.name), `${JSON.stringify(label, null, 2)}\n`);
    writeList(dir);
    return json(res, 200, { label });
  }
  return json(res, 405, { error: '할 수 없는 요청이에요.' });
}

// ───────────── 화면(브라우저에서 도는 코드) ─────────────

const PAGE = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>사진 정답 표시</title>
<style>
  :root { color-scheme: light; --line: #ddd6cb; --ink: #2b2a28; --soft: #6b665e; --ok: #2f7d4f; --warn: #b5541c; --accent: #1f6f78; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; color: var(--ink); background: #f6f3ee; word-break: keep-all; display: flex; flex-direction: column; height: 100vh; }
  header { flex: none; padding: 12px 20px; border-bottom: 1px solid var(--line); background: #fff; }
  h1 { font-size: 18px; margin: 0; }
  h2 { font-size: 15px; margin: 0; }
  .meta { color: var(--soft); margin: 2px 0 0; font-size: 13px; }
  .warn { color: var(--warn); }
  main { flex: 1; min-height: 0; display: grid; grid-template-columns: 300px 1fr; }
  nav { border-right: 1px solid var(--line); background: #fff; overflow: auto; }
  .cond { padding: 10px 14px; border-bottom: 1px solid var(--line); margin: 0; }
  .photo { display: flex; justify-content: space-between; gap: 8px; width: 100%; padding: 4px 6px; margin: 2px 0; border: 0; border-radius: 6px; background: none; font: inherit; text-align: left; color: inherit; }
  button.photo { cursor: pointer; }
  button.photo:hover, button.photo[aria-current="true"] { background: #e6f0f0; }
  .photo .name { overflow-wrap: anywhere; }
  .chip { font-size: 12px; color: var(--soft); white-space: nowrap; }
  .chip.done { color: var(--ok); }
  .chip.warn { color: var(--warn); }
  #work { padding: 14px 20px; min-width: 0; overflow: auto; }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
  .check { display: inline-flex; gap: 6px; align-items: center; margin: 8px 0 0; cursor: pointer; }
  button.act { font: inherit; padding: 6px 12px; border: 1px solid var(--line); border-radius: 8px; background: #fff; color: inherit; cursor: pointer; }
  button.act.main { background: var(--accent); border-color: var(--accent); color: #fff; }
  button.act:disabled { opacity: .4; cursor: default; }
  #hint { font-weight: 600; margin: 10px 0 0; }
  #msg { min-height: 1.5em; margin: 0 0 8px; color: var(--ok); }
  #msg.bad { color: var(--warn); }
  .stage { position: relative; display: inline-block; line-height: 0; user-select: none; }
  .stage img { display: block; max-width: calc(100vw - 360px); max-height: calc(100vh - 310px); image-orientation: from-image; }
  .stage svg { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; }
  .empty { max-width: 680px; }
  code { background: #eee8de; padding: 1px 4px; border-radius: 4px; }
</style>
</head>
<body>
<header><h1>사진 정답 표시</h1><p class="meta" id="summary">사진 목록을 읽는 중이에요.</p></header>
<main><nav id="list" aria-label="사진 목록"></nav><section id="work"></section></main>
<script src="/app.js"></script>
</body>
</html>
`;

function client() {
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  const enc = encodeURIComponent;
  // 함수 값은 그 이름의 이벤트로 붙인다(click, change)
  const h = (tag, props, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props ?? {})) {
      if (typeof v === 'function') e.addEventListener(k, v);
      else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, v === true ? '' : String(v));
    }
    e.append(...kids.filter((x) => x !== null && x !== undefined && x !== false));
    return e;
  };
  const shape = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    return e;
  };

  let data = null; // 사진 목록
  let cur = null; // 지금 사진 { c, p }
  let acts = []; // 누른 순서. 되돌리기는 마지막 것을 뺀다
  let size = null; // 사진의 naturalWidth·naturalHeight(저장 좌표의 기준)
  let noPaper = false;
  let dirty = false; // 저장하지 않은 점이 있는지

  const all = () => data.conditions.flatMap((c) => c.photos.map((p) => ({ c, p })));
  const same = (x) => Boolean(cur) && x.c.id === cur.c.id && x.p.name === cur.p.name;
  const msg = (text, bad = false) => { const m = $('msg'); if (m) { m.textContent = text; m.className = bad ? 'bad' : ''; } };

  async function loadList() {
    const r = await fetch('/api/list');
    if (!r.ok) throw new Error('list');
    data = await r.json();
    if (cur) cur = all().find(same) ?? cur;
    drawList();
  }

  function drawList() {
    const photos = all(), done = photos.filter((x) => x.p.state === 'done').length;
    $('summary').textContent = '정답 ' + done + '장 / 사진 ' + photos.length + '장. 목표는 모두 ' + data.minTotal + '장 이상이에요. 사진 폴더: ' + data.dir;
    const nav = $('list');
    nav.replaceChildren();
    if (data.strays.length) nav.append(h('p', { class: 'cond warn' }, '조건 폴더 밖에 있어요. 맞는 폴더로 옮겨 주세요: ' + data.strays.join(', ')));
    for (const c of data.conditions) {
      const doneN = c.photos.filter((p) => p.state === 'done').length;
      const box = h('div', { class: 'cond' },
        h('h2', null, c.label),
        h('p', { class: 'meta' }, c.id + ' 폴더 · 사진 ' + c.photos.length + '장 · 정답 ' + doneN + '장',
          c.photos.length < c.min ? h('span', { class: 'warn' }, ' · ' + c.min + '장 이상 필요') : null));
      for (const p of c.photos) {
        const [text, cls] = p.state === 'done' ? ['정답 있음', 'chip done'] : p.state === 'bad' ? ['다시 표시', 'chip warn'] : ['아직', 'chip'];
        box.append(h('button', { type: 'button', class: 'photo', 'aria-current': same({ c, p }) ? 'true' : null, click: () => open(c.id, p.name) },
          h('span', { class: 'name' }, p.name), h('span', { class: cls }, text)));
      }
      for (const n of c.unsupported) box.append(h('p', { class: 'photo' }, h('span', { class: 'name' }, n), h('span', { class: 'chip warn' }, 'JPG로 바꿔 주세요')));
      nav.append(box);
    }
  }

  function showEmpty() {
    $('work').replaceChildren(h('div', { class: 'empty' },
      h('h2', null, '아직 사진이 없어요'),
      h('p', null, '아래 폴더에 촬영 조건별로 사진을 넣고 이 화면을 새로 고쳐 주세요.'),
      h('p', null, h('code', null, data.dir)),
      h('ul', null, ...data.conditions.map((c) => h('li', null, h('code', null, c.id), ' ' + c.label + ' (' + c.min + '장 이상): ' + c.shoot))),
      h('p', null, '모두 ' + data.minTotal + '장 이상이 목표예요. 아이폰 사진(HEIC)은 JPG로 바꿔 넣어 주세요.')));
  }

  /** 누른 순서를 다시 읽어 모서리와 바깥선, 지금 단계를 만든다 */
  function state() {
    const corners = [], polys = [];
    let open = null;
    for (const a of acts) {
      if (a.k === 'c') corners.push(a.p);
      else if (a.k === 'p') { if (!open) { open = { pts: [], closed: false }; polys.push(open); } open.pts.push(a.p); }
      else if (a.k === 'close') { if (open) { open.closed = true; open = null; } }
      else if (a.k === 'piece') { open = { pts: [], closed: false }; polys.push(open); }
    }
    const needCorners = cur.c.paper && !noPaper;
    const last = polys[polys.length - 1];
    const phase = needCorners && corners.length < 4 ? 'corners' : !last || !last.closed ? 'outline' : 'done';
    return { corners, polys, needCorners, phase, open: last && !last.closed ? last : null };
  }

  function open(condId, name) {
    if (dirty && !confirm('저장하지 않은 점이 있어요. 다른 사진으로 넘어갈까요?')) return;
    const token = all().find((x) => x.c.id === condId && x.p.name === name);
    if (!token) return;
    cur = token; acts = []; size = null; noPaper = false; dirty = false;
    drawList();
    const { c, p } = token;
    const img = h('img', { id: 'img', alt: name, draggable: 'false' });
    const ov = shape('svg', { id: 'ov', preserveAspectRatio: 'none' });
    ov.addEventListener('click', onClick);
    $('work').replaceChildren(
      h('h2', null, c.label + ' · ' + name),
      h('p', { class: 'meta' }, c.shoot),
      c.paper
        ? h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'nopaper', change: (e) => { noPaper = e.target.checked; if (noPaper) acts = acts.filter((a) => a.k !== 'c'); dirty = true; draw(); } }), '종이 없음 (종이 모서리가 사진 밖에 있어도 체크해요)')
        : h('p', { class: 'meta' }, '이 조건은 종이가 없어서 모서리를 누르지 않아요.'),
      h('p', { id: 'hint' }, '사진을 여는 중이에요.'),
      h('div', { class: 'bar' },
        h('button', { type: 'button', class: 'act', id: 'undo', click: undo }, '마지막 점 지우기'),
        h('button', { type: 'button', class: 'act', id: 'close', click: closeShape }, '닫기'),
        h('button', { type: 'button', class: 'act', id: 'piece', click: () => { acts.push({ k: 'piece' }); dirty = true; draw(); } }, '조각 더 두르기'),
        h('button', { type: 'button', class: 'act', id: 'reset', click: () => { acts = []; dirty = true; draw(); } }, '처음부터'),
        h('button', { type: 'button', class: 'act main', id: 'save', click: save }, '저장하고 다음 사진'),
        h('button', { type: 'button', class: 'act', id: 'next', click: () => next(false) }, '다음 사진')),
      h('p', { id: 'msg', role: 'status' }),
      h('div', { class: 'stage' }, img, ov));
    for (const id of ['undo', 'close', 'piece', 'reset', 'save']) $(id).disabled = true;
    img.addEventListener('load', async () => {
      if (cur !== token) return;
      size = { w: img.naturalWidth, h: img.naturalHeight };
      ov.setAttribute('viewBox', '0 0 ' + size.w + ' ' + size.h);
      if (p.state !== 'todo') await loadLabel(token);
      if (cur === token) draw();
    });
    img.addEventListener('error', () => { if (cur === token) $('hint').textContent = '이 사진을 열지 못했어요. JPG나 PNG로 바꿔 넣어 주세요.'; });
    img.src = '/photo/' + enc(c.id) + '/' + enc(name);
  }

  async function loadLabel(token) {
    const { c, p } = token;
    const r = await fetch('/api/label/' + enc(c.id) + '/' + enc(p.name));
    const body = await r.json().catch(() => ({}));
    if (cur !== token) return;
    if (!r.ok || !body.label) { msg(body.error ? '정답 파일이 맞지 않아요(' + body.error + '). 다시 표시해 주세요.' : '정답을 읽지 못했어요. 다시 표시해 주세요.', true); return; }
    const L = body.label;
    if (L.width !== size.w || L.height !== size.h) { msg('사진 크기(' + size.w + '×' + size.h + ')가 저장된 정답(' + L.width + '×' + L.height + ')과 달라요. 다시 표시해 주세요.', true); return; }
    for (const pt of L.corners ?? []) acts.push({ k: 'c', p: pt });
    noPaper = c.paper && !L.corners;
    const box = $('nopaper');
    if (box) box.checked = noPaper;
    [L.outline, ...(L.extraOutlines ?? [])].forEach((poly, i) => {
      if (i) acts.push({ k: 'piece' });
      for (const pt of poly) acts.push({ k: 'p', p: pt });
      acts.push({ k: 'close' });
    });
    msg('저장된 정답을 불러왔어요. 고치려면 [마지막 점 지우기]나 [처음부터]를 눌러요.');
  }

  function onClick(e) {
    if (!cur || !size) return;
    const st = state();
    if (st.phase === 'done') { msg('다 둘렀어요. [저장하고 다음 사진]을 누르거나, 떨어진 조각이 있으면 [조각 더 두르기]를 눌러요.'); return; }
    // 화면에 줄여 보인 크기에서 원본 픽셀로 되돌린다
    const r = $('img').getBoundingClientRect();
    const x = Math.round(Math.min(size.w, Math.max(0, ((e.clientX - r.left) * size.w) / r.width)));
    const y = Math.round(Math.min(size.h, Math.max(0, ((e.clientY - r.top) * size.h) / r.height)));
    acts.push({ k: st.phase === 'corners' ? 'c' : 'p', p: [x, y] });
    dirty = true;
    msg('');
    draw();
  }

  function undo() { if (acts.length) { acts.pop(); dirty = true; msg(''); draw(); } }
  function closeShape() { const st = state(); if (st.phase === 'outline' && st.open && st.open.pts.length >= 3) { acts.push({ k: 'close' }); dirty = true; draw(); } }

  function draw() {
    const ov = $('ov'), img = $('img');
    if (!cur || !size || !ov || !img) return;
    const st = state();
    const k = size.w / Math.max(1, img.getBoundingClientRect().width); // 화면 1px에 해당하는 원본 길이
    ov.replaceChildren();
    for (const poly of st.polys) {
      if (!poly.pts.length) continue;
      const pts = poly.pts.map((q) => q.join(',')).join(' ');
      ov.append(shape(poly.closed ? 'polygon' : 'polyline', { points: pts, fill: poly.closed ? 'rgba(31,111,120,0.22)' : 'none', stroke: '#1f6f78', 'stroke-width': 2, 'stroke-dasharray': poly.closed ? 'none' : '6 4', 'vector-effect': 'non-scaling-stroke' }));
      for (const q of poly.pts) ov.append(shape('circle', { cx: q[0], cy: q[1], r: 3 * k, fill: '#1f6f78' }));
    }
    st.corners.forEach((q, i) => {
      ov.append(shape('circle', { cx: q[0], cy: q[1], r: 7 * k, fill: '#e8590c', stroke: '#fff', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke' }));
      const t = shape('text', { x: q[0] + 10 * k, y: q[1] - 10 * k, 'font-size': 16 * k, 'font-weight': 700, fill: '#e8590c' });
      t.textContent = String(i + 1);
      ov.append(t);
    });
    const n = st.open ? st.open.pts.length : 0;
    $('hint').textContent = st.phase === 'corners'
      ? '종이 네 모서리를 눌러 주세요 (' + st.corners.length + '/4). 누르는 순서는 상관없어요.'
      : st.phase === 'outline'
        ? (st.polys.length <= 1
          ? '그림 바깥선을 따라 점을 찍어 주세요 (' + n + '점). 다 찍었으면 [닫기]를 눌러요.'
          : '떨어진 조각의 바깥선을 따라 점을 찍고 [닫기]를 눌러요 (' + n + '점). 그만두려면 [마지막 점 지우기]를 눌러요.')
        : '다 둘렀어요. [저장하고 다음 사진]을 눌러 주세요.';
    $('undo').disabled = !acts.length;
    $('reset').disabled = !acts.length;
    $('close').disabled = !(st.phase === 'outline' && n >= 3);
    $('piece').disabled = st.phase !== 'done';
    $('save').disabled = st.phase !== 'done';
  }

  async function save() {
    const st = state();
    if (!cur || !size || st.phase !== 'done') return;
    const token = cur;
    $('save').disabled = true;
    try {
      const r = await fetch('/api/label/' + enc(cur.c.id) + '/' + enc(cur.p.name), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width: size.w, height: size.h, corners: st.needCorners ? st.corners : null, outline: st.polys[0].pts, extraOutlines: st.polys.slice(1).map((q) => q.pts) }),
      });
      const body = await r.json().catch(() => ({}));
      if (cur !== token) return;
      if (!r.ok) { msg(body.error ?? '저장하지 못했어요.', true); draw(); return; }
      dirty = false;
      await loadList();
      if (next(true)) msg('저장했어요: ' + token.p.name + '. 다음 사진을 열었어요.');
      else { msg('저장했어요: ' + token.p.name + '. 모든 사진에 정답을 표시했어요.'); draw(); }
    } catch {
      msg('저장하지 못했어요. 터미널에서 도구가 켜져 있는지 확인해 주세요.', true);
      draw();
    }
  }

  /** onlyTodo면 정답이 없는 다음 사진, 아니면 바로 다음 사진을 연다. 열었으면 true */
  function next(onlyTodo) {
    const list = all();
    const i = cur ? list.findIndex(same) : -1;
    for (let k = 1; k <= list.length; k++) {
      const x = list[(i + k + list.length) % list.length];
      if (onlyTodo && (x.p.state === 'done' || same(x))) continue;
      open(x.c.id, x.p.name);
      return true;
    }
    return false;
  }

  window.addEventListener('resize', () => draw());
  window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
  document.addEventListener('keydown', (e) => {
    if (!cur || e.target instanceof HTMLInputElement) return;
    if (e.key === 'Backspace' || e.key === 'Delete' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z')) { e.preventDefault(); undo(); }
    else if (e.key === 'Enter') { e.preventDefault(); closeShape(); }
  });
  loadList()
    .then(() => { if (!all().length) showEmpty(); else if (!next(true)) next(false); })
    .catch(() => { $('summary').textContent = '사진 목록을 읽지 못했어요. 터미널에서 도구가 켜져 있는지 확인해 주세요.'; });
}

const SCRIPT = `(${client.toString()})();\n`;

function main() {
  const args = parseArgs(process.argv.slice(2), ['dir', 'port']);
  const port = Number(args?.port ?? DEFAULT_PORT);
  if (!args || !Number.isInteger(port) || port < 0 || port > 65535) {
    console.error('사용: node web/scripts/label-photos.mjs [--dir <사진 폴더>] [--port <번호>]');
    process.exit(2);
  }
  const dir = resolve(args.dir ?? DEFAULT_DIR);
  prepare(dir);
  writeList(dir);
  const server = createServer((req, res) => {
    handle(dir, server.address().port, req, res).catch((e) => { if (!res.headersSent) json(res, 500, { error: `도구에서 문제가 생겼어요: ${e.message}` }); });
  });
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `포트 ${port}을 이미 쓰고 있어요. --port 로 다른 번호를 주세요.` : e.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => console.log(`정답 표시 도구: http://127.0.0.1:${server.address().port}  (사진 폴더 ${dir}, 끄려면 Ctrl+C)`));
}

// 평가 스크립트가 목록 읽기 함수만 가져갈 때는 서버를 켜지 않는다
const isMain = (() => { try { return realpathSync(process.argv[1] ?? '') === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) main();
