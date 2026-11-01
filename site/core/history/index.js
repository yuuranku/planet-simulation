/* 历史推演入口：核心推演（区块、文明点亮、城市、政权、山川形便的边界）在世界生成时运行，其终局写回现在的地图；
 * 第一次打开时间线时，再把同一次推演的结果打包交给页面。 */
(function (G) {
  'use strict';
  const VERSION = 15;
  function hsl(h, s, l) { h = ((h % 360) + 360) % 360 / 360; const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; }

  // 核心推演：世界生成时运行（历史的终局写回现在的地图，见 apply.js）
  function core(world, progress) {
    const t0 = Date.now(), Cv = world.Cv, h = Cv.hist;
    if (!h) throw new Error('缺少人文推演中间量，请重新推演世界');
    progress && progress('历史 · 切分区块', 0.962);
    const R = G.HistoryRegions.build(h);
    const t1 = Date.now();
    progress && progress('历史 · 文明点亮', 0.964);
    const D = G.HistoryDawn.run(h, R, { riverNames: (Cv.riverNames || []).filter(r => !r.minor), countries: Cv.countries, religions: Cv.religions, cultureNames: Cv.cultures.map(c => c.name) });
    const t2 = Date.now();
    progress && progress('历史 · 城市兴衰', 0.966);
    const C = G.HistoryCities.run(h, R, D, { cities: Cv.cities, labels: Cv.labels });
    progress && progress('历史 · 列国争霸到现在', 0.968);
    const Pol = G.HistoryPolity.run(h, R, D, C, { countries: Cv.countries, provinces: Cv.provinces, religions: Cv.religions, cultureNames: Cv.cultures.map(c => c.name) });
    const t3 = Date.now();
    // 区块边界在全分辨率地形上按“山川形便”细化：沿山脊与大河，平原上有自然的犬牙交错
    progress && progress('历史 · 山川形便', 0.972);
    const P = world.P, Hy = world.Hy, Cl = world.Cl, FW = P.W, FH = P.H;
    const half = new Int32Array(h.N); for (let i = 0; i < h.N; i++) half[i] = R.regionOf[i] > 0 ? R.regionOf[i] : h.land[i] ? -1 : -2;
    const ice = new Uint8Array(FW * FH); for (let f = 0; f < ice.length; f++) { const lat = Math.abs(90 - (((f / FW) | 0) + 0.5) / FH * 180); if (P.elev[f] > 0 && lat > 55 && Cl.snow && Cl.snow[f] === 2) ice[f] = 1; }
    const fixed = []; Cv.cities.forEach((c, k) => { const s = h.settlements[k]; if (s && R.regionOf[s.cell]) fixed.push([c.x, c.y, R.regionOf[s.cell]]); });
    const regionF = G.Borders.refineFine(P, Hy, half, { seed: (h.seed | 0) + 903, ice, climb: 30, river: 3, riverMax: 9, freq: 0.09, noise0: 0.3, noise1: 1.5, fixed, amp: 1.5, bandF: 4, oct: [[0.12, 1], [0.3, 0.5]], cityR: 1, minCells: 12 });
    return { R, D, C, Pol, regionF, ms: { regions: t1 - t0, dawn: t2 - t1, polity: t3 - t2, borders: Date.now() - t3, total: Date.now() - t0 } };
  }

  // 打包给时间线：第一次打开时运行
  function run(world, progress) {
    const t0 = Date.now(), Cv = world.Cv, h = Cv.hist;
    const Hc = world.Hc || (world.Hc = core(world, progress));
    const { R, D, C, Pol } = Hc, end = Pol.end;
    progress && progress('描绘疆界', 0.6);
    const P = world.P, lakeF = world.Hy.lake, FW = P.W, FH = P.H, landF = new Uint8Array(FW * FH); for (let i = 0; i < landF.length; i++) landF[i] = P.elev[i] > 0 && !lakeF[i] ? 1 : 0;
    const O = G.HistoryOutline.segments(Hc.regionF, FW, FH);
    const regionF = new Uint16Array(Hc.regionF.length); for (let f = 0; f < regionF.length; f++) { const r = Hc.regionF[f]; regionF[f] = r > 0 && landF[f] ? r : 0; }
    progress && progress('整理编年史', 0.9);
    const events = D.events.concat(C.events, G.HistoryCities.milestones(C), Pol.events).sort((a, b) => a.year - b.year || a.r - b.r);
    // 编年史里的城名按当年的叫法；现存城市建城时另注今名
    const cityEra = (c, y) => { let n = c.names[0][1]; for (const x of c.names) { if (x[0] > y) break; n = x[1]; } return n; };
    for (const e of events) { const c = e.city !== undefined && e.city >= 0 ? C.cities[e.city] : null; if (!c || !c.names || e._nm) continue; const nm = cityEra(c, e.year); e._nm = 1;
      if (nm !== c.name && e.text.includes(c.name)) e.text = e.text.split(c.name).join(e.kind === 'found' && !c.lost ? `${nm}（今${c.name}）` : nm); }
    const NN = R.nR + 1, f32 = a => Float32Array.from(a);
    const regionOf = R.nR < 65535 ? Uint16Array.from(R.regionOf) : R.regionOf;
    const ages = a => Array.from(a, v => v >= 1e8 ? null : Math.round(v));
    const civs = Cv.cultures.map((c, k) => {
      const lib = h.civLib[k], type = D.civType[k], hr = D.hearthR[k];
      return { name: c.name, type, typeLabel: D.TYPE_LABEL[type], lib: lib.label, libId: lib.id, start: D.civStart[k] >= 1e8 ? null : Math.round(D.civStart[k]),
        ages: ages(D.civAges[k]), stageNames: D.stageNamesOf ? D.stageNamesOf(k) : (D.STAGE_NAME[type] || D.GENERIC), titles: D.titlesOf(lib, type), hx: hr ? R.cx[hr] : 0, hy: hr ? R.cy[hr] : 0, cradle: D.cradles.findIndex(cr => cr.civ === k && cr.ancient < 0) };
    });
    const ancient = D.ancient.map((a, i) => ({ name: a.name, short: a.short, type: a.type, typeLabel: a.typeLabel, lib: a.lib, fall: Math.round(a.fall), cradle: a.cradle, successor: a.successor,
      ages: ages(a.ages), stageNames: D.STAGE_NAME[a.type] || D.GENERIC, titles: a.titles, color: hsl(28 + i * 71, 0.42, 0.5), zone: a.zone.length }));
    const cradles = D.cradles.map(cr => ({ name: cr.name, river: cr.river, x: cr.x, y: cr.y, region: cr.region, civ: cr.civ, ancient: cr.ancient, valley: cr.valley, score: +cr.score.toFixed(3), year: Math.round(D.Y[NN + cr.region]) }));
    const religions = (end.religions || Cv.religions).map((r, f) => { const o = r.origin !== undefined ? r.origin : D.relOrigin[f]; return Object.assign({}, r, { founded: r.founded !== undefined ? r.founded : Math.round(D.relFounded[f]), x: o ? R.cx[o] : 0, y: o ? R.cy[o] : 0 }); });
    // 每个区块现在属于哪国哪省（与现在的地图同源）
    const country = new Int16Array(NN).fill(-1), prov = new Int16Array(NN).fill(-1), civNow = new Int16Array(NN).fill(-1), relNow = new Int16Array(NN).fill(-1);
    for (let r = 1; r < NN; r++) { const p = end.owner[r]; if (p >= 0) { country[r] = end.countryOfP[p]; const v = end.prov[r]; prov[r] = v >= 0 ? end.provIdx[v] : -1; } civNow[r] = end.cult[r]; relNow[r] = end.rel[r]; }
    const data = {
      version: VERSION, W: h.W, H: h.H, nR: R.nR, regionOf, E: D.E, maxStage: D.maxStage,
      Y: f32(D.Y), civ: civNow, ancientOf: D.ancientOf, ancientEnd: f32(D.ancientEnd),
      rel: relNow, relPrev: D.relPrev, country, prov,
      cx: R.cx, cy: R.cy, weight: R.weight, area: R.area, newW: R.newW, finalStage: D.finalStage, landComp: R.landComp,
      ideas: D.IDEAS.map((I, k) => ({ id: I.id, name: I.name, s: I.s, desc: I.desc, opt: !!I.opt, born: D.ideaBorn[k] < 1e8 ? Math.round(D.ideaBorn[k]) : null, origins: D.ideaOrigins[k].filter(r => D.ideaA[k * NN + r] < 1e8).map(r => [R.cx[r], R.cy[r], r]) })), ideaA: Float32Array.from(D.ideaA, v => v >= 1e8 ? 1e9 : v),
      civs, ancient, cradles, religions, events, eraStep: D.eraStep, eraAt: D.eraAt, eraNames: D.ERA_NAME,
      outline: O, regionF, landF, FW, FH,
      polities: Pol.polities, own: Pol.own, cultLog: Pol.cultLog, relLog: Pol.relLog, provinces: Pol.provinces, provLog: Pol.provLog, unrest: Pol.unrest, Rkm: h.R, EMPN: Pol.EMPN, T0: Pol.T0,
      cities: C.cities, cityPop: C.popF || C.pop, popStep: C.popF ? C.popStepF : C.popStep, popN: C.popF ? C.popNF : C.popN, regionPop: C.popF ? C.regionPopF : C.regionPop, /* 面板曲线用 10 年一档的细采样 */ pasture: R.pasture, popTotal: h.popTotal, roads: C.roads, plagues: C.plagues, tiers: C.tiers,
      stats: { regions: R.nR, edges: R.edges.length, core: Hc.ms, polity: Pol.stats, cities: C.cities.length, lost: C.cities.filter(c => c.lost).length, roads: C.roads.length, ms: Date.now() - t0 }
    };
    return data;
  }

  G.History = { run, core, VERSION };
})(typeof self !== 'undefined' ? self : this);
