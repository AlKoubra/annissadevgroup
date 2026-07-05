const CACHE = 'annissa-v3';
const SHELL = [
  '/admin/',
  '/admin/index.html',
  '/css/admin.css',
  '/js/admin.js',
  '/favicon-192.png',
  '/favicon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  // Navigation requests: always network (iOS Safari rejects SW-served redirects)
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request));
    return;
  }
  // API calls: network first, no cache
  if (request.url.includes('/api/')) {
    e.respondWith(fetch(request));
    return;
  }
  // Static assets: cache first, network fallback
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
