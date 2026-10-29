// 휴대폰 실측용 HTTPS 정적 서버(3D미술관_재설계 §2-22 13, 출시불가 지시문 6). 같은 와이파이의 휴대폰에서 측정용 빌드를 열 때만 쓴다.
// 사용: node web/scripts/serve-https.mjs <폴더> --cert <pem> --key <pem> [--port 9643] [--net fast4g|slow4g]
// 의존성 없음(Node 22 이상). 0.0.0.0(IPv4)에 열지만 사설 주소(10.x·172.16~31.x·192.168.x·169.254.x)와 이 맥(127.x)의 연결만 받는다. 터널·외부 공개는 하지 않는다.
// HTTP/2로 열고 HTTP/1.1도 받는다. 폴더 목록은 만들지 않는다. 폴더 밖·숨김(.으로 시작) 경로는 404, 깨진 주소는 400이다.
// 파일이 없고 확장자도 없는 주소(화면 주소)는 index.html을 준다(SPA). 오디오는 iPhone Safari가 바이트 범위 요청을 쓰므로 Range를 받는다.
// 배포 호스팅과 비슷하게 준다: /assets/(빌드가 이름에 내용 해시를 붙인 파일)는 1년 보관, 나머지는 ETag로 매번 확인, 글 파일은 gzip.
// --net은 휴대폰 데이터 흉내다(실제 휴대폰 데이터가 아니다): 요청마다 지연을 두고, 모든 응답이 한 속도를 나눠 쓴다. 값과 출처는 NET 표.
import { X509Certificate } from 'node:crypto';
import { createReadStream, readFileSync, realpathSync, statSync } from 'node:fs';
import { createSecureServer } from 'node:http2';
import { networkInterfaces } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { Transform, pipeline } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createGzip } from 'node:zlib';

export const SERVE = {
  port: 9643,
  chunk: 16 * 1024, // 파일을 읽고 속도를 맞추는 단위(바이트)
  gzipMin: 1024, // 이보다 작은 글 파일은 압축하지 않는다
  immutableDir: 'assets', // 빌드가 내용 해시를 붙여 내는 폴더(vite 기본 assetsDir)
  page: '/app/world?measure', // 안내에 찍는 측정 주소
};
/** 확장자 → Content-Type. 표에 없으면 application/octet-stream */
export const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.ktx2': 'image/ktx2',
  '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.ogg': 'audio/ogg', '.oga': 'audio/ogg', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
};
/** gzip으로 줄어드는 형식. 이미 압축된 사진·글꼴·소리·모델은 뺀다 */
const COMPRESSIBLE = /^(text\/|application\/(json|manifest\+json|xml|wasm)|image\/svg\+xml|model\/gltf\+json)/;
/**
 * 휴대폰 데이터 흉내(--net). 요청마다 latencyMs 뒤에 응답을 시작하고, 동시에 받는 모든 응답이 bytesPerSec을 나눠 쓴다.
 * 브라우저 개발 도구와 같은 '요청 단위' 흉내라 패킷 손실·신호 세기·기지국 대기는 없다. 실제 휴대폰 데이터 측정을 대신하지 않는다.
 */
export const NET = {
  // Chrome 개발 도구 'Fast 4G'(devtools-frontend front_end/core/sdk/NetworkManager.ts Fast4GConditions): 9Mbps의 90%, 지연 60ms×2.75
  fast4g: { label: 'Chrome 개발 도구 Fast 4G', bytesPerSec: ((9 * 1000 * 1000) / 8) * 0.9, latencyMs: 60 * 2.75 },
  // Lighthouse 모바일 기본값 'Slow 4G'(docs/throttling.md: 150ms·1.6Mbps, 4G 하위 25% 정도), 개발 도구 방식 보정 ×0.9·×3.75(core/config/constants.js)
  slow4g: { label: 'Lighthouse Slow 4G', bytesPerSec: Math.floor((1.6 * 1024 * 0.9 * 1024) / 8), latencyMs: 150 * 3.75 },
};

/** 사설·링크 로컬·이 맥 주소인가(IPv4, '::ffff:'가 붙은 꼴 포함). IPv4에만 열므로 그 밖은 모두 아니다 */
export function isLan(addr = '') {
  const m = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/i.exec(addr);
  if (!m) return false;
  const a = Number(m[1]), b = Number(m[2]);
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

const statSafe = (p) => { try { return statSync(p); } catch { return null; } };
/** 요청 주소 → { file, size, mtimeMs } 또는 { status }. 폴더면 그 안의 index.html, 실제 위치(심볼릭 링크를 따라간 곳)도 폴더 안이어야 한다 */
export function locate(root, rawUrl) {
  let path;
  try { path = decodeURIComponent(new URL(rawUrl, 'https://localhost').pathname); } catch { return { status: 400 }; }
  const parts = path.split('/').filter(Boolean);
  if (path.includes('\0') || parts.some((p) => p.startsWith('.') || p.includes('\\'))) return { status: 404 };
  const found = (p) => {
    const st = statSafe(p);
    if (st?.isDirectory()) return found(join(p, 'index.html'));
    if (!st?.isFile()) return null;
    let real;
    try { real = realpathSync(p); } catch { return null; }
    return real.startsWith(root + sep) ? { file: real, size: st.size, mtimeMs: st.mtimeMs } : { status: 404 };
  };
  const hit = found(resolve(root, ...parts));
  if (hit) return hit;
  // 없는 파일: 확장자가 없는 주소(화면 주소)만 index.html을 준다. 없는 .js·.png에 HTML을 주지 않는다
  return extname(parts.at(-1) ?? '') === '' ? (found(join(root, 'index.html')) ?? { status: 404 }) : { status: 404 };
}

/** Range 머리값(bytes=a-b, a-, -n 하나)을 [시작, 끝]으로. 없거나 여러 개거나 잘못 쓰면 null(전체를 준다), 파일 밖이면 'bad'(416) */
export function byteRange(header, size) {
  if (!header || header.includes(',')) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '') || (m[1] !== '' && m[2] !== '' && Number(m[2]) < Number(m[1]))) return null;
  if (m[1] === '') { const n = Number(m[2]); return n === 0 || size === 0 ? 'bad' : [Math.max(0, size - n), size - 1]; }
  const start = Number(m[1]);
  return start >= size ? 'bad' : [start, Math.min(m[2] === '' ? size - 1 : Number(m[2]), size - 1)];
}

const sameTag = (header, tag) => !!header && header.split(',').some((t) => { t = t.trim(); return t === '*' || t.replace(/^W\//, '') === tag.replace(/^W\//, ''); });
/** 요청 하나에 줄 응답(상태·머리값·보낼 파일 범위)을 정한다. 보내기는 handler가 한다 */
export function plan(root, req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return { status: 405, headers: { allow: 'GET, HEAD' } };
  const hit = locate(root, req.url ?? '/');
  if (!hit.file) return { status: hit.status, headers: {} };
  const type = MIME[extname(hit.file).toLowerCase()] ?? 'application/octet-stream', squeezable = COMPRESSIBLE.test(type);
  const tag = `W/"${hit.size.toString(16)}-${Math.floor(hit.mtimeMs).toString(16)}"`;
  const immutable = hit.file.startsWith(join(root, SERVE.immutableDir) + sep);
  const headers = { 'content-type': type, etag: tag, 'accept-ranges': 'bytes', 'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache' };
  if (squeezable) headers.vary = 'accept-encoding';
  if (sameTag(req.headers['if-none-match'], tag)) return { status: 304, headers };
  const range = byteRange(req.headers.range, hit.size);
  if (range === 'bad') return { status: 416, headers: { 'content-range': `bytes */${hit.size}` } };
  const [start, end] = range ?? [0, hit.size - 1];
  const gzip = !range && req.method === 'GET' && squeezable && hit.size >= SERVE.gzipMin && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '');
  if (gzip) headers['content-encoding'] = 'gzip'; else headers['content-length'] = String(end - start + 1);
  if (range) headers['content-range'] = `bytes ${start}-${end}/${hit.size}`;
  return { status: range ? 206 : 200, headers, file: hit.file, start, end, gzip };
}

let linkFree = 0; // --net: 모든 응답이 함께 쓰는 내려받기 길이 다음으로 비는 시각(ms)
/** 조각마다 길을 예약하고 그 시각에 내보낸다. 동시에 받는 응답들은 번갈아 예약하므로 속도를 나눠 쓴다 */
function pace(bytesPerSec) {
  return new Transform({
    transform(chunk, _enc, done) {
      const now = performance.now();
      linkFree = Math.max(linkFree, now) + (chunk.length / bytesPerSec) * 1000;
      setTimeout(() => done(null, chunk), linkFree - now);
    },
  });
}

function handler(root, net) {
  return (req, res) => {
    const p = plan(root, req);
    if (p.status >= 400) console.warn(`${p.status} ${req.method} ${req.url}`);
    let closed = false;
    res.on('close', () => { closed = true; });
    const go = () => {
      if (closed) return;
      const plain = p.file || p.status === 304 ? {} : { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' };
      res.writeHead(p.status, { 'x-content-type-options': 'nosniff', ...plain, ...p.headers });
      if (!p.file || req.method === 'HEAD' || p.end < p.start) { res.end(p.file || p.status === 304 || req.method === 'HEAD' ? undefined : `${p.status}\n`); return; }
      const parts = [createReadStream(p.file, { start: p.start, end: p.end, highWaterMark: SERVE.chunk })];
      if (p.gzip) parts.push(createGzip());
      if (net) parts.push(pace(net.bytesPerSec));
      pipeline(...parts, res, (err) => { if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') console.warn(`보내다 멈춤 ${req.url}: ${err.code ?? err.message}`); });
    };
    if (net) setTimeout(go, net.latencyMs); else go();
  };
}

/** 이 맥의 같은 네트워크 주소와 장치 이름(와이파이는 보통 en0, 가상 머신용 bridge·vboxnet도 나올 수 있다) */
const lanIPs = () => Object.entries(networkInterfaces()).flatMap(([name, list]) => (list ?? []).filter((i) => i.family === 'IPv4' && !i.internal && isLan(i.address)).map((i) => ({ name, ip: i.address })));
function fail(message) {
  console.error(`${message}\n사용: node web/scripts/serve-https.mjs <폴더> --cert <pem> --key <pem> [--port ${SERVE.port}] [--net ${Object.keys(NET).join('|')}]`);
  process.exit(2);
}

function main(argv) {
  let args;
  try { args = parseArgs({ args: argv, allowPositionals: true, options: { cert: { type: 'string' }, key: { type: 'string' }, port: { type: 'string' }, net: { type: 'string' } } }); }
  catch (e) { fail(e.message); }
  const { values: o, positionals } = args;
  if (positionals.length !== 1 || !o.cert || !o.key) fail('폴더 하나와 --cert, --key가 필요합니다');
  let root;
  try { root = realpathSync(resolve(positionals[0])); } catch { fail(`폴더가 없습니다: ${positionals[0]}`); }
  if (!statSafe(root)?.isDirectory()) fail(`폴더가 아닙니다: ${root}`);
  if (!statSafe(join(root, 'index.html'))?.isFile()) console.warn('이 폴더에 index.html이 없습니다. 화면 주소는 404가 됩니다');
  const port = o.port === undefined ? SERVE.port : Number(o.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail(`포트 번호가 아닙니다: ${o.port}`);
  const net = o.net === undefined ? null : NET[o.net];
  if (o.net !== undefined && !net) fail(`--net은 ${Object.keys(NET).join(' 또는 ')}입니다`);
  let cert, key;
  try { cert = readFileSync(o.cert); key = readFileSync(o.key); } catch (e) { fail(`인증서 파일을 읽지 못했습니다: ${e.message}`); }
  let server;
  try { server = createSecureServer({ cert, key, allowHTTP1: true }, handler(root, net)); } catch (e) { fail(`인증서와 키를 쓸 수 없습니다(짝이 맞는지 확인): ${e.message}`); }
  server.on('connection', (socket) => { if (!isLan(socket.remoteAddress)) { console.warn(`막음: 같은 네트워크 밖 주소 ${socket.remoteAddress}`); socket.destroy(); } });
  server.on('tlsClientError', (err) => { if (/alert|certificate/i.test(err.message)) console.warn(`TLS 연결 실패(휴대폰이 이 인증서를 믿지 않으면 생깁니다): ${err.message}`); });
  server.on('error', (e) => fail(e.code === 'EADDRINUSE' ? `포트 ${port}를 이미 쓰고 있습니다. --port로 다른 번호를 주세요` : e.message));
  server.listen(port, '0.0.0.0', () => {
    let san = '';
    try { san = new X509Certificate(cert).subjectAltName ?? ''; } catch { /* 형식을 못 읽어도 서버는 연다 */ }
    const ips = lanIPs();
    console.log('우리 아이 미술관 측정 서버(HTTPS, 같은 와이파이 안에서만)');
    console.log(`폴더: ${root}`);
    for (const { name, ip } of ips) console.log(`휴대폰에서 열 주소(${name}): https://${ip}:${port}${SERVE.page}${san.includes(`IP Address:${ip}`) ? '' : '  <- 인증서에 이 주소가 없어 휴대폰이 경고합니다. 이 주소로 열 거면 mkcert에 넣어 다시 만드세요'}`);
    if (!ips.length) console.log('같은 네트워크의 이 맥 주소를 찾지 못했습니다. 와이파이 연결을 확인하세요');
    console.log(`이 맥에서: https://localhost:${port}${SERVE.page}`);
    console.log(net ? `망 흉내: ${net.label}. 요청마다 ${net.latencyMs}ms 지연, 모든 응답이 초당 ${Math.round(net.bytesPerSec).toLocaleString('ko-KR')}바이트를 나눠 씀(실제 휴대폰 데이터가 아님)` : '망 흉내: 없음(와이파이 그대로)');
    console.log('끄기: Ctrl+C');
  });
}

const isMain = (() => { try { return !!process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href; } catch { return false; } })();
if (isMain) main(process.argv.slice(2));
