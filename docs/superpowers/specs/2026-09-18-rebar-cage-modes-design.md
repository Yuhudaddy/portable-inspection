# 鋼筋籠配筋抽查「簡易／詳細」模式與鋼筋號數下拉 — 設計

日期：2026-09-18

## 目標

1. 鋼筋號數統一改為下拉選單（13 個尺寸），畫面顯示 `D10（#3）`，PDF 只印 `#3`。
   適用：鋼筋工程（rebar.html）、連續壁鋼筋籠（01 營造廠查驗、06 施工紀錄）、導溝「鋼筋」項目。
2. 兩頁連續壁工具的「鋼筋籠吊放前複核 → 配筋抽查明細」改為 13 個固定部位，並提供
   「簡易／詳細」兩種填寫模式；PDF 依模式印出對應版面。

## 鋼筋號數

```
D10（#3）  D13（#4）  D16（#5）  D19（#6）  D22（#7）  D25（#8）  D29（#9）
D32（#10） D36（#11） D39（#12） D43（#14） D50（#16） D57（#18）
```

- 資料一律存 `D` 名稱（`"D32"`）；`barSizeLabel("D32") → "D32（#10）"`；`barSizeMark("D32") → "#10"`。
- 舊資料裡不在清單的值（`D35`、`D38`、`D41`、`D51`）：下拉多一個 `D35（舊）` 選項保留原值；
  `barSizeMark` 對未知值原樣回傳。
- 共用檔 `bar-sizes.js`（全域常數與兩個 helper），rebar.html、diaphragm-wall.html、
  diaphragm-wall-gc.html 皆載入；加入 `sw.js` APP_SHELL 並升版。

## 13 個固定部位

| # | 部位 | 樣板 | 對稱 | 簡易說明 |
|---|------|------|------|----------|
| 1 | 外側 垂直 主筋 | 區間 | 可勾（連動 2） | 依設計圖說配置 |
| 2 | 內側 垂直 主筋 | 區間 | 由 1 推導 | 依設計圖說配置 |
| 3 | 外側 水平 溫度筋 | 區間 | 可勾（連動 4） | 依設計圖說配置 |
| 4 | 內側 水平 溫度筋 | 區間 | 由 3 推導 | 依設計圖說配置 |
| 5 | 水平 正交繫筋 | 區間 | 可勾 | 依設計圖說配置 |
| 6 | 垂直 小斜拉筋 | 區間 | 可勾 | 依設計圖說配置 |
| 7 | 水平 小斜拉筋 | 區間 | 可勾 | 依設計圖說配置 |
| 8 | 單元接頭垂直補強筋 | 單列 | 可勾 | 依設計圖說配置 |
| 9 | 端板擋筋(母單元) | 單列 | 可勾 | 依設計圖說配置，銲喉4mm且銲長至少50mm |
| 10 | V型固定加強筋 | 單列 | 可勾 | 依設計圖說配置 |
| 11 | 交叉大斜拉筋 | 單列 | 可勾 | 依設計圖說配置 |
| 12 | 垂直護耳 | 單列 | 可勾 | 依設計圖說配置 |
| 13 | 水平護耳 | 單列 | 可勾 | 依設計圖說配置 |

部位定義是常數（`rebar-cage.js`），不存進資料；資料只存 `key`。

## 資料結構

```
state.rebarCage = {
  date, cageNo, drawingNo, note,            // 不動（06 另有 reviewer 由 overview 持有）
  mode: "simple" | "detailed",              // 預設 "simple"
  parts: [                                  // 固定 13 筆，順序同上表，取代原本的 rebars[]
    // 區間型（1～7）
    { key, result, symmetric,
      intervals: [ { top, bottom, size, spacing, extra: { enabled, size, spacing } } ] },
    // 單列型（8～13）
    { key, result, symmetric, count, size, spacing }
  ],
  checks                                    // 組裝與吊放條件，不動
}
```

- `result`：`待確認｜符合｜不符合｜不適用`，兩種模式共用同一個值。
- `symmetric`：布林；內側部位（2、4）不存，顯示與列印時取配對外側部位的值。
- `top`／`bottom`：字串，GL 以下深度（m）的正數，例如 `"10"`、`"12.5"`；空字串＝未填。
- `spacing`／`count`：字串數字；空字串＝未填。
- 區間型預設 1 個空區間；`extra.enabled` 預設 `false`。
- 切換 `mode` 只影響顯示與列印，不清資料。

## 畫面（兩頁相同）

### 模式切換
「配筋抽查明細」分頁標題列右側放滑動藥丸切換（Transitions.dev 作法）：

```html
<div class="t-tabs" role="tablist" aria-label="填寫模式">
  <span class="t-tabs-pill" aria-hidden="true"></span>
  <button class="t-tab" role="tab" aria-selected="true" data-cage-mode="simple">簡易</button>
  <button class="t-tab" role="tab" aria-selected="false" data-cage-mode="detailed">詳細</button>
</div>
```

- 點擊：翻轉 `aria-selected`，把選中鈕的 `offsetLeft`／`offsetWidth` 寫到藥丸的 `transform`／`width`。
- 首次繪製、resize、切到鋼筋籠工具時：以 `transition: none` 寫入位置、強制 reflow 後恢復，避免藥丸從 0 滑過來。
- 顏色改用 glass.css 變數（列 `--glass-sunken` 底、`--glass-card-bg` 藥丸、`--glass-ink` 文字），
  不用範例的深灰配色；尊重 `prefers-reduced-motion`。
- 拿掉「＋ 新增」按鈕與卡片上的「刪除」；抽查明細進度改為 `已判定 / 13`。

### 卡片
- 簡易：`項次｜部位｜簡易說明｜三態結果（glass-segmented）`，沒有填寫鈕。
- 詳細：`項次｜部位｜對稱勾選（有的話）｜填寫鈕`，下方摘要列＝PDF 會印的內容
  （例 `GL-0～-10：#10@60`、`GL-20～-30：#10@60+#10@15`、`3 支 #6`、`@200`；未填印「尚未填寫」），
  三態結果同簡易。
- 內側部位（2、4）在外側勾對稱時：摘要改為「同外側」、隱藏填寫鈕、結果三態仍可各自選。

### 填寫彈出視窗（沿用 `.sheet-dialog`，只在詳細模式使用）
區間型：

```
[深度區間 1]                                   （區間 ≥2 時有「移除」）
  頂部 GL −[ 10 ] m     底部 GL −[ 20 ] m       placeholder「例如：10」
  號數 [ D32（#10） ▼ ]  間距 [ 60 ] cm
  補強插筋 [ ] 啟用   → 勾了才出現：號數 [ ▼ ]  間距 [ ] cm
[＋ 加一個深度區間]
```

單列型：`支數 [ ] 支　號數 [ ▼ ]　間距 [ ] cm`。

- 深度輸入 `type="number" min="0" step="0.01"`；失焦時負數取絕對值。
- 紅框（`.is-invalid`，只提示不擋存檔）：同區間 `bottom ≤ top`；下一區間 `top < 前一區間 bottom`。
- 存檔：以 `editIndex.rebar`（部位索引）寫回 `state.rebarCage.parts[i]`，再 `renderRebars()`。

## PDF

同一張「鋼筋籠吊放前複核表」頁（01 序號 04、06 序號 07）的「配筋抽查明細」區塊，依 `mode` 印其一：

簡易 `.rebar-cage-print-table.is-simple`

```
項次 | 部位 | 說明 | 結果          欄寬 7% | 26% | 自動 | 12%
```

詳細 `.rebar-cage-print-table.is-detailed`

```
項次 | 部位 | 頂部(m) | 底部(m) | 支數 | 號數@間距(cm) | 對稱 | 結果
 7%  | 20%  |   10%   |   10%   |  7%  |     自動      |  7%  | 12%
```

- 區間型印一列／區間；`項次`、`部位`、`對稱`、`結果` 用 `rowspan` 合併。
- 儲存格內容：`top`→`GL-10`（照輸入數字）；`號數@間距`＝`#10@60`，補強啟用加 `+#10@15`；
  單列型依有填的組出 `#6`、`@200`、`#10@600`；空值一律 `-`；對稱 `✔`／`-`。
- 內側「同外側」：頂部／底部／支數／號數@間距皆 `-`，對稱 `✔`。
- 結果印文字（未填「待確認」），與現況一致。
- 印列數變多時由 `print-pages.js` 分頁；簽名欄位置以 `verify_print_layout.py` 確認。

## 匯出／匯入

- `schema_version` `1.3 → 1.4`。`rebar_cage_review.rebar_items` 改為：

```json
"mode": "detailed",
"parts": [
  { "item_no": 1, "key": "outerVertical", "part": "外側 垂直 主筋", "symmetric": false, "result": "符合",
    "intervals": [ { "top_m": 0, "bottom_m": 10, "bar_size": "D32", "spacing_cm": 60,
                     "extra": null } ] },
  { "item_no": 8, "key": "jointVertical", "part": "單元接頭垂直補強筋", "symmetric": true, "result": "符合",
    "count": 3, "bar_size": "D19", "spacing_cm": null }
]
```

  數值欄位匯出為數字或 `null`；`extra` 未啟用為 `null`。內側部位的 `symmetric` 匯出推導後的值。
- 匯入：依 `key` 對應（沒有 `key` 就依 `part` 名稱），缺的部位補預設；1.3 以前的 `rebar_items` 忽略。
- 草稿：`normalizeLoadedState` 看到 `rebarCage.rebars` 且沒有 `parts` 時，`parts` 設為預設、
  `mode` 設 `simple`，並刪除 `rebars`。
- Markdown 匯出：簡易印四欄表、詳細印八欄表（多區間以 `／` 串在同一格）。

## 鋼筋工程（rebar.js）

- `BAR_SIZES` 改用 `bar-sizes.js`；下拉顯示 `D32（#10）`；PDF 與 Markdown 的配筋文字改印 `#10`。
- 其他不動。

## 導溝

- 兩頁的 `GUIDE_REBAR_SIZES` 改用 `bar-sizes.js`；下拉顯示 `D16（#5）`；PDF `現場紀錄／實測` 印 `號數 #5；間距 20 cm`。

## 共用檔

- `bar-sizes.js`：`BAR_SIZES`、`barSizeLabel`、`barSizeMark`、`barSizeOptions(selected)`。
- `rebar-cage.js`：`REBAR_CAGE_PARTS`（13 筆定義）、`createRebarCageParts()`、
  `rebarCageSummary(part, parts)`、`renderRebarCageCards(...)`、`rebarCagePrintTable(state)`、
  `exportRebarCageParts`／`importRebarCageParts`、對話框開啟／讀寫。兩頁的 `wall-gc.js`／`app.js`
  只保留事件掛載與呼叫。
- 兩個檔都加進 `sw.js` 的 `APP_SHELL`，並升快取版本；三個 HTML 在工具 script 之前載入。

## 驗證

- `scripts/verify_data.py`：schema 1.4；新增「詳細模式每部位填 2 區間＋補強 → 匯出 → 清空 → 匯入 → 一致」；
  舊 1.3 JSON 匯入後 `parts` 為預設且不報錯；舊草稿（有 `rebars`）載入後 `parts` 為預設。
- `scripts/verify_print_layout.py`：兩頁各加「詳細模式、每部位 3 個區間」情境。
- 瀏覽器實際操作兩頁：模式切換與藥丸動畫、開視窗填區間、紅框、對稱連動、PDF 兩種版面。
- `docs/check-items/` 兩份清單的「鋼筋籠吊放前複核－配筋部位」改為 13 項。
- 以 `scripts/render_example_pdfs.py` 重新產生 examples（含先前導溝項目改名後已過期的範例）。
