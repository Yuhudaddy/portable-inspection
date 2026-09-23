// 數值項目的自動判定（01 營造廠、06 廠商兩個連續壁工具共用；在 guide-wall.js 與工具 script 之前載入）。
//
// 輸入容錯（parseMeasure）：現場常見寫法先轉成數字，轉不了才算輸入錯誤。
//   ・全形數字與符號「１２．５」→ 12.5；「，」當小數點
//   ・前面的 GL、後面的單位「100cm」「2.1 m」「≤ 15 公分」→ 只取數字
//   ・ratio 模式（垂直度 1/n）：「1/420」「1／420」→ 420
// 轉換後仍不是數字（「約一百」「abc」、夾了兩個數字）→ invalid：欄位紅框、提示「非數值，請手動判定」。
//
// 判定狀態（status）：
//   "empty"   沒填或缺條件（例如還沒填設計值），不判定
//   "invalid" 有填但不是數值 → 不自動判定，由使用者手動點
//   "fail"    不合格 → 自動 ✗，✓ 停用（使用者只能改數值或選 N/A）
//   "pass"    合格 → 自動 ✓（數值以外的缺失由使用者手動改 ✗）
//
// 什麼時候判定（rejudge）：
//   ・使用者改了這一項的數值 → 依新數值重判，會取代手動點的結果（回傳被取代的結果，工具頁提示並可復原）
//   ・檢查標準值、設計基準改變或重繪 → 只重判自動帶入的結果與待確認，使用者手動點的保留
//   ・N/A 一律不動
// record.auto 記錄目前結果是否由自動判定帶入（"pass"／"fail"），使用者手動點選時清掉（markManualResult）。
const FULL_WIDTH_DIGITS = "０１２３４５６７８９";

function normalizeMeasureText(value) {
  return String(value ?? "")
    .replace(/[０-９]/g, char => String(FULL_WIDTH_DIGITS.indexOf(char)))
    .replace(/[．。，]/g, ".")
    .replace(/[－—–−]/g, "-")
    .replace(/[＋]/g, "+")
    .replace(/[／]/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMeasure(value, { ratio = false } = {}) {
  const text = normalizeMeasureText(value);
  if (!text) return { value: null, empty: true, invalid: false };
  if (ratio) {
    const ratioMatch = text.match(/^1\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (ratioMatch) return { value: Number(ratioMatch[1]), empty: false, invalid: false };
  }
  // 可有 GL 前綴；數字後面只能接單位文字（不能再有數字或正負號），「≤ 15」「約 100」這類前面有字的不收
  // 小數點前可省略 0（「.5」＝0.5）；位數多到超出浮點範圍（Infinity）的也算輸入錯誤
  const match = text.match(/^(?:GL\s*)?([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*([^\d]*)$/i);
  const number = match ? Number(match[1]) : NaN;
  if (!match || /[+-]/.test(match[2]) || !Number.isFinite(number)) return { value: null, empty: false, invalid: true };
  return { value: number, empty: false, invalid: false };
}

const AUTO_RESULTS = { pass: "符合", fail: "不符合" };

// valueChanged：這次是使用者改了這一項的數值。回傳被自動判定取代的手動結果（沒有就回傳 null）。
function rejudge(record, status, { valueChanged = false } = {}) {
  if (record.result === "不適用") return null;
  const manual = !record.auto && record.result !== "待確認";
  if (manual && !valueChanged) return null;
  const next = AUTO_RESULTS[status];
  const before = record.result;
  if (next) {
    record.result = next;
    record.auto = status;
  } else if (record.auto) {
    record.result = "待確認";   // 數值清空或改成文字：自動結果不再成立
    record.auto = "";
  }
  return manual && record.result !== before ? before : null;
}

// 不合格時「✓」不可選（匯入或舊草稿帶進來的「符合」改成「不符合」）。
// 匯入的 JSON 與重新載入的草稿不帶 auto 記號：結果和數值判定一致的，視為自動帶入。
function autoLockedResults(record, status) {
  if (!record.auto && AUTO_RESULTS[status] && record.result === AUTO_RESULTS[status]) record.auto = status;
  if (status !== "fail") return [];
  if (record.result === "符合") { record.result = "不符合"; record.auto = "fail"; }
  return ["符合"];
}

const INVALID_MEASURE_MESSAGE = "非數值，請手動判定";

// 會自動判定的項目，標題旁加這個小標籤，一眼看出「只要填數值」
const AUTO_JUDGE_BADGE = '<small class="auto-badge" title="填入數值後自動判定 ✓／✗；可再手動改判，改數值後重新判定">自動判定</small>';

// 使用者手動點結果時呼叫：之後標準值改變或重繪都不會動它，直到使用者再改這一項的數值
function markManualResult(record) {
  record.auto = "";
}

// 打字時就地更新結果鈕（勾選、停用）與卡片的不合格底色，不重繪整張卡片（避免輸入框失焦）。
function syncAutoResultCard(card, record, locked) {
  if (!card) return;
  card.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.checked = radio.value === record.result;
    radio.disabled = locked.includes(radio.value);
  });
  card.classList.toggle("is-failed", record.result === "不符合");
}
