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

  const { valid, renew, account } = await checkToken(env, readCookie(request));
  if (valid) {
    const response = await serve(context, url);
    // 只在 GET 換頁續期：登出是表單 POST，瀏覽器送出時 Sec-Fetch-Mode 也是 navigate，
    // 若在這裡再發一張新通行證，會蓋掉登出清除的那張，登出就失效了。
    if (renew && request.method === "GET" && isNavigation(request)) {
      response.headers.append("Set-Cookie", sessionCookie(await issueToken(env, undefined, account))); // 續期要簽回同一組帳號
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
