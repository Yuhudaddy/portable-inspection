// 共用的 Service Worker 註冊（各頁在自己的 script 之後載入）。
// 新版 SW 安裝完會 skipWaiting + clients.claim 直接接管，但已開著的頁面用的仍是舊快取，
// 以前得「關掉分頁重開」才看得到新版；這裡在接管（controllerchange）時自動重新整理一次。
// 草稿在 pagehide 會先 flush，不會因為重整而掉資料；第一次安裝（原本沒有 controller）不重整。
// 對話框裡還沒送出的內容不在 state 裡，所以有 <dialog> 開著時等它關閉再重整。
(() => {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  let hadController = Boolean(navigator.serviceWorker.controller);
  const reload = () => {
    if (document.querySelector("dialog[open]")) document.addEventListener("close", reload, { once: true, capture: true });
    else location.reload();
  };
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) reload();
    hadController = true;
  });
  navigator.serviceWorker.register("./sw.js").catch(() => {});
})();
