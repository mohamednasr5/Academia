// =====================================================================
// Service Worker — Academia Al-Ahmadia PWA v3
// Strategy:
//   - Precache the app shell on install (instant offline boot)
//   - Navigation requests (HTML): network-first, fall back to cache
//     then to index.html (so dynamic academy data is never stale).
//   - Static assets (CSS/JS): stale-while-revalidate.
//   - Images: cache-first with background refresh.
//   - Firebase / analytics / non-GET: bypass the SW entirely.
// Handles SKIP_WAITING messages for instant updates.
// =====================================================================
const CACHE_VERSION = "ahmadia-academy-v10";
const APP_SHELL = [
  "./",
  "./index.html",
  "./admin.html",
  "./article.html",
  "./css/style.css",
  "./css/admin.css",
  "./js/default-data.js",
  "./js/data-service.js",
  "./js/app.js",
  "./js/admin.js",
  "./js/article.js",
  "./manifest.json",
  "./images/logo.jpg",
  "./images/icons/icon-192.png",
  "./images/icons/icon-512.png",
  "./images/icons/apple-touch-icon.png",
  "./images/icons/favicon.ico"
];

const BYPASS_HOSTS = ["firebaseio.com", "googleapis.com", "gstatic.com", "jsdelivr.net"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (BYPASS_HOSTS.some((h) => url.hostname.includes(h))) return;

  // HTML navigations: stale-while-revalidate.
  // Return the cached page immediately; refresh it quietly for the next visit.
  if (req.mode === "navigate") {
    const cachePromise = caches.open(CACHE_VERSION);
    const refreshPromise = cachePromise.then(cache =>
      fetch(req).then(response => {
        if (response && response.ok) cache.put(req, response.clone());
        return response;
      })
    );
    // Register background refresh during the fetch event, not after an await.
    event.waitUntil(refreshPromise.then(() => {}).catch(() => {}));
    event.respondWith((async () => {
      const cache = await cachePromise;
      const cached = await cache.match(req) || await cache.match("./index.html");
      if (cached) return cached;
      try {
        const response = await refreshPromise;
        if (response) return response;
      } catch (_) {}
      return new Response("الصفحة غير متاحة حالياً", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    })());
    return;
  }

  // Images: cache-first + background refresh
  if (req.destination === "image") {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Static assets (CSS/JS/manifest): stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
