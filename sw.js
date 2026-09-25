/*
 * BK MURALI QUIZ - SERVICE WORKER 98.0
 *
 * 98.0
 * - New cache namespace
 * - Removes old Murali Quiz caches on activation
 * - Network-first for HTML/navigation
 * - Network-first for manifest.json
 * - Never intercepts Google Apps Script API calls
 * - Cache-first only for known static assets
 * - Never returns index.html as a fallback for missing JS/CSS/assets
 * - Keeps app shell usable offline
 */

const APP_VERSION = '98.0';
const CACHE_NAME = `murali-quiz-v${APP_VERSION.replace(/\./g, '-')}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

const STATIC_CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

const APP_CACHE_ALLOWLIST = new Set([
  'index.html',
  'manifest.json',
  'sw.js',
  'jszip.min.js',
  'chart.js'
]);

function isAppsScriptRequest(request) {
  return request.url.includes('script.google.com');
}

function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    (
      request.method === 'GET' &&
      (request.headers.get('accept') || '').includes('text/html')
    )
  );
}

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isKnownCdnRequest(request) {
  return STATIC_CDN.some(
    url => request.url === url || request.url.startsWith(url + '?')
  );
}

function isAllowedStaticRequest(request) {
  if (!isSameOrigin(request)) {
    return isKnownCdnRequest(request);
  }

  const url = new URL(request.url);
  const fileName = url.pathname.split('/').pop() || '';

  return (
    APP_CACHE_ALLOWLIST.has(fileName) ||
    url.pathname === '/' ||
    url.pathname.endsWith('/')
  );
}

/* -----------------------------------------
   INSTALL
----------------------------------------- */

self.addEventListener('install', event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {

      /*
       * App shell is required for the new SW.
       * If one shell file fails, installation fails intentionally,
       * preventing a broken SW from taking control.
       */
      await cache.addAll(APP_SHELL);

      /*
       * External CDN files are optional.
       * Failure here must NOT block the new SW.
       */
      await Promise.all(
        STATIC_CDN.map(async url => {
          try {
            const response = await fetch(url, {
              cache: 'no-store'
            });

            if (
              response &&
              (response.ok || response.type === 'opaque')
            ) {
              await cache.put(url, response);
            }
          } catch (error) {
            // Network unavailable; CDN will be fetched later.
          }
        })
      );
    })
  );
});

/* -----------------------------------------
   ACTIVATE
----------------------------------------- */

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {

        const deletePromises = cacheNames
          .filter(name =>
            name.startsWith('murali-quiz-v') &&
            name !== CACHE_NAME
          )
          .map(name => caches.delete(name));

        return Promise.all(deletePromises);
      })
      .then(() => self.clients.claim())
  );
});

/* -----------------------------------------
   NETWORK FIRST
----------------------------------------- */

async function networkFirst(request, fallbackRequest = request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);

    if (
      response &&
      (response.ok || response.type === 'opaque')
    ) {
      await cache.put(
        fallbackRequest,
        response.clone()
      );
    }

    return response;

  } catch (error) {

    const cached = await cache.match(fallbackRequest);

    if (cached) {
      return cached;
    }

    throw error;
  }
}

/* -----------------------------------------
   CACHE FIRST
----------------------------------------- */

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (
      response &&
      (response.ok || response.type === 'opaque')
    ) {
      await cache.put(
        request,
        response.clone()
      );
    }

    return response;

  } catch (error) {

    /*
     * IMPORTANT:
     * Do NOT return index.html for failed JS/CSS/image requests.
     * That can create misleading MIME/type errors.
     */
    return new Response('', {
      status: 504,
      statusText: 'Gateway Timeout'
    });
  }
}

/* -----------------------------------------
   FETCH
----------------------------------------- */

self.addEventListener('fetch', event => {

  const request = event.request;

  /* Only GET requests are cache-managed */
  if (request.method !== 'GET') {
    return;
  }

  /* NEVER intercept Google Apps Script API */
  if (isAppsScriptRequest(request)) {
    return;
  }

  /* ---------------------------------------
     NAVIGATION / HTML
     --------------------------------------- */

  if (isNavigationRequest(request)) {
    event.respondWith(
      networkFirst(
        request,
        './index.html'
      )
    );
    return;
  }

  /* ---------------------------------------
     SAME ORIGIN
     --------------------------------------- */

  if (isSameOrigin(request)) {

    const url = new URL(request.url);

    /* Manifest = Network First */
    if (url.pathname.endsWith('/manifest.json')) {
      event.respondWith(
        networkFirst(
          request,
          './manifest.json'
        )
      );
      return;
    }

    /* Known app/static assets */
    if (isAllowedStaticRequest(request)) {
      event.respondWith(
        cacheFirst(request)
      );
      return;
    }

    /*
     * Unknown same-origin GET requests
     * remain untouched.
     */
    return;
  }

  /* ---------------------------------------
     THIRD-PARTY CDN
     --------------------------------------- */

  if (isKnownCdnRequest(request)) {
    event.respondWith(
      cacheFirst(request)
    );
  }

});

/* -----------------------------------------
   MESSAGE
----------------------------------------- */

self.addEventListener('message', event => {

  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

});
