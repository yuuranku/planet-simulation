/* 城市生成器（重构）：城市直接生成在地形图上——建成区沿海岸、河谷与道路蔓延，内部是街区网格、干道、城墙或环路。
 * 按规模分档，算法与开销不同：
 *   村镇（< 2 万）：小网格、有机街巷，最多 3 条出城路；
 *   城市（2–30 万）：分区网格、放射干道，前工业时代有城墙；
 *   大都会（> 30 万）：主城 + 沿道路的卫星城镇，多个朝向不同的街区，放射干道 + 环路（工业时代）或内外城墙（前工业）。
 * 单城生成控制在几十毫秒内：局部栅格大小随规模封顶，街道按屏幕密度只取需要的间距。 */
(function (G) {
  'use strict';
  const M = Math;
  const DENS = { preindustrial: 3200, industrial: 3450 }, TIER_D = { metropolis: 0.82, city: 0.98, town: 1.18, site: 0.76 }, MIN_A = { metropolis: 18, city: 4, town: 0.55, site: 0.12 };
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = M.imul(a ^ (a >>> 15), 1 | a); t = (t + M.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function build(world, idx, opt = {}) {
    const { P, Hy, Cv, cfg } = world, W = P.W, H = P.H, e = P.elev, city = Cv.cities[idx]; if (!city) return null;
    const R = cfg.radius, cellKm = 2 * M.PI * R / W, lat = (90 - city.y / H * 180) * M.PI / 180, kx = cellKm * M.max(0.15, M.cos(lat)), ky = cellKm;
    const era = Cv.era || 'preindustrial', pop = M.max(200, city.pop || 1000), tier = city.tier || 'town';
    const big = pop >= 300000, mid = pop >= 20000;
    const area = M.max(MIN_A[tier] || 0.12, pop / ((DENS[era] || 3200) * (TIER_D[tier] || 1)) * (era === 'industrial' ? 1.25 : 1)); // km²
    const rKm = M.sqrt(area / M.PI), rnd = rng((cfg.seed >>> 0) ^ (idx * 2654435761));
    // ---- 局部栅格：范围与分辨率随规模封顶 ----
    const half = M.max(2.2, rKm * (big ? 3.2 : 2.6)), n = opt.detail ? (big ? 200 : mid ? 140 : 90) : (big ? 128 : mid ? 84 : 48), ck = 2 * half / n; // km / 格
    const X0 = city.x - half / kx, Y0 = city.y - half / ky, sx = ck / kx, sy = ck / ky;
    const toW = (i, j) => [X0 + (i + 0.5) * sx, Y0 + (j + 0.5) * sy];
    const N = n * n, land = new Uint8Array(N), hgt = new Float32Array(N);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const [x, y] = toW(i, j), k = j * n + i;
      const cs = G.Noise.coastSurface(e, W, H, x, y), lk = G.Noise.surface(Hy.lakeSoft, W, H, x, y);
      land[k] = cs > 0 && lk < 0.5 ? 1 : 0; hgt[k] = M.max(0, G.Noise.surfaceRaw(e, W, H, x, y)); }
    // 河道（按流量定宽）与既有道路栅格化
    const river = new Uint8Array(N), road = new Uint8Array(N), roadDir = new Float32Array(N).fill(NaN);
    const inBox = (x, y, m) => x > X0 - m && x < X0 + n * sx + m && y > Y0 - m && y < Y0 + n * sy + m;
    const stamp = (A, x0, y0, x1, y1, wKm, val, dir) => { const L = M.hypot((x1 - x0) * kx, (y1 - y0) * ky), st = M.max(1, M.ceil(L / (ck * 0.5))), rr = M.max(0, M.round(wKm / ck / 2));
      for (let t = 0; t <= st; t++) { const x = x0 + (x1 - x0) * t / st, y = y0 + (y1 - y0) * t / st, ci = M.floor((x - X0) / sx), cj = M.floor((y - Y0) / sy);
        for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) { const ii = ci + di, jj = cj + dj; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue; const k = jj * n + ii; A[k] = val; if (dir !== undefined) roadDir[k] = dir; } } };
    { const r = Hy.rivers, wrap = x => x + M.round((city.x - x) / W) * W;
      for (let s = 0; s < r.offs.length - 1; s++) for (let v = r.offs[s] + 1; v < r.offs[s + 1]; v++) { const ax = wrap(r.pts[v * 7 - 7]), ay = r.pts[v * 7 - 6], bx = wrap(r.pts[v * 7]), by = r.pts[v * 7 + 1];
        if (!inBox(ax, ay, 1) && !inBox(bx, by, 1)) continue; const q = r.pts[v * 7 + 2] / Hy.qth; if (q < 2) continue; stamp(river, ax, ay, bx, by, M.min(1.6, 0.06 * M.sqrt(q)), 1); }
      for (const cls of ['trunk', 'regional', 'local']) for (const l of (Cv.roads[cls] || [])) for (let v = 2; v < l.length; v += 2) { const ax = wrap(l[v - 2]), ay = l[v - 1], bx = wrap(l[v]), by = l[v + 1];
        if (!inBox(ax, ay, 0.5) && !inBox(bx, by, 0.5)) continue; stamp(road, ax, ay, bx, by, 0, cls === 'trunk' ? 3 : cls === 'regional' ? 2 : 1, M.atan2((by - ay) * ky, (bx - ax) * kx)); } }
    // ---- 生长：以道路加速、坡度与过河减速的代价距离，从城心（与卫星镇）向外 ----
    const slope = new Float32Array(N);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i, a = hgt[j * n + M.min(n - 1, i + 1)] - hgt[j * n + M.max(0, i - 1)], b = hgt[M.min(n - 1, j + 1) * n + i] - hgt[M.max(0, j - 1) * n + i]; slope[k] = M.hypot(a, b) / (2 * ck * 1000); }
    const nz = G.Noise.simplex2((cfg.seed >>> 0) + idx * 7 + 31);
    const cost = new Float32Array(N).fill(Infinity), pred = new Int32Array(N).fill(-1), from = new Int16Array(N).fill(-1);
    const stepC = k => { if (!land[k]) return Infinity; const [x, y] = [k % n, (k / n) | 0]; let c = 1 + 22 * slope[k] + (river[k] ? 5 : 0); if (road[k]) c *= [1, 0.55, 0.42, 0.32][road[k]]; return c * (1 + 0.35 * nz(x * 0.09, y * 0.09)); };
    const hp = new G.Hydro.Heap(4096), seeds = [];
    const ci = M.floor(n / 2), cj = M.floor(n / 2); let c0 = cj * n + ci;
    if (!land[c0]) { let best = -1, bd = 1e9; for (let k = 0; k < N; k++) if (land[k]) { const d = M.hypot(k % n - ci, ((k / n) | 0) - cj); if (d < bd) { bd = d; best = k; } } if (best >= 0) c0 = best; }
    seeds.push({ k: c0, off: 0 });
    if (big) { // 卫星镇：沿出城道路，距城心 1.4–2.6 倍半径
      const nSat = M.min(6, 1 + M.floor(M.log2(pop / 300000) * 1.6)), cand = [];
      for (let k = 0; k < N; k++) if (road[k] && land[k]) { const d = M.hypot(k % n - ci, ((k / n) | 0) - cj) * ck / rKm; if (d > 1.4 && d < 2.6) cand.push(k); }
      for (let t = 0; t < nSat && cand.length; t++) { let best = -1, bv = -1; for (const k of cand) { let md = 1e9; for (const s of seeds) md = M.min(md, M.hypot(k % n - s.k % n, ((k / n) | 0) - ((s.k / n) | 0))); const v = md * (road[k] + 1) * (0.6 + rnd()); if (v > bv) { bv = v; best = k; } } if (best < 0) break; seeds.push({ k: best, off: rKm / ck * (0.7 + 0.5 * rnd()) }); } }
    seeds.forEach((s, si) => { cost[s.k] = s.off; from[s.k] = si; hp.push(s.k, s.off); });
    while (hp.n) { const k = hp.pop(), c = cost[k]; const x = k % n, y = (k / n) | 0, ck0 = stepC(k);
      for (let d = 0; d < 8; d++) { const dx = [1, 1, 0, -1, -1, -1, 0, 1][d], dy = [0, 1, 1, 1, 0, -1, -1, -1][d], xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue;
        const j = yy * n + xx, cj2 = stepC(j); if (cj2 === Infinity) continue; const nc = c + (ck0 + cj2) * 0.5 * (d & 1 ? 1.4142 : 1); if (nc < cost[j]) { cost[j] = nc; pred[j] = k; from[j] = from[k]; hp.push(j, nc); } } }
    // 取代价最低的格直到面积达标 → 建成区
    const want = M.round(area / (ck * ck)), order = []; for (let k = 0; k < N; k++) if (cost[k] < Infinity) order.push(k);
    order.sort((a, b) => cost[a] - cost[b]);
    // 外缘断续蔓延：先多取一些，再按噪声去掉外圈的一部分（城郊零散、中间留绿地），道路两侧保留（带状街区）
    const built = new Uint8Array(N); let cut = Infinity, take = M.min(order.length, M.round(want * 1.3));
    for (let t = 0; t < take; t++) { built[order[t]] = 1; cut = cost[order[t]]; }
    const nz2 = G.Noise.simplex2((cfg.seed >>> 0) + idx * 13 + 77);
    for (let t = 0; t < take; t++) { const k = order[t], f = cost[k] / cut; if (f < 0.5 || road[k]) continue; const x = k % n, y = (k / n) | 0;
      if (nz2(x * 0.16, y * 0.16) * 0.7 + nz2(x * 0.45, y * 0.45) * 0.3 < -0.15 + (1 - f) * 0.9) continue; built[k] = 0; }
    // 平滑：多数滤波一次，去掉锯齿与孤格
    { const B = Uint8Array.from(built); for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) { const k = j * n + i; let s = 0; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) s += B[k + dj * n + di]; built[k] = land[k] && (s >= 5 || (B[k] && s >= 4)) ? 1 : 0; } }
    // ---- 轮廓：marching squares → 世界坐标环 ----
    const rings = contour(built, n, toW);
    // ---- 街区：按区块（城心 / 卫星 / 大城分片）取朝向，网格街道裁到建成区内 ----
    const spacing = (era === 'industrial' ? 0.32 : 0.26) * (big ? 1.5 : mid ? 1.15 : 1); // km
    const districts = [];
    const orientAt = (k) => { // 朝向：就近道路 → 海岸法线 → 随机
      const x = k % n, y = (k / n) | 0; let best = NaN, bd = 1e9; for (let dj = -8; dj <= 8; dj++) for (let di = -8; di <= 8; di++) { const xx = x + di, yy = y + dj; if (xx < 0 || yy < 0 || xx >= n || yy >= n) continue; const kk = yy * n + xx; if (!isNaN(roadDir[kk])) { const d = di * di + dj * dj; if (d < bd) { bd = d; best = roadDir[kk]; } } }
      if (!isNaN(best)) return best;
      let gx = 0, gy = 0; for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const xx = M.min(n - 1, M.max(0, x + di)), yy = M.min(n - 1, M.max(0, y + dj)); if (!land[yy * n + xx]) { gx += di; gy += dj; } }
      return gx || gy ? M.atan2(gy, gx) + M.PI / 2 : rnd() * M.PI; };
    { const dsz = big ? M.max(8, M.round(3.5 / ck)) : 1e9; // 大城每约 3.5 km 一个分区，各自朝向
      const centers = seeds.map(s => s.k); if (big) for (let t = 0; t < 40; t++) { const k = order[M.floor(rnd() * M.min(want, order.length))]; if (k === undefined) break; if (centers.every(c => M.hypot(c % n - k % n, ((c / n) | 0) - ((k / n) | 0)) > dsz)) centers.push(k); }
      for (const c of centers) districts.push({ k: c, ang: orientAt(c) + (rnd() - 0.5) * 0.25, old: false }); }
    const distOf = new Int16Array(N).fill(-1);
    for (let k = 0; k < N; k++) if (built[k]) { let best = 0, bd = 1e9; districts.forEach((dd, t) => { const d = M.hypot(k % n - dd.k % n, ((k / n) | 0) - ((dd.k / n) | 0)); if (d < bd) { bd = d; best = t; } }); distOf[k] = best; }
    // 老城：前工业城市的城心为有机街巷（扭曲网格、更密），外缘是城墙
    const oldR = era === 'industrial' ? 0 : (big ? 0.42 : 0.55) * rKm / ck;
    const isOld = k => oldR > 0 && M.hypot(k % n - c0 % n, ((k / n) | 0) - ((c0 / n) | 0)) < oldR * (1 + 0.12 * nz(k % n * 0.08 + 50, ((k / n) | 0) * 0.08));
    const minor = [], lanes = [], bld = [], bTone = [], plazas = [];
    const warp = (u, v, k) => isOld(k) ? [u + 0.07 * nz(u * 0.12, v * 0.12) * (spacing / ck), v + 0.07 * nz(v * 0.12 + 9, u * 0.12) * (spacing / ck)] : [u, v];
    const sampleBuilt = (u, v) => { const i = M.floor(u), j = M.floor(v); return i >= 0 && j >= 0 && i < n && j < n ? j * n + i : -1; };
    districts.forEach((dd, t) => {
      const sp = spacing / ck, ca = M.cos(dd.ang), sa = M.sin(dd.ang), cx = dd.k % n + 0.5, cy = ((dd.k / n) | 0) + 0.5, ext = n * 1.5;
      for (const axis of [0, 1]) for (let o = -ext; o <= ext; o += sp * (axis ? 1 : 1.35)) { // 两组正交街道，一组略稀，形成长方形街区
        let cur = [];
        const flush = () => { if (cur.length >= 4) minor.push(Float32Array.from(cur)); cur = []; };
        for (let s2 = -ext; s2 <= ext; s2 += 0.5) {
          const u0 = axis ? o : s2, v0 = axis ? s2 : o; let u = cx + u0 * ca - v0 * sa, v = cy + u0 * sa + v0 * ca;
          const k = sampleBuilt(u, v); if (k < 0 || !built[k] || distOf[k] !== t) { flush(); continue; }
          if (isOld(k)) { u += 0.07 * nz(u * 0.12, v * 0.12) * sp; v += 0.07 * nz(v * 0.12 + 9, u * 0.12) * sp; } // 老城街巷略弯
          const [x, y] = toW(u - 0.5, v - 0.5); cur.push(x, y);
        }
        flush();
      }
      if (!opt.detail) return;
      // ---- 细部（城市面板）：每个主街区再分 3×3 条街巷，巷间排布建筑 ----
      const du = sp / 3, dv = sp * 1.35 / 3, MAXB = big ? 70000 : 30000;
      for (const axis of [0, 1]) { const st = axis ? du : dv; let idx2 = 0; for (let o = -ext; o <= ext; o += st, idx2++) { if (idx2 % 3 === 0) continue; let cur = [];
        const flush = () => { if (cur.length >= 4) lanes.push(Float32Array.from(cur)); cur = []; };
        for (let s2 = -ext; s2 <= ext; s2 += 0.5) { const u0 = axis ? o : s2, v0 = axis ? s2 : o; const u = cx + u0 * ca - v0 * sa, v = cy + u0 * sa + v0 * ca, k = sampleBuilt(u, v);
          if (k < 0 || !built[k] || distOf[k] !== t || river[k]) { flush(); continue; } const [wu, wv] = warp(u, v, k), [x, y] = toW(wu - 0.5, wv - 0.5); cur.push(x, y); } flush(); } }
      for (let a = -ext; a <= ext; a += du) for (let b = -ext; b <= ext; b += dv) {
        if (bld.length / 8 >= MAXB) break;
        const ac = a + du / 2, bc = b + dv / 2, u = cx + ac * ca - bc * sa, v = cy + ac * sa + bc * ca, k = sampleBuilt(u, v);
        if (k < 0 || !built[k] || distOf[k] !== t || river[k] || road[k] >= 2) continue;
        const f = cost[k] / cut, old = isOld(k); if (!old && rnd() > 0.95 - 0.5 * f) continue;
        // 宅地：老城 3×2 小院密排；新区沿街两排、每排 2–3 栋；外缘偶有大院（作坊、仓库）
        const parts = []; if (old) { for (const px2 of [-0.3, 0, 0.3]) for (const py2 of [-0.22, 0.22]) parts.push([px2, py2, 0.26, 0.36]); }
        else if (f > 0.8 && rnd() < 0.25) parts.push([0, 0, 0.7, 0.62]);
        else { const nn = rnd() < 0.5 ? 2 : 3, wd = 0.78 / nn; for (let q = 0; q < nn; q++) for (const py2 of [-0.2, 0.2]) parts.push([-0.39 + wd * (q + 0.5), py2, wd * 0.82, 0.32]); }
        for (const pt of parts) { if (rnd() < (old ? 0.08 : 0.14)) continue; const hw = (pt[2] / 2) * du, hh = ((pt[3] || pt[2]) / 2) * dv, ox = ac + pt[0] * du, oy = bc + pt[1] * dv;
          const q = []; for (const [sx2, sy2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const la = ox + sx2 * hw, lb = oy + sy2 * hh; const uu = cx + la * ca - lb * sa, vv = cy + la * sa + lb * ca, [wu, wv] = warp(uu, vv, k), [x, y] = toW(wu - 0.5, wv - 0.5); q.push(x, y); }
          bld.push(...q); bTone.push(old ? 1 : f > 0.75 ? 2 : 0); } }
    });
    // ---- 干道：从建成区外缘沿生长树回到城心（顺地形的放射路） ----
    const arterials = []; { const nA = big ? 12 : mid ? 7 : 3, edge = [];
      for (let k = 0; k < N; k++) if (built[k] && from[k] === 0) { const x = k % n, y = (k / n) | 0; if (x === 0 || y === 0 || x === n - 1 || y === n - 1 || !built[k - 1] || !built[k + 1] || !built[k - n] || !built[k + n]) edge.push(k); }
      const used = [];
      for (let a = 0; a < nA; a++) { const ang = a / nA * 2 * M.PI + rnd() * 0.3; let best = -1, bv = -1e9;
        for (const k of edge) { const dx = k % n - c0 % n, dy = ((k / n) | 0) - ((c0 / n) | 0), al = M.cos(M.atan2(dy, dx) - ang) * M.hypot(dx, dy); if (al > bv) { bv = al; best = k; } }
        if (best < 0 || used.includes(best)) continue; used.push(best);
        const line = []; let k = best, g = 0; while (k >= 0 && g++ < 4 * n) { const [x, y] = toW(k % n, (k / n) | 0); line.push(x, y); k = pred[k]; }
        if (line.length >= 6) arterials.push(chaikin(line, 2)); } }
    // ---- 城墙（前工业）/ 环路（工业时代大城） ----
    let wall = null, ring = null;
    if (oldR > 1.5) { const m = new Uint8Array(N); for (let k = 0; k < N; k++) m[k] = built[k] && isOld(k) && from[k] === 0 ? 1 : 0; const rs = contour(m, n, toW); if (rs.length) { const r0 = rs.sort((a, b) => b.length - a.length)[0], sim = []; for (let q = 0; q < r0.length; q += 8) sim.push(r0[q], r0[q + 1]); sim.push(sim[0], sim[1]); wall = chaikin(sim, 3); } }
    if (big && era === 'industrial') { const m = new Uint8Array(N); const lim = cut * 0.45; for (let k = 0; k < N; k++) m[k] = built[k] && from[k] === 0 && cost[k] < lim ? 1 : 0; const rs = contour(m, n, toW); if (rs.length) ring = rs.sort((a, b) => b.length - a.length)[0]; }
    // 公园与水边绿地：建成区内的低洼河岸
    const parks = []; { const m = new Uint8Array(N); for (let k = 0; k < N; k++) { if (!built[k]) continue; let nr = false; for (const d of [-1, 1, -n, n]) if (river[k + d]) nr = true; if (nr && rnd() < 0.5) m[k] = 1; } for (const r of contour(m, n, toW)) if (r.length >= 10) parks.push(r); }
    // ---- 片区与地标（城市面板用） ----
    const lib = (Cv.libs || []).find(l => l.id === city.lib) || (Cv.libs || [])[0] || { regions: [], cities: [] };
    const pool = [].concat(lib.regions || [], lib.cities || []).filter(nm => nm && nm !== city.name), used = new Set([city.name]);
    const pick = () => { for (let t = 0; t < 40 && pool.length; t++) { let nm = pool[M.floor(rnd() * pool.length)]; for (let r2 = 0; r2 < 2; r2++) nm = nm.replace(/(地区|平原|高原|高地|盆地|草原|山地|低地|河谷|谷地|丘陵|海岸|半岛|群岛|岛|郡|州|府|城|镇|村|堡)$/, ''); if (nm.length > 4) nm = nm.slice(0, 4); if (nm && !used.has(nm)) { used.add(nm); return nm; } } return null; };
    const SUF = era === 'industrial' ? ['区', '区', '新区', '坊'] : ['坊', '里', '厢', '坊'];
    const dLabels = []; if (mid) districts.forEach((dd, t) => { if (t === 0) return; const nm = pick(); if (!nm) return; const [x, y] = toW(dd.k % n, (dd.k / n) | 0); dLabels.push({ x, y, name: nm + SUF[t % SUF.length], kind: t < seeds.length ? 'sat' : 'dist' }); });
    if (mid && oldR > 1.5) { const [x, y] = toW(c0 % n + oldR * 0.55, ((c0 / n) | 0) - oldR * 0.45); dLabels.push({ x, y, name: era === 'industrial' ? '旧城区' : '老城', kind: 'old' }); }
    const marks = []; { const [x, y] = toW(c0 % n, (c0 / n) | 0); marks.push({ x, y, kind: city.capital !== undefined ? 'palace' : 'office', name: city.capital !== undefined ? '宫城' : (city.seat !== undefined ? '府衙' : '官署') }); }
    if (mid) { // 市集：最靠近干道交汇的老城格；寺庙：城心附近的高处
      let mk = -1, mv = -1, tk = -1, tv = -1e9; for (let k = 0; k < N; k++) { if (!built[k]) continue; const d = M.hypot(k % n - c0 % n, ((k / n) | 0) - ((c0 / n) | 0)); if (d < 3 || d > (oldR || rKm / ck) * 1.4) continue; const v = (road[k] ? 2 : 0) - d * 0.05 + rnd() * 0.3; if (v > mv) { mv = v; mk = k; } const h2 = hgt[k] - d * 2; if (h2 > tv) { tv = h2; tk = k; } }
      if (mk >= 0) { const [x, y] = toW(mk % n, (mk / n) | 0); marks.push({ x, y, kind: 'market', name: '市集' }); } if (tk >= 0 && tk !== mk) { const [x, y] = toW(tk % n, (tk / n) | 0); marks.push({ x, y, kind: 'temple', name: '寺庙' }); } }
    { let pk = -1, pv = 1e9; for (let k = 0; k < N; k++) { if (!built[k]) continue; let wet = false; for (const d of [-1, 1, -n, n]) { const j = k + d; if (j >= 0 && j < N && !land[j]) wet = true; } if (!wet) continue; const d = M.hypot(k % n - c0 % n, ((k / n) | 0) - ((c0 / n) | 0)); if (d < pv) { pv = d; pk = k; } }
      if (pk >= 0 && pv * ck < rKm * 1.3) { const [x, y] = toW(pk % n, (pk / n) | 0); marks.push({ x, y, kind: 'port', name: city.type === 'river-city' ? '码头' : '港口' }); } }
    // 城门：城墙与干道的交点
    if (wall) for (const a of arterials) for (let q = 2; q < a.length; q += 2) { let hit = null; for (let w2 = 2; w2 < wall.length && !hit; w2 += 2) { const p0x = a[q - 2], p0y = a[q - 1], d1x = a[q] - p0x, d1y = a[q + 1] - p0y, ax = wall[w2 - 2], ay = wall[w2 - 1], d2x = wall[w2] - ax, d2y = wall[w2 + 1] - ay, den = d1x * d2y - d1y * d2x; if (Math.abs(den) < 1e-12) continue; const t = ((ax - p0x) * d2y - (ay - p0y) * d2x) / den, u = ((ax - p0x) * d1y - (ay - p0y) * d1x) / den; if (t >= 0 && t <= 1 && u >= 0 && u <= 1) hit = [p0x + d1x * t, p0y + d1y * t]; }
      if (hit && !marks.some(m => m.kind === 'gate' && M.hypot(m.x - hit[0], m.y - hit[1]) < 0.02)) { const dirs = ['东', '东南', '南', '西南', '西', '西北', '北', '东北'], ang = M.atan2(hit[1] - city.y, (hit[0] - city.x) * kx / ky), di = ((M.round(ang / (M.PI / 4)) % 8) + 8) % 8; marks.push({ x: hit[0], y: hit[1], kind: 'gate', name: dirs[di] + '门' }); break; } }
    // 广场：宫城 / 市集 / 片区中心 / 城门内侧，去掉其中的建筑
    const B = Float32Array.from(bld), tone = Uint8Array.from(bTone);
    const extraB = [], extraT = [], compounds = [];
    if (opt.detail) { const pz = []; for (const m of marks) if (m.kind !== 'gate' && m.kind !== 'port') pz.push([m.x, m.y, m.kind === 'palace' ? 0.3 : m.kind === 'office' ? 0.16 : m.kind === 'market' ? 0.12 : 0.08, m.kind]); for (const d2 of dLabels) pz.push([d2.x, d2.y, 0.07, 'dist']);
      const rect = (x, y, hx, hy) => [x - hx / kx, y - hy / ky, x + hx / kx, y - hy / ky, x + hx / kx, y + hy / ky, x - hx / kx, y + hy / ky];
      for (const [x, y, rk, kind] of pz) { const rx = rk / kx, ry = rk / ky;
        for (let q = 0; q < tone.length; q++) { const bx = B[q * 8], by = B[q * 8 + 1]; if (Math.abs(bx - x) < rx && Math.abs(by - y) < ry) tone[q] = 255; }
        if (kind === 'palace' || kind === 'office') { // 宫城 / 官署院落：围墙 + 中轴殿宇 + 门前广场
          compounds.push(Float32Array.from(rect(x, y, rk * 0.92, rk * 0.92)));
          const halls = kind === 'palace' ? [[0, -0.5, 0.42, 0.13], [0, -0.1, 0.5, 0.16], [0, 0.3, 0.34, 0.11], [-0.6, -0.1, 0.12, 0.3], [0.6, -0.1, 0.12, 0.3]] : [[0, -0.35, 0.4, 0.16], [0, 0.15, 0.3, 0.12]];
          for (const [ox, oy, hx, hy] of halls) { extraB.push(...rect(x + ox * rk / kx, y + oy * rk / ky, hx * rk, hy * rk)); extraT.push(3); }
          plazas.push(Float32Array.from(rect(x, y + (rk * 1.25) / ky, rk * 0.45, rk * 0.3))); }
        else { plazas.push(Float32Array.from(rect(x, y, rk, rk)));
          if (kind === 'market') for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) if ((a + b) % 2 === 0) { extraB.push(...rect(x + a * rk * 0.36 / kx, y + b * rk * 0.36 / ky, rk * 0.1, rk * 0.07)); extraT.push(2); }
          if (kind === 'temple') { extraB.push(...rect(x, y, rk * 0.45, rk * 0.45)); extraT.push(4); } } } }
    // 城墙箭楼：沿城墙每约 300 m 一座
    const towers = []; if (wall) { let acc = 0; for (let q = 2; q < wall.length; q += 2) { const dx = (wall[q] - wall[q - 2]) * kx, dy = (wall[q + 1] - wall[q - 1]) * ky, L = M.hypot(dx, dy); acc += L; if (acc >= 0.3) { acc = 0; towers.push(wall[q], wall[q + 1]); } } }
    // 码头：港口附近的岸线上，垂直岸线伸入水中的栈桥
    const piers = []; { const pm = marks.find(m => m.kind === 'port'); if (pm && opt.detail) { const reach = big ? 2.5 : 1.2;
      for (let k = 0; k < N; k++) { if (!built[k] || rnd() > 0.5) continue; const x = k % n, y = (k / n) | 0; let wx = 0, wy = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < n && yy < n && !land[yy * n + xx]) { wx += dx; wy += dy; } } if (!wx && !wy) continue;
        const [px, py] = toW(x, y); if (M.hypot((px - pm.x) * kx, (py - pm.y) * ky) > reach) continue; const L = 0.9, ang = M.atan2(wy, wx), ex = px + M.cos(ang) * L * sx, ey = py + M.sin(ang) * L * sy; piers.push(px, py, ex, ey); } } }
    const B2 = new Float32Array(B.length + extraB.length); B2.set(B); B2.set(extraB, B.length); const T2 = new Uint8Array(tone.length + extraT.length); T2.set(tone); T2.set(extraT, tone.length);
    return { idx, rKm, area, rings, minor, lanes, buildings: B2, bTone: T2, compounds, plazas, towers: Float32Array.from(towers), piers: Float32Array.from(piers), arterials, wall, ring, parks, sats: seeds.slice(1).map(s => toW(s.k % n, (s.k / n) | 0)), spacing, districts: dLabels, marks, era, pop, kx, ky, grid: opt.detail ? { n, X0, Y0, sx, sy, built } : null };
  }

  function chaikin(a, it) { for (let r = 0; r < it; r++) { if (a.length < 6) break; const q = [a[0], a[1]]; for (let i = 0; i < a.length - 2; i += 2) q.push(a[i] * 0.75 + a[i + 2] * 0.25, a[i + 1] * 0.75 + a[i + 3] * 0.25, a[i] * 0.25 + a[i + 2] * 0.75, a[i + 1] * 0.25 + a[i + 3] * 0.75); q.push(a[a.length - 2], a[a.length - 1]); a = q; } return Float32Array.from(a); }

  // 二值栅格的轮廓环（格心坐标插值 0.5 等值线）+ 两次切角平滑
  function contour(m, n, toW) {
    const segs = [], key = (x, y) => x * 4096 + y;
    const v = (i, j) => (i < 0 || j < 0 || i >= n || j >= n) ? 0 : m[j * n + i];
    for (let j = -1; j < n; j++) for (let i = -1; i < n; i++) {
      const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1), code = a * 8 + b * 4 + c * 2 + d;
      if (!code || code === 15) continue;
      const T = [2 * i + 2, 2 * j + 1], Rr = [2 * i + 3, 2 * j + 2], B = [2 * i + 2, 2 * j + 3], L = [2 * i + 1, 2 * j + 2]; // 半格坐标（×2）
      const add = (p, q) => segs.push(p, q);
      switch (code) { case 1: case 14: add(L, B); break; case 2: case 13: add(B, Rr); break; case 3: case 12: add(L, Rr); break; case 4: case 11: add(T, Rr); break; case 6: case 9: add(T, B); break; case 7: case 8: add(L, T); break; case 5: add(L, T); add(B, Rr); break; case 10: add(L, B); add(T, Rr); break; }
    }
    const adj = new Map(); for (let s = 0; s < segs.length; s += 2) for (const p of [segs[s], segs[s + 1]]) { const k = key(p[0], p[1]); (adj.get(k) || adj.set(k, []).get(k)).push(s); }
    const used = new Uint8Array(segs.length / 2), out = [];
    for (let s0 = 0; s0 < segs.length; s0 += 2) { if (used[s0 / 2]) continue; used[s0 / 2] = 1; const ring = [segs[s0], segs[s0 + 1]]; let cur = segs[s0 + 1];
      for (let g = 0; g < segs.length; g++) { const l = adj.get(key(cur[0], cur[1])); let nx = -1; for (const s of l) if (!used[s / 2]) { nx = s; break; } if (nx < 0) break; used[nx / 2] = 1; cur = key(segs[nx][0], segs[nx][1]) === key(cur[0], cur[1]) ? segs[nx + 1] : segs[nx]; ring.push(cur); }
      if (ring.length < 4) continue;
      const flat = []; for (const p of ring) { const [x, y] = toW(p[0] / 2 - 0.5, p[1] / 2 - 0.5); flat.push(x, y); }
      out.push(chaikin(flat, 2)); }
    return out;
  }

  G.Urban = { build };
})(typeof self !== 'undefined' ? self : this);
