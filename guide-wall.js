// 導溝複核的數值項目（01 營造廠、06 廠商兩個連續壁工具共用；在 bar-sizes.js 之後、工具 script 之前載入）。
//
// 有設計值／實測值的項目依下表自動判定：
//   ・不合格：實測框（或設計框）變紅，結果自動選「✗」，「✓」停用；使用者只能改數值或選 N/A。
//   ・合格：鋼筋自動選「✓」；其餘項目仍要現場確認標準裡的其他條件，留給使用者點選。
//   ・不是數值（容錯規則見 auto-judge.js）：紅框並提示「請輸入數值」，「✓」停用，不自動選。
// 自動判定只在數值改變時套用（applyGuideAutoResult），重繪時不會蓋掉使用者手動點選的結果。
//
// 資料欄位：design（設計值）、actual（實測值，沿用舊欄位）；鋼筋是 designBarNo／designBarSpacing（設計）
// 與 barNo／barSpacing（實測，沿用舊欄位）。auto 記錄目前結果是否由自動判定帶入，只存在草稿裡。
const GUIDE_WALL_MEASURES = {
  "位置與淨寬": { kind: "range", unit: "cm", tolerance: 5, placeholder: ["例如：100", "例如：102"] },
  "深度": { kind: "min", unit: "m", designMin: 1.8, placeholder: ["例如：2.0", "例如：2.1"] },
  "牆厚": { kind: "min", unit: "cm", placeholder: ["例如：20", "例如：21"] },
  "鋼筋": { kind: "rebar", autoPass: true },
  "混凝土強度": { kind: "min", unit: "kgf/cm²", placeholder: ["例如：210", "例如：245"] },
  "頂部基準高程": { kind: "elevation", unit: "m", placeholder: "例如：0.30" }
};

// 兩個工具的範例資料共用這組數值
const GUIDE_WALL_EXAMPLE_VALUES = {
  "位置與淨寬": { design: "100", actual: "103" },
  "深度": { design: "2.0", actual: "2.05" },
  "牆厚": { design: "20", actual: "20.5" },
  "鋼筋": { designBarNo: "D16", designBarSpacing: "20", barNo: "D16", barSpacing: "20", actual: "" },
  "混凝土強度": { design: "210", actual: "245" },
  "頂部基準高程": { actual: "0.30" }
};

const GUIDE_BAR_SPACINGS = ["10", "12.5", "15", "17.5", "20", "22.5", "25", "27.5", "30"];

const guideMeasure = check => GUIDE_WALL_MEASURES[check?.item] || null;
const guideNumber = value => parseMeasure(value).value;
const guideFormat = value => String(Number(value.toFixed(2)));

// 回傳 { status: "empty" | "invalid" | "pass" | "fail", designBad, actualBad, note, message }
// note 是許可值等提示，message 是不合格原因（兩者都顯示在數值欄位下方）。
function evaluateGuideMeasure(check) {
  const config = guideMeasure(check);
  const result = { status: "empty", designBad: false, actualBad: false, note: "", message: "" };
  if (!config) return result;
  if (config.kind === "elevation") {
    return parseMeasure(check.actual).invalid ? { ...result, status: "invalid", actualBad: true, message: INVALID_MEASURE_MESSAGE } : result;
  }

  if (config.kind === "rebar") {
    const values = [check.designBarNo, check.designBarSpacing, check.barNo, check.barSpacing].map(value => String(value ?? "").trim());
    if (values.some(value => !value)) return result;
    const designSpacing = guideNumber(check.designBarSpacing);
    const actualSpacing = guideNumber(check.barSpacing);
    const sizeOk = values[0] === values[2];
    const spacingOk = designSpacing !== null && actualSpacing !== null && actualSpacing <= designSpacing;
    if (sizeOk && spacingOk) return { ...result, status: "pass" };
    const reasons = [];
    if (!sizeOk) reasons.push(`實測號數 ${barSizeMark(values[2])} 與設計 ${barSizeMark(values[0])} 不同`);
    if (!spacingOk) reasons.push(`實測間距 ${values[3]} cm 大於設計 ${values[1]} cm`);
    return { ...result, status: "fail", actualBad: true, message: reasons.join("；") };
  }

  const designParsed = parseMeasure(check.design);
  const actualParsed = parseMeasure(check.actual);
  if (designParsed.invalid || actualParsed.invalid) {
    return { ...result, status: "invalid", designBad: designParsed.invalid, actualBad: actualParsed.invalid, message: INVALID_MEASURE_MESSAGE };
  }
  const design = designParsed.value;
  const actual = actualParsed.value;
  const unit = config.unit;
  if (config.designMin !== undefined && design !== null && design < config.designMin) {
    return { ...result, status: "fail", designBad: true, message: `設計值 ${guideFormat(design)} ${unit} 小於 ${config.designMin} ${unit} 下限` };
  }
  if (config.kind === "range") {
    if (design === null) return result;
    const lo = design - config.tolerance;
    const hi = design + config.tolerance;
    const note = `許可值 ${guideFormat(lo)}～${guideFormat(hi)} ${unit}`;
    if (actual === null) return { ...result, note };
    if (actual < lo || actual > hi) return { ...result, status: "fail", actualBad: true, note, message: `實測 ${guideFormat(actual)} ${unit} 超出許可值` };
    return { ...result, status: "pass", note };
  }
  // kind === "min"：實測須 ≥ 設計
  if (design === null) return result;
  const note = `許可值 ≥ ${guideFormat(design)} ${unit}`;
  if (actual === null) return { ...result, note };
  if (actual < design) return { ...result, status: "fail", actualBad: true, note, message: `實測 ${guideFormat(actual)} ${unit} 小於設計值` };
  return { ...result, status: "pass", note };
}

// 數值改變後呼叫：不合格自動選 ✗；鋼筋合格自動選 ✓；條件解除時，把先前自動帶入的結果退回待確認。
// 使用者選了 N/A 就不動。
function applyGuideAutoResult(check) {
  const config = guideMeasure(check);
  if (!config) return;
  applyAutoResult(check, evaluateGuideMeasure(check).status, { autoPass: config.autoPass });
}

// 不合格或不是數值時「✓」不可選（匯入或舊草稿帶進來的「符合」也在重繪前改掉）。
const guideLockedResults = check => autoLockedResults(check, evaluateGuideMeasure(check).status);

function guideSpacingOptions(selected) {
  const current = String(selected ?? "").trim();
  const values = [...GUIDE_BAR_SPACINGS];
  if (current && !values.includes(current)) values.push(current);
  return [`<option value="">間距</option>`, ...values.map(value =>
    `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(value)}${GUIDE_BAR_SPACINGS.includes(value) ? "" : "（舊）"}</option>`)].join("");
}

// 取代原本「現場紀錄／實測」文字欄。attrs(field) 回傳該欄位的 data-* 屬性（沿用各工具既有的事件委派）。
function guideMeasureFieldsHtml(check, attrs) {
  const config = guideMeasure(check);
  const evaluation = evaluateGuideMeasure(check);
  const bad = flag => flag ? " is-invalid" : "";
  const note = `<small class="guide-measure-note${evaluation.message ? " is-invalid" : ""}" data-guide-note>${escapeHtml([evaluation.note, evaluation.message].filter(Boolean).join("；"))}</small>`;
  if (config.kind === "elevation") {
    return `<div class="field guide-measure is-single"><label class="guide-measure-group${bad(evaluation.actualBad)}" data-guide-group="actual">
      <b class="guide-affix">GL-</b>
      <input type="text" inputmode="decimal" value="${escapeHtml(check.actual)}" placeholder="${escapeHtml(config.placeholder)}" aria-label="頂部基準高程（GL-，${config.unit}）" ${attrs("actual")} />
      <b class="guide-affix">${config.unit}</b>
    </label>${note}</div>`;
  }
  if (config.kind === "rebar") {
    const group = (label, sizeField, spacingField, invalid) => `<div class="guide-measure-group${bad(invalid)}" data-guide-group="${label === "設計" ? "design" : "actual"}">
        <span class="guide-measure-label">${label}</span>
        <select aria-label="${label}號數" ${attrs(sizeField)}>${barSizeOptions(check[sizeField], "號數")}</select>
        <span class="guide-at">@</span>
        <select aria-label="${label}間距（cm）" ${attrs(spacingField)}>${guideSpacingOptions(check[spacingField])}</select>
        <b class="guide-affix">cm</b>
      </div>`;
    return `<div class="field guide-measure is-rebar">${group("設計", "designBarNo", "designBarSpacing", false)}${group("實測", "barNo", "barSpacing", evaluation.actualBad)}${note}</div>`;
  }
  const group = (label, field, placeholder, invalid) => `<label class="guide-measure-group${bad(invalid)}" data-guide-group="${field === "design" ? "design" : "actual"}">
      <span class="guide-measure-label">${label}</span>
      <input type="text" inputmode="decimal" value="${escapeHtml(check[field])}" placeholder="${escapeHtml(placeholder)}" aria-label="${label}（${config.unit}）" ${attrs(field)} />
      <b class="guide-affix">${config.unit}</b>
    </label>`;
  return `<div class="field guide-measure">${group("設計", "design", config.placeholder[0], evaluation.designBad)}${group("實測", "actual", config.placeholder[1], evaluation.actualBad)}${note}</div>`;
}

// 打字時就地更新紅框、提示與結果鈕，不重繪整張卡片（避免輸入框失焦）。
function syncGuideMeasureCard(card, check) {
  if (!card) return;
  const evaluation = evaluateGuideMeasure(check);
  const locked = guideLockedResults(check);
  card.querySelector('[data-guide-group="design"]')?.classList.toggle("is-invalid", evaluation.designBad);
  card.querySelector('[data-guide-group="actual"]')?.classList.toggle("is-invalid", evaluation.actualBad);
  const note = card.querySelector("[data-guide-note]");
  if (note) {
    note.textContent = [evaluation.note, evaluation.message].filter(Boolean).join("；");
    note.classList.toggle("is-invalid", Boolean(evaluation.message));
  }
  syncAutoResultCard(card, check, locked);
}

// 列印／Markdown 的「現場紀錄／實測」欄。
function guideMeasureText(check) {
  const config = guideMeasure(check);
  const trim = value => String(value ?? "").trim();
  // 可轉成數值的一律印整理後的數字＋單位（「100cm」不會印成「100cm cm」）；轉不了的照原文印
  const numberText = value => {
    const parsed = parseMeasure(value);
    if (parsed.value === null) return trim(value);
    return /^[+-]?\d+(\.\d+)?$/.test(trim(value)) ? trim(value) : guideFormat(parsed.value);
  };
  if (!config) return "";
  if (config.kind === "elevation") {
    const actual = trim(check.actual);
    if (!actual) return "";
    return guideNumber(actual) === null ? actual : `GL-${numberText(actual)} ${config.unit}`;
  }
  if (config.kind === "rebar") {
    const bar = (size, spacing) => [trim(size) ? barSizeMark(size) : "", trim(spacing) ? `@${trim(spacing)} cm` : ""].join("");
    const parts = [
      bar(check.designBarNo, check.designBarSpacing) && `設計 ${bar(check.designBarNo, check.designBarSpacing)}`,
      bar(check.barNo, check.barSpacing) && `實測 ${bar(check.barNo, check.barSpacing)}`,
      trim(check.actual)
    ];
    return parts.filter(Boolean).join("；");
  }
  const withUnit = value => guideNumber(value) === null ? trim(value) : `${numberText(value)} ${config.unit}`;
  const { note } = evaluateGuideMeasure(check);
  return [
    trim(check.design) && `設計 ${withUnit(check.design)}`,
    trim(check.actual) && `實測 ${withUnit(check.actual)}`,
    config.kind === "range" && note ? `（${note}）` : ""
  ].filter(Boolean).join("；").replace("；（", "（");
}
