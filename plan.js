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
