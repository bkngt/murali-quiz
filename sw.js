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

/* ==========================================================
   INSTALL
   ========================================================== */

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
                            // CDN unavailable: app can still work.
                        }
                    }
                });
            })
            .then(() => self.skipWaiting())
    );
});


/* ==========================================================
   ACTIVATE
   ========================================================== */

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

                        return undefined;
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});


/* ==========================================================
   FETCH
   ========================================================== */

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);


    /* ------------------------------------------------------
       1. GOOGLE APPS SCRIPT / BACKEND

       NEVER intercept or cache backend requests.

       Important for:
       - Login
       - Exam Security
       - Exam Session
       - Result Save
       - Student Rank
       - Admin Rank
       - Chart Sync
       ------------------------------------------------------ */

    if (
        url.hostname.includes("script.google.com") ||
        url.hostname.includes("googleusercontent.com")
    ) {
        return;
    }


    /* ------------------------------------------------------
       2. EXTERNAL NAVIGATION

       IMPORTANT FIX FOR iPhone / iPad.

       Links such as:
       https://www.madhubanmurli.org/#ne

       must be handled directly by Safari/Chrome,
       not by this Service Worker.
       ------------------------------------------------------ */

    if (
        request.mode === "navigate" &&
        url.origin !== self.location.origin
    ) {
        return;
    }


    /* ------------------------------------------------------
       3. SAME-ORIGIN PAGE NAVIGATION

       Network first:
       - gets newest index.html
       - falls back to cache when offline
       ------------------------------------------------------ */

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(response => {

                    if (response && response.ok) {
                        const clone = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(request, clone);
                            })
                            .catch(() => {});
                    }

                    return response;
                })
                .catch(() => {

                    return caches.match(request)
                        .then(cached => {

                            if (cached) {
                                return cached;
                            }

                            return caches.match("./index.html");
                        });
                })
        );

        return;
    }


    /* ------------------------------------------------------
       4. MANIFEST

       Network first so updated manifest is picked up.
       ------------------------------------------------------ */

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
                            .then(cache => {
                                cache.put(request, clone);
                            })
                            .catch(() => {});
                    }

                    return response;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );

        return;
    }


    /* ------------------------------------------------------
       5. KNOWN CDN ASSETS

       JSZip + Chart.js
       ------------------------------------------------------ */

    const isStaticAsset =
        request.url ===
            "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js" ||
        request.url ===
            "https://cdn.jsdelivr.net/npm/chart.js";

    if (isStaticAsset) {
        event.respondWith(
            caches.match(request)
                .then(cached => {

                    if (cached) {
                        return cached;
                    }

                    return fetch(request)
                        .then(response => {

                            if (response && response.ok) {
                                const clone = response.clone();

                                caches.open(CACHE_NAME)
                                    .then(cache => {
                                        cache.put(request, clone);
                                    })
                                    .catch(() => {});
                            }

                            return response;
                        });
                })
        );

        return;
    }


    /* ------------------------------------------------------
       6. OTHER SAME-ORIGIN FILES

       Network first, cache fallback.
       ------------------------------------------------------ */

    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(request)
                .then(response => {

                    if (response && response.ok) {
                        const clone = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(request, clone);
                            })
                            .catch(() => {});
                    }

                    return response;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
    }

});
