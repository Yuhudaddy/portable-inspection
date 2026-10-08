# iPhone 輸出 PDF：產生檔案再交給分享選單

日期：2026-10-08　狀態：設計（使用者已同意方向；本文件隨實作一起提交）

## 1. 問題

iOS 27 的「主畫面 App」模式（`navigator.standalone === true`）會默默忽略 `window.print()`：呼叫不報錯，但沒有列印畫面，
`beforeprint`／`afterprint` 也都不觸發。同一個呼叫在 Safari 分頁正常。已在 iOS 27.0 模擬器用最小測試頁與真正的 App 重現
（選單有收回去，代表點擊有送到按鈕）；獨立的外部單機回報也一致。登入門檻與本專案程式都不是原因。

現行匯出流程是 `preparePrint(scope)`（產生並分頁 `.print-page`）＋ `window.print()`，沒有「檔案」可以交給 LINE／Email，
所以在主畫面 App 裡唯一可行的是：App 自己產生 PDF，再用 Web Share 把檔案交給系統分享選單
（iOS 27 主畫面模式下的 `navigator.share({files})` 已在模擬器驗證可用）。

## 2. 目標與範圍

做：
・ iPhone／iPad（Safari 分頁與主畫面 App 一致）按「單頁」「整份」→ 產生 PDF → 跳出分享選單（LINE、Email、儲存到檔案、列印都在選單裡）。
・ 電腦與其他裝置維持原本的列印視窗，行為不變。
・ 五個工具頁（連續壁完整版、連續壁品管版、模板、鋼筋、鋼構）。

不做（本次）：
・ 施工計畫頁（`plan.html`）：它是會自然流動的長文件，不是固定尺寸的頁盒，轉成圖片 PDF 需要另一套分頁。
  這次只加一個保險：在 iOS 主畫面模式呼叫列印後若 1.5 秒內沒有 `beforeprint`，跳出「請改用 Safari 開啟後列印」的說明。
・ Android：維持原本的列印（系統列印視窗可「儲存為 PDF」），沒有驗證過，不改。
・ 文字可選取的向量 PDF：使用者已同意圖片式 PDF。

## 3. 流程

```
點「單頁／整份」
  │  exportPdf(scope) → preparePrint(scope)   （不變：產生並分頁 .print-page）
  ▼
outputPrint()
  ├─ 不是 iOS 或不能分享檔案 ──────────────▶ window.print()（與現在相同）
  └─ iOS 且 navigator.canShare({files}) ──▶ PdfShare.run()
        1. 開對話框「正在準備 PDF…」（可取消）
        2. 建立畫面外的隱藏 iframe：載入同一批樣式表、把 @media print 規則切成 all、
           複製已分好頁的 .print-page、載入 html-to-image
        3. 逐頁：補 SVG 樣式 → 轉成 canvas（圖片空白就重畫，最多 5 次）→ JPEG
        4. 組成 PDF（A4、四邊 10mm，每頁一張圖）→ File
        5. 直接 navigator.share({files})
              成功 ─▶ 結束
              NotAllowedError（點擊後超過約 1 秒，手勢已失效）─▶ 對話框改成「PDF 已準備好 [分享]」，
                                                                  使用者再點一次，在新的點擊裡分享
              AbortError（使用者關掉分享選單）─▶ 結束
              其他錯誤 ─▶ 對話框顯示原因
```

## 4. 關鍵決定

1. **在隱藏 iframe 轉圖，不在目前頁面轉。** 要讓列印樣式生效必須把 `@media print` 規則切成 `all`，但轉圖是非同步、要好幾秒；
   在目前頁面切的話，使用者會看到整個畫面消失。iframe 有自己的樣式表集合，切它不影響畫面。
   iframe 放在畫面外（不是 `display:none`，否則 Safari 不排版），寬 800px 避開窄螢幕的 media query。
2. **函式庫只載進 iframe。** `html-to-image` 1.11.13（MIT，約 20KB）放 `vendor/`，檔名帶版號，
   在 iframe 裡用 `<script src>` 載入（頁面 CSP 是 `script-src 'self'`，不能 eval、不能內嵌）。放進 `sw.js` 的 APP_SHELL 以便離線可用。
3. **手勢失效是設計前提，不是例外。** Safari 的使用者啟動（`navigator.share` 需要）大約 1 秒就過期，
   產生 PDF 通常超過這個時間。所以「先直接嘗試分享、失敗再顯示『分享』按鈕」兩條路都要有，且都要測。
4. **保留既有分頁結果，不重排。** 沿用 `print-pages.js` 的分頁（iOS 頁高 263mm，PDF 內容放在 A4 上緣、下方多留約 14mm）。
   與 iPhone 現在列印的版面一致，不引入第二套分頁。
5. **檔名**用現有的 `document.title`（`preparePrint` 已依工程名稱／日期／範圍設好），加 `.pdf`；
   產生完立刻還原標題（分享路徑不會有 `afterprint`）。`print-pages.js` 的 `setPrintDocumentTitle` 改成可手動還原。
6. **覆寫開關** `?export=share`／`?export=print`：電腦上也能驗證分享路徑，出問題時可改走列印。不寫進任何畫面。
7. **產生 PDF 的程式放新檔 `pdf-share.js`**（IIFE，掛 `window.PdfShare` 與 `window.outputPrint`），樣式放 `pdf-share.css`；
   六個頁面各加兩行引用。五個工具檔把 `window.print()` 換成 `outputPrint()`。

## 5. 元件

| 檔案 | 內容 |
|---|---|
| `pdf-share.js`（新） | 平台判斷、PDF 組檔 `buildPdf`、隱藏 iframe 轉圖、對話框（進度／完成／錯誤）、`outputPrint` |
| `pdf-share.css`（新） | 對話框與進度圈，沿用 `glass.css` 的色彩變數；尊重 `prefers-reduced-motion`；列印時隱藏 |
| `vendor/html-to-image-1.11.13.min.js`（新） | 第三方轉圖函式庫（去掉 sourceMappingURL 那行） |
| `print-pages.js` | `setPrintDocumentTitle` 可還原；匯出 `restorePrintDocumentTitle` |
| `app.js` `wall-gc.js` `rebar.js` `steel.js` `template.js` | `window.print()` → `outputPrint()` |
| `plan.js` | `window.print()` → `outputPrint({ pdf: false })`（只加保險說明） |
| 六個 HTML | 引用 `pdf-share.css`、`pdf-share.js` |
| `sw.js` | APP_SHELL 加三個檔、`CACHE_NAME` 升版（v140 → v142） |
| `scripts/build_share.py` | 對外展示版要多複製 `vendor/html-to-image-*.min.js`（它不是 `<script>` 標籤引用，不會被自動收進去） |

## 6. 錯誤處理

・ 函式庫載入失敗（第一次離線）、iframe 轉圖失敗、canvas 配不到記憶體：對話框顯示「無法產生 PDF」與簡短原因，
  不退回 `window.print()`（在主畫面模式它不會有反應，反而讓人以為壞了）。
・ 使用者在產生中按取消：停止迴圈、移除 iframe、關閉對話框。
・ 重複點擊：產生中再點會被忽略。
・ 每頁轉成 JPEG 後立刻把 canvas 尺寸設為 0，釋放 iOS 的 canvas 記憶體。

## 7. 測試

自動（新增）：
・ `scripts/verify_pdf_share.mjs`（Node）：`buildPdf` 的結構（標頭、物件偏移、頁數、MediaBox、圖片尺寸）、平台判斷表、檔名清理。
・ `scripts/verify_pdf_share.py`（Playwright，Chromium 與 WebKit）：五個工具頁在「iOS 使用者代理＋模擬分享」下，
  單頁／整份產生的 PDF 頁數與 `.print-page` 數相同、每頁有內容、檔名正確；電腦使用者代理走 `window.print()`；
  手勢失效路徑出現「分享」按鈕且再點能分享；取消、重複點擊、函式庫載入失敗；畫面在轉圖期間沒有消失。
・ 既有 `verify_data.py`（216）、`verify_print_layout.py`（15）、`verify_login_page.py`（40）、`verify_auth.mjs`（49）全部仍要通過。

手動（階段 3）：iOS 27 模擬器的 Safari 與主畫面 App，真正的 App 走完整流程，記錄耗時與手勢失效是否發生。

## 8. 風險與尚未驗證

・ 模擬器是 iOS 27.0，使用者手機是 27.0.1。
・ LINE／Email 實際收到檔案、十頁以上長紀錄在真機的速度與記憶體，只能在真機測。
・ iOS 27 的手勢存活時間未知；兩條路都做就是為了不依賴它。
・ WebKit 把圖片先畫成空白的問題：以「檢查 img 區域有沒有內容、空白就重畫」處理，iOS 27 上是否仍需要要實測。

## 9. 回復方式

分支未合併前正式版不受影響。上線後若有問題：還原這批提交；使用者端可在網址加 `?export=print` 暫時走原本的列印。
