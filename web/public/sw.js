// 오프라인 앱 셸과 정적 파일만 보관한다. 가족 데이터는 네트워크가 직접 처리한다.
const CACHE = 'uam-world-v3';
const CACHE_PREFIX = 'uam-world-';

function cacheable(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  return path.startsWith('/assets/') || path.startsWith('/museum/') ||
    path.startsWith('/audio/') || path.startsWith('/icons/') || path === '/favicon.svg' ||
    path.startsWith('/licenses/') || path === '/favicon.ico' ||
    path === '/manifest.webmanifest' || path === '/app/world' || path === '/';
}

function storable(res) {
  return res.ok && !res.redirected && !/\b(no-store|private)\b/i.test(res.headers.get('cache-control') || '');
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
  )).then(() => self.clients.claim()));
});

self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache-urls' || !Array.isArray(e.data.urls)) return;
  const urls = e.data.urls.filter((u) => {
    if (typeof u !== 'string') return false;
    try { return cacheable(new URL(u, self.location.origin)); } catch { return false; }
  });
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => fetch(u).then((res) => storable(res) ? c.put(u, res) : undefined).catch(() => undefined)))));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || !cacheable(url)) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (storable(res)) {
        const copy = res.clone();
        e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined));
      }
      return res;
    }).catch(async () => {
      const cache = await caches.open(CACHE);
      const hit = (u) => cache.match(u, { ignoreVary: true });
      return (await hit(req)) ?? (req.mode === 'navigate' ? (await hit('/app/world')) ?? (await hit('/')) : undefined) ?? Response.error();
    }),
  );
});
