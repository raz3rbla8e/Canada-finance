const CACHE_NAME = 'boreal-v4';
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
  // Network-first for everything: use network, update cache, fall back to cache offline
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache a copy of successful GET responses
        if (event.request.method === 'GET' && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            const url = new URL(event.request.url);
            url.search = '';
            cache.put(new Request(url.toString()), clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline: try cache without query params
        const url = new URL(event.request.url);
        url.search = '';
        return caches.match(new Request(url.toString()));
      })
  );
});
