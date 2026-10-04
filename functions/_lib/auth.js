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

// 登入後要回去的頁面只接受站內路徑：單一 / 開頭，不是 //、/\，不是登入相關路徑（避免繞圈），
// 而且只含可列印的 ASCII（網址解析器會悄悄刪掉 Tab 與換行，"/<Tab>/evil.example" 會變成 //evil.example）。
// 最後再用 URL 解析驗一次：解析後還是同一個來源才放行。
export function safeNext(value) {
  if (typeof value !== "string" || !/^\/(?![/\\])[\x21-\x7e]*$/.test(value) || /^\/(login|api\/)/.test(value)) return "/";
  try {
    return new URL(value, "https://gate.invalid").origin === "https://gate.invalid" ? value : "/";
  } catch {
    return "/";
  }
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
