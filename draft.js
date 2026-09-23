// 各工具共用的本機草稿暫存（localStorage），在頁面本身的 script 之前載入。
//
//   const draft = createDraftStore("project-portal.<tool>.draft", () => state, { enabled });
//   Object.assign(state, draft.load() ?? {});   // 啟動時還原
//   draft.watch();                               // 掛上 input／change／submit／click 監聽，改到 state 的互動都會排程寫入
//   draft.clear();                               // 「清空」時刪掉暫存，並取消排程中的寫入
//
// 寫入採 400ms 尾端去抖，一連串輸入只落地一次；換頁或退到背景時立即 flush，iOS 也不會漏掉
// 最後一筆。範例模式（enabled: false）不讀也不寫，避免範例資料蓋掉真正的草稿。
// 寫入失敗（隱私模式、容量滿）一律靜默，不影響填表與輸出。
//
//   state.standards = mergeStandardDefaults(state.standards, STANDARD_CONFIG);   // 還原草稿後
//
// 檢查標準值的預設改版時，舊草稿裡存的仍是「當時的預設值」：這些項目視同使用者沒改過，換成
// 新預設（config 的 legacy 列出歷次舊預設）；使用者自己選的其他值保留，草稿缺的鍵補上預設。
function mergeStandardDefaults(saved, config) {
  const standards = Object.fromEntries(config.map(item => [item.key, item.default]));
  Object.entries(saved || {}).forEach(([key, value]) => {
    if (Object.prototype.hasOwnProperty.call(standards, key)) standards[key] = value;
  });
  config.forEach(item => {
    if ((item.legacy || []).includes(standards[item.key])) standards[item.key] = item.default;
  });
  return standards;
}

//   state.quality.checks = refreshCheckItems(state.quality.checks, QUALITY_CHECKS.map(createQualityCheck));
//
// 檢查項目的名稱、判定標準與 placeholder 以程式定義為準，草稿只保留使用者填的值（actual、result、號數、
// 間距…），依項目名稱對回新定義；名稱改掉或刪掉的項目，其填值不再帶入。改了判定標準文字時舊草稿才會跟著換。
function refreshCheckItems(saved, fresh) {
  const byItem = new Map((Array.isArray(saved) ? saved : []).filter(Boolean).map(check => [check.item, check]));
  return fresh.map(check => {
    const previous = byItem.get(check.item);
    if (!previous) return check;
    const { item, standard, placeholder, ...values } = previous;
    return { ...check, ...values };
  });
}

// 施工計畫頁的封面會直接改寫工具草稿裡的這兩欄（plan.js writeCoverToTool），兩邊共用這份清單。
const COVER_SYNC_FIELDS = ["project", "contractor"];

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

  // 另一個分頁（施工計畫頁）改了這份草稿的工程名稱／施工廠商：併回目前的 state 與欄位，
  // 之後這頁再存草稿時才不會用舊值把它蓋回去。只收這兩欄，其他欄位仍以這頁為準。
  if (enabled) window.addEventListener("storage", event => {
    if (event.key !== key || !event.newValue) return;
    let incoming;
    try { incoming = JSON.parse(event.newValue)?.data?.overview; } catch (error) { return; }
    const overview = getState()?.overview;
    if (!incoming || !overview) return;
    COVER_SYNC_FIELDS.forEach(field => {
      if (typeof incoming[field] !== "string" || incoming[field] === overview[field]) return;
      overview[field] = incoming[field];
      document.querySelectorAll(`[data-bind="overview.${field}"]`).forEach(input => { input.value = incoming[field]; });
    });
  });

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
    },
    // 會改到 state 的互動都經過這四種事件；「確認清空」那一下除外，否則剛刪掉的草稿又會被寫回。
    watch({ ignore = "#confirm-clear" } = {}) {
      ["input", "change", "submit"].forEach(type => document.addEventListener(type, () => this.schedule()));
      document.addEventListener("click", event => { if (!event.target.closest(ignore)) this.schedule(); });
      return this;
    }
  };
}

// 施工計畫頁的封面（編製單位、日期、精簡／完整版）跟著工具的 JSON 走（換手機時一起帶過去）。
// 修訂紀錄與版次由製作者維護（plans/revisions.js），不存也不匯入。
// 工程名稱、施工廠商本來就與工具頁的工程資訊同步，這裡只帶計畫自己的欄位。
// work 對應 plan.html?work=…；匯入時 work 不同（例如營造廠版匯入廠商 JSON）就不動計畫。
const PLAN_DRAFT_SCHEMA = "project-portal.draft.v1";
const planDraftKey = work => `project-portal.plan.${work}.draft`;

// 工具頁「還原預設」一併清掉對應施工計畫頁的草稿（封面的編製單位、日期、精簡／完整版）
function clearPlanDraft(work) {
  try { localStorage.removeItem(planDraftKey(work)); } catch (error) { /* 靜默 */ }
}

function exportPlanDraft(work) {
  try {
    const data = JSON.parse(localStorage.getItem(planDraftKey(work)))?.data;
    if (!data || typeof data !== "object") return null;
    const cover = data.cover || {};
    return {
      work,
      version: data.version === "full" ? "full" : "brief",
      author: cover.author || null,
      date: cover.date || null
    };
  } catch (error) {
    return null;
  }
}

function importPlanDraft(work, plan, overview = {}) {
  if (!plan || plan.work !== work) return;
  const text = value => value === null || value === undefined ? "" : String(value);
  const data = {
    version: plan.version === "full" ? "full" : "brief",
    cover: { project: text(overview.project), contractor: text(overview.contractor), author: text(plan.author), date: text(plan.date) }
  };
  try { localStorage.setItem(planDraftKey(work), JSON.stringify({ schema: PLAN_DRAFT_SCHEMA, data })); } catch (error) { /* 靜默 */ }
}
