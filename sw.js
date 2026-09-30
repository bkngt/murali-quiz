const CACHE_NAME = "murali-quiz-v104-0";

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
                        } catch (e) {}
                    }
                });
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames.map(cacheName => {
                    if (
                        cacheName.startsWith("murali-quiz-v") &&
                        cacheName !== CACHE_NAME
                    ) {
                        return caches.delete(cacheName);
                    }
                    return undefined;
                })
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    /*
     * ==========================================================
     * GOOGLE APPS SCRIPT / BACKEND
     * ==========================================================
     * Backend requests MUST NEVER be cached or intercepted.
     * This is important for:
     * - Exam security checks
     * - Exam session status
     * - Result submission
     * - Student Rank
     * - Admin Rank
     */
    if (
        url.hostname.includes("script.google.com") ||
        url.hostname.includes("googleusercontent.com")
    ) {
        return;
    }

    /*
     * ==========================================================
     * PAGE / NAVIGATION
     * ==========================================================
     * Network first:
     * Always try to obtain the newest index.html.
     * If offline, use cached version.
     */
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();

                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, clone);
                        });
                    }

                    return response;
                })
                .catch(() => {
                    return caches.match(request).then(cached => {
                        return cached || caches.match("./index.html");
                    });
                })
        );

        return;
    }

    /*
     * ==========================================================
     * MANIFEST
     * ==========================================================
     * Network first so that manifest changes are detected quickly.
     */
    if (
        url.pathname.endsWith("/manifest.json") ||
        url.pathname.endsWith("manifest.json")
    ) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const clone = response.clone();

                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, clone);
                    });

                    return response;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );

        return;
    }

    /*
     * ==========================================================
     * STATIC CDN ASSETS
     * ==========================================================
     * JSZip + Chart.js are cache-first.
     */
    const isStaticAsset =
        request.url ===
            "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" ||
        request.url ===
            "https://cdn.jsdelivr.net/npm/chart.js";

    if (isStaticAsset) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) {
                    return cached;
                }

                return fetch(request).then(response => {
                    const clone = response.clone();

                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(request, clone);
                    });

                    return response;
                });
            })
        );

        return;
    }

    /*
     * ==========================================================
     * SAME-ORIGIN FILES
     * ==========================================================
     * Network first for HTML/CSS/JS/images/etc.
     * Cached version is used only when network fails.
     */
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();

                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, clone);
                        });
                    }

                    return response;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
    }
});
