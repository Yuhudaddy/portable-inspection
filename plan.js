// 施工計畫頁：?work=<diaphragm-wall-gc|diaphragm-wall|formwork|rebar|steel>&from=<工具頁>。
// 正文來自 plans/<work>.js（PLAN_CONTENT），封面與修訂紀錄存本機草稿；精簡版只取 level "brief" 的章節與區塊。
const PLAN_WORKS = ["diaphragm-wall-gc", "diaphragm-wall", "formwork", "rebar", "steel"];
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

// 工程名稱、施工廠商與工具頁的「工程資訊」同步：開啟時以工具頁草稿為準（工具頁沒填才保留封面自己的值），
// 在封面修改也寫回工具頁草稿。編製單位、日期、版次只屬於計畫。
const SYNCED_COVER_FIELDS = ["project", "contractor"];

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
  SYNCED_COVER_FIELDS.forEach(field => { if (overview[field]) state.cover[field] = String(overview[field]); });
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

// 條列項目可以是字串，或 { text, items } 帶一層子條列（例：「特密管埋入混凝土內：」下分高分子系／皂土系）。
// 表格儲存格裡的 \n 換行，讓同一格可分行列出不同條件。
const itemHtml = item => typeof item === "string" ? esc(item)
  : `${esc(item.text)}<ul class="plan-sublist">${(item.items || []).map(sub => `<li>${esc(sub)}</li>`).join("")}</ul>`;
const cellHtml = cell => esc(cell).replaceAll("\n", "<br>");

function blockHtml(block) {
  switch (block.type) {
    case "p": return `<p>${esc(block.text)}</p>`;
    case "ul": return `<ul>${block.items.map(item => `<li>${itemHtml(item)}</li>`).join("")}</ul>`;
    case "ol": return `<ol class="plan-steps">${block.items.map(item => `<li>${itemHtml(item)}</li>`).join("")}</ol>`;
    case "callout": return `<aside class="plan-callout"><strong>${esc(block.title)}</strong><p>${esc(block.text)}</p></aside>`;
    case "figure": {
      const drawn = window.PLAN_FIGURES?.[block.figure]?.() || "";
      return `<figure class="plan-figure plan-diagram">${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ""}<div class="plan-diagram-body">${drawn}</div>${block.note ? `<p class="plan-note">${esc(block.note)}</p>` : ""}</figure>`;
    }
    case "figureTable": {
      const head = block.head.map(cell => `<th>${esc(cell)}</th>`).join("") + `<th class="plan-col-figure">示意圖</th>`;
      const rows = block.rows.map(row => `<tr>${row.cells.map(cell => `<td>${cellHtml(cell)}</td>`).join("")}<td class="plan-cell-figure">${window.PLAN_FIGURES?.[row.figure]?.() || ""}</td></tr>`).join("");
      return `<figure class="plan-figure plan-figure-table">${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ""}<table class="plan-table plan-table-figure"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>${block.note ? `<p class="plan-note">${esc(block.note)}</p>` : ""}</figure>`;
    }
    case "table": return `<figure class="plan-figure">${block.caption ? `<figcaption>${esc(block.caption)}</figcaption>` : ""}<table class="plan-table"><thead><tr>${block.head.map(cell => `<th>${esc(cell)}</th>`).join("")}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map(cell => `<td>${cellHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>${block.note ? `<p class="plan-note">${esc(block.note)}</p>` : ""}</figure>`;
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
  syncCoverFromTool();
  renderPlan();
  draft.watch();
  // 從工具頁按「上一頁」回來時頁面可能是快取的舊畫面，重新對一次工具頁的工程資訊
  window.addEventListener("pageshow", event => { if (event.persisted) { syncCoverFromTool(); renderCover(); } });

  $("#plan-version").addEventListener("change", event => { state.version = event.target.value === "full" ? "full" : "brief"; renderArticle(); });
  document.addEventListener("input", event => {
    const cover = event.target.closest("[data-cover]");
    const revision = event.target.closest("[data-revision]");
    if (cover) {
      state.cover[cover.dataset.cover] = cover.value;
      if (SYNCED_COVER_FIELDS.includes(cover.dataset.cover)) writeCoverToTool(cover.dataset.cover);
    }
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
