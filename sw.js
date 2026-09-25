const CACHE_NAME = "murali-quiz-v100-0";

const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json"
];

const STATIC_ASSETS = [
    "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    "https://cdn.jsdelivr.net/npm/chart.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_SHELL))
            .then(() => {
                return caches.open(CACHE_NAME).then(async cache => {
                    for (const url of STATIC_ASSETS) {
                        try {
                            await cache.add(url);
                        } catch (e) {
                            // CDN asset failed; app can fetch it from network later.
                        }
                    }
                });
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (
                            cacheName.startsWith("murali-quiz-v") &&
                            cacheName !== CACHE_NAME
                        ) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    // Never intercept Google Apps Script / backend requests.
    if (
        url.hostname.includes("script.google.com") ||
        url.hostname.includes("googleusercontent.com")
    ) {
        return;
    }

    // Navigation requests: Network First, then cached index.
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const responseClone = response.clone();

                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });

                    return response;
                })
                .catch(() => {
                    return caches.match(request)
                        .then(cached => cached || caches.match("./index.html"));
                })
        );
        return;
    }

    // Manifest: Network First.
    if (url.pathname.endsWith("/manifest.json") || url.pathname.endsWith("manifest.json")) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const responseClone = response.clone();

                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, responseClone);
                    });

                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // Known static assets: Cache First.
    const isStaticAsset =
        request.url === "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" ||
        request.url === "https://cdn.jsdelivr.net/npm/chart.js";

    if (isStaticAsset) {
        event.respondWith(
            caches.match(request)
                .then(cached => {
                    if (cached) return cached;

                    return fetch(request).then(response => {
                        const responseClone = response.clone();

                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseClone);
                        });

                        return response;
                    });
                })
        );

        return;
    }

    // Other same-origin files: Network First, then cache.
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const responseClone = response.clone();

                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseClone);
                        });
                    }

                    return response;
                })
                .catch(() => caches.match(request))
        );
    }
});
