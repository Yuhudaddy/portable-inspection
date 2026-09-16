const APP_VERSION = "1.4";

const TAB_LABELS = {
  overview: "工程概要",
  wall: "壁體資訊",
  quality: "品質自檢",
  excavation: "開挖紀錄",
  prework: "前置紀錄",
  pouring: "澆置紀錄"
};

const TOOL_LABELS = {
  diaphragmWall: "連續壁施工紀錄",
  guideWall: "導溝施工複核",
  rebarCage: "鋼筋籠吊放前複核"
};

const PRINT_TAB_GROUPS = {
  overview: "overview-wall",
  wall: "overview-wall",
  quality: "quality",
  excavation: "excavation-prework",
  prework: "excavation-prework",
  pouring: "pouring",
  guideWall: "guideWall",
  rebarCage: "rebarCage"
};

const GUIDE_WALL_CHECKS = [
  ["放樣與單元中心線", "放樣點位、單元順序與核定圖說相符；應留存測量實測值"],
  ["地下管線位置確認", "依竣工圖、探測或試掘結果確認，導溝位置不得與既有管線衝突"],
  ["導溝寬度／淨寬", "實測導溝內面淨寬符合設計壁厚及核定加寬值"],
  ["導溝深度與底高程", "導溝深度至少 1.8 m，且深入原土層 30 cm 以上；底高程及測量基準符合核定施工圖"],
  ["導溝牆壁厚度", "導溝牆厚、斷面及結構尺寸符合核定圖說"],
  ["導溝鋼筋號數與間距", "鋼筋號數、支數／間距與核定配筋圖一致；於下方欄位填寫實測或圖說值"],
  ["回撐木配置與間距", "回撐木間距 @200 cm（如核定支撐計畫另有規定，依核定計畫），固定牢靠且可防止導溝變形"],
  ["導溝混凝土強度", "混凝土強度符合設計要求，並可追溯出廠或試驗紀錄"],
  ["導溝垂直與壁面完整性", "導溝壁面垂直度 1/300，且無鬆動、剝落、裂縫；底部無堆積物"],
  ["單元界面與接頭區", "界面位置、接頭區淨空可供後續施工"],
  ["開挖坡面與鄰產保護", "開挖坡面應維持臨時穩定；鄰產及地下管線位置已確認，並採必要保護措施"],
  ["成槽前放行條件", "測量複核、現場條件及廠商自檢紀錄齊備"]
];
const GUIDE_REBAR_SIZES = ["D10", "D13", "D16", "D19", "D22", "D25", "D29", "D32", "D35", "D38", "D41", "D51"];
const createGuideWallCheck = ([item, standard]) => ({ item, standard, actual: "", barNo: "", barSpacing: "", result: "待確認" });

function guideRebarSizeOptions(selected) {
  return [`<option value="">請選擇</option>`, ...GUIDE_REBAR_SIZES.map(value => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(value)}</option>`)].join("");
}

const REBAR_CAGE_PARTS = [
  "A 面縱向主筋", "B 面縱向主筋", "A 面水平分布筋", "B 面水平分布筋",
  "垂直補強筋", "桁架筋／剛性補強", "吊筋／吊環", "接頭區補強筋", "保護層定位筋／墊塊"
];

const REBAR_CAGE_CHECKS = [
  ["籠號與單元對應", "籠號、單元號與核定配筋圖一致"],
  ["籠體幾何尺寸", "長度、寬度、厚度與圖說相符"],
  ["接頭、搭接與焊接", "位置、長度與施工規範相符"],
  ["保護層墊塊與固定", "位置、數量及固定方式可確保保護層"],
  ["吊點、吊具及臨時補強", "吊點、吊筋、桁架及補強可安全吊放"],
  ["接頭構件／預埋件", "止水、接頭鋼板及預埋件位置依圖說"],
  ["外觀與吊放前狀態", "無顯著變形、鬆脫、污染或妨礙吊放之雜物"]
];

const QUALITY_CHECKS = [
  ["連續壁單元位置、刀法順序確認", "單元位置、順序與核定圖說相符", "例如：位置及順序符合"],
  ["底部沉渣及泥屑清除確認", "底部沉泥小於 20 cm", "例如：沉泥 12 cm"],
  ["端板接頭清洗（公及公母單元時）", "以大小鋼刷確實清洗", "填寫清洗狀況"],
  ["穩定液新鮮液之貯存量是否充裕", "依照施工計畫", "填寫液量或確認說明"],
  ["槽溝穩定液面高度控制", "鋪面下 50 cm～100 cm 以內", "例如：鋪面下 70 cm"],
  ["廢土清運是否正常", "不致影響挖掘進度", "填寫異常說明"],
  ["施工動線及運土車輛之安排", "不致延遲澆置時間", "填寫異常說明"],
  ["壁體坍塌處是否需作補強", "若需補強，說明方式", "填寫補強方式或無需補強"],
  ["帆布是否破損（母單元時）", "單元起吊前及下放時檢查", "填寫檢查狀況"],
  ["開挖深度與特密管長度之配合", "管底與槽溝底部距離 ≤30 cm", "填寫距離"],
  ["特密管之檢查（變形、破裂、堵塞、水密性）", "下放前及過程中目視檢查", "填寫檢查狀況"],
  ["特密管插入位置、深度、組合記錄", "位置符合圖面；長度配合挖掘深度", "填寫左／中／右位置與管長"],
  ["放置橡皮碗", "澆置前放置於漏斗內", "填寫是／否"],
  ["穩定液回收池容積是否足夠", "同時間無挖掘，容積大於回收量", "填寫是／否或容積"],
  ["混凝土坍度之確認", "依本公司標準值確認坍度及允許誤差", "例如：實測 18 cm"],
  ["混凝土是否合乎設計強度", "記錄空打段、實打段 GL 與強度", "填寫 GL／psi"],
  ["特密管埋入混凝土內之確認", "依單元類型套用本公司標準值", "填寫埋入深度"],
  ["超音波記錄結果說明", "依單元型式及圖說完成檢測記錄", "填寫位置與垂直精度"]
];

// 這些是營造廠在現場要快速確認的「本公司標準值」。
// 介面不顯示外部規範名稱；預設值可直接作為公司內部起始值，
// 並保留下拉選單，讓公司日後能依核定施工計畫調整。
const QUALITY_STANDARD_CONFIG = [
  { key: "slump", label: "混凝土坍度", unit: "cm", options: Array.from({ length: 10 }, (_, i) => String(15 + i)), default: "18" },
  { key: "slumpTolerance", label: "坍度允許誤差", unit: "cm", options: ["0", "1", "2", "3", "4", "5"], default: "2" },
  { key: "sediment", label: "沉泥厚度上限", unit: "cm", options: ["5", "10", "15", "20", "25"], default: "10" },
  { key: "sandContent", label: "含砂量上限", unit: "%", options: ["0.5", "1", "1.5", "2"], default: "1" },
  { key: "settlingTime", label: "靜置時間下限", unit: "hr", options: ["0.5", "1", "1.5", "2"], default: "0.5" },
  { key: "verticalDenominator", label: "垂直精度（10／D）", unit: "1/n", options: ["100", "200", "300", "400", "500", "10/D"], default: "300" },
  { key: "tremieClearance", label: "特密管端距上限", unit: "cm", options: ["20", "30", "40", "50"], default: "20" },
  { key: "embedmentMale", label: "公單元埋入深度下限", unit: "m", options: ["0.5", "1.0", "1.5", "2.0"], default: "1.5" },
  { key: "embedmentFemale", label: "母單元埋入深度下限", unit: "m", options: ["0.5", "1.0", "1.5", "2.0"], default: "1.5" },
  { key: "embedmentBoth", label: "公母單元埋入深度下限", unit: "m", options: ["0.5", "1.0", "1.5", "2.0"], default: "1.5" },
  { key: "pourInterruption", label: "澆置中斷時間上限", unit: "min", options: ["30", "45", "60"], default: "30" },
  { key: "pourCompletion", label: "澆置完成時間上限", unit: "min", options: ["60", "90", "120"], default: "90" },
  { key: "chloride", label: "氯離子含量上限", unit: "kg/m³", options: ["0.15", "0.30"], default: "0.15" },
  { key: "centerlineTolerance", label: "導溝中心線偏差上限", unit: "cm", options: ["1", "2", "3", "5"], default: "2" },
  { key: "wallThicknessTolerance", label: "壁厚偏差上限", unit: "cm", options: ["3", "5", "7.5", "10"], default: "5" },
  { key: "cageLongitudinalTolerance", label: "鋼筋籠縱向偏差上限", unit: "cm", options: ["±5", "±7.5", "±10"], default: "±7.5" },
  { key: "cageTopTolerance", label: "鋼筋籠頂高程偏差上限", unit: "cm", options: ["±3", "±5", "±7.5", "±10"], default: "±5" },
  { key: "cover", label: "保護層厚度下限", unit: "cm", options: ["5", "7.5", "10", "12.5"], default: "7.5" },
  { key: "volumeDifference", label: "實際／設計數量差異上限", unit: "%", options: ["5", "10", "15", "20"], default: "10" }
];

const QUALITY_STANDARD_DEFAULTS = Object.fromEntries(QUALITY_STANDARD_CONFIG.map(item => [item.key, item.default]));

function verticalPrecisionFromDepth(depthValue) {
  const depth = Number.parseFloat(depthValue);
  if (!Number.isFinite(depth) || depth === 0) return null;
  const depthCm = Math.abs(depth) * 100;
  return { depthCm, ratio: 10 / depthCm, denominator: depthCm / 10 };
}

function verticalPrecision() {
  return verticalPrecisionFromDepth(state.wall.designDepth);
}

function selectedVerticalPrecision() {
  return state.quality.standards.verticalDenominator === "10/D" ? verticalPrecision() : null;
}

function qualityStandardValue(key) {
  if (key === "verticalDenominator") {
    const selected = state.quality.standards.verticalDenominator || "";
    const precision = selectedVerticalPrecision();
    return precision ? precision.denominator.toFixed(1) : selected;
  }
  return state.quality.standards[key] ?? "";
}

function qualityStandardOptions(selected, options) {
  return options.map(value => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(value)}</option>`).join("");
}

function qualityStandardText(key) {
  if (key === "verticalDenominator") {
    const selected = state.quality.standards.verticalDenominator || "—";
    if (selected !== "10/D") return `垂直壁體偏差 ≤ 1/${selected}`;
    const precision = selectedVerticalPrecision();
    if (!precision) return "垂直精度 ≤ 10 / D（D 為連續壁深度，單位 cm）";
    return `垂直精度 ≤ 10 / ${precision.depthCm.toFixed(0)} = ${precision.ratio.toFixed(5)}（約 1/${precision.denominator.toFixed(1)}）`;
  }
  const value = state.quality.standards[key] || "—";
  const format = {
    slump: `坍度 ${value} cm`,
    slumpTolerance: `允許誤差 ${value} cm`,
    sediment: `沉泥厚度 ≤ ${value} cm`,
    sandContent: `含砂量 ≤ ${value}%`,
    settlingTime: `靜置時間 ≥ ${value} hr`,
    verticalDenominator: `垂直壁體偏差 ≤ 1/${value}`,
    tremieClearance: `特密管端距 ≤ ${value} cm`,
    pourInterruption: `澆置中斷 ≤ ${value} min`,
    pourCompletion: `澆置完成 ≤ ${value} min`,
    chloride: `氯離子含量 ≤ ${value} kg/m³`,
    centerlineTolerance: `中心線偏差 ≤ ${value} cm`,
    wallThicknessTolerance: `壁厚偏差 ≤ ${value} cm`,
    cageLongitudinalTolerance: `縱向偏差 ${value} cm`,
    cageTopTolerance: `頂高程偏差 ${value} cm`,
    cover: `保護層厚度 ≥ ${value} cm`,
    volumeDifference: `實際／設計數量差異 ≤ ${value}%`
  };
  return format[key] || `${value}`;
}

function qualityCheckStandard(index, fallback) {
  const dynamic = {
    0: qualityStandardText("centerlineTolerance"),
    1: qualityStandardText("sediment"),
    9: qualityStandardText("tremieClearance"),
    14: `${qualityStandardText("slump")}；${qualityStandardText("slumpTolerance")}`,
    16: state.wall.unitType ? `${state.wall.unitType}：${qualityStandardText(state.wall.unitType === "公單元" ? "embedmentMale" : state.wall.unitType === "母單元" ? "embedmentFemale" : "embedmentBoth")}` : "請先選擇單元類型，再填寫埋入深度"
  };
  return dynamic[index] || fallback;
}

const PHASES = [
  { id: "slurry", label: "清沉泥", start: "開始時間", end: "完成時間" },
  { id: "lowerCage", label: "下方鋼筋籠吊放", start: "開始時間", end: "完成時間" },
  { id: "upperCage", label: "上方鋼筋籠吊放", start: "開始時間" },
  { id: "splice", label: "鋼筋籠續接", start: "開始時間", end: "完成時間" },
  { id: "cageComplete", label: "鋼筋籠吊放完成", end: "完成時間" },
  { id: "tremie", label: "特密管施工", start: "開始時間", end: "完成時間" }
];

const localDate = new Date();
const today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;

const state = {
  overview: { project: "", contractor: "", date: today, reviewer: "" },
  wall: {
    unitType: "",
    unitNo: "",
    sequenceNo: "",
    designDepth: "",
    strength: "",
    thickness: "",
    length: "",
    topElevation: "",
    designVolume: "",
    actualVolume: ""
  },
  soil: [],
  depth: [],
  prework: Object.fromEntries(PHASES.map(phase => [phase.id, { start: "", end: "" }])),
  trucks: [],
  // 工程名稱／施工廠商由 overview 統一持有，導溝與鋼筋籠共用；複核人（營造廠）與填表人（廠商）是不同人，各自保留。
  guideWall: {
    date: today, unitNo: "", reviewer: "", note: "",
    checks: GUIDE_WALL_CHECKS.map(createGuideWallCheck)
  },
  rebarCage: {
    date: today, unitNo: "", cageNo: "", reviewer: "", note: "",
    rebars: REBAR_CAGE_PARTS.map(part => ({ part, designNo: "", designQty: "", actualNo: "", actualQty: "", result: "待確認" })),
    checks: REBAR_CAGE_CHECKS.map(([item, standard]) => ({ item, standard, actual: "", result: "待確認" }))
  },
  quality: {
    note: "",
    standards: { ...QUALITY_STANDARD_DEFAULTS },
    checks: QUALITY_CHECKS.map(([item, standard, placeholder]) => ({ item, standard, placeholder, actual: "", result: "待確認" }))
  }
};

// 本機草稿（共用 draft.js）：啟動時還原、輸入時去抖寫入、「清空」時刪除。
const exampleMode = new URLSearchParams(location.search).get("example") === "1";
const draft = createDraftStore("project-portal.diaphragmWall.draft", () => state, { enabled: !exampleMode });

let activeTab = "overview";
let activeTool = "diaphragmWall";
const editIndex = { soil: null, depth: null, truck: null, rebar: null };
let undoTimer;
let undoAction = null;

const $ = selector => document.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const number = value => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const fixed = value => Number.isFinite(value) ? value.toFixed(2) : "";
const display = value => String(value ?? "").trim() || "—";
const printText = value => String(value ?? "").trim(); // PDF 用：未填就留白，不印「—」
const guideCheckActual = check => [display(check.actual) === "—" ? "" : display(check.actual), check.barNo ? `號數 ${check.barNo}` : "", check.barSpacing ? `間距 ${check.barSpacing} cm` : ""].filter(Boolean).join("；") || "";
const esc = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const formatDateDisplay = value => {
  const [y, m, d] = String(value ?? "").split("-");
  return y && m && d ? `${y}/${m}/${d}` : "";
};

function syncDateTimeDisplay(input) {
  const wrap = input.closest(".native-field-wrap");
  const display = wrap ? wrap.querySelector(".native-field-display") : null;
  if (!display) return;
  const value = input.value;
  display.classList.toggle("is-empty", !value);
  display.textContent = value
    ? (input.type === "date" ? formatDateDisplay(value) : value)
    : (input.type === "date" ? "尚未選擇日期" : "尚未選擇時間");
}

function syncAllDateTimeDisplays() {
  $$('input[type="date"], input[type="time"]').forEach(syncDateTimeDisplay);
}

function designHeight() {
  const depth = number(state.wall.designDepth);
  const elevation = number(state.wall.topElevation);
  if (depth === null || elevation === null) return null;
  // Accept both a positive downward depth (e.g. 35.8) and a signed GL level (e.g. -39.5).
  return Math.max(0, depth < 0 ? elevation - depth : depth + elevation);
}

function calculatedDesignVolume() {
  const height = designHeight();
  const thickness = number(state.wall.thickness);
  const length = number(state.wall.length);
  if (height === null || thickness === null || length === null) return null;
  return height * thickness * length;
}

function calculatedTrucks() {
  const designVolume = number(state.wall.designVolume);
  const height = designHeight();
  let cumulative = 0;
  return state.trucks.map((truck, index) => {
    const volume = number(truck.volume) ?? 0;
    const measured = number(truck.measured);
    cumulative += volume;
    const expected = designVolume && height !== null ? height * cumulative / designVolume : null;
    const difference = measured !== null && expected !== null ? measured - expected : null;
    return { ...truck, index, volume, cumulative, measured, expected, difference };
  });
}

function setInitialInputs() {
  $$('[data-bind]').forEach(input => {
    const [group, key] = input.dataset.bind.split(".");
    if (input.type === "radio") input.checked = state[group][key] === input.value;
    else input.value = state[group][key] ?? "";
  });
}

function updateIdentity() {
  if (activeTool === "guideWall") {
    $("#record-identity").textContent = state.guideWall.unitNo ? `導溝｜${state.guideWall.unitNo}` : "導溝施工複核";
    return;
  }
  if (activeTool === "rebarCage") {
    $("#record-identity").textContent = state.rebarCage.cageNo || state.rebarCage.unitNo ? [state.rebarCage.unitNo, state.rebarCage.cageNo].filter(Boolean).join("｜") : "鋼筋籠吊放前複核";
    return;
  }
  const parts = [state.wall.unitType, state.wall.unitNo].filter(Boolean);
  $("#record-identity").textContent = parts.length ? parts.join("｜") : "尚未指定單元";
}

function updateWallCalculation() {
  const height = designHeight();
  const volume = calculatedDesignVolume();
  state.wall.designVolume = volume === null ? "" : volume.toFixed(2);
  const volumeInput = $('[data-bind="wall.designVolume"]');
  if (volumeInput) volumeInput.value = state.wall.designVolume;
  const heightInput = $("#design-height-value");
  if (heightInput) heightInput.value = height === null ? "" : height.toFixed(2);
  updateIdentity();
  renderQualityStandards();
  renderExcavation();
  renderPouring();
}

function currentExportLabel(tool = activeTool, tab = activeTab) {
  if (tool === "diaphragmWall") {
    if (PRINT_TAB_GROUPS[tab] === "overview-wall") return "品質自檢（含壁體資訊）";
    if (PRINT_TAB_GROUPS[tab] === "quality") return "品質自檢";
    if (PRINT_TAB_GROUPS[tab] === "excavation-prework") return "開挖紀錄＋前置紀錄";
    return TAB_LABELS[tab];
  }
  return TOOL_LABELS[tool];
}

// 分頁只在自己所屬的工具區塊（[data-tool-view]）內切換；diaphragmWall 以外的工具（鋼筋籠）也有自己的分頁列。
function showTab(tab, focusPanel = false) {
  const view = $(`[role="tab"][data-tab="${tab}"]`)?.closest("[data-tool-view]");
  if (!view) return;
  $$(".tab-panel", view).forEach(panel => { panel.hidden = panel.id !== `panel-${tab}`; });
  $$('[role="tab"]', view).forEach(button => {
    const selected = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  if (view.dataset.toolView === "diaphragmWall") activeTab = tab; // 匯出標籤在開啟匯出對話框時才重算
  if (focusPanel) $(`#panel-${tab}`).focus({ preventScroll: true });
}

function showTool(tool) {
  if (!TOOL_LABELS[tool]) return;
  activeTool = tool;
  $$('[data-tool-view]').forEach(view => { view.hidden = view.dataset.toolView !== tool; });
  $$('[data-select-tool]').forEach(button => {
    if (button.dataset.selectTool === tool) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  updateIdentity();
}

function emptyState(text) {
  return `<p class="empty-state">${esc(text)}</p>`;
}

function renderExcavation() {
  const latest = state.depth.at(-1);
  const latestValue = latest ? number(latest.value) : null;
  const designDepthValue = number(state.wall.designDepth);
  const difference = latestValue !== null && designDepthValue !== null ? latestValue - designDepthValue : null;

  $("#soil-count").innerHTML = `${state.soil.length} <small>次</small>`;
  $("#depth-count").innerHTML = `${state.depth.length} <small>次</small>`;
  $("#latest-depth").innerHTML = `${fixed(latestValue)} <small>m</small>`;
  $("#depth-difference").innerHTML = `${fixed(difference)} <small>m</small>`;
  $("#depth-difference-cell").classList.toggle("is-warning", difference !== null && difference < 0);

  $("#soil-list").innerHTML = state.soil.length ? state.soil.map((record, index) => `
    <article class="record-item">
      <div class="record-item-main">
        <div class="record-item-title"><strong>第 ${index + 1} 次出土</strong><span>${esc(record.time)}</span></div>
      </div>
      <div class="record-item-actions">
        <button type="button" data-edit-soil="${index}">修改</button>
        <button type="button" data-delete-soil="${index}">刪除</button>
      </div>
    </article>`).join("") : emptyState("尚無出土紀錄，請按＋新增。");

  $("#depth-list").innerHTML = state.depth.length ? state.depth.map((record, index) => {
    const value = number(record.value);
    const diff = value !== null && designDepthValue !== null ? value - designDepthValue : null;
    return `
      <article class="record-item">
        <div class="record-item-main">
          <div class="record-item-title"><strong>深度 ${fixed(value)} m</strong><span>${esc(record.time)}</span></div>
          <div class="record-item-meta"><span>第 ${index + 1} 次確認</span><span class="${diff !== null && diff < 0 ? "warning-text" : ""}">與設計差異 ${fixed(diff)} m</span></div>
        </div>
        <div class="record-item-actions">
          <button type="button" data-edit-depth="${index}">修改</button>
          <button type="button" data-delete-depth="${index}">刪除</button>
        </div>
      </article>`;
  }).join("") : emptyState("尚無深度確認，請按＋新增。");
}

function phaseTimeText(phase) {
  const record = state.prework[phase.id];
  const values = [];
  if (phase.start) values.push(`開始 ${record.start || "—"}`);
  if (phase.end) values.push(`完成 ${record.end || "—"}`);
  return values.join(" ／ ");
}

function renderPhaseEditor() {
  const phase = PHASES.find(item => item.id === $("#phase-select").value) || PHASES[0];
  const record = state.prework[phase.id];
  const fields = [];
  if (phase.start) fields.push(`<label class="field"><span>${esc(phase.start)}</span><span class="native-field-wrap"><input type="time" data-phase-input="start" value="${esc(record.start)}" /><span class="native-field-display" aria-hidden="true"></span></span></label>`);
  if (phase.end) fields.push(`<label class="field"><span>${esc(phase.end)}</span><span class="native-field-wrap"><input type="time" data-phase-input="end" value="${esc(record.end)}" /><span class="native-field-display" aria-hidden="true"></span></span></label>`);
  $("#phase-time-fields").innerHTML = fields.join("");
  syncAllDateTimeDisplays();
}

function renderPrework() {
  $("#phase-summary").innerHTML = PHASES.map(phase => {
    const record = state.prework[phase.id];
    const complete = (!phase.start || record.start) && (!phase.end || record.end);
    return `<div class="phase-row"><strong>${esc(phase.label)}</strong><span class="${complete ? "" : "pending"}">${esc(phaseTimeText(phase))}</span></div>`;
  }).join("");
}

function renderPouring() {
  const rows = calculatedTrucks();
  const last = rows.at(-1);
  $("#truck-count").innerHTML = `${rows.length} <small>車</small>`;
  $("#pour-volume").innerHTML = `${fixed(last?.cumulative ?? 0)} <small>m³</small>`;
  $("#pour-expected").innerHTML = `${fixed(last?.expected ?? null)} <small>m</small>`;
  $("#pour-measured").innerHTML = `${fixed(last?.measured ?? null)} <small>m</small>`;
  $("#pour-difference").innerHTML = `${fixed(last?.difference ?? null)} <small>m</small>`;
  $("#pour-difference-cell").classList.toggle("is-warning", Boolean(last && last.difference !== null && last.difference < -0.3));

  $("#truck-list").innerHTML = rows.length ? rows.map(row => `
    <article class="record-item">
      <div class="record-item-main">
        <div class="record-item-title"><strong>第 ${row.index + 1} 車｜${esc(row.truckNo)}</strong><span>${esc(row.unload)}–${esc(row.finish)}</span></div>
        <div class="record-item-meta">
          <span>本車 ${fixed(row.volume)} m³</span>
          <span>累積 ${fixed(row.cumulative)} m³</span>
          <span>預估 ${fixed(row.expected)} m</span>
          <span>實測 ${fixed(row.measured)} m</span>
          <span class="${row.difference !== null && row.difference < -0.3 ? "warning-text" : ""}">差異 ${fixed(row.difference)} m</span>
        </div>
      </div>
      <div class="record-item-actions">
        <button type="button" data-edit-truck="${row.index}">修改</button>
        <button type="button" data-delete-truck="${row.index}">刪除</button>
      </div>
    </article>`).join("") : emptyState("尚無澆置車次，請按＋新增車次。");

  const warnings = rows.filter(row => row.difference !== null && row.difference < -0.3);
  $("#pour-warnings").innerHTML = warnings.map(row => `<div class="warning-item"><strong>第 ${row.index + 1} 車差異 ${fixed(row.difference)} m：</strong>請確認量測基準、實際方量、超挖或坍孔可能性。</div>`).join("");
}

// 三段式結果膠囊：以隱藏 radio + 相鄰 span 呈現（沿用既有 .unit-type 手法）。
// 未勾選任一段＝原本下拉選單的「待確認」狀態；點選其一會如同 <select> 觸發 change，
// 既有的委派事件（依 data-* 屬性讀取 event.target.value）不需更動。
const SEGMENT_ICONS = {
  "符合": `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>`,
  "不符合": `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  "不適用": "N/A"
};

function resultSegmented(name, selected, attrs) {
  return `<div class="glass-segmented" role="radiogroup" aria-labelledby="${name}-label">${["符合", "不符合", "不適用"]
    .map(value => {
      const stateClass = value === "符合" ? "is-pass" : value === "不符合" ? "is-fail" : "is-na";
      return `<label><input type="radio" name="${name}" value="${value}" aria-label="${value}" ${value === selected ? "checked" : ""} ${attrs} /><span class="${stateClass}">${SEGMENT_ICONS[value]}</span></label>`;
    })
    .join("")}</div>`;
}

function renderCheckCards(type) {
  const domPrefix = { quality: "quality", guideWall: "guide-wall", rebarCage: "rebar-cage" }[type] || type;
  const target = $(`#${domPrefix}-check-list`);
  target.innerHTML = state[type].checks.map((check, index) => `
    <article class="check-card ${check.result === "不符合" ? "is-failed" : ""}">
      <div class="check-card-head"><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(check.item)}</strong></div>
      <p>${esc(type === "quality" ? qualityCheckStandard(index, check.standard) : check.standard)}</p>
      <div class="check-card-fields">
        <label class="field"><span>現場紀錄／實測</span><input type="text" value="${esc(check.actual)}" data-check-item="${type}" data-check-index="${index}" data-check-field="actual" /></label>
        <div class="field result-field"><span id="check-${type}-${index}-result-label">複核結果</span>${resultSegmented(`check-${type}-${index}-result`, check.result, `data-check-item="${type}" data-check-index="${index}" data-check-field="result"`)}</div>
      </div>
      ${type === "guideWall" && check.item.includes("鋼筋") ? `<div class="guide-rebar-fields">
        <label class="field"><span>鋼筋號數</span><select data-check-item="${type}" data-check-index="${index}" data-check-field="barNo">${guideRebarSizeOptions(check.barNo)}</select></label>
        <label class="field"><span>間距（cm）</span><input type="number" min="0" step="0.5" inputmode="decimal" placeholder="例如：20" value="${esc(check.barSpacing)}" data-check-item="${type}" data-check-index="${index}" data-check-field="barSpacing" /></label>
      </div>` : ""}
    </article>`).join("");
  const completed = state[type].checks.filter(check => check.result !== "待確認").length;
  if (type === "guideWall") {
    $("#guide-wall-progress").textContent = `${completed} / ${state.guideWall.checks.length}`;
    $("#guide-wall-pending").textContent = String(state.guideWall.checks.length - completed);
  } else {
    $("#rebar-cage-check-progress").textContent = `${completed} / ${state.rebarCage.checks.length}`;
  }
}

function renderRebars() {
  const rows = state.rebarCage.rebars;
  $("#rebar-cage-rebar-list").innerHTML = rows.length ? rows.map((rebar, index) => `
    <article class="rebar-card ${rebar.result === "不符合" ? "is-failed" : rebar.result === "符合" ? "is-passed" : ""}">
      <div class="rebar-card-main">
        <div class="rebar-card-title"><strong>${esc(rebar.part)}</strong><em>${esc(rebar.result)}</em></div>
        <dl>
          <div><dt>設計</dt><dd>${esc([rebar.designNo, rebar.designQty].filter(Boolean).join("／") || "尚未填寫")}</dd></div>
          <div><dt>實際</dt><dd>${esc([rebar.actualNo, rebar.actualQty].filter(Boolean).join("／") || "尚未填寫")}</dd></div>
        </dl>
      </div>
      <div class="record-item-actions"><button type="button" data-edit-rebar="${index}">填寫</button><button type="button" data-delete-rebar="${index}">刪除</button></div>
    </article>`).join("") : emptyState("尚無配筋項目，請按＋新增。 ");
  const completed = rows.filter(rebar => rebar.result !== "待確認").length;
  $("#rebar-cage-rebar-progress").textContent = `${completed} / ${rows.length}`;
}

function setChecklistInputs() {
  $$('[data-check-bind]').forEach(input => {
    const [type, key] = input.dataset.checkBind.split(".");
    input.value = state[type][key] ?? "";
  });
}

function setQualityInputs() {
  $$('[data-quality-bind]').forEach(input => {
    input.value = state.quality[input.dataset.qualityBind] ?? "";
  });
}

function renderQualityStandards() {
  const unitType = state.wall.unitType;
  const selectedEmbedmentKey = unitType === "公單元" ? "embedmentMale" : unitType === "母單元" ? "embedmentFemale" : unitType === "公母單元" ? "embedmentBoth" : null;
  const rows = QUALITY_STANDARD_CONFIG.map(config => {
    const disabled = config.key.startsWith("embedment") && selectedEmbedmentKey && config.key !== selectedEmbedmentKey;
    return `<label class="quality-standard-field ${disabled ? "is-disabled" : ""}">
      <span>${esc(config.label)}（${esc(config.unit)}）</span>
      <select data-quality-standard="${esc(config.key)}" ${disabled ? "disabled" : ""}>${qualityStandardOptions(state.quality.standards[config.key], config.options)}</select>
    </label>`;
  });
  $("#quality-standard-list").innerHTML = rows.join("");
  $("#quality-standard-note").textContent = selectedEmbedmentKey
    ? `目前單元類型：${unitType}；僅輸出此單元類型的特密管埋入深度。`
    : "請先在「壁體資訊」選擇單元類型；未選擇前三種埋入深度均可調整。";
}

function renderQuality() {
  setQualityInputs();
  renderQualityStandards();
  $("#quality-check-list").innerHTML = state.quality.checks.map((check, index) => `
    <article class="quality-card ${check.result === "不符合" ? "is-failed" : ""}">
      <div class="quality-card-head"><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(check.item)}</strong></div>
      <p>${esc(check.standard)}</p>
      <div class="quality-card-fields">
        <label class="field"><span>現場紀錄／實測</span><input type="text" value="${esc(check.actual)}" placeholder="${esc(check.placeholder)}" data-quality-item="${index}" data-quality-field="actual" /></label>
        <div class="field result-field"><span id="quality-${index}-result-label">檢查結果</span>${resultSegmented(`quality-${index}-result`, check.result, `data-quality-item="${index}" data-quality-field="result"`)}</div>
      </div>
    </article>`).join("");
  const completed = state.quality.checks.filter(check => check.result !== "待確認").length;
  $("#quality-progress").textContent = `${completed} / ${state.quality.checks.length}`;
  $("#quality-pending").textContent = String(state.quality.checks.length - completed);
}

function renderChecklists() {
  setChecklistInputs();
  renderCheckCards("guideWall");
  renderCheckCards("rebarCage");
  renderRebars();
  renderQuality();
}

function renderAll() {
  updateIdentity();
  updateWallCalculation();
  renderPrework();
  renderChecklists();
}

function loadExample() {
  state.overview = { project: "Example Construction Project — North Lot", contractor: "○○營造股份有限公司", date: "2026-08-11", reviewer: "Site Engineer" };
  Object.assign(state.wall, { unitType: "公單元", unitNo: "21", sequenceNo: "03", designDepth: "-35.80", strength: "350", thickness: "1.00", length: "2.80", topElevation: "-0.50", designVolume: "98.84", actualVolume: "107.46" });
  state.soil = ["07:40", "08:20", "09:05"].map(time => ({ time }));
  state.depth = [{ time: "12:10", value: "-35.80" }, { time: "12:35", value: "-35.82" }];
  state.prework = Object.fromEntries(PHASES.map((phase, index) => [phase.id, { start: `0${8 + index}:00`, end: `0${8 + index}:30` }]));
  state.trucks = Array.from({ length: 8 }, (_, index) => ({ truckNo: `C${String(index + 1).padStart(2, "0")}`, unload: `${13 + Math.floor(index / 2)}:${index % 2 ? "42" : "20"}`, finish: `${13 + Math.floor(index / 2)}:${index % 2 ? "55" : "33"}`, volume: index === 7 ? "9.46" : "12", measured: (3.9 + index * 4.1).toFixed(2) }));
  state.guideWall = { date: "2026-08-10", unitNo: "21", reviewer: "Site Engineer", note: "中心線偏差 1.6 cm；順序符合；導溝條件完成複核。", checks: GUIDE_WALL_CHECKS.map(([item, standard], index) => ({ item, standard, actual: index === 0 ? "中心線偏差 1.6 cm" : "已確認", barNo: index === 5 ? "D16" : "", barSpacing: index === 5 ? "19.5" : "", result: "符合" })) };
  state.rebarCage = { date: "2026-08-10", unitNo: "21", cageNo: "C21-U／C21-L", reviewer: "Site Engineer", note: "配筋圖逐項核對；吊放條件完成。", rebars: REBAR_CAGE_PARTS.map((part, index) => ({ part, designNo: index < 2 ? "D32" : "D16", designQty: index < 2 ? "32支" : "@20 cm", actualNo: index < 2 ? "D32" : "D16", actualQty: index < 2 ? "32支" : "@20 cm", result: "符合" })), checks: REBAR_CAGE_CHECKS.map(([item, standard], index) => ({ item, standard, actual: index === 7 ? "3 組成對安裝；線路已保護至孔口" : "已確認", result: "符合" })) };
  state.quality = { note: "各項檢查完成，未發現影響施工之缺失。", standards: { ...QUALITY_STANDARD_DEFAULTS }, checks: QUALITY_CHECKS.map(([item, standard, placeholder]) => ({ item, standard, placeholder, actual: "已確認", result: "符合" })) };
}

function clearAllData() {
  draft.clear();
  state.overview = { project: "", contractor: "", date: "", reviewer: "" };
  state.wall = {
    unitType: "", unitNo: "", sequenceNo: "", designDepth: "", strength: "", thickness: "", length: "",
    topElevation: "", designVolume: "", actualVolume: ""
  };
  state.soil = [];
  state.depth = [];
  state.prework = Object.fromEntries(PHASES.map(phase => [phase.id, { start: "", end: "" }]));
  state.trucks = [];
  state.guideWall = {
    date: "", unitNo: "", reviewer: "", note: "",
    checks: GUIDE_WALL_CHECKS.map(createGuideWallCheck)
  };
  state.rebarCage = {
    date: "", unitNo: "", cageNo: "", reviewer: "", note: "",
    rebars: REBAR_CAGE_PARTS.map(part => ({ part, designNo: "", designQty: "", actualNo: "", actualQty: "", result: "待確認" })),
    checks: REBAR_CAGE_CHECKS.map(([item, standard]) => ({ item, standard, actual: "", result: "待確認" }))
  };
  state.quality = {
    note: "",
    standards: { ...QUALITY_STANDARD_DEFAULTS },
    checks: QUALITY_CHECKS.map(([item, standard, placeholder]) => ({ item, standard, placeholder, actual: "", result: "待確認" }))
  };
  Object.keys(editIndex).forEach(key => { editIndex[key] = null; });
  clearTimeout(undoTimer);
  undoAction = null;
  $("#undo-toast").hidden = true;
  setInitialInputs();
  setChecklistInputs();
  setQualityInputs();
  $("#phase-select").value = PHASES[0].id;
  renderPhaseEditor();
  renderAll();
  syncAllDateTimeDisplays();
  $("#clear-dialog").close();
}

function openSoilDialog(index = null) {
  editIndex.soil = index;
  const record = index === null ? { time: "" } : state.soil[index];
  $("#soil-time").value = record.time;
  syncDateTimeDisplay($("#soil-time"));
  $("#soil-dialog-title").textContent = index === null ? "新增出土紀錄" : `修改第 ${index + 1} 次出土`;
  $("#soil-form [type='submit']").textContent = index === null ? "確認加入" : "確認更新";
  $("#soil-dialog").showModal();
}

function openDepthDialog(index = null) {
  editIndex.depth = index;
  const record = index === null ? { time: "", value: "" } : state.depth[index];
  $("#depth-time").value = record.time;
  syncDateTimeDisplay($("#depth-time"));
  $("#depth-value").value = record.value;
  $("#depth-dialog-title").textContent = index === null ? "新增深度確認" : `修改第 ${index + 1} 次深度`;
  $("#depth-form [type='submit']").textContent = index === null ? "確認加入" : "確認更新";
  $("#depth-dialog").showModal();
}

function openTruckDialog(index = null) {
  editIndex.truck = index;
  const record = index === null ? { truckNo: "", unload: "", finish: "", volume: "", measured: "" } : state.trucks[index];
  $("#truck-number").value = record.truckNo;
  $("#truck-unload").value = record.unload;
  $("#truck-finish").value = record.finish;
  syncDateTimeDisplay($("#truck-unload"));
  syncDateTimeDisplay($("#truck-finish"));
  $("#truck-volume").value = record.volume;
  $("#truck-measured").value = record.measured;
  $("#truck-dialog-title").textContent = index === null ? `新增第 ${state.trucks.length + 1} 車` : `修改第 ${index + 1} 車`;
  $("#truck-form [type='submit']").textContent = index === null ? "確認加入" : "確認更新";
  $("#truck-dialog").showModal();
}

function openRebarDialog(index = null) {
  editIndex.rebar = index;
  const record = index === null
    ? { part: "", designNo: "", designQty: "", actualNo: "", actualQty: "", result: "待確認" }
    : state.rebarCage.rebars[index];
  $("#rebar-part").value = record.part;
  $("#rebar-design-no").value = record.designNo;
  $("#rebar-design-qty").value = record.designQty;
  $("#rebar-actual-no").value = record.actualNo;
  $("#rebar-actual-qty").value = record.actualQty;
  $$('input[name="rebar-result"]').forEach(radio => { radio.checked = radio.value === record.result; });
  $("#rebar-dialog-title").textContent = index === null ? "新增配筋項目" : `填寫第 ${index + 1} 項配筋`;
  $("#rebar-form [type='submit']").textContent = index === null ? "確認加入" : "確認更新";
  $("#rebar-dialog").showModal();
}

function showUndo(message, action) {
  clearTimeout(undoTimer);
  undoAction = action;
  $("#undo-message").textContent = message;
  $("#undo-toast").hidden = false;
  undoTimer = setTimeout(() => {
    $("#undo-toast").hidden = true;
    undoAction = null;
  }, 5000);
}

function removeRecord(type, index) {
  const collection = state[type];
  const [removed] = collection.splice(index, 1);
  if (type === "truck") renderPouring();
  else renderExcavation();
  const label = type === "soil" ? "出土紀錄" : type === "depth" ? "深度確認" : "澆置車次";
  showUndo(`已刪除${label}`, () => {
    collection.splice(index, 0, removed);
    if (type === "truck") renderPouring();
    else renderExcavation();
  });
}

function removeRebar(index) {
  const [removed] = state.rebarCage.rebars.splice(index, 1);
  renderRebars();
  showUndo("已刪除配筋項目", () => {
    state.rebarCage.rebars.splice(index, 0, removed);
    renderRebars();
  });
}

function printHeader(title, sequence, project = state.overview.project, recordIdentity = null, overviewData = state.overview) {
  const display = printText;
  const identity = recordIdentity || [state.wall.unitType, state.wall.unitNo].filter(Boolean).join("｜") || "未指定單元";
  const headerData = overviewData || {};
  return `<header class="print-document-header"><div class="print-header-title"><p>DIAPHRAGM WALL FIELD RECORD / ${sequence}</p><h1>${esc(title)}</h1></div><div class="print-header-meta-body"><div class="print-header-project-lines">
    <div><span>工程名稱：</span><strong>${esc(display(headerData.project || project))}</strong></div>
    <div><span>施工日期：</span><strong>${esc(display(headerData.date))}</strong></div>
    <div><span>施工廠商：</span><strong>${esc(display(headerData.contractor))}</strong></div>
    <div><span>填表人：</span><strong>${esc(display(headerData.reviewer))}</strong></div>
  </div></div><div class="print-header-logo-wrap"><img class="print-logo" src="./taisei.png" alt="大成建設標誌" /><strong class="print-header-identity">${esc(identity)}</strong></div></header>`;
}

function printFooter() {
  return `<footer class="print-footer"><div class="print-signature-grid" aria-label="簽名欄"><div><span>所長</span><span aria-hidden="true"></span></div><div><span>副所長</span><span aria-hidden="true"></span></div><div><span>擔當者</span><span aria-hidden="true"></span></div></div></footer>`;
}

function printProjectOverview(data, options = {}) {
  const display = printText;
  const dateLabel = options.dateLabel || "施工日期";
  const reviewerLabel = options.reviewerLabel || "填表人";
  const fields = [
    ["工程名稱", data.project],
    ["施工廠商", data.contractor],
    [dateLabel, data.date]
  ];
  const inlineReviewer = options.inlineReviewer !== false;
  if (!inlineReviewer) fields.push([reviewerLabel, data.reviewer]);
  const reviewerMeta = inlineReviewer ? `<span class="print-heading-meta">${esc(reviewerLabel)}：${esc(display(data.reviewer))}</span>` : "";
  return `<section class="print-section print-common-overview"><h2>工程概要${reviewerMeta}</h2><div class="print-meta-grid three">${fields.map(([label, value]) => `<div><span>${esc(label)}</span><strong>${esc(display(value))}</strong></div>`).join("")}</div></section>`;
}

function printWallInfo() {
  const display = printText;
  const height = designHeight();
  const designVolume = number(state.wall.designVolume) ?? calculatedDesignVolume();
  return `<section class="print-section print-wall-info"><h2>壁體資訊</h2><div class="print-meta-grid three">
    <div><span>單元類型</span><strong>${esc(display(state.wall.unitType))}</strong></div>
    <div><span>樁／壁編號</span><strong>${esc(display(state.wall.unitNo))}</strong></div>
    <div><span>順序編號</span><strong>${esc(display(state.wall.sequenceNo))}</strong></div>
    <div><span>混凝土強度(kgf/cm²)</span><strong>${esc(display(state.wall.strength))}</strong></div>
    <div><span>設計深度(GL,m)</span><strong>GL ${esc(display(state.wall.designDepth))} m</strong></div>
    <div><span>壁厚／單元長度(m)</span><strong>${esc(display(state.wall.thickness))} ／ ${esc(display(state.wall.length))}</strong></div>
    <div><span>澆置頂端高程(GL,m)</span><strong>GL ${number(state.wall.topElevation) !== null && number(state.wall.topElevation) >= 0 ? "+" : ""}${esc(display(state.wall.topElevation))}</strong></div>
    <div><span>設計澆置高度(m)</span><strong>${fixed(height)}</strong></div>
    <div><span>設計／實際數量(m³)</span><strong>${designVolume === null ? "" : fixed(designVolume)} ／ ${esc(display(state.wall.actualVolume))}</strong></div>
  </div></section>`;
}

function pouringChartSvg(rows) {
  const designVolume = number(state.wall.designVolume) ?? calculatedDesignVolume();
  const designHeightValue = designHeight();
  const actualRows = rows.filter(row => row.cumulative > 0 && row.measured !== null);
  const lastVolume = rows.at(-1)?.cumulative ?? 0;
  const maxVolume = Math.max(designVolume ?? 0, lastVolume, 1);
  const maxMeasured = actualRows.reduce((max, row) => Math.max(max, row.measured), 0);
  const maxHeight = Math.max(designHeightValue ?? 0, maxMeasured, 1);
  const niceMax = (value, step) => Math.max(step, Math.ceil(value / step) * step);
  const xMax = niceMax(maxVolume, maxVolume <= 40 ? 5 : 10);
  const yMax = niceMax(maxHeight, maxHeight <= 40 ? 5 : 10);
  // Keep the horizontal scale unchanged while giving the Y axis more visual
  // room.  This makes the height curve easier to read without stretching the
  // surrounding page/container to the bottom of the sheet.
  const width = 760, height = 470;
  const margin = { top: 22, right: 22, bottom: 52, left: 58 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const x = value => margin.left + (value / xMax) * plotWidth;
  const y = value => margin.top + plotHeight - (value / yMax) * plotHeight;
  const ticks = (max, step) => { const result = []; for (let value = 0; value <= max + 0.0001; value += step) result.push(Number(value.toFixed(2))); return result; };
  const xStep = xMax <= 40 ? 5 : 10;
  const yStep = yMax <= 40 ? 5 : 10;
  const grid = [...ticks(xMax, xStep).map(value => `<line x1="${x(value)}" y1="${margin.top}" x2="${x(value)}" y2="${margin.top + plotHeight}" />`), ...ticks(yMax, yStep).map(value => `<line x1="${margin.left}" y1="${y(value)}" x2="${margin.left + plotWidth}" y2="${y(value)}" />`)].join("");
  const xLabels = ticks(xMax, xStep).map(value => `<text x="${x(value)}" y="${height - 30}" text-anchor="middle">${value}</text>`).join("");
  const yLabels = ticks(yMax, yStep).map(value => `<text x="${margin.left - 8}" y="${y(value) + 3}" text-anchor="end">${value}</text>`).join("");
  const designPath = designVolume !== null && designHeightValue !== null ? `M ${x(0)} ${y(0)} L ${x(Math.min(designVolume, xMax))} ${y(Math.min(designHeightValue, yMax))}` : "";
  const actualPoints = [[0, 0], ...actualRows.map(row => [Math.min(row.cumulative, xMax), Math.min(row.measured, yMax)])];
  const actualPath = actualRows.length > 0 ? actualPoints.map(([volume, height], index) => `${index === 0 ? "M" : "L"} ${x(volume)} ${y(height)}`).join(" ") : "";
  const pointDots = actualRows.map(row => `<circle cx="${x(Math.min(row.cumulative, xMax))}" cy="${y(Math.min(row.measured, yMax))}" r="3.2" />`).join("");
  const hasData = designPath || actualPath;
  return `<div class="pouring-chart" role="img" aria-label="設計與實際混凝土澆置高度曲線"><svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
    <g class="chart-grid">${grid}</g><g class="chart-axis"><line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${margin.left + plotWidth}" y2="${margin.top + plotHeight}" /><line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" /></g>
    <g class="chart-labels">${xLabels}${yLabels}<text class="chart-axis-title" x="${margin.left + plotWidth / 2}" y="${height - 8}" text-anchor="middle">實際累積澆置體積（m³）</text><text class="chart-axis-title" transform="translate(14 ${margin.top + plotHeight / 2}) rotate(-90)" text-anchor="middle">累積澆置高度（m）</text></g>
    ${designPath ? `<path class="chart-design-line" d="${designPath}" />` : ""}${actualPath ? `<path class="chart-actual-line" d="${actualPath}" />` : ""}<g class="chart-actual-points">${pointDots}</g>
    <g class="chart-legend"><rect x="${width - 178}" y="${margin.top + 10}" width="158" height="50" rx="2" /><line class="chart-design-line" x1="${width - 164}" y1="${margin.top + 27}" x2="${width - 143}" y2="${margin.top + 27}" /><text x="${width - 136}" y="${margin.top + 30}">設計澆置曲線</text><line class="chart-actual-line" x1="${width - 164}" y1="${margin.top + 47}" x2="${width - 143}" y2="${margin.top + 47}" /><circle class="chart-actual-points" cx="${width - 153.5}" cy="${margin.top + 47}" r="2.6" /><text x="${width - 136}" y="${margin.top + 50}">實際澆置曲線</text></g>
    ${hasData ? "" : `<text class="chart-empty" x="${margin.left + plotWidth / 2}" y="${margin.top + plotHeight / 2}" text-anchor="middle">尚無足夠資料產生曲線</text>`}
  </svg><p class="pouring-chart-note">設計線依設計澆置高度與設計數量換算；實際線從原點開始，依每車累積方量與實測累積高度繪製。</p></div>`;
}

function renderPrint() {
  const display = printText;
  const height = designHeight();
  const latestDepth = state.depth.at(-1);
  const latestDepthValue = latestDepth ? number(latestDepth.value) : null;
  const depthDiff = latestDepthValue !== null && number(state.wall.designDepth) !== null ? latestDepthValue - number(state.wall.designDepth) : null;
  const truckRows = calculatedTrucks();
  const lastTruck = truckRows.at(-1);

  $("#print-overview-wall").innerHTML = `${printHeader("連續壁施工紀錄", "01–02")}
    <section class="print-section"><h2>01｜工程概要<span class="print-heading-meta">填表人：${esc(display(state.overview.reviewer))}</span></h2><div class="print-meta-grid three">
      <div><span>工程名稱</span><strong>${esc(display(state.overview.project))}</strong></div>
      <div><span>施工廠商</span><strong>${esc(display(state.overview.contractor))}</strong></div>
      <div><span>施工日期</span><strong>${esc(display(state.overview.date))}</strong></div>
    </div></section>
    <section class="print-section"><h2>02｜壁體資訊</h2><div class="print-meta-grid three">
      <div><span>單元類型</span><strong>${esc(display(state.wall.unitType))}</strong></div>
      <div><span>樁／壁編號</span><strong>${esc(display(state.wall.unitNo))}</strong></div>
      <div><span>順序編號</span><strong>${esc(display(state.wall.sequenceNo))}</strong></div>
      <div><span>混凝土強度（kgf/cm2）</span><strong>${esc(display(state.wall.strength))}</strong></div>
      <div><span>設計深度（GL, m）</span><strong>GL ${esc(display(state.wall.designDepth))} m</strong></div>
      <div><span>壁厚／單元長度</span><strong>${esc(display(state.wall.thickness))} m ／ ${esc(display(state.wall.length))} m</strong></div>
      <div><span>澆置頂端高程</span><strong>GL ${number(state.wall.topElevation) !== null && number(state.wall.topElevation) >= 0 ? "+" : ""}${esc(display(state.wall.topElevation))} m</strong></div>
      <div><span>設計澆置高度</span><strong>${fixed(height)} m</strong></div>
      <div><span>設計／實際數量(m³)</span><strong>${esc(display(state.wall.designVolume))} ／ ${esc(display(state.wall.actualVolume))}</strong></div>
    </div></section>${printFooter()}`;

  const qualityRows = state.quality.checks.map((check, index) => `<tr><td>${index + 1}</td><td class="text-left">${esc(check.item)}</td><td class="text-left">${esc(qualityCheckStandard(index, check.standard))}</td><td class="text-left">${esc(display(check.actual))}</td><td>${esc(check.result)}</td></tr>`).join("");
  const qualityStandardRows = QUALITY_STANDARD_CONFIG.map(config => {
    const unitType = state.wall.unitType;
    const selectedKey = unitType === "公單元" ? "embedmentMale" : unitType === "母單元" ? "embedmentFemale" : unitType === "公母單元" ? "embedmentBoth" : null;
    if (config.key.startsWith("embedment") && selectedKey && config.key !== selectedKey) return "";
    return `<tr><td class="text-left">${esc(config.label)}</td><td class="text-left">${esc(qualityStandardText(config.key))}</td><td>${esc(qualityStandardValue(config.key))}</td><td>${esc(config.unit)}</td></tr>`;
  }).filter(Boolean).join("");
  const qualityProject = state.overview.project;
  const qualityIdentity = [state.wall.unitType, state.wall.unitNo].filter(Boolean).join("｜") || "未指定單元";
  $("#print-quality").innerHTML = `${printHeader("連續壁施工品質自檢總表", "03", qualityProject, qualityIdentity)}
    ${printWallInfo()}
    <section class="print-section compact-print-section"><h2>檢查項目</h2><table class="print-table quality-standard-print-table"><thead><tr><th>項目</th><th>判定標準</th><th>數值</th><th>單位</th></tr></thead><tbody>${qualityStandardRows}</tbody></table></section>
    <section class="print-section compact-print-section"><h2>品質自檢項目</h2><table class="print-table quality-print-table"><thead><tr><th>項次</th><th>檢查項目</th><th>檢查標準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${qualityRows}</tbody></table></section>
    <section class="print-section quality-note-section"><h2>缺失及改善結果</h2><div class="print-note">${esc(display(state.quality.note))}</div></section>${printFooter()}`;

  const soilRows = state.soil.length ? state.soil.map((record, index) => `<tr><td>${index + 1}</td><td class="time-cell">${esc(record.time)}</td></tr>`).join("") : `<tr><td colspan="2" class="print-empty">尚無出土紀錄</td></tr>`;
  const depthRows = state.depth.length ? state.depth.map((record, index) => {
    const value = number(record.value);
    const diff = value !== null && number(state.wall.designDepth) !== null ? value - number(state.wall.designDepth) : null;
    return `<tr><td>${index + 1}</td><td class="time-cell">${esc(record.time)}</td><td>${fixed(value)}</td><td>${fixed(diff)}</td></tr>`;
  }).join("") : `<tr><td colspan="4" class="print-empty">尚無深度確認</td></tr>`;
  const phaseRows = PHASES.map((phase, index) => {
    const record = state.prework[phase.id];
    return `<tr><td>${index + 1}</td><td class="text-left">${esc(phase.label)}</td><td class="time-cell">${phase.start ? esc(display(record.start)) : ""}</td><td class="time-cell">${phase.end ? esc(display(record.end)) : ""}</td></tr>`;
  }).join("");
  $("#print-excavation-prework").innerHTML = `${printHeader("開挖與前置紀錄", "04–05")}
    ${printWallInfo()}
    <section class="print-section"><h2>04｜開挖紀錄</h2><div class="print-summary">
      <div><span>出土次數</span><strong>${state.soil.length} 次</strong></div>
      <div><span>深度確認</span><strong>${state.depth.length} 次</strong></div>
      <div><span>最新深度</span><strong>${fixed(latestDepthValue)} m</strong></div>
      <div><span>與設計差異</span><strong>${fixed(depthDiff)} m</strong></div>
    </div></section>
    <section class="print-section"><h2>出土紀錄</h2><table class="print-table"><thead><tr><th>次數</th><th>出土時間</th></tr></thead><tbody>${soilRows}</tbody></table></section>
    <section class="print-section"><h2>深度確認</h2><table class="print-table"><thead><tr><th>次數</th><th>確認時間</th><th>深度（m）</th><th>與設計差異（m）</th></tr></thead><tbody>${depthRows}</tbody></table></section>
    <section class="print-section"><h2>05｜前置紀錄時間紀錄</h2><table class="print-table"><thead><tr><th>項次</th><th>作業項目</th><th>開始時間</th><th>完成時間</th></tr></thead><tbody>${phaseRows}</tbody></table></section>${printFooter()}`;

  const pouringRows = truckRows.length ? truckRows.map(row => `<tr>
    <td>${row.index + 1}</td><td>${esc(row.truckNo)}</td><td class="time-cell">${esc(row.unload)}</td><td class="time-cell">${esc(row.finish)}</td><td>${fixed(row.volume)}</td><td>${fixed(row.cumulative)}</td><td>${fixed(row.expected)}</td><td>${fixed(row.measured)}</td><td>${fixed(row.difference)}</td>
  </tr>`).join("") : `<tr><td colspan="9" class="print-empty">尚無澆置紀錄</td></tr>`;
  $("#print-pouring").innerHTML = `${printHeader("澆置紀錄", "06")}
    <div class="pouring-layout">
      <div class="pouring-wall-full">${printWallInfo()}</div>
      <div class="pouring-main-layout"><div class="pouring-table-column"><section class="print-section"><h2>澆置主控摘要</h2><div class="print-summary">
        <div><span>車次(車)</span><strong>${truckRows.length}</strong></div>
        <div><span>逐車累積量(m³)</span><strong>${fixed(lastTruck?.cumulative ?? 0)}</strong></div>
        <div><span>設計／實際數量(m³)</span><strong>${esc(display(state.wall.designVolume))} ／ ${esc(display(state.wall.actualVolume))}</strong></div>
        <div><span>預估／實測／差異(m)</span><strong>${fixed(lastTruck?.expected ?? null)} ／ ${fixed(lastTruck?.measured ?? null)} ／ ${fixed(lastTruck?.difference ?? null)}</strong></div>
      </div></section><section class="print-section pouring-table-section"><h2>逐車混凝土澆置紀錄</h2><table class="print-table"><thead><tr><th>車次</th><th>車號</th><th>卸料</th><th>結束</th><th>方量(m³)</th><th>累積(m³)</th><th>預估高度(m)</th><th>實測高度(m)</th><th>差異(m)</th></tr></thead><tbody>${pouringRows}</tbody></table></section></div><section class="print-section pouring-chart-section"><h2>澆置高度曲線</h2>${pouringChartSvg(truckRows)}</section></div></div>${printFooter()}`;

  const guideWallRows = state.guideWall.checks.map((check, index) => `<tr><td>${index + 1}</td><td class="text-left">${esc(check.item)}</td><td class="text-left">${esc(check.standard)}</td><td class="text-left">${esc(guideCheckActual(check))}</td><td>${esc(check.result)}</td></tr>`).join("");
  $("#print-guide-wall").innerHTML = `${printHeader("導溝施工複核表", "07", state.overview.project, state.guideWall.unitNo || "未指定單元", { project: state.overview.project, contractor: state.overview.contractor, date: state.guideWall.date, reviewer: state.guideWall.reviewer })}
    <section class="print-section"><h2>導溝資料</h2><div class="print-meta-grid three">
      <div><span>單元編號</span><strong>${esc(display(state.guideWall.unitNo))}</strong></div>
      <div><span>複核意見</span><strong>${esc(display(state.guideWall.note))}</strong></div>
    </div></section>
    <section class="print-section"><h2>導溝複核項目</h2><table class="print-table checklist-print-table"><thead><tr><th>項次</th><th>複核項目</th><th>確認基準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${guideWallRows}</tbody></table></section>${printFooter()}`;

  const rebarRows = state.rebarCage.rebars.length ? state.rebarCage.rebars.map((rebar, index) => `<tr><td>${index + 1}</td><td class="text-left">${esc(rebar.part)}</td><td>${esc(display(rebar.designNo))}</td><td>${esc(display(rebar.designQty))}</td><td>${esc(display(rebar.actualNo))}</td><td>${esc(display(rebar.actualQty))}</td><td>${esc(rebar.result)}</td></tr>`).join("") : `<tr><td colspan="7" class="print-empty">尚無配筋項目</td></tr>`;
  const rebarCageRows = state.rebarCage.checks.map((check, index) => `<tr><td>${index + 1}</td><td class="text-left">${esc(check.item)}</td><td class="text-left">${esc(check.standard)}</td><td class="text-left">${esc(display(check.actual))}</td><td>${esc(check.result)}</td></tr>`).join("");
  $("#print-rebar-cage").innerHTML = `${printHeader("鋼筋籠吊放前複核表", "08", state.overview.project, [state.rebarCage.unitNo, state.rebarCage.cageNo].filter(Boolean).join("｜") || "未指定鋼筋籠", { project: state.overview.project, contractor: state.overview.contractor, date: state.rebarCage.date, reviewer: state.rebarCage.reviewer })}
    <section class="print-section"><h2>鋼筋籠資料</h2><div class="print-meta-grid three compact-meta">
      <div><span>單元編號</span><strong>${esc(display(state.rebarCage.unitNo))}</strong></div>
      <div><span>鋼筋籠編號</span><strong>${esc(display(state.rebarCage.cageNo))}</strong></div>
      <div><span>複核意見</span><strong>${esc(display(state.rebarCage.note))}</strong></div>
    </div></section>
    <section class="print-section compact-print-section"><h2>配筋複核明細</h2><table class="print-table rebar-cage-print-table"><thead><tr><th>項次</th><th>位置／用途</th><th>設計號數</th><th>設計數量／間距</th><th>實際號數</th><th>實際數量／間距</th><th>結果</th></tr></thead><tbody>${rebarRows}</tbody></table></section>
    <section class="print-section compact-print-section"><h2>組裝與吊放條件</h2><table class="print-table rebar-cage-check-print-table"><thead><tr><th>項次</th><th>複核項目</th><th>確認基準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${rebarCageRows}</tbody></table></section>${printFooter()}`;
}

function waitForPrintAssets() {
  const images = $$(".print-report img");
  return Promise.all(images.map(image => image.complete ? Promise.resolve() : new Promise(resolve => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", resolve, { once: true });
  })));
}

function setPdfDocumentTitle(scope) {
  const toolName = TOOL_LABELS[activeTool] || "施工檢核紀錄";
  const recordId = activeTool === "diaphragmWall"
    ? state.wall.unitNo
    : activeTool === "guideWall"
      ? state.guideWall.unitNo
      : state.rebarCage.unitNo || state.rebarCage.cageNo;
  const pageName = currentExportLabel(activeTool, activeTab);
  const date = state.overview.date || today;
  const parts = [toolName, recordId, scope === "all" ? "完整檢核紀錄" : pageName, date]
    .filter(Boolean)
    .map(value => safeFilePart(value, ""));
  const previousTitle = document.title;
  document.title = parts.join("_");
  window.addEventListener("afterprint", () => { document.title = previousTitle; }, { once: true });
}

async function preparePrint(scope) {
  renderPrint();
  document.body.dataset.printScope = scope;
  const requested = activeTool === "diaphragmWall" ? PRINT_TAB_GROUPS[activeTab] : PRINT_TAB_GROUPS[activeTool];
  const current = requested === "overview-wall" ? "quality" : requested;
  $$('.print-page').forEach(page => page.classList.toggle("print-selected", page.dataset.printTab === current));
  setPdfDocumentTitle(scope);
  await waitForPrintAssets();
  paginatePrintReport();
}

async function exportPdf(scope) {
  $("#export-dialog").close();
  await preparePrint(scope);
  window.print();
}

function exportData() {
  const toNumberOrNull = value => {
    const parsed = number(value);
    return parsed === null ? null : parsed;
  };
  const toNumberOrText = value => {
    const text = String(value ?? "").trim();
    if (!text) return null;
    const parsed = number(text);
    return parsed === null ? text : parsed;
  };
  const height = designHeight();
  const designVolume = calculatedDesignVolume();
  const depthDesign = toNumberOrNull(state.wall.designDepth);
  const depthChecks = state.depth.map((record, index) => {
    const depth = toNumberOrNull(record.value);
    return {
      sequence: index + 1,
      confirmation_time: record.time || null,
      depth_m: depth,
      design_difference_m: depth !== null && depthDesign !== null ? depth - depthDesign : null
    };
  });
  const trucks = calculatedTrucks().map(row => ({
    sequence: row.index + 1,
    truck_no: row.truckNo || null,
    unload_time: row.unload || null,
    finish_time: row.finish || null,
    volume_m3: toNumberOrNull(row.volume),
    cumulative_volume_m3: row.cumulative,
    design_height_m: row.expected,
    measured_height_m: row.measured,
    height_difference_m: row.difference
  }));
  const embedmentKeys = { "公單元": "embedmentMale", "母單元": "embedmentFemale", "公母單元": "embedmentBoth" };
  const selectedEmbedmentKey = embedmentKeys[state.wall.unitType] || null;
  const qualityStandards = Object.fromEntries(Object.entries(state.quality.standards)
    .filter(([key]) => !key.startsWith("embedment") || key === selectedEmbedmentKey)
    .map(([key, value]) => [key, { value, calculated_value: qualityStandardValue(key), display: qualityStandardText(key) }]));

  return {
    app_version: APP_VERSION,
    schema_version: "1.1",
    record_type: "diaphragm_wall_field_record",
    exported_at: new Date().toISOString(),
    export_context: {
      active_tool: activeTool,
      active_tab: activeTool === "diaphragmWall" ? activeTab : activeTool,
      current_form_label: currentExportLabel(activeTool, activeTab)
    },
    project: {
      name: state.overview.project || null,
      contractor: state.overview.contractor || null,
      construction_date: state.overview.date || null,
      form_filler: state.overview.reviewer || null
    },
    wall_unit: {
      unit_type: state.wall.unitType || null,
      unit_no: state.wall.unitNo || null,
      sequence_no: state.wall.sequenceNo || null,
      design_depth_m: depthDesign,
      top_elevation_m: toNumberOrNull(state.wall.topElevation),
      thickness_m: toNumberOrNull(state.wall.thickness),
      length_m: toNumberOrNull(state.wall.length),
      concrete_strength_kgf_cm2: toNumberOrText(state.wall.strength),
      design_pour_height_m: height,
      design_volume_m3: designVolume,
      actual_volume_m3: toNumberOrNull(state.wall.actualVolume)
    },
    excavation: {
      soil_records: state.soil.map((record, index) => ({ sequence: index + 1, time: record.time || null })),
      depth_confirmations: depthChecks
    },
    prework: PHASES.map(phase => ({
      phase_id: phase.id,
      phase_name: phase.label,
      start_time: state.prework[phase.id].start || null,
      finish_time: state.prework[phase.id].end || null
    })),
    pouring: {
      trucks,
      total_trucks: trucks.length,
      cumulative_volume_m3: trucks.at(-1)?.cumulative_volume_m3 ?? 0,
      last_design_height_m: trucks.at(-1)?.design_height_m ?? null,
      last_measured_height_m: trucks.at(-1)?.measured_height_m ?? null,
      last_height_difference_m: trucks.at(-1)?.height_difference_m ?? null
    },
    quality_self_check: {
      note: state.quality.note || null,
      standards: qualityStandards,
      items: state.quality.checks.map((check, index) => ({
        item_no: index + 1,
        item: check.item,
        standard: qualityCheckStandard(index, check.standard),
        actual: check.actual || null,
        result: check.result
      }))
    },
    guide_wall_review: {
      project: state.overview.project || null,
      contractor: state.overview.contractor || null,
      review_date: state.guideWall.date || null,
      unit_no: state.guideWall.unitNo || null,
      reviewer: state.guideWall.reviewer || null,
      note: state.guideWall.note || null,
      items: state.guideWall.checks.map((check, index) => ({
        item_no: index + 1,
        item: check.item,
        standard: check.standard,
        actual: check.actual || null,
        bar_size: check.barNo || null,
        bar_spacing_cm: toNumberOrText(check.barSpacing),
        result: check.result
      }))
    },
    rebar_cage_review: {
      project: state.overview.project || null,
      review_date: state.rebarCage.date || null,
      unit_no: state.rebarCage.unitNo || null,
      cage_no: state.rebarCage.cageNo || null,
      reviewer: state.rebarCage.reviewer || null,
      note: state.rebarCage.note || null,
      rebar_items: state.rebarCage.rebars.map((rebar, index) => ({
        item_no: index + 1,
        part: rebar.part || null,
        design_bar_size: rebar.designNo || null,
        design_quantity_spacing: rebar.designQty || null,
        actual_bar_size: rebar.actualNo || null,
        actual_quantity_spacing: rebar.actualQty || null,
        result: rebar.result
      })),
      inspection_items: state.rebarCage.checks.map((check, index) => ({
        item_no: index + 1,
        item: check.item,
        standard: check.standard,
        actual: check.actual || null,
        result: check.result
      }))
    }
  };
}

function safeFilePart(value, fallback) {
  const cleaned = String(value ?? "").trim().replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-");
  return cleaned || fallback;
}

function exportFileName(extension) {
  const recordId = safeFilePart(state.wall.unitNo || state.guideWall.unitNo || state.rebarCage.unitNo, "");
  const date = safeFilePart(state.overview.date || today, today);
  return `${["diaphragm-wall", recordId, date].filter(Boolean).join("-")}.${extension}`;
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

function markdownCell(value) {
  return String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ").trim() || "—";
}

function exportMarkdown() {
  const data = exportData();
  const wall = data.wall_unit;
  const lines = [
    `# 連續壁施工紀錄`,
    ``,
    `- 匯出時間：${data.exported_at}`,
    `- APP 版本：${data.app_version}`,
    `- 資料版本：${data.schema_version}`,
    ``,
    `## 工程概要`,
    ``,
    `| 欄位 | 內容 |`,
    `| --- | --- |`,
    `| 工程名稱 | ${markdownCell(data.project.name)} |`,
    `| 施工廠商 | ${markdownCell(data.project.contractor)} |`,
    `| 施工日期 | ${markdownCell(data.project.construction_date)} |`,
    `| 填表人 | ${markdownCell(data.project.form_filler)} |`,
    ``,
    `## 壁體資訊`,
    ``,
    `| 欄位 | 內容 |`,
    `| --- | --- |`,
    `| 單元類型 | ${markdownCell(wall.unit_type)} |`,
    `| 單元編號 | ${markdownCell(wall.unit_no)} |`,
    `| 順序編號 | ${markdownCell(wall.sequence_no)} |`,
    `| 設計深度（m） | ${markdownCell(wall.design_depth_m)} |`,
    `| 頂端高程（m） | ${markdownCell(wall.top_elevation_m)} |`,
    `| 壁厚（m） | ${markdownCell(wall.thickness_m)} |`,
    `| 單元長度（m） | ${markdownCell(wall.length_m)} |`,
    `| 混凝土強度（kgf/cm²） | ${markdownCell(wall.concrete_strength_kgf_cm2)} |`,
    `| 設計澆置高度（m） | ${markdownCell(wall.design_pour_height_m)} |`,
    `| 設計數量（m³） | ${markdownCell(wall.design_volume_m3)} |`,
    `| 實際數量（m³） | ${markdownCell(wall.actual_volume_m3)} |`,
    ``,
    `## 開挖紀錄`,
    ``,
    `### 出土紀錄`,
    ``,
    `| 次數 | 時間 |`,
    `| --- | --- |`,
    ...(data.excavation.soil_records.length ? data.excavation.soil_records.map(record => `| ${record.sequence} | ${markdownCell(record.time)} |`) : [`| — | 尚無紀錄 |`]),
    ``,
    `### 深度確認`,
    ``,
    `| 次數 | 確認時間 | 深度（m） | 與設計差異（m） |`,
    `| --- | --- | ---: | ---: |`,
    ...(data.excavation.depth_confirmations.length ? data.excavation.depth_confirmations.map(record => `| ${record.sequence} | ${markdownCell(record.confirmation_time)} | ${markdownCell(record.depth_m)} | ${markdownCell(record.design_difference_m)} |`) : [`| — | 尚無紀錄 | — | — |`]),
    ``,
    `## 前置紀錄`,
    ``,
    `| 作業項目 | 開始時間 | 完成時間 |`,
    `| --- | --- | --- |`,
    ...data.prework.map(record => `| ${markdownCell(record.phase_name)} | ${markdownCell(record.start_time)} | ${markdownCell(record.finish_time)} |`),
    ``,
    `## 澆置紀錄`,
    ``,
    `| 車次 | 車號 | 卸料 | 結束 | 方量（m³） | 累積（m³） | 設計高度（m） | 實測高度（m） | 高度差異（m） |`,
    `| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |`,
    ...(data.pouring.trucks.length ? data.pouring.trucks.map(record => `| ${record.sequence} | ${markdownCell(record.truck_no)} | ${markdownCell(record.unload_time)} | ${markdownCell(record.finish_time)} | ${markdownCell(record.volume_m3)} | ${markdownCell(record.cumulative_volume_m3)} | ${markdownCell(record.design_height_m)} | ${markdownCell(record.measured_height_m)} | ${markdownCell(record.height_difference_m)} |`) : [`| — | 尚無紀錄 | — | — | — | — | — | — | — |`]),
    ``,
    `## 品質自檢`,
    ``,
    `### 檢查項目`,
    ``,
    `| 項目 | 判定標準 | 數值 | 單位 |`,
    `| --- | --- | ---: | --- |`,
    ...QUALITY_STANDARD_CONFIG
      .filter(config => Object.prototype.hasOwnProperty.call(data.quality_self_check.standards, config.key))
      .map(config => `| ${markdownCell(config.label)} | ${markdownCell(data.quality_self_check.standards[config.key]?.display)} | ${markdownCell(data.quality_self_check.standards[config.key]?.value)} | ${markdownCell(config.unit)} |`),
    ``,
    `### 檢查項目`,
    ``,
    `| 項次 | 檢查項目 | 檢查標準 | 現場紀錄／實測 | 結果 |`,
    `| ---: | --- | --- | --- | --- |`,
    ...data.quality_self_check.items.map(item => `| ${item.item_no} | ${markdownCell(item.item)} | ${markdownCell(item.standard)} | ${markdownCell(item.actual)} | ${markdownCell(item.result)} |`),
    ``,
    `**缺失及改善結果：** ${markdownCell(data.quality_self_check.note)}`,
    ``,
    `## Guide Wall／導溝複核`,
    ``,
    ...data.guide_wall_review.items.map(item => `- ${item.item_no}. ${item.item}：${item.result}；現場紀錄：${markdownCell([item.actual, item.bar_size ? `號數 ${item.bar_size}` : "", item.bar_spacing_cm !== null && item.bar_spacing_cm !== undefined ? `間距 ${item.bar_spacing_cm} cm` : ""].filter(Boolean).join("；"))}`),
    ``,
    `## Rebar Cage／鋼筋籠複核`,
    ``,
    `### 配筋明細`,
    ``,
    `| 項次 | 位置／用途 | 設計號數 | 設計數量／間距 | 實際號數 | 實際數量／間距 | 結果 |`,
    `| ---: | --- | --- | --- | --- | --- | --- |`,
    ...data.rebar_cage_review.rebar_items.map(item => `| ${item.item_no} | ${markdownCell(item.part)} | ${markdownCell(item.design_bar_size)} | ${markdownCell(item.design_quantity_spacing)} | ${markdownCell(item.actual_bar_size)} | ${markdownCell(item.actual_quantity_spacing)} | ${markdownCell(item.result)} |`),
    ``,
    `### 組裝與吊放條件`,
    ``,
    ...data.rebar_cage_review.inspection_items.map(item => `- ${item.item_no}. ${item.item}：${item.result}；現場紀錄：${markdownCell(item.actual)}`),
    ``,
    `> 本 Markdown 由施工紀錄工具依同一份結構化資料產生；資料庫匯入請優先使用同次輸出的 JSON。`
  ];
  downloadText(lines.join("\n"), "text/markdown;charset=utf-8", exportFileName("md"));
}

function exportJson() {
  downloadText(`${JSON.stringify(exportData(), null, 2)}\n`, "application/json;charset=utf-8", exportFileName("json"));
}

function importText(value) {
  return value === null || value === undefined ? "" : String(value);
}

function importResult(value) {
  return ["待確認", "符合", "不符合", "不適用"].includes(value) ? value : "待確認";
}

function importChecklistItems(definitions, items) {
  const source = Array.isArray(items) ? items : [];
  return definitions.map(([item, standard, placeholder], index) => {
    const record = source[index] || {};
    return {
      item: importText(record.item) || item,
      standard: importText(record.standard) || standard,
      placeholder: placeholder || "",
      actual: importText(record.actual),
      barNo: importText(record.bar_size || record.bar_no),
      barSpacing: importText(record.bar_spacing_cm || record.bar_spacing),
      result: importResult(record.result)
    };
  });
}

const GUIDE_WALL_LEGACY_ALIASES = {
  "放樣與單元中心線": ["單元位置與中心線"],
  "導溝寬度／淨寬": ["導溝寬度與淨寬", "導溝內面淨寬實測"],
  "導溝深度與底高程": ["導溝頂高程／深度", "導溝頂基準高程實測"],
  "壁面與底部完整性": ["壁面與底部完整性"]
};

function importGuideWallItems(items) {
  const source = Array.isArray(items) ? items : [];
  return GUIDE_WALL_CHECKS.map(([item, standard]) => {
    const labels = [item, ...(GUIDE_WALL_LEGACY_ALIASES[item] || [])];
    const record = source.find(entry => labels.includes(entry?.item)) || {};
    return {
      item,
      standard: importText(record.standard) || standard,
      actual: importText(record.actual),
      barNo: importText(record.bar_size || record.bar_no),
      barSpacing: importText(record.bar_spacing_cm || record.bar_spacing),
      result: importResult(record.result)
    };
  });
}

function importJsonPayload(payload) {
  const supportedTypes = ["diaphragm_wall_field_record", "continuous_wall_field_record"];
  if (!payload || !supportedTypes.includes(payload.record_type)) {
    throw new Error("這不是連續壁施工紀錄工具所產生的 JSON。");
  }

  const project = payload.project || {};
  const wall = payload.wall_unit || {};
  const excavation = payload.excavation || {};
  const prework = Array.isArray(payload.prework) ? payload.prework : [];
  const pouring = payload.pouring || {};
  const quality = payload.quality_self_check || {};
  const guideWall = payload.guide_wall_review || payload.trench_review || {};
  const rebarCage = payload.rebar_cage_review || payload.cage_review || {};

  // 舊版 JSON 的工程名稱／廠商可能只填在導溝或鋼筋籠區塊，匯入時往回補進共用欄位。
  state.overview = {
    project: importText(project.name) || importText(guideWall.project) || importText(rebarCage.project),
    contractor: importText(project.contractor) || importText(guideWall.contractor),
    date: importText(project.construction_date),
    reviewer: importText(project.form_filler)
  };
  state.wall = {
    unitType: importText(wall.unit_type),
    unitNo: importText(wall.unit_no),
    sequenceNo: importText(wall.sequence_no),
    designDepth: importText(wall.design_depth_m),
    strength: importText(wall.concrete_strength_kgf_cm2),
    thickness: importText(wall.thickness_m),
    length: importText(wall.length_m),
    topElevation: importText(wall.top_elevation_m),
    designVolume: importText(wall.design_volume_m3),
    actualVolume: importText(wall.actual_volume_m3)
  };
  state.soil = (Array.isArray(excavation.soil_records) ? excavation.soil_records : [])
    .map(record => ({ time: importText(record.time) }))
    .filter(record => record.time);
  state.depth = (Array.isArray(excavation.depth_confirmations) ? excavation.depth_confirmations : [])
    .map(record => ({ time: importText(record.confirmation_time), value: importText(record.depth_m) }))
    .filter(record => record.time || record.value);
  state.prework = Object.fromEntries(PHASES.map(phase => {
    const record = prework.find(item => item.phase_id === phase.id) || {};
    return [phase.id, { start: importText(record.start_time), end: importText(record.finish_time) }];
  }));
  state.trucks = (Array.isArray(pouring.trucks) ? pouring.trucks : []).map(record => ({
    truckNo: importText(record.truck_no),
    unload: importText(record.unload_time),
    finish: importText(record.finish_time),
    volume: importText(record.volume_m3),
    measured: importText(record.measured_height_m)
  }));

  const standardValues = { ...QUALITY_STANDARD_DEFAULTS };
  Object.entries(quality.standards || {}).forEach(([key, value]) => {
    if (!Object.prototype.hasOwnProperty.call(standardValues, key)) return;
    standardValues[key] = importText(value && typeof value === "object" ? (value.selection ?? value.value) : value);
  });
  state.quality = {
    note: importText(quality.note),
    standards: standardValues,
    checks: importChecklistItems(QUALITY_CHECKS, quality.items)
  };
  state.guideWall = {
    date: importText(guideWall.review_date),
    unitNo: importText(guideWall.unit_no),
    reviewer: importText(guideWall.reviewer),
    note: importText(guideWall.note),
    checks: importGuideWallItems(guideWall.items)
  };

  const importedRebars = Array.isArray(rebarCage.rebar_items) ? rebarCage.rebar_items : [];
  state.rebarCage = {
    date: importText(rebarCage.review_date),
    unitNo: importText(rebarCage.unit_no),
    cageNo: importText(rebarCage.cage_no),
    reviewer: importText(rebarCage.reviewer),
    note: importText(rebarCage.note),
    rebars: importedRebars.length ? importedRebars.map(record => ({
      part: importText(record.part),
      designNo: importText(record.design_bar_size),
      designQty: importText(record.design_quantity_spacing),
      actualNo: importText(record.actual_bar_size),
      actualQty: importText(record.actual_quantity_spacing),
      result: importResult(record.result)
    })) : REBAR_CAGE_PARTS.map(part => ({ part, designNo: "", designQty: "", actualNo: "", actualQty: "", result: "待確認" })),
    checks: importChecklistItems(REBAR_CAGE_CHECKS, rebarCage.inspection_items)
  };

  const context = payload.export_context || {};
  const importedTool = ["diaphragmWall", "guideWall", "rebarCage"].includes(context.active_tool) ? context.active_tool : "diaphragmWall";
  const importedTab = TAB_LABELS[context.active_tab] ? context.active_tab : "overview";
  setInitialInputs();
  setChecklistInputs();
  setQualityInputs();
  $("#phase-select").value = PHASES[0].id;
  renderPhaseEditor();
  renderAll();
  showTool(importedTool);
  if (importedTool === "diaphragmWall") showTab(importedTab);
  syncAllDateTimeDisplays();
}

async function importJsonFile(file) {
  const status = $("#import-status");
  try {
    const payload = JSON.parse(await file.text());
    importJsonPayload(payload);
    draft.schedule(); // file input 的 change 事件在讀檔完成前就冒泡過了，這裡補存匯入後的狀態
    status.textContent = "匯入完成：已回填連續壁、導溝與鋼筋籠全部分頁。";
  } catch (error) {
    status.textContent = `匯入失敗：${error.message || "JSON 格式無法讀取"}`;
  }
}

function handleExport(format) {
  if (format === "pdf-current") return exportPdf("current");
  if (format === "pdf-all") return exportPdf("all");
  if (format === "json") {
    exportJson();
    $("#export-dialog").close();
    return;
  }
  if (format === "markdown") {
    exportMarkdown();
    $("#export-dialog").close();
  }
}

function initialize() {
  setInitialInputs();
  $("#phase-select").innerHTML = PHASES.map(phase => `<option value="${phase.id}">${esc(phase.label)}</option>`).join("");
  renderPhaseEditor();
  renderAll();
  syncAllDateTimeDisplays();
  showTab("overview");

  document.addEventListener("input", event => {
    if (event.target.matches('input[type="date"], input[type="time"]')) syncDateTimeDisplay(event.target);
    const input = event.target.closest("[data-bind]");
    if (input) {
      const [group, key] = input.dataset.bind.split(".");
      state[group][key] = input.value;
      if (group === "wall") updateWallCalculation();
      else if (group === "overview") updateIdentity();
      return;
    }
    const meta = event.target.closest("[data-check-bind]");
    if (meta) {
      const [type, key] = meta.dataset.checkBind.split(".");
      state[type][key] = meta.value;
      updateIdentity();
      return;
    }
    const qualityMeta = event.target.closest("[data-quality-bind]");
    if (qualityMeta) {
      state.quality[qualityMeta.dataset.qualityBind] = qualityMeta.value;
      return;
    }
    const check = event.target.closest("[data-check-item]");
    if (check) state[check.dataset.checkItem].checks[Number(check.dataset.checkIndex)][check.dataset.checkField] = check.value;
    const qualityCheck = event.target.closest("[data-quality-item]");
    if (qualityCheck) state.quality.checks[Number(qualityCheck.dataset.qualityItem)][qualityCheck.dataset.qualityField] = qualityCheck.value;
  });

  document.addEventListener("change", event => {
    const input = event.target.closest("[data-bind]");
    if (input?.type === "radio") {
      const [group, key] = input.dataset.bind.split(".");
      state[group][key] = input.value;
      updateIdentity();
      if (group === "wall" && key === "unitType") renderQualityStandards();
      return;
    }
    const check = event.target.closest("[data-check-item]");
    if (check) {
      const type = check.dataset.checkItem;
      state[type].checks[Number(check.dataset.checkIndex)][check.dataset.checkField] = check.value;
      if (check.dataset.checkField === "result") renderCheckCards(type);
    }
    const qualityCheck = event.target.closest("[data-quality-item]");
    if (qualityCheck) {
      state.quality.checks[Number(qualityCheck.dataset.qualityItem)][qualityCheck.dataset.qualityField] = qualityCheck.value;
      if (qualityCheck.dataset.qualityField === "result") renderQuality();
    }
    const qualityStandard = event.target.closest("[data-quality-standard]");
    if (qualityStandard) {
      state.quality.standards[qualityStandard.dataset.qualityStandard] = qualityStandard.value;
      renderQualityStandards();
    }
  });

  // 會改到 state 的互動都經過這三種事件；「確認清空」那一下除外，否則剛刪掉的草稿又會被寫回。
  ["input", "change", "submit"].forEach(type => document.addEventListener(type, () => draft.schedule()));
  document.addEventListener("click", event => { if (!event.target.closest("#confirm-clear")) draft.schedule(); });

  $$('[role="tab"]').forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
    button.addEventListener("keydown", event => {
      const tabs = $$('[role="tab"]', button.closest("[data-tool-view]"));
      const index = tabs.indexOf(button);
      const direction = ["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 0;
      if (!direction) return;
      event.preventDefault();
      const next = tabs[(index + direction + tabs.length) % tabs.length];
      showTab(next.dataset.tab);
      next.focus();
    });
  });

  $("#help-button").addEventListener("click", () => $("#help-dialog").showModal());
  $("#clear-button").addEventListener("click", () => $("#clear-dialog").showModal());
  $("#confirm-clear").addEventListener("click", clearAllData);
  $("#export-button").addEventListener("click", () => {
    $("#export-current-label").textContent = currentExportLabel();
    $("#import-status").textContent = "";
    $("#export-dialog").showModal();
  });
  $$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
  $$('[data-export-format]').forEach(button => button.addEventListener("click", () => handleExport(button.dataset.exportFormat)));
  $("#import-json-button").addEventListener("click", () => $("#json-file-input").click());
  $("#json-file-input").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (file) await importJsonFile(file);
    event.target.value = "";
  });
  $$('[data-select-tool]').forEach(button => button.addEventListener("click", () => showTool(button.dataset.selectTool)));

  $("#add-soil").addEventListener("click", () => openSoilDialog());
  $("#add-depth").addEventListener("click", () => openDepthDialog());
  $("#add-truck").addEventListener("click", () => openTruckDialog());
  $("#add-rebar").addEventListener("click", () => openRebarDialog());

  $("#soil-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!validateDialogForm(event.currentTarget)) return;
    const record = { time: $("#soil-time").value };
    if (editIndex.soil === null) state.soil.push(record);
    else state.soil[editIndex.soil] = record;
    $("#soil-dialog").close();
    renderExcavation();
  });

  $("#depth-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!validateDialogForm(event.currentTarget)) return;
    const record = { time: $("#depth-time").value, value: $("#depth-value").value };
    if (editIndex.depth === null) state.depth.push(record);
    else state.depth[editIndex.depth] = record;
    $("#depth-dialog").close();
    renderExcavation();
  });

  $("#truck-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!validateDialogForm(event.currentTarget)) return;
    const record = {
      truckNo: $("#truck-number").value.trim(),
      unload: $("#truck-unload").value,
      finish: $("#truck-finish").value,
      volume: $("#truck-volume").value,
      measured: $("#truck-measured").value
    };
    if (editIndex.truck === null) state.trucks.push(record);
    else state.trucks[editIndex.truck] = record;
    $("#truck-dialog").close();
    renderPouring();
  });

  $("#rebar-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!validateDialogForm(event.currentTarget)) return;
    const record = {
      part: $("#rebar-part").value.trim(),
      designNo: $("#rebar-design-no").value.trim(),
      designQty: $("#rebar-design-qty").value.trim(),
      actualNo: $("#rebar-actual-no").value.trim(),
      actualQty: $("#rebar-actual-qty").value.trim(),
      result: document.querySelector('input[name="rebar-result"]:checked')?.value || "待確認"
    };
    if (editIndex.rebar === null) state.rebarCage.rebars.push(record);
    else state.rebarCage.rebars[editIndex.rebar] = record;
    $("#rebar-dialog").close();
    renderRebars();
  });

  $("#phase-select").addEventListener("change", renderPhaseEditor);
  $("#confirm-phase").addEventListener("click", () => {
    const phase = PHASES.find(item => item.id === $("#phase-select").value);
    $$('[data-phase-input]').forEach(input => { state.prework[phase.id][input.dataset.phaseInput] = input.value; });
    renderPrework();
  });

  document.addEventListener("click", event => {
    const editSoil = event.target.closest("[data-edit-soil]");
    const deleteSoil = event.target.closest("[data-delete-soil]");
    const editDepth = event.target.closest("[data-edit-depth]");
    const deleteDepth = event.target.closest("[data-delete-depth]");
    const editTruck = event.target.closest("[data-edit-truck]");
    const deleteTruck = event.target.closest("[data-delete-truck]");
    const editRebar = event.target.closest("[data-edit-rebar]");
    const deleteRebar = event.target.closest("[data-delete-rebar]");
    if (editSoil) openSoilDialog(Number(editSoil.dataset.editSoil));
    else if (deleteSoil) removeRecord("soil", Number(deleteSoil.dataset.deleteSoil));
    else if (editDepth) openDepthDialog(Number(editDepth.dataset.editDepth));
    else if (deleteDepth) removeRecord("depth", Number(deleteDepth.dataset.deleteDepth));
    else if (editTruck) openTruckDialog(Number(editTruck.dataset.editTruck));
    else if (deleteTruck) removeRecord("truck", Number(deleteTruck.dataset.deleteTruck));
    else if (editRebar) openRebarDialog(Number(editRebar.dataset.editRebar));
    else if (deleteRebar) removeRebar(Number(deleteRebar.dataset.deleteRebar));
  });

  $("#undo-button").addEventListener("click", () => {
    if (undoAction) undoAction();
    clearTimeout(undoTimer);
    undoAction = null;
    $("#undo-toast").hidden = true;
  });

  window.addEventListener("afterprint", () => { document.body.dataset.printScope = "none"; });
  showTool("diaphragmWall");
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./sw.js").catch(() => {});
}

Object.assign(state, draft.load() ?? {});
if (exampleMode) loadExample();
initialize();
