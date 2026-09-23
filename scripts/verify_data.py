"""用 headless Chrome 驅動真正的 App，檢查工程計算、JSON 來回、舊資料相容與 PDF 內容。

執行：python3 scripts/verify_data.py
依賴：playwright（並已安裝 Chrome：channel="chrome"）、PyMuPDF（import fitz）。
每個案例都是固定輸入 → 預期輸出，改到 app.js／wall-gc.js 的計算或 schema 後跑一次，任何一項失敗就以非零結束。
"""
import json
import subprocess
import sys
import time
from pathlib import Path

import fitz
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tmp" / "verify-data"
OUT.mkdir(parents=True, exist_ok=True)
PORT = 4198
BASE = f"http://127.0.0.1:{PORT}"

failures = []


def check(name, condition, detail=""):
    print(("✅" if condition else "❌"), name, "" if condition else f"→ {detail}")
    if not condition:
        failures.append(name)


def close(a, b, tolerance=0.005):
    return a is not None and b is not None and abs(a - b) <= tolerance


def strip_volatile(payload):
    """匯出時間每次不同，比對前拿掉。"""
    payload = json.loads(json.dumps(payload))
    payload.pop("exported_at", None)
    payload.get("export_context", {}).pop("exported_at", None)
    return payload


def new_page(browser):
    page = browser.new_context(viewport={"width": 1280, "height": 900}).new_page()

    def on_error(error):
        print("❌ 頁面錯誤：", error)
        failures.append(f"pageerror: {error}")

    page.on("pageerror", on_error)
    page.on("requestfailed", lambda request: print("⚠️ 載入失敗：", request.url, request.failure))
    page.on("response", lambda response: response.status >= 400 and print("⚠️ HTTP", response.status, response.url))
    return page


def open_clean(browser, html, query=""):
    page = new_page(browser)
    page.goto(f"{BASE}/{html}{query}", wait_until="networkidle")
    page.wait_for_function("typeof state === 'object' && typeof preparePrint === 'function'")  # 頁面 script 跑完再動手（rebar.html 沒有 exportData）
    page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
    return page


def pdf_text(page, scope):
    page.evaluate(f"() => {{ window.print = () => {{}}; return preparePrint('{scope}'); }}")
    page.emulate_media(media="print")
    path = OUT / f"{scope}.pdf"
    page.pdf(path=str(path), prefer_css_page_size=True, print_background=True)
    return "".join(p.get_text() for p in fitz.open(path))


# ---------------------------------------------------------------- 廠商版：計算
def verify_vendor_calculations(browser):
    page = open_clean(browser, "diaphragm-wall")

    # 30 時制：比基準早就是隔天
    result = page.evaluate("""() => ({
      t: timeToMinutes("08:30"),
      c: clock30(1500),
      after: minutesAfter("00:20", timeToMinutes("23:50")),
      seq: sequence30(["23:50", "00:20", "06:10"]),
      plain: sequence30(["09:00", "10:30"])
    })""")
    check("timeToMinutes 08:30 → 510", result["t"] == 510, result)
    check("clock30 1500 分 → 25:00", result["c"] == "25:00", result)
    check("minutesAfter 00:20（基準 23:50）→ 24:20", result["after"] == 24 * 60 + 20, result)
    check("sequence30 跨午夜串接", result["seq"] == ["23:50", "24:20", "30:10"], result)
    check("sequence30 同日不變", result["plain"] == ["09:00", "10:30"], result)

    # 設計高度／體積／深度差異
    result = page.evaluate("""() => {
      Object.assign(state.wall, { designDepth: "-35.80", topElevation: "-0.50", thickness: "1.00", length: "2.80" });
      state.depth = [{ time: "12:10", value: "-35.80" }, { time: "12:35", value: "-35.82" }];
      state.soil = [{ time: "23:40" }, { time: "00:15" }];
      updateWallCalculation();
      const ex = calculatedExcavation();
      return { height: designHeight(), volume: calculatedDesignVolume(), stateVolume: state.wall.designVolume,
               diff: ex.depth.map(row => row.difference), depthTimes: ex.depth.map(row => row.time30), soilTimes: ex.soil.map(row => row.time30) };
    }""")
    check("設計澆置高度 = 頂高程 − 設計深度 = 35.30", close(result["height"], 35.30), result)
    check("設計數量 = 35.30 × 1.00 × 2.80 = 98.84", close(result["volume"], 98.84) and result["stateVolume"] == "98.84", result)
    check("深度確認差異 0.00／−0.02", close(result["diff"][0], 0) and close(result["diff"][1], -0.02), result)
    check("出土時間跨午夜 23:40 → 24:15", result["soilTimes"] == ["23:40", "24:15"], result)

    # 澆置車次：累積、預估高度、30 時制、澆置分鐘、試體編號
    result = page.evaluate("""() => {
      state.trucks = [
        { truckNo: "C01", dispatch: "23:30", unload: "23:50", finish: "00:10", volume: "12", measured: "4.30", slump: "18" },
        { truckNo: "C02", dispatch: "00:05", unload: "00:25", finish: "00:40", volume: "12", measured: "8.50", slump: "" },
        { truckNo: "C03", dispatch: "00:30", unload: "00:50", finish: "01:05", volume: "9.46", measured: "12.00", slump: "17" }
      ];
      return calculatedTrucks().map(row => ({ cumulative: row.cumulative, expected: row.expected, difference: row.difference, minutes: row.minutes,
        d: row.dispatch30, u: row.unload30, f: row.finish30, slumpLabel: row.slumpLabel, flags: row.flags }));
    }""")
    r0, r1, r2 = result
    check("累積方量 12 / 24 / 33.46", close(r0["cumulative"], 12) and close(r1["cumulative"], 24) and close(r2["cumulative"], 33.46), result)
    check("預估高度 = 35.30 × 累積 ÷ 98.84", close(r0["expected"], 35.30 * 12 / 98.84) and close(r2["expected"], 35.30 * 33.46 / 98.84), result)
    check("實測 − 預估差異", close(r1["difference"], 8.50 - 35.30 * 24 / 98.84), result)
    check("第 1 車 23:30 出廠、結束 24:10、澆置 40 分", (r0["d"], r0["f"], r0["minutes"]) == ("23:30", "24:10", 40), r0)
    check("第 2 車出廠 00:05 顯示為 24:05", (r1["d"], r1["u"], r1["f"]) == ("24:05", "24:25", "24:40"), r1)
    check("坍度試體依序編號 （試1）18／（試2）17", r0["slumpLabel"] == "（試1）18" and r1["slumpLabel"] == "" and r2["slumpLabel"] == "（試2）17", result)
    check("正常車次沒有合理性提醒", all(row["flags"] == [] for row in result), [row["flags"] for row in result])

    # 合理性提醒：打錯時間會變成隔天、方量異常、超過 30:00
    result = page.evaluate("""() => {
      state.trucks = [
        { truckNo: "T1", dispatch: "08:00", unload: "07:50", finish: "08:30", volume: "12", measured: "" },   // 卸料打成比出廠早 → 隔天
        { truckNo: "T2", dispatch: "08:20", unload: "08:40", finish: "09:00", volume: "20", measured: "" },   // 方量超過拌合車
        { truckNo: "T3", dispatch: "21:00", unload: "21:20", finish: "21:40", volume: "0", measured: "" }     // 比前一車晚 12.7 小時、方量 0
      ];
      renderPouring();
      return { flags: calculatedTrucks().map(row => row.flags), warnings: document.querySelectorAll('#pour-warnings .warning-item').length };
    }""")
    flags = result["flags"]
    check("卸料早於出廠 → 提醒「出廠到卸料相差 23.8 小時」（並提醒已過 30:00）", any("出廠到卸料相差 23.8 小時" in f for f in flags[0]) and any("30:00 以後" in f for f in flags[0]), flags[0])
    check("單車方量 20 m³ → 提醒", any("超過一般拌合車容量" in f for f in flags[1]), flags[1])
    check("比前一車晚 12.7 小時 → 提醒", any("比前一車晚 12.7 小時" in f for f in flags[2]), flags[2])
    check("方量 0 → 提醒", any("方量為 0" in f for f in flags[2]), flags[2])
    check("提醒都出現在畫面警示區", result["warnings"] == 5, result["warnings"])

    # 通宵澆置：第一車跨過 30:00 提醒一次，後面不再重複
    result = page.evaluate("""() => {
      state.trucks = [
        { truckNo: "N1", dispatch: "21:00", unload: "21:20", finish: "21:40", volume: "9", measured: "" },
        { truckNo: "N2", dispatch: "05:50", unload: "06:10", finish: "06:30", volume: "9", measured: "" },   // 卸料推算到 30:10
        { truckNo: "N3", dispatch: "06:20", unload: "06:40", finish: "07:00", volume: "9", measured: "" }
      ];
      return calculatedTrucks().map(row => ({ flags: row.flags, d: row.dispatch30, u: row.unload30 }));
    }""")
    check("通宵澆置 05:50 → 29:50、06:10 → 30:10", (result[1]["d"], result[1]["u"], result[2]["d"]) == ("29:50", "30:10", "30:20"), result)
    check("跨過 30:00 只在第一車提醒一次", any("30:00 以後" in f for f in result[1]["flags"]) and result[2]["flags"] == [] and result[0]["flags"] == [], [row["flags"] for row in result])
    page.context.close()


# ---------------------------------------------------------------- JSON 來回與舊資料相容
def verify_roundtrip(browser, html, tool, unit_path):
    page = open_clean(browser, html)
    first = page.evaluate("""() => { loadExample(); state.rebarCage.mode = "detailed"; renderAll?.(); return exportData(); }""")
    parts = first["rebar_cage_review"]["parts"]
    check(f"{tool}：匯出 13 個部位，主筋第二區間帶補強插筋，內側對稱為推導值", len(parts) == 13 and parts[0]["intervals"][1]["extra"] == {"bar_size": "D32", "spacing_cm": 30} and parts[3]["symmetric"] is True and parts[7]["count"] == 3, json.dumps(parts[:2], ensure_ascii=False)[:400])
    second = page.evaluate("""(payload) => { clearAllData(); importJsonPayload(JSON.parse(JSON.stringify(payload))); return exportData(); }""", first)
    check(f"{tool}：JSON 匯出 → 清空 → 匯入 → 再匯出，內容一致", strip_volatile(first) == strip_volatile(second),
          json.dumps({k: (strip_volatile(first).get(k), strip_volatile(second).get(k)) for k in strip_volatile(first) if strip_volatile(first).get(k) != strip_volatile(second).get(k)}, ensure_ascii=False)[:600])
    check(f"{tool}：schema 1.6，導溝／鋼筋籠不再各帶 unit_no", first["schema_version"] == "1.6" and "unit_no" not in first["guide_wall_review"] and "unit_no" not in first["rebar_cage_review"], first["schema_version"])
    unit_no = page.evaluate(f"() => {unit_path}")
    check(f"{tool}：範例單元編號 21 存在壁體", unit_no == "21", unit_no)

    # 1.2 以前的 JSON：壁體沒有單元編號、鋼筋籠自己帶 → 補到壁體；導溝的舊 unit_no 忽略
    legacy = json.loads(json.dumps(first))
    legacy["schema_version"] = "1.2"
    legacy[("wall_unit")]["unit_no"] = None
    legacy["guide_wall_review"]["unit_no"] = "99"
    legacy["rebar_cage_review"]["unit_no"] = "21"
    legacy["rebar_cage_review"].pop("parts", None)
    legacy["rebar_cage_review"].pop("mode", None)
    legacy["rebar_cage_review"]["rebar_items"] = [{"item_no": 1, "part": "A 面縱向主筋", "design_bar_size": "D32", "result": "符合"}]
    after = page.evaluate(f"""(payload) => {{ clearAllData(); importJsonPayload(payload); return {{ unit: {unit_path}, guide: state.guideWall.unitNo, cage: state.rebarCage.unitNo, parts: state.rebarCage.parts.length, mode: state.rebarCage.mode, filled: state.rebarCage.parts[0].intervals[0].size, result: state.rebarCage.parts[0].result }}; }}""", legacy)
    check(f"{tool}：舊 JSON 的鋼筋籠 unit_no 補到壁體，導溝的忽略", {k: after[k] for k in ("unit", "guide", "cage")} == {"unit": "21", "guide": None, "cage": None}, after)
    check(f"{tool}：舊 JSON 的 rebar_items 略過，13 個部位重設為簡易模式未填", after["parts"] == 13 and after["mode"] == "simple" and after["filled"] == "" and after["result"] == "待確認", after)

    # 1.2 以前的草稿：鋼筋籠 unitNo 搬到壁體（先把目前 state 落地成草稿，再改成舊格式）
    page.evaluate("() => { loadExample(); draft.schedule(); }")
    page.wait_for_timeout(700)  # 草稿寫入有 400ms 去抖
    page.evaluate("""() => {
      const key = Object.keys(localStorage).find(k => k.endsWith('.draft'));
      const stored = JSON.parse(localStorage.getItem(key));
      const unitKey = stored.data.wall ? 'wall' : 'unit';
      stored.data[unitKey].unitNo = '';
      stored.data.rebarCage.unitNo = '37';
      stored.data.guideWall.unitNo = '12';
      stored.data.rebarCage.rebars = [{ part: 'x' }];
      delete stored.data.rebarCage.parts;
      delete stored.data.rebarCage.mode;
      localStorage.setItem(key, JSON.stringify(stored));
    }""")
    page.reload(wait_until="networkidle")
    bind = "unit" if "unit." in unit_path else "wall"
    migrated = page.evaluate(f"() => ({{ unit: {unit_path}, guide: state.guideWall.unitNo, cage: state.rebarCage.unitNo, field: document.querySelector(\"#tool-rebar-cage input[data-bind='{bind}.unitNo']\")?.value, parts: state.rebarCage.parts.length, mode: state.rebarCage.mode, rebars: 'rebars' in state.rebarCage }})")
    check(f"{tool}：舊草稿的鋼筋籠 unitNo 搬到壁體並顯示在鋼筋籠表單", migrated["unit"] == "37" and migrated["guide"] is None and migrated["cage"] is None and "37" in (migrated["field"] or ""), migrated)
    check(f"{tool}：舊草稿的 rebars 丟棄、parts 重設 13 個、簡易模式", migrated["parts"] == 13 and migrated["mode"] == "simple" and not migrated["rebars"], migrated)
    page.context.close()


# ---------------------------------------------------------------- 檢查標準值預設改版後的舊草稿
def verify_standard_default_migration(browser, html, tool, standards_path, json_path, seed, expected):
    """2026-09-21 預設值改版（沉泥 15、保護層 10、籠雙向 ±5…）：舊草稿裡仍是舊預設的項目換成新預設，
    使用者自己選的值保留，草稿缺的鍵補上預設；匯入 JSON 不套用（紀錄檔照原值）。"""
    page = open_clean(browser, html)
    page.evaluate("() => { loadExample(); draft.schedule(); }")
    page.wait_for_timeout(700)
    page.evaluate(f"""(seed) => {{
      const key = Object.keys(localStorage).find(k => k.endsWith('.draft'));
      const stored = JSON.parse(localStorage.getItem(key));
      const standards = stored.data.{standards_path};
      Object.assign(standards, seed);
      delete standards.chloride;
      localStorage.setItem(key, JSON.stringify(stored));
    }}""", seed)
    page.reload(wait_until="networkidle")
    keys = list(expected)
    after = page.evaluate(f"(keys) => Object.fromEntries(keys.map(k => [k, state.{standards_path}[k]]))", keys)
    check(f"{tool}：舊草稿仍是舊預設的標準值換成新預設、自選值保留、缺鍵補預設", after == expected, after)
    selector_prefix = "quality-standard" if "quality" in standards_path else "standard"
    dropdown = page.evaluate(f"(keys) => Object.fromEntries(keys.map(k => [k, document.querySelector(`select[data-{selector_prefix}='${{k}}']`)?.value]))", keys)
    check(f"{tool}：標準值下拉顯示遷移後的值", dropdown == expected, dropdown)
    legacy_keys = page.evaluate("() => (typeof QUALITY_STANDARD_CONFIG === 'object' ? QUALITY_STANDARD_CONFIG : STANDARD_CONFIG).filter(i => i.legacy).map(i => i.key)")
    file_values = {k: v for k, v in seed.items() if k in legacy_keys}
    imported = page.evaluate(f"""(fileValues) => {{
      clearAllData(); loadExample();
      const data = exportData();
      Object.entries(fileValues).forEach(([k, v]) => {{ data.{json_path}[k] = {{ value: v }}; }});
      clearAllData(); importJsonPayload(data);
      return Object.fromEntries(Object.keys(fileValues).map(k => [k, state.{standards_path}[k]]));
    }}""", file_values)
    check(f"{tool}：匯入 JSON 時標準值照檔案原值，不套用預設遷移", imported == file_values, imported)
    page.context.close()


# ---------------------------------------------------------------- 廠商版：澆置紀錄 ↔ 數量差異、混凝土強度單位
def verify_vendor_links(browser):
    """2026-09-21：混凝土實際與設計數量差異＝|實際 − 設計|／設計，實際數量由澆置紀錄累積方量帶入；
    混凝土強度可選 kgf/cm²／psi，品質自檢第 16 項 placeholder 跟著單位。"""
    page = open_clean(browser, "diaphragm-wall")
    linked = page.evaluate("""() => { loadExample(); renderAll(); return {
      actual: state.wall.actualVolume, readonly: document.querySelector('[data-bind="wall.actualVolume"]').readOnly,
      rate: volumeDifferenceRate().toFixed(2), board: document.querySelector('#pour-volume-difference').textContent.trim(),
      hint: document.querySelector('.quality-standard-current')?.textContent, warning: document.querySelector('#pour-warnings').textContent,
      label: [...document.querySelectorAll('.quality-standard-field > span')].map(s => s.textContent).find(t => t.includes('數量差異')) }; }""")
    check("廠商版：範例 8 車累積 102.26 m³ 自動帶入實際數量（唯讀），差異 3.46% 顯示在澆置看板與標準值下方", linked["actual"] == "102.26" and linked["readonly"] and linked["rate"] == "3.46" and linked["board"].startswith("3.46") and "3.46%" in (linked["hint"] or "") and "澆置紀錄累積" in linked["hint"] and "數量差異" not in linked["warning"], linked)
    check("廠商版：標準值改名為「混凝土實際與設計數量差異上限」", linked["label"] == "混凝土實際與設計數量差異上限（%）", linked["label"])
    exceeded = page.evaluate("""() => { state.trucks[0].volume = "20"; renderAll(); return { rate: volumeDifferenceRate().toFixed(2), warning: document.querySelector('#pour-warnings').textContent, cell: document.querySelector('#pour-volume-difference-cell').classList.contains('is-warning'), hint: document.querySelector('.quality-standard-current').className }; }""")
    check("廠商版：累積方量超過設計 5% 時澆置看板轉警示、警示清單與標準值提示標示超過標準", exceeded["rate"] == "10.54" and "超過檢查標準值 5%" in exceeded["warning"] and exceeded["cell"] and "is-exceeded" in exceeded["hint"], exceeded)
    manual = page.evaluate("""() => { state.trucks = []; state.wall.actualVolume = "95.00"; renderAll(); return { rate: volumeDifferenceRate().toFixed(2), readonly: document.querySelector('[data-bind="wall.actualVolume"]').readOnly, hint: document.querySelector('.quality-standard-current').textContent }; }""")
    check("廠商版：沒有車次時用壁體資訊手填的實際數量算差異，欄位恢復可編輯", manual["rate"] == "3.89" and not manual["readonly"] and "壁體資訊實際數量" in manual["hint"], manual)
    page.evaluate("() => { clearAllData(); loadExample(); renderAll(); showTab('pouring'); }")
    text = pdf_text(page, "current")
    check("廠商版：澆置紀錄 PDF 印出設計／實際數量與差異 3.46%", "102.26" in text and "3.46%" in text, text[:300])

    unit = page.evaluate("""() => {
      const select = document.querySelector('[data-bind="wall.strengthUnit"]');
      select.value = "psi"; select.dispatchEvent(new Event("input", { bubbles: true })); select.dispatchEvent(new Event("change", { bubbles: true }));
      const data = exportData();
      return { placeholder: document.querySelector('[data-bind="wall.strength"]').placeholder, quality: document.querySelector('[data-quality-card="15"] .guide-affix').textContent + "｜" + document.querySelectorAll('#quality-check-list .quality-card p')[15].textContent,
        exported: [data.wall_unit.concrete_strength, data.wall_unit.concrete_strength_unit, "concrete_strength_kgf_cm2" in data.wall_unit] }; }""")
    check("廠商版：強度單位選 psi → 強度欄 placeholder、品質自檢第 16 項單位與設計強度同步、JSON 帶 concrete_strength_unit", unit["placeholder"] == "例如：5000" and unit["quality"] == "psi｜實測強度 ≥ 設計強度 350 psi" and unit["exported"] == [350, "psi", False], unit)
    page.evaluate("() => showTab('wall')")
    text = pdf_text(page, "current")
    check("廠商版：PDF 壁體資訊的強度單位跟著選項", "混凝土強度(psi)" in text.replace(" ", ""), text[:200])
    legacy = page.evaluate("""() => { const data = exportData(); delete data.wall_unit.concrete_strength; delete data.wall_unit.concrete_strength_unit; data.wall_unit.concrete_strength_kgf_cm2 = 280; clearAllData(); importJsonPayload(data); return [state.wall.strength, state.wall.strengthUnit]; }""")
    check("廠商版：1.5 以前的 JSON（concrete_strength_kgf_cm2）匯入後單位為 kgf/cm²", legacy == ["280", "kgf/cm²"], legacy)
    page.context.close()

    page = open_clean(browser, "diaphragm-wall-gc")
    gc = page.evaluate("""() => {
      loadExample(); state.unit.strengthUnit = "psi"; state.unit.strength = "5000"; updateUnitCalculation();
      const data = exportData();
      return { placeholder: document.querySelector('[data-bind="unit.strength"]').placeholder, exported: [data.wall_unit.concrete_strength, data.wall_unit.concrete_strength_unit] }; }""")
    check("營造廠版：強度單位 psi → placeholder 與 JSON 同步", gc["placeholder"] == "例如：5000" and gc["exported"] == [5000, "psi"], gc)
    text = pdf_text(page, "all")
    check("營造廠版：查驗表 PDF 印出設計強度(psi)", "設計強度(psi)" in text.replace(" ", ""), text[:200])
    page.context.close()


# ---------------------------------------------------------------- 鋼筋籠照片（01／06 共用 cage-photos.js）
def verify_cage_photos(browser, html, tool):
    """最多 3 張、長邊縮到 1600、備註、兩段式刪除、草稿與 JSON 來回、PDF 另起一頁三列各 1/3。"""
    page = open_clean(browser, html)
    result = page.evaluate("""async () => {
      const make = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').fillStyle = '#8ab'; c.getContext('2d').fillRect(0, 0, w, h); return c; };
      const blob = await new Promise(resolve => make(4000, 3000).toBlob(resolve, 'image/png'));
      const data = await compressCagePhoto(new File([blob], 'big.png', { type: 'image/png' }));
      const image = new Image(); image.src = data; await image.decode();
      loadExample(); showTool('rebarCage'); showTab('cage-photos');
      state.rebarCage.photos = [{ data, caption: '' }, { data: make(600, 800).toDataURL('image/jpeg', 0.8), caption: '第二張' }];
      renderRebars();
      const items = document.querySelectorAll('#cage-photo-list .photo-item').length;
      document.querySelector('[data-photo-caption="0"]').click();
      const dialogOpen = document.querySelector('#cage-photo-dialog').open;
      document.querySelector('#cage-photo-caption').value = '上段籠全景';
      document.querySelector('#cage-photo-form').requestSubmit();
      state.rebarCage.photos.push({ data, caption: '' }); renderRebars();
      const full = document.querySelector('#cage-photo-add').disabled;
      const remove = document.querySelector('[data-photo-remove="2"]'); remove.click(); const armed = remove.classList.contains('is-armed'); remove.click();
      const exported = exportData().rebar_cage_review.photos;
      draft.schedule(); await new Promise(r => setTimeout(r, 700));
      return { type: data.slice(0, 15), width: image.width, height: image.height, items, dialogOpen, caption: state.rebarCage.photos[0].caption, full, armed, after: state.rebarCage.photos.length,
        exported: exported.map(p => [p.no, p.caption, p.image_data_url.slice(0, 15)]) };
    }""")
    check(f"{tool}：4000×3000 的 PNG 縮成 1600×1200 JPEG；三張時「＋匯入」停用；× 兩段式刪除", result["type"] == "data:image/jpeg" and (result["width"], result["height"]) == (1600, 1200) and result["items"] == 2 and result["full"] and result["armed"] and result["after"] == 2, result)
    check(f"{tool}：點照片開備註對話框並存回；JSON 帶編號、備註與 data URL", result["dialogOpen"] and result["caption"] == "上段籠全景" and result["exported"] == [[1, "上段籠全景", "data:image/jpeg"], [2, "第二張", "data:image/jpeg"]], result["exported"])
    page.reload(wait_until="networkidle")
    restored = page.evaluate("() => ({ n: state.rebarCage.photos.length, caption: state.rebarCage.photos[0]?.caption, items: document.querySelectorAll('#cage-photo-list .photo-item').length })")
    check(f"{tool}：草稿重新載入後照片與備註都在", restored == {"n": 2, "caption": "上段籠全景", "items": 2}, restored)
    roundtrip = page.evaluate("() => { const data = exportData(); clearAllData(); const cleared = state.rebarCage.photos.length; importJsonPayload(data); return { cleared, n: state.rebarCage.photos.length, caption: state.rebarCage.photos[1].caption, page: document.querySelector('#print-rebar-cage-photos').style.display }; }")
    check(f"{tool}：清空後照片歸零，匯入 JSON 回復兩張", roundtrip["cleared"] == 0 and roundtrip["n"] == 2 and roundtrip["caption"] == "第二張", roundtrip)
    page.evaluate("() => showTool('rebarCage')")
    text_pages = None
    page.evaluate("() => { window.print = () => {}; return preparePrint('current'); }")
    page.emulate_media(media="print")
    path = OUT / f"{html}-cage-photos.pdf"
    page.pdf(path=str(path), prefer_css_page_size=True, print_background=True)
    doc = fitz.open(path)
    last = doc[-1]
    rows = [fitz.Rect(line["bbox"]) for block in last.get_text("dict")["blocks"] for line in block.get("lines", []) if "".join(sp["text"] for sp in line["spans"]).strip() in ("1", "2", "3")]
    gaps = [round((rows[i + 1].y0 - rows[i].y0) * 25.4 / 72) for i in range(len(rows) - 1)] if len(rows) == 3 else []
    check(f"{tool}：PDF 照片另起最後一頁，兩張圖＋簽名欄，編號 1／2／3 等距（三列各 1/3）", len(doc) >= 2 and len(last.get_images()) == 3 and "擔當者" in last.get_text() and "鋼筋籠複核照片" in last.get_text() and len(gaps) == 2 and abs(gaps[0] - gaps[1]) <= 2, {"pages": len(doc), "images": len(last.get_images()), "gaps_mm": gaps})
    empty = page.evaluate("() => { state.rebarCage.photos = []; renderRebars(); preparePrint('current'); return { box: !!document.querySelector('.photo-upload-box'), hidden: document.querySelector('#print-rebar-cage-photos').style.display }; }")
    check(f"{tool}：沒有照片時顯示匯入框，PDF 不印照片頁", empty == {"box": True, "hidden": "none"}, empty)
    page.context.close()


# ---------------------------------------------------------------- 模板工程：單位 cm、間距單邊判定、舊草稿換算
def verify_formwork_units(browser):
    """2026-09-23 尺寸複核由 mm 改為 cm，並新增槽鋼／螺桿／支撐間距三項量測與板的透光模板。
    間距是單邊判定（只能更密），舊草稿沒有 units 標記時一律除以 10。"""
    page = open_clean(browser, "template")
    result = page.evaluate("""() => {
      loadExample();
      const member = state.members[0];
      const spacingTol = toleranceFor(member, "supportSpacing", "90");
      const sectionTol = toleranceFor(member, "sectionWidth", "60");
      return { units: state.units, labelUnit: MEASURE_LABELS.sectionWidth[1],
        width: member.width, design: member.measures.sectionWidth.design, actual: member.measures.sectionWidth.actual,
        channel: member.measures.channelSpacing,
        columnMeasures: TYPE_MEASURES.柱, beamMeasures: TYPE_MEASURES.梁, slabMeasures: TYPE_MEASURES.板,
        slabChecks: TYPE_CHECKS.板.map(item => item[0]),
        hangingPlaceholder: TYPE_CHECKS.板.find(item => item[0] === "hangingForm")[3],
        spacingTol: [spacingTol.lower, spacingTol.upper, spacingTol.label], sectionTol: [sectionTol.lower, sectionTol.upper] };
    }""")
    check("模板：尺寸複核單位為 cm，範例斷面 60×80 cm、容許差依 cm 區間判定",
          result["units"] == "cm" and result["labelUnit"] == "cm" and result["width"] == "60" and result["design"] == "60" and result["actual"] == "60.2" and result["sectionTol"] == [-1.0, 1.3], result)
    check("模板：柱牆加槽鋼間距、梁加螺桿與支撐間距、板加支撐間距",
          result["columnMeasures"][-1] == "channelSpacing" and result["beamMeasures"][-3:] == ["tieSpacing", "channelSpacing", "supportSpacing"] and result["slabMeasures"][-1] == "supportSpacing", result)
    check("模板：板新增透光模板項目，吊模現場紀錄提示改為「有／無／二次」",
          result["slabChecks"][0] == "translucent" and result["hangingPlaceholder"] == "有／無／二次", result)
    check("模板：間距為單邊判定（實測不得大於設計間距）", result["spacingTol"] == [None, 0, "不得大於設計間距"] or (result["spacingTol"][1] == 0 and result["spacingTol"][2] == "不得大於設計間距"), result["spacingTol"])
    verdicts = page.evaluate("""() => {
      const member = state.members[0];
      const judge = (design, actual) => { const tol = toleranceFor(member, "supportSpacing", design); const diff = Number(actual) - Number(design); return diff >= tol.lower && diff <= tol.upper ? "合格" : "不合格"; };
      return { tighter: judge("90", "80"), equal: judge("90", "90"), wider: judge("90", "100") };
    }""")
    check("模板：間距實測 80／90／100 對設計 90 → 合格／合格／不合格", verdicts == {"tighter": "合格", "equal": "合格", "wider": "不合格"}, verdicts)

    page.evaluate("() => { loadExample(); draft.schedule(); }")
    page.wait_for_timeout(700)
    page.evaluate("""() => {
      const key = Object.keys(localStorage).find(k => k.endsWith('.template.draft'));
      const stored = JSON.parse(localStorage.getItem(key));
      delete stored.data.units;                       // 舊草稿沒有 units 標記
      const member = stored.data.members[0];
      member.width = "600"; member.height = "800"; member.elevation = "0";
      member.measures.sectionWidth = { design: "600", actual: "602" };
      member.measures.sectionHeight = { design: "800", actual: "798" };
      localStorage.setItem(key, JSON.stringify(stored));
    }""")
    page.reload(wait_until="networkidle")
    migrated = page.evaluate("() => { const m = state.members[0]; return { units: state.units, width: m.width, height: m.height, design: m.measures.sectionWidth.design, actual: m.measures.sectionWidth.actual }; }")
    check("模板：舊草稿的 mm 數值載入時換算成 cm（600 → 60、602 → 60.2）",
          migrated == {"units": "cm", "width": "60", "height": "80", "design": "60", "actual": "60.2"}, migrated)
    text = pdf_text(page, "all")
    check("模板：PDF 的尺寸欄位標示 cm", "設計／基準" in text and "cm" in text and "mm" not in text.replace("mm 以上", ""), text[:200])
    page.context.close()


# ---------------------------------------------------------------- 檢查項目文字改版後的舊草稿、動態判定標準
def verify_check_text_refresh(browser):
    """判定標準與 placeholder 以程式定義為準：舊草稿只留 actual／result；名稱改掉的項目填值不帶入。
    品質自檢畫面上的判定標準跟著檢查標準值與單元類型（埋入深度未選單元類型時列出三種）。"""
    page = open_clean(browser, "diaphragm-wall")
    page.evaluate("() => { loadExample(); draft.schedule(); }")
    page.wait_for_timeout(700)
    page.evaluate("""() => {
      const key = Object.keys(localStorage).find(k => k.endsWith('.draft'));
      const stored = JSON.parse(localStorage.getItem(key));
      stored.data.quality.checks[4].standard = "鋪面下 50 cm～100 cm 以內";
      stored.data.quality.checks[4].actual = "鋪面下 70 cm";
      stored.data.quality.checks[1].placeholder = "舊 placeholder";
      stored.data.guideWall.checks[3].standard = "舊的深度標準";
      stored.data.guideWall.checks[3].actual = "1.9 m";
      stored.data.guideWall.checks[0] = { item: "已改名的項目", standard: "x", actual: "不該帶入", result: "符合" };
      localStorage.setItem(key, JSON.stringify(stored));
    }""")
    page.reload(wait_until="networkidle")
    after = page.evaluate("""() => ({
      q5: [state.quality.checks[4].standard, state.quality.checks[4].actual], q2: state.quality.checks[1].placeholder,
      g4: [state.guideWall.checks[3].standard, state.guideWall.checks[3].actual], g1: [state.guideWall.checks[0].item, state.guideWall.checks[0].actual, state.guideWall.checks[0].result],
      count: [state.quality.checks.length, state.guideWall.checks.length, state.rebarCage.checks.length] })""")
    check("廠商版：舊草稿的判定標準／placeholder 換成程式定義，actual 保留；改名項目的填值不帶入", after["q5"] == ["液面在導溝頂下 80 cm 以內；高於地下水位 1.0 m 以上（現場確認）", "鋪面下 70 cm"] and after["q2"] == "例如：12" and after["g4"][1] == "1.9 m" and "1.8 m" in after["g4"][0] and after["g1"] == ["放樣", "", "待確認"] and after["count"] == [18, 11, 7], after)
    dynamic = page.evaluate("""() => {
      const text = i => document.querySelectorAll('#quality-check-list .quality-card p')[i].textContent;
      state.wall.unitType = ""; renderQuality();
      const none = text(16);
      state.wall.unitType = "母單元"; state.quality.standards.embedmentFemale = "2.0"; renderQuality();
      return { none, chosen: text(16), sediment: text(1), tremie: text(9), slump: text(14) }; }""")
    check("廠商版：品質自檢畫面的判定標準跟著檢查標準值（沉泥 15、初灌 30～50、坍度 20±2）", dynamic["sediment"] == "沉泥厚度 ≤ 15 cm" and dynamic["tremie"] == "初灌管底離槽溝底 30～50 cm" and dynamic["slump"].startswith("坍度 20 cm；允許誤差 2 cm"), dynamic)
    check("廠商版：埋入深度未選單元類型時列出公／母／公母三種標準值，選了就只顯示該類型", dynamic["none"].startswith("依壁體資訊的單元類型套用：公單元 ≥ 1.5 m／母單元 ≥ 1.5 m／公母單元 ≥ 1.5 m") and dynamic["chosen"] == "母單元：埋入深度 ≥ 2.0 m", dynamic)
    spin = page.evaluate("""() => { const rules = [...document.styleSheets].flatMap(sheet => { try { return [...sheet.cssRules]; } catch (e) { return []; } });
      const spinRule = rules.find(rule => rule.selectorText?.includes('::-webkit-inner-spin-button'));
      return [spinRule?.style.getPropertyValue('-webkit-appearance'), getComputedStyle(document.querySelector('input[type="number"]')).getPropertyValue('appearance')]; }""")
    check("數字欄位不顯示上下微調按鈕（glass.css）", spin == ["none", "textfield"], spin)
    page.context.close()


# ---------------------------------------------------------------- 營造廠版：停檢點改版後的舊草稿／舊 JSON
def verify_gc_hold_migration(browser):
    """2026-09-19 停檢點改版：比重／含砂量從停檢點 1 搬到 2、停檢點 2 拿掉地錨套管、停檢點 3 拿掉中斷時間。
    舊草稿只有 index 沒有 key，要靠陣列長度判斷再逐格重排；舊 JSON 有 key，但搬家的兩項要跨停檢點對回去。"""
    page = open_clean(browser, "diaphragm-wall-gc")
    page.evaluate("""() => {
      const rec = tag => ({ actual: tag, result: "符合" });
      const old = {
        hold1: ["中心線", "淨寬", "深度", "垂直", "偏擺", "沉泥", "比重", "含砂", "端板刷洗"].map(rec),
        hold2: ["配筋", "續接器", "滾輪", "梁柱預埋", "地錨", "開口箱", "傾度管", "鋼筋計", "頂高程"].map(rec),
        hold3: ["坍度", "氯離子", "試體組", "試體編號", "初灌", "埋入", "起訖", "中斷", "總方量", "頂面"].map(rec),
        hold4: ["沉陷", "水位"].map(rec)
      };
      localStorage.setItem("project-portal.diaphragmWallGc.draft", JSON.stringify({ schema: "project-portal.draft.v1", data: { holds: old } }));
    }""")
    page.reload(wait_until="networkidle")
    landed = page.evaluate("() => Object.fromEntries(HOLD_POINTS.map(h => [h.id, h.items.map((d, i) => [d.key, state.holds[h.id][i].actual])]))")
    expected = {
        "hold1": ["中心線", "淨寬", "深度", "垂直", "偏擺", "沉泥", "端板刷洗"],
        "hold2": ["配筋", "續接器", "滾輪", "梁柱預埋", "開口箱", "傾度管", "鋼筋計", "頂高程", "比重", "含砂"],
        "hold3": ["坍度", "氯離子", "試體組", "試體編號", "初灌", "埋入", "起訖", "總方量", "頂面"],
        "hold4": ["沉陷", "水位"],
    }
    actual = {hold: [value for _, value in items] for hold, items in landed.items()}
    check("營造廠版：舊草稿的停檢點值逐項對回新順序（含搬到停檢點 2 的比重／含砂量）", actual == expected, json.dumps(actual, ensure_ascii=False))
    check("營造廠版：停檢點 1／2／3 現為 7／10／9 項，且沒有舊 key", [len(v) for v in landed.values()] == [7, 10, 9, 2] and all(k not in ("interruption", "embedAnchor", "couplerTorque") for items in landed.values() for k, _ in items), landed)

    legacy = page.evaluate("() => { clearAllData(); loadExample(); return exportData(); }")
    hold1 = next(h for h in legacy["hold_points"] if h["hold_point_id"] == "hold1")
    hold2 = next(h for h in legacy["hold_points"] if h["hold_point_id"] == "hold2")
    hold1["items"] += [item for item in hold2["items"] if item["key"] in ("slurryDensity", "sandContent")]
    hold2["items"] = [item for item in hold2["items"] if item["key"] not in ("slurryDensity", "sandContent")]
    for item in hold1["items"]:
        if item["key"] == "slurryDensity": item["actual"] = "1.07"
    after = page.evaluate("(payload) => { clearAllData(); importJsonPayload(payload); const h2 = HOLD_BY_ID.hold2.items.map(d => d.key); return { density: state.holds.hold2[h2.indexOf('slurryDensity')].actual, sand: state.holds.hold2[h2.indexOf('sandContent')].result }; }", legacy)
    check("營造廠版：舊 JSON 把比重／含砂量放在停檢點 1 → 匯入後落到停檢點 2", after == {"density": "1.07", "sand": "符合"}, after)
    page.context.close()


# ---------------------------------------------------------------- 共用號數清單
def verify_bar_sizes(browser):
    page = open_clean(browser, "rebar")
    result = page.evaluate("""() => ({
      count: BAR_SIZES.length, mark: barSizeMark("D32"), label: barSizeLabel("D32"),
      legacyMark: barSizeMark("D35"), legacyLabel: barSizeLabel("D35"), empty: barSizeLabel(""),
      options: barSizeOptions("D35").match(/<option/g).length
    })""")
    check("號數清單 13 個，D32 → #10 / D32（#10）", result["count"] == 13 and result["mark"] == "#10" and result["label"] == "D32（#10）", result)
    check("舊尺寸 D35 保留：mark 原樣、label 加（舊）、下拉多一項", result["legacyMark"] == "D35" and result["legacyLabel"] == "D35（舊）" and result["options"] == 15 and result["empty"] == "", result)
    page.evaluate("""() => { state.members = [createMember({ id: "C1", bars: [{ kind: "主筋", size: "D32", count: "12" }] })]; renderAll?.(); }""")
    text = pdf_text(page, "all")
    check("鋼筋工程 PDF 配筋只印 #10", "#10" in text and "D32" not in text, text[:300])
    page.context.close()

    page = open_clean(browser, "diaphragm-wall-gc")
    page.evaluate("""() => { Object.assign(state.guideWall.checks[5], { designBarNo: "D16", designBarSpacing: "20", barNo: "D16", barSpacing: "17.5" }); activeTool = "guideWall"; renderAll?.(); }""")
    text = pdf_text(page, "current")
    flat = "".join(text.split())  # 表格欄窄，PDF 抽字會在任意處斷行
    check("導溝 PDF 鋼筋印設計／實測 #5@間距", "設計#5@20cm" in flat and "實測#5@17.5cm" in flat and "D16" not in text, text[:300])
    page.context.close()


# ---------------------------------------------------------------- 導溝數值項目自動判定（guide-wall.js）
def verify_guide_wall_measures(browser, html):
    page = open_clean(browser, html)
    result = page.evaluate("""() => {
      activeTool = "guideWall"; renderAll?.();
      const q = (i, f) => document.querySelector(`[data-check-item="guideWall"][data-check-index="${i}"][data-check-field="${f}"]`);
      const set = (i, f, v) => { const el = q(i, f); el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
      const r = i => state.guideWall.checks[i].result;
      const out = {};
      set(2, "design", "100"); set(2, "actual", "106"); out.widthFail = [r(2), q(2, "result").closest(".check-card").querySelector('input[value="符合"]').disabled];
      set(2, "actual", "104"); out.widthBack = r(2);
      set(3, "design", "1.5"); out.depthDesign = r(3);
      set(3, "design", "2"); set(3, "actual", "2"); out.depthEqual = r(3);
      q(4, "result").closest(".check-card").querySelector('input[value="不適用"]').click();
      set(4, "design", "20"); set(4, "actual", "10"); out.naKept = r(4);
      set(5, "designBarNo", "D16"); set(5, "designBarSpacing", "20"); set(5, "barNo", "D16"); set(5, "barSpacing", "17.5"); out.rebarPass = r(5);
      set(5, "barSpacing", "25"); out.rebarFail = r(5);
      set(7, "design", "210"); set(7, "actual", "200"); out.strength = r(7);
      set(8, "actual", "0.3"); out.top = guideCheckActual(state.guideWall.checks[8]);
      const payload = exportData();
      clearAllData(); importJsonPayload(JSON.parse(JSON.stringify(payload)));
      out.imported = [state.guideWall.checks[2].design, state.guideWall.checks[5].designBarSpacing, state.guideWall.checks[5].barSpacing, state.guideWall.checks[7].result];
      return out;
    }""")
    check(f"{html}：淨寬超出 ±5 cm → 自動 ✗ 且 ✓ 停用；改回範圍內退回待確認", result["widthFail"] == ["不符合", True] and result["widthBack"] == "待確認", result)
    check(f"{html}：深度設計 < 1.8 m 自動 ✗；實測 = 設計不算不合格", result["depthDesign"] == "不符合" and result["depthEqual"] == "待確認", result)
    check(f"{html}：選了 N/A 後數值不合格也不改", result["naKept"] == "不適用", result)
    check(f"{html}：鋼筋號數相同且間距 ≤ 設計自動 ✓，間距過大自動 ✗", result["rebarPass"] == "符合" and result["rebarFail"] == "不符合", result)
    check(f"{html}：強度低於設計自動 ✗；頂部高程印 GL-", result["strength"] == "不符合" and result["top"] == "GL-0.3 m", result)
    check(f"{html}：設計值經 JSON 匯出匯入保留", result["imported"] == ["100", "20", "25", "不符合"], result)
    page.context.close()


# ---------------------------------------------------------------- 數值自動判定：輸入容錯、改標準值即時重判（auto-judge.js）
# 外面包一層函式：Playwright 對「結果是函式」的運算式會直接呼叫它
SET_VALUE_JS = """() => { window.__set = (selector, value) => { const el = document.querySelector(selector); el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }; }"""


def verify_auto_judge(browser):
    page = open_clean(browser, "diaphragm-wall")
    page.evaluate(SET_VALUE_JS)
    guide = page.evaluate("""() => {
      activeTool = "guideWall"; renderAll?.();
      const q = f => `[data-check-item="guideWall"][data-check-index="2"][data-check-field="${f}"]`;
      const r = () => state.guideWall.checks[2].result;
      const locked = () => document.querySelector(`[data-check-card="guideWall-2"] input[value="符合"]`).disabled;
      const note = () => document.querySelector('[data-check-card="guideWall-2"] [data-guide-note]').textContent;
      __set(q("design"), "１００"); __set(q("actual"), "106cm"); const fail = [r(), locked()];
      __set(q("actual"), "約100"); const invalid = [r(), locked(), note()];
      __set(q("actual"), "103 cm"); const ok = [r(), locked()];
      return { fail, invalid, ok, print: guideCheckActual(state.guideWall.checks[2]) };
    }""")
    check("輸入容錯：全形數字與「106cm」可判定；「約100」紅框提示請輸入數值、✓ 停用、退回待確認", guide["fail"] == ["不符合", True] and guide["invalid"] == ["待確認", True, "請輸入數值"] and guide["ok"] == ["待確認", False], guide)
    check("輸入容錯：列印時整理成數字＋單位", guide["print"] == "設計 100 cm；實測 103 cm（許可值 95～105 cm）", guide)

    quality = page.evaluate("""() => {
      state.wall.unitType = "公單元"; activeTool = "diaphragmWall"; renderAll?.();
      const q = i => `[data-quality-item="${i}"][data-quality-field="actual"]`;
      const r = i => state.quality.checks[i].result;
      __set(q(1), "18"); const sediment = r(1);
      __set('[data-quality-standard="sediment"]', "20"); const relaxed = r(1);
      __set('[data-quality-standard="sediment"]', "15"); const tightened = r(1);
      __set(q(4), "90"); __set(q(9), "25"); __set(q(14), "23"); __set(q(16), "1.2"); __set(q(17), "1/250");
      state.wall.strength = "350"; renderAll?.(); __set(q(15), "300");
      __set(q(0), "abc");
      const results = [4, 9, 14, 15, 16, 17].map(r);
      __set(q(17), "abc"); const invalid = [r(17), document.querySelector('[data-quality-card="17"] input[value="符合"]').disabled];
      return { sediment, relaxed, tightened, results, invalid, text: r(0), print: qualityActualText(state.quality.checks[4]) };
    }""")
    check("06 品質自檢：沉泥超過標準自動 ✗；標準值改寬後立即退回待確認、改回又自動 ✗", [quality["sediment"], quality["relaxed"], quality["tightened"]] == ["不符合", "待確認", "不符合"], quality)
    check("06 品質自檢：液面、初灌、坍度、強度、埋入、垂直精度不合格都自動 ✗；文字項目不判定", quality["results"] == ["不符合"] * 6 and quality["text"] == "待確認", quality)
    check("06 品質自檢：數值欄輸入文字 → ✓ 停用、退回待確認；液面列印「導溝頂下 90 cm」", quality["invalid"] == ["待確認", True] and quality["print"] == "導溝頂下 90 cm", quality)

    # 計畫封面跟著 JSON 走（修訂紀錄由 plans/revisions.js 維護，不進 JSON）
    page.evaluate("""() => localStorage.setItem('project-portal.plan.diaphragm-wall.draft', JSON.stringify({ schema: 'project-portal.draft.v1',
      data: { version: 'full', cover: { project: 'P', contractor: 'C', author: '工務所', date: '2026-09-01' } } }))""")
    plan = page.evaluate("""() => { const payload = exportData(); localStorage.removeItem('project-portal.plan.diaphragm-wall.draft');
      clearAllData(); importJsonPayload(JSON.parse(JSON.stringify(payload)));
      const restored = JSON.parse(localStorage.getItem('project-portal.plan.diaphragm-wall.draft')).data;
      return { exported: payload.construction_plan, restored: [restored.version, restored.cover.author, restored.cover.date, 'revisions' in restored], payload }; }""")
    check("計畫封面（編製單位、日期、版本）寫進 JSON，匯入後還原；修訂紀錄不進 JSON", plan["exported"]["work"] == "diaphragm-wall" and "revisions" not in plan["exported"] and plan["restored"] == ["full", "工務所", "2026-09-01", False], plan["restored"])
    page.context.close()

    page = open_clean(browser, "diaphragm-wall-gc")
    page.evaluate(SET_VALUE_JS)
    vendor_into_gc = page.evaluate("""(payload) => { importJsonPayload(payload); return localStorage.getItem('project-portal.plan.diaphragm-wall-gc.draft'); }""", plan["payload"])
    check("營造廠版匯入廠商 JSON 不會動到營造廠的計畫草稿", vendor_into_gc is None, vendor_into_gc)
    hold = page.evaluate("""() => {
      clearAllData(); showTab?.("hold1");
      const q = (h, key) => `[data-hold="${h}"][data-hold-index="${HOLD_BY_ID[h].items.findIndex(d => d.key === key)}"][data-hold-field="actual"]`;
      const r = (h, key) => state.holds[h][HOLD_BY_ID[h].items.findIndex(d => d.key === key)].result;
      state.guideWall.checks[2].design = "100"; renderAll?.();
      __set(q("hold1", "guideClear"), "106"); const clearFail = r("hold1", "guideClear");
      __set(q("hold1", "guideClear"), "104"); const clearOk = r("hold1", "guideClear");
      __set(q("hold1", "sediment"), "18"); const sediment = r("hold1", "sediment");
      __set('[data-standard="sediment"]', "20"); const relaxed = r("hold1", "sediment");
      __set(q("hold1", "verticality"), "1/250"); const vertical = r("hold1", "verticality");
      __set(q("hold2", "slurryDensity"), "1.10"); const density = r("hold2", "slurryDensity");
      __set(q("hold3", "slump"), "abc");
      const slumpIndex = HOLD_BY_ID.hold3.items.findIndex(d => d.key === "slump");
      const invalid = [r("hold3", "slump"), document.querySelector(`[data-hold-card="hold3-${slumpIndex}"] input[value="符合"]`).disabled];
      return { clearFail, clearOk, sediment, relaxed, vertical, density, invalid };
    }""")
    check("01 停檢點：導溝淨寬以導溝複核表設計淨寬 ±5 cm 自動判定", hold["clearFail"] == "不符合" and hold["clearOk"] == "待確認", hold)
    check("01 停檢點：沉泥超標自動 ✗、標準值改寬立即退回；垂直度可寫 1/250；比重 1.10 未小於 1.1 判 ✗；非數值 ✓ 停用", hold["sediment"] == "不符合" and hold["relaxed"] == "待確認" and hold["vertical"] == "不符合" and hold["density"] == "不符合" and hold["invalid"] == ["待確認", True], hold)
    page.context.close()


# ---------------------------------------------------------------- 鋼筋籠部位資料層
def verify_rebar_cage_helpers(browser):
    page = open_clean(browser, "diaphragm-wall-gc")
    result = page.evaluate("""() => {
      const parts = createRebarCageParts();
      const outer = parts[0], inner = parts[1], joint = parts[7], lug = parts[11];
      outer.intervals = [
        { top: "0", bottom: "10", size: "D32", spacing: "60", extra: { enabled: false, size: "", spacing: "" } },
        { top: "20", bottom: "30", size: "D32", spacing: "60", extra: { enabled: true, size: "D32", spacing: "15" } }
      ];
      parts[2].symmetric = true;
      joint.count = "3"; joint.size = "D19";
      lug.spacing = "200";
      const bad = rebarCageIntervalIssues([{ top: "0", bottom: "0" }, { top: "5", bottom: "30" }, { top: "20", bottom: "40" }]);
      return {
        count: parts.length, keys: parts.map(p => p.key).slice(0, 2), part9: REBAR_CAGE_PARTS[8].part,
        outerRows: rebarCagePrintRows(outer, parts), outerSummary: rebarCageSummary(outer, parts),
        innerSummary: rebarCageSummary(inner, parts), mirroredHorizontal: rebarCageMirrored(parts[3], parts), symmetricHorizontal: rebarCageSymmetric(parts[3], parts),
        jointRows: rebarCagePrintRows(joint, parts), lugRows: rebarCagePrintRows(lug, parts),
        issues: bad.map(set => [...set]),
        normalized: normalizeRebarCageParts([{ key: "jointVertical", count: 5, result: "符合" }, { key: "innerVertical", symmetric: true }]).map(p => [p.key, p.count ?? p.intervals.length, p.result, p.symmetric]).slice(0, 8)
      };
    }""")
    check("13 個部位、第 9 項為端板擋筋(母單元)", result["count"] == 13 and result["keys"] == ["outerVertical", "innerVertical"] and result["part9"] == "端板擋筋(母單元)", result)
    check("區間列印文字：GL-0／GL-10／#10@60，補強列 #10@60+#10@15", result["outerRows"] == [
        {"top": "GL-0", "bottom": "GL-10", "count": "", "bars": "#10@60"},
        {"top": "GL-20", "bottom": "GL-30", "count": "", "bars": "#10@60+#10@15"}], result["outerRows"])
    check("卡片摘要 GL-0～-10 #10@60", result["outerSummary"] == ["GL-0～-10 #10@60", "GL-20～-30 #10@60+#10@15"], result["outerSummary"])
    check("內側未連動時摘要為尚未填寫；外側 3 勾對稱 → 內側 4 同外側", result["innerSummary"] == ["尚未填寫"] and result["mirroredHorizontal"] and result["symmetricHorizontal"], result)
    check("單列型：3 支 #6；護耳 @200", result["jointRows"] == [{"top": "", "bottom": "", "count": "3", "bars": "#6"}] and result["lugRows"][0]["bars"] == "@200", result)
    check("紅框：底部≤頂部標 bottom、下一區間淺於上一區間標 top", result["issues"] == [["bottom"], [], ["top"]], result["issues"])
    check("normalize：缺的部位補預設、數字轉字串、內側不存對稱", result["normalized"][7] == ["jointVertical", "5", "符合", False] and result["normalized"][1] == ["innerVertical", 1, "待確認", False] and result["normalized"][0] == ["outerVertical", 1, "待確認", False], result["normalized"])
    page.context.close()


# ---------------------------------------------------------------- 鋼筋籠畫面
def verify_rebar_cage_ui(browser, html):
    page = open_clean(browser, html)
    page.evaluate("() => { showTool('rebarCage'); showTab('cage-rebar'); }")
    result = page.evaluate("""() => {
      const cards = () => document.querySelectorAll('#rebar-cage-rebar-list .rebar-part-card');
      const simpleCount = cards().length, simpleFill = document.querySelectorAll('[data-edit-part]').length;
      document.querySelector('[data-cage-mode="detailed"]').click();
      const detailedFill = document.querySelectorAll('[data-edit-part]').length;
      document.querySelector('[data-part-symmetric="2"]').click();
      const mirroredText = cards()[3].querySelector('.rebar-part-summary').textContent;
      const mirroredFill = cards()[3].querySelector('[data-edit-part]');
      document.querySelector('[data-edit-part="0"]').click();
      const dialogOpen = document.querySelector('#rebar-dialog').open;
      document.querySelector('[data-add-interval]').click();
      const intervals = document.querySelectorAll('.rebar-interval').length;
      const set = (i, field, value) => { const el = document.querySelectorAll('.rebar-interval')[i].querySelector(`[data-interval-field="${field}"]`); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
      set(0, 'top', '-0'); set(0, 'bottom', '10'); set(0, 'size', 'D32'); set(0, 'spacing', '60');
      set(1, 'top', '5');
      const invalid = [...document.querySelectorAll('.gl-field.is-invalid')].map(f => f.querySelector('input').dataset.intervalField);
      const focusKept = document.querySelectorAll('.rebar-interval')[1].querySelector('[data-interval-field="top"]').value === '5';
      document.querySelector('#rebar-form').requestSubmit();
      const summary = cards()[0].querySelector('.rebar-part-summary').textContent;
      document.querySelector('[data-part-result="0"][value="符合"]').click();
      const pill = document.querySelector('.t-tabs-pill').style.width;
      return { simpleCount, simpleFill, detailedFill, mirroredText, mirroredFill: !!mirroredFill, dialogOpen, intervals, invalid, focusKept, summary, mode: state.rebarCage.mode,
               top0: state.rebarCage.parts[0].intervals[0].top, top1: state.rebarCage.parts[0].intervals[1].top, result0: state.rebarCage.parts[0].result,
               progress: document.querySelector('#rebar-cage-rebar-progress').textContent, pill };
    }""")
    check(f"{html}：簡易 13 張卡片、沒有填寫鈕；切詳細後每張都有填寫鈕", result["simpleCount"] == 13 and result["simpleFill"] == 0 and result["detailedFill"] == 13 and result["mode"] == "detailed", result)
    check(f"{html}：外側 3 勾對稱 → 內側 4 顯示同外側且無填寫鈕", "同外側" in result["mirroredText"] and not result["mirroredFill"], result)
    check(f"{html}：填寫視窗可加區間、-0 轉正、下一區間頂部淺於上一區間底部只標該欄紅框且不重畫", result["dialogOpen"] and result["intervals"] == 2 and result["invalid"] == ["top"] and result["focusKept"] and result["top0"] == "0" and result["top1"] == "5", result)
    check(f"{html}：確認後摘要＝GL-0～-10 #10@60，結果寫回並更新進度", "GL-0～-10 #10@60" in result["summary"] and result["result0"] == "符合" and result["progress"] == "1 / 13", result)
    check(f"{html}：藥丸有量到寬度", result["pill"].endswith("px") and result["pill"] != "0px", result["pill"])
    page.context.close()


# ---------------------------------------------------------------- PDF 內容
def verify_pdf_content(browser):
    page = open_clean(browser, "diaphragm-wall", "?example=1")
    page.evaluate("""() => {
      state.quality.checks[1].result = "不符合"; state.quality.checks[1].actual = "沉泥 35 cm";
      state.quality.checks[2].result = "待確認";
      state.rebarCage.cageNo = "C21-U";
      renderAll?.(); renderPrint();
    }""")
    text = pdf_text(page, "all")
    check("廠商版 PDF：不符合項目與實測值都印出", "不符合" in text and "沉泥 35 cm" in text, text[:200])
    check("廠商版 PDF：待確認項目印出", "待確認" in text)
    check("廠商版 PDF：導溝頁表頭印軸線編號，鋼筋籠頁帶壁體單元 21｜C21-U", "X3～X7 南側" in text and "不分單元" not in text and "21｜C21-U" in text)
    check("廠商版 PDF：跨午夜時間以 30 時制印出", "24:" in text or "25:" in text, "找不到 24:xx")
    page.context.close()

    page = open_clean(browser, "diaphragm-wall-gc", "?example=1")
    page.evaluate("""() => {
      state.holds.hold1[0].result = "不符合"; state.holds.hold1[0].actual = "28 mm";
      state.conclusion.verdict = "限期改善後複驗";
      renderAll?.(); renderPrint();
    }""")
    text = pdf_text(page, "all")
    check("營造廠版 PDF：不符合項目、實測值與結論都印出", "不符合" in text and "28 mm" in text and "限期改善後複驗" in text, text[:200])
    check("營造廠版 PDF：導溝表頭印軸線編號、鋼筋籠帶單元 21", "X3～X7 南側" in text and "不分單元" not in text and "21｜C21-U／C21-L" in text)
    page.context.close()

    page = open_clean(browser, "diaphragm-wall-gc", "?example=1")
    page.evaluate("() => { activeTool = 'rebarCage'; state.rebarCage.mode = 'simple'; renderAll?.(); }")
    simple = pdf_text(page, "current")
    check("鋼筋籠 PDF 簡易表：說明欄與端板擋筋銲接文字", "依設計圖說配置，銲喉4mm且銲長至少50mm" in simple and "頂部(m)" not in simple, simple[:300])
    page.evaluate("() => { state.rebarCage.mode = 'detailed'; renderAll?.(); }")
    detailed = pdf_text(page, "current")
    check("鋼筋籠 PDF 詳細表：區間、補強、同外側、支數都印出", all(s in detailed for s in ["頂部(m)", "GL-20", "#10@60+#10@30", "✔", "@200"]) and "依設計圖說配置" not in detailed, detailed[:400])
    page.context.close()


# ---------------------------------------------------------------- 施工計畫頁
def open_plan(browser, query):
    page = new_page(browser)
    page.goto(f"{BASE}/plan{query}", wait_until="networkidle")
    page.wait_for_function("typeof state === 'object' && typeof renderPlan === 'function'")
    return page


def verify_plan_page(browser):
    for work in ("diaphragm-wall-gc", "diaphragm-wall", "formwork", "rebar", "steel"):
        page = open_plan(browser, f"?work={work}&from=template")
        page.evaluate("() => { try { localStorage.clear(); } catch (e) {} }")
        result = page.evaluate("""() => {
          const count = () => document.querySelectorAll('#plan-article > .plan-section').length;
          const tocCount = () => document.querySelectorAll('#toc-list > li').length;
          state.version = 'brief'; renderArticle(); const brief = count(), briefToc = tocCount();
          state.version = 'full'; renderArticle(); const full = count(), fullToc = tocCount();
          const html = document.body.innerHTML;
          const revisions = PLAN_REVISIONS[new URLSearchParams(location.search).get('work')];
          const revision = { cover: document.querySelector('#plan-revision').textContent, last: revisions.at(-1).version, rows: document.querySelectorAll('#revision-rows tr').length, count: revisions.length, inputs: document.querySelectorAll('#revision-rows input, [data-cover="revision"], #add-revision').length };
          return { brief, briefToc, full, fullToc, revision, title: document.querySelector('#plan-title').textContent, placeholders: /Task [678] 補/.test(html) };
        }""")
        check(f"計畫頁 {work}：兩版都能彩現、目錄項目數＝章節數、精簡版章節少於完整版", result["brief"] == result["briefToc"] and result["full"] == result["fullToc"] and 0 < result["brief"] < result["full"] and result["title"], result)
        check(f"計畫頁 {work}：沒有殘留的佔位文字", not result["placeholders"], result)
        rev = result["revision"]
        check(f"計畫頁 {work}：修訂紀錄照 plans/revisions.js 顯示、封面版次＝最後一列，使用者不能改", rev["cover"] == rev["last"] and rev["rows"] == rev["count"] and rev["inputs"] == 0, rev)
        page.context.close()

    page = open_clean(browser, "diaphragm-wall-gc")
    page.evaluate("() => { state.overview.project = '帶入測試工程'; state.overview.contractor = '帶入營造'; draft.schedule(); }")
    page.wait_for_timeout(700)
    page.evaluate("() => { Object.keys(localStorage).filter(k => k.startsWith('project-portal.plan.')).forEach(k => localStorage.removeItem(k)); }")
    page.goto(f"{BASE}/plan?work=diaphragm-wall-gc&from=diaphragm-wall-gc", wait_until="networkidle")
    page.wait_for_function("typeof renderPlan === 'function'")
    result = page.evaluate("() => ({ project: state.cover.project, contractor: state.cover.contractor, back: document.querySelector('#back-link').getAttribute('href'), title: (setPrintDocumentTitle(planFileName()), document.title) })")
    check("計畫頁：from 工具的工程名稱／廠商帶入封面，返回連結指回工具頁，PDF 檔名含版本", result["project"] == "帶入測試工程" and result["contractor"] == "帶入營造" and result["back"] == "./diaphragm-wall-gc" and "精簡版" in result["title"], result)
    # 封面改工程名稱 → 寫回工具頁草稿；工具頁改了之後再開計畫，封面跟著更新；編製單位不同步
    page.evaluate("""() => { const input = document.querySelector('[data-cover="project"]'); input.value = '計畫改名工程'; input.dispatchEvent(new Event('input', { bubbles: true }));
      const author = document.querySelector('[data-cover="author"]'); author.value = '工務所'; author.dispatchEvent(new Event('input', { bubbles: true })); }""")
    page.wait_for_timeout(600)
    back = page.evaluate("() => JSON.parse(localStorage.getItem('project-portal.diaphragmWallGc.draft')).data.overview")
    check("計畫頁：封面改工程名稱寫回工具頁草稿，編製單位不寫回", back["project"] == "計畫改名工程" and back["contractor"] == "帶入營造" and "author" not in back, back)
    page.evaluate("() => { const stored = JSON.parse(localStorage.getItem('project-portal.diaphragmWallGc.draft')); stored.data.overview.contractor = '工具改廠商'; localStorage.setItem('project-portal.diaphragmWallGc.draft', JSON.stringify(stored)); }")
    page.goto(f"{BASE}/plan?work=diaphragm-wall-gc&from=diaphragm-wall-gc", wait_until="networkidle")
    page.wait_for_function("typeof renderPlan === 'function'")
    again = page.evaluate("() => ({ project: state.cover.project, contractor: state.cover.contractor, author: state.cover.author, field: document.querySelector('[data-cover=\"contractor\"]').value })")
    check("計畫頁：工具頁改了廠商，重開計畫封面同步；編製單位保留計畫自己的值", again == {"project": "計畫改名工程", "contractor": "工具改廠商", "author": "工務所", "field": "工具改廠商"}, again)
    page.wait_for_timeout(600)
    page.goto(f"{BASE}/diaphragm-wall-gc", wait_until="networkidle")
    page.wait_for_function("typeof state === 'object' && typeof clearAllData === 'function'")
    cleared = page.evaluate("""() => { const before = Boolean(localStorage.getItem('project-portal.plan.diaphragm-wall-gc.draft'));
      document.querySelector('#confirm-clear').click();
      return { before, after: Boolean(localStorage.getItem('project-portal.plan.diaphragm-wall-gc.draft')), label: document.querySelector('#confirm-clear').textContent }; }""")
    check("工具頁「還原預設」一併清掉該工具的計畫草稿", cleared == {"before": True, "after": False, "label": "還原預設"}, cleared)
    page.context.close()


def verify_plan_links(browser):
    for html, work, back in (("diaphragm-wall-gc", "diaphragm-wall-gc", "diaphragm-wall-gc"), ("diaphragm-wall", "diaphragm-wall", "diaphragm-wall"), ("template", "formwork", "template"), ("rebar", "rebar", "rebar"), ("steel-structure", "steel", "steel-structure")):
        page = open_clean(browser, html)
        result = page.evaluate("() => ({ href: document.querySelector('.header-plan')?.getAttribute('href'), identity: !!document.querySelector('#record-identity') })")
        check(f"{html}：計畫按鈕指向 plan?work={work}", result["href"] == f"./plan?work={work}&from={back}" and not result["identity"], result)
        page.context.close()


def verify_unit_sync(browser, html, unit_path):
    page = open_clean(browser, html)
    result = page.evaluate(f"""() => {{
      showTool('rebarCage'); showTab('cage-meta');
      const inputs = [...document.querySelectorAll('[data-bind$=".unitNo"]')];
      const cage = inputs.find(i => i.closest('#tool-rebar-cage'));
      const wall = inputs.find(i => !i.closest('#tool-rebar-cage'));
      cage.value = '77'; cage.dispatchEvent(new Event('input', {{ bubbles: true }}));
      const seq = [...document.querySelectorAll('[data-bind$=".sequenceNo"]')];
      const wallSeq = seq.find(i => !i.closest('#tool-rebar-cage')); const cageSeq = seq.find(i => i.closest('#tool-rebar-cage'));
      wallSeq.value = '05'; wallSeq.dispatchEvent(new Event('input', {{ bubbles: true }}));
      return {{ state: {unit_path}, wallInput: wall.value, cageSeq: cageSeq.value }};
    }}""")
    check(f"{html}：鋼筋籠分頁改單元編號 → state 與連續壁分頁同步；連續壁改順序編號 → 鋼筋籠分頁同步", result == {"state": "77", "wallInput": "77", "cageSeq": "05"}, result)
    page.evaluate("() => { state.guideWall.axisNo = 'X3～X7'; activeTool = 'guideWall'; renderAll?.(); }")
    text = pdf_text(page, "current")
    check(f"{html}：導溝 PDF 表頭與導溝資料印軸線編號", text.count("X3～X7") >= 2 and "不分單元" not in text, text[:200])
    page.evaluate("() => { activeTool = 'rebarCage'; renderAll?.(); }")
    text = pdf_text(page, "current")
    check(f"{html}：鋼筋籠 PDF 印順序編號 05", "順序編號" in text and "05" in text, text[:200])
    page.context.close()


def verify_member_delete(browser, html):
    page = open_clean(browser, html)
    result = page.evaluate("""async () => {
      const add = document.querySelector('#add-member'); add.click(); add.click();
      const total = state.members.length;
      const button = () => document.querySelector('[data-remove-member="0"]');
      button().click(); const armed = button().classList.contains('is-armed'); const afterOne = state.members.length;
      button().click(); const afterTwo = state.members.length;
      button().click(); await new Promise(r => setTimeout(r, 4500)); const timedOut = !button().classList.contains('is-armed');
      button().click(); document.body.click(); const disarmedByClickAway = !button().classList.contains('is-armed');
      while (state.members.length) { const b = button(); b.click(); b.click(); }
      window.print = () => {}; preparePrint('all');
      return { total, armed, afterOne, afterTwo, timedOut, disarmedByClickAway, empty: state.members.length, printText: document.body.innerHTML.includes('尚無構件') };
    }""")
    check(f"{html}：點一下只 arm 不刪，再點才刪", result["armed"] and result["afterOne"] == result["total"] and result["afterTwo"] == result["total"] - 1, result)
    check(f"{html}：arm 後 4 秒逾時或點到別處恢復；可刪到 0 筆且 PDF 印尚無構件", result["timedOut"] and result["disarmedByClickAway"] and result["empty"] == 0 and result["printText"], result)
    page.context.close()


server = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "serve.py"), str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        verify_vendor_calculations(browser)
        verify_roundtrip(browser, "diaphragm-wall", "廠商版", "state.wall.unitNo")
        verify_roundtrip(browser, "diaphragm-wall-gc", "營造廠版", "state.unit.unitNo")
        verify_gc_hold_migration(browser)
        verify_standard_default_migration(
            browser, "diaphragm-wall", "廠商版", "quality.standards", "quality_self_check.standards",
            seed={"cageLongitudinalTolerance": "±7.5", "slump": "18", "sediment": "10", "cover": "5", "volumeDifference": "15"},
            expected={"cageLongitudinalTolerance": "±5", "slump": "20", "sediment": "15", "cover": "5", "volumeDifference": "15", "chloride": "0.15"})
        verify_standard_default_migration(
            browser, "diaphragm-wall-gc", "營造廠版", "standards", "standards",
            seed={"sediment": "10", "rollerSpacing": "4", "cover": "7.5", "tremieInitialMin": "10", "tremieInitialMax": "20", "overbreakMin": "5", "overbreakMax": "15", "slump": "19"},
            expected={"sediment": "15", "rollerSpacing": "3", "cover": "10", "tremieInitialMin": "30", "tremieInitialMax": "50", "overbreakMin": "-5", "overbreakMax": "5", "slump": "19", "chloride": "0.15"})
        verify_vendor_links(browser)
        verify_check_text_refresh(browser)
        verify_cage_photos(browser, "diaphragm-wall", "廠商版")
        verify_cage_photos(browser, "diaphragm-wall-gc", "營造廠版")
        verify_formwork_units(browser)
        verify_bar_sizes(browser)
        verify_guide_wall_measures(browser, "diaphragm-wall")
        verify_guide_wall_measures(browser, "diaphragm-wall-gc")
        verify_auto_judge(browser)
        verify_rebar_cage_helpers(browser)
        verify_rebar_cage_ui(browser, "diaphragm-wall-gc")
        verify_rebar_cage_ui(browser, "diaphragm-wall")
        verify_pdf_content(browser)
        verify_plan_page(browser)
        verify_plan_links(browser)
        verify_unit_sync(browser, "diaphragm-wall-gc", "state.unit.unitNo")
        verify_unit_sync(browser, "diaphragm-wall", "state.wall.unitNo")
        verify_member_delete(browser, "template")
        verify_member_delete(browser, "rebar")
        browser.close()
finally:
    server.terminate()

print()
if failures:
    print(f"❌ {len(failures)} 項失敗：", *failures, sep="\n  ")
    sys.exit(1)
print("✅ 全部通過")
