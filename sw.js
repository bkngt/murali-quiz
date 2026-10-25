/* BK Murali Quiz 110.30 Service Worker - Exam-Safe & Instant Cache Bust */
const CACHE_NAME = "murali-quiz-v110-30";
const CACHE_PREFIX = "murali-quiz-v";
const APP_SHELL = new URL("./index.html", self.registration.scope).href;

self.addEventListener("install", event => {
    self.skipWaiting();
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.all([
            cache.add(new Request("./index.html", { cache: "reload" })),
            cache.add(new Request("./manifest.json", { cache: "reload" }))
        ]);
        try { await cache.add(new Request("./", { cache: "reload" })); } catch (e) {}
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
        const isPage = req.mode === "navigate" || url.pathname.endsWith("/index.html");
        if (isPage) {
            try {
                const response = await fetch(req, { cache: "no-store" });
                if (response && response.ok) cache.put(req, response.clone()).catch(() => {});
                return response;
            } catch (e) {
                return (await cache.match(req)) || (await cache.match(APP_SHELL)) || Response.error();
            }
        }
        const cached = await cache.match(req);
        const network = fetch(req).then(response => {
            if (response && (response.ok || response.type === "opaque")) cache.put(req, response.clone()).catch(() => {});
            return response;
        });
        if (cached) { network.catch(() => {}); return cached; }
        return network;
    })());
});
