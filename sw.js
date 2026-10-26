/* BK Murali Quiz 106.31 Service Worker - iPad iOS 12.8 (Safari 12) Safe & Instant Cache Bust */
const CACHE_NAME = "murali-quiz-v106-31";
const CACHE_PREFIX = "murali-quiz-v";
const APP_SHELL = new URL("./index.html", self.registration.scope).href;

async function safeCacheAdd_(cache, url) {
    try {
        await cache.add(new Request(url, { cache: "reload" }));
    } catch (e) {
        try { await cache.add(url); } catch (_) {}
    }
}

self.addEventListener("install", event => {
    self.skipWaiting();
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.all([
            safeCacheAdd_(cache, "./index.html"),
            safeCacheAdd_(cache, "./manifest.json")
        ]);
        await safeCacheAdd_(cache, "./");
    })());
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.hostname.includes("script.google.com") || url.hostname.includes("googleusercontent.com")) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const isPage = req.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/");
        if (isPage) {
            try {
                // iOS 12.8 Fix: Never pass a 'navigate' Request object with non-empty RequestInit to fetch()
                const response = await fetch(req.url, { cache: "no-store" }).catch(() => fetch(req));
                if (response && response.ok) {
                    cache.put("./index.html", response.clone()).catch(() => {});
                    cache.put(req, response.clone()).catch(() => {});
                }
                return response;
            } catch (e) {
                const cachedPage = (await cache.match(req, { ignoreSearch: true })) ||
                                   (await cache.match(APP_SHELL, { ignoreSearch: true })) ||
                                   (await cache.match("./index.html", { ignoreSearch: true }));
                return cachedPage || fetch(req);
            }
        }
        const cached = await cache.match(req, { ignoreSearch: true });
        const network = fetch(req).then(response => {
            if (response && (response.ok || response.type === "opaque")) cache.put(req, response.clone()).catch(() => {});
            return response;
        });
        if (cached) { network.catch(() => {}); return cached; }
        return network;
    })());
});
