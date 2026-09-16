// 首頁工具卡：按下時讓一圈邊框從卡片邊緣往外擴散（.is-waving，樣式在 portal.css），
// 再稍微延後導向工具頁，讓擴散看得見。動畫綁在 class 而不是 :active，手指一放開才不會被切斷。
(() => {
  const NAVIGATE_DELAY_MS = 180;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const wave = card => {
    card.classList.remove("is-waving");
    void card.offsetWidth; // 重新觸發動畫
    card.classList.add("is-waving");
  };

  document.querySelectorAll(".tool-card-active").forEach(card => {
    card.addEventListener("animationend", () => card.classList.remove("is-waving"));
    card.addEventListener("pointerdown", event => {
      if (event.button === 0 && !reduceMotion) wave(card);
    });
    card.addEventListener("click", event => {
      if (reduceMotion || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!card.classList.contains("is-waving")) wave(card); // 鍵盤 Enter 沒有 pointerdown
      event.preventDefault();
      setTimeout(() => { window.location.href = card.href; }, NAVIGATE_DELAY_MS);
    });
  });
})();

if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./sw.js").catch(() => {});
