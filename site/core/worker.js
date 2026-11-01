/* 推演 Worker：生成世界、按视口渲染、悬浮查询、路线规划 */
(function () {
  'use strict';
  const inWorker = typeof document === 'undefined' && typeof importScripts === 'function';
  if (inWorker) importScripts('noise.js', 'edges.js', 'libraries.js', 'culture-ext.js', 'admin.js', 'religions.js', 'planet.js', 'climate.js', 'hydro.js', 'society.js', 'borders.js', 'citysite.js', 'urban.js', 'render.js', 'history/regions.js', 'history/dawn.js', 'history/cities.js', 'history/polity.js', 'history/outline.js', 'history/heritage.js', 'history/apply.js', 'history/index.js');
  const G = self;
  let world = null, R = null;

  // ---------- 等值线（Marching Squares + 连线） ----------
  function contours(field, W, H, levels, scale, wrap, exact) {
    const out = [];
    const HE = W * H;
    for (const L of levels) {
      const segA = [], segB = [], adj = new Map(), ex = new Map(), ey = new Map();
      const ep = id => {
        if (ex.has(id)) return;
        let x0, y0, x1, y1;
        if (id < HE) { y0 = y1 = (id / W) | 0; x0 = id % W; x1 = x0 + 1; } else { const j = id - HE; x0 = x1 = j % W; y0 = (j / W) | 0; y1 = y0 + 1; }
        const e0 = field[y0 * W + (x0 % W)], e1 = field[y1 * W + (x1 % W)];
        let t = (L - e0) / (e1 - e0 || 1e-9);
        if (exact) { // 沿格边用 Catmull-Rom 三次曲线求交点，与显示用的三次插值地表一致
          const hz = x1 !== x0, at = (k) => hz ? field[y0 * W + (((x0 + k) % W) + W) % W] : field[Math.min(H - 1, Math.max(0, y0 + k)) * W + (x0 % W)];
          const p0 = at(-1), p3 = at(2); let a = 0, b = 1; const f = u => G.Noise.cr(p0, e0, e1, p3, u) - L, fa = f(0);
          for (let it = 0; it < 14; it++) { const m = (a + b) / 2; if ((f(m) > 0) === (fa > 0)) a = m; else b = m; } t = (a + b) / 2; }
        ex.set(id, (x0 + (x1 - x0) * t + 0.5) * scale); ey.set(id, (y0 + (y1 - y0) * t + 0.5) * scale);
      };
      const add = (a, b) => { const s = segA.length; segA.push(a); segB.push(b); ep(a); ep(b); (adj.get(a) || adj.set(a, []).get(a)).push(s); (adj.get(b) || adj.set(b, []).get(b)).push(s); };
      for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
        const i = y * W + x;
        const a = field[i] >= L, b = field[i + 1] >= L, c = field[i + W + 1] >= L, d = field[i + W] >= L;
        const code = (a ? 8 : 0) | (b ? 4 : 0) | (c ? 2 : 0) | (d ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const T = i, Rr = HE + i + 1, B = i + W, Lf = HE + i;
        switch (code) {
          case 1: case 14: add(Lf, B); break; case 2: case 13: add(B, Rr); break; case 3: case 12: add(Lf, Rr); break;
          case 4: case 11: add(T, Rr); break; case 6: case 9: add(T, B); break; case 7: case 8: add(Lf, T); break;
          case 5: case 10: { const ctr = (field[i] + field[i + 1] + field[i + W] + field[i + W + 1]) / 4 >= L; if ((code === 5) === ctr) { add(Lf, T); add(B, Rr); } else { add(Lf, B); add(T, Rr); } }
        }
      }
      const used = new Uint8Array(segA.length);
      for (let s0 = 0; s0 < segA.length; s0++) {
        if (used[s0]) continue; used[s0] = 1;
        const walk = (start) => { const arr = [start]; let cur = start; for (;;) { const l = adj.get(cur); let nx = -1; for (const s of l) if (!used[s]) { nx = s; break; } if (nx < 0) break; used[nx] = 1; cur = segA[nx] === cur ? segB[nx] : segA[nx]; arr.push(cur); } return arr; };
        const f = walk(segB[s0]), b = walk(segA[s0]).reverse();
        const ch = b.concat(f);
        if (ch.length < 6) continue;
        let pts = [];
        for (const id of ch) pts.push(ex.get(id), ey.get(id));
        if (exact) { const np = [pts[0], pts[1]]; for (let k = 0; k < pts.length / 2 - 1; k++) { const ax = pts[2 * k], ay = pts[2 * k + 1], bx = pts[2 * k + 2], by = pts[2 * k + 3]; np.push(ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25, ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75); } np.push(pts[pts.length - 2], pts[pts.length - 1]); out.push({ level: L, pts: Float32Array.from(np) }); continue; } // 全精度：交点在三次地表上，只做一次轻度圆角
        // Chaikin 平滑
        const np = [pts[0], pts[1]];
        for (let k = 0; k < pts.length / 2 - 1; k++) { const ax = pts[2 * k], ay = pts[2 * k + 1], bx = pts[2 * k + 2], by = pts[2 * k + 3]; np.push(ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25, ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75); }
        np.push(pts[pts.length - 2], pts[pts.length - 1]);
        out.push({ level: L, pts: Float32Array.from(np) });
      }
    }
    void wrap;
    return out;
  }
  // 等高线按海岸地表裁剪：陆上等高线只留在陆上、海深线只留在海里。
  // 设色海岸用 coastSurface（带格下小岬、小湾），等高线取自格网高程，二者在近岸会错开——不裁剪时低等高线会伸出海岸、漂在海面上。
  function clipCoast(list, A, W, H, STEP) {
    const out = [], cs = (x, y) => G.Noise.coastSurface(A, W, H, x, y, true);
    for (const c of list) {
      // 陆上等高线还要落在近岸收口后的地表上（与设色、晕渲的岸坡一致），不再一头扒到海岸线上
      const a = c.pts, want = c.level > 0, L = c.level, ok = want ? (v, x, y) => G.Noise.coastKeeps(L, v, A, W, H, x, y) : v => v <= 0;
      let run = null;
      const flush = () => { if (run && run.length >= 4) out.push(Object.assign({}, c, { pts: Float32Array.from(run) })); run = null; };
      let px = a[0], py = a[1], pv = cs(px, py);
      if (ok(pv, px, py)) run = [px, py];
      for (let k = 2; k < a.length; k += 2) {
        const qx = a[k], qy = a[k + 1], qv = cs(qx, qy);
        if (run && (want ? pv > 90 && qv > 90 && ok(qv, qx, qy) : pv < -90 && qv < -90)) run.push(qx, qy); // 两端都远离海岸：整段保留
        else {
          const n = Math.max(1, Math.ceil(Math.hypot(qx - px, qy - py) / STEP));
          let lx = px, ly = py, lok = ok(pv, px, py);
          for (let j = 1; j <= n; j++) {
            const t = j / n, x = px + (qx - px) * t, y = py + (qy - py) * t, o = ok(j === n ? qv : cs(x, y), x, y);
            if (o !== lok) { // 二分求与海岸线的交点，线段恰好止于海岸
              let ax = lx, ay = ly, bx = x, by = y;
              for (let it = 0; it < 10; it++) { const mx = (ax + bx) / 2, my = (ay + by) / 2; if (ok(cs(mx, my), mx, my) === lok) { ax = mx; ay = my; } else { bx = mx; by = my; } }
              const cx = lok ? ax : bx, cy = lok ? ay : by;
              if (lok) { run.push(cx, cy); flush(); } else run = [cx, cy];
              lok = o;
            }
            lx = x; ly = y;
          }
          if (lok) run.push(qx, qy);
        }
        px = qx; py = qy; pv = qv;
      }
      flush();
    }
    return out;
  }


  // ---------- 边界折线：标签格边 → 连线 → 抽稀 + Chaikin 平滑 ----------
  function boundaryLines(lab, W, H, accept, scale, fine) {
    const segs = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, a = lab[i];
      const r = y * W + (x + 1) % W; if (x < W - 1 && accept(a, lab[r], i, r)) segs.push(x + 1, y, x + 1, y + 1);
      if (y < H - 1) { const d = i + W; if (accept(a, lab[d], i, d)) segs.push(x, y + 1, x + 1, y + 1); }
    }
    const key = (x, y) => y * 100000 + x, adj = new Map();
    for (let k = 0; k < segs.length; k += 4) for (const kk of [key(segs[k], segs[k + 1]), key(segs[k + 2], segs[k + 3])]) { let l = adj.get(kk); if (!l) adj.set(kk, l = []); l.push(k); }
    const used = new Uint8Array(segs.length / 4), out = [];
    for (let s0 = 0; s0 < segs.length; s0 += 4) {
      if (used[s0 / 4]) continue; used[s0 / 4] = 1;
      const walk = (x, y) => { const pts = []; for (;;) { const l = adj.get(key(x, y)); let nx = -1; for (const s of l) if (!used[s / 4]) { nx = s; break; } if (nx < 0) break; used[nx / 4] = 1; if (segs[nx] === x && segs[nx + 1] === y) { x = segs[nx + 2]; y = segs[nx + 3]; } else { x = segs[nx]; y = segs[nx + 1]; } pts.push([x, y]); } return pts; };
      let pts = walk(segs[s0], segs[s0 + 1]).reverse().concat([[segs[s0], segs[s0 + 1]], [segs[s0 + 2], segs[s0 + 3]]], walk(segs[s0 + 2], segs[s0 + 3]));
      if (fine) { // 格边中点连线：与填色的“双线性多数”边界逐段重合，不做圆滑
        let m = [pts[0]]; for (let k = 0; k < pts.length - 1; k++) m.push([(pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2]); m.push(pts[pts.length - 1]);
        if (pts.length > 2 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) { m[0] = m[m.length - 2]; m.pop(); m.push(m[0]); }
        { const q = [m[0]]; for (let k = 0; k < m.length - 1; k++) { const a = m[k], b = m[k + 1]; q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } q.push(m[m.length - 1]); m = q; } // 只削一格的台阶角，与 B 样条多数填色重合
        const f = new Float32Array(m.length * 2); m.forEach((p, k) => { f[2 * k] = p[0] * scale; f[2 * k + 1] = p[1] * scale; }); out.push(f); continue; }
      if (pts.length > 5) pts = pts.filter((p, k) => k % 2 === 0 || k === pts.length - 1);
      for (let it = 0; it < 2; it++) { const np = [pts[0]]; for (let k = 0; k < pts.length - 1; k++) { const p = pts[k], q = pts[k + 1]; np.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]); } np.push(pts[pts.length - 1]); pts = np; }
      const f = new Float32Array(pts.length * 2); pts.forEach((p, k) => { f[2 * k] = p[0] * scale; f[2 * k + 1] = p[1] * scale; }); out.push(f);
    }
    return out;
  }


  // ---------- 专题注记：每个专题图把自己的类别（文明、语言、宗教、制度、气候带、群系、流域、分级区间）直接写在地图对应的区域里 ----------
  // 同类相连成片：每片取离边缘最远处为锚点（可容纳注记的最大内切圆半径 d，单位为半分辨率格），并给出主轴方向与长短轴比
  function zoneLabels(cls, cw, ch, minN, cap) {
    const N = cw * ch, dist = new Int16Array(N).fill(-1), q = new Int32Array(N), lab = new Uint8Array(N);
    const nb4 = (i, k) => { const y = (i / cw) | 0, x = i - y * cw; if (k === 0) return y * cw + (x + 1) % cw; if (k === 1) return y * cw + (x - 1 + cw) % cw; if (k === 2) return y > 0 ? i - cw : -1; return y < ch - 1 ? i + cw : -1; };
    let t = 0;
    for (let i = 0; i < N; i++) { const c = cls[i]; if (c < 0) continue; for (let k = 0; k < 4; k++) { const j = nb4(i, k); if (j < 0 || cls[j] !== c) { dist[i] = 0; q[t++] = i; break; } } }
    for (let h = 0; h < t; h++) { const i = q[h]; for (let k = 0; k < 4; k++) { const j = nb4(i, k); if (j >= 0 && dist[j] < 0 && cls[j] === cls[i]) { dist[j] = dist[i] + 1; q[t++] = j; } } }
    const out = [], extra = []; let gid = 0;
    for (let s0 = 0; s0 < N; s0++) {
      const c = cls[s0]; if (c < 0 || lab[s0]) continue;
      let n = 0, h = 0, e = 0; q[e++] = s0; lab[s0] = 1; const x0 = s0 % cw; let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, best = s0;
      while (h < e) { const i = q[h++]; n++; const y = (i / cw) | 0; let x = i - y * cw; if (x - x0 > cw / 2) x -= cw; if (x0 - x > cw / 2) x += cw; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; if (dist[i] > dist[best]) best = i;
        for (let k = 0; k < 4; k++) { const j = nb4(i, k); if (j >= 0 && !lab[j] && cls[j] === c) { lab[j] = 1; q[e++] = j; } } }
      if (n < minN) continue;
      const mx = sx / n, my = sy / n, cxx = sxx / n - mx * mx, cyy = syy / n - my * my, cxy = sxy / n - mx * my;
      const tr = (cxx + cyy) / 2, df = Math.sqrt(((cxx - cyy) / 2) ** 2 + cxy * cxy), l1 = tr + df, l2 = Math.max(0.25, tr - df);
      const by = (best / cw) | 0, bx = best - by * cw;
      const g = gid++, z0 = { c, g, x: (bx + 0.5) * 2, y: (by + 0.5) * 2, d: Math.max(0.5, dist[best]), n, a: Math.round(0.5 * Math.atan2(2 * cxy, cxx - cyy) * 1000) / 1000, el: Math.round(Math.sqrt(l1 / l2) * 100) / 100 };
      out.push(z0);
      // 大片区域再按 24 格分块各取一个内部锚点：放大后主锚点移出视野，区域里仍有注记（页面按同类间距去重）
      if (n >= 300) { const B = 24, blk = new Map();
        for (let h2 = 0; h2 < e; h2++) { const i = q[h2]; if (dist[i] < 4) continue; const y = (i / cw) | 0, x = i - y * cw, key = ((y / B) | 0) * 4096 + ((x / B) | 0), o = blk.get(key); if (o === undefined || dist[i] > dist[o]) blk.set(key, i); }
        for (const i of blk.values()) { const y = (i / cw) | 0, x = i - y * cw; let dx = Math.abs(x - bx); dx = Math.min(dx, cw - dx); if (Math.hypot(dx, y - by) < B * 0.8) continue;
          extra.push({ c, g, x: (x + 0.5) * 2, y: (y + 0.5) * 2, d: dist[i], n, a: 0, el: 1, sub: 1 }); } }
    }
    out.sort((a, b) => b.n - a.n); const main = out.slice(0, cap);
    extra.sort((a, b) => b.d - a.d); return main.concat(extra.slice(0, 2500));
  }
  function topicZones(P, Cl, Hy, Cv, riverNames, Z, push) {
    const cw = Cv.W, ch = Cv.H, N = cw * ch, FW = P.W, land = Cv.land, ice = Cv.ice;
    const full = (A, none) => { const o = new Int16Array(N); for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const v = A[(2 * y) * FW + 2 * x]; o[y * cw + x] = v === none || !land[y * cw + x] ? -1 : v; } return o; };
    const blur = (F) => { let A = Float32Array.from(F); const T = new Float32Array(N), r = 2; for (let it = 0; it < 2; it++) {
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { let s = 0; for (let k = -r; k <= r; k++) s += A[y * cw + (x + k + cw) % cw]; T[y * cw + x] = s / (2 * r + 1); }
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= ch) continue; s += T[yy * cw + x]; n++; } A[y * cw + x] = s / n; } } return A; };
    const binned = (F, th, mask) => { const B = blur(F), o = new Int16Array(N); for (let i = 0; i < N; i++) { if (!mask(i)) { o[i] = -1; continue; } let c = 0; while (c < th.length && B[i] >= th[c]) c++; o[i] = c; } return o; };
    const cat = (A) => { const o = new Int16Array(N); for (let i = 0; i < N; i++) o[i] = land[i] && A[i] >= 0 ? A[i] : -1; return o; };
    const MIN = Math.max(6, Math.round(N / 90000));
    const dry = i => land[i] && !ice[i]; // 干燥掩码：pop/agri/habit/veg 注记只落在无冰陆地上
    // 每类注记一个任务：与其它覆盖层一起分块推进，避免一次性算完阻塞瓦片渲染
    push(() => { Z.culture = zoneLabels(cat(Cv.culture), cw, ch, MIN, 160); });
    push(() => { Z.language = zoneLabels(cat(Cv.language), cw, ch, MIN, 200); });
    push(() => { Z.religion = zoneLabels(cat(Cv.religion), cw, ch, MIN, 160); });
    push(() => { if (G.AdminSys) { const ord = G.AdminSys.ORDER, sysOf = Cv.countries.map(k => ord.indexOf(k.sys || G.AdminSys.classOfCountry(k))), o = new Int16Array(N);
      for (let i = 0; i < N; i++) { const k = Cv.country[i]; o[i] = k >= 0 ? sysOf[k] : -1; } Z.system = zoneLabels(o, cw, ch, MIN, 200); } });
    push(() => { const o = new Int16Array(N); for (let i = 0; i < N; i++) { const k = Cv.country[i]; o[i] = k < 0 ? -1 : Cv.gov[i] >= 171 ? 0 : Cv.gov[i] >= 87 ? 1 : 2; } Z.govern = zoneLabels(o, cw, ch, MIN * 2, 160); });
    push(() => { Z.pop = zoneLabels(binned(Cv.popDensity, [1, 10, 50, 200], dry), cw, ch, MIN * 2, 160); });
    push(() => { Z.agri = zoneLabels(binned(Cv.agri, [0.2, 0.45, 0.7], dry), cw, ch, MIN * 2, 160); });
    push(() => { Z.habit = zoneLabels(binned(Cv.hab, [0.2, 0.45, 0.7], dry), cw, ch, MIN * 2, 160); });
    push(() => { const v = new Float32Array(N); for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) v[y * cw + x] = Cl.veg[(2 * y) * FW + 2 * x] / 255; Z.veg = zoneLabels(binned(v, [0.25, 0.5, 0.75], dry), cw, ch, MIN * 2, 160); });
    push(() => { Z.koppen = zoneLabels(full(Cl.koppen, 255), cw, ch, MIN, 200); });
    push(() => { Z.biome = zoneLabels(full(Cl.biome, 255), cw, ch, MIN, 200); });
    push(() => { // 流域：以流经该流域最长的已命名干流命名
      const bas = full(Hy.basinId, 0), named = new Map(), RV = Hy.rivers;
      (riverNames || []).forEach((rn, ri) => { const st = RV.stems && rn.stem !== undefined ? RV.stems[rn.stem] : null; if (!st) return; const r = st.r[0], k = Math.max(RV.offs[r], RV.offs[r + 1] - 3);
        const x = RV.pts[k * 7], y = RV.pts[k * 7 + 1], id = Hy.basinId[Math.min(P.H - 1, y | 0) * FW + ((x | 0) % FW + FW) % FW]; if (id && !named.has(id)) named.set(id, ri); });
      for (let i = 0; i < N; i++) if (bas[i] >= 0 && !named.has(bas[i])) bas[i] = -1;
      Z.basin = zoneLabels(bas, cw, ch, MIN, 160).map(z => Object.assign(z, { ri: named.get(z.c) })); });
  }
  function generate(cfg, post) {
    const t0 = Date.now();
    STRIP_JOBS.clear(); // 新世界作废所有在途条带
    const progress = (stage, f) => post({ type: 'progress', stage, f });
    const P = G.Planet.build(cfg, progress);
    const K = G.Climate.simulate(P, cfg, progress);
    const Cl = G.Climate.derive(P, K, cfg, progress);
    const Hy = G.Hydro.simulate(P, Cl, cfg, progress);
    const Cv = G.Society.run(P, Cl, Hy, cfg, progress);
    // 历史与现在互为因果：从文明之初自由推演到现在，终局写回现在的地图（国家、省份、文化、宗教、国界省界）
    let Hc = null;
    try { Hc = G.History.core({ P, Hy, Cl, Cv, cfg }, progress); G.HistoryApply.apply({ P, Hy, Cl, Cv, cfg }, Hc); }
    catch (err) { console.warn('历史推演失败，退回原有国界', err); Hc = null; }
    if (!Hc) { progress('疆界兜底', 0.975);
      const BF = G.Borders.run(P, Hy, Cv, cfg.seed, Cv.cities, Cl); Cv.countryF = BF.countryF; Cv.provinceF = BF.provinceF;
      Cv.provinces.forEach((p, k) => { const a = BF.provAnchor[k]; if (a) { p.lx = a.x; p.ly = a.y; p.lsize = a.size; } }); }
    Cl.Ts = null; Cl.Ps = null; // 释放全分辨率四季场
    world = { P, K, Cl, Hy, Cv, cfg, Hc }; navGraph = null; roadNet = null;
    STRIP_JOBS.clear(); OVERLAY_TASKS.length = 0; OVERLAY_DATA = null; overlayPost = null; // 新世界作废所有在途任务
    R = G.Render.create(world);
    // 23 层等高线（原版 hypsometry：24 档、档界按平方递增，低地加密）+ 海深线的档位
    const landLevels = []; for (let k = 1; k <= 23; k++) landLevels.push(Math.max(5, Math.round(P.maxE * (k / 24) * (k / 24))));
    const koppenUsed = new Set(), biomeUsed = new Set();
    for (let i = 0; i < Cl.koppen.length; i += 7) { if (Cl.koppen[i] !== 255) koppenUsed.add(Cl.koppen[i]); if (Cl.biome[i] !== 255) biomeUsed.add(Cl.biome[i]); }
    const pal = {}; for (const k in R.pal) pal[k] = Array.from(R.pal[k]);
    // 板块边界：格边连成折线并平滑（buildPaths 无守卫，随 ready 一起发）
    const plateLines = P.bSegs.map(a => {
      const key = (x, y) => Math.round(x * 4) * 100000 + Math.round(y * 4);
      const adj = new Map(), segs = [];
      for (let k = 0; k < a.length; k += 4) { const s = segs.length; segs.push([a[k], a[k + 1], a[k + 2], a[k + 3]]); for (const kk of [key(a[k], a[k + 1]), key(a[k + 2], a[k + 3])]) { if (!adj.has(kk)) adj.set(kk, []); adj.get(kk).push(s); } }
      const used = new Uint8Array(segs.length), out = [];
      for (let s0 = 0; s0 < segs.length; s0++) {
        if (used[s0]) continue; used[s0] = 1;
        const walk = (x, y) => { const pts = []; for (;;) { const l = adj.get(key(x, y)); let nx = -1; for (const s of l) if (!used[s]) { nx = s; break; } if (nx < 0) break; used[nx] = 1; const g = segs[nx]; if (key(g[0], g[1]) === key(x, y)) { x = g[2]; y = g[3]; } else { x = g[0]; y = g[1]; } pts.push([x, y]); } return pts; };
        const g = segs[s0];
        let pts = walk(g[0], g[1]).reverse().concat([[g[0], g[1]], [g[2], g[3]]], walk(g[2], g[3]));
        if (pts.length > 6) pts = pts.filter((p, k) => k % 3 === 0 || k === pts.length - 1);
        for (let it = 0; it < 3; it++) { const np = [pts[0]]; for (let k = 0; k < pts.length - 1; k++) { const p = pts[k], q = pts[k + 1]; np.push([p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]); } np.push(pts[pts.length - 1]); pts = np; }
        out.push(Float32Array.from(pts.flat()));
      }
      return out;
    });
    const info = {
      ms: Date.now() - t0, maxE: P.maxE, minE: P.minE, polar: P.polar, newWorld: P.newWorld,
      hE: K.hE, fE: K.fE, plates: P.plates.length
    };
    // 地图先就绪：栅格瓦片不依赖覆盖层，越早发 ready 越早开始渲染
    post({
      type: 'ready', W: P.W, H: P.H, info, stats: Cv.stats, pal,
      rivers: Hy.rivers, qth: Hy.qth, contourLevels: landLevels,
      plateSegs: plateLines, plateMarks: P.bMarks, plates: Cv.plates,
      cities: Cv.cities, countries: Cv.countries, provinces: Cv.provinces, cultures: Cv.cultures, languages: Cv.languages, religions: Cv.religions, heritage: Cv.heritage || [],
      tribes: Cv.tribes, jimis: Cv.jimis, riverNames: Cv.riverNames, bridges: Cv.bridges,
      smallLakes: Hy.smallLakes,
      deltas: Hy.deltas.map(dl => ({ x: dl.x, y: dl.y, size: dl.size, q: dl.q })),
      labels: Cv.labels, symbols: Cv.symbols, roads: Cv.roads,
      travel: travelProfile(Cv.era, cfg),
      koppenUsed: [...koppenUsed].sort((a, b) => a - b), biomeUsed: [...biomeUsed].sort((a, b) => a - b),
      decl: K.decl
    });
    // —— 覆盖层后台补算：等高线、气象场、国界省界、专题注记，分块推进 ——
    const D = OVERLAY_DATA = {};
    overlayPost = post;
    // 等高线（半分辨率，逐两层分块；湖面取湖水位，湖内不画等高线）
    const eC = Float32Array.from(P.elev); for (let i = 0; i < eC.length; i++) if (Hy.lake[i]) eC[i] = Math.max(1, Hy.filled[i]);
    const eH = P.downsample(eC, P.W, P.H, P.W / 2, P.H / 2);
    const allLv = [-5000, -3000, -1000, -200].concat(landLevels);
    D.contours = [];
    for (let i = 0; i < allLv.length; i += 2) {
      const lv = allLv.slice(i, i + 2);
      OVERLAY_TASKS.push(() => {
        const cs = contours(eH, P.W / 2, P.H / 2, lv, 2).map(c => ({ level: c.level, pts: c.pts, k: landLevels.indexOf(c.level) + 1 }));
        D.contours.push(...clipCoast(cs, P.elev, P.W, P.H, 0.3)); // 全图级只用半分辨率线，粗步长足够
      });
    }
    // 风场 / 洋流（一项）与等压线（逐季）
    const cW = P.cW, cH = P.cH, f = P.W / cW;
    OVERLAY_TASKS.push(() => {
      const winds = K.U.map((U, s) => { const a = []; for (let y = 3; y < cH; y += 7) for (let x = 3; x < cW; x += 7) { const i = y * cW + x; a.push((x + 0.5) * f, (y + 0.5) * f, U[i], K.V[s][i]); } return Float32Array.from(a); });
      const cur = []; for (let y = 4; y < cH; y += 8) for (let x = 4; x < cW; x += 8) { const i = y * cW + x; if (K.isLand[i]) continue; const u = K.curU[i], v = K.curV[i]; if (Math.hypot(u, v) < 0.15) continue; cur.push((x + 0.5) * f, (y + 0.5) * f, u, v, K.anomaly[i]); }
      D.winds = winds; D.currents = Float32Array.from(cur);
    });
    D.isobars = [];
    K.Pr.forEach((Pp, si) => {
      OVERLAY_TASKS.push(() => {
        const sm = G.Climate.blur(Pp, cW, cH, 3, 2);
        const lv = []; for (let p = 984; p <= 1036; p += 4) lv.push(p);
        const lines = contours(sm, cW, cH, lv, f).map(c => ({ level: c.level, pts: c.pts }));
        const ext = [];
        for (let y = 10; y < cH - 10; y += 3) for (let x = 0; x < cW; x += 3) {
          const v = sm[y * cW + x]; let mx = true, mn = true;
          for (let dy = -12; dy <= 12 && (mx || mn); dy += 3) for (let dx = -12; dx <= 12; dx += 3) { if (!dx && !dy) continue; const yy = y + dy; if (yy < 0 || yy >= cH) continue; const w = sm[yy * cW + (x + dx + cW) % cW]; if (w >= v) mx = false; if (w <= v) mn = false; }
          if (mx && v > 1016) ext.push((x + 0.5) * f, (y + 0.5) * f, 1, v); if (mn && v < 1006) ext.push((x + 0.5) * f, (y + 0.5) * f, -1, v);
        }
        D.isobars[si] = { lines, ext: Float32Array.from(ext) };
      });
    });
    // 国界与省界（逐类）
    const cw = Cv.W, chh = Cv.H, st = Cv.country, pv = Cv.province, nm = Cv.nominal;
    const cF = Cv.countryF, pF = Cv.provinceF, FW2 = P.W, iceAt = f => { const y = (f / FW2) | 0, x = f - y * FW2; return Cv.ice[(y >> 1) * cw + (x >> 1)]; };
    D.borders = {};
    // 国界、边疆线、省界：取自政区填色同一组界线曲线（edges.js，与历史时间线同一套算法），线与填色严丝合缝
    OVERLAY_TASKS.push(() => { const POL = R.political && R.political();
      if (!POL) { D.borders.country = boundaryLines(cF, P.W, P.H, (a, b) => a !== b && a >= 0 && b >= 0, 1, true);
        D.borders.frontier = boundaryLines(cF, P.W, P.H, (a, b, i, j) => a !== b && (a >= 0) !== (b >= 0) && a > -2 && b > -2 && !iceAt(i) && !iceAt(j), 1, true);
        D.borders.province = boundaryLines(pF, P.W, P.H, (a, b, i, j) => a !== b && a >= 0 && b >= 0 && cF[i] === cF[j], 1, true); return; }
      const C = POL.C, cOf = m => m >= 0 ? POL.topicOf(m) : -1, country = [], frontier = [], province = [];
      for (let k = 0; k < C.A.length; k++) { const a = C.A[k], b = C.B[k], ca = cOf(a), cb = cOf(b), o0 = C.off[k], o1 = C.off[k + 1];
        if (ca >= 0 && cb >= 0) { if (ca !== cb) country.push(C.pts.slice(o0, o1)); else if (a < 2000000 && b < 2000000) province.push(C.pts.slice(o0, o1)); continue; }
        if ((ca >= 0) === (cb >= 0) || a === -4 || b === -4) continue;
        const m = o0 + (((o1 - o0) >> 2) << 1), x = Math.floor(C.pts[m]), y = Math.min(P.H - 1, Math.max(0, Math.floor(C.pts[m + 1])));
        if (!iceAt(y * FW2 + ((x % FW2) + FW2) % FW2)) frontier.push(C.pts.slice(o0, o1)); }
      Object.assign(D.borders, { country, frontier, province }); });
    OVERLAY_TASKS.push(() => { D.borders.claim = boundaryLines(nm, cw, chh, (a, b, i, j) => a !== b && Cv.land[i] && Cv.land[j] && (st[i] < 0 || st[j] < 0) && (a >= 0 || b >= 0), 2); });
    // 专题注记（逐类）
    const Z = D.zones = {};
    topicZones(P, Cl, Hy, Cv, Cv.riverNames, Z, fn => OVERLAY_TASKS.push(fn));
    scheduleOverlays();
    // 全精度 23 层等高线已改由栅格按设色地表逐像素描出（render.js），不再补算矢量线
    setTimeout(() => G.Noise.coastElev(1, 50, P.elev, P.W, P.H, 1, P.H / 2), 0); // 预热海岸距离场
  }


  // ---------- 球体自然地表：反照率 / 液态水遮罩 / 地形法线（供用户版球体着色器） ----------
  function globeAssets(w, h) {
    const { P, Cl, Hy } = world, W = P.W, H = P.H, N = W * H, e = P.elev;
    const albedo = new Uint8ClampedArray(w * h * 4), water = new Uint8ClampedArray(w * h * 4), relief = new Uint8ClampedArray(w * h * 4);
    const BIO = [[236, 240, 243], [138, 136, 112], [58, 86, 56], [146, 152, 92], [78, 118, 60], [44, 92, 52], [134, 132, 84], [184, 162, 122], [210, 180, 132], [162, 152, 92], [92, 124, 54], [40, 88, 40], [142, 130, 118]];
    const SNOW = [0, 0.45, 1, 0.3, 1];
    // 1) 每格地表色（含高山裸岩、积雪），只在陆地上做加权模糊：群系来自较粗的气候网格，直接取格会出现方块
    let C = new Float32Array(N * 3), Wt = new Float32Array(N);
    for (let i = 0; i < N; i++) { if (e[i] <= 0 || Hy.lake[i]) continue; const bi = Cl.biome[i] === 255 ? 3 : Cl.biome[i], c = BIO[bi]; let r = c[0], g = c[1], b = c[2];
      if (e[i] > 2200 && bi !== 0) { const t = Math.min(1, (e[i] - 2200) / 2600) * 0.6; r += (128 - r) * t; g += (120 - g) * t; b += (112 - b) * t; }
      C[i * 3] = r; C[i * 3 + 1] = g; C[i * 3 + 2] = b; Wt[i] = 1; }
    const blur = (S, ch, R) => { const O = new Float32Array(S.length), T = new Float32Array(S.length);
      for (let y = 0; y < H; y++) for (let c = 0; c < ch; c++) { let acc = 0; for (let k = -R; k <= R; k++) acc += S[(y * W + ((k % W) + W) % W) * ch + c]; for (let x = 0; x < W; x++) { T[(y * W + x) * ch + c] = acc; acc += S[(y * W + (x + R + 1) % W) * ch + c] - S[(y * W + ((x - R) % W + W) % W) * ch + c]; } }
      for (let x = 0; x < W; x++) for (let c = 0; c < ch; c++) { let acc = 0; for (let k = -R; k <= R; k++) acc += T[(Math.min(H - 1, Math.max(0, k)) * W + x) * ch + c]; for (let y = 0; y < H; y++) { O[(y * W + x) * ch + c] = acc; acc += T[(Math.min(H - 1, y + R + 1) * W + x) * ch + c] - T[(Math.max(0, y - R) * W + x) * ch + c]; } }
      return O; };
    const RB = Math.max(2, Math.round(W / 700));
    for (let it = 0; it < 2; it++) { C = blur(C, 3, RB); Wt = blur(Wt, 1, RB); }
    const snowF = new Float32Array(N); for (let i = 0; i < N; i++) snowF[i] = SNOW[Cl.snow[i]] || 0;
    const snowB = blur(blur(snowF, 1, 2), 1, 2); const kS = 1 / 25 / 25;
    const depthB = blur(blur(Float32Array.from(e, v => Math.min(0, v)), 1, 3), 1, 3); const kD = 1 / 49 / 49;
    const lakeF = blur(Float32Array.from(Hy.lake), 1, 1).map(v => v / 9);
    const bil = (A, x, y, ch = 1, c = 0) => { let sx = x - 0.5, sy = Math.min(H - 1.001, Math.max(0, y - 0.5)); sx = ((sx % W) + W) % W; const x0 = sx | 0, tx = sx - x0, x1 = x0 + 1 === W ? 0 : x0 + 1, y0 = sy | 0, ty = sy - y0, y1 = Math.min(H - 1, y0 + 1);
      return (A[(y0 * W + x0) * ch + c] * (1 - tx) + A[(y0 * W + x1) * ch + c] * tx) * (1 - ty) + (A[(y1 * W + x0) * ch + c] * (1 - tx) + A[(y1 * W + x1) * ch + c] * tx) * ty; };
    const n2 = G.Noise.simplex2(world.cfg.seed + 5150), R = world.cfg.radius * 1000, dyM = Math.PI * R / H;
    const sx = W / w, sy = H / h;
    for (let py = 0; py < h; py++) {
      const gy = (py + 0.5) * sy, lat = (90 - gy / H * 180) * Math.PI / 180, dxM = Math.max(0.05, Math.cos(lat)) * 2 * Math.PI * R / W;
      for (let px = 0; px < w; px++) {
        const gx = (px + 0.5) * sx, o = (py * w + px) * 4;
        // 轻微的域扭曲让群系过渡呈有机形状
        const wx = gx + n2(gx * 0.11, gy * 0.11) * 0.9, wy = gy + n2(gy * 0.11 + 40, gx * 0.11) * 0.9;
        const h0 = bil(e, gx, gy), lk = bil(lakeF, gx, gy) >= 0.5, isWater = h0 <= 0 || lk;
        const sn = bil(snowB, gx, gy) * kS;
        let r, g, b;
        if (isWater) {
          const d = lk ? 900 : Math.max(-h0 * 0.35, -bil(depthB, gx, gy) * kD), t = Math.min(1, d / 4500); // 湖泊与外海同一水色（按深水处理）
          r = 46 - 34 * t; g = 112 - 70 * t; b = 142 - 62 * t;
          if (d < 160) { const s = 1 - d / 160; r += 18 * s; g += 34 * s; b += 22 * s; }
          if (sn > 0.55) { const a = Math.min(1, (sn - 0.55) / 0.3); r += (226 - r) * a; g += (233 - g) * a; b += (240 - b) * a; }
        } else {
          const wt = Math.max(1e-6, bil(Wt, wx, wy));
          // 多尺度颗粒：大片植被疏密 + 中尺度斑块 + 细颗粒，避免“平涂色块”
          const nz = n2(gx * 0.35, gy * 0.35) * 0.07 + n2(gx * 1.6, gy * 1.6) * 0.05 + n2(gx * 5.3, gy * 5.3) * 0.035 + n2(gx * 13, gy * 13) * 0.02;
          r = bil(C, wx, wy, 3, 0) / wt * (1 + nz); g = bil(C, wx, wy, 3, 1) / wt * (1 + nz * 1.1); b = bil(C, wx, wy, 3, 2) / wt * (1 + nz);
          // 坡度裸岩与高海拔碎石：陡坡露出岩石色，高山更灰
          const sl = Math.hypot((bil(e, gx + 0.5, gy) - bil(e, gx - 0.5, gy)) / dxM, (bil(e, gx, gy - 0.5) - bil(e, gx, gy + 0.5)) / dyM);
          const rock = Math.min(0.75, Math.max(0, (sl - 0.012) * 18) + Math.max(0, (h0 - 2600) / 3000));
          if (rock > 0) { const rr2 = 122 + 18 * n2(gx * 4, gy * 4); r += (rr2 - r) * rock; g += (rr2 - 8 - g) * rock; b += (rr2 - 16 - b) * rock; }
          if (sn > 0.05) { const a = Math.min(0.95, sn * 1.05); r += (240 - r) * a; g += (243 - g) * a; b += (246 - b) * a; }
        }
        albedo[o] = r; albedo[o + 1] = g; albedo[o + 2] = b; albedo[o + 3] = 255;
        const wv = isWater && sn < 0.85 ? 255 : 0; water[o] = water[o + 1] = water[o + 2] = wv; water[o + 3] = 255;
        if (isWater) { relief[o] = 128; relief[o + 1] = 128; relief[o + 2] = 255; relief[o + 3] = 255; continue; }
        const ex = (Math.max(0, bil(e, gx + 0.6, gy)) - Math.max(0, bil(e, gx - 0.6, gy))) / (1.2 * dxM), ey = (Math.max(0, bil(e, gx, gy - 0.6)) - Math.max(0, bil(e, gx, gy + 0.6))) / (1.2 * dyM);
        let tx = -ex * 12, ty = -ey * 12, tz = 1; const l = Math.hypot(tx, ty, tz); tx /= l; ty /= l; tz /= l;
        relief[o] = Math.round(tx * 127 + 128); relief[o + 1] = Math.round(ty * 127 + 128); relief[o + 2] = Math.round(tz * 127 + 128); relief[o + 3] = 255;
      }
    }
    return { albedo, water, relief };
  }

  function probe(gx, gy, season) {
    const { P, Cl, Hy, Cv, K } = world;
    const W = P.W, H = P.H;
    gx = ((gx % W) + W) % W; if (gy < 0 || gy >= H) return null;
    const fi = (gy | 0) * W + (gx | 0);
    const vi = Math.min(Cv.H - 1, (gy / 2) | 0) * Cv.W + Math.min(Cv.W - 1, (gx / 2) | 0);
    const ci = Math.min(P.cH - 1, (gy / H * P.cH) | 0) * P.cW + Math.min(P.cW - 1, (gx / W * P.cW) | 0);
    const e = P.elev[fi], land = e > 0;
    const k = Cv.countryF ? Cv.countryF[fi] : Cv.country[vi], pr = Cv.provinceF ? Cv.provinceF[fi] : Cv.province[vi];
    return {
      lat: 90 - gy / H * 180, lon: gx / W * 360 - 180, elev: Math.round(e), land, lake: !!Hy.lake[fi],
      tann: Cl.Tann[fi], pann: Cl.Pann[fi], koppen: Cl.koppen[fi], biome: Cl.biome[fi],
      ts: K.T0[season][ci] - (land ? 0.0065 * e : 0), ps: K.Ps[season][ci], pres: K.Pr[season][ci],
      wind: [K.U[season][ci], K.V[season][ci]],
      plate: P.plate[ci], basin: Hy.basinId[fi], flow: land ? Hy.q[fi] : 0,
      country: k, province: pr, culture: Cv.culture[vi], language: Cv.language[vi], religion: Cv.religion[vi], nominal: Cv.nominal[vi],
      gov: Cv.gov[vi] / 255, govDays: Cv.govDays[vi], tribe: Cv.tribe[vi], jimi: Cv.jimi ? Cv.jimi[vi] : -1, pop: Cv.popDensity[vi], agri: Cv.agri[vi], hab: Cv.hab[vi], snow: Cl.snow[fi], frost: Cl.frost[fi]
    };
  }


  // ---------- 出行方式（原版 navigation.travel_profile） ----------
  function travelProfile(era, cfg) {
    const ship = era === 'industrial' ? ['动力船', 18, 20] : ['帆船', 8, 16];
    const modes = [{ id: 'walk', label: '步行', speed: 5, daily: 8, grade: 0.45 }, { id: 'horse', label: '骑马', speed: 7, daily: 8, grade: 0.25 }, { id: 'carriage', label: '马车', speed: 6, daily: 8, grade: 0.1 }];
    if (era === 'industrial') modes.push({ id: 'train', label: '步行＋火车', speed: 40, daily: 18, grade: 0.45, rail: true });
    modes.forEach(m => { m.ship = ship[1]; m.shipDaily = ship[2]; m.shipName = ship[0]; });
    return { era, modes, dayHours: cfg.day, note: `地面交通每日行进 8 小时；马车避开超过 10% 的坡度。船程按${ship[0]}平均 ${ship[1]} km/h、每日最多航行 ${ship[2]} 小时估算，在真实港口换乘。` + (era === 'industrial' ? '火车沿干线与区域铁路，平均 40 km/h、每日运营 18 小时。' : '') };
  }
  let navGraph = null;
  function navigation(a, b, modeId) {
    const { Cv } = world, W = Cv.W, H = Cv.H;
    const prof = travelProfile(Cv.era, world.cfg), mode = prof.modes.find(m => m.id === modeId) || prof.modes[0];
    if (!navGraph) {
      const nodes = new Map(), adj = [];
      const nid = c => { let k = nodes.get(c); if (k === undefined) { k = adj.length; nodes.set(c, k); adj.push([]); } return k; };
      Cv.routes.forEach((r, idx) => { const u = nid(r.a), v = nid(r.b); adj[u].push({ to: v, r, rev: false }); adj[v].push({ to: u, r, rev: true }); });
      navGraph = { nodes, adj, cells: [...nodes.keys()] };
    }
    const cellOf = p => Math.min(H - 1, Math.max(0, (p[1] / 2) | 0)) * W + ((((p[0] / 2) | 0) % W) + W) % W;
    const kmCell = (c1, c2) => { const y1 = (c1 / W) | 0, y2 = (c2 / W) | 0; let dx = Math.abs(c1 - y1 * W - (c2 - y2 * W)); dx = Math.min(dx, W - dx); return Math.hypot(dx * Math.cos((90 - (y1 + 0.5) / H * 180) * Math.PI / 180), y1 - y2) * Cv.cellKm; };
    const snap = (p) => { const c = cellOf(p); let best = -1, bd = Infinity; for (const cell of navGraph.cells) { const d = kmCell(c, cell); if (d < bd) { bd = d; best = cell; } } return { node: navGraph.nodes.get(best), cell: best, from: c, km: bd }; };
    const A = snap(a), B = snap(b);
    if (A.node === undefined || B.node === undefined) return null;
    const isRail = r => Cv.era === 'industrial' && r.mode === 'road' && r.imp !== 'local';
    const hours = (r) => {
      if (r.mode === 'sea') return { h: r.km / mode.ship, d: r.km / mode.ship / mode.shipDaily };
      if (mode.rail && isRail(r)) return { h: r.km / mode.speed + 1.1, d: (r.km / mode.speed + 1.1) / mode.daily };
      if (r.grade > mode.grade * 0.25 && mode.id === 'carriage') return null;
      const climbH = mode.id === 'walk' ? r.climb / 600 : r.climb / 900;
      const h = r.km / (mode.rail ? 5 : mode.speed) + climbH; return { h, d: h / (mode.rail ? 8 : mode.daily) };
    };
    const n = navGraph.adj.length, cost = new Float64Array(n).fill(Infinity), prev = new Array(n);
    const hp = new G.Hydro.Heap(n * 4); cost[A.node] = 0; hp.push(A.node, 0);
    while (hp.n) { const u = hp.pop(); if (u === B.node) break;
      for (const e of navGraph.adj[u]) { const t = hours(e.r); if (!t) continue; const nc = cost[u] + t.d; if (nc < cost[e.to]) { cost[e.to] = nc; prev[e.to] = { from: u, e, t }; hp.push(e.to, nc); } } }
    if (!isFinite(cost[B.node])) return null;
    const legs = []; let u = B.node; while (u !== A.node) { const p = prev[u]; legs.push(p); u = p.from; } legs.reverse();
    const pts = []; let km = 0, seaKm = 0, railKm = 0;
    const push = c => { const y = (c / W) | 0, x = c - y * W; pts.push((x + 0.5) * 2, (y + 0.5) * 2); };
    push(A.from);
    for (const L of legs) { const cells = L.e.rev ? L.e.r.cells.slice().reverse() : L.e.r.cells; cells.forEach(push); km += L.e.r.km; if (L.e.r.mode === 'sea') seaKm += L.e.r.km; else if (mode.rail && isRail(L.e.r)) railKm += L.e.r.km; }
    push(B.from);
    const walkKm = A.km + B.km, days = cost[B.node] + walkKm / mode.speed / mode.daily;
    return { pts: Float32Array.from(pts), km: Math.round(km + walkKm), seaKm: Math.round(seaKm), railKm: Math.round(railKm), days: Math.max(0.1, days), mode: mode.label, shipName: mode.shipName, legs: legs.length };
  }

  // ---------- 道路网导航：沿实际绘制的道路 / 航线折线寻路，支持途经点 ----------
  let roadNet = null;
  function buildRoadNet() {
    const { P, Cv } = world, W = P.W, H = P.H, R = world.cfg.radius, e = P.elev;
    const kmPer = 2 * Math.PI * R / W, nodes = new Map(), nx = [], ny = [], adj = [];
    const key = (x, y) => Math.round(((x % W) + W) % W * 20) + ',' + Math.round(y * 20);
    const node = (x, y) => { const k = key(x, y); let id = nodes.get(k); if (id === undefined) { id = nx.length; nodes.set(k, id); nx.push(((x % W) + W) % W); ny.push(y); adj.push([]); } return id; };
    const segKm = (x0, y0, x1, y1) => { let dx = Math.abs(x1 - x0); dx = Math.min(dx, W - dx); return Math.hypot(dx * Math.cos((90 - (y0 + y1) / 2 / H * 180) * Math.PI / 180), y1 - y0) * kmPer; };
    const elevAt = (x, y) => e[Math.min(H - 1, Math.max(0, Math.floor(y))) * W + ((Math.floor(x) % W) + W) % W];
    const addLine = (pts, cls) => {
      if (pts.length < 4) return; let km = 0, climb = 0, descent = 0;
      for (let i = 2; i < pts.length; i += 2) { km += segKm(pts[i - 2], pts[i - 1], pts[i], pts[i + 1]); if (cls !== 'sea') { const d = Math.max(0, elevAt(pts[i], pts[i + 1])) - Math.max(0, elevAt(pts[i - 2], pts[i - 1])); if (d > 0) climb += d; else descent -= d; } }
      const a = node(pts[0], pts[1]), b = node(pts[pts.length - 2], pts[pts.length - 1]); if (a === b) return;
      const ed = { a, b, pts, cls, km, climb, descent }; adj[a].push(ed); adj[b].push(ed);
    };
    for (const cls of ['trunk', 'regional', 'local', 'sea', 'rail']) for (const l of (Cv.roads[cls] || [])) addLine(l, cls);
    // 城市作为站点：吸附到最近的路网端点（解决细化路线端点的微小错位）
    const cityNode = Cv.cities.map(c => { let best = -1, bd = 0.9; for (let i = 0; i < nx.length; i++) { const d = segKm(nx[i], ny[i], c.x, c.y) / kmPer; if (d < bd) { bd = d; best = i; } } return best; });
    // 端点之间 1 格内的小缺口以步道相连
    const grid = new Map(); nx.forEach((x, i) => { const g = Math.floor(x) + ',' + Math.floor(ny[i]); (grid.get(g) || grid.set(g, []).get(g)).push(i); });
    for (let i = 0; i < nx.length; i++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (const j of grid.get((((Math.floor(nx[i]) + dx) % W + W) % W) + ',' + (Math.floor(ny[i]) + dy)) || []) {
      if (j <= i) continue; const km = segKm(nx[i], ny[i], nx[j], ny[j]); if (km > kmPer * 1.1 || adj[i].some(ed => ed.a === j || ed.b === j)) continue;
      const ed = { a: i, b: j, pts: Float32Array.from([nx[i], ny[i], nx[j], ny[j]]), cls: 'path', km, climb: 0, descent: 0 }; adj[i].push(ed); adj[j].push(ed); }
    roadNet = { nx, ny, adj, cityNode, segKm, kmPer };
  }
  function roadRoute(points, modeId) {
    if (!roadNet) buildRoadNet();
    const { Cv } = world, net = roadNet, prof = travelProfile(Cv.era, world.cfg), mode = prof.modes.find(m => m.id === modeId) || prof.modes[0];
    const CLS = { trunk: 1, regional: 0.92, local: 0.8, path: 0.65 };
    const cost = (ed) => { // 小时
      if (ed.cls === 'sea') return { h: ed.km / mode.ship + 2, day: mode.shipDaily };
      if (ed.cls === 'rail') return mode.rail ? { h: ed.km / mode.speed + 0.5, day: mode.daily } : { h: Infinity };
      const grade = ed.climb / Math.max(1, ed.km * 1000); if (mode.id === 'carriage' && grade > 0.1) return { h: Infinity };
      const sp = (mode.rail ? 5 : mode.speed) * CLS[ed.cls]; return { h: ed.km / sp + ed.climb / (mode.id === 'walk' ? 500 : 800), day: mode.rail ? 8 : mode.daily };
    };
    const snap = (p) => { if (p.city !== undefined && net.cityNode[p.city] >= 0) return { node: net.cityNode[p.city], km: 0 };
      let best = -1, bd = Infinity; for (let i = 0; i < net.nx.length; i++) { const d = net.segKm(net.nx[i], net.ny[i], p.x, p.y); if (d < bd) { bd = d; best = i; } } return { node: best, km: bd }; };
    const legs = [], allPts = []; let km = 0, seaKm = 0, railKm = 0, days = 0; const passed = [];
    const nodeCity = new Map(); net.cityNode.forEach((n, ci) => { if (n >= 0 && !nodeCity.has(n)) nodeCity.set(n, ci); });
    for (let L = 0; L < points.length - 1; L++) {
      const A = snap(points[L]), B = snap(points[L + 1]); if (A.node < 0 || B.node < 0) return null;
      const n = net.nx.length, dist = new Float64Array(n).fill(Infinity), prev = new Array(n), hp = new G.Hydro.Heap(1024);
      dist[A.node] = 0; hp.push(A.node, 0);
      while (hp.n) { const u = hp.pop(); if (u === B.node) break; for (const ed of net.adj[u]) { const v = ed.a === u ? ed.b : ed.a, c = cost(ed); if (!isFinite(c.h)) continue; const nd = dist[u] + c.h / c.day; if (nd < dist[v]) { dist[v] = nd; prev[v] = { u, ed }; hp.push(v, nd); } } }
      if (!isFinite(dist[B.node])) return { fail: true, leg: L };
      const seq = []; let v = B.node; while (v !== A.node) { const p = prev[v]; seq.push(p); v = p.u; } seq.reverse();
      const walk = (A.km + B.km) / mode.speed / mode.daily; let legKm = A.km + B.km;
      allPts.push(points[L].x, points[L].y);
      for (const st of seq) { const ed = st.ed, fwd = ed.a === st.u, p = ed.pts; if (fwd) for (let i = 0; i < p.length; i += 2) allPts.push(p[i], p[i + 1]); else for (let i = p.length - 2; i >= 0; i -= 2) allPts.push(p[i], p[i + 1]);
        legKm += ed.km; if (ed.cls === 'sea') seaKm += ed.km; if (ed.cls === 'rail') railKm += ed.km;
        const to = fwd ? ed.b : ed.a; if (nodeCity.has(to)) passed.push({ city: nodeCity.get(to), cls: ed.cls, leg: L }); }
      allPts.push(points[L + 1].x, points[L + 1].y);
      const legDays = dist[B.node] + walk; km += legKm; days += legDays; legs.push({ km: Math.round(legKm), days: legDays });
    }
    return { pts: Float32Array.from(allPts), km: Math.round(km), seaKm: Math.round(seaKm), railKm: Math.round(railKm), days: Math.max(0.05, days), mode: mode.label, shipName: mode.shipName, legs, passed };
  }

  // ---------- 城市面板：城市尺度的地形底图 + 城市生成器 + 周边要素 ----------
  const urbanCache = new Map();
  function cityMap(idx, px, extent) {
    const { P, Hy, Cv } = world, W = P.W, H = P.H, c = Cv.cities[idx];
    let U = urbanCache.get(idx); if (!U) { U = G.Urban.build(world, idx, { detail: true }); urbanCache.set(idx, U); if (urbanCache.size > 24) urbanCache.delete(urbanCache.keys().next().value); }
    const halfKm = extent === 'region' ? M2(U.rKm * 7, 30) : M2(U.rKm * 2.7, 4), hx = halfKm / U.kx, hy = halfKm / U.ky;
    const s = 2 * hx / px, w = px, h = Math.round(2 * hy / s), x0 = c.x - hx, y0 = c.y - hy;
    const img = R.render({ w, h, pad: 1, x0, y0, s, topic: 'terrain', season: 0, aux: { elev: true, depth: true, lakes: true, snow: true, coast: true, landform: false, relief: 9, detail: 4 } });
    const inWin = (x, y, m) => { const xx = x + Math.round((c.x - x) / W) * W; return xx > x0 - m && xx < x0 + 2 * hx + m && y > y0 - m && y < y0 + 2 * hy + m; };
    const clipLines = (lines, m) => { const out = []; for (const l of lines) { let hit = false; for (let i = 0; i < l.length; i += 2) if (inWin(l[i], l[i + 1], m)) { hit = true; break; } if (hit) { const a = Float32Array.from(l); for (let i = 0; i < a.length; i += 2) a[i] += Math.round((c.x - a[i]) / W) * W; out.push(a); } } return out; };
    const roads = {}; for (const k of ['trunk', 'regional', 'local', 'rail', 'sea']) roads[k] = clipLines(Cv.roads[k] || [], hx);
    const rivers = []; { const r = Hy.rivers; for (let k = 0; k < r.offs.length - 1; k++) { let hit = false; for (let v = r.offs[k]; v < r.offs[k + 1]; v++) if (inWin(r.pts[v * 7], r.pts[v * 7 + 1], 0.5)) { hit = true; break; } if (!hit) continue;
      const a = []; for (let v = r.offs[k]; v < r.offs[k + 1]; v++) { const x = r.pts[v * 7]; a.push(x + Math.round((c.x - x) / W) * W, r.pts[v * 7 + 1], r.pts[v * 7 + 2] / Hy.qth); } rivers.push(Float32Array.from(a)); } }
    const towns = []; Cv.cities.forEach((o, i) => { if (i !== idx && inWin(o.x, o.y, 0)) towns.push({ i, x: o.x + Math.round((c.x - o.x) / W) * W, y: o.y, name: o.name, tier: o.tier, role: o.role, type: o.type, capital: o.capital !== undefined }); });
    const labels = (Cv.labels || []).filter(l => inWin(l.x, l.y, 0) && l.type !== 'continent' && l.type !== 'ocean').map(l => ({ x: l.x + Math.round((c.x - l.x) / W) * W, y: l.y, name: l.name, type: l.type, h: l.h }));
    const bridges = (Cv.bridges || []).filter(b => inWin(b[0], b[1], 0));
    // 城外农田地块与村落：农业潜力高、平缓、非水面、非城区处铺田块（各片朝向不同）；道路沿线散布村落
    const fields = [], fTone = [], vill = [], villB = []; { const Cv2 = Cv, Cl = world.Cl, gU = U.grid, kx = U.kx, ky = U.ky, rr = G.Noise.mulberry32((world.cfg.seed >>> 0) ^ (idx * 977)), nf = G.Noise.simplex2((world.cfg.seed >>> 0) + 913);
      const inCity = (x, y) => { if (!gU) return false; const i = Math.floor((x - gU.X0) / gU.sx), j = Math.floor((y - gU.Y0) / gU.sy); if (i < 0 || j < 0 || i >= gU.n || j >= gU.n) return false; for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < gU.n && jj < gU.n && gU.built[jj * gU.n + ii]) return true; } return false; };
      const agriAt = (x, y) => { const xx = ((Math.floor(x) % W) + W) % W, yy = Math.min(H - 1, Math.max(0, Math.floor(y))); return Cv2.agri[Math.min(Cv2.H - 1, yy >> 1) * Cv2.W + Math.min(Cv2.W - 1, xx >> 1)]; };
      const FOREST = new Set([2, 4, 5, 10, 11]);
      const fs = extent === 'region' ? 0.9 : 0.42, nx2 = Math.ceil(2 * halfKm / fs);
      for (let j = 0; j < nx2; j++) for (let i = 0; i < nx2; i++) { if (fields.length / 8 > 40000) break;
        const kxm = -halfKm + (i + 0.5) * fs, kym = -halfKm + (j + 0.5) * fs, ang = nf(kxm * 0.12, kym * 0.12) * 1.6, x = c.x + kxm / kx, y = c.y + kym / ky;
        if (G.Noise.coastSurface(P.elev, W, H, x, y, true) <= 2 || G.Noise.surface(Hy.lakeView || Hy.lakeSoft, W, H, x, y) > 0.4 || inCity(x, y)) continue;
        const fi = Math.min(H - 1, Math.floor(y)) * W + ((Math.floor(x) % W) + W) % W; if (P.elev[fi] > 2200 || Cl.snow[fi] >= 1) continue;
        { const g = Math.abs(R.sampleElev(x + 0.25 * fs / kx, y, s, 4) - R.sampleElev(x - 0.25 * fs / kx, y, s, 4)) + Math.abs(R.sampleElev(x, y + 0.25 * fs / ky, s, 4) - R.sampleElev(x, y - 0.25 * fs / ky, s, 4)); if (g / (fs * 1000 * 0.5) > 0.06) continue; } // 坡度 > 6% 不开田
        let p = agriAt(x, y) * 0.85 - (FOREST.has(Cl.biome[fi]) ? 0.4 : 0) + 0.25 * nf(kxm * 0.5 + 40, kym * 0.5) - Math.max(0, Math.hypot(kxm, kym) - U.rKm * 4) / (halfKm * 1.5); if (rr() > p) continue;
        const w0 = fs * (0.22 + 0.24 * rr()), h0 = fs * (0.12 + 0.3 * rr()), ca = Math.cos(ang), sa = Math.sin(ang);
        for (const [a2, b2] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const lx = a2 * w0, ly = b2 * h0; fields.push(x + (lx * ca - ly * sa) / kx, y + (lx * sa + ly * ca) / ky); } fTone.push((rr() * 4) | 0); }
      const lib = (Cv2.libs || []).find(l => l.id === c.lib) || (Cv2.libs || [])[0] || { cities: [] }, usedN = new Set(towns.map(t => t.name).concat([c.name]));
      const step = extent === 'region' ? 3.2 : 1.6;
      for (const cls of ['regional', 'local', 'trunk']) for (const l of roads[cls]) { let acc = rr() * step;
        for (let q = 2; q < l.length; q += 2) { const dx = (l[q] - l[q - 2]) * kx, dy = (l[q + 1] - l[q - 1]) * ky, L = Math.hypot(dx, dy); acc += L; if (acc < step) continue; acc = 0;
          const side = rr() < 0.5 ? -1 : 1, off = 0.35 + 0.4 * rr(), x = l[q] + (-dy / (L || 1)) * off * side / kx, y = l[q + 1] + (dx / (L || 1)) * off * side / ky;
          if (G.Noise.coastSurface(P.elev, W, H, x, y, true) <= 2 || inCity(x, y) || agriAt(x, y) < 0.25) continue; if (towns.some(t => Math.hypot((t.x - x) * kx, (t.y - y) * ky) < 1.5)) continue;
          const nb = 5 + ((rr() * 10) | 0); for (let b2 = 0; b2 < nb; b2++) { const r2 = 0.18 * Math.sqrt(rr()), a3 = rr() * 6.283, bx = x + Math.cos(a3) * r2 / kx, by = y + Math.sin(a3) * r2 / ky, s2 = 0.018 + 0.012 * rr(), an = ang0(rr);
            for (const [a2, b3] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const lx = a2 * s2 * 1.4, ly = b3 * s2; villB.push(bx + (lx * Math.cos(an) - ly * Math.sin(an)) / kx, by + (lx * Math.sin(an) + ly * Math.cos(an)) / ky); } }
          let name = null; if (rr() < 0.45 && (lib.cities || []).length) { for (let t2 = 0; t2 < 8; t2++) { const nm = lib.cities[(rr() * lib.cities.length) | 0].replace(/(城|州|府|郡|镇|堡)$/, '').slice(0, 3) + (rr() < 0.5 ? '村' : '庄'); if (!usedN.has(nm)) { usedN.add(nm); name = nm; break; } } }
          vill.push({ x, y, name }); } } }
    function ang0(r) { return r() * Math.PI; }
    // 局部等高线：按当地高差选间距（参考图式：首曲线 + 每五条一条计曲线）
    const cont = []; let interval = 0; { const n = 220, F = new Float32Array(n * n), gx = 2 * hx / (n - 1), gy = 2 * hy / (n - 1); let lo = Infinity, hi = -Infinity;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = x0 + i * gx, y = y0 + j * gy, land = G.Noise.coastSurface(P.elev, W, H, x, y, true) > 0, v = land ? Math.max(1, R.sampleElev(x, y, s, 4)) : -1; F[j * n + i] = v; if (land) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
      if (hi > lo) { const steps = [5, 10, 20, 25, 50, 100, 200, 250, 500]; interval = steps.find(v => (hi - lo) / v <= 24) || 500; const lv = []; for (let L = Math.ceil(Math.max(1, lo) / interval) * interval; L < hi; L += interval) lv.push(L);
        for (const c2 of contours(F, n, n, lv, 1, false)) { const a = new Float32Array(c2.pts.length); for (let k = 0; k < a.length; k += 2) { a[k] = x0 + (c2.pts[k] - 0.5) * gx; a[k + 1] = y0 + (c2.pts[k + 1] - 0.5) * gy; } cont.push({ level: c2.level, bold: Math.round(c2.level / interval) % 5 === 0, pts: a }); } } }
    return { idx, img, w: w, h: h, x0, y0, s, halfKm, urban: Object.assign({}, U, { grid: null }), roads, rivers, towns, labels, bridges, contours: cont, interval, fields: Float32Array.from(fields), fTone: Uint8Array.from(fTone), villages: vill, villB: Float32Array.from(villB), cellKm: 2 * Math.PI * world.cfg.radius / W };
  }
  const M2 = Math.max;

  function route(a, b) {
    const { Cv } = world; const W = Cv.W, H = Cv.H, N = W * H;
    const cell = p => Math.min(H - 1, Math.max(0, (p[1] / 2) | 0)) * W + ((((p[0] / 2) | 0) % W) + W) % W;
    const s = cell(a), t = cell(b);
    const dist = new Float32Array(N).fill(Infinity), pred = new Int32Array(N).fill(-1), days = new Float32Array(N);
    const hp = new G.Hydro.Heap(N * 3);
    const lat = y => 90 - (y + 0.5) / H * 180;
    const ty = (t / W) | 0, tx = t % W;
    const heur = i => { const y = (i / W) | 0, x = i % W; let dx = Math.abs(x - tx); dx = Math.min(dx, W - dx); return Math.hypot(dx * Math.cos(lat(y) * Math.PI / 180), y - ty) * Cv.cellKm * 0.3; };
    dist[s] = 0; hp.push(s, heur(s));
    const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1];
    const c = i => { let v = Cv.cost[i]; if (Cv.roadTier[i]) v *= [1, 0.3, 0.4, 0.5][Cv.roadTier[i]]; return v; };
    let found = false, pops = 0;
    while (hp.n) {
      const i = hp.pop(); if (i === t) { found = true; break; }
      if (++pops > N * 2) break;
      const y = (i / W) | 0, x = i - y * W, cl = Math.max(0.05, Math.cos(lat(y) * Math.PI / 180));
      for (let k = 0; k < 8; k++) {
        const yy = y + DY[k]; if (yy < 0 || yy >= H) continue;
        const j = yy * W + (x + DX[k] + W) % W;
        const cj = c(j); if (cj === Infinity) continue;
        const len = Math.hypot(DX[k] * cl, DY[k]) * Cv.cellKm;
        const nd = dist[i] + len * (c(i) + cj) / 2;
        if (nd < dist[j]) {
          dist[j] = nd; pred[j] = i;
          const sea = !Cv.land[j], speed = sea ? 110 : Cv.roadTier[j] ? 38 : 24;
          days[j] = days[i] + len / speed;
          hp.push(j, nd + heur(j));
        }
      }
    }
    if (!found) return null;
    const pts = []; let km = 0, i = t, prev = -1, seaKm = 0;
    while (i >= 0) {
      const y = (i / W) | 0, x = i - y * W;
      pts.push((x + 0.5) * 2, (y + 0.5) * 2);
      if (prev >= 0) { const py = (prev / W) | 0, px = prev - py * W; let dx = Math.abs(px - x); dx = Math.min(dx, W - dx); const l = Math.hypot(dx * Math.cos(lat(y) * Math.PI / 180), py - y) * Cv.cellKm; km += l; if (!Cv.land[i]) seaKm += l; }
      prev = i; i = pred[i];
    }
    return { pts: Float32Array.from(pts.reverse ? pts : pts), km: Math.round(km), seaKm: Math.round(seaKm), days: Math.max(1, Math.round(days[t])) };
  }

  // ---------- 渐进瓦片：先发预览帧（关闭缩放细节，快数倍），再按横条带补全细节 ----------
  // 条带之间会让出控制权：取消的请求不再继续算，悬浮查询等消息也能及时处理
  const STRIP_JOBS = new Map(); // id -> job
  let stripTimer = 0;
  const STRIP_ROWS = 64;
  function scheduleStrips() { if (!stripTimer) stripTimer = setTimeout(runStrips, 0); }
  function runStrips() {
    stripTimer = 0;
    const job = STRIP_JOBS.values().next().value;
    if (!job) return;
    STRIP_JOBS.delete(job.id);
    try {
      if (!job.previewed) {
        job.previewed = true;
        const buf = R.render(Object.assign({}, job.req, { preview: true }));
        job.post({ type: 'frame', id: job.id, req: job.req, buf, preview: true }, [buf.buffer]);
        STRIP_JOBS.set(job.id, job); // 预览已发，排到队尾继续细节条带
      } else {
        const pad = job.req.pad || 0, s = job.req.s;
        const n = Math.min(STRIP_ROWS, job.req.h - job.row);
        let buf = R.render(Object.assign({}, job.req, { h: n + 2 * pad, y0: job.req.y0 + (job.row - pad) * s })); // 条带自带 pad 圈（render 会再向外扩一圈）提供接缝上下文，裁剪后与整幅逐位一致
        if (pad) { // render 返回的已是裁剪后（req.w 宽）的图，pad 圈落在首尾各 pad 行；取中间内容行
          const w2 = job.req.w, c2 = new Uint8ClampedArray(w2 * n * 4);
          for (let r = 0; r < n; r++) c2.set(buf.subarray((r + pad) * w2 * 4, (r + pad + 1) * w2 * 4), r * w2 * 4);
          buf = c2;
        }
        job.post({ type: 'strip', id: job.id, y: job.row, h: n, buf }, [buf.buffer]);
        job.row += n;
        if (job.row < job.req.h) STRIP_JOBS.set(job.id, job);
        else job.post({ type: 'stripEnd', id: job.id });
      }
    } catch (err) { job.post({ type: 'error', message: String(err && err.stack || err) }); }
    if (STRIP_JOBS.size) scheduleStrips();
  }

  // ---------- 生成后的覆盖层（等高线 / 风场 / 洋流 / 等压线 / 国界省界 / 专题注记）----------
  // 世界一建好就发 ready 让地图开始渲染，覆盖层拆成小块任务在后台分时推进：
  // 每个任务之间让出控制权，且瓦片渲染（STRIP_JOBS）优先，全部完成后一次送达主线程
  let OVERLAY_DATA = null, overlayPost = null;
  const OVERLAY_TASKS = [];
  let overlayTimer = 0;
  function scheduleOverlays() { if (!overlayTimer && overlayPost) overlayTimer = setTimeout(runOverlay, 0); }
  function runOverlay() {
    overlayTimer = 0;
    if (!overlayPost) return;
    if (STRIP_JOBS.size) { overlayTimer = setTimeout(runOverlay, 20); return; } // 瓦片优先，忙时稍后再来
    if (!OVERLAY_TASKS.length) { // 全部完成：一次送达
      const p = overlayPost, data = OVERLAY_DATA;
      OVERLAY_DATA = null; overlayPost = null;
      if (p && data) p({ type: 'overlays', data });
      return;
    }
    try { OVERLAY_TASKS.shift()(); }
    catch (err) { OVERLAY_TASKS.length = 0; const p = overlayPost; OVERLAY_DATA = null; overlayPost = null; if (p) p({ type: 'error', message: String(err && err.stack || err) }); return; }
    scheduleOverlays();
  }

  function handle(m, post) {
    try {
      if (m.type === 'generate') generate(m.cfg, post);
      else if (m.type === 'render') {
        if (!R) return;
        if (m.req.strips && m.req.s > 0 && m.req.s < 0.9) { // 放大视图（需要缩放细节）才走预览 + 条带渐进
          STRIP_JOBS.set(m.id, { id: m.id, req: m.req, post, previewed: false, row: 0 });
          scheduleStrips();
        } else {
          const buf = R.render(m.req);
          post({ type: 'frame', id: m.id, req: m.req, buf }, [buf.buffer]);
        }
      }
      else if (m.type === 'cancelRender') { const j = STRIP_JOBS.get(m.id); if (j) { j.cancelled = true; STRIP_JOBS.delete(m.id); } }
      else if (m.type === 'globeAssets') { const a = globeAssets(m.w, m.h); post({ type: 'globeAssets', id: m.id, ...a }, [a.albedo.buffer, a.water.buffer, a.relief.buffer]); }
      else if (m.type === 'probe') post({ type: 'probe', id: m.id, data: world ? probe(m.gx, m.gy, m.season || 0) : null });
      else if (m.type === 'cityTerrain') { const img = world ? R.render({ w: m.w, h: m.h, pad: 1, x0: m.x0, y0: m.y0, s: m.s, topic: 'terrain', season: 0, aux: { elev: true, depth: true, lakes: true, snow: true, coast: true, landform: false, relief: 9, detail: 4 } }) : null; post({ type: 'cityTerrain', id: m.id, img }, img ? [img.buffer] : []); }
      else if (m.type === 'cityMap') { const r = world ? cityMap(m.idx, m.px || 1100, m.extent || 'city') : null; post({ type: 'cityMap', id: m.id, data: r }, r ? [r.img.buffer] : []); }
      else if (m.type === 'urban') { const u = world ? G.Urban.build(world, m.idx, { detail: !!m.detail }) : null; post({ type: 'urban', id: m.id, data: u }); }
      else if (m.type === 'citySite') post({ type: 'citySite', id: m.id, data: world ? G.CitySite.payload(world, m.idx, { cap: m.cap }) : null });
      else if (m.type === 'history') { // 历史时间线：按需推演一次，结果缓存在本世界上
        if (!world) post({ type: 'history', id: m.id, data: null });
        else { if (!world.history) world.history = G.History.run(world, (stage, f) => post({ type: 'histProgress', stage, f })); post({ type: 'history', id: m.id, data: world.history }); }
      }
      else if (m.type === 'route') post({ type: 'route', id: m.id, data: world ? (m.points ? roadRoute(m.points, m.mode) : navigation(m.a, m.b, m.mode)) : null });
    } catch (err) {
      post({ type: 'error', message: String(err && err.stack || err) });
    }
  }

  if (inWorker) self.onmessage = e => handle(e.data, (m, t) => self.postMessage(m, t || []));
  else self.TerrainWorkerShim = { handle, _world: () => world };
})();
