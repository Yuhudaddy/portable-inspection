// 表單小元件（各工具頁與計畫頁共用，在頁面自己的 script 之前載入）：下拉選單的收尾行為、讀取中提示。
//
// 下拉選單的收尾行為
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

// 結果膠囊（✓／✗／N/A）：已選的那一顆再點一次＝取消選擇（回到「待確認」）。
//
// 結果膠囊是隱藏 radio，radio 被點到已選的那顆時瀏覽器不會觸發 change。各工具的事件都是委派在
// document 上讀 event.target.value，所以這裡在同一組補一顆隱藏的「待確認」radio（複製原本的
// data-* 屬性），選它並照原樣觸發 input／change，各工具的既有處理不用改。
// 「點擊前是否已選」要在 pointerdown／空白鍵按下時記錄，click 發生時 radio 已經被選上了。
(function () {
  const PENDING = "待確認";
  let armed = null;

  const radioOf = target => {
    if (!(target instanceof Element)) return null;
    const input = target.matches('.glass-segmented input[type="radio"]') ? target : target.closest(".glass-segmented label")?.querySelector('input[type="radio"]');
    return input && input.value !== PENDING && !input.disabled ? input : null;
  };
  const arm = target => {
    const input = radioOf(target);
    armed = input && input.checked ? input : null;
    if (armed) setTimeout(() => { if (armed === input) armed = null; }, 600);
  };

  document.addEventListener("pointerdown", event => arm(event.target), true);
  document.addEventListener("keydown", event => { if (event.key === " ") arm(event.target); }, true);

  document.addEventListener("click", event => {
    const input = armed && event.target === armed ? armed : null;
    if (!input) return;
    armed = null;
    const group = input.closest(".glass-segmented");
    let pending = [...group.querySelectorAll('input[type="radio"]')].find(radio => radio.value === PENDING);
    if (!pending) {
      pending = input.cloneNode(false);
      pending.value = PENDING;
      pending.checked = false;
      pending.disabled = false;
      pending.hidden = true;
      pending.setAttribute("aria-label", PENDING);
      group.append(pending);
    }
    pending.checked = true;
    pending.dispatchEvent(new Event("input", { bubbles: true }));
    pending.dispatchEvent(new Event("change", { bubbles: true }));
  }, true);
})();

// 讀取中的提示（雙環，樣式見 glass.css 的 .orbit）。text 只傳程式裡的固定字串；small 是放在按鈕裡的小尺寸。
function loadingHtml(text, { small = false } = {}) {
  const orbit = `<span class="orbit${small ? " is-small" : ""}" aria-hidden="true"><i></i><i></i></span>`;
  return small ? `${orbit}${text}` : `<p class="loading-note" role="status">${orbit}${text}</p>`;
}
