"""用 headless Chrome 檢查登入頁：閘門狀態切換、next 帶入、密碼顯示、觸控目標、手機寬度、CSP、登出鈕。
登入 API 用 page.route 攔截成假回應，不需要 Cloudflare；本機 serve.py 負責提供靜態檔。
用法：python3 scripts/verify_login_page.py"""
import json
import subprocess
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 4198
BASE = f"http://127.0.0.1:{PORT}"
failures = []


def check(name, condition, detail=""):
    print(("✅ " if condition else "❌ ") + name + ("" if condition else f"\n    {detail}"))
    if not condition:
        failures.append(name)


def state(page):
    return page.evaluate("() => document.getElementById('gate-stage').dataset.state")


def open_login(browser, query="", viewport=None, **context_options):
    context = browser.new_context(viewport=viewport or {"width": 375, "height": 812}, **context_options)
    page = context.new_page()
    problems = []
    page.on("pageerror", lambda error: problems.append(str(error)))
    page.on("console", lambda message: problems.append(message.text) if message.type == "error" else None)
    page.add_init_script("window.__csp = []; document.addEventListener('securitypolicyviolation', event => window.__csp.push(event.violatedDirective + ' ' + event.blockedURI));")
    page.goto(f"{BASE}/login{query}", wait_until="networkidle")
    return context, page, problems


def fill(page, username, password):
    page.fill("#login-username", username)
    page.fill("#login-password", password)


server = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "serve.py"), str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")

        # ---- 版面、欄位與 CSP ----
        context, page, problems = open_login(browser, "?next=/rebar")
        check("登入頁標題與表單", page.title().startswith("登入") and page.get_attribute("#login-form", "action") == "/api/login" and page.get_attribute("#login-form", "method") == "post")
        check("next 帶進隱藏欄位", page.input_value("input[name=next]") == "/rebar", page.input_value("input[name=next]"))
        check("說明文字不寫死「手機」（桌機也會看到）", "這台裝置" in page.inner_text(".login-note") and "手機" not in page.inner_text(".login-note"), page.inner_text(".login-note"))
        check("手機密碼管理員屬性", page.get_attribute("#login-username", "autocomplete") == "username" and page.get_attribute("#login-password", "autocomplete") == "current-password")
        sizes = page.evaluate("() => ['#login-username', '#login-password', '.password-toggle', '#login-submit'].map(s => Math.round(document.querySelector(s).getBoundingClientRect().height))")
        check("觸控目標都至少 44px", min(sizes) >= 44, str(sizes))
        check("輸入框字級 16px（避免 iOS 放大）", page.evaluate("() => getComputedStyle(document.getElementById('login-username')).fontSize") == "16px")
        check("375×667 的手機看得到「開門」按鈕", page.evaluate("() => document.getElementById('login-submit').getBoundingClientRect().bottom") <= 812)
        check("沒有橫向捲動", page.evaluate("() => document.documentElement.scrollWidth <= innerWidth"))
        check("沒有 CSP 違規、沒有主控台錯誤", page.evaluate("() => window.__csp.length") == 0 and not problems, f"{page.evaluate('() => window.__csp')} {problems}")
        check("登入頁不註冊 Service Worker", page.evaluate("() => navigator.serviceWorker.getRegistrations().then(list => list.length)") == 0)
        context.close()

        context, page, _ = open_login(browser, "?next=//evil.example")
        check("惡意 next 被改回首頁", page.input_value("input[name=next]") == "/", page.input_value("input[name=next]"))
        context.close()
        context, page, _ = open_login(browser, "?next=https://evil.example/x")
        check("外部網址 next 被改回首頁", page.input_value("input[name=next]") == "/")
        context.close()

        # ---- 密碼顯示切換 ----
        context, page, _ = open_login(browser)
        page.fill("#login-password", "secret")
        page.click(".password-toggle")
        check("按「顯示」後密碼變明文", page.get_attribute("#login-password", "type") == "text" and page.get_attribute(".password-toggle", "aria-pressed") == "true" and page.inner_text(".password-toggle") == "隱藏")
        page.click(".password-toggle")
        check("再按一次變回遮蔽", page.get_attribute("#login-password", "type") == "password" and page.inner_text(".password-toggle") == "顯示")
        context.close()

        # ---- 空欄位不送出 ----
        context, page, _ = open_login(browser)
        calls = []
        page.route("**/api/login", lambda route: (calls.append(1), route.abort()))
        page.click("#login-submit")
        check("沒填帳密：顯示提示、不送出請求", "請輸入帳號和密碼" in page.inner_text("#login-error") and not calls)
        check("沒填帳密：不算被擋下（閘門不彈跳），焦點回到帳號欄", state(page) == "idle" and page.evaluate("() => document.activeElement.id") == "login-username", f"{state(page)} {page.evaluate('() => document.activeElement.id')}")
        page.fill("#login-username", "staff")
        page.click("#login-submit")
        check("只填帳號沒填密碼：焦點跳到密碼欄", page.evaluate("() => document.activeElement.id") == "login-password", page.evaluate("() => document.activeElement.id"))
        context.close()

        # ---- 帳密錯誤：確認中 → 被擋下 → 回到鎖著 ----
        context, page, _ = open_login(browser)
        held = []
        page.route("**/api/login", lambda route: held.append(route))
        fill(page, "staff", "wrong")
        page.click("#login-submit")
        page.wait_for_function("() => document.getElementById('gate-stage').dataset.state === 'checking'")
        check("確認中：警示燈本身快速閃爍（不只是光暈）", page.evaluate("() => getComputedStyle(document.querySelector('.gate-lamp')).animationName") == "gate-blink", page.evaluate("() => getComputedStyle(document.querySelector('.gate-lamp')).animationName"))
        check("送出後進入「確認中」：按鈕停用並改字", page.inner_text("#login-submit") == "確認中…" and page.is_disabled("#login-submit"))
        post_body = held[0].request.post_data or ""
        check("送出的是帳號、密碼與 next", "username=staff" in post_body and "password=wrong" in post_body and "next=" in post_body, post_body)
        check("要求 JSON 回應", (held[0].request.headers.get("accept") or "").startswith("application/json"))
        held[0].fulfill(status=401, content_type="application/json", body=json.dumps({"ok": False}))
        page.wait_for_function("() => document.getElementById('login-error').classList.contains('is-visible')")
        check("帳密錯誤：顯示紅色訊息、按鈕恢復、密碼清空並取得焦點", "閘門沒開" in page.inner_text("#login-error") and page.inner_text("#login-submit") == "開門" and not page.is_disabled("#login-submit") and page.input_value("#login-password") == "" and page.evaluate("() => document.activeElement.id") == "login-password")
        page.wait_for_function("() => document.getElementById('gate-stage').dataset.state === 'idle'", timeout=3000)
        check("彈跳播完閘門回到鎖著", state(page) == "idle")
        context.close()

        # ---- 帳密正確：放行 → 換頁 ----
        context, page, _ = open_login(browser, "?next=/rebar")
        page.route("**/api/login", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"ok": True, "next": "/rebar"})))
        fill(page, "staff", "right")
        page.click("#login-submit")
        page.wait_for_function("() => document.getElementById('gate-stage').dataset.state === 'open'")
        check("帳密正確：桿子升起、按鈕變「請進」並朗讀狀態", page.inner_text("#login-submit") == "請進" and "閘門已開" in page.inner_text("#login-status"))
        arm_angle = page.evaluate("() => new Promise(resolve => setTimeout(() => resolve(getComputedStyle(document.querySelector('.gate-arm')).transform), 900))")
        check("桿子真的轉了（transform 不是單位矩陣）", arm_angle not in ("none", "matrix(1, 0, 0, 1, 0, 0)"), arm_angle)
        page.wait_for_url("**/rebar", timeout=5000)
        check("停一下後換到原本要去的頁面", page.url.endswith("/rebar"), page.url)
        context.close()

        # ---- 各種失敗 ----
        for label, handler, expected in [
            ("伺服器未設定（503）", lambda route: route.fulfill(status=503, content_type="application/json", body="{}"), "尚未設定"),
            ("伺服器錯誤（500）", lambda route: route.fulfill(status=500, content_type="text/plain", body="x"), "暫時無法使用"),
            ("連線失敗", lambda route: route.abort(), "連不上網路"),
        ]:
            context, page, _ = open_login(browser)
            page.route("**/api/login", handler)
            fill(page, "staff", "pw")
            page.click("#login-submit")
            page.wait_for_function("() => document.getElementById('login-error').classList.contains('is-visible')")
            check(f"{label}：顯示對應訊息，閘門維持關閉", expected in page.inner_text("#login-error") and state(page) in ("denied", "idle") and not page.is_disabled("#login-submit"), page.inner_text("#login-error"))
            context.close()

        # ---- 沒有 JavaScript 的回頭路：?e=1#login-error ----
        context, page, _ = open_login(browser, "?e=1&next=/rebar#login-error")
        check("伺服器導回 e=1：顯示錯誤並移除網址的 #", "閘門沒開" in page.inner_text("#login-error") and page.evaluate("() => location.hash") == "", page.evaluate("() => location.href"))
        context.close()
        context = browser.new_context(java_script_enabled=False, viewport={"width": 375, "height": 812})
        page = context.new_page()
        page.goto(f"{BASE}/login?e=1&next=/rebar#login-error", wait_until="load")
        check("沒有 JavaScript 時，伺服器導回的 #login-error 會顯示完整訊息", page.is_visible("#login-error") and "閘門沒開" in page.inner_text("#login-error"), page.inner_text("#login-error"))
        page.goto(f"{BASE}/login", wait_until="load")
        check("沒有 JavaScript 時，平常不顯示錯誤框", not page.is_visible("#login-error"))
        context.close()

        # ---- 減少動態效果 ----
        context, page, _ = open_login(browser, reduced_motion="reduce")
        page.evaluate("() => { document.getElementById('gate-stage').dataset.state = 'checking'; }")
        check("減少動態：確認中時警示燈與光暈也不動", page.evaluate("() => ['.gate-lamp', '.gate-halo'].map(s => getComputedStyle(document.querySelector(s)).animationName).join()") == "none,none", page.evaluate("() => ['.gate-lamp', '.gate-halo'].map(s => getComputedStyle(document.querySelector(s)).animationName).join()"))
        page.evaluate("() => { document.getElementById('gate-stage').dataset.state = 'idle'; }")
        check("減少動態：燈不呼吸、桿子沒有轉場", page.evaluate("() => getComputedStyle(document.querySelector('.gate-halo')).animationName") == "none" and page.evaluate("() => getComputedStyle(document.querySelector('.gate-arm')).transitionProperty") == "none")
        context.close()

        # ---- 窄螢幕與桌機 ----
        context, page, _ = open_login(browser, viewport={"width": 320, "height": 568})
        check("320px 寬沒有橫向捲動", page.evaluate("() => document.documentElement.scrollWidth <= innerWidth"))
        context.close()
        context, page, _ = open_login(browser, viewport={"width": 1280, "height": 800})
        check("桌機：版面置中、欄寬不超過 420px", 0 < page.evaluate("() => document.querySelector('.login-card').getBoundingClientRect().width") <= 420)
        check("桌機：自動把焦點放在帳號欄", page.evaluate("() => document.activeElement.id") == "login-username", page.evaluate("() => document.activeElement.tagName"))
        context.close()

        # ---- 首頁的登出按鈕 ----
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()
        page.goto(f"{BASE}/", wait_until="networkidle")
        check("首頁有登出鈕：POST /api/logout、觸控目標 ≥44px", page.get_attribute(".logout-form", "action") == "/api/logout" and page.get_attribute(".logout-form", "method") == "post" and page.evaluate("() => document.querySelector('.logout-button').getBoundingClientRect().height") >= 44)
        check("首頁品牌仍在左、登出鈕在右", page.evaluate("() => document.querySelector('.brand').getBoundingClientRect().left < document.querySelector('.logout-button').getBoundingClientRect().left"))
        context.close()
        # ---- end of checks ----
        browser.close()
finally:
    server.terminate()

print("\n" + (f"{len(failures)} 項失敗" if failures else "全部通過"))
sys.exit(1 if failures else 0)
