/* BK Murali Quiz 117.2 Service Worker - Instant Offline-First App Shell + iOS 12.8 & AdGuard Safe */
const CACHE_NAME = "murali-quiz-v117-2";
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
    // Do not force a new Service Worker to take over an exam already in progress.
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
        // Existing pages keep their original controller until the next navigation.
    })());
});

self.addEventListener("fetch", event => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return; // never intercept AdGuard/Google/CDN responses
    const isPage = req.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/");
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        if (isPage) {
            const cached = (await cache.match("./index.html",{ignoreSearch:true})) || await cache.match(req,{ignoreSearch:true});
            const fromNet = fetch(req,{cache:"no-store"}).then(async response => {
                if (isValidHtmlResponse_(response,req.url)) {
                    try { await cache.put("./index.html",response.clone()); } catch (_) {}
                }
                return response;
            });
            // Prefer the latest HTML. Offline/slow network still uses the app shell.
            if (cached) {
                const outcome = await Promise.race([
                    fromNet.then(r=>({ok:true,r}),()=>({ok:false})),
                    new Promise(resolve=>setTimeout(()=>resolve({ok:false}),2600))
                ]);
                if(outcome.ok && outcome.r && outcome.r.ok) return outcome.r;
                fromNet.catch(()=>{});
                return cached;
            }
            try { return await fromNet; } catch(e) { return fetch(req); }
        }
        const cached=await cache.match(req);
        try {
            const response=await fetch(req);
            if(response && response.ok) { cache.put(req,response.clone()).catch(()=>{}); return response; }
            return cached||response;
        } catch(e) { if(cached)return cached;throw e; }
    })());
});
