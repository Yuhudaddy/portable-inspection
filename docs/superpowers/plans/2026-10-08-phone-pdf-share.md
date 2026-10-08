# iPhone 輸出 PDF（分享選單）實作計畫

設計：`docs/superpowers/specs/2026-10-08-phone-pdf-share-design.md`。每個任務先寫會失敗的測試，再寫程式，再跑到全綠。
工作分支 `feature/phone-pdf-share`（本機，未推送）。

## 任務

1. **函式庫與快取清單**
   `vendor/html-to-image-1.11.13.min.js`（已與 npm 套件逐位元組比對、MIT 授權檔一併放入）；`sw.js` APP_SHELL 加入
   `pdf-share.css`、`pdf-share.js`、函式庫，`CACHE_NAME` 升版（v140 → v142）；`scripts/build_share.py` 複製函式庫與授權檔。

2. **標題可還原**（`print-pages.js`）
   `setPrintDocumentTitle` 登記還原函式；新增 `restorePrintDocumentTitle()`；原本 `afterprint` 還原行為不變。

3. **純函式與 PDF 組檔**（`pdf-share.js` 前半）— 測試 `scripts/verify_pdf_share.mjs`
   `buildPdf`、`isIosDevice`、`canShareFiles`、`exportMode`（含 `?export=` 覆寫）、`fileNameFor`。
   測試用 Node `vm` 載入原始檔，不需要瀏覽器；另用 `qpdf --check` 與 `pdfinfo` 驗證產出的檔案。

4. **轉圖流程、對話框、`outputPrint`**（`pdf-share.js` 後半、`pdf-share.css`）— 測試 `scripts/verify_pdf_share.py`
   隱藏 iframe 轉圖、進度／完成／錯誤對話框、分享成功／手勢失效／取消、`outputPrint` 分流與 iOS 主畫面保險。
   Playwright 用 Chromium 與 WebKit；iOS 使用者代理加模擬的 `navigator.share`，用 PyMuPDF 檢查產出的 PDF。

5. **接上六個頁面**
   五個工具檔 `window.print()` → `outputPrint()`；`plan.js` → `outputPrint({ pdf: false })`；六個 HTML 加引用。
   用 `verify_print_layout.py` 的資料填充腳本把每個工具填滿，確認頁數與列印一致。

6. **既有驗證全跑**：`verify_data.py`、`verify_print_layout.py`、`verify_login_page.py`、`verify_auth.mjs`。

7. **文件**：README 的匯出說明與驗證表；記憶檔。

8. **階段 3：iOS 27 模擬器**：Safari 與主畫面 App 各跑一次真正的 App 完整流程；記錄耗時、手勢是否失效、PDF 頁面內容。
