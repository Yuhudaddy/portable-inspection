# 施工計畫頁、編號欄位整理、構件刪除 — 設計

日期：2026-09-20

## 目標

1. 每個工程工具（01／06 連續壁、02 模板、03 鋼筋、04 鋼構）右上角改為「計畫」按鈕，開啟該工程的
   施工計畫頁；計畫有「精簡版／完整版」下拉，含封面、修訂紀錄、目錄與正文，可列印成 PDF，
   日後作為公司施工計畫的主要輸出。
2. 01／06 的編號欄位：導溝用「軸線／方向編號」；連續壁與鋼筋籠用「單元編號」「順序編號」，兩分頁綁同一份資料。
3. 02 模板、03 鋼筋的構件可以刪除（二階段按鈕，不用彈出視窗）。

---

## 一、施工計畫頁

### 路由與檔案

```
plan.html                 共用頁（一頁）；網址 ?work=<key>&from=<tool>
plan.js                   讀網址、載入內容、彩現封面／修訂紀錄／目錄／正文、版本切換、列印
plan.css                  文件版面（螢幕＋列印）
plans/diaphragm-wall.js   連續壁工程施工計畫（01、06 共用）
plans/formwork.js         模板工程施工計畫（02）
plans/rebar.js            鋼筋工程施工計畫（03）
plans/steel.js            鋼構工程施工計畫（04）
```

- `work` 允許值：`diaphragm-wall`、`formwork`、`rebar`、`steel`；不合法時顯示「找不到這份計畫」並提供回首頁連結。
- `from` 允許值：`diaphragm-wall-gc`、`diaphragm-wall`、`template`、`rebar`、`steel-structure`；用於「返回」連結
  與封面預填；不合法時「返回」指向首頁。
- 五個工具頁 `header` 右上的 `#record-identity` 標籤移除，換成
  `<a class="glass-pill header-plan" href="./plan?work=…&from=…"><svg 文件圖示/>計畫</a>`。
  `updateIdentity()` 只保留同步鋼筋籠欄位的部分，不再寫 header 文字。
- `sw.js`：`APP_SHELL` 加 `./plan`、`./plan.js`、`./plan.css`、`./plans/diaphragm-wall.js`、`./plans/formwork.js`、
  `./plans/rebar.js`、`./plans/steel.js`；`CACHE_NAME` 升版。`scripts/serve.py` 的 `.html` 補檔規則已涵蓋 `/plan`。
- 各工具頁說明對話框的 `help-notes` 補一句：「右上角『計畫』可查看本工程施工計畫，並可列印成 PDF」。

### 內容資料格式（`plans/*.js`，全域常數 `PLAN_CONTENT[work]`）

```js
PLAN_CONTENT["diaphragm-wall"] = {
  title: "連續壁工程施工計畫",
  subtitle: "DIAPHRAGM WALL CONSTRUCTION PLAN",
  sources: ["建築工程地下連續壁施工準則 TGS-EXCAVD114", "…"],   // 封面背面「參考規範」清單
  sections: [
    {
      id: "overview", heading: "工程概述", level: "brief",       // brief：兩版都有；full：只有完整版
      blocks: [
        { type: "p", text: "…" },
        { type: "ul", items: ["…"] },
        { type: "ol", items: ["…"] },                              // 施工步驟
        { type: "table", caption: "…", head: ["…"], rows: [["…"]], note: "出處：…" },
        { type: "callout", title: "現場提醒", text: "…" },        // 極淡底色提示框
        { type: "p", text: "…", level: "full" }                   // 區塊也可標 full：精簡版略過
      ],
      children: [ { id, heading, level, blocks } ]                 // 只到第二層（1.1）
    }
  ]
};
```

- 章節編號由彩現器依順序產生（1、1.1）；精簡版略過 `level: "full"` 的章節與區塊後重新編號。
- 品質管制章節的表格以 App 查驗表為準，列「項目｜判定標準｜對應查驗表」，
  對應欄寫法如「導溝施工複核表 第 4 項」；內容以手工同步，`docs/check-items/` 為對照來源。
- 規範數值（保護層、坍度、扭力、公差）在表格 `note` 或段落末以「（出處：規範名稱 章節）」註明；
  只引名稱與條號，不整段引用。

### 文件框架

```
螢幕                                    列印（A4 直向）
┌ header ─────────────────────────┐    第 1 頁  封面
│ ‹ 返回查驗表  [精簡版 ▾] [輸出 PDF] │    第 2 頁  修訂紀錄 ＋ 參考規範
├ 封面卡 ──────────────────────────┤    第 3 頁  目錄
│ logo／計畫名稱／版本／工程資訊       │    第 4 頁起 正文（章節自然分頁）
├ 修訂紀錄（可編輯表格）─────────────┤
├ 目錄（寬：左側固定；窄：頂端展開）─┤
├ 正文 ────────────────────────────┤
└──────────────────────────────────┘
```

- 封面欄位：工程名稱、施工廠商、編製單位、編製日期、版次（文字）。首次開啟時工程名稱、施工廠商
  從 `from` 工具的草稿（`project-portal.<tool>.draft` 的 `overview.project`／`overview.contractor`）帶入；
  之後使用者改了就以計畫頁自己的草稿為準。
- 修訂紀錄：欄位「版次｜日期｜修訂內容｜編製」，可新增／刪除列，預設一列 `A｜今天｜初版｜（空）`。
- 版本下拉：`精簡版`／`完整版`，存在計畫草稿；封面右下與 PDF 檔名都標示版本。
- 計畫頁草稿：`createDraftStore("project-portal.plan.<work>.draft", …)`，內容
  `{ version, cover: { project, contractor, author, date, revision }, revisions: [ { version, date, note, author } ] }`。
  只存這些，不存正文。
- 目錄：由章節自動產生，項目連到 `#section-<id>`；列印不印頁碼（瀏覽器無法在頁尾印頁碼，
  又不採固定分頁避免長文截字）。
- PDF 檔名：`<計畫名稱>_<工程名稱>_<精簡版|完整版>_<日期>.pdf`（沿用各工具 `setPdfDocumentTitle` 的作法：
  改 `document.title` 後 `window.print()`）。

### 版面

- 白底、內文欄寬 760px、字型沿用 `glass.css`（PingFang TC／Noto Sans TC），行高 1.7。
- 顏色只用 `glass.css` 既有變數：文字 `--glass-ink`／`--glass-soft`，提示框與表頭底色 `--glass-sunken`
  或 `oklch(96% 0.01 250)` 等極淡色，分隔線 `--glass-line`；不新增鮮豔色。
- 封面：上方大成 logo（`taisei.png`）、計畫名稱（大字）、英文副標（小字、字距寬）、工程資訊兩欄表、
  右下角版次＋版本。
- 章節標題：編號用數字字型、標題與下方細線；表格 hairline、表頭極淡底；提示框左側 2px 淡色邊。
- 列印：`@page { size: A4; margin: 18mm 16mm; }`；封面、修訂紀錄、目錄各 `break-after: page`；
  `h2 { break-after: avoid }`、`tr { break-inside: avoid }`、表格 `thead` 重複；header、目錄側欄、
  編輯用按鈕 `display: none`。

### 內容章節（兩版）

```
                          精簡版  完整版
1  工程概述                 ●       ●     範圍、適用對象、與其他工程介面
2  適用規範與參考文件        ●       ●
3  施工組織與人力            －       ●
4  機具設備與材料            ●       ●     精簡版只列主要機具與材料規格
5  施工流程                  ●       ●     步驟清單（ol）＋各階段要點
6  施工方法與要點            ●       ●     依分項展開（連續壁：導溝、成槽、鋼筋籠、澆置…）
7  品質管制                  ●       ●     對應 App 查驗表的表格；完整版多「不合格處置、檢驗頻率」
8  安全衛生                  ●       ●     精簡版只列本工程特有風險
9  環境保護                  －       ●
10 進度與介面管理            －       ●
11 緊急應變                  －       ●
12 附錄：查驗表對照          －       ●     列出 App 各表名稱與用途
```

四份工程的章節骨架相同，內容依工程撰寫；連續壁那份的品質管制以 01 的停檢點 1～4、導溝、鋼筋籠三張表
為準（06 施工紀錄與 01 共用同一份計畫）。

---

## 二、編號欄位（01、06）

```
                     01 營造廠查驗（state.unit）        06 施工紀錄（state.wall）
導溝分頁             新增 guideWall.axisNo「軸線／方向編號」   同
連續壁分頁           unitNo 標籤改回「單元編號」；sequenceNo 不動   同
鋼筋籠分頁           兩個可編輯輸入框 data-bind="unit.unitNo"／"unit.sequenceNo"
                     （06 綁 wall.*），任一分頁輸入即同步另一分頁
```

- 現有 `#rebar-cage-unit` 唯讀欄位改為兩個一般輸入框；`updateIdentity()` 改為 `syncUnitInputs()`：
  把所有 `[data-bind="unit.unitNo"]`／`[data-bind="unit.sequenceNo"]` 的值寫成 state 值（跳過正在輸入的那個）。
- 鋼筋籠 PDF「鋼筋籠資料」印「單元編號｜順序編號｜鋼筋籠編號｜核定配筋圖號」；表頭 identity 維持
  `單元編號｜鋼筋籠編號`。
- 導溝 PDF 表頭 identity 改印 `axisNo`（空白時印「未填軸線」），取代「不分單元」；檔名的 recordId 用 `axisNo`。
- JSON `schema_version` 1.4 → 1.5：`guide_wall_review.axis_no`；匯入舊檔 `axis_no` 缺省為空字串。
  Markdown 導溝段落多一行「軸線／方向編號」。
- `verify_data.py` 內「不分單元」的斷言改為軸線編號；schema 斷言改 1.5。
- `docs/check-items/` 不變（不是檢查項目）。

---

## 三、構件刪除（02、03）

```
[ × ] ──點一下──▶ [🗑] 紅底白圖示膠囊 ──再點──▶ 刪除
                    4 秒未再點、或點到別處 → 恢復成 ×
```

- 共用作法（各自寫在 template.js／rebar.js，樣式放 `glass.css` 的 `.two-step-delete`）：
  按鈕 `data-remove-member="<index>"`；第一次點加 `is-armed` class 並換成垃圾桶 svg、`aria-label="確認刪除"`，
  啟動 4 秒計時；第二次點才 `splice`。`document` 上的 click 若目標不是該按鈕，解除 armed。
- 03 鋼筋：放在表格「操作」欄「編輯配筋」右側；明細列裡原本的「移除構件」拿掉。
- 02 模板：放在構件卡片標題列右側（取代小字「移除」），不再限制至少保留一筆。
- 修 bug：template.js 的 `data-remove-member` 處理搬到 click 處理器。
- 可刪到 0 筆：`activeMember()` 已回傳 null；列表顯示「尚無構件，請按＋新增構件」，
  PDF 構件表印「尚無構件」列，其他分頁的構件下拉顯示「尚無構件」。刪除作用中的構件時 `activeMember` 改為前一筆。

---

## 四、驗證

- `scripts/verify_data.py`
  - 兩頁：導溝軸線編號進 PDF 表頭與 JSON `axis_no`，來回一致；鋼筋籠分頁改單元／順序編號後連續壁分頁同值，
    PDF 鋼筋籠資料印出順序編號。
  - 02、03：點一次刪除鈕不刪且變 armed；再點才刪；armed 後 4.5 秒逾時恢復；刪到 0 筆無 pageerror、PDF 印「尚無構件」。
  - 計畫頁：四個 work × 兩版彩現無 pageerror，目錄項目數＝章節數，精簡版章節數 < 完整版；`from` 帶入工程名稱；
    版本切換後 `document.title` 含版本字樣。
- `scripts/verify_print_layout.py`：新增計畫頁四份完整版 PDF，檢查第 1 頁含計畫名稱且不含「修訂紀錄」，
  第 2 頁含「修訂紀錄」，第 3 頁含「目錄」，總頁數 ≥ 4。
- 瀏覽器實測：五個工具頁的計畫按鈕；計畫頁桌機／手機（375px）版面與列印預覽；二階段刪除的視覺。
- `scripts/render_example_pdfs.py` 重產範例（工具頁表頭與鋼筋籠資料變了）；計畫頁不列入範例。
- README：工具清單補「計畫」按鈕與 `plan.html`；JSON 版本改 1.5。
