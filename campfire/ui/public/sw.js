// Campfire service worker — basic offline + asset caching
const CACHE_NAME = "campfire-v1";
const ASSETS = [
  "/apps/campfire/",
  "/apps/campfire/index.html",
  "/apps/campfire/manifest.json",
  "/apps/campfire/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API/airlock/SSE — must hit network
  if (
    url.pathname.startsWith("/~/") ||
    url.pathname.startsWith("/apps/campfire/public/api/") ||
    url.pathname === "/session.js"
  ) {
    return;
  }

  // GET requests for app assets: cache-first with network fallback
  if (event.request.method === "GET" && url.pathname.startsWith("/apps/campfire/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Update cache in background
          fetch(event.request)
            .then((res) => {
              if (res && res.ok) {
                caches.open(CACHE_NAME).then((c) => c.put(event.request, res));
              }
            })
            .catch(() => {});
          return cached;
        }
        return fetch(event.request).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        });
      })
    );
  }
});
