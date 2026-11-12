// 改善表：一組表頭資料加上多張改善照片，排成 A4（每頁 3 張）或 A3 橫向（每頁 12 張）。
//
// 資料只存在這台裝置：
//   ・ 自動保存：IndexedDB（同一個瀏覽器下次打開會接著編輯）
//   ・ 專案檔：.json，內含照片與所有文字，換裝置或傳給別人後可開啟再編輯
// 輸出：電腦走列印（紙張尺寸由 @page 命名頁決定）；iPhone／iPad 把每頁轉成圖片、組成 PDF，交給分享選單。
//
// 版面與資料都用 mm 排版，螢幕預覽以 transform 等比縮小，輸出時用未縮放的離屏副本。
(() => {
  "use strict";

  const SCHEMA = "improvement-sheet";
  const VERSION = 1;
  // ---------- 介面文字（繁體中文／日本語） ----------
  // 語言跟著專案的 state.lang 走：切換後介面、表單與 PDF 一起換。日文用語是暫定的，待確認後只改這張表。
  const UI = {
    zh: {
      skip: "跳至改善表", back: "返回工具首頁", navAria: "主要功能", trash: "清除表頭與照片", langBtn: "語言",
      toolSub: "缺失改善照", toolName: "改善表", tabsAria: "改善表分頁",
      "tab.info": "表頭", "tab.photos": "照片", "tab.preview": "預覽", "panel.info": "表頭資料",
      "field.project": "工程名稱", "field.work": "施工項目", "field.contractor": "承包單位",
      "opt.paper": "版型", "seg.a4": "A4・3 張", "seg.a3": "A3・12 張", "seg.a4Title": "每頁 3 張", "seg.a3Title": "每頁 12 張",
      "opt.fit": "照片顯示", "fit.auto": "自動", "fit.contain": "完整", "fit.cover": "填滿", "help.fitAria": "說明：照片顯示",
      "help.fitAuto": "<b>自動</b>：照片比例接近格子時填滿，否則完整",
      "help.fitContain": "<b>完整</b>：整張照片都看得到，可能留白",
      "help.fitCover": "<b>填滿</b>：蓋滿格子，邊緣可能被裁掉",
      "opt.side": "照片位置", "side.left": "照片左側", "side.right": "照片右側",
      "toggle.date": "同日施工", "toggle.loc": "同地點施工",
      "toggle.dateTitle": "全項目與第一張照片的日期同步", "toggle.locTitle": "全項目與第一張照片的施工地點同步",
      "btn.save": "儲存專案檔", "btn.open": "開啟專案檔", "btn.exportPdf": "輸出 PDF", "btn.share": "分享", "btn.undo": "復原",
      "photos.heading": "照片", "photos.count": "{n} 張", "empty": "還沒有照片。按右下角的＋，或直接把照片拖進來。",
      "help.nameAria": "說明：檔名怎麼帶入欄位", "help.nameTitle": "檔名格式", "help.nameFormat": "施工地點_改善內容_日期.jpg",
      "help.seg1": "<b>第 1 段</b>：自動填入「施工地點」", "help.seg2": "<b>第 2 段</b>：自動填入「改善內容」",
      "help.seg3": "<b>第 3 段</b>：自動填入「日期」，可省略。寫成 20261026 或 2026-10-26",
      "help.ext": "副檔名 png、jpg、jpeg、webp 都可以", "help.noUnderscore": "[文字].png：無底線文字判定為「改善內容」",
      "help.unsupported": "※其他格式不支援自動輸入", "help.redDot": "🔴：照片內容尚未填妥",
      "menu.aria": "照片：新增、拍照、清除", "menu.add": "新增", "menu.addAria": "新增照片",
      "menu.camera": "拍照", "menu.cameraAria": "拍照", "menu.clear": "清除", "menu.clearAria": "清除全部照片",
      "preview.heading": "預覽", "preview.meta": "{paper}・每頁 {per} 張・共 {pages} 頁・{n} 張照片",
      "sheet.date": "施工日期", "sheet.loc": "施工地點", "sheet.addPhoto": "＋ 新增照片",
      "ed.prev": "上一張", "ed.next": "下一張", "ed.close": "關閉", "field.loc": "施工地點", "field.content": "改善內容",
      "field.date": "日期", "locked": "與第一張同步", "ph.loc": "例：4F客室漏水", "ph.content": "例：打針改善",
      "ed.rotate": "旋轉", "ed.replace": "換照片", "ed.up": "上移", "ed.down": "下移", "ed.remove": "刪除",
      "tile.label": "No.{n}", "tile.incomplete": "，照片內容尚未填妥", "file.fallback": "改善表",
      "toast.notPhotos": "這些檔案不是照片", "status.adding": "正在加入 {n} 張照片…",
      "toast.namedFill": "已從檔名帶入 {n} 張照片的內容", "toast.failed": "有 {n} 張照片無法讀取，已略過",
      "toast.notPhoto": "這不是照片", "toast.readFail": "無法讀取這張照片", "toast.deleted": "已刪除 No.{n}",
      "toast.noAutosave": "這個瀏覽器無法自動保存，請用「儲存專案檔」備份。", "toast.restored": "已還原上次未存的內容",
      "toast.nothingToSave": "目前沒有內容可以儲存", "toast.notProject": "這不是改善表的專案檔",
      "confirm.openProject": "開啟專案檔會取代目前的內容。\n還沒存的照片與文字會消失，要繼續嗎？",
      "toast.opened": "已開啟 {name}", "status.readyShare": "檔案已準備好，請再按一次分享。", "status.shareFailed": "分享失敗：{msg}",
      "toast.addFirst": "請先加入照片", "confirm.overflow": "有 {n} 格改善內容超出格子，超出的文字會被截掉。\n要繼續輸出嗎？",
      "status.printHint": "請在列印視窗選擇「另存為 PDF」。紙張已依版型設定為 {paper}。", "status.exportFailed": "輸出失敗：{msg}",
      "toast.rotateFailed": "旋轉失敗", "toast.noPhotos": "目前沒有照片可以清除",
      "confirm.clearPhotos": "清除全部照片？\n表頭文字會保留，此動作無法復原。",
      "toast.nothingToClear": "目前沒有內容可以清除", "confirm.clearAll": "清除表頭與照片的內容？\n此動作無法復原。"
    },
    ja: {
      skip: "改善表へ移動", back: "ツールのトップへ戻る", navAria: "主な機能", trash: "見出しと写真をすべて消去", langBtn: "言語",
      toolSub: "是正写真", toolName: "是正写真表", tabsAria: "是正写真表のタブ",
      "tab.info": "見出し", "tab.photos": "写真", "tab.preview": "プレビュー", "panel.info": "見出しデータ",
      "field.project": "工事名", "field.work": "工種", "field.contractor": "請負業者",
      "opt.paper": "用紙", "seg.a4": "A4・3枚", "seg.a3": "A3・12枚", "seg.a4Title": "1ページ3枚", "seg.a3Title": "1ページ12枚",
      "opt.fit": "写真表示", "fit.auto": "自動", "fit.contain": "全体", "fit.cover": "全面", "help.fitAria": "説明：写真の表示",
      "help.fitAuto": "<b>自動</b>：写真の比率がマスに近いときは全面、それ以外は全体",
      "help.fitContain": "<b>全体</b>：写真全体が見えます。余白ができることがあります",
      "help.fitCover": "<b>全面</b>：マス全体を埋めます。端が切れることがあります",
      "opt.side": "写真の位置", "side.left": "左に写真", "side.right": "右に写真",
      "toggle.date": "同日施工", "toggle.loc": "同じ場所で施工",
      "toggle.dateTitle": "全項目を1枚目の写真の日付に合わせます", "toggle.locTitle": "全項目を1枚目の写真の施工場所に合わせます",
      "btn.save": "ファイルを保存", "btn.open": "ファイルを開く", "btn.exportPdf": "PDF を出力", "btn.share": "共有", "btn.undo": "元に戻す",
      "photos.heading": "写真", "photos.count": "{n}枚", "empty": "まだ写真がありません。右下の＋を押すか、写真をここにドラッグしてください。",
      "help.nameAria": "説明：ファイル名から項目への入力", "help.nameTitle": "ファイル名の形式", "help.nameFormat": "施工場所_改善内容_日付.jpg",
      "help.seg1": "<b>1つ目</b>：「施工場所」に自動入力", "help.seg2": "<b>2つ目</b>：「改善内容」に自動入力",
      "help.seg3": "<b>3つ目</b>：「日付」に自動入力（省略可）。20261026 または 2026-10-26 と書きます",
      "help.ext": "拡張子は png・jpg・jpeg・webp に対応", "help.noUnderscore": "[文字].png：アンダーバーのない文字は「改善内容」として扱います",
      "help.unsupported": "※ほかの形式は自動入力に対応していません", "help.redDot": "🔴：写真の内容が未入力です",
      "menu.aria": "写真：追加・撮影・消去", "menu.add": "追加", "menu.addAria": "写真を追加",
      "menu.camera": "撮影", "menu.cameraAria": "撮影", "menu.clear": "消去", "menu.clearAria": "写真をすべて消去",
      "preview.heading": "プレビュー", "preview.meta": "{paper}・1ページ {per}枚・全{pages}ページ・写真{n}枚",
      "sheet.date": "施工日", "sheet.loc": "施工場所", "sheet.addPhoto": "＋ 写真を追加",
      "ed.prev": "前の写真", "ed.next": "次の写真", "ed.close": "閉じる", "field.loc": "施工場所", "field.content": "改善内容",
      "field.date": "日付", "locked": "1枚目と同じ", "ph.loc": "例：4F客室の漏水", "ph.content": "例：注入による補修",
      "ed.rotate": "回転", "ed.replace": "差し替え", "ed.up": "前へ", "ed.down": "後ろへ", "ed.remove": "削除",
      "tile.label": "No.{n}", "tile.incomplete": "、写真の内容が未入力です", "file.fallback": "是正写真",
      "toast.notPhotos": "これらのファイルは写真ではありません", "status.adding": "{n}枚の写真を追加しています…",
      "toast.namedFill": "ファイル名から {n} 枚の写真の内容を入力しました", "toast.failed": "{n}枚の写真を読み込めず、スキップしました",
      "toast.notPhoto": "写真ではありません", "toast.readFail": "この写真を読み込めませんでした", "toast.deleted": "No.{n} を削除しました",
      "toast.noAutosave": "このブラウザでは自動保存できません。「プロジェクトを保存」でバックアップしてください。",
      "toast.restored": "前回保存していない内容を復元しました", "toast.nothingToSave": "保存する内容がありません",
      "toast.notProject": "是正写真表のプロジェクトファイルではありません",
      "confirm.openProject": "プロジェクトを開くと、今の内容は置き換えられます。\n保存していない写真と文字は消えます。続けますか？",
      "toast.opened": "{name} を開きました", "status.readyShare": "ファイルの準備ができました。もう一度「共有」を押してください。",
      "status.shareFailed": "共有に失敗しました：{msg}",
      "toast.addFirst": "先に写真を追加してください",
      "confirm.overflow": "{n} 件の改善内容がマスからはみ出しています。はみ出た文字は切れます。\n出力を続けますか？",
      "status.printHint": "印刷画面で「PDF として保存」を選んでください。用紙は {paper} に設定済みです。",
      "status.exportFailed": "出力に失敗しました：{msg}", "toast.rotateFailed": "回転に失敗しました",
      "toast.noPhotos": "消去する写真がありません",
      "confirm.clearPhotos": "写真をすべて消去しますか？\n見出しの文字は残ります。この操作は元に戻せません。",
      "toast.nothingToClear": "消去する内容がありません",
      "confirm.clearAll": "見出しと写真の内容を消去しますか？\nこの操作は元に戻せません。"
    }
  };
  const uiLang = () => (state.lang === "ja" ? "ja" : "zh");
  function t(key, vars = {}) {
    const text = UI[uiLang()][key] ?? UI.zh[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? vars[name] : `{${name}}`));
  }

  const PAPER = {
    a4: { per: 3, wmm: 210, hmm: 297, label: "A4" },
    a3: { per: 12, wmm: 420, hmm: 297, label: "A3" }
  };
  const FIT_OPTIONS = ["auto", "contain", "cover"];
  // 專案檔與自動保存讀回的照片只接受標準的 base64 圖片資料，其他字元（引號、角括號等）一律拒絕
  const DATA_URL = /^data:image\/(?:jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
  const MAX_SIDE = 1600;          // 照片長邊上限（px），A3 每格約 100mm，列印仍清楚
  const JPEG_Q = 0.85;
  const SAVE_DELAY_MS = 1500;     // 自動保存會把所有照片整份寫入，間隔拉長；離開頁面時另外立即存
  const CANCELLED = Object.assign(new Error("已取消"), { name: "Cancelled" });
  const DB_NAME = "improvement-sheet";
  const STORE = "kv";
  const KEY = "state";

  // 控制項與狀態欄位的對應：畫面同步與事件綁定都用這三張表
  const TEXT = { fProject: "project", fWork: "work", fContractor: "contractor" };
  const RADIOS = ["paper", "fit", "side"];
  const TOGGLES = { togDate: "sameDate", togLoc: "sameLoc" };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // 第一次開啟時，瀏覽器語言是日文就預設輸出日文；其他一律繁體中文
  const defaultLang = () => (/^ja\b/i.test(navigator.language || "") ? "ja" : "zh");

  function blank() {
    return { paper: "a4", fit: "auto", side: "left", lang: defaultLang(), sameDate: false, sameLoc: false, project: "", work: "", contractor: "", items: [] };
  }
  let state = blank();
  let editingId = null;          // 編輯面板目前顯示的照片；面板關閉時是 null
  let replaceId = null;          // 換照片時，選擇器選到的檔案要取代哪一張；null 代表新增
  let exporting = false;
  let saveTimer = 0;
  let toastTimer = 0;
  let previewTimer = 0;
  let dropEl = null;
  let autosaveWarned = false;
  let lastPreviewWidth = 0;

  // ---------- 小工具 ----------
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10);
  const pad = n => String(n).padStart(2, "0");
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const fmtDate = s => (s ? s.replace(/-/g, "/") : "");
  const pageCount = () => Math.max(1, Math.ceil(state.items.length / PAPER[state.paper].per));
  const hasContent = () => state.items.length > 0 || !!(state.project || state.work || state.contractor);
  const isImageFile = f => f.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name);
  const clampAt = at => Math.max(0, Math.min(state.items.length, at ?? state.items.length));
  const isOver = el => el.scrollHeight > el.clientHeight + 1;
  const photoDays = () => state.items.map(it => it.date).filter(Boolean).sort();

  // 施工日期：所有照片日期的最早～最晚；同一天只顯示一個
  function dateRange() {
    const days = photoDays();
    if (!days.length) return "";
    const first = days[0], last = days[days.length - 1];
    return first === last ? fmtDate(first) : `${fmtDate(first)} ～ ${fmtDate(last)}`;
  }

  // 同日施工／同地點施工：以第一張為準，其餘照片跟著它（欄位鎖定）
  function enforce(s = state) {
    const first = s.items[0];
    if (!first) return;
    if (s.sameDate) s.items.forEach(it => { it.date = first.date; });
    if (s.sameLoc) s.items.forEach(it => { it.loc = first.loc; });
  }

  // 檔名自動帶入欄位。格式：「施工地點_改善內容.jpg」，後面可再加日期「施工地點_改善內容_20261026.jpg」。
  // 規則刻意保守，寧可不帶也不要帶錯：
  //   ・ 用底線（_ 或 ＿）切開：第一段是地點，中間是內容（多段用空白連起來）；最後一段若是日期（20261026、2026-10-26）就當日期。
  //   ・ 沒有底線：整個檔名當「改善內容」（例如「漏水.jpg」）。
  //   ・ 相機與通訊軟體的預設檔名一律略過：IMG_1234、IMG1234、DSC01234、PXL_2026…、20261026_153000、微信图片…、Screenshot…。
  //   ・ 檔名尾端 Windows／Mac 重複檔案加的「 (1)」會先去掉；內容只剩數字（例如「_2」）就不當內容。
  const CAMERA_PREFIX = /^(?:IMG|DSC|DSCN|DSCF|PXL|MVIMG|IMAG|PHOTO|VID|WP|LINE|Screenshot|image|微信图片|微信圖片|螢幕截圖|螢幕快照|截圖|相片|照片)/i;
  const DATE_TAIL = /^(\d{4})[-./]?(\d{2})[-./]?(\d{2})$/;
  function parseFileName(name) {
    const base = String(name || "").replace(/\.[^.]+$/, "").replace(/\s*[(（]\d+[)）]\s*$/, "").trim();
    if (!base || CAMERA_PREFIX.test(base) || /^[A-Za-z]{1,6}[-_ ]?\d{3,}/.test(base) || /^[\d\s._:-]*$/.test(base)) return {};
    const parts = base.split(/[_＿]/).map(part => part.trim());
    const hadUnderscore = parts.length > 1;
    let date = "";
    const m = hadUnderscore && DATE_TAIL.exec(parts[parts.length - 1]);
    if (m && +m[2] >= 1 && +m[2] <= 12 && +m[3] >= 1 && +m[3] <= 31) {
      date = `${m[1]}-${m[2]}-${m[3]}`;
      parts.pop();
    }
    const meta = {};
    if (hadUnderscore) {
      if (parts[0]) meta.loc = parts[0].slice(0, 60);
      const content = parts.slice(1).filter(Boolean).join(" ");
      if (content && !/^[\d\s._:-]*$/.test(content)) meta.content = content.slice(0, 200);
    } else {
      meta.content = base.slice(0, 200);
    }
    if (date) meta.date = date;
    return meta;
  }

  function newItem(img, meta = {}) {
    const first = state.items[0];
    return {
      id: uid(), src: img.src, w: img.w, h: img.h,
      loc: first && state.sameLoc ? first.loc : (meta.loc || ""),
      date: first && state.sameDate ? first.date : (meta.date || today()),
      content: meta.content || ""
    };
  }

  // ---------- 照片讀取與旋轉 ----------
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("無法讀取圖片"));
      img.src = src;
    });
  }

  async function fileToImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const s = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * s));
      const h = Math.max(1, Math.round(img.naturalHeight * s));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";   // 透明的 PNG 轉成 JPEG 會變黑，先鋪白底
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      return { src: canvas.toDataURL("image/jpeg", JPEG_Q), w, h };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function rotateItem(it) {
    const img = await loadImage(it.src);
    const canvas = document.createElement("canvas");
    canvas.width = it.h;
    canvas.height = it.w;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, 0, 0, it.w, it.h);
    it.src = canvas.toDataURL("image/jpeg", JPEG_Q);
    [it.w, it.h] = [it.h, it.w];
  }

  // ---------- 照片清單的編輯動作 ----------
  async function importFiles(files, at) {
    const list = [...files].filter(isImageFile);
    if (!list.length) { toast(t("toast.notPhotos")); return; }
    showStatus(t("status.adding", { n: list.length }));
    const added = [];
    let failed = 0;
    let named = 0;
    for (const file of list) {
      try {
        const meta = parseFileName(file.name);
        added.push(newItem(await fileToImage(file), meta));
        if (meta.loc || meta.content || meta.date) named += 1;
      } catch (error) { failed += 1; }
    }
    clearStatus();
    if (added.length) {
      const start = clampAt(at);
      state.items.splice(start, 0, ...added);
      commit();
      // 直接進入還沒填地點的第一張，用 › 一張一張填；檔名已帶入的就不用再打開
      const missing = state.items.findIndex((it, i) => i >= start && i < start + added.length && !it.loc);
      if (missing >= 0) openEditor(missing);
      else if (named) toast(t("toast.namedFill", { n: named }));
    }
    if (failed) toast(t("toast.failed", { n: failed }));
  }

  async function replacePhoto(id, file) {
    const it = state.items.find(i => i.id === id);
    if (!it) return;
    if (!isImageFile(file)) { toast(t("toast.notPhoto")); return; }
    try {
      const img = await fileToImage(file);
      Object.assign(it, { src: img.src, w: img.w, h: img.h });
      commit();
    } catch (error) {
      toast(t("toast.readFail"));
    }
  }

  function removeItem(id) {
    const idx = indexOfId(id);
    if (idx < 0) return;
    const [item] = state.items.splice(idx, 1);
    if (editingId === id) editingId = (state.items[idx] || state.items[idx - 1] || { id: null }).id;
    commit();
    toast(t("toast.deleted", { n: idx + 1 }), {
      label: t("btn.undo"),
      run: () => {
        state.items.splice(Math.min(idx, state.items.length), 0, item);
        commit();
      }
    });
  }

  function moveItem(id, dir) {
    const idx = indexOfId(id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= state.items.length) return;
    [state.items[idx], state.items[to]] = [state.items[to], state.items[idx]];
    commit();
  }

  function setField(id, field, value) {
    const idx = indexOfId(id);
    if (idx < 0) return;
    state.items[idx][field] = value;
    // 只有第一張的地點／日期、且對應的開關開著，才需要把值帶到其他張
    if (idx === 0 && ((field === "loc" && state.sameLoc) || (field === "date" && state.sameDate))) {
      enforce();
      refreshValues();
    } else if (field === "loc" || field === "content") {
      refreshGridDots();   // 地點或內容填了、或清空，紅點要跟著變
    }
    schedulePreview();
    scheduleSave();
  }

  // ---------- 畫面渲染 ----------
  // 結構改變（增刪、換位、旋轉、開關）：清單與預覽整個重畫
  function render() {
    applyStaticText();
    renderControls();
    renderGrid();
    renderPreview();
    if ($("#editor").open) renderEditor();
  }

  function commit() {
    enforce();
    render();
    scheduleSave();
  }

  // 只改版型、照片顯示、照片位置：清單不受影響，只重畫預覽
  function refreshView() {
    renderControls();
    renderPreview();
    scheduleSave();
  }

  function renderControls() {
    Object.entries(TEXT).forEach(([id, key]) => {
      const el = $("#" + id);
      if (document.activeElement !== el) el.value = state[key];
    });
    RADIOS.forEach(name => $$(`input[name="${name}"]`).forEach(r => { r.checked = r.value === state[name]; }));
    $("#sideBlock").hidden = state.paper !== "a4";
    Object.entries(TOGGLES).forEach(([id, key]) => $("#" + id).setAttribute("aria-pressed", String(state[key])));
  }

  // ---------- 縮圖格 ----------
  // 每格只有縮圖與編號；施工地點還沒填的，右上角有紅點。填寫在編輯面板裡，不在格子上。
  // 「照片內容尚未填妥」：施工地點或改善內容任一還沒填，就在縮圖右上角顯示紅點
  const needsFill = it => !it.loc || !it.content;

  const tileLabel = (it, i) => `${t("tile.label", { n: i + 1 })}${needsFill(it) ? t("tile.incomplete") : ""}`;

  function tileHtml(it, i) {
    return `<button class="tile" type="button" data-id="${it.id}" data-idx="${i}" aria-label="${tileLabel(it, i)}">
      <img src="${esc(it.src)}" alt="">
      <span class="tile-no" aria-hidden="true">${i + 1}</span>
      <span class="tile-dot" aria-hidden="true"${needsFill(it) ? "" : " hidden"}></span>
    </button>`;
  }

  function renderGrid() {
    const n = state.items.length;
    $("#photoCount").textContent = t("photos.count", { n });
    $("#tabCount").textContent = String(n);
    $("#emptyNote").hidden = n > 0;
    $("#grid").innerHTML = state.items.map((it, i) => tileHtml(it, i)).join("");
    refreshGridDots();
  }

  // ---------- 編輯面板 ----------
  const indexOfId = id => state.items.findIndex(i => i.id === id);

  function openEditor(idx) {
    const it = state.items[idx];
    if (!it) return;
    editingId = it.id;
    const dialog = $("#editor");
    if (!dialog.open) dialog.showModal();   // 要先打開：refreshEditor 只在面板開著時才填欄位
    dialog.focus({ preventScroll: true });   // showModal 預設會選到第一個按鈕；改放在面板本身（手機上就不會有按鈕被反白）
    renderEditor();
  }

  function closeEditor() {
    const dialog = $("#editor");
    if (dialog.open) dialog.close();
    editingId = null;
  }

  function stepEditor(dir) {
    const idx = indexOfId(editingId) + dir;
    if (idx < 0 || idx >= state.items.length) return;
    editingId = state.items[idx].id;
    renderEditor();
  }

  function renderEditor() {
    const idx = indexOfId(editingId);
    if (idx < 0) { closeEditor(); return; }
    const it = state.items[idx];
    const n = state.items.length;
    $("#edTitle").textContent = `No.${idx + 1} ／ ${n}`;
    // 照片由 JS 放進去（不在 HTML 裡留空的 <img>）
    const photo = document.createElement("img");
    photo.alt = "";
    photo.src = it.src;
    $("#edPhoto").replaceChildren(photo);
    $("#edPrev").disabled = idx === 0;
    $("#edNext").disabled = idx === n - 1;
    $("#edUp").disabled = idx === 0;
    $("#edDown").disabled = idx === n - 1;
    refreshEditor(true);
  }

  // force＝false 時，正在打字的欄位不覆寫，免得游標跳掉
  function refreshEditor(force = false) {
    if (!$("#editor").open) return;
    const idx = indexOfId(editingId);
    if (idx < 0) return;
    const it = state.items[idx];
    const locLocked = state.sameLoc && idx > 0;
    const dateLocked = state.sameDate && idx > 0;
    const sync = (sel, value, disabled) => {
      const el = $(sel);
      el.disabled = disabled;
      if ((force || document.activeElement !== el) && el.value !== value) el.value = value;
    };
    sync("#edLoc", it.loc, locLocked);
    sync("#edDate", it.date, dateLocked);
    sync("#edContent", it.content, false);
    $("#edLocLock").hidden = !locLocked;
    $("#edDateLock").hidden = !dateLocked;
  }

  // 第一張的地點／日期改了：面板與紅點跟著更新（不重建縮圖，打字時不會一直重畫）
  function refreshValues() {
    refreshEditor();
    refreshGridDots();
  }

  function refreshGridDots() {
    const byId = new Map(state.items.map((it, i) => [it.id, { it, i }]));
    $$("#grid .tile[data-id]").forEach(tile => {
      const hit = byId.get(tile.dataset.id);
      if (!hit) return;
      tile.querySelector(".tile-dot").hidden = !needsFill(hit.it);
      tile.setAttribute("aria-label", tileLabel(hit.it, hit.i));
    });
  }

  function emptyCellHtml(idx, forExport) {
    return `<div class="sh-cell empty" data-idx="${idx}">
      <div class="sh-cell-title"><span class="sh-no">No.${idx + 1}</span></div>
      ${forExport ? "" : `<button class="sh-add" type="button" data-add="1">${t("sheet.addPhoto")}</button>`}
    </div>`;
  }

  function filledCellHtml(it, idx) {
    return `<div class="sh-cell" data-idx="${idx}" data-id="${it.id}">
      <div class="sh-cell-title"><span class="sh-no">No.${idx + 1}</span><span class="sh-loc-t" data-field="cellLoc">${esc(it.loc)}</span><span class="sh-date-t" data-field="cellDate">${esc(fmtDate(it.date))}</span></div>
      <div class="sh-cell-body">
        <div class="sh-photo"><img src="${esc(it.src)}" alt="" data-fit="${state.fit}" data-w="${it.w}" data-h="${it.h}"></div>
        <div class="sh-content" data-field="content">${esc(it.content)}</div>
      </div>
    </div>`;
  }

  // 右上角的施工地點：只有「同地點施工」開著、且第一張有填才顯示；永遠輸出這個節點，方便原地更新
  const shownLoc = () => (state.sameLoc && state.items[0] ? state.items[0].loc : "");

  function sheetHtml(p, forExport) {
    const P = PAPER[state.paper];
    const loc = shownLoc();
    const cells = [];
    for (let j = 0; j < P.per; j += 1) {
      const idx = p * P.per + j;
      cells.push(idx < state.items.length ? filledCellHtml(state.items[idx], idx) : emptyCellHtml(idx, forExport));
    }
    return `<section class="sheet ${state.paper} side-${state.side}" lang="${state.lang === "ja" ? "ja" : "zh-Hant"}">
      <header class="sh-head">
        <div class="sh-top">
          <div class="sh-date"><b>${t("sheet.date")}</b><span data-field="date">${esc(dateRange())}</span></div>
          <div class="sh-loc"${loc ? "" : " hidden"}><b>${t("sheet.loc")}</b><span data-field="loc">${esc(loc)}</span></div>
        </div>
        <div class="sh-row sh-proj"><div><b>${t("field.project")}</b><span data-field="project">${esc(state.project)}</span></div></div>
        <div class="sh-row sh-two">
          <div><b>${t("field.work")}</b><span data-field="work">${esc(state.work)}</span></div>
          <div><b>${t("field.contractor")}</b><span data-field="contractor">${esc(state.contractor)}</span></div>
        </div>
      </header>
      <div class="sh-grid">${cells.join("")}</div>
      <footer class="sh-foot">${p + 1} / ${pageCount()}</footer>
    </section>`;
  }

  // 照片顯示：完整／填滿直接套用；自動則看照片比例與格子比例接近與否（接近就填滿，否則完整）
  function resolveFits(root) {
    root.querySelectorAll("img[data-fit]").forEach(img => {
      let fit = img.dataset.fit;
      if (fit === "auto") {
        const box = img.parentElement;
        const boxRatio = box.clientWidth / Math.max(1, box.clientHeight);
        const imgRatio = Number(img.dataset.w) / Math.max(1, Number(img.dataset.h));
        const q = imgRatio / (boxRatio || 1);
        fit = q > 0.85 && q < 1.18 ? "cover" : "contain";
      }
      img.style.objectFit = fit;
    });
  }

  // 框的高度由 CSS aspect-ratio 決定（依版型），這裡只縮放紙張，不改版面
  function layoutFrames() {
    $$(".sheet-frame", $("#preview")).forEach(frame => {
      const sheet = frame.firstElementChild;
      if (!sheet || !frame.clientWidth) return;
      sheet.style.transform = `scale(${frame.clientWidth / sheet.offsetWidth})`;
    });
  }

  function checkOverflow(root) {
    root.querySelectorAll(".sh-content").forEach(el => el.classList.toggle("over", isOver(el)));
  }

  function renderPreview() {
    const box = $("#preview");
    box.innerHTML = Array.from({ length: pageCount() }, (_, p) => `<div class="sheet-frame ${state.paper}">${sheetHtml(p, false)}</div>`).join("");
    // 先讀後寫：resolveFits、checkOverflow 只讀版面（resolveFits 寫的 object-fit 不影響尺寸），layoutFrames 只改 transform
    resolveFits(box);
    checkOverflow(box);
    layoutFrames();
    updateMeta();
  }

  // 打字只改文字，不重建預覽（重建會把每張 base64 照片重新解析、解碼一次）
  // 表頭與格子的文字：不重建頁面，只改文字。cells 為 false（只改表頭）時不重算格子溢出
  let previewCellsDirty = false;
  function patchPreviewText() {
    const box = $("#preview");
    const cellsChanged = previewCellsDirty;
    previewCellsDirty = false;
    const head = { date: dateRange(), loc: shownLoc(), project: state.project, work: state.work, contractor: state.contractor };
    $$(".sh-head [data-field]", box).forEach(el => { el.textContent = head[el.dataset.field]; });
    $$(".sh-loc", box).forEach(el => { el.hidden = !head.loc; });
    const byId = new Map(state.items.map(it => [it.id, it]));
    $$(".sh-cell[data-id]", box).forEach(cell => {
      const it = byId.get(cell.dataset.id);
      if (!it) return;
      const values = { cellLoc: it.loc, cellDate: fmtDate(it.date), content: it.content };
      cell.querySelectorAll("[data-field]").forEach(el => { el.textContent = values[el.dataset.field]; });
    });
    if (cellsChanged) checkOverflow(box);
  }

  // 用 setTimeout 而不是 requestAnimationFrame：不依賴畫面是否在前景，連續打字也順便合併成一次更新
  function schedulePreview(cells = true) {
    previewCellsDirty = previewCellsDirty || cells;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(patchPreviewText, 80);
  }

  function updateMeta() {
    const P = PAPER[state.paper];
    $("#pvMeta").textContent = t("preview.meta", { paper: P.label, per: P.per, pages: pageCount(), n: state.items.length });
  }

  // ---------- 提示與狀態 ----------
  // 訊息文字加上選填的按鈕；toast 與狀態列共用
  function fillMessage(el, message, action, buttonClass) {
    el.replaceChildren();
    const span = document.createElement("span");
    span.textContent = message;
    el.append(span);
    if (!action) return;
    const button = document.createElement("button");
    button.type = "button";
    if (buttonClass) button.className = buttonClass;
    button.textContent = action.label;
    button.addEventListener("click", action.run);
    el.append(button);
  }

  function toast(message, action = null) {
    const el = $("#toast");
    fillMessage(el, message, action && { label: action.label, run: () => { action.run(); el.hidden = true; } });
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 2600);
  }

  function showStatus(message, { error = false, action = null } = {}) {
    const box = $("#shareSlot");
    box.className = "share-slot" + (error ? " error" : "");
    fillMessage(box, message, action, "btn primary small");
  }

  function clearStatus() {
    const box = $("#shareSlot");
    box.className = "share-slot";
    box.replaceChildren();
  }

  // ---------- 自動保存（IndexedDB） ----------
  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  // op 收到 object store，回傳 IDBRequest；交易完成才算成功
  async function idb(mode, op) {
    const conn = await db();
    return new Promise((resolve, reject) => {
      const tx = conn.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    try {
      await idb("readwrite", store => store.put(state, KEY));
    } catch (error) {
      // 平常靜默保存；只有存不了時提醒一次（例如私密瀏覽），不要每次編輯都跳出來
      if (!autosaveWarned) {
        autosaveWarned = true;
        toast(t("toast.noAutosave"));
      }
    }
  }

  async function restore() {
    try {
      const saved = await idb("readonly", store => store.get(KEY));
      if (!saved) return;
      state = sanitize(saved);
      render();   // 不論有沒有內容都要重繪：只改過版型（例如 A3）時，畫面也要跟著狀態走
      if (hasContent()) toast(t("toast.restored"));
    } catch (error) {
      // 無法讀取（隱私模式等）就從空白開始，不影響編輯
    }
  }

  // ---------- 專案檔（.json） ----------
  function sanitize(d) {
    const s = blank();
    const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
    s.paper = PAPER[d.paper] ? d.paper : "a4";
    s.fit = FIT_OPTIONS.includes(d.fit) ? d.fit : "auto";
    s.side = d.side === "right" ? "right" : "left";
    s.lang = d.lang === "ja" ? "ja" : "zh";   // 舊專案檔沒有這欄：當時只有中文
    s.sameDate = !!d.sameDate;
    s.sameLoc = !!d.sameLoc;
    s.project = str(d.project, 60);
    s.work = str(d.work, 60);
    s.contractor = str(d.contractor, 60);
    s.items = (Array.isArray(d.items) ? d.items : [])
      .filter(it => it && typeof it.src === "string" && DATA_URL.test(it.src))
      .map(it => ({
        id: uid(),
        src: it.src,
        w: Number(it.w) || 1,
        h: Number(it.h) || 1,
        loc: str(it.loc, 60),
        date: /^\d{4}-\d{2}-\d{2}$/.test(it.date) ? it.date : "",
        content: str(it.content, 200)
      }));
    enforce(s);
    return s;
  }

  function fileName(ext) {
    const clean = s => String(s || "").replace(/[\\/:*?"<>|\s]+/g, "");
    const parts = [clean(state.project), clean(state.work)].filter(Boolean);
    return `${photoDays()[0] || today()}_${(parts.length ? parts : [t("file.fallback")]).join("_")}.${ext}`;
  }

  async function saveProject() {
    if (!hasContent()) { toast(t("toast.nothingToSave")); return; }
    const payload = { schema: SCHEMA, version: VERSION, savedAt: new Date().toISOString(), data: state };
    await deliverFile(new File([JSON.stringify(payload)], fileName("json"), { type: "application/json" }));
  }

  async function openProjectFile(file) {
    let data;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || parsed.schema !== SCHEMA || !parsed.data) throw new Error("schema");
      data = sanitize(parsed.data);
    } catch (error) {
      toast(t("toast.notProject"));
      return;
    }
    if (hasContent() && !confirm(t("confirm.openProject"))) return;
    state = data;
    commit();
    toast(t("toast.opened", { name: file.name }));
  }

  // ---------- 分享與下載 ----------
  // PDF 的產生、轉圖重試、進度橫幅與分享遞送都在共用的 pdf-share.js（window.PdfShare）；這裡只處理改善表自己的部分。
  function canShareFile(file) {
    try {
      return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    } catch (error) {
      return false;
    }
  }

  // 是否走「自己產生檔案」的路：iPhone／iPad（系統列印吃不到 @page 的紙張尺寸）。
  // ?export=print、?export=share 可強制切換（電腦上驗證用，與其他工具相同）
  function wantsShare() {
    const forced = new URLSearchParams(location.search).get("export");
    if (forced === "print") return false;
    return forced === "share" || PdfShare.isIosDevice();
  }

  // 產生好的 PDF 是交給分享選單，還是直接下載：與其他工具用同一個判斷（能分享檔案才分享）
  const canShareToMenu = () => PdfShare.exportMode(navigator, location.search) === "share";

  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  // 分享需要點擊的手勢，而產生檔案通常會超過 Safari 的時限；被擋就顯示「分享」按鈕，讓使用者再點一次
  async function shareFile(file, retried) {
    try {
      await navigator.share({ files: [file] });
      clearStatus();
    } catch (error) {
      const name = error && error.name;
      if (name === "AbortError") clearStatus();
      else if (name === "NotAllowedError" && !retried) {
        showStatus(t("status.readyShare"), { action: { label: t("btn.share"), run: () => shareFile(file, true) } });
      } else showStatus(t("status.shareFailed", { msg: (error && error.message) || error }), { error: true });
    }
  }

  // 能分享（且是分享情境）就交給分享選單，否則直接下載
  async function deliverFile(file) {
    if (wantsShare() && canShareFile(file)) {
      await shareFile(file, false);
      return;
    }
    downloadFile(file);
    clearStatus();
  }

  // ---------- PDF 輸出 ----------
  // 離屏副本：每張紙一個 .sheet（未縮放，尺寸就是實體紙張）
  function buildPrintRoot() {
    const root = $("#printRoot");
    root.innerHTML = Array.from({ length: pageCount() }, (_, p) => sheetHtml(p, true)).join("");
    return $$(".sheet", root);
  }

  function clearPrintRoot() {
    $("#printRoot").replaceChildren();
  }

  // PDF 的轉圖（含 Safari 空白重畫）、組檔、進度橫幅與分享遞送都用 pdf-share.js 的共用實作；
  // 這裡只決定紙張（版型）與要轉哪幾頁。
  async function sharePdf(sheets) {
    const P = PAPER[state.paper];
    let cancelled = false;
    const ui = PdfShare.openDialog({ onCancel: () => { cancelled = true; } });
    const alive = () => { if (cancelled || ui.closed) throw CANCELLED; };
    try {
      ui.set("working", PdfShare.t("preparing"), PdfShare.t("loadingLib"));
      ui.progress(0.04);
      await PdfShare.loadLibrary();
      alive();
      const pages = [];
      for (const [index, sheet] of sheets.entries()) {
        ui.set("working", PdfShare.t("preparing"), PdfShare.t("converting", index + 1, sheets.length));
        await new Promise(resolve => setTimeout(resolve, 0));   // 讓進度文字有機會先畫出來
        // 頁面尺寸直接用版型設定，不用量測值（量測會有小數誤差）
        pages.push({ ...(await PdfShare.renderPage(sheet)), mm: [P.wmm, P.hmm] });
        alive();
        ui.progress(0.1 + 0.85 * ((index + 1) / sheets.length));
      }
      ui.set("working", PdfShare.t("preparing"), PdfShare.t("assembling"));
      ui.progress(0.97);
      const name = fileName("pdf");
      const pdf = PdfShare.buildPdf(pages, { title: name.replace(/\.pdf$/i, ""), paper: { mm: [P.wmm, P.hmm], marginMm: 0 } });
      const file = new File([pdf], name, { type: "application/pdf" });
      ui.progress(1);
      if (canShareToMenu()) {
        await PdfShare.deliver(file, pages.length, ui);
      } else {
        downloadFile(file);   // 不能分享檔案（例如舊版 iOS）：直接下載
        ui.close();
      }
    } catch (error) {
      if (error === CANCELLED) return;
      console.error(error);
      if (!ui.closed) ui.set("error", PdfShare.t("pdfFailed"), error && error.message ? error.message : PdfShare.t("unknownError"));
    }
  }

  async function exportPdf() {
    if (!state.items.length) { toast(t("toast.addFirst")); return; }
    if (exporting) return;
    exporting = true;
    try {
      const sheets = buildPrintRoot();
      await PdfShare.prepareImages($("#printRoot"));
      resolveFits($("#printRoot"));
      // 在實際輸出的副本上量溢位（不加 .over 類別，免得輸出的字變紅），不依賴預覽是不是最新的
      const over = $$(".sh-content", $("#printRoot")).filter(isOver).length;
      if (over && !confirm(t("confirm.overflow", { n: over }))) {
        clearPrintRoot();
        return;
      }
      if (wantsShare()) {
        await sharePdf(sheets);
        clearPrintRoot();
      } else {
        window.addEventListener("afterprint", () => { clearPrintRoot(); clearStatus(); }, { once: true });
        showStatus(t("status.printHint", { paper: PAPER[state.paper].label }));
        window.print();
      }
    } catch (error) {
      clearPrintRoot();
      showStatus(t("status.exportFailed", { msg: error.message || error }), { error: true });
    } finally {
      exporting = false;
    }
  }

  // ---------- 事件 ----------
  // 開檔案選擇器；id 有值代表要換掉那一張照片
  function pick(inputId, id = null) {
    replaceId = id;
    $("#" + inputId).click();
  }

  function handlePicked(event) {
    const files = [...event.target.files];
    event.target.value = "";
    if (!files.length) return;
    if (replaceId) {
      const id = replaceId;
      replaceId = null;
      replacePhoto(id, files[0]);
    } else {
      importFiles(files);
    }
  }

  function hasFiles(event) {
    return !!(event.dataTransfer && [...event.dataTransfer.types].includes("Files"));
  }

  function dropTarget(target) {
    const tile = target.closest(".tile[data-idx]");
    if (tile) return { el: tile, at: Number(tile.dataset.idx) };
    const cell = target.closest(".sh-cell[data-idx]");
    if (cell) return { el: cell, at: Number(cell.dataset.idx) };
    const zone = target.closest('.pane[data-pane="photos"], .sheet-frame');
    if (zone) return { el: zone, at: null };
    return null;
  }

  function clearDropMarks() {
    $$(".drop-over").forEach(el => el.classList.remove("drop-over"));
    dropEl = null;
  }

  async function handleDrop(files, at) {
    const list = [...files];
    const json = list.find(f => /\.json$/i.test(f.name) || f.type === "application/json");
    if (json) await openProjectFile(json);
    else await importFiles(list, at);
  }

  // 編輯面板的收起手勢：點背景收起；手機上手指在面板任何地方往下拖也會收起（拖得夠遠才收，不夠遠彈回去）。
  // 用觸控事件而不是 pointer 事件：只有「內容已捲到頂、而且是往下拖」才接手並擋掉瀏覽器的捲動；
  // 往上滑、內容還沒捲到頂、或手指從輸入框開始（要選字、移動游標），一律交還給瀏覽器。
  // 電腦版是置中的對話框，不需要。
  function wireSheetDismiss() {
    const dialog = $("#editor");
    const wide = window.matchMedia("(min-width: 640px)");
    let drag = null;   // { startY, dy, active }

    dialog.addEventListener("click", event => {
      if (event.target !== dialog) return;   // 面板內部空白處的點擊也會落在 dialog 上，要用座標確認真的在面板外
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeEditor();
    });

    dialog.addEventListener("touchstart", event => {
      if (wide.matches || event.touches.length !== 1 || event.target.closest("input, textarea, select")) { drag = null; return; }
      drag = { startY: event.touches[0].clientY, dy: 0, active: false };
    }, { passive: true });

    dialog.addEventListener("touchmove", event => {
      if (!drag) return;
      const dy = event.touches[0].clientY - drag.startY;
      if (!drag.active) {
        if (dy < -6 || (dy > 6 && dialog.scrollTop > 0)) { drag = null; return; }   // 往上滑，或內容還沒捲到頂：是在捲動內容
        if (dy <= 6) return;                                                          // 還沒動夠遠，先不決定
        drag.active = true;
        dialog.style.transition = "none";
      }
      event.preventDefault();
      drag.dy = Math.max(0, dy);
      dialog.style.transform = `translateY(${drag.dy}px)`;
    }, { passive: false });

    const release = () => {
      if (!drag) return;
      const { active, dy } = drag;
      drag = null;
      if (!active) return;
      if (dy > 110) {
        dialog.style.transition = "transform .18s ease-in";
        dialog.style.transform = "translateY(100%)";
        setTimeout(() => { closeEditor(); dialog.style.transition = ""; dialog.style.transform = ""; }, 180);
      } else {
        dialog.style.transition = "transform .2s cubic-bezier(0.22, 1, 0.36, 1)";
        dialog.style.transform = "";
      }
    };
    dialog.addEventListener("touchend", release);
    dialog.addEventListener("touchcancel", release);
  }

  function setView(view) {
    $("#sheet-tool").dataset.view = view;
    $$("[data-view-tab]").forEach(btn => btn.setAttribute("aria-selected", String(btn.dataset.viewTab === view)));
  }

  function wire() {
    Object.entries(TEXT).forEach(([id, key]) => {
      $("#" + id).addEventListener("input", event => {
        state[key] = event.target.value;
        schedulePreview(false);   // 表頭文字不影響格子的溢出，只更新表頭
        scheduleSave();
      });
    });
    RADIOS.forEach(name => $$(`input[name="${name}"]`).forEach(r => {
      r.addEventListener("change", () => { state[name] = r.value; refreshView(); });
    }));
    Object.entries(TOGGLES).forEach(([id, key]) => {
      $("#" + id).addEventListener("click", () => { state[key] = !state[key]; commit(); });
    });

    // 「？」說明：點哪顆就開哪顆，點別處全部收起
    document.addEventListener("click", event => {
      const btn = event.target.closest(".help-btn");
      $$(".help").forEach(help => {
        const open = !!btn && help.contains(btn) && !help.classList.contains("open");
        help.classList.toggle("open", open);
        help.querySelector(".help-btn").setAttribute("aria-expanded", String(open));
      });
    });

    $("#inPick").addEventListener("change", handlePicked);
    $("#inCamera").addEventListener("change", handlePicked);

    $("#btnClearAll").addEventListener("click", clearEverything);

    $("#btnExport").addEventListener("click", exportPdf);
    wireLang();
    $("#btnSaveProject").addEventListener("click", saveProject);
    $("#btnOpenProject").addEventListener("click", () => $("#inOpen").click());
    $("#inOpen").addEventListener("change", async event => {
      const file = event.target.files[0];
      event.target.value = "";
      if (file) await openProjectFile(file);
    });

    // 縮圖格：點格子開編輯面板（新增照片用右下角的浮動按鈕）
    $("#grid").addEventListener("click", event => {
      const tile = event.target.closest(".tile[data-idx]");
      if (tile) openEditor(Number(tile.dataset.idx));
    });

    // 編輯面板：欄位即時寫入；動作按鈕與 ‹ › 切換
    $("#edLoc").addEventListener("input", event => setField(editingId, "loc", event.target.value));
    $("#edContent").addEventListener("input", event => setField(editingId, "content", event.target.value));
    $("#edDate").addEventListener("input", event => setField(editingId, "date", event.target.value));
    $("#edDate").addEventListener("change", event => setField(editingId, "date", event.target.value));
    $("#edPrev").addEventListener("click", () => stepEditor(-1));
    $("#edNext").addEventListener("click", () => stepEditor(1));
    $("#edClose").addEventListener("click", closeEditor);
    $("#editor").addEventListener("close", () => { editingId = null; });
    wireSheetDismiss();
    $("#edRotate").addEventListener("click", () => {
      const it = state.items.find(i => i.id === editingId);
      if (it) rotateItem(it).then(commit).catch(() => toast(t("toast.rotateFailed")));
    });
    $("#edReplace").addEventListener("click", () => pick("inPick", editingId));
    $("#edUp").addEventListener("click", () => moveItem(editingId, -1));
    $("#edDown").addEventListener("click", () => moveItem(editingId, 1));
    $("#edRemove").addEventListener("click", () => removeItem(editingId));

    // 手機上方的分頁：表頭／照片／預覽
    $$("[data-view-tab]").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.viewTab)));

    // 預覽：點有照片的格子開編輯面板
    $("#preview").addEventListener("click", event => {
      if (event.target.closest("[data-add]")) { pick("inPick"); return; }
      const cell = event.target.closest(".sh-cell[data-idx]");
      if (cell && !cell.classList.contains("empty")) openEditor(Number(cell.dataset.idx));
    });

    // 拖曳：照片可拖到清單卡片、預覽格子或下方的拖曳區；拖到哪裡就插入哪一格（之後的順延）
    document.addEventListener("dragover", event => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      const t = dropTarget(event.target);
      const el = t ? t.el : null;
      if (el === dropEl) return;   // dragover 約每 50ms 一次，目標沒變就不動 DOM
      clearDropMarks();
      dropEl = el;
      if (el) el.classList.add("drop-over");
    });
    document.addEventListener("dragleave", event => {
      if (!event.relatedTarget) clearDropMarks();
    });
    document.addEventListener("drop", event => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      clearDropMarks();
      const t = dropTarget(event.target);
      handleDrop(event.dataTransfer.files, t ? t.at : null);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) saveNow();
    });

    // 框高由 CSS 決定，layoutFrames 只改 transform，不會改變被觀察元素的尺寸，所以寬度變了直接重排。
    // 預覽從隱藏變顯示（寬度 0 → W）也會在這裡觸發，不需要另外處理
    new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      if (width === lastPreviewWidth) return;
      lastPreviewWidth = width;
      layoutFrames();
    }).observe($("#preview"));
  }

  // 右下角的浮動按鈕：Gooey 選單（export-menu.js 共用）。項目由左到上排：
  // 清空放在離拇指最遠的位置，最不會誤觸；新增放在正上方，最順手。
  // 一顆 Gooey Menu，三個分頁都看得到，項目固定是新增、拍照、清除（清照片）。
  // 新增、拍照只能在照片分頁做，所以先切過去再開選檔（手機上另外兩個分頁也能直接按）
  let menuItems = [];   // { node, it }：切換語言時更新標籤用
  function mountMenus() {
    const { mount, icon } = window.GooeyMenu;
    const ACTS = {
      pick: () => { setView("photos"); pick("inPick"); },
      camera: () => { setView("photos"); pick("inCamera"); },
      clear: clearPhotos
    };
    const items = [
      { id: "btnClear", act: "clear", labelKey: "menu.clear", ariaKey: "menu.clearAria", glyph: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>' },
      { id: "btnCamera", act: "camera", labelKey: "menu.camera", ariaKey: "menu.cameraAria", glyph: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>' },
      { id: "btnPick", act: "pick", labelKey: "menu.add", ariaKey: "menu.addAria", glyph: '<path d="M12 5v14M5 12h14"/>' }
    ];
    const { items: nodes } = mount($("#photo-fab"), $("#photoMenuButton"), items.map(it => ({
      id: it.id, label: t(it.labelKey), aria: t(it.ariaKey), icon: icon(it.glyph)
    })));
    menuItems = nodes.map((node, i) => {
      node.dataset.act = items[i].act;
      node.addEventListener("click", ACTS[items[i].act]);
      return { node, it: items[i] };
    });
  }

  function refreshMenuLabels() {
    menuItems.forEach(({ node, it }) => {
      node.querySelector("span").textContent = t(it.labelKey);
      node.setAttribute("aria-label", t(it.ariaKey));
    });
  }

  // ---------- 語言 ----------
  // 靜態文字（標了 data-i18n 的節點）與選單標籤、PDF 文字一起換；由 render() 與 setLang() 呼叫
  function applyStaticText() {
    document.documentElement.lang = uiLang() === "ja" ? "ja" : "zh-Hant";
    $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    $$("[data-i18n-aria]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nAria)));
    $$("[data-i18n-title]").forEach(el => el.setAttribute("title", t(el.dataset.i18nTitle)));
    $$("[data-i18n-placeholder]").forEach(el => el.setAttribute("placeholder", t(el.dataset.i18nPlaceholder)));
    $$("#langMenu [data-lang]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.lang === state.lang)));
    refreshMenuLabels();
    PdfShare.setLang(state.lang);
  }

  function setLang(lang) {
    if (state.lang === lang) return;
    state.lang = lang;
    commit();                 // 重畫清單與預覽（含文字），並自動保存
    applyStaticText();
    if (editingId) renderEditor();
  }

  function wireLang() {
    const btn = $("#btnLang");
    const menu = $("#langMenu");
    const close = () => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); };
    btn.addEventListener("click", event => {
      event.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
    });
    menu.addEventListener("click", event => {
      const choice = event.target.closest("[data-lang]");
      if (!choice) return;
      close();
      setLang(choice.dataset.lang);
    });
    document.addEventListener("click", event => {
      if (!menu.hidden && !menu.contains(event.target) && event.target !== btn) close();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !menu.hidden) { close(); btn.focus(); }
    });
  }

  // 清除照片：只清照片，表頭文字保留（照片分頁的選單）
  function clearPhotos() {
    if (!state.items.length) { toast(t("toast.noPhotos")); return; }
    if (!confirm(t("confirm.clearPhotos"))) return;
    state.items = [];
    commit();
    saveNow();
  }

  // 清除表頭與照片（標題列右上角的垃圾桶）
  function clearEverything() {
    if (!hasContent()) { toast(t("toast.nothingToClear")); return; }
    if (!confirm(t("confirm.clearAll"))) return;
    state = { ...blank(), lang: state.lang };
    commit();
    saveNow();
  }

  function init() {
    mountMenus();   // 要在 wire() 之前：選單項目（#btnPick 等）是這裡產生的
    wire();
    render();
    restore();
  }

  init();
})();
