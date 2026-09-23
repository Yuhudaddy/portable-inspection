"""打包「連續壁完整版」的對外展示版：只有完整版的輸入頁面與它的三份範例輸出，其他工具、施工計畫、
首頁與中繼頁都不帶。輸出到 share/diaphragm-wall/（不進 git），用 Cloudflare Pages「直接上傳」部署，
不連結 GitHub：

    python3 scripts/build_share.py
    npx wrangler pages deploy share/diaphragm-wall --project-name <專案名稱>

處理內容
・完整版頁面放在網站根目錄（index.html），開網址就是工具頁
・拿掉對外連結：返回中繼頁、施工計畫、回首頁；說明視窗與清空視窗裡提到施工計畫的文字
・拿掉離線快取（Service Worker）與 PWA manifest；網站名稱不出現 Portable Inspection
・JS／CSS 用 esbuild 壓縮並去掉註解，HTML 去掉註解；加上 noindex（_headers、robots.txt）
・範例檢視頁只保留完整版的三份範例（說明視窗的範例按鈕），「←」回工具頁；不存在的路徑回 404

主程式更新後重跑即可；每次都先清空輸出資料夾。需要 Node（npx 會自動下載 esbuild）。
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "share" / "diaphragm-wall"
ESBUILD = ["npx", "--yes", "esbuild@0.24.0"]
EXAMPLES = ["diaphragm-wall-example", "guide-wall-example", "rebar-cage-example"]
SITE_NAME = "連續壁施工紀錄"
STATIC = ["app-icon-144.png", "apple-touch-icon.png", "taisei.png"]


def fail(message):
    sys.exit(f"❌ {message}")


def replace_once(text, old, new, label):
    """原文要剛好出現一次，否則代表主程式改版、這裡的規則要跟著更新。"""
    if text.count(old) != 1:
        fail(f"{label}：找不到（或不只一處）要替換的內容，主程式可能改版了 → {old[:60]!r}")
    return text.replace(old, new)


def remove_element(text, pattern, label):
    new, count = re.subn(pattern, "", text, count=1, flags=re.S)
    if count != 1:
        fail(f"{label}：找不到要移除的元素，主程式可能改版了")
    return new


def minify(source, loader):
    result = subprocess.run([*ESBUILD, f"--loader={loader}", "--minify", "--legal-comments=none", "--charset=utf8"],
                            input=source, capture_output=True, text=True, cwd=ROOT)
    if result.returncode != 0:
        fail(f"esbuild 壓縮失敗：{result.stderr[:400]}")
    return result.stdout


def strip_html_comments(html):
    return re.sub(r"<!--.*?-->\s*", "", html, flags=re.S)


def html_assets(html, tag, attr):
    return re.findall(rf'<{tag}\b[^>]*\b{attr}="\./([^"]+)"', html)


def build_tool_page():
    html = (ROOT / "diaphragm-wall.html").read_text(encoding="utf8")
    html = remove_element(html, r'\s*<a class="glass-pill header-back"[^>]*>.*?</a>', "返回中繼頁")
    html = remove_element(html, r'\s*<a class="glass-pill header-plan"[^>]*>.*?</a>', "施工計畫按鈕")
    html = remove_element(html, r'\s*<a class="dock-tool" href="\./">.*?</a>', "回首頁按鈕")
    html = remove_element(html, r'\s*<li>[^<]*「計畫」[^<]*</li>', "說明視窗的施工計畫說明")
    html = remove_element(html, r'\s*<link rel="manifest"[^>]*/>', "PWA manifest")
    html = remove_element(html, r'\s*<script src="\./sw-client\.js"[^>]*></script>', "Service Worker")
    html = replace_once(html, "，以及計畫頁面內還原到未輸入的狀態", "還原到未輸入的狀態", "清空視窗")
    html = replace_once(html, "調整的數值會同步到施工計畫，並以底色標示。", "", "檢查標準值說明")
    html = replace_once(html, "｜Portable Inspection</title>", "</title>", "頁面標題")
    html = replace_once(html, 'content="Portable Inspection"', f'content="{SITE_NAME}"', "主畫面名稱")
    if "Portable Inspection" in html or "plan?" in html:
        fail("工具頁還留有 Portable Inspection 或施工計畫連結")
    return strip_html_comments(html)


def build_example_page():
    html = (ROOT / "example.html").read_text(encoding="utf8")
    html = remove_element(html, r'\s*<link rel="manifest"[^>]*/>', "範例頁 PWA manifest")
    html = remove_element(html, r'\s*<script src="\./sw-client\.js"[^>]*></script>', "範例頁 Service Worker")
    html = re.sub(r"Portable Inspection", SITE_NAME, html)
    script = (ROOT / "example.js").read_text(encoding="utf8")
    script = replace_once(script, "｜範例輸出｜Portable Inspection`", "｜範例輸出`", "範例頁標題")
    return strip_html_comments(html), script


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "examples" / "pages").mkdir(parents=True)

    tool = build_tool_page()
    example_html, example_js = build_example_page()
    (OUT / "index.html").write_text(tool, encoding="utf8")
    (OUT / "example.html").write_text(example_html, encoding="utf8")

    # 工具頁與範例頁引用到的 JS／CSS：壓縮後輸出（example.js 用改過的內容）
    scripts = sorted(set(html_assets(tool, "script", "src") + html_assets(example_html, "script", "src")))
    styles = sorted(set(html_assets(tool, "link", "href") + html_assets(example_html, "link", "href")) - set(STATIC))
    for name in scripts:
        source = example_js if name == "example.js" else (ROOT / name).read_text(encoding="utf8")
        (OUT / name).write_text(minify(source, "js"), encoding="utf8")
    for name in styles:
        if name.endswith(".css"):
            (OUT / name).write_text(minify((ROOT / name).read_text(encoding="utf8"), "css"), encoding="utf8")
    for name in STATIC:
        shutil.copy2(ROOT / name, OUT / name)

    # 範例：只留完整版的三份，「←」回工具頁（根目錄）
    manifest = json.loads((ROOT / "examples" / "pages" / "manifest.json").read_text(encoding="utf8"))
    kept = {name: {**manifest[name], "back": ""} for name in EXAMPLES}
    (OUT / "examples" / "pages" / "manifest.json").write_text(json.dumps(kept, ensure_ascii=False, indent=2), encoding="utf8")
    for name in EXAMPLES:
        shutil.copy2(ROOT / "examples" / f"{name}.pdf", OUT / "examples" / f"{name}.pdf")
        for index in range(1, kept[name]["pages"] + 1):
            shutil.copy2(ROOT / "examples" / "pages" / f"{name}-{index}.webp", OUT / "examples" / "pages" / f"{name}-{index}.webp")

    # 不存在的路徑回 404（Pages 沒有 404.html 時會一律回首頁，看起來像還有其他頁面）
    (OUT / "404.html").write_text(
        '<!doctype html><html lang="zh-Hant-TW"><head><meta charset="UTF-8" />'
        '<meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="robots" content="noindex" />'
        f'<title>找不到頁面｜{SITE_NAME}</title><link rel="stylesheet" href="./glass.css" /></head>'
        '<body><p>找不到這個頁面。<a href="./">回到施工紀錄</a></p></body></html>\n', encoding="utf8")

    # 不讓搜尋引擎收錄
    (OUT / "_headers").write_text("/*\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: no-referrer\n", encoding="utf8")
    (OUT / "robots.txt").write_text("User-agent: *\nDisallow: /\n", encoding="utf8")

    # 最後檢查：輸出裡不能有連回主專案的字樣
    leaks = []
    for path in OUT.rglob("*"):
        if path.suffix in {".html", ".js", ".css", ".json"}:
            text = path.read_text(encoding="utf8")
            for marker in ("github", "pages.dev", "Portable Inspection", "portable-inspection", "plan?work", "diaphragm-wall-select"):
                if marker in text:
                    leaks.append(f"{path.relative_to(OUT)}：{marker}")
    if leaks:
        fail("輸出含有不該出現的字樣：\n  " + "\n  ".join(leaks))

    files = sorted(p for p in OUT.rglob("*") if p.is_file())
    size = sum(p.stat().st_size for p in files) / 1024 / 1024
    print(f"✅ 輸出 {OUT.relative_to(ROOT)}：{len(files)} 個檔案，共 {size:.1f} MB")


if __name__ == "__main__":
    main()
