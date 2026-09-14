const CACHE_NAME = "project-portal-v63";
const APP_SHELL = ["./index.html", "./404.html", "./glass.css?v=5", "./portal.css?v=32", "./diaphragm-wall.html", "./diaphragm-wall-gc.html", "./wall-gc.js?v=3", "./app.css?v=50", "./app.js?v=3", "./template.html", "./template.css?v=35", "./template.js?v=3", "./rebar.html", "./rebar.css?v=3", "./rebar.js?v=3", "./steel-structure.html", "./steel.css?v=4", "./steel.js?v=3", "./record.html", "./checklists.html", "./manifest.webmanifest", "./icon.svg", "./taisei.png", "./examples/diaphragm-wall-example.pdf", "./examples/diaphragm-wall-example-separate-pouring.pdf", "./examples/guide-wall-example.pdf", "./examples/rebar-cage-example.pdf", "./examples/diaphragm-wall-gc-example.pdf", "./examples/gc-guide-wall-example.pdf", "./examples/gc-rebar-cage-example.pdf", "./examples/template-example.pdf", "./examples/rebar-example.pdf", "./examples/steel-structure-example.pdf"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).pathname.endsWith("/sw.js")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => caches.open(CACHE_NAME).then(cache => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }))
        .catch(() => caches.match(event.request, { ignoreSearch: true })
          .then(cached => cached || caches.match("./index.html", { ignoreSearch: true })))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then(cached => cached || fetch(event.request).then(response => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }))
      .catch(() => caches.match("./index.html", { ignoreSearch: true }))
  );
});
