const APP_VERSION = "1.4";

const TAB_LABELS = {
  design: "設計基準",
  hold1: "成槽放行",
  hold2: "吊放放行",
  hold3: "澆置成品",
  result: "監測結論"
};

const TOOL_LABELS = {
  inspection: "連續壁營造廠查驗",
  guideWall: "導溝施工複核",
  rebarCage: "鋼筋籠吊放前複核"
};

const PRINT_TAB_GROUPS = {
  design: "inspection-a",
  hold1: "inspection-a",
  hold2: "inspection-a",
  hold3: "inspection-b",
  result: "inspection-b",
  guideWall: "guideWall",
  rebarCage: "rebarCage"
};

const PRINT_GROUP_LABELS = {
  "inspection-a": "查驗表 1／設計基準＋停檢點 1·2",
  "inspection-b": "查驗表 2／停檢點 3·4＋查驗結論"
};

// 營造廠在現場要快速確認的「本公司標準值」。
// 介面不顯示外部規範名稱；預設值可直接作為公司內部起始值，
// 並保留下拉選單，讓公司日後能依核定施工計畫調整。
const STANDARD_CONFIG = [
  { key: "centerline", label: "放樣中心線偏差上限", unit: "mm", options: ["10", "15", "20", "25", "30"], default: "20" },
  { key: "guideClearMin", label: "導溝淨寬加大下限", unit: "cm", options: ["2", "3", "4"], default: "3" },
  { key: "guideClearMax", label: "導溝淨寬加大上限", unit: "cm", options: ["4", "5", "6", "8"], default: "5" },
  { key: "verticalDenominator", label: "槽壁垂直精度（10／D）", unit: "1/n", options: ["100", "200", "300", "400", "500", "10/D"], default: "300" },
  { key: "deflection", label: "最大偏擺位移上限", unit: "cm", options: ["5", "10", "15", "20"], default: "10" },
  { key: "sediment", label: "孔底沉泥厚度上限", unit: "cm", options: ["5", "10", "15", "20"], default: "15", legacy: ["10"] },
  { key: "slurryDensityMin", label: "穩定液比重下限", unit: "－", options: ["0.95", "1.00", "1.05"], default: "1.00" },
  { key: "slurryDensityMax", label: "穩定液比重上限", unit: "－", options: ["1.05", "1.10", "1.15", "1.20"], default: "1.10" },
  { key: "sandContentBentonite", label: "含砂量上限（皂土系）", unit: "%", options: ["1", "2", "3", "4"], default: "3" },
  { key: "sandContentPolymer", label: "含砂量上限（高分子系）", unit: "%", options: ["0.5", "1", "1.5", "2"], default: "1" },
  { key: "rollerSpacing", label: "保護層護耳縱向間距上限", unit: "m", options: ["3", "4", "5"], default: "3", legacy: ["4"] },
  { key: "cover", label: "土側保護層厚度下限", unit: "cm", options: ["5", "7.5", "10", "12.5"], default: "10", legacy: ["7.5"] },
  { key: "cageTopTolerance", label: "籠頂高程偏差上限", unit: "±cm", options: ["3", "5", "7.5", "10"], default: "5" },
  { key: "slump", label: "混凝土坍度", unit: "cm", options: Array.from({ length: 10 }, (_, i) => String(15 + i)), default: "20", legacy: ["18"] },
  { key: "slumpTolerance", label: "坍度允許誤差", unit: "±cm", options: ["1", "2", "3", "4"], default: "2" },
  { key: "chloride", label: "氯離子含量上限", unit: "kg/m³", options: ["0.15", "0.30"], default: "0.15" },
  { key: "specimenSets", label: "試體取樣組數下限", unit: "組", options: ["1", "2", "3"], default: "1" },
  { key: "tremieInitialMin", label: "初灌管底離底下限", unit: "cm", options: ["5", "10", "15", "30"], default: "30", legacy: ["10"] },
  { key: "tremieInitialMax", label: "初灌管底離底上限", unit: "cm", options: ["20", "25", "30", "50"], default: "50", legacy: ["20"] },
  { key: "tremieEmbedBentonite", label: "管底埋深下限（皂土系）", unit: "m", options: ["1.5", "2.0", "2.5"], default: "2.0" },
  { key: "tremieEmbedPolymer", label: "管底埋深下限（高分子系）", unit: "m", options: ["1.0", "1.5", "2.0"], default: "1.5" },
  { key: "overbreakMin", label: "合理超方率下限", unit: "%", options: ["-5", "0", "3", "5"], default: "-5", legacy: ["5"] },
  { key: "overbreakMax", label: "合理超方率上限", unit: "%", options: ["5", "10", "15", "20"], default: "5", legacy: ["15"] },
  { key: "overpourMin", label: "壁頂超打高度下限", unit: "m", options: ["0.5", "0.8", "1.0"], default: "0.5" }
];

const STANDARD_DEFAULTS = Object.fromEntries(STANDARD_CONFIG.map(item => [item.key, item.default]));

// 穩定液種類會切換兩組標準值，未選擇前兩組都可調整。
const SLURRY_KEYS = {
  "皂土系": { sandContent: "sandContentBentonite", tremieEmbed: "tremieEmbedBentonite" },
  "高分子系": { sandContent: "sandContentPolymer", tremieEmbed: "tremieEmbedPolymer" }
};
const SLURRY_DEPENDENT = ["sandContentBentonite", "sandContentPolymer", "tremieEmbedBentonite", "tremieEmbedPolymer"];

function verticalPrecisionFromDepth(depthValue) {
  const depth = Number.parseFloat(depthValue);
  if (!Number.isFinite(depth) || depth === 0) return null;
  const depthCm = Math.abs(depth) * 100;
  return { depthCm, ratio: 10 / depthCm, denominator: depthCm / 10 };
}

function verticalPrecision() {
  return verticalPrecisionFromDepth(state.unit.designDepth);
}

function selectedVerticalPrecision() {
  return state.standards.verticalDenominator === "10/D" ? verticalPrecision() : null;
}

function effectiveVerticalDenominator() {
  const precision = selectedVerticalPrecision();
  return precision ? precision.denominator : number(state.standards.verticalDenominator);
}

function verticalityStandardText() {
  const selected = state.standards.verticalDenominator || "300";
  if (selected !== "10/D") return `垂直斜率 ≤ 1/${selected}`;
  const precision = selectedVerticalPrecision();
  if (!precision) return "垂直斜率 ≤ 10 / D（D 為連續壁深度，單位 cm；請先填設計深度）";
  return `垂直斜率 ≤ 10 / ${precision.depthCm.toFixed(0)} = ${precision.ratio.toFixed(5)}（約 1/${precision.denominator.toFixed(1)}）`;
}

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
const STRENGTH_UNITS = ["kgf/cm²", "psi"];
const STRENGTH_PLACEHOLDER = { "kgf/cm²": "例如：350", "psi": "例如：5000" };
const strengthUnit = () => STRENGTH_UNITS.includes(state.unit.strengthUnit) ? state.unit.strengthUnit : STRENGTH_UNITS[0];


const REBAR_CAGE_CHECKS = [
  ["籠號與單元對應", "籠號、單元號與核定配筋圖一致"],
  ["籠體幾何尺寸", "長度、寬度、厚度與圖說相符"],
  ["接頭、搭接與續接器", "位置、長度與電銲符合施工規範"],
  ["保護層護耳", "數量、間距及固定方式可確保保護層"],
  ["吊點、吊具及臨時補強", "吊點、吊筋、桁架及補強可安全吊放"],
  ["接頭構件與止水板", "止水板、接頭鋼板位置依圖說且完好無破損"],
  ["預埋筋及構件位置與高程", "梁柱預埋筋、預留開口箱經實測核對"],
  ["壁體監測儀器預埋", "傾度管固定水密並注滿清水；鋼筋計成對安裝且線路受保護"],
  ["外觀與吊放前狀態", "無顯著變形、鬆脫、污染或妨礙吊放之雜物"]
];

const $ = selector => document.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const number = value => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const fixed = value => Number.isFinite(value) ? value.toFixed(2) : "";
const signed = value => Number.isFinite(value) ? `${value >= 0 ? "+" : ""}${value.toFixed(2)}` : "";
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

const S = key => number(state.standards[key]);
const slurryStandard = base => {
  const mapped = SLURRY_KEYS[state.unit.slurryType];
  return mapped ? state.standards[mapped[base]] : null;
};

// 每個停檢點的查驗項目。standard 回傳判定標準文字（含自動換算結果），
// evaluate 回傳警示文字；兩者都拿得到現行標準值與設計基準。
const HOLD_POINTS = [
  {
    id: "hold1",
    badge: "停檢點1",
    release: "成槽放行",
    title: "導溝放樣與成槽洗孔檢驗",
    items: [
      {
        key: "centerline", item: "單元放樣中心線偏差", mode: "number", unit: "mm", placeholder: "例如：12",
        standard: () => `≤ ${state.standards.centerline} mm，由營造廠測量人員親自實測複核`,
        evaluate: value => value !== null && S("centerline") !== null && value > S("centerline")
          ? `中心線偏差 ${value} mm，超出標準 ${state.standards.centerline} mm`
          : null
      },
      {
        key: "guideClear", item: "導溝內面淨寬實測", mode: "number", unit: "cm", placeholder: "例如：105",
        standard: () => {
          const thickness = number(state.unit.thickness);
          const lo = S("guideClearMin");
          const hi = S("guideClearMax");
          if (thickness === null) return `壁厚 +${state.standards.guideClearMin}～${state.standards.guideClearMax} cm 且壁面垂直`;
          return `${(thickness * 100 + lo).toFixed(1)}～${(thickness * 100 + hi).toFixed(1)} cm（壁厚 +${state.standards.guideClearMin}～${state.standards.guideClearMax} cm）`;
        },
        evaluate: value => {
          const thickness = number(state.unit.thickness);
          if (value === null || thickness === null) return null;
          const lo = thickness * 100 + S("guideClearMin");
          const hi = thickness * 100 + S("guideClearMax");
          if (value < lo) return `淨寬 ${value} cm 小於容許下限 ${lo.toFixed(1)} cm`;
          if (value > hi) return `淨寬 ${value} cm 大於容許上限 ${hi.toFixed(1)} cm`;
          return null;
        }
      },
      {
        key: "finalDepth", item: "槽溝最終實測深度", mode: "number", unit: "GL, m", placeholder: "例如：-39.80",
        standard: value => {
          const design = number(state.unit.designDepth);
          if (design === null) return "以測錘實測槽溝底最頂部深度，須達設計深度且超挖不超過 50 cm";
          const base = `設計 GL ${fixed(design)} m`;
          if (value === null) return `${base}；以測錘實測並簽認，超挖不超過 0.5 m`;
          return `${base}；實測差異 ${signed(Math.abs(value) - Math.abs(design))} m`;
        },
        evaluate: value => {
          const design = number(state.unit.designDepth);
          if (value === null || design === null) return null;
          const short = Math.abs(design) - Math.abs(value);
          if (short > 0) return `實測深度較設計淺 ${short.toFixed(2)} m，未達設計深度`;
          return short < -0.5 ? `超挖 ${(-short).toFixed(2)} m，超過 0.5 m 上限` : null;
        }
      },
      {
        key: "verticality", item: "超音波槽壁垂直度", mode: "number", unit: "1/n", placeholder: "例如：420",
        standard: () => `${verticalityStandardText()}（填入斜率分母 n）`,
        evaluate: value => value !== null && effectiveVerticalDenominator() !== null && value < effectiveVerticalDenominator()
          ? `垂直斜率 1/${value} 劣於標準約 1/${effectiveVerticalDenominator().toFixed(1)}`
          : null
      },
      {
        key: "deflection", item: "槽壁最大偏擺位移", mode: "number", unit: "cm", placeholder: "例如：6.5",
        standard: () => `≤ ${state.standards.deflection} cm，由營造廠審核超音波掃描圖並簽認`,
        evaluate: value => value !== null && S("deflection") !== null && value > S("deflection")
          ? `最大偏擺 ${value} cm，超出標準 ${state.standards.deflection} cm`
          : null
      },
      {
        key: "sediment", item: "孔底沉泥厚度", mode: "number", unit: "cm", placeholder: "例如：6",
        standard: () => `≤ ${state.standards.sediment} cm，洗孔靜置後、特密管下放前量測`,
        evaluate: value => value !== null && S("sediment") !== null && value > S("sediment")
          ? `沉泥厚度 ${value} cm 超出標準，須二次清孔後始得澆置`
          : null
      },
      {
        key: "jointBrush", item: "相鄰單元接縫端板刷洗", mode: "text", placeholder: "例如：鋼刷 2 道，泥膜已清除，止水板完好",
        standard: () => "以鋼刷或高壓水刀貫穿刷洗，徹底清除淤積泥膜；止水板完好無破損",
        evaluate: () => null
      }
    ]
  },
  {
    id: "hold2",
    badge: "停檢點2",
    release: "吊放放行",
    title: "鋼筋籠組裝、預埋件與吊放檢驗",
    items: [
      {
        key: "drawingNo", item: "配筋規格核對（核定圖號）", mode: "text", placeholder: "例如：S-21 Rev.C",
        standard: () => "與核定配筋圖說相符；逐項抽查明細另填鋼筋籠複核表",
        evaluate: () => null
      },
      {
        key: "lapWeldLength", item: "上下段搭接長度與電銲長度檢核", mode: "text", placeholder: "例如：搭接與電銲長度符合",
        standard: () => "滿足設計規範或圖面",
        evaluate: () => null
      },
      {
        key: "rollerSpacing", item: "保護層護耳", mode: "number", unit: "m", placeholder: "例如：3.5",
        standard: () => `縱向每 ${state.standards.rollerSpacing} m 以內設保護層護耳；土側保護層 ≥ ${state.standards.cover} cm`,
        evaluate: value => value !== null && S("rollerSpacing") !== null && value > S("rollerSpacing")
          ? `保護層護耳間距 ${value} m 超出標準 ${state.standards.rollerSpacing} m，吊放時恐脫落`
          : null
      },
      {
        key: "embedBeam", item: "梁柱預埋筋位置與高程", mode: "text", placeholder: "例如：GL-2.10 m，位置無誤",
        standard: () => "現場實測位置與高程，避免開挖後大量植筋",
        evaluate: () => null
      },
      {
        key: "embedOpening", item: "預留開口箱位置與高程", mode: "text", placeholder: "例如：無設置／位置無誤",
        standard: () => "預留開口箱位置與高程依核定圖說，並確認固定牢固",
        evaluate: () => null
      },
      {
        key: "inclinometer", item: "壁體內傾度管／完整性檢測管", mode: "text", placeholder: "例如：已注滿清水，接頭水密",
        standard: () => "筆直固定、接頭水密、管內注滿清水防浮",
        evaluate: () => null
      },
      {
        key: "strainGauge", item: "鋼筋計安裝與線路防護", mode: "text", placeholder: "例如：3 組成對，引線已保護",
        standard: () => "成對安裝、編號正確，引線保護至孔口",
        evaluate: () => null
      },
      {
        key: "cageTop", item: "鋼筋籠吊放頂高程", mode: "number", unit: "GL, m", placeholder: "例如：-0.53",
        standard: value => {
          const design = number(state.unit.topElevation);
          const tolerance = state.standards.cageTopTolerance;
          if (design === null) return `高程偏差 ≤ ±${tolerance} cm`;
          const base = `設計 GL ${fixed(design)} m，偏差 ≤ ±${tolerance} cm`;
          if (value === null) return base;
          return `${base}；實測偏差 ${signed((value - design) * 100)} cm`;
        },
        evaluate: value => {
          const design = number(state.unit.topElevation);
          const tolerance = S("cageTopTolerance");
          if (value === null || design === null || tolerance === null) return null;
          const diff = (value - design) * 100;
          return Math.abs(diff) > tolerance
            ? `籠頂高程偏差 ${signed(diff)} cm，超出 ±${state.standards.cageTopTolerance} cm，須調整吊筋長度`
            : null;
        }
      },
      {
        key: "slurryDensity", item: "澆置前穩定液比重", mode: "number", unit: "－", placeholder: "例如：1.05",
        standard: () => `${state.standards.slurryDensityMin}～${state.standards.slurryDensityMax}`,
        evaluate: value => {
          if (value === null) return null;
          if (value < S("slurryDensityMin")) return `比重 ${value} 低於下限 ${state.standards.slurryDensityMin}`;
          if (value > S("slurryDensityMax")) return `比重 ${value} 高於上限 ${state.standards.slurryDensityMax}`;
          return null;
        }
      },
      {
        key: "sandContent", item: "澆置前穩定液含砂量", mode: "number", unit: "%", placeholder: "例如：1.8",
        standard: () => {
          const limit = slurryStandard("sandContent");
          return limit
            ? `≤ ${limit}%（${state.unit.slurryType}）`
            : `皂土系 ≤ ${state.standards.sandContentBentonite}%／高分子系 ≤ ${state.standards.sandContentPolymer}%`;
        },
        evaluate: value => {
          const limit = number(slurryStandard("sandContent"));
          return value !== null && limit !== null && value > limit
            ? `含砂量 ${value}% 超出 ${state.unit.slurryType} 上限 ${limit}%`
            : null;
        }
      }
    ]
  },
  {
    id: "hold3",
    badge: "停檢點3",
    release: "澆置完成",
    title: "特密混凝土澆置與成品檢驗",
    items: [
      {
        key: "slump", item: "新拌混凝土實測坍度", mode: "number", unit: "cm", placeholder: "例如：20",
        standard: () => `${state.standards.slump} ± ${state.standards.slumpTolerance} cm，每單元第一車與中段抽驗`,
        evaluate: value => {
          const target = S("slump");
          const tolerance = S("slumpTolerance");
          if (value === null || target === null || tolerance === null) return null;
          return Math.abs(value - target) > tolerance
            ? `坍度 ${value} cm 超出 ${state.standards.slump}±${state.standards.slumpTolerance} cm`
            : null;
        }
      },
      {
        key: "chloride", item: "氯離子含量", mode: "number", unit: "kg/m³", placeholder: "例如：0.08",
        standard: () => `≤ ${state.standards.chloride} kg/m³`,
        evaluate: value => value !== null && S("chloride") !== null && value > S("chloride")
          ? `氯離子 ${value} kg/m³ 超出上限 ${state.standards.chloride} kg/m³`
          : null
      },
      {
        key: "specimenSets", item: "抗壓強度試體取樣組數", mode: "number", unit: "組", placeholder: "例如：1",
        standard: () => `每單元至少 ${state.standards.specimenSets} 組（7、28 天齡期），每增 100 m³ 加 1 組（每組 5 顆或依合約），送第三方實驗室`,
        evaluate: value => value !== null && S("specimenSets") !== null && value < S("specimenSets")
          ? `取樣 ${value} 組，少於每單元 ${state.standards.specimenSets} 組`
          : null
      },
      {
        key: "specimenNo", item: "試體編號與送驗單位", mode: "text", placeholder: "例如：DW21-01～05／○○試驗室",
        standard: () => "記錄試體編號與送驗單位，供強度追蹤",
        evaluate: () => null
      },
      {
        key: "tremieInitial", item: "特密管初灌管底離底距離", mode: "number", unit: "cm", placeholder: "例如：15",
        standard: () => `${state.standards.tremieInitialMin}～${state.standards.tremieInitialMax} cm，並於漏斗內置入栓塞（橡皮碗）`,
        evaluate: value => {
          if (value === null) return null;
          if (value < S("tremieInitialMin")) return `初灌離底 ${value} cm，小於下限 ${state.standards.tremieInitialMin} cm`;
          if (value > S("tremieInitialMax")) return `初灌離底 ${value} cm，大於上限 ${state.standards.tremieInitialMax} cm`;
          return null;
        }
      },
      {
        key: "tremieEmbed", item: "澆置中管底埋入深度", mode: "number", unit: "m", placeholder: "例如：2.4",
        standard: () => {
          const limit = slurryStandard("tremieEmbed");
          return limit
            ? `≥ ${limit} m（${state.unit.slurryType}），防止斷樁拔脫`
            : `皂土系 ≥ ${state.standards.tremieEmbedBentonite} m／高分子系 ≥ ${state.standards.tremieEmbedPolymer} m`;
        },
        evaluate: value => {
          const limit = number(slurryStandard("tremieEmbed"));
          return value !== null && limit !== null && value < limit
            ? `管底埋深 ${value} m 小於 ${state.unit.slurryType} 下限 ${limit} m，有斷樁風險`
            : null;
        }
      },
      {
        key: "pourWindow", item: "澆置起訖時間", mode: "text", placeholder: "例如：13:20～16:30",
        standard: () => "單元澆置應連續進行，記錄起訖時間",
        evaluate: () => null
      },
      {
        key: "actualVolume", item: "實際澆置總方量", mode: "number", unit: "m³", placeholder: "例如：96.20",
        standard: value => {
          const designVolume = calculatedDesignVolume();
          const rate = value => `${Number(value) >= 0 ? "+" : ""}${value}%`;
          const range = `合理超方率 ${rate(state.standards.overbreakMin)} ～ ${rate(state.standards.overbreakMax)}`;
          if (designVolume === null) return `${range}（請先於設計基準填入壁厚、長度與高程）`;
          const base = `設計 ${fixed(designVolume)} m³；${range}`;
          if (value === null) return base;
          return `${base}；實測超方率 ${signed((value - designVolume) / designVolume * 100)}%`;
        },
        evaluate: value => {
          const designVolume = calculatedDesignVolume();
          if (value === null || designVolume === null || designVolume === 0) return null;
          const rate = (value - designVolume) / designVolume * 100;
          if (rate < S("overbreakMin")) return `超方率 ${signed(rate)}%，低於合理下限，須確認縮頸或夾泥`;
          if (rate > S("overbreakMax")) return `超方率 ${signed(rate)}%，高於合理上限，須列為開挖重點觀察單元`;
          return null;
        }
      },
      {
        key: "pourTop", item: "實打混凝土頂面高程", mode: "number", unit: "GL, m", placeholder: "例如：+0.30",
        standard: value => {
          const design = number(state.unit.topElevation);
          const limit = state.standards.overpourMin;
          if (design === null) return `澆置至設計高程並超打 ≥ ${limit} m，硬化後打除劣質層`;
          const base = `設計頂 GL ${fixed(design)} m；超打 ≥ ${limit} m，硬化後打除劣質層`;
          if (value === null) return base;
          return `${base}；實測超打 ${fixed(value - design)} m`;
        },
        evaluate: value => {
          const design = number(state.unit.topElevation);
          const limit = S("overpourMin");
          if (value === null || design === null || limit === null) return null;
          const over = value - design;
          return over < limit
            ? `超打高度 ${fixed(over)} m 不足 ${state.standards.overpourMin} m，劣質層恐無法完全打除`
            : null;
        }
      }
    ]
  },
  {
    id: "hold4",
    badge: "停檢點4",
    release: "環境監測",
    title: "連續壁施工期周邊環境監測查核",
    items: [
      {
        key: "settlement", item: "鄰房沉陷與傾斜觀測", mode: "text", placeholder: "例如：最大沉陷 3.2 mm，在注意值內",
        standard: () => "施工期間每週至少 1 次；單元施工前後數值均應在注意值內且無異常突變",
        evaluate: () => null
      },
      {
        key: "groundwater", item: "基地外地下水位觀測", mode: "text", placeholder: "例如：水位 GL-4.8 m，無異常洩降",
        standard: () => "施工期間每週至少 1 次；成槽掘削時無泥漿大量滲漏或水位突洩",
        evaluate: () => null
      }
    ]
  }
];

const HOLD_BY_ID = Object.fromEntries(HOLD_POINTS.map(hold => [hold.id, hold]));

const ATTACHMENTS = [
  "【附件一】槽溝超音波測壁垂直度檢測成果圖",
  "【附件二】專業廠商逐車混凝土澆置日誌與高度曲線圖",
  "【附件三】預拌混凝土出廠送貨單與品質保證書"
];

const localDate = new Date();
const today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;

const emptyHolds = () => Object.fromEntries(HOLD_POINTS.map(hold => [
  hold.id,
  hold.items.map(() => ({ actual: "", result: "待確認" }))
]));

const state = {
  overview: { project: "", contractor: "", reviewer: "" },
  // 四個停檢點分別在不同時間查驗，各自有查驗日期（hold4＝監測結論）
  holdDates: { hold1: today, hold2: today, hold3: today, hold4: today },
  unit: {
    unitType: "",
    unitNo: "",
    sequenceNo: "",
    slurryType: "",
    guideTopElevation: "",
    strength: "",
    strengthUnit: "kgf/cm²",
    thickness: "",
    length: "",
    designDepth: "",
    topElevation: "",
    designVolume: ""
  },
  standards: { ...STANDARD_DEFAULTS },
  holds: emptyHolds(),
  conclusion: { verdict: "待判定", note: "" },
  // 工程名稱／施工廠商／查驗人由 overview 統一持有，導溝與鋼筋籠共用，不再各自複製一份。
  // 單元編號只存在 unit：鋼筋籠與壁體是同一個單元，直接帶入；導溝是全區同一種配筋與尺寸的統一檢查，不分單元。
  guideWall: {
    date: today, axisNo: "", note: "",
    checks: GUIDE_WALL_CHECKS.map(createGuideWallCheck)
  },
  rebarCage: {
    date: today, cageNo: "", drawingNo: "", note: "",
    mode: "simple",
    parts: createRebarCageParts(),
    checks: REBAR_CAGE_CHECKS.map(([item, standard]) => ({ item, standard, actual: "", result: "待確認" })),
    photos: []
  }
};

// 本機草稿（共用 draft.js）：啟動時還原、輸入時去抖寫入、「清空」時刪除。
const exampleMode = new URLSearchParams(location.search).get("example") === "1";
const draft = createDraftStore("project-portal.diaphragmWallGc.draft", () => state, { enabled: !exampleMode });

function normalizeHoldResult(value) {
  return ["待確認", "符合", "不符合", "不適用"].includes(value) ? value : "待確認";
}

function normalizeHoldRecord(record) {
  return {
    actual: String(record?.actual ?? ""),
    result: normalizeHoldResult(record?.result)
  };
}

function normalizeHoldRecords(loadedHolds = {}) {
  const normalized = emptyHolds();
  const copySequential = (holdId, source = []) => {
    normalized[holdId] = normalized[holdId].map((record, index) => normalizeHoldRecord(source[index] || record));
  };

  const hold1 = Array.isArray(loadedHolds.hold1) ? loadedHolds.hold1 : [];
  const hold2 = Array.isArray(loadedHolds.hold2) ? loadedHolds.hold2 : [];
  const hold3 = Array.isArray(loadedHolds.hold3) ? loadedHolds.hold3 : [];
  const hold4 = Array.isArray(loadedHolds.hold4) ? loadedHolds.hold4 : [];

  if (hold1.length > normalized.hold1.length) {
    [0, 1, 2, 3, 4, 5].forEach(index => { normalized.hold1[index] = normalizeHoldRecord(hold1[index]); });
    normalized.hold1[6] = normalizeHoldRecord(hold1[8]);
    [0, 1, 2, 3].forEach(index => { normalized.hold2[index] = normalizeHoldRecord(hold2[index]); });
    normalized.hold2[4] = normalizeHoldRecord(hold2[5]);
    normalized.hold2[5] = normalizeHoldRecord(hold2[6]);
    normalized.hold2[6] = normalizeHoldRecord(hold2[7]);
    normalized.hold2[7] = normalizeHoldRecord(hold2[8]);
    normalized.hold2[8] = normalizeHoldRecord(hold1[6]);
    normalized.hold2[9] = normalizeHoldRecord(hold1[7]);
  } else {
    copySequential("hold1", hold1);
    copySequential("hold2", hold2);
  }

  if (hold3.length > normalized.hold3.length) {
    [0, 1, 2, 3, 4, 5, 6].forEach(index => { normalized.hold3[index] = normalizeHoldRecord(hold3[index]); });
    normalized.hold3[7] = normalizeHoldRecord(hold3[8]);
    normalized.hold3[8] = normalizeHoldRecord(hold3[9]);
  } else {
    copySequential("hold3", hold3);
  }
  copySequential("hold4", hold4);

  return normalized;
}

// 舊草稿補齊新欄位：舊版單一「查驗日期」搬到四個停檢點；品管主任欄已移除。
function normalizeLoadedState(loaded) {
  const legacyDate = state.overview.date;
  if (legacyDate && !loaded.holdDates) state.holdDates = Object.fromEntries(HOLD_POINTS.map(hold => [hold.id, legacyDate]));
  delete state.overview.date;
  delete state.overview.manager;
  // 1.2 以前導溝、鋼筋籠各自存一份單元編號；鋼筋籠那份與壁體同單元，壁體沒填時拿來補上
  state.unit.unitNo ||= state.rebarCage.unitNo || "";
  delete state.guideWall.unitNo;
  delete state.rebarCage.unitNo;
  // 1.4 以前的草稿：配筋抽查是自由列表 rebars；改成 13 個固定部位後直接重設，模式從簡易開始
  state.rebarCage.mode = state.rebarCage.mode === "detailed" ? "detailed" : "simple";
  state.rebarCage.parts = normalizeRebarCageParts(state.rebarCage.parts);
  delete state.rebarCage.rebars;
  state.holds = normalizeHoldRecords(loaded.holds || state.holds);
  // 本公司標準值預設改版（沉泥、護耳、保護層、坍度、初灌、超方率）：舊草稿仍是舊預設的項目換成新預設
  state.standards = mergeStandardDefaults(state.standards, STANDARD_CONFIG);
  // 複核項目文字以程式定義為準：判定標準改版後，舊草稿只留使用者填的值
  state.guideWall.checks = refreshCheckItems(state.guideWall.checks, GUIDE_WALL_CHECKS.map(createGuideWallCheck));
  state.rebarCage.checks = refreshCheckItems(state.rebarCage.checks, REBAR_CAGE_CHECKS.map(([item, standard]) => ({ item, standard, actual: "", result: "待確認" })));
  // 1.6：鋼筋籠照片（最多 3 張 data URL）
  state.rebarCage.photos = normalizeCagePhotos(state.rebarCage.photos);
  // 1.6：混凝土強度加單位（舊草稿一律 kgf/cm²）
  if (!STRENGTH_UNITS.includes(state.unit.strengthUnit)) state.unit.strengthUnit = STRENGTH_UNITS[0];
}

let activeTab = "design";
let activeTool = "inspection";
let undoTimer;
let undoAction = null;

const formatDateDisplay = value => {
  const [y, m, d] = String(value ?? "").split("-");
  return y && m && d ? `${y}/${m}/${d}` : "";
};

function syncDateTimeDisplay(input) {
  const wrap = input.closest(".native-field-wrap");
  const target = wrap ? wrap.querySelector(".native-field-display") : null;
  if (!target) return;
  const value = input.value;
  target.classList.toggle("is-empty", !value);
  target.textContent = value
    ? (input.type === "date" ? formatDateDisplay(value) : value)
    : (input.type === "date" ? "尚未選擇日期" : "尚未選擇時間");
}

function syncAllDateTimeDisplays() {
  $$('input[type="date"], input[type="time"]').forEach(syncDateTimeDisplay);
}

function designHeight() {
  const depth = number(state.unit.designDepth);
  const elevation = number(state.unit.topElevation);
  if (depth === null || elevation === null) return null;
  // Accept both a positive downward depth (e.g. 35.8) and a signed GL level (e.g. -39.5).
  return Math.max(0, depth < 0 ? elevation - depth : depth + elevation);
}

function calculatedDesignVolume() {
  const height = designHeight();
  const thickness = number(state.unit.thickness);
  const length = number(state.unit.length);
  if (height === null || thickness === null || length === null) return null;
  return height * thickness * length;
}

function holdItemValue(holdId, index) {
  const definition = HOLD_BY_ID[holdId].items[index];
  const record = state.holds[holdId][index];
  return definition.mode === "number" ? number(record.actual) : null;
}

function holdItemStandard(holdId, index) {
  const definition = HOLD_BY_ID[holdId].items[index];
  return definition.standard(holdItemValue(holdId, index));
}

function holdItemWarning(holdId, index) {
  const definition = HOLD_BY_ID[holdId].items[index];
  return definition.evaluate(holdItemValue(holdId, index));
}

function setInitialInputs() {
  $$('[data-bind]').forEach(input => {
    const [group, key] = input.dataset.bind.split(".");
    if (input.type === "radio") input.checked = state[group][key] === input.value;
    else input.value = state[group][key] ?? "";
  });
}

const wallUnitLabel = () => [state.unit.unitType, state.unit.unitNo].filter(Boolean).join("｜");
// 連續壁與鋼筋籠分頁的單元／順序編號綁同一份資料：任一邊輸入就把另一邊同步
function syncUnitInputs(source = null) {
  $$('[data-bind="unit.unitNo"], [data-bind="unit.sequenceNo"]').forEach(input => {
    if (input === source) return;
    const key = input.dataset.bind.split(".")[1];
    input.value = state.unit[key] ?? "";
  });
}

function updateUnitCalculation() {
  const height = designHeight();
  const volume = calculatedDesignVolume();
  state.unit.designVolume = volume === null ? "" : volume.toFixed(2);
  const volumeInput = $('[data-bind="unit.designVolume"]');
  if (volumeInput) volumeInput.value = state.unit.designVolume;
  const heightInput = $("#design-height-value");
  if (heightInput) heightInput.value = height === null ? "" : height.toFixed(2);
  const strengthInput = $('[data-bind="unit.strength"]');
  if (strengthInput) strengthInput.placeholder = STRENGTH_PLACEHOLDER[strengthUnit()];
  renderStandards();
  HOLD_POINTS.forEach(hold => renderHold(hold.id));
}

function currentExportLabel(tool = activeTool, tab = activeTab) {
  if (tool === "inspection") return PRINT_GROUP_LABELS[PRINT_TAB_GROUPS[tab]] || TAB_LABELS[tab];
  return TOOL_LABELS[tool];
}

// 分頁只在自己所屬的工具區塊（[data-tool-view]）內切換；inspection 以外的工具（鋼筋籠）也有自己的分頁列。
function showTab(tab, focusPanel = false) {
  const view = $(`[role="tab"][data-tab="${tab}"]`)?.closest("[data-tool-view]");
  if (!view) return;
  $$(".tab-panel", view).forEach(panel => { panel.hidden = panel.id !== `panel-${tab}`; });
  $$('[role="tab"]', view).forEach(button => {
    const selected = button.dataset.tab === tab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  if (view.dataset.toolView === "inspection") activeTab = tab; // 匯出標籤在開啟匯出對話框時才重算
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

function standardOptions(selected, options) {
  return options.map(value => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(value)}</option>`).join("");
}

function renderStandards() {
  const mapped = SLURRY_KEYS[state.unit.slurryType];
  const activeKeys = mapped ? Object.values(mapped) : [];
  $("#standard-list").innerHTML = STANDARD_CONFIG.map(config => {
    const disabled = mapped && SLURRY_DEPENDENT.includes(config.key) && !activeKeys.includes(config.key);
    return `<label class="quality-standard-field ${disabled ? "is-disabled" : ""}">
      <span>${esc(config.label)}（${esc(config.unit)}）</span>
      <select data-standard="${esc(config.key)}" ${disabled ? "disabled" : ""}>${standardOptions(state.standards[config.key], config.options)}</select>
    </label>`;
  }).join("");
  $("#standard-note").textContent = mapped
    ? `目前穩定液種類：${state.unit.slurryType}；僅套用此種類的含砂量與管底埋深標準。`
    : "請先在上方選擇穩定液種類；未選擇前皂土系與高分子系兩組標準均可調整，且不進行自動判定。";
}

function renderHold(holdId) {
  const hold = HOLD_BY_ID[holdId];
  const target = $(`#${holdId}-check-list`);
  if (!target) return;
  const warnings = [];
  target.innerHTML = hold.items.map((definition, index) => {
    const record = state.holds[holdId][index];
    const warning = holdItemWarning(holdId, index);
    if (warning) warnings.push({ index, warning });
    const failed = record.result === "不符合" || Boolean(warning);
    const unitSuffix = definition.unit ? `（${esc(definition.unit)}）` : "";
    const inputType = definition.mode === "number" ? "number" : "text";
    const numericAttrs = definition.mode === "number" ? ' step="0.01" inputmode="decimal"' : "";
    return `
    <article class="check-card ${failed ? "is-failed" : ""}">
      <div class="check-card-head"><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(definition.item)}</strong></div>
      <p>${esc(holdItemStandard(holdId, index))}${warning ? `<br /><strong>警示：${esc(warning)}</strong>` : ""}</p>
      <div class="check-card-fields">
        <label class="field"><span>現場紀錄／實測${unitSuffix}</span><input type="${inputType}"${numericAttrs} value="${esc(record.actual)}" placeholder="${esc(definition.placeholder || "")}" data-hold="${holdId}" data-hold-index="${index}" data-hold-field="actual" /></label>
        <div class="field result-field"><span id="hold-${holdId}-${index}-result-label">查驗結果</span>${resultSegmented(`hold-${holdId}-${index}-result`, record.result, `data-hold="${holdId}" data-hold-index="${index}" data-hold-field="result"`)}</div>
      </div>
    </article>`;
  }).join("");

  const completed = state.holds[holdId].filter(record => record.result !== "待確認").length;
  const progress = $(`#${holdId}-progress`);
  const pending = $(`#${holdId}-pending`);
  if (progress) progress.textContent = `${completed} / ${hold.items.length}`;
  if (pending) pending.textContent = String(hold.items.length - completed);

  const warningBox = $(`#${holdId}-warnings`);
  if (warningBox) {
    warningBox.innerHTML = warnings.map(({ index, warning }) =>
      `<div class="warning-item"><strong>第 ${String(index + 1).padStart(2, "0")} 項：</strong>${esc(warning)}</div>`).join("");
  }
}

function renderCheckCards(type) {
  const domPrefix = { guideWall: "guide-wall", rebarCage: "rebar-cage" }[type] || type;
  const target = $(`#${domPrefix}-check-list`);
  target.innerHTML = state[type].checks.map((check, index) => `
    <article class="check-card ${check.result === "不符合" ? "is-failed" : ""}">
      <div class="check-card-head"><span>${String(index + 1).padStart(2, "0")}</span><strong>${esc(check.item)}</strong></div>
      <p>${standardHtml(check.standard)}</p>
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
  renderCagePhotos(cage.photos || []);
}

function setChecklistInputs() {
  $$('[data-check-bind]').forEach(input => {
    const [type, key] = input.dataset.checkBind.split(".");
    input.value = state[type][key] ?? "";
  });
}

function renderAttachmentNote() {
  $("#attachment-note").innerHTML = `<div class="warning-item"><strong>本表必附專業分包商紀錄附件：</strong>${ATTACHMENTS.map(esc).join("／")}</div>`;
}

function renderAll() {
  syncUnitInputs();
  updateUnitCalculation();
  renderStandards();
  setChecklistInputs();
  renderCheckCards("guideWall");
  renderCheckCards("rebarCage");
  renderRebars();
  renderAttachmentNote();
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
  state.holdDates = { hold1: "2026-08-10", hold2: "2026-08-11", hold3: "2026-08-11", hold4: "2026-08-12" };
  Object.assign(state.unit, { unitType: "公母單元", unitNo: "21", sequenceNo: "03", slurryType: "皂土系", guideTopElevation: "0.15", strength: "350", strengthUnit: "kgf/cm²", thickness: "1.00", length: "2.80", designDepth: "-35.80", topElevation: "-0.50", designVolume: "98.84" });
  state.holds = Object.fromEntries(HOLD_POINTS.map((hold, holdIndex) => [hold.id, hold.items.map((definition, index) => ({ actual: holdIndex === 2 && index === 7 ? "102.26 m³；超方約 3.46%" : holdIndex === 0 && index === 0 ? "12 mm" : holdIndex === 2 && index === 0 ? "20 cm" : "已確認", result: "符合" }))]));
  state.conclusion = { verdict: "合格放行", note: "各停檢點均完成查驗，相關專業分包商紀錄列入附件保存。" };
  state.guideWall = { date: "2026-08-10", axisNo: "X3～X7 南側", note: "中心線偏差 1.6 cm；導溝施工條件符合。", checks: GUIDE_WALL_CHECKS.map(([item, standard], index) => ({ item, standard, actual: index === 0 ? "中心線偏差 1.6 cm" : "已確認", barNo: index === 5 ? "D16" : "", barSpacing: index === 5 ? "19.5" : "", result: "符合" })) };
  state.rebarCage = { date: "2026-08-10", cageNo: "C21-U／C21-L", drawingNo: "S-21 Rev.C", note: "配筋圖逐項核對；吊放條件完成。", mode: "detailed", parts: exampleRebarCageParts(), checks: REBAR_CAGE_CHECKS.map(([item, standard], index) => ({ item, standard, actual: index === 7 ? "3 組成對安裝；線路已保護至孔口" : "已確認", result: "符合" })), photos: [] };
}

function clearAllData() {
  draft.clear();
  state.overview = { project: "", contractor: "", reviewer: "" };
  state.holdDates = { hold1: "", hold2: "", hold3: "", hold4: "" };
  state.unit = {
    unitType: "", unitNo: "", sequenceNo: "", slurryType: "", guideTopElevation: "", strength: "", strengthUnit: "kgf/cm²",
    thickness: "", length: "", designDepth: "", topElevation: "", designVolume: ""
  };
  state.standards = { ...STANDARD_DEFAULTS };
  state.holds = emptyHolds();
  state.conclusion = { verdict: "待判定", note: "" };
  state.guideWall = {
    date: "", axisNo: "", note: "",
    checks: GUIDE_WALL_CHECKS.map(createGuideWallCheck)
  };
  state.rebarCage = {
    date: "", cageNo: "", drawingNo: "", note: "",
    mode: "simple",
    parts: createRebarCageParts(),
    checks: REBAR_CAGE_CHECKS.map(([item, standard]) => ({ item, standard, actual: "", result: "待確認" })),
    photos: []
  };
  clearTimeout(undoTimer);
  undoAction = null;
  $("#undo-toast").hidden = true;
  setInitialInputs();
  renderAll();
  syncAllDateTimeDisplays();
  $("#clear-dialog").close();
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


// 查驗期間：四個停檢點查驗日期的最早～最晚（查驗表表頭與檔名用）
function inspectionDates() {
  return Object.values(state.holdDates).filter(Boolean).sort();
}
function dateRangeText(start, end) {
  if (!start && !end) return "";
  if (!start || !end || start === end) return start || end;
  return `${start} ～ ${end}`;
}
function inspectionPeriodText() {
  const dates = inspectionDates();
  return dateRangeText(dates[0], dates.at(-1));
}

// 列印表頭。每頁自己決定日期（查驗表印查驗期間、導溝／鋼筋籠印複核日期），
// 工程名稱／施工廠商一律取共用的工程資訊；identity 與 reviewer 沒給就用連續壁本身的。
function printHeader({ title, sequence, identity, date, dateLabel = "查驗期間", reviewer = state.overview.reviewer, reviewerLabel = "填表人" }) {
  const shownIdentity = identity || [state.unit.unitType, state.unit.unitNo].filter(Boolean).join("｜") || "未指定單元";
  return `<header class="print-document-header"><div class="print-header-title"><p>DIAPHRAGM WALL HOLD POINT INSPECTION / ${sequence}</p><h1>${esc(title)}</h1></div><div class="print-header-meta-body"><div class="print-header-project-lines">
    <div><span>工程名稱：</span><strong>${esc(display(state.overview.project))}</strong></div>
    <div><span>${esc(dateLabel)}：</span><strong>${esc(display(date))}</strong></div>
    <div><span>施工廠商：</span><strong>${esc(display(state.overview.contractor))}</strong></div>
    <div><span>${esc(reviewerLabel)}：</span><strong>${esc(display(reviewer))}</strong></div>
  </div></div><div class="print-header-logo-wrap"><img class="print-logo" src="./taisei.png" alt="大成建設標誌" /><strong class="print-header-identity">${esc(shownIdentity)}</strong></div></header>`;
}


// 設計基準以 9 欄橫向長條呈現，讓兩張查驗表都能在頁首保留完整識別資料。
function printUnitInfo() {
  const height = designHeight();
  const designVolume = calculatedDesignVolume();
  const topElevation = number(state.unit.topElevation);
  const guideTop = number(state.unit.guideTopElevation);
  return `<div class="pouring-wall-full"><section class="print-section"><h2>設計基準與單元資料</h2><div class="print-meta-grid three">
    <div><span>單元類型</span><strong>${esc(display(state.unit.unitType))}</strong></div>
    <div><span>單元編號</span><strong>${esc(display(state.unit.unitNo))}</strong></div>
    <div><span>順序編號</span><strong>${esc(display(state.unit.sequenceNo))}</strong></div>
    <div><span>穩定液種類</span><strong>${esc(display(state.unit.slurryType))}</strong></div>
    <div><span>導溝頂基準(GL,m)</span><strong>${guideTop === null ? "" : `GL ${signed(guideTop)}`}</strong></div>
    <div><span>設計壁厚／長度(m)</span><strong>${esc(display(state.unit.thickness))} ／ ${esc(display(state.unit.length))}</strong></div>
    <div><span>設計深度(GL,m)</span><strong>GL ${esc(display(state.unit.designDepth))}</strong></div>
    <div><span>壁頂設計高程(GL,m)</span><strong>${topElevation === null ? "" : `GL ${signed(topElevation)}`}</strong></div>
    <div><span>設計強度(${esc(strengthUnit())})／數量</span><strong>${esc(display(state.unit.strength))} ／ ${designVolume === null ? "" : fixed(designVolume)} m³</strong></div>
  </div></section><p class="pouring-chart-note">設計澆置高度 ${fixed(height)} m＝壁頂設計高程與設計深度之差；設計數量＝設計澆置高度 × 設計壁厚 × 單元長度。</p></div>`;
}

function printHoldSection(holdId) {
  const hold = HOLD_BY_ID[holdId];
  const rows = hold.items.map((definition, index) => {
    const record = state.holds[holdId][index];
    const warning = holdItemWarning(holdId, index);
    const unitSuffix = definition.unit ? `（${definition.unit}）` : "";
    const actual = display(record.actual);
    return `<tr>
      <td>${index + 1}</td>
      <td class="text-left">${esc(definition.item)}${esc(unitSuffix)}</td>
      <td class="text-left">${esc(holdItemStandard(holdId, index))}</td>
      <td class="text-left">${esc(actual)}${warning ? `<br />※ ${esc(warning)}` : ""}</td>
      <td>${esc(record.result)}</td>
    </tr>`;
  }).join("");
  const inspected = printText(state.holdDates[holdId]);
  return `<section class="print-section compact-print-section"><h2>【${esc(hold.badge)}】${esc(hold.title)}<span class="print-heading-meta">${esc(hold.release)}${inspected ? `｜查驗日期 ${esc(inspected)}` : ""}</span></h2>
    <table class="print-table quality-print-table"><thead><tr><th>項次</th><th>查驗項目</th><th>判定標準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function printConclusion() {
  const verdicts = ["合格放行", "限期改善後複驗", "異常追蹤處理"];
  const marks = verdicts.map(value => `${state.conclusion.verdict === value ? "■" : "□"} ${value}`).join("　　");
  return `<section class="print-section compact-print-section"><h2>查驗結論與簽認</h2><div class="print-meta-grid three compact-meta">
    <div><span>查驗結果</span><strong>${esc(marks)}</strong></div>
    <div><span>填表人</span><strong>${esc(display(state.overview.reviewer))}</strong></div>
    <div><span>查驗期間</span><strong>${esc(display(inspectionPeriodText()))}</strong></div>
  </div></section>
  <section class="print-section compact-print-section"><h2>改善或備註說明</h2><div class="print-note">${esc(display(state.conclusion.note))}</div></section>
  <section class="print-section compact-print-section"><h2>應檢附之專業分包商紀錄附件</h2><table class="print-table"><tbody><tr><td class="text-left">${ATTACHMENTS.map(esc).join("　")}</td></tr></tbody></table></section>`;
}

function renderPrint() {
  $("#print-inspection-a").innerHTML = `${printHeader({ title: "連續壁營造廠查驗表", sequence: "01", date: inspectionPeriodText() })}
    ${printUnitInfo()}
    ${printHoldSection("hold1")}
    ${printHoldSection("hold2")}${printFooter()}`;

  $("#print-inspection-b").innerHTML = `${printHeader({ title: "連續壁營造廠查驗表（續）", sequence: "02", date: inspectionPeriodText() })}
    ${printUnitInfo()}
    ${printHoldSection("hold3")}
    ${printHoldSection("hold4")}
    ${printConclusion()}${printFooter()}`;

  const guideWallRows = state.guideWall.checks.map((check, index) => `<tr><td>${index + 1}</td><td class="text-left">${esc(check.item)}</td><td class="text-left">${standardHtml(check.standard)}</td><td class="text-left">${esc(guideCheckActual(check))}</td><td>${esc(check.result)}</td></tr>`).join("");
  $("#print-guide-wall").innerHTML = `${printHeader({ title: "導溝施工複核表", sequence: "03", identity: state.guideWall.axisNo || "未填軸線", date: state.guideWall.date, dateLabel: "複核日期", reviewerLabel: "營造廠複核人" })}
    <section class="print-section"><h2>導溝資料</h2><div class="print-meta-grid three">
      <div><span>軸線／方向編號</span><strong>${esc(display(state.guideWall.axisNo))}</strong></div>
      <div><span>導溝頂基準高程</span><strong>${number(state.unit.guideTopElevation) === null ? "" : `GL ${signed(number(state.unit.guideTopElevation))} m`}</strong></div>
      <div><span>複核意見</span><strong>${esc(display(state.guideWall.note))}</strong></div>
    </div></section>
    <section class="print-section"><h2>導溝複核項目</h2><table class="print-table checklist-print-table"><thead><tr><th>項次</th><th>複核項目</th><th>確認基準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${guideWallRows}</tbody></table></section>${printFooter()}`;

  const rebarCageRows = state.rebarCage.checks.map((check, index) => `<tr><td>${index + 1}</td><td class="text-left">${esc(check.item)}</td><td class="text-left">${standardHtml(check.standard)}</td><td class="text-left">${esc(display(check.actual))}</td><td>${esc(check.result)}</td></tr>`).join("");
  $("#print-rebar-cage").innerHTML = `${printHeader({ title: "鋼筋籠吊放前複核表", sequence: "04", identity: [state.unit.unitNo, state.rebarCage.cageNo].filter(Boolean).join("｜") || "未指定鋼筋籠", date: state.rebarCage.date, dateLabel: "複核日期", reviewerLabel: "營造廠複核人" })}
    <section class="print-section"><h2>鋼筋籠資料</h2><div class="print-meta-grid three compact-meta">
      <div><span>單元編號</span><strong>${esc(display(wallUnitLabel()))}</strong></div>
      <div><span>順序編號</span><strong>${esc(display(state.unit.sequenceNo))}</strong></div>
      <div><span>鋼筋籠編號</span><strong>${esc(display(state.rebarCage.cageNo))}</strong></div>
      <div><span>核定配筋圖號</span><strong>${esc(display(state.rebarCage.drawingNo))}</strong></div>
      <div class="span-two"><span>複核意見</span><strong>${esc(display(state.rebarCage.note))}</strong></div>
    </div></section>
    <section class="print-section compact-print-section"><h2>配筋抽查明細</h2>${rebarCagePrintTableHtml(state.rebarCage)}</section>
    <section class="print-section compact-print-section"><h2>組裝與吊放條件</h2><table class="print-table rebar-cage-check-print-table"><thead><tr><th>項次</th><th>複核項目</th><th>確認基準</th><th>現場紀錄／實測</th><th>結果</th></tr></thead><tbody>${rebarCageRows}</tbody></table></section>${printFooter()}`;
  // 鋼筋籠照片另起一頁（有照片才印）：同一份表頭，三列各占頁高 1/3，簽名欄在頁底
  const cagePhotos = state.rebarCage.photos || [];
  const photoPage = $("#print-rebar-cage-photos");
  photoPage.style.display = cagePhotos.length ? "" : "none";
  photoPage.innerHTML = cagePhotos.length ? `${printHeader({ title: "鋼筋籠複核照片", sequence: "04", identity: [state.unit.unitNo, state.rebarCage.cageNo].filter(Boolean).join("｜") || "未指定鋼筋籠", date: state.rebarCage.date, dateLabel: "複核日期", reviewerLabel: "營造廠複核人" })}${cagePhotosPrintHtml(cagePhotos)}${printFooter()}` : "";
}

function setPdfDocumentTitle(scope) {
  const toolName = TOOL_LABELS[activeTool] || "施工檢核紀錄";
  const recordId = activeTool === "guideWall" ? state.guideWall.axisNo : state.unit.unitNo || (activeTool === "rebarCage" ? state.rebarCage.cageNo : "");
  const pageName = currentExportLabel(activeTool, activeTab);
  const date = (activeTool === "inspection" ? inspectionDates().at(-1) : activeTool === "guideWall" ? state.guideWall.date : state.rebarCage.date) || today;
  const parts = [toolName, recordId, scope === "all" ? "完整檢核紀錄" : pageName, date];
  setPrintDocumentTitle(parts);
}

function preparePrint(scope) {
  renderPrint();
  document.body.dataset.printScope = scope;
  const current = activeTool === "inspection" ? PRINT_TAB_GROUPS[activeTab] : PRINT_TAB_GROUPS[activeTool];
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
  const mapped = SLURRY_KEYS[state.unit.slurryType];
  const standards = Object.fromEntries(Object.entries(state.standards)
    .filter(([key]) => !mapped || !SLURRY_DEPENDENT.includes(key) || Object.values(mapped).includes(key))
    .map(([key, value]) => [key, key === "verticalDenominator" ? {
      value,
      calculated_value: value === "10/D" ? (selectedVerticalPrecision()?.denominator?.toFixed(1) || "") : value,
      display: verticalityStandardText()
    } : value]));

  return {
    app_version: APP_VERSION,
    schema_version: "1.6",
    record_type: "diaphragm_wall_gc_inspection",
    exported_at: new Date().toISOString(),
    export_context: {
      active_tool: activeTool,
      active_tab: activeTool === "inspection" ? activeTab : activeTool,
      current_form_label: currentExportLabel(activeTool, activeTab)
    },
    project: {
      name: state.overview.project || null,
      contractor: state.overview.contractor || null,
      inspection_date: inspectionDates().at(-1) || null, // 相容舊欄位：以最晚的查驗日期代表
      inspection_period: { start: inspectionDates()[0] || null, end: inspectionDates().at(-1) || null },
      site_engineer: state.overview.reviewer || null
    },
    wall_unit: {
      unit_type: state.unit.unitType || null,
      unit_no: state.unit.unitNo || null,
      sequence_no: state.unit.sequenceNo || null,
      slurry_type: state.unit.slurryType || null,
      guide_wall_top_elevation_m: toNumberOrNull(state.unit.guideTopElevation),
      design_depth_m: toNumberOrNull(state.unit.designDepth),
      top_elevation_m: toNumberOrNull(state.unit.topElevation),
      thickness_m: toNumberOrNull(state.unit.thickness),
      length_m: toNumberOrNull(state.unit.length),
      concrete_strength: toNumberOrText(state.unit.strength),
      concrete_strength_unit: strengthUnit(),
      design_pour_height_m: designHeight(),
      design_volume_m3: calculatedDesignVolume()
    },
    standards,
    hold_points: HOLD_POINTS.map(hold => ({
      hold_point_id: hold.id,
      hold_point: hold.badge,
      title: hold.title,
      release: hold.release,
      inspection_date: state.holdDates[hold.id] || null,
      items: hold.items.map((definition, index) => ({
        item_no: index + 1,
        key: definition.key,
        item: definition.item,
        unit: definition.unit || null,
        standard: holdItemStandard(hold.id, index),
        actual: state.holds[hold.id][index].actual || null,
        warning: holdItemWarning(hold.id, index),
        result: state.holds[hold.id][index].result
      }))
    })),
    conclusion: {
      verdict: state.conclusion.verdict,
      note: state.conclusion.note || null,
      required_attachments: ATTACHMENTS
    },
    guide_wall_review: {
      project: state.overview.project || null,
      contractor: state.overview.contractor || null,
      review_date: state.guideWall.date || null,
      axis_no: state.guideWall.axisNo || null,
      reviewer: state.overview.reviewer || null,
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
      drawing_no: state.rebarCage.drawingNo || null,
      reviewer: state.overview.reviewer || null,
      note: state.rebarCage.note || null,
      mode: state.rebarCage.mode,
      parts: exportRebarCageParts(state.rebarCage),
      photos: exportCagePhotos(state.rebarCage.photos),
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
  const recordId = safeFilePart(state.unit.unitNo, "");
  const date = safeFilePart(inspectionDates().at(-1) || today, today);
  return `${["diaphragm-wall-gc", recordId, date].filter(Boolean).join("-")}.${extension}`;
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
    `# 連續壁營造廠施工品質查驗表`,
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
    `| 查驗期間 | ${markdownCell(dateRangeText(data.project.inspection_period.start, data.project.inspection_period.end))} |`,
    `| 填表人 | ${markdownCell(data.project.site_engineer)} |`,
    ``,
    `## 設計基準`,
    ``,
    `| 欄位 | 內容 |`,
    `| --- | --- |`,
    `| 單元類型 | ${markdownCell(wall.unit_type)} |`,
    `| 單元編號 | ${markdownCell(wall.unit_no)} |`,
    `| 順序編號 | ${markdownCell(wall.sequence_no)} |`,
    `| 穩定液種類 | ${markdownCell(wall.slurry_type)} |`,
    `| 導溝頂基準高程（m） | ${markdownCell(wall.guide_wall_top_elevation_m)} |`,
    `| 設計深度（m） | ${markdownCell(wall.design_depth_m)} |`,
    `| 壁頂設計高程（m） | ${markdownCell(wall.top_elevation_m)} |`,
    `| 設計壁厚（m） | ${markdownCell(wall.thickness_m)} |`,
    `| 單元長度（m） | ${markdownCell(wall.length_m)} |`,
    `| 設計強度（${wall.concrete_strength_unit || "kgf/cm²"}） | ${markdownCell(wall.concrete_strength ?? wall.concrete_strength_kgf_cm2)} |`,
    `| 設計澆置高度（m） | ${markdownCell(wall.design_pour_height_m)} |`,
    `| 設計數量（m³） | ${markdownCell(wall.design_volume_m3)} |`,
    ``,
    ...data.hold_points.flatMap(hold => [
      `## 【${hold.hold_point}】${hold.title}（${hold.release}）${hold.inspection_date ? `｜查驗日期 ${hold.inspection_date}` : ""}`,
      ``,
      `| 項次 | 查驗項目 | 判定標準 | 現場紀錄／實測 | 警示 | 結果 |`,
      `| ---: | --- | --- | --- | --- | --- |`,
      ...hold.items.map(item => `| ${item.item_no} | ${markdownCell(item.item)} | ${markdownCell(item.standard)} | ${markdownCell(item.actual)} | ${markdownCell(item.warning)} | ${markdownCell(item.result)} |`),
      ``
    ]),
    `## 查驗結論`,
    ``,
    `- 查驗結果：${markdownCell(data.conclusion.verdict)}`,
    `- 改善或備註說明：${markdownCell(data.conclusion.note)}`,
    ``,
    `### 應檢附之專業分包商紀錄附件`,
    ``,
    ...ATTACHMENTS.map(text => `- ${text}`),
    ``,
    `## 導溝施工複核`,
    ``,
    `- 軸線／方向編號：${markdownCell(data.guide_wall_review.axis_no)}`,
    ...data.guide_wall_review.items.map(item => `- ${item.item_no}. ${item.item}：${item.result}；現場紀錄：${markdownCell([item.actual, item.bar_size ? `號數 ${barSizeMark(item.bar_size)}` : "", item.bar_spacing_cm !== null && item.bar_spacing_cm !== undefined ? `間距 ${item.bar_spacing_cm} cm` : ""].filter(Boolean).join("；"))}`),
    ``,
    `## 鋼筋籠吊放前複核`,
    ``,
    `### 配筋抽查明細`,
    ``,
    ...rebarCageMarkdownRows(state.rebarCage),
    ``,
    `### 組裝與吊放條件`,
    ``,
    ...data.rebar_cage_review.inspection_items.map(item => `- ${item.item_no}. ${item.item}：${item.result}；現場紀錄：${markdownCell(item.actual)}`),
    ``,
    `照片：${data.rebar_cage_review.photos.length} 張${data.rebar_cage_review.photos.map(photo => `；${photo.no}. ${markdownCell(photo.caption)}`).join("")}（影像僅在 JSON 與 PDF）`,
    ``,
    `> 本 Markdown 由營造廠查驗工具依同一份結構化資料產生；資料庫匯入請優先使用同次輸出的 JSON。`
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
  return definitions.map(([item, standard], index) => {
    const record = source[index] || {};
    return {
      item: importText(record.item) || item,
      standard: importText(record.standard) || standard,
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

// 廠商版（連續壁施工紀錄）只帶入工程名稱與設計參數；沉泥、坍度、垂直度、
// 實際方量等實測值一律由營造廠自行填寫，以維持二級品管的獨立性。
function importVendorPayload(payload) {
  const project = payload.project || {};
  const wall = payload.wall_unit || {};
  state.overview = {
    project: importText(project.name),
    contractor: importText(project.contractor),
    reviewer: ""
  };
  state.unit = {
    unitType: importText(wall.unit_type),
    unitNo: importText(wall.unit_no),
    sequenceNo: importText(wall.sequence_no),
    slurryType: "",
    guideTopElevation: "",
    strength: importText(wall.concrete_strength ?? wall.concrete_strength_kgf_cm2), // 1.5 以前只有 kgf/cm²
    strengthUnit: STRENGTH_UNITS.includes(wall.concrete_strength_unit) ? wall.concrete_strength_unit : STRENGTH_UNITS[0],
    thickness: importText(wall.thickness_m),
    length: importText(wall.length_m),
    designDepth: importText(wall.design_depth_m),
    topElevation: importText(wall.top_elevation_m),
    designVolume: ""
  };
  return "匯入完成：已帶入廠商版的工程名稱與設計參數；實測值請由營造廠自行查驗填寫。";
}

function importGcPayload(payload) {
  const project = payload.project || {};
  const wall = payload.wall_unit || {};
  const conclusion = payload.conclusion || {};
  const guideWall = payload.guide_wall_review || {};
  const rebarCage = payload.rebar_cage_review || {};

  // 舊版 JSON 的工程名稱／廠商／複核人可能只填在導溝或鋼筋籠區塊，匯入時往回補進共用欄位。
  state.overview = {
    project: importText(project.name) || importText(guideWall.project) || importText(rebarCage.project),
    contractor: importText(project.contractor) || importText(guideWall.contractor),
    reviewer: importText(project.site_engineer) || importText(guideWall.reviewer) || importText(rebarCage.reviewer)
  };
  // 舊版只有一個 inspection_date：沒有各停檢點日期的欄位一律回填它
  const legacyDate = importText(project.inspection_date);
  const importedHoldDates = Array.isArray(payload.hold_points) ? payload.hold_points : [];
  state.holdDates = Object.fromEntries(HOLD_POINTS.map(hold => [hold.id, importText(importedHoldDates.find(record => record.hold_point_id === hold.id)?.inspection_date) || legacyDate]));
  state.unit = {
    unitType: importText(wall.unit_type),
    unitNo: importText(wall.unit_no) || importText(rebarCage.unit_no), // 1.2 以前鋼筋籠自己帶單元編號
    sequenceNo: importText(wall.sequence_no),
    slurryType: importText(wall.slurry_type),
    guideTopElevation: importText(wall.guide_wall_top_elevation_m),
    strength: importText(wall.concrete_strength ?? wall.concrete_strength_kgf_cm2), // 1.5 以前只有 kgf/cm²
    strengthUnit: STRENGTH_UNITS.includes(wall.concrete_strength_unit) ? wall.concrete_strength_unit : STRENGTH_UNITS[0],
    thickness: importText(wall.thickness_m),
    length: importText(wall.length_m),
    designDepth: importText(wall.design_depth_m),
    topElevation: importText(wall.top_elevation_m),
    designVolume: ""
  };

  const standardValues = { ...STANDARD_DEFAULTS };
  Object.entries(payload.standards || {}).forEach(([key, value]) => {
    if (!Object.prototype.hasOwnProperty.call(standardValues, key)) return;
    standardValues[key] = importText(value && typeof value === "object" ? (value.selection ?? value.value) : value);
  });
  state.standards = standardValues;

  const importedHolds = Array.isArray(payload.hold_points) ? payload.hold_points : [];
  state.holds = Object.fromEntries(HOLD_POINTS.map(hold => {
    const source = importedHolds.find(record => record.hold_point_id === hold.id) || {};
    const items = Array.isArray(source.items) ? source.items : [];
    return [hold.id, hold.items.map((definition, index) => {
      const record = items.find(entry => entry.key === definition.key) || items[index] || {};
      return { actual: importText(record.actual), result: importResult(record.result) };
    })];
  }));
  const legacyHold1Items = importedHolds.find(record => record.hold_point_id === "hold1")?.items || [];
  ["slurryDensity", "sandContent"].forEach(key => {
    const targetIndex = HOLD_BY_ID.hold2.items.findIndex(definition => definition.key === key);
    const source = legacyHold1Items.find(record => record.key === key);
    if (targetIndex >= 0 && source) {
      state.holds.hold2[targetIndex] = { actual: importText(source.actual), result: importResult(source.result) };
    }
  });

  state.conclusion = {
    verdict: ["待判定", "合格放行", "限期改善後複驗", "異常追蹤處理"].includes(conclusion.verdict) ? conclusion.verdict : "待判定",
    note: importText(conclusion.note)
  };
  state.guideWall = {
    date: importText(guideWall.review_date),
    axisNo: importText(guideWall.axis_no),
    note: importText(guideWall.note),
    checks: importGuideWallItems(guideWall.items)
  };

  state.rebarCage = {
    date: importText(rebarCage.review_date),
    cageNo: importText(rebarCage.cage_no),
    drawingNo: importText(rebarCage.drawing_no),
    note: importText(rebarCage.note),
    mode: rebarCage.mode === "detailed" ? "detailed" : "simple",
    parts: importRebarCageParts(rebarCage.parts),   // 1.3 以前的 rebar_items 直接略過
    checks: importChecklistItems(REBAR_CAGE_CHECKS, rebarCage.inspection_items),
    photos: importCagePhotos(rebarCage.photos)
  };
  return "匯入完成：已回填營造廠查驗表、導溝與鋼筋籠全部分頁。";
}

function importJsonPayload(payload) {
  const gcTypes = ["diaphragm_wall_gc_inspection"];
  const vendorTypes = ["diaphragm_wall_field_record", "continuous_wall_field_record"];
  if (!payload || typeof payload !== "object") throw new Error("JSON 格式無法讀取。");

  let message;
  if (gcTypes.includes(payload.record_type)) message = importGcPayload(payload);
  else if (vendorTypes.includes(payload.record_type)) message = importVendorPayload(payload);
  else throw new Error("這不是連續壁查驗或施工紀錄工具所產生的 JSON。");

  const context = payload.export_context || {};
  const importedTool = ["inspection", "guideWall", "rebarCage"].includes(context.active_tool) ? context.active_tool : "inspection";
  const importedTab = TAB_LABELS[context.active_tab] ? context.active_tab : "design";
  setInitialInputs();
  renderAll();
  showTool(importedTool);
  if (importedTool === "inspection") showTab(importedTab);
  syncAllDateTimeDisplays();
  return message;
}

async function importJsonFile(file) {
  const status = $("#import-status");
  try {
    const payload = JSON.parse(await file.text());
    status.textContent = importJsonPayload(payload);
    draft.schedule(); // file input 的 change 事件在讀檔完成前就冒泡過了，這裡補存匯入後的狀態
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
  renderAll();
  syncAllDateTimeDisplays();
  showTab("design");

  document.addEventListener("input", event => {
    if (event.target.matches('input[type="date"], input[type="time"]')) syncDateTimeDisplay(event.target);
    const input = event.target.closest("[data-bind]");
    if (input) {
      const [group, key] = input.dataset.bind.split(".");
      state[group][key] = input.value;
      if (group === "unit") { syncUnitInputs(input); updateUnitCalculation(); }
      return;
    }
    const meta = event.target.closest("[data-check-bind]");
    if (meta) {
      const [type, key] = meta.dataset.checkBind.split(".");
      state[type][key] = meta.value;
      return;
    }
    const hold = event.target.closest("[data-hold]");
    if (hold) {
      state.holds[hold.dataset.hold][Number(hold.dataset.holdIndex)][hold.dataset.holdField] = hold.value;
      return;
    }
    const check = event.target.closest("[data-check-item]");
    if (check) state[check.dataset.checkItem].checks[Number(check.dataset.checkIndex)][check.dataset.checkField] = check.value;
  });

  document.addEventListener("change", event => {
    const input = event.target.closest("[data-bind]");
    if (input?.type === "radio") {
      const [group, key] = input.dataset.bind.split(".");
      state[group][key] = input.value;
      if (group === "unit") {
        renderStandards();
        HOLD_POINTS.forEach(item => renderHold(item.id));
      }
      return;
    }
    if (input?.tagName === "SELECT") {
      const [group, key] = input.dataset.bind.split(".");
      state[group][key] = input.value;
      return;
    }
    const hold = event.target.closest("[data-hold]");
    if (hold) {
      state.holds[hold.dataset.hold][Number(hold.dataset.holdIndex)][hold.dataset.holdField] = hold.value;
      renderHold(hold.dataset.hold);
      return;
    }
    const check = event.target.closest("[data-check-item]");
    if (check) {
      const type = check.dataset.checkItem;
      state[type].checks[Number(check.dataset.checkIndex)][check.dataset.checkField] = check.value;
      if (check.dataset.checkField === "result") renderCheckCards(type);
    }
    const standard = event.target.closest("[data-standard]");
    if (standard) {
      state.standards[standard.dataset.standard] = standard.value;
      renderStandards();
      HOLD_POINTS.forEach(item => renderHold(item.id));
    }
  });

  // 數值輸入後才重算判定標準與警示，避免每個按鍵都重繪整張卡片列表。
  document.addEventListener("blur", event => {
    const hold = event.target.closest?.("[data-hold]");
    if (hold && hold.dataset.holdField === "actual") renderHold(hold.dataset.hold);
  }, true);

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

  bindRebarCageUi({ getCage: () => state.rebarCage, onChange: renderRebars });
  bindCagePhotosUi({ getPhotos: () => state.rebarCage.photos, onChange: () => { renderRebars(); draft.schedule(); } }); // 壓縮是非同步的，事件冒泡時草稿還沒有照片
  draft.watch();

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


  $("#undo-button").addEventListener("click", () => {
    if (undoAction) undoAction();
    clearTimeout(undoTimer);
    undoAction = null;
    $("#undo-toast").hidden = true;
  });

  showTool("inspection");
}

const loadedDraft = draft.load() ?? {};
Object.assign(state, loadedDraft);
normalizeLoadedState(loadedDraft);
if (exampleMode) loadExample();
initialize();
