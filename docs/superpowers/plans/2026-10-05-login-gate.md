# 登入門檻 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 沒有登入的人打開 Portable Inspection 的任何網址，都先看到「工地大門」登入頁；登入一次後這支手機 90 天內不必再登入，離線仍可用。

**Architecture:** Cloudflare Pages Functions 的全站門房（`functions/_middleware.js`）檢查用 HMAC 簽章的 HttpOnly 通行證；`/api/login` 比對 Cloudflare 加密變數裡的共用帳密並發通行證；登入頁是靜態 HTML／CSS／JS，閘門場景用行內 SVG 加 CSS 狀態呈現。`sw.js` 調整為絕不把未登入的回應存進快取。所有邏輯放在不依賴 Cloudflare 物件的純函式，用 `node` 直接測。

**Tech Stack:** Cloudflare Pages Functions（Web Crypto，無資料庫）、原生 HTML／CSS／JavaScript、node 22（`scripts/verify_auth.mjs`）、Python Playwright 加本機 Chrome（`scripts/verify_login_page.py`、`scripts/verify_gate_e2e.py`）、`wrangler pages dev`（本機端到端）。

**Spec:** `docs/superpowers/specs/2026-10-04-login-gate-design.md`。產品脈絡：`PRODUCT.md`。登入頁設計契約：`.impeccable/surfaces/login-html.md`（開發用，不進任何送到瀏覽器的檔案）。

## Global Constraints

・ 通行證 Cookie：名稱 `__Host-pi_auth`；`Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=7776000`；不設 `Domain`。
・ 通行證有效 90 天；有效且超過 1 天沒續期時，只在「換頁」請求上重發。
・ 簽章 = HMAC-SHA256(`SESSION_SECRET`, `"v1." + 到期 + "." + 密碼指紋`)，base64url；密碼指紋 = SHA-256(`AUTH_USER` + `:` + `AUTH_PASSWORD`) 前 16 個十六進位字元。
・ 帳密錯誤固定先等 1 秒（`LOGIN_DELAY_MS = 1000`）；帳密正確不延遲。
・ Cloudflare 加密變數 `AUTH_USER`、`AUTH_PASSWORD`、`SESSION_SECRET`（至少 32 字元），Production 與 Preview 都要設；缺任何一個一律回 503，絕不放行。
・ 不建立 `_routes.json`：被排除的路徑不會經過門房，等於沒上鎖。
・ 全站 CSP 是 `default-src 'self'; … script-src 'self'; style-src 'self'`：新增的 HTML 不可有內嵌 `<script>`、`<style>`、`style=""`。
・ 輸入控制項 16px、觸控目標至少 44px；固定淺色；不加漸層、不新增顏色，只用 `glass.css` 的 tokens。
・ 網址不帶副檔名：連結寫 `./login`、`/api/login`，不寫 `.html`。
・ 會被快取的檔案有改動，`sw.js` 的 `CACHE_NAME` 要升版：`v139` → `v140`（整個功能只升這一次，在 Task 5）。
・ 文案用繁體中文（台灣用語）。
・ 密碼與金鑰不得寫進 repo、聊天或網址；本機測試用的假值除外（見 Task 6）。
・ 在 Task 9 之前不得推送到 `main`（`main` 會自動部署到正式站）。
・ 只用 `git add <明確檔案>`。工作目錄裡有與本功能無關的未提交變更（`.gitignore`、`.claude/`、`.wrangler/`、`docs/qr/`、`Steel Bar Example.jpg`、`PRODUCT.md`、`.impeccable/`），不得一起提交。
・ 提交訊息結尾加 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`。
・ 所有指令在專案根目錄執行。

## Review Focus

這些是設計文件沒明說、但最可能讓使用者踩到的情況；每一項都有對應的測試。

1. **登出或通行證過期後，CSS／JS 被導去登入頁，Service Worker 把登入頁存成 `app.css`，整站排版壞掉。** 預期：子資源回 401 純文字，Service Worker 不快取被轉址或非 2xx 的回應。測試：Task 2「未登入的 CSS／JS／sw.js 回 401」、Task 5 的四項 Service Worker 測試、Task 6 的「快取裡的 app.css 還是 CSS」。
2. **Service Worker 代為重抓換頁時（`Sec-Fetch-Dest: empty`、`Sec-Fetch-Mode: navigate`）被當成子資源，使用者看到一行純文字「需要登入」，而不是登入頁。** 規劃時在真實 Chrome 加真實 Cloudflare 執行環境才重現，單看標頭 `Dest` 的直覺寫法會漏。測試：Task 1「isNavigation」、Task 2「Service Worker 代為重抓的換頁」、Task 6「畫面是登入頁，不是一行純文字」。
3. **登入頁自己要用的檔案被門房擋掉**（尤其 `manifest.webmanifest`：瀏覽器抓它不帶 Cookie）。預期：登入頁引用的每個檔案都在白名單裡，而且真的存在。測試：Task 4「登入頁自己用到的檔案都在白名單裡」。
4. **Secrets 沒設或 `SESSION_SECRET` 太短時網站放行。** 預期：門房與登入 API 一律回 503。測試：Task 2、Task 3 的 503 項目。
5. **惡意的 `next`（`//evil.example`、`/\evil.example`、含換行、`/login` 造成迴圈）與換密碼後的舊通行證。** 預期：`next` 改回 `/`；換密碼、換帳號、換金鑰後舊通行證立刻失效；竄改或過期的通行證無效。測試：Task 1、Task 3。

另外有兩件只能人工確認，已排進 Task 8：iPhone 的 Safari 與「加到主畫面」App 的登入互不共用；從 LINE 內建瀏覽器開啟連結時，通行證是否留得住。

## File Structure

| 檔案 | 動作 | 職責 |
| --- | --- | --- |
| `functions/_lib/auth.js` | 新增 | 通行證簽發／驗證、定時比對、`next` 驗證、請求分類、白名單。不依賴 Cloudflare 物件。 |
| `functions/_middleware.js` | 新增 | 全站門房。 |
| `functions/api/login.js` | 新增 | `POST /api/login`。 |
| `functions/api/logout.js` | 新增 | `POST /api/logout`。 |
| `login.html`、`login.css`、`login.js` | 新增 | 登入頁（工地大門）。 |
| `sw.js` | 修改 | 升版到 v140；登入頁與 API 不經 Service Worker；不快取被轉址的回應。 |
| `index.html`、`portal.css` | 修改 | 首頁右上「登出」按鈕。 |
| `scripts/build_share.py` | 修改 | 部署說明改成先 `cd` 進輸出資料夾。 |
| `scripts/verify_auth.mjs` | 新增 | 純函式、門房、API、Service Worker 的 node 檢查。 |
| `scripts/verify_login_page.py` | 新增 | 登入頁的 headless Chrome 檢查。 |
| `scripts/verify_gate_e2e.py` | 新增 | 對 `wrangler pages dev` 的端到端檢查。 |
| `README.md`、`.nojekyll` | 修改／刪除 | Task 9：文件更新、移除 GitHub Pages 殘留。 |


---

### Task 1: 分支與通行證核心

**Files:**
- Create: `functions/_lib/auth.js`
- Create: `scripts/verify_auth.mjs`

**Interfaces:**
- Consumes: 無。
- Produces（`functions/_lib/auth.js` 的匯出，後續各 Task 直接使用這些名稱）：
  - 常數：`COOKIE_NAME`、`SESSION_SECONDS`（7776000）、`RENEW_AFTER_SECONDS`（86400）、`LOGIN_DELAY_MS`（1000）、`PUBLIC_PATHS`（`Set<string>`）
  - `sleep(ms): Promise<void>`
  - `safeEqual(a, b): Promise<boolean>`
  - `isConfigured(env): boolean`
  - `issueToken(env, nowSeconds?): Promise<string>`
  - `checkToken(env, token, nowSeconds?): Promise<{ valid: boolean, renew: boolean }>`
  - `readCookie(request, name?): string`
  - `sessionCookie(token): string`、`clearedCookie(): string`
  - `safeNext(value): string`
  - `isNavigation(request): boolean`
  - `isPublicPath(pathname): boolean`

- [ ] **Step 1: 建立功能分支，確認 node 版本**

```bash
git switch -c feature/login-gate
node --version
```

Expected: `Switched to a new branch 'feature/login-gate'`；node 為 `v22` 以上（目前是 `v22.22.3`）。未提交的變更會跟著留在工作目錄，不用處理。

- [ ] **Step 2: 寫會失敗的測試**

建立 `scripts/verify_auth.mjs`。之後的 Task 會在標記行 `// ---- end of sections ----` **之前**插入新的測試區段，標記行本身不要刪。

```javascript
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
```

- [ ] **Step 3: 執行，確認失敗**

```bash
node scripts/verify_auth.mjs
```

Expected: 失敗並結束，訊息含 `ERR_MODULE_NOT_FOUND`、`Cannot find module '…/functions/_lib/auth.js'`。

- [ ] **Step 4: 實作 `functions/_lib/auth.js`**

```javascript
// 登入門檻的純函式：通行證簽發／驗證、定時比對、next 驗證、請求分類。
// 只用 Web Crypto 與標準的 Request／Response，Cloudflare Pages Functions 與 node 22 都能直接執行
// （scripts/verify_auth.mjs 就是用 node 跑的）。

export const COOKIE_NAME = "__Host-pi_auth";
export const SESSION_SECONDS = 90 * 24 * 60 * 60; // 通行證 90 天
export const RENEW_AFTER_SECONDS = 24 * 60 * 60; // 超過 1 天沒續期就在下一次換頁時重發
export const LOGIN_DELAY_MS = 1000; // 帳密錯誤時固定等這麼久，是唯一的暴力猜測防護

// 不需要登入的路徑：登入頁本身、登入頁用到的樣式與圖示、manifest（瀏覽器抓它不帶 Cookie）、robots。
export const PUBLIC_PATHS = new Set([
  "/login",
  "/login.css",
  "/login.js",
  "/api/login",
  "/glass.css",
  "/portal.css",
  "/app-icon-144.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/robots.txt"
]);

const encoder = new TextEncoder();

const toHex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");

const toBase64Url = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// 兩邊先各自雜湊成固定長度再逐位元組比，比對時間不會洩漏「對了幾個字」。
export async function safeEqual(a, b) {
  const [x, y] = await Promise.all([sha256(String(a)), sha256(String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i += 1) diff |= x[i] ^ y[i];
  return diff === 0;
}

// 三個 Secrets 都要有，而且簽章金鑰至少 32 個字元；缺一個就當成「尚未設定」，門房會回 503 而不是放行。
export function isConfigured(env) {
  return Boolean(env && env.AUTH_USER && env.AUTH_PASSWORD && env.SESSION_SECRET && String(env.SESSION_SECRET).length >= 32);
}

// 密碼指紋：簽進通行證裡，換帳號或密碼後所有舊通行證立刻失效（員工離職時換密碼即可）。
async function fingerprint(env) {
  return toHex(await sha256(`${env.AUTH_USER}:${env.AUTH_PASSWORD}`)).slice(0, 16);
}

async function sign(env, expires) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const message = `v1.${expires}.${await fingerprint(env)}`;
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message))));
}

export async function issueToken(env, nowSeconds = Math.floor(Date.now() / 1000)) {
  const expires = nowSeconds + SESSION_SECONDS;
  return `v1.${expires}.${await sign(env, expires)}`;
}

// valid：簽章正確且未到期。renew：距離上次續期已超過 RENEW_AFTER_SECONDS，該重發一張新的。
export async function checkToken(env, token, nowSeconds = Math.floor(Date.now() / 1000)) {
  const invalid = { valid: false, renew: false };
  if (typeof token !== "string") return invalid;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^\d{1,12}$/.test(parts[1])) return invalid;
  const expires = Number(parts[1]);
  if (expires <= nowSeconds) return invalid;
  if (!(await safeEqual(await sign(env, expires), parts[2]))) return invalid;
  return { valid: true, renew: expires - nowSeconds < SESSION_SECONDS - RENEW_AFTER_SECONDS };
}

export function readCookie(request, name = COOKIE_NAME) {
  for (const part of (request.headers.get("Cookie") || "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return "";
}

// __Host- 前綴要求 Secure、Path=/、不設 Domain；HttpOnly 讓網頁程式碼讀不到。
export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Path=/; Max-Age=${SESSION_SECONDS}; Secure; HttpOnly; SameSite=Lax`;
}

export function clearedCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`;
}

// 登入後要回去的頁面只接受站內路徑：單一 / 開頭，不是 //、/\，沒有換行，也不是登入相關路徑（避免繞圈）。
export function safeNext(value) {
  const ok = typeof value === "string"
    && /^\/(?![/\\])[^\r\n]*$/.test(value)
    && !/^\/(login|api\/)/.test(value);
  return ok ? value : "/";
}

// 「換頁」請求才導向登入頁；CSS、JS、圖片這類子資源一律回 401（回登入頁會被 Service Worker 當成 app.css 存起來）。
// Service Worker 代為重抓換頁時，Sec-Fetch-Dest 會變成 empty，但 Sec-Fetch-Mode 仍是 navigate，所以先看 Mode。
export function isNavigation(request) {
  const { headers } = request;
  if (headers.get("Sec-Fetch-Mode") === "navigate") return true;
  const dest = headers.get("Sec-Fetch-Dest");
  if (dest) return dest === "document";
  return request.method === "GET" && (headers.get("Accept") || "").includes("text/html");
}

export const isPublicPath = pathname => PUBLIC_PATHS.has(pathname);
```

- [ ] **Step 5: 執行，確認通過**

```bash
node scripts/verify_auth.mjs
```

Expected: 13 行 `✅`，最後一行 `全部通過`，結束碼 0。

- [ ] **Step 6: 提交**

```bash
git add functions/_lib/auth.js scripts/verify_auth.mjs
git commit -m "Add the login token helpers and their checks" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```


---

### Task 2: 全站門房

**Files:**
- Create: `functions/_middleware.js`
- Modify: `scripts/verify_auth.mjs`（插入「門房」區段）
- Modify: `scripts/build_share.py`（部署說明）

**Interfaces:**
- Consumes: Task 1 的 `checkToken`、`isConfigured`、`isNavigation`、`isPublicPath`、`issueToken`、`readCookie`、`sessionCookie`。
- Produces: `onRequest(context): Promise<Response>`（Cloudflare Pages 的全站中介層；`context` 為 `{ request, env, next }`）。

- [ ] **Step 1: 寫會失敗的測試**

把下面整段貼到 `scripts/verify_auth.mjs` 的 `// ---- end of sections ----` **之前**。最後一項測試檢查 `scripts/build_share.py` 的部署說明（原因：wrangler 會把「目前資料夾」底下的 `functions/` 一起打包，在專案根目錄部署對外展示版會被登入門檻鎖住，已實測）。

```javascript
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
```

- [ ] **Step 2: 執行，確認失敗**

```bash
node scripts/verify_auth.mjs
```

Expected: 失敗並結束，訊息含 `ERR_MODULE_NOT_FOUND`、`Cannot find module '…/functions/_middleware.js'`。

- [ ] **Step 3: 實作 `functions/_middleware.js`**

```javascript
// 全站門房：每個請求先經過這裡。流程見 docs/superpowers/specs/2026-10-04-login-gate-design.md 第一節。
import { checkToken, isConfigured, isNavigation, isPublicPath, issueToken, readCookie, sessionCookie } from "./_lib/auth.js";

const TEXT = "text/plain; charset=utf-8";

// _headers 設定的 no-cache 不保證套用到 context.next() 回來的回應，這兩個檔案直接在這裡補上：
// sw.js 與 manifest 每次都要向伺服器驗證，手機才會立刻拿到新版。
const NO_CACHE_PATHS = new Set(["/sw.js", "/manifest.webmanifest"]);

async function serve(context, url) {
  const response = await context.next();
  const copy = new Response(response.body, response); // 複製一份才改得了標頭
  if (NO_CACHE_PATHS.has(url.pathname)) copy.headers.set("Cache-Control", "no-cache");
  return copy;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (isPublicPath(url.pathname)) return serve(context, url);

  // Secrets 沒設好時一律擋住，絕不放行。
  if (!isConfigured(env)) {
    return new Response("登入尚未設定完成，請聯絡管理員。", { status: 503, headers: { "Content-Type": TEXT, "Cache-Control": "no-store" } });
  }

  const { valid, renew } = await checkToken(env, readCookie(request));
  if (valid) {
    const response = await serve(context, url);
    if (renew && isNavigation(request)) {
      response.headers.append("Set-Cookie", sessionCookie(await issueToken(env)));
      response.headers.set("Cache-Control", "private, no-cache");
    }
    return response;
  }

  if (isNavigation(request)) {
    const next = new URLSearchParams({ next: url.pathname + url.search });
    return new Response(null, { status: 302, headers: { Location: `/login?${next}`, "Cache-Control": "no-store" } });
  }
  return new Response("需要登入", { status: 401, headers: { "Content-Type": TEXT, "Cache-Control": "no-store" } });
}
```

- [ ] **Step 4: 執行，預期只剩部署說明那一項失敗**

```bash
node scripts/verify_auth.mjs
```

Expected: 23 行 `✅`、1 行 `❌ 對外展示版的部署說明要求先 cd 進輸出資料夾…`，結尾 `1 項失敗`。

- [ ] **Step 5: 修正 `scripts/build_share.py` 的部署說明**

**修改 `scripts/build_share.py`**（檔案開頭的說明文字）：把

```
    python3 scripts/build_share.py
    npx wrangler pages deploy share/diaphragm-wall --project-name <專案名稱>
```

換成

```
    python3 scripts/build_share.py
    cd share/diaphragm-wall && npx wrangler pages deploy . --project-name <專案名稱>

※ 一定要先 cd 進輸出資料夾再部署。wrangler 會把「目前資料夾」底下的 functions/（正式站的登入門房）一起打包，
  在專案根目錄部署的話，對外展示版會被登入門檻擋住。
```

- [ ] **Step 6: 執行，確認全部通過**

```bash
node scripts/verify_auth.mjs
```

Expected: 24 行 `✅`，最後一行 `全部通過`。

- [ ] **Step 7: 提交**

```bash
git add functions/_middleware.js scripts/verify_auth.mjs scripts/build_share.py
git commit -m "Add the site-wide gatekeeper and fix the share build deploy note" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```


---

### Task 3: 登入與登出 API

**Files:**
- Create: `functions/api/login.js`
- Create: `functions/api/logout.js`
- Modify: `scripts/verify_auth.mjs`（插入「登入與登出 API」區段）

**Interfaces:**
- Consumes: Task 1 的 `LOGIN_DELAY_MS`、`isConfigured`、`issueToken`、`safeEqual`、`safeNext`、`sessionCookie`、`sleep`、`clearedCookie`。
- Produces:
  - `POST /api/login`，表單欄位 `username`、`password`、`next`。請求帶 `Accept: application/json` 時：成功 `200 {"ok":true,"next":"…"}`＋`Set-Cookie`、帳密錯 `401 {"ok":false}`、未設定 `503 {"ok":false}`。否則：成功 `303 → next`＋`Set-Cookie`、帳密錯 `303 → /login?e=1&next=…#login-error`、未設定 `503` 純文字。Task 4 的 `login.js` 依賴這個 JSON 契約。
  - `POST /api/logout`：`303 → /login`＋讓通行證立刻過期。

- [ ] **Step 1: 寫會失敗的測試**

貼到 `// ---- end of sections ----` **之前**。

```javascript
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
```

- [ ] **Step 2: 執行，確認失敗**

```bash
node scripts/verify_auth.mjs
```

Expected: 失敗並結束，訊息含 `ERR_MODULE_NOT_FOUND`、`Cannot find module '…/functions/api/login.js'`。

- [ ] **Step 3: 實作兩支 API**

`functions/api/login.js`：

```javascript
// POST /api/login：比對帳密、發通行證。
// 登入頁的 JavaScript 送 Accept: application/json 拿 JSON；沒有 JavaScript 的一般表單走 303 轉址。
import { LOGIN_DELAY_MS, isConfigured, issueToken, safeEqual, safeNext, sessionCookie, sleep } from "../_lib/auth.js";

const JSON_TYPE = "application/json; charset=utf-8";
const TEXT_TYPE = "text/plain; charset=utf-8";

const wantsJson = request => (request.headers.get("Accept") || "").includes("application/json");

export async function onRequestPost({ request, env }) {
  const json = wantsJson(request);

  if (!isConfigured(env)) {
    return json
      ? new Response(JSON.stringify({ ok: false }), { status: 503, headers: { "Content-Type": JSON_TYPE, "Cache-Control": "no-store" } })
      : new Response("登入尚未設定完成，請聯絡管理員。", { status: 503, headers: { "Content-Type": TEXT_TYPE, "Cache-Control": "no-store" } });
  }

  const form = await request.formData().catch(() => null);
  const username = String(form?.get("username") ?? "");
  const password = String(form?.get("password") ?? "");
  const next = safeNext(form?.get("next"));

  const [userOk, passwordOk] = await Promise.all([safeEqual(username, env.AUTH_USER), safeEqual(password, env.AUTH_PASSWORD)]);
  if (!(userOk && passwordOk)) {
    await sleep(LOGIN_DELAY_MS);
    if (json) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": JSON_TYPE, "Cache-Control": "no-store" } });
    return new Response(null, { status: 303, headers: { Location: `/login?e=1&next=${encodeURIComponent(next)}#login-error`, "Cache-Control": "no-store" } });
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", sessionCookie(await issueToken(env)));
  if (json) {
    headers.set("Content-Type", JSON_TYPE);
    return new Response(JSON.stringify({ ok: true, next }), { status: 200, headers });
  }
  headers.set("Location", next);
  return new Response(null, { status: 303, headers });
}
```

`functions/api/logout.js`：

```javascript
// POST /api/logout：清掉通行證，回登入頁。
import { clearedCookie } from "../_lib/auth.js";

export function onRequestPost() {
  return new Response(null, { status: 303, headers: { Location: "/login", "Set-Cookie": clearedCookie(), "Cache-Control": "no-store" } });
}
```

- [ ] **Step 4: 執行，確認通過**

```bash
node scripts/verify_auth.mjs
```

Expected: 31 行 `✅`，最後一行 `全部通過`。帳密錯誤那一項會花約 1 秒。

- [ ] **Step 5: 提交**

```bash
git add functions/api/login.js functions/api/logout.js scripts/verify_auth.mjs
git commit -m "Add the login and logout endpoints" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```


---

### Task 4: 登入頁（工地大門）

**Files:**
- Create: `login.html`、`login.css`、`login.js`
- Create: `scripts/verify_login_page.py`
- Modify: `scripts/verify_auth.mjs`（插入「登入頁的檔案」區段）

**Interfaces:**
- Consumes: Task 3 的 `POST /api/login` JSON 契約（`200 {ok:true,next}`／`401`／`503`）；`glass.css`、`portal.css` 的 tokens 與 `.portal-shell`、`.portal-header`、`.brand`（登入頁不另外定義色彩）；`glass.css` 的 `.field input:focus` 旋轉光環。
- Produces: `/login` 頁面。測試依賴的 DOM 契約：`#gate-stage[data-state="idle|checking|denied|open"]`、`#login-form`（`action="/api/login"`、`method="post"`）、`input[name=next]`、`#login-username`、`#login-password`、`.password-toggle`、`#login-error`（顯示時帶 `.is-visible`）、`#login-submit`、`#login-status`、`.gate-arm`、`.gate-halo`。

設計脈絡：這是 portal 既有視覺世界裡的新頁面，不另起風格。主題是工地大門：柵欄桿預設放下、警示燈亮紅；登入成功桿子升起、燈轉綠；帳密錯誤桿子撞兩下彈回。登入頁的設計契約在 `.impeccable/surfaces/login-html.md`。

- [ ] **Step 1: 寫瀏覽器檢查**

建立 `scripts/verify_login_page.py`（標記行 `# ---- end of checks ----` 留著，Task 5 會在它之前插入首頁登出鈕的檢查）：

```python
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
        context.close()

        # ---- 帳密錯誤：確認中 → 被擋下 → 回到鎖著 ----
        context, page, _ = open_login(browser)
        held = []
        page.route("**/api/login", lambda route: held.append(route))
        fill(page, "staff", "wrong")
        page.click("#login-submit")
        page.wait_for_function("() => document.getElementById('gate-stage').dataset.state === 'checking'")
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

        # ---- end of checks ----
        browser.close()
finally:
    server.terminate()

print("\n" + (f"{len(failures)} 項失敗" if failures else "全部通過"))
sys.exit(1 if failures else 0)
```

- [ ] **Step 2: 插入「登入頁的檔案」測試並執行 node 檢查，確認失敗**

把下面貼到 `scripts/verify_auth.mjs` 的 `// ---- end of sections ----` **之前**：

```javascript
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
```

```bash
node scripts/verify_auth.mjs
```

Expected: 其餘 31 項 `✅`，這一項 `❌ 登入頁自己用到的檔案都在白名單裡，而且真的存在`，訊息含 `ENOENT`、`login.html`，結尾 `1 項失敗`。

- [ ] **Step 3: 執行瀏覽器檢查，確認失敗**

```bash
python3 scripts/verify_login_page.py
```

Expected: 約 30 秒後以 Playwright `TimeoutError` 結束（找不到 `#login-form`），結束碼非 0。

- [ ] **Step 4: 實作登入頁**

`login.html`：

```html
<!doctype html>
<html lang="zh-Hant-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="description" content="Portable Inspection 登入" />
    <meta name="robots" content="noindex" />
    <meta name="referrer" content="no-referrer" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'" />
    <meta name="theme-color" content="#ffffff" />
    <link rel="icon" href="./app-icon-144.png" type="image/png" sizes="144x144" />
    <link rel="apple-touch-icon" href="./apple-touch-icon.png" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="stylesheet" href="./glass.css" />
    <link rel="stylesheet" href="./portal.css" />
    <link rel="stylesheet" href="./login.css" />
    <script src="./login.js" defer></script>
    <title>登入｜Portable Inspection</title>
  </head>
  <body>
    <main class="portal-shell login-shell">
      <header class="portal-header">
        <span class="brand">
          <img src="./apple-touch-icon.png" alt="" width="36" height="36" />
          <span>Portable Inspection</span>
        </span>
      </header>

      <div class="login-stage" id="gate-stage" data-state="idle">
        <svg class="gate" viewBox="0 -44 360 194" aria-hidden="true" focusable="false">
          <defs>
            <pattern id="gate-stripes" width="26" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="13" height="26" class="gate-stripe-a" />
              <rect x="13" width="13" height="26" class="gate-stripe-b" />
            </pattern>
          </defs>
          <path class="gate-ground" d="M8 132H352" />
          <path class="gate-road" d="M28 143H332" />
          <g transform="translate(178 132)">
            <path class="gate-line" d="M-14 -3C-14 -15 -7 -21 0 -21S14 -15 14 -3Z" />
            <rect class="gate-line" x="-3.5" y="-24" width="7" height="21" rx="3.5" />
            <rect class="gate-line" x="-22" y="-5" width="44" height="6" rx="3" />
          </g>
          <rect class="gate-line" x="298" y="94" width="16" height="38" rx="5" />
          <rect class="gate-line" x="290" y="86" width="32" height="9" rx="4.5" />
          <rect class="gate-line" x="36" y="62" width="36" height="70" rx="9" />
          <rect class="gate-slot" x="44" y="74" width="20" height="9" rx="3" />
          <circle class="gate-dot" cx="48" cy="98" r="2.2" />
          <circle class="gate-dot" cx="58" cy="98" r="2.2" />
          <circle class="gate-dot" cx="48" cy="108" r="2.2" />
          <circle class="gate-dot" cx="58" cy="108" r="2.2" />
          <rect class="gate-line" x="48" y="50" width="12" height="13" rx="3" />
          <circle class="gate-halo" cx="54" cy="40" r="17" />
          <circle class="gate-lamp" cx="54" cy="40" r="9" />
          <g class="gate-arm">
            <rect class="gate-arm-body" x="72" y="72" width="222" height="12" rx="6" fill="url(#gate-stripes)" />
          </g>
          <circle class="gate-line" cx="72" cy="78" r="6.5" />
        </svg>

        <section class="login-card" aria-labelledby="login-title">
          <h1 id="login-title">進場登記</h1>
          <p class="login-lede">本工具僅限公司同仁使用。</p>

          <form id="login-form" method="post" action="/api/login" novalidate>
            <input type="hidden" name="next" value="/" />
            <div class="field">
              <label for="login-username">帳號</label>
              <input id="login-username" name="username" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="next" required />
            </div>
            <div class="field">
              <label for="login-password">密碼</label>
              <div class="password-wrap">
                <input id="login-password" name="password" type="password" autocomplete="current-password" enterkeyhint="go" required />
                <button class="password-toggle" type="button" aria-pressed="false" aria-controls="login-password">顯示</button>
              </div>
            </div>
            <p class="login-error" id="login-error" role="alert">帳號或密碼不對，閘門沒開。再試一次。</p>
            <button class="login-submit" id="login-submit" type="submit">開門</button>
          </form>
          <p class="login-note">登入後，這支手機 90 天內不必再登入。</p>
        </section>
        <p class="visually-hidden" id="login-status" role="status" aria-live="polite"></p>
      </div>
    </main>
  </body>
</html>
```

`login.css`：

```css
/* 登入頁：工地大門。承接 portal 的白卡＋石板藍，只多一座閘門場景與四個狀態
   （data-state：idle 鎖著／checking 確認中／denied 被擋下／open 放行）。 */

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.login-shell {
  width: min(100% - 32px, 420px);
  padding-top: max(28px, calc(env(safe-area-inset-top) + 20px));
  padding-bottom: 48px;
}

@media (min-width: 720px) {
  .login-shell { padding-top: clamp(28px, 9vh, 96px); }
}

.login-stage { display: grid; margin-top: 4px; }

/* ---- 閘門場景 ------------------------------------------------------- */
.gate { display: block; width: 100%; height: auto; overflow: visible; }

.gate-line {
  fill: #fff;
  stroke: var(--glass-accent);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.gate-ground,
.gate-road {
  fill: none;
  stroke: var(--glass-dash);
  stroke-width: 2;
  stroke-linecap: round;
}
.gate-road { stroke-dasharray: 10 12; }

.gate-slot { fill: var(--glass-accent-soft); }
.gate-dot { fill: var(--glass-accent); opacity: 0.55; }
.gate-stripe-a { fill: var(--glass-accent); }
.gate-stripe-b { fill: #fff; }

.gate-arm-body {
  stroke: var(--glass-accent);
  stroke-width: 2.5;
  stroke-linejoin: round;
}

.gate-lamp {
  fill: var(--glass-danger);
  stroke: var(--glass-accent);
  stroke-width: 2.5;
  transition: fill 300ms ease;
}

.gate-halo {
  fill: var(--glass-danger);
  opacity: 0.2;
  transform-box: fill-box;
  transform-origin: center;
  animation: gate-pulse 2.4s ease-in-out infinite;
  transition: fill 300ms ease;
}

/* 桿子繞左柱的樞軸（72, 78）轉動，座標單位是 SVG 的 viewBox 單位。 */
.gate-arm {
  transform: rotate(0deg);
  transform-origin: 72px 78px;
  transition: transform 750ms cubic-bezier(0.2, 0.9, 0.25, 1);
}

[data-state="checking"] .gate-halo { animation-duration: 0.6s; }

[data-state="denied"] .gate-halo {
  animation: none;
  opacity: 0.45;
}

[data-state="denied"] .gate-arm { animation: gate-bump 0.55s cubic-bezier(0.3, 0.7, 0.4, 1); }

[data-state="open"] .gate-arm { transform: rotate(-35deg); }
[data-state="open"] .gate-lamp,
[data-state="open"] .gate-halo { fill: var(--glass-success); }
[data-state="open"] .gate-halo {
  animation: none;
  opacity: 0.3;
}

@keyframes gate-pulse {
  0%, 100% { opacity: 0.1; transform: scale(0.85); }
  50% { opacity: 0.42; transform: scale(1.15); }
}

/* 想往上抬卻被擋下：連撞兩下後落回原位 */
@keyframes gate-bump {
  0% { transform: rotate(0deg); }
  30% { transform: rotate(-11deg); }
  55% { transform: rotate(0deg); }
  75% { transform: rotate(-4deg); }
  100% { transform: rotate(0deg); }
}

/* ---- 登入卡 ----------------------------------------------------------- */
.login-card {
  margin-top: 8px;
  padding: 22px 20px 18px;
  border-radius: var(--glass-radius-lg);
  background: var(--glass-card-bg);
  box-shadow: var(--glass-card-shadow);
}

.login-card h1 {
  color: #000;
  font-size: 1.625rem;
  line-height: 1.15;
  letter-spacing: 0;
}

.login-lede {
  margin: 6px 0 20px;
  color: var(--glass-soft);
  font-size: 0.8125rem;
}

.login-card .field {
  display: grid;
  gap: 6px;
  margin-bottom: 14px;
}

.login-card .field label {
  color: var(--glass-label);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* 欄位基礎樣式比照其他頁（app.css 的 .field input）；聚焦時的旋轉光環來自 glass.css。 */
.login-card .field input {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: var(--glass-radius-sm);
  background-color: var(--glass-sunken);
  color: var(--glass-ink);
  font: inherit;
  font-size: 1rem;
}

.password-wrap { position: relative; }
.password-wrap input { padding-right: 68px; }

.password-toggle {
  position: absolute;
  top: 50%;
  right: 2px;
  min-width: 60px;
  min-height: 44px;
  transform: translateY(-50%);
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--glass-accent);
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
}
.password-toggle:hover { background: var(--glass-accent-soft); }

.login-error {
  display: none;
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: var(--glass-radius-sm);
  background: var(--glass-danger-bg);
  color: var(--glass-danger-ink);
  font-size: 0.8125rem;
  font-weight: 600;
  line-height: 1.45;
}

/* .is-visible 由 login.js 切換；:target 讓沒有 JavaScript 時，伺服器導回的 #login-error 也看得到訊息 */
.login-error.is-visible,
.login-error:target { display: block; }

.login-submit {
  width: 100%;
  min-height: 52px;
  margin-top: 4px;
  border: 0;
  border-radius: 999px;
  background: var(--glass-accent);
  color: var(--glass-accent-on);
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-indent: 0.2em;
  box-shadow: var(--glass-accent-shadow);
  cursor: pointer;
  transition: background 160ms ease, transform 160ms ease;
}

.login-submit:hover:not(:disabled),
.login-submit:focus-visible { background: var(--glass-accent-strong); }
.login-submit:active:not(:disabled) { transform: scale(0.985); }
.login-submit:disabled { cursor: progress; }

[data-state="checking"] .login-submit { opacity: 0.85; }

[data-state="open"] .login-submit {
  background: var(--glass-success-ink);
  box-shadow: none;
}

.login-note {
  margin: 14px 4px 0;
  color: var(--glass-muted);
  font-size: 0.6875rem;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .gate-arm { transition: none; }
  .gate-halo { animation: none; }
  [data-state="denied"] .gate-arm { animation: none; }
}
```

`login.js`：

```javascript
// 登入頁：把 ?next= 帶進表單，並攔截送出改用 fetch，讓閘門動畫有地方演。
// 沒有 JavaScript 時表單照常 POST（伺服器回 303），所以這支檔案只做加強，不做必要的事。
(() => {
  const stage = document.getElementById("gate-stage");
  const form = document.getElementById("login-form");
  const error = document.getElementById("login-error");
  const status = document.getElementById("login-status");
  const submit = document.getElementById("login-submit");
  const username = document.getElementById("login-username");
  const password = document.getElementById("login-password");
  const toggle = document.querySelector(".password-toggle");
  const arm = stage.querySelector(".gate-arm");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const OPEN_HOLD_MS = reduceMotion ? 250 : 950; // 桿子升起後停一下再換頁

  // 只接受站內路徑；伺服器端還會再驗一次。
  const safeNext = value => (typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : "/");
  const params = new URLSearchParams(location.search);
  form.elements.next.value = safeNext(params.get("next"));

  const setState = name => {
    if (name === "denied" && stage.dataset.state === "denied") {
      stage.dataset.state = "idle"; // 連續被擋下時重新觸發彈跳動畫
      void stage.offsetWidth;
    }
    stage.dataset.state = name;
  };

  const showError = message => {
    error.textContent = message;
    error.classList.add("is-visible");
  };

  const clearError = () => {
    error.textContent = "";
    error.classList.remove("is-visible");
  };

  const busy = on => {
    submit.disabled = on;
    submit.textContent = on ? "確認中…" : "開門";
    if (on) setState("checking");
  };

  const deny = (message, retypePassword) => {
    busy(false);
    setState("denied");
    showError(message);
    if (retypePassword) {
      password.value = "";
      password.focus();
    }
  };

  const openGate = next => {
    setState("open");
    submit.textContent = "請進";
    status.textContent = "核對完成，閘門已開。";
    setTimeout(() => location.assign(next), OPEN_HOLD_MS);
  };

  // 被擋下的彈跳播完就回到「鎖著」；減少動態時沒有動畫，維持 denied 的靜態樣式
  arm.addEventListener("animationend", () => {
    if (stage.dataset.state === "denied") setState("idle");
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (submit.disabled) return;
    clearError();
    if (!username.value.trim() || !password.value) {
      deny("請輸入帳號和密碼。", false);
      return;
    }
    if (!navigator.onLine) {
      deny("目前沒有網路，登入需要連線。", false);
      return;
    }
    busy(true);
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new URLSearchParams(new FormData(form)),
        credentials: "same-origin"
      });
      if (response.ok) {
        const data = await response.json();
        openGate(safeNext(data.next));
        return;
      }
      if (response.status === 401) deny("帳號或密碼不對，閘門沒開。再試一次。", true);
      else if (response.status === 503) deny("登入尚未設定完成，請聯絡管理員。", false);
      else deny("登入暫時無法使用，請稍後再試。", false);
    } catch {
      deny("連不上網路，請確認訊號後再試。", false);
    }
  });

  toggle.addEventListener("click", () => {
    const show = password.type === "password";
    password.type = show ? "text" : "password";
    toggle.textContent = show ? "隱藏" : "顯示";
    toggle.setAttribute("aria-pressed", String(show));
  });

  // 從上一頁（bfcache）回到這裡時，閘門要回到鎖著、按鈕要能再按
  addEventListener("pageshow", event => {
    if (!event.persisted) return;
    busy(false);
    setState("idle");
  });

  // 沒有 JavaScript 的流程由伺服器導回 ?e=1#login-error（:target 讓訊息顯示）。有 JavaScript 時
  // 改用同一套顯示，並拿掉網址上的 #，否則重試時 :target 會讓清空後的紅框一直撐著。
  if (params.get("e") === "1") {
    history.replaceState(null, "", location.pathname + location.search);
    setState("denied");
    showError("帳號或密碼不對，閘門沒開。再試一次。");
  } else if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    username.focus();
  }
})();
```

- [ ] **Step 5: 執行兩份檢查，確認通過**

```bash
node scripts/verify_auth.mjs
python3 scripts/verify_login_page.py
```

Expected: 第一個 32 行 `✅`，最後 `全部通過`；第二個全部 `✅`，最後 `全部通過`（約 20 秒）。

- [ ] **Step 6: 提交**

```bash
git add login.html login.css login.js scripts/verify_login_page.py scripts/verify_auth.mjs
git commit -m "Add the site-gate login page" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```


---

### Task 5: Service Worker 與首頁登出鈕

**Files:**
- Modify: `sw.js`
- Modify: `index.html`
- Modify: `portal.css`
- Modify: `scripts/verify_auth.mjs`（插入「Service Worker」區段）
- Modify: `scripts/verify_login_page.py`（插入首頁登出鈕的檢查）

**Interfaces:**
- Consumes: Task 3 的 `POST /api/logout`；Task 4 的 `scripts/verify_login_page.py` 標記行。
- Produces: `sw.js` 的 `CACHE_NAME = "portable-inspection-v140"` 與 `GATE_PATH`（符合 `/login`、`/login.css`、`/login.js`、`/api/*` 結尾的路徑）；首頁 `.logout-form[action="/api/logout"][method=post]` 內的 `.logout-button`。

- [ ] **Step 1: 寫會失敗的 Service Worker 測試**

貼到 `scripts/verify_auth.mjs` 的 `// ---- end of sections ----` **之前**。這一段把真正的 `sw.js` 放進 vm 沙箱，用假的 `fetch` 回應模擬各種情況，確認哪些回應會被 `cache.put`。

```javascript
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
```

- [ ] **Step 2: 執行，確認失敗**

```bash
node scripts/verify_auth.mjs
```

Expected: 33 行 `✅`、3 行 `❌`，結尾 `3 項失敗`：

```
❌ 換頁：被轉址過的 200（登入頁冒充工具頁）、302、401 都不能存進快取
    跟隨轉址的 200 預期 0，實際 1
❌ 子資源：正常回應照舊快取，被轉址過的回應（登入頁冒充 app.css）不能快取
    被轉址 預期 0，實際 1
❌ 登入頁與登入 API 不經過 Service Worker
    /login 不該由 Service Worker 處理
```

- [ ] **Step 3: 修改 `sw.js`（四處）**

**修改 `sw.js`**（第 1 處）：把

```
const CACHE_NAME = "portable-inspection-v139";
```

換成

```
const CACHE_NAME = "portable-inspection-v140";
// 登入頁與登入 API 不經過 Service Worker：未登入時伺服器回的是登入頁或導向，絕不能被當成工具頁或 app.css 存進快取。
const GATE_PATH = /\/(login(\.css|\.js)?|api\/[^/]+)$/;
```

**修改 `sw.js`**（第 2 處）：把

```
  if (path.endsWith(".pdf")) return;
```

換成

```
  if (path.endsWith(".pdf")) return;
  if (GATE_PATH.test(path)) return;
```

**修改 `sw.js`**（第 3 處）：把

```
          if (response.ok) cache.put(event.request, response.clone());
```

換成

```
          if (response.ok && !response.redirected) cache.put(event.request, response.clone());
```

**修改 `sw.js`**（第 4 處）：把

```
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
```

換成

```
        if (response.ok && !response.redirected && new URL(event.request.url).origin === self.location.origin) {
```

- [ ] **Step 4: 執行，確認通過，並確認版號**

```bash
node scripts/verify_auth.mjs
grep -n 'const CACHE_NAME' sw.js
```

Expected: 36 行 `✅`，最後 `全部通過`；`grep` 印出 `const CACHE_NAME = "portable-inspection-v140";`。

- [ ] **Step 5: 寫首頁登出鈕的檢查，確認失敗**

把下面整段貼到 `scripts/verify_login_page.py` 的 `        # ---- end of checks ----` 這一行**之前**（縮排 8 個空格，與前後的區塊對齊）：

```python
        # ---- 首頁的登出按鈕 ----
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()
        page.goto(f"{BASE}/", wait_until="networkidle")
        check("首頁有登出鈕：POST /api/logout、觸控目標 ≥44px", page.get_attribute(".logout-form", "action") == "/api/logout" and page.get_attribute(".logout-form", "method") == "post" and page.evaluate("() => document.querySelector('.logout-button').getBoundingClientRect().height") >= 44)
        check("首頁品牌仍在左、登出鈕在右", page.evaluate("() => document.querySelector('.brand').getBoundingClientRect().left < document.querySelector('.logout-button').getBoundingClientRect().left"))
        context.close()
```

```bash
python3 scripts/verify_login_page.py
```

Expected: 約 30 秒後以 Playwright `TimeoutError` 結束（首頁還沒有 `.logout-form`），結束碼非 0。

- [ ] **Step 6: 加上登出鈕**

**修改 `index.html`**（品牌連結後面加登出表單）：把

```
          <span>Portable Inspection</span>
        </a>
      </header>
```

換成

```
          <span>Portable Inspection</span>
        </a>
        <form class="logout-form" method="post" action="/api/logout">
          <button class="logout-button" type="submit">登出</button>
        </form>
      </header>
```

**修改 `portal.css`**（標頭左右分開，品牌在左、登出鈕在右）：把

```
  align-items: center;
  justify-content: flex-start;
  padding: 8px 4px 0;
}
```

換成

```
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px 0;
}
```

**修改 `portal.css`**（在小標規則前加登出鈕樣式）：把

```
/* 小標（首頁品牌字、連續壁版本選擇頁的 DIAPHRAGM WALL） */
```

換成

```
.logout-form { margin: 0; }

.logout-button {
  min-height: 44px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--glass-muted);
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.logout-button:hover { background: var(--glass-neutral-bg); }

/* 小標（首頁品牌字、連續壁版本選擇頁的 DIAPHRAGM WALL） */
```

- [ ] **Step 7: 執行所有檢查**

```bash
node scripts/verify_auth.mjs
python3 scripts/verify_login_page.py
python3 scripts/verify_data.py
python3 scripts/verify_print_layout.py
```

Expected: 四支都以 `✅` 為主、沒有 `❌`。前兩支最後一行 `全部通過`。後兩支是既有的驗證（我們只動了 `sw.js`、`index.html`、`portal.css`），如果它們失敗，先用 `git stash` 確認是否原本就失敗，再決定是不是這次改動造成。

- [ ] **Step 8: 提交**

```bash
git add sw.js index.html portal.css scripts/verify_auth.mjs scripts/verify_login_page.py
git commit -m "Keep logged-out responses out of the service worker cache and add a logout button" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```


---

### Task 6: 本機端到端（真實的 Cloudflare 執行環境加真實 Chrome）

**Files:**
- Create: `scripts/verify_gate_e2e.py`

**Interfaces:**
- Consumes: Task 1–5 的全部成果；`wrangler pages dev`（用 `npx` 下載，第一次約 1 分鐘）。
- Produces: 端到端驗證腳本 `python3 scripts/verify_gate_e2e.py <帳號> <密碼>`（對 `http://localhost:8788` 執行）。

這一關存在的原因：單元測試用假的 `Request`，抓不到「Service Worker 代為重抓換頁時標頭不同」這類只在真實瀏覽器加真實執行環境才會出現的問題（Review Focus 第 2 項就是這樣發現的）。

- [ ] **Step 1: 建立端到端腳本**

建立 `scripts/verify_gate_e2e.py`：

```python
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
```

- [ ] **Step 2: 啟動本機的 Cloudflare 環境**

在另一個終端機（或背景）執行。下面三個值只是本機測試用的假值，**不是正式密碼**：

```bash
npx wrangler pages dev . --port 8788 --ip 127.0.0.1 \
  --binding AUTH_USER=staff \
  --binding AUTH_PASSWORD='local-test-password-9X' \
  --binding SESSION_SECRET='local-test-session-secret-0123456789abcdef'
```

Expected: 輸出含 `Compiled Worker successfully` 與 `Ready on http://127.0.0.1:8788`。這會在專案根目錄建立或更新 `.wrangler/`，它已經是未追蹤檔案，不要提交。

- [ ] **Step 3: 用 curl 逐項確認**

```bash
B=http://127.0.0.1:8788
echo "1 未登入換頁";               curl -si -H 'Sec-Fetch-Dest: document' $B/rebar | tr -d '\r' | grep -i '^HTTP\|^location\|^cache-control'
echo "2 未登入 app.css";           curl -si -H 'Sec-Fetch-Dest: style' $B/app.css | head -1
echo "3 未登入 sw.js";             curl -si -H 'Sec-Fetch-Dest: serviceworker' $B/sw.js | head -1
echo "4 公開的登入頁";             curl -si $B/login | head -1
echo "5 公開的 manifest";          curl -si $B/manifest.webmanifest | tr -d '\r' | grep -i '^HTTP\|^cache-control'
echo "6 錯誤密碼（JSON）";         curl -s -o /dev/null -w '%{http_code}，%{time_total} 秒\n' -X POST -H 'Accept: application/json' -d 'username=staff&password=wrong' $B/api/login
echo "7 錯誤密碼（表單）";         curl -si -X POST -d 'username=staff&password=wrong&next=/rebar' $B/api/login | tr -d '\r' | grep -i '^HTTP\|^location'
TOKEN=$(curl -si -X POST -H 'Accept: application/json' -d 'username=staff&password=local-test-password-9X&next=/rebar' $B/api/login | tr -d '\r' | sed -n 's/^[Ss]et-[Cc]ookie: __Host-pi_auth=\([^;]*\);.*/\1/p')
echo "8 正確密碼拿到通行證";       echo "${TOKEN:0:3}…（共 ${#TOKEN} 字元）"
echo "9 帶通行證開工具頁";         curl -si -H "Cookie: __Host-pi_auth=$TOKEN" -H 'Sec-Fetch-Dest: document' $B/rebar | head -1
echo "10 帶通行證的 sw.js 標頭";   curl -si -H "Cookie: __Host-pi_auth=$TOKEN" -H 'Sec-Fetch-Dest: serviceworker' $B/sw.js | tr -d '\r' | grep -i '^HTTP\|^cache-control'
echo "11 竄改過的通行證";          curl -si -H "Cookie: __Host-pi_auth=${TOKEN}x" -H 'Sec-Fetch-Dest: document' $B/rebar | tr -d '\r' | grep -i '^HTTP\|^location'
echo "12 未登入的不存在頁面";      curl -si -H 'Sec-Fetch-Dest: document' $B/scaffold | tr -d '\r' | grep -i '^HTTP\|^location'
echo "13 GET /api/login";          curl -si $B/api/login | head -1
```

Expected（順序同上）：

| # | 預期 |
| --- | --- |
| 1 | `302 Found`、`Location: /login?next=%2Frebar`、`Cache-Control: no-store` |
| 2、3 | `401 Unauthorized` |
| 4 | `200 OK` |
| 5 | `200 OK`、`Cache-Control: no-cache` |
| 6 | `401，1.0x 秒`（約 1 秒） |
| 7 | `303 See Other`、`Location: /login?e=1&next=%2Frebar#login-error` |
| 8 | `v1.…（共 57 字元）` |
| 9 | `200 OK` |
| 10 | `200 OK`、`Cache-Control: no-cache` |
| 11 | `302 Found`、`Location: /login?next=%2Frebar` |
| 12 | `302 Found`、`Location: /login?next=%2Fscaffold`（未登入看不出頁面存不存在） |
| 13 | `404 Not Found` |

- [ ] **Step 4: 執行端到端腳本**

```bash
python3 scripts/verify_gate_e2e.py staff 'local-test-password-9X'
```

Expected: 9 行 `✅`，最後 `全部通過`：未登入被導到登入頁並記住原網址、登入後回到工具頁且樣式有載入、通行證是 HttpOnly、Service Worker 裝好並快取、登入頁與 API 沒被快取、登出後重新開啟被導到登入頁（畫面是登入頁不是純文字）、快取裡的工具頁與 `app.css` 沒被登入頁蓋掉、離線仍可開啟已快取的工具頁。

- [ ] **Step 5: 關掉本機環境**

```bash
pkill -f "wrangler pages dev"; pkill -f workerd
```

- [ ] **Step 6: 提交**

```bash
git add scripts/verify_gate_e2e.py
git commit -m "Add the end-to-end gate check against wrangler pages dev" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```


---

### Task 7: 設計收尾檢查（Impeccable）

**Files:**
- Modify（只在審查要求時）: `login.html`、`login.css`、`login.js`

**Interfaces:**
- Consumes: Task 4–5 完成後的登入頁與首頁；`.impeccable/surfaces/login-html.md`（設計契約）；`PRODUCT.md`。
- Produces: 機械式檢查結果、審查者的處置（`ship`／`fix`／`recapture`／`rebuild`）。這是既有視覺世界的延伸，不重寫 `DESIGN.md`；收尾時回報「與既有系統一致」的證據。

登入頁的雛形在規劃時已跑過一次完整檢查（機械式檢查無發現、手機與桌機兩輪截圖確認），這一關是對**實際進到專案裡的檔案**做最後一次確認，並交給全新的審查者獨立判斷。

- [ ] **Step 1: 跑機械式檢查**

```bash
"/Users/yuhudaddy/.claude/plugins/cache/impeccable/impeccable/4.4.0/skills/impeccable/scripts/impeccable" detect --json login.html login.css login.js index.html portal.css
```

Expected: 印出 `[]`。如果外掛升版、路徑不存在，先用 `ls ~/.claude/plugins/cache/impeccable/impeccable/*/skills/impeccable/scripts/impeccable` 找新路徑。有任何發現就修掉再跑一次，不要跑第三次。

- [ ] **Step 2: 截圖**

用專案自己的靜態伺服器（不含 Functions，所以 `/login` 可以直接打開）截三張圖，存進 `.impeccable/review/`：

```bash
mkdir -p .impeccable/review
python3 - <<'PYEOF'
import subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

server = subprocess.Popen([sys.executable, "scripts/serve.py", "4196"], cwd=Path.cwd(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for name, size, state in [("mobile", (375, 812), "idle"), ("mobile-open", (375, 812), "open"), ("desktop", (1280, 800), "idle")]:
            page = browser.new_page(viewport={"width": size[0], "height": size[1]})
            page.goto("http://127.0.0.1:4196/login", wait_until="networkidle")
            page.evaluate("state => { document.getElementById('gate-stage').dataset.state = state; }", state)
            page.wait_for_timeout(1200)
            page.screenshot(path=f".impeccable/review/{name}.png", full_page=True)
            page.close()
        browser.close()
finally:
    server.terminate()
PYEOF
ls -la .impeccable/review
```

Expected: 列出 `desktop.png`、`mobile.png`、`mobile-open.png` 三個檔案。逐張打開確認：沒有空白、沒有半載入狀態、桿子在 `mobile-open.png` 確實升起。

- [ ] **Step 3: 派全新的審查者**

用 Agent 工具，`subagent_type` 填 `impeccable:impeccable-finish-reviewer`，**不要**帶入目前的對話（全新脈絡）。不要先讀審查者的定義檔。給它的輸入：

```
原始需求：為 Portable Inspection（施工查驗 PWA）做全站登入的登入頁，要有趣，而且必須符合專案現有色調。
使用者已確認：主題「工地大門閘門」（柵欄桿放下、警示燈紅；成功升起燈轉綠；失敗彈跳）；產品脈絡見 PRODUCT.md。
成品：login.html、login.css、login.js（登入頁）；index.html、portal.css（首頁登出鈕）。
截圖：.impeccable/review/desktop.png、mobile.png、mobile-open.png（手機寬 375、桌機寬 1280）。
設計契約：.impeccable/surfaces/login-html.md
既有 hook／偵測結果：impeccable detect 無發現（[]）。
建置路徑：code-led，沒有核准的 comp，也沒有 QUALITY BAR 卡片。
工藝底線參考：/Users/yuhudaddy/.claude/plugins/cache/impeccable/impeccable/4.4.0/skills/impeccable/reference/craft-floor.md
平台：web。審查者沒有瀏覽器，請只依截圖與原始碼判斷。
```

Expected: 回傳含五個段落與一個處置字（`ship`／`fix`／`recapture`／`rebuild`）。回傳空白或亂掉時，用同樣輸入重派一次。

- [ ] **Step 4: 依處置行動**

・ `ship`：不用改，進到 Task 8。
・ `recapture`：證據有問題，不是成品有問題。重跑 Step 2 的截圖，再派一次完整審查。
・ `fix`：把審查列出的重大問題一次改完，重跑 Step 2，把新截圖交回同一位審查者做驗證；只回報它評分過的項目，不要說成「整體沒有問題」。最多兩輪。
・ `rebuild`：整頁重做，先告訴使用者。
改完要重跑 `node scripts/verify_auth.mjs` 與 `python3 scripts/verify_login_page.py`，都要全部通過。

- [ ] **Step 5: 提交（只有在 Step 4 改了檔案時才需要）**

```bash
git add login.html login.css login.js
git commit -m "Apply the finish review fixes to the login page" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```


---

### Task 8: 預覽部署與人工實測

**Files:** 無（Cloudflare 後台設定加手機實測）。

**Interfaces:**
- Consumes: Task 1–7 完成並提交的 `feature/login-gate` 分支。
- Produces: 預覽網址上通過的實測紀錄；Cloudflare 的三個加密變數與 `Fail closed` 設定（Task 9 的正式站沿用）。

這一關要使用者親自操作 Cloudflare 後台，並用自己的手機測。**不要把密碼或金鑰貼進聊天。**

- [ ] **Step 1:（使用者）產生密碼與金鑰**

```bash
openssl rand -base64 24    # 當作 AUTH_PASSWORD
openssl rand -base64 48    # 當作 SESSION_SECRET
```

`AUTH_PASSWORD` 同時存進密碼管理員（之後要用你平常的安全方式發給員工）。`AUTH_USER` 自己取一個，例如公司縮寫。

- [ ] **Step 2:（使用者）在 Cloudflare 後台設定**

Workers & Pages → `portable-inspection` → Settings：

・ **Variables and Secrets** → Add：新增 `AUTH_USER`、`AUTH_PASSWORD`、`SESSION_SECRET` 三筆，每一筆都選 **Encrypt**（Secret），**Production 與 Preview 兩個環境各設一次**。必須在部署之前設好。
・ **Runtime** → **Fail open / closed** → 選 **Fail closed**（Functions 每日免費額度用完時擋住，而不是放行）。

- [ ] **Step 3: 推送功能分支（需要使用者同意）**

```bash
git push -u origin feature/login-gate
```

Expected: 推送成功。到 Cloudflare 後台 Deployments，找到分支 `feature-login-gate` 的預覽部署，約 30 秒內狀態變成 Success；記下它的網址。**這一步不會動到正式站**（只有 `main` 會）。

- [ ] **Step 4: 用 curl 驗證預覽網址**

```bash
B=https://<預覽網址>     # 把 <預覽網址> 換成 Cloudflare 後台 Deployments 裡這個分支那一筆的網址（不含 https://）
curl -si -H 'Sec-Fetch-Dest: document' $B/rebar | tr -d '\r' | grep -i '^HTTP\|^location'
curl -si -H 'Sec-Fetch-Dest: style' $B/app.css | head -1
curl -si -H 'Sec-Fetch-Dest: serviceworker' $B/sw.js | head -1
curl -si $B/manifest.webmanifest | tr -d '\r' | grep -i '^HTTP\|^cache-control'
curl -s -o /dev/null -w '錯誤密碼：%{http_code}，%{time_total} 秒\n' -X POST -H 'Accept: application/json' -d 'username=nobody&password=wrong' $B/api/login
read -s -p "AUTH_USER: " AU; echo; read -s -p "AUTH_PASSWORD: " PW; echo
curl -si -X POST -H 'Accept: application/json' --data-urlencode "username=$AU" --data-urlencode "password=$PW" $B/api/login | tr -d '\r' | grep -i '^HTTP\|^set-cookie' | cut -c1-60
unset AU PW
```

Expected：換頁 `302`＋`Location: /login?next=%2Frebar`；`app.css` 與 `sw.js` 為 `401`；manifest 為 `200`＋`Cache-Control: no-cache`；錯誤密碼 `401，1.0x 秒`；正確帳密 `HTTP/2 200` 加一行以 `set-cookie: __Host-pi_auth=v1.` 開頭的內容。

如果任何請求回 `503`，代表 Preview 環境的 Secrets 沒設好或 `SESSION_SECRET` 不到 32 字元，回 Step 2 修正後，在 Deployments 重新部署這一筆。

- [ ] **Step 5:（使用者）手機實測，用預覽網址**

逐項勾選，失敗的項目要記下來回報：

・ [ ] iPhone Safari：開 `…/rebar` → 看到登入頁 → 密碼管理員跳出「儲存密碼」→ 登入 → 閘門升起 → 到鋼筋查驗表。
・ [ ] 關掉分頁重開同一個網址：不用再登入。
・ [ ] 「加到主畫面」後從主畫面圖示開啟：第一次要再登入一次（iPhone 的 Safari 與主畫面 App 的登入互不共用，屬預期）。關掉 App 再開：不用登入。
・ [ ] 開啟飛航模式，從主畫面圖示開 App：已看過的工具頁仍能使用。
・ [ ] 故意輸入錯誤密碼：桿子彈跳、出現紅色訊息、按鈕恢復可按。
・ [ ] 首頁右上「登出」→ 回到登入頁；重新整理工具頁網址仍然停在登入頁，而且畫面是完整的登入頁（不是一行純文字、排版沒壞）。
・ [ ] 在 LINE 對話裡點連結（LINE 內建瀏覽器）：登入一次，關掉再點開，看是否仍保持登入。若沒有保持，記下來，員工需要改用「在 Safari 開啟」。
・ [ ] （有 Android 手機的話）Chrome 同樣走一次。
・ [ ] Cloudflare 後台確認 Fail open / closed 仍是 **Fail closed**。

- [ ] **Step 6: 回報結果**

全部通過才進 Task 9。有失敗項目時，回到對應的 Task 修正、補測試，再重跑本 Task 的 Step 3 起。


---

### Task 9: 上線與收尾

**Files:**
- Modify: `README.md`
- Delete: `.nojekyll`
- Memory: `portable-inspection-hosting.md`（改寫）、`portable-inspection-login-gate.md`（新增）、`MEMORY.md`（索引）

**Interfaces:**
- Consumes: Task 8 全部通過；使用者在 Cloudflare 設好的 Production 環境 Secrets 與 `Fail closed`。
- Produces: 正式站上線；GitHub Pages 鏡像關閉；文件與記憶更新。

- [ ] **Step 1: 合併到 `main`（需要使用者同意）**

```bash
git switch main
git merge --ff-only feature/login-gate
```

Expected: `Fast-forward`。如果拒絕（`main` 在這期間前進了），改成：

```bash
git switch feature/login-gate
git rebase main
node scripts/verify_auth.mjs && python3 scripts/verify_login_page.py
git switch main
git merge --ff-only feature/login-gate
```

- [ ] **Step 2: 推送 `main`，部署正式站（需要使用者同意）**

```bash
git push origin main
```

等約 30 秒，Cloudflare Deployments 的 Production 那一筆變成 Success。

- [ ] **Step 3: 驗證正式站**

重跑 Task 8 Step 4 的 curl 區塊，把 `B` 換成 `portable-inspection.pages.dev`。Expected 同 Task 8 Step 4。再用手機打開 QR Code（`docs/qr/portable-inspection.png`，掃出來就是這個網址）：未登入會看到登入頁，登入後進首頁。

如果正式站任何請求回 `503`：Production 環境的 Secrets 沒設好，回 Task 8 Step 2 補設，並在 Deployments 對 Production 那一筆按 Retry deployment。**這是安全的失敗方式：網站不會在沒登入的情況下開放。**

- [ ] **Step 4: 關閉 GitHub Pages 鏡像（需要使用者明確同意）**

```bash
gh api -X DELETE repos/Yuhudaddy/portable-inspection/pages
curl -sI https://yuhudaddy.github.io/portable-inspection/ | head -1
```

Expected: `gh` 沒有錯誤輸出；`curl` 印出 `HTTP/2 404`。這是對外的變更：關閉後，所有指向 `yuhudaddy.github.io/portable-inspection` 的 QR Code、書籤、加到主畫面的圖示都會失效。

- [ ] **Step 5: 更新 README，移除 `.nojekyll`**

**修改 `README.md`**（Deployment 段落第 7 行）：把

```
The same branch is also published by GitHub Pages at **https://yuhudaddy.github.io/portable-inspection/** (kept as a second, identical mirror; note GitHub Pages cannot set headers, so a new `sw.js` there can lag up to 10 minutes behind a push). `.nojekyll` keeps GitHub from running Jekyll on the files.
```

換成

```
The whole site sits behind a shared-password login: `functions/_middleware.js` (the gatekeeper) and `functions/api/login.js` / `logout.js` run as Cloudflare Pages Functions, the login page is `login.html`, and the 90-day session cookie is signed with a secret. `AUTH_USER`, `AUTH_PASSWORD` and `SESSION_SECRET` are encrypted variables of the Pages project (Production and Preview) and never live in the repository; if any is missing the site answers 503 instead of opening up. Design: `docs/superpowers/specs/2026-10-04-login-gate-design.md`. The former GitHub Pages mirror was shut down because a static host cannot enforce the login. Wrangler bundles the `functions/` folder of the **current directory** into any Pages deployment, so deploy the public demo build from inside its folder (`cd share/diaphragm-wall && npx wrangler pages deploy .`, see `scripts/build_share.py`), never from the project root.
```

**修改 `README.md`**（Local preview 段落）：把

```
```bash
python3 scripts/serve.py 4173
```
```

換成

```
```bash
python3 scripts/serve.py 4173
```

This server does not run `functions/`, so it never shows the login. To try the login locally, run `npx wrangler pages dev . --port 8788 --ip 127.0.0.1 --binding AUTH_USER=staff --binding AUTH_PASSWORD=<test password> --binding SESSION_SECRET=<32+ random characters>` (test values only) and open `http://localhost:8788/`.
```

**修改 `README.md`**（Verification scripts 表格最後一列後面加三列）：把

```
| `scripts/verify_print_layout.py` | Empty and oversized forms for every tool: signature block stays at the bottom of the last page, rotated pages included; the four construction plans print with cover, revision history and table of contents on their own pages. |
```

換成

```
| `scripts/verify_print_layout.py` | Empty and oversized forms for every tool: signature block stays at the bottom of the last page, rotated pages included; the four construction plans print with cover, revision history and table of contents on their own pages. |
| `scripts/verify_auth.mjs` | Login gate logic with plain `node` (22 or newer, no Cloudflare needed): token signing / expiry / tampering / password rotation, the gatekeeper's 302 / 401 / 503 / pass-through / renewal, the login and logout APIs (JSON and form modes, one-second delay, hostile `next` values), that every file `login.html` loads is public, that `sw.js` never caches redirected or unauthorized responses, and that the share-build deploy note says to `cd` into the output folder first. |
| `scripts/verify_login_page.py` | The login page in headless Chrome with the login API stubbed: gate states (locked / checking / denied / open), `next` handling, password toggle, touch targets, no horizontal scroll at 320px, no CSP violations, reduced motion, the no-JavaScript fallback, and the logout button on the home page. |
| `scripts/verify_gate_e2e.py` | Needs `wrangler pages dev` running (see Local preview): real Chrome logs in, the service worker installs, logout sends the next visit to the login page without overwriting the caches, and cached pages still open offline. |
```

```bash
git rm .nojekyll
git add README.md
git commit -m "Document the login gate and drop the GitHub Pages leftovers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push origin main
```

README 與 `.nojekyll` 都不在 `sw.js` 的 `APP_SHELL`，不需要再升版。

- [ ] **Step 6: 更新記憶**

```bash
MEM="/Users/yuhudaddy/.claude/projects/-Users-yuhudaddy-Desktop-Software-Report----------tmp-project-portal-fix-NEW2IE/memory"
export MEM
cat > "$MEM/portable-inspection-hosting.md" <<EOF
---
name: portable-inspection-hosting
description: "Portable Inspection is published only on Cloudflare Pages (portable-inspection.pages.dev) behind a shared-password login; the GitHub Pages mirror was shut down; the public demo build in share/ must be deployed from inside its own folder"
metadata: 
  node_type: memory
  type: project
---

Production site is Cloudflare Pages: https://portable-inspection.pages.dev/ (Git-connected to \`Yuhudaddy/portable-inspection\`, no build step, output dir \`/\`, auto-deploys ~30 s after each push to \`main\`; branch pushes get preview URLs). The GitHub repo stays the single source of code. The whole site sits behind a login (\`functions/\` = Pages Functions, see [[portable-inspection-login-gate]]).

**Why:** GitHub Pages could not set headers (sw.js was HTTP-cached 10 min) and, since the login gate shipped on $(date +%F), cannot enforce a login at all, so the mirror at yuhudaddy.github.io/portable-inspection was disabled with \`gh api -X DELETE repos/Yuhudaddy/portable-inspection/pages\`. Pages redirects \`*.html\` → extension-less URLs and cannot be disabled, so all in-app links, \`manifest.start_url\` and the SW shell use extension-less paths.

**How to apply:**
- Do not re-enable GitHub Pages: it would serve the whole app without the login.
- \`_headers\` sets \`Cache-Control: no-cache\` for \`sw.js\`/manifest, and the gatekeeper also sets it in code; keep bumping \`CACHE_NAME\` in \`sw.js\` on every deploy-affecting change.
- Deploy the public demo build (\`share/diaphragm-wall\`) with \`cd share/diaphragm-wall && npx wrangler pages deploy .\`, never from the project root: wrangler bundles the \`functions/\` folder of the current directory and the demo would be locked behind the login (503).
- The user's Cloudflare MCP connector can list/inspect Workers but cannot create projects or deploy.
EOF

cat > "$MEM/portable-inspection-login-gate.md" <<EOF
---
name: portable-inspection-login-gate
description: "How the shared-password login gate of Portable Inspection works (Pages Functions, secrets, 90-day cookie), how to rotate the password, how to test it, and the Service Worker pitfalls found while building it"
metadata: 
  node_type: memory
  type: project
---

Shipped $(date +%F). Spec: docs/superpowers/specs/2026-10-04-login-gate-design.md, plan: docs/superpowers/plans/2026-10-05-login-gate.md. Files: \`functions/_middleware.js\` (gatekeeper), \`functions/_lib/auth.js\` (pure helpers), \`functions/api/login.js\` / \`logout.js\`, \`login.html|css|js\` ("工地大門" barrier-gate page).

**Why:** the user only wanted to stop "anyone with the link can use it"; no secrets in the app. One shared account, 90-day HttpOnly cookie \`__Host-pi_auth\` renewed on use, no database.

**How to apply:**
- Secrets live in the Cloudflare Pages project (Workers & Pages → Settings → Variables and Secrets, Encrypt, Production AND Preview): \`AUTH_USER\`, \`AUTH_PASSWORD\`, \`SESSION_SECRET\` (>= 32 chars). Missing/short → every page answers 503, never opens up. Runtime → Fail open/closed must stay on **Fail closed**. Secrets only take effect on the next deployment.
- Changing \`AUTH_PASSWORD\` or \`AUTH_USER\` logs everyone out (the password fingerprint is signed into the cookie); changing \`SESSION_SECRET\` does too. Use this when someone leaves.
- Never add a \`_routes.json\` that excludes paths (excluded paths skip the gatekeeper = unlocked). The local \`scripts/serve.py\` does not run \`functions/\`; use \`npx wrangler pages dev .\` to try the login.
- Pitfalls: (1) the service worker's refetch of a navigation has \`Sec-Fetch-Dest: empty\` but \`Sec-Fetch-Mode: navigate\`, so \`isNavigation\` must check Mode first or users see a bare "需要登入" text; (2) non-navigation requests must get 401, never a redirect, or the SW caches the login page as app.css; (3) \`manifest.webmanifest\` is fetched without cookies and must stay public; (4) iPhone Safari and the home-screen app do not share the login.
- Checks: \`node scripts/verify_auth.mjs\`, \`python3 scripts/verify_login_page.py\`, and \`python3 scripts/verify_gate_e2e.py <user> <password>\` against \`wrangler pages dev\`. See [[portable-inspection-pdf-verification]] for the older verifiers.
- Rollback: delete \`functions/\` and push; the site is public again (secrets can stay).
EOF

python3 - <<'PYEOF'
from pathlib import Path
import os
path = Path(os.environ["MEM"]) / "MEMORY.md"
lines = [line for line in path.read_text(encoding="utf-8").splitlines() if "portable-inspection-hosting" not in line and "portable-inspection-login-gate" not in line]
lines.append("- [Portable Inspection hosting](portable-inspection-hosting.md) — Cloudflare Pages only, behind a login; GitHub Pages mirror shut down; deploy share/ from inside its folder")
lines.append("- [Portable Inspection login gate](portable-inspection-login-gate.md) — Pages Functions gate, secrets, password rotation, SW pitfalls, verify scripts, rollback")
path.write_text("\n".join(lines) + "\n", encoding="utf-8")
PYEOF
```

Expected: 兩個記憶檔存在，`MEMORY.md` 的索引各有一行對應。

- [ ] **Step 7: 通知員工**

訊息要點（用你平常發給員工的管道，密碼另外單獨傳）：

・ 網址不變：`https://portable-inspection.pages.dev/`，QR Code 也不用換。
・ 第一次打開會要求輸入帳號密碼，登入後這支手機 90 天內不用再登入。
・ iPhone 要「加到主畫面」的人，請從 Safari 打開上面的網址後重新加入（舊的 `github.io` 圖示與書籤已失效）。
・ 從 LINE 點連結若每次都要重新登入，請改用「在 Safari 開啟」。

**回復方式：** 出問題時刪除 `functions/` 資料夾並推送到 `main`，網站立刻回到公開狀態（Secrets 可以留著）。

- [ ] **Step 8: 最後確認**

```bash
git status --short
git log --oneline -8
```

Expected: 工作目錄只剩與本功能無關的未提交項目（`.gitignore`、`.claude/`、`.wrangler/`、`docs/qr/`、`Steel Bar Example.jpg`、`PRODUCT.md`、`.impeccable/`）；最近的提交是這個功能的 8～9 個提交。

