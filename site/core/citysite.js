/* 城市详情配方：把用户生成器 presentation.py / city_site.py / city_harbors.py 的城市配方
 * 移植到本世界的全分辨率网格上。城内街道、城墙、港口由用户的 city-site / city-detail 在页面中生成。 */
(function (G) {
  'use strict';
  const M = Math;
  const ERA = {
    tribal: { core: 0, grid: 0.03, landmark: 'gathering-ground' }, ancient: { core: 0, grid: 0.12, landmark: 'forum' },
    medieval: { core: 0, grid: 0.17, landmark: 'market-hall' }, 'early-modern': { core: 1, grid: 0.33, landmark: 'exchange-hall' },
    preindustrial: { core: 0, grid: 0.21, landmark: 'market-square' }, industrial: { core: 1, grid: 0.52, landmark: 'rail-terminal' },
    contemporary: { core: 2, grid: 0.65, landmark: 'civic-centre' }
  };
  const DENSITY = { tribal: 780, ancient: 1550, medieval: 2250, 'early-modern': 2850, preindustrial: 3200, industrial: 3450, contemporary: 4100 };
  const TIER_DENSITY = { metropolis: 0.82, city: 0.98, town: 1.18, site: 0.76 }, MIN_AREA = { metropolis: 18, city: 4, town: 0.55, site: 0.12 };
  const WIDTHS = { tribal: [4, 2.4, 1.4], ancient: [8, 4.5, 2.4], medieval: [7, 3.8, 2.1], 'early-modern': [12, 6.2, 3.1], preindustrial: [11, 5.6, 3], industrial: [20, 9, 4.8], contemporary: [28, 13, 6.5] };
  const TIER_W = { site: 0.68, town: 0.82, city: 1, metropolis: 1.16 };
  const SITE = { fort: 'fortress', 'pass-fort': 'pass' };
  const WK = { 1: 'ocean', 2: 'lake' };

  function hash(a, b) { let h = (a ^ 0x9e3779b9) >>> 0; for (const ch of String(b)) { h = M.imul(h ^ ch.charCodeAt(0), 0x85ebca6b) >>> 0; h ^= h >>> 13; } h = M.imul(h ^ (h >>> 16), 0xc2b2ae35) >>> 0; return (h ^ (h >>> 16)) >>> 0; }
  function rnd(seed, ch) { let v = (seed ^ M.imul((ch + 0x9e3779b9) >>> 0, 0x85ebca6b)) >>> 0; v ^= v >>> 16; v = M.imul(v, 0x7feb352d) >>> 0; v ^= v >>> 15; v = M.imul(v, 0x846ca68b) >>> 0; v ^= v >>> 16; return (v >>> 0) / 4294967296; }

  let cache = null;
  function prepare(world) {
    if (cache && cache.world === world) return cache;
    const { P, Hy } = world, W = P.W, H = P.H, e = P.elev;
    // 归一化坡度：陆地坡度第 98 百分位（presentation._derive_grid_context）
    const sample = [];
    for (let i = 0; i < W * H; i += 13) { if (e[i] <= 0 || Hy.lake[i]) continue; sample.push(slopeRaw(e, W, H, i)); }
    sample.sort((a, b) => a - b);
    cache = { world, slope98: sample.length ? sample[M.floor(sample.length * 0.98)] || 1 : 1 };
    return cache;
  }
  function slopeRaw(e, W, H, i) {
    const y = (i / W) | 0, x = i - y * W;
    const up = y > 0 ? e[i - W] : e[i], dn = y < H - 1 ? e[i + W] : e[i];
    const gr = (y > 0 && y < H - 1) ? (dn - up) * 0.5 : dn - up;
    const gc = (e[y * W + (x + 1) % W] - e[y * W + (x - 1 + W) % W]) * 0.5;
    return M.hypot(gr, gc);
  }

  function payload(world, idx, opts = {}) {
    const { P, Hy, Cv, cfg } = world, W = P.W, H = P.H, e = P.elev, R = cfg.radius;
    const C = prepare(world), city = Cv.cities[idx]; if (!city) return null;
    const isWater = i => e[i] <= 0 || Hy.lake[i];
    const waterCode = i => e[i] <= 0 && !Hy.lake[i] ? 1 : Hy.lake[i] ? 2 : 0;
    const qth = Hy.qth, riverOrder = i => (e[i] > 0 && !Hy.lake[i] && Hy.q[i] > qth) ? 1 + M.min(8, M.floor(M.log2(Hy.q[i] / qth))) : 0;
    const wrap = x => ((x % W) + W) % W, at = (r, c) => r * W + wrap(c);
    const nslope = i => M.min(1, slopeRaw(e, W, H, i) / C.slope98);
    // 连续地表（与本世界陆海同一双线性场）
    const elevAt = (row, col) => {
      const y = M.max(0, M.min(H - 1.001, row - 0.5)), x = col - 0.5, y0 = M.floor(y), x0 = M.floor(x), fy = y - y0, fx = x - x0;
      const v = (r, c) => e[at(r, c)];
      return v(y0, x0) * (1 - fx) * (1 - fy) + v(y0, x0 + 1) * fx * (1 - fy) + v(y0 + 1, x0) * (1 - fx) * fy + v(y0 + 1, x0 + 1) * fx * fy;
    };
    // 海陆：与大地图同一三次海岸曲面（不再用双线性——其零等值线是双曲线，会在城边形成两段圆弧夹一个尖角），近岸叠加公里级海岸细节
    const cn1 = G.Noise.simplex2(cfg.seed + 9191), cn2 = G.Noise.simplex2(cfg.seed + 9192);
    let seaAt = (row, col) => {
      const v = G.Noise.coastSurface(e, W, H, col, row); if (v > 45 || v < -45) return v;
      return v + 6 * (cn1(col * 4, row * 4) * 0.65 + cn2(col * 11, row * 11) * 0.35) * (1 - M.abs(v) / 45);
    };
    const lakeAt = (row, col) => {
      const y = M.max(0, M.min(H - 1.001, row - 0.5)), x = col - 0.5, y0 = M.floor(y), x0 = M.floor(x), fy = y - y0, fx = x - x0;
      const v = (r, c) => Hy.lake[at(r, c)] ? 1 : 0;
      return v(y0, x0) * (1 - fx) * (1 - fy) + v(y0, x0 + 1) * fx * (1 - fy) + v(y0 + 1, x0) * (1 - fx) * fy + v(y0 + 1, x0 + 1) * fx * fy;
    };
    const dryAt = (row, col) => seaAt(row, col) > 0 && lakeAt(row, col) < 0.5;

    // ---- 锚点：落在陆地格 ----
    let cy = city.y, cx = city.x;
    let row = M.min(H - 1, M.floor(cy)), column = wrap(M.floor(cx));
    if (isWater(at(row, column)) || !dryAt(cy, cx)) {
      // 先在原锚点附近找连续陆面上的点（港口城市常贴着岸线）
      for (let k = 1; k <= 160; k++) { const rr = 0.012 * k, a = k * 2.39996; const yy = city.y + M.sin(a) * rr, xx = city.x + M.cos(a) * rr;
        const r2 = M.min(H - 1, M.max(0, M.floor(yy))), c2 = wrap(M.floor(xx));
        if (dryAt(yy, xx) && !isWater(at(r2, c2))) { cy = yy; cx = xx; row = r2; column = c2; break; } }
    }
    if (isWater(at(row, column)) || !dryAt(cy, cx)) {
      let best = null;
      for (let r = 1; r <= 4 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const rr = row + dy; if (rr < 0 || rr >= H) continue; if (isWater(at(rr, column + dx))) continue;
        const d = M.hypot(dy, dx); if (!best || d < best[0]) best = [d, rr, column + dx];
      }
      if (best) { row = best[1]; column = wrap(best[2]); cy = row + 0.5; cx = column + 0.5 + (city.x - (column + 0.5) > W / 2 ? W : 0); }
    }
    const anchor = at(row, column);
    const seed = hash(cfg.seed >>> 0, 'city-' + idx);
    const newWorld = P.newWorld && P.newWorld[anchor];
    const era = Cv.era === 'industrial' && newWorld && city.country >= 0 ? 'preindustrial' : Cv.era;
    const profile = ERA[era];
    const siteType = SITE[city.type] || city.type;

    // ---- 最近水体 / 河流（_nearest_context，半径 18 格） ----
    const nearest = (pred, val) => {
      let best = null;
      for (let dy = -18; dy <= 18; dy++) { const rr = row + dy; if (rr < 0 || rr >= H) continue;
        for (let dx = -18; dx <= 18; dx++) { if (!dx && !dy) continue; const i = at(rr, column + dx); if (!pred(i)) continue; const d = M.hypot(dy, dx); if (!best || d < best[0]) best = [d, dy, dx, i]; } }
      if (!best) return [null, null, null];
      return [best[0], M.round(((M.atan2(-best[1], best[2]) * 180 / M.PI) % 360 + 360) % 360) % 360, val(best[3])];
    };
    const [wDist, wBear, wCode] = nearest(isWater, waterCode);
    const [rDist, rBear, rOrd] = nearest(i => riverOrder(i) > 0, riverOrder);
    const slope = nslope(anchor);
    const slopeClass = slope < 0.1 ? 'flat' : slope < 0.25 ? 'gentle' : slope < 0.48 ? 'rolling' : slope < 0.74 ? 'steep' : 'escarpment';
    const waterKind = siteType === 'island-port' ? 'island-harbor' : siteType === 'lake-port' ? 'lakefront' : siteType === 'port' ? 'seaport'
      : siteType === 'river-city' || (rDist !== null && rDist <= 3) ? 'riverfront' : siteType === 'oasis' ? 'oasis-water'
        : wDist !== null && wDist <= 3 ? 'coastal-' + (WK[wCode] || 'water') : 'inland';
    let morphology, streetPattern;
    if (siteType === 'fortress' || siteType === 'pass') [morphology, streetPattern] = ['fortified-ridge', 'contour-following'];
    else if (siteType === 'oasis') [morphology, streetPattern] = ['oasis-radial', 'radial-grove'];
    else if (waterKind === 'seaport' || waterKind === 'island-harbor') [morphology, streetPattern] = ['waterfront-harbor', 'quay-linear'];
    else if (waterKind === 'lakefront') [morphology, streetPattern] = ['lakefront-crescent', 'shore-parallel'];
    else if (waterKind === 'riverfront' || (rDist !== null && rDist <= 3)) [morphology, streetPattern] = ['river-corridor', 'bank-parallel'];
    else if (slopeClass === 'steep' || slopeClass === 'escarpment') [morphology, streetPattern] = ['fortified-ridge', 'contour-following'];
    else if (slopeClass === 'rolling') [morphology, streetPattern] = ['hillside-organic', 'contour-following'];
    else if (wDist !== null && wDist <= 4) [morphology, streetPattern] = ['coastal-terrace', 'shore-parallel'];
    else if (rnd(seed, 1) < profile.grid) [morphology, streetPattern] = ['planned-grid', 'orthogonal'];
    else [morphology, streetPattern] = ['plain-organic', 'organic'];

    // ---- 人口与占地（urban_footprint） ----
    // 分档：送进精细生成器的人口有上限（城心与老城），更大的城市外围由快速城郊算法补齐
    const popFull = M.max(200, city.pop | 0), pop = opts.cap ? M.min(popFull, opts.cap) : popFull, pmin = M.round(pop * 0.85), pmax = M.round(pop * 1.15);
    const estimate = M.round(pmin + (pmax - pmin) * (0.3 + 0.45 * rnd(seed, 0)));
    const tierCore = pop < popFull && city.tier === 'metropolis' ? 'city' : city.tier; // 封顶后的城心按“城市”档定面积
    const area = M.max(MIN_AREA[tierCore] || 0.12, ((pmin + pmax) / 2) / (DENSITY[era] * (TIER_DENSITY[tierCore] || 1)));
    const radiusKm = M.sqrt(area / M.PI);
    const latStep = M.PI / H, lonStep = 2 * M.PI / W;
    const geom = (y, x) => {
      const lat = M.PI / 2 - y * latStep, ang = radiusKm / R, ry = ang / latStep;
      const la = M.abs(lat) + ang >= M.PI / 2 ? M.PI : M.asin(M.min(1, M.sin(ang) / M.cos(lat)));
      const rx = M.min(W / 2, la / lonStep);
      return { ry, rx, bounds: [M.max(0, y - ry), x - rx, M.min(H, y + ry), x + rx], rowKm: latStep * R, colKm: lonStep * R * M.max(M.cos(lat), 1e-12) };
    };
    let g = geom(cy, cx);

    // ---- 港口（city_harbors.derive_harbors 的射线法） ----
    let harbor = null;
    if (siteType === 'port' || siteType === 'island-port' || siteType === 'lake-port') harbor = deriveHarbor();
    function deriveHarbor() {
      const rowKm = g.rowKm, colKm = M.max(0.08 * lonStep * R, g.colKm), maxD = rowKm * 2.5, lake = siteType === 'lake-port';
      const wetAt = (r, c) => lake ? lakeAt(r, c) >= 0.5 : seaAt(r, c) <= 0;
      const scale = M.min(3, M.max(0.6, 0.8 * M.sqrt(pop / 15000)));
      const opts = [];
      for (let a = 0; a < 128; a++) {
        const ang = a / 128 * 2 * M.PI, dx = M.cos(ang) / colKm, dy = M.sin(ang) / rowKm;
        let hi = -1;
        for (let k = 1; k <= 128; k++) { const d = maxD * k / 128; const r = cy + dy * d; if (r < 0 || r > H) break; if (!dryAt(r, cx + dx * d)) { if (wetAt(r, cx + dx * d)) hi = d; break; } }
        if (hi < 0) continue;
        let lo = hi - maxD / 128;
        for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (dryAt(cy + dy * m, cx + dx * m)) lo = m; else hi = m; }
        // 离岸点必须真的在开阔水面上
        const sr = cy + dy * (hi + 0.12), sc = cx + dx * (hi + 0.12);
        if (!wetAt(sr, sc)) continue;
        // 必须是开阔水面：离岸再往外若干距离仍是水（排除近岸细节起伏造出的小水洼）
        if ((lake ? [0.15, 0.3] : [0.3, 0.6, 0.9]).some(ext => !wetAt(cy + dy * (hi + ext), cx + dx * (hi + ext)))) continue;
        opts.push({ a, ang, dx, dy, lo, hi });
      }
      if (!opts.length) return null;
      const minHi = M.min(...opts.map(o => o.hi));
      let best = null;
      for (const o of opts) {
        if (o.hi > minHi + scale * 2) continue;
        const coast = [cx + o.dx * (o.lo + o.hi) / 2, cy + o.dy * (o.lo + o.hi) / 2];
        let land = 0, tot = 0;
        for (const reach of [scale * 0.6, scale * 1.2, scale * 2]) for (let k = 0; k < 17; k++) {
          const pa = o.ang - M.PI / 2 + M.PI * k / 16; tot++;
          if (dryAt(coast[1] + M.sin(pa) * reach / rowKm, coast[0] + M.cos(pa) * reach / colKm)) land++;
        }
        const shelter = land / tot, score = o.hi + scale * (1 - shelter) * 1.8;
        if (!best || score < best.score) best = { ...o, shelter, score, coast };
      }
      const o = best, setback = M.min(2, M.max(0.1, 0.65 * M.sqrt(pop / 15000)));
      // 城市中心：从上岸点沿射线退后 setback 公里的台地（同一条岸、全程在陆上、坡度平缓）
      const shoreD = M.max(0, o.lo - 0.07);
      const shore = [cx + o.dx * shoreD, cy + o.dy * shoreD], sea = [cx + o.dx * (o.hi + 0.12), cy + o.dy * (o.hi + 0.12)];
      let centre = null;
      for (const retreat of [setback, setback * 1.25, setback * 1.65, setback * 0.6, setback * 0.35]) {
        const c = [shore[0] - o.dx * retreat, shore[1] - o.dy * retreat];
        let ok = dryAt(c[1], c[0]);
        for (let t = 1; ok && t < 8; t++) ok = dryAt(c[1] + (shore[1] - c[1]) * t / 8, c[0] + (shore[0] - c[0]) * t / 8);
        if (ok) { centre = c; break; }
      }
      if (!centre) centre = [cx, cy];
      const access = [{ column: centre[0], row: centre[1] }, { column: shore[0], row: shore[1] }];
      const distanceKm = M.hypot((shore[0] - centre[0]) * colKm, (shore[1] - centre[1]) * rowKm);
      cx = centre[0]; cy = centre[1];
      return {
        kind: lake ? 'lake' : 'sea', name: city.name.slice(0, 3) + (lake ? '湖港' : '港'),
        shore: { column: o.coast[0], row: o.coast[1] }, landPoint: { column: shore[0], row: shore[1] }, seaPoint: { column: sea[0], row: sea[1] },
        outward: { x: M.cos(o.ang), y: M.sin(o.ang) }, distanceKm, access,
        shorelineElevationMetres: elevAt(o.coast[1], o.coast[0]), shelter: o.shelter, setting: o.shelter > 0.35 ? 'sheltered-bay' : 'open-coast'
      };
    }
    if (harbor) { const r2 = M.min(H - 1, M.floor(cy)), c2 = wrap(M.floor(cx)); if (!isWater(at(r2, c2))) { row = r2; column = c2; } }
    g = geom(cy, cx);
    const [north, west, south, east] = g.bounds;

    // ---- 可建设格（_buildable_city_cells） ----
    const maxSlope = M.min(1, M.max({ flat: 0.35, gentle: 0.42, rolling: 0.52, steep: 0.64, escarpment: 0.72 }[slopeClass], slope + 0.035));
    const allowed = [], blocked = [], r0 = M.max(0, M.floor(north) - 1), r1 = M.min(H - 1, M.ceil(south) + 1), c0 = M.floor(west) - 1, c1 = M.ceil(east) + 1;
    const seen = new Set();
    for (let r = r0; r <= r1; r++) for (let uc = c0; uc <= c1; uc++) {
      const c = wrap(uc), key = r * W + c; if (seen.has(key)) continue; seen.add(key);
      const ok = !isWater(key) && (riverOrder(key) === 0 || (r === row && c === column)) && nslope(key) <= maxSlope;
      (ok || (r === row && c === column) ? allowed : blocked).push([r, c]);
    }
    allowed.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    // ---- 中心区（_core_count / _core_zones） ----
    const isCapital = city.capital !== undefined, isPort = ['seaport', 'island-harbor', 'lakefront', 'riverfront'].includes(waterKind);
    const tierBase = { site: 1, town: 1, city: 2, metropolis: 3 }[city.tier] || 1;
    const coreCount = M.min(7, M.max(1, tierBase + profile.core + M.max(0, M.floor(M.log10(M.max(1, estimate)) - 5.35))
      + (['seaport', 'island-harbor', 'riverfront'].includes(waterKind) && estimate >= 180000 ? 1 : 0) + (isCapital && estimate >= 100000 ? 1 : 0)
      + (rnd(seed, 3) > 0.8 && (city.tier === 'city' || city.tier === 'metropolis') ? 1 : 0)));
    const roles = [isCapital ? 'government-core' : isPort ? 'harbor-core' : 'central-core'];
    if (isPort && roles.length < coreCount) roles.push('waterfront-core');
    for (let k = roles.length; k < coreCount; k++) roles.push(k === 1 ? 'market-core' : 'district-core');
    const allowSet = new Set(allowed.map(([r, c]) => r * W + c)), inland = ((wBear || 0) + 180) % 360;
    const coreZones = roles.map((role, k) => {
      let orow = 0, ocol = 0;
      if (k) { const spread = 0.28 + 0.36 * rnd(seed, 30 + k), bear = wBear === null ? (rnd(seed, 40 + k) * 360) % 360 : (inland + (rnd(seed, 40 + k) - 0.5) * 125) % 360, rad = bear * M.PI / 180; orow = -M.sin(rad) * g.ry * spread; ocol = M.cos(rad) * g.rx * spread; }
      let zr = cy + orow, zc = cx + ocol;
      for (let t = 0; t < 16 && !allowSet.has(M.floor(zr) * W + wrap(M.floor(zc))); t++) { zr = (zr + cy) / 2; zc = (zc + cx) / 2; }
      return { id: `city-${idx}-core-${k + 1}`, role, row: +zr.toFixed(5), column: +zc.toFixed(5), radiusKm: +M.max(0.18, radiusKm * (0.19 + 0.12 * rnd(seed, 50 + k))).toFixed(3) };
    });
    const landmarks = [];
    if (isCapital) landmarks.push('government-seat');
    if (siteType === 'fortress' || siteType === 'pass') landmarks.push('citadel');
    if (waterKind === 'seaport' || waterKind === 'island-harbor') landmarks.push('harbor', 'lighthouse'); else if (waterKind === 'riverfront' || waterKind === 'lakefront') landmarks.push('river-port');
    if (city.tier === 'city' || city.tier === 'metropolis') landmarks.push(profile.landmark);
    if (coreCount >= 4) landmarks.push('secondary-market');
    const bpattern = isPort ? 'waterfront-mixed-use' : (slopeClass === 'steep' || slopeClass === 'escarpment') ? 'terraced-compounds'
      : { tribal: 'dispersed-compounds', ancient: 'courtyard-blocks', medieval: 'walled-lots', 'early-modern': 'mercantile-blocks', industrial: 'mixed-density-blocks', contemporary: 'mixed-density-blocks' }[era] || 'perimeter-blocks';
    const orientBear = morphology === 'river-corridor' && rBear !== null ? rBear : ['waterfront-harbor', 'lakefront-crescent', 'coastal-terrace'].includes(morphology) ? wBear : null;
    const orientation = orientBear === null ? seed % 360 : (orientBear + 90 + M.round((rnd(seed, 67) - 0.5) * 18) + 360) % 360;
    const wd = WIDTHS[era], ts = TIER_W[city.tier] || 1;

    // ---- 周边场地（city_site_context） ----
    const fullR = M.sqrt(M.max(MIN_AREA[city.tier] || 0.12, popFull / ((DENSITY[era] || 3200) * (TIER_DENSITY[city.tier] || 1))) / M.PI);
    const siteRadius = M.max(5, radiusKm * 5, fullR * 1.7, harbor ? harbor.distanceKm * 1.35 : 0);
    const sb = { north: M.max(0, cy - siteRadius / g.rowKm), west: cx - siteRadius / g.colKm, south: M.min(H, cy + siteRadius / g.rowKm), east: cx + siteRadius / g.colKm };
    const N17 = 17, elev17 = [], rord17 = [];
    for (let r = 0; r < N17; r++) for (let c = 0; c < N17; c++) {
      const yy = sb.north + (sb.south - sb.north) * r / (N17 - 1), xx = sb.west + (sb.east - sb.west) * c / (N17 - 1);
      // 高程服从与海陆同一判定：陆上至少高出海面 2 m，海里不高于 -2 m（否则近岸陆地出现海平面以下的点，生成器会把它填成三角形洼地湖）
      { const s0 = seaAt(yy, xx), lk = lakeAt(yy, xx) >= 0.5; let h = elevAt(yy, xx); if (lk) h = M.max(h, 1); else if (s0 <= 0) h = M.min(h, -2 - M.min(40, -s0 * 0.4)); else h = M.max(h, 2 + M.min(30, s0 * 0.3)); elev17.push(+h.toFixed(2)); }
      rord17.push(riverOrder(at(M.min(H - 1, M.floor(yy)), M.floor(xx))));
    }
    // 水域轮廓：细采样网格上做 marching squares；外圈补一圈与边界重合的陆地，使水体在范围框处闭合（等同于裁剪到范围框）
    const NF = 97, X = k => sb.west + (sb.east - sb.west) * M.min(NF - 1, M.max(0, k - 1)) / (NF - 1), Y = k => sb.north + (sb.south - sb.north) * M.min(NF - 1, M.max(0, k - 1)) / (NF - 1);
    const fine = (fn) => {
      const v = new Float32Array((NF + 2) * (NF + 2)).fill(-1);
      for (let r = 0; r < NF; r++) for (let c = 0; c < NF; c++) v[(r + 1) * (NF + 2) + c + 1] = fn(Y(r + 1), X(c + 1));
      return rings(v, NF + 2, X, Y);
    };
    // 与外海不连通、又不接触图框的小块海水（近岸细节起伏造成）→ 当陆地处理
    { const seaRaw = seaAt, NP = 97, grid = new Uint8Array(NP * NP), lab = new Int32Array(NP * NP), PY = k => sb.north + (sb.south - sb.north) * k / (NP - 1), PX = k => sb.west + (sb.east - sb.west) * k / (NP - 1);
      for (let r = 0; r < NP; r++) for (let c = 0; c < NP; c++) grid[r * NP + c] = seaRaw(PY(r), PX(c)) <= 0 ? 1 : 0;
      const pocket = new Uint8Array(NP * NP); let id = 0;
      for (let s0 = 0; s0 < NP * NP; s0++) { if (!grid[s0] || lab[s0]) continue; id++; const q = [s0]; lab[s0] = id; let edge = false, deep = false;
        for (let h = 0; h < q.length; h++) { const i = q[h], r = (i / NP) | 0, c = i - r * NP; if (r === 0 || c === 0 || r === NP - 1 || c === NP - 1) edge = true; if (seaRaw(PY(r), PX(c)) < -60) deep = true;
          for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= NP || cc >= NP) continue; const j = rr * NP + cc; if (grid[j] && !lab[j]) { lab[j] = id; q.push(j); } } }
        if (!edge && !deep && q.length < NP * NP * 0.03) for (const i of q) pocket[i] = 1; }
      if (pocket.some(v => v)) seaAt = (row, col) => { const r = M.round((row - sb.north) / (sb.south - sb.north) * (NP - 1)), c = M.round((col - sb.west) / (sb.east - sb.west) * (NP - 1));
        if (r >= 0 && c >= 0 && r < NP && c < NP) { for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && cc >= 0 && rr < NP && cc < NP && pocket[rr * NP + cc]) return M.max(2, -seaRaw(row, col)); } } return seaRaw(row, col); }; }
    const bodies = [], shoreSegs = [];
    const onFrame = (p, q) => (p[0] === q[0] && (p[0] === sb.west || p[0] === sb.east)) || (p[1] === q[1] && (p[1] === sb.north || p[1] === sb.south));
    for (const [kind, fn] of [['sea', (r, c) => -seaAt(r, c)], ['finite', (r, c) => lakeAt(r, c) - 0.5]]) {
      const rs = fine(fn); if (!rs.length) continue;
      const inside = (pt, ring) => { let yes = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[j], b = ring[i]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes; } return yes; };
      const depth = rs.map((r, k) => rs.reduce((n, o, j) => n + (j !== k && inside(r[0], o) ? 1 : 0), 0));
      rs.forEach((r, k) => { for (let i = 1; i < r.length; i++) if (!onFrame(r[i - 1], r[i])) shoreSegs.push(r[i - 1], r[i]); if (depth[k] % 2) return;
        const holes = rs.filter((o, j) => depth[j] === depth[k] + 1 && inside(o[0], r));
        let head = 0;
        if (kind === 'finite') { let best = null; for (let rr = M.floor(sb.north); rr <= M.min(H - 1, M.ceil(sb.south)); rr++) for (let cc = M.floor(sb.west); cc <= M.ceil(sb.east); cc++) { const i = at(rr, cc); if (!Hy.lake[i] || !inside([cc + 0.5, rr + 0.5], r)) continue; best = M.max(best === null ? -1e9 : best, Hy.filled[i]); } head = best === null ? 0 : +best.toFixed(2); }
        bodies.push({ kind, headMetres: head, geometry: { type: 'Polygon', coordinates: [r, ...holes] } });
      });
    }
    // 17×17 采样：水域类别与到真实岸线的带符号距离（单位：原生格）
    const water17 = [], clear17 = [];
    for (let r = 0; r < N17; r++) for (let c = 0; c < N17; c++) {
      const yy = sb.north + (sb.south - sb.north) * r / (N17 - 1), xx = sb.west + (sb.east - sb.west) * c / (N17 - 1);
      const dry = dryAt(yy, xx), code = dry ? 0 : lakeAt(yy, xx) >= 0.5 ? 2 : 1;
      let d = M.hypot(W, H);
      for (let k = 0; k < shoreSegs.length; k += 2) { const a = shoreSegs[k], b = shoreSegs[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? M.max(0, M.min(1, ((xx - a[0]) * dx + (yy - a[1]) * dy) / L)) : 0; d = M.min(d, M.hypot(xx - a[0] - dx * t, yy - a[1] - dy * t)); }
      water17.push(code); clear17.push(+(dry ? d : -d).toFixed(5));
    }
    // 城市锚点必须落在连续陆面上
    if (!dryAt(cy, cx)) { for (let k = 1; k <= 40; k++) { const a = k * 2.4; const yy = cy + M.sin(a) * k * 0.02, xx = cx + M.cos(a) * k * 0.02; if (dryAt(yy, xx)) { cy = yy; cx = xx; break; } } }

    // 淡水来源（_freshwater_source）
    let src = null;
    for (let dy = -18; dy <= 18; dy++) { const rr = row + dy; if (rr < 0 || rr >= H) continue;
      for (let dx = -18; dx <= 18; dx++) { const i = at(rr, column + dx), riv = riverOrder(i) > 0, lk = !!Hy.lake[i]; if (!riv && !lk) continue;
        const d = M.hypot(dy * g.rowKm, dx * g.colKm); if (!src || d < src.d) src = { d, rr, cc: column + dx, riv, i }; } }
    // 世界真实河道：裁到周边范围，加密并按河宽加河曲；宽度按流量（≈4.5·√Q），入海入湖处展宽成河口
    const riversOut = [];
    { const Rv = Hy.rivers, bw = sb.east - sb.west, bh = sb.south - sb.north, pad = 0.12, nmR = G.Noise.simplex2(cfg.seed + 5151);
      const inB = (x, y) => x >= sb.west - bw * pad && x <= sb.east + bw * pad && y >= sb.north - bh * pad && y <= sb.south + bh * pad;
      const kmx = g.colKm, kmy = g.rowKm, width = q => { q = M.max(1, q); return M.max(5, q < 20000 ? 2.1 * M.sqrt(q) : 297 * M.pow(q / 20000, 0.3)); }; // 大河之间仍有宽窄之分，汇合后变宽
      const raw = [];
      for (let k = 0; k < Rv.offs.length - 1; k++) for (const off of [-W, 0, W]) {
        const a = Rv.offs[k], z = Rv.offs[k + 1]; let seg = [], touchesEnd = false;
        const flush = () => { if (seg.length >= 2) raw.push({ seg, mouth: touchesEnd }); seg = []; touchesEnd = false; };
        for (let v = a; v < z; v++) { const x = Rv.pts[v * 7] + off, y = Rv.pts[v * 7 + 1], q = Rv.pts[v * 7 + 2];
          if (inB(x, y)) { if (!seg.length && v > a) seg.push({ x: Rv.pts[(v - 1) * 7] + off, y: Rv.pts[(v - 1) * 7 + 1], q: Rv.pts[(v - 1) * 7 + 2] }); seg.push({ x, y, q }); if (v === z - 1) touchesEnd = true; }
          else if (seg.length) { seg.push({ x, y, q }); flush(); } }
        flush(); }
      // 第一步：加密（Catmull-Rom，约 80 m），判定河口并向水中延伸
      const items = [];
      for (const { seg, mouth: endHere } of raw) {
        const dense = [];
        for (let i = 0; i < seg.length - 1; i++) { const p0 = seg[M.max(0, i - 1)], p1 = seg[i], p2 = seg[i + 1], p3 = seg[M.min(seg.length - 1, i + 2)];
          const L = M.hypot((p2.x - p1.x) * kmx, (p2.y - p1.y) * kmy), n = M.max(1, M.ceil(L / 0.08));
          for (let s2 = 0; s2 < n; s2++) { const t = s2 / n, t2 = t * t, t3 = t2 * t, cr = (a0, a1, a2, a3) => 0.5 * (2 * a1 + (-a0 + a2) * t + (2 * a0 - 5 * a1 + 4 * a2 - a3) * t2 + (-a0 + 3 * a1 - 3 * a2 + a3) * t3);
            dense.push({ x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y), q: p1.q + (p2.q - p1.q) * t }); } }
        dense.push({ ...seg[seg.length - 1] });
        // 河口：河段在大地图上止于水边，但周边图的海岸带细节起伏，二者略有偏差——沿流向继续前探，2.5 km 内碰到水面就一直延伸进水里 0.3 km
        let mouth = false;
        const Ez = seg[seg.length - 1], isJunction = raw.some(o => o.seg !== seg && M.hypot((o.seg[0].x - Ez.x) * kmx, (o.seg[0].y - Ez.y) * kmy) < 0.05);
        if (endHere && !isJunction && dense.length >= 2) { const A = dense[M.max(0, dense.length - 4)], B = dense[dense.length - 1], L = M.hypot((B.x - A.x) * kmx, (B.y - A.y) * kmy) || 1, ux = (B.x - A.x) * kmx / L, uy = (B.y - A.y) * kmy / L;
          const wetAt = (p) => seaAt(p.y, p.x) <= -2 || lakeAt(p.y, p.x) >= 0.6; let reach = -1;
          for (let d = 0; d <= 2.5; d += 0.05) { const p = { x: B.x + ux * d / kmx, y: B.y + uy * d / kmy }; if (wetAt(p)) { reach = d; break; } }
          let vx = ux, vy = uy;
          if (reach < 0) { // 正前方没有水：在 1.5 km 内各方向找最近的水面（偏离流向越多代价越高）
            let best = null; for (let ang = 0; ang < 360; ang += 10) { const t = ang * M.PI / 180, cx2 = M.cos(t), cy2 = M.sin(t), dev = 1 + 0.6 * (1 - (cx2 * ux + cy2 * uy));
              for (let d = 0.05; d <= 1.5; d += 0.05) { if (best && d * dev >= best.cost) break; const p = { x: B.x + cx2 * d / kmx, y: B.y + cy2 * d / kmy }; if (wetAt(p)) { best = { cost: d * dev, d, cx2, cy2 }; break; } } }
            if (best) { reach = best.d; vx = best.cx2; vy = best.cy2; } }
          if (reach >= 0) { mouth = true; for (let d = 0.08; d <= reach + 0.3; d += 0.08) dense.push({ x: B.x + vx * d / kmx, y: B.y + vy * d / kmy, q: B.q }); } }
        items.push({ dense, mouth, junction: false });
      }
      // 汇口下游：流量取各汇入河段之和（宽度随之变宽），否则汇合后的河看起来比上游还窄，像两河交叉
      for (const down of items) { const S0 = down.dense[0]; const inc = items.filter(o => o !== down && !o.mouth && M.hypot((o.dense[o.dense.length - 1].x - S0.x) * kmx, (o.dense[o.dense.length - 1].y - S0.y) * kmy) < 0.05); if (inc.length < 2) continue;
        const sumQ = inc.reduce((t, o) => t + o.dense[o.dense.length - 1].q, 0); for (const p of down.dense) p.q = M.max(p.q, sumQ); }
      // 第二步：汇流整形——同一交汇点汇入的几段里流量最大者为干流，其余支流的末段改为平滑曲线，顺干流下游方向以锐角汇入
      const kmD = (a, b) => M.hypot((a.x - b.x) * kmx, (a.y - b.y) * kmy);
      for (const trib of items) {
        if (trib.mouth) continue; const D = trib.dense, J = D[D.length - 1];
        const down = items.find(o => o !== trib && kmD(o.dense[0], J) < 0.05); if (!down) continue;
        const peers = items.filter(o => o !== trib && !o.mouth && kmD(o.dense[o.dense.length - 1], J) < 0.05);
        if (peers.some(o => o.dense[o.dense.length - 1].q > J.q)) {
          // 本段是支流：取干流下游方向
          const d0 = down.dense[0], d1 = down.dense[M.min(down.dense.length - 1, 4)], dl = kmD(d0, d1) || 1, ux = (d1.x - d0.x) * kmx / dl, uy = (d1.y - d0.y) * kmy / dl;
          const wMain = width(down.dense[0].q) / 1000, Lj = M.max(0.6, wMain * 6);
          let k0 = D.length - 1; while (k0 > 0 && kmD(D[k0], J) < Lj) k0--;
          const P0 = D[k0], Jk = { x: 0, y: 0 }, toK = (p) => ({ x: (p.x - J.x) * kmx, y: (p.y - J.y) * kmy });
          const p0 = toK(P0), end = { x: ux * wMain * 0.8, y: uy * wMain * 0.8 }, ctrl = { x: -ux * Lj * 0.5, y: -uy * Lj * 0.5 };
          const n = M.max(4, M.ceil(Lj / 0.08)), curve = [];
          for (let s2 = 1; s2 <= n; s2++) { const t = s2 / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; const kx = a * p0.x + b * ctrl.x + c * end.x, ky = a * p0.y + b * ctrl.y + c * end.y; curve.push({ x: J.x + kx / kmx, y: J.y + ky / kmy, q: J.q }); }
          trib.dense = D.slice(0, k0 + 1).concat(curve); trib.junction = true; void Jk;
        }
      }
      // 第三步：河曲与宽度；两端（交汇点、范围边缘、河口）渐收，保证各段在交汇处严丝合缝
      for (const { dense, mouth } of items) {
        const acc = [0]; for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + kmD(dense[i], dense[i - 1]));
        const total = acc[acc.length - 1], outPts = [], phase = riversOut.length * 2.399;
        for (let i = 0; i < dense.length; i++) { const p = dense[i], wKm = width(p.q) / 1000, lam = M.max(1.2, wKm * 22), amp = M.min(0.28, wKm * 0.9 + 0.04);
          const a = dense[M.max(0, i - 1)], z = dense[M.min(dense.length - 1, i + 1)], tx = (z.x - a.x) * kmx, ty = (z.y - a.y) * kmy, tl = M.hypot(tx, ty) || 1;
          const taper = M.max(0, M.min(1, acc[i] / 0.8, (total - acc[i]) / (mouth ? 1.2 : 0.8)));
          const m = amp * taper * M.sin(acc[i] / lam * 2 * M.PI + phase + 1.6 * nmR(acc[i] * 0.12, phase)); // 舒缓的河曲：波长随河宽、相位缓慢漂移
          let nx = p.x - ty / tl * m / kmx, ny = p.y + tx / tl * m / kmy;
          if (i < dense.length - 3 && (seaAt(ny, nx) <= 0 || lakeAt(ny, nx) >= 0.5)) { nx = p.x; ny = p.y; }
          let w = width(p.q) * (1 + 0.08 * nmR(acc[i] * 0.25, phase + 7)); if (mouth) { const d = total - acc[i]; if (d < 1.5) w *= 1 + 1.4 * (1 - d / 1.5) ** 2; }
          outPts.push({ column: +nx.toFixed(5), row: +ny.toFixed(5), widthMetres: +w.toFixed(1) }); }
        riversOut.push({ points: outPts, mouth, maxWidthMetres: M.max(...outPts.map(p => p.widthMetres)) });
      } }
    const strategic = ['fortress', 'pass', 'oasis'].includes(siteType);
    const source = !src || src.d > siteRadius
      ? { kind: strategic ? 'groundwater' : 'spring-fed-stream', location: { row: cy, column: cx }, distanceKm: null, referenceWidthMetres: M.max(2, 0.5 * M.sqrt(siteRadius * siteRadius * 0.6)) }
      : { kind: src.riv ? 'river' : 'lake', location: { row: src.rr + 0.5, column: src.cc + 0.5 }, distanceKm: +src.d.toFixed(3), referenceWidthMetres: src.riv ? M.min(900, M.max(4, 9 * M.sqrt(Hy.q[src.i] / qth))) : 4 };

    // 交通走廊：与场地范围（+20%）相交的道路与铁路片段（线段裁剪，等同 shapely intersection）
    const pad = 0.2, wb = { n: sb.north - (sb.south - sb.north) * pad, s: sb.south + (sb.south - sb.north) * pad, w: sb.west - (sb.east - sb.west) * pad, e: sb.east + (sb.east - sb.west) * pad };
    const clip = (x0, y0, x1, y1) => { let t0 = 0, t1 = 1; const dx = x1 - x0, dy = y1 - y0;
      for (const [p, q] of [[-dx, x0 - wb.w], [dx, wb.e - x0], [-dy, y0 - wb.n], [dy, wb.s - y0]]) { if (p === 0) { if (q < 0) return null; continue; } const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } }
      return [x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1, t0, t1]; };
    const corridors = []; let cid = 0;
    for (const [k, kind] of [['trunk', 'road'], ['regional', 'road'], ['local', 'road'], ['rail', 'rail']]) for (const l of (Cv.roads[k] || [])) {
      if (l.length < 4) continue;
      for (const off of [-W, 0, W]) { let cur = [];
        const flush = () => { if (cur.length >= 2) corridors.push({ id: `corridor-${k}-${cid++}`, kind, points: cur }); cur = []; };
        for (let i = 2; i < l.length; i += 2) { const s0 = clip(l[i - 2] + off, l[i - 1], l[i] + off, l[i + 1]);
          if (!s0) { flush(); continue; }
          if (!cur.length || s0[4] > 0) { flush(); cur.push({ column: s0[0], row: s0[1] }); }
          cur.push({ column: s0[2], row: s0[3] }); if (s0[5] < 1) flush(); }
        flush(); }
    }
    if (harbor) corridors.push({ id: `city-${idx}-harbor-access`, kind: 'road', points: harbor.access });
    const country = city.country >= 0 ? Cv.countries[city.country] : null, lib = Cv.libs.find(l => l.id === city.lib) || Cv.libs[0];
    const named = [];
    (Cv.labels || []).forEach((l, k) => { if (l.y >= sb.north && l.y <= sb.south && l.x >= sb.west && l.x <= sb.east) named.push({ id: 'label-' + k, name: l.name, kind: l.type, location: { row: l.y, column: l.x } }); });
    (Cv.riverNames || []).forEach((l, k) => { if (l.y >= sb.north && l.y <= sb.south && l.x >= sb.west && l.x <= sb.east) named.push({ id: 'river-' + k, name: l.name, kind: 'river', location: { row: l.y, column: l.x } }); });

    const recipe = {
      id: 'city-' + idx, name: city.name, location: { row: cy, column: cx }, anchorCell: { row, column }, seed, tier: city.tier, siteType, era,
      population: { minimum: pmin, maximum: pmax, estimate },
      urban: {
        targetFootprintKm2: area, targetEquivalentGridCells: area / (g.rowKm * g.colKm), areaSemantics: 'target-before-native-terrain-mask', radiusKm,
        coordinateSpace: 'world-grid-cells', bounds: { north, west, south, east }, radiusRows: g.ry, radiusColumns: g.rx,
        gridCellKilometres: { row: g.rowKm, column: g.colKm },
        streetWidthsMetres: { arterial: +(wd[0] * ts).toFixed(1), collector: +(wd[1] * ts).toFixed(1), local: +(wd[2] * ts).toFixed(1) },
        clipToLand: true, coreCount, coreZones, cluster: { id: null, memberCount: 1, role: 'standalone' }
      },
      morphology: { kind: morphology, streetPattern, buildingPattern: bpattern, orientationDegrees: orientation, blockAspect: +(0.65 + 1.2 * rnd(seed, 4)).toFixed(3), streetIrregularity: +(0.12 + 0.78 * rnd(seed, 5)).toFixed(3) },
      water: { kind: waterKind, nearestWaterKind: WK[wCode] || null, distanceCells: wDist, riverDistanceCells: rDist, riverOrder: rOrd || 0, waterBearingDegrees: wBear, riverBearingDegrees: rBear },
      terrain: {
        slopeClass, slope: +slope.toFixed(4), elevation: +e[anchor].toFixed(1),
        constraints: { avoidWater: true, avoidRiverChannel: true, maximumBuildableSlope: +maxSlope.toFixed(4) },
        buildable: { coordinateSpace: 'world-grid-cells', precision: 'native-grid-cell', bounds: { north: r0, west: c0, south: r1, east: c1 }, allowedCells: allowed, blockedCells: blocked, allowedCellCount: allowed.length, blockedCellCount: blocked.length, clipCityGeometry: true }
      },
      culture: { civilizationId: city.civ, languageId: city.lang, religionId: city.rel, stateId: city.country, libraryId: lib.id, libraryLabel: lib.label, government: country ? country.form : null, isCapital, stateName: country ? country.name : null, holyReligion: null },
      landmarks: [...new Set(landmarks)],
      transport: { roadConnections: 0, railConnections: 0, riverConnections: 0, seaConnections: harbor ? 1 : 0, lakeConnections: 0, bridgeCount: 0, interfaces: [], corridors },
      harbor
    };
    const ifc = recipe.transport.interfaces;
    if (corridors.some(c => c.kind === 'road')) ifc.push('road-gate');
    if (corridors.some(c => c.kind === 'rail')) ifc.push('rail-terminal');
    if (waterKind === 'riverfront') ifc.push('river-landing');
    if (harbor || waterKind === 'lakefront') ifc.push('port-quay');
    recipe.transport.roadConnections = corridors.filter(c => c.kind === 'road').length;
    const site = {
      schema: 'city-site-context-v2', bounds: sb, rows: N17, columns: N17, elevationMetres: elev17, water: water17, shorelineClearanceNativeCells: clear17, waterBodies: bodies, riverOrder: rord17, rivers: riversOut,
      radiusKm: +siteRadius.toFixed(3), latitudeDegrees: 90 - cy / H * 180, gridCellKilometres: { row: g.rowKm, column: g.colKm }, source, namedFeatures: named
    };
    return { grid: { width: W, height: H }, recipe, site, lib, country: country ? country.name : null };
  }

  // marching squares（值 >0 为水），返回闭合环 [[x,y],...]
  function rings(v, n, X, Y) {
    const segs = [], key = (x, y) => M.round(x * 1e6) + ',' + M.round(y * 1e6);
    const ip = (a, b, va, vb) => { const t = va / (va - vb); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
      const a = v[r * n + c], b = v[r * n + c + 1], d = v[(r + 1) * n + c], cc = v[(r + 1) * n + c + 1];
      const code = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (cc > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
      if (!code || code === 15) continue;
      const T = ip([c, r], [c + 1, r], a, b), Rt = ip([c + 1, r], [c + 1, r + 1], b, cc), B = ip([c, r + 1], [c + 1, r + 1], d, cc), L = ip([c, r], [c, r + 1], a, d);
      const add = (p, q) => segs.push([p, q]);
      switch (code) {
        case 1: case 14: add(L, B); break; case 2: case 13: add(B, Rt); break; case 3: case 12: add(L, Rt); break;
        case 4: case 11: add(T, Rt); break; case 6: case 9: add(T, B); break; case 7: case 8: add(L, T); break;
        case 5: case 10: { const ctr = (a + b + cc + d) / 4 > 0; if ((code === 10) === ctr) { add(L, T); add(B, Rt); } else { add(L, B); add(T, Rt); } }
      }
    }
    const adj = new Map(); segs.forEach((s, k) => { for (const p of s) { const kk = key(p[0], p[1]); (adj.get(kk) || adj.set(kk, []).get(kk)).push(k); } });
    const used = new Uint8Array(segs.length), out = [];
    for (let s0 = 0; s0 < segs.length; s0++) {
      if (used[s0]) continue; used[s0] = 1;
      const ring = [segs[s0][0], segs[s0][1]]; let cur = segs[s0][1];
      for (let guard = 0; guard < segs.length; guard++) {
        const l = adj.get(key(cur[0], cur[1])); let nx = -1; for (const s of l) if (!used[s]) { nx = s; break; }
        if (nx < 0) break; used[nx] = 1; const s = segs[nx]; cur = key(s[0][0], s[0][1]) === key(cur[0], cur[1]) ? s[1] : s[0]; ring.push(cur);
      }
      if (ring.length < 4) continue;
      const pts = ring.map(p => [+X(p[0]).toFixed(7), +Y(p[1]).toFixed(7)]);
      pts[pts.length - 1] = pts[0].slice();
      out.push(pts);
    }
    return out;
  }

  G.CitySite = { payload };
})(typeof self !== 'undefined' ? self : this);
