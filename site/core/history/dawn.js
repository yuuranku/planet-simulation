/* 文明点亮：大河文明摇篮 → 发展阶段在区块图上的扩散 → 文明与宗教的到达年代。
 * 文明类型取自文明所用文化库的“生计大类”（农耕 / 游牧 / 海洋 / 山地 / 部族联盟 / 新大陆），
 * 它决定一个文明走过各阶段的快慢、接受城市与国家的难易，以及各阶段政体的称谓（取自文化库的称谓表）。 */
(function (G) {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const INF = 1e9;

  // 阶段：0 游群采集 … 8 当代；各文明类型有自己的称呼
  const STAGE_KEYS = ['band', 'village', 'chiefdom', 'city', 'kingdom', 'empire', 'feudal', 'central', 'modern'];
  const STAGE_NAME = {
    agrarian: ['游群采集', '农业村落', '酋邦', '城邦', '领土王国', '古典帝国', '封建王国', '集权王朝', '民族国家'],
    maritime: ['游群采集', '渔猎村落', '酋邦', '港口城邦', '城邦同盟', '海上帝国', '商业共和国', '海洋强国', '民族国家'],
    pastoral: ['游群采集', '牧民营地', '部落', '部族邦联', '汗国', '草原帝国', '分封汗国', '定居王朝', '民族国家'],
    highland: ['游群采集', '山地村寨', '酋邦', '山城石堡', '山地王国', '高原帝国', '封建领地', '集权王国', '民族国家'],
    tribal: ['游群采集', '部落村寨', '部族联盟', '酋邦联盟', '部族王国', '联盟帝国', '封建王国', '集权王国', '民族国家'],
    'new-world': ['游群采集', '原住民村落', '部落联盟', '祭祀城邦', '原住民王国', '原住民帝国', '封建王国', '集权王国', '民族国家']
  };
  const GENERIC = ['游群采集', '农业村落', '酋邦', '城邦', '王国', '古典帝国', '封建', '集权', '当代'];
  const ERA_NAME = ['史前', '新石器时代', '铜石并用时代', '城邦时代', '王国时代', '古典时代', '中世纪', '近代早期', '当代'];
  const TYPE_LABEL = { agrarian: '农耕', pastoral: '游牧', maritime: '海洋', highland: '山地', tribal: '部族联盟', 'new-world': '新大陆原住民' };
  // 文明类型的发展特性
  //  speed：自发进步的快慢；cradle：成为大河摇篮的倾向；resist[s]：接受第 s 阶段的阻力（>1 更慢）；sea：海路传播倍率（<1 更快）
  const TYPE = {
    agrarian: { speed: 1, cradle: 1, resist: [1, 1, 1, 1, 1, 1, 1, 1, 1], sea: 1 },
    maritime: { speed: 1.05, cradle: 0.85, resist: [1, 1, 1, 0.9, 1.05, 1, 1, 0.9, 1], sea: 0.55 },
    pastoral: { speed: 0.85, cradle: 0.45, resist: [1, 1.1, 1, 1.7, 1.35, 1.1, 1.2, 1.4, 1.2], sea: 1.3 },
    highland: { speed: 0.85, cradle: 0.7, resist: [1, 1, 1.1, 1.25, 1.25, 1.2, 1.1, 1.2, 1.1], sea: 1.2 },
    tribal: { speed: 0.7, cradle: 0.4, resist: [1, 1.1, 1.2, 1.6, 1.5, 1.4, 1.3, 1.3, 1.2], sea: 1.1 },
    'new-world': { speed: 0.55, cradle: 0.3, resist: [1, 1.2, 1.3, 2.2, 2, 1.8, 1.6, 1.4, 1.2], sea: 1.4 }
  };
  // 摇篮的参考节奏（年）：第 s 阶段开始的年份；以及阶段的扩散速度（km/年）
  const S = [0, 0, 400, 1000, 1600, 2300, 3100, 3900, 4600];
  const V = [0, 1.6, 2, 2.6, 3.2, 4, 5, 7, 12];
  const MAX_STAGE = [6, 7, 8], END = [3900, 4500, 5000];
  // 思潮（类似《欧陆风云》的制度）：在世界某处兴起，向四周传播；一个地方接纳了某阶段的全部必需思潮，才进入那个阶段。
  //  s 所属阶段；n 发源地数（all = 各摇篮独立出现）；aff 各文明类型的接纳快慢（<1 更快）；opt 非必需（远洋航海：只有接纳了它的国家才能殖民新大陆）
  const IDEAS = [
    { id: 'writing', name: '文字与历法', s: 3, n: 'all', desc: '记事、纪年与祭祀历法，城邦由此兴起' },
    { id: 'walls', name: '城邑营造', s: 3, n: 'all', aff: { maritime: 0.9, pastoral: 1.1 }, desc: '筑城、宫室与神庙，人口聚居为城' },
    { id: 'law', name: '王权与成文法', s: 4, n: 2, desc: '王权神授，刻石为法，诸城归于一王' },
    { id: 'iron', name: '冶铁术', s: 4, n: 2, aff: { highland: 0.8, pastoral: 0.9 }, desc: '铁制农具与兵器，耕地与军队大为扩张' },
    { id: 'bureau', name: '官僚与驿传', s: 5, n: 2, aff: { agrarian: 0.85, pastoral: 1.4, tribal: 1.3 }, desc: '文书行政、驿道与户籍，治理广土众民' },
    { id: 'coin', name: '货币与市集', s: 5, n: 2, aff: { maritime: 0.75, pastoral: 1.1 }, desc: '铸币、市集与远程商路' },
    { id: 'feudal', name: '封建契约', s: 6, n: 2, aff: { pastoral: 0.95, highland: 0.9 }, desc: '封土与效忠，领主与附庸' },
    { id: 'academy', name: '经院与书院', s: 6, n: 1, aff: { agrarian: 0.9, pastoral: 1.3, tribal: 1.3 }, desc: '学者、典籍与讲学之所' },
    { id: 'print', name: '印刷术', s: 7, n: 1, aff: { pastoral: 1.3, tribal: 1.3 }, desc: '书籍廉价流通，知识与教义广为传布' },
    { id: 'gunpowder', name: '火药与常备军', s: 7, n: 1, aff: { pastoral: 1.1 }, desc: '火器、棱堡与领饷的常备军' },
    { id: 'navigation', name: '远洋航海', s: 7, n: 1, opt: true, aff: { maritime: 0.55, agrarian: 1.15, pastoral: 2.4, highland: 1.5, tribal: 1.4, 'new-world': 1.6 }, desc: '罗盘、海图与远洋帆船。只有接纳了它的国家才能远渡重洋，殖民新大陆' },
    { id: 'enlight', name: '启蒙思想', s: 8, n: 1, desc: '理性、契约与民权之说' },
    { id: 'manufactory', name: '工场与蒸汽', s: 8, n: 1, aff: { maritime: 0.85, pastoral: 1.4 }, desc: '工场手工业与最初的蒸汽机' }
  ];

  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  function run(h, R, opt) {
    const { nR, off, nbr, eid, edges } = R, Heap = R.Heap;
    const era = clamp(h.era | 0, 0, 2), E = h.endYear || END[era]; // 现在是文明纪元第几年（向导的文明时代）
    const maxStage = E < 2500 ? 4 : E < 3500 ? 5 : E < 4450 ? 6 : E < 4780 ? 7 : 8; // 青铜 / 古典 / 中世纪 / 前工业 / 早期工业
    const rnd = mulberry32((h.seed | 0) + 5150);
    const nCiv = h.civSeeds.length;
    const civType = h.civLib.map(l => TYPE[l.cat] ? l.cat : 'agrarian');
    const typeOf = r => R.civ[r] >= 0 ? civType[R.civ[r]] : 'tribal';
    const kmR = 2 * Math.PI * h.R; // 星球周长
    const centerDist = (a, b) => h.gdist(R.center[a], R.center[b]) * h.cellKm;
    const used = new Set(h.usedNames);
    const events = [];
    const ev = (year, kind, text, r, extra) => events.push(Object.assign({ year: Math.round(year), kind, text, r: r || 0 }, extra || {}));
    const fmtY = y => Math.round(y);

    // ---------- 1. 摇篮分数 ----------
    let maxDen = 0; const den = new Float32Array(nR + 1);
    for (let r = 1; r <= nR; r++) { den[r] = R.weight[r] / Math.max(1, R.area[r]); if (den[r] > maxDen) maxDen = den[r]; }
    const score = new Float32Array(nR + 1);
    for (let r = 1; r <= nR; r++) {
      const riv = R.river[r] >= 4 ? 1 : R.river[r] === 3 ? 0.72 : R.river[r] === 2 ? 0.22 : 0;
      if (!riv) continue;
      const dry = clamp(R.arid[r] + 0.6 * R.semiArid[r], 0, 1);           // 干旱、半干旱：必须治水，最早逼出国家
      const flat = 1 - smooth(0.04, 0.14, R.slope[r]), low = 1 - smooth(0.18, 0.45, R.eN[r]);
      const warm = smooth(3, 13, R.T[r]) * (1 - smooth(27, 32, R.T[r]));
      const pot = R.pot[r], rel = den[r] / Math.max(1e-12, maxDen);
      const tf = TYPE[typeOf(r)].cradle, fr = R.frontier[r] > 0.5 ? 0.6 : 1, nw = R.newW[r] > 0.5 ? 0.5 : 1;
      score[r] = riv * (0.62 + 0.38 * dry) * (0.5 + 0.5 * Math.min(1, R.riverCells[r] * 3)) * flat * low * warm * (0.25 + 0.75 * pot) * (0.45 + 0.55 * Math.sqrt(rel)) * tf * fr * nw;
    }
    const neighbors = (r, fn) => { for (let k = off[r]; k < off[r + 1]; k++) fn(nbr[k], edges[eid[k]]); };
    const valleyScore = new Float32Array(nR + 1);
    for (let r = 1; r <= nR; r++) { if (!score[r]) continue; const ns = []; neighbors(r, (n, ed) => { if (!ed.sea) ns.push(score[n]); }); ns.sort((a, b) => b - a); valleyScore[r] = score[r] + 0.5 * ((ns[0] || 0) + (ns[1] || 0)); }
    let best = 0; for (let r = 1; r <= nR; r++) if (valleyScore[r] > best) best = valleyScore[r];
    const order = []; for (let r = 1; r <= nR; r++) if (valleyScore[r] >= best * 0.3 && best > 0) order.push(r);
    order.sort((a, b) => valleyScore[b] - valleyScore[a] || a - b);
    const nCradle = clamp(Math.round(nCiv / 4), 2, 4), minKm = kmR * 0.06;
    const cradleR = [];
    for (const r of order) { if (cradleR.length >= nCradle) break; if (cradleR.every(c => centerDist(c, r) >= minKm)) cradleR.push(r); }
    if (!cradleR.length) { // 没有像样的大河：退而取土地潜力最高、人口最密的区块
      let b = 1, bv = -1; for (let r = 1; r <= nR; r++) { const v = R.pot[r] * (0.3 + den[r] / Math.max(1e-12, maxDen)) * TYPE[typeOf(r)].cradle; if (v > bv) { bv = v; b = r; } } cradleR.push(b); }
    // 流域：沿河谷向两侧扩展到分数仍高的相邻区块
    const riverByRegion = new Map(); (opt.riverNames || []).forEach(rn => { const hx = Math.min(h.W - 1, Math.max(0, (rn.x / 2) | 0)), hy = Math.min(h.H - 1, Math.max(0, (rn.y / 2) | 0)); const r = R.regionOf[hy * h.W + hx]; if (r && !riverByRegion.has(r)) riverByRegion.set(r, rn); });
    const inCradle = new Int16Array(nR + 1).fill(-1);
    const cradles = cradleR.map((c0, ci) => {
      const valley = [c0], seen = new Set([c0]); inCradle[c0] = ci;
      for (let k = 0; k < valley.length && valley.length < 10; k++) neighbors(valley[k], (n, ed) => { if (ed.sea || seen.has(n) || inCradle[n] >= 0) return; seen.add(n); if (score[n] >= score[c0] * 0.35 && R.river[n] >= 2 && centerDist(c0, n) < 900 && valley.length < 10) { valley.push(n); inCradle[n] = ci; } });
      let river = null; for (const r of valley) if (riverByRegion.has(r)) { const rn = riverByRegion.get(r); if (!river || rn.q > river.q) river = rn; }
      if (!river) { let bd = 1300; (opt.riverNames || []).forEach(rn => { const dx0 = Math.abs(rn.x - R.cx[c0]), dx = Math.min(dx0, 2 * h.W - dx0), d = Math.hypot(dx, rn.y - R.cy[c0]) / 2 * h.cellKm; if (d < bd) { bd = d; river = rn; } }); }
      return { region: c0, valley, river: river ? river.name : null, x: R.cx[c0], y: R.cy[c0], score: valleyScore[c0] / best };
    });
    // 各摇篮的起步与节奏：条件最好的最早、最快；其余晚几百年、慢一些
    cradles.forEach((cr, ci) => { cr.start = ci === 0 ? 0 : Math.round(150 + 450 * (1 - cr.score) + 150 * rnd()); cr.tempo = ci === 0 ? 1 : 1 + 0.3 * (1 - cr.score) + 0.08 * rnd(); });

    // ---------- 2. 阶段扩散 ----------
    // Y[s*(nR+1)+r]：区块 r 进入第 s 阶段的年份（INF = 至今未达）
    const NN = nR + 1, Y = new Float64Array(9 * NN).fill(INF), src = new Int32Array(9 * NN);
    const suit = new Float32Array(NN); for (let r = 1; r <= nR; r++) suit[r] = clamp(score[r] / Math.max(1e-9, best) * 1.6 + 0.35 * R.pot[r] + 0.25 * Math.sqrt(den[r] / Math.max(1e-12, maxDen)), 0, 1);
    const hop = new Int16Array(NN).fill(-1); // 到所属摇篮中心的步数
    cradles.forEach(cr => { const q = [cr.region]; hop[cr.region] = 0; for (let k = 0; k < q.length; k++) neighbors(q[k], (n, ed) => { if (!ed.sea && inCradle[n] === inCradle[cr.region] && hop[n] < 0) { hop[n] = hop[q[k]] + 1; q.push(n); } }); });
    const habitable = r => R.weight[r] > 0 && den[r] > maxDen * 0.004;
    // 非摇篮地区的自发进步：比摇篮慢得多，土地越好、人越多越快（独立起源的次生文明）
    const OWN = [0, 650, 1000, 1600, 2200, 2900, 3700, 4400, 5000];
    const own = (s, r) => {
      if (!habitable(r)) return INF;
      const T = TYPE[typeOf(r)];
      if (inCradle[r] >= 0) { const cr = cradles[inCradle[r]]; return S[s] * cr.tempo + cr.start + 70 * Math.max(0, hop[r]) + (s > 1 ? 40 * rnd() : 0); }
      return OWN[s] * (1 + 1.6 * (1 - suit[r])) / T.speed + 200;
    };
    const delay = (s, a, b, ed) => { // 第 s 阶段从 a 传到 b 要多少年
      const Tb = TYPE[typeOf(b)], Ta = TYPE[typeOf(a)];
      let d = ed.km / V[s];
      if (ed.sea) {
        if ((R.newW[a] > 0.5) !== (R.newW[b] > 0.5) && s < 7) return INF; // 新旧大陆：大航海时代以前互不相通
        d *= (s <= 2 ? 3 : s <= 4 ? 1.8 : s <= 6 ? 1.2 : 0.8) * Math.min(Ta.sea, Tb.sea);
      } else d *= (1 + 0.45 * Math.min(4, ed.rough)) * (ed.river > 0.3 ? 0.7 : 1);
      d *= Tb.resist[s];
      if (!habitable(b) && s >= 2) d *= 3;
      return d;
    };
    // 阶段 1–2（农耕、酋邦）照旧扩散；阶段 3 起由思潮推动
    const nI = IDEAS.length, IA = new Float64Array(nI * NN).fill(INF), ideaOrigins = IDEAS.map(() => []), ideaBorn = new Float64Array(nI).fill(INF);
    const NAV = IDEAS.findIndex(o => o.id === 'navigation'), prevOrig = [];
    const sameCiv = (a, b) => R.civ[a] >= 0 && R.civ[a] === R.civ[b];
    for (let s = 1; s <= 8; s++) {
      const base = s * NN, prev = (s - 1) * NN, gap = Math.max(60, 0.35 * (S[s] - S[s - 1]));
      const lb = r => s === 1 ? 0 : Y[prev + r] >= INF ? INF : Y[prev + r] + gap;
      if (s <= 2) {
        const hp = new Heap(NN * 2);
        for (let r = 1; r <= nR; r++) { const v = Math.max(own(s, r), lb(r)); if (v < INF) { Y[base + r] = v; src[base + r] = r; hp.push(r, v); } }
        while (hp.n) { const a = hp.pop(), c = hp.top; if (c !== Y[base + a]) continue;
          for (let k = off[a]; k < off[a + 1]; k++) { const b = nbr[k], ed = edges[eid[k]]; const L = lb(b); if (L >= INF) continue;
            const dl = delay(s, a, b, ed); if (dl >= INF) continue; const nc = Math.max(c + dl, L);
            if (nc < Y[base + b] - 1e-9) { Y[base + b] = nc; src[base + b] = src[base + a]; hp.push(b, nc); } } }
        continue;
      }
      const ks = []; IDEAS.forEach((o, k) => { if (o.s === s) ks.push(k); }); if (NAV >= 0 && IDEAS[NAV].s === s) { ks.splice(ks.indexOf(NAV), 1); ks.unshift(NAV); } // 远洋航海先算：其后的思潮要靠它跨海
      const reqMax = new Float64Array(NN), reqSrc = new Int32Array(NN);
      for (const k of ks) { const I = IDEAS[k], aff = r => (I.aff && I.aff[typeOf(r)]) || 1, A = IA.subarray(k * NN, (k + 1) * NN), SR = new Int32Array(NN);
        // 发源：最早具备条件的地方（摇篮的节奏 × 文明类型的亲和）；其余地方只能更慢地独立想到
        const dS = S[s] - S[s - 1], cand = [];
        for (let r = 1; r <= nR; r++) { if (I.id === 'navigation' && (!R.coast[r] || R.newW[r] > 0.5)) continue; // 远洋航海只出现在旧大陆的沿海
          const v = s === 3 ? Math.max(own(s, r) * aff(r), lb(r)) : Y[prev + r] >= INF || !habitable(r) ? INF : Math.max(lb(r), Y[prev + r] + 0.9 * dS * aff(r) * (1 + 0.5 * (1 - suit[r])));
          if (v < INF) cand.push([r, v, s === 3 ? v : v + dS * (0.22 * rnd() + (prevOrig.some(o => centerDist(o, r) < kmR * 0.04) ? 0.18 : 0))]); } // 兴起之地：随机起伏，刚兴起过思潮的地方稍逊（只影响在哪里兴起，不推迟年代） // 思潮各有兴起之地：随机起伏，刚兴起过思潮的地方稍逊
        cand.sort((a, b) => a[2] - b[2] || a[0] - b[0]); const vBest = cand.length ? Math.min(...cand.map(c => c[1])) : INF;
        const nO = I.n === 'all' ? cradles.length : I.n, origins = [];
        for (const [r, v] of cand) { if (origins.length >= nO) break; if (origins.every(([o]) => centerDist(o, r) >= kmR * 0.08)) origins.push([r, v]); }
        const hp = new Heap(NN * 2), seed = (r, v) => { if (v < A[r]) { A[r] = v; SR[r] = r; hp.push(r, v); } };
        for (const [r, v] of origins) seed(r, Math.max(lb(r), Math.min(v, vBest + 0.12 * dS)));
        for (const [r, v] of cand) seed(r, I.n === 'all' ? v : v + 0.8 * dS); // 其余地方要晚得多才能独立想到
        ideaOrigins[k] = origins.map(o => o[0]); if (s > 3) prevOrig.push(...ideaOrigins[k]); ideaBorn[k] = origins.length ? origins[0][1] : INF;
        while (hp.n) { const a = hp.pop(), c = hp.top; if (c !== A[a]) continue;
          for (let kk = off[a]; kk < off[a + 1]; kk++) { const b = nbr[kk], ed = edges[eid[kk]]; const L = lb(b); if (L >= INF) continue;
            if (ed.sea && (R.newW[a] > 0.5) !== (R.newW[b] > 0.5) && k !== NAV && !(NAV >= 0 && IA[NAV * NN + a] <= c)) continue; // 跨洋：须先接纳远洋航海
            let dl = delay(s, a, b, ed); if (dl >= INF) continue; dl *= aff(b) * (sameCiv(a, b) ? 0.55 : 1); // 同一文明之内传得快
            const nc = Math.max(c + dl, L); if (nc < A[b] - 1e-9) { A[b] = nc; SR[b] = SR[a]; hp.push(b, nc); } } }
        if (!I.opt) for (let r = 1; r <= nR; r++) { if (A[r] > reqMax[r]) { reqMax[r] = A[r]; reqSrc[r] = SR[r]; } } }
      for (let r = 1; r <= nR; r++) { const v = reqMax[r]; if (v < INF) { Y[base + r] = v; src[base + r] = reqSrc[r]; } }
    }

    // ---------- 2b. 新大陆的本土文明：起步晚、范围小、数量少 ----------
    // 现实对照（文明纪元 ≈ 公元 + 3000）：奥尔梅克、玛雅城邦约第 2500–3300 年，阿兹特克、印加式的王国与帝国约第 4300 年以后
    const nwNative = new Uint8Array(NN), nwHearths = [];
    { let nwW = 0, allW = 0; for (let r = 1; r <= nR; r++) { allW += R.weight[r]; if (R.newW[r] > 0.5) nwW += R.weight[r]; }
      if (nwW > allW * 0.03) {
        const cand = []; for (let r = 1; r <= nR; r++) if (R.newW[r] > 0.5 && habitable(r) && R.cities[r].length) cand.push([r, (0.35 + suit[r]) * (0.3 + Math.sqrt(den[r] / Math.max(1e-12, maxDen))) * (R.river[r] >= 2 ? 1.25 : 1)]);
        cand.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
        const nH = clamp(Math.round(nwW / allW * 10), 1, 3), top = cand.length ? cand[0][1] : 1;
        for (const [r, v] of cand) { if (nwHearths.length >= nH) break; if (nwHearths.every(o => centerDist(o.r, r) >= kmR * 0.07)) nwHearths.push({ r, q: v / top }); }
        nwHearths.forEach((hh, i) => {
          const t3 = 2500 + 380 * i + 320 * (1 - hh.q) + 220 * rnd(), t4 = t3 + 700 + 350 * rnd(), t5 = i === 0 && hh.q > 0.55 ? Math.max(t4 + 500, 4250 + 150 * rnd()) : INF;
          const T = [0, 0, Math.min(1700, t3 - 700), t3, t4, t5], RAD = [0, 0, 0, 1, 1, 2]; /* 城邦、王国只在核心河谷一带 */ hh.start = t3;
          const hop = new Map([[hh.r, 0]]), q = [hh.r];
          for (let k = 0; k < q.length; k++) { const a = q[k], d = hop.get(a); if (d >= 6) continue; neighbors(a, (n, ed) => { if (ed.sea || hop.has(n) || R.newW[n] < 0.5 || !habitable(n) || R.landComp[n] !== R.landComp[hh.r]) return; hop.set(n, d + 1); q.push(n); }); }
          for (const [r, d] of hop) { for (let st = 2; st <= 5; st++) { if (!(T[st] < INF) || d > Math.max(RAD[st], st === 2 ? 8 : 0)) continue; const i0 = st * NN + r, y = T[st] + 70 * d + 40 * rnd(); if (y < Y[i0]) { Y[i0] = y; src[i0] = hh.r; } }
            nwNative[r] = 1; }
          for (const [r] of hop) for (let st = 2; st <= 8; st++) { const i0 = st * NN + r; if (Y[i0] < INF && Y[i0] < Y[(st - 1) * NN + r] + 30) Y[i0] = Y[(st - 1) * NN + r] + 30; }
        });
      } }

    // ---------- 3. 古老文明还是古文明 ----------
    const hearthR = h.civSeeds.map(s => R.regionOf[s.cell]);
    const usedLib = new Set(h.civLib.map(l => l.id));
    const pickName = (lib, key, n) => { const list = (lib.n && lib.n[key]) || []; for (const nm of list) if ((!n || nm.length <= n) && !used.has(nm)) { used.add(nm); return nm; }
      return G.NameGen.make(lib, key === 'states' ? 'state' : key === 'cities' ? 'city' : 'other', used, rnd, n ? { maxLen: n } : null); };
    const worldLibs = h.LIBS && h.LIBS.length ? h.LIBS : h.civLib; // 只用这个世界选用的文化库
    const ancient = []; const ancientOf = new Int16Array(NN).fill(-1), ancientEnd = new Float64Array(NN);
    const civStart = new Float64Array(nCiv).fill(INF), civCradle = new Int16Array(nCiv).fill(-1);
    cradles.forEach((cr, ci) => {
      const c0 = R.civ[cr.region];
      const hr = c0 >= 0 ? hearthR[c0] : 0;
      const living = c0 >= 0 && (cr.valley.includes(hr) || centerDist(hr, cr.region) < 800);
      if (living) { cr.civ = c0; cr.ancient = -1; civCradle[c0] = ci; return; }
      // 古文明：在摇篮点亮、称霸，之后被后来的文明征服同化
      const type = typeOf(cr.region) === 'pastoral' ? 'agrarian' : typeOf(cr.region);
      // 优先：本世界选用、尚未被现存文明占用的同类文化库；其次任一未占用的库；都没有就沿用继承者的库（古今同一风格的名称）
      const lib = worldLibs.find(l => l.cat === type && !usedLib.has(l.id)) || worldLibs.find(l => !usedLib.has(l.id) && l.cat !== 'new-world') || (c0 >= 0 ? h.civLib[c0] : h.civLib[0]);
      usedLib.add(lib.id);
      const nm = pickName(lib, 'states', 3);
      const zone = []; const t3 = Y[3 * NN + cr.region];
      for (let r = 1; r <= nR; r++) { const sr = src[3 * NN + r]; if ((inCradle[sr] === ci) && Y[3 * NN + r] - t3 <= 520 && R.landComp[r] === R.landComp[cr.region]) zone.push(r); }
      zone.sort((a, b) => Y[3 * NN + a] - Y[3 * NN + b]); zone.length = Math.min(zone.length, 45);
      for (const r of cr.valley) if (!zone.includes(r)) zone.push(r);
      const peak = Math.min(Y[5 * NN + cr.region], E - 900);
      const fall = clamp(peak + 250 + 450 * rnd(), Y[4 * NN + cr.region] + 300, E - 600);
      const a = { name: nm + '文明', short: nm, lib: lib.label, libId: lib.id, libObj: lib, type, typeLabel: TYPE_LABEL[type], cradle: ci, fall, zone, successor: c0,
        titles: titlesOf(lib, type) };
      ancient.push(a); cr.ancient = ancient.length - 1; cr.civ = c0;
      zone.forEach(r => { if (ancientOf[r] < 0) { ancientOf[r] = ancient.length - 1; ancientEnd[r] = fall + 35 * Math.max(0, Math.round(centerDist(r, cr.region) / 250)); } });
    });
    function titlesOf(lib, type) { const t = lib.t || {}; const f = k => (t[k] && t[k][0]) || ''; return { 2: f('chiefdom'), 3: type === 'pastoral' ? f('nomadic') : type === 'maritime' ? f('cityRepublic') : '城邦', 4: type === 'pastoral' ? f('nomadic') : f('monarchy'), 5: f('empire'), league: f('league'), republic: f('republic') }; }

    // ---------- 4. 终点：各时代的发展上限；荒野地带（人文推演判为边疆的地方）停留在部落 ----------
    const REQ = { chiefdom: 2, league: 2, nomadic: 3, cityRepublic: 3, monarchy: 4, republic: 4, empire: 5 };
    const stageAt = (r, y) => { let s = 0; for (let k = 1; k <= 8; k++) if (Y[k * NN + r] <= y) s = k; return s; };
    const countries = opt.countries || [];
    const capR = countries.map(k => { const s = h.settlements[k.capital]; return s ? R.regionOf[s.cell] : 0; });
    const finalStage = new Int8Array(NN);
    const setStage = (r, fs, ref) => { // 让区块 r 在终点恰好处于 fs 阶段；缺的阶段向首都（ref）看齐补上
      for (let s = 1; s <= 8; s++) { const i = s * NN + r;
        if (s > fs) { Y[i] = INF; continue; }
        const lo = s === 1 ? 0 : Y[(s - 1) * NN + r] + 30;
        if (Y[i] >= E - (fs - s + 1) * 20) { const target = ref && ref !== r && Y[s * NN + ref] < E ? Y[s * NN + ref] + 120 + 60 * rnd() : E - (fs - s + 1) * 140; Y[i] = Math.min(E - (fs - s + 1) * 20, target); }
        if (Y[i] < lo) Y[i] = lo; }
      finalStage[r] = fs; };
    // 现在的政治地图由历史决定（apply.js），这里不再按它约束发展阶段；只保留各时代的上限与荒野地带（自然条件）的上限
    for (let r = 1; r <= nR; r++) {
      if (R.country[r] < 0 && !(nwNative[r] && stageAt(r, E) >= 3)) { const fs = Math.min(2, stageAt(r, E)); setStage(r, habitable(r) ? Math.max(1, fs) : 0, 0); continue; }
      for (let s2 = maxStage + 1; s2 <= 8; s2++) Y[s2 * NN + r] = INF;
      finalStage[r] = stageAt(r, E);
    }

    // 思潮与终局的阶段对齐：必需思潮不晚于进入该阶段，阶段未到则未接纳；远洋航海须先到封建阶段；超出这个时代的思潮尚未出现
    for (let k = 0; k < nI; k++) { const I = IDEAS[k], A = IA.subarray(k * NN, (k + 1) * NN);
      if (I.s > maxStage || ideaBorn[k] > E) { A.fill(INF); ideaBorn[k] = INF; continue; }
      for (let r = 1; r <= nR; r++) { if (I.opt) { const y6 = Y[(I.s - 1) * NN + r]; A[r] = y6 >= INF ? INF : Math.max(A[r], y6 + 60); continue; } const ys = Y[I.s * NN + r]; A[r] = ys >= INF ? INF : Math.min(A[r], ys); }
      let b = INF; for (const o of ideaOrigins[k]) if (A[o] < b) b = A[o]; for (let r = 1; r <= nR; r++) if (A[r] < b) b = A[r]; ideaBorn[k] = b; }

    // ---------- 5. 文明（文化）的形成与传播 ----------
    const civArea = new Float64Array(nCiv), costs = Array.from({ length: nCiv }, () => []);
    for (let r = 1; r <= nR; r++) { const c = R.civ[r]; if (c < 0) continue; civArea[c] += R.area[r]; costs[c].push(R.civCost[r]); }
    const q90 = costs.map(a => { if (!a.length) return 1; a.sort((x, y) => x - y); return Math.max(1e-6, a[Math.floor(a.length * 0.9)]); });
    for (let c = 0; c < nCiv; c++) { const hr = hearthR[c]; if (!hr) continue; civStart[c] = civCradle[c] >= 0 ? Y[NN + hr] : Math.max(0, Math.min(Y[2 * NN + hr], E - 900) - 150); }
    const civArr = new Float64Array(NN).fill(INF);
    for (let c = 0; c < nCiv; c++) {
      const span = clamp(Math.sqrt(civArea[c]) / 1.4, 300, 2400); let mx = 0; const list = [];
      for (let r = 1; r <= nR; r++) if (R.civ[r] === c) { let a = civStart[c] + clamp(R.civCost[r] / q90[c], 0, 1.4) * span; if (ancientOf[r] >= 0) a = Math.max(a, ancientEnd[r]); list.push([r, a]); if (a > mx) mx = a; }
      const lim = E - 120, k = mx > lim && mx > civStart[c] ? (lim - civStart[c]) / (mx - civStart[c]) : 1;
      for (const [r, a] of list) civArr[r] = ancientOf[r] >= 0 ? Math.min(lim, Math.max(ancientEnd[r], civStart[c] + (a - civStart[c]) * k)) : civStart[c] + (a - civStart[c]) * k;
    }

    // ---------- 6. 宗教：创立与传播 ----------
    const nRel = opt.religions ? opt.religions.length : h.relSeeds.length;
    const relOrigin = h.relSeeds.map(c => R.regionOf[c]);
    const relDist = (o) => { const d = new Float64Array(NN).fill(INF); if (!o) return d; const hp = new Heap(NN * 2); d[o] = 0; hp.push(o, 0);
      while (hp.n) { const a = hp.pop(), c = hp.top; if (c !== d[a]) continue; for (let k = off[a]; k < off[a + 1]; k++) { const b = nbr[k], ed = edges[eid[k]]; const w = ed.km * (ed.sea ? 1.6 : 1 + 0.3 * Math.min(4, ed.rough)); if (c + w < d[b]) { d[b] = c + w; hp.push(b, c + w); } } } return d; };
    const relFounded = new Float64Array(nRel), relD = [];
    for (let f = 0; f < nRel; f++) { const o = relOrigin[f]; const t = o ? Math.min(Y[3 * NN + o], Y[4 * NN + o] - 150) : E / 2; relFounded[f] = clamp((t < INF ? t : E * 0.55) + 120 + 520 * rnd(), 800, E - 1100); /* 世界性宗教多兴起于古典到中世纪 */ relD.push(relDist(o)); }
    const VREL = 2.2;
    const relArr = new Float64Array(NN).fill(INF), relPrev = new Int16Array(NN).fill(-1), relPrevArr = new Float64Array(NN).fill(INF);
    const rawArr = (f, r) => relFounded[f] + relD[f][r] / VREL;
    // 每个宗教在各自终点区块上的最晚到达不得晚于现在
    const relScale = new Float64Array(nRel).fill(1);
    for (let f = 0; f < nRel; f++) { let mx = 0; for (let r = 1; r <= nR; r++) if (R.rel[r] === f || R.relRaw[r] === f) { const a = rawArr(f, r); if (a < INF && a > mx) mx = a; } const lim = E - 40; if (mx > lim) relScale[f] = (lim - relFounded[f]) / Math.max(1, mx - relFounded[f]); }
    const arrive = (f, r) => { const a = rawArr(f, r); return a >= INF ? E - 40 : relFounded[f] + (a - relFounded[f]) * relScale[f]; };
    for (let r = 1; r <= nR; r++) { const f = R.rel[r]; if (f < 0) continue; relArr[r] = arrive(f, r); const g = R.relRaw[r]; if (g >= 0 && g !== f) { const pa = arrive(g, r); if (pa < relArr[r] - 60) { relPrev[r] = g; relPrevArr[r] = pa; } else relArr[r] = Math.max(relArr[r], Math.min(E - 30, pa + 150)); } }

    // ---------- 7. 各文明的阶段年表（脉络带） ----------
    const civAges = Array.from({ length: nCiv }, () => new Float64Array(9).fill(INF));
    for (let r = 1; r <= nR; r++) { const c = R.civ[r]; if (c < 0) continue; for (let s = 1; s <= 8; s++) { const y = Math.max(Y[s * NN + r], civArr[r]); if (y < civAges[c][s]) civAges[c][s] = y; } }
    for (let c = 0; c < nCiv; c++) for (let s = 1; s <= 8; s++) if (civAges[c][s] > E) civAges[c][s] = INF;
    ancient.forEach(a => { a.ages = new Float64Array(9).fill(INF); for (const r of a.zone) for (let s = 1; s <= 8; s++) { const y = Y[s * NN + r]; if (y < a.fall && y < a.ages[s]) a.ages[s] = y; } });

    // ---------- 8. 编年史 ----------
    const regionName = r => { const cs = R.cities[r]; if (cs.length) { let b = cs[0]; for (const k of cs) if (h.settlements[k].score > h.settlements[b].score) b = k; return h.settlements[b].name; } return ''; };
    const SN = c => STAGE_NAME[civType[c]] || GENERIC;
    cradles.forEach((cr, ci) => {
      if (!cr.river) { const lib = cr.ancient >= 0 ? ancient[cr.ancient].libObj : h.civLib[Math.max(0, cr.civ)]; let rv = pickName(lib, 'rivers'); if (!/[河江水川溪]$/.test(rv) && !/[a-zA-Z]/.test(rv)) rv += '河'; cr.river = rv; }
      const label = cr.river + '流域';
      cr.name = label;
      const who = cr.ancient >= 0 ? ancient[cr.ancient].name : (cr.civ >= 0 ? opt.cultureNames[cr.civ] : '');
      ev(Y[NN + cr.region], 'cradle', `${label}出现最早的农业村落，${who}在此发端`, cr.region, { cradle: ci });
      const t3 = Y[3 * NN + cr.region]; if (t3 < INF) ev(t3, 'city', `${label}建起第一批城邦${regionName(cr.region) ? '，其中有' + regionName(cr.region) : ''}`, cr.region, { cradle: ci });
    });
    ancient.forEach((a, ai) => {
      const cr = cradles[a.cradle];
      if (a.ages[4] < INF) ev(a.ages[4], 'kingdom', `${a.name}统一${cr.name}诸城，建立王国`, cr.region, { ancient: ai });
      if (a.ages[5] < INF) ev(a.ages[5], 'empire', `${a.name}进入帝国时代`, cr.region, { ancient: ai });
      const succ = a.successor >= 0 ? opt.cultureNames[a.successor] : '后来者';
      ev(a.fall, 'fall', `${a.name}衰亡，故地逐渐为${succ}所同化`, cr.region, { ancient: ai });
    });
    for (let c = 0; c < nCiv; c++) {
      const nm = opt.cultureNames[c], sn = SN(c), hr = hearthR[c];
      if (civCradle[c] < 0 && civStart[c] < INF) ev(civStart[c], 'civ', `${nm}在${regionName(hr) || '故土'}一带形成（${TYPE_LABEL[civType[c]]}文明）`, hr, { civ: c });
      for (const s of [3, 4, 5, 6, 7, 8]) { if (s > maxStage || civAges[c][s] >= INF) continue; let r0 = hr, by = INF; for (let r = 1; r <= nR; r++) if (R.civ[r] === c) { const y = Math.max(Y[s * NN + r], civArr[r]); if (y < by) { by = y; r0 = r; } } ev(civAges[c][s], 'stage', `${nm}进入${sn[s]}阶段`, r0, { civ: c, stage: s }); }
    }
    for (let f = 0; f < nRel; f++) { const o = relOrigin[f]; const nm = opt.religions ? opt.religions[f].name : '宗教' + f; ev(relFounded[f], 'religion', `${nm}在${regionName(o) || '某地'}创立`, o, { religion: f }); }
    events.sort((a, b) => a.year - b.year || a.r - b.r);

    // ---------- 9. 时代刻度：每 25 年取“已有人居的世界”中最先进的 20% 人口所处的阶段 ----------
    const step = 25, nS = Math.floor(E / step) + 1, eraAt = new Uint8Array(nS);
    { const pairs = []; for (let r = 1; r <= nR; r++) if (R.weight[r] > 0) pairs.push(r);
      for (let k = 0; k < nS; k++) { const y = k * step; let tot = 0; const w = new Float64Array(9); for (const r of pairs) { const s = stageAt(r, y); if (!s) continue; w[s] += R.weight[r]; tot += R.weight[r]; } let acc = 0, s70 = 1; for (let s = 8; s >= 1; s--) { acc += w[s]; if (acc >= tot * 0.2) { s70 = s; break; } } eraAt[k] = tot ? s70 : 0; }
      for (let k = 1; k < nS; k++) if (eraAt[k] < eraAt[k - 1]) eraAt[k] = eraAt[k - 1]; // 时代只进不退
      for (let k = nS - 1; k >= 0 && eraAt[k] >= maxStage - 1 && k * step >= E - 300; k--) eraAt[k] = maxStage; } // 最后一段就是这个世界现在的时代

    return {
      IDEAS, ideaA: IA, ideaBorn, ideaOrigins, NAV, nwHearths, E, maxStage, Y, NN, civType, civStart, civArr, civAges, hearthR, ancient, ancientOf, ancientEnd, cradles, score, finalStage,
      relFounded, relOrigin, relArr, relPrev, relPrevArr, events, eraStep: step, eraAt,
      STAGE_KEYS, STAGE_NAME, GENERIC, ERA_NAME, TYPE_LABEL, titlesOf, usedNames: used, NN
    };
  }

  G.HistoryDawn = { run, STAGE_NAME, ERA_NAME, TYPE_LABEL, GENERIC };
})(typeof self !== 'undefined' ? self : this);
