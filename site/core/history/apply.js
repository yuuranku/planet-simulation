/* 历史与现在互为因果：世界生成时，历史从文明之初自由推演到现在，它的终局写回现在的地图。
 *  - 现在的国家、疆域、首都、国名、政体 = 历史终局中存活的政权；
 *  - 现在的省份、省名、治所 = 历史终局的行政区划；
 *  - 现在的文化、宗教分布 = 历史终局（迁徙、同化、传教之后）；
 *  - 国界与省界 = 历史区块边界在全分辨率地形上按“山川形便”细化后的结果（与时间线最后一年完全同一套边界）；
 *  - 实际治理、名义宣称、部族地带随之重算。
 * 原先人文推演生成的政治地图只作为自然倾向：历史区块按它的省份分区来切，边疆的荒野仍是部族地带。 */
(function (G) {
  'use strict';
  const FORM_LABEL = { monarchy: '君主制王国', empire: '帝国', republic: '共和国', cityRepublic: '城邦', nomadic: '游牧政权', chiefdom: '酋邦', league: '联盟', theocracy: '神权政体（政教合一）', vassal: '附庸国（自有疆土与朝廷，向宗主称臣）' };

  // 附庸配色：与宗主同色系（色相相近），但深浅、色相明显不同——附庸是另一个国家；与历史时间线同一公式
  function vassalTint(L, id) {
    const r = L[0] / 255, g = L[1] / 255, b = L[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0, s = 0;
    if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = 60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4); }
    const a = ((id * 2654435761) >>> 0) % 6, dh = [-24, 18, -14, 26, 12, -20][a], dl = (l > 0.72 ? -1 : 1) * (0.1 + 0.04 * (a % 3));
    h = (((h + dh) % 360) + 360) % 360 / 360; const s2 = Math.min(0.62, s * (l > 0.72 ? 1.08 : 0.86) + 0.04), l2 = Math.max(0.5, Math.min(0.88, l + dl));
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

  function apply(world, Hc) {
    const Cv = world.Cv, h = Cv.hist, R = Hc.R, end = Hc.Pol.end, N = h.N, W = h.W, H = h.H, NB = h.NB;
    const state = new Int16Array(N).fill(-1), province = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) { const r = R.regionOf[i]; if (!r) continue; const p = end.owner[r];
      if (p >= 0) { state[i] = end.countryOfP[p]; const v = end.prov[r]; province[i] = v >= 0 ? end.provIdx[v] : -1; }
      if (Cv.culture[i] >= 0 || end.cult[r] >= 0) Cv.culture[i] = end.cult[r] >= 0 ? end.cult[r] : Cv.culture[i];
      if (h.domain[i]) Cv.religion[i] = end.rel[r] >= 0 ? end.rel[r] : -1; }
    // 国家
    const nK = end.countries.length, kPop = new Float64Array(nK), kArea = new Float64Array(nK), kCities = new Int32Array(nK);
    for (let i = 0; i < N; i++) { const k = state[i]; if (k < 0) continue; kPop[k] += h.weight[i] * h.popTotal; kArea[k] += h.area[(i / W) | 0]; }
    h.settlements.forEach(s => { const k = state[s.cell]; if (k >= 0 && s.tier !== 'site') kCities[k]++; });
    const toFull = i => { const y = (i / W) | 0, x = i - y * W; return [(x + 0.5) * 2, (y + 0.5) * 2]; };
    const countries = end.countries.map((c, k) => {
      const capCell = c.capital >= 0 ? h.settlements[c.capital].cell : R.center[c.capRegion];
      return { name: c.name, short: c.short, bare: c.bare, form: c.form, formLabel: c.formLabel || FORM_LABEL[c.form] || '王国', regime: c.regime, imperial: !!c.imperial, capital: c.capital, civ: Math.max(0, c.civ), culture: Math.max(0, c.civ),
        language: Math.max(0, Cv.language[capCell]), religion: Math.max(0, c.religion), pop: Math.round(kPop[k]), area: Math.round(kArea[k]), cities: kCities[k], strength: 1, fromHistory: c.p, color: c.color, gov: c.gov, govKey: c.govKey, govStyle: c.govStyle, ruler: c.ruler, house: c.house, ideas: c.ideas || [], mil: c.mil || 0, adm: c.adm || 0 }; // 配色与历史时间线一致
    });
    // 附庸：记下宗主，配色染上宗主的色调（与历史时间线一致）
    { const kOfP = new Map(end.countries.map((c, k) => [c.p, k]));
      end.countries.forEach((c, k) => { const L = c.liegeP >= 0 ? kOfP.get(c.liegeP) : undefined; if (L === undefined || L === k) return; const Ld = c.liegeD >= 0 ? kOfP.get(c.liegeD) : undefined; countries[k].liege = Ld !== undefined ? Ld : L; // 显示直接宗主；配色取最上层宗主的色系
        const b = end.countries[L].color; if (b) countries[k].color = vassalTint(b, c.p); }); }
    // 国名锚点：国土内离国界最远处
    { const dd = new Int32Array(N).fill(1 << 30), q = new Int32Array(N); let hd = 0, tl = 0;
      for (let i = 0; i < N; i++) { if (state[i] < 0) continue; for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j < 0 || state[j] !== state[i]) { dd[i] = 0; q[tl++] = i; break; } } }
      while (hd < tl) { const i = q[hd++]; for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j >= 0 && state[j] === state[i] && dd[j] > dd[i] + 1) { dd[j] = dd[i] + 1; q[tl++] = j; } } }
      const best = new Int32Array(nK).fill(-1); for (let i = 0; i < N; i++) { const k = state[i]; if (k >= 0 && (best[k] < 0 || dd[i] > dd[best[k]])) best[k] = i; }
      countries.forEach((c, k) => { if (best[k] >= 0) { const [x, y] = toFull(best[k]); c.lx = x; c.ly = y; c.lsize = dd[best[k]]; } }); }
    const provinces = end.provinces.map(pv => ({ name: pv.name, country: pv.country, seat: pv.seat }));
    // 城市的归属、首都与省会
    Cv.cities.forEach((ct, k) => { const s = h.settlements[k]; if (!s) return; ct.country = state[s.cell]; ct.prov = province[s.cell]; delete ct.capital; delete ct.seat; });
    if (end.religions) Cv.religions = end.religions.map(r => Object.assign({}, r)); // 宗教库生成的宗教（含推演中分裂出的教派）
    for (const c of Hc.C.cities) if (c.colonial !== undefined && c.idx >= 0 && Cv.cities[c.idx]) Cv.cities[c.idx].name = c.name; // 殖民地城市改用宗主国的名字
    countries.forEach((c, k) => { if (c.capital >= 0 && Cv.cities[c.capital]) Cv.cities[c.capital].capital = k; });
    provinces.forEach((pv, i) => { if (pv.seat >= 0 && Cv.cities[pv.seat] && Cv.cities[pv.seat].seat === undefined) Cv.cities[pv.seat].seat = i; });
    // 实际治理：离首都越远越弱（随首都所在地的发展阶段放大）
    const gov = new Uint8Array(N), govDays = new Float32Array(N).fill(Infinity);
    { const capCell = countries.map(c => c.capital >= 0 ? h.settlements[c.capital].cell : -1);
      const stageAt = (r, y) => { const D = Hc.D; let s = 0; for (let k = 1; k <= 8; k++) if (D.Y[k * D.NN + r] <= y) s = k; return s; };
      const reach = countries.map((c, k) => capCell[k] >= 0 ? 300 + 260 * stageAt(R.regionOf[capCell[k]] || 1, Hc.D.E) : 600);
      for (let i = 0; i < N; i++) { const k = state[i]; if (k < 0 || capCell[k] < 0) continue; const km = h.gdist(i, capCell[k]) * h.cellKm; gov[i] = Math.round(255 * Math.max(0.12, Math.min(1, 1.1 - km / reach[k]))); govDays[i] = km / 40; } }
    // 名义宣称、部族与羁縻
    const nominal = Int16Array.from(state), tribe = Int16Array.from(Cv.tribe, (t, i) => state[i] < 0 ? t : -1), jimi = new Int16Array(N).fill(-1);
    const tribes = Cv.tribes.map((t, i) => { const hx = Math.min(W - 1, Math.max(0, (t.x / 2) | 0)), hy = Math.min(H - 1, Math.max(0, (t.y / 2) | 0)); return state[hy * W + hx] < 0 ? t : Object.assign({}, t, { hidden: true }); });
    Object.assign(Cv, { country: state, province, countries, provinces, gov, govDays, nominal, tribe, jimi, jimis: [], tribes: tribes.map(t => t.hidden ? Object.assign({}, t, { x: -1e6, y: -1e6 }) : t) });
    let tribalArea = 0, claimArea = 0; for (let i = 0; i < N; i++) if (h.domain[i]) { claimArea += h.area[(i / W) | 0]; if (state[i] < 0) tribalArea += h.area[(i / W) | 0]; }
    Object.assign(Cv.stats, { countries: nK, provinces: provinces.length, tribalShare: tribalArea / Math.max(1, claimArea), jimis: 0, endYear: Hc.D.E });
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

  G.HistoryApply = { apply };
})(typeof self !== 'undefined' ? self : this);
