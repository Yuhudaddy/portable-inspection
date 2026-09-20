const CACHE_NAME = "portable-inspection-v104";
// 範例 PDF（共約 8MB）不放進 shell：每次升版都要整批重抓，手機上安裝又慢又容易失敗；範例本來就需要連線。
const APP_SHELL = ["./", "./404", "./glass.css", "./portal.css", "./portal.js", "./sw-client.js", "./draft.js", "./print-pages.js", "./dialog-forms.js", "./bar-sizes.js", "./rebar-cage.js", "./plan", "./plan.js", "./plan.css", "./plans/diaphragm-wall-gc.js", "./plans/diaphragm-wall.js", "./plans/formwork.js", "./plans/rebar.js", "./plans/steel.js", "./example", "./example.css", "./example.js", "./diaphragm-wall", "./diaphragm-wall-gc", "./wall-gc.js", "./app.css", "./app.js", "./template", "./template.css", "./template.js", "./rebar", "./rebar.css", "./rebar.js", "./steel-structure", "./steel.css", "./steel.js", "./record", "./checklists", "./manifest.webmanifest", "./app-icon-144.png", "./apple-touch-icon.png", "./icon-192.png", "./taisei.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // no-cache：每個檔都向伺服器驗證，沒改過的回 304、只重抓真正變動的檔（reload 會整包全量下載）
      .then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: "no-cache" }))))
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
  const path = new URL(event.request.url).pathname;
  if (path.endsWith("/sw.js")) return;
  // PDF 交給瀏覽器自己抓：經 Service Worker 轉手的 PDF 在 iOS 的 PDF 檢視器上開不穩，
  // 而且 cache.put 會等整份 PDF 存完才回應；範例也不需要離線。
  if (path.endsWith(".pdf")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => caches.open(CACHE_NAME).then(cache => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }))
        .catch(() => caches.match(event.request, { ignoreSearch: true })
          .then(cached => cached || caches.match("./", { ignoreSearch: true })))
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
      .catch(() => caches.match("./", { ignoreSearch: true }))
  );
});
