// 登入門檻的自動檢查：node scripts/verify_auth.mjs
// 不需要 Cloudflare：直接 import functions/ 裡的純函式，用假的 context 呼叫門房與登入 API，
// 並把 sw.js 放進 vm 沙箱模擬 fetch 事件，確認未登入的回應不會被存進快取。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`❌ ${name}\n    ${error.message}`);
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const equal = (actual, expected, label = "") => {
  if (actual !== expected) throw new Error(`${label} 預期 ${JSON.stringify(expected)}，實際 ${JSON.stringify(actual)}`);
};

// 只有 url／method／headers 的簡化請求，足夠門房與 auth.js 使用（真的 Request 不允許設定部分標頭）。
const req = (pathname, { method = "GET", headers = {} } = {}) => ({
  method,
  url: new URL(pathname, "https://example.test").href,
  headers: new Headers(headers)
});

const auth = await import("../functions/_lib/auth.js");
const ENV = { AUTH_USER: "staff", AUTH_PASSWORD: "correct horse battery staple", SESSION_SECRET: "0123456789abcdef0123456789abcdef-test" };
const NOW = 1_800_000_000;
const DAY = 86400;

// ---- section: 通行證與請求分類 ----
await check("簽發的通行證可驗證，剛簽發不需要續期", async () => {
  const token = await auth.issueToken(ENV, NOW);
  const result = await auth.checkToken(ENV, token, NOW + 5);
  equal(result.valid, true, "valid");
  equal(result.renew, false, "renew");
});

await check("超過 1 天沒續期的通行證會標記需要續期", async () => {
  const token = await auth.issueToken(ENV, NOW);
  const result = await auth.checkToken(ENV, token, NOW + 2 * DAY);
  equal(result.valid, true, "valid");
  equal(result.renew, true, "renew");
});

await check("到期的通行證無效", async () => {
  const token = await auth.issueToken(ENV, NOW);
  equal((await auth.checkToken(ENV, token, NOW + auth.SESSION_SECONDS + 1)).valid, false);
});

await check("竄改到期日或簽章的通行證無效", async () => {
  const [version, expires, signature] = (await auth.issueToken(ENV, NOW)).split(".");
  const longer = `${version}.${Number(expires) + DAY}.${signature}`;
  const flipped = `${version}.${expires}.${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;
  equal((await auth.checkToken(ENV, longer, NOW)).valid, false, "改到期日");
  equal((await auth.checkToken(ENV, flipped, NOW)).valid, false, "改簽章");
});

await check("換密碼、換帳號、換金鑰後，舊通行證立刻失效", async () => {
  const token = await auth.issueToken(ENV, NOW);
  equal((await auth.checkToken({ ...ENV, AUTH_PASSWORD: "another password 123" }, token, NOW)).valid, false, "換密碼");
  equal((await auth.checkToken({ ...ENV, AUTH_USER: "someone-else" }, token, NOW)).valid, false, "換帳號");
  equal((await auth.checkToken({ ...ENV, SESSION_SECRET: "ffffffffffffffffffffffffffffffff-other" }, token, NOW)).valid, false, "換金鑰");
});

await check("格式不對的通行證一律無效", async () => {
  for (const bad of ["", "v1", "v1.abc.def", "v2.1800000100.x", "v1.99999999999999.x", "a.b", null, undefined, 42]) {
    equal((await auth.checkToken(ENV, bad, NOW)).valid, false, JSON.stringify(bad));
  }
});

await check("safeEqual 只在完全相同時為 true（含中文與長度不同）", async () => {
  equal(await auth.safeEqual("密碼abc", "密碼abc"), true);
  equal(await auth.safeEqual("密碼abc", "密碼abd"), false);
  equal(await auth.safeEqual("a", "aa"), false);
  equal(await auth.safeEqual("", ""), true);
});

await check("isConfigured 要三個值都有，而且金鑰至少 32 字元", () => {
  equal(auth.isConfigured(ENV), true, "完整");
  equal(auth.isConfigured({ ...ENV, SESSION_SECRET: "too-short" }), false, "金鑰太短");
  equal(auth.isConfigured({ ...ENV, AUTH_PASSWORD: "" }), false, "沒密碼");
  equal(auth.isConfigured({ AUTH_USER: "a" }), false, "只有帳號");
  equal(auth.isConfigured(undefined), false, "沒有 env");
});

await check("readCookie 能從多個 Cookie 中取出通行證", () => {
  const request = req("/", { headers: { Cookie: `a=1; ${auth.COOKIE_NAME}=v1.123.abc; b=2` } });
  equal(auth.readCookie(request), "v1.123.abc");
  equal(auth.readCookie(req("/", { headers: { Cookie: "a=1" } })), "");
  equal(auth.readCookie(req("/")), "");
});

await check("通行證 Cookie 的屬性", () => {
  const cookie = auth.sessionCookie("TOKEN");
  for (const part of ["__Host-pi_auth=TOKEN", "Path=/", "Max-Age=7776000", "Secure", "HttpOnly", "SameSite=Lax"]) {
    assert(cookie.includes(part), `缺少 ${part}`);
  }
  assert(!/Domain=/i.test(cookie), "__Host- 前綴不能設 Domain");
  assert(auth.clearedCookie().includes("Max-Age=0"), "登出要立刻過期");
});

await check("safeNext 只放行站內路徑，其餘回首頁", () => {
  const cases = [
    ["/", "/"], ["/rebar", "/rebar"], ["/plan?work=rebar&from=rebar", "/plan?work=rebar&from=rebar"],
    ["//evil.example", "/"], ["/\\evil.example", "/"], ["https://evil.example", "/"], ["javascript:alert(1)", "/"],
    ["", "/"], [null, "/"], [undefined, "/"],
    ["/login", "/"], ["/login?next=/rebar", "/"], ["/api/logout", "/"], ["/ok\r\nSet-Cookie: x=1", "/"]
  ];
  for (const [input, expected] of cases) equal(auth.safeNext(input), expected, JSON.stringify(input));
});

await check("isNavigation：先看 Sec-Fetch-Mode／Dest，沒有這些標頭才看 Accept", () => {
  equal(auth.isNavigation(req("/x", { headers: { "Sec-Fetch-Dest": "document" } })), true, "document");
  equal(auth.isNavigation(req("/x", { headers: { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "empty" } })), true, "Service Worker 代為重抓換頁");
  equal(auth.isNavigation(req("/x", { headers: { "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty", Accept: "text/html" } })), false, "頁面裡 fetch() 要 HTML 不算換頁");
  equal(auth.isNavigation(req("/x", { headers: { "Sec-Fetch-Dest": "style" } })), false, "style");
  equal(auth.isNavigation(req("/x", { headers: { "Sec-Fetch-Dest": "serviceworker" } })), false, "serviceworker");
  equal(auth.isNavigation(req("/x", { headers: { Accept: "text/html,application/xhtml+xml" } })), true, "Accept html");
  equal(auth.isNavigation(req("/x", { headers: { Accept: "text/css" } })), false, "Accept css");
  equal(auth.isNavigation(req("/x", { method: "POST", headers: { Accept: "text/html" } })), false, "POST");
});

await check("白名單只放登入相關檔案，工具頁、程式、範例都要登入", () => {
  for (const open of ["/login", "/api/login", "/manifest.webmanifest", "/glass.css"]) assert(auth.isPublicPath(open), `${open} 應該公開`);
  for (const closed of ["/", "/index", "/rebar", "/app.js", "/sw.js", "/plan", "/examples/rebar.pdf", "/api/logout", "/login/"]) {
    assert(!auth.isPublicPath(closed), `${closed} 不該公開`);
  }
});

// ---- section: 門房 ----
const middleware = await import("../functions/_middleware.js");

const page = () => new Response("<html>工具頁</html>", {
  status: 200,
  headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=0, must-revalidate" }
});

async function run(env, request) {
  let nextCalls = 0;
  const response = await middleware.onRequest({ request, env, next: async () => { nextCalls += 1; return page(); } });
  return { response, nextCalls };
}

const withCookie = (headers, token) => (token ? { ...headers, Cookie: `${auth.COOKIE_NAME}=${token}` } : headers);
const navigation = (pathname, token) => req(pathname, { headers: withCookie({ "Sec-Fetch-Dest": "document" }, token) });
const subresource = (pathname, token, dest = "style") => req(pathname, { headers: withCookie({ "Sec-Fetch-Dest": dest }, token) });

await check("未登入的換頁：302 導到登入頁並帶回原網址，不放行", async () => {
  const plain = await run(ENV, navigation("/rebar"));
  equal(plain.response.status, 302, "status");
  equal(plain.response.headers.get("Location"), "/login?next=%2Frebar", "Location");
  equal(plain.response.headers.get("Cache-Control"), "no-store", "Cache-Control");
  equal(plain.nextCalls, 0, "不能呼叫 next");
  const withQuery = await run(ENV, navigation("/plan?work=rebar&from=rebar"));
  equal(withQuery.response.headers.get("Location"), "/login?next=%2Fplan%3Fwork%3Drebar%26from%3Drebar", "帶查詢字串");
});

await check("未登入、由 Service Worker 代為重抓的換頁（Dest 是 empty、Mode 是 navigate）：一樣導向登入頁，不是 401", async () => {
  const request = req("/rebar", { headers: { "Sec-Fetch-Mode": "navigate", "Sec-Fetch-Dest": "empty", Accept: "text/html,application/xhtml+xml" } });
  const { response, nextCalls } = await run(ENV, request);
  equal(response.status, 302, "status");
  equal(response.headers.get("Location"), "/login?next=%2Frebar", "Location");
  equal(nextCalls, 0, "不能放行");
});

await check("未登入的 CSS／JS／sw.js 回 401，不是導向（導向會被 Service Worker 存成 app.css）", async () => {
  for (const [pathname, dest] of [["/app.css", "style"], ["/app.js", "script"], ["/sw.js", "serviceworker"], ["/taisei.png", "image"]]) {
    const { response, nextCalls } = await run(ENV, subresource(pathname, "", dest));
    equal(response.status, 401, pathname);
    assert(!response.headers.get("Location"), `${pathname} 不該有 Location`);
    assert((response.headers.get("Content-Type") || "").startsWith("text/plain"), `${pathname} 要回純文字`);
    equal(response.headers.get("Cache-Control"), "no-store", `${pathname} Cache-Control`);
    equal(nextCalls, 0, `${pathname} 不能呼叫 next`);
  }
});

await check("白名單路徑不需要登入就放行", async () => {
  for (const pathname of ["/login", "/login.css", "/login.js", "/api/login", "/glass.css", "/portal.css", "/manifest.webmanifest", "/apple-touch-icon.png", "/robots.txt"]) {
    const { response, nextCalls } = await run(ENV, subresource(pathname));
    equal(response.status, 200, pathname);
    equal(nextCalls, 1, `${pathname} 要呼叫 next`);
  }
});

await check("sw.js 與 manifest 一律補 Cache-Control: no-cache，不依賴 _headers", async () => {
  const token = await auth.issueToken(ENV);
  const sw = await run(ENV, subresource("/sw.js", token, "serviceworker"));
  equal(sw.response.headers.get("Cache-Control"), "no-cache", "sw.js");
  const manifest = await run(ENV, subresource("/manifest.webmanifest"));
  equal(manifest.response.headers.get("Cache-Control"), "no-cache", "manifest");
});

await check("Secrets 沒設好時一律 503，連換頁都不導向、不放行", async () => {
  for (const env of [{}, { ...ENV, SESSION_SECRET: "short" }, { ...ENV, AUTH_PASSWORD: "" }]) {
    const nav = await run(env, navigation("/rebar"));
    equal(nav.response.status, 503, "換頁");
    equal(nav.nextCalls, 0, "換頁不能放行");
    const sub = await run(env, subresource("/app.js", "", "script"));
    equal(sub.response.status, 503, "子資源");
    equal(sub.nextCalls, 0, "子資源不能放行");
  }
  const publicPage = await run({}, navigation("/login"));
  equal(publicPage.response.status, 200, "登入頁本身仍可開啟");
});

await check("有效通行證：放行並保留內容，剛簽發的不重發", async () => {
  const token = await auth.issueToken(ENV);
  const { response, nextCalls } = await run(ENV, navigation("/rebar", token));
  equal(response.status, 200, "status");
  equal(nextCalls, 1, "next");
  equal(await response.text(), "<html>工具頁</html>", "內容");
  equal(response.headers.get("Set-Cookie"), null, "不該重發");
});

await check("通行證超過 1 天沒續期：換頁時重發一張新的 90 天通行證", async () => {
  const old = await auth.issueToken(ENV, Math.floor(Date.now() / 1000) - 2 * DAY);
  const { response } = await run(ENV, navigation("/rebar", old));
  const setCookie = response.headers.get("Set-Cookie") || "";
  assert(setCookie.startsWith(`${auth.COOKIE_NAME}=v1.`), `沒有重發：${setCookie}`);
  assert(setCookie.includes("Max-Age=7776000"), "要重發 90 天");
  const fresh = setCookie.split(";")[0].split("=").slice(1).join("=");
  const result = await auth.checkToken(ENV, fresh);
  equal(result.valid, true, "新通行證有效");
  equal(result.renew, false, "新通行證不需續期");
  equal(response.headers.get("Cache-Control"), "private, no-cache", "重發時不能被共用快取存起來");
});

await check("需要續期但請求的是子資源：不重發", async () => {
  const old = await auth.issueToken(ENV, Math.floor(Date.now() / 1000) - 2 * DAY);
  const { response } = await run(ENV, subresource("/app.css", old));
  equal(response.status, 200, "status");
  equal(response.headers.get("Set-Cookie"), null, "子資源不該發 Cookie");
});

await check("竄改過、過期、換密碼後的舊通行證，都當成沒登入", async () => {
  const good = await auth.issueToken(ENV);
  const tampered = `${good.slice(0, -2)}${good.endsWith("AA") ? "BB" : "AA"}`;
  const expired = await auth.issueToken(ENV, Math.floor(Date.now() / 1000) - auth.SESSION_SECONDS - DAY);
  const changed = { ...ENV, AUTH_PASSWORD: "a different password 456" };
  for (const [label, env, token] of [["竄改", ENV, tampered], ["過期", ENV, expired], ["換密碼", changed, good]]) {
    const { response, nextCalls } = await run(env, navigation("/rebar", token));
    equal(response.status, 302, label);
    equal(nextCalls, 0, `${label} 不能放行`);
  }
});

await check("對外展示版的部署說明要求先 cd 進輸出資料夾（否則 wrangler 會把 functions/ 一起打包，展示版被登入門檻鎖住）", () => {
  const doc = readFileSync(path.join(ROOT, "scripts", "build_share.py"), "utf8");
  assert(doc.includes("cd share/diaphragm-wall"), "說明沒有要求先 cd 進輸出資料夾");
  assert(!/wrangler pages deploy share\//.test(doc), "仍然寫著在專案根目錄部署 share/");
});

// ---- section: 登入與登出 API ----
const login = await import("../functions/api/login.js");
const logout = await import("../functions/api/logout.js");

const post = (fields, { json = false } = {}) => new Request("https://example.test/api/login", {
  method: "POST",
  headers: json ? { Accept: "application/json" } : {},
  body: new URLSearchParams(fields)
});
const attempt = (fields, options, env = ENV) => login.onRequestPost({ request: post(fields, options), env });
const good = (extra = {}) => ({ username: ENV.AUTH_USER, password: ENV.AUTH_PASSWORD, next: "/rebar", ...extra });

await check("JSON 模式帳密正確：200＋通行證＋next，而且不延遲", async () => {
  const started = Date.now();
  const response = await attempt(good(), { json: true });
  assert(Date.now() - started < 500, "成功不該等待");
  equal(response.status, 200, "status");
  assert((response.headers.get("Content-Type") || "").includes("application/json"), "Content-Type");
  equal(response.headers.get("Cache-Control"), "no-store", "Cache-Control");
  const body = await response.json();
  equal(body.ok, true, "ok");
  equal(body.next, "/rebar", "next");
  const token = response.headers.get("Set-Cookie").split(";")[0].split("=").slice(1).join("=");
  equal((await auth.checkToken(ENV, token)).valid, true, "通行證有效");
});

await check("表單模式帳密正確：303 回到 next 並發通行證", async () => {
  const response = await attempt(good());
  equal(response.status, 303, "status");
  equal(response.headers.get("Location"), "/rebar", "Location");
  assert((response.headers.get("Set-Cookie") || "").startsWith(`${auth.COOKIE_NAME}=v1.`), "Set-Cookie");
});

await check("帳號或密碼錯誤：JSON 回 401、表單回 303 帶 e=1，都不發通行證，而且固定等約 1 秒", async () => {
  const started = Date.now();
  const [badPassword, badUser, form, junk] = await Promise.all([
    attempt(good({ password: "wrong" }), { json: true }),
    attempt(good({ username: "nobody" }), { json: true }),
    attempt(good({ password: "wrong" })),
    login.onRequestPost({ request: new Request("https://example.test/api/login", { method: "POST", headers: { "Content-Type": "text/plain", Accept: "application/json" }, body: "not a form" }), env: ENV })
  ]);
  const elapsed = Date.now() - started;
  assert(elapsed >= auth.LOGIN_DELAY_MS - 50, `只等了 ${elapsed}ms`);
  for (const [label, response] of [["密碼錯", badPassword], ["帳號錯", badUser], ["不是表單", junk]]) {
    equal(response.status, 401, label);
    equal((await response.json()).ok, false, `${label} ok`);
    equal(response.headers.get("Set-Cookie"), null, `${label} 不該發 Cookie`);
  }
  equal(form.status, 303, "表單 status");
  equal(form.headers.get("Location"), "/login?e=1&next=%2Frebar#login-error", "表單 Location");
  equal(form.headers.get("Set-Cookie"), null, "表單不該發 Cookie");
});

await check("密碼含中文與空白也能登入", async () => {
  const env = { ...ENV, AUTH_USER: "現場人員", AUTH_PASSWORD: "安全第一 safety 2026!" };
  const response = await attempt({ username: "現場人員", password: "安全第一 safety 2026!", next: "/" }, { json: true }, env);
  equal(response.status, 200);
});

await check("惡意的 next 一律改回首頁", async () => {
  for (const next of ["//evil.example", "/\\evil.example", "https://evil.example", "/login", "/api/logout", "/a\r\nSet-Cookie: x=1"]) {
    const json = await (await attempt(good({ next }), { json: true })).json();
    equal(json.next, "/", `JSON ${JSON.stringify(next)}`);
    equal((await attempt(good({ next }))).headers.get("Location"), "/", `表單 ${JSON.stringify(next)}`);
  }
});

await check("Secrets 沒設好時登入 API 回 503，不發通行證", async () => {
  for (const env of [{}, { ...ENV, SESSION_SECRET: "short" }]) {
    const json = await attempt(good(), { json: true }, env);
    equal(json.status, 503, "JSON");
    equal(json.headers.get("Set-Cookie"), null, "JSON Cookie");
    const form = await attempt(good(), {}, env);
    equal(form.status, 503, "表單");
    equal(form.headers.get("Set-Cookie"), null, "表單 Cookie");
  }
});

await check("登出：303 回登入頁並讓通行證立刻過期", async () => {
  const response = logout.onRequestPost();
  equal(response.status, 303, "status");
  equal(response.headers.get("Location"), "/login", "Location");
  assert((response.headers.get("Set-Cookie") || "").includes("Max-Age=0"), "Max-Age=0");
});

// ---- section: 登入頁的檔案 ----
await check("登入頁自己用到的檔案都在白名單裡，而且真的存在", () => {
  const html = readFileSync(path.join(ROOT, "login.html"), "utf8");
  const refs = [...new Set([...html.matchAll(/(?:href|src)="\.\/([^"#?]+)"/g)].map(match => `/${match[1]}`))];
  assert(refs.length >= 6, `只找到 ${refs.length} 個引用`);
  for (const ref of refs) {
    assert(auth.isPublicPath(ref), `${ref} 不在白名單，登入頁會缺檔`);
    assert(existsSync(path.join(ROOT, ref.slice(1))), `${ref} 檔案不存在`);
  }
  assert(/action="\/api\/login"/.test(html), "表單 action 不是 /api/login");
});

// ---- section: Service Worker 不能把未登入的回應存進快取 ----
function loadServiceWorker(fetchImpl) {
  const listeners = {};
  const puts = [];
  const caches = {
    open: async () => ({ put: async (request, response) => { puts.push(typeof request === "string" ? request : request.url); }, addAll: async () => {}, keys: async () => [], delete: async () => true }),
    match: async () => undefined,
    keys: async () => [],
    delete: async () => true
  };
  const self = {
    addEventListener: (type, listener) => { listeners[type] = listener; },
    registration: { scope: "https://example.test/" },
    location: { origin: "https://example.test" },
    skipWaiting: () => {},
    clients: { claim: async () => {} }
  };
  vm.runInNewContext(readFileSync(path.join(ROOT, "sw.js"), "utf8"), { self, caches, fetch: fetchImpl, URL, Request, Response });
  return { listeners, puts };
}

// 模擬 fetch 回來的各種回應：redirected 是 fetch 跟著轉址後的標記；opaqueredirect 是換頁請求遇到 302 時的樣子。
function fakeResponse({ status = 200, redirected = false, opaqueRedirect = false } = {}) {
  const response = new Response(opaqueRedirect ? null : "body", { status });
  Object.defineProperty(response, "redirected", { value: redirected });
  if (opaqueRedirect) {
    Object.defineProperty(response, "ok", { value: false });
    Object.defineProperty(response, "type", { value: "opaqueredirect" });
  }
  return response;
}

// 回傳 { handled, puts }：handled 為 false 表示 Service Worker 沒接手（交給網路）。
async function swFetch(url, mode, response) {
  const sw = loadServiceWorker(async () => response);
  let responded = null;
  sw.listeners.fetch({ request: { method: "GET", url, mode }, respondWith: promise => { responded = Promise.resolve(promise); } });
  if (responded) await responded;
  return { handled: Boolean(responded), puts: sw.puts };
}

await check("換頁：正常回應照舊快取", async () => {
  const { handled, puts } = await swFetch("https://example.test/rebar", "navigate", fakeResponse());
  assert(handled, "應該由 Service Worker 處理");
  equal(puts.length, 1, "快取次數");
});

await check("換頁：被轉址過的 200（登入頁冒充工具頁）、302、401 都不能存進快取", async () => {
  for (const [label, response] of [["跟隨轉址的 200", fakeResponse({ redirected: true })], ["opaqueredirect", fakeResponse({ opaqueRedirect: true })], ["401", fakeResponse({ status: 401 })]]) {
    const { puts } = await swFetch("https://example.test/rebar", "navigate", response);
    equal(puts.length, 0, label);
  }
});

await check("子資源：正常回應照舊快取，被轉址過的回應（登入頁冒充 app.css）不能快取", async () => {
  equal((await swFetch("https://example.test/app.css", "no-cors", fakeResponse())).puts.length, 1, "正常");
  equal((await swFetch("https://example.test/app.css", "no-cors", fakeResponse({ redirected: true }))).puts.length, 0, "被轉址");
  equal((await swFetch("https://example.test/app.css", "no-cors", fakeResponse({ status: 401 }))).puts.length, 0, "401");
});

await check("登入頁與登入 API 不經過 Service Worker", async () => {
  for (const pathname of ["/login", "/login.js", "/login.css", "/api/login", "/api/logout"]) {
    const { handled } = await swFetch(`https://example.test${pathname}`, pathname === "/login" ? "navigate" : "no-cors", fakeResponse());
    assert(!handled, `${pathname} 不該由 Service Worker 處理`);
  }
});

// ---- end of sections ----
console.log(failures ? `\n${failures} 項失敗` : "\n全部通過");
process.exit(failures ? 1 : 0);
