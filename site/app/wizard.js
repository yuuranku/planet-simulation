/* 推演向导：五步问卷 + 第六步世界总结 */
(function (G) {
  'use strict';
  const { Q, PAGES } = G.Config;
  const $ = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let st = null, page = -2, mapMode = false, onDone = null, canClose = false;

  function preparing(value) {
    $('wizBody').inert = value; $('wizSteps').inert = value;
    for (const id of ['wizNext', 'wizPrev', 'wizRandom']) $(id).disabled = value;
  }

  function open(state, done, closable) {
    G.MapImport.cancel(st);
    st = JSON.parse(JSON.stringify(state)); onDone = done; page = -2; mapMode = !!st.terrainInput; canClose = !!closable;
    preparing(false);
    $('wizClose').hidden = false;
    $('wizard').hidden = false;
    draw();
  }
  function close() { G.MapImport.cancel(st); preparing(false); hideTip(); $('wizard').hidden = true; }

  function optBtn(q, o, i) {
    const on = st.a[q.id] === o[0];
    const h = G.Config.hintOf(q.id, o[0]);
    return `<button class="opt${on ? ' on' : ''}${h ? ' has-hint' : ''}" data-q="${q.id}" data-v="${o[0]}"><span class="k">${'ABCDE'[i]}</span><b>${o[1]}</b>${o[2] ? `<small>${o[2]}</small>` : ''}${h ? `<span class="hint" data-hq="${q.id}" data-hv="${o[0]}" role="note" aria-label="大致影响">i</span>` : ''}</button>`;
  }
  // 选项影响提示：悬浮（触屏点按）灰色小标记显示，浮层挂在 body 上，避免被滚动区裁切
  let tipEl = null, tipFor = null;
  const ARR = { '+': '↑', '-': '↓', '·': '·' }, ARC = { '+': 'up', '-': 'dn', '·': 'mid' };

  // 最后一步的整体倾向：用实际推演参数（含自定义数值）粗略叠加。温度、水汽、季节等是参数直接给出的量；
  // 其余各项是按推演机制给每个参数打的方向分，只代表倾向，具体分布由种子与推演决定。
  function trends(st) {
    const c = G.Config.toCfg(st), a = st.a, cl = (v, m) => Math.max(-m, Math.min(m, v));
    const dT = (c.flux / 1361 - 1) * 80 + c.tempBias, m = c.moisture;
    const coreMean = (c.cores[0] + c.cores[1]) / 2;
    const polarIce = ['north', 'south'].reduce((s, k) => s + (a[k] === 'land' || a[k] === 'separate' ? 1 : a[k] === 'random' ? 0.67 : 0), 0);
    const ring = c.moons === 'ring';
    const sc = {
      cold: -dT / 3 + 0.3 * polarIce + (18 - c.tilt) / 10 * 0.6 + (ring ? 0.3 : 0),
      tropic: dT / 3 + (m - 1) * 5,
      arid: (c.land - 0.35) * 10 + cl((7 - coreMean) / 3, 1.2) + (c.radius - 6400) / 3200 + (1 - m) * 10 - dT / 8,
      mount: (c.activity - 1) * 4 + (c.interior - 1) + (6400 - c.radius) / 6400,
      coast: (0.35 - c.land) * 10 + cl((coreMean - 7) / 3, 1.2) + (c.coast - 1)
    };
    const lv = v => v >= 1.6 ? ['↑↑', 'up', '明显偏多'] : v >= 0.6 ? ['↑', 'up', '偏多'] : v <= -1.6 ? ['↓↓', 'dn', '明显偏少'] : v <= -0.6 ? ['↓', 'dn', '偏少'] : ['·', 'mid', '接近类地'];
    const row = (k, v, note) => { const [ar, cls, t] = lv(v); return `<div><span>${k}</span><i class="ar ${cls}">${ar}</i><b>${t}</b>${note ? `<small>${note}</small>` : ''}</div>`; };
    const fact = (k, ar, cls, t, note) => `<div><span>${k}</span><i class="ar ${cls}">${ar}</i><b>${t}</b>${note ? `<small>${note}</small>` : ''}</div>`;
    const t1 = Math.abs(dT) < 1 ? fact('温度', '·', 'mid', '接近类地', `约 ${dT >= 0 ? '+' : '−'}${Math.abs(dT).toFixed(1)} °C`) : fact('温度', dT > 0 ? (dT >= 4 ? '↑↑' : '↑') : (dT <= -4 ? '↓↓' : '↓'), dT > 0 ? 'up' : 'dn', dT > 0 ? '整体偏热' : '整体偏冷', `约 ${dT > 0 ? '+' : '−'}${Math.abs(dT).toFixed(1)} °C（恒星 + 气候调节）`);
    const w1 = Math.abs(m - 1) < 0.03 ? fact('水汽', '·', 'mid', '接近类地', `${m.toFixed(2)}×`) : fact('水汽', m > 1 ? '↑' : '↓', m > 1 ? 'up' : 'dn', m > 1 ? '偏湿润' : '偏干燥', `海面蒸发 ${m.toFixed(2)}×`);
    const s1 = c.tilt < 15 ? fact('季节', '↓', 'dn', '四季平缓', `轴倾角 ${c.tilt}°`) : c.tilt > 24 ? fact('季节', '↑', 'up', '季节强烈', `轴倾角 ${c.tilt}°`) : fact('季节', '·', 'mid', '接近类地', `轴倾角 ${c.tilt}°${ring ? ' · 星环让低纬冬季更冷' : ''}`);
    const hE = Math.max(18, Math.min(42, 30 + (c.day - 26) * 4 / 6));
    const b1 = fact('风带', '·', 'mid', `副热带高压约 ${hE.toFixed(0)}°`, (c.retro ? '自转逆行：' : '') + (c.retro ? '东西两岸气候对调' : '与地球同向') + (a.spin === 'random' ? '（随机，本种子结果）' : ''));
    const tide = { one: '潮滩湿地多、三角洲少', many: '潮滩与三角洲都有', none: '三角洲多、无潮滩', ring: '三角洲多、潮滩少' }[c.moons] || '';
    const lakes = c.lakeFactor < 0.8 ? ['↓', 'dn', '湖泊偏少'] : c.lakeFactor > 1.5 ? ['↑', 'up', '湖泊偏多'] : ['·', 'mid', '接近类地'];
    const nw = c.newWorld === true ? '有' : c.newWorld === false ? '无' : '随机';
    const contact = c.newWorld === false ? '' : c.endYear >= 4450 ? '前工业时代：若有，可能已被远洋航海接触' : '远洋航海尚未出现：若有，仍与旧大陆隔绝';
    const age = G.Config.ageLabel(c.endYear), M = G.MilitarySettings;
    const yr = G.Config.CUSTOM && st.custom && st.custom.age && st.custom.age.on ? `第 ${c.endYear} 年` : `约第 ${G.Config.AGE[a.age].join('–')} 年`;
    const pop = st.popMode === 'range' && c.popRange ? `${(c.popRange[0] / 1e8).toFixed(1)}–${(c.popRange[1] / 1e8).toFixed(1)} 亿` : `参考 ${G.Config.ERA_RANGE[c.popIdx].join('–')} 亿`;
    const step3 = (v, lo, hi) => v < lo ? ['↓', 'dn'] : v > hi ? ['↑', 'up'] : ['·', 'mid'];
    const civ = fact('时代', '·', 'mid', age, yr + (c.endYear >= 4450 ? ' · 已有火药与远洋航海' : c.endYear >= 3500 ? ' · 尚无印刷、火药与远洋航海' : ' · 尚无封建契约与远洋航海'))
      + fact('人口基线', ...step3(c.popIdx, 1, 1), ['较低', '中等', '较高'][c.popIdx], pop + '，实际人口随历史演化')
      + fact('文化', ...step3(c.cultures, 11, 17), c.cultures > 17 ? '多元细碎' : c.cultures < 11 ? '大文化圈' : '中等', `${c.cultures} 个文化圈 · ${c.languages} 种语言 · ${c.religions} 个宗教`)
      + fact('国家', ...step3(c.countries, 60, 100), c.countries > 100 ? '列国林立' : c.countries < 60 ? '少数大国' : '中等', `初始约 ${c.countries} 国 · 部落空间 ${Math.round(c.tribal * 100)}%`)
      + fact('城镇', ...step3(c.towns, 600, 900), c.towns > 900 ? '城镇密集' : c.towns < 600 ? '城镇疏朗' : '标准', `约 ${c.towns} 座城镇`);
    return `<div class="q"><h4><em>≈</em>世界总结 <small class="trend-sub">这些选择叠加出的整体倾向</small></h4><div class="trend">
      <section><h6>气候</h6>${t1}${w1}${s1}${b1}</section>
      <section><h6>地貌与群系</h6>${st.terrainInput ? fact('地形', '·', 'mid', '以导入图纸为准', `介入 ${st.terrainInput.intervention} / 100，保护规则优先`) + fact('板块', '·', 'mid', st.terrainInput.intervention > 50 ? '受图纸约束的假想构造' : '未生成') : row('冰盖苔原', sc.cold) + row('热带雨林', sc.tropic) + row('荒漠草原', sc.arid) + row('山地高原', sc.mount) + row('海岸与群岛', sc.coast) + fact('河口', '·', 'mid', tide) + fact('湖泊', ...lakes)}</section>
      <section><h6>文明生计</h6>${st.terrainInput ? fact('分布', '·', 'mid', '由图纸地形及气候推演', '图纸未标注旧／新大陆，不按问卷随机指定') : row('游牧', sc.arid) + row('高地', sc.mount) + row('沿海航海', sc.coast) + row('农耕', -(sc.cold + sc.arid) / 2) + fact('新大陆', '·', 'mid', nw, contact)}</section>
      <section><h6>文明格局</h6>${civ}</section>
      ${M ? `<section><h6>军事</h6>${M.trend(st, fact)}</section>` : ''}
    </div><p class="trend-note">${st.terrainInput ? '导入图纸替代问卷中的海陆比例、极地与大陆布局；天文、气候和人文设置继续生效。' : '按所选参数（含自定义数值）粗略叠加出的倾向，用来对照各选项的提示；具体分布由种子与推演决定。'}</p></div>`;
  }
  function showTip(mark) {
    const hq = mark.dataset.hq, h = hq.startsWith('mil:') ? G.MilitarySettings.hintOf(hq.slice(4), mark.dataset.hv) : G.Config.hintOf(hq, mark.dataset.hv); if (!h) return;
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'opt-tip'; document.body.appendChild(tipEl); }
    const opt = mark.closest('.opt'), title = opt ? opt.querySelector('b').textContent : '';
    tipEl.innerHTML = `<h5>${title} · 大致影响</h5>` + h.map(([k, d, v], i) => `<div><span class="lb">${i && h[i - 1][0] === k ? '' : k}</span><i class="ar ${ARC[d]}">${ARR[d]}</i><span class="tx">${v}</span></div>`).join('') + '<p><i class="ar up">↑</i>变多 / 变强　<i class="ar dn">↓</i>变少 / 变弱　<i class="ar mid">·</i>说明</p>';
    tipEl.classList.add('show'); tipFor = mark;
    const r = mark.getBoundingClientRect(), tw = tipEl.offsetWidth, th = tipEl.offsetHeight, vw = innerWidth, vh = innerHeight, gap = 8;
    let x = r.right + gap, y = r.top + r.height / 2 - th / 2;
    if (x + tw > vw - 8) x = Math.max(8, r.left - gap - tw); // 右侧放不下就放左侧
    if (x < 8) { x = Math.max(8, Math.min(vw - tw - 8, r.left + r.width / 2 - tw / 2)); y = r.bottom + gap; if (y + th > vh - 8) y = r.top - gap - th; }
    tipEl.style.left = x + 'px'; tipEl.style.top = Math.max(8, Math.min(vh - th - 8, y)) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.classList.remove('show'); tipFor = null; }
  function customBlock(q) {
    const fields = G.Config.CUSTOM[q.id]; if (!fields) return '';
    const o = (st.custom && st.custom[q.id]) || { on: false, v: {} };
    return `<div class="extra"><label><input type="checkbox" data-cu="${q.id}" ${o.on ? 'checked' : ''}> 自定义数值</label>
      ${o.on ? fields.map(f => `<label>${f.label} <input type="number" data-cq="${q.id}" data-ck="${f.key}" min="${f.min}" max="${f.max}" step="${f.step}" value="${o.v[f.key] ?? f.def}" style="width:96px"></label>`).join('') : ''}</div>`;
  }
  function extra(q) {
    if (q.extra === 'pop') {
      const r = G.Config.ERA_RANGE[{ A: 0, B: 1, C: 2 }[st.a.era]];
      return `<div class="extra">承载基线方式
        <span class="seg2" data-x="popMode"><button data-v="env" class="${st.popMode === 'env' ? 'on' : ''}">按环境估算基线</button><button data-v="range" class="${st.popMode === 'range' ? 'on' : ''}">按指定基线区间</button></span>
        ${st.popMode === 'range' ? `<label>下限 <input type="number" step="0.1" data-f="popLo" value="${st.popLo ?? r[0]}" min="${r[0]}" max="${r[1]}"> 亿</label><label>上限 <input type="number" step="0.1" data-f="popHi" value="${st.popHi ?? r[1]}" min="${r[0]}" max="${r[1]}"> 亿</label>` : ''}
        <span style="width:100%;font-size:12px;color:#8b96a0">基线参数不超过本档上限（${r[1]} 亿）；实际人口会随历史演化。</span></div>`;
    }
    if (q.extra === 'towns') {
      return `<div class="extra"><label><input type="checkbox" data-c="townsCustom" ${st.townsCustom ? 'checked' : ''}> 分别自定义</label>
        ${st.townsCustom ? `<label>城镇数 <input type="number" data-f="townsN" value="${st.townsN}" min="100" max="2000" step="20"></label>
        <label>行政 <select data-f="admin">${['粗分', '标准', '细分'].map((t, i) => `<option value="${i}" ${+st.admin === i ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>交通 <select data-f="transport">${['基础', '标准', '完善'].map((t, i) => `<option value="${i}" ${+st.transport === i ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}</div>`;
    }
    if (q.extra === 'climate') {
      return `<div class="extra"><label><input type="checkbox" data-c="climateCustom" ${st.climateCustom ? 'checked' : ''}> 分别自定义</label>
        ${st.climateCustom ? `<label>冷热偏置 <input type="range" data-f="tempBias" min="-6" max="6" step="0.1" value="${st.tempBias}"> <b>${st.tempBias > 0 ? '+' : ''}${st.tempBias} °C</b></label>
        <label>海洋水汽 <input type="range" data-f="moisture" min="0.8" max="1.2" step="0.01" value="${st.moisture}"> <b>${(+st.moisture).toFixed(2)}×</b></label>` : ''}</div>`;
    }
    return '';
  }
  function draw() {
    const sourceStep = page < 0;
    $('wizard').classList.toggle('source-step',sourceStep);
    $('wizSteps').hidden = sourceStep; $('wizDots').hidden = sourceStep;
    $('wizRandom').hidden = sourceStep; $('wizPrev').hidden = page === -2; $('wizNext').hidden = page === -2;
    $('wizPrev').disabled = false; $('wizPrev').textContent = page <= 0 ? '返回选择' : '上一步';
    $('wizTitle').textContent = page === -2 ? '创建世界' : page === -1 ? '上传世界地图' : '自定义你的世界';
    if (sourceStep) {
      hideTip();
      $('wizSub').textContent = page === -2 ? '选择从自己的图纸开始，或交给程序生成。' : '上传图片后自动处理，再设置天文、气候、种族与文明。';
      $('wizBody').innerHTML = page === -2
        ? '<div class="world-source-options"><button class="opt src-card" data-world-source="procedural"><span class="src-art proc"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="22"/><path d="M14 26c8 4 14-6 22-2s10 10 16 8M12 40c10-3 14 4 24 1s12-8 18-6"/><circle cx="48" cy="14" r="4"/></svg></span><b>程序生成</b><small>回答 25 个问题——星球、气候、大陆与文明——由程序推演出地形、历史与城市。</small><em>推荐 · 从零开始</em></button><button class="opt src-card" data-world-source="upload"><span class="src-art up"><svg viewBox="0 0 64 64"><rect x="10" y="14" width="44" height="34" rx="4"/><path d="M10 40l12-12 10 9 8-6 14 11"/><path d="M32 6v14M26 12l6-6 6 6"/></svg></span><b>上传世界地图</b><small>用你画好的地图或高度图。自动识别海陆、估算高程，再接着设定气候、种族与文明。</small><em>保留你的大陆轮廓</em></button></div>'
        : G.MapImport.html(st);
      if (page === -1) G.MapImport.bind($('wizBody'),st);
      $('wizNext').textContent = '继续设置世界';
      return;
    }
    const P = PAGES[page];
    $('wizSteps').innerHTML = PAGES.map((p, i) => `<button data-p="${i}" class="${i === page ? 'on' : ''} ${i < page ? 'done' : ''}"><i>${i < page ? '✓' : i + 1}</i><span><b>${p.t}</b><small>${p.final ? '总览倾向 · 开始推演' : p.q.map(qi => qi + 1).join('、') + (p.military && G.MilitarySettings ? `、${G.MilitarySettings.first}–${G.MilitarySettings.first + G.MilitarySettings.count - 1}` : '') + ' 题'}</small></span></button>`).join('') + `<div class="wiz-steps-note">每题都已预选；第 6 步总结整体倾向，可从那里回到任意一题修改。</div>`;
    let html = P.q.map(qi => { const q = Q[qi]; return `<div class="q"><h4><em>${qi + 1}</em>${q.t}</h4><div class="opts">${q.o.map((o, i) => optBtn(q, o, i)).join('')}</div>${extra(q)}${customBlock(q)}</div>`; }).join('');
    if (P.military && G.MilitarySettings) html += G.MilitarySettings.html(st);
    if (P.final) {
      html += trends(st);
      html += `<div class="q"><h4><em>▧</em>地图来源</h4><p>${st.terrainInput ? esc((st.terrainInput.source?.asset || st.terrainInput.asset).name)+' · 介入 '+st.terrainInput.intervention+' / 100' : '按生成设置推演海陆与地形'}</p><button type="button" class="btn ghost" data-act="map-source">${st.terrainInput?'修改上传图纸':'改用上传地图'}</button><p data-map-message role="status"></p></div>`;
      html += `<div class="q"><h4><em>⚙</em>推演参数</h4><div class="extra" style="margin-top:0">
        <label>种子 <input class="seedin" style="width:130px" data-f="seed" value="${st.seed}"></label>
        <button class="btn ghost" data-act="dice" style="height:32px;font-size:12px">换个种子</button>
        <span class="gridinfo">网格 ${(g => `${g.W}×${g.H} · 每格约 ${g.km.toFixed(1)} km`)(G.Config.gridOf(st))}<small>由星球大小决定</small></span>
      </div>
      <div class="wz-libs">
        <button type="button" data-act="libs"><b>文化库</b><span>已选 ${G.Home ? G.Home.selectedCount() : ''} 个</span><small>人名、地名、国号与制度，按文明生计大类匹配</small></button>
        <button type="button" data-act="rlibs"><b>宗教库</b><span>已选 ${G.RelLib ? G.RelLib.selectedCount() : ''} 个</span><small>按发源地文明匹配；类型与传播方式影响推演</small></button>
        <button type="button" data-act="slibs"><b>种族库</b><span>已选 ${G.SpeciesLib ? G.SpeciesLib.selectedCount() : 0} 个</span><small>体质、寿命与天赋词条</small></button>
      </div>
      <h5 class="wz-sumtitle">设定一览 <small>点任意一项回到那一步修改</small></h5><div class="summary">${Q.map((q, i) => { const o = q.o.find(x => x[0] === st.a[q.id]); return `<button type="button" data-p="${PAGES.findIndex(pg => pg.q.includes(i))}"><span>${i + 1}. ${q.t}</span><b>${o[1]}</b>${o[2] && o[2].length < 18 ? `<small>${o[2]}</small>` : ''}</button>`; }).join('')}${G.MilitarySettings ? G.MilitarySettings.summary(st).map(m => `<button type="button" data-p="${PAGES.findIndex(pg => pg.military)}"><span>${m.n}. ${m.t}</span><b>${m.b}</b><small>${m.s}</small></button>`).join('') : ''}</div></div>`;
    }
    hideTip();
    $('wizBody').innerHTML = html;
    $('wizNext').textContent = P.final ? '开始推演' : page === PAGES.length - 2 ? '查看世界总结' : '下一步';
    $('wizSub').textContent = `第 ${page + 1} / ${PAGES.length} 步 · ${P.t}`;
    $('wizDots').innerHTML = `<span class="wz-prog"><i style="width:${(page + 1) / PAGES.length * 100}%"></i></span>`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('wizBody').addEventListener('mapinputchanged', e=>{if(e.detail?.source==='procedural'){mapMode=false;page=0;}draw();});
    $('wizBody').addEventListener('mouseover', e => { const m = e.target.closest('.hint'); if (m && m !== tipFor) showTip(m); });
    $('wizBody').addEventListener('mouseout', e => { const m = e.target.closest('.hint'); if (m && !m.contains(e.relatedTarget)) hideTip(); });
    $('wizBody').addEventListener('scroll', hideTip, { passive: true });
    document.addEventListener('pointerdown', e => { if (tipFor && !e.target.closest('.hint')) hideTip(); });
    $('wizBody').addEventListener('click', e => {
      const source = e.target.closest('[data-world-source]');
      if (source) {
        mapMode = source.dataset.worldSource === 'upload';
        if (!mapMode) { G.MapImport.cancel(st); st = {...st}; delete st.terrainInput; }
        page = mapMode ? -1 : 0; draw(); $('wizBody').scrollTop = 0; return;
      }
      if (e.target.closest('[data-act="map-source"]')) { mapMode = true; page = -1; draw(); $('wizBody').scrollTop = 0; return; }
      const m = e.target.closest('.hint');
      if (m) { e.preventDefault(); e.stopPropagation(); showTip(m); return; } // 点标记只看说明，不改选项
      if (G.MilitarySettings && G.MilitarySettings.click(e.target, st)) { draw(); return; }
      const o = e.target.closest('.opt');
      if (o) { st.a[o.dataset.q] = o.dataset.v; draw(); return; }
      const sg = e.target.closest('.seg2 button');
      if (sg) { const k = sg.parentElement.dataset.x; st[k] = k === 'res' ? +sg.dataset.v : sg.dataset.v; draw(); return; }
      const jump = e.target.closest('.summary [data-p]'); if (jump) { page = +jump.dataset.p; draw(); $('wizBody').scrollTop = 0; return; }
      if (e.target.closest('[data-act=dice]')) { st.seed = (Math.random() * 1e9) | 0; draw(); }
      if (e.target.closest('[data-act=libs]')) { G.Home.showLibrary(); }
      if (e.target.closest('[data-act=rlibs]')) { G.RelLib.show(); }
      if (e.target.closest('[data-act=slibs]')) { G.SpeciesLib.show(); }
    });
    $('wizBody').addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.milcu || t.dataset.military) { if (G.MilitarySettings.change(t, st)) draw(); return; }
      if (t.dataset.cu) { st.custom = st.custom || {}; const q = t.dataset.cu, fields = G.Config.CUSTOM[q]; const o = st.custom[q] || { on: false, v: {} }; o.on = t.checked; fields.forEach(f => { if (o.v[f.key] === undefined) o.v[f.key] = f.def; }); st.custom[q] = o; draw(); return; }
      if (t.dataset.cq) { const o = st.custom[t.dataset.cq]; let v = +t.value; const f = G.Config.CUSTOM[t.dataset.cq].find(x => x.key === t.dataset.ck); v = Math.max(f.min, Math.min(f.max, isFinite(v) ? v : f.def)); o.v[t.dataset.ck] = v; t.value = v; return; }
      if (t.dataset.c) { st[t.dataset.c] = t.checked; draw(); }
      else if (t.dataset.f) { st[t.dataset.f] = t.dataset.f === 'seed' ? (parseInt(t.value, 10) || 0) : t.value; if (t.type === 'range') draw(); }
    });
    $('wizBody').addEventListener('input', e => { const t = e.target; if (t.type === 'range' && t.dataset.f) { st[t.dataset.f] = +t.value; t.nextElementSibling.textContent = t.dataset.f === 'tempBias' ? `${t.value > 0 ? '+' : ''}${t.value} °C` : `${(+t.value).toFixed(2)}×`; } });
    $('wizSteps').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { page = +b.dataset.p; draw(); $('wizBody').scrollTop = 0; } });
    $('wizPrev').addEventListener('click', () => { page = page > 0 ? page - 1 : page === 0 && mapMode ? -1 : -2; draw(); $('wizBody').scrollTop = 0; });
    $('wizNext').addEventListener('click', async () => {
      if (page === -1) {
        if (!G.MapImport.validateForGenerate(st,$('wizBody'))) return;
        if (!st.terrainInput) { $('wizBody').querySelector('[data-map-message]').textContent = '请先上传一张世界地图。'; return; }
        page = 0; draw(); $('wizBody').scrollTop = 0; return;
      }
      if (page < 0) return;
      if (PAGES[page].final) {
        if (!G.MapImport.validateForGenerate(st, $('wizBody'))) return;
        const current = st; preparing(true);
        try { await G.MapImport.ensureGrid(current); if (current !== st || $('wizard').hidden) return; close(); onDone && onDone(current); }
        catch (error) { if (current === st && error.name !== 'AbortError') { const el = $('wizBody').querySelector('[data-map-message]'); if (el) el.textContent = error.message; } }
        finally { if (current === st) preparing(false); }
        return;
      }
      page++; draw(); $('wizBody').scrollTop = 0;
    });
    $('wizRandom').addEventListener('click', () => { G.Config.randomize(st); page = PAGES.length - 1; draw(); });
    $('wizClose').addEventListener('click', () => { close(); if (!G.app || !G.app.data) G.Home.show(); });
  });

  G.Wizard = { open, close };
})(window);
