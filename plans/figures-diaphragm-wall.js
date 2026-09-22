// 連續壁施工計畫共用的示意圖（01 營造廠、06 廠商兩份計畫都引用，在 plan.js 之前載入）。
// 全部是程式畫的單色線稿 SVG，A4 直印清楚；計畫內容用 { type: "figure", figure: "<名稱>", caption, note } 引用。
//   pourCurves    澆置曲線判讀：標準線與 A～E 五種異常型態
//   tremieTraps   包穩定液／包空氣的形成機制（特密管操作）
//   integrityTest 完整性檢測：PVC 管配置、跨孔量測方式、波速—深度圖
//   crossCheck    槽壁掃描圖、澆置曲線、開挖後壁面三紀錄交叉比對
window.PLAN_FIGURES = window.PLAN_FIGURES || {};

(function () {
  const INK = "#333";
  const SOFT = "#777";
  const FILL = "#d9d9d9";
  const text = (x, y, content, options = {}) => {
    const { size = 11, anchor = "start", weight = "normal", fill = INK, rotate = null } = options;
    const transform = rotate === null ? "" : ` transform="rotate(${rotate} ${x} ${y})"`;
    return `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}" fill="${fill}"${transform}>${content}</text>`;
  };
  const line = (x1, y1, x2, y2, options = {}) => {
    const { width = 1, dash = null, color = INK, marker = null } = options;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}${marker ? ` marker-end="url(#${marker})"` : ""} />`;
  };
  const poly = (points, options = {}) => {
    const { width = 1.4, dash = null, color = INK, fill = "none", marker = null } = options;
    return `<polyline points="${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")}" fill="${fill}" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ""}${marker ? ` marker-end="url(#${marker})"` : ""} />`;
  };
  const rect = (x, y, w, h, options = {}) => {
    const { fill = "none", stroke = INK, width = 1, dash = null, rx = 0 } = options;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""} />`;
  };
  const badge = (x, y, label, color = INK) => `<circle cx="${x}" cy="${y}" r="8" fill="#fff" stroke="${color}" stroke-width="1.4" />${text(x, y + 4, label, { size: 10, anchor: "middle", weight: "bold", fill: color })}`;
  // 五條異常曲線的顏色：固定順序、色盲可分（已跑 dataviz 驗證），線型與字母標記另作第二層辨識，黑白列印也分得開
  const SERIES = { A: "#2a78d6", B: "#c98500", C: "#d55181", D: "#008300", E: "#4a3aa7" };
  const defs = `<defs>
    <marker id="pf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}" /></marker>
    <pattern id="pf-slurry" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#9a9a9a" stroke-width="1" /></pattern>
    <pattern id="pf-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="5" stroke="${INK}" stroke-width="0.8" /></pattern>
  </defs>`;
  const svg = (w, h, body, label) => `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}" xmlns="http://www.w3.org/2000/svg" font-family="inherit">${defs}${body}</svg>`;

  // ---- 澆置曲線判讀 --------------------------------------------------------------
  // x＝累積混凝土量（設計量＝100%），y＝混凝土面深度；標準線由槽底到壁頂，五條異常曲線各自從分岔點畫起。
  window.PLAN_FIGURES.pourCurves = () => {
    const W = 640, H = 405, L = 64, T = 26, R = 610, B = 318;
    const X = v => L + v / 125 * (R - L);
    const Y = d => T + d / 35 * (B - T);
    const slope = 100 / 35; // 每公尺對應的設計用量（%）
    const parallelTo = (v, d) => [v + d * slope, 0];
    const parts = [];
    for (let v = 0; v <= 125; v += 25) {
      parts.push(line(X(v), T, X(v), B, { color: "#ddd", width: 0.8 }));
      parts.push(text(X(v), B + 14, `${v}`, { size: 10, anchor: "middle", fill: SOFT }));
    }
    for (let d = 0; d <= 35; d += 5) {
      parts.push(line(L, Y(d), R, Y(d), { color: "#ddd", width: 0.8 }));
      parts.push(text(L - 6, Y(d) + 3.5, d === 0 ? "GL 0" : `−${d}`, { size: 10, anchor: "end", fill: SOFT }));
    }
    parts.push(rect(L, T, R - L, B - T, { stroke: "#999", width: 1 }));
    parts.push(text((L + R) / 2, B + 30, "累積混凝土量（％設計量）", { size: 11, anchor: "middle" }));
    parts.push(text(16, (T + B) / 2, "混凝土面深度 GL（m）", { size: 11, anchor: "middle", rotate: -90 }));
    // 標準線
    parts.push(poly([[X(0), Y(35)], [X(100), Y(0)]], { width: 1.8 }));
    parts.push(text(X(100) + 4, Y(2) + 4, "標準線", { size: 10, weight: "bold" }));
    // A 漏漿：量增加、面不升，之後平行標準線
    const curve = (points, dash, tag, tagAt, note, noteAt) => {
      const color = SERIES[tag];
      parts.push(poly(points.map(([v, d]) => [X(v), Y(d)]), { width: 1.8, dash, color }));
      parts.push(badge(X(tagAt[0]), Y(tagAt[1]), tag, color));
      if (note) parts.push(text(X(noteAt[0]), Y(noteAt[1]), note, { size: 9.5, fill: SOFT }));
    };
    curve([[28.6, 25], [40, 25], parallelTo(40, 25)], "6 3", "A", [22, 25], "量增加、面不升", [41, 26.4]);
    curve([[28.6, 25], [50, 20], parallelTo(50, 20)], "2 3", "B", [50, 22.6], "斜率變小", [52, 20.4]);
    curve([[34.3, 23], [40, 18], parallelTo(40, 18)], "8 3 2 3", "C", [33, 18.5], "斜率變大", [24, 17.3]);
    curve([[71.4, 10], [90, 0]], "1 3", "D", [76, 5.2], "斜率變大到地表", [80, 7.6]);
    curve([[62.9, 13], [70, 18], parallelTo(70, 18)], "8 2 2 2 2 2", "E", [76, 16], "面突然下降", [72, 20]);
    // 圖例
    const legend = [["標準線：無瑕疵時各深度對應的估計累積用量", null, 1.8, INK], ["A 漏漿（母單元）", "6 3", 1.8, SERIES.A], ["B 坍孔", "2 3", 1.8, SERIES.B], ["C 包穩定液／包空氣", "8 3 2 3", 1.8, SERIES.C], ["D 槽壁內縮", "1 3", 1.8, SERIES.D], ["E 爆模、端鈑開裂或側移", "8 2 2 2 2 2", 1.8, SERIES.E]];
    legend.forEach(([label, dash, width, color], index) => {
      const col = index === 0 ? 0 : (index - 1) % 3;
      const row = index === 0 ? 0 : 1 + Math.floor((index - 1) / 3);
      const x = L + col * 182, y = B + 52 + row * 16;
      parts.push(line(x, y - 4, x + 26, y - 4, { width, dash, color }));
      parts.push(text(x + 32, y, label, { size: 10 }));
    });
    return svg(W, H, parts.join(""), "澆置曲線判讀示意圖");
  };

  // ---- 包穩定液／包空氣形成機制 ----------------------------------------------------
  window.PLAN_FIGURES.tremieTraps = () => {
    const W = 640, H = 350;
    const frame = (x, y, title, { pipeBottom, pipeInside = "concrete", concreteTop = 100, extra = "" }) => {
      const trenchX = x + 34, trenchW = 82, trenchTop = y + 38, trenchBottom = y + 150;
      const pipeX = x + 70, pipeW = 10;
      const parts = [];
      parts.push(text(x + 75, y + 14, title, { size: 9.5, anchor: "middle", weight: "bold" }));
      // 槽溝：上段穩定液（斜線）、下段混凝土（灰）
      parts.push(rect(trenchX, trenchTop, trenchW, y + concreteTop - trenchTop, { fill: "url(#pf-slurry)", stroke: "none" }));
      parts.push(rect(trenchX, y + concreteTop, trenchW, trenchBottom - (y + concreteTop), { fill: FILL, stroke: "none" }));
      parts.push(line(trenchX, trenchTop, trenchX, trenchBottom));
      parts.push(line(trenchX + trenchW, trenchTop, trenchX + trenchW, trenchBottom));
      parts.push(line(trenchX, trenchBottom, trenchX + trenchW, trenchBottom));
      parts.push(line(trenchX - 6, trenchTop, trenchX, trenchTop));
      parts.push(line(trenchX + trenchW, trenchTop, trenchX + trenchW + 6, trenchTop));
      // 特密管與漏斗
      parts.push(`<polygon points="${pipeX - 8},${y + 22} ${pipeX + pipeW + 8},${y + 22} ${pipeX + pipeW},${y + 32} ${pipeX},${y + 32}" fill="#fff" stroke="${INK}" />`);
      const insideFill = pipeInside === "concrete" ? FILL : pipeInside === "air" ? "#fff" : "url(#pf-slurry)";
      parts.push(rect(pipeX, y + 32, pipeW, pipeBottom - 32, { fill: insideFill, stroke: INK }));
      parts.push(extra);
      return parts.join("");
    };
    const label = (x, y, content, options = {}) => text(x, y, content, { size: 9, fill: SOFT, ...options });
    const arrow = (x1, y1, x2, y2) => line(x1, y1, x2, y2, { width: 1.2, marker: "pf-arrow" });
    const row1 = [
      frame(28, 0, "① 澆置中", { pipeBottom: 120, extra: label(52, 60, "穩定液") + label(52, 140, "混凝土") + label(136, 112, "管底埋入 ≥ 1.5 m", { size: 8 }) }),
      frame(188, 0, "② 提管過多", { pipeBottom: 86, extra: arrow(263, 100, 263, 62) + label(272, 74, "穩定液", { size: 8 }) + label(272, 84, "回流入管", { size: 8 }) }),
      frame(348, 0, "③ 再插入續澆", { pipeBottom: 120, pipeInside: "slurry", extra: label(432, 96, "管內仍是", { size: 8 }) + label(432, 106, "穩定液", { size: 8 }) }),
      frame(508, 0, "④ 包穩定液", { pipeBottom: 120, extra: `<ellipse cx="614" cy="126" rx="12" ry="8" fill="url(#pf-slurry)" stroke="${INK}" />` + label(583, 164, "管內穩定液被擠入混凝土", { size: 8, anchor: "middle" }) })
    ];
    const row2 = [
      frame(28, 175, "① 第一車澆置", { pipeBottom: 120 }),
      frame(188, 175, "② 中斷澆置", { pipeBottom: 120, pipeInside: "air", extra: label(272, 260, "管內混凝土", { size: 8 }) + label(272, 270, "流盡、進氣", { size: 8 }) }),
      frame(348, 175, "③ 第二車滿管續澆", { pipeBottom: 120, pipeInside: "air", extra: rect(418, 207, 10, 30, { fill: FILL, stroke: INK }) + arrow(423, 240, 423, 268) + label(432, 262, "空氣被壓下", { size: 8 }) }),
      frame(508, 175, "④ 包空氣", { pipeBottom: 120, extra: `<ellipse cx="614" cy="301" rx="11" ry="8" fill="#fff" stroke="${INK}" />` + label(583, 339, "混凝土內留下空洞", { size: 8, anchor: "middle" }) })
    ];
    const body = text(14, 95, "包穩定液", { size: 10, weight: "bold", anchor: "middle", rotate: -90 }) + text(14, 270, "包空氣", { size: 10, weight: "bold", anchor: "middle", rotate: -90 }) + row1.join("") + row2.join("");
    return svg(W, H, body, "包穩定液與包空氣形成機制示意圖");
  };

  // ---- 完整性檢測 ------------------------------------------------------------------
  window.PLAN_FIGURES.integrityTest = () => {
    const W = 640, H = 300;
    const parts = [];
    // 平面：母單元鋼筋籠內 PVC 管交互配置
    parts.push(text(12, 16, "平面：PVC 管交互配置（籠內預綁）", { size: 10, weight: "bold" }));
    parts.push(rect(20, 26, 230, 60, { rx: 30 }));
    parts.push(rect(40, 36, 190, 40, { stroke: SOFT, dash: "3 2" }));
    [52, 96, 140, 184, 218].forEach((x, index) => {
      const y = index % 2 === 0 ? 46 : 66;
      parts.push(`<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="${INK}" stroke-width="1.2" />`);
    });
    parts.push(line(52, 96, 96, 96, { width: 1, marker: "pf-arrow" }));
    parts.push(line(96, 96, 52, 96, { width: 1, marker: "pf-arrow" }));
    parts.push(text(74, 108, "d", { size: 10, anchor: "middle" }));
    // 剖面：跨孔量測
    parts.push(text(12, 132, "剖面：跨孔量測", { size: 10, weight: "bold" }));
    [70, 170].forEach(x => { parts.push(rect(x - 4, 142, 8, 140, { fill: "#fff" })); });
    parts.push(line(20, 142, 250, 142, { color: SOFT }));
    parts.push(`<circle cx="70" cy="200" r="6" fill="${INK}" />`);
    parts.push(`<circle cx="170" cy="200" r="6" fill="#fff" stroke="${INK}" stroke-width="1.4" />`);
    parts.push(line(78, 200, 160, 200, { width: 1.2, marker: "pf-arrow", dash: "4 2" }));
    parts.push(text(40, 204, "發射", { size: 9, anchor: "end" }));
    parts.push(text(184, 204, "接收", { size: 9 }));
    parts.push(`<ellipse cx="120" cy="242" rx="18" ry="9" fill="url(#pf-hatch)" stroke="${INK}" />`);
    parts.push(text(120, 264, "瑕疵", { size: 9, anchor: "middle", fill: SOFT }));
    parts.push(text(120, 292, "同深度量測 V＝d／Δt，逐深度記錄", { size: 9.5, anchor: "middle" }));
    // 三種加密量測方式
    const mode = (x, title, draw) => {
      parts.push(text(x + 40, 132, title, { size: 10, anchor: "middle", weight: "bold" }));
      parts.push(rect(x + 12, 142, 6, 130, { fill: "#fff" }));
      parts.push(rect(x + 62, 142, 6, 130, { fill: "#fff" }));
      draw(x);
    };
    mode(262, "傾斜方式", x => { parts.push(line(x + 18, 230, x + 62, 180, { dash: "4 2", marker: "pf-arrow" })); parts.push(line(x + 18, 190, x + 62, 240, { dash: "4 2", marker: "pf-arrow" })); });
    mode(352, "扇狀方式", x => { [170, 195, 220, 245].forEach(y => parts.push(line(x + 18, 208, x + 62, y, { dash: "4 2", marker: "pf-arrow" }))); });
    mode(442, "單孔方式", x => { [180, 205, 230].forEach(y => parts.push(`<path d="M${x + 68},${y} a18,12 0 1,1 0,20" fill="none" stroke="${INK}" stroke-dasharray="4 2" marker-end="url(#pf-arrow)" />`)); parts.push(text(x + 40, 262, "評估管周", { size: 9, anchor: "middle", fill: SOFT })); });
    parts.push(text(392, 292, "發現異常時改用密集定位，量出水平位置與範圍", { size: 9.5, anchor: "middle" }));
    // 波速—深度圖
    parts.push(text(600, 16, "波速—深度圖", { size: 10, weight: "bold", anchor: "end" }));
    parts.push(rect(540, 26, 90, 96, { stroke: "#999" }));
    parts.push(text(585, 134, "波速 →", { size: 9, anchor: "middle", fill: SOFT }));
    parts.push(text(533, 78, "深度", { size: 9, anchor: "middle", fill: SOFT, rotate: -90 }));
    parts.push(`<path d="M600,28 l-1,10 l2,8 l-2,10 l1,8 l-3,6 l-18,10 l-14,4 l14,4 l18,6 l3,8 l-2,8 l2,8 l-1,8" fill="none" stroke="${INK}" stroke-width="1.3" />`);
    parts.push(`<ellipse cx="578" cy="82" rx="20" ry="16" fill="none" stroke="${INK}" stroke-dasharray="3 2" />`);
    parts.push(text(585, 150, "波速下降、走時變長", { size: 9, anchor: "middle" }));
    parts.push(text(585, 162, "＝包空氣、包穩定液", { size: 9, anchor: "middle" }));
    parts.push(text(585, 174, "或包泥", { size: 9, anchor: "middle" }));
    return svg(W, H, parts.join(""), "連續壁完整性檢測示意圖");
  };

  // ---- 三紀錄交叉比對 --------------------------------------------------------------
  window.PLAN_FIGURES.crossCheck = () => {
    const W = 640, H = 300;
    const top = 44, bottom = 270, bandTop = 128, bandBottom = 178;
    const parts = [];
    parts.push(rect(20, bandTop, 600, bandBottom - bandTop, { fill: "#f0f0f0", stroke: "none" }));
    parts.push(line(20, bandTop, 620, bandTop, { dash: "5 3", color: SOFT }));
    parts.push(line(20, bandBottom, 620, bandBottom, { dash: "5 3", color: SOFT }));
    parts.push(text(24, bandTop - 4, "GL −a", { size: 9, fill: SOFT }));
    parts.push(text(24, bandBottom + 11, "GL −b", { size: 9, fill: SOFT }));
    const title = (x, content) => parts.push(text(x, 20, content, { size: 10.5, anchor: "middle", weight: "bold" }));
    // 1 槽壁超音波掃描
    title(120, "① 槽壁超音波掃描（澆置前）");
    parts.push(line(60, top, 180, top, { color: SOFT }));
    parts.push(`<path d="M95,${top} V${bandTop} C 75,${bandTop + 12} 75,${bandBottom - 12} 95,${bandBottom} V${bottom}" fill="none" stroke="${INK}" stroke-width="1.5" />`);
    parts.push(`<path d="M145,${top} V${bandTop} C 165,${bandTop + 12} 165,${bandBottom - 12} 145,${bandBottom} V${bottom}" fill="none" stroke="${INK}" stroke-width="1.5" />`);
    parts.push(text(120, 158, "坍孔", { size: 10, anchor: "middle" }));
    parts.push(text(120, 290, "壁面外凸的深度範圍", { size: 9.5, anchor: "middle", fill: SOFT }));
    // 2 澆置曲線
    title(320, "② 澆置曲線（澆置中）");
    parts.push(rect(250, top, 140, bottom - top, { stroke: "#999" }));
    parts.push(poly([[250, bottom], [390, top]], { width: 1.6 }));
    const vAt = y => 250 + (bottom - y) / (bottom - top) * 140;
    const shift = 46;
    const endY = bandTop - (390 - vAt(bandTop) - shift) * (bottom - top) / 140;
    parts.push(poly([[250, bottom], [vAt(bandBottom), bandBottom], [vAt(bandBottom) + shift, bandTop], [390, Math.max(top, endY)]], { width: 1.8, dash: "5 3", color: SERIES.B }));
    parts.push(text(372, 60, "設計", { size: 9, anchor: "end", fill: SOFT }));
    parts.push(text(386, 108, "實際", { size: 9, anchor: "end", fill: SERIES.B }));
    parts.push(text(268, 148, "用量增加", { size: 9.5 }));
    parts.push(text(268, 160, "（斜率變小）", { size: 9, fill: SOFT }));
    parts.push(text(320, 290, "同一深度段多用了混凝土", { size: 9.5, anchor: "middle", fill: SOFT }));
    // 3 開挖後壁面
    title(530, "③ 開挖後壁面（開挖後）");
    parts.push(line(470, top, 600, top, { color: SOFT }));
    parts.push(rect(500, top, 40, bottom - top, { fill: FILL, stroke: INK }));
    parts.push(`<path d="M540,${bandTop} C 575,${bandTop + 10} 575,${bandBottom - 10} 540,${bandBottom} Z" fill="url(#pf-hatch)" stroke="${INK}" />`);
    parts.push(text(583, 158, "大肚", { size: 10 }));
    parts.push(text(530, 290, "同深度出現多餘混凝土，須打除", { size: 9.5, anchor: "middle", fill: SOFT }));
    return svg(W, H, parts.join(""), "三紀錄交叉比對示意圖");
  };
})();
