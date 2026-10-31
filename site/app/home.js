/* 首页（生成任务 + 已保存的世界）与文化库页面 —— 对应原版 studio-home / studio-cultures */
(function (G) {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CATS = [['agrarian', '农耕', '以定居农耕为主要参考。'], ['pastoral', '游牧', '以牧业与流动聚落为主要参考。'], ['maritime', '海洋', '以海运、港口和岛屿为主要参考。'], ['highland', '山地', '以山地聚落和区域联系为主要参考。'], ['tribal', '部族联盟', '以部族和联盟组织为主要参考。'], ['new-world', '新大陆原住民', '仅用于自然划定的新大陆原住民。']];
  const CAT_LABEL = Object.fromEntries(CATS.map(c => [c[0], c[1]]));
  const MODE_LABEL = { realistic: '写实', historical: '历史', fantasy: '幻想' };
  const KEYS = [['states', '国家'], ['provinces', '省区'], ['cities', '城市'], ['mountains', '山脉'], ['rivers', '河流'], ['lakes', '湖泊'], ['seas', '海域'], ['regions', '地区'], ['streets', '街道（城市详情）']];
  const TITLE_KEYS = [['monarchy', '君主国'], ['duchy', '公国'], ['empire', '帝国'], ['republic', '共和国'], ['city', '早期城邦'], ['cityRepublic', '海洋城邦 / 一城之国'], ['nomadic', '游牧政权'], ['nomadEmpire', '游牧帝国'], ['chiefdom', '酋邦'], ['league', '联盟'], ['jimi', '羁縻称谓'], ['nomad', '游牧部族称谓'], ['tribe', '部落称谓']];
  // 文化库扩展设定（lib.x）：路径、标签、类型（list 列表 / text 文本 / sel 选择）
  const TITLE_PH = { monarchy: '第一项是王国级后缀；其余项只在现今地图上给大国换着用', duchy: '王国之下一级（小国用），可填多个：公国、伯国、雅尔国……；留空则从君主国后缀里找“公国 / 侯国”，没有就不设，大小国都用君主国后缀', city: '城邦时代的后缀（农耕、山地文明）；留空为“城邦”', cityRepublic: '海洋文明的城邦，以及现今地图上只有一座城的国家', empire: '称帝以后的国号后缀（帝号是文化圈里最高的法理名分）', nomadEmpire: '游牧政权称帝后的后缀；留空则用帝国后缀' };
  const RULER_KEYS = [['chief', '酋邦首领'], ['city', '城邦之主'], ['king', '国王'], ['empire', '皇帝'], ['nomad', '游牧君主'], ['nomadEmpire', '游牧帝国君主'], ['republic', '共和执政'], ['vassal', '附庸之主'], ['colony', '殖民地长官'], ['rebel', '起义首领']];
  const ORG_LABEL = [['chief', '酋邦'], ['city', '城邦'], ['king', '王国'], ['empire', '帝国'], ['feudal', '封建时代'], ['central', '集权时代'], ['nomad', '游牧政权'], ['republic', '共和'], ['theo', '神权'], ['vassal', '附庸'], ['colony', '殖民地'], ['rebel', '起义军']];
  const XFIELDS = () => { const CE = window.CultureExt; const fam = CE ? Object.entries(CE.FAMILIES).map(([k, f]) => [k, f.label]) : [];
    return [['族系与人名', [['family', '族系（提供以下各项的默认值）', 'sel', fam], ['people.surnames', '姓氏 / 家族名', 'list'], ['people.given', '人名', 'list'], ['regnal', '君主名号', 'sel', [['number', '名字加序数（亨利三世）'], ['temple', '庙号（太祖、太宗……）'], ['plain', '直呼其名']]], ['house', '王朝名格式（{s} 为姓氏）', 'text'], ['succession', '改朝换代', 'sel', [['state', '新朝换国号（汉 → 唐）'], ['house', '国号不变，只换王朝（安茹 → 金雀花 → 都铎；拜占庭）']]]]],
      ['君主称谓', RULER_KEYS.map(([k, l]) => ['ruler.' + k, l, 'text'])],
      ['政府组织', [['gov.style', '风格（影响历史推演）', 'sel', [['bureaucratic', '官僚制：较能维系大国，少封附庸'], ['feudal', '封建制：多附庸，分裂后诸侯仍奉旧主'], ['tribal', '部族制：凝聚力易散'], ['mercantile', '商贸型：善于跨海'], ['temple', '神庙型：易成神权国']]], ['gov.minister', '首席大臣称谓', 'text']].concat(ORG_LABEL.map(([k, l]) => ['gov.org.' + k, '官制 · ' + l, 'text']))],
      ['起义名号', [['rebel.style', '命名方式', 'sel', [['symbol', '象征名号（赤眉、黄巾……）'], ['place', '以起事地命名']]], ['rebel.fmt', '格式（{sym} 象征，{place} 地名）', 'text'], ['rebel.symbols', '象征名号', 'list']]],
      ['地名后缀', [['places.port', '港口', 'list'], ['places.fort', '要塞', 'list'], ['places.pass', '关隘', 'list']]],
      ['附加称号', [['titles.vassal', '附庸国称号', 'text'], ['titles.colony', '殖民地称号', 'text'], ['titles.theocracy', '神权国称号（留空则用宗教库的）', 'text']]]]; };
  const getP = (o, path) => path.split('.').reduce((a, k) => a == null ? a : a[k], o);
  const setP = (o, path, v) => { const ks = path.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) a = a[ks[i]] = a[ks[i]] || {}; a[ks[ks.length - 1]] = v; };
  const xOf = l => window.CultureExt ? window.CultureExt.ext(JSON.parse(JSON.stringify(l))) : null;
  const SEL_KEY = 'planet-culture-selection-v1', CUSTOM_KEY = 'planet-culture-custom-v1', OVR_KEY = 'planet-culture-override-v1';

  // ---------- 更新说明（最新在前） ----------
  // 第一条是当前版本，展开显示；其余折叠
  const NOTES = [
    ['1.4.1', '更新说明', [
      '<b>新功能</b>：为 21 项生成选项增加对应的影响提示，并可查看总影响；历史时间线新增制度图层，并可查看国家人口及人口组成。',
      '<b>优化与修复</b>：适配手机界面；修正游牧过多的问题；优化历史推演与思潮产生；修复等高线溢出和飞地问题；调整事件发生年份；附庸国使用同色系；统一历史图与专题图的图标；优化界面及各专题图显示。'
    ]],
    ['1.4.0', '思潮、宗教库与遗迹', [
      '<b>思潮接纳</b>：发展阶段改由 13 条思潮推动。思潮在世界某处兴起、向四周传播，同一文明之内传得快，各类文明接纳快慢不同；接纳了一个阶段的全部思潮才进入下一阶段。历史时间线的“思潮”图层可单看一条思潮的传播。',
      '<b>远洋航海</b>：只有接纳了这条思潮的沿海国家才能殖民新大陆。',
      '<b>思潮与国力</b>：冶铁、火药等军事思潮带来战场优势，官僚、律法等治理思潮让国家更富、更稳、管得更远；落后于时代的国家人心浮动。人口与疆土仍是根本。',
      '<b>宗教库</b>：新增 15 个宗教库（写实化名与架空），设定类型、传播方式、教名、派别、异端、圣地、圣职、象征色与圣徽；宗教会传教、分裂出教派、建立神权国。可在首页或向导里勾选与编辑。',
      '<b>文化库扩展</b>：人名与王朝、君主称谓、政府组织、起义名号、地名后缀、附庸与殖民地称号；政府风格（官僚、封建、部族、商贸、神庙）影响历史推演。每个国家有君主世系与官制变迁。',
      '<b>遗迹地图</b>：人文专题新增遗迹地图，收录圣地、圣山、圣墓、围城、古战场、旧关塞、古城废墟、古都、帝王陵等，均来自推演出的历史；圣城在城市旁以紫色星标出。'
    ]]
  ];

  // ---------- 文化库数据 ----------
  let builtin = null;
  function loadBuiltin() {
    if (builtin) return Promise.resolve(builtin);
    const sc = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    return (window.CULTURE_LIBRARIES ? Promise.resolve() : sc('core/libraries.js')).then(() => window.CultureExt ? null : sc('core/culture-ext.js')).then(() => builtin = window.CULTURE_LIBRARIES);
  }
  const getCustom = () => { try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch (e) { return []; } };
  const setCustom = v => localStorage.setItem(CUSTOM_KEY, JSON.stringify(v));
  const getOvr = () => { try { return JSON.parse(localStorage.getItem(OVR_KEY) || '{}'); } catch (e) { return {}; } };
  const setOvr = v => localStorage.setItem(OVR_KEY, JSON.stringify(v));
  const getSel = () => { try { const v = JSON.parse(localStorage.getItem(SEL_KEY) || 'null'); return Array.isArray(v) ? v : null; } catch (e) { return null; } };
  const setSel = v => localStorage.setItem(SEL_KEY, JSON.stringify(v));
  // 冻结快照：所选内置库 id + 所选自定义库完整内容（随世界保存，与原版“文化快照”一致）
  function snapshot() {
    const sel = getSel(), custom = getCustom();
    // 改过的内置库按“自定义内容 + 原 id”冻结进快照，推演时替换内置版本
    const ovr = getOvr(), allIds = sel || (builtin ? builtin.map(l => l.id) : null);
    const edited = Object.values(ovr).filter(l => !allIds || allIds.includes(l.id));
    if (!sel) return { ids: edited.length && builtin ? builtin.map(l => l.id).filter(id => !ovr[id]) : null, custom: edited };
    return { ids: sel.filter(id => !id.startsWith('custom-') && !ovr[id]), custom: custom.filter(l => sel.includes(l.id)).concat(edited) };
  }
  function selectedCount() { const sel = getSel(); return sel ? sel.length : (builtin ? builtin.length : 32); }

  // ---------- 首页 ----------
  let hooks = null, job = null;
  function init(h) { hooks = h; bind(); }
  function show() { $('home').hidden = false; renderHome(); }
  function hide() { $('home').hidden = true; }
  function setJob(j) { job = j; if (!$('home').hidden) renderJob(); }
  function renderJob() {
    const box = $('homeJobs'); $('homeJobSec').hidden = !job || !!job.done;
    if (!job || job.done) { box.innerHTML = '<p class="home-empty">当前没有正在推演的世界。点击右上角“创建世界”，回答 21 个问题开始推演。</p>'; $('homeJobCount').textContent = '0 项任务'; return; }
    $('homeJobCount').textContent = '1 项任务';
    box.innerHTML = `<div class="wcard"><div class="wthumb">${job.thumb ? `<img src="${job.thumb}" alt="">` : '<div class="wthumb-ph"><i></i></div>'}</div><div class="wcap">地形与水系</div>
      <div class="wbody"><span class="badge run">${job.done ? '已完成' : '正在推演'}</span><h4>${esc(job.name || '新世界')} <code>${job.seed}</code></h4>
      <p class="wmeta">${esc(job.stage || '')} · ${Math.round((job.f || 0) * 100)}%</p><div class="bar"><i style="width:${Math.round((job.f || 0) * 100)}%"></i></div>
      ${job.done ? '<button class="wlink" data-home="current">打开世界地图 ↗</button>' : ''}</div></div>`;
  }
  function renderHome() {
    renderJob();
    const list = hooks.loadSaved();
    $('homeCount').textContent = `${list.length} 个世界`;
    $('homeLibCount').textContent = `已选 ${selectedCount()} 个文化库`;
    if ($('homeRelCount') && G.RelLib) { $('homeRelCount').textContent = `已选 ${G.RelLib.selectedCount()} 个宗教库`; G.RelLib.load().then(() => { $('homeRelCount').textContent = `已选 ${G.RelLib.selectedCount()} 个宗教库`; }); }
    $('homeSaved').innerHTML = list.length ? list.map((w, i) => `<div class="wcard"><div class="wthumb">${w.thumb ? `<img src="${w.thumb}" alt="">` : '<div class="wthumb-ph"></div>'}</div><div class="wcap">地形与水系</div>
      <div class="wbody"><span class="badge">已保存</span><h4><span data-wname="${i}" title="双击改名">${esc(w.name)}</span> <code>${w.state.seed}</code></h4>
      <p class="wmeta">${w.ms ? '用时 ' + (w.ms / 1000).toFixed(1) + ' 秒 · ' : ''}${new Date(w.updated).toLocaleString('zh-CN', { hour12: false })}${w.summary ? '<br>' + esc(w.summary) : ''}</p>
      <p class="wfile" data-fileinfo="${esc(w.key)}" hidden>世界文件：<b></b></p>
      <button class="wlink" data-open="${i}">打开世界地图 ↗</button></div>
      <div class="wfoot"><button data-settings="${i}">查看生成设置</button><button data-export="${i}" title="保存设置、种子、改名与标记；首次保存可自选位置，之后直接更新同一个文件">保存到文件</button><button class="danger" data-delete="${i}">删除世界</button></div></div>`).join('')
      : '<p class="home-empty">还没有保存的世界。推演完成后会自动保存在这里；也可以导入之前导出的世界文件。</p>';
    if (hooks.fileInfo) $('homeSaved').querySelectorAll('[data-fileinfo]').forEach(async el => { const n = await hooks.fileInfo(el.dataset.fileinfo); el.hidden = !n; if (n) el.querySelector('b').textContent = n; });
  }
  function settingsHtml(st) {
    const Q = G.Config.Q, cu = st.custom || {};
    const rows = Q.map((q, i) => { const o = q.o.find(x => x[0] === st.a[q.id]) || q.o[0]; const c = cu[q.id] && cu[q.id].on ? ' · 自定义：' + Object.entries(cu[q.id].v || {}).map(([k, v]) => { const f = (G.Config.CUSTOM[q.id] || []).find(x => x.key === k); return (f ? f.label : k) + ' ' + v; }).join('，') : '';
      return `<tr><td>${i + 1}</td><td>${q.t}</td><td><b>${'ABCDE'[q.o.indexOf(o)]}</b> ${o[1]}${o[2] ? ' · ' + o[2] : ''}${c}</td></tr>`; }).join('');
    const libs = st.libs ? (st.libs.ids === null ? '全部内置文化库' : `${(st.libs.ids || []).length} 个内置库 + ${(st.libs.custom || []).length} 个自定义库`) : '全部内置文化库';
    return `<table class="settings">${rows}<tr><td>⚙</td><td>种子 / 网格</td><td>${st.seed} · ${(g => g.W + '×' + g.H)(G.Config.gridOf(st))}（由星球大小决定）</td></tr><tr><td>📚</td><td>文化库</td><td>${libs}</td></tr><tr><td>✦</td><td>宗教库</td><td>${st.rlibs ? (st.rlibs.ids === null ? '全部内置宗教库' : `${(st.rlibs.ids || []).length} 个内置库 + ${(st.rlibs.custom || []).length} 个自定义库`) : '全部内置宗教库'}</td></tr></table>`;
  }
  function modal(title, body, foot = '') { $('libModalBody').innerHTML = `<header class="lm-head"><h3>${title}</h3><button class="x" data-lm-close><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header><div class="lm-body">${body}</div>${foot ? `<footer class="lm-foot">${foot}</footer>` : ''}`; $('libModal').hidden = false; }
  function closeModal() { $('libModal').hidden = true; }

  // ---------- 文化库页面 ----------
  let libCat = 'all';
  async function showLibrary() {
    $('libPage').hidden = false;
    $('libGrid').innerHTML = '<p class="home-empty">正在载入文化库…</p>';
    await loadBuiltin(); renderLibrary();
  }
  function allLibs() { const ovr = getOvr(); return builtin.map(l => ovr[l.id] ? { ...ovr[l.id], builtin: true, edited: true } : { ...l, builtin: true }).concat(getCustom().map(l => ({ ...l, builtin: false }))); }
  function renderLibrary() {
    const libs = allLibs(), sel = getSel() || libs.map(l => l.id);
    $('libTabs').innerHTML = [['all', '全部']].concat(CATS.map(c => [c[0], c[1]])).map(([k, n]) => `<button class="${libCat === k ? 'on' : ''}" data-cat="${k}">${n} <small>${k === 'all' ? libs.length : libs.filter(l => l.cat === k).length}</small></button>`).join('');
    $('libSummary').textContent = `已选 ${sel.length} / ${libs.length} 个文化库 · 生成时按文明的生计大类（农耕、游牧、海洋、山地、部族、新大陆）匹配所选库，至少选择一个库。`;
    const shown = libs.filter(l => libCat === 'all' || l.cat === libCat);
    $('libGrid').innerHTML = shown.map(l => { const on = sel.includes(l.id), n = l.n || {}; const total = KEYS.reduce((s, [k]) => s + (n[k] || []).length, 0);
      return `<div class="lcard${on ? ' on' : ''}"><label class="lcheck"><input type="checkbox" data-sel="${esc(l.id)}" ${on ? 'checked' : ''}><span></span></label>
        <div class="lmain"><b>${esc(l.label)}</b><small>${CAT_LABEL[l.cat] || l.cat} · ${l.builtin ? (MODE_LABEL[l.mode] || '内置') + (l.edited ? ' · 已修改' : '') : '自定义'} · ${total} 个名称</small>
        <p>${esc(((n.states || []).slice(0, 4).concat((n.cities || []).slice(0, 4))).join('、'))}…</p>
        <div class="lact"><button data-view="${esc(l.id)}">查看</button><button data-edit="${esc(l.id)}">编辑</button><button data-copy="${esc(l.id)}">复制为自定义</button>${l.builtin ? (l.edited ? `<button data-reset="${esc(l.id)}">恢复默认</button>` : '') : `<button class="danger" data-del="${esc(l.id)}">删除</button>`}</div></div></div>`; }).join('');
  }
  function viewLib(l) {
    const n = l.n || {}, t = l.t || {};
    modal(esc(l.label), `<p class="lm-note">${CAT_LABEL[l.cat] || ''} · ${l.builtin ? MODE_LABEL[l.mode] || '' : '自定义'}库。名称用尽后按词根组合生成新名称。</p>`
      + KEYS.map(([k, lab]) => `<h5>${lab} <small>${(n[k] || []).length}</small></h5><p class="names">${esc((n[k] || []).join('、')) || '—'}</p>`).join('')
      + `<h5>国家后缀</h5><p class="names">${TITLE_KEYS.map(([k, lab]) => `${lab}：${esc((t[k] || []).join('、'))}`).join('<br>')}</p>`
      + (() => { const x = xOf(l); if (!x) return ''; return XFIELDS().map(([g, fs]) => `<h5>${g}</h5><p class="names">${fs.map(([path, lab, ty, opts]) => { let v = getP(x, path); if (ty === 'sel') { const o = (opts || []).find(o => o[0] === v); v = o ? o[1] : v; } return `${lab}：${esc(Array.isArray(v) ? v.join('、') : v || '—')}`; }).join('<br>')}</p>`).join(''); })()
      + (l.c ? `<h5>组合词根</h5><p class="names">前缀：${esc((l.c.prefixes || []).join(' '))}<br>词根：${esc((l.c.roots || []).join(' '))}<br>后缀：${esc((l.c.suffixes || []).join(' '))}</p>` : ''));
  }
  function editLib(l, isNew) {
    const n = l.n || {}, t = l.t || {}, c = l.c || { roots: [], prefixes: [], suffixes: [] };
    modal(isNew ? '新建自定义文化库' : (l.builtin ? '编辑内置库：' : '编辑：') + esc(l.label), `<div class="lform">
      <label>名称<input id="le-label" value="${esc(l.label || '我的文化库')}"></label>
      <label>生计大类<select id="le-cat">${CATS.map(cc => `<option value="${cc[0]}" ${l.cat === cc[0] ? 'selected' : ''}>${cc[1]}</option>`).join('')}</select></label>
      ${KEYS.map(([k, lab]) => `<label>${lab}（用顿号、逗号或换行分隔）<textarea data-k="${k}" rows="2">${esc((n[k] || []).join('、'))}</textarea></label>`).join('')}
      ${TITLE_KEYS.map(([k, lab]) => `<label>${lab}后缀<input data-t="${k}" value="${esc((t[k] || []).join('、'))}"${TITLE_PH[k] ? ` placeholder="${esc(TITLE_PH[k])}"` : ''}></label>`).join('')}
      ${(() => { const x = xOf(l); if (!x) return ''; return `<details class="lx"><summary>更多设定：人名与世系、君主称谓、政府组织、起义名号、地名后缀、附加称号</summary><div class="lx-body">` + XFIELDS().map(([g, fs]) => `<h5>${g}</h5>` + fs.map(([path, lab, ty, opts]) => { const v = getP(x, path); return ty === 'sel' ? `<label>${lab}<select data-x="${path}">${opts.map(o => `<option value="${o[0]}" ${o[0] === v ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label>` : ty === 'list' ? `<label>${lab}<textarea data-x="${path}" data-xl="1" rows="2">${esc((v || []).join('、'))}</textarea></label>` : `<label>${lab}<input data-x="${path}" value="${esc(v || '')}"></label>`; }).join('')).join('') + '</div></details>'; })()}
      <label>组合前缀<input data-c="prefixes" value="${esc(c.prefixes.join('、'))}"></label><label>组合词根<input data-c="roots" value="${esc(c.roots.join('、'))}"></label><label>组合后缀<input data-c="suffixes" value="${esc(c.suffixes.join('、'))}"></label></div>`,
      `<button class="btn ghost" data-lm-close>取消</button><button class="btn primary" id="le-save">保存</button>`);
    $('le-save').onclick = () => {
      const split = v => v.split(/[、,，\n\s]+/).map(x => x.trim()).filter(Boolean);
      const lib = { id: l.id && !isNew ? l.id : 'custom-' + Date.now().toString(36), label: $('le-label').value.trim() || '我的文化库', cat: $('le-cat').value, mode: l.builtin && !isNew ? l.mode : 'custom', style: l.style, religion: l.religion, n: {}, t: {}, c: {} };
      document.querySelectorAll('#libModalBody [data-k]').forEach(el => lib.n[el.dataset.k] = split(el.value));
      document.querySelectorAll('#libModalBody [data-t]').forEach(el => lib.t[el.dataset.t] = split(el.value));
      document.querySelectorAll('#libModalBody [data-c]').forEach(el => lib.c[el.dataset.c] = split(el.value));
      { const xs = document.querySelectorAll('#libModalBody [data-x]'); if (xs.length) { lib.x = {}; xs.forEach(el => setP(lib.x, el.dataset.x, el.dataset.xl ? split(el.value) : el.value.trim())); } } // 扩展设定
      if (!KEYS.some(([k]) => lib.n[k].length) && !lib.c.roots.length) { alert('至少填写一类名称或组合词根'); return; }
      if (l.builtin && !isNew) { const o = getOvr(); o[lib.id] = lib; setOvr(o); closeModal(); renderLibrary(); return; }
      const custom = getCustom().filter(x => x.id !== lib.id); custom.push(lib); setCustom(custom);
      const sel = getSel() || allLibs().map(x => x.id); if (!sel.includes(lib.id)) sel.push(lib.id); setSel(sel);
      closeModal(); renderLibrary();
    };
  }

  // ---------- 事件 ----------
  function bind() {
    $('homeCreate').onclick = () => hooks.createWorld();
    $('homeLib').onclick = () => showLibrary();
    if ($('homeRel')) $('homeRel').onclick = () => G.RelLib && G.RelLib.show();
    if ($('homeNotes')) $('homeNotes').onclick = e => { e.preventDefault(); const note = ([v, title, items]) => `<h5>${v} · ${title}</h5><ul class="notes">${items.map(x => `<li>${x}</li>`).join('')}</ul>`;
      modal('更新说明', note(NOTES[0]) + (NOTES.length > 1 ? `<details class="notes-old"><summary>1.4.0 更新说明</summary>${NOTES.slice(1).map(note).join('')}</details>` : ''), `<button class="btn primary" data-lm-close>知道了</button>`); };
    $('homeImport').onclick = () => hooks.pickImport ? hooks.pickImport() : $('importFile').click();
    $('homeSaved').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; const list = hooks.loadSaved();
      const i = +(b.dataset.open ?? b.dataset.settings ?? b.dataset.export ?? b.dataset.delete), w = list[i]; if (!w) return;
      if (b.dataset.open !== undefined) { hide(); hooks.openWorld(w); }
      if (b.dataset.settings !== undefined) modal('生成设置 · ' + esc(w.name), settingsHtml(w.state), `<button class="btn ghost" data-lm-close>关闭</button><button class="btn primary" data-recreate="${i}">用此设置换种子再推演</button>`);
      if (b.dataset.export !== undefined) hooks.exportWorld(w);
      if (b.dataset.delete !== undefined && confirm(`删除「${w.name}」？该世界的标记与改名也会一起删除。`)) { hooks.deleteWorld(w); renderHome(); }
    });
    $('homeSaved').addEventListener('dblclick', e => { const el = e.target.closest('[data-wname]'); if (!el) return; const list = hooks.loadSaved(), w = list[+el.dataset.wname]; const n = prompt('世界名称', w.name); if (n && n.trim()) { hooks.renameWorld(w, n.trim()); renderHome(); } });
    $('homeJobs').addEventListener('click', e => { if (e.target.closest('[data-home=current]')) hide(); });
    $('libBack').onclick = () => { $('libPage').hidden = true; if (!$('home').hidden) renderHome(); };
    $('libTabs').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { libCat = b.dataset.cat; renderLibrary(); } });
    $('libGrid').addEventListener('change', e => { const c = e.target.closest('[data-sel]'); if (!c) return; const libs = allLibs(); let sel = getSel() || libs.map(l => l.id); if (c.checked) { if (!sel.includes(c.dataset.sel)) sel.push(c.dataset.sel); } else { if (sel.length <= 1) { c.checked = true; alert('至少选择一个文化库才能生成世界'); return; } sel = sel.filter(x => x !== c.dataset.sel); } setSel(sel); renderLibrary(); });
    $('libGrid').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return; const libs = allLibs(); const find = id => libs.find(l => l.id === id);
      if (b.dataset.view) viewLib(find(b.dataset.view));
      if (b.dataset.copy) { const src = find(b.dataset.copy); editLib({ ...JSON.parse(JSON.stringify(src)), id: null, label: src.label.replace(/（.*?）$/, '') + '（副本）' }, true); }
      if (b.dataset.edit) editLib(find(b.dataset.edit), false);
      if (b.dataset.reset && confirm('恢复这个内置文化库的默认名单？你的修改会被删除；已推演的世界不受影响。')) { const o = getOvr(); delete o[b.dataset.reset]; setOvr(o); renderLibrary(); }
      if (b.dataset.del && confirm('删除这个自定义文化库？已推演的世界不受影响（保存时已冻结文化快照）。')) { setCustom(getCustom().filter(l => l.id !== b.dataset.del)); const sel = (getSel() || []).filter(x => x !== b.dataset.del); setSel(sel.length ? sel : libs.filter(l => l.builtin).map(l => l.id)); renderLibrary(); }
    });
    $('libAll').onclick = () => { setSel(allLibs().map(l => l.id)); renderLibrary(); };
    $('libNew').onclick = () => editLib({ cat: 'agrarian', n: {}, t: { monarchy: ['王国'], empire: ['帝国'], republic: ['共和国'], cityRepublic: ['城邦共和国'], nomadic: ['部族邦联'], chiefdom: ['酋邦'], league: ['联盟'], jimi: ['羁縻州', '土司'], nomad: ['部', '部落'], tribe: ['部落', '氏族'] }, c: { roots: [], prefixes: [], suffixes: [] } }, true);
    $('libExport').onclick = () => { const sel = getSel() || allLibs().map(l => l.id); const data = { schema: 'planet-culture-libraries-v1', libraries: allLibs().filter(l => sel.includes(l.id)).map(({ builtin: b, ...l }) => l) }; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' })); a.download = '文化库.json'; a.click(); };
    $('libImport').onclick = () => $('libFile').click();
    $('libFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const d = JSON.parse(await f.text()); const arr = (d.libraries || d).filter(l => l && l.n); if (!arr.length) throw new Error('文件里没有文化库'); const custom = getCustom(); const sel = getSel() || allLibs().map(l => l.id); arr.forEach(l => { const lib = { ...l, id: 'custom-' + Math.random().toString(36).slice(2, 9), cat: CAT_LABEL[l.cat] ? l.cat : 'agrarian', mode: 'custom' }; custom.push(lib); sel.push(lib.id); }); setCustom(custom); setSel(sel); renderLibrary(); } catch (err) { alert('导入失败：' + err.message); } };
    $('libModal').addEventListener('click', e => { if (e.target.closest('[data-lm-close]') || e.target === $('libModal')) closeModal(); const r = e.target.closest('[data-recreate]'); if (r) { const w = hooks.loadSaved()[+r.dataset.recreate]; closeModal(); hide(); hooks.recreate(w); } });
  }

  G.Home = { init, show, hide, setJob, renderHome, showLibrary, snapshot, selectedCount, loadBuiltin, settingsHtml };
})(window);
