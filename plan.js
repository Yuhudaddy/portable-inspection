// 施工計畫頁：?work=<diaphragm-wall-gc|diaphragm-wall|formwork|rebar|steel>&from=<工具頁>。
// 正文來自 plans/<work>.js（PLAN_CONTENT），修訂紀錄來自 plans/revisions.js；封面（編製單位、日期、版本）存本機草稿；精簡版只取 level "brief" 的章節與區塊。
const PLAN_WORKS = ["diaphragm-wall-gc", "diaphragm-wall", "formwork", "rebar", "steel"];
const PLAN_FROM = {
  "diaphragm-wall-gc": { label: "營造廠查驗表", draft: INSPECTION_STANDARDS["diaphragm-wall-gc"].draftKey },
  "diaphragm-wall": { label: "施工紀錄", draft: INSPECTION_STANDARDS["diaphragm-wall"].draftKey },
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
  cover: { project: "", contractor: "", author: "", date: today }
};
const draft = work ? createDraftStore(planDraftKey(work), () => state) : null;

// 工程名稱、施工廠商與工具頁的「工程資訊」同步：開啟時以工具頁草稿為準（工具頁沒填才保留封面自己的值），
// 在封面修改也寫回工具頁草稿。編製單位、日期、版次只屬於計畫。

function readToolDraft() {
  if (!from) return null;
  try {
    const stored = JSON.parse(localStorage.getItem(PLAN_FROM[from].draft));
    return stored?.data?.overview && typeof stored.data.overview === "object" ? stored : null;
  } catch (error) {
    return null;
  }
}

function syncCoverFromTool() {
  const overview = readToolDraft()?.data.overview;
  if (!overview) return;
  COVER_SYNC_FIELDS.forEach(field => { if (overview[field]) state.cover[field] = String(overview[field]); });
}

// 工具頁還沒有草稿就不建立：只寫一個 overview 的草稿會讓工具頁以為有資料可還原
function writeCoverToTool(field) {
  const stored = readToolDraft();
  if (!stored) return;
  stored.data.overview[field] = state.cover[field];
  try { localStorage.setItem(PLAN_FROM[from].draft, JSON.stringify(stored)); } catch (error) { /* 靜默 */ }
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

// 檢查標準值與計畫同步：內文用 {{key}} 標記工具頁下拉選單的值（key 見 inspection-standards.js），
// 彩現時換成工具頁目前選的值；和預設不同的數值加底色，封面註記「本案調整 N 項」。
// {{key:ratio}} 印成 1/n（選 10/D 時照印 10/D）。沒有檢查標準值的計畫（模板、鋼筋、鋼構）不受影響。
let standards = null;
// inspection-standards.js 以 const 宣告（不是 window 屬性），用識別字取
const standardSet = () => (typeof INSPECTION_STANDARDS === "object" ? INSPECTION_STANDARDS[work] : null);

function readStandards() {
  const set = standardSet();
  if (!set) return null;
  let saved = null;
  try { saved = set.read(JSON.parse(localStorage.getItem(set.draftKey))?.data); } catch (error) { /* 沒有草稿就用預設 */ }
  const values = mergeStandardDefaults(saved, set.config);
  const byKey = Object.fromEntries(set.config.map(item => [item.key, item]));
  return { config: set.config, byKey, values, adjusted: set.config.filter(item => values[item.key] !== item.default) };
}

// 示意圖（plans/figures-*.js）裡要跟著標準值的數字用這個查：keys 依序取這份計畫有定義的第一個
const FIGURE_CONTEXT = {
  standard: (keys, fallback) => {
    const key = keys.find(candidate => standards?.byKey[candidate]);
    return key ? standards.values[key] : fallback;
  }
};

const TOKEN_FORMATS = {
  ratio: value => value === "10/D" ? value : `1/${value}`
};

function standardHtml(key, format) {
  const item = standards?.byKey[key];
  if (!item) return `{{${esc(key)}}}`;   // 打錯的代號照原樣露出，測試會抓
  const shown = esc((TOKEN_FORMATS[format] || String)(standards.values[key]));
  return standards.values[key] === item.default ? shown
    : `<span class="plan-value is-adjusted" title="${esc(`本公司預設 ${(TOKEN_FORMATS[format] || String)(item.default)}`)}">${shown}</span>`;
}

// 內文字串：跳脫 HTML 後把 {{key}} 換成標準值
const txt = value => esc(value).replace(/\{\{(\w+)(?::(\w+))?\}\}/g, (match, key, format) => standardHtml(key, format));

// 條列項目可以是字串，或 { text, items } 帶一層子條列（例：「特密管埋入混凝土內：」下分高分子系／皂土系）。
// 表格儲存格裡的 \n 換行，讓同一格可分行列出不同條件。
const itemHtml = item => typeof item === "string" ? txt(item)
  : `${txt(item.text)}<ul class="plan-sublist">${(item.items || []).map(sub => `<li>${txt(sub)}</li>`).join("")}</ul>`;
const cellHtml = cell => txt(cell).replaceAll("\n", "<br>");
const captionHtml = block => block.caption ? `<figcaption>${txt(block.caption)}</figcaption>` : "";
const noteHtml = block => block.note ? `<p class="plan-note">${txt(block.note)}</p>` : "";

// 檢查標準值總表：直接由設定產生，永遠與工具頁的下拉選單一致
function standardsTableHtml(block) {
  if (!standards) return "";
  const rows = standards.config.map(item => `<tr><td>${esc(item.label)}</td><td>${standardHtml(item.key)}</td><td>${esc(item.unit)}</td></tr>`).join("");
  return `<figure class="plan-figure">${captionHtml(block)}<table class="plan-table"><thead><tr><th>項目</th><th>標準值</th><th>單位</th></tr></thead><tbody>${rows}</tbody></table>${noteHtml(block)}</figure>`;
}

// Mermaid 流程圖：區塊只放原始碼的 key（見 plans/flowcharts-*.js），畫面彩現後才載入 vendor/mermaid-11.4.1.min.js（約 2.5 MB）
// 轉成 SVG；沒有流程圖的計畫完全不載入。列印前等圖畫完（flowchartsReady）。文字用 SVG text（htmlLabels: false），
// PDF 裡才抓得到字、也不會因為 foreignObject 在列印時跑版。
let mermaidLoading = null;
let flowchartRun = 0;
let flowchartsReady = Promise.resolve();

function loadMermaid() {
  mermaidLoading ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "./vendor/mermaid-11.4.1.min.js";   // 換版本時同步改 sw.js 的 VENDOR_FILES
    script.onload = () => {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        fontFamily: '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif',
        themeVariables: {
          fontSize: "14px",
          primaryColor: "#f5f3ef", primaryBorderColor: "#8c857a", primaryTextColor: "#2b2724",
          lineColor: "#8c857a", clusterBkg: "#fbfaf8", clusterBorder: "#d6d0c6", edgeLabelBackground: "#ffffff"
        },
        flowchart: { htmlLabels: false, nodeSpacing: 22, rankSpacing: 28, padding: 8, useMaxWidth: true }
      });
      resolve(window.mermaid);
    };
    script.onerror = () => { mermaidLoading = null; reject(new Error("mermaid")); };
    document.head.append(script);
  });
  return mermaidLoading;
}

// 流程圖畫完之前「輸出 PDF」顯示「準備中…」並停用，免得印出還在載入的圖
let printButtonHtml = null;
function setPrintBusy(busy) {
  const button = $("#print-button");
  if (!button) return;
  printButtonHtml ??= button.innerHTML;
  button.disabled = busy;
  button.toggleAttribute("aria-busy", busy);
  button.innerHTML = busy ? loadingHtml("準備中…", { small: true }) : printButtonHtml;
}

function renderFlowcharts() {
  const targets = [...document.querySelectorAll("[data-flowchart]")];
  if (!targets.length) return (flowchartsReady = Promise.resolve());
  const run = ++flowchartRun;
  setPrintBusy(true);
  flowchartsReady = loadMermaid().then(async mermaid => {
    for (const [index, target] of targets.entries()) {
      if (run !== flowchartRun) return;   // 期間又重新彩現（例如切換精簡／完整版），交給新的一輪
      const { svg } = await mermaid.render(`plan-flowchart-${run}-${index}`, window.PLAN_FLOWCHARTS[target.dataset.flowchart]);
      target.innerHTML = svg;
    }
  }).catch(() => {
    targets.forEach(target => { target.textContent = "流程圖需要連線載入一次圖表元件，請連線後重新整理。"; });
  }).finally(() => { if (run === flowchartRun) setPrintBusy(false); });
  return flowchartsReady;
}
window.planFlowchartsReady = () => flowchartsReady;

function blockHtml(block) {
  switch (block.type) {
    case "p": return `<p>${txt(block.text)}</p>`;
    case "ul": return `<ul>${block.items.map(item => `<li>${itemHtml(item)}</li>`).join("")}</ul>`;
    case "ol": return `<ol class="plan-steps">${block.items.map(item => `<li>${itemHtml(item)}</li>`).join("")}</ol>`;
    case "callout": return `<aside class="plan-callout"><strong>${txt(block.title)}</strong><p>${txt(block.text)}</p></aside>`;
    case "standards": return standardsTableHtml(block);
    case "figure": {
      const drawn = window.PLAN_FIGURES?.[block.figure]?.(FIGURE_CONTEXT) || "";
      return `<figure class="plan-figure plan-diagram">${captionHtml(block)}<div class="plan-diagram-body">${drawn}</div>${noteHtml(block)}</figure>`;
    }
    case "mermaid": return window.PLAN_FLOWCHARTS?.[block.flowchart]
      ? `<figure class="plan-figure plan-flowchart">${captionHtml(block)}<div class="plan-flowchart-body" data-flowchart="${esc(block.flowchart)}" role="img" aria-label="${esc(block.caption || "流程圖")}">${loadingHtml("流程圖載入中…")}</div>${noteHtml(block)}</figure>`
      : "";
    case "figureTable": {
      const head = block.head.map(cell => `<th>${esc(cell)}</th>`).join("") + `<th class="plan-col-figure">示意圖</th>`;
      const rows = block.rows.map(row => `<tr>${row.cells.map(cell => `<td>${cellHtml(cell)}</td>`).join("")}<td class="plan-cell-figure">${window.PLAN_FIGURES?.[row.figure]?.(FIGURE_CONTEXT) || ""}</td></tr>`).join("");
      return `<figure class="plan-figure plan-figure-table">${captionHtml(block)}<table class="plan-table plan-table-figure"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>${noteHtml(block)}</figure>`;
    }
    case "table": return `<figure class="plan-figure">${captionHtml(block)}<table class="plan-table"><thead><tr>${block.head.map(cell => `<th>${esc(cell)}</th>`).join("")}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map(cell => `<td>${cellHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>${noteHtml(block)}</figure>`;
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
  renderFlowcharts();
}

function renderCover() {
  document.querySelectorAll("[data-cover]").forEach(input => { input.value = state.cover[input.dataset.cover] ?? ""; });
  $("#plan-title").textContent = content.title;
  $("#plan-subtitle").textContent = content.subtitle;
  $("#plan-sources").innerHTML = content.sources.map(item => `<li>${esc(item)}</li>`).join("");
}

// 修訂紀錄與版次由製作者維護（plans/revisions.js），這裡只顯示；封面版次＝最後一列
const planRevisions = () => window.PLAN_REVISIONS?.[work] || [];

function renderRevisions() {
  const rows = planRevisions();
  $("#revision-rows").innerHTML = rows.map(row => `<tr><td>${esc(row.version)}</td><td>${esc(row.date)}</td><td>${esc(row.note)}</td></tr>`).join("");
  $("#plan-revision").textContent = rows.at(-1)?.version || "—";
  const adjusted = standards?.adjusted.length || 0;
  $("#plan-adjusted").hidden = !adjusted;
  $("#plan-adjusted").textContent = adjusted ? `本案調整 ${adjusted} 項（內文以底色標示）` : "";
}

function renderPlan() { standards = readStandards(); renderCover(); renderRevisions(); renderArticle(); }

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
  // 舊草稿裡使用者自填的版次與修訂紀錄不再使用（改由 plans/revisions.js 統一維護）
  delete state.revisions;
  delete state.cover.revision;
  syncCoverFromTool();
  renderPlan();
  draft.watch();
  // 從工具頁按「上一頁」回來時頁面可能是快取的舊畫面，重新對一次工具頁的工程資訊
  // 同步的來源（工程資訊、檢查標準值）都在工具頁草稿：回到這頁或別的分頁改了草稿，就整份重畫
  window.addEventListener("pageshow", event => { if (event.persisted) { syncCoverFromTool(); renderPlan(); } });
  window.addEventListener("storage", event => {
    if (event.key !== standardSet()?.draftKey && event.key !== (from && PLAN_FROM[from].draft)) return;
    syncCoverFromTool();
    renderPlan();
  });

  $("#plan-version").addEventListener("change", event => { state.version = event.target.value === "full" ? "full" : "brief"; renderArticle(); });
  document.addEventListener("input", event => {
    const cover = event.target.closest("[data-cover]");
    if (cover) {
      state.cover[cover.dataset.cover] = cover.value;
      if (COVER_SYNC_FIELDS.includes(cover.dataset.cover)) writeCoverToTool(cover.dataset.cover);
    }
  });
  // window.print() 要留在點擊的同步流程裡（await 過 Safari 會擋）；流程圖還沒畫完時按鈕是停用的（setPrintBusy）
  $("#print-button").addEventListener("click", () => { setPrintDocumentTitle(planFileName()); window.print(); });
}

initialize();
