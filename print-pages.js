// 各工具共用的列印分頁器（在各頁的工具 script 之前載入）。
// 先把每個 .print-page 依 A4 可用高度拆成固定高度的實體頁，表格以列為單位拆到續頁，
// 最後把簽名欄放到最後一頁；每頁固定高度 + overflow:hidden，避免瀏覽器自行分頁。
//
// 紙張一律直向。標了 data-print-orientation="landscape" 的頁（澆置紀錄）內容仍以 277×190mm
// 的橫向配置排版，放進 .print-rotated 包裹層後由 CSS 逆時針轉 90° 印在直向紙上——iOS 的列印
// 流程不吃 @page size / 具名頁，這是唯一在所有裝置上都一致的做法。
//
// 範例模式（?example=1）每頁頂端多一列「範例輸出 ‹ 上一頁」：主畫面 Web App 開啟範例 PDF 時
// 沒有瀏覽器介面可以回頭，靠 PDF 裡的這個連結回到工具頁；正式輸出不會有這一列。
(function () {
  const PX_PER_MM = 96 / 25.4;
  const PAGE_HEIGHT_MM = { portrait: 277, landscape: 190 };
  const TOLERANCE_PX = 2;
  const exampleMode = new URLSearchParams(location.search).get("example") === "1";

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
  // 每一頁都要重複的固定元素：文件表頭與範例列
  function isFixed(el) { return el.matches(".print-document-header, .print-example-bar"); }

  // 整條橫列就是連結：手機上整張 A4 縮到螢幕寬，只有一顆小膠囊會點不到；
  // 內容靠右，左側留空避開 iOS PDF 檢視器蓋在左上角的頁碼。
  function makeExampleBar() {
    const bar = document.createElement("a");
    bar.className = "print-example-bar";
    // 產生範例 PDF 的腳本會把正式站台網址放進 data-example-base，讓 PDF 裡的連結指回線上頁面
    bar.href = (document.documentElement.dataset.exampleBase || "./") + (location.pathname.split("/").pop() || "index.html");
    const tag = document.createElement("span");
    tag.textContent = "範例輸出 SAMPLE";
    const button = document.createElement("strong");
    button.textContent = "‹ 上一頁";
    bar.append(tag, button);
    return bar;
  }

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
    const others = [...current.children].filter(el => el !== block && !isFixed(el));
    if (!others.length) return current;
    const page = nextPage();
    page.appendChild(block);
    return overflowing(page, limit) ? splitBlock(block, page, limit, nextPage) : page;
  }

  // 橫向頁的內容都放進 .print-rotated（renderPrint 每次重寫 innerHTML 後這層會不見，這裡補回來）
  function hostOf(page) {
    if (page.dataset.printOrientation !== "landscape") return page;
    let host = page.querySelector(":scope > .print-rotated");
    if (!host) {
      host = document.createElement("div");
      host.className = "print-rotated";
      host.append(...page.childNodes);
      page.appendChild(host);
    }
    return host;
  }

  function paginatePage(source) {
    const limit = limitFor(source);
    const sourceHost = hostOf(source);
    if (exampleMode && !sourceHost.querySelector(":scope > .print-example-bar")) sourceHost.prepend(makeExampleBar());
    const fixed = [...sourceHost.children].filter(isFixed);
    const footer = sourceHost.querySelector(":scope > .print-footer");
    const blocks = [...sourceHost.children].filter(el => !fixed.includes(el) && el !== footer);
    blocks.forEach(el => el.remove());
    if (footer) footer.remove();

    const pages = [source];
    source.dataset.measuring = "1";
    const nextPage = () => {
      const page = document.createElement("article");
      page.className = source.className;
      for (const [key, value] of Object.entries(source.dataset)) page.dataset[key] = value;
      page.dataset.printContinuation = source.id || "page";
      pages[pages.length - 1].after(page);
      pages.push(page);
      const host = hostOf(page);
      fixed.forEach(el => host.appendChild(el.cloneNode(true)));
      return host;
    };

    let current = sourceHost;
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
      [...document.querySelectorAll(".print-page")].filter(page => getComputedStyle(page).display !== "none").forEach(paginatePage);
    });
  }

  window.paginatePrintReport = paginatePrintReport;
})();
