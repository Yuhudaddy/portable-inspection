"""對 `wrangler pages dev` 跑的真實執行環境做端到端檢查：登入 → Service Worker 安裝 → 登出 → 重新開啟，
確認未登入的回應沒有蓋掉快取，而且離線仍能開啟已快取的頁面。
用法：先在另一個終端機啟動 wrangler（見 docs/superpowers/plans/2026-10-05-login-gate.md 的 Task 6），
再執行 python3 scripts/verify_gate_e2e.py <帳號> <密碼> [SESSION_SECRET]
有給 SESSION_SECRET 時，會多測「通行證已超過 1 天沒續期，按首頁的登出」（簽一張舊通行證塞進瀏覽器）。"""
import base64
import hashlib
import hmac
import sys
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:8788"
user, password = sys.argv[1], sys.argv[2]
secret = sys.argv[3] if len(sys.argv) > 3 else None
failures = []


def stale_token(age_days=2):
    """照 functions/_lib/auth.js 的格式簽一張「簽發在 age_days 天前」的通行證。"""
    expires = int(time.time()) - age_days * 86400 + 90 * 86400
    fingerprint = hashlib.sha256(f"{user}:{password}".encode()).hexdigest()[:16]
    mac = hmac.new(secret.encode(), f"v1.{expires}.{fingerprint}".encode(), hashlib.sha256).digest()
    return f"v1.{expires}." + base64.urlsafe_b64encode(mac).decode().rstrip("=")


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

    page.goto(f"{BASE}/", wait_until="networkidle")
    page.click(".logout-button")
    page.wait_for_url("**/login", timeout=8000)
    check("按首頁的「登出」→ 回到登入頁，通行證被清掉", not any("pi_auth" in c["name"] for c in context.cookies()), str([c["name"] for c in context.cookies()]))
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

    if secret:
        stale_context = browser.new_context(viewport={"width": 375, "height": 812})
        stale_page = stale_context.new_page()
        stale_page.goto(f"{BASE}/", wait_until="networkidle")
        stale_page.fill("#login-username", user)
        stale_page.fill("#login-password", password)
        stale_page.click("#login-submit")
        stale_page.wait_for_url(f"{BASE}/", timeout=8000)
        # __Host- 前綴的 Cookie 不能用 add_cookies 塞（Playwright 會加上 Domain，Chrome 判為無效），
        # 改用 CDP 直接寫入：覆蓋剛登入拿到的新通行證，換成一張「簽發在 2 天前」的舊通行證。
        stale_context.new_cdp_session(stale_page).send("Network.setCookie", {"name": "__Host-pi_auth", "value": stale_token(), "url": BASE, "path": "/", "secure": True, "httpOnly": True, "sameSite": "Lax"})
        stale_page.click(".logout-button")
        stale_page.wait_for_url("**/login", timeout=8000)
        check("通行證超過 1 天沒續期時按「登出」，也真的登出（沒有被重發的新通行證蓋回去）", not any("pi_auth" in c["name"] for c in stale_context.cookies()), str([c["name"] for c in stale_context.cookies()]))
        stale_page.goto(f"{BASE}/rebar", wait_until="networkidle")
        check("登出後打開工具頁 → 登入頁", stale_page.url.startswith(f"{BASE}/login") and "進場登記" in stale_page.inner_text("body"), stale_page.url)
        stale_context.close()
    else:
        print("（略過）沒給 SESSION_SECRET，未測「舊通行證按登出」")
    browser.close()

print("\n" + (f"{len(failures)} 項失敗" if failures else "全部通過"))
sys.exit(1 if failures else 0)
