const CACHE_NAME = "murali-quiz-v106-1";

const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json"
];

const STATIC_ASSETS = [
    "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    "https://cdn.jsdelivr.net/npm/chart.js"
];

/* ==========================================================
   INSTALL
   ========================================================== */

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                // App shell
                for (const url of APP_SHELL) {
                    try {
                        await cache.add(url);
                    } catch (e) {
                        // One failed shell resource should not abort the whole SW install.
                    }
                }

                // CDN assets
                for (const url of STATIC_ASSETS) {
                    try {
                        await cache.add(url);
                    } catch (e) {
                        // CDN unavailable हुँदा app installation fail नगराउने।
                    }
                }
            })
            // IMPORTANT: no skipWaiting().
            // नयाँ SW तुरुन्त active हुँदैन; यसले चलिरहेको exam page लाई disturb गर्दैन।
    );
});


/* ==========================================================
   ACTIVATE
   ========================================================== */

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
            // New worker activates only after the old worker is no longer controlling
            // active pages, so claiming here does not force a live exam to reload.
            .then(() => self.clients.claim())
    );
});


/* ==========================================================
   FETCH
   ========================================================== */

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    /* ======================================================
       1. GOOGLE APPS SCRIPT / BACKEND

       NEVER cache/intercept backend requests.
       Includes:
       - Login
       - Exam Security
       - Exam Session / 48H check
       - Result Save
       - Student Rank
       - Admin Rank
       - Chart Sync
       - Quiz Sync
       - Stats Sync
       ====================================================== */
    if (
        url.hostname.includes("script.google.com") ||
        url.hostname.includes("googleusercontent.com")
    ) {
        return;
    }

    /* ======================================================
       2. EXTERNAL NAVIGATION
       ====================================================== */
    if (
        request.mode === "navigate" &&
        url.origin !== self.location.origin
    ) {
        return;
    }

    /* ======================================================
       3. SAME-ORIGIN NAVIGATION

       NETWORK FIRST
       Online  -> newest index.html, then cache update
       Offline -> cached index.html

       No forced reload is triggered by the SW.
       ====================================================== */
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(request, clone).catch(() => {}))
                            .catch(() => {});
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then(cached => {
                        if (cached) return cached;
                        return caches.match("./index.html");
                    });
                })
        );
        return;
    }

    /* ======================================================
       4. MANIFEST
       Network first so the newest manifest is preferred.
       ====================================================== */
    if (
        url.pathname.endsWith("/manifest.json") ||
        url.pathname.endsWith("manifest.json")
    ) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(request, clone).catch(() => {}))
                            .catch(() => {});
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    /* ======================================================
       5. KNOWN CDN ASSETS

       Cache first for JSZip + Chart.js.
       ====================================================== */
    const isStaticAsset =
        request.url === "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" ||
        request.url === "https://cdn.jsdelivr.net/npm/chart.js";

    if (isStaticAsset) {
        event.respondWith(
            caches.match(request)
                .then(cached => {
                    if (cached) return cached;
                    return fetch(request).then(response => {
                        if (response && response.ok) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => cache.put(request, clone).catch(() => {}))
                                .catch(() => {});
                        }
                        return response;
                    });
                })
        );
        return;
    }

    /* ======================================================
       6. OTHER SAME-ORIGIN REQUESTS
       Network first + cache fallback.
       ====================================================== */
    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(request, clone).catch(() => {}))
                            .catch(() => {});
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
    }
});
