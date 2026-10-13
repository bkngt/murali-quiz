/* BK Murali Quiz 108.1 offline-first service worker */
const CACHE_NAME = "murali-quiz-v108-1";

const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./manifest.json",
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
        caches.keys().then(cacheNames => Promise.all(
            cacheNames.map(cacheName => {
                if (cacheName.startsWith("murali-quiz-v") && cacheName !== CACHE_NAME) {
                    return caches.delete(cacheName);
                }
            })
        ))
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET") return;
    const url = new URL(request.url);

    if (url.hostname.includes("script.google.com") || url.hostname.includes("googleusercontent.com")) return;
    
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
                }).catch(() => {
                    if (request.mode === "navigate") return caches.match("./index.html");
                });
        })
    );
});
