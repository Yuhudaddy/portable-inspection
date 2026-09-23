// 數值項目的自動判定（01 營造廠、06 廠商兩個連續壁工具共用；在 guide-wall.js 與工具 script 之前載入）。
//
// 輸入容錯（parseMeasure）：現場常見寫法先轉成數字，轉不了才算輸入錯誤。
//   ・全形數字與符號「１２．５」→ 12.5；「，」當小數點
//   ・前面的 GL、後面的單位「100cm」「2.1 m」「≤ 15 公分」→ 只取數字
//   ・ratio 模式（垂直度 1/n）：「1/420」「1／420」→ 420
// 轉換後仍不是數字（「約一百」「abc」、夾了兩個數字）→ invalid：欄位紅框、提示「請輸入數值」、✓ 停用。
//
// 判定狀態（status）：
//   "empty"   沒填或缺條件（例如還沒填設計值），不判定
//   "invalid" 有填但不是數值
//   "fail"    不合格 → 自動選 ✗、✓ 停用（使用者只能改數值或選 N/A）
//   "pass"    合格 → 預設不自動打勾，留給使用者確認；autoPass 的項目才自動選 ✓
// record.auto 記錄目前結果是否由自動判定帶入：條件解除時只退回自動帶入的結果，不動使用者手動點的。
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

// 依判定狀態調整結果。只在「數值或標準值改變」時呼叫；autoPass 的項目合格時自動選 ✓。
function applyAutoResult(record, status, { autoPass = false } = {}) {
  if (record.result === "不適用") return;
  if (status === "fail") {
    record.result = "不符合";
    record.auto = "fail";
  } else if (status === "pass" && autoPass) {
    record.result = "符合";
    record.auto = "pass";
  } else if (record.auto) {
    record.result = "待確認";
    record.auto = "";
  }
}

// 不合格或輸入錯誤時「✓」不可選；匯入或舊草稿帶進來的「符合」也一併改掉（不合格改 ✗，輸入錯誤退回待確認）。
// 數值不合格時的「✗」一律視為自動帶入：匯入的 JSON 與重新載入的草稿不帶 auto 記號，
// 在這裡補回，數值改好後才會照常退回待確認。
function autoLockedResults(record, status) {
  if (status !== "fail" && status !== "invalid") return [];
  if (record.result === "符合") record.result = status === "fail" ? "不符合" : "待確認";
  if (status === "fail" && record.result === "不符合") record.auto ||= "fail";
  return ["符合"];
}

const INVALID_MEASURE_MESSAGE = "請輸入數值";

// 打字時就地更新結果鈕（勾選、停用）與卡片的不合格底色，不重繪整張卡片（避免輸入框失焦）。
function syncAutoResultCard(card, record, locked) {
  if (!card) return;
  card.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.checked = radio.value === record.result;
    radio.disabled = locked.includes(radio.value);
  });
  card.classList.toggle("is-failed", record.result === "不符合");
}
