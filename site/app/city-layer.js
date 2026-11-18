/* 无缝地图 · 城市细节层（P1–P4）
 *
 * 把原先「点城市 → 弹独立面板」的城市细节，改为直接画进主地图的同一块 Canvas、
 * 用同一个相机（MapView.view 的 s/x/y）。于是从星球一路放大到街道不再需要切换：
 *   L0–L2：原有世界矢量地图（map.js 负责）
 *   L3  ：城市建成区轮廓淡入（urban 简化几何）
 *   L4–L6：城市配方细节（地形底图 + 城区 + 街巷 + 建筑 + 道路 + 注记）逐级显现
 *
 * 数据来源：推演 Worker 的 cityMap 消息（城市配方，坐标是世界网格 world-grid-cells，
 * 见 core/citysite.js 的 coordinateSpace 标注）——这正是 P0 统一坐标层 WGS 的结论。
 * 本模块只读数据、不改任何生成算法；关闭时主地图行为与旧版完全一致。
 *
 * 所有「网格 ↔ 公里」换算一律走 core/wgs.js 的统一坐标层 G.WGS，不再内联 2πR/W：
 *   - 唯一接入点是 G.WGS.recipeSpace(city, world)，其 cellKm 即 colKmRaw(2πR/W)；
 *   - worldRadius / urbanPaths 的 cellKm 均从该接入点取得，不再各自内联公式。
 * wgs.js 在本模块之前加载（见 index.html / worker.js），故此处取用是硬依赖、有契约测试守护。
 *
 * 能力：单一相机渲染 / LOD 调度 / LRU 缓存 / 请求去重 / 预取 / 淡入 / 分端配置。
 */
(function (G) {
  'use strict';

  // P0 统一坐标层：模块加载即解析，缺失时快速失败而非静默回退到内联公式。
  const WGS = G.WGS;
  if (!WGS || typeof WGS.colKmRaw !== 'function' || typeof WGS.recipeSpace !== 'function') {
    throw new Error('[CityLayer] 依赖 core/wgs.js 的统一坐标层 G.WGS，请先加载 wgs.js');
  }
  // 城市配方空间的唯一接入点：P0 的 recipeSpace() 同时给出 cellKm / kx / ky / 经纬度。
  // 传一个占位中心（仅取与纬度无关的赤道 cellKm/kx/ky），避免任何内联 2πR/W。
  const spaceOf = (W, H, R) => WGS.recipeSpace({ x: 0, y: H / 2 }, { W, H, R });
  // 赤道每网格单元公里数，本模块唯一的 cellKm 来源，经 recipeSpace 取得。
  const cellKmOf = (W, H, R) => spaceOf(W, H, R).cellKm;

  const ST = {
    fill: 'rgba(214,150,132,.93)', fillOld: 'rgba(196,124,108,.95)', edge: 'rgba(132,70,58,.9)',
    street: 'rgba(252,240,232,.95)', art: '#f4cf5c', artEdge: '#8c6a2a', wall: '#5e3a2c', park: '#b5d596',
    road: { trunk: ['#7a2f22', '#d9553c', 3.2], regional: ['#8d5a36', '#e59a55', 2.3], local: ['rgba(120,90,60,.8)', '#f0d9b0', 1.4] },
    river: '#3f86c4'
  };
  const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

  // LOD：相对缩放比 zoomRel 阈值（与 map.js 的 levelOf 前 3 级对齐，L3 起进入城市细节）
  // 到达 L4 才请求完整 cityMap（昂贵），L3 先用轻量 urban 建成区轮廓过渡。
  const LOD = { URBAN: 16, CITY: 26, STREETS: 46, BUILDINGS: 90, TEXTURE: 240 };
  const MAX_REL = 900;                 // 主地图缩放上限：fitScale × 900 ≈ 街/建筑级
  const CACHE_MAX = 8;                 // 城市配方 LRU 容量（Windows；Android 见 cap()）——单张位图约 7.8MB，8 张封顶控内存
  const PREFETCH = 4;                  // 接近阈值时预取的城市数
  const MAX_CONCURRENCY = 2;           // 同时发往单线程 Worker 的 cityMap 上限，避免挤占 probe/route 等交互请求（B4）
  const URBAN_TTL = 120000;            // 轻量建成区缓存 ttl（ms），过期淘汰，避免长时间探索内存不回落（B6）

  // 分端配置：Android（窄屏/触摸）收紧细节上限与缓存，控制内存与帧率。
  // px 按视口实际像素推导（≤视口长边 ×1.2），避免在小屏上仍申请 1400² 位图（B6）。
  function cap() {
    const phone = (typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches) || (window.innerWidth < 700);
    const viewportMax = Math.max(window.innerWidth || 1280, window.innerHeight || 720);
    const px = Math.min(phone ? 900 : 1400, Math.max(640, Math.round(viewportMax * 1.2)));
    return phone
      ? { maxRel: 520, buildings: false, texture: false, cache: 5, px }
      : { maxRel: MAX_REL, buildings: true, texture: true, cache: CACHE_MAX, px };
  }

  // 城市地形底图边缘羽化：中心不透明、四周渐隐，消除矩形贴图与主地图地形的生硬接缝。
  // 用一次性 alpha 遮罩（四边 destination-out 渐隐 + 圆角）合成，避免多次 destination-in 的叠乘。
  function feather(src, w, h) {
    try {
      const mask = document.createElement('canvas'); mask.width = w; mask.height = h;
      const m = mask.getContext('2d'); m.fillStyle = '#000'; m.fillRect(0, 0, w, h);
      m.globalCompositeOperation = 'destination-out';
      const mx = w * 0.14, my = h * 0.14;
      const edges = [
        [0, 0, mx, 0, 0, 0, mx, h], [w, 0, w - mx, 0, w - mx, 0, w, h],
        [0, 0, 0, my, 0, 0, w, my], [0, h, 0, h - my, 0, h - my, w, h]
      ];
      for (const [x0, y0, x1, y1, rx, ry, rw, rh] of edges) {
        const g = m.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        m.fillStyle = g; m.fillRect(rx, ry, rw, rh);
      }
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d'); x.drawImage(src, 0, 0, w, h);
      x.globalCompositeOperation = 'destination-in'; x.drawImage(mask, 0, 0);
      return cv;
    } catch (e) { return src; }
  }

  function CityLayer() {
    this.cache = new Map();      // idx -> { data, bmp, paths, at }
    this.req = new Set();        // 正在请求中的 idx
    this.urban = new Map();      // idx -> { paths, at } 轻量建成区
    this.urbanReq = new Set();
    this.app = null;
    this.enabled = true;
    this.fade = new Map();       // idx -> 0..1 淡入进度
    this.gen = 0;                // 世界代际：换世界后递增，丢弃在飞的旧请求
    this.stats = { requests: 0, hits: 0, misses: 0, failed: 0, totalMs: 0, discarded: 0 };
    this.queue = [];             // 待发请求队列（idx 升序由调度填）
    this.inflight = 0;           // 正在飞的请求数
  }
  const CL = CityLayer.prototype;

  CL.attach = function (app) { this.app = app; };
  // detach 时递增 gen：即使 in-flight promise 稍后返回，也会因 gen 不符被丢弃，
  // 避免旧世界的城市配方按 idx 错配进新世界缓存（B2）。
  CL.detach = function () {
    this.gen++;
    this.cache.clear(); this.urban.clear(); this.req.clear(); this.fade.clear();
    this.queue.length = 0; this.inflight = 0;
    this._vis = null; this._visKey = null;
  };
  CL.maxRel = function () { return cap().maxRel; };

  // 全局开关：供图例/设置/调试使用
  CL.setEnabled = function (on) { this.enabled = !!on; };

  // ---- 数据请求：轻量 urban（L3 建成区轮廓）----
  CL.requestUrban = function (idx) {
    if (!this.app || this.urban.has(idx) || this.urbanReq.has(idx)) return;
    const gen = this.gen;
    this.urbanReq.add(idx);
    this.stats.requests++;
    this.app.call('urban', { idx, detail: false }).then(m => {
      this.urbanReq.delete(idx);
      if (gen !== this.gen) { this.stats.discarded++; return; } // 世界已切换，丢弃旧结果（B2）
      if (m && m.data) {
        this.urban.set(idx, { paths: this.urbanPaths(m.data), at: performance.now() });
        this.evictUrban();
        if (this.app) this.app.map.draw();
      }
    }, err => {
      this.urbanReq.delete(idx); this.stats.failed++;
      if (typeof console !== 'undefined') console.warn('[CityLayer] urban 请求失败', idx, err); // B7
    });
  };

  // urban 缓存淘汰：先按 TTL 清过期项，再按数量上限清最早项（B6）
  CL.evictUrban = function () {
    const now = performance.now();
    for (const [idx, e] of this.urban) if (now - e.at > URBAN_TTL) this.urban.delete(idx);
    const capN = cap().cache * 12;
    while (this.urban.size > capN) this.urban.delete(this.urban.keys().next().value);
  };

  // ---- 数据请求：完整 cityMap（L4+ 城市配方）----
  // 请求走有界队列：单线程 Worker 同时最多 MAX_CONCURRENCY 个 cityMap，
  // 避免放大时一次性发 8+4 个同步重活把 probe/route 等交互请求堵在后面（B4）。
  CL.requestCity = function (idx, priority) {
    if (!this.app || this.cache.has(idx) || this.req.has(idx)) return;
    if (this.queue.some(q => q.idx === idx)) return;
    this.queue.push({ idx, priority: priority || 0 });
    // 视口中心更近、更重要的优先（priority 越大越靠前）
    this.queue.sort((a, b) => b.priority - a.priority);
    this.pumpQueue();
  };

  CL.pumpQueue = function () {
    while (this.inflight < MAX_CONCURRENCY && this.queue.length) {
      const job = this.queue.shift();
      if (this.cache.has(job.idx) || this.req.has(job.idx)) continue;
      this.doCityRequest(job.idx);
    }
  };

  CL.doCityRequest = function (idx) {
    const gen = this.gen;
    const started = performance.now();
    this.req.add(idx); this.inflight++; this.stats.requests++;
    const px = cap().px;
    this.app.call('cityMap', { idx, px, extent: 'city' }).then(async m => {
      this.req.delete(idx); this.inflight--;
      if (gen !== this.gen) { this.stats.discarded++; this.pumpQueue(); return; } // B2
      this.stats.totalMs += performance.now() - started;
      if (!m || !m.data) { this.pumpQueue(); return; }
      const D = m.data;
      let bmp = null;
      try {
        if (D.img) {
          const arr = D.img.buffer || D.img;
          if (window.createImageBitmap) bmp = await createImageBitmap(new ImageData(new Uint8ClampedArray(arr), D.w, D.h));
          else { const t = document.createElement('canvas'); t.width = D.w; t.height = D.h; t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(arr), D.w, D.h), 0, 0); bmp = t; }
        }
      } catch (e) { bmp = null; if (typeof console !== 'undefined') console.warn('[CityLayer] 位图解码失败', idx, e); }
      if (gen !== this.gen) { this.stats.discarded++; this.pumpQueue(); return; }
      if (bmp) bmp = feather(bmp, D.w, D.h);
      this.cache.set(idx, { data: D, bmp, paths: null, at: performance.now() });
      this.fade.set(idx, 0);
      this.evictCache();
      this.startFade();
      this.pumpQueue();
    }, err => {
      this.req.delete(idx); this.inflight--; this.stats.failed++;
      if (typeof console !== 'undefined') console.warn('[CityLayer] cityMap 请求失败', idx, err); // B7
      this.pumpQueue();
    });
  };

  // LRU 淘汰：capacity 按 cap()；被淘汰的城市同时清淡入态（B3）
  CL.evictCache = function () {
    const max = cap().cache;
    while (this.cache.size > max) {
      const old = this.cache.keys().next().value;
      this.cache.delete(old); this.fade.delete(old);
    }
  };

  // 统一淡入 ticker：所有正在淡入的城市共享一个 rAF 循环（B5），缩短到 160ms，
  // 避免「每个城市各起一条 rAF + 每帧全量重绘」，多城同时到达时只重绘一次/帧。
  CL.startFade = function () {
    if (this._fading) return;
    this._fading = true;
    const step = () => {
      if (!this.app || !this.fade.size) { this._fading = false; return; }
      let active = false;
      for (const [idx, f0] of this.fade) {
        if (f0 >= 1) continue;
        const f = Math.min(1, f0 + 1 / 10); // ~160ms @60fps
        this.fade.set(idx, f);
        if (f < 1) active = true;
      }
      this.app.map.draw();
      if (active) requestAnimationFrame(step);
      else this._fading = false;
    };
    requestAnimationFrame(step);
  };

  // ---- 可见城市：视口中心附近、按重要性排序；含世界副本环绕 ----
  CL.visibleCities = function (map) {
    const v = map.view;
    const vkey = (map.gen || 0) + ':' + Math.round(v.x) + ':' + Math.round(v.y) + ':' + v.s.toFixed(2);
    if (this._visKey === vkey && this._vis) return this._vis;
    const d = map.d, s = v.s, W = map.W;
    const ks = map.copies ? map.copies() : [0];
    const cx = (map.vw / 2 - v.x) / s, cy = (map.vh / 2 - v.y) / s; // 视口中心的网格坐标（当前副本）
    const sig = map.citySig ? map.citySig() : d.cities.map(c => c.pop || 1);
    const out = [];
    d.cities.forEach((ct, i) => {
      if (ct.tier === 'site' && sig[i] < 1e6) return; // 极小的聚落在城市细节级也先跳过
      let best = Infinity;
      for (const k of ks) { const dx = (ct.x + k * W) - cx, dy = ct.y - cy, dist = Math.hypot(dx, dy); if (dist < best) best = dist; }
      out.push({ i, ct, dist: best, sig: sig[i] || 1 });
    });
    out.sort((a, b) => (b.sig / (1 + b.dist * b.dist)) - (a.sig / (1 + a.dist * a.dist)));
    this._visKey = vkey; this._vis = out;
    return out;
  };

  // 主渲染入口：在 map.js 的 render() 里被调用（矢量层已画完、注记之前）
  CL.draw = function (map, zr) {
    if (!this.enabled || !this.app || !map.d) return;
    const capCfg = cap();
    const rel = Math.min(zr, capCfg.maxRel);
    if (rel < LOD.URBAN) return;

    const vis = this.visibleCities(map);
    const near = vis.filter(o => o.dist < this.worldRadius(map, o.ct));
    if (!near.length) return;

    // 调度：L3 请求轻量建成区；L4+ 请求完整配方；接近阈值时预取
    const wantCity = rel >= LOD.CITY;
    // 优先级 = 重要性/距离分数：视口中心附近的大城市先取，预取的靠后（B4）。
    const prio = o => o.sig / (1 + o.dist * o.dist);
    for (let n = 0; n < Math.min(near.length, 8); n++) {
      const o = near[n];
      if (wantCity) this.requestCity(o.i, 100 + prio(o));
      else this.requestUrban(o.i);
    }
    if (wantCity) for (let n = 0; n < Math.min(near.length, PREFETCH); n++) this.requestCity(near[n].i, prio(near[n]));

    // 绘制：先画建成区轮廓（过渡），再在高缩放画完整配方
    if (rel < LOD.CITY) { this.drawUrbanLayer(map, zr); return; }
    this.drawCityLayer(map, zr, capCfg);
  };

  // 城市影响半径（世界网格单位）：建成区半径 ×~4，随 importance 略增
  CL.worldRadius = function (map, ct) {
    const era = map.d.stats.era, dens = era === 'industrial' ? 3450 : 3200;
    const td = { metropolis: 0.82, city: 0.98, town: 1.18, site: 0.76 }[ct.tier] || 1;
    const A = Math.max(0.12, (ct.pop || 1000) / (dens * td) * (era === 'industrial' ? 1.25 : 1));
    const rKm = Math.sqrt(A / Math.PI), cellKm = cellKmOf(map.W, map.H, map.d.cfg.radius);
    return rKm / cellKm * 4.5;
  };

  CL.urbanPaths = function (g) {
    const P = () => new Path2D(), add = (p, a, close) => { if (!a || a.length < 4) return; p.moveTo(a[0], a[1]); for (let k = 2; k < a.length; k += 2) p.lineTo(a[k], a[k + 1]); if (close) p.closePath(); };
    const fill = P(), minor = P(), art = P(), wall = P(), ring = P(), parks = P();
    (g.rings || []).forEach(r => add(fill, r, true)); (g.minor || []).forEach(l => add(minor, l)); (g.arterials || []).forEach(l => add(art, l));
    add(wall, g.wall, true); add(ring, g.ring, true); (g.parks || []).forEach(r => add(parks, r, true));
    const map = this.app.map;
    return { fill, minor, art, wall, ring, parks, hasWall: !!g.wall, hasRing: !!g.ring, spacing: g.spacing, cellKm: cellKmOf(map.W, map.H, map.d.cfg.radius) };
  };

  // L3：轻量建成区（复用 map.js 里那套 URB 风格，升级为可调用）
  CL.drawUrbanLayer = function (map, zr) {
    const c = map.ctx, v = map.view, s = v.s, ks = map.copies ? map.copies() : [0], px = 1 / s;
    const URB = { fill: '#dba592', edge: 'rgba(150,86,70,.85)', street: 'rgba(250,236,226,.92)', art: '#f2cd62', artEdge: 'rgba(160,112,40,.85)', wall: '#6d4636', park: '#bcd89c' };
    const alpha = Math.min(1, (zr - LOD.URBAN) / (LOD.CITY - LOD.URBAN));
    c.save(); c.globalAlpha = alpha; c.lineJoin = 'round'; c.lineCap = 'round';
    for (const [idx, e] of this.urban) {
      const ct = map.d.cities[idx]; if (!ct) continue; const U = e.paths;
      for (const k of ks) {
        c.setTransform(map.dpr * s, 0, 0, map.dpr * s, map.dpr * (v.x + k * map.W * s), map.dpr * v.y);
        c.fillStyle = URB.fill; c.fill(U.fill, 'evenodd');
        const spPx = U.spacing / U.cellKm * s;
        if (spPx > 3.2) { c.strokeStyle = URB.street; c.lineWidth = Math.min(1.4, 0.35 + spPx * 0.06) * px; c.stroke(U.minor); }
        c.strokeStyle = URB.edge; c.lineWidth = 0.8 * px; c.stroke(U.fill);
        if (U.hasWall) { c.strokeStyle = URB.wall; c.lineWidth = 1.4 * px; c.stroke(U.wall); }
      }
    }
    c.restore();
  };

  // L4–L6：完整城市配方，画在主 Canvas 上（城市坐标 → 主相机）
  // 几何本就是世界网格坐标，直接套主相机变换；线宽用「屏幕像素 / s」换算回网格单位。
  CL.drawCityLayer = function (map, zr, capCfg) {
    const c = map.ctx, v = map.view, s = v.s, d = map.d, dpr = map.dpr, W = d.W;
    const showLanes = zr >= LOD.STREETS;
    const showB = capCfg.buildings && zr >= LOD.BUILDINGS;
    const ks = map.copies ? map.copies() : [0];
    const w = screenPx => screenPx / s; // 屏幕 CSS 像素 → 世界网格单位
    const pathOf = (a, close, stride) => { const p = new Path2D(); if (!a || a.length < 4) return p; const st = stride || 2; p.moveTo(a[0], a[1]); for (let i = st; i < a.length; i += st) p.lineTo(a[i], a[i + 1]); if (close) p.closePath(); return p; };
    const quads = (A, keep) => { const p = new Path2D(); if (!A) return p; for (let q = 0; q < A.length; q += 8) { if (keep && !keep(q / 8)) continue; p.moveTo(A[q], A[q + 1]); p.lineTo(A[q + 2], A[q + 3]); p.lineTo(A[q + 4], A[q + 5]); p.lineTo(A[q + 6], A[q + 7]); p.closePath(); } return p; };

    for (const [idx, e] of this.cache) {
      const D = e.data, ct = d.cities[idx]; if (!ct || !D || !D.urban) continue;
      const U = D.urban;
      const U0 = D.x0, U1 = D.x0 + D.w * D.s, V0 = D.y0, V1 = D.y0 + D.h * D.s;
      const fade = this.fade.has(idx) ? this.fade.get(idx) : 1;
      // B3（真 LRU）：本帧访问到该城市，把它移到 Map 末尾（最近使用），淘汰时 keys().next() 才是真正最久未用的。
      this.cache.delete(idx); this.cache.set(idx, e);
      // 缓存 Path2D（世界网格坐标，与副本 k 无关，只需构建一次）
      if (!e.paths) {
        try {
          const fill = new Path2D(); for (const r of (U.rings || [])) fill.addPath(pathOf(r, true));
          const parks = new Path2D(); for (const r of (U.parks || [])) parks.addPath(pathOf(r, true));
          const lanes = new Path2D(); for (const l of (U.lanes || [])) lanes.addPath(pathOf(l));
          const minor = new Path2D(); for (const l of (U.minor || [])) minor.addPath(pathOf(l));
          const art = new Path2D(); for (const l of (U.arterials || [])) art.addPath(pathOf(l)); if (U.ring) art.addPath(pathOf(U.ring, true));
          const wall = U.wall ? pathOf(U.wall, true) : null;
          const rivers = (D.rivers || []).map(r => { const p = new Path2D(); p.moveTo(r[0], r[1]); for (let i = 3; i < r.length; i += 3) p.lineTo(r[i], r[i + 1]); return p; });
          const roads = {}; for (const cls of ['local', 'regional', 'trunk']) { const p = new Path2D(); for (const l of (D.roads[cls] || [])) p.addPath(pathOf(l)); roads[cls] = p; }
          // B1：建筑路径单独缓存，不随首次进入时的 LOD 固化。低 LOD 先画其它层，
          // 放大到 BUILDINGS 时再按需构建 e.buildings，之后一直复用。
          e.paths = { fill, parks, lanes, minor, art, wall, rivers, roads };
        } catch (err) { e.paths = {}; if (typeof console !== 'undefined') console.warn('[CityLayer] 路径构建失败', idx, err); }
      }
      if (showB && U.buildings && !e.buildings) {
        try { e.buildings = [0, 1, 2, 3, 4].map(t => quads(U.buildings, q => U.bTone[q] === t)); }
        catch (err) { e.buildings = []; if (typeof console !== 'undefined') console.warn('[CityLayer] 建筑路径构建失败', idx, err); }
      }
      const P = e.paths;

      for (const k of ks) {
        const sx0 = v.x + (U0 + k * W) * s, sy0 = v.y + V0 * s, sw = (U1 - U0) * s, sh = (V1 - V0) * s;
        if (sx0 > map.vw || sx0 + sw < 0 || sy0 > map.vh || sy0 + sh < 0) continue;
        c.save();
        c.globalAlpha = fade;
        // 底图位图（屏幕空间绘制）
        if (e.bmp) { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = zr >= LOD.TEXTURE ? 'high' : 'medium'; c.drawImage(e.bmp, sx0, sy0, sw, sh); }
        // 矢量层：世界坐标 → 主相机
        c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (v.x + k * W * s), dpr * v.y);
        c.lineJoin = 'round'; c.lineCap = 'round';
        for (const r of P.rivers || []) { c.strokeStyle = ST.river; c.lineWidth = w(1.4); c.stroke(r); }
        if (P.fill) {
          c.fillStyle = ST.fill; c.fill(P.fill, 'evenodd');
          c.save(); if (P.fill) c.clip(P.fill, 'evenodd');
          if (P.parks) { c.fillStyle = ST.park; c.fill(P.parks); }
          if (showLanes && P.lanes) { c.strokeStyle = ST.street; c.lineWidth = w(1.2); c.stroke(P.lanes); }
          if (showB && e.buildings) { const pal = ['#c37d6c', '#a85a4b', '#c99586', '#9e3328', '#6b4aa0']; for (let t = 0; t < pal.length; t++) { if (e.buildings[t]) { c.fillStyle = pal[t]; c.fill(e.buildings[t]); } } }
          c.restore();
          c.strokeStyle = ST.edge; c.lineWidth = w(0.9); c.stroke(P.fill);
        }
        if (P.art) { c.strokeStyle = ST.artEdge; c.lineWidth = w(2.4); c.stroke(P.art); c.strokeStyle = ST.art; c.lineWidth = w(1.5); c.stroke(P.art); }
        if (P.wall) { c.strokeStyle = ST.wall; c.lineWidth = w(2); c.stroke(P.wall); }
        for (const cls of ['local', 'regional', 'trunk']) { const p = P.roads && P.roads[cls]; if (!p) continue; const [ed, co, wd] = ST.road[cls]; c.strokeStyle = ed; c.lineWidth = w(wd + 1); c.stroke(p); c.strokeStyle = co; c.lineWidth = w(wd); c.stroke(p); }
        c.restore();
      }
    }
  };

  G.CityLayer = CityLayer;
  // 供 map.js 读取当前分端缩放上限（无需构造实例）；关闭城市层时回退到原版 48
  G.cityMaxRel = () => (G.CityLayer._i && !G.CityLayer._i.enabled) ? 48 : cap().maxRel;
})(window);
