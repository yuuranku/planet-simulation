/* 水文（参考用户生成器 world_atlas.physical.hydrology / core.river_courses 的做法重写）：
 * 1. 真实地形上 Priority-Flood 填洼（不加扰动）；填平后的平地用“到出水口的加权距离”作伪坡度（正交 10 / 对角 14），避免梳状平行流。
 * 2. Kahn 拓扑序累积径流（年 / 四季）。
 * 3. 河道筛选：流量阈值 + 谷地支撑（局部均值凹陷，向上游传播有限距离）+ 并行河道非极大抑制 + 剪短源头支流 + 沿流向闭合断口。
 * 4. 河段在汇流点切开，所有支流与干流共享同一个汇合顶点；河口为“地面=水面”在连续（双线性）地形上的精确交点。
 * 5. 平滑与蜿蜒两端收为零，且顶点不得落入水面。 */
(function (G) {
  'use strict';
  const { simplex2 } = G.Noise;

  function Heap(cap) { this.k = new Int32Array(cap); this.v = new Float64Array(cap); this.n = 0; }
  Heap.prototype.push = function (key, val) {
    if (this.n >= this.k.length) { const k = new Int32Array(this.k.length * 2); k.set(this.k); this.k = k; const v = new Float64Array(this.v.length * 2); v.set(this.v); this.v = v; }
    let i = this.n++; const k = this.k, v = this.v;
    while (i > 0) { const p = (i - 1) >> 1; if (v[p] <= val) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  };
  Heap.prototype.pop = function () {
    const k = this.k, v = this.v, top = k[0], lk = k[--this.n], lv = v[this.n];
    let i = 0;
    for (;;) { let c = 2 * i + 1; if (c >= this.n) break; if (c + 1 < this.n && v[c + 1] < v[c]) c++; if (v[c] >= lv) break; k[i] = k[c]; v[i] = v[c]; i = c; }
    k[i] = lk; v[i] = lv; return top;
  };

  const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1], DL = [1, 1.4142, 1, 1.4142, 1, 1.4142, 1, 1.4142], DC = [10, 14, 10, 14, 10, 14, 10, 14];

  function simulate(P, Cl, cfg, progress) {
    const W = P.W, H = P.H, N = W * H; let e = P.elev;
    const nb = (i, k) => { const y = (i / W) | 0, yy = y + DY[k]; if (yy < 0 || yy >= H) return -1; let xx = i - y * W + DX[k]; if (xx < 0) xx += W; else if (xx >= W) xx -= W; return yy * W + xx; };
    // 海平面以下但与世界海洋不连通的小洼地不是海：抬成近海平面的低平地（之后按填洼规则成湖或湿地），避免内陆出现零碎“海水”与断头河
    { const comp = new Int32Array(N).fill(-1), minSea = Math.max(400, Math.round(N * 0.0015)); let id = 0;
      for (let s0 = 0; s0 < N; s0++) { if (e[s0] > 0 || comp[s0] >= 0) continue; const list = [s0]; comp[s0] = id;
        for (let h = 0; h < list.length; h++) for (let k = 0; k < 8; k++) { const j = nb(list[h], k); if (j >= 0 && e[j] <= 0 && comp[j] < 0) { comp[j] = id; list.push(j); } }
        if (list.length < minSea) { let mn = 0; for (const i of list) mn = Math.min(mn, e[i]); for (const i of list) e[i] = 1 + 0.05 * (e[i] - mn); }
        id++; } }
    // 之后的汇流在副本上计算：湖泊出口的下切只用于确定水流路径，不改写显示用的地形
    const eD = P.elev; // 显示地表（河口、岸线几何都按它求）
    e = Float32Array.from(P.elev);
    const ocean = new Uint8Array(N); for (let i = 0; i < N; i++) ocean[i] = e[i] <= 0 ? 1 : 0;

    // ---------- 1. 填洼（真实地形）+ 按水量平衡定湖面 ----------
    progress('水系汇流', 0.8);
    const filled = new Float32Array(N), heap = new Heap(1 << 20);
    function hasLandNb(i) { for (let k = 0; k < 8; k++) { const j = nb(i, k); if (j >= 0 && !ocean[j]) return true; } return false; }
    const from = new Int32Array(N), popOrder = new Int32Array(N); let nPop = 0;
    function priorityFlood(outlet, track) { // outlet(i) → 出水口水位或 NaN；track：记录淹没父格（即排水树）与出堆顺序
      const done = new Uint8Array(N); heap.n = 0; if (track) { from.fill(-1); nPop = 0; }
      for (let i = 0; i < N; i++) { const y = (i / W) | 0, ov = outlet(i); if (ov === ov || y === 0 || y === H - 1) { const v = ov === ov ? ov : e[i]; filled[i] = v; done[i] = 1; if (!ocean[i] || hasLandNb(i)) heap.push(i, v); } }
      while (heap.n) { const i = heap.pop(), fi = filled[i]; if (track) popOrder[nPop++] = i;
        for (let k = 0; k < 8; k++) { const j = nb(i, k); if (j < 0 || done[j]) continue; done[j] = 1; filled[j] = e[j] > fi ? e[j] : fi; if (track) from[j] = i; heap.push(j, filled[j]); } }
    }
    priorityFlood(i => ocean[i] ? e[i] : NaN, true);
    // ---- 湖泊：水量平衡（参照真实湖泊：湖面约占无冰陆地 1.8%，≥1 万 km² 的湖约 20 个） ----
    // 集水区来水：沿填洼排水树（水流向淹没父格）累积年径流；单位 mm·km²
    const cellKm0 = 2 * Math.PI * cfg.radius / W, cellA = new Float32Array(H); for (let y = 0; y < H; y++) cellA[y] = cellKm0 * cellKm0 * P.F.cosLat[y];
    const runoff0 = (p, t) => { const pet = Math.max(0, Math.min(1500, 55 * t + 380)); return Math.max(0, p - Math.min(p * 0.88, pet * 0.72)); };
    const Q0 = new Float32Array(N);
    for (let i = 0; i < N; i++) if (!ocean[i]) Q0[i] = runoff0(Cl.Pann[i], Cl.Tann[i]) * cellA[(i / W) | 0];
    for (let k = nPop - 1; k >= 0; k--) { const i = popOrder[k], f = from[i]; if (f >= 0 && !ocean[f]) Q0[f] += Q0[i]; }
    const lakeFactor = cfg.lakeFactor || 1;
    const lake = new Uint8Array(N), endo = new Uint8Array(N), lakeLevel = new Float32Array(N), carvedLake = [];
    { const comp = new Int32Array(N).fill(-1); let id = 0;
      for (let s0 = 0; s0 < N; s0++) {
        if (ocean[s0] || comp[s0] >= 0 || filled[s0] - e[s0] <= 0.5) continue;
        const lv = filled[s0], list = [s0]; comp[s0] = id;
        for (let h = 0; h < list.length; h++) for (let k = 0; k < 8; k++) { const j = nb(list[h], k); if (j >= 0 && comp[j] < 0 && !ocean[j] && filled[j] - e[j] > 0.5 && Math.abs(filled[j] - lv) < 0.01) { comp[j] = id; list.push(j); } }
        id++;
        if (list.length < 5) continue;
        let emin = Infinity, pm = 0, tm = 0, AD = 0, Qin = 0, low = list[0];
        for (const i of list) { if (e[i] < emin) { emin = e[i]; low = i; } pm += Cl.Pann[i]; tm += Cl.Tann[i]; AD += cellA[(i / W) | 0]; if (Q0[i] > Qin) Qin = Q0[i]; }
        pm /= list.length; tm /= list.length; const depth = lv - emin; if (depth < 2) continue;
        // 湖面平衡面积 = 来水 /（湖面蒸发 − 湖面降水）
        const E = Math.max(350, Math.min(2200, 700 + 55 * tm)), net = E - pm;
        const AL = (net <= 40 ? Infinity : Qin / net * 0.5) * lakeFactor; // 0.5：浅水滩、盐沼与地下渗漏
        const sorted = list.slice().sort((a, b) => e[a] - e[b]);
        if (G.LAKEDBG && AD > 5e4) G.LAKEDBG.push({ AD: Math.round(AD), AL: Math.round(AL), Qin: Math.round(Qin), net: Math.round(net), depth: Math.round(depth), n: list.length, pm: Math.round(pm), tm: Math.round(tm) });
        let L;
        if (AL < AD * 0.92) { // 内流湖：自低向高蓄到平衡面积。极干旱处（年降水 < 180 mm）只是季节性盐沼，不成常年湖；尾闾湖只占终端洼地的一部分
          const AL2 = pm < 180 ? Math.min(AL, AD * 0.03) : Math.min(AL, AD * 0.2); // 极干旱：最低处只有季节性盐湖（尾闾），但仍是水流终点
          let acc = 0, k = 0; for (; k < sorted.length && acc < AL2; k++) acc += cellA[(sorted[k] / W) | 0];
          if (k < 2) k = Math.min(sorted.length, 2); L = e[sorted[Math.min(sorted.length - 1, k - 1)]] + 0.3; for (const i of list) if (e[i] < L) { lake[i] = 1; endo[i] = 1; lakeLevel[i] = L; }
        } else { // 外流湖：来水有余。宽浅洼地会被大河切穿、泥沙填平（如刚果、亚马孙盆地），只有相对深的洼地（裂谷、冰蚀盆地）留住大湖
          const rho = depth / Math.sqrt(AD); // 起伏比 m/km：贝加尔、苏必利尔 > 1，宽浅盆地 < 0.2
          const frac = Math.min(0.85, Math.max(0, (rho - 0.22) / 1.6)) * Math.pow(lakeFactor, 0.8);
          const target = AD * Math.min(0.95, frac);
          let acc = 0, k = 0; for (; k < sorted.length && acc < target; k++) acc += cellA[(sorted[k] / W) | 0];
          const n = k; L = n >= 4 ? e[sorted[k - 1]] + 0.3 : emin + 0.2;
          carvedLake.push({ low, L, lv, list, keep: n >= 4 });
        }
      } }
    // 出口下切：从洼地最低处沿排水树走向出口，把高出湖面的格削到湖面以下，形成真实的出口河谷
    for (const c of carvedLake) { let x = c.low, k = 0, g = 0;
      while (x >= 0 && !ocean[x] && g++ < 4000) { const tgt = c.L - 0.05 * (k + 1); if (e[x] > c.L - 0.01) { if (e[x] > tgt) { e[x] = tgt; k++; } } else if (k > 0 && e[x] < tgt && filled[x] < c.lv - 0.01) break; x = from[x]; } } // 只在离开本洼地、到达更低处后停止
    priorityFlood(i => ocean[i] ? e[i] : endo[i] ? lakeLevel[i] : NaN, false);
    if (G.LAKEDBG) for (const c of carvedLake) if (c.list.length > 900) G.LAKEDBG.push({ carved: c.list.length, L: Math.round(c.L), lowE: Math.round(e[c.low]), filledLow: Math.round(filled[c.low]), keep: c.keep });
    for (const c of carvedLake) if (c.keep) for (const i of c.list) if (filled[i] - e[i] > 0.3) { lake[i] = 1; lakeLevel[i] = filled[i]; }
    { const seen = new Uint8Array(N);
      for (let s = 0; s < N; s++) { if (!lake[s] || seen[s]) continue; const c = [s]; seen[s] = 1;
        for (let h = 0; h < c.length; h++) for (let k = 0; k < 8; k += 2) { const j = nb(c[h], k); if (j >= 0 && lake[j] && !seen[j]) { seen[j] = 1; c.push(j); } }
        if (c.length < 6 && !c.some(i => endo[i])) for (const i of c) { lake[i] = 0; endo[i] = 0; } } } // 尾闾湖（水流终点）不论大小都保留
    heap.k = null; heap.v = null;
    // 湖面显示场：湖泊范围羽化（3×3 平均两次），配合三次插值得到圆滑湖岸；所有“是否湖面”的判断都用它
    const lakeSoft = new Float32Array(N); { let A = Float32Array.from(lake); for (let it = 0; it < 2; it++) { const B = new Float32Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s2 = 0, n = 0; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { s2 += A[yy * W + ((x + dx) % W + W) % W]; n++; } } B[y * W + x] = s2 / n; } A = B; } for (let i = 0; i < N; i++) lakeSoft[i] = lake[i] ? Math.max(A[i], 0.55) : Math.min(A[i], 0.45); }
    // ---------- 2. 流向：最陡下降；平地按到出水口的加权距离 ----------
    const down = new Int32Array(N).fill(-1);
    const flatDist = new Int32Array(N).fill(-1);
    const fh = new Heap(1 << 18);
    for (let i = 0; i < N; i++) {
      if (ocean[i]) continue;
      let best = 0, bj = -1;
      for (let k = 0; k < 8; k++) { const j = nb(i, k); if (j < 0) continue; const d = (filled[i] - filled[j]) / DL[k]; if (d > best || (d === best && bj >= 0 && false)) { best = d; bj = j; } }
      if (bj >= 0 && best > 0) { down[i] = bj; flatDist[i] = 0; fh.push(i, 0); }
    }
    // 平地（填洼后等高）：从有出口的格向内做加权 BFS，得到无环伪坡度
    while (fh.n) {
      const i = fh.pop(), di = flatDist[i];
      for (let k = 0; k < 8; k++) { const j = nb(i, k); if (j < 0 || ocean[j] || filled[j] !== filled[i]) continue; const nd = di + DC[k]; if (flatDist[j] < 0 || nd < flatDist[j]) { flatDist[j] = nd; fh.push(j, nd); } }
    }
    for (let i = 0; i < N; i++) {
      if (ocean[i] || down[i] >= 0 || flatDist[i] < 0) continue;
      let best = flatDist[i], bj = -1;
      for (let k = 0; k < 8; k += 1) { const j = nb(i, k); if (j < 0 || ocean[j] || filled[j] !== filled[i] || flatDist[j] < 0) continue; const v = flatDist[j] + (k & 1 ? 1 : 0); if (flatDist[j] < flatDist[i] && v < best + 1) { best = v; bj = j; } }
      down[i] = bj;
    }
    // 湖泊已在第 1 步按水量平衡确定

    // ---------- 3. 拓扑序（Kahn）与径流累积 ----------
    progress('河流流量', 0.83);
    const indeg = new Int32Array(N); for (let i = 0; i < N; i++) if (down[i] >= 0) indeg[down[i]]++;
    const order = new Int32Array(N); let oh = 0, ot = 0;
    for (let i = 0; i < N; i++) if (!ocean[i] && indeg[i] === 0) order[ot++] = i;
    while (oh < ot) { const i = order[oh++], d = down[i]; if (d >= 0 && !ocean[d] && --indeg[d] === 0) order[ot++] = d; }
    const nOrd = ot; // 上游 → 下游
    const cellKm = 2 * Math.PI * cfg.radius / W;
    const rowArea = new Float32Array(H); for (let y = 0; y < H; y++) rowArea[y] = cellKm * cellKm * P.F.cosLat[y] * 3.17e-5;
    const runoff = (p, t) => { const pet = Math.max(0, Math.min(1500, 55 * t + 380)); return Math.max(0, p - Math.min(p * 0.88, pet * 0.72)); };
    const q = new Float32Array(N);
    for (let i = 0; i < N; i++) if (!ocean[i]) q[i] = runoff(Cl.Pann[i], Cl.Tann[i]) * rowArea[(i / W) | 0];
    for (let k = 0; k < nOrd; k++) { const i = order[k], d = down[i]; if (d >= 0) q[d] += q[i]; }
    const qs = [];
    for (let s = 0; s < 4; s++) {
      const a = new Float32Array(N);
      for (let i = 0; i < N; i++) if (!ocean[i]) { const t = Cl.Ts[s][i] - 0.0065 * e[i]; a[i] = runoff(Cl.Ps[s][i] * 4, t) * rowArea[(i / W) | 0] * (t < -3 ? 0.15 : 1); }
      for (let k = 0; k < nOrd; k++) { const i = order[k], d = down[i]; if (d >= 0) a[d] += a[i]; }
      qs.push(a);
    }

    // ---------- 流域 ----------
    progress('流域划分', 0.85);
    const basin = new Int32Array(N).fill(-1);
    for (let k = nOrd - 1; k >= 0; k--) { const i = order[k], d = down[i]; basin[i] = d >= 0 && !ocean[d] ? (basin[d] >= 0 ? basin[d] : d) : i; }
    const bArea = new Map();
    for (let i = 0; i < N; i++) if (basin[i] >= 0) bArea.set(basin[i], (bArea.get(basin[i]) || 0) + rowArea[(i / W) | 0]);
    const topB = [...bArea.entries()].sort((a, b) => b[1] - a[1]).slice(0, 90);
    const bIdx = new Map(); topB.forEach(([b], k) => bIdx.set(b, k + 1));
    const basinId = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (basin[i] >= 0) basinId[i] = bIdx.get(basin[i]) || 0;

    // ---------- 4. 河道筛选 ----------
    progress('河道描绘', 0.86);
    let landN = 0; const qa = [];
    for (let i = 0; i < N; i++) if (!ocean[i] && !lake[i]) { landN++; if (q[i] > 30) qa.push(q[i]); }
    qa.sort((a, b) => b - a);
    const qth = Math.max(60, qa[Math.min(qa.length - 1, Math.floor(landN * 0.03))] || 60);
    const mainQ = qth * 8;
    // 谷地支撑：局部均值 − 高程（相对局部起伏归一）
    const r = Math.max(2, Math.round(Math.min(W, H) * 0.006));
    const ls = new Float32Array(N), lc = new Float32Array(N);
    { const tmpS = new Float32Array(N), tmpC = new Float32Array(N);
      for (let y = 0; y < H; y++) { let s = 0, c = 0; const o = y * W; for (let k = -r; k <= r; k++) { const j = o + ((k % W) + W) % W; if (!ocean[j]) { s += e[j]; c++; } }
        for (let x = 0; x < W; x++) { tmpS[o + x] = s; tmpC[o + x] = c; const a = o + (x + r + 1) % W, b = o + ((x - r) % W + W) % W; if (!ocean[a]) { s += e[a]; c++; } if (!ocean[b]) { s -= e[b]; c--; } } }
      for (let x = 0; x < W; x++) { let s = 0, c = 0; for (let k = -r; k <= r; k++) { const yy = Math.min(H - 1, Math.max(0, k)); s += tmpS[yy * W + x]; c += tmpC[yy * W + x]; }
        for (let y = 0; y < H; y++) { ls[y * W + x] = s; lc[y * W + x] = c; const a = Math.min(H - 1, y + r + 1) * W + x, b = Math.max(0, y - r) * W + x; s += tmpS[a] - tmpS[b]; c += tmpC[a] - tmpC[b]; } } }
    const depth = new Float32Array(N); const pos = [];
    for (let i = 0; i < N; i++) { if (ocean[i] || lc[i] <= 0) continue; const d = ls[i] / lc[i] - e[i]; if (d > 0) { depth[i] = d; pos.push(d); } }
    pos.sort((a, b) => a - b);
    const dScale = pos.length ? Math.max(1, pos[Math.floor(pos.length * 0.9)]) : 1;
    const supported = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (depth[i] / dScale >= 0.08) supported[i] = 1;
    { const dist = new Int32Array(N).fill(-1), maxD = Math.max(3, r);
      for (let i = 0; i < N; i++) if (supported[i]) dist[i] = 0;
      for (let k = nOrd - 1; k >= 0; k--) { const i = order[k], d = down[i]; if (d < 0 || dist[i] === 0) continue; const td = dist[d]; if (td >= 0 && td < maxD) { dist[i] = td + 1; supported[i] = 1; } } }
    const stream = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (!ocean[i] && !lake[i] && down[i] >= 0 && q[i] >= qth && (supported[i] || q[i] >= mainQ)) stream[i] = 1;
    // 并行河道非极大抑制：源头分支若大部分与更大的另一河道相距 ≤ 2 格并行，则删除
    const incomingS = () => { const inc = new Uint8Array(N); for (let i = 0; i < N; i++) if (stream[i] && down[i] >= 0 && stream[down[i]]) inc[down[i]]++; return inc; };
    for (let pass = 0; pass < 2; pass++) {
      const inc = incomingS(), branchOf = new Int32Array(N).fill(-1), branches = [];
      for (let s = 0; s < N; s++) { if (!stream[s] || inc[s]) continue; const path = []; let c = s; while (c >= 0 && stream[c] && (c === s || inc[c] === 1) && path.length < 4000) { path.push(c); branchOf[c] = branches.length; c = down[c]; } branches.push(path); }
      let removed = 0;
      branches.forEach((path, bi) => {
        if (path.length < 3) return; let par = 0;
        for (const c of path) { let hit = false; const y = (c / W) | 0, x = c - y * W;
          for (let dy = -2; dy <= 2 && !hit; dy++) for (let dx = -2; dx <= 2 && !hit; dx++) { if (!dx && !dy) continue; const yy = y + dy; if (yy < 0 || yy >= H) continue; const j = yy * W + ((x + dx) % W + W) % W; if (stream[j] && branchOf[j] !== bi && q[j] > q[c] * 1.5 && !(down[c] === j)) hit = true; }
          if (hit) par++; }
        if (par > path.length * 0.6 && q[path[path.length - 1]] < mainQ) { for (const c of path) stream[c] = 0; removed++; }
      });
      if (!removed) break;
    }
    // 剪掉过短的源头支流（迭代）
    const minLen = Math.max(3, Math.round(Math.min(W, H) * 0.0036));
    for (let it = 0; it < 6; it++) {
      const inc = incomingS(); let removed = 0;
      for (let s = 0; s < N; s++) { if (!stream[s] || inc[s]) continue; const path = []; let c = s; while (c >= 0 && stream[c] && (c === s || inc[c] === 1) && path.length <= minLen) { path.push(c); c = down[c]; } if (path.length < minLen && c >= 0 && stream[c]) { for (const p of path) stream[p] = 0; removed++; } }
      if (!removed) break;
    }
    // 沿流向闭合：任一河道格一路连到海、湖或终点
    for (let k = 0; k < nOrd; k++) { const i = order[k]; if (!stream[i]) continue; const d = down[i]; if (d >= 0 && !ocean[d] && !lake[d]) stream[d] = 1; }

    // ---------- 5. 河段折线（在汇流点切开）与精确河口 ----------
    const bil = (A, x, y) => { let sx = x - 0.5, sy = Math.min(H - 1.001, Math.max(0, y - 0.5)); sx = ((sx % W) + W) % W; const x0 = sx | 0, tx = sx - x0, x1 = x0 + 1 === W ? 0 : x0 + 1, y0 = sy | 0, ty = sy - y0, y1 = Math.min(H - 1, y0 + 1); return (A[y0 * W + x0] * (1 - tx) + A[y0 * W + x1] * tx) * (1 - ty) + (A[y1 * W + x0] * (1 - tx) + A[y1 * W + x1] * tx) * ty; };
    const center = c => { const y = (c / W) | 0; return [c - y * W + 0.5, y + 0.5]; };
    // 在 first→last 线段上求 f=0 的交点（二分）
    function root(first, last, f) { let a = 0, b = 1, fa = f(first[0], first[1]); if (fa <= 0) return first;
      { let k = 1; while (k < 3 && f(first[0] + (last[0] - first[0]) * k, first[1] + (last[1] - first[1]) * k) > 0) k += 0.25; last = [first[0] + (last[0] - first[0]) * k, first[1] + (last[1] - first[1]) * k]; } /* 亚格网岸线可能比格心更靠外：沿流向延伸到真正入水 */
      for (let it = 0; it < 30; it++) { const m = (a + b) / 2, v = f(first[0] + (last[0] - first[0]) * m, first[1] + (last[1] - first[1]) * m); if (v > 0) a = m; else b = m; } const t = (a + b) / 2; return [first[0] + (last[0] - first[0]) * t, first[1] + (last[1] - first[1]) * t]; }
    const BS = G.Noise.bspline, seaF = (x, y) => G.Noise.coastSurface(eD, W, H, x, y);
    const lakeF = (x, y) => 0.5 - G.Noise.surface(lakeSoft, W, H, x, y);
    const inc = incomingS();
    const lakeIn = new Uint8Array(N); for (let i = 0; i < N; i++) if (lake[i] && down[i] >= 0 && stream[down[i]]) lakeIn[down[i]] = 1;
    // 潮汐（第 8 题）：一颗大卫星潮差大，河口多成喇叭口三角湾、潮滩盐沼；无卫星或仅星环时潮差小，河口三角洲更发育
    const tide = { one: 1, many: 0.65, none: 0.2, ring: 0.2 }[cfg.moons] ?? 1;
    const reaches = [], meta = [], mouths = [], deltaCand = [];
    const vtx = (pts, p, c) => pts.push(p[0], p[1], q[c], qs[0][c], qs[1][c], qs[2][c], qs[3][c]);
    for (let s = 0; s < N; s++) {
      if (!stream[s] || inc[s] === 1) continue;
      let pts = [], c = s, startCell = s, endKind = 'sink', endCell = -1;
      // 湖泊出口：从湖岸起笔
      if (lakeIn[s]) { for (let k = 0; k < 8; k++) { const j = nb(s, k); if (j >= 0 && lake[j] && down[j] === s) { const a = center(j), b = center(s); b[0] = a[0] + (((b[0] - a[0]) + W / 2) % W + W) % W - W / 2; vtx(pts, root(b, a, lakeF), s); break; } } }
      for (let guard = 0; guard < 20000; guard++) {
        const p = center(c);
        if (pts.length && Math.abs(p[0] - pts[pts.length - 7]) > W / 2) { if (pts.length >= 14) { reaches.push(pts); meta.push({ start: startCell, kind: 'wrap' }); } pts = []; startCell = -1; }
        vtx(pts, p, c);
        const d = down[c];
        if (d < 0) break;
        if (ocean[d] || lake[d]) { // 河口：地面 = 水面 的精确交点
          const pd = center(d); pd[0] = p[0] + (((pd[0] - p[0]) + W / 2) % W + W) % W - W / 2;
          vtx(pts, root(p, pd, ocean[d] ? seaF : lakeF), c); endKind = ocean[d] ? 'ocean' : 'lake'; endCell = d;
          const mp = pts.slice(-7);
          if (ocean[d] && q[c] > qth * 30) mouths.push(p[0], p[1], q[c]);
          if (ocean[d] && q[c] > qth * 30 * (0.45 + 0.75 * tide)) deltaCand.push({ x: mp[0], y: mp[1], dx: pd[0] - p[0], dy: pd[1] - p[1], q: q[c], cell: c });
          break;
        }
        if (!stream[d]) break;
        { // 两格中心之间若掠过水面（窄地峡、海湾），河流在第一处触水点入海，不横穿水面
          const pd = center(d); pd[0] = p[0] + (((pd[0] - p[0]) + W / 2) % W + W) % W - W / 2;
          let hit = -1; for (let t = 1; t <= 6; t++) { const x = p[0] + (pd[0] - p[0]) * t / 6, y = p[1] + (pd[1] - p[1]) * t / 6; if (G.Noise.coastSurface(eD, W, H, x, y) <= 0 || G.Noise.surface(lakeSoft, W, H, x, y) >= 0.5) { hit = t; break; } }
          if (hit > 0) { const q0 = [p[0] + (pd[0] - p[0]) * (hit - 1) / 6, p[1] + (pd[1] - p[1]) * (hit - 1) / 6], q1 = [p[0] + (pd[0] - p[0]) * hit / 6, p[1] + (pd[1] - p[1]) * hit / 6];
            const sea = G.Noise.coastSurface(eD, W, H, q1[0], q1[1]) <= 0; vtx(pts, root(q0, q1, sea ? seaF : lakeF), c); endKind = sea ? 'ocean' : 'lake'; endCell = d; break; }
        }
        if (inc[d] !== 1) { const pd = center(d); if (Math.abs(pd[0] - p[0]) <= W / 2) vtx(pts, pd, d); endKind = 'conf'; endCell = d; break; } // 汇流点：共享顶点
        c = d;
      }
      if (pts.length >= 14) { reaches.push(pts); meta.push({ start: startCell, kind: endKind, cell: endCell }); }
    }
    // ---------- 5b. 制图分级（原版 river_display：最长上游为主干，按长度分 世界/区域/地方/细部 四级） ----------
    const tiers = new Uint8Array(reaches.length).fill(3);
    { const R = cfg.radius, nR = reaches.length, startIdx = new Map();
      meta.forEach((m, i) => { if (m.start >= 0 && !startIdx.has(m.start)) startIdx.set(m.start, i); });
      const downR = new Int32Array(nR).fill(-1), lenKm = new Float64Array(nR), ink = new Float64Array(nR), yld = new Float64Array(nR);
      for (let i = 0; i < nR; i++) {
        const m = meta[i], L = reaches[i], n = L.length / 7;
        for (let k = 1; k < n; k++) { const dx = L[k * 7] - L[k * 7 - 7], dy = L[k * 7 + 1] - L[k * 7 - 6], la = (90 - (L[k * 7 + 1] / H) * 180) * Math.PI / 180;
          ink[i] += Math.hypot(dx, dy); lenKm[i] += Math.hypot(dx * Math.cos(la), dy) * 2 * Math.PI * R / W; }
        for (let k = 0; k < n; k++) yld[i] = Math.max(yld[i], L[k * 7 + 2]);
        if (m.kind === 'wrap') downR[i] = i + 1 < nR && meta[i + 1].start === -1 ? i + 1 : -1;
        else if (m.kind === 'conf') downR[i] = startIdx.has(m.cell) ? startIdx.get(m.cell) : -1;
        else if (m.kind === 'lake') { let t = m.cell, g = 0; while (t >= 0 && lake[t] && g++ < N) t = down[t]; downR[i] = t >= 0 && startIdx.has(t) ? startIdx.get(t) : -1; }
        if (downR[i] === i) downR[i] = -1;
      }
      const incoming = Array.from({ length: nR }, () => []);
      for (let i = 0; i < nR; i++) if (downR[i] >= 0) incoming[downR[i]].push(i);
      const pend = incoming.map(a => a.length), queue = [], longest = Float64Array.from(lenKm), dom = new Int32Array(nR).fill(-1);
      for (let i = 0; i < nR; i++) if (!pend[i]) queue.push(i);
      for (let h = 0; h < queue.length; h++) { const i = queue[h];
        if (incoming[i].length) { let best = -1; for (const ch of incoming[i]) if (best < 0 || longest[ch] > longest[best] || (longest[ch] === longest[best] && yld[ch] > yld[best])) best = ch; dom[i] = best; longest[i] += longest[best]; }
        const t = downR[i]; if (t >= 0 && --pend[t] === 0) queue.push(t); }
      const circ = 2 * Math.PI * R, LIM = [[0.02, 1], [0.005, 2], [0.00125, Infinity]];
      const stack = []; for (let i = 0; i < nR; i++) if (downR[i] < 0) stack.push([i, 1, 0]);
      const done = new Uint8Array(nR);
      while (stack.length) { let [i, depth, pt] = stack.pop(); const stem = []; while (i >= 0 && !done[i]) { stem.push(i); done[i] = 1; i = dom[i]; }
        let phys = 0, pr = 0; for (const k of stem) { phys += lenKm[k]; pr += ink[k]; }
        let tier = 3; for (let t = 0; t < 3; t++) if (depth <= LIM[t][1] && phys >= LIM[t][0] * circ && pr >= LIM[t][0] * W) { tier = t; break; }
        tier = Math.max(tier, pt);
        for (const k of stem) { tiers[k] = tier; for (const ch of incoming[k]) if (ch !== dom[k]) stack.push([ch, depth + 1, tier]); } } }
    // ---------- 6. 平滑 + 蜿蜒（端点固定、两端收为零、不入水） ----------
    const nm = simplex2(cfg.seed + 777);
    const wet = (x, y) => G.Noise.coastSurface(eD, W, H, x, y) <= 0 || G.Noise.surface(lakeSoft, W, H, x, y) >= 0.5;
    const out = [], offs = [0];
    for (const L of reaches) {
      let pts = L;
      for (let it = 0; it < 2; it++) {
        const n = pts.length / 7, np = [];
        for (let c = 0; c < 7; c++) np.push(pts[c]);
        for (let k = 0; k < n - 1; k++) for (const t of [0.25, 0.75]) for (let c = 0; c < 7; c++) np.push(pts[k * 7 + c] * (1 - t) + pts[(k + 1) * 7 + c] * t);
        for (let c = 0; c < 7; c++) np.push(pts[(n - 1) * 7 + c]);
        // 角点切削若落入水面，退回原折线
        for (let k = 1; k < np.length / 7 - 1; k++) { const x = np[k * 7], y = np[k * 7 + 1]; if (wet(x, y)) { const n0 = pts.length / 7; let bk = 0, bd = Infinity; for (let j = 0; j < n0; j++) { const d = Math.hypot(pts[j * 7] - x, pts[j * 7 + 1] - y); if (d < bd) { bd = d; bk = j; } } np[k * 7] = pts[bk * 7]; np[k * 7 + 1] = pts[bk * 7 + 1]; } }
        pts = np;
      }
      const n = pts.length / 7;
      for (let k = 1; k < n - 1; k++) {
        const x = pts[k * 7], y = pts[k * 7 + 1];
        const tx = pts[(k + 1) * 7] - pts[(k - 1) * 7], ty = pts[(k + 1) * 7 + 1] - pts[(k - 1) * 7 + 1];
        const l = Math.hypot(tx, ty) || 1, taper = Math.min(1, k / 8, (n - 1 - k) / 8);
        const m = (nm(x * 0.35, y * 0.35) * 0.28 + nm(x * 1.1, y * 1.1) * 0.1) * taper;
        const nx = x - ty / l * m, ny = y + tx / l * m;
        if (k < n - 3 && wet(nx, ny)) continue; // 蜿蜒不得把河道推进水里
        pts[k * 7] = nx; pts[k * 7 + 1] = ny;
      }
      for (const v of pts) out.push(v); offs.push(out.length / 7);
    }
    // ---------- 7. 河口三角洲（原版地貌符号：三角洲平原 + 水下三角洲沉积前缘，面状表达，不画分汊） ----------
    const deltas = [], plume = new Float32Array(N), wetland = new Uint8Array(N), deltaPlain = new Uint8Array(N);
    deltaCand.sort((a, b) => b.q - a.q);
    for (const D of deltaCand) {
      if (e[D.cell] > 80) continue; // 只在低平海岸成三角洲
      if (deltas.some(o => Math.hypot(o.x - D.x, o.y - D.y) < 7)) continue;
      const l = Math.hypot(D.dx, D.dy) || 1, ux = D.dx / l, uy = D.dy / l;
      const size = Math.min(5, 1.6 + 0.9 * Math.log10(D.q / qth));
      deltas.push({ x: D.x, y: D.y, ux, uy, size, q: D.q });
      const R = Math.ceil(size * 2.6), cy = Math.round(D.y - 0.5), cx = Math.round(D.x - 0.5);
      for (let oy = -R; oy <= R; oy++) for (let ox = -R; ox <= R; ox++) {
        const yy = cy + oy; if (yy < 0 || yy >= H) continue; const j = yy * W + ((cx + ox) % W + W) % W;
        const along = ox * ux + oy * uy, across = Math.abs(-ox * uy + oy * ux), dist = Math.hypot(ox, oy);
        if (ocean[j]) { if (along > -0.3 && e[j] > -300 && across < size * 0.5 + along * 0.9) { const v = Math.max(0, 1 - dist / (size * 2.3)); if (v > plume[j]) plume[j] = v; } }
        else if (!lake[j] && (e[j] < 60 || (e[j] < 160 && dist < size)) && along <= 0.6 && along > -size * 1.6 && across < size * 0.3 + (along + size * 1.6) * 0.55) deltaPlain[j] = 1;
      }
    }
    // ---------- 8. 湿地：低平、排水不畅、近河湖或多雨 ----------
    { const nearW = new Uint8Array(N); // 2 格内有河道或湖
      for (let i = 0; i < N; i++) if (stream[i] || lake[i]) { const y = (i / W) | 0, x = i - y * W; for (let dy = -2; dy <= 2; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -2; dx <= 2; dx++) nearW[yy * W + ((x + dx) % W + W) % W] = 1; } }
      for (let i = 0; i < N; i++) {
        if (ocean[i] || lake[i] || wetland[i] || deltaPlain[i]) continue;
        const kp = Cl.koppen ? Cl.koppen[i] : 255; if (kp >= 3 && kp <= 6) continue; // 干旱气候不成湿地
        const h = e[i]; if (h > 220) continue;
        const y = (i / W) | 0, x = i - y * W; let rel = 0;
        for (let k = 0; k < 8; k += 2) { const j = nb(i, k); if (j >= 0) rel = Math.max(rel, Math.abs(e[j] - h)); }
        const flat = rel < 28 || flatDist[i] > 0;
        const p = Cl.Pann[i], t = Cl.Tann[i];
        if (flat && ((nearW[i] && p > 620) || p > 1400) && t > -6 && (filled[i] - h > 0.5 || h < 60 || (nearW[i] && rel < 14))) wetland[i] = 1;
        void x;
      }
      // 潮滩盐沼：潮差越大，低平海岸越多
      if (tide > 0.3) { const tr = G.Noise.simplex2(cfg.seed + 777 * 3); for (let i = 0; i < N; i++) { if (ocean[i] || lake[i] || wetland[i] || e[i] > 12) continue; let coast = false; for (let k = 0; k < 8; k += 2) { const j = nb(i, k); if (j >= 0 && ocean[j]) { coast = true; break; } } if (!coast) continue; const y = (i / W) | 0, x = i - y * W; if (tr(x * 0.08, y * 0.08) * 0.5 + 0.5 < 0.25 + 0.45 * tide) wetland[i] = 1; } }
      const seen = new Uint8Array(N);
      for (let s0 = 0; s0 < N; s0++) { if (!wetland[s0] || seen[s0]) continue; const comp = [s0]; seen[s0] = 1;
        for (let h = 0; h < comp.length; h++) for (let k = 0; k < 8; k += 2) { const j = nb(comp[h], k); if (j >= 0 && wetland[j] && !seen[j]) { seen[j] = 1; comp.push(j); } }
        if (comp.length < 8) for (const i of comp) wetland[i] = 0; } }
    // 面状地貌的平滑场（两次 3×3 盒滤波，边界圆顺、不成方块）
    const soft = (M) => { let A = Float32Array.from(M, v => v ? 1 : 0); for (let it = 0; it < 2; it++) { const B = new Float32Array(N);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let sum = 0, n = 0; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { sum += A[yy * W + ((x + dx) % W + W) % W]; n++; } } B[y * W + x] = sum / n; } A = B; } return A; };
    const wetSoft = soft(wetland), deltaSoft = soft(deltaPlain);
    // ---------- 9. 小型湖泊（亚网格，矢量绘制）：冰蚀湖区、河漫滩牛轭湖、湿润小洼地、湿地水塘 ----------
    // 每项 [x, y, 半径(格), 种子, 层级]：层级 1 = 区域级起显示，2 = 地方级起显示
    const small = [];
    { const rr = G.Noise.mulberry32(cfg.seed + 4040), nL = G.Noise.simplex2(cfg.seed + 4041), lf = cfg.lakeFactor || 1;
      const okAt = (x, y, r) => { for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283, px = x + Math.cos(a) * r * 1.2, py = y + Math.sin(a) * r * 1.2; const yy = Math.min(H - 1, Math.max(0, py | 0)), xx = ((px | 0) % W + W) % W, j = yy * W + xx; if (e[j] <= 3 || lake[j] || stream[j] && q[j] > qth * 3) return false; } return true; };
      const occ = new Set(), cellKey = (x, y) => ((y / 1.5) | 0) * 100000 + ((x / 1.5) | 0);
      const placed = new Map(), gk = (gx, gy) => gy * 100000 + gx; // 已放小湖的空间网格：小湖之间必须留出间距，不互相重叠（否则像“湖中湖”）
      const clear = (x, y, r) => { const gx = Math.floor(x / 2), gy = Math.floor(y / 2); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const L = placed.get(gk(((gx + dx) % (W >> 1) + (W >> 1)) % (W >> 1), gy + dy)); if (L) for (const o of L) { let ddx = Math.abs(o[0] - x); ddx = Math.min(ddx, W - ddx); if (Math.hypot(ddx, o[1] - y) < (o[2] + r) * 1.6 + 0.25) return false; } } return true; };
      const add = (x, y, r, tier) => { const key = cellKey(x, y); if (occ.has(key) || !okAt(x, y, r) || !clear(x, y, r)) return; occ.add(key); const g = gk(Math.floor(x / 2) % (W >> 1), Math.floor(y / 2)); (placed.get(g) || placed.set(g, []).get(g)).push([x, y, r]); small.push(x, y, r, (rr() * 1e6) | 0, tier); };
      for (let i = 0; i < N; i += 1) {
        if (ocean[i] || lake[i]) continue; const y = (i / W) | 0, x = i - y * W, t = Cl.Tann[i], p = Cl.Pann[i], h = e[i];
        { let nearLake = false; for (let dy = -2; dy <= 2 && !nearLake; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -2; dx <= 2; dx++) { const j = yy * W + ((x + dx) % W + W) % W; if (lake[j] || ocean[j]) { nearLake = true; break; } } } if (nearLake) continue; } // 不放在大湖的湖心岛上
        if (Cl.snow[i] === 2) continue;
        let rel = 0; for (let k = 0; k < 8; k += 2) { const j = nb(i, k); if (j >= 0) rel = Math.max(rel, Math.abs(e[j] - h)); }
        let dens = 0, rMax = 0.35;
        // 冰蚀湖区：凉而湿、低平（芬兰、加拿大地盾）——斑块状分布
        if (t > -9 && t < 7 && p > 350 && h < 700 && rel < 90) { const patch = nL(x * 0.06, y * 0.06) * 0.5 + 0.5; dens = Math.max(dens, 0.85 * patch * patch * Math.min(1, (p - 350) / 300)); rMax = 0.62; }
        // 河漫滩牛轭湖：大河两侧低平处
        if (q[i] > qth * 25 && rel < 40 && h < 500 && p > 400) dens = Math.max(dens, 0.12);
        // 湿润区小洼地（未成湖的浅洼）
        if (filled[i] - h > 0.8 && p > 600) dens = Math.max(dens, 0.35);
        // 湿地水塘
        if (wetland[i]) dens = Math.max(dens, 0.1);
        // 其他湿润低平地：零星
        if (!dens && p > 900 && rel < 60 && h < 800) dens = 0.012;
        dens *= lf * 1.6;
        if (dens <= 0 || rr() > dens) continue;
        const r = 0.07 + rr() * rr() * (rMax - 0.07); add(x + 0.2 + rr() * 0.6, y + 0.2 + rr() * 0.6, r, r > 0.22 ? 1 : 2);
      } }
    const termLake = new Uint8Array(N); meta.forEach((m, k) => { if (m.kind === 'lake' && m.cell >= 0 && tiers[k] <= 2) termLake[m.cell] = 1; });
    const lakeSize = new Uint16Array(N); { const seen = new Uint8Array(N); for (let s0 = 0; s0 < N; s0++) { if (!lake[s0] || seen[s0]) continue; const c = [s0]; seen[s0] = 1; for (let h = 0; h < c.length; h++) for (let k = 0; k < 8; k += 2) { const j = nb(c[h], k); if (j >= 0 && lake[j] && !seen[j]) { seen[j] = 1; c.push(j); } } const keep = c.some(i => termLake[i]); for (const i of c) lakeSize[i] = keep ? 65535 : Math.min(65535, c.length); } } // 有河流注入的湖、尾闾湖在任何缩放都显示，河流不会“断在陆地上”
    return {
      smallLakes: Float32Array.from(small), lakeSize, lakeSoft,
      deltas, plume, wetland, wetSoft, deltaSoft, filled,
      down, lake, q, basinId, basinCount: topB.length, qth,
      rivers: { pts: Float32Array.from(out), offs: Int32Array.from(offs), tiers },
      mouths, order: null
    };
  }

  G.Hydro = { simulate, Heap };
})(typeof self !== 'undefined' ? self : this);
