const CACHE_NAME = 'murali-quiz-v90-1-0';

const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', event => {
  // नयाँ Service Worker लाई तुरुन्तै waiting state मा नराखी activate गराउने
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(URLS_TO_CACHE))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // नयाँ Service Worker ले तुरुन्तै सबै open pages control गरोस्
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // POST/API request cache नगर्ने
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('script.google.com')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // सफल network response लाई नयाँ cache मा राख्ने
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // Internet नभए cache बाट चलाउने
        return caches.match(event.request);
      })
  );
});
