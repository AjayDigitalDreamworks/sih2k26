// Raahi Driver App — minimal offline shell.
// Network-first for navigations; never caches POST tracking payloads.
const CACHE = 'raahi-shell-v1';
const SHELL = ['/', '/driver', '/manifest.webmanifest', '/icons/raahi-192.svg', '/icons/raahi-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // never intercept tracking uploads
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network first, cached shell as offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('/driver') || caches.match('/')))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => null);
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
