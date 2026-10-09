const CACHE_NAME = "murali-quiz-v106-4-14-fix2";
const SHELL_TIMEOUT_MS = 5000;
const NETWORK_TIMEOUT_MS = 6000;

const APP_SHELL = ["./index.html"];

const STATIC_ASSETS = [
    "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    "https://cdn.jsdelivr.net/npm/chart.js"
];

async function fetchWithTimeout(request, timeoutMs = NETWORK_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(request, {
            signal: controller.signal
        });
    } finally {
        clearTimeout(timer);
    }
}


/* ==========================================================
   INSTALL
   Manifest/CDN लाई Install को समयमा डाउनलोड गरिँदैन।
   ========================================================== */

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE_NAME);

            await Promise.all(
                APP_SHELL.map(async url => {
                    try {
                        const response = await fetchWithTimeout(
                            url,
                            SHELL_TIMEOUT_MS
                        );

                        if (response && response.ok) {
                            await cache.put(url, response);
                        }
                    } catch (error) {
                        // Network/timeout failure ले स्थापना रोकिन दिँदैन।
                    }
                })
            );

        } catch (error) {
            console.warn("SW install warning:", error);
        }

        // skipWaiting() प्रयोग गरिएको छैन।
        // चलिरहेको परीक्षालाई जबर्जस्ती Reload गर्दैन।
    })());
});


/* ==========================================================
   ACTIVATE
   ========================================================== */

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
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
    })());
});


/* ==========================================================
   FETCH
   ========================================================== */

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    // GET बाहेकका अनुरोधमा हस्तक्षेप नगर्ने।
    if (request.method !== "GET") {
        return;
    }

    // Google Apps Script / Backend अनुरोध क्यास नगर्ने।
    if (
        url.hostname.includes("script.google.com") ||
        url.hostname.includes("googleusercontent.com")
    ) {
        return;
    }

    // Manifest अनुरोध ब्राउजरलाई सीधै गर्न दिने।
    if (
        url.pathname.endsWith("/manifest.json") ||
        url.pathname === "/manifest.json" ||
        url.pathname.endsWith("manifest.json")
    ) {
        return;
    }

    // बाह्य वेबसाइटको Navigation मा हस्तक्षेप नगर्ने।
    if (
        request.mode === "navigate" &&
        url.origin !== self.location.origin
    ) {
        return;
    }


    /* ======================================================
       1. PAGE NAVIGATION
       Online: Network first
       Offline: Cached page fallback
       ====================================================== */

    if (request.mode === "navigate") {
        event.respondWith((async () => {
            try {
                const response = await fetchWithTimeout(
                    request,
                    NETWORK_TIMEOUT_MS
                );

                if (response && response.ok) {
                    try {
                        const cache = await caches.open(CACHE_NAME);
                        await cache.put(request, response.clone());
                    } catch (error) {
                        // Cache असफल भए पनि Network response प्रयोग गर्ने।
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
                    "इन्टरनेट उपलब्ध छैन। पुनः प्रयास गर्नुहोस्।",
                    {
                        status: 503,
                        headers: {
                            "Content-Type": "text/plain; charset=utf-8"
                        }
                    }
                );
            }
        })());

        return;
    }


    /* ======================================================
       2. CDN ASSETS
       Cache first; पहिलो पटक आवश्यक हुँदा मात्र डाउनलोड।
       ====================================================== */

    if (STATIC_ASSETS.includes(request.url)) {
        event.respondWith((async () => {
            const cached = await caches.match(request);

            if (cached) {
                return cached;
            }

            const response = await fetchWithTimeout(
                request,
                NETWORK_TIMEOUT_MS
            );

            if (response && response.ok) {
                try {
                    const cache = await caches.open(CACHE_NAME);

                    await cache.put(
                        request,
                        response.clone()
                    );
                } catch (error) {
                    // Cache असफल भए पनि Asset response प्रयोग गर्ने।
                }
            }

            return response;
        })());

        return;
    }


    /* ======================================================
       3. OTHER SAME-ORIGIN GET REQUESTS
       Network first; offline मा Cache fallback।
       ====================================================== */

    if (url.origin === self.location.origin) {
        event.respondWith((async () => {
            try {
                const response = await fetchWithTimeout(
                    request,
                    NETWORK_TIMEOUT_MS
                );

                if (response && response.ok) {
                    try {
                        const cache = await caches.open(CACHE_NAME);

                        await cache.put(
                            request,
                            response.clone()
                        );
                    } catch (error) {
                        // Cache असफल भए पनि अनुरोधको response कायम राख्ने।
                    }
                }

                return response;

            } catch (error) {
                const cached = await caches.match(request);

                if (cached) {
                    return cached;
                }

                return new Response("", {
                    status: 503
                });
            }
        })());
    }
});
