# 鋼筋籠簡易／詳細模式與鋼筋號數下拉 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 鋼筋號數全站改為 13 尺寸下拉（PDF 印 `#XX`），並把兩頁連續壁工具的鋼筋籠配筋抽查明細改成 13 個固定部位、簡易／詳細兩種模式與對應的兩張 PDF 表。

**Architecture:** 新增兩個共用瀏覽器全域 script（`bar-sizes.js`、`rebar-cage.js`，比照既有 `print-pages.js`／`dialog-forms.js` 在工具 script 之前載入），資料層與畫面／列印產生器都放在共用檔，`wall-gc.js`／`app.js` 只保留 state 初始化、事件掛載與匯出／匯入接線。沒有建置流程，純靜態檔。

**Tech Stack:** Vanilla JS（classic script、無模組）、CSS、Python + Playwright + PyMuPDF 驗證腳本（`scripts/verify_data.py`、`scripts/verify_print_layout.py`）。

**Spec:** `docs/superpowers/specs/2026-09-18-rebar-cage-modes-design.md`

## Global Constraints

- 所有 JS 是 classic script，頂層 `const`／`function` 共用同一個全域詞法環境：**同名的頂層宣告在兩個檔案裡會直接拋錯**，抽到共用檔的名稱必須從原檔刪掉。
- 新增的共用檔必須加進 `sw.js` 的 `APP_SHELL`，並把 `CACHE_NAME` 從 `portable-inspection-v98` 升到 `portable-inspection-v99`，否則離線快取安裝失敗。
- 鋼筋號數清單固定為：`D10（#3） D13（#4） D16（#5） D19（#6） D22（#7） D25（#8） D29（#9） D32（#10） D36（#11） D39（#12） D43（#14） D50（#16） D57（#18）`；資料存 `D` 名稱，PDF 只印 `#XX`。
- 第 9 項部位名稱為「端板擋筋(母單元)」。
- 使用者介面文字用台灣繁體中文；程式註解沿用專案風格（中文、只寫「為什麼」）。
- 驗證一律驅動真正的頁面：`python3 scripts/verify_data.py`（全部 ✅ 才算過）、`python3 scripts/verify_print_layout.py`。
- 不建立 git commit（使用者未要求）；每個 Task 結尾以 `git status`／`git diff --stat` 確認改動範圍。

---

## File Structure

| 檔案 | 責任 |
|------|------|
| `bar-sizes.js`（新） | 13 個號數常數、`barSizeMark`、`barSizeLabel`、`barSizeOptions`、`escapeHtml` |
| `rebar-cage.js`（新） | 13 個部位定義、建立預設資料、對稱推導、摘要／列印文字、區間紅框判斷、卡片 HTML、彈出視窗、模式藥丸、列印表格、匯出／匯入轉換 |
| `wall-gc.js`、`app.js` | state 初始化與草稿遷移、`renderRebars()`、`loadExample()`、`clearAllData()`、`exportData()`／`exportMarkdown()`／匯入接線、事件掛載 |
| `diaphragm-wall-gc.html`、`diaphragm-wall.html` | 載入新 script、模式切換 HTML、對話框內容、移除「＋ 新增」 |
| `rebar.html`、`rebar.js` | 載入 `bar-sizes.js`、下拉與列印改用共用 helper |
| `app.css` | 藥丸切換、卡片、對話框區間欄位、紅框、兩張列印表欄寬 |
| `sw.js` | 快取清單與版本 |
| `scripts/verify_data.py`、`scripts/verify_print_layout.py` | 驗證案例 |
| `docs/check-items/*.md` | 部位清單 |

---

### Task 1: 共用號數清單 `bar-sizes.js`，鋼筋工程與導溝改用

**Files:**
- Create: `bar-sizes.js`
- Modify: `sw.js:1-3`
- Modify: `rebar.html:130-133`、`diaphragm-wall-gc.html:325-329`、`diaphragm-wall.html:360-364`
- Modify: `rebar.js:7`、`rebar.js:104`、`rebar.js:133`、`rebar.js:141`、`rebar.js:164`、`rebar.js:170`
- Modify: `wall-gc.js:113-118`、`wall-gc.js:144`、`wall-gc.js:748`
- Modify: `app.js:41-46`、`app.js:266`、`app.js:618`
- Test: `scripts/verify_data.py`

**Interfaces:**
- Produces（全域）：`BAR_SIZES: [string, string][]`、`barSizeMark(size: string): string`、`barSizeLabel(size: string): string`、`barSizeOptions(selected: string, placeholder = "請選擇"): string`（`<option>` HTML）、`escapeHtml(value): string`。

- [x] **Step 1: 建立 `bar-sizes.js`**

```js
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
```

- [x] **Step 2: 三個頁面載入，`sw.js` 加入快取並升版**

`rebar.html` 的 `<script src="./draft.js" defer>` 之後、`./rebar.js` 之前插入：

```html
    <script src="./bar-sizes.js" defer></script>
```

`diaphragm-wall-gc.html`、`diaphragm-wall.html` 在 `./dialog-forms.js` 之後、工具 script 之前插入同一行。

`sw.js`：`CACHE_NAME` 改為 `"portable-inspection-v99"`；`APP_SHELL` 在 `"./dialog-forms.js"` 後加入 `"./bar-sizes.js"`。

- [x] **Step 3: `rebar.js` 改用共用清單**

刪除第 7 行 `const BAR_SIZES = [...]` 與第 104 行 `const barSizeOptions = ...`（名稱與共用檔衝突）。

第 133 行 `const size = bar.size || "未選號數";` 改為 `const size = barSizeLabel(bar.size) || "未選號數";`。

第 141 行 `${barSizeOptions(bar.size)}` 改為 `${barSizeOptions(bar.size, "選擇號數")}`。

第 164 行 Markdown 與第 170 行列印裡的 `${display(bar.size)}`／`${bar.size || ""}` 分別改為 `${display(barSizeMark(bar.size))}`／`${barSizeMark(bar.size)}`。

- [x] **Step 4: 兩頁導溝的號數下拉與列印**

`wall-gc.js`：刪除 113 行 `GUIDE_REBAR_SIZES` 與 116-118 行 `guideRebarSizeOptions`；748 行 `${guideRebarSizeOptions(check.barNo)}` 改 `${barSizeOptions(check.barNo)}`；144 行 `guideCheckActual` 裡 `號數 ${check.barNo}` 改 `號數 ${barSizeMark(check.barNo)}`。

`app.js`：同樣處理 41-46 行、618 行、266 行。

- [x] **Step 5: 加驗證案例**

`scripts/verify_data.py` 在 `verify_pdf_content` 之前新增：

```python
# ---------------------------------------------------------------- 共用號數清單
def verify_bar_sizes(browser):
    page = open_clean(browser, "rebar")
    result = page.evaluate("""() => ({
      count: BAR_SIZES.length, mark: barSizeMark("D32"), label: barSizeLabel("D32"),
      legacyMark: barSizeMark("D35"), legacyLabel: barSizeLabel("D35"), empty: barSizeLabel(""),
      options: barSizeOptions("D35").match(/<option/g).length
    })""")
    check("號數清單 13 個，D32 → #10 / D32（#10）", result["count"] == 13 and result["mark"] == "#10" and result["label"] == "D32（#10）", result)
    check("舊尺寸 D35 保留：mark 原樣、label 加（舊）、下拉多一項", result["legacyMark"] == "D35" and result["legacyLabel"] == "D35（舊）" and result["options"] == 15 and result["empty"] == "", result)
    page.evaluate("""() => { state.members = [createMember({ id: "C1", bars: [{ kind: "主筋", size: "D32", count: "12" }] })]; renderAll?.(); }""")
    text = pdf_text(page, "all")
    check("鋼筋工程 PDF 配筋只印 #10", "#10" in text and "D32" not in text, text[:300])
    page.context.close()

    page = open_clean(browser, "diaphragm-wall-gc")
    page.evaluate("""() => { state.guideWall.checks[5].barNo = "D16"; state.guideWall.checks[5].barSpacing = "20"; activeTool = "guideWall"; renderAll?.(); }""")
    text = pdf_text(page, "current")
    check("導溝 PDF 鋼筋號數印 #5", "號數 #5" in text and "D16" not in text, text[:300])
    page.context.close()
```

並在主程式 `verify_pdf_content(browser)` 之前呼叫 `verify_bar_sizes(browser)`。

> `open_clean` 會等 `exportData` 存在；`rebar.html` 若沒有 `exportData`，把 `page.wait_for_function` 的條件改為 `typeof state === 'object'` 即可（先執行確認）。`pdf_text(page, "all")` 用到 `preparePrint`，rebar.js 若函式名不同，改呼叫該頁的對應函式。

- [x] **Step 6: 執行驗證**

Run: `node --check bar-sizes.js && node --check rebar.js && node --check wall-gc.js && node --check app.js && python3 scripts/verify_data.py`
Expected: 全部 ✅，含新的 4 個案例。

- [x] **Step 7: 瀏覽器確認**

用 `.claude/launch.json` 的 `preview` 開 `/rebar`：配筋組合的號數下拉顯示 `D10（#3）…D57（#18）`；開 `/diaphragm-wall-gc` 導溝第 6 項下拉同樣顯示。`git status` 確認只動到本 Task 列出的檔案。

---

### Task 2: `rebar-cage.js` 資料層與文字產生

**Files:**
- Create: `rebar-cage.js`
- Modify: `sw.js`、`diaphragm-wall-gc.html`、`diaphragm-wall.html`（載入）
- Test: `scripts/verify_data.py`

**Interfaces:**
- Consumes：`barSizeMark`、`barSizeOptions`、`escapeHtml`（Task 1）。
- Produces（全域）：
  - `REBAR_CAGE_PARTS: { key, part, template: "interval"|"single", pair?, mirrorOf?, note? }[]`（13 筆）
  - `REBAR_CAGE_DEFAULT_NOTE = "依設計圖說配置"`
  - `createRebarCageInterval(): { top, bottom, size, spacing, extra: { enabled, size, spacing } }`
  - `createRebarCageParts(): Part[]`
  - `rebarCageDef(key)`、`rebarCageSymmetric(part, parts): boolean`、`rebarCageMirrored(part, parts): boolean`
  - `rebarCagePrintRows(part, parts): { top, bottom, count, bars }[]`（已是列印文字，空值為 `""`）
  - `rebarCageSummary(part, parts): string[]`
  - `rebarCageIntervalIssues(intervals): Set<"top"|"bottom">[]`
  - `normalizeRebarCageParts(parts): Part[]`（補齊缺的部位、修正型別）

- [x] **Step 1: 建立 `rebar-cage.js`（資料層）**

```js
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
```

- [x] **Step 2: 載入與快取**

`diaphragm-wall-gc.html`、`diaphragm-wall.html` 在 `./bar-sizes.js` 之後插入 `<script src="./rebar-cage.js" defer></script>`；`sw.js` 的 `APP_SHELL` 在 `"./bar-sizes.js"` 後加 `"./rebar-cage.js"`。

- [x] **Step 3: 驗證案例**

`scripts/verify_data.py` 新增（放在 `verify_bar_sizes` 之後）：

```python
# ---------------------------------------------------------------- 鋼筋籠部位資料層
def verify_rebar_cage_helpers(browser):
    page = open_clean(browser, "diaphragm-wall-gc")
    result = page.evaluate("""() => {
      const parts = createRebarCageParts();
      const outer = parts[0], inner = parts[1], joint = parts[7], lug = parts[11];
      outer.intervals = [
        { top: "0", bottom: "10", size: "D32", spacing: "60", extra: { enabled: false, size: "", spacing: "" } },
        { top: "20", bottom: "30", size: "D32", spacing: "60", extra: { enabled: true, size: "D32", spacing: "15" } }
      ];
      parts[2].symmetric = true;
      joint.count = "3"; joint.size = "D19";
      lug.spacing = "200";
      const bad = rebarCageIntervalIssues([{ top: "0", bottom: "0" }, { top: "5", bottom: "30" }, { top: "20", bottom: "40" }]);
      return {
        count: parts.length, keys: parts.map(p => p.key).slice(0, 2), part9: REBAR_CAGE_PARTS[8].part,
        outerRows: rebarCagePrintRows(outer, parts), outerSummary: rebarCageSummary(outer, parts),
        innerSummary: rebarCageSummary(inner, parts), mirroredHorizontal: rebarCageMirrored(parts[3], parts), symmetricHorizontal: rebarCageSymmetric(parts[3], parts),
        jointRows: rebarCagePrintRows(joint, parts), lugRows: rebarCagePrintRows(lug, parts),
        issues: bad.map(set => [...set]),
        normalized: normalizeRebarCageParts([{ key: "jointVertical", count: 5, result: "符合" }, { key: "innerVertical", symmetric: true }]).map(p => [p.key, p.count ?? p.intervals.length, p.result, p.symmetric]).slice(0, 8)
      };
    }""")
    check("13 個部位、第 9 項為端板擋筋(母單元)", result["count"] == 13 and result["keys"] == ["outerVertical", "innerVertical"] and result["part9"] == "端板擋筋(母單元)", result)
    check("區間列印文字：GL-0／GL-10／#10@60，補強列 #10@60+#10@15", result["outerRows"] == [
        {"top": "GL-0", "bottom": "GL-10", "count": "", "bars": "#10@60"},
        {"top": "GL-20", "bottom": "GL-30", "count": "", "bars": "#10@60+#10@15"}], result["outerRows"])
    check("卡片摘要 GL-0～-10 #10@60", result["outerSummary"] == ["GL-0～-10 #10@60", "GL-20～-30 #10@60+#10@15"], result["outerSummary"])
    check("內側未連動時摘要為尚未填寫；外側 3 勾對稱 → 內側 4 同外側", result["innerSummary"] == ["尚未填寫"] and result["mirroredHorizontal"] and result["symmetricHorizontal"], result)
    check("單列型：3 支 #6；護耳 @200", result["jointRows"] == [{"top": "", "bottom": "", "count": "3", "bars": "#6"}] and result["lugRows"][0]["bars"] == "@200", result)
    check("紅框：底部≤頂部標 bottom、下一區間淺於上一區間標 top", result["issues"] == [["bottom"], [], ["top"]], result["issues"])
    check("normalize：缺的部位補預設、數字轉字串、內側不存對稱", result["normalized"][7] == ["jointVertical", "5", "符合", False] and result["normalized"][1] == ["innerVertical", 1, "待確認", False] and result["normalized"][0] == ["outerVertical", 1, "待確認", False], result["normalized"])
    page.context.close()
```

主程式在 `verify_bar_sizes(browser)` 後呼叫 `verify_rebar_cage_helpers(browser)`。

- [x] **Step 4: 執行**

Run: `node --check rebar-cage.js && python3 scripts/verify_data.py`
Expected: 新增 7 個案例全部 ✅（此時工具頁的 state 還是舊結構，其餘案例應維持通過）。

---

### Task 3: state、草稿遷移、JSON／Markdown 匯出匯入（兩頁）

**Files:**
- Modify: `wall-gc.js`（state 初始化 511-515、`normalizeLoadedState` 523-532、`clearAllData` 810-838、`exportData` 1034 與 1109-1117、`exportMarkdown` 1215 附近、匯入 1366-1381）
- Modify: `app.js`（對應位置：state 初始化 ~220、`normalizeLoadedState` 236、`clearAllData` 722、`exportData` 1085 與 1168、`exportMarkdown` 1308、匯入 1453）
- Modify: `rebar-cage.js`（匯出／匯入轉換）
- Test: `scripts/verify_data.py`

**Interfaces:**
- Produces（`rebar-cage.js`）：`exportRebarCageParts(cage): object[]`、`importRebarCageParts(records): Part[]`、`rebarCageMarkdownRows(cage): string[]`。
- 兩頁 `state.rebarCage` 形狀：`{ date, cageNo, drawingNo, note, mode: "simple"|"detailed", parts: Part[], checks }`（06 另保留原有欄位）。

- [x] **Step 1: `rebar-cage.js` 加匯出／匯入轉換**

```js
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
```

- [x] **Step 2: `wall-gc.js` state 與草稿遷移**

state 初始化（511-515）改為：

```js
  rebarCage: {
    date: today, cageNo: "", drawingNo: "", note: "",
    mode: "simple",
    parts: createRebarCageParts(),
    checks: REBAR_CAGE_CHECKS.map(([item, standard]) => ({ item, standard, actual: "", result: "待確認" }))
  }
```

刪除第 120 行舊的 `const REBAR_CAGE_PARTS = [...]`（與共用檔同名）。

`normalizeLoadedState` 末尾加：

```js
  // 1.4 以前的草稿：配筋抽查是自由列表 rebars；改成 13 個固定部位後直接重設，模式從簡易開始
  state.rebarCage.mode = state.rebarCage.mode === "detailed" ? "detailed" : "simple";
  state.rebarCage.parts = normalizeRebarCageParts(state.rebarCage.parts);
  delete state.rebarCage.rebars;
```

`clearAllData` 裡 `state.rebarCage = { ... rebars: REBAR_CAGE_PARTS.map(...) ... }` 改為 `mode: "simple", parts: createRebarCageParts(),`。

`loadExample`（807）的 `rebars: REBAR_CAGE_PARTS.map(...)` 改為：

```js
mode: "detailed", parts: exampleRebarCageParts(),
```

並在 `loadExample` 之前新增：

```js
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
```

- [x] **Step 3: `wall-gc.js` 匯出／匯入**

`exportData`：`schema_version: "1.3"` → `"1.4"`；`rebar_cage_review` 裡的 `rebar_items: state.rebarCage.rebars.map(...)` 整段改為：

```js
      mode: state.rebarCage.mode,
      parts: exportRebarCageParts(state.rebarCage),
```

`exportMarkdown`：找出「配筋抽查明細」那段（含 `| 項次 | 位置／用途 | 設計號數 …` 表頭與 `data.rebar_cage_review.rebar_items.map(...)`），整段改為 `...rebarCageMarkdownRows(state.rebarCage),`（表頭已含在回傳值裡）。

匯入（1366-1381）：刪除 `importedRebars`，`state.rebarCage` 改為：

```js
  state.rebarCage = {
    date: importText(rebarCage.review_date),
    cageNo: importText(rebarCage.cage_no),
    drawingNo: importText(rebarCage.drawing_no),
    note: importText(rebarCage.note),
    mode: rebarCage.mode === "detailed" ? "detailed" : "simple",
    parts: importRebarCageParts(rebarCage.parts),   // 1.3 以前的 rebar_items 直接略過
    checks: importChecklistItems(REBAR_CAGE_CHECKS, rebarCage.inspection_items)
  };
```

- [x] **Step 4: `app.js` 同樣處理**

對 `app.js` 重複 Step 2、Step 3（位置：state 初始化 ~220、`normalizeLoadedState` 236、`clearAllData` 722、`loadExample` 718、`exportData` 1085／1168、`exportMarkdown` 1308、匯入 1453），並刪除第 48-52 行舊的 `REBAR_CAGE_PARTS`。`app.js` 的 `state.rebarCage` 若有 `reviewer` 等其他欄位照舊保留。

- [x] **Step 5: 驗證案例**

`scripts/verify_data.py` 的 `verify_roundtrip`：
- `check(f"{tool}：schema 1.3 …` 改為判斷 `first["schema_version"] == "1.4"`，名稱改「schema 1.4」。
- 在 round-trip 比對之前加入詳細模式資料：把 `first = page.evaluate("() => { loadExample(); renderAll?.(); return exportData(); }")` 改為

```python
    first = page.evaluate("""() => { loadExample(); state.rebarCage.mode = "detailed"; renderAll?.(); return exportData(); }""")
    parts = first["rebar_cage_review"]["parts"]
    check(f"{tool}：匯出 13 個部位，主筋第二區間帶補強插筋，內側對稱為推導值", len(parts) == 13 and parts[0]["intervals"][1]["extra"] == {"bar_size": "D32", "spacing_cm": 30} and parts[3]["symmetric"] is True and parts[7]["count"] == 3, json.dumps(parts[:2], ensure_ascii=False)[:400])
```

- 在舊 JSON 案例（`legacy`）裡加 `legacy["rebar_cage_review"].pop("parts", None); legacy["rebar_cage_review"]["rebar_items"] = [{"part": "A 面縱向主筋", "design_bar_size": "D32"}]`，並把該案例的 `after` 回傳多帶 `parts: state.rebarCage.parts.length, mode: state.rebarCage.mode, filled: state.rebarCage.parts[0].intervals[0].size`，判斷 `parts == 13 and mode == "simple" and filled == ""`。
- 舊草稿案例的 `stored.data.rebarCage` 加 `stored.data.rebarCage.rebars = [{ part: "x" }]; delete stored.data.rebarCage.parts; delete stored.data.rebarCage.mode;`，reload 後多判斷 `state.rebarCage.parts.length === 13 && !("rebars" in state.rebarCage)`。

- [x] **Step 6: 執行**

Run: `node --check wall-gc.js && node --check app.js && python3 scripts/verify_data.py`
Expected: 全部 ✅。畫面此時還沒接上新資料（`renderRebars` 仍讀 `rebars`），頁面載入會在 `renderRebars` 拋錯 → 若 `pageerror` 出現，先把兩頁的 `renderRebars()` 內容暫時改成只更新進度 `${state.rebarCage.parts.filter(p => p.result !== "待確認").length} / 13`，Task 4 再完整實作。

---

### Task 4: 畫面 — 模式切換、卡片、填寫彈出視窗（兩頁）

**Files:**
- Modify: `rebar-cage.js`（畫面產生器、對話框、藥丸）
- Modify: `diaphragm-wall-gc.html:215-227`、`diaphragm-wall-gc.html:278-295`
- Modify: `diaphragm-wall.html`（對應的 `#panel-cage-rebar`、`#rebar-dialog`）
- Modify: `wall-gc.js`（`renderRebars` 761-776、刪 `openRebarDialog` 840-854、刪 `removeRebar` 867-874、`editIndex` 536、事件 1540-1563）
- Modify: `app.js`（`renderRebars` 631、`openRebarDialog` 804、`removeRebar` 843、`editIndex.rebar`、事件 1610／1650／1681）
- Modify: `app.css`

**Interfaces:**
- Produces（`rebar-cage.js`）：`rebarCageCardsHtml(cage, resultSegmented): string`、`bindRebarCageUi({ getCage, onChange })`、`syncRebarCageModeTabs(mode, animate)`。
- Consumes：各頁既有的 `resultSegmented(name, selected, attrs)`。

- [x] **Step 1: HTML — 配筋抽查明細分頁**

`diaphragm-wall-gc.html` 221-227 改為：

```html
          <section class="tab-panel" id="panel-cage-rebar" role="tabpanel" aria-labelledby="tab-cage-rebar" hidden>
            <div class="panel-heading">
              <div><span>01</span><h2>配筋抽查明細</h2></div>
              <div class="t-tabs" id="rebar-cage-mode-tabs" role="tablist" aria-label="填寫模式">
                <span class="t-tabs-pill" aria-hidden="true"></span>
                <button class="t-tab" role="tab" type="button" aria-selected="true" data-cage-mode="simple">簡易</button>
                <button class="t-tab" role="tab" type="button" aria-selected="false" data-cage-mode="detailed">詳細</button>
              </div>
            </div>
            <div class="check-card-list" id="rebar-cage-rebar-list"></div>
          </section>
```

216 行進度改 `<dd id="rebar-cage-rebar-progress">0 / 13</dd>`。

> 注意：這兩顆 `role="tab"` 會被各頁 `$$('[role="tab"]')` 的分頁鍵盤處理接到，`showTab(button.dataset.tab)` 會拿到 `undefined`。把該處選擇器改成 `$$('.tab-row [role="tab"]')`（兩頁都要）。

`#rebar-dialog`（278-295）改為：

```html
    <dialog class="sheet-dialog" id="rebar-dialog">
      <form id="rebar-form" novalidate>
        <div class="dialog-header"><div><span class="dialog-eyebrow">REBAR CHECK</span><h2 id="rebar-dialog-title">填寫配筋</h2></div><button type="button" data-close-dialog aria-label="關閉">×</button></div>
        <div class="dialog-body" id="rebar-part-fields"></div>
        <div class="dialog-actions"><button class="secondary-button" type="button" data-close-dialog>取消</button><button class="confirm-button" type="submit">確認更新</button></div>
      </form>
    </dialog>
```

`diaphragm-wall.html` 對應區塊照做（`panel-cage-rebar` 的 `<span>` 編號沿用該頁原本的）。

- [x] **Step 2: `rebar-cage.js` 畫面產生器**

```js
// ---- 畫面 ----
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
      <div class="check-card-head"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(def.part)}</strong>${symmetric}${fill}</div>
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
  return field === "top" || field === "bottom";   // 深度改了要重算紅框
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
```

- [x] **Step 3: 兩頁工具 script 接線**

`wall-gc.js`：
- `renderRebars` 改為：

```js
function renderRebars() {
  const cage = state.rebarCage;
  $("#rebar-cage-rebar-list").innerHTML = rebarCageCardsHtml(cage, resultSegmented);
  $("#rebar-cage-rebar-progress").textContent = `${cage.parts.filter(part => part.result !== "待確認").length} / ${cage.parts.length}`;
  syncRebarCageModeTabs(cage.mode);
}
```

- 刪除 `openRebarDialog`、`removeRebar`；`editIndex` 改為 `const editIndex = {};`（若無其他用途則整行刪除並移除引用）。
- 事件區：刪除 `$("#add-rebar")…`、`$("#rebar-form").addEventListener("submit", …)` 整段、`document.addEventListener("click", … data-edit-rebar / data-delete-rebar …)` 整段；在 `draft.watch();` 之前加 `bindRebarCageUi({ getCage: () => state.rebarCage, onChange: renderRebars });`。
- `$$('[role="tab"]')` 改 `$$('.tab-row [role="tab"]')`。
- `document.addEventListener("input", …)` 裡處理 `[data-check-item]` 的段落不受影響（新卡片沒有這個屬性）。

`app.js`：同樣處理（`editIndex` 保留 `soil/depth/truck`，只拿掉 `rebar`）。

- [x] **Step 4: CSS（`app.css`，放在 `.rebar-card` 規則附近；`@media print` 之外）**

```css
/* 配筋抽查明細：簡易／詳細切換（Transitions.dev 藥丸，顏色改用 glass 變數） */
.t-tabs { --tabs-dur: 250ms; --tabs-ease: cubic-bezier(0.22, 1, 0.36, 1); position: relative; display: inline-flex; align-items: center; gap: 3px; padding: 3px; border-radius: 48px; background: var(--glass-sunken); box-shadow: var(--glass-hairline); }
.t-tab { position: relative; z-index: 1; appearance: none; border: 0; background: transparent; height: 30px; padding: 4px 14px; border-radius: 48px; color: var(--glass-muted); font: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: color var(--tabs-dur) var(--tabs-ease); }
.t-tab[aria-selected="true"], .t-tab:not([aria-selected="true"]):hover { color: var(--glass-ink); }
.t-tabs-pill { position: absolute; top: 3px; left: 0; z-index: 0; width: 0; height: 30px; border-radius: 48px; background: var(--glass-card-bg); box-shadow: var(--glass-lift-shadow); transform: translateX(0); transition: transform var(--tabs-dur) var(--tabs-ease), width var(--tabs-dur) var(--tabs-ease); will-change: transform, width; pointer-events: none; }
@media (prefers-reduced-motion: reduce) { .t-tabs-pill, .t-tab { transition: none !important; } }

.rebar-part-card .check-card-head { grid-template-columns: auto minmax(0, 1fr) auto auto; }
.rebar-symmetric { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--glass-soft); }
.rebar-symmetric input { width: 16px; height: 16px; margin: 0; accent-color: var(--glass-accent); }
.rebar-fill-button { min-height: 30px; padding: 0 12px; border: 0; border-radius: 999px; background: var(--glass-accent-soft); color: var(--glass-accent-strong); font: inherit; font-size: 0.8125rem; font-weight: 600; }
.rebar-part-summary { display: grid; gap: 2px; margin: 4px 0 0; font-family: var(--glass-font-num); font-size: 0.8125rem; color: var(--glass-ink); }
.rebar-part-summary.is-mirrored { color: var(--glass-muted); font-family: inherit; }
.rebar-part-fields { grid-template-columns: minmax(0, 1fr); }

.rebar-interval { margin: 0 0 12px; padding: 10px 12px 12px; border: 1px solid var(--glass-line); border-radius: var(--glass-radius-sm); }
.rebar-interval legend { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0; font-size: 0.8125rem; font-weight: 600; color: var(--glass-soft); }
.rebar-interval-remove { border: 0; background: transparent; color: var(--glass-danger-ink); font: inherit; font-size: 0.75rem; }
.three-fields { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.gl-input { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 6px; }
.gl-input em { font-style: normal; font-size: 0.8125rem; color: var(--glass-soft); white-space: nowrap; }
.gl-field.is-invalid input { box-shadow: inset 0 0 0 1.5px var(--glass-danger); }
.rebar-extra-toggle { flex-direction: row; align-items: center; gap: 8px; }
.rebar-extra-toggle input { width: 18px; height: 18px; margin: 0; accent-color: var(--glass-accent); }
```

> `.check-card-head`／`.field` 的既有規則若與上面衝突（例如 `.field` 是 `display:grid`），以實際畫面為準微調，目標是卡片標題列一行擺下「編號｜部位｜對稱｜填寫」。

- [x] **Step 5: 語法檢查與驗證腳本**

`scripts/verify_data.py` 新增：

```python
# ---------------------------------------------------------------- 鋼筋籠畫面
def verify_rebar_cage_ui(browser, html):
    page = open_clean(browser, html)
    page.evaluate("() => { showTool('rebarCage'); showTab('cage-rebar'); }")
    result = page.evaluate("""() => {
      const cards = () => document.querySelectorAll('#rebar-cage-rebar-list .rebar-part-card');
      const simpleCount = cards().length, simpleFill = document.querySelectorAll('[data-edit-part]').length;
      document.querySelector('[data-cage-mode="detailed"]').click();
      const detailedFill = document.querySelectorAll('[data-edit-part]').length;
      document.querySelector('[data-part-symmetric="2"]').click();
      const mirroredText = cards()[3].querySelector('.rebar-part-summary').textContent;
      const mirroredFill = cards()[3].querySelector('[data-edit-part]');
      document.querySelector('[data-edit-part="0"]').click();
      const dialogOpen = document.querySelector('#rebar-dialog').open;
      document.querySelector('[data-add-interval]').click();
      const intervals = document.querySelectorAll('.rebar-interval').length;
      const inputs = document.querySelectorAll('.rebar-interval');
      const set = (i, field, value) => { const el = inputs[i].querySelector(`[data-interval-field="${field}"]`); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      set(0, 'top', '0'); set(0, 'bottom', '10');
      const after = document.querySelectorAll('.rebar-interval');
      const t2 = after[1].querySelector('[data-interval-field="top"]'); t2.value = '5'; t2.dispatchEvent(new Event('input', { bubbles: true })); t2.dispatchEvent(new Event('change', { bubbles: true }));
      const invalid = document.querySelectorAll('.gl-field.is-invalid').length;
      document.querySelector('#rebar-form').requestSubmit();
      const summary = cards()[0].querySelector('.rebar-part-summary').textContent;
      const pill = document.querySelector('.t-tabs-pill').style.width;
      return { simpleCount, simpleFill, detailedFill, mirroredText, mirroredFill: !!mirroredFill, dialogOpen, intervals, invalid, summary, mode: state.rebarCage.mode, top2: state.rebarCage.parts[0].intervals[1].top, pill };
    }""")
    check(f"{html}：簡易 13 張卡片、沒有填寫鈕；切詳細後有填寫鈕", result["simpleCount"] == 13 and result["simpleFill"] == 0 and result["detailedFill"] == 11 and result["mode"] == "detailed", result)
    check(f"{html}：外側 3 勾對稱 → 內側 4 顯示同外側且無填寫鈕", "同外側" in result["mirroredText"] and not result["mirroredFill"], result)
    check(f"{html}：填寫視窗可加區間、下一區間頂部淺於上一區間底部標紅框、確認後寫回摘要", result["dialogOpen"] and result["intervals"] == 2 and result["invalid"] == 1 and result["top2"] == "5" and "GL-0～-10" in result["summary"], result)
    check(f"{html}：藥丸有量到寬度", result["pill"].endswith("px") and result["pill"] != "0px", result["pill"])
    page.context.close()
```

主程式加 `verify_rebar_cage_ui(browser, "diaphragm-wall-gc")` 與 `verify_rebar_cage_ui(browser, "diaphragm-wall")`。

Run: `node --check rebar-cage.js wall-gc.js app.js && python3 scripts/verify_data.py`
Expected: 全部 ✅。

- [x] **Step 6: 瀏覽器實際操作（兩頁）**

用 preview 開 `/diaphragm-wall-gc` → 鋼筋籠 → 配筋抽查明細：
1. 藥丸初始就貼在「簡易」上（沒有從左邊滑進來）；點「詳細」會滑過去。
2. 詳細模式第 1 項按「填寫」：加第二個區間、第二區間頂部打 5 → 頂部紅框；補強插筋勾了才出現號數／間距。
3. 頂部打 `-12` 失焦變 `12`。
4. 第 3 項勾對稱 → 第 4 項變「同外側」。
5. 切回簡易 → 再切詳細，資料還在。
6. 手機寬度（375px）看卡片標題列與對話框不爆版。
`/diaphragm-wall` 重複 1～5。

---

### Task 5: PDF 兩張表（兩頁）

**Files:**
- Modify: `rebar-cage.js`（`rebarCagePrintTableHtml`）
- Modify: `wall-gc.js:974-983`、`app.js:1002-1010`（列印區塊）
- Modify: `app.css:1089-1106`（列印欄寬）
- Test: `scripts/verify_data.py`、`scripts/verify_print_layout.py`

**Interfaces:**
- Produces：`rebarCagePrintTableHtml(cage): string`（整個 `<table class="print-table rebar-cage-print-table is-simple|is-detailed">`）。

- [x] **Step 1: `rebar-cage.js` 列印表格**

```js
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
```

- [x] **Step 2: 兩頁列印區塊**

`wall-gc.js` 974 行的 `const rebarRows = …` 整行刪除；983 行的 `<section class="print-section compact-print-section"><h2>配筋抽查明細</h2><table …>…</table></section>` 改為：

```js
    <section class="print-section compact-print-section"><h2>配筋抽查明細</h2>${rebarCagePrintTableHtml(state.rebarCage)}</section>
```

`app.js` 1002／1010 行同樣處理。

- [x] **Step 3: 列印 CSS（`app.css` `@media print` 內，取代 1095 行裡 `.rebar-cage-print-table th:first-child` 那一段的欄寬）**

```css
  .rebar-cage-print-table th:first-child { width: 7%; }
  .rebar-cage-print-table.is-simple th:nth-child(2) { width: 26%; }
  .rebar-cage-print-table.is-simple th:last-child { width: 12%; }
  .rebar-cage-print-table.is-detailed th:nth-child(2) { width: 20%; }
  .rebar-cage-print-table.is-detailed th:nth-child(3), .rebar-cage-print-table.is-detailed th:nth-child(4) { width: 10%; }
  .rebar-cage-print-table.is-detailed th:nth-child(5), .rebar-cage-print-table.is-detailed th:nth-child(7) { width: 7%; }
  .rebar-cage-print-table.is-detailed th:last-child { width: 12%; }
  .rebar-cage-print-table.is-detailed tr.part-has-more > td:nth-child(1), .rebar-cage-print-table.is-detailed tr.part-has-more > td:nth-child(2),
  .rebar-cage-print-table.is-detailed tr.part-has-more > td:nth-child(7), .rebar-cage-print-table.is-detailed tr.part-has-more > td:nth-child(8) { border-bottom: 0; }
  .rebar-cage-print-table.is-detailed tr.part-continued > td:nth-child(1), .rebar-cage-print-table.is-detailed tr.part-continued > td:nth-child(2),
  .rebar-cage-print-table.is-detailed tr.part-continued > td:nth-child(7), .rebar-cage-print-table.is-detailed tr.part-continued > td:nth-child(8) { border-top: 0; }
```

1095 行原本的選擇器把 `.rebar-cage-print-table th:first-child` 從共用那行移除（改由上面單獨設定）。

- [x] **Step 4: 驗證**

`scripts/verify_data.py` 的 `verify_pdf_content` 營造廠版案例後加：

```python
    page = open_clean(browser, "diaphragm-wall-gc", "?example=1")
    page.evaluate("() => { activeTool = 'rebarCage'; state.rebarCage.mode = 'simple'; renderAll?.(); }")
    simple = pdf_text(page, "current")
    check("鋼筋籠 PDF 簡易表：說明欄與端板擋筋銲接文字", "依設計圖說配置，銲喉4mm且銲長至少50mm" in simple and "頂部(m)" not in simple, simple[:300])
    page.evaluate("() => { state.rebarCage.mode = 'detailed'; renderAll?.(); }")
    detailed = pdf_text(page, "current")
    check("鋼筋籠 PDF 詳細表：區間、補強、同外側、支數都印出", all(s in detailed for s in ["頂部(m)", "GL-20", "#10@60+#10@30", "✔", "3", "@200"]) and "依設計圖說配置" not in detailed, detailed[:400])
    page.context.close()
```

`scripts/verify_print_layout.py` 的 `FILL` 兩個連續壁項目字串結尾各加：

```
 state.rebarCage.mode='detailed'; state.rebarCage.parts.forEach(p => { if (p.intervals) p.intervals = [0,1,2].map(i => ({ top: String(i*10), bottom: String(i*10+10), size: 'D32', spacing: '60', extra: { enabled: i === 2, size: 'D32', spacing: '15' } })); });
```

Run: `python3 scripts/verify_data.py && python3 scripts/verify_print_layout.py`
Expected: 全部 ✅（含「many」情境鋼筋籠頁跨到第二頁時簽名欄仍貼齊頁底）。

- [x] **Step 5: 目視**

用 scratchpad 的 `render_guide_wall.py` 改成 `activeTool = 'rebarCage'`，兩種模式各出一張 PNG 看：詳細表多區間的項次／部位／對稱／結果看起來是合併格；欄寬夠放 `#10@60+#10@30` 不折行；簡易表說明欄第 9 項一行放得下。不合適就調 Step 3 的百分比。

---

### Task 6: 文件、範例與收尾

**Files:**
- Modify: `docs/check-items/diaphragm-wall-gc-inspection.md`、`docs/check-items/diaphragm-wall-field-record.md`
- Modify: `README.md`（若有 schema／欄位說明）
- Regenerate: `examples/*.pdf`、`examples/pages/*`（`scripts/render_example_pdfs.py`）

- [x] **Step 1: 檢查項目清單**

兩份 md 的「鋼筋籠吊放前複核－配筋部位」段落改為：

```
## 鋼筋籠吊放前複核－配筋部位

1. 外側 垂直 主筋
2. 內側 垂直 主筋
3. 外側 水平 溫度筋
4. 內側 水平 溫度筋
5. 水平 正交繫筋
6. 垂直 小斜拉筋
7. 水平 小斜拉筋
8. 單元接頭垂直補強筋
9. 端板擋筋(母單元)
10. V型固定加強筋
11. 交叉大斜拉筋
12. 垂直護耳
13. 水平護耳
```

- [x] **Step 2: README**

Run: `grep -n "rebar_items\|schema_version\|1\.3\|設計號數" README.md`
若有提到 JSON 欄位或版本，改為 1.4 與 `parts`／`mode` 的說明（一句話即可）。

- [x] **Step 3: 重新產生範例**

Run: `python3 scripts/render_example_pdfs.py`
Expected: `examples/` 下的 PDF 與 `examples/pages/` 圖片更新（含先前導溝項目改名後已過期的範例）。用 preview 開 `/example?file=gc-rebar-cage-example` 看詳細表。

- [x] **Step 4: 全部驗證與範圍確認**

Run: `python3 scripts/verify_data.py && python3 scripts/verify_print_layout.py && git status && git diff --stat`
Expected: 全 ✅；改動檔案僅限本計畫列出的檔案與 `examples/`。

---

## Self-Review

- Spec 覆蓋：號數清單（T1）、13 部位與資料結構（T2/T3）、模式切換與卡片／彈出視窗／紅框／對稱連動（T4）、兩張 PDF（T5）、匯出匯入與草稿（T3）、鋼筋工程與導溝（T1）、共用檔與 sw.js（T1/T2）、驗證與文件與範例（各 Task／T6）。
- 名稱一致：`createRebarCageParts`／`normalizeRebarCageParts`／`rebarCagePrintRows`／`rebarCageSummary`／`rebarCageIntervalIssues`／`rebarCageCardsHtml`／`bindRebarCageUi`／`syncRebarCageModeTabs`／`rebarCagePrintTableHtml`／`exportRebarCageParts`／`importRebarCageParts`／`rebarCageMarkdownRows` 在各 Task 相同。
- 已知風險：`.check-card-head` 既有 grid 欄位數可能與新卡片不合，T4 Step 4 註明以畫面為準調整；`open_clean` 對 rebar.html 的等待條件在 T1 Step 5 註明。
