/* 噪声与随机数：simplex 2D/3D、fbm、ridged */
(function (G) {
  'use strict';
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function perm(seed) {
    const r = mulberry32(seed), p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    const q = new Uint8Array(512);
    for (let i = 0; i < 512; i++) q[i] = p[i & 255];
    return q;
  }
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  const GX = [1, -1, 1, -1, 1, -1, 0, 0], GY = [1, 1, -1, -1, 0, 0, 1, -1];
  function simplex2(seed) {
    const P = perm(seed);
    return function (x, y) {
      const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2;
      const x0 = x - (i - t), y0 = y - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n = 0, tt, g;
      tt = 0.5 - x0 * x0 - y0 * y0; if (tt > 0) { g = P[ii + P[jj]] & 7; tt *= tt; n += tt * tt * (GX[g] * x0 + GY[g] * y0); }
      tt = 0.5 - x1 * x1 - y1 * y1; if (tt > 0) { g = P[ii + i1 + P[jj + j1]] & 7; tt *= tt; n += tt * tt * (GX[g] * x1 + GY[g] * y1); }
      tt = 0.5 - x2 * x2 - y2 * y2; if (tt > 0) { g = P[ii + 1 + P[jj + 1]] & 7; tt *= tt; n += tt * tt * (GX[g] * x2 + GY[g] * y2); }
      return 70 * n;
    };
  }
  const F3 = 1 / 3, G3 = 1 / 6;
  const g3 = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
  function simplex3(seed) {
    const P = perm(seed);
    const pm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) pm[i] = (P[i] % 12) * 3;
    return function (x, y, z) {
      const s = (x + y + z) * F3;
      const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
      const t = (i + j + k) * G3;
      const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      const ii = i & 255, jj = j & 255, kk = k & 255;
      let n = 0, tt, g;
      tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (tt > 0) { g = pm[ii + P[jj + P[kk]]]; tt *= tt; n += tt * tt * (g3[g] * x0 + g3[g + 1] * y0 + g3[g + 2] * z0); }
      tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (tt > 0) { g = pm[ii + i1 + P[jj + j1 + P[kk + k1]]]; tt *= tt; n += tt * tt * (g3[g] * x1 + g3[g + 1] * y1 + g3[g + 2] * z1); }
      tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (tt > 0) { g = pm[ii + i2 + P[jj + j2 + P[kk + k2]]]; tt *= tt; n += tt * tt * (g3[g] * x2 + g3[g + 1] * y2 + g3[g + 2] * z2); }
      tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (tt > 0) { g = pm[ii + 1 + P[jj + 1 + P[kk + 1]]]; tt *= tt; n += tt * tt * (g3[g] * x3 + g3[g + 1] * y3 + g3[g + 2] * z3); }
      return 32 * n;
    };
  }
  function fbm3(n, x, y, z, oct, lac = 2.0, gain = 0.5) {
    let s = 0, a = 1, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { s += a * n(x * f, y * f, z * f); norm += a; a *= gain; f *= lac; }
    return s / norm;
  }
  function ridged3(n, x, y, z, oct) {
    let s = 0, a = 0.5, f = 1, w = 1, norm = 0;
    for (let o = 0; o < oct; o++) {
      let v = 1 - Math.abs(n(x * f, y * f, z * f)); v *= v; v *= w; w = Math.min(1, v * 1.8);
      s += a * v; norm += a; a *= 0.5; f *= 2.1;
    }
    return s / norm;
  }
  function fbm2(n, x, y, oct) {
    let s = 0, a = 1, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { s += a * n(x * f, y * f); norm += a; a *= 0.5; f *= 2.03; }
    return s / norm;
  }
  // 三次 B 样条曲面采样（格心坐标 x+0.5），经度环绕：海岸、湖岸与河口共用这一连续地表，岸线为光滑曲线
  function bspline(A, W, H, x, y) {
    const fx = x - 0.5, fy = Math.min(H - 1, Math.max(0, y - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const ux = 1 - tx, uy = 1 - ty;
    const wx0 = ux * ux * ux / 6, wx1 = (3 * tx * tx * tx - 6 * tx * tx + 4) / 6, wx2 = (-3 * tx * tx * tx + 3 * tx * tx + 3 * tx + 1) / 6, wx3 = tx * tx * tx / 6;
    const wy = [uy * uy * uy / 6, (3 * ty * ty * ty - 6 * ty * ty + 4) / 6, (-3 * ty * ty * ty + 3 * ty * ty + 3 * ty + 1) / 6, ty * ty * ty / 6];
    let xa = x0 - 1; xa = ((xa % W) + W) % W; const xb = xa + 1 === W ? 0 : xa + 1, xc = xb + 1 === W ? 0 : xb + 1, xd = xc + 1 === W ? 0 : xc + 1;
    let s = 0;
    for (let j = 0; j < 4; j++) { let yy = y0 - 1 + j; yy = yy < 0 ? 0 : yy >= H ? H - 1 : yy; const r = yy * W; s += wy[j] * (A[r + xa] * wx0 + A[r + xb] * wx1 + A[r + xc] * wx2 + A[r + xd] * wx3); }
    return s;
  }
  // 统一地表：Catmull-Rom 三次插值（经过每个格心原值、格间为圆滑曲线）。海岸、湖岸、分层设色、等高线交点、河口与港口都用它，彼此对齐。
  // 三次插值，但结果夹在两端格心值之间：保留圆滑，不产生过冲（落差大的岸边不会冒出假陆点 / 假水点）
  function cr(p0, p1, p2, p3, t) { const v = p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0))); const lo = p1 < p2 ? p1 : p2, hi = p1 < p2 ? p2 : p1; return v < lo ? lo : v > hi ? hi : v; }
  let sLo = 0, sHi = 0;
  const crRaw = (p0, p1, p2, p3, t) => p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  function surfaceRaw(A, W, H, x, y) { // 不夹值的三次插值：处处连续（格边两侧一致）
    const fx = x - 0.5, fy = Math.min(H - 1, Math.max(0, y - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const xa = ((x0 - 1) % W + W) % W, xb = (xa + 1) % W, xc = (xb + 1) % W, xd = (xc + 1) % W;
    let r0 = 0, r1 = 0, r2 = 0, r3 = 0, lo = Infinity, hi = -Infinity;
    for (let j = 0; j < 4; j++) { let yy = y0 - 1 + j; yy = yy < 0 ? 0 : yy >= H ? H - 1 : yy; const o = yy * W;
      if (j === 1 || j === 2) { const a = A[o + xb], b = A[o + xc]; if (a < lo) lo = a; if (b < lo) lo = b; if (a > hi) hi = a; if (b > hi) hi = b; }
      const v = crRaw(A[o + xa], A[o + xb], A[o + xc], A[o + xd], tx); if (j === 0) r0 = v; else if (j === 1) r1 = v; else if (j === 2) r2 = v; else r3 = v; }
    sLo = lo; sHi = hi; return crRaw(r0, r1, r2, r3, ty);
  }
  function surface(A, W, H, x, y) {
    const fx = x - 0.5, fy = Math.min(H - 1, Math.max(0, y - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const xa = ((x0 - 1) % W + W) % W, xb = (xa + 1) % W, xc = (xb + 1) % W, xd = (xc + 1) % W;
    let r0 = 0, r1 = 0, r2 = 0, r3 = 0, lo = Infinity, hi = -Infinity;
    for (let j = 0; j < 4; j++) { let yy = y0 - 1 + j; yy = yy < 0 ? 0 : yy >= H ? H - 1 : yy; const o = yy * W;
      if (j === 1 || j === 2) { const a = A[o + xb], b = A[o + xc]; if (a < lo) lo = a; if (b < lo) lo = b; if (a > hi) hi = a; if (b > hi) hi = b; }
      const v = crRaw(A[o + xa], A[o + xb], A[o + xc], A[o + xd], tx); if (j === 0) r0 = v; else if (j === 1) r1 = v; else if (j === 2) r2 = v; else r3 = v; }
    const v = crRaw(r0, r1, r2, r3, ty);
    sLo = lo; sHi = hi;
    return v < lo ? lo : v > hi ? hi : v; // 只夹在本格四角的范围内：各向同性，不产生横平竖直的台阶，也不过冲
  }

  // 海岸地表：在统一地表上叠加只在零线附近起作用的分形起伏（格网以下的小岬、小湾、礁石），
  // 所有判断“是不是海”的地方（设色、河口、港口、城市）都用它，彼此一致；远离海岸时与 surface 完全相同。
  const coastN = simplex3(424242);
  const proxCache = new WeakMap();
  function coastProx(A, W, H) { // 海陆符号场模糊两次：海岸处≈0，离岸 1–2 格外为 ±1
    let P = proxCache.get(A); if (P) return P;
    let B = Float32Array.from(A, v => v > 0 ? 1 : -1);
    for (let it = 0; it < 2; it++) { const C = new Float32Array(B.length); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s2 = 0, n = 0; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { s2 += B[yy * W + ((x + dx) % W + W) % W]; n++; } } C[y * W + x] = s2 / n; } B = C; }
    proxCache.set(A, B); return B; }
  // 海陆场：高程压缩到 ±1（tanh(e/25)），在其上做不夹值三次插值——连续、无断口，深海也不会造成过冲
  const tCache = new WeakMap();
  function coastT(A) { let T = tCache.get(A); if (!T) { T = new Float32Array(A.length); for (let i = 0; i < A.length; i++) T[i] = Math.tanh(A[i] / 25); tCache.set(A, T); } return T; }
  // 返回带符号的海陆值（>0 陆、≤0 水，量级约以米计）。所有“是不是海”的判断（设色、海岸线、河口、港口、城市）都用它
  const rgCache = new WeakMap();
  function coastRange(A, W, H) { // 每格 3×3 邻域内海陆场的反差（连续插值用）
    let R = rgCache.get(A); if (R) return R; const T = coastT(A); R = new Float32Array(A.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let lo = 9, hi = -9; for (let dy = -1; dy <= 1; dy++) { const yy = Math.min(H - 1, Math.max(0, y + dy)); for (let dx = -1; dx <= 1; dx++) { const v = T[yy * W + ((x + dx) % W + W) % W]; if (v < lo) lo = v; if (v > hi) hi = v; } } R[y * W + x] = hi - lo; }
    rgCache.set(A, R); return R; }
  function coastSurface(A, W, H, x, y) {
    const T = coastT(A), t = surfaceRaw(T, W, H, x, y); if (t > 0.85 || t < -0.85) return t * 100;
    const P = coastProx(A, W, H), RG = coastRange(A, W, H);
    const sx0 = x - 0.5, sy0 = Math.min(H - 1.001, Math.max(0, y - 0.5)), sx = ((sx0 % W) + W) % W, xi = sx | 0, tx = sx - xi, xj = xi + 1 === W ? 0 : xi + 1, yi = sy0 | 0, ty = sy0 - yi, yj = Math.min(H - 1, yi + 1);
    const p = (P[yi * W + xi] * (1 - tx) + P[yi * W + xj] * tx) * (1 - ty) + (P[yj * W + xi] * (1 - tx) + P[yj * W + xj] * tx) * ty;
    const wgt = Math.max(0, 1 - Math.abs(p) * 1.4); if (wgt <= 0) return t * 100;
    const range = (RG[yi * W + xi] * (1 - tx) + RG[yi * W + xj] * tx) * (1 - ty) + (RG[yj * W + xi] * (1 - tx) + RG[yj * W + xj] * tx) * ty;
    const lo = (x / W) * Math.PI * 2, la = (0.5 - y / H) * Math.PI, c = Math.cos(la), k = W / (2 * Math.PI);
    const px = c * Math.cos(lo) * k, py = c * Math.sin(lo) * k, pz = Math.sin(la) * k;
    const n = coastN(px * 0.9, py * 0.9, pz * 0.9) * 0.55 + coastN(px * 2.3 + 5, py * 2.3, pz * 2.3) * 0.3 + coastN(px * 5.7 - 9, py * 5.7, pz * 5.7) * 0.15;
    const amp = Math.min(0.45, 0.06 + 0.2 * range); // 陡岸（陆海反差大）起伏大，低平海岸只轻微起伏
    return 100 * (t + amp * n * wgt * wgt * Math.exp(-Math.abs(t) / 0.35) * Math.max(0, 1 - Math.abs(t) / 0.85));
  }


  // 近岸高程收口：设色 / 晕渲 / 等高线所用高程是一张与海岸线严格对齐的连续地表——海岸线就是它的 0 m 等高线。
  // 做法：求每一点到“真实海岸线”（coastSurface 零线，含格下小岬小湾）的距离 d，
  //   近岸（海岸地表的起伏带内）用局部 |海岸地表| / 梯度 精确求距，离岸稍远处平滑过渡到格网带符号距离场；
  //   再以坡度包络 cap(d) = 岸坡 × d（离岸 COAST_REACH 格外放开）与原高程取平滑最小值。
  // 于是高程在海岸线上恰好归零、向内单调平滑回升，色带、晕渲、等高线都绕着海岸走，不会被海岸线截断。
  // 低平海岸远低于包络，几乎不受影响；内陆高山不受影响。
  const COAST_SLOPE = 22;      // 远包络：平均岸坡（米 / 千米）
  const COAST_REACH = 2.2;     // 远包络作用范围（格）
  let coastKm = 24;            // 每格千米数（由 Render.create 按星球半径设置）
  const sdCache = new WeakMap();
  function coastSD(A, W, H) { // 带符号的格网海岸距离（格）：陆格 = 到最近海格中心距离 − 0.5，海格取负；邻海两格中点 ≈ 0
    let S = sdCache.get(A); if (S) return S;
    const N = W * H, INF = 1e9, CAP = 8;
    const edt = (src) => { // 两遍倒角距离（经向按纬度余弦缩短），到 src 格中心
      const D = new Float32Array(N); for (let i = 0; i < N; i++) D[i] = src(i) ? 0 : INF;
      const cx = new Float32Array(H); for (let y = 0; y < H; y++) cx[y] = Math.max(0.15, Math.cos((0.5 - (y + 0.5) / H) * Math.PI));
      for (let pass = 0; pass < 2; pass++) for (let k = 0; k < H; k++) { // 先自上而下、再自下而上；每行先取相邻行，再沿行双向（含经向环绕）传播
        const y = pass ? H - 1 - k : k, yy = pass ? y + 1 : y - 1, r = y * W, ax = cx[y], dg = Math.sqrt(ax * ax + 1);
        if (yy >= 0 && yy < H) { const q = yy * W; for (let x = 0; x < W; x++) { const xl = x === 0 ? W - 1 : x - 1, xr = x === W - 1 ? 0 : x + 1; let v = D[r + x], t = D[q + x] + 1; if (t < v) v = t; t = D[q + xl] + dg; if (t < v) v = t; t = D[q + xr] + dg; if (t < v) v = t; D[r + x] = v; } }
        for (let j = 1; j < 2 * W; j++) { const x = j % W, p = (j - 1) % W, t = D[r + p] + ax; if (t < D[r + x]) D[r + x] = t; }
        for (let j = 2 * W - 2; j >= 0; j--) { const x = j % W, p = (j + 1) % W, t = D[r + p] + ax; if (t < D[r + x]) D[r + x] = t; }
      }
      return D;
    };
    const Ds = edt(i => A[i] <= 0), Dl = edt(i => A[i] > 0);
    let B = new Float32Array(N); for (let i = 0; i < N; i++) B[i] = A[i] > 0 ? Math.min(CAP, Ds[i] - 0.5) : -Math.min(CAP, Dl[i] - 0.5);
    // 轻度模糊一次：消去倒角距离的折角，跨格平滑
    const C = new Float32Array(N); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s2 = 0, n = 0; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { const w = (dx ? 1 : 2) * (dy ? 1 : 2); s2 += B[yy * W + ((x + dx) % W + W) % W] * w; n += w; } } C[y * W + x] = s2 / n; }
    S = C; sdCache.set(A, S); return S;
  }
  function coastDist(cv, A, W, H, x, y) { // 到海岸线的距离（格，按纬度换算经向），陆上 ≥ 0
    const S = coastSD(A, W, H), sx0 = x - 0.5, sy0 = Math.min(H - 1.001, Math.max(0, y - 0.5)), sx = ((sx0 % W) + W) % W, xi = sx | 0, tx = sx - xi, xj = xi + 1 === W ? 0 : xi + 1, yi = sy0 | 0, ty = sy0 - yi, yj = Math.min(H - 1, yi + 1);
    const dg = Math.max(0, (S[yi * W + xi] * (1 - tx) + S[yi * W + xj] * tx) * (1 - ty) + (S[yj * W + xi] * (1 - tx) + S[yj * W + xj] * tx) * ty);
    const t = cv / 100; if (t >= 0.85) return dg;
    const h = 0.03, cl = Math.max(0.15, Math.cos((0.5 - y / H) * Math.PI));
    const gx = (coastSurface(A, W, H, x + h, y) - coastSurface(A, W, H, x - h, y)) / (2 * h) / cl, gy = (coastSurface(A, W, H, x, y + h) - coastSurface(A, W, H, x, y - h)) / (2 * h);
    const gm = Math.hypot(gx, gy), dl = gm > 1e-6 ? Math.min(1.5, cv / gm) : dg;
    const u = Math.max(0, Math.min(1, (t - 0.45) / 0.4)), w = u * u * (3 - 2 * u); // 起伏带内用局部距离，向外平滑交给格网距离
    return dl + (dg - dl) * w;
  }
  function coastCap(cv, A, W, H, x, y) {
    if (!A) { const t = cv / 100; return t >= 0.999 ? Infinity : t <= 0 ? 0 : 110 * t / (1 - t); }
    const u = coastDist(cv, A, W, H, x, y) / COAST_REACH;
    return u >= 1 ? Infinity : COAST_SLOPE * coastKm * COAST_REACH * u / (1 - u);
  }
  const smin = (b, c) => { if (c === Infinity) return b; const r = b / Math.max(1e-6, c), r4 = r * r * r * r; return b / Math.sqrt(Math.sqrt(1 + r4)); };
  function coastElev(e, cv, A, W, H, x, y) {
    if (cv <= 0) return e > -0.5 ? -0.5 : e; // 海侧：保持在海平面以下
    const b = e > 1 ? e : 1, v = smin(b, coastCap(cv, A, W, H, x, y));
    return v > 0.5 ? v : 0.5;
  }
  // 某一高程层（等高线）在该点是否仍落在收口后的地表之上（≥ 该层 60%）
  function coastKeeps(level, cv, A, W, H, x, y) { if (cv <= 0) return false; return smin(level, coastCap(cv, A, W, H, x, y)) >= 0.6 * level; }
  function setCoastScale(km) { if (km > 0 && isFinite(km)) coastKm = km; }

  G.Noise = { mulberry32, simplex2, simplex3, fbm3, ridged3, fbm2, bspline, surface, surfaceRaw, cr, coastSurface, coastElev, coastKeeps, setCoastScale };
})(typeof self !== 'undefined' ? self : this);
