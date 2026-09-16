const APP_VERSION = "1.0";

const TABS = {
  overview: "工程概要",
  delivery: "構件進場",
  anchor: "基礎螺栓／柱腳",
  erection: "吊裝／臨時固定",
  hsb: "高強度螺栓",
  welding: "現場銲接",
  accuracy: "安裝精度",
  optional: "選用項目"
};

const localDate = new Date();
const today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;

const CHECK_DEFINITIONS = {
  anchor: [
    ["螺栓規格、數量與位置", "與核定施工圖及材料資料一致；保留設計值／實測值或文件編號"],
    ["螺栓定位與偏心", "單支、群組及群組中心與柱中心偏移在核定容許值內"],
    ["螺栓露出與螺紋保護", "露出高度符合圖說，至少保留可鎖固之完整螺紋，螺紋無損傷"],
    ["鋼筋干涉與固定方式", "未與結構鋼筋錯誤焊接；周圍鋼筋未被任意切斷或移位"],
    ["柱腳底板與標高", "柱腳底板位置、標高及接觸面符合設計；必要時完成調整記錄"],
    ["無收縮灌漿與完成狀況", "材料、施工及養護紀錄齊全，灌漿密實且無明顯缺失"]
  ],
  erection: [
    ["吊裝計畫與施工順序", "計畫已核准並向相關人員說明；現場順序與計畫一致"],
    ["吊點、吊具與作業區", "吊點及吊具符合計畫，作業區完成隔離與人員管制"],
    ["臨時螺栓與固定", "未形成穩定結構前，臨時螺栓、支撐、繫桿及防傾倒措施已完成"],
    ["構件穩定與垂直調整", "構件暫固定狀態穩定，調整與量測結果可追溯"],
    ["風雨及颱風應變", "風速、雨天及颱風警戒時依計畫停止、遮蔽或加固"],
    ["吊裝完成放行", "當日吊裝區無未固定構件，缺失已記錄並完成責任交辦"]
  ],
  hsb: [
    ["螺栓等級、尺寸與數量", "符合設計圖說及材料證明；接頭群組數量可追溯"],
    ["接合面與墊片", "接合面平整、清潔；必要時依規定使用墊片或斜墊片"],
    ["螺栓孔狀況", "孔內無油漆、泥砂、毛邊、變形或其他妨礙鎖固的異物"],
    ["初擰及終擰順序", "依施工計畫由接頭中心向外、交錯完成，並有施工紀錄"],
    ["工具校驗與抽查", "施工工具校驗文件有效；抽查或取樣結果符合要求"],
    ["終擰外觀與缺失閉合", "螺栓、螺帽、墊片及扭斷尾端外觀正常；補擰或換栓已複驗"]
  ],
  welding: [
    ["銲工資格與施工程序", "銲工資格有效，銲接程序／WPS 已核准並適用於本接頭"],
    ["接頭組立與根隙", "坡口、根隙、組立尺寸及背襯符合圖說或核准程序"],
    ["銲接面清潔", "無水分、油污、銹蝕、塗料、銲渣或其他雜物"],
    ["銲接環境與防護", "雨天、高濕度或風速超限時已停止或設置有效防護"],
    ["外觀檢查（VT）", "銲道外觀、尺寸及缺陷判定符合要求，報告可追溯至構件／銲道"],
    ["非破壞檢測與修補", "必要時完成 UT 等檢測；缺失修補後已重新檢測並閉合"]
  ],
  accuracy: [
    ["鋼柱垂直度", "依工程核定標準量測，設計值、實測值及允許誤差均有紀錄"],
    ["柱軸線與相鄰柱偏移", "柱中心線及相鄰柱相對位置符合核定容許值"],
    ["柱頂標高", "柱頂標高與樓層基準一致，調整後已重新量測"],
    ["梁水平度與樓層標高", "梁標高、水平度及上下樓層相對高程符合設計要求"],
    ["累積偏差", "各樓層累積偏移已納入量測，超出容許值時有調整紀錄"],
    ["整體垂直度／放行", "整體量測結果符合核定標準，測量資料與構件編號可追溯"]
  ]
};

const state = {
  overview: { project: "", contractor: "", date: today, reviewer: "" },
  delivery: { date: today, batch: "", reviewer: "", note: "", records: [] },
  anchor: { location: "", date: today, reviewer: "", boltSpec: "", designQty: "", actualQty: "", designElevation: "", actualElevation: "", eccentricity: "", note: "", checks: [] },
  erection: { area: "", date: today, reviewer: "", note: "", checks: [] },
  hsb: { location: "", date: today, reviewer: "", spec: "", designQty: "", actualQty: "", toolDoc: "", note: "", checks: [] },
  welding: { location: "", date: today, reviewer: "", welderDoc: "", wpsDoc: "", wind: "", testDoc: "", note: "", checks: [] },
  accuracy: { area: "", date: today, reviewer: "", memberNo: "", measureType: "鋼柱垂直度", designValue: "", actualValue: "", tolerance: "", note: "", checks: [] },
  optional: { enabled: "", note: "", result: "待確認" }
};

Object.entries(CHECK_DEFINITIONS).forEach(([group, definitions]) => {
  state[group].checks = definitions.map(([item, standard]) => ({ item, standard, actual: "", result: "待確認" }));
});

let activeTab = "overview";
let editDeliveryIndex = null;

// 本機草稿（共用 draft.js）：啟動時還原、輸入時去抖寫入、「清空」時刪除；範例模式不讀不寫。
const draft = createDraftStore("project-portal.steel.draft", () => state, {
  enabled: new URLSearchParams(location.search).get("example") !== "1"
});

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

function validateDialogForm(form) {
  const valid = form.checkValidity();
  form.classList.toggle("form-validation-error", !valid);
  return valid;
}

function bindDialogUx() {
  $$('dialog').forEach(dialog => dialog.addEventListener("close", () => {
    if (dialog.contains(document.activeElement)) document.activeElement.blur();
    dialog.querySelector("form")?.classList.remove("form-validation-error");
  }));
}
const esc = value => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const display = value => String(value ?? "").trim() || "—";
const printText = value => String(value ?? "").trim(); // PDF 用：未填就留白，不印「—」

// 三段式結果膠囊：以隱藏 radio + 相鄰 span 呈現（沿用既有 .unit-type 手法）。
// 未勾選任一段＝原本下拉選單的「待確認」狀態；點選其一會如同 <select> 觸發 change，
// 既有的委派事件（依 data-* 屬性讀取 event.target.value）不需更動。
const SEGMENT_ICONS = {
  pass: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`,
  fail: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  na: "N/A"
};

function resultSegmented(name, selected, attrs) {
  return `<div class="glass-segmented" role="radiogroup" aria-labelledby="${name}-label">${["符合", "不符合", "不適用"]
    .map(value => {
      const kind = value === "符合" ? "pass" : value === "不符合" ? "fail" : "na";
      return `<label><input type="radio" name="${name}" value="${value}" aria-label="${value}" ${value === selected ? "checked" : ""} ${attrs} /><span class="is-${kind}">${SEGMENT_ICONS[kind]}</span></label>`;
    })
    .join("")}</div>`;
}

function formatDate(value) {
  const [year, month, day] = String(value ?? "").split("-");
  return year && month && day ? `${year}/${month}/${day}` : "";
}

function syncDateDisplay(input) {
  const wrap = input.closest(".native-field-wrap");
  const output = wrap?.querySelector(".native-field-display");
  if (!output) return;
  output.textContent = input.value ? formatDate(input.value) : "尚未選擇日期";
  output.classList.toggle("is-empty", !input.value);
}

function syncDateDisplays() {
  $$('input[type="date"]').forEach(syncDateDisplay);
}

function setBoundInputs() {
  $$('[data-bind]').forEach(input => {
    const [group, key] = input.dataset.bind.split(".");
    if (!state[group] || !Object.prototype.hasOwnProperty.call(state[group], key)) return;
    if (input.type === "radio") input.checked = input.value === state[group][key];
    else input.value = state[group][key] ?? "";
  });
  syncDateDisplays();
}

function updateIdentity() {
  const parts = [state.accuracy.memberNo || state.anchor.location || state.hsb.location || state.welding.location, state.overview.project].filter(Boolean);
  $("#record-identity").textContent = parts.length ? parts.join("｜") : "尚未指定構件";
}

function showTab(tab) {
  if (!TABS[tab]) return;
  activeTab = tab;
  document.body.dataset.activeTab = tab;
  $$('.tab-panel').forEach(panel => { panel.hidden = panel.id !== `panel-${tab}`; });
  $$('[role="tab"]').forEach(button => {
    const selected = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  $("#export-current-label").textContent = TABS[tab];
}

function renderChecks(group) {
  const target = $(`#${group}-checks`);
  if (!target) return;
  target.innerHTML = state[group].checks.map((check, index) => `
    <article class="steel-check-card ${check.result === "不符合" ? "is-failed" : ""}">
      <div class="steel-check-head"><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(check.item)}</strong></div>
      <p>${esc(check.standard)}</p>
      <div class="steel-check-fields">
        <label class="field"><span>現場紀錄／文件編號</span><input type="text" value="${esc(check.actual)}" data-check-group="${group}" data-check-index="${index}" data-check-field="actual" /></label>
        <div class="field result-field"><span id="steel-${group}-${index}-result-label">複核結果</span>${resultSegmented(`steel-${group}-${index}-result`, check.result, `data-check-group="${group}" data-check-index="${index}" data-check-field="result"`)}</div>
      </div>
    </article>`).join("");
}

function renderDelivery() {
  const records = state.delivery.records;
  const complete = records.filter(record => record.result !== "待確認").length;
  $("#delivery-summary").innerHTML = `
    <div><dt>進場構件／批次</dt><dd>${records.length} <small>筆</small></dd></div>
    <div><dt>已完成複核</dt><dd>${complete} <small>筆</small></dd></div>
    <div><dt>待確認</dt><dd>${records.length - complete} <small>筆</small></dd></div>`;
  $("#delivery-list").innerHTML = records.length ? records.map((record, index) => `
    <article class="steel-record-card ${record.result === "不符合" ? "is-failed" : record.result === "符合" ? "is-passed" : ""}">
      <div>
        <div class="steel-record-title"><strong>${esc(record.type)}｜${esc(record.memberNo)}</strong><span>${esc(record.result)}</span></div>
        <div class="steel-record-meta"><span><b>規格</b> ${esc(display(record.spec))}</span><span><b>數量</b> ${esc(display(record.qty))} 件</span><span><b>文件</b> ${esc(display(record.doc))}</span><span><b>外觀／堆置</b> ${esc(record.appearance)}／${esc(record.storage)}</span></div>
      </div>
      <div class="record-item-actions"><button type="button" data-edit-delivery="${index}">修改</button><button type="button" data-delete-delivery="${index}">刪除</button></div>
    </article>`).join("") : `<p class="empty-state">尚無進場構件，請按＋新增構件。</p>`;
}

function renderAll() {
  setBoundInputs();
  renderDelivery();
  Object.keys(CHECK_DEFINITIONS).forEach(renderChecks);
  $("#optional-fields").hidden = !state.optional.enabled;
  $$('[data-optional]').forEach(button => button.classList.toggle("is-enabled", state.optional.enabled === button.dataset.optional));
  updateIdentity();
  showTab(activeTab);
}

function resetState() {
  draft.clear();
  state.overview = { project: "", contractor: "", date: "", reviewer: "" };
  state.delivery = { date: "", batch: "", reviewer: "", note: "", records: [] };
  state.anchor = { location: "", date: "", reviewer: "", boltSpec: "", designQty: "", actualQty: "", designElevation: "", actualElevation: "", eccentricity: "", note: "", checks: [] };
  state.erection = { area: "", date: "", reviewer: "", note: "", checks: [] };
  state.hsb = { location: "", date: "", reviewer: "", spec: "", designQty: "", actualQty: "", toolDoc: "", note: "", checks: [] };
  state.welding = { location: "", date: "", reviewer: "", welderDoc: "", wpsDoc: "", wind: "", testDoc: "", note: "", checks: [] };
  state.accuracy = { area: "", date: "", reviewer: "", memberNo: "", measureType: "鋼柱垂直度", designValue: "", actualValue: "", tolerance: "", note: "", checks: [] };
  state.optional = { enabled: "", note: "", result: "待確認" };
  Object.entries(CHECK_DEFINITIONS).forEach(([group, definitions]) => { state[group].checks = definitions.map(([item, standard]) => ({ item, standard, actual: "", result: "待確認" })); });
  editDeliveryIndex = null;
  renderAll();
  $("#clear-dialog").close();
}

function openDeliveryDialog(index = null) {
  editDeliveryIndex = index;
  const record = index === null ? { type: "鋼柱", memberNo: "", spec: "", qty: "1", doc: "", appearance: "待確認", storage: "待確認", result: "待確認" } : state.delivery.records[index];
  $("#delivery-type").value = record.type;
  $("#delivery-member").value = record.memberNo;
  $("#delivery-spec").value = record.spec;
  $("#delivery-qty").value = record.qty;
  $("#delivery-doc").value = record.doc;
  $$('input[name="delivery-appearance"]').forEach(radio => { radio.checked = radio.value === record.appearance; });
  $$('input[name="delivery-storage"]').forEach(radio => { radio.checked = radio.value === record.storage; });
  $$('input[name="delivery-result"]').forEach(radio => { radio.checked = radio.value === record.result; });
  $("#delivery-dialog-title").textContent = index === null ? "新增進場構件" : "修改進場構件";
  $("#delivery-form [type='submit']").textContent = index === null ? "確認加入" : "確認更新";
  $("#delivery-dialog").showModal();
}

function removeDelivery(index) {
  state.delivery.records.splice(index, 1);
  renderDelivery();
}

function printHeader(title, sequence, identity = "尚未指定構件") {
  const display = printText;
  const project = state.overview;
  const id = identity || "尚未指定構件";
  return `<header class="print-document-header"><div class="print-header-title"><p>STEEL STRUCTURE FIELD REVIEW / ${sequence}</p><h1>${esc(title)}</h1></div><div class="print-header-meta-body"><div class="print-header-project-lines"><div><span>工程名稱：</span><strong>${esc(display(project.project))}</strong></div><div><span>施工日期：</span><strong>${esc(display(project.date))}</strong></div><div><span>施工廠商：</span><strong>${esc(display(project.contractor))}</strong></div><div><span>填表人：</span><strong>${esc(display(project.reviewer))}</strong></div></div></div><div class="print-header-logo-wrap"><img class="print-logo" src="./taisei.png" alt="大成建設標誌" /><strong class="print-header-identity">${esc(id)}</strong></div></header>`;
}

function printFooter() {
  return `<footer class="print-footer"><div class="print-signature-grid" aria-label="簽名欄"><div><span>所長</span><span aria-hidden="true"></span></div><div><span>副所長</span><span aria-hidden="true"></span></div><div><span>擔當者</span><span aria-hidden="true"></span></div></div></footer>`;
}

function printMeta(fields) {
  const display = printText;
  return `<div class="steel-print-meta">${fields.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(display(value))}</strong></div>`).join("")}</div>`;
}

function printChecks(group) {
  const display = printText;
  const rows = state[group].checks.map((check, index) => `<tr><td>${index + 1}</td><td class="text-left">${esc(check.item)}</td><td class="text-left">${esc(check.standard)}</td><td class="text-left">${esc(display(check.actual))}</td><td>${esc(check.result)}</td></tr>`).join("");
  return `<table class="print-table steel-print-table"><thead><tr><th>項次</th><th>檢查項目</th><th>判定標準</th><th>現場紀錄／文件編號</th><th>結果</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPrint() {
  const display = printText;
  const id = state.accuracy.memberNo || state.anchor.location || state.hsb.location || state.welding.location || "尚未指定構件";
  $("#print-overview").innerHTML = `${printHeader("鋼構施工複核表", "01", id)}<section class="print-section"><h2>工程概要</h2>${printMeta([["工程名稱", state.overview.project], ["施工廠商", state.overview.contractor], ["施工日期", state.overview.date], ["填表人", state.overview.reviewer]])}</section><section class="print-section"><h2>營造廠複核範圍</h2><div class="steel-print-note">確認設計、進場、安裝、關鍵檢測證據與放行條件；專業廠商的逐支螺栓及逐道銲接製程紀錄，請以文件編號或抽查結果確認。</div></section>${printFooter()}`;

  const deliveryRows = state.delivery.records.length ? state.delivery.records.map((record, index) => `<tr><td>${index + 1}</td><td>${esc(record.type)}</td><td>${esc(record.memberNo)}</td><td class="text-left">${esc(display(record.spec))}</td><td>${esc(display(record.qty))}</td><td>${esc(display(record.doc))}</td><td>${esc(record.appearance)}／${esc(record.storage)}</td><td>${esc(record.result)}</td></tr>`).join("") : `<tr><td colspan="8" class="print-empty">尚無進場構件</td></tr>`;
  $("#print-delivery").innerHTML = `${printHeader("構件進場確認", "02", state.delivery.batch || id)}${printMeta([["進場日期", state.delivery.date], ["進場批次／文件", state.delivery.batch], ["複核人", state.delivery.reviewer], ["工程名稱", state.overview.project]])}<section class="print-section"><h2>構件清單</h2><table class="print-table steel-print-table"><thead><tr><th>項次</th><th>類型</th><th>構件編號</th><th>規格／材質</th><th>數量</th><th>材料文件</th><th>外觀／堆置</th><th>結果</th></tr></thead><tbody>${deliveryRows}</tbody></table></section><section class="print-section"><h2>進場文件／異常備註</h2><div class="steel-print-note">${esc(display(state.delivery.note))}</div></section>${printFooter()}`;

  $("#print-anchor").innerHTML = `${printHeader("基礎螺栓／柱腳複核", "03", state.anchor.location || id)}${printMeta([["柱腳／軸線", state.anchor.location], ["螺栓規格", state.anchor.boltSpec], ["設計／實際數量", `${display(state.anchor.designQty)} ／ ${display(state.anchor.actualQty)} 支`], ["柱腳標高設計／實測", `${display(state.anchor.designElevation)} ／ ${display(state.anchor.actualElevation)} m`], ["偏心實測", `${display(state.anchor.eccentricity)} mm`], ["複核人", state.anchor.reviewer]])}<section class="print-section"><h2>關鍵複核項目</h2>${printChecks("anchor")}</section><section class="print-section"><h2>柱腳／灌漿備註</h2><div class="steel-print-note">${esc(display(state.anchor.note))}</div></section>${printFooter()}`;

  $("#print-erection").innerHTML = `${printHeader("吊裝／臨時固定複核", "04", state.erection.area || id)}${printMeta([["吊裝區域／樓層", state.erection.area], ["施工日期", state.erection.date], ["複核人", state.erection.reviewer], ["工程名稱", state.overview.project]])}<section class="print-section"><h2>關鍵複核項目</h2>${printChecks("erection")}</section><section class="print-section"><h2>吊裝／臨時固定備註</h2><div class="steel-print-note">${esc(display(state.erection.note))}</div></section>${printFooter()}`;

  $("#print-hsb").innerHTML = `${printHeader("高強度螺栓複核", "05", state.hsb.location || id)}${printMeta([["接頭／構件編號", state.hsb.location], ["螺栓規格", state.hsb.spec], ["設計／實際數量", `${display(state.hsb.designQty)} ／ ${display(state.hsb.actualQty)} 支`], ["工具／校驗文件", state.hsb.toolDoc], ["施工日期", state.hsb.date], ["複核人", state.hsb.reviewer]])}<section class="print-section"><h2>關鍵複核項目</h2>${printChecks("hsb")}</section><section class="print-section"><h2>抽查及補擰備註</h2><div class="steel-print-note">${esc(display(state.hsb.note))}</div></section>${printFooter()}`;

  $("#print-welding").innerHTML = `${printHeader("現場銲接複核", "06", state.welding.location || id)}${printMeta([["銲道／構件編號", state.welding.location], ["銲工資格／證照", state.welding.welderDoc], ["WPS／施工計畫", state.welding.wpsDoc], ["環境風速", `${display(state.welding.wind)} m/s`], ["VT／UT 報告", state.welding.testDoc], ["複核人", state.welding.reviewer]])}<section class="print-section"><h2>關鍵複核項目</h2>${printChecks("welding")}</section><section class="print-section"><h2>銲接缺失及修補備註</h2><div class="steel-print-note">${esc(display(state.welding.note))}</div></section>${printFooter()}`;

  $("#print-accuracy").innerHTML = `${printHeader("安裝精度複核", "07", state.accuracy.memberNo || id)}${printMeta([["樓層／區域", state.accuracy.area], ["構件編號", state.accuracy.memberNo], ["量測項目", state.accuracy.measureType], ["設計／基準值", state.accuracy.designValue], ["實測值", state.accuracy.actualValue], ["允許誤差", `${display(state.accuracy.tolerance)} mm`], ["量測日期", state.accuracy.date], ["複核人", state.accuracy.reviewer]])}<section class="print-section"><h2>關鍵複核項目</h2>${printChecks("accuracy")}</section><section class="print-section"><h2>調整及複測備註</h2><div class="steel-print-note">${esc(display(state.accuracy.note))}</div></section>${printFooter()}`;

  const optionalHidden = !state.optional.enabled;
  $("#print-optional").classList.toggle("print-page-empty", optionalHidden);
  $("#print-optional").innerHTML = optionalHidden ? "" : `${printHeader("選用項目複核", "08", id)}${printMeta([["選用項目", state.optional.enabled], ["工程名稱", state.overview.project], ["施工日期", state.overview.date], ["複核人", state.overview.reviewer]])}<section class="print-section"><h2>選用項目紀錄</h2><div class="steel-print-note">${esc(display(state.optional.note))}</div></section><section class="print-section"><h2>檢查結果</h2><div class="steel-print-note">${esc(state.optional.result)}</div></section>${printFooter()}`;
}

function exportData() {
  return {
    app_version: APP_VERSION,
    schema_version: "1.0",
    record_type: "steel_structure_field_review",
    exported_at: new Date().toISOString(),
    project: { name: state.overview.project || null, contractor: state.overview.contractor || null, construction_date: state.overview.date || null, form_filler: state.overview.reviewer || null },
    delivery: { date: state.delivery.date || null, batch: state.delivery.batch || null, reviewer: state.delivery.reviewer || null, note: state.delivery.note || null, records: state.delivery.records },
    anchor: { ...state.anchor, checks: state.anchor.checks },
    erection: { ...state.erection, checks: state.erection.checks },
    high_strength_bolts: { ...state.hsb, checks: state.hsb.checks },
    field_welding: { ...state.welding, checks: state.welding.checks },
    installation_accuracy: { ...state.accuracy, checks: state.accuracy.checks },
    optional: { ...state.optional }
  };
}

function downloadText(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setPdfDocumentTitle(scope) {
  const identity = state.accuracy.memberNo || state.anchor.location || state.hsb.location || state.welding.location || state.delivery.batch;
  const parts = ["鋼構施工複核表", identity, scope === "all" ? "完整檢核紀錄" : TABS[activeTab], state.overview.date || today]
    .filter(Boolean)
    .map(value => String(value).trim().replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-"));
  const previousTitle = document.title;
  document.title = parts.join("_");
  window.addEventListener("afterprint", () => { document.title = previousTitle; }, { once: true });
}

function preparePrint(scope) {
  renderPrint();
  document.body.dataset.printScope = scope;
  $$('.print-page').forEach(page => page.classList.toggle("print-selected", page.dataset.printTab === activeTab));
  setPdfDocumentTitle(scope);
  paginatePrintReport();
}

function exportPdf(scope) {
  $("#export-dialog").close();
  preparePrint(scope);
  window.print();
}

function exportJson() {
  const date = (state.overview.date || today).replaceAll("/", "-");
  downloadText(`${JSON.stringify(exportData(), null, 2)}\n`, "application/json;charset=utf-8", `steel-structure-${date}.json`);
}

function loadExample() {
  state.overview = { project: "Example Construction Project", contractor: "Example Steel Co.", date: today, reviewer: "Site Engineer" };
  state.delivery = { date: today, batch: "ST-2026-0811", reviewer: "Site Engineer", note: "材料證明與進場照片已核對。", records: [
    { type: "鋼柱", memberNo: "C1-03", spec: "BOX-600×600×25／SN490", qty: "1", doc: "MTC-0811-03", appearance: "符合", storage: "符合", result: "符合" },
    { type: "鋼梁", memberNo: "G3-12", spec: "H-600×300×12×20／SN490", qty: "1", doc: "MTC-0811-12", appearance: "符合", storage: "符合", result: "符合" }
  ] };
  state.anchor = { location: "C1／X3-Y5", date: today, reviewer: "Site Engineer", boltSpec: "M24", designQty: "4", actualQty: "4", designElevation: "12.000", actualElevation: "12.004", eccentricity: "3", note: "柱腳灌漿完成，無明顯缺失。", checks: [] };
  state.erection = { area: "A區／3F", date: today, reviewer: "Site Engineer", note: "吊裝順序依計畫，臨時支撐完成。", checks: [] };
  state.hsb = { location: "G3-12／J01", date: today, reviewer: "Site Engineer", spec: "F10T M20", designQty: "12", actualQty: "12", toolDoc: "TORQUE-2026-0810", note: "抽查 3 支，結果符合。", checks: [] };
  state.welding = { location: "C1-G3 W05", date: today, reviewer: "Site Engineer", welderDoc: "WELD-3021", wpsDoc: "WPS-S-02 Rev.1", wind: "0.8", testDoc: "UT-2026-0811-05", note: "VT／UT 報告已核對，無修補紀錄。", checks: [] };
  state.accuracy = { area: "A區／3F", date: today, reviewer: "Site Engineer", memberNo: "C1-03", measureType: "鋼柱垂直度", designValue: "0", actualValue: "3", tolerance: "10", note: "調整後複測完成。", checks: [] };
  Object.entries(CHECK_DEFINITIONS).forEach(([group, definitions]) => {
    state[group].checks = definitions.map(([item, standard], index) => ({ item, standard, actual: index === 0 ? "已確認" : "符合；文件已核對", result: "符合" }));
  });
  state.optional = { enabled: "stud", note: "剪力釘尺寸、位置與焊接外觀已抽查；彎折試驗報告 ST-TEST-08 已確認。", result: "符合" };
}

function initialize() {
  bindDialogUx();
  const query = new URLSearchParams(location.search);
  if (query.get("example") === "1") loadExample();
  renderAll();
  $$('[role="tab"]').forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
    button.addEventListener("keydown", event => {
      const tabs = $$('[role="tab"]');
      const index = tabs.indexOf(button);
      const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
      if (!direction) return;
      event.preventDefault();
      const next = tabs[(index + direction + tabs.length) % tabs.length];
      showTab(next.dataset.tab); next.focus();
    });
  });

  document.addEventListener("input", event => {
    if (event.target.matches('input[type="date"]')) syncDateDisplay(event.target);
    const bound = event.target.closest("[data-bind]");
    if (bound) {
      const [group, key] = bound.dataset.bind.split(".");
      if (state[group]) state[group][key] = bound.value;
      updateIdentity();
    }
    const check = event.target.closest("[data-check-group]");
    if (check) state[check.dataset.checkGroup].checks[Number(check.dataset.checkIndex)][check.dataset.checkField] = check.value;
  });

  document.addEventListener("change", event => {
    const bound = event.target.closest("[data-bind]");
    if (bound) {
      const [group, key] = bound.dataset.bind.split(".");
      if (state[group]) state[group][key] = bound.value;
      updateIdentity();
    }
    const check = event.target.closest("[data-check-group]");
    if (check) {
      const group = check.dataset.checkGroup;
      state[group].checks[Number(check.dataset.checkIndex)][check.dataset.checkField] = check.value;
      if (check.dataset.checkField === "result") renderChecks(group);
    }
  });

  // 會改到 state 的互動都經過這三種事件；「確認清空」那一下除外，否則剛刪掉的草稿又會被寫回。
  ["input", "change", "submit"].forEach(type => document.addEventListener(type, () => draft.schedule()));
  document.addEventListener("click", event => { if (!event.target.closest("#confirm-clear")) draft.schedule(); });

  $("#help-button").addEventListener("click", () => $("#help-dialog").showModal());
  $("#clear-button").addEventListener("click", () => $("#clear-dialog").showModal());
  $("#confirm-clear").addEventListener("click", resetState);
  $("#export-button").addEventListener("click", () => { $("#export-dialog").showModal(); });
  $$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
  $$('[data-export-format]').forEach(button => button.addEventListener("click", () => button.dataset.exportFormat === "json" ? (exportJson(), $("#export-dialog").close()) : exportPdf(button.dataset.exportFormat === "pdf-all" ? "all" : "current")));
  $$('[data-optional]').forEach(button => button.addEventListener("click", () => { state.optional.enabled = state.optional.enabled === button.dataset.optional ? "" : button.dataset.optional; renderAll(); }));

  $("#add-delivery").addEventListener("click", () => openDeliveryDialog());
  $("#delivery-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!validateDialogForm(event.currentTarget)) return;
    const record = { type: $("#delivery-type").value, memberNo: $("#delivery-member").value.trim(), spec: $("#delivery-spec").value.trim(), qty: $("#delivery-qty").value, doc: $("#delivery-doc").value.trim(), appearance: document.querySelector('input[name="delivery-appearance"]:checked')?.value || "待確認", storage: document.querySelector('input[name="delivery-storage"]:checked')?.value || "待確認", result: document.querySelector('input[name="delivery-result"]:checked')?.value || "待確認" };
    if (editDeliveryIndex === null) state.delivery.records.push(record); else state.delivery.records[editDeliveryIndex] = record;
    $("#delivery-dialog").close(); renderDelivery(); updateIdentity();
  });

  document.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit-delivery]");
    const remove = event.target.closest("[data-delete-delivery]");
    if (edit) openDeliveryDialog(Number(edit.dataset.editDelivery));
    if (remove) removeDelivery(Number(remove.dataset.deleteDelivery));
  });

  window.addEventListener("afterprint", () => { document.body.dataset.printScope = "none"; });
  if (TABS[query.get("tab")]) showTab(query.get("tab"));
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./sw.js").catch(() => {});
}

Object.assign(state, draft.load() ?? {});
initialize();
