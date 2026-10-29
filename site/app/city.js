/* 城市详情：点地图上的城市，打开用户生成器的城市图（街道、城墙、城门、港口、农田与周边地形）。
 * 配方由推演 Worker 从本世界的地形、水系、道路与文化给出；街区与建筑在独立 Worker 中生成；
 * 布局保存在浏览器 IndexedDB（用户的 city-layout-store），重开时直接读取。 */
(function (G) {
  'use strict';
  const $ = id => document.getElementById(id);
  const SCRIPTS = ['city/city-libraries.js', 'city/city-era.js', 'city/city-character.js', 'city/city-detail.js', 'city/city-site.js', 'city/city-layout-store.js', 'city/atlas-interaction.js', 'city/city-map.js'];
  const CAP = 35000; // 送进精细城市生成器的人口上限：更大的城市由城心精细生成 + 外围城郊快速补齐
  const TIER = { metropolis: '大都会', city: '城市', town: '城镇', site: '要塞' };
  const TYPE = { port: '海港', 'island-port': '岛港', 'lake-port': '湖港', 'river-city': '河港', oasis: '绿洲', fort: '边堡', 'pass-fort': '关隘', market: '集镇' };
  const ERA = { preindustrial: '前工业时代', industrial: '早期工业时代', tribal: '部落时代', ancient: '古典时代', medieval: '中世纪', 'early-modern': '近代早期', contemporary: '当代' };
  let app = null, loaded = null, cityMap = null, mapKey = null, current = null, worker = null, wseq = 0;
  const wpending = new Map();

  function loadScripts() {
    if (loaded) return loaded;
    loaded = SCRIPTS.reduce((p, src) => p.then(() => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('未能载入 ' + src)); document.head.appendChild(s); })), Promise.resolve());
    return loaded;
  }
  function cityWorker() {
    if (worker) return worker;
    worker = new Worker('city/city-worker.js');
    worker.onmessage = e => { const r = wpending.get(e.data.id); if (r) { wpending.delete(e.data.id); r(e.data); } };
    worker.onerror = e => { for (const [, r] of wpending) r({ ok: false, message: e.message || '城市生成器出错' }); wpending.clear(); worker = null; };
    return worker;
  }
  // city-map.js 调用：在 Worker 中生成城市（可取消：切换城市时终止旧 Worker）
  window.CityGenerateRemote = (recipe, site, seed, grid, signal) => new Promise((res, rej) => {
    const id = ++wseq, w = cityWorker();
    const abort = () => { wpending.delete(id); try { w.terminate(); } catch (e) { /* */ } worker = null; rej(new DOMException('城市操作已取消', 'AbortError')); };
    if (signal) { if (signal.aborted) return abort(); signal.addEventListener('abort', abort, { once: true }); }
    wpending.set(id, m => { if (signal) signal.removeEventListener('abort', abort); m.ok ? res(m) : rej(new Error(m.message)); });
    w.postMessage({ id, recipe, site, seed, grid });
  });
  // city-map.js 调用：城市配方（替代 city-maps/<id>.json.zst）
  window.CityPayloadSource = async (sourceId) => {
    const idx = +String(sourceId).replace('city-', '');
    const m = await app.call('citySite', { idx });
    const p = m.data; if (!p) throw new Error('该聚落没有可用的城市配方');
    const lib = p.lib || {}, libs = window.CITY_LIBRARIES || {};
    const sameCat = () => { const all = window.CULTURE_LIBRARIES || []; const b = all.find(l => l.cat === lib.cat && libs[l.id]); return b ? libs[b.id] : libs['realistic-00']; };
    const extra = libs[lib.id] || sameCat() || Object.values(libs)[0];
    const r = p.recipe, city = app.data.cities[idx];
    r.name = city ? city.name : r.name;
    if (r.harbor) r.harbor.name = r.name.slice(0, 3) + (r.harbor.kind === 'lake' ? '湖港' : '港');
    const lay = extra.cityLayout;
    r.culture = { ...r.culture, style: lay.architecture, cityLayout: { prototype: lay.prototype, architecture: lay.architecture, monumentTradition: lay.monumentTradition, materials: lay.materials } };
    const fill = (a, b) => (a && a.length ? a : b);
    const comp = lib.c && lib.c.roots && lib.c.roots.length ? { roots: lib.c.roots, prefixes: lib.c.prefixes || [], suffixes: lib.c.suffixes || [] } : { roots: ['安', '宁', '平', '川', '岚'], prefixes: ['东', '西', '南', '北', '上'], suffixes: ['阳', '州', '原', '城', '泽'] };
    if (!comp.prefixes.length) comp.prefixes = ['东', '西', '南', '北']; if (!comp.suffixes.length) comp.suffixes = ['城', '镇', '村', '庄'];
    r.naming = { libraryId: lib.id || 'custom', composition: comp };
    r.namePool = { cities: fill(lib.cities, ['新城']), rivers: fill(lib.rivers, ['清河']), lakes: fill(lib.lakes, ['镜湖']), mountains: fill(lib.mountains, ['青山']), regions: fill(lib.regions, ['平原']), streets: fill(lib.streets, extra.streets) };
    // 城内保存的改名
    const saved = app.names['citylocal:' + idx]; if (saved) r.localNames = saved;
    const digest = String(app.worldKey()).replace(/[^\w-]/g, '_'); return { schema: 'world-atlas-city-map-v1', gridDigest: digest, worldId: 'planet-' + digest, grid: p.grid, recipe: r, siteContext: p.site };
  };

  function names() {
    return {
      applyLabels(root) {
        for (const node of root.querySelectorAll('[data-name-id]')) {
          let id = node.dataset.nameId; if (id.startsWith('geography:')) { id = id.slice(10); node.dataset.nameId = id; }
          const v = app.objName(id); if (!v) continue;
          const text = Array.from(node.childNodes).filter(c => c.nodeType === 3);
          if (text.length) { text[0].textContent = v; for (const t of text.slice(1)) t.textContent = ''; }
        }
      }
    };
  }

  function ensureMap() {
    const key = app.worldKey();
    if (cityMap && mapKey === key) return cityMap;
    if (cityMap) { try { cityMap.destroy(); } catch (e) { /* */ } }
    mapKey = key;
    let meta = document.querySelector('meta[name="grid-digest"]'); if (!meta) { meta = document.createElement('meta'); meta.name = 'grid-digest'; document.head.appendChild(meta); }
    meta.content = key;
    cityMap = window.WorldAtlasCityMap.create({ viewport: $('city-map-viewport'), container: $('city-fabric-layer'), worldId: 'planet-' + key, gridDigest: key, names: names(),
      loadCity: (place, o) => window.CityPayloadSource(place.sourceId, o && o.signal) });
    return cityMap;
  }

  function fact(label, value, extra) { return `<div${extra ? ' class="x"' : ''}><dt>${label}</dt><dd>${value}</dd></div>`; }
  const fmtPop = n => n >= 1e4 ? (n / 1e4).toFixed(n >= 1e5 ? 0 : 1) + ' 万' : n.toLocaleString('zh-CN');
  function baseFacts(idx) {
    const d = app.data, c = d.cities[idx], k = c.country >= 0 ? d.countries[c.country] : null;
    const role = c.capital !== undefined ? '首都' : c.seat !== undefined ? '省会' : TIER[c.tier] || '城镇';
    $('cityEyebrow').textContent = [role, TYPE[c.type] || '', k ? k.name : '无国家统治'].filter(Boolean).join(' · ');
    $('cityName').textContent = c.name; $('cityName').dataset.nameId = 'city:' + idx;
    $('cityFacts').innerHTML = fact('人口', fmtPop(c.pop)) + fact('时代', ERA[d.stats.era] || d.stats.eraLabel || '') + fact('等级', TIER[c.tier] || '');
  }
  function detailFacts(recipe) {
    if (!recipe || !window.WorldAtlasCityCharacter) return;
    const ch = window.WorldAtlasCityCharacter.profile(recipe), site = recipe.localSite || {};
    let h = fact('人口', fmtPop(recipe.population.estimate)) + fact('聚落', ch.label) + fact('布局', ch.prototypeLabel || '—');
    h += fact('供水', site.waterSource ? site.waterSource.label : '—') + fact('地形', site.form ? site.form.label : '—');
    if (recipe.culture && recipe.culture.libraryLabel) h += fact('文化', recipe.culture.libraryLabel);
    if (recipe.harbor) h += fact('港口', `⚓ <span data-city-screen-label="${recipe.harbor.name}" data-feature-id="harbor">${recipe.harbor.name}</span>`);
    if (ch.defence && ch.defence.layers) h += fact('城防', ch.defence.layers > 1 ? '内城、外城' + (ch.defence.barbicans ? '与瓮城' : '与城门') : '城墙与城门');
    h += fact('规划面积', recipe.urban.targetFootprintKm2.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) + ' km²');
    $('cityFacts').innerHTML = h;
  }

  // ---------- 新城市卡：点城市即飞到城市上空（建成区与街区在主地图原位显示），卡片列出城市概况 ----------
  function openCard(idx) {
    const d = app.data, c = d.cities[idx]; if (!c) return;
    current = idx; $('cityPanel').hidden = true;
    const k = c.country >= 0 ? d.countries[c.country] : null, pv = c.prov >= 0 ? d.provinces[c.prov] : null;
    const role = c.capital !== undefined ? '首都' : c.seat !== undefined ? '省会' : c.role === 'military-post' ? (c.type === 'pass-fort' ? '关隘' : '要塞') : TIER[c.tier] || '城镇';
    const era = d.stats.era, dens = era === 'industrial' ? 3450 : 3200, td = { metropolis: 0.82, city: 0.98, town: 1.18, site: 0.76 }[c.tier] || 1;
    const area = Math.max(0.12, c.pop / (dens * td) * (era === 'industrial' ? 1.25 : 1));
    const cu = c.civ >= 0 && d.cultures[c.civ] ? d.cultures[c.civ].name : '—', la = c.lang >= 0 && d.languages[c.lang] ? d.languages[c.lang].name : '—', re = c.rel >= 0 && d.religions[c.rel] ? d.religions[c.rel].name : '—';
    const f = (a, b) => `<div><dt>${a}</dt><dd>${b}</dd></div>`;
    $('cityCard').innerHTML = `<button class="city-x" id="cityCardX" title="关闭"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <p class="city-eyebrow">${[role, TYPE[c.type] || '', k ? k.name : '无国家统治'].filter(Boolean).join(' · ')}</p><h3 data-name-id="city:${idx}" title="双击改名">${c.name}</h3>
      <dl class="city-facts">${f('人口', fmtPop(c.pop))}${f('建成区', area < 10 ? area.toFixed(1) + ' km²' : Math.round(area) + ' km²')}${f('省份', pv ? `<span data-name-id="province:${c.prov}">${pv.name}</span>` : '—')}${f('文明', cu)}${f('语言', la)}${f('宗教', re)}${c.holy && c.holy.length ? f('圣城', c.holy.map(i => d.religions[i] ? '<span style="color:#6b3fa0">✦ ' + d.religions[i].name + '</span>' : '').join('、') + '的圣地') : ''}</dl>
      <div class="row" style="gap:6px;margin-top:8px"><button class="chip" id="cityZoom">放大到城市</button><button class="chip" id="cityFrom">从这里出发</button><button class="chip" id="cityTo">到这里去</button></div>`;
    $('cityCard').hidden = false;
    const zoomTo = () => { const m = app.map, r = m.urbanRadiusPx(c) / m.view.s, want = 0.4 * Math.min(m.vw, m.vh) / Math.max(1e-6, r), z = Math.max(4, Math.min(1500, want / m.fitScale())); m.flyTo(c.x, c.y, z); };
    zoomTo();
    $('cityCardX').onclick = close; $('cityZoom').onclick = zoomTo;
    $('cityFrom').onclick = () => app.routeFromCity && app.routeFromCity(idx, 0); $('cityTo').onclick = () => app.routeFromCity && app.routeFromCity(idx, 1);
    app.map.draw();
  }
  // ---------- 城市面板（重构）：城市尺度的地形底图 + 建成区、街区、干道、城墙、片区与地标，参考分层设色地图的样式 ----------
  const CV = { data: null, bmp: null, scale: 1, tx: 0, ty: 0, extent: 'city', drag: null };
  const ST = { fill: 'rgba(214,150,132,.93)', fillOld: 'rgba(196,124,108,.95)', edge: 'rgba(132,70,58,.9)', street: 'rgba(252,240,232,.95)', art: '#f4cf5c', artEdge: '#8c6a2a', wall: '#5e3a2c', park: '#b5d596',
    road: { trunk: ['#7a2f22', '#d9553c', 3.2], regional: ['#8d5a36', '#e59a55', 2.3], local: ['rgba(120,90,60,.8)', '#f0d9b0', 1.4] }, river: '#3f86c4' };
  function cvEl() { let c = $('cityCv'); if (!c) { c = document.createElement('canvas'); c.id = 'cityCv'; c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'; $('city-map-viewport').prepend(c); $('city-map-canvas').style.display = 'none'; bindCv(c); } return c; }
  async function openPanel(idx) {
    const d = app.data; if (!d || !d.cities[idx]) return;
    current = idx; if ($('cityCard')) $('cityCard').hidden = true; $('cityPanel').hidden = false; document.body.classList.add('city-open'); baseFacts(idx); app.map.draw();
    CV.extent = 'city'; setExtentBtns(); await loadMap(idx);
  }
  async function loadMap(idx) {
    const c = cvEl(); $('city-map-status').textContent = '正在绘制城市…'; const t0 = performance.now();
    const vp = $('city-map-viewport'), px = Math.min(1400, Math.max(800, Math.round(vp.clientWidth * (window.devicePixelRatio || 1))));
    const m = await app.call('cityMap', { idx, px, extent: CV.extent }); if (current !== idx || !m.data) return;
    const D = m.data; CV.data = D; CV.hi = null; CV.paths = null;
    if (!window.CITY_LIBRARIES) { try { await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'city/city-libraries.js'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); }); } catch (e) { /* 无街道名单 */ } }
    { const libId = app.data.cities[idx].lib, L = window.CITY_LIBRARIES || {}; const ent = L[libId] || L['realistic-00']; CV.streets = ent && ent.streets ? ent.streets.slice() : []; }
    const im = new ImageData(new Uint8ClampedArray(D.img.buffer || D.img), D.w, D.h); CV.bmp = window.createImageBitmap ? await createImageBitmap(im) : (() => { const t = document.createElement('canvas'); t.width = D.w; t.height = D.h; t.getContext('2d').putImageData(im, 0, 0); return t; })();
    resetView(); $('city-map-status').textContent = ''; urbanFacts(D); void t0;
  }
  function resetView() { const c = cvEl(), vp = $('city-map-viewport'), D = CV.data; if (!D) return; const dpr = window.devicePixelRatio || 1; c.width = vp.clientWidth * dpr; c.height = vp.clientHeight * dpr;
    CV.scale = Math.max(vp.clientWidth / D.w, vp.clientHeight / D.h); CV.scale0 = CV.scale; CV.tx = (vp.clientWidth - D.w * CV.scale) / 2; CV.ty = (vp.clientHeight - D.h * CV.scale) / 2; drawCv(); }
  function setExtentBtns() { $('city-map-city').setAttribute('aria-pressed', String(CV.extent === 'city')); $('city-map-region').setAttribute('aria-pressed', String(CV.extent === 'region')); }
  function urbanFacts(D) { const U = D.urban, f = (a, b) => `<div><dt>${a}</dt><dd>${b}</dd></div>`; const c = app.data.cities[current];
    $('cityFacts').innerHTML = f('人口', fmtPop(c.pop)) + f('建成区', U.area < 10 ? U.area.toFixed(1) + ' km²' : Math.round(U.area) + ' km²') + f('等级', TIER[c.tier] || '') + f('片区', U.districts.length ? U.districts.length + ' 个' : '—') + f('城防', U.wall ? '城墙' + (U.marks.filter(m => m.kind === 'gate').length ? ' · ' + U.marks.filter(m => m.kind === 'gate').length + ' 门' : '') : U.ring ? '环路' : '无') + f('时代', ERA[app.data.stats.era] || '') + (D.interval ? f('等高距', D.interval + ' m') : ''); }
  // 绘制：远看为参考图式的城区色块与干道；放大后依次出现街巷、宅地建筑、广场、箭楼、码头、田块与村落
  function drawCv() {
    const c = cvEl(), D = CV.data; if (!D || !CV.bmp) return; const x = c.getContext('2d'), dpr = window.devicePixelRatio || 1, U = D.urban, k = CV.scale, px = 1 / k;
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#e8f3f7'; x.fillRect(0, 0, c.width, c.height);
    x.setTransform(dpr * k, 0, 0, dpr * k, dpr * CV.tx, dpr * CV.ty); x.imageSmoothingQuality = 'high'; x.drawImage(CV.bmp, 0, 0);
    if (CV.hi && CV.hi.key === D.idx + CV.extent) { const h = CV.hi; x.drawImage(h.bmp, (h.x0 - D.x0) / D.s, (h.y0 - D.y0) / D.s, h.w * h.s / D.s, h.h * h.s / D.s); }
    x.save(); x.scale(1 / D.s, 1 / D.s); x.translate(-D.x0, -D.y0); const wpx = D.s * px; x.lineJoin = 'round'; x.lineCap = 'round';
    const path = (a, close, stride = 2) => { const p = new Path2D(); if (!a || a.length < 4) return p; p.moveTo(a[0], a[1]); for (let i = stride; i < a.length; i += stride) p.lineTo(a[i], a[i + 1]); if (close) p.closePath(); return p; };
    const quads = (A, keep) => { const p = new Path2D(); for (let q = 0; q < A.length; q += 8) { if (keep && !keep(q / 8)) continue; p.moveTo(A[q], A[q + 1]); p.lineTo(A[q + 2], A[q + 3]); p.lineTo(A[q + 4], A[q + 5]); p.lineTo(A[q + 6], A[q + 7]); p.closePath(); } return p; };
    const kmPx = 1 / (D.s * D.cellKm * Math.cos((90 - (D.y0 + D.h * D.s / 2) / app.data.H * 180) * Math.PI / 180)) * k; // 每公里屏幕像素
    const P = CV.paths || (CV.paths = {});
    if (P.id !== D) { P.id = D; P.fill = new Path2D(); for (const r of U.rings) P.fill.addPath(path(r, true)); P.minor = new Path2D(); for (const l of U.minor) P.minor.addPath(path(l)); P.lanes = new Path2D(); for (const l of U.lanes || []) P.lanes.addPath(path(l));
      P.b = [0, 1, 2, 3, 4].map(t => quads(U.buildings || [], q => U.bTone[q] === t)); P.comp = new Path2D(); for (const q of U.compounds || []) P.comp.addPath(path(q, true)); P.plaza = new Path2D(); for (const q of U.plazas || []) P.plaza.addPath(path(q, true));
      P.fields = [0, 1, 2, 3].map(t => quads(D.fields || [], q => D.fTone[q] === t)); P.vill = quads(D.villB || []);
      P.cont = [new Path2D(), new Path2D()]; for (const c2 of D.contours || []) P.cont[c2.bold ? 1 : 0].addPath(path(c2.pts)); }
    const outsideComp = () => { if (!(U.compounds && U.compounds.length)) return; const r = new Path2D(); r.rect(D.x0 - 1e3, D.y0 - 1e3, 1e4, 1e4); r.addPath(P.comp); x.clip(r, 'evenodd'); }; // 宫城 / 官署院落内不画街道与道路
    // 等高线
    x.strokeStyle = 'rgba(118,96,70,.36)'; x.lineWidth = 0.6 * wpx; x.stroke(P.cont[0]); x.strokeStyle = 'rgba(118,96,70,.6)'; x.lineWidth = 1.1 * wpx; x.stroke(P.cont[1]);
    // 田块
    const FT = ['rgba(232,226,160,.58)', 'rgba(214,226,156,.58)', 'rgba(204,218,140,.55)', 'rgba(236,216,160,.58)']; if (kmPx > 7 || CV.extent === 'region') P.fields.forEach((p, t) => { x.fillStyle = FT[t]; x.fill(p); }); if (kmPx > 18) { x.strokeStyle = 'rgba(140,128,70,.35)'; x.lineWidth = 0.5 * wpx; P.fields.forEach(p => x.stroke(p)); }
    // 河流
    for (const r of D.rivers) { let q = 0; for (let i = 2; i < r.length; i += 3) q = Math.max(q, r[i]); const p = new Path2D(); p.moveTo(r[0], r[1]); for (let i = 3; i < r.length; i += 3) p.lineTo(r[i], r[i + 1]); x.strokeStyle = ST.river; x.lineWidth = Math.min(5, 0.8 + Math.log2(1 + q) * 0.55) * wpx * Math.max(1, kmPx / 40); x.stroke(p); }
    // 城区
    const showB = kmPx > 55, showLanes = kmPx > 30;
    x.fillStyle = showB ? 'rgba(236,206,192,.95)' : ST.fill; x.fill(P.fill, 'evenodd');
    x.save(); x.clip(P.fill, 'evenodd');
    if (U.wall && !showB) { x.fillStyle = ST.fillOld; x.fill(path(U.wall, true)); }
    x.fillStyle = ST.park; for (const r of U.parks) x.fill(path(r, true));
    x.fillStyle = 'rgba(244,232,214,.95)'; x.fill(P.plaza);
    if (showB) { x.fillStyle = 'rgba(236,222,196,.95)'; x.fill(P.comp); x.strokeStyle = '#7a3a2c'; x.lineWidth = Math.max(1, kmPx * 0.02) * wpx; x.stroke(P.comp);
      x.fillStyle = '#c37d6c'; x.fill(P.b[0]); x.fillStyle = '#a85a4b'; x.fill(P.b[1]); x.fillStyle = '#c99586'; x.fill(P.b[2]); x.fillStyle = '#9e3328'; x.fill(P.b[3]); x.fillStyle = '#6b4aa0'; x.fill(P.b[4]);
      if (kmPx > 160) { x.strokeStyle = 'rgba(110,50,40,.5)'; x.lineWidth = 0.6 * wpx; for (const p of P.b) x.stroke(p); } }
    outsideComp();
    if (showLanes) { x.strokeStyle = 'rgba(253,246,240,.95)'; x.lineWidth = Math.max(0.5, Math.min(2.2, kmPx * 0.012)) * wpx; x.stroke(P.lanes); }
    const spPx = U.spacing * kmPx; x.strokeStyle = ST.street; x.lineWidth = Math.max(0.6, Math.min(4, spPx * (showB ? 0.08 : 0.12))) * wpx; if (spPx > 3) x.stroke(P.minor); x.restore();
    x.strokeStyle = ST.edge; x.lineWidth = 0.9 * wpx; x.stroke(P.fill);
    // 村落建筑
    if (kmPx > 6) { x.fillStyle = '#b06a58'; x.fill(P.vill); }
    // 城外道路、铁路、干道、环路（院落内不画）
    x.save(); outsideComp();
    const rw = Math.max(1, Math.min(2.6, kmPx / 25));
    for (const cls of ['local', 'regional', 'trunk']) { const [ed, co, wd] = ST.road[cls], p = new Path2D(); for (const l of D.roads[cls]) p.addPath(path(l)); x.strokeStyle = ed; x.lineWidth = (wd * rw + 1.4) * wpx; x.stroke(p); x.strokeStyle = co; x.lineWidth = wd * rw * wpx; x.stroke(p); }
    { const p = new Path2D(); for (const l of U.arterials) p.addPath(path(l)); if (U.ring) p.addPath(path(U.ring, true)); x.strokeStyle = ST.artEdge; x.lineWidth = 3.4 * rw * wpx; x.stroke(p); x.strokeStyle = ST.art; x.lineWidth = 2.2 * rw * wpx; x.stroke(p); }
    if (D.roads.rail && D.roads.rail.length) { const p = new Path2D(); for (const l of D.roads.rail) p.addPath(path(l)); x.strokeStyle = '#222'; x.lineWidth = 3 * wpx; x.stroke(p); x.setLineDash([6 * wpx, 6 * wpx]); x.strokeStyle = '#fff'; x.lineWidth = 1.8 * wpx; x.stroke(p); x.setLineDash([]); }
    x.restore();
    if (U.piers && U.piers.length) { x.strokeStyle = '#7a5a3a'; x.lineWidth = Math.max(1.2, kmPx * 0.03) * wpx; x.lineCap = 'butt'; const p = new Path2D(); for (let q = 0; q < U.piers.length; q += 4) { p.moveTo(U.piers[q], U.piers[q + 1]); p.lineTo(U.piers[q + 2], U.piers[q + 3]); } x.stroke(p); x.lineCap = 'round'; }
    if (U.wall) { const p = path(U.wall, true), ww = Math.max(2.4, Math.min(6, kmPx * 0.05)); x.strokeStyle = ST.wall; x.lineWidth = ww * wpx; x.stroke(p);
      if (kmPx > 25 && U.towers) { const t = ww * 1.6 * wpx; x.fillStyle = ST.wall; for (let q = 0; q < U.towers.length; q += 2) x.fillRect(U.towers[q] - t, U.towers[q + 1] - t, t * 2, t * 2); } else { x.setLineDash([1.6 * wpx, 3.6 * wpx]); x.lineWidth = ww * 2 * wpx; x.stroke(p); x.setLineDash([]); } }
    x.restore();
    // 注记（屏幕坐标）
    x.setTransform(dpr, 0, 0, dpr, 0, 0); const scr = (wx, wy) => [CV.tx + (wx - D.x0) / D.s * k, CV.ty + (wy - D.y0) / D.s * k];
    const boxes = [], free = (b) => { for (const o of boxes) if (b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]) return false; boxes.push(b); return true; };
    const label = (t, sx, sy, o = {}) => { x.font = `${o.w || 600} ${o.size || 12}px ${o.font || FONT}`; const w = x.measureText(t).width, h = o.size || 12; const b = [sx - w / 2 - 3, sy - h / 2 - 3, sx + w / 2 + 3, sy + h / 2 + 3]; if (!free(b)) return false;
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = o.halo || 3.5; x.strokeStyle = o.haloC || 'rgba(255,255,255,.92)'; x.strokeText(t, sx, sy); x.fillStyle = o.color || '#333'; x.fillText(t, sx, sy); return true; };
    const ICON = { palace: ['#c0392b', '■'], office: ['#8e3b2e', '■'], market: ['#9c6b1f', '◆'], temple: ['#6b4aa0', '✦'], port: ['#1f6fb2', '⚓'], gate: ['#5e3a2c', '▣'] };
    const cc = app.data.cities[current], [cx, cy] = scr(cc.x, cc.y); label(cc.name, cx, cy - 22, { size: 20, w: 800, color: '#c62f22', halo: 5 });
    for (const m of U.marks) { const [sx, sy] = scr(m.x, m.y), [col, g] = ICON[m.kind] || ['#333', '●']; if (!free([sx - 7, sy - 7, sx + 7, sy + 7])) continue; x.font = `700 ${m.kind === 'palace' ? 15 : 12}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 3; x.strokeStyle = '#fff'; x.strokeText(g, sx, sy); x.fillStyle = col; x.fillText(g, sx, sy); if (m.kind !== 'gate' || kmPx > 30) label(m.name, sx, sy + 15, { size: 11, w: 500, color: col }); }
    // 干道街名（沿最长一段旋转书写）
    if (kmPx > 22 && CV.streets && CV.streets.length) U.arterials.forEach((a, ai) => { let best = -1, bl = 0; for (let q = 2; q < a.length - 6; q += 2) { const [x1, y1] = scr(a[q], a[q + 1]), [x2, y2] = scr(a[q + 4], a[q + 5]), L = Math.hypot(x2 - x1, y2 - y1); if (L > bl) { bl = L; best = q; } } if (best < 0 || bl < 40) return;
      const [x1, y1] = scr(a[best], a[best + 1]), [x2, y2] = scr(a[best + 4], a[best + 5]); let ang = Math.atan2(y2 - y1, x2 - x1); if (Math.cos(ang) < 0) ang += Math.PI; const name = CV.streets[(ai * 7 + current) % CV.streets.length], mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      if (!free([mx - 26, my - 8, mx + 26, my + 8])) return; x.save(); x.translate(mx, my); x.rotate(ang); x.font = `500 11px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 3; x.strokeStyle = 'rgba(255,250,235,.95)'; x.strokeText(name, 0, 0); x.fillStyle = '#6a4a1a'; x.fillText(name, 0, 0); x.restore(); });
    for (const t of U.districts) { const [sx, sy] = scr(t.x, t.y); label(t.name, sx, sy, { size: t.kind === 'sat' ? 13 : 12, w: t.kind === 'sat' ? 700 : 500, color: t.kind === 'old' ? '#7a3d2e' : '#4a3b36', haloC: 'rgba(255,240,232,.9)' }); }
    for (const t of D.towns) { const [sx, sy] = scr(t.x, t.y); if (sx < -20 || sy < -20 || sx > c.width / dpr + 20 || sy > c.height / dpr + 20) continue; const big = t.tier === 'city' || t.tier === 'metropolis';
      x.beginPath(); x.arc(sx, sy, big ? 4.5 : 3, 0, 7); x.fillStyle = '#fff'; x.fill(); x.lineWidth = 1.4; x.strokeStyle = '#333'; x.stroke(); label(t.name, sx, sy - 13, { size: big ? 13 : 11, w: big ? 700 : 500 }); }
    if (kmPx > 4) for (const v of D.villages || []) { if (!v.name) continue; const [sx, sy] = scr(v.x, v.y); label(v.name, sx, sy - 11, { size: 10, w: 500, color: '#5a4636' }); }
    for (const l of D.labels) { const [sx, sy] = scr(l.x, l.y); if (l.type === 'peak' || l.type === 'snow') { x.fillStyle = '#6b4f3a'; x.font = `10px ${FONT}`; x.textAlign = 'center'; x.fillText('▲', sx, sy); label(l.name + (l.h ? ' ' + l.h + 'm' : ''), sx, sy + 12, { size: 10, w: 500, color: '#6b4f3a' }); }
      else label(l.name, sx, sy, { size: 12, w: 600, color: l.type === 'lake' || l.type === 'bay' || l.type === 'sea' ? '#2f6fa6' : '#7a5a3c' }); }
    // 比例尺
    const kmPerPx = 1 / kmPx, nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50]; let km = nice[0]; for (const v of nice) if (v / kmPerPx < 140) km = v;
    $('city-scale-label').textContent = km < 1 ? km * 1000 + ' m' : km + ' km'; $('city-scale-rule').style.width = Math.round(km / kmPerPx) + 'px';
    scheduleHi();
  }
  // 放大后按当前视野重绘更清晰的地形底图
  let hiT = 0;
  function scheduleHi() { clearTimeout(hiT); hiT = setTimeout(async () => { const D = CV.data; if (!D || CV.scale < CV.scale0 * 1.6) { CV.hi = null; return; }
      const vp = $('city-map-viewport'), dpr = window.devicePixelRatio || 1, w = Math.min(1600, Math.round(vp.clientWidth * dpr)), h = Math.min(1600, Math.round(vp.clientHeight * dpr));
      const x0 = D.x0 + (-CV.tx / CV.scale) * D.s, y0 = D.y0 + (-CV.ty / CV.scale) * D.s, s = D.s / CV.scale * (vp.clientWidth / (w / dpr)) / dpr * dpr;
      const want = { x0, y0, s: D.s * vp.clientWidth / CV.scale / w, w, h }, key = D.idx + CV.extent, idx = current;
      if (CV.hi && CV.hi.key === key && Math.abs(CV.hi.x0 - want.x0) < want.s * 2 && Math.abs(CV.hi.y0 - want.y0) < want.s * 2 && Math.abs(CV.hi.s / want.s - 1) < 0.05) return;
      const m = await app.call('cityTerrain', want); if (idx !== current || !m.img) return; const im = new ImageData(new Uint8ClampedArray(m.img.buffer || m.img), w, h);
      CV.hi = Object.assign({ key, bmp: await createImageBitmap(im) }, want); drawCv(); void s; }, 260); }
  function bindCv(c) {
    const vp = $('city-map-viewport');
    vp.addEventListener('wheel', e => { if (!CV.data) return; e.preventDefault(); const r = vp.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, f = Math.exp(-e.deltaY * 0.0015), ns = Math.min(CV.scale0 * 24, Math.max(CV.scale0 * 0.9, CV.scale * f)); CV.tx = mx - (mx - CV.tx) * ns / CV.scale; CV.ty = my - (my - CV.ty) * ns / CV.scale; CV.scale = ns; drawCv(); }, { passive: false });
    vp.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; CV.drag = [e.clientX, e.clientY, CV.tx, CV.ty]; vp.setPointerCapture(e.pointerId); vp.classList.add('dragging'); });
    vp.addEventListener('pointermove', e => { if (!CV.drag) return; CV.tx = CV.drag[2] + e.clientX - CV.drag[0]; CV.ty = CV.drag[3] + e.clientY - CV.drag[1]; drawCv(); });
    const up = () => { CV.drag = null; vp.classList.remove('dragging'); }; vp.addEventListener('pointerup', up); vp.addEventListener('pointercancel', up);
    const zoomBy = f => { const r = vp.getBoundingClientRect(), mx = r.width / 2, my = r.height / 2, ns = Math.min(CV.scale0 * 24, Math.max(CV.scale0 * 0.9, CV.scale * f)); CV.tx = mx - (mx - CV.tx) * ns / CV.scale; CV.ty = my - (my - CV.ty) * ns / CV.scale; CV.scale = ns; drawCv(); };
    $('city-map-zoom-in').onclick = () => zoomBy(1.6); $('city-map-zoom-out').onclick = () => zoomBy(1 / 1.6); $('city-map-reset').onclick = () => resetView();
    $('city-map-city').onclick = () => { if (CV.extent === 'city') return; CV.extent = 'city'; setExtentBtns(); loadMap(current); };
    $('city-map-region').onclick = () => { if (CV.extent === 'region') return; CV.extent = 'region'; setExtentBtns(); loadMap(current); };
    new ResizeObserver(() => { if (CV.data && !$('cityPanel').hidden) resetView(); }).observe(vp);
  }
  const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  // ---------- 城市生成器（时代形制扩展版）原样嵌入：世界推演提供城市输入 ----------
  let frame = null, frameReady = null, pendingIdx = null;
  function ensureFrame() {
    if (frame) return frameReady;
    const box = document.createElement('div'); box.id = 'cityGenBox'; box.className = 'citygen-box'; box.hidden = true;
    box.innerHTML = '<div class="citygen-bar"><b id="cityGenTitle">城市</b><span id="cityGenSub"></span><span class="sp"></span><button class="btn ghost" id="cityGenRegen" title="换一个布局种子重新生成">重新生成</button><button class="btn ghost" id="cityGenLocate">在地图中定位</button><button class="city-x" id="cityGenClose" title="关闭"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><iframe id="cityGenFrame" title="城市生成器" src="citygen/index.html?embed=1"></iframe>';
    document.body.appendChild(box); frame = $('cityGenFrame');
    $('cityGenClose').onclick = close; $('cityGenRegen').onclick = () => { const b = frame.contentWindow.document.getElementById('regenerate'); if (b) b.click(); }; $('cityGenLocate').onclick = () => { if (current === null) return; const c = app.data.cities[current]; app.map.flyTo(c.x, c.y, 10); };
    frameReady = new Promise(res => { const on = e => { if (e.data && e.data.type === 'citygen-ready') { window.removeEventListener('message', on); res(); } }; window.addEventListener('message', on); });
    return frameReady;
  }
  async function open(idx) {
    const d = app.data, c = d.cities[idx]; if (!d || !c) return;
    current = idx; pendingIdx = idx; $('cityPanel').hidden = true; if ($('cityCard')) $('cityCard').hidden = true;
    const k = c.country >= 0 ? d.countries[c.country] : null, role = c.capital !== undefined ? '首都' : c.seat !== undefined ? '省会' : TIER[c.tier] || '城镇';
    await ensureFrame(); if (pendingIdx !== idx) return;
    $('cityGenBox').hidden = false; document.body.classList.add('city-open'); $('cityGenTitle').textContent = c.name; $('cityGenSub').textContent = [role, TYPE[c.type] || '', k ? k.name : '', fmtPop(c.pop) + ' 人'].filter(Boolean).join(' · '); app.map.draw();
    if (!window.CULTURE_LIBRARIES && G.Home) await G.Home.loadBuiltin();
    if (!window.CITY_LIBRARIES) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'city/city-libraries.js'; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc); });
    const payload = await window.CityPayloadSource('city-' + idx); if (pendingIdx !== idx) return;
    frame.contentWindow.postMessage({ type: 'planet-city', payload, label: (k ? k.name + ' · ' : '') + role }, '*');
  }
  // 大城市外围：快速城郊算法生成的街块、街巷与宅地，铺在精细城心之下，配色与城心一致
  async function addOuter(idx, recipe) {
    const m = await app.call('urban', { idx, detail: true }); const U = m.data; if (!U || current !== idx) return;
    const layer = $('city-fabric-layer'), loc = recipe.location, metric = recipe.urban.gridCellKilometres; if (!layer) return;
    const NS = 'http://www.w3.org/2000/svg', el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
    const pd = (a, close) => { if (!a || a.length < 4) return ''; let d = 'M' + (a[0] - loc.column).toFixed(5) + ' ' + (a[1] - loc.row).toFixed(5); for (let i = 2; i < a.length; i += 2) d += 'L' + (a[i] - loc.column).toFixed(5) + ' ' + (a[i + 1] - loc.row).toFixed(5); return close ? d + 'Z' : d; };
    const core = recipe.urban.radiusKm * 0.55, g = el('g', { class: 'city-outer-fabric' }), id = 'outer-core-mask-' + idx;
    const mask = el('mask', { id, maskUnits: 'userSpaceOnUse', x: -1000, y: -1000, width: 2000, height: 2000 }); mask.append(el('rect', { x: -1000, y: -1000, width: 2000, height: 2000, fill: '#fff' }), el('ellipse', { cx: 0, cy: 0, rx: core / metric.column, ry: core / metric.row, fill: '#000' }));
    const defs = el('defs', {}); defs.append(mask); g.append(defs); const body = el('g', { mask: `url(#${id})` }); g.append(body);
    // 房屋配色取城心生成器的住宅材质色，按四种色调错开，与城心一致
    const coreFills = [...new Set([...layer.querySelectorAll('.city-building-residential')].map(n => n.getAttribute('fill')).filter(Boolean))]; if (!coreFills.length) coreFills.push('#d2c39e', '#e4d7b7', '#c3b18f');
    const bds = coreFills.map(() => []); for (let q = 0; q < U.buildings.length; q += 8) { const t = U.bTone[q / 8]; if (t === 255) continue; bds[((q / 8) * 7 + t) % coreFills.length].push(pd(U.buildings.subarray(q, q + 8), true)); }
    bds.forEach((list, k) => body.append(el('path', { class: 'outer-buildings', d: list.join(''), fill: coreFills[k], stroke: 'rgba(95,80,61,.55)', 'stroke-width': 0.0012 / metric.column })));
    body.append(el('path', { class: 'outer-streets', d: U.minor.map(l => pd(l)).join(''), 'stroke-width': 0.011 / metric.column }));
    body.append(el('path', { class: 'outer-arterials-edge', d: U.arterials.map(l => pd(l)).join(''), 'stroke-width': 0.026 / metric.column }));
    body.append(el('path', { class: 'outer-arterials', d: U.arterials.map(l => pd(l)).join(''), 'stroke-width': 0.018 / metric.column }));
    const site = layer.querySelector('.city-local-site'); if (site && site.nextSibling) layer.insertBefore(g, site.nextSibling); else layer.prepend(g);

  }
  async function openLegacy(idx) {
    const d = app.data; if (!d || !d.cities[idx]) return;
    current = idx;
    $('cityPanel').hidden = false; document.body.classList.add('city-open'); app.map.draw();
    baseFacts(idx);
    $('city-map-status').textContent = '正在载入城市生成器…';
    try { await loadScripts(); } catch (e) { $('city-map-status').textContent = e.message; return; }
    if (current !== idx) return;
    if ($('cityCv')) $('cityCv').style.display = 'none'; $('city-map-canvas').style.display = '';
    $('city-map-viewport').classList.add('atlas-modern');
    const cm = ensureMap();
    const recipe = await cm.open({ id: 'city:' + idx, sourceId: 'city-' + idx, kind: 'city', name: d.cities[idx].name });
    if (current === idx && recipe) { detailFacts(recipe); if (d.cities[idx].pop > CAP) addOuter(idx, recipe); setTimeout(() => { if (current === idx) $('city-map-status').textContent = ''; }, 4500); }
  }
  function close() {
    current = null; pendingIdx = null; if ($('cityGenBox')) $('cityGenBox').hidden = true; $('cityPanel').hidden = true; if ($('cityCard')) $('cityCard').hidden = true; document.body.classList.remove('city-open');
    if (cityMap) cityMap.clear();
    app.map.draw();
  }

  // 城内名称（街道、城门、港口、地标）：双击改名，写回城市布局并记入本世界名称
  function onDbl(e) {
    const el = e.target.closest('[data-city-screen-label][data-feature-id]'); if (!el || el.dataset.nameId || !cityMap || current === null) return;
    if (el.dataset.featureKind === 'elevation') return;
    e.preventDefault(); e.stopPropagation();
    const idx = current, fid = el.dataset.featureId;
    app.editName(el.textContent.replace(/^⚓\s*/, ''), e.clientX, e.clientY, async (v) => {
      if (!v) return;
      try {
        const recipe = await cityMap.renameFeature(fid, v);
        const all = app.names['citylocal:' + idx] || {}; all[fid] = v; app.setRaw('citylocal:' + idx, all);
        if (recipe && current === idx) detailFacts(recipe);
      } catch (err) { app.toast('改名失败：' + err.message); }
    });
  }

  function init(a) {
    app = a;
    $('cityClose').onclick = close;

    $('cityLocate').onclick = () => { if (current === null) return; const c = app.data.cities[current]; app.map.flyTo(c.x, c.y, 10); };
    $('cityRegen').onclick = async () => { if (!cityMap || current === null) return; const idx = current; const r = await cityMap.regenerate({ id: 'city:' + idx, sourceId: 'city-' + idx, kind: 'city', name: app.data.cities[idx].name }); if (r && current === idx) detailFacts(r); };
    $('citySave').onclick = () => { try { const v = cityMap.exportSnapshot(); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(v)], { type: 'application/json' })); a.download = (app.data.cities[current].name || 'city') + '.city.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); } catch (e) { app.toast(e.message); } };
    $('cityOpen').onclick = () => $('cityFile').click();
    $('cityFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f || current === null) return; try { const v = JSON.parse(await f.text()); const idx = current; const r = await cityMap.importSnapshot(v, { id: 'city:' + idx, sourceId: 'city-' + idx, kind: 'city', name: app.data.cities[idx].name }, { replace: true }); if (r) detailFacts(r); } catch (err) { app.toast('导入失败：' + err.message); } };
    $('cityPanel').addEventListener('dblclick', onDbl, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && current !== null && !document.querySelector('.name-editor')) close(); });
  }

  G.City = { init, open, close, get current() { return current; }, refresh() { if (current !== null) baseFacts(current); } };
})(window);
