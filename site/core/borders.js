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

  G.Borders = { run, refine, anchors };
})(typeof self !== 'undefined' ? self : this);
