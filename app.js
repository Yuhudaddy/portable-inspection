const APP_VERSION = "1.4";

const TAB_LABELS = {
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

// 壁體資訊沒有自己的列印頁，和品質自檢共用同一張總表
const PRINT_TAB_GROUPS = {
  wall: "quality",
  quality: "quality",
  excavation: "excavation-prework",
  prework: "excavation-prework",
  pouring: "pouring",
  guideWall: "guideWall",
  rebarCage: "rebarCage"
};

const GUIDE_WALL_CHECKS = [
  ["放樣", "點位、單元順序與核定圖說相符"],
  ["地下管線", "未與既有管線衝突"],
  ["位置與淨寬", "導溝內面淨寬符合設計連續壁厚+施工餘裕(5cm內)"],
  ["深度", "・深度至少 1.8 m，且回填土層以下至少 30 cm\n・溝底高程符合核定施工圖"],
  ["牆厚", "導溝牆厚、斷面及結構尺寸符合核定圖說"],
  ["鋼筋", "鋼筋號數／支數／間距與核定配筋圖一致"],
  ["回撐木", "間距 @200 cm 或依核定支撐計畫（拆模後未達指定強度時嚴禁重車行駛）"],
  ["混凝土強度", "混凝土強度符合設計要求"],
  ["頂部基準高程", "符合設計圖說"],
  ["壁面順直度", "導溝兩側壁面垂直度 1/300，並保持順直，無明顯扭曲或局部變形"],
  ["壁面與底部完整性", "無鬆動、剝落、裂縫；底部無堆積物"]
];
const createGuideWallCheck = ([item, standard]) => ({ item, standard, actual: "", barNo: "", barSpacing: "", result: "待確認" });

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
  ["底部沉渣及泥屑清除確認", "依本公司標準值（預設 15 cm 以內）", "例如：沉泥 12 cm"],
  ["端板接頭清洗（公及公母單元時）", "以大小鋼刷確實清洗", "填寫清洗狀況"],
  ["穩定液新鮮液之貯存量是否充裕", "依照施工計畫", "填寫液量或確認說明"],
  ["槽溝穩定液面高度控制", "高於地下水位 1.0 m 以上，且不低於導溝頂下 80 cm", "例如：導溝頂下 60 cm，高於水位 1.5 m"],
  ["廢土清運是否正常", "不致影響挖掘進度", "填寫異常說明"],
  ["施工動線及運土車輛之安排", "不致延遲澆置時間", "填寫異常說明"],
  ["壁體坍塌處是否需作補強", "若需補強，說明方式", "填寫補強方式或無需補強"],
  ["帆布是否破損（母單元時）", "單元起吊前及下放時檢查", "填寫檢查狀況"],
  ["開挖深度與特密管長度之配合", "初灌管底離槽溝底 30～50 cm", "填寫距離"],
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
  { key: "slump", label: "混凝土坍度", unit: "cm", options: Array.from({ length: 10 }, (_, i) => String(15 + i)), default: "20" },
  { key: "slumpTolerance", label: "坍度允許誤差", unit: "cm", options: ["0", "1", "2", "3", "4", "5"], default: "2" },
  { key: "sediment", label: "沉泥厚度上限", unit: "cm", options: ["5", "10", "15", "20", "25"], default: "15" },
  { key: "sandContent", label: "含砂量上限", unit: "%", options: ["0.5", "1", "1.5", "2"], default: "1" },
  { key: "settlingTime", label: "靜置時間下限", unit: "hr", options: ["0.5", "1", "1.5", "2"], default: "0.5" },
  { key: "verticalDenominator", label: "垂直精度（10／D）", unit: "1/n", options: ["100", "200", "300", "400", "500", "10/D"], default: "300" },
  { key: "tremieClearance", label: "特密管端距上限", unit: "cm", options: ["20", "30", "40", "50"], default: "50" },
  { key: "embedmentMale", label: "公單元埋入深度下限", unit: "m", options: ["0.5", "1.0", "1.5", "2.0"], default: "1.5" },
  { key: "embedmentFemale", label: "母單元埋入深度下限", unit: "m", options: ["0.5", "1.0", "1.5", "2.0"], default: "1.5" },
  { key: "embedmentBoth", label: "公母單元埋入深度下限", unit: "m", options: ["0.5", "1.0", "1.5", "2.0"], default: "1.5" },
  { key: "pourInterruption", label: "澆置中斷時間上限", unit: "min", options: ["30", "45", "60"], default: "30" },
  { key: "pourCompletion", label: "澆置完成時間上限", unit: "min", options: ["60", "90", "120"], default: "90" },
  { key: "chloride", label: "氯離子含量上限", unit: "kg/m³", options: ["0.15", "0.30"], default: "0.15" },
  { key: "centerlineTolerance", label: "導溝中心線偏差上限", unit: "cm", options: ["1", "2", "3", "5"], default: "2" },
  { key: "wallThicknessTolerance", label: "壁厚偏差上限", unit: "cm", options: ["3", "5", "7.5", "10"], default: "5" },
  { key: "cageLongitudinalTolerance", label: "鋼筋籠縱向偏差上限", unit: "cm", options: ["±2.5", "±5", "±7.5", "±10"], default: "±2.5" },
  { key: "cageTopTolerance", label: "鋼筋籠頂高程偏差上限", unit: "cm", options: ["±3", "±5", "±7.5", "±10"], default: "±5" },
  { key: "cover", label: "保護層厚度下限", unit: "cm", options: ["5", "7.5", "10", "12.5"], default: "10" },
  { key: "volumeDifference", label: "實際／設計數量差異上限", unit: "%", options: ["5", "10", "15", "20"], default: "5" }
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
  overview: { project: "", contractor: "", reviewer: "" },
  // 各紀錄分頁自己的日期：成槽常跨日所以有起迄；前置作業的日期存在各工序（state.prework[id].date）
  dates: { excavationStart: today, excavationEnd: "", pouring: today },
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
  prework: Object.fromEntries(PHASES.map(phase => [phase.id, { date: today, start: "", end: "" }])),
  trucks: [],
  // 工程名稱／施工廠商由 overview 統一持有，導溝與鋼筋籠共用；複核人（營造廠）與填表人（廠商）是不同人，各自保留。
  // 單元編號只存在 wall：鋼筋籠與壁體是同一個單元，直接帶入；導溝是全區同一種配筋與尺寸的統一檢查，不分單元。
  guideWall: {
    date: today, axisNo: "", reviewer: "", note: "",
    checks: GUIDE_WALL_CHECKS.map(createGuideWallCheck)
  },
  rebarCage: {
    date: today, cageNo: "", reviewer: "", note: "",
    mode: "simple",
    parts: createRebarCageParts(),
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

// 舊草稿補齊新欄位（Object.assign 是整組覆蓋，不會自動補）：車次的出廠時間／坍度、工序日期，
// 以及舊版單一「施工日期」搬到各分頁日期。之後新增欄位只要改這裡的預設值。
function normalizeLoadedState(loaded) {
  state.trucks = state.trucks.map(truck => ({ dispatch: "", slump: "", ...truck }));
  PHASES.forEach(phase => { state.prework[phase.id] = { date: "", start: "", end: "", ...state.prework[phase.id] }; });
  const legacyDate = state.overview.date;
  if (legacyDate) {
    if (!loaded.dates) state.dates = { excavationStart: legacyDate, excavationEnd: "", pouring: legacyDate };
    PHASES.forEach(phase => { state.prework[phase.id].date ||= legacyDate; });
  }
  delete state.overview.date;
  // 1.2 以前導溝、鋼筋籠各自存一份單元編號；鋼筋籠那份與壁體同單元，壁體沒填時拿來補上
  state.wall.unitNo ||= state.rebarCage.unitNo || "";
  delete state.guideWall.unitNo;
  delete state.rebarCage.unitNo;
  // 1.4 以前的草稿：配筋抽查是自由列表 rebars；改成 13 個固定部位後直接重設，模式從簡易開始
  state.rebarCage.mode = state.rebarCage.mode === "detailed" ? "detailed" : "simple";
  state.rebarCage.parts = normalizeRebarCageParts(state.rebarCage.parts);
  delete state.rebarCage.rebars;
}

let activeTab = "wall";
let activeTool = "diaphragmWall";
const editIndex = { soil: null, depth: null, truck: null };
let undoTimer;
let undoAction = null;

const $ = selector => document.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const number = value => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const fixed = value => Number.isFinite(value) ? value.toFixed(2) : "";
// 這兩支檔案的 display 只做 trim：畫面上的空值由各自的樣板處理，列印時未填就留白。
const display = printText;
const guideCheckActual = check => [display(check.actual), check.barNo ? `號數 ${barSizeMark(check.barNo)}` : "", check.barSpacing ? `間距 ${check.barSpacing} cm` : ""].filter(Boolean).join("；") || "";
const esc = value => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
// 判定標準文字裡的 \n 會變成換行；要條列就直接在文字裡寫「・」。
const standardHtml = value => String(value ?? "").split("\n").map(line => esc(line.trim())).filter(Boolean).join("<br>");

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

function timeToMinutes(value) {
  const [h, m] = String(value ?? "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

// 30 時制：輸入仍是一般 HH:MM，顯示與列印時，比「基準時間」早的就視為跨日，寫成 24:xx～29:xx
// （23:50 → 00:20 顯示為 23:50 → 24:20），一張表就看得出灌到隔天。
const clock30 = minutes => minutes === null ? "" : `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
function minutesAfter(value, base) {
  const minutes = timeToMinutes(value);
  if (minutes === null) return null;
  if (base === null || base === undefined) return minutes;
  let absolute = minutes + Math.floor(base / 1440) * 1440;
  while (absolute < base) absolute += 1440;
  return absolute;
}
// 一串依序發生的時間（出土、深度確認）：每個都以前一個為基準
function sequence30(times) {
  let previous = null;
  return times.map(value => {
    const absolute = minutesAfter(value, previous);
    if (absolute !== null) previous = absolute;
    return clock30(absolute);
  });
}

// 出土與深度確認：把 30 時制時間與設計深度差異算好，畫面、列印、匯出都吃同一份
function calculatedExcavation() {
  const designDepthValue = number(state.wall.designDepth);
  const soilTimes = sequence30(state.soil.map(record => record.time));
  const depthTimes = sequence30(state.depth.map(record => record.time));
  return {
    soil: state.soil.map((record, index) => ({ ...record, index, time30: soilTimes[index] })),
    depth: state.depth.map((record, index) => {
      const value = number(record.value);
      return { ...record, index, time30: depthTimes[index], value, difference: value !== null && designDepthValue !== null ? value - designDepthValue : null };
    })
  };
}

// 車次合理性提醒的門檻（只提醒不擋）。30 時制會把「比基準早」的時間解讀成隔天，所以時間打錯不會報錯，
// 而是變成間隔特別大；用間隔來抓打錯與順序錯，方量則抓明顯超出一般拌合車的值。
const TRUCK_LIMITS = { dispatchGapMinutes: 12 * 60, unloadAfterDispatchMinutes: 4 * 60, finishAfterUnloadMinutes: 3 * 60, clock30Minutes: 30 * 60, maxVolume: 15 };
const hoursText = minutes => `${(minutes / 60).toFixed(1)} 小時`;
function truckFlags({ truck, volume, dispatchAt, unloadAt, finishAt, previousDispatch }) {
  const flags = [];
  if (previousDispatch !== null && dispatchAt !== null && dispatchAt - previousDispatch > TRUCK_LIMITS.dispatchGapMinutes) flags.push(`出廠時間比前一車晚 ${hoursText(dispatchAt - previousDispatch)}，請確認車次順序或是否打錯`);
  if (dispatchAt !== null && unloadAt !== null && unloadAt - dispatchAt > TRUCK_LIMITS.unloadAfterDispatchMinutes) flags.push(`出廠到卸料相差 ${hoursText(unloadAt - dispatchAt)}，請確認時間是否打錯`);
  if (unloadAt !== null && finishAt !== null && finishAt - unloadAt > TRUCK_LIMITS.finishAfterUnloadMinutes) flags.push(`卸料到結束相差 ${hoursText(finishAt - unloadAt)}，請確認時間是否打錯`);
  if (String(truck.volume).trim() && volume <= 0) flags.push("方量為 0 或負值，請確認");
  if (volume > TRUCK_LIMITS.maxVolume) flags.push(`單車方量 ${fixed(volume)} m³ 超過一般拌合車容量，請確認`);
  return flags;
}

function calculatedTrucks() {
  const designVolume = number(state.wall.designVolume);
  const height = designHeight();
  let cumulative = 0;
  let slumpTests = 0;
  // 30 時制的基準：出廠時間以上一車出廠為準（車次只會越來越晚），卸料以本車出廠、結束以本車卸料為準
  let previousDispatch = null;
  let previousUnload = null;
  let passed30 = false;
  return state.trucks.map((truck, index) => {
    const volume = number(truck.volume) ?? 0;
    const measured = number(truck.measured);
    cumulative += volume;
    const expected = designVolume && height !== null ? height * cumulative / designVolume : null;
    const difference = measured !== null && expected !== null ? measured - expected : null;
    // 有填坍度的車次就是做了一組試體，依序編「試1、試2…」，列印與畫面都以「（試1）18」呈現
    const slumpNo = String(truck.slump ?? "").trim() ? ++slumpTests : null;
    const slumpLabel = slumpNo === null ? "" : `（試${slumpNo}）${truck.slump}`;
    const dispatchAt = minutesAfter(truck.dispatch, previousDispatch);
    const unloadAt = minutesAfter(truck.unload, dispatchAt ?? previousUnload);
    const finishAt = minutesAfter(truck.finish, unloadAt);
    const flags = truckFlags({ truck, volume, dispatchAt, unloadAt, finishAt, previousDispatch });
    // 推算超過 30:00（翌日 06:00）只在第一車提醒一次，通宵澆置後面每車都提醒就成了雜訊
    if (!passed30 && [dispatchAt, unloadAt, finishAt].some(value => value !== null && value >= TRUCK_LIMITS.clock30Minutes)) {
      passed30 = true;
      flags.push("時間已推算到 30:00 以後（翌日 06:00 後），如非通宵澆置請檢查前面車次的時間");
    }
    if (dispatchAt !== null) previousDispatch = dispatchAt;
    if (unloadAt !== null) previousUnload = unloadAt;
    // 澆置時間＝結束 − 出廠（分鐘），確認混凝土是否在限制時間內澆完
    const minutes = dispatchAt !== null && finishAt !== null ? finishAt - dispatchAt : null;
    return { ...truck, index, volume, cumulative, measured, expected, difference, minutes, slumpNo, slumpLabel, flags,
      dispatch30: clock30(dispatchAt), unload30: clock30(unloadAt), finish30: clock30(finishAt) };
  });
}

function setInitialInputs() {
  $$('[data-bind]').forEach(input => {
    const [group, key] = input.dataset.bind.split(".");
    if (input.type === "radio") input.checked = state[group][key] === input.value;
    else input.value = state[group][key] ?? "";
  });
}

const wallUnitLabel = () => [state.wall.unitType, state.wall.unitNo].filter(Boolean).join("｜");
// 壁體資訊與鋼筋籠分頁的單元／順序編號綁同一份資料：任一邊輸入就把另一邊同步
function syncUnitInputs(source = null) {
  $$('[data-bind="wall.unitNo"], [data-bind="wall.sequenceNo"]').forEach(input => {
    if (input === source) return;
    const key = input.dataset.bind.split(".")[1];
    input.value = state.wall[key] ?? "";
  });
}

function updateWallCalculation() {
  const height = designHeight();
  const volume = calculatedDesignVolume();
  state.wall.designVolume = volume === null ? "" : volume.toFixed(2);
  const volumeInput = $('[data-bind="wall.designVolume"]');
  if (volumeInput) volumeInput.value = state.wall.designVolume;
  const heightInput = $("#design-height-value");
  if (heightInput) heightInput.value = height === null ? "" : height.toFixed(2);
  renderQualityStandards();
  renderExcavation();
  renderPouring();
}

function currentExportLabel(tool = activeTool, tab = activeTab) {
  if (tool === "diaphragmWall") {
    if (PRINT_TAB_GROUPS[tab] === "quality") return tab === "wall" ? "品質自檢（含壁體資訊）" : "品質自檢";
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

  const excavation = calculatedExcavation();
  $("#soil-list").innerHTML = excavation.soil.length ? excavation.soil.map((record, index) => `
    <article class="record-item">
      <div class="record-item-main">
        <div class="record-item-title"><strong>第 ${index + 1} 次出土</strong><span>${esc(record.time30)}</span></div>
      </div>
      <div class="record-item-actions">
        <button type="button" data-edit-soil="${index}">修改</button>
        <button type="button" data-delete-soil="${index}">刪除</button>
      </div>
    </article>`).join("") : emptyState("尚無出土紀錄，請按＋新增。");

  $("#depth-list").innerHTML = excavation.depth.length ? excavation.depth.map((record, index) => {
    const { value, difference: diff } = record;
    return `
      <article class="record-item">
        <div class="record-item-main">
          <div class="record-item-title"><strong>深度 ${fixed(value)} m</strong><span>${esc(record.time30)}</span></div>
          <div class="record-item-meta"><span>第 ${index + 1} 次確認</span><span class="${diff !== null && diff < 0 ? "warning-text" : ""}">與設計差異 ${fixed(diff)} m</span></div>
        </div>
        <div class="record-item-actions">
          <button type="button" data-edit-depth="${index}">修改</button>
          <button type="button" data-delete-depth="${index}">刪除</button>
        </div>
      </article>`;
  }).join("") : emptyState("尚無深度確認，請按＋新增。");
}

function phaseTimes(phase) {
  const record = state.prework[phase.id];
  const startAt = phase.start ? timeToMinutes(record.start) : null;
  const endAt = phase.end ? minutesAfter(record.end, startAt) : null;
  return { start: clock30(startAt), end: clock30(endAt) };
}

function phaseTimeText(phase) {
  const record = state.prework[phase.id];
  const times = phaseTimes(phase);
  const values = [];
  if (phase.start) values.push(`開始 ${times.start || "—"}`);
  if (phase.end) values.push(`完成 ${times.end || "—"}`);
  return `${record.date ? `${formatDateDisplay(record.date).slice(5)}　` : ""}${values.join(" ／ ")}`;
}

function renderPhaseEditor() {
  const phase = PHASES.find(item => item.id === $("#phase-select").value) || PHASES[0];
  const record = state.prework[phase.id];
  const fields = [`<label class="field"><span>作業日期</span><span class="native-field-wrap"><input type="date" data-phase-input="date" value="${esc(record.date)}" /><span class="native-field-display" aria-hidden="true"></span></span></label>`];
  if (phase.start) fields.push(`<label class="field"><span>${esc(phase.start)}</span><span class="native-field-wrap"><input type="time" data-phase-input="start" value="${esc(record.start)}" /><span class="native-field-display" aria-hidden="true"></span></span></label>`);
  if (phase.end) fields.push(`<label class="field"><span>${esc(phase.end)}</span><span class="native-field-wrap"><input type="time" data-phase-input="end" value="${esc(record.end)}" /><span class="native-field-display" aria-hidden="true"></span></span></label>`);
  $("#phase-time-fields").innerHTML = fields.join("");
  syncAllDateTimeDisplays();
}

function renderPrework() {
  $("#phase-summary").innerHTML = PHASES.map(phase => {
    const record = state.prework[phase.id];
    const complete = record.date && (!phase.start || record.start) && (!phase.end || record.end);
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
        <div class="record-item-title"><strong>第 ${row.index + 1} 車｜${esc(row.truckNo)}</strong><span class="${row.flags.length ? "warning-text" : ""}">${esc(row.dispatch30 || "—")} 出廠｜${esc(row.unload30)}–${esc(row.finish30)}</span></div>
        <div class="record-item-meta">
          <span>本車 ${fixed(row.volume)} m³</span>
          <span>累積 ${fixed(row.cumulative)} m³</span>
          ${row.slumpLabel ? `<span>坍度 ${esc(row.slumpLabel)} cm</span>` : ""}
          <span>澆置 ${row.minutes === null ? "—" : row.minutes} 分</span>
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

  const warnings = rows.flatMap(row => [
    ...(row.difference !== null && row.difference < -0.3 ? [`<div class="warning-item"><strong>第 ${row.index + 1} 車差異 ${fixed(row.difference)} m：</strong>請確認量測基準、實際方量、超挖或坍孔可能性。</div>`] : []),
    ...row.flags.map(flag => `<div class="warning-item"><strong>第 ${row.index + 1} 車：</strong>${esc(flag)}</div>`)
  ]);
  $("#pour-warnings").innerHTML = warnings.join("");
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
      <p>${type === "quality" ? esc(qualityCheckStandard(index, check.standard)) : standardHtml(check.standard)}</p>
      <div class="check-card-fields">
        <label class="field"><span>現場紀錄／實測</span><input type="text" value="${esc(check.actual)}" data-check-item="${type}" data-check-index="${index}" data-check-field="actual" /></label>
        <div class="field result-field"><span id="check-${type}-${index}-result-label">複核結果</span>${resultSegmented(`check-${type}-${index}-result`, check.result, `data-check-item="${type}" data-check-index="${index}" data-check-field="result"`)}</div>
      </div>
      ${type === "guideWall" && check.item.includes("鋼筋") ? `<div class="guide-rebar-fields">
        <label class="field"><span>鋼筋號數</span><select data-check-item="${type}" data-check-index="${index}" data-check-field="barNo">${barSizeOptions(check.barNo)}</select></label>
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
  const cage = state.rebarCage;
  $("#rebar-cage-rebar-list").innerHTML = rebarCageCardsHtml(cage, resultSegmented);
  $("#rebar-cage-rebar-progress").textContent = `${cage.parts.filter(part => part.result !== "待確認").length} / ${cage.parts.length}`;
  syncRebarCageModeTabs(cage.mode);
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
  syncUnitInputs();
  updateWallCalculation();
  renderPrework();
  renderChecklists();
}

// 範例：詳細模式，主筋兩個深度區間、第二區間啟用補強插筋；水平溫度筋內外側對稱。
function exampleRebarCageParts() {
  const parts = createRebarCageParts();
  const fill = (index, patch) => Object.assign(parts[index], patch);
  const interval = (top, bottom, size, spacing, extra = null) => ({ top, bottom, size, spacing, extra: extra ? { enabled: true, size: extra[0], spacing: extra[1] } : { enabled: false, size: "", spacing: "" } });
  fill(0, { intervals: [interval("0", "20", "D32", "60"), interval("20", "35.8", "D32", "60", ["D32", "30"])] });
  fill(1, { intervals: [interval("0", "20", "D32", "60", ["D32", "30"]), interval("20", "35.8", "D32", "60", ["D32", "15"])] });
  fill(2, { symmetric: true, intervals: [interval("0", "35.8", "D32", "60")] });
  fill(4, { intervals: [interval("0", "35.8", "D32", "60")] });
  fill(5, { intervals: [interval("0", "35.8", "D32", "60")] });
  fill(6, { intervals: [interval("0", "35.8", "D32", "60")] });
  fill(7, { symmetric: true, count: "3", size: "D19" });
  fill(8, { size: "D16", spacing: "30" });
  fill(9, { size: "D16", spacing: "60" });
  fill(10, { symmetric: true, count: "2", size: "D32", spacing: "600" });
  fill(11, { spacing: "200" });
  fill(12, { spacing: "240" });
  parts.forEach(part => { part.result = "符合"; });
  return parts;
}

function loadExample() {
  state.overview = { project: "Example Construction Project — North Lot", contractor: "○○營造股份有限公司", reviewer: "Site Engineer" };
  state.dates = { excavationStart: "2026-08-10", excavationEnd: "2026-08-11", pouring: "2026-08-11" };
  Object.assign(state.wall, { unitType: "公單元", unitNo: "21", sequenceNo: "03", designDepth: "-35.80", strength: "350", thickness: "1.00", length: "2.80", topElevation: "-0.50", designVolume: "98.84", actualVolume: "107.46" });
  state.soil = ["07:40", "08:20", "09:05"].map(time => ({ time }));
  state.depth = [{ time: "12:10", value: "-35.80" }, { time: "12:35", value: "-35.82" }];
  state.prework = Object.fromEntries(PHASES.map((phase, index) => [phase.id, { date: "2026-08-11", start: `0${8 + index}:00`, end: `0${8 + index}:30` }]));
  state.trucks = Array.from({ length: 8 }, (_, index) => ({ truckNo: `C${String(index + 1).padStart(2, "0")}`, dispatch: `${12 + Math.floor(index / 2)}:${index % 2 ? "50" : "28"}`, unload: `${13 + Math.floor(index / 2)}:${index % 2 ? "42" : "20"}`, finish: `${13 + Math.floor(index / 2)}:${index % 2 ? "55" : "33"}`, volume: index === 7 ? "9.46" : "12", measured: (3.9 + index * 4.1).toFixed(2), slump: index === 0 ? "18" : "" }));
  state.guideWall = { date: "2026-08-10", axisNo: "X3～X7 南側", reviewer: "Site Engineer", note: "中心線偏差 1.6 cm；順序符合；導溝條件完成複核。", checks: GUIDE_WALL_CHECKS.map(([item, standard], index) => ({ item, standard, actual: index === 0 ? "中心線偏差 1.6 cm" : "已確認", barNo: index === 5 ? "D16" : "", barSpacing: index === 5 ? "19.5" : "", result: "符合" })) };
  state.rebarCage = { date: "2026-08-10", cageNo: "C21-U／C21-L", reviewer: "Site Engineer", note: "配筋圖逐項核對；吊放條件完成。", mode: "detailed", parts: exampleRebarCageParts(), checks: REBAR_CAGE_CHECKS.map(([item, standard], index) => ({ item, standard, actual: index === 7 ? "3 組成對安裝；線路已保護至孔口" : "已確認", result: "符合" })) };
  state.quality = { note: "各項檢查完成，未發現影響施工之缺失。", standards: { ...QUALITY_STANDARD_DEFAULTS }, checks: QUALITY_CHECKS.map(([item, standard, placeholder]) => ({ item, standard, placeholder, actual: "已確認", result: "符合" })) };
}

function clearAllData() {
  draft.clear();
  state.overview = { project: "", contractor: "", reviewer: "" };
  state.dates = { excavationStart: "", excavationEnd: "", pouring: "" };
  state.wall = {
    unitType: "", unitNo: "", sequenceNo: "", designDepth: "", strength: "", thickness: "", length: "",
    topElevation: "", designVolume: "", actualVolume: ""
  };
  state.soil = [];
  state.depth = [];
  state.prework = Object.fromEntries(PHASES.map(phase => [phase.id, { date: "", start: "", end: "" }]));
  state.trucks = [];
  state.guideWall = {
    date: "", axisNo: "", reviewer: "", note: "",
    checks: GUIDE_WALL_CHECKS.map(createGuideWallCheck)
  };
  state.rebarCage = {
    date: "", cageNo: "", reviewer: "", note: "",
    mode: "simple",
    parts: createRebarCageParts(),
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
  const record = index === null ? { truckNo: "", dispatch: "", unload: "", finish: "", volume: "", measured: "", slump: "" } : state.trucks[index];
  $("#truck-number").value = record.truckNo;
  $("#truck-dispatch").value = record.dispatch;
  $("#truck-unload").value = record.unload;
  $("#truck-finish").value = record.finish;
  syncDateTimeDisplay($("#truck-dispatch"));
  syncDateTimeDisplay($("#truck-unload"));
  syncDateTimeDisplay($("#truck-finish"));
  $("#truck-volume").value = record.volume;
  $("#truck-measured").value = record.measured;
  $("#truck-slump").value = record.slump;
  $("#truck-dialog-title").textContent = index === null ? `新增第 ${state.trucks.length + 1} 車` : `修改第 ${index + 1} 車`;
  // 只算「這一車之前」的累積方量，方便對照每 100 m³ 一組坍度試體；本車填多少都不影響這個數字。
  const before = state.trucks.slice(0, index ?? state.trucks.length).reduce((sum, truck) => sum + (number(truck.volume) ?? 0), 0);
  $("#truck-cumulative").textContent = `目前累積：${fixed(before)} m³`;
  $("#truck-form [type='submit']").textContent = index === null ? "確認加入" : "確認更新";
  $("#truck-dialog").showModal();
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
  const render = type === "trucks" ? renderPouring : renderExcavation;
  render();
  const label = type === "soil" ? "出土紀錄" : type === "depth" ? "深度確認" : "澆置車次";
  showUndo(`已刪除${label}`, () => {
    collection.splice(index, 0, removed);
    render();
  });
}


// 施工期間：所有紀錄日期的最早～最晚（總表與檔名用）
function recordDates() {
  return [state.dates.excavationStart, state.dates.excavationEnd, ...PHASES.map(phase => state.prework[phase.id].date), state.dates.pouring].filter(Boolean).sort();
}
function dateRangeText(start, end) {
  if (!start && !end) return "";
  if (!start || !end || start === end) return start || end;
  return `${start} ～ ${end}`;
}
function constructionPeriodText() {
  const dates = recordDates();
  return dateRangeText(dates[0], dates.at(-1));
}

// 列印表頭。每頁自己決定日期（總表印施工期間、開挖頁印開挖日期、澆置頁印澆置日期…），
// 工程名稱／施工廠商一律取共用的工程資訊；identity 與 reviewer 沒給就用連續壁本身的。
function printHeader({ title, sequence, identity, date, dateLabel = "施工期間", reviewer = state.overview.reviewer, reviewerLabel = "填表人" }) {
  const shownIdentity = identity || [state.wall.unitType, state.wall.unitNo].filter(Boolean).join("｜") || "未指定單元";
  return `<header class="print-document-header"><div class="print-header-title"><p>DIAPHRAGM WALL FIELD RECORD / ${sequence}</p><h1>${esc(title)}</h1></div><div class="print-header-meta-body"><div class="print-header-project-lines">
    <div><span>工程名稱：</span><strong>${esc(display(state.overview.project))}</strong></div>
    <div><span>${esc(dateLabel)}：</span><strong>${esc(display(date))}</strong></div>
    <div><span>施工廠商：</span><strong>${esc(display(state.overview.contractor))}</strong></div>
    <div><span>${esc(reviewerLabel)}：</span><strong>${esc(display(reviewer))}</strong></div>
  </div></div><div class="print-header-logo-wrap"><img class="print-logo" src="./taisei.png" alt="大成建設標誌" /><strong class="print-header-identity">${esc(shownIdentity)}</strong></div></header>`;
}



function printWallInfo() {
  const height = designHeight();
  const designVolume = number(state.wall.designVolume) ?? calculatedDesignVolume();
  return `<section class="print-section print-wall-info"><h2>壁體資訊</h2><div class="print-meta-grid three">
    <div><span>單元類型</span><strong>${esc(display(state.wall.unitType))}</strong></div>
    <div><span>單元編號</span><strong>${esc(display(state.wall.unitNo))}</strong></div>
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
  // 刻度間距依量體選 5／10／20／50／100，讓刻度數維持在 8～16 格；方量大（例如 400 m³）時
  // 若固定 10 一格，X 軸會擠出 40 個標籤疊在一起。
  const niceStep = value => [5, 10, 20, 50, 100].find(step => value / step <= 16) ?? 200;
  const niceMax = (value, step) => Math.max(step, Math.ceil(value / step) * step);
  const xStep = niceStep(maxVolume);
  const yStep = niceStep(maxHeight);
  const xMax = niceMax(maxVolume, xStep);
  const yMax = niceMax(maxHeight, yStep);
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
  const height = designHeight();
  const latestDepth = state.depth.at(-1);
  const latestDepthValue = latestDepth ? number(latestDepth.value) : null;
  const depthDiff = latestDepthValue !== null && number(state.wall.designDepth) !== null ? latestDepthValue - number(state.wall.designDepth) : null;
  const truckRows = calculatedTrucks();
  const lastTruck = truckRows.at(-1);

  const qualityRows = state.quality.checks.map((check, index) => `<tr><td>${index + 1}</td><td class="text-left">${esc(check.item)}</td><td class="text-left">${esc(qualityCheckStandard(index, check.standard))}</td><td class="text-left">${esc(display(check.actual))}</td><td>${esc(check.result)}</td></tr>`).join("");
  const qualityStandardRows = QUALITY_STANDARD_CONFIG.map(config => {
    const unitType = state.wall.unitType;
    const selectedKey = unitType === "公單元" ? "embedmentMale" : unitType === "母單元" ? "embedmentFemale" : unitType === "公母單元" ? "embedmentBoth" : null;
    if (config.key.startsWith("embedment") && selectedKey && config.key !== selectedKey) return "";
    return `<tr><td class="text-left">${esc(config.label)}</td><td class="text-left">${esc(qualityStandardText(config.key))}</td><td>${esc(qualityStandardValue(config.key))}</td><td>${esc(config.unit)}</td></tr>`;
  }).filter(Boolean).join("");
  $("#print-quality").innerHTML = `${printHeader({ title: "連續壁施工品質自檢總表", sequence: "03", date: constructionPeriodText() })}
    ${printWallInfo()}
    <section class="print-section compact-print-section"><h2>檢查項目</h2><table class="print-table quality-standard-print-table"><thead><tr><th>項目</th><th>判定標準</th><th>數值</th><th>單位</th></tr></thead><tbody>${qualityStandardRows}</tbody></table></section>
    <section class="print-section compact-print-section"><h2>品質自檢項目</h2><table class="print-table quality-print-table"><thead><tr><th>項次</th><th>檢查項目</th><th>檢查標準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${qualityRows}</tbody></table></section>
    <section class="print-section quality-note-section"><h2>缺失及改善結果</h2><div class="print-note">${esc(display(state.quality.note))}</div></section>${printFooter()}`;

  const excavation = calculatedExcavation();
  const soilRows = excavation.soil.length ? excavation.soil.map(record => `<tr><td>${record.index + 1}</td><td class="time-cell">${esc(record.time30)}</td></tr>`).join("") : `<tr><td colspan="2" class="print-empty">尚無出土紀錄</td></tr>`;
  const depthRows = excavation.depth.length ? excavation.depth.map(record => `<tr><td>${record.index + 1}</td><td class="time-cell">${esc(record.time30)}</td><td>${fixed(record.value)}</td><td>${fixed(record.difference)}</td></tr>`).join("") : `<tr><td colspan="4" class="print-empty">尚無深度確認</td></tr>`;
  const phaseRows = PHASES.map((phase, index) => {
    const record = state.prework[phase.id];
    const times = phaseTimes(phase);
    return `<tr><td>${index + 1}</td><td class="text-left">${esc(phase.label)}</td><td class="time-cell">${esc(display(record.date))}</td><td class="time-cell">${phase.start ? esc(times.start) : ""}</td><td class="time-cell">${phase.end ? esc(times.end) : ""}</td></tr>`;
  }).join("");
  const excavationDate = dateRangeText(state.dates.excavationStart, state.dates.excavationEnd);
  $("#print-excavation-prework").innerHTML = `${printHeader({ title: "開挖與前置紀錄", sequence: "04–05", date: excavationDate, dateLabel: "開挖日期" })}
    ${printWallInfo()}
    <section class="print-section"><h2>04｜開挖紀錄<span class="print-heading-meta">開挖日期：${esc(display(excavationDate))}</span></h2><div class="print-summary">
      <div><span>出土次數</span><strong>${state.soil.length} 次</strong></div>
      <div><span>深度確認</span><strong>${state.depth.length} 次</strong></div>
      <div><span>最新深度</span><strong>${fixed(latestDepthValue)} m</strong></div>
      <div><span>與設計差異</span><strong>${fixed(depthDiff)} m</strong></div>
    </div></section>
    <section class="print-section"><h2>出土紀錄</h2><table class="print-table"><thead><tr><th>次數</th><th>出土時間</th></tr></thead><tbody>${soilRows}</tbody></table></section>
    <section class="print-section"><h2>深度確認</h2><table class="print-table"><thead><tr><th>次數</th><th>確認時間</th><th>深度（m）</th><th>與設計差異（m）</th></tr></thead><tbody>${depthRows}</tbody></table></section>
    <section class="print-section"><h2>05｜前置紀錄時間紀錄</h2><table class="print-table prework-print-table"><thead><tr><th>項次</th><th>作業項目</th><th>作業日期</th><th>開始時間</th><th>完成時間</th></tr></thead><tbody>${phaseRows}</tbody></table></section>
    <p class="print-table-note">跨午夜的時間以 24 時以後接續表示（例：24:20＝翌日 00:20）。</p>${printFooter()}`;

  const pouringRows = truckRows.length ? truckRows.map(row => `<tr>
    <td>${row.index + 1}</td><td>${esc(row.truckNo)}</td><td class="time-cell">${esc(row.dispatch30)}</td><td class="time-cell">${esc(row.unload30)}</td><td class="time-cell">${esc(row.finish30)}</td><td>${esc(row.slumpLabel)}</td><td>${fixed(row.volume)}</td><td>${fixed(row.cumulative)}</td><td>${fixed(row.expected)}</td><td>${fixed(row.measured)}</td><td>${row.minutes === null ? "—" : row.minutes}</td>
  </tr>`).join("") : `<tr><td colspan="11" class="print-empty">尚無澆置紀錄</td></tr>`;
  $("#print-pouring").innerHTML = `${printHeader({ title: "澆置紀錄", sequence: "06", date: state.dates.pouring, dateLabel: "澆置日期" })}
    <div class="pouring-layout">
      <div class="pouring-wall-full">${printWallInfo()}</div>
      <div class="pouring-main-layout"><div class="pouring-table-column"><section class="print-section"><h2>澆置主控摘要</h2><div class="print-summary">
        <div><span>車次(車)</span><strong>${truckRows.length}</strong></div>
        <div><span>逐車累積量(m³)</span><strong>${fixed(lastTruck?.cumulative ?? 0)}</strong></div>
        <div><span>設計／實際數量(m³)</span><strong>${esc(display(state.wall.designVolume))} ／ ${esc(display(state.wall.actualVolume))}</strong></div>
        <div><span>預估／實測／差異(m)</span><strong>${fixed(lastTruck?.expected ?? null)} ／ ${fixed(lastTruck?.measured ?? null)} ／ ${fixed(lastTruck?.difference ?? null)}</strong></div>
      </div></section><section class="print-section pouring-table-section"><h2>逐車混凝土澆置紀錄</h2><table class="print-table"><thead><tr><th>車次</th><th>車號</th><th>出廠</th><th>卸料</th><th>結束</th><th>坍度(cm)</th><th>方量(m³)</th><th>累積(m³)</th><th>預估高(m)</th><th>實際高(m)</th><th>澆置時間(分)</th></tr></thead><tbody>${pouringRows}</tbody></table><p class="print-table-note">跨午夜的時間以 24 時以後接續表示（例：25:30＝翌日 01:30）；澆置時間＝結束 − 出廠。</p></section></div><section class="print-section pouring-chart-section"><h2>澆置高度曲線</h2>${pouringChartSvg(truckRows)}</section></div></div>${printFooter()}`;

  const guideWallRows = state.guideWall.checks.map((check, index) => `<tr><td>${index + 1}</td><td class="text-left">${esc(check.item)}</td><td class="text-left">${standardHtml(check.standard)}</td><td class="text-left">${esc(guideCheckActual(check))}</td><td>${esc(check.result)}</td></tr>`).join("");
  $("#print-guide-wall").innerHTML = `${printHeader({ title: "導溝施工複核表", sequence: "07", identity: state.guideWall.axisNo || "未填軸線", date: state.guideWall.date, dateLabel: "複核日期", reviewer: state.guideWall.reviewer, reviewerLabel: "營造廠複核人" })}
    <section class="print-section"><h2>導溝資料</h2><div class="print-meta-grid">
      <div><span>軸線／方向編號</span><strong>${esc(display(state.guideWall.axisNo))}</strong></div>
      <div><span>複核意見</span><strong>${esc(display(state.guideWall.note))}</strong></div>
    </div></section>
    <section class="print-section"><h2>導溝複核項目</h2><table class="print-table checklist-print-table"><thead><tr><th>項次</th><th>複核項目</th><th>確認基準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${guideWallRows}</tbody></table></section>${printFooter()}`;

  const rebarCageRows = state.rebarCage.checks.map((check, index) => `<tr><td>${index + 1}</td><td class="text-left">${esc(check.item)}</td><td class="text-left">${standardHtml(check.standard)}</td><td class="text-left">${esc(display(check.actual))}</td><td>${esc(check.result)}</td></tr>`).join("");
  $("#print-rebar-cage").innerHTML = `${printHeader({ title: "鋼筋籠吊放前複核表", sequence: "08", identity: [state.wall.unitNo, state.rebarCage.cageNo].filter(Boolean).join("｜") || "未指定鋼筋籠", date: state.rebarCage.date, dateLabel: "複核日期", reviewer: state.rebarCage.reviewer, reviewerLabel: "營造廠複核人" })}
    <section class="print-section"><h2>鋼筋籠資料</h2><div class="print-meta-grid compact-meta">
      <div><span>單元編號</span><strong>${esc(display(wallUnitLabel()))}</strong></div>
      <div><span>順序編號</span><strong>${esc(display(state.wall.sequenceNo))}</strong></div>
      <div><span>鋼筋籠編號</span><strong>${esc(display(state.rebarCage.cageNo))}</strong></div>
      <div><span>複核意見</span><strong>${esc(display(state.rebarCage.note))}</strong></div>
    </div></section>
    <section class="print-section compact-print-section"><h2>配筋抽查明細</h2>${rebarCagePrintTableHtml(state.rebarCage)}</section>
    <section class="print-section compact-print-section"><h2>組裝與吊放條件</h2><table class="print-table rebar-cage-check-print-table"><thead><tr><th>項次</th><th>複核項目</th><th>確認基準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${rebarCageRows}</tbody></table></section>${printFooter()}`;
}

function setPdfDocumentTitle(scope) {
  const toolName = TOOL_LABELS[activeTool] || "施工檢核紀錄";
  const recordId = activeTool === "guideWall" ? state.guideWall.axisNo : state.wall.unitNo || (activeTool === "rebarCage" ? state.rebarCage.cageNo : "");
  const pageName = currentExportLabel(activeTool, activeTab);
  // 檔名的日期跟該張列印頁一致；完整紀錄與總表用最晚的紀錄日期
  const pageDates = { pouring: state.dates.pouring, "excavation-prework": state.dates.excavationStart, guideWall: state.guideWall.date, rebarCage: state.rebarCage.date };
  const group = activeTool === "diaphragmWall" ? PRINT_TAB_GROUPS[activeTab] : activeTool;
  const date = (scope === "all" && activeTool === "diaphragmWall" ? null : pageDates[group]) || recordDates().at(-1) || today;
  const parts = [toolName, recordId, scope === "all" ? "完整檢核紀錄" : pageName, date];
  setPrintDocumentTitle(parts);
}

function preparePrint(scope) {
  renderPrint();
  document.body.dataset.printScope = scope;
  const current = activeTool === "diaphragmWall" ? PRINT_TAB_GROUPS[activeTab] : PRINT_TAB_GROUPS[activeTool];
  $$('.print-page').forEach(page => page.classList.toggle("print-selected", page.dataset.printTab === current));
  setPdfDocumentTitle(scope);
  paginatePrintReport();
}

// window.print() 必須留在點擊事件的同步流程裡：中間只要 await 過，Safari 就會當成「自動列印」擋下來。
function exportPdf(scope) {
  $("#export-dialog").close();
  preparePrint(scope);
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
  const depthChecks = calculatedExcavation().depth.map(record => ({
    sequence: record.index + 1,
    confirmation_time: record.time || null,
    depth_m: record.value,
    design_difference_m: record.difference
  }));
  const trucks = calculatedTrucks().map(row => ({
    sequence: row.index + 1,
    truck_no: row.truckNo || null,
    dispatch_time: row.dispatch || null,
    unload_time: row.unload || null,
    finish_time: row.finish || null,
    pour_minutes: row.minutes,
    slump_test_no: row.slumpNo,
    slump_cm: toNumberOrNull(row.slump),
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
    schema_version: "1.5",
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
      construction_date: state.dates.pouring || recordDates().at(-1) || null, // 相容舊欄位：以澆置日期代表
      construction_period: { start: recordDates()[0] || null, end: recordDates().at(-1) || null },
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
      start_date: state.dates.excavationStart || null,
      end_date: state.dates.excavationEnd || null,
      soil_records: state.soil.map((record, index) => ({ sequence: index + 1, time: record.time || null })),
      depth_confirmations: depthChecks
    },
    prework: PHASES.map(phase => ({
      phase_id: phase.id,
      phase_name: phase.label,
      date: state.prework[phase.id].date || null,
      start_time: state.prework[phase.id].start || null,
      finish_time: state.prework[phase.id].end || null
    })),
    pouring: {
      date: state.dates.pouring || null,
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
      axis_no: state.guideWall.axisNo || null,
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
      cage_no: state.rebarCage.cageNo || null,
      reviewer: state.rebarCage.reviewer || null,
      note: state.rebarCage.note || null,
      mode: state.rebarCage.mode,
      parts: exportRebarCageParts(state.rebarCage),
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


function exportFileName(extension) {
  const recordId = safeFilePart(state.wall.unitNo, "");
  const date = safeFilePart(recordDates().at(-1) || today, today);
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
  const excavation = calculatedExcavation();
  const trucks = calculatedTrucks();
  const phaseTable = PHASES.map(phase => ({ phase, record: state.prework[phase.id], times: phaseTimes(phase) }));
  const wall = data.wall_unit;
  const lines = [
    `# 連續壁施工紀錄`,
    ``,
    `- 匯出時間：${data.exported_at}`,
    `- APP 版本：${data.app_version}`,
    `- 資料版本：${data.schema_version}`,
    ``,
    `## 工程資訊`,
    ``,
    `| 欄位 | 內容 |`,
    `| --- | --- |`,
    `| 工程名稱 | ${markdownCell(data.project.name)} |`,
    `| 施工廠商 | ${markdownCell(data.project.contractor)} |`,
    `| 施工期間 | ${markdownCell(dateRangeText(data.project.construction_period.start, data.project.construction_period.end))} |`,
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
    `- 開挖日期：${markdownCell(dateRangeText(data.excavation.start_date, data.excavation.end_date))}`,
    `- 跨午夜的時間以 24 時以後接續表示（例：24:20＝翌日 00:20）`,
    ``,
    `### 出土紀錄`,
    ``,
    `| 次數 | 時間 |`,
    `| --- | --- |`,
    ...(excavation.soil.length ? excavation.soil.map(record => `| ${record.index + 1} | ${markdownCell(record.time30)} |`) : [`| — | 尚無紀錄 |`]),
    ``,
    `### 深度確認`,
    ``,
    `| 次數 | 確認時間 | 深度（m） | 與設計差異（m） |`,
    `| --- | --- | ---: | ---: |`,
    ...(excavation.depth.length ? excavation.depth.map(record => `| ${record.index + 1} | ${markdownCell(record.time30)} | ${markdownCell(record.value)} | ${markdownCell(record.difference)} |`) : [`| — | 尚無紀錄 | — | — |`]),
    ``,
    `## 前置紀錄`,
    ``,
    `| 作業項目 | 作業日期 | 開始時間 | 完成時間 |`,
    `| --- | --- | --- | --- |`,
    ...phaseTable.map(({ phase, record, times }) => `| ${markdownCell(phase.label)} | ${markdownCell(record.date)} | ${markdownCell(times.start)} | ${markdownCell(times.end)} |`),
    ``,
    `## 澆置紀錄`,
    ``,
    `- 澆置日期：${markdownCell(data.pouring.date)}`,
    ``,
    `| 車次 | 車號 | 出廠 | 卸料 | 結束 | 坍度（cm） | 方量（m³） | 累積（m³） | 預估高（m） | 實際高（m） | 澆置時間（分） |`,
    `| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |`,
    ...(trucks.length ? trucks.map(row => `| ${row.index + 1} | ${markdownCell(row.truckNo)} | ${markdownCell(row.dispatch30)} | ${markdownCell(row.unload30)} | ${markdownCell(row.finish30)} | ${markdownCell(row.slumpLabel)} | ${markdownCell(fixed(row.volume))} | ${markdownCell(fixed(row.cumulative))} | ${markdownCell(fixed(row.expected))} | ${markdownCell(fixed(row.measured))} | ${markdownCell(row.minutes)} |`) : [`| — | 尚無紀錄 | — | — | — | — | — | — | — | — | — |`]),
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
    `- 軸線／方向編號：${markdownCell(data.guide_wall_review.axis_no)}`,
    ...data.guide_wall_review.items.map(item => `- ${item.item_no}. ${item.item}：${item.result}；現場紀錄：${markdownCell([item.actual, item.bar_size ? `號數 ${barSizeMark(item.bar_size)}` : "", item.bar_spacing_cm !== null && item.bar_spacing_cm !== undefined ? `間距 ${item.bar_spacing_cm} cm` : ""].filter(Boolean).join("；"))}`),
    ``,
    `## Rebar Cage／鋼筋籠複核`,
    ``,
    `### 配筋明細`,
    ``,
    ...rebarCageMarkdownRows(state.rebarCage),
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
  "放樣": ["放樣與單元中心線", "單元位置與中心線"],
  "地下管線": ["地下管線位置確認"],
  "位置與淨寬": ["導溝寬度／淨寬", "導溝寬度與淨寬", "導溝內面淨寬實測"],
  "深度": ["導溝深度與底高程", "導溝頂高程／深度"],
  "牆厚": ["導溝牆壁厚度"],
  "鋼筋": ["導溝鋼筋號數與間距"],
  "回撐木": ["回撐木配置與間距"],
  "混凝土強度": ["導溝混凝土強度"],
  "頂部基準高程": ["導溝頂基準高程實測"],
  "壁面順直度": ["導溝壁面垂直與順直度", "導溝垂直與壁面完整性"]
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
    reviewer: importText(project.form_filler)
  };
  // 舊版只有一個 construction_date：沒有分頁日期的欄位一律回填它
  const legacyDate = importText(project.construction_date);
  state.dates = {
    excavationStart: importText(excavation.start_date) || legacyDate,
    excavationEnd: importText(excavation.end_date),
    pouring: importText(pouring.date) || legacyDate
  };
  state.wall = {
    unitType: importText(wall.unit_type),
    unitNo: importText(wall.unit_no) || importText(rebarCage.unit_no), // 1.2 以前鋼筋籠自己帶單元編號
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
    return [phase.id, { date: importText(record.date) || legacyDate, start: importText(record.start_time), end: importText(record.finish_time) }];
  }));
  state.trucks = (Array.isArray(pouring.trucks) ? pouring.trucks : []).map(record => ({
    truckNo: importText(record.truck_no),
    dispatch: importText(record.dispatch_time),
    unload: importText(record.unload_time),
    finish: importText(record.finish_time),
    volume: importText(record.volume_m3),
    measured: importText(record.measured_height_m),
    slump: importText(record.slump_cm)
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
    axisNo: importText(guideWall.axis_no),
    reviewer: importText(guideWall.reviewer),
    note: importText(guideWall.note),
    checks: importGuideWallItems(guideWall.items)
  };

  state.rebarCage = {
    date: importText(rebarCage.review_date),
    cageNo: importText(rebarCage.cage_no),
    reviewer: importText(rebarCage.reviewer),
    note: importText(rebarCage.note),
    mode: rebarCage.mode === "detailed" ? "detailed" : "simple",
    parts: importRebarCageParts(rebarCage.parts),   // 1.3 以前的 rebar_items 直接略過
    checks: importChecklistItems(REBAR_CAGE_CHECKS, rebarCage.inspection_items)
  };

  const context = payload.export_context || {};
  const importedTool = ["diaphragmWall", "guideWall", "rebarCage"].includes(context.active_tool) ? context.active_tool : "diaphragmWall";
  const importedTab = TAB_LABELS[context.active_tab] ? context.active_tab : "wall";
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
  showTab("wall");

  document.addEventListener("input", event => {
    if (event.target.matches('input[type="date"], input[type="time"]')) syncDateTimeDisplay(event.target);
    const input = event.target.closest("[data-bind]");
    if (input) {
      const [group, key] = input.dataset.bind.split(".");
      state[group][key] = input.value;
      if (group === "wall") { syncUnitInputs(input); updateWallCalculation(); }
      return;
    }
    const meta = event.target.closest("[data-check-bind]");
    if (meta) {
      const [type, key] = meta.dataset.checkBind.split(".");
      state[type][key] = meta.value;
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

  bindRebarCageUi({ getCage: () => state.rebarCage, onChange: renderRebars });
  draft.watch();

  $$('.tab-row [role="tab"]').forEach(button => {
    button.addEventListener("click", () => showTab(button.dataset.tab));
    button.addEventListener("keydown", event => {
      const tabs = $$('.tab-row [role="tab"]', button.closest("[data-tool-view]"));
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
      dispatch: $("#truck-dispatch").value,
      unload: $("#truck-unload").value,
      finish: $("#truck-finish").value,
      volume: $("#truck-volume").value,
      measured: $("#truck-measured").value,
      slump: $("#truck-slump").value
    };
    if (editIndex.truck === null) state.trucks.push(record);
    else state.trucks[editIndex.truck] = record;
    $("#truck-dialog").close();
    renderPouring();
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
    if (editSoil) openSoilDialog(Number(editSoil.dataset.editSoil));
    else if (deleteSoil) removeRecord("soil", Number(deleteSoil.dataset.deleteSoil));
    else if (editDepth) openDepthDialog(Number(editDepth.dataset.editDepth));
    else if (deleteDepth) removeRecord("depth", Number(deleteDepth.dataset.deleteDepth));
    else if (editTruck) openTruckDialog(Number(editTruck.dataset.editTruck));
    else if (deleteTruck) removeRecord("trucks", Number(deleteTruck.dataset.deleteTruck));
  });

  $("#undo-button").addEventListener("click", () => {
    if (undoAction) undoAction();
    clearTimeout(undoTimer);
    undoAction = null;
    $("#undo-toast").hidden = true;
  });

  showTool("diaphragmWall");
}

const loadedDraft = draft.load() ?? {};
Object.assign(state, loadedDraft);
normalizeLoadedState(loadedDraft);
if (exampleMode) loadExample();
initialize();
