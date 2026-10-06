// POST /api/login：比對帳密、發通行證。
// 登入頁的 JavaScript 送 Accept: application/json 拿 JSON；沒有 JavaScript 的一般表單走 303 轉址。
import { LOGIN_DELAY_MS, isConfigured, issueToken, matchAccount, safeNext, sessionCookie, sleep } from "../_lib/auth.js";

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

  const accountId = await matchAccount(env, username, password);
  if (!accountId) {
    await sleep(LOGIN_DELAY_MS);
    if (json) return new Response(JSON.stringify({ ok: false }), { status: 401, headers: { "Content-Type": JSON_TYPE, "Cache-Control": "no-store" } });
    return new Response(null, { status: 303, headers: { Location: `/login?e=1&next=${encodeURIComponent(next)}#login-error`, "Cache-Control": "no-store" } });
  }

  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", sessionCookie(await issueToken(env, undefined, accountId)));
  if (json) {
    headers.set("Content-Type", JSON_TYPE);
    return new Response(JSON.stringify({ ok: true, next }), { status: 200, headers });
  }
  headers.set("Location", next);
  return new Response(null, { status: 303, headers });
}
