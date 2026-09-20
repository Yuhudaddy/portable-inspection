# 施工計畫頁、編號欄位、構件刪除 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 五個工具頁右上角改為「計畫」按鈕，開啟共用的施工計畫頁（精簡／完整兩版、封面、修訂紀錄、目錄、可印 PDF）；01／06 的導溝改用軸線／方向編號、鋼筋籠與連續壁同步單元／順序編號；02／03 的構件可用二階段按鈕刪除。

**Architecture:** 新增 `plan.html` + `plan.js` + `plan.css` 一組共用頁面，內容以 `plans/<work>.js` 的資料結構（章節／區塊，標 brief／full）提供，彩現器負責編號、目錄、版本過濾與列印。工具頁只改 header 與說明。編號欄位與刪除是各工具 script 的局部修改。

**Tech Stack:** Vanilla JS（classic script）、CSS、既有 `draft.js`／`print-pages.js`（只用 `setPrintDocumentTitle`）、Playwright + PyMuPDF 驗證。

**Spec:** `docs/superpowers/specs/2026-09-20-construction-plan-page-design.md`

## Global Constraints

- classic script 共用全域詞法環境：新檔案的頂層名稱不得與任何已載入 script 重複（計畫頁只載 `draft.js`、`print-pages.js`、`plans/*.js`、`plan.js`）。
- `sw.js`：新增檔案都要進 `APP_SHELL`，`CACHE_NAME` 由 `portable-inspection-v99` 升到 `portable-inspection-v100`。
- 顏色只用 `glass.css` 既有變數或極淡色（明度 ≥ 94%），不新增鮮豔色。
- 規範內容視為資料：只引規範名稱、章節／條號與數值，不整段抄錄；每個數值要註明出處。
- 台灣用語：模板、鋼筋、鋼構、坍度、保護層、續接器、澆置。
- 驗證：`python3 scripts/verify_data.py`、`python3 scripts/verify_print_layout.py` 全 ✅ 才算完成該 Task。
- 不 commit（使用者最後統一處理）；每個 Task 結尾 `git status --short` 確認範圍。

---

## File Structure

| 檔案 | 責任 |
|------|------|
| `plan.html`（新） | 計畫頁骨架：header（返回、版本下拉、輸出）、封面、修訂紀錄、目錄、正文容器、說明對話框 |
| `plan.js`（新） | 解析網址、載入 `PLAN_CONTENT[work]`、草稿、彩現、版本切換、列印標題 |
| `plan.css`（新） | 文件版面（螢幕、列印） |
| `plans/diaphragm-wall.js`、`plans/formwork.js`、`plans/rebar.js`、`plans/steel.js`（新） | 各工程內容資料 |
| `diaphragm-wall-gc.html`、`diaphragm-wall.html`、`template.html`、`rebar.html`、`steel-structure.html` | header 計畫按鈕、說明、（01／06）編號欄位 |
| `wall-gc.js`、`app.js` | 編號同步、導溝 axisNo、PDF／JSON／Markdown、schema 1.5 |
| `template.js`、`rebar.js`、`glass.css` | 二階段刪除、0 筆狀態 |
| `sw.js`、`README.md`、`scripts/verify_data.py`、`scripts/verify_print_layout.py` | 快取、文件、驗證 |

---

### Task 1: 計畫頁骨架（先用連續壁的章節大綱當內容）

**Files:**
- Create: `plan.html`、`plan.js`、`plan.css`、`plans/diaphragm-wall.js`（本 Task 只放大綱與每節一段引言，Task 6 補完整內容）
- Modify: `sw.js`
- Test: `scripts/verify_data.py`

**Interfaces:**
- Produces（全域）：`PLAN_CONTENT`（物件，key 為 work）；`plan.js` 內部函式 `renderPlan()`、`visibleSections(version)`、`planFileName()`。
- 內容資料格式見 spec「內容資料格式」。

- [x] **Step 1: `plans/diaphragm-wall.js` 大綱**

```js
// 連續壁工程施工計畫（01 營造廠查驗、06 施工紀錄共用）。內容資料：章節 → 區塊；level "brief" 兩版都有、"full" 只有完整版。
window.PLAN_CONTENT = window.PLAN_CONTENT || {};
PLAN_CONTENT["diaphragm-wall"] = {
  title: "連續壁工程施工計畫",
  subtitle: "DIAPHRAGM WALL CONSTRUCTION PLAN",
  sources: [
    "建築工程地下連續壁施工準則（TGS-EXCAVD114）",
    "建築物基礎開挖工程監測準則（TGS-EXCAVM114）",
    "結構混凝土施工規範（內政部，2021）",
    "公共工程施工綱要規範 相關章節（連續壁、鋼筋、結構用混凝土）"
  ],
  sections: [
    { id: "overview", heading: "工程概述", level: "brief", blocks: [{ type: "p", text: "本計畫適用於本工程地下連續壁之導溝、成槽、鋼筋籠製作吊放與混凝土澆置作業，作為施工、自主檢查與查驗放行之依據。" }] },
    { id: "codes", heading: "適用規範與參考文件", level: "brief", blocks: [{ type: "p", text: "（Task 6 補）" }] },
    { id: "organization", heading: "施工組織與人力", level: "full", blocks: [{ type: "p", text: "（Task 6 補）" }] },
    { id: "equipment", heading: "機具設備與材料", level: "brief", blocks: [{ type: "p", text: "（Task 6 補）" }] },
    { id: "workflow", heading: "施工流程", level: "brief", blocks: [{ type: "ol", items: ["導溝施工", "成槽與穩定液管理", "鋼筋籠製作與吊放", "特密管混凝土澆置", "壁頂處理與監測"] }] },
    { id: "method", heading: "施工方法與要點", level: "brief", blocks: [{ type: "p", text: "（Task 6 補）" }] },
    { id: "quality", heading: "品質管制", level: "brief", blocks: [{ type: "p", text: "（Task 6 補）" }] },
    { id: "safety", heading: "安全衛生", level: "brief", blocks: [{ type: "p", text: "（Task 6 補）" }] },
    { id: "environment", heading: "環境保護", level: "full", blocks: [{ type: "p", text: "（Task 6 補）" }] },
    { id: "schedule", heading: "進度與介面管理", level: "full", blocks: [{ type: "p", text: "（Task 6 補）" }] },
    { id: "emergency", heading: "緊急應變", level: "full", blocks: [{ type: "p", text: "（Task 6 補）" }] },
    { id: "appendix", heading: "附錄：查驗表對照", level: "full", blocks: [{ type: "p", text: "（Task 6 補）" }] }
  ]
};
```

> 「（Task 6 補）」只在本 Task 暫存，Task 6 必須全部替換；Task 9 的驗證會 grep 確認沒有殘留。

- [x] **Step 2: `plan.html`**

```html
<!doctype html>
<html lang="zh-Hant-TW">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#ffffff" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Portable Inspection" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="icon" href="./icon-192.png" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <link rel="stylesheet" href="./glass.css" />
    <link rel="stylesheet" href="./plan.css" />
    <title>施工計畫｜Portable Inspection</title>
  </head>
  <body>
    <header class="app-header">
      <nav class="header-nav" aria-label="主要功能">
        <a class="glass-pill header-back" id="back-link" href="./"><svg width="10" height="16" viewBox="0 0 12 20" fill="none" aria-hidden="true"><path d="M10 2L2 10l8 8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span id="back-label">工具</span></a>
        <div class="header-actions">
          <label class="glass-pill version-pill"><span class="sr-only">版本</span><select id="plan-version" aria-label="計畫版本"><option value="brief">精簡版</option><option value="full">完整版</option></select></label>
          <button class="glass-pill header-print" id="print-button" type="button"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg>輸出 PDF</button>
        </div>
      </nav>
    </header>

    <main class="plan-shell" id="plan">
      <p class="plan-missing" id="plan-missing" hidden>找不到這份計畫。<a href="./">回工具首頁</a></p>
      <section class="plan-cover" id="plan-cover" aria-label="封面">
        <img class="plan-logo" src="./taisei.png" alt="" />
        <p class="plan-kicker" id="plan-subtitle"></p>
        <h1 id="plan-title"></h1>
        <dl class="plan-cover-grid">
          <div><dt>工程名稱</dt><dd><input type="text" data-cover="project" placeholder="請輸入工程名稱" /></dd></div>
          <div><dt>施工廠商</dt><dd><input type="text" data-cover="contractor" placeholder="請輸入施工廠商" /></dd></div>
          <div><dt>編製單位</dt><dd><input type="text" data-cover="author" placeholder="例如：工務所" /></dd></div>
          <div><dt>編製日期</dt><dd><input type="date" data-cover="date" /></dd></div>
        </dl>
        <p class="plan-cover-foot"><span>版次 <input type="text" class="inline-input" data-cover="revision" size="3" /></span><span id="plan-version-label">精簡版</span></p>
      </section>

      <section class="plan-block" id="plan-revisions" aria-labelledby="revisions-heading">
        <h2 id="revisions-heading">修訂紀錄</h2>
        <table class="plan-table revisions-table"><thead><tr><th>版次</th><th>日期</th><th>修訂內容</th><th>編製</th><th class="no-print"></th></tr></thead><tbody id="revision-rows"></tbody></table>
        <button class="add-button compact-button no-print" id="add-revision" type="button"><span aria-hidden="true">＋</span> 新增一列</button>
        <h3>參考規範與文件</h3>
        <ol class="plan-sources" id="plan-sources"></ol>
      </section>

      <div class="plan-body-wrap">
        <nav class="plan-toc" id="plan-toc" aria-label="目錄">
          <details class="plan-toc-details" open><summary>目錄</summary><ol id="toc-list"></ol></details>
        </nav>
        <article class="plan-article" id="plan-article"></article>
      </div>
    </main>

    <script src="./draft.js" defer></script>
    <script src="./print-pages.js" defer></script>
    <script src="./plans/diaphragm-wall.js" defer></script>
    <script src="./plans/formwork.js" defer></script>
    <script src="./plans/rebar.js" defer></script>
    <script src="./plans/steel.js" defer></script>
    <script src="./plan.js" defer></script>
    <script src="./sw-client.js" defer></script>
  </body>
</html>
```

> Task 1 先建立 `plans/formwork.js`、`plans/rebar.js`、`plans/steel.js` 三個只含 `title`／`subtitle`／`sources: []`／`sections: []` 的空殼，避免 404；Task 7～8 再填。

- [x] **Step 3: `plan.js`**

```js
// 施工計畫頁：?work=<diaphragm-wall|formwork|rebar|steel>&from=<工具頁>。
// 正文來自 plans/<work>.js（PLAN_CONTENT），封面與修訂紀錄存本機草稿；精簡版只取 level "brief" 的章節與區塊。
const PLAN_WORKS = ["diaphragm-wall", "formwork", "rebar", "steel"];
const PLAN_FROM = {
  "diaphragm-wall-gc": { label: "營造廠查驗表", draft: "project-portal.diaphragmWallGc.draft" },
  "diaphragm-wall": { label: "施工紀錄", draft: "project-portal.diaphragmWall.draft" },
  "template": { label: "模板複核表", draft: "project-portal.template.draft" },
  "rebar": { label: "鋼筋查驗表", draft: "project-portal.rebar.draft" },
  "steel-structure": { label: "鋼構複核表", draft: "project-portal.steel.draft" }
};
const VERSION_LABEL = { brief: "精簡版", full: "完整版" };
const params = new URLSearchParams(location.search);
const work = PLAN_WORKS.includes(params.get("work")) ? params.get("work") : null;
const from = PLAN_FROM[params.get("from")] ? params.get("from") : null;
const content = work ? PLAN_CONTENT[work] : null;
const localDate = new Date();
const today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

const state = {
  version: "brief",
  cover: { project: "", contractor: "", author: "", date: today, revision: "A" },
  revisions: [{ version: "A", date: today, note: "初版", author: "" }]
};
const draft = work ? createDraftStore(`project-portal.plan.${work}.draft`, () => state) : null;

// 第一次開啟：工程名稱、廠商從工具頁草稿帶入
function prefillFromTool() {
  if (!from || state.cover.project || state.cover.contractor) return;
  try {
    const stored = JSON.parse(localStorage.getItem(PLAN_FROM[from].draft));
    const overview = stored?.data?.overview || {};
    state.cover.project = String(overview.project || "");
    state.cover.contractor = String(overview.contractor || "");
  } catch (error) { /* 沒有草稿就留空 */ }
}

function visibleSections(version) {
  const keep = section => version === "full" || section.level !== "full";
  const trim = section => ({
    ...section,
    blocks: (section.blocks || []).filter(block => version === "full" || block.level !== "full"),
    children: (section.children || []).filter(keep).map(trim)
  });
  return content.sections.filter(keep).map(trim);
}

function blockHtml(block) {
  switch (block.type) {
    case "p": return `<p>${esc(block.text)}</p>`;
    case "ul": return `<ul>${block.items.map(item => `<li>${esc(item)}</li>`).join("")}</ul>`;
    case "ol": return `<ol class="plan-steps">${block.items.map(item => `<li>${esc(item)}</li>`).join("")}</ol>`;
    case "callout": return `<aside class="plan-callout"><strong>${esc(block.title)}</strong><p>${esc(block.text)}</p></aside>`;
    case "table": return `<figure class="plan-figure">${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ""}<table class="plan-table"><thead><tr>${block.head.map(cell => `<th>${esc(cell)}</th>`).join("")}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>${block.note ? `<p class="plan-note">${esc(block.note)}</p>` : ""}</figure>`;
    default: return "";
  }
}

function sectionHtml(section, number, depth) {
  const tag = depth === 0 ? "h2" : "h3";
  return `<section class="plan-section" id="section-${esc(section.id)}">
    <${tag}><span class="plan-number">${number}</span>${esc(section.heading)}</${tag}>
    ${(section.blocks || []).map(blockHtml).join("")}
    ${(section.children || []).map((child, index) => sectionHtml(child, `${number}.${index + 1}`, depth + 1)).join("")}
  </section>`;
}

function renderArticle() {
  const sections = visibleSections(state.version);
  $("#plan-article").innerHTML = sections.map((section, index) => sectionHtml(section, String(index + 1), 0)).join("");
  $("#toc-list").innerHTML = sections.map((section, index) => `<li><a href="#section-${esc(section.id)}"><span class="plan-number">${index + 1}</span>${esc(section.heading)}</a>${section.children?.length ? `<ol>${section.children.map((child, childIndex) => `<li><a href="#section-${esc(child.id)}"><span class="plan-number">${index + 1}.${childIndex + 1}</span>${esc(child.heading)}</a></li>`).join("")}</ol>` : ""}</li>`).join("");
  $("#plan-version-label").textContent = VERSION_LABEL[state.version];
  $("#plan-version").value = state.version;
}

function renderCover() {
  document.querySelectorAll("[data-cover]").forEach(input => { input.value = state.cover[input.dataset.cover] ?? ""; });
  $("#plan-title").textContent = content.title;
  $("#plan-subtitle").textContent = content.subtitle;
  $("#plan-sources").innerHTML = content.sources.map(item => `<li>${esc(item)}</li>`).join("");
}

function renderRevisions() {
  $("#revision-rows").innerHTML = state.revisions.map((row, index) => `<tr>
    <td><input type="text" data-revision="version" data-index="${index}" value="${esc(row.version)}" size="3" /></td>
    <td><input type="date" data-revision="date" data-index="${index}" value="${esc(row.date)}" /></td>
    <td><input type="text" data-revision="note" data-index="${index}" value="${esc(row.note)}" /></td>
    <td><input type="text" data-revision="author" data-index="${index}" value="${esc(row.author)}" /></td>
    <td class="no-print">${state.revisions.length > 1 ? `<button type="button" class="link-button" data-remove-revision="${index}">移除</button>` : ""}</td>
  </tr>`).join("");
}

function renderPlan() { renderCover(); renderRevisions(); renderArticle(); }

function planFileName() {
  return [content.title, state.cover.project, VERSION_LABEL[state.version], state.cover.date || today];
}

function initialize() {
  if (!content) {
    $("#plan-missing").hidden = false;
    ["#plan-cover", "#plan-revisions", ".plan-body-wrap"].forEach(selector => { $(selector).hidden = true; });
    return;
  }
  document.title = `${content.title}｜Portable Inspection`;
  if (from) { $("#back-link").href = `./${from}`; $("#back-label").textContent = PLAN_FROM[from].label; }
  Object.assign(state, draft.load() ?? {});
  prefillFromTool();
  renderPlan();
  draft.watch();

  $("#plan-version").addEventListener("change", event => { state.version = event.target.value === "full" ? "full" : "brief"; renderArticle(); });
  document.addEventListener("input", event => {
    const cover = event.target.closest("[data-cover]");
    const revision = event.target.closest("[data-revision]");
    if (cover) state.cover[cover.dataset.cover] = cover.value;
    if (revision) state.revisions[Number(revision.dataset.index)][revision.dataset.revision] = revision.value;
  });
  document.addEventListener("click", event => {
    if (event.target.closest("#add-revision")) { state.revisions.push({ version: "", date: today, note: "", author: "" }); renderRevisions(); }
    const remove = event.target.closest("[data-remove-revision]");
    if (remove) { state.revisions.splice(Number(remove.dataset.removeRevision), 1); renderRevisions(); }
  });
  $("#print-button").addEventListener("click", () => { setPrintDocumentTitle(planFileName()); window.print(); });
}

initialize();
```

- [x] **Step 4: `plan.css`**

```css
/* 施工計畫頁：白底文件感；顏色只用 glass.css 變數或極淡色 */
body { margin: 0; background: var(--glass-page-bg); color: var(--glass-ink); font-family: "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif; }
.app-header { position: sticky; top: 0; z-index: 5; padding: 10px 0 6px; background: linear-gradient(var(--glass-page-bg) 70%, transparent); pointer-events: none; }
.header-nav { display: flex; align-items: center; justify-content: space-between; gap: 10px; width: min(100% - 32px, 880px); margin: 0 auto; }
.header-nav > * { pointer-events: auto; }
.header-actions { display: flex; align-items: center; gap: 8px; }
.header-back { color: var(--glass-ink); }
.header-back svg { display: block; color: var(--glass-icon); }
.version-pill { padding: 0; overflow: hidden; }
.version-pill select { appearance: none; border: 0; background: transparent; padding: 0 28px 0 14px; min-height: 36px; font: inherit; font-weight: 600; color: var(--glass-ink); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23666' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; }
.header-print svg { display: block; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.plan-shell { width: min(100% - 32px, 880px); margin: 0 auto 80px; }
.plan-missing { padding: 40px 0; text-align: center; color: var(--glass-soft); }

/* 封面 */
.plan-cover { position: relative; margin: 8px 0 20px; padding: 40px 32px 28px; border-radius: var(--glass-radius-lg); background: var(--glass-card-bg); box-shadow: var(--glass-card-shadow); }
.plan-logo { height: 36px; width: auto; }
.plan-kicker { margin: 28px 0 6px; font-size: 0.6875rem; letter-spacing: 0.18em; color: var(--glass-faint); }
.plan-cover h1 { margin: 0 0 32px; font-size: clamp(1.6rem, 4vw, 2.2rem); font-weight: 700; letter-spacing: 0.04em; }
.plan-cover-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 24px; margin: 0; }
.plan-cover-grid > div { display: grid; gap: 4px; padding-top: 10px; border-top: 1px solid var(--glass-line); }
.plan-cover-grid dt { font-size: 0.6875rem; color: var(--glass-label); }
.plan-cover-grid dd { margin: 0; }
.plan-cover-grid input, .inline-input { width: 100%; border: 0; border-bottom: 1px dashed var(--glass-dash); background: transparent; padding: 4px 0; font: inherit; font-size: 1rem; color: var(--glass-ink); }
.plan-cover-grid input:focus, .inline-input:focus { outline: none; border-bottom-color: var(--glass-accent); }
.inline-input { width: 3em; text-align: center; }
.plan-cover-foot { display: flex; justify-content: space-between; margin: 36px 0 0; font-size: 0.8125rem; color: var(--glass-soft); }

/* 修訂紀錄與正文 */
.plan-block { margin: 0 0 20px; padding: 24px 32px 28px; border-radius: var(--glass-radius-lg); background: var(--glass-card-bg); box-shadow: var(--glass-card-shadow); }
.plan-block h2, .plan-article h2 { margin: 0 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--glass-line); font-size: 1.125rem; font-weight: 700; }
.plan-block h3, .plan-article h3 { margin: 22px 0 8px; font-size: 0.9375rem; font-weight: 700; color: var(--glass-ink); }
.plan-number { display: inline-block; min-width: 2.2em; margin-right: 4px; font-family: var(--glass-font-num); font-weight: 600; color: var(--glass-soft); }
.plan-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
.plan-table th, .plan-table td { padding: 8px 10px; border-bottom: 1px solid var(--glass-line); text-align: left; vertical-align: top; line-height: 1.55; }
.plan-table th { background: var(--glass-sunken); font-weight: 600; color: var(--glass-soft); }
.plan-table input { width: 100%; border: 0; background: transparent; font: inherit; color: var(--glass-ink); }
.plan-figure { margin: 12px 0 16px; }
.plan-figure figcaption { margin-bottom: 6px; font-size: 0.8125rem; font-weight: 600; color: var(--glass-soft); }
.plan-note { margin: 6px 0 0; font-size: 0.75rem; color: var(--glass-faint); }
.plan-sources { margin: 0; padding-left: 1.4em; font-size: 0.8125rem; line-height: 1.7; color: var(--glass-soft); }
.link-button { border: 0; background: transparent; padding: 0; font: inherit; font-size: 0.75rem; color: var(--glass-danger-ink); }

.plan-body-wrap { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 20px; align-items: start; }
.plan-toc { position: sticky; top: 64px; }
.plan-toc-details { padding: 16px 18px; border-radius: var(--glass-radius-md); background: var(--glass-card-bg); box-shadow: var(--glass-card-shadow); }
.plan-toc-details summary { font-size: 0.8125rem; font-weight: 700; cursor: pointer; }
.plan-toc ol { margin: 10px 0 0; padding: 0; list-style: none; }
.plan-toc ol ol { margin: 2px 0 6px 2.4em; }
.plan-toc a { display: block; padding: 4px 0; font-size: 0.8125rem; color: var(--glass-soft); text-decoration: none; }
.plan-toc a:hover { color: var(--glass-ink); }
.plan-article { padding: 24px 32px 32px; border-radius: var(--glass-radius-lg); background: var(--glass-card-bg); box-shadow: var(--glass-card-shadow); font-size: 0.9375rem; line-height: 1.75; }
.plan-section + .plan-section { margin-top: 28px; }
.plan-article p { margin: 0 0 10px; }
.plan-article ul, .plan-article ol { margin: 0 0 12px; padding-left: 1.5em; }
.plan-article li { margin: 2px 0; }
.plan-steps { counter-reset: step; list-style: none; padding-left: 0; }
.plan-steps li { position: relative; padding: 6px 0 6px 2.4em; border-bottom: 1px dashed var(--glass-line); }
.plan-steps li::before { counter-increment: step; content: counter(step); position: absolute; left: 0; top: 6px; width: 1.7em; height: 1.7em; border-radius: 50%; background: var(--glass-sunken); font-family: var(--glass-font-num); font-size: 0.75rem; font-weight: 700; line-height: 1.7em; text-align: center; color: var(--glass-soft); }
.plan-callout { margin: 10px 0 14px; padding: 12px 16px; border-left: 2px solid var(--glass-dash); border-radius: 0 var(--glass-radius-sm) var(--glass-radius-sm) 0; background: oklch(97% 0.008 250); }
.plan-callout strong { display: block; margin-bottom: 4px; font-size: 0.8125rem; }
.plan-callout p { margin: 0; font-size: 0.875rem; }

@media (max-width: 720px) {
  .plan-body-wrap { grid-template-columns: 1fr; }
  .plan-toc { position: static; }
  .plan-toc-details { padding: 12px 16px; }
  .plan-toc-details:not([open]) summary::after { content: "　點開查看"; color: var(--glass-faint); font-weight: 400; }
  .plan-cover, .plan-block, .plan-article { padding-left: 20px; padding-right: 20px; }
  .plan-cover-grid { grid-template-columns: 1fr; }
}

@media print {
  @page { size: A4 portrait; margin: 18mm 16mm; }
  body { background: #fff; color: #000; }
  .app-header, .plan-toc-details summary, .no-print, #add-revision { display: none !important; }
  .plan-shell { width: auto; margin: 0; }
  .plan-cover, .plan-block, .plan-article, .plan-toc-details { padding: 0; border-radius: 0; background: transparent; box-shadow: none; }
  .plan-cover { min-height: 240mm; display: flex; flex-direction: column; break-after: page; }
  .plan-cover-foot { margin-top: auto; }
  .plan-block { break-after: page; }
  .plan-body-wrap { display: block; }
  .plan-toc { position: static; break-after: page; }
  .plan-toc ol ol { margin-left: 2.4em; }
  .plan-toc a { padding: 3px 0; font-size: 10.5pt; color: #000; }
  .plan-toc-details::before { content: "目錄"; display: block; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #999; font-size: 13pt; font-weight: 700; }
  .plan-article { font-size: 10.5pt; line-height: 1.65; }
  .plan-article h2 { font-size: 13pt; break-after: avoid; }
  .plan-article h3 { font-size: 11pt; break-after: avoid; }
  .plan-section { break-inside: auto; }
  .plan-table { font-size: 9.5pt; }
  .plan-table th, .plan-table td { border-bottom: 0.5pt solid #999; }
  .plan-table th { background: #f2f2f2; }
  thead { display: table-header-group; }
  tr, .plan-callout, .plan-figure figcaption { break-inside: avoid; }
  .plan-callout { background: #f6f6f6; border-left-color: #999; }
  input { border: 0 !important; }
}
```

- [x] **Step 5: `sw.js`**

`CACHE_NAME` → `portable-inspection-v100`；`APP_SHELL` 在 `"./rebar-cage.js"` 後加 `"./plan", "./plan.js", "./plan.css", "./plans/diaphragm-wall.js", "./plans/formwork.js", "./plans/rebar.js", "./plans/steel.js"`。

- [x] **Step 6: 驗證案例**

`scripts/verify_data.py` 新增（`open_clean` 需要 `state` 與 `preparePrint`；計畫頁沒有 `preparePrint`，另寫開頁函式）：

```python
# ---------------------------------------------------------------- 施工計畫頁
def open_plan(browser, query):
    page = new_page(browser)
    page.goto(f"{BASE}/plan{query}", wait_until="networkidle")
    page.wait_for_function("typeof state === 'object' && typeof renderPlan === 'function'")
    return page

def verify_plan_page(browser):
    for work in ("diaphragm-wall", "formwork", "rebar", "steel"):
        page = open_plan(browser, f"?work={work}&from=template")
        page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
        result = page.evaluate("""() => {
          const count = () => document.querySelectorAll('#plan-article > .plan-section').length;
          const tocCount = () => document.querySelectorAll('#toc-list > li').length;
          state.version = 'brief'; renderArticle(); const brief = count(), briefToc = tocCount();
          state.version = 'full'; renderArticle(); const full = count(), fullToc = tocCount();
          return { brief, briefToc, full, fullToc, title: document.querySelector('#plan-title').textContent, placeholders: document.body.innerHTML.includes('Task 6 補') || document.body.innerHTML.includes('Task 7 補') || document.body.innerHTML.includes('Task 8 補') };
        }""")
        check(f"計畫頁 {work}：兩版都能彩現、目錄項目數＝章節數、精簡版章節少於完整版", result["brief"] == result["briefToc"] and result["full"] == result["fullToc"] and 0 < result["brief"] < result["full"] and result["title"], result)
        check(f"計畫頁 {work}：沒有殘留的佔位文字", not result["placeholders"], result)
        page.context.close()

    page = open_clean(browser, "diaphragm-wall-gc")
    page.evaluate("() => { state.overview.project = '帶入測試工程'; state.overview.contractor = '帶入營造'; draft.schedule(); }")
    page.wait_for_timeout(700)
    page.goto(f"{BASE}/plan?work=diaphragm-wall&from=diaphragm-wall-gc", wait_until="networkidle")
    page.wait_for_function("typeof renderPlan === 'function'")
    result = page.evaluate("() => ({ project: state.cover.project, contractor: state.cover.contractor, back: document.querySelector('#back-link').getAttribute('href'), title: (setPrintDocumentTitle(planFileName()), document.title) })")
    check("計畫頁：from 工具的工程名稱／廠商帶入封面，返回連結指回工具頁，PDF 檔名含版本", result["project"] == "帶入測試工程" and result["contractor"] == "帶入營造" and result["back"] == "./diaphragm-wall-gc" and "精簡版" in result["title"], result)
    page.context.close()
```

主程式最後加 `verify_plan_page(browser)`。**本 Task 內** `placeholders` 那條會 ❌（大綱還有「Task 6 補」）——這是預期的，Task 6～8 完成後轉綠；本 Task 其餘案例須 ✅。

- [x] **Step 7: 執行與目視**

Run: `node --check plan.js plans/*.js && python3 scripts/verify_data.py`
用 preview 開 `/plan?work=diaphragm-wall&from=diaphragm-wall-gc`：封面、修訂紀錄可編輯並在重新整理後保留；下拉切版本章節數改變；手機寬度目錄收成可展開；Chrome 列印預覽封面／修訂／目錄各一頁。

---

### Task 2: 工具頁的「計畫」按鈕

**Files:**
- Modify: `diaphragm-wall-gc.html:26`、`diaphragm-wall.html:26`、`template.html:26`、`rebar.html:27`、`steel-structure.html:27`（header）與各頁說明對話框 `help-notes`
- Modify: `wall-gc.js`、`app.js`（`updateIdentity`）、`template.js`、`rebar.js`、`steel.js`（`updateIdentity` 只保留非 header 的工作）
- Modify: `app.css`、`template.css`、`rebar.css`／`steel.css`（`.header-plan` 樣式；先確認各頁 header 樣式在哪個 css）

- [x] **Step 1: header**

五個頁面把 `<span class="glass-tag header-identity" id="record-identity">…</span>` 換成（`work`／`from` 依頁面）：

```html
        <a class="glass-pill header-plan" href="./plan?work=diaphragm-wall&from=diaphragm-wall-gc"><svg width="14" height="16" viewBox="0 0 20 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2h9l5 5v15H4z"/><path d="M13 2v5h5M7 12h6M7 16h6"/></svg>計畫</a>
```

| 頁面 | work | from |
|------|------|------|
| diaphragm-wall-gc.html | diaphragm-wall | diaphragm-wall-gc |
| diaphragm-wall.html | diaphragm-wall | diaphragm-wall |
| template.html | formwork | template |
| rebar.html | rebar | rebar |
| steel-structure.html | steel | steel-structure |

CSS（各頁 header 所在的 css，比照 `.header-back`）：`.header-plan { display: inline-flex; align-items: center; gap: 6px; color: var(--glass-ink); font-weight: 600; } .header-plan svg { color: var(--glass-icon); }`

- [x] **Step 2: JS 拿掉 header 文字**

五支工具 script 的 `updateIdentity()`：刪除所有 `$("#record-identity").textContent = …` 行（含 `if (activeTool === …) { …; return; }` 分支只剩 return 的情況整段刪）；`#rebar-cage-unit` 同步那兩行（01／06）留到 Task 3 改。`grep -n "record-identity"` 五支 js 應為 0。

- [x] **Step 3: 說明**

五個頁面 `help-notes` 第一個 `<li>` 前插入 `<li>右上角「計畫」可查看本工程施工計畫，可切換精簡／完整版並列印成 PDF</li>`。

- [x] **Step 4: 驗證**

`verify_data.py` 新增：

```python
def verify_plan_links(browser):
    for html, work, back in (("diaphragm-wall-gc", "diaphragm-wall", "diaphragm-wall-gc"), ("diaphragm-wall", "diaphragm-wall", "diaphragm-wall"), ("template", "formwork", "template"), ("rebar", "rebar", "rebar"), ("steel-structure", "steel", "steel-structure")):
        page = open_clean(browser, html)
        href = page.evaluate("() => ({ href: document.querySelector('.header-plan')?.getAttribute('href'), identity: !!document.querySelector('#record-identity') })")
        check(f"{html}：計畫按鈕指向 plan?work={work}", href["href"] == f"./plan?work={work}&from={back}" and not href["identity"], href)
        page.context.close()
```

Run: `python3 scripts/verify_data.py`（含 Task 1 的案例）；目視五頁 header。

---

### Task 3: 編號欄位（01、06）

**Files:**
- Modify: `diaphragm-wall-gc.html`（導溝分頁 ~180 加軸線欄位；鋼筋籠分頁 211 行 `#rebar-cage-unit` 改兩個輸入框；連續壁分頁「軸線／方向編號」→「單元編號」）
- Modify: `diaphragm-wall.html`（同上，對應 wall.*）
- Modify: `wall-gc.js`、`app.js`：state、`updateIdentity`→`syncUnitInputs`、`printUnitInfo`／鋼筋籠 PDF、導溝 PDF identity、檔名、`exportData`（1.5、axis_no）、`exportMarkdown`、匯入、`loadExample`、`clearAllData`
- Modify: `scripts/verify_data.py`、`README.md`

- [x] **Step 1: HTML（01）**

導溝分頁在「複核日期」欄位前加：
```html
            <label class="field span-two"><span>軸線／方向編號</span><input type="text" data-check-bind="guideWall.axisNo" placeholder="例如：X3～X7／南側" /></label>
```
鋼筋籠分頁 `#rebar-cage-unit` 那行改為：
```html
            <label class="field"><span>單元編號<em>同連續壁</em></span><input type="text" data-bind="unit.unitNo" placeholder="例如：21" /></label>
            <label class="field"><span>順序編號<em>同連續壁</em></span><input type="text" data-bind="unit.sequenceNo" inputmode="numeric" placeholder="例如：03" /></label>
```
連續壁分頁：`<span>軸線／方向編號</span>` 改回 `<span>單元編號</span>`（placeholder 改「例如：21」）；PDF／Markdown 裡的「軸線／方向編號」標籤同樣改回「單元編號」（`printUnitInfo`、`exportMarkdown`）。06 對應 `wall.unitNo`／`wall.sequenceNo`，並把 `quality-context-note` 的文字改回「單元編號」。

- [x] **Step 2: JS（01；06 同法）**

- state：`guideWall: { date: today, axisNo: "", note: "", checks: … }`；`clearAllData`、`loadExample`（`axisNo: "X3～X7 南側"`）同步。
- `updateIdentity()` 改名 `syncUnitInputs(source = null)`：
```js
// 連續壁與鋼筋籠分頁的單元／順序編號綁同一份資料：任一邊輸入就把另一邊同步
function syncUnitInputs(source = null) {
  $$('[data-bind="unit.unitNo"], [data-bind="unit.sequenceNo"]').forEach(input => {
    if (input === source) return;
    const key = input.dataset.bind.split(".")[1];
    input.value = state.unit[key] ?? "";
  });
}
```
  原本呼叫 `updateIdentity()` 的地方改呼叫 `syncUnitInputs()`；`document.addEventListener("input", …)` 處理 `[data-bind]` 的段落後加 `if (bind.dataset.bind.startsWith("unit.")) syncUnitInputs(bind);`（06 為 `wall.`）。
- 導溝 PDF：`printHeader({ …, identity: state.guideWall.axisNo || "未填軸線", … })`；`setPdfDocumentTitle` 的 `recordId` 在 guideWall 時用 `state.guideWall.axisNo`。
- 鋼筋籠 PDF「鋼筋籠資料」：第一格改 `<div><span>單元編號</span><strong>${esc(display(wallUnitLabel()))}</strong></div><div><span>順序編號</span><strong>${esc(display(state.unit.sequenceNo))}</strong></div>`（grid 改四格：檢查 `print-meta-grid three` 是否要換成 `four`，沒有就在 app.css 加 `.print-meta-grid.four { grid-template-columns: repeat(4, 1fr); }`）。
- `exportData`：`schema_version: "1.5"`；`guide_wall_review.axis_no: state.guideWall.axisNo || null`。
- 匯入：`axisNo: importText(guideWall.axis_no)`。
- Markdown：導溝段落開頭加 `- 軸線／方向編號：${markdownCell(data.guide_wall_review.axis_no)}`。

- [x] **Step 3: 驗證**

`verify_data.py`：
- `verify_roundtrip` 的 schema 斷言改 `"1.5"`。
- `verify_pdf_content` 兩處「不分單元」斷言改為：先 `state.guideWall.axisNo = "X3～X7"`，斷言 `"X3～X7" in text`。
- 新增：
```python
def verify_unit_sync(browser, html, unit_path):
    page = open_clean(browser, html)
    result = page.evaluate(f"""() => {{
      showTool('rebarCage'); showTab('cage-meta');
      const inputs = document.querySelectorAll('#tool-rebar-cage [data-bind$=".unitNo"]');
      const cage = inputs[inputs.length - 1]; cage.value = '77'; cage.dispatchEvent(new Event('input', {{ bubbles: true }}));
      const wall = [...document.querySelectorAll('[data-bind$=".unitNo"]')].find(i => i !== cage);
      return {{ state: {unit_path}, wallInput: wall.value }};
    }}""")
    check(f"{html}：鋼筋籠分頁改單元編號 → state 與連續壁分頁輸入框同步", result == {"state": "77", "wallInput": "77"}, result)
    page.evaluate("() => { state.guideWall.axisNo = 'X3～X7'; activeTool = 'guideWall'; renderAll?.(); }")
    text = pdf_text(page, "current")
    check(f"{html}：導溝 PDF 表頭印軸線編號", "X3～X7" in text and "不分單元" not in text, text[:200])
    page.context.close()
```
  主程式呼叫 `verify_unit_sync(browser, "diaphragm-wall-gc", "state.unit.unitNo")` 與 `verify_unit_sync(browser, "diaphragm-wall", "state.wall.unitNo")`。
- README 第 28 行 `schema 1.4` → `schema 1.5; guide-wall review carries axis_no`。

Run: `node --check wall-gc.js app.js && python3 scripts/verify_data.py`。目視兩頁三個分頁。

---

### Task 4: 構件刪除（02、03）

**Files:**
- Modify: `template.js`（184-190 卡片、412 與 421-432 事件）、`rebar.js`（145 表格、220-231 事件）
- Modify: `glass.css`（`.two-step-delete`）
- Test: `scripts/verify_data.py`

- [x] **Step 1: 共用樣式（`glass.css` 末尾）**

```css
/* 二階段刪除：第一下變紅底垃圾桶，再點才刪；4 秒沒動作或點到別處就恢復 */
.two-step-delete { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; height: 32px; padding: 0 10px; border: 0; border-radius: 999px; background: var(--glass-neutral-bg); color: var(--glass-neutral-ink); font: inherit; font-size: 1rem; line-height: 1; cursor: pointer; transition: background 160ms ease, color 160ms ease, min-width 160ms ease; }
.two-step-delete svg { display: none; }
.two-step-delete.is-armed { min-width: 44px; background: var(--glass-danger); color: #fff; }
.two-step-delete.is-armed .two-step-x { display: none; }
.two-step-delete.is-armed svg { display: block; }
```

- [x] **Step 2: 按鈕 HTML（兩頁共用的字串）**

```js
const deleteButtonHtml = index => `<button class="two-step-delete" type="button" data-remove-member="${index}" aria-label="刪除構件"><span class="two-step-x" aria-hidden="true">×</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg></button>`;
```

- rebar.js 第 145 行：`<td class="member-actions">` 內「編輯配筋」按鈕後加 `${deleteButtonHtml(index)}`；明細列 `member-detail-heading` 裡的 `state.members.length > 1 ? \`<button class="bar-remove" … 移除構件\` : ""` 整段刪除。
- template.js 第 187 行：`${state.members.length > 1 ? \`<button type="button" data-remove-member="${index}">移除</button>\` : ""}` 改為 `${deleteButtonHtml(index)}`。
- 兩頁列表為空時：rebar 的 `tbody` 為空時在表格後加 `<p class="empty-state">尚無構件，請按「＋新增一筆」</p>`；template 的 `state.members.length ? … : \`<p class="empty-state">尚無構件，請按「＋新增構件」</p>\``（若既有 `emptyState` 樣式可用就用它）。

- [x] **Step 3: 事件（兩頁同一段）**

```js
// 二階段刪除：第一下只 arm，4 秒內再點才刪；點到別處或逾時就解除
let armedDelete = null;
function disarmDelete() {
  if (!armedDelete) return;
  clearTimeout(armedDelete.timer);
  armedDelete.button.classList.remove("is-armed");
  armedDelete.button.setAttribute("aria-label", "刪除構件");
  armedDelete = null;
}
function handleDeleteClick(button) {
  if (armedDelete?.button === button) {
    const index = Number(button.dataset.removeMember);
    disarmDelete();
    state.members.splice(index, 1);
    state.activeMember = Math.min(Math.max(0, index - 1), Math.max(0, state.members.length - 1));
    renderAll();
    return;
  }
  disarmDelete();
  button.classList.add("is-armed");
  button.setAttribute("aria-label", "再點一次確認刪除");
  armedDelete = { button, timer: setTimeout(disarmDelete, 4000) };
}
```

- template.js：`handleEvent` 裡的 `if (target.matches("[data-remove-member]")) {…}` 整行刪除；click 處理器開頭加：
```js
  const removeButton = event.target.closest("[data-remove-member]");
  if (removeButton) { handleDeleteClick(removeButton); return; }
  if (armedDelete) disarmDelete();
```
- rebar.js：第 223 行 `if (target.matches("[data-remove-member]")) {…}` 改為呼叫 `handleDeleteClick(target)` 並 `return`；處理器開頭同樣加 `if (armedDelete && !event.target.closest("[data-remove-member]")) disarmDelete();`。
- 0 筆時的其他渲染：兩頁 `renderAll()` 內用到 `activeMember()` 的函式已回傳 null 時要跳過（`if (!member) { 目標.innerHTML = "<p class='empty-state'>尚無構件</p>"; return; }`）；PDF 構件表 `state.members.length ? rows : \`<tr><td colspan="N" class="print-empty">尚無構件</td></tr>\``（N 依各表欄數）。

- [x] **Step 4: 驗證**

```python
def verify_member_delete(browser, html):
    page = open_clean(browser, html)
    result = page.evaluate("""async () => {
      const add = document.querySelector('#add-member'); add.click(); add.click();
      const total = state.members.length;
      const button = () => document.querySelector('[data-remove-member="0"]');
      button().click(); const armed = button().classList.contains('is-armed'); const afterOne = state.members.length;
      button().click(); const afterTwo = state.members.length;
      button().click(); await new Promise(r => setTimeout(r, 4500)); const timedOut = !button().classList.contains('is-armed');
      while (state.members.length) { const b = button(); b.click(); b.click(); }
      window.print = () => {}; preparePrint('all');
      return { total, armed, afterOne, afterTwo, timedOut, empty: state.members.length, printText: document.body.innerText.includes('尚無構件') };
    }""")
    check(f"{html}：點一下只 arm 不刪，再點才刪", result["armed"] and result["afterOne"] == result["total"] and result["afterTwo"] == result["total"] - 1, result)
    check(f"{html}：arm 後 4 秒逾時恢復；可刪到 0 筆且 PDF 印尚無構件", result["timedOut"] and result["empty"] == 0 and result["printText"], result)
    page.context.close()
```
主程式呼叫 `verify_member_delete(browser, "template")`、`verify_member_delete(browser, "rebar")`。`new_page` 的 `pageerror` 監聽會抓到 0 筆時的例外。

Run: `node --check template.js rebar.js && python3 scripts/verify_data.py`；目視兩頁按鈕與紅底狀態、手機寬度。

---

### Task 5: 內容研讀（四份共用）

**Files:** 無程式修改；產出研讀筆記 `docs/superpowers/notes/2026-09-20-plan-sources.md`（只列規範名稱、章節、數值與頁碼，供 Task 6～8 引用；不抄段落）。

- [x] **Step 1: 連續壁**

用 `Read`（`pages` 分段）讀 `/Users/yuhudaddy/Desktop/Taisei Quality Control/規範/04_台灣規範/TGS-EXCAVD114-建築工程地下連續壁施工準則.pdf` 全冊、`連續壁及壁樁工程實務-營建研究院-20260128講義.pdf` 的施工流程與品管章節，記錄：導溝尺寸與深度、穩定液比重／黏度／含砂量／pH 建議值、垂直度、沉泥厚度、鋼筋籠保護層與吊放、特密管埋深、澆置中斷、超音波檢測、監測項目。對照 App `wall-gc.js` 的 `STANDARD_CONFIG` 預設值，數值不一致時以「本公司標準值」為主、規範值註明。

- [x] **Step 2: 模板**

讀 `2024版混凝土結構規範/結構混凝土施工規範(2021年版）.pdf` 模板章節（模板、支撐、拆模時間表）、`ILOSH110-T-171-模板支撐自主管理技術手冊.pdf` 重點、`IOSH103-T-133建築工程模板支撐安全設計指引.pdf` 目錄與設計荷重；記錄拆模最少時間、允許偏差、支撐間距原則、脫模劑、清潔要求。對照 `template.js` 的檢查項目。

- [x] **Step 3: 鋼筋**

讀 `結構混凝土施工規範(2021年版）.pdf` 鋼筋章節（材料、加工彎鉤、續接、保護層、間距、放置允許偏差）、`建築物混凝土結構設計規範_20240101.pdf` 保護層表；記錄 CNS 560 材料要求、保護層最小值表、搭接與續接器等級、彎鉤內徑、允許偏差。對照 `rebar.js` 檢查項目。

- [x] **Step 4: 鋼構**

讀 `鋼構造建築物鋼結構施工規範_內政部/第02章.pdf`、`第03章.pdf`（材料、製作、安裝、銲接、高強度螺栓、檢驗）、`公共工程施工綱要規範/05124_建築鋼結構.pdf`；記錄進場材料證明、銲接資格與檢驗（UT／MT 比例）、高強度螺栓扭矩／轉角、安裝精度容許值、塗裝。對照 `steel.js` 檢查項目。

- [x] **Step 5: 補網路查證**

`WebSearch`：「公共工程施工綱要規範 連續壁 章節」「施工綱要規範 03210 鋼筋」「施工綱要規範 03110 模板」「05120 結構鋼」，確認章節號與名稱正確後寫進筆記；查不到的不要猜，計畫內文只寫「公共工程施工綱要規範 相關章節」。

---

### Task 6: 連續壁計畫內容（`plans/diaphragm-wall.js`）

**Files:**
- Modify: `plans/diaphragm-wall.js`（替換 Task 1 的全部佔位）
- Test: `scripts/verify_data.py`（Task 1 的 placeholders 案例）、`scripts/verify_print_layout.py`

**寫作規格（四份共用）：**
- 精簡版章節總字數 1,500～2,500；完整版 4,500～6,000。段落每段 ≤ 120 字；能列點就列點；數值一律進表格並在 `note` 註明出處（規範名稱＋章節）。
- 品質管制章節：每張 App 查驗表一個表格，欄位「項目｜判定標準｜對應查驗表」，內容與 `docs/check-items/` 及各工具 script 一致；本公司標準值（`STANDARD_CONFIG` 預設）與規範值並列時寫「本公司標準值 20 ± 2 cm（規範：…）」。
- 施工方法章節用 `children` 分小節（連續壁：導溝、成槽與穩定液、鋼筋籠製作與吊放、混凝土澆置、壁頂處理、監測）；每小節 1 段說明 + 1 個 `ol` 步驟或 `ul` 要點 + 需要時 1 個 `callout`「現場提醒」。
- 完整版專屬章節（人力、環保、進度介面、緊急應變、附錄）各 200～500 字。

- [x] **Step 1: 撰寫**

依 Task 5 筆記填滿 12 個章節；品質管制含四個表格：導溝施工複核（11 項）、停檢點 1～4（7／10／9／2 項）、鋼筋籠配筋抽查（13 部位，判定標準寫「依核定配筋圖」）、組裝與吊放條件（9 項）。附錄列出：01 連續壁營造廠查驗表（含 4 個停檢點）、導溝施工複核表、鋼筋籠吊放前複核表；06 連續壁施工紀錄（壁體資訊、品質自檢、開挖、前置、澆置）。

- [x] **Step 2: 驗證**

`scripts/verify_print_layout.py` 的 `FILL` 之外新增計畫頁迴圈（在既有迴圈後）：

```python
        for work in ("diaphragm-wall", "formwork", "rebar", "steel"):
            page = browser.new_page()
            page.goto(f"http://127.0.0.1:{PORT}/plan.html?work={work}", wait_until="networkidle")
            page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
            page.evaluate("() => { state.version = 'full'; state.cover.project = '版面測試工程'; renderPlan(); }")
            page.emulate_media(media="print")
            pdf_path = OUT / f"plan-{work}.pdf"
            page.pdf(path=str(pdf_path), prefer_css_page_size=True, print_background=True)
            doc = fitz.open(pdf_path)
            texts = [p.get_text() for p in doc]
            ok = len(texts) >= 4 and "修訂紀錄" not in texts[0] and "修訂紀錄" in texts[1] and "目錄" in texts[2] and "版面測試工程" in texts[0]
            print(("✅" if ok else "❌"), f"plan {work} 完整版 → {pdf_path.name}（{len(texts)} 頁）")
            failed = failed or not ok
            page.close()
```

Run: `node --check plans/diaphragm-wall.js && python3 scripts/verify_data.py && python3 scripts/verify_print_layout.py`
Expected: 連續壁的 placeholders 案例 ✅；PDF 封面／修訂／目錄各自一頁。用 scratchpad 把 `tmp/verify-print/plan-diaphragm-wall.pdf` 轉 PNG 看前 5 頁：表格不跨頁截列、標題不落單、提示框顏色夠淡。

---

### Task 7: 模板與鋼筋計畫內容（`plans/formwork.js`、`plans/rebar.js`）

**Files:** Modify 兩個內容檔。寫作規格同 Task 6。

- [x] **Step 1: 模板** — 施工方法小節：放樣與墨線、模板組立（柱／牆／梁／板）、支撐系統與拆模時間、開口與預埋、清潔與脫模劑、澆置前檢查、拆模與再撐。品質管制表格對應 `template.js` 的檢查群組（工程概要、模板安裝、尺寸複核、放行／拆模）。
- [x] **Step 2: 鋼筋** — 施工方法小節：材料進場與試驗、加工（彎鉤、彎折內徑）、綁紮與間距、續接（搭接／續接器／銲接）、保護層與墊塊、預埋與開口補強、澆置前放行。品質管制表格對應 `rebar.js` 的 `MATERIAL_CHECKS`、各構件類型 `PLACEMENT_CHECKS`、澆置前放行。
- [x] **Step 3: 驗證** — `node --check plans/formwork.js plans/rebar.js && python3 scripts/verify_data.py && python3 scripts/verify_print_layout.py`；轉 PNG 目視兩份前 4 頁。

---

### Task 8: 鋼構計畫內容（`plans/steel.js`）

**Files:** Modify `plans/steel.js`。寫作規格同 Task 6。

- [x] **Step 1: 撰寫** — 施工方法小節：材料進場與材證、錨定螺栓、吊裝與臨時支撐、高強度螺栓（預拉、轉角／扭矩、檢驗）、銲接（資格、環境、檢驗 UT／MT）、安裝精度量測、防火與塗裝。品質管制表格對應 `steel.js` 的 delivery／anchor／erection／hsb／welding／accuracy。
- [x] **Step 2: 驗證** — `node --check plans/steel.js && python3 scripts/verify_data.py && python3 scripts/verify_print_layout.py`；轉 PNG 目視。

---

### Task 9: 收尾

**Files:** `README.md`、`examples/`（重產）、`scripts/verify_data.py`（最後全跑）

- [x] **Step 1: README** — 工具清單段落補：「每個工具右上角的『計畫』會開啟 `plan.html?work=…`，提供精簡／完整兩版施工計畫，可列印為 PDF；內容在 `plans/*.js`。」；Verification scripts 表格補計畫頁案例。
- [x] **Step 2: 佔位掃描** — Run: `grep -rn "Task [678] 補" plans/ ; echo exit=$?`，Expected: 沒有輸出。
- [x] **Step 3: 範例重產** — `python3 scripts/render_example_pdfs.py`（工具頁 PDF 的導溝表頭、鋼筋籠資料變了）；`git status` 確認只有連續壁相關範例變動（其他工具的範例應該位元組相同）。
- [x] **Step 4: 全套驗證與瀏覽器** — `python3 scripts/verify_data.py && python3 scripts/verify_print_layout.py`；preview 逐一開五個工具頁按「計畫」、切版本、列印預覽；手機寬度看計畫頁與刪除按鈕。
- [x] **Step 5: `git status --short`** 確認範圍後回報，等使用者決定 commit。

---

## Self-Review

- Spec 覆蓋：路由／檔案／SW（T1）、內容格式與版本過濾（T1、T6～8）、文件框架與草稿（T1）、版面與列印（T1、T6 目視）、工具頁按鈕與說明（T2）、編號欄位與 schema 1.5（T3）、二階段刪除與 0 筆（T4）、內容來源（T5）、驗證與 README／範例（各 Task、T9）。
- 名稱一致：`PLAN_CONTENT`、`renderPlan`／`renderArticle`／`visibleSections`／`planFileName`、`syncUnitInputs`、`handleDeleteClick`／`disarmDelete`／`armedDelete`、`deleteButtonHtml`、`verify_plan_page`／`verify_plan_links`／`verify_unit_sync`／`verify_member_delete`。
- 已知風險：`print-meta-grid three` 換四格的 CSS 名稱要看 app.css 實際定義；rebar／template 0 筆時的其他渲染函式要逐一確認 null 處理；長篇內容的列印分頁只能靠瀏覽器，目視 PNG 是必要步驟。
