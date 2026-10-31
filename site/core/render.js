/* 视口栅格渲染：按屏幕分辨率逐像素采样世界场，缩放时叠加分形细节，保证放大不糊。 */
(function (G) {
  'use strict';
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  function lut(stops, lo, hi, n = 256) {
    const s = stops.map(([v, c]) => [v, hex(c)]), out = new Uint8Array(n * 3);
    for (let k = 0; k < n; k++) {
      const v = lo + (hi - lo) * k / (n - 1);
      let c = s[s.length - 1][1];
      if (v <= s[0][0]) c = s[0][1];
      else for (let j = 1; j < s.length; j++) if (v <= s[j][0]) { const t = (v - s[j - 1][0]) / (s[j][0] - s[j - 1][0]); c = s[j - 1][1].map((a, m) => a + (s[j][1][m] - a) * t); break; }
      out[k * 3] = c[0]; out[k * 3 + 1] = c[1]; out[k * 3 + 2] = c[2];
    }
    return { out, lo, hi, n };
  }
  const RAMPS = {
    land: lut([[0, '#a9d18a'], [150, '#bcd98f'], [450, '#dfe29c'], [900, '#efd796'], [1500, '#e6b878'], [2200, '#d09062'], [3000, '#ae7452'], [3900, '#94705e'], [4800, '#d9d2cc'], [5600, '#f7f5f2']], 0, 6000),
    sea: lut([[-7000, '#86bcdc'], [-4500, '#93c6e2'], [-2500, '#a6d2ea'], [-900, '#b9ddee'], [-180, '#cbe7f3'], [0, '#d7eef6']], -7000, 0),
    agri: lut([[0, '#f3eedf'], [0.2, '#eadb9c'], [0.45, '#b9d27c'], [0.7, '#6fb35f'], [1, '#2f7d45']], 0, 1),
    habit: lut([[0, '#f2ece4'], [0.2, '#f1c98c'], [0.45, '#e8e08a'], [0.7, '#8fcf86'], [1, '#2f9a7a']], 0, 1),
    veg: lut([[0, '#f1e9d2'], [0.25, '#dccf92'], [0.5, '#9ccc6e'], [0.75, '#5aa85a'], [1, '#2d7a46']], 0, 1),
    pop: lut([[0, '#f6f1e8'], [0.3, '#f4dfb4'], [1, '#f2b46a'], [1.6, '#e07a46'], [2.1, '#b8403c'], [2.7, '#6e1d3c']], 0, 2.7),
    sprecip: lut([[0, '#f3e6c4'], [40, '#ece0a4'], [120, '#c4df9c'], [260, '#7cc8ae'], [500, '#4c9ad4'], [900, '#3561bd'], [1500, '#2b3f93']], 0, 1500),
    stemp: lut([[-45, '#323a8f'], [-25, '#5774cc'], [-8, '#9fc4ec'], [3, '#d8ecf2'], [12, '#f4f1c6'], [20, '#f6cd82'], [28, '#ec8d55'], [36, '#c9433d'], [44, '#8a1b35']], -45, 44)
  };
  // ---------- 地图风格（栅格部分）：分层设色、海色、湖色、海岸线色、晕渲强度、后期色调 ----------
  const STYLES = {
    default: {},
    antique: { land: lut([[0, '#e9dcb6'], [300, '#e2cf9f'], [900, '#d6b783'], [1800, '#c39a68'], [3000, '#a87e58'], [4500, '#c9b79b'], [5600, '#efe6d4']], 0, 6000),
      sea: lut([[-7000, '#a9b9ac'], [-3000, '#bcc8b7'], [-600, '#cdd5c1'], [0, '#dde0cb']], -7000, 0), lake: '#b9c7b6', coast: '#5a4026', shade: 0.75, bg: '#e8dcc0', post: 'paper' },
    modern: { land: lut([[0, '#e6eedc'], [400, '#e9ecdf'], [1200, '#ebe8dd'], [2500, '#e5e0d6'], [4000, '#ebe8e4'], [5600, '#fafafa']], 0, 6000),
      sea: lut([[-7000, '#9ccbe0'], [-2000, '#a8d4e6'], [0, '#b5dcec']], -7000, 0), lake: '#a8d4e6', coast: '#8fb6c8', shade: 0.38, bg: '#f2f3f0' },
    nautical: { land: lut([[0, '#f2e2ae'], [1000, '#ecd9a2'], [3000, '#e1cc96'], [5600, '#f4ecd8']], 0, 6000),
      sea: lut([[-7000, '#cfe3ee'], [-1000, '#dceaf2'], [-200, '#e8f2f6'], [-30, '#b9d9e8'], [0, '#a6cfe2']], -7000, 0), lake: '#b9d9e8', coast: '#2c2a26', shade: 0.4, bg: '#f4f0e4', post: 'bands' },
    blueprint: { land: lut([[0, '#2f6aa8'], [2000, '#3a76b4'], [5600, '#5a92c8']], 0, 6000), sea: lut([[-7000, '#0f2f5a'], [0, '#1a4478']], -7000, 0),
      lake: '#1a4478', coast: '#e8f2ff', shade: 0.9, bg: '#0f2f5a', post: 'blueprint' },
    ink: { land: lut([[0, '#ece7dc'], [600, '#d9d3c6'], [1800, '#b8b0a2'], [3500, '#8f877b'], [5600, '#e9e6e0']], 0, 6000),
      sea: lut([[-7000, '#e2e2dc'], [0, '#efeeea']], -7000, 0), lake: '#e4e3dd', coast: '#3b3732', shade: 1.15, bg: '#f2efe8', post: 'ink' },
    night: { land: lut([[0, '#2c3a2e'], [500, '#344030'], [1500, '#4a4535'], [3000, '#5a4e42'], [4500, '#6e6a66'], [5600, '#a7a7ab']], 0, 6000),
      sea: lut([[-7000, '#0b1422'], [-2000, '#0f1c2e'], [0, '#16283d']], -7000, 0), lake: '#16283d', coast: '#5e7d99', shade: 0.7, bg: '#0b1422', post: 'night' },
    // 政区图：陆地按国家平涂粉彩（相邻国错色），海洋浅青蓝分深浅带，几乎不晕渲
    political: { political: true, sea: lut([[-7000, '#9ccbe8'], [-3000, '#a9d4ee'], [-900, '#b6dcf1'], [-150, '#c4e4f4'], [0, '#cfe9f6']], -7000, 0),
      lake: '#a9d4ee', coast: '#5b8db3', shade: 0.06, bg: '#cfe9f6' }
  };
  function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  }
  function catPalette(n, s = 0.5, l = 0.74, seed = 0) {
    const out = new Uint8Array(Math.max(1, n) * 3);
    for (let k = 0; k < n; k++) {
      const h = (k * 137.508 + seed * 53) % 360, ll = l + ((k * 7) % 3 - 1) * 0.04, c = hsl(h, s, ll);
      out[k * 3] = c[0]; out[k * 3 + 1] = c[1]; out[k * 3 + 2] = c[2];
    }
    return out;
  }

  function create(world) {
    const { P, Cl, K, Hy, Cv } = world;
    const W = P.W, H = P.H, cW = P.cW, cH = P.cH, vW = Cv.W, vH = Cv.H;
    const elev = P.elev;
    const n2 = G.Noise.simplex2(world.cfg.seed + 4242), j2 = G.Noise.simplex2(world.cfg.seed + 4343);
    const KC = Uint8Array.from(G.Climate.KOPPEN.flatMap(k => hex(k[2]).map(v => Math.round(v * 0.8 + 255 * 0.2))));
    const BC = Uint8Array.from(G.Climate.BIOMES.flatMap(b => hex(b[1])));
    const pal = {
      country: catPalette(Cv.countries.length, 0.55, 0.72, 1), province: catPalette(Cv.provinces.length, 0.45, 0.76, 2),
      culture: catPalette(Cv.cultures.length, 0.5, 0.72, 3), language: catPalette(Cv.languages.length, 0.48, 0.74, 4),
      religion: catPalette(Cv.religions.length, 0.5, 0.73, 5), plate: catPalette(P.plates.length, 0.4, 0.78, 6),
      basin: catPalette(Hy.basinCount + 1, 0.45, 0.76, 7)
    };
    // 国家配色：按邻接关系贪心着色，相邻国家色相明显不同
    { const nK = Cv.countries.length, adj = Array.from({ length: nK }, () => new Set()), CK = Cv.country;
      for (let y = 0; y < vH; y++) for (let x = 0; x < vW; x++) { const i = y * vW + x, a = CK[i]; if (a < 0) continue; for (const j of [y * vW + (x + 1) % vW, y + 1 < vH ? i + vW : -1, y + 2 < vH ? i + 2 * vW : -1, y * vW + (x + 2) % vW]) { if (j < 0) continue; const b = CK[j]; if (b >= 0 && b !== a) { adj[a].add(b); adj[b].add(a); } } }
      const HUES = [8, 32, 52, 88, 128, 160, 188, 212, 238, 268, 292, 320], LIT = [0.74, 0.68, 0.79], col = new Int16Array(nK).fill(-1), ord = [...Array(nK).keys()].sort((a, b) => adj[b].size - adj[a].size);
      for (const k of ord) { const used = new Set(); for (const o of adj[k]) if (col[o] >= 0) { used.add(col[o] % 12); }
        let best = -1; for (let t = 0; t < 36; t++) { const h = (k * 5 + t) % 12; if (!used.has(h)) { best = h + 12 * ((k + t) % 3); break; } } if (best < 0) best = k % 36; col[k] = best;
        const c = hsl(HUES[best % 12] + ((k * 37) % 9) - 4, 0.5, LIT[(best / 12) | 0]); pal.country[k * 3] = c[0]; pal.country[k * 3 + 1] = c[1]; pal.country[k * 3 + 2] = c[2]; }
      // 政区图配色：学校地图集式粉彩（奶黄、浅粉、淡紫、薄荷、蜜桃……），按邻接贪心着色，相邻国必不同色
      const ATLAS = ['#f8efa2', '#f7c8d8', '#dacfee', '#cde8b6', '#fbd5b0', '#fde2a2', '#e3e9a6', '#f2d3ea', '#c6e3d6', '#f5dcc4'].map(hex), nA = ATLAS.length, ac = new Int8Array(nK).fill(-1);
      pal.atlas = new Uint8Array(Math.max(1, nK) * 3);
      for (const k of ord) { const used = new Set(); for (const o of adj[k]) if (ac[o] >= 0) used.add(ac[o]); let best = -1; for (let t = 0; t < nA; t++) { const h = (k * 3 + t) % nA; if (!used.has(h)) { best = h; break; } } if (best < 0) best = k % nA; ac[k] = best;
        pal.atlas[k * 3] = ATLAS[best][0]; pal.atlas[k * 3 + 1] = ATLAS[best][1]; pal.atlas[k * 3 + 2] = ATLAS[best][2]; } }
    Cv.religions.forEach((f, i) => { if (f.color) for (let c = 0; c < 3; c++) pal.religion[i * 3 + c] = Math.round(f.color[c] * 0.6 + 255 * 0.4); }); // 宗教的象征色（来自宗教库），调淡作地图底色
    Cv.countries.forEach((k, i) => { if (k.color) { pal.country[i * 3] = k.color[0]; pal.country[i * 3 + 1] = k.color[1]; pal.country[i * 3 + 2] = k.color[2]; } }); // 现在的国家来自历史终局：沿用历史时间线里的配色
    // 行政制度：每个国家按制度类着色（行政制 / 封建制 / 游牧制……），同一制度的相邻国家靠国界区分
    pal.system = new Uint8Array(Math.max(1, Cv.countries.length) * 3);
    if (G.AdminSys) Cv.countries.forEach((k, i) => { const cl = G.AdminSys.classOfCountry(k), c = G.AdminSys.COL[cl], t = ((i * 2654435761) >>> 0) % 3, f = [0, 0.1, -0.08][t]; for (let j = 0; j < 3; j++) pal.system[i * 3 + j] = Math.max(0, Math.min(255, Math.round((c[j] * 0.62 + 255 * 0.38) * (1 + f)))); k.sys = cl; });
    const provCountry = Int16Array.from(Cv.provinces.map(p => p.country));
    // 省份配色：同一国家的省用该国色相的深浅与微小色相偏移，相邻省按贪心着色错开
    { const nP = Cv.provinces.length, adj = Array.from({ length: nP }, () => new Set()), PV = Cv.province;
      for (let y = 0; y < vH; y++) for (let x = 0; x < vW; x++) { const i = y * vW + x, a = PV[i]; if (a < 0) continue; const r = PV[y * vW + (x + 1) % vW], d = y + 1 < vH ? PV[i + vW] : -1; if (r >= 0 && r !== a) { adj[a].add(r); adj[r].add(a); } if (d >= 0 && d !== a) { adj[a].add(d); adj[d].add(a); } }
      const SH = [[0, 0, 0], [0.075, -7, -0.06], [-0.07, 6, 0.04], [0.13, 10, -0.1], [-0.12, -10, 0.06], [0.035, 15, 0.08], [-0.035, -15, -0.08]];
      const shade = new Int8Array(nP).fill(-1), ord = [...Array(nP).keys()].sort((a, b) => adj[b].size - adj[a].size);
      for (const p of ord) { const used = new Set(); for (const o of adj[p]) if (provCountry[o] === provCountry[p] && shade[o] >= 0) used.add(shade[o]); let k = 0; while (used.has(k) && k < SH.length - 1) k++; shade[p] = k; }
      const cH0 = Cv.countries.map((c, k) => { const r = pal.country[k * 3] / 255, g = pal.country[k * 3 + 1] / 255, b = pal.country[k * 3 + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
        let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, d ? d / (1 - Math.abs(2 * l - 1)) : 0, l]; });
      for (let p = 0; p < nP; p++) { const c = cH0[provCountry[p]] || [0, 0, 0.8], v = SH[shade[p]], col = hsl((c[0] + v[1] + 360) % 360, Math.max(0.15, Math.min(0.8, c[1] + v[2])), Math.max(0.5, Math.min(0.88, c[2] + v[0]))); pal.province[p * 3] = col[0]; pal.province[p * 3 + 1] = col[1]; pal.province[p * 3 + 2] = col[2]; } }
    const cellKm = 2 * Math.PI * world.cfg.radius / W; G.Noise.setCoastScale(cellKm);
    // 陆地等高线层（与 worker 中 23 层 hypsometry 相同：档界按平方递增，低地加密）
    const CLV = []; for (let k = 1; k <= 23; k++) CLV.push(Math.max(5, Math.round((P.maxE || 6000) * (k / 24) * (k / 24))));
    const TRIBAL = hex('#efe6d2'), WILD = hex('#f3efe6'), LAKE = hex('#a7d3ea'), COAST = hex('#3d5a73'), SEAFLAT = hex('#b9dcec'), LANDFLAT = hex('#e9e4d2');

    // 分类数据的颜色：四邻格按双线性权重混合 → 自然渐变（不出现方块）
    const SNOW_AMT = [0, 0.34, 0.86, 0.22, 0.8];
    const civCol = (topic, vi, out) => {
      let id = -1, arr = null;
      if (topic === 'country' || topic === 'govern' || topic === 'heritage') { id = Cv.country[vi]; arr = pal.country; }
      else if (topic === 'system') { id = Cv.country[vi]; arr = pal.system; }
      else if (topic === 'province') { id = Cv.province[vi]; arr = pal.province; }
      else if (topic === 'culture') { id = Cv.culture[vi]; arr = pal.culture; }
      else if (topic === 'language') { id = Cv.language[vi]; arr = pal.language; }
      else if (topic === 'religion') { id = Cv.religion[vi]; arr = pal.religion; }
      if (id >= 0 && (topic === 'culture' || topic === 'language') && (topic === 'culture' ? Cv.civInf : Cv.langInf)) { // 与实际治理同样的晕染：核心浓、外围淡
        const g = (topic === 'culture' ? Cv.civInf : Cv.langInf)[vi] / 255; out[0] = 246 + (arr[id * 3] - 246) * g; out[1] = 241 + (arr[id * 3 + 1] - 241) * g; out[2] = 230 + (arr[id * 3 + 2] - 230) * g; return; }
      if (id >= 0) { out[0] = arr[id * 3]; out[1] = arr[id * 3 + 1]; out[2] = arr[id * 3 + 2]; if (topic === 'govern') { const g = Cv.gov[vi] / 255; out[0] = 246 + (out[0] - 246) * g; out[1] = 241 + (out[1] - 241) * g; out[2] = 230 + (out[2] - 230) * g; } return; }
      const c = Cv.nominal[vi] >= 0 || Cv.country[vi] >= 0 ? TRIBAL : WILD; out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    };
    const tmpC = [0, 0, 0], acc = [0, 0, 0];
    // 国家 / 实际治理 / 省份：使用全分辨率细化疆界（与矢量国界、省界完全一致）
    const FULL = { country: 1, govern: 1, province: 1, heritage: 1, atlas: 1, system: 1 };
    const fullCol = (topic, f, out) => {
      const y = (f / W) | 0, x = f - y * W, vi = Math.min(vH - 1, y >> 1) * vW + Math.min(vW - 1, x >> 1);
      const k = Cv.countryF[f];
      if (k >= 0) {
        let arr = topic === 'atlas' ? pal.atlas : topic === 'system' ? pal.system : pal.country, id = k;
        if (topic === 'province') { const p = Cv.provinceF[f]; if (p >= 0) { arr = pal.province; id = p; } }
        out[0] = arr[id * 3]; out[1] = arr[id * 3 + 1]; out[2] = arr[id * 3 + 2];
        if (topic === 'govern') { const g = Cv.gov[vi] / 255; out[0] = 246 + (out[0] - 246) * g; out[1] = 241 + (out[1] - 241) * g; out[2] = 230 + (out[2] - 230) * g; }
        if (topic === 'heritage') { out[0] = 244 + (out[0] - 244) * 0.22; out[1] = 238 + (out[1] - 238) * 0.22; out[2] = 226 + (out[2] - 226) * 0.22; } // 遗迹地图：淡化的国家疆域作底
        return;
      }
      const c = k !== -4 && Cv.nominal[vi] >= 0 ? TRIBAL : WILD; out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    };
    // 文明 / 语言影响：核心浓、边缘淡，交界处两侧颜色相互渗透（与实际治理同样的渐变表达）
    function gradient(name, arr, gw, gh) {
      const id = name === 'culture' ? Cv.culture : Cv.language, N0 = gw * gh;
      // 到异族（或无主地）边界的距离 → 影响强度
      const dd = new Float32Array(N0).fill(1e9), qq = new Int32Array(N0); let h = 0, t = 0;
      for (let i = 0; i < N0; i++) { if (id[i] < 0) continue; const y = (i / gw) | 0, x = i - y * gw;
        const ns = [y > 0 ? i - gw : -1, y + 1 < gh ? i + gw : -1, y * gw + (x + 1) % gw, y * gw + (x - 1 + gw) % gw];
        if (ns.some(j => j >= 0 && Cv.land[j] && id[j] !== id[i])) { dd[i] = 0; qq[t++] = i; } }
      while (h < t) { const i = qq[h++], y = (i / gw) | 0, x = i - y * gw; for (const j of [y > 0 ? i - gw : -1, y + 1 < gh ? i + gw : -1, y * gw + (x + 1) % gw, y * gw + (x - 1 + gw) % gw]) if (j >= 0 && id[j] === id[i] && dd[j] > dd[i] + 1) { dd[j] = dd[i] + 1; qq[t++] = j; } }
      // 颜色渗透：只在陆地上做两次可分离盒滤波（半径 5 半格）
      let A = Float32Array.from(arr), Wt = new Float32Array(N0); for (let i = 0; i < N0; i++) Wt[i] = id[i] >= 0 ? 1 : 0;
      for (let i = 0; i < N0; i++) { A[i * 3] *= Wt[i]; A[i * 3 + 1] *= Wt[i]; A[i * 3 + 2] *= Wt[i]; }
      const R = 5;
      const pass = (S, ch, horiz) => { const O = new Float32Array(S.length);
        if (horiz) for (let y = 0; y < gh; y++) { for (let c = 0; c < ch; c++) { let acc2 = 0; for (let k = -R; k <= R; k++) acc2 += S[(y * gw + ((k % gw) + gw) % gw) * ch + c]; for (let x = 0; x < gw; x++) { O[(y * gw + x) * ch + c] = acc2; acc2 += S[(y * gw + (x + R + 1) % gw) * ch + c] - S[(y * gw + ((x - R) % gw + gw) % gw) * ch + c]; } } }
        else for (let x = 0; x < gw; x++) for (let c = 0; c < ch; c++) { for (let y = 0; y < gh; y++) { let acc2 = 0; for (let k = -R; k <= R; k++) { const yy = Math.min(gh - 1, Math.max(0, y + k)); acc2 += S[(yy * gw + x) * ch + c]; } O[(y * gw + x) * ch + c] = acc2; } }
        return O; };
      for (let it = 0; it < 2; it++) { A = pass(pass(A, 3, true), 3, false); Wt = pass(pass(Wt, 1, true), 1, false); }
      for (let i = 0; i < N0; i++) {
        if (id[i] < 0 || !Wt[i]) continue;
        const d = dd[i], core = Math.min(1, d / 9), mixB = 0.75 * (1 - Math.min(1, d / 5)); // 交界 5 格内渗透邻族颜色
        const br = A[i * 3] / Wt[i], bg = A[i * 3 + 1] / Wt[i], bb = A[i * 3 + 2] / Wt[i];
        let r = arr[i * 3] + (br - arr[i * 3]) * mixB, g = arr[i * 3 + 1] + (bg - arr[i * 3 + 1]) * mixB, b = arr[i * 3 + 2] + (bb - arr[i * 3 + 2]) * mixB;
        const fade = 0.42 * (1 - core); // 影响由核心向外减弱
        arr[i * 3] = r + (244 - r) * fade; arr[i * 3 + 1] = g + (240 - g) * fade; arr[i * 3 + 2] = b + (230 - b) * fade;
      }
    }
    // 预计算每格颜色表（RGB），渲染时只做无闭包的双线性混合
    const tables = new Map();
    function table(name) {
      if (tables.has(name)) return tables.get(name);
      let gw, gh, fn;
      if (name === 'koppen') { gw = W; gh = H; fn = kopAt; } else if (name === 'biome') { gw = W; gh = H; fn = bioAt; } else if (name === 'basin') { gw = W; gh = H; fn = basAt; }
      else if (name === 'plates') { gw = cW; gh = cH; fn = plateAt; }
      else if (FULL[name] && Cv.countryF) { gw = W; gh = H; fn = (f, o) => fullCol(name, f, o); }
      else { gw = vW; gh = vH; fn = (i, o) => civCol(name, i, o); }
      const arr = new Uint8Array(gw * gh * 3);
      for (let i = 0; i < gw * gh; i++) { fn(i, tmpC); arr[i * 3] = tmpC[0]; arr[i * 3 + 1] = tmpC[1]; arr[i * 3 + 2] = tmpC[2]; }

      const t = { arr, gw, gh };
      if (FULL[name] && Cv.countryF && gw === W) { // 标签：省份图按省，其余按国；无国家的陆地区分名义宣称与荒野
        const lab = new Int32Array(W * H);
        for (let f = 0; f < W * H; f++) { const k = Cv.countryF[f];
          if (k >= 0) { const p = Cv.provinceF[f]; lab[f] = name === 'province' ? (p >= 0 ? 1000000 + p : 2000000 + k) : k; }
          else if (k === -2) lab[f] = -2;
          else if (k === -4) lab[f] = -4;
          else { const vi = Math.min(vH - 1, ((f / W) | 0) >> 1) * vW + Math.min(vW - 1, (f % W) >> 1); lab[f] = Cv.nominal[vi] >= 0 ? -1 : -3; } }
        t.lab = lab; }
      tables.set(name, t); return t;
    }
    const wetF = Hy.wetSoft || null, deltaF = Hy.deltaSoft || null, plumeF = Hy.plume || null;
    const snowField = new Float32Array(W * H); for (let i = 0; i < W * H; i++) snowField[i] = SNOW_AMT[Cl.snow[i]] || 0;
    const frostField = Float32Array.from(Cl.frost);
    function bl3(t, gx, gy) {
      const gw = t.gw, gh = t.gh, A = t.arr;
      const fx = gx / W * gw - 0.5, fy = Math.min(gh - 1.001, Math.max(0, gy / H * gh - 0.5));
      const x0 = Math.floor(fx), y0 = fy | 0, tx = fx - x0, ty = fy - y0;
      const xa = ((x0 % gw) + gw) % gw, xb = xa + 1 === gw ? 0 : xa + 1, r0 = y0 * gw, r1 = (y0 + 1 < gh ? y0 + 1 : y0) * gw;
      const a = (r0 + xa) * 3, b = (r0 + xb) * 3, c = (r1 + xa) * 3, d = (r1 + xb) * 3;
      const w0 = (1 - tx) * (1 - ty), w1 = tx * (1 - ty), w2 = (1 - tx) * ty, w3 = tx * ty;
      acc[0] = A[a] * w0 + A[b] * w1 + A[c] * w2 + A[d] * w3; acc[1] = A[a + 1] * w0 + A[b + 1] * w1 + A[c + 1] * w2 + A[d + 1] * w3; acc[2] = A[a + 2] * w0 + A[b + 2] * w1 + A[c + 2] * w2 + A[d + 2] * w3;
      return acc;
    }
    // 国家 / 省份：硬边填色。四邻格中按双线性权重取“多数标签”的颜色——边界清晰、不在国与国之间混色，
    // 且边界位置与矢量界线（格边连线平滑）一致；同一标签内部（治理强度等）仍做平滑插值。
    // 国家 / 省份硬边填色：2×2 邻格按双线性权重取多数标签。其边界恰好经过格边中点，与矢量界线（格边中点连线）重合。
    const bsp = t => { const u = 1 - t; return [u * u * u / 6, (3 * t * t * t - 6 * t * t + 4) / 6, (-3 * t * t * t + 3 * t * t + 3 * t + 1) / 6, t * t * t / 6]; };
    const cIds = new Int32Array(16), cWt = new Float64Array(16);
    function crisp(t, gx, gy) {
      const fx = gx - 0.5, fy = Math.min(H - 1.001, Math.max(0, gy - 0.5)), x0 = Math.floor(fx), y0 = Math.floor(fy), wx = bsp(fx - x0), wy = bsp(fy - y0), L = t.lab, A = t.arr;
      for (let j = 0; j < 4; j++) { const yy = Math.min(H - 1, Math.max(0, y0 - 1 + j)); for (let k = 0; k < 4; k++) { const n = j * 4 + k; cIds[n] = yy * W + ((x0 - 1 + k) % W + W) % W; cWt[n] = wy[j] * wx[k]; } }
      let best = -9, bw = -1;
      for (let n = 0; n < 16; n++) { const lab = L[cIds[n]]; if (lab === -2 || lab === best) continue; let sw = 0; for (let m = 0; m < 16; m++) if (L[cIds[m]] === lab) sw += cWt[m]; if (sw > bw) { bw = sw; best = lab; } }
      if (best === -9) { acc[0] = WILD[0]; acc[1] = WILD[1]; acc[2] = WILD[2]; return acc; }
      let sr = 0, sg = 0, sb = 0, sw = 0;
      for (let n = 0; n < 16; n++) { const f = cIds[n]; if (L[f] !== best) continue; const o = f * 3; sr += A[o] * cWt[n]; sg += A[o + 1] * cWt[n]; sb += A[o + 2] * cWt[n]; sw += cWt[n]; }
      acc[0] = sr / sw; acc[1] = sg / sw; acc[2] = sb / sw; return acc;
    }
    // 在 (gx, gy) 处对“格 → 颜色”函数做双线性混合；gw/gh 为该数据网格尺寸
    function blend(gx, gy, gw, gh, colorAt) {
      const fx = gx / W * gw - 0.5, fy = Math.min(gh - 1.001, Math.max(0, gy / H * gh - 0.5));
      const x0 = Math.floor(fx), y0 = fy | 0, tx = fx - x0, ty = fy - y0;
      const xa = ((x0 % gw) + gw) % gw, xb = (xa + 1) % gw, ya = y0, yb = Math.min(gh - 1, y0 + 1);
      acc[0] = acc[1] = acc[2] = 0;
      colorAt(ya * gw + xa, tmpC); let w = (1 - tx) * (1 - ty); acc[0] += tmpC[0] * w; acc[1] += tmpC[1] * w; acc[2] += tmpC[2] * w;
      colorAt(ya * gw + xb, tmpC); w = tx * (1 - ty); acc[0] += tmpC[0] * w; acc[1] += tmpC[1] * w; acc[2] += tmpC[2] * w;
      colorAt(yb * gw + xa, tmpC); w = (1 - tx) * ty; acc[0] += tmpC[0] * w; acc[1] += tmpC[1] * w; acc[2] += tmpC[2] * w;
      colorAt(yb * gw + xb, tmpC); w = tx * ty; acc[0] += tmpC[0] * w; acc[1] += tmpC[1] * w; acc[2] += tmpC[2] * w;
      return acc;
    }
    function bilin(A, gx, gy, gw, gh) {
      const fx = gx / W * gw - 0.5, fy = Math.min(gh - 1.001, Math.max(0, gy / H * gh - 0.5));
      const x0 = Math.floor(fx), y0 = fy | 0, tx = fx - x0, ty = fy - y0, xa = ((x0 % gw) + gw) % gw, xb = (xa + 1) % gw, r0 = y0 * gw, r1 = Math.min(gh - 1, y0 + 1) * gw;
      return (A[r0 + xa] * (1 - tx) + A[r0 + xb] * tx) * (1 - ty) + (A[r1 + xa] * (1 - tx) + A[r1 + xb] * tx) * ty;
    }
    const kopAt = (i, o) => { let k = Cl.koppen[i]; if (k === 255) { o[0] = o[1] = o[2] = 222; return; } o[0] = KC[k * 3]; o[1] = KC[k * 3 + 1]; o[2] = KC[k * 3 + 2]; };
    const bioAt = (i, o) => { let k = Cl.biome[i]; if (k === 255) { o[0] = o[1] = o[2] = 222; return; } o[0] = BC[k * 3]; o[1] = BC[k * 3 + 1]; o[2] = BC[k * 3 + 2]; };
    const basAt = (i, o) => { const k = Hy.basinId[i]; if (!k || elev[i] <= 0) { o[0] = 236; o[1] = 232; o[2] = 222; return; } o[0] = pal.basin[k * 3]; o[1] = pal.basin[k * 3 + 1]; o[2] = pal.basin[k * 3 + 2]; };
    const plateAt = (i, o) => { const k = P.plate[i]; o[0] = pal.plate[k * 3]; o[1] = pal.plate[k * 3 + 1]; o[2] = pal.plate[k * 3 + 2]; };
    const snowAt = (i, o) => { o[0] = SNOW_AMT[Cl.snow[i]] || 0; o[1] = o[2] = 0; };

    const lakeMasks = {};
    // 海色用平滑后的水深：陆架浅色带渐变展开，不再沿格子走出锯齿
    const depthSoft = (() => { let A = Float32Array.from(elev, v => v < 0 ? v : -2); for (let it = 0; it < 3; it++) { const B = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s2 = 0, n = 0; for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { s2 += A[yy * W + ((x + dx) % W + W) % W]; n++; } } B[y * W + x] = s2 / n; } A = B; } return A; })();
    function stylePost(ST, r, g, b, land, X, Y) {
      const p = ST.post; if (!p) return;
      if (p === 'paper') { const n = n2(X * 0.9, Y * 0.9) * 0.5 + n2(X * 0.13, Y * 0.13) * 0.5, L = (r + g + b) / 3; r = r * 0.6 + (L * 1.05 + 18) * 0.4; g = g * 0.6 + (L * 0.95 + 8) * 0.4; b = b * 0.6 + (L * 0.75) * 0.4; const k = 1 + n * 0.05; acc[0] = r * k; acc[1] = g * k; acc[2] = b * k; return true; }
      if (p === 'ink') { const L = 0.3 * r + 0.59 * g + 0.11 * b, n = n2(X * 0.6, Y * 0.6) * 0.03; const v = L * (1 + n); acc[0] = v * 1.01 + 2; acc[1] = v; acc[2] = v * 0.96; return true; }
      if (p === 'blueprint') { const L = (0.3 * r + 0.59 * g + 0.11 * b) / 255; acc[0] = 18 + 70 * L; acc[1] = 52 + 110 * L; acc[2] = 98 + 140 * L; return true; }
      if (p === 'night') { acc[0] = r * 0.45 + 8; acc[1] = g * 0.45 + 14; acc[2] = b * 0.5 + 24; return true; }
      return false;
    }
    function render(req) {
      const pad = req.pad || 0, s = req.s, w = req.w + 2 * pad, h = req.h + 2 * pad, x0 = req.x0 - pad * s, y0 = req.y0 - pad * s;
      const { topic, season = 0, aux = {} } = req;
      const ST = STYLES[aux.style] || STYLES.default, LANDR = ST.land || RAMPS.land, SEAR = ST.sea || RAMPS.sea, LAKEC = ST.lake ? hex(ST.lake) : LAKE, COASTC = ST.coast ? hex(ST.coast) : COAST, SHK = ST.shade || 0.62, BG = ST.bg ? hex(ST.bg) : [236, 242, 245];
      const detail = s < 0.9;
      const octs = detail ? Math.min(5, Math.ceil(Math.log2(1 / s)) + 1) : 0;
      const eb = new Float32Array(w * h), er = new Float32Array(w * h), cs = new Float32Array(w * h), lb = new Float32Array(w * h);
      // 湖泊分级显示：全图只画大湖（≥ 40 格），区域级 ≥ 8 格，再放大全部
      const zr0 = W / (s * 1400), minLake = zr0 < 2.5 ? 40 : zr0 < 7 ? 8 : 0;
      const lakeVis = minLake ? (lakeMasks[minLake] || (lakeMasks[minLake] = Float32Array.from(Hy.lakeSoft, (v, i) => Hy.lake[i] && Hy.lakeSize[i] < minLake ? 0.3 : v))) : Hy.lakeSoft;
      const gyA = new Float32Array(h);
      // 1) 高程（双线性 + 缩放细节）与湖泊连续场
      for (let py = 0; py < h; py++) {
        const gy = y0 + (py + 0.5) * s; gyA[py] = gy;
        const sy = Math.min(H - 1.001, Math.max(0, gy - 0.5)), yi = sy | 0, ty = sy - yi, r0 = yi * W, r1 = Math.min(H - 1, yi + 1) * W;
        for (let px = 0; px < w; px++) {
          const gx = x0 + (px + 0.5) * s;
          let sx = gx - 0.5; sx = ((sx % W) + W) % W;
          const xi = sx | 0, tx = sx - xi, xj = xi + 1 === W ? 0 : xi + 1;
          let e = octs ? G.Noise.surfaceRaw(elev, W, H, gx, gy) : (elev[r0 + xi] * (1 - tx) + elev[r0 + xj] * tx) * (1 - ty) + (elev[r1 + xi] * (1 - tx) + elev[r1 + xj] * tx) * ty;
          const cv = octs ? G.Noise.coastSurface(elev, W, H, gx, gy) : e; cs[py * w + px] = cv; // 海陆判断
          if (octs) e = G.Noise.coastElev(e, cv, elev, W, H, gx, gy); // 近岸高程收口：海岸线处归零、向内沿岸坡平滑回升（不再按海陆硬裁）
          else if (cv > 0 && e <= 0) e = 0.5; else if (cv <= 0 && e > 0) e = -0.5;
          er[py * w + px] = e;
          if (octs) {
            const amp = (e > 0 ? 16 + Math.min(200, e * 0.04) : Math.min(60, 16 + (-e) * 0.02)) * (e > 0 ? (aux.detail || 1) : 1);
            let f = 0.9, a = amp, d = 0;
            for (let o = 0; o < octs; o++) { d += n2(gx * f, gy * f) * a; f *= 2.1; a *= 0.5; }
            // 细节只改变起伏，不改变海陆：近岸按 |高程| 收敛，海岸线与河口始终落在同一连续地表上
            e += d * Math.min(1, Math.abs(e) / (amp * 2.2));
            if (cv > 0 ? e < 0.5 : e > -0.5) e = cv > 0 ? 0.5 : -0.5;
          }
          const o = py * w + px; eb[o] = e;
          const L = lakeVis; const lv = octs ? G.Noise.surfaceRaw(L, W, H, gx, gy) : (L[r0 + xi] * (1 - tx) + L[r0 + xj] * tx) * (1 - ty) + (L[r1 + xi] * (1 - tx) + L[r1 + xj] * tx) * ty;
          lb[o] = lv > 0.02 ? lv : 0;
        }
      }
      const out = new Uint8ClampedArray(w * h * 4);
      const lx = -0.5, ly = -0.5, lz = 0.7071, Z = 12 * Math.pow(Math.min(1, Math.max(0.04, s)), 0.6) * (aux.relief || 1);
      const isHuman = { country: 1, province: 1, culture: 1, language: 1, religion: 1, govern: 1, heritage: 1, system: 1 }[topic];
      const zoomR = W / (s * 1400), lfOn = aux.landform !== false && zoomR >= 2.2 && topic !== 'plates' && !ST.political;
      const polT = ST.political && topic === 'terrain' && Cv.countryF ? table('atlas') : null; // 政区图：底图陆地改用国家粉彩
      // 原版地貌面状图式：8×8 短线纹（屏幕像素对齐，跨瓦片连续）
      const dash = (X, Y, k) => { const u = ((X % 10) + 10) % 10, v = ((Y % 10) + 10) % 10; return k === 0 ? ((v === 2 && u >= 1 && u <= 3) || (v === 6 && u >= 5 && u <= 8) || (v === 3 && u >= 2 && u <= 3)) : ((v === 2 && u >= 1 && u <= 4) || (v === 6 && u >= 5 && u <= 8)); };
      const jit = FULL[topic] && Cv.countryF ? 0 : 0.35, catTopic = isHuman || topic === 'koppen' || topic === 'biome' || topic === 'basin' || topic === 'plates', catT = catTopic ? table(topic) : null;
      for (let py = 0; py < h; py++) {
        const gy = gyA[py], inMap = gy >= 0 && gy < H;
        const latR = (90 - gy / H * 180) * Math.PI / 180, cl = Math.max(0.05, Math.cos(latR));
        const pxKmX = s * cellKm * cl, pxKmY = s * cellKm;
        for (let px = 0; px < w; px++) {
          const o = py * w + px, oo = o * 4;
          if (!inMap) { out[oo] = BG[0]; out[oo + 1] = BG[1]; out[oo + 2] = BG[2]; out[oo + 3] = 255; continue; }
          let gx = x0 + (px + 0.5) * s; gx = ((gx % W) + W) % W;
          const e = er[o], land = cs[o] > 0, isLake = land && aux.lakes !== false && lb[o] > 0.5;
          // 轻微扰动采样位置，使分类过渡更有机
          let jx = gx, jy = gy; if (catTopic) { jx = gx + j2(gx * 0.21, gy * 0.21) * jit * (W / vW); jy = gy + j2(gy * 0.21 + 50, gx * 0.21) * jit * (H / vH); }
          let r, g, b;
          if (land && !isLake) {
            if (polT) { const c = crisp(polT, gx, gy); r = c[0]; g = c[1]; b = c[2]; }
            else if (topic === 'terrain') {
              if (aux.elev !== false) { const k = Math.max(0, Math.min(255, (e / 6000 * 255) | 0)) * 3; r = LANDR.out[k]; g = LANDR.out[k + 1]; b = LANDR.out[k + 2]; }
              else { r = LANDFLAT[0]; g = LANDFLAT[1]; b = LANDFLAT[2]; }
            } else if (topic === 'koppen' || topic === 'biome' || topic === 'basin') {
              const c = bl3(catT, jx, jy); r = c[0]; g = c[1]; b = c[2];
            } else if (topic === 'plates') { const c = bl3(catT, jx, jy); r = c[0]; g = c[1]; b = c[2]; }
            else if (isHuman) { const c = FULL[topic] && Cv.countryF ? crisp(catT, gx, gy) : bl3(catT, jx, jy); r = c[0]; g = c[1]; b = c[2];
              if (aux.nominal && (topic === 'country' || topic === 'govern' || topic === 'province')) { const vi = Math.min(vH - 1, (jy / H * vH) | 0) * vW + (((jx / W * vW) | 0) + vW) % vW; const nom = Cv.nominal[vi]; if (Cv.country[vi] < 0 && nom >= 0 && (px + py) % 7 < 2) { r = r * 0.5 + pal.country[nom * 3] * 0.5; g = g * 0.5 + pal.country[nom * 3 + 1] * 0.5; b = b * 0.5 + pal.country[nom * 3 + 2] * 0.5; } } }
            else if (topic === 'agri' || topic === 'habit' || topic === 'pop' || topic === 'veg') {
              let v; const L = RAMPS[topic];
              if (topic === 'veg') v = bilin(Cl.veg, gx, gy, W, H) / 255;
              else { v = bilin(topic === 'agri' ? Cv.agri : topic === 'habit' ? Cv.hab : Cv.popDensity, gx, gy, vW, vH); if (topic === 'pop') v = Math.log10(1 + v); }
              const k = Math.max(0, Math.min(L.n - 1, ((v - L.lo) / (L.hi - L.lo) * (L.n - 1)) | 0)) * 3; r = L.out[k]; g = L.out[k + 1]; b = L.out[k + 2];
            } else if (topic === 'sprecip' || topic === 'stemp') {
              let v = bilin(topic === 'sprecip' ? K.Ps[season] : K.T0[season], gx, gy, cW, cH); if (topic === 'stemp') v -= 0.0065 * e;
              const L = RAMPS[topic]; const k = Math.max(0, Math.min(L.n - 1, ((v - L.lo) / (L.hi - L.lo) * (L.n - 1)) | 0)) * 3; r = L.out[k]; g = L.out[k + 1]; b = L.out[k + 2];
            } else { r = LANDFLAT[0]; g = LANDFLAT[1]; b = LANDFLAT[2]; }
            if (aux.elev !== false) {
              const xl = px > 0 ? eb[o - 1] : e, xr = px < w - 1 ? eb[o + 1] : e, yu = py > 0 ? eb[o - w] : e, yd = py < h - 1 ? eb[o + w] : e;
              const dzx = (Math.max(0, xr) - Math.max(0, xl)) / (2 * pxKmX * 1000) * Z, dzy = (Math.max(0, yd) - Math.max(0, yu)) / (2 * pxKmY * 1000) * Z;
              const nl = Math.sqrt(dzx * dzx + dzy * dzy + 1);
              let sh = ((-dzx) * lx + (-dzy) * ly + lz) / nl / lz;
              sh = 1 + (sh - 1) * (topic === 'terrain' ? SHK : 0.4 * SHK / 0.62); if (sh < 0.55) sh = 0.55; if (sh > 1.2) sh = 1.2;
              r *= sh; g *= sh; b *= sh;
            }
            // 地貌符号：湿地范围、三角洲平原（面状短线纹 + 极淡底色）
            if (lfOn) {
              const X = Math.floor((x0 + (px + 0.5) * s) / s), Y = Math.floor(gy / s);
              const wv = wetF ? bilin(wetF, gx, gy, W, H) : 0, dv = deltaF ? bilin(deltaF, gx, gy, W, H) : 0;
              if (dv > 0.42) { const a = Math.min(1, (dv - 0.42) * 6); r += (222 - r) * 0.3 * a; g += (210 - g) * 0.3 * a; b += (160 - b) * 0.3 * a; if (dash(X, Y, 1)) { const k = 0.62 * a; r += (154 - r) * k; g += (133 - g) * k; b += (86 - b) * k; } }
              else if (wv > 0.42) { const a = Math.min(1, (wv - 0.42) * 6); r += (150 - r) * 0.1 * a; g += (186 - g) * 0.1 * a; b += (170 - b) * 0.1 * a; if (dash(X, Y, 0)) { const k = 0.55 * a; r += (68 - r) * k; g += (125 - g) * k; b += (140 - b) * k; } }
            }
            if (aux.snow) {
              let amt;
              if (topic === 'stemp' || topic === 'sprecip') { const t = bilin(K.T0[season], gx, gy, cW, cH) - 0.0065 * e; amt = Math.max(bilin(Cl.snow, gx, gy, W, H) >= 1.5 ? 0.86 : 0, 0.34 * Math.min(1, Math.max(0, (-1 - t) / 4))); }
              else amt = bilin(snowField, gx, gy, W, H);
              if (amt > 0.01) { const a = Math.min(0.9, amt); r += (250 - r) * a; g += (252 - g) * a; b += (253 - b) * a; }
            }
            if (aux.frost) { const fr = bilin(frostField, gx, gy, W, H); if (fr > 0.3 && (px + py) % (fr > 1.4 ? 4 : 7) === 0) { r = r * 0.6 + 48; g = g * 0.6 + 44; b = b * 0.6 + 64; } }
          } else if (isLake) { r = LAKEC[0]; g = LAKEC[1]; b = LAKEC[2]; }
          else {
            if (topic === 'sprecip' || topic === 'stemp') {
              const v = bilin(topic === 'sprecip' ? K.Ps[season] : K.T0[season], gx, gy, cW, cH);
              const L = RAMPS[topic]; const k = Math.max(0, Math.min(L.n - 1, ((v - L.lo) / (L.hi - L.lo) * (L.n - 1)) | 0)) * 3;
              r = L.out[k] * 0.55 + 200 * 0.45; g = L.out[k + 1] * 0.55 + 224 * 0.45; b = L.out[k + 2] * 0.55 + 236 * 0.45;
            } else if (topic === 'plates') { const c = bl3(catT, jx, jy); r = c[0] * 0.75 + 42; g = c[1] * 0.75 + 51; b = c[2] * 0.75 + 57; }
            else if (aux.depth !== false) { let ee = Math.min(-1, bilin(depthSoft, gx, gy, W, H)); if (ST.post === 'bands') ee = e > -30 ? e : e > -200 ? -100 : e > -1000 ? -600 : -3000; const k = Math.max(0, Math.min(255, ((ee + 7000) / 7000 * 255) | 0)) * 3; r = SEAR.out[k]; g = SEAR.out[k + 1]; b = SEAR.out[k + 2]; }
            else { r = SEAFLAT[0]; g = SEAFLAT[1]; b = SEAFLAT[2]; }
            // （水下三角洲沉积前缘不在海面上画，避免像误画的地貌符号）
            if (aux.snow) {
              let amt;
              if (topic === 'stemp' || topic === 'sprecip') { const t = bilin(K.T0[season], gx, gy, cW, cH); amt = 0.4 * Math.min(1, Math.max(0, (-1.5 - t) / 3)); }
              else amt = bilin(snowField, gx, gy, W, H);
              if (amt > 0.01) { const a = Math.min(0.8, amt); r += (244 - r) * a; g += (249 - g) * a; b += (252 - b) * a; }
            }
          }
          if (ST.post && stylePost(ST, r, g, b, land, Math.floor((x0 + (px + 0.5) * s) / s), Math.floor(gy / s))) { r = acc[0]; g = acc[1]; b = acc[2]; }
          if (aux.gray && land) { const l = 0.3 * r + 0.59 * g + 0.11 * b, v = 78 + l * 0.72; r = v + 5; g = v + 3; b = v - 3; } // 历史时间线：陆地灰度（保留山体明暗），让历史着色突出
          out[oo] = r; out[oo + 1] = g; out[oo + 2] = b; out[oo + 3] = 255;
        }
      }
      // 2) 抗锯齿海岸线与湖岸线：按到等值线的像素距离着色
      if (aux.coast !== false) for (let py = 1; py < h - 1; py++) for (let px = 1; px < w - 1; px++) {
        const o = py * w + px, oo = o * 4, e = cs[o];
        const gxv = (cs[o + 1] - cs[o - 1]) * 0.5, gyv = (cs[o + w] - cs[o - w]) * 0.5, gm = Math.hypot(gxv, gyv);
        const cross = (e > 0) !== (cs[o + 1] > 0) || (e > 0) !== (cs[o - 1] > 0) || (e > 0) !== (cs[o + w] > 0) || (e > 0) !== (cs[o - w] > 0) || (e > 0) !== (cs[o + w + 1] > 0) || (e > 0) !== (cs[o - w - 1] > 0);
        if (cross && gm > 1e-6) { const d = Math.abs(e) / gm; if (d < 1.1) { const a = 0.9 * (1.1 - d) / 1.1; out[oo] += (COASTC[0] - out[oo]) * a; out[oo + 1] += (COASTC[1] - out[oo + 1]) * a; out[oo + 2] += (COASTC[2] - out[oo + 2]) * a; } }
        if (aux.lakes !== false && e > 0) { const l = lb[o] - 0.5, lg = Math.hypot((lb[o + 1] - lb[o - 1]) * 0.5, (lb[o + w] - lb[o - w]) * 0.5); if (lg > 1e-6) { const d = Math.abs(l) / lg; if (d < 1) { const a = 0.75 * (1 - d); out[oo] += (92 - out[oo]) * a; out[oo + 1] += (140 - out[oo + 1]) * a; out[oo + 2] += (176 - out[oo + 2]) * a; } } }
      }
      // 3) 陆地等高线：直接在设色所用的同一张连续地表（er，已与海岸线对齐、海岸线即 0 m 线）上逐像素描出，
      //    因而等高线与色带、晕渲、海岸线处处一致：沿海岸绕行、在半岛与海湾处自然折返，不会在岸边断开。
      if (aux.coast !== false && !ST.political) {
        const lv0 = W / (s * 1400) < 2.5, aR = lv0 ? 0.2 : 0.3, aI = lv0 ? 0.32 : 0.46, CC = [118, 105, 79], NL = CLV.length;
        for (let py = 1; py < h - 1; py++) for (let px = 1; px < w - 1; px++) {
          const o = py * w + px; if (!(cs[o] > 0)) continue; if (aux.lakes !== false && lb[o] > 0.5) continue;
          const E = er[o]; if (E < CLV[0] * 0.3) continue;
          const gm = Math.hypot((er[o + 1] - er[o - 1]) * 0.5, (er[o + w] - er[o - w]) * 0.5); if (gm < 1e-4) continue;
          let k = 0; while (k < NL && CLV[k] <= E) k++; // CLV[k-1] ≤ E < CLV[k]
          let best = Infinity, bk = -1;
          if (k > 0) { const d = (E - CLV[k - 1]) / gm; if (d < best) { best = d; bk = k - 1; } }
          if (k < NL) { const d = (CLV[k] - E) / gm; if (d < best) { best = d; bk = k; } }
          if (bk < 0) continue;
          const idx = (bk + 1) % 4 === 0, hw = idx ? 0.7 : 0.42, cov = Math.min(1, hw + 0.5 - best); if (cov <= 0) continue;
          const a = cov * (idx ? aI : aR), oo = o * 4;
          out[oo] += (CC[0] - out[oo]) * a; out[oo + 1] += (CC[1] - out[oo + 1]) * a; out[oo + 2] += (CC[2] - out[oo + 2]) * a;
        }
      }
      if (!pad) return out;
      const crop = new Uint8ClampedArray(req.w * req.h * 4);
      for (let y = 0; y < req.h; y++) crop.set(out.subarray(((y + pad) * w + pad) * 4, ((y + pad) * w + pad + req.w) * 4), y * req.w * 4);
      return crop;
    }
    // 与 render 相同的带细节起伏的地表高程（城市图等高线用，保证与晕渲一致）
    function sampleElev(gx, gy, s, detail) { let e = G.Noise.coastElev(G.Noise.surfaceRaw(elev, W, H, gx, gy), G.Noise.coastSurface(elev, W, H, gx, gy), elev, W, H, gx, gy); const octs = Math.min(5, Math.ceil(Math.log2(1 / s)) + 1);
      const amp = (e > 0 ? 16 + Math.min(200, e * 0.04) : Math.min(60, 16 + (-e) * 0.02)) * (e > 0 ? (detail || 1) : 1); let f = 0.9, a = amp, d = 0; for (let o = 0; o < octs; o++) { d += n2(gx * f, gy * f) * a; f *= 2.1; a *= 0.5; } return e + d * Math.min(1, Math.abs(e) / (amp * 2.2)); }
    return { render, pal, sampleElev };
  }

  G.Render = { create, RAMPS, hex };
})(typeof self !== 'undefined' ? self : this);
