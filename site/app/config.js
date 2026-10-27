/* 19 道推演题与参数映射 */
(function (G) {
  'use strict';
  const POLE = [['land', '有大陆', '极地被陆地覆盖'], ['ocean', '以海洋为主', '极点处为开阔海洋'], ['random', '随机', '由推演决定'], ['separate', '单独大陆', '与宜居大陆隔海']];
  const Q = [
    { id: 'north', t: '北极是否有大陆', o: POLE, d: 'ocean' },
    { id: 'south', t: '南极是否有大陆', o: POLE, d: 'land' },
    { id: 'star', t: '恒星与光照', o: [['1260', '暖橙恒星、柔和光照', '1260 W/m²'], ['1361', '黄色恒星、类地光照', '1361 W/m²'], ['1460', '偏亮恒星、较强光照', '1460 W/m²']], d: '1361' },
    { id: 'radius', t: '星球大小', o: [['5200', '较小类地星球', '半径 5200 公里'], ['6400', '约地球大小', '半径 6400 公里'], ['8000', '较大类地星球', '半径 8000 公里']], d: '6400' },
    { id: 'day', t: '一天多长', o: [['20', '20 小时', '环流带更窄'], ['26', '26 小时', '接近地球'], ['32', '32 小时', '哈德来环流更宽']], d: '26' },
    { id: 'spin', t: '自转方向', o: [['pro', '顺行', '盛行西风带'], ['retro', '逆行', '风带与洋流反向'], ['random', '随机', '由推演决定']], d: 'pro' },
    { id: 'orbit', t: '公转与季节', o: [['A', '一年 360 日', '轴倾角 12°'], ['B', '一年 320 日', '轴倾角 18°'], ['C', '一年 420 日', '轴倾角 28°']], d: 'B' },
    { id: 'moons', t: '卫星与星环', o: [['one', '一颗主要卫星', '潮差大 · 河口多三角湾与潮滩'], ['many', '多颗小卫星', '潮差中等'], ['none', '无卫星', '几乎无潮汐 · 河口三角洲发育'], ['ring', '仅主星环', '无卫星 · 星环投影降温']], d: 'one' },
    { id: 'plates', t: '板块与构造', o: [['8', '8 块', '偏稳定'], ['14', '14 块', '中等活动'], ['20', '20 块', '活动较强']], d: '14' },
    { id: 'land', t: '陆地占比', o: [['0.25', '25%', '海洋世界'], ['0.35', '35%', '接近地球'], ['0.45', '45%', '大陆世界']], d: '0.35' },
    { id: 'structure', t: '大陆总体结构', o: [['A', '偏聚合', '3–5 个大陆核心'], ['B', '相对分散', '6–8 个大陆核心'], ['C', '裂解附属陆块丰富', '9–12 个核心']], d: 'B' },
    { id: 'coast', t: '海岸与岛屿倾向', o: [['A', '完整陆缘', '岛链适量'], ['B', '海湾半岛与岛弧均衡', '介于两者之间'], ['C', '破碎陆缘', '丰富岛链和群岛']], d: 'B' },
    { id: 'interior', t: '内陆地形倾向', o: [['A', '低地较广', '平原与缓丘'], ['B', '山系、高原与盆地多样', '起伏丰富'], ['C', '山地较多', '崎岖多山']], d: 'B' },
    { id: 'era', t: '文明时代与人口约束', o: [['A', '前工业', '人口 1 亿–1.6 亿'], ['B', '前工业', '人口 2.5 亿–4 亿'], ['C', '早期工业', '人口 6.5 亿–9.5 亿']], d: 'B', extra: 'pop' },
    { id: 'culture', t: '文化与宗教复杂度', o: [['A', '8 个文化圈', '12 种语言 · 6 个宗教'], ['B', '14 个文化圈', '24 种语言 · 10 个宗教'], ['C', '20 个文化圈', '36 种语言 · 16 个宗教']], d: 'B' },
    { id: 'politics', t: '政治格局与部落空间', o: [['A', '约 45 国', '部落游牧空间 25%'], ['B', '约 80 国', '部落游牧空间 35%'], ['C', '约 120 国', '部落游牧空间 45%']], d: 'B' },
    { id: 'towns', t: '城市、省份与交通', o: [['A', '疏朗', '480 城镇 · 行政粗分 · 基础交通'], ['B', '标准', '720 城镇 · 标准行政与交通'], ['C', '密集', '1080 城镇 · 行政细分 · 完善交通']], d: 'B', extra: 'towns' },
    { id: 'climate', t: '气候调节——冷热与水汽', o: [['A', '类地平均', '参考温偏 ±0 °C · 水汽 1.0×'], ['B', '偏热偏湿润', '+3 °C · 1.1×'], ['C', '更热更湿润', '+6 °C · 1.2×'], ['D', '偏冷偏干燥', '−3 °C · 0.9×'], ['E', '很冷很干燥', '−6 °C · 0.8×']], d: 'A', extra: 'climate' },
    { id: 'newWorld', t: '是否有新大陆', o: [['yes', '有新大陆', '远隔大洋、晚接触的陆块'], ['no', '没有新大陆', '所有大陆同属旧世界'], ['random', '随机', '由推演决定']], d: 'random' },
    { id: 'lakes', t: '湖泊与内陆水体', o: [['A', '湖泊稀少', '排水通畅 · 湖面约为类地的一半'], ['B', '类地', '湖面约占陆地 1.3–1.8%（地球实测 1.8%）'], ['C', '湖泊众多', '冰川湖区般 · 约为类地的两倍']], d: 'B' }
  ];
  const N_ = (key, label, def, min, max, step = 1) => ({ key, label, def, min, max, step });
  const CUSTOM = {
    north: [N_('areaPercent', '北极大陆占星球表面积（%）', 3.5, 0.5, 10, 0.1)],
    south: [N_('areaPercent', '南极大陆占星球表面积（%）', 3.5, 0.5, 10, 0.1)],
    star: [N_('solarConstantWm2', '辐照度（W/m²）', 1361, 800, 1800, 0.1)],
    radius: [N_('radiusKm', '星球半径（公里）', 6400, 3000, 10000)],
    day: [N_('rotationPeriodHours', '一天长度（小时）', 26, 6, 96, 0.1)],
    orbit: [N_('orbitalPeriodDays', '一年长度（世界日）', 320, 60, 1200, 0.1), N_('axialTiltDegrees', '轴倾角（°）', 18, 0, 90, 0.1)],
    moons: [N_('moonCount', '卫星数量（无主星环）', 3, 0, 8)],
    plates: [N_('plateCount', '板块数量', 14, 4, 32), N_('tectonicActivity', '构造活动程度', 0.34, 0, 1, 0.01)],
    land: [N_('landPercent', '陆地占比（%）', 35, 18, 55, 0.1)],
    structure: [N_('continentCount', '大陆核心数量', 7, 3, 12)],
    culture: [N_('civilizationCount', '文化圈数量', 14, 1, 40), N_('languageCount', '语言数量', 24, 1, 80), N_('religionCount', '宗教数量', 10, 1, 40)],
    politics: [N_('stateCount', '国家数量', 80, 1, 240), N_('frontierPercent', '部落与非国家空间（%）', 35, 0, 90, 0.1)]
  };
  const PAGES = [
    { t: '星球与恒星', q: [0, 1, 2, 3, 4] },
    { t: '运转与卫星', q: [5, 6, 7] },
    { t: '地质与大陆', q: [8, 9, 10, 11, 12] },
    { t: '文明', q: [13, 14, 15, 16] },
    { t: '气候、水体与新大陆', q: [17, 19, 18], final: true }
  ];
  const CLIMATE = { A: [0, 1], B: [3, 1.1], C: [6, 1.2], D: [-3, 0.9], E: [-6, 0.8] };
  const ERA_RANGE = [[1, 1.6], [2.5, 4], [6.5, 9.5]];

  function defaults() {
    const a = {}; for (const q of Q) a[q.id] = q.d;
    return {
      a, seed: (Math.random() * 1e9) | 0, res: null,
      popMode: 'env', popLo: null, popHi: null,
      townsCustom: false, townsN: 720, admin: 1, transport: 1,
      climateCustom: false, tempBias: 0, moisture: 1, custom: {}
    };
  }
  function randomize(st) {
    const r = Math.random;
    for (const q of Q) st.a[q.id] = q.o[(r() * q.o.length) | 0][0];
    st.seed = (r() * 1e9) | 0;
    st.townsCustom = false; st.climateCustom = false; st.popMode = 'env'; st.custom = {};
    return st;
  }
  function toCfg(st) {
    const a = st.a, rnd = mulberry(st.seed ^ 0x5bd1e995);
    const idx = (id) => ({ A: 0, B: 1, C: 2, D: 3, E: 4 })[a[id]];
    const era = idx('era');
    const tw = idx('towns');
    const cl = CLIMATE[a.climate];
    let W = 0, H = 0;
    const orbit = { A: [360, 12], B: [320, 18], C: [420, 28] }[a.orbit];
    const cult = { A: [8, 12, 6], B: [14, 24, 10], C: [20, 36, 16] }[a.culture];
    const pol = { A: [45, 0.25], B: [80, 0.35], C: [120, 0.45] }[a.politics];
    const range = ERA_RANGE[era];
    let popRange = null;
    if (st.popMode === 'range') {
      const lo = Math.max(range[0], Math.min(range[1], +st.popLo || range[0])), hi = Math.max(lo, Math.min(range[1], +st.popHi || range[1]));
      popRange = [lo * 1e8, hi * 1e8];
    }
    const cu = (q, k) => { const o = st.custom && st.custom[q]; return o && o.on && o.v && o.v[k] !== undefined && o.v[k] !== '' && isFinite(+o.v[k]) ? +o.v[k] : undefined; };
    const pick = (v, d) => v === undefined ? d : v;
    const moonCount = cu('moons', 'moonCount');
    const out = {
      seed: st.seed, W, H,
      northPole: a.north, southPole: a.south,
      flux: +a.star, radius: +a.radius, day: +a.day,
      retro: a.spin === 'retro' || (a.spin === 'random' && rnd() < 0.5),
      yearDays: orbit[0], tilt: orbit[1], moons: a.moons,
      plates: +a.plates, activity: { 8: 0.78, 14: 1, 20: 1.25 }[a.plates],
      land: +a.land, cores: { A: [3, 5], B: [6, 8], C: [9, 12] }[a.structure], coreSpread: { A: 62, B: 100, C: 160 }[a.structure],
      coast: idx('coast'), interior: idx('interior'), structIdx: idx('structure'),
      era, popMode: st.popMode, popRange,
      cultures: cult[0], languages: cult[1], religions: cult[2],
      countries: pol[0], tribal: pol[1],
      towns: st.townsCustom ? Math.max(100, Math.min(2000, +st.townsN || 720)) : [480, 720, 1080][tw],
      admin: st.townsCustom ? +st.admin : tw, transport: st.townsCustom ? +st.transport : tw,
      tempBias: st.climateCustom ? +st.tempBias : cl[0], moisture: st.climateCustom ? +st.moisture : cl[1],
      lakeFactor: { A: 0.45, B: 1, C: 2.2 }[a.lakes || 'B'],
      newWorld: a.newWorld === 'yes' ? true : a.newWorld === 'no' ? false : 'random'
    };
    // 文化库快照（所选内置库 id + 自定义库内容）
    if (st.libs) { out.cultureSelection = st.libs.ids; out.customLibraries = st.libs.custom || []; }
    // 自定义数值覆盖（与原版问卷的“自定义”字段一致）
    out.polarArea = { N: cu('north', 'areaPercent'), S: cu('south', 'areaPercent') };
    out.flux = pick(cu('star', 'solarConstantWm2'), out.flux); out.radius = pick(cu('radius', 'radiusKm'), out.radius);
    // 网格精度由星球大小决定：每格约 18.5 km（与原版类地星球 2176 格一致），宽度取 544 的整数倍
    out.W = st.res || gridFor(out.radius); out.H = out.W / 2; out.day = pick(cu('day', 'rotationPeriodHours'), out.day);
    out.yearDays = pick(cu('orbit', 'orbitalPeriodDays'), out.yearDays); out.tilt = pick(cu('orbit', 'axialTiltDegrees'), out.tilt);
    if (a.moons !== 'ring') { out.moonCount = moonCount; if (moonCount !== undefined) out.moons = moonCount === 0 ? 'none' : moonCount === 1 ? 'one' : 'many'; }
    const pc = cu('plates', 'plateCount'), act = cu('plates', 'tectonicActivity'); if (pc) out.plates = Math.round(pc); if (act !== undefined) out.activity = 0.55 + 1.3 * act;
    const lp = cu('land', 'landPercent'); if (lp) out.land = lp / 100;
    const cc = cu('structure', 'continentCount'); if (cc) out.cores = [Math.round(cc), Math.round(cc)];
    const cv = cu('culture', 'civilizationCount'), lv = cu('culture', 'languageCount'), rv = cu('culture', 'religionCount'); if (cv) out.cultures = Math.round(cv); if (lv) out.languages = Math.round(lv); if (rv) out.religions = Math.round(rv);
    const sc = cu('politics', 'stateCount'), fp = cu('politics', 'frontierPercent'); if (sc) out.countries = Math.round(sc); if (fp !== undefined) out.tribal = fp / 100;
    return out;
  }
  function gridFor(radiusKm) { const k = Math.round(2 * Math.PI * radiusKm / 18.48 / 544); return 544 * Math.max(2, Math.min(5, k)); }
  function gridOf(st) { const r = st.custom && st.custom.radius && st.custom.radius.on && isFinite(+st.custom.radius.v.radiusKm) ? +st.custom.radius.v.radiusKm : +st.a.radius; const W = st.res || gridFor(r); return { W, H: W / 2, km: 2 * Math.PI * r / W }; }
  function mulberry(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // URL：#w=<答案串>&s=<种子>&r=<分辨率>&x=<附加>
  function encode(st) {
    let ans = Q.map(q => q.o.findIndex(o => o[0] === st.a[q.id])).join('');
    if (st.a.lakes === 'B' || !st.a.lakes) ans = ans.slice(0, 19); // 第 20 题为默认时保持旧链接与旧存档的键不变
    const cj = Object.entries(st.custom || {}).filter(([, o]) => o.on).map(([q, o]) => q + ':' + Object.entries(o.v || {}).map(([k, v]) => k + '=' + v).join(',')).join(';');
    const x = [cj ? 'u' + encodeURIComponent(cj) : '', st.popMode === 'range' ? `p${st.popLo}-${st.popHi}` : '', st.townsCustom ? `t${st.townsN}-${st.admin}-${st.transport}` : '', st.climateCustom ? `c${st.tempBias}_${st.moisture}` : ''].filter(Boolean).join('~');
    const q = new URLSearchParams({ w: ans, s: st.seed }); if (st.res) q.set('r', st.res);
    if (x) q.set('x', x);
    if (st.libs && st.libs.ids) q.set('l', st.libs.ids.join('.'));
    return q.toString();
  }
  function decode(hash) {
    const q = new URLSearchParams(hash.replace(/^#/, ''));
    if (!q.get('w') || !q.get('s')) return null;
    const st = defaults(), ans = q.get('w');
    Q.forEach((qq, i) => { const k = +ans[i]; if (qq.o[k]) st.a[qq.id] = qq.o[k][0]; });
    st.seed = +q.get('s') | 0;
    const r = +q.get('r'); if ([1088, 1632, 2176, 2720].includes(r)) st.res = r; // 旧存档沿用原网格
    if (q.get('l')) st.libs = { ids: q.get('l').split('.').filter(Boolean), custom: [] };
    for (const part of (q.get('x') || '').split('~')) {
      if (part[0] === 'u') { st.custom = {}; for (const seg of decodeURIComponent(part.slice(1)).split(';')) { const [q, kv] = seg.split(':'); if (!q) continue; const v = {}; (kv || '').split(',').forEach(p => { const [k, val] = p.split('='); if (k) v[k] = +val; }); st.custom[q] = { on: true, v }; } }
      if (part[0] === 'p') { const [lo, hi] = part.slice(1).split('-'); st.popMode = 'range'; st.popLo = +lo; st.popHi = +hi; }
      if (part[0] === 't') { const [n, ad, tr] = part.slice(1).split('-'); st.townsCustom = true; st.townsN = +n; st.admin = +ad; st.transport = +tr; }
      if (part[0] === 'c') { const [tb, mo] = part.slice(1).split('_'); st.climateCustom = true; st.tempBias = +tb; st.moisture = +mo; }
    }
    return st;
  }
  G.Config = { Q, PAGES, CUSTOM, defaults, randomize, toCfg, encode, decode, ERA_RANGE, CLIMATE, gridFor, gridOf };
})(window);
