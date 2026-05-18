const CACHE_NAME = 'boreal-v2';
const STATIC_ASSETS = [
  '/',
  '/static/css/style.css',
  '/static/js/app.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Network-first for API calls, cache-first for static assets
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
  } else {
    // Strip query params for cache matching (cache-bust params like ?v=xxx)
    const url = new URL(event.request.url);
    url.search = '';
    const cleanRequest = new Request(url.toString(), event.request);
    event.respondWith(
      caches.match(cleanRequest).then(cached => cached || fetch(event.request))
    );
  }
});
