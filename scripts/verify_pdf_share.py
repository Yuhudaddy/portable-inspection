"""手機輸出 PDF（分享選單）的瀏覽器端到端檢查：python3 scripts/verify_pdf_share.py [--quick]

用 Playwright 的 Chrome 與 WebKit（iPhone 裝置）把五個工具頁填滿資料，按右下角輸出選單的「單頁」「整份」，
navigator.share 換成會把檔案收起來的假的，再用 PyMuPDF 檢查收到的 PDF：頁數、紙張、每頁有內容、
與 Chrome 原生列印的版面是否一致、檔名、對話框與隱藏 iframe 有沒有清乾淨、標題有沒有還原。
另外檢查手勢失效（NotAllowedError）改顯示「分享」按鈕、使用者取消分享、分享出錯、產生中取消、
函式庫載入失敗、重複觸發、電腦走 window.print()、iOS 主畫面模式的列印保險。
--quick 只跑每個工具的「整份」。純函式的檢查在 scripts/verify_pdf_share.mjs。
"""
import ast
import re
import subprocess
import sys
import time
from pathlib import Path
import fitz
import numpy as np
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tmp" / "verify-pdf-share"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 4203
BASE = f"http://127.0.0.1:{PORT}"
QUICK = "--quick" in sys.argv

# 各工具填滿資料的腳本沿用 verify_print_layout.py（用 ast 讀，不執行那支檔案）
def load_fill():
    tree = ast.parse((ROOT / "scripts" / "verify_print_layout.py").read_text(encoding="utf8"))
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", "") == "FILL" for t in node.targets):
            return ast.literal_eval(node.value)
    raise SystemExit("找不到 verify_print_layout.py 的 FILL")

FILL = load_fill()
TOOLS = ["diaphragm-wall.html", "diaphragm-wall-gc.html", "template.html", "rebar.html", "steel-structure.html"]

STUBS = """
(() => {
  window.__printCalls = 0;
  window.__printFiresBeforeprint = false;
  window.print = () => {
    window.__printCalls += 1;
    if (window.__printFiresBeforeprint) setTimeout(() => window.dispatchEvent(new Event("beforeprint")), 20);
  };
  window.__shared = [];
  window.__shareCalls = 0;
  window.__shareMode = "ok";
  const toBase64 = bytes => { let text = ""; for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(text); };
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
  Object.defineProperty(navigator, "share", { configurable: true, value: async data => {
    window.__shareCalls += 1;
    const mode = window.__shareMode;
    if (mode === "notallowed" || (mode === "notallowed-once" && window.__shareCalls === 1)) throw new DOMException("no gesture", "NotAllowedError");
    if (mode === "slow" || mode === "slow-error") await new Promise(resolve => setTimeout(resolve, 3500));
    if (mode === "slow-error") throw new DOMException("bad", "DataError");
    if (mode === "abort") throw new DOMException("cancelled", "AbortError");
    if (mode === "error") throw new DOMException("bad", "DataError");
    const file = data.files[0];
    window.__shared.push({ name: file.name, type: file.type, size: file.size, keys: Object.keys(data), files: data.files.length, b64: toBase64(new Uint8Array(await file.arrayBuffer())) });
  } });
})();
"""
# 三張 1600×1200 的彩色照片（鋼筋籠照片頁）：確認大圖片也能進 PDF，而且是彩色的
PHOTO_FILL = """() => {
  const make = hue => {
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 1600, 1200);
    gradient.addColorStop(0, `hsl(${hue},80%,45%)`); gradient.addColorStop(1, `hsl(${(hue + 90) % 360},85%,60%)`);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1600, 1200);
    for (let i = 0; i < 400; i += 1) { ctx.fillStyle = `hsla(${(hue + i * 7) % 360},70%,50%,0.5)`; ctx.fillRect((i * 97) % 1600, (i * 53) % 1200, 60, 40); }
    return canvas.toDataURL('image/jpeg', 0.9);
  };
  state.rebarCage.photos = [0, 120, 240].map((hue, index) => ({ data: make(hue), caption: '測試照片 ' + (index + 1) }));
  renderAll?.();
}"""
STANDALONE = "Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });"

failures = []
timings = []


def check(ok, name, detail=""):
    print(f"{'✅' if ok else '❌'} {name}" + (f"  {detail}" if detail and not ok else ""))
    if not ok:
        failures.append(name)
        if detail:
            print(f"    {detail}")
    return ok


def info(text):
    print(f"   · {text}")


def decode(shared):
    import base64
    return base64.b64decode(shared["b64"])


def gray(page, zoom=1.0):
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), colorspace=fitz.csGRAY)
    return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)


def export(page, fmt, wait_for="shared"):
    """按右下角輸出選單的項目；回傳耗時秒數。wait_for：shared＝等到檔案被分享，dialog＝等到出現完成／錯誤對話框。"""
    page.evaluate("() => { window.__shared.length = 0; window.__shareCalls = 0; }")
    start = time.time()
    page.click("#export-button")
    page.click(f'[data-export-format="{fmt}"]')
    if wait_for == "shared":
        page.wait_for_function("() => window.__shared.length > 0 || document.querySelector('.pdf-share-dialog[data-state=error]')", timeout=240000)
    else:
        page.wait_for_selector(".pdf-share-dialog[data-state=ready], .pdf-share-dialog[data-state=error]", timeout=240000)
    return time.time() - start


def settled(page):
    """對話框與隱藏 iframe 都已清掉"""
    page.wait_for_function("() => !document.querySelector('.pdf-share-dialog')", timeout=15000)
    return page.evaluate("() => document.querySelectorAll('.pdf-share-frame').length === 0")


def expected_page_count(page):
    page.emulate_media(media="print")
    count = page.evaluate("() => [...document.querySelectorAll('.print-page')].filter(p => getComputedStyle(p).display !== 'none').length")
    page.emulate_media(media="screen")
    return count


def open_tool(browser_context, html, scenario, query="?export=share"):
    page = browser_context.new_page()
    page.goto(f"{BASE}/{html}{query}", wait_until="networkidle")
    page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
    if scenario == "many":
        page.evaluate(f"() => {{ {FILL[html]} renderAll?.(); }}")
    return page


def run_matrix(label, context, html, scenario, scope, query="?export=share", native=False, photos=False):
    fmt = "pdf-all" if scope == "all" else "pdf-current"
    name = f"{label} {html} [{scenario}/{scope}{'/照片' if photos else ''}]"
    page = open_tool(context, html, scenario, query)
    if photos:
        page.evaluate(PHOTO_FILL)
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    title_before = page.evaluate("() => document.title")
    spent = export(page, fmt)
    state = page.evaluate("() => document.querySelector('.pdf-share-dialog')?.dataset.state || ''")
    if not check(state != "error", f"{name}：沒有出現錯誤對話框", page.evaluate("() => document.querySelector('.pdf-share-dialog p')?.textContent || ''")):
        page.close()
        return
    shared = page.evaluate("() => window.__shared[0]")
    if not check(bool(shared), f"{name}：分享選單收到檔案"):
        page.close()
        return
    clean = settled(page)
    data = decode(shared)
    pdf_path = OUT / f"{label}-{html.replace('.html', '')}-{scenario}-{scope}{'-photos' if photos else ''}.pdf"
    pdf_path.write_bytes(data)
    doc = fitz.open(stream=data, filetype="pdf")
    expected = expected_page_count(page)
    check(shared["type"] == "application/pdf" and data[:5] == b"%PDF-", f"{name}：是 PDF 檔")
    check(doc.page_count == expected and expected > 0, f"{name}：頁數 {doc.page_count} ＝ 列印頁數 {expected}")
    check(all(abs(p.rect.width - 595.28) < 0.6 and abs(p.rect.height - 841.89) < 0.6 for p in doc), f"{name}：每頁都是 A4")
    ink = [float((gray(p, 0.8) < 200).mean()) for p in doc]
    check(all(value > 0.004 for value in ink), f"{name}：每頁都有內容", f"ink={[round(v, 4) for v in ink]}")
    if photos:
        # 最後一頁是鋼筋籠照片頁：三張彩色照片都要在上面（一般表單全是黑白灰，彩色比例會接近 0）
        pix = doc[doc.page_count - 1].get_pixmap(matrix=fitz.Matrix(0.6, 0.6))
        rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3].astype(int)
        colored = float(((rgb.max(axis=2) - rgb.min(axis=2)) > 40).mean())
        check(colored > 0.10, f"{name}：最後一頁（照片頁）有彩色照片（彩色面積 {colored:.0%}）")
    check(re.fullmatch(r'[^\\/:*?"<>|\s]+\.pdf', shared["name"]) is not None and (("完整檢核紀錄" in shared["name"]) == (scope == "all")), f"{name}：檔名 {shared['name']}")
    check(shared["keys"] == ["files"] and shared["files"] == 1, f"{name}：分享內容只有一個檔案（帶 title 的話 iOS 會多出一個「文字」項目）", str(shared["keys"]))
    check(clean, f"{name}：對話框與隱藏 iframe 都已清掉")
    check(page.evaluate("() => document.title") == title_before, f"{name}：分享後頁面標題已還原")
    check(page.evaluate("() => window.__printCalls") == 0, f"{name}：沒有呼叫 window.print()")
    check(not errors, f"{name}：沒有頁面錯誤", "; ".join(errors))
    # WebKit 曾經因為畫面外 iframe 的 requestAnimationFrame 被節流，每頁多等約 10 秒（5 頁要 50 秒）；最大的一份也只該花幾秒
    check(spent < 30, f"{name}：產生時間 {spent:.1f} 秒（上限 30 秒）")
    if native:
        page.emulate_media(media="print")
        native_pdf = fitz.open(stream=page.pdf(prefer_css_page_size=True, print_background=True), filetype="pdf")
        page.emulate_media(media="screen")
        if check(native_pdf.page_count == doc.page_count, f"{name}：頁數與 Chrome 原生列印相同（{native_pdf.page_count}）"):
            def page_diff(a, b):
                left, right = gray(a).astype(int), gray(b).astype(int)
                height, width = min(left.shape[0], right.shape[0]), min(left.shape[1], right.shape[1])   # A4 的 595.28pt 兩邊取整可能差 1px
                return float(np.abs(left[:height, :width] - right[:height, :width]).mean() / 255)
            diffs = [page_diff(a, b) for a, b in zip(doc, native_pdf)]
            # 文字重新斷行會讓逐像素差異偏高（壓力測試的長段落尤其明顯），所以門檻放寬到只擋「整頁空白、缺樣式」這類大錯；
            # 再用每頁的墨量比例確認內容量與原生列印相當
            inks = [(float((gray(a, 0.8) < 200).mean()), float((gray(b, 0.8) < 200).mean())) for a, b in zip(doc, native_pdf)]
            check(max(diffs) < 0.10, f"{name}：版面與原生列印一致（最大差異 {max(diffs):.3f}）", f"diffs={[round(d, 3) for d in diffs]}")
            # 內容很少的頁墨量只占 1～2%，壓縮多出幾個灰點比例就大幅變動，所以「絕對差距 1 個百分點內」或「相對差距 30% 內」擇一即可
            check(all(abs(ours - theirs) <= max(0.01, 0.3 * theirs) for ours, theirs in inks), f"{name}：每頁墨量與原生列印相當", f"(ours, native)={[(round(a, 4), round(b, 4)) for a, b in inks]}")
    timings.append((name, doc.page_count, round(len(data) / 1048576, 2), round(spent, 1)))
    page.close()


server = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "serve.py"), str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    with sync_playwright() as p:
        chrome = p.chromium.launch(channel="chrome")
        webkit = p.webkit.launch()
        desktop = chrome.new_context(viewport={"width": 1000, "height": 900}, service_workers="block")
        desktop.add_init_script(STUBS)
        iphone = webkit.new_context(**p.devices["iPhone 14"], service_workers="block")
        iphone.add_init_script(STUBS)

        # ---- 五個工具 × 資料量 × 單頁／整份（Chrome，另與原生列印比對）----
        print("== 五個工具頁：Chrome（?export=share）")
        for html in TOOLS:
            for scenario, scope in ([("many", "all")] if QUICK else [("empty", "all"), ("many", "all"), ("many", "current")]):
                run_matrix("chrome", desktop, html, scenario, scope, native=True)

        # ---- iPhone（WebKit）：靠使用者代理自動走分享，不加 ?export=share ----
        print("== 五個工具頁：WebKit iPhone（不帶任何參數，靠使用者代理判斷）")
        for html in TOOLS:
            for scenario, scope in ([("many", "all")] if QUICK else [("many", "all"), ("empty", "current")]):
                run_matrix("webkit", iphone, html, scenario, scope, query="")

        print("== 鋼筋籠照片頁（三張 1600×1200 彩色照片）")
        for html in ("diaphragm-wall.html", "diaphragm-wall-gc.html"):
            run_matrix("chrome", desktop, html, "many", "all", native=True, photos=True)
            run_matrix("webkit", iphone, html, "many", "all", query="", photos=True)

        # ---- 分流與各種結果（用鋼筋頁）----
        print("== 分享結果與錯誤處理")
        page = open_tool(desktop, "rebar.html", "empty")
        original_title = page.evaluate("() => document.title")

        # 手勢失效：第一次 share 被擋 → 出現「PDF 已準備好」→ 再點「分享」在新的點擊裡成功
        page.evaluate("() => { window.__shareMode = 'notallowed-once'; }")
        export(page, "pdf-all", wait_for="dialog")
        ready = page.evaluate("() => ({ state: document.querySelector('.pdf-share-dialog').dataset.state, text: document.querySelector('.pdf-share-dialog p').textContent, button: !document.querySelector('.pdf-share-primary').hidden })")
        check(ready["state"] == "ready" and ready["button"] and ".pdf" in ready["text"] and "頁" in ready["text"], "手勢失效：改顯示「PDF 已準備好」與分享按鈕", str(ready))
        hint = page.evaluate("() => { const h = document.querySelector('.pdf-share-hint'); return { shown: getComputedStyle(h).display !== 'none', text: h.textContent }; }")
        check(hint["shown"] and "LINE" in hint["text"] and "列印" in hint["text"], "「PDF 已準備好」畫面有找不到 LINE 時的提示", str(hint))
        check(page.evaluate("() => window.__shared.length") == 0, "手勢失效：還沒分享出去")
        page.click(".pdf-share-primary")
        page.wait_for_function("() => window.__shared.length === 1", timeout=15000)
        check(settled(page), "手勢失效：點分享後檔案送出、對話框關閉")
        check(page.evaluate("() => window.__shareCalls") == 2, "手勢失效：share 被呼叫兩次（先被擋、再成功）")

        # 在「PDF 已準備好」按分享後又關掉分享選單 → 回到可以再按一次的狀態，再按一次就成功
        page.evaluate("() => { window.__shareMode = 'notallowed-once'; window.__shared.length = 0; window.__shareCalls = 0; }")
        export(page, "pdf-current", wait_for="dialog")
        page.evaluate("() => { window.__shareMode = 'abort'; }")
        page.click(".pdf-share-primary")
        page.wait_for_function("() => document.querySelector('.pdf-share-dialog')?.dataset.state === 'ready' && window.__shareCalls === 2", timeout=15000)
        check(page.evaluate("() => !document.querySelector('.pdf-share-primary').hidden"), "完成對話框按分享後取消：回到可以再按一次的狀態")
        page.evaluate("() => { window.__shareMode = 'ok'; }")
        page.click(".pdf-share-primary")
        page.wait_for_function("() => window.__shared.length === 1", timeout=15000)
        check(settled(page), "再按一次分享成功、對話框關閉")

        # 一律被擋（連點擊裡也不行）→ 顯示錯誤，不是無聲失敗
        page.evaluate("() => { window.__shareMode = 'notallowed'; }")
        export(page, "pdf-current", wait_for="dialog")
        page.click(".pdf-share-primary")
        page.wait_for_selector(".pdf-share-dialog[data-state=error]", timeout=15000)
        check("無法開啟分享選單" in page.inner_text(".pdf-share-dialog h2"), "點擊裡 share 也被擋：顯示「無法開啟分享選單」")
        page.click(".pdf-share-secondary")
        settled(page)

        # 分享選單開著（share 還沒結束）時：對話框只當「完成」提示，沒有按鈕，約 2 秒後自己關掉
        page.evaluate("() => { window.__shareMode = 'slow'; window.__shared.length = 0; window.__shareCalls = 0; }")
        page.click("#export-button")
        page.click('[data-export-format="pdf-current"]')
        page.wait_for_selector(".pdf-share-dialog[data-state=sharing]", timeout=240000)
        started = time.time()
        sharing = page.evaluate("() => { const d = document.querySelector('.pdf-share-dialog'); const visible = el => getComputedStyle(el).display !== 'none'; return { text: d.querySelector('p').textContent, spinner: visible(d.querySelector('.pdf-share-spinner')), bar: visible(d.querySelector('.pdf-share-bar')), actions: visible(d.querySelector('.pdf-share-actions')), hint: visible(d.querySelector('.pdf-share-hint')), busy: d.getAttribute('aria-busy') }; }")
        check("轉換" not in sharing["text"] and not sharing["spinner"] and not sharing["bar"] and sharing["busy"] == "false", "分享選單開著：對話框是「PDF 已準備好」，沒有轉圈與進度", str(sharing))
        check(not sharing["actions"] and not sharing["hint"], "分享選單開著：沒有按鈕、沒有 LINE 提示（只剩完成提示）", str(sharing))
        page.wait_for_function("() => !document.querySelector('.pdf-share-dialog')", timeout=6000)
        spent = time.time() - started
        check(1.5 < spent < 3.4 and page.evaluate("() => window.__shared.length") == 0, f"約 2 秒後對話框自己關掉，分享選單（share）還沒結束（{spent:.1f} 秒）", f"shared={page.evaluate('() => window.__shared.length')}")
        page.wait_for_function("() => window.__shared.length === 1", timeout=15000)

        # 對話框已自動關掉之後 share 才出錯：另開一個錯誤對話框顯示原因，不是無聲失敗
        page.evaluate("() => { window.__shareMode = 'slow-error'; window.__shared.length = 0; window.__shareCalls = 0; }")
        page.click("#export-button")
        page.click('[data-export-format="pdf-current"]')
        page.wait_for_selector(".pdf-share-dialog[data-state=sharing]", timeout=240000)
        page.wait_for_function("() => !document.querySelector('.pdf-share-dialog')", timeout=6000)
        page.wait_for_selector(".pdf-share-dialog[data-state=error]", timeout=10000)
        check("DataError" in page.inner_text(".pdf-share-dialog p"), "對話框自動關掉之後 share 才出錯：另開錯誤對話框顯示原因")
        page.click(".pdf-share-secondary")
        settled(page)

        # 使用者關掉分享選單（AbortError）→ 安靜結束
        page.evaluate("() => { window.__shareMode = 'abort'; }")
        page.evaluate("() => { window.__shared.length = 0; }")
        page.click("#export-button")
        page.click('[data-export-format="pdf-current"]')
        page.wait_for_function("() => window.__shareCalls >= 1", timeout=240000)
        check(settled(page) and page.evaluate("() => window.__shared.length") == 0, "使用者取消分享：對話框安靜關閉、沒有錯誤")

        # share 本身出錯 → 顯示原因
        page.evaluate("() => { window.__shareMode = 'error'; window.__shareCalls = 0; }")
        page.click("#export-button")
        page.click('[data-export-format="pdf-current"]')
        page.wait_for_selector(".pdf-share-dialog[data-state=error]", timeout=240000)
        check("DataError" in page.inner_text(".pdf-share-dialog p"), "分享出錯：顯示錯誤名稱")
        page.click(".pdf-share-secondary")
        settled(page)

        # 重複觸發：連按兩次只會有一個對話框、一個檔案
        page.evaluate("() => { window.__shareMode = 'ok'; window.__shared.length = 0; window.__shareCalls = 0; preparePrint('current'); outputPrint(); outputPrint(); }")
        count = page.evaluate("() => document.querySelectorAll('.pdf-share-dialog').length")
        page.wait_for_function("() => window.__shared.length >= 1", timeout=240000)
        settled(page)
        time.sleep(0.5)
        check(count == 1 and page.evaluate("() => window.__shared.length") == 1, "重複觸發：只有一個對話框、一個檔案", f"dialogs={count}")

        # 產生中顯示進度、畫面沒有消失
        held = []
        page.route("**/vendor/html-to-image-*.js", lambda route: held.append(route))
        page.evaluate("() => { window.__shared.length = 0; }")
        page.click("#export-button")
        page.click('[data-export-format="pdf-current"]')
        page.wait_for_selector(".pdf-share-dialog[data-state=working]", timeout=15000)
        visible = page.evaluate("() => { const header = document.querySelector('header.app-header'); const main = document.querySelector('main, .app-shell'); return !!header && header.getBoundingClientRect().height > 0 && !!main && main.getBoundingClientRect().height > 0; }")
        check(visible, "產生中：原本的畫面沒有消失（在隱藏 iframe 轉圖）")
        check(page.inner_text(".pdf-share-secondary") == "取消" and page.evaluate("() => document.querySelector('.pdf-share-dialog').getAttribute('aria-busy')") == "true", "產生中：有取消鈕與 aria-busy")
        # 在等函式庫的時候按取消
        page.click(".pdf-share-secondary")
        check(page.evaluate("() => !document.querySelector('.pdf-share-dialog')"), "產生中按取消：對話框關閉")
        deadline = time.time() + 15
        while not held and time.time() < deadline:
            time.sleep(0.1)
        for route in held:
            route.continue_()
        page.unroute("**/vendor/html-to-image-*.js")
        time.sleep(1.0)
        check(page.evaluate("() => window.__shared.length === 0 && document.querySelectorAll('.pdf-share-frame').length === 0 && !document.querySelector('.pdf-share-dialog')"), "產生中按取消：沒有分享、iframe 已清掉")
        # 取消後可以再輸出一次（busy 狀態有放掉）
        export(page, "pdf-current")
        check(settled(page) and page.evaluate("() => window.__shared.length") == 1, "取消後再輸出一次成功")

        # 函式庫載不進來：顯示「無法產生 PDF」，不是無聲失敗；之後恢復網路可以再試
        page.route("**/vendor/html-to-image-*.js", lambda route: route.abort())
        page.evaluate("() => { window.__shared.length = 0; }")
        page.click("#export-button")
        page.click('[data-export-format="pdf-current"]')
        page.wait_for_selector(".pdf-share-dialog[data-state=error]", timeout=60000)
        check("無法產生 PDF" in page.inner_text(".pdf-share-dialog h2") and page.inner_text(".pdf-share-dialog p").strip() != "", "函式庫載入失敗：顯示「無法產生 PDF」與原因")
        check(page.evaluate("() => window.__printCalls") == 0, "函式庫載入失敗：不退回 window.print()（主畫面模式它不會有反應）")
        page.click(".pdf-share-secondary")
        settled(page)
        page.unroute("**/vendor/html-to-image-*.js")
        export(page, "pdf-current")
        check(settled(page) and page.evaluate("() => window.__shared.length") == 1, "載入失敗後恢復，再輸出一次成功")
        page.close()

        # ---- 標題與列印路徑 ----
        print("== 電腦走列印、標題還原")
        page = open_tool(desktop, "rebar.html", "empty", query="")   # 沒有 ?export=share：Chrome 桌面
        original_title = page.evaluate("() => document.title")
        page.click("#export-button")
        page.click('[data-export-format="pdf-all"]')
        page.wait_for_function("() => window.__printCalls === 1", timeout=15000)
        check(page.evaluate("() => !document.querySelector('.pdf-share-dialog') && window.__shareCalls === 0"), "電腦：直接 window.print()，沒有對話框、沒有分享")
        during = page.evaluate("() => document.title")
        check(during != original_title and "完整檢核紀錄" in during, "電腦：列印時標題是檔名", during)
        page.click("#export-button")
        page.click('[data-export-format="pdf-current"]')
        page.wait_for_function("() => window.__printCalls === 2", timeout=15000)
        page.evaluate("() => window.dispatchEvent(new Event('afterprint'))")
        check(page.evaluate("() => document.title") == original_title, "電腦：連續列印兩次、afterprint 後標題回到原本（不是上一次的檔名）")
        page.goto(f"{BASE}/rebar.html?export=print", wait_until="networkidle")
        page.click("#export-button")
        page.click('[data-export-format="pdf-all"]')
        page.wait_for_function("() => window.__printCalls === 1", timeout=15000)
        check(page.evaluate("() => window.__shareCalls === 0 && !document.querySelector('.pdf-share-dialog')"), "?export=print：即使能分享也走列印")
        page.close()
        page = open_tool(iphone, "rebar.html", "empty", query="?export=print")
        page.click("#export-button")
        page.click('[data-export-format="pdf-all"]')
        page.wait_for_function("() => window.__printCalls === 1", timeout=15000)
        check(page.evaluate("() => window.__shareCalls === 0 && !document.querySelector('.pdf-share-dialog')"), "iPhone 加 ?export=print：走列印")
        page.close()

        # ---- iOS 主畫面模式的列印保險（施工計畫頁）----
        print("== iOS 主畫面模式的列印保險（施工計畫頁）")
        standalone = webkit.new_context(**p.devices["iPhone 14"], service_workers="block")
        standalone.add_init_script(STUBS + STANDALONE)
        page = standalone.new_page()
        page.goto(f"{BASE}/plan.html?work=rebar", wait_until="networkidle")
        page.wait_for_function("() => !document.querySelector('#print-button').disabled", timeout=120000)
        page.click("#print-button")
        page.wait_for_selector(".pdf-share-dialog[data-state=message]", timeout=10000)
        check(page.evaluate("() => window.__printCalls") == 1 and page.evaluate("() => window.__shareCalls") == 0, "主畫面模式的計畫頁：呼叫 window.print() 且不走分享")
        check("Safari" in page.inner_text(".pdf-share-dialog p"), "主畫面模式列印沒反應：說明請改用 Safari")
        page.click(".pdf-share-secondary")
        settled(page)
        page.evaluate("() => { window.__printFiresBeforeprint = true; }")
        page.click("#print-button")
        time.sleep(2.2)
        check(page.evaluate("() => window.__printCalls") == 2 and page.evaluate("() => !document.querySelector('.pdf-share-dialog')"), "列印有反應（beforeprint 觸發）：不打擾")
        page.close()
        standalone.close()

        chrome.close()
        webkit.close()
finally:
    server.terminate()

print("\n== 耗時（含轉圖到 share 被呼叫）")
for name, pages, size, spent in timings:
    print(f"   {name}: {pages} 頁、{size} MB、{spent} 秒")
print(f"\n{len(failures)} 項失敗" if failures else "\n全部通過")
sys.exit(1 if failures else 0)
