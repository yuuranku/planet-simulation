/* 星球地质：板块构造 → 大陆地壳 → 造山/海沟/洋脊 → 细节 → 海平面 → 水力侵蚀
 * 粗网格（≤544 宽）负责板块与大尺度场，全分辨率网格负责地形细节与侵蚀。 */
(function (G) {
  'use strict';
  const { mulberry32, simplex3, fbm3, ridged3 } = G.Noise;
  const D2R = Math.PI / 180;

  function grid(W, H) {
    const lat = new Float32Array(H), cosLat = new Float32Array(H), sinLat = new Float32Array(H);
    const cosLon = new Float32Array(W), sinLon = new Float32Array(W);
    for (let y = 0; y < H; y++) { lat[y] = 90 - (y + 0.5) / H * 180; cosLat[y] = Math.cos(lat[y] * D2R); sinLat[y] = Math.sin(lat[y] * D2R); }
    for (let x = 0; x < W; x++) { const lo = ((x + 0.5) / W * 360 - 180) * D2R; cosLon[x] = Math.cos(lo); sinLon[x] = Math.sin(lo); }
    return { W, H, N: W * H, lat, cosLat, sinLat, cosLon, sinLon };
  }

  // 双线性上采样（x 方向环绕）
  function upsample(src, sw, sh, W, H) {
    const out = new Float32Array(W * H), fx = sw / W, fy = sh / H;
    const X0 = new Int32Array(W), X1 = new Int32Array(W), TX = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const sx = (x + 0.5) * fx - 0.5; let x0 = Math.floor(sx); TX[x] = sx - x0;
      let x1 = x0 + 1; if (x0 < 0) x0 += sw; if (x1 >= sw) x1 -= sw; X0[x] = x0; X1[x] = x1;
    }
    for (let y = 0; y < H; y++) {
      const sy = (y + 0.5) * fy - 0.5; let y0 = Math.floor(sy), ty = sy - y0, y1 = y0 + 1;
      if (y0 < 0) { y0 = 0; ty = 0; } if (y1 > sh - 1) y1 = sh - 1;
      const r0 = y0 * sw, r1 = y1 * sw, o = y * W;
      for (let x = 0; x < W; x++) {
        const tx = TX[x], a = src[r0 + X0[x]], b = src[r0 + X1[x]], c = src[r1 + X0[x]], d = src[r1 + X1[x]];
        out[o + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      }
    }
    return out;
  }
  // 按块求平均下采样
  function downsample(src, W, H, sw, sh, fn) {
    const out = new Float32Array(sw * sh), f = W / sw;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      let s = 0, n = 0;
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) {
        const v = src[(y * f + dy) * W + x * f + dx]; s += fn ? fn(v) : v; n++;
      }
      out[y * sw + x] = s / n;
    }
    return out;
  }

  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const ang = (ax, ay, az, bx, by, bz) => Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz))) / D2R;
  function randUnit(r) { const z = 2 * r() - 1, t = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z); return [s * Math.cos(t), s * Math.sin(t), z]; }
  function fromLatLon(la, lo) { const c = Math.cos(la * D2R); return [c * Math.cos(lo * D2R), c * Math.sin(lo * D2R), Math.sin(la * D2R)]; }
  const bump = (d, c, w) => { const t = (d - c) / w; return Math.exp(-t * t); };

  function build(cfg, progress) {
    const rnd = mulberry32(cfg.seed);
    const W = cfg.W, H = cfg.H;
    const cW = Math.min(W, 544), cH = cW / 2;
    const C = grid(cW, cH), F = grid(W, H);
    const cN = C.N;
    const nA = simplex3(cfg.seed + 11), nB = simplex3(cfg.seed + 12), nC = simplex3(cfg.seed + 13);
    const nD = simplex3(cfg.seed + 14), nE = simplex3(cfg.seed + 15), nF = simplex3(cfg.seed + 16), nG = simplex3(cfg.seed + 17);

    // ---------- 1. 板块 ----------
    progress('板块漂移', 0.02);
    const P = cfg.plates;
    const seeds = [], wts = [];
    for (let p = 0; p < P; p++) {
      let s, ok = false;
      for (let t = 0; t < 60 && !ok; t++) {
        s = randUnit(rnd); ok = true;
        for (const q of seeds) if (ang(...s, ...q) < 140 / Math.sqrt(P)) { ok = false; break; }
      }
      seeds.push(s); wts.push(0.72 + 0.6 * rnd());
    }
    const plate = new Uint8Array(cN);
    const qx = new Float32Array(cN), qy = new Float32Array(cN), qz = new Float32Array(cN); // 扭曲后的坐标
    for (let y = 0; y < cH; y++) for (let x = 0; x < cW; x++) {
      const i = y * cW + x;
      const px = C.cosLat[y] * C.cosLon[x], py = C.cosLat[y] * C.sinLon[x], pz = C.sinLat[y];
      let wx = px + 0.32 * fbm3(nA, px * 1.6, py * 1.6, pz * 1.6, 4);
      let wy = py + 0.32 * fbm3(nB, px * 1.6, py * 1.6, pz * 1.6, 4);
      let wz = pz + 0.32 * fbm3(nC, px * 1.6, py * 1.6, pz * 1.6, 4);
      const l = Math.hypot(wx, wy, wz); wx /= l; wy /= l; wz /= l;
      qx[i] = wx; qy[i] = wy; qz[i] = wz;
      let best = 1e9, bp = 0;
      for (let p = 0; p < P; p++) {
        const s = seeds[p], d = (1 - (wx * s[0] + wy * s[1] + wz * s[2])) / (wts[p] * wts[p]);
        if (d < best) { best = d; bp = p; }
      }
      plate[i] = bp;
    }
    const poles = [], omega = [];
    for (let p = 0; p < P; p++) { poles.push(randUnit(rnd)); omega.push((0.35 + 0.85 * rnd()) * cfg.activity); }
    const vel = (p, x, y, z) => { const e = poles[p], w = omega[p]; return [w * (e[1] * z - e[2] * y), w * (e[2] * x - e[0] * z), w * (e[0] * y - e[1] * x)]; };

    // ---------- 2. 大陆地壳 ----------
    progress('大陆核心', 0.08);
    const [kMin, kMax] = cfg.cores;
    const K = kMin + ((rnd() * (kMax - kMin + 1)) | 0);
    const spread = cfg.coreSpread;
    const c0lat = -15 + rnd() * 40, c0lon = -180 + rnd() * 360;
    const c0 = fromLatLon(c0lat, c0lon);
    const polar = { N: cfg.northPole, S: cfg.southPole };
    for (const k of ['N', 'S']) if (polar[k] === 'random') polar[k] = ['land', 'ocean', 'separate'][(rnd() * 3) | 0];
    const latLimit = (la) => {
      if (la > 0 && polar.N === 'separate') return la < 46;
      if (la < 0 && polar.S === 'separate') return la > -46;
      return Math.abs(la) < 62;
    };
    const cores = [];
    const newWorld = cfg.newWorld === 'random' ? rnd() < 0.5 : !!cfg.newWorld;
    const nNew = newWorld ? (K >= 6 ? 2 : 1) : 0;
    const oldSpread = newWorld ? Math.min(spread, 75) : spread;
    for (let k = 0; k < K; k++) {
      const isNew = k >= K - nNew;
      let c = null;
      for (let t = 0; t < 400; t++) {
        let la, lo;
        if (isNew) { la = -35 + rnd() * 70; lo = c0lon + 180 + (rnd() - 0.5) * 70; }
        else { la = c0lat + (rnd() - 0.5) * 2 * oldSpread * 0.75; lo = c0lon + (rnd() - 0.5) * 2 * oldSpread; }
        if (!latLimit(la)) continue;
        const v = fromLatLon(la, lo);
        if (!isNew && ang(...v, ...c0) > oldSpread) continue;
        let ok = true;
        for (const o of cores) if (ang(...v, ...o.c) < 13 + 6 / Math.sqrt(K)) { ok = false; break; }
        if (ok || t > 380) { c = v; break; }
      }
      cores.push({ c, isNew, share: 0.4 + rnd() * (isNew ? 1.6 : 1.2) });
    }
    // 极地大陆
    const polarArea = { N: 0, S: 0 };
    for (const k of ['N', 'S']) if (polar[k] === 'land' || polar[k] === 'separate') {
      const custom = cfg.polarArea && cfg.polarArea[k]; // 原版：留空时按种子在 2–5% 之间浮动
      polarArea[k] = custom ? custom / 100 : 0.02 + 0.03 * rnd();
      cores.push({ c: fromLatLon(k === 'N' ? 90 : -90, 0), isNew: false, polar: k, fixedArea: polarArea[k] });
    }
    // 大陆结构（第 11 题）：核心按距离与聚合度并成若干“大陆组”，不同组之间留出海峡/大洋，使大陆数量随题目变化
    { const pMerge = [0.75, 0.3, 0.1][cfg.structIdx ?? (cfg.coreSpread <= 62 ? 0 : cfg.coreSpread >= 160 ? 2 : 1)];
      cores.forEach((c, k) => c.group = k);
      const root = k => { while (cores[k].group !== k) k = cores[k].group; return k; };
      for (let i = 0; i < cores.length; i++) for (let j = i + 1; j < cores.length; j++) {
        const a = cores[i], b = cores[j]; if (a.polar || b.polar || a.isNew !== b.isNew) continue;
        if (ang(...a.c, ...b.c) < 32 && rnd() < pMerge) cores[root(j)].group = root(i); }
      cores.forEach((c, k) => c.group = root(k)); }
    // 附属陆块（第 11 题 C 更多）：中等大小的微大陆，独立成组
    { const nFrag = [1, 3, 8][cfg.structIdx ?? 1];
      for (let f = 0; f < nFrag; f++) { const base = cores[(rnd() * cores.length) | 0]; if (base.polar) continue;
        for (let t = 0; t < 60; t++) { const la = Math.max(-58, Math.min(58, (90 - Math.acos(base.c[2]) / D2R) + (rnd() - 0.5) * 70)), lo = Math.atan2(base.c[1], base.c[0]) / D2R + (rnd() - 0.5) * 80; const v = fromLatLon(la, lo);
          if (cores.some(o => ang(...v, ...o.c) < 16)) continue; cores.push({ c: v, isNew: base.isNew, share: 0.08 + rnd() * 0.12, frag: true, group: 1000 + f }); break; } } }
    const shareSum = cores.reduce((s, c) => s + (c.fixedArea ? 0 : c.share), 0);
    const restArea = Math.max(0.08, cfg.land - polarArea.N - polarArea.S);
    for (const c of cores) {
      const a = c.fixedArea || restArea * c.share / shareSum * 1.32;
      c.r = Math.acos(1 - 2 * a) / D2R; // 球冠半径（度）
    }
    const coastAmp = [0.3, 0.36, 0.42][cfg.coast];
    const chanDepth = 0.85, chanW = [0.1, 0.16, 0.22][cfg.structIdx ?? 1];
    // 岛链 / 群岛：A 完整陆缘少量，B 均衡，C 破碎陆缘丰富。近岸群岛沿陆缘排列，远洋岛弧沿弧线排列
    const islets = [];
    { const nCl = [3, 12, 36][cfg.coast];
      const nearCore = () => cores[(rnd() * cores.length) | 0];
      for (let cI = 0; cI < nCl; cI++) {
        const base = nearCore(); if (!base || base.polar) continue;
        const oceanic = rnd() < 0.35;
        const off = oceanic ? base.r + 8 + rnd() * 18 : base.r * (0.85 + rnd() * 0.35) + 1;
        const az = rnd() * Math.PI * 2, blat = 90 - Math.acos(base.c[2]) / D2R, blon = Math.atan2(base.c[1], base.c[0]) / D2R;
        const la = blat + Math.cos(az) * off, lo = blon + Math.sin(az) * off / Math.max(0.3, Math.cos(blat * D2R));
        if (Math.abs(la) > 66) continue;
        const n = 3 + ((rnd() * (oceanic ? 9 : 7)) | 0), dir = rnd() * Math.PI * 2, curve = (rnd() - 0.5) * 0.25;
        let a = dir, y = la, x = lo;
        for (let k = 0; k < n; k++) { const r = (oceanic ? 0.18 : 0.22) + rnd() * rnd() * (oceanic ? 0.7 : 1.1);
          islets.push({ lat: Math.max(-70, Math.min(70, y)), lon: x, r, h: 900 + rnd() * 1600 });
          const st = 2 * r + 0.5 + rnd() * 1.4; y += Math.cos(a) * st; x += Math.sin(a) * st / Math.max(0.3, Math.cos(y * D2R)); a += curve + (rnd() - 0.5) * 0.4; } } }
    const crust = new Float32Array(cN), coreOf = new Uint8Array(cN);
    for (let y = 0; y < cH; y++) for (let x = 0; x < cW; x++) {
      const i = y * cW + x;
      const px = C.cosLat[y] * C.cosLon[x], py = C.cosLat[y] * C.sinLon[x], pz = C.sinLat[y];
      let best = -9, bk = 0;
      const sc = new Float32Array(cores.length);
      for (let k = 0; k < cores.length; k++) {
        const c = cores[k];
        const s = (c.r - ang(qx[i], qy[i], qz[i], ...c.c)) / c.r; sc[k] = s;
        if (s > best) { best = s; bk = k; }
      }
      let second = -9; for (let k = 0; k < cores.length; k++) if (cores[k].group !== cores[bk].group && sc[k] > second) second = sc[k];
      let v = best + coastAmp * fbm3(nD, px * 2.6, py * 2.6, pz * 2.6, 6, 2.1, 0.55);
      // 不同大陆组之间的海峡：两组影响接近处压低
      if (second > -0.8) v -= chanDepth * (1 - smooth(0, chanW, best - second));
      // 岛链与群岛（第 12 题）

      if (cfg.coast === 2) v += 0.16 * fbm3(nE, px * 8, py * 8, pz * 8, 3);
      // 极地海峡 / 极地海洋的界线用扭曲后的纬度并叠加起伏：弯曲、宽窄不一，不再沿纬线笔直切开
      const la = Math.asin(Math.max(-1, Math.min(1, qz[i]))) / D2R + 7 * fbm3(nF, px * 2.2, py * 2.2, pz * 2.2, 3) + 2.5 * fbm3(nE, px * 6, py * 6, pz * 6, 2);
      if (la > 0 && polar.N === 'ocean') v -= 1.4 * smooth(58, 74, la);
      if (la < 0 && polar.S === 'ocean') v -= 1.4 * smooth(58, 74, -la);
      if (la > 0 && polar.N === 'separate') v -= 1.6 * bump(la, 60, 4 + 2.5 * (0.5 + 0.5 * fbm3(nG, px * 3, py * 3, pz * 3, 2)));
      if (la < 0 && polar.S === 'separate') v -= 1.6 * bump(-la, 60, 4 + 2.5 * (0.5 + 0.5 * fbm3(nG, px * 3, py * 3, pz * 3, 2)));
      crust[i] = v; // 先存原始值，下面按面积标定
      coreOf[i] = bk;
    }
    // 陆壳面积标定：使大陆地壳（c ≥ 0.52 ⇔ v ≥ 0.008）的面积正好对应目标陆地占比。
    // 否则地壳不足时海平面会被压进大陆坡，整块大陆被抬高数千米，变成全球高原。
    { const vs = [], ws = []; let tot = 0;
      for (let y = 0; y < cH; y++) for (let x = 0; x < cW; x++) { const w = C.cosLat[y]; vs.push(crust[y * cW + x]); ws.push(w); tot += w; }
      const ord = vs.map((_, k) => k).sort((a, b) => vs[b] - vs[a]);
      let acc = 0, vq = vs[ord[0]]; for (const k of ord) { acc += ws[k]; vq = vs[k]; if (acc >= tot * cfg.land * 0.97) break; }
      const shift = vq - 0.008;
      for (let i = 0; i < cN; i++) crust[i] = smooth(-0.3, 0.3, crust[i] - shift); }

    // ---------- 3. 板块边界与构造作用 ----------
    progress('板块边界', 0.14);
    const bOther = new Int32Array(cN).fill(-1), bConv = new Float32Array(cN), bShear = new Float32Array(cN);
    const cellXYZ = (i) => { const y = (i / cW) | 0, x = i % cW; return [C.cosLat[y] * C.cosLon[x], C.cosLat[y] * C.sinLon[x], C.sinLat[y]]; };
    const boundaryCells = [];
    for (let y = 0; y < cH; y++) for (let x = 0; x < cW; x++) {
      const i = y * cW + x, p = plate[i];
      const nb = [y * cW + (x + 1) % cW, y * cW + (x - 1 + cW) % cW];
      if (y > 0) nb.push(i - cW); if (y < cH - 1) nb.push(i + cW);
      let bestC = 0, found = false;
      for (const j of nb) {
        const q = plate[j]; if (q === p) continue;
        const a = cellXYZ(i), b = cellXYZ(j);
        let nx = b[0] - a[0], ny = b[1] - a[1], nz = b[2] - a[2];
        const dd = nx * a[0] + ny * a[1] + nz * a[2]; nx -= dd * a[0]; ny -= dd * a[1]; nz -= dd * a[2];
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
        const va = vel(p, ...a), vb = vel(q, ...a);
        const rx = va[0] - vb[0], ry = va[1] - vb[1], rz = va[2] - vb[2];
        const conv = rx * nx + ry * ny + rz * nz;
        const sh = Math.hypot(rx - conv * nx, ry - conv * ny, rz - conv * nz);
        if (!found || Math.abs(conv) > Math.abs(bestC)) { bestC = conv; bOther[i] = j; bConv[i] = conv; bShear[i] = sh; found = true; }
      }
      if (found) boundaryCells.push(i);
    }
    // 同板块内多源 BFS：最近的边界格
    const src = new Int32Array(cN).fill(-1);
    // 最近边界点：按真实球面角距离做 8 邻域 Dijkstra 传播（近似精确的 Voronoi），
    // 距离场连续，不会出现四方向洪泛造成的横竖直线台阶
    { const dist = new Float32Array(cN).fill(Infinity), PX = new Float32Array(cN), PY = new Float32Array(cN), PZ = new Float32Array(cN);
      for (let y = 0; y < cH; y++) for (let x = 0; x < cW; x++) { const i = y * cW + x; PX[i] = C.cosLat[y] * C.cosLon[x]; PY[i] = C.cosLat[y] * C.sinLon[x]; PZ[i] = C.sinLat[y]; }
      for (const i of boundaryCells) { src[i] = i; dist[i] = 0; }
      const relax = (i, j) => { const s0 = src[j]; if (s0 < 0 || plate[j] !== plate[i]) return; const d = 1 - (PX[i] * PX[s0] + PY[i] * PY[s0] + PZ[i] * PZ[s0]); if (d < dist[i]) { dist[i] = d; src[i] = s0; } };
      for (let pass = 0; pass < 4; pass++) { // 正反两向光栅扫描，按真实球面距离传递最近边界点（无堆、固定开销）
        if (pass % 2 === 0) { for (let y = 0; y < cH; y++) for (let x = 0; x < cW; x++) { const i = y * cW + x; relax(i, y * cW + (x - 1 + cW) % cW); if (y > 0) { relax(i, i - cW); relax(i, (y - 1) * cW + (x - 1 + cW) % cW); relax(i, (y - 1) * cW + (x + 1) % cW); } } }
        else { for (let y = cH - 1; y >= 0; y--) for (let x = cW - 1; x >= 0; x--) { const i = y * cW + x; relax(i, y * cW + (x + 1) % cW); if (y < cH - 1) { relax(i, i + cW); relax(i, (y + 1) * cW + (x + 1) % cW); relax(i, (y + 1) * cW + (x - 1 + cW) % cW); } } } } }
    let queue = null;

    const mScale = Math.pow(6400 / cfg.radius, 0.4) * [0.85, 1, 1.25][cfg.interior] * (0.75 + 0.25 * cfg.activity);
    const uplift = new Float32Array(cN);
    const volcanoes = [];
    for (let i = 0; i < cN; i++) {
      const b = src[i]; if (b < 0) continue;
      const a = cellXYZ(i), bb = cellXYZ(b);
      const d = ang(...a, ...bb);
      if (d > 14) continue;
      const conv = bConv[b], o = bOther[b];
      const own = crust[b] > 0.5, oth = crust[o] > 0.5;
      let u = 0;
      if (conv > 0.05) {
        const S = Math.min(1.6, conv / 0.9);
        if (own && oth) u = S * (4000 * bump(d, 0.6, 3.0) + 1500 * bump(d, 4, 6));
        else if (own && !oth) u = S * (3900 * bump(d, 1.6, 2.2) - 600 * bump(d, 0, 0.6));
        else if (!own && oth) u = -S * 3600 * bump(d, 0, 1.1);
        else u = plate[i] > plate[o] ? S * (3700 * bump(d, 1.5, 1.0) - 1200 * bump(d, 0, 0.5)) : -S * 3800 * bump(d, 0, 0.9);
        if (i === b && ((own && !oth) || (!own && !oth && plate[i] > plate[o])) && rnd() < 0.08) volcanoes.push(i);
      } else if (conv < -0.05) {
        const S = Math.min(1.6, -conv / 0.9);
        if (own) u = S * (-1000 * bump(d, 0, 1.2) + 450 * bump(d, 1.8, 1.0));
        else u = S * 1900 * bump(d, 0, 4.5);
      } else {
        u = bShear[b] * 380 * bump(d, 0, 1.0) * (fbm3(nF, a[0] * 6, a[1] * 6, a[2] * 6, 2) > 0 ? 1 : -0.6);
      }
      uplift[i] = u * mScale;
    }

    // ---------- 4. 基础高程（粗网格） ----------
    progress('地壳均衡', 0.2);
    const base = new Float32Array(cN);
    for (let y = 0; y < cH; y++) for (let x = 0; x < cW; x++) {
      const i = y * cW + x, c = crust[i];
      const px = C.cosLat[y] * C.cosLon[x], py = C.cosLat[y] * C.sinLon[x], pz = C.sinLat[y];
      let e;
      if (c < 0.3) e = -4500 + 700 * fbm3(nE, px * 4, py * 4, pz * 4, 3);
      else if (c < 0.45) e = -4500 + 4340 * smooth(0.3, 0.45, c);
      else if (c < 0.52) e = -160 + 200 * (c - 0.45) / 0.07;
      else e = 40 + 520 * (c - 0.52) / 0.48;
      if (c > 0.5) {
        const land = smooth(0.5, 0.65, c);
        if (cfg.interior === 0) e = 40 + (e - 40) * 0.55 - 120 * land * smooth(0.1, 0.5, fbm3(nG, px * 2.2, py * 2.2, pz * 2.2, 3));
        if (cfg.interior === 1) {
          e += 1150 * land * smooth(0.22, 0.42, fbm3(nG, px * 2.4, py * 2.4, pz * 2.4, 4));
          e -= 300 * land * smooth(0.25, 0.5, -fbm3(nF, px * 2.8, py * 2.8, pz * 2.8, 3));
        }
        if (cfg.interior === 2) e += 900 * land * ridged3(nG, px * 3.2, py * 3.2, pz * 3.2, 4);
      }
      base[i] = e;
    }

    // ---------- 5. 全分辨率合成 ----------
    progress('山脉细节', 0.26);
    // 粗网格 → 全分辨率：域扭曲 + 双线性采样。直接双线性放大会把粗网格的台阶留成笔直的南北/东西向海岸和方块岛；
    // 按平滑噪声把采样位置偏移约 1–2 个粗格，轮廓随之自然弯曲（低频决定大形，高频打碎残余直边）
    const nW1 = simplex3(cfg.seed + 41), nW2 = simplex3(cfg.seed + 42), WA = 3.2, fxC = cW / W, fyC = cH / H;
    const sampC = (src, sx, sy) => { if (sy < 0) sy = 0; if (sy > cH - 1) sy = cH - 1; const x0 = Math.floor(sx), y0 = Math.min(cH - 2, Math.floor(sy)), tx = sx - x0, ty = sy - y0;
      const xa = ((x0 % cW) + cW) % cW, xb = (xa + 1) % cW, r0 = y0 * cW, r1 = r0 + cW;
      return (src[r0 + xa] * (1 - tx) + src[r0 + xb] * tx) * (1 - ty) + (src[r1 + xa] * (1 - tx) + src[r1 + xb] * tx) * ty; };
    const nR = simplex3(cfg.seed + 21), nS = simplex3(cfg.seed + 22), nT = simplex3(cfg.seed + 23);
    const elev = new Float32Array(W * H);
    const coastDetail = [60, 120, 230][cfg.coast];
    for (let y = 0; y < H; y++) {
      if ((y & 63) === 0) progress('山脉细节', 0.26 + 0.12 * y / H);
      const cl = F.cosLat[y], sl = F.sinLat[y];
      for (let x = 0; x < W; x++) {
        const i = y * W + x, px = cl * F.cosLon[x], py = cl * F.sinLon[x], pz = sl;
        const wx = (nW1(px * 11, py * 11, pz * 11) * 0.7 + nW1(px * 29 + 5.1, py * 29, pz * 29) * 0.3) * WA + nW1(px * 75, py * 75 + 1.3, pz * 75) * 0.9, wy = (nW2(px * 11, py * 11, pz * 11) * 0.7 + nW2(px * 29, py * 29 + 3.7, pz * 29) * 0.3) * WA + nW2(px * 75 + 2.2, py * 75, pz * 75) * 0.9;
        const sxC = (x + 0.5) * fxC - 0.5 + wx / Math.max(0.2, cl), syC = (y + 0.5) * fyC - 0.5 + wy;
        const b = sampC(base, sxC, syC), u = sampC(uplift, sxC, syC);
        let e = b;
        const mtn = Math.min(1, Math.abs(u) / 1800);
        const rug = mtn > 0.0005 ? 0.5 + (ridged3(nR, px * 7, py * 7, pz * 7, 4) - 0.5) * smooth(0, 0.08, mtn) : 0.5; // 平滑过渡，无开关式台阶
        e += u * (0.45 + 1.05 * rug);
        const det = fbm3(nS, px * 16, py * 16, pz * 16, 3);
        const near = Math.exp(-Math.abs(e) / 500);
        e += det * (b > 0 ? 160 + 260 * mtn : 260) + near * coastDetail * fbm3(nT, px * 40, py * 40, pz * 40, 2);
        elev[i] = e;
      }
    }

    // 岛链 / 群岛按全分辨率绘制（小于粗网格一格的岛也能保留），形状带噪声扰动
    { const nI = simplex3(cfg.seed + 31), dLat = 180 / H, dLon = 360 / W;
      for (const isl of islets) {
        const cy = (90 - isl.lat) / dLat, cx = ((isl.lon + 180) % 360 + 360) % 360 / dLon, ry = Math.ceil(isl.r * 1.4 / dLat) + 1, rx = Math.ceil(isl.r * 1.4 / dLon / Math.max(0.25, Math.cos(isl.lat * D2R))) + 1;
        for (let yy = Math.max(0, Math.floor(cy - ry)); yy <= Math.min(H - 1, Math.ceil(cy + ry)); yy++) for (let xo = -rx; xo <= rx; xo++) {
          const xx = ((Math.floor(cx) + xo) % W + W) % W, i = yy * W + xx;
          const la = 90 - (yy + 0.5) * dLat, lo = (xx + 0.5) * dLon - 180, c = fromLatLon(la, lo), d = ang(...c, ...fromLatLon(isl.lat, isl.lon));
          const dn = d / isl.r + 0.35 * fbm3(nI, c[0] * 60, c[1] * 60, c[2] * 60, 3);
          if (dn < 1) { const add = isl.h * (1 - dn * dn); const target = Math.max(elev[i], -200 + add * 1.1); elev[i] = target; } } } }
    // ---------- 6. 海平面：按面积加权分位数使陆地占比达标 ----------
    function seaLevelShift() {
      const hist = new Float64Array(2400); // -12000..12000, 10m 一档
      let tot = 0;
      for (let y = 0; y < H; y++) {
        const w = F.cosLat[y]; tot += w * W;
        for (let x = 0; x < W; x++) { let k = Math.floor((elev[y * W + x] + 12000) / 10); k = k < 0 ? 0 : k > 2399 ? 2399 : k; hist[k] += w; }
      }
      let acc = 0, k = 2399;
      for (; k >= 0; k--) { acc += hist[k]; if (acc >= tot * cfg.land) break; }
      return k * 10 - 12000;
    }
    let sl = seaLevelShift();
    for (let i = 0; i < elev.length; i++) elev[i] -= sl;

    // ---------- 7. 水力侵蚀（水滴法，x 环绕） ----------
    progress('水力侵蚀', 0.4);
    erode(elev, W, H, Math.min(560000, (W * H * 0.17) | 0), mulberry32(cfg.seed + 99), f => progress('水力侵蚀', 0.4 + 0.12 * f));
    sl = seaLevelShift();
    for (let i = 0; i < elev.length; i++) elev[i] -= sl;
    // 陆地高程分布标定（单调分位数映射，保持地形相对高低）：低地、丘陵、山地的面积比例接近类地星球
    { const T = [
        [[0, 0], [0.1, 25], [0.25, 90], [0.5, 260], [0.75, 650], [0.9, 1300], [0.97, 2400], [0.995, 3800]],
        [[0, 0], [0.1, 40], [0.25, 150], [0.5, 420], [0.75, 950], [0.9, 1800], [0.97, 3000], [0.995, 4500]],
        [[0, 0], [0.1, 70], [0.25, 230], [0.5, 620], [0.75, 1300], [0.9, 2300], [0.97, 3600], [0.995, 5000]]][cfg.interior] || null;
      const NB = 1400, hist = new Float64Array(NB); let tot = 0, top = 0; // 0..14000 m，10 m 一档
      for (let y = 0; y < H; y++) { const w = F.cosLat[y]; for (let x = 0; x < W; x++) { const e = elev[y * W + x]; if (e <= 0) continue; const k = Math.min(NB - 1, (e / 10) | 0); hist[k] += w; tot += w; if (e > top) top = e; } }
      if (T && tot > 0) {
        const pts = T.concat([[1, Math.max(top, T[T.length - 1][1] * 1.25)]]);
        const map = new Float32Array(NB + 1); let acc = 0;
        // 构造活动（第 9 题）：活动越强，高海拔一侧的分位越高（山地更多更高）
        const act = Math.max(0.5, Math.min(1.9, cfg.activity || 1));
        for (const pt of pts) if (pt[0] > 0.5) pt[1] *= 1 + (act - 1) * 0.9 * (pt[0] - 0.5) * 2;
        for (let k = 0; k <= NB; k++) { const p = Math.min(1, acc / tot); let j = 1; while (j < pts.length - 1 && pts[j][0] < p) j++; const [p0, v0] = pts[j - 1], [p1, v1] = pts[j]; map[k] = v0 + (v1 - v0) * (p1 > p0 ? (p - p0) / (p1 - p0) : 0); if (k < NB) acc += hist[k]; }
        for (let i = 0; i < elev.length; i++) { const e = elev[i]; if (e <= 0) continue; const f = Math.min(NB, e / 10), k = Math.min(NB - 1, f | 0), t = f - k; elev[i] = Math.max(1, map[k] + (map[k + 1] - map[k]) * t); }
      } }
    // 碎屑小岛（第 12 题）：完整陆缘清掉 ≤8 格的碎岛，均衡清掉 ≤3 格，破碎陆缘保留
    { const minKeep = [9, 4, 1][cfg.coast]; if (minKeep > 1) { const lab = new Uint8Array(W * H), stack = [];
        for (let s0 = 0; s0 < W * H; s0++) { if (elev[s0] <= 0 || lab[s0]) continue; const comp = [s0]; lab[s0] = 1;
          for (let h = 0; h < comp.length; h++) { const i = comp[h], y = (i / W) | 0, x = i - y * W;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const yy = y + dy; if (yy < 0 || yy >= H) continue; const j = yy * W + ((x + dx) % W + W) % W; if (elev[j] > 0 && !lab[j]) { lab[j] = 1; comp.push(j); } } }
          if (comp.length < minKeep) for (const i of comp) elev[i] = -15; } void stack; } }
    // ---------- 被陆地围住的小块“海”：用周围陆地高度平滑填平并留浅盆（湖泊之后按水量平衡形成），避免平底台地与环形湖 ----------
    { const N0 = W * H, comp = new Int32Array(N0).fill(-1), comps = []; let id = 0;
      for (let s0 = 0; s0 < N0; s0++) { if (elev[s0] > 0 || comp[s0] >= 0) continue; const list = [s0]; comp[s0] = id;
        for (let h = 0; h < list.length; h++) { const i = list[h], y = (i / W) | 0, x = i - y * W; for (const j of [y * W + (x + 1) % W, y * W + (x - 1 + W) % W, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && elev[j] <= 0 && comp[j] < 0) { comp[j] = id; list.push(j); } }
        comps.push(list); id++; }
      let main = 0; comps.forEach((c, k) => { if (c.length > comps[main].length) main = k; });
      const inlandSeaMin = Math.round(N0 * 0.0012); // 达到约里海规模的保留为内陆海
      for (let k = 0; k < comps.length; k++) { const list = comps[k]; if (k === main || list.length >= inlandSeaMin) continue;
        const set = new Set(list), val = new Float32Array(list.length), idx = new Map(list.map((c, n) => [c, n])), nbr = list.map(i => { const y = (i / W) | 0, x = i - y * W; return [y * W + (x + 1) % W, y * W + (x - 1 + W) % W, y > 0 ? i - W : i, y < H - 1 ? i + W : i]; });
        let edgeMean = 0, en = 0; nbr.forEach(ns => ns.forEach(j => { if (!set.has(j)) { edgeMean += elev[j]; en++; } })); edgeMean = en ? edgeMean / en : 5; val.fill(edgeMean);
        for (let it = 0; it < 120; it++) for (let n = 0; n < list.length; n++) { let s2 = 0; for (const j of nbr[n]) s2 += set.has(j) ? val[idx.get(j)] : elev[j]; val[n] = s2 / 4; }
        // 到岸距离 → 浅盆（中央约低 25 m）
        const dd = new Int32Array(list.length).fill(-1), q = []; list.forEach((c, n) => { if (nbr[n].some(j => !set.has(j))) { dd[n] = 1; q.push(n); } });
        for (let h = 0; h < q.length; h++) { const n = q[h]; for (const j of nbr[n]) { const m = idx.get(j); if (m !== undefined && dd[m] < 0) { dd[m] = dd[n] + 1; q.push(m); } } }
        const dm = Math.max(1, ...dd);
        list.forEach((c, n) => { elev[c] = Math.max(2, val[n] - 25 * Math.sqrt(Math.max(0, dd[n]) / dm)); }); } }
    // ---------- 海岸地貌（按成因）：岬湾、峡湾、溺谷、沙坝潟湖 ----------
    progress('海岸地貌', 0.52);
    { const N0 = W * H, nb4 = (i, k) => { const y = (i / W) | 0, x = i - y * W; if (k === 0) return y * W + (x + 1) % W; if (k === 1) return y * W + (x - 1 + W) % W; if (k === 2) return y > 0 ? i - W : -1; return y < H - 1 ? i + W : -1; };
      const bfs = (src, pass, maxD) => { const d = new Uint8Array(N0).fill(255), q = new Int32Array(N0); let h = 0, t = 0; for (let i = 0; i < N0; i++) if (src(i)) { d[i] = 0; q[t++] = i; }
        while (h < t) { const i = q[h++]; if (d[i] >= maxD) continue; for (let k = 0; k < 4; k++) { const j = nb4(i, k); if (j >= 0 && d[j] === 255 && pass(j)) { d[j] = d[i] + 1; q[t++] = j; } } } return d; };
      const latOf = y => 90 - (y + 0.5) / H * 180, cm = [0.55, 1, 1.8][cfg.coast];
      const s3a = simplex3(cfg.seed + 7001), s3b = simplex3(cfg.seed + 7002), rc = mulberry32(cfg.seed + 7003), k2 = W / (2 * Math.PI);
      // 球面三维噪声（经度无缝），频率以“每格”为单位
      const sph = (S, x, y, f, o) => { const yy = Math.min(H - 1, Math.max(0, y | 0)), xx = ((x | 0) % W + W) % W, c = F.cosLat[yy], sc = f * k2; return S(c * F.cosLon[xx] * sc + o, c * F.sinLon[xx] * sc, F.sinLat[yy] * sc); };
      const nC = (x, y, f, o = 0) => sph(s3a, x, y, f, o), nC2 = (x, y, f, o = 0) => sph(s3b, x, y, f, o);
      let dSea = bfs(i => elev[i] <= 0, i => elev[i] > 0, 30), dLand = bfs(i => elev[i] > 0, i => elev[i] <= 0, 8);
      // 1) 岬角与海湾：沿岸岩性软硬交替（低频噪声），软岩后退成湾、硬岩突出成岬；只改变近岸低地与浅海
      const amp = [16, 30, 48][cfg.coast];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x, dl = dSea[i], ds = dLand[i];
        if (!(elev[i] > 0 ? dl <= 4 : ds <= 3)) continue; const d = elev[i] > 0 ? dl : ds;
        const n = nC(x, y, 0.06) * 0.55 + nC(x, y, 0.17, 40) * 0.3 + nC2(x, y, 0.45) * 0.15;
        elev[i] += amp * n * (1 - d / 5); }
      dSea = bfs(i => elev[i] <= 0, i => elev[i] > 0, 30);
      // 沿最陡下降走到海，返回路径（未入海则 null）
      const descend = (s, maxLen) => { const path = [s]; let c = s; for (let k = 0; k < maxLen; k++) { let best = -1, bv = elev[c]; const y = (c / W) | 0, x = c - y * W;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const yy = y + dy; if (yy < 0 || yy >= H) continue; const j = yy * W + ((x + dx) % W + W) % W; if (elev[j] < bv) { bv = elev[j]; best = j; } }
          if (best < 0) return null; path.push(best); c = best; if (elev[c] <= 0) return path; } return null; };
      const carved = [], spaced = (c, r) => { const y = (c / W) | 0, x = c - y * W; return carved.every(o => { const oy = (o / W) | 0; let dx = Math.abs(o - oy * W - x); dx = Math.min(dx, W - dx); return Math.hypot(dx, oy - y) >= r; }); };
      // 下切成楔形湾：湾口宽、向内收窄变浅（宽度以格计），横剖面呈 U / V 形
      const carve = (path, inland, deep, shallow, r0, r1) => { const n = Math.min(path.length - 1, inland);
        for (let k = 0; k < n; k++) { const c = path[path.length - 2 - k], f = k / Math.max(1, n - 1), r = r0 * (1 - f) + r1 * f, cy = (c / W) | 0, cx = c - cy * W, R = Math.ceil(r);
          for (let dy = -R; dy <= R; dy++) { const yy = cy + dy; if (yy < 0 || yy >= H) continue; for (let dx = -R; dx <= R; dx++) { const d = Math.hypot(dx, dy); if (d > r) continue; const j = yy * W + ((cx + dx) % W + W) % W;
            const target = -(shallow + (deep - shallow) * (1 - f)) * (1 - 0.75 * (d / r) * (d / r)); if (target < elev[j]) elev[j] = target; } } }
        carved.push(path[path.length - 1]); };
      // 2) 峡湾：高纬（|纬度| > 48°）山地海岸，冰川沿谷下切到海平面以下，形成又深又长的窄湾
      // 3) 溺谷（里亚斯式）：中纬丘陵海岸，河谷下段被海水淹没
      for (let y = 2; y < H - 2; y++) { const la = Math.abs(latOf(y)); for (let x = 0; x < W; x++) { const i = y * W + x, d = dSea[i]; if (elev[i] <= 0) continue;
        if (la > 48 && la < 78 && d >= 8 && d <= 22 && elev[i] > 450) { if (rc() > 0.012 * cm || !spaced(i, 5)) continue; const p = descend(i, 60); if (p && p.length > 6) carve(p, 26, 320, 25, 1.6, 0.7); }
        else if (la > 18 && la < 52 && d >= 4 && d <= 10 && elev[i] > 110 && elev[i] < 1300) { if (rc() > 0.006 * cm || !spaced(i, 4)) continue; const p = descend(i, 30); if (p && p.length > 4) carve(p, 9, 70, 6, 2.2, 0.8); } } }
      // （沙坝岛与潟湖远小于一个格子，不在格网上硬造，以免沿岸出现一排方齿）
      void dSea; }
    // 近岸陆架：紧邻陆地的海格水深与相邻陆地高度相当（上限 60 m），第二圈不超过 120 m。
    // 这样海陆零线落在两格之间（不贴着陆地格边走出台阶），等高线、分层设色、河口与港口共用同一连续地表。
    { const ring = new Uint8Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (elev[i] > 0) continue; let sum = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const v = elev[yy * W + ((x + dx) % W + W) % W]; if (v > 0) { sum += v; n++; } } }
        if (n) { ring[i] = 1; elev[i] = -Math.min(-elev[i], Math.max(2, Math.min(60, sum / n))); } }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (elev[i] > 0 || ring[i]) continue; let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) if (ring[yy * W + ((x + dx) % W + W) % W]) { near = true; break; } }
        if (near) elev[i] = -Math.min(-elev[i], 120); } }
    // 高山略作压缩，避免极端值
    let maxE = 0, minE = 0;
    for (let i = 0; i < elev.length; i++) { const e = elev[i]; if (e > 5500) elev[i] = 5500 + (e - 5500) * 0.35; else if (e < -7000) elev[i] = -7000 + (e + 7000) * 0.4; if (elev[i] > maxE) maxE = elev[i]; if (elev[i] < minE) minE = elev[i]; }

    // 板块信息
    const plates = [];
    for (let p = 0; p < P; p++) plates.push({ id: p, n: 0, cont: 0, sx: 0, sy: 0, sz: 0, speed: 0 });
    for (let y = 0; y < cH; y++) for (let x = 0; x < cW; x++) {
      const i = y * cW + x, p = plates[plate[i]], w = C.cosLat[y];
      const a = [C.cosLat[y] * C.cosLon[x], C.cosLat[y] * C.sinLon[x], C.sinLat[y]];
      p.n += w; p.cont += crust[i] > 0.5 ? w : 0; p.sx += a[0] * w; p.sy += a[1] * w; p.sz += a[2] * w;
    }
    for (const p of plates) {
      const l = Math.hypot(p.sx, p.sy, p.sz) || 1; const c = [p.sx / l, p.sy / l, p.sz / l];
      p.lat = Math.asin(c[2]) / D2R; p.lon = Math.atan2(c[1], c[0]) / D2R;
      const v = vel(p.id, ...c);
      // 速度投影到当地东/北
      const east = [-Math.sin(p.lon * D2R), Math.cos(p.lon * D2R), 0];
      const north = [-Math.sin(p.lat * D2R) * Math.cos(p.lon * D2R), -Math.sin(p.lat * D2R) * Math.sin(p.lon * D2R), Math.cos(p.lat * D2R)];
      p.ve = v[0] * east[0] + v[1] * east[1] + v[2] * east[2];
      p.vn = v[0] * north[0] + v[1] * north[1] + v[2] * north[2];
      p.speed = Math.hypot(p.ve, p.vn) * 6.5; // cm/年
      p.continental = p.cont / p.n > 0.4;
      p.area = p.n;
    }
    // 边界线段（粗网格格边），按类型分组
    const bSegs = [[], [], []]; // 0 汇聚 1 离散 2 转换
    const bMarks = [];
    const f = W / cW;
    for (let y = 0; y < cH; y++) for (let x = 0; x < cW; x++) {
      const i = y * cW + x;
      const r = y * cW + (x + 1) % cW, d = y < cH - 1 ? i + cW : -1;
      for (const j of [r, d]) {
        if (j < 0 || plate[j] === plate[i]) continue;
        const conv = (bConv[i] + (bOther[j] === i ? bConv[j] : bConv[i])) / 2;
        const t = conv > 0.12 ? 0 : conv < -0.12 ? 1 : 2;
        if (j === r) { if (x === cW - 1) continue; bSegs[t].push((x + 1) * f, y * f, (x + 1) * f, (y + 1) * f); }
        else bSegs[t].push(x * f, (y + 1) * f, (x + 1) * f, (y + 1) * f);
        if (((x * 7 + y * 13) % 23) === 0) {
          const a = cellXYZ(i), b = cellXYZ(j);
          // 记录方向（指向 j 一侧），用于绘制齿/箭头
          bMarks.push((x + (j === r ? 1 : 0.5)) * f, (y + (j === r ? 0.5 : 1)) * f, j === r ? 1 : 0, j === r ? 0 : 1, t, conv);
          void a; void b;
        }
      }
    }

    return {
      W, H, F, C, cW, cH, elev, plate, crust, coreOf, cores, plates, polar, newWorld,
      bSegs: bSegs.map(a => Float32Array.from(a)), bMarks: Float32Array.from(bMarks),
      volcanoes: volcanoes.map(i => [((i % cW) + 0.5) * f, (((i / cW) | 0) + 0.5) * f]),
      maxE, minE, upsample, downsample
    };
  }

  // 水滴侵蚀：高度换算到无量纲单位后运算
  function erode(elev, W, H, count, rnd, onP) {
    const S = 1 / 40000;
    const h = new Float32Array(elev.length);
    for (let i = 0; i < h.length; i++) h[i] = elev[i] * S;
    const R = 2, offs = [], wts = []; let ws = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const d = Math.hypot(dx, dy); if (d < R + 0.01) { offs.push(dx, dy); const w = Math.max(0.01, 1 - d / (R + 0.5)); wts.push(w); ws += w; } }
    for (let k = 0; k < wts.length; k++) wts[k] /= ws;
    const nb = wts.length;
    const inertia = 0.12, capF = 5, minCap = 0.002, eSpeed = 0.3, dSpeed = 0.3, evap = 0.02, grav = 4, life = 48;
    for (let d = 0; d < count; d++) {
      if ((d & 32767) === 0 && onP) onP(d / count);
      let px = 0, py = 0, tries = 0;
      do { px = rnd() * W; py = 2 + rnd() * (H - 4); tries++; } while (h[(py | 0) * W + (px | 0)] <= 0 && tries < 6);
      if (h[(py | 0) * W + (px | 0)] <= 0) continue;
      let dx = 0, dy = 0, sp = 1, wat = 1, sed = 0;
      for (let l = 0; l < life; l++) {
        const xi = px | 0, yi = py | 0, cx = px - xi, cy = py - yi;
        const x1 = xi + 1 === W ? 0 : xi + 1;
        const i00 = yi * W + xi, i10 = yi * W + x1, i01 = i00 + W, i11 = i10 + W;
        const a = h[i00], b = h[i10], c = h[i01], e = h[i11];
        const gx = (b - a) * (1 - cy) + (e - c) * cy, gy = (c - a) * (1 - cx) + (e - b) * cx;
        const ht = a * (1 - cx) * (1 - cy) + b * cx * (1 - cy) + c * (1 - cx) * cy + e * cx * cy;
        dx = dx * inertia - gx * (1 - inertia); dy = dy * inertia - gy * (1 - inertia);
        const len = Math.hypot(dx, dy); if (len < 1e-12) break;
        dx /= len; dy /= len;
        px += dx; py += dy;
        if (px < 0) px += W; else if (px >= W) px -= W;
        if (py < 1 || py >= H - 2) break;
        const nx = px | 0, ny = py | 0, ncx = px - nx, ncy = py - ny, nx1 = nx + 1 === W ? 0 : nx + 1;
        const j00 = ny * W + nx, j10 = ny * W + nx1;
        const nh = h[j00] * (1 - ncx) * (1 - ncy) + h[j10] * ncx * (1 - ncy) + h[j00 + W] * (1 - ncx) * ncy + h[j10 + W] * ncx * ncy;
        const dh = nh - ht;
        if (nh < 0) { // 入海：泥沙沉在海里（陆架与河口前缘），不在岸上堆成小山包；沉积不高出海平面
          const dep = sed * 0.5, lim = -2 * S, ws = [(1 - ncx) * (1 - ncy), ncx * (1 - ncy), (1 - ncx) * ncy, ncx * ncy], js = [j00, j10, j00 + W, j10 + W];
          for (let k = 0; k < 4; k++) if (h[js[k]] < lim) h[js[k]] = Math.min(lim, h[js[k]] + dep * ws[k]);
          break;
        }
        const cap = Math.max(-dh * sp * wat * capF, minCap);
        if (sed > cap || dh > 0) {
          const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * dSpeed;
          sed -= amt;
          h[i00] += amt * (1 - cx) * (1 - cy); h[i10] += amt * cx * (1 - cy); h[i01] += amt * (1 - cx) * cy; h[i11] += amt * cx * cy;
        } else {
          const amt = Math.min((cap - sed) * eSpeed, -dh);
          for (let k = 0; k < nb; k++) {
            let bx = xi + offs[2 * k]; const by = yi + offs[2 * k + 1];
            if (by < 0 || by >= H) continue;
            if (bx < 0) bx += W; else if (bx >= W) bx -= W;
            const v = amt * wts[k]; h[by * W + bx] -= v; sed += v;
          }
        }
        sp = Math.sqrt(Math.max(0, sp * sp - dh * grav));
        wat *= 1 - evap;
      }
    }
    for (let i = 0; i < h.length; i++) elev[i] = h[i] / S;
  }

  G.Planet = { build, grid, upsample, downsample };
})(typeof self !== 'undefined' ? self : this);
