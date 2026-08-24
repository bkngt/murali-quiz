const CACHE_NAME = 'murali-quiz-v79';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
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
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// NETWORK FIRST STRATEGY (सधैं नयाँ भर्सन तान्ने नियम)
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // इन्टरनेट छ भने नयाँ भर्सन ल्याउने र सेभ गर्ने
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
      .catch(() => {
        // इन्टरनेट छैन भने मात्र पुरानो सेभ भएको भर्सन देखाउने
        return caches.match(event.request);
      })
  );
});
