"""用 headless Chrome 走真正的 App 輸出流程產生 examples/*.pdf，
再把每頁轉成 examples/pages/<名稱>-<頁>.webp 給 example.html 顯示（主畫面 Web App 直接開 PDF
會交給系統檢視器，沒有介面可以回頭，所以範例改在自己的頁面裡逐頁顯示）。
用法：python3 scripts/render_example_pdfs.py            全部重新產生
      python3 scripts/render_example_pdfs.py 名稱 [名稱…]  只重新產生指定範例（例如 rebar-cage-simple-example），
                                                          其他範例的檔案與圖片不動，manifest 只更新這幾筆
"""
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

import fitz
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "examples"
PAGES = OUT / "pages"
PORT = 4198
IMAGE_SCALE = 1.6  # 72dpi × 1.6 ≈ 115dpi，A4 約 950×1344px，手機看清楚也不會太肥
# 主表單範例（連續壁、營造廠查驗表）用「整份」輸出，但整份會把導溝與鋼筋籠的頁也印進來；
# 導溝、鋼筋籠各有自己的範例，所以主表單範例印出前先把它們的頁拿掉（續頁會沿用原頁的 data-print-tab，一併移除）。
SIDE_TABS = ["guideWall", "rebarCage"]
# 鋼筋籠有簡易、詳細兩種輸出（範例資料預設是詳細，簡易版把模式切過去）
CAGE_SIMPLE = "showTool('rebarCage'); state.rebarCage.mode = 'simple'; renderAll?.();"
# (頁面, 輸出檔名, 進頁後切換工具／分頁的 JS, 輸出範圍, 範例標題, 印出前要移除的頁（data-print-tab）)
TARGETS = [
    ("diaphragm-wall.html", "diaphragm-wall-example.pdf", "showTool('diaphragmWall'); showTab('quality');", "all", "連續壁施工紀錄", SIDE_TABS),
    ("diaphragm-wall.html", "guide-wall-example.pdf", "showTool('guideWall');", "current", "導溝施工複核", []),
    ("diaphragm-wall.html", "rebar-cage-simple-example.pdf", CAGE_SIMPLE, "current", "鋼筋籠吊放前複核（簡易版）", []),
    ("diaphragm-wall.html", "rebar-cage-detailed-example.pdf", "showTool('rebarCage');", "current", "鋼筋籠吊放前複核（詳細版）", []),
    ("diaphragm-wall-gc.html", "diaphragm-wall-gc-example.pdf", "showTool('inspection'); showTab('design');", "all", "連續壁營造廠查驗", SIDE_TABS),
    ("diaphragm-wall-gc.html", "gc-guide-wall-example.pdf", "showTool('guideWall');", "current", "導溝施工複核", []),
    ("diaphragm-wall-gc.html", "gc-rebar-cage-simple-example.pdf", CAGE_SIMPLE, "current", "鋼筋籠吊放前複核（簡易版）", []),
    ("diaphragm-wall-gc.html", "gc-rebar-cage-detailed-example.pdf", "showTool('rebarCage');", "current", "鋼筋籠吊放前複核（詳細版）", []),
    ("template.html", "template-example.pdf", "", "all", "模板工程複核表", []),
    ("rebar.html", "rebar-example.pdf", "", "all", "鋼筋工程查驗表", []),
    ("steel-structure.html", "steel-structure-example.pdf", "", "all", "鋼構施工複核表", []),
]
ONLY = set(sys.argv[1:])
unknown = ONLY - {target[1][:-len(".pdf")] for target in TARGETS}
if unknown:
    sys.exit(f"找不到這些範例：{', '.join(sorted(unknown))}")


def normalize_pdf(pdf_path):
    """Chrome 每次輸出都會寫入新的時間戳與隨機 /ID，內容沒變 git 也會看到 diff；清掉讓重產結果可重現。"""
    document = fitz.open(pdf_path)
    document.set_metadata({"creationDate": "", "modDate": ""})
    document.xref_set_key(-1, "ID", "[<00000000000000000000000000000000> <00000000000000000000000000000000>]")
    document.save(str(pdf_path) + ".tmp", garbage=0, deflate=False, no_new_id=True)
    document.close()
    Path(str(pdf_path) + ".tmp").replace(pdf_path)


def render_pages(pdf_path, name):
    """PDF 逐頁轉 WebP，回傳 manifest 需要的頁數與尺寸。"""
    document = fitz.open(pdf_path)
    width = height = 0
    for index, page in enumerate(document, start=1):
        pixmap = page.get_pixmap(matrix=fitz.Matrix(IMAGE_SCALE, IMAGE_SCALE))
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
        image.save(PAGES / f"{name}-{index}.webp", "WEBP", quality=78, method=6)
        width, height = pixmap.width, pixmap.height
    return {"pages": len(document), "width": width, "height": height}

server = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "serve.py"), str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
manifest_path = PAGES / "manifest.json"
if ONLY:
    # 只重做指定的範例：沿用現有 manifest 與其他範例的圖片，先清掉這幾份自己的舊圖片
    manifest = json.loads(manifest_path.read_text(encoding="utf8"))
    for name in ONLY:
        for old in PAGES.glob(f"{name}-*.webp"):
            old.unlink()
else:
    shutil.rmtree(PAGES, ignore_errors=True)
    PAGES.mkdir()
    manifest = {}
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for html, filename, setup, scope, title, drop_tabs in TARGETS:
            if ONLY and filename[:-len(".pdf")] not in ONLY:
                continue
            page = browser.new_page()
            page.goto(f"http://127.0.0.1:{PORT}/{html}?example=1", wait_until="networkidle")
            page.evaluate(f"""() => {{ window.print = () => {{}}; {setup} preparePrint('{scope}');
              const drop = {json.dumps(drop_tabs)};
              document.querySelectorAll('.print-page').forEach(page => {{ if (drop.includes(page.dataset.printTab)) page.remove(); }}); }}""")
            page.emulate_media(media="print")
            page.pdf(path=str(OUT / filename), prefer_css_page_size=True, print_background=True)
            page.close()
            normalize_pdf(OUT / filename)
            name = filename[:-len(".pdf")]
            manifest[name] = {"title": title, "back": html.removesuffix(".html"), **render_pages(OUT / filename, name)}
            print(f"寫入 examples/{filename}（{manifest[name]['pages']} 頁）與 pages/{name}-*.webp")
        browser.close()
    # manifest 只留目前 TARGETS 有的範例（改名、移除的舊範例不留），順序照 TARGETS
    names = [target[1][:-len(".pdf")] for target in TARGETS]
    manifest = {name: manifest[name] for name in names if name in manifest}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
finally:
    server.terminate()
