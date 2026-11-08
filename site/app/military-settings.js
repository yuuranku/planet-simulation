/* 军事四题：放在「文明」一步，与其他推演题同样的选项卡样式。
 * 选项直接写入 state.militaryRules（每个数值均参与实际军事结算），不改动问卷编码。 */
(function (G) {
  'use strict';
  const FIRST = 23; // 接在 22 道推演题之后编号（第 22 题为游牧与部落政体占比）
  const MQ = [
    { key: 'mobilizationRate', t: '兵役与动员', unit: v => `动员约 ${+(v * 100).toFixed(1)}% 人口`, min: 0.005, max: 0.15, step: 0.005, label: '动员比例（0.005–0.15）',
      o: [[0.02, '募兵为主', '动员约 2% 人口'], [0.04, '常备与征召并用', '约 4% · 接近历史常态'], [0.08, '举国征召', '约 8% · 田间工坊劳力吃紧']] },
    { key: 'campaignDays', t: '出征时长', unit: v => `每次出征约 ${v} 日`, min: 15, max: 300, step: 5, label: '每次出征日数（15–300，按本世界日历）',
      o: [[60, '速战速决', '每次出征约 60 日'], [120, '季节性征战', '约 120 日'], [210, '长期远征', '约 210 日 · 军粮消耗大']] },
    { key: 'training', t: '军队训练', unit: v => `训练投入 ${(+v).toFixed(2)}`, min: 0, max: 1, step: 0.05, label: '训练投入（0–1）',
      o: [[0.2, '民兵为主', '训练投入 0.20'], [0.45, '常规操练', '训练投入 0.45'], [0.75, '职业军队', '0.75 · 占用更多劳力']] },
    { key: 'equipment', t: '军备与装备', unit: v => `装备投入 ${(+v).toFixed(2)}`, min: 0, max: 1, step: 0.05, label: '装备投入（0–1）',
      o: [[0.25, '简陋装备', '装备投入 0.25'], [0.5, '标准装备', '装备投入 0.50'], [0.8, '精良装备', '0.80 · 工坊负担重']] }
  ];
  // 每条提示都对应 core/military.js 中的实际结算
  const HINTS = {
    mobilizationRate: {
      0.02: [['兵力', '-', '每次出征征召约 2% 人口（守方 ×1.25）'], ['经济', '+', '留在田地和工坊的劳力多，战争对粮产拖累小'], ['战争', '-', '兵力小，攻城围困更难成形']],
      0.04: [['兵力', '·', '每次出征征召约 4% 人口（守方 ×1.25），接近前近代常态']],
      0.08: [['兵力', '+', '每次出征征召约 8% 人口（守方 ×1.25）'], ['经济', '-', '额外军粮与误工翻倍，受各地粮食余量限制'], ['人口', '+', '战役死亡人数随兵力增加']]
    },
    campaignDays: {
      60: [['战役', '-', '出征约 60 日：往返路程超过一半时长的远地部队来不及参战'], ['经济', '-', '军粮与误工按出征时长折算，负担轻'], ['疾病', '-', '军中疫病死亡少']],
      120: [['战役', '·', '出征约 120 日，常规季节性征战']],
      210: [['战役', '+', '出征约 210 日：远地部队也能集结，围城断粮更易成形'], ['经济', '+', '军粮消耗与误工明显增加'], ['疾病', '+', '军中疫病死亡增加']]
    },
    training: {
      0.2: [['战力', '-', '训练投入 0.20，战斗表现较弱'], ['战术', '-', '守军不足以袭扰粮道、设伏、佯退'], ['经济', '-', '训练占用劳力少']],
      0.45: [['战力', '·', '训练投入 0.45；实际上限受文明科技阶段限制']],
      0.75: [['战力', '+', '训练投入 0.75，侧翼迂回、佯退等战术更常出现'], ['经济', '+', '训练占用的劳力增加'], ['说明', '·', '科技阶段低的文明达不到这个上限']]
    },
    equipment: {
      0.25: [['战力', '-', '装备投入 0.25，战斗表现较弱'], ['战术', '-', '攻方难以筑垒攻城'], ['经济', '-', '装备生产占用劳力少']],
      0.5: [['战力', '·', '装备投入 0.50；实际上限受文明科技阶段限制']],
      0.8: [['战力', '+', '装备投入 0.80，筑垒攻城更常见'], ['经济', '+', '装备生产占用的劳力增加'], ['说明', '·', '科技阶段低的文明达不到这个上限']]
    }
  };
  const open = new Set(); // 正在手动填写数值的题（仅界面状态）
  const rulesOf = st => G.Military.validateRules(st.militaryRules);
  const same = (a, b) => Math.abs(a - b) < 1e-9;
  const optOf = (q, v) => q.o.findIndex(o => same(o[0], v));
  const hintOf = (key, v) => { const h = HINTS[key]; if (!h) return null; const k = Object.keys(h).find(x => same(+x, +v)); return k ? h[k] : null; };

  function html(st) {
    const r = rulesOf(st);
    return MQ.map((q, n) => {
      const v = r[q.key], idx = optOf(q, v), custom = idx < 0 || open.has(q.key);
      const opts = q.o.map((o, i) => `<button class="opt${i === idx && !custom ? ' on' : ''} has-hint" data-mil="${q.key}" data-mv="${o[0]}"><span class="k">${'ABC'[i]}</span><b>${o[1]}</b><small>${o[2]}</small><span class="hint" data-hq="mil:${q.key}" data-hv="${o[0]}" role="note" aria-label="大致影响">i</span></button>`).join('');
      return `<div class="q"><h4><em>${FIRST + n}</em>${q.t}</h4><div class="opts">${opts}</div><div class="extra"><label><input type="checkbox" data-milcu="${q.key}" ${custom ? 'checked' : ''}> 自定义数值</label>${custom ? `<label>${q.label} <input type="number" data-military="${q.key}" min="${q.min}" max="${q.max}" step="${q.step}" value="${v}" style="width:96px"></label>` : ''}</div></div>`;
    }).join('');
  }
  // 返回 true 表示需要重绘
  function click(target, st) {
    const b = target.closest('[data-mil]'); if (!b) return false;
    open.delete(b.dataset.mil);
    st.militaryRules = { ...rulesOf(st), [b.dataset.mil]: Number(b.dataset.mv) };
    return true;
  }
  function change(target, st) {
    if (target.dataset.milcu) {
      const key = target.dataset.milcu;
      if (target.checked) open.add(key);
      else { open.delete(key); const q = MQ.find(x => x.key === key); if (optOf(q, rulesOf(st)[key]) < 0) st.militaryRules = { ...rulesOf(st), [key]: G.Military.DEFAULTS[key] }; }
      return true;
    }
    if (target.dataset.military) {
      const key = target.dataset.military;
      try { st.militaryRules = G.Military.validateRules({ ...rulesOf(st), [key]: Number(target.value) }); target.setCustomValidity(''); }
      catch (error) { target.setCustomValidity(error.message); target.reportValidity(); target.value = rulesOf(st)[key]; }
      return false;
    }
    return false;
  }
  function randomize(st) {
    open.clear();
    st.militaryRules = Object.fromEntries(MQ.map(q => [q.key, q.o[(Math.random() * q.o.length) | 0][0]]));
  }
  // 设定一览中的条目
  function summary(st) {
    const r = rulesOf(st);
    return MQ.map((q, n) => { const i = optOf(q, r[q.key]); return { n: FIRST + n, t: q.t, b: i < 0 ? '自定义' : q.o[i][1], s: q.unit(r[q.key]) }; });
  }
  // 世界总结中的军事倾向
  function trend(st, fact) {
    const r = rulesOf(st), d = G.Military.DEFAULTS;
    const dir = (v, base, big) => v > base * (1 + big) ? ['↑↑', 'up'] : v > base * 1.1 ? ['↑', 'up'] : v < base / (1 + big) ? ['↓↓', 'dn'] : v < base / 1.1 ? ['↓', 'dn'] : ['·', 'mid'];
    const row = (k, v, base, big, words, note) => { const [ar, cls] = dir(v, base, big); return fact(k, ar, cls, words[cls], note); };
    const load = r.mobilizationRate / d.mobilizationRate * (r.campaignDays / d.campaignDays) * (1 + r.training * .35 + r.equipment * .4) / (1 + d.training * .35 + d.equipment * .4);
    return row('兵力规模', r.mobilizationRate, d.mobilizationRate, .6, { up: '大军征召', dn: '小股精兵', mid: '接近历史常态' }, `动员约 ${+(r.mobilizationRate * 100).toFixed(1)}% 人口`)
      + row('出征', r.campaignDays, d.campaignDays, .6, { up: '长期远征', dn: '速战速决', mid: '季节性征战' }, `每次约 ${r.campaignDays} 日`)
      + row('战力', (r.training + r.equipment) / 2, (d.training + d.equipment) / 2, .4, { up: '偏精锐', dn: '偏民兵', mid: '常规' }, `训练 ${r.training.toFixed(2)} · 装备 ${r.equipment.toFixed(2)}，上限受科技阶段限制`)
      + row('战争负担', load, 1, .8, { up: load > 1.8 ? '明显偏重' : '偏重', dn: load < 1 / 1.8 ? '明显偏轻' : '偏轻', mid: '接近常态' }, '额外军粮与误工对粮产的拖累');
  }
  G.MilitarySettings = { MQ, HINTS, hintOf, html, click, change, randomize, summary, trend, count: MQ.length, first: FIRST };
})(window);
