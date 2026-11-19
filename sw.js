const CACHE = 'devcpp-web-classroom-v0.5';
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

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});
