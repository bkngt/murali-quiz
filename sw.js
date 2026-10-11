/* BK Murali Quiz 107.1.3 compatibility shell. Delayed activation protects open exam pages. */
const CACHE_NAME = "murali-quiz-v107-1-3";

const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json"
];

const STATIC_ASSETS = [
    "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    "https://cdn.jsdelivr.net/npm/chart.js",
    "https://cdn-icons-png.flaticon.com/512/3176/3176298.png"
];

self.addEventListener("install", event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(["./index.html", "./manifest.json"]);
        try { await cache.add("./"); } catch (e) {}
        for (const url of STATIC_ASSETS) {
            try {
                if (url.includes("cdn-icons-png.flaticon.com")) {
                    const iconResponse = await fetch(url, { mode: "no-cors" });
                    if (iconResponse && (iconResponse.ok || iconResponse.type === "opaque")) await cache.put(url, iconResponse);
                } else {
                    await cache.add(url);
                }
            } catch (e) {}
        }
    })());
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(cacheNames => Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName.startsWith("murali-quiz-v") && cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                    return undefined;
                })
            ))
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET") return;
    const url = new URL(request.url);

    if (url.hostname.includes("script.google.com") || url.hostname.includes("googleusercontent.com")) return;
    if (request.mode === "navigate" && url.origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone).catch(() => {})).catch(() => {});
                    }
                    return response;
                })
                .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
        );
        return;
    }

    if (url.pathname.endsWith("/manifest.json") || url.pathname.endsWith("manifest.json")) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone).catch(() => {})).catch(() => {});
                    }
                    return response;
                })
                .catch(() => caches.match(request).then(cached => cached || caches.match("./manifest.json")))
        );
        return;
    }

    if (STATIC_ASSETS.includes(request.url)) {
        event.respondWith(
            caches.match(request).then(cached => {
                if (cached) return cached;
                return fetch(request, request.url.includes("cdn-icons-png.flaticon.com") ? { mode: "no-cors" } : undefined)
                    .then(response => {
                        if (response && (response.ok || response.type === "opaque")) {
                            const clone = response.clone();
                            caches.open(CACHE_NAME).then(cache => cache.put(request, clone).catch(() => {})).catch(() => {});
                        }
                        return response;
                    });
            })
        );
        return;
    }

    if (url.origin === self.location.origin) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, clone).catch(() => {})).catch(() => {});
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
    }
});
