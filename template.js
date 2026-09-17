const APP_VERSION = "1.0-template";

const localDate = new Date();
const today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;

const COMMON_CHECKS = [
  ["setout", "放樣線與標示", "軸線、邊線、中心線及完成面標示完成；一般放樣誤差控制於 ±2 mm 內", "填寫實測偏差（mm）"],
  ["condition", "模板外觀與使用狀態", "模板無過度破損、翹曲、變形或影響混凝土外觀與尺寸之情形", "填寫模板狀況"],
  ["releaseAgent", "脫模劑", "使用經核准之水性或油性脫模劑，塗布均勻且未污染鋼筋、預埋件及施工縫", "水性／油性／不適用"],
  ["bottomStop", "柱牆底擋板／壓條", "位置、高程及固定方式符合施工圖，無漏漿疑慮", "填寫位置／高程確認"],
  ["tightness", "模板接縫密合", "模板連結緊密，無明顯縫隙、透光或漏漿風險", "例如：接縫無透光"],
  ["support", "側向支撐與固定", "支撐及固定確實，無滑動、傾倒、沉陷或爆模風險", "填寫支撐狀況"],
  ["corner", "轉角與防爆模加強", "轉角、接縫及易爆模處已依施工計畫完成加強", "填寫加強位置"],
  ["embedded", "預埋件與套管", "位置、尺寸、數量及固定方式符合施工圖，不因澆置而移位", "填寫預埋確認結果"],
  ["joint", "施工縫／伸縮縫／吊模", "位置、高程及固定方式符合施工圖與施工詳圖", "填寫位置或不適用"],
  ["clean", "模板內部與清潔口", "柱、牆、梁底及板底無木屑、泥砂、積水等雜物，清潔口已完成清理", "例如：清潔完成"],
  ["loading", "材料堆置與施工動線", "模板及支撐未承受計畫外載重，澆置巡檢動線暢通", "填寫材料堆置狀況"]
];

const TYPE_CHECKS = {
  柱: [
    ["cleaningOpening", "柱模清潔口", "澆置前清潔口已預留並完成清理", "填寫清潔口狀況"],
    ["columnSupport", "柱模側向支撐與槽鋼", "側向支撐、槽鋼固定及間距符合支撐計畫", "填寫實測間距（mm）"],
    ["columnSection", "柱模斷面尺寸", "柱寬、柱深及位置符合施工圖", "填寫設計／實測尺寸（mm）"]
  ],
  牆: [
    ["vIron", "牆模 V 型鐵擋", "V 型鐵擋方向正確，澆置時不致造成填充不全", "填寫方向確認"],
    ["wallOpening", "牆面預留開孔", "開孔位置、尺寸及防脹隆措施符合圖說", "填寫開孔確認結果"],
    ["wallSupport", "牆／電梯模板支撐", "側向及電梯模板支撐符合安全計畫", "填寫支撐確認結果"],
    ["wallDimension", "牆厚與垂直度", "牆厚、牆面垂直度及完成面位置符合圖說與許可差", "填寫設計／實測尺寸（mm）"]
  ],
  梁: [
    ["camber", "梁模預拱", "依圖說或施工計畫確認是否需要預拱", "填寫預拱值或不適用"],
    ["beamTie", "梁側螺桿與槽鋼", "間距及固定方式符合支撐計畫", "填寫實測間距／設計間距"],
    ["beamOpening", "穿梁開口與發泡劑", "穿梁開口位置符合圖說；發泡劑使用已經核准", "填寫位置／材料確認"],
    ["beamBottom", "梁底模與支撐", "梁底模清潔完成，梁底支撐及大、小梁間距符合計畫", "填寫清潔／間距確認"]
  ],
  板: [
    ["hangingForm", "吊模", "吊模位置、標高及固定方式符合圖說", "填寫吊模確認結果"],
    ["slabJoint", "施工縫／伸縮縫", "位置、標高及固定方式符合圖說；斷熱材已依詳圖設置", "填寫位置或不適用"],
    ["slabOpening", "板上開口與預留", "開口位置、尺寸及補強需求符合圖說", "填寫開口確認結果"],
    ["slabLoad", "板上材料堆置", "材料堆置符合載重限制與施工計畫", "填寫材料堆置狀況"],
    ["slabSupport", "板底支撐", "可調鋼管支柱、插銷、水平繫桿及支撐間距符合安全計畫", "填寫支撐確認結果"],
    ["elevationMarker", "板面標高器", "完成面高程、降板及斜率標示清楚", "填寫標高確認結果"]
  ],
  樓梯: [
    ["stairForm", "樓梯模板組立", "階梯、平台及側模固定穩定，位置符合圖說", "填寫樓梯模板狀況"],
    ["stairDimension", "階高與階深標示", "階高、階深及平台高程已完成複核", "填寫量測紀錄位置"]
  ],
  其他: [
    ["special", "特殊模板條件", "依核定施工詳圖及施工計畫完成專案確認", "填寫特殊條件"]
  ]
};

const RELEASE_CHECKS = [
  ["assembly", "模板組立完成", "模板、接縫及固定均已完成"],
  ["measurement", "尺寸與高程已複核", "重要位置、尺寸及高程已有實測紀錄"],
  ["support", "支撐與固定完成", "支撐計畫、側撐及防爆模措施已確認"],
  ["openings", "開口、套管與預埋完成", "位置、尺寸、數量及固定方式符合圖說"],
  ["coordination", "鋼筋與機電介面確認", "模板未壓迫鋼筋、保護層或機電預埋"],
  ["clean", "模板內部清潔完成", "無木屑、泥砂、積水及其他雜物"],
  ["access", "澆置巡檢條件完成", "人員可安全巡檢模板、支撐及澆置動線"],
  ["vendor", "廠商自主檢查紀錄完成", "專業廠商已完成自主檢查並提出缺失改善結果"]
];

const TYPE_MEASURES = {
  柱: ["vertical", "sectionWidth", "sectionHeight"],
  牆: ["vertical", "sectionWidth", "sectionHeight"],
  梁: ["position", "elevation", "sectionWidth", "sectionHeight"],
  板: ["elevation", "sectionWidth"],
  樓梯: ["elevation", "stairRise", "stairRun"],
  其他: ["position", "elevation", "sectionWidth"]
};

const MEASURE_LABELS = {
  position: ["構件位置偏差", "mm", "軸線／邊界偏差，預設 ±25 mm"],
  elevation: ["高程差", "mm", "樓板、梁底或完成面高程，預設 ±20 mm"],
  vertical: ["垂直度偏差", "mm", "依檢查高度及公司標準調整"],
  sectionWidth: ["斷面寬度／厚度", "mm", "依設計尺寸區間判定"],
  sectionHeight: ["斷面高度", "mm", "依設計尺寸區間判定"],
  stairRise: ["相鄰階高差", "mm", "預設 ±3 mm"],
  stairRun: ["相鄰階深差", "mm", "預設 ±6 mm"]
};

const TAB_LABELS = { overview: "工程概要", members: "構件資訊", install: "模板安裝", measure: "尺寸複核", release: "放行／拆模" };

function createMember() {
  return {
    id: "", type: "柱", grid: "", width: "", height: "", elevation: "", surface: "一般表面", checks: {}, measures: {}
  };
}

function createState() {
  return {
    overview: { project: "", contractor: "", date: today, inspectionDate: today, reviewer: "", floor: "", area: "", drawing: "", stage: "模板組立完成" },
    members: [createMember()],
    activeMember: 0,
    release: {
      checks: {}, decision: "待放行", decisionNote: "", pourDate: today, stripDate: "", stripCondition: "尚未確認", reshoring: "尚未確認", postNote: ""
    }
  };
}

let state = createState();
let activeTab = "overview";

// 本機草稿（共用 draft.js）：啟動時還原、輸入時去抖寫入、「清空」時刪除；範例模式不讀不寫。
const draft = createDraftStore("project-portal.template.draft", () => state, {
  enabled: new URLSearchParams(location.search).get("example") !== "1"
});

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const display = value => String(value ?? "").trim() || "—";
const printText = value => String(value ?? "").trim(); // PDF 用：未填就留白，不印「—」
const num = value => { const n = Number.parseFloat(value); return Number.isFinite(n) ? n : null; };
const fixed = value => Number.isFinite(value) ? value.toFixed(1) : "";
const formatDate = value => { const [y, m, d] = String(value ?? "").split("-"); return y && m && d ? `${y}/${m}/${d}` : ""; };

// 三段式結果膠囊：以隱藏 radio + 相鄰 span 呈現（沿用既有 .unit-type 手法）。
// 未勾選任一段＝原本下拉選單的「待確認」狀態；點選其一會如同 <select> 觸發 change，
// 既有的委派事件（依 data-* 屬性讀取 event.target.value）不需更動。
const SEGMENT_ICONS = {
  pass: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`,
  fail: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  na: "N/A"
};
function statusSegmented(name, selected, attrs) { return `<div class="glass-segmented" role="radiogroup" aria-labelledby="${name}-label">${["合格", "不合格", "不適用"].map(value => { const kind = value === "合格" ? "pass" : value === "不合格" ? "fail" : "na"; return `<label><input type="radio" name="${name}" value="${value}" aria-label="${value}" ${value === selected ? "checked" : ""} ${attrs} /><span class="is-${kind}">${SEGMENT_ICONS[kind]}</span></label>`; }).join("")}</div>`; }

function ensureMember(member) {
  const all = [...COMMON_CHECKS, ...(TYPE_CHECKS[member.type] || TYPE_CHECKS.其他)];
  all.forEach(([id]) => { if (!member.checks[id]) member.checks[id] = { actual: "", result: "待確認" }; });
  (TYPE_MEASURES[member.type] || TYPE_MEASURES.其他).forEach(id => { if (!member.measures[id]) member.measures[id] = { design: defaultDesign(member, id), actual: "" }; });
}

function defaultDesign(member, id) {
  if (id === "sectionWidth") return member.width || "";
  if (id === "sectionHeight") return member.height || "";
  if (id === "elevation") return member.elevation || "0";
  return "0";
}

function toleranceFor(member, id, design) {
  if (id === "vertical") return { lower: -10, upper: 10, label: "±10 mm（依檢查高度調整）" };
  if (id === "position") return { lower: -25, upper: 25, label: "±25 mm" };
  if (id === "elevation") return { lower: -20, upper: 20, label: "±20 mm" };
  if (id === "stairRise") return { lower: -3, upper: 3, label: "±3 mm" };
  if (id === "stairRun") return { lower: -6, upper: 6, label: "±6 mm" };
  const designValue = num(design);
  if (designValue === null) return { lower: -10, upper: 10, label: "依設計尺寸填寫" };
  if (designValue <= 300) return { lower: -6, upper: 10, label: "-6～+10 mm" };
  if (designValue <= 1000) return { lower: -10, upper: 13, label: "-10～+13 mm" };
  return { lower: -20, upper: 25, label: "-20～+25 mm" };
}

function activeMember() { return state.members[state.activeMember] || null; }

function syncDateDisplay(input) {
  const displayEl = input.closest(".native-field-wrap")?.querySelector(".native-field-display");
  if (!displayEl) return;
  displayEl.textContent = input.value ? formatDate(input.value) : "尚未選擇日期";
  displayEl.classList.toggle("is-empty", !input.value);
}

function syncDateDisplays() { $$('input[type="date"]').forEach(syncDateDisplay); }

function updateIdentity() {
  const member = activeMember();
  const identity = member && (member.id || member.type) ? [state.overview.floor, member.type, member.id].filter(Boolean).join("｜") : "尚未指定構件";
  $("#record-identity").textContent = identity;
}

function bindGeneralInputs() {
  $$('[data-bind]').forEach(input => {
    const [group, key] = input.dataset.bind.split(".");
    input.value = state[group][key] ?? "";
  });
  $$('[data-release-bind]').forEach(input => { input.value = state.release[input.dataset.releaseBind] ?? ""; });
  syncDateDisplays();
}

function renderMembers() {
  $("#member-count").textContent = `${state.members.length} 個構件`;
  $("#member-list").innerHTML = state.members.length ? state.members.map((member, index) => {
    ensureMember(member);
    return `<article class="member-card" data-member-card="${index}">
      <div class="member-card-header"><strong>構件 ${index + 1}</strong>${state.members.length > 1 ? `<button type="button" data-remove-member="${index}">移除</button>` : ""}</div>
      <div class="form-grid">
        <label class="field"><span>構件類型</span><select data-member-field="type" data-member-index="${index}">${["柱", "牆", "梁", "板", "樓梯", "其他"].map(type => `<option value="${type}" ${member.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label>
        <label class="field"><span>構件編號</span><input type="text" data-member-field="id" data-member-index="${index}" value="${esc(member.id)}" placeholder="例如：C1-03" /></label>
        <label class="field"><span>軸線／位置</span><input type="text" data-member-field="grid" data-member-index="${index}" value="${esc(member.grid)}" placeholder="例如：A-1／B～C" /></label>
        <label class="field"><span>表面類型</span><select data-member-field="surface" data-member-index="${index}">${["一般表面", "外露柱", "清水混凝土"].map(item => `<option value="${item}" ${member.surface === item ? "selected" : ""}>${item}</option>`).join("")}</select></label>
        <label class="field"><span>設計寬度（mm）</span><input type="number" min="0" step="1" data-member-field="width" data-member-index="${index}" value="${esc(member.width)}" placeholder="例如：600" /></label>
        <label class="field"><span>設計高度／厚度（mm）</span><input type="number" min="0" step="1" data-member-field="height" data-member-index="${index}" value="${esc(member.height)}" placeholder="例如：800" /></label>
        <label class="field span-two"><span>設計高程（mm）</span><input type="number" step="1" data-member-field="elevation" data-member-index="${index}" value="${esc(member.elevation)}" placeholder="例如：3200；板／梁可填完成面或底模高程" /></label>
      </div>
    </article>`;
  }).join("") : `<div class="empty-state">尚未新增構件，請按右上角「新增構件」。</div>`;
  renderMemberSelectors();
  updateIdentity();
}

function renderMemberSelectors() {
  const options = state.members.map((member, index) => `<option value="${index}" ${index === state.activeMember ? "selected" : ""}>${index + 1}. ${esc(member.type)}｜${esc(member.id || "未編號")}</option>`).join("");
  ["#active-member", "#measure-member"].forEach(selector => { $(selector).innerHTML = options || `<option value="">尚未新增構件</option>`; $(selector).disabled = !state.members.length; });
  const member = activeMember();
  $("#active-member-summary").textContent = member ? `${member.type}｜${member.id || "未編號"}${member.grid ? `｜${member.grid}` : ""}` : "尚未新增構件";
}

function renderCheckCard(check, index, collection, member) {
  const record = member.checks[check[0]] || { actual: "", result: "待確認" };
  const name = `check-${collection}-${esc(check[0])}-result`;
  return `<article class="check-card ${record.result === "不合格" ? "is-failed" : record.result === "合格" || record.result === "不適用" ? "is-passed" : "is-pending"}" data-check-card="${collection}" data-check-id="${esc(check[0])}">
    <div><h4>${index + 1}. ${esc(check[1])}</h4><p>${esc(check[2])}</p></div>
    <div class="check-card-fields">
      <label class="field"><span>紀錄／實測</span><input type="text" data-check-actual="${collection}" data-check-collection="${collection}" data-check-id="${esc(check[0])}" value="${esc(record.actual)}" placeholder="${esc(check[3] || "填寫現場結果")}" /></label>
      <div class="field result-field"><span id="${name}-label">結果</span>${statusSegmented(name, record.result, `data-check-result="${collection}" data-check-id="${esc(check[0])}"`)}</div>
    </div>
  </article>`;
}

function renderInstall() {
  const member = activeMember();
  if (!member) { $("#common-check-list").innerHTML = `<div class="empty-state">請先在「構件資訊」新增構件。</div>`; $("#type-check-list").innerHTML = ""; $("#install-progress").textContent = "0 / 0"; $("#install-pending").textContent = "0"; return; }
  ensureMember(member);
  $("#common-check-list").innerHTML = COMMON_CHECKS.map((check, index) => renderCheckCard(check, index, "common", member)).join("");
  const typeChecks = TYPE_CHECKS[member.type] || TYPE_CHECKS.其他;
  $("#type-check-heading").textContent = `${member.type}專用項目`;
  $("#type-check-list").innerHTML = typeChecks.map((check, index) => renderCheckCard(check, index, "type", member)).join("");
  const all = [...COMMON_CHECKS, ...typeChecks];
  const completed = all.filter(check => member.checks[check[0]]?.result && member.checks[check[0]].result !== "待確認").length;
  $("#install-progress").textContent = `${completed} / ${all.length}`;
  $("#install-pending").textContent = String(all.length - completed);
}

function renderMeasurements() {
  const member = activeMember();
  if (!member) { $("#measurement-list").innerHTML = `<div class="empty-state">請先在「構件資訊」新增構件。</div>`; return; }
  ensureMember(member);
  const ids = TYPE_MEASURES[member.type] || TYPE_MEASURES.其他;
  $("#measurement-list").innerHTML = ids.map((id, index) => {
    const [label, unit, hint] = MEASURE_LABELS[id];
    const record = member.measures[id] || { design: defaultDesign(member, id), actual: "" };
    const tolerance = toleranceFor(member, id, record.design);
    const diff = num(record.design) !== null && num(record.actual) !== null ? num(record.actual) - num(record.design) : null;
    const result = diff === null ? "待量測" : diff >= tolerance.lower && diff <= tolerance.upper ? "合格" : "不合格";
    return `<article class="measurement-card" data-measure-card="${id}"><div class="measurement-card-header"><strong>${index + 1}. ${label}</strong><span>${unit}｜${hint}</span></div><div class="measurement-grid"><label class="field"><span>設計／基準值（${unit}）</span><input type="number" step="0.1" data-measure-field="design" data-measure-id="${id}" value="${esc(record.design)}" /></label><label class="field"><span>實測值（${unit}）</span><input type="number" step="0.1" data-measure-field="actual" data-measure-id="${id}" value="${esc(record.actual)}" placeholder="輸入實測" /></label><label class="field"><span>容許差</span><input type="text" value="${esc(tolerance.label)}" readonly /></label></div><div class="measurement-result ${result === "合格" ? "is-passed" : result === "不合格" ? "is-failed" : "is-pending"}"><span>差值：${diff === null ? "—" : `${fixed(diff)} ${unit}`}</span><strong>${result}</strong></div></article>`;
  }).join("");
}

function renderRelease() {
  const all = RELEASE_CHECKS.map(([id]) => state.release.checks[id]?.result || "待確認");
  const completed = all.filter(result => result !== "待確認").length;
  $("#release-progress").textContent = `${completed} / ${RELEASE_CHECKS.length}`;
  $("#release-pending").textContent = String(RELEASE_CHECKS.length - completed);
  $("#release-check-list").innerHTML = RELEASE_CHECKS.map(([id, label, standard], index) => {
    const record = state.release.checks[id] || { actual: "", result: "待確認" };
    const name = `release-${id}-result`;
    return `<article class="check-card ${record.result === "不合格" ? "is-failed" : record.result !== "待確認" ? "is-passed" : "is-pending"}" data-release-card="${id}"><div><h4>${index + 1}. ${label}</h4><p>${standard}</p></div><label class="field"><span>紀錄／說明</span><input type="text" data-release-actual="${id}" value="${esc(record.actual)}" placeholder="填寫確認結果" /></label><div class="field result-field"><span id="${name}-label">結果</span>${statusSegmented(name, record.result, `data-release-result="${id}"`)}</div></article>`;
  }).join("");
  $$('[data-release-bind]').forEach(input => { input.value = state.release[input.dataset.releaseBind] ?? ""; });
}

function renderAll() { renderMembers(); renderInstall(); renderMeasurements(); renderRelease(); bindGeneralInputs(); syncDateDisplays(); }

function setTab(tab) {
  activeTab = tab;
  $$('[role="tab"]').forEach(button => { const selected = button.dataset.tab === tab; button.setAttribute("aria-selected", selected ? "true" : "false"); button.tabIndex = selected ? 0 : -1; });
  $$(".tab-panel").forEach(panel => { panel.hidden = panel.id !== `panel-${tab}`; });
  if (tab === "install") renderInstall();
  if (tab === "measure") renderMeasurements();
  if (tab === "release") renderRelease();
}

function setMemberField(index, key, value) {
  const member = state.members[index];
  if (!member) return;
  member[key] = value;
  if (key === "type") { member.checks = {}; member.measures = {}; ensureMember(member); }
  if ((key === "width" || key === "height" || key === "elevation") && member.measures) {
    const ids = TYPE_MEASURES[member.type] || TYPE_MEASURES.其他;
    ids.forEach(id => { if (id === "sectionWidth" || id === "sectionHeight") member.measures[id].design = defaultDesign(member, id); });
  }
}

function updateCheck(collection, id, key, value) {
  const member = activeMember();
  if (collection === "release") {
    state.release.checks[id] ||= { actual: "", result: "待確認" };
    state.release.checks[id][key] = value;
  } else if (member) {
    member.checks[id] ||= { actual: "", result: "待確認" };
    member.checks[id][key] = value;
  }
}

function exportObject() {
  return {
    schema: "project-portal.template-review.v1",
    exported_at: new Date().toISOString(),
    tool: "RC模板工程營造廠施工複核",
    overview: { ...state.overview },
    members: state.members.map(member => ({ ...member, checks: { ...member.checks }, measures: { ...member.measures } })),
    release: { ...state.release, checks: { ...state.release.checks } }
  };
}

function fileDownload(filename, content, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

function markdownExport() {
  const lines = ["# 模板工程施工複核", "", `- 工程名稱：${display(state.overview.project)}`, `- 施工廠商：${display(state.overview.contractor)}`, `- 檢查日期：${display(state.overview.inspectionDate)}`, `- 檢查樓層：${display(state.overview.floor)}`, "", "## 構件與量測"];
  state.members.forEach((member, index) => {
    lines.push(`\n### ${index + 1}. ${member.type}｜${display(member.id)}`);
    lines.push(`- 軸線／位置：${display(member.grid)}；設計尺寸：${display(member.width)} × ${display(member.height)} mm`);
    const measures = Object.entries(member.measures).map(([id, record]) => `${MEASURE_LABELS[id]?.[0] || id}：設計 ${display(record.design)}／實測 ${display(record.actual)}`).join("；");
    lines.push(`- 量測：${measures || "—"}`);
  });
  lines.push("", "## 澆置前放行", `- 判定：${state.release.decision}`, `- 備註：${display(state.release.decisionNote)}`, `- 拆模後確認：${display(state.release.postNote)}`);
  return lines.join("\n");
}

function printHeader(title, sequence) {
  const display = printText;
  const member = activeMember();
  const identity = [state.overview.floor, member?.type, member?.id].filter(Boolean).join("｜") || "未指定構件";
  return `<header class="print-document-header"><div class="print-header-title"><p>RC FORMWORK / FIELD REVIEW / ${sequence}</p><h1>${esc(title)}</h1></div><div class="print-header-meta-body"><div class="print-header-project-lines">
    <div><span>工程名稱：</span><strong>${esc(display(state.overview.project))}</strong></div>
    <div><span>施工日期：</span><strong>${esc(display(state.overview.date))}</strong></div>
    <div><span>施工廠商：</span><strong>${esc(display(state.overview.contractor))}</strong></div>
    <div><span>填表人：</span><strong>${esc(display(state.overview.reviewer))}</strong></div>
  </div></div><div class="print-header-logo-wrap"><img class="print-logo" src="./taisei.png" alt="大成建設標誌" /><strong class="print-header-identity">${esc(identity)}</strong></div></header>`;
}

function printFooter() { return `<footer class="print-footer"><div class="print-signature-grid" aria-label="簽名欄"><div><span>所長</span><span aria-hidden="true"></span></div><div><span>副所長</span><span aria-hidden="true"></span></div><div><span>擔當者</span><span aria-hidden="true"></span></div></div></footer>`; }
function printValue(value) { return esc(printText(value)); }

function renderPrint() {
  const overviewMeta = [["工程名稱", state.overview.project], ["施工廠商", state.overview.contractor], ["施工日期", state.overview.date], ["檢查日期", state.overview.inspectionDate], ["填表人", state.overview.reviewer], ["檢查樓層", state.overview.floor], ["施工區域／軸線", state.overview.area], ["施工圖／版次", state.overview.drawing], ["檢查階段", state.overview.stage]];
  $("#print-template-overview").innerHTML = `${printHeader("模板工程施工複核表", "01")}
    <section class="print-section"><h2>01｜工程概要</h2><div class="print-meta-grid three">${overviewMeta.map(([label, value]) => `<div><span>${label}</span><strong>${printValue(value)}</strong></div>`).join("")}</div></section>
    <section class="print-section"><h2>02｜構件資訊</h2><table class="print-table"><thead><tr><th>項次</th><th>類型</th><th>構件編號</th><th>軸線／位置</th><th>設計寬度<br />mm</th><th>設計高度／厚度<br />mm</th><th>設計高程<br />mm</th><th>表面類型</th></tr></thead><tbody>${state.members.map((m, i) => `<tr><td>${i + 1}</td><td>${printValue(m.type)}</td><td>${printValue(m.id)}</td><td class="text-left">${printValue(m.grid)}</td><td>${printValue(m.width)}</td><td>${printValue(m.height)}</td><td>${printValue(m.elevation)}</td><td>${printValue(m.surface)}</td></tr>`).join("")}</tbody></table></section>${printFooter()}`;

  const installRows = state.members.flatMap((member, memberIndex) => {
    ensureMember(member);
    const checks = [...COMMON_CHECKS, ...(TYPE_CHECKS[member.type] || TYPE_CHECKS.其他)];
    return checks.map((check, index) => { const record = member.checks[check[0]]; return `<tr><td>${memberIndex + 1}.${index + 1}</td><td class="text-left">${printValue(member.type)}｜${printValue(member.id)}</td><td class="text-left">${printValue(check[1])}</td><td class="text-left">${printValue(check[2])}</td><td class="text-left">${printValue(record?.actual)}</td><td>${printValue(record?.result)}</td></tr>`; });
  }).join("");
  const measureRows = state.members.flatMap((member, memberIndex) => (TYPE_MEASURES[member.type] || TYPE_MEASURES.其他).map(id => {
    const rec = member.measures[id] || { design: "", actual: "" }; const tolerance = toleranceFor(member, id, rec.design); const diff = num(rec.design) !== null && num(rec.actual) !== null ? num(rec.actual) - num(rec.design) : null; const result = diff === null ? "待量測" : diff >= tolerance.lower && diff <= tolerance.upper ? "合格" : "不合格"; return `<tr><td>${memberIndex + 1}</td><td class="text-left">${printValue(member.type)}｜${printValue(member.id)}</td><td class="text-left">${MEASURE_LABELS[id][0]}</td><td>${printValue(rec.design)}</td><td>${printValue(rec.actual)}</td><td>${diff === null ? "" : fixed(diff)}</td><td>${tolerance.label}</td><td>${result}</td></tr>`;
  })).join("");
  $("#print-template-checks").innerHTML = `${printHeader("模板安裝與尺寸複核", "03–04")}
    <section class="print-section"><h2>03｜模板安裝複核</h2><table class="print-table"><thead><tr><th>構件</th><th>類型／編號</th><th>複核項目</th><th>判定標準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${installRows || `<tr><td colspan="6">尚無構件資料</td></tr>`}</tbody></table></section>
    <section class="print-section"><h2>04｜尺寸複核</h2><table class="print-table"><thead><tr><th>構件</th><th>類型／編號</th><th>量測項目</th><th>設計／基準<br />mm</th><th>實測<br />mm</th><th>差值<br />mm</th><th>容許差</th><th>結果</th></tr></thead><tbody>${measureRows || `<tr><td colspan="8">尚無量測資料</td></tr>`}</tbody></table></section>${printFooter()}`;

  const releaseRows = RELEASE_CHECKS.map(([id, label, standard], index) => { const record = state.release.checks[id] || { actual: "", result: "待確認" }; return `<tr><td>${index + 1}</td><td class="text-left">${label}</td><td class="text-left">${standard}</td><td class="text-left">${printValue(record.actual)}</td><td>${printValue(record.result)}</td></tr>`; }).join("");
  $("#print-template-release").innerHTML = `${printHeader("澆置前放行／拆模後確認", "05")}
    <section class="print-section"><h2>澆置前放行</h2><table class="print-table"><thead><tr><th>項次</th><th>確認項目</th><th>確認基準</th><th>紀錄／說明</th><th>結果</th></tr></thead><tbody>${releaseRows}</tbody></table></section>
    <section class="print-section"><h2>放行判定</h2><div class="print-summary"><div><span>澆置判定</span><strong>${printValue(state.release.decision)}</strong></div><div><span>混凝土澆置日期</span><strong>${printValue(state.release.pourDate)}</strong></div><div><span>拆模日期</span><strong>${printValue(state.release.stripDate)}</strong></div><div><span>拆模時間條件</span><strong>${printValue(state.release.stripCondition)}</strong></div></div><div class="print-note">放行備註：${printValue(state.release.decisionNote)}\n\n再撐／回撐：${printValue(state.release.reshoring)}\n拆模後外觀及缺失：${printValue(state.release.postNote)}</div></section>${printFooter()}`;
}

function setPdfDocumentTitle(scope) {
  const member = activeMember();
  const parts = ["模板工程複核表", member?.id, scope === "all" ? "完整檢核紀錄" : TAB_LABELS[activeTab], state.overview.date || today]
    .filter(Boolean)
    .map(value => String(value).trim().replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-"));
  const previousTitle = document.title;
  document.title = parts.join("_");
  window.addEventListener("afterprint", () => { document.title = previousTitle; }, { once: true });
}

function preparePrint(scope) {
  renderPrint();
  document.body.dataset.printScope = scope;
  const page = activeTab === "overview" || activeTab === "members" ? "overview" : activeTab === "install" || activeTab === "measure" ? "checks" : "release";
  $$(".print-page").forEach(item => item.classList.toggle("print-selected", item.dataset.printPage === page));
  setPdfDocumentTitle(scope);
  paginatePrintReport();
}

function exportPdf(scope) {
  $("#export-dialog").close();
  preparePrint(scope);
  window.print();
}

function clearAll() { draft.clear(); state = createState(); activeTab = "overview"; renderAll(); setTab("overview"); $("#clear-dialog").close(); }

function loadExample() {
  const member = createMember();
  member.type = "柱"; member.id = "C1-03"; member.grid = "A-1／B-C"; member.width = "600"; member.height = "800"; member.elevation = "3200"; member.surface = "一般表面";
  ensureMember(member);
  member.checks = Object.fromEntries([...COMMON_CHECKS, ...TYPE_CHECKS.柱].map((item, index) => [item[0], { actual: index === 0 ? "1 mm" : "已確認", result: "合格" }]));
  member.measures = Object.fromEntries((TYPE_MEASURES.柱 || []).map(id => [id, { design: id === "sectionWidth" ? "600" : id === "sectionHeight" ? "800" : "0", actual: id === "sectionWidth" ? "602" : id === "sectionHeight" ? "798" : "3" }]));
  member.bars = [{ kind: "主筋", size: "D25", count: "12", spacing: "—", note: "四面配置" }];
  state = createState();
  state.overview = { project: "Example Construction Project", contractor: "Example Formwork Co.", date: today, inspectionDate: today, reviewer: "Site Engineer", floor: "3F", area: "A～C／1～3 軸", drawing: "S-203 Rev.2", stage: "模板組立完成" };
  state.members = [member]; state.activeMember = 0;
  state.release.decision = "可澆置"; state.release.pourDate = today; state.release.stripCondition = "符合最少時間"; state.release.reshoring = "已保留";
  state.release.checks = Object.fromEntries(RELEASE_CHECKS.map(item => [item[0], { actual: "已確認", result: "合格" }]));
  state.release.decisionNote = "澆置前各項條件已完成複核。"; state.release.postNote = "拆模後外觀無明顯缺失。";
}

function handleEvent(event) {
  const target = event.target;
  if (target.matches("[data-bind]")) { const [group, key] = target.dataset.bind.split("."); state[group][key] = target.value; if (key === "floor") updateIdentity(); }
  if (target.matches("[data-release-bind]")) state.release[target.dataset.releaseBind] = target.value;
  if (target.matches("[data-member-field]")) { setMemberField(Number(target.dataset.memberIndex), target.dataset.memberField, target.value); if (target.dataset.memberField === "type") { renderMembers(); renderInstall(); renderMeasurements(); } else { updateIdentity(); } }
  if (target.matches("[data-check-actual]")) { updateCheck(target.dataset.checkCollection, target.dataset.checkId, "actual", target.value); if (event.type === "change") renderInstall(); }
  if (target.matches("[data-check-result]")) { updateCheck(target.dataset.checkResult, target.dataset.checkId, "result", target.value); renderInstall(); }
  if (target.matches("[data-release-actual]")) { updateCheck("release", target.dataset.releaseActual, "actual", target.value); if (event.type === "change") renderRelease(); }
  if (target.matches("[data-release-result]")) { updateCheck("release", target.dataset.releaseResult, "result", target.value); renderRelease(); }
  if (target.matches("[data-measure-field]")) { const member = activeMember(); if (member) { member.measures[target.dataset.measureId] ||= { design: "", actual: "" }; member.measures[target.dataset.measureId][target.dataset.measureField] = target.value; if (event.type === "change") renderMeasurements(); } }
  if (target.matches("[data-tab]")) setTab(target.dataset.tab);
  if (target.matches("#active-member, #measure-member")) { state.activeMember = Number(target.value) || 0; renderInstall(); renderMeasurements(); updateIdentity(); renderMemberSelectors(); }
  if (target.matches("[data-remove-member]")) { const index = Number(target.dataset.removeMember); state.members.splice(index, 1); state.activeMember = Math.min(state.activeMember, Math.max(0, state.members.length - 1)); renderAll(); }
  if (target.matches("[data-export]")) { const option = target.dataset.export; if (option === "current-pdf") exportPdf("current"); if (option === "all-pdf") exportPdf("all"); if (option === "json") { fileDownload(`template-review-${today}.json`, JSON.stringify(exportObject(), null, 2), "application/json;charset=utf-8"); $("#export-dialog").close(); } if (option === "markdown") { fileDownload(`template-review-${today}.md`, markdownExport(), "text/markdown;charset=utf-8"); $("#export-dialog").close(); } }
  if (target.matches("[data-close-dialog]")) target.closest("dialog")?.close();
}

document.addEventListener("input", handleEvent);
document.addEventListener("change", handleEvent);
// 會改到 state 的互動都經過 input／change／click；「確認清空」那一下除外，否則剛刪掉的草稿又會被寫回。
["input", "change"].forEach(type => document.addEventListener(type, () => draft.schedule()));
document.addEventListener("click", event => { if (!event.target.closest("#confirm-clear")) draft.schedule(); });
document.addEventListener("click", event => {
  const target = event.target.closest("button, [data-remove-member], [data-export], [data-close-dialog]");
  if (!target) return;
  if (target.matches("[data-tab]")) setTab(target.dataset.tab);
  if (target.matches("[data-export]")) {
    const option = target.dataset.export;
    if (option === "current-pdf") exportPdf("current");
    if (option === "all-pdf") exportPdf("all");
    if (option === "json") { fileDownload(`template-review-${today}.json`, JSON.stringify(exportObject(), null, 2), "application/json;charset=utf-8"); $("#export-dialog").close(); }
    if (option === "markdown") { fileDownload(`template-review-${today}.md`, markdownExport(), "text/markdown;charset=utf-8"); $("#export-dialog").close(); }
  }
  if (target.matches("[data-close-dialog]")) target.closest("dialog")?.close();
  if (target.id === "add-member") { state.members.push(createMember()); state.activeMember = state.members.length - 1; renderAll(); setTab("members"); }
  if (target.id === "help-button") $("#help-dialog").showModal();
  if (target.id === "export-button") { renderPrint(); $("#export-dialog").showModal(); }
  if (target.id === "clear-button") $("#clear-dialog").showModal();
  if (target.id === "confirm-clear") clearAll();
});

const query = new URLSearchParams(location.search);
Object.assign(state, draft.load() ?? {});
if (query.get("example") === "1") loadExample();
renderAll();
setTab(TAB_LABELS[query.get("tab")] ? query.get("tab") : "overview");

