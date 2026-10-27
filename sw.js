/* BK Murali Quiz 107.1 Service Worker - Instant Offline-First App Shell + iOS 12.8 & AdGuard Safe */
const CACHE_NAME = "murali-quiz-v107-1";
const CACHE_PREFIX = "murali-quiz-v";
const APP_SHELL = new URL("./index.html", self.registration.scope).href;

async function safeCacheAdd_(cache, url) {
    try {
        await cache.add(new Request(url, { cache: "reload" }));
    } catch (e) {
        try { await cache.add(url); } catch (_) {}
    }
}

function isValidHtmlResponse_(response, reqUrl) {
    if (!response || !response.ok || response.status !== 200) return false;
    const lowerUrl = String(reqUrl || "").toLowerCase();
    if (lowerUrl.includes("adguard") || lowerUrl.includes("userscript") || lowerUrl.endsWith(".js")) return false;
    const ct = (response.headers && response.headers.get("content-type")) || "";
    return ct.toLowerCase().includes("text/html");
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
    if (url.hostname.includes("adguard") || url.href.toLowerCase().includes("userscript")) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const isPage = (req.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/")) &&
                       !url.pathname.endsWith(".js") && !url.pathname.endsWith(".json");
        if (isPage) {
            const cachedPage = (await cache.match("./index.html", { ignoreSearch: true })) ||
                               (await cache.match(APP_SHELL, { ignoreSearch: true })) ||
                               (await cache.match(req));
            const networkFetch = fetch(req.url, { cache: "no-store" }).catch(() => fetch(req)).then(response => {
                if (isValidHtmlResponse_(response, req.url)) {
                    cache.put("./index.html", response.clone()).catch(() => {});
                    cache.put(APP_SHELL, response.clone()).catch(() => {});
                }
                return response;
            });
            // Offline-First (Stale-While-Revalidate): क्यासमा भए ०.१ सेकेन्डमै खोल्ने र पछाडि अपडेट गर्ने!
            if (cachedPage) {
                networkFetch.catch(() => {});
                return cachedPage;
            }
            try {
                const netResp = await networkFetch;
                if (netResp && netResp.ok) return netResp;
            } catch (e) {}
            return cachedPage || fetch(req);
        }
        const cached = await cache.match(req);
        const network = fetch(req).then(response => {
            if (response && (response.ok || response.type === "opaque")) {
                cache.put(req, response.clone()).catch(() => {});
            }
            return response;
        });
        if (cached) { network.catch(() => {}); return cached; }
        return network;
    })());
});
