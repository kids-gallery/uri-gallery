// 컨테이너 한 바퀴 시험(마스터플랜 3-5, #140). 화면이 부르는 API를 브라우저 없이 부른다.
//   node ops/docker/smoke.mjs        가입 → 아이 → 사진 → 확정 → 결정 → 전시. 계정과 작품을 상태 파일에 남긴다
//   node ops/docker/smoke.mjs keep   상태 파일의 계정으로 다시 로그인해 작품이 전시에 남았는지 본다
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = process.env.SMOKE_BASE ?? 'http://localhost:9501';
const MAIL = process.env.SMOKE_MAIL ?? 'http://localhost:8025';
const STATE = process.env.SMOKE_STATE ?? '/tmp/compose-smoke.json';
const PHOTO = new URL('../team1_museum/examples/images/house.png', import.meta.url);
let cookie = '';

async function call(path, init = {}) {
  const res = await fetch(BASE + path, { ...init, headers: { ...init.headers, cookie } });
  const set = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  if (set) cookie = set;
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}
const post = (path, body) => call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

async function until(what, read, seconds = 120) {
  const end = Date.now() + seconds * 1000;
  for (;;) {
    const value = await read();
    if (value) return value;
    if (Date.now() > end) throw new Error(`${seconds}초 안에 되지 않음: ${what}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}
const exhibited = async (child, id) => (await call(`/v1/gallery?child=${encodeURIComponent(child)}`)).groups.flatMap((g) => g.items).find((i) => i.id === id);
// DB 행만이 아니라 볼륨의 파일까지 내려받아 본다
async function fileBytes(item) {
  const res = await fetch(BASE + item.primaryUrl, { headers: { cookie } });
  if (!res.ok) throw new Error(`작품 파일 ${res.status}: ${item.id}`);
  if (res.headers.get('cache-control') !== 'private, no-store') throw new Error(`파일 캐시 머리글: ${res.headers.get('cache-control')}`); // 프록시를 지난 값을 본다(#154)
  const bytes = (await res.arrayBuffer()).byteLength;
  if (!bytes) throw new Error(`작품 파일이 비었음: ${item.id}`);
  return bytes;
}

if (process.argv[2] === 'keep') {
  const { email, password, child, id } = JSON.parse(readFileSync(STATE, 'utf8'));
  await post('/v1/auth/login', { email, password });
  const item = await exhibited(child, id);
  if (!item) throw new Error(`재시작 뒤 전시에서 사라짐: ${id}`);
  console.log(`재시작 뒤에도 작품이 전시에 있음: ${id}, 파일 ${await fileBytes(item)}바이트`);
} else {
  const started = Date.now();
  const email = `smoke-${Date.now()}@example.com`;
  const password = randomUUID();
  await post('/v1/auth/signup', { email, password, passwordConfirm: password });
  const token = await until('확인 메일', async () => {
    const { messages } = await (await fetch(`${MAIL}/api/v1/messages?limit=200`)).json();
    const mail = messages.find((m) => m.To[0].Address === email);
    if (!mail) return null;
    const { Text } = await (await fetch(`${MAIL}/api/v1/message/${mail.ID}`)).json();
    return new URL(Text.match(/https?:\/\/\S+verify\S+/)[0].replace(/[.,)]+$/, '')).searchParams.get('token');
  }, 30);
  await post('/v1/auth/email/verify', { token });
  await post('/v1/auth/login', { email, password });
  const child = (await post('/v1/children', { alias: '시험' })).id;

  const form = new FormData();
  form.append('childId', child);
  form.append('photo', new Blob([readFileSync(PHOTO)], { type: 'image/png' }), 'house.png');
  const { id } = await call('/v1/artworks', { method: 'POST', headers: { 'Idempotency-Key': randomUUID() }, body: form });

  const art = () => call(`/v1/artworks/${id}`);
  await until('확정 창', async () => { const a = await art(); return !a.confirmedKind && a.choices?.length; });
  await post(`/v1/artworks/${id}/confirm`, { kind: 'relief' });
  await until('결과 확인', async () => (await art()).state === 'awaiting_review');
  await post(`/v1/artworks/${id}/decision`, { decision: 'like' });
  const item = await until('전시', () => exhibited(child, id), 30);
  if (item.kind !== 'relief') throw new Error(`입체로 걸리지 않음: ${item.kind}`);

  writeFileSync(STATE, JSON.stringify({ email, password, child, id }));
  console.log(`한 바퀴 통과: 작품 ${id}, ${item.kind}, 파일 ${await fileBytes(item)}바이트, ${((Date.now() - started) / 1000).toFixed(1)}초`);
}
