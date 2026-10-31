/* 人文推演 —— 按用户生成器（world_atlas 1.4.0.dev164）的社会管线移植，在半分辨率网格上运行。
 * 顺序：自然承载人口 → 文明发源地与范围 → 语言 → 早期交通骨架 → 信仰 → 城市（配额+缺口审计）
 *      → 道路网重建与海运 → 国家（文明配额、无国家边疆、城市腹地控制区、自然分隔、区块图扩张、边界整定）
 *      → 省份 → 名义宣称与实际治理 → 边塞与商镇 → 文化库命名。 */
(function (G) {
  'use strict';
  const { mulberry32, simplex2 } = G.Noise;
  const D2R = Math.PI / 180;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // 与原版一致的八邻接顺序；反方向 = 7 - d
  const DY = [-1, -1, -1, 0, 0, 1, 1, 1], DX = [-1, 0, 1, -1, 1, -1, 0, 1], DL = [Math.SQRT2, 1, Math.SQRT2, 1, 1, Math.SQRT2, 1, Math.SQRT2];
  const FRONT_PEERS = { 1: [[5, 1, -1], [7, 1, 1]], 3: [[2, -1, 1], [7, 1, 1]], 4: [[0, -1, -1], [5, 1, -1]], 6: [[0, -1, -1], [2, -1, 1]] };
  // 时代：行政响应与交通速度（km/日），取自 governance.ADMINISTRATION_ERAS
  const ADMIN = {
    preindustrial: { label: '前工业时代', response: 80, walk: 24, road: 90, river: 80, sea: 160, rail: 0 },
    industrial: { label: '工业时代', response: 18, walk: 28, road: 140, river: 150, sea: 300, rail: 400 }
  };
  const YIELD = { preindustrial: 1.2, industrial: 4.8 };
  const ROAD_NEIGHBORS = [1, 2, 3];
  const KM_REF = 10; // 原版原生格距的参考公里数，用于把“格内代价”换算到本网格

  // ---------- 小顶堆（Float64，避免平台精度导致的重复松弛） ----------
  function Heap(cap) { this.k = new Int32Array(cap); this.v = new Float64Array(cap); this.n = 0; }
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

  function run(P, Cl, Hy, cfg, progress) {
    const rnd = mulberry32(cfg.seed + 3030);
    const W = P.W / 2, H = P.H / 2, N = W * H, FW = P.W;
    const R = cfg.radius, cellKm = 2 * Math.PI * R / W;
    const era = cfg.era === 2 ? 'industrial' : 'preindustrial', AD = ADMIN[era];
    const lat = new Float32Array(H), cosL = new Float32Array(H), area = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      lat[y] = 90 - (y + 0.5) / H * 180; cosL[y] = Math.max(0.02, Math.cos(lat[y] * D2R));
      const a = (90 - y / H * 180) * D2R, b = (90 - (y + 1) / H * 180) * D2R;
      area[y] = R * R * (2 * Math.PI / W) * Math.abs(Math.sin(a) - Math.sin(b));
    }
    const kmScale = KM_REF / cellKm; // 原版代价预算 × kmScale = 本网格代价预算
    const nb = (i, d) => { const y = (i / W) | 0, yy = y + DY[d]; if (yy < 0 || yy >= H) return -1; let xx = i - y * W + DX[d]; if (xx < 0) xx += W; else if (xx >= W) xx -= W; return yy * W + xx; };
    const NB = new Int32Array(N * 8);
    for (let i = 0; i < N; i++) for (let d = 0; d < 8; d++) NB[i * 8 + d] = nb(i, d);
    const gdist = (a, b) => { // 格距（环绕）
      const ya = (a / W) | 0, yb = (b / W) | 0; let dx = Math.abs(a - ya * W - (b - yb * W)); dx = Math.min(dx, W - dx); return Math.hypot(dx, ya - yb);
    };
    const gcKm = (a, b) => {
      const ya = (a / W) | 0, xa = a - ya * W, yb = (b / W) | 0, xb = b - yb * W;
      const la1 = lat[ya] * D2R, la2 = lat[yb] * D2R, dl = (xb - xa) / W * 2 * Math.PI;
      const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dl / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    };
    const toFull = i => { const y = (i / W) | 0, x = i - y * W; return [(x + 0.5) * 2, (y + 0.5) * 2]; };
    const n2 = simplex2(cfg.seed + 9191);

    // ================= 0. 自然场 =================
    progress('人文 · 自然地理', 0.865);
    const land = new Uint8Array(N), sea = new Uint8Array(N), lake = new Uint8Array(N), ice = new Uint8Array(N);
    const e = new Float32Array(N), eN = new Float32Array(N), T = new Float32Array(N), Pr = new Float32Array(N), q = new Float32Array(N);
    const kop = new Uint8Array(N), biome = new Uint8Array(N), seaIce = new Uint8Array(N);
    const PE = P.elev, HQ = Hy.q, HL = Hy.lake, CTa = Cl.Tann, CP = Cl.Pann, CS = Cl.snow;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, f = (2 * y) * FW + 2 * x;
      let lc = 0, es = 0, ts = 0, ps = 0, qm = 0, lk = 0, ic = 0;
      for (let k = 0; k < 4; k++) { const j = f + (k & 1) + (k >> 1) * FW; const h = PE[j]; if (h > 0) { lc++; es += h; const qq = HQ[j]; if (qq > qm && !HL[j]) qm = qq; } ts += CTa[j]; ps += CP[j]; lk += HL[j]; const sn = CS[j]; if (sn === 2) ic++; else if (sn === 4) seaIce[i] = 1; }
      lake[i] = lk >= 2 ? 1 : 0;
      land[i] = lc >= 2 && !lake[i] ? 1 : 0;
      sea[i] = !land[i] && !lake[i] ? 1 : 0;
      ice[i] = land[i] && ic >= 2 ? 1 : 0;
      e[i] = lc ? es / lc : 0; eN[i] = land[i] ? clamp(e[i] / 6500, 0, 1) : 0;
      T[i] = ts / 4; Pr[i] = ps / 4; q[i] = qm;
      const kk = Cl.koppen[f + FW + 1] !== 255 ? f + FW + 1 : f;
      kop[i] = Cl.koppen[kk]; biome[i] = Cl.biome[kk];
    }
    const qth = Hy.qth;
    const order = new Uint8Array(N); // 河流等级（地图尺度）
    for (let i = 0; i < N; i++) if (land[i] && q[i] >= qth) order[i] = q[i] >= qth * 120 ? 4 : q[i] >= qth * 25 ? 3 : q[i] >= qth * 5 ? 2 : 1;
    // 汇流口：上游有两个以上不同河流格汇入
    const incoming = new Uint8Array(N);
    { const fw = FW, seen = new Map();
      for (let j = 0; j < P.W * P.H; j++) {
        if (Hy.q[j] < qth || P.elev[j] <= 0) continue; const d = Hy.down[j]; if (d < 0) continue;
        const a = ((((j / fw) | 0) >> 1) * W) + ((j % fw) >> 1), b = ((((d / fw) | 0) >> 1) * W) + ((d % fw) >> 1);
        if (a === b) continue; const key = b * 8 + (a % 8); if (seen.has(key)) continue; seen.set(key, 1); if (incoming[b] < 255) incoming[b]++;
      } }
    const annualN = new Float32Array(N); for (let i = 0; i < N; i++) annualN[i] = Pr[i] / 2500;
    // 坡度（相对，原版量纲：归一化高程/格）
    const slopeN = new Float32Array(N);
    for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (!land[i]) continue;
      const gx = (eN[NB[i * 8 + 4]] - eN[NB[i * 8 + 3]]) / 2, gy = (eN[NB[i * 8 + 6]] - eN[NB[i * 8 + 1]]) / 2;
      slopeN[i] = Math.hypot(gx / Math.max(0.2, cosL[y]), gy) * (KM_REF / cellKm) * 3.5;
    }
    // 海岸 / 湖岸
    const oceanCoast = new Uint8Array(N), lakeCoast = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (land[i]) for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j < 0) continue; if (sea[j]) oceanCoast[i] = 1; if (lake[j]) lakeCoast[i] = 1; }
    // 距海（格）
    const coastSea = new Uint8Array(N); for (let i = 0; i < N; i++) if (sea[i]) for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j >= 0 && land[j]) { coastSea[i] = 1; break; } }
    const dCoast = bfsDist(i => coastSea[i], () => true);
    function bfsDist(isSrc, pass, limit = 1e9) {
      const dist = new Float32Array(N).fill(1e9), qq = new Int32Array(N); let h = 0, t = 0;
      for (let i = 0; i < N; i++) if (isSrc(i)) { dist[i] = 0; qq[t++] = i; }
      while (h < t) { const i = qq[h++]; if (dist[i] >= limit) continue; for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j >= 0 && dist[j] > dist[i] + 1 && pass(j)) { dist[j] = dist[i] + 1; qq[t++] = j; } } }
      return dist;
    }
    function proximity(mask, r) { // 出租车距离接近度 1 - d/(r+1)
      const d = bfsDist(i => mask[i], () => true, r + 1), out = new Float32Array(N);
      for (let i = 0; i < N; i++) out[i] = d[i] <= r ? 1 - d[i] / (r + 1) : 0;
      return out;
    }
    // 宜居度 / 土地潜力
    const pot = new Float32Array(N), hab = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (!land[i] || ice[i]) continue;
      const riv = order[i] ? Math.min(1, 0.45 + 0.15 * order[i]) : 0;
      const ft = smoothstep(-1, 12, T[i]) * (1 - 0.3 * smoothstep(27, 33, T[i]));
      let fw = smoothstep(120, 750, Pr[i]) * (1 - 0.4 * smoothstep(2600, 5000, Pr[i])); if (riv) fw = Math.max(fw, 0.5 + 0.35 * riv);
      const fs = 1 - smoothstep(0.03, 0.14, slopeN[i]), fe = 1 - smoothstep(0.42, 0.72, eN[i]);
      const k = kop[i], soil = k === 0 ? 0.6 : k >= 20 ? 0.2 : 1;
      pot[i] = ft * fw * fs * fe * soil;
      const comfort = smoothstep(-6, 8, T[i]) * (1 - smoothstep(27, 33, T[i]));
      hab[i] = clamp(0.55 * pot[i] + 0.15 * oceanCoast[i] + 0.12 * riv + 0.18 * comfort * (0.4 + 0.6 * fs) * smoothstep(60, 300, Pr[i] + (riv ? 400 : 0)), 0, 1);
    }
    // 新大陆
    const newW = new Uint8Array(N);
    if (P.newWorld) { const cf = P.cW / W; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = P.cores[P.coreOf[Math.min(P.cH - 1, (y * cf) | 0) * P.cW + Math.min(P.cW - 1, (x * cf) | 0)]]; if (c && c.isNew) newW[y * W + x] = 1; } }
    // 国家可建立的陆地（无冰盖）
    const domain = new Uint8Array(N); for (let i = 0; i < N; i++) domain[i] = land[i] && !ice[i] ? 1 : 0;
    // 陆块
    const landComp = components(domain);
    function components(mask, four) {
      const lab = new Int32Array(N).fill(0); let id = 0; const st = new Int32Array(N);
      for (let s = 0; s < N; s++) { if (!mask[s] || lab[s]) continue; id++; let t = 0; st[t++] = s; lab[s] = id;
        while (t) { const i = st[--t]; for (let d = 0; d < 8; d++) { if (four && (d === 0 || d === 2 || d === 5 || d === 7)) continue; const j = NB[i * 8 + d]; if (j >= 0 && mask[j] && !lab[j]) { lab[j] = id; st[t++] = j; } } } }
      lab.count = id; return lab;
    }

    // ================= 1. 自然承载人口（粮食当量模型） =================
    progress('人文 · 承载人口', 0.87);
    const yearEarthDays = cfg.yearDays * cfg.day / 24;
    const idealDensity = YIELD[era] * 100 * 1000 * 3340 * 0.25 * 0.5 / (2100 * yearEarthDays); // 人/km²·单位潜力面积
    const support = new Float64Array(N);
    let total = 0;
    for (let i = 0; i < N; i++) {
      if (!domain[i] || hab[i] <= 0) continue;
      const y = (i / W) | 0, a = area[y], res = Math.pow(hab[i], 1.1);
      let s = Math.pow(pot[i], 1.55) * res * a;
      // 非农生计：采集、游牧、海岸（取最大值，不叠加）
      const b = biome[i];
      const forag = (b === 2 || b === 4 || b === 5 || b === 10 || b === 11 || b === 1) ? 0.6 + 0.4 * smoothstep(300, 1500, Pr[i]) : 0.3;
      // 游牧承载：半干旱草原（BS）与温带草原最宜放牧；湿润的稀树草原多为农牧兼营；真正的荒漠（BW）只能稀疏放牧
      const kk = kop[i], past = (kk === 5 || kk === 6) ? 1 : b === 3 ? 0.85 : b === 6 ? 0.5 : kk === 2 ? 0.45 : kk === 4 ? 0.22 : kk === 3 ? 0.12 : 0.1;
      const coastal = oceanCoast[i] ? (seaIce[i] ? 0.4 : 1) : 0;
      for (const [o, dens] of [[forag, 0.06], [past, 0.22], [coastal, 0.18]]) s = Math.max(s, o * dens / idealDensity * res * a);
      if (newW[i]) s *= 0.18 + 0.32 * pot[i] * hab[i];
      support[i] = s; total += s;
    }
    const ERA_RANGE = [[1e8, 1.6e8], [2.5e8, 4e8], [6.5e8, 9.5e8]][cfg.popIdx !== undefined ? cfg.popIdx : cfg.era]; // 人口规模（与文明时代分开）
    let popMin, popMax;
    const capMin = Math.floor(total * idealDensity * 0.75), capMax = Math.ceil(total * idealDensity * 1.25);
    if (cfg.popMode === 'range' && cfg.popRange) { popMin = cfg.popRange[0]; popMax = Math.min(cfg.popRange[1], capMax); popMin = Math.min(popMin, popMax); }
    else if (capMax > ERA_RANGE[1]) { popMax = ERA_RANGE[1]; popMin = Math.floor(capMin * ERA_RANGE[1] / capMax); }
    else { popMin = capMin; popMax = capMax; }
    const popTotal = (popMin + popMax) / 2;
    const weight = new Float32Array(N), density = new Float32Array(N);
    let wmax = 0;
    for (let i = 0; i < N; i++) { weight[i] = total > 0 ? support[i] / total : 0; density[i] = weight[i] * popTotal / area[(i / W) | 0]; if (weight[i] > wmax) wmax = weight[i]; }
    const popRel = new Float32Array(N); for (let i = 0; i < N; i++) popRel[i] = weight[i] / wmax;
    let meanDensity = 0, domArea = 0; for (let i = 0; i < N; i++) if (domain[i]) { const a = area[(i / W) | 0]; meanDensity += density[i] * a; domArea += a; } meanDensity /= Math.max(1, domArea);
    const posPop = []; for (let i = 0; i < N; i++) if (popRel[i] > 0) posPop.push(popRel[i]); posPop.sort((a, b) => a - b);
    const popFloor = posPop.length ? posPop[Math.floor(posPop.length * 0.22)] : 0;
    // 城镇最低供养（500 人）
    const supportsTown = (i) => { let s = 0; const y = (i / W) | 0, x = i - y * W; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; s += weight[yy * W + ((x + dx + W) % W)]; } return s * popMax * 0.25 >= 500; };

    // ================= 2. 物理过渡代价（山脊 / 陡坎 / 大河两岸） =================
    progress('人文 · 自然分隔', 0.875);
    const phys = new Float32Array(8 * N);
    for (let i = 0; i < N; i++) {
      if (!land[i]) continue;
      const h = eN[i], oi = order[i];
      for (let d = 0; d < 8; d++) {
        const j = NB[i * 8 + d]; if (j < 0 || !land[j]) continue;
        const ht = eN[j], relief = Math.abs(ht - h), ridge = Math.max(ht, h);
        let crest = 0;
        for (let s = 1; s <= 2; s++) {
          let b = i, a = j; let ok = true;
          for (let k = 0; k < s && ok; k++) { b = NB[b * 8 + (7 - d)]; if (b < 0 || !land[b]) ok = false; }
          for (let k = 0; k < s && ok; k++) { a = NB[a * 8 + d]; if (a < 0 || !land[a]) ok = false; }
          if (!ok) continue;
          const sup = Math.min(h - eN[b], ht - eN[a]); if (sup > 0) crest = Math.max(crest, sup / s);
        }
        const oj = order[j], bank = (oi >= 3) !== (oj >= 3), sec = (oi >= 2) !== (oj >= 2), rs = Math.max(oi, oj);
        phys[d * N + i] = 34 * Math.pow(relief * 3, 1.2) + 52 * crest * 3 * (1 + 2 * clamp(ridge - 0.4, 0, 0.6)) + (bank ? 5 + 2.8 * clamp(rs - 2, 0, 3) : 0) + (sec ? 1.8 : 0);
      }
    }
    const civFriction = new Float32Array(N);
    for (let i = 0; i < N; i++) civFriction[i] = land[i] ? Math.max(0.25, 1 + 6.2 * eN[i] * eN[i] + 2.6 * (1 - pot[i]) + 3.8 * (1 - hab[i]) + 4.2 * slopeN[i]) : 0;

    // ================= 通用：连续前沿领土扩张（原版 simulate_territories） =================
    function territory(seeds, o) {
      const valid = o.valid, fr = o.friction, tr = o.trans, road = o.road, oc = o.owner || null, maxC = o.max || Infinity;
      const labels = new Int32Array(N).fill(0), cost = new Float64Array(N).fill(Infinity), acc = new Uint8Array(N);
      const hp = new Heap(N);
      const seedAt = new Map();
      seeds.forEach((s, k) => { if (cost[s.cell] === 0) return; labels[s.cell] = k + 1; cost[s.cell] = 0; seedAt.set(s.cell, k + 1); hp.push(s.cell, 0); });
      const frx = (i) => road ? fr[i] * (1 - 0.15 * road[i]) : fr[i];
      while (hp.n) {
        const i = hp.pop(), c = hp.top;
        if (acc[i] || c !== cost[i]) continue;
        acc[i] = 1;
        const lb = labels[i], sd = seeds[lb - 1], dom = sd.domain || 0, sm = sd.steppe && o.steppeMul ? o.steppeMul : null;
        const str = (sd.strength || 1) / (sm ? sm[i] : 1); // 草原文明：在草原上推进快，进入森林与农耕区较慢（允许溢出，离开草原的政权在历史推演中会定居）
        const fi = frx(i);
        for (let d = 0; d < 8; d++) {
          const j = NB[i * 8 + d]; if (j < 0 || acc[j] || !valid[j]) continue;
          const fs = seedAt.get(j); if (fs !== undefined && fs !== lb) continue;
          if (oc) { const req = oc[j]; if (req > 0 && req !== dom) continue; }
          const strJ = sm ? (sd.strength || 1) / (0.5 * (sm[i] + sm[j])) : str;
          const edge = 0.5 * (fi + frx(j)) / strJ + (tr ? tr[d * N + i] : 0);
          let nc = c + edge * DL[d];
          const peers = FRONT_PEERS[d];
          if (peers) { // 三角前沿连续到达时间
            for (const [pd, dy, dx] of peers) {
              const yj = (j / W) | 0, py = yj + dy; if (py < 0 || py >= H) continue;
              let px = j - yj * W + dx; if (px < 0) px += W; else if (px >= W) px -= W;
              const p = py * W + px; if (!acc[p] || labels[p] !== lb) continue;
              const diff = c - cost[p];
              const cross = tr ? tr[(7 - pd) * N + p] : 0;
              const slow = Math.max(edge, 0.5 * (frx(p) + frx(j)) / strJ + cross);
              if (diff < 0 || diff >= slow / Math.SQRT2) continue;
              const cand = c + Math.sqrt(slow * slow - diff * diff); if (cand < nc) nc = cand;
            }
          }
          if (nc > maxC) continue;
          if (nc < cost[j] - 1e-12 || (Math.abs(nc - cost[j]) <= 1e-12 && lb < labels[j])) { cost[j] = nc; labels[j] = lb; hp.push(j, nc); }
        }
      }
      return { labels, cost };
    }
    function spacedSelect(order, count, minDist, occupied) {
      const out = [], BS = Math.max(4, Math.ceil(minDist)), grid = new Map();
      const key = (x, y) => Math.floor(y / BS) * 100000 + Math.floor(x / BS);
      const add = (i) => { const y = (i / W) | 0, x = i - y * W, k = key(x, y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); };
      for (const i of occupied) add(i);
      const rc = Math.ceil(minDist / BS) + 1;
      for (const i of order) {
        if (out.length >= count) break;
        const y = (i / W) | 0, x = i - y * W; let ok = true;
        for (let by = -rc; by <= rc && ok; by++) for (let bx = -rc; bx <= rc && ok; bx++) {
          const L = grid.get(key(((x + bx * BS) % W + W) % W, y + by * BS)); if (!L) continue;
          for (const o of L) if (gdist(o, i) < minDist) { ok = false; break; }
        }
        if (!ok) continue; out.push(i); occupied.push(i); add(i);
      }
      return out;
    }
    const byScore = (mask, score) => { const a = []; for (let i = 0; i < N; i++) if (mask[i] && isFinite(score[i])) a.push(i); a.sort((p, q2) => score[q2] - score[p] || p - q2); return a; };

    // ================= 3. 文明发源地与范围 =================
    progress('人文 · 文明发源地', 0.88);
    const urbanPhysical = new Uint8Array(N);
    for (let i = 0; i < N; i++) urbanPhysical[i] = domain[i] && eN[i] < 0.72 && slopeN[i] < 0.105 ? 1 : 0;
    const civScore = new Float32Array(N);
    for (let i = 0; i < N; i++) civScore[i] = domain[i] ? 0.5 * popRel[i] + 0.25 * pot[i] + 0.15 * hab[i] + 0.1 * (order[i] ? 1 : 0) + 0.04 * n2((i % W) * 0.2, ((i / W) | 0) * 0.2) : -Infinity;
    const buildable = new Uint8Array(N);
    for (let i = 0; i < N; i++) buildable[i] = urbanPhysical[i] && popRel[i] >= popFloor * 0.6 ? 1 : 0;
    let nBuild = 0; for (let i = 0; i < N; i++) nBuild += buildable[i];
    const civTarget = Math.max(1, Math.min(cfg.cultures, nBuild));
    // 按陆块人口分配发源地配额（每个有足够人口的陆块至少一个）
    const compPop = new Float64Array(landComp.count + 1);
    for (let i = 0; i < N; i++) if (landComp[i]) compPop[landComp[i]] += weight[i];
    const compOrder = [...compPop.keys()].filter(k => k > 0 && compPop[k] > 0.004).sort((a, b) => compPop[b] - compPop[a]);
    const compQuota = new Map(); let left = civTarget;
    for (const k of compOrder) if (left > 0) { compQuota.set(k, 1); left--; }
    while (left > 0 && compOrder.length) { let best = compOrder[0], bv = -1; for (const k of compOrder) { const v = compPop[k] / (compQuota.get(k) + 1); if (v > bv) { bv = v; best = k; } } compQuota.set(best, compQuota.get(best) + 1); left--; }
    let validCount = 0; for (let i = 0; i < N; i++) validCount += domain[i];
    const civOrder = byScore(buildable, civScore);
    const hearthCells = [], occH = [];
    const minHD = Math.max(1, Math.sqrt(validCount / civTarget) * 0.45);
    for (const [k, qn] of compQuota) spacedSelect(civOrder.filter(i => landComp[i] === k), qn, minHD, occH).forEach(i => hearthCells.push(i));
    const civSeeds = hearthCells.map((c, k) => ({ cell: c, strength: 0.88 + 0.2 * civScore[c], primary: true }));
    let CV = territory(civSeeds, { valid: domain, friction: civFriction, trans: phys });
    // 未被触及的有人口陆块：独立地方文化
    { const unreached = new Uint8Array(N); for (let i = 0; i < N; i++) unreached[i] = domain[i] && !CV.labels[i] && weight[i] > 0 ? 1 : 0;
      const comp = components(unreached), best = new Map();
      for (let i = 0; i < N; i++) if (comp[i]) { const b = best.get(comp[i]); if (b === undefined || civScore[i] > civScore[b]) best.set(comp[i], i); }
      const cpop = new Float64Array(comp.count + 1); for (let i = 0; i < N; i++) if (comp[i]) cpop[comp[i]] += weight[i];
      let added = 0;
      let sizeC = new Int32Array(comp.count + 1); for (let i = 0; i < N; i++) sizeC[comp[i]]++;
      for (const [k, cell] of best) if (cpop[k] > 0.004 && sizeC[k] >= 60 && added < Math.max(2, Math.round(civTarget * 0.5))) { civSeeds.push({ cell, strength: 0.8, primary: false }); added++; }
      if (added) CV = territory(civSeeds, { valid: domain, friction: civFriction, trans: phys });
    }
    // 草原游牧文明：发源地按人口与地力挑选，总落在农耕沃土上；而大片连续的草原（BS 半干旱草原、温带草原）
    // 历来自成一系——游牧民族是草原的主人。只有足够大的草原才会孕育游牧文明，荒漠（BW）不算草原。
    // 数量随草原规模而定，最多约为文明数的 1/7，不再因为“干旱”就把大片疆域判成游牧。
    let steppeMul = null;
    const pastureOf = i => { const b = biome[i], kk = kop[i]; let v = (kk === 5 || kk === 6) ? 1 : (b === 3 && kk > 6) ? 0.7 : kk === 4 ? 0.3 : kk === 3 ? 0.2 : 0;
      if (v && (order[i] >= 2 || pot[i] > 0.5)) v *= 0.3; return v; };
    { const steppe = new Uint8Array(N); let nDom = 0;
      for (let i = 0; i < N; i++) { if (!domain[i]) continue; nDom++; if (!newW[i] && eN[i] <= 0.38 && pastureOf(i) >= 0.65 && weight[i] > 0) steppe[i] = 1; }
      const comp = components(steppe), size = new Int32Array(comp.count + 1), best = new Int32Array(comp.count + 1).fill(-1);
      for (let i = 0; i < N; i++) { const k = comp[i]; if (!k) continue; size[k]++; }
      // 种子取草原腹地（离草原边缘远）里人口最多的格
      const inner = new Uint8Array(N); for (let i = 0; i < N; i++) if (steppe[i]) { let all = 1; for (let d = 0; d < 8 && all; d++) { const j = NB[i * 8 + d]; if (j >= 0 && !steppe[j]) all = 0; } inner[i] = all; }
      for (let i = 0; i < N; i++) { const k = comp[i]; if (!k || !inner[i]) continue; if (best[k] < 0 || weight[i] > weight[best[k]]) best[k] = i; }
      const minSize = Math.max(400, nDom * 0.012), maxN = Math.max(1, Math.round(civTarget / 7));
      const ks = []; for (let k = 1; k <= comp.count; k++) if (size[k] >= minSize && best[k] >= 0) ks.push(k);
      ks.sort((a, b) => size[b] - size[a]);
      const occ = civSeeds.map(sd => sd.cell); let added = 0;
      for (const k of ks) { if (added >= maxN) break;
        const cand = []; for (let i = 0; i < N; i++) if (comp[i] === k && inner[i]) cand.push(i); cand.sort((p, q) => weight[q] - weight[p] || p - q);
        const sp = spacedSelect(cand, 1, minHD * 0.8, occ); if (!sp.length) continue;
        civSeeds.push({ cell: sp[0], strength: 0.85, primary: false, steppe: true }); added++; }
      if (added) { steppeMul = new Float32Array(N); for (let i = 0; i < N; i++) { const v = pastureOf(i); steppeMul[i] = v >= 0.5 ? 1.2 : v >= 0.2 ? 0.85 : biome[i] === 7 || biome[i] === 8 ? 0.7 : 0.55; }
        CV = territory(civSeeds, { valid: domain, friction: civFriction, trans: phys, steppeMul }); } }
    // 远离大陆的岛屿：经海路由最近的有人陆地传播（沿岸与跨海航行），使群岛也有文化、语言与宗教归属。
    // 跨海代价 1.6 倍于陆路，最远约 1500 km；更远的孤岛仍保持无人。
    function fillIslands(T) {
      const lab = T.labels, cost = T.cost, dist = new Float32Array(N).fill(Infinity), carry = new Int32Array(N), cc = new Float64Array(N), hp = new Heap(N), maxD = 1500 / cellKm;
      for (let i = 0; i < N; i++) if (lab[i] > 0) { dist[i] = 0; carry[i] = lab[i]; cc[i] = isFinite(cost[i]) ? cost[i] : 0; hp.push(i, 0); }
      while (hp.n) { const i = hp.pop(), d = dist[i];
        for (let k = 0; k < 8; k++) { const j = NB[i * 8 + k]; if (j < 0 || ice[j] || lab[j] > 0) continue; const step = DL[k] * (land[j] ? 1 : 1.6), nd = d + step;
          if (nd > maxD || nd >= dist[j]) continue; dist[j] = nd; carry[j] = carry[i]; cc[j] = cc[i] + step * 2.2; hp.push(j, nd); } }
      let n = 0; for (let i = 0; i < N; i++) if (domain[i] && !lab[i] && carry[i] > 0) { lab[i] = carry[i]; cost[i] = cc[i]; n++; }
      return n;
    }
    fillIslands(CV);
    const civ = CV.labels; // 1..nCiv
    const nCiv = civSeeds.length;
    const influence = new Uint8Array(N);
    { const byCiv = Array.from({ length: nCiv + 1 }, () => []); for (let i = 0; i < N; i++) if (civ[i]) byCiv[civ[i]].push(CV.cost[i]);
      const qs = byCiv.map(a => { a.sort((x, y) => x - y); return [a[Math.floor(a.length * 0.34)] || 0, a[Math.floor(a.length * 0.72)] || 0]; });
      for (let i = 0; i < N; i++) if (civ[i]) influence[i] = CV.cost[i] <= qs[civ[i]][0] ? 3 : CV.cost[i] <= qs[civ[i]][1] ? 2 : 1; }
    // 生计类型：看文明的整片疆域里“人住在哪里”。草原（BS、温带草原）是牧场；荒漠（BW）只算很小的放牧价值——
    // 荒漠里的人口集中在河谷与绿洲，以灌溉农业为生（古埃及式），不能因为疆域大半是沙漠就判成游牧。
    // 按人口（承载）加权为主、面积为辅；大河沿岸与良田不计为牧场。
    const aridShare = new Float64Array(nCiv + 1);
    { const n = new Float64Array(nCiv + 1), pw = new Float64Array(nCiv + 1), ps = new Float64Array(nCiv + 1), wsum = new Float64Array(nCiv + 1);
      for (let i = 0; i < N; i++) { const k = civ[i]; if (!k || !land[i]) continue; const v = pastureOf(i); n[k]++; ps[k] += v; pw[k] += v * weight[i]; wsum[k] += weight[i]; }
      for (let k = 1; k <= nCiv; k++) aridShare[k] = n[k] ? 0.65 * (wsum[k] > 0 ? pw[k] / wsum[k] : 0) + 0.35 * ps[k] / n[k] : 0;}
    const subsistence = civSeeds.map((s, k) => {
      const c = s.cell, b = biome[c];
      if (newW[c]) return 'new-world';
      if (eN[c] > 0.38) return 'highland';
      if (s.steppe || aridShare[k + 1] >= 0.5 || (aridShare[k + 1] >= 0.32 && (kop[c] === 5 || kop[c] === 6 || b === 3) && !order[c] && pot[c] < 0.35)) return 'pastoral'; // 人口以草原牧场为主，或起源于贫瘠且无河的草原
      if (oceanCoast[c] || dCoast[c] <= 2) return pot[c] > 0.45 ? 'agrarian' : 'maritime';
      if (pot[c] < 0.25) return 'tribal';
      return 'agrarian';
    });

    // ================= 4. 语言（跨文明接触，不设硬边界） =================
    progress('人文 · 语言', 0.885);
    const langTarget = Math.max(civSeeds.filter(s => s.primary).length, cfg.languages);
    const langSeeds = [], langFamily = [];
    { const cnt = new Float64Array(nCiv + 1); for (let i = 0; i < N; i++) if (civ[i] && buildable[i]) cnt[civ[i]]++;
      const totalC = cnt.reduce((a, b) => a + b, 0) || 1;
      const quotas = []; let sum = 0;
      for (let c = 1; c <= nCiv; c++) { const qv = Math.max(1, Math.floor(langTarget * cnt[c] / totalC)); quotas[c] = civSeeds[c - 1].primary ? qv : 1; sum += quotas[c]; }
      const big = []; for (let c = 1; c <= nCiv; c++) if (civSeeds[c - 1].primary && cnt[c] > 50) big.push(c);
      big.sort((a, b) => cnt[b] - cnt[a]);
      for (let guard = 0; sum < langTarget && big.length && guard < 1000; guard++) { const c = big[guard % big.length]; quotas[c]++; sum++; }
      for (let c = 1; c <= nCiv; c++) {
        const cand = civOrder.filter(i => civ[i] === c); if (!cand.length) cand.push(civSeeds[c - 1].cell);
        const occ = [civSeeds[c - 1].cell];
        const chosen = [civSeeds[c - 1].cell].concat(spacedSelect(cand, quotas[c] - 1, Math.max(2, Math.sqrt(cnt[c] / Math.max(1, quotas[c])) * 0.6), occ.slice()));
        for (const s of chosen) { langSeeds.push({ cell: s, strength: 0.9 + 0.2 * civScore[s] }); langFamily.push(c); }
      } }
    const langTrans = new Float32Array(8 * N); for (let k = 0; k < 8 * N; k++) langTrans[k] = phys[k] * 0.8;
    const LG = territory(langSeeds, { valid: domain, friction: civFriction, trans: langTrans }); fillIslands(LG);
    const language = LG.labels;

    // ================= 5. 交通：道路摩擦、过河代价 =================
    progress('人文 · 交通骨架', 0.89);
    const broad = boxBlur(eN, 3);
    function boxBlur(a, r) { const out = new Float32Array(N), tmp = new Float32Array(N); for (let y = 0; y < H; y++) { let s = 0; for (let k = -r; k <= r; k++) s += a[y * W + ((k + W) % W)]; for (let x = 0; x < W; x++) { tmp[y * W + x] = s / (2 * r + 1); s += a[y * W + ((x + r + 1) % W)] - a[y * W + ((x - r + W) % W)]; } } for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= H) continue; s += tmp[yy * W + x]; n++; } out[y * W + x] = s / n; } return out; }
    const riverCorr = proximity(order, 2);
    const roadFr = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (!domain[i] || eN[i] > 0.88) { roadFr[i] = Infinity; continue; }
      const h = eN[i];
      roadFr[i] = Math.max(0.72, 1 + 12 * clamp(h - 0.25, 0, 0.75) + 60 * Math.pow(clamp(h - 0.42, 0, 0.58), 2) + 76 * slopeN[i] * 0.45 + 30 * clamp(h - broad[i], 0, 1) + 1.6 * (1 - pot[i]) - 0.48 * riverCorr[i] - 0.42 * clamp(order[i] / 3, 0, 1));
    }
    // 过河：进入/离开 2 级以上河流格时的桥梁代价
    const crossCost = (i, j) => { const a = order[i], b = order[j]; if (a === b) return 0; const m = Math.max(a, b); return m >= 4 ? 7 : m >= 3 ? 4 : m >= 2 ? 1.6 : 0.4; };

    // 成本空间 Voronoi 路网：一次多源 Dijkstra，邻接即候选边
    function buildNetwork(nodes, level, opts = {}) {
      const label = new Int32Array(N).fill(-1), dist = new Float64Array(N).fill(Infinity), pred = new Int32Array(N).fill(-1);
      const hp = new Heap(N);
      const discount = opts.discount || null;
      nodes.forEach((nd, k) => { if (dist[nd.cell] === 0) { nd.alias = label[nd.cell]; return; } label[nd.cell] = k; dist[nd.cell] = 0; hp.push(nd.cell, 0); });
      const ec = (i, j, d) => (0.5 * (roadFr[i] + roadFr[j]) * (discount ? (1 - 0.45 * Math.max(discount[i], discount[j])) : 1) + crossCost(i, j) + Math.abs(e[j] - e[i]) / 160) * DL[d] * (d === 1 || d === 6 ? 1 : cosL[(i / W) | 0] * 0.5 + 0.5); // 爬升代价：道路走河谷与山口，不直翻山体
      while (hp.n) {
        const i = hp.pop(), c = hp.top; if (c !== dist[i]) continue;
        for (let d = 0; d < 8; d++) { const j = NB[i * 8 + d]; if (j < 0 || roadFr[j] === Infinity) continue; const nc = c + ec(i, j, d); if (nc < dist[j]) { dist[j] = nc; label[j] = label[i]; pred[j] = i; hp.push(j, nc); } }
      }
      const best = new Map();
      for (let i = 0; i < N; i++) { const a = label[i]; if (a < 0) continue; for (const d of [2, 4, 6, 7]) { const j = NB[i * 8 + d]; if (j < 0) continue; const b = label[j]; if (b < 0 || b === a) continue; const c = dist[i] + dist[j] + ec(i, j, d); const key = a < b ? a * 65536 + b : b * 65536 + a; const o = best.get(key); if (!o || c < o[0]) best.set(key, a < b ? [c, i, j] : [c, j, i]); } }
      const edges = [...best.entries()].map(([key, [c, i, j]]) => ({ a: Math.floor(key / 65536), b: key % 65536, c, i, j }));
      edges.sort((p, q2) => p.c - q2.c);
      // 每个节点取最近的 k 条（原版 ROAD_NEIGHBORS），再用 Kruskal 保证同陆块连通
      const k = ROAD_NEIGHBORS[level];
      const deg = new Int32Array(nodes.length), keep = new Set();
      const inc = Array.from({ length: nodes.length }, () => []);
      edges.forEach((ed, idx) => { inc[ed.a].push(idx); inc[ed.b].push(idx); });
      for (let n = 0; n < nodes.length; n++) inc[n].slice(0, k).forEach(idx => keep.add(idx));
      const parent = nodes.map((_, i) => i); const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      for (const idx of keep) { const ed = edges[idx]; parent[find(ed.a)] = find(ed.b); }
      edges.forEach((ed, idx) => { if (keep.has(idx)) return; const ra = find(ed.a), rb = find(ed.b); if (ra !== rb) { parent[ra] = rb; keep.add(idx); } });
      const out = [];
      for (const idx of keep) {
        const ed = edges[idx]; void deg;
        const pa = []; let x = ed.i; while (x >= 0) { pa.push(x); x = pred[x]; }
        const pb = []; x = ed.j; while (x >= 0) { pb.push(x); x = pred[x]; }
        out.push({ a: ed.a, b: ed.b, cost: ed.c, cells: pa.reverse().concat(pb) });
      }
      return { routes: out, label, dist };
    }

    // 机会节点：发源地、海岸登陆点、河流汇口、山口、资源点
    const anchors = [];
    { const occ = [];
      const add = (c, kind, s) => { anchors.push({ cell: c, kind, score: s }); occ.push(c); };
      civSeeds.forEach(s => { if (s.primary) add(s.cell, 'hearth', s.strength); });
      const count = Math.max(4, Math.min(96, 2 * civSeeds.filter(s => s.primary).length)), spacing = Math.max(3, Math.min(W, H) / 36);
      const sel = (kind, mask, score, quota) => spacedSelect(byScore(mask, score), quota, spacing, occ.slice()).forEach(c => add(c, kind, score[c]));
      const shelter = boxBlur(Float32Array.from(domain), 2);
      const s1 = new Float32Array(N); for (let i = 0; i < N; i++) s1[i] = pot[i] + 0.6 * shelter[i];
      sel('coastal-landing', Uint8Array.from(oceanCoast, (v, i) => v && domain[i] ? 1 : 0), s1, count);
      const s2 = new Float32Array(N); for (let i = 0; i < N; i++) s2[i] = pot[i] + order[i] / 8;
      sel('river-junction', Uint8Array.from(incoming, (v, i) => v >= 2 && order[i] && domain[i] ? 1 : 0), s2, count >> 1);
      const saddle = new Uint8Array(N), s3 = new Float32Array(N);
      for (let y = 2; y < H - 2; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!domain[i] || eN[i] < 0.15) continue; const nn = broad[i - 2 * W], ss = broad[i + 2 * W], ee = broad[y * W + (x + 2) % W], ww = broad[y * W + (x - 2 + W) % W], b = broad[i]; const ns = Math.min(nn, ss) - b, ew = Math.min(ee, ww) - b; if ((ns > 0 && Math.max(ee, ww) < b) || (ew > 0 && Math.max(nn, ss) < b)) { saddle[i] = 1; s3[i] = Math.max(ns, ew) + pot[i] * 0.1; } }
      sel('pass', saddle, s3, count >> 1);
      const maxima = new Uint8Array(N); for (let i = 0; i < N; i++) { if (!domain[i] || pot[i] < 0.55) continue; let m = true; for (let d = 0; d < 8 && m; d++) { const j = NB[i * 8 + d]; if (j >= 0 && pot[j] > pot[i]) m = false; } maxima[i] = m ? 1 : 0; }
      sel('resource', maxima, pot, count); }
    const backbone = buildNetwork(anchors, cfg.transport);
    const access = accessibility(backbone.routes.map(r => ({ cells: r.cells, imp: 'regional' })), []);
    function accessibility(routes, ports) {
      const corr = new Float32Array(N);
      for (const r of routes) { const v = r.imp === 'trunk' ? 0.86 : r.imp === 'regional' ? 0.68 : 0.46; for (const c of r.cells) if (corr[c] < v) corr[c] = v; }
      for (const p of ports) corr[p] = Math.max(corr[p], 0.7);
      for (let pass = 0; pass < 3; pass++) { const nx = Float32Array.from(corr); for (let i = 0; i < N; i++) { let m = corr[i]; for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j >= 0 && corr[j] * 0.8 > m) m = corr[j] * 0.8; } nx[i] = m; } corr.set(nx); }
      return corr;
    }

    // ================= 6. 信仰 =================
    progress('人文 · 信仰', 0.895);
    const relTarget = Math.max(1, cfg.religions);
    const relCand = byScore(buildable, Float32Array.from(civScore, (v, i) => v + 0.3 * access[i] + (influence[i] === 3 ? 0.2 : 0)));
    const relSeeds = spacedSelect(relCand, relTarget, Math.max(4, Math.sqrt(validCount / relTarget) * 0.55), []).map(c => ({ cell: c, strength: 1 }));
    const relValid = new Uint8Array(N), relFr = new Float32Array(N);
    for (let i = 0; i < N; i++) { if (domain[i]) { relValid[i] = 1; relFr[i] = civFriction[i] * (1 - 0.5 * access[i]); } else if (sea[i] && dCoast[i] <= 4 && !seaIce[i]) { relValid[i] = 1; relFr[i] = 3.2; } }
    const RG = territory(relSeeds, { valid: relValid, friction: relFr, trans: langTrans }); fillIslands(RG);
    const religionRaw = RG.labels;

    // ================= 7. 城市选址（配额 + 缺口审计） =================
    progress('人文 · 城市选址', 0.9);
    const streams = Uint8Array.from(order, v => v > 0 ? 1 : 0), major = Uint8Array.from(order, v => v >= 2 ? 1 : 0);
    const sc = Math.min(W, H);
    const riverAccess = proximity(streams, Math.max(2, Math.min(12, Math.round(sc / 96)))), majorAccess = proximity(major, Math.max(2, Math.min(10, Math.round(sc / 110))));
    const lakeAccess = proximity(lake, Math.max(1, Math.min(5, Math.round(sc / 180))));
    const confluence = proximity(Uint8Array.from(incoming, (v, i) => v >= 2 && order[i] ? 1 : 0), Math.max(2, Math.min(8, Math.round(sc / 144))));
    const groundwater = new Float32Array(N); { let ref = 1; const qs = []; for (let i = 0; i < N; i++) if (domain[i] && q[i] > 0) qs.push(q[i]); qs.sort((a, b) => a - b); ref = Math.max(1, qs[Math.floor(qs.length * 0.96)] || 1); for (let i = 0; i < N; i++) if (domain[i]) groundwater[i] = clamp(Math.log1p(q[i]) / Math.log1p(ref), 0, 1) * (0.52 + 0.48 * smoothstep(150, 900, Pr[i])); }
    const fresh = new Float32Array(N); for (let i = 0; i < N; i++) fresh[i] = domain[i] ? Math.max(riverAccess[i], lakeAccess[i], groundwater[i]) : 0;
    const riverBank = new Uint8Array(N); for (let i = 0; i < N; i++) if (domain[i] && (order[i] || [1, 3, 4, 6].some(d => { const j = NB[i * 8 + d]; return j >= 0 && order[j]; }))) riverBank[i] = 1;
    const riverCorridor = Uint8Array.from(majorAccess, (v, i) => v > 0 && domain[i] ? 1 : 0);
    const sacred = new Uint8Array(N); relSeeds.forEach(s => sacred[s.cell] = 1);
    const junction = new Uint8Array(N), landing = new Uint8Array(N);
    { const dg = new Int32Array(anchors.length); backbone.routes.forEach(r => { dg[r.a]++; dg[r.b]++; }); anchors.forEach((a, k) => { if (dg[k] >= 3) junction[a.cell] = 1; if (a.kind === 'coastal-landing') landing[a.cell] = 1; }); }
    const ir = Math.max(2, Math.min(12, Math.round(sc / 96)));
    const pSacred = proximity(sacred, ir), pJunction = proximity(junction, ir), pLanding = proximity(landing, ir);
    const layout = new Float32Array(N); { const lr = mulberry32(cfg.seed + 77); for (let i = 0; i < N; i++) layout[i] = lr() * 2 - 1; const b = boxBlur(layout, 2); let m = 0; for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(b[i])); for (let i = 0; i < N; i++) layout[i] = b[i] / (m || 1); }
    const siteScore = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (!domain[i] || !civ[i]) { siteScore[i] = -Infinity; continue; }
      const riverScore = 0.58 * riverAccess[i] + 0.42 * majorAccess[i];
      const dryNeed = clamp((0.16 - annualN[i]) / 0.16, 0, 1);
      const terrainPen = 0.62 * clamp(slopeN[i] / 0.06, 0, 1) + 0.38 * clamp((eN[i] - 0.48) / 0.3, 0, 1);
      const human = 0.16 * access[i] + 0.05 * influence[i] / 3 + 0.08 * pSacred[i] + 0.07 * pJunction[i] + 0.04 * pLanding[i];
      siteScore[i] = 0.4 * popRel[i] + 0.15 * pot[i] + 0.14 * hab[i] + 0.1 * fresh[i] + 0.03 * riverScore + 0.03 * confluence[i] + 0.05 * oceanCoast[i] + 0.06 * lakeCoast[i] + 0.1 * hab[i]
        - 0.18 * dryNeed * (1 - fresh[i]) - 0.22 * terrainPen + human + 0.035 * layout[i];
    }
    const watered = (i) => (oceanCoast[i] || lakeCoast[i] || fresh[i] >= 0.26) && popRel[i] >= popFloor * 0.45;
    const urbanValid = new Uint8Array(N); for (let i = 0; i < N; i++) urbanValid[i] = urbanPhysical[i] && civ[i] && isFinite(siteScore[i]) && (popRel[i] >= popFloor || watered(i)) ? 1 : 0;
    let nValid = 0; for (let i = 0; i < N; i++) nValid += urbanValid[i];
    let target = cfg.towns;
    let remoteValid = 0; for (let i = 0; i < N; i++) if (urbanValid[i] && newW[i]) remoteValid++;
    // 原版会按新大陆份额压低全球城镇预算；这里保持用户给定的城镇总数，新大陆仍因人口稀疏而自然少城
    void remoteValid;
    const effectiveTarget = target;
    const lateReserve = Math.round(target * 0.07);
    target = Math.max(1, Math.min(nValid, target - lateReserve));
    const spacing = Math.max(1, Math.sqrt(nValid / (target * Math.PI)) * 0.58 * Math.sqrt(4)); // 本网格更粗，按 4 倍格面积补偿
    const strategic = target >= 40;
    const qn = f => strategic ? Math.round(target * f) : 0;
    const gatewayN = qn(0.025), coastN = qn(0.075), riverN = qn(0.035), lakeN = qn(0.04), valleyN = qn(0.065), plainN = qn(0.39);
    const baseN = target - gatewayN - coastN - riverN - lakeN - valleyN - plainN;
    const occupied = [];
    const resolved = []; // [cell, score, forcedType, category]
    const push = (cells, scoreArr, forced, cat) => cells.forEach(c => resolved.push([c, scoreArr[c], forced, cat]));
    push(spacedSelect(byScore(urbanValid, siteScore), baseN, spacing, occupied), siteScore, null, 'urban');
    // 海峡/内海出口的门户港
    const narrow = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (sea[i]) { const n_ = NB[i * 8 + 1], s_ = NB[i * 8 + 6], e_ = NB[i * 8 + 4], w_ = NB[i * 8 + 3]; if ((n_ >= 0 && s_ >= 0 && land[n_] && land[s_]) || (land[e_] && land[w_])) narrow[i] = 1; }
    const gatewayReach = proximity(narrow, Math.max(3, Math.min(12, Math.round(sc / 120))));
    const gScore = new Float32Array(N), gValid = new Uint8Array(N);
    for (let i = 0; i < N; i++) { gValid[i] = oceanCoast[i] && domain[i] && civ[i] && gatewayReach[i] >= 0.32 && eN[i] < 0.64 && slopeN[i] < 0.095 ? 1 : 0; gScore[i] = gValid[i] ? siteScore[i] + 0.3 * gatewayReach[i] + 0.12 * hab[i] + 0.08 * fresh[i] : -Infinity; }
    push(spacedSelect(byScore(gValid, gScore), gatewayN, Math.max(1.5, spacing * 0.58), occupied), gScore, 'port', 'urban');
    const coastScore = Float32Array.from(siteScore, (v, i) => oceanCoast[i] ? v : -Infinity);
    push(spacedSelect(byScore(Uint8Array.from(oceanCoast, (v, i) => v && domain[i] && civ[i] ? 1 : 0), coastScore), coastN, Math.max(2, spacing * 0.78), occupied), coastScore, null, 'urban');
    const rvScore = Float32Array.from(siteScore, (v, i) => riverBank[i] || riverCorridor[i] ? v + 0.2 * confluence[i] : -Infinity);
    push(spacedSelect(byScore(Uint8Array.from(riverCorridor, (v, i) => (v || riverBank[i]) && civ[i] ? 1 : 0), rvScore), riverN, Math.max(2, spacing * 0.72), occupied), rvScore, null, 'urban');
    const lkScore = Float32Array.from(siteScore, (v, i) => lakeCoast[i] ? v + 0.24 : -Infinity);
    push(spacedSelect(byScore(Uint8Array.from(lakeCoast, (v, i) => v && domain[i] && civ[i] ? 1 : 0), lkScore), lakeN, Math.max(2, spacing * 0.72), occupied), lkScore, null, 'urban');
    const valleyValid = new Uint8Array(N), vScore = new Float32Array(N).fill(-Infinity);
    for (let i = 0; i < N; i++) if (domain[i] && civ[i] && riverAccess[i] >= 0.34 && pot[i] >= 0.4 && popRel[i] >= popFloor * 0.42 && hab[i] >= 0.32 && (annualN[i] >= 0.07 || fresh[i] >= 0.55) && eN[i] < 0.54 && slopeN[i] < 0.058) { valleyValid[i] = 1; vScore[i] = siteScore[i] + 0.22 * hab[i] + 0.18 * riverAccess[i] + 0.12 * confluence[i] + 0.08 * (1 - clamp(slopeN[i] / 0.058, 0, 1)); }
    push(spacedSelect(byScore(valleyValid, vScore), valleyN, Math.max(2, spacing * 0.58), occupied), vScore, null, 'urban');
    const plainValid = new Uint8Array(N), plScore = new Float32Array(N).fill(-Infinity);
    for (let i = 0; i < N; i++) if (domain[i] && civ[i] && !oceanCoast[i] && !lakeCoast[i] && !order[i] && pot[i] >= 0.52 && popRel[i] >= popFloor * 0.24 && hab[i] >= 0.48 && eN[i] < 0.43 && slopeN[i] < 0.036) { plainValid[i] = 1; plScore[i] = siteScore[i] + 0.24 * pot[i] + 0.14 * hab[i] + 0.1 * popRel[i] + 0.06 * fresh[i]; }
    push(spacedSelect(byScore(plainValid, plScore), plainN, Math.max(1.2, spacing * 0.52), occupied), plScore, 'market', 'plain-town');
    const missing = target - resolved.length;
    if (missing > 0) push(spacedSelect(byScore(urbanValid, siteScore), missing, 1, occupied), siteScore, null, 'urban');
    // 缺口审计：长海岸、长河段、行政空白（按预算逐个补点）
    const strategicCoast = new Set(), strategicRiver = new Set(), adminCentres = new Set();
    function gapAudit(domainMask, isCovered, radius, budget, scoreFn, forced, set) {
      const cov = bfsDist(i => isCovered(i), () => true, radius + 1), qq = new Int32Array(N);
      const cand = []; for (let i = 0; i < N; i++) if (domainMask[i]) { const v = scoreFn(i); if (isFinite(v)) cand.push([i, v]); }
      cand.sort((p, q2) => q2[1] - p[1]);
      const minGap = Math.max(6, radius), half = Math.max(2, radius >> 1);
      let ptr = 0;
      for (let k = 0; k < budget; k++) {
        let best = -1;
        while (ptr < cand.length) {
          const [i] = cand[ptr];
          if (cov[i] <= radius) { ptr++; continue; }
          // 局部缺口规模：半径一半范围内未覆盖的同类格数
          let gap = 0; const y = (i / W) | 0, x = i - y * W;
          for (let dy = -half; dy <= half && gap < minGap; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -half; dx <= half; dx++) { const j = yy * W + ((x + dx) % W + W) % W; if (domainMask[j] && cov[j] > radius) gap++; } }
          ptr++;
          if (gap >= Math.min(minGap, half * 2)) { best = i; break; }
        }
        if (best < 0) break;
        resolved.push([best, scoreFn(best), forced, 'urban']); occupied.push(best); set.add(best);
        let h = 0, t = 0; cov[best] = 0; qq[t++] = best;
        while (h < t) { const i = qq[h++]; if (cov[i] >= radius + 1) continue; for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j >= 0 && cov[j] > cov[i] + 1) { cov[j] = cov[i] + 1; qq[t++] = j; } } }
      }
    }
    if (strategic) {
      const isPort = new Uint8Array(N); const refresh = () => { isPort.fill(0); for (const [c] of resolved) if (oceanCoast[c]) isPort[c] = 1; };
      refresh();
      const usableCoast = new Uint8Array(N); for (let i = 0; i < N; i++) usableCoast[i] = oceanCoast[i] && domain[i] && civ[i] && eN[i] < 0.66 && slopeN[i] < 0.1 && (pot[i] >= 0.18 || popRel[i] >= popFloor * 0.38 || fresh[i] >= 0.26) ? 1 : 0;
      gapAudit(usableCoast, i => { if (isPort[i]) return true; return false; }, Math.max(9, Math.min(17, Math.round(sc / 56))), Math.max(10, Math.min(36, Math.round(target * 0.06))), i => siteScore[i] + 0.12 * fresh[i], 'port', strategicCoast);
      const majorRiver = Uint8Array.from(order, (v, i) => v >= 3 && domain[i] && civ[i] ? 1 : 0);
      const onRiver = new Uint8Array(N); for (const [c] of resolved) if (riverAccess[c] >= 0.56) onRiver[c] = 1;
      gapAudit(majorRiver, i => onRiver[i], Math.max(12, Math.min(22, Math.round(sc / 48))), Math.max(4, Math.min(14, Math.round(target * 0.025))), i => (urbanValid[i] ? rvScore[i] : -1e9), 'river-city', strategicRiver);
      const adminDomain = new Uint8Array(N); for (let i = 0; i < N; i++) adminDomain[i] = domain[i] && civ[i] && weight[i] > 0 && pot[i] >= 0.08 && hab[i] >= 0.14 && eN[i] < 0.68 && slopeN[i] < 0.09 ? 1 : 0;
      const prov = resolved.filter(r => r[3] === 'urban').sort((a, b) => b[1] - a[1]);
      const metroN0 = Math.min(28, Math.max(8, Math.round(Math.sqrt(prov.length) * 1.45)));
      prov.slice(0, Math.min(prov.length, metroN0 + Math.max(12, Math.round(prov.length * 0.3)))).forEach(r => adminCentres.add(r[0]));
      strategicCoast.forEach(c => adminCentres.add(c)); strategicRiver.forEach(c => adminCentres.add(c));
      gapAudit(adminDomain, i => adminCentres.has(i), Math.max(12, Math.min(29, Math.round(sc / 36))), Math.max(16, Math.min(72, Math.round(target * 0.14))), i => siteScore[i] + 0.14 * fresh[i] + 0.1 * hab[i] + 0.08 * pot[i], null, adminCentres);
    }
    // 每个有供养的独立陆块至少一个聚落；每个主要文明/语言/信仰区至少一个
    { const rep = new Set(resolved.map(r => landComp[r[0]])); const best = new Map(); for (let i = 0; i < N; i++) if (urbanPhysical[i] && civ[i] && isFinite(siteScore[i]) && !rep.has(landComp[i])) { const b = best.get(landComp[i]); if (b === undefined || siteScore[i] > siteScore[b]) best.set(landComp[i], i); }
      const lp = new Float64Array(landComp.count + 1); for (let i = 0; i < N; i++) lp[landComp[i]] += weight[i];
      for (const [k, c] of best) if (lp[k] * popMax >= 500 * 4) resolved.push([c, siteScore[c], oceanCoast[c] ? 'island-port' : null, 'urban']); }
    for (const [field, seeds] of [[civ, civSeeds], [language, langSeeds], [religionRaw, relSeeds]]) {
      const rep = new Set(resolved.map(r => field[r[0]]));
      seeds.forEach((s, k) => { const id = k + 1; if (rep.has(id)) return; let b = -1; for (let i = 0; i < N; i++) if (field[i] === id && urbanPhysical[i] && isFinite(siteScore[i]) && (b < 0 || siteScore[i] > siteScore[b])) b = i; if (b >= 0) { resolved.push([b, siteScore[b], null, 'urban']); rep.add(id); } });
    }
    // 去重 + 城镇最低供养
    const seenCell = new Set(); const finalSites = [];
    resolved.sort((a, b) => b[1] - a[1]);
    for (const r of resolved) { if (seenCell.has(r[0])) continue; if (!supportsTown(r[0])) continue; seenCell.add(r[0]); finalSites.push(r); }
    if (finalSites.length < target) { // 补足城镇数量目标
      for (const mult of [0.45, 0.3, 0.18]) { if (finalSites.length >= target) break;
        const extra = spacedSelect(byScore(urbanValid, siteScore), target - finalSites.length, Math.max(1, spacing * mult), finalSites.map(r => r[0]));
        extra.forEach(c => { if (!seenCell.has(c) && supportsTown(c)) { seenCell.add(c); finalSites.push([c, siteScore[c], null, 'urban']); } }); }
      finalSites.sort((a, b) => b[1] - a[1]);
    }
    const urbanR = finalSites.filter(r => r[3] === 'urban'), plainR = finalSites.filter(r => r[3] === 'plain-town');
    const metroN = Math.min(28, Math.max(8, Math.round(Math.sqrt(urbanR.length) * 1.45)));
    const cityLimit = Math.min(urbanR.length, metroN + Math.max(12, Math.round(urbanR.length * 0.3)));
    const settlements = [];
    urbanR.concat(plainR).forEach((r, rank) => {
      const [c, score, forced, cat] = r;
      let type = forced || (oceanCoast[c] ? 'port' : lakeCoast[c] ? 'lake-port' : riverBank[c] ? 'river-city' : annualN[c] < 0.065 ? 'oasis' : 'market');
      let tier = cat === 'plain-town' ? 'town' : rank < metroN ? 'metropolis' : rank < cityLimit ? 'city' : 'town';
      if (tier === 'town' && ((type === 'port' || type === 'island-port') && gatewayReach[c] >= 0.32 || strategicRiver.has(c) || strategicCoast.has(c) || adminCentres.has(c))) tier = 'city';
      settlements.push({ cell: c, score, type, tier, role: 'urban' });
    });

    // ================= 8. 道路网重建（经过城市）与海运 =================
    progress('人文 · 道路与海运', 0.91);
    // 城址落到真实地物上：港口贴海岸线、湖港贴湖岸、河城落在河道上（全分辨率）
    { const FHh = P.H, PEe = P.elev, HQq = Hy.q, HLk = Hy.lake, HLs = Hy.lakeSoft;
      const isSeaF = j => PEe[j] <= 0 && !HLk[j];
      const bilF = (A, x, y) => A === PEe ? G.Noise.coastSurface(A, FW, FHh, x, y) : G.Noise.surface(A, FW, FHh, x, y);
      for (const st of settlements) {
        const y0 = ((st.cell / W) | 0) * 2, x0 = (st.cell % W) * 2, cx = x0 + 1, cy = y0 + 1;
        let best = null, bd = 1e9;
        const want = st.type === 'port' || st.type === 'island-port' || oceanCoast[st.cell] ? 'sea' : st.type === 'lake-port' ? 'lake' : st.type === 'river-city' ? 'river' : null;
        if (want) for (let dy = -4; dy <= 5; dy++) for (let dx = -4; dx <= 5; dx++) {
          const yy = y0 + dy; if (yy < 1 || yy >= FHh - 1) continue; const xx = ((x0 + dx) % FW + FW) % FW, j = yy * FW + xx;
          if (PEe[j] <= 0 || HLk[j]) continue;
          let tx = null, ty = null;
          if (want === 'river') { if (HQq[j] < qth) continue; tx = xx + 0.5; ty = yy + 0.5; }
          else for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (yy + oy) * FW + ((xx + ox) % FW + FW) % FW; if (want === 'sea' ? isSeaF(k) : HLk[k]) {
            // 沿该方向求连续地表的真实岸线交点，城址退到岸线内侧（陆上），不落进水里
            const wet = (t) => { const px = xx + 0.5 + ox * t, py = yy + 0.5 + oy * t; return want === 'sea' ? bilF(PEe, px, py) <= 0 : bilF(HLs, px, py) >= 0.5; };
            let lo = 0, hi = 1; for (let it = 0; it < 20; it++) { const m = (lo + hi) / 2; if (wet(m)) hi = m; else lo = m; }
            let t = Math.max(0, lo - 0.22); while (t > 0 && (wet(t) || (want === 'sea' && bilF(PEe, xx + 0.5 + ox * t, yy + 0.5 + oy * t) < 0.2))) t -= 0.05;
            tx = xx + 0.5 + ox * Math.max(0, t); ty = yy + 0.5 + oy * Math.max(0, t); break; } }
          if (tx === null) continue;
          const d = (dx + 0.5 - 1) ** 2 + (dy + 0.5 - 1) ** 2; if (d < bd) { bd = d; best = [tx, ty, j]; }
        }
        if (best) { st.fx = best[0]; st.fy = best[1]; st.fcell = best[2]; if (want === 'sea') st.coastalTrue = true; }
        else { st.fx = cx; st.fy = cy; st.fcell = cy * FW + cx; }
      } }
    const cityNodes = settlements.map(s => ({ cell: s.cell, kind: 'city', s }));
    const allNodes = cityNodes.concat(anchors.filter(a => a.kind !== 'resource'));
    const net = buildNetwork(allNodes, cfg.transport);
    const tierRank = s => s ? ({ metropolis: 2, city: 1, town: 0 })[s.tier] : -1;
    const roads = net.routes.map(r => {
      const A = allNodes[r.a], B = allNodes[r.b];
      const ta = tierRank(A.s), tb = tierRank(B.s);
      const imp = (A.kind === 'hearth' && B.kind === 'hearth') || (ta === 2 && tb === 2) || (Math.min(ta, tb) >= 1 && Math.max(ta, tb) === 2) ? 'trunk' : (ta >= 1 || tb >= 1 || A.kind === 'hearth' || B.kind === 'hearth' || A.kind === 'coastal-landing' || B.kind === 'coastal-landing') ? 'regional' : 'local';
      return { a: r.a, b: r.b, cells: r.cells, imp, mode: 'road' };
    });
    // 网络分级：干道连通所有大都会与发源地；每座城市以区域道路接入干道；其余为地方道路（各级显示时均连通）
    { const nN = allNodes.length, adjR = Array.from({ length: nN }, () => []);
      roads.forEach((r, k) => { adjR[r.a].push([r.b, k, net.routes[k].cost]); adjR[r.b].push([r.a, k, net.routes[k].cost]); r.imp = 'local'; });
      const isTrunkNode = n => (allNodes[n].s && allNodes[n].s.tier === 'metropolis') || allNodes[n].kind === 'hearth';
      const lab = new Int32Array(nN).fill(-1), dist = new Float64Array(nN).fill(Infinity), predE = new Int32Array(nN).fill(-1), predN = new Int32Array(nN).fill(-1), hp = new Heap(64);
      for (let n = 0; n < nN; n++) if (isTrunkNode(n)) { lab[n] = n; dist[n] = 0; hp.push(n, 0); }
      while (hp.n) { const u = hp.pop(), du = hp.top; if (du !== dist[u]) continue; for (const [v, k, c] of adjR[u]) { const nd = du + c; if (nd < dist[v]) { dist[v] = nd; lab[v] = lab[u]; predE[v] = k; predN[v] = u; hp.push(v, nd); } } }
      const markPath = (n, imp) => { let g = 0; while (n >= 0 && predE[n] >= 0 && g++ < 10000) { const r = roads[predE[n]]; if (imp === 'trunk' || r.imp === 'local') r.imp = imp; n = predN[n]; } };
      // 干道：在“干道节点 Voronoi”之间取最小生成树，再给每个节点补最近的一条
      const cand = new Map();
      roads.forEach((r, k) => { const la = lab[r.a], lb = lab[r.b]; if (la < 0 || lb < 0 || la === lb) return; const c = dist[r.a] + dist[r.b] + net.routes[k].cost, key = Math.min(la, lb) + ':' + Math.max(la, lb); const o = cand.get(key); if (!o || c < o.c) cand.set(key, { c, k, la, lb }); });
      const list = [...cand.values()].sort((p, q2) => p.c - q2.c), par = new Map(), find = x => { while (par.has(x) && par.get(x) !== x) x = par.get(x); return x; };
      const nearest = new Map();
      for (const ed of list) { for (const t of [ed.la, ed.lb]) if (!nearest.has(t)) nearest.set(t, ed); const ra = find(ed.la), rb = find(ed.lb); const take = ra !== rb || nearest.get(ed.la) === ed || nearest.get(ed.lb) === ed; if (ra !== rb) par.set(ra, rb); if (!take) continue; const r = roads[ed.k]; r.imp = 'trunk'; markPath(r.a, 'trunk'); markPath(r.b, 'trunk'); }
      // 区域道路：每个城市（及以上）沿最短路接入最近的干道节点
      for (let n = 0; n < nN; n++) { const st = allNodes[n].s; if ((st && st.tier !== 'town') || allNodes[n].kind === 'coastal-landing') markPath(n, 'regional'); }
    }
    // 海运：港口之间沿水域的成本 Voronoi
    const ports = settlements.map((s, k) => [s, k]).filter(([s]) => s.type === 'port' || s.type === 'island-port' || s.coastalTrue || (oceanCoast[s.cell] && s.tier !== 'town'));
    const seaRoutes = [];
    { const portWater = []; for (const [s, k] of ports) { let w = -1; for (let d = 0; d < 8 && w < 0; d++) { const j = NB[s.cell * 8 + d]; if (j >= 0 && sea[j] && !seaIce[j]) w = j; } if (w >= 0) portWater.push({ cell: w, k, s }); }
      if (portWater.length >= 2) {
        const label = new Int32Array(N).fill(-1), dist = new Float64Array(N).fill(Infinity), pred = new Int32Array(N).fill(-1), hp = new Heap(N);
        portWater.forEach((p, k) => { if (dist[p.cell] === 0) return; label[p.cell] = k; dist[p.cell] = 0; hp.push(p.cell, 0); });
        const sc2 = i => (dCoast[i] <= 1 ? 1.4 : dCoast[i] <= 4 ? 1 : 0.92);
        while (hp.n) { const i = hp.pop(), c = hp.top; if (c !== dist[i]) continue; const y = (i / W) | 0; for (let d = 0; d < 8; d++) { const j = NB[i * 8 + d]; if (j < 0 || !sea[j] || seaIce[j]) continue; const len = DL[d] * (d === 1 || d === 6 ? 1 : 0.5 + 0.5 * cosL[y]); const nc = c + len * sc2(j); if (nc < dist[j]) { dist[j] = nc; label[j] = label[i]; pred[j] = i; hp.push(j, nc); } } }
        const best = new Map();
        for (let i = 0; i < N; i++) { const a = label[i]; if (a < 0) continue; for (const d of [2, 4, 6, 7]) { const j = NB[i * 8 + d]; if (j < 0) continue; const b = label[j]; if (b < 0 || b === a) continue; const c = dist[i] + dist[j] + 1; const key = a < b ? a * 65536 + b : b * 65536 + a; const o = best.get(key); if (!o || c < o[0]) best.set(key, a < b ? [c, i, j] : [c, j, i]); } }
        const maxKm = era === 'industrial' ? 6000 : 2400;
        const edges = [...best.entries()].map(([key, v]) => ({ a: Math.floor(key / 65536), b: key % 65536, c: v[0], i: v[1], j: v[2] })).filter(ed => ed.c * cellKm < maxKm).sort((p, q2) => p.c - q2.c);
        const kk = ROAD_NEIGHBORS[cfg.transport], inc = Array.from({ length: portWater.length }, () => []);
        edges.forEach((ed, idx) => { inc[ed.a].push(idx); inc[ed.b].push(idx); });
        const keep = new Set(); for (let n = 0; n < portWater.length; n++) inc[n].slice(0, kk).forEach(idx => keep.add(idx));
        for (const idx of keep) {
          const ed = edges[idx]; const pa = []; let x = ed.i; while (x >= 0) { pa.push(x); x = pred[x]; } const pb = []; x = ed.j; while (x >= 0) { pb.push(x); x = pred[x]; }
          const A = portWater[ed.a], B = portWater[ed.b];
          seaRoutes.push({ a: A.k, b: B.k, cells: [A.s.cell].concat(pa.reverse(), pb, [B.s.cell]), km: ed.c * cellKm, imp: tierRank(A.s) + tierRank(B.s) >= 3 ? 'trunk' : 'regional', mode: 'sea' });
        }
      } }
    const roadTier = new Uint8Array(N);
    for (const r of roads) { const t = r.imp === 'trunk' ? 1 : r.imp === 'regional' ? 2 : 3; for (const c of r.cells) if (!roadTier[c] || roadTier[c] > t) roadTier[c] = t; }
    const accessFinal = accessibility(roads, ports.map(([s]) => s.cell));
    // 桥梁：道路穿越 2 级以上河流
    const bridges = [];

    // ================= 9. 国家 =================
    progress('人文 · 国家形成', 0.92);
    const urban = settlements.filter(s => s.tier !== 'site');
    const byCiv = new Map();
    for (const s of urban) { const c = civ[s.cell]; if (c > 0) { if (!byCiv.has(c)) byCiv.set(c, []); byCiv.get(c).push(s); } }
    for (const a of byCiv.values()) a.sort((p, q2) => q2.score - p.score);
    let stateCount = Math.min(cfg.countries, urban.length);
    const civPop = new Map(), civUrb = new Map(), civAcc = new Map();
    for (let i = 0; i < N; i++) { const c = civ[i]; if (!byCiv.has(c)) continue; civPop.set(c, (civPop.get(c) || 0) + weight[i]); civAcc.set(c, (civAcc.get(c) || 0) + weight[i] * accessFinal[i]); }
    for (const [c, a] of byCiv) civUrb.set(c, a.reduce((s, x) => s + x.score, 0));
    const shares = m => { const t = [...m.values()].reduce((a, b) => a + b, 0) || 1; return new Map([...m].map(([k, v]) => [k, v / t])); };
    const sP = shares(civPop), sU = shares(civUrb), sA = shares(civAcc);
    const profileMul = c => ({ pastoral: 0.7, 'new-world': 0.55, tribal: 0.75, maritime: 1.15, highland: 1.1, agrarian: 1 })[subsistence[c - 1]] || 1;
    const qw = new Map([...byCiv.keys()].map(c => [c, (0.46 * sP.get(c) + 0.36 * sU.get(c) + 0.18 * (sA.get(c) || 0)) * profileMul(c)]));
    const quotas = new Map(); { const keys = [...byCiv.keys()]; const tw = keys.reduce((s, c) => s + qw.get(c), 0) || 1; let used = 0; const rem = [];
      for (const c of keys) { const exact = stateCount * qw.get(c) / tw; let v = Math.max(1, Math.floor(exact)); v = Math.min(v, byCiv.get(c).length); quotas.set(c, v); used += v; rem.push([exact - Math.floor(exact), c]); }
      rem.sort((a, b) => b[0] - a[0]); for (const [, c] of rem) { if (used >= stateCount) break; if (quotas.get(c) < byCiv.get(c).length) { quotas.set(c, quotas.get(c) + 1); used++; } }
      stateCount = used; }
    // 状态形成场
    const stateFr = new Float32Array(N);
    let maxDen = 0; for (let i = 0; i < N; i++) if (density[i] > maxDen) maxDen = density[i];
    for (let i = 0; i < N; i++) stateFr[i] = domain[i] ? Math.max(0.25, 1 + 7.2 * eN[i] * eN[i] + 18 * slopeN[i] + 1.9 * (1 - pot[i]) + 2.6 * (1 - hab[i]) - 0.08 * (order[i] ? 1 : 0) - 0.22 * density[i] / maxDen - 0.68 * accessFinal[i]) : 0;
    const stateTrans = new Float32Array(8 * N);
    for (let d = 0; d < 8; d++) for (let i = 0; i < N; i++) {
      if (!land[i]) continue; const j = NB[i * 8 + d]; if (j < 0 || !land[j]) continue;
      const oi = order[i], oj = order[j], mb = (oi >= 2) !== (oj >= 2), amb = (oi >= 3) !== (oj >= 3), rs = Math.max(oi, oj);
      let p = 3.65 * phys[d * N + i];
      const physRiver = (amb ? 5 + 2.8 * clamp(rs - 2, 0, 3) : 0) + (mb ? 1.8 : 0);
      p -= (3.65 - 2.75) * physRiver;
      const rd = Math.min(accessFinal[i], accessFinal[j]);
      p *= mb ? 1 - 0.1 * rd : 1 - 0.15 * rd;
      if (mb) p += 11 + 2.2 * clamp(rs - 2, 0, 3);
      if (language[i] > 0 && language[j] > 0 && language[i] !== language[j]) p += 8;
      stateTrans[d * N + i] = Math.max(0, p) * 0.35; // 本网格格距较大：按比例缩放到与摩擦同量级
    }
    // 有治理的核心腹地（有界可达）
    const urbanSeeds = urban.filter(s => civ[s.cell] > 0).map(s => ({ cell: s.cell, strength: 1, domain: civ[s.cell] }));
    const nuclei = territory(urbanSeeds, { valid: domain, friction: stateFr, trans: stateTrans, road: accessFinal, owner: civ, max: 11.5 * kmScale * 3 }).labels;
    if (P.newWorld) { const nwSeeds = urbanSeeds.filter(sd => newW[sd.cell]); if (nwSeeds.length) { const nw = territory(nwSeeds, { valid: domain, friction: stateFr, trans: stateTrans, road: accessFinal, owner: civ, max: 11.5 * kmScale * 9 }).labels; for (let i = 0; i < N; i++) if (nw[i] && newW[i]) nuclei[i] = 1; } }
    // 无国家边疆（游牧、部族与弱治理带）
    const frontier = new Uint8Array(N);
    { let nwFront = 0; if (era !== 'industrial') for (let i = 0; i < N; i++) if (newW[i] && domain[i] && !nuclei[i]) nwFront++;
      const target = Math.max(0, Math.round(validCount * cfg.tribal) - nwFront);
      const prop = new Float32Array(N);
      for (let i = 0; i < N; i++) if (domain[i]) { const b = biome[i]; prop[i] = 0.94 * (1 - density[i] / maxDen) + 0.76 * (1 - accessFinal[i]) + 0.56 * (1 - pot[i]) + 0.48 * (b === 3 || b === 9 ? 1 : 0) + 0.42 * (b === 7 || b === 8 ? 1 : 0) + 0.32 * (b === 2 || b === 4 || b === 5 || b === 10 || b === 11 ? 1 : 0) + 0.58 * (b === 1 || b === 12 ? 1 : 0) + 0.42 * clamp((eN[i] - 0.42) / 0.34, 0, 1) + 0.3 * clamp((0.1 - annualN[i]) / 0.1, 0, 1) + 0.28 * (civ[i] <= 0 ? 1 : 0) - 0.16 * clamp(order[i] / 5, 0, 1); }
      const r = Math.max(4, Math.round(Math.min(W, H) / 54 * 1.4));
      const sup = boxBlur(Float32Array.from(domain), r), mac = boxBlur(prop, r);
      const fs = new Float32Array(N);
      for (let i = 0; i < N; i++) if (domain[i]) { let mx = 0; for (let d = 0; d < 8; d++) mx = Math.max(mx, stateTrans[d * N + i]); fs[i] = 0.82 * (sup[i] > 1e-6 ? mac[i] / sup[i] : 0) + 0.18 * prop[i] + 0.012 * mx; }
      const protectedC = new Uint8Array(N); for (const s of urban) { protectedC[s.cell] = 1; for (let d = 0; d < 8; d++) { const j = NB[s.cell * 8 + d]; if (j >= 0) protectedC[j] = 1; } }
      const cand = [];
      for (let i = 0; i < N; i++) { if (!domain[i] || protectedC[i] || nuclei[i]) continue; const rel = density[i] / Math.max(meanDensity, 1e-9); const settled = rel >= 0.75 || (rel >= 0.45 && (accessFinal[i] >= 0.25 || pot[i] >= 0.45)); if (settled) continue; cand.push(i); }
      cand.sort((a, b) => fs[b] - fs[a]);
      const take = Math.min(target, cand.length);
      for (let k = 0; k < take; k++) frontier[cand[k]] = 1;
      // 新大陆：未治理部分全部为边疆
      for (let i = 0; i < N; i++) if (newW[i] && domain[i] && !nuclei[i] && era !== 'industrial') frontier[i] = 1;
      // 去掉零碎小块
      const comp = components(frontier), size = new Int32Array(comp.count + 1); for (let i = 0; i < N; i++) size[comp[i]]++;
      const minC = Math.max(12, Math.round(validCount * 0.0004));
      for (let i = 0; i < N; i++) if (frontier[i] && size[comp[i]] < minC) frontier[i] = 0;
    }
    const governed = new Uint8Array(N); for (let i = 0; i < N; i++) governed[i] = domain[i] && !frontier[i] && civ[i] > 0 ? 1 : 0;
    // 城市腹地（控制区）→ 按自然分隔切成微区
    const ctrlSeeds = urban.filter(s => governed[s.cell]).map(s => ({ cell: s.cell, strength: clamp(0.92 + 0.18 * s.score + 0.12 * accessFinal[s.cell], 0.82, 1.35), domain: civ[s.cell], s }));
    const CT = territory(ctrlSeeds, { valid: governed, friction: stateFr, trans: stateTrans, road: accessFinal, owner: civ });
    // 自然分隔：跨越强屏障（≥ 阈值）的邻接被切断
    const BARRIER = 14 * 0.35;
    const region = new Int32Array(N).fill(0); let nReg = 0;
    { const st = new Int32Array(N);
      for (let s = 0; s < N; s++) { if (!CT.labels[s] || region[s]) continue; nReg++; let t = 0; st[t++] = s; region[s] = nReg; const lb = CT.labels[s];
        while (t) { const i = st[--t]; for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j < 0 || region[j] || CT.labels[j] !== lb) continue; if (stateTrans[d * N + i] >= BARRIER) continue; region[j] = nReg; st[t++] = j; } } } }
    // 合并过碎的微区（< 3 格）到同腹地邻区
    const regCtrl = new Int32Array(nReg + 1), regSize = new Int32Array(nReg + 1), regRes = new Float64Array(nReg + 1), regCiv = new Int32Array(nReg + 1), regArea = new Float64Array(nReg + 1);
    for (let i = 0; i < N; i++) { const r = region[i]; if (!r) continue; regCtrl[r] = CT.labels[i]; regSize[r]++; regCiv[r] = civ[i]; regArea[r] += area[(i / W) | 0]; regRes[r] += 0.52 * density[i] / maxDen + 0.28 * pot[i] + 0.2 * accessFinal[i]; }
    for (let i = 0; i < N; i++) { const r = region[i]; if (!r || regSize[r] >= 3) continue; for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j >= 0 && region[j] && region[j] !== r && regCtrl[region[j]] === regCtrl[r] && regSize[region[j]] >= 3) { region[i] = region[j]; break; } } }
    // 区块邻接图
    const edgesMap = new Map();
    for (let i = 0; i < N; i++) { const a = region[i]; if (!a) continue; for (const d of [4, 6]) { const j = NB[i * 8 + d]; if (j < 0) continue; const b = region[j]; if (!b || b === a || regCiv[a] !== regCiv[b]) continue; const key = a < b ? a * 1048576 + b : b * 1048576 + a; let ed = edgesMap.get(key); if (!ed) { ed = { a: Math.min(a, b), b: Math.max(a, b), n: 0, sum: 0, hard: 0, road: 0, min: Infinity }; edgesMap.set(key, ed); } const v = stateTrans[d * N + i] / 0.35; ed.n++; ed.sum += v; if (v >= 5) ed.hard++; ed.road += Math.min(accessFinal[i], accessFinal[j]); ed.min = Math.min(ed.min, v); } }
    const gEdges = [...edgesMap.values()].map(ed => { const mean = ed.sum / ed.n, hard = ed.hard / ed.n, rd = ed.road / ed.n; return { ...ed, mean, hardShare: hard, roadShare: rd, cross: Math.max(0.25, 0.85 + 0.62 * ed.min * 0.2 + 0.1 * mean * 0.2 + 0.85 * hard - 0.55 * rd) }; });
    const adj = Array.from({ length: nReg + 1 }, () => []);
    gEdges.forEach(ed => { adj[ed.a].push([ed.b, ed]); adj[ed.b].push([ed.a, ed]); });
    // 区块之间的行进天数估计
    const regDays = ed => { const dist = 0.5 * (Math.sqrt(regArea[ed.a]) + Math.sqrt(regArea[ed.b])); const r = clamp(ed.roadShare, 0, 1); return Math.max(0.01, dist * ((1 - r) / AD.walk + r / AD.road) * (1 + 0.12 * ed.cross)); };
    // 选择国家核心（跨自然分区优先）
    const cores = [];
    for (const [c, list] of byCiv) {
      const quota = quotas.get(c) || 0; if (!quota) continue;
      let cells = 0; for (let i = 0; i < N; i++) if (governed[i] && civ[i] === c) cells++;
      const minD = Math.max(1, Math.sqrt(Math.max(cells, 1) / quota) * 0.42 * 1.6);
      const ranked = list.filter(s => region[s.cell]).sort((a, b) => (b.score + 0.3 * accessFinal[b.cell] + (b.tier === 'metropolis' ? 0.16 : b.tier === 'city' ? 0.08 : 0)) - (a.score + 0.3 * accessFinal[a.cell] + (a.tier === 'metropolis' ? 0.16 : a.tier === 'city' ? 0.08 : 0)));
      const sel = [], def = [];
      for (const s of ranked) { if (sel.length >= quota) break; if (sel.every(o => region[o.cell] !== region[s.cell] && gdist(o.cell, s.cell) >= minD)) sel.push(s); else def.push(s); }
      for (const s of def) { if (sel.length >= quota) break; if (sel.every(o => region[o.cell] !== region[s.cell])) sel.push(s); }
      sel.forEach(s => cores.push({ s, civ: c }));
    }
    // 国家实力
    { const byC = new Map(); cores.forEach(k => { if (!byC.has(k.civ)) byC.set(k.civ, []); byC.get(k.civ).push(k); });
      for (const [c, list] of byC) { const vals = list.map(k => k.s.score), lo = Math.min(...vals), span = Math.max(Math.max(...vals) - lo, 1e-12); const sorted = list.slice().sort((a, b) => b.s.score - a.s.score); const major = Math.max(1, Math.round(list.length * 0.18));
        list.forEach(k => { k.strength = clamp(0.72 + 0.6 * (k.s.score - lo) / span + 0.24 * accessFinal[k.s.cell] + (sorted.indexOf(k) < major ? 0.35 : 0) + (k.s.cell === civSeeds[c - 1].cell ? 0.4 : 0), 0.68, 1.75); }); } }
    // 区块图上的国家扩张（优先队列近似原版同步轮次）
    function formStates(coreList) {
      const owner = new Int32Array(nReg + 1), cost = new Float64Array(nReg + 1).fill(Infinity), days = new Float64Array(nReg + 1).fill(Infinity), depth = new Int32Array(nReg + 1);
      const nS = coreList.length, res = new Float64Array(nS + 1), cnt = new Int32Array(nS + 1), budget = new Float64Array(nS + 1), cap = new Float64Array(nS + 1);
      const meanArea = regArea.reduce((a, b) => a + b, 0) / Math.max(1, nReg);
      const hp = new Heap(1024), prop = [];
      coreList.forEach((k, idx) => { const st = idx + 1, r = region[k.s.cell]; if (owner[r]) return; owner[r] = st; cost[r] = 0; days[r] = 0; res[st] = Math.max(0.05, regRes[r]); cnt[st] = 1; budget[st] = AD.response * k.strength * (1 + 0.18 * Math.log1p(regRes[r] / 10)) * (era === 'industrial' ? 3.5 : 1); });
      // 软容量：同文明区块数 × 实力权重
      { const civRegions = new Map(); for (let r = 1; r <= nReg; r++) civRegions.set(regCiv[r], (civRegions.get(regCiv[r]) || 0) + 1);
        const byC = new Map(); coreList.forEach((k, idx) => { if (!byC.has(k.civ)) byC.set(k.civ, []); byC.get(k.civ).push(idx + 1); });
        for (const [c, sts] of byC) { const w = sts.map(st => Math.pow(coreList[st - 1].strength, 1.35) * Math.pow(Math.max(0.2, regRes[region[coreList[st - 1].s.cell]] / 10), 0.28)); const tw = w.reduce((a, b) => a + b, 0); sts.forEach((st, k) => cap[st] = Math.max(1, (civRegions.get(c) || 1) * w[k] / tw)); } }
      const score = (st, parent, target, ed) => {
        const k = coreList[st - 1], power = k.strength * (1 + 0.16 * Math.log1p(res[st]));
        const load = cnt[st] / cap[st], dep = depth[parent] + 1;
        const travel = (0.5 + Math.sqrt(Math.max(1, regArea[target]) / meanArea)) / Math.max(0.35, power);
        const nd = days[parent] + regDays(ed);
        return cost[parent] + ed.cross + travel + 0.3 * load * load + 0.055 * dep * dep - 0.16 * Math.log1p(regRes[target]) - 0.1 * Math.log1p(ed.n) + 0.6 * nd / Math.max(1, budget[st]);
      };
      const offer = (parent) => { const st = owner[parent]; for (const [t, ed] of adj[parent]) { if (owner[t]) continue; const nd = days[parent] + regDays(ed); if (nd > budget[st]) continue; prop.push([st, parent, t, ed]); hp.push(prop.length - 1, score(st, parent, t, ed)); } };
      for (let r = 1; r <= nReg; r++) if (owner[r]) offer(r);
      while (hp.n) {
        const pi = hp.pop(), sv = hp.top; const [st, parent, t, ed] = prop[pi];
        if (owner[t]) continue;
        const now = score(st, parent, t, ed);
        if (now > sv + 1e-9 && hp.n && now > hp.v[0]) { prop.push([st, parent, t, ed]); hp.push(prop.length - 1, now); continue; }
        owner[t] = st; cost[t] = now; days[t] = days[parent] + regDays(ed); depth[t] = depth[parent] + 1; cnt[st]++; res[st] += regRes[t];
        offer(t);
      }
      return { owner, days, budget };
    }
    let F = formStates(cores);
    // 边界整定：把开阔接缝上的边缘区块转给邻国，使边界落在可防御的屏障上
    function settle(owner, coreList) {
      const coreReg = new Set(coreList.map(k => region[k.s.cell]));
      const members = new Map(); for (let r = 1; r <= nReg; r++) if (owner[r]) { if (!members.has(owner[r])) members.set(owner[r], new Set()); members.get(owner[r]).add(r); }
      const energy = (r, cand) => { let en = 0; for (const [nbR, ed] of adj[r]) { const lw = 1 + 0.1 * Math.log1p(ed.n); if (owner[nbR] === cand) en += Math.max(0, 0.18 * ed.mean * 0.2 + 1.8 * ed.hardShare) * lw; else en += (4.5 * (1 - ed.hardShare) + 0.3 * Math.max(0, 5 - ed.mean * 0.2) + 0.05) * lw; } return en; };
      const connectedWithout = (r, st) => { const rem = members.get(st); if (!rem || rem.size <= 1) return false; const start = [...rem].find(x => x !== r); const seen = new Set([start]), stack = [start]; while (stack.length) { const c = stack.pop(); for (const [nbR] of adj[c]) if (nbR !== r && rem.has(nbR) && !seen.has(nbR)) { seen.add(nbR); stack.push(nbR); } } return seen.size === rem.size - 1; };
      for (let pass = 0; pass < 6; pass++) {
        let moved = 0;
        for (let r = 1; r <= nReg; r++) {
          const def = owner[r]; if (!def || coreReg.has(r)) continue;
          const cands = new Set(); for (const [nbR] of adj[r]) if (owner[nbR] && owner[nbR] !== def) cands.add(owner[nbR]);
          if (!cands.size) continue;
          const cur = energy(r, def); let best = def, bv = cur - 0.6;
          for (const c of cands) { const v = energy(r, c); if (v < bv) { bv = v; best = c; } }
          if (best !== def && connectedWithout(r, def)) { owner[r] = best; members.get(def).delete(r); members.get(best).add(r); moved++; }
        }
        if (!moved) break;
      }
      return owner;
    }
    F.owner = settle(F.owner, cores);
    // 每格国家
    let state = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) if (region[i] && F.owner[region[i]]) state[i] = F.owner[region[i]] - 1;
    // 孤立的有城市区块：海运连接到母国（在响应天数内），否则独立城邦
    const cityByRegion = new Map(); urban.forEach(s => { const r = region[s.cell]; if (r && !F.owner[r]) { if (!cityByRegion.has(r) || cityByRegion.get(r).score < s.score) cityByRegion.set(r, s); } });
    const extraCores = [];
    for (const [r, s] of cityByRegion) {
      let attached = false;
      const myPorts = seaRoutes.filter(sr => settlements[sr.a] === s || settlements[sr.b] === s);
      for (const sr of myPorts) { const other = settlements[sr.a] === s ? settlements[sr.b] : settlements[sr.a]; const st = state[other.cell]; if (st >= 0 && sr.km / AD.sea < F.budget[st + 1] * 0.5 && civ[other.cell] === civ[s.cell]) { // 同文明海外领地
          const stack = [r], seen = new Set([r]); while (stack.length) { const c = stack.pop(); F.owner[c] = st + 1; for (const [nbR] of adj[c]) if (!F.owner[nbR] && !seen.has(nbR)) { seen.add(nbR); stack.push(nbR); } } attached = true; break; } }
      if (!attached && regSize[r] >= 2) extraCores.push({ s, civ: civ[s.cell], strength: 0.8, island: true });
    }
    if (extraCores.length) {
      const base = cores.length;
      extraCores.forEach((k, idx) => { const st = base + idx + 1; const stack = [region[k.s.cell]], seen = new Set(stack); let n = 0; while (stack.length && n < 40) { const c = stack.pop(); if (F.owner[c]) continue; F.owner[c] = st; n++; for (const [nbR] of adj[c]) if (!F.owner[nbR] && !seen.has(nbR)) { seen.add(nbR); stack.push(nbR); } } });
      cores.push(...extraCores);
    }
    state.fill(-1); for (let i = 0; i < N; i++) if (region[i] && F.owner[region[i]]) state[i] = F.owner[region[i]] - 1;
    // 仍未分配的有治理土地 → 边疆
    for (let i = 0; i < N; i++) if (domain[i] && state[i] < 0) frontier[i] = 1;
    // 去掉无供养的小国：人口过少且只有一个区块 → 并入同文明邻国或成为边疆
    { const sPop = new Float64Array(cores.length), sReg = new Int32Array(cores.length); for (let i = 0; i < N; i++) if (state[i] >= 0) sPop[state[i]] += weight[i]; for (let r = 1; r <= nReg; r++) if (F.owner[r]) sReg[F.owner[r] - 1]++;
      const minPop = 0.0006;
      cores.forEach((k, st) => { if (sPop[st] >= minPop || sReg[st] > 2) return; k.dead = true; });
      for (let r = 1; r <= nReg; r++) { const st = F.owner[r] - 1; if (st < 0 || !cores[st].dead) continue; let best = -1; for (const [nbR, ed] of adj[r]) { const o = F.owner[nbR] - 1; if (o >= 0 && !cores[o].dead && regCiv[nbR] === regCiv[r] && (best < 0 || ed.cross < best[1])) best = [o, ed.cross]; } F.owner[r] = best && best[0] !== undefined && best !== -1 ? best[0] + 1 : 0; }
    }
    // 重新编号
    const alive = cores.map((k, i) => [k, i]).filter(([k]) => !k.dead);
    const remap = new Int32Array(cores.length).fill(-1); alive.forEach(([, i], n) => remap[i] = n);
    const finalCores = alive.map(([k]) => k);
    state.fill(-1); for (let i = 0; i < N; i++) if (region[i] && F.owner[region[i]]) { const st = remap[F.owner[region[i]] - 1]; if (st >= 0) state[i] = st; }
    for (let i = 0; i < N; i++) { frontier[i] = domain[i] && state[i] < 0 ? 1 : 0; }
    // 无路可达的远方不算实控：从首都沿道路计行程天数，超出行政响应很多、且离本国道路网很远的格子剥离为边疆（仍为名义宣称，交给部族）
    { const roadD = new Uint8Array(N).fill(255), q = []; for (let i = 0; i < N; i++) if (roadTier[i] && state[i] >= 0) { roadD[i] = 0; q.push(i); }
      for (let h = 0; h < q.length; h++) { const i = q[h]; if (roadD[i] >= 6) continue; for (let d = 0; d < 8; d++) { const j = NB[i * 8 + d]; if (j < 0 || state[j] !== state[i] || roadD[j] <= roadD[i] + 1) continue; roadD[j] = roadD[i] + 1; q.push(j); } }
      const hp = new Heap(N), dd = new Float64Array(N).fill(Infinity);
      finalCores.forEach(k => { if (state[k.s.cell] < 0) return; dd[k.s.cell] = 0; hp.push(k.s.cell, 0); });
      while (hp.n) { const i = hp.pop(), c = hp.top; if (c !== dd[i]) continue; const st = state[i], y = (i / W) | 0;
        for (let d = 0; d < 8; d++) { const j = NB[i * 8 + d]; if (j < 0 || state[j] !== st) continue; const len = DL[d] * cellKm * (d === 1 || d === 6 ? 1 : 0.5 + 0.5 * cosL[y]); const sp = roadTier[j] ? AD.road : AD.walk / Math.max(1, stateFr[j] * 0.5); const nc = c + len / sp; if (nc < dd[j]) { dd[j] = nc; hp.push(j, nc); } } }
      let released = 0;
      for (let i = 0; i < N; i++) { const st = state[i]; if (st < 0) continue; const k = finalCores[st]; if (i === k.s.cell) continue;
        const bud = AD.response * k.strength * (era === 'industrial' ? 3.5 : 1) * 0.35;
        if (isFinite(dd[i]) && dd[i] > bud * (G.debugSociety && G.debugSociety.k || 2.2) && roadD[i] > (G.debugSociety && G.debugSociety.r || 5)) { /* 海外领地（陆路不可达）保留 */ state[i] = -1; frontier[i] = domain[i] || land[i] && !ice[i] ? 1 : 0; released++; } }
      if (G.debugSociety) { G.debugSociety.released = released; let own = 0; for (let i = 0; i < N; i++) if (state[i] >= 0) own++; G.debugSociety.owned = own; } }
    const nK = finalCores.length;
    finalCores.forEach((k, st) => { state[k.s.cell] = st; frontier[k.s.cell] = 0; k.s.capital = st; });

    // ================= 10. 省份 =================
    progress('人文 · 省份', 0.93);
    const factor = [0.65, 1, 1.4][cfg.admin] || 1;
    const sCities = Array.from({ length: nK }, () => []), sArea = new Float64Array(nK), sPop2 = new Float64Array(nK);
    urban.forEach(s => { const st = state[s.cell]; if (st >= 0) sCities[st].push(s); });
    for (let i = 0; i < N; i++) if (state[i] >= 0) { sArea[state[i]] += area[(i / W) | 0]; sPop2[state[i]] += weight[i]; }
    const totalUrbanOwned = sCities.reduce((a, b) => a + b.length, 0) || 1;
    const totPop2 = sPop2.reduce((a, b) => a + b, 0), sqrtAreaSum = sArea.reduce((a, b) => a + Math.sqrt(b), 0); void totalUrbanOwned;
    const provTarget = Math.max(nK, Math.round(urban.length * 0.32 * factor));
    // 先有国家、再分省：每个国家按“人口为主、面积兜底”定省数；城市不够时在人口相对集中处新设县城为省会
    const provSeeds = [], provState = [], provSeat = [], newSeats = [];
    const sCells = Array.from({ length: nK }, () => []); for (let i = 0; i < N; i++) if (state[i] >= 0 && !ice[i]) sCells[state[i]].push(i);
    const cellsPerProv = sCells.reduce((a, b) => a + b.length, 0) / Math.max(1, provTarget);
    for (let st = 0; st < nK; st++) {
      const cells = sCells[st]; if (!cells.length) continue;
      const list = sCities[st].slice().sort((a, b) => (b.capital === st) - (a.capital === st) || b.score - a.score);
      const popShare = sPop2[st] / Math.max(1e-9, totPop2);
      const nPop = provTarget * popShare, nArea = cells.length / (cellsPerProv * 2.6); // 稀疏地区的省最多约为平均面积的 2.6 倍
      let n = Math.round(Math.max(nPop * 0.85 + nArea * 0.15, nArea));
      const jit = ((st * 2654435761) >>> 0) / 4294967296 - 0.5, floorN = cells.length >= 30 ? (0.95 * Math.log2(cells.length / 18) + jit) * Math.sqrt(factor) : 1; // 面积保底随面积连续增长（对数），带个体差异
      n = Math.max(n, Math.round(floorN));
      n = Math.max(1, Math.min(n, Math.floor(cells.length / 9) || 1));
      const meanDen = sPop2[st] / Math.max(1e-9, sArea[st]);
      const relDen = c => Math.min(3, (weight[c] / area[(c / W) | 0]) / Math.max(1e-12, meanDen));
      const sepAt = (c, base) => base * Math.max(0.35, Math.min(2.2, Math.pow(1 / Math.max(0.05, relDen(c)), 0.5)));
      const chosen = list.length ? [list[0]] : []; let sep = Math.sqrt(sArea[st] / n) / cellKm * 0.62;
      for (let pass = 0; pass < 5 && chosen.length < n; pass++) { for (const c0 of list) { if (chosen.length >= n) break; if (chosen.includes(c0)) continue; if (chosen.every(o => gdist(o.cell, c0.cell) >= Math.min(sepAt(o.cell, sep), sepAt(c0.cell, sep)))) chosen.push(c0); } sep *= 0.72; }
      // 补足：在离现有省会最远、且人口相对集中的地方新设县城
      const seedCells = chosen.map(c0 => c0.cell);
      while (chosen.length < n) {
        let best = -1, bv = -1, bd = 0;
        for (let k = 0; k < cells.length; k += cells.length > 3000 ? 2 : 1) { const c = cells[k]; let md = seedCells.length ? Infinity : 1e3; for (const o of seedCells) { const d = gdist(o, c); if (d < md) md = d; } const v = md * Math.pow(0.3 + relDen(c), 0.35) * (0.6 + 0.4 * hab[c]); if (v > bv) { bv = v; best = c; bd = md; } }
        if (best < 0 || (seedCells.length && bd < 3.5)) break;
        let c = best, cv = -1; { const y0 = (best / W) | 0, x0 = best - y0 * W; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y0 + dy; if (yy < 0 || yy >= H) continue; const j = yy * W + ((x0 + dx) % W + W) % W; if (state[j] !== st || ice[j]) continue; const v = hab[j] + pot[j] + 0.3 * oceanCoast[j] + 0.2 * (order[j] ? 1 : 0); if (v > cv) { cv = v; c = j; } } }
        const seat = { cell: c, score: 0.3, type: oceanCoast[c] ? 'port' : order[c] ? 'river-city' : 'market', tier: 'town', role: 'seat', newSeat: true };
        const [fx, fy] = toFull(c); seat.fx = fx; seat.fy = fy; seat.fcell = Math.floor(fy) * FW + Math.floor(fx);
        settlements.push(seat); newSeats.push(seat); chosen.push(seat); seedCells.push(c);
      }
      chosen.forEach((c0, k) => { provSeeds.push({ cell: c0.cell, strength: k === 0 ? 1.15 : 1, domain: st + 1 }); provState.push(st); provSeat.push(c0); c0.seat = provSeeds.length - 1; });
    }
    // 接入路网：沿道路代价寻最近的既有道路，修一条地方道路（新设县城、边塞共用）
    function linkToRoads(site) {
      const dist = new Map(), pred = new Map(), hp = new Heap(256); dist.set(site.cell, 0); hp.push(site.cell, 0); let hit = -1;
      while (hp.n) { const i = hp.pop(), c = hp.top; if (c > dist.get(i)) continue; if (roadTier[i] && i !== site.cell) { hit = i; break; } if (c > 400) break;
        for (let d = 0; d < 8; d++) { const j = NB[i * 8 + d]; if (j < 0 || roadFr[j] === Infinity) continue; const nc = c + 0.5 * (roadFr[i] + roadFr[j]) * DL[d]; if (nc < (dist.has(j) ? dist.get(j) : Infinity)) { dist.set(j, nc); pred.set(j, i); hp.push(j, nc); } } }
      if (hit < 0) return false;
      const path = []; let x = hit; while (x !== undefined) { path.push(x); x = pred.get(x); } path.reverse();
      const a = allNodes.push({ cell: site.cell, kind: 'city', s: site }) - 1, b = allNodes.push({ cell: hit, kind: 'junction' }) - 1;
      roads.push({ a, b, cells: path, imp: 'local', mode: 'road' }); for (const c of path) if (!roadTier[c]) roadTier[c] = 3; return true;
    }
    for (const seat of newSeats) { linkToRoads(seat); }
    for (const seat of []) {
      const dist = new Map(), pred = new Map(), hp = new Heap(256); dist.set(seat.cell, 0); hp.push(seat.cell, 0); let hit = -1;
      while (hp.n) { const i = hp.pop(), c = hp.top; if (c > dist.get(i)) continue; if (roadTier[i] && i !== seat.cell) { hit = i; break; } if (c > 400) break;
        for (let d = 0; d < 8; d++) { const j = NB[i * 8 + d]; if (j < 0 || roadFr[j] === Infinity) continue; const nc = c + 0.5 * (roadFr[i] + roadFr[j]) * DL[d]; if (nc < (dist.has(j) ? dist.get(j) : Infinity)) { dist.set(j, nc); pred.set(j, i); hp.push(j, nc); } } }
      if (hit < 0) continue;
      const path = []; let x = hit; while (x !== undefined) { path.push(x); x = pred.get(x); } path.reverse();
      const a = allNodes.push({ cell: seat.cell, kind: 'city', s: seat }) - 1, b = allNodes.push({ cell: hit, kind: 'junction' }) - 1;
      roads.push({ a, b, cells: path, imp: 'local', mode: 'road' }); for (const c of path) if (!roadTier[c]) roadTier[c] = 3;
    }
    const stOwner = new Int32Array(N); for (let i = 0; i < N; i++) stOwner[i] = state[i] + 1;
    const stateValid = Uint8Array.from(state, v => v >= 0 ? 1 : 0);
    // 省域扩张：人口越稠密代价越高 → 稠密区的省小而紧凑，稀疏区的省辽阔
    const provFr = new Float32Array(N); { let md = 0; for (let i = 0; i < N; i++) if (density[i] > md) md = density[i]; for (let i = 0; i < N; i++) provFr[i] = stateFr[i] * (1 + 2.2 * Math.sqrt(density[i] / Math.max(1e-9, md))); }
    const PV = territory(provSeeds, { valid: stateValid, friction: provFr, trans: stateTrans, road: accessFinal, owner: stOwner });
    const province = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) if (state[i] >= 0) province[i] = PV.labels[i] ? PV.labels[i] - 1 : -1;
    // 飞地：取同国最近省
    for (let i = 0; i < N; i++) if (state[i] >= 0 && province[i] < 0) { const st = state[i]; let b = -1, bd = 1e9; provSeeds.forEach((p, k) => { if (provState[k] !== st) return; const dd = gdist(p.cell, i); if (dd < bd) { bd = dd; b = k; } }); province[i] = b; }

    // ================= 11. 名义宣称与实际治理 =================
    progress('人文 · 疆域与治理', 0.94);
    const claimSeeds = [], claimed = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) if (state[i] >= 0) { claimed[i] = state[i]; for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j >= 0 && frontier[j]) { claimSeeds.push({ cell: i, strength: 1, domain: 0, st: state[i] }); break; } } }
    const claimValid = new Uint8Array(N); for (let i = 0; i < N; i++) claimValid[i] = (frontier[i] || (land[i] && ice[i] === 0 && state[i] >= 0)) ? 1 : 0;
    if (claimSeeds.length) {
      const CLM = territory(claimSeeds, { valid: claimValid, friction: stateFr, trans: stateTrans, max: 11.5 * kmScale * 7 });
      for (let i = 0; i < N; i++) if (frontier[i] && CLM.labels[i]) claimed[i] = claimSeeds[CLM.labels[i] - 1].st;
    }
    // 近海岛屿归属：小岛（< 60 格）在国家海岸 250 km 内并入该国最近的省；450 km 内为名义宣称
    { const comp = components(land), csize = new Map(), cstate = new Map(); for (let i = 0; i < N; i++) if (comp[i]) { csize.set(comp[i], (csize.get(comp[i]) || 0) + 1); if (state[i] >= 0) cstate.set(comp[i], 1); }
      const dist = new Float32Array(N).fill(Infinity), src = new Int32Array(N).fill(-1), hp = new Heap(N), maxD = 450 / cellKm;
      for (let i = 0; i < N; i++) if (state[i] >= 0) { dist[i] = 0; src[i] = i; hp.push(i, 0); }
      while (hp.n) { const i = hp.pop(), d = dist[i]; for (let k = 0; k < 8; k++) { const j = NB[i * 8 + k]; if (j < 0) continue; const nd = d + DL[k]; if (nd > maxD || nd >= dist[j]) continue; if (land[j] && state[j] < 0 && cstate.get(comp[j])) continue; dist[j] = nd; src[j] = src[i]; if (!land[j] || state[j] < 0) hp.push(j, nd); } }
      for (let i = 0; i < N; i++) { if (!land[i] || ice[i] || state[i] >= 0 || src[i] < 0 || cstate.get(comp[i])) continue; const st = state[src[i]];
        if (dist[i] * cellKm <= 250 && (csize.get(comp[i]) || 0) < 60) { state[i] = st; frontier[i] = 0; province[i] = province[src[i]]; claimed[i] = st; }
        else claimed[i] = st; } }
    // 实际治理：从首都出发的行程天数（道路加速），超出响应预算的比例
    const gov = new Uint8Array(N), govDays = new Float32Array(N).fill(Infinity);
    { const hp = new Heap(N), dd = new Float64Array(N).fill(Infinity);
      finalCores.forEach((k, st) => { dd[k.s.cell] = 0; hp.push(k.s.cell, 0); });
      while (hp.n) { const i = hp.pop(), c = hp.top; if (c !== dd[i]) continue; const st = state[i]; const y = (i / W) | 0;
        for (let d = 0; d < 8; d++) { const j = NB[i * 8 + d]; if (j < 0 || state[j] !== st) continue; const len = DL[d] * cellKm * (d === 1 || d === 6 ? 1 : 0.5 + 0.5 * cosL[y]); const sp = roadTier[j] ? AD.road : AD.walk / Math.max(1, stateFr[j] * 0.5); const nc = c + len / sp; if (nc < dd[j]) { dd[j] = nc; hp.push(j, nc); } } }
      for (let i = 0; i < N; i++) if (state[i] >= 0) { govDays[i] = dd[i]; const k = finalCores[state[i]]; const bud = AD.response * k.strength * (era === 'industrial' ? 3.5 : 1) * 0.35; gov[i] = Math.round(255 * clamp(1.1 - dd[i] / bud, 0.12, 1)); } }

    // ================= 12. 边塞、关隘与商镇 =================
    progress('人文 · 边塞与商镇', 0.945);
    const late = [];
    { const near = (c, r) => settlements.some(s => gdist(s.cell, c) <= r) || late.some(s => gdist(s.cell, c) <= r);
      // ---- 边关要塞：国家形成之后，沿每段国界设防 ----
      // 1) 道路过境处（干道设关，其余设堡）；2) 国界上的山口；3) 没有道路的长段国界，在最易通行处设塞
      const forts = [], nearF = (c, r) => forts.some(f => gdist(f.cell, c) <= r) || settlements.some(s2 => gdist(s2.cell, c) <= 2);
      const cross = [];
      for (const r of roads) { const w0 = r.imp === 'trunk' ? 3 : r.imp === 'regional' ? 2 : 1; for (let k = 1; k < r.cells.length; k++) { const a = r.cells[k - 1], b = r.cells[k]; if (state[a] !== state[b] && state[a] >= 0 && state[b] >= 0) { const inner = (sPop2[state[a]] >= sPop2[state[b]]) ? b : a; cross.push([inner, w0, r.imp]); } } }
      cross.sort((x, y) => y[1] - x[1]);
      for (const [c, w0, imp] of cross) { if (nearF(c, imp === 'trunk' ? 3 : 4)) continue; forts.push({ cell: c, type: eN[c] > 0.25 || slopeN[c] > 0.05 ? 'pass-fort' : 'fort', imp }); }
      // 国界上的山口：只在确有道路经过时设关
      anchors.filter(a => a.kind === 'pass').forEach(a => { if (!roadTier[a.cell] || state[a.cell] < 0 || nearF(a.cell, 4)) return; let border = false; for (let d = 0; d < 8; d++) { const j = NB[a.cell * 8 + d]; if (j >= 0 && state[j] >= 0 && state[j] !== state[a.cell]) border = true; } if (border) forts.push({ cell: a.cell, type: 'pass-fort', imp: 'pass' }); });
      // 战略要地：干道 / 区域道路翻越山口的最高点（沿路局部最高、两侧都明显更低）
      for (const r of roads) { if (r.imp === 'local') continue; const cs = r.cells;
        for (let k = 4; k < cs.length - 4; k++) { const c = cs[k], h = e[c]; if (h < 1100 || state[c] < 0) continue; let top = true; for (let t = -4; t <= 4; t++) if (t && e[cs[k + t]] > h) { top = false; break; } if (!top) continue;
          const lo = Math.min(...cs.slice(Math.max(0, k - 10), k).map(x => e[x])), hi2 = Math.min(...cs.slice(k + 1, Math.min(cs.length, k + 11)).map(x => e[x])); if (h - lo < 350 || h - hi2 < 350) continue;
          if (nearF(c, 6)) continue; forts.push({ cell: c, type: 'pass-fort', imp: r.imp === 'trunk' ? 'trunk' : 'pass' }); } }
      // 长段国界：在离国界 3 格内的道路上设堡（不另修断头路）
      { const pairs = new Map(); for (let i = 0; i < N; i++) { const a = state[i]; if (a < 0) continue; for (const d of [4, 6]) { const j = NB[i * 8 + d]; if (j < 0) continue; const b = state[j]; if (b < 0 || b === a) continue; const key = Math.min(a, b) * 4096 + Math.max(a, b); let o = pairs.get(key); if (!o) { o = []; pairs.set(key, o); } o.push(i); } }
        for (const [, cellsB] of pairs) { const want = Math.floor(cellsB.length / 26); let have = forts.filter(f => cellsB.some(c => gdist(c, f.cell) <= 3)).length; if (have >= want) continue;
          const cand = []; for (const c of cellsB) { const y = (c / W) | 0, x = c - y * W; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; const j = yy * W + ((x + dx) % W + W) % W; if (roadTier[j] && state[j] >= 0) cand.push(j); } }
          cand.sort((a, b) => roadTier[a] - roadTier[b]); for (const c of cand) { if (have >= want) break; if (nearF(c, 8)) continue; forts.push({ cell: c, type: eN[c] > 0.25 ? 'pass-fort' : 'fort', imp: 'wall' }); have++; } } }
      for (const f of forts) late.push({ cell: f.cell, score: 0.3, type: f.type, tier: 'site', role: 'military-post', border: f.imp !== 'trunk' && f.imp !== 'pass' || true, gate: f.imp }); // 均在既有道路上
      const budget = late.length;
      const deg = new Map(); for (const r of roads) for (const c of [r.cells[0], r.cells[r.cells.length - 1]]) deg.set(c, (deg.get(c) || 0) + 1);
      const jn = []; { const cnt = new Uint8Array(N); for (const r of roads) for (const c of r.cells) if (cnt[c] < 255) cnt[c]++; for (let i = 0; i < N; i++) if (cnt[i] >= 3 && state[i] >= 0) jn.push(i); }
      jn.sort((a, b) => accessFinal[b] - accessFinal[a]);
      let trade = 0; for (const c of jn) { if (trade >= Math.round(lateReserve * 0.5)) break; if (near(c, 5)) continue; late.push({ cell: c, score: 0.35, type: 'market', tier: 'town', role: 'trade' }); trade++; } void budget;
      // 有人居住的岛屿：没有聚落的岛至少有一处渔港或岛村（大岛按面积多设几处），不计入城镇预算
      { const comp = components(land, true), info = new Map();
        for (let i = 0; i < N; i++) { const k = comp[i]; if (!k) continue; let o = info.get(k); if (!o) { o = { n: 0, cells: [] }; info.set(k, o); } o.n++; if (o.cells.length < 4000) o.cells.push(i); }
        const has = new Map(); for (const s of settlements.concat(late)) { const k = comp[s.cell]; has.set(k, (has.get(k) || 0) + 1); }
        for (const [k, o] of info) { if (o.n > 1500) continue; const want = Math.min(4, Math.ceil(o.n / 40)) - (has.get(k) || 0); if (want <= 0) continue;
          const cand = o.cells.filter(i => civ[i] > 0 && !ice[i]).sort((a, b) => (oceanCoast[b] - oceanCoast[a]) || (pot[b] + hab[b] - pot[a] - hab[a]));
          let made = 0; for (const c of cand) { if (made >= want) break; if (late.some(s => comp[s.cell] === k && gdist(s.cell, c) < 3) || settlements.some(s => comp[s.cell] === k && gdist(s.cell, c) < 3)) continue;
            late.push({ cell: c, score: 0.25, type: oceanCoast[c] ? 'island-port' : 'market', tier: o.n >= 25 && !made ? 'town' : 'site', role: 'island' }); made++; } } }
    }

    // ================= 13. 命名（文化库） =================
    progress('人文 · 文化库命名', 0.95);
    // 文化库：使用世界设置里冻结的所选文化库（与原版一致：至少一个；按生计大类匹配）
    const BUILTIN = G.CULTURE_LIBRARIES || [];
    let chosen = (Array.isArray(cfg.cultureSelection) ? BUILTIN.filter(l => cfg.cultureSelection.includes(l.id)) : BUILTIN.slice()).concat(cfg.customLibraries || []);
    { const byId = new Map(); for (const l of chosen) byId.set(l.id, l); chosen = [...byId.values()]; } // 改过的内置库（同 id）覆盖原版
    if (!chosen.length) chosen = BUILTIN.slice();
    if (G.CultureExt && G.CultureExt.preset) chosen = chosen.map(l => G.CultureExt.preset(l)); // 国号后缀预设（改过的内置库：没改过的项也换成预设）
    const LIBS = chosen.map(l => ({ ...l, n: Object.assign({ states: [], provinces: [], cities: [], mountains: [], rivers: [], lakes: [], seas: [], regions: [] }, l.n || {}), t: Object.assign({ monarchy: ['王国'], empire: ['帝国'], republic: ['共和国'], cityRepublic: ['城邦共和国'], nomadic: ['部族邦联'], chiefdom: ['酋邦'], league: ['氏族联盟'] }, Object.fromEntries(Object.entries(l.t || {}).filter(([k, v]) => k === 'duchy' || !Array.isArray(v) || v.length))), /* 自定义库留空的后缀用默认值（公国留空 = 不设这一级） */ c: l.c && l.c.roots && l.c.roots.length ? l.c : { roots: ['安', '宁', '平', '川', '岚'], prefixes: ['东', '西', '南', '北', '上'], suffixes: ['阳', '州', '原', '城', '泽'] } }));
    const nr = mulberry32(cfg.seed + 7);
    const usedNames = new Set();
    const libFor = (() => { const usedLib = new Set(); return (cat) => {
      let pool = LIBS.filter(l => l.cat === cat && !usedLib.has(l.id)); if (!pool.length) pool = LIBS.filter(l => l.cat === cat);
      if (!pool.length) pool = LIBS.filter(l => !usedLib.has(l.id) && l.cat !== 'new-world'); if (!pool.length) pool = LIBS.filter(l => l.cat !== 'new-world'); if (!pool.length) pool = LIBS;
      const l = pool[Math.floor(nr() * pool.length)]; usedLib.add(l.id); return l; }; })();
    const civLib = civSeeds.map((s, k) => libFor(subsistence[k]));
    const langLib = langSeeds.map((s, k) => civLib[langFamily[k] - 1]); // 同一文明下的各语言共用该文明的文化库：命名风格在文明内部一致
    const cursors = new Map();
    function draw(lib, key, suffixHint) {
      const list = lib.n[key] || [], ck = lib.id + ':' + key; let c = cursors.get(ck); if (c === undefined) { c = Math.floor(nr() * Math.max(1, list.length)); }
      for (let t = 0; t < list.length; t++) { const name = list[(c + t) % list.length]; if (!usedNames.has(name)) { cursors.set(ck, (c + t + 1) % list.length); usedNames.add(name); return name; } }
      return makeName(lib, key === 'provinces' ? 'prov' : key === 'states' ? 'state' : key === 'cities' ? 'city' : 'other', usedNames, nr, { suffix: suffixHint || '' });
    }
    const libAt = (cell) => civ[cell] > 0 ? civLib[civ[cell] - 1] : (language[cell] > 0 ? langLib[language[cell] - 1] : LIBS[0]); // 按文明取库
    const allSettlements = settlements.concat(late);
    allSettlements.forEach(s => { const lib = libAt(s.cell); s.name = draw(lib, 'cities'); const pl = G.CultureExt ? G.CultureExt.ext(lib).places : null; /* 地名后缀取自文化库：关隘、要塞、港口 */
      if (s.role === 'military-post') { const list = pl ? (s.type === 'pass-fort' ? pl.pass : pl.fort) : null; const suf = list && list.length ? list[Math.floor(nr() * list.length)] : (s.type === 'pass-fort' ? '关' : s.gate === 'wall' ? '塞' : '堡'); if (!s.name.endsWith(suf) && !/[堡关塞寨城]$/.test(s.name)) s.name += suf; }
      else if ((s.type === 'port' || s.type === 'island-port') && pl && pl.port && pl.port.length && nr() < 0.25) { const suf = pl.port[Math.floor(nr() * pl.port.length)]; if (!s.name.endsWith(suf) && s.name.length <= 4 && !usedNames.has(s.name + suf)) { usedNames.add(s.name + suf); s.name += suf; } } });
    // 国家政体与名称
    const kPop = new Float64Array(nK), kArea = new Float64Array(nK), kRegions = new Int32Array(nK);
    for (let i = 0; i < N; i++) if (state[i] >= 0) { kPop[state[i]] += weight[i] * popTotal; kArea[state[i]] += area[(i / W) | 0]; }
    for (let r = 1; r <= nReg; r++) { const st = F.owner[r] ? remap[F.owner[r] - 1] : -1; if (st >= 0) kRegions[st]++; }
    const maxPopByCiv = new Map(); finalCores.forEach((k, st) => maxPopByCiv.set(k.civ, Math.max(maxPopByCiv.get(k.civ) || 0, kPop[st])));
    const countries = finalCores.map((k, st) => {
      const sub = subsistence[k.civ - 1], cities = sCities[st].length;
      let form = 'monarchy';
      const kc = kop[k.s.cell];
      if (sub === 'pastoral' && (kc >= 3 && kc <= 6 || biome[k.s.cell] === 3) && cities <= 6) form = 'nomadic';
      else if (sub === 'new-world' || sub === 'tribal') form = cities <= 2 ? 'chiefdom' : 'league';
      else if (cities <= 1 || k.island) form = sub === 'maritime' ? 'cityRepublic' : 'cityRepublic';
      else if (sub === 'maritime' && cities <= 6) form = nr() < 0.5 ? 'republic' : 'league';
      if (kPop[st] >= (maxPopByCiv.get(k.civ) || 0) && kRegions[st] >= 10 && kPop[st] > popTotal * 0.03) form = 'empire';
      const lib = libAt(k.s.cell), titles = lib.t[form] || lib.t.monarchy || ['国'];
      // 君主国按大小分级：小国（≤3 城，或不到本文明最大国四分之一的人口）用王国之下一级的后缀（公国、伯国、雅尔国……），文化里不设这一级的大小都叫同一个后缀（国、汗国……）
      const duchy = form === 'monarchy' && lib.t.duchy && lib.t.duchy.length && (cities <= 3 || kPop[st] < (maxPopByCiv.get(k.civ) || 0) * 0.25) ? lib.t.duchy : null;
      const base = draw(lib, 'states'), r0 = nr(), title = duchy ? duchy[Math.floor(r0 * duchy.length)] : titles[Math.floor(r0 * titles.length)];
      const FORM = { monarchy: '君主制王国', empire: '帝国', republic: '共和国', cityRepublic: '城邦', nomadic: '游牧政权', chiefdom: '酋邦', league: '联盟' };
      return { name: base + title, short: base, bare: G.CultureExt && G.CultureExt.bareName ? G.CultureExt.bareName(base) : base, form, formLabel: FORM[form], capital: settlements.indexOf(k.s), civ: k.civ - 1, culture: k.civ - 1, language: Math.max(0, language[k.s.cell] - 1), religion: Math.max(0, religionRaw[k.s.cell] - 1), pop: Math.round(kPop[st]), area: Math.round(kArea[st]), cities: cities, strength: k.strength };
    });
    const provinces = provSeeds.map((p, k) => ({ name: draw(libAt(p.cell), 'provinces'), country: provState[k], seat: settlements.indexOf(provSeat[k]) }));
    const shortDraw = (lib, key, max) => { let n = ''; for (let t = 0; t < 12; t++) { n = draw(lib, key).replace(/(地区|平原|高原|山地|盆地|河谷|草原|荒原|半岛|海岸|湿地|荒野|峡地|旷原|牧野|林原|戈壁)$/, ''); if (n.length <= max) return n; } return n.slice(0, max); };
    const cultures = civSeeds.map((s, k) => ({ name: shortDraw(civLib[k], 'states', 4) + '文明', style: civLib[k].label, subsistence: subsistence[k], primary: s.primary, library: civLib[k].label }));
    const languages = langSeeds.map((s, k) => ({ name: shortDraw(langLib[k], 'regions', 4) + '语', family: langFamily[k] - 1 }));
    // 宗教：从所选宗教库生成；按发源地文明的生计大类与写实 / 架空风格匹配库，尽量不重复
    const RLIBS_ALL = (self.RELIGION_LIBRARIES || []), RCHOSEN = (Array.isArray(cfg.religionSelection) ? RLIBS_ALL.filter(l => cfg.religionSelection.includes(l.id)) : RLIBS_ALL.slice()).concat(cfg.customReligions || []);
    const RLIBS = RCHOSEN.length ? RCHOSEN : RLIBS_ALL, usedR = new Map();
    const religions = relSeeds.map((s, k) => {
      const lib = libAt(s.cell), cat = civ[s.cell] > 0 ? subsistence[civ[s.cell] - 1] : lib.cat, fantasy = lib.mode === 'fantasy';
      const score = rl => (rl.cats && rl.cats.includes(cat) ? 2 : 0) + ((rl.mode === 'fantasy') === fantasy ? 1.5 : 0) - 2.5 * (usedR.get(rl.id) || 0) + nr() * 0.8;
      let rl = null, bs = -1e9; for (const x of RLIBS) { const v = score(x); if (v > bs) { bs = v; rl = x; } }
      if (!rl) return { name: shortDraw(lib, 'regions', 3) + '教', type: 'polytheist', spread: 'missionary' };
      const nUsed = usedR.get(rl.id) || 0; usedR.set(rl.id, nUsed + 1);
      const faiths = (rl.names && rl.names.faiths) || [], suf = (rl.names && rl.names.suffix) || ['教'];
      let name = ''; for (let t = 0; t < faiths.length; t++) { const f0 = faiths[(nUsed + t) % faiths.length]; if (!usedNames.has(f0)) { name = f0; break; } }
      if (!name) { for (let t = 0; t < 20 && (!name || usedNames.has(name)); t++) name = shortDraw(lib, 'regions', 3) + suf[Math.floor(nr() * suf.length)]; }
      usedNames.add(name);
      const holyL = (rl.names && rl.names.holy) || [], holy = holyL.length ? holyL[(nUsed + k) % holyL.length] : '';
      const col = rl.color ? rl.color.map((v, i) => Math.max(0, Math.min(255, Math.round(v + (nUsed ? (i === nUsed % 3 ? 38 : -14) * Math.min(2, nUsed) : 0))))) : null;
      return { name, lib: rl.id, libLabel: rl.label, type: rl.type, spread: rl.spread, color: col, symbol: rl.symbol || '✦', relic: rl.relic || '', holy, holyList: (rl.names && rl.names.holy) || [], clergy: rl.clergy || {}, branches: (rl.names && rl.names.branches) || [], heresies: (rl.names && rl.names.heresies) || [] };
    });
    // ---------- 蛮族与羁縻 ----------
    // 称谓取自文化库：t.nomad（游牧部族）、t.tribe（部落）、t.jimi（羁縻制度）；库里没有时用通用称谓
    const TT = (lib, key, def) => (lib && lib.t && Array.isArray(lib.t[key]) && lib.t[key].length ? lib.t[key] : def);
    const pickT = (a) => a[Math.floor(nr() * a.length)];
    const rootName = (lib) => { const C = lib.c && lib.c.roots && lib.c.roots.length ? lib.c : { roots: ['安', '宁', '岚', '川'], prefixes: ['东', '西'], suffixes: ['阳'] };
      for (let t = 0; t < 40; t++) { const w = t % 2 ? pickT(C.roots) + pickT(C.roots) : (C.prefixes && C.prefixes.length ? pickT(C.prefixes) : '') + pickT(C.roots); if (w.length >= 2 && w.length <= 4 && !usedNames.has(w)) { usedNames.add(w); return w; } }
      return pickT(C.roots) + pickT(C.roots); };
    const groupInfo = (lab, keep) => { const info = new Map();
      for (let i = 0; i < N; i++) { const g = lab[i]; if (!g || (keep && !keep(i, g))) continue; let o = info.get(g); if (!o) { o = { n: 0, pop: 0, sx: 0, sy: 0, x0: i % W, best: i, steppe: 0, desert: 0, forest: 0, coast: 0, high: 0, cells: [] }; info.set(g, o); }
        const y = (i / W) | 0; let x = i - y * W; if (x - o.x0 > W / 2) x -= W; if (o.x0 - x > W / 2) x += W; o.n++; o.pop += weight[i]; o.sx += x; o.sy += y; o.cells.push(i);
        if (weight[i] > weight[o.best]) o.best = i; const b = biome[i], kk = kop[i]; if (kk === 5 || kk === 6 || b === 3) o.steppe++; else if (b === 7 || b === 8) o.desert++; if (b === 2 || b === 4 || b === 5 || b === 10 || b === 11) o.forest++; if (oceanCoast[i]) o.coast++; if (eN[i] > 0.4) o.high++; }
      return info; };
    const centreOf = (o) => ({ x: ((((o.sx / o.n) % W) + W) % W + 0.5) * 2, y: (o.sy / o.n + 0.5) * 2 });
    // 1) 蛮族：无主的可居土地（含无路可达而被剥离的远方）。草原荒漠 → 游牧；森林 → 部落；山地、海岸各有其称
    const tribe = new Int16Array(N).fill(-1), tribes = [];
    { const valid = new Uint8Array(N), fCells = [];
      for (let i = 0; i < N; i++) if (state[i] < 0 && land[i] && !ice[i] && (frontier[i] || hab[i] > 0.12) && biome[i] !== 0) { valid[i] = 1; fCells.push(i); }
      const want = Math.max(6, Math.min(60, Math.round(fCells.length / 350))), fsp = Math.max(8, Math.sqrt(fCells.length / want) * 0.85);
      fCells.sort((a, b) => (weight[b] - weight[a]) || (hab[b] - hab[a]));
      const fseeds = spacedSelect(fCells, want, fsp, []).map(c => ({ cell: c, strength: 1 }));
      const lab = fseeds.length ? territory(fseeds, { valid, friction: civFriction, trans: phys }).labels : new Int32Array(N);
      for (const [, o] of groupInfo(lab)) {
        if (o.n < 25) continue;
        const live = o.steppe + 0.4 * o.desert > o.n * 0.45 ? 'pastoral' : o.high > o.n * 0.4 ? 'highland' : o.forest > o.n * 0.35 ? 'forest' : o.coast > o.n * 0.2 ? 'maritime' : 'foraging';
        const lib = libAt(o.best);
        const suf = live === 'pastoral' ? TT(lib, 'nomad', ['部', '部落', '汗帐']) : TT(lib, 'tribe', ['部落', '部', '氏族']);
        const name = rootName(lib) + pickT(suf), c = centreOf(o);
        const id = tribes.length; tribes.push({ name, livelihood: live, pop: Math.round(o.pop * popTotal), x: c.x, y: c.y, size: o.n, claimedBy: claimed[o.best] });
        for (const i of o.cells) tribe[i] = id;
      } }
    // 2) 羁縻：国内实际治理薄弱的大片地区，由土官、旗、边区等自治；名号 = 当地名 + 本国文化库的羁縻称谓
    const jimi = new Int16Array(N).fill(-1), jimis = [];
    { const weak = new Uint8Array(N), wcells = [];
      for (let i = 0; i < N; i++) if (state[i] >= 0 && land[i] && !ice[i] && gov[i] < 0.34 * 255) { weak[i] = 1; wcells.push(i); }
      const comp = new Int32Array(N), seeds = [];
      for (const s0 of wcells) { if (comp[s0]) continue; const list = [s0]; comp[s0] = 1;
        for (let h = 0; h < list.length; h++) for (let d = 0; d < 8; d++) { const j = NB[list[h] * 8 + d]; if (j >= 0 && weak[j] && !comp[j] && state[j] === state[s0]) { comp[j] = 1; list.push(j); } }
        if (list.length < 40) continue;
        const k = Math.max(1, Math.min(3, Math.round(list.length / 220))); list.sort((a, b) => weight[b] - weight[a]);
        for (const c of spacedSelect(list, k, Math.max(4, Math.sqrt(list.length / k) * 0.8), [])) seeds.push({ cell: c, strength: 1 }); }
      const lab = seeds.length ? territory(seeds, { valid: weak, friction: stateFr, trans: stateTrans }).labels : new Int32Array(N);
      for (const [g, o] of groupInfo(lab, (i, g2) => state[i] === state[seeds[g2 - 1].cell])) {
        if (o.n < 20) continue;
        const st = state[seeds[g - 1].cell]; if (jimis.filter(q => q.country === st).length >= 4) continue; const klib = libAt(finalCores[st].s.cell);
        const title = pickT(TT(klib, 'jimi', ['羁縻州', '土司', '自治领'])), name = rootName(libAt(o.best)) + title, c = centreOf(o);
        const id = jimis.length; jimis.push({ name, title, country: st, pop: Math.round(o.pop * popTotal), x: c.x, y: c.y, size: o.n });
        for (const i of o.cells) jimi[i] = id;
      } }
    // 山脊线：沿山体主轴分段，每段取高处（按超出基准高度的平方加权）的重心，平滑后作为山名的排字路径（全分辨率坐标）
    const ridgeOf = (cells, th, base) => {
      const ca = Math.cos(th), sa = Math.sin(th); let mx = 0, my = 0; for (const c of cells) { mx += c[0]; my += c[1]; } mx /= cells.length; my /= cells.length;
      let t0 = 1e9, t1 = -1e9; const ts = cells.map(c => { const t = (c[0] - mx) * ca + (c[1] - my) * sa; if (t < t0) t0 = t; if (t > t1) t1 = t; return t; });
      const L = t1 - t0; if (L < 4) return undefined;
      const nb = Math.max(3, Math.min(24, Math.round(L / 2.5))), bins = Array.from({ length: nb }, () => [0, 0, 0, 0]);
      cells.forEach((c, k) => { const b = Math.min(nb - 1, Math.floor((ts[k] - t0) / L * nb)), w = Math.pow(Math.max(1, c[2] - base), 2); const o = bins[b]; o[0] += c[0] * w; o[1] += c[1] * w; o[2] += w; o[3]++; });
      let P = bins.filter(o => o[3] >= 2 && o[2] > 0).map(o => [o[0] / o[2], o[1] / o[2]]); if (P.length < 3) return undefined;
      for (let it = 0; it < 3; it++) P = P.map((p, k) => k === 0 || k === P.length - 1 ? p : [(P[k - 1][0] + 2 * p[0] + P[k + 1][0]) / 4, (P[k - 1][1] + 2 * p[1] + P[k + 1][1]) / 4]);
      const out = []; for (const [x, y] of P) out.push(Math.round((x + 0.5) * 20) / 10, Math.round((y + 0.5) * 20) / 10); return out; };
    // 自然地名：山脉/高原、海、河、湖、大陆/岛
    const labels = [];
    { const mt = new Int32Array(N); let id = 0;
      for (let s0 = 0; s0 < N; s0++) { if (mt[s0] || !land[s0] || e[s0] < 1500) continue; id++; const comp = [s0]; mt[s0] = id; for (let h = 0; h < comp.length; h++) for (let d = 0; d < 8; d++) { const j = NB[comp[h] * 8 + d]; if (j >= 0 && !mt[j] && land[j] && e[j] >= 1500) { mt[j] = id; comp.push(j); } }
        if (comp.length < 40) continue;
        const y0 = (comp[0] / W) | 0, x0 = comp[0] - y0 * W; let sx = 0, sy = 0, se = 0, best = comp[0];
        const pts = comp.map(i => { const y = (i / W) | 0; let x = i - y * W; if (x - x0 > W / 2) x -= W; if (x0 - x > W / 2) x += W; if (e[i] > e[best]) best = i; se += e[i]; sx += x; sy += y; return [x, y]; });
        const mx = sx / comp.length, my = sy / comp.length; let cxx = 0, cyy = 0, cxy = 0; for (const [x, y] of pts) { cxx += (x - mx) ** 2; cyy += (y - my) ** 2; cxy += (x - mx) * (y - my); }
        const th = 0.5 * Math.atan2(2 * cxy, cxx - cyy), l1 = (cxx + cyy) / 2 + Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy * cxy), l2 = (cxx + cyy) / 2 - Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy * cxy);
        const plateau = se / comp.length > 2700 && Math.sqrt(l1 / Math.max(1, l2)) < 2.2;
        const cx = ((Math.round(mx) % W) + W) % W, cy = Math.round(my), lib = libAt(cy * W + cx);
        let name = draw(lib, 'mountains'); if (plateau) name = name.replace(/(山脉|山|岭)$/, '') + '高原';
        const [px, py] = toFull(best);
        labels.push({ type: plateau ? 'plateau' : 'range', name, x: (mx + 0.5) * 2, y: (my + 0.5) * 2, angle: th, len: Math.sqrt(l1 / comp.length) * 8, size: comp.length, peak: Math.round(e[best]), px, py, ridge: plateau ? undefined : ridgeOf(comp.map((i, k) => [pts[k][0], pts[k][1], e[i]]), th, 1500) });
      } }
    { const cand = []; for (let i = 0; i < N; i++) if (sea[i] && dCoast[i] > 6) cand.push(i); cand.sort((a, b) => dCoast[b] - dCoast[a]);
      const seas = []; for (const i of cand) { if (seas.length >= 10) break; if (seas.every(s => gcKm(s, i) > R * 0.8)) seas.push(i); }
      const bays = []; for (const i of cand) { if (bays.length >= 16) break; if (dCoast[i] > 30 || dCoast[i] < 7) continue; if (seas.concat(bays).every(s => gcKm(s, i) > R * 0.3)) bays.push(i); }
      const nearLib = (i) => { const y = (i / W) | 0, x = i - y * W; for (let r = 2; r < 90; r += 3) for (let k = 0; k < 16; k++) { const a = k / 16 * 2 * Math.PI, xx = ((x + Math.round(Math.cos(a) * r)) % W + W) % W, yy = y + Math.round(Math.sin(a) * r); if (yy < 0 || yy >= H) continue; const j = yy * W + xx; if (land[j] && civ[j] > 0) return libAt(j); } return LIBS[0]; };
      const rank = seas.slice().sort((a, b) => dCoast[b] - dCoast[a]);
      seas.forEach(i => { const big = dCoast[i] * cellKm > 1300 && rank.indexOf(i) < 5; const [x, y] = toFull(i); let n = draw(nearLib(i), 'seas'); if (big) n = n.replace(/(海峡|海湾|海|湾|峡)$/, '') + '洋'; labels.push({ type: big ? 'ocean' : 'sea', name: n, x, y }); });
      bays.forEach(i => { const [x, y] = toFull(i); labels.push({ type: 'sea', name: draw(nearLib(i), 'seas'), x, y }); }); }
    { const comp = components(land); const info = new Map(); let tl = 0;
      for (let i = 0; i < N; i++) if (comp[i]) { tl++; let o = info.get(comp[i]); if (!o) { o = { n: 0, best: i, ice: 0 }; info.set(comp[i], o); } o.n++; if (dCoast[i] > dCoast[o.best]) o.best = i; if (ice[i]) o.ice++; }
      for (const [, o] of info) { const fr = o.n / tl; if (fr < 0.0025) continue; const [x, y] = toFull(o.best); const lib = libAt(o.best); const big = fr > 0.04; let n = draw(lib, 'regions').replace(/(地区|平原)$/, ''); n += big ? (nr() < 0.5 ? '大陆' : '洲') : '岛'; labels.push({ type: big ? 'continent' : 'island', name: n, x, y, frac: fr, polar: o.ice / o.n > 0.6 }); } }
    // ---- 地貌名称（参照原版 names.py / landforms.py）：高原、平原、盆地、半岛、海湾、雪山、山峰 ----
    { const ring = (i, k) => NB[i * 8 + k];
      const comps = (mask, minSize) => { const lab = new Int32Array(N), out = []; let id = 0;
        for (let s0 = 0; s0 < N; s0++) { if (!mask[s0] || lab[s0]) continue; id++; const c = [s0]; lab[s0] = id; for (let h = 0; h < c.length; h++) for (let k = 0; k < 8; k += 2) { const j = ring(c[h], k); if (j >= 0 && mask[j] && !lab[j]) { lab[j] = id; c.push(j); } } if (c.length >= minSize) out.push(c); }
        return out; };
      // 组件内离边缘最远处作注记锚点
      const anchorOf = (c) => { const set = new Set(c), dd = new Map(), q = []; for (const i of c) { for (let k = 0; k < 8; k += 2) { const j = ring(i, k); if (j < 0 || !set.has(j)) { dd.set(i, 0); q.push(i); break; } } }
        for (let h = 0; h < q.length; h++) { const i = q[h]; for (let k = 0; k < 8; k += 2) { const j = ring(i, k); if (j >= 0 && set.has(j) && !dd.has(j)) { dd.set(j, dd.get(i) + 1); q.push(j); } } }
        let best = c[0], bv = -1; for (const i of c) { const v = dd.get(i) || 0; if (v > bv) { bv = v; best = i; } } return [best, bv]; };
      const TAIL = /(群岛|半岛|地区|平原|高原|盆地|草原|山地|低地|河谷|谷地|台地|丘陵|海岸|沙漠|荒漠|湿地|岛|口|州|郡)$/;
      const base = (lib, key, re) => { let n = draw(lib, key); for (let t = 0; t < 3; t++) n = n.replace(re, '').replace(TAIL, ''); return n || draw(lib, key); };
      // 局地起伏（5×5）与大尺度地形位置（17×17 均值）
      const relief = new Float32Array(N), tpi = new Float32Array(N);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!land[i]) continue; let hi = -1e9, lo = 1e9, sum = 0, n = 0;
        for (let dy = -8; dy <= 8; dy += 2) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -8; dx <= 8; dx += 2) { const j = yy * W + ((x + dx) % W + W) % W; if (!land[j]) continue; sum += e[j]; n++; if (Math.abs(dy) <= 2 && Math.abs(dx) <= 2) { if (e[j] > hi) hi = e[j]; if (e[j] < lo) lo = e[j]; } } }
        relief[i] = hi > lo ? hi - lo : 0; tpi[i] = n ? e[i] - sum / n : 0; }
      const kind = new Uint8Array(N); // 1 平原 2 高原 3 盆地
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!land[i] || ice[i]) continue; const h = e[i];
        // 盆地：四周八个方向中至少六个方向在 14 格内抬升 400 m 以上，本身起伏不大
        let up = 0; if (relief[i] < 260 && h < 1800) for (let k = 0; k < 8; k++) { const dx = [1, 1, 0, -1, -1, -1, 0, 1][k], dy = [0, 1, 1, 1, 0, -1, -1, -1][k]; let m = -1e9; for (let r = 3; r <= 14; r++) { const yy = y + dy * r; if (yy < 0 || yy >= H) break; const j = yy * W + ((x + dx * r) % W + W) % W; if (!land[j]) { m = -1e9; break; } if (e[j] > m) m = e[j]; } if (m > h + 400) up++; }
        if (up >= 6 && tpi[i] < -120) kind[i] = 3;
        else if (h >= 800 && relief[i] < 380 && tpi[i] >= 100) kind[i] = 2;
        else if (h < 260 && relief[i] < 140) kind[i] = 1; }
      const areaFeat = (k, minSize, limit, type, suffix) => { const cs = comps(kind.map(v => v === k ? 1 : 0), minSize).sort((a, b) => b.length - a.length).slice(0, limit);
        for (const c of cs) { const [a, d] = anchorOf(c); const [x, y] = toFull(a); labels.push({ type, name: base(libAt(a), 'regions', /(地区|平原|高原|盆地|草原|山地)$/) + suffix, x, y, size: c.length, depth: d }); } };
      areaFeat(3, 18, 10, 'basin', '盆地'); areaFeat(2, 22, 12, 'plateau', '高原'); areaFeat(1, 50, 14, 'plain', '平原');
      // 半岛：开运算去掉窄于约 2×5 格的陆地突出部，留下与大陆相连的部分
      { const R = 5, core = new Uint8Array(N); for (let i = 0; i < N; i++) core[i] = land[i] && dCoast[i] >= R ? 1 : 0;
        const dc = bfsDist(i => core[i], () => true), opened = new Uint8Array(N); for (let i = 0; i < N; i++) opened[i] = land[i] && dc[i] <= R ? 1 : 0;
        const pen = new Uint8Array(N); for (let i = 0; i < N; i++) pen[i] = land[i] && !opened[i] && !ice[i] ? 1 : 0;
        const cs = comps(pen, 14).filter(c => c.some(i => { for (let k = 0; k < 8; k += 2) { const j = ring(i, k); if (j >= 0 && opened[j]) return true; } return false; })).sort((a, b) => b.length - a.length).slice(0, 14);
        for (const c of cs) { const [a] = anchorOf(c); const [x, y] = toFull(a); labels.push({ type: 'peninsula', name: base(libAt(a), 'regions', /(地区|平原|高原|盆地|草原|山地|半岛)$/) + '半岛', x, y, size: c.length }); } }
      // 海湾：三面环陆的近岸海域
      { const bay = new Uint8Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!sea[i] || dCoast[i] > 9) continue; let l = 0, n = 0; for (let dy = -9; dy <= 9; dy += 3) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -9; dx <= 9; dx += 3) { if (dx * dx + dy * dy > 81) continue; n++; if (land[yy * W + ((x + dx) % W + W) % W]) l++; } } if (l / n >= 0.5) bay[i] = 1; }
        const cs = comps(bay, 10).sort((a, b) => b.length - a.length).slice(0, 16);
        for (const c of cs) { const [a] = anchorOf(c); let lc = a; for (let r = 1; r < 12 && !(land[lc] && civ[lc]); r++) { const y = (a / W) | 0, x = a - y * W; for (let k = 0; k < 16; k++) { const j = Math.min(H - 1, Math.max(0, y + Math.round(Math.sin(k / 16 * 6.283) * r))) * W + ((x + Math.round(Math.cos(k / 16 * 6.283) * r)) % W + W) % W; if (land[j] && civ[j]) { lc = j; break; } } }
          const [x, y] = toFull(a); labels.push({ type: 'bay', name: base(libAt(lc), 'seas', /(海峡|海湾|海|湾|峡|洋)$/) + '湾', x, y, size: c.length }); } }
      // 雪山：山脉中有常年积雪的高峰（不含极地冰盖）
      // 山峰：全分辨率严格局部极大、局地相对高度 ≥ 150 m，同一陆块内间距 ≥ 250 km（原版 representative_summits）
      { const FE = P.elev, FH = P.H, FWd = P.W, peaks = [];
        for (let y = 2; y < FH - 2; y++) for (let x = 0; x < FWd; x++) { const i = y * FWd + x, h = FE[i]; if (h < 700 || Hy.lake[i]) continue; let ok = true;
          for (let dy = -2; dy <= 2 && ok; dy++) for (let dx = -2; dx <= 2; dx++) { const j = (y + dy) * FWd + ((x + dx) % FWd + FWd) % FWd; if (Hy.lake[j] || FE[j] <= 0) { ok = false; break; } } // 不标在湖中小岛、海中礁石上
          if (!ok) continue;
          for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; if (FE[(y + dy) * FWd + ((x + dx) % FWd + FWd) % FWd] >= h) { ok = false; break; } }
          if (!ok) continue; let base0 = -1e9;
          for (const [dx, dy] of [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]) { let m = 1e9; for (let r = 1; r <= 6; r++) { const yy = y + dy * r; if (yy < 0 || yy >= FH) break; const v = FE[yy * FWd + ((x + dx * r) % FWd + FWd) % FWd]; if (v < m) m = v; } if (m > base0) base0 = m; }
          if (h - base0 >= 150) peaks.push([h, x, y]); }
        peaks.sort((a, b) => b[0] - a[0]);
        const sel = [], spacing = 250 / (2 * Math.PI * R / FWd);
        for (const p of peaks) { if (sel.length >= 260) break; const cl = Math.cos((90 - p[2] / FH * 180) * Math.PI / 180);
          if (sel.some(q => { let dx = Math.abs(q[1] - p[1]); dx = Math.min(dx, FWd - dx); return Math.hypot(dx * cl, q[2] - p[2]) < spacing; })) continue; sel.push(p); }
        const snowy = [];
        sel.forEach((p, rank) => { const ci = Math.min(H - 1, (p[2] / 2) | 0) * W + Math.min(W - 1, (p[1] / 2) | 0), lib = libAt(ci), fi = p[2] * FWd + p[1];
          const permSnow = Cl.snow[fi] === 2 && Math.abs(90 - p[2] / FH * 180) < 62;
          let name = draw(lib, 'mountains', '山'); if (permSnow && snowy.length < 18 && p[0] > 3000) { name = name.replace(/(山脉|山|岭|峰)$/, '') + '雪山'; snowy.push(rank); }
          labels.push({ type: permSnow && /雪山$/.test(name) ? 'snow' : 'peak', name, x: p[1] + 0.5, y: p[2] + 0.5, h: Math.round(p[0]), rank }); }); }
    }
    // ---- 岛屿与群岛名称：相距 ≤ 6 格的小岛归为同一群岛（≥ 3 岛称“群岛”），单独的岛按大小分级 ----
    { const comp = components(land), info = new Map();
      for (let i = 0; i < N; i++) { const k = comp[i]; if (!k || ice[i]) continue; let o = info.get(k); if (!o) { o = { n: 0, sx: 0, sy: 0, x0: i % W, best: i }; info.set(k, o); } o.n++; let x = i % W; if (x - o.x0 > W / 2) x -= W; if (o.x0 - x > W / 2) x += W; o.sx += x; o.sy += (i / W) | 0; if (dCoast[i] > dCoast[o.best]) o.best = i; }
      const isl = [...info.values()].filter(o => o.n >= 1 && o.n < 1500).map(o => ({ ...o, cx: o.sx / o.n, cy: o.sy / o.n, g: -1 }));
      let ng = 0; for (const a of isl) { if (a.g >= 0) continue; a.g = ng; const st = [a]; while (st.length) { const u = st.pop(); for (const b of isl) { if (b.g >= 0) continue; let dx = Math.abs(b.cx - u.cx); dx = Math.min(dx, W - dx); if (Math.hypot(dx, b.cy - u.cy) <= 6 + Math.sqrt(u.n + b.n) * 0.5) { b.g = ng; st.push(b); } } } ng++; }
      const groups = new Map(); for (const a of isl) { if (!groups.has(a.g)) groups.set(a.g, []); groups.get(a.g).push(a); }
      const out = []; for (const [, m] of groups) { const n = m.reduce((s, o) => s + o.n, 0), cx = m.reduce((s, o) => s + o.cx * o.n, 0) / n, cy = m.reduce((s, o) => s + o.cy * o.n, 0) / n; out.push({ m, n, cx, cy }); }
      out.sort((a, b) => b.n - a.n);
      for (const gp of out.slice(0, 90)) { const big = gp.m.slice().sort((a, b) => b.n - a.n)[0], arch = gp.m.length >= 3; if (!arch && gp.n < 2) continue;
        const lib = libAt(big.best); let nm = draw(lib, 'regions').replace(/(群岛|列岛|半岛|地区|平原|高原|盆地|草原|山地|低地|河谷|岛|州|郡)$/, '') + (arch ? (gp.m.length >= 6 ? '群岛' : '列岛') : '岛');
        const x = ((((arch ? gp.cx : big.cx) % W) + W) % W + 0.5) * 2, y = ((arch ? gp.cy : big.cy) + 0.5) * 2;
        if (labels.some(l => (l.type === 'island' || l.type === 'continent') && Math.hypot(l.x - x, l.y - y) < 4 + Math.sqrt(gp.n) * 2)) { usedNames.delete(nm); continue; } // 已有岛名 / 大陆名的不重复命名
        labels.push({ type: 'island', name: nm, x, y, size: gp.n, arch }); } }
    // 主要河流与湖泊名称
    const riverNames = []; { const mouths = []; for (let k = 0; k < Hy.mouths.length; k += 3) mouths.push([Hy.mouths[k], Hy.mouths[k + 1], Hy.mouths[k + 2]]); mouths.sort((a, b) => b[2] - a[2]);
      for (const [x, y, qq] of mouths.slice(0, 40)) { const ci = Math.min(H - 1, (y / 2) | 0) * W + Math.min(W - 1, (x / 2) | 0); let cell = ci; for (let r = 1; r < 6 && !(land[cell] && civ[cell]); r++) for (let d = 0; d < 8; d++) { const j = NB[ci * 8 + d]; if (j >= 0 && land[j] && civ[j]) cell = j; } riverNames.push({ x, y, q: qq, name: draw(libAt(cell), 'rivers') }); } }
    { const comp = components(lake); const info = new Map(); for (let i = 0; i < N; i++) if (comp[i]) { let o = info.get(comp[i]); if (!o) { o = { n: 0, sx: 0, sy: 0, any: i }; info.set(comp[i], o); } o.n++; o.sx += i % W; o.sy += (i / W) | 0; }
      for (const [, o] of info) if (o.n >= 12) { let lib = LIBS[0]; for (let d = 0; d < 8; d++) { const j = NB[o.any * 8 + d]; if (j >= 0 && civ[j] > 0) { lib = libAt(j); break; } } labels.push({ type: 'lake', name: draw(lib, 'lakes'), x: (o.sx / o.n + 0.5) * 2, y: (o.sy / o.n + 0.5) * 2, size: o.n }); } }
    // 国家注记锚点：域内离边界最远处
    { const dd = new Float32Array(N).fill(1e9), qq = new Int32Array(N); let h = 0, t = 0;
      for (let i = 0; i < N; i++) { if (state[i] < 0) continue; for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j < 0 || state[j] !== state[i]) { dd[i] = 0; qq[t++] = i; break; } } }
      while (h < t) { const i = qq[h++]; for (const d of [1, 3, 4, 6]) { const j = NB[i * 8 + d]; if (j >= 0 && state[j] === state[i] && dd[j] > dd[i] + 1) { dd[j] = dd[i] + 1; qq[t++] = j; } } }
      const best = new Int32Array(nK).fill(-1); for (let i = 0; i < N; i++) { const k = state[i]; if (k >= 0 && (best[k] < 0 || dd[i] > dd[best[k]])) best[k] = i; }
      countries.forEach((c, k) => { if (best[k] >= 0) { const [x, y] = toFull(best[k]); c.lx = x; c.ly = y; c.lsize = dd[best[k]]; } }); }
    // 宗教：国家奉行
    const religion = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) if (domain[i]) religion[i] = state[i] >= 0 ? countries[state[i]].religion : religionRaw[i] - 1;
    const culture = new Int16Array(N).fill(-1), langOut = new Int16Array(N).fill(-1);
    for (let i = 0; i < N; i++) if (domain[i]) { culture[i] = civ[i] - 1; langOut[i] = language[i] - 1; }

    // ================= 14. 城市人口与输出 =================
    const urbanShare = era === 'industrial' ? 0.24 : 0.11;
    const tierMul = { metropolis: 3.2, city: 1.4, town: 0.55, site: 0.12 };
    let wsum = 0; allSettlements.forEach(s => { let lw = 0; const y = (s.cell / W) | 0, x = s.cell - y * W; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy; if (yy >= 0 && yy < H) lw += weight[yy * W + (x + dx + W) % W]; } s.lw = lw * tierMul[s.tier] * (s.capital !== undefined ? 1.6 : 1); wsum += s.lw; });
    allSettlements.forEach(s => { s.pop = Math.max(s.tier === 'site' ? 300 : 500, Math.round(popTotal * urbanShare * s.lw / wsum / 100) * 100); });
    const cityOut = allSettlements.map((s, k) => { const [x, y] = s.fx !== undefined ? [s.fx, s.fy] : toFull(s.cell); return { x, y, name: s.name, pop: s.pop, tier: s.tier, type: s.type, role: s.role, country: state[s.cell], capital: s.capital, seat: s.seat, prov: state[s.cell] >= 0 ? province[s.cell] : -1, gate: s.gate, coastal: !!(s.coastalTrue || oceanCoast[s.cell]), lib: libAt(s.cell).id, civ: civ[s.cell] - 1, lang: language[s.cell] - 1, rel: religion[s.cell] }; });
    // 所有聚落最终校验：落在连续地表的陆地上（海拔 > 3 m、非湖面），否则就近挪到岸内
    { const PE = P.elev, LK = Hy.lakeSoft, FHh = P.H;
      const bil = (A, x, y) => A === PE ? G.Noise.coastSurface(A, FW, FHh, x, y) : G.Noise.surface(A, FW, FHh, x, y);
      const dry = (x, y) => bil(PE, x, y) > 0.2 && bil(LK, x, y) < 0.35;
      let moved = 0;
      for (let ci = 0; ci < cityOut.length; ci++) { const c = cityOut[ci]; if (dry(c.x, c.y)) continue; let best = null;
        for (let r = 0.1; r <= 4 && !best; r += 0.1) for (let k = 0; k < 24; k++) { const a = k / 24 * 2 * Math.PI, x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r; if (dry(x, y) && dry(c.x + Math.cos(a) * (r + 0.12), c.y + Math.sin(a) * (r + 0.12))) { best = [x, y]; break; } }
        if (best) { c.x = ((best[0] % FW) + FW) % FW; c.y = best[1]; const st = allSettlements[ci]; st.fx = c.x; st.fy = c.y; moved++; } }
      void moved; }
    const lineOut = (cells) => { const out = []; let cur = []; let px = null; for (const c of cells) { const [x, y] = toFull(c); if (px !== null && Math.abs(x - px) > 8) { if (cur.length >= 4) out.push(Float32Array.from(cur)); cur = []; } cur.push(x, y); px = x; } if (cur.length >= 4) out.push(Float32Array.from(cur)); return out; };
    const roadOut = { trunk: [], regional: [], local: [], sea: [], rail: [], seaTrunk: [] };
    const routeList = [];
    // ---- 道路细化：在全分辨率地形上沿粗路线走廊重新寻路（贴合河谷、垭口与等高线） ----
    progress('人文 · 道路细化', 0.955);
    const FH = P.H, FN = FW * FH, fcellKm = 2 * Math.PI * R / FW, fe = P.elev;
    const stamp = new Int32Array(FN), dstamp = new Int32Array(FN), fdist = new Float64Array(FN), fpred = new Int32Array(FN);
    const fqth = qth;
    const ffr = (j) => { const h = fe[j]; if (h <= 0 || Hy.lake[j]) return Infinity; const y = (j / FW) | 0, x = j - y * FW; const r_ = y * FW + (x + 1) % FW, d_ = y < FH - 1 ? j + FW : j; const sl = (Math.abs(fe[r_] - h) + Math.abs(fe[d_] - h)) / (fcellKm * 1000); let f = 1 + sl * 60 + (h > 2600 ? (h - 2600) / 900 : 0) + (Cl.snow[j] === 2 ? 6 : 0); const qv = Hy.q[j]; if (qv > fqth * 5) f += 2.5; else if (qv > fqth) f += 0.6; return f; };
    let routeId = 0;
    function refine(cells, pa, pb, imp, water) {
      routeId++;
      if (cells.length < 2) return null;
      const passable = water ? (j => fe[j] <= 0 && !Hy.lake[j] && Cl.snow[j] !== 4) : null;
      // 走廊：沿粗路线的全分辨率格（半径 3）
      const pts = cells.map(c => toFull(c));
      for (let k = 0; k < pts.length; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[Math.min(pts.length - 1, k + 1)];
        let dx = x1 - x0; if (dx > FW / 2) dx -= FW; if (dx < -FW / 2) dx += FW;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, y1 - y0)));
        for (let t = 0; t <= steps; t++) { const cx = x0 + dx * t / steps, cy = y0 + (y1 - y0) * t / steps;
          for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) { if (ox * ox + oy * oy > 10) continue; const yy = Math.floor(cy) + oy; if (yy < 0 || yy >= FH) continue; const xx = ((Math.floor(cx) + ox) % FW + FW) % FW; stamp[yy * FW + xx] = routeId; } }
      }
      if (pa) pts[0] = pa; if (pb) pts[pts.length - 1] = pb;
      const cellAt = p => Math.min(FH - 1, Math.max(0, Math.floor(p[1]))) * FW + ((Math.floor(p[0]) % FW) + FW) % FW;
      const nearestOk = (c) => { if (!passable || passable(c)) return c; const y = (c / FW) | 0, x = c - y * FW; for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const yy = y + dy; if (yy < 0 || yy >= FH) continue; const j = yy * FW + ((x + dx) % FW + FW) % FW; if (passable(j)) return j; } return c; };
      const start = nearestOk(cellAt(pts[0])), goal = nearestOk(cellAt(pts[pts.length - 1]));
      stamp[start] = routeId; stamp[goal] = routeId;
      const gy = (goal / FW) | 0, gx = goal - gy * FW;
      const hp = new Heap(4096);
      dstamp[start] = routeId; fdist[start] = 0; fpred[start] = -1; hp.push(start, 0);
      let found = false, guard = 0;
      while (hp.n && guard++ < 400000) {
        const i = hp.pop(), fv = hp.top; const y = (i / FW) | 0, x = i - y * FW;
        let ddx = Math.abs(x - gx); ddx = Math.min(ddx, FW - ddx);
        if (fv - Math.hypot(ddx, y - gy) > fdist[i] + 1e-9) continue;
        if (i === goal) { found = true; break; }
        const fi = passable ? 1 : (ffr(i) === Infinity ? 1 : ffr(i));
        for (let d = 0; d < 8; d++) {
          const yy = y + DY[d]; if (yy < 0 || yy >= FH) continue; let xx = x + DX[d]; if (xx < 0) xx += FW; else if (xx >= FW) xx -= FW;
          const j = yy * FW + xx; if (stamp[j] !== routeId) continue;
          let fj; if (passable) { if (!passable(j) && j !== goal) continue; fj = 1 + (dCoastF(j) < 2 ? 0.6 : 0); } else { fj = ffr(j); if (fj === Infinity) { if (j !== goal) continue; fj = 1; } }
          const nd = fdist[i] + 0.5 * (fi + fj) * DL[d] + Math.abs(fe[j] - fe[i]) / 120;
          if (dstamp[j] !== routeId || nd < fdist[j]) { dstamp[j] = routeId; fdist[j] = nd; fpred[j] = i; let hx = Math.abs(xx - gx); hx = Math.min(hx, FW - hx); hp.push(j, nd + Math.hypot(hx, yy - gy)); }
        }
      }
      if (!found) return null;
      const path = []; let x = goal; while (x >= 0) { path.push(x); x = x === start ? -1 : fpred[x]; } path.reverse();
      if (!passable) { let inRiver = false; for (let k = 0; k < path.length; k++) { const c = path[k], big = Hy.q[c] > qth * 5 && fe[c] > 0; if (big && !inRiver && bridges.length < 6000) { const y = (c / FW) | 0; bridges.push([c - y * FW + 0.5, y + 0.5, 0, imp === 'trunk' ? 0 : imp === 'regional' ? 1 : 2]); } inRiver = big; } }
      // 抽稀（保留每 2 格）+ 输出全分辨率坐标，跨日期线断开
      const out = []; let cur = [], px = null;
      path.forEach((c, k) => { if (k % 2 && k !== path.length - 1) return; const y = (c / FW) | 0, xx = c - y * FW; if (px !== null && Math.abs(xx - px) > 8) { if (cur.length >= 4) out.push(Float32Array.from(cur)); cur = []; } cur.push(xx + 0.5, y + 0.5); px = xx; });
      if (cur.length >= 4) out.push(Float32Array.from(cur));
      // 进出城：去掉城市一格半以内的路点，道路直接通向城址（不在城边绕钩）
      const attach = (arr, P0, atStart) => { if (!P0 || arr.length < 4) return arr; let a = Array.from(arr); if (!atStart) { const r = []; for (let i = a.length - 2; i >= 0; i -= 2) r.push(a[i], a[i + 1]); a = r; }
        let dx = Math.abs(a[0] - P0[0]); dx = Math.min(dx, FW - dx); if (dx > 6) return arr;
        let k = 0; while (k + 2 < a.length - 2 && Math.hypot(Math.min(Math.abs(a[k + 2] - P0[0]), FW - Math.abs(a[k + 2] - P0[0])), a[k + 3] - P0[1]) < 1.6) k += 2;
        const p0x = P0[0] + Math.round((a[0] - P0[0]) / FW) * FW; // 经度接缝：城址取与路线同侧的副本，不连出横跨全图的直线
        a = [p0x, P0[1]].concat(a.slice(k + 2)); if (!atStart) { const r = []; for (let i = a.length - 2; i >= 0; i -= 2) r.push(a[i], a[i + 1]); a = r; } return Float32Array.from(a); };
      if (out.length) { out[0] = attach(out[0], pa, true); out[out.length - 1] = attach(out[out.length - 1], pb, false); }
      // 圆滑：两次 Chaikin 切角（端点不动），去掉 8 方向寻路的 45° 锯齿
      for (let k = 0; k < out.length; k++) { let a = Array.from(out[k]); for (let it = 0; it < 2; it++) { if (a.length < 6) break; const q = [a[0], a[1]]; for (let i = 0; i < a.length - 2; i += 2) { const x0 = a[i], y0 = a[i + 1], x1 = a[i + 2], y1 = a[i + 3]; q.push(x0 * 0.75 + x1 * 0.25, y0 * 0.75 + y1 * 0.25, x0 * 0.25 + x1 * 0.75, y0 * 0.25 + y1 * 0.75); } q.push(a[a.length - 2], a[a.length - 1]); a = q; } out[k] = Float32Array.from(a); }
      return out;
    }
    const fineByRoute = new Map();
    const dCoastF = j => { const y = (j / FW) | 0, x = j - y * FW; for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const yy = y + oy; if (yy < 0 || yy >= FH) continue; if (fe[yy * FW + ((x + ox) % FW + FW) % FW] > 0) return 1; } return 9; };
    const posOfNode = nd => nd.s && nd.s.fx !== undefined ? [nd.s.fx, nd.s.fy] : null;
    roads.forEach((r, k) => { const f = refine(r.cells, posOfNode(allNodes[r.a]), posOfNode(allNodes[r.b]), r.imp, false); fineByRoute.set(k, f || lineOut(r.cells)); });
    // 支路末端（接入点）精确接到细化后的主路上，不留缺口
    { const mainLines = []; roads.forEach((r, k) => { if (allNodes[r.b] && allNodes[r.b].kind === 'junction') return; for (const l of fineByRoute.get(k)) mainLines.push(l); });
      roads.forEach((r, k) => { if (!allNodes[r.b] || allNodes[r.b].kind !== 'junction') return; const ls = fineByRoute.get(k); if (!ls || !ls.length) return; const L = ls[ls.length - 1], ex = L[L.length - 2], ey = L[L.length - 1];
        let bx = 0, by = 0, bd = 4; for (const m of mainLines) for (let i = 2; i < m.length; i += 2) { const ax = m[i - 2], ay = m[i - 1]; if (Math.abs(ax - ex) > 6 || Math.abs(ay - ey) > 6) continue; const dx = m[i] - ax, dy = m[i + 1] - ay, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((ex - ax) * dx + (ey - ay) * dy) / L2)) : 0, qx = ax + dx * t, qy = ay + dy * t, dd = Math.hypot(qx - ex, qy - ey); if (dd < bd) { bd = dd; bx = qx; by = qy; } }
        if (bd < 4) ls[ls.length - 1] = Float32Array.from([...L, bx, by]); }); }
    roads.forEach((r, k) => { for (const l of fineByRoute.get(k)) roadOut[r.imp].push(l); });
    // 桥梁：按最终绘制的道路线与河流线求交点（河流流量 ≥ 显示阈值的 3 倍），桥沿道路方向
    bridges.length = 0;
    { const rv = Hy.rivers, cellH = new Map(), key = (x, y) => (Math.floor(y / 4) * 4096 + Math.floor(((x % FW) + FW) % FW / 4));
      for (let s0 = 0; s0 < rv.offs.length - 1; s0++) for (let v = rv.offs[s0] + 1; v < rv.offs[s0 + 1]; v++) { const q = rv.pts[v * 7 + 2] / qth; if (q < 3) continue; const ax = rv.pts[v * 7 - 7], ay = rv.pts[v * 7 - 6], bx = rv.pts[v * 7], by = rv.pts[v * 7 + 1]; if (Math.abs(bx - ax) > 8) continue;
        const k1 = key(ax, ay), k2 = key(bx, by); for (const kk of new Set([k1, k2])) { (cellH.get(kk) || cellH.set(kk, []).get(kk)).push([ax, ay, bx, by, q, rv.tiers ? rv.tiers[s0] : 3]); } }
      const seen = [];
      for (const [cls, imp] of [['trunk', 0], ['regional', 1], ['local', 2]]) for (const l of roadOut[cls]) for (let i = 2; i < l.length; i += 2) { const px0 = l[i - 2], py0 = l[i - 1], px1 = l[i], py1 = l[i + 1]; if (Math.abs(px1 - px0) > 8) continue;
        const cand = new Set([key(px0, py0), key(px1, py1)]); for (const kk of cand) for (const [ax, ay, bx, by, q, tier] of cellH.get(kk) || []) {
          const d1x = px1 - px0, d1y = py1 - py0, d2x = bx - ax, d2y = by - ay, den = d1x * d2y - d1y * d2x; if (Math.abs(den) < 1e-9) continue;
          const t = ((ax - px0) * d2y - (ay - py0) * d2x) / den, u = ((ax - px0) * d1y - (ay - py0) * d1x) / den; if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const x = px0 + d1x * t, y = py0 + d1y * t; if (seen.some(o => Math.abs(o[0] - x) < 0.6 && Math.abs(o[1] - y) < 0.6)) continue; seen.push([x, y]);
          if (bridges.length < 8000) bridges.push([x, y, Math.atan2(d1y, d1x), imp, Math.min(4, Math.floor(Math.log2(q))), tier]); } } }
    // 关隘、边堡、集镇吸附到实际路线上（全分辨率），保证就在路边
    { const lines = roadOut.trunk.concat(roadOut.regional, roadOut.local);
      allSettlements.forEach((st, ci) => { if (st.role !== 'military-post' && st.role !== 'trade') return; const c = cityOut[ci]; let bx = 0, by = 0, bd = 7;
        for (const l of lines) { if (Math.abs(l[0] - c.x) > 400 && Math.abs(l[l.length - 2] - c.x) > 400) continue;
          for (let i = 2; i < l.length; i += 2) { const ax = l[i - 2], ay = l[i - 1], ex = l[i] - ax, ey = l[i + 1] - ay; if (Math.abs(ax - c.x) > 8 || Math.abs(ay - c.y) > 8) continue; const L2 = ex * ex + ey * ey, t = L2 ? Math.max(0, Math.min(1, ((c.x - ax) * ex + (c.y - ay) * ey) / L2)) : 0, qx = ax + ex * t, qy = ay + ey * t, d = Math.hypot(qx - c.x, qy - c.y); if (d < bd) { bd = d; bx = qx; by = qy; } } }
        if (bd < 7 && G.Noise.coastSurface(P.elev, FW, P.H, bx, by) > 0.2 && G.Noise.surface(Hy.lakeSoft, FW, P.H, bx, by) < 0.35) { c.x = bx; c.y = by; } }); }
    // 海运航线：平滑（抽稀 + 保留首尾）
    const seaOut = { trunk: [], regional: [] };
    for (const r of seaRoutes) {
      const A = settlements[r.a], B = settlements[r.b];
      const f = refine(r.cells.slice(1, -1).length >= 2 ? r.cells.slice(1, -1) : r.cells, null, null, r.imp, true);
      const lines = f || lineOut(r.cells);
      // 航线两端接到港口城市本身（港口即交通网节点）
      const near = (x, ref) => x + Math.round((ref - x) / FW) * FW; // 经度接缝：港口取与航线同侧的副本
      if (lines.length) { const first = lines[0], last = lines[lines.length - 1]; lines[0] = Float32Array.from([near(A.fx, first[0]), A.fy, ...first]); lines[lines.length - 1] = Float32Array.from([...last, near(B.fx, last[last.length - 2]), B.fy]); }
      for (const l of lines) { const o = []; for (let k = 0; k < l.length; k += 2) if ((k / 2) % 2 === 0 || k >= l.length - 2 || k <= 2) o.push(l[k], l[k + 1]); roadOut.sea.push(Float32Array.from(o)); seaOut[r.imp === 'trunk' ? 'trunk' : 'regional'].push(Float32Array.from(o)); }
    }
    roadOut.seaTrunk = seaOut.trunk;
    // 工业时代：国内主要城市之间的铁路（沿干线/区域道路走廊）
    if (era === 'industrial') { for (const r of roads) { if (r.imp === 'local') continue; const A = allNodes[r.a], B = allNodes[r.b]; if (!A.s || !B.s) continue; if (state[A.cell] >= 0 && state[A.cell] === state[B.cell] && (A.s.tier !== 'town' && B.s.tier !== 'town')) for (const l of fineByRoute.get(roads.indexOf(r))) roadOut.rail.push(l); } }
    // 导航图：节点 = 城市/锚点，边 = 道路/海路（含长度与地形）
    for (const r of roads) { let km = 0, climb = 0; for (let k = 1; k < r.cells.length; k++) { km += gcKm(r.cells[k - 1], r.cells[k]); climb += Math.max(0, e[r.cells[k]] - e[r.cells[k - 1]]); } const A = allNodes[r.a], B = allNodes[r.b]; routeList.push({ a: A.cell, b: B.cell, km, climb, grade: climb / Math.max(1, km * 1000), mode: 'road', imp: r.imp, cells: r.cells }); }
    for (const r of seaRoutes) routeList.push({ a: settlements[r.a].cell, b: settlements[r.b].cell, km: r.km, climb: 0, grade: 0, mode: 'sea', imp: r.imp, cells: r.cells });

    let tribalArea = 0, claimArea = 0; for (let i = 0; i < N; i++) if (domain[i]) { claimArea += area[(i / W) | 0]; if (state[i] < 0) tribalArea += area[(i / W) | 0]; }
    const stats = {
      worldName: draw(LIBS[(cfg.seed >>> 0) % LIBS.length] || LIBS[0], 'regions').replace(/(地区|平原|高原)$/, ''),
      population: Math.round(popTotal), popRange: [popMin, popMax], supportRange: [capMin, capMax], countries: nK, provinces: provinces.length,
      settlements: cityOut.length, cultures: cultures.length, languages: languages.length, religions: religions.length, tribalShare: tribalArea / Math.max(1, claimArea),
      landArea: Math.round(claimArea), cellKm, era, eraLabel: AD.label, tribes: tribes.length, jimis: jimis.length, roads: roads.length, seaRoutes: seaRoutes.length, bridges: bridges.length
    };
    // ---- 细部自然地名（放在所有原有命名之后，不改变已有地名）：支脉、丘陵、各级河流 ----
    { const comps8 = (mask, minN) => { const lab = new Int32Array(N), out = []; let id = 0;
        for (let s0 = 0; s0 < N; s0++) { if (!mask(s0) || lab[s0]) continue; id++; const c = [s0]; lab[s0] = id; for (let h = 0; h < c.length; h++) for (let d = 0; d < 8; d++) { const j = NB[c[h] * 8 + d]; if (j >= 0 && !lab[j] && mask(j)) { lab[j] = id; c.push(j); } } if (c.length >= minN) out.push(c); }
        return out; };
      const geom = (comp) => { const y0 = (comp[0] / W) | 0, x0 = comp[0] - y0 * W; let sx = 0, sy = 0, best = comp[0];
        const pts = comp.map(i => { const y = (i / W) | 0; let x = i - y * W; if (x - x0 > W / 2) x -= W; if (x0 - x > W / 2) x += W; if (e[i] > e[best]) best = i; sx += x; sy += y; return [x, y, e[i]]; });
        const mx = sx / comp.length, my = sy / comp.length; let cxx = 0, cyy = 0, cxy = 0; for (const [x, y] of pts) { cxx += (x - mx) ** 2; cyy += (y - my) ** 2; cxy += (x - mx) * (y - my); }
        const th = 0.5 * Math.atan2(2 * cxy, cxx - cyy), l1 = (cxx + cyy) / 2 + Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy * cxy);
        return { pts, mx, my, th, len: Math.sqrt(l1 / comp.length) * 8, best, cell: Math.round(my) * W + ((Math.round(mx) % W) + W) % W }; };
      const fine = [];
      // 支脉：大山脉内部更高的一段（阈值取山脉基准与主峰之间），只在放大后出现
      for (const par of comps8(i => land[i] && e[i] >= 1500, 150)) { let pk = 0; for (const i of par) if (e[i] > pk) pk = e[i];
        const thr = 1500 + 0.42 * (pk - 1500), inPar = new Uint8Array(N); for (const i of par) inPar[i] = 1;
        for (const c of comps8(i => inPar[i] && e[i] >= thr, 10)) { if (c.length > par.length * 0.6) continue; const g = geom(c), [x, y] = toFull(c.reduce((b, i) => e[i] > e[b] ? i : b, c[0]));
          fine.push({ type: 'ridge', g, size: c.length, base: thr, peak: Math.round(e[g.best]), x, y }); } }
      // 丘陵：不含 1500 m 以上山体的独立低山丘陵区
      const hill = new Uint8Array(N); for (let i = 0; i < N; i++) hill[i] = land[i] && !ice[i] && e[i] >= 550 ? 1 : 0;
      for (const c of comps8(i => hill[i], 18)) { if (c.some(i => e[i] >= 1500)) continue; const g = geom(c); fine.push({ type: 'hills', g, size: c.length, base: 550, peak: Math.round(e[g.best]) }); }
      fine.sort((a, b) => b.size - a.size);
      let nRidge = 0, nHill = 0;
      for (const f of fine) { if (f.type === 'ridge' ? nRidge++ >= 70 : nHill++ >= 60) continue;
        const lib = libAt(f.g.cell); let name = draw(lib, 'mountains', f.type === 'ridge' ? '岭' : '山');
        if (f.type === 'hills') name = name.replace(/(山脉|山地|山|岭|峰)$/, '') + (f.size > 60 ? '丘陵' : '岭');
        else if (!/(山|岭|峰|脉|岳|嶂|峦|梁|岗|冈|坂|ー)$/.test(name)) name += '岭';
        const [x, y] = [(f.g.mx + 0.5) * 2, (f.g.my + 0.5) * 2];
        labels.push({ type: f.type, name, x, y, angle: f.g.th, len: f.g.len, size: f.size, peak: f.peak, ridge: ridgeOf(f.g.pts, f.g.th, f.base) }); }
      // 各级河流：原有的 40 条大河认领各自的干流，其余干支流按长度依次命名（放大逐级显示）
      const RV = Hy.rivers, stems = RV.stems || [], rp = RV.pts, ro = RV.offs;
      const endOf = st => { const r = st.r[0], k = ro[r + 1] - 1; return [rp[k * 7], rp[k * 7 + 1]]; };
      const taken = new Set();
      riverNames.forEach(rn => { let bi = -1, bd = 5; stems.forEach((st, si) => { if (st.mouth !== 'ocean' || taken.has(si)) return; const [x, y] = endOf(st), d = Math.hypot(x - rn.x, y - rn.y); if (d < bd) { bd = d; bi = si; } }); if (bi >= 0) { taken.add(bi); rn.stem = bi; rn.tier = stems[bi].tier; rn.km = stems[bi].km; } });
      const midOf = st => { let n = 0; for (const r of st.r) n += ro[r + 1] - ro[r]; let h = n / 2; for (let j = st.r.length - 1; j >= 0; j--) { const r = st.r[j], m = ro[r + 1] - ro[r]; if (h < m) { const k = ro[r] + Math.floor(h); return [rp[k * 7], rp[k * 7 + 1]]; } h -= m; } return endOf(st); };
      const minKm = 2 * Math.PI * R * 0.0005, cand = stems.map((st, si) => [st, si]).filter(([st, si]) => !taken.has(si) && (st.tier <= 2 || st.km >= minKm)).sort((a, b) => a[0].tier - b[0].tier || b[0].km - a[0].km).slice(0, 2200);
      for (const [st, si] of cand) { const [x, y] = midOf(st), ci = Math.min(H - 1, Math.max(0, (y / 2) | 0)) * W + ((((x / 2) | 0) % W) + W) % W;
        let cell = ci; if (!(land[cell] && civ[cell])) for (let d = 0; d < 8; d++) { const j = NB[ci * 8 + d]; if (j >= 0 && land[j] && civ[j]) { cell = j; break; } }
        riverNames.push({ x, y, q: 0, name: draw(libAt(cell), 'rivers'), stem: si, tier: st.tier, km: st.km, minor: 1 }); } }
    // 历史推演（core/history.js）所需的中间量：只留在 Worker 内，不随 ready 消息发往页面
    const hist = {
      W, H, N, FW, R, cellKm, lat, cosL, area, NB, gdist, era: cfg.era | 0, seed: cfg.seed, endYear: cfg.endYear || 0, targetCountries: cfg.countries || 0,
      land, ice, domain, oceanCoast, dCoast, e, eN, slopeN, T, Pr, kop, biome, order, pot, hab, weight, density, newW, stateFr,
      civ, civCost: CV.cost, civSeeds: civSeeds.map(s => ({ cell: s.cell, primary: s.primary })), civLib, subsistence,
      relSeeds: relSeeds.map(s => s.cell), relRaw: religionRaw, relCost: RG.cost, religion, culture,
      country: state, province, frontier, claimed,
      settlements: allSettlements.map(s => ({ cell: s.cell, name: s.name, pop: s.pop, score: s.score || 0, tier: s.tier, type: s.type, role: s.role, capital: s.capital, seat: s.seat, newSeat: !!s.newSeat })),
      LIBS, usedNames, popTotal,
      // 道路：两端的格与聚落（用于推算修建年代），以及最终绘制的全分辨率折线
      roads: (() => { const idxOf = new Map(allSettlements.map((s, k) => [s, k])); return roads.map((r, k) => { const A = allNodes[r.a], B = allNodes[r.b]; return { imp: r.imp, a: A ? A.cell : -1, b: B ? B.cell : -1, sa: A && A.s && idxOf.has(A.s) ? idxOf.get(A.s) : -1, sb: B && B.s && idxOf.has(B.s) ? idxOf.get(B.s) : -1, lines: fineByRoute.get(k) || [] }; }); })()
    };
    return {
      hist,
      W, H, country: state, province, culture, language: langOut, religion, gov, nominal: claimed, tribe, jimi, popDensity: density, agri: pot, hab,
      countries, provinces, cultures, languages, religions, tribes, jimis, cities: cityOut, roads: roadOut, bridges, labels, riverNames,
      plates: P.plates.map(p => { const x = (p.lon + 180) / 360 * P.W, y = (90 - p.lat) / 180 * P.H; const ci = Math.min(H - 1, (y / 2) | 0) * W + Math.min(W - 1, (x / 2) | 0); const lib = land[ci] && civ[ci] > 0 ? libAt(ci) : LIBS[p.id % LIBS.length]; const desc = !p.continental ? (p.area > 0.06 * 4 * Math.PI ? '大洋' : '海') : (T[ci] < -4 ? '冻原' : e[ci] > 1500 ? '高原' : '平原'); return { name: draw(lib, 'regions').replace(/(地区|平原|高原)$/, '') + desc + '板块', x, y, ve: p.ve, vn: p.vn, speed: p.speed, continental: p.continental }; }),
      symbols: P.volcanoes.filter(([x, y]) => P.elev[Math.floor(y) * P.W + Math.floor(x)] > -400).map(([x, y]) => ['volcano', x, y]),
      // 文明 / 语言影响强度：到本文明（语言）起源核心的扩散代价，按各自 90% 分位归一 → 核心浓、边缘淡（与实际治理同样的渐变）
      ...(() => { const inf = (lab, cost) => { let mx = 0; for (let i = 0; i < N; i++) if (lab[i] > mx) mx = lab[i]; const n = mx + 1, buckets = Array.from({ length: n }, () => []);
          for (let i = 0; i < N; i += 3) if (lab[i] >= 0 && isFinite(cost[i])) buckets[lab[i]].push(cost[i]);
          const q = buckets.map(b => { if (!b.length) return 1; b.sort((x, y) => x - y); return Math.max(1e-6, b[Math.floor(b.length * 0.9)]); });
          const out = new Uint8Array(N); for (let i = 0; i < N; i++) if (lab[i] >= 0) { const c = isFinite(cost[i]) ? cost[i] / q[lab[i]] : 1.2; out[i] = Math.round(255 * Math.max(0.14, Math.min(1, 1.12 - 0.95 * Math.pow(c, 0.85)))); } return out; };
        return { civInf: inf(culture, CV.cost), langInf: inf(langOut, LG.cost) }; })(),
      libs: LIBS.map(l => ({ id: l.id, label: l.label, style: l.style, cat: l.cat, base: l.base, c: l.c, cities: l.n.cities, rivers: l.n.rivers, lakes: l.n.lakes, mountains: l.n.mountains, regions: l.n.regions, streets: l.n.streets || [] })), civ, oceanCoast,
      stats, routes: routeList, cost: roadFr, roadTier, land, ice, cellKm, govDays, era, admin: AD
    };
  }


  // ---------- 文化库起名器：库里现成的名字用完后，用该库的前缀、词根、后缀拼出新名字（不出现数字） ----------
  // kind：state 国名 / prov 省名 / city 城名 / other；省名的结尾词（州、牧地、河谷……）从该库自己的省名里学
  const NG_DIR = ['东', '西', '南', '北', '新', '上', '下', '大', '小', '内', '外', '中'];
  const ngEndCache = new Map();
  function ngEndings(lib) {
    const key = lib.id || lib.label || ''; if (ngEndCache.has(key)) return ngEndCache.get(key);
    const list = (lib.n && lib.n.provinces) || [], cnt = new Map();
    for (const nm of list) for (const k of [1, 2]) if (nm.length > k + 1) { const e = nm.slice(-k); cnt.set(e, (cnt.get(e) || 0) + 1); }
    const thr = Math.max(3, list.length * 0.1), ends = [...cnt].filter(([e, n]) => n >= thr).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
    const keep = []; for (const [e, n] of ends) if (!keep.some(k => k.e.endsWith(e) && k.n >= n * 0.7)) keep.push({ e, n }); // 两字结尾（牧地）优先于其末字（地）
    let cover = 0; for (const nm of list) if (keep.some(k => nm.endsWith(k.e))) cover++;
    const out = { ends: keep.slice(0, 5).map(k => k.e), w: keep.slice(0, 5).map(k => k.n), share: list.length ? cover / list.length : 0 };
    ngEndCache.set(key, out); return out;
  }
  function makeName(lib, kind, used, rnd, opt) {
    opt = opt || {};
    const C = lib && lib.c && lib.c.roots && lib.c.roots.length ? lib.c : { roots: ['安', '宁', '岚', '川', '溪', '岱'], prefixes: ['东', '西', '南', '北'], suffixes: ['阳', '平', '和'] };
    const pre = C.prefixes && C.prefixes.length ? C.prefixes : [''], suf = C.suffixes && C.suffixes.length ? C.suffixes : [''];
    const pick = a => a[Math.floor(rnd() * a.length) % a.length];
    const avg = C.roots.reduce((s, r) => s + r.length, 0) / C.roots.length, single = avg < 1.5;
    const maxLen = opt.maxLen || (kind === 'state' ? (single ? 2 : 5) : kind === 'prov' ? (single ? 3 : 6) : single ? 3 : 6);
    const E = kind === 'prov' ? ngEndings(lib) : { ends: [], share: 0 };
    const ending = () => { if (!E.ends.length || rnd() > Math.max(0.35, E.share)) return ''; let t = rnd() * E.w.reduce((a, b) => a + b, 0); for (let i = 0; i < E.ends.length; i++) { t -= E.w[i]; if (t <= 0) return E.ends[i]; } return E.ends[0]; };
    const forms = kind === 'state' && single ? [() => pick(C.roots), () => pick(pre) + pick(C.roots), () => pick(C.roots) + pick(suf)]
      : [() => pick(pre) + pick(C.roots), () => pick(C.roots) + pick(suf), () => pick(pre) + pick(C.roots) + pick(suf), () => pick(C.roots) + pick(C.roots), () => pick(C.roots)];
    const add = w => { used.add(w); return w; };
    for (let t = 0; t < 400; t++) {
      let w = forms[t % forms.length](); if (!w || w.length > maxLen + (t > 200 ? 2 : 0)) continue;
      if (kind === 'prov') { const e = ending(); if (e && !w.endsWith(e) && !w.endsWith(e[0])) w += e; }
      if (opt.suffix) w += opt.suffix;
      if (!used.has(w)) return add(w);
    }
    // 实在撞名：加方位字或再接一个后缀（仍是该库的音），绝不加数字
    let base = pick(C.roots) + pick(suf) + (opt.suffix || '');
    for (let t = 0; t < 2000; t++) { const w = t < NG_DIR.length * 4 ? NG_DIR[(t + Math.floor(rnd() * NG_DIR.length)) % NG_DIR.length] + base : pick(pre) + pick(C.roots) + pick(suf) + pick(suf) + (opt.suffix || ''); if (!used.has(w)) return add(w); if (t % 12 === 11) base = pick(C.roots) + pick(C.roots) + (opt.suffix || ''); }
    let w = base; while (used.has(w)) w = NG_DIR[Math.floor(rnd() * NG_DIR.length)] + w; return add(w);
  }
  G.NameGen = { make: makeName, endings: ngEndings };
  G.Society = { run };
})(typeof self !== 'undefined' ? self : this);
