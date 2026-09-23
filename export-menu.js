// 右下角「輸出」按鈕的 Gooey 選單（五個工具頁共用，在頁面自己的 script 之前載入）。
//
// 頁面只宣告要哪些項目，按鈕由這裡產生：
//   <div class="export-fab" id="export-fab" data-export-items="pdf-current pdf-all json import">
//     <button class="dock-primary" id="export-button" …>…</button>
//   </div>
// 輸出項目帶 data-export-format（pdf-current／pdf-all／json），由各頁自己的點擊處理；
// 匯入項目是 #import-json-button（只有兩個連續壁工具有）。
// 這裡負責：把項目排在主按鈕的左 → 上四分之一圓上（3 項：左、左上、上）、另外畫一層套 SVG goo 濾鏡的
// 圓形底色讓展開時像液滴分出去（按鈕本身在上層，不會被濾鏡糊掉）、開關、點外面／Esc／選完一項就收起，
// 以及收起時讓項目不能被 Tab 到。
(() => {
  const fab = document.querySelector("#export-fab");
  if (!fab) return;
  const button = fab.querySelector("#export-button");

  const icon = paths => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
  const BRACES = '<path d="M8 4H7a2 2 0 0 0-2 2v4l-2 2 2 2v4a2 2 0 0 0 2 2h1"/><path d="M16 4h1a2 2 0 0 1 2 2v4l2 2-2 2v4a2 2 0 0 1-2 2h-1"/>';
  // 文件＝PDF（單張單頁、疊兩張整份），大括號＝JSON（箭頭往下匯出、往上匯入）
  const ITEMS = {
    "pdf-current": { label: "單頁", aria: "輸出目前表單 PDF", icon: icon('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>') },
    "pdf-all": { label: "整份", aria: "輸出完整紀錄 PDF", icon: icon('<path d="M9 6V5a2 2 0 0 1 2-2h5l4 4v10a2 2 0 0 1-2 2h-1"/><path d="M4 9a2 2 0 0 1 2-2h5l4 4v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>') },
    "json": { label: "匯出", aria: "匯出 JSON 資料檔", icon: icon(`${BRACES}<path d="M12 8v8"/><path d="M9 13l3 3 3-3"/>`) },
    "import": { label: "匯入", aria: "匯入 JSON 資料檔", id: "import-json-button", icon: icon(`${BRACES}<path d="M12 16V8"/><path d="M9 11l3-3 3 3"/>`) }
  };
  const keys = (fab.dataset.exportItems || "").split(/\s+/).filter(key => ITEMS[key]);
  // 相鄰兩顆的弧長要大於直徑（52px）＋ goo 模糊的融合距離，否則展開後會黏成一條：3 顆 96px、4 顆 128px
  const RADIUS = keys.length > 3 ? 128 : 96;

  const itemLayer = document.createElement("div");
  itemLayer.className = "export-fab-items";
  itemLayer.id = "export-fab-items";
  const goo = document.createElement("div");
  goo.className = "export-fab-goo";
  goo.setAttribute("aria-hidden", "true");
  goo.append(Object.assign(document.createElement("span"), { className: "export-fab-blob is-main" }));

  // 左（180°）到上（90°）平均分配。位置用 style.setProperty 設（頁面 CSP 是 style-src 'self'，
  // HTML 字串裡的 style 屬性會被擋掉），項目與底下的色塊寫同一組值
  const items = keys.map((key, index) => {
    const config = ITEMS[key];
    const angle = Math.PI - (Math.PI / 2) * (keys.length === 1 ? 0 : index / (keys.length - 1));
    const position = { "--x": `${Math.round(Math.cos(angle) * RADIUS)}px`, "--y": `${Math.round(-Math.sin(angle) * RADIUS)}px`, "--i": String(index) };
    const item = document.createElement("button");
    item.type = "button";
    item.className = "export-fab-item";
    item.setAttribute("aria-label", config.aria);
    if (config.id) item.id = config.id;
    else item.dataset.exportFormat = key;
    item.innerHTML = `${config.icon}<span>${config.label}</span>`;
    const blob = Object.assign(document.createElement("span"), { className: "export-fab-blob" });
    Object.entries(position).forEach(([name, value]) => { item.style.setProperty(name, value); blob.style.setProperty(name, value); });
    goo.append(blob);
    itemLayer.append(item);
    return item;
  });

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "export-fab-defs");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<defs><filter id="export-goo"><feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
    <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo" />
    <feComposite in="SourceGraphic" in2="goo" operator="atop" /></filter></defs>`;
  fab.prepend(svg, goo, itemLayer);
  button.setAttribute("aria-controls", itemLayer.id);

  const setOpen = (open, focusFirst = false) => {
    fab.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
    itemLayer.inert = !open;
    if (open && focusFirst) items[0]?.focus({ preventScroll: true });
  };
  setOpen(false);

  // 鍵盤開啟（click 的 detail 為 0）才把焦點移到第一項，滑鼠／手指點開不出現焦點框
  button.addEventListener("click", event => setOpen(!fab.classList.contains("is-open"), event.detail === 0));
  // 選完一項就收起；收起不影響事件繼續冒泡到頁面自己的處理
  items.forEach(item => item.addEventListener("click", () => setOpen(false)));
  document.addEventListener("pointerdown", event => {
    if (fab.classList.contains("is-open") && !fab.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || !fab.classList.contains("is-open")) return;
    setOpen(false);
    button.focus();
  });
})();
