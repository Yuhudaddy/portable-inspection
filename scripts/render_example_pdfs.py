"""用 headless Chrome 走真正的 App 輸出流程產生 examples/*.pdf，
再把每頁轉成 examples/pages/<名稱>-<頁>.webp 給 example.html 顯示（主畫面 Web App 直接開 PDF
會交給系統檢視器，沒有介面可以回頭，所以範例改在自己的頁面裡逐頁顯示）。
用法：python3 scripts/render_example_pdfs.py
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
# (頁面, 輸出檔名, 進頁後切換工具／分頁的 JS, 輸出範圍, 範例標題)
TARGETS = [
    ("diaphragm-wall.html", "diaphragm-wall-example.pdf", "showTool('diaphragmWall'); showTab('quality');", "all", "連續壁施工紀錄"),
    ("diaphragm-wall.html", "guide-wall-example.pdf", "showTool('guideWall');", "current", "導溝施工複核"),
    ("diaphragm-wall.html", "rebar-cage-example.pdf", "showTool('rebarCage');", "current", "鋼筋籠吊放前複核"),
    ("diaphragm-wall-gc.html", "diaphragm-wall-gc-example.pdf", "showTool('inspection'); showTab('design');", "all", "連續壁營造廠查驗"),
    ("diaphragm-wall-gc.html", "gc-guide-wall-example.pdf", "showTool('guideWall');", "current", "導溝施工複核"),
    ("diaphragm-wall-gc.html", "gc-rebar-cage-example.pdf", "showTool('rebarCage');", "current", "鋼筋籠吊放前複核"),
    ("template.html", "template-example.pdf", "", "all", "模板工程複核表"),
    ("rebar.html", "rebar-example.pdf", "", "all", "鋼筋工程查驗表"),
    ("steel-structure.html", "steel-structure-example.pdf", "", "all", "鋼構施工複核表"),
]


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

server = subprocess.Popen([sys.executable, "-m", "http.server", "--bind", "127.0.0.1", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
shutil.rmtree(PAGES, ignore_errors=True)
PAGES.mkdir()
manifest = {}
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for html, filename, setup, scope, title in TARGETS:
            page = browser.new_page()
            page.goto(f"http://127.0.0.1:{PORT}/{html}?example=1", wait_until="networkidle")
            page.evaluate(f"""() => {{ window.print = () => {{}}; {setup} return preparePrint('{scope}'); }}""")
            page.emulate_media(media="print")
            page.pdf(path=str(OUT / filename), prefer_css_page_size=True, print_background=True)
            page.close()
            name = filename[:-len(".pdf")]
            manifest[name] = {"title": title, "back": html.removesuffix(".html"), **render_pages(OUT / filename, name)}
            print(f"寫入 examples/{filename}（{manifest[name]['pages']} 頁）與 pages/{name}-*.webp")
        browser.close()
    (PAGES / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
finally:
    server.terminate()
