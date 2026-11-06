/* 国内道路：疆界定下来以后，同一国的主要城市之间若只能借道他国的大路相通，就在本国境内补修一条官道。
 * 在三个年代（后期、晚期、现在）各检查一次：按当年的疆域把本国城市按“全程在本国（或无主荒野）的道路”分组，
 * 组与组之间就近连一条只走本国领土的路（全分辨率地形寻路，避开水面，贴着平缓处走）。
 * 修成的路进入历史道路（有修建年份）；现在仍然两端都在的，也画进现在的地图。 */
(function (G) {
  'use strict';
  const MAX_SEARCH = 220, PER_POLITY = 8, TIERS = { metropolis: 1, city: 1 };

  function build(world, Hc, progress) {
    const { P, Hy, Cl, Cv, cfg } = world, h = Cv.hist, C = Hc.C, Pol = Hc.Pol, regionF = Hc.regionF, E = Pol.end ? Hc.D.E : C.E;
    if (!h || !h.roads || !C || !C.roads || !Pol || !Pol.own || !regionF || !G.NavigationOverland) return { added: 0 };
    // 重复推演时先去掉上一次补修的路（它们总在列表末尾）
    if (h.roads.some(r => r.domestic)) h.roads = h.roads.filter(r => !r.domestic);
    if (Cv.domesticLines) { for (const k in Cv.domesticLines) { const set = new Set(Cv.domesticLines[k]); Cv.roads[k] = (Cv.roads[k] || []).filter(l => !set.has(l)); } Cv.domesticLines = null; }
    C.roads = C.roads.filter(r => r.id < h.roads.length && !h.roads[r.id].domestic);
    const W = P.W, H = P.H, R = cfg.radius, Q = G.HistoryQuery, overland = G.NavigationOverland.create({ P, Cl, Hy, cfg });
    const wrapD = d => d > W / 2 ? d - W : d < -W / 2 ? d + W : d;
    const km = (a, b) => { const la = (.5 - a.y / H) * Math.PI, lb = (.5 - b.y / H) * Math.PI, dl = wrapD(b.x - a.x) * 2 * Math.PI / W; const s = Math.sin((lb - la) / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(Math.min(1, s))); };
    const cities = C.cities, cityByIdx = new Map(); cities.forEach((c, i) => { if (c.idx >= 0) cityByIdx.set(c.idx, i); });
    const exists = (c, y) => c && c.founded <= y && !(c.ruined > 0 && y >= c.ruined);
    const regAt = (x, y) => { const yy = Math.floor(y); if (yy < 0 || yy >= H) return 0; return regionF[yy * W + ((Math.floor(x) % W) + W) % W]; };
    // 城市挂到附近的道路端点上（与导航同样的 1/20 格取整）
    const keyOf = (x, y) => Math.round((((x % W) + W) % W) * 20) + ',' + Math.round(y * 20);
    let searches = 0, added = 0; const newLines = { regional: [] };
    const snapshots = [Math.round(E * 0.6), Math.round(E * 0.8), E].filter((y, i, a) => y > 0 && a.indexOf(y) === i);
    for (const T of snapshots) {
      if (searches >= MAX_SEARCH) break;
      const own = new Int32Array(Hc.R.nR + 1).fill(-3), ownerOf = r => { if (!(r > 0)) return -2; let o = own[r]; if (o === -3) { o = Q.logAt(Pol.own, r, T, 'owner'); own[r] = o; } return o; };
      // 当年已有的道路：全图端点并查集，只收“全程在同一国或无主地”的路
      const alive = s => s < 0 || !cityByIdx.has(s) || exists(cities[cityByIdx.get(s)], T), roads = C.roads.filter(r => r.year <= T && alive(r.sa) && alive(r.sb));
      const ownerOfRoad = new Map();
      for (const r of roads) { let o = -1, mixed = false; for (const line of r.lines) for (let i = 0; i < line.length; i += 2) { const q = ownerOf(regAt(line[i], line[i + 1])); if (q < 0) continue; if (o < 0) o = q; else if (q !== o) { mixed = true; break; } } ownerOfRoad.set(r, mixed ? -9 : o); }
      // 各国的主要城市
      const byPolity = new Map();
      cities.forEach((c, i) => { if (c.fort || !exists(c, T) || !TIERS[c.tier]) return; const p = ownerOf(c.r); if (p < 0) return; if (!byPolity.has(p)) byPolity.set(p, []); byPolity.get(p).push(i); });
      for (const P0 of Pol.polities.keys()) { const q = Pol.polities[P0]; if (!q || q.born > T || (q.died != null && q.died < T)) continue; for (const cap of q.caps || []) if (cap[0] <= T && cap[1] >= 0 && exists(cities[cap[1]], T) && ownerOf(cities[cap[1]].r) === P0) { const L = byPolity.get(P0) || []; if (!L.includes(cap[1])) L.push(cap[1]); byPolity.set(P0, L); } }
      for (const [p, list] of byPolity) {
        if (list.length < 2 || searches >= MAX_SEARCH) continue;
        // 本国道路（全程在本国或无主地）的端点并查集
        const par = new Map(), find = k => { let x = k; while (par.has(x) && par.get(x) !== x) x = par.get(x); return x; }, uni = (a, b) => { if (!par.has(a)) par.set(a, a); if (!par.has(b)) par.set(b, b); const ra = find(a), rb = find(b); if (ra !== rb) par.set(ra, rb); };
        const ends = [];
        for (const r of roads) { const o = ownerOfRoad.get(r); if (o !== p && o !== -1) continue; let first = null; for (const line of r.lines) { if (line.length < 4) continue; const a = keyOf(line[0], line[1]), b = keyOf(line.at(-2), line.at(-1)); uni(a, b); if (first) uni(first, a); else first = a; ends.push([line[0], line[1], a], [line.at(-2), line.at(-1), b]); } }
        const comp = i => { const c = cities[i]; let best = null, bd = 1.6; for (const [x, y, k] of ends) { const d = Math.hypot(wrapD(x - c.x), y - c.y); if (d < bd) { bd = d; best = k; } } return best ? find(best) : 'solo:' + i; };
        const groups = new Map(); for (const i of list) { const k = comp(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
        if (groups.size < 2) continue;
        // 组间就近连线：先连最近的两组，直到全国连通或尝试次数用完
        const G0 = [...groups.values()], gp = G0.map((_, i) => i), gf = i => { while (gp[i] !== i) i = gp[i] = gp[gp[i]]; return i; };
        const pairs = []; for (let a = 0; a < G0.length; a++) for (let b = a + 1; b < G0.length; b++) { let best = null; for (const i of G0[a]) for (const j of G0[b]) { const d = km(cities[i], cities[j]); if (!best || d < best[0]) best = [d, i, j]; } pairs.push([best[0], a, b, best[1], best[2]]); }
        pairs.sort((x, y) => x[0] - y[0]);
        let tries = 0;
        for (const [d, a, b, i, j] of pairs) {
          if (gf(a) === gf(b)) continue; if (tries >= PER_POLITY || searches >= MAX_SEARCH) break; if (d > 2600) break;
          tries++; searches++;
          const line = connect(cities[i], cities[j], p, d, T);
          if (!line) continue;
          gp[gf(a)] = gf(b);
          const A = cities[i], B = cities[j], since = r => { let s = 0; const lo = Pol.own.off[r], hi = Pol.own.off[r + 1]; for (let k = lo; k < hi; k++) { if (Pol.own.year[k] > T) break; s = Pol.own.year[k]; } return s; };
          const year = Math.min(T, Math.max(A.founded, B.founded, since(A.r), since(B.r)) + 18 + Math.round(((i * 7 + j * 13) % 23)));
          const raw = { imp: 'regional', a: -1, b: -1, sa: A.idx, sb: B.idx, cells: [], lines: [line], ferries: [], domestic: p }, id = h.roads.length;
          h.roads.push(raw); C.roads.push(G.HistoryCities.roadRecord(raw, id, year)); added++;
          if (exists(A, E) && exists(B, E)) newLines.regional.push(line);
        }
      }
      C.roads.sort((a, b) => a.year - b.year);
      progress && progress('历史 · 国内道路', 0.973);
    }
    // 只走本国领土（无主荒野略贵）；他国领土不可通行
    function connect(A, B, p, d, T) {
      const byRegion = new Map(), cp = i => { const r = regionF[i]; if (!(r > 0)) return 1.6; let v = byRegion.get(r); if (v === undefined) { const o = Q.logAt(Pol.own, r, T, 'owner'); v = o === p ? 1 : o < 0 ? 1.6 : Infinity; byRegion.set(r, v); } return v; }; cp.max = 1.6;
      const segmentCost = ({ km: k, climb, terrainFactor, grade }) => k * terrainFactor * (grade > 0.12 ? 3 : 1) + climb / 250;
      const offs = [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7], [1.4, 1.4], [-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4]];
      const land = c => { for (const [dx, dy] of offs) { const q = { x: c.x + dx, y: c.y + dy }; if (overland.dryLine(q, q)) return q; } return null; };
      const a = land(A), b = land(B); if (!a || !b) return null;
      const r = overland.route({ from: a, to: b, segmentCost, maxKmPerDay: 1, maxDays: d * 2.6 + 150, cellPen: cp });
      if (r) return simplify(r.pts);
      return null;
    }
    // 抽稀：保持每一段都落在干地上
    function simplify(pts) {
      const n = pts.length / 2; if (n <= 2) return Float32Array.from(pts);
      const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
      const st = [[0, n - 1]];
      while (st.length) { const [a, b] = st.pop(); if (b - a < 2) continue; const ax = pts[2 * a], ay = pts[2 * a + 1], bx = pts[2 * b], by = pts[2 * b + 1], L = Math.hypot(bx - ax, by - ay) || 1e-9;
        let md = -1, mi = -1; for (let k = a + 1; k < b; k++) { const dd = Math.abs((bx - ax) * (ay - pts[2 * k + 1]) - (ax - pts[2 * k]) * (by - ay)) / L; if (dd > md) { md = dd; mi = k; } }
        if (md > 0.55 || !overland.dryLine({ x: ax, y: ay }, { x: bx, y: by })) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
      const out = []; for (let k = 0; k < n; k++) if (keep[k]) out.push(pts[2 * k], pts[2 * k + 1]);
      return Float32Array.from(out);
    }
    if (newLines.regional.length) { Cv.roads.regional = (Cv.roads.regional || []).concat(newLines.regional); Cv.domesticLines = newLines; }
    return { added, searches };
  }
  G.HistoryRoads = { build };
})(typeof self !== 'undefined' ? self : globalThis);
