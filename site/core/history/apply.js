/* 历史与现在互为因果：世界生成时，历史从文明之初自由推演到现在，它的终局写回现在的地图。
 *  - 现在的国家、疆域、首都、国名、政体 = 历史终局中存活的政权；
 *  - 现在的省份、省名、治所 = 历史终局的行政区划；
 *  - 现在的文化、宗教分布 = 历史终局（迁徙、同化、传教之后）；
 *  - 国界与省界 = 历史区块边界在全分辨率地形上按“山川形便”细化后的结果（与时间线最后一年完全同一套边界）；
 *  - 实际治理、名义宣称、部族地带随之重算。
 * 原先人文推演生成的政治地图只作为自然倾向：历史区块按它的省份分区来切，边疆的荒野仍是部族地带。 */
(function (G) {
  'use strict';
  const FORM_LABEL = { monarchy: '君主制王国', empire: '帝国', republic: '共和国', cityRepublic: '城邦', nomadic: '游牧政体（松散）', tribal: '部落政体（松散）', primitive: '落后政体（松散）', chiefdom: '酋邦', league: '联盟', theocracy: '神权政体（政教合一）', vassal: '附庸国（自有疆土与朝廷，向宗主称臣）' };

  // 附庸配色：与宗主同色系（色相相近），但深浅、色相明显不同——附庸是另一个国家；与历史时间线同一公式
  function vassalTint(L, id) {
    const r = L[0] / 255, g = L[1] / 255, b = L[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0, s = 0;
    if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4); }
    const a = ((id * 2654435761) >>> 0) % 4, dh = [-5, 4, -3, 6][a], dl = (l > 0.7 ? -1 : 1) * (0.075 + 0.025 * (a % 2)); // 附庸：沿用宗主色相（仅微调），只调深浅——一眼看出同属一个宗藩体系
    h = (((h + dh) % 360) + 360) % 360 / 360; const s2 = Math.max(0.18, Math.min(0.66, s * 0.82)), l2 = Math.max(0.42, Math.min(0.86, l + dl));
    const f = n => { const k = (n + h * 12) % 12, aa = s2 * Math.min(l2, 1 - l2); return Math.round(255 * (l2 - aa * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; }

  // 全分辨率细化后被切断的内陆碎片（不临海、远小于本土）：并入接壤最多的邻国，省份取接壤处的省
  function dropSlivers(F, PF, W, H, land, elev) {
    const N = W * H, comp = new Int32Array(N), st = new Int32Array(N), isLand = i => land ? land[i] : elev[i] > 0, comps = [];
    const nb = (i, fn) => { const y = (i / W) | 0, x = i - y * W; if (y > 0) fn(i - W); if (y < H - 1) fn(i + W); fn(y * W + (x + 1) % W); fn(y * W + (x - 1 + W) % W); };
    for (let s = 0; s < N; s++) { const k = F[s]; if (k < 0 || comp[s]) continue; const id = comps.length + 1, cells = []; let t = 0; st[t++] = s; comp[s] = id;
      while (t) { const i = st[--t]; cells.push(i); nb(i, j => { if (!comp[j] && F[j] === k) { comp[j] = id; st[t++] = j; } }); }
      comps.push({ k, cells }); }
    const main = new Map(); comps.forEach((c, i) => { const m = main.get(c.k); if (m === undefined || c.cells.length > comps[m].cells.length) main.set(c.k, i); });
    comps.forEach((c, ci) => { const m = main.get(c.k); if (m === ci || c.cells.length > 0.3 * comps[m].cells.length || c.cells.length > 2500) return;
      const cnt = new Map(), pv = new Map(); let sea = false;
      for (const i of c.cells) nb(i, j => { if (comp[j] === ci + 1) return; if (!isLand(j)) sea = true; const o = F[j]; if (o >= 0) { cnt.set(o, (cnt.get(o) || 0) + 1); if (PF[j] >= 0) pv.set(o * 65536 + PF[j], (pv.get(o * 65536 + PF[j]) || 0) + 1); } });
      if (sea) return; let q = -1, qv = 0; for (const [o, v] of cnt) if (v > qv) { qv = v; q = o; } if (q < 0) return;
      let pq = -1, pvv = 0; for (const [key, v] of pv) if (Math.floor(key / 65536) === q && v > pvv) { pvv = v; pq = key % 65536; }
      for (const i of c.cells) { F[i] = q; PF[i] = pq; } });
  }

  const LOOSE_UNIT = { nomadic: ['nomad', 'pastoral'], tribal: ['tribe', 'forest'], primitive: ['clan', 'foraging'] };
  function looseUnits(Cv, h, R, Hc, countries, state, regionPopulation, tribe, tribes) {
    const N = h.N, W = h.W, NB = h.NB, nR = R.nR, used = new Set(tribes.map(t => t.name)), D = Hc.D;
    for (const c of Cv.countries || []) if (c && c.name) used.add(c.name);
    let seed = (h.seed | 0) + 4099; const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const libOfCiv = c => c >= 0 ? h.civLib[c] : c <= -2 && D.ancient[-2 - c] ? D.ancient[-2 - c].libObj : null;
    const regs = new Map(); for (let r = 1; r <= nR; r++) { const p = Hc.Pol.end.owner[r]; if (p < 0) continue; const k = Hc.Pol.end.countryOfP[p]; if (k < 0 || !countries[k] || !countries[k].loose) continue; if (!regs.has(k)) regs.set(k, []); regs.get(k).push(r); }
    const unitOfR = new Int32Array(nR + 1).fill(-1);
    for (const [k, list] of regs) { const c = countries[k], lib = libOfCiv(c.civ >= 0 ? c.civ : -1) || h.civLib.find(Boolean), key = LOOSE_UNIT[c.loose] || LOOSE_UNIT.tribal;
      const sufs = G.CultureExt && G.CultureExt.looseTitles ? G.CultureExt.looseTitles(lib, key[0]) : ['部'];
      // 两三块一部：从人口最多的区块起，沿陆地相邻的同国区块长成一部
      const inK = new Set(list), done = new Set(), order = list.slice().sort((a, b) => regionPopulation[b] - regionPopulation[a] || a - b), size = list.length > 12 ? 3 : 2;
      for (const r0 of order) { if (done.has(r0)) continue; const grp = [r0]; done.add(r0);
        for (let i = 0; i < grp.length && grp.length < size; i++) for (let kk = R.off[grp[i]]; kk < R.off[grp[i] + 1] && grp.length < size; kk++) { const b = R.nbr[kk]; if (inK.has(b) && !done.has(b) && !R.edges[R.eid[kk]].sea) { done.add(b); grp.push(b); } }
        let name = ''; for (let t = 0; t < 12 && (!name || used.has(name)); t++) { const suf = sufs[Math.floor(rnd() * sufs.length) % sufs.length] || '部'; name = (lib && G.NameGen ? G.NameGen.make(lib, 'state', new Set(), rnd) : '无名') + suf; }
        used.add(name); const id = tribes.length, pop = grp.reduce((a, r) => a + regionPopulation[r], 0);
        tribes.push({ name, livelihood: key[1], pop: Math.round(pop), x: 0, y: 0, size: 0, country: k, unit: true, regions: grp.length });
        for (const r of grp) unitOfR[r] = id; } }
    // 注记位置：部内离部界最远的格（部界即区块界），格数作为字号依据
    const sx = new Map(); for (let i = 0; i < N; i++) { const r = R.regionOf[i]; if (!r || unitOfR[r] < 0 || state[i] < 0) continue; const u = unitOfR[r]; tribe[i] = u; let o = sx.get(u); if (!o) sx.set(u, o = { n: 0, sx: 0, sy: 0, x0: i % W, cells: [] }); o.cells.push(i);
      const y = (i / W) | 0; let x = i - y * W; if (x - o.x0 > W / 2) x -= W; if (o.x0 - x > W / 2) x += W; o.n++; o.sx += x; o.sy += y; }
    for (const [u, o] of sx) { const t = tribes[u], cx = o.sx / o.n, cy = o.sy / o.n; let best = -1, bd = Infinity;
      for (const i of o.cells) { const y = (i / W) | 0; let x = i - y * W; if (x - o.x0 > W / 2) x -= W; if (o.x0 - x > W / 2) x += W; const d = (x - cx) * (x - cx) + (y - cy) * (y - cy); if (d < bd) { bd = d; best = i; } }
      const by = (best / W) | 0, bx = best - by * W; t.x = (bx + 0.5) * 2; t.y = (by + 0.5) * 2; t.size = o.n; }
    void NB;
  }

  // 人口密度的落地：区块人口 ÷ 区块承载 = 区块的“开发强度”（相对全图平均的倍数）。
  //  - 强度在对数域跨区块平滑（几何平均，σ 约三格半）：十倍、几十倍的落差变成连续的等比过渡，
  //    稠密区由核心向外渐次变淡，不会在区块界上出现一刀切的深色块；
  //  - 每格的承载权重与邻近陆地的平均承载各取一半：沿河一线、绿洲一点的承载向两岸摊开，不再画出一条笔直的深色细线；
  //  - 只在原本有人居住的格（承载 > 0）落人，有人区的范围不变；全图总人口不变。
  function distributePopulation(Cv, h, R, regionPopulation) {
    const N = h.N, W = h.W, H = h.H, RB = 3, PASSES = 3;
    const lg = new Float32Array(N), wt = new Float32Array(N), cw = new Float32Array(N), land = new Float32Array(N), tmp = new Float32Array(N);
    let sumL = 0, sumW = 0;
    for (let r = 1; r <= R.nR; r++) if (R.weight[r] > 0 && regionPopulation[r] > 0) { sumL += regionPopulation[r]; sumW += R.weight[r]; }
    const mean = sumW > 0 ? sumL / sumW : 1;
    for (let i = 0; i < N; i++) { const r = R.regionOf[i]; if (!r) continue; land[i] = 1; cw[i] = h.weight[i] > 0 ? h.weight[i] : 0;
      if (R.weight[r] > 0 && regionPopulation[r] > 0 && h.weight[i] > 0) { lg[i] = Math.log(regionPopulation[r] / R.weight[r] / mean); wt[i] = 1; } }
    const pass = (A) => { // 可分离的方框模糊：横向环绕，纵向截断
      for (let y = 0; y < H; y++) { const row = y * W; let v = 0; for (let k = -RB; k <= RB; k++) v += A[row + ((k % W) + W) % W];
        for (let x = 0; x < W; x++) { tmp[row + x] = v; v += A[row + (x + RB + 1) % W] - A[row + ((x - RB) % W + W) % W]; } }
      for (let x = 0; x < W; x++) { let v = 0; for (let k = 0; k <= RB && k < H; k++) v += tmp[k * W + x];
        for (let y = 0; y < H; y++) { A[y * W + x] = v; const a = y - RB, b = y + RB + 1; if (b < H) v += tmp[b * W + x]; if (a >= 0) v -= tmp[a * W + x]; } } };
    for (let i = 0; i < N; i++) lg[i] *= wt[i];
    for (let it = 0; it < PASSES; it++) { pass(lg); pass(wt); }
    { const sw = Float32Array.from(cw), sl = Float32Array.from(land); pass(sw); pass(sl); // 承载权重：本格与周边陆地平均各半
      for (let i = 0; i < N; i++) if (cw[i] > 0) cw[i] = 0.5 * cw[i] + 0.5 * (sl[i] > 0 ? sw[i] / sl[i] : cw[i]); }
    let before = 0, after = 0; const out = new Float32Array(N);
    for (let i = 0; i < N; i++) { const r = R.regionOf[i]; if (!(r && R.weight[r] > 0)) continue; const a = h.area[(i / W) | 0];
      before += regionPopulation[r] * h.weight[i] / R.weight[r];
      if (!(h.weight[i] > 0) || !(regionPopulation[r] > 0) || !(wt[i] > 0)) continue;
      out[i] = cw[i] * mean * Math.exp(lg[i] / wt[i]) / a; after += out[i] * a; }
    const k = after > 0 ? before / after : 1;
    for (let i = 0; i < N; i++) { const r = R.regionOf[i]; if (r && R.weight[r] > 0) Cv.popDensity[i] = out[i] * k; }
  }

  function apply(world, Hc) {
    const Cv = world.Cv, h = Cv.hist, R = Hc.R, end = Hc.Pol.end, N = h.N, W = h.W, H = h.H, NB = h.NB;
    Cv.forts = Hc.Pol.forts;
    const human = Hc.Pol.human, latest = human.snapshots[human.snapshots.length - 1];
    // 时间线的负 ID 表示古文明；若古文明延续至终局，为当前地图创建对应的真实文化实例。
    const ancientCulture = new Map();
    const registerAncient = c => { if (c > -2 || ancientCulture.has(c)) return; const a = Hc.D.ancient[-2 - c]; if (!a) throw new Error('历史文化引用无效'); ancientCulture.set(c, Cv.cultures.length); Cv.cultures.push({ name: a.name, style: a.libObj && a.libObj.label || a.lib, subsistence: a.type, library: a.libObj && a.libObj.label || a.lib, ancient: -2 - c }); };
    for (let r = 1; r <= R.nR; r++) registerAncient(end.cult[r]);
    for (const country of end.countries) registerAncient(country.civ); // 统治者文化可能没有成为任何地区的人口主体。
    const currentCulture = c => c >= 0 ? c : c <= -2 ? ancientCulture.get(c) : -1;
    const regionPopulation = new Float64Array(R.nR + 1), regionSpecies = new Int16Array(R.nR + 1).fill(-1);
    for (let r = 1; r <= R.nR; r++) {
      const counts = new Map(); for (let i = latest.offsets[r]; i < latest.offsets[r + 1]; i++) { const s = latest.species[i], n = latest.population[i]; regionPopulation[r] += n; counts.set(s, (counts.get(s) || 0) + n); }
      let best = 0; for (const [s, n] of counts) if (n > best) { best = n; regionSpecies[r] = s; }
    }
    Cv.species = new Int16Array(N).fill(-1); Cv.speciesLibraries = human.species;
    const state = new Int16Array(N).fill(-1), province = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) { const r = R.regionOf[i]; if (!r) continue; const p = end.owner[r];
      if (p >= 0) { state[i] = end.countryOfP[p]; const v = end.prov[r]; province[i] = v >= 0 ? end.provIdx[v] : -1; }
      Cv.culture[i] = currentCulture(end.cult[r]);
      Cv.species[i] = regionSpecies[r];
      if (h.domain[i]) Cv.religion[i] = end.rel[r] >= 0 ? end.rel[r] : -1;
      if (Cv.popDensity && R.weight[r] > 0) Cv.popDensity[i] = regionPopulation[r] * h.weight[i] / R.weight[r] / h.area[(i / W) | 0]; }
    // 人口密度：见 distributePopulation（对数域平滑的区块强度 × 柔化后的承载权重）
    if (Cv.popDensity) distributePopulation(Cv, h, R, regionPopulation);
    // 国家
    const nK = end.countries.length, kPop = new Float64Array(nK), kArea = new Float64Array(nK), kCities = new Int32Array(nK);
    for (let i = 0; i < N; i++) { const k = state[i]; if (k < 0) continue; const r = R.regionOf[i]; kPop[k] += R.weight[r] > 0 ? h.weight[i] * regionPopulation[r] / R.weight[r] : 0; kArea[k] += h.area[(i / W) | 0]; }
    h.settlements.forEach(s => { const k = state[s.cell]; if (k >= 0 && s.tier !== 'site') kCities[k]++; });
    const toFull = i => { const y = (i / W) | 0, x = i - y * W; return [(x + 0.5) * 2, (y + 0.5) * 2]; };
    const countries = end.countries.map((c, k) => {
      const capCell = c.capital >= 0 ? h.settlements[c.capital].cell : R.center[c.capRegion];
      return { name: c.name, short: c.short, bare: c.bare, form: c.form, formLabel: c.formLabel || FORM_LABEL[c.form] || '王国', regime: c.regime, imperial: !!c.imperial, capital: c.capital, civ: currentCulture(c.civ), culture: currentCulture(c.civ),
        language: Cv.language[capCell], religion: c.religion, pop: Math.round(kPop[k]), area: Math.round(kArea[k]), cities: kCities[k], strength: 1, fromHistory: c.p, color: c.color, gov: c.gov, govKey: c.govKey, govStyle: c.govStyle, ruler: c.ruler, house: c.house, ideas: c.ideas || [], mil: c.mil || 0, adm: c.adm || 0, loose: c.loose || null }; // 配色与历史时间线一致
    });
    // 疆界松散的国家（都城一带仍在酋邦阶段及以前，或游牧、部落、落后政体；城邦、王国已是成形的国家）：专题图的国家图层与历史时间线一样画成由都城向外渐淡的渐变，
    // 不画硬国界——规则与时间线同一套（都城阶段 ≤ 2 或松散政体；都城阶段 ≤ 3 时 320 km、更高时 900 km 内由浓到淡）
    { const D = Hc.D, NNd = D.NN, stE = r => { let s = 0; for (let k = 1; k <= 8; k++) if (D.Y[k * NNd + r] <= D.E) s = k; else break; return s; };
      end.countries.forEach((c, k) => { const cr = c.capRegion; if (!(cr > 0)) return; const cs = stE(cr);
        if (cs <= 2 || c.loose) { countries[k].gradKm = cs <= 3 ? 320 : 900; countries[k].gradCell = R.center[cr]; } }); }
    // 附庸：记下宗主，配色染上宗主的色调（与历史时间线一致）
    { const kOfP = new Map(end.countries.map((c, k) => [c.p, k]));
      end.countries.forEach((c, k) => { const L = c.liegeP >= 0 ? kOfP.get(c.liegeP) : undefined; if (L === undefined || L === k) return; const Ld = c.liegeD >= 0 ? kOfP.get(c.liegeD) : undefined; countries[k].liege = Ld !== undefined ? Ld : L; // 显示直接宗主；配色取最上层宗主的色系
        const b = end.countries[L].color; if (b) countries[k].color = vassalTint(b, c.p); }); }
    // 盟约：现在仍有效的同盟（与历史时间线同源）
    { const kOfP = new Map(end.countries.map((c, k) => [c.p, k])), E = Hc.D.E;
      for (const A of Hc.Pol.alliances || []) { if (A.to != null && A.to <= E) continue; const now = (A.roster || []).filter(x => x[2] == null).map(x => kOfP.get(x[0])).filter(k => k !== undefined); if (now.length < 2) continue;
        for (const k of now) countries[k].allies = now.filter(x => x !== k); } }
    // 国名锚点：国土内离国界最远处
    { const dd = new Int32Array(N).fill(1 << 30), q = new Int32Array(N); let hd = 0, tl = 0;
      for (let i = 0; i < N; i++) { if (state[i] < 0) continue; for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j < 0 || state[j] !== state[i]) { dd[i] = 0; q[tl++] = i; break; } } }
      while (hd < tl) { const i = q[hd++]; for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j >= 0 && state[j] === state[i] && dd[j] > dd[i] + 1) { dd[j] = dd[i] + 1; q[tl++] = j; } } }
      const best = new Int32Array(nK).fill(-1); for (let i = 0; i < N; i++) { const k = state[i]; if (k >= 0 && (best[k] < 0 || dd[i] > dd[best[k]])) best[k] = i; }
      countries.forEach((c, k) => { if (best[k] >= 0) { const [x, y] = toFull(best[k]); c.lx = x; c.ly = y; c.lsize = dd[best[k]]; } }); }
    const provinces = end.provinces.map(pv => ({ name: pv.name, country: pv.country, seat: pv.seat }));
    // 城市的归属、首都与省会
    // 与历史终局选治所使用同一份逐区人口分配和累计取整。
    const cityPopulation=G.HistoryAdministration.cityPopulations(h,R,regionPopulation);
    Cv.cities.forEach((ct, k) => { const s = h.settlements[k]; if (!s) return; ct.pop=cityPopulation[k];ct.civ = Cv.culture[s.cell]; ct.rel = Cv.religion[s.cell]; ct.country = state[s.cell]; ct.prov = province[s.cell]; delete ct.capital; delete ct.seat; });
    if (end.religions) Cv.religions = end.religions.map(r => Object.assign({}, r)); // 宗教库生成的宗教（含推演中分裂出的教派）
    for (const c of Hc.C.cities) if (c.idx >= 0 && Cv.cities[c.idx]) { Cv.cities[c.idx].name = c.name; h.settlements[c.idx].name = c.name; } // 所有城市使用历史终局名称。
    countries.forEach((c, k) => { if (c.capital >= 0 && Cv.cities[c.capital]) Cv.cities[c.capital].capital = k; });
    provinces.forEach((pv, i) => { if (pv.seat >= 0 && Cv.cities[pv.seat] && Cv.cities[pv.seat].seat === undefined) Cv.cities[pv.seat].seat = i; });
    // 已设省区以到真实治所的交通日数表达治理；无支撑的土地保持未设省。
    const gov = new Uint8Array(N), govDays = new Float32Array(N).fill(Infinity);
    for (let i = 0; i < N; i++) { const r=R.regionOf[i];if(!r||province[i]<0||!Number.isFinite(end.adminDays[r]))continue;const days=end.adminDays[r];govDays[i]=days;gov[i]=Math.round(255*Math.max(0.12,Math.min(1,1.1-days/end.adminBudget))); }
    // 名义宣称、部族与羁縻
    const nominal = Int16Array.from(state), tribe = Int16Array.from(Cv.tribe, (t, i) => state[i] < 0 ? t : -1), jimi = new Int16Array(N).fill(-1);
    const tribes = Cv.tribes.map((t, i) => { const hx = Math.min(W - 1, Math.max(0, (t.x / 2) | 0)), hy = Math.min(H - 1, Math.max(0, (t.y / 2) | 0)); return state[hy * W + hx] < 0 ? t : Object.assign({}, t, { hidden: true }); });
    // 松散政体境内不设省份，各地是“某某部、某某旗、某某盟”：按历史区块把国土分成若干部，部名取统治文化的文化库
    looseUnits(Cv, h, R, Hc, countries, state, regionPopulation, tribe, tribes);
    Object.assign(Cv, { country: state, province, countries, provinces, gov, govDays, nominal, tribe, jimi, jimis: [], tribes: tribes.map(t => t.hidden ? Object.assign({}, t, { x: -1e6, y: -1e6 }) : t) });
    let tribalArea = 0, claimArea = 0, inhabitedArea = 0, independentInhabitedArea = 0;
    for (let i = 0; i < N; i++) if (h.domain[i]) {
      const area = h.area[(i / W) | 0];
      claimArea += area;
      if (state[i] < 0) tribalArea += area;
      // 与上面人口密度使用同一套最终人口分配，排除无人地和无法生存的土地。
      const r = R.regionOf[i];
      if (r && regionPopulation[r] > 0 && h.weight[i] > 0 && R.weight[r] > 0) {
        inhabitedArea += area;
        if (state[i] < 0) independentInhabitedArea += area;
      }
    }
    // 国家总数含松散政体（游牧、部落、落后政体与酋邦，由都城向外渐淡）；另记其中松散政体的数目
    const looseK = countries.filter(c => c.gradKm).length;
    Object.assign(Cv.stats, { population: Math.round(regionPopulation.reduce((a, b) => a + b, 0)), countries: nK, looseCountries: looseK, provinces: provinces.length, tribalShare: tribalArea / Math.max(1, claimArea), independentInhabitedShare: independentInhabitedArea / Math.max(1, inhabitedArea), jimis: 0, endYear: Hc.D.E });
    // 全分辨率国界与省界：取历史区块的细化边界
    const F = Hc.regionF, P = world.P, FN = F.length, countryF = new Int16Array(FN), provinceF = new Int16Array(FN);
    for (let f = 0; f < FN; f++) { const r = F[f]; if (r > 0) { const p = end.owner[r], k = p >= 0 ? end.countryOfP[p] : -1, v = p >= 0 ? end.prov[r] : -1; countryF[f] = k; provinceF[f] = k >= 0 && v >= 0 ? end.provIdx[v] : -1; } else { countryF[f] = r < -1 ? r : -1; provinceF[f] = r < -1 ? r : -1; } }
    dropSlivers(countryF, provinceF, P.W, P.H, P.land || null, P.elev);
    Cv.countryF = countryF; Cv.provinceF = provinceF;
    const anchors = G.Borders.anchors(provinceF, P.W, provinces.length);
    provinces.forEach((p, k) => { const a = anchors[k]; if (a) { p.lx = a.x; p.ly = a.y; p.lsize = a.size; } });
    // 遗迹：从整部推演史里提取，并标记圣城
    try { Cv.heritage = G.HistoryHeritage ? G.HistoryHeritage.build(Hc, Cv, h) : []; } catch (e) { console.warn('遗迹提取失败', e); Cv.heritage = []; }
  }

  G.HistoryApply = { apply, distributePopulation };
})(typeof self !== 'undefined' ? self : this);
