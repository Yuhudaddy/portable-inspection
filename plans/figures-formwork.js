// 模板工程施工計畫的示意圖（在 plan.js 之前載入）。全部是程式畫的單色線稿，A4 直印清楚。
// tol* 為許可差表格內的小圖（配合 figureTable 區塊，每列一張）；其餘為正文用的整寬圖。
//   tolPlumb / tolCorner / tolPosition / tolOpening / tolLevel / tolSection / tolStair / tolSurface
//   shoringSystem 支撐系統構成與法規尺寸；loadPath 模板傳力四階段與間距控制；lateralPressure 混凝土側壓分布
window.PLAN_FIGURES = window.PLAN_FIGURES || {};

(function () {
  const INK = "#333";
  const SOFT = "#777";
  const FILL = "#e2e2e2";
  const ACCENT = "#c04a1e";           // 外露稜線、量測對象
  const text = (x, y, content, options = {}) => {
    const { size = 9, anchor = "start", weight = "normal", fill = INK, rotate = null } = options;
    const transform = rotate === null ? "" : ` transform="rotate(${rotate} ${x} ${y})"`;
    return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" fill="${fill}"${transform}>${content}</text>`;
  };
  const line = (x1, y1, x2, y2, options = {}) => {
    const { width = 1, dash = null, color = INK, marker = null, markerStart = null } = options;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}${marker ? ` marker-end="url(#${marker})"` : ""}${markerStart ? ` marker-start="url(#${markerStart})"` : ""} />`;
  };
  const rect = (x, y, w, h, options = {}) => {
    const { fill = "none", stroke = INK, width = 1, dash = null } = options;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""} />`;
  };
  const poly = (points, options = {}) => {
    const { width = 1.2, dash = null, color = INK, fill = "none", close = false } = options;
    const tag = close ? "polygon" : "polyline";
    return `<${tag} points="${points.map(([x, y]) => `${x},${y}`).join(" ")}" fill="${fill}" stroke="${color}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""} />`;
  };
  // 雙向箭頭的尺寸線（標 e、ΔH 用）
  const dim = (x1, y1, x2, y2, label, options = {}) => {
    const { size = 8, dx = 0, dy = -3, anchor = "middle", color = INK } = options;
    return line(x1, y1, x2, y2, { width: 0.9, color, marker: "fw-tick", markerStart: "fw-tick" })
      + text((x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, label, { size, anchor, fill: color });
  };
  const defs = `<defs>
    <marker id="fw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}" /></marker>
    <marker id="fw-tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2,1 L8,9" stroke="${INK}" stroke-width="1.6" /></marker>
    <pattern id="fw-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#999" stroke-width="0.8" /></pattern>
  </defs>`;
  const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg" font-family="inherit">${defs}${body}</svg>`;
  // 許可差小圖統一尺寸
  const thumb = (body, label) => svg(178, 116, body, label);
  const ground = (x1, x2, y) => line(x1, y, x2, y, { width: 1.2 }) + Array.from({ length: Math.floor((x2 - x1) / 9) }, (_, i) => line(x1 + i * 9, y, x1 + i * 9 + 5, y + 5, { width: 0.7, color: SOFT })).join("");

  // ---- 許可差：錘線偏離 ----------------------------------------------------------
  window.PLAN_FIGURES.tolPlumb = () => {
    const base = 92, top = 20, cx = 78;
    const parts = [];
    parts.push(ground(30, 150, base));
    parts.push(text(30, base + 12, "基礎頂面（H 起算點）", { size: 7, fill: SOFT }));
    parts.push(line(cx, base, cx, top, { dash: "3 2", color: SOFT }));
    parts.push(poly([[cx - 13, base], [cx - 10, 62], [cx - 16, 40], [cx - 12, top]], { width: 1.3 }));
    parts.push(poly([[cx + 13, base], [cx + 16, 62], [cx + 10, 40], [cx + 14, top]], { width: 1.3 }));
    parts.push(line(cx - 16, 62, cx + 16, 62, { width: 0.8, color: SOFT }));
    parts.push(line(cx - 16, 40, cx + 16, 40, { width: 0.8, color: SOFT }));
    parts.push(line(cx + 14, top, cx + 16, 62, { width: 2.2, color: ACCENT }));
    parts.push(dim(cx, top - 6, cx + 14, top - 6, "e", { dy: -2 }));
    parts.push(dim(22, base, 22, top, "H", { dx: -3, dy: 3, anchor: "end" }));
    parts.push(text(10, 112, "粗線＝外露角柱外稜線，許可差從嚴", { size: 7.5, fill: ACCENT }));
    return thumb(parts.join(""), "錘線偏離量測示意");
  };

  // ---- 許可差：外露角柱之外稜線 ----------------------------------------------------
  window.PLAN_FIGURES.tolCorner = () => {
    const parts = [];
    parts.push(text(10, 16, "平面", { size: 7.5, fill: SOFT }));
    parts.push(rect(34, 34, 26, 26));
    parts.push(text(47, 50, "內柱", { size: 7.5, anchor: "middle" }));
    parts.push(line(10, 40, 34, 40, { width: 0.9 }));
    parts.push(line(10, 54, 34, 54, { width: 0.9 }));
    parts.push(line(60, 40, 116, 40, { width: 0.9 }));
    parts.push(line(60, 54, 116, 54, { width: 0.9 }));
    parts.push(text(88, 32, "外周梁", { size: 7, anchor: "middle", fill: SOFT }));
    parts.push(rect(116, 34, 26, 26));
    parts.push(text(129, 50, "角柱", { size: 7.5, anchor: "middle" }));
    parts.push(poly([[116, 34], [142, 34], [142, 60]], { width: 2.6, color: ACCENT }));
    parts.push(text(10, 84, "粗線＝外露角柱之外稜線", { size: 7.5, fill: ACCENT }));
    parts.push(text(10, 100, "建物外側可見的兩個柱面交線", { size: 7.5, fill: SOFT }));
    return thumb(parts.join(""), "外露角柱外稜線示意");
  };

  // ---- 許可差：構件位置偏離 --------------------------------------------------------
  window.PLAN_FIGURES.tolPosition = () => {
    const parts = [];
    parts.push(text(10, 16, "平面", { size: 7.5, fill: SOFT }));
    parts.push(rect(56, 32, 46, 46, { dash: "3 2", stroke: SOFT }));
    parts.push(poly([[60, 28], [106, 34], [100, 80], [54, 74]], { close: true, width: 1.4 }));
    parts.push(text(80, 58, "柱", { size: 9, anchor: "middle" }));
    parts.push(line(102, 78, 102, 92, { width: 0.7, color: SOFT, dash: "2 2" }));
    parts.push(line(106, 34, 106, 92, { width: 0.7, color: SOFT, dash: "2 2" }));
    parts.push(dim(102, 88, 106, 88, "e", { dy: -3 }));
    parts.push(text(10, 108, "虛線＝設計位置，實線＝實際", { size: 7.5, fill: SOFT }));
    return thumb(parts.join(""), "構件位置偏離示意");
  };

  // ---- 許可差：版開口位置 ---------------------------------------------------------
  window.PLAN_FIGURES.tolOpening = () => {
    const parts = [];
    parts.push(text(10, 14, "版平面", { size: 7.5, fill: SOFT }));
    // 小開口：量中心線
    parts.push(rect(26, 40, 26, 26, { dash: "3 2", stroke: SOFT }));
    parts.push(rect(30, 44, 26, 26, { width: 1.3 }));
    parts.push(line(39, 34, 39, 74, { width: 0.7, dash: "5 2 1 2", color: SOFT }));
    parts.push(line(43, 34, 43, 74, { width: 0.7, dash: "5 2 1 2", color: SOFT }));
    parts.push(dim(39, 80, 43, 80, "e", { dy: 9 }));
    parts.push(text(41, 96, "≤30 cm：量中心線", { size: 7.5, anchor: "middle" }));
    // 大開口：量邊線
    parts.push(rect(100, 36, 44, 34, { dash: "3 2", stroke: SOFT }));
    parts.push(rect(105, 40, 44, 34, { width: 1.3 }));
    parts.push(dim(100, 80, 105, 80, "e", { dy: 9 }));
    parts.push(line(100, 70, 100, 82, { width: 0.7, color: SOFT, dash: "2 2" }));
    parts.push(line(105, 74, 105, 82, { width: 0.7, color: SOFT, dash: "2 2" }));
    parts.push(text(124, 96, ">30 cm：量邊線", { size: 7.5, anchor: "middle" }));
    return thumb(parts.join(""), "版開口位置偏離示意");
  };

  // ---- 許可差：高程差 -------------------------------------------------------------
  window.PLAN_FIGURES.tolLevel = () => {
    const parts = [];
    parts.push(rect(16, 24, 122, 8, { fill: FILL }));
    parts.push(text(18, 21, "版頂面", { size: 7.5 }));
    parts.push(rect(52, 32, 40, 16, { fill: "url(#fw-hatch)" }));
    parts.push(text(72, 43, "梁", { size: 7.5, anchor: "middle" }));
    parts.push(line(16, 48, 138, 48, { width: 0.8, dash: "4 2", color: SOFT }));
    parts.push(text(96, 57, "梁底模鑄面", { size: 7.5, fill: SOFT }));
    parts.push(rect(20, 64, 34, 22));
    parts.push(text(37, 78, "窗", { size: 7.5, anchor: "middle" }));
    parts.push(line(20, 64, 138, 64, { width: 0.7, dash: "4 2", color: SOFT }));
    parts.push(text(60, 73, "窗台水平線", { size: 7.5, fill: SOFT }));
    parts.push(dim(150, 24, 150, 48, "ΔH", { dx: -4, dy: 3, anchor: "end" }));
    parts.push(text(10, 104, "同層各模鑄面與可見水平線的高程差", { size: 7.5, fill: SOFT }));
    return thumb(parts.join(""), "高程差量測示意");
  };

  // ---- 許可差：斷面尺寸 -----------------------------------------------------------
  window.PLAN_FIGURES.tolSection = () => {
    const parts = [];
    parts.push(text(10, 16, "斷面", { size: 7.5, fill: SOFT }));
    parts.push(rect(58, 34, 52, 46, { dash: "3 2", stroke: SOFT }));
    parts.push(rect(54, 30, 60, 54, { width: 1.4 }));
    parts.push(dim(58, 26, 110, 26, "設計尺寸 x", { dy: -3 }));
    parts.push(line(126, 44, 114, 44, { width: 1, marker: "fw-arrow" }));
    parts.push(text(130, 47, "＋", { size: 8.5 }));
    parts.push(line(126, 70, 110, 70, { width: 1, marker: "fw-arrow" }));
    parts.push(text(130, 73, "−", { size: 8.5 }));
    parts.push(text(10, 104, "實線超出設計＝正偏差，內縮＝負偏差", { size: 7.5, fill: SOFT }));
    return thumb(parts.join(""), "斷面尺寸偏差示意");
  };

  // ---- 許可差：階梯相對偏差 --------------------------------------------------------
  window.PLAN_FIGURES.tolStair = () => {
    const parts = [];
    const steps = [[24, 30], [54, 46], [84, 62], [114, 78]];
    const path = [];
    steps.forEach(([x, y]) => { path.push([x, y], [x + 30, y], [x + 30, y + 16]); });
    parts.push(poly(path, { width: 1.4 }));
    parts.push(line(24, 24, 150, 90, { width: 0.8, dash: "4 2", color: SOFT }));
    parts.push(dim(50, 30, 50, 46, "H", { dx: -3, dy: 4, anchor: "end" }));
    parts.push(dim(54, 56, 84, 56, "D", { dy: -3 }));
    parts.push(text(10, 106, "相鄰級高 Hₙ₊₁−Hₙ、相鄰級深 Dₙ₊₁−Dₙ", { size: 7.5, fill: SOFT }));
    return thumb(parts.join(""), "階梯相對偏差示意");
  };

  // ---- 許可差：模鑄面平整與相鄰襯板突出 -----------------------------------------------
  window.PLAN_FIGURES.tolSurface = () => {
    const parts = [];
    parts.push(line(20, 40, 128, 40, { width: 1.8, color: ACCENT }));
    parts.push(text(74, 33, "3 m 直規", { size: 7.5, anchor: "middle", fill: ACCENT }));
    parts.push(poly([[20, 48], [50, 44], [78, 54], [104, 46], [128, 50]], { width: 1.4 }));
    parts.push(dim(78, 40, 78, 54, "e", { dx: 4, dy: 4, anchor: "start" }));
    parts.push(text(10, 76, "相鄰模面襯板突出", { size: 7.5, fill: SOFT }));
    parts.push(line(20, 92, 84, 92, { width: 1.4 }));
    parts.push(line(84, 87, 148, 87, { width: 1.4 }));
    parts.push(dim(90, 87, 90, 92, "e", { dx: 4, dy: 3, anchor: "start" }));
    return thumb(parts.join(""), "模鑄面平整與相鄰襯板突出示意");
  };

  // ---- 支撐系統構成與法規尺寸 --------------------------------------------------------
  window.PLAN_FIGURES.shoringSystem = () => {
    const W = 640, H = 306;
    const parts = [];
    const slabY = 42, floorY = 232;
    parts.push(text(146, 22, "可調鋼管支柱", { size: 11, anchor: "middle", weight: "bold" }));
    parts.push(rect(40, slabY, 210, 10, { fill: FILL }));
    parts.push(text(42, slabY - 5, "版底模", { size: 8.5, fill: SOFT }));
    parts.push(ground(30, 260, floorY));
    parts.push(text(32, floorY + 15, "已達強度之樓版或堅實地面", { size: 8, fill: SOFT }));
    [80, 146, 212].forEach(x => {
      parts.push(rect(x - 17, floorY - 6, 34, 6, { fill: FILL }));
      parts.push(rect(x - 9, floorY - 10, 18, 4));
      parts.push(rect(x - 4, slabY + 10, 8, floorY - slabY - 20));
      parts.push(rect(x - 9, slabY + 10, 18, 4));
      parts.push(`<circle cx="${x}" cy="148" r="3.5" fill="#fff" stroke="${INK}" stroke-width="1.1" />`);
    });
    [104, 174].forEach(y => parts.push(line(62, y, 250, y, { width: 1.6, color: ACCENT })));
    parts.push(text(256, 107, "端部固定於柱模等穩定構造物", { size: 8, fill: ACCENT }));
    parts.push(dim(52, 104, 52, 174, "≤2 m", { dx: -3, dy: 3, anchor: "end" }));
    parts.push(dim(22, slabY + 10, 22, floorY - 10, "H", { dx: -3, dy: 3, anchor: "end" }));
    parts.push(text(62, 202, "○＝調整高度用的制式插銷", { size: 8, fill: SOFT }));
    parts.push(text(30, 268, "H>3.5 m 時，高度每 2 m 內設縱向、橫向水平繫條", { size: 8.5 }));
    parts.push(text(30, 284, "支柱不得連接使用；調整高度以制式金屬配件，不得用鋼筋替代", { size: 8.5 }));
    parts.push(text(466, 22, "框式施工架（排架）", { size: 11, anchor: "middle", weight: "bold" }));
    parts.push(rect(340, slabY, 250, 10, { fill: FILL }));
    parts.push(ground(330, 600, floorY));
    [390, 466, 542].forEach(x => {
      parts.push(rect(x - 30, slabY + 10, 60, floorY - slabY - 20, { width: 1.2 }));
      parts.push(line(x - 30, slabY + 10, x + 30, floorY - 10, { width: 0.9, dash: "5 3" }));
      parts.push(line(x + 30, slabY + 10, x - 30, floorY - 10, { width: 0.9, dash: "5 3" }));
      parts.push(rect(x - 9, slabY + 6, 18, 4, { fill: FILL }));
      parts.push(rect(x - 12, floorY - 8, 24, 6, { fill: FILL }));
    });
    parts.push(line(340, 140, 590, 140, { width: 1.6, color: ACCENT }));
    parts.push(text(598, 143, "水平繫條", { size: 8, fill: ACCENT }));
    parts.push(text(598, 64, "鋼製頂板", { size: 8, fill: SOFT }));
    parts.push(text(576, 248, "可調型基腳座鈑", { size: 8, anchor: "end", fill: SOFT }));
    parts.push(text(340, 268, "交叉斜撐材、水平繫條、橫架、鋼製頂板齊備", { size: 8.5 }));
    parts.push(text(340, 284, "底部以可調型基腳座鈑調整在同一水平面", { size: 8.5 }));
    return svg(W, H, parts.join(""), "模板支撐系統構成示意圖");
  };

  // ---- 模板傳力四階段與間距控制 ------------------------------------------------------
  window.PLAN_FIGURES.loadPath = () => {
    const W = 640, H = 300;
    const parts = [];
    const L = 108, R = 300;
    const label = (y, n, name) => text(12, y, `${n} ${name}`, { size: 9.5, weight: "bold" });
    [40, 140, 240, 340].forEach(x => parts.push(line(L + (x - 40) * 0.42 + 20, 12, L + (x - 40) * 0.42 + 20, 30, { width: 1.1, marker: "fw-arrow" })));
    parts.push(text(316, 20, "垂直載重", { size: 9, fill: SOFT }));
    // ① 襯板
    parts.push(label(44, "①", "襯板"));
    parts.push(rect(L, 34, R - L, 9, { fill: FILL }));
    // ② 格柵（縱）
    parts.push(label(66, "②", "格柵（縱）"));
    [0, 32, 64, 96, 128, 160, 192].forEach(d => parts.push(rect(L + d - 4, 43, 9, 13)));
    parts.push(dim(L, 66, L + 32, 66, "S₁", { dy: -3 }));
    // ③ 格柵墊條（橫）
    parts.push(label(96, "③", "格柵墊條（橫）"));
    parts.push(rect(L - 6, 74, R - L + 12, 12, { fill: "#fff" }));
    parts.push(dim(L + 8, 100, L + 104, 100, "S₂", { dy: -3 }));
    // ④ 支柱
    parts.push(label(140, "④", "支柱／繫條"));
    [8, 104, 192].forEach(d => { parts.push(rect(L + d - 4, 86, 9, 92)); parts.push(rect(L + d - 10, 86, 21, 4)); });
    parts.push(ground(L - 14, R + 12, 178));
    parts.push(dim(L + 8, 192, L + 104, 192, "S₃", { dy: -3 }));
    // 右側說明框
    parts.push(rect(330, 40, 296, 118, { stroke: SOFT }));
    parts.push(text(344, 60, "每一階段的容許間距同時受三項控制", { size: 9.5, weight: "bold" }));
    [["彎曲應力", "≤ 容許彎曲應力"], ["撓度", "≤ 容許撓度，且 ≤ 支撐間距 1/240"], ["剪應力", "≤ 容許剪應力"]].forEach(([k, v], i) => {
      const y = 82 + i * 19;
      parts.push(text(350, y, k, { size: 9 }));
      parts.push(text(416, y, v, { size: 9, fill: SOFT }));
    });
    parts.push(text(344, 146, "三者取最小值，再往下一階段傳遞", { size: 9.5, weight: "bold" }));
    parts.push(text(20, 224, "支柱另須檢核抗壓（繫條為抗拉）強度；經多次使用的模板與支撐材，承載能力衰減須計入。", { size: 9 }));
    parts.push(text(20, 246, "現場不得自行放寬任一階段的間距：放寬 S₁ 會同時改變 S₂、S₃ 的受力，等於整組失效。", { size: 9 }));
    parts.push(text(20, 268, "柱、牆模的傳力鏈相同，只是第 ④ 階段由支柱改為對拉繫條（螺桿），承受混凝土側壓力。", { size: 9 }));
    parts.push(text(20, 290, "各階段材料的彈性模數與容許應力依相關規範；系統模板有試驗證明者得依製造廠商說明。", { size: 9 }));
    return svg(W, H, parts.join(""), "模板傳力四階段與間距控制示意圖");
  };

  // ---- 混凝土側壓力分布 -------------------------------------------------------------
  window.PLAN_FIGURES.lateralPressure = () => {
    const W = 640, H = 286;
    const parts = [];
    const top = 40, bot = 214, wallX = 132, pmX = 250, pmY = 132;
    parts.push(rect(wallX - 26, top, 26, bot - top, { fill: "url(#fw-hatch)" }));
    parts.push(line(wallX, top, wallX, bot, { width: 1.6 }));
    parts.push(line(wallX - 26, top, wallX - 26, bot, { width: 1.6 }));
    parts.push(text(wallX - 13, top - 8, "牆模", { size: 9, anchor: "middle" }));
    parts.push(ground(76, 296, bot));
    parts.push(poly([[wallX, top], [pmX, pmY], [pmX, bot], [wallX, bot]], { close: true, width: 1.5, fill: "rgba(0,0,0,0.05)" }));
    parts.push(line(wallX, top, 296, bot + 6, { width: 1, dash: "4 3", color: SOFT }));
    parts.push(text(300, 222, "未截斷時的流體靜壓 p = w·h", { size: 8.5, fill: SOFT }));
    parts.push(text(pmX - 6, pmY - 8, "Pm 最大側壓", { size: 9, anchor: "end", weight: "bold" }));
    parts.push(dim(58, top, 58, bot, "h", { dx: -3, dy: 3, anchor: "end" }));
    parts.push(text(wallX + 6, bot + 15, "側壓力", { size: 8.5, fill: SOFT }));
    parts.push(rect(330, 40, 296, 130, { stroke: SOFT }));
    parts.push(text(344, 60, "側壓力隨下列條件改變", { size: 9.5, weight: "bold" }));
    [["澆置速度 R", "愈快愈大"], ["混凝土溫度 T", "愈低愈大"], ["單位重 w", "一般取 2.4 t/m³"], ["搗實方式與深度", "過度搗實使側壓上升"], ["澆置深度 h", "柱模取全高"]].forEach(([k, v], i) => {
      const y = 82 + i * 18;
      parts.push(text(350, y, k, { size: 9 }));
      parts.push(text(462, y, v, { size: 9, fill: SOFT }));
    });
    parts.push(text(20, 246, "柱模以全高計算；牆模達 Pm 後不再隨深度增加。澆置速度與分層高度一旦超出計畫值，側壓即超過設計值，", { size: 9 }));
    parts.push(text(20, 268, "直接造成爆模、模板變形與漏漿，因此澆置分層與速度屬於模板設計的一部分，不得現場自行調整。", { size: 9 }));
    return svg(W, H, parts.join(""), "混凝土側壓力分布示意圖");
  };
})();
