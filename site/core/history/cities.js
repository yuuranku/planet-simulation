/* 城市的兴起与扩张（第二阶段）：
 *  - 现存聚落的建城年份：由所在区块的发展阶段决定，按类型区分（古城、港口、集镇、要塞、新设县城各有各的时代）；
 *  - 人口曲线：随发展阶段增长，古文明衰亡时故地城市遭洗劫，几次大瘟疫在大陆范围留下低谷；终点严格等于现在的人口；
 *  - 古城废墟：古文明故地上没能活到今天的城市（黄沙掩埋、河流改道、毁于战火）；
 *  - 道路年代：两端城市都建成、所在地的发展阶段足够之后才修通；干道要等到帝国时代。 */
(function (G) {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const INF = 1e9;
  const STEP = 50;                     // 人口曲线的采样间隔（年）
  const SF = [0.006, 0.03, 0.07, 0.16, 0.3, 0.48, 0.56, 0.78, 1];  // 各发展阶段的城市规模（相对）
  const CAUSE = { sand: '被黄沙掩埋', river: '因河流改道而荒废', war: '毁于战火', abandon: '人去城空' };
  function hash(a) { a = (a ^ 61) ^ (a >>> 16); a = (a + (a << 3)) | 0; a ^= a >>> 4; a = Math.imul(a, 0x27d4eb2d); a ^= a >>> 15; return (a >>> 0) / 4294967296; }
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const fmtPop = p => p >= 1e6 ? (p / 1e6).toFixed(p >= 1e7 ? 0 : 1) + ' 百万' : p >= 1e4 ? Math.round(p / 1e4) + ' 万' : Math.round(p) + '';

  function run(h, R, D, opt) {
    const { NN, E, Y } = D, nR = R.nR;
    const rnd = mulberry32((h.seed | 0) + 9090);
    const used = D.usedNames;
    const events = [];
    const ev = (year, kind, text, r, extra) => events.push(Object.assign({ year: Math.round(year), kind, text, r: r || 0 }, extra || {}));
    const stageYear = (s, r) => Y[s * NN + r];
    const stageAt = (r, y) => { let s = 0; for (let k = 1; k <= 8; k++) if (Y[k * NN + r] <= y) s = k; else break; return s; };
    // 连续的“规模”：在两个阶段之间按几何插值，避免台阶
    const sizeAt = (r, y) => { const s = stageAt(r, y); if (s >= 8) return SF[8]; const a = stageYear(s, r), b = stageYear(s + 1, r);
      if (s === 0) return 0; if (!(b < INF)) return SF[s] * (1 + 0.15 * clamp((y - a) / 800, 0, 1)); const f = clamp((y - a) / Math.max(1, b - a), 0, 1); return SF[s] * Math.pow(SF[s + 1] / SF[s], f); };
    const S = h.settlements, X = opt.cities || [];
    const nT = Math.floor(E / STEP) + 1;
    const T = j => Math.min(E, j * STEP);

    // ---------- 1. 现存聚落的建城年份 ----------
    const scores = S.map(s => s.score || 0).slice().sort((a, b) => b - a);
    const scoreRank = sc => { let lo = 0, hi = scores.length; while (lo < hi) { const m = (lo + hi) >> 1; if (scores[m] > sc) lo = m + 1; else hi = m; } return lo / Math.max(1, scores.length); };
    const inValley = new Map(); D.cradles.forEach((cr, ci) => cr.valley.forEach(r => inValley.set(r, ci)));
    const cities = S.map((s, k) => {
      const r = R.regionOf[s.cell] || 0, q = hash(k * 7919 + (h.seed | 0)), rank = scoreRank(s.score || 0);
      let need, jit;
      if (s.role === 'military-post') { need = 4; jit = 100 + 300 * q; }                  // 要塞关隘：有了领土国家才设防
      else if (s.newSeat) { need = Math.min(D.maxStage, 5); jit = 80 + 420 * q; }       // 新设县城：设治以后才有，多半在帝国、封建时代
      else if (s.type === 'market') { need = 4; jit = 60 + 500 * q; }                     // 集镇商镇：王国以后的市集
      else if (s.type === 'port' || s.type === 'island-port') { need = rank < 0.3 ? 2 : 3; jit = 40 + 300 * q + 300 * rank; }
      else { need = rank < 0.15 ? 2 : 3; jit = 30 + 260 * q + 320 * rank; }               // 今天的城镇多半早年就是村落
      if (r && inValley.has(r) && rank < 0.5) { need = Math.min(need, 2); jit *= 0.4; }  // 摇篮里的城市最古老
      let f = r ? stageYear(need, r) : INF;
      if (!(f < INF)) { for (let s2 = need - 1; s2 >= 1 && !(f < INF); s2--) f = r ? stageYear(s2, r) + 300 : INF; }
      f = f < INF ? f + jit : E - 80 - 260 * q;
      if (f > E - 120 && r && stageYear(2, r) < E - 400) f = stageYear(2, r) + (E - 120 - stageYear(2, r)) * (0.45 + 0.55 * q); // 推算太晚：在有人定居以后的时段里摊开
      f = clamp(f, r ? Math.min(stageYear(1, r), E - 200) : 0, E - 40); // 荒漠里的要塞：所在地从未有过农业，也要有个建城年份
      return { k, r, name: s.name, x: X[k] ? X[k].x : (R.cx[r] || 0), y: X[k] ? X[k].y : (R.cy[r] || 0), final: s.pop || 0, founded: Math.round(f), ruined: null, cause: null, type: s.type, tier: s.tier, role: s.role, fort: s.role === 'military-post', lost: false };
    });

    // ---------- 2. 古城：古文明故地上没能活到今天的城市 ----------
    const hasCity = new Set(); S.forEach(s => { if (s.tier !== 'site') hasCity.add(R.regionOf[s.cell]); });
    const presentPops = S.filter(s => s.tier !== 'site').map(s => s.pop).sort((a, b) => b - a);
    const bigPop = presentPops[Math.floor(presentPops.length * 0.08)] || 50000;
    D.ancient.forEach((a, ai) => {
      const zone = a.zone.filter(r => !hasCity.has(r) && R.weight[r] > 0 && stageYear(3, r) < a.fall);
      zone.sort((p, q) => (R.pot[q] * (1 + R.riverCells[q] * 3)) - (R.pot[p] * (1 + R.riverCells[p] * 3)) || p - q);
      const n = clamp(Math.round(a.zone.length / 7), 2, 5), pick = [];
      for (const r of zone) { if (pick.length >= n) break; if (pick.every(o => h.gdist(R.center[o], R.center[r]) > 3)) pick.push(r); }
      pick.forEach((r, i) => {
        const q = hash((ai + 1) * 104729 + i * 31 + (h.seed | 0));
        const lib = a.libObj; let nm = ''; for (const c of (lib.n && lib.n.cities) || []) if (!used.has(c)) { nm = c; break; } if (!nm) nm = G.NameGen.make(lib, 'city', used, () => hash(r * 31 + i * 7 + used.size)); used.add(nm);
        const founded = Math.round(clamp(stageYear(3, r) + 40 + 200 * q, stageYear(2, r), a.fall - 200));
        const cause = R.arid[r] + R.semiArid[r] * 0.6 > 0.4 ? 'sand' : R.river[r] >= 3 && q < 0.6 ? 'river' : q < 0.75 ? 'war' : 'abandon';
        const ruined = Math.round(clamp(a.fall + (cause === 'war' ? 0 : 60 + 380 * hash(r * 13 + i)), founded + 300, E - 300));
        const y0 = (R.center[r] / h.W) | 0, x0 = R.center[r] - y0 * h.W;
        cities.push({ k: -1, r, name: nm, x: (x0 + 0.5) * 2, y: (y0 + 0.5) * 2, final: 0, peak: Math.round(bigPop * (0.25 + 0.6 * q) / 10) * 10, founded, ruined, cause, type: 'ancient', tier: 'city', role: 'lost', fort: false, lost: true, ancient: ai });
      });
    });

    // ---------- 3. 大瘟疫 ----------
    const plagues = [];
    { const cont = (opt.labels || []).filter(l => l.type === 'continent');
      const nP = 3, at = [0.56, 0.73, 0.87];
      for (let i = 0; i < nP; i++) {
        const yP = Math.round(E * at[i] + (rnd() - 0.5) * E * 0.06);
        // 震中：当年人口最稠密、发展最高的区块之一
        let best = 0, bv = -1; for (let r = 1; r <= nR; r++) { const s = stageAt(r, yP); if (s < 4) continue; if (plagues.some(p => h.gdist(R.center[p.r], R.center[r]) * h.cellKm < 0.12 * 2 * Math.PI * h.R)) continue; const v = R.weight[r] * (1 + s) * (0.6 + 0.8 * hash(r * 17 + i)); if (v > bv) { bv = v; best = r; } }
        if (!best) continue;
        const radius = (0.16 + 0.1 * rnd()) * 2 * Math.PI * h.R, sev = 0.32 + 0.14 * rnd();
        let cn = ''; if (cont.length) { let bd = Infinity; for (const l of cont) { const dx0 = Math.abs(l.x - R.cx[best]), dx = Math.min(dx0, 2 * h.W - dx0), d = Math.hypot(dx, l.y - R.cy[best]); if (d < bd) { bd = d; cn = l.name; } } }
        plagues.push({ year: yP, r: best, radius, sev, cont: cn });
      } }
    const kmBetween = (a, b) => h.gdist(R.center[a], R.center[b]) * h.cellKm;
    const plagueMul = (r, y) => { let m = 1; for (const p of plagues) { if (y < p.year || y > p.year + 160) continue; const d = kmBetween(r, p.r); if (d > p.radius) continue; const hit = p.sev * (1 - 0.6 * d / p.radius); m *= 1 - hit * (1 - (y - p.year) / 160); } return m; };

    // ---------- 4. 人口曲线 ----------
    const holy = new Map(); D.relOrigin.forEach((o, f) => { if (o) holy.set(o, D.relFounded[f]); });
    const nC = cities.length, pop = new Float32Array(nC * nT);
    const rawAt = (c, y) => {
      if (y < c.founded) return 0;
      const r = c.r; if (!r) return 0.0001;
      let m = Math.max(0.004, sizeAt(r, y));
      m *= Math.min(1, 0.3 + 0.7 * (y - c.founded) / 180);                         // 建城之初的成长
      const ae = D.ancientOf[r] >= 0 ? D.ancientEnd[r] : -1;
      if (ae > 0) { if (y < ae) m *= 1.5; else m *= 0.45 + 0.55 * clamp((y - ae) / 700, 0, 1); } // 古文明的盛世与覆灭
      if (holy.has(r) && y >= holy.get(r)) m *= 1.2;                                // 宗教圣城
      m *= plagueMul(r, y);
      return m;
    };
    cities.forEach((c, i) => {
      if (!c.lost) { const end = rawAt(c, E) || 1e-6; for (let j = 0; j < nT; j++) pop[i * nT + j] = Math.round(c.final * rawAt(c, T(j)) / end); pop[i * nT + nT - 1] = c.final; return; }
      // 古城：盛于古文明，衰于其覆灭，废弃后归零
      let mx = 0; const raw = new Float64Array(nT); for (let j = 0; j < nT; j++) { const y = T(j); raw[j] = y < c.founded || y >= c.ruined ? 0 : rawAt(c, y) * (y > D.ancient[c.ancient].fall ? Math.max(0.15, 1 - (y - D.ancient[c.ancient].fall) / Math.max(60, c.ruined - D.ancient[c.ancient].fall)) : 1); if (raw[j] > mx) mx = raw[j]; }
      for (let j = 0; j < nT; j++) pop[i * nT + j] = mx ? Math.round(c.peak * raw[j] / mx) : 0;
    });
    const popAt = (i, y) => { const t = y / STEP, j = Math.min(nT - 2, Math.floor(t)), f = t - j; return pop[i * nT + j] * (1 - f) + pop[i * nT + j + 1] * f; };
    cities.forEach((c, i) => { let mx = 0, my = 0; for (let j = 0; j < nT; j++) if (pop[i * nT + j] > mx) { mx = pop[i * nT + j]; my = T(j); } c.peakPop = Math.round(mx); c.peakYear = my; });

    // ---------- 5. 道路年代 ----------
    // 干道（王道、驿道）王国时代就修，最早连起各大城；支线随王国、帝国的设治铺开；乡道随城镇建立陆续出现
    const REQ = { trunk: 4, regional: 4, local: 3 }, LAG = { trunk: [20, 110], regional: [40, 200], local: [50, 280] };
    const roads = (h.roads || []).map((rd, k) => {
      const q = hash(k * 2741 + (h.seed | 0)), q2 = hash(k * 7919 + 13 + (h.seed | 0));
      const fa = rd.sa >= 0 ? cities[rd.sa].founded : 0, fb = rd.sb >= 0 ? cities[rd.sb].founded : 0, lo = Math.max(fa, fb);
      const ra = rd.a >= 0 ? R.regionOf[rd.a] : 0, rb = rd.b >= 0 ? R.regionOf[rd.b] : 0, need = REQ[rd.imp] || 4, lag = LAG[rd.imp] || LAG.regional;
      let sy = Math.max(ra ? stageYear(need, ra) : 0, rb ? stageYear(need, rb) : 0);
      if (!(sy < INF)) sy = Math.max(ra ? stageYear(3, ra) : 0, rb ? stageYear(3, rb) : 0);
      let y = Math.max(lo, sy < INF ? sy : lo + 150) + lag[0] + (lag[1] - lag[0]) * q;
      if (y > E - 20) y = lo >= E - 60 ? lo + (E - 10 - lo) * (0.3 + 0.5 * q2) : lo + 30 + (E - 25 - lo - 30) * (0.15 + 0.85 * q2); // 推算晚于现在：摊到建城与现在之间，不挤在最后
      return { imp: rd.imp, year: Math.round(Math.min(y, E - 5)), lines: rd.lines, sa: rd.sa, sb: rd.sb };
    }).filter(r => r.lines && r.lines.length).sort((a, b) => a.year - b.year);

    // ---------- 6. 编年史 ----------
    const real = cities.map((c, i) => [c, i]).filter(([c]) => !c.fort);
    // 最古老的城市
    { const old = real.filter(([c]) => !c.lost).sort((a, b) => a[0].founded - b[0].founded)[0]; if (old) ev(old[0].founded, 'found', `${old[0].name}建城，这是世上延续至今最古老的城市`, old[0].r, { city: old[1] }); }
    // 今天最大的二十座城市的建城
    real.filter(([c]) => !c.lost).sort((a, b) => b[0].final - a[0].final).slice(0, 20).forEach(([c, i]) => { if (events.some(e => e.city === i)) return; ev(c.founded, 'found', `${c.name}建城`, c.r, { city: i }); });
    // 古城的兴与废
    real.filter(([c]) => c.lost).forEach(([c, i]) => { ev(c.founded, 'found', `${c.name}建城（${D.ancient[c.ancient].name}）`, c.r, { city: i }); ev(c.ruined, 'ruin', `${c.name}${CAUSE[c.cause]}，沦为废墟`, c.r, { city: i }); });
    // 大瘟疫
    plagues.forEach(p => { let big = -1, bp = 0; real.forEach(([c, i]) => { if (c.r === p.r) { const v = popAt(i, p.year); if (v > bp) { bp = v; big = i; } } }); ev(p.year, 'plague', `大瘟疫自${big >= 0 ? cities[big].name : '某地'}蔓延${p.cont ? '，' + p.cont + '一带' : '，各地'}城市人口锐减`, p.r); });
    // 现在的等级门槛（用于按人口推算各年代的城市等级）
    const tierMin = t => { let m = Infinity; S.forEach(s => { if (s.tier === t && s.pop < m) m = s.pop; }); return m < Infinity ? m : null; };
    return {
      cities: cities.map(c => ({ name: c.name, x: c.x, y: c.y, r: c.r, founded: c.founded, ruined: c.ruined, cause: c.cause ? CAUSE[c.cause] : null, type: c.type, tier: c.tier, fort: c.fort, lost: c.lost, ancient: c.lost ? c.ancient : -1, idx: c.k, peakPop: c.peakPop, peakYear: c.peakYear, final: c.final })),
      pop, popStep: STEP, popN: nT, E, roads, plagues: plagues.map(p => ({ year: p.year, x: R.cx[p.r], y: R.cy[p.r], cont: p.cont })), events,
      tiers: { metropolis: tierMin('metropolis'), city: tierMin('city') }
    };
  }

  // 人口里程碑与世界第一大城（在政权推演改完人口曲线之后统计）；同时刷新各城的鼎盛年份
  function milestones(C) {
    const out = [], nT = C.popN, pop = C.pop, T = j => Math.min(C.E, j * C.popStep), cities = C.cities;
    cities.forEach((c, i) => { let mx = 0, my = 0; for (let j = 0; j < nT; j++) if (pop[i * nT + j] > mx) { mx = pop[i * nT + j]; my = T(j); } c.peakPop = Math.round(mx); c.peakYear = my; });
    const real = cities.map((c, i) => [c, i]).filter(([c]) => !c.fort);
    const marks = [[1e5, '十万'], [5e5, '五十万'], [1e6, '百万']]; let lead = -1, leadSince = 0;
    for (let j = 0; j < nT; j++) { const y = T(j); let b = -1, bv = 0; for (const [, i] of real) { const v = pop[i * nT + j]; if (v > bv) { bv = v; b = i; } }
      for (const m of marks) if (!m.done && bv >= m[0]) { m.done = true; out.push({ year: y, kind: 'milestone', text: `${cities[b].name}人口突破${m[1]}，是世上第一座这样的城市`, r: cities[b].r, city: b }); }
      if (b >= 0 && b !== lead && bv > 2e4) { if (lead >= 0 && y - leadSince < 150) { lead = b; leadSince = y; continue; } if (lead >= 0) out.push({ year: y, kind: 'leader', text: `${cities[b].name}超过${cities[lead].name}，成为世界第一大城（约 ${fmtPop(bv)}）`, r: cities[b].r, city: b }); lead = b; leadSince = y; } }
    return out;
  }

  G.HistoryCities = { run, milestones };
})(typeof self !== 'undefined' ? self : this);
