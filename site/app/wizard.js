/* 19 题推演向导 */
(function (G) {
  'use strict';
  const { Q, PAGES } = G.Config;
  const $ = id => document.getElementById(id);
  let st = null, page = 0, onDone = null, canClose = false;

  function open(state, done, closable) {
    st = JSON.parse(JSON.stringify(state)); onDone = done; page = 0; canClose = !!closable;
    $('wizClose').hidden = false;
    $('wizard').hidden = false;
    draw();
  }
  function close() { hideTip(); $('wizard').hidden = true; }

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
    return `<div class="q"><h4><em>≈</em>整体倾向</h4><div class="trend">
      <section><h6>气候</h6>${t1}${w1}${s1}${b1}</section>
      <section><h6>地貌与群系</h6>${row('冰盖苔原', sc.cold)}${row('热带雨林', sc.tropic)}${row('荒漠草原', sc.arid)}${row('山地高原', sc.mount)}${row('海岸与群岛', sc.coast)}${fact('河口', '·', 'mid', tide)}${fact('湖泊', ...lakes)}</section>
      <section><h6>文明生计</h6>${row('游牧', sc.arid)}${row('高地', sc.mount)}${row('沿海航海', sc.coast)}${row('农耕', -(sc.cold + sc.arid) / 2)}${fact('新大陆', '·', 'mid', nw, contact)}</section>
    </div><p class="trend-note">按所选参数（含自定义数值）粗略叠加出的倾向，用来对照各选项的提示；具体分布由种子与推演决定。</p></div>`;
  }
  function showTip(mark) {
    const h = G.Config.hintOf(mark.dataset.hq, mark.dataset.hv); if (!h) return;
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
      return `<div class="extra">人口方式
        <span class="seg2" data-x="popMode"><button data-v="env" class="${st.popMode === 'env' ? 'on' : ''}">按环境估算</button><button data-v="range" class="${st.popMode === 'range' ? 'on' : ''}">按指定区间</button></span>
        ${st.popMode === 'range' ? `<label>下限 <input type="number" step="0.1" data-f="popLo" value="${st.popLo ?? r[0]}" min="${r[0]}" max="${r[1]}"> 亿</label><label>上限 <input type="number" step="0.1" data-f="popHi" value="${st.popHi ?? r[1]}" min="${r[0]}" max="${r[1]}"> 亿</label>` : ''}
        <span style="width:100%;font-size:12px;color:#8b96a0">两种方式都不超过本档人口上限（${r[1]} 亿）。</span></div>`;
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
    const P = PAGES[page];
    $('wizSteps').innerHTML = PAGES.map((p, i) => `<button data-p="${i}" class="${i === page ? 'on' : ''} ${i < page ? 'done' : ''}">${i + 1}. ${p.t}</button>`).join('');
    let html = P.q.map(qi => { const q = Q[qi]; return `<div class="q"><h4><em>${qi + 1}</em>${q.t}</h4><div class="opts">${q.o.map((o, i) => optBtn(q, o, i)).join('')}</div>${extra(q)}${customBlock(q)}</div>`; }).join('');
    if (P.final) {
      html += trends(st);
      html += `<div class="q"><h4><em>⚙</em>推演参数</h4><div class="extra" style="margin-top:0">
        <label>种子 <input class="seedin" style="width:130px" data-f="seed" value="${st.seed}"></label>
        <button class="btn ghost" data-act="dice" style="height:32px;font-size:12px">换个种子</button>
        <span class="gridinfo">网格 ${(g => `${g.W}×${g.H} · 每格约 ${g.km.toFixed(1)} km`)(G.Config.gridOf(st))}<small>由星球大小决定</small></span>
      </div>
      <div class="extra" style="margin-top:10px">文化库：已选 ${G.Home ? G.Home.selectedCount() : ''} 个库（名称、国名后缀按文明的生计大类匹配）<button class="btn ghost" data-act="libs" style="height:30px;font-size:12px">前往文化库</button></div>
      <div class="extra" style="margin-top:8px">宗教库：已选 ${G.RelLib ? G.RelLib.selectedCount() : ''} 个库（按宗教发源地的文明匹配；宗教类型与传播方式影响历史推演）<button class="btn ghost" data-act="rlibs" style="height:30px;font-size:12px">前往宗教库</button></div>
      <div class="summary">${Q.map((q, i) => { const o = q.o.find(x => x[0] === st.a[q.id]); return `<div><span>${i + 1}. ${q.t}</span><br>${o[1]}${o[2] && o[2].length < 18 ? ' · ' + o[2] : ''}</div>`; }).join('')}</div></div>`;
    }
    hideTip();
    $('wizBody').innerHTML = html;
    $('wizDots').innerHTML = Q.map((q, i) => `<i class="${PAGES.findIndex(p => p.q.includes(i)) <= page ? 'on' : ''}"></i>`).join('');
    $('wizPrev').disabled = page === 0;
    $('wizNext').textContent = P.final ? '开始推演' : '下一步';
    $('wizSub').textContent = `第 ${page + 1} / ${PAGES.length} 步 · ${P.t} · 每题都已预选，可直接修改`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('wizBody').addEventListener('mouseover', e => { const m = e.target.closest('.hint'); if (m && m !== tipFor) showTip(m); });
    $('wizBody').addEventListener('mouseout', e => { const m = e.target.closest('.hint'); if (m && !m.contains(e.relatedTarget)) hideTip(); });
    $('wizBody').addEventListener('scroll', hideTip, { passive: true });
    document.addEventListener('pointerdown', e => { if (tipFor && !e.target.closest('.hint')) hideTip(); });
    $('wizBody').addEventListener('click', e => {
      const m = e.target.closest('.hint');
      if (m) { e.preventDefault(); e.stopPropagation(); showTip(m); return; } // 点标记只看说明，不改选项
      const o = e.target.closest('.opt');
      if (o) { st.a[o.dataset.q] = o.dataset.v; draw(); return; }
      const sg = e.target.closest('.seg2 button');
      if (sg) { const k = sg.parentElement.dataset.x; st[k] = k === 'res' ? +sg.dataset.v : sg.dataset.v; draw(); return; }
      if (e.target.closest('[data-act=dice]')) { st.seed = (Math.random() * 1e9) | 0; draw(); }
      if (e.target.closest('[data-act=libs]')) { G.Home.showLibrary(); }
      if (e.target.closest('[data-act=rlibs]')) { G.RelLib.show(); }
    });
    $('wizBody').addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.cu) { st.custom = st.custom || {}; const q = t.dataset.cu, fields = G.Config.CUSTOM[q]; const o = st.custom[q] || { on: false, v: {} }; o.on = t.checked; fields.forEach(f => { if (o.v[f.key] === undefined) o.v[f.key] = f.def; }); st.custom[q] = o; draw(); return; }
      if (t.dataset.cq) { const o = st.custom[t.dataset.cq]; let v = +t.value; const f = G.Config.CUSTOM[t.dataset.cq].find(x => x.key === t.dataset.ck); v = Math.max(f.min, Math.min(f.max, isFinite(v) ? v : f.def)); o.v[t.dataset.ck] = v; t.value = v; return; }
      if (t.dataset.c) { st[t.dataset.c] = t.checked; draw(); }
      else if (t.dataset.f) { st[t.dataset.f] = t.dataset.f === 'seed' ? (parseInt(t.value, 10) || 0) : t.value; if (t.type === 'range') draw(); }
    });
    $('wizBody').addEventListener('input', e => { const t = e.target; if (t.type === 'range' && t.dataset.f) { st[t.dataset.f] = +t.value; t.nextElementSibling.textContent = t.dataset.f === 'tempBias' ? `${t.value > 0 ? '+' : ''}${t.value} °C` : `${(+t.value).toFixed(2)}×`; } });
    $('wizSteps').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { page = +b.dataset.p; draw(); $('wizBody').scrollTop = 0; } });
    $('wizPrev').addEventListener('click', () => { if (page > 0) { page--; draw(); $('wizBody').scrollTop = 0; } });
    $('wizNext').addEventListener('click', () => {
      if (PAGES[page].final) { close(); onDone && onDone(st); return; }
      page++; draw(); $('wizBody').scrollTop = 0;
    });
    $('wizRandom').addEventListener('click', () => { G.Config.randomize(st); page = PAGES.length - 1; draw(); });
    $('wizClose').addEventListener('click', () => { close(); if (!G.app || !G.app.data) G.Home.show(); });
  });

  G.Wizard = { open, close };
})(window);
