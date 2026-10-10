/* Chart V4 / app shell 107.0.4. Keeps skipWaiting disabled so active exams are not interrupted. */
const CACHE_NAME = "murali-quiz-v107-0-4";

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
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);

        // Cache the core page and manifest atomically. If either fails, installation
        // rejects and the previous active worker/cache remains available.
        await cache.addAll(["./index.html", "./manifest.json"]);

        // Root navigation and CDNs are optional: their failure must not prevent
        // a new shell from installing when the two core files are available.
        try { await cache.add("./"); } catch (e) {}
        for (const url of STATIC_ASSETS) {
            try { await cache.add(url); } catch (e) {}
        }

        // skipWaiting() remains intentionally disabled so active exams are not interrupted.
    })());
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

       Online  -> newest page first
       Offline -> cached page fallback
       ====================================================== */

    if (request.mode === "navigate") {

        event.respondWith(

            fetch(request)

                .then(response => {

                    if (response && response.ok) {

                        const clone = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache =>
                                cache.put(request, clone).catch(() => {})
                            )
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


    /* ======================================================
       4. MANIFEST
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
                            .then(cache =>
                                cache.put(request, clone).catch(() => {})
                            )
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
       Cache first for JSZip + Chart.js
       ====================================================== */

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
                                    .then(cache =>
                                        cache.put(request, clone)
                                            .catch(() => {})
                                    )
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
       Network first + cache fallback
       ====================================================== */

    if (url.origin === self.location.origin) {

        event.respondWith(

            fetch(request)

                .then(response => {

                    if (response && response.ok) {

                        const clone = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache =>
                                cache.put(request, clone).catch(() => {})
                            )
                            .catch(() => {});
                    }

                    return response;
                })

                .catch(() => caches.match(request))
        );
    }

});
