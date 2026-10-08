// 「手機輸出 PDF 並跳出分享選單」的純函式檢查：node scripts/verify_pdf_share.mjs
// 不需要瀏覽器：把 pdf-share.js 放進 vm 沙箱載入，驗證 PDF 組檔、平台判斷、檔名與列印保險；
// 有裝 qpdf／pdfinfo 時另外用它們讀一次產出的檔案（沒裝就略過那兩項）。
// 轉圖、對話框與五個工具頁的完整流程由 scripts/verify_pdf_share.py（Playwright）檢查。
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = readFileSync(process.env.PDF_SHARE_JS || path.join(ROOT, "pdf-share.js"), "utf8"); // PDF_SHARE_JS：突變測試時改指向被故意改壞的副本
let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`❌ ${name}\n    ${error.message}`);
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const equal = (actual, expected, label = "") => {
  if (actual !== expected) throw new Error(`${label} 預期 ${JSON.stringify(expected)}，實際 ${JSON.stringify(actual)}`);
};

// 載入 pdf-share.js：頂層只能宣告函式與掛到 window，不能碰 document（載入時 document 不存在）
function load({ navigator = {}, search = "", print = () => {} } = {}) {
  const sandbox = {
    console: { ...console, error() {} }, TextEncoder, TextDecoder, Blob, File, URL, URLSearchParams, Uint8Array, Promise, setTimeout, clearTimeout,
    navigator: { userAgent: "", platform: "", maxTouchPoints: 0, ...navigator },
    location: { search },
    print
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: "pdf-share.js" });
  return sandbox;
}

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
};
const canShare = () => true;

// 假的 JPEG：只要有 SOI／EOI 與一些內容；結構檢查不需要真的能解碼
const fakeJpeg = (size, seed) => {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) bytes[i] = (i * 31 + seed) & 0xff;
  bytes[0] = 0xff; bytes[1] = 0xd8; bytes[size - 2] = 0xff; bytes[size - 1] = 0xd9;
  return bytes;
};
const PAGES = [
  { jpeg: fakeJpeg(3000, 1), px: [1436, 2092], mm: [190, 277] },
  { jpeg: fakeJpeg(5000, 2), px: [1436, 2092], mm: [190, 277] },
  { jpeg: fakeJpeg(1234, 3), px: [1436, 1942], mm: [190, 263] }
];

// 真的能解碼的 16×16 白色 JPEG（給 qpdf／pdfinfo 用；上面那組假資料只夠做結構檢查）
const REAL_JPEG = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD7LooooA//2Q==", "base64"));
const REAL_PAGES = PAGES.map(page => ({ ...page, jpeg: REAL_JPEG, px: [16, 16] }));

const latin1 = bytes => Buffer.from(bytes).toString("latin1");
const MM = 72 / 25.4;
let pdfBytes;

// ---- section: PDF 組檔 ----
const app = load();

await check("window.PdfShare 與 window.outputPrint 載入後可用", () => {
  assert(app.PdfShare && typeof app.PdfShare.buildPdf === "function", "缺 PdfShare.buildPdf");
  assert(typeof app.outputPrint === "function", "缺 outputPrint");
});

await check("buildPdf：標頭、頁數、結尾與 xref 偏移都正確", async () => {
  const blob = app.PdfShare.buildPdf(PAGES, { title: "A01_2026-10-08_整份" });
  equal(blob.type, "application/pdf", "MIME");
  pdfBytes = new Uint8Array(await blob.arrayBuffer());
  const text = latin1(pdfBytes);
  assert(text.startsWith("%PDF-1.4\n"), "標頭");
  assert(text.endsWith("%%EOF"), "結尾");
  assert(/\/Count 3\b/.test(text), "頁數 3");
  const xrefAt = text.lastIndexOf("\nxref\n") + 1;
  equal(Number(/startxref\n(\d+)\n%%EOF$/.exec(text)[1]), xrefAt, "startxref");
  const entries = text.slice(xrefAt).split("\n").filter(line => /^\d{10} \d{5} [nf] $/.test(line));
  const size = Number(/\/Size (\d+)/.exec(text)[1]);
  equal(entries.length, size, "xref 筆數");
  for (let number = 1; number < size; number += 1) {
    const offset = Number(entries[number].slice(0, 10));
    assert(text.startsWith(`${number} 0 obj\n`, offset), `物件 ${number} 的偏移 ${offset} 沒指到 "${number} 0 obj"`);
  }
});

await check("buildPdf：每頁是 A4，圖片原封不動放進串流，位置在四邊 10mm 內", () => {
  const text = latin1(pdfBytes);
  const boxes = text.match(/\/MediaBox \[0 0 595\.28 841\.89\]/g) || [];
  equal(boxes.length, 3, "A4 頁數");
  const images = [...text.matchAll(/\/Width (\d+) \/Height (\d+) \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/g)];
  equal(images.length, 3, "圖片數");
  images.forEach((match, index) => {
    const page = PAGES[index];
    equal(Number(match[1]), page.px[0], `第 ${index + 1} 頁寬`);
    equal(Number(match[2]), page.px[1], `第 ${index + 1} 頁高`);
    equal(Number(match[3]), page.jpeg.length, `第 ${index + 1} 頁 Length`);
    const start = match.index + match[0].length;
    const embedded = pdfBytes.subarray(start, start + page.jpeg.length);
    assert(Buffer.compare(Buffer.from(embedded), Buffer.from(page.jpeg)) === 0, `第 ${index + 1} 頁圖片位元組被改動`);
    assert(text.startsWith("\nendstream", start + page.jpeg.length), `第 ${index + 1} 頁串流結尾位置不對`);
  });
  const placements = [...text.matchAll(/q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm \/Im0 Do Q/g)]
    .map(match => ({ w: Number(match[1]), h: Number(match[2]), x: Number(match[3]), y: Number(match[4]) }));
  equal(placements.length, 3, "放置指令數");
  placements.forEach((item, index) => {
    const [mmW, mmH] = PAGES[index].mm;
    assert(Math.abs(item.w - mmW * MM) < 0.02, `第 ${index + 1} 頁寬度 ${item.w}`);
    assert(Math.abs(item.h - mmH * MM) < 0.02, `第 ${index + 1} 頁高度 ${item.h}`);
    assert(Math.abs(item.x - 10 * MM) < 0.02, `第 ${index + 1} 頁左邊界 ${item.x}`);
    assert(Math.abs(item.y - (841.89 - 10 * MM - mmH * MM)) < 0.02, `第 ${index + 1} 頁上邊界 ${item.y}`);
    assert(item.y >= 0, `第 ${index + 1} 頁超出紙張下緣`);
  });
});

await check("buildPdf：標題寫成 UTF-16BE 十六進位字串（中文不亂碼）", () => {
  const text = latin1(pdfBytes);
  const hex = /\/Title <([0-9A-F]+)>/.exec(text);
  assert(hex, "找不到 /Title");
  assert(hex[1].startsWith("FEFF"), "沒有 BOM");
  const decoded = Buffer.from(hex[1].slice(4), "hex").swap16().toString("utf16le");
  equal(decoded, "A01_2026-10-08_整份", "標題內容");
});

await check("buildPdf：沒有頁面時丟錯，而不是產出空檔", () => {
  let thrown = false;
  try { app.PdfShare.buildPdf([]); } catch { thrown = true; }
  assert(thrown, "應該丟錯");
});

const tool = name => spawnSync("which", [name], { encoding: "utf8" }).status === 0;
await check("qpdf --check 與 pdfinfo 都能讀懂產出的檔案（沒安裝則略過）", async () => {
  if (!tool("qpdf") || !tool("pdfinfo")) { console.log("   （略過：沒有 qpdf 或 pdfinfo）"); return; }
  const file = path.join(mkdtempSync(path.join(os.tmpdir(), "pdf-share-")), "sample.pdf");
  writeFileSync(file, new Uint8Array(await app.PdfShare.buildPdf(REAL_PAGES, { title: "外部工具檢查" }).arrayBuffer()));
  const qpdf = spawnSync("qpdf", ["--check", file], { encoding: "utf8" });
  assert(qpdf.status === 0 || qpdf.status === 3, `qpdf 退出碼 ${qpdf.status}：${qpdf.stdout}${qpdf.stderr}`);
  assert(!/error/i.test(qpdf.stderr), `qpdf 報錯：${qpdf.stderr}`);
  const info = spawnSync("pdfinfo", [file], { encoding: "utf8" }).stdout;
  assert(/Pages:\s+3/.test(info), `pdfinfo 頁數：${info}`);
  assert(/Page size:\s+595\.28 x 841\.89 pts \(A4\)/.test(info), `pdfinfo 尺寸：${info}`);
});

// ---- section: 平台判斷 ----
await check("isIosDevice：iPhone、iPad、桌面級 iPadOS 是 iOS；Mac、Android、Windows 不是", () => {
  const { isIosDevice } = app.PdfShare;
  equal(isIosDevice({ userAgent: UA.iphone, platform: "iPhone", maxTouchPoints: 5 }), true, "iPhone");
  equal(isIosDevice({ userAgent: UA.ipad, platform: "iPad", maxTouchPoints: 5 }), true, "iPad");
  equal(isIosDevice({ userAgent: UA.macSafari, platform: "MacIntel", maxTouchPoints: 5 }), true, "桌面級 iPadOS（MacIntel＋觸控）");
  equal(isIosDevice({ userAgent: UA.macSafari, platform: "MacIntel", maxTouchPoints: 0 }), false, "Mac");
  equal(isIosDevice({ userAgent: UA.android, platform: "Linux armv81", maxTouchPoints: 5 }), false, "Android");
  equal(isIosDevice({ userAgent: UA.windows, platform: "Win32", maxTouchPoints: 0 }), false, "Windows");
});

await check("canShareFiles：沒有 canShare、回傳 false、丟例外都算不能分享", () => {
  const { canShareFiles } = app.PdfShare;
  equal(canShareFiles({}), false, "沒有 canShare");
  equal(canShareFiles({ canShare: () => false }), false, "false");
  equal(canShareFiles({ canShare: () => { throw new TypeError("x"); } }), false, "丟例外");
  equal(canShareFiles({ canShare }), true, "true");
});

await check("canShareFiles：問的是 PDF 檔案", () => {
  let asked;
  app.PdfShare.canShareFiles({ canShare(data) { asked = data; return true; } });
  assert(asked && Array.isArray(asked.files) && asked.files.length === 1, "沒帶 files");
  equal(asked.files[0].type, "application/pdf", "檔案類型");
});

await check("exportMode：iOS 且能分享才走分享；其餘走列印", () => {
  const { exportMode } = app.PdfShare;
  const iphone = { userAgent: UA.iphone, platform: "iPhone", maxTouchPoints: 5, canShare };
  equal(exportMode(iphone, ""), "share", "iPhone");
  equal(exportMode({ ...iphone, canShare: undefined }, ""), "print", "iPhone 但不能分享檔案");
  equal(exportMode({ userAgent: UA.windows, platform: "Win32", maxTouchPoints: 0, canShare }, ""), "print", "Windows");
  equal(exportMode({ userAgent: UA.android, platform: "Linux armv81", maxTouchPoints: 5, canShare }, ""), "print", "Android 維持列印");
});

await check("exportMode：?export=print 強制列印；?export=share 在能分享的裝置上強制分享、不能分享仍列印", () => {
  const { exportMode } = app.PdfShare;
  const iphone = { userAgent: UA.iphone, platform: "iPhone", maxTouchPoints: 5, canShare };
  const windows = { userAgent: UA.windows, platform: "Win32", maxTouchPoints: 0, canShare };
  equal(exportMode(iphone, "?export=print"), "print", "iPhone 強制列印");
  equal(exportMode(windows, "?export=share"), "share", "電腦強制分享");
  equal(exportMode({ ...windows, canShare: undefined }, "?export=share"), "print", "電腦強制分享但不能分享");
  equal(exportMode(iphone, "?export=banana"), "share", "亂填的值當作沒填");
  equal(exportMode(iphone, "?a=1&export=print&b=2"), "print", "夾在其他參數中");
});

// ---- section: 檔名 ----
await check("fileNameFor：保留中文與底線，換掉檔名不能用的字元，空值有預設", () => {
  const { fileNameFor } = app.PdfShare;
  equal(fileNameFor("A01_2026-10-08_單頁"), "A01_2026-10-08_單頁.pdf");
  equal(fileNameFor('a/b:c*d?e"f<g>h|i  j'), "a-b-c-d-e-f-g-h-i-j.pdf");
  equal(fileNameFor("  "), "inspection.pdf", "空白");
  equal(fileNameFor(undefined), "inspection.pdf", "undefined");
  equal(fileNameFor("報告.pdf"), "報告.pdf", "已有副檔名不重複");
  equal(fileNameFor("-_-"), "inspection.pdf", "只剩連字號");
  assert(fileNameFor("長".repeat(300)).length <= 124, "檔名過長");
});

// ---- section: outputPrint 分流與列印保險 ----
await check("outputPrint：非 iOS 直接呼叫 window.print()，不碰分享流程", () => {
  let printed = 0;
  const env = load({ navigator: { userAgent: UA.windows, platform: "Win32", canShare }, print: () => { printed += 1; } });
  let started = 0;
  env.PdfShare.run = () => { started += 1; };
  env.outputPrint();
  equal(printed, 1, "print 次數");
  equal(started, 0, "分享流程次數");
});

await check("outputPrint：iOS 走分享流程（run），不呼叫 window.print()", () => {
  let printed = 0;
  const env = load({ navigator: { userAgent: UA.iphone, platform: "iPhone", maxTouchPoints: 5, canShare }, print: () => { printed += 1; } });
  let started = 0;
  env.PdfShare.run = () => { started += 1; };
  env.outputPrint();
  equal(printed, 0, "print 次數");
  equal(started, 1, "分享流程次數");
});

await check("outputPrint：run 同步丟例外也不會讓點擊處理壞掉", () => {
  const env = load({ navigator: { userAgent: UA.iphone, platform: "iPhone", maxTouchPoints: 5, canShare } });
  env.PdfShare.run = () => { throw new Error("boom"); };
  env.outputPrint();
});

await check("outputPrint({ pdf: false })：iOS 也直接列印（施工計畫頁用）", () => {
  let printed = 0;
  const env = load({ navigator: { userAgent: UA.iphone, platform: "iPhone", maxTouchPoints: 5, canShare }, print: () => { printed += 1; } });
  let started = 0;
  env.PdfShare.run = () => { started += 1; };
  env.outputPrint({ pdf: false });
  equal(printed, 1, "print 次數");
  equal(started, 0, "分享流程次數");
});

const watch = (fire) => new Promise(resolve => {
  const listeners = {};
  let silent = 0;
  const deps = {
    print: () => { if (fire) setTimeout(() => listeners.beforeprint && listeners.beforeprint(), 5); },
    addEventListener: (name, fn) => { listeners[name] = fn; },
    removeEventListener: (name) => { delete listeners[name]; },
    onSilent: () => { silent += 1; },
    delay: 40
  };
  app.PdfShare.printWithWatchdog(deps);
  setTimeout(() => resolve({ silent, leftover: Object.keys(listeners).length }), 120);
});

await check("列印保險：有 beforeprint 就不打擾，沒有就在時限後通知一次", async () => {
  const fired = await watch(true);
  equal(fired.silent, 0, "有事件時的通知次數");
  equal(fired.leftover, 0, "監聽器要移除");
  const quiet = await watch(false);
  equal(quiet.silent, 1, "沒事件時的通知次數");
  equal(quiet.leftover, 0, "監聽器要移除");
});

console.log(failures ? `\n${failures} 項失敗` : "\n全部通過");
process.exit(failures ? 1 : 0);
