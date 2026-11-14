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
const CACHE_VERSION = "ahmadia-academy-v3";
const APP_SHELL = [
  "./",
  "./index.html",
  "./admin.html",
  "./article.html",
  "./css/style.css",
  "./css/admin.css",
  "./js/firebase-config.js",
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

  // HTML navigations: network-first (keeps academy data fresh)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
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
