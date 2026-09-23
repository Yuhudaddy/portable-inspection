// 連續壁施工計畫的流程圖（Mermaid 原始碼），品管版與完整版共用。計畫內容用 { type: "mermaid", flowchart: "<key>" } 引用，
// plan.js 進到有流程圖的計畫才載入 vendor/mermaid-*.min.js 把這裡的原始碼畫成 SVG。
// 排法：每一段由左往右，段與段往下接。整條排成一列在 A4 寬度會把字縮到看不清楚，所以分段。
window.PLAN_FLOWCHARTS = window.PLAN_FLOWCHARTS || {};

PLAN_FLOWCHARTS.guideWall = `flowchart TB
  subgraph G1["一、開挖與導溝牆"]
    direction LR
    g1["現地放樣<br>拉線標示"] --> g2["開挖至<br>設計深度"] --> g3["導溝牆<br>鋼筋綁紮"] --> g4["模板組立<br>水平支撐"] --> g5["導溝牆<br>混凝土澆置"]
  end
  subgraph G2["二、回撐與完成"]
    direction LR
    g6["拆模<br>設回撐木"] --> g7["回填壓實<br>舖面施作"] --> g8["頂部基準<br>高程實測"] --> g9["鋪設踏板<br>或蓋板"] --> g10(["導溝施工<br>複核"])
  end
  G1 --> G2`;

PLAN_FLOWCHARTS.diaphragmWall = `flowchart TB
  start(["假設工程完成<br>機具進場、組裝試車"])
  subgraph A["一、單元成槽"]
    direction LR
    a1["單元<br>放樣"] --> a2["壁體<br>開挖"] --> a3["接頭清洗<br>超音波檢測"] --> a4{"沉泥<br>確認"}
    a4 -- 不合格 --> a5["沉泥<br>抽取"] --> a4
  end
  subgraph B["二、吊放與澆置"]
    direction LR
    b1["鋼筋籠<br>製作"] --> b2["鋼筋籠<br>檢查"] --> b3["鋼筋籠<br>吊放"] --> b4["特密管<br>吊放"] --> b5["混凝土<br>澆置"] --> b6(["單元完成<br>場地清理"])
  end
  subgraph C["三、穩定液循環（同步進行）"]
    direction LR
    c1["穩定液<br>製造"] --> c2["補注槽溝<br>（開挖中）"] --> c3["穩定液回收<br>（澆置中）"] --> c4{"穩定液<br>檢測"}
    c4 -- 合格再用 --> c1
    c4 -- 劣化 --> c5["汙水<br>處理"]
  end
  start --> A
  A -- 沉泥合格 --> B
  B ~~~ C`;
