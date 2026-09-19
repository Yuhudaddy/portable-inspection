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
    check(f"{tool}：schema 1.4，導溝／鋼筋籠不再各帶 unit_no", first["schema_version"] == "1.4" and "unit_no" not in first["guide_wall_review"] and "unit_no" not in first["rebar_cage_review"], first["schema_version"])
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
    migrated = page.evaluate(f"() => ({{ unit: {unit_path}, guide: state.guideWall.unitNo, cage: state.rebarCage.unitNo, field: document.getElementById('rebar-cage-unit')?.value, parts: state.rebarCage.parts.length, mode: state.rebarCage.mode, rebars: 'rebars' in state.rebarCage }})")
    check(f"{tool}：舊草稿的鋼筋籠 unitNo 搬到壁體並顯示在鋼筋籠表單", migrated["unit"] == "37" and migrated["guide"] is None and migrated["cage"] is None and "37" in (migrated["field"] or ""), migrated)
    check(f"{tool}：舊草稿的 rebars 丟棄、parts 重設 13 個、簡易模式", migrated["parts"] == 13 and migrated["mode"] == "simple" and not migrated["rebars"], migrated)
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
        hold2: ["配筋", "續接器", "滾輪", "樑柱預埋", "地錨", "開口箱", "傾度管", "鋼筋計", "頂高程"].map(rec),
        hold3: ["坍度", "氯離子", "試體組", "試體編號", "初灌", "埋入", "起訖", "中斷", "總方量", "頂面"].map(rec),
        hold4: ["沉陷", "水位"].map(rec)
      };
      localStorage.setItem("project-portal.diaphragmWallGc.draft", JSON.stringify({ schema: "project-portal.draft.v1", data: { holds: old } }));
    }""")
    page.reload(wait_until="networkidle")
    landed = page.evaluate("() => Object.fromEntries(HOLD_POINTS.map(h => [h.id, h.items.map((d, i) => [d.key, state.holds[h.id][i].actual])]))")
    expected = {
        "hold1": ["中心線", "淨寬", "深度", "垂直", "偏擺", "沉泥", "端板刷洗"],
        "hold2": ["配筋", "續接器", "滾輪", "樑柱預埋", "開口箱", "傾度管", "鋼筋計", "頂高程", "比重", "含砂"],
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
    page.evaluate("""() => { state.guideWall.checks[5].barNo = "D16"; state.guideWall.checks[5].barSpacing = "20"; activeTool = "guideWall"; renderAll?.(); }""")
    text = pdf_text(page, "current")
    check("導溝 PDF 鋼筋號數印 #5", "號數 #5" in text and "D16" not in text, text[:300])
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

    page = open_clean(browser, "diaphragm-wall-gc", "?example=1")
    page.evaluate("() => { activeTool = 'rebarCage'; state.rebarCage.mode = 'simple'; renderAll?.(); }")
    simple = pdf_text(page, "current")
    check("鋼筋籠 PDF 簡易表：說明欄與端板擋筋銲接文字", "依設計圖說配置，銲喉4mm且銲長至少50mm" in simple and "頂部(m)" not in simple, simple[:300])
    page.evaluate("() => { state.rebarCage.mode = 'detailed'; renderAll?.(); }")
    detailed = pdf_text(page, "current")
    check("鋼筋籠 PDF 詳細表：區間、補強、同外側、支數都印出", all(s in detailed for s in ["頂部(m)", "GL-20", "#10@60+#10@30", "✔", "@200"]) and "依設計圖說配置" not in detailed, detailed[:400])
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
        verify_bar_sizes(browser)
        verify_rebar_cage_helpers(browser)
        verify_rebar_cage_ui(browser, "diaphragm-wall-gc")
        verify_rebar_cage_ui(browser, "diaphragm-wall")
        verify_pdf_content(browser)
        browser.close()
finally:
    server.terminate()

print()
if failures:
    print(f"❌ {len(failures)} 項失敗：", *failures, sep="\n  ")
    sys.exit(1)
print("✅ 全部通過")
