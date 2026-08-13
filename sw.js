const CACHE = "agent-cmd-v2";
const ASSETS = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first with cache fallback for offline. Only successful responses are
// cached, and parameterised API queries (file searches etc.) are skipped so the
// cache doesn't grow without bound.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const skipCache = url.pathname.startsWith("/api/") && url.search;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && !skipCache) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((m) => m || new Response("Offline", { status: 503, statusText: "Offline" }))
      )
  );
});
