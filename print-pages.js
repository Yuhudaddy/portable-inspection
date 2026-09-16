// 各工具共用的列印分頁器（在各頁的工具 script 之前載入）。
// 先把每個 .print-page 依 A4 可用高度拆成固定高度的實體頁，表格以列為單位拆到續頁，
// 最後把簽名欄放到最後一頁；每頁固定高度 + overflow:hidden，避免瀏覽器自行分頁。
(function () {
  const PX_PER_MM = 96 / 25.4;
  const PAGE_HEIGHT_MM = { portrait: 277, landscape: 190 };
  const TOLERANCE_PX = 2;

  function withPrintStyles(fn) {
    const scrollY = window.scrollY;
    const switched = [];
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (error) { continue; }
      for (const rule of rules) {
        if (rule instanceof CSSMediaRule && rule.media.mediaText.trim() === "print") {
          rule.media.mediaText = "all";
          switched.push(rule);
        }
      }
    }
    try { return fn(); } finally {
      switched.forEach(rule => { rule.media.mediaText = "print"; });
      window.scrollTo(0, scrollY);
    }
  }

  function printStylesActive() {
    return getComputedStyle(document.body).getPropertyValue("--print-active").trim() === "1";
  }

  function limitFor(page) {
    const orientation = page.dataset.printOrientation === "landscape" ? "landscape" : "portrait";
    return PAGE_HEIGHT_MM[orientation] * PX_PER_MM - TOLERANCE_PX;
  }

  const overflowing = (page, limit) => page.getBoundingClientRect().height > limit;
  function isHeader(el) { return el.matches(".print-document-header"); }

  function splitBlock(block, current, limit, nextPage) {
    const tables = block.querySelectorAll("table.print-table");
    const table = tables[tables.length - 1];
    const body = table && table.tBodies[0];
    if (!body || body.rows.length < 2) return moveWhole(block, current, limit, nextPage);

    const moved = [];
    while (body.rows.length > 1 && overflowing(current, limit)) moved.unshift(body.removeChild(body.rows[body.rows.length - 1]));
    if (overflowing(current, limit)) {
      moved.forEach(row => body.appendChild(row));
      return moveWhole(block, current, limit, nextPage);
    }
    if (!moved.length) return current;

    const section = table.closest(".print-section") || block;
    const continued = section.cloneNode(false);
    const heading = section.querySelector("h2");
    if (heading) {
      const h2 = heading.cloneNode(true);
      if (!h2.dataset.continued) { h2.append("（續）"); h2.dataset.continued = "1"; }
      continued.appendChild(h2);
    }
    const nextTable = table.cloneNode(false);
    if (table.tHead) nextTable.appendChild(table.tHead.cloneNode(true));
    const nextBody = document.createElement("tbody");
    moved.forEach(row => nextBody.appendChild(row));
    nextTable.appendChild(nextBody);
    continued.appendChild(nextTable);

    const page = nextPage();
    page.appendChild(continued);
    return overflowing(page, limit) ? splitBlock(continued, page, limit, nextPage) : page;
  }

  function moveWhole(block, current, limit, nextPage) {
    const others = [...current.children].filter(el => el !== block && !isHeader(el));
    if (!others.length) return current;
    const page = nextPage();
    page.appendChild(block);
    return overflowing(page, limit) ? splitBlock(block, page, limit, nextPage) : page;
  }

  function paginatePage(source) {
    const limit = limitFor(source);
    const header = [...source.children].find(isHeader) || null;
    const footer = source.querySelector(":scope > .print-footer");
    const blocks = [...source.children].filter(el => el !== header && el !== footer);
    blocks.forEach(el => el.remove());
    if (footer) footer.remove();

    const pages = [source];
    source.dataset.measuring = "1";
    const nextPage = () => {
      const page = document.createElement("article");
      page.className = source.className;
      for (const [key, value] of Object.entries(source.dataset)) page.dataset[key] = value;
      page.dataset.printContinuation = source.id || "page";
      if (header) page.appendChild(header.cloneNode(true));
      pages[pages.length - 1].after(page);
      pages.push(page);
      return page;
    };

    let current = source;
    for (const block of blocks) {
      current.appendChild(block);
      if (overflowing(current, limit)) current = splitBlock(block, current, limit, nextPage);
    }
    if (footer) {
      current.appendChild(footer);
      if (overflowing(current, limit)) { footer.remove(); current = nextPage(); current.appendChild(footer); }
    }
    pages.forEach(page => { delete page.dataset.measuring; page.dataset.paginated = "1"; });
  }

  function paginatePrintReport() {
    document.querySelectorAll(".print-page[data-print-continuation]").forEach(el => el.remove());
    document.querySelectorAll(".print-page[data-paginated]").forEach(el => { delete el.dataset.paginated; });
    withPrintStyles(() => {
      if (!printStylesActive()) return;
      document.querySelectorAll(".print-page").forEach(page => {
        if (getComputedStyle(page).display === "none") return;
        paginatePage(page);
      });
    });
  }

  window.paginatePrintReport = paginatePrintReport;
})();
