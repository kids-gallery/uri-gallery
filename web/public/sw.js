// 오프라인 열기(3D미술관_재설계 §2-19 기준 6). 단독 배포본(--mode world)에서만 등록한다.
// 같은 출처의 GET 응답을 받을 때마다 저장하고(네트워크 먼저), 연결이 끊기면 저장본을 준다.
// 화면 주소는 저장해 둔 /app/world(없으면 /) 응답으로 연다. 판을 바꾸면 CACHE 이름을 올려 옛 저장본을 지운다.
const CACHE = 'uam-world-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// 첫 방문의 파일은 서비스 워커가 생기기 전에 받았으므로, 화면이 넘겨준 주소 목록을 한 번 저장한다
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache-urls' || !Array.isArray(e.data.urls)) return;
  const urls = e.data.urls.filter((u) => typeof u === 'string' && new URL(u, self.location.origin).origin === self.location.origin);
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => c.add(u).catch(() => undefined)))));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })
      // 같은 출처 정적 파일이므로 Vary(예: Origin)는 보지 않는다. 모듈 스크립트는 Origin 머리값이 붙어 저장할 때의 요청과 다르다
      .catch(async () => {
        const hit = (u) => caches.match(u, { ignoreVary: true });
        return (await hit(req)) ?? (req.mode === 'navigate' ? (await hit('/app/world')) ?? (await hit('/')) : undefined) ?? Response.error();
      }),
  );
});
