/* 政权推演（第三阶段）：在区块图上逐十年推演国家的兴起、争霸、统一、分裂、改朝换代、复国与外族入主，
 * 最后一段把推演结果对账到现在的国家（最后一年的疆域严格等于现在）。首都与战争反过来影响城市人口。
 *  - 国力 = 领土上各区块的人口 × 发展阶段，乘以凝聚力；投送到目标区块时随离首都的距离衰减（距离尺度随时代变大）；
 *  - 每个时代有规模上限（城邦 1–2 块、王国十来块、帝国几十块）；超出上限、统治异族、王朝老去都会消磨凝聚力；
 *  - 凝聚力耗尽：大国分裂（分出去的国家对母国故土持有法统宣称），小国改朝换代；
 *  - 统治满 150 年的区块成为该国统（lineage）的核心；夺回已亡之国大部分核心且同文明 → 复国；
 *  - 游牧政权攻下农耕大国的都城 → 外族入主，整国易主；
 *  - 终局对账：按重叠找每个现存国家的前身（继承者），没有前身的在晚期独立或兴起；各区块按离继承者核心由近到远依次易手。
 * 事件先记下参与者，等全部推演完、沿世系起好名字后再生成文字。 */
(function (G) {
  'use strict';
  const TICK = 10;
  const SFV = [0, 0.15, 0.35, 0.7, 1, 1.3, 1.45, 1.8, 2.4];          // 各阶段的区块价值（相对人口）
  const REACH = [0, 60, 120, 260, 600, 1300, 1000, 2100, 3400];     // 各阶段首都的投送距离尺度（km）
  const CAP = [0, 0, 1, 2, 9, 34, 24, 46, 70];                      // 各阶段的规模上限（区块数，按世界大小缩放）
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function run(h, R, D, C, opt) {
    const { NN, E, Y } = D, nR = R.nR, rnd = mulberry32((h.seed | 0) + 7777);
    const scale = clamp(nR / 1400, 0.6, 3);
    const countries = opt.countries || [];
    const center = R.center;
    // 区块中心的三维单位向量：两点间距离用弦长近似（比格距函数快得多）
    const UX = new Float64Array(nR + 1), UY = new Float64Array(nR + 1), UZ = new Float64Array(nR + 1);
    for (let r = 1; r <= nR; r++) { const lon = R.cx[r] / (2 * h.W) * 2 * Math.PI, lat = (0.5 - R.cy[r] / (2 * h.H)) * Math.PI; UX[r] = Math.cos(lat) * Math.cos(lon); UY[r] = Math.cos(lat) * Math.sin(lon); UZ[r] = Math.sin(lat); }
    const kmBetween = (a, b) => { const dx = UX[a] - UX[b], dy = UY[a] - UY[b], dz = UZ[a] - UZ[b]; return Math.sqrt(dx * dx + dy * dy + dz * dz) * h.R; };
    const stageAt = (r, y) => { let s = 0; for (let k = 1; k <= 8; k++) if (Y[k * NN + r] <= y) s = k; else break; return s; };
    const cultAt = (r, y) => { const a = D.ancientOf[r]; if (a >= 0 && y < D.ancientEnd[r]) return -2 - a; if (R.civ[r] >= 0 && y >= D.civArr[r]) return R.civ[r]; return -1; };
    const civOfNew = (r, y) => { const c = cult[r]; return c === -1 && R.civ[r] >= 0 ? R.civ[r] : c; }; // 文明尚未到达时建立的国家，归入日后占据此地的文明
    const styleCache = new Map(); // 文化库的政府组织风格：官僚 / 封建 / 部族 / 商贸 / 神庙
    function styleOf(cu) { if (styleCache.has(cu)) return styleCache.get(cu); const lib = cu >= 0 ? h.civLib[cu] : cu <= -2 ? D.ancient[-2 - cu].libObj : null; const st = lib && G.CultureExt ? G.CultureExt.ext(lib).gov.style : 'feudal'; styleCache.set(cu, st); return st; }
    const typeOfCult = cu => cu >= 0 ? D.civType[cu] : cu <= -2 ? D.ancient[-2 - cu].type : 'tribal';
    let wsum = 0; for (let r = 1; r <= nR; r++) wsum += R.weight[r]; const wmean = wsum / nR || 1;
    // 城市（含古城）按区块
    const cityIn = Array.from({ length: nR + 1 }, () => []); C.cities.forEach((c, i) => { if (c.r && !c.fort) cityIn[c.r].push(i); });
    const nT = C.popN, popAt = (i, y) => { const t = y / C.popStep, j = Math.min(nT - 2, Math.max(0, Math.floor(t))), f = Math.min(1, t - j); return C.pop[i * nT + j] * (1 - f) + C.pop[i * nT + j + 1] * f; };
    const alive = (c, y) => y >= c.founded && !(c.ruined && y >= c.ruined);
    const bigCity = (r, y) => { let b = -1, bp = 0; for (const i of cityIn[r]) { const c = C.cities[i]; if (!alive(c, y)) continue; const p = popAt(i, y); if (p > bp) { bp = p; b = i; } } return b; };
    const regionPop = (r, y) => { let s = 0; for (const i of cityIn[r]) if (alive(C.cities[i], y)) s += popAt(i, y); return s; };
    const eSea = new Uint8Array(R.nbr.length), eRough = new Float32Array(R.nbr.length); for (let k = 0; k < R.nbr.length; k++) { const ed = R.edges[R.eid[k]]; eSea[k] = ed.sea ? 1 : 0; eRough[k] = Math.min(4, ed.rough || 0); }
    const neighbors = (r, fn) => { for (let k = R.off[r]; k < R.off[r + 1]; k++) fn(R.nbr[k], R.edges[R.eid[k]]); };

    // ---------- 状态 ----------
    const P = [];                                   // 政权
    const owner = new Int32Array(nR + 1).fill(-1);
    const linOwnSince = new Float64Array(nR + 1), coreLin = new Int32Array(nR + 1).fill(-1);
    const log = [];                                 // [region, year, owner]
    const events = [];                              // 先记参与者，后生成文字
    const sacks = [];                               // [city, year, severity]
    let linSeq = 0;
    const ev = (year, kind, o) => events.push(Object.assign({ year: Math.round(year), kind }, o));
    // ---------- 省份：以“现在的省”为积木（区块不跨现在的省界），历史上的省由若干积木拼成 ----------
    const presentProv = opt.provinces || [], nPP = presentProv.length;
    const unitOf = new Int32Array(nR + 1).fill(-1); let nU = nPP;
    for (let r = 1; r <= nR; r++) if (R.prov[r] >= 0) unitOf[r] = R.prov[r];
    for (let r = 1; r <= nR; r++) { if (unitOf[r] >= 0 || R.weight[r] <= 0) continue; const u = nU++, q = [r]; unitOf[r] = u; // 边疆：同一分区里 4 块一组
      for (let i = 0; i < q.length && q.length < 4; i++) for (let k = R.off[q[i]]; k < R.off[q[i] + 1] && q.length < 4; k++) { const b = R.nbr[k]; if (unitOf[b] < 0 && R.weight[b] > 0 && R.zoneOfRegion[b] === R.zoneOfRegion[r]) { unitOf[b] = u; q.push(b); } } }
    const prov = new Int32Array(nR + 1).fill(-1), prevProv = new Int32Array(nR + 1).fill(-1), prevOwner = new Int32Array(nR + 1).fill(-1), occSince = new Float64Array(nR + 1);
    const PV = [], pvLog = [], fromStateMade = new Set();
    const unrest = new Float32Array(nR + 1), cause = new Uint8Array(nR + 1), famine = new Float32Array(nR + 1), tradition = new Uint8Array(nR + 1), memLin = new Int32Array(nR + 1).fill(-1);
    const rndU = mulberry32((h.seed | 0) + 4242), unrestSamples = [], lastFam = new Float64Array(nR + 1).fill(-1e9), calmUntil = new Float64Array(nR + 1);
    // 大航海与殖民：新大陆（与旧大陆隔海、很晚才被卷入的大陆）
    const isNW = r => R.newW[r] > 0.5, nwCoast = []; for (let r = 1; r <= nR; r++) if (isNW(r) && R.coast[r] && R.weight[r] > 0) nwCoast.push(r);
    const rndK = mulberry32((h.seed | 0) + 6161); let colonialAge = null;
    const vuln = new Float32Array(nR + 1); for (let r = 1; r <= nR; r++) vuln[r] = R.weight[r] > 0 ? 0.1 + 0.45 * R.arid[r] + 0.25 * R.semiArid[r] + (R.river[r] >= 3 ? 0.2 : 0) : 0;
    const TS = [0, 0, 0, 0, 4, 4, 4, 3, 1], MAXN = [0, 0, 0, 0, 8, 8, 7, 6, 5]; // 各阶段一省的目标与上限（区块数）
    function setProv(r, v, y) { if (prov[r] === v) return; if (prov[r] >= 0) { const X = PV[prov[r]]; X.n--; if (!X.n) X.zeroSince = y; } prov[r] = v; if (v >= 0) PV[v].n++; pvLog.push(r, y, v); }
    function provOwner(v, p, y, kind) { const X = PV[v]; if (X.owner === p) return; X.owner = p; X.hist.push(y, p, kind); }
    function newProv(y, p, seat, kind, parents, extra) { const id = PV.length; PV.push(Object.assign({ id, created: y, abolished: null, owner: p, seat, seats: [[y, seat]], kind, parents: parents || [], children: [], n: 0, hist: [y, p, kind], stage: stageAt(seat, y), present: -1, fromState: -1, zeroSince: y }, extra || {}));
      for (const pa of PV[id].parents) if (PV[pa]) PV[pa].children.push(id); return id; }
    const bigRegion = (list, y) => { let b = list[0], bv = -1; for (const r of list) { const v = regionPop(r, y) + R.weight[r] * 1e-3; if (v > bv) { bv = v; b = r; } } return b; };
    function organize(p, y, quiet) { // 初置行省：按大城市把全国的积木拼成若干省
      const own = []; for (let r = 1; r <= nR; r++) if (owner[r] === p) own.push(r);
      const byU = new Map(); for (const r of own) { const u = unitOf[r] >= 0 ? unitOf[r] : -1 - r; if (!byU.has(u)) byU.set(u, []); byU.get(u).push(r); }
      const units = [...byU.keys()].sort((a, b) => (regionPop(bigRegion(byU.get(b), y), y)) - (regionPop(bigRegion(byU.get(a), y), y)) || a - b);
      const uOf = r => unitOf[r] >= 0 ? unitOf[r] : -1 - r, done = new Set(), ts = TS[Math.max(4, Math.min(8, stageAt(P[p].cap, y)))]; let made = 0;
      for (const u0 of units) { if (done.has(u0)) continue; const grp = [u0]; done.add(u0); let size = byU.get(u0).length;
        for (let i = 0; i < grp.length && size < ts; i++) for (const r of byU.get(grp[i])) { for (let k = R.off[r]; k < R.off[r + 1] && size < ts; k++) { const b = R.nbr[k]; if (owner[b] !== p) continue; const ub = uOf(b); if (done.has(ub)) continue; done.add(ub); grp.push(ub); size += byU.get(ub).length; } }
        const regs = grp.flatMap(u => byU.get(u)), v = newProv(y, p, bigRegion(regs, y), 'establish'); for (const r of regs) setProv(r, v, y); made++; }
      P[p].org = y; if (made >= 2 && !quiet) ev(y, 'organize', { p, n: made, r: P[p].cap });
    }
    function splitProv(v, y) { // 析置：一省太大，拆出新省（第二大城为治所）
      const X = PV[v], regs = []; for (let r = 1; r <= nR; r++) if (prov[r] === v) regs.push(r); if (regs.length < 4) return;
      let s2 = -1, bv = -1; for (const r of regs) { if (r === X.seat) continue; const d = kmBetween(r, X.seat), val = (regionPop(r, y) + 1) * d; if (val > bv) { bv = val; s2 = r; } } if (s2 < 0) return;
      const part = new Map([[X.seat, 0], [s2, 1]]), q = [X.seat, s2]; for (let i = 0; i < q.length; i++) { const a = q[i]; for (let k = R.off[a]; k < R.off[a + 1]; k++) { const b = R.nbr[k]; if (prov[b] === v && !part.has(b)) { part.set(b, part.get(a)); q.push(b); } } }
      const nv = newProv(y, X.owner, s2, 'split', [v]); let moved = 0; for (const r of regs) if (part.get(r) === 1) { setProv(r, nv, y); moved++; }
      if (moved) ev(y, 'provSplit', { pv: v, nv, p: X.owner, r: s2 });
    }
    function admin(y) { // 军管满二十年的新占领土地：改隶 / 以国为省 / 并入邻省 / 新设一省
      for (let r = 1; r <= nR; r++) {
        const p = owner[r]; if (p < 0 || !P[p].org || prov[r] >= 0 || y - occSince[r] < 20) continue;
        const X = prevProv[r];
        if (X >= 0 && PV[X].abolished === null && (PV[X].n === 0 || PV[X].owner === p)) { const q0 = PV[X].owner; if (q0 !== p) { provOwner(X, p, y, 'conquer'); if (PV[X].n === 0) ev(y, 'transfer', { pv: X, p, q: q0, r }); } setProv(r, X, y); continue; }
        const q = prevOwner[r];
        if (q >= 0 && P[q].died !== null && !P[q].org && P[q].peakN >= 2 && !fromStateMade.has(q)) { // 以国为省
          const regs = []; for (let k = 1; k <= nR; k++) if (owner[k] === p && prov[k] < 0 && prevOwner[k] === q) regs.push(k);
          const seat = regs.includes(P[q].cap) ? P[q].cap : bigRegion(regs, y), v = newProv(y, p, seat, 'from-state', [], { fromState: q }); for (const k of regs) setProv(k, v, y); fromStateMade.add(q); ev(y, 'fromState', { p, q, pv: v, r: seat }); continue; }
        let best = -1, bn = 1e9; for (let k = R.off[r]; k < R.off[r + 1]; k++) { const b = R.nbr[k]; if (owner[b] === p && prov[b] >= 0 && PV[prov[b]].n < bn) { bn = PV[prov[b]].n; best = prov[b]; } }
        if (best >= 0) { setProv(r, best, y); if (PV[best].n > MAXN[Math.max(4, Math.min(8, stageAt(P[p].cap, y)))]) splitProv(best, y); continue; }
        const regs = [r], seen = new Set([r]); for (let i = 0; i < regs.length; i++) for (let k = R.off[regs[i]]; k < R.off[regs[i] + 1]; k++) { const b = R.nbr[k]; if (!seen.has(b) && owner[b] === p && prov[b] < 0) { seen.add(b); regs.push(b); } }
        const v = newProv(y, p, bigRegion(regs, y), 'establish'); for (const k of regs) setProv(k, v, y);
      }
      for (const X of PV) if (X.abolished === null && X.n === 0 && y - X.zeroSince >= 80) X.abolished = y; // 空了八十年无人收复：撤省
    }
    function secedeProvince(p, y, reachP) { // 割据：远离都城或住着异族的省自立
      const q = P[p]; let best = -1, bs = 0;
      for (const X of PV) { if (X.abolished !== null || X.owner !== p || X.n === 0 || prov[q.cap] === X.id) continue; const sc = kmBetween(X.seat, q.cap) / reachP + (cult[X.seat] !== q.civ ? 0.6 : 0); if (sc > bs) { bs = sc; best = X.id; } }
      if (best < 0 || bs < 1) return;
      const X = PV[best], c = newPolity(y, X.seat, [{ id: p, kind: 'secede' }], creole(X.seat, q, y)); P[c].org = y; P[c].claimLin = q.lin; P[c].claimUntil = y + 300; P[c].coh = 0.8;
      for (let r = 1; r <= nR; r++) if (prov[r] === best && owner[r] === p) setOwner(r, c, y, true);
      q.coh = Math.max(0, q.coh - 0.04); ev(y, 'provSecede', { p: c, q: p, pv: best, r: X.seat });
    }
    function reform(y) { // 改行今制：每个现在的省找到历史上的前身（重叠最多者），没有的新设；最后一年的省份即现在的省份
      const target = new Int32Array(nPP).fill(-1), overlap = new Map();
      for (let r = 1; r <= nR; r++) { const k = R.prov[r]; if (k < 0 || owner[r] < 0 || prov[r] < 0) continue; const key = prov[r] * 65536 + k; overlap.set(key, (overlap.get(key) || 0) + R.weight[r] + 1e-6); }
      const pairs = [...overlap].map(([key, w]) => [Math.floor(key / 65536), key % 65536, w]).sort((a, b) => b[2] - a[2] || a[0] - b[0] || a[1] - b[1]), usedPV = new Set();
      for (const [v, k] of pairs) { if (target[k] >= 0 || usedPV.has(v)) continue; target[k] = v; usedPV.add(v); PV[v].present = k; }
      const parentsOf = new Map(); for (const [v, k] of pairs) { if (!parentsOf.has(k)) parentsOf.set(k, []); parentsOf.get(k).push(v); }
      const perOwner = new Map();
      for (let r = 1; r <= nR; r++) { const k = R.prov[r]; if (owner[r] < 0) { setProv(r, -1, y); continue; } let kk = k;
        if (kk < 0) { for (let j = R.off[r]; j < R.off[r + 1]; j++) { const b = R.nbr[j]; if (R.country[b] === R.country[r] && R.prov[b] >= 0) { kk = R.prov[b]; break; } } if (kk < 0) continue; }
        if (target[kk] < 0) { const seatR = (() => { const s0 = presentProv[kk] && h.settlements[presentProv[kk].seat]; return s0 ? R.regionOf[s0.cell] || r : r; })(); target[kk] = newProv(y, owner[r], seatR, 'reform', parentsOf.get(kk) || []); PV[target[kk]].present = kk; }
        const v = target[kk]; provOwner(v, owner[r], y, 'reform'); setProv(r, v, y); perOwner.set(owner[r], (perOwner.get(owner[r]) || new Set()).add(v)); }
      for (let k = 0; k < nPP; k++) { const v = target[k]; if (v < 0) continue; const s0 = presentProv[k] && h.settlements[presentProv[k].seat]; if (s0 && R.regionOf[s0.cell]) { const sr = R.regionOf[s0.cell]; if (PV[v].seat !== sr) { PV[v].seat = sr; PV[v].seats.push([y, sr]); } } }
      for (const X of PV) if (X.abolished === null && X.n === 0) X.abolished = y;
      return perOwner;
    }

    // ---------- 文化与宗教的动态：自然传播、被统治者同化、游牧部族随军迁徙；宗教传教扩散、国教推行改宗 ----------
    const rndC = mulberry32((h.seed | 0) + 8888);   // 独立的随机流：不扰动政权推演
    const cult = new Int32Array(nR + 1).fill(-1), rel = new Int32Array(nR + 1).fill(-1), cLog = [], rLog = [];
    const setCult = (r, c, y) => { if (cult[r] === c) return; cult[r] = c; cLog.push(r, y, c); };
    const setRel = (r, f, y) => { if (rel[r] === f) return; rel[r] = f; rLog.push(r, y, f); };
    // 宗教：来自宗教库（类型、传播方式、派别与异端）；推演中可能发生教派分裂，新教派追加在列表末尾
    const RELS = (opt.religions || []).map((r, f) => Object.assign({}, r, { founded: D.relFounded[f], origin: D.relOrigin[f], parent: -1, depth: 0 }));
    let nRel = RELS.length; const RCAP = nRel + 40, relOn = new Uint8Array(RCAP), relCnt = new Float64Array(RCAP), holyOf = new Int32Array(nR + 1).fill(-1);
    RELS.forEach((o, f) => { if (o.origin) holyOf[o.origin] = f; o.cult = o.origin ? R.civ[o.origin] : -1; o.usedBr = new Set(); o.lastSchism = -1e9; });
    const SPREAD_N = { missionary: 1.35, ethnic: 1, syncretic: 0.85 }, SPREAD_S = { missionary: 1.15, ethnic: 1, syncretic: 0.8 };
    const relTypeOf = f => f >= 0 && RELS[f] ? RELS[f].type : null, relSpreadOf = f => f >= 0 && RELS[f] ? RELS[f].spread : null;
    const ethnicMul = (f, r) => relSpreadOf(f) === 'ethnic' && RELS[f].cult >= 0 && cult[r] !== RELS[f].cult ? 0.25 : 1; // 民族宗教：难以传给外族
    function stepCR(y, gf) {
      for (let f = 0; f < nRel; f++) if (!relOn[f] && y >= RELS[f].founded && RELS[f].origin) { relOn[f] = 1; setRel(RELS[f].origin, f, y); }
      for (let r = 1; r <= nR; r++) {
        // 文化
        const c = cult[r], fin = R.civ[r];
        if (c === -1) { const b = cultAt(r, y); if (b !== -1) setCult(r, b, y); }
        else if (c <= -2 && y >= D.ancientEnd[r]) setCult(r, fin >= 0 ? fin : -1, y);
        else {
          const p = owner[r];
          if (p >= 0) { const rc = P[p].civ; if (rc !== c && rc !== -1 && !(rc <= -2 && ancientFallen.has(-2 - rc))) { // 被异族长期统治，慢慢同化
              let pr = isNW(r) && (!isNW(P[p].cap) || P[p].colonialFrom !== undefined) ? 0.07 : 0.009 * clamp((y - linOwnSince[r] - 100) / 300, 0, 1) * (sg[r] >= 5 ? 1.4 : 1); /* 殖民地：移民随宗主国而来，同化快 */ if (rc === fin) pr *= 1 + 3 * gf; if (c === fin) pr *= 1 - 0.85 * gf; if (pr > 0 && rndC() < pr) setCult(r, rc, y); } }
          if (gf > 0 && cult[r] !== fin && fin >= 0) { let nb = 0, nf = 0; for (let k = R.off[r]; k < R.off[r + 1]; k++) { nb++; if (cult[R.nbr[k]] === fin) nf++; } if (nf && rndC() < 0.006 * gf * nf / nb) setCult(r, fin, y); }
        }
        // 宗教：有文化的地方才有信仰；邻近的宗教传教扩散，国教在本国推行改宗
        if (cult[r] === -1 || sg[r] < 1) continue;
        const cur = rel[r], rf = R.rel[r]; if (cur >= 0 && holyOf[r] === cur) continue; relCnt.fill(0); let nb = 0; /* 宗教发源地（圣地）不改宗 */
        for (let k = R.off[r]; k < R.off[r + 1]; k++) { const g = rel[R.nbr[k]]; nb++; if (g >= 0) relCnt[g]++; }
        let best = -1, bp = 0;
        for (let g = 0; g < nRel; g++) { if (!relCnt[g] || g === cur) continue; let pr = 1 - Math.pow(1 - (cur === -1 ? 0.2 : 0.05) * (SPREAD_N[relSpreadOf(g)] || 1) * ethnicMul(g, r), relCnt[g]); /* 每个已改宗的邻居都带来一份皈依的机会；传教型更快，民族宗教难传外族 */ if (g === rf) pr *= 1 + 3 * gf; if (cur === rf) pr *= 1 - 0.85 * gf; if (pr > bp) { bp = pr; best = g; } }
        const p = owner[r]; if (p >= 0) { const sr = rel[P[p].cap]; if (sr >= 0 && sr !== cur) { let pr = (P[p].theo !== undefined ? 1.8 : 1) * (SPREAD_S[relSpreadOf(sr)] || 1) * ethnicMul(sr, r) * (isNW(r) && (!isNW(P[p].cap) || P[p].colonialFrom !== undefined) ? 0.15 : 0.04 * clamp((y - linOwnSince[r]) / 200, 0.25, 1) * (cur === -1 ? 1.5 : 1)); /* 殖民地：传教士随宗主国而来 */ if (sr === rf) pr *= 1 + 3 * gf; if (cur === rf) pr *= 1 - 0.85 * gf; if (pr > bp) { bp = pr; best = sr; } } }
        if (best >= 0 && rndC() < bp) setRel(r, best, y);
      }
    }
    function creole(seat, q, y) { return isNW(seat) && typeOfCult(q.civ) !== 'new-world' ? q.civ : civOfNew(seat, y); } // 殖民地分立出来的是移民国家：随母国的文明
    function newPolity(y, cap, parents, civ, lin) {
      const id = P.length;
      P.push({ id, born: y, died: null, cap, caps: [{ year: y, city: bigCity(cap, y), r: cap }], parents: parents || [], children: [], civ, lin: lin === undefined ? linSeq++ : lin,
        dynStart: y, coh: 0.8, n: 0, peakN: 0, peakYear: y, claimLin: -1, claimUntil: 0, restored: false, heirOf: -1, ext: [], liege: -1, vas: [] });
      for (const pa of P[id].parents) if (P[pa.id]) P[pa.id].children.push({ id, kind: pa.kind });
      return id;
    }
    // ---------- 宗藩：附庸保有自己的疆土与朝廷，向宗主称臣纳贡；同一宗藩体系内互不攻伐 ----------
    function setLiege(v, l, y, kind, quiet) { const V = P[v]; if (V.liege === l) return; const old = V.liege; V.liege = l; V.vas.push(y, l); V.vasSince = y;
      if (!quiet) { if (l >= 0) ev(y, 'vassal', { p: l, q: v, r: V.cap, how: kind || 'submit' }); else if (old >= 0) ev(y, kind === 'annexV' ? 'vassalAnnex' : 'vassalFree', { p: old, q: v, r: V.cap }); } }
    const feudal = (st, y) => (st === 6 && y < 4350) || (st >= 4 && st <= 5 && y >= 3400 && y < 4350); // 第 4350 年（≈ 1350 年）以后不再新封附庸 // 封建宗藩：封建阶段，或中世纪年代的王国与帝国
    const topLiege = p => { let x = p; for (let g = 0; g < 8 && P[x].liege >= 0; g++) x = P[x].liege; return x; };
    function setOwner(r, p, y, keep) { // keep：疆域整体易主（改朝换代、分裂、外族入主、割据），省份随之改隶；否则新占领的土地先进入军管
      const old = owner[r]; if (old === p) return;
      const pv = prov[r];
      if (keep) { if (pv >= 0 && p >= 0) provOwner(pv, p, y, 'inherit'); }
      else { if (pv >= 0) { prevProv[r] = pv; setProv(r, -1, y); } prevOwner[r] = old; occSince[r] = y; }
      owner[r] = p; log.push(r, y, p);
      if (old >= 0) P[old].n--;
      if (p >= 0) { P[p].n++; if (P[p].n > P[p].peakN) { P[p].peakN = P[p].n; P[p].peakYear = y; } }
      const nl = p >= 0 ? P[p].lin : -1, ol = old >= 0 ? P[old].lin : -1; if (nl !== ol) linOwnSince[r] = y;
    }
    function moveCapital(p, y, why, to) {
      const q = P[p]; let best = to === undefined ? -1 : to, bv = -1;
      if (best < 0) for (let r = 1; r <= nR; r++) if (owner[r] === p) { const v = regionPop(r, y) + R.weight[r] * 1e-3; if (v > bv) { bv = v; best = r; } }
      if (best < 0 || (best === q.cap && (why !== 'found' || q.caps[q.caps.length - 1].city >= 0))) return;
      q.lastCapMove = y;
      q.cap = best; const city = bigCity(best, y); q.caps.push({ year: y, city, r: best });
      if (q.peakN >= 3 && city >= 0) ev(y, 'capital', { p, city, r: best, why });
    }
    function kill(q, y, by, kind) {
      const Q = P[q]; if (Q.died !== null) return; Q.died = y;
      Q.coreAtDeath = []; for (let r = 1; r <= nR; r++) if (coreLin[r] === Q.lin) Q.coreAtDeath.push(r);
      if (by >= 0) { Q.children.push({ id: by, kind: kind === 'integrate' ? 'conquer' : kind || 'conquer' }); if (Q.peakN >= 3 && kind !== 'integrate') ev(y, 'annex', { p: by, q, r: Q.cap, n: Q.peakN }); }
    }

    // ---------- 时间轴 ----------
    let ys = Infinity; for (const cr of D.cradles) ys = Math.min(ys, Y[3 * NN + cr.region]); for (let r = 1; r <= nR; r++) ys = Math.min(ys, Y[3 * NN + r]);
    ys = Math.max(0, Math.floor((isFinite(ys) ? ys : E * 0.3) / TICK) * TICK);
    // 历史一路自由推演到现在：不再向事先生成的地图收拢；现在的政治地图由历史的终局写回（见 apply.js）
    const T0 = E + TICK, TG = Infinity;
    const sg = new Int8Array(nR + 1), v = new Float64Array(nR + 1);
    const habitable = r => R.weight[r] > 0;
    const ancientFallen = new Set();
    const NAMEBIG = 8 * scale;

    const stepStage = y => { for (let r = 1; r <= nR; r++) { let s0 = sg[r]; while (s0 < 8 && Y[(s0 + 1) * NN + r] <= y) s0++; sg[r] = s0; } };
    for (let y = 0; y < ys; y += TICK) { stepStage(y); stepCR(y, 0); } // 第一批城邦之前：只有文化与宗教在传播
    // ---------- 思潮与国力：军事思潮决定战场上的优势，治理思潮决定官僚体系的水平；只是加成，人口与疆土仍是根本 ----------
    const IDX = {}; D.IDEAS.forEach((I, k) => IDX[I.id] = k);
    const MILW = { iron: 1, feudal: 0.5, gunpowder: 1.5, manufactory: 0.5 }, ADMW = { bureau: 1, law: 0.5, coin: 0.5, academy: 0.5, print: 0.5 };
    const has = (id, r, y) => IDX[id] !== undefined && D.ideaA[IDX[id] * NN + r] <= y;
    const milAt = (r, y) => { let m = 0; for (const id in MILW) if (has(id, r, y)) m += MILW[id]; return m; };
    const admAt = (r, y) => { let m = 0; for (const id in ADMW) if (has(id, r, y)) m += ADMW[id]; return m; };
    const ideaShare = new Float64Array(D.IDEAS.length); let shareYear = -1e9, totW = 0; for (let r = 1; r <= nR; r++) totW += R.weight[r];
    const lagAt = (r, y) => { let n = 0; for (let k = 0; k < D.IDEAS.length; k++) if (ideaShare[k] > 0.5 && !D.IDEAS[k].opt && D.ideaA[k * NN + r] > y) n++; return n; }; // 世上过半人口已接纳、此地尚未接纳的思潮
    // 国家数调节：后三分之一时间里，当世国家数向设定值靠拢（太少则大国易裂、远省易割据；太多则小国易被兼并）
    const TARGET = h.targetCountries || 0; let frag = 0, cons = 0;
    for (let y = ys; y <= E; y += TICK) {
      stepCR(y, 0);
      if (TARGET) { let n = 0; for (const q of P) if (q.died === null && q.n > 0 && !q.rebel) n++; const sF = clamp((y - 0.5 * E) / (0.35 * E), 0, 1); frag = sF * clamp((TARGET - n) / TARGET, 0, 1); cons = sF * clamp((n - TARGET) / TARGET, 0, 1.5); }
      for (let r = 1; r <= nR; r++) { let s0 = sg[r]; while (s0 < 8 && Y[(s0 + 1) * NN + r] <= y) s0++; sg[r] = s0; v[r] = (R.weight[r] / wmean) * SFV[s0]; } // 阶段只进不退：逐年增量推进
      // 古文明衰亡：其政权凝聚力崩溃，随后由继承文明的王朝取代
      D.ancient.forEach((a, ai) => { if (y >= a.fall && !ancientFallen.has(ai)) { ancientFallen.add(ai); for (const q of P) if (q.died === null && q.civ === -2 - ai) q.coh = 0.05; } });
      // 1. 城邦兴起
      for (let r = 1; r <= nR; r++) {
        if (owner[r] >= 0 || sg[r] < 3 || !habitable(r) || (colonialAge !== null && isNW(r))) continue; /* 大航海接触以后，新大陆不再自发兴起本土城邦 */
        const roll = rnd() / ((isNW(r) ? 0.3 : 1 + 2 * frag) * (1 - 0.8 * Math.min(1, cons))); if (roll >= 0.08) continue; /* 新大陆：国家稀少，不参与凑数 */
        const cu = cult[r] !== -1 ? cult[r] : cultAt(r, y), tp = typeOfCult(cu);
        if (tp !== 'pastoral' && !cityIn[r].some(i => alive(C.cities[i], y))) continue;
        let near = false; for (let k = R.off[r]; k < R.off[r + 1]; k++) { const b = R.nbr[k]; if (!R.edges[R.eid[k]].sea && owner[b] >= 0 && P[owner[b]].n > 3) { near = true; break; } }
        if (roll < (near ? 0.03 : 0.08)) { const p = newPolity(y, r, [], civOfNew(r, y)); P[p].cityBorn = sg[r] <= 3; setOwner(r, p, y); }
      }
      // 2. 国力
      const alivePs = []; for (const q of P) if (q.died === null && q.n > 0) alivePs.push(q.id);
      const pw = new Float64Array(P.length), cs = new Int8Array(P.length), reach = new Float64Array(P.length), cap = new Float64Array(P.length), ptype = [];
      for (let r = 1; r <= nR; r++) if (owner[r] >= 0) pw[owner[r]] += v[r];
      for (const p of alivePs) { const q = P[p]; cs[p] = Math.max(2, sg[q.cap]); ptype[p] = q.settled !== undefined && typeOfCult(q.civ) === 'pastoral' ? 'agrarian' : typeOfCult(q.civ); /* 入主农耕之地后定居 */ pw[p] = Math.max(0.05, pw[p]) * (0.35 + q.coh);
        const nomadEdge = ptype[p] === 'pastoral' ? Math.max(0, Math.min(1, (7 - cs[p]) / 2)) : 0; // 骑射之利随时代消退，近代早期不再
        reach[p] = REACH[cs[p]] * (1 + 0.6 * nomadEdge) * (0.8 + 0.3 * q.coh); cap[p] = Math.max(1, CAP[cs[p]] * scale * (1 + 0.4 * nomadEdge) * (1 - 0.45 * frag) * (1 + 0.6 * cons)); }
      if (y - shareYear >= 50) { shareYear = y; ideaShare.fill(0); for (let r = 1; r <= nR; r++) { const w = R.weight[r]; if (!w) continue; for (let k = 0; k < ideaShare.length; k++) if (D.ideaA[k * NN + r] <= y) ideaShare[k] += w; } for (let k = 0; k < ideaShare.length; k++) ideaShare[k] /= Math.max(1e-9, totW); }
      const mil = new Float64Array(P.length), adm = new Float64Array(P.length), lag = new Float64Array(P.length);
      for (const p of alivePs) { const c = P[p].cap; mil[p] = milAt(c, y); adm[p] = admAt(c, y); lag[p] = lagAt(c, y); P[p].milNow = mil[p]; P[p].admNow = adm[p];
        pw[p] *= 1 + 0.04 * adm[p];                                                    // 治理思潮：赋税与动员
        reach[p] *= 1 + 0.08 * adm[p]; cap[p] *= 1 + 0.08 * adm[p]; }                   // 官僚与驿传：管得更远、更大
      for (const p of alivePs) { const L = P[p].liege; if (L >= 0 && P[L].died === null) pw[L] += 0.25 * pw[p]; } // 附庸纳贡
      const realm = new Int32Array(P.length).fill(-1); for (const p of alivePs) realm[p] = topLiege(p);
      for (const p of alivePs) P[p].reachNow = reach[p];
      const gf = 0;
      const presentOf = p => R.country[P[p].cap];
      // 3. 进攻：每个政权在边界上找最有把握的目标
      // 每个政权只保留把握最大的 KB 个目标（定长槽位，插入排序）
      const KB = 8, nP = P.length, pw7 = new Float64Array(nP), bestB = new Int32Array(nP * KB), bestR = new Float64Array(nP * KB), bestN = new Uint8Array(nP);
      for (const p of alivePs) pw7[p] = Math.pow(pw[p], 0.7);
      const capOf = new Int32Array(nP); for (const p of alivePs) capOf[p] = P[p].cap;
      for (let a = 1; a <= nR; a++) { const p = owner[a]; if (p < 0) continue;
        for (let kk = R.off[a]; kk < R.off[a + 1]; kk++) { const b = R.nbr[kk], sea = eSea[kk];
          const q = owner[b]; if (q === p || R.weight[b] <= 0 || sg[b] < 1) continue; if (sea && cs[p] < 5 && ptype[p] !== 'maritime' && styleOf(P[p].civ) !== 'mercantile') continue;
          if (P[p].rebel ? q !== P[p].target : (q >= 0 && P[q].rebel && P[q].target !== p)) continue; // 起义军只与朝廷交战
          if (q >= 0 && realm[p] === realm[q] && realm[p] >= 0) continue; // 宗主与附庸、同一宗主的附庸之间互不攻伐
          const cb = P[p].colBase, lcB = R.landComp[b], dk = cb && cb.has(lcB) && R.landComp[capOf[p]] !== lcB ? Math.min(kmBetween(capOf[p], b), kmBetween(cb.get(lcB), b)) : kmBetween(capOf[p], b); // 海外殖民地：从殖民据点向内陆投送
          let att = pw7[p] * Math.exp(-dk / reach[p]) * (sea ? (styleOf(P[p].civ) === 'mercantile' ? 0.8 : 0.5) : 1); // 商贸型文化善于跨海投送
          if (cs[p] >= 7 && isNW(b) && !isNW(capOf[p])) att *= 1 + 0.5 * Math.max(0, cs[p] - (q >= 0 ? cs[q] : sg[b])); // 殖民者的技术优势
          if (P[p].rebel) { att *= 0.95 + Math.max(0, 0.5 - P[q].coh) * 2; if (P[p].rtype === 'peasant') att *= 1 + 0.8 * Math.exp(-kmBetween(b, capOf[q]) / 700); } // 朝廷越虚弱越难挡；农民军向都城推进
          else if (q >= 0 && P[q].rebel) att *= 0.6 + P[p].coh;
          if (cons > 0 && q >= 0 && !P[q].rebel && P[q].n <= 2) att *= 1 + 1.5 * cons;                                                       // 镇压
          if (P[p].n >= cap[p]) att *= 0.35;
          { const mg = mil[p] - (q >= 0 ? mil[q] : milAt(b, y)); att *= clamp(Math.pow(1.18, mg), 0.65, 1.6); } // 军事思潮的差距：有优势，但不决定胜负
          if (q >= 0 && P[q].theo !== undefined && rel[capOf[p]] >= 0 && rel[capOf[p]] === rel[P[q].cap] && !P[p].rebel) att *= 0.4; // 同信仰的国家不愿攻打本教的教国
          if (P[p].claimLin >= 0 && coreLin[b] === P[p].claimLin && y < P[p].claimUntil) att *= 1.5; // 法统宣称
          if (coreLin[b] === P[p].lin) att *= 1.4;                                                       // 收复故土
          if (gf > 0) { const kp = presentOf(p); if (kp >= 0) att *= R.country[b] === kp ? 1 + gf : 1 - 0.6 * gf; }
          let def;
          if (q >= 0) { const dq = kmBetween(capOf[q], b); def = pw7[q] * Math.exp(-dq / reach[q]) * (1 + 0.25 * eRough[kk]) * (coreLin[b] === P[q].lin ? 1.3 : 1);
            if (P[q].liege >= 0 && realm[q] >= 0 && P[realm[q]].died === null) { const L = realm[q]; def += 0.5 * pw7[L] * Math.exp(-kmBetween(capOf[L] || P[L].cap, b) / Math.max(1, reach[L])); } // 宗主出兵相护
            if (ptype[p] === 'pastoral' && ptype[q] !== 'pastoral' && cs[p] >= 4 && cs[p] <= 6 && !has('gunpowder', capOf[q], y)) att *= 1.3; } // 对方有了火器，骑射之利不再
          else def = (v[b] * 0.5 + 0.06) * (sg[b] >= 3 ? 1.4 : 1) * (sg[b] <= 1 ? 0.5 : 1);
          const ratio = att / Math.max(1e-6, def), base = p * KB; let n = bestN[p];
          if (n === KB && ratio <= bestR[base + KB - 1]) continue;
          let i = n < KB ? n++ : KB - 1; while (i > 0 && (bestR[base + i - 1] < ratio || (bestR[base + i - 1] === ratio && bestB[base + i - 1] > b))) { bestR[base + i] = bestR[base + i - 1]; bestB[base + i] = bestB[base + i - 1]; i--; }
          bestR[base + i] = ratio; bestB[base + i] = b; bestN[p] = n; } }
      const flipped = new Uint8Array(nR + 1), lost = new Float64Array(P.length), won = new Float64Array(P.length), migr = new Map();
      alivePs.sort((x, z) => pw[z] - pw[x] || x - z);
      for (const p of alivePs) {
        const q0 = P[p]; if (q0.died !== null || !bestN[p]) continue;
        if (!q0.rebel && rnd() > 0.25 + 0.25 * q0.coh) continue;
        const tries = 1 + Math.floor(Math.sqrt(q0.n) / 2);
        for (let t = 0, done = 0; t < bestN[p] && done < tries; t++) { const b = bestB[p * KB + t], ratio = bestR[p * KB + t]; if (flipped[b] || owner[b] === p) continue; done++;
          if (ratio * (0.7 + 0.6 * rnd()) <= 1.15) continue;
          const q = owner[b];
          if (q >= 0 && !P[q].rebel && !q0.rebel && feudal(cs[p], y) && q0.liege < 0 && P[q].liege < 0 && !P[q].vasOf && P[q].n <= Math.max(4, 0.5 * q0.n) && rnd() < 0.6 * ({ feudal: 1.3, bureaucratic: 0.6 }[styleOf(q0.civ)] || 1)) { // 封建时代：不吞并，收为附庸
            if (!P.some(X => X.died === null && X.liege === q)) { flipped[b] = 1; setLiege(q, p, y, 'submit'); done++; continue; } }
          flipped[b] = 1; setOwner(b, p, y); won[p]++;
          if (isNW(b) && !isNW(P[p].cap) && cs[p] >= 7) { if (rndK() < 0.4) setCult(b, P[p].civ, y); if (rndK() < 0.4 && rel[P[p].cap] >= 0) setRel(b, rel[P[p].cap], y); } // 殖民扩张：移民与传教
          if (ptype[p] === 'pastoral' && P[p].civ !== cult[b] && rndC() < (v[b] < 0.6 ? 0.55 : 0.3)) { setCult(b, P[p].civ, y); migr.set(p, (migr.get(p) || 0) + 1); } // 游牧部族随军迁入
          if (q >= 0) { lost[q]++;
            const Q = P[q];
            if (b === Q.cap && P[p].rebel && P[p].target === q) { overthrow(p, q, y, b); continue; } // 起义军攻入都城：推翻王朝
            if (b === Q.cap) { // 攻破都城
              const city = bigCity(b, y); if (city >= 0) { sacks.push(city, y, 0.45); if (Q.peakN >= 3) ev(y, 'sack', { p, q, city, r: b, gun: has('gunpowder', capOf[p], y) && !has('gunpowder', capOf[q], y) }); }
              if (ptype[p] === 'pastoral' && ptype[q] !== 'pastoral' && Q.n >= 4 && cs[q] >= 4) { // 外族入主
                for (let r = 1; r <= nR; r++) if (owner[r] === q) { setOwner(r, p, y, true); flipped[r] = 1; if (P[p].civ !== cult[r] && rndC() < 0.25) { setCult(r, P[p].civ, y); migr.set(p, (migr.get(p) || 0) + 1); } }
                kill(q, y, p, 'conquer'); ev(y, 'nomad', { p, q, r: b, city }); if (P[q].org && !P[p].org) P[p].org = y;
                if (rnd() < 0.6) { P[p].cap = b; P[p].caps.push({ year: y, city, r: b }); P[p].lastCapMove = y; if (P[p].settled === undefined && Q.peakN >= 6) { P[p].settled = y; P[p].settledCiv = cult[b]; } } /* 入主并定都旧都：改行定居王朝 */
              } else if (Q.n > 0) moveCapital(q, y, 'sack');
            } else { const city = bigCity(b, y); if (city >= 0 && rnd() < 0.3) sacks.push(city, y, 0.25); }
            if (Q.n === 0 && !Q.rebel) kill(q, y, p); } } }
      for (const [p, n] of migr) if (n >= 2) ev(y, 'migrate', { p, c: P[p].civ, n, r: P[p].cap });
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.peakN < NAMEBIG * 0.6) continue; const sr = rel[q.cap]; if (q.stateRel === undefined) q.stateRel = sr; else if (sr !== q.stateRel) { q.stateRel = sr; if (sr >= 0) ev(y, 'convert', { p, f: sr, r: q.cap }); } }
      // 4. 凝聚力、核心领土与危机
      const foreignN = new Float64Array(P.length); for (let r = 1; r <= nR; r++) { const p = owner[r]; if (p < 0) continue; const cu = cult[r]; if (cu !== P[p].civ && cu !== -1) foreignN[p]++; }
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.n === 0) { if (q.died === null && !q.rebel) kill(p, y, -1); continue; }
        if (q.rebel) { q.coh = 0.75; continue; }
        const foreign = foreignN[p];
        const over = q.n / cap[p] - 1, age = y - q.dynStart;
        q.coh += 0.0015 * adm[p] + 0.0035 * adm[p] * Math.max(0, over) - 0.003 * lag[p]; // 治理思潮使国家稳固、减轻疆域过大之累；落后于时代的思潮则人心浮动
        const gst = styleOf(q.civ); q.coh += (gst === 'bureaucratic' ? 0.0105 * Math.max(0, over) : 0) - (gst === 'tribal' ? 0.003 : 0); // 官僚制较能维系大国；部族制易离散
        q.coh += 0.016 - 0.035 * Math.max(0, over) - 0.012 * (foreign / q.n) - 0.02 * Math.min(3, lost[p]) + 0.006 * Math.min(3, won[p]) - (age > 220 ? 0.0035 * (age - 220) / 100 : 0) - 0.01 * rnd();
        if (frag > 0 && !(isNW(q.cap) && ptype[p] === 'new-world')) q.coh -= 0.03 * frag * (q.n > cap[p] * 0.6 ? 1 : 0.3);
        if (q.theo !== undefined) q.coh += 0.006; // 神权：以教统民，较为稳固
        q.coh = clamp(q.coh, 0, 1.2);
        if (q.coh < 0.18 + 0.15 * frag) crisis(p, y, cap[p], foreign / q.n);
      }
      for (let r = 1; r <= nR; r++) { const p = owner[r]; if (p >= 0 && y - linOwnSince[r] >= 150) coreLin[r] = P[p].lin; }
      reviewCapitals(y, alivePs, ptype); reviewTheocracy(y, alivePs, ptype); schismStep(y, alivePs);
      // 4d. 宗藩的维系、脱离与撤藩
      for (const v of alivePs) { const V = P[v]; if (V.died !== null || V.liege < 0) continue; let L = V.liege;
        if (P[L].died !== null) { const succ = P[L].children.find(c => c.kind === 'dynasty' && P[c.id].died === null); if (succ) { setLiege(v, succ.id, y, 'dynasty', true); L = succ.id; } else { setLiege(v, -1, y, 'free'); continue; } }
        if (V.n === 0) continue; const Lq = P[L], csL = Math.max(2, sg[Lq.cap]), late = csL >= 7 || y >= 4300 ? 1 : 0, held = y - (V.vasSince || y);
        const pFree = 0.006 + 0.1 * Math.max(0, 0.4 - Lq.coh) + (V.n > 0.5 * Lq.n ? 0.04 : 0) + (V.n > Lq.n ? 0.3 : 0) + 0.05 * late; /* 附庸比宗主还大：很快脱离 */
        const pAnnex = held >= 120 && Lq.coh > 0.55 && V.n <= 0.35 * Lq.n ? 0.015 + 0.08 * late : late && held >= 60 && V.n <= Lq.n ? 0.07 : 0; /* 集权时代：撤藩直辖 */
        const roll = rnd();
        if (roll < pAnnex) { for (let r = 1; r <= nR; r++) if (owner[r] === v) setOwner(r, L, y, true); for (const X of P) if (X.died === null && X.liege === v) setLiege(X.id, L, y, 'dynasty', true); setLiege(v, -1, y, 'annexV'); kill(v, y, L, 'integrate'); }
        else if (roll < pAnnex + pFree) setLiege(v, -1, y, 'free'); }
      // 4e. 封建时代：弱小邻国向强邻称臣（国力相差四倍以上）
      for (const v of alivePs) { const V = P[v]; if (V.died !== null || V.rebel || V.liege >= 0 || V.n === 0 || V.n > 6 || cs[v] < 3 || rnd() > 0.05) continue; if (P.some(X => X.died === null && X.liege === v)) continue;
        let best = -1, bp = 0; for (let r = 1; r <= nR; r++) { if (owner[r] !== v) continue; for (let k = R.off[r]; k < R.off[r + 1]; k++) { const o = owner[R.nbr[k]]; if (o < 0 || o === v || P[o].rebel || P[o].died !== null || P[o].liege >= 0 || !feudal(cs[o], y)) continue; if (pw[o] > bp) { bp = pw[o]; best = o; } } }
        if (best >= 0 && bp > 4 * pw[v]) setLiege(v, best, y, 'submit'); }
      // 4a. 国家太多：小国归附相邻的大国（和平兼并）
      if (cons > 0) for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.rebel || q.n === 0 || q.n > 2 || rnd() > 0.1 * cons) continue;
        let best = -1, bn = 2; for (let r = 1; r <= nR; r++) { if (owner[r] !== p) continue; for (let k = R.off[r]; k < R.off[r + 1]; k++) { const o = owner[R.nbr[k]]; if (o >= 0 && o !== p && !P[o].rebel && P[o].n > bn) { bn = P[o].n; best = o; } } }
        if (best < 0) continue; for (let r = 1; r <= nR; r++) if (owner[r] === p) setOwner(r, best, y, true); kill(p, y, best, 'conquer'); }
      // 4c. 时间轴后段：直接向设定的国家数收拢（兼并最小的国家，或让最大的国家分出一省 / 分裂），作为历史事件记下
      if (TARGET && y >= 0.7 * E) steerCount(y, alivePs, y >= 0.88 * E ? 0.35 : 0.12, 4, reach);
      // 4b. 行政建制：古典时代起初置行省；新占领土地军管后设制；王朝衰弱时远省割据
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.n === 0 || q.rebel) continue; if (!q.org && cs[p] >= 5 && q.n >= 3) organize(p, y);
        else if (q.org && q.coh < 0.35 + 0.35 * frag && q.n >= (frag > 0.3 ? 4 : 6) && !(isNW(q.cap) && typeOfCult(q.civ) === "new-world") && rnd() < 0.12 + 0.35 * frag) secedeProvince(p, y, reach[p] * (1 - 0.5 * frag)); }
      admin(y);
      unrestStep(y, alivePs, cs, cap, reach);
      colonize(y, alivePs, cs);
      if ((y / TICK) % 2 === 0) { const a = new Uint8Array(nR + 1); for (let r = 1; r <= nR; r++) a[r] = Math.min(255, Math.round(unrest[r] * 255)); unrestSamples.push(y, a); }
      // 5. 复国：同文明的政权夺回已亡之国六成以上的核心
      if ((y / TICK) % 5 === 0) for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.restoreOf !== undefined || q.rebel) continue;
        for (const X of P) { if (X.died === null || X.restored || X.peakN < NAMEBIG || X.civ !== q.civ || X.lin === q.lin || y - X.died < 60 || y - X.died > 600 || !X.coreAtDeath || X.coreAtDeath.length < 4 || q.n < X.coreAtDeath.length) continue;
          let own = 0; for (const r of X.coreAtDeath) if (owner[r] === p) own++;
          if (own >= 0.75 * X.coreAtDeath.length) { X.restored = true; q.restoreOf = X.id; q.parents.push({ id: X.id, kind: 'restore' }); X.children.push({ id: p, kind: 'restore' }); q.coh = Math.min(1.2, q.coh + 0.3); ev(y, 'restore', { p, q: X.id, r: q.cap }); break; } } }
      // 6. 统一：城邦时代的政权吞并多座城邦，建立王国
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.unified || !q.cityBorn) continue; if (q.n >= 4 && cs[p] >= 4) { q.unified = true; ev(y, 'unify', { p, r: q.cap, n: q.n }); } }
      // 7. 规模采样（单国视角用）
      if ((y / TICK) % 5 === 0) for (const q of P) if (q.died === null && q.n > 0) q.ext.push(y, q.n);
    }

    function steerCount(y, list, rate, tol, reach) { // 国家数与设定值相差超过 tol 时：兼并最小的国家，或让最大的国家分出一省 / 分裂
      const live = list.filter(p => P[p].died === null && P[p].n > 0 && !P[p].rebel), diff = live.length - TARGET;
      if (diff > tol) { const k = rate >= 1 ? diff - tol : Math.max(1, Math.ceil(diff * rate)); live.sort((a, b) => P[a].n - P[b].n || a - b); let done = 0;
        for (const p of live) { if (done >= k) break; let best = -1, bn = 0; for (let r = 1; r <= nR; r++) { if (owner[r] !== p) continue; for (let kk = R.off[r]; kk < R.off[r + 1]; kk++) { const o = owner[R.nbr[kk]]; if (o >= 0 && o !== p && !P[o].rebel && P[o].n > bn) { bn = P[o].n; best = o; } } }
          if (best < 0) continue; for (let r = 1; r <= nR; r++) if (owner[r] === p) setOwner(r, best, y, true); kill(p, y, best, 'conquer'); done++; } }
      else if (diff < -tol) { const k = rate >= 1 ? -diff - tol : Math.max(1, Math.ceil(-diff * rate)); live.sort((a, b) => P[b].n - P[a].n || a - b); let done = 0;
        for (const p of live) { if (done >= k) break; const q = P[p]; if (q.n < 2) break; if (isNW(q.cap) && typeOfCult(q.civ) === 'new-world') continue; const before = P.length;
          if (q.org) secedeProvince(p, y, (reach ? reach[p] : 600) * 0.4); if (P.length === before && q.n >= 4) crisis(p, y, 0, 1); if (P.slice(before).some(c => c.parents.some(x => x.kind === 'split' || x.kind === 'secede'))) done++; } }
      return diff;
    }
    // ---------- 迁都：都城须有城邑；疆域广阔时迁往居中的大城以便统治；游牧入主农耕之地后定居 ----------
    function reachOf(p) { return P[p].reachNow || 600; }
    function reviewCapitals(y, alivePs, ptype) {
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.n === 0 || q.rebel) continue;
        const own = []; for (let r = 1; r <= nR; r++) if (owner[r] === p) own.push(r);
        const lastCity = q.caps[q.caps.length - 1].city;
        // 1. 都城没有城邑：换到本国有城的地方（城建起来了就补记）
        if (lastCity < 0 || !alive(C.cities[lastCity], y)) { let best = -1, bp = 0; for (const r of own) { const v = regionPop(r, y); if (v > bp) { bp = v; best = r; } } if (best >= 0) { moveCapital(p, y, 'found', best); continue; } }
        // 2. 游牧政权入主农耕之地：人口多半已在定居地区，迁都最大的农耕城市，改行定居王朝
        if (ptype[p] === 'pastoral' && q.settled === undefined && q.n >= 4) { let agW = 0, allW = 0, best = -1, bp = 0;
          for (const r of own) { const w = R.weight[r]; allW += w; const cu = cult[r]; if (cu !== -1 && typeOfCult(cu) !== 'pastoral' && sg[r] >= 4) { agW += w; const v = regionPop(r, y); if (v > bp) { bp = v; best = r; } } }
          if (best >= 0 && agW > 0.5 * allW && rnd() < 0.25) { q.settled = y; q.settledCiv = cult[best]; moveCapital(p, y, 'settle', best); ev(y, 'settle', { p, city: q.caps[q.caps.length - 1].city, r: best }); q.coh = Math.max(q.coh, 0.7); continue; } }
        // 3. 疆域广阔、都城偏居一隅：迁往离全国人口更近的大城（每三十年评估一次，两次迁都至少相隔一百二十年）
        if (q.n < 8 || (y / TICK) % 3 !== p % 3 || y - (q.lastCapMove || q.born) < 120) continue;
        const cand = own.filter(r => regionPop(r, y) > 0).sort((a, b) => regionPop(b, y) - regionPop(a, y) || a - b).slice(0, 10); if (!cand.includes(q.cap)) cand.push(q.cap);
        const step = Math.max(1, Math.floor(own.length / 60)), meanD = r => { let s0 = 0, w0 = 0; for (let i = 0; i < own.length; i += step) { const o = own[i], w = R.weight[o] + 1e-4; s0 += w * kmBetween(r, o); w0 += w; } return s0 / Math.max(1e-9, w0); };
        const pref = r => (cult[r] === q.civ ? 1 : 1.3) * (q.settled !== undefined && typeOfCult(cult[r]) === 'pastoral' ? 1.4 : 1);
        const curD = meanD(q.cap) * pref(q.cap), curP = regionPop(q.cap, y); let best = -1, bs = curD;
        for (const r of cand) { if (r === q.cap || regionPop(r, y) < 0.35 * curP) continue; const d = meanD(r) * pref(r); if (d < bs) { bs = d; best = r; } }
        if (best >= 0 && curD > 1.4 * bs && curD > 0.35 * reachOf(p) && rnd() < 0.35) moveCapital(p, y, 'center', best); }
    }
    // ---------- 神权：圣城为都、奉本教为国教的国家，可能由祭司掌权，政教合一 ----------
    function reviewTheocracy(y, alivePs, ptype) {
      for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.rebel || q.theo !== undefined || q.n === 0 || q.n > 14 || ptype[p] === 'pastoral' || q.republic) continue;
        const f = holyOf[q.cap]; if (f < 0 || rel[q.cap] !== f || sg[q.cap] < 4 || y - RELS[f].founded < 60) continue;
        const TH = { monotheist: 1.5, dualist: 1.3, dharmic: 1.2, polytheist: 1, ancestral: 0.6, shamanic: 0.6, philosophy: 0.3 };
        if (rnd() < 0.03 * (TH[relTypeOf(f)] || 1) * (styleOf(q.civ) === 'temple' ? 2 : 1)) { q.theo = y; q.theoRel = f; ev(y, 'theocracy', { p, f, r: q.cap }); } }
    }
    // ---------- 教派分裂：传播广、历史久的宗教，远离圣地的大国另立教派（派别名取自宗教库） ----------
    function schismStep(y, alivePs) {
      if (nRel >= RCAP) return; const cnt = new Int32Array(nRel); for (let r = 1; r <= nR; r++) if (rel[r] >= 0) cnt[rel[r]]++;
      for (let f = 0; f < nRel; f++) { const F0 = RELS[f]; if (!relOn[f] || F0.depth >= 1 || y - F0.founded < 500 || y - F0.lastSchism < 450 || (F0.nSchism || 0) >= 2 || cnt[f] < Math.max(30, nR * 0.03)) continue; /* 每个宗教至多分出两派，派中不再分派 */
        const br = (F0.branches || []).filter(b => !F0.usedBr.has(b) && !D.usedNames.has(b) && !D.usedNames.has(F0.name.slice(0, 2) + b)); if (!br.length) continue;
        const pr = (F0.spread === 'missionary' ? 1 : 0.35) * ({ monotheist: 1.4, dualist: 1.2, dharmic: 1.2 }[F0.type] || 0.5) * 0.012; if (rnd() > pr) continue;
        let best = -1, bs = 0; for (const p of alivePs) { const q = P[p]; if (q.died !== null || q.rebel || q.n < 4 || rel[q.cap] !== f || (F0.origin && owner[F0.origin] === p)) continue; const d = F0.origin ? kmBetween(q.cap, F0.origin) : 0; if (d < 900) continue; const v = q.n * d; if (v > bs) { bs = v; best = p; } }
        if (best < 0) continue; const b0 = br[Math.floor(rnd() * br.length)]; F0.usedBr.add(b0); F0.lastSchism = y; F0.nSchism = (F0.nSchism || 0) + 1;
        const name = D.usedNames.has(b0) ? F0.name.slice(0, 2) + b0 : b0; D.usedNames.add(name);
        const g = nRel++, q = P[best], col = F0.color ? F0.color.map((v, i) => Math.max(0, Math.min(255, v + [40, -30, 20][(g + i) % 3]))) : null;
        RELS.push(Object.assign({}, F0, { name, founded: y, origin: q.cap, parent: f, depth: F0.depth + 1, color: col, usedBr: new Set([b0]), lastSchism: y, cult: q.civ }));
        relOn[g] = 1; if (holyOf[q.cap] < 0) holyOf[q.cap] = g;
        for (let r = 1; r <= nR; r++) if (rel[r] === f && (owner[r] === best ? rndC() < 0.85 : (owner[r] >= 0 && topLiege(owner[r]) === topLiege(best) && rndC() < 0.5))) setRel(r, g, y);
        setRel(q.cap, g, y); q.stateRel = g; ev(y, 'schism', { p: best, f, g, r: q.cap });
      }
    }
    function crisis(p, y, capP, foreignFrac) {
      const q = P[p], nwNat = isNW(q.cap) && typeOfCult(q.civ) === 'new-world'; /* 新大陆本土政权：危机只改朝换代，不分裂（国家稀少） */
      if (!nwNat && q.n >= (frag > 0.3 ? 4 : 6) && (q.n > capP * 0.8 || foreignFrac > 0.3 || rnd() < 0.5 + frag)) { // 分裂
        const own = []; for (let r = 1; r <= nR; r++) if (owner[r] === p) own.push(r);
        const k = Math.min(4, 1 + Math.floor(q.n / 6)), seeds = [q.cap];
        const ranked = own.filter(r => r !== q.cap).sort((a, b) => (regionPop(b, y) + R.weight[b] * 1e-3) - (regionPop(a, y) + R.weight[a] * 1e-3) || a - b);
        const sep = Math.max(200, REACH[Math.max(2, stageAt(q.cap, y))] * 0.5);
        for (const r of ranked) { if (seeds.length >= k) break; if (seeds.every(s => kmBetween(s, r) > sep)) seeds.push(r); }
        if (seeds.length < 2) { dynasty(p, y); return; }
        const part = new Map(); const queue = []; seeds.forEach((s, i) => { part.set(s, i); queue.push(s); });
        for (let i = 0; i < queue.length; i++) { const a = queue[i]; neighbors(a, (b, ed) => { if (owner[b] === p && !part.has(b)) { part.set(b, part.get(a)); queue.push(b); } }); }
        if (q.org) { // 有省份的国家沿省界分裂：整省归属于治所所在的一方
          const pvPart = new Map(); for (const r of own) { const v = prov[r]; if (v < 0) continue; const sr = PV[v].seat; if (!pvPart.has(v)) pvPart.set(v, part.has(sr) ? part.get(sr) : part.get(r)); }
          seeds.forEach((sd, i) => { if (prov[sd] >= 0) pvPart.set(prov[sd], i); });
          for (const r of own) if (prov[r] >= 0 && pvPart.has(prov[r])) part.set(r, pvPart.get(prov[r])); }
        const kids = [];
        for (let i = 1; i < seeds.length; i++) { const c = newPolity(y, seeds[i], [{ id: p, kind: 'split' }], creole(seeds[i], q, y)); P[c].claimLin = q.lin; P[c].claimUntil = y + 400; P[c].coh = 0.75; P[c].org = q.org; kids.push(c); }
        for (const r of own) { const i = part.has(r) ? part.get(r) : 0; if (i > 0) setOwner(r, kids[i - 1], y, true); }
        for (const c of kids) { if (P[c].n === 0) P[c].died = y; else if (owner[P[c].cap] !== c) moveCapital(c, y, 'split'); }
        if (owner[q.cap] !== p && q.n > 0) moveCapital(p, y, 'split');
        q.coh = 0.55; ev(y, 'split', { p, kids, r: q.cap });
        if (feudal(stageAt(q.cap, y), y) && q.liege < 0) for (const c of kids) if (P[c].died === null && P[c].n > 0 && rnd() < (styleOf(q.civ) === 'feudal' ? 0.8 : 0.5)) setLiege(c, p, y, 'split'); // 封建时代：分出去的诸侯仍奉旧主为宗主
      } else dynasty(p, y, rnd() < 0.3 ? 'coup' : 'dynasty');
    }
    function dynasty(p, y, how) { // 改朝换代：疆域不变，新王朝继承（国统延续），首都可能迁往最大的城市；how：dynasty / coup（宫廷政变）/ revolution（革命）
      const q = P[p]; const nd = newPolity(y, q.cap, [{ id: p, kind: 'dynasty' }], civOfNew(q.cap, y), q.lin);
      if (q.theo !== undefined && rnd() < 0.7) P[nd].theo = y; if (q.settled !== undefined) { P[nd].settled = y; P[nd].settledCiv = q.settledCiv; } // 神权四成延续；定居不再回到游牧
      if (q.liege >= 0) setLiege(nd, q.liege, y, 'dynasty', true); for (const X of P) if (X.died === null && X.liege === p) setLiege(X.id, nd, y, 'dynasty', true); // 宗藩随王朝延续
      P[nd].dynStart = y; P[nd].claimLin = q.claimLin; P[nd].claimUntil = q.claimUntil;
      P[nd].org = q.org;
      for (let r = 1; r <= nR; r++) if (owner[r] === p) setOwner(r, nd, y, true);
      q.died = y; q.coreAtDeath = [];
      moveCapital(nd, y, 'dynasty');
      if (how === 'revolution') P[nd].republic = true;
      if (q.peakN >= 2) ev(y, how === 'coup' || how === 'revolution' ? how : 'dynasty', { p: nd, q: p, r: P[nd].cap });
      return nd;
    }
    // ---------- 大航海与殖民 ----------
    function colonize(y, alivePs, cs) {
      if (!nwCoast.length) return;
      const coastal = new Uint8Array(P.length); for (let r = 1; r <= nR; r++) { const p = owner[r]; if (p >= 0 && R.coast[r] && !isNW(r)) coastal[p] = 1; }
      // 只有接纳了“远洋航海”思潮的旧大陆沿海国家，才能远渡重洋
      const navOk = p => D.NAV >= 0 && D.ideaA[D.NAV * NN + P[p].cap] <= y;
      const can = alivePs.filter(p => P[p].died === null && !P[p].rebel && navOk(p) && coastal[p] && !isNW(P[p].cap) && P[p].n >= 3);
      if (!can.length) return;
      if (colonialAge === null) { colonialAge = y; ev(y, 'discovery', { p: can[0], r: P[can[0]].cap }); }
      for (const p of can) { const q = P[p]; if (rndK() > 0.16 * q.coh) continue;
        // 选登陆点：新大陆沿岸，无主或本地政权弱小处；靠近自己已有的殖民地更可能
        let tot = 0; const w = nwCoast.map(r => { const o = owner[r]; if (o === p) return 0; let v = 0.2 + R.hab[r]; if (o >= 0) { if (!isNW(P[o].cap) || cs[o] >= 6) return 0; v *= 0.35; } if (q.colBase && q.colBase.has(R.landComp[r])) v *= 2.5; tot += v; return v; });
        if (!tot) continue; let pick = rndK() * tot, b = 0; for (let i = 0; i < w.length && pick > 0; i++) { pick -= w[i]; b = nwCoast[i]; }
        const o0 = owner[b]; setOwner(b, p, y); if (o0 >= 0 && P[o0].n === 0) kill(o0, y, p);
        if (rndK() < 0.6) setCult(b, q.civ, y); if (rndK() < 0.6 && rel[q.cap] >= 0) setRel(b, rel[q.cap], y); // 移民与传教士随船而来
        if (!q.colBase) q.colBase = new Map(), q.colSince = new Map();
        const lc = R.landComp[b]; if (!q.colBase.has(lc)) { q.colBase.set(lc, b); q.colSince.set(lc, y); ev(y, 'colony', { p, r: b, city: bigCity(b, y), first: !q.colonized }); q.colonized = true; } }
      // 殖民带来的发展：旧大陆国家统治下的新大陆土地逐步跟上宗主国（最多低一个阶段）
      for (let r = 1; r <= nR; r++) { const p = owner[r]; if (p < 0 || !isNW(r) || isNW(P[p].cap) || cs[p] < 7) continue; const t = cs[p] - 1;
        if (sg[r] < t && rndK() < 0.12) { const s1 = sg[r] + 1; if (D.Y[s1 * NN + r] > y) D.Y[s1 * NN + r] = y; for (let s2 = s1 + 1; s2 <= 8; s2++) if (D.Y[s2 * NN + r] < y) D.Y[s2 * NN + r] = y; sg[r] = s1; } }
      // 殖民地独立：殖民满一百二十年，宗主国越虚弱越可能
      if ((y / TICK) % 3 === 0) for (const p of alivePs) { const q = P[p]; if (!q.colBase || q.died !== null) continue;
        for (const [lc, base] of [...q.colBase]) { if (y - q.colSince.get(lc) < 120) continue; const regs = []; for (let r = 1; r <= nR; r++) if (owner[r] === p && R.landComp[r] === lc) regs.push(r);
          if (!regs.length) { q.colBase.delete(lc); continue; } if (regs.length < 2 || rndK() > 0.06 + 0.02 * Math.min(10, regs.length) + (q.coh < 0.5 ? 0.12 : 0)) continue;
          const seat = bigRegion(regs, y); if (q.civ !== -1) setCult(seat, q.civ, y); if (rel[q.cap] >= 0) setRel(seat, rel[q.cap], y); // 独立时殖民者精英掌权：首都随宗主国的文化与宗教
          const c = newPolity(y, seat, [{ id: p, kind: 'secede' }], cult[seat] !== -1 ? cult[seat] : q.civ); P[c].org = q.org || y; P[c].coh = 0.85; P[c].colonialFrom = p;
          for (const r of regs) setOwner(r, c, y, true); q.colBase.delete(lc); ev(y, 'independence', { p: c, q: p, r: seat }); } }
    }
    // ---------- 民怨、灾年与起义 ----------
    function overthrow(rb, q, y, capR) { // 起义军攻入都城：王朝覆亡，起义军成为新王朝，承接全部疆域（国统延续）
      const Q = P[q], Rb = P[rb], city = bigCity(capR, y); if (city >= 0) sacks.push(city, y, 0.35);
      for (let r = 1; r <= nR; r++) if (owner[r] === q) setOwner(r, rb, y, true);
      setOwner(capR, rb, y, true);
      kill(q, y, -1); Q.children.push({ id: rb, kind: 'overthrow' }); Rb.parents.push({ id: q, kind: 'dynasty' });
      Rb.rebel = false; Rb.rebelUntil = y; Rb.lin = Q.lin; Rb.org = Q.org; Rb.dynStart = y; Rb.coh = 0.85; Rb.cap = capR; Rb.caps.push({ year: y, city, r: capR });
      const restoreOf = Rb.rtype === 'loyalist' && Rb.memoryOf >= 0 ? Rb.memoryOf : -1;
      if (restoreOf >= 0 && !P[restoreOf].restored) { P[restoreOf].restored = true; Rb.restoreOf = restoreOf; Rb.parents.push({ id: restoreOf, kind: 'restore' }); }
      Rb.outcome = 'overthrow'; ev(y, 'overthrow', { p: rb, q, city, r: capR, restoreOf });
      for (let r = 1; r <= nR; r++) if (owner[r] === rb) unrest[r] *= 0.4;
    }
    function settleRebel(rb, y, why) { // 起义军坚持下来：割据成国（或遗民复国）
      const Rb = P[rb]; Rb.rebel = false; Rb.rebelUntil = y; Rb.coh = 0.8; Rb.claimLin = P[Rb.target].lin; Rb.claimUntil = y + 300;
      let restoreOf = -1; if (Rb.rtype === 'loyalist' && Rb.memoryOf >= 0 && !P[Rb.memoryOf].restored) { restoreOf = Rb.memoryOf; P[restoreOf].restored = true; Rb.restoreOf = restoreOf; Rb.parents.push({ id: restoreOf, kind: 'restore' }); Rb.lin = P[restoreOf].lin; }
      if (Rb.rtype === 'religious') { Rb.theo = y; Rb.theoRel = Rb.relAt; } // 教民起义建国：政教合一
      Rb.outcome = 'state'; ev(y, 'rebelState', { p: rb, q: Rb.target, r: Rb.cap, restoreOf, why });
    }
    function unrestStep(y, alivePs, cs, cap, reach) {
      // 灾年：干旱区多大旱，大河两岸多大水，其余是蝗灾与饥荒；一次覆盖一片相连的地方
      for (let r = 1; r <= nR; r++) famine[r] *= 0.5;
      if (rndU() < 0.3) { const wv = r => owner[r] >= 0 ? vuln[r] * clamp((y - lastFam[r]) / 150, 0.05, 1) : 0; let tot = 0; for (let r = 1; r <= nR; r++) tot += wv(r);
        let pick = rndU() * tot, r0 = 0; for (let r = 1; r <= nR && pick > 0; r++) { const w = wv(r); if (w > 0) { pick -= w; r0 = r; } }
        if (r0) { const size = 2 + Math.floor(rndU() * 6), cl = [r0], seen = new Set(cl); for (let i = 0; i < cl.length && cl.length < size; i++) for (let k = R.off[cl[i]]; k < R.off[cl[i] + 1] && cl.length < size; k++) { const b = R.nbr[k]; if (!seen.has(b) && !eSea[k] && R.weight[b] > 0) { seen.add(b); cl.push(b); } }
          for (const r of cl) { famine[r] = 1; lastFam[r] = y; for (const i of cityIn[r]) if (alive(C.cities[i], y) && rndU() < 0.5) sacks.push(i, y, 0.15); }
          const kind = R.arid[r0] + R.semiArid[r0] * 0.6 > 0.35 ? 'drought' : R.river[r0] >= 3 ? 'flood' : rndU() < 0.5 ? 'locust' : 'famine';
          if (cl.length >= 4) ev(y, 'disaster', { p: owner[r0], r: r0, dk: kind, n: cl.length }); } }
      // 民怨：赋役、灾荒、异族统治、信仰不合、王朝末年、新近征服、遗民记忆；近都城、太平久则回落
      const aliveLin = new Set(); for (const p of alivePs) if (P[p].died === null) aliveLin.add(P[p].lin);
      for (let r = 1; r <= nR; r++) { const p = owner[r]; if (p < 0 || P[p].rebel) { unrest[r] *= 0.8; cause[r] = 0; continue; }
        const q = P[p], over = Math.max(0, q.n / cap[p] - 0.8), foreign = cult[r] !== -1 && cult[r] !== q.civ ? 1 : 0, sr = rel[q.cap], heresy = sr >= 0 && rel[r] >= 0 && rel[r] !== sr ? 1 : 0;
        const fresh = y - linOwnSince[r] < 60 ? 1 : 0, mem = coreLin[r] >= 0 && coreLin[r] !== q.lin && !aliveLin.has(coreLin[r]) ? 1 : 0, near = kmBetween(r, q.cap) < reach[p] * 0.3 ? 1 : 0;
        const hw = heresy ? (relSpreadOf(sr) === 'syncretic' || relSpreadOf(rel[r]) === 'syncretic' ? 0.09 : relSpreadOf(sr) === 'missionary' && (relTypeOf(sr) === 'monotheist' || relTypeOf(sr) === 'dualist') ? 0.27 : 0.2) : 0;
        const parts = [0.4 * over, 0.55 * famine[r], 0.28 * foreign, hw, 0.4 * Math.max(0, 0.55 - q.coh), 0.15 * fresh, 0.25 * mem];
        const target = Math.max(0, parts.reduce((a, b) => a + b, 0) - 0.15 * near);
        unrest[r] = 0.8 * unrest[r] + 0.2 * target;
        let bi = 0; for (let i = 1; i < parts.length; i++) if (parts[i] > parts[bi]) bi = i; cause[r] = [1, 2, 3, 4, 1, 3, 5][bi]; // 1 赋役 2 灾荒 3 异族 4 信仰 5 遗民
        if (mem) memLin[r] = coreLin[r]; }
      // 起义爆发：民怨高的连片地方
      if (y >= E - 150) return; // 最后一百五十年不再起事：现在的局面不留悬而未决的起义
      const started = new Set();
      const hot = new Map(); // 每国只看民怨最高的一处（已平定的地方一百二十年内保持平静）
      for (let r = 1; r <= nR; r++) { const p = owner[r]; if (p < 0 || P[p].rebel || y < calmUntil[r]) continue; const u = unrest[r] + 0.03 * Math.min(3, tradition[r]); const o = hot.get(p); if (o === undefined || u > o[1]) hot.set(p, [r, u]); }
      for (const [p, [r, u]] of [...hot].sort((a, b) => a[0] - b[0])) { if (P[p].n < 3 || y - (P[p].lastRevolt || -1e9) < 60 || (isNW(P[p].cap) && typeOfCult(P[p].civ) === 'new-world')) continue;
        const thr = 0.66; if (u < thr || rndU() > 0.15 * (u - thr + 0.04)) continue;
        const q = P[p], cl = [r], seen = new Set(cl), maxN = Math.max(1, Math.min(8, Math.floor(q.n * 0.35)));
        for (let i = 0; i < cl.length && cl.length < maxN; i++) for (let k = R.off[cl[i]]; k < R.off[cl[i] + 1] && cl.length < maxN; k++) { const b = R.nbr[k]; if (!seen.has(b) && owner[b] === p && unrest[b] > thr - 0.12) { seen.add(b); cl.push(b); } }
        if (cl.length >= q.n) continue;
        started.add(p); q.lastRevolt = y; for (const k of cl) { tradition[k] = Math.min(9, tradition[k] + 1); calmUntil[k] = y + 120; }
        const c0 = cause[r], rtype = c0 === 3 ? 'ethnic' : c0 === 4 ? 'religious' : c0 === 5 ? 'loyalist' : 'peasant';
        if (cs[p] >= 7 && cl.includes(q.cap)) { dynasty(p, y, 'revolution'); continue; } // 近代：都城起事成为革命
        const seat = bigRegion(cl, y), rb = newPolity(y, seat, [{ id: p, kind: 'revolt' }], cult[seat] !== -1 ? cult[seat] : q.civ);
        const Rb = P[rb]; Rb.rebel = true; Rb.rtype = rtype; Rb.target = p; Rb.rebelSince = y; Rb.coh = 0.75; Rb.cause = c0; Rb.memoryOf = -1; Rb.relAt = rel[seat];
        if (rtype === 'loyalist') { const ml = memLin[r]; let last = -1; for (const X of P) if (X.lin === ml && X.died !== null && (last < 0 || X.died > P[last].died)) last = X.id; Rb.memoryOf = last; }
        for (const k of cl) { setOwner(k, rb, y); unrest[k] *= 0.6; }
        ev(y, 'revolt', { p: rb, q: p, r: seat, rtype, cause: c0, famine: famine[r] > 0.3 });
      }
      // 起义的结局：被镇压 / 坚持六十年割据成国 / 朝廷先亡则自立
      for (const p of alivePs) { const Rb = P[p]; if (!Rb.rebel || Rb.died !== null) continue;
        if (Rb.n === 0) { Rb.died = y; Rb.rebelUntil = y; Rb.outcome = 'suppress'; ev(y, 'suppress', { p, q: Rb.target, r: Rb.cap }); for (let r = 1; r <= nR; r++) if (owner[r] === Rb.target) unrest[r] *= 0.85; continue; }
        if (P[Rb.target].died !== null) { settleRebel(p, y, 'fall'); continue; }
        if (y - Rb.rebelSince >= 80 && Rb.n >= 2) settleRebel(p, y, 'hold');
        else if (y >= E - 80) { if (Rb.n >= 3) settleRebel(p, y, 'hold'); else { for (let r = 1; r <= nR; r++) if (owner[r] === p) setOwner(r, Rb.target, y, true); Rb.died = y; Rb.rebelUntil = y; Rb.outcome = 'suppress'; ev(y, 'suppress', { p, q: Rb.target, r: Rb.cap }); } } } // 提前了结仍在进行的起义
    }

    // 现在：仍在进行的起义，有地盘的割据成国，没有的归还朝廷
    for (const Rb of P) { if (!Rb.rebel || Rb.died !== null) continue; if (Rb.n >= 2) settleRebel(Rb.id, E, 'hold'); else { for (let r = 1; r <= nR; r++) if (owner[r] === Rb.id) setOwner(r, P[Rb.target].died === null ? Rb.target : -1, E, true); Rb.died = E; Rb.rebelUntil = E; Rb.outcome = 'suppress'; ev(E, 'suppress', { p: Rb.id, q: Rb.target, r: Rb.cap }); } }
    // 现在的行政区划：尚未设省的国家按地方区划分省（不记入编年史）；军管的土地立即设制
    for (const q of P) if (q.died === null && q.n >= 1 && !q.org) organize(q.id, E, true);
    for (let r = 1; r <= nR; r++) occSince[r] = -1e9; admin(E); admin(E);
    for (const q of P) if (q.died === null && q.n === 0) q.died = E;
    // 保险：现在的国家数与设定值相差仍超过 8 个时，最后再兼并或割据，保证误差在 ±10 以内
    if (TARGET) for (let it = 0; it < 40; it++) { const ids = P.filter(q => q.died === null && q.n > 0).map(q => q.id); if (Math.abs(steerCount(E, ids, 1, 8, null)) <= 8) break; }
    for (const q of P) if (q.died === null && q.n === 0) q.died = E;
    for (const q of P) if (q.died === null && q.n > 0 && !q.org) organize(q.id, E, true);
    for (let r = 1; r <= nR; r++) occSince[r] = -1e9; admin(E);
    for (const q of P) if (q.died === null && q.n > 0 && (owner[q.cap] !== q.id || q.caps[q.caps.length - 1].city < 0)) { if (owner[q.cap] !== q.id) moveCapital(q.id, E, 'final'); if (q.caps[q.caps.length - 1].city < 0) { let best = -1, bp = 0; for (let r = 1; r <= nR; r++) if (owner[r] === q.id) { const v = regionPop(r, E); if (v > bp) { bp = v; best = r; } } if (best >= 0) moveCapital(q.id, E, 'found', best); } }

    // ---------- 首都与战争对城市人口的影响（终点人口不变） ----------
    { const mult = new Float64Array(C.cities.length * nT).fill(1);
      for (const q of P) { for (let i = 0; i < q.caps.length; i++) { const c = q.caps[i]; if (c.city < 0) continue; const a = c.year, b = i + 1 < q.caps.length ? q.caps[i + 1].year : (q.died === null ? E + 1 : q.died);
          for (let j = 0; j < nT; j++) { const y = Math.min(E, j * C.popStep); if (y < a - 50 || y > b + 150) continue;
            const ramp = y < a ? (y - a + 50) / 50 : y > b ? 1 - (y - b) / 150 : 1, boost = 1 + 0.6 * Math.min(1, Math.max(1, q.peakN) / 12); mult[c.city * nT + j] *= 1 + (boost - 1) * clamp(ramp, 0, 1); } } }
      for (let k = 0; k < sacks.length; k += 3) { const ci = sacks[k], y0 = sacks[k + 1], sev = sacks[k + 2];
        for (let j = 0; j < nT; j++) { const y = Math.min(E, j * C.popStep); if (y < y0 || y > y0 + 120) continue; mult[ci * nT + j] *= 1 - sev * (1 - (y - y0) / 120); } }
      C.cities.forEach((c, i) => { const mE = c.lost ? 1 : mult[i * nT + nT - 1] || 1; for (let j = 0; j < nT; j++) C.pop[i * nT + j] = Math.round(C.pop[i * nT + j] * mult[i * nT + j] / mE); if (!c.lost) C.pop[i * nT + nT - 1] = c.final; }); }

    // ---------- 命名：现存国家的名字沿世系往回传；分裂出去的叫方位 + 母名；复国叫“后某” ----------
    const used = D.usedNames;
    const libOf = cu => cu >= 0 ? h.civLib[cu] : cu <= -2 ? D.ancient[-2 - cu].libObj : (h.LIBS && h.LIBS[0]) || h.civLib[0];
    // ---------- 殖民地城市：宗主国文化库起名；港口先建，再随殖民一圈圈向内陆推进 ----------
    const INF = 1e9, hash01 = a => { a = (a ^ 61) ^ (a >>> 16); a = (a + (a << 3)) | 0; a ^= a >>> 4; a = Math.imul(a, 0x27d4eb2d); a ^= a >>> 15; return (a >>> 0) / 4294967296; };
    const colonial = { year: new Float64Array(nR + 1).fill(INF), metro: new Int32Array(nR + 1).fill(-1), cities: [] };
    { const metroOf = p0 => { let x = p0; if (typeOfCult(P[x].civ) === 'new-world' && P[x].colonialFrom === undefined) return -1;
          for (let g = 0; g < 30 && x >= 0; g++) { const Q = P[x]; if (!isNW(Q.caps[0].r)) return x; if (Q.colonialFrom !== undefined) { x = Q.colonialFrom; continue; }
            const pa = Q.parents.find(k => k.kind === 'split' || k.kind === 'secede' || k.kind === 'dynasty' || k.kind === 'revolt'); if (!pa) return -1; x = pa.id; } return -1; };
      const mCache = new Map(), mOf = p0 => { if (!mCache.has(p0)) mCache.set(p0, metroOf(p0)); return mCache.get(p0); };
      for (let i = 0; i < log.length; i += 3) { const r = log[i], y = log[i + 1], o = log[i + 2]; if (o < 0 || !isNW(r) || y >= colonial.year[r] || colonialAge === null || y < colonialAge) continue; const m = mOf(o); /* 大航海以前（陆路相连）的占领不算殖民 */ if (m >= 0) { colonial.year[r] = y; colonial.metro[r] = m; } }
      // 离殖民海岸的步数（只走已殖民的新大陆区块）
      const hop = new Int16Array(nR + 1).fill(-1), qq = []; for (let r = 1; r <= nR; r++) if (colonial.year[r] < INF && R.coast[r]) { hop[r] = 0; qq.push(r); }
      for (let k = 0; k < qq.length; k++) { const a = qq[k]; for (let kk = R.off[a]; kk < R.off[a + 1]; kk++) { const b = R.nbr[kk]; if (hop[b] >= 0 || colonial.year[b] >= INF || R.edges[R.eid[kk]].sea) continue; hop[b] = hop[a] + 1; qq.push(b); } }
      // 每座城最晚必须存在的年份：当过首都、被劫掠、编年史提到过
      const mustBy = new Float64Array(C.cities.length).fill(INF);
      for (const q of P) for (const c of q.caps) if (c.city >= 0) mustBy[c.city] = Math.min(mustBy[c.city], c.year);
      for (const e of events) if (e.city !== undefined && e.city >= 0) mustBy[e.city] = Math.min(mustBy[e.city], e.year);
      for (let k = 0; k < sacks.length; k += 3) mustBy[sacks[k]] = Math.min(mustBy[sacks[k]], sacks[k + 1]);
      const nativeCap = new Set(); for (const q of P) if (typeOfCult(q.civ) === 'new-world') for (const c of q.caps) if (c.city >= 0) nativeCap.add(c.city);
      const rndC = mulberry32((h.seed | 0) + 3131);
      // 宗主国的城市名池：先用库里没用过的城名，偶尔“新 + 宗主国大城名”
      const metroBig = (m, y) => { let b = -1, bp = 0; for (let r = 1; r <= nR; r++) { if (isNW(r)) continue; for (const i of cityIn[r]) { const c = C.cities[i]; if (!alive(c, y) || c.lost) continue; if (ownerAtYear(r, y) !== m) continue; const v = popAt(i, y); if (v > bp) { bp = v; b = i; } } } return b; };
      const ownLog = new Map(); for (let i = 0; i < log.length; i += 3) { const r = log[i]; if (!ownLog.has(r)) ownLog.set(r, []); ownLog.get(r).push(log[i + 1], log[i + 2]); }
      function ownerAtYear(r, y) { const L = ownLog.get(r); if (!L) return -1; let o = -1, yy = -INF; for (let k = 0; k < L.length; k += 2) if (L[k] <= y && L[k] >= yy) { yy = L[k]; o = L[k + 1]; } return o; }
      const bigNames = new Map();
      C.cities.forEach((c, i) => {
        const r = c.r; if (!r || c.lost || !isNW(r) || !(colonial.year[r] < INF)) return;
        const cy = colonial.year[r], m = colonial.metro[r]; if (m < 0) return;
        if (c.founded < cy && (nativeCap.has(i) || popAt(i, cy) >= 15000)) return; // 殖民前的本土大城：保留原名与年代
        const port = c.type === 'port' || c.type === 'island-port', d = Math.max(0, hop[r]), q = rndC();
        const rank = cityIn[r].indexOf(i);
        let f = cy + (port ? 5 + 35 * q : 25 + 45 * d + 50 * q) + (c.fort ? -10 : 0) + 30 * Math.max(0, rank);
        if (f > E - 8) f = cy + (E - 8 - cy) * (port ? 0.1 + 0.2 * q : Math.min(0.95, 0.3 + 0.12 * d + 0.2 * q));
        f = Math.max(cy, Math.min(f, mustBy[i], E - 5));
        const lib = libOf(P[m].civ); let nm = '';
        if (!c.fort && rndC() < 0.18) { const yb = Math.round(f / 10) * 10; let base = bigNames.get(m + ':' + yb); if (base === undefined) { const bi = metroBig(m, f); base = bi >= 0 ? C.cities[bi].name : ''; bigNames.set(m + ':' + yb, base); }
          if (base && base.length <= 5 && !/^新/.test(base) && !used.has('新' + base)) nm = '新' + base; }
        if (!nm) for (const cn of (lib.n && lib.n.cities) || []) if (!used.has(cn)) { nm = cn; break; }
        if (!nm) nm = G.NameGen.make(lib, 'city', used, rndC);
        used.add(nm);
        colonial.cities.push({ i, k: c.idx, old: c.name, name: nm, from: c.founded, founded: Math.round(f), metro: m, port });
        c.name = nm; c.founded = Math.round(f); c.colonial = m; if (c.idx >= 0 && h.settlements[c.idx]) h.settlements[c.idx].name = nm;
        // 人口：建城后由小到大，现在的人口不变
        const span = Math.max(20, E - c.founded);
        for (let j = 0; j < nT; j++) { const y = Math.min(E, j * C.popStep); C.pop[i * nT + j] = y < c.founded ? 0 : Math.round(c.final * Math.max(0.02, Math.pow((y - c.founded) / span, 1.4))); }
        C.pop[i * nT + nT - 1] = c.final;
      });
      // 内陆城市不早于同一宗主国在这块大陆上的第一座港口（没有港口则不早于第一座殖民城市）
      const firstAt = new Map(); for (const o of colonial.cities) { const key = o.metro + ':' + R.landComp[C.cities[o.i].r], f0 = firstAt.get(key); const v = o.port ? o.founded : o.founded + 1e5; if (f0 === undefined || v < f0) firstAt.set(key, v); }
      for (const o of colonial.cities) { if (o.port) continue; const c = C.cities[o.i], f0 = firstAt.get(o.metro + ':' + R.landComp[c.r]) % 1e5, lo = Math.min(E - 5, f0 + 15 + 10 * Math.max(0, hop[c.r]));
        if (c.founded < lo && lo <= mustBy[o.i]) { c.founded = o.founded = Math.round(lo); const span = Math.max(20, E - c.founded); for (let j = 0; j < nT - 1; j++) { const y = Math.min(E, j * C.popStep); C.pop[o.i * nT + j] = y < c.founded ? 0 : Math.round(c.final * Math.max(0.02, Math.pow((y - c.founded) / span, 1.4))); } } }
      // 编年史与道路：随新的建城年份与名字更新
      const byI = new Map(colonial.cities.map(o => [o.i, o]));
      for (const e of C.events) if (e.city !== undefined && byI.has(e.city) && e.kind === 'found') { const o = byI.get(e.city); e.year = o.founded; e.text = `${o.name}建城（殖民地）`; }
      if (C.roads) { for (const rd of C.roads) { const fa = rd.sa >= 0 ? C.cities[rd.sa].founded : 0, fb = rd.sb >= 0 ? C.cities[rd.sb].founded : 0, lo = Math.max(fa, fb); if (rd.year < lo + 10) rd.year = Math.round(Math.min(E - 3, lo + 10 + 40 * hash01(rd.sa * 31 + rd.sb))); } C.roads.sort((a, b) => a.year - b.year); }
      // 首批殖民港口记入编年史（每个宗主国一条）
      const firstC = new Map(); for (const o of colonial.cities) { const f0 = firstC.get(o.metro); if (!f0 || o.founded < f0.founded || (o.founded === f0.founded && o.port)) firstC.set(o.metro, o); }
      for (const o of firstC.values()) ev(o.founded, 'colonyCity', { p: o.metro, city: o.i, r: C.cities[o.i].r, port: o.port });
    }
    const draw = (lib) => { for (const nm of (lib.n && lib.n.states) || []) if (nm.length <= 4 && !used.has(nm)) { used.add(nm); return nm; }
      return G.NameGen.make(lib, 'state', used, rnd); };
    const titlesOf = (lib, tp) => { const t = lib.t || {}; const f = (k, d) => (t[k] && t[k][0]) || d; const xt = k => G.CultureExt ? G.CultureExt.extraTitle(lib, k) : null; return { vassal: xt('vassal') || f('monarchy', '王国'), colony: xt('colony') || '殖民地', theo: xt('theocracy') || '教国', city: tp === 'maritime' ? f('cityRepublic', '城邦') : '城邦', kingdom: f('monarchy', '王国'), empire: f('empire', '帝国'), nomad: f('nomadic', '汗国'), chief: f('chiefdom', '酋邦'), republic: f('republic', '共和国') }; };
    for (const q of P) if (q.heirOf >= 0) { const c = countries[q.heirOf]; q.short = c.short; q.finalName = c.name; used.add(c.short); }
    const order = P.map(q => q.id).sort((a, b) => P[a].born - P[b].born || a - b);
    for (const id of order) { const q = P[id]; if (q.short) continue; const lib = libOf(q.civ), pa = q.parents[0];
      if (pa && (pa.kind === 'split' || pa.kind === 'secede') && P[pa.id].short && P[pa.id].short.length <= 2 && !/^[东西南北后新]/.test(P[pa.id].short)) {
        const A = P[pa.id], dx0 = R.cx[q.cap] - R.cx[A.cap], dx = Math.abs(dx0) > h.W ? -dx0 : dx0, dy = R.cy[q.cap] - R.cy[A.cap];
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? '东' : '西') : (dy > 0 ? '南' : '北'); const nm = dir + A.short;
        if (!used.has(nm)) { used.add(nm); q.short = nm; continue; } }
      q.short = draw(lib); }
    for (const q of P) if (q.restoreOf !== undefined) { const X = P[q.restoreOf]; if (q.heirOf < 0 && X.short && X.short.length <= 2) { const nm = '后' + X.short; if (!used.has(nm)) { used.add(nm); q.short = nm; } } }
    for (const q of P) { const tp = typeOfCult(q.civ); q.titles = titlesOf(libOf(q.civ), tp); q.type = tp; if (q.theo !== undefined) { const fr = q.theoRel !== undefined && q.theoRel >= 0 ? q.theoRel : rel[q.cap]; const cl = fr >= 0 && RELS[fr] && RELS[fr].clergy; if (cl && cl.theocracy && !(libOf(q.civ).t || {}).theocracy) q.titles.theo = cl.theocracy; q.theoRel = fr; } /* 神权国称号：宗教库的圣职体系（哈里发国、法王国……） */ if (q.settledCiv !== undefined && q.settledCiv !== -1) { const t2 = typeOfCult(q.settledCiv); q.titles2 = titlesOf(libOf(q.settledCiv), t2 === 'pastoral' ? 'agrarian' : t2); } } // 入主定居：改用所入主之地的称号
    // 省名：延续到现在的省一直用现在的名字；以国为省的用旧国名加等级；其余从统治者文明的文化库取
    for (let k = 0; k < nPP; k++) if (presentProv[k]) used.add(presentProv[k].name);
    const RANKW = { 4: '郡', 5: '郡', 6: '州', 7: '省', 8: '省' };
    const drawProv = lib => { for (const nm of (lib.n && lib.n.provinces) || []) if (!used.has(nm)) { used.add(nm); return nm; } return G.NameGen.make(lib, 'prov', used, rnd); }; // 库里的省名用完：按该库的词根与省名结尾拼
    for (const X of PV) { if (X.present >= 0 && presentProv[X.present] && !(colonial.metro[X.seat] >= 0)) { X.name = presentProv[X.present].name; continue; }
      if (colonial.metro[X.seat] >= 0) { X.name = drawProv(libOf(P[colonial.metro[X.seat]].civ)); continue; } // 殖民地的省：宗主国的地名
      if (X.fromState >= 0 && P[X.fromState].short) { const nm = P[X.fromState].short + (RANKW[X.stage] || '郡'); if (!used.has(nm)) { used.add(nm); X.name = nm; continue; } }
      X.name = drawProv(libOf(P[X.owner] ? P[X.owner].civ : -1)); }
    const cultName = c => c >= 0 ? (opt.cultureNames ? opt.cultureNames[c] : '某文明') : c <= -2 ? D.ancient[-2 - c].name : '某部族';
    // 起义军的名号：东方风格的文化库用象征（赤眉、黄巾……），其余用起事地 + 起义
    const SYM = ['赤眉', '黄巾', '绿林', '白莲', '红巾', '青犊', '铜马', '黑山', '白波', '赤旗', '青巾', '黄旗'];
    const eastern = lib => /chinese|realistic-00|eastern|japanese|korean/.test(lib.id || '');
    let symI = 0;
    for (const q of P) { if (!q.rtype) continue; const lib = libOf(q.civ), place = (() => { const ci = bigCity(q.caps[0].r, q.born); return ci >= 0 ? C.cities[ci].name : (q.short || '').slice(0, 2); })();
      const RX = G.CultureExt ? G.CultureExt.ext(lib).rebel : null;
      if (RX) { const syms = RX.symbols && RX.symbols.length ? RX.symbols : SYM, sym2 = syms[(symI++ + (h.seed | 0)) % syms.length], fr = q.relAt >= 0 && RELS[q.relAt] ? RELS[q.relAt] : null, her = fr && fr.heresies && fr.heresies.length ? fr.heresies[(q.id + (h.seed | 0)) % fr.heresies.length] : null;
        q.rebelName = q.rtype === 'religious' ? (her ? her + '起义军' : place + '圣战军') : q.rtype === 'loyalist' ? (q.memoryOf >= 0 && P[q.memoryOf].short ? P[q.memoryOf].short + '遗民军' : place + '义军') : q.rtype === 'ethnic' ? (cultName(q.civ).replace(/文明$/, '') + '人起义军')
          : (RX.style === 'symbol' ? RX.fmt.replace('{sym}', sym2) : RX.fmt.replace('{place}', place).replace('{sym}', sym2)); continue; }
      const sym = SYM[(symI++ + (h.seed | 0)) % SYM.length];
      q.rebelName = q.rtype === 'religious' ? (eastern(lib) ? sym + '教军' : place + '圣战军') : q.rtype === 'loyalist' ? (q.memoryOf >= 0 && P[q.memoryOf].short ? P[q.memoryOf].short + '遗民军' : place + '义军') : q.rtype === 'ethnic' ? (cultName(q.civ).replace(/文明$/, '') + '人起义军') : eastern(lib) ? sym + '军' : place + '起义军'; }
    const EMPN = Math.round(20 * scale);
    const formOf = (q, n, cs, vas, y) => q.theo !== undefined && (y === undefined || y >= q.theo) ? 'theo' : q.type === 'pastoral' && !(q.settled !== undefined && (y === undefined || y >= q.settled)) ? (cs >= 3 ? 'nomad' : 'chief') : n <= 2 && cs <= 3 ? 'city' : vas && cs >= 3 ? 'vassal' : n >= EMPN && cs >= 5 ? 'empire' : cs <= 2 ? 'chief' : 'kingdom'; // 附庸：用文化库的附庸称号（公国、藩国、萨特拉普辖地……），不称帝
    const vasAt = (q, y) => { let l = -1; for (let i = 0; i < q.vas.length; i += 2) { if (q.vas[i] > y) break; l = q.vas[i + 1]; } return l >= 0; };
    const nAt = (q, y) => { let n = q.ext.length ? q.ext[1] : 1; for (let i = 0; i < q.ext.length; i += 2) { if (q.ext[i] > y) break; n = q.ext[i + 1]; } return n; };
    const capAt = (q, y) => { let c = q.caps[0]; for (const x of q.caps) { if (x.year > y) break; c = x; } return c; };
    const nameAt = (p, y) => { const q = P[p]; if (q.finalName && y >= E - 60) return q.finalName; if (q.rebelName && (q.rebelUntil === undefined || y < q.rebelUntil)) return q.rebelName; if (q.republic) return q.short + q.titles.republic; const c = capAt(q, y); const fm = formOf(q, nAt(q, y), stageAt(c.r, y), vasAt(q, y), y), T = q.titles2 && q.settled !== undefined && y >= q.settled ? q.titles2 : q.titles; return q.short + (T[fm] || q.titles[fm]); };
    const cityName = i => i >= 0 && C.cities[i] ? C.cities[i].name : '';
    const own0 = new Map(); for (let i = 0; i < log.length; i += 3) { const r = log[i]; if (!own0.has(r)) own0.set(r, []); own0.get(r).push(log[i + 1], log[i + 2]); }
    const owner0 = (r, y) => { const L = own0.get(r); let o = -1; if (L) for (let i = 0; i < L.length; i += 2) if (L[i] <= y) o = L[i + 1]; return o; };
    const relName = f => RELS[f] ? RELS[f].name : '本教';
    const big = p => P[p].peakN >= NAMEBIG;
    const texts = [];
    for (const e of events) { const y = e.year; let t = null, major = false;
      switch (e.kind) {
        case 'unify': t = P[e.p].type === 'pastoral' ? `${nameAt(e.p, y)}统一草原诸部` : `${nameAt(e.p, y)}统一周边诸城邦，建立王国`; major = true; break;
        case 'vassal': t = e.how === 'split' ? `${nameAt(e.q, y)}自立，仍奉${nameAt(e.p, y)}为宗主` : `${nameAt(e.q, y)}臣服于${nameAt(e.p, y)}，成为附庸`; major = big(e.p) && P[e.q].peakN >= 3; break;
        case 'vassalFree': t = `${nameAt(e.q, y)}摆脱${nameAt(e.p, y)}，不再称臣`; major = P[e.q].peakN >= 3; break;
        case 'vassalAnnex': t = `${nameAt(e.p, y)}撤藩，${nameAt(e.q, Math.max(0, y - 1))}并入直辖`; major = P[e.q].peakN >= 3; break;
        case 'annex': if (P[e.q].peakN < 3) break; t = `${nameAt(e.p, y)}吞并${nameAt(e.q, Math.min(y - 1, P[e.q].peakYear))}`; major = big(e.q); break;
        case 'sack': t = `${nameAt(e.p, y)}${e.gun ? '凭火器之利，' : ''}攻破${nameAt(e.q, Math.min(y - 1, P[e.q].peakYear))}都城${cityName(e.city)}`; major = big(e.q); break;
        case 'nomad': t = `${nameAt(e.p, y)}攻入${cityName(e.city)}，${nameAt(e.q, Math.min(y - 1, P[e.q].peakYear))}亡，${P[e.p].short}入主其地`; major = true; break;
        case 'split': t = `${nameAt(e.p, y)}陷入内乱，${e.kids.map(c => nameAt(c, y)).join('、')}自立`; major = big(e.p); break;
        case 'dynasty': t = `${nameAt(e.q, Math.min(y - 1, P[e.q].peakYear))}亡，${nameAt(e.p, y)}代之`; major = big(e.q); break;
        case 'restore': t = `${nameAt(e.p, y)}收复${P[e.q].short}故土，宣告复国`; major = true; break;
        case 'capital': if (e.city < 0) break; { const nm = nameAt(e.p, y), cn = cityName(e.city);
          t = e.why === 'final' || e.why === 'found' ? `${nm}定都${cn}` : e.why === 'center' ? `${nm}疆域日广，为便于统治，迁都${cn}` : e.why === 'sack' ? `都城失陷，${nm}迁都${cn}` : e.why === 'split' ? `${nm}分裂后迁都${cn}` : e.why === 'dynasty' ? `新朝${nm}迁都${cn}` : `${nm}迁都${cn}`; }
          major = e.why === 'center' && big(e.p); break;
        case 'settle': t = `${nameAt(e.p, y - 1)}入主农耕之地，迁都${cityName(e.city)}，改行定居王朝，称${nameAt(e.p, y)}`; major = true; break;
        case 'idea': t = `${D.IDEAS[e.k].name}思潮在${cityName(e.city) || (owner0(e.r, y) >= 0 ? nameAt(owner0(e.r, y), y) : '某地')}兴起：${D.IDEAS[e.k].desc}`; major = true; break;
        case 'adopt': t = `${nameAt(e.p, y)}接纳${D.IDEAS[e.k].name}思潮${D.IDEAS[e.k].id === 'navigation' ? '，从此可以远渡重洋' : ''}`; major = D.IDEAS[e.k].id === 'navigation'; break;
        case 'schism': t = `${nameAt(e.p, y)}改奉${RELS[e.g].name}，自${RELS[e.f].name}分裂而出`; major = true; break;
        case 'theocracy': t = `${nameAt(e.p, y - 1)}祭司掌权，以${relName(e.f)}立国，政教合一，改称${nameAt(e.p, y)}`; major = true; break;
        case 'secede': t = `${nameAt(e.p, y)}脱离${nameAt(e.q, Math.min(y - 1, P[e.q].peakYear))}独立`; major = true; break;
        case 'rise': t = `${nameAt(e.p, y)}建立`; major = true; break;
        case 'organize': t = `${nameAt(e.p, y)}初置行省，分天下为 ${e.n} 省`; major = big(e.p); break;
        case 'fromState': t = `${nameAt(e.p, y)}灭${nameAt(e.q, Math.min(y - 1, P[e.q].peakYear))}，以其地置${PV[e.pv].name}`; major = big(e.q) || P[e.q].peakN >= 3; break;
        case 'transfer': t = `${PV[e.pv].name}改隶${nameAt(e.p, y)}`; major = false; break;
        case 'provSecede': t = `${PV[e.pv].name}割据自立，建立${nameAt(e.p, y)}`; major = PV[e.pv].n >= 3 || big(e.q); break;
        case 'provSplit': t = `${nameAt(e.p, y)}析${PV[e.pv].name}，置${PV[e.nv].name}`; major = false; break;
        case 'reform': t = `${nameAt(e.p, y)}改行今制，全国分为 ${e.n} 省`; major = false; break;
        case 'disaster': t = `${{ drought: '大旱', flood: '大水', locust: '蝗灾', famine: '饥荒' }[e.kind2 || e.dk] || '饥荒'}${e.p >= 0 ? '席卷' + nameAt(e.p, y) : ''}，${e.n} 地颗粒无收`; major = false; break;
        case 'revolt': t = `${e.famine ? '饥民四起，' : ''}${nameAt(e.q, y)}境内爆发${P[e.p].rebelName}（${{ peasant: '农民起义', ethnic: '民族起义', religious: '教民起义', loyalist: '遗民起义' }[e.rtype]}）`; major = P[e.p].outcome === 'state' || P[e.p].outcome === 'overthrow'; break;
        case 'suppress': t = `${nameAt(e.q, y)}镇压了${P[e.p].rebelName}`; major = false; break;
        case 'rebelState': t = e.restoreOf >= 0 ? `${P[e.p].rebelName}光复故土，${nameAt(e.p, y)}复国` : `${P[e.p].rebelName}割据一方，建立${nameAt(e.p, y)}`; major = true; break;
        case 'overthrow': t = e.restoreOf >= 0 ? `${P[e.p].rebelName}攻入${cityName(e.city)}，${nameAt(e.q, y - 1)}亡，遗民光复故国，${nameAt(e.p, y)}复国` : `${P[e.p].rebelName}攻入都城${cityName(e.city)}，${nameAt(e.q, y - 1)}亡，${nameAt(e.p, y)}代之`; major = true; break;
        case 'coup': t = `${nameAt(e.q, y - 1)}宫廷政变，${nameAt(e.p, y)}代之`; major = big(e.q); break;
        case 'revolution': t = `${nameAt(e.q, y - 1)}爆发革命，改建${nameAt(e.p, y)}`; major = true; break;
        case 'colonyCity': t = `${nameAt(e.p, y)}在新大陆建起第一座殖民${e.port ? '港口' : '城市'}${cityName(e.city)}`; major = true; break;
        case 'discovery': t = `${nameAt(e.p, y)}的船队远渡重洋，抵达新大陆，大航海时代开始`; major = true; break;
        case 'colony': t = `${nameAt(e.p, y)}在新大陆建立殖民地${e.city >= 0 ? cityName(e.city) : ''}`; major = !!e.first; break;
        case 'independence': t = `${nameAt(e.q, y)}的新大陆殖民地宣布独立，建立${nameAt(e.p, y)}`; major = true; break;
        case 'migrate': t = `${cultName(e.c)}的部族随${nameAt(e.p, y)}的征服迁入新地`; major = big(e.p); break;
        case 'convert': t = `${nameAt(e.p, y)}奉${RELS[e.f] ? RELS[e.f].name : '新宗教'}为国教`; major = big(e.p); break;
      }
      if (t) texts.push({ year: y, kind: e.kind === 'secede' ? 'secede' : e.kind, text: t, r: e.r || 0, city: e.city !== undefined ? e.city : undefined, p: e.p, q: e.q, kids: e.kids, pv: e.pv, major }); }
    // 现在的各国：成形事件（继承者的首个年份）
    for (const q of P) if (q.heirOf >= 0 && q.born < T0 && q.peakN >= 3) { const n0 = nameAt(q.id, q.born), tail = n0 === q.finalName ? '，国祚延续至今' : `——今日${q.finalName}的前身`;
      const birth = texts.find(t => t.p === q.id && t.year === q.born && (t.kind === 'dynasty' || t.kind === 'secede'));
      if (birth) birth.text += tail; else texts.push({ year: q.born, kind: 'rise', text: n0 + '建立' + tail, r: q.caps[0].r, p: q.id, major: big(q.id) }); }

    // ---------- 君主世系与政府组织：人名、王朝（家族）、称谓、庙号或序数、官制，均取自文化库 ----------
    { const CE = G.CultureExt, rndR = mulberry32((h.seed | 0) + 5353), regCount = new Map(), firstOf = new Map();
      const govKey = (q, y) => { if (q.rtype && y >= q.rebelSince && (q.rebelUntil === undefined || y < q.rebelUntil)) return 'rebel'; if (q.theo !== undefined && y >= q.theo) return 'theo'; if (q.republic) return 'republic';
        const c = capAt(q, y), cs = stageAt(c.r, y), fm = formOf(q, nAt(q, y), cs, vasAt(q, y), y); if (fm === 'vassal') return 'vassal'; if (fm === 'nomad') return 'nomad'; if (fm === 'chief') return 'chief'; if (fm === 'city') return 'city'; if (cs >= 7) return 'central'; if (cs === 6) return 'feudal'; return fm === 'empire' ? 'empire' : 'king'; };
      const RKEY = { rebel: 'rebel', theo: 'theo', republic: 'republic', vassal: 'vassal', nomad: 'nomad', chief: 'chief', city: 'city', central: 'king', feudal: 'king', empire: 'empire', king: 'king' };
      for (const q of P) {
        const end = q.died === null ? E : q.died, lib = libOf(q.settledCiv !== undefined && q.settledCiv !== -1 ? q.settledCiv : q.civ), X = CE ? CE.ext(lib) : null; q.rulers = []; q.gov = [];
        if (!X || end < q.born) continue;
        const pa = q.parents[0], inherit = pa && (pa.kind === 'restore') && P[pa.id].house;
        let house = inherit ? P[pa.id].house : X.people.surnames[Math.floor(rndR() * X.people.surnames.length)];
        if (pa && pa.kind === 'dynasty' && P[pa.id].house === house && X.people.surnames.length > 1) house = X.people.surnames[(X.people.surnames.indexOf(house) + 1 + Math.floor(rndR() * (X.people.surnames.length - 1))) % X.people.surnames.length];
        q.house = house; q.houseName = q.republic ? '' : X.house.replace('{s}', house); q.govStyle = X.gov.style;
        // 政府组织：随政体与发展阶段变迁
        let lastK = ''; for (let y = q.born; y <= end; y += 20) { const k = govKey(q, Math.min(y, end)); if (k !== lastK) { q.gov.push([Math.round(y), (X.gov.org && X.gov.org[k]) || k, k]); lastK = k; } }
        // 君主：每位在位六到四十余年；共和执政、起义首领另计
        let y = q.born, idx = 0; if (!regCount.has(q.lin)) regCount.set(q.lin, new Map()); const RC = regCount.get(q.lin);
        while (y < end || idx === 0) { const k = govKey(q, y), rep = k === 'republic', len = rep ? 4 + rndR() * 8 : k === 'rebel' ? 15 + rndR() * 30 : 6 + rndR() * rndR() * 48;
          let nm = CE.personName(lib, rndR, { surname: rep ? undefined : house }); if (X.regnal !== 'number') for (let t = 0; t < 6 && q.rulers.slice(-8).some(r => r[1].endsWith(nm.given)); t++) nm = CE.personName(lib, rndR, { surname: rep ? undefined : house }); /* 直呼其名与庙号：近几代不重名 */
          let disp;
          if (rep || k === 'rebel') disp = (X.regnal === 'number' ? nm.given : nm.surname + nm.given);
          else if (X.regnal === 'number') { const c = (RC.get(nm.given) || 0) + 1; RC.set(nm.given, c); disp = nm.given + (c >= 2 ? CE.NUM[Math.min(15, c)] : ''); if (c === 1) firstOf.set(q.lin + ':' + nm.given, [q.rulers, q.rulers.length]); else if (c === 2) { const f0 = firstOf.get(q.lin + ':' + nm.given); if (f0) f0[0][f0[1]][1] += CE.NUM[1]; } }
          else if (X.regnal === 'temple') disp = (CE.TEMPLE[idx] || '') + ' ' + nm.surname + nm.given;
          else disp = (X.family === 'japanese' ? nm.surname : '') + nm.given;
          const fmR = formOf(q, nAt(q, y), stageAt(capAt(q, y).r, y), vasAt(q, y), y);
          let title = k === 'theo' ? ((q.theoRel >= 0 && RELS[q.theoRel] && RELS[q.theoRel].clergy && RELS[q.theoRel].clergy.ruler) || X.ruler.king) : (k === 'central' || k === 'feudal' || k === 'king' || k === 'empire' ? (fmR === 'empire' ? X.ruler.empire : X.ruler.king) : X.ruler[RKEY[k]]) || X.ruler.king;
          q.rulers.push([Math.round(y), disp.trim(), title]); y += len; idx++; if (idx > 400) break; }
        if (q.died !== null && q.rulers.length > 1 && X.regnal === 'temple') { const L = q.rulers[q.rulers.length - 1]; L[1] = L[1].replace(/^\S+/, q.children.some(c => c.kind === 'conquer') ? '末帝' : L[1].split(' ')[0]); }
      } }
    // ---------- 思潮：兴起与大国接纳（写进编年史） ----------
    { D.IDEAS.forEach((I, k) => { const yb = D.ideaBorn[k]; if (!(yb < INF) || yb > E) return; const o = D.ideaOrigins[k].filter(r => D.ideaA[k * NN + r] <= yb + 60)[0] || D.ideaOrigins[k][0]; if (!o) return;
        ev(Math.round(yb), 'idea', { k, r: o, city: bigCity(o, Math.round(yb)) });
        // 大国接纳：都城所在之地接纳的那一年
        for (const q of P) { if (q.rtype) continue; const endY = q.died === null ? E : q.died; let t = INF;
          for (let i = 0; i < q.caps.length && t >= INF; i++) { const c = q.caps[i], a = c.year, b = i + 1 < q.caps.length ? q.caps[i + 1].year : endY, ya = D.ideaA[k * NN + c.r]; const yy = Math.max(a, ya); if (ya < INF && yy < b) t = yy; }
          if (t < INF) (q.ideaAdopt = q.ideaAdopt || []).push([k, Math.round(t)]);
          if (q.peakN >= NAMEBIG && t < INF && t > q.born + 5 && t > yb + 5) ev(Math.round(t), 'adopt', { p: q.id, k, r: q.cap }); } }); }
    // ---------- 配色：同时代相邻的政权不同色；王朝更替、复国沿用前代色相 ----------
    const adj = Array.from({ length: P.length }, () => new Set());
    { const own = new Int32Array(nR + 1).fill(-1); let li = 0; const ord = []; for (let i = 0; i < log.length; i += 3) ord.push(i); ord.sort((a, b) => log[a + 1] - log[b + 1] || a - b);
      const ticks = []; for (let y = ys; y <= E; y += TICK * 5) ticks.push(y);
      for (const y of ticks) { while (li < ord.length && log[ord[li] + 1] <= y) { const i = ord[li++]; own[log[i]] = log[i + 2]; }
        for (const ed of R.edges) { const a = own[ed.a], b = own[ed.b]; if (a >= 0 && b >= 0 && a !== b) { adj[a].add(b); adj[b].add(a); } } } }
    const HUES = [8, 32, 52, 88, 128, 160, 188, 212, 238, 268, 292, 320]; // 与人文地图原有的国家配色同一套：柔和的地图色
    const hsl = (hh, s, l) => { hh = ((hh % 360) + 360) % 360 / 360; const f = n => { const k = (n + hh * 12) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); }; return [f(0), f(8), f(4)]; };
    const slot = new Int16Array(P.length).fill(-1);
    for (const id of order) { const q = P[id], used2 = new Set(); for (const o of adj[id]) if (slot[o] >= 0) used2.add(slot[o]);
      const pref = []; const pa = q.parents.find(x => x.kind === 'dynasty' || x.kind === 'restore'); if (pa && slot[pa.id] >= 0) pref.push(slot[pa.id]);
      const sp = q.parents.find(x => x.kind === 'split' || x.kind === 'secede'); if (sp && slot[sp.id] >= 0) { const s0 = slot[sp.id]; pref.push((s0 % 12) + 12 * ((Math.floor(s0 / 12) + 1) % 3), (s0 % 12) + 12 * ((Math.floor(s0 / 12) + 2) % 3)); }
      let s = pref.find(x => !used2.has(x)); if (s === undefined) for (let t = 0; t < 36; t++) { const c = ((id * 7 + t * 5) % 12) + 12 * ((id + Math.floor(t / 12)) % 3); if (!used2.has(c)) { s = c; break; } } if (s === undefined) s = id % 36;
      slot[id] = s; q.color = hsl(HUES[s % 12] + ((id * 13) % 9) - 4, [0.5, 0.46, 0.44][Math.floor(s / 12)], [0.74, 0.8, 0.66][Math.floor(s / 12)]); }

    // ---------- 输出：每个区块的易手记录（按年份），政权表 ----------
    const per = Array.from({ length: nR + 1 }, () => []); for (let i = 0; i < log.length; i += 3) per[log[i]].push(log[i + 1], log[i + 2]);
    const off = new Int32Array(nR + 2); for (let r = 1; r <= nR + 1; r++) off[r] = off[r - 1] + (r - 1 >= 1 ? per[r - 1].length / 2 : 0);
    const chgY = new Float32Array(off[nR + 1]), chgO = new Int32Array(off[nR + 1]);
    for (let r = 1; r <= nR; r++) { const l = per[r]; for (let i = 0; i < l.length; i += 2) { chgY[off[r] + i / 2] = l[i]; chgO[off[r] + i / 2] = l[i + 1]; } }
    const polities = P.map(q => ({ short: q.short, finalName: q.finalName || null, titles: q.titles, type: q.type, civ: q.civ, born: q.born, died: q.died, parents: q.parents, children: q.children,
      caps: q.caps.map(c => [c.year, c.city, c.r]), vas: q.vas.slice(), peakN: q.peakN, peakYear: q.peakYear, color: q.color, heirOf: q.heirOf, ext: q.ext, restoreOf: q.restoreOf === undefined ? -1 : q.restoreOf }));
    const csr = L => { const per = Array.from({ length: nR + 1 }, () => []); for (let i = 0; i < L.length; i += 3) per[L[i]].push(L[i + 1], L[i + 2]);
      const o = new Int32Array(nR + 2); for (let r = 1; r <= nR + 1; r++) o[r] = o[r - 1] + (r - 1 >= 1 ? per[r - 1].length / 2 : 0);
      const yy = new Float32Array(o[nR + 1]), vv = new Int32Array(o[nR + 1]); for (let r = 1; r <= nR; r++) { const l = per[r]; for (let i = 0; i < l.length; i += 2) { yy[o[r] + i / 2] = l[i]; vv[o[r] + i / 2] = l[i + 1]; } } return { off: o, year: yy, val: vv }; };
    // 省份配色：同时代相邻的省不同色（省的色相跨朝代不变）
    const padj = Array.from({ length: PV.length }, () => new Set());
    { const pr = new Int32Array(nR + 1).fill(-1); const ord = []; for (let i = 0; i < pvLog.length; i += 3) ord.push(i); let li = 0;
      for (let y = ys; y <= E; y += TICK * 5) { while (li < ord.length && pvLog[ord[li] + 1] <= y) { const i = ord[li++]; pr[pvLog[i]] = pvLog[i + 2]; }
        for (const ed of R.edges) { const a = pr[ed.a], b = pr[ed.b]; if (a >= 0 && b >= 0 && a !== b) { padj[a].add(b); padj[b].add(a); } } } }
    const pslot = new Int16Array(PV.length).fill(-1);
    for (const X of PV) { const usedS = new Set(); for (const o of padj[X.id]) if (pslot[o] >= 0) usedS.add(pslot[o]); let sl = -1;
      if (X.parents.length && pslot[X.parents[0]] >= 0 && !usedS.has(pslot[X.parents[0]])) sl = pslot[X.parents[0]];
      if (sl < 0) for (let t = 0; t < 36; t++) { const c = ((X.id * 7 + t * 5) % 12) + 12 * ((X.id + Math.floor(t / 12)) % 3); if (!usedS.has(c)) { sl = c; break; } } if (sl < 0) sl = X.id % 36;
      pslot[X.id] = sl; X.color = hsl(HUES[sl % 12] + ((X.id * 11) % 9) - 4, [0.42, 0.38, 0.4][Math.floor(sl / 12)], [0.76, 0.83, 0.68][Math.floor(sl / 12)]); }
    const provinces = PV.map(X => ({ name: X.name, created: X.created, abolished: X.abolished, seats: X.seats, kind: X.kind, parents: X.parents, children: X.children, hist: X.hist, present: X.present, fromState: X.fromState, color: X.color, stage: X.stage }));
    polities.forEach((q, i) => { const Q = P[i]; q.ideaAdopt = (Q.ideaAdopt || []).sort((a, b) => a[1] - b[1]); q.rulers = Q.rulers; q.gov = Q.gov; q.houseName = Q.houseName; q.govStyle = Q.govStyle; if (Q.theoRel !== undefined) q.theoRel = Q.theoRel; if (Q.theo !== undefined) q.theo = Q.theo; if (Q.settled !== undefined) { q.settled = Q.settled; if (Q.titles2) q.titles2 = Q.titles2; } q.org = Q.org === undefined ? null : Q.org; q.lin = Q.lin; if (Q.outcome) q.outcome = Q.outcome; if (Q.colonialFrom !== undefined) q.colonialFrom = Q.colonialFrom; if (Q.rtype) { q.rebelName = Q.rebelName; q.rtype = Q.rtype; q.rebelSince = Q.rebelSince; q.rebelUntil = Q.rebelUntil === undefined ? Q.died : Q.rebelUntil; } if (Q.republic) q.republic = true; });
    const uS = unrestSamples.length / 2, uYears = new Float32Array(uS), uData = new Uint8Array(uS * (nR + 1)); for (let i = 0; i < uS; i++) { uYears[i] = unrestSamples[2 * i]; uData.set(unrestSamples[2 * i + 1], i * (nR + 1)); }
    // ---------- 终局：现在的国家与省份（写回现在的地图） ----------
    const FORMS = { city: 'cityRepublic', kingdom: 'monarchy', empire: 'empire', nomad: 'nomadic', chief: 'chiefdom', theo: 'theocracy', vassal: 'vassal' };
    const aliveNow = P.filter(q => q.died === null && q.n > 0).sort((a, b) => b.n - a.n || a.id - b.id);
    const countryOfP = new Int32Array(P.length).fill(-1); aliveNow.forEach((q, i) => countryOfP[q.id] = i);
    const settleIdx = ci => ci >= 0 && C.cities[ci] ? C.cities[ci].idx : -1;
    const nowCountries = aliveNow.map(q => { const f = q.republic ? 'republic' : FORMS[formOf(q, q.n, stageAt(q.cap, E), q.liege >= 0 && P[q.liege].died === null, E)] || 'monarchy';
      return { p: q.id, name: nameAt(q.id, E), short: q.short, form: f, capRegion: q.cap, capital: settleIdx(bigCity(q.cap, E)), civ: cult[q.cap], religion: rel[q.cap], n: q.n, color: q.color, liegeP: q.liege >= 0 && P[q.liege].died === null ? topLiege(q.id) : -1, gov: q.gov.length ? q.gov[q.gov.length - 1][1] : '', govStyle: q.govStyle, ruler: q.rulers.length ? q.rulers[q.rulers.length - 1] : null, house: q.houseName, rulers: q.rulers.length, ideas: D.IDEAS.map((I, k) => D.ideaA[k * NN + q.cap] <= E ? I.name : null).filter(Boolean), mil: milAt(q.cap, E), adm: admAt(q.cap, E) }; });
    const provIdx = new Int32Array(PV.length).fill(-1), nowProvinces = [];
    for (const X of PV) { if (X.n <= 0 || X.abolished !== null) continue; const regs = []; for (let r = 1; r <= nR; r++) if (prov[r] === X.id) regs.push(r); if (!regs.length) continue;
      const own = owner[regs[0]], seatR = regs.includes(X.seat) ? X.seat : bigRegion(regs, E); provIdx[X.id] = nowProvinces.length;
      nowProvinces.push({ pv: X.id, name: X.name, country: own >= 0 ? countryOfP[own] : -1, seatRegion: seatR, seat: settleIdx(bigCity(seatR, E)) }); }
    const religionsOut = RELS.map((F0, f) => ({ name: F0.name, lib: F0.lib, libLabel: F0.libLabel, type: F0.type, spread: F0.spread, color: F0.color, symbol: F0.symbol, relic: F0.relic, holy: F0.holy, holyList: F0.holyList, clergy: F0.clergy, branches: F0.branches, heresies: F0.heresies, founded: Math.round(F0.founded), origin: F0.origin, parent: F0.parent }));
    const end = { religions: religionsOut, owner: Int32Array.from(owner), prov: Int32Array.from(prov), cult: Int32Array.from(cult), rel: Int32Array.from(rel), countryOfP, provIdx, countries: nowCountries, provinces: nowProvinces };
    return { end, unrest: { years: uYears, data: uData }, provinces, provLog: csr(pvLog), cultLog: csr(cLog), relLog: csr(rLog), polities, own: { off, year: chgY, owner: chgO }, events: texts, EMPN, T0, stats: { polities: P.length, alive: aliveNow.length, changes: chgY.length } };
  }

  G.HistoryPolity = { run };
})(typeof self !== 'undefined' ? self : this);
