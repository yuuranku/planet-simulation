(function (G) {
  'use strict';
  const $ = id => document.getElementById(id), clone = x => JSON.parse(JSON.stringify(x));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const SEL = 'planet-species-selection-v2', CUS = 'planet-species-custom-v2', OVR = 'planet-species-override-v2';
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } };
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const all = () => { const o = get(OVR, {}); return G.HumanRules.SPECIES.map(l => ({ ...(o[l.id] || l), builtin: true, edited: !!o[l.id] })).concat(get(CUS, []).map(l => ({ ...l, builtin: false }))); };
  function selection(libs = all()) { const stored = get(SEL, null), ids = new Set(libs.map(l => l.id)), selected = [...new Set((Array.isArray(stored) ? stored : []).filter(id => ids.has(id)))];
    if (!selected.length) selected.push('human');
    if (stored !== null && JSON.stringify(stored) !== JSON.stringify(selected)) put(SEL, selected);
    return selected;
  }
  function snapshot() { const libs = all(), sel = selection(libs); const libraries = libs.filter(l => sel.includes(l.id)).map(({ builtin, edited, ...l }) => clone(l)); if (!libraries.length) throw new Error('至少选择一个种族'); libraries.forEach(l => G.HumanRules.validateLibrary(l, 'species')); return { libraries }; }
  function selectedCount() { return selection().length; }
  const traitSummary = l => (l.traits || []).map(t => G.HumanRules.TRAITS.find(x => x.id === t.id && x.scope === 'species')?.label || t.id).join('、') || '无';
  function modal(title, body, foot = '') { $('libModalBody').innerHTML = `<header class="lm-head"><h3>${esc(title)}</h3><button class="x" data-lm-close>×</button></header><div class="lm-body">${body}</div><footer class="lm-foot">${foot}</footer>`; $('libModal').hidden = false; }
  function show() { $('speciesPage').hidden = false; render(); }
  function render() { const libs = all(), sel = selection(libs);
    $('speciesSummary').textContent = `已选 ${sel.length} / ${libs.length} 个种族。生理参数与天赋影响适居性、食物需求、迁徙、劳动和战斗；文化和信仰可独立变化。`;
    $('speciesGrid').innerHTML = libs.map(l => `<div class="lcard${sel.includes(l.id) ? ' on' : ''}"><label class="lcheck"><input type="checkbox" data-ssel="${esc(l.id)}" ${sel.includes(l.id) ? 'checked' : ''}><span></span></label><div class="lmain"><b>${esc(l.label)}</b><small>${l.builtin ? '内置' + (l.edited ? ' · 已修改' : '') : '自定义'}</small>${l.description ? `<p>${esc(l.description)}</p>` : ''}<dl class="sstats"><div><dt>适温</dt><dd>${esc(l.temperature.join('～'))}°C</dd></div><div><dt>成年</dt><dd>${l.life.maturity} 岁</dd></div><div><dt>衰老</dt><dd>${l.life.oldAge} 岁</dd></div><div><dt>寿限</dt><dd>${l.life.maximum} 岁</dd></div><div><dt>山地</dt><dd>×${esc(l.mountainMobility)}</dd></div><div><dt>食量</dt><dd>×${esc(l.foodNeed)}</dd></div></dl>${G.TraitEditor.chips('species', l.traits, 5)}<div class="lact"><button data-sview="${esc(l.id)}">查看</button><button data-sedit="${esc(l.id)}">编辑</button><button data-scopy="${esc(l.id)}">复制为自定义</button>${l.builtin ? (l.edited ? `<button data-sreset="${esc(l.id)}">恢复默认</button>` : '') : `<button class="danger" data-sdel="${esc(l.id)}">删除</button>`}</div></div></div>`).join(''); }
  function view(l) { modal(l.label, `${l.description ? `<p>${esc(l.description)}</p>` : ''}<p>适温 ${esc(l.temperature.join('～'))} °C；山地通行 ${esc(l.mountainMobility)}；食物需求 ${esc(l.foodNeed)}</p><p>成年 ${l.life.maturity}、衰老 ${l.life.oldAge}、寿命上限 ${l.life.maximum} 生理年；人物按世界历法换算。</p>${G.TraitEditor.view('species', l.traits)}`); }
  const lifeFields = {maturity:'成年年龄',oldAge:'衰老年龄',maximum:'寿命上限',infantMortality:'幼年年死亡风险',adultMortality:'成年年死亡风险',oldAgeMortality:'衰老额外年风险'};
  function lifeForm(life) { return '<p style="grid-column:1/-1">年龄按 365.25 个 24 小时日为一生理年，人物会换算世界年长。死亡风险为年危险率；寿命是分布，不是固定死期。</p>'+Object.entries(lifeFields).map(([key,label])=>`<label>${label}<input id="se-life-${key}" type="number" min="0" step="${key.endsWith('Mortality')?'.001':'1'}" value="${life[key]}"></label>`).join(''); }
  function edit(l, fresh) { const color = '#' + (l.color || [120,120,120]).map(x => x.toString(16).padStart(2,'0')).join('');
    modal(fresh ? '新建种族' : '编辑：' + l.label, `<div class="lform"><label>名称<input id="se-label" value="${esc(l.label || '')}"></label><label>颜色<input type="color" id="se-color" value="${color}"></label><label style="grid-column:1 / -1">简介（选填，最多300字）<textarea id="se-description" rows="3" maxlength="300">${esc(l.description || '')}</textarea></label><label>适宜最低温度（°C）<input id="se-min" type="number" value="${l.temperature[0]}"></label><label>适宜最高温度（°C）<input id="se-max" type="number" value="${l.temperature[1]}"></label><label>山地通行能力（0.5～2）<input id="se-mountain" type="number" min="0.5" max="2" step="0.1" value="${l.mountainMobility}"></label><label>食物需求（0.5～2）<input id="se-food" type="number" min="0.5" max="2" step="0.1" value="${l.foodNeed}"></label>${lifeForm(l.life)}${G.TraitEditor.editor('species', l.traits)}</div>`, '<button class="btn ghost" data-lm-close>取消</button><button class="btn primary" id="se-save">保存</button>');
    G.TraitEditor.fitForm($('libModalBody'));
    $('se-save').onclick = () => { try { const c = $('se-color').value; const lib = { id: fresh ? 'species-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) : l.id, label: $('se-label').value.trim(), description: $('se-description').value.trim(), color: [1,3,5].map(i => parseInt(c.slice(i,i+2),16)), temperature: [Number($('se-min').value), Number($('se-max').value)], mountainMobility: Number($('se-mountain').value), foodNeed: Number($('se-food').value), life:Object.fromEntries(Object.keys(lifeFields).map(key=>[key,Number($('se-life-'+key).value)])), traits: G.TraitEditor.read($('libModalBody')) }; G.HumanRules.validateLibrary(lib,'species'); if (l.builtin && !fresh) { const o = get(OVR,{}); o[lib.id] = lib; put(OVR,o); } else { const cu = get(CUS,[]).filter(x => x.id !== lib.id), sel = selection(); cu.push(lib); if (!sel.includes(lib.id)) sel.push(lib.id); put(CUS,cu); put(SEL,sel); } $('libModal').hidden = true; render(); } catch(e) { alert('保存失败：' + e.message); } };
  }
  function bind() {
    $('speciesBack').onclick = () => { $('speciesPage').hidden = true; if (G.Home && !$('home').hidden) G.Home.renderHome(); };
    $('speciesAll').onclick = () => { put(SEL, all().map(l => l.id)); render(); };
    $('speciesNew').onclick = () => edit({ label:'', description:'', color:[100,150,100], temperature:[0,30], mountainMobility:1, foodNeed:1, life:{...G.HumanRules.LIFE_DEFAULTS}, traits:[] }, true);
    $('speciesGrid').addEventListener('change', e => { const c = e.target.closest('[data-ssel]'); if (!c) return; let sel = selection(); if (c.checked) sel = [...new Set([...sel,c.dataset.ssel])]; else { if (sel.length <= 1) { c.checked = true; alert('至少选择一个种族'); return; } sel = sel.filter(x => x !== c.dataset.ssel); } put(SEL,sel); render(); });
    $('speciesGrid').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const lib = all().find(l => l.id === (b.dataset.sview || b.dataset.sedit || b.dataset.scopy || b.dataset.sreset || b.dataset.sdel)); if (!lib) return;
      if (b.dataset.sview) view(lib); if (b.dataset.sedit) edit(lib,false); if (b.dataset.scopy) edit({ ...clone(lib), label: lib.label + '（副本）', builtin:false },true);
      if (b.dataset.sreset && confirm('恢复默认种族设定？')) { const o = get(OVR,{}); delete o[lib.id]; put(OVR,o); render(); }
      if (b.dataset.sdel && confirm('删除这个自定义种族？已保存世界的快照不受影响。')) { const sel = selection(); if (sel.includes(lib.id) && sel.length <= 1) { alert('至少保留一个已选择的种族'); return; } put(CUS,get(CUS,[]).filter(x => x.id !== lib.id)); put(SEL,sel.filter(x => x !== lib.id)); render(); }
    });
    $('speciesExport').onclick = () => { const data = { schema:'planet-species-libraries-v2', libraries:snapshot().libraries }; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})); a.download='种族库.json'; a.click(); URL.revokeObjectURL(a.href); };
    $('speciesImport').onclick = () => $('speciesFile').click();
    $('speciesFile').onchange = async e => { const f=e.target.files[0]; e.target.value=''; if (!f) return; try { const d=JSON.parse(await f.text()), arr=d.libraries || d; if (!Array.isArray(arr) || !arr.length) throw new Error('文件里没有种族库'); const seen=new Set(all().map(l => l.id)); for(const l of arr) { G.HumanRules.validateLibrary(l,'species'); if(seen.has(l.id)) throw new Error('库 ID 已存在：'+l.id+'；已存在的库不会被覆盖。可复制为自定义库或使用其他 ID。'); seen.add(l.id); } const cu=get(CUS,[]), sel=selection(); for(const {builtin,edited,...l} of arr) { cu.push(l); sel.push(l.id); } put(CUS,cu); put(SEL,sel); render(); } catch(err) { alert('导入失败：'+err.message); } };
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded',bind) : bind();
  G.SpeciesLib = { show, snapshot, selectedCount };
})(window);
