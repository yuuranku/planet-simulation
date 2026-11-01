/* 界线：全图所有疆界（现在的国界、省界、边疆线，历史时间线的区块界）共用这一套算法。
 *  1. 链：全分辨率标签图上，按标签对把像素边连成折线，在交汇处（第三种标签或水域）断开；
 *  2. 曲线：取像素边中点去掉一像素台阶 → Taubin 平滑三轮（先收缩再回胀，面积基本不变），
 *     把栅格留下的 45° 折角与直角台阶揉成曲线 → 按弧长每 0.5 像素重采样，沿法向加三个尺度的细碎起伏（≤ 约半个像素）。
 *     起伏只取决于位置；端点（交汇处）固定且起伏渐收为零，各段在交汇处严丝合缝；经度方向连续（日界线无断口）；
 *  3. 填色：每条链记下正侧（沿走向的右手边，屏幕坐标）与负侧的标签。填色时离界线近的像素取最近一段曲线，
 *     按点在线的哪一侧决定颜色——填色与界线是同一条线。 */
(function (G) {
  'use strict';
  const AMP = 0.45, SP = 0.5;
  let n2 = null;
  const jag = (x, y) => n2(x * 0.35 + 7.6, y * 0.35 - 2.3) * 0.55 + n2(x * 0.9 + 4.1, y * 0.9 - 1.2) * 0.3 + n2(x * 2.1 + 2.1, y * 2.1 - 0.6) * 0.15;

  // 一条链（像素格点序列，已按经度展开）→ 曲线点，追加到 out
  function curve(X, Y, FW, out) {
    if (!n2 && G.Noise && G.Noise.simplex2) n2 = G.Noise.simplex2(911);
    const n = X.length, closed = n > 3 && X[0] === X[n - 1] && Y[0] === Y[n - 1];
    let QX = [], QY = []; if (!closed) { QX.push(X[0]); QY.push(Y[0]); }
    for (let i = 0; i < n - 1; i++) { QX.push((X[i] + X[i + 1]) / 2); QY.push((Y[i] + Y[i + 1]) / 2); }
    if (!closed) { QX.push(X[n - 1]); QY.push(Y[n - 1]); }
    let m = QX.length;
    for (let it = 0; it < 3; it++) for (const lam of [0.5, -0.53]) { const NX = QX.slice(), NY = QY.slice();
      for (let i = 0; i < m; i++) { let p = i - 1, q = i + 1; if (closed) { p = (p + m) % m; q %= m; } else if (i === 0 || i === m - 1) continue;
        NX[i] = QX[i] + lam * ((QX[p] + QX[q]) / 2 - QX[i]); NY[i] = QY[i] + lam * ((QY[p] + QY[q]) / 2 - QY[i]); }
      QX = NX; QY = NY; }
    if (closed) { QX.push(QX[0]); QY.push(QY[0]); m++; }
    const S = new Float64Array(m); for (let i = 1; i < m; i++) S[i] = S[i - 1] + Math.hypot(QX[i] - QX[i - 1], QY[i] - QY[i - 1]);
    const Lt = S[m - 1], k = Math.max(1, Math.round(Lt / SP)); let j = 0;
    for (let t = 0; t <= k; t++) { const s = Lt * t / k; while (j < m - 2 && S[j + 1] < s) j++;
      const u = S[j + 1] > S[j] ? (s - S[j]) / (S[j + 1] - S[j]) : 0; let x = QX[j] + (QX[j + 1] - QX[j]) * u, y = QY[j] + (QY[j + 1] - QY[j]) * u;
      if (n2 && t > 0 && t < k) { const tx = QX[j + 1] - QX[j], ty = QY[j + 1] - QY[j], tl = Math.hypot(tx, ty) || 1, taper = closed ? 1 : Math.min(1, s / 1.5, (Lt - s) / 1.5);
        const dd = AMP * taper * jag(((x % FW) + FW) % FW, y); x -= ty / tl * dd; y += tx / tl * dd; }
      out.push(x, y); }
  }

  /* 标签图 L（全分辨率，经度环绕）上所有 pair(a, b) 为真的标签对之间的界线。
   * 返回 { pts, off, A, B }：第 k 条链的点为 pts[off[k] .. off[k+1])；A[k] 是正侧标签、B[k] 是负侧标签。
   * 正侧：沿链走向的叉积 > 0 一侧（屏幕坐标 y 向下）。 */
  function chains(L, FW, FH, pair) {
    const ids = new Map(); let nL = 0; const idOf = v => { let i = ids.get(v); if (i === undefined) { ids.set(v, i = nL++); } return i; };
    const groups = new Map(), vid = (x, y) => y * FW + ((x % FW) + FW) % FW;
    const push = (a, b, v0, v1) => { const ia = idOf(a), ib = idOf(b), k = ia < ib ? ia * 1048576 + ib : ib * 1048576 + ia; let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(v0, v1); };
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const i = y * FW + x, a = L[i];
      const b = L[y * FW + (x + 1) % FW]; if (a !== b && pair(a, b)) push(a, b, vid(x + 1, y), vid(x + 1, y + 1));
      if (y + 1 < FH) { const c = L[i + FW]; if (a !== c && pair(a, c)) push(a, c, vid(x, y + 1), vid(x + 1, y + 1)); } }
    const pts = [], off = [0], A = [], B = [];
    const emit = vs => { const n = vs.length; if (n < 2) return; const X = new Array(n), Y = new Array(n); let px = vs[0] % FW;
      for (let i = 0; i < n; i++) { let x = vs[i] % FW; while (x - px > FW / 2) x -= FW; while (px - x > FW / 2) x += FW; X[i] = x; Y[i] = Math.floor(vs[i] / FW); px = x; }
      // 第一段像素边两侧的格子：正侧在走向的右手边（屏幕坐标）
      let pPos, pNeg; const dx = X[1] - X[0], dy = Y[1] - Y[0];
      if (dy === 0) { const x = ((Math.min(X[0], X[1]) % FW) + FW) % FW, below = Y[0] * FW + x, above = (Y[0] - 1) * FW + x; pPos = dx > 0 ? below : above; pNeg = dx > 0 ? above : below; }
      else { const y = Math.min(Y[0], Y[1]), xr = ((X[0] % FW) + FW) % FW, right = y * FW + xr, left = y * FW + (xr - 1 + FW) % FW; pPos = dy > 0 ? left : right; pNeg = dy > 0 ? right : left; }
      curve(X, Y, FW, pts); off.push(pts.length); A.push(L[pPos]); B.push(L[pNeg]); };
    for (const E of groups.values()) { const ne = E.length / 2, at = new Map(), used = new Uint8Array(ne);
      for (let e = 0; e < ne; e++) for (const v of [E[2 * e], E[2 * e + 1]]) { let l = at.get(v); if (!l) at.set(v, l = []); l.push(e); }
      const walk = (start, v0) => { const vs = [v0]; let e = start, v = v0; for (;;) { used[e] = 1; v = E[2 * e] === v ? E[2 * e + 1] : E[2 * e]; vs.push(v); const l = at.get(v); let nx = -1; if (l.length === 2) for (const x of l) if (!used[x]) { nx = x; break; } if (nx < 0) break; e = nx; } return vs; };
      for (const [v, l] of at) if (l.length !== 2) for (const e of l) if (!used[e]) emit(walk(e, v)); // 先从端点（交汇处）出发
      for (let e = 0; e < ne; e++) if (!used[e]) emit(walk(e, E[2 * e])); } // 剩下的是闭环
    return { pts: Float32Array.from(pts), off: Int32Array.from(off), A: Int32Array.from(A), B: Int32Array.from(B) };
  }

  // 空间索引：每个像素格挂上穿过它的曲线小段，供填色查“离这里最近的界线、我在哪一侧”
  function index(C, FW, FH) {
    const head = new Int32Array(FW * FH).fill(-1), nxt = [], seg = [];
    const P = C.pts;
    for (let k = 0; k < C.A.length; k++) for (let i = C.off[k]; i + 3 < C.off[k + 1]; i += 2) {
      const ax = P[i], ay = P[i + 1], bx = P[i + 2], by = P[i + 3];
      const x0 = Math.floor(Math.min(ax, bx)), x1 = Math.floor(Math.max(ax, bx)), y0 = Math.max(0, Math.floor(Math.min(ay, by))), y1 = Math.min(FH - 1, Math.floor(Math.max(ay, by)));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const c = y * FW + ((x % FW) + FW) % FW; nxt.push(head[c]); seg.push(i, k); head[c] = nxt.length - 1; }
    }
    return { head, nxt: Int32Array.from(nxt), seg: Int32Array.from(seg), C, FW, FH };
  }
  // (gx, gy) 周围 (2r+1)² 个像素格、r + 0.5 像素内最近的一段界线：返回该点所在一侧的标签；没有界线则返回 undefined
  function side(I, gx, gy, r) {
    const { head, nxt, seg, C, FW, FH } = I, P = C.pts, cx = Math.floor(gx), cy = Math.floor(gy);
    let best = (r + 0.5) * (r + 0.5), bk = -1, bs = 0;
    for (let y = Math.max(0, cy - r); y <= Math.min(FH - 1, cy + r); y++) for (let x = cx - r; x <= cx + r; x++) {
      for (let e = head[y * FW + ((x % FW) + FW) % FW]; e >= 0; e = nxt[e]) { const i = seg[2 * e], k = seg[2 * e + 1];
        const ax = P[i], ay = P[i + 1], dx = P[i + 2] - ax, dy = P[i + 3] - ay; let px = gx - ax; px -= Math.round(px / FW) * FW; const py = gy - ay;
        const L2 = dx * dx + dy * dy || 1e-12, t = Math.max(0, Math.min(1, (px * dx + py * dy) / L2)), qx = px - t * dx, qy = py - t * dy, d = qx * qx + qy * qy;
        if (d < best) { best = d; bk = k; bs = dx * py - dy * px; } }
    }
    return bk < 0 ? undefined : bs > 0 ? C.A[bk] : C.B[bk];
  }

  G.Edges = { chains, curve, index, side };
})(typeof self !== 'undefined' ? self : this);
