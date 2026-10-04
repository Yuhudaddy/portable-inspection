# 全站登入門檻（Cloudflare Pages Functions）— 設計

日期：2026-10-04

## 目標

1. 沒有登入的人打開網站任何網址（首頁、工具頁、QR Code、書籤、範例 PDF）都先看到登入頁，不是「有連結就能用」。
2. 登入方式為一組共用的帳號密碼；密碼不進 repo（repo 是公開的），存在 Cloudflare 後台的加密變數。
3. 登入一次後保持登入：通行證 90 天，每次使用自動續期；手機的密碼管理員負責「記住帳密」，網站本身不儲存密碼。
4. 不破壞現有離線使用（Service Worker 快取）；登入過一次之後，離線仍可開啟已快取的頁面。

### 不做的事

・ 不防機密外洩：內容沒有機密，目的只是擋住「拿到連結就能用」的人。
・ 不做每人一組帳號、不做註冊／忘記密碼、不做鎖定帳號（沒有資料庫）。
・ 不做「點工具才跳出登入視窗」：工具頁可被直接開啟，視窗擋不住；一律走獨立登入頁。
・ 不採用 Cloudflare Access：只有 email 驗證碼、最長一個月要重驗、`pages.dev` 正式站能否直接套用未確認。

---

## 一、整體流程

```
任何請求 → functions/_middleware.js（門房）
   ├ 路徑在白名單？            → 放行
   ├ Secrets 沒設好？          → 503「尚未設定登入」（不放行）
   ├ 通行證有效？              → 放行（超過 1 天未續期則重發 90 天）
   ├ 是「換頁」請求？          → 302 /login?next=<原網址>
   └ 其他（CSS／JS／圖片…）    → 401 純文字，Cache-Control: no-store
```

「換頁」判斷：`Sec-Fetch-Mode` 是 `navigate`，或 `Sec-Fetch-Dest` 是 `document`；兩個標頭都沒有時，改看 `GET` 且 `Accept` 含 `text/html`。
先看 Mode 是因為 Service Worker 代為重抓換頁時，Dest 會變成 `empty`、Mode 仍是 `navigate`（實測：只看 Dest 會把登出後的換頁誤判成子資源，使用者看到一行純文字「需要登入」）。

## 二、檔案

```
functions/_middleware.js     門房（上面的流程）
functions/_lib/auth.js       純函式：簽發／驗證通行證、定時比對、next 驗證（不依賴 Cloudflare 物件，可用 node 測）
functions/api/login.js       POST：比對帳密 → Set-Cookie → 303 回 next
functions/api/logout.js      POST：清除通行證 → 303 /login
login.html                   登入頁（沿用 glass.css、portal.css；不載入 sw-client.js）
login.css                    登入頁專屬樣式（閘門場景、四個狀態、卡片）
login.js                     攔截送出改用 fetch、驅動閘門狀態；沒有 JavaScript 時表單照常 POST
index.html／portal.css       首頁右上加小的「登出」按鈕
scripts/verify_auth.mjs      node 測 auth.js、門房、登入／登出 API（不需要 Cloudflare）
scripts/verify_login_page.py headless Chrome 測登入頁（沿用 verify_print_layout.py 的作法）
```

- 不建立 `_routes.json` 排除規則：被排除的路徑不會經過門房，等於沒上鎖。
- 本機 `scripts/serve.py` 不執行 Functions，現有 `verify_data.py`／`verify_print_layout.py` 不受影響。

### 白名單（不需登入）

`/login`、`/login.css`、`/login.js`、`/api/login`、`/glass.css`、`/portal.css`、`/app-icon-144.png`、`/apple-touch-icon.png`、
`/manifest.webmanifest`、`/icon-192.png`、`/icon-512.png`、`/icon-maskable-512.png`、`/robots.txt`。

`manifest.webmanifest` 必須在白名單：瀏覽器抓 manifest 預設不帶 Cookie，擋了會讓「加到主畫面」失效。其餘都是樣式與圖示，不含內容。
`sw.js` 不在白名單：已登入者更新 Service Worker 正常；通行證過期時更新失敗，舊版繼續運作，不會壞掉。

## 三、通行證

- Cookie 名稱 `__Host-pi_auth`；屬性 `Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=7776000`（90 天）；不設 `Domain`。
- 內容 `v1.<到期 Unix 秒>.<簽章>`；簽章 = HMAC-SHA256(`SESSION_SECRET`, `"v1." + 到期 + "." + 密碼指紋`)，base64url。
- 密碼指紋 = SHA-256(`AUTH_USER` + `:` + `AUTH_PASSWORD`) 前 16 個十六進位字元。**換密碼 → 所有舊通行證立刻失效**（員工離職的處理方式）；
  換 `SESSION_SECRET` 也會全員登出。
- 續期：通行證有效且剩餘少於 89 天（即超過 1 天沒續）時，在放行的回應上重發 90 天。只在「換頁」請求續期。
- 伺服器發的 HttpOnly Cookie，不受 iPhone Safari 對網頁程式碼寫入儲存的 7 天上限影響（一般認知，上線後以實機驗證）。

### 登入與登出

- `POST /api/login`，欄位 `username`、`password`、`next`。兩種回應模式，驗證邏輯相同：
  - 請求帶 `Accept: application/json`（登入頁的 JavaScript）：成功 200 `{"ok":true,"next":"…"}` ＋ `Set-Cookie`；帳密錯 401 `{"ok":false}`；未設定 503。
  - 其他（沒有 JavaScript 的一般表單）：成功 303 → `next` ＋ `Set-Cookie`；帳密錯 303 → `/login?e=1&next=…#login-error`；未設定 503 純文字。
  - 帳密比對：兩邊各算 SHA-256 再逐位元組做定時比對，不用 `===`。
  - 失敗一律先等約 1 秒（唯一的暴力猜測防護；密碼要求 12 碼以上長亂數）。登入頁正好用這一秒演「確認中」。
  - `next` 只接受以單一 `/` 開頭的站內路徑（不接受 `//`、`/\`、換行、`/login*`、`/api/*`），否則回 `/`。
  - 只處理 POST；其他方法沒有對應的 Function，會落到靜態檔而得到 404。所有登入相關回應 `Cache-Control: no-store`。
- `POST /api/logout`：`Max-Age=0` 清除通行證，303 → `/login`。首頁右上加小的「登出」按鈕（`<form method="post" action="/api/logout">`，符合 CSP `form-action 'self'`）。

## 四、登入頁：「工地大門」

視覺脈絡寫在 `PRODUCT.md`，設計契約在 `.impeccable/surfaces/login-html.md`（開發用，不進任何送到瀏覽器的檔案）。
承接 portal 的世界：白底到暖灰、白卡、石板藍、赭紅與灰綠只用在警示燈與狀態。不新增顏色、不加漸層。

- 版面（手機 390×844）：品牌列（沿用 portal）→ 閘門場景（viewBox 360×194）→ 白卡（標題「進場登記」、一句說明、帳號、密碼含顯示／隱藏、
  錯誤訊息、整寬按鈕「開門」、小字「登入後，這台裝置 90 天內不必再登入。」）。桌機同一欄寬 420px 置中。
- 閘門場景（行內 SVG，`aria-hidden`）：左柱含警示燈、斜紋桿子、右側承座、地上一頂安全帽。圖形都用 `login.css` 的 class 上色（CSP 不允許 `style` 屬性）。
- 四個狀態由 `#gate-stage` 的 `data-state` 驅動：

| 狀態 | 桿子 | 警示燈 | 按鈕 | 文字 |
|---|---|---|---|---|
| idle 鎖著 | 放下 | 紅，慢速呼吸 | 開門 | |
| checking 確認中 | 放下 | 紅，快閃 | 確認中…（停用） | |
| denied 被擋下 | 彈兩下後落回 | 紅，常亮 | 開門 | 紅色訊息（role=alert） |
| open 放行 | 升起 35° | 綠 | 請進（深綠） | 「核對完成，閘門已開。」（role=status） |

- 通過後停 950ms 再換頁。`prefers-reduced-motion`：不播彈跳與呼吸、桿子直接到位、只停 250ms；狀態仍由顏色與文字傳達。
- 欄位用標準屬性讓手機密碼管理員自動帶入：`name="username"` `autocomplete="username"`、`name="password"` `autocomplete="current-password"`，
  帳號欄加 `autocapitalize="none" autocorrect="off"`。輸入框沿用 glass.css 的旋轉光環；觸控目標 ≥44px；輸入 16px。
- 錯誤文案：帳密錯「帳號或密碼不對，閘門沒開。再試一次。」；沒網路「目前沒有網路，登入需要連線。」；連線失敗「連不上網路，請確認訊號後再試。」；503「登入尚未設定完成，請聯絡管理員。」。
- 一般的 `<form method="post" action="/api/login">`；沒有 JavaScript 也能登入（錯誤訊息靠 `#login-error:target` 顯示）。`<meta name="robots" content="noindex">`。
- 從 bfcache 返回（`pageshow`）時閘門回到鎖著、按鈕可再按。

## 五、Service Worker 調整（`sw.js`）

`CACHE_NAME` 升版（`v139` → `v140`）。

1. `fetch` 事件一開始：`/login`、`/login.js`、`/login.css`、`/api/` 開頭的路徑直接 `return`，不經 Service Worker。
2. 「換頁」請求只有 `response.ok && !response.redirected` 才 `cache.put`（未登入的換頁回應是 opaqueredirect，`ok` 本來就是 false）。
3. 子資源只有 `response.ok && !response.redirected` 才快取。
4. `install` 的 `cache.addAll` 不改：`sw.js` 本身受門房保護，通行證失效時更新請求會 401，不會進到 install。

要擋的兩個陷阱：沒登入時的登入頁被存成工具頁；沒登入時被導去登入頁的 CSS／JS 被存成 `app.css`／`app.js`。
門房對非換頁請求回 401 而不是 302，是同一個原因。登入頁不放進 `APP_SHELL`。

## 六、Cloudflare 設定（由使用者在後台操作）

Workers & Pages → `portable-inspection` → Settings：

- Variables and Secrets：新增 `AUTH_USER`、`AUTH_PASSWORD`、`SESSION_SECRET`，每一項都按 **Encrypt**，Production 與 Preview 環境各設一次。
  `SESSION_SECRET` 用 32 位元組以上的隨機值。**必須在部署之前設好**。
- Runtime → Fail open / closed：設為 **closed**（額度用完時擋住而不是放行）。
- Functions 計入 Workers 免費額度（每天 10 萬次）：員工數十人，每次升版每支手機約 60 次請求，遠低於上限。

## 七、上線順序

1. 使用者在後台設好 Secrets 與 fail closed。
2. 在分支推送，用 Cloudflare 預覽網址驗證（見下節）。
3. 驗證通過後合併到 `main`。
4. 確認正式站正常，**經使用者明確同意後**關閉 GitHub Pages：
   `gh api -X DELETE repos/Yuhudaddy/portable-inspection/pages`。
5. 更新 `README.md` 第 7 行（移除鏡像說明）與 memory `portable-inspection-hosting`。

回復方式：刪除 `functions/` 資料夾並推送，網站回到公開狀態。

## 八、驗證

自動：
・ `node scripts/verify_auth.mjs`：簽發後可驗證；過期、竄改、換密碼後皆失敗；`next` 的惡意值被擋；定時比對正確；門房的 302／401／503／放行／續期；登入 API 的 JSON 與表單兩種模式。
・ `python3 scripts/verify_login_page.py`：登入頁在 headless Chrome 的狀態切換、`next` 帶入、密碼顯示切換、觸控目標、手機寬度無橫向捲動、沒有 CSP 違規。
・ `impeccable detect --json login.html login.css login.js index.html portal.css` 無發現。
・ `python3 scripts/verify_data.py`、`python3 scripts/verify_print_layout.py` 仍全 ✅（確認沒動到現有行為）。
・ `npx wrangler pages dev . --binding AUTH_USER=… --binding AUTH_PASSWORD=… --binding SESSION_SECRET=…` 搭配 `curl`：
  未登入換頁 → 302；未登入 CSS → 401；錯誤密碼 → 約 1 秒後 303 `?e=1`；正確密碼 → `Set-Cookie`；缺少 Secrets → 503。
・ `python3 scripts/verify_gate_e2e.py <帳號> <密碼>`（對上面那個 wrangler 跑真的 Chrome）：登入 → Service Worker 安裝 → 登出 →
  重新開啟被導到登入頁 → 快取沒被登入頁蓋掉 → 離線仍可開已快取的頁面。
・ `scripts/build_share.py` 的部署說明要求先 `cd share/diaphragm-wall` 再部署：wrangler 會把「目前資料夾」底下的 `functions/` 一起打包，
  在專案根目錄部署對外展示版會被登入門檻鎖住（已實測）。`verify_auth.mjs` 會檢查這段說明。

預覽網址實測（人工）：
・ iPhone Safari 與「加到主畫面」App 各登入一次，確認通行證在關閉 App 後仍在（Safari 與主畫面 App 的登入不共用，需各登入一次）。
・ 通行證過期（暫時改短 Max-Age）後：線上開網址 → 登入頁；離線開已快取頁面 → 仍可用。
・ 通行證過期後 `app.css` 沒被換成登入頁。
・ 密碼管理員跳出「儲存密碼」並能自動帶入。
・ `curl -I https://…/sw.js` 與 `…/manifest.webmanifest` 都有 `Cache-Control: no-cache`（門房一律補上，不依賴 `_headers` 是否套用到 `next()` 的回應）。
・ 從 LINE 內建瀏覽器開啟連結也登入一次（員工常這樣進來），確認通行證有留住。

## 九、已知限制

・ 共用一組密碼，無法區分是誰；有人離職就換密碼，全員重新登入。
・ 沒有帳號鎖定，只有答錯延遲 1 秒；靠 12 碼以上長亂數密碼。
・ 登出後，該裝置上已快取的頁面離線時仍可開啟（內容無機密，可接受）。
・ repo 公開：原始碼人人可看，但帳密與簽章金鑰不在 repo 內。

## 十、QR Code

`docs/qr/portable-inspection.png`／`.svg` 掃出來是 `https://portable-inspection.pages.dev/`（主站首頁），不含密碼。**不需要重做**：掃描後未登入會先到登入頁，登入後進首頁。
需要重做或更換的只有：已分發、指向 `yuhudaddy.github.io/portable-inspection` 的 QR Code、書籤與員工手機上加到主畫面的舊圖示（鏡像關閉後失效）。
