"""用 headless Chrome 跑各工具的空表與大量資料列印流程，檢查簽名欄貼齊頁底。"""
import subprocess
import sys
import time
from pathlib import Path
import fitz
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tmp" / "verify-print"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 4199
FILL = {
    "diaphragm-wall.html": "state.wall.unitNo='A01'; for(let i=0;i<70;i++) state.trucks.push({id:'t'+i,truckNo:'T'+i,volume:'8',measured:'1'}); for(let i=0;i<60;i++) state.soil.push({id:'s'+i,time:'09:00'}); for(let i=0;i<40;i++) state.depth.push({id:'d'+i,time:'10:00',value:'35.0'}); state.guideWall.note=Array(40).fill('導溝備註測試文字，用來把內容撐長。').join('\\n'); state.rebarCage.note=Array(40).fill('鋼筋籠備註測試文字，用來把內容撐長。').join('\\n');",
    "diaphragm-wall-gc.html": "state.unit.unitNo='B02'; state.guideWall.note=Array(60).fill('導溝備註測試文字，用來把內容撐長。').join('\\n'); state.rebarCage.note=Array(60).fill('鋼筋籠備註測試文字，用來把內容撐長。').join('\\n');",
    "template.html": "for(let i=0;i<12;i++) state.members.push(Object.assign(createMember(),{id:'C'+i,type:'柱'}));",
    "rebar.html": "for(let i=0;i<8;i++) state.members.push(createMember({id:'B'+i,type:'梁'}));",
    "steel-structure.html": "for(let i=0;i<70;i++) state.delivery.records.push({type:'柱',memberNo:'C-'+i,spec:'H400x400',qty:'1',doc:'MTC-'+i,appearance:'良好',storage:'良好',result:'合格'}); state.delivery.note=Array(50).fill('進場備註測試文字，用來把內容撐長。').join('\\n');",
}

MM = 25.4 / 72
SIGN_CELL = 12 / MM  # 標籤列下方還有 12mm 的簽名格


def signature_line(page):
    """回傳「擔當者」那一行的 (bbox, 是否為旋轉文字)。橫向頁的內容逆時針轉了 90°，文字方向會是 (0, -1)。"""
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            if "擔當者" in "".join(span["text"] for span in line["spans"]):
                return fitz.Rect(line["bbox"]), abs(line["dir"][0]) < 0.5
    return None, False


def check(pdf_path):
    failures = []
    for index, page in enumerate(fitz.open(pdf_path)):
        rect, rotated = signature_line(page)
        if rect is None:
            continue
        # 直向頁：簽名格底邊距頁底；旋轉頁：橫向的「下」是直向紙的右邊，改量距右緣
        gap_mm = ((page.rect.width - (rect.x1 + SIGN_CELL)) if rotated else (page.rect.height - (rect.y1 + SIGN_CELL))) * MM
        if gap_mm > 16:
            failures.append(f"    p{index + 1}: 簽名欄{'（旋轉頁）距右緣' if rotated else '底距頁底'} {gap_mm:.1f}mm")
    return failures

server = subprocess.Popen([sys.executable, "-m", "http.server", "--bind", "127.0.0.1", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
                    page.evaluate(f"() => {{ {fill} renderAll?.(); }}")
                page.evaluate("() => { window.print = () => {}; return preparePrint('all'); }")
                page.emulate_media(media="print")
                out = OUT / f"{html.replace('.html', '')}-{scenario}.pdf"
                page.pdf(path=str(out), prefer_css_page_size=True, print_background=True)
                problems = check(out)
                print(f"{'❌' if problems else '✅'} {html} [{scenario}] → {out.name}")
                for line in problems:
                    print(line)
                failed = failed or bool(problems)
                page.close()
        browser.close()
finally:
    server.terminate()
sys.exit(1 if failed else 0)
