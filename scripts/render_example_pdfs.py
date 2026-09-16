"""用 headless Chrome 走真正的 App 輸出流程產生 examples/*.pdf。"""
import subprocess
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "examples"
PORT = 4198
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
            page.evaluate(f"""() => {{ window.print = () => {{}}; {setup} return preparePrint('{scope}'); }}""")
            page.emulate_media(media="print")
            page.pdf(path=str(OUT / filename), prefer_css_page_size=True, print_background=True)
            print(f"寫入 examples/{filename}  標題：{page.evaluate('document.title')}")
            page.close()
        browser.close()
finally:
    server.terminate()
