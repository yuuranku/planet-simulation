/* 综合国力排行（历史时间线 · 国家）
 * 按时间线当前的年月，把当世各国放在同一把尺子上比：经济、人口、军力、疆域、文治五项，
 * 每项以当年最强者为 1 归一，加权合成国力指数（五项合计满分 100）；宗主另得附庸国力的四分之一。
 * 数据全部取自历史推演本身（疆土易手记录、户口采样、城市人口、驻军日志、都城的发展阶段与思潮），
 * 拖动或播放时间轴时随之重排；与五十年前相比的名次升降标在名次旁。点一国进入单国视角。 */
(function (G) {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 五项指标：权重、配色、说明
  const DIMS = [
    { k: 'econ', name: '经济', w: 0.30, col: '#b98a2e', desc: '各地人口 × 当地发展阶段的生产力，加上城市人口的工商之利' },
    { k: 'pop', name: '人口', w: 0.20, col: '#4f7f6a', desc: '境内户口（取最近一次人口采样，以当年疆域合计）' },
    { k: 'mil', name: '军力', w: 0.25, col: '#a5432f', desc: '常备驻军按训练与装备折算，加上按军制估算的战时可动员兵力' },
    { k: 'area', name: '疆域', w: 0.10, col: '#4d6c96', desc: '实际控制的国土面积（含起义区，仍计入原属国）' },
    { k: 'dev', name: '文治', w: 0.15, col: '#7d5a94', desc: '都城一带的发展阶段，与已接纳的思潮占当世已兴起思潮的比例' }
  ];
  const VASSAL_SHARE = 0.25;   // 宗主得附庸国力的份额
  const TREND_SPAN = 50;       // 名次升降与多少年前相比
  const PROD = [0.25, 0.45, 0.65, 1, 1.35, 1.8, 2.4, 3.2, 4.4]; // 各发展阶段的人均产出（游群 → 当代）
  const MOB = 0.025;           // 可动员兵力：人口 × 2.5% × 军制的动员倍率
  const SORTS = [['all', '综合'], ...DIMS.map(d => [d.k, d.name])];
  const SHOW = 40;

  let T = null, el = null, on = false, sort = 'all', lastSig = '', timer = 0, lastAt = 0, more = false;
  const cache = new Map(); // 月份 → 排行结果（同一份历史内复用）
  let cacheFor = null;

  const big = n => n >= 1e8 ? (n / 1e8).toFixed(n >= 1e9 ? 1 : 2) + ' 亿' : n >= 1e4 ? (n / 1e4).toFixed(n >= 1e6 ? 0 : 1) + ' 万' : Math.round(n).toLocaleString('zh-CN');
  const areaTxt = a => a >= 1e6 ? (a / 1e6).toFixed(2) + ' 百万 km²' : a >= 1e4 ? (a / 1e4).toFixed(1) + ' 万 km²' : Math.round(a).toLocaleString('zh-CN') + ' km²';

  function quality(unit) { const U = G.Military && G.Military.UNITS[unit]; return U ? (U.t + U.e) / 2 : 0.3; }
  function polityMil(H, p, y, pop, stage) {
    const MU = G.MilitaryUI, MS = G.Military; if (!MS) return { mil: pop * 0.004, standing: 0, mobil: pop * 0.004 };
    const a = MU ? MU.armyAt(H, p, y) : null; let standing = 0, sq = 0;
    if (a) for (const s of a.stations) { standing += s.n; sq += s.n * quality(s.unit); }
    const key = (MU && MU.msysAt(H, p, y)) || (stage >= 3 ? 'levy' : 'warband'), S = MS.SYSTEMS[key] || MS.SYSTEMS.levy;
    let rate = 0, rq = 0; for (const [u, k] of S.reserve) { rate += k; rq += k * quality(u); }
    const mobil = pop * MOB * rate, mq = rate ? rq / rate : 0.3;
    return { mil: sq + mobil * mq * 0.35, standing, mobil, sys: S.name };
  }

  // 某一年的全部排行
  function compute(y) {
    const H = T.H; if (cacheFor !== H) { cache.clear(); cacheFor = H; }
    const mk = Math.floor(y * 12 + 1e-7); if (cache.has(mk)) return cache.get(mk);
    const NP = H.polities.length, nR = H.nR;
    const reg = new Int32Array(NP), area = new Float64Array(NP), pop = new Float64Array(NP), econ = new Float64Array(NP), cityN = new Int32Array(NP), urban = new Float64Array(NP);
    const snap = T.snapshotAt(y), cnt = new Int32Array(nR + 1).fill(-1);
    let wTot = 0, popTot = 0; if (!snap) for (let r = 1; r <= nR; r++) wTot += H.weight[r] || 0;
    for (let r = 1; r <= nR; r++) {
      const o = T.ownerAt(r, y); if (o < 0) continue; const c = T.countryOf(o, y); cnt[r] = c;
      reg[c]++; area[c] += H.area[r] || 0;
      let n = 0;
      if (snap && snap.offsets[r + 1] !== undefined) for (let i = snap.offsets[r]; i < snap.offsets[r + 1]; i++) n += snap.population[i] > 0 ? snap.population[i] : 0;
      else n = (H.weight[r] || 0) * 1e3; // 第一次户口采样之前：按土地承载权重估一个相对量
      pop[c] += n; popTot += n; econ[c] += n * PROD[Math.max(0, Math.min(8, T.stageAt(r, y)))];
    }
    (H.cities || []).forEach((ct, i) => { if (!ct.r || !T.alive(ct, y)) return; const c = cnt[ct.r]; if (c < 0) return; const n = T.popAt(i, y); cityN[c]++; urban[c] += n; econ[c] += n * 1.5; });
    const nb = (H.ideas || []).filter(I => I.born !== null && I.born <= y).length;
    const list = [];
    for (let p = 0; p < NP; p++) {
      if (!reg[p] || T.isRebel(p, y)) continue; const q = H.polities[p];
      const cap = T.capAt(p, y), cs = cap ? T.stageAt(cap[2], y) : 1;
      const ideas = (q.ideaAdopt || []).filter(x => x[1] <= y).length;
      const m = polityMil(H, p, y, pop[p], cs);
      const dev = Math.max(0, cs) / Math.max(1, H.maxStage || 8) * 0.6 + (nb ? Math.min(1, ideas / nb) : 0) * 0.4;
      list.push({ p, reg: reg[p], area: area[p], pop: pop[p], econ: econ[p], mil: m.mil, standing: m.standing, mobil: m.mobil, sys: m.sys, dev, stage: cs, ideas, cities: cityN[p], urban: urban[p], cap });
    }
    const mx = {}; for (const d of DIMS) mx[d.k] = Math.max(1e-9, ...list.map(x => x[d.k]));
    const byP = new Map(list.map(x => [x.p, x]));
    for (const x of list) { x.parts = DIMS.map(d => 100 * d.w * x[d.k] / mx[d.k]); x.base = x.parts.reduce((a, b) => a + b, 0); x.norm = Object.fromEntries(DIMS.map(d => [d.k, x[d.k] / mx[d.k]])); }
    for (const x of list) { const l = T.liegeAt(x.p, y); x.liege = l >= 0 && l !== x.p && byP.has(l) ? l : -1; x.vassals = []; x.bonus = 0; }
    for (const x of list) if (x.liege >= 0) { const L = byP.get(x.liege); L.vassals.push(x.p); L.bonus += VASSAL_SHARE * x.base; }
    for (const x of list) x.score = x.base + x.bonus;
    list.sort((a, b) => b.score - a.score || a.p - b.p); list.forEach((x, i) => { x.rank = i + 1; });
    const res = { y, list, byP, snapYear: snap ? snap.year : null, popTot, nb };
    if (cache.size > 240) cache.delete(cache.keys().next().value);
    cache.set(mk, res); return res;
  }

  // 天下格局：看前几名国力的落差
  function pattern(L) {
    if (L.length < 2) return L.length ? ['一国独存', '当世只有这一个国家'] : ['尚无国家', '这一年还没有成形的国家'];
    const [a, b, c] = L.map(x => x.score), r2 = b / a, r3 = c ? c / b : 0;
    if (r2 < 0.55) return ['一超独霸', `居首者国力约为次席的 ${(a / b).toFixed(1)} 倍`];
    if (r2 >= 0.8 && (!c || r3 < 0.62)) return ['两强争霸', '前两名旗鼓相当，余国远远落后'];
    if (c && c / a >= 0.7) return ['列强均势', '前三名国力相去不远'];
    return ['群雄并立', '强国之间互有短长'];
  }

  function nameOf(p, y, x) { return T.polName(p, y, Math.max(1, x ? x.reg : 1)); }
  function swatch(p, y) { const H = T.H, L = T.realmAt(p, y); return L !== p ? T.vassalTint(H.polities[L].color, p) : H.polities[p].color; }

  function render(force) {
    if (!on || !T || !T.H) return; const y = T.year, H = T.H;
    const sig = Math.floor(y * 12 + 1e-7) + ':' + sort + ':' + T.focus + ':' + more + ':' + (G.app && G.app.noPrefix ? 1 : 0);
    if (!force && sig === lastSig) return; lastSig = sig;
    const R = compute(y), past = y - TREND_SPAN >= 0 ? compute(y - TREND_SPAN) : null;
    const L = sort === 'all' ? R.list : R.list.slice().sort((a, b) => b[sort] - a[sort] || b.score - a.score);
    const total = R.list.reduce((s, x) => s + x.score, 0), [pat, patWhy] = pattern(R.list);
    const top = R.list[0];
    const dim = DIMS.find(d => d.k === sort);
    const rows = L.slice(0, more ? L.length : SHOW).map((x, i) => {
      const p = x.p, nm = nameOf(p, y, x);
      let tr = ''; if (past) { const o = past.byP.get(p); tr = !o ? '<em class="pr-new" title="五十年前尚未立国或没有疆土">新</em>' : o.rank > x.rank ? `<em class="pr-up" title="${TREND_SPAN} 年前第 ${o.rank} 名">▲${o.rank - x.rank}</em>` : o.rank < x.rank ? `<em class="pr-down" title="${TREND_SPAN} 年前第 ${o.rank} 名">▼${x.rank - o.rank}</em>` : '<em class="pr-same" title="名次未变">–</em>'; }
      const tag = x.liege >= 0 ? `<small class="pr-tag" title="奉${esc(nameOf(x.liege, y, R.byP.get(x.liege)))}为宗主">附庸</small>` : x.vassals.length ? `<small class="pr-tag lord" title="附庸国力的四分之一计入：+${x.bonus.toFixed(1)}">${x.vassals.length} 附庸</small>` : '';
      const sum = Math.max(1e-9, x.base);
      const bar = x.parts.map((v, k) => `<i style="width:${(v / Math.max(1e-9, R.list[0].score) * 100).toFixed(2)}%;background:${DIMS[k].col}" title="${DIMS[k].name} ${(v / sum * 100).toFixed(0)}%"></i>`).join('') + (x.bonus ? `<i class="pr-bonus" style="width:${(x.bonus / Math.max(1e-9, R.list[0].score) * 100).toFixed(2)}%" title="附庸加成 +${x.bonus.toFixed(1)}"></i>` : '');
      const val = dim ? dimValue(dim.k, x) : x.score.toFixed(1);
      const pos = sort === 'all' ? x.rank : i + 1;
      return `<li data-p="${p}" class="${p === T.focus ? 'on' : ''}${pos <= 3 ? ' top' + pos : ''}">
        <span class="pr-rank"><b>${pos}</b>${sort === 'all' ? tr : ''}</span>
        <div class="pr-main"><div class="pr-name"><i style="background:rgb(${swatch(p, y)})"></i><span>${esc(nm)}</span>${tag}</div>
        <div class="pr-bar">${bar}</div>
        <div class="pr-sub"><span>人口 ${big(x.pop)}</span><span>兵 ${big(x.standing)}<small>常备</small></span><span>${areaTxt(x.area)}</span><span>城 ${x.cities}</span></div></div>
        <span class="pr-val${dim ? ' dim' : ''}">${val}${dim ? `<small>${dim.k === 'all' ? '' : '指数 ' + x.score.toFixed(1)}</small>` : `<small>${(x.score / Math.max(1e-9, total) * 100).toFixed(1)}%</small>`}</span></li>`;
    }).join('');
    const legend = DIMS.map(d => `<span title="${esc(d.desc)} · 权重 ${Math.round(d.w * 100)}%"><i style="background:${d.col}"></i>${d.name}<small>${Math.round(d.w * 100)}</small></span>`).join('') + `<span title="宗主另得附庸国力的四分之一"><i class="pr-bonus"></i>附庸</span>`;
    el.innerHTML = `<header><div><b>综合国力排行</b><small>${esc(T.dateLabel(y))} · 当世 ${R.list.length} 国${R.snapYear !== null ? ` · 户口取第 ${R.snapYear} 年` : ' · 尚无户口记录，人口按土地承载估算'}</small></div><button class="tl-icon" data-x="1" title="关闭"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
      ${top ? `<div class="pr-hero" data-p="${top.p}"><div><small>天下格局</small><b>${pat}</b><span>${esc(patWhy)}</span></div><div class="pr-lead"><small>当世第一</small><b>${esc(nameOf(top.p, y, top))}</b><span>国力 ${top.score.toFixed(1)} · 占天下 ${(top.score / Math.max(1e-9, total) * 100).toFixed(0)}%</span></div></div>` : ''}
      <div class="pr-sort">${SORTS.map(([k, n]) => `<button data-sort="${k}" class="${sort === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="pr-legend">${legend}</div>
      <ol class="pr-list">${rows || '<li class="none">这一年还没有成形的国家——拖动时间轴到城邦出现之后再看</li>'}${L.length > SHOW ? `<li class="pr-more"><button data-more="1">${more ? '只看前 ' + SHOW + ' 名' : `展开其余 ${L.length - SHOW} 国`}</button></li>` : ''}</ol>
      <details class="pr-note"><summary>国力怎么算</summary><p>五项各以当年最强的国家为满分归一，再按权重相加，五项合计满分 100：${DIMS.map(d => `<b>${d.name}</b> ${Math.round(d.w * 100)}%（${esc(d.desc)}）`).join('；')}。宗主另加附庸国力的四分之一，所以有附庸的大国可以超过 100。名次旁的 ▲▼ 与 ${TREND_SPAN} 年前相比。右侧百分比为占当世各国国力总和的份额。点一国进入单国视角。</p></details>`;
  }
  function dimValue(k, x) {
    if (k === 'pop') return big(x.pop);
    if (k === 'area') return areaTxt(x.area);
    if (k === 'mil') return big(x.standing + x.mobil * 0.35) + '<em>兵</em>';
    if (k === 'econ') return (x.norm.econ * 100).toFixed(0);
    if (k === 'dev') return `阶段 ${x.stage}<em>· 思潮 ${x.ideas}</em>`;
    return x.score.toFixed(1);
  }

  function ensure() {
    if (el) return el;
    el = document.createElement('section'); el.className = 'card tl-power'; el.id = 'tlPower'; el.hidden = true; document.body.appendChild(el);
    el.addEventListener('click', e => {
      if (e.target.closest('[data-x]')) return hide();
      const s = e.target.closest('[data-sort]'); if (s) { sort = s.dataset.sort; render(true); el.querySelector('.pr-list').scrollTop = 0; return; }
      if (e.target.closest('[data-more]')) { more = !more; render(true); return; }
      const r = e.target.closest('[data-p]'); if (r && T) T.setFocus(+r.dataset.p);
    });
    document.addEventListener('keydown', ev => { if (on && ev.key === 'Escape' && T && T.focus < 0) hide(); });
    return el;
  }
  function show() {
    if (!T || !T.H) return; ensure(); on = true; el.hidden = false; T.closeOthers && T.closeOthers();
    const b = $('tlPowerBtn'); if (b) b.classList.add('on'); render(true);
  }
  function hide() { on = false; if (el) el.hidden = true; const b = $('tlPowerBtn'); if (b) b.classList.remove('on'); clearTimeout(timer); timer = 0; }
  const toggle = () => on ? hide() : show();
  // 播放时最多每 0.3 秒重排一次，停下时立即对齐
  function onYear() {
    if (!on) return; const now = performance.now();
    if (now - lastAt > 300) { lastAt = now; render(); return; }
    if (!timer) timer = setTimeout(() => { timer = 0; lastAt = performance.now(); render(); }, 320);
  }
  function reset() { hide(); cache.clear(); cacheFor = null; lastSig = ''; }
  function init(api) { T = api; }

  G.PowerRank = { init, show, hide, toggle, onYear, reset, refresh: () => render(true), compute: y => T && T.H ? compute(y) : null, get on() { return on; }, DIMS };
})(window);
