// 手機輸出 PDF：把 App 排好的 A4 列印頁轉成圖片、組成 PDF 檔，再交給系統分享選單（LINE、Email、儲存到檔案、列印）。
//
// 為什麼要這樣做：iOS 27 的「主畫面 App」模式會默默忽略 window.print()——不報錯、沒有列印畫面、連 beforeprint 都不觸發，
// 而 LINE／Email 要的是一個檔案，不是列印畫面。所以 iPhone／iPad 不再叫系統列印，App 自己產生 PDF，
// 用 Web Share 把檔案交出去（Safari 分頁與主畫面 App 行為一致）。電腦與其他裝置維持原本的列印視窗。
//
// 各工具頁的匯出流程不變：preparePrint(scope) 先產生並分頁 .print-page，最後一步由 window.print() 改成 outputPrint()。
//
// 流程：在畫面外的隱藏 iframe 載入同一批樣式表、把 @media print 規則切成 all、複製已分好頁的 .print-page，
// 用 html-to-image（SVG foreignObject）逐頁畫成 canvas → JPEG，自己組一個最小的 PDF（每頁一張圖，A4、四邊 10mm，與 @page 一致）。
// 不在目前頁面轉：切換列印樣式會讓整個畫面消失好幾秒；iframe 有自己的樣式表集合，切它不影響使用者看到的畫面。
//
// 分享需要「使用者剛點過」的手勢，而產生 PDF 通常超過 Safari 約 1 秒的有效期。所以先直接嘗試分享，
// 被擋（NotAllowedError）就改顯示「PDF 已準備好」對話框，由使用者再點一次「分享」，在新的點擊裡呼叫。
//
// 網址參數 ?export=print 強制走列印、?export=share 在能分享檔案的裝置上強制走分享（電腦驗證用，不出現在畫面上）。
(function () {
  "use strict";

  const MM_TO_PT = 72 / 25.4;
  const PX_PER_MM = 96 / 25.4;
  const A4_PT = [595.28, 841.89];
  const MARGIN_PT = 10 * MM_TO_PT;
  const LIBRARY = "./vendor/html-to-image-1.11.13.min.js";
  const PIXEL_RATIO = 2;
  const JPEG_QUALITY = 0.88;
  const PAGE_BACKGROUND = "#fdfdfd";
  const BLANK_RETRIES = 5;
  const RETRY_WAIT_MS = 150;
  const LOAD_TIMEOUT_MS = 15000;
  const PAGE_TIMEOUT_MS = 30000;
  const SILENT_PRINT_MS = 1500;
  const FRAME_WIDTH_PX = 800;

  // ---- 純函式（不碰 DOM，scripts/verify_pdf_share.mjs 直接測）------------------------------------------

  function isIosDevice(nav = navigator) {
    // iPadOS 預設送桌面版使用者代理（MacIntel），只能靠觸控點數分辨
    return /iPad|iPhone|iPod/.test(nav.userAgent || "") || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
  }

  function canShareFiles(nav = navigator) {
    try {
      if (typeof nav.canShare !== "function") return false;
      return Boolean(nav.canShare({ files: [new File([""], "inspection.pdf", { type: "application/pdf" })] }));
    } catch (error) {
      return false;
    }
  }

  // "share"：產生 PDF 交給分享選單；"print"：維持 window.print()。Android 沒驗證過，維持列印。
  function exportMode(nav = navigator, search = "") {
    const override = new URLSearchParams(search || "").get("export");
    const shareable = canShareFiles(nav);
    if (override === "print") return "print";
    if (override === "share") return shareable ? "share" : "print";
    return isIosDevice(nav) && shareable ? "share" : "print";
  }

  function fileNameFor(title) {
    const base = String(title ?? "").replace(/\.pdf$/i, "").trim()
      .replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-").replace(/^[-_]+|[-_]+$/g, "");
    return `${Array.from(base || "inspection").slice(0, 120).join("")}.pdf`;
  }

  // pages：[{ jpeg: Uint8Array, px: [寬, 高], mm: [寬, 高] }]。每頁一張 JPEG 放在 A4 上緣置左（四邊 10mm），
  // 圖片超出可用範圍時等比縮小。標題用 UTF-16BE 十六進位字串寫進 Info，中文才不會亂碼。
  function buildPdf(pages, { title = "" } = {}) {
    if (!pages || !pages.length) throw new Error("沒有可以放進 PDF 的頁面");
    const encoder = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let offset = 0;
    const push = data => {
      const bytes = typeof data === "string" ? encoder.encode(data) : data;
      chunks.push(bytes);
      offset += bytes.length;
    };
    const start = number => { offsets[number] = offset; push(`${number} 0 obj\n`); };
    const infoNo = 3 + pages.length * 3;
    push("%PDF-1.4\n");
    start(1); push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    start(2); push(`<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 3} 0 R`).join(" ")}] /Count ${pages.length} >>\nendobj\n`);
    pages.forEach((page, index) => {
      const pageNo = 3 + index * 3, contentNo = pageNo + 1, imageNo = pageNo + 2;
      const fit = Math.min(1, (A4_PT[0] - 2 * MARGIN_PT) / (page.mm[0] * MM_TO_PT), (A4_PT[1] - 2 * MARGIN_PT) / (page.mm[1] * MM_TO_PT));
      const width = page.mm[0] * MM_TO_PT * fit, height = page.mm[1] * MM_TO_PT * fit;
      const x = MARGIN_PT, y = A4_PT[1] - MARGIN_PT - height;
      start(pageNo);
      push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT[0]} ${A4_PT[1]}] /Resources << /XObject << /Im0 ${imageNo} 0 R >> >> /Contents ${contentNo} 0 R >>\nendobj\n`);
      const content = `q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
      start(contentNo);
      push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
      start(imageNo);
      push(`<< /Type /XObject /Subtype /Image /Width ${page.px[0]} /Height ${page.px[1]} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`);
      push(page.jpeg);
      push("\nendstream\nendobj\n");
    });
    const hex = Array.from({ length: title.length }, (_, i) => title.charCodeAt(i).toString(16).padStart(4, "0")).join("").toUpperCase();
    start(infoNo);
    push(`<< /Title <FEFF${hex}> >>\nendobj\n`);
    const xrefAt = offset;
    let xref = `xref\n0 ${infoNo + 1}\n0000000000 65535 f \n`;
    for (let number = 1; number <= infoNo; number += 1) xref += `${String(offsets[number]).padStart(10, "0")} 00000 n \n`;
    push(`${xref}trailer\n<< /Size ${infoNo + 1} /Root 1 0 R /Info ${infoNo} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);
    return new Blob(chunks, { type: "application/pdf" });
  }

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  // 列印保險：呼叫 window.print() 後，若時限內沒有 beforeprint，代表系統把它吞掉了（iOS 主畫面模式），通知使用者。
  // 先掛監聽再呼叫 print()：桌面瀏覽器的 print() 可能在對話框開著時才返回，beforeprint 會在那之前觸發。
  function printWithWatchdog(deps = {}) {
    const print = deps.print || (() => window.print());
    const add = deps.addEventListener || ((name, handler) => window.addEventListener(name, handler));
    const remove = deps.removeEventListener || ((name, handler) => window.removeEventListener(name, handler));
    const onSilent = deps.onSilent || showPrintBlockedHint;
    let timer;
    const heard = () => { clearTimeout(timer); remove("beforeprint", heard); };
    add("beforeprint", heard);
    timer = setTimeout(() => { remove("beforeprint", heard); onSilent(); }, deps.delay ?? SILENT_PRINT_MS);
    print();
  }

  // ---- 對話框（進度／完成／錯誤／說明）----------------------------------------------------------------

  // 狀態列（上方滑下來）：製作中（進度條＋百分比＋取消）→ 完成（約 2 秒後往上收回）／要再點一次分享／錯誤。
  // 不是置中的對話框：置中卡片換狀態時會瞬間跳位置，看起來像憑空出現；網頁也拿不到系統分享選單的位置，
  // 沒辦法貼著選單，所以全程用 iOS 習慣的頂端橫幅。用非強制（show）的 <dialog>，頁面不會被鎖住、也不會壓暗。
  const RETRACT_MS = 260;

  function openDialog({ onCancel } = {}) {
    const dialog = document.createElement("dialog");
    dialog.className = "pdf-share-dialog";
    dialog.setAttribute("role", "status");
    dialog.innerHTML = `
      <div class="pdf-share-main">
        <span class="pdf-share-spinner" aria-hidden="true"></span>
        <div class="pdf-share-text">
          <div class="pdf-share-head"><h2 id="pdf-share-title"></h2><span class="pdf-share-percent" aria-hidden="true"></span></div>
          <p id="pdf-share-message" aria-live="polite"></p>
          <div class="pdf-share-bar" role="progressbar" aria-label="PDF 產生進度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="pdf-share-bar-fill"></span></div>
        </div>
      </div>
      <div class="pdf-share-actions">
        <button type="button" class="pdf-share-secondary"></button>
        <button type="button" class="pdf-share-primary">分享</button>
      </div>
      <p class="pdf-share-hint" hidden>找不到 LINE？點「列印」，再按右上角的分享圖示。</p>`;
    const title = dialog.querySelector("h2");
    const message = dialog.querySelector("#pdf-share-message");
    const hint = dialog.querySelector(".pdf-share-hint");
    const percent = dialog.querySelector(".pdf-share-percent");
    const bar = dialog.querySelector(".pdf-share-bar");
    const fill = dialog.querySelector(".pdf-share-bar-fill");
    const secondary = dialog.querySelector(".pdf-share-secondary");
    const primary = dialog.querySelector(".pdf-share-primary");
    let closed = false;
    let closeTimer = 0;
    const onKey = event => { if (event.key === "Escape") secondary.click(); };
    // 關閉＝往上收回再移除；closed 立刻成立，流程不必等動畫結束
    const close = () => {
      if (closed) return;
      closed = true;
      clearTimeout(closeTimer);
      document.removeEventListener("keydown", onKey);
      dialog.classList.add("is-closing");
      setTimeout(() => { if (dialog.open && typeof dialog.close === "function") dialog.close(); dialog.remove(); }, RETRACT_MS);
    };
    const controller = {
      element: dialog,
      get closed() { return closed; },
      close,
      set(state, heading, text) {
        clearTimeout(closeTimer); // 換狀態就取消先前排定的自動關閉
        dialog.dataset.state = state;
        dialog.setAttribute("aria-busy", String(state === "working"));
        title.textContent = heading;
        message.textContent = text;
        secondary.textContent = state === "working" ? "取消" : "關閉";
        secondary.hidden = state === "sharing"; // 分享選單開著時只留完成提示，不放按鈕
        primary.hidden = state !== "ready";
        hint.hidden = state !== "ready";
      },
      // ms 毫秒後往上收回並關閉
      closeAfter(ms) { clearTimeout(closeTimer); closeTimer = setTimeout(close, ms); },
      progress(ratio) {
        const value = Math.max(0, Math.min(1, ratio));
        fill.style.setProperty("--pdf-progress", String(value));
        percent.textContent = `${Math.round(value * 100)}%`;
        bar.setAttribute("aria-valuenow", String(Math.round(value * 100)));
      },
      onPrimary(handler) { primary.onclick = handler; }
    };
    secondary.addEventListener("click", () => { if (dialog.dataset.state === "working" && onCancel) onCancel(); close(); });
    document.addEventListener("keydown", onKey); // Esc：產生中視同取消，其他狀態就是關閉
    document.body.append(dialog);
    controller.set("working", "正在準備 PDF", "正在整理版面…");
    controller.progress(0);
    if (typeof dialog.show === "function") dialog.show(); else dialog.setAttribute("open", "");
    // show() 會把焦點放到第一個按鈕，觸控裝置上會看到一圈外框；這是狀態列不是要輸入的視窗，立刻放掉
    if (dialog.contains(document.activeElement)) document.activeElement.blur();
    return controller;
  }

  function showPrintBlockedHint() {
    const dialog = openDialog();
    dialog.set("message", "這個模式無法列印", "iPhone 的主畫面 App 目前無法開啟列印畫面。請改用 Safari 開啟這一頁，再按輸出。");
  }

  // ---- 轉圖 ---------------------------------------------------------------------------------------

  const CANCELLED = Object.assign(new Error("已取消"), { name: "Cancelled" });

  function waitFor(target, ok = "load", fail = "error") {
    return new Promise((resolve, reject) => {
      target.addEventListener(ok, () => resolve(), { once: true });
      target.addEventListener(fail, () => reject(new Error("檔案載入失敗")), { once: true });
    });
  }

  // 把 @media print 規則切成 all，讓列印版面在 iframe 裡生效（print-pages.js 量版面時也是同一招）。
  // 規則來自另一個視窗，instanceof 會失效，改看有沒有 media 屬性。
  function flipPrintRules(doc) {
    for (const sheet of doc.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch (error) { continue; }
      for (const rule of rules) {
        if (rule.media && rule.media.mediaText.trim() === "print") rule.media.mediaText = "all";
      }
    }
  }

  // 行內 SVG（澆置折線圖）的顏色靠樣式表的 class 規則；轉成圖片時 foreignObject 裡的 SVG 拿不到，
  // 要先把算好的樣式寫成元素自己的屬性。
  const SVG_PROPS = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "fill-opacity", "stroke-opacity", "font-family", "font-size", "font-weight", "text-anchor", "dominant-baseline"];
  function inlineSvgStyles(root, view) {
    root.querySelectorAll("svg *").forEach(element => {
      const computed = view.getComputedStyle(element);
      SVG_PROPS.forEach(name => {
        const value = computed.getPropertyValue(name);
        if (value) element.setAttribute(name, value);
      });
    });
  }

  // 圖片先自己抓成內嵌資料並確認解碼完成，不要在轉圖的過程中才去抓：Safari 常常來不及，圖就空白。
  async function prepareImages(root) {
    await Promise.all([...root.querySelectorAll("img")].map(async image => {
      try {
        if (!image.src.startsWith("data:")) {
          const blob = await (await fetch(image.src, { cache: "force-cache" })).blob();
          image.src = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
        }
        await image.decode();
      } catch (error) {
        // 單張圖壞掉不該讓整份輸出失敗：留著壞圖，其他內容照常輸出
      }
    }));
  }

  // 檢查節點裡每張 <img> 在畫布上的位置是不是整片空白（只有背景色）。Safari 第一次把圖片畫進 foreignObject 常常是空白。
  function imagesBlank(node, canvas, ratio) {
    const base = node.getBoundingClientRect();
    const context = canvas.getContext("2d", { willReadFrequently: true });
    return [...node.querySelectorAll("img")].some(image => {
      const rect = image.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      const x = Math.max(0, Math.round((rect.left - base.left) * ratio));
      const y = Math.max(0, Math.round((rect.top - base.top) * ratio));
      const w = Math.min(canvas.width - x, Math.round(rect.width * ratio));
      const h = Math.min(canvas.height - y, Math.round(rect.height * ratio));
      if (w <= 0 || h <= 0) return false;
      const data = context.getImageData(x, y, w, h).data;
      let ink = 0;
      for (let i = 0; i < data.length; i += 4) if (data[i] < 200) ink += 1;
      return ink < w * h * 0.02;
    });
  }

  async function renderPage(node, view) {
    inlineSvgStyles(node, view);
    let canvas;
    for (let tries = 0; tries < BLANK_RETRIES; tries += 1) {
      if (tries) await sleep(RETRY_WAIT_MS);
      canvas = await withTimeout(view.htmlToImage.toCanvas(node, { pixelRatio: PIXEL_RATIO, backgroundColor: PAGE_BACKGROUND, cacheBust: false }), PAGE_TIMEOUT_MS, "轉換頁面逾時");
      if (!imagesBlank(node, canvas, PIXEL_RATIO)) break;
    }
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("無法把頁面轉成圖片（記憶體不足？）");
    const rect = node.getBoundingClientRect();
    const page = { jpeg: new Uint8Array(await blob.arrayBuffer()), px: [canvas.width, canvas.height], mm: [rect.width / PX_PER_MM, rect.height / PX_PER_MM] };
    canvas.width = canvas.height = 0; // 立刻釋放 canvas 記憶體（iOS 對 canvas 總量很吝嗇）
    return page;
  }

  // 建立畫面外的 iframe 並把已分好頁的列印頁放進去；回傳 { frame, doc, view, pages }。
  // 中途失敗（例如函式庫載入不了）時 run() 還拿不到 frame，所以要在這裡自己移除，否則隱藏的 iframe 會一直留在頁面上。
  async function buildFrame(sources) {
    const frame = document.createElement("iframe");
    try {
      return await populateFrame(frame, sources);
    } catch (error) {
      frame.remove();
      throw error;
    }
  }

  async function populateFrame(frame, sources) {
    frame.className = "pdf-share-frame";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    // 畫面外但仍要排版（display:none 的 iframe 在 Safari 不會排版）。寬度要大於 A4 內容寬，避開窄螢幕的 media query。
    for (const [name, value] of Object.entries({ position: "fixed", left: "-10000px", top: "0", width: `${FRAME_WIDTH_PX}px`, height: "1200px", border: "0", "pointer-events": "none" })) frame.style.setProperty(name, value);
    frame.srcdoc = "<!doctype html><meta charset=\"utf-8\">";
    const loaded = waitFor(frame);
    document.body.append(frame);
    await loaded;
    const doc = frame.contentDocument, view = frame.contentWindow;
    doc.documentElement.lang = document.documentElement.lang;
    const pageHeight = document.documentElement.style.getPropertyValue("--print-page-height");
    if (pageHeight) doc.documentElement.style.setProperty("--print-page-height", pageHeight);
    doc.body.dataset.printScope = document.body.dataset.printScope || "all";

    // 樣式表與函式庫同時載入；任何一個失敗都不能硬做，否則會產出版面錯誤的 PDF
    const loads = [...document.querySelectorAll('link[rel="stylesheet"]')].map(source => {
      const link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = source.href;
      doc.head.append(link);
      return waitFor(link);
    });
    const script = doc.createElement("script");
    script.src = new URL(LIBRARY, document.baseURI).href;
    doc.head.append(script);
    loads.push(waitFor(script));
    await withTimeout(Promise.all(loads), LOAD_TIMEOUT_MS, "載入樣式或轉圖函式庫逾時（請確認網路後再試）");
    if (!view.htmlToImage) throw new Error("轉圖函式庫沒有載入成功");
    // html-to-image 每畫完一張圖會等一次 requestAnimationFrame。WebKit 對畫面外 iframe 的 rAF 會節流到約 10 秒一次
    // （實測每頁多等 10 秒，第一次沒被節流所以很快）。這個 iframe 本來就不給人看，改用上層視窗的計時器立刻放行。
    view.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 0);

    const report = doc.createElement("div");
    report.className = "print-report";
    report.id = "print-report";
    sources.forEach(source => report.append(doc.importNode(source, true)));
    doc.body.append(report);
    flipPrintRules(doc);
    if (doc.fonts && doc.fonts.ready) await doc.fonts.ready;
    const pages = [...report.querySelectorAll(".print-page")].filter(page => view.getComputedStyle(page).display !== "none");
    return { frame, doc, view, pages };
  }

  // ---- 主流程 -------------------------------------------------------------------------------------

  let busy = false;

  function formatSize(bytes) {
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  async function run() {
    // 狀態列不鎖頁面：產生中使用者可能再點一次輸出。preparePrint 已把標題設成檔名，這裡不做事也要還原，否則標題會卡在檔名
    if (busy) {
      if (typeof window.restorePrintDocumentTitle === "function") window.restorePrintDocumentTitle();
      return;
    }
    busy = true;
    const state = { cancelled: false };
    const ui = openDialog({ onCancel: () => { state.cancelled = true; } });
    const alive = () => { if (state.cancelled || ui.closed) throw CANCELLED; };
    let frame;
    try {
      // 標題已由 preparePrint 設成檔名；分享路徑沒有 afterprint，這裡讀完就還原
      const fileName = fileNameFor(document.title);
      if (typeof window.restorePrintDocumentTitle === "function") window.restorePrintDocumentTitle();
      const sources = [...document.querySelectorAll(".print-report .print-page")];
      if (!sources.length) throw new Error("找不到可以輸出的頁面");

      ui.set("working", "正在準備 PDF", "正在整理版面…");
      ui.progress(0.04);
      const built = await buildFrame(sources);
      frame = built.frame;
      alive();
      if (!built.pages.length) throw new Error("沒有可以輸出的頁面");
      await prepareImages(built.doc.body);
      alive();
      ui.progress(0.12);

      const rendered = [];
      for (const [index, node] of built.pages.entries()) {
        ui.set("working", "正在準備 PDF", `正在轉換第 ${index + 1} ／ ${built.pages.length} 頁…`);
        await sleep(0); // 讓進度文字有機會先畫出來
        rendered.push(await renderPage(node, built.view));
        alive();
        ui.progress(0.12 + 0.83 * ((index + 1) / built.pages.length));
      }
      ui.set("working", "正在準備 PDF", "正在組成檔案…");
      ui.progress(0.97);
      const pdf = buildPdf(rendered, { title: fileName.replace(/\.pdf$/i, "") });
      const file = new File([pdf], fileName, { type: "application/pdf" });
      frame.remove();
      frame = null;
      ui.progress(1);
      await deliver(file, rendered.length, ui);
    } catch (error) {
      if (error !== CANCELLED) {
        console.error(error);
        if (!ui.closed) ui.set("error", "無法產生 PDF", error && error.message ? error.message : "發生未知的錯誤，請再試一次。");
      }
    } finally {
      if (frame) frame.remove();
      busy = false;
    }
  }

  const AUTO_CLOSE_MS = 2000;

  // 分享選單開著時，這個對話框還在它後面：只留一個「PDF 已準備好」的完成提示（不能停在「正在轉換…」加轉圈，像是還沒做完），
  // 約 2 秒後自己關掉，使用者不必再點關閉，也不會同時看到兩個要處理的視窗。
  function enterSharing(ui) {
    ui.set("sharing", "PDF 已準備好", "請在分享選單中選擇要傳送的 App。");
    ui.closeAfter(AUTO_CLOSE_MS);
  }

  // 對話框可能已經自動關掉了，這時另開一個顯示原因
  function reportShareError(ui, error) {
    console.error(error);
    (ui.closed ? openDialog() : ui).set("error", "無法開啟分享選單", `${error && error.name ? error.name : "錯誤"}：${error && error.message ? error.message : "請再試一次"}`);
  }

  // 先直接嘗試分享（點擊後很快就好的話手勢還有效）；被擋就改成讓使用者再點一次
  async function deliver(file, pageCount, ui) {
    // 只交檔案，不帶 title／text：iOS 會把 title 當成第二個項目（存到「檔案」會多一個 文字.txt，傳 LINE 可能多一則文字訊息）
    const data = { files: [file] };
    const describe = `${file.name}（${pageCount} 頁，${formatSize(file.size)}）`;
    const showReady = () => {
      ui.set("ready", "PDF 已準備好", describe);
      ui.onPrimary(() => {
        // 這裡必須在點擊的同步流程裡呼叫 share：中間不能 await 任何東西（同步丟出的例外也要接住，變成同樣的錯誤處理）
        let pending;
        try { pending = navigator.share(data); } catch (error) { pending = Promise.reject(error); }
        enterSharing(ui);
        pending.then(() => ui.close(), error => {
          // 使用者關掉分享選單：對話框還在（2 秒內）就回到可以再按一次的狀態，已經自動關掉了就什麼都不做
          if (error && error.name === "AbortError") { if (!ui.closed) showReady(); return; }
          reportShareError(ui, error);
        });
      });
    };
    if (ui.closed) return;
    enterSharing(ui);
    try {
      await navigator.share(data);
      ui.close();
    } catch (error) {
      if (!error || error.name === "NotAllowedError") showReady();
      else if (error.name === "AbortError") ui.close();
      else reportShareError(ui, error);
    }
  }

  // ---- 對外介面 -----------------------------------------------------------------------------------

  const api = { buildPdf, isIosDevice, canShareFiles, exportMode, fileNameFor, printWithWatchdog, run };
  window.PdfShare = api;

  // 各工具頁把原本的 window.print() 換成這個。{ pdf: false } 只走列印（施工計畫頁：長文件沒有固定頁盒，這次不轉 PDF）。
  window.outputPrint = function outputPrint(options = {}) {
    if (options.pdf !== false && exportMode(navigator, location.search) === "share") {
      try {
        Promise.resolve(api.run()).catch(error => console.error(error));
        return;
      } catch (error) {
        console.error(error); // 產生流程本身壞了：退回列印，至少 Safari 分頁還能用
      }
    }
    if (navigator.standalone === true) printWithWatchdog(); else window.print();
  };
})();
