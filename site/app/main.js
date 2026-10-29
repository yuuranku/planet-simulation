/* 主程序：推演调度、图层面板、图例、搜索、工具、信息 */
(function (G) {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmtPop = n => n >= 1e8 ? (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + ' 亿' : n >= 1e4 ? Math.round(n / 1e4) + ' 万' : String(Math.round(n));
  const KOPPEN = [['Af', '热带雨林气候', '#2f5fd6'], ['Am', '热带季风气候', '#3d8bf0'], ['Aw', '热带草原气候', '#74b8f4'], ['BWh', '热带沙漠气候', '#e8584c'], ['BWk', '温带沙漠气候', '#f2a39a'], ['BSh', '热带半干旱气候', '#eab04a'], ['BSk', '温带半干旱气候', '#f4d77a'], ['Csa', '地中海气候（炎夏）', '#e8e04a'], ['Csb', '地中海气候（温夏）', '#c8c45a'], ['Cwa', '亚热带季风气候', '#93db8a'], ['Cwb', '高原季风气候', '#6cbf6a'], ['Cfa', '亚热带湿润气候', '#bfe36a'], ['Cfb', '温带海洋性气候', '#7fd45a'], ['Cfc', '亚寒带海洋性气候', '#4cb04a'], ['Ds', '夏干大陆性气候', '#d878d8'], ['Dw', '冬干大陆性气候', '#a9b0f0'], ['Dfa', '温带大陆性气候（炎夏）', '#53d6d6'], ['Dfb', '温带大陆性气候（温夏）', '#58b8e8'], ['Dfc', '亚寒带针叶林气候', '#2f8d8c'], ['Dfd', '极寒亚寒带气候', '#2b5d6e'], ['ET', '苔原气候', '#b4b8bc'], ['EF', '冰原气候', '#8a8f96']];
  const BIOMES = [['冰盖', '#eef3f6'], ['苔原', '#bfc6b4'], ['北方针叶林', '#5f8f6e'], ['温带草原', '#c9d38c'], ['温带落叶林', '#7fb069'], ['温带雨林', '#3f8f6a'], ['地中海灌丛', '#b9b96a'], ['温带荒漠', '#dccb9a'], ['热带荒漠', '#ecd29a'], ['稀树草原', '#d6c66c'], ['热带季雨林', '#8cbf5a'], ['热带雨林', '#3f9a4c'], ['高山草甸与裸岩', '#b3a79a']];
  const SEASONS = ['春分', '夏至', '秋分', '冬至'];

  const TOPICS = {
    geo: [['terrain', '地形与水系'], ['koppen', '柯本气候分类'], ['biome', '生物群系'], ['basin', '水文流域'], ['agri', '农业潜力'], ['habit', '宜居度'], ['veg', '植被覆盖']],
    human: [['pop', '人口分布'], ['culture', '文明影响范围'], ['language', '语言影响范围'], ['religion', '宗教影响范围'], ['country', '国家疆域'], ['govern', '实际治理'], ['province', '省份疆域'], ['heritage', '遗迹地图']]
  };
  const TOPIC_NAME = Object.fromEntries([...TOPICS.geo, ...TOPICS.human, ['sprecip', '季节降水'], ['stemp', '季节气温'], ['plates', '板块构造']]);
  const AUX = [['elev', '高程'], ['depth', '海深'], ['grid', '经纬线'], ['coast', '海岸与等高线'], ['lakes', '湖泊'], ['snow', '积雪与海冰（估计）'], ['landform', '地貌符号'], ['frost', '冻土潜势'], ['polar', '极圈与极点'], ['rivers', '河流'], ['names', '地理名称（山脉、湖海、河流）'], ['cities', '城市聚落'], ['roads', '交通网络'], ['borders', '国界与国名'], ['nominal', '名义势力范围']];

  const app = {
    data: null, tab: 'geo', topics: { geo: 'terrain', human: 'country', season: 'sprecip', plates: 'plates' }, season: 0,
    aux: { elev: true, depth: true, grid: false, coast: true, lakes: true, snow: true, landform: true, style: (() => { try { return localStorage.getItem('planet-map-style') || 'default'; } catch (e) { return 'default'; } })(), frost: false, polar: true, rivers: true, names: true, cities: true, roads: true, borders: false, nominal: false },
    sx: { wind: false, pressure: false, currents: false, srivers: true },
    tool: null, hover: true, state: null, thumbs: {},
    topic() { return this.topics[this.tab]; },
    auxObj() { const a = this.aux; return { elev: a.elev, depth: a.depth, lakes: a.lakes, snow: a.snow, frost: a.frost, landform: a.landform, style: a.style, coast: a.coast, borders: a.borders, nominal: a.nominal, gray: !!a.gray }; }
  };
  G.app = app;
  // ---------- 名称：任何地名、国名、自然名都可双击改名（按世界保存） ----------
  app.names = {};
  const NAME_SRC = { country: 'countries', province: 'provinces', city: 'cities', label: 'labels', river: 'riverNames', tribe: 'tribes', jimi: 'jimis', plate: 'plates', culture: 'cultures', language: 'languages', religion: 'religions' };
  const namesKey = () => 'planet-names-' + (app.state ? G.Config.encode(app.state) : '');
  function objOf(id) { const [k, i] = id.split(':'); const arr = app.data && app.data[NAME_SRC[k]]; return arr ? arr[+i] : null; }
  app.nameOf = (id, def) => app.names[id] || def;
  function applyNames() {
    for (const [id, v] of Object.entries(app.names)) { if (id === 'world') continue; const o = objOf(id); if (o) { if (o._orig === undefined) o._orig = o.name; o.name = v; } }
  }
  function setName(id, value) {
    value = (value || '').trim();
    if (id === 'world') { if (value) app.names.world = value; else delete app.names.world; $('worldName').textContent = app.names.world || (app.data.stats.worldName + '星'); }
    else { const o = objOf(id); if (!o) return; if (o._orig === undefined) o._orig = o.name; if (value && value !== o._orig) { app.names[id] = value; o.name = value; } else { delete app.names[id]; o.name = o._orig; } }
    try { localStorage.setItem(namesKey(), JSON.stringify(app.names)); } catch (e) { /* 存储满 */ }
    buildIndex(); renderLegend(); renderInfo(); map.draw(); saveWorld(); globeSent = false; if (G.City) G.City.refresh();
  }
  let nameEditor = null;
  app.objName = id => { if (id === 'world') return $('worldName').textContent; const o = objOf(id); return o ? o.name : null; };
  app.worldKey = () => G.Config.encode(app.state);
  app.setRaw = (id, v) => { app.names[id] = v; try { localStorage.setItem(namesKey(), JSON.stringify(app.names)); } catch (e) { /* */ } saveWorld(); };
  app.editName = (current, cx, cy, onSave) => {
    if (nameEditor) nameEditor.remove();
    const box = document.createElement('div'); box.className = 'name-editor';
    box.innerHTML = `<input value="${(current || '').replace(/"/g, '&quot;')}" maxlength="40"><small>回车保存 · Esc 取消</small>`;
    document.body.appendChild(box); nameEditor = box;
    box.style.left = Math.max(8, Math.min(innerWidth - 260, cx - 120)) + 'px'; box.style.top = Math.max(8, Math.min(innerHeight - 80, cy - 22)) + 'px';
    const inp = box.querySelector('input'); inp.focus(); inp.select();
    let done = false;
    const finish = ok => { if (done) return; done = true; const v = inp.value.trim(); box.remove(); nameEditor = null; if (ok && v && v !== current) onSave(v); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); e.stopPropagation(); });
    inp.addEventListener('blur', () => finish(true));
  };
  app.onRename = (id, current, cx, cy) => {
    if (nameEditor) nameEditor.remove();
    const box = document.createElement('div'); box.className = 'name-editor';
    box.innerHTML = `<input value="${(current || '').replace(/"/g, '&quot;')}" maxlength="40"><small>回车保存 · Esc 取消 · 清空恢复原名</small>`;
    document.body.appendChild(box); nameEditor = box;
    box.style.left = Math.max(8, Math.min(innerWidth - 260, cx - 120)) + 'px'; box.style.top = Math.max(8, Math.min(innerHeight - 80, cy - 22)) + 'px';
    const inp = box.querySelector('input'); inp.focus(); inp.select();
    let done = false;
    const finish = ok => { if (done) return; done = true; if (ok) setName(id, inp.value); box.remove(); nameEditor = null; };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); e.stopPropagation(); });
    inp.addEventListener('blur', () => finish(true));
  };
  document.addEventListener('dblclick', e => { const el = e.target.closest('[data-name-id]'); if (!el || !app.data) return; e.preventDefault(); const id = el.dataset.nameId; const cur = id === 'world' ? $('worldName').textContent : (objOf(id) || {}).name; app.onRename(id, cur, e.clientX, e.clientY); });

  // ---------- Worker ----------
  let worker = null, seq = 0;
  const pending = new Map();
  let shim = null;
  function startWorker() {
    try {
      worker = new Worker('core/worker.js');
      worker.onmessage = e => onMsg(e.data);
      worker.onerror = e => { console.warn('worker error', e.message); };
    } catch (err) { worker = null; }
  }
  async function loadShim() {
    if (shim) return shim;
    for (const f of ['noise', 'libraries', 'culture-ext', 'religions', 'planet', 'climate', 'hydro', 'society', 'borders', 'citysite', 'render', 'history/regions', 'history/dawn', 'history/cities', 'history/polity', 'history/outline', 'history/heritage', 'history/apply', 'history/index', 'worker']) {
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'core/' + f + '.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    }
    shim = window.TerrainWorkerShim; return shim;
  }
  function post(m) {
    if (worker) worker.postMessage(m);
    else loadShim().then(s => setTimeout(() => s.handle(m, onMsg), 0));
  }
  function call(type, payload) { return new Promise(res => { const id = ++seq; pending.set(id, res); post({ type, id, ...payload }); }); }
  app.call = call;
  function onMsg(m) {
    if (m.type === 'progress') return onProgress(m);
    if (m.type === 'histProgress') return G.Timeline && G.Timeline.progress(m);
    if (m.type === 'ready') return onReady(m);
    if (m.type === 'contoursFine') { if (app.data) { app.data.contoursFine = m.contours; if (map.paths) { map.paths.cont.fine = null; map.draw(); } } return; }
    if (m.type === 'error') { console.error(m.message); toast('推演出错：' + m.message.split('\n')[0]); $('progress').hidden = true; return; }
    const r = pending.get(m.id); if (r) { pending.delete(m.id); r(m); }
  }
  app.render = async function (req) {
    const m = await call('render', { req });
    const img = new ImageData(new Uint8ClampedArray(m.buf.buffer || m.buf), req.w, req.h);
    if (window.createImageBitmap) return createImageBitmap(img);
    const c = document.createElement('canvas'); c.width = req.w; c.height = req.h; c.getContext('2d').putImageData(img, 0, 0); return c;
  };

  // ---------- 推演 ----------
  const STAGES = ['板块漂移', '大陆核心', '板块边界', '地壳均衡', '山脉细节', '水力侵蚀', '四季气候', '气候分类', '水系汇流', '河流流量', '流域划分', '河道描绘', '文明', '等高线与气象场'];
  // 加载大标题：趣味说法（按当前阶段切换）；下方小字是实际正在计算的内容
  const FUN = [
    [/板块|大陆核心|地壳/, ['正在揉捏大陆的形状', '正在把地壳推来推去', '正在等大陆慢慢漂开']],
    [/山脉|侵蚀/, ['正在雕刻山脊与峡谷', '正在让雨水慢慢磨平山棱']],
    [/气候|季/, ['正在给星球安排四季', '正在研究风往哪里吹', '正在决定哪里下雨']],
    [/水系|河|流域|湖|湿地|水/, ['正在帮河流找到回家的路', '正在往低洼处倒一点湖水']],
    [/人口|聚落|宜居|文明|语言|宗教/, ['正在考虑人类会在哪里定居', '正在研究人体结构与耐寒能力', '正在发明第一批语言']],
    [/道路|航线|交通|城市/, ['正在踩出第一条商路', '正在规划城镇之间的距离']],
    [/国家|疆域|省份|治理|边塞|商镇/, ['正在划定国境线', '正在任命第一批地方官', '正在和边疆部族谈判']],
    [/命名|文化库/, ['正在给山河城邑起名字', '正在翻阅古老的地名册']],
    [/等高线|气象场|渲染|图/, ['正在给地图上色', '正在描绘等高线']]
  ];
  let funKey = '';
  let genCfg = null, spinT = 0;
  function generate(st) {
    if (G.City && G.City.current !== null) G.City.close();
    if (!st.libs) st.libs = G.Home.snapshot();
    if (!st.rlibs && G.RelLib) st.rlibs = G.RelLib.snapshot();
    G.Home.hide(); $('libPage').hidden = true;
    app.state = st; genCfg = G.Config.toCfg(st);
    G.Home.setJob({ name: '新世界', seed: st.seed, stage: '准备推演', f: 0 });
    history.replaceState(null, '', '#' + G.Config.encode(st));
    $('progress').hidden = false;
    $('progBar').style.width = '0%'; $('progStage').textContent = '准备推演…'; $('progTitle').textContent = '正在构思一颗新的星球'; funKey = '';
    spinT = performance.now(); spinGlobe();
    post({ type: 'generate', cfg: genCfg });
  }
  function onProgress(m) {
    $('progStage').textContent = m.stage; $('progBar').style.width = Math.round(m.f * 100) + '%';
    G.Home.setJob({ name: '新世界', seed: app.state.seed, stage: m.stage, f: m.f });
    const k = FUN.find(([re]) => re.test(m.stage)); if (k && k[0].source !== funKey) { funKey = k[0].source; const list = k[1]; const t = $('progTitle'); t.style.opacity = 0; setTimeout(() => { t.textContent = list[Math.floor(Math.random() * list.length)]; t.style.opacity = 1; }, 160); }
  }
  function spinGlobe() {
    if ($('progress').hidden) return;
    const c = $('spinGlobe').getContext('2d'), t = (performance.now() - spinT) / 1000;
    c.clearRect(0, 0, 120, 120);
    c.fillStyle = '#d9edf5'; c.beginPath(); c.arc(60, 60, 46, 0, 7); c.fill();
    c.strokeStyle = 'rgba(26,115,232,.55)'; c.lineWidth = 1.2;
    for (let k = 0; k < 6; k++) { const a = ((t * 0.6 + k / 6) % 1) * Math.PI; const rx = Math.abs(Math.cos(a)) * 46; c.beginPath(); c.ellipse(60, 60, rx, 46, 0, 0, 7); c.stroke(); }
    for (const la of [-0.5, 0, 0.5]) { c.beginPath(); c.ellipse(60, 60 - la * 46, Math.sqrt(1 - la * la) * 46, 5, 0, 0, 7); c.stroke(); }
    c.strokeStyle = '#1a73e8'; c.lineWidth = 2; c.beginPath(); c.arc(60, 60, 46, 0, 7); c.stroke();
    requestAnimationFrame(spinGlobe);
  }
  function onReady(m) {
    if (G.Timeline) G.Timeline.reset();
    m.cfg = genCfg; app.data = m;
    try { app.names = JSON.parse(localStorage.getItem(namesKey()) || '{}'); } catch (e) { app.names = {}; }
    $('progress').hidden = true;
    const s = m.stats;
    { const sv = loadSaved().find(w => w.key === G.Config.encode(app.state)); if (sv && sv.name && !app.names.world && sv.name !== s.worldName + '星') app.names.world = sv.name; $('worldName').textContent = app.names.world || s.worldName + '星'; }
    $('worldStats').textContent = `${s.countries} 个国家 · ${s.provinces} 个省份 · ${s.settlements} 处聚落`;
    document.title = s.worldName + '星 · 星球推演';
    try { app.names = JSON.parse(localStorage.getItem(namesKey()) || '{}'); } catch (e) { app.names = {}; }
    applyNames();
    buildIndex();
    loadMarkers();
    clearTools();
    map.setData(m);
    globeSent = false; if (!$('globeWrap').hidden) showGlobe(false);
    renderPanel(); renderLegend(); renderInfo();
    makeThumbs();
    setTimeout(() => { saveWorld(); G.Home.setJob({ name: $('worldName').textContent, seed: app.state.seed, stage: '推演完成 · 用时 ' + (m.info.ms / 1000).toFixed(1) + ' 秒', f: 1, done: true, thumb: worldThumb() }); }, 1500);
    toast(`推演完成 · 用时 ${(m.info.ms / 1000).toFixed(1)} 秒 · 网格 ${m.W}×${m.H}`);
  }

  // ---------- 地图 / 球体 ----------
  const map = new G.MapView($('map'), app); app.map = map;
  app.onTexture = (img) => {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    // 把主要河流画进球体纹理
    if (app.aux.rivers && map.paths) { const k = img.width / app.data.W; x.setTransform(k, 0, 0, k, 0, 0); x.strokeStyle = '#4b8fc6'; x.lineCap = 'round'; const rp = map.riverPaths(null); [0, 1].forEach(t => [1, 2, 3, 4].forEach(i => { x.lineWidth = (0.5 + i * 0.35) / k; x.stroke(rp.byTier[t].cls[i]); })); }
    app.texCanvas = c;
    if (app.state && app.topic() === 'terrain') { const rec = loadSaved().find(w => w.key === G.Config.encode(app.state)); if (rec && !rec.thumb) { saveWorld(); G.Home.setJob({ name: $('worldName').textContent, seed: app.state.seed, stage: '推演完成 · 用时 ' + (app.data.info.ms / 1000).toFixed(1) + ' 秒', f: 1, done: true, thumb: worldThumb() }); } }
    const t = document.createElement('canvas'); t.width = 152; t.height = 152; const tx = t.getContext('2d');
    tx.drawImage(c, c.width * 0.18, 0, c.height * 1.0, c.height, 0, 0, 152, 152);
    $('layerThumb').src = t.toDataURL('image/jpeg', 0.8);
  };
  new ResizeObserver(() => { map.resize(); }).observe($('stage'));
  app.onViewChange = () => {
    if (!app.data) return;
    const kmPerPx = map.kmPerGrid / map.view.s;
    const nice = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    let km = nice[0]; for (const n of nice) if (n / kmPerPx <= 110) km = n;
    $('scaleBar').style.width = (km / kmPerPx).toFixed(1) + 'px'; $('scaleText').textContent = km + ' km';
  };
  $('zin').onclick = () => map.zoomAt(map.vw / 2, map.vh / 2, 1.6);
  $('zout').onclick = () => map.zoomAt(map.vw / 2, map.vh / 2, 1 / 1.6);
  $('zfit').onclick = () => { map.fit(); map.draw(); map.scheduleFrame(); };

  // ---------- 图层面板 ----------
  function toggle(key, label, on, group) { return `<button class="tg${on ? ' on' : ''}" data-${group}="${key}"><span>${label}</span><i class="sw-ui"></i></button>`; }
  let auxOpen = true;
  function renderPanel() {
    const tab = app.tab;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    let h = '';
    if (tab === 'geo' || tab === 'human') {
      h += `<h3>${tab === 'geo' ? '地理专题' : '人文专题'}</h3><div class="topics">` + TOPICS[tab].map(([k, n]) => `<button class="topic${app.topics[tab] === k ? ' on' : ''}" data-topic="${k}"><span class="th">${app.thumbs[k] ? `<img src="${app.thumbs[k]}" alt="">` : ''}</span>${n}</button>`).join('') + '</div>';
    } else if (tab === 'season') {
      h += `<h3>季节</h3><div class="seasons">${SEASONS.map((s, i) => `<button data-season="${i}" class="${app.season === i ? 'on' : ''}">${s}</button>`).join('')}</div>`;
      h += `<h3>底图</h3><div class="toggles">${toggle('sprecip', '降水', app.topics.season === 'sprecip', 'sbase')}${toggle('stemp', '气温（℃）', app.topics.season === 'stemp', 'sbase')}</div>`;
      h += `<h3>季风图层</h3><div class="toggles">${toggle('wind', '风场', app.sx.wind, 'sx')}${toggle('pressure', '气压', app.sx.pressure, 'sx')}${toggle('currents', '冷暖洋流', app.sx.currents, 'sx')}${toggle('srivers', '季节河流', app.sx.srivers, 'sx')}</div>`;
    } else {
      h += `<p class="desc">查看当前世界的板块、运动方向与构造边界。深绿齿线为汇聚边界（齿指向俯冲方向），红线为离散边界，橙色虚线为转换断层。</p>`;
    }
    h += `<div class="aux-head${auxOpen ? '' : ' closed'}" id="auxHead"><svg viewBox="0 0 24 24"><path d="m7 10 5 5 5-5" fill="currentColor"/></svg>辅助图层</div>`;
    if (auxOpen) h += `<div class="toggles">${AUX.map(([k, n]) => toggle(k, n, app.aux[k], 'aux')).join('')}</div>`;
    if (tab === 'plates' || tab === 'geo') h += `<p class="note">地貌符号（区域级起显示）：火山（▲）、湿地范围与三角洲平原，图式沿用原版短线纹。冻土潜势仅在陆地显示，依据年均近地面气温推算，默认关闭，不代表实测冻土。</p>`;
    if (tab === 'human') h += `<p class="note">米色为部落与游牧空间；开启“名义势力范围”后，国家宣称但未实际控制的土地以条纹显示。</p>`;
    $('panelBody').innerHTML = h;
  }
  $('tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; app.tab = b.dataset.tab; renderPanel(); onTopicChange(); });
  $('panelBody').addEventListener('click', e => {
    const t = e.target.closest('[data-topic]'); if (t) { app.topics[app.tab] = t.dataset.topic; renderPanel(); onTopicChange(); return; }
    const s = e.target.closest('[data-season]'); if (s) { app.season = +s.dataset.season; renderPanel(); onTopicChange(); return; }
    const sb = e.target.closest('[data-sbase]'); if (sb) { app.topics.season = sb.dataset.sbase; renderPanel(); onTopicChange(); return; }
    const sx = e.target.closest('[data-sx]'); if (sx) { app.sx[sx.dataset.sx] = !app.sx[sx.dataset.sx]; renderPanel(); map.draw(); renderLegend(); return; }
    const a = e.target.closest('[data-aux]'); if (a) { const k = a.dataset.aux; app.aux[k] = !app.aux[k]; renderPanel(); map.refreshRaster(); map.draw(); renderLegend(); return; }
    if (e.target.closest('#auxHead')) { auxOpen = !auxOpen; renderPanel(); }
  });
  function onTopicChange() { map.refreshRaster(); map.draw(); renderLegend(); }
  app.ui = { refresh() { renderPanel(); onTopicChange(); } };
  $('layerBtn').onclick = () => { $('layerPanel').hidden = !$('layerPanel').hidden; if (!$('layerPanel').hidden) renderPanel(); };
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { $(b.dataset.close).hidden = true; if (b.dataset.close === 'infoPanel') setTool(null, 'info'); });

  async function makeThumbs() {
    const d = app.data;
    const list = [...TOPICS.geo, ...TOPICS.human].map(t => t[0]);
    for (const k of list) {
      if (app.data !== d) return;
      const img = await app.render({ w: 192, h: 96, x0: 0, y0: 0, s: d.W / 192, topic: k, season: 0, aux: { elev: true, depth: true, lakes: true, snow: true, coast: true, borders: false } });
      const c = document.createElement('canvas'); c.width = 192; c.height = 96; c.getContext('2d').drawImage(img, 0, 0);
      app.thumbs[k] = c.toDataURL('image/jpeg', 0.82);
      if (!$('layerPanel').hidden) { const el = document.querySelector(`[data-topic="${k}"] .th`); if (el) el.innerHTML = `<img src="${app.thumbs[k]}" alt="">`; }
    }
  }

  // ---------- 图例 ----------
  const grad = (stops, lo, hi) => `linear-gradient(90deg,${stops.map(([v, c]) => `${c} ${((v - lo) / (hi - lo) * 100).toFixed(1)}%`).join(',')})`;
  const palColor = (arr, i) => `rgb(${arr[i * 3]},${arr[i * 3 + 1]},${arr[i * 3 + 2]})`;
  function symLegend() {
    return `<h5>符号（随缩放分级显示）</h5><div class="sym">
      <span><svg viewBox="0 0 28 14"><path d="M1 7c6-5 10 5 26 0" stroke="#4b8fc6" stroke-width="2"/></svg>河流（全图只显示干流，放大逐级显示支流）</span>
      <span><svg viewBox="0 0 28 14"><path d="M1 7c6-4 14 4 26 0" stroke="#76694f" stroke-width="1"/></svg>等高线（23 层，低地加密）</span>
      <span><svg viewBox="0 0 28 14"><rect width="28" height="14" rx="3" fill="rgba(214,204,160,.35)"/><path d="M3 4h6M15 4h6M8 10h6M20 10h6" stroke="#9a8556" stroke-width="1.1"/></svg>三角洲平原（地貌符号）</span>
            <span><svg viewBox="0 0 28 14"><rect width="28" height="14" rx="3" fill="rgba(150,186,170,.25)"/><path d="M2 4h5M4 5.5h2M14 4h5M8 10h6M20 10h6" stroke="#447d8c" stroke-width="1.1"/></svg>湿地范围（地貌符号）</span>
      <span><svg viewBox="0 0 28 14"><path d="M11 4h6M11 10h6" stroke="#5b4636" stroke-width="1.4"/></svg>桥梁（地方级起）</span>
      <span><svg viewBox="0 0 28 14"><path d="M1 7h26" stroke="#463428" stroke-width="1.6"/></svg>国界</span>
      <span><svg viewBox="0 0 28 14"><path d="M10 12V3h1.6v1.8h1.6V3h1.6v1.8h1.6V3H18v9z" fill="#d7b978" stroke="#593f31" stroke-width=".8"/></svg>边堡 / 边塞（区域级起）</span>
      <span><svg viewBox="0 0 28 14"><path d="M10 12V3h2v2h4V3h2v9h-2V8.5a2 2 0 0 0-4 0V12z" fill="#d7b978" stroke="#593f31" stroke-width=".8"/></svg>关隘（山口与干道过境）</span>
      <span><svg viewBox="0 0 28 14"><path d="M1 7h26" stroke="#6e503c" stroke-width="1.2" stroke-dasharray="1.5 2.5"/></svg>国家与部族边疆</span>
      <span><svg viewBox="0 0 28 14"><path d="M1 7h26" stroke="#be5532" stroke-width="2"/></svg>干道</span>
      <span><svg viewBox="0 0 28 14"><path d="M1 7h26" stroke="#b9734b" stroke-width="1.2"/></svg>区域与地方道路</span>
      <span><svg viewBox="0 0 28 14"><path d="M1 7h26" stroke="#4678a5" stroke-dasharray="3 3"/></svg>海运航线</span>
      ${app.data && app.data.travel.era === 'industrial' ? '<span><svg viewBox="0 0 28 14"><path d="M1 7h26" stroke="#3a3f46" stroke-width="2.5"/><path d="M1 7h26" stroke="#fff" stroke-dasharray="3 3"/></svg>铁路</span>' : ''}
      <span><svg viewBox="0 0 28 14"><circle cx="14" cy="7" r="5" fill="#fff" stroke="#2b333a" stroke-width="1.8"/><circle cx="14" cy="7" r="2" fill="#c0392b"/></svg>首都</span>
      <span><svg viewBox="0 0 28 14"><circle cx="14" cy="7" r="4.4" fill="#fff" stroke="#2b333a" stroke-width="1.4"/><circle cx="14" cy="7" r="1.6" fill="#2b333a"/></svg>大都会</span>
      <span><svg viewBox="0 0 28 14"><circle cx="14" cy="7" r="3.2" fill="#fff" stroke="#2b333a" stroke-width="1.4"/></svg>城市 · 城镇</span>
      <span><svg viewBox="0 0 28 14"><rect x="11" y="4" width="6" height="6" fill="#fff" stroke="#6a3f2c" stroke-width="1.4"/></svg>边塞与关隘</span></div>
      <p style="margin-top:8px">世界级显示首都、大都会与干道；区域级加入城市与区域道路；地方级加入城镇、地方道路与桥梁；细节级显示全部聚落。</p>`;
  }
  function renderLegend() {
    if (!app.data) return;
    const d = app.data, t = app.topic(), pal = d.pal;
    $('legendTitle').textContent = (TOPIC_NAME[t] || '图') + '图例';
    let h = '';
    if (t === 'terrain') {
      h += `<h5>海拔（米）</h5><div class="ramp" style="background:${grad([[0, '#a9d18a'], [450, '#dfe29c'], [1500, '#e6b878'], [3000, '#ae7452'], [4800, '#d9d2cc'], [5600, '#f7f5f2']], 0, 6000)}"></div><div class="ramp-l"><span>0</span><span>1500</span><span>3000</span><span>6000</span></div>`;
      h += `<h5>海深（米）</h5><div class="ramp" style="background:${grad([[-7000, '#86bcdc'], [-2500, '#a6d2ea'], [-180, '#d8eef6'], [0, '#e8f6fa']], -7000, 0)}"></div><div class="ramp-l"><span>7000</span><span>2500</span><span>大陆架</span></div>`;
      h += symLegend();
    } else if (t === 'koppen') h += `<h5>柯本气候带</h5><div class="sw">${d.koppenUsed.map(k => `<span><i style="background:${KOPPEN[k][2]}"></i><em>${KOPPEN[k][0]} ${KOPPEN[k][1]}</em></span>`).join('')}</div>`;
    else if (t === 'biome') h += `<h5>生物群系</h5><div class="sw">${d.biomeUsed.map(k => `<span><i style="background:${BIOMES[k][1]}"></i><em>${BIOMES[k][0]}</em></span>`).join('')}</div>`;
    else if (t === 'basin') h += `<p>同一颜色为同一流域（汇入同一河口）。按面积取最大的 ${Math.min(90, d.pal.basin.length / 3 - 1)} 个流域着色，灰色为小流域。</p>` + symLegend();
    else if (t === 'agri' || t === 'habit' || t === 'veg') {
      const st = { agri: [[0, '#f3eedf'], [0.2, '#eadb9c'], [0.45, '#b9d27c'], [0.7, '#6fb35f'], [1, '#2f7d45']], habit: [[0, '#f2ece4'], [0.2, '#f1c98c'], [0.45, '#e8e08a'], [0.7, '#8fcf86'], [1, '#2f9a7a']], veg: [[0, '#f1e9d2'], [0.25, '#dccf92'], [0.5, '#9ccc6e'], [0.75, '#5aa85a'], [1, '#2d7a46']] }[t];
      const note = { agri: '综合积温、水分（含灌溉河流）、坡度与土壤', habit: '农业潜力、淡水与海岸可达性、气温舒适度', veg: '由年均温与年降水推算的净初级生产力' }[t];
      h += `<h5>${TOPIC_NAME[t]}</h5><div class="ramp" style="background:${grad(st, 0, 1)}"></div><div class="ramp-l"><span>低</span><span>高</span></div><p>${note}</p>`;
    } else if (t === 'pop') h += `<h5>人口密度（人/km²）</h5><div class="ramp" style="background:${grad([[0, '#f6f1e8'], [0.3, '#f4dfb4'], [1, '#f2b46a'], [1.6, '#e07a46'], [2.1, '#b8403c'], [2.7, '#6e1d3c']], 0, 2.7)}"></div><div class="ramp-l"><span>0</span><span>10</span><span>100</span><span>500</span></div><p>总人口 ${fmtPop(d.stats.population)}</p>`;
    else if (t === 'sprecip') h += `<h5>${SEASONS[app.season]} · 季节降水（mm/季）</h5><div class="ramp" style="background:${grad([[0, '#f3e6c4'], [40, '#ece0a4'], [120, '#c4df9c'], [260, '#7cc8ae'], [500, '#4c9ad4'], [900, '#3561bd'], [1500, '#2b3f93']], 0, 1500)}"></div><div class="ramp-l"><span>0</span><span>260</span><span>900</span><span>1500</span></div>` + seasonSym();
    else if (t === 'stemp') h += `<h5>${SEASONS[app.season]} · 季节气温（°C）</h5><div class="ramp" style="background:${grad([[-45, '#323a8f'], [-25, '#5774cc'], [-8, '#9fc4ec'], [3, '#d8ecf2'], [12, '#f4f1c6'], [20, '#f6cd82'], [28, '#ec8d55'], [36, '#c9433d'], [44, '#8a1b35']], -45, 44)}"></div><div class="ramp-l"><span>-45</span><span>0</span><span>20</span><span>44</span></div>` + seasonSym();
    else if (t === 'plates') {
      h += `<h5>构造边界</h5><div class="sym"><span><svg viewBox="0 0 28 14"><path d="M1 7h26" stroke="#2f5b4f" stroke-width="2.4"/><path d="M9 7l3-5 3 5z" fill="#2f5b4f"/></svg>汇聚边界（造山 / 海沟 / 岛弧）</span><span><svg viewBox="0 0 28 14"><path d="M1 7h26" stroke="#d14b42" stroke-width="2"/></svg>离散边界（洋中脊 / 裂谷）</span><span><svg viewBox="0 0 28 14"><path d="M1 7h26" stroke="#e09a37" stroke-width="1.7" stroke-dasharray="5 3"/></svg>转换断层</span></div>`;
      h += `<h5>板块</h5><div class="sw">${d.plates.map((p, i) => `<span data-name-id="plate:${i}"><i style="background:${palColor(pal.plate, i)}"></i><em>${p.name}</em></span>`).join('')}</div>`;
    } else if (t === 'heritage') {
      const H0 = d.heritage || [], COL = G.MapView.HER_COL, SVG = G.MapView.herSvg, on = app.herCat || (app.herCat = { religious: 1, war: 1, culture: 1 });
      const KIND = { religious: [['holy', '圣地 · 发源地与教派祖庭'], ['mountain', '圣山'], ['tomb', '圣墓']], war: [['siege', '围城'], ['battle', '古战场'], ['burned', '毁于战火的城'], ['fort', '旧关塞'], ['revolt', '起义起事处']], culture: [['ruin', '古城废墟'], ['capital', '古都'], ['mausoleum', '帝王陵'], ['cradle', '文明摇篮']] };
      const CATN = { religious: '宗教遗迹', war: '战争遗迹', culture: '人文遗迹' };
      h += `<p>从这颗星球的历史推演里留下的遗迹，共 ${H0.length} 处。点类别可以显示或隐藏；悬停徽章看来历。城市旁的紫色星为圣城。</p>`;
      for (const cat of ['religious', 'war', 'culture']) { const n = H0.filter(o => o.cat === cat).length;
        h += `<h5><label style="cursor:pointer"><input type="checkbox" data-her="${cat}" ${on[cat] ? 'checked' : ''}> ${CATN[cat]} <small>${n}</small></label></h5><div class="sym">${KIND[cat].map(([k, lab]) => { const m = H0.filter(o => o.cat === cat && G.MapView.herKey(o) === k).length; return m ? `<span>${SVG(k, COL[cat])}${lab} <small>${m}</small></span>` : ''; }).join('')}</div>`; }
    } else {
      const map2 = { country: ['country', d.countries], govern: ['country', d.countries], province: ['province', d.provinces], culture: ['culture', d.cultures], language: ['language', d.languages], religion: ['religion', d.religions] }[t];
      const [pk, list] = map2;
      const items = list.map((x, i) => [x, i]);
      if (pk === 'country') items.sort((a, b) => b[0].pop - a[0].pop);
      h += `<h5>${TOPIC_NAME[t]}${t === 'govern' ? ' · 颜色越淡，实际控制越弱' : t === 'culture' || t === 'language' ? ' · 颜色越淡，影响越弱' : ''}</h5><div class="sw">${items.slice(0, 24).map(([x, i]) => `<span data-name-id="${pk}:${i}" title="双击改名"><i style="background:${palColor(pal[pk], i)}"></i><em>${x.name}</em></span>`).join('')}</div>`;
      if (items.length > 24) h += `<p>另有 ${items.length - 24} 项，可在搜索框中查找。</p>`;
      h += `<div class="sw" style="margin-top:8px"><span><i style="background:#efe6d2"></i><em>部落与游牧空间</em></span><span><i style="background:#f3efe6;border:1px solid #ddd"></i><em>无人荒野 / 冰盖</em></span></div>`;
    }
    $('legend').innerHTML = h;
  }
  function seasonSym() {
    return `<h5>季风图层</h5><div class="sym"><span><svg viewBox="0 0 28 14"><path d="M3 7h20M23 7l-5-3M23 7l-5 3" stroke="#37465a" stroke-width="1.4"/></svg>风向（长度示风速）</span><span><svg viewBox="0 0 28 14"><path d="M3 7h20M23 7l-5-3M23 7l-5 3" stroke="#d9534f" stroke-width="1.8"/></svg>暖流</span><span><svg viewBox="0 0 28 14"><path d="M3 7h20M23 7l-5-3M23 7l-5 3" stroke="#2f7fc1" stroke-width="1.8"/></svg>寒流</span><span><b style="color:#2f6fb3;width:28px;text-align:center">H</b>高压 <b style="color:#c4473f;margin-left:10px">L</b>低压</span><span><svg viewBox="0 0 28 14"><path d="M1 7h26" stroke="#4b8fc6" stroke-width="1" stroke-dasharray="2 2.5"/></svg>季节性断流河段</span></div>`;
  }
  $('legend').addEventListener('change', e => { const c = e.target.closest('[data-her]'); if (!c) return; app.herCat = app.herCat || { religious: 1, war: 1, culture: 1 }; app.herCat[c.dataset.her] = c.checked ? 1 : 0; map.draw(); }); // 遗迹类别开关
  $('legendBtn').onclick = () => { $('legend').hidden = !$('legend').hidden; $('legendBtn').classList.toggle('open', !$('legend').hidden); };

  // ---------- 信息 ----------
  function renderInfo() {
    const d = app.data; if (!d) return;
    const c = d.cfg, s = d.stats, st = app.state;
    const q = id => { const qq = G.Config.Q.find(x => x.id === id); const o = qq.o.find(x => x[0] === st.a[id]); return o[1] + (o[2] ? ' · ' + o[2] : ''); };
    const polarName = { land: '有大陆', ocean: '以海洋为主', separate: '单独大陆' };
    const kv = (a) => `<dl class="kv">${a.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;
    const pal = d.pal;
    const topK = d.countries.map((k, i) => [k, i]).sort((a, b) => b[0].pop - a[0].pop).slice(0, 12);
    $('infoBody').innerHTML = `
      <h3>${s.worldName}星</h3>
      ${kv([['种子', c.seed], ['网格', `${d.W} × ${d.H}`], ['推演用时', (d.info.ms / 1000).toFixed(1) + ' 秒']])}
      <h3>天文</h3>
      ${kv([['恒星', q('star')], ['半径', c.radius + ' km'], ['一天', c.day + ' 小时'], ['自转', c.retro ? '逆行' : '顺行'], ['公转', `${c.yearDays} 日 · 轴倾角 ${c.tilt}°`], ['卫星与星环', q('moons')], ['环流带', `哈德来 ${d.info.hE}° · 费雷尔 ${d.info.fE}°`]])}
      <h3>地质</h3>
      ${kv([['板块', `${d.info.plates} 块 · ${q('plates').split(' · ')[1]}`], ['陆地占比', Math.round(c.land * 100) + '%'], ['北极', polarName[d.info.polar.N]], ['南极', polarName[d.info.polar.S]], ['新大陆', d.info.newWorld ? '有' : '无'], ['最高峰', Math.round(d.info.maxE) + ' m'], ['最深海沟', Math.round(-d.info.minE) + ' m']])}
      <h3>文明</h3>
      ${kv([['时代', s.endYear ? `文明纪元第 ${s.endYear} 年 · ${G.Config.ageLabel(s.endYear)}` : q('era')], ['人口规模', q('era')], ['总人口', fmtPop(s.population)], ['环境承载区间', fmtPop(s.supportRange[0]) + ' – ' + fmtPop(s.supportRange[1])], ['道路 / 海运航线 / 桥梁', `${s.roads} / ${s.seaRoutes} / ${s.bridges}`], ['边疆部族', s.tribes], ['国家', s.countries], ['省份', s.provinces], ['聚落', s.settlements], ['文化圈 / 语言 / 宗教', `${s.cultures} / ${s.languages} / ${s.religions}`], ['部族与非国家空间', Math.round(s.tribalShare * 100) + '%']])}
      <h3>人口最多的国家</h3>
      <div class="list">${topK.map(([k, i]) => `<button data-fly="country:${i}" data-name-id="country:${i}"><i style="background:${palColor(pal.country, i)}"></i><em>${k.name}</em><small>${k.formLabel} · ${fmtPop(k.pop)}</small></button>`).join('')}</div>
      <h3>文明</h3>
      <div class="list">${d.cultures.map((k, i) => `<button data-name-id="culture:${i}"><i style="background:${palColor(pal.culture, i)}"></i><em>${k.name}</em><small>${k.library}</small></button>`).join('')}</div>
      <h3>宗教</h3>
      <div class="list">${d.religions.map((k, i) => `<button data-name-id="religion:${i}"><i style="background:${palColor(pal.religion, i)}"></i><em>${k.name}</em></button>`).join('')}</div>`;
  }
  $('infoBody').addEventListener('click', e => { const b = e.target.closest('[data-fly]'); if (!b) return; const [t, i] = b.dataset.fly.split(':'); const k = app.data.countries[+i]; map.flyTo(k.lx, k.ly, 4); });

  // ---------- 地图风格预设 ----------
  const STYLE_LIST = [['default', '地形（默认）', '分层设色与晕渲', ['#bcd98f', '#e6b878', '#a6d2ea']], ['antique', '古典羊皮纸', '褐色纸本，宋体注记', ['#e2cf9f', '#a87e58', '#bcc8b7']],
    ['modern', '现代简洁', '平涂浅色，适合叠加人文', ['#e6eedc', '#ebe8dd', '#a8d4e6']], ['nautical', '航海图', '海洋分深度带，陆地素色', ['#f2e2ae', '#a6cfe2', '#dceaf2']],
    ['blueprint', '蓝图', '工程蓝底白线', ['#1a4478', '#3a76b4', '#e8f2ff']], ['ink', '水墨', '宣纸水墨，浓淡晕渲', ['#ece7dc', '#8f877b', '#3b3732']], ['night', '夜间', '深色底图，护眼', ['#0f1c2e', '#344030', '#5e7d99']]];
  function renderStyles() {
    $('styleGrid').innerHTML = STYLE_LIST.map(([k, n, d, c]) => `<button class="style-card${app.aux.style === k ? ' on' : ''}" data-style="${k}"><i style="background:linear-gradient(135deg,${c[0]} 0 40%,${c[1]} 40% 70%,${c[2]} 70%)"></i><b>${n}</b><small>${d}</small></button>`).join('');
  }
  $('styleGrid').addEventListener('click', e => { const b = e.target.closest('[data-style]'); if (!b) return; app.aux.style = b.dataset.style; try { localStorage.setItem('planet-map-style', app.aux.style); } catch (er) { /* */ }
    document.body.dataset.mapStyle = app.aux.style; renderStyles(); map.refreshRaster(); map.draw(); });
  document.body.dataset.mapStyle = app.aux.style;
  // ---------- 搜索 ----------
  let index = [];
  function buildIndex() {
    const d = app.data; index = [];
    d.countries.forEach(k => { if (k.lx !== undefined) index.push({ n: k.name, t: '国家', x: k.lx, y: k.ly, z: 4 }); });
    const TIER = { metropolis: '大都会', city: '城市', town: '城镇', site: '要塞' };
    d.cities.forEach((c, ci) => index.push({ ci, n: c.name, t: c.capital !== undefined ? '首都' : c.seat !== undefined ? '省会' : c.role === 'military-post' ? (c.type === 'pass-fort' ? '边关' : '要塞') : TIER[c.tier] || '城镇', x: c.x, y: c.y, z: 10, pop: c.pop }));
    d.provinces.forEach(p => { const c = d.cities[p.seat]; if (c) index.push({ n: p.name, t: '省份', x: c.x, y: c.y, z: 7 }); });
    const tn = { range: '山脉', plateau: '高原', plain: '平原', basin: '盆地', peninsula: '半岛', bay: '海湾', snow: '雪山', peak: '山峰', ocean: '大洋', sea: '海域', continent: '大陆', island: '岛屿', lake: '湖泊' };
    d.labels.forEach(l => index.push({ n: l.name, t: tn[l.type] || '地貌', x: l.x, y: l.y, z: l.type === 'ocean' || l.type === 'continent' ? 1.6 : l.type === 'peak' || l.type === 'snow' ? 12 : 4, pop: l.h }));
    d.plates.forEach(p => index.push({ n: p.name, t: '板块', x: p.x, y: p.y, z: 1.4, plate: true }));
    (d.tribes || []).forEach(t => index.push({ n: t.name, t: '部族', x: t.x, y: t.y, z: 4 }));
    (d.jimis || []).forEach(t => index.push({ n: t.name, t: '羁縻', x: t.x, y: t.y, z: 5 }));
    (d.riverNames || []).forEach(r => index.push({ n: r.name, t: '河流', x: r.x, y: r.y, z: 5 }));
  }
  let resSel = 0, resList = [];
  $('q').addEventListener('input', () => {
    const v = $('q').value.trim();
    if (!v || !app.data) { $('results').hidden = true; return; }
    resList = index.filter(r => r.n.includes(v)).sort((a, b) => (a.n.indexOf(v) - b.n.indexOf(v)) || ((b.pop || 1e9) - (a.pop || 1e9))).slice(0, 9);
    resSel = 0;
    $('results').innerHTML = resList.length ? resList.map((r, i) => `<button data-i="${i}" class="${i ? '' : 'on'}"><span>${r.n}</span><small>${r.t}</small></button>`).join('') : '<button disabled><span>没有找到</span></button>';
    $('results').hidden = false;
  });
  $('q').addEventListener('keydown', e => {
    if ($('results').hidden) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { resSel = (resSel + (e.key === 'ArrowDown' ? 1 : -1) + resList.length) % resList.length; [...$('results').children].forEach((b, i) => b.classList.toggle('on', i === resSel)); e.preventDefault(); }
    if (e.key === 'Enter' && resList[resSel]) pick(resList[resSel]);
    if (e.key === 'Escape') $('results').hidden = true;
  });
  $('results').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) pick(resList[+b.dataset.i]); });
  function pick(r) {
    $('results').hidden = true; $('q').value = r.n;
    if (r.plate && app.tab !== 'plates') { app.tab = 'plates'; renderPanel(); onTopicChange(); }
    if (r.t === '国家' && !app.aux.borders && app.tab !== 'human') { app.aux.borders = true; renderPanel(); map.refreshRaster(); }
    showGlobe(false);
    map.flyTo(r.x, r.y, r.z);
    app.highlight = { x: r.x, y: r.y, t: performance.now(), n: r.n };
    if (r.ci !== undefined && G.City) G.City.open(r.ci);
    const tick = () => { map.draw(); if (performance.now() - app.highlight.t < 2600) requestAnimationFrame(tick); };
    tick();
  }
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.search')) $('results').hidden = true; if (!e.target.closest('#menu') && !e.target.closest('[data-tool=menu]')) $('menu').hidden = true; });

  // ---------- 工具 ----------
  const tools = { route: [null, null], routeRes: null, pick: -1, measure: [], markers: [] }; // route：起点、途经点…、终点
  function setTool(t, btnKey) {
    if (btnKey === 'hover') { app.hover = !app.hover; document.querySelector('[data-tool=hover]').classList.toggle('on', app.hover); if (!app.hover) $('tip').hidden = true; return; }
    app.tool = app.tool === t ? null : t;
    document.querySelectorAll('.rail-btn').forEach(b => { if (b.dataset.tool !== 'hover') b.classList.toggle('on', b.dataset.tool === app.tool || (b.dataset.tool === 'globe' && !$('globeWrap').hidden) || (b.dataset.tool === 'info' && !$('infoPanel').hidden)); });
    $('map').classList.toggle('crosshair', !!app.tool && app.tool !== 'info');
    updateToolCard();
  }
  function clearTools() { tools.route = [null, null]; tools.routeRes = null; tools.pick = -1; tools.measure = []; app.tool = null; $('toolCard').hidden = true; document.querySelectorAll('.rail-btn').forEach(b => { if (b.dataset.tool !== 'hover') b.classList.remove('on'); }); }
  $('rail').addEventListener('click', e => {
    const b = e.target.closest('.rail-btn'); if (!b || !app.data && b.dataset.tool !== 'menu') return;
    const t = b.dataset.tool;
    if (t === 'menu') { $('menu').hidden = !$('menu').hidden; return; }
    if (t === 'style') { const p = $('stylePanel'); p.hidden = !p.hidden; renderStyles(); document.querySelector('[data-tool=style]').classList.toggle('on', !p.hidden); return; }
    if (t === 'hover') return setTool(null, 'hover');
    if (t === 'globe') { showGlobe($('globeWrap').hidden); return; }
    if (t === 'history') { G.Timeline && G.Timeline.toggle(); return; }
    if (t === 'info') { $('infoPanel').hidden = !$('infoPanel').hidden; b.classList.toggle('on', !$('infoPanel').hidden); return; }
    if (!$('globeWrap').hidden) showGlobe(false);
    setTool(t);
  });
  $('searchRoute').onclick = () => { if (app.data) { showGlobe(false); if (app.tool !== 'route') setTool('route'); } };
  // ---------- 球体：沿用用户生成器的天体与球面显示（独立页面，按需加载） ----------
  let globeSent = false, globeLoaded = false;
  function showGlobe(on) {
    const wrap = $('globeWrap');
    wrap.hidden = !on; document.querySelector('[data-tool=globe]').classList.toggle('on', on);
    if (!on) { map.resize(); return; }
    $('tip').hidden = true;
    let frame = $('globeFrame');
    if (!frame) { frame = document.createElement('iframe'); frame.id = 'globeFrame'; frame.src = 'globe/globe.html'; frame.title = '球体'; wrap.appendChild(frame); }
    else if (!globeSent && globeLoaded) frame.contentWindow.location.reload();
  }
  async function bitmapFrom(rgba, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer || rgba), w, h), 0, 0);
    return createImageBitmap(c, { imageOrientation: 'flipY', colorSpaceConversion: 'none' });
  }
  async function sendGlobe(win) {
    const d = app.data; if (!d) return;
    const w = 4096, h = 2048; // 地表贴图 4K
    const a = await call('globeAssets', { w, h });
    const [albedo, water, relief] = await Promise.all([bitmapFrom(a.albedo, w, h), bitmapFrom(a.water, w, h), bitmapFrom(a.relief, w, h)]);
    const themes = {}, list = [['terrainMap', 'terrain', '地形与水系'], ['country', 'country', '国家疆域'], ['koppen', 'koppen', '柯本气候分类'], ['biome', 'biome', '生物群系'], ['culture', 'culture', '文明影响范围']];
    const tw = 2048, th = 1024; // 专题贴图保持 2K
    for (const [key, topic, label] of list) {
      const img = await app.render({ w: tw, h: th, x0: 0, y0: 0, s: d.W / tw, topic, season: 0, aux: { elev: true, depth: true, lakes: true, snow: true, coast: true } });
      const c = document.createElement('canvas'); c.width = tw; c.height = th; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      if (topic === 'terrain' || topic === 'country') { const k = tw / d.W; x.setTransform(k, 0, 0, k, 0, 0); x.lineCap = 'round'; x.lineJoin = 'round';
        if (topic === 'country') { x.strokeStyle = 'rgba(60,45,38,.85)'; x.lineWidth = 1.6 / k; x.stroke(map.paths.borders.country); }
        x.strokeStyle = '#4b8fc6'; const rp = map.riverPaths(null); [0, 1].forEach(t => [1, 2, 3, 4].forEach(i => { x.lineWidth = (0.5 + i * 0.3) / k; x.stroke(rp.byTier[t].cls[i]); })); }
      themes[key] = { label, bitmap: await createImageBitmap(c, { imageOrientation: 'flipY' }) };
    }
    const lon = gx => gx / d.W * 360 - 180, lat = gy => 90 - gy / d.H * 180;
    const places = [];
    d.countries.forEach((k, ki) => { if (k.lx !== undefined && (k.lsize || 0) >= 3) places.push({ name: app.names['country:' + ki] || k.short || k.name, kind: 'state', lon: lon(k.lx), lat: lat(k.ly) }); });
    d.cities.forEach(c => { if (c.capital !== undefined || c.tier === 'metropolis') places.push({ name: c.name, kind: 'city', major: c.capital !== undefined, lon: lon(c.x), lat: lat(c.y) }); });
    const c = d.cfg;
    const msg = { type: 'globe-world', name: $('worldName').textContent, cfg: { seed: c.seed >>> 0, radius: c.radius, day: c.day, retro: c.retro, yearDays: c.yearDays, tilt: c.tilt, moons: c.moons, moonCount: c.moonCount }, albedo, water, relief, themes, places };
    win.postMessage(msg, '*', [albedo, water, relief, ...Object.values(themes).map(t => t.bitmap)]);
    globeSent = true;
  }
  window.addEventListener('message', e => {
    const f = $('globeFrame'); if (!f || e.source !== f.contentWindow) return;
    if (e.data.type === 'globe-loaded') { globeLoaded = true; sendGlobe(f.contentWindow).catch(err => { console.error(err); toast('球体数据准备失败：' + err.message); }); }
    if (e.data.type === 'globe-close') showGlobe(false);
  });

  const D2R = Math.PI / 180;
  function gc(a, b) { // 大圆距离 km
    const d = app.data, la1 = (90 - a[1] / d.H * 180) * D2R, la2 = (90 - b[1] / d.H * 180) * D2R, dl = (b[0] - a[0]) / d.W * 2 * Math.PI;
    const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dl / 2) ** 2;
    return 2 * d.cfg.radius * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function gcPath(a, b) { // 大圆插值（网格坐标）
    const d = app.data, toV = p => { const la = (90 - p[1] / d.H * 180) * D2R, lo = (p[0] / d.W * 360 - 180) * D2R; return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)]; };
    const A = toV(a), B = toV(b), om = Math.acos(Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2])));
    const n = Math.max(2, Math.ceil(om / D2R)), out = []; let px = a[0];
    for (let i = 0; i <= n; i++) {
      const t = i / n, s0 = om < 1e-6 ? 1 - t : Math.sin((1 - t) * om) / Math.sin(om), s1 = om < 1e-6 ? t : Math.sin(t * om) / Math.sin(om);
      const v = [A[0] * s0 + B[0] * s1, A[1] * s0 + B[1] * s1, A[2] * s0 + B[2] * s1];
      const la = Math.asin(v[2] / Math.hypot(...v)), lo = Math.atan2(v[1], v[0]);
      let x = (lo / D2R + 180) / 360 * d.W; const y = (90 - la / D2R) / 180 * d.H;
      while (x - px > d.W / 2) x -= d.W; while (px - x > d.W / 2) x += d.W; px = x;
      out.push([x, y]);
    }
    return out;
  }
  function nearestCity(sx, sy, r) {
    let best = null, bd = r || 16;
    for (const c of app.data.cities) for (const k of map.copies()) { const [x, y] = map.toScreen(c.x + k * app.data.W, c.y); const dd = Math.hypot(x - sx, y - sy); if (dd < bd) { bd = dd; best = c; } }
    return best;
  }
  app.onMapClick = async (gx, gy, sx, sy) => {
    const d = app.data; if (!d || gy < 0 || gy >= d.H) return;
    if (app.tool === 'route') {
      const c = nearestCity(sx, sy);
      const p = c ? { x: c.x, y: c.y, n: c.name, city: d.cities.indexOf(c) } : { x: ((gx % d.W) + d.W) % d.W, y: gy, n: '地图选点' };
      // 正在“选点”的格优先；否则依次填起点、终点；都已填则替换终点
      let slot = tools.pick >= 0 ? tools.pick : tools.route.findIndex(v => !v); if (slot < 0) slot = tools.route.length - 1;
      tools.route[slot] = p; tools.pick = -1; tools.routeRes = null; updateToolCard(); map.draw();
      if (tools.route.every(Boolean)) await runRoute();
    } else if (app.tool === 'measure') {
      tools.measure.push([gx, gy]); updateToolCard(); map.draw();
    } else if (app.tool === 'marker') {
      tools.markers.push({ x: ((gx % d.W) + d.W) % d.W, y: gy, n: '标记 ' + (tools.markers.length + 1) });
      saveMarkers(); updateToolCard(true); map.draw();
    } else if (G.Timeline && G.Timeline.on) {
      G.Timeline.click(sx, sy); // 时间线：点城市看它的兴衰
    } else if (G.City) {
      // 点城市：打开城市详情（街道、城墙、城门、港口）
      const id = map.cityAt(sx, sy);
      if (id) G.City.open(+id.split(':')[1]);
      else if (TOUCH && app.hover) { if (!$('tip').hidden) $('tip').hidden = true; else app.onHover({ offsetX: sx, offsetY: sy }); } // 触屏没有悬停：轻点查看该处信息，再点收起
    }
  };
  app.routeFromCity = (idx, slot) => { const c = app.data.cities[idx]; if (app.tool !== 'route') { document.querySelector('[data-tool=route]').click(); }
    const p = { x: c.x, y: c.y, n: c.name, city: idx }; if (slot === 0) tools.route[0] = p; else tools.route[tools.route.length - 1] = p; tools.routeRes = null; updateToolCard(); map.draw(); if (tools.route.every(Boolean)) runRoute(); };
  async function runRoute() {
    if (!tools.route.every(Boolean)) return;
    tools.busy = true; updateToolCard();
    const m = await call('route', { points: tools.route.map(p => ({ x: p.x, y: p.y, city: p.city })), mode: tools.mode || 'walk' });
    tools.busy = false; tools.routeRes = m.data || { fail: true }; updateToolCard(); map.draw();
  }
  const fmtDays = d => d < 1 ? Math.max(1, Math.round(d * (app.data ? app.data.cfg.day : 24))) + ' 小时' : d < 10 ? d.toFixed(1) + ' 天' : Math.round(d) + ' 天';
  function updateToolCard(focusName) {
    const card = $('toolCard');
    if (!app.tool) { card.hidden = true; return; }
    card.hidden = false;
    if (app.tool === 'route') {
      const r = tools.route, res = tools.routeRes, tp = app.data.travel, last = r.length - 1;
      const modes = tp.modes.map(m => `<button class="chip${(tools.mode || 'walk') === m.id ? ' on' : ''}" data-mode="${m.id}">${m.label}</button>`).join('');
      const slot = (p, i) => { const tag = i === 0 ? '起' : i === last ? '终' : '经', cls = i === 0 ? 'st' : i === last ? 'en' : 'vi';
        return `<div class="nav-slot"><i class="nav-dot ${cls}">${tag}</i><input list="navCities" data-slot="${i}" placeholder="${i === 0 ? '起点' : i === last ? '终点' : '途经点'}：输入地名或在地图上点选" value="${p ? p.n.replace(/"/g, '&quot;') : ''}">
          <button class="nav-pick${tools.pick === i ? ' on' : ''}" data-pick="${i}" title="在地图上选点">选点</button>${i > 0 && i < last ? `<button class="nav-x" data-unvia="${i}" title="移除途经点">✕</button>` : ''}</div>`; };
      let h = `<h4>路线导航 · ${tp.era === 'industrial' ? '工业时代' : '前工业时代'}</h4><div class="nav-slots">${r.map(slot).join('')}</div>
        <div class="row" style="margin:6px 0 8px;gap:6px"><button class="chip" data-tc="via">＋ 途经点</button><button class="chip" data-tc="swap">⇅ 交换起终点</button><button class="chip" data-tc="clear">清除</button></div>
        <div class="row" style="flex-wrap:wrap;margin:0 0 8px">${modes}</div>`;
      h += `<datalist id="navCities">${app.data.cities.filter(c => c.tier !== 'site').map(c => `<option value="${c.name}">`).join('')}</datalist>`;
      if (tools.pick >= 0) h += `<p class="nav-hint">在地图上点击一个城市或任意位置，作为${tools.pick === 0 ? '起点' : tools.pick === last ? '终点' : '途经点'}。</p>`;
      if (tools.busy) h += '<p class="nav-hint">正在沿道路网规划…</p>';
      else if (res && res.fail) h += `<p class="nav-hint">第 ${(res.leg || 0) + 1} 段没有该交通方式可通行的道路或航线。</p>`;
      else if (res) {
        const segs = []; let cur = null; const CLS = { trunk: '干道', regional: '区域道路', local: '地方道路', sea: res.shipName + '航线', rail: '铁路', path: '小路' };
        for (const p of res.passed) { const nm = app.data.cities[p.city].name; if (!cur || cur.cls !== p.cls) { cur = { cls: p.cls, towns: [] }; segs.push(cur); } if (cur.towns[cur.towns.length - 1] !== nm) cur.towns.push(nm); }
        h += `<div class="big">${fmtDays(res.days)}</div>${res.mode} · 全程 ${res.km.toLocaleString()} km${res.seaKm > 20 ? ` · 其中${res.shipName} ${res.seaKm.toLocaleString()} km` : ''}${res.railKm > 20 ? ` · 铁路 ${res.railKm.toLocaleString()} km` : ''}`;
        if (res.legs.length > 1) h += `<div class="nav-legs">${res.legs.map((L, k) => `<span>第 ${k + 1} 段 ${L.km.toLocaleString()} km · ${fmtDays(L.days)}</span>`).join('')}</div>`;
        h += `<ol class="nav-steps">${segs.slice(0, 14).map(sg => `<li><b>${CLS[sg.cls] || sg.cls}</b> 经 ${sg.towns.slice(0, 6).join('、')}${sg.towns.length > 6 ? ' 等' : ''}</li>`).join('')}</ol><p class="nav-note">${tp.note}</p>`;
      } else h += '<p class="nav-hint">填好起点和终点后自动规划；可添加多个途经点，按顺序经过。</p>';
      card.innerHTML = h;
    } else if (app.tool === 'measure') {
      const m = tools.measure; let km = 0; for (let i = 1; i < m.length; i++) km += gc(m[i - 1], m[i]);
      card.innerHTML = `<h4>测距</h4>${m.length < 2 ? '点击地图添加测量点（按大圆航线计算）。' : `<div class="big">${Math.round(km).toLocaleString()} km</div>${m.length} 个点 · 星球周长 ${Math.round(2 * Math.PI * app.data.cfg.radius).toLocaleString()} km`}<div class="row"><button class="chip" data-tc="undo">撤销</button><button class="chip" data-tc="clear">清除</button></div>`;
    } else if (app.tool === 'marker') {
      const ms = tools.markers;
      card.innerHTML = `<h4>标记</h4>${ms.length ? '' : '点击地图放置标记，可在此改名。'}<div class="list">${ms.map((m, i) => `<div style="display:flex;gap:6px;align-items:center"><input data-mk="${i}" value="${m.n.replace(/"/g, '&quot;')}" style="flex:1;height:30px;border:1px solid #e3e8ec;border-radius:8px;padding:0 8px;font:13px inherit"><button class="chip" data-go="${i}">定位</button><button class="chip" data-del="${i}">删除</button></div>`).join('')}</div>`;
      if (focusName) { const ins = card.querySelectorAll('input'); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); } }
    }
  }
  $('toolCard').addEventListener('click', e => {
    const md = e.target.closest('[data-mode]'); if (md) { tools.mode = md.dataset.mode; if (tools.route.every(Boolean)) runRoute(); else updateToolCard(); return; }
    const pk = e.target.closest('[data-pick]'); if (pk) { tools.pick = tools.pick === +pk.dataset.pick ? -1 : +pk.dataset.pick; updateToolCard(); return; }
    const uv = e.target.closest('[data-unvia]'); if (uv) { tools.route.splice(+uv.dataset.unvia, 1); tools.routeRes = null; updateToolCard(); map.draw(); if (tools.route.every(Boolean)) runRoute(); return; }
    const t = e.target.closest('[data-tc]');
    if (t) { if (t.dataset.tc === 'clear') { tools.route = [null, null]; tools.routeRes = null; tools.pick = -1; tools.measure = []; }
      if (t.dataset.tc === 'via') { tools.route.splice(tools.route.length - 1, 0, null); tools.pick = tools.route.length - 2; tools.routeRes = null; }
      if (t.dataset.tc === 'swap') { tools.route.reverse(); tools.routeRes = null; if (tools.route.every(Boolean)) { runRoute(); return; } } if (t.dataset.tc === 'undo') tools.measure.pop(); updateToolCard(); map.draw(); }
    const del = e.target.closest('[data-del]'); if (del) { tools.markers.splice(+del.dataset.del, 1); saveMarkers(); updateToolCard(); map.draw(); }
    const go = e.target.closest('[data-go]'); if (go) { const m = tools.markers[+go.dataset.go]; map.flyTo(m.x, m.y, 6); }
  });
  $('toolCard').addEventListener('change', e => { const i = e.target.dataset.slot; if (i === undefined) return; const v = e.target.value.trim(), d = app.data;
    const ci = d.cities.findIndex(c => c.name === v); if (ci < 0) { if (v) toast('没有找到「' + v + '」，请从下拉中选择或在地图上点选'); return; }
    const c = d.cities[ci]; tools.route[+i] = { x: c.x, y: c.y, n: c.name, city: ci }; tools.routeRes = null; updateToolCard(); map.draw(); if (tools.route.every(Boolean)) runRoute(); });
  $('toolCard').addEventListener('input', e => { const i = e.target.dataset.mk; if (i !== undefined) { tools.markers[+i].n = e.target.value; saveMarkers(); map.draw(); } });
  const mkKey = () => 'planet-markers-' + (app.state ? G.Config.encode(app.state) : '');
  function saveMarkers() { try { localStorage.setItem(mkKey(), JSON.stringify(tools.markers)); } catch (e) { /* 忽略 */ } }
  function loadMarkers() { try { tools.markers = JSON.parse(localStorage.getItem(mkKey()) || '[]'); } catch (e) { tools.markers = []; } }

  app.drawTools = (c, mv, ks) => {
    const d = app.data, W = d.W;
    const line = (pts, color, width, dash) => {
      for (const k of ks) {
        c.beginPath(); pts.forEach(([x, y], i) => { const [sx, sy] = mv.toScreen(x + k * W, y); i ? c.lineTo(sx, sy) : c.moveTo(sx, sy); });
        c.setLineDash(dash || []); c.lineWidth = width + 3; c.strokeStyle = 'rgba(255,255,255,.85)'; c.stroke(); c.lineWidth = width; c.strokeStyle = color; c.stroke(); c.setLineDash([]);
      }
    };
    const dot = (x, y, color, label) => {
      for (const k of ks) {
        const [sx, sy] = mv.toScreen(x + k * W, y);
        c.beginPath(); c.arc(sx, sy, 6, 0, 7); c.fillStyle = color; c.fill(); c.lineWidth = 2; c.strokeStyle = '#fff'; c.stroke();
        if (label) { c.font = '600 12px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = '#fff'; c.strokeText(label, sx + 10, sy); c.fillStyle = '#1f2933'; c.fillText(label, sx + 10, sy); }
      }
    };
    if (tools.routeRes && tools.routeRes.pts) {
      const a = tools.routeRes.pts, pts = []; let px = a[0];
      for (let i = 0; i < a.length; i += 2) { let x = a[i]; while (x - px > W / 2) x -= W; while (px - x > W / 2) x += W; px = x; pts.push([x, a[i + 1]]); }
      line(pts, '#1a73e8', 3.5);
    }
    tools.route.forEach((p, i) => { if (!p) return; const lastI = tools.route.length - 1; dot(p.x, p.y, i === 0 ? '#188038' : i === lastI ? '#d93025' : '#f29900', i === 0 ? '起点 ' + p.n : i === lastI ? '终点 ' + p.n : '途经 ' + p.n); });
    if (tools.measure.length) {
      const m = tools.measure; let all = [];
      for (let i = 1; i < m.length; i++) all = all.concat(gcPath(m[i - 1], m[i]));
      if (all.length) line(all, '#e8710a', 2.2, [7, 5]);
      let acc = 0; m.forEach((p, i) => { if (i) acc += gc(m[i - 1], p); dot(p[0], p[1], '#e8710a', i ? Math.round(acc).toLocaleString() + ' km' : ''); });
    }
    for (const mk of tools.markers) for (const k of ks) {
      const [sx, sy] = mv.toScreen(mk.x + k * W, mk.y);
      c.beginPath(); c.moveTo(sx, sy); c.bezierCurveTo(sx - 9, sy - 12, sx - 9, sy - 24, sx, sy - 24); c.bezierCurveTo(sx + 9, sy - 24, sx + 9, sy - 12, sx, sy);
      c.fillStyle = '#d93025'; c.fill(); c.beginPath(); c.arc(sx, sy - 17, 3.2, 0, 7); c.fillStyle = '#fff'; c.fill();
      c.font = '600 12px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.lineWidth = 3; c.strokeStyle = '#fff'; c.strokeText(mk.n, sx, sy - 27); c.fillStyle = '#1f2933'; c.fillText(mk.n, sx, sy - 27);
    }
    if (app.highlight) {
      const t = (performance.now() - app.highlight.t) / 1000;
      if (t < 2.6) for (const k of ks) { const [sx, sy] = mv.toScreen(app.highlight.x + k * W, app.highlight.y); c.beginPath(); c.arc(sx, sy, 8 + (t % 0.9) * 26, 0, 7); c.strokeStyle = `rgba(26,115,232,${1 - (t % 0.9) / 0.9})`; c.lineWidth = 2.5; c.stroke(); }
    }
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (app.tool) setTool(app.tool); } });

  // ---------- 悬浮信息 ----------
  let hoverBusy = false, hoverNext = null;
  app.onHover = (e) => {
    if (!e || !app.hover || !app.data || app.tool) { $('tip').hidden = true; return; }
    hoverNext = e; if (!hoverBusy) doHover();
  };
  async function doHover() {
    const e = hoverNext; hoverNext = null; if (!e) return;
    hoverBusy = true;
    const [gx, gy] = map.toGrid(e.offsetX, e.offsetY);
    const m = await call('probe', { gx, gy, season: app.season });
    hoverBusy = false;
    const p = m.data;
    if (!p || !app.hover) { $('tip').hidden = true; } else showTip(p, e);
    if (hoverNext) doHover();
  }
  const TOUCH = matchMedia('(hover: none)').matches || matchMedia('(pointer: coarse)').matches;
  function showTip(p, e) {
    const d = app.data, tip = $('tip');
    if (app.tab === 'human' && app.topic() === 'heritage' && d.heritage) { const hi = map.heritageAt(e.offsetX, e.offsetY); if (hi >= 0) { const o = d.heritage[hi], CATN = { religious: '宗教遗迹', war: '战争遗迹', culture: '人文遗迹' }, KN = { holy: '圣地', mountain: '圣山', tomb: '圣墓', siege: '围城', battle: '古战场', ruin: '遗址', fort: '旧关塞', revolt: '起事处', capital: '古都', mausoleum: '帝王陵', cradle: '文明摇篮' };
      const rows2 = [['类别', CATN[o.cat] + ' · ' + (KN[o.kind] || '')]]; if (o.year != null) rows2.push(['年代', '第 ' + Math.round(o.year) + ' 年']); if (o.rel >= 0 && d.religions[o.rel]) rows2.push(['宗教', d.religions[o.rel].name]); if (o.city >= 0 && d.cities[o.city]) rows2.push(['所在', d.cities[o.city].name]);
      const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      tip.innerHTML = `<h4>${esc(app.nameOf ? app.nameOf('heritage:' + hi, o.name) : o.name)}</h4><div class="sub">${esc(rows2[0][1])}</div><dl>${rows2.slice(1).map(([a, b]) => `<dt>${a}</dt><dd>${esc(b)}</dd>`).join('')}</dl><p style="margin:6px 0 0;max-width:280px;line-height:1.55;font-size:12px;color:#5a5048">${esc(o.text)}</p>`;
      placeTip(tip, e); return; } }
    const ll = `${Math.abs(p.lat).toFixed(1)}°${p.lat >= 0 ? 'N' : 'S'} · ${Math.abs(p.lon).toFixed(1)}°${p.lon >= 0 ? 'E' : 'W'}`;
    let title, rows = [];
    if (app.tab === 'plates') {
      title = d.plates[p.plate].name; rows = [['板块类型', d.plates[p.plate].continental ? '大陆板块' : '大洋板块'], ['运动速度', d.plates[p.plate].speed.toFixed(1) + ' cm/年'], [p.land ? '海拔' : '水深', Math.abs(p.elev) + ' m']];
    } else if (!p.land) {
      title = p.lake ? '湖泊' : '海洋'; rows = [['水深', Math.abs(p.elev) + ' m'], ['海表气温', p.ts.toFixed(1) + ' °C']];
      if (p.snow >= 3) rows.push(['海冰', p.snow === 4 ? '常年海冰' : '季节性海冰']);
      if (app.tab === 'season') rows.push(['气压', p.pres.toFixed(0) + ' hPa'], ['风', windStr(p.wind)]);
    } else {
      const k = p.country >= 0 ? d.countries[p.country] : null;
      title = k ? k.name : p.tribe >= 0 && d.tribes[p.tribe] ? d.tribes[p.tribe].name : (p.nominal >= 0 ? '部族与游牧地' : '无人荒野');
      if (p.lake) title = '湖泊';
      if (app.tab === 'season') rows = [['季节', SEASONS[app.season]], ['气温', p.ts.toFixed(1) + ' °C'], ['降水', Math.round(p.ps) + ' mm/季'], ['气压', p.pres.toFixed(0) + ' hPa'], ['风', windStr(p.wind)]];
      else rows = [['海拔', p.elev + ' m'], ['气候', p.koppen < 255 ? KOPPEN[p.koppen][0] + ' ' + KOPPEN[p.koppen][1] : '—'], ['群系', p.biome < 255 ? BIOMES[p.biome][0] : '—'], ['年均气温', p.tann.toFixed(1) + ' °C'], ['年降水', Math.round(p.pann) + ' mm']];
      if (app.tab === 'human' || app.aux.borders) {
        if (p.province >= 0) rows.push(['省份', d.provinces[p.province].name]);
        if (p.jimi >= 0 && d.jimis && d.jimis[p.jimi]) rows.push(['羁縻', app.nameOf ? app.nameOf('jimi:' + p.jimi, d.jimis[p.jimi].name) : d.jimis[p.jimi].name]);
        if (p.nominal >= 0 && p.country < 0) rows.push(['名义宣称', d.countries[p.nominal].name]);
        if (p.culture >= 0) rows.push(['文明', d.cultures[p.culture].name]);
        if (p.language >= 0) rows.push(['语言', d.languages[p.language].name]);
        if (p.religion >= 0) { const RG = d.religions[p.religion], TY = { monotheist: '一神天启', dualist: '光暗二元', polytheist: '多神信仰', dharmic: '轮回觉悟', ancestral: '祖灵礼教', shamanic: '萨满万灵', philosophy: '哲学教化' }; rows.push(['宗教', RG.name + (TY[RG.type] ? ' · ' + TY[RG.type] : '') + (RG.parent >= 0 && d.religions[RG.parent] ? '（' + d.religions[RG.parent].name + '的一派）' : '')]); }
        rows.push(['人口密度', p.pop < 1 ? '< 1 人/km²' : Math.round(p.pop) + ' 人/km²']);
        if (p.country >= 0) rows.push(['政体', k.formLabel + (k.liege !== undefined && d.countries[k.liege] ? ' · 宗主 ' + d.countries[k.liege].name : '')], ...(k.gov ? [['政府组织', k.gov]] : []), ...(k.ideas && k.ideas.length ? [['思潮', `已接纳 ${k.ideas.length} 条 · 最新：${k.ideas[k.ideas.length - 1]}${k.ideas.includes('远洋航海') ? ' · 可远洋殖民' : ''}`], ['军事 / 治理', `${'●'.repeat(Math.round(k.mil * 2))}${'○'.repeat(7 - Math.round(k.mil * 2))} / ${'●'.repeat(Math.round(k.adm * 2))}${'○'.repeat(6 - Math.round(k.adm * 2))}`]] : []), ...(k.ruler ? [['在位君主', k.ruler[2] + ' ' + k.ruler[1] + (k.house ? ' · ' + k.house : '') + ' · 第 ' + k.ruler[0] + ' 年即位']] : []), ['实际治理', Math.round(p.gov * 100) + '%' + (isFinite(p.govDays) ? ` · 距首都 ${p.govDays < 1 ? '<1' : Math.round(p.govDays)} 日` : '')]);
        else if (p.tribe >= 0 && d.tribes[p.tribe]) rows.push(['生计', { pastoral: '游牧', highland: '山地', forest: '林地狩猎', maritime: '海岸', foraging: '采集渔猎' }[d.tribes[p.tribe].livelihood]]);
      } else if (app.topic() === 'agri') rows.push(['农业潜力', Math.round(p.agri * 100) + '%']);
      else if (app.topic() === 'habit') rows.push(['宜居度', Math.round(p.hab * 100) + '%']);
      if (p.flow > d.qth * 0.5) rows.push(['河流流量', Math.round(p.flow).toLocaleString() + ' m³/s']);
      if (p.frost) rows.push(['冻土潜势', p.frost === 2 ? '连续' : '不连续']);
    }
    if (G.Timeline && G.Timeline.on && p.land && !p.lake) { const ht = G.Timeline.tip(map.toGrid(e.offsetX, e.offsetY)); if (ht) { title = ht.title; rows = ht.rows.concat(rows.filter(r => r[0] === '海拔' || r[0] === '气候')); } } // 时间线：显示当年的情况
    tip.innerHTML = `<h4>${title}</h4><div class="sub">${ll}</div><dl>${rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`;
    placeTip(tip, e);
  }
  function placeTip(tip, e) {
    tip.hidden = false;
    if (innerWidth <= 760) { tip.style.left = ''; tip.style.top = ''; return; } // 手机：固定为底部信息卡（见样式）
    const r = $('stage').getBoundingClientRect();
    let x = e.offsetX + r.left + 16, y = e.offsetY + r.top + 16;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    if (x + tw > innerWidth - 8) x = e.offsetX + r.left - tw - 16;
    if (y + th > innerHeight - 8) y = e.offsetY + r.top - th - 16;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function windStr([u, v]) {
    const sp = Math.hypot(u, v); if (sp < 0.5) return '静风';
    const from = (Math.atan2(-u, -v) / D2R + 360) % 360;
    return ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(from / 45) % 8] + '风 ' + sp.toFixed(1) + ' m/s';
  }

  // ---------- 世界保存（浏览器本地 + 文件导入导出） ----------
  // 推演是确定性的：保存 19 题答案、种子与精度即可在任何设备上完整还原同一颗星球。
  const SAVE_KEY = 'planet-forge-worlds-v1';
  const loadSaved = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); } catch (e) { return []; } };
  const storeSaved = list => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); return true; } catch (e) { toast('浏览器存储已满，请先导出或删除一些世界'); return false; } };
  function worldThumb() { const c = app.texCanvas; if (!c) return ''; const t = document.createElement('canvas'); t.width = 224; t.height = 112; t.getContext('2d').drawImage(c, 0, 0, 224, 112); return t.toDataURL('image/jpeg', 0.72); }
  function saveWorld(silent = true) {
    if (!app.data || !app.state) return;
    const key = G.Config.encode(app.state), list = loadSaved(), s = app.data.stats;
    const existing = list.find(w => w.key === key);
    const rec = { key, state: app.state, names: app.names, name: app.names.world || existing?.name || s.worldName + '星', created: existing?.created || Date.now(), updated: Date.now(), thumb: worldThumb() || existing?.thumb || '',
      summary: `${s.countries} 国 · ${s.provinces} 省 · ${s.settlements} 聚落 · ${fmtPop(s.population)}人 · ${app.data.W}×${app.data.H}`, ms: app.data.info.ms };
    const next = [rec, ...list.filter(w => w.key !== key)].slice(0, 40);
    if (storeSaved(next) && !silent) toast('已保存到“我的世界”');
    if (!$('savedPanel').hidden) renderSaved();
  }
  function renderSaved() {
    const list = loadSaved();
    $('savedBody').innerHTML = (list.length ? list.map((w, i) => `<div class="saved-item"><img src="${w.thumb || ''}" alt=""><div><b>${w.name}</b><small>${w.summary || ''}<br>种子 ${w.state.seed} · 保存于 ${new Date(w.updated).toLocaleString('zh-CN', { hour12: false })}</small>
      <div class="row"><button class="chip primary" data-open="${i}">打开</button><button class="chip" data-rename="${i}">改名</button><button class="chip" data-export="${i}">导出</button><button class="chip" data-delete="${i}">删除</button></div></div></div>`).join('')
      : '<p class="saved-empty">还没有保存的世界。每次推演完成都会自动保存在这个浏览器里；也可以从菜单导入之前导出的世界文件。</p>')
      + '<div class="row" style="display:flex;gap:8px;margin-top:6px"><button class="btn ghost" id="savedImport">导入世界文件…</button></div>';
  }
  function openSaved() { G.Home.show(); }
  function exportWorld(rec) {
    const markers = (() => { try { return JSON.parse(localStorage.getItem('planet-markers-' + rec.key) || '[]'); } catch (e) { return []; } })();
    const names = (() => { try { return JSON.parse(localStorage.getItem('planet-names-' + rec.key) || '{}'); } catch (e) { return {}; } })();
    const file = { schema: 'planet-forge-world-v1', name: rec.name, state: rec.state, markers, names, summary: rec.summary, created: rec.created, exported: Date.now(), engine: '星球推演 · 规则移植自世界生成器 1.4.0.dev164' };
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' })); a.download = `${rec.name}.planet.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  async function importWorld(fileObj) {
    try {
      const f = JSON.parse(await fileObj.text());
      if (f.schema !== 'planet-forge-world-v1' || !f.state || !f.state.a) throw new Error('不是星球推演导出的世界文件');
      const st = Object.assign(G.Config.defaults(), f.state), key = G.Config.encode(st);
      if (Array.isArray(f.markers)) localStorage.setItem('planet-markers-' + key, JSON.stringify(f.markers));
      if (f.names && typeof f.names === 'object') localStorage.setItem('planet-names-' + key, JSON.stringify(f.names));
      const list = loadSaved(); storeSaved([{ key, state: st, name: f.name || '导入的世界', created: f.created || Date.now(), updated: Date.now(), thumb: '', summary: f.summary || '' }, ...list.filter(w => w.key !== key)]);
      $('savedPanel').hidden = true; G.Wizard.close(); generate(st); toast(`正在还原「${f.name || '导入的世界'}」`);
    } catch (e) { toast('导入失败：' + e.message); }
  }
  $('savedBody').addEventListener('click', e => {
    const list = loadSaved(), b = e.target.closest('button'); if (!b) return;
    if (b.id === 'savedImport') { $('importFile').click(); return; }
    const i = +(b.dataset.open ?? b.dataset.rename ?? b.dataset.export ?? b.dataset.delete), w = list[i]; if (!w) return;
    if (b.dataset.open !== undefined) { $('savedPanel').hidden = true; G.Wizard.close(); generate(Object.assign(G.Config.defaults(), w.state)); }
    if (b.dataset.rename !== undefined) { const n = prompt('新的名称', w.name); if (n && n.trim()) { w.name = n.trim(); storeSaved(list); renderSaved(); if (app.state && G.Config.encode(app.state) === w.key) $('worldName').textContent = w.name; } }
    if (b.dataset.export !== undefined) exportWorld(w);
    if (b.dataset.delete !== undefined && confirm(`删除「${w.name}」？`)) { storeSaved(list.filter((_, k) => k !== i)); renderSaved(); }
  });
  $('importFile').addEventListener('change', e => { const f = e.target.files[0]; if (f) importWorld(f); e.target.value = ''; });
  $('wizSaved').addEventListener('click', openSaved);

  // ---------- 菜单 ----------
  $('menu').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return; $('menu').hidden = true;
    const act = b.dataset.act;
    if (act === 'home') G.Home.show();
    if (act === 'library') G.Home.showLibrary();
    if (act === 'religions') G.RelLib.show();
    if (act === 'export' && app.data) { saveWorld(); const rec = loadSaved().find(w => w.key === G.Config.encode(app.state)); if (rec) exportWorld(rec); }
    if (act === 'import') $('importFile').click();
    if (act === 'wizard') G.Wizard.open(app.state ? JSON.parse(JSON.stringify(app.state)) : G.Config.defaults(), st => { st.libs = G.Home.snapshot(); st.rlibs = G.RelLib ? G.RelLib.snapshot() : null; generate(st); }, true);
    if (act === 'reseed' && app.state) { const st = JSON.parse(JSON.stringify(app.state)); st.seed = (Math.random() * 1e9) | 0; generate(st); }
    if (act === 'png' && app.data) { $('map').toBlob(b2 => { const a = document.createElement('a'); a.href = URL.createObjectURL(b2); a.download = `${app.data.stats.worldName}星.png`; a.click(); }); }
    if (act === 'share') { navigator.clipboard && navigator.clipboard.writeText(location.href).then(() => toast('分享链接已复制：打开即按同样的 19 题与种子推演'), () => toast(location.href)); }
  });

  let toastT = 0;
  app.toast = s => toast(s);
  function toast(s) { const t = $('toast'); t.textContent = s; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 3200); }

  // ---------- 启动 ----------
  startWorker();
  map.resize();
  const fromHash = G.Config.decode(location.hash);
  if (G.City) G.City.init(app);
  if (G.Timeline) G.Timeline.init(app);
  G.Home.init({
    loadSaved, exportWorld,
    openWorld: w => { const st = Object.assign(G.Config.defaults(), w.state); generate(st); },
    recreate: w => { const st = Object.assign(G.Config.defaults(), JSON.parse(JSON.stringify(w.state))); st.seed = (Math.random() * 1e9) | 0; generate(st); },
    deleteWorld: w => { storeSaved(loadSaved().filter(x => x.key !== w.key)); ['planet-names-', 'planet-markers-'].forEach(p => localStorage.removeItem(p + w.key)); },
    renameWorld: (w, n) => { const list = loadSaved(); const r = list.find(x => x.key === w.key); if (r) { r.name = n; storeSaved(list); } let nm = {}; try { nm = JSON.parse(localStorage.getItem('planet-names-' + w.key) || '{}'); } catch (e) { /* */ } nm.world = n; localStorage.setItem('planet-names-' + w.key, JSON.stringify(nm)); if (app.state && G.Config.encode(app.state) === w.key) { app.names.world = n; $('worldName').textContent = n; } },
    createWorld: () => G.Wizard.open(app.state ? JSON.parse(JSON.stringify(app.state)) : G.Config.defaults(), st => { st.libs = G.Home.snapshot(); st.rlibs = G.RelLib ? G.RelLib.snapshot() : null; generate(st); }, true)
  });
  if (fromHash) generate(fromHash);
  else G.Home.show();
})(window);
