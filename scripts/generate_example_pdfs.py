from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, Image as RLImage, PageTemplate,
                                Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "examples"
FONT = Path.home() / "Library/Fonts/NotoSansTC-VariableFont_wght.ttf"
LOGO = ROOT / "taisei.png"
OUT.mkdir(exist_ok=True)

pdfmetrics.registerFont(TTFont("NotoTC", str(FONT)))

PAGE_W, PAGE_H = A4
INK = colors.HexColor("#343a40")
SOFT = colors.HexColor("#59616a")
LINE = colors.HexColor("#9ba1a6")
LIGHT = colors.HexColor("#edf0f2")
PALE = colors.HexColor("#f7f8f9")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Small", fontName="NotoTC", fontSize=7.5, leading=10, textColor=SOFT))
styles.add(ParagraphStyle(name="BodyTC", fontName="NotoTC", fontSize=8.4, leading=11.5, textColor=INK))
styles.add(ParagraphStyle(name="TableTC", fontName="NotoTC", fontSize=7.2, leading=9.2, textColor=INK))
styles.add(ParagraphStyle(name="TableSmall", fontName="NotoTC", fontSize=6.6, leading=8.2, textColor=INK))
styles.add(ParagraphStyle(name="Section", fontName="NotoTC", fontSize=10, leading=13, textColor=INK, spaceBefore=5*mm, spaceAfter=1.5*mm))
styles.add(ParagraphStyle(name="TitleTC", fontName="NotoTC", fontSize=17, leading=21, textColor=INK))
styles.add(ParagraphStyle(name="Meta", fontName="NotoTC", fontSize=7.2, leading=9, textColor=SOFT))
styles.add(ParagraphStyle(name="MetaValue", fontName="NotoTC", fontSize=9, leading=11, textColor=INK))
styles.add(ParagraphStyle(name="RightMeta", parent=styles["Meta"], alignment=TA_RIGHT))


def P(text, style="BodyTC"):
    return Paragraph(str(text).replace("\n", "<br/>"), styles[style])


def header(title, code, identity, project="Example Construction Project", contractor="○○營造股份有限公司", date="2026/08/28", reviewer="Site Engineer"):
    meta = Table([
        [P("工程名稱：" + project, "Meta"), P("施工日期：" + date, "Meta")],
        [P("施工廠商：" + contractor, "Meta"), P("填表人：" + reviewer, "Meta")],
    ], colWidths=[44*mm, 36*mm], rowHeights=[7*mm, 7*mm])
    meta.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 2*mm),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    logo = RLImage(str(LOGO), width=10*mm, height=10*mm, kind="proportional")
    right = Table([[meta, logo], [P(identity, "RightMeta"), ""]], colWidths=[80*mm, 13*mm], rowHeights=[14*mm, 4*mm])
    right.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 1), (-1, 1), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    left = [P(code, "Small"), P(title, "TitleTC")]
    top = Table([[left, right]], colWidths=[83*mm, 93*mm])
    top.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEABOVE", (0, 0), (-1, 0), 1.2, INK), ("LINEBELOW", (0, 0), (-1, 0), .7, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2*mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2*mm),
    ]))
    return top


def section(title):
    t = Table([[P(title, "Section")]], colWidths=[176*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("LINEABOVE", (0, 0), (-1, -1), .7, INK), ("LINEBELOW", (0, 0), (-1, -1), .35, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 2*mm), ("RIGHTPADDING", (0, 0), (-1, -1), 2*mm),
        ("TOPPADDING", (0, 0), (-1, -1), .7*mm), ("BOTTOMPADDING", (0, 0), (-1, -1), .7*mm),
    ]))
    return t


def meta_grid(items, cols=3):
    rows = []
    for i in range(0, len(items), cols):
        row = []
        for label, value in items[i:i+cols]:
            row.append([P(label, "Meta"), P(value, "MetaValue")])
        while len(row) < cols:
            row.append("")
        rows.append(row)
    table = Table(rows, colWidths=[176*mm/cols]*cols, rowHeights=[12*mm]*len(rows))
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), .35, LINE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2*mm), ("RIGHTPADDING", (0, 0), (-1, -1), 2*mm),
        ("TOPPADDING", (0, 0), (-1, -1), 1*mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 1*mm),
    ]))
    return table


def data_table(headers, rows, widths=None, small=False):
    style = "TableSmall" if small else "TableTC"
    data = [[P(h, style) for h in headers]] + [[P(cell, style) for cell in row] for row in rows]
    table = Table(data, colWidths=widths or [176*mm/len(headers)]*len(headers), repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT), ("TEXTCOLOR", (0, 0), (-1, 0), INK),
        ("GRID", (0, 0), (-1, -1), .35, LINE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1.3*mm), ("RIGHTPADDING", (0, 0), (-1, -1), 1.3*mm),
        ("TOPPADDING", (0, 0), (-1, -1), 1.2*mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 1.2*mm),
    ]))
    return table


def note(text):
    t = Table([[P(text, "BodyTC")]], colWidths=[176*mm])
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), .35, LINE), ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("LEFTPADDING", (0, 0), (-1, -1), 2*mm), ("RIGHTPADDING", (0, 0), (-1, -1), 2*mm),
        ("TOPPADDING", (0, 0), (-1, -1), 2*mm), ("BOTTOMPADDING", (0, 0), (-1, -1), 2*mm),
    ]))
    return t


def footer(canvas, doc):
    canvas.saveState()
    x = PAGE_W - 18*mm - 63*mm
    y = 7*mm
    canvas.rect(x, y, 63*mm, 8*mm, stroke=1, fill=0)
    for i, label in enumerate(["所長", "副所長", "擔當者"]):
        if i:
            canvas.line(x + i*21*mm, y, x + i*21*mm, y+8*mm)
        canvas.setFont("NotoTC", 6.5)
        canvas.drawCentredString(x + i*21*mm + 10.5*mm, y+5.2*mm, label)
    canvas.restoreState()


def document(path, flowables):
    doc = BaseDocTemplate(str(path), pagesize=A4, leftMargin=17*mm, rightMargin=17*mm, topMargin=13*mm, bottomMargin=19*mm, title=path.stem)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="records", frames=[frame], onPage=footer)])
    doc.build(flowables)


def template_pdf():
    story = [header("模板施工複核表", "RC FORMWORK / FIELD REVIEW / 01–02", "3F｜柱 C1-03")]
    story += [section("01｜工程概要"), meta_grid([("工程名稱", "Example Construction Project"), ("施工廠商", "○○營造股份有限公司"), ("施工日期", "2026/08/28"), ("檢查日期", "2026/08/28"), ("填表人", "Site Engineer"), ("檢查樓層", "3F"), ("施工區域／軸線", "A～C／1～3 軸"), ("施工圖／版次", "S-203 Rev.2"), ("檢查階段", "模板組立完成")]),
             Spacer(1, 3*mm), section("02｜構件資訊"), data_table(["項次", "類型", "構件編號", "軸線／位置", "設計寬度／厚度(mm)", "設計高度(mm)", "設計高程(mm)", "表面類型"], [["1", "柱", "C1-03", "A-1／B-C", "600", "800", "3200", "一般表面"], ["2", "梁", "G3-12", "B-2／3F", "300", "600", "3000", "一般表面"]], [10*mm, 14*mm, 21*mm, 28*mm, 27*mm, 22*mm, 22*mm, 32*mm], small=True),
             Spacer(1, 3*mm), section("配筋／預埋介面摘要"), note("柱模清潔口、預埋件及機電套管位置已與施工圖核對；澆置前應再確認模板內部清潔與巡檢動線。"), PageBreak()]
    story += [header("模板安裝與尺寸複核", "RC FORMWORK / FIELD REVIEW / 03–04", "3F｜柱 C1-03"), section("03｜模板安裝複核")]
    checks = [
        ["1", "放樣線與標示", "軸線、邊線及完成面標示完成", "實測偏差 1 mm", "合格"],
        ["2", "模板外觀與使用狀態", "無破損、翹曲或變形", "模板狀況良好", "合格"],
        ["3", "脫模劑", "塗布均勻且未污染鋼筋", "水性脫模劑", "合格"],
        ["4", "模板接縫密合", "無透光或漏漿風險", "接縫無透光", "合格"],
        ["5", "側向支撐與固定", "無滑動、傾倒或爆模風險", "槽鋼及斜撐完成", "合格"],
        ["6", "預埋件與套管", "位置、尺寸及數量符合圖說", "已完成核對", "合格"],
        ["7", "模板內部與清潔口", "無木屑、泥砂及積水", "清潔完成", "合格"],
    ]
    story += [data_table(["項次", "檢查項目", "判定標準", "現場紀錄／實測", "結果"], checks, [10*mm, 32*mm, 55*mm, 55*mm, 24*mm], small=True), Spacer(1, 3*mm), section("04｜尺寸複核"), data_table(["構件", "量測項目", "設計／基準(mm)", "實測(mm)", "差值(mm)", "容許差", "結果"], [["柱 C1-03", "斷面寬度", "600", "602", "+2", "-10～+13", "合格"], ["柱 C1-03", "斷面高度", "800", "798", "-2", "-10～+13", "合格"], ["柱 C1-03", "垂直度偏差", "0", "3", "+3", "±10", "合格"]], [25*mm, 35*mm, 27*mm, 22*mm, 20*mm, 29*mm, 18*mm], small=True), PageBreak()]
    release_checks = [("模板組立完成", "模板、接縫及固定均已完成"), ("尺寸與高程已複核", "重要位置、尺寸及高程已有實測紀錄"), ("支撐與固定完成", "側撐及防爆模措施已確認"), ("開口、套管與預埋完成", "位置、尺寸及固定方式符合圖說"), ("鋼筋與機電介面確認", "模板未壓迫鋼筋或機電預埋"), ("模板內部清潔完成", "無木屑、泥砂及積水"), ("澆置巡檢條件完成", "人員可安全巡檢"), ("廠商自主檢查紀錄完成", "缺失改善紀錄已提出")]
    release_rows = [[str(i), label, standard, "已確認", "合格"] for i, (label, standard) in enumerate(release_checks)]
    story += [header("澆置前放行／拆模後確認", "RC FORMWORK / FIELD REVIEW / 05", "3F｜柱 C1-03"), section("澆置前放行"), data_table(["項次", "確認項目", "確認基準", "紀錄／說明", "結果"], release_rows, [10*mm, 38*mm, 56*mm, 48*mm, 24*mm], small=True), Spacer(1, 4*mm), section("放行判定"), meta_grid([("澆置判定", "可澆置"), ("混凝土澆置日期", "2026/08/28"), ("拆模日期", "2026/08/30"), ("拆模時間條件", "符合最少時間"), ("再撐／回撐", "已保留"), ("拆模後外觀及缺失", "無明顯缺失")], cols=3)]
    document(OUT / "template-example.pdf", story)


def rebar_pdf():
    common = [("工程名稱", "Example Construction Project"), ("施工廠商", "○○營造股份有限公司"), ("施工日期", "2026/08/28"), ("檢查日期", "2026/08/28"), ("填表人", "Site Engineer"), ("檢查樓層／區域", "3F／A～C軸"), ("施工圖／版次", "S-203 Rev.2"), ("查驗階段", "綁紮完成")]
    rheader = lambda title, code, identity: header(title, code, identity, project="Example Construction Project", contractor="○○營造股份有限公司", date="2026/08/28", reviewer="Site Engineer")
    member_matrix = [["1", "柱", "C1-03", "A-1／B-C", "SD420", "60 × 80", "主筋 D25 × 12支<br/>箍筋 D13 @10cm", "4.0", "合格", "四面配置"], ["2", "柱", "C1-04", "A-2／B-C", "SD420", "60 × 80", "主筋 D25 × 12支<br/>箍筋 D13 @10cm", "4.0", "合格", ""], ["3", "梁", "G3-12", "B-2／3F", "SD420", "30 × 60", "上 D25 × 3支／下 D25 × 4支<br/>箍筋 D13 @10cm", "4.0", "合格", "梁底主筋已固定"], ["4", "板", "S3-02", "B～C／3F", "SD420", "厚 18", "短向 D13 @15cm<br/>長向 D13 @20cm", "2.0", "合格", "開口補強完成"]]
    story = [rheader("鋼筋工程查驗表", "RC REBAR / FIELD REVIEW / 01–02", "3F｜柱 C1-03"), section("01｜工程概要"), meta_grid(common), Spacer(1, 3*mm), section("02｜配筋明細"), data_table(["項次", "類型", "構件編號", "軸線／位置", "強度", "尺寸(cm)", "配筋明細", "保護層(cm)", "結果", "備註"], member_matrix, [8*mm, 12*mm, 20*mm, 24*mm, 15*mm, 19*mm, 48*mm, 19*mm, 14*mm, 27*mm], small=True), PageBreak()]
    material_rows = [[str(i), label, standard, actual, "合格"] for i, (label, standard, actual) in enumerate([("無輻射證明", "應有無輻射污染證明文件", "RAD-2026-0811"), ("材料證明與爐號", "材質、強度、號數及爐號可追溯", "MTC-0811-03"), ("物理性檢驗", "抗拉、降伏及伸長率符合標準", "TEST-0811-03"), ("化學性檢驗", "化學成分符合標準", "TEST-0811-C"), ("進場堆置與防鏽", "分類堆置、離地墊高", "已確認"), ("機械式續接器文件", "型錄、試驗報告及施工方式已確認", "不適用"), ("配筋圖與現場版本", "圖號、版次及變更已核准", "S-203 Rev.2")])]
    story += [rheader("材料與施工前查驗", "RC REBAR / FIELD REVIEW / 03", "3F｜柱 C1-03"), section("03｜材料與施工前"), data_table(["項次", "檢查項目", "判定標準", "紀錄／實測", "結果"], material_rows, [10*mm, 35*mm, 59*mm, 48*mm, 24*mm], small=True), PageBreak()]
    placement = [[str(i), "柱 C1-03", label, standard, actual, "合格"] for i, (label, standard, actual) in enumerate([("主筋強度／號數／支數", "符合配筋圖", "D25 × 12 支"), ("X／Y 向配置", "長短向排列符合圖說", "已確認"), ("水平淨間距 ch", "符合最小淨間距", "4.5 cm"), ("垂直淨間距 cv", "控制於 2.5～4 cm", "3.0 cm"), ("箍筋號數／間距／彎鉤", "D13、間距及 135° 彎鉤符合", "D13@10"), ("腰筋配置", "號數、數量及位置符合", "不適用"), ("間隔器與保護層", "足以維持設計保護層", "4.2 cm")])]
    story += [rheader("鋼筋配置查驗", "RC REBAR / FIELD REVIEW / 04", "3F｜柱 C1-03"), section("04｜鋼筋配置"), data_table(["項次", "構件", "檢查項目", "判定標準", "紀錄／實測", "結果"], placement, [10*mm, 24*mm, 35*mm, 52*mm, 35*mm, 20*mm], small=True), PageBreak()]
    detail = [[str(i), "柱 C1-03", label, standard, actual, "合格"] for i, (label, standard, actual) in enumerate([("主筋搭接與接頭位置", "位置及長度符合圖說", "已確認"), ("主筋伸展與錨定", "梁柱接頭及柱腳錨定完成", "已確認"), ("保護層實測", "柱側保護層符合圖說", "4.2 cm"), ("續接器扭力／試驗", "紀錄已確認；未使用選不適用", "不適用")])]
    story += [rheader("接頭／保護層查驗", "RC REBAR / FIELD REVIEW / 05", "3F｜柱 C1-03"), section("05｜接頭／保護層"), data_table(["項次", "構件", "檢查項目", "判定標準", "紀錄／實測", "結果"], detail, [10*mm, 24*mm, 38*mm, 51*mm, 33*mm, 20*mm], small=True), PageBreak()]
    release = [[str(i), label, standard, "已確認", "合格"] for i, (label, standard) in enumerate([("配筋圖與現場版本一致", "圖號、版次及變更紀錄已確認"), ("材料文件已完成", "材質、爐號、試驗及無輻射證明已備妥"), ("主筋與箍筋配置完成", "號數、數量、間距、方向及位置已複核"), ("搭接／錨定／續接完成", "接頭位置、長度及彎鉤已確認"), ("保護層與間隔器完成", "墊塊、間隔器及馬椅筋已確認"), ("開口、套管與補強完成", "結構及機電介面不衝突"), ("澆置面清潔完成", "無木屑、泥砂及積水"), ("廠商自主檢查完成", "自主檢查與缺失改善紀錄已提出")])]
    story += [rheader("鋼筋澆置前放行", "RC REBAR / FIELD REVIEW / 06", "3F｜柱 C1-03"), section("06｜澆置前放行"), data_table(["項次", "檢查項目", "判定標準", "紀錄／說明", "結果"], release, [10*mm, 40*mm, 60*mm, 42*mm, 24*mm], small=True), Spacer(1, 4*mm), section("放行判定"), meta_grid([("澆置判定", "可澆置"), ("備註", "鋼筋、接頭、保護層及介面已完成複核。"), ("複核日期", "2026/08/28")], cols=3)]
    document(OUT / "rebar-example.pdf", story)


def steel_pdf():
    base = [("工程名稱", "Example Construction Project"), ("施工廠商", "○○營造股份有限公司"), ("施工日期", "2026/08/28"), ("填表人", "Site Engineer")]
    story = [header("鋼構施工複核表", "STEEL STRUCTURE / FIELD REVIEW / 01", "3F｜柱 C1-03"), section("工程概要"), meta_grid(base, cols=4), Spacer(1, 3*mm), section("營造廠複核範圍"), note("確認設計、進場、安裝、關鍵檢測證據與放行條件；逐支螺栓及逐道銲接製程紀錄由專業廠商保存，本表記錄文件及抽查結果。"), PageBreak()]
    story += [header("構件進場確認", "STEEL STRUCTURE / FIELD REVIEW / 02", "進場批次 ST-2026-0811"), section("構件清單"), meta_grid([("進場日期", "2026/08/28"), ("進場批次／文件", "ST-2026-0811"), ("複核人", "Site Engineer"), ("工程名稱", "Example Construction Project")], cols=4), Spacer(1, 2*mm), data_table(["項次", "類型", "構件編號", "規格／材質", "數量", "材料文件", "外觀／堆置", "結果"], [["1", "鋼柱", "C1-03", "BOX-600×600×25／SN490", "1", "MTC-0811-03", "符合／符合", "符合"], ["2", "鋼梁", "G3-12", "H-600×300×12×20／SN490", "1", "MTC-0811-12", "符合／符合", "符合"]], [9*mm, 15*mm, 22*mm, 38*mm, 14*mm, 29*mm, 30*mm, 19*mm], small=True), PageBreak()]
    rows = [[str(i), label, standard, actual, "符合"] for i,(label,standard,actual) in enumerate([("螺栓規格、數量與位置", "與施工圖及材料資料一致", "M24／4支"), ("螺栓定位與偏心", "偏移在容許值內", "3 mm"), ("螺栓露出與螺紋保護", "露出高度及完整螺紋符合", "已確認"), ("鋼筋干涉與固定方式", "未錯誤焊接或切斷鋼筋", "已確認"), ("柱腳底板與標高", "位置、標高及接觸面符合", "12.000／12.004 m"), ("無收縮灌漿與完成狀況", "材料、施工及養護紀錄齊全", "GR-0811")])]
    story += [header("基礎螺栓／柱腳複核", "STEEL STRUCTURE / FIELD REVIEW / 03", "C1／X3-Y5"), section("柱腳基本資料"), meta_grid([("柱腳／軸線", "C1／X3-Y5"), ("螺栓規格", "M24"), ("設計／實際數量", "4／4 支"), ("柱腳標高設計／實測", "12.000／12.004 m"), ("偏心實測", "3 mm"), ("複核人", "Site Engineer")], cols=3), Spacer(1, 2*mm), section("關鍵複核項目"), data_table(["項次", "檢查項目", "判定標準", "現場紀錄／文件編號", "結果"], rows, [10*mm, 38*mm, 56*mm, 48*mm, 24*mm], small=True), PageBreak()]
    for title, code, ident, checks in [
        ("吊裝／臨時固定複核", "04", "A區／3F", [("吊裝計畫與施工順序", "計畫已核准並向人員說明", "計畫 ERE-08"), ("吊點、吊具與作業區", "吊點、吊具及隔離符合計畫", "2吊點／已隔離"), ("臨時螺栓與固定", "支撐、繫桿及防傾倒措施完成", "已完成"), ("構件穩定與垂直調整", "調整與量測結果可追溯", "已確認"), ("風雨及颱風應變", "依計畫停止、遮蔽或加固", "風速 0.8 m/s"), ("吊裝完成放行", "未固定構件已清點", "可放行")]),
        ("高強度螺栓複核", "05", "G3-12／J01", [("螺栓等級、尺寸與數量", "符合設計圖說及材料證明", "F10T M20／12支"), ("接合面與墊片", "平整、清潔，墊片安裝正確", "已確認"), ("螺栓孔狀況", "無油漆、泥砂、毛邊及變形", "已確認"), ("初擰及終擰順序", "依計畫由中心向外、交錯完成", "HSB-0811"), ("工具校驗與抽查", "工具校驗有效；抽查結果符合", "TORQUE-2026-0810"), ("終擰外觀與缺失閉合", "補擰或換栓已複驗", "抽查3支／符合")]),
        ("現場銲接複核", "06", "C1-G3 W05", [("銲工資格與施工程序", "資格有效，WPS 已核准", "WELD-3021／WPS-S-02"), ("接頭組立與根隙", "坡口、根隙及組立尺寸符合", "已確認"), ("銲接面清潔", "無水分、油污、銹蝕及雜物", "已確認"), ("銲接環境與防護", "雨天、高濕度或強風時有防護", "風速 0.8 m/s"), ("外觀檢查（VT）", "外觀、尺寸及缺陷符合要求", "VT-2026-0811"), ("非破壞檢測與修補", "UT 完成；缺失修補已複驗", "UT-2026-0811／無修補")]),
        ("安裝精度複核", "07", "3F／C1-03", [("鋼柱垂直度", "依核定標準量測", "設計0／實測3 mm"), ("柱軸線與相鄰柱偏移", "符合核定容許值", "2 mm"), ("柱頂標高", "調整後重新量測", "+12.004 m"), ("梁水平度與樓層標高", "符合設計要求", "4 mm"), ("累積偏差", "各樓層累積偏移已納入", "已確認"), ("整體垂直度／放行", "量測結果符合標準", "可放行")]),
    ]:
        story += [header(title, f"STEEL STRUCTURE / FIELD REVIEW / {code}", ident), section("關鍵複核項目"), data_table(["項次", "檢查項目", "判定標準", "現場紀錄／文件編號", "結果"], [[str(i), a, b, c, "符合"] for i,(a,b,c) in enumerate(checks)], [10*mm, 38*mm, 57*mm, 47*mm, 24*mm], small=True), PageBreak()]
    document(OUT / "steel-structure-example.pdf", story[:-1])


if __name__ == "__main__":
    template_pdf()
    rebar_pdf()
    steel_pdf()
    print("Generated", ", ".join(str(p) for p in sorted(OUT.glob("*-example.pdf"))))
