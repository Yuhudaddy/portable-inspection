# Portable Inspection 修正計畫（簽名欄分頁、範例 PDF、App 圖示、快取）

**目標：** 修好 2026-09-16 檢查清單中未完成的項目：線上版壞掉（draft.js 未提交）、簽名欄固定在該表最後一頁右下角、範例 PDF 改用正式輸出重新產生、iPhone 主畫面圖示、PDF 檔名代稱、Service Worker 快取。

**做法：** 新增一支共用的列印分頁器 `print-pages.js`，在 `window.print()` 之前把每個 `.print-page` 依 A4 可用高度拆成固定高度的實體頁，簽名欄用 flex `margin-top:auto` 貼齊最後一頁頁底；塞不下就整個移到下一頁。範例 PDF 改由 Playwright 驅動真正的 App 產生，刪掉 ReportLab 與塗白腳本。

**技術：** 純靜態 HTML/CSS/JS（無建置工具）、Service Worker、Python 3.13 + Playwright（`channel="chrome"`）+ PyMuPDF + Pillow（本機都已安裝）。

**執行順序：** 依 Task 編號做，每個 Task 結尾都有驗證步驟與 commit。Task 1 是線上版壞掉的緊急修正，先做先推。

## 全域限制

- 只能用瀏覽器原生功能，不能引入 npm 套件或建置流程。
- 所有 PDF 一律 A4：澆置紀錄橫向（可用區 277×190mm），其餘直向（190×277mm），`@page` 邊界 10mm。
- 工具名稱（檔名用）固定：連續壁施工紀錄／連續壁營造廠查驗／導溝施工複核／鋼筋籠吊放前複核／模板工程複核表／鋼筋工程查驗表／鋼構施工複核表。
- PDF 檔名：`[工具名稱]_[識別編號]_[頁面名稱｜完整檢核紀錄]_[日期].pdf`，無識別編號就整段省略，不得出現 `record`、構件類型等代稱。
- 品牌名稱一律 `Portable Inspection`。
- 每次改到會被快取的檔案，`sw.js` 的 `CACHE_NAME` 版本都要 +1。
- 回覆與 commit 訊息用繁體中文（台灣用語）。

---

### Task 1（緊急）：提交 `draft.js`，修復線上版與 Service Worker

**問題：** 已推上 GitHub 的 `app.js` / `wall-gc.js` / `template.js` / `rebar.js` / `steel.js` 都在頂層呼叫 `createDraftStore()`，但 `draft.js` 是 untracked、HTML 也沒載入它。線上 `https://yuhudaddy.github.io/portable-inspection/draft.js` 回 404，五個工具一載入就 `ReferenceError`；`sw.js` v73 的 `APP_SHELL` 又列了 `./draft.js`，`cache.addAll` 失敗 → SW 裝不起來 → 手機永遠停在 v72 舊快取。

**Files:**
- Add: `draft.js`
- Modify: `sw.js:1`（版本）、`portal.js`、`template.js`、`rebar.js`、`steel.js`（註冊 SW）
- Commit: 工作區已改好的 `diaphragm-wall.html`、`diaphragm-wall-gc.html`、`template.html`、`rebar.html`、`steel-structure.html`、`index.html`、`glass.css`、`portal.css`、`portal.js`

- [ ] **Step 1：確認 HTML 都有載入 draft.js**

Run: `grep -c 'src="./draft.js"' diaphragm-wall.html diaphragm-wall-gc.html template.html rebar.html steel-structure.html`
Expected: 每個檔案都是 `1`。

- [ ] **Step 2：在沒有註冊 SW 的頁面補上註冊**

`portal.js` 的 IIFE 結尾、`template.js` 與 `rebar.js` 的最後一行、`steel.js` 的 `initialize()` 內 `afterprint` 監聽之後，各加一行：

```js
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./sw.js").catch(() => {});
```

- [ ] **Step 3：升快取版本**

`sw.js:1` 改為：

```js
const CACHE_NAME = "portable-inspection-v74";
```

- [ ] **Step 4：本機驗證沒有 ReferenceError**

Run（另開終端機）: `python3 -m http.server 4173`
用瀏覽器開 `http://127.0.0.1:4173/diaphragm-wall.html`、`template.html`、`rebar.html`、`steel-structure.html`、`diaphragm-wall-gc.html`，Console 沒有紅字，DevTools → Application → Service Workers 顯示 `portable-inspection-v74` activated。

- [ ] **Step 5：Commit 並推上去**

```bash
git add draft.js sw.js portal.js template.js rebar.js steel.js diaphragm-wall.html diaphragm-wall-gc.html template.html rebar.html steel-structure.html index.html glass.css portal.css
git commit -m "fix: 補提交 draft.js 並在所有頁面註冊 service worker"
git push origin main
```

- [ ] **Step 6：等 GitHub Pages 部署完再驗**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://yuhudaddy.github.io/portable-inspection/draft.js`
Expected: `200`

---

### Task 2：共用列印分頁器 `print-pages.js`

**原理：** 瀏覽器自動分頁做不到「簽名欄固定在該表最後一頁右下角」。改成 JS 先量：暫時把所有 `@media print` 規則切成 `all`（同步做完立刻切回，不會閃），把每個 `.print-page` 的區塊一塊一塊放進固定寬度的頁裡量高度，超過就以表格列為單位拆到續頁（續頁重複文件表頭與表格表頭、標題加「（續）」），最後放簽名欄，塞不下就整個簽名欄移到下一頁。每頁 `height` 固定 + `overflow:hidden`，瀏覽器不再自行分頁。

以下程式碼已在本專案的複本上用 headless Chrome 驗證過（連續壁／營造廠查驗／模板／鋼筋／鋼構，空表與 70 筆資料兩種情境，所有簽名欄底邊距頁底 12.2mm）。

**Files:**
- Create: `print-pages.js`
- Modify: `glass.css`（結尾加旗標）

- [ ] **Step 1：建立 `print-pages.js`（完整內容如下，照抄）**

```js
// 各工具共用的列印分頁器（在各頁的工具 script 之前載入）。
//
// 瀏覽器自動分頁沒辦法把簽名欄「固定在該表最後一頁的右下角」：內容一跨頁，簽名欄只會
// 緊接在內容後面被推到下一頁頂端。所以改由這裡先把每個 .print-page 依 A4 可用高度
// 拆成固定高度的實體頁（表格以列為單位拆到續頁，續頁重複表頭與文件表頭），最後再把
// 簽名欄放到最後一頁；塞不下就整個簽名欄移到再下一頁。每頁固定高度 + overflow:hidden，
// 瀏覽器就不會再自己分頁，簽名欄靠 flex 的 margin-top:auto 貼齊頁底。
//
//   exportPdf() 裡：renderPrint() → 設定 data-print-scope / .print-selected → paginatePrintReport() → window.print()
//
// 量測時需要列印樣式生效，所以暫時把所有 @media print 規則切成 all（同步做完立刻切回，
// 中間不會 repaint）。若切換失敗（極舊瀏覽器），就不分頁，退回瀏覽器自動分頁。
(function () {
  const PX_PER_MM = 96 / 25.4;
  const PAGE_HEIGHT_MM = { portrait: 277, landscape: 190 }; // A4 扣掉 @page 上下各 10mm
  const TOLERANCE_PX = 2;

  function withPrintStyles(fn) {
    const scrollY = window.scrollY; // 列印樣式會把 app-shell 藏起來，量測時的 layout 會把捲動位置夾回 0
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

  // glass.css 的 @media print 會把 --print-active 設成 1，用來確認切換真的生效
  function printStylesActive() {
    return getComputedStyle(document.body).getPropertyValue("--print-active").trim() === "1";
  }

  function limitFor(page) {
    const orientation = page.dataset.printOrientation === "landscape" ? "landscape" : "portrait";
    return PAGE_HEIGHT_MM[orientation] * PX_PER_MM - TOLERANCE_PX;
  }

  // data-measuring 讓頁高變 auto，量到的就是內容實際高度
  const overflowing = (page, limit) => page.getBoundingClientRect().height > limit;

  function isHeader(el) { return el.matches(".print-document-header"); }

  // 區塊塞不下：以區塊裡最後一個表格為切點，把列往後搬到續頁，直到本頁塞得下。
  function splitBlock(block, current, limit, nextPage) {
    const tables = block.querySelectorAll("table.print-table");
    const table = tables[tables.length - 1];
    const body = table && table.tBodies[0];
    if (!body || body.rows.length < 2) return moveWhole(block, current, limit, nextPage);

    const moved = [];
    while (body.rows.length > 1 && overflowing(current, limit)) moved.unshift(body.removeChild(body.rows[body.rows.length - 1]));
    if (overflowing(current, limit)) {
      moved.forEach(row => body.appendChild(row)); // 只剩表頭＋第一列還是塞不下：整塊搬到下一頁再切
      return moveWhole(block, current, limit, nextPage);
    }
    if (!moved.length) return current;

    const section = table.closest(".print-section") || block;
    const continued = section.cloneNode(false);
    const heading = section.querySelector("h2");
    if (heading) {
      const h2 = heading.cloneNode(true);
      if (!h2.dataset.continued) { h2.append("（續）"); h2.dataset.continued = "1"; } // 續頁再拆時不要疊成「（續）（續）」
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
    if (!others.length) return current; // 這頁只有它，再搬也一樣：留在原頁（超出部分會被截掉）
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
```

- [ ] **Step 2：`glass.css` 結尾加旗標**

```css
/* 列印分頁器（print-pages.js）用來確認列印樣式已生效的旗標 */
@media print { body { --print-active: 1; } }
```

- [ ] **Step 3：Commit**

```bash
git add print-pages.js glass.css
git commit -m "feat: 新增共用列印分頁器 print-pages.js"
```

---

### Task 3：接上分頁器——CSS、HTML 與各工具的 exportPdf

**Files:**
- Modify: `app.css`（`@media print` 區塊，約 970–1050 行）
- Modify: `template.css`（刪第一個 `@media print` 區塊 227–261 行；改第二個區塊）
- Modify: `steel.css:159`（刪除無用規則）
- Modify: `diaphragm-wall.html`、`diaphragm-wall-gc.html`、`template.html`、`rebar.html`、`steel-structure.html`
- Modify: `app.js`、`wall-gc.js`、`template.js`、`rebar.js`、`steel.js`（`exportPdf`）
- Create: `scripts/verify_print_layout.py`

- [ ] **Step 1：先寫驗證腳本（現況應該是失敗的）**

建立 `scripts/verify_print_layout.py`：

```python
"""用 headless Chrome 跑真正的 App，輸出 PDF 後量簽名欄位置。
每個工具跑「空表」與「大量資料」兩種情境；任一頁簽名欄底邊距頁底超過 16mm 就判定失敗。
用法：python3 scripts/verify_print_layout.py
"""
import subprocess, sys, time
from pathlib import Path
import fitz
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tmp" / "verify-print"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 4199

FILL = {
    "diaphragm-wall.html": """
state.wall.unitNo = 'A01';
for (let i = 0; i < 70; i++) state.trucks.push({ id: 't' + i, volume: '8', measured: 1 });
for (let i = 0; i < 60; i++) state.soil.push({ id: 's' + i, time: '09:00' });
for (let i = 0; i < 40; i++) state.depth.push({ id: 'd' + i, time: '10:00', value: '35.0' });
state.guideWall.note = Array(40).fill('導溝備註測試文字，用來把內容撐長。').join('\\n');
state.rebarCage.note = Array(40).fill('鋼筋籠備註測試文字，用來把內容撐長。').join('\\n');
""",
    "diaphragm-wall-gc.html": """
state.unit.unitNo = 'B02';
state.guideWall.note = Array(60).fill('導溝備註測試文字，用來把內容撐長。').join('\\n');
state.rebarCage.note = Array(60).fill('鋼筋籠備註測試文字，用來把內容撐長。').join('\\n');
""",
    "template.html": "for (let i = 0; i < 12; i++) state.members.push(Object.assign(createMember(), { id: 'C' + i, type: '柱' }));",
    "rebar.html": "for (let i = 0; i < 8; i++) state.members.push(createMember({ id: 'B' + i, type: '梁' }));",
    "steel-structure.html": """
for (let i = 0; i < 70; i++) state.delivery.records.push({ type: '柱', memberNo: 'C-' + i, spec: 'H400x400', qty: '1', doc: 'MTC-' + i, appearance: '良好', storage: '良好', result: '合格' });
state.delivery.note = Array(50).fill('進場備註測試文字，用來把內容撐長。').join('\\n');
""",
}

def check(pdf_path):
    failures = []
    for index, page in enumerate(fitz.open(pdf_path)):
        height = page.rect.height
        hit = page.search_for("擔當者")
        if not hit:
            continue
        grid_bottom_mm = (height - (hit[0].y1 + 12 / 25.4 * 72)) / 72 * 25.4  # 標籤列下方還有 12mm 簽名格
        if grid_bottom_mm > 16:
            failures.append(f"    p{index + 1}: 簽名欄底距頁底 {grid_bottom_mm:.1f}mm")
    return failures

server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
failed = False
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for html, fill in FILL.items():
            for scenario in ("empty", "many"):
                page = browser.new_page()
                page.goto(f"http://127.0.0.1:{PORT}/{html}", wait_until="networkidle")
                page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
                if scenario == "many":
                    page.evaluate(fill)
                page.evaluate("() => { window.print = () => {}; return preparePrint('all'); }")
                page.emulate_media(media="print")
                out = OUT / f"{html.replace('.html', '')}-{scenario}.pdf"
                page.pdf(path=str(out), prefer_css_page_size=True, print_background=True)
                problems = check(out)
                status = "❌" if problems else "✅"
                print(f"{status} {html} [{scenario}] → {out.name}")
                for line in problems:
                    print(line)
                failed = failed or bool(problems)
                page.close()
        browser.close()
finally:
    server.terminate()
sys.exit(1 if failed else 0)
```

Run: `python3 scripts/verify_print_layout.py`
Expected: 現在會因為 `preparePrint` 不存在而報錯（Task 3 Step 6 之後才會有）。這是預期的。

- [ ] **Step 2：`app.css` 的 `@media print` 區塊改四處**

（a）在 `.print-page:last-child { break-after: auto; }` 之後插入：

```css
  /* ---- 列印分頁器（print-pages.js）需要的固定尺寸 ---- */
  .print-page { width: 190mm; }
  .print-page[data-print-orientation="landscape"] { width: 277mm; }
  .print-page > * { flex: 0 0 auto; }
  body[data-print-scope] .print-page[data-measuring] { min-height: 0 !important; height: auto !important; overflow: visible !important; }
  body[data-print-scope] .print-page[data-paginated] { height: 277mm; min-height: 0; overflow: hidden; }
  body[data-print-scope] .print-page[data-paginated][data-print-orientation="landscape"] { height: 190mm; }
```

（b）`.print-section, .print-table tr, .print-footer { break-inside: avoid; }` 改為（section 不能再整塊避免分頁，否則量測會失準）：

```css
  .print-table tr, .print-footer { break-inside: avoid; }
```

（c）刪掉巢狀的方向媒體查詢：

```css
  @media print and (orientation: landscape) {
    .print-document-header { grid-template-columns: 95mm 90mm minmax(18mm, 1fr); }
  }
```

改為屬性選擇器（量測時螢幕是直的，媒體查詢不會生效）：

```css
  .print-page[data-print-orientation="landscape"] .print-document-header { grid-template-columns: 95mm 90mm minmax(18mm, 1fr); }
```

（d）`.print-page[data-print-tab="pouring"] { page: pouring-landscape; min-height: 190mm; }` 這行保留不動。

- [ ] **Step 3：`template.css`**

刪掉第一個 `@media print { @page { size: A4 portrait; margin: 12mm 12mm 11mm; } … }` 整個區塊（227–260 行，最後一行是 `.print-table .status-failed`，沒人用；只保留註解 `Keep template and rebar exports aligned…` 開始的第二個區塊）。在第二個區塊裡做和 app.css 一樣的（a）與（b）：`.print-page:last-child { break-after: auto; }` 之後插入同一段固定尺寸規則；`.print-section, .print-table tr, .print-footer { break-inside: avoid; }` 改為 `.print-table tr, .print-footer { break-inside: avoid; }`。

- [ ] **Step 4：`steel.css`**

刪除 `.steel-print-page { min-height: 190mm; }`（沒有任何 HTML 用這個 class，而且 190mm 是橫向的高度）。

- [ ] **Step 5：HTML**

（a）五個工具頁在 `<script src="./draft.js" defer></script>` 下一行加：

```html
    <script src="./print-pages.js" defer></script>
```

（b）`diaphragm-wall.html` 的澆置頁加方向屬性：

```html
      <article class="print-page" data-print-tab="pouring" data-print-orientation="landscape" id="print-pouring"></article>
```

（c）`template.html:103` 與 `rebar.html:108`：拿掉 `.print-page` 裡多包的 `<div>`，id 直接放在 `<article>` 上。這層 div 就是模板／鋼筋簽名欄永遠貼在表格下方的原因（`.print-footer` 不是 flex item，`margin-top:auto` 無效）。

```html
<!-- template.html -->
<section class="print-report" aria-hidden="true"><article class="print-page" data-print-page="overview" id="print-template-overview"></article><article class="print-page" data-print-page="checks" id="print-template-checks"></article><article class="print-page" data-print-page="release" id="print-template-release"></article></section>
```

```html
<!-- rebar.html -->
<section class="print-report" aria-hidden="true"><article class="print-page" data-print-page="overview" id="print-template-overview"></article><article class="print-page" data-print-page="material" id="print-template-material"></article><article class="print-page" data-print-page="placement" id="print-template-placement"></article><article class="print-page" data-print-page="detail" id="print-template-detail"></article><article class="print-page" data-print-page="release" id="print-template-release"></article></section>
```

JS 用 `$("#print-template-overview").innerHTML = …` 寫入，不用改。

- [ ] **Step 6：各工具的 `exportPdf` 拆成 `preparePrint(scope)` + `exportPdf(scope)`**

拆開是為了讓 Task 6 的範例產生腳本與 Step 1 的驗證腳本可以不經過 `window.print()` 走完同一條路。

`app.js`（取代現有 `exportPdf`）：

```js
async function preparePrint(scope) {
  renderPrint();
  document.body.dataset.printScope = scope;
  const requested = activeTool === "diaphragmWall" ? PRINT_TAB_GROUPS[activeTab] : PRINT_TAB_GROUPS[activeTool];
  const current = requested === "overview-wall" ? "quality" : requested;
  $$('.print-page').forEach(page => page.classList.toggle("print-selected", page.dataset.printTab === current));
  setPdfDocumentTitle(scope);
  await waitForPrintAssets();
  paginatePrintReport();
}

async function exportPdf(scope) {
  $("#export-dialog").close();
  await preparePrint(scope);
  window.print();
}
```

`app.js` 另外要修一個既有 bug：澆置頁的 `${printFooter()}` 被包在 `.pouring-layout` 裡（`</section></div>${printFooter()}` 少關一個 div），簽名欄因此跟著版面走。在 `renderPrint()` 裡把

```js
${pouringChartSvg(truckRows)}</section></div>${printFooter()}`;
```

改成

```js
${pouringChartSvg(truckRows)}</section></div></div>${printFooter()}`;
```

`wall-gc.js`（取代現有 `exportPdf`）：

```js
async function preparePrint(scope) {
  renderPrint();
  document.body.dataset.printScope = scope;
  const current = activeTool === "inspection" ? PRINT_TAB_GROUPS[activeTab] : PRINT_TAB_GROUPS[activeTool];
  $$('.print-page').forEach(page => page.classList.toggle("print-selected", page.dataset.printTab === current));
  setPdfDocumentTitle(scope);
  await waitForPrintAssets();
  paginatePrintReport();
}

async function exportPdf(scope) {
  $("#export-dialog").close();
  await preparePrint(scope);
  window.print();
}
```

`steel.js`（取代現有 `exportPdf`）：

```js
function preparePrint(scope) {
  renderPrint();
  document.body.dataset.printScope = scope;
  $$('.print-page').forEach(page => page.classList.toggle("print-selected", page.dataset.printTab === activeTab));
  setPdfDocumentTitle(scope);
  paginatePrintReport();
}

function exportPdf(scope) {
  $("#export-dialog").close();
  preparePrint(scope);
  window.print();
}
```

`rebar.js`（取代現有單行的 `exportPdf`）：

```js
function preparePrint(scope) {
  renderPrint();
  document.body.dataset.printScope = scope;
  const page = activeTab === "overview" || activeTab === "members" ? "overview" : activeTab;
  $$(".print-page").forEach(item => item.classList.toggle("print-selected", item.dataset.printPage === page));
  setPdfDocumentTitle(scope);
  paginatePrintReport();
}
function exportPdf(scope) { $("#export-dialog").close(); preparePrint(scope); window.print(); }
```

`template.js`（取代現有 `exportPdf`，並把檔名邏輯抽成 `setPdfDocumentTitle`，順便修 Task 5 的代稱問題）：

```js
function setPdfDocumentTitle(scope) {
  const member = activeMember();
  const parts = ["模板工程複核表", member?.id, scope === "all" ? "完整檢核紀錄" : TAB_LABELS[activeTab], state.overview.date || today]
    .filter(Boolean)
    .map(value => String(value).trim().replace(/[\\/:*?"<>|\s]+/g, "-").replace(/-+/g, "-"));
  const previousTitle = document.title;
  document.title = parts.join("_");
  window.addEventListener("afterprint", () => { document.title = previousTitle; }, { once: true });
}

function preparePrint(scope) {
  renderPrint();
  document.body.dataset.printScope = scope;
  const page = activeTab === "overview" || activeTab === "members" ? "overview" : activeTab === "install" || activeTab === "measure" ? "checks" : "release";
  $$(".print-page").forEach(item => item.classList.toggle("print-selected", item.dataset.printPage === page));
  setPdfDocumentTitle(scope);
  paginatePrintReport();
}

function exportPdf(scope) {
  $("#export-dialog").close();
  preparePrint(scope);
  window.print();
}
```

- [ ] **Step 7：跑驗證**

Run: `python3 scripts/verify_print_layout.py`
Expected: 10 行全部 `✅`，exit code 0。順手翻 `tmp/verify-print/diaphragm-wall-many.pdf`：澆置紀錄第一頁是摘要＋曲線＋前 16 車，後面續頁有文件表頭、「逐車混凝土澆置紀錄（續）」與表格表頭，最後一頁右下角才有簽名欄；`template-many.pdf` 應有一頁只有表頭＋簽名欄（表格剛好填滿前一頁時的正確行為）。

- [ ] **Step 8：手機實測**

iPhone Safari 開 `diaphragm-wall.html` → 輸出 → 目前頁面 PDF 與完整 PDF，確認簽名欄在每張表最後一頁右下角、按下輸出後頁面沒有跳回頂端。

- [ ] **Step 9：Commit**

```bash
git add app.css template.css steel.css diaphragm-wall.html diaphragm-wall-gc.html template.html rebar.html steel-structure.html app.js wall-gc.js template.js rebar.js steel.js scripts/verify_print_layout.py
git commit -m "fix: 簽名欄固定在各表最後一頁右下角，內容跨頁時整個移到下一頁"
```

---

### Task 4：PDF 未填欄位留白（需求 2）

需求寫明「未填或未選的內容保持空白」，目前 PDF 全部印成「—」。注意：改完後空白欄位和刻意留白會長得一樣；若要保留「—」就跳過這個 Task 並告訴使用者。

**Files:** `app.js`、`wall-gc.js`、`steel.js`、`rebar.js`、`template.js`

- [ ] **Step 1：五支 JS 都在 `const display = …` 下一行加**

```js
const printText = value => String(value ?? "").trim(); // PDF 用：未填就留白，不印「—」
```

- [ ] **Step 2：只在列印用的函式裡把 `display(` 換成 `printText(`**

- `app.js`：`printHeader`、`printProjectOverview`、`printWallInfo`、`renderPrint`
- `wall-gc.js`：`printHeader`、`printUnitInfo`、`printHoldSection`、`printConclusion`、`renderPrint`
- `steel.js`：`printHeader`、`printMeta`、`printChecks`、`renderPrint`
- `rebar.js`、`template.js`：`printHeader`、`printValue`

螢幕上的摘要（`renderSummary`、`updateIdentity` 之類）維持用 `display`。

- [ ] **Step 3：驗證**

Run: `python3 scripts/verify_print_layout.py && pdftotext -layout tmp/verify-print/steel-structure-empty.pdf - | grep -c "—"`
Expected: 第一行全 ✅；第二行 `0`。

- [ ] **Step 4：Commit**

```bash
git add app.js wall-gc.js steel.js rebar.js template.js
git commit -m "fix: PDF 未填欄位留白"
```

---

### Task 5：檔名不得出現代稱

**Files:** `rebar.js:182`、`app.js:1088`、`wall-gc.js:1114`（`template.js` 已在 Task 3 改好）

- [ ] **Step 1：`rebar.js` 的 `setPdfDocumentTitle`**

`member?.id || member?.type` 改成 `member?.id`（沒編號就省略，不要用「柱」「梁」代替）。

- [ ] **Step 2：`app.js` 與 `wall-gc.js` 的 `exportFileName`（JSON／Markdown 用）**

```js
// app.js
function exportFileName(extension) {
  const recordId = safeFilePart(state.wall.unitNo || state.guideWall.unitNo || state.rebarCage.unitNo, "");
  const date = safeFilePart(state.overview.date || today, today);
  return `${["diaphragm-wall", recordId, date].filter(Boolean).join("-")}.${extension}`;
}
```

```js
// wall-gc.js
function exportFileName(extension) {
  const recordId = safeFilePart(state.unit.unitNo || state.guideWall.unitNo || state.rebarCage.unitNo, "");
  const date = safeFilePart(state.overview.date || today, today);
  return `${["diaphragm-wall-gc", recordId, date].filter(Boolean).join("-")}.${extension}`;
}
```

- [ ] **Step 3：驗證**

瀏覽器開 `rebar.html`，構件不填編號，Console 執行 `preparePrint('current'); document.title` → 應為 `鋼筋工程查驗表_工程概要_2026-09-16`（無「柱」）。`diaphragm-wall.html` 不填編號匯出 JSON → 檔名 `diaphragm-wall-2026-09-16.json`。

- [ ] **Step 4：Commit**

```bash
git add rebar.js app.js wall-gc.js
git commit -m "fix: 檔名無識別編號時直接省略，不用代稱"
```

---

### Task 6：範例 PDF 改由正式輸出重新產生

**問題：** 現在的範例只是拿舊 PDF 塗白文字塊（`scripts/update_example_pdf_format.py`），鋼筋／鋼構甚至是 ReportLab 另一套排版（`scripts/generate_example_pdfs.py`），簽名欄位置也都是舊的錯誤版。`diaphragm-wall-example-separate-pouring.pdf`（獨立澆置頁）對應的功能 App 已經沒有了，一併移除。

**Files:**
- Delete: `scripts/generate_example_pdfs.py`、`scripts/update_example_pdf_format.py`、`examples/diaphragm-wall-example-separate-pouring.pdf`
- Create: `scripts/render_example_pdfs.py`
- Modify: `app.js`、`wall-gc.js`（加 `loadExample()` 與 `?example=1`）、`diaphragm-wall.html:260`（拿掉獨立澆置頁連結）

- [ ] **Step 1：先把舊範例的內容存起來當資料來源（覆蓋前做）**

```bash
mkdir -p tmp/old-examples && for f in examples/*.pdf; do pdftotext -layout "$f" "tmp/old-examples/$(basename "${f%.pdf}").txt"; done
```

- [ ] **Step 2：`app.js` 與 `wall-gc.js` 加範例模式**

比照 `template.js:108-110` 與 `template.js:438`：

```js
// app.js — 取代 const draft = createDraftStore("project-portal.diaphragmWall.draft", () => state);
const draft = createDraftStore("project-portal.diaphragmWall.draft", () => state, {
  enabled: new URLSearchParams(location.search).get("example") !== "1"
});
```

```js
// app.js — 在 Object.assign(state, draft.load() ?? {}); 之後、initialize(); 之前
if (new URLSearchParams(location.search).get("example") === "1") loadExample();
```

新增 `function loadExample()`：把 `state.overview`、`state.wall`、`state.soil`、`state.depth`、`state.prework`、`state.trucks`、`state.guideWall`、`state.rebarCage`、`state.quality` 填成 `tmp/old-examples/diaphragm-wall-example.txt`、`guide-wall-example.txt`、`rebar-cage-example.txt` 裡的數值（工程名稱 `Example Construction Project — North Lot`、公單元 21、順序 03、強度 350、設計深度 −35.0、車次資料等，逐項對照舊 PDF）。欄位名稱以 `createState`／`state` 初始物件與 `calculatedTrucks()` 讀的鍵為準（例如車次是 `state.trucks[i].volume / measured / truckNo / unload / finish`，先 `grep -n "truck\." app.js` 確認）。`wall-gc.js` 同樣做法，資料來源是 `diaphragm-wall-gc-example.txt`、`gc-guide-wall-example.txt`、`gc-rebar-cage-example.txt`。

- [ ] **Step 3：建立 `scripts/render_example_pdfs.py`**

```python
"""用 headless Chrome 走真正的 App 輸出流程產生 examples/*.pdf。
用法：python3 scripts/render_example_pdfs.py
"""
import subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "examples"
PORT = 4198

# (頁面, 輸出檔名, 進頁後切換工具／分頁的 JS, 輸出範圍)
TARGETS = [
    ("diaphragm-wall.html", "diaphragm-wall-example.pdf", "showTool('diaphragmWall'); showTab('quality');", "all"),
    ("diaphragm-wall.html", "guide-wall-example.pdf", "showTool('guideWall');", "current"),
    ("diaphragm-wall.html", "rebar-cage-example.pdf", "showTool('rebarCage');", "current"),
    ("diaphragm-wall-gc.html", "diaphragm-wall-gc-example.pdf", "showTool('inspection'); showTab('overview');", "all"),
    ("diaphragm-wall-gc.html", "gc-guide-wall-example.pdf", "showTool('guideWall');", "current"),
    ("diaphragm-wall-gc.html", "gc-rebar-cage-example.pdf", "showTool('rebarCage');", "current"),
    ("template.html", "template-example.pdf", "", "all"),
    ("rebar.html", "rebar-example.pdf", "", "all"),
    ("steel-structure.html", "steel-structure-example.pdf", "", "all"),
]

server = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for html, filename, setup, scope in TARGETS:
            page = browser.new_page()
            page.goto(f"http://127.0.0.1:{PORT}/{html}?example=1", wait_until="networkidle")
            page.evaluate(f"() => {{ window.print = () => {{}}; {setup} return preparePrint('{scope}'); }}")
            page.emulate_media(media="print")
            page.pdf(path=str(OUT / filename), prefer_css_page_size=True, print_background=True)
            print(f"寫入 examples/{filename}  標題：{page.evaluate('document.title')}")
            page.close()
        browser.close()
finally:
    server.terminate()
```

- [ ] **Step 4：刪舊腳本與舊範例，拿掉獨立澆置頁連結**

```bash
git rm scripts/generate_example_pdfs.py scripts/update_example_pdf_format.py examples/diaphragm-wall-example-separate-pouring.pdf
```

`diaphragm-wall.html:260` 的 `example-button-split` 改成單一連結：

```html
          <a class="example-button" href="./examples/diaphragm-wall-example.pdf" target="_blank" rel="noopener"><span>連續壁｜完整範例 PDF</span><small>查看全部輸出頁面</small></a>
```

`sw.js` 的 `APP_SHELL` 移除 `"./examples/diaphragm-wall-example-separate-pouring.pdf"`。

- [ ] **Step 5：產生並驗證**

Run: `python3 scripts/render_example_pdfs.py && for f in examples/*.pdf; do echo "== $f"; pdfinfo "$f" | grep -E "Title|Producer|Pages"; pdfinfo -f 1 -l 20 "$f" | grep "size"; done`
Expected：
- Producer 全部是 `Skia/PDF`（沒有 ReportLab）；
- Title 全部是 `工具名稱_識別編號_…_日期` 格式；
- 只有 `diaphragm-wall-example.pdf` 的澆置頁是 `841.92 x 594.96`（橫向），其餘全部 `594.96 x 841.92`；
- `pdftotext examples/*.pdf - | grep -E "資料版本|輸出時間|簽核|Project Portal"` 沒有輸出。

※ 正式輸出時 PDF 的 Title 中繼資料就是 `document.title`，也就是檔名格式（`連續壁施工紀錄_21_完整檢核紀錄_2026-08-11`），不會再有「｜Portable Inspection」；範例既然改用正式流程產生，也會是這個格式，屬正常。

再把 `scripts/verify_print_layout.py` 的 `check()` 套到 `examples/*.pdf`（可暫時在 Python REPL 執行）確認每頁簽名欄底距頁底 ≤ 16mm。

- [ ] **Step 6：Commit**

```bash
git add scripts/render_example_pdfs.py app.js wall-gc.js diaphragm-wall.html sw.js examples/*.pdf
git commit -m "feat: 範例 PDF 改由正式輸出流程重新產生"
```

---

### Task 7：App 圖示——iPhone 主畫面、manifest、favicon

**問題：** 沒有任何頁面有 `<link rel="apple-touch-icon">`；`app-icon.png` 四周約 80px 與四個圓角是透明，iOS 會把透明填成黑色；`template.html`／`rebar.html`／`steel-structure.html` 沒有 manifest；`404.html` 標題沒有品牌名；988KB 的 PNG 同時當 favicon 與頁首小圖。

**Files:**
- Create: `scripts/build_icons.py`、`apple-touch-icon.png`、`icon-192.png`、`icon-512.png`、`icon-maskable-512.png`、`app-icon-144.png`
- Modify: `manifest.webmanifest`、六個 HTML 的 `<head>`、`index.html:26`、`404.html`
- Delete: `icon.svg`（舊版文件圖示，沒人引用）

- [ ] **Step 1：建立 `scripts/build_icons.py`**

```python
"""從 app-icon.png（有透明留白與圓角）產生各平台需要的實心方形圖示。
用法：python3 scripts/build_icons.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
source = Image.open(ROOT / "app-icon.png").convert("RGBA")
art = source.crop(source.getbbox())  # 去掉四周透明留白


def vertical_gradient(size, top, bottom):
    canvas = Image.new("RGBA", size)
    pixels = canvas.load()
    width, height = size
    for y in range(height):
        t = y / max(height - 1, 1)
        colour = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
        for x in range(width):
            pixels[x, y] = colour
    return canvas


# 用圖本身頂／底的顏色當底色，把透明圓角補滿成實心正方形（iOS 會把透明填成黑色）
top = art.getpixel((art.width // 2, 10))[:3]
bottom = art.getpixel((art.width // 2, art.height - 11))[:3]
side = max(art.size)
square = vertical_gradient((side, side), top, bottom)
square.alpha_composite(art, ((side - art.width) // 2, (side - art.height) // 2))
square = square.convert("RGB")

for name, size in (("apple-touch-icon.png", 180), ("icon-192.png", 192), ("icon-512.png", 512)):
    square.resize((size, size), Image.LANCZOS).save(ROOT / name, optimize=True)

# maskable：滿版底色，圖案縮到 80% 放中間（Android 會裁成圓形／圓角）
maskable = vertical_gradient((512, 512), top, bottom)
inner = art.resize((410, round(410 * art.height / art.width)), Image.LANCZOS)
maskable.alpha_composite(inner, ((512 - inner.width) // 2, (512 - inner.height) // 2))
maskable.convert("RGB").save(ROOT / "icon-maskable-512.png", optimize=True)

# 網頁左上角與分頁圖示：保留原本的透明圓角，但縮到 144px
source.resize((144, 144), Image.LANCZOS).save(ROOT / "app-icon-144.png", optimize=True)
print("done")
```

Run: `python3 scripts/build_icons.py && ls -la apple-touch-icon.png icon-192.png icon-512.png icon-maskable-512.png app-icon-144.png`
Expected：五個檔案存在，每個都遠小於 988KB；用預覽程式打開 `apple-touch-icon.png` 是實心正方形、沒有透明區。

- [ ] **Step 2：`manifest.webmanifest`**

```json
{
  "name": "Portable Inspection",
  "short_name": "Portable Inspection",
  "description": "A local field record entry prototype.",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#ffffff",
  "icons": [
    { "src": "./icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 3：六個 HTML 的 `<head>`**

`index.html`、`diaphragm-wall.html`、`diaphragm-wall-gc.html`、`template.html`、`rebar.html`、`steel-structure.html` 把 `<link rel="icon" href="./app-icon.png" type="image/png" />` 換成下面三行（已經有 manifest 那行的頁面不要重複）：

```html
    <link rel="icon" href="./app-icon-144.png" type="image/png" sizes="144x144" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <link rel="manifest" href="./manifest.webmanifest" />
```

`index.html:26` 與 `404.html:19` 的頁首 `<img src="./app-icon.png" …>` 改成 `./app-icon-144.png`。`404.html` 加 apple-touch-icon 那行，`<title>` 改為 `404｜Portable Inspection`。

- [ ] **Step 4：刪 `icon.svg`**

```bash
git rm icon.svg
```

`sw.js` 的 `APP_SHELL` 移除 `"./icon.svg"`（Task 8 一併處理也可以）。

- [ ] **Step 5：驗證**

Run: `grep -L "apple-touch-icon" index.html 404.html diaphragm-wall.html diaphragm-wall-gc.html template.html rebar.html steel-structure.html`
Expected：沒有輸出（每個檔案都有）。iPhone Safari 開部署後的網址 → 分享 → 加入主畫面，圖示是實心的安全帽＋綠勾、沒有黑邊，名稱 Portable Inspection。

- [ ] **Step 6：Commit**

```bash
git add scripts/build_icons.py apple-touch-icon.png icon-192.png icon-512.png icon-maskable-512.png app-icon-144.png manifest.webmanifest index.html 404.html diaphragm-wall.html diaphragm-wall-gc.html template.html rebar.html steel-structure.html
git commit -m "feat: 補上 apple-touch-icon 與實心方形 App 圖示"
```

---

### Task 8：使用說明加列印提醒、Service Worker 收尾

**Files:** 五個工具頁的 help dialog、`sw.js`

- [ ] **Step 1：使用說明加一句**

五個工具頁 help dialog 的「填寫與輸出」／「資料與輸出」段落結尾加：

```html
輸出 PDF 時，請在瀏覽器的列印設定關閉「頁首及頁尾」，才不會印出網址、日期與頁碼。
```

- [ ] **Step 2：`sw.js` 最終版本與清單**

```js
const CACHE_NAME = "portable-inspection-v75";
const APP_SHELL = ["./index.html", "./404.html", "./glass.css", "./portal.css", "./portal.js", "./draft.js", "./print-pages.js", "./diaphragm-wall.html", "./diaphragm-wall-gc.html", "./wall-gc.js", "./app.css", "./app.js", "./template.html", "./template.css", "./template.js", "./rebar.html", "./rebar.css", "./rebar.js", "./steel-structure.html", "./steel.css", "./steel.js", "./record.html", "./checklists.html", "./manifest.webmanifest", "./app-icon-144.png", "./apple-touch-icon.png", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./taisei.png", "./examples/diaphragm-wall-example.pdf", "./examples/guide-wall-example.pdf", "./examples/rebar-cage-example.pdf", "./examples/diaphragm-wall-gc-example.pdf", "./examples/gc-guide-wall-example.pdf", "./examples/gc-rebar-cage-example.pdf", "./examples/template-example.pdf", "./examples/rebar-example.pdf", "./examples/steel-structure-example.pdf"];
```

- [ ] **Step 3：確認清單裡每個檔案都存在（否則 SW 又會裝不起來）**

```bash
node -e 'const s=require("fs").readFileSync("sw.js","utf8");const m=s.match(/APP_SHELL = (\[.*?\]);/s);for(const f of JSON.parse(m[1]))if(!require("fs").existsSync(f))console.log("缺檔:",f)'
```

Expected：沒有輸出。

- [ ] **Step 4：Commit 並推上去**

```bash
git add diaphragm-wall.html diaphragm-wall-gc.html template.html rebar.html steel-structure.html sw.js
git commit -m "chore: 使用說明加列印提醒，快取升到 v75"
git push origin main
```

- [ ] **Step 5：線上驗收**

部署完成後：
- `curl -s https://yuhudaddy.github.io/portable-inspection/sw.js | head -1` → `v75`；
- 手機開任一工具（原本裝過舊版的手機）重新整理兩次，DevTools／Safari 網頁檢閱器看到 SW 為 v75；
- 手機輸出 PDF，檔名為 `連續壁施工紀錄_A01_澆置紀錄_2026-09-16.pdf` 形式，簽名欄在右下角；
- `python3 scripts/verify_print_layout.py` 全部 ✅。

---

## 已知限制（不在本次修正範圍，回報使用者即可）

- iOS Safari 不支援 `@page { size: landscape }`，澆置紀錄在 iPhone 上仍需使用者在列印預覽自行選橫向；Chrome／桌面版正常。
- 單一區塊本身超過一頁（例如備註一次貼 60 行）時，分頁器會把它留在原頁並截掉超出部分；表格類內容不受影響，因為是以列為單位拆頁。
- 瀏覽器自動加的頁首頁尾（網址、頁碼）只能由使用者在列印設定關閉，程式無法控制。
