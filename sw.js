const CACHE_NAME = "portable-inspection-v73";
const APP_SHELL = ["./index.html", "./404.html", "./glass.css", "./portal.css", "./portal.js", "./draft.js", "./diaphragm-wall.html", "./diaphragm-wall-gc.html", "./wall-gc.js", "./app.css", "./app.js", "./template.html", "./template.css", "./template.js", "./rebar.html", "./rebar.css", "./rebar.js", "./steel-structure.html", "./steel.css", "./steel.js", "./record.html", "./checklists.html", "./manifest.webmanifest", "./app-icon.png", "./icon.svg", "./taisei.png", "./examples/diaphragm-wall-example.pdf", "./examples/diaphragm-wall-example-separate-pouring.pdf", "./examples/guide-wall-example.pdf", "./examples/rebar-cage-example.pdf", "./examples/diaphragm-wall-gc-example.pdf", "./examples/gc-guide-wall-example.pdf", "./examples/gc-rebar-cage-example.pdf", "./examples/template-example.pdf", "./examples/rebar-example.pdf", "./examples/steel-structure-example.pdf"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: "reload" }))))
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
