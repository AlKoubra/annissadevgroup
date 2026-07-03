const CACHE = 'annissa-v1';
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
  // API calls : réseau d'abord, pas de cache
  if (request.url.includes('/api/')) {
    e.respondWith(fetch(request));
    return;
  }
  // Shell : cache d'abord, réseau en fallback
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
