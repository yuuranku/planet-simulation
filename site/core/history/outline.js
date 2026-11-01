/* 区块轮廓：把半分辨率网格上的区块描成平滑的矢量多边形（一次算好，之后每年只换颜色）。
 * 所有区块共用同一张边界网络：整张网络一起松弛（每个顶点向相邻顶点的平均位置靠拢，交汇点也一起动），
 * 网格生长留下的大小台阶都被揉成曲线；顶点共用，所以没有缝隙也不重叠。
 * 输出（全分辨率坐标）：每个区块的环（填色用，evenodd），以及两区块之间的边界段（描界线用）。 */
(function (G) {
  'use strict';

  function build(regionOf, W, H, nR) {
    const L = (x, y) => y < 0 || y >= H ? 0 : regionOf[y * W + ((x % W) + W) % W];
    const VW = W, NV = W * (H + 1), vid = (x, y) => y * VW + ((x % W) + W) % W;
    // 顶点类型：交汇（≥3 种标签或对角）用于切分界线段；沿海（周围有非区块格）只轻度松弛
    const pinned = new Uint8Array(NV), coast = new Uint8Array(NV);
    for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) { const a = L(x - 1, y - 1), b = L(x, y - 1), c = L(x - 1, y), d = L(x, y);
      if (a === b && b === c && c === d) continue; const v = vid(x, y); if (!a || !b || !c || !d) coast[v] = 1;
      const s = new Set([a, b, c, d]); if (s.size >= 3 || (s.size === 2 && a === d && b === c && a !== b)) pinned[v] = 1; }
    // 边界单位边：按区块收集（CSR），同时建边界网络的邻接（无向）
    const cnt = new Int32Array(nR + 2), E = [], NB = new Int32Array(NV * 4), deg = new Uint8Array(NV);
    const link = (u, v) => { if (deg[u] < 4) NB[u * 4 + deg[u]++] = v; if (deg[v] < 4) NB[v * 4 + deg[v]++] = u; };
    const add = (r, v0, v1, o) => { if (r) { cnt[r]++; E.push(r, v0, v1, o); } };
    for (let y = 0; y <= H; y++) for (let x = 0; x < W; x++) { const a = L(x, y - 1), b = L(x, y); if (a !== b) { const v0 = vid(x, y), v1 = vid(x + 1, y); add(a, v0, v1, b); add(b, v0, v1, a); link(v0, v1); } }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const a = L(x - 1, y), b = L(x, y); if (a !== b) { const v0 = vid(x, y), v1 = vid(x, y + 1); add(a, v0, v1, b); add(b, v0, v1, a); link(v0, v1); } }
    const off = new Int32Array(nR + 2); for (let r = 1; r <= nR + 1; r++) off[r] = off[r - 1] + cnt[r - 1];
    const fillAt = off.slice(), ev0 = new Int32Array(E.length / 4), ev1 = new Int32Array(E.length / 4), eo = new Int32Array(E.length / 4);
    for (let k = 0; k < E.length; k += 4) { const i = fillAt[E[k]]++; ev0[i] = E[k + 1]; ev1[i] = E[k + 2]; eo[i] = E[k + 3]; }
    // 整张边界网络一起松弛：每个顶点向相邻顶点的平均位置靠拢（共用顶点，所有区块同步变形，不会有缝）
    const px = new Float64Array(NV), py = new Float64Array(NV); let nVert = 0; for (let v = 0; v < NV; v++) if (deg[v]) nVert++; const verts = new Int32Array(nVert); nVert = 0; for (let v = 0; v < NV; v++) if (deg[v]) verts[nVert++] = v;
    for (const v of verts) { px[v] = (v % VW) * 2; py[v] = Math.floor(v / VW) * 2; }
    const nx = new Float64Array(NV), ny = new Float64Array(NV);
    for (let it = 0; it < 12; it++) {
      for (let q = 0; q < verts.length; q++) { const v = verts[q], yv = (v / VW) | 0, dg = deg[v]; if (yv === 0 || yv === H) { nx[v] = px[v]; ny[v] = py[v]; continue; }
        let sx = 0, sy = 0; for (let k = 0; k < dg; k++) { const u = NB[v * 4 + k]; let dx = px[u] - px[v]; if (dx > W) dx -= 2 * W; else if (dx < -W) dx += 2 * W; sx += dx; sy += py[u] - py[v]; }
        const lam = coast[v] ? 0.2 : 0.5; nx[v] = px[v] + lam * sx / dg; ny[v] = py[v] + lam * sy / dg; }
      for (let q = 0; q < verts.length; q++) { const v = verts[q]; px[v] = nx[v]; py[v] = ny[v]; } }
    const ringPts = [], ringOff = [0], regionRings = new Int32Array(nR + 2);
    const segPts = [], segOff = [0], segA = [], segB = [];
    const used = new Uint8Array(ev0.length);
    const unwrap = (vs) => { const n = vs.length, P = new Float64Array(2 * n); let qx = px[vs[0]]; P[0] = qx; P[1] = py[vs[0]]; for (let i = 1; i < n; i++) { let x = px[vs[i]]; while (x - qx > W) x -= 2 * W; while (qx - x > W) x += 2 * W; P[2 * i] = x; P[2 * i + 1] = py[vs[i]]; qx = x; } return P; };
    for (let r = 1; r <= nR; r++) {
      regionRings[r] = ringOff.length - 1;
      const at = new Map(); for (let i = off[r]; i < off[r + 1]; i++) for (const v of [ev0[i], ev1[i]]) { let l = at.get(v); if (!l) at.set(v, l = []); l.push(i); }
      for (let s0 = off[r]; s0 < off[r + 1]; s0++) {
        if (used[s0]) continue;
        const vs = [ev0[s0]], os = [eo[s0]]; let v = ev1[s0]; used[s0] = 1;
        while (v !== vs[0]) { vs.push(v); const l = at.get(v); let nx2 = -1; for (const e of l) if (!used[e]) { nx2 = e; break; } if (nx2 < 0) break; used[nx2] = 1; os.push(eo[nx2]); v = ev0[nx2] === v ? ev1[nx2] : ev0[nx2]; }
        const n = vs.length; if (n < 3) continue;
        const P = unwrap(vs);
        // 环：取松弛后的顶点，再做一轮中点细分让曲线更圆（逐段进行，两侧一致）
        const ring = [];
        for (let i = 0; i < n; i++) { const j = (i + 1) % n; let bx = P[2 * j]; if (j === 0) { const d = Math.round((P[2 * (n - 1)] - P[0]) / (2 * W)) * 2 * W; bx += d; }
          ring.push(P[2 * i] * 0.75 + bx * 0.25, P[2 * i + 1] * 0.75 + P[2 * j + 1] * 0.25, P[2 * i] * 0.25 + bx * 0.75, P[2 * i + 1] * 0.25 + P[2 * j + 1] * 0.75); }
        for (const t of ring) ringPts.push(t); ringOff.push(ringPts.length);
        // 界线段：在交汇点切开，每对区块只记一次（r < 对方）
        const pins = []; for (let i = 0; i < n; i++) if (pinned[vs[i]] || os[i] !== os[(i - 1 + n) % n]) pins.push(i);
        const emit = (idxs, o) => { if (!(o > r)) return; const Q = unwrap(idxs.map(i => vs[i])); segA.push(r); segB.push(o);
          const m = Q.length / 2; segPts.push(Q[0], Q[1]); for (let i = 0; i < m - 1; i++) { if (i > 0) segPts.push(Q[2 * i] * 0.75 + Q[2 * i + 2] * 0.25, Q[2 * i + 1] * 0.75 + Q[2 * i + 3] * 0.25); if (i < m - 2) segPts.push(Q[2 * i] * 0.25 + Q[2 * i + 2] * 0.75, Q[2 * i + 1] * 0.25 + Q[2 * i + 3] * 0.75); } segPts.push(Q[2 * m - 2], Q[2 * m - 1]); segOff.push(segPts.length); };
        if (!pins.length) emit([...Array(n).keys(), 0], os[0]);
        else for (let k = 0; k < pins.length; k++) { const i0 = pins[k], i1 = pins[(k + 1) % pins.length], idxs = [i0]; let i = i0; do { i = (i + 1) % n; idxs.push(i); } while (i !== i1); emit(idxs, os[i0]); }
      }
    }
    regionRings[nR + 1] = ringOff.length - 1;
    return { ringPts: Float32Array.from(ringPts), ringOff: Int32Array.from(ringOff), regionRings, segPts: Float32Array.from(segPts), segOff: Int32Array.from(segOff), segA: Int32Array.from(segA), segB: Int32Array.from(segB) };
  }

  // 把平滑后的区块多边形光栅化到全分辨率（像素中心采样，evenodd；共用的边界两侧判定一致），再按陆地遮罩裁齐、补齐海岸小缝
  function rasterize(O, nR, FW, FH, landF) {
    const idx = new Uint16Array(FW * FH), P = O.ringPts, xs = [];
    for (let r = 1; r <= nR; r++) {
      const k0 = O.regionRings[r], k1 = O.regionRings[r + 1]; if (k1 <= k0) continue;
      let y0 = Infinity, y1 = -Infinity; for (let k = k0; k < k1; k++) for (let i = O.ringOff[k] + 1; i < O.ringOff[k + 1]; i += 2) { const y = P[i]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const ya = Math.max(0, Math.ceil(y0 - 0.5)), yb = Math.min(FH - 1, Math.floor(y1 - 0.5));
      for (let py = ya; py <= yb; py++) { const cy = py + 0.5; xs.length = 0;
        for (let k = k0; k < k1; k++) { const a = O.ringOff[k], b = O.ringOff[k + 1], n = (b - a) / 2; if (n < 3) continue;
          for (let i = 0; i < n; i++) { const j = (i + 1) % n; let ax = P[a + 2 * i], ay = P[a + 2 * i + 1], bx = P[a + 2 * j], by = P[a + 2 * j + 1];
            if (ay > by) { let t = ax; ax = bx; bx = t; t = ay; ay = by; by = t; }
            if (cy < ay || cy >= by) continue; xs.push(ax + (cy - ay) / (by - ay) * (bx - ax)); } }
        if (xs.length < 2) continue; xs.sort((p, q) => p - q);
        for (let m = 0; m + 1 < xs.length; m += 2) { const xa = Math.ceil(xs[m] - 0.5), xb = Math.ceil(xs[m + 1] - 0.5); const row = py * FW;
          for (let x = xa; x < xb; x++) idx[row + ((x % FW) + FW) % FW] = r; } }
    }
    // 海岸：非陆地清零；陆地上的小缝（离区块 ≤ 6 像素）由最近的区块补上
    const dist = new Uint8Array(FW * FH), q = new Int32Array(FW * FH); let h = 0, t = 0;
    for (let i = 0; i < idx.length; i++) { if (!landF[i]) { idx[i] = 0; continue; } if (idx[i]) q[t++] = i; }
    while (h < t) { const i = q[h++]; if (dist[i] >= 6) continue; const y = (i / FW) | 0, x = i - y * FW;
      for (const j of [y * FW + (x + 1) % FW, y * FW + (x + FW - 1) % FW, y > 0 ? i - FW : -1, y < FH - 1 ? i + FW : -1]) { if (j < 0 || idx[j] || !landF[j]) continue; idx[j] = idx[i]; dist[j] = dist[i] + 1; q[t++] = j; } }
    return idx;
  }

  // 全分辨率区块编号图上的界线：与现在的地图同一套界线算法（edges.js）
  function segments(F, FW, FH) {
    const C = G.Edges.chains(F, FW, FH, (a, b) => a > 0 && b > 0);
    return { segPts: C.pts, segOff: C.off, segA: C.A, segB: C.B };
  }

  G.HistoryOutline = { build, rasterize, segments };
})(typeof self !== 'undefined' ? self : this);
