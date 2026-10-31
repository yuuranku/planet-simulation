/* 地图视图：视口栅格 + 矢量叠加 + 分级显示（移植自 atlas-hierarchy / atlas-interaction） */
(function (G) {
  'use strict';
  const SANS = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif', SERIF = '"Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", "SimSun", serif';
  let FONT = SANS;
  // 地图风格（矢量部分）：线条与注记统一换色（canvas 滤镜），古典与水墨用宋体
  const VSTYLE = { default: { filter: 'none', bg: '#e8f3f7' }, antique: { filter: 'sepia(0.85) saturate(1.15) brightness(0.92)', font: SERIF, bg: '#e8dcc0' }, modern: { filter: 'saturate(0.75)', bg: '#f2f3f0' },
    nautical: { filter: 'saturate(0.55) brightness(0.85)', font: SERIF, bg: '#f4f0e4' }, blueprint: { filter: 'grayscale(1) invert(1) brightness(1.6)', bg: '#0f2f5a' },
    ink: { filter: 'grayscale(1) contrast(1.25) brightness(0.8)', font: SERIF, bg: '#f2efe8' }, night: { filter: 'invert(0.9) hue-rotate(180deg) saturate(1.2)', bg: '#0b1422' },
    political: { filter: 'none', bg: '#cfe9f6', political: true } };
  G.MAP_STYLES = VSTYLE;
  // 屏幕尺度分级：与原版相同的阈值
  const LEVELS = ['world', 'region', 'local', 'detail'];
  const AREA_MAJOR = { plain: 900, plateau: 450, basin: 40 }; // 全图即显示的大片地貌（半格数）
  const levelOf = ratio => ratio < 2.5 ? 0 : ratio < 7 ? 1 : ratio < 18 ? 2 : 3;
  const routeVisible = (imp, lv, mode) => { const rank = { trunk: 0, regional: 1, local: 2 }[imp]; const min = mode === 'sea' ? rank : mode === 'rail' ? rank + 1 : Math.max(1, rank); return min <= lv; };
  const bridgeVisible = (imp, lv) => [1, 2, 3][imp] <= lv;
  // 以国家为主题的人文专题：国名、省界、部族名属于专题本身；其余专题（文明、语言、宗教、人口……）只写自己的类别，国名要打开“国界与国名”才显示
  const POLITICAL_TOPIC = { country: 1, govern: 1, province: 1, heritage: 1 };
  G.POLITICAL_TOPIC = POLITICAL_TOPIC;

  function MapView(canvas, app) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.app = app;
    this.view = { s: 1, x: 0, y: 0 }; this.dpr = 1; this.vw = 0; this.vh = 0;
    this.tex = null; this.texKey = ''; this.frame = null; this.frameTimer = 0; this.frameSeq = 0;
    this.paths = null; this.fitted = false;
    this.bindInput();
  }
  const MP = MapView.prototype;
  MP.level = function () { return levelOf(this.zoomRel()); };

  MP.setData = function (d) {
    this.d = d; this.W = d.W; this.H = d.H; this.urban = new Map(); this.urbanReq = new Set(); this.stemCache = null;
    this.kmPerGrid = 2 * Math.PI * d.cfg.radius / d.W;
    this.buildPaths();
    this.tex = null; this.texKey = ''; if (this.tiles) this.tiles.clear(); if (this.inflight) this.inflight.clear(); if (this.inflightId) this.inflightId.clear(); this.queue = [];
    this.gen = (this.gen || 0) + 1; // 世界代号：上一个世界还在路上的瓦片、纹理一律作废
    this.fit(); this.fitted = true;
    this.refreshRaster();
  };
  const toPath = (lines) => { const p = new Path2D(); for (const a of lines) { p.moveTo(a[0], a[1]); for (let k = 2; k < a.length; k += 2) p.lineTo(a[k], a[k + 1]); } return p; };
  // 平滑折线（道路/航线）：Chaikin 一次
  const smoothLines = lines => lines.map(a => { if (a.length < 6) return a; const o = [a[0], a[1]]; for (let k = 0; k < a.length - 2; k += 2) o.push(a[k] * 0.75 + a[k + 2] * 0.25, a[k + 1] * 0.75 + a[k + 3] * 0.25, a[k] * 0.25 + a[k + 2] * 0.75, a[k + 1] * 0.25 + a[k + 3] * 0.75); o.push(a[a.length - 2], a[a.length - 1]); return o; });
  MP.buildPaths = function () {
    const d = this.d;
    const cont = { land: new Path2D(), sea: new Path2D(), index: new Path2D(), fine: null, fineIndex: null };
    for (const c of d.contours || []) { const p = c.level <= 0 ? cont.sea : c.k % 4 === 0 ? cont.index : cont.land, a = c.pts; p.moveTo(a[0], a[1]); for (let k = 2; k < a.length; k += 2) p.lineTo(a[k], a[k + 1]); }
    const roads = {}; for (const k of ['trunk', 'regional', 'local', 'sea', 'rail', 'seaTrunk']) roads[k] = toPath(smoothLines(d.roads[k] || []));
    const BD = d.borders || {}, borders = {}; for (const k of ['country', 'frontier', 'province', 'claim']) borders[k] = toPath(BD[k] || []);
    const plates = d.plateSegs.map(lines => toPath(lines));
    const isobars = (d.isobars || []).map(s => toPath(s.lines.map(l => l.pts)));
    // 小型湖泊（矢量）：按层级分两组路径，形状为确定性的不规则湖岸
    const sl = [new Path2D(), new Path2D()], SL = d.smallLakes || [];
    for (let k = 0; k < SL.length; k += 5) { const x = SL[k], y = SL[k + 1], r = SL[k + 2], sd = SL[k + 3], p = sl[SL[k + 4] === 1 ? 0 : 1];
      const n = 11, a0 = (sd % 628) / 100, ex = 0.65 + ((sd >> 3) % 70) / 100, rot = ((sd >> 6) % 314) / 100;
      for (let j = 0; j <= n; j++) { const a = j / n * Math.PI * 2, wob = 1 + 0.22 * Math.sin(a * 3 + a0) + 0.12 * Math.sin(a * 5 - a0 * 2), rx = Math.cos(a) * r * wob, ry = Math.sin(a) * r * wob * ex;
        const px = x + rx * Math.cos(rot) - ry * Math.sin(rot), py = y + rx * Math.sin(rot) + ry * Math.cos(rot); j ? p.lineTo(px, py) : p.moveTo(px, py); } p.closePath(); }
    this.paths = { cont, roads, borders, plates, isobars, rivers: {}, smallLakes: sl };
  };
  // 河流：按原版制图分级（tier 0 世界 / 1 区域 / 2 地方 / 3 细部）与流量宽度分类分别成路径
  MP.riverPaths = function (season) {
    const key = season == null ? 'ann' : 's' + season;
    if (this.paths.rivers[key]) return this.paths.rivers[key];
    const { pts, offs } = this.d.rivers, qth = this.d.qth, tiers = this.d.rivers.tiers;
    const mk = () => ({ cls: [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()], dry: new Path2D() });
    const byTier = [mk(), mk(), mk(), mk()], all = mk();
    const clsOf = q => { const r = q / qth; return r < 3 ? 0 : r < 10 ? 1 : r < 40 ? 2 : r < 150 ? 3 : 4; };
    for (let r = 0; r < offs.length - 1; r++) {
      const T = byTier[tiers ? Math.min(3, tiers[r]) : 3];
      let prevC = -1, prevDry = false;
      for (let k = offs[r]; k < offs[r + 1]; k++) {
        const x = pts[k * 7], y = pts[k * 7 + 1], qa = pts[k * 7 + 2], q = season == null ? qa : pts[k * 7 + 3 + season];
        const c = clsOf(season == null ? qa : Math.max(q, qth * 0.5)), isDry = season != null && q < qa * 0.25;
        if (k === offs[r]) { prevC = c; prevDry = isDry; (isDry ? T.dry : T.cls[c]).moveTo(x, y); (isDry ? all.dry : all.cls[c]).moveTo(x, y); continue; }
        const px = pts[(k - 1) * 7], py = pts[(k - 1) * 7 + 1];
        for (const S of [T, all]) { const target = isDry ? S.dry : S.cls[c]; if (c !== prevC || isDry !== prevDry) target.moveTo(px, py); target.lineTo(x, y); }
        prevC = c; prevDry = isDry;
      }
    }
    return (this.paths.rivers[key] = { cls: all.cls, dry: all.dry, byTier });
  };

  // ---------- 视图 ----------
  MP.resize = function () {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.vw = r.width; this.vh = r.height;
    this.cv.width = Math.round(r.width * this.dpr); this.cv.height = Math.round(r.height * this.dpr);
    if (this.d && !this.fitted) this.fit();
    this.clamp(); this.draw(); this.scheduleFrame();
  };
  MP.fitScale = function () { if (!this.d) return 1; const f = Math.min(this.vw / this.W, this.vh / this.H); return this.vw < this.vh ? Math.max(f, this.vh / this.H * 0.62) : f; };
  MP.fit = function () { if (!this.d) return; const s = this.fitScale(); this.view.s = s; this.view.x = (this.vw - this.W * s) / 2; this.view.y = (this.vh - this.H * s) / 2; };
  MP.minScale = function () { return this.fitScale() * 0.85; };
  MP.maxScale = function () { return this.fitScale() * 48; };
  MP.clamp = function () {
    if (!this.d) return;
    const v = this.view, mh = this.H * v.s;
    if (mh <= this.vh) v.y = (this.vh - mh) / 2; else v.y = Math.min(0, Math.max(this.vh - mh, v.y));
  };
  MP.zoomRel = function () { return this.view.s / this.fitScale(); };
  MP.toGrid = function (sx, sy) { return [(sx - this.view.x) / this.view.s, (sy - this.view.y) / this.view.s]; };
  MP.toScreen = function (gx, gy) { return [this.view.x + gx * this.view.s, this.view.y + gy * this.view.s]; };
  MP.setScaleAt = function (ns, sx, sy) {
    ns = Math.min(this.maxScale(), Math.max(this.minScale(), ns));
    const [gx, gy] = this.toGrid(sx, sy); const v = this.view;
    v.s = ns; v.x = sx - gx * ns; v.y = sy - gy * ns; this.clamp(); this.draw();
  };
  // 动画缩放（三次缓出 280ms，与原版一致）
  MP.zoomAt = function (sx, sy, f, duration = 280) {
    this.stopMotion();
    const s0 = this.view.s, s1 = Math.min(this.maxScale(), Math.max(this.minScale(), s0 * f));
    if (s1 === s0) return;
    const [gx, gy] = this.toGrid(sx, sy), lg = Math.log(s1 / s0), t0 = performance.now();
    const step = (now) => {
      const p = duration > 0 ? Math.min(1, (now - t0) / duration) : 1, e = 1 - Math.pow(1 - p, 3), s = p === 1 ? s1 : s0 * Math.exp(lg * e);
      this.view.s = s; this.view.x = sx - gx * s; this.view.y = sy - gy * s; this.clamp(); this.draw();
      if (p < 1) this.motion = requestAnimationFrame(step); else { this.motion = 0; this.scheduleFrame(); }
    };
    this.motion = requestAnimationFrame(step);
  };
  MP.stopMotion = function () { if (this.motion) cancelAnimationFrame(this.motion); this.motion = 0; };
  MP.flyTo = function (gx, gy, rel) {
    this.stopMotion();
    const v = this.view, s0 = v.s, s1 = this.fitScale() * (rel || Math.max(3, this.zoomRel()));
    const [cx0, cy0] = this.toGrid(this.vw / 2, this.vh / 2);
    let tx = gx; while (tx - cx0 > this.W / 2) tx -= this.W; while (cx0 - tx > this.W / 2) tx += this.W;
    const t0 = performance.now(), dur = 700;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const s = s0 * Math.pow(s1 / s0, e), cx = cx0 + (tx - cx0) * e, cy = cy0 + (gy - cy0) * e;
      v.s = s; v.x = this.vw / 2 - cx * s; v.y = this.vh / 2 - cy * s; this.clamp(); this.draw();
      if (t < 1) this.motion = requestAnimationFrame(step); else { this.motion = 0; this.scheduleFrame(); }
    };
    this.motion = requestAnimationFrame(step);
  };

  // ---------- 栅格 ----------
  MP.rasterKey = function () { const a = this.app, x = a.aux; return JSON.stringify([this.gen || 0, a.topic(), a.season, x.elev, x.depth, x.lakes, x.snow, x.frost, x.landform, x.coast, x.nominal, x.style, !!x.gray]); };
  MP.refreshRaster = function () {
    if (!this.d) return;
    const key = this.rasterKey();
    if (key !== this.texKey) {
      this.texKey = key; if (this.tiles) { for (const o of this.tiles.values()) o.img.close && o.img.close(); this.tiles.clear(); }
      if (this.inflightId) { for (const id of this.inflightId.values()) this.app.cancelRender(id); this.inflightId.clear(); } // 主题/风格切换：在途条带立即停算
      if (this.inflight) this.inflight.clear();
      this.app.render({ w: 2048, h: 1024, x0: 0, y0: 0, s: this.W / 2048, topic: this.app.topic(), season: this.app.season, aux: this.app.auxObj() }).then(img => {
        if (this.texKey !== key) return; this.tex = img; this.draw(); this.app.onTexture && this.app.onTexture(img, key);
      });
    }
    this.updateTiles();
  };
  // ---------- 瓦片（类似谷歌/苹果地图的分块加载） ----------
  const TILE = 256;
  MP.tileZoom = function () {
    const need = this.view.s * this.dpr * this.W / 2048;
    if (need <= 1.05) return 0;
    return Math.max(1, Math.min(7, Math.ceil(Math.log2(need) - 0.05)));
  };
  MP.tileGeom = function (z) { const g = (this.W / 2048) / Math.pow(2, z); return { g, span: TILE * g, nx: Math.ceil(this.W / (TILE * g)), ny: Math.ceil(this.H / (TILE * g)) }; };
  MP.visibleTiles = function (z) {
    const v = this.view, { span, nx, ny } = this.tileGeom(z);
    const gx0 = -v.x / v.s, gx1 = (this.vw - v.x) / v.s, gy0 = Math.max(0, -v.y / v.s), gy1 = Math.min(this.H, (this.vh - v.y) / v.s);
    const out = [], cx = (gx0 + gx1) / 2, cy = (gy0 + gy1) / 2;
    for (let ty = Math.max(0, Math.floor(gy0 / span)); ty <= Math.min(ny - 1, Math.floor(gy1 / span)); ty++)
      for (let tx = Math.floor(gx0 / span); tx <= Math.floor(gx1 / span); tx++)
        out.push({ z, tx, ty, txm: ((tx % nx) + nx) % nx, d: Math.hypot((tx + 0.5) * span - cx, (ty + 0.5) * span - cy) });
    out.sort((a, b) => a.d - b.d);
    return out;
  };
  MP.tileKey = function (z, txm, ty) { return this.texKey + '|' + z + '|' + txm + '|' + ty; };
  MP.scheduleFrame = function () { this.updateTiles(); };
  MP.updateTiles = function () {
    if (!this.d || !this.texKey) return;
    this.tiles = this.tiles || new Map(); this.inflight = this.inflight || new Set(); this.inflightId = this.inflightId || new Map();
    const z = this.tileZoom(); this.wantZ = z;
    const want = z ? this.visibleTiles(z) : [];
    const wantKeys = new Set(want.map(t => this.tileKey(z, t.txm, t.ty)));
    for (const [key, id] of [...this.inflightId]) if (!wantKeys.has(key)) { this.app.cancelRender(id); this.inflight.delete(key); this.inflightId.delete(key); } // 视野外的在途瓦片立即停算
    this.queue = want.filter(t => !this.tiles.has(this.tileKey(z, t.txm, t.ty)));
    this.pump();
  };
  MP.pump = function () {
    while (this.inflight.size < 3 && this.queue && this.queue.length) {
      const t = this.queue.shift(), key = this.tileKey(t.z, t.txm, t.ty);
      if (this.tiles.has(key) || this.inflight.has(key)) continue;
      const { g, span } = this.tileGeom(t.z), texKey = this.texKey;
      this.inflight.add(key);
      // 渐进瓦片：预览帧先上屏，细节条带随后逐条覆盖到同一张画布上
      const cv = document.createElement('canvas'); cv.width = TILE; cv.height = TILE;
      const cctx = cv.getContext('2d');
      const p = this.app.render({ w: TILE, h: TILE, pad: 1, x0: t.txm * span, y0: t.ty * span, s: g, topic: this.app.topic(), season: this.app.season, aux: this.app.auxObj(), strips: 1 }, m => {
        cctx.putImageData(new ImageData(new Uint8ClampedArray(m.buf.buffer || m.buf), TILE, m.h), 0, m.y);
        if (texKey === this.texKey) { this.fade = true; this.draw(); }
      });
      this.inflightId.set(key, p.renderId);
      p.then(img => {
        this.inflight.delete(key); this.inflightId.delete(key);
        if (texKey === this.texKey) {
          cctx.drawImage(img, 0, 0);
          this.tiles.set(key, { img: cv, t: performance.now() });
          while (this.tiles.size > 260) { const k0 = this.tiles.keys().next().value, o = this.tiles.get(k0); o.img.close && o.img.close(); this.tiles.delete(k0); }
          this.fade = true; this.draw();
        }
        this.pump();
      }, () => { this.inflight.delete(key); this.inflightId.delete(key); this.pump(); });
    }
  };
  MP.drawTiles = function (c, ks) {
    const z = this.wantZ; if (!z || !this.tiles) return;
    const v = this.view, s = v.s, dpr = this.dpr, now = performance.now(); let fading = false;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const t of this.visibleTiles(z)) {
      const { span } = this.tileGeom(z), x = v.x + t.tx * span * s, y = v.y + t.ty * span * s, sz = span * s;
      const own = this.tiles.get(this.tileKey(z, t.txm, t.ty));
      const alpha = own ? Math.min(1, (now - own.t) / 180) : 0;
      if (alpha < 1) { // 先用已缓存的上级瓦片裁切占位
        for (let pz = z - 1; pz >= 1; pz--) {
          const f = Math.pow(2, z - pz), ptx = Math.floor(t.txm / f), pty = Math.floor(t.ty / f), p = this.tiles.get(this.tileKey(pz, ptx, pty));
          if (!p) continue;
          const sub = TILE / f, ox = (t.txm - ptx * f) * sub, oy = (t.ty - pty * f) * sub;
          c.drawImage(p.img, ox, oy, sub, sub, x, y, sz + 0.5, sz + 0.5); break;
        }
      }
      if (own) { if (alpha < 1) { c.globalAlpha = alpha; fading = true; } c.drawImage(own.img, x, y, sz + 0.5, sz + 0.5); c.globalAlpha = 1; }
    }
    if (fading) this.draw();
  };
  // ---------- 绘制 ----------
  MP.draw = function () { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.render(); }); };
  MP.copies = function () { const v = this.view, W = this.W * v.s, out = []; if (!(W > 0) || !isFinite(v.x)) return [0]; const k0 = Math.floor(-v.x / W), k1 = Math.floor((this.vw - v.x) / W); for (let k = k0; k <= k1; k++) out.push(k); return out; };
  MP.render = function () {
    let c = this.ctx; const dpr = this.dpr, v = this.view, mainCtx = this.ctx;
    const VS = VSTYLE[this.app.aux.style] || VSTYLE.default; FONT = VS.font || SANS;
    c.setTransform(1, 0, 0, 1, 0, 0); c.filter = 'none'; c.fillStyle = VS.bg; c.fillRect(0, 0, this.cv.width, this.cv.height);
    if (!this.d) return;
    const ks = this.copies(), W = this.W, H = this.H, s = v.s;
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    if (this.tex) for (const k of ks) { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.drawImage(this.tex, v.x + k * W * s, v.y, W * s, H * s); }
    this.drawTiles(c, ks);
    if (this.app.drawHistory) this.app.drawHistory(c, this, ks); // 历史时间线：区块着色（在河流、海岸等矢量层之下）
    // 风格滤镜：矢量层先画到离屏图层，最后整体套一次滤镜合成（避免逐个绘制调用加滤镜）
    const styled = VS.filter !== 'none';
    if (styled) { if (!this.vcv) { this.vcv = document.createElement('canvas'); } if (this.vcv.width !== this.cv.width || this.vcv.height !== this.cv.height) { this.vcv.width = this.cv.width; this.vcv.height = this.cv.height; }
      c = this.vcv.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.vcv.width, this.vcv.height); this.ctx = c; }
    const app = this.app, aux = app.aux, tab = app.tab, zr = this.zoomRel(), lv = levelOf(zr), topic = app.topic(), px = 1 / s, d = this.d;
    const each = (fn) => { for (const k of ks) { c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (v.x + k * W * s), dpr * v.y); fn(k); } };
    c.lineJoin = 'round'; c.lineCap = 'round';
    const POL = !!VS.political; // 政区图：不画陆地等高线，始终显示国界与经纬网
    if (aux.coast && !POL) each(() => {
      c.strokeStyle = 'rgba(110,150,185,.3)'; c.lineWidth = 0.7 * px; c.stroke(this.paths.cont.sea);
      // 陆地 23 层等高线改在栅格里按设色地表逐像素描出（core/render.js），与海岸线、色带同源，不再在此叠矢量线
    });
    // 城市建成区（新城市生成器）：在原位绘制建成区、街区、干道、城墙
    // 小型湖泊：区域级起显示较大的，地方级起显示全部（全图不画，节省绘制）
    if (aux.lakes !== false && lv >= 1 && tab !== 'plates') each(() => { c.fillStyle = '#a9d2e6'; c.strokeStyle = 'rgba(72,122,160,.55)'; c.lineWidth = 1.2 * px;
      const ks = lv >= 2 ? [0, 1] : [0]; for (const k of ks) c.stroke(this.paths.smallLakes[k]); for (const k of ks) c.fill(this.paths.smallLakes[k]); }); // 先描边后填色：相邻小湖融为一体，不出现内部轮廓
    // 河流
    const seasonal = tab === 'season' && app.sx.srivers;
    if (aux.rivers || seasonal) {
      const rp = this.riverPaths(seasonal ? app.season : null), wf = Math.min(2.4, 0.85 + 0.35 * Math.log2(Math.max(1, zr)));
      // 视觉层次：全图只显示世界级干流；放大逐级显示区域、地方、细部支流（细一级的河更细更淡）
      const widths = [0.55, 0.8, 1.15, 1.6, 2.3], tierMax = Math.min(3, lv);
      each(() => {
        for (let t = tierMax; t >= 0; t--) { const T = rp.byTier[t], fade = t < tierMax ? 1 : lv === 0 ? 1 : 0.8;
          c.strokeStyle = fade < 1 ? 'rgba(75,143,198,.85)' : '#4b8fc6';
          for (let i = 0; i < 5; i++) { c.lineWidth = Math.max(lv === 0 ? 0.9 : 0.5, widths[i] * wf * (lv === 0 ? 1.3 : 1)) * px; c.stroke(T.cls[i]); }
          if (seasonal) { c.setLineDash([2 * px, 2.5 * px]); c.strokeStyle = 'rgba(75,143,198,.7)'; c.lineWidth = 0.7 * wf * px; c.stroke(T.dry); c.setLineDash([]); } }
      });
    }
    // 边界（矢量）：省界 < 名义宣称 < 部族边疆 < 国界
    const human = tab === 'human', polTopic = human && POLITICAL_TOPIC[topic], showStates = aux.borders || polTopic || (human && topic === 'system') || POL;
    if (tab !== 'plates' && tab !== 'season') each(() => {
      if (polTopic && (topic === 'province' || lv >= 2)) { c.setLineDash([3 * px, 2.5 * px]); c.strokeStyle = 'rgba(70,60,55,.42)'; c.lineWidth = 0.8 * px; c.stroke(this.paths.borders.province); c.setLineDash([]); }
      if (aux.nominal) { c.setLineDash([6 * px, 4 * px]); c.strokeStyle = 'rgba(150,70,60,.6)'; c.lineWidth = 1.1 * px; c.stroke(this.paths.borders.claim); c.setLineDash([]); }
      if (showStates && POL) { // 政区图：细而清晰的深灰国界，部族边疆用细虚线
        c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2 * px; c.stroke(this.paths.borders.country);
        c.strokeStyle = 'rgba(78,78,92,.85)'; c.lineWidth = 0.9 * px; c.stroke(this.paths.borders.country);
        c.setLineDash([3 * px, 2.5 * px]); c.strokeStyle = 'rgba(96,96,110,.6)'; c.lineWidth = 0.8 * px; c.stroke(this.paths.borders.frontier); c.setLineDash([]);
      } else if (showStates) {
        c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3 * px; c.stroke(this.paths.borders.country);
        c.strokeStyle = 'rgba(70,52,44,.8)'; c.lineWidth = 1.25 * px; c.stroke(this.paths.borders.country);
        c.setLineDash([1.5 * px, 2.5 * px]); c.strokeStyle = 'rgba(110,80,60,.6)'; c.lineWidth = 1 * px; c.stroke(this.paths.borders.frontier); c.setLineDash([]);
      }
    });
    // 交通（按分级显示）
    if (aux.roads && tab !== 'plates') each(() => {
      const R = this.paths.roads;
      if (routeVisible('regional', lv, 'sea')) { c.setLineDash([4 * px, 4 * px]); c.strokeStyle = 'rgba(70,120,165,.5)'; c.lineWidth = 0.9 * px; c.stroke(R.sea); c.setLineDash([]); }
      else { c.setLineDash([4 * px, 5 * px]); c.strokeStyle = 'rgba(70,120,165,.42)'; c.lineWidth = 0.9 * px; c.stroke(R.seaTrunk); c.setLineDash([]); }
      const rw = Math.min(1.9, 0.85 + 0.28 * Math.log2(Math.max(1, zr)));
      const road = (P, casing, core, cw, kw) => { c.strokeStyle = casing; c.lineWidth = cw * rw * px; c.stroke(P); c.strokeStyle = core; c.lineWidth = kw * rw * px; c.stroke(P); };
      if (routeVisible('local', lv, 'road')) road(R.local, 'rgba(255,255,255,.55)', 'rgba(176,128,86,.85)', 1.8, 0.8);
      if (routeVisible('regional', lv, 'road')) road(R.regional, 'rgba(255,255,255,.75)', '#d68845', 2.4, 1.25);
      if (routeVisible('trunk', lv, 'road')) road(R.trunk, 'rgba(255,255,255,.85)', '#c2462f', 3.4, 1.9);
      if (routeVisible('trunk', lv, 'rail')) { c.strokeStyle = '#3a3f46'; c.lineWidth = 1.6 * px; c.stroke(R.rail); c.setLineDash([3 * px, 3 * px]); c.strokeStyle = '#fff'; c.lineWidth = 0.8 * px; c.stroke(R.rail); c.setLineDash([]); }
    });
    if (aux.roads && tab !== 'plates' && lv >= 1) this.drawBridges(ks, lv);
    if (tab === 'plates') { each(() => { c.strokeStyle = '#d14b42'; c.lineWidth = 2 * px; c.stroke(this.paths.plates[1]); c.strokeStyle = '#e09a37'; c.lineWidth = 1.7 * px; c.setLineDash([5 * px, 3 * px]); c.stroke(this.paths.plates[2]); c.setLineDash([]); c.strokeStyle = '#2f5b4f'; c.lineWidth = 2.4 * px; c.stroke(this.paths.plates[0]); }); this.drawPlateMarks(ks); }
    if (tab === 'season') {
      if (app.sx.pressure && this.paths.isobars[app.season]) each(() => { c.strokeStyle = 'rgba(90,100,120,.5)'; c.lineWidth = 0.9 * px; c.stroke(this.paths.isobars[app.season]); });
      if (app.sx.currents && this.d.currents) this.drawArrows(this.d.currents, 5, ks, true);
      if (app.sx.wind && this.d.winds) this.drawArrows(this.d.winds[app.season], 4, ks, false);
    }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (aux.grid || POL) this.drawGraticule(zr, POL);
    if (aux.polar) this.drawPolar();
    if (aux.landform && tab !== 'plates') this.drawSymbols(ks, zr);
    app.drawTools && app.drawTools(c, this, ks);
    this.drawLabels(ks, zr, lv);
    if (app.drawHistoryTop) app.drawHistoryTop(c, this, ks); // 历史时间线：摇篮与文明名称
    if (styled) { this.ctx = mainCtx; mainCtx.setTransform(1, 0, 0, 1, 0, 0); mainCtx.filter = VS.filter; mainCtx.drawImage(this.vcv, 0, 0); mainCtx.filter = 'none'; }
    this.drawDecor(mainCtx, this.app.aux.style || 'default');
    app.onViewChange && app.onViewChange();
    clearTimeout(this.tileTimer); this.tileTimer = setTimeout(() => this.updateTiles(), 90);
  };
  // 桥梁：在道路与河流的实际交点，沿道路方向画两道护栏；只在该级道路与该级河流都显示时出现
  MP.drawBridges = function (ks, lv) {
    const c = this.ctx, v = this.view, s = v.s;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.lineCap = 'butt';
    for (const [x, y, ang, imp, wcls, tier] of this.d.bridges) {
      if (!bridgeVisible(imp, lv) || (tier !== undefined && tier > lv)) continue;
      const len = 3.5 + (wcls || 0) * 0.9, wid = imp === 0 ? 2.6 : 2.1, ca = Math.cos(ang), sa = Math.sin(ang);
      for (const k of ks) { const sx = v.x + (x + k * this.W) * s, sy = v.y + y * s; if (sx < -8 || sy < -8 || sx > this.vw + 8 || sy > this.vh + 8) continue;
        c.beginPath(); c.moveTo(sx - ca * len, sy - sa * len); c.lineTo(sx + ca * len, sy + sa * len); c.lineWidth = wid * 2 + 1.6; c.strokeStyle = 'rgba(255,255,255,.9)'; c.stroke();
        c.lineWidth = 1; c.strokeStyle = '#4a3a2e';
        for (const sd of [-1, 1]) { const ox = -sa * wid * sd, oy = ca * wid * sd; c.beginPath(); c.moveTo(sx - ca * len + ox, sy - sa * len + oy); c.lineTo(sx + ca * len + ox, sy + sa * len + oy); c.stroke(); } }
    }
  };
  MP.drawArrows = function (arr, stride, ks, current) {
    const c = this.ctx, v = this.view, s = v.s;
    const minPx = current ? 40 : 46, lat = current ? 32 : 28, off = current ? 4.5 : 3.5;
    const step = Math.max(1, Math.ceil(minPx / (s * lat))), f = this.W / 544;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (let i = 0; i < arr.length; i += stride) {
      const gx = arr[i], gy = arr[i + 1], u = arr[i + 2], w = arr[i + 3];
      const ix = Math.round((gx / f - off) / (lat / 4)), iy = Math.round((gy / f - off) / (lat / 4));
      if (step > 1 && (ix % step || iy % step)) continue;
      const sp = Math.hypot(u, w); if (sp < 0.3) continue;
      for (const k of ks) {
        const sx = v.x + (gx + k * this.W) * s, sy = v.y + gy * s;
        if (sx < -20 || sy < -20 || sx > this.vw + 20 || sy > this.vh + 20) continue;
        const L = current ? 13 : Math.min(22, 5 + sp * 1.6), dx = u / sp, dy = -w / sp;
        const x1 = sx + dx * L / 2, y1 = sy + dy * L / 2;
        c.strokeStyle = current ? (arr[i + 4] > 0.3 ? '#d9534f' : arr[i + 4] < -0.3 ? '#2f7fc1' : '#7a8a96') : 'rgba(55,70,90,.72)';
        c.lineWidth = current ? 1.8 : 1.2;
        c.beginPath(); c.moveTo(sx - dx * L / 2, sy - dy * L / 2); c.lineTo(x1, y1);
        c.moveTo(x1, y1); c.lineTo(x1 - dx * 5 - dy * 3, y1 - dy * 5 + dx * 3); c.moveTo(x1, y1); c.lineTo(x1 - dx * 5 + dy * 3, y1 - dy * 5 - dx * 3); c.stroke();
      }
    }
    if (!current && this.app.sx.pressure && this.d.isobars && this.d.isobars[this.app.season]) {
      const ext = this.d.isobars[this.app.season].ext;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (let i = 0; i < ext.length; i += 4) for (const k of ks) {
        const sx = v.x + (ext[i] + k * this.W) * s, sy = v.y + ext[i + 1] * s; if (sx < 0 || sy < 0 || sx > this.vw || sy > this.vh) continue;
        const hi = ext[i + 2] > 0; c.font = `700 16px ${FONT}`; c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.85)'; c.strokeText(hi ? 'H' : 'L', sx, sy); c.fillStyle = hi ? '#2f6fb3' : '#c4473f'; c.fillText(hi ? 'H' : 'L', sx, sy);
        c.font = `500 10px ${FONT}`; c.fillStyle = '#4a5560'; c.fillText(Math.round(ext[i + 3]), sx, sy + 13);
      }
    }
  };
  MP.drawPlateMarks = function (ks) {
    const c = this.ctx, v = this.view, s = v.s, m = this.d.plateMarks;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const every = Math.max(1, Math.round(3 / Math.max(0.5, this.zoomRel()))); let n = 0;
    for (let i = 0; i < m.length; i += 6) {
      if ((n++ % every)) continue; const t = m[i + 4]; if (t === 2) continue;
      for (const k of ks) {
        const sx = v.x + (m[i] + k * this.W) * s, sy = v.y + m[i + 1] * s; if (sx < -10 || sy < -10 || sx > this.vw + 10 || sy > this.vh + 10) continue;
        const dx = m[i + 2], dy = m[i + 3];
        if (t === 0) { c.fillStyle = '#2f5b4f'; c.beginPath(); c.moveTo(sx - dy * 4, sy + dx * 4); c.lineTo(sx + dx * 6, sy + dy * 6); c.lineTo(sx + dy * 4, sy - dx * 4); c.fill(); }
        else { c.strokeStyle = '#d14b42'; c.lineWidth = 1.4; c.beginPath(); for (const sg of [1, -1]) { const ex = sx + dx * 9 * sg, ey = sy + dy * 9 * sg; c.moveTo(sx + dx * 3 * sg, sy + dy * 3 * sg); c.lineTo(ex, ey); c.moveTo(ex, ey); c.lineTo(ex - dx * 3 * sg - dy * 2.5, ey - dy * 3 * sg + dx * 2.5); c.moveTo(ex, ey); c.lineTo(ex - dx * 3 * sg + dy * 2.5, ey - dy * 3 * sg - dx * 2.5); } c.stroke(); }
      }
    }
  };
  MP.drawGraticule = function (zr, pol) {
    const c = this.ctx, v = this.view, s = v.s, W = this.W, H = this.H, step = zr > 6 ? 5 : zr > 2.5 ? 10 : 30;
    c.strokeStyle = pol ? 'rgba(70,140,200,.32)' : 'rgba(70,105,135,.22)'; c.lineWidth = pol ? 0.7 : 0.8; c.font = `10px ${FONT}`; c.fillStyle = pol ? 'rgba(60,110,160,.7)' : 'rgba(60,80,100,.65)';
    c.beginPath();
    for (let la = -90 + step; la < 90; la += step) { const y = v.y + (90 - la) / 180 * H * s; c.moveTo(0, y); c.lineTo(this.vw, y); }
    const x0 = Math.floor((-v.x / s) / W * 360 / step) * step;
    for (let lo = x0; ; lo += step) { const x = v.x + lo / 360 * W * s; if (x > this.vw) break; if (x >= 0) { c.moveTo(x, Math.max(0, v.y)); c.lineTo(x, Math.min(this.vh, v.y + H * s)); } }
    c.stroke(); c.textAlign = 'left'; c.textBaseline = 'bottom';
    for (let la = -90 + step; la < 90; la += step) { const y = v.y + (90 - la) / 180 * H * s; c.fillText(`${Math.abs(la)}°${la > 0 ? 'N' : la < 0 ? 'S' : ''}`, 6, y - 2); }
  };
  MP.drawPolar = function () {
    const c = this.ctx, v = this.view, s = v.s, H = this.H, tilt = this.d.cfg.tilt;
    const lines = [[0, '赤道', '0°'], [tilt, '北回归线', `${tilt}°N`], [-tilt, '南回归线', `${tilt}°S`], [90 - tilt, '北极圈', `${90 - tilt}°N`], [-(90 - tilt), '南极圈', `${90 - tilt}°S`]];
    c.setLineDash([6, 5]); c.lineWidth = 1; c.font = `10px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'bottom';
    for (const [la, name, deg] of lines) { const y = v.y + (90 - la) / 180 * H * s; if (y < 0 || y > this.vh) continue; c.strokeStyle = 'rgba(80,110,140,.42)'; c.beginPath(); c.moveTo(0, y); c.lineTo(this.vw, y); c.stroke(); c.fillStyle = 'rgba(60,80,100,.75)'; c.fillText(`${deg} ${name}`, 8, y - 2); }
    c.setLineDash([]); c.textAlign = 'center'; c.fillStyle = 'rgba(60,80,100,.75)';
    const ty = v.y + 3, by = v.y + H * s - 3;
    if (ty > -10) { c.textBaseline = 'top'; c.fillText('90°N 北极点（地图上边缘即极点）', this.vw / 2, ty); }
    if (by < this.vh + 10) { c.textBaseline = 'bottom'; c.fillText('90°S 南极点（地图下边缘即极点）', this.vw / 2, by); }
  };
  MP.drawSymbols = function (ks, zr) {
    if (zr < 1.2) return;
    const c = this.ctx, v = this.view, s = v.s;
    for (const [t, gx, gy] of this.d.symbols) for (const k of ks) {
      const sx = v.x + (gx + k * this.W) * s, sy = v.y + gy * s; if (sx < -8 || sy < -8 || sx > this.vw + 8 || sy > this.vh + 8) continue;
      if (t === 'volcano') { c.fillStyle = '#c4473f'; c.beginPath(); c.moveTo(sx, sy - 5); c.lineTo(sx + 4.5, sy + 3); c.lineTo(sx - 4.5, sy + 3); c.fill(); }
    }
  };

  // ---------- 注记：原版优先级 + 屏幕避让 ----------
  MP.drawLabels = function (ks, zr, lv) {
    const c = this.ctx, v = this.view, s = v.s, d = this.d, app = this.app, aux = app.aux, tab = app.tab, topic = app.topic();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const boxes = (app.toolBoxes ? app.toolBoxes() : []).slice();
    const free = (x0, y0, x1, y1) => { for (const b of boxes) if (x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]) return false; boxes.push([x0, y0, x1, y1]); return true; };
    const onScreen = (sx, sy, m = 40) => sx > -m && sy > -m && sx < this.vw + m && sy < this.vh + m;
    const items = []; // [priority, kind, payload, id]
    this.hits = []; this.cityDots = []; this.heritageDots = []; const N_ = (id, def) => app.nameOf ? app.nameOf(id, def) : def;
    const human = tab === 'human', polTopic = human && POLITICAL_TOPIC[topic], showStates = aux.borders || polTopic || (!!(VSTYLE[aux.style] || {}).political && topic === 'terrain'); // 政区风格只在地形底图上自带国名
    if (tab === 'plates') d.plates.forEach((p, i) => items.push([5, 'plate', p, 'plate:' + i]));
    // 专题注记：本专题的类别直接写在对应区域里，优先级最高
    const zones = d.zones && (tab === 'geo' || tab === 'human') && d.zones[topic];
    if (zones && app.zoneText) zones.forEach((z, i) => items.push([(topic === 'govern' ? 16 : 8 + Math.min(1, 40 / (z.n + 40))) + (z.sub ? 2.5 : 0), 'zone', z, 'zone:' + topic + ':' + i]));
    if (showStates && tab !== 'plates') {
      d.countries.forEach((k, i) => { if (k.lx !== undefined) items.push([10, 'state', k, 'country:' + i]); });
      if (polTopic && (topic === 'province' || lv >= 2)) d.provinces.forEach((p, i) => items.push([topic === 'province' ? 11 : 12, 'province', p, 'province:' + i]));
    }
    if (human && (topic === 'country' || topic === 'govern' || topic === 'system')) d.tribes.forEach((t, i) => items.push([18, 'tribe', t, 'tribe:' + i]));
    if (human && (topic === 'country' || topic === 'govern' || topic === 'system' || topic === 'province') && lv >= 1) (d.jimis || []).forEach((t, i) => items.push([19, 'jimi', t, 'jimi:' + i]));
    if (aux.names && tab !== 'plates') {
      // 地理名称分级：全图只有大洋、大陆、主要山脉与大片高原平原盆地；放大后出现海、湾、半岛、湖、雪山；再放大山脉让位给具体山峰与海拔
      for (let li = 0; li < d.labels.length; li++) {
        const l = d.labels[li], t = l.type;
        const major = t === 'ocean' || t === 'continent' || (t === 'range' && l.size > 120) || (AREA_MAJOR[t] && l.size >= AREA_MAJOR[t]);
        let minLv = major ? 0 : 1, maxLv = 9;
        if (t === 'continent') maxLv = 1;
        if (t === 'range') { minLv = l.size > 120 ? 0 : 1; maxLv = l.ridge ? 9 : 2; }
        if (t === 'ridge') minLv = 2;
        if (t === 'hills') minLv = l.size > 60 ? 1 : 2;
        if (t === 'bay') minLv = l.size >= 100 ? 1 : 2;
        if (t === 'peninsula') minLv = l.size >= 60 ? 1 : 2;
        if (t === 'peak') minLv = l.rank < 24 ? 1 : 2;
        if (t === 'snow') minLv = 1;
        if (t === 'island') minLv = l.size >= 30 || l.arch && l.size >= 12 ? 1 : 2;
        if (lv < minLv || lv > maxLv) continue;
        const pr = major ? 20 + ({ ocean: 0, continent: 0, range: 1, plateau: 2, basin: 2, plain: 3 }[t] || 0)
          : 40 + ({ sea: 0, range: lv >= 3 ? 4 : 1, ridge: 4.5, hills: 5, snow: 1.5, plateau: 2, basin: 2, plain: 2.5, bay: 3, peninsula: 3, lake: 4, peak: 5 + Math.min(4, (l.rank || 0) / 40), island: 6 }[t] ?? 7);
        items.push([pr, 'geo', l, 'label:' + li]);
      }
      // 河名：每一级河流在它显示出来的那一级起就有名字（全图不注河名）
      const bigKm = 2 * Math.PI * d.cfg.radius * 0.02;
      if (aux.rivers && lv >= 1) d.riverNames.forEach((r, k) => { const t = r.tier === undefined ? (r.minor ? 3 : 0) : r.tier; if (lv >= Math.max(1, t) && (t !== 1 || lv >= 2 || (r.km || 0) >= bigKm)) items.push([43 + t * 1.5 - Math.min(1, (r.km || 0) / 4000), 'river', r, 'river:' + k]); });
    }
    if (aux.cities && tab !== 'plates') d.cities.forEach((ct, ci) => {
      const cap = ct.capital !== undefined;
      const fortOk = ct.role === 'military-post' && (lv >= 2 || (lv >= 1 && (ct.gate === 'trunk' || ct.type === 'pass-fort')));
      const ok = fortOk || cap || ct.tier === 'metropolis' || (lv >= 1 && ct.tier === 'city') || (lv >= 2 && ct.tier === 'town' && ct.pop >= 2000) || lv >= 3 || (ct.seat !== undefined && topic === 'province' && lv >= 1);
      if (!ok) return;
      items.push([cap ? 30 : ct.tier === 'metropolis' ? 31 : ct.tier === 'city' ? 50 : ct.tier === 'site' ? 65 : ct.pop >= 2000 ? 60 : 75, 'city', ct, 'city:' + ci]);
    });
    if (human && topic === 'heritage' && d.heritage) { const on = app.herCat || { religious: 1, war: 1, culture: 1 }; d.heritage.forEach((o, i) => { if (!on[o.cat]) return; if (o.imp < 2 && lv < 1) return; items.push([o.imp >= 3 ? 22 : o.imp === 2 ? 34 : 55, 'heritage', o, 'heritage:' + i]); }); }
    items.sort((a, b) => a[0] - b[0] || (b[2].pop || b[2].size || 0) - (a[2].pop || a[2].size || 0));
    const PH = this.vw < 600, LS = PH ? 1.12 : 1, LP = PH ? 4 : 2; // 手机：标注放大 12%、避让间距加倍，字更清楚、不挤
    const text = (str, sx, sy, o) => {
      o = PH ? { ...o, size: o.size * LS } : o;
      c.font = `${o.weight || 500} ${o.size}px ${FONT}`;
      if ('letterSpacing' in c) c.letterSpacing = (o.ls || 0) + 'px';
      const w = c.measureText(str).width, h = o.size, ang = o.angle || 0;
      const bw = Math.abs(Math.cos(ang)) * w + Math.abs(Math.sin(ang)) * h, bh = Math.abs(Math.sin(ang)) * w + Math.abs(Math.cos(ang)) * h;
      const left = o.align === 'left';
      const bx0 = sx - (left ? 0 : bw / 2) - LP, by0 = sy - bh / 2 - LP, bx1 = sx + (left ? bw : bw / 2) + LP, by1 = sy + bh / 2 + LP;
      if (!free(bx0, by0, bx1, by1)) { if ('letterSpacing' in c) c.letterSpacing = '0px'; return false; }
      if (o.id) this.hits.push({ id: o.id, box: [bx0, by0, bx1, by1], name: str, x: sx, y: sy });
      c.save(); c.translate(sx, sy); c.rotate(ang); c.textAlign = left ? 'left' : 'center'; c.textBaseline = 'middle';
      c.lineJoin = 'round'; c.lineWidth = o.halo || 3; c.strokeStyle = o.haloColor || 'rgba(255,255,255,.88)'; c.strokeText(str, 0, 0); c.fillStyle = o.color; c.fillText(str, 0, 0); c.restore();
      if ('letterSpacing' in c) c.letterSpacing = '0px';
      return true;
    };
    const each = (gx, gy, fn) => { for (const k of ks) { const sx = v.x + (gx + k * this.W) * s, sy = v.y + gy * s; if (onScreen(sx, sy)) fn(sx, sy); } };
    // 沿线排字：河名沿河道、山名沿山脊。逐字取路径切线方向，保持从左往右读；弯得太急或被别的注记占住就换位置
    const fits = (bx) => { for (const b of boxes) if (bx[0] < b[2] && bx[2] > b[0] && bx[1] < b[3] && bx[3] > b[1]) return false; return true; };
    const pathText = (str, gpts, o) => {
      const chars = [...str], n = chars.length; if (!n) return 0;
      const size = o.size * (PH ? LS : 1); c.font = `${o.weight || 500} ${size}px ${FONT}`;
      let cw = null, tw = 0; const measure = () => { if (!cw) { cw = chars.map(ch => c.measureText(ch).width); tw = cw.reduce((a, b) => a + b, 0); } };
      let placed = 0;
      // 外包框粗筛：整条线都不在视口里就不逐点换算
      this.bbCache = this.bbCache || new WeakMap(); let bb = this.bbCache.get(gpts);
      if (!bb) { bb = [1e9, 1e9, -1e9, -1e9]; for (let i = 0; i < gpts.length; i += 2) { if (gpts[i] < bb[0]) bb[0] = gpts[i]; if (gpts[i] > bb[2]) bb[2] = gpts[i]; if (gpts[i + 1] < bb[1]) bb[1] = gpts[i + 1]; if (gpts[i + 1] > bb[3]) bb[3] = gpts[i + 1]; } this.bbCache.set(gpts, bb); }
      for (const k of ks) {
        if (v.x + (bb[2] + k * this.W) * s < -20 || v.x + (bb[0] + k * this.W) * s > this.vw + 20 || v.y + bb[3] * s < -20 || v.y + bb[1] * s > this.vh + 20) continue;
        // 屏幕坐标下、视口内（含边距）的最长连续一段
        const P = []; let run = [], best = [];
        for (let i = 0; i < gpts.length; i += 2) { const sx = v.x + (gpts[i] + k * this.W) * s, sy = v.y + gpts[i + 1] * s;
          if (sx > -20 && sy > -20 && sx < this.vw + 20 && sy < this.vh + 20) { const q = run[run.length - 1]; if (!q || Math.hypot(sx - q[0], sy - q[1]) > 1.2) run.push([sx, sy]); } else { if (run.length > best.length) best = run; run = []; } }
        if (run.length > best.length) best = run;
        if (best.length < 2) continue;
        { // 按字号等距重采样并滑动平均：注记沿“抹平了小河曲”的走向排，不被每个小弯打断
          const c0 = [0]; for (let i = 1; i < best.length; i++) c0.push(c0[i - 1] + Math.hypot(best[i][0] - best[i - 1][0], best[i][1] - best[i - 1][1]));
          const L0 = c0[c0.length - 1], step = Math.max(2, size * 0.5), rs = []; let j = 0;
          for (let dd = 0; dd <= L0; dd += step) { while (j < c0.length - 2 && c0[j + 1] < dd) j++; const t = (dd - c0[j]) / Math.max(1e-6, c0[j + 1] - c0[j]); rs.push([best[j][0] + (best[j + 1][0] - best[j][0]) * t, best[j][1] + (best[j + 1][1] - best[j][1]) * t]); }
          const K = Math.max(1, Math.round(size * o.smooth / step)); if (rs.length > 2 * K + 1) best = rs.map((p, i) => { if (i < K || i >= rs.length - K) return p; let sx = 0, sy = 0; for (let q = -K; q <= K; q++) { sx += rs[i + q][0]; sy += rs[i + q][1]; } return [sx / (2 * K + 1), sy / (2 * K + 1)]; }); }
        const cum = [0]; for (let i = 1; i < best.length; i++) cum.push(cum[i - 1] + Math.hypot(best[i][0] - best[i - 1][0], best[i][1] - best[i - 1][1]));
        const L = cum[cum.length - 1]; measure();
        const gap = n > 1 ? Math.max(o.minGap * size, Math.min(o.maxGap * size, (L * o.fill - tw) / (n - 1))) : 0, span = tw + gap * (n - 1);
        if (span > L * 0.92) continue;
        const at = (d) => { d = Math.max(0, Math.min(L, d)); let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= d) lo = m; else hi = m; } const t = (d - cum[lo]) / Math.max(1e-6, cum[hi] - cum[lo]); return [best[lo][0] + (best[hi][0] - best[lo][0]) * t, best[lo][1] + (best[hi][1] - best[lo][1]) * t]; };
        const tries = o.repeat && L > span * 4.5 ? [0.25, 0.75, 0.5, 0.15, 0.85, 0.35, 0.65] : [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9];
        let got = 0; const used = [];
        for (const f of tries) {
          if (got >= (o.repeat && L > span * 4.5 ? 2 : 1)) break;
          const d0 = L * f - span / 2; if (d0 < 0 || d0 + span > L) continue;
          if (used.some(u => Math.abs(u - L * f) < span * 1.6)) continue;
          const a0 = at(d0), a1 = at(d0 + span), steep = Math.abs(a1[1] - a0[1]) > Math.abs(a1[0] - a0[0]) * 1.4, rev = steep ? a1[1] < a0[1] : a1[0] < a0[0]; // 横向从左往右读，竖向从上往下读
          const glyph = []; let pos = 0, ok = true, prevAng = null;
          for (let j = 0; j < n; j++) {
            const jj = rev ? n - 1 - j : j, mid = rev ? d0 + span - (pos + cw[jj] / 2) : d0 + pos + cw[jj] / 2, h = Math.max(size * 0.7, 3);
            const p0 = at(mid - h), p1 = at(mid + h); let ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]); if (rev) ang += Math.PI;
            while (ang > Math.PI / 2) ang -= Math.PI; while (ang < -Math.PI / 2) ang += Math.PI; ang = Math.max(-o.tilt, Math.min(o.tilt, ang)); // 字头朝上：陡处字不躺倒，沿线竖排
            if (prevAng !== null) { let da = ang - prevAng; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; if (Math.abs(da) > o.maxTurn) { ok = false; break; } }
            prevAng = ang; let [x, y] = at(mid);
            if (o.offset) { const tx = p1[0] - p0[0], ty = p1[1] - p0[1], tl = Math.hypot(tx, ty) || 1; let nx = ty / tl, ny = -tx / tl; if (ny > 0 || (Math.abs(ny) < 0.2 && nx < 0)) { nx = -nx; ny = -ny; } x += nx * o.offset * size; y += ny * o.offset * size; } // 河名放在河道上方（竖向河段放右侧）
            const r = size * 0.62; const bx = [x - r, y - r, x + r, y + r]; if (!fits(bx)) { ok = false; break; }
            glyph.push([chars[jj], x, y, ang, bx]); pos += cw[jj] + gap;
          }
          if (!ok) continue;
          // 读序：rev 时 glyph 是从右往左算的，绘制顺序无关
          let ux0 = 1e9, uy0 = 1e9, ux1 = -1e9, uy1 = -1e9;
          for (const g of glyph) { boxes.push(g[4]); ux0 = Math.min(ux0, g[4][0]); uy0 = Math.min(uy0, g[4][1]); ux1 = Math.max(ux1, g[4][2]); uy1 = Math.max(uy1, g[4][3]); }
          if (o.id) this.hits.push({ id: o.id, box: [ux0, uy0, ux1, uy1], name: str, x: (ux0 + ux1) / 2, y: (uy0 + uy1) / 2 });
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
          for (const [ch, x, y, ang] of glyph) { c.save(); c.translate(x, y); c.rotate(ang); c.lineWidth = o.halo || 3; c.strokeStyle = o.haloColor || 'rgba(255,255,255,.88)'; c.strokeText(ch, 0, 0); c.fillStyle = o.color; c.fillText(ch, 0, 0); c.restore(); }
          used.push(L * f); got++; placed++;
        }
      }
      return placed;
    };
    const stemPath = (st) => { this.stemCache = this.stemCache || new Map(); if (this.stemCache.has(st)) return this.stemCache.get(st);
      const RV = d.rivers, S = RV.stems && RV.stems[st]; if (!S) return null; const out = []; let x0 = null;
      for (let j = S.r.length - 1; j >= 0; j--) { const r = S.r[j]; for (let k = RV.offs[r]; k < RV.offs[r + 1]; k++) { let x = RV.pts[k * 7]; const y = RV.pts[k * 7 + 1]; if (x0 !== null) { while (x - x0 > this.W / 2) x -= this.W; while (x0 - x > this.W / 2) x += this.W; } x0 = x; out.push(x, y); } }
      this.stemCache.set(st, out); return out; };
    const zoneSeen = new Map();
    const ZONE_FONT = (z) => Math.max(11, Math.min(26, 2 * z.d * s * 0.42));
    for (const [pr, kind, o, id] of items) {
      if (kind === 'plate') each(o.x, o.y, (sx, sy) => {
        if (!text(N_(id, o.name), sx, sy, { size: 14, weight: 700, color: '#2a3a46', id })) return;
        c.font = `11px ${FONT}`; c.fillStyle = '#4a5965'; c.textAlign = 'center'; c.fillText(`运动 ${o.speed.toFixed(1)} cm/年`, sx, sy + 15);
        const sp = Math.hypot(o.ve, o.vn) || 1, dx = o.ve / sp, dy = -o.vn / sp;
        c.strokeStyle = '#2a3a46'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx - dx * 16, sy + 32 - dy * 16); c.lineTo(sx + dx * 16, sy + 32 + dy * 16);
        c.moveTo(sx + dx * 16, sy + 32 + dy * 16); c.lineTo(sx + dx * 9 - dy * 5, sy + 32 + dy * 9 + dx * 5); c.moveTo(sx + dx * 16, sy + 32 + dy * 16); c.lineTo(sx + dx * 9 + dy * 5, sy + 32 + dy * 9 - dx * 5); c.stroke();
        boxes.push([sx - 20, sy + 15, sx + 20, sy + 50]);
      });
      else if (kind === 'state') { const pxs = (o.lsize || 1) * 2 * s; if (pxs < 14) continue; const size = Math.max(11, Math.min(18, 9 + pxs / 9)); each(o.lx, o.ly, (sx, sy) => text(app.names && app.names[id] ? app.names[id] : (lv >= 1 || pxs > 60 ? o.name : o.short), sx, sy, { size, weight: 700, color: '#3f3a36', ls: 2, id })); }
      else if (kind === 'province') {
        if (o.lx !== undefined) { const pxs = (o.lsize || 1) * s; if (pxs < 9) continue; const size = Math.max(10.5, Math.min(14, 9 + pxs / 10)); each(o.lx, o.ly, (sx, sy) => text(N_(id, o.name), sx, sy, { size, weight: 600, color: '#5c4f46', ls: 2, id })); }
        else { const ct = d.cities[o.seat]; if (ct) each(ct.x, ct.y + 12 / s, (sx, sy) => text(N_(id, o.name), sx, sy, { size: 10.5, color: '#6a5f58', ls: 1, id })); } }
      else if (kind === 'tribe') { if (o.size * 4 * s * s < 700) continue; each(o.x, o.y, (sx, sy) => text(N_(id, o.name), sx, sy, { size: 11.5, color: '#8a6a4a', ls: 2, weight: 500, id })); }
      else if (kind === 'jimi') { if (o.size * 4 * s * s < 500) continue; each(o.x, o.y, (sx, sy) => text(N_(id, o.name), sx, sy, { size: 11, color: '#7a6a8a', ls: 1, weight: 500, id })); }
      else if (kind === 'geo') {
        const l = o, nm = N_(id, l.name);
        if (l.type === 'ocean') each(l.x, l.y, (sx, sy) => text(nm, sx, sy, { size: 16, color: '#5f88a8', ls: 4, id }));
        else if (l.type === 'sea') each(l.x, l.y, (sx, sy) => text(nm, sx, sy, { size: 12, color: '#6a93b3', ls: 2, id }));
        else if (l.type === 'continent') each(l.x, l.y, (sx, sy) => text(nm, sx, sy, { size: 15, weight: 600, color: 'rgba(80,90,70,.75)', ls: 6, id }));
        else if (l.type === 'island') each(l.x, l.y, (sx, sy) => text(nm, sx, sy, { size: 11, color: '#5a6550', id }));
        else if (l.type === 'lake') each(l.x, l.y, (sx, sy) => text(nm, sx, sy, { size: 11, color: '#3f7fb0', id }));
        else if (l.type === 'plain' || l.type === 'plateau' && l.len === undefined || l.type === 'basin') {
          const col = { plain: 'rgba(92,112,68,.9)', plateau: 'rgba(132,96,64,.92)', basin: 'rgba(112,96,70,.92)' }[l.type], big = l.size >= (AREA_MAJOR[l.type] || 1e9);
          each(l.x, l.y, (sx, sy) => text(nm, sx, sy, { size: big ? 13.5 : 12, weight: 600, color: col, ls: big ? 5 : 3, id })); }
        else if (l.type === 'peninsula') each(l.x, l.y, (sx, sy) => text(nm, sx, sy, { size: 11.5, weight: 600, color: '#5e6852', ls: 2, id }));
        else if (l.type === 'bay') each(l.x, l.y, (sx, sy) => text(nm, sx, sy, { size: 11.5, weight: 'italic 500', color: '#4b7fa6', ls: 1, id }));
        else if (l.type === 'peak' || l.type === 'snow') each(l.x, l.y, (sx, sy) => {
          const snow = l.type === 'snow';
          if (!text(nm, sx + 6, sy - 6, { size: snow ? 11.5 : 11, weight: snow ? 600 : 500, color: snow ? '#4e7896' : '#6b4f3a', align: 'left', id })) return;
          c.beginPath(); c.moveTo(sx, sy - 4.5); c.lineTo(sx + 4.2, sy + 3); c.lineTo(sx - 4.2, sy + 3); c.closePath(); c.fillStyle = snow ? '#ffffff' : '#7a5a44'; c.fill(); c.lineWidth = 1; c.strokeStyle = snow ? '#5f86a3' : 'rgba(255,255,255,.9)'; c.stroke();
          if (l.h) text(l.h.toLocaleString() + ' m', sx + 6, sy + 9, { size: 9.5, weight: 500, color: snow ? '#5f86a3' : '#7d6a5a', align: 'left' }); });
        else if ((l.type === 'range' || l.type === 'ridge' || l.type === 'hills') && l.ridge && pathText(nm, l.ridge, { size: l.type === 'range' ? (l.size > 120 ? 14 : 13) : l.type === 'ridge' ? 12 : 11.5, weight: 600, color: l.type === 'hills' ? '#7d6a4e' : '#8a6446', minGap: 0.35, maxGap: 2.6, fill: 0.62, maxTurn: 0.6, tilt: 0.8, smooth: 1.6, id })) { /* 已沿山脊排字 */ }
        else if (l.type === 'ridge' || l.type === 'hills') continue;
        else { const len = l.len * s; if (len < 40 && lv < 1) continue; let a = l.angle; if (Math.cos(a) < 0) a += Math.PI; if (a > Math.PI / 2) a -= Math.PI; if (l.type === 'plateau' || len < 70) a = 0; each(l.x, l.y, (sx, sy) => text(nm, sx, sy, { size: 13, weight: 600, color: '#8a6446', ls: 3, angle: a * 0.85, id })); }
      }
      else if (kind === 'river') {
        const gp = o.stem !== undefined ? stemPath(o.stem) : null, t = o.tier === undefined ? 0 : o.tier;
        if (gp) pathText(N_(id, o.name), gp, { size: t === 0 ? 12 : t === 1 ? 11.5 : 11, weight: t === 0 ? 600 : 500, color: '#2f72a8', minGap: 0.25, maxGap: 1.4, fill: 0.3, maxTurn: 0.7, tilt: 0.8, offset: 0.75, smooth: 1.4, repeat: lv >= 2, id });
        else if (!o.minor) each(o.x, o.y, (sx, sy) => text(N_(id, o.name), sx + 10, sy - 10, { size: 11, color: '#3f7fb0', ls: 1, id }));
      }
      else if (kind === 'zone') {
        const [nm, sub, col, rid] = app.zoneText(topic, o); if (!nm) continue;
        let size = ZONE_FONT(o); const diam = 2 * 2 * o.d * s;
        let ang = 0, room = diam * 1.25; if (o.el > 1.7) { ang = o.a; if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI; ang = Math.max(-0.6, Math.min(0.6, ang)); room = diam * Math.min(2.6, o.el * 0.9); }
        const nch = [...nm].length; c.font = `700 ${size}px ${FONT}`; let w = c.measureText(nm).width;
        if (w > room) { size = Math.max(11, size * room / w); c.font = `700 ${size}px ${FONT}`; w = c.measureText(nm).width; }
        if (w > room * 1.15 || 2 * o.d * s < 7) continue;
        const ls = nch > 1 ? Math.max(1, Math.min(size * 0.9, (room * 0.7 - w) / (nch - 1))) : 0;
        const half = (w + ls * (nch - 1)) / 2 * Math.abs(Math.cos(ang)) + size;
        const zkey = topic + ':' + o.c, sep = Math.max(160, w * 2.2);
        each(o.x, o.y, (sx, sy) => { if (sx - half < 0 || sx + half > this.vw || sy < size || sy > this.vh - size) return;
          if ((sx + half > this.vw - 70 && sy > this.vh - 190) || (sx - half < 320 && sy > this.vh - 100)) return; // 不压在缩放按钮、图层与图例按钮下
          if (o.sub && zoneSeen.has('g' + o.g)) return; // 分块锚点只在这片区域还没有任何注记时补上一个
          const near = zoneSeen.get(zkey); if (near && near.some(([px2, py2]) => Math.hypot(px2 - sx, py2 - sy) < sep)) return; // 同一类别相隔太近只写一次
          const ok = text(nm, sx, sy, { size, weight: 700, color: col || '#33302c', ls, angle: ang, halo: 3.5, id: rid });
          if (ok) { if (!zoneSeen.has(zkey)) zoneSeen.set(zkey, []); zoneSeen.get(zkey).push([sx, sy]); zoneSeen.set('g' + o.g, 1); }
          if (ok && sub && size >= 12.5) text(sub, sx - Math.sin(ang) * size * 1.05, sy + Math.cos(ang) * size * 1.05, { size: Math.max(9.5, size * 0.6), weight: 500, color: col || '#5a544c', ls: 0.5, angle: ang, halo: 3 }); });
      }
      else if (kind === 'city') each(o.x, o.y, (sx, sy) => this.drawCity(o, sx, sy, free, lv, true, id, N_(id, o.name)));
      else if (kind === 'heritage') each(o.x, o.y, (sx, sy) => this.drawHeritage(o, sx, sy, free, lv, id, N_(id, o.name), text));
    }
  };
  // 遗迹徽章：按类别着色（宗教紫、战争红、人文褐），中间一个字标明种类
  const HER_COL = { religious: '#6b3fa0', war: '#a8322a', culture: '#8a6a2e' };
  // 遗迹图标与城市符号：与历史时间线共用 app/icons.js
  const HER_ICON = G.MapIcons.GLYPH;
  const herKey = o => o.cat === 'war' && o.kind === 'ruin' ? 'burned' : o.kind;
  const herSvg = (k, col, size = 20) => G.MapIcons.svgBadge(k, col, size);
  MapView.HER_COL = HER_COL; MapView.HER_ICON = HER_ICON; MapView.herKey = herKey; MapView.herSvg = herSvg;
  MP.drawHeritage = function (o, sx, sy, free, lv, id, label, text) {
    const c = this.ctx, R = o.imp >= 3 ? 10 : 8.5; if (!free(sx - R, sy - R, sx + R, sy + R)) return;
    this.heritageDots.push({ i: +id.split(':')[1], x: sx, y: sy });
    G.MapIcons.drawBadge(c, sx, sy, herKey(o), HER_COL[o.cat], R);
    if (o.imp >= 2 || lv >= 2) text(label, sx + R + 4, sy, { size: o.imp >= 3 ? 12 : 11, weight: 600, color: HER_COL[o.cat] || '#444', align: 'left', id });
  };
  MP.heritageAt = function (sx, sy) { let best = -1, bd = 12; for (const d of this.heritageDots || []) { const dd = Math.hypot(d.x - sx, d.y - sy); if (dd < bd) { bd = dd; best = d.i; } } return best; };
  MP.drawCity = function (ct, sx, sy, free, lv, names, id, label) {
    const c = this.ctx, cap = ct.capital !== undefined;
    const R0 = G.MapIcons.R0, r = cap ? R0.capital : ct.tier === 'metropolis' ? R0.metro : ct.tier === 'city' ? R0.city : ct.tier === 'site' ? R0.site : R0.town;
    if (!free(sx - r - 1, sy - r - 1, sx + r + 1, sy + r + 1)) return;
    this.cityDots.push({ id, x: sx, y: sy });
    if (ct.role === 'military-post') { // 原版图式：要塞＝城垛方块，关隘＝带门洞的关楼
      const k = 4.2; G.MapIcons.drawFort(c, sx, sy, ct.type, k);
      if (names) { c.font = `600 11px ${FONT}`; const w = c.measureText(label).width; for (const dx of [k + 4, -(k + 4) - w]) if (free(sx + dx - 1, sy - 8, sx + dx + w + 1, sy + 8)) { this.hits.push({ id, box: [sx + dx - 1, sy - 8, sx + dx + w + 1, sy + 8], name: label, x: sx + dx + w / 2, y: sy });
        c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)'; c.strokeText(label, sx + dx, sy); c.fillStyle = '#5a3f30'; c.fillText(label, sx + dx, sy); break; } }
      return;
    }
    if (names) {
      const size = cap ? 13 : ct.tier === 'metropolis' ? 12.5 : ct.tier === 'city' ? 12 : 11;
      c.font = `${cap || ct.tier === 'metropolis' ? 600 : 500} ${size}px ${FONT}`;
      const w = c.measureText(label).width;
      for (const dx of [r + 4, -(r + 4) - w]) if (free(sx + dx - 1, sy - size / 2 - 2, sx + dx + w + 1, sy + size / 2 + 2)) {
        this.hits.push({ id, box: [sx + dx - 1, sy - size / 2 - 2, sx + dx + w + 1, sy + size / 2 + 2], name: label, x: sx + dx + w / 2, y: sy });
        c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineJoin = 'round';
        c.strokeText(label, sx + dx, sy); c.fillStyle = cap ? '#14191e' : ct.tier === 'site' ? '#5a3f30' : '#2b343c'; c.fillText(label, sx + dx, sy); break;
      }
    }
    const kind = cap ? 'capital' : ct.tier === 'site' ? 'site' : ct.tier === 'metropolis' ? 'metro' : ct.tier === 'city' ? 'city' : 'town';
    G.MapIcons.drawCity(c, sx, sy, kind, { r, sel: G.City && G.City.current !== null && id === 'city:' + G.City.current });
    if (ct.holy && ct.holy.length) G.MapIcons.drawHoly(c, sx - r - 4, sy - r - 4); // 圣城：紫色四角星
  };

  // ---------- 相机手势（原版：滚轮累积、捏合、惯性、键盘） ----------
  MP.bindInput = function () {
    const cv = this.cv, ptrs = new Map(), samples = [];
    let moved = false, multi = false, downAt = null, wheelExp = 0, wheelXY = [0, 0], wheelFrame = 0, wheelCommit = 0;
    const commit = () => this.scheduleFrame();
    const record = () => { const t = performance.now(); samples.push([t, this.view.x, this.view.y]); while (samples.length && t - samples[0][0] > 160) samples.shift(); };
    const coast = () => {
      if (samples.length < 2) return false; const t = performance.now(); while (samples.length && t - samples[0][0] > 160) samples.shift(); if (samples.length < 2) return false;
      let first = Math.max(0, samples.length - 2); while (first > 0 && samples[first - 1][0] >= t - 60) first--;
      const [t0, x0, y0] = samples[first], dx = this.view.x - x0, dy = this.view.y - y0, dist = Math.hypot(dx, dy), el = t - t0;
      if (el <= 0 || dist < 1) return false;
      const speed = Math.min(1400, dist * 0.3 / (el / 1000)), secs = speed / (2500 * 0.3), travel = speed * secs / 2; if (travel < 1) return false;
      const sx = this.view.x, sy = this.view.y, st = performance.now();
      const step = now => { const p = Math.min(1, (now - st) / (secs * 1000)), amt = travel * (2 * p - p * p) / dist; this.view.x = sx + dx * amt; this.view.y = sy + dy * amt; this.clamp(); this.draw(); if (p < 1) this.motion = requestAnimationFrame(step); else { this.motion = 0; commit(); } };
      this.motion = requestAnimationFrame(step); return true;
    };
    cv.addEventListener('pointerdown', e => {
      this.stopMotion(); cv.setPointerCapture(e.pointerId);
      if (!ptrs.size) { moved = false; multi = false; samples.length = 0; record(); downAt = [e.offsetX, e.offsetY]; }
      ptrs.set(e.pointerId, [e.offsetX, e.offsetY, e.offsetX, e.offsetY]); if (ptrs.size > 1) multi = true;
      cv.focus({ preventScroll: true });
    });
    const gesture = () => { const p = [...ptrs.values()].slice(0, 2); if (p.length === 1) return [p[0][0], p[0][1], 0]; return [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2, Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1])]; };
    cv.addEventListener('pointermove', e => {
      const p = ptrs.get(e.pointerId);
      if (!p) { cv.style.cursor = !this.app.tool && this.cityAt(e.offsetX, e.offsetY) ? 'pointer' : ''; this.app.onHover && this.app.onHover(e); return; }
      const before = gesture(); p[0] = e.offsetX; p[1] = e.offsetY; const after = gesture();
      if (Math.hypot(e.offsetX - p[2], e.offsetY - p[3]) > 5) moved = true;
      if (!moved && !multi) return;
      cv.classList.add('dragging');
      const ratio = before[2] > 0 && after[2] > 0 ? after[2] / before[2] : 1;
      const ns = Math.min(this.maxScale(), Math.max(this.minScale(), this.view.s * ratio));
      const gx = (before[0] - this.view.x) / this.view.s, gy = (before[1] - this.view.y) / this.view.s;
      this.view.s = ns; this.view.x = after[0] - gx * ns; this.view.y = after[1] - gy * ns; this.clamp(); this.draw();
      if (!multi) record();
      this.app.onHover && this.app.onHover(null);
    });
    const up = e => {
      if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (ptrs.size) return;
      cv.classList.remove('dragging');
      if (!(e.type === 'pointerup' && moved && !multi && coast())) commit();
      if (e.type === 'pointerup' && !moved && !multi && downAt && this.d) { const [gx, gy] = this.toGrid(downAt[0], downAt[1]); this.app.onMapClick && this.app.onMapClick(gx, gy, downAt[0], downAt[1], e); }
      samples.length = 0;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => this.app.onHover && this.app.onHover(null));
    cv.addEventListener('wheel', e => {
      e.preventDefault(); this.stopMotion();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.vh : 1;
      wheelExp -= Math.max(-240, Math.min(240, e.deltaY * unit)) * (e.ctrlKey ? 0.01 : 0.0025);
      wheelXY = [e.offsetX, e.offsetY];
      if (!wheelFrame) wheelFrame = requestAnimationFrame(() => { wheelFrame = 0; const f = Math.exp(Math.max(-Math.log(4), Math.min(Math.log(4), wheelExp))); wheelExp = 0; this.setScaleAt(this.view.s * f, wheelXY[0], wheelXY[1]); });
      clearTimeout(wheelCommit); wheelCommit = setTimeout(commit, 140);
    }, { passive: false });
    cv.addEventListener('dblclick', e => {
      if (this.app.tool === 'measure') return; e.preventDefault();
      const hit = (this.hits || []).slice().reverse().find(h => e.offsetX >= h.box[0] - 3 && e.offsetX <= h.box[2] + 3 && e.offsetY >= h.box[1] - 3 && e.offsetY <= h.box[3] + 3);
      if (hit && this.app.onRename) { this.app.onRename(hit.id, hit.name, e.clientX, e.clientY); return; }
      this.zoomAt(e.offsetX, e.offsetY, e.shiftKey ? 0.5 : 2);
    });
    cv.tabIndex = 0;
    cv.addEventListener('keydown', e => {
      if (['+', '='].includes(e.key)) { e.preventDefault(); this.zoomAt(this.vw / 2, this.vh / 2, 2); }
      else if (['-', '_'].includes(e.key)) { e.preventDefault(); this.zoomAt(this.vw / 2, this.vh / 2, 0.5); }
      else if (e.key === '0') { e.preventDefault(); this.stopMotion(); this.fit(); this.draw(); commit(); }
      else if (e.key.startsWith('Arrow')) { e.preventDefault(); const dist = e.shiftKey ? 180 : 80; this.view.x += { ArrowLeft: dist, ArrowRight: -dist }[e.key] || 0; this.view.y += { ArrowUp: dist, ArrowDown: -dist }[e.key] || 0; this.clamp(); this.draw(); commit(); }
    });
  };

  MapView.LEVELS = LEVELS; MapView.levelOf = levelOf;
  G.MapView = MapView;
  // 点城市：命中城市圆点或城市名
  MP.cityAt = function (sx, sy) {
    let best = null, bd = 11;
    for (const d of this.cityDots || []) { const dd = Math.hypot(d.x - sx, d.y - sy); if (dd < bd) { bd = dd; best = d.id; } }
    if (best) return best;
    const h = (this.hits || []).find(h => h.id && h.id.startsWith('city:') && sx >= h.box[0] - 2 && sx <= h.box[2] + 2 && sy >= h.box[1] - 2 && sy <= h.box[3] + 2);
    return h ? h.id : null;
  };
  // ---------- 风格装饰（屏幕空间）：图框、罗盘玫瑰、恒向线、网格、标题栏、印章、暗角 ----------
  MP.drawDecor = function (c, st) {
    if (st === 'default' || st === 'modern') return;
    const dpr = this.dpr, w = this.vw, h = this.vh; c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vignette = (col, a) => { const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(${col},${a})`); c.fillStyle = g; c.fillRect(0, 0, w, h); };
    const rose = (x, y, r, ink, fill, lines) => {
      c.save(); c.translate(x, y);
      if (lines) { c.strokeStyle = lines; c.lineWidth = 0.7; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * Math.hypot(w, h), Math.sin(a) * Math.hypot(w, h)); c.stroke(); } }
      c.beginPath(); c.arc(0, 0, r * 1.08, 0, 7); c.strokeStyle = ink; c.lineWidth = 1; c.stroke(); c.beginPath(); c.arc(0, 0, r * 0.98, 0, 7); c.stroke();
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 - Math.PI / 2, L = k % 2 ? r * 0.55 : r * 0.95, wd = k % 2 ? r * 0.1 : r * 0.16;
        for (const side of [1, -1]) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a + side * Math.PI / 2) * wd, Math.sin(a + side * Math.PI / 2) * wd); c.lineTo(Math.cos(a) * L, Math.sin(a) * L); c.closePath(); c.fillStyle = side > 0 ? ink : fill; c.fill(); c.strokeStyle = ink; c.lineWidth = 0.6; c.stroke(); } }
      c.font = `600 ${Math.round(r * 0.32)}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ink; c.fillText('北', 0, -r * 1.3); c.restore(); };
    const frame = (ink, inset, dbl, ticks) => { c.strokeStyle = ink; c.lineWidth = 1.6; c.strokeRect(inset, inset, w - 2 * inset, h - 2 * inset); if (dbl) { c.lineWidth = 0.7; c.strokeRect(inset + 5, inset + 5, w - 2 * inset - 10, h - 2 * inset - 10); }
      if (ticks) { const v = this.view; c.lineWidth = 0.8; c.font = `10px ${FONT}`; c.fillStyle = ink; c.textAlign = 'center'; c.textBaseline = 'top';
        for (let lon = -180; lon <= 180; lon += 15) { const sx = v.x + (lon + 180) / 360 * this.W * v.s; if (sx < inset + 10 || sx > w - inset - 10) continue; c.beginPath(); c.moveTo(sx, inset); c.lineTo(sx, inset + 7); c.moveTo(sx, h - inset); c.lineTo(sx, h - inset - 7); c.stroke(); c.fillText(Math.abs(lon) + '°' + (lon < 0 ? 'W' : lon > 0 ? 'E' : ''), sx, inset + 9); } } };
    if (st === 'antique') { vignette('92,64,30', 0.42); frame('rgba(90,62,34,.85)', 10, true, false); rose(w - 92, h - 170, 42, 'rgba(96,64,36,.92)', 'rgba(236,222,190,.95)', null); }
    else if (st === 'nautical') { rose(w - 110, h - 190, 46, 'rgba(40,52,60,.9)', 'rgba(250,246,234,.95)', 'rgba(40,52,60,.10)'); frame('rgba(40,52,60,.85)', 8, true, true); }
    else if (st === 'blueprint') {
      c.strokeStyle = 'rgba(200,225,255,.10)'; c.lineWidth = 1; c.beginPath(); for (let x = 0; x < w; x += 40) { c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, h); } for (let y = 0; y < h; y += 40) { c.moveTo(0, y + 0.5); c.lineTo(w, y + 0.5); } c.stroke();
      frame('rgba(220,236,255,.8)', 8, true, true);
      const bw = 230, bh = 58, bx = w - bw - 76, by = h - bh - 18; c.fillStyle = 'rgba(15,47,90,.85)'; c.fillRect(bx, by, bw, bh); c.strokeStyle = 'rgba(220,236,255,.85)'; c.lineWidth = 1; c.strokeRect(bx, by, bw, bh); c.beginPath(); c.moveTo(bx, by + 26); c.lineTo(bx + bw, by + 26); c.moveTo(bx + 150, by + 26); c.lineTo(bx + 150, by + bh); c.stroke();
      c.fillStyle = 'rgba(230,242,255,.95)'; c.font = `600 13px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText((document.getElementById('worldName') || {}).textContent || '星球', bx + 10, by + 13);
      c.font = `11px ${FONT}`; c.fillText('总图 · 地形与水系', bx + 10, by + 42); c.fillText('图号 PF-01', bx + 158, by + 42); }
    else if (st === 'ink') { vignette('60,52,40', 0.18);
      const nm = ((document.getElementById('worldName') || {}).textContent || '星球').replace(/星$/, '').slice(0, 4), sx = w - 120, sy = h - 210, sz = 52;
      c.fillStyle = 'rgba(178,34,34,.86)'; c.beginPath(); c.roundRect ? c.roundRect(sx, sy, sz, sz, 4) : c.rect(sx, sy, sz, sz); c.fill();
      c.fillStyle = 'rgba(255,245,235,.95)'; c.font = `700 ${nm.length > 2 ? 19 : 22}px ${SERIF}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const ch = [...nm]; if (ch.length <= 2) ch.forEach((t, k) => c.fillText(t, sx + sz / 2, sy + sz / 2 + (k - (ch.length - 1) / 2) * 22)); else ch.forEach((t, k) => c.fillText(t, sx + (k < 2 ? sz * 0.72 : sz * 0.28), sy + (k % 2 ? sz * 0.7 : sz * 0.3))); }
    else if (st === 'night') vignette('0,0,0', 0.45);
    else if (st === 'political') { // 地图集式图例框：国界、部族边疆、经纬线
      const bw = 132, bh = 74, bx = w - bw - 76, by = h - bh - 46; c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(bx, by, bw, bh); c.strokeStyle = 'rgba(78,78,92,.7)'; c.lineWidth = 1; c.strokeRect(bx + 0.5, by + 0.5, bw, bh);
      const row = (k, label, col, wd, dash) => { const y = by + 16 + k * 21; c.strokeStyle = col; c.lineWidth = wd; c.setLineDash(dash); c.beginPath(); c.moveTo(bx + 12, y); c.lineTo(bx + 48, y); c.stroke(); c.setLineDash([]);
        c.fillStyle = 'rgba(50,50,62,.9)'; c.font = `12px ${FONT}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(label, bx + 58, y); };
      row(0, '国界', 'rgba(78,78,92,.9)', 1.2, []); row(1, '部族边疆', 'rgba(96,96,110,.75)', 1, [3, 2.5]); row(2, '经纬线', 'rgba(70,140,200,.6)', 1, []); }
    c.restore();
  };
  // ---------- 城市建成区 ----------
  const URB = { fill: '#dba592', edge: 'rgba(150,86,70,.85)', street: 'rgba(250,236,226,.92)', art: '#f2cd62', artEdge: 'rgba(160,112,40,.85)', wall: '#6d4636', park: '#bcd89c' };
  MP.urbanRadiusPx = function (ct) { const era = this.d.stats.era, dens = era === 'industrial' ? 3450 : 3200, td = { metropolis: 0.82, city: 0.98, town: 1.18, site: 0.76 }[ct.tier] || 1;
    const A = Math.max(0.12, ct.pop / (dens * td) * (era === 'industrial' ? 1.25 : 1)), rKm = Math.sqrt(A / Math.PI), cellKm = 2 * Math.PI * this.d.cfg.radius / this.W; return rKm / cellKm * this.view.s; };
  MP.drawUrban = function (ks, each, px) {
    const d = this.d, v = this.view, s = v.s; this.urban = this.urban || new Map(); this.urbanReq = this.urbanReq || new Set();
    const vis = [];
    d.cities.forEach((ct, i) => { if (ct.tier === 'site') return; const r = this.urbanRadiusPx(ct); if (r < 2.5) return;
      for (const k of ks) { const sx = v.x + (ct.x + k * this.W) * s, sy = v.y + ct.y * s, m = r * 4; if (sx > -m && sy > -m && sx < this.vw + m && sy < this.vh + m) { vis.push([i, r]); break; } } });
    vis.sort((a, b) => b[1] - a[1]);
    for (const [i] of vis) if (!this.urban.has(i) && !this.urbanReq.has(i) && this.urbanReq.size < 4) { this.urbanReq.add(i);
      this.app.call('urban', { idx: i }).then(m => { this.urbanReq.delete(i); if (m.data) { this.urban.set(i, this.urbanPaths(m.data)); while (this.urban.size > 160) this.urban.delete(this.urban.keys().next().value); } this.draw(); }, () => this.urbanReq.delete(i)); }
    const c = this.ctx;
    each(() => { for (const [i, r] of vis) { const U = this.urban.get(i); if (!U) continue;
      c.fillStyle = URB.fill; c.fill(U.fill, 'evenodd');
      if (r > 30) { c.fillStyle = URB.park; c.fill(U.parks); }
      const spPx = U.spacing / U.cellKm * s; if (spPx > 3.2) { c.strokeStyle = URB.street; c.lineWidth = Math.min(1.4, 0.35 + spPx * 0.06) * px; c.stroke(U.minor); }
      c.strokeStyle = URB.edge; c.lineWidth = 0.8 * px; c.stroke(U.fill);
      if (r > 14) { c.lineCap = 'round'; c.strokeStyle = URB.artEdge; c.lineWidth = (r > 60 ? 3.4 : 2.4) * px; c.stroke(U.art); c.strokeStyle = URB.art; c.lineWidth = (r > 60 ? 2.2 : 1.5) * px; c.stroke(U.art); if (U.hasRing) { c.strokeStyle = URB.artEdge; c.lineWidth = 3 * px; c.stroke(U.ring); c.strokeStyle = URB.art; c.lineWidth = 1.9 * px; c.stroke(U.ring); } }
      if (U.hasWall && r > 10) { c.strokeStyle = URB.wall; c.lineWidth = (r > 60 ? 2.2 : 1.5) * px; c.setLineDash([]); c.stroke(U.wall); if (r > 40) { c.setLineDash([1.2 * px, 3.2 * px]); c.lineWidth = 4 * px; c.stroke(U.wall); c.setLineDash([]); } } } });
  };
  MP.urbanPaths = function (g) {
    const P = () => new Path2D(), add = (p, a, close) => { if (!a || a.length < 4) return; p.moveTo(a[0], a[1]); for (let k = 2; k < a.length; k += 2) p.lineTo(a[k], a[k + 1]); if (close) p.closePath(); };
    const fill = P(), minor = P(), art = P(), wall = P(), ring = P(), parks = P();
    g.rings.forEach(r => add(fill, r, true)); g.minor.forEach(l => add(minor, l)); g.arterials.forEach(l => add(art, l)); add(wall, g.wall, true); add(ring, g.ring, true); g.parks.forEach(r => add(parks, r, true));
    return { fill, minor, art, wall, ring, parks, hasWall: !!g.wall, hasRing: !!g.ring, spacing: g.spacing, cellKm: 2 * Math.PI * this.d.cfg.radius / this.W };
  };
})(window);

