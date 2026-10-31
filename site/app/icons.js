/* 地图符号：现在的专题图与历史时间线共用同一套图标。
 * 城市按等级（城镇 · 城市 · 大都会 · 都城）由小到大、由空心到实心；古城取赭色；要塞、关隘取城垛；圣城为紫色四角星；
 * 遗迹、摇篮、宗教圣地是方形徽章，思潮发源是圆形徽章（白色图形画在类别色上）；废墟是不带底的断柱。
 * 画布用 draw*()，图例用 svg*()，两边画出来一模一样。 */
(function (G) {
  'use strict';
  const INK = '#2b333a', RED = '#c0392b', SEL = '#1a73e8', OLD_FILL = '#efe2c8', OLD_INK = '#7a5a36', RUIN = '#6f6150', HOLY = '#7a3fc0';
  // 24×24 视框的白色图形：s = 描线，其余为填充（evenodd 挖空）
  const GLYPH = {
    holy: { d: 'M12 2.5 21 8H3Z M5 9.5h2.4v8H5Z M10.8 9.5h2.4v8h-2.4Z M16.6 9.5H19v8h-2.4Z M3 18.8h18V21H3Z' },                                   // 神殿：圣地
    mountain: { d: 'M1.5 20.5 9 6.5l3.6 6.2L15.5 8l7 12.5Z M9 6.5l2 3.5-2-.9-2 .9Z' },                                                            // 山峰：圣山
    tomb: { d: 'M6 21.5V10a6 6 0 0 1 12 0v11.5Z M11 9h2v3h3v2h-3v5h-2v-5H8v-2h3Z' },                                                          // 带十字的墓碑：圣墓
    siege: { d: 'M2.5 21.5v-11h3v2.5h3v-2.5h3v2.5h3v-2.5h3v2.5h3v-2.5h3v11Z M12.6 12.5l-2.2 3.2 2.6 1.8-1.8 4h1.9l2-4.3-2.5-1.7 2-3Z' },     // 裂开的城墙：围城
    battle: { s: 1, d: 'M5 5 18.5 18.5 M19 5 5.5 18.5 M14.5 20.5l6-6 M3.5 14.5l6 6 M15 6l3-3 M9 6 6 3' },                                       // 交叉的双剑：古战场
    burned: { d: 'M12.5 2c1.2 4 6 6.2 6 12a6.5 6.5 0 0 1-13 0c0-3.2 2-4.8 3.2-6.6.2 2.2 1.3 3.4 2.6 3.6-.6-3.6.4-6.4 1.2-9Z' },                // 火焰：毁于战火
    fort: { d: 'M4 21.5V8h2.5V4.5h2.5V8h1.8V4.5h2.4V8h1.8V4.5h2.5V8H20v13.5h-5.5v-4.5a2.5 2.5 0 0 0-5 0v4.5Z' },                               // 城堡：旧关塞
    revolt: { d: 'M4.5 2.5h2.2v19H4.5Z M6.7 3.5h13l-3.3 4.3 3.3 4.3h-13Z' },                                                                // 旗帜：起事处
    ruin: { d: 'M3 19.2h18v2.3H3Z M5 18V10l3.2-1.2V18Z M10.4 18V6.5l3.2 1.6V18Z M15.8 18v-4.8L19 12v6Z M14.8 12.6l3.4-2.1.8 1.1-3.4 2.1Z' },      // 断柱：古城废墟
    capital: { d: 'M3 17.5 4.6 7.5l4.3 4.2L12 5l3.1 6.7 4.3-4.2L21 17.5Z M3 18.8h18V21H3Z' },                                                // 王冠：古都
    mausoleum: { d: 'M12 2.5 22.5 21H1.5Z M6.6 15.2h10.8v1.5H6.6Z M9.2 10.6h5.6v1.4H9.2Z' },                                                  // 金字塔：帝王陵
    cradle: { d: 'M11 21.5V12h2v9.5Z M12 13.5C12 8.3 8.3 5.6 3.5 6.3 3.6 11 7.3 13.8 12 13.5Z M12 11.5c0-5.2 3.7-7.9 8.5-7.2-.1 4.7-3.8 7.5-8.5 7.2Z' }, // 嫩芽：文明摇篮
    idea: { d: 'M11 6.6C8.9 5.2 6.2 4.7 2.5 5v13.4c3.6-.3 6.3.2 8.5 1.6Z M13 6.6c2.1-1.4 4.8-1.9 8.5-1.6v13.4c-3.6-.3-6.3.2-8.5 1.6Z' }        // 翻开的书：思潮发源
  };
  const cache = {}; const path = k => cache[k] || (cache[k] = new Path2D((GLYPH[k] || GLYPH.ruin).d));

  // ---------- 形状 ----------
  function starPath(c, x, y, R, r, n) { c.beginPath(); for (let i = 0; i < 2 * n; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a); i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); }
  const starD = (x, y, R, r, n) => { let d = ''; for (let i = 0; i < 2 * n; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (x + rr * Math.cos(a)).toFixed(2) + ' ' + (y + rr * Math.sin(a)).toFixed(2); } return d + 'Z'; };
  // 城市的标准半径（屏幕像素）
  const R0 = { town: 2.4, site: 2.8, city: 3.4, metro: 4.4, capital: 5.4, ancient: 3.4 };

  /* 聚落：kind = town | city | metro | capital | ancient（古城）| site（小聚落，方块）
   *  o.r 自定半径（历史图按人口连续缩放），o.sel 选中（蓝圈） */
  function drawCity(c, x, y, kind, o) {
    o = o || {}; const r = o.r || R0[kind] || 3;
    if (o.sel) { c.beginPath(); c.arc(x, y, r + 5, 0, 7); c.fillStyle = 'rgba(26,115,232,.14)'; c.fill(); c.strokeStyle = 'rgba(26,115,232,.9)'; c.lineWidth = 2.2; c.stroke(); }
    c.lineJoin = 'round';
    if (kind === 'site') { c.beginPath(); c.rect(x - r, y - r, 2 * r, 2 * r); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = '#6a3f2c'; c.stroke(); return r; }
    const old = kind === 'ancient';
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fillStyle = old ? OLD_FILL : '#fff'; c.fill();
    c.lineWidth = kind === 'capital' ? 1.7 : kind === 'metro' ? 1.5 : kind === 'town' ? 1.2 : 1.4; c.strokeStyle = old ? OLD_INK : INK; c.stroke();
    if (kind === 'capital') { starPath(c, x, y + r * 0.04, r * 0.74, r * 0.31, 5); c.fillStyle = RED; c.fill(); }
    else if (kind === 'metro' || (old && r >= 4)) { c.beginPath(); c.arc(x, y, Math.max(1.5, r * 0.37), 0, 7); c.fillStyle = old ? OLD_INK : INK; c.fill(); }
    return r;
  }
  // 要塞（城垛方块）与关隘（带门洞的关楼）
  function drawFort(c, x, y, type, k) {
    k = k || 4.2; c.save(); c.translate(x, y); c.beginPath();
    if (type === 'pass-fort') { c.moveTo(-k, k); c.lineTo(-k, -k); c.lineTo(-k * 0.55, -k); c.lineTo(-k * 0.55, -k * 0.55); c.lineTo(k * 0.55, -k * 0.55); c.lineTo(k * 0.55, -k); c.lineTo(k, -k); c.lineTo(k, k); c.lineTo(k * 0.45, k); c.lineTo(k * 0.45, k * 0.15); c.arc(0, k * 0.15, k * 0.45, 0, Math.PI, true); c.lineTo(-k * 0.45, k); c.closePath(); }
    else { c.moveTo(-k, k); c.lineTo(-k, -k); c.lineTo(-k * 0.6, -k); c.lineTo(-k * 0.6, -k * 0.55); c.lineTo(-k * 0.2, -k * 0.55); c.lineTo(-k * 0.2, -k); c.lineTo(k * 0.2, -k); c.lineTo(k * 0.2, -k * 0.55); c.lineTo(k * 0.6, -k * 0.55); c.lineTo(k * 0.6, -k); c.lineTo(k, -k); c.lineTo(k, k); c.closePath(); }
    c.fillStyle = '#d7b978'; c.fill(); c.lineWidth = 1.1; c.strokeStyle = '#593f31'; c.lineJoin = 'round'; c.stroke(); c.restore(); return k;
  }
  // 圣城：紫色四角星（col 可换成宗教自己的颜色）
  function drawHoly(c, x, y, col, k) {
    k = k || 6.5; starPath(c, x, y, k, k * 0.4, 4); c.lineJoin = 'round'; c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke(); c.fillStyle = col || HOLY; c.fill();
  }
  // 废墟：断柱（不带底，赭灰色，白边）
  function drawRuin(c, x, y, size) {
    const s = (size || 13) / 24; c.save(); c.translate(x - 12 * s, y - 13 * s); c.scale(s, s);
    c.lineJoin = 'round'; c.lineWidth = 4.5; c.strokeStyle = 'rgba(255,253,246,.95)'; c.stroke(path('ruin')); c.fillStyle = RUIN; c.fill(path('ruin'), 'evenodd'); c.restore();
  }
  // 徽章：方形（遗迹、摇篮、圣地）或圆形（思潮），白色图形
  function drawBadge(c, x, y, key, col, R, round) {
    R = R || 8.5; c.save(); c.beginPath();
    if (round) c.arc(x, y, R, 0, 7); else if (c.roundRect) c.roundRect(x - R, y - R, 2 * R, 2 * R, R * 0.45); else c.rect(x - R, y - R, 2 * R, 2 * R);
    c.fillStyle = col || '#666'; c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 3; c.fill(); c.shadowBlur = 0; c.lineWidth = 1.5; c.strokeStyle = '#fff'; c.stroke();
    const ic = GLYPH[key] || GLYPH.ruin, sc = (R * (round ? 1.3 : 1.5)) / 24;
    c.translate(x - 12 * sc, y - 12 * sc); c.scale(sc, sc);
    if (ic.s) { c.strokeStyle = '#fff'; c.lineWidth = 2.6; c.lineCap = 'round'; c.stroke(path(key)); } else { c.fillStyle = '#fff'; c.fill(path(key), 'evenodd'); }
    c.restore(); return R;
  }

  // ---------- 图例用的同款 SVG（viewBox 28×14 的符号条，或方形徽章） ----------
  const wrap = (inner, w = 28, h = 14) => `<svg class="mi" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:inline-block;vertical-align:-3px;flex:none;fill:none;stroke:none">${inner}</svg>`;
  function svgCity(kind) {
    const x = 14, y = 7, r = R0[kind] || 3, old = kind === 'ancient';
    if (kind === 'site') return wrap(`<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" style="fill:#fff;stroke:#6a3f2c;stroke-width:1.4"/>`);
    const sw = kind === 'capital' ? 1.7 : kind === 'metro' ? 1.5 : kind === 'town' ? 1.2 : 1.4;
    let s = `<circle cx="${x}" cy="${y}" r="${r}" style="fill:${old ? OLD_FILL : '#fff'};stroke:${old ? OLD_INK : INK};stroke-width:${sw}"/>`;
    if (kind === 'capital') s += `<path d="${starD(x, y + r * 0.04, r * 0.74, r * 0.31, 5)}" style="fill:${RED};stroke:none"/>`;
    else if (kind === 'metro') s += `<circle cx="${x}" cy="${y}" r="${Math.max(1.5, r * 0.37)}" style="fill:${INK};stroke:none"/>`;
    return wrap(s);
  }
  const svgFort = type => wrap(type === 'pass-fort' ? '<path d="M10 12V3h2v2h4V3h2v9h-2V8.5a2 2 0 0 0-4 0V12z" style="fill:#d7b978;stroke:#593f31;stroke-width:.8"/>' : '<path d="M10 12V3h1.6v1.8h1.6V3h1.6v1.8h1.6V3H18v9z" style="fill:#d7b978;stroke:#593f31;stroke-width:.8"/>');
  const svgHoly = col => wrap(`<path d="${starD(14, 7, 6, 2.4, 4)}" style="fill:${col || HOLY};stroke:#fff;stroke-width:1.6;paint-order:stroke;stroke-linejoin:round"/>`);
  const svgRuin = () => `<svg class="mi" viewBox="0 0 24 24" width="16" height="16" style="display:inline-block;vertical-align:-3px;flex:none"><path d="${GLYPH.ruin.d}" style="fill:${RUIN};stroke:rgba(255,253,246,.95);stroke-width:3;paint-order:stroke;stroke-linejoin:round;fill-rule:evenodd"/></svg>`;
  function svgBadge(key, col, size = 20, round) {
    const ic = GLYPH[key] || GLYPH.ruin, bg = round ? `<circle cx="12" cy="12" r="15" style="fill:${col};stroke:none"/>` : `<rect x="-3" y="-3" width="30" height="30" rx="7" style="fill:${col};stroke:none"/>`;
    const g = ic.s ? `<path d="${ic.d}" style="fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round"/>` : `<path d="${ic.d}" style="fill:#fff;stroke:none;fill-rule:evenodd"${round ? ' transform="translate(1.8 1.8) scale(.85)"' : ''}/>`;
    return `<svg class="mi" viewBox="-3 -3 30 30" width="${size}" height="${size}" style="display:inline-block;vertical-align:-4px;margin-right:6px;flex:none">${bg}${g}</svg>`;
  }

  G.MapIcons = { GLYPH, R0, path, drawCity, drawFort, drawHoly, drawRuin, drawBadge, svgCity, svgFort, svgHoly, svgRuin, svgBadge, COLORS: { INK, RED, SEL, HOLY, RUIN } };
})(window);
