/* BK Murali Quiz 110.10 Auto-Update Service Worker */
const CACHE_NAME = "murali-quiz-v110-10";
const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./manifest.json",
    "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
    "https://cdn.jsdelivr.net/npm/chart.js",
    "https://cdn-icons-png.flaticon.com/512/3176/3176298.png"
];

self.addEventListener("install", event => {
    self.skipWaiting();
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(["./index.html", "./manifest.json"]);
        try { await cache.add("./"); } catch (e) {}
    })());
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.map(key => {
                if (key !== CACHE_NAME) return caches.delete(key);
            })
        )).then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", event => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.hostname.includes("script.google.com") || url.hostname.includes("googleusercontent.com")) return;

    if (req.mode === "navigate" || req.url.includes("index.html")) {
        event.respondWith(
            fetch(req).then(res => {
                const clone = res.clone();
                caches.open(CACHE_NAME).then(c => c.put(req, clone));
                return res;
            }).catch(() => caches.match(req).then(cached => cached || caches.match("./index.html")))
        );
        return;
    }

    event.respondWith(
        caches.match(req).then(cached => {
            const networkFetch = fetch(req).then(res => {
                if (res && (res.ok || res.type === "opaque")) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(req, clone));
                }
                return res;
            }).catch(() => {});
            return cached || networkFetch;
        })
    );
});
