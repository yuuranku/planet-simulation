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
  function close() { $('wizard').hidden = true; }

  function optBtn(q, o, i) {
    const on = st.a[q.id] === o[0];
    return `<button class="opt${on ? ' on' : ''}" data-q="${q.id}" data-v="${o[0]}"><span class="k">${'ABCDE'[i]}</span><b>${o[1]}</b>${o[2] ? `<small>${o[2]}</small>` : ''}</button>`;
  }
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
        <span style="width:100%;font-size:12px;color:#8b96a0">两种方式都不超过本时代人口上限（${r[1]} 亿）。</span></div>`;
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
      html += `<div class="q"><h4><em>⚙</em>推演参数</h4><div class="extra" style="margin-top:0">
        <label>种子 <input class="seedin" style="width:130px" data-f="seed" value="${st.seed}"></label>
        <button class="btn ghost" data-act="dice" style="height:32px;font-size:12px">换个种子</button>
        <span class="gridinfo">网格 ${(g => `${g.W}×${g.H} · 每格约 ${g.km.toFixed(1)} km`)(G.Config.gridOf(st))}<small>由星球大小决定</small></span>
      </div>
      <div class="extra" style="margin-top:10px">文化库：已选 ${G.Home ? G.Home.selectedCount() : ''} 个库（名称、国名后缀按文明的生计大类匹配）<button class="btn ghost" data-act="libs" style="height:30px;font-size:12px">前往文化库</button></div>
      <div class="summary">${Q.map((q, i) => { const o = q.o.find(x => x[0] === st.a[q.id]); return `<div><span>${i + 1}. ${q.t}</span><br>${o[1]}${o[2] && o[2].length < 18 ? ' · ' + o[2] : ''}</div>`; }).join('')}</div></div>`;
    }
    $('wizBody').innerHTML = html;
    $('wizDots').innerHTML = Q.map((q, i) => `<i class="${PAGES.findIndex(p => p.q.includes(i)) <= page ? 'on' : ''}"></i>`).join('');
    $('wizPrev').disabled = page === 0;
    $('wizNext').textContent = P.final ? '开始推演' : '下一步';
    $('wizSub').textContent = `第 ${page + 1} / ${PAGES.length} 步 · ${P.t} · 每题都已预选，可直接修改`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('wizBody').addEventListener('click', e => {
      const o = e.target.closest('.opt');
      if (o) { st.a[o.dataset.q] = o.dataset.v; draw(); return; }
      const sg = e.target.closest('.seg2 button');
      if (sg) { const k = sg.parentElement.dataset.x; st[k] = k === 'res' ? +sg.dataset.v : sg.dataset.v; draw(); return; }
      if (e.target.closest('[data-act=dice]')) { st.seed = (Math.random() * 1e9) | 0; draw(); }
      if (e.target.closest('[data-act=libs]')) { G.Home.showLibrary(); }
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
