/* 历史区块：历史推演的基本单元。
 * 规则：区块永不跨越现在的国界与省界（终点才能在区块层面严格重现现在的国家与省份）；
 *       边疆与部族地带按文明分区；城市优先作区块中心；区块之间的分界顺着山脊与陡坡走。
 * 输入为 society.js 交给 Worker 的中间量 hist（半分辨率网格）。 */
(function (G) {
  'use strict';
  const DY = [-1, -1, -1, 0, 0, 1, 1, 1], DX = [-1, 0, 1, -1, 1, -1, 0, 1], DL = [Math.SQRT2, 1, Math.SQRT2, 1, 1, Math.SQRT2, 1, Math.SQRT2];
  const N4 = [1, 3, 4, 6];

  function Heap(cap) { this.k = new Int32Array(Math.max(16, cap)); this.v = new Float64Array(Math.max(16, cap)); this.n = 0; }
  Heap.prototype.push = function (key, val) {
    if (this.n >= this.k.length) { const k = new Int32Array(this.k.length * 2); k.set(this.k); this.k = k; const v = new Float64Array(this.v.length * 2); v.set(this.v); this.v = v; }
    let i = this.n++; const k = this.k, v = this.v;
    while (i > 0) { const p = (i - 1) >> 1; if (v[p] <= val) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  };
  Heap.prototype.pop = function () {
    const k = this.k, v = this.v, top = k[0]; this.top = v[0];
    const lk = k[--this.n], lv = v[this.n];
    let i = 0;
    for (;;) { let c = 2 * i + 1; if (c >= this.n) break; if (c + 1 < this.n && v[c + 1] < v[c]) c++; if (v[c] >= lv) break; k[i] = k[c]; v[i] = v[c]; i = c; }
    k[i] = lk; v[i] = lv; return top;
  };

  function build(h, opt) {
    opt = opt || {};
    const { W, H, N, NB, domain, country, province, frontier, civ, eN, slopeN, area, cellKm } = h;
    // ---- 1. 分区（zone）：省 / 无省的国土 / 边疆（按文明） ----
    const zone = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      if (!domain[i]) continue;
      if (country[i] >= 0) zone[i] = province[i] >= 0 ? 1 + province[i] : 100000 + country[i];
      else zone[i] = 200000 + Math.max(0, civ[i]);
    }
    let landCells = 0; for (let i = 0; i < N; i++) if (zone[i]) landCells++;
    const target = Math.max(1, Math.round(Math.min(4000, Math.max(opt.min || 600, landCells / 40))));
    const size = landCells / target;
    // 分区连通块（4 邻接）：飞地、海岛各自成块
    const comp = new Int32Array(N); let nComp = 0; const compCells = [];
    { const st = new Int32Array(N);
      for (let s = 0; s < N; s++) { if (!zone[s] || comp[s]) continue; nComp++; const z = zone[s], cells = []; let t = 0; st[t++] = s; comp[s] = nComp;
        while (t) { const i = st[--t]; cells.push(i); for (const d of N4) { const j = NB[i * 8 + d]; if (j >= 0 && !comp[j] && zone[j] === z) { comp[j] = nComp; st[t++] = j; } } }
        compCells.push(cells); } }
    // ---- 2. 撒种子：城市优先，其余用最远点采样 ----
    const cityAt = new Map(); h.settlements.forEach((s, k) => { if (s.tier === 'site') return; const o = cityAt.get(s.cell); if (o === undefined || h.settlements[o].score < s.score) cityAt.set(s.cell, k); });
    const fr = new Float32Array(N); // 区块生长摩擦：山地、陡坡代价高 → 分界落在山脊
    for (let i = 0; i < N; i++) if (zone[i]) fr[i] = 1 + 5 * eN[i] * eN[i] + 14 * slopeN[i];
    const seeds = [];
    for (let ci = 0; ci < nComp; ci++) {
      const cells = compCells[ci], n = cells.length, isProv = zone[cells[0]] < 200000;
      let k = Math.max(1, Math.round(n / size));
      if (isProv && n >= 8) k = Math.max(k, Math.min(3, Math.floor(n / 4))); // 每个省至少 2–3 个区块
      const minSep = Math.sqrt(n / k) * 0.75;
      const own = [];
      const cities = cells.filter(i => cityAt.has(i)).sort((a, b) => h.settlements[cityAt.get(b)].score - h.settlements[cityAt.get(a)].score);
      for (const c of cities) { if (own.length >= k) break; if (own.every(o => h.gdist(o, c) >= minSep)) own.push(c); }
      if (!own.length) { // 无城市：取分区中最“内陆”的格子作第一个种子（离分区边界最远）
        let best = cells[0], bv = -1; const inner = new Map();
        for (const i of cells) { let b = 0; for (const d of N4) { const j = NB[i * 8 + d]; if (j < 0 || comp[j] !== ci + 1) b = 1; } if (b) inner.set(i, 0); }
        const qq = [...inner.keys()]; for (let hd = 0; hd < qq.length; hd++) { const i = qq[hd], d0 = inner.get(i) + 1; for (const d of N4) { const j = NB[i * 8 + d]; if (j >= 0 && comp[j] === ci + 1 && !inner.has(j)) { inner.set(j, d0); qq.push(j); } } }
        for (const i of cells) { const v = inner.get(i) || 0; if (v > bv) { bv = v; best = i; } }
        own.push(best);
      }
      // 其余种子：按确定性的伪随机顺序扫描，保持最小间距（空间哈希，O(n)）；不够就缩小间距再扫
      if (own.length < k) {
        const BS = Math.max(2, Math.ceil(minSep)), grid = new Map(), key = (x, y) => Math.floor(y / BS) * 100000 + Math.floor(((x % W) + W) % W / BS);
        const add = i => { const y = (i / W) | 0, kk = key(i - y * W, y); let l = grid.get(kk); if (!l) grid.set(kk, l = []); l.push(i); };
        own.forEach(add);
        const ordered = cells.slice().sort((a, b) => ((a * 2654435761) >>> 0) - ((b * 2654435761) >>> 0));
        for (let sep = minSep, pass = 0; pass < 4 && own.length < k; pass++, sep *= 0.8) {
          for (const i of ordered) { if (own.length >= k) break; const y = (i / W) | 0, x = i - y * W; let ok = true;
            for (let by = -1; by <= 1 && ok; by++) for (let bx = -1; bx <= 1 && ok; bx++) { const l = grid.get(key(x + bx * BS, y + by * BS)); if (l) for (const o of l) if (h.gdist(o, i) < sep) { ok = false; break; } }
            if (ok) { own.push(i); add(i); } }
        }
      }
      for (const s of own) seeds.push(s);
    }
    // ---- 3. 生长（同分区连通块内的多源最短路） ----
    const lab = new Int32Array(N), cost = new Float64Array(N).fill(Infinity), hp = new Heap(landCells);
    seeds.forEach((s, k) => { lab[s] = k + 1; cost[s] = 0; hp.push(s, 0); });
    while (hp.n) { const i = hp.pop(), c = hp.top; if (c !== cost[i]) continue; const z = comp[i], l = lab[i];
      for (let d = 0; d < 8; d++) { const j = NB[i * 8 + d]; if (j < 0 || comp[j] !== z) continue; const nc = c + 0.5 * (fr[i] + fr[j]) * DL[d]; if (nc < cost[j]) { cost[j] = nc; lab[j] = l; hp.push(j, nc); } } }
    // 碎片（区块内 4 邻接不连通的小块）并入相邻同分区区块
    { const seen = new Uint8Array(N), st = new Int32Array(N), mainOf = new Map();
      const pieces = [];
      for (let s = 0; s < N; s++) { if (!lab[s] || seen[s]) continue; const l = lab[s], cells = []; let t = 0; st[t++] = s; seen[s] = 1;
        while (t) { const i = st[--t]; cells.push(i); for (const d of N4) { const j = NB[i * 8 + d]; if (j >= 0 && !seen[j] && lab[j] === l) { seen[j] = 1; st[t++] = j; } } }
        pieces.push(cells); const m = mainOf.get(l); if (m === undefined || pieces[m].length < cells.length) mainOf.set(l, pieces.length - 1); }
      pieces.forEach((cells, pi) => { const l = lab[cells[0]]; if (mainOf.get(l) === pi) return;
        const cnt = new Map(); for (const i of cells) for (const d of N4) { const j = NB[i * 8 + d]; if (j >= 0 && lab[j] && lab[j] !== l && comp[j] === comp[i]) cnt.set(lab[j], (cnt.get(lab[j]) || 0) + 1); }
        let best = 0, bv = 0; for (const [k, v] of cnt) if (v > bv) { bv = v; best = k; } if (best) for (const i of cells) lab[i] = best; }); }
    // 重新编号（去掉被吞并的空区块）
    const remap = new Int32Array(seeds.length + 1); let nR = 0;
    for (let i = 0; i < N; i++) { const l = lab[i]; if (l && !remap[l]) remap[l] = ++nR; }
    const regionOf = new Int32Array(N); for (let i = 0; i < N; i++) if (lab[i]) regionOf[i] = remap[lab[i]];

    // ---- 4. 区块属性 ----
    const A = n => new Float32Array(nR + 1);
    const R = { nR, regionOf, cells: new Int32Array(nR + 1), area: A(), weight: A(), pot: A(), hab: A(), eN: A(), slope: A(), T: A(), Pr: A(), arid: A(), semiArid: A(), river: new Uint8Array(nR + 1), riverCells: A(),
      coast: new Uint8Array(nR + 1), cx: A(), cy: A(), civCost: A(), relCost: A(), frontier: A(), newW: A(),
      country: new Int16Array(nR + 1).fill(-1), prov: new Int16Array(nR + 1).fill(-1), civ: new Int16Array(nR + 1).fill(-1), rel: new Int16Array(nR + 1).fill(-1), relRaw: new Int16Array(nR + 1).fill(-1),
      landComp: new Int32Array(nR + 1), center: new Int32Array(nR + 1), cities: Array.from({ length: nR + 1 }, () => []) };
    const sx = new Float64Array(nR + 1), sy = new Float64Array(nR + 1), cxs = new Float64Array(nR + 1), sxs = new Float64Array(nR + 1);
    const vote = (map, r, v) => { if (v < 0) return; const k = r * 65536 + v; map.set(k, (map.get(k) || 0) + 1); };
    const vC = new Map(), vP = new Map(), vV = new Map(), vR = new Map(), vRR = new Map();
    for (let i = 0; i < N; i++) {
      const r = regionOf[i]; if (!r) continue; const y = (i / W) | 0, x = i - y * W, a = area[y];
      R.cells[r]++; R.area[r] += a; R.weight[r] += h.weight[i]; R.pot[r] += h.pot[i]; R.hab[r] += h.hab[i]; R.eN[r] += eN[i]; R.slope[r] += slopeN[i]; R.T[r] += h.T[i]; R.Pr[r] += h.Pr[i];
      const k = h.kop[i]; if (k === 3 || k === 4) R.arid[r]++; else if (k === 5 || k === 6) R.semiArid[r]++;
      if (h.order[i] > R.river[r]) R.river[r] = h.order[i]; if (h.order[i] >= 3) R.riverCells[r]++;
      if (h.oceanCoast[i]) R.coast[r] = 1; if (h.frontier[i]) R.frontier[r]++; if (h.newW[i]) R.newW[r]++;
      const ang = x / W * 2 * Math.PI; cxs[r] += Math.cos(ang); sxs[r] += Math.sin(ang); sy[r] += y;
      if (isFinite(h.civCost[i])) R.civCost[r] += h.civCost[i]; if (isFinite(h.relCost[i])) R.relCost[r] += h.relCost[i];
      vote(vC, r, country[i]); vote(vP, r, province[i]); vote(vV, r, civ[i] - 1); vote(vR, r, h.religion[i]); vote(vRR, r, h.relRaw[i] - 1);
    }
    for (const [map, out] of [[vC, R.country], [vP, R.prov], [vV, R.civ], [vR, R.rel], [vRR, R.relRaw]]) { const best = new Int32Array(nR + 1); for (const [k, v] of map) { const r = (k / 65536) | 0; if (v > best[r]) { best[r] = v; out[r] = k % 65536; } } }
    for (let r = 1; r <= nR; r++) { const n = R.cells[r] || 1;
      for (const key of ['pot', 'hab', 'eN', 'slope', 'T', 'Pr', 'arid', 'semiArid', 'civCost', 'relCost', 'frontier', 'newW']) R[key][r] /= n;
      R.riverCells[r] /= n;
      let ang = Math.atan2(sxs[r], cxs[r]); if (ang < 0) ang += 2 * Math.PI;
      R.cx[r] = (ang / (2 * Math.PI) * W + 0.5) * 2; R.cy[r] = (sy[r] / n + 0.5) * 2; } // 全分辨率坐标
    // 区块中心格（离质心最近的本区块格），用于距离计算
    { const bd = new Float32Array(nR + 1).fill(Infinity); for (let i = 0; i < N; i++) { const r = regionOf[i]; if (!r) continue; const y = (i / W) | 0, x = i - y * W; let dx = Math.abs((x + 0.5) * 2 - R.cx[r]); dx = Math.min(dx, 2 * W - dx); const d = dx * dx + ((y + 0.5) * 2 - R.cy[r]) ** 2; if (d < bd[r]) { bd[r] = d; R.center[r] = i; } } }
    h.settlements.forEach((s, k) => { const r = regionOf[s.cell]; if (r) R.cities[r].push(k); });
    // 陆块编号（区块所在的连通陆地）
    { const lc = new Int32Array(N), st = new Int32Array(N); let n = 0;
      for (let s = 0; s < N; s++) { if (!domain[s] || lc[s]) continue; n++; let t = 0; st[t++] = s; lc[s] = n; while (t) { const i = st[--t]; for (let d = 0; d < 8; d++) { const j = NB[i * 8 + d]; if (j >= 0 && domain[j] && !lc[j]) { lc[j] = n; st[t++] = j; } } } }
      for (let r = 1; r <= nR; r++) R.landComp[r] = lc[R.center[r]]; }

    // ---- 5. 邻接：陆路（共享边界）与海路（沿海区块经近海相连） ----
    const edges = new Map(); // key → { a, b, len, rough, river, sea, km }
    for (let i = 0; i < N; i++) { const a = regionOf[i]; if (!a) continue;
      for (const d of N4) { const j = NB[i * 8 + d]; if (j < 0) continue; const b = regionOf[j]; if (!b || b === a) continue;
        const key = a < b ? a * 65536 + b : b * 65536 + a; let ed = edges.get(key); if (!ed) edges.set(key, ed = { a: Math.min(a, b), b: Math.max(a, b), len: 0, rough: 0, river: 0, sea: 0 });
        ed.len++; ed.rough += Math.max(eN[i], eN[j]) * 4 + Math.max(slopeN[i], slopeN[j]) * 20; if (h.order[i] >= 3 && h.order[j] >= 3) ed.river++; } }
    // 海路：从所有沿海区块向海上扩展（最远约 700 km），两片水域相遇处连一条航线
    { const maxD = 700 / cellKm, sd = new Float32Array(N).fill(Infinity), sl = new Int32Array(N), hq = new Heap(N >> 2);
      for (let i = 0; i < N; i++) if (regionOf[i] && h.oceanCoast[i]) { sd[i] = 0; sl[i] = regionOf[i]; hq.push(i, 0); }
      const seaLink = new Map();
      while (hq.n) { const i = hq.pop(), c = hq.top; if (c !== sd[i]) continue;
        for (let d = 0; d < 8; d++) { const j = NB[i * 8 + d]; if (j < 0) continue;
          if (h.land[j] || h.ice[j]) { const b = regionOf[j]; if (b && b !== sl[i] && h.oceanCoast[j] && sd[j] === 0) { const a = sl[i]; const key = a < b ? a * 65536 + b : b * 65536 + a; const km = c * cellKm; const o = seaLink.get(key); if (o === undefined || km < o) seaLink.set(key, km); } continue; }
          const nc = c + DL[d]; if (nc > maxD) continue;
          if (nc < sd[j]) { sd[j] = nc; sl[j] = sl[i]; hq.push(j, nc); }
          else if (sl[j] !== sl[i] && isFinite(sd[j])) { const a = sl[i], b = sl[j], key = a < b ? a * 65536 + b : b * 65536 + a; const km = (c + DL[d] + sd[j]) * cellKm; const o = seaLink.get(key); if (o === undefined || km < o) seaLink.set(key, km); } } }
      for (const [key, km] of seaLink) { if (edges.has(key)) continue; const a = (key / 65536) | 0, b = key % 65536; edges.set(key, { a, b, len: 0, rough: 0, river: 0, sea: 1, km: Math.max(km, cellKm) }); } }
    const centerKm = (a, b) => { const i = R.center[a], j = R.center[b]; return h.gdist(i, j) * cellKm; };
    const E = [...edges.values()];
    for (const ed of E) { if (!ed.sea) { ed.rough /= Math.max(1, ed.len); ed.river /= Math.max(1, ed.len); ed.km = Math.max(cellKm, centerKm(ed.a, ed.b)); } }
    // CSR 邻接表
    const deg = new Int32Array(nR + 2); for (const ed of E) { deg[ed.a]++; deg[ed.b]++; }
    const off = new Int32Array(nR + 2); for (let r = 1; r <= nR + 1; r++) off[r] = off[r - 1] + deg[r - 1];
    const fill = off.slice(), nbr = new Int32Array(E.length * 2), eid = new Int32Array(E.length * 2);
    E.forEach((ed, k) => { nbr[fill[ed.a]] = ed.b; eid[fill[ed.a]++] = k; nbr[fill[ed.b]] = ed.a; eid[fill[ed.b]++] = k; });
    R.edges = E; R.off = off; R.nbr = nbr; R.eid = eid; R.zoneOfRegion = Int32Array.from({ length: nR + 1 }, (_, r) => r ? zone[R.center[r]] : 0);
    R.Heap = Heap;
    return R;
  }

  G.HistoryRegions = { build, Heap };
})(typeof self !== 'undefined' ? self : this);
