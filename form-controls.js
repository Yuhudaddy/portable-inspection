// 下拉選單的收尾行為（各工具頁與計畫頁共用，在頁面自己的 script 之前載入）。
//
// 問題：用滑鼠點開原生選單、選完或關掉之後，焦點仍留在 <select> 上，欄位就一直帶著聚焦樣式，
// 看起來像還在編輯。Chrome 在選單關閉後會自行解除 :focus-visible；Safari 不會——只要焦點在
// select 上就符合 :focus-visible，所以單靠 CSS 關不掉，需要這段把焦點收掉。
//
// 只處理「滑鼠（指標）操作」：任何鍵盤輸入都會清掉記號，因此 Tab 選取、方向鍵改值都會維持
// 焦點，不會打斷焦點順序，也不影響讀螢幕軟體。
(function () {
  let pointerSelect = null;

  document.addEventListener("pointerdown", event => {
    const select = event.target instanceof Element ? event.target.closest("select") : null;
    // 關掉選單後點別處：Safari 那一下點擊有時不會傳到頁面，焦點就留在原欄位上，這裡補收
    if (!select && pointerSelect && document.activeElement === pointerSelect) pointerSelect.blur();
    pointerSelect = select;
  }, true);

  document.addEventListener("keydown", () => { pointerSelect = null; }, true);

  document.addEventListener("change", event => {
    if (event.target !== pointerSelect) return;
    event.target.blur();
    pointerSelect = null;
  });
})();
