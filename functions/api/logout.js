// POST /api/logout：清掉通行證，回登入頁。
import { clearedCookie } from "../_lib/auth.js";

export function onRequestPost() {
  return new Response(null, { status: 303, headers: { Location: "/login", "Set-Cookie": clearedCookie(), "Cache-Control": "no-store" } });
}
