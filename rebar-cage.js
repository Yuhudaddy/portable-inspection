// 鋼筋籠配筋抽查明細（01 營造廠查驗、06 施工紀錄共用，在 bar-sizes.js 之後、工具 script 之前載入）。
// 13 個固定部位；「簡易」只記結果，「詳細」多記深度區間／支數／號數@間距／對稱，兩種模式共用同一個結果值。
// 內側部位（2、4）的對稱不自己存，由配對的外側部位推導：外側勾了對稱，內側就是「同外側」。
const REBAR_CAGE_DEFAULT_NOTE = "依設計圖說配置";
const REBAR_CAGE_PARTS = [
  { key: "outerVertical", part: "外側 垂直 主筋", template: "interval", pair: "innerVertical" },
  { key: "innerVertical", part: "內側 垂直 主筋", template: "interval", mirrorOf: "outerVertical" },
  { key: "outerHorizontal", part: "外側 水平 溫度筋", template: "interval", pair: "innerHorizontal" },
  { key: "innerHorizontal", part: "內側 水平 溫度筋", template: "interval", mirrorOf: "outerHorizontal" },
  { key: "horizontalTie", part: "水平 正交繫筋", template: "interval" },
  { key: "verticalDiagonalSmall", part: "垂直 小斜拉筋", template: "interval" },
  { key: "horizontalDiagonalSmall", part: "水平 小斜拉筋", template: "interval" },
  { key: "jointVertical", part: "單元接頭垂直補強筋", template: "single" },
  { key: "endPlateStopper", part: "端板擋筋(母單元)", template: "single", note: "依設計圖說配置，銲喉4mm且銲長至少50mm" },
  { key: "vBrace", part: "V型固定加強筋", template: "single" },
  { key: "crossDiagonalLarge", part: "交叉大斜拉筋", template: "single" },
  { key: "verticalLug", part: "垂直護耳", template: "single" },
  { key: "horizontalLug", part: "水平護耳", template: "single" }
];
const REBAR_CAGE_RESULTS = ["待確認", "符合", "不符合", "不適用"];

const rebarCageDef = key => REBAR_CAGE_PARTS.find(def => def.key === key);
const rebarCageText = value => String(value ?? "").trim();
const rebarCageNumber = value => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const createRebarCageInterval = () => ({ top: "", bottom: "", size: "", spacing: "", extra: { enabled: false, size: "", spacing: "" } });
const createRebarCagePart = def => def.template === "interval"
  ? { key: def.key, result: "待確認", symmetric: false, intervals: [createRebarCageInterval()] }
  : { key: def.key, result: "待確認", symmetric: false, count: "", size: "", spacing: "" };
const createRebarCageParts = () => REBAR_CAGE_PARTS.map(createRebarCagePart);

// 草稿或 JSON 讀回來的 parts：依 key 對齊 13 個部位，缺的補預設，欄位一律轉成字串／布林。
function normalizeRebarCageParts(source) {
  const list = Array.isArray(source) ? source : [];
  return REBAR_CAGE_PARTS.map(def => {
    const record = list.find(item => item && item.key === def.key) || {};
    const part = createRebarCagePart(def);
    part.result = REBAR_CAGE_RESULTS.includes(record.result) ? record.result : "待確認";
    part.symmetric = def.mirrorOf ? false : Boolean(record.symmetric);
    if (def.template === "single") {
      part.count = rebarCageText(record.count);
      part.size = rebarCageText(record.size);
      part.spacing = rebarCageText(record.spacing);
      return part;
    }
    const intervals = Array.isArray(record.intervals) && record.intervals.length ? record.intervals : [{}];
    part.intervals = intervals.map(item => ({
      top: rebarCageText(item?.top), bottom: rebarCageText(item?.bottom),
      size: rebarCageText(item?.size), spacing: rebarCageText(item?.spacing),
      extra: { enabled: Boolean(item?.extra?.enabled), size: rebarCageText(item?.extra?.size), spacing: rebarCageText(item?.extra?.spacing) }
    }));
    return part;
  });
}

function rebarCageSymmetric(part, parts) {
  const def = rebarCageDef(part.key);
  if (def.mirrorOf) return Boolean(parts.find(item => item.key === def.mirrorOf)?.symmetric);
  return Boolean(part.symmetric);
}
const rebarCageMirrored = (part, parts) => Boolean(rebarCageDef(part.key).mirrorOf) && rebarCageSymmetric(part, parts);

// 文字組合：GL-10、#10@60、#10@60+#10@15、#6、@200
const rebarCageGl = value => rebarCageText(value) ? `GL-${rebarCageText(value)}` : "";
function rebarCageBarText(size, spacing) {
  const mark = rebarCageText(size) ? barSizeMark(size) : "";
  const pitch = rebarCageText(spacing) ? `@${rebarCageText(spacing)}` : "";
  return `${mark}${pitch}`;
}
function rebarCageIntervalText(interval) {
  const main = rebarCageBarText(interval.size, interval.spacing);
  const extra = interval.extra?.enabled ? rebarCageBarText(interval.extra.size, interval.extra.spacing) : "";
  return [main, extra].filter(Boolean).join("+");
}

// 詳細模式一個部位要印的列（區間型一列一區間；同外側／單列型一列）
function rebarCagePrintRows(part, parts) {
  const def = rebarCageDef(part.key);
  if (rebarCageMirrored(part, parts)) return [{ top: "", bottom: "", count: "", bars: "" }];
  if (def.template === "single") return [{ top: "", bottom: "", count: rebarCageText(part.count), bars: rebarCageBarText(part.size, part.spacing) }];
  return part.intervals.map(interval => ({ top: rebarCageGl(interval.top), bottom: rebarCageGl(interval.bottom), count: "", bars: rebarCageIntervalText(interval) }));
}

// 卡片摘要：每列一行，例如「GL-0～-10 #10@60」「3 支 #6」「@200」
function rebarCageSummary(part, parts) {
  if (rebarCageMirrored(part, parts)) return ["同外側"];
  const lines = rebarCagePrintRows(part, parts).map(row => {
    const range = row.top || row.bottom ? `${row.top || "GL-?"}～${row.bottom ? row.bottom.replace("GL", "") : "?"}` : "";
    const count = row.count ? `${row.count} 支` : "";
    return [range, count, row.bars].filter(Boolean).join(" ");
  }).filter(Boolean);
  return lines.length ? lines : ["尚未填寫"];
}

// 紅框規則：同區間底部不比頂部深；下一區間頂部比上一區間底部淺。只提示不擋存檔。
function rebarCageIntervalIssues(intervals) {
  return intervals.map((interval, index) => {
    const issues = new Set();
    const top = rebarCageNumber(interval.top);
    const bottom = rebarCageNumber(interval.bottom);
    if (top !== null && bottom !== null && bottom <= top) issues.add("bottom");
    const previous = index ? rebarCageNumber(intervals[index - 1].bottom) : null;
    if (top !== null && previous !== null && top < previous) issues.add("top");
    return issues;
  });
}

// ---- JSON／Markdown ----
// JSON 匯出：數值欄位轉數字（沒填 null），補強未啟用為 null；內側部位的對稱匯出推導後的值。
function exportRebarCageParts(cage) {
  const toNumber = value => rebarCageNumber(value);
  return cage.parts.map((part, index) => {
    const def = rebarCageDef(part.key);
    const base = { item_no: index + 1, key: part.key, part: def.part, symmetric: rebarCageSymmetric(part, cage.parts), result: part.result };
    if (def.template === "single") return { ...base, count: toNumber(part.count), bar_size: part.size || null, spacing_cm: toNumber(part.spacing) };
    return {
      ...base,
      intervals: part.intervals.map(interval => ({
        top_m: toNumber(interval.top), bottom_m: toNumber(interval.bottom), bar_size: interval.size || null, spacing_cm: toNumber(interval.spacing),
        extra: interval.extra.enabled ? { bar_size: interval.extra.size || null, spacing_cm: toNumber(interval.extra.spacing) } : null
      }))
    };
  });
}

// JSON 匯入：依 key（舊檔沒有 key 就依 part 名稱）對回 13 個部位；1.3 以前的 rebar_items 不在這裡處理，呼叫端直接略過。
function importRebarCageParts(records) {
  const list = Array.isArray(records) ? records : [];
  const text = value => value === null || value === undefined ? "" : String(value);
  return normalizeRebarCageParts(list.map(record => {
    const def = REBAR_CAGE_PARTS.find(item => item.key === record?.key) || REBAR_CAGE_PARTS.find(item => item.part === record?.part);
    if (!def) return null;
    if (def.template === "single") return { key: def.key, result: record.result, symmetric: record.symmetric, count: text(record.count), size: text(record.bar_size), spacing: text(record.spacing_cm) };
    return {
      key: def.key, result: record.result, symmetric: record.symmetric,
      intervals: (Array.isArray(record.intervals) ? record.intervals : []).map(interval => ({
        top: text(interval?.top_m), bottom: text(interval?.bottom_m), size: text(interval?.bar_size), spacing: text(interval?.spacing_cm),
        extra: { enabled: Boolean(interval?.extra), size: text(interval?.extra?.bar_size), spacing: text(interval?.extra?.spacing_cm) }
      }))
    };
  }).filter(Boolean));
}

// Markdown 匯出的表格列（含表頭）；詳細模式多區間以「／」串在同一格。
function rebarCageMarkdownRows(cage) {
  const cell = value => String(value ?? "").trim().replaceAll("|", "\\|") || "—";
  if (cage.mode === "detailed") {
    return [
      "| 項次 | 部位 | 頂部(m) | 底部(m) | 支數 | 號數@間距(cm) | 對稱 | 結果 |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      ...cage.parts.map((part, index) => {
        const rows = rebarCagePrintRows(part, cage.parts);
        const join = field => rows.map(row => row[field]).filter(Boolean).join("／");
        return `| ${index + 1} | ${cell(rebarCageDef(part.key).part)} | ${cell(join("top"))} | ${cell(join("bottom"))} | ${cell(join("count"))} | ${cell(join("bars"))} | ${rebarCageSymmetric(part, cage.parts) ? "✔" : "—"} | ${cell(part.result)} |`;
      })
    ];
  }
  return [
    "| 項次 | 部位 | 說明 | 結果 |",
    "| --- | --- | --- | --- |",
    ...cage.parts.map((part, index) => `| ${index + 1} | ${cell(rebarCageDef(part.key).part)} | ${cell(rebarCageDef(part.key).note || REBAR_CAGE_DEFAULT_NOTE)} | ${cell(part.result)} |`)
  ];
}

// ---- 列印 ----
// 詳細表不用 rowspan：print-pages.js 是一列一列搬到續頁，合併儲存格被拆開會壞版；
// 改用 part-continued 列 + CSS 把同一部位相鄰列的項次／部位／對稱／結果格子邊線拿掉，看起來一樣是合併的。
function rebarCagePrintTableHtml(cage) {
  const cell = value => escapeHtml(rebarCageText(value) || "-");
  if (cage.mode === "detailed") {
    const rows = cage.parts.map((part, index) => {
      const def = rebarCageDef(part.key);
      const lines = rebarCagePrintRows(part, cage.parts);
      const symmetric = rebarCageSymmetric(part, cage.parts) ? "✔" : "-";
      return lines.map((row, i) => {
        const first = i === 0;
        const last = i === lines.length - 1;
        return `<tr class="${first ? "" : "part-continued"} ${last ? "" : "part-has-more"}"><td>${first ? index + 1 : ""}</td><td class="text-left">${first ? escapeHtml(def.part) : ""}</td><td>${cell(row.top)}</td><td>${cell(row.bottom)}</td><td>${cell(row.count)}</td><td>${cell(row.bars)}</td><td>${first ? symmetric : ""}</td><td>${first ? escapeHtml(part.result) : ""}</td></tr>`;
      }).join("");
    }).join("");
    return `<table class="print-table rebar-cage-print-table is-detailed"><thead><tr><th>項次</th><th>部位</th><th>頂部(m)</th><th>底部(m)</th><th>支數</th><th>號數@間距(cm)</th><th>對稱</th><th>結果</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  const rows = cage.parts.map((part, index) => {
    const def = rebarCageDef(part.key);
    return `<tr><td>${index + 1}</td><td class="text-left">${escapeHtml(def.part)}</td><td class="text-left">${escapeHtml(def.note || REBAR_CAGE_DEFAULT_NOTE)}</td><td>${escapeHtml(part.result)}</td></tr>`;
  }).join("");
  return `<table class="print-table rebar-cage-print-table is-simple"><thead><tr><th>項次</th><th>部位</th><th>說明</th><th>結果</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// ---- 畫面 ----
// 卡片：簡易只有固定說明＋三態結果；詳細多「對稱」勾選、「填寫」鈕與摘要（摘要文字＝PDF 會印的內容）。
function rebarCageCardsHtml(cage, resultSegmented) {
  const detailed = cage.mode === "detailed";
  return cage.parts.map((part, index) => {
    const def = rebarCageDef(part.key);
    const mirrored = rebarCageMirrored(part, cage.parts);
    const summary = detailed ? rebarCageSummary(part, cage.parts) : [def.note || REBAR_CAGE_DEFAULT_NOTE];
    const symmetric = detailed && !def.mirrorOf
      ? `<label class="rebar-symmetric"><input type="checkbox" data-part-symmetric="${index}" ${part.symmetric ? "checked" : ""} /><span>對稱</span></label>` : "";
    const fill = detailed && !mirrored ? `<button type="button" class="rebar-fill-button" data-edit-part="${index}">填寫</button>` : "";
    return `
    <article class="check-card rebar-part-card ${part.result === "不符合" ? "is-failed" : ""}">
      <div class="check-card-head rebar-part-head"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(def.part)}</strong>${symmetric}${fill}</div>
      <p class="rebar-part-summary ${mirrored ? "is-mirrored" : ""}">${summary.map(line => `<span>${escapeHtml(line)}</span>`).join("")}</p>
      <div class="check-card-fields rebar-part-fields">
        <div class="field result-field"><span id="rebar-part-${index}-result-label">複核結果</span>${resultSegmented(`rebar-part-${index}-result`, part.result, `data-part-result="${index}"`)}</div>
      </div>
    </article>`;
  }).join("");
}

// 藥丸切換：位置用選中鈕的 offsetLeft／offsetWidth 寫進 transform／width；animate=false 時先關 transition、強制 reflow 再開，避免從 0 滑過來。
function syncRebarCageModeTabs(mode, animate = true) {
  const tabs = document.querySelector("#rebar-cage-mode-tabs");
  if (!tabs) return;
  const pill = tabs.querySelector(".t-tabs-pill");
  let active = null;
  tabs.querySelectorAll(".t-tab").forEach(tab => {
    const selected = tab.dataset.cageMode === mode;
    tab.setAttribute("aria-selected", String(selected));
    if (selected) active = tab;
  });
  if (!active || !active.offsetWidth) return;   // 分頁隱藏時量不到寬度，等 ResizeObserver 顯示後再補
  if (!animate) pill.style.transition = "none";
  pill.style.transform = `translateX(${active.offsetLeft}px)`;
  pill.style.width = `${active.offsetWidth}px`;
  if (!animate) { void pill.offsetWidth; pill.style.transition = ""; }
}

// ---- 填寫彈出視窗（只在詳細模式）：先改草稿，按「確認更新」才寫回 state ----
const rebarCageDialog = { index: null, draft: null };

function openRebarCageDialog(cage, index) {
  rebarCageDialog.index = index;
  rebarCageDialog.draft = JSON.parse(JSON.stringify(cage.parts[index]));
  document.querySelector("#rebar-dialog-title").textContent = `第 ${index + 1} 項　${rebarCageDef(cage.parts[index].key).part}`;
  renderRebarCageDialogFields();
  document.querySelector("#rebar-dialog").showModal();
}

const rebarCageNumberInput = (field, value, placeholder, step = "0.5") =>
  `<input type="number" min="0" step="${step}" inputmode="decimal" data-interval-field="${field}" value="${escapeHtml(value)}" placeholder="${placeholder}" />`;

function renderRebarCageDialogFields() {
  const part = rebarCageDialog.draft;
  const def = rebarCageDef(part.key);
  const target = document.querySelector("#rebar-part-fields");
  if (def.template === "single") {
    target.innerHTML = `<div class="compact-form three-fields">
      <label class="field"><span>支數</span><input type="number" min="0" step="1" inputmode="numeric" data-part-field="count" value="${escapeHtml(part.count)}" placeholder="例如：3" /></label>
      <label class="field"><span>鋼筋號數</span><select data-part-field="size">${barSizeOptions(part.size)}</select></label>
      <label class="field"><span>間距（cm）</span><input type="number" min="0" step="0.5" inputmode="decimal" data-part-field="spacing" value="${escapeHtml(part.spacing)}" placeholder="例如：30" /></label>
    </div>`;
    return;
  }
  const issues = rebarCageIntervalIssues(part.intervals);
  target.innerHTML = `${part.intervals.map((interval, i) => `
    <fieldset class="rebar-interval" data-interval="${i}">
      <legend><span>深度區間 ${i + 1}</span>${part.intervals.length > 1 ? `<button type="button" class="rebar-interval-remove" data-remove-interval="${i}">移除</button>` : ""}</legend>
      <div class="compact-form two-fields">
        <label class="field gl-field ${issues[i].has("top") ? "is-invalid" : ""}"><span>頂部（GL 以下 m）</span><span class="gl-input"><em>GL −</em>${rebarCageNumberInput("top", interval.top, "例如：10", "0.01")}<em>m</em></span></label>
        <label class="field gl-field ${issues[i].has("bottom") ? "is-invalid" : ""}"><span>底部（GL 以下 m）</span><span class="gl-input"><em>GL −</em>${rebarCageNumberInput("bottom", interval.bottom, "例如：20", "0.01")}<em>m</em></span></label>
        <label class="field"><span>鋼筋號數</span><select data-interval-field="size">${barSizeOptions(interval.size)}</select></label>
        <label class="field"><span>間距（cm）</span>${rebarCageNumberInput("spacing", interval.spacing, "例如：60")}</label>
        <label class="field span-two rebar-extra-toggle"><input type="checkbox" data-interval-field="extraEnabled" ${interval.extra.enabled ? "checked" : ""} /><span>補強插筋（啟用加強）</span></label>
        ${interval.extra.enabled ? `
        <label class="field"><span>補強 鋼筋號數</span><select data-interval-field="extraSize">${barSizeOptions(interval.extra.size)}</select></label>
        <label class="field"><span>補強 間距（cm）</span>${rebarCageNumberInput("extraSpacing", interval.extra.spacing, "例如：15")}</label>` : ""}
      </div>
    </fieldset>`).join("")}
    <button type="button" class="add-button compact-button" data-add-interval><span aria-hidden="true">＋</span> 加一個深度區間</button>`;
}

// 紅框只改 class 不重畫欄位：重畫會把使用者正要點的下一個輸入框換掉，焦點就掉了。
function applyRebarCageIntervalIssues() {
  const issues = rebarCageIntervalIssues(rebarCageDialog.draft.intervals);
  document.querySelectorAll("#rebar-part-fields .rebar-interval").forEach((fieldset, index) => {
    fieldset.querySelectorAll(".gl-field").forEach(field => {
      const name = field.querySelector("[data-interval-field]").dataset.intervalField;
      field.classList.toggle("is-invalid", issues[index]?.has(name) ?? false);
    });
  });
}

// 回傳 true 表示結構變了要重畫欄位（只有補強開關）
function updateRebarCageDraft(input) {
  const part = rebarCageDialog.draft;
  if (input.dataset.partField) { part[input.dataset.partField] = input.value.trim(); return false; }
  const field = input.dataset.intervalField;
  if (!field) return false;
  const interval = part.intervals[Number(input.closest("[data-interval]").dataset.interval)];
  if (field === "extraEnabled") { interval.extra.enabled = input.checked; return true; }
  if (field === "extraSize" || field === "extraSpacing") { interval.extra[field === "extraSize" ? "size" : "spacing"] = input.value.trim(); return false; }
  if ((field === "top" || field === "bottom") && input.value.trim().startsWith("-")) input.value = input.value.trim().slice(1);   // 習慣打 -10 的人：意思一樣，直接轉正
  interval[field] = input.value.trim();
  if (field === "top" || field === "bottom") applyRebarCageIntervalIssues();
  return false;
}

function bindRebarCageUi({ getCage, onChange }) {
  const dialog = document.querySelector("#rebar-dialog");
  dialog.addEventListener("input", event => { updateRebarCageDraft(event.target); });
  dialog.addEventListener("change", event => { if (updateRebarCageDraft(event.target)) renderRebarCageDialogFields(); });
  dialog.addEventListener("click", event => {
    const add = event.target.closest("[data-add-interval]");
    const remove = event.target.closest("[data-remove-interval]");
    if (add) rebarCageDialog.draft.intervals.push(createRebarCageInterval());
    else if (remove) rebarCageDialog.draft.intervals.splice(Number(remove.dataset.removeInterval), 1);
    else return;
    renderRebarCageDialogFields();
  });
  document.querySelector("#rebar-form").addEventListener("submit", event => {
    event.preventDefault();
    getCage().parts[rebarCageDialog.index] = rebarCageDialog.draft;
    dialog.close();
    onChange();
  });
  document.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-part]");
    const mode = event.target.closest("[data-cage-mode]");
    if (edit) openRebarCageDialog(getCage(), Number(edit.dataset.editPart));
    else if (mode && getCage().mode !== mode.dataset.cageMode) { getCage().mode = mode.dataset.cageMode; onChange(); }
  });
  document.addEventListener("change", event => {
    const symmetric = event.target.closest("[data-part-symmetric]");
    const result = event.target.closest("[data-part-result]");
    if (symmetric) { getCage().parts[Number(symmetric.dataset.partSymmetric)].symmetric = symmetric.checked; onChange(); }
    else if (result) { getCage().parts[Number(result.dataset.partResult)].result = result.value; onChange(); }
  });
  // 分頁從 hidden 變可見、視窗改變大小時藥丸都要重新定位（不動畫）
  const tabs = document.querySelector("#rebar-cage-mode-tabs");
  if (tabs && "ResizeObserver" in window) new ResizeObserver(() => syncRebarCageModeTabs(getCage().mode, false)).observe(tabs);
}
