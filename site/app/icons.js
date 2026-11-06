/* 地图符号 · 舆图式（界面焕新版）
 * 参考：罗洪先《广舆图》（1555）卷首图例——府从□、州从◇、县从○、驿从△、卫从■——中国最早成体系的地图图例；
 *       城郭一律画成平面“方城”，按行政等级由小到大、由实到框：
 *         小聚落 △ 驿 · 城镇 ■ 实心小方 · 城市 □ 方城 · 大都会 回 府城 · 都城 朱印（红底白框的方印）· 古城 赭色缺角方城；
 *       要塞画成带雉堞与拱门的城堡，关隘为“墙中开门”，废弃旧关为只剩四角的残垣；
 *       圣城为紫色光轮；遗迹、摇篮、圣地、思潮为六角形徽章（白色图形画在类别色上）。
 * 画布用 draw*()，图例用 svg*()，两边画出来一模一样。 */
(function (G) {
  'use strict';
  const INK = '#2a2622', RED = '#b8322a', SEL = '#1a73e8', OLD_FILL = '#f3e6c9', OLD_INK = '#8a6236', RUIN = '#6f6150', HOLY = '#7a3fc0', PAPER = '#fffdf7';
  // 24×24 视框的白色图形：s = 描线，其余为填充（evenodd 挖空）
  const GLYPH = {
    holy: { d: 'M12 2.5 21 8H3Z M5 9.5h2.4v8H5Z M10.8 9.5h2.4v8h-2.4Z M16.6 9.5H19v8h-2.4Z M3 18.8h18V21H3Z' },                                   // 神殿：圣地
    mountain: { d: 'M1.5 20.5 9 6.5l3.6 6.2L15.5 8l7 12.5Z M9 6.5l2 3.5-2-.9-2 .9Z' },                                                            // 山峰：圣山
    tomb: { d: 'M6 21.5V10a6 6 0 0 1 12 0v11.5Z M11 9h2v3h3v2h-3v5h-2v-5H8v-2h3Z' },                                                          // 带十字的墓碑：圣墓
    siege: { d: 'M2.5 21.5v-11h3v2.5h3v-2.5h3v2.5h3v-2.5h3v2.5h3v-2.5h3v11Z M12.6 12.5l-2.2 3.2 2.6 1.8-1.8 4h1.9l2-4.3-2.5-1.7 2-3Z' },     // 裂开的城墙：围城
    battle: { s: 1, d: 'M5 5 18.5 18.5 M19 5 5.5 18.5 M14.5 20.5l6-6 M3.5 14.5l6 6 M15 6l3-3 M9 6 6 3' },                                       // 交叉的双剑：古战场
    burned: { d: 'M12.5 2c1.2 4 6 6.2 6 12a6.5 6.5 0 0 1-13 0c0-3.2 2-4.8 3.2-6.6.2 2.2 1.3 3.4 2.6 3.6-.6-3.6.4-6.4 1.2-9Z' },                // 火焰：毁于战火
    fort: { d: 'M4.5 21.5V9.2L3 7.6V3.5h3.2v2h2.3v-2h2.3v2h1.4v-2h2.3v2h2.3v-2H21v4.1l-1.5 1.6v12.3Z M9.6 21.5v-4.3a2.4 2.4 0 0 1 4.8 0v4.3Z M7.2 11.4h2v3h-2Z M14.8 11.4h2v3h-2Z' }, // 城堡：雉堞、箭窗与拱门（关塞、要塞）
    revolt: { d: 'M4.5 2.5h2.2v19H4.5Z M6.7 3.5h13l-3.3 4.3 3.3 4.3h-13Z' },                                                                // 旗帜：起事处
    ruin: { d: 'M3 3h6v2.4H5.4V9H3Z M15 3h6v6h-2.4V5.4H15Z M3 15h2.4v3.6H9V21H3Z M18.6 15H21v6h-6v-2.4h3.6Z M10.5 10.5h3v3h-3Z' },          // 残垣：古城废墟
    capital: { d: 'M3 3h18v18H3Z M6.5 6.5v11h11v-11Z M9.5 9.5h5v5h-5Z' },                                                                     // 回字方印：古都
    mausoleum: { d: 'M12 2.5 22.5 21H1.5Z M6.6 15.2h10.8v1.5H6.6Z M9.2 10.6h5.6v1.4H9.2Z' },                                                  // 金字塔：帝王陵
    cradle: { d: 'M11 21.5V12h2v9.5Z M12 13.5C12 8.3 8.3 5.6 3.5 6.3 3.6 11 7.3 13.8 12 13.5Z M12 11.5c0-5.2 3.7-7.9 8.5-7.2-.1 4.7-3.8 7.5-8.5 7.2Z' }, // 嫩芽：文明摇篮
    idea: { d: 'M11 6.6C8.9 5.2 6.2 4.7 2.5 5v13.4c3.6-.3 6.3.2 8.5 1.6Z M13 6.6c2.1-1.4 4.8-1.9 8.5-1.6v13.4c-3.6-.3-6.3.2-8.5 1.6Z' }        // 翻开的书：思潮发源
  };
  const cache = {}; const path = k => cache[k] || (cache[k] = new Path2D((GLYPH[k] || GLYPH.ruin).d));

  // ---------- 形状 ----------
  function starPath(c, x, y, R, r, n) { c.beginPath(); for (let i = 0; i < 2 * n; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; const px = x + rr * Math.cos(a), py = y + rr * Math.sin(a); i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); }
  const starD = (x, y, R, r, n) => { let d = ''; for (let i = 0; i < 2 * n; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (x + rr * Math.cos(a)).toFixed(2) + ' ' + (y + rr * Math.sin(a)).toFixed(2); } return d + 'Z'; };
  const hexD = (x, y, R) => { let d = ''; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; d += (i ? 'L' : 'M') + (x + R * Math.cos(a)).toFixed(2) + ' ' + (y + R * Math.sin(a)).toFixed(2); } return d + 'Z'; };
  function hexPath(c, x, y, R) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; i ? c.lineTo(x + R * Math.cos(a), y + R * Math.sin(a)) : c.moveTo(x + R * Math.cos(a), y + R * Math.sin(a)); } c.closePath(); }
  // 城市的标准“半边长”（屏幕像素）：方城的中心到边
  const R0 = { town: 2.2, site: 2.9, city: 3.1, metro: 3.9, capital: 3.7, ancient: 3.1 };

  /* 聚落：kind = town | city | metro | capital | ancient（古城）| site（小聚落）
   *  o.r 自定半边长（历史图按人口连续缩放），o.sel 选中（蓝框） */
  function drawCity(c, x, y, kind, o) {
    o = o || {}; const r = o.r || R0[kind] || 3;
    c.save(); c.lineJoin = 'miter'; c.lineCap = 'butt';
    if (o.sel) { c.beginPath(); c.rect(x - r - 4.5, y - r - 4.5, 2 * r + 9, 2 * r + 9); c.fillStyle = 'rgba(26,115,232,.14)'; c.fill(); c.strokeStyle = 'rgba(26,115,232,.9)'; c.lineWidth = 2; c.stroke(); }
    if (kind === 'site') { // 驿从△
      const h = r * 1.15; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x + h, y + h * 0.8); c.lineTo(x - h, y + h * 0.8); c.closePath();
      c.fillStyle = PAPER; c.fill(); c.lineWidth = 1.3; c.strokeStyle = '#5b4636'; c.stroke(); c.restore(); return r;
    }
    if (kind === 'town') { // 实心小方，白边
      c.beginPath(); c.rect(x - r, y - r, 2 * r, 2 * r); c.lineWidth = 2; c.strokeStyle = 'rgba(255,253,247,.95)'; c.stroke(); c.fillStyle = INK; c.fill(); c.restore(); return r;
    }
    if (kind === 'ancient') { // 古城：赭色方城，缺角
      c.beginPath(); c.rect(x - r, y - r, 2 * r, 2 * r); c.fillStyle = OLD_FILL; c.fill();
      const k = r * 0.55; c.beginPath();
      c.moveTo(x - r, y - r + k); c.lineTo(x - r, y - r); c.lineTo(x - r + k, y - r); c.moveTo(x + r - k, y - r); c.lineTo(x + r, y - r); c.lineTo(x + r, y - r + k);
      c.moveTo(x + r, y + r - k); c.lineTo(x + r, y + r); c.lineTo(x + r - k, y + r); c.moveTo(x - r + k, y + r); c.lineTo(x - r, y + r); c.lineTo(x - r, y + r - k);
      c.lineWidth = 1.5; c.strokeStyle = OLD_INK; c.stroke();
      if (r >= 4) { c.fillStyle = OLD_INK; c.fillRect(x - r * 0.28, y - r * 0.28, r * 0.56, r * 0.56); }
      c.restore(); return r;
    }
    if (kind === 'capital') { // 朱印：外框 + 红方 + 白色小方孔
      const R = r + 1.5; c.beginPath(); c.rect(x - R, y - R, 2 * R, 2 * R); c.fillStyle = PAPER; c.fill(); c.lineWidth = 1; c.strokeStyle = INK; c.stroke();
      c.fillStyle = RED; c.fillRect(x - r, y - r, 2 * r, 2 * r);
      const s = Math.max(1.1, r * 0.36); c.fillStyle = PAPER; c.fillRect(x - s, y - s, 2 * s, 2 * s);
      c.restore(); return R;
    }
    // 城市 □ / 大都会 回
    c.beginPath(); c.rect(x - r, y - r, 2 * r, 2 * r); c.fillStyle = PAPER; c.fill();
    c.lineWidth = kind === 'metro' ? 1.6 : 1.4; c.strokeStyle = INK; c.stroke();
    if (kind === 'metro') { const s = Math.max(1.1, r * 0.42); c.fillStyle = INK; c.fillRect(x - s, y - s, 2 * s, 2 * s); }
    c.restore(); return r;
  }
  // 要塞（城堡）与关隘（墙中开门）
  function drawFort(c, x, y, type, k) {
    k = k || 4.2; c.save(); c.lineJoin = 'miter';
    if (type === 'pass-fort') {
      const w = k * 1.15, h = k * 0.42, g = k * 0.36, t = k * 0.5;
      c.beginPath(); c.rect(x - w, y - h, w - g, 2 * h); c.rect(x + g, y - h, w - g, 2 * h); c.rect(x - g - t, y - t * 1.35, t, t * 2.7); c.rect(x + g, y - t * 1.35, t, t * 2.7);
      c.lineWidth = 2.2; c.strokeStyle = 'rgba(255,253,247,.95)'; c.stroke(); c.fillStyle = '#4b3a2c'; c.fill();
    } else {
      // 城堡：雉堞、箭窗、拱门（白边描出，深褐填色）
      const sc = k * 2.75 / 24; c.translate(x - 12 * sc, y - 12.5 * sc); c.scale(sc, sc); c.lineJoin = 'round';
      c.lineWidth = 3.6; c.strokeStyle = 'rgba(255,253,247,.95)'; c.stroke(path('fort')); c.fillStyle = '#5a4430'; c.fill(path('fort'), 'evenodd');
    }
    c.restore(); return k;
  }
  // 圣城：紫色光轮（col 可换成宗教自己的颜色）
  function drawHoly(c, x, y, col, k) {
    k = k || 6.5; c.save(); const r = k * 0.42; col = col || HOLY;
    c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; c.moveTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35); c.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); }
    c.lineCap = 'round'; c.lineWidth = 3.4; c.strokeStyle = 'rgba(255,253,247,.95)'; c.stroke(); c.lineWidth = 1.4; c.strokeStyle = col; c.stroke();
    c.beginPath(); c.arc(x, y, r, 0, 7); c.lineWidth = 2.4; c.strokeStyle = 'rgba(255,253,247,.95)'; c.stroke(); c.fillStyle = col; c.fill();
    c.restore();
  }
  // 废墟：只剩四角的残垣（不带底，赭灰色，白边）
  function drawRuin(c, x, y, size) {
    const s = (size || 13) / 24; c.save(); c.translate(x - 12 * s, y - 12 * s); c.scale(s, s);
    c.lineJoin = 'round'; c.lineWidth = 4.5; c.strokeStyle = 'rgba(255,253,247,.95)'; c.stroke(path('ruin')); c.fillStyle = RUIN; c.fill(path('ruin'), 'evenodd'); c.restore();
  }
  // 徽章：六角形（遗迹、摇篮、圣地）或圆形（思潮），白色图形
  function drawBadge(c, x, y, key, col, R, round) {
    R = R || 8.5; c.save();
    if (round) { c.beginPath(); c.arc(x, y, R, 0, 7); } else hexPath(c, x, y, R * 1.12);
    c.fillStyle = col || '#666'; c.shadowColor = 'rgba(0,0,0,.28)'; c.shadowBlur = 3; c.fill(); c.shadowBlur = 0; c.lineWidth = 1.5; c.strokeStyle = '#fff'; c.stroke();
    const ic = GLYPH[key] || GLYPH.ruin, sc = (R * (round ? 1.3 : 1.36)) / 24;
    c.translate(x - 12 * sc, y - 12 * sc); c.scale(sc, sc);
    if (ic.s) { c.strokeStyle = '#fff'; c.lineWidth = 2.6; c.lineCap = 'round'; c.stroke(path(key)); } else { c.fillStyle = '#fff'; c.fill(path(key), 'evenodd'); }
    c.restore(); return R;
  }

  // ---------- 图例用的同款 SVG（viewBox 28×14 的符号条，或徽章） ----------
  const wrap = (inner, w = 28, h = 14) => `<svg class="mi" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="display:inline-block;vertical-align:-3px;flex:none;fill:none;stroke:none">${inner}</svg>`;
  const sq = (x, y, r, style) => `<rect x="${(x - r).toFixed(2)}" y="${(y - r).toFixed(2)}" width="${(2 * r).toFixed(2)}" height="${(2 * r).toFixed(2)}" style="${style}"/>`;
  function svgCity(kind) {
    const x = 14, y = 7, r = R0[kind] || 3;
    if (kind === 'site') { const h = r * 1.15; return wrap(`<path d="M${x} ${y - h}L${x + h} ${y + h * 0.8}L${x - h} ${y + h * 0.8}Z" style="fill:${PAPER};stroke:#5b4636;stroke-width:1.3;stroke-linejoin:miter"/>`); }
    if (kind === 'town') return wrap(sq(x, y, r, `fill:${INK};stroke:none`));
    if (kind === 'ancient') { const k = r * 0.55; return wrap(sq(x, y, r, `fill:${OLD_FILL};stroke:none`) + `<path d="M${x - r} ${y - r + k}V${y - r}H${x - r + k}M${x + r - k} ${y - r}H${x + r}V${y - r + k}M${x + r} ${y + r - k}V${y + r}H${x + r - k}M${x - r + k} ${y + r}H${x - r}V${y + r - k}" style="stroke:${OLD_INK};stroke-width:1.5;fill:none"/>`); }
    if (kind === 'capital') { const R = r + 1.7, s = Math.max(1.1, r * 0.36); return wrap(sq(x, y, R, `fill:${PAPER};stroke:${INK};stroke-width:1.1`) + sq(x, y, r, `fill:${RED};stroke:none`) + sq(x, y, s, `fill:${PAPER};stroke:none`)); }
    let s = sq(x, y, r, `fill:${PAPER};stroke:${INK};stroke-width:${kind === 'metro' ? 1.6 : 1.4}`);
    if (kind === 'metro') s += sq(x, y, Math.max(1.1, r * 0.42), `fill:${INK};stroke:none`);
    return wrap(s);
  }
  const svgFort = type => {
    if (type === 'pass-fort') { const k = 4.4, x = 14, y = 7, w = k * 1.15, h = k * 0.42, g = k * 0.36, t = k * 0.5;
      return wrap(`<path d="M${x - w} ${y - h}h${w - g}v${2 * h}h${-(w - g)}Z M${x + g} ${y - h}h${w - g}v${2 * h}h${-(w - g)}Z M${x - g - t} ${y - t * 1.35}h${t}v${t * 2.7}h${-t}Z M${x + g} ${y - t * 1.35}h${t}v${t * 2.7}h${-t}Z" style="fill:#4b3a2c;stroke:none"/>`); }
    return wrap(`<path d="${GLYPH.fort.d}" transform="translate(8.2 1.1) scale(.5)" style="fill:#5a4430;stroke:rgba(255,253,247,.95);stroke-width:2.4;paint-order:stroke;stroke-linejoin:round;fill-rule:evenodd"/>`);
  };
  const svgHoly = col => { col = col || HOLY; let rays = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; rays += `M${(14 + Math.cos(a) * 3.4).toFixed(2)} ${(7 + Math.sin(a) * 3.4).toFixed(2)}L${(14 + Math.cos(a) * 6).toFixed(2)} ${(7 + Math.sin(a) * 6).toFixed(2)}`; }
    return wrap(`<path d="${rays}" style="stroke:${col};stroke-width:1.3;stroke-linecap:round"/><circle cx="14" cy="7" r="2.5" style="fill:${col}"/>`); };
  const svgRuin = () => `<svg class="mi" viewBox="0 0 24 24" width="16" height="16" style="display:inline-block;vertical-align:-3px;flex:none"><path d="${GLYPH.ruin.d}" style="fill:${RUIN};stroke:rgba(255,253,247,.95);stroke-width:3;paint-order:stroke;stroke-linejoin:round;fill-rule:evenodd"/></svg>`;
  function svgBadge(key, col, size = 20, round) {
    const ic = GLYPH[key] || GLYPH.ruin, bg = round ? `<circle cx="12" cy="12" r="15" style="fill:${col};stroke:none"/>` : `<path d="${hexD(12, 12, 16.4)}" style="fill:${col};stroke:none"/>`;
    const g = ic.s ? `<path d="${ic.d}" style="fill:none;stroke:#fff;stroke-width:2.6;stroke-linecap:round" transform="translate(2.4 2.4) scale(.8)"/>` : `<path d="${ic.d}" style="fill:#fff;stroke:none;fill-rule:evenodd" transform="translate(2.4 2.4) scale(.8)"/>`;
    return `<svg class="mi" viewBox="-5 -5 34 34" width="${size}" height="${size}" style="display:inline-block;vertical-align:-4px;margin-right:6px;flex:none">${bg}${g}</svg>`;
  }

  G.MapIcons = { GLYPH, R0, path, drawCity, drawFort, drawHoly, drawRuin, drawBadge, svgCity, svgFort, svgHoly, svgRuin, svgBadge, hexPath, COLORS: { INK, RED, SEL, HOLY, RUIN, PAPER } };
})(window);
