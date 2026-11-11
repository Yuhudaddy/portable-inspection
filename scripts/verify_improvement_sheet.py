"""改善表（improvement-sheet）的瀏覽器端到端檢查：python3 scripts/verify_improvement_sheet.py

用 Playwright 的 Chrome 與 WebKit（iPhone 裝置）開改善表，填入彩色照片，按「輸出 PDF」，
navigator.share 換成會把檔案收起來的假的，再用 PyMuPDF 檢查收到的 PDF：頁數、紙張（A4 直式／A3 橫式）、
每頁有內容且滿版、有照片的色彩、標題資訊、檔名、分享內容只有一個檔案。
另外檢查：手勢失效（NotAllowedError）改顯示「分享」按鈕、產生中取消、不能分享檔案時改下載、
電腦走 window.print()、右下角浮動按鈕（Gooey 選單）、專案檔存與開（含 iPhone 走分享）、沒有頁面錯誤或 CSP 違規。
PDF 的組檔、轉圖重試、進度橫幅與分享遞送是 pdf-share.js 共用的；它自己的純函式檢查在 scripts/verify_pdf_share.mjs。
"""
import base64
import json
import subprocess
import sys
import time
from pathlib import Path

import fitz
import numpy as np
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tmp" / "verify-improvement-sheet"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 4204
BASE = f"http://127.0.0.1:{PORT}"

STUBS = """
(() => {
  window.__printCalls = 0;
  window.print = () => { window.__printCalls += 1; };
  window.__shared = [];
  window.__shareCalls = 0;
  window.__shareMode = "ok";
  const toBase64 = bytes => { let text = ""; for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(text); };
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  Object.defineProperty(navigator, "share", { configurable: true, value: async data => {
    window.__shareCalls += 1;
    if (window.__shareMode === "notallowed-once" && window.__shareCalls === 1) throw new DOMException("no gesture", "NotAllowedError");
    const file = data.files[0];
    window.__shared.push({ name: file.name, type: file.type, size: file.size, keys: Object.keys(data), files: data.files.length, b64: toBase64(new Uint8Array(await file.arrayBuffer())) });
  } });
})();
"""
# 沒有 canShare 的環境（舊版 iOS、桌面）：Mac 的 Chrome 原生就有 navigator.canShare／share，要明確拿掉；只留列印的假的
PRINT_ONLY = """
window.__printCalls = 0;
window.print = () => { window.__printCalls += 1; };
Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
"""

# 產生 n 張 1600 邊長的彩色 JPEG，丟進「新增照片」的檔案欄位
MAKE_PHOTOS = """async (n) => {
  const files = [];
  for (let i = 0; i < n; i += 1) {
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = i % 2 ? 1200 : 1600;
    const ctx = canvas.getContext('2d');
    const hue = (i * 47) % 360;
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, `hsl(${hue},85%,40%)`); gradient.addColorStop(1, `hsl(${(hue + 90) % 360},90%,60%)`);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    files.push(new File([blob], `p${i}.jpg`, { type: 'image/jpeg' }));
  }
  const dt = new DataTransfer(); files.forEach(file => dt.items.add(file));
  const input = document.getElementById('inPick'); input.files = dt.files; input.dispatchEvent(new Event('change'));
}"""

failures = []


def check(ok, name, detail=""):
    print(f"{'✅' if ok else '❌'} {name}")
    if not ok:
        failures.append(name)
        if detail:
            print(f"    {detail}")
    return ok


def decode(shared):
    return base64.b64decode(shared["b64"])


def open_sheet(context, query="?export=share", paper="a4", photos=14, errors=None):
    page = context.new_page()
    if errors is not None:
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.goto(f"{BASE}/improvement-sheet{query}", wait_until="networkidle")
    # 同一個環境會沿用上一個測試的自動保存：直接清空資料表（頁面連著資料庫時 deleteDatabase 會被擋住）
    page.evaluate("""() => new Promise(resolve => {
      const request = indexedDB.open('improvement-sheet', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('kv');
      request.onsuccess = () => {
        const tx = request.result.transaction('kv', 'readwrite');
        tx.objectStore('kv').clear();
        tx.oncomplete = () => { request.result.close(); resolve(); };
      };
    })""")
    page.goto(f"{BASE}/improvement-sheet{query}", wait_until="networkidle")
    page.fill("#fProject", "汎陸高雄客室浴廁防水修繕工程")
    page.fill("#fWork", "客室漏水改善")
    page.fill("#fContractor", "示範承包商")
    page.click(f'input[name="paper"][value="{paper}"] + span')
    if photos:
        page.evaluate(MAKE_PHOTOS, photos)
        page.wait_for_function(f"() => document.querySelectorAll('#grid .tile[data-id]').length === {photos}", timeout=120000)
        # 加照片後編輯面板會自動打開（第一張）：填地點與內容，再逐張用 › 切換，最後關閉
        page.wait_for_selector("#editor[open]", timeout=10000)
        for index in range(photos):
            page.fill("#edLoc", "4F客室漏水")
            page.fill("#edContent", "打針改善")
            if index < photos - 1:
                page.click("#edNext")
        page.click("#edClose")
        page.wait_for_function("() => !document.getElementById('editor').open", timeout=5000)
    return page


def analyse(data, pages, size_pt, per_page_min_colour, last_page_max_ratio=None):
    """檢查 PDF：頁數、紙張、每頁有內容且滿版、照片色彩、標題資訊"""
    doc = fitz.open(stream=data, filetype="pdf")
    check(doc.page_count == pages, f"PDF 頁數 {doc.page_count} ＝ {pages}")
    check(all(abs(pg.rect.width - size_pt[0]) < 0.1 and abs(pg.rect.height - size_pt[1]) < 0.1 for pg in doc), f"每頁都是 {size_pt[0]}×{size_pt[1]} pt")
    colours = []
    for index, pg in enumerate(doc):
        pix = pg.get_pixmap(matrix=fitz.Matrix(0.5, 0.5), colorspace=fitz.csRGB)
        arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(int)
        nonwhite = arr.min(axis=2) < 245
        colour = ((arr.max(axis=2) - arr.min(axis=2)) > 60).mean()
        colours.append(colour)
        cols = np.where(nonwhite.any(axis=0))[0]
        spread = (cols.max() - cols.min()) / pix.width if len(cols) else 0
        check(nonwhite.mean() > 0.05, f"第 {index + 1} 頁有內容（非白色 {nonwhite.mean():.0%}）")
        check(spread > 0.85, f"第 {index + 1} 頁內容橫向佔 {spread:.0%}（滿版、沒有被縮小）")
        if index < pages - 1:
            check(colour > per_page_min_colour, f"第 {index + 1} 頁照片有色彩（{colour:.0%}）")
    if last_page_max_ratio is not None and pages > 1:
        check(0.005 < colours[-1] < colours[0] * last_page_max_ratio, f"最後一頁照片較少（{colours[-1]:.0%} 少於第一頁 {colours[0]:.0%}）")
    return doc


def title_of(doc):
    return (doc.metadata or {}).get("title", "")


server = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "serve.py"), str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
errors = []
try:
    with sync_playwright() as p:
        chrome = p.chromium.launch(channel="chrome")
        webkit = p.webkit.launch()
        desktop = chrome.new_context(viewport={"width": 1100, "height": 900}, service_workers="block", accept_downloads=True)
        desktop.add_init_script(STUBS)
        iphone = webkit.new_context(**p.devices["iPhone 14"], service_workers="block")
        iphone.add_init_script(STUBS)

        # ---- A3 橫式、14 張：12 ＋ 2，共 2 頁（Chrome，?export=share）----
        print("== A3 橫式 14 張（Chrome）")
        page = open_sheet(desktop, paper="a3", errors=errors)
        start = time.time()
        page.click("#btnExport")
        page.wait_for_function("() => window.__shared.length > 0 || document.querySelector('.pdf-share-dialog[data-state=error]')", timeout=240000)
        spent = time.time() - start
        shared = page.evaluate("() => window.__shared")
        check(len(shared) == 1 and shared[0]["files"] == 1 and shared[0]["keys"] == ["files"], "分享內容只有一個檔案（不帶 title／text）")
        check(shared[0]["type"] == "application/pdf" and shared[0]["name"].endswith("_汎陸高雄客室浴廁防水修繕工程_客室漏水改善.pdf"), f"檔名 {shared[0]['name']}")
        doc = analyse(decode(shared[0]), 2, (1190.55, 841.89), 0.12, last_page_max_ratio=0.5)
        check(title_of(doc) == shared[0]["name"][:-4], f"PDF 標題資訊 ＝ 檔名（{title_of(doc)}）")
        check(spent < 60, f"產生時間 {spent:.1f} 秒（上限 60 秒）")
        page.wait_for_function("() => !document.querySelector('.pdf-share-dialog')", timeout=15000)
        check(page.evaluate("() => document.getElementById('printRoot').children.length === 0"), "離屏副本已清掉")
        check(page.evaluate("() => window.__printCalls === 0"), "沒有呼叫 window.print()")
        (OUT / "a3-14.pdf").write_bytes(decode(shared[0]))
        page.close()

        # ---- A4 直式、14 張：3＋3＋3＋3＋2，共 5 頁 ----
        print("== A4 直式 14 張（Chrome）")
        page = open_sheet(desktop, paper="a4", errors=errors)
        page.click("#btnExport")
        page.wait_for_function("() => window.__shared.length > 0 || document.querySelector('.pdf-share-dialog[data-state=error]')", timeout=240000)
        shared = page.evaluate("() => window.__shared")
        doc = analyse(decode(shared[0]), 5, (595.28, 841.89), 0.08, last_page_max_ratio=0.9)
        (OUT / "a4-14.pdf").write_bytes(decode(shared[0]))
        page.close()

        # ---- 手勢失效：先被擋，再按「分享」----
        print("== 手勢失效（NotAllowedError）改顯示「分享」按鈕")
        page = open_sheet(desktop, paper="a3", photos=3, errors=errors)
        page.evaluate("() => { window.__shareMode = 'notallowed-once'; }")
        page.click("#btnExport")
        page.wait_for_selector(".pdf-share-dialog[data-state=ready]", timeout=120000)
        check(page.evaluate("() => window.__shared.length === 0 && window.__shareCalls === 1"), "第一次被擋，還沒有檔案被分享")
        page.click(".pdf-share-primary")
        page.wait_for_function("() => window.__shared.length === 1", timeout=15000)
        check(page.evaluate("() => window.__shareCalls === 2"), "再點一次「分享」才成功（第二次呼叫）")
        page.wait_for_function("() => !document.querySelector('.pdf-share-dialog')", timeout=15000)
        page.close()

        # ---- 產生中取消 ----
        print("== 產生中按「取消」")
        page = open_sheet(desktop, paper="a3", photos=14, errors=errors)
        # 測試用的簡單照片一秒內就轉完，來不及取消：把轉圖函式放慢，每頁多等 1.5 秒
        page.evaluate("""async () => {
          await PdfShare.loadLibrary();
          const original = window.htmlToImage.toCanvas;
          window.htmlToImage.toCanvas = async (...args) => { await new Promise(resolve => setTimeout(resolve, 1500)); return original(...args); };
        }""")
        page.click("#btnExport")
        page.wait_for_selector(".pdf-share-dialog[data-state=working]", timeout=20000)
        page.click(".pdf-share-secondary")
        time.sleep(4)
        check(page.evaluate("() => window.__shared.length === 0 && window.__shareCalls === 0"), "取消後沒有分享任何檔案")
        check(page.evaluate("() => !document.querySelector('.pdf-share-dialog') && document.getElementById('printRoot').children.length === 0"), "取消後對話框與離屏副本都已清掉")
        page.evaluate("() => { window.__shared.length = 0; }")
        page.click("#btnExport")
        page.wait_for_function("() => window.__shared.length === 1", timeout=240000)
        check(True, "取消後可以再次輸出")
        page.close()

        # ---- 不能分享檔案：改下載 ----
        print("== 不能分享檔案時直接下載 PDF")
        plain = chrome.new_context(viewport={"width": 1100, "height": 900}, service_workers="block", accept_downloads=True)
        plain.add_init_script(PRINT_ONLY)
        page = open_sheet(plain, paper="a3", photos=3, errors=errors)
        with page.expect_download(timeout=240000) as download_info:
            page.click("#btnExport")
        download = download_info.value
        path = OUT / "download.pdf"
        download.save_as(str(path))
        analyse(path.read_bytes(), 1, (1190.55, 841.89), 0.05)
        check(page.evaluate("() => window.__printCalls === 0"), "下載路徑沒有呼叫 window.print()")
        page.close()

        # ---- 電腦（不帶參數）：走列印 ----
        print("== 電腦不帶參數走 window.print()")
        page = open_sheet(plain, query="", paper="a3", photos=14, errors=errors)
        page.click("#btnExport")
        page.wait_for_function("() => window.__printCalls === 1", timeout=60000)
        check(page.evaluate("() => document.querySelectorAll('#printRoot .sheet').length === 2"), "列印用的離屏副本有 2 張紙")
        check(page.evaluate("() => !document.querySelector('.pdf-share-dialog')"), "沒有出現分享對話框")
        sizes = page.evaluate("() => [...document.querySelectorAll('#printRoot .sheet')].map(s => [Math.round(s.getBoundingClientRect().width / (96 / 25.4)), Math.round(s.getBoundingClientRect().height / (96 / 25.4))])")
        check(sizes == [[420, 297], [420, 297]], f"離屏副本尺寸 {sizes}（420×297 mm）")
        page.evaluate("() => window.dispatchEvent(new Event('afterprint'))")
        check(page.evaluate("() => document.getElementById('printRoot').children.length === 0"), "afterprint 後離屏副本清掉")
        page.close()

        # ---- iPhone（WebKit）：靠使用者代理自動走分享，不加 ?export=share ----
        print("== iPhone（WebKit）A3 與 A4")
        for paper, pages, size in (("a3", 2, (1190.55, 841.89)), ("a4", 5, (595.28, 841.89))):
            page = open_sheet(iphone, query="", paper=paper, photos=14, errors=errors)
            page.click('[data-view-tab="preview"]')   # 手機版的「輸出 PDF」在預覽頁籤裡
            start = time.time()
            page.click("#btnExport")
            page.wait_for_function("() => window.__shared.length > 0 || document.querySelector('.pdf-share-dialog[data-state=error]')", timeout=240000)
            spent = time.time() - start
            shared = page.evaluate("() => window.__shared")
            check(len(shared) == 1 and page.evaluate("() => window.__printCalls") == 0, f"iPhone {paper}：走分享、沒有呼叫 window.print()")
            if shared:
                analyse(decode(shared[0]), pages, size, 0.05 if paper == "a4" else 0.1)
            check(spent < 90, f"iPhone {paper} 產生時間 {spent:.1f} 秒（上限 90 秒）")
            page.close()

        # ---- 右下角浮動按鈕（Gooey 選單）----
        print("== 右下角浮動按鈕（Gooey 選單）")
        page = open_sheet(desktop, paper="a4", photos=3, errors=errors)
        fab = page.locator("#photoMenuButton")
        check(fab.is_visible(), "電腦：浮動按鈕可見")
        geometry = page.evaluate("() => { const f = document.getElementById('photo-fab').getBoundingClientRect(), c = document.querySelector('.col-input').getBoundingClientRect(), p = document.querySelector('.preview').getBoundingClientRect(); return { fabRight: f.right, colRight: c.right, previewLeft: p.left }; }")
        check(geometry["fabRight"] <= geometry["colRight"] + 1 and geometry["fabRight"] <= geometry["previewLeft"], f"電腦：浮動按鈕在左欄內，沒有蓋到右邊的預覽（{geometry}）")
        # 收起時項目是透明的（Playwright 仍算「可見」），所以改查透明度與 inert：不能被點，也不能被 Tab 到
        check(page.evaluate("() => [...document.querySelectorAll('#photo-fab .export-fab-item')].every(e => getComputedStyle(e).opacity === '0') && document.getElementById('photo-fab-items').inert"), "選單收起時，三個項目是透明的，也不能被點或用 Tab 選取")
        fab.click()
        page.wait_for_function("() => document.getElementById('photo-fab').classList.contains('is-open')", timeout=3000)
        page.wait_for_timeout(800)   # 等彈出動畫播完
        labels = page.evaluate("() => [...document.querySelectorAll('#photo-fab .export-fab-item span')].map(e => e.textContent)")
        check(labels == ["清空", "拍照", "新增"], f"展開後有三個項目，文字與順序正確（{labels}）")
        check(all(page.locator(sel).is_visible() for sel in ("#btnClear", "#btnCamera", "#btnPick")), "展開後三個項目都看得到")
        check(page.evaluate("() => document.querySelectorAll('#photo-fab .export-fab-item svg').length") == 3, "每個項目都有圖示")
        check(fab.get_attribute("aria-expanded") == "true", "主按鈕的 aria-expanded 是 true")
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.getElementById('photo-fab').classList.contains('is-open')", timeout=3000)
        check(fab.get_attribute("aria-expanded") == "false", "按 Esc 收起")
        fab.click()
        page.wait_for_timeout(800)
        with page.expect_file_chooser(timeout=5000) as chooser:
            page.click("#btnPick")
        check(chooser.value is not None, "按「新增」會開啟檔案選擇器")
        check(not page.evaluate("() => document.getElementById('photo-fab').classList.contains('is-open')"), "選完一項後選單自動收起")
        fab.click()
        page.wait_for_timeout(800)
        page.once("dialog", lambda d: d.dismiss())
        page.click("#btnClear")
        page.wait_for_timeout(500)
        check(page.evaluate("() => document.querySelectorAll('#grid .tile[data-id]').length") == 3, "「清空」按取消：照片都還在")
        fab.click()
        page.wait_for_timeout(800)
        page.once("dialog", lambda d: d.accept())
        page.click("#btnClear")
        page.wait_for_function("() => document.querySelectorAll('#grid .tile[data-id]').length === 0", timeout=5000)
        check(True, "「清空」確認後：照片全部清除")
        page.close()

        print("== 浮動按鈕（iPhone 版面）")
        page = open_sheet(iphone, query="", paper="a4", photos=3, errors=errors)
        check(not page.locator("#photoMenuButton").is_visible(), "手機：在「表頭」頁籤看不到浮動按鈕")
        page.click('[data-view-tab="photos"]')
        check(page.locator("#photoMenuButton").is_visible(), "手機：在「照片」頁籤看得到浮動按鈕")
        view = page.evaluate("() => { const f = document.getElementById('photoMenuButton').getBoundingClientRect(); return { right: f.right, bottom: f.bottom, w: innerWidth, h: innerHeight, size: [f.width, f.height] }; }")
        check(view["right"] > view["w"] - 40 and view["bottom"] > view["h"] - 40, f"手機：按鈕固定在畫面右下角（{view}）")
        check(view["size"][0] >= 44 and view["size"][1] >= 44, f"手機：按鈕大小 {view['size']}（至少 44px）")
        page.click("#photoMenuButton")
        page.wait_for_timeout(800)
        inside = page.evaluate("() => [...document.querySelectorAll('#photo-fab .export-fab-item')].map(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })")
        check(all(inside), f"手機：展開的三個項目都在畫面內（{inside}）")
        page.keyboard.press("Escape")
        page.click('[data-view-tab="preview"]')
        check(not page.locator("#photoMenuButton").is_visible(), "手機：切到「預覽」頁籤，浮動按鈕就不出現")
        page.close()

        # ---- 空狀態：點預覽的空格子、把照片拖到照片面板 ----
        print("== 空狀態：點預覽空格子與拖曳")
        page = open_sheet(desktop, paper="a4", photos=0, errors=errors)
        check(page.evaluate("() => document.querySelectorAll('#grid .tile').length === 0"), "還沒有照片時縮圖格是空的（沒有多餘的「新增」格）")
        with page.expect_file_chooser(timeout=5000) as chooser:
            page.click("#preview .sh-add >> nth=0")
        check(chooser.value is not None, "點預覽的空格子會開啟檔案選擇器")
        page.evaluate("""async () => {
          const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 600;
          const ctx = canvas.getContext('2d'); ctx.fillStyle = '#3a7'; ctx.fillRect(0, 0, 800, 600);
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
          const dt = new DataTransfer(); dt.items.add(new File([blob], 'dropped.jpg', { type: 'image/jpeg' }));
          const pane = document.querySelector('.pane[data-pane="photos"]');
          pane.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
          pane.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
        }""")
        page.wait_for_function("() => document.querySelectorAll('#grid .tile[data-id]').length === 1", timeout=15000)
        check(True, "空狀態下把照片拖到照片面板：加入 1 張")
        page.wait_for_selector("#editor[open]", timeout=5000)
        check(page.evaluate("() => document.querySelectorAll('#grid .tile').length === document.querySelectorAll('#grid .tile[data-id]').length"), "縮圖格裡只有照片格，沒有「新增」格")
        page.click("#edClose")
        page.close()

        # ---- 專案檔：iPhone 走分享，存出來再開回去 ----
        print("== 專案檔存與開")
        page = open_sheet(iphone, query="", paper="a3", photos=3, errors=errors)
        page.click("#btnSaveProject")
        page.wait_for_function("() => window.__shared.length === 1", timeout=30000)
        shared = page.evaluate("() => window.__shared")
        project = json.loads(decode(shared[0]))
        check(shared[0]["name"].endswith(".json") and project["schema"] == "improvement-sheet" and len(project["data"]["items"]) == 3, f"專案檔 {shared[0]['name']}，照片 {len(project['data']['items'])} 張")
        check(project["data"]["items"][0]["loc"] == "4F客室漏水" and project["data"]["project"] == "汎陸高雄客室浴廁防水修繕工程", "專案檔內有表頭與每張的文字")
        saved = OUT / "project.json"
        saved.write_bytes(decode(shared[0]))
        page.close()
        page = open_sheet(iphone, query="", paper="a4", photos=0, errors=errors)   # 已填表頭，算有內容
        messages = []
        page.once("dialog", lambda d: (messages.append(d.message), d.dismiss()))
        page.set_input_files("#inOpen", str(saved))
        page.wait_for_timeout(1500)   # 不能用 time.sleep：Playwright 的同步 API 要在它自己的等待裡才會處理對話框事件
        check(bool(messages) and "取代目前的內容" in messages[0], "目前有內容時，開啟專案檔會先詢問")
        check(page.evaluate("() => document.querySelectorAll('#grid .tile[data-id]').length") == 0 and page.input_value("#fWork") == "客室漏水改善", "按取消：目前的內容維持原樣")
        page.once("dialog", lambda d: d.accept())
        page.set_input_files("#inOpen", str(saved))
        page.wait_for_function("() => document.querySelectorAll('#grid .tile[data-id]').length === 3", timeout=15000)
        check(page.evaluate("() => document.querySelector('input[name=paper]:checked').value") == "a3" and page.input_value("#fWork") == "客室漏水改善", "開啟專案檔：版型與表頭都還原")
        page.click('[data-view-tab="photos"]')   # 手機版縮圖在「照片」頁籤裡
        page.click('#grid .tile[data-idx="0"]')
        page.wait_for_selector("#editor[open]", timeout=5000)
        check(page.input_value("#edLoc") == "4F客室漏水", "開啟專案檔：照片的文字還原")
        page.click("#edClose")
        page.close()

        # ---- 沒有任何錯誤 ----
        print("== 頁面錯誤與 CSP")
        check(not errors, "整個過程沒有頁面錯誤、主控台錯誤或 CSP 違規", "\n    ".join(errors[:8]))

        chrome.close()
        webkit.close()
finally:
    server.terminate()

print(f"\n{len(failures)} 項失敗" if failures else "\n全部通過")
sys.exit(1 if failures else 0)
