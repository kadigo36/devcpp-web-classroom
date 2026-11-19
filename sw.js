const APP_CACHE = 'devcpp-web-classroom-v0.8';
const TOOLCHAIN_CACHE = 'devcpp-toolchain-v21.1.4-3';
const TOOLCHAIN_PREFIX = 'https://cdn.jsdelivr.net/npm/@yowasp/clang@21.1.4-3/';

const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/src/style.css',
  '/src/main.js',
  '/src/core.mjs',
  '/src/storage.mjs',
  '/src/compiler.mjs',
  '/src/compiler-worker.mjs',
  '/src/wasi-host.mjs',
];

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(APP_CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => ![APP_CACHE, TOOLCHAIN_CACHE].includes(key))
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event.request, APP_CACHE));
    return;
  }

  if (url.href.startsWith(TOOLCHAIN_PREFIX)) {
    event.respondWith(cacheFirst(event.request, TOOLCHAIN_CACHE));
  }
});
