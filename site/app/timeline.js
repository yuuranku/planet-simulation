/* 历史时间线（第一阶段：文明点亮）
 * 第一次打开时请 Worker 推演整段历史（一次算完），之后拖动、播放只在页面里查表着色。
 * 界面：底部一条播放条（播放、年份、时间轴、倍速、图层）；编年史以字幕浮在地图上；图例为左下小卡；文明脉络为可展开的抽屉。
 * 时间轴非均匀：史前与部落时期压缩在最左一小段，从第一批城邦起占满其余宽度，播放时史前快速带过。
 * 着色：陆地底图褪成灰度（保留山体明暗），历史图层用色相分明的配色，相邻文明 / 宗教保证不同色。 */
(function (G) {
  'use strict';
  const $ = id => document.getElementById(id);
  const INF = 1e8;
  // 发展阶段配色：部落与酋邦为浅褐（不抢眼），城邦以后每个阶段一个分明的色相
  const STAGE_COL = [null, [222, 214, 186], [204, 190, 148], [240, 168, 52], [221, 78, 58], [158, 44, 122], [88, 76, 172], [36, 126, 192], [24, 150, 118]];
  const STAGE_GENERIC = ['游群采集', '农业村落', '酋邦', '城邦', '王国', '古典帝国', '封建', '集权', '当代'];
  const FARMER = [214, 206, 182];
  let ideaSel = -1; // 思潮图层：选中一条思潮时，只看它的传播（接纳 / 未接纳）
  const ideaAt = (k, r) => H.ideaA ? H.ideaA[k * (H.nR + 1) + r] : 1e9;
  const ideasOf = (r, y) => { const out = []; if (!H.ideas) return out; H.ideas.forEach((I, k) => { if (I.born !== null && ideaAt(k, r) <= y) out.push(k); }); return out; };
  const KIND_COL = { idea: '#c08a00', adopt: '#b9a26a', settle: '#8a5a00', theocracy: '#6b3fa0', vassal: '#8a6d2f', vassalFree: '#5d7d3a', vassalAnnex: '#7b3b2a', colonyCity: '#1f6f8b', cradle: '#2f7d4f', city: '#e0a030', kingdom: '#d54e3a', empire: '#9e2c7a', fall: '#555', civ: '#3b6ea8', stage: '#9aa3ab', religion: '#7a4fa0', found: '#b07a3a', ruin: '#7a6a58', plague: '#3d3d3d', milestone: '#c08a00', leader: '#c08a00', unify: '#d54e3a', annex: '#7b3b2a', sack: '#b03030', nomad: '#8a5a00', split: '#6a4c93', dynasty: '#4a6fa5', house: '#4a6fa5', restore: '#2e8b57', capital: '#888', secede: '#3b6ea8', rise: '#3b6ea8', revolt: '#c0392b', suppress: '#7f8c8d', rebelState: '#d35400', overthrow: '#8e1b1b', coup: '#5d6d7e', revolution: '#b03a2e', disaster: '#9a7d0a', provRedraw: '#8a6d2f', provSplit: '#8a6d2f', transfer: '#8a6d2f', migrate: '#8a5a00', convert: '#7a4fa0', organize: '#4a6fa5', fromState: '#4a6fa5', provSecede: '#d35400', crown: '#9e2c7a', uncrown: '#6d4c63', regal: '#d54e3a', wane: '#7d6b5a', decay: '#8c6d46', defeat: '#a04030', perish: '#444' };
  const ROAD_STYLE = { trunk: ['rgba(112,72,44,.8)', 1.7], regional: ['rgba(124,88,58,.62)', 1.15], local: ['rgba(136,106,78,.45)', 0.8] };
  const SERIF = '"Songti SC", "STSong", "Noto Serif SC", "Source Han Serif SC", "SimSun", serif';
  const PRE = 0.12; // 史前在时间轴上所占的宽度
  const SPEEDS = [1, 3, 10];

  let app = null, H = null, hFor = null, loading = null, on = false, saved = null;
  let year = 0, layer = 'state', playing = false, speed = 1, lastT = 0, raf = 0, dirty = true, Y0 = 1000, lastEv = null;
  let ov = null, col = null, key = null, labels = [], shownYear = -1, shownLayer = '';
  let civPal = [], ancPal = [], relPal = [];
  let rkey = null, vasN = {}, vasEdgePath = null, provEdgePath = null, stripe = null, pkey = null, segPath = [], edgePath = null, ovCtx = null, img = null, buf = null, pxOff = null, pxList = null, pxBox = null, prevCol = null; // 全分辨率区块编号图着色 + 矢量界线
  let provCard = null, provPath = null, provCount = 0; // 省份卡：{ r: 点到的区块, v: 正在看的省 }
  let regionLabelPoints = new Map();
  let focusP = -1, focusLin = null, focusLinOn = true, ghostPath = null, capEvents = [], polN = null, polCap = null, showCities = true, roadPaths = [], roadCache = { n: -1 }, cityOrder = null, cityOrderYear = -1, dots = [], cityByRegion = null, cardCity = -1;

  // ---------- 非均匀时间轴 ----------
  const tOf = y => !H ? 0 : y <= Y0 ? (y / Y0) * PRE : PRE + (y - Y0) / (H.E - Y0) * (1 - PRE);
  const yOf = t => !H ? 0 : t <= PRE ? t / PRE * Y0 : Y0 + (t - PRE) / (1 - PRE) * (H.E - Y0);
  const eraIdx = y => H.eraAt[Math.min(H.eraAt.length - 1, Math.max(0, Math.floor(y / H.eraStep)))];
  const eraName = y => { const e = eraIdx(y); return e <= 2 ? '史前 · 部落时代' : H.eraNames[e] || ''; };

  const UZ = el => (window.uiZoom ? window.uiZoom(el) : 1), rc0 = () => $('tlRowsCv');
  function init(a) {
    app = a;
    const bar = document.createElement('section');
    bar.className = 'card tl-bar'; bar.id = 'timeline'; bar.hidden = true;
    bar.innerHTML = `
      <button class="tl-play" id="tlPlay" title="播放 / 暂停（空格）"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>
      <div class="tl-year"><b id="tlYear">第 0 年</b><span id="tlEra"></span></div>
      <div class="tl-track" id="tlTrack"><canvas id="tlBand"></canvas><i class="tl-life" id="tlLife" hidden></i><div class="tl-ticks" id="tlTicks"></div><i class="tl-thumb" id="tlThumb"></i></div>
      <button class="tl-chip" id="tlSpeed" title="播放速度">1×</button>
      <button class="tl-chip tl-pre" id="tlPrefix" title="关闭国号前缀：后唐帝国显示为唐帝国、东法兰克王国显示为法兰克王国（人文图同步）">去前缀</button>
      <div class="tl-seg" id="tlLayer"><button data-l="state" class="on">国家</button><button data-l="prov">省份</button><button data-l="sys">制度</button><button data-l="stage">思潮</button><button data-l="culture">文明</button><button data-l="religion">宗教</button><button data-l="unrest">民怨</button></div>
      <button class="tl-icon" id="tlRiverBtn" title="世系河流图：各国按时间排开，分裂处分叉、吞并处汇流"><svg viewBox="0 0 24 24"><path d="M3 6c5 0 6 4 9 4s4-3 9-3M3 12c4 0 6-2 9-2s5 4 9 4M3 18c5 0 6-3 9-3s4 2 9 2"/></svg></button>
      <button class="tl-icon" id="tlRows" title="文明脉络"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h10M4 17h13"/></svg></button>
      <button class="tl-icon" id="tlClose" title="关闭时间线"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <div class="tl-loading" id="tlLoading" hidden><span id="tlLoadText">正在推演历史…</span><div class="bar"><i id="tlLoadBar"></i></div></div>`;
    document.body.appendChild(bar);
    const cap = document.createElement('div'); cap.className = 'tl-caption'; cap.id = 'tlTicker'; cap.hidden = true; document.body.appendChild(cap);
    const leg = document.createElement('div'); leg.className = 'card tl-legend'; leg.id = 'tlLegend'; leg.hidden = true; document.body.appendChild(leg);
    const dr = document.createElement('section'); dr.className = 'card tl-drawer'; dr.id = 'tlDrawer'; dr.hidden = true;
    dr.innerHTML = `<header><b>文明脉络</b><small>每行一个文明，色段为它进入各阶段的年代；点一行跳到那里</small><button class="tl-icon" id="tlDrawerX" title="收起"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button></header><div class="tl-rows"><canvas id="tlRowsCv"></canvas></div>`;
    document.body.appendChild(dr);
    const cc = document.createElement('section'); cc.className = 'card tl-city'; cc.id = 'tlCity'; cc.hidden = true; document.body.appendChild(cc);
    const pc = document.createElement('section'); pc.className = 'card tl-city tl-prov'; pc.id = 'tlProv'; pc.hidden = true; document.body.appendChild(pc);
    pc.addEventListener('click', e => { const b = e.target.closest('[data-act],[data-focus],[data-pv],[data-year]'); if (!b || !provCard) return;
      if (b.dataset.focus !== undefined) { setFocus(+b.dataset.focus); return; }
      if (b.dataset.pv !== undefined) { provCard.v = +b.dataset.pv; setPlaying(false); setYear(+b.dataset.y); return; } // 看另一个省（含已撤销的），并跳到它存在的年份
      if (b.dataset.year !== undefined && b.dataset.act === undefined) { setPlaying(false); setYear(+b.dataset.year); return; }
      const X = H.provinces[provCard.v], a = b.dataset.act;
      if (a === 'x') { closeProv(); app.map.draw(); } else if (a === 'made' && X) setYear(X.created); else if (a === 'gone' && X) setYear(X.abolished - 1); else if (a === 'fly') { const S = X ? provRegionsAt(provCard.v, Math.max(X.created, Math.min(year, (X.abolished ?? H.E + 1) - 1))) : []; const k = S[0] || provCard.r; app.map.flyTo(H.cx[k], H.cy[k], Math.max(3, app.map.zoomRel())); } });
    const fc = document.createElement('section'); fc.className = 'card tl-focus'; fc.id = 'tlFocus'; fc.hidden = true; document.body.appendChild(fc);
    fc.addEventListener('click', e => { const b = e.target.closest('[data-act],[data-focus],[data-year]'); if (!b) return; const q = H.polities[focusP];
      if (b.dataset.focus !== undefined) return setFocus(+b.dataset.focus);
      if (b.dataset.year !== undefined) { setPlaying(false); setYear(+b.dataset.year); return; }
      const a = b.dataset.act; if (a === 'x') clearFocus(); else if (a === 'play') { setYear(q.born); setPlaying(true); } else if (a === 'peak') setYear(q.peakYear); else if (a === 'fly') { const c = capAt(focusP, Math.min(Math.max(year, q.born), lifeEnd(focusP))); if (c) app.map.flyTo(H.cx[c[2]], H.cy[c[2]], 2.5); } });
    fc.addEventListener('scroll', e => { if (e.target.classList && e.target.classList.contains('tf-fade')) fadeEnd(e.target); }, true);
    fc.addEventListener('change', e => { if (e.target.id === 'tlLinOn') { focusLinOn = e.target.checked; focusLin = lineageOf(focusP); dirty = true; app.map.draw(); } });
    leg.addEventListener('click', e => { const id = e.target.closest('[data-idea]'); if (id) { const k = +id.dataset.idea; ideaSel = ideaSel === k ? -1 : k; dirty = true; renderLegend(); app.map.draw(); return; } const b = e.target.closest('[data-focus]'); if (b) setFocus(+b.dataset.focus); });
    document.addEventListener('keydown', ev => { if (on && ev.key === 'Escape' && focusP >= 0) clearFocus(); });
    cc.addEventListener('click', e => { const b = e.target.closest('[data-act],[data-focus],[data-year]'); if (!b) return; const c = H.cities[cardCity]; if (!c) return; if (b.dataset.year !== undefined && b.dataset.act === undefined) { setPlaying(false); setYear(+b.dataset.year); return; }
      if (b.dataset.focus !== undefined) { setFocus(+b.dataset.focus); return; }
      if (b.dataset.act === 'x') { cc.hidden = true; cardCity = -1; app.map.draw(); } else if (b.dataset.act === 'found') setYear(c.founded); else if (b.dataset.act === 'peak') setYear(c.peakYear); else if (b.dataset.act === 'ruin') setYear(c.ruined); else if (b.dataset.act === 'fly') app.map.flyTo(c.x, c.y, 8); });
    leg.addEventListener('change', e => { if (e.target.id === 'tlCityToggle') { showCities = e.target.checked; renderLegend(); app.map.draw(); } });

    $('tlPlay').onclick = () => setPlaying(!playing);
    $('tlClose').onclick = close;
    $('tlRows').onclick = () => toggleDrawer();
    $('tlRiverBtn').onclick = () => toggleRiver();
    const rv = document.createElement('section'); rv.className = 'card tl-river'; rv.id = 'tlRiver'; rv.hidden = true;
    rv.innerHTML = `<header><b>世系河流图</b><small>河宽为当时所占世界陆地的份额；同一国统的改朝换代连成一条河，分裂者紧挨母国分出，被吞并者以弧线汇入吞并者，虚线为复国。点一条河进入单国视角</small><button class="tl-icon" id="tlRiverX" title="关闭"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header><div class="tl-river-body"><canvas id="tlRiverCv"></canvas><div class="tl-river-tip" id="tlRiverTip" hidden></div></div>`;
    document.body.appendChild(rv);
    $('tlRiverX').onclick = () => toggleRiver(false);
    const rcv = $('tlRiverCv');
    rcv.addEventListener('mousemove', ev => riverHover(ev));
    rcv.addEventListener('mouseleave', () => { $('tlRiverTip').hidden = true; });
    rcv.addEventListener('click', ev => riverClick(ev));
    new ResizeObserver(() => { if (!rv.hidden) { RIV.cache = null; drawRiver(); } }).observe(rv);
    $('tlDrawerX').onclick = () => toggleDrawer(false);
    $('tlLayer').onclick = e => { const b = e.target.closest('[data-l]'); if (!b) return; layer = b.dataset.l; if (layer !== 'prov') closeProv(); $('tlLayer').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); dirty = true; renderLegend(); app.map.draw(); };
    $('tlPrefix').onclick = () => app.setNoPrefix && app.setNoPrefix(!app.noPrefix);
    $('tlSpeed').onclick = () => { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; $('tlSpeed').textContent = speed + '×'; };
    cap.onclick = ev => { if (ev.target.closest('[data-all]')) return toggleFeedAll(true); const b = ev.target.closest('[data-e]'); if (b) focusEvent(capEvents[+b.dataset.e]); };
    const fa = document.createElement('section'); fa.className = 'card tl-feedall'; fa.id = 'tlFeedAll'; fa.hidden = true; document.body.appendChild(fa);
    fa.addEventListener('click', ev => { if (ev.target.closest('[data-x]')) return toggleFeedAll(false); const b = ev.target.closest('[data-e]'); if (b) { fa.querySelectorAll('li.on').forEach(x => x.classList.remove('on')); b.classList.add('on'); faLock = true; try { focusEvent(capEvents[+b.dataset.e]); } finally { faLock = false; } } });
    document.addEventListener('keydown', ev => { if (on && feedAllOpen && ev.key === 'Escape') toggleFeedAll(false); });
    // 拖动时间轴（按非均匀刻度换算年份）
    const track = $('tlTrack');
    const seek = ev => { const r = track.getBoundingClientRect(); setYear(yOf(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)))); };
    track.addEventListener('pointerdown', ev => { if (!H || ev.target.closest('.tl-tick')) return; setPlaying(false); track.setPointerCapture(ev.pointerId); seek(ev); track.onpointermove = seek; });
    track.addEventListener('pointerup', () => { track.onpointermove = null; });
    $('tlTicks').addEventListener('click', ev => { const t = ev.target.closest('.tl-tick'); if (t) focusEvent(H.events[+t.dataset.i]); });
    const rc = $('tlRowsCv');
    rc.addEventListener('mousemove', ev => { const row = rowAt(ev); rc.title = row ? rowTitle(row) : ''; rc.style.cursor = row ? 'pointer' : ''; });
    rc.addEventListener('click', ev => { const row = rowAt(ev); if (!row) return; const r = rc.getBoundingClientRect(), z = UZ(rc), x = (ev.clientX - r.left) / z; setYear(x > NAME_W ? yOf((x - NAME_W) / (r.width / z - NAME_W - 8)) : (row.start || 0)); if (row.x) app.map.flyTo(row.x, row.y, 3); });
    document.addEventListener('keydown', ev => { if (!on || !H || ev.target.closest('input,textarea')) return; if (ev.code === 'Space') { ev.preventDefault(); setPlaying(!playing); } if (ev.key === 'ArrowRight') setYear(yOf(Math.min(1, tOf(year) + 0.005))); if (ev.key === 'ArrowLeft') setYear(yOf(Math.max(0, tOf(year) - 0.005))); });
    const sync = () => { const root = document.documentElement.style; root.setProperty('--tlh', (bar.hidden ? 0 : bar.offsetHeight) + 'px'); root.setProperty('--tld', (dr.hidden ? 0 : dr.offsetHeight + 10) + 'px'); };
    const ro = new ResizeObserver(() => { sync(); if (on) { drawBand(); drawRows(); } }); ro.observe(bar); ro.observe(dr);
    app.drawHistory = drawOverlay;
    app.drawHistoryTop = drawTop;
  }
  function toggleDrawer(force) { const dr = $('tlDrawer'); dr.hidden = force === undefined ? !dr.hidden : !force; $('tlRows').classList.toggle('on', !dr.hidden); if (!dr.hidden) drawRows(); }

  // ---------- 打开 / 关闭 ----------
  async function open() {
    if (!app.data) return;
    if (!on && app.onHistory) app.onHistory(true);
    on = true; $('timeline').hidden = false; document.body.classList.add('tl-on');
    const btn = document.querySelector('[data-tool=history]'); if (btn) btn.classList.add('on');
    // 时间线期间：底图换成地形，隐藏现代国界、城市与道路（它们属于“现在”）
    if (!saved) { saved = { tab: app.tab, geo: app.topics.geo, aux: { borders: app.aux.borders, cities: app.aux.cities, roads: app.aux.roads, nominal: app.aux.nominal, gray: app.aux.gray } };
      app.tab = 'geo'; app.topics.geo = 'terrain'; Object.assign(app.aux, { borders: false, cities: false, roads: false, nominal: false, gray: true }); // 地形改为灰度渲染
      app.ui && app.ui.refresh(); }
    if (!H || hFor !== app.data) {
      $('tlLoading').hidden = false; $('tlLoadText').textContent = '正在推演历史…'; $('tlLoadBar').style.width = '5%';
      const d = app.data; loading = loading || app.call('history', {});
      const m = await loading; loading = null;
      if (!on || app.data !== d) return;
      if (!m || !m.data) { $('tlLoadText').textContent = '历史推演失败，请重新推演世界后再试'; return; }
      H = m.data; hFor = d; prepare(); year = 0;
    }
    $('tlLoading').hidden = true; $('tlLegend').hidden = false;
    prefixChanged();
    renderLegend(); drawBand(); setYear(year);
  }
  function close() {
    on = false; setPlaying(false);
    for (const id of ['timeline', 'tlTicker', 'tlLegend', 'tlDrawer', 'tlCity', 'tlProv', 'tlFocus', 'tlFeedAll']) $(id).hidden = true; provCard = null; provPath = null; feedAllOpen = false; pulses = []; $('tlRiver').hidden = true; cardCity = -1; focusP = -1; ghostPath = null;
    document.body.classList.remove('tl-on');
    app.onHistory && app.onHistory(false);
    const root = document.documentElement.style; root.setProperty('--tlh', '0px'); root.setProperty('--tld', '0px');
    const b = document.querySelector('[data-tool=history]'); if (b) b.classList.remove('on');
    if (saved) { app.tab = saved.tab; app.topics.geo = saved.geo; Object.assign(app.aux, saved.aux); saved = null; app.ui && app.ui.refresh(); }
    app.map.draw();
  }
  const toggle = () => on ? close() : open();
  function reset() { if (on) close(); H = null; hFor = null; loading = null; ov = null; }
  function progress(m) { if (!on) return; $('tlLoadText').textContent = '正在推演历史 · ' + m.stage; $('tlLoadBar').style.width = Math.round(m.f * 100) + '%'; }

  // ---------- 配色：相邻者不同色 ----------
  const HUES = [4, 28, 48, 92, 140, 168, 190, 212, 236, 262, 292, 326];
  function hsl(h, s, l) { h = ((h % 360) + 360) % 360 / 360; const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; }
  function colorGraph(n, adj, salt) { // 贪心着色：度数大的先选，避开邻居已用的色相；同色相再用明度区分
    const out = new Array(n), hue = new Int16Array(n).fill(-1), order = [...Array(n).keys()].sort((a, b) => adj[b].size - adj[a].size || a - b);
    for (const k of order) { const used = new Set(); for (const o of adj[k]) if (hue[o] >= 0) used.add(hue[o] % 12);
      let h = -1; for (let t = 0; t < 12; t++) { const c = (k * 5 + salt + t) % 12; if (!used.has(c)) { h = c; break; } } if (h < 0) h = (k * 5 + salt) % 12;
      const tier = (k + salt) % 3; hue[k] = h + 12 * tier;
      out[k] = hsl(HUES[h], [0.62, 0.55, 0.6][tier], [0.54, 0.66, 0.44][tier]); }
    return out;
  }
  function buildPalettes() {
    const nC = H.civs.length, nA = H.ancient.length, nRel = H.religions.length;
    const cAdj = Array.from({ length: nC + nA }, () => new Set()), rAdj = Array.from({ length: nRel }, () => new Set());
    const nodeC = r => H.civ[r] >= 0 ? H.civ[r] : -1, nodeA = r => H.ancientOf[r] >= 0 ? nC + H.ancientOf[r] : -1;
    const link = (S, a, b) => { if (a >= 0 && b >= 0 && a !== b) { S[a].add(b); S[b].add(a); } };
    const W = H.W, Hh = H.H, reg = H.regionOf, seen = new Set();
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) { const a = reg[y * W + x]; if (!a) continue;
      for (const b of [reg[y * W + (x + 1) % W], y + 1 < Hh ? reg[(y + 1) * W + x] : 0]) { if (!b || b === a) continue; const k = a < b ? a * 65536 + b : b * 65536 + a; if (seen.has(k)) continue; seen.add(k);
        link(cAdj, nodeC(a), nodeC(b)); link(cAdj, nodeA(a), nodeC(b)); link(cAdj, nodeC(a), nodeA(b)); link(cAdj, nodeA(a), nodeA(b));
        for (const fa of [H.rel[a], H.relPrev[a]]) for (const fb of [H.rel[b], H.relPrev[b]]) link(rAdj, fa, fb); } }
    for (let r = 1; r <= H.nR; r++) link(cAdj, nodeA(r), nodeC(r)); // 古文明与继承它故地的文明前后相接，也要分得开
    const cp = colorGraph(nC + nA, cAdj, 1); civPal = cp.slice(0, nC); ancPal = cp.slice(nC);
    relPal = colorGraph(nRel, rAdj, 7); H.religions.forEach((r, f) => { if (r.color) relPal[f] = r.color.map(v => Math.round(v * 0.8 + 255 * 0.2)); }); // 宗教库的象征色
  }
  const civColor = c => civPal[c] || [180, 170, 150];
  const ancColor = a => ancPal[a] || [160, 130, 100];
  const relColor = f => relPal[f] || [150, 130, 170];

  // ---------- 数据准备 ----------
  let rows = [], NAME_W = 120;
  function prepare() {
    regionLabelPoints = new Map();
    ov = document.createElement('canvas'); ov.width = H.FW; ov.height = H.FH; ovCtx = ov.getContext('2d');
    img = ovCtx.createImageData(H.FW, H.FH); buf = new Uint32Array(img.data.buffer);
    col = new Uint32Array(H.nR + 1); key = new Int32Array(H.nR + 1); prevCol = new Uint32Array(H.nR + 1).fill(1); stripe = new Uint8Array(H.nR + 1); pkey = new Int32Array(H.nR + 1); prepGradient();
    // 每个区块的像素表与外框：换年份时只重涂变了颜色的区块
    { const F = H.regionF, n = H.nR + 1, cnt = new Int32Array(n + 1); for (let i = 0; i < F.length; i++) cnt[F[i]]++;
      pxOff = new Int32Array(n + 1); for (let r = 1; r <= n; r++) pxOff[r] = pxOff[r - 1] + cnt[r - 1];
      const at = pxOff.slice(); pxList = new Int32Array(F.length); for (let i = 0; i < F.length; i++) pxList[at[F[i]]++] = i;
      pxBox = new Int32Array(n * 4); for (let r = 0; r < n; r++) { pxBox[4 * r] = 1e9; pxBox[4 * r + 1] = 1e9; pxBox[4 * r + 2] = -1; pxBox[4 * r + 3] = -1; }
      for (let i = 0; i < F.length; i++) { const r = F[i], y = (i / H.FW) | 0, x = i - y * H.FW, b = 4 * r; if (x < pxBox[b]) pxBox[b] = x; if (y < pxBox[b + 1]) pxBox[b + 1] = y; if (x > pxBox[b + 2]) pxBox[b + 2] = x; if (y > pxBox[b + 3]) pxBox[b + 3] = y; }
      const LF = H.landF; for (let i = pxOff[0]; i < pxOff[1]; i++) { const p = pxList[i]; buf[p] = LF[p] ? VEIL : 0; } }
    const O = H.outline;
    segPath = new Array(O.segA.length); for (let k = 0; k < O.segA.length; k++) { const a = O.segOff[k], b = O.segOff[k + 1], p = new Path2D(); p.moveTo(O.segPts[a], O.segPts[a + 1]); for (let i = a + 2; i < b; i += 2) p.lineTo(O.segPts[i], O.segPts[i + 1]); segPath[k] = p; }
    // 压缩的分界：整个世界进入城邦时代的那一年（之前只有摇篮里零星的城邦）
    Y0 = H.E * 0.4; for (let k = 0; k < H.eraAt.length; k++) if (H.eraAt[k] >= 3) { Y0 = k * H.eraStep; break; } Y0 = Math.max(200, Math.min(H.E * 0.6, Y0));
    buildPalettes();
    roadPaths = (H.roads || []).map(rd => { const p = new Path2D(); for (const L of rd.lines) { p.moveTo(L[0], L[1]); for (let i = 2; i < L.length; i += 2) p.lineTo(L[i], L[i + 1]); } return { year: rd.year, imp: rd.imp, p }; });
    roadCache = { n: -1 }; cityOrder = null; cityOrderYear = -1; holySet = null;
    cityByRegion = new Map(); (H.cities || []).forEach((c, i) => { if (c.fort || !c.r) return; if (!cityByRegion.has(c.r)) cityByRegion.set(c.r, []); cityByRegion.get(c.r).push(i); });
    rows = [];
    H.ancient.forEach((a, i) => { const cr = H.cradles[a.cradle]; rows.push({ kind: 'ancient', i, name: a.name, type: a.typeLabel, lib: a.lib, ages: a.ages, end: a.fall, start: a.ages[1] || 0, x: cr.x, y: cr.y, color: ancColor(i), stageNames: a.stageNames, succ: a.successor }); });
    H.civs.forEach((c, i) => rows.push({ kind: 'civ', i, name: c.name, type: c.typeLabel, lib: c.lib, ages: c.ages, end: H.E, start: c.start || 0, x: c.hx, y: c.hy, color: civColor(i), stageNames: c.stageNames, titles: c.titles }));
    rows.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'ancient' ? -1 : 1) || a.start - b.start);
    const isMajor = e => e.major !== undefined ? e.major : e.kind !== 'stage' || (e.stage >= 4 && e.stage <= 5);
    capEvents = H.events.filter(isMajor);
    polN = new Int32Array(H.polities.length); polCap = new Int32Array(H.polities.length);
    $('tlTicks').innerHTML = H.events.map((e, i) => !isMajor(e) ? '' : `<i class="tl-tick k-${e.kind}" data-i="${i}" style="left:${(tOf(e.year) * 100).toFixed(2)}%;background:${KIND_COL[e.kind] || '#888'}" title="第 ${e.year} 年 · ${esc(unpre(e.text))}"></i>`).join('');
    dirty = true;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // ---------- 地名沿革：省与城在某年的叫法（[年份, 名字, 缘由, 当时的主人]） ----------
  const eraOf = (L, y, d) => { if (!L || !L.length) return d; let n = L[0][1]; for (const x of L) { if (x[0] > y) break; n = x[1]; } return n; };
  const cityName = (i, y) => { const c = H.cities[i]; return c ? eraOf(c.names, y, c.name) : ''; };
  const provName = (v, y) => { const X = H.provinces[v]; return X ? eraOf(X.names, y, X.name) : ''; };
  const NM_WHY = { found: '建城', alien: '异族入主，改名', rename: '更名', restore: '恢复旧名', reform: '改制更名', establish: '初置', split: '析置', splitPop: '人丁繁盛，析置', 'from-state': '以国为省', redraw: '重划新设' };
  const AB_WHY = { empty: '土地尽失，八十年无人收复', redraw: '新主重划疆界', reform: '改行今制，并入今省' };
  // 浅纸色薄纱（让褪色后的地形更亮）直接合进着色：颜色叠在薄纱之上
  const VA = 70 / 255, VC = [250, 246, 236];
  const overVeil = (rgb, a) => { const ao = a + VA * (1 - a); return pack([0, 1, 2].map(k => (rgb[k] * a + VC[k] * VA * (1 - a)) / ao), ao); };
  const pack = (rgb, a) => ((Math.round(a * 255) & 255) << 24 | (rgb[2] & 255) << 16 | (rgb[1] & 255) << 8 | (rgb[0] & 255)) >>> 0;
  const VEIL = pack(VC, VA);
  const vassalTint = (L, id) => { // 附庸配色：与宗主同色系（色相相近），但深浅、色相明显不同——一眼看出是另一个国家；与现在地图同一公式
    const r = L[0] / 255, g = L[1] / 255, b = L[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0, s = 0;
    if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4); }
    const a = ((id * 2654435761) >>> 0) % 6, dh = [-24, 18, -14, 26, 12, -20][a], dl = (l > 0.72 ? -1 : 1) * (0.1 + 0.04 * (a % 3));
    h = (((h + dh) % 360) + 360) % 360 / 360; const s2 = Math.min(0.62, s * (l > 0.72 ? 1.08 : 0.86) + 0.04), l2 = Math.max(0.5, Math.min(0.88, l + dl));
    const f = n => { const k = (n + h * 12) % 12, aa = s2 * Math.min(l2, 1 - l2); return Math.round(255 * (l2 - aa * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };
  const mix = (c, w, t) => [c[0] + (w[0] - c[0]) * t, c[1] + (w[1] - c[1]) * t, c[2] + (w[2] - c[2]) * t];

  // ---------- 查表：某区块在某年的状态 ----------
  function stageAt(r, y) { const NN = H.nR + 1, Y = H.Y; let s = 0; for (let k = 1; k <= 8; k++) if (Y[k * NN + r] <= y) s = k; else break; return s; }
  // 文化与宗教：按推演的变动记录查当年的值与“传入至今多久”（用于辐射圈的浓淡）
  function logAt(L, r, y) { let lo = L.off[r], hi = L.off[r + 1] - 1, v = -1, since = 0; while (lo <= hi) { const m = (lo + hi) >> 1; if (L.year[m] <= y) { v = L.val[m]; since = L.year[m]; lo = m + 1; } else hi = m - 1; } LOG_SINCE = since; return v; }
  let LOG_SINCE = 0;
  function cultureAt(r, y, s) { // ≥0 现存文明；≤ -2 古文明（-2 - i）；-1 无文明归属的早期农人；null 无人
    if (s < 1) return null; return logAt(H.cultLog, r, y);
  }
  function religionAt(r, y, cu) { // ≥0 宗教；-1 原始信仰；null 无
    if (cu === null) return null; return logAt(H.relLog, r, y);
  }
  const cuColor = cu => cu >= 0 ? civColor(cu) : cu <= -2 ? ancColor(-2 - cu) : FARMER;

  // ---------- 国家 ----------
  function ownerAt(r, y) { const O = H.own, a = O.off[r], b = O.off[r + 1]; let lo = a, hi = b - 1, o = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (O.year[m] <= y) { o = O.owner[m]; lo = m + 1; } else hi = m - 1; } return o; }
  function capAt(p, y) { const cs = H.polities[p].caps; let c = cs[0]; for (const x of cs) { if (x[0] > y) break; c = x; } return c; } // [year, city, region]
  function unrestAt(r, y) { const U = H.unrest; if (!U || !U.years.length) return 0; let lo = 0, hi = U.years.length - 1, i = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (U.years[m] <= y) { i = m; lo = m + 1; } else hi = m - 1; } return i < 0 ? 0 : U.data[i * (H.nR + 1) + r] / 255; }
  const provAt = (r, y) => H.provLog ? logAt(H.provLog, r, y) : -1;
  function regionAtPoint(x, y) {
    const gx = ((Math.floor(x) % H.FW) + H.FW) % H.FW, gy = Math.floor(y);
    return gy >= 0 && gy < H.FH ? H.regionF[gy * H.FW + gx] : 0;
  }
  const orgAt = (p, y) => { const o = H.polities[p].org; return o !== null && o !== undefined && y >= o; };
  function liegeAt(p, y) { const V = H.polities[p].vas; if (!V || !V.length) return -1; let l = -1; for (let i = 0; i < V.length; i += 2) { if (V[i] > y) break; l = V[i + 1]; } return l; } // 某年的宗主（-1 为独立）
  function realmAt(p, y) { let x = p; for (let g = 0; g < 8; g++) { const l = liegeAt(x, y); if (l < 0 || l === x) break; x = l; } return x; }
  // 行政制度：某国某年的统治方式（行政制 / 封建制 / 游牧制……），取自推演的政府组织沿革
  function sysAt(p, y) { const q = H.polities[p], A = G.AdminSys; if (!A) return 'feudal'; if (isRebel(p, y)) return 'rebel'; const L = q.gov; if (!L || !L.length) return A.classOf('', q.govStyle); let k = L[0]; for (const g of L) { if (g[0] > y) break; k = g; } return A.classOf(k[2], q.govStyle); }
  function govLabelAt(p, y) { const L = H.polities[p].gov; if (!L || !L.length) return ''; let k = L[0]; for (const g of L) { if (g[0] > y) break; k = g; } return k[1]; }
  const sysColor = (cl, p) => { const c = G.AdminSys.COL[cl], t = ((p * 2654435761) >>> 0) % 4; return mix(c, [255, 255, 255], [0.28, 0.4, 0.18, 0.34][t]); };
  let sysTally = null;
  const isRebel = (p, y) => { const q = H.polities[p]; return !!q.rtype && y >= q.rebelSince && (q.rebelUntil === null || q.rebelUntil === undefined || y < q.rebelUntil); };
  const nomadQ = q => q.nomad !== undefined ? !!q.nomad : q.type === 'pastoral'; // 游牧是政权自身的生计（文明类型只是倾向）；旧存档无此字段时按文明类型
  const FORM_OF_KEY = { city: 'cityRepublic', kingdom: 'monarchy', empire: 'empire', nomad: 'nomadic', chief: 'chiefdom', theo: 'theocracy', vassal: 'vassal' };
  // 帝号是法理名分：称帝以后即为帝国，与当下疆土大小无关（旧存档没有帝统记录时，按旧规则看规模）
  function empAt(q, y, n, cs, p) { const L = q.emp; if (L === undefined) return n >= H.EMPN && cs >= 5 && liegeAt(p, y) < 0; if (!L) return false; for (let i = 0; i < L.length; i += 2) if (y >= L[i] && (L[i + 1] === null || L[i + 1] === undefined || y < L[i + 1])) return true; return false; }
  // 关闭前缀：后唐帝国 → 唐帝国、东法兰克王国 → 法兰克王国。国名、编年史、图例、世系图一并换；按国号本名整词替换
  let preRe = null, preFor = null;
  function buildPre() {
    preFor = H; const m = new Map();
    H.polities.forEach(q => { if (q.bare && q.bare !== q.short && q.short) m.set(q.short, q.bare); });
    ((app.data && app.data.countries) || []).forEach(k => { const s0 = k._s0 || k.short; if (k.bare && s0 && k.bare !== s0) m.set(s0, k.bare); });
    const keys = [...m.keys()].sort((a, b) => b.length - a.length).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    preRe = keys.length ? { re: new RegExp(keys.join('|'), 'g'), map: m } : null;
  }
  function unpre(s) { if (!s || !app.noPrefix || !H) return s; if (preFor !== H) buildPre(); return preRe ? String(s).replace(preRe.re, x => preRe.map.get(x) || x) : s; }
  function polName(p, y, n) { return unpre(polName0(p, y, n)); }
  function polName0(p, y, n) { const q = H.polities[p]; const fin = q.finalName && y >= H.E - 60; if (fin && !q.finalForm) return q.finalName; if (!fin && isRebel(p, y)) return q.rebelName; if (q.republic) return fin && q.finalForm === 'republic' ? q.finalName : q.short + (q.titles.republic || '共和国'); if (q.theo !== undefined && q.theo !== null && y >= q.theo) return fin && q.finalForm === 'theocracy' ? q.finalName : q.short + (q.titles.theo || '教国'); const T = q.settled != null && y >= q.settled && q.titles2 ? q.titles2 : q.titles; const c = capAt(p, y), cs = c ? stageAt(c[2], y) : 3;
    const f = empAt(q, y, n, cs, p) ? 'empire' : nomadQ(q) && !(q.settled !== undefined && q.settled !== null && y >= q.settled) ? (cs >= 3 ? 'nomad' : 'chief') : n <= 2 && cs <= 3 ? 'city' : liegeAt(p, y) >= 0 && cs >= 3 && n > 2 && T.vassal ? 'vassal' : cs <= 2 ? 'chief' : 'kingdom'; if (fin && q.finalForm === (q.republic ? 'republic' : q.theo != null && y >= q.theo ? 'theocracy' : FORM_OF_KEY[f])) return q.finalName; if (f === 'kingdom' && T.duchy && !(q.king !== undefined && q.king !== null && y >= q.king)) return q.short + T.duchy; if (f === 'empire' && T.nomadEmpire && nomadQ(q) && !(q.settled !== undefined && q.settled !== null && y >= q.settled)) return q.short + T.nomadEmpire; return q.short + (T[f] || q.titles[f]); } // 附庸不称帝；现在的国名在政体一致时沿用；入主定居后用所入主之地的称号

  // ---------- 城市 ----------
  function popAt(i, y) { const n = H.popN, t = y / H.popStep, j = Math.min(n - 2, Math.max(0, Math.floor(t))), f = Math.min(1, t - j); return H.cityPop[i * n + j] * (1 - f) + H.cityPop[i * n + j + 1] * f; }
  const alive = (c, y) => y >= c.founded && !(c.ruined && y >= c.ruined);
  function orderAt(y) { // 当年存在的城市按人口排序（每个年份只算一次）
    if (cityOrder && cityOrderYear === y) return cityOrder;
    const list = []; H.cities.forEach((c, i) => { if (alive(c, y)) { const p = popAt(i, y); if (p > 0) list.push([i, p]); } });
    list.sort((a, b) => b[1] - a[1]); cityOrder = list; cityOrderYear = y; return list;
  }
  function roadPathsAt(y) { // 已修通的道路（按年代排序，取前缀）
    let lo = 0, hi = roadPaths.length; while (lo < hi) { const m = (lo + hi) >> 1; if (roadPaths[m].year <= y) lo = m + 1; else hi = m; }
    if (roadCache.n !== lo) { const out = { trunk: new Path2D(), regional: new Path2D(), local: new Path2D() }; for (let k = 0; k < lo; k++) (out[roadPaths[k].imp] || out.local).addPath(roadPaths[k].p); roadCache = { n: lo, paths: out }; }
    return roadCache.paths;
  }
  const METRO = 3e5; // 大都会：与现在的地图同一个门槛量级
  let holySet = null; // 圣城（与现在的地图同一批）：宗教创立以后才标
  function holyAt(i) { if (!holySet) { holySet = new Map(); const D = app.data; (H.cities || []).forEach((c, k) => { const cc = c.idx >= 0 && D && D.cities ? D.cities[c.idx] : null; if (cc && cc.holy && cc.holy.length) holySet.set(k, Math.min(...cc.holy.map(f => H.religions[f] ? H.religions[f].founded : 0))); }); } const y0 = holySet.get(i); return y0 !== undefined && year >= y0; }
  function drawCities(c, map, ks, free) {
    const v = map.view, dpr = map.dpr, W = map.W, s = v.s, zr = map.zoomRel(), lv = zr < 2.5 ? 0 : zr < 7 ? 1 : 2;
    // 道路
    const rp = roadPathsAt(year);
    for (const k of ks) { c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (v.x + k * W * s), dpr * v.y); c.lineCap = 'round'; c.lineJoin = 'round';
      for (const imp of lv ? ['local', 'regional', 'trunk'] : ['regional', 'trunk']) { const st = ROAD_STYLE[imp]; c.strokeStyle = st[0]; c.lineWidth = st[1] / s; c.stroke(rp[imp]); } }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 废墟
    dots = [];
    H.cities.forEach((ct, i) => { if (!ct.ruined || year < ct.ruined) return; for (const k of ks) { const sx = v.x + (k * W + ct.x) * s, sy = v.y + ct.y * s; if (sx < -30 || sx > map.vw + 30 || sy < -30 || sy > map.vh + 30) continue;
      G.MapIcons.drawRuin(c, sx, sy, 14);
      free(sx - 7, sy - 5, sx + 7, sy + 6); dots.push({ i, x: sx, y: sy, r: 8 });
      if (lv >= 1 || i === cardCity) { c.font = `italic 11px ${SERIF}`; c.textAlign = 'left'; const t = cityName(i, ct.ruined - 1) + '遗址', w = c.measureText(t).width; if (free(sx + 8, sy - 6, sx + 10 + w, sy + 7)) { c.strokeStyle = 'rgba(255,253,246,.9)'; c.lineWidth = 3; c.strokeText(t, sx + 9, sy); c.fillStyle = '#6f6150'; c.fillText(t, sx + 9, sy); } c.textAlign = 'center'; } } });
    // 城市：按人口画圆点，新建的城市闪一圈
    const list = orderAt(year), topN = [70, 260, 100000][lv], nameN = [14, 60, 500][lv];
    // 各国都城（国家越大越优先标名）
    const capOf = new Map(); for (let p = 0; p < polN.length; p++) if (polN[p] > 0) { const c = capAt(p, year); if (c && c[1] >= 0 && alive(H.cities[c[1]], year)) { const o = capOf.get(c[1]); if (o === undefined || polN[p] > polN[o]) capOf.set(c[1], p); } }
    const drawList = list.slice(0, topN); const inList = new Set(drawList.map(x => x[0])); for (const ci of capOf.keys()) if (!inList.has(ci)) drawList.push([ci, popAt(ci, year)]);
    const named = [];
    for (let n = 0; n < drawList.length; n++) { const [i, p] = drawList[n], ct = H.cities[i], capP = layer === 'state' ? capOf.get(i) : undefined;
      const rad = Math.max(2.4, Math.min(6, 1.6 + Math.sqrt(p) / 160));
      for (const k of ks) { const sx = v.x + (k * W + ct.x) * s, sy = v.y + ct.y * s; if (sx < -20 || sx > map.vw + 20 || sy < -20 || sy > map.vh + 20) continue;
        let rr = rad; // 与现在的地图同一套符号：都城（圆中红星）、大都会（圆中黑点）、城市、古城（赭色）、要塞
        if (ct.fort) rr = G.MapIcons.drawFort(c, sx, sy, ct.type, 4); 
        else rr = G.MapIcons.drawCity(c, sx, sy, capP !== undefined ? 'capital' : ct.lost ? 'ancient' : p >= ((H.tiers && H.tiers.metropolis) || METRO) ? 'metro' : p >= ((H.tiers && H.tiers.city) || 2e4) ? 'city' : 'town', { r: capP !== undefined ? Math.max(G.MapIcons.R0.capital, rad + 1) : rad, sel: i === cardCity });
        if (holyAt(i)) G.MapIcons.drawHoly(c, sx - rr - 4, sy - rr - 4, null, 5.5);
        free(sx - rr, sy - rr, sx + rr, sy + rr); dots.push({ i, x: sx, y: sy, r: rr + 3 });
        if (n < nameN || i === cardCity || (capP !== undefined && polN[capP] >= (lv ? 1 : 3))) named.push([i, sx, sy, rr, p]); } }
    return named;
  }
  function drawCityNames(c, named, free) {
    c.textAlign = 'left'; c.textBaseline = 'middle';
    for (const [i, sx, sy, rad, p] of named) { const ct = H.cities[i], big = p >= 1e5; c.font = `${ct.lost ? 'italic ' : ''}${big ? 600 : 500} ${big ? 12.5 : 11.5}px ${SERIF}`;
      const t = cityName(i, year), w = c.measureText(t).width; let x0 = sx + rad + 3; if (!free(x0, sy - 7, x0 + w, sy + 7)) { x0 = sx - rad - 3 - w; if (!free(x0, sy - 7, x0 + w, sy + 7)) continue; }
      c.strokeStyle = 'rgba(255,253,246,.92)'; c.lineWidth = 3; c.strokeText(t, x0, sy); c.fillStyle = ct.lost ? '#6b4a26' : '#2b2420'; c.fillText(t, x0, sy); }
    c.textAlign = 'center';
  }
  function click(sx, sy) {
    if (!H) return false; let best = -1, bd = 1e9; if (showCities) for (const d of dots) { const dd = Math.hypot(d.x - sx, d.y - sy); if (dd < d.r + 4 && dd < bd) { bd = dd; best = d.i; } }
    if (best < 0) { $('tlCity').hidden = true; cardCity = -1;
      if (layer === 'prov') { const g = app.map.toGrid(sx, sy), r = regionAtPoint(g[0], g[1]); // 省份图层按着色所用的全分辨率区块选取
        if (r) openProv(r); else closeProv(); app.map.draw(); return false; }
      if (layer === 'state' || layer === 'prov' || layer === 'unrest' || layer === 'sys') { const g = app.map.toGrid(sx, sy), gx = ((Math.floor(g[0] / 2) % H.W) + H.W) % H.W, gy = Math.floor(g[1] / 2); const r = gy >= 0 && gy < H.H ? H.regionOf[gy * H.W + gx] : 0; const o = r ? ownerAt(r, year) : -1; if (o >= 0) setFocus(o); else clearFocus(); }
      app.map.draw(); return false; }
    closeProv(); cardCity = best; renderCityCard(); app.map.draw(); return true;
  }
  const fmtPop = p => p >= 1e6 ? (p / 1e6).toFixed(p >= 1e7 ? 0 : 2).replace(/\.?0+$/, '') + ' 百万' : p >= 1e4 ? (p / 1e4).toFixed(p >= 1e5 ? 0 : 1).replace(/\.0$/, '') + ' 万' : Math.round(p).toLocaleString();
  function renderCityCard() {
    const el = $('tlCity'), c = H.cities[cardCity]; if (!c) { el.hidden = true; return; }
    const i = cardCity, now = alive(c, year) ? popAt(i, year) : 0;
    const civAt = y => { const s = stageAt(c.r, y), cu = cultureAt(c.r, y, s); return cu >= 0 ? H.civs[cu] : cu !== null && cu <= -2 ? H.ancient[-2 - cu] : null; };
    const fc = civAt(c.founded), kind = c.lost ? `古城 · ${H.ancient[c.ancient] ? H.ancient[c.ancient].name : ''}` : c.fort ? '要塞关隘' : { port: '海港', 'island-port': '岛港', 'lake-port': '湖港', 'river-city': '河港', oasis: '绿洲', market: '集镇' }[c.type] || '城市';
    const state = year < c.founded ? `尚未建城（第 ${c.founded} 年建城）` : c.ruined && year >= c.ruined ? `已是废墟（第 ${c.ruined} 年${c.cause}）` : `${fmtPop(now)} 人`;
    const evs = H.events.filter(e => e.city === i || (e.kind === 'plague' && e.r === c.r)).slice(0, 6);
    el.innerHTML = `<button class="tl-icon tl-city-x" data-act="x" title="关闭"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <p class="tl-city-eyebrow">${esc(kind)}</p><h3>${esc(cityName(i, Math.max(c.founded, Math.min(year, c.ruined ? c.ruined - 1 : H.E))))}${c.ruined ? '<small>遗址</small>' : ''}</h3>${(() => { const nm = cityName(i, Math.max(c.founded, Math.min(year, c.ruined ? c.ruined - 1 : H.E))); return c.names && nm !== c.name ? `<p class="tl-now">${c.lost ? '初名' : '今名'} ${esc(c.name)}</p>` : ''; })()}
      <dl><div><dt>第 ${Math.round(year)} 年</dt><dd>${state}</dd></div>${(() => { if (!c.r || !alive(c, year)) return ''; const p = ownerAt(c.r, year); if (p < 0) return '<div><dt>归属</dt><dd>部族地带</dd></div>'; let n = 0; for (let k = 1; k <= H.nR; k++) if (ownerAt(k, year) === p) n++; const cp = capAt(p, year); return `<div><dt>归属</dt><dd><a class="tl-link" data-focus="${p}" title="单独看这个国家">${esc(polName(p, year, n))}</a>${cp && cp[1] === i ? ' · 都城' : ''}</dd></div>`; })()}<div><dt>建城</dt><dd>第 ${c.founded} 年${fc ? ' · ' + esc(fc.name) : ''}</dd></div>
      <div><dt>鼎盛</dt><dd>第 ${c.peakYear} 年 · ${fmtPop(c.peakPop)} 人</dd></div>${c.lost ? `<div><dt>结局</dt><dd>第 ${c.ruined} 年${c.cause}</dd></div>` : `<div><dt>如今</dt><dd>${fmtPop(c.final)} 人</dd></div>`}</dl>
      ${c.names ? `<h4 class="tl-sub">名称沿革<small>${new Set(c.names.map(x => x[1])).size} 个名字</small></h4>${namesHtml(c.names, c.ruined || H.E)}` : ''}
      <canvas id="tlCityCurve"></canvas>
      ${evs.length ? `<ul>${evs.map(e => `<li><b>${e.year}</b>${esc(unpre(e.text))}</li>`).join('')}</ul>` : ''}
      <div class="tl-city-acts"><button data-act="found">跳到建城</button><button data-act="peak">跳到鼎盛</button>${c.ruined ? '<button data-act="ruin">跳到毁弃</button>' : ''}<button data-act="fly">放大</button></div>`;
    el.hidden = false; drawCityCurve();
  }
  // 名称沿革列表（城市卡与省份卡共用）：当年用的那个名字高亮，点一行跳到那一年
  function namesHtml(L, endY) {
    return `<ol class="tl-names">${L.map((x, k) => { const b = k + 1 < L.length ? L[k + 1][0] : endY + 1, on = year >= x[0] && year < b, who = x[3] >= 0 && H.polities[x[3]] ? nameWhen(x[3], x[0]) : '';
      return `<li class="${on ? 'cur' : ''}" data-year="${x[0]}" title="跳到第 ${x[0]} 年"><b>${x[0]}</b><span>${esc(x[1])}</span><small>${esc(NM_WHY[x[2]] || '')}${who ? ' · ' + esc(who) : ''}</small></li>`; }).join('')}</ol>`;
  }
  // ---------- 省份卡：一个省的名字、设立、析置与撤销；这片土地历代所属的省（含已撤销的） ----------
  function provSeqOf(r) { // 区块 r 历代所属的省：[[始年, 省, 止年], ...]（相邻同省合并，未设省的空档略去）
    const L = H.provLog, out = []; if (!L) return out; for (let k = L.off[r]; k < L.off[r + 1]; k++) { const y = Math.round(L.year[k]), v = L.val[k], last = out[out.length - 1]; if (last && last[2] === null && last[1] === v) continue; if (last && last[2] === null) last[2] = y; if (v >= 0) out.push([y, v, null]); }
    return out.map(x => [x[0], x[1], x[2] === null ? (H.provinces[x[1]].abolished ?? H.E + 1) : x[2]]).filter(x => x[2] > x[0]); // 同一年设了又撤的过渡省略去
  }
  function openProv(r) { const seq = provSeqOf(r); const now = provAt(r, year), o = ownerAt(r, year); let v = now >= 0 && o >= 0 ? now : -1;
    if (v < 0 && seq.length) { const before = seq.filter(x => x[0] <= year); v = (before.length ? before[before.length - 1] : seq[0])[1]; }
    provCard = { r, v, seq }; $('tlCity').hidden = true; cardCity = -1; renderProvCard(); }
  function closeProv() { if (!provCard) return; provCard = null; provPath = null; $('tlProv').hidden = true; }
  function provRegionsAt(v, y) { const S = []; for (let k = 1; k <= H.nR; k++) if (provAt(k, y) === v && ownerAt(k, y) >= 0) S.push(k); return S; }
  function renderProvCard() {
    const el = $('tlProv'); if (!provCard) { el.hidden = true; return; }
    const { r, v, seq } = provCard, ab = v => { const a = H.provinces[v].abolished; return a !== null && a !== undefined ? a : null; };
    if (v < 0) { provPath = null; el.innerHTML = `<button class="tl-icon tl-city-x" data-act="x" title="关闭"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button><p class="tl-city-eyebrow">省份</p><h3>未曾设省</h3><p class="tl-none">这片土地在整部历史上都没有编入过哪个省（部族地带、城邦或王国直辖）。</p>`; el.hidden = false; return; }
    const X = H.provinces[v], a0 = X.created, a1 = ab(v), end = a1 !== null ? a1 : H.E + 1, live = year >= a0 && year < end;
    const yy = Math.round(Math.max(a0, Math.min(year, end - 1))), regs = provRegionsAt(v, live ? year : yy);
    // 地图上描出这个省：今年还在就画当年的范围，否则画它最后（或最初）的样子，虚线
    if (regs.length) { const S = new Uint8Array(H.nR + 1); for (const k of regs) S[k] = 1; const O = H.outline, p = new Path2D(); for (let k = 0; k < O.segA.length; k++) if (S[O.segA[k]] !== S[O.segB[k]]) p.addPath(segPath[k]); provPath = { p, gone: !live }; } else provPath = null;
    const own = live && regs.length ? ownerAt(regs[0], year) : -1, nm = provName(v, yy);
    const seatR = (() => { let s = X.seats && X.seats.length ? X.seats[0][1] : -1; for (const x of X.seats || []) { if (x[0] > yy) break; s = x[1]; } return s; })();
    const seatC = (() => { const L = seatR > 0 ? cityByRegion.get(seatR) : null; let b = -1, bp = 0; if (L) for (const i of L) { const c = H.cities[i]; if (!alive(c, yy)) continue; const pp = popAt(i, yy); if (pp > bp) { bp = pp; b = i; } } return b; })();
    const first = X.hist[1], firstName = first >= 0 && H.polities[first] ? nameWhen(first, a0) : '';
    const plink = (p, y) => `<a class="tl-link" data-focus="${p}" title="单独看这个国家">${esc(nameWhen(p, y))}</a>`;
    const pvl = (w, y) => `<a class="tl-link" data-pv="${w}" data-y="${y}">${esc(provName(w, y))}</a>${ab(w) !== null && ab(w) <= year ? '<em class="tl-ab">已撤</em>' : ''}`;
    const kids = (X.children || []).filter(w => H.provinces[w]), heirs = a1 !== null ? kids.filter(w => H.provinces[w].created >= a1 - 1) : [], splits = kids.filter(w => !heirs.includes(w));
    // 历属：省的主人更替（同一主人连续的合并）
    const own2 = []; for (let i = 0; i < X.hist.length; i += 3) { const p = X.hist[i + 1], y = Math.round(X.hist[i]); if (y >= end) break; if (own2.length && own2[own2.length - 1][1] === p) continue; own2.push([y, p]); }
    const nOld = new Set((X.names || [[0, X.name]]).map(x => x[1])).size;
    el.innerHTML = `<button class="tl-icon tl-city-x" data-act="x" title="关闭"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <p class="tl-city-eyebrow">省份${own >= 0 ? ' · ' + esc(nameWhen(own, year)) : ''}</p><h3>${esc(nm)}${a1 !== null && year >= a1 ? '<small>已撤销</small>' : ''}</h3>${a1 === null && nm !== X.name ? `<p class="tl-now">今名 ${esc(X.name)}</p>` : ''}
      <dl><div><dt>第 ${Math.round(year)} 年</dt><dd>${live ? `辖 ${regs.length} 块疆土` : year < a0 ? `尚未设置（第 ${a0} 年设）` : `已撤销（第 ${a1} 年）`}</dd></div>
        <div><dt>设立</dt><dd>第 ${a0} 年 · ${esc(NM_WHY[X.why === 'pop' ? 'splitPop' : X.kind] || '设置')}${firstName ? ' · ' + plink(first, a0) : ''}</dd></div>
        ${seatC >= 0 ? `<div><dt>治所</dt><dd>${esc(cityName(seatC, yy))}</dd></div>` : ''}
        ${a1 !== null ? `<div><dt>撤销</dt><dd>第 ${a1} 年 · ${esc(AB_WHY[X.why] || '撤销')}</dd></div>` : ''}
        ${heirs.length ? `<div><dt>改置</dt><dd>${heirs.map(w => pvl(w, H.provinces[w].created)).join('、')}</dd></div>` : ''}
        ${X.parents && X.parents.length ? `<div><dt>前身</dt><dd>${X.parents.filter(w => H.provinces[w]).map(w => pvl(w, Math.max(H.provinces[w].created, a0 - 1))).join('、')}</dd></div>` : ''}
        ${splits.length ? `<div><dt>析出</dt><dd>${splits.slice(0, 6).map(w => pvl(w, H.provinces[w].created)).join('、')}${splits.length > 6 ? ` 等 ${splits.length} 省` : ''}</dd></div>` : ''}</dl>
      <h4 class="tl-sub">名称沿革<small>${nOld > 1 ? nOld + ' 个名字' : '未曾改名'}</small></h4>${namesHtml(X.names || [[a0, X.name, X.kind, first]], end)}
      ${own2.length > 1 ? `<h4 class="tl-sub">历属<small>${own2.length} 次易主</small></h4><ol class="tl-names">${own2.slice(0, 14).map(([y, p], k) => `<li class="${year >= y && year < (k + 1 < own2.length ? own2[k + 1][0] : end) ? 'cur' : ''}" data-year="${y}"><b>${y}</b><span>${p >= 0 && H.polities[p] ? esc(nameWhen(p, y)) : '—'}</span></li>`).join('')}${own2.length > 14 ? `<li class="none">……另有 ${own2.length - 14} 次</li>` : ''}</ol>` : ''}
      ${seq.length > 1 ? `<h4 class="tl-sub">此地历代所属<small>${new Set(seq.map(x => x[1])).size} 个省 · ${new Set(seq.filter(x => ab(x[1]) !== null && ab(x[1]) <= year).map(x => x[1])).size} 个已撤销</small></h4><ol class="tl-names tl-seq">${seq.map(x => `<li class="${x[1] === v ? 'sel' : ''}${year >= x[0] && year < x[2] ? ' cur' : ''}" data-pv="${x[1]}" data-y="${x[0]}"><b>${x[0]}</b><span>${esc(provName(x[1], x[0]))}${provName(x[1], x[2] - 1) !== provName(x[1], x[0]) ? `<small> → ${esc(provName(x[1], x[2] - 1))}</small>` : ''}</span><small>${x[0]}–${x[2] > H.E && ab(x[1]) === null ? '今' : x[2]}${ab(x[1]) !== null ? ' · 撤' : ''}</small></li>`).join('')}</ol>` : ''}
      <div class="tl-city-acts"><button data-act="made">跳到设立</button>${a1 !== null ? '<button data-act="gone">跳到撤销</button>' : ''}<button data-act="fly">定位</button></div>`;
    el.hidden = false;
  }
  function drawCityCurve() {
    const cv = $('tlCityCurve'); if (!cv || cardCity < 0) return; const [x, w] = fitCanvas(cv, 56), n = H.popN, i = cardCity; let mx = 1; for (let j = 0; j < n; j++) mx = Math.max(mx, H.cityPop[i * n + j]);
    x.clearRect(0, 0, w, 56); x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, PRE * w, 56);
    x.beginPath(); x.moveTo(0, 54); for (let px = 0; px <= w; px += 2) { const y = yOf(px / w), p = popAt(i, Math.min(H.E, y)); x.lineTo(px, 54 - 50 * p / mx); } x.lineTo(w, 54); x.closePath(); x.fillStyle = 'rgba(176,122,58,.25)'; x.fill();
    x.beginPath(); for (let px = 0; px <= w; px += 2) { const y = yOf(px / w), p = popAt(i, Math.min(H.E, y)); px ? x.lineTo(px, 54 - 50 * p / mx) : x.moveTo(px, 54 - 50 * p / mx); } x.strokeStyle = '#a0682c'; x.lineWidth = 1.5; x.stroke();
    x.fillStyle = '#1a73e8'; x.fillRect(tOf(year) * w - 0.75, 0, 1.5, 56);
  }

  // ---------- 单国视角 ----------
  const lifeEnd = p => { const q = H.polities[p]; return q.died === null || q.died === undefined ? H.E : q.died; };

  // ---------- 人口：区块的城乡总人口曲线（历史推演给出）+ 城市人口；某国某年的人口与构成按疆土现查 ----------
  const popH = n => n >= 1e8 ? (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '<em>亿</em>' : n >= 1e4 ? (n / 1e4).toFixed(n >= 1e6 ? 0 : 1).replace(/\.0$/, '') + '<em>万</em>' : Math.round(n) + '<em>人</em>';
  const popT = n => popH(n).replace(/<\/?em>/g, ' ').trim();
  const pct = (a, b) => { const v = b > 0 ? a / b * 100 : 0; return v >= 10 || v === 0 ? Math.round(v) + '%' : v >= 1 ? v.toFixed(1).replace(/\.0$/, '') + '%' : '<1%'; };
  function rPopAt(r, y) { const R = H.regionPop; if (!R) return 0; const n = H.popN, t = y / H.popStep, j = Math.min(n - 2, Math.max(0, Math.floor(t))), f = Math.min(1, t - j); return R[r * n + j] * (1 - f) + R[r * n + j + 1] * f; }
  let popSnap = null, popSer = null, focusExt = null;
  function extSeries(set) { // 同一国统各王朝的疆土块数：[[年份, 块数], ...]，同一年的多次易手合并为年末的数
    const O = H.own, d = []; for (let r = 1; r <= H.nR; r++) { let pv = -1; for (let k = O.off[r]; k < O.off[r + 1]; k++) { const o = O.owner[k], y = O.year[k]; if (o === pv) continue; if (set.has(pv)) d.push(y, pv, -1); if (set.has(o)) d.push(y, o, 1); pv = o; } }
    const idx = Array.from({ length: d.length / 3 }, (_, k) => k * 3).sort((a, b) => d[a] - d[b]);
    const cnt = new Map(), m = new Map(); for (const i of set) { cnt.set(i, 0); m.set(i, []); }
    for (const k of idx) { const y = d[k], p = d[k + 1], c = cnt.get(p) + d[k + 2]; cnt.set(p, c); const a = m.get(p); if (a.length && a[a.length - 1][0] === y) a[a.length - 1][1] = c; else a.push([y, c]); }
    return m;
  }
  function popSnapAt(y) { // 当年全世界：各政权疆土上的人口（排名、占比与附庸用）
    const yy = Math.round(y); if (popSnap && popSnap.y === yy && popSnap.H === H) return popSnap;
    const by = new Map(); let world = 0;
    for (let r = 1; r <= H.nR; r++) { const v = rPopAt(r, yy); if (!(v > 0)) continue; world += v; const o = ownerAt(r, yy); if (o >= 0) by.set(o, (by.get(o) || 0) + v); }
    popSnap = { y: yy, H, world, by }; return popSnap;
  }
  const LIVE = [['城市 · 工商', [74, 86, 104]], ['农耕', [196, 160, 72]], ['游牧', [150, 176, 92]], ['渔猎采集', [120, 162, 178]]];
  function popOf(p, y) { // 某国某年的人口与构成
    const q = H.polities[p], nomad = nomadQ(q) && !(q.settled !== null && q.settled !== undefined && y >= q.settled);
    const cu = new Map(), re = new Map(), live = [0, 0, 0, 0], cs = []; let total = 0, urban = 0, regions = 0;
    for (let r = 1; r <= H.nR; r++) { if (ownerAt(r, y) !== p) continue; regions++; const v = rPopAt(r, y);
      const ci = cityByRegion.get(r); if (ci) for (const i of ci) { const c = H.cities[i]; if (!alive(c, y)) continue; const pp = popAt(i, y); if (pp > 0) { urban += pp; cs.push([i, pp]); } }
      if (!(v > 0)) continue; total += v;
      const st = stageAt(r, y), c = cultureAt(r, y, st), f = religionAt(r, y, c), ck = c === null ? 'x' : c, fk = f === null ? 'x' : f;
      cu.set(ck, (cu.get(ck) || 0) + v); re.set(fk, (re.get(fk) || 0) + v);
      const fo = st <= 0 ? 1 : st === 1 ? 0.3 : st === 2 ? 0.14 : st <= 4 ? 0.06 : 0.03, he = (1 - fo) * Math.min(0.9, (H.pasture ? H.pasture[r] : 0) * (nomad ? 1.3 : 0.55));
      live[1] += v * (1 - fo - he); live[2] += v * he; live[3] += v * fo; }
    // 城市人口是总人口的一部分：乡村按生计分，城市单列；城市过于集中时按时代的城市化上限补足乡村（前现代城里住不下三成以上的人）
    const c0 = capAt(p, y), cst = c0 ? stageAt(c0[2], y) : 3, ucap = cst >= 8 ? 0.75 : cst >= 7 ? 0.45 : 0.3;
    const T = Math.max(total, urban / ucap), k = total > 0 ? T / total : 1, rk = total > 0 ? (T - urban) / total : 0;
    for (const m of [cu, re]) for (const [a, v] of m) m.set(a, v * k);
    live[0] = urban; for (let i = 1; i < 4; i++) live[i] *= rk;
    cs.sort((a, b) => b[1] - a[1]);
    return { total: T, urban, regions, cu, re, live, cities: cs };
  }
  function buildPopSeries(set) { // 单国视角：同一国统各王朝的人口曲线（按人口采样间隔）
    const n = H.popN, ser = new Map(); for (const i of set) ser.set(i, new Float64Array(n));
    for (let j = 0; j < n; j++) { const y = Math.min(H.E, j * H.popStep); for (let r = 1; r <= H.nR; r++) { const v = H.regionPop[r * n + j]; if (!(v > 0)) continue; const o = ownerAt(r, y); const a = ser.get(o); if (a) a[j] += v; }
      const ub = new Map(); H.cities.forEach((c, i) => { if (c.fort || !c.r || !alive(c, y)) return; const o = ownerAt(c.r, y); if (ser.has(o)) ub.set(o, (ub.get(o) || 0) + H.cityPop[i * n + j]); });
      for (const [o, u] of ub) { const c0 = capAt(o, y), cst = c0 ? stageAt(c0[2], y) : 3, ucap = cst >= 8 ? 0.75 : cst >= 7 ? 0.45 : 0.3, a = ser.get(o); a[j] = Math.max(a[j], u / ucap); } } // 与 popOf 同一套城市化上限
    // 采样每 50 年一次，末次（如第 3350 年）早于今年：存续至今的国家补算今年的人口，曲线末端与面板读数一致，不会斜着掉到零
    const tail = new Map(); for (const i of set) if (lifeEnd(i) >= H.E && (n - 1) * H.popStep < H.E) tail.set(i, popOf(i, H.E).total);
    const peak = new Map(); for (const [i, a] of ser) { const q = H.polities[i]; let mx = 0, my = q.born; for (let j = 0; j < n; j++) { const y = Math.min(H.E, j * H.popStep); if (y < q.born || y > lifeEnd(i)) continue; if (a[j] > mx) { mx = a[j]; my = y; } } if (tail.has(i) && tail.get(i) > mx) { mx = tail.get(i); my = H.E; } peak.set(i, [mx, my]); }
    return { ser, peak, set, tail };
  }
  function countAt(p, y) { let n = 0; for (let r = 1; r <= H.nR; r++) if (ownerAt(r, y) === p) n++; return n; }
  const nameWhen = (p, y) => polName(p, y, countAt(p, y) || H.polities[p].peakN);
  function lineageOf(p) { // 同一国统：改朝换代、起义建立的新朝共享国统；复国把前后两段国统连起来
    const set = new Set([p]); if (!focusLinOn) return set; const P = H.polities, lins = new Set([P[p].lin]);
    for (let it = 0; it < 3; it++) { P.forEach((q, i) => { if (lins.has(q.lin)) set.add(i); }); for (const i of [...set]) { const q = P[i]; if (q.restoreOf >= 0) lins.add(P[q.restoreOf].lin); } P.forEach((q, i) => { if (q.restoreOf >= 0 && set.has(q.restoreOf)) lins.add(q.lin); }); }
    P.forEach((q, i) => { if (lins.has(q.lin)) set.add(i); }); return set; }
  function setFocus(p) {
    if (!H || p < 0) return; focusP = p; focusLin = lineageOf(p); const q = H.polities[p];
    // 鼎盛疆域的轮廓
    const S = new Uint8Array(H.nR + 1); for (let r = 1; r <= H.nR; r++) if (ownerAt(r, q.peakYear) === p) S[r] = 1;
    const O = H.outline; ghostPath = new Path2D(); for (let k = 0; k < O.segA.length; k++) if (S[O.segA[k]] !== S[O.segB[k]]) ghostPath.addPath(segPath[k]);
    if (year < q.born || year > lifeEnd(p)) setYear(q.born); else setYear(year);
    $('tlCity').hidden = true; cardCity = -1; closeProv(); renderFocus(); dirty = true;
    const life = $('tlLife'); life.hidden = false; life.style.left = (tOf(q.born) * 100) + '%'; life.style.width = ((tOf(lifeEnd(p)) - tOf(q.born)) * 100) + '%';
    const c = capAt(p, Math.min(Math.max(year, q.born), lifeEnd(p))); if (c) app.map.flyTo(H.cx[c[2]], H.cy[c[2]], Math.max(1.6, app.map.zoomRel()));
    renderLegend(); app.map.draw();
  }
  function clearFocus() { focusP = -1; focusLin = null; ghostPath = null; $('tlFocus').hidden = true; $('tlLife').hidden = true; dirty = true; renderLegend(); app.map.draw(); }
  const PV_KIND = { establish: '初置', 'from-state': '以国为省', conquer: '攻取改隶', inherit: '承继', secede: '割据而得', reform: '改制', split: '析置' };
  const RTYPE = { monotheist: '一神天启', dualist: '光暗二元', polytheist: '多神信仰', dharmic: '轮回觉悟', ancestral: '祖灵礼教', shamanic: '萨满万灵', philosophy: '哲学教化' };
  const GOVS = { bureaucratic: '官僚制', feudal: '封建制', tribal: '部族制', mercantile: '商贸型', temple: '神庙型' };
  function renderFocus() {
    const el = $('tlFocus'), p = focusP, q = H.polities[p], end = lifeEnd(p), P = H.polities;
    const civ = q.civ >= 0 && H.civs[q.civ] ? H.civs[q.civ] : q.civ <= -2 && H.ancient[-2 - q.civ] ? H.ancient[-2 - q.civ] : null;
    const nm = (i, y) => `<a class="tl-link" data-focus="${i}">${esc(nameWhen(i, y))}</a>`;
    const ORIG = { split: i => `由${nm(i, q.born - 1)}分裂而来`, secede: i => `脱离${nm(i, q.born - 1)}自立`, dynasty: i => `取代${nm(i, q.born - 1)}（改朝换代）`, revolt: i => `由反抗${nm(i, q.born)}的起义建立`, restore: i => `复兴${nm(i, Math.min(q.born - 1, P[i].peakYear))}` };
    const orig = q.parents.map(x => (ORIG[x.kind] || (i => `承${nm(i, q.born - 1)}`))(x.id)).join('；') || (q.rtype ? '起义' : '自立建国');
    const ENDK = { conquer: i => `为${nm(i, end)}所灭`, dynasty: i => `被${nm(i, end)}取代`, overthrow: i => `被起义推翻，${nm(i, end)}代之`, restore: i => `后由${nm(i, P[i].born)}复国` };
    const endTxt = q.died === null || q.died === undefined ? '延续至今' : (q.children.filter(x => ENDK[x.kind]).map(x => ENDK[x.kind](x.id)).join('；') || '消亡');
    // 帝号：法理上的最高名分，称帝以后国势再衰也还在，亡国或称臣才废
    const EL = q.emp || [], empTxt = EL.length ? Array.from({ length: EL.length / 2 }, (_, k) => { const a = EL[2 * k], b = EL[2 * k + 1]; return `第 ${a} 年称帝 — ${b === null || b === undefined ? (q.died === null || q.died === undefined ? '至今' : '第 ' + end + ' 年') : '第 ' + b + ' 年'}`; }).join('；') : '';
    // 历代辖省
    const pv = []; H.provinces.forEach((X, v) => { const hh = X.hist; for (let i = 0; i < hh.length; i += 3) if (hh[i + 1] === p) { const a = hh[i], b = i + 3 < hh.length ? hh[i + 3] : (X.abolished !== null && X.abolished !== undefined ? Math.min(X.abolished, end) : end); pv.push([a, b, provName(v, a), PV_KIND[hh[i + 2]] || '', X.abolished !== null && X.abolished !== undefined && X.abolished <= b + 1]); } });
    pv.sort((a, b) => a[0] - b[0]);
    const revs = H.events.filter(e => e.kind === 'revolt' && e.q === p), OUT = { suppress: '被镇压', state: '割据成国', overthrow: '推翻王朝' };
    const evAll = H.events.filter(e => e.kind !== 'revolt' && e.kind !== 'suppress' && (e.p === p || e.q === p || (e.kids && e.kids.includes(p))));
    // 从兴起到衰亡都要看得到：事件多时先略去改隶、析置之类的琐事，再多就只保留开头、结尾各 30 件与中间的大事
    const MINOR = new Set(['transfer', 'provSplit', 'provRedraw', 'migrate', 'hordeJoin', 'disaster']);
    let evs = evAll.length > 40 ? evAll.filter(e => !MINOR.has(e.kind)) : evAll;
    if (evs.length > 90) evs = evs.filter((e, i) => i < 30 || i >= evs.length - 30 || e.major);
    const lin = [...focusLin].sort((a, b) => P[a].born - P[b].born);
    const pc = Array.isArray(q.color) ? q.color.join(',') : String(q.color), alive0 = q.died === null || q.died === undefined;
    const sec = (title, extra, body, cls = '') => `<section class="tf-sec ${cls}"><h4><span>${title}</span>${extra ? `<small>${extra}</small>` : ''}</h4>${body}</section>`;
    const ord = i => String(i + 1).padStart(2, '0');

    // 思潮与国力：两条国力刻度 + 思潮标签
    const ideasHtml = q.ideaAdopt && q.ideaAdopt.length && H.ideas ? (() => { const MIL = { iron: 1, feudal: 0.5, gunpowder: 1.5, manufactory: 0.5 }, ADM = { bureau: 1, law: 0.5, coin: 0.5, academy: 0.5, print: 0.5 }; let m = 0, a = 0; for (const [k] of q.ideaAdopt) { const id = H.ideas[k].id; m += MIL[id] || 0; a += ADM[id] || 0; }
      const meter = (cls, label, v, mx, desc) => { const k = Math.round(Math.min(1, v / mx) * 12); return `<div class="tf-meter ${cls}"><b>${label}</b><i>${Array.from({ length: 12 }, (_, j) => `<s${j < k ? ' class="on"' : ''}></s>`).join('')}</i><em>${Math.round(Math.min(1, v / mx) * 100)}</em><small>${v ? desc : '尚无'}</small></div>`; };
      const KIND = { mil: '军事', adm: '治理', sea: '可远洋殖民' }, seen = new Set();
      const tags = q.ideaAdopt.map(([k, t]) => { const I = H.ideas[k], kc = MIL[I.id] ? 'mil' : ADM[I.id] ? 'adm' : I.opt ? 'sea' : ''; if (kc) seen.add(kc); return `<li class="${kc}" data-year="${t}"${kc ? ` title="${KIND[kc]}"` : ''}><b>${t}</b>${esc(I.name)}</li>`; }).join('');
      return sec('思潮与国力', `${q.ideaAdopt.length} 条`, `<div class="tf-meters">${meter('mil', '军事', m, 3.5, '冶铁、骑士、火器……带来的战场优势')}${meter('adm', '治理', a, 3, '官僚、律法、货币……带来的赋税、管辖与稳定')}</div><ul class="tf-tags tf-fade">${tags}</ul>${seen.size ? `<p class="tf-key">${[...seen].map(k => `<span class="${k}">${KIND[k]}</span>`).join('')}</p>` : ''}`); })() : '';
    // 政府组织：分阶段的制度演进
    const govHtml = q.gov && q.gov.length ? sec('政府组织', esc(GOVS[q.govStyle] || ''), `<ol class="tf-steps">${q.gov.map((g, i) => `<li data-year="${g[0]}" data-end="${i + 1 < q.gov.length ? q.gov[i + 1][0] : end + 1}"><i>${ord(i)}</i><span>${esc(g[1])}</span><b>${g[0]}</b></li>`).join('')}</ol>`) : '';
    // 君主世系：族谱竖线 + 在位长短
    const R = q.rulers || [], RS = R.slice(0, 160), rEnd = i => i + 1 < R.length ? R[i + 1][0] : end, maxReign = Math.max(1, ...RS.map((r, i) => rEnd(i) - r[0]));
    const rName = s => { const t = String(s).split(' '); return t.length === 2 ? `<em>${esc(t[0])}</em>${esc(t[1])}` : esc(s); };
    const HS = q.houses || null; // 西方式：一个国家，历代王朝
    const rulersHtml = R.length ? sec('君主世系', `${HS ? HS.length + ' 个王朝' : esc(q.houseName || '')} · ${R.length} 位`, `${HS ? `<ol class="tf-houses">${HS.map((x, k) => `<li data-year="${x[0]}" data-end="${k + 1 < HS.length ? HS[k + 1][0] : end + 1}"><b>${x[0]}</b><span>${esc(x[1])}</span>${k && x[2] ? '<em>政变夺位</em>' : ''}</li>`).join('')}</ol>` : ''}<ul class="tf-rulers tf-fade">${RS.map((r, i) => { const last = i + 1 >= R.length, len = rEnd(i) - r[0];
      const hd = HS && r[3] !== undefined && (i === 0 || RS[i - 1][3] !== r[3]) && HS[r[3]] ? `<li class="tf-house-sep">${esc(HS[r[3]][1])}</li>` : '';
      return `${hd}<li data-year="${r[0]}" data-end="${last ? end + 1 : R[i + 1][0]}"><b>${r[0]}</b><span>${rName(r[1])}<small>${esc(r[2])}${last ? (alive0 ? ' · 在位至今' : ' · 末代') : ' · 在位 ' + len + ' 年'}</small></span><u style="width:${Math.max(4, len / maxReign * 100)}%"></u></li>`; }).join('')}${R.length > 160 ? `<li class="none">……另有 ${R.length - 160} 位</li>` : ''}</ul>`) : '';
    // 历代都城：迁都链
    const capName = c => c[1] >= 0 && H.cities[c[1]] ? esc(cityName(c[1], c[0])) : nomadQ(q) && !(q.settled != null && c[0] >= q.settled) ? '王庭<small>逐水草而居</small>' : stageAt(c[2], c[0]) <= 2 ? '部落中心' : '<small>尚无城邑</small>';
    const capsHtml = sec('历代都城', q.caps.length > 1 ? `迁都 ${q.caps.length - 1} 次` : '', `<ol class="tf-chain">${q.caps.map((c, i) => `<li data-year="${c[0]}" data-end="${i + 1 < q.caps.length ? q.caps[i + 1][0] : end + 1}"><b>${c[0]}</b><span>${capName(c)}</span>${q.settled != null && c[0] === q.settled && q.settled > q.born ? '<em>入主定居</em>' : ''}</li>`).join('')}</ol>`);
    // 历代辖省：行省格子
    const pvHtml = sec('历代辖省', String(pv.length), pv.length ? `<ul class="tf-grid tf-fade">${pv.slice(0, 40).map(x => `<li data-year="${x[0]}" data-end="${x[1]}"><span>${esc(x[2])}</span><b>${x[0]}–${x[1]}</b>${x[3] || x[4] ? `<small>${x[3]}${x[4] ? (x[3] ? ' · ' : '') + '后撤销' : ''}</small>` : ''}</li>`).join('')}</ul>` : '<p class="tf-none">未设行省（城邦或王国时代以都城直辖）</p>');
    // 起义与民变：结局徽记
    const revHtml = sec('起义与民变', String(revs.length), revs.length ? `<ul class="tf-revs tf-fade">${revs.map(e => { const o = P[e.p].outcome; return `<li data-year="${e.year}"><b>${e.year}</b><span>${esc(P[e.p].rebelName || '起义')}</span>${OUT[o] ? `<em class="o-${o}">${OUT[o]}</em>` : ''}</li>`; }).join('')}</ul>` : '<p class="tf-none">境内未发生起义</p>');
    // 大事：编年竖轴
    const evHtml = sec('大事', evs.length ? String(evs.length) : '', `<ul class="tf-annals tf-fade">${evs.map(e => `<li data-year="${e.year}"><b>${e.year}</b><span>${esc(unpre(e.text))}</span></li>`).join('') || '<li class="none">—</li>'}</ul>`);
    const linHtml = `<section class="tf-sec"><h4><span>国统</span><small>${lin.length} 朝</small><label class="tl-lin"><input type="checkbox" id="tlLinOn"${focusLinOn ? ' checked' : ''}>一并高亮</label></h4><div class="tl-linlist">${lin.map(i => `<a class="tl-chipl${i === p ? ' on' : ''}" data-focus="${i}"><i style="background:rgb(${P[i].color})"></i>${esc(nameWhen(i, Math.min(P[i].peakYear, lifeEnd(i))))}${P[i].houseName && lin.some(j => j !== i && P[j].short === P[i].short) ? `<small>${esc(P[i].houseName)}</small>` : ''}<small>${P[i].born}</small></a>`).join('')}</div></section>`;
    const kindTxt = (civ ? esc(civ.name) + ' · ' : '') + (q.rtype ? '起义政权' : ({ pastoral: '游牧', maritime: '海洋', highland: '山地', tribal: '部族', agrarian: '农耕', 'new-world': '新大陆' }[q.type] || '') + '国家');
    el.style.setProperty('--pc', pc);
    el.innerHTML = `<button class="tl-icon tl-city-x" data-act="x" title="退出单国视角（Esc）"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <header class="tf-head"><p class="tf-eyebrow"><i></i>${kindTxt}</p><h3 id="tlFocusName"></h3><p class="tf-sub">第 ${q.born} 年 — ${alive0 ? '至今' : '第 ' + q.died + ' 年'}</p></header>
      <div class="tf-kpis" id="tlFocusNow"></div>
      <div class="tf-span" title="在整部历史中的位置"><em style="left:${tOf(q.born) * 100}%;width:${Math.max(0.6, (tOf(end) - tOf(q.born)) * 100)}%"></em><u id="tlFocusMark"></u></div>
      <dl class="tf-fate"><div><dt>来历</dt><dd>${orig}</dd></div><div><dt>结局</dt><dd>${endTxt}</dd></div><div><dt>都城</dt><dd id="tlFocusCap">—</dd></div>${empTxt ? `<div><dt>帝号</dt><dd>${empTxt}</dd></div>` : ''}</dl>
      <div class="tf-chart"><canvas id="tlFocusCurve"></canvas></div>
      ${H.regionPop ? `<section class="tf-sec tf-popsec"><h4><span>人口</span><small id="tlPopWhen"></small></h4><div id="tlPop"></div><div class="tf-chart tf-popcurve"><canvas id="tlPopCurve"></canvas></div></section>` : ''}
      ${ideasHtml}${govHtml}${rulersHtml}${capsHtml}${pvHtml}${revHtml}${evHtml}${linHtml}
      <div class="tl-city-acts tf-acts"><button data-act="play" class="pri"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>从建国播放</button><button data-act="peak">跳到鼎盛</button><button data-act="fly">定位</button></div>`;
    el.hidden = false; el.querySelectorAll('.tf-fade').forEach(fadeEnd); renderFocusLive();
  }
  const fadeEnd = u => u.classList.toggle('end', u.scrollHeight - u.clientHeight - u.scrollTop < 2);
  function renderFocusLive() {
    if (focusP < 0 || $('tlFocus').hidden) return; const p = focusP, q = H.polities[p], end = lifeEnd(p), alive = year >= q.born && year <= end;
    const n = alive ? countAt(p, year) : 0, c = alive ? capAt(p, year) : null;
    const nm0 = alive ? polName(p, year, n || 1) : nameWhen(p, q.peakYear); $('tlFocusName').textContent = nm0;
    const mk = $('tlFocusMark'); if (mk) mk.style.left = (tOf(year) * 100) + '%';
    const capTxt = c && c[1] >= 0 && H.cities[c[1]] ? '都城 ' + esc(cityName(c[1], year)) : '';
    $('tlFocusNow').innerHTML = `<div><small>国祚</small><b>${end - q.born}<em>年</em></b></div><div><small>第 ${Math.round(year)} 年</small><b>${alive ? n + '<em>块疆土</em>' : `<span>${year < q.born ? '尚未建国' : '已亡'}</span>`}</b></div><div class="${Math.round(year) === q.peakYear ? 'hot' : ''}"><small>鼎盛 · ${q.peakYear}</small><b>${q.peakN}<em>块疆土</em></b></div>`;
    $('tlFocusCap').innerHTML = alive ? (capTxt ? capTxt.replace('都城 ', '') : '<span class="mute">无定都</span>') : '<span class="mute">—</span>';
    $('tlFocus').querySelectorAll('li[data-end]').forEach(li => li.classList.toggle('cur', year >= +li.dataset.year && year < +li.dataset.end));
    // 疆域曲线：本国实线，同一国统的其他王朝淡色
    const cv = $('tlFocusCurve'); const [x, w] = fitCanvas(cv, 74), Hh = 74; x.clearRect(0, 0, w, Hh);
    const lin = [...focusLin], a0 = Math.min(...lin.map(i => H.polities[i].born)), a1 = Math.max(...lin.map(i => lifeEnd(i))), span = Math.max(50, a1 - a0);
    // 疆土曲线：按每块疆土的易手记录逐次累计，每一次得失都在曲线上（与面板读数同源，末端就是今年 / 亡国时的实数）
    if (!focusExt || focusExt.H !== H || focusExt.set !== focusLin) focusExt = { H, set: focusLin, m: extSeries(focusLin) };
    let mx = 1; for (const i of lin) for (const v of focusExt.m.get(i)) mx = Math.max(mx, v[1]);
    const X = yy => (yy - a0) / span * (w - 4) + 2, Yv = nn => Hh - 12 - nn / mx * (Hh - 18);
    for (const i of lin) { const Q = H.polities[i], pts = focusExt.m.get(i), b1 = lifeEnd(i); if (!pts.length) continue; x.beginPath(); x.moveTo(X(Q.born), Yv(0)); let last = 0;
      for (const [yy, nn] of pts) { if (yy > b1) break; x.lineTo(X(Math.max(Q.born, yy)), Yv(nn)); last = nn; } x.lineTo(X(b1), Yv(last)); x.lineTo(X(b1), Yv(0)); x.closePath();
      x.fillStyle = `rgba(${Q.color},${i === p ? 0.28 : 0.1})`; x.fill(); if (i === p) { x.strokeStyle = `rgb(${Q.color})`; x.lineWidth = 1.5; x.stroke(); } }
    x.fillStyle = '#8b96a0'; x.font = '10px sans-serif'; x.textBaseline = 'bottom'; x.textAlign = 'left'; x.fillText(String(a0), 2, Hh); x.textAlign = 'right'; x.fillText(a1 >= H.E ? '今' : String(a1), w - 2, Hh);
    x.beginPath(); x.arc(X(q.peakYear), Yv(q.peakN), 4.5, 0, 7); x.fillStyle = '#fff'; x.fill(); x.beginPath(); x.arc(X(q.peakYear), Yv(q.peakN), 3, 0, 7); x.fillStyle = '#0f1114'; x.fill();
    x.fillStyle = 'rgba(15,17,20,.1)'; x.fillRect(0, Hh - 12, w, 1); if (year >= a0 && year <= a1) { x.fillStyle = '#0f1114'; x.fillRect(X(year) - 0.5, 0, 1, Hh - 12); }
    renderPopLive();
  }
  function renderPopLive() {
    const el = $('tlPop'); if (!el || !H.regionPop) return; const p = focusP, q = H.polities[p], end = lifeEnd(p);
    const yy = Math.round(Math.max(q.born, Math.min(end, year))), alive = year >= q.born && year <= end;
    $('tlPopWhen').textContent = alive ? `第 ${yy} 年` : year < q.born ? `尚未建国 · 看建国时（第 ${yy} 年）` : `已亡 · 看亡国前（第 ${yy} 年）`;
    if (!popSer || popSer.set !== focusLin || popSer.H !== H) { popSer = buildPopSeries(focusLin); popSer.H = H; }
    const S = popOf(p, yy), W = popSnapAt(yy), mine = S.total, world = W.world + Math.max(0, S.total - (W.by.get(p) || 0));
    let rank = 1; for (const [o, v] of W.by) if (o !== p && v > mine) rank++;
    let vasN = 0, vasP = 0; for (const [o, v] of W.by) if (o !== p && realmAt(o, yy) === p) { vasN++; vasP += v; }
    const [pk, pky] = popSer.peak.get(p) || [0, q.born];
    const bar = (rows, tot) => `<div class="tp-bar">${rows.map(r => `<i style="width:${(r[2] / tot * 100).toFixed(2)}%;background:rgb(${r[1]})" title="${esc(r[0])} ${popT(r[2])}"></i>`).join('')}</div>`;
    const list = (rows, tot) => `<ul class="tp-list">${rows.map(r => `<li><i style="background:rgb(${r[1]})"></i><span>${esc(r[0])}${r[3] ? `<small>${r[3]}</small>` : ''}</span><b>${pct(r[2], tot)}</b><em>${popT(r[2])}</em></li>`).join('')}</ul>`;
    const top = (m, name, color, n = 5) => { const a = [...m].filter(x => x[1] > 0).sort((x, y) => y[1] - x[1]), out = a.slice(0, n).map(([key, v]) => [name(key), color(key), v]); const rest = a.slice(n).reduce((s, x) => s + x[1], 0); if (rest > 0) out.push([`其他 ${a.length - n} 种`, [208, 210, 214], rest]); return out; };
    const block = (title, extra, rows, tot) => rows.length ? `<div class="tp-block"><h5>${title}${extra ? `<small>${extra}</small>` : ''}</h5>${bar(rows, tot)}${list(rows, tot)}</div>` : '';
    const T = S.total;
    if (!(T > 0)) { el.innerHTML = '<p class="tf-none">这一年境内没有定居人口</p>'; drawPopCurve(); return; }
    const cuName = k => k === 'x' ? '采集游群' : k >= 0 ? (H.civs[k] ? H.civs[k].name : '—') : k <= -2 ? (H.ancient[-2 - k] ? H.ancient[-2 - k].name + '（古）' : '古民') : '早期农人';
    const cuCol = k => k === 'x' ? [200, 196, 184] : cuColor(k);
    const reName = k => k === 'x' ? '无' : k >= 0 ? (H.religions[k] ? H.religions[k].name : '—') : '原始信仰';
    const reCol = k => k === 'x' ? [214, 214, 214] : k >= 0 ? relColor(k) : [196, 186, 168];
    const cuRows = top(S.cu, cuName, cuCol), reRows = top(S.re, reName, reCol);
    const mainCu = cuRows[0], mainRe = reRows[0];
    const liveRows = LIVE.map((L, i) => [L[0], L[1], S.live[i]]).filter(r => r[2] > T * 0.001);
    const capC = alive ? capAt(p, yy) : null, capI = capC && capC[1] >= 0 ? capC[1] : -1;
    const cityRows = S.cities.slice(0, 5);
    el.innerHTML = `<div class="tp-head"><div class="tp-big"><small>总人口</small><b>${popH(T)}</b></div><dl class="tp-kv">
        <div><dt>占世界</dt><dd>${pct(mine, world)}</dd></div><div><dt>世界排名</dt><dd>第 ${rank}<small> / ${W.by.size}</small></dd></div>
        <div><dt>城市化</dt><dd>${pct(S.urban, T)}</dd></div><div><dt>鼎盛 · ${pky}</dt><dd>${popT(pk)}</dd></div></dl></div>
      ${vasN ? `<p class="tp-note">连同 ${vasN} 个附庸，天下共 <b>${popT(T + vasP)}</b></p>` : ''}
      <p class="tp-note">${mainCu ? `主体民族为<b>${esc(mainCu[0])}</b>（${pct(mainCu[2], T)}）` : ''}${mainRe ? `，${mainRe[0] === '无' ? '尚无成形的信仰' : `多数信奉<b>${esc(mainRe[0])}</b>（${pct(mainRe[2], T)}）`}` : ''}；平均每块疆土 ${popT(T / Math.max(1, S.regions))}。</p>
      ${block('民族构成', cuRows.length > 1 ? `${S.cu.size} 个族群` : '单一族群', cuRows, T)}
      ${block('信仰构成', reRows.length > 1 ? `${S.re.size} 种信仰` : '', reRows, T)}
      ${block('城乡与生计', '', liveRows, T)}
      ${cityRows.length ? `<div class="tp-block"><h5>主要城市<small>城市人口 ${popT(S.urban)} · ${S.cities.length} 座</small></h5><ol class="tp-cities">${cityRows.map(([i, v]) => `<li><span>${esc(cityName(i, yy))}${i === capI ? '<small>都</small>' : ''}</span><u><s style="width:${(v / cityRows[0][1] * 100).toFixed(1)}%"></s></u><em>${popT(v)}</em></li>`).join('')}</ol></div>` : '<p class="tp-note">境内尚无城市，人口散居于村落与营地。</p>'}`;
    drawPopCurve();
  }
  function drawPopCurve() { // 人口曲线：本国实线，同一国统的其他王朝淡色
    const cv = $('tlPopCurve'); if (!cv || !popSer) return; const p = focusP, q = H.polities[p]; const [x, w] = fitCanvas(cv, 64), Hh = 64; x.clearRect(0, 0, w, Hh);
    const lin = [...focusLin], a0 = Math.min(...lin.map(i => H.polities[i].born)), a1 = Math.max(...lin.map(i => lifeEnd(i))), span = Math.max(50, a1 - a0), n = H.popN, st = H.popStep;
    let mx = 1; for (const i of lin) { const pk = popSer.peak.get(i); if (pk && pk[0] > mx) mx = pk[0]; }
    const X = yy => (yy - a0) / span * (w - 4) + 2, Yv = v => Hh - 12 - v / mx * (Hh - 18);
    for (const i of lin) { const Q = H.polities[i], a = popSer.ser.get(i), b0 = Q.born, b1 = lifeEnd(i); if (!a) continue;
      x.beginPath(); x.moveTo(X(b0), Yv(0)); let lv = 0; for (let j = 0; j < n; j++) { const y = Math.min(H.E, j * st); if (y < b0 || y > b1) continue; lv = a[j]; x.lineTo(X(y), Yv(a[j])); } const tv = popSer.tail.has(i) ? popSer.tail.get(i) : lv; x.lineTo(X(b1), Yv(tv)); x.lineTo(X(b1), Yv(0)); x.closePath();
      x.fillStyle = `rgba(${Q.color},${i === p ? 0.28 : 0.1})`; x.fill(); if (i === p) { x.strokeStyle = `rgb(${Q.color})`; x.lineWidth = 1.5; x.stroke(); } }
    x.fillStyle = '#8b96a0'; x.font = '10px sans-serif'; x.textBaseline = 'bottom'; x.textAlign = 'left'; x.fillText(String(a0), 2, Hh); x.textAlign = 'right'; x.fillText(a1 >= H.E ? '今' : String(a1), w - 2, Hh);
    x.textAlign = 'left'; x.textBaseline = 'top'; x.fillText('峰值 ' + popT(mx), 2, 0);
    const pk = popSer.peak.get(p); if (pk && pk[0] > 0) { x.beginPath(); x.arc(X(pk[1]), Yv(pk[0]), 4.5, 0, 7); x.fillStyle = '#fff'; x.fill(); x.beginPath(); x.arc(X(pk[1]), Yv(pk[0]), 3, 0, 7); x.fillStyle = '#0f1114'; x.fill(); }
    x.fillStyle = 'rgba(15,17,20,.1)'; x.fillRect(0, Hh - 12, w, 1); if (year >= a0 && year <= a1) { x.fillStyle = '#0f1114'; x.fillRect(X(year) - 0.5, 0, 1, Hh - 12); }
  }

  // ---------- 渐变层：先在粗网格上把各区块的颜色按面积加权平均（预乘透明度），再双线性插值回半分辨率 ----------
  // 相邻两种颜色之间自然形成过渡地带；颜色的浓淡来自每个区块自己的强度（治理强度 / 传入久暂）
  const GB = 3;
  let gv = null, gctx = null, gimg = null, gbuf = null, gR, gG, gB, gA, crisp, prevGA = null, cR, cG, cB, cAa, cN, CW = 0, CH = 0, UXr, UYr, UZr;
  function prepGradient() {
    gv = document.createElement('canvas'); gv.width = H.W; gv.height = H.H; gctx = gv.getContext('2d'); gimg = gctx.createImageData(H.W, H.H); gbuf = gimg.data;
    const n = H.nR + 1; gR = new Float32Array(n); gG = new Float32Array(n); gB = new Float32Array(n); gA = new Float32Array(n); crisp = new Uint8Array(n); prevGA = null;
    CW = Math.ceil(H.W / GB); CH = Math.ceil(H.H / GB); cR = new Float32Array(CW * CH); cG = new Float32Array(CW * CH); cB = new Float32Array(CW * CH); cAa = new Float32Array(CW * CH); cN = new Float32Array(CW * CH);
    for (let i = 0; i < H.regionOf.length; i++) if (H.regionOf[i]) { const y = (i / H.W) | 0, x = i - y * H.W; cN[((y / GB) | 0) * CW + ((x / GB) | 0)]++; }
    UXr = new Float64Array(n); UYr = new Float64Array(n); UZr = new Float64Array(n);
    for (let r = 1; r < n; r++) { const lon = H.cx[r] / H.FW * 2 * Math.PI, lat = (0.5 - H.cy[r] / H.FH) * Math.PI; UXr[r] = Math.cos(lat) * Math.cos(lon); UYr[r] = Math.cos(lat) * Math.sin(lon); UZr[r] = Math.sin(lat); }
  }
  const kmR = (a, b) => { const dx = UXr[a] - UXr[b], dy = UYr[a] - UYr[b], dz = UZr[a] - UZr[b]; return Math.sqrt(dx * dx + dy * dy + dz * dz) * (H.Rkm || 6371); };
  function buildGradient() {
    const n = H.nR + 1; let changed = !prevGA;
    if (!changed) for (let r = 1; r < n; r++) if (gA[r] !== prevGA[r * 4] || (gA[r] && (gR[r] !== prevGA[r * 4 + 1] || gG[r] !== prevGA[r * 4 + 2] || gB[r] !== prevGA[r * 4 + 3]))) { changed = true; break; }
    if (!changed) return;
    if (!prevGA) prevGA = new Float32Array(n * 4); for (let r = 1; r < n; r++) { prevGA[r * 4] = gA[r]; prevGA[r * 4 + 1] = gR[r]; prevGA[r * 4 + 2] = gG[r]; prevGA[r * 4 + 3] = gB[r]; }
    cR.fill(0); cG.fill(0); cB.fill(0); cAa.fill(0);
    const W = H.W, Hh = H.H, reg = H.regionOf;
    for (let y = 0; y < Hh; y++) { const cy = ((y / GB) | 0) * CW; for (let x = 0; x < W; x++) { const r = reg[y * W + x]; if (!r) continue; const a = gA[r]; if (!a) continue; const k = cy + ((x / GB) | 0); cR[k] += gR[r] * a; cG[k] += gG[r] * a; cB[k] += gB[r] * a; cAa[k] += a; } }
    for (let k = 0; k < cN.length; k++) if (cN[k]) { cR[k] /= cN[k]; cG[k] /= cN[k]; cB[k] /= cN[k]; cAa[k] /= cN[k]; }
    gbuf.fill(0);
    for (let y = 0; y < Hh; y++) { const v = (y + 0.5) / GB - 0.5, y0 = Math.max(0, Math.min(CH - 1, Math.floor(v))), y1 = Math.min(CH - 1, y0 + 1), fy = Math.max(0, Math.min(1, v - y0));
      for (let x = 0; x < W; x++) { const i = y * W + x, r = reg[i]; if (!r || crisp[r]) continue;
        const u = (x + 0.5) / GB - 0.5, xf = Math.floor(u), fx = u - xf, x0 = ((xf % CW) + CW) % CW, x1 = (x0 + 1) % CW;
        let sw = 0, R0 = 0, G0 = 0, B0 = 0, A0 = 0;
        const acc = (k, w) => { if (!cN[k] || !w) return; sw += w; R0 += cR[k] * w; G0 += cG[k] * w; B0 += cB[k] * w; A0 += cAa[k] * w; };
        acc(y0 * CW + x0, (1 - fx) * (1 - fy)); acc(y0 * CW + x1, fx * (1 - fy)); acc(y1 * CW + x0, (1 - fx) * fy); acc(y1 * CW + x1, fx * fy);
        if (!sw || A0 <= 0) continue; const al = A0 / sw, o = i * 4; gbuf[o] = R0 / A0; gbuf[o + 1] = G0 / A0; gbuf[o + 2] = B0 / A0; gbuf[o + 3] = al * 255; } }
    gctx.putImageData(gimg, 0, 0);
  }

  // 省名必须落在当年的本省陆地上；凹形省界、湖泊和旧飞地不能把质心标签挤进邻省。
  function provinceLabelPoint(v, regs, x, y) {
    const W = H.FW, row = Math.floor(y), col = ((Math.floor(x) % W) + W) % W;
    const at = row >= 0 && row < H.FH ? H.regionF[row * W + col] : 0;
    if (at > 0 && pkey[at] === v) return [x, y];
    let best = null, distance = Infinity;
    for (const r of regs) {
      if (!regionLabelPoints.has(r)) {
        let point = null, dmin = Infinity;
        for (let i = pxOff[r]; i < pxOff[r + 1]; i++) {
          const f = pxList[i], py = Math.floor(f / W) + 0.5, px = f % W + 0.5;
          let dx = Math.abs(px - H.cx[r]); dx = Math.min(dx, W - dx);
          const d = dx * dx + (py - H.cy[r]) ** 2;
          if (d < dmin) { dmin = d; point = [px, py]; }
        }
        regionLabelPoints.set(r, point);
      }
      const point = regionLabelPoints.get(r); if (!point) continue;
      let dx = Math.abs(point[0] - x); dx = Math.min(dx, W - dx);
      const d = dx * dx + (point[1] - y) ** 2;
      if (d < distance) { distance = d; best = point; }
    }
    return best;
  }

  // ---------- 着色 ----------
  function recolor() {
    const nR = H.nR, y = year; polN.fill(0);
    const labG = new Map();
    const addLab = (k, name, r, w, s) => { let g = labG.get(k); if (!g) labG.set(k, g = { key: k, name, cs: 0, sn: 0, sy: 0, w: 0, regs: [], st: new Float64Array(9) }); if (H.newW && H.newW[r] > 0.5) g.nw = true;
      if (k[0] === 'v') g.regs.push(r);
      const ang = H.cx[r] / (H.W * 2) * 2 * Math.PI; g.cs += Math.cos(ang) * w; g.sn += Math.sin(ang) * w; g.sy += H.cy[r] * w; g.w += w; if (s) g.st[s] += w; };
    const provSeen = new Set();
    col[0] = 0; key[0] = -9; crisp[0] = 0; gA[0] = 0; if (!rkey || rkey.length !== nR + 1) rkey = new Int32Array(nR + 1); rkey.fill(-9); vasN = {};
    sysTally = { _w: 0, _tribal: 0 };
    for (let r = 1; r <= nR; r++) {
      const s = stageAt(r, y), cu = cultureAt(r, y, s), cuSince = LOG_SINCE; let rgb = null, a = 0, grad = false;
      key[r] = cu === null ? -9 : cu; // 发展阶段图层里，不同文明之间也画界线（国家图层按政权）
      let strp = 0; pkey[r] = -1;
      if (layer === 'state' || layer === 'prov') { const p = ownerAt(r, y); key[r] = p >= 0 ? p : -9; rkey[r] = p >= 0 ? realmAt(p, y) : -9;
        if (p >= 0) { rgb = H.polities[p].color; if (rkey[r] !== p) { rgb = vassalTint(H.polities[rkey[r]].color, p); } /* 附庸：取宗主的色相 */ if (layer === 'state' && (focusP < 0 || focusLin.has(p))) addLab('p' + p + ':' + H.landComp[r], '', r, H.area[r], s); polN[p]++;
          const cp = capAt(p, y), cs = cp ? stageAt(cp[2], y) : 4;
          if (isRebel(p, y)) { rgb = mix(rgb, [200, 40, 32], 0.55); a = 0.8; strp = 1; pkey[r] = -2; } // 起义军控制：红色斜纹
          else if (cs <= 4) { grad = true; a = (layer === 'prov' ? 0.4 : 0.88) * Math.max(0.3, Math.min(1, 1.25 - kmR(cp ? cp[2] : r, r) / (cs <= 3 ? 320 : 900))); } // 城邦与王国时代：实际治理式的渐变
          else { a = 0.74; const v = orgAt(p, y) ? provAt(r, y) : -2; pkey[r] = v;
            if (v === -1) strp = 1; // 新占领、尚未建制：斜纹
            else if (layer === 'prov' && v >= 0) { rgb = H.provinces[v].color; addLab('v' + v, provName(v, y), r, H.area[r], 0); provSeen.add(v); }
            else if (layer === 'prov') a = 0.35; } }
        else if (s >= 1) { rgb = FARMER; a = 0.2; grad = true; } }
      else if (layer === 'sys') { const p = ownerAt(r, y); key[r] = p >= 0 ? p : -9;
        if (p >= 0) { polN[p]++; const cl = sysAt(p, y); rgb = sysColor(cl, p); a = 0.8; if (cl === 'rebel') strp = 1; const T = sysTally[cl] || (sysTally[cl] = { w: 0, ps: new Map() }); T.w += H.weight[r]; T.ps.set(p, (T.ps.get(p) || 0) + 1); sysTally._w += H.weight[r];
          if (focusP < 0 || focusLin.has(p)) addLab('p' + p + ':' + H.landComp[r], '', r, H.area[r], s); }
        else if (s >= 1) { rgb = FARMER; a = 0.2; grad = true; sysTally._w += H.weight[r]; sysTally._tribal += H.weight[r]; } }
      else if (layer === 'stage') { if (ideaSel >= 0 && H.ideas) { const t = ideaAt(ideaSel, r); if (t <= y) { rgb = STAGE_COL[H.ideas[ideaSel].s]; a = 0.42 + 0.4 * Math.min(1, (y - t) / 200); key[r] = 1; } else if (s >= 1) { rgb = [176, 170, 160]; a = 0.5; key[r] = 0; } } else if (s >= 1) { rgb = STAGE_COL[s]; a = s >= 3 ? 0.74 : 0.5; } } /* 思潮：默认按接纳到的阶段着色；选中一条思潮则看它的传播 */
      else if (layer === 'unrest') { const p = ownerAt(r, y); key[r] = p >= 0 ? p : -9; if (p >= 0) { polN[p]++; if (isRebel(p, y)) addLab('p' + p, '', r, H.area[r], s); }
        const u = unrestAt(r, y); if (s >= 1 && u > 0.12) { rgb = u < 0.45 ? mix([250, 226, 140], [236, 130, 60], (u - 0.12) / 0.33) : mix([236, 130, 60], [160, 24, 24], Math.min(1, (u - 0.45) / 0.4)); a = 0.35 + 0.5 * Math.min(1, u); grad = true; } }
      else if (layer === 'culture') { if (cu !== null) { rgb = cuColor(cu); a = cu === -1 ? 0.25 : 0.32 + 0.5 * Math.min(1, (y - cuSince) / 700); grad = true; } } // 辐射圈：传入越久越浓
      else {
        const f = religionAt(r, y, cu), fSince = LOG_SINCE; key[r] = f === null ? -9 : f >= 0 ? f : -100 + (cu || 0);
        if (f === null) {} else if (f >= 0) { rgb = relColor(f); a = 0.32 + 0.5 * Math.min(1, (y - fSince) / 500); addLab('r' + f, H.religions[f].name, r, H.area[r], 0); } else { rgb = mix(cuColor(cu), [250, 246, 236], 0.55); a = 0.32; }
        grad = f !== null;
      }
      if (focusP >= 0 && (layer === 'state' || layer === 'prov' || layer === 'unrest' || layer === 'sys')) { const o = ownerAt(r, y); if (!(o >= 0 && focusLin.has(o)) && rgb) { rgb = mix(rgb, [208, 203, 194], 0.82); a = Math.min(a, 0.32); strp = 0; } } // 单国视角：其他国家变灰
      if (grad) { crisp[r] = 0; col[r] = VEIL; gR[r] = rgb[0]; gG[r] = rgb[1]; gB[r] = rgb[2]; gA[r] = Math.round(a * 16) / 16; }
      else { crisp[r] = rgb ? 1 : 0; col[r] = rgb ? overVeil(rgb, a) : VEIL; gA[r] = 0; }
      if (strp) col[r] = (col[r] & 0x00ffffff) | (((col[r] >>> 24) - 1) << 24) >>> 0; stripe[r] = strp; // 斜纹区块颜色略作区分以便增量重涂
      if (layer !== 'religion' && layer !== 'state' && layer !== 'sys' && cu !== null && cu !== -1) addLab(cu >= 0 ? 'c' + cu : 'a' + (-2 - cu), cu >= 0 ? H.civs[cu].name : H.ancient[-2 - cu].name, r, H.area[r], s);
    }
    // 清晰层：全分辨率区块编号图查色，只重涂变了颜色的区块
    { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, first = prevCol[0] === 1;
      for (let r = 1; r <= nR; r++) { const c = col[r]; if (c === prevCol[r]) continue; prevCol[r] = c;
        if (stripe[r]) { const c2 = VEIL, FW = H.FW; for (let i = pxOff[r]; i < pxOff[r + 1]; i++) { const px = pxList[i], yy = (px / FW) | 0; buf[px] = ((px - yy * FW + yy) >> 2) & 1 ? c : c2; } } else for (let i = pxOff[r]; i < pxOff[r + 1]; i++) buf[pxList[i]] = c;
        const b = 4 * r; if (pxBox[b + 2] < 0) continue; if (pxBox[b] < x0) x0 = pxBox[b]; if (pxBox[b + 1] < y0) y0 = pxBox[b + 1]; if (pxBox[b + 2] > x1) x1 = pxBox[b + 2]; if (pxBox[b + 3] > y1) y1 = pxBox[b + 3]; }
      prevCol[0] = 0;
      if (first) ovCtx.putImageData(img, 0, 0); else if (x1 >= 0) ovCtx.putImageData(img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1); }
    buildGradient();
    // 界线只画在清晰层上（古典时代以后的国家、发展阶段）
    const O = H.outline; edgePath = new Path2D(); vasEdgePath = new Path2D();
    provEdgePath = new Path2D();
    for (let k = 0; k < O.segA.length; k++) { const a = O.segA[k], b = O.segB[k]; if (!crisp[a] && !crisp[b]) continue;
      if (key[a] !== key[b] || (layer !== 'state' && layer !== 'prov' && col[a] !== col[b])) edgePath.addPath(segPath[k]);
      else if ((layer === 'state' || layer === 'prov') && pkey[a] !== pkey[b] && pkey[a] !== -2 && pkey[b] !== -2) provEdgePath.addPath(segPath[k]); } // 国界粗线，国内省界细虚线
    labels = [];
    for (const g of labG.values()) { if (g.w <= 0) continue; let ang = Math.atan2(g.sn, g.cs); if (ang < 0) ang += 2 * Math.PI;
      let name = g.name;
      if (g.key[0] === 'p') { const [ps, lcs] = g.key.slice(1).split(':'), p = +ps; name = polName(p, y, polN[p]); if (isRebel(p, y)) g.rebel = true;
        const cp = capAt(p, y); if (lcs !== undefined && cp && String(H.landComp[cp[2]]) !== lcs) { if (g.w < 40000) continue; if (g.nw && !(H.newW[cp[2]] > 0.5)) name = unpre(H.polities[p].short + (H.polities[p].titles.colony || '殖民地')); } } // 跨海的部分：另标“某国殖民地”
      else if (layer === 'stage' && g.key[0] !== 'r') { let bs = 0, bw = 0; for (let s = 1; s <= 8; s++) if (g.st[s] > bw) { bw = g.st[s]; bs = s; } const names = g.key[0] === 'c' ? H.civs[+g.key.slice(1)].stageNames : H.ancient[+g.key.slice(1)].stageNames; if (bs) name = name.replace(/文明$/, '') + ' · ' + names[bs]; }
      const isV = g.key[0] === 'v'; if (isV && Math.sqrt(g.w) < 260 && app.map.zoomRel() < 2.5) continue;
      const point = isV ? provinceLabelPoint(+g.key.slice(1), g.regs, ang / (2 * Math.PI) * H.FW, g.sy / g.w) : [ang / (2 * Math.PI) * H.FW, g.sy / g.w];
      if (!point) continue;
      labels.push({ name, x: point[0], y: point[1], size: isV ? Math.max(10.5, Math.min(14, 9 + Math.sqrt(g.w) / 260)) : Math.max(11, Math.min(22, 9 + Math.sqrt(g.w) / 160)), ancient: g.key[0] === 'a', state: g.key[0] === 'p', rebel: !!g.rebel }); }
    labels.sort((a, b) => b.size - a.size);
    provCount = provSeen.size; shownYear = y; shownLayer = layer; dirty = false;
    if (layer === 'state' || layer === 'prov' || layer === 'unrest' || layer === 'sys') renderLegend();
  }
  function drawOverlay(c, map, ks) {
    if (!on || !H || !ov) return;
    if (dirty || shownYear !== year || shownLayer !== layer) recolor();
    const v = map.view, dpr = map.dpr, W = map.W, Hh = map.H, s = v.s;
    c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    const each = (x, fn) => { for (const k of ks) { x.setTransform(dpr * s, 0, 0, dpr * s, dpr * (v.x + k * W * s), dpr * v.y); fn(); } };
    each(c, () => c.drawImage(ov, 0, 0, W, Hh));
    each(c, () => c.drawImage(gv, 0, 0, W, Hh)); // 渐变层（半分辨率，插值放大后更柔和）
    each(c, () => { c.lineJoin = 'round'; c.lineCap = 'round'; if (provEdgePath) { c.strokeStyle = 'rgba(38,30,24,.5)'; c.lineWidth = 0.8 / s; c.setLineDash([3 / s, 2.5 / s]); c.stroke(provEdgePath); c.setLineDash([]); } if (vasEdgePath) { c.strokeStyle = 'rgba(38,30,24,.72)'; c.lineWidth = 1.4 / s; c.setLineDash([7 / s, 4 / s]); c.stroke(vasEdgePath); c.setLineDash([]); } c.strokeStyle = 'rgba(38,30,24,.78)'; c.lineWidth = (layer === 'prov' ? 1.7 : 1.2) / s; c.stroke(edgePath);
      if (provPath) { c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 4.5 / s; c.setLineDash(provPath.gone ? [5 / s, 4 / s] : []); c.stroke(provPath.p); c.strokeStyle = provPath.gone ? 'rgba(120,96,70,.9)' : 'rgba(176,58,46,.95)'; c.lineWidth = 2.2 / s; c.stroke(provPath.p); c.setLineDash([]); }
      if (ghostPath) { c.strokeStyle = 'rgba(26,90,200,.85)'; c.lineWidth = 2 / s; c.setLineDash([6 / s, 4 / s]); c.stroke(ghostPath); c.setLineDash([]); } }); // 单国视角：鼎盛时的疆域
    c.restore();
  }
  function drawTop(c, map, ks) {
    if (!on || !H) return;
    const v = map.view, dpr = map.dpr, W = map.W, s = v.s;
    c.save(); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    const boxes = [], free = (x0, y0, x1, y1) => { for (const b of boxes) if (x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]) return false; boxes.push([x0, y0, x1, y1]); return true; };
    if (layer === 'stage' && H.ideas) H.ideas.forEach((I, k) => { if (I.born === null || year < I.born || (ideaSel !== k && year > I.born + 300)) return; /* 思潮兴起之地：兴起后三百年内标出；选中的思潮一直标出 */
      for (const [ox, oy, orr] of I.origins) { if (ideaAt(k, orr) > year) continue; for (const kk of ks) { const sx = v.x + (kk * W + ox) * s, sy = v.y + oy * s; if (sx < -60 || sx > map.vw + 60 || sy < -30 || sy > map.vh + 30) continue;
        const col = `rgb(${STAGE_COL[I.s]})`; G.MapIcons.drawBadge(c, sx, sy, 'idea', col, 9, true);
        free(sx - 10, sy - 10, sx + 10, sy + 10); c.font = `600 12px ${SERIF}`; const t = I.name + ' · 兴起', w = c.measureText(t).width;
        if (free(sx + 12, sy - 9, sx + 16 + w, sy + 9)) { c.textAlign = 'left'; c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = 3.5; c.strokeText(t, sx + 13, sy); c.fillStyle = col; c.fillText(t, sx + 13, sy); c.textAlign = 'center'; } } } });
    H.cradles.forEach(cr => { if (year < cr.year || eraIdx(year) > 3) return; /* 摇篮只在史前与城邦时代标出 */ for (const k of ks) { const sx = v.x + (k * W + cr.x) * s, sy = v.y + cr.y * s; if (sx < -60 || sx > map.vw + 60 || sy < -30 || sy > map.vh + 30) continue;
      G.MapIcons.drawBadge(c, sx, sy, 'cradle', G.MapView.HER_COL.culture, 9);
      c.font = `600 12px ${SERIF}`; const t = cr.name + ' · 摇篮', w = c.measureText(t).width; free(sx - 10, sy - 10, sx + 10, sy + 10);
      if (free(sx + 11, sy - 9, sx + 15 + w, sy + 9)) { c.textAlign = 'left'; c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = 3.5; c.strokeText(t, sx + 13, sy); c.fillStyle = G.MapView.HER_COL.culture; c.fillText(t, sx + 12, sy); c.textAlign = 'center'; } } });
    if (layer === 'religion') H.religions.forEach((rg, f) => { if (year < rg.founded) return; for (const k of ks) { const sx = v.x + (k * W + rg.x) * s, sy = v.y + rg.y * s; if (sx < -20 || sx > map.vw + 20 || sy < -20 || sy > map.vh + 20) continue;
      G.MapIcons.drawBadge(c, sx, sy, 'holy', rg.color ? `rgb(${rg.color})` : G.MapView.HER_COL.religious, 8); free(sx - 9, sy - 9, sx + 9, sy + 9); } }); // 宗教发源地：与遗迹图的“圣地”同一枚徽章，取宗教自己的颜色
    drawPulses(c, map, ks);
    const named = showCities && H.cities ? drawCities(c, map, ks, free) : (dots = [], []);
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const l of labels) for (const k of ks) {
      const sx = v.x + (k * W + l.x) * s, sy = v.y + l.y * s; if (sx < -200 || sx > map.vw + 200 || sy < -40 || sy > map.vh + 40) continue;
      const fs = l.size; c.font = `${l.ancient ? 'italic ' : ''}600 ${fs}px ${SERIF}`; const w = c.measureText(l.name).width;
      if (!free(sx - w / 2 - 3, sy - fs / 2 - 2, sx + w / 2 + 3, sy + fs / 2 + 2)) continue;
      c.strokeStyle = 'rgba(255,253,246,.94)'; c.lineWidth = 4; c.strokeText(l.name, sx, sy); c.fillStyle = l.rebel ? '#a01e14' : l.ancient ? '#5a4632' : '#231f1c'; c.fillText(l.name, sx, sy);
    }
    drawCityNames(c, named, free);
    drawEvHi(c, map, ks);
    c.restore();
  }

  // ---------- 时间 ----------
  function setYear(y) {
    if (!H) return; const y0 = year; year = Math.max(0, Math.min(H.E, y)); spawnPulses(y0, year);
    $('tlYear').textContent = `第 ${Math.round(year)} 年`;
    $('tlEra').textContent = eraName(year);
    $('tlThumb').style.left = (tOf(year) * 100) + '%';
    renderFeed();
    if (layer === 'religion' || layer === 'stage') renderLegend();
    if (!$('tlDrawer').hidden) drawRows();
    if (cardCity >= 0) renderCityCard();
    if (provCard) renderProvCard();
    if (focusP >= 0) renderFocusLive();
    if (!$('tlRiver').hidden) drawRiver();
    app.map.draw();
  }
  // 近事：最近一段时间里各地发生的几件事（播放越快，回看的年数越长），地图上同时以涟漪标出发生地
  function feedWindow() { const t = tOf(year), back = yOf(Math.max(0, t - 4 * Math.max(1, playing ? speed : 1) / 180)); return Math.max(25, Math.min(160, year - back)); }
  function feedList() {
    const L = capEvents, win = feedWindow(); let hi = lastEventIdx(); const out = [], seenP = new Set(); let total = 0;
    for (let i = hi; i >= 0 && L[i].year > year - win; i--) { total++; const e = L[i], key = e.p !== undefined ? 'p' + e.p : 'r' + e.r; if (out.length < 4 && !seenP.has(key)) { seenP.add(key); out.push(i); } }
    return { idx: out.reverse(), more: total - out.length, win };
  }
  let feedSig = '', feedAllOpen = false, faLock = false;
  const EV_CAT = (() => { const m = {}, put = (cat, ks) => ks.split(' ').forEach(k => m[k] = cat);
    put('war', 'annex sack nomad fromState horde hordeFall defeat'); put('state', 'crown uncrown regal wane decay perish'); put('state', 'hordeJoin steppeHome steppeRevolt unify split dynasty house restore secede rise rebelState overthrow coup revolution independence vassal vassalFree vassalAnnex settle sedent theocracy organize provSecede capital');
    put('revolt', 'revolt suppress'); put('idea', 'idea adopt'); put('faith', 'religion convert schism'); put('city', 'city found ruin milestone leader colonyCity colony discovery migrate');
    put('woe', 'plague disaster'); put('civ', 'cradle civ stage kingdom empire fall'); return m; })();
  const CAT_NAME = { war: '征战', state: '政权', revolt: '民变', idea: '思潮', faith: '宗教', city: '城市', woe: '灾异', civ: '文明' };
  function renderFeed() {
    const cap = $('tlTicker'), f = feedList(), sig = f.idx.join(',') + '|' + f.more;
    if (feedAllOpen && !faLock) renderFeedAll();
    if (sig === feedSig) return; const prev = new Set(feedSig.split('|')[0].split(',')); feedSig = sig;
    if (!f.idx.length) { cap.hidden = true; cap.innerHTML = ''; return; }
    cap.hidden = feedAllOpen;
    cap.innerHTML = f.idx.map((i, k) => { const e = capEvents[i], age = (year - e.year) / f.win; return `<button class="tl-feed-row${prev.has(String(i)) ? '' : ' flash'}" data-e="${i}" title="跳到这件事" style="opacity:${(1 - 0.55 * Math.min(1, age)).toFixed(2)}"><small>第 ${e.year} 年</small>${esc(unpre(e.text))}</button>`; }).join('')
      + (f.idx.length + f.more > 2 ? `<button class="tl-feed-more${f.more > 0 ? '' : ' only-m'}" data-all="1" title="展开这段时间各地发生的全部大事">同期各地共 ${f.idx.length + f.more} 件事<b>查看全部</b><svg viewBox="0 0 24 24"><path d="m6 15 6-6 6 6"/></svg></button>` : '');
  }
  // 同期大事的完整列表：按时间倒序，带类别；点一条跳过去
  function feedAllList() { const L = capEvents, win = feedWindow(), out = []; for (let i = lastEventIdx(); i >= 0 && L[i].year > year - win; i--) out.push(i); return { out, win }; }
  let feedAllSig = '';
  function renderFeedAll() {
    const el = $('tlFeedAll'); if (!el) return; const { out, win } = feedAllList(), sig = out.length + ':' + (out[0] ?? -1) + ':' + Math.round(year);
    if (sig === feedAllSig) return; feedAllSig = sig;
    const n = {}; out.forEach(i => { const c = EV_CAT[capEvents[i].kind] || 'state'; n[c] = (n[c] || 0) + 1; });
    const sum = Object.keys(CAT_NAME).filter(c => n[c]).map(c => `<span class="c-${c}">${CAT_NAME[c]} ${n[c]}</span>`).join('');
    let lastY = null;
    const rows = out.map(i => { const e = capEvents[i], c = EV_CAT[e.kind] || 'state', head = e.year !== lastY ? `<b>${e.year}</b>` : '<b class="same"></b>'; lastY = e.year;
      return `<li data-e="${i}">${head}<i class="c-${c}">${CAT_NAME[c]}</i><span>${esc(unpre(e.text))}</span></li>`; }).join('');
    el.innerHTML = `<header><div><b>第 ${Math.max(0, Math.round(year - win))}–${Math.round(year)} 年 · 各地大事</b><small>${out.length} 件 · 点一件事，地图飞到那里</small></div><button class="tl-icon" data-x="1" title="收起"><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button></header><div class="tl-fa-sum">${sum}</div><ul>${rows || '<li class="none">这段时间各地无大事</li>'}</ul>`;
  }
  function toggleFeedAll(force) {
    feedAllOpen = force === undefined ? !feedAllOpen : force; const el = $('tlFeedAll');
    el.hidden = !feedAllOpen; $('tlTicker').hidden = feedAllOpen || !feedSig.split('|')[0];
    if (feedAllOpen) { setPlaying(false); $('tlCity').hidden = true; cardCity = -1; feedAllSig = ''; renderFeedAll(); el.querySelector('ul').scrollTop = 0; }
  }
  /* 事件发生地的涟漪：时间走到一件事时在那里荡开一圈，一秒多就消失；暂停时不会停在地图上 */
  let pulses = [], pulseRaf = 0; const PULSE_MS = 1500, PULSE_MAX = 28;
  function spawnPulses(y0, y1) {
    if (!H || !capEvents.length || !(y1 > y0)) return; const L = capEvents, now = performance.now(), fresh = [];
    for (let i = lastEventIdx(); i >= 0 && L[i].year > y0 && fresh.length < 10; i--) { const e = L[i]; if (e.r && H.cx[e.r] !== undefined) fresh.push(e); } // 一次跳得很远：只荡开最近的几件
    fresh.reverse().forEach((e, k) => pulses.push({ r: e.r, col: KIND_COL[e.kind] || '#c0392b', t0: now + k * 70 }));
    if (pulses.length > PULSE_MAX) pulses.splice(0, pulses.length - PULSE_MAX);
    if (!pulseRaf) pulseRaf = requestAnimationFrame(pulseLoop);
  }
  function pulseLoop() { pulseRaf = 0; const now = performance.now(); pulses = pulses.filter(p => now - p.t0 < PULSE_MS); if (!on) { pulses = []; return; } if (!playing) app.map.draw(); if (pulses.length) pulseRaf = requestAnimationFrame(pulseLoop); else if (!playing) app.map.draw(); }
  function drawPulses(c, map, ks) {
    if (!pulses.length) return; const v = map.view, s = v.s, W = map.W, now = performance.now();
    for (const p of pulses) { const a = (now - p.t0) / PULSE_MS; if (a < 0 || a >= 1) continue; const ease = 1 - Math.pow(1 - a, 3);
      for (const k of ks) { const sx = v.x + (k * W + H.cx[p.r]) * s, sy = v.y + H.cy[p.r] * s; if (sx < -40 || sx > map.vw + 40 || sy < -40 || sy > map.vh + 40) continue;
        c.globalAlpha = 0.85 * Math.pow(1 - a, 1.4); c.beginPath(); c.arc(sx, sy, 4 + 18 * ease, 0, 7); c.strokeStyle = p.col; c.lineWidth = 2.2 * (1 - 0.5 * a); c.stroke();
        if (a < 0.6) { c.globalAlpha = 1 - a / 0.6; c.beginPath(); c.arc(sx, sy, 3, 0, 7); c.fillStyle = p.col; c.fill(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.2; c.stroke(); } } }
    c.globalAlpha = 1;
  }
  function lastEventIdx() { const L = capEvents; let lo = 0, hi = L.length - 1, best = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (L[m].year <= year) { best = m; lo = m + 1; } else hi = m - 1; } return best; }
  function lastEvent() { if (!H) return null; const L = capEvents; let lo = 0, hi = L.length - 1, best = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (L[m].year <= year) { best = m; lo = m + 1; } else hi = m - 1; } return best >= 0 ? L[best] : null; }
  /* 点一件事：跳到那一年，镜头按牵涉疆域的大小拉近，钉上标记并描出当事国（或起义军）的疆域 */
  let evHi = null, evRaf = 0;
  function focusEvent(e) {
    setPlaying(false); setYear(e.year); const r = e.r; if (!r) return;
    let path = null, n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const who = (e.kind === 'vassal' || e.kind === 'vassalFree') && e.q >= 0 ? e.q : e.p; // 称臣、脱离：圈出附庸自己，而不是宗主
    if (who !== undefined && who >= 0) { const S = new Uint8Array(H.nR + 1); for (let k = 1; k <= H.nR; k++) if (ownerAt(k, e.year) === who) { S[k] = 1; n++; let dx = H.cx[k] - H.cx[r]; dx -= Math.round(dx / (H.W * 2)) * H.W * 2; x0 = Math.min(x0, dx); x1 = Math.max(x1, dx); y0 = Math.min(y0, H.cy[k]); y1 = Math.max(y1, H.cy[k]); }
      if (n) { const O = H.outline; path = new Path2D(); for (let k = 0; k < O.segA.length; k++) if (S[O.segA[k]] !== S[O.segB[k]]) path.addPath(segPath[k]); } }
    const ext = n ? Math.max(x1 - x0, y1 - y0) : 0, rel = Math.max(2.5, Math.min(8, 7 - ext / 45));
    evHi = { r, year: e.year, text: unpre(e.text), path, col: KIND_COL[e.kind] || '#c0392b', t0: performance.now() };
    app.map.flyTo(H.cx[r], H.cy[r], rel);
    cancelAnimationFrame(evRaf); const anim = () => { if (!evHi || performance.now() - evHi.t0 > 3200) { app.map.draw(); return; } app.map.draw(); evRaf = requestAnimationFrame(anim); }; evRaf = requestAnimationFrame(anim);
  }
  function drawEvHi(c, map, ks) {
    if (!evHi) return; if (Math.abs(year - evHi.year) > 40 || playing) { evHi = null; return; }
    const v = map.view, s = v.s, W = map.W, dpr = map.dpr, ph = ((performance.now() - evHi.t0) % 1400) / 1400, live = performance.now() - evHi.t0 < 3200;
    if (evHi.path) for (const k of ks) { c.save(); c.setTransform(dpr * s, 0, 0, dpr * s, dpr * (v.x + k * W * s), dpr * v.y); c.lineJoin = 'round'; c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 5 / s; c.stroke(evHi.path); c.strokeStyle = evHi.col; c.lineWidth = 2.6 / s; c.stroke(evHi.path); c.restore(); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const k of ks) { const sx = v.x + (k * W + H.cx[evHi.r]) * s, sy = v.y + H.cy[evHi.r] * s; if (sx < -100 || sx > map.vw + 100 || sy < -60 || sy > map.vh + 60) continue;
      if (live) { c.globalAlpha = 1 - ph; c.beginPath(); c.arc(sx, sy, 8 + 26 * ph, 0, 7); c.strokeStyle = evHi.col; c.lineWidth = 3; c.stroke(); c.globalAlpha = 1; }
      c.beginPath(); c.arc(sx, sy, 7, 0, 7); c.fillStyle = evHi.col; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke();
      c.font = `600 13px ${SERIF}`; const t = evHi.text.length > 26 ? evHi.text.slice(0, 25) + '…' : evHi.text, tw = c.measureText(t).width, bx = sx + 14, by = sy - 30;
      c.fillStyle = 'rgba(28,26,24,.86)'; c.beginPath(); c.roundRect ? c.roundRect(bx, by, tw + 16, 24, 7) : c.rect(bx, by, tw + 16, 24); c.fill();
      c.beginPath(); c.moveTo(sx + 5, sy - 5); c.lineTo(bx + 6, by + 24); c.lineTo(bx + 16, by + 24); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(t, bx + 8, by + 12.5); c.textAlign = 'center'; }
  }
  function setPlaying(p) {
    if (!H) return; playing = p;
    $('tlPlay').innerHTML = p ? '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
    if (p && feedAllOpen) toggleFeedAll(false);
    if (p) { if (year >= H.E) year = 0; lastT = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf);
  }
  function tick(t) {
    if (!playing || !on) return; const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
    const nt = tOf(year) + dt * speed / 180; // 1×：三分钟走完整条时间轴（史前约 20 秒）
    if (nt >= 1) { setYear(H.E); setPlaying(false); return; }
    if (focusP >= 0 && year >= lifeEnd(focusP) && yOf(nt) > lifeEnd(focusP)) { setYear(lifeEnd(focusP)); setPlaying(false); return; } // 单国视角：播到灭亡为止
    setYear(yOf(nt)); raf = requestAnimationFrame(tick);
  }

  // ---------- 图例、时代色带、脉络 ----------
  function renderLegend() {
    if (!H) return; let h = '';
    if (layer === 'state') { const top = [], nV = {}, lg = {}; let vs = 0; for (let p = 0; p < polN.length; p++) if (polN[p] > 0) { top.push(p); const L = liegeAt(p, year); if (L >= 0 && L !== p) { lg[p] = L; nV[L] = (nV[L] || 0) + 1; vs++; } } top.sort((a, b) => polN[b] - polN[a] || a - b); // 附庸也是独立的国家：单独列出
      const swatch = p => { const L = realmAt(p, year); return L !== p ? vassalTint(H.polities[L].color, p) : H.polities[p].color; };
      h = top.slice(0, 8).map(p => `<span class="tl-pick${p === focusP ? ' on' : ''}" data-focus="${p}" title="${lg[p] !== undefined ? esc('附庸 · 奉' + polName(lg[p], year, Math.max(1, polN[lg[p]])) + '为宗主') : '单独看这个国家'}"><i style="background:rgb(${swatch(p)})"></i>${esc(polName(p, year, polN[p]))}${lg[p] !== undefined ? '<small>附庸</small>' : nV[p] ? `<small>${nV[p]} 附庸</small>` : ''}</span>`).join('') + `<span><i style="background:rgb(${FARMER})"></i>部族地带</span><em>当世 ${top.length} 国${vs ? `（其中 ${vs} 个附庸）` : ''} · <span style="display:inline-flex;align-items:center;gap:2px;white-space:nowrap">${G.MapIcons.svgCity('capital')}都城</span> · 附庸自成一国，与宗主同色系、深浅不同 · 城邦与王国时代按实际治理由都城向外渐淡 · 红色斜纹为起义军</em>`; }
    else if (layer === 'sys') { if (!G.AdminSys || !sysTally) h = ''; else { const A = G.AdminSys, tot = Math.max(1e-9, sysTally._w);
      h = A.ORDER.filter(c => sysTally[c]).sort((a, b) => sysTally[b].w - sysTally[a].w).map(c => { const T = sysTally[c], top = [...T.ps].sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => polName(x[0], year, polN[x[0]])); const sw = A.COL[c].map(v => Math.round(v * 0.72 + 255 * 0.28)); return `<span class="tl-pick" data-focus="${[...T.ps].sort((a, b) => b[1] - a[1])[0][0]}" title="${esc(A.DESC[c] + (top.length ? ' · 如 ' + top.join('、') : ''))}"><i style="background:${c === 'rebel' ? `repeating-linear-gradient(45deg,rgb(${sw}) 0 3px,#f4efe6 3px 6px)` : `rgb(${sw})`}"></i>${A.NAME[c]}<small>${T.ps.size} 国 · ${pct(T.w, tot)}</small></span>`; }).join('')
        + (sysTally._tribal ? `<span><i style="background:rgb(${FARMER})"></i>无国家的部族<small>${pct(sysTally._tribal, tot)}</small></span>` : '')
        + `<em>按各国当年的统治方式着色：行政制为官僚郡县、封建制为分封世袭、游牧制为部族联盟。同一国家会随时代改制——拖动时间轴看郡县与分封此消彼长；百分比为所占有人地区的份额。点一项看其中最大的国家。</em>`; } }
    else if (layer === 'unrest') h = `<span><i style="background:rgb(250,226,140)"></i>不满</span><span><i style="background:rgb(236,130,60)"></i>怨声载道</span><span><i style="background:rgb(160,24,24)"></i>一触即发</span><span><i style="background:repeating-linear-gradient(45deg,#d06050 0 3px,#f4efe6 3px 6px)"></i>起义军控制</span><em>民怨来自赋役、灾荒、异族统治、信仰不合、王朝末年与遗民记忆</em>`;
    else if (layer === 'prov') { let ab = 0; for (const X of H.provinces) if (X.abolished !== null && X.abolished !== undefined && X.abolished <= year) ab++; h = `<span><i style="background:repeating-linear-gradient(45deg,#c9b8a0 0 3px,#f4efe6 3px 6px)"></i>新占领、尚未建制（军管）</span><span><i style="background:rgba(120,110,100,.25)"></i>尚未设省的国家</span><em>当世 ${provCount} 省 · 至今已撤销 ${ab} 省。粗线为国界，细线为省界；同一个省跨越朝代保持同一色调。点一个省，看它的曾用名、设立、析置与撤销</em>`; }
    else if (layer === 'stage' && H.ideas) { let tot = 0; for (let r = 1; r <= H.nR; r++) if (H.weight[r] > 0) tot += H.weight[r]; const share = k => { let w = 0; for (let r = 1; r <= H.nR; r++) if (ideaAt(k, r) <= year) w += H.weight[r]; return Math.round(w / Math.max(1e-9, tot) * 100); };
      h = H.ideas.map((I, k) => I.born === null ? '' : `<span class="tl-pick${ideaSel === k ? ' on' : ''}${year < I.born ? ' dim' : ''}" data-idea="${k}" title="${esc(I.desc)}"><i style="background:rgb(${STAGE_COL[I.s]})"></i>${esc(I.name)}${I.opt ? '<small>殖民</small>' : ''}<small>${year < I.born ? '第 ' + I.born + ' 年兴起' : share(k) + '%'}</small></span>`).join('') + `<em>${ideaSel >= 0 ? `正在看「${esc(H.ideas[ideaSel].name)}」的传播：彩色为已接纳，灰色为未接纳。再点一次回到总览。` : '思潮在世界某处兴起，向四周传播；同一文明之内传得快，各类文明接纳的快慢不同。接纳了一个阶段的全部思潮，才进入那个阶段（颜色）。只有接纳了“远洋航海”的国家才能殖民新大陆。点一条思潮看它的传播；百分比为接纳人口所占比例。'}</em>`; }
    else if (layer === 'stage') h = `<span><i style="background:rgb(${STAGE_COL[2]})"></i>部落 · 酋邦</span>` + STAGE_GENERIC.slice(3, H.maxStage + 1).map((n, k) => `<span><i style="background:rgb(${STAGE_COL[k + 3]})"></i>${n}</span>`).join('');
    else if (layer === 'culture') h = H.ancient.map((a, i) => `<span><i style="background:rgb(${ancColor(i)})"></i>${esc(a.name)}<small>古</small></span>`).join('') + `<span><i style="background:rgb(${FARMER})"></i>早期农人</span><em>辐射圈：传入越久颜色越浓，文明之间是过渡地带</em>`;
    else h = H.religions.map((r, f) => year >= r.founded ? `<span title="${esc((RTYPE[r.type] || '') + (r.parent >= 0 ? ' · 自' + H.religions[r.parent].name + '分出' : '') + (r.holy ? ' · 圣地 ' + r.holy : ''))}"><i style="background:rgb(${relColor(f)})"></i>${esc((r.symbol || '') + ' ' + r.name)}${r.parent >= 0 ? '<small>派</small>' : ''}</span>` : '').join('') + '<span><i class="folk"></i>原始信仰</span><em>传教越久颜色越浓，宗教之间有过渡地带</em>';
    const MI = G.MapIcons, sym = (svg, t) => `<span>${svg}${t}</span>`;
    $('tlLegend').innerHTML = h + `<label class="tl-toggle"><input type="checkbox" id="tlCityToggle"${showCities ? ' checked' : ''}>城市、道路与废墟</label>`
      + (showCities ? `<div class="tl-syms">${sym(MI.svgCity('capital'), '都城')}${sym(MI.svgCity('metro'), '大都会')}${sym(MI.svgCity('city'), '城市')}${sym(MI.svgCity('ancient'), '古城')}${sym(MI.svgRuin(), '废墟')}${sym(MI.svgHoly(), '圣城')}${layer === 'stage' ? sym(MI.svgBadge('idea', '#b8860b', 15, true), '思潮兴起') : ''}${layer === 'religion' ? sym(MI.svgBadge('holy', G.MapView.HER_COL.religious, 15), '宗教发源') : ''}${eraIdx(year) <= 3 ? sym(MI.svgBadge('cradle', G.MapView.HER_COL.culture, 15), '文明摇篮') : ''}</div>` : '');
  }
  function fitCanvas(cv, h) { const r = cv.parentElement.getBoundingClientRect(), dpr = (devicePixelRatio || 1) * UZ(cv); const w = Math.max(10, r.width / UZ(cv)); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [x, w]; }
  function drawBand() {
    if (!H) return; const BH = 38, [x, w] = fitCanvas($('tlBand'), BH);
    x.clearRect(0, 0, w, BH);
    // 时代色带：史前合成一段浅色，城邦以后按时代着色，时代名写在色带里
    const segs = []; const n = H.eraAt.length;
    for (let k = 0; k < n; k++) { const e = Math.max(2, H.eraAt[k]), y0 = k * H.eraStep, y1 = Math.min(H.E, (k + 1) * H.eraStep); const last = segs[segs.length - 1]; if (last && last.e === e) last.y1 = y1; else segs.push({ e, y0, y1 }); }
    x.font = '600 10.5px sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'center';
    for (const sg of segs) { const a = tOf(sg.y0) * w, b = tOf(sg.y1) * w; x.fillStyle = sg.e <= 2 ? '#e4ddc8' : `rgb(${STAGE_COL[sg.e]})`; x.fillRect(a, 10, b - a + 0.5, 15);
      const t = sg.e <= 2 ? '史前' : H.eraNames[sg.e]; if (b - a > x.measureText(t).width + 8) { x.fillStyle = sg.e <= 2 ? '#7a6e58' : '#fff'; x.fillText(t, (a + b) / 2, 17.5); } }
    // 年份刻度：起点、城邦时代起点，之后每 500 年
    x.fillStyle = '#8b96a0'; x.font = '10px sans-serif'; x.textBaseline = 'top';
    const marks = [0, Math.round(Y0)]; for (let yy = Math.ceil(Y0 / 500) * 500; yy < H.E; yy += 500) marks.push(yy); marks.push(H.E);
    let lastX = -99; for (const yy of marks) { const px = tOf(yy) * w; if (px - lastX < 34 && yy !== H.E) continue; if (yy === H.E && px - lastX < 34) continue; x.fillRect(px, 25, 1, 3); x.textAlign = yy === 0 ? 'left' : yy === H.E ? 'right' : 'center'; x.fillText(String(yy), px, 28); lastX = px; }
  }
  // ---------- 世系河流图 ----------
  const RIV = { data: null, cache: null, geo: null };
  function toggleRiver(force) { const el = $('tlRiver'); el.hidden = force === undefined ? !el.hidden : !force; $('tlRiverBtn').classList.toggle('on', !el.hidden); if (!el.hidden) { if (!RIV.data) RIV.data = buildRiver(); RIV.cache = null; drawRiver(); } }
  function buildRiver() {
    const P = H.polities, nP = P.length, O = H.own; let minB = H.E; for (const q of P) if (q.born < minB) minB = q.born;
    const STEP = 25, S = [], t0 = Math.max(0, Math.floor((minB - 60) / STEP) * STEP); for (let t = t0; t < H.E; t += STEP) S.push(t); S.push(H.E); const nS = S.length; /* 从第一个国家兴起前不久开始：史前不占画面 */
    // 每个政权在各采样年份的疆域面积
    const A = new Float32Array(nP * nS); let land = 0;
    for (let r = 1; r <= H.nR; r++) { if (H.weight[r] > 0) land += H.area[r]; const a = O.off[r], b = O.off[r + 1]; if (a === b) continue; const w = H.area[r]; let i = a;
      for (let k = 0; k < nS; k++) { while (i < b && O.year[i] <= S[k]) i++; const o = i > a ? O.owner[i - 1] : -1; if (o >= 0) A[o * nS + k] += w; } }
    // 国统：改朝换代、起义建立的新朝共享国统
    const linIdx = new Map(), L = [];
    P.forEach((q, i) => { let li = linIdx.get(q.lin); if (li === undefined) { li = L.length; linIdx.set(q.lin, li); L.push({ members: [], area: new Float32Array(nS), peak: 0, born: q.born, died: 0 }); } const g = L[li]; g.members.push(i); g.born = Math.min(g.born, q.born); g.died = Math.max(g.died, q.died === null || q.died === undefined ? H.E : q.died); for (let k = 0; k < nS; k++) g.area[k] += A[i * nS + k]; });
    for (const g of L) { let pk = 0, pp = g.members[0]; for (let k = 0; k < nS; k++) if (g.area[k] > pk) pk = g.area[k]; g.peak = pk; for (const m of g.members) if (P[m].peakN > P[pp].peakN) pp = m; g.color = P[pp].color; g.first = g.members.reduce((a, b) => P[a].born <= P[b].born ? a : b); g.civ = P[g.first].civ; g.last = g.members.reduce((a, b) => (P[a].died ?? H.E) >= (P[b].died ?? H.E) ? a : b); }
    // 选出成过气候的国统（其余并成“诸小国”）
    const ranked = L.map((g, i) => i).filter(i => L[i].peak >= land * 0.0025).sort((a, b) => L[b].peak - L[a].peak).slice(0, 120); const shown = new Set(ranked);
    const others = new Float32Array(nS); L.forEach((g, i) => { if (!shown.has(i)) for (let k = 0; k < nS; k++) others[k] += g.area[k]; });
    // 排序：按文明分组；分裂、割据、起义而来的国统紧挨母国（看上去就是分叉）
    const parentOf = i => { const q = P[L[i].first]; const pa = q.parents.find(x => x.kind === 'split' || x.kind === 'secede' || x.kind === 'revolt'); if (!pa) return -1; const li = linIdx.get(P[pa.id].lin); return shown.has(li) && li !== i ? li : -1; };
    const kids = new Map(), roots = []; for (const i of ranked) { const pa = parentOf(i); if (pa >= 0) { if (!kids.has(pa)) kids.set(pa, []); kids.get(pa).push(i); } else roots.push(i); }
    const civOrder = new Map(); [...ranked].sort((a, b) => L[a].born - L[b].born).forEach(i => { const c = L[i].civ; if (!civOrder.has(c)) civOrder.set(c, civOrder.size); });
    roots.sort((a, b) => civOrder.get(L[a].civ) - civOrder.get(L[b].civ) || L[a].born - L[b].born);
    const order = []; const dfs = i => { order.push(i); for (const c of (kids.get(i) || []).sort((a, b) => L[a].born - L[b].born)) dfs(c); }; roots.forEach(dfs);
    // 汇流：国统终结时被谁吞并；复国：虚线连回故国
    const merges = [], restores = [];
    for (const i of order) { const lq = P[L[i].last]; if (lq.died === null || lq.died === undefined) continue; const ch = lq.children.find(x => x.kind === 'conquer'); if (ch) { const lj = linIdx.get(P[ch.id].lin); if (shown.has(lj) && lj !== i) merges.push([i, lj, lq.died]); } }
    for (const i of order) for (const m of L[i].members) { const q = P[m]; if (q.restoreOf >= 0) { const lj = linIdx.get(P[q.restoreOf].lin); if (shown.has(lj) && lj !== i) restores.push([lj, i, q.born]); } }
    /* 起点：国家疆域合计达到最大值的 3% 前一百年（此前只是零星城邦，不占画面） */
    let mxT = 0; const totK = new Float32Array(nS); for (let k = 0; k < nS; k++) { let a = others[k]; for (const i of order) a += L[i].area[k]; totK[k] = a; if (a > mxT) mxT = a; }
    let kf = 0; while (kf < nS - 1 && totK[kf] < mxT * 0.03) kf++; const tStart = Math.max(t0, S[kf] - 100);
    return { S, nS, A, L, order, others, land, merges, restores, linIdx, t0: tStart };
  }
  function riverX(t, w) { const t0 = RIV.data ? RIV.data.t0 : 0; return 16 + Math.max(0, Math.min(1, (t - t0) / Math.max(1, H.E - t0))) * (w - 32); }
  function drawRiver() {
    const el = $('tlRiver'); if (el.hidden || !RIV.data) return; const D = RIV.data, cv = $('tlRiverCv');
    const box = cv.parentElement.getBoundingClientRect(), z = UZ(cv), dpr = (devicePixelRatio || 1) * z, w = Math.max(200, box.width / z), hh = Math.max(160, box.height / z);
    if (!RIV.cache || RIV.cache.w !== w || RIV.cache.h !== hh) {
      const off = document.createElement('canvas'); off.width = Math.round(w * dpr); off.height = Math.round(hh * dpr); const x = off.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      const top = 24, bot = hh - 20, plotH = bot - top, P = H.polities, gap = 0.8;
      x.fillStyle = '#fbfaf6'; x.fillRect(0, 0, w, hh);
      // 时代色带
      { const n = H.eraAt.length; let k0 = 0; x.font = '600 10px sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'center';
        for (let k = 1; k <= n; k++) if (k === n || Math.max(2, H.eraAt[k]) !== Math.max(2, H.eraAt[k0])) { const e = Math.max(2, H.eraAt[k0]), a = riverX(k0 * H.eraStep, w), b = riverX(Math.min(H.E, k * H.eraStep), w); x.fillStyle = e <= 2 ? '#e8e2d0' : `rgb(${STAGE_COL[e]})`; x.globalAlpha = 0.5; x.fillRect(a, 4, b - a, 13); x.globalAlpha = 1; const t = e <= 2 ? '史前' : H.eraNames[e]; if (b - a > x.measureText(t).width + 6) { x.fillStyle = e <= 2 ? '#7a6e58' : '#fff'; x.fillText(t, (a + b) / 2, 10.5); } k0 = k; } }
      // 堆叠：每个采样年份，按顺序从上往下排各国统，底部为诸小国与部族之地
      const Y0 = D.order.map(() => new Float32Array(D.nS)), Y1 = D.order.map(() => new Float32Array(D.nS));
      /* 上下对称居中的流图：按整段历史里国家疆域总和的最大值撑满高度 */
      let mxTot = 1e-9; const tot = new Float32Array(D.nS); for (let k = 0; k < D.nS; k++) { let a = D.others[k]; D.order.forEach(li => { a += D.L[li].area[k]; }); tot[k] = a; if (a > mxTot) mxTot = a; }
      const nGap = new Float32Array(D.nS); for (let k = 0; k < D.nS; k++) D.order.forEach(li => { if (D.L[li].area[k] > 0) nGap[k]++; });
      let mxGap = 0; for (let k = 0; k < D.nS; k++) mxGap = Math.max(mxGap, nGap[k]); const gp = Math.min(gap, plotH * 0.12 / Math.max(1, mxGap)), sc = (plotH * 0.95 - gp * mxGap) / mxTot;
      for (let k = 0; k < D.nS; k++) { let acc = top + (plotH - tot[k] * sc - gp * nGap[k]) / 2; D.order.forEach((li, j) => { const hgt = D.L[li].area[k] * sc; Y0[j][k] = acc; Y1[j][k] = acc + hgt; acc += hgt + (hgt > 0 ? gp : 0); }); }
      RIV.sc = sc;
      const X = D.S.map(t => riverX(t, w));
      const strip = (ya, yb, k0, k1, fill) => { x.beginPath(); x.moveTo(X[k0], ya[k0]); for (let k = k0 + 1; k <= k1; k++) { const xm = (X[k - 1] + X[k]) / 2; x.bezierCurveTo(xm, ya[k - 1], xm, ya[k], X[k], ya[k]); } x.lineTo(X[k1], yb[k1]); for (let k = k1 - 1; k >= k0; k--) { const xm = (X[k + 1] + X[k]) / 2; x.bezierCurveTo(xm, yb[k + 1], xm, yb[k], X[k], yb[k]); } x.closePath(); x.fillStyle = fill; x.fill(); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 0.6; x.stroke(); };
      D.order.forEach((li, j) => { const g = D.L[li]; let k0 = -1, k1 = -1; for (let k = 0; k < D.nS; k++) if (g.area[k] > 0) { if (k0 < 0) k0 = k; k1 = k; } if (k0 < 0) return;
        k0 = Math.max(0, k0 - 1); k1 = Math.min(D.nS - 1, k1 + 1); strip(Y0[j], Y1[j], k0, k1, `rgb(${g.color})`);
        // 改朝换代：在河上画一道细缝
        let lastSeam = -1e9; for (const m of g.members) { if (m === g.first) continue; const t = P[m].born, k = D.S.findIndex(s0 => s0 >= t); if (k < 0 || Y1[j][k] - Y0[j][k] < 5 || X[k] - lastSeam < 14) continue; lastSeam = X[k]; x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 1; x.beginPath(); x.moveTo(X[k], Y0[j][k] + 1); x.lineTo(X[k], Y1[j][k] - 1); x.stroke(); } });
      // 诸小国与部族之地
      { const ya = new Float32Array(D.nS), yb = new Float32Array(D.nS); for (let k = 0; k < D.nS; k++) { let last = top + (plotH - tot[k] * sc - gp * nGap[k]) / 2; D.order.forEach((li, j) => { if (Y1[j][k] > last) last = Y1[j][k]; }); ya[k] = last + (D.others[k] > 0 ? gp : 0); yb[k] = ya[k] + D.others[k] * sc; }
        strip(ya, yb, 0, D.nS - 1, 'rgba(176,170,160,.45)');
        { let bk = 0, bw = 0; for (let k = 0; k < D.nS; k++) if (yb[k] - ya[k] > bw) { bw = yb[k] - ya[k]; bk = k; } if (bw > 12) { x.font = '11px sans-serif'; x.fillStyle = '#6f6a62'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('诸小国', X[bk], (ya[bk] + yb[bk]) / 2); } } }
      // 汇流与复国的连线
      const mid = (j, k) => (Y0[j][k] + Y1[j][k]) / 2, posOf = new Map(D.order.map((li, j) => [li, j])), kAt = t => Math.max(0, Math.min(D.nS - 1, D.S.findIndex(s0 => s0 >= t)));
      x.lineWidth = 1.2;
      for (const [a, b, t] of D.merges) { const ja = posOf.get(a), jb = posOf.get(b), k = kAt(t), kp = Math.max(0, k - 1); const xa = X[kp], ya = mid(ja, kp), xb = X[Math.min(D.nS - 1, k + 1)], yb = mid(jb, Math.min(D.nS - 1, k + 1)); x.strokeStyle = 'rgba(60,52,44,.28)'; x.beginPath(); x.moveTo(xa, ya); x.bezierCurveTo((xa + xb) / 2, ya, (xa + xb) / 2, yb, xb, yb); x.stroke(); }
      x.setLineDash([3, 3]); for (const [a, b, t] of D.restores) { const ja = posOf.get(a), jb = posOf.get(b), k = kAt(t); const ka = Math.max(0, k - 2); x.strokeStyle = `rgba(${D.L[b].color},.8)`; x.beginPath(); x.moveTo(X[ka], mid(ja, ka)); x.bezierCurveTo((X[ka] + X[k]) / 2, mid(ja, ka), (X[ka] + X[k]) / 2, mid(jb, k), X[k], mid(jb, k)); x.stroke(); } x.setLineDash([]);
      // 国名：每个政权在它最宽处标名
      x.textAlign = 'center'; x.textBaseline = 'middle';
      D.order.forEach((li, j) => { for (const m of D.L[li].members) { let bk = -1, bw = 0; for (let k = 0; k < D.nS; k++) if (D.A[m * D.nS + k] > 0) { const ww = Y1[j][k] - Y0[j][k]; if (ww > bw) { bw = ww; bk = k; } } if (bk < 0 || bw < 7) continue;
          const t = D.S[bk], n = Math.round(D.A[m * D.nS + bk] / Math.max(1, D.land) * H.nR), name = polName(m, t, Math.max(1, countAt(m, t))), fs = Math.max(9, Math.min(15, bw * 0.62)); x.font = `600 ${fs}px "Songti SC","STSong","Noto Serif SC",serif`;
          const tw = x.measureText(name).width; let a = bk, b = bk; while (a > 0 && D.A[m * D.nS + a - 1] > 0 && X[bk] - X[a - 1] < tw / 2 + 4) a--; while (b < D.nS - 1 && D.A[m * D.nS + b + 1] > 0 && X[b + 1] - X[bk] < tw / 2 + 4) b++; if (X[b] - X[a] < tw * 0.7) continue; void n;
          x.lineWidth = 3; x.strokeStyle = 'rgba(255,255,255,.55)'; x.strokeText(name, X[bk], (Y0[j][bk] + Y1[j][bk]) / 2); x.fillStyle = '#2a241f'; x.fillText(name, X[bk], (Y0[j][bk] + Y1[j][bk]) / 2); } });
      // 年份刻度
      x.fillStyle = '#8b96a0'; x.font = '10px sans-serif'; x.textBaseline = 'top'; let lastX = -99; for (let t = Math.ceil(D.t0 / 250) * 250; t <= H.E; t += 250) { const px = riverX(t, w); if (px - lastX < 44) continue; x.textAlign = 'center'; x.fillText(String(t), px, bot + 4); x.fillRect(px, bot, 1, 3); lastX = px; }
      RIV.cache = { w, h: hh, off, Y0, Y1, X, top, bot };
    }
    cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr); cv.style.width = w + 'px'; cv.style.height = hh + 'px';
    const x = cv.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(RIV.cache.off, 0, 0); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = riverX(year, w); x.fillStyle = 'rgba(26,115,232,.9)'; x.fillRect(cx - 0.75, RIV.cache.top, 1.5, RIV.cache.bot - RIV.cache.top);
    if (focusP >= 0 && RIV.data) { const li = RIV.data.linIdx.get(H.polities[focusP].lin), j = RIV.data.order.indexOf(li); if (j >= 0) { const c = RIV.cache; x.strokeStyle = '#1a73e8'; x.lineWidth = 2; x.beginPath(); for (let k = 0; k < RIV.data.nS; k++) { if (c.Y1[j][k] - c.Y0[j][k] <= 0) continue; x.rect(c.X[k] - 1, c.Y0[j][k], 2, c.Y1[j][k] - c.Y0[j][k]); } x.stroke(); } }
  }
  function riverAt(ev) { const c = RIV.cache, D = RIV.data; if (!c || !D) return null; const r = $('tlRiverCv').getBoundingClientRect(), z = UZ($('tlRiverCv')), mx = (ev.clientX - r.left) / z, my = (ev.clientY - r.top) / z;
    let k = 0, bd = 1e9; c.X.forEach((xx, i) => { const d = Math.abs(xx - mx); if (d < bd) { bd = d; k = i; } });
    for (let j = 0; j < D.order.length; j++) if (my >= c.Y0[j][k] && my <= c.Y1[j][k] && c.Y1[j][k] > c.Y0[j][k]) { const g = D.L[D.order[j]]; let m = -1, ma = 0; for (const p of g.members) if (D.A[p * D.nS + k] > ma) { ma = D.A[p * D.nS + k]; m = p; } return { k, t: D.S[k], m, share: ma / D.land, mx, my }; }
    return { k, t: D.S[k], m: -1, mx, my }; }
  function riverHover(ev) { const h0 = riverAt(ev), tip = $('tlRiverTip'); if (!h0 || h0.m < 0) { tip.hidden = true; return; } const q = H.polities[h0.m];
    tip.innerHTML = `<b>${esc(polName(h0.m, h0.t, Math.max(1, countAt(h0.m, h0.t))))}</b><span>第 ${q.born} 年 — ${q.died === null || q.died === undefined ? '至今' : '第 ' + q.died + ' 年'}</span><span>第 ${h0.t} 年 · 占世界陆地 ${(h0.share * 100).toFixed(1)}%</span><span style="color:#c9c2b3">点击：跳到这一年并查看该国</span>`;
    tip.hidden = false; tip.style.left = Math.min(h0.mx + 14, $('tlRiverCv').clientWidth - 200) + 'px'; tip.style.top = (h0.my + 12) + 'px'; }
  function riverClick(ev) { const h0 = riverAt(ev); if (!h0) return; setPlaying(false); setYear(h0.t); if (h0.m >= 0) setFocus(h0.m); drawRiver(); }

  const ROW_H = 15;
  function drawRows() {
    if (!H || $('tlDrawer').hidden) return;
    const h = rows.length * ROW_H + 6, [x, w] = fitCanvas($('tlRowsCv'), h), bw = w - NAME_W - 8, X = yy => NAME_W + tOf(yy) * bw;
    x.clearRect(0, 0, w, h); x.textBaseline = 'middle';
    x.fillStyle = '#f4f1ea'; x.fillRect(NAME_W, 0, PRE * bw, h); // 史前段
    rows.forEach((row, i) => { const y0 = 3 + i * ROW_H;
      x.fillStyle = `rgb(${row.color})`; x.fillRect(2, y0 + 3, 9, 9);
      x.font = (row.kind === 'ancient' ? 'italic ' : '') + '12px ' + SERIF; x.fillStyle = row.kind === 'ancient' ? '#6b5a48' : '#2e2a26'; x.textAlign = 'left';
      let nm = row.name; while (x.measureText(nm).width > NAME_W - 20 && nm.length > 2) nm = nm.slice(0, -1); x.fillText(nm, 16, y0 + ROW_H / 2);
      for (let s = 1; s <= 8; s++) { const a = row.ages[s]; if (a == null || a >= row.end) continue; let b = row.end; for (let t = s + 1; t <= 8; t++) if (row.ages[t] != null) { b = Math.min(b, row.ages[t]); break; }
        x.fillStyle = `rgb(${STAGE_COL[s]})`; x.fillRect(X(a), y0 + 3, Math.max(1, X(b) - X(a)), ROW_H - 6); }
      if (row.kind === 'ancient') { x.font = '10px sans-serif'; x.fillStyle = '#8b7f70'; x.fillText('亡', X(row.end) + 4, y0 + ROW_H / 2); }
    });
    x.fillStyle = 'rgba(26,115,232,.9)'; x.fillRect(X(year) - 0.75, 0, 1.5, h);
  }
  function rowAt(ev) { const r = $('tlRowsCv').getBoundingClientRect(); const i = Math.floor(((ev.clientY - r.top) / UZ(rc0()) - 3) / ROW_H); return rows[i] || null; }
  function rowTitle(row) {
    const ages = []; for (let s = 1; s <= 8; s++) if (row.ages[s] != null && row.ages[s] < row.end) ages.push(`${row.stageNames[s]} ${row.ages[s]}`);
    return `${row.name}（${row.type}文明 · 文化库：${row.lib}）\n${ages.join(' → ')}${row.kind === 'ancient' ? `\n约第 ${row.end} 年衰亡，故地并入${row.succ >= 0 ? H.civs[row.succ].name : '后来者'}` : ''}${row.titles ? `\n政体称谓：${[row.titles[2], row.titles[3], row.titles[4], row.titles[5]].filter(Boolean).join(' → ')}` : ''}`;
  }

  // 悬浮信息：该处在当年的发展阶段、文明与宗教
  function tip(g) {
    if (!H) return null; const r = regionAtPoint(g[0], g[1]); if (!r) return null;
    const y = year, s = stageAt(r, y), cu = cultureAt(r, y, s), f = religionAt(r, y, cu);
    const civ = cu >= 0 ? H.civs[cu] : cu !== null && cu <= -2 ? H.ancient[-2 - cu] : null;
    const names = civ ? civ.stageNames : STAGE_GENERIC;
    const title = civ ? civ.name : s >= 1 ? '早期农人' : (H.weight[r] > 0 ? '采集游群' : '无人荒野');
    const rows = [['年代', `第 ${Math.round(y)} 年 · ${eraName(y)}`]];
    { const p = ownerAt(r, y); if (p >= 0) { let n = 0; for (let k = 1; k <= H.nR; k++) if (ownerAt(k, y) === p) n++; const c = capAt(p, y); rows.push(['国家', polName(p, y, n)]); { const L = liegeAt(p, y); if (L >= 0) rows.push(['宗主', polName(L, y, Math.max(1, countAt(L, y))) + ' · 附庸']); else { let nv = 0; for (let q = 0; q < H.polities.length; q++) if (polN[q] > 0 && q !== p && liegeAt(q, y) === p) nv++; if (nv) rows.push(['附庸', nv + ' 国']); } } if (c && c[1] >= 0) rows.push(['都城', cityName(c[1], y)]); if (G.AdminSys) { const gl = govLabelAt(p, y); rows.push(['制度', G.AdminSys.NAME[sysAt(p, y)] + (gl && !isRebel(p, y) ? ' · ' + gl : '')]); } if (orgAt(p, y)) { const v = provAt(r, y); if (v >= 0) { const X = H.provinces[v]; let sr = X.seats[0][1]; for (const t of X.seats) if (t[0] <= y) sr = t[1]; const sc = (() => { let b = -1, bp = 0; for (const i of (cityByRegion.get(sr) || [])) { if (!alive(H.cities[i], y)) continue; const pp = popAt(i, y); if (pp > bp) { bp = pp; b = i; } } return b; })(); rows.push(['省份', provName(v, y) + (sc >= 0 ? ' · 治所' + cityName(sc, y) : '')]); } else rows.push(['省份', '军管（新占领，尚未建制）']); } } else if (s >= 1) rows.push(['国家', '无国家的部族地带']); }
    rows.push(['发展阶段', names[s]]);
    if (H.ideas) { const got = ideasOf(r, y), nb = H.ideas.filter(I => I.born !== null && I.born <= y).length; if (got.length) rows.push(['思潮', `已接纳 ${got.length} / ${nb}：${got.slice(-3).map(k => H.ideas[k].name).reverse().join('、')}${got.length > 3 ? '……' : ''}`]);
      let nk = -1, nt = 1e9; H.ideas.forEach((I, k) => { const t = ideaAt(k, r); if (t > y && t < nt && I.born !== null) { nt = t; nk = k; } }); if (nk >= 0 && nt < 1e8) rows.push(['下一思潮', `${H.ideas[nk].name} · 第 ${Math.round(nt)} 年传到`]); }
    { const u = unrestAt(r, y); if (s >= 1 && u > 0.05) rows.push(['民怨', u < 0.35 ? '尚可' : u < 0.6 ? '怨声载道' : '一触即发']); }
    if (civ) rows.push(['文明类型', civ.typeLabel + (cu <= -2 ? ' · 古文明' : '')], ['文化库', civ.lib]);
    if (f !== null && f >= 0) { const RG = H.religions[f]; rows.push(['信仰', RG.name + (RTYPE[RG.type] ? ' · ' + RTYPE[RG.type] : '')]); if (RG.parent >= 0) rows.push(['教派', '自' + H.religions[RG.parent].name + '分出']); if (RG.holy) rows.push(['圣地', RG.holy]); } else rows.push(['信仰', f === null ? '—' : f >= 0 ? H.religions[f].name : (civ ? civ.name.replace(/文明$/, '') + '原始信仰' : '原始信仰')]);
    const nx = H.Y[(s + 1) * (H.nR + 1) + r]; if (s < 8 && nx < INF) rows.push(['下一阶段', `${names[s + 1]} · 第 ${Math.round(nx)} 年`]);
    if (cityByRegion && cityByRegion.has(r)) { let b = -1, bp = 0; for (const i of cityByRegion.get(r)) { if (!alive(H.cities[i], y)) continue; const p = popAt(i, y); if (p > bp) { bp = p; b = i; } } if (b >= 0) rows.push(['最大城市', `${cityName(b, y)} · ${fmtPop(bp)} 人`]); }
    const k = H.country[r]; rows.push(['如今', k >= 0 && app.data.countries[k] ? app.data.countries[k].name + (H.prov[r] >= 0 && app.data.provinces[H.prov[r]] ? ' · ' + app.data.provinces[H.prov[r]].name : '') : '边疆部族地带']);
    return { title, rows };
  }

  // 前缀开关改变后：重画国名、图例、单国卡片、近事
  function prefixChanged() {
    const b = $('tlPrefix'); if (b) { b.classList.toggle('on', !!app.noPrefix); b.textContent = app.noPrefix ? '前缀已关' : '去前缀'; }
    if (!H || !on) return; preFor = null; dirty = true; feedSig = ''; feedAllSig = ''; RIV.cache = null;
    renderLegend(); renderFeed(); if (focusP >= 0) renderFocus(); if (cardCity >= 0) renderCityCard(); if (!$('tlRiver').hidden) drawRiver(); app.map.draw();
  }
  G.Timeline = { prefixChanged, setFocus: p => setFocus(p), clearFocus: () => clearFocus(), flyTo: r => app.map.flyTo(H.cx[r], H.cy[r], 3), dots: () => dots, click, tip, init, open, close, toggle, reset, progress, get on() { return on; }, get data() { return H; }, get pulses() { return pulses.length; }, setYear: y => setYear(y), get year() { return year; }, setLayer: l => { const b = document.querySelector(`#tlLayer [data-l=${l}]`); if (b) b.click(); }, toggleDrawer };
})(window);
