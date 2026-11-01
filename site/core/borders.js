/* 疆界细化：社会层在半分辨率网格上决定“谁统治哪里”，这里在全分辨率地形上决定“界线具体走在哪里”。
 * 只在原边界两侧约 2 个半格的条带内重新划线（拓扑与归属不变）：
 *  - 国界：沿山脊（爬坡代价高，两侧在分水岭相遇）与大河（渡河代价高，界线落在河道上），即古代国家的“山川形便”；
 *  - 省界：在国界内再划，自然阻隔权重较低、随机起伏更强，形成与山川并不完全吻合的犬牙交错；
 *  - 低频噪声给平原上的界线以自然的曲折，避免栅格直线与八边形。 */
(function (G) {
  'use strict';
  const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1], DL = [1, 1.4142, 1, 1.4142, 1, 1.4142, 1, 1.4142];

  function refine(P, Hy, half, opt) {
    const FW = P.W, FH = P.H, FN = FW * FH, W = FW / 2, H = FH / 2, e = P.elev, q = Hy.q, qth = Hy.qth, lake = Hy.lake;
    const n2 = G.Noise.simplex2(opt.seed);
    const out = new Int32Array(FN).fill(-3);
    const isW = i => e[i] <= 0 || lake[i] || (opt.ice && opt.ice[i]);
    // 条带：半格 R 邻域内出现不同的陆地标签
    const R = opt.band || 2, band = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, a = half[i]; let diff = false;
      for (let dy = -R; dy <= R && !diff; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -R; dx <= R; dx++) { const b = half[yy * W + ((x + dx) % W + W) % W]; if (b !== a && b !== -2) { diff = true; break; } } }
      if (diff || a === -2) band[i] = 1;
    }
    for (let f = 0; f < FN; f++) {
      if (isW(f)) { out[f] = opt.ice && opt.ice[f] && e[f] > 0 && !lake[f] ? -4 : -2; continue; }
      const y = (f / FW) | 0, x = f - y * FW, h = (y >> 1) * W + (x >> 1);
      if (!band[h] && half[h] !== -2) out[f] = half[h];
    }
    for (const [x, y, lab] of opt.fixed || []) { if (lab < 0) continue; const f = Math.min(FH - 1, Math.max(0, Math.floor(y))) * FW + ((Math.floor(x) % FW) + FW) % FW; if (!isW(f)) out[f] = lab; }
    const allow = opt.allow || null; // (label, fullCell) => bool
    const dist = new Float32Array(FN).fill(Infinity), hp = new G.Hydro.Heap(1 << 16);
    const nb = (i, k) => { const y = (i / FW) | 0, yy = y + DY[k]; if (yy < 0 || yy >= FH) return -1; let xx = i - y * FW + DX[k]; if (xx < 0) xx += FW; else if (xx >= FW) xx -= FW; return yy * FW + xx; };
    for (let f = 0; f < FN; f++) { if (out[f] < -1) continue; for (let k = 0; k < 8; k += 2) { const j = nb(f, k); if (j >= 0 && out[j] === -3) { dist[f] = 0; hp.push(f, 0); break; } } }
    const step = (i, j) => {
      const y = (j / FW) | 0, x = j - y * FW;
      let c = 1 + Math.abs(e[j] - e[i]) / opt.climb;
      const r = q[j] / qth; if (r >= 3) c += Math.min(opt.riverMax, opt.river * (1 + Math.log2(r / 3)));
      const n = n2(x * opt.freq, y * opt.freq) * 0.5 + n2(x * opt.freq * 2.7 + 31, y * opt.freq * 2.7) * 0.3 + n2(x * opt.freq * 7.3 - 17, y * opt.freq * 7.3) * 0.2; // 三个尺度：大的凸出 + 中等曲折 + 细碎犬牙
      return c * (opt.noise0 + opt.noise1 * (n * 0.5 + 0.5));
    };
    while (hp.n) {
      const i = hp.pop(), d = dist[i]; const lab = out[i];
      for (let k = 0; k < 8; k++) { const j = nb(i, k); if (j < 0 || out[j] !== -3 && !(dist[j] > 0 && dist[j] < Infinity)) continue; if (out[j] === -2) continue;
        if (allow && !allow(lab, j)) continue;
        const nd = d + DL[k] * step(i, j);
        if (nd < dist[j]) { dist[j] = nd; out[j] = lab; hp.push(j, nd); } }
    }
    for (let f = 0; f < FN; f++) if (out[f] === -3) { const y = (f / FW) | 0, x = f - y * FW, h = (y >> 1) * W + (x >> 1); out[f] = half[h] === -2 ? -1 : half[h]; }
    return out;
  }

  /* 历史区块的全分辨率疆界（refine 的细化版）：
   *  1. 先验：在半分辨率区块图上做一次小幅“域扭曲”（经度环绕的三维噪声，约 ±2.7 像素、两个尺度），
   *     打散网格生长留下的长直线与台阶；小区块（< minCells 个半格）与城市周围不扭曲，免得被邻区吞掉或把城市挤出去；
   *  2. 条带：只在先验界线两侧 bandF 个像素内重新划线（全分辨率距离），仍按“山川形便”（山脊、大河、低频曲折）走；
   *  3. 整理：每个区块只保留一块主体——被切断的内陆碎片并入接壤最长的邻区（这就是界线上那些小圈“飞地”的来源），
   *     含城市的碎片则沿最短路接回主体；纯海岛不动。 */
  function refineFine(P, Hy, half, opt) {
    const FW = P.W, FH = P.H, FN = FW * FH, W = FW / 2, H = FH / 2, e = P.elev, q = Hy.q, qth = Hy.qth, lake = Hy.lake;
    const n2 = G.Noise.simplex2(opt.seed), wxN = G.Noise.simplex3(opt.seed + 77), wyN = G.Noise.simplex3(opt.seed + 78);
    const out = new Int32Array(FN).fill(-3);
    const isW = i => e[i] <= 0 || lake[i] || (opt.ice && opt.ice[i]);
    const A = opt.amp || 0, D = opt.bandF || 4, RC = FW / (2 * Math.PI), OCT = opt.oct || [[0.12, 1], [0.3, 0.5]], on = OCT.reduce((s, o) => s + o[1], 0);
    // 半格：靠近区块分界、可以扭曲的格
    const cnt = new Map(); for (let i = 0; i < W * H; i++) { const a = half[i]; if (a >= 0) cnt.set(a, (cnt.get(a) || 0) + 1); }
    const small = a => a >= 0 && (cnt.get(a) || 0) < (opt.minCells || 12);
    const near = new Uint8Array(W * H);
    if (A > 0) {
      const d = new Int16Array(W * H).fill(-1), qq = new Int32Array(W * H), RN = Math.ceil(A / 2) + 2; let h = 0, t = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, a = half[i]; if (a === -2) continue;
        for (const j of [y > 0 ? i - W : -1, y < H - 1 ? i + W : -1, y * W + (x + 1) % W, y * W + (x - 1 + W) % W]) if (j >= 0 && half[j] !== a && half[j] !== -2) { d[i] = 0; qq[t++] = i; break; } }
      while (h < t) { const i = qq[h++]; if (d[i] >= RN) continue; const y = (i / W) | 0, x = i - y * W;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; const j = yy * W + (x + dx + W) % W; if (d[j] < 0) { d[j] = d[i] + 1; qq[t++] = j; } } }
      for (let i = 0; i < W * H; i++) near[i] = d[i] >= 0 && !small(half[i]) ? 1 : 0;
      const cr = opt.cityR === undefined ? 1 : opt.cityR;
      for (const [fx, fy] of opt.fixed || []) { const cx = Math.floor(fx / 2), cy = Math.floor(fy / 2);
        for (let dy = -cr; dy <= cr; dy++) for (let dx = -cr; dx <= cr; dx++) { const yy = cy + dy; if (yy >= 0 && yy < H) near[yy * W + ((cx + dx) % W + W) % W] = 0; } }
    }
    // 1. 扭曲后的先验标签
    const pre = new Int32Array(FN);
    for (let f = 0; f < FN; f++) {
      if (isW(f)) { out[f] = opt.ice && opt.ice[f] && e[f] > 0 && !lake[f] ? -4 : -2; pre[f] = out[f]; continue; }
      const y = (f / FW) | 0, x = f - y * FW, hc = (y >> 1) * W + (x >> 1); let lab = half[hc];
      if (near[hc]) { const th = (x + 0.5) / RC; let sx = 0, sy = 0;
        for (const [fq, a] of OCT) { const r = RC * fq, cx = Math.cos(th) * r, cz = Math.sin(th) * r, yy = (y + 0.5) * fq; sx += a * wxN(cx, yy, cz); sy += a * wyN(cx, yy + 57.1, cz); }
        const yy = Math.max(0, Math.min(FH - 1, Math.floor(y + 0.5 + sy / on * A * 1.8))), xx = ((Math.floor(x + 0.5 + sx / on * A * 1.8) % FW) + FW) % FW;
        const l2 = half[(yy >> 1) * W + (xx >> 1)]; if (l2 !== -2 && !small(l2)) lab = l2; }
      pre[f] = lab === -2 ? -3 : lab;
    }
    // 2. 条带：先验界线两侧 D 像素内留空，交给下面按地形重新划
    const nb4 = (i, fn) => { const y = (i / FW) | 0, x = i - y * FW; if (y > 0) fn(i - FW); if (y < FH - 1) fn(i + FW); fn(y * FW + (x + 1) % FW); fn(y * FW + (x - 1 + FW) % FW); };
    { const bd = new Int8Array(FN).fill(-1), qq = new Int32Array(FN); let h = 0, t = 0;
      for (let f = 0; f < FN; f++) { const a = pre[f]; if (a < -1 && a !== -3) continue; let b = a === -3; if (!b) nb4(f, j => { const c = pre[j]; if (c !== a && (c >= -1 || c === -3)) b = true; }); if (b) { bd[f] = 0; qq[t++] = f; } }
      while (h < t) { const i = qq[h++]; if (bd[i] >= D) continue; nb4(i, j => { if (bd[j] < 0 && (pre[j] >= -1 || pre[j] === -3)) { bd[j] = bd[i] + 1; qq[t++] = j; } }); }
      for (let f = 0; f < FN; f++) if (out[f] === -3 && bd[f] < 0) out[f] = pre[f]; }
    // 城市：所在区块与先验不符时清出一圈让它自己长，然后钉住城市像素
    const FX = [];
    for (const [fx, fy, lab] of opt.fixed || []) { if (lab < 0) continue; const y0 = Math.min(FH - 1, Math.max(0, Math.floor(fy))), x0 = ((Math.floor(fx) % FW) + FW) % FW, f = y0 * FW + x0; if (!isW(f)) FX.push(f, x0, y0, lab); }
    const cr = Math.ceil(A) + D + 1;
    for (let k = 0; k < FX.length; k += 4) { const f = FX[k], x0 = FX[k + 1], y0 = FX[k + 2]; if (out[f] === FX[k + 3]) continue;
      for (let dy = -cr; dy <= cr; dy++) for (let dx = -cr; dx <= cr; dx++) { if (dx * dx + dy * dy > cr * cr) continue; const yy = y0 + dy; if (yy < 0 || yy >= FH) continue; const j = yy * FW + ((x0 + dx) % FW + FW) % FW; if (out[j] >= -1) out[j] = -3; } }
    for (let k = 0; k < FX.length; k += 4) out[FX[k]] = FX[k + 3];
    // 3. 条带内按地形代价从两侧推进（与 refine 相同的山川形便代价）
    const dist = new Float32Array(FN).fill(Infinity), hp = new G.Hydro.Heap(1 << 16);
    const nb = (i, k) => { const y = (i / FW) | 0, yy = y + DY[k]; if (yy < 0 || yy >= FH) return -1; let xx = i - y * FW + DX[k]; if (xx < 0) xx += FW; else if (xx >= FW) xx -= FW; return yy * FW + xx; };
    for (let f = 0; f < FN; f++) { if (out[f] < -1) continue; for (let k = 0; k < 8; k += 2) { const j = nb(f, k); if (j >= 0 && out[j] === -3) { dist[f] = 0; hp.push(f, 0); break; } } }
    const step = (i, j) => {
      const y = (j / FW) | 0, x = j - y * FW;
      let c = 1 + Math.abs(e[j] - e[i]) / opt.climb;
      const r = q[j] / qth; if (r >= 3) c += Math.min(opt.riverMax, opt.river * (1 + Math.log2(r / 3)));
      const n = n2(x * opt.freq, y * opt.freq) * 0.5 + n2(x * opt.freq * 2.7 + 31, y * opt.freq * 2.7) * 0.3 + n2(x * opt.freq * 7.3 - 17, y * opt.freq * 7.3) * 0.2;
      return c * (opt.noise0 + opt.noise1 * (n * 0.5 + 0.5));
    };
    while (hp.n) {
      const i = hp.pop(), d = dist[i], lab = out[i];
      for (let k = 0; k < 8; k++) { const j = nb(i, k); if (j < 0 || out[j] !== -3 && !(dist[j] > 0 && dist[j] < Infinity)) continue; if (out[j] === -2 || out[j] === -4) continue;
        const nd = d + DL[k] * step(i, j);
        if (nd < dist[j]) { dist[j] = nd; out[j] = lab; hp.push(j, nd); } }
    }
    for (let f = 0; f < FN; f++) if (out[f] === -3) { const y = (f / FW) | 0, x = f - y * FW, h = (y >> 1) * W + (x >> 1); out[f] = half[h] === -2 ? -1 : half[h]; }
    const pins = []; for (let k = 0; k < FX.length; k += 4) pins.push(FX[k], FX[k + 3]);
    tidy(out, FW, FH, pins); bridge(out, FW, FH, 10);
    return out;
  }

  // 4 邻接连通块（只看陆地标签 ≥ -1）：cs[k] = { k: 标签, cells }，comp[i] = 块序号 + 1
  function components(F, FW, FH, ok) {
    const N = F.length, comp = new Int32Array(N), st = new Int32Array(N), cs = [];
    for (let s = 0; s < N; s++) { const k = F[s]; if (!ok(k) || comp[s]) continue; const id = cs.length + 1, cells = []; let t = 0; st[t++] = s; comp[s] = id;
      while (t) { const i = st[--t]; cells.push(i); const y = (i / FW) | 0, x = i - y * FW; let j;
        if (y > 0 && !comp[j = i - FW] && F[j] === k) { comp[j] = id; st[t++] = j; }
        if (y < FH - 1 && !comp[j = i + FW] && F[j] === k) { comp[j] = id; st[t++] = j; }
        if (!comp[j = x + 1 < FW ? i + 1 : i + 1 - FW] && F[j] === k) { comp[j] = id; st[t++] = j; }
        if (!comp[j = x > 0 ? i - 1 : i - 1 + FW] && F[j] === k) { comp[j] = id; st[t++] = j; } }
      cs.push({ k, cells }); }
    const main = new Map(); cs.forEach((c, i) => { const m = main.get(c.k); if (m === undefined || c.cells.length > cs[m].cells.length) main.set(c.k, i); });
    return { comp, cs, main };
  }
  // 碎片并入接壤最长的邻区：不是主体、不到主体一半、四周有别的陆地标签（纯海岛不动）；含本区城市的碎片留给 bridge
  function tidy(F, FW, FH, pins) {
    for (let pass = 0; pass < 3; pass++) {
      const { comp, cs, main } = components(F, FW, FH, k => k >= -1); let changed = 0;
      const keep = new Set(); for (let k = 0; k < (pins || []).length; k += 2) if (F[pins[k]] === pins[k + 1]) keep.add(comp[pins[k]] - 1);
      cs.forEach((c, ci) => { const mi = main.get(c.k); if (mi === ci || keep.has(ci) || c.cells.length > 0.5 * cs[mi].cells.length) return;
        const cnt = new Map();
        const see = j => { const o = F[j]; if (o >= -1 && o !== c.k) cnt.set(o, (cnt.get(o) || 0) + 1); };
        for (const i of c.cells) { const y = (i / FW) | 0, x = i - y * FW; if (y > 0) see(i - FW); if (y < FH - 1) see(i + FW); see(x + 1 < FW ? i + 1 : i + 1 - FW); see(x > 0 ? i - 1 : i - 1 + FW); }
        let best = -9, bv = 0; for (const [o, v] of cnt) if (v > bv) { bv = v; best = o; } if (best === -9) return;
        for (const i of c.cells) F[i] = best; changed++; });
      if (!changed) break;
    }
  }
  // 仍与主体分离、四周有陆地的区块碎片（多为含城市的）：沿穿过邻区陆地的最短路（≤ maxLen 像素）接回主体
  function bridge(F, FW, FH, maxLen) {
    const { comp, cs, main } = components(F, FW, FH, k => k > 0), prev = new Map(); let n = 0;
    const nb4 = (i, fn) => { const y = (i / FW) | 0, x = i - y * FW; if (y > 0) fn(i - FW); if (y < FH - 1) fn(i + FW); fn(y * FW + (x + 1) % FW); fn(y * FW + (x - 1 + FW) % FW); };
    cs.forEach((c, ci) => { const mi = main.get(c.k); if (mi === ci) return; let land = false; for (const i of c.cells) nb4(i, j => { if (F[j] >= -1 && F[j] !== c.k) land = true; }); if (!land) return;
      prev.clear(); let fr = c.cells.slice(), hit = -1; for (const i of fr) prev.set(i, -1);
      for (let d = 0; d < maxLen && hit < 0 && fr.length; d++) { const nx = []; for (const i of fr) { nb4(i, j => { if (hit >= 0 || prev.has(j) || F[j] < -1) return; prev.set(j, i); if (comp[j] === mi + 1) hit = j; else nx.push(j); }); if (hit >= 0) break; } fr = nx; }
      if (hit < 0) return; for (let p = prev.get(hit); p >= 0 && comp[p] !== ci + 1; p = prev.get(p)) F[p] = c.k; n++; });
    return n;
  }

  // country / province：半分辨率标签（-1 无国家陆地；水为 -2）
  function run(P, Hy, Cv, seed, fixedCities, Cl) {
    const W = Cv.W, H = Cv.H, N = W * H;
    const halfC = new Int32Array(N), halfP = new Int32Array(N);
    const FW0 = P.W, lakeH = new Uint8Array(N); for (let i = 0; i < N; i++) { const y = ((i / W) | 0) * 2, x = (i % W) * 2; let c = 0; for (const f of [y * FW0 + x, y * FW0 + x + 1, (y + 1) * FW0 + x, (y + 1) * FW0 + x + 1]) if (Hy.lake[f] || P.elev[f] <= 0) c++; lakeH[i] = c >= 2 ? 1 : 0; }
    for (let i = 0; i < N; i++) { const land = Cv.land[i] && !(lakeH[i] && Cv.country[i] < 0); halfC[i] = land ? Cv.country[i] : -2; halfP[i] = land ? (Cv.country[i] >= 0 ? Cv.province[i] : -1) : -2; }
    // 极地冰盖：不属于任何国家，也不画界
    const FWi = P.W, FHi = P.H, ice = new Uint8Array(FWi * FHi);
    for (let f = 0; f < ice.length; f++) { const lat = Math.abs(90 - (((f / FWi) | 0) + 0.5) / FHi * 180); if (P.elev[f] > 0 && lat > 55 && Cl.snow[f] === 2) ice[f] = 1; }
    const cF = refine(P, Hy, halfC, { seed: seed + 901, band: 2, ice, climb: 22, river: 4, riverMax: 12, freq: 0.08, noise0: 0.35, noise1: 1.3, fixed: fixedCities.map(c => [c.x, c.y, c.country]) });
    const provCountry = Cv.provinces.map(p => p.country);
    const pF = refine(P, Hy, halfP, { seed: seed + 902, band: 3, ice, climb: 45, river: 1.8, riverMax: 5, freq: 0.1, noise0: 0.25, noise1: 1.7,
      fixed: fixedCities.filter(c => c.prov >= 0).map(c => [c.x, c.y, c.prov]),
      allow: (lab, j) => (lab < 0 ? cF[j] < 0 : provCountry[lab] === cF[j]) });
    // 国家内仍为 -1 的格（无省份的小国）
    const countryF = Int16Array.from(cF), provinceF = new Int16Array(pF.length);
    for (let f = 0; f < pF.length; f++) provinceF[f] = cF[f] >= 0 && pF[f] >= 0 && provCountry[pF[f]] === cF[f] ? pF[f] : cF[f] >= 0 ? -1 : cF[f] <= -2 ? cF[f] : -1;
    const provAnchor = anchors(provinceF, P.W, Cv.provinces.length);
    return { countryF, provinceF, provAnchor };
  }
  // 省名锚点：省域内离省界最远处（全分辨率距离变换）
  function anchors(provinceF, FW, nProv) {
    const FN = provinceF.length, dd = new Uint16Array(FN).fill(65535), qq = new Int32Array(FN); let h = 0, t = 0;
    for (let f = 0; f < FN; f++) { const a = provinceF[f]; if (a < 0) continue; const y = (f / FW) | 0, x = f - y * FW;
      const ns = [y > 0 ? f - FW : -1, f + FW < FN ? f + FW : -1, y * FW + (x + 1) % FW, y * FW + (x - 1 + FW) % FW];
      if (ns.some(j => j < 0 || provinceF[j] !== a)) { dd[f] = 0; qq[t++] = f; } }
    while (h < t) { const f = qq[h++], a = provinceF[f], y = (f / FW) | 0, x = f - y * FW;
      for (const j of [y > 0 ? f - FW : -1, f + FW < FN ? f + FW : -1, y * FW + (x + 1) % FW, y * FW + (x - 1 + FW) % FW]) if (j >= 0 && provinceF[j] === a && dd[j] > dd[f] + 1) { dd[j] = dd[f] + 1; qq[t++] = j; } }
    const best = new Int32Array(nProv).fill(-1);
    for (let f = 0; f < FN; f++) { const a = provinceF[f]; if (a >= 0 && a < nProv && (best[a] < 0 || dd[f] > dd[best[a]])) best[a] = f; }
    return Array.from({ length: nProv }, (_, k) => best[k] < 0 ? null : { x: best[k] % FW + 0.5, y: ((best[k] / FW) | 0) + 0.5, size: dd[best[k]] });
  }

  G.Borders = { run, refine, refineFine, tidy, anchors };
})(typeof self !== 'undefined' ? self : this);
