// 各工具共用的本機草稿暫存（localStorage），在頁面本身的 script 之前載入。
//
//   const draft = createDraftStore("project-portal.<tool>.draft", () => state, { enabled });
//   Object.assign(state, draft.load() ?? {});   // 啟動時還原
//   draft.schedule();                            // 任何會改到 state 的事件都叫一下（會去抖）
//   draft.clear();                               // 「清空」時刪掉暫存，並取消排程中的寫入
//
// 寫入採 400ms 尾端去抖，一連串輸入只落地一次；換頁或退到背景時立即 flush，iOS 也不會漏掉
// 最後一筆。範例模式（enabled: false）不讀也不寫，避免範例資料蓋掉真正的草稿。
// 寫入失敗（隱私模式、容量滿）一律靜默，不影響填表與輸出。
function createDraftStore(key, getState, { enabled = true, delay = 400 } = {}) {
  const SCHEMA = "project-portal.draft.v1";
  let timer = 0;
  let dirty = false;

  const flush = () => {
    clearTimeout(timer);
    timer = 0;
    if (!dirty) return;
    dirty = false;
    try {
      localStorage.setItem(key, JSON.stringify({ schema: SCHEMA, data: getState() }));
    } catch (error) {
      /* 靜默 */
    }
  };

  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });

  return {
    load() {
      if (!enabled) return null;
      try {
        const parsed = JSON.parse(localStorage.getItem(key));
        return parsed?.schema === SCHEMA && parsed.data && typeof parsed.data === "object" ? parsed.data : null;
      } catch (error) {
        return null;
      }
    },
    schedule() {
      if (!enabled) return;
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    clear() {
      clearTimeout(timer);
      timer = 0;
      dirty = false;
      try { localStorage.removeItem(key); } catch (error) { /* 靜默 */ }
    }
  };
}
