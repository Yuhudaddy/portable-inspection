// 鋼筋號數清單（各工具共用，在各頁的工具 script 之前載入）。
// 資料一律存 D 名稱；畫面顯示「D32（#10）」，PDF 只印「#10」。
// 舊資料裡不在清單的尺寸（D35、D51…）保留原值，下拉多一個「（舊）」選項，不會被吃掉。
const BAR_SIZES = [
  ["D10", "#3"], ["D13", "#4"], ["D16", "#5"], ["D19", "#6"], ["D22", "#7"], ["D25", "#8"], ["D29", "#9"],
  ["D32", "#10"], ["D36", "#11"], ["D39", "#12"], ["D43", "#14"], ["D50", "#16"], ["D57", "#18"]
];
const BAR_SIZE_MARKS = Object.fromEntries(BAR_SIZES);

const escapeHtml = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const barSizeMark = size => BAR_SIZE_MARKS[size] || String(size ?? "").trim();
const barSizeLabel = size => {
  const value = String(size ?? "").trim();
  if (!value) return "";
  return BAR_SIZE_MARKS[value] ? `${value}（${BAR_SIZE_MARKS[value]}）` : `${value}（舊）`;
};

function barSizeOptions(selected, placeholder = "請選擇") {
  const current = String(selected ?? "").trim();
  const values = BAR_SIZES.map(([size]) => size);
  if (current && !values.includes(current)) values.push(current);
  return [
    `<option value="">${escapeHtml(placeholder)}</option>`,
    ...values.map(size => `<option value="${escapeHtml(size)}" ${size === current ? "selected" : ""}>${escapeHtml(barSizeLabel(size))}</option>`)
  ].join("");
}
