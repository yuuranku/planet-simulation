(function (G) {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const titles = { culture: '文化理念', religion: '宗教信条', species: '种族天赋' };
  const valenceLabel = { positive: '有利', negative: '不利', mixed: '利弊并存' };
  const catalog = scope => G.HumanRules.TRAITS.filter(t => t.scope === scope);
  const conflicts = (a, b) => (a.conflicts || []).includes(b.id) || (b.conflicts || []).includes(a.id);
  const VCLS = { positive: 'pos', negative: 'neg', mixed: 'mix' };
  function editor(scope, traits) {
    const items = catalog(scope), selected = new Set((traits || []).map(t => t.id)), groups = new Map();
    for (const item of items) { const name = item.group || '其他'; if (!groups.has(name)) groups.set(name, []); groups.get(name).push(item); }
    const content = [...groups].map(([group, options]) => {
      const count = options.filter(t => selected.has(t.id)).length;
      return `<section data-trait-group class="tgroup"><h6>${esc(group)} <small data-trait-group-count>已选 ${count} / ${options.length}</small></h6><div class="tgrid">${options.map(t => `<div class="tcell"><label class="tchip ${VCLS[t.valence]}"><input type="checkbox" data-trait-check="${esc(t.id)}" ${selected.has(t.id) ? 'checked' : ''}><span class="tbox"></span><span class="ttxt"><b>${esc(t.label)}<em>${esc(valenceLabel[t.valence])}</em></b><small>${esc(t.description)}</small></span></label><p id="trait-hint-${esc(scope)}-${esc(t.id)}" data-trait-conflict="${esc(t.id)}" aria-live="polite" hidden class="thint"></p></div>`).join('')}</div></section>`;
    }).join('');
    return `<fieldset data-trait-editor="${esc(scope)}" class="tedit"><legend>${esc(titles[scope])}</legend><p class="tedit-head"><span data-trait-count>已选 ${selected.size} / ${items.length}</span><span class="tkey"><i class="pos"></i>有利<i class="mix"></i>利弊并存<i class="neg"></i>不利</span></p><p class="tedit-note">勾选后按完整效果生效；互斥的词条要先取消已选的那一个。</p>${content}</fieldset>`;
  }
  // 卡片上的词条小标签
  function chips(scope, traits, max = 6) {
    const list = (traits || []).map(v => G.HumanRules.TRAITS.find(x => x.id === v.id && x.scope === scope)).filter(Boolean);
    if (!list.length) return `<div class="tchips"><span class="none">无${esc(titles[scope])}</span></div>`;
    return `<div class="tchips">${list.slice(0, max).map(t => `<span class="${VCLS[t.valence]}" title="${esc(t.description)}">${esc(t.label)}</span>`).join('')}${list.length > max ? `<span class="more">+${list.length - max}</span>` : ''}</div>`;
  }
  function refresh(root) {
    const field = root.querySelector('[data-trait-editor]'); if (!field) return;
    const items = catalog(field.dataset.traitEditor), byId = new Map(items.map(t => [t.id, t]));
    const inputs = [...field.querySelectorAll('[data-trait-check]')], selected = inputs.filter(x => x.checked).map(x => byId.get(x.dataset.traitCheck)).filter(Boolean);
    for (const input of inputs) {
      const item = byId.get(input.dataset.traitCheck), others = selected.filter(t => t.id !== item.id && conflicts(item, t));
      input.disabled = !input.checked && others.length > 0;
      const hint = input.closest('div').querySelector('[data-trait-conflict]');
      hint.hidden = !others.length;
      hint.textContent = others.length ? `与「${others.map(t => t.label).join('、')}」互斥${input.checked ? '，请取消其中一项' : '；需先取消已选项'}` : '';
      const label = input.closest('label');
      label.classList.toggle('off', input.disabled);
      if (others.length) { label.title = hint.textContent; input.setAttribute('aria-describedby', hint.id); }
      else { label.removeAttribute('title'); input.removeAttribute('aria-describedby'); }
    }
    field.querySelector('[data-trait-count]').textContent = `已选 ${selected.length} / ${items.length}`;
    field.querySelectorAll('[data-trait-group]').forEach(group => {
      const checks = [...group.querySelectorAll('[data-trait-check]')];
      group.querySelector('[data-trait-group-count]').textContent = `已选 ${checks.filter(x => x.checked).length} / ${checks.length}`;
    });
  }
  function read(root) {
    const field = root.querySelector('[data-trait-editor]'); if (!field) return [];
    const byId = new Map(catalog(field.dataset.traitEditor).map(t => [t.id, t]));
    const selected = [...field.querySelectorAll('[data-trait-check]:checked')].map(el => byId.get(el.dataset.traitCheck));
    for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) if (conflicts(selected[i], selected[j])) throw Error(`「${selected[i].label}」与「${selected[j].label}」互斥`);
    return selected.map(t => ({ id: t.id, strength: 1 }));
  }
  function view(scope, traits) { const rows = (traits || []).map(v => { const t = G.HumanRules.TRAITS.find(x => x.id === v.id && x.scope === scope); return t ? `<li class="${VCLS[t.valence]}"><b>${esc(t.label)}<em>${esc(valenceLabel[t.valence])}</em></b><small>${esc(t.description)}</small></li>` : `<li><b>${esc(v.id)}</b></li>`; }); return `<h5>${esc(titles[scope])} <small>${rows.length} 条</small></h5>${rows.length ? `<ul class="tview">${rows.join('')}</ul>` : '<p class="names">无</p>'}`; }
  function fitForm(root) {
    const field = root.querySelector('[data-trait-editor]');
    if (field) { field.addEventListener('change', e => { if (e.target.matches('[data-trait-check]')) refresh(root); }); refresh(root); }
    if (!window.matchMedia('(max-width: 440px)').matches) return;
    const form = root.querySelector('.lform'); if (!form) return;
    form.style.gridTemplateColumns = 'repeat(2, minmax(0, 1fr))';
    form.querySelectorAll('label, fieldset, details').forEach(el => { el.style.minWidth = '0'; });
    form.querySelectorAll('input:not([type=checkbox]):not([type=color]), select, textarea').forEach(el => { el.style.minWidth = '0'; el.style.maxWidth = '100%'; el.style.boxSizing = 'border-box'; });
  }
  G.TraitEditor = { editor, read, view, fitForm, chips };
})(window);
