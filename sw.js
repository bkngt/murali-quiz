const CACHE_NAME = "murali-quiz-v106-4-13-fix1";

const APP_SHELL = [
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
        (async () => {
            try {
                const cache = await caches.open(CACHE_NAME);

                // Essential files: each failure is handled separately.
                await Promise.all(
                    APP_SHELL.map(async url => {
                        try {
                            const response = await fetch(url, {
                                cache: "no-cache"
                            });

                            if (response && response.ok) {
                                await cache.put(url, response);
                            }
                        } catch (error) {
                            // Network failure must not block SW installation.
                        }
                    })
                );

                // CDN files are fetched and cached when first requested.
                // Do not wait for external CDN services during installation.

            } catch (error) {
                // Keep installation resilient to Cache Storage errors.
                console.warn("SW install cache warning:", error);
            }

            // Intentionally no skipWaiting().
            // Do not force-reload an active examination.
        })()
    );
});


/* ==========================================================
   ACTIVATE
   ========================================================== */

self.addEventListener("activate", event => {
    event.waitUntil(
        (async () => {
            try {
                const cacheNames = await caches.keys();

                await Promise.all(
                    cacheNames.map(async cacheName => {
                        if (
                            cacheName.startsWith("murali-quiz-v") &&
                            cacheName !== CACHE_NAME
                        ) {
                            try {
                                await caches.delete(cacheName);
                            } catch (error) {
                                console.warn(
                                    "Old cache cleanup warning:",
                                    cacheName,
                                    error
                                );
                            }
                        }
                    })
                );
            } catch (error) {
                console.warn("SW activate warning:", error);
            }

            await self.clients.claim();
        })()
    );
});


/* ==========================================================
   FETCH
   ========================================================== */

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    // Only cache GET requests.
    if (request.method !== "GET") {
        return;
    }

    /* ------------------------------------------------------
       1. GOOGLE APPS SCRIPT / BACKEND
       Never intercept or cache backend requests.
       ------------------------------------------------------ */

    if (
        url.hostname.includes("script.google.com") ||
        url.hostname.includes("googleusercontent.com")
    ) {
        return;
    }

    /* ------------------------------------------------------
       2. EXTERNAL NAVIGATION
       ------------------------------------------------------ */

    if (
        request.mode === "navigate" &&
        url.origin !== self.location.origin
    ) {
        return;
    }

    /* ------------------------------------------------------
       3. PAGE NAVIGATION
       Network first; cached page if offline.
       ------------------------------------------------------ */

    if (request.mode === "navigate") {
        event.respondWith(
            (async () => {
                try {
                    const response = await fetch(request);

                    if (response && response.ok) {
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            await cache.put(request, response.clone());
                        } catch (error) {
                            // Return the network response even if caching fails.
                        }
                    }

                    return response;
                } catch (error) {
                    const cached = await caches.match(request);

                    if (cached) {
                        return cached;
                    }

                    const fallback = await caches.match("./index.html");

                    if (fallback) {
                        return fallback;
                    }

                    return new Response(
                        "इन्टरनेट उपलब्ध छैन। कृपया जडान गरेर पुनः प्रयास गर्नुहोस्।",
                        {
                            status: 503,
                            headers: {
                                "Content-Type": "text/plain; charset=utf-8"
                            }
                        }
                    );
                }
            })()
        );

        return;
    }

    /* ------------------------------------------------------
       4. MANIFEST
       ------------------------------------------------------ */

    if (url.pathname.endsWith("/manifest.json")) {
        event.respondWith(
            (async () => {
                try {
                    const response = await fetch(request);

                    if (response && response.ok) {
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            await cache.put(request, response.clone());
                        } catch (error) {
                            // Do not fail the request because of cache errors.
                        }
                    }

                    return response;
                } catch (error) {
                    const cached =
                        await caches.match(request) ||
                        await caches.match("./manifest.json");

                    if (cached) {
                        return cached;
                    }

                    return new Response(
                        JSON.stringify({
                            name: "BK Murali Quiz",
                            short_name: "Murali Quiz",
                            start_url: "./index.html",
                            display: "standalone"
                        }),
                        {
                            headers: {
                                "Content-Type": "application/manifest+json"
                            }
                        }
                    );
                }
            })()
        );

        return;
    }

    /* ------------------------------------------------------
       5. EXTERNAL STATIC ASSETS
       Cache first; network fallback.
       ------------------------------------------------------ */

    if (STATIC_ASSETS.includes(request.url)) {
        event.respondWith(
            (async () => {
                const cached = await caches.match(request);

                if (cached) {
                    return cached;
                }

                const response = await fetch(request);

                if (response && response.ok) {
                    try {
                        const cache = await caches.open(CACHE_NAME);
                        await cache.put(request, response.clone());
                    } catch (error) {
                        // Asset still works even if caching fails.
                    }
                }

                return response;
            })()
        );

        return;
    }

    /* ------------------------------------------------------
       6. OTHER SAME-ORIGIN GET REQUESTS
       Network first; cache fallback.
       ------------------------------------------------------ */

    if (url.origin === self.location.origin) {
        event.respondWith(
            (async () => {
                try {
                    const response = await fetch(request);

                    if (response && response.ok) {
                        try {
                            const cache = await caches.open(CACHE_NAME);
                            await cache.put(request, response.clone());
                        } catch (error) {
                            // Cache failure must not discard network response.
                        }
                    }

                    return response;
                } catch (error) {
                    const cached = await caches.match(request);

                    if (cached) {
                        return cached;
                    }

                    return new Response("", { status: 503 });
                }
            })()
        );
    }
});
