/* 宗教库页面：勾选、查看、编辑、新建、导入导出（与文化库页面同一套做法）。勾选结果随世界冻结为快照。 */
(function (G) {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SEL = 'planet-religion-selection-v1', CUS = 'planet-religion-custom-v1', OVR = 'planet-religion-override-v1';
  const TYPES = () => window.RELIGION_TYPES || {}, SPREADS = () => window.RELIGION_SPREAD || {};
  const CAT = { agrarian: '农耕', pastoral: '游牧', maritime: '海洋', highland: '山地', tribal: '部族', 'new-world': '新大陆' };
  const NAME_KEYS = [['faiths', '教名（现成）'], ['suffix', '教名后缀（教名用完时：地名 + 后缀）'], ['branches', '派别（推演中的教派分裂）'], ['heresies', '异端（教民起义的名号）'], ['holy', '圣地与圣城']];
  const CLERGY_KEYS = [['head', '教会首领'], ['priest', '神职人员'], ['theocracy', '神权国称号'], ['ruler', '神权国君主称谓']];
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  let builtin = null, tab = 'all';
  function load() {
    if (builtin) return Promise.resolve(builtin);
    if (window.RELIGION_LIBRARIES) return Promise.resolve(builtin = window.RELIGION_LIBRARIES);
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'core/religions.js'; s.onload = () => res(builtin = window.RELIGION_LIBRARIES); s.onerror = rej; document.head.appendChild(s); });
  }
  function all() { const o = get(OVR, {}); return (builtin || []).map(l => o[l.id] ? { ...o[l.id], builtin: true, edited: true } : { ...l, builtin: true }).concat(get(CUS, []).map(l => ({ ...l, builtin: false }))); }
  function getSel() { const v = get(SEL, null); return Array.isArray(v) ? v : null; }
  // 快照：所选内置库 id + 所选自定义库与改过的内置库的完整内容
  function snapshot() {
    const sel = getSel(), o = get(OVR, {}), ids = sel || (builtin ? builtin.map(l => l.id) : null);
    const edited = Object.values(o).filter(l => !ids || ids.includes(l.id));
    if (!sel) return { ids: edited.length && builtin ? builtin.map(l => l.id).filter(id => !o[id]) : null, custom: edited };
    return { ids: sel.filter(id => !id.startsWith('rcustom-') && !o[id]), custom: get(CUS, []).filter(l => sel.includes(l.id)).concat(edited) };
  }
  function selectedCount() { const s = getSel(); return s ? s.length : (builtin ? builtin.length : (window.RELIGION_LIBRARIES || []).length || 15); }
  function modal(title, body, foot) { $('libModalBody').innerHTML = `<header class="lm-head"><h3>${title}</h3><button class="x" data-lm-close><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header><div class="lm-body">${body}</div>${foot ? `<footer class="lm-foot">${foot}</footer>` : ''}`; $('libModal').hidden = false; }
  const close = () => { $('libModal').hidden = true; };
  async function show() { $('relPage').hidden = false; $('relGrid').innerHTML = '<p class="home-empty">正在载入宗教库…</p>'; await load(); render(); }
  function render() {
    const libs = all(), sel = getSel() || libs.map(l => l.id), T = TYPES();
    $('relSummary').textContent = `已选 ${sel.length} / ${libs.length} 个宗教库 · 推演时按宗教发源地的文明（生计大类、写实或架空风格）匹配所选库。宗教的类型与传播方式会改变传教、改宗、教派分裂、神权与教民起义的走向。`;
    $('relTabs').innerHTML = [['all', '全部']].concat(Object.entries(T)).map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-rtab="${k}">${n} <small>${k === 'all' ? libs.length : libs.filter(l => l.type === k).length}</small></button>`).join('');
    $('relGrid').innerHTML = libs.filter(l => tab === 'all' || l.type === tab).map(l => { const on = sel.includes(l.id), nm = l.names || {};
      return `<div class="lcard${on ? ' on' : ''}"><label class="lcheck"><input type="checkbox" data-rsel="${esc(l.id)}" ${on ? 'checked' : ''}><span></span></label>
        <div class="lmain"><b><span style="color:rgb(${(l.color || [120, 100, 160]).join(',')})">${esc(l.symbol || '✦')}</span> ${esc(l.label)}</b><small>${esc(T[l.type] || l.type || '')} · ${esc((SPREADS()[l.spread] || '').split(' · ')[0])} · ${l.builtin ? (l.mode === 'fantasy' ? '架空' : '写实化名') + (l.edited ? ' · 已修改' : '') : '自定义'}</small>
        <p>${esc((nm.faiths || []).slice(0, 4).join('、'))} · 派别：${esc((nm.branches || []).slice(0, 3).join('、'))}…</p>
        <div class="lact"><button data-rview="${esc(l.id)}">查看</button><button data-redit="${esc(l.id)}">编辑</button><button data-rcopy="${esc(l.id)}">复制为自定义</button>${l.builtin ? (l.edited ? `<button data-rreset="${esc(l.id)}">恢复默认</button>` : '') : `<button class="danger" data-rdel="${esc(l.id)}">删除</button>`}</div></div></div>`; }).join('');
  }
  function view(l) {
    const nm = l.names || {}, cl = l.clergy || {};
    modal(esc((l.symbol || '') + ' ' + l.label), `<p class="lm-note">${esc(TYPES()[l.type] || '')} · ${esc(SPREADS()[l.spread] || '')} · 适合的文明：${(l.cats || []).map(c => CAT[c] || c).join('、') || '不限'} · 圣物：${esc(l.relic || '—')}</p>`
      + NAME_KEYS.map(([k, lab]) => `<h5>${lab} <small>${(nm[k] || []).length}</small></h5><p class="names">${esc((nm[k] || []).join('、')) || '—'}</p>`).join('')
      + `<h5>圣职与神权</h5><p class="names">${CLERGY_KEYS.map(([k, lab]) => `${lab}：${esc(cl[k] || '—')}`).join('<br>')}</p>`
      + `<h5>象征色</h5><p class="names"><i style="display:inline-block;width:40px;height:14px;border-radius:4px;background:rgb(${(l.color || [0, 0, 0]).join(',')})"></i> ${esc((l.color || []).join(', '))}</p>`);
  }
  function edit(l, isNew) {
    const nm = l.names || {}, cl = l.clergy || {}, hex = c => '#' + (c || [120, 100, 160]).map(v => (v | 0).toString(16).padStart(2, '0')).join('');
    const opt = (o, v) => Object.entries(o).map(([k, n]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${esc(n)}</option>`).join('');
    modal(isNew ? '新建自定义宗教库' : (l.builtin ? '编辑内置宗教库：' : '编辑：') + esc(l.label), `<div class="lform">
      <label>名称<input id="re-label" value="${esc(l.label || '我的宗教')}"></label>
      <label>类型<select id="re-type">${opt(TYPES(), l.type || 'polytheist')}</select></label>
      <label>传播方式<select id="re-spread">${opt(SPREADS(), l.spread || 'missionary')}</select></label>
      <label>风格<select id="re-mode"><option value="realistic" ${l.mode !== 'fantasy' ? 'selected' : ''}>写实化名</option><option value="fantasy" ${l.mode === 'fantasy' ? 'selected' : ''}>架空</option></select></label>
      <label>适合的文明（生计大类，可多选）<span class="re-cats">${Object.entries(CAT).map(([k, n]) => `<label class="inl"><input type="checkbox" data-rcat="${k}" ${(l.cats || []).includes(k) ? 'checked' : ''}> ${n}</label>`).join('')}</span></label>
      ${NAME_KEYS.map(([k, lab]) => `<label>${lab}（用顿号、逗号或换行分隔）<textarea data-rn="${k}" rows="2">${esc((nm[k] || []).join('、'))}</textarea></label>`).join('')}
      ${CLERGY_KEYS.map(([k, lab]) => `<label>${lab}<input data-rc="${k}" value="${esc(cl[k] || '')}"></label>`).join('')}
      <label>圣徽符号<input id="re-symbol" value="${esc(l.symbol || '✦')}" maxlength="2"></label><label>圣物<input id="re-relic" value="${esc(l.relic || '')}"></label>
      <label>象征色<input type="color" id="re-color" value="${hex(l.color)}"></label></div>`,
      `<button class="btn ghost" data-lm-close>取消</button><button class="btn primary" id="re-save">保存</button>`);
    $('re-save').onclick = () => {
      const split = v => v.split(/[、,，\n]+/).map(x => x.trim()).filter(Boolean), c = $('re-color').value;
      const lib = { id: l.id && !isNew ? l.id : 'rcustom-' + Date.now().toString(36), label: $('re-label').value.trim() || '我的宗教', mode: $('re-mode').value, type: $('re-type').value, spread: $('re-spread').value,
        cats: [...document.querySelectorAll('#libModalBody [data-rcat]')].filter(x => x.checked).map(x => x.dataset.rcat), color: [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)), symbol: $('re-symbol').value.trim() || '✦', relic: $('re-relic').value.trim(), names: {}, clergy: {} };
      document.querySelectorAll('#libModalBody [data-rn]').forEach(el => lib.names[el.dataset.rn] = split(el.value));
      document.querySelectorAll('#libModalBody [data-rc]').forEach(el => lib.clergy[el.dataset.rc] = el.value.trim());
      if (!lib.names.faiths.length && !lib.names.suffix.length) { alert('至少填写教名或教名后缀'); return; }
      if (l.builtin && !isNew) { const o = get(OVR, {}); o[lib.id] = lib; put(OVR, o); close(); render(); return; }
      const cu = get(CUS, []).filter(x => x.id !== lib.id); cu.push(lib); put(CUS, cu);
      const sel = getSel() || all().map(x => x.id); if (!sel.includes(lib.id)) sel.push(lib.id); put(SEL, sel); close(); render();
    };
  }
  function bind() {
    $('relBack').onclick = () => { $('relPage').hidden = true; if (G.Home && !$('home').hidden) G.Home.renderHome(); };
    $('relTabs').addEventListener('click', e => { const b = e.target.closest('[data-rtab]'); if (b) { tab = b.dataset.rtab; render(); } });
    $('relGrid').addEventListener('change', e => { const c = e.target.closest('[data-rsel]'); if (!c) return; let sel = getSel() || all().map(l => l.id); if (c.checked) { if (!sel.includes(c.dataset.rsel)) sel.push(c.dataset.rsel); } else { if (sel.length <= 1) { c.checked = true; alert('至少选择一个宗教库'); return; } sel = sel.filter(x => x !== c.dataset.rsel); } put(SEL, sel); render(); });
    $('relGrid').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const find = id => all().find(l => l.id === id);
      if (b.dataset.rview) view(find(b.dataset.rview));
      if (b.dataset.redit) edit(find(b.dataset.redit), false);
      if (b.dataset.rcopy) { const src = find(b.dataset.rcopy); edit({ ...JSON.parse(JSON.stringify(src)), id: null, builtin: false, label: src.label.replace(/（.*?）$/, '') + '（副本）' }, true); }
      if (b.dataset.rreset && confirm('恢复这个内置宗教库的默认内容？已推演的世界不受影响。')) { const o = get(OVR, {}); delete o[b.dataset.rreset]; put(OVR, o); render(); }
      if (b.dataset.rdel && confirm('删除这个自定义宗教库？已推演的世界不受影响（保存时已冻结快照）。')) { put(CUS, get(CUS, []).filter(l => l.id !== b.dataset.rdel)); put(SEL, (getSel() || []).filter(x => x !== b.dataset.rdel)); render(); } });
    $('relAll').onclick = () => { put(SEL, all().map(l => l.id)); render(); };
    $('relNew').onclick = () => edit({ type: 'polytheist', spread: 'missionary', mode: 'fantasy', cats: ['agrarian'], names: {}, clergy: {} }, true);
    $('relExport').onclick = () => { const sel = getSel() || all().map(l => l.id); const data = { schema: 'planet-religion-libraries-v1', libraries: all().filter(l => sel.includes(l.id)).map(({ builtin: b, edited: e, ...l }) => l) }; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); a.download = '宗教库.json'; a.click(); };
    $('relImport').onclick = () => $('relFile').click();
    $('relFile').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const d = JSON.parse(await f.text()); const arr = (d.libraries || d).filter(l => l && l.names); if (!arr.length) throw new Error('文件里没有宗教库');
      const cu = get(CUS, []), sel = getSel() || all().map(l => l.id); arr.forEach((l, i) => { const lib = { ...l, id: 'rcustom-' + Date.now().toString(36) + i }; cu.push(lib); sel.push(lib.id); }); put(CUS, cu); put(SEL, sel); render(); alert(`已导入 ${arr.length} 个宗教库`); } catch (err) { alert('导入失败：' + err.message); } };
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', bind) : bind();
  load();
  G.RelLib = { show, snapshot, selectedCount, load };
})(window);
