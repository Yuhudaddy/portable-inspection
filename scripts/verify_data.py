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
    return page


def open_clean(browser, html, query=""):
    page = new_page(browser)
    page.goto(f"{BASE}/{html}{query}", wait_until="networkidle")
    page.wait_for_function("typeof state === 'object' && typeof exportData === 'function'")  # 頁面 script 跑完再動手
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
    first = page.evaluate("() => { loadExample(); renderAll?.(); return exportData(); }")
    second = page.evaluate("""(payload) => { clearAllData(); importJsonPayload(JSON.parse(JSON.stringify(payload))); return exportData(); }""", first)
    check(f"{tool}：JSON 匯出 → 清空 → 匯入 → 再匯出，內容一致", strip_volatile(first) == strip_volatile(second),
          json.dumps({k: (strip_volatile(first).get(k), strip_volatile(second).get(k)) for k in strip_volatile(first) if strip_volatile(first).get(k) != strip_volatile(second).get(k)}, ensure_ascii=False)[:600])
    check(f"{tool}：schema 1.3，導溝／鋼筋籠不再各帶 unit_no", first["schema_version"] == "1.3" and "unit_no" not in first["guide_wall_review"] and "unit_no" not in first["rebar_cage_review"], first["schema_version"])
    unit_no = page.evaluate(f"() => {unit_path}")
    check(f"{tool}：範例單元編號 21 存在壁體", unit_no == "21", unit_no)

    # 1.2 以前的 JSON：壁體沒有單元編號、鋼筋籠自己帶 → 補到壁體；導溝的舊 unit_no 忽略
    legacy = json.loads(json.dumps(first))
    legacy["schema_version"] = "1.2"
    legacy[("wall_unit")]["unit_no"] = None
    legacy["guide_wall_review"]["unit_no"] = "99"
    legacy["rebar_cage_review"]["unit_no"] = "21"
    after = page.evaluate(f"""(payload) => {{ clearAllData(); importJsonPayload(payload); return {{ unit: {unit_path}, guide: state.guideWall.unitNo, cage: state.rebarCage.unitNo }}; }}""", legacy)
    check(f"{tool}：舊 JSON 的鋼筋籠 unit_no 補到壁體，導溝的忽略", after == {"unit": "21", "guide": None, "cage": None}, after)

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
      localStorage.setItem(key, JSON.stringify(stored));
    }""")
    page.reload(wait_until="networkidle")
    migrated = page.evaluate(f"() => ({{ unit: {unit_path}, guide: state.guideWall.unitNo, cage: state.rebarCage.unitNo, field: document.getElementById('rebar-cage-unit')?.value }})")
    check(f"{tool}：舊草稿的鋼筋籠 unitNo 搬到壁體並顯示在鋼筋籠表單", migrated["unit"] == "37" and migrated["guide"] is None and migrated["cage"] is None and "37" in (migrated["field"] or ""), migrated)
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
    check("廠商版 PDF：導溝頁標示「不分單元」，鋼筋籠頁帶壁體單元 21｜C21-U", "不分單元" in text and "21｜C21-U" in text)
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
    check("營造廠版 PDF：導溝「不分單元」、鋼筋籠帶單元 21", "不分單元" in text and "21｜C21-U／C21-L" in text)
    page.context.close()


server = subprocess.Popen([sys.executable, str(ROOT / "scripts" / "serve.py"), str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        verify_vendor_calculations(browser)
        verify_roundtrip(browser, "diaphragm-wall", "廠商版", "state.wall.unitNo")
        verify_roundtrip(browser, "diaphragm-wall-gc", "營造廠版", "state.unit.unitNo")
        verify_pdf_content(browser)
        browser.close()
finally:
    server.terminate()

print()
if failures:
    print(f"❌ {len(failures)} 項失敗：", *failures, sep="\n  ")
    sys.exit(1)
print("✅ 全部通過")
