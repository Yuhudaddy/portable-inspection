// 各工具共用的列印分頁器（在各頁的工具 script 之前載入）。
// 先把每個 .print-page 依 A4 可用高度拆成固定高度的實體頁，表格以列為單位拆到續頁，
// 最後把簽名欄放到最後一頁；每頁固定高度 + overflow:hidden，避免瀏覽器自行分頁。
//
// 紙張一律直向。標了 data-print-orientation="landscape" 的頁（澆置紀錄）內容仍以 277×190mm
// 的橫向配置排版，放進 .print-rotated 包裹層後由 CSS 逆時針轉 90° 印在直向紙上——iOS 的列印
// 流程不吃 @page size / 具名頁，這是唯一在所有裝置上都一致的做法。
//
// 可用頁高：A4 直向扣掉 @page 上下各 10mm 是 277mm；iOS 列印會在頁面下方保留自己的頁尾（網址、頁碼），
// 可用高度少 10mm 以上，固定 277mm 的頁盒會被擠出一條到下一頁，所以 iOS 用 263mm。
// 這個值同時給 CSS（--print-page-height）與這裡的分頁量測用。
(function () {
  const PX_PER_MM = 96 / 25.4;
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const PAGE_HEIGHT_MM = { portrait: IOS ? 263 : 277, landscape: 190 };
  const TOLERANCE_PX = 2;
  document.documentElement.style.setProperty("--print-page-height", `${PAGE_HEIGHT_MM.portrait}mm`);

  // 列印表頭的 logo 先抓進快取，輸出時就不用等圖片載入（window.print() 前不能有 await）
  const logo = new Image();
  logo.src = "./taisei.png";

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
  // 每一頁都要重複的固定元素：文件表頭
  function isFixed(el) { return el.matches(".print-document-header"); }

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

  // ---- 列印共用小工具：五個工具頁都用同一份 ----------------------------------
  // PDF 用的文字：未填就留白，不印「—」（畫面上的 display() 才印「—」）
  const printText = value => String(value ?? "").trim();
  // 頁尾簽名欄（所長／副所長／擔當者），分頁器會把它放到最後一頁
  const printFooter = () => `<footer class="print-footer"><div class="print-signature-grid" aria-label="簽名欄"><div><span>所長</span><span aria-hidden="true"></span></div><div><span>副所長</span><span aria-hidden="true"></span></div><div><span>擔當者</span><span aria-hidden="true"></span></div></div></footer>`;
  // 檔名片段：去掉檔名不能用的字元
  const safeFilePart = (value, fallback = "") => {
    const cleaned = String(value ?? "").trim().replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-");
    return cleaned || fallback;
  };
  // PDF 檔名＝document.title；列印完（afterprint）還原原本的標題
  function setPrintDocumentTitle(parts) {
    const previousTitle = document.title;
    document.title = parts.filter(Boolean).map(value => safeFilePart(value)).filter(Boolean).join("_");
    window.addEventListener("afterprint", () => { document.title = previousTitle; }, { once: true });
  }

  Object.assign(window, { paginatePrintReport, printText, printFooter, safeFilePart, setPrintDocumentTitle });
})();
