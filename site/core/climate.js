/* 气候：日照(轴倾角/季节/星环阴影) → 气温(热惯性/大陆度/洋流/递减率) → 三圈环流+热力气压(季风) → 水汽输送降水
 * 在粗网格上推演四季，再在全分辨率上做柯本分类、群系、积雪海冰、冻土。 */
(function (G) {
  'use strict';
  const D2R = Math.PI / 180;
  const SEASONS = ['春分', '夏至', '秋分', '冬至'];

  function insolation(latDeg, declDeg, S0) {
    const p = latDeg * D2R, d = declDeg * D2R;
    const x = -Math.tan(p) * Math.tan(d);
    const h0 = x >= 1 ? 0 : x <= -1 ? Math.PI : Math.acos(x);
    return S0 / Math.PI * (h0 * Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.sin(h0));
  }

  function chamfer(W, H, isSrc, cellKm, cosLat) {
    // 两遍倒角距离（km），x 环绕近似：多做一轮
    const d = new Float32Array(W * H);
    for (let i = 0; i < d.length; i++) d[i] = isSrc(i) ? 0 : 1e9;
    for (let rep = 0; rep < 2; rep++) {
      for (let y = 0; y < H; y++) {
        const dx = cellKm * Math.max(0.05, cosLat[y]), dg = Math.hypot(dx, cellKm);
        for (let x = 0; x < W; x++) {
          const i = y * W + x; let v = d[i];
          const l = y * W + (x - 1 + W) % W; if (d[l] + dx < v) v = d[l] + dx;
          if (y > 0) { const u = i - W; if (d[u] + cellKm < v) v = d[u] + cellKm; const ul = (y - 1) * W + (x - 1 + W) % W, ur = (y - 1) * W + (x + 1) % W; if (d[ul] + dg < v) v = d[ul] + dg; if (d[ur] + dg < v) v = d[ur] + dg; }
          d[i] = v;
        }
      }
      for (let y = H - 1; y >= 0; y--) {
        const dx = cellKm * Math.max(0.05, cosLat[y]), dg = Math.hypot(dx, cellKm);
        for (let x = W - 1; x >= 0; x--) {
          const i = y * W + x; let v = d[i];
          const r = y * W + (x + 1) % W; if (d[r] + dx < v) v = d[r] + dx;
          if (y < H - 1) { const u = i + W; if (d[u] + cellKm < v) v = d[u] + cellKm; const dl = (y + 1) * W + (x - 1 + W) % W, dr = (y + 1) * W + (x + 1) % W; if (d[dl] + dg < v) v = d[dl] + dg; if (d[dr] + dg < v) v = d[dr] + dg; }
          d[i] = v;
        }
      }
    }
    return d;
  }

  function blur(a, W, H, r, passes) {
    let src = Float32Array.from(a), tmp = new Float32Array(a.length);
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < H; y++) {
        let acc = 0; const o = y * W;
        for (let k = -r; k <= r; k++) acc += src[o + (k + W) % W];
        for (let x = 0; x < W; x++) { tmp[o + x] = acc / (2 * r + 1); acc += src[o + (x + r + 1) % W] - src[o + (x - r + W) % W]; }
      }
      for (let x = 0; x < W; x++) {
        let acc = 0;
        for (let k = -r; k <= r; k++) acc += tmp[Math.min(H - 1, Math.max(0, k)) * W + x];
        for (let y = 0; y < H; y++) { src[y * W + x] = acc / (2 * r + 1); acc += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x]; }
      }
    }
    return src;
  }

  function simulate(P, cfg, progress) {
    const { cW, cH, C } = P;
    const N = cW * cH, f = P.W / cW;
    const cellKm = 2 * Math.PI * cfg.radius / cW;
    const eC = P.downsample(P.elev, P.W, P.H, cW, cH, v => Math.max(v, -200));
    const landC = P.downsample(P.elev, P.W, P.H, cW, cH, v => v > 0 ? 1 : 0);
    const isLand = new Uint8Array(N);
    for (let i = 0; i < N; i++) isLand[i] = landC[i] >= 0.5 ? 1 : 0;
    const distOcean = chamfer(cW, cH, i => !isLand[i], cellKm, C.cosLat);
    const distLand = chamfer(cW, cH, i => isLand[i], cellKm, C.cosLat);
    const retro = cfg.retro ? -1 : 1;
    const tilt = cfg.tilt, S0 = cfg.flux;
    const decl = [0, tilt, 0, -tilt], prev = [3, 0, 1, 2];
    const ring = cfg.moons === 'ring';

    // 日照（逐行）
    const Q = [0, 1, 2, 3].map(() => new Float32Array(cH));
    const Qann = new Float32Array(cH);
    for (let y = 0; y < cH; y++) {
      const la = C.lat[y];
      let s = 0;
      for (let k = 0; k < 4; k++) {
        let q = insolation(la, decl[k], S0);
        if (ring && decl[k] !== 0 && Math.sign(la) === -Math.sign(decl[k]) && Math.abs(la) > 6 && Math.abs(la) < 34) q *= 0.72;
        Q[k][y] = q; s += q;
      }
      // 季节采样 4 点会低估年均，做一点校正（用 12 点）
      let s12 = 0; for (let m = 0; m < 12; m++) s12 += insolation(la, tilt * Math.sin(m / 12 * 2 * Math.PI), S0);
      Qann[y] = s12 / 12; void s;
    }

    // 洋流导致的海温异常（°C）：西边界暖流 / 东边界寒流（逆行自转则相反）
    const westD = new Float32Array(N), eastD = new Float32Array(N);
    for (let y = 0; y < cH; y++) {
      const o = y * cW;
      let last = -1e9;
      for (let rep = 0; rep < 2; rep++) for (let x = 0; x < cW; x++) { const i = o + x; if (isLand[i]) last = x + rep * cW; else if (rep === 1) westD[i] = Math.min(999, x + cW - last); else westD[i] = Math.min(999, x - last); }
      last = 1e9;
      for (let rep = 0; rep < 2; rep++) for (let x = cW - 1; x >= 0; x--) { const i = o + x; if (isLand[i]) last = x - rep * cW; else if (rep === 1) eastD[i] = Math.min(999, last + cW - x); else eastD[i] = Math.min(999, last - x); }
    }
    const anomaly = new Float32Array(N);
    const curU = new Float32Array(N), curV = new Float32Array(N);
    for (let y = 0; y < cH; y++) {
      const la = C.lat[y], al = Math.abs(la), hs = la >= 0 ? 1 : -1;
      const subT = Math.exp(-Math.pow((al - 30) / 13, 2)), subP = Math.exp(-Math.pow((al - 56) / 9, 2));
      for (let x = 0; x < cW; x++) {
        const i = y * cW + x; if (isLand[i]) continue;
        let wb = Math.exp(-westD[i] / 7), eb = Math.exp(-eastD[i] / 7);
        if (retro < 0) { const t = wb; wb = eb; eb = t; }
        // 西边界：副热带暖流向极，副极地寒流向赤道；东边界相反
        anomaly[i] = wb * (4.5 * subT - 3.5 * subP) + eb * (-4 * subT + 3.5 * subP);
        const pole = hs; // 向极方向（北为 +）
        curV[i] = (wb * (subT - 0.8 * subP) - eb * (subT - 0.8 * subP)) * pole;
        // 大洋内部：随风生环流
        curU[i] = retro * (al < 25 ? -0.6 : al < 55 ? 0.6 : -0.3) * (1 - Math.max(wb, eb));
      }
    }
    // 向陆地扩散（衰减）
    let anomL = Float32Array.from(anomaly);
    for (let it = 0; it < 10; it++) {
      const nx = Float32Array.from(anomL);
      for (let y = 1; y < cH - 1; y++) for (let x = 0; x < cW; x++) {
        const i = y * cW + x; if (!isLand[i]) continue;
        nx[i] = 0.86 * (anomL[y * cW + (x + 1) % cW] + anomL[y * cW + (x - 1 + cW) % cW] + anomL[i - cW] + anomL[i + cW]) / 4;
      }
      anomL = nx;
    }

    // 环流带宽度由自转周期决定
    const hE = Math.max(18, Math.min(42, 30 + (cfg.day - 26) * 4 / 6)), fE = Math.max(44, Math.min(74, 60 + (cfg.day - 26)));
    const T0 = [], Ps = [], U = [], V = [], Pr = [];
    const T0ann = new Float32Array(N);
    const contin = new Float32Array(N);
    for (let i = 0; i < N; i++) contin[i] = isLand[i] ? Math.min(1, distOcean[i] / 1800) : 0;

    for (let s = 0; s < 4; s++) {
      progress('四季气候 · ' + SEASONS[s], 0.55 + s * 0.05);
      const T = new Float32Array(N);
      for (let y = 0; y < cH; y++) {
        const xq = Math.max(-0.3, (417 * S0 / 1361 - Qann[y]) / 244), ta = 27 + (S0 / 1361 - 1) * 80 - 50 * Math.sign(xq) * Math.pow(Math.abs(xq), 1.5) + cfg.tempBias;
        const qL = 0.62 * Q[s][y] + 0.38 * Q[prev[s]][y], qO = 0.35 * Q[s][y] + 0.65 * Q[prev[s]][y];
        for (let x = 0; x < cW; x++) {
          const i = y * cW + x;
          let t;
          if (isLand[i]) { const k = 0.33 + 0.42 * contin[i]; t = ta + k * 0.213 * (qL - Qann[y]) + anomL[i]; }
          else { t = ta + 0.17 * 0.213 * (qO - Qann[y]) + anomaly[i]; t = Math.max(t, -2); }
          if (ta < -12) t -= 2.5; // 冰雪反照率
          T[i] = t;
          if (s === 0) T0ann[i] = 0;
          T0ann[i] += t / 4;
        }
      }
      T0.push(T);

      // 气压：纬向带 + 热力异常（陆地夏低冬高 → 季风）
      const itcz = 0.45 * decl[s];
      const rowMean = new Float32Array(cH);
      for (let y = 0; y < cH; y++) { let a = 0; for (let x = 0; x < cW; x++) a += T[y * cW + x]; rowMean[y] = a / cW; }
      const th = new Float32Array(N);
      for (let i = 0; i < N; i++) { const y = (i / cW) | 0; th[i] = -0.75 * (T[i] - rowMean[y]); }
      const thB = blur(th, cW, cH, 5, 2);
      const Pp = new Float32Array(N);
      for (let y = 0; y < cH; y++) {
        const ph = C.lat[y] - itcz, ap = Math.abs(ph);
        const p0 = 1011 - 5 * Math.exp(-Math.pow(ph / 8, 2)) + 10 * Math.exp(-Math.pow((ap - hE) / 9, 2)) - 11 * Math.exp(-Math.pow((ap - fE) / 9, 2)) + 9 * Math.exp(-Math.pow((ap - 90) / 14, 2));
        for (let x = 0; x < cW; x++) Pp[y * cW + x] = p0 + thB[y * cW + x];
      }
      Pr.push(Pp);
      // 风：三圈环流 + 气压梯度风（科氏偏转）
      const u = new Float32Array(N), v = new Float32Array(N);
      for (let y = 0; y < cH; y++) {
        const ph = C.lat[y] - itcz, ap = Math.abs(ph), sg = ph >= 0 ? 1 : -1;
        let u0, v0;
        if (ap < hE) { const t = ap / hE; u0 = -6 * (0.5 + 0.5 * Math.sin(Math.PI * t)); v0 = -sg * 3.2 * Math.sin(Math.PI * t); }
        else if (ap < fE) { const t = (ap - hE) / (fE - hE); u0 = 9 * Math.sin(Math.PI * t); v0 = sg * 1.6 * Math.sin(Math.PI * t); }
        else { const t = (ap - fE) / (90 - fE); u0 = -4 * Math.sin(Math.PI * t); v0 = -sg * 1.5 * Math.sin(Math.PI * t); }
        u0 *= retro;
        const dxKm = cellKm * Math.max(0.08, C.cosLat[y]);
        const hemi = C.lat[y] >= 0 ? 1 : -1, defl = -hemi * retro * 45 * D2R;
        const cd = Math.cos(defl), sd = Math.sin(defl);
        for (let x = 0; x < cW; x++) {
          const i = y * cW + x;
          const gx = (Pp[y * cW + (x + 1) % cW] - Pp[y * cW + (x - 1 + cW) % cW]) / (2 * dxKm);
          const gy = y > 0 && y < cH - 1 ? (Pp[i - cW] - Pp[i + cW]) / (2 * cellKm) : 0; // 北向
          let ax = -gx * 650, ay = -gy * 650;
          const rx = ax * cd - ay * sd, ry = ax * sd + ay * cd;
          u[i] = u0 + rx; v[i] = v0 + ry;
        }
      }
      U.push(u); V.push(v);

      // 降水：半拉格朗日水汽输送
      const M = new Float32Array(N), Mn = new Float32Array(N), rain = new Float32Array(N);
      const evap = new Float32Array(N), rateB = new Float32Array(N);
      for (let y = 0; y < cH; y++) {
        const ph = C.lat[y] - itcz;
        for (let x = 0; x < cW; x++) {
          const i = y * cW + x;
          evap[i] = isLand[i] ? 0 : Math.max(0.03, Math.min(1.15, (T[i] + 4) / 31)) * cfg.moisture;
          let r = 0.02 + 0.13 * Math.exp(-Math.pow(ph / 7, 2)) + 0.0045 * Math.max(0, 1011 - Pp[i]);
          r *= Math.max(0.22, Math.min(1, 1 - Math.max(0, Pp[i] - 1014) * 0.06));
          if (isLand[i] && T[i] > 12) r += 0.03 * Math.min(1, (T[i] - 12) / 14); // 夏季对流
          if (T[i] < -10) r *= 0.6;
          rateB[i] = r;
          M[i] = evap[i];
        }
      }
      const tau = 16000; // 秒/步
      const IT = 44;
      for (let it = 0; it < IT; it++) {
        for (let y = 0; y < cH; y++) {
          const kx = tau / (cellKm * 1000 * Math.max(0.08, C.cosLat[y])), ky = tau / (cellKm * 1000);
          for (let x = 0; x < cW; x++) {
            const i = y * cW + x;
            let sx = x - u[i] * kx, sy = y + v[i] * ky;
            if (sy < 0) sy = 0; else if (sy > cH - 1.001) sy = cH - 1.001;
            const x0 = Math.floor(sx), tx = sx - x0, y0 = sy | 0, ty = sy - y0;
            const xa = (x0 % cW + cW) % cW, xb = (xa + 1) % cW, r0 = y0 * cW, r1 = Math.min(cH - 1, y0 + 1) * cW;
            const mu = (M[r0 + xa] * (1 - tx) + M[r0 + xb] * tx) * (1 - ty) + (M[r1 + xa] * (1 - tx) + M[r1 + xb] * tx) * ty;
            const eu = (eC[r0 + xa] * (1 - tx) + eC[r0 + xb] * tx) * (1 - ty) + (eC[r1 + xa] * (1 - tx) + eC[r1 + xb] * tx) * ty;
            let r = rateB[i] + Math.max(0, eC[i] - Math.max(0, eu)) * 0.00042;
            if (r > 0.65) r = 0.65;
            let rn, m;
            if (isLand[i]) { rn = mu * r; m = mu - rn + rn * (T[i] > 5 ? 0.6 : 0.25); }
            else { rn = mu * r * 0.55; m = mu - rn; m += (evap[i] - m) * 0.22; }
            Mn[i] = m; rain[i] = rn;
          }
        }
        // 涡动扩散：让水汽也能慢慢渗入大陆内部
        for (let y = 1; y < cH - 1; y++) for (let x = 0; x < cW; x++) {
          const i = y * cW + x;
          M[i] = Mn[i] * 0.8 + 0.05 * (Mn[y * cW + (x + 1) % cW] + Mn[y * cW + (x - 1 + cW) % cW] + Mn[i - cW] + Mn[i + cW]);
        }
      }
      const pr = new Float32Array(N);
      for (let i = 0; i < N; i++) { let p = rain[i] * 8600; if (p > 900) p = 900 + (p - 900) * 0.4; pr[i] = p; }
      Ps.push(blur(pr, cW, cH, 1, 1));
    }

    return { cW, cH, f, cellKm, T0, T0ann, Ps, U, V, Pr, isLand, distOcean, distLand, anomaly, curU, curV, decl, hE, fE };
  }

  // ---------- 全分辨率派生量 ----------
  const KOPPEN = [
    ['Af', '热带雨林气候', '#2f5fd6'], ['Am', '热带季风气候', '#3d8bf0'], ['Aw', '热带草原气候', '#74b8f4'],
    ['BWh', '热带沙漠气候', '#e8584c'], ['BWk', '温带沙漠气候', '#f2a39a'], ['BSh', '热带半干旱气候', '#eab04a'], ['BSk', '温带半干旱气候', '#f4d77a'],
    ['Csa', '地中海气候（炎夏）', '#e8e04a'], ['Csb', '地中海气候（温夏）', '#c8c45a'],
    ['Cwa', '亚热带季风气候', '#93db8a'], ['Cwb', '高原季风气候', '#6cbf6a'],
    ['Cfa', '亚热带湿润气候', '#bfe36a'], ['Cfb', '温带海洋性气候', '#7fd45a'], ['Cfc', '亚寒带海洋性气候', '#4cb04a'],
    ['Ds', '夏干大陆性气候', '#d878d8'], ['Dw', '冬干大陆性气候', '#a9b0f0'],
    ['Dfa', '温带大陆性气候（炎夏）', '#53d6d6'], ['Dfb', '温带大陆性气候（温夏）', '#58b8e8'],
    ['Dfc', '亚寒带针叶林气候', '#2f8d8c'], ['Dfd', '极寒亚寒带气候', '#2b5d6e'],
    ['ET', '苔原气候', '#b4b8bc'], ['EF', '冰原气候', '#8a8f96']
  ];
  const BIOMES = [
    ['冰盖', '#eef3f6'], ['苔原', '#bfc6b4'], ['北方针叶林', '#5f8f6e'], ['温带草原', '#c9d38c'], ['温带落叶林', '#7fb069'],
    ['温带雨林', '#3f8f6a'], ['地中海灌丛', '#b9b96a'], ['温带荒漠', '#dccb9a'], ['热带荒漠', '#ecd29a'], ['稀树草原', '#d6c66c'],
    ['热带季雨林', '#8cbf5a'], ['热带雨林', '#3f9a4c'], ['高山草甸与裸岩', '#b3a79a']
  ];

  function derive(P, K, cfg, progress) {
    const W = P.W, H = P.H, N = W * H, cW = K.cW, cH = K.cH;
    progress('气候分类', 0.76);
    const up = a => P.upsample(a, cW, cH, W, H);
    const Ts = K.T0.map(up), Ps = K.Ps.map(up);
    const Tann = new Float32Array(N), Pann = new Float32Array(N);
    const koppen = new Uint8Array(N), biome = new Uint8Array(N), snow = new Uint8Array(N), frost = new Uint8Array(N), veg = new Uint8Array(N);
    const e = P.elev;
    const north = 1; // 夏至为北半球夏季
    const sn2 = G.Noise.simplex2(cfg.seed + 818);
    for (let y = 0; y < H; y++) {
      const nh = (90 - (y + 0.5) / H * 180) >= 0;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, h = e[i], land = h > 0;
        const lapse = land ? 0.0065 * h : 0;
        const t0 = Ts[0][i] - lapse, t1 = Ts[1][i] - lapse, t2 = Ts[2][i] - lapse, t3 = Ts[3][i] - lapse;
        const ta = (t0 + t1 + t2 + t3) / 4;
        const p0 = Ps[0][i], p1 = Ps[1][i], p2 = Ps[2][i], p3 = Ps[3][i];
        const pa = p0 + p1 + p2 + p3;
        Tann[i] = ta; Pann[i] = pa;
        const sumT = nh ? t1 : t3, winT = nh ? t3 : t1, sumP = nh ? p1 : p3, winP = nh ? p3 : p1;
        const tmax = Math.max(t0, t1, t2, t3) + 1.8, tmin = Math.min(t0, t1, t2, t3) - 1.8;
        if (!land) {
          const nz = sn2(x * 0.02, y * 0.02) * 3.5 + sn2(x * 0.07, y * 0.07) * 1.5;
          snow[i] = ta + nz < -9 ? 4 : winT + nz < -1.5 ? 3 : 0;
          koppen[i] = 255; biome[i] = 255;
          continue;
        }
        // 柯本
        let k;
        const summerShare = (sumP + (p0 + p2) * 0.5) / Math.max(1, pa);
        const pth = 20 * ta + (summerShare >= 0.7 ? 280 : summerShare >= 0.3 ? 140 : 0);
        const pMinM = Math.min(p0, p1, p2, p3) / 3;
        const sumDryM = sumP / 3, winDryM = winP / 3, sumWetM = sumP / 3, winWetM = winP / 3;
        if (tmax < 10) k = tmax < 0 ? 21 : 20;
        else if (pa < pth) k = pa < pth / 2 ? (ta >= 18 ? 3 : 4) : (ta >= 18 ? 5 : 6);
        else if (tmin >= 18) k = pMinM >= 60 ? 0 : pMinM >= 100 - pa / 25 ? 1 : 2;
        else {
          const cold = tmin <= -3;
          const s = sumDryM < 40 && sumDryM < winWetM / 3, w = winDryM * 10 < sumWetM;
          const warmS = [t0, t1, t2, t3].filter(t => t >= 10).length;
          if (!cold) {
            if (s) k = tmax >= 22 ? 7 : 8;
            else if (w) k = tmax >= 22 ? 9 : 10;
            else k = tmax >= 22 ? 11 : warmS >= 2 ? 12 : 13;
          } else {
            if (s) k = 14; else if (w) k = 15;
            else k = tmin < -38 ? 19 : tmax >= 22 ? 16 : warmS >= 2 ? 17 : 18;
          }
        }
        koppen[i] = k;
        // 积雪/冰川
        const nz2 = sn2(x * 0.03, y * 0.03) * 2 + sn2(x * 0.11, y * 0.11) * 1;
        snow[i] = tmax + nz2 * 0.5 < 0.5 ? 2 : winT + nz2 < -2 ? 1 : 0;
        frost[i] = ta + nz2 < -8 ? 2 : ta + nz2 < -2 ? 1 : 0;
        // 群系
        let b;
        if (snow[i] === 2) b = 0;
        else if (h > 3300 || (h > 2200 && tmax < 12)) b = 12;
        else if (k >= 20) b = 1;
        else if (k >= 3 && k <= 6) b = k === 3 ? 8 : k === 4 ? 7 : k === 5 ? 9 : 3;
        else if (k === 18 || k === 19 || ta < 2) b = 2;
        else if (k === 7 || k === 8) b = 6;
        else if (k === 0) b = 11; else if (k === 1) b = 10; else if (k === 2) b = 9;
        else b = pa > 2300 && ta < 18 ? 5 : pa > 650 ? 4 : 3;
        biome[i] = b;
        // 植被（Miami NPP）
        const nT = 3000 / (1 + Math.exp(1.315 - 0.119 * ta)), nP = 3000 * (1 - Math.exp(-0.000664 * pa));
        veg[i] = snow[i] === 2 ? 0 : Math.min(255, Math.min(nT, nP) / 2600 * 255);
      }
      if ((y & 127) === 0) progress('气候分类', 0.76 + 0.04 * y / H);
    }
    void north;
    return { Tann, Pann, koppen, biome, snow, frost, veg, Ts, Ps };
  }

  G.Climate = { simulate, derive, KOPPEN, BIOMES, SEASONS, blur };
})(typeof self !== 'undefined' ? self : this);
