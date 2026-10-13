"""用 headless Chrome 走真正的 App 輸出流程產生 examples/*.pdf，
再把每頁轉成 examples/pages/<名稱>-<頁>.webp 給 example.html 顯示（主畫面 Web App 直接開 PDF
會交給系統檢視器，沒有介面可以回頭，所以範例改在自己的頁面裡逐頁顯示）。
用法：python3 scripts/render_example_pdfs.py            全部重新產生
      python3 scripts/render_example_pdfs.py 名稱 [名稱…]  只重新產生指定範例（例如 rebar-cage-simple-example），
                                                          其他範例的檔案與圖片不動，manifest 只更新這幾筆
      局部重產要求 manifest 裡已經有其他範例，缺的話會中止（請先全部重產一次）；產生到一半失敗時，舊的 PDF、圖片與 manifest 都保留。
"""
import json
import subprocess
import sys
import time
from io import BytesIO
from pathlib import Path

import fitz
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "examples"
PAGES = OUT / "pages"
PORT = 4198
IMAGE_SCALE = 1.6  # 72dpi × 1.6 ≈ 115dpi，A4 約 950×1344px，手機看清楚也不會太肥
# 「整份」輸出（scope = all）會把導溝與鋼筋籠的頁也印進來，但它們各有自己的範例，
# 所以整份範例印出前先把這些頁拿掉（續頁會沿用原頁的 data-print-tab，一併移除；其他工具沒有這些頁，等於沒動）。
SIDE_TABS = ["guideWall", "rebarCage"]
# 鋼筋籠有簡易、詳細兩種輸出（範例資料預設是詳細，簡易版把模式切過去）
CAGE_SIMPLE = "showTool('rebarCage'); state.rebarCage.mode = 'simple'; renderAll();"
# (頁面, 輸出檔名, 進頁後切換工具／分頁的 JS, 輸出範圍, 範例標題)
TARGETS = [
    ("diaphragm-wall.html", "diaphragm-wall-example.pdf", "showTool('diaphragmWall'); showTab('quality');", "all", "連續壁施工紀錄"),
    ("diaphragm-wall.html", "guide-wall-example.pdf", "showTool('guideWall');", "current", "導溝施工複核"),
    ("diaphragm-wall.html", "rebar-cage-simple-example.pdf", CAGE_SIMPLE, "current", "鋼筋籠吊放前複核（簡易版）"),
    ("diaphragm-wall.html", "rebar-cage-detailed-example.pdf", "showTool('rebarCage');", "current", "鋼筋籠吊放前複核（詳細版）"),
    ("diaphragm-wall-gc.html", "diaphragm-wall-gc-example.pdf", "showTool('inspection'); showTab('design');", "all", "連續壁營造廠查驗"),
    ("diaphragm-wall-gc.html", "gc-guide-wall-example.pdf", "showTool('guideWall');", "current", "導溝施工複核"),
    ("diaphragm-wall-gc.html", "gc-rebar-cage-simple-example.pdf", CAGE_SIMPLE, "current", "鋼筋籠吊放前複核（簡易版）"),
    ("diaphragm-wall-gc.html", "gc-rebar-cage-detailed-example.pdf", "showTool('rebarCage');", "current", "鋼筋籠吊放前複核（詳細版）"),
    ("template.html", "template-example.pdf", "", "all", "模板工程複核表"),
    ("rebar.html", "rebar-example.pdf", "", "all", "鋼筋工程查驗表"),
    ("steel-structure.html", "steel-structure-example.pdf", "", "all", "鋼構施工複核表"),
]
NAMES = [target[1].removesuffix(".pdf") for target in TARGETS]
ONLY = set(sys.argv[1:])
unknown = ONLY - set(NAMES)
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
    """PDF 逐頁轉 WebP，回傳 manifest 需要的頁數與尺寸。每一頁都轉好了才換掉舊圖片，轉到一半出錯不會留下缺頁。"""
    document = fitz.open(pdf_path)
    encoded = []
    for page in document:
        pixmap = page.get_pixmap(matrix=fitz.Matrix(IMAGE_SCALE, IMAGE_SCALE))
        buffer = BytesIO()
        Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples).save(buffer, "WEBP", quality=78, method=6)
        encoded.append(buffer.getvalue())
    document.close()
    for old in PAGES.glob(f"{name}-*.webp"):
        old.unlink()
    for index, data in enumerate(encoded, start=1):
        (PAGES / f"{name}-{index}.webp").write_bytes(data)
    return {"pages": len(encoded), "width": pixmap.width, "height": pixmap.height}


manifest_path = PAGES / "manifest.json"
PAGES.mkdir(exist_ok=True)
manifest = json.loads(manifest_path.read_text(encoding="utf8")) if manifest_path.exists() else {}
missing = [name for name in NAMES if ONLY and name not in ONLY and name not in manifest]
if missing:
    sys.exit(f"manifest 裡沒有這些範例：{', '.join(missing)}；局部重產不會補它們，請先不帶名稱全部重產一次")


def save_manifest():
    """只留目前 TARGETS 有的範例（改名、移除的舊範例不留），順序照 TARGETS。每做完一份就存，中途失敗時 manifest 與檔案仍然一致。"""
    manifest_path.write_text(json.dumps({name: manifest[name] for name in NAMES if name in manifest}, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


server = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "serve.py"), str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
staged = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for (html, filename, setup, scope, title), name in zip(TARGETS, NAMES):
            if ONLY and name not in ONLY:
                continue
            page = browser.new_page()
            page.goto(f"http://127.0.0.1:{PORT}/{html}?example=1", wait_until="networkidle")
            page.evaluate(f"""drop => {{ window.print = () => {{}}; {setup} preparePrint('{scope}');
              document.querySelectorAll('.print-page').forEach(page => {{ if (drop.includes(page.dataset.printTab)) page.remove(); }}); }}""",
                          SIDE_TABS if scope == "all" else [])
            page.emulate_media(media="print")
            # 先輸出到暫存檔，圖片也轉好了才換掉正式的 PDF；中途失敗，舊的 PDF、圖片、manifest 都還在
            staged.append(OUT / f"{name}.new.pdf")
            page.pdf(path=str(staged[-1]), prefer_css_page_size=True, print_background=True)
            page.close()
            normalize_pdf(staged[-1])
            pages = render_pages(staged[-1], name)
            staged[-1].replace(OUT / filename)
            manifest[name] = {"title": title, "back": html.removesuffix(".html"), **pages}
            save_manifest()
            print(f"寫入 examples/{filename}（{manifest[name]['pages']} 頁）與 pages/{name}-*.webp")
        browser.close()
    if not ONLY:
        # 全部重產才清：改名、移除的舊範例留下的圖片
        for old in PAGES.glob("*.webp"):
            if old.stem.rsplit("-", 1)[0] not in NAMES:
                old.unlink()
finally:
    server.terminate()
    for leftover in staged:
        leftover.unlink(missing_ok=True)
