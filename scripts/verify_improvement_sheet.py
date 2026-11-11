"""改善表（improvement-sheet）的瀏覽器端到端檢查：python3 scripts/verify_improvement_sheet.py

用 Playwright 的 Chrome 與 WebKit（iPhone 裝置）開改善表，填入彩色照片，按「輸出 PDF」，
navigator.share 換成會把檔案收起來的假的，再用 PyMuPDF 檢查收到的 PDF：頁數、紙張（A4 直式／A3 橫式）、
每頁有內容且滿版、有照片的色彩、標題資訊、檔名、分享內容只有一個檔案。
另外檢查：手勢失效（NotAllowedError）改顯示「分享」按鈕、產生中取消、不能分享檔案時改下載、
電腦走 window.print()、右下角浮動按鈕（Gooey 選單）、檔名帶入、編輯面板的收起手勢、專案檔存與開（含 iPhone 走分享）、沒有頁面錯誤或 CSP 違規。
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

# 用指定檔名產生彩色 JPEG（測試「施工地點_改善內容.jpg」的檔名帶入）
MAKE_NAMED = """async (names) => {
  const files = [];
  for (const name of names) {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 900;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2a7'; ctx.fillRect(0, 0, 1200, 900);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    files.push(new File([blob], name, { type: 'image/jpeg' }));
  }
  const dt = new DataTransfer(); files.forEach(file => dt.items.add(file));
  const input = document.getElementById('inPick'); input.files = dt.files; input.dispatchEvent(new Event('change'));
}"""

# 在指定元素上送出一串觸控事件（touchstart → 幾次 touchmove → touchend），模擬手指往下／往上拖
TOUCH_SWIPE = """async ({ selector, steps }) => {
  const el = document.querySelector(selector);
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const make = (type, yy) => {
    const t = new Touch({ identifier: 7, target: el, clientX: x, clientY: yy, pageX: x, pageY: yy, screenX: x, screenY: yy });
    const live = type === 'touchend' ? [] : [t];
    return new TouchEvent(type, { bubbles: true, cancelable: true, touches: live, targetTouches: live, changedTouches: [t] });
  };
  el.dispatchEvent(make('touchstart', y));
  for (const dy of steps) { el.dispatchEvent(make('touchmove', y + dy)); await new Promise(resolve => setTimeout(resolve, 16)); }
  el.dispatchEvent(make('touchend', y + steps[steps.length - 1]));
}"""

failures = []


def check(ok, name, detail=""):
    print(f"{'✅' if ok else '❌'} {name}")
    if not ok:
        failures.append(name)
        if detail:
            print(f"    {detail}")
    return ok


def read_saved(page):
    """讀 IndexedDB 裡自動保存的狀態"""
    return page.evaluate("""() => new Promise(resolve => {
      const request = indexedDB.open('improvement-sheet', 1);
      request.onsuccess = () => {
        const get = request.result.transaction('kv').objectStore('kv').get('state');
        get.onsuccess = () => { resolve(get.result); request.result.close(); };
      };
    })""")


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
        android = chrome.new_context(**p.devices["Pixel 7"], service_workers="block")
        android.add_init_script(STUBS)

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
        check(labels == ["清除", "拍照", "新增"], f"展開後有三個項目，文字與順序正確（{labels}）")
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
        check(page.evaluate("() => document.querySelectorAll('#grid .tile[data-id]').length") == 3, "「清除」按取消：照片都還在")
        fab.click()
        page.wait_for_timeout(800)
        page.once("dialog", lambda d: d.accept())
        page.click("#btnClear")
        page.wait_for_function("() => document.querySelectorAll('#grid .tile[data-id]').length === 0", timeout=5000)
        check(True, "「清除」確認後：照片全部清除")
        page.close()

        print("== 標題列垃圾桶：清除表頭與照片")
        page = open_sheet(desktop, paper="a4", photos=2, errors=errors)
        page.fill("#fProject", "清除測試")
        page.once("dialog", lambda d: d.dismiss())
        page.click("#btnClearAll")
        page.wait_for_timeout(500)
        check(page.evaluate("() => document.querySelectorAll('#grid .tile[data-id]').length") == 2 and page.input_value("#fProject") == "清除測試",
              "垃圾桶按取消：照片與表頭都還在")
        page.once("dialog", lambda d: d.accept())
        page.click("#btnClearAll")
        page.wait_for_function("() => document.querySelectorAll('#grid .tile[data-id]').length === 0", timeout=5000)
        check(page.input_value("#fProject") == "", "垃圾桶確認後：照片與表頭文字都清掉")
        page.close()

        print("== 浮動按鈕（iPhone 版面）：三個分頁共用一顆")
        page = open_sheet(iphone, query="", paper="a4", photos=3, errors=errors)
        for tab in ["info", "photos", "preview"]:
            page.click(f'[data-view-tab="{tab}"]')
            page.wait_for_timeout(200)
            check(page.locator("#photoMenuButton").is_visible(), f"手機：「{tab}」分頁看得到同一顆浮動按鈕")
            check(page.locator("#btnClearAll").is_visible(), f"手機：「{tab}」分頁看得到標題列的垃圾桶")
        check(page.locator("#infoMenuButton").count() == 0 and page.locator("#previewMenuButton").count() == 0,
              "表頭、預覽沒有另外的選單（不會和畫面上的按鈕重複）")
        page.click('[data-view-tab="photos"]')
        view = page.evaluate("() => { const f = document.getElementById('photoMenuButton').getBoundingClientRect(); return { right: f.right, bottom: f.bottom, w: innerWidth, h: innerHeight, size: [f.width, f.height] }; }")
        check(view["right"] > view["w"] - 40 and view["bottom"] > view["h"] - 40, f"手機：按鈕固定在畫面右下角（{view}）")
        check(view["size"][0] >= 44 and view["size"][1] >= 44, f"手機：按鈕大小 {view['size']}（至少 44px）")
        page.click("#photoMenuButton")
        page.wait_for_timeout(800)
        labels = page.evaluate("() => [...document.querySelectorAll('#photo-fab .export-fab-item span')].map(e => e.textContent)")
        check(labels == ["清除", "拍照", "新增"], f"選單項目是新增、拍照、清除（{labels}）")
        inside = page.evaluate("() => [...document.querySelectorAll('#photo-fab .export-fab-item')].map(e => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })")
        check(all(inside), f"手機：展開的三個項目都在畫面內（{inside}）")
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
        # 在表頭分頁按「新增」：要自動切到照片分頁
        page.click('[data-view-tab="info"]')
        page.wait_for_timeout(200)
        page.click("#photoMenuButton")
        page.wait_for_timeout(600)
        page.click('#photo-fab .export-fab-item[data-act="pick"]')
        page.wait_for_timeout(400)
        check(page.evaluate("() => document.getElementById('sheet-tool').dataset.view") == "photos",
              "在表頭分頁按「新增」：自動切到照片分頁")
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

        # ---- 檔名帶入：施工地點_改善內容.jpg ----
        print("== 檔名帶入施工地點與改善內容")
        page = open_sheet(desktop, paper="a4", photos=0, errors=errors)
        names = ["4F客室漏水_打針改善.jpg", "IMG_1234.jpg", "3F走廊_補強_第二層.png", "漏水.jpg", "5F機房＿滲水 (1).jpg", "2F樓梯_補平_20261026.jpg"]
        page.evaluate(MAKE_NAMED, names)
        page.wait_for_function("() => document.querySelectorAll('#grid .tile[data-id]').length === 6", timeout=60000)
        page.wait_for_selector("#editor[open]", timeout=10000)
        check(page.inner_text("#edTitle").startswith("No.2"), f"有照片沒帶入地點時，面板直接打開在第一張沒填的（{page.inner_text('#edTitle')}）")
        page.click("#edClose")
        page.wait_for_timeout(1900)   # 等自動保存
        saved_items = read_saved(page)["items"]
        got = [(item["loc"], item["content"]) for item in saved_items]
        want = [("4F客室漏水", "打針改善"), ("", ""), ("3F走廊", "補強 第二層"), ("", "漏水"), ("5F機房", "滲水"), ("2F樓梯", "補平")]
        check(got == want, "檔名帶入結果正確（IMG_1234 不帶；沒有底線的「漏水」整個當改善內容）", f"實際 {got}")
        check(saved_items[5]["date"] == "2026-10-26", f"檔名尾端的日期 20261026 帶入為 2026-10-26（{saved_items[5]['date']}）")
        check(page.evaluate("() => document.querySelectorAll('.tile-dot:not([hidden])').length") == 2, "沒帶入地點的 2 張有紅點")
        check(page.locator("#legend").count() == 0, "縮圖格下方不再有獨立的紅點說明（已併進「？」說明框）")
        # 紅點規則：施工地點或改善內容任一未填就紅；兩者都填了才消失
        page.click('#grid .tile[data-idx="1"]')           # IMG_1234：地點與內容都沒有
        page.wait_for_selector("#editor[open]", timeout=5000)
        page.fill("#edLoc", "5F走廊")
        page.wait_for_timeout(300)
        check(page.evaluate("() => document.querySelectorAll('.tile-dot:not([hidden])').length") == 2, "只填地點、內容還沒填：仍是紅點")
        page.fill("#edContent", "補防水")
        page.wait_for_timeout(300)
        check(page.evaluate("() => document.querySelectorAll('.tile-dot:not([hidden])').length") == 1, "地點與內容都填了：紅點消失（剩下「漏水」那張）")
        page.click("#edClose")
        # 照片標題旁的「？」：檔名格式說明
        check(page.locator(".panel-title-row .help-btn").is_visible(), "照片標題旁有「？」說明按鈕")
        page.click(".panel-title-row .help-btn")
        page.wait_for_timeout(200)
        pop = page.inner_text(".panel-title-row .help-pop")
        check("施工地點_改善內容_日期.jpg" in pop and "第 1 段" in pop and "第 3 段" in pop, "說明框條列：檔名格式與三段欄位")
        check("[文字].png：無底線文字判定為「改善內容」" in pop and "※其他格式不支援自動輸入" in pop and "🔴：照片內容尚未填妥" in pop, f"說明框的三行文案與紅點說明正確")
        center_gap = page.evaluate("""() => { const text = document.createRange(); text.selectNodeContents(document.querySelector('.panel-title-row h2')); const t = text.getBoundingClientRect(); const m = document.querySelector('.panel-title-row .help-mark').getBoundingClientRect(); return Math.abs((t.top + t.bottom) / 2 - (m.top + m.bottom) / 2); }""")
        check(center_gap < 1, f"「照片」標題旁的「？」與文字垂直置中（差 {center_gap:.1f}px）")
        page.click(".panel-title-row .help-btn")
        page.wait_for_timeout(200)
        page.close()

        page = open_sheet(desktop, paper="a4", photos=0, errors=errors)
        page.evaluate(MAKE_NAMED, ["4F_打針.jpg", "5F_補強.jpg"])
        page.wait_for_function("() => document.querySelectorAll('#grid .tile[data-id]').length === 2", timeout=60000)
        page.wait_for_timeout(600)
        check(not page.evaluate("() => document.getElementById('editor').open"), "每張都已帶入地點時，不會自動打開面板")
        check("已從檔名帶入 2 張" in page.inner_text("#toast"), f"改顯示提示：{page.inner_text('#toast')}")
        page.close()

        # ---- 編輯面板：初始焦點、× 按鈕、點背景、Esc ----
        print("== 編輯面板：焦點、關閉鍵、點背景、Esc")
        page = open_sheet(desktop, paper="a4", photos=2, errors=errors)
        page.click('#grid .tile[data-idx="0"]')
        page.wait_for_selector("#editor[open]", timeout=5000)
        check(page.evaluate("() => document.activeElement && document.activeElement.id") == "editor", "打開時焦點在面板本身，不在任何按鈕上")
        check(page.evaluate("() => !!document.querySelector('#edClose svg') && document.getElementById('edClose').textContent.trim() === ''"), "關閉鍵是 × 圖示，沒有文字")
        page.mouse.click(5, 5)
        page.wait_for_function("() => !document.getElementById('editor').open", timeout=3000)
        check(True, "點背景會收起面板")
        page.click('#grid .tile[data-idx="1"]')
        page.wait_for_selector("#editor[open]", timeout=5000)
        page.keyboard.press("Escape")
        page.wait_for_function("() => !document.getElementById('editor').open", timeout=3000)
        check(True, "按 Esc 會收起面板")
        page.close()

        print("== 編輯面板（iPhone）：焦點、點背景")
        page = open_sheet(iphone, query="", paper="a4", photos=2, errors=errors)
        page.click('[data-view-tab="photos"]')
        page.click('#grid .tile[data-idx="0"]')
        page.wait_for_selector("#editor[open]", timeout=5000)
        check(page.evaluate("() => document.activeElement && document.activeElement.id") == "editor", "手機：打開時焦點在面板本身，右上角的關閉鍵不會被選到")
        page.mouse.click(20, 20)
        page.wait_for_function("() => !document.getElementById('editor').open", timeout=3000)
        check(True, "手機：點面板外的背景會收起")
        page.close()

        print("== 編輯面板（Android 觸控）：往下滑收起")
        page = open_sheet(android, query="", paper="a4", photos=2, errors=errors)
        page.click('[data-view-tab="photos"]')

        def open_editor():
            page.click('#grid .tile[data-idx="0"]')
            page.wait_for_selector("#editor[open]", timeout=5000)
            page.wait_for_timeout(450)   # 等滑入動畫播完

        def swipe(selector, steps):
            page.evaluate(TOUCH_SWIPE, {"selector": selector, "steps": steps})
            page.wait_for_timeout(450)

        is_open = lambda: page.evaluate("() => document.getElementById('editor').open")
        inline = lambda: page.evaluate("() => document.getElementById('editor').style.transform")

        open_editor()
        swipe(".ed-head strong", [10, 20, 40])
        check(is_open() and inline() == "", "從標題列只往下拖一小段：面板彈回原位，不會收起")
        swipe(".ed-head strong", [-20, -60])
        check(is_open() and inline() == "", "往上滑：不收起，也不會被拖動")
        swipe(".ed-head strong", [20, 80, 160, 240])
        check(not is_open() and inline() == "", "從標題列往下拖超過一段距離：面板收起，位移也歸零")
        open_editor()
        swipe(".ed-photo", [30, 100, 200])
        check(not is_open(), "從照片上往下拖：收起")
        open_editor()
        swipe(".ed-actions", [30, 100, 200])
        check(not is_open(), "從下方動作列（旋轉、換照片…）往下拖：收起")
        open_editor()
        swipe("#edContent", [30, 100, 200])
        check(is_open(), "從輸入框開始往下拖：不收起（要留給選字與移動游標）")
        scrolled = page.evaluate("() => { const d = document.getElementById('editor'); d.style.maxHeight = '260px'; d.scrollTop = 40; return d.scrollTop; }")
        swipe(".ed-actions", [30, 100, 200])
        check(scrolled > 0 and is_open(), f"內容已經捲動過（scrollTop={scrolled}）時往下拖：是在捲動內容，不收起")
        page.evaluate("() => { document.getElementById('editor').style.maxHeight = ''; }")
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

        # ---- 輸出語言：繁體中文／日本語 ----
        print("== 輸出語言")
        page = open_sheet(desktop, paper="a4", photos=2, errors=errors)
        head = lambda: page.inner_text("#preview .sheet-frame:first-child .sh-head")
        check(page.evaluate("() => document.querySelector('input[name=lang]:checked').value") == "zh", "預設輸出語言是繁體中文（瀏覽器語言不是日文）")
        check(all(w in head() for w in ["施工日期", "工程名稱", "施工項目", "承包單位"]), f"中文欄位名稱（{head()[:30]!r}）")
        check(page.evaluate("() => document.querySelector('#preview .sheet').lang") == "zh-Hant", "中文表單標上 zh-Hant")
        page.click('input[name="lang"][value="ja"] + span')
        page.wait_for_function("() => document.querySelector('#preview .sheet .sh-proj b').textContent === '工事名'", timeout=5000)
        text = head()
        check(all(w in text for w in ["施工日", "工事名", "工種", "請負業者"]) and "工程名稱" not in text, f"切到日本語：欄位名稱變日文（{text[:30]!r}）")
        check(page.evaluate("() => document.querySelector('#preview .sheet').lang") == "ja", "日文表單標上 ja")
        check("Hiragino" in page.evaluate("() => getComputedStyle(document.querySelector('#preview .sheet')).fontFamily") or "Yu Gothic" in page.evaluate("() => getComputedStyle(document.querySelector('#preview .sheet')).fontFamily"),
              "日文表單用日文字型")
        page.click("#togLoc")
        page.wait_for_function("() => !document.querySelector('#preview .sheet .sh-loc').hidden", timeout=5000)
        check(page.inner_text("#preview .sheet .sh-loc b") == "施工場所", "右上角的施工地點也換成「施工場所」")
        page.wait_for_timeout(1800)
        check(read_saved(page)["lang"] == "ja", "輸出語言存進自動保存")
        page.reload(wait_until="networkidle")
        check(page.evaluate("() => document.querySelector('input[name=lang]:checked').value") == "ja" and "工事名" in head(), "重新整理後輸出語言還在")
        def saved_name(n):
            page.click("#btnSaveProject")
            page.wait_for_function(f"() => window.__shared.length === {n}", timeout=30000)
            return page.evaluate("() => window.__shared[window.__shared.length - 1].name")

        page.fill("#fProject", "")
        page.fill("#fWork", "")
        name = saved_name(1)
        check(name.endswith("_是正写真.json"), f"日本語：沒填名稱時的預設檔名（{name}）")
        page.click('input[name="lang"][value="zh"] + span')
        page.wait_for_function("() => document.querySelector('#preview .sheet .sh-proj b').textContent === '工程名稱'", timeout=5000)
        name = saved_name(2)
        check(name.endswith("_改善表.json"), f"繁體中文：沒填名稱時的預設檔名（{name}）")
        page.fill("#fProject", "工事テスト")
        name = saved_name(3)
        check("工事テスト" in name, f"使用者輸入的日文名稱直接進檔名（{name}）")
        page.once("dialog", lambda d: d.accept())
        page.click("#btnClearAll")
        page.wait_for_function("() => document.querySelectorAll('#grid .tile[data-id]').length === 0", timeout=5000)
        check(page.evaluate("() => document.querySelector('input[name=lang]:checked').value") == "zh", "清除表頭與照片：輸出語言保留")
        page.close()

        ja_context = chrome.new_context(locale="ja-JP", viewport={"width": 1100, "height": 900}, service_workers="block")
        page = ja_context.new_page()
        page.goto(f"{BASE}/improvement-sheet", wait_until="networkidle")
        check(page.evaluate("() => document.querySelector('input[name=lang]:checked').value") == "ja", "瀏覽器語言是日文：第一次開啟預設日本語")
        old = json.loads(saved.read_text(encoding="utf8"))
        old["data"].pop("lang", None)
        old_file = OUT / "old-project.json"
        old_file.write_text(json.dumps(old, ensure_ascii=False), encoding="utf8")
        page.set_input_files("#inOpen", str(old_file))
        page.wait_for_function("() => document.querySelectorAll('#grid .tile[data-id]').length === 3", timeout=15000)
        check(page.evaluate("() => document.querySelector('input[name=lang]:checked').value") == "zh" and "工程名稱" in page.inner_text("#preview .sheet-frame:first-child .sh-head"),
              "沒有語言欄位的舊專案檔：開啟後視為繁體中文")
        page.close()
        ja_context.close()

        # ---- 沒有任何錯誤 ----
        print("== 頁面錯誤與 CSP")
        check(not errors, "整個過程沒有頁面錯誤、主控台錯誤或 CSP 違規", "\n    ".join(errors[:8]))

        chrome.close()
        webkit.close()
finally:
    server.terminate()

print(f"\n{len(failures)} 項失敗" if failures else "\n全部通過")
sys.exit(1 if failures else 0)
