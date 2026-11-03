// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

function setup() {
  const handlers: Record<string, (event: any) => void> = {};
  const cache = { add: vi.fn(async () => undefined), put: vi.fn(async () => undefined), match: vi.fn(async () => undefined) };
  const caches = { keys: vi.fn(async () => ['uam-world-v2', 'other-app']), delete: vi.fn(async () => true), open: vi.fn(async () => cache) };
  const self = { location: { origin: 'https://gallery.test' }, clients: { claim: vi.fn() }, skipWaiting: vi.fn(), addEventListener: (name: string, fn: (e: any) => void) => { handlers[name] = fn; } };
  const fetch = vi.fn(async () => { throw new Error('offline'); });
  runInNewContext(readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8'), { self, caches, fetch, URL, Response, Promise });
  return { handlers, cache, caches, fetch };
}

describe('world service worker privacy', () => {
  it('removes old world caches while preserving other apps', async () => {
    const { handlers, caches } = setup();
    let pending!: Promise<unknown>;
    handlers.activate!({ waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
    expect(caches.delete).toHaveBeenCalledWith('uam-world-v2');
    expect(caches.delete).not.toHaveBeenCalledWith('other-app');
  });
  it.each(['/v1/me', '/v1/artworks', '/live', '/ready', '/_files/family/photo.jpg'])('never intercepts private or health request %s even offline', (path) => {
    const { handlers, cache, fetch } = setup();
    const respondWith = vi.fn();
    handlers.fetch!({ request: { method: 'GET', url: 'https://gallery.test' + path }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(cache.match).not.toHaveBeenCalled();
  });
  it('does not pre-cache private URLs supplied by a page', async () => {
    const { handlers, cache, fetch } = setup();
    fetch.mockResolvedValue(new Response('asset') as never);
    let pending!: Promise<unknown>;
    handlers.message!({ data: { type: 'cache-urls', urls: ['/v1/me', '/_files/photo', '/assets/app.js', 'http://['] }, waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/assets/app.js');
    expect(cache.put).toHaveBeenCalledTimes(1);
  });
  it.each(['private', 'no-store'])('does not pre-cache a %s response', async (control) => {
    const { handlers, cache, fetch } = setup();
    fetch.mockResolvedValue(new Response('private data', { headers: { 'cache-control': control } }) as never);
    let pending!: Promise<unknown>;
    handlers.message!({ data: { type: 'cache-urls', urls: ['/assets/app.js'] }, waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
    expect(cache.put).not.toHaveBeenCalled();
  });
  it.each(['/audio/bgm.mp3', '/icons/icon-512.png', '/favicon.svg'])('pre-caches deployed public asset %s', async (path) => {
    const { handlers, cache, fetch } = setup();
    fetch.mockResolvedValue(new Response('asset') as never);
    let pending!: Promise<unknown>;
    handlers.message!({ data: { type: 'cache-urls', urls: [path] }, waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
    expect(cache.put).toHaveBeenCalledWith(path, expect.any(Response));
  });
  it('does not pre-cache a static URL redirected to an authenticated endpoint', async () => {
    const { handlers, cache, fetch } = setup();
    const response = new Response('private data');
    Object.defineProperty(response, 'redirected', { value: true });
    fetch.mockResolvedValue(response as never);
    let pending!: Promise<unknown>;
    handlers.message!({ data: { type: 'cache-urls', urls: ['/assets/app.js'] }, waitUntil: (p: Promise<unknown>) => { pending = p; } });
    await pending;
    expect(cache.put).not.toHaveBeenCalled();
  });
});
