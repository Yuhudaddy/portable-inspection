"""對 `wrangler pages dev` 跑的真實執行環境做端到端檢查：登入 → Service Worker 安裝 → 登出 → 重新開啟，
確認未登入的回應沒有蓋掉快取，而且離線仍能開啟已快取的頁面。
用法：先在另一個終端機啟動 wrangler（見 docs/superpowers/plans/2026-10-05-login-gate.md 的 Task 6），
再執行 python3 scripts/verify_gate_e2e.py <帳號> <密碼>"""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8788"
user, password = sys.argv[1], sys.argv[2]
failures = []


def check(name, condition, detail=""):
    print(("✅ " if condition else "❌ ") + name + ("" if condition else f"\n    {detail}"))
    if not condition:
        failures.append(name)


with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    context = browser.new_context(viewport={"width": 375, "height": 812})
    page = context.new_page()

    page.goto(f"{BASE}/rebar", wait_until="networkidle")
    check("未登入打開工具頁 → 導到登入頁並記住原網址", page.url == f"{BASE}/login?next=%2Frebar", page.url)

    page.fill("#login-username", user)
    page.fill("#login-password", password)
    page.click("#login-submit")
    page.wait_for_url("**/rebar", timeout=8000)
    check("登入成功 → 回到原本的工具頁，而且樣式有載入", "鋼筋工程查驗" in page.title() and page.evaluate("() => getComputedStyle(document.body).fontFamily.length > 0 && document.styleSheets.length >= 2"))
    check("通行證是 HttpOnly，網頁程式碼讀不到", "pi_auth" not in page.evaluate("() => document.cookie"))

    page.evaluate("() => navigator.serviceWorker.ready")
    page.wait_for_function("() => caches.keys().then(keys => keys.length > 0)", timeout=15000)
    page.wait_for_function("() => caches.keys().then(keys => caches.open(keys.find(k => k.startsWith('portable-inspection-v'))).then(c => c.keys()).then(r => r.length >= 40))", timeout=30000)
    cached = page.evaluate("() => caches.keys().then(keys => caches.open(keys.find(k => k.startsWith('portable-inspection-v'))).then(c => c.keys()).then(r => r.map(x => new URL(x.url).pathname)))")
    check("Service Worker 裝好並快取了工具頁與樣式", "/rebar" in cached and "/app.css" in cached and "/" in cached, str(cached[:8]))
    check("登入頁與登入 API 沒被快取", not any(path.startswith("/login") or path.startswith("/api/") for path in cached), str([c for c in cached if c.startswith(("/login", "/api"))]))

    page.evaluate("() => fetch('/api/logout', { method: 'POST', redirect: 'manual' })")
    page.goto(f"{BASE}/rebar", wait_until="networkidle")
    check("登出後重新打開工具頁 → 線上會被導到登入頁（畫面是登入頁，不是一行純文字）", page.url.startswith(f"{BASE}/login") and "進場登記" in page.inner_text("body"), f"{page.url} {page.inner_text('body')[:30]!r}")

    texts = page.evaluate("""async () => {
      const rebar = await caches.match('/rebar');
      const css = await caches.match('/app.css');
      return { rebar: rebar ? await rebar.text() : '', css: css ? await css.text() : '' };
    }""")
    check("快取裡的工具頁沒被登入頁蓋掉", "鋼筋工程查驗" in texts["rebar"] and "進場登記" not in texts["rebar"])
    check("快取裡的 app.css 還是 CSS，不是登入頁", len(texts["css"]) > 1000 and not texts["css"].lstrip().startswith("<"))

    context.set_offline(True)
    offline_page = context.new_page()
    offline_page.goto(f"{BASE}/rebar", wait_until="load")
    check("離線時仍可開啟已快取的工具頁", "鋼筋工程查驗" in offline_page.title(), offline_page.title())
    context.set_offline(False)
    browser.close()

print("\n" + (f"{len(failures)} 項失敗" if failures else "全部通過"))
sys.exit(1 if failures else 0)
