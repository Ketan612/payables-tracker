const CACHE_NAME = "payables-shell-v7";
const SHELL_ASSETS = [
  "./offline.html",
  "./manifest.json",
  "./icons/payables-tracker.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./styles.css",
  "./app.js",
  "./cashbook.css",
  "./cashbook.js",
  "./sms-capture.css",
  "./sms-capture.js",
  "./sms-admin.js",
  "./pwa.js"
];

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("payables-shell-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept writes, cross-origin requests, auth/API traffic, or non-HTTP schemes.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.includes("/rest/") || url.pathname.includes("/auth/") ||
      url.pathname.includes("/functions/") || url.pathname.includes("/storage/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("./offline.html")) ||
          new Response("You are offline. Reconnect and try again.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      })
    );
    return;
  }

  const isShellAsset = SHELL_ASSETS.some((asset) => url.pathname.endsWith(asset.replace("./", "")));
  if (!isShellAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }))
  );
});