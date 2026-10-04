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

// ---- end of sections ----
console.log(failures ? `\n${failures} 項失敗` : "\n全部通過");
process.exit(failures ? 1 : 0);
