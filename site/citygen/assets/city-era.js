/* Era grammars for the city planner.
 * Classical antiquity: Hippodamian grids, Roman castra, Chinese lifang wards, temple cities.
 * Industrial age: preserved old core, ring boulevard on the former wall line, survey-grid
 * extension (chamfered ensanche / radial boulevards / worker terraces), rail-fed industry.
 * Also owns the flat footprints ("plan materials") of era-specific monuments. */
(function (global) {
  'use strict';

  const ERAS = Object.freeze([
    {id: 'ancient', label: '古典时代'},
    {id: 'medieval', label: '中世纪'},
    {id: 'early-modern', label: '近世'},
    {id: 'preindustrial', label: '前工业时代'},
    {id: 'industrial', label: '工业时代'}
  ]);
  const ERA_LABEL = Object.fromEntries(ERAS.map(era => [era.id, era.label]));

  const GRAMMARS = Object.freeze({
    hippodamian: {label: '希波丹姆网格城', summary: '长条街区网格 · 中心广场 · 剧场与神庙'},
    castrum: {label: '罗马营寨城', summary: '十字主街 · 广场 · 浴场与竞技场'},
    lifang: {label: '里坊制城市', summary: '方格坊墙 · 中轴大街 · 东西两市'},
    'temple-city': {label: '神庙城邦', summary: '有机街巷 · 塔庙圣域 · 宫殿卫城'},
    ensanche: {label: '工业扩展区（切角街区）', summary: '旧城 · 环城大道 · 切角网格新区 · 铁路工业带'},
    boulevard: {label: '工业城市（放射林荫大道）', summary: '旧城 · 环城大道 · 放射大道 · 公园与工厂区'},
    'mill-town': {label: '工业城市（工人联排街区）', summary: '旧城 · 河岸铁路工厂 · 密集工人联排住宅'}
  });

  function mix(seed, salt) {
    let x = (seed ^ Math.imul((salt + 0x9e3779b9) | 0, 0x85ebca6b)) >>> 0;
    x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0;
    x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }

  /* Which urban grammar this era and building tradition produces. */
  function grammar(recipe, {small, mobile, military, layout}) {
    if (mobile || small || military || !layout) return null;
    const era = recipe.era, tradition = layout.monumentTradition, architecture = layout.architecture;
    const eastAsian = tradition === 'east-asian' || recipe.naming?.culture === 'han';
    const roll = mix((recipe.seed >>> 0) || 1, 7171);
    if (era === 'ancient') {
      if (eastAsian) return {id: 'lifang'};
      if (['west-asian', 'mesopotamian', 'south-asian'].includes(tradition)) return {id: 'temple-city'};
      const steep = ['steep', 'escarpment'].includes(recipe.terrain?.slopeClass);
      return {id: steep || roll < .5 ? 'hippodamian' : 'castrum'};
    }
    if (era === 'industrial') {
      let id;
      if (architecture === 'arcaded' || tradition === 'classical') id = roll < .65 ? 'ensanche' : 'boulevard';
      else if (['timber-frame', 'terraced', 'canal-side', 'stone-masonry'].includes(architecture))
        id = roll < .45 ? 'mill-town' : roll < .78 ? 'boulevard' : 'ensanche';
      else id = roll < .4 ? 'ensanche' : roll < .75 ? 'boulevard' : 'mill-town';
      return {id, industrial: true};
    }
    return null;
  }

  /* Adjust a character profile so the planner follows the era grammar. */
  function adjustProfile(profile, recipe, {openGround, layout, population}) {
    const plan = grammar(recipe, {...profile, layout});
    if (!plan) return profile;
    const steep = ['steep', 'escarpment'].includes(recipe.terrain?.slopeClass);
    const result = {...profile, eraPlan: {...plan, label: GRAMMARS[plan.id].label, summary: GRAMMARS[plan.id].summary}};
    const mechanisms = {...profile.mechanisms};
    const morphology = {...profile.morphology};
    if (plan.id === 'hippodamian' || plan.id === 'castrum') {
      result.plan = 'orthogonal';
      result.regular = !steep;
      result.rectangular = result.regular && plan.id === 'castrum' && openGround;
      Object.assign(mechanisms, {wards: false, ceremonial: false, waterfront: false, multiPhase: false, sacredMarket: false});
      Object.assign(morphology, plan.id === 'hippodamian'
        ? {blockAspect: 2.15, householdsPerBlock: 11, streetVariation: .04}
        : {blockAspect: 1.2, householdsPerBlock: 15, streetVariation: .04});
    } else if (plan.id === 'lifang') {
      result.plan = 'axial';
      result.regular = !steep;
      result.rectangular = result.regular && openGround;
      Object.assign(mechanisms, {wards: result.regular, ceremonial: result.regular, waterfront: false, multiPhase: false});
      Object.assign(morphology, {blockAspect: 1.3, householdsPerBlock: Math.max(morphology.householdsPerBlock, 30)});
    } else if (plan.id === 'temple-city') {
      Object.assign(mechanisms, {wards: false, ceremonial: false, multiPhase: false, sacredMarket: true});
      Object.assign(morphology, {streetVariation: Math.max(.62, morphology.streetVariation)});
    } else if (plan.industrial) {
      result.plan = 'industrial';
      result.regular = false;
      result.rectangular = false;
      Object.assign(mechanisms, {wards: false, ceremonial: false, multiPhase: false, waterfront: false, sacredMarket: false});
      Object.assign(morphology, {householdsPerBlock: plan.id === 'mill-town' ? 26 : 22});
      if (recipe.localSite?.schema !== 'city-local-site-v1' && recipe.urban?.radiusKm)
        result.settlementRadiusKm = Math.min(recipe.urban.radiusKm * 1.35, Math.max(.35, Math.sqrt(population / 14000 / Math.PI)));
    }
    result.mechanisms = mechanisms;
    result.morphology = morphology;
    return result;
  }

  /* Recipe preprocessing: era / culture preset, industrial growth and rail. */
  function apply(recipe, {era = null, culture = null} = {}) {
    const result = structuredClone(recipe);
    if (culture) {
      result.culture = {...result.culture, ...structuredClone(culture.culture),
        isCapital: recipe.culture?.isCapital, stateName: recipe.culture?.stateName, holyReligion: recipe.culture?.holyReligion,
        stateId: recipe.culture?.stateId};
      if (result.culture.government === 'nomadic-confederacy') result.culture.government = 'bureaucratic-monarchy';
      if (culture.naming) result.naming = structuredClone(culture.naming);
      if (culture.namePool) result.namePool = structuredClone(culture.namePool);
    }
    if (era) result.era = era;
    if (result.era === 'industrial' && !result.eraPrepared) {
      const growth = 2.2, population = result.population;
      result.population = {...population, minimum: Math.round(population.minimum * growth),
        maximum: Math.round(population.maximum * growth), estimate: Math.round(population.estimate * growth)};
      const widths = result.urban.streetWidthsMetres || {arterial: 11, collector: 5.6, local: 3};
      result.urban = {...result.urban, streetWidthsMetres: {arterial: Math.max(18, widths.arterial * 1.7),
        collector: Math.max(10, widths.collector * 1.8), local: Math.max(5, widths.local * 1.6)}};
      result.landmarks = Array.from(new Set([...(result.landmarks || []), 'railway-station', 'factory-district']));
      result.eraPrepared = true;
    }
    return result;
  }

  /* ---------- plan materials: monument footprints (metres, local frame) ----------
   * The local frame has x along the frontage, y pointing away from the street
   * (negative y = back of the plot). Each part: {points, roof, feature, fill?}.
   * decor: polylines painted as fine detail on top of the part fills. */
  const rect = (x, y, w, h) => [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]];
  const ellipse = (x, y, rx, ry, n = 40) => Array.from({length: n}, (_, i) => [x + Math.cos(i / n * Math.PI * 2) * rx, y + Math.sin(i / n * Math.PI * 2) * ry]);
  const arc = (x, y, r, a0, a1, n = 24) => Array.from({length: n + 1}, (_, i) => {
    const a = a0 + (a1 - a0) * i / n; return [x + Math.cos(a) * r, y + Math.sin(a) * r];
  });
  const band = (x, y, r0, r1, a0, a1, n = 28) => arc(x, y, r1, a0, a1, n).concat(arc(x, y, r0, a1, a0, n));
  const ellipseLine = (x, y, rx, ry, n = 48) => ellipse(x, y, rx, ry, n).concat([[x + rx, y]]);

  const STONE = '#cdbf9f', STONE_DARK = '#b4a582', MARBLE = '#e6dcc3', SAND = '#e5d4a6', WATER = '#9fc7d3',
    BRICK = '#a8644d', BRICK_LIGHT = '#bd7c60', SLATE = '#7d8e93', IRON = '#6f7a7a', GLASS = '#b7cdcb', COAL = '#6c675c',
    GREEN = '#cfdcbf', LAWN = '#c4d6ad';

  function colonnade(points, count, inset = 1.4) {
    const [[x0, y0], [x1], , [, y3]] = points, horizontal = Math.abs(x1 - x0) >= Math.abs(y3 - y0), lines = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      if (horizontal) { const x = x0 + inset + (x1 - x0 - inset * 2) * t; lines.push([[x, y0 + inset], [x, y3 - inset]]); }
      else { const y = y0 + inset + (y3 - y0 - inset * 2) * t; lines.push([[x0 + inset, y], [x1 - inset, y]]); }
    }
    return lines;
  }

  function monument(kind, w, h, context = {}) {
    // w, h: half extents (metres). Returns {parts, decor, plaza?, size}
    const parts = [], decor = [];
    const add = (points, roof, feature, fill) => parts.push({points, roof, feature, ...(fill ? {fill} : {})});
    if (kind === 'forum' || kind === 'agora') {
      const roman = kind === 'forum';
      const templeW = Math.min(26, w * .42), templeH = Math.min(40, h * .55);
      if (roman) {
        add(rect(0, -h + templeH / 2 + 3, templeW, templeH), 'gable', 'capitolium', MARBLE);
        decor.push(...colonnade(rect(0, -h + 3 + templeH * .82, templeW * .9, templeH * .3), 6));
        decor.push(...[0, 1, 2, 3].map(i => [[-templeW / 2 + 2, h * 0 - h + templeH + 3 + i * 1.6], [templeW / 2 - 2, -h + templeH + 3 + i * 1.6]]));
        const basilicaH = Math.min(26, w * .32), basilicaL = Math.min(110, h * 1.5);
        add(rect(w - basilicaH / 2 - 2, h * .1, basilicaH, basilicaL), 'gable', 'basilica', STONE);
        add(ellipse(w - basilicaH / 2 - 2, h * .1 - basilicaL / 2, basilicaH * .38, basilicaH * .3, 20).filter(([, y]) => y <= h * .1 - basilicaL / 2 + .01)
          .concat([[w - basilicaH / 2 - 2 - basilicaH * .38, h * .1 - basilicaL / 2]]), 'flat', 'apse', STONE_DARK);
        const porticoL = Math.min(130, h * 1.7);
        add(rect(-w + 5, h * .05, 8, porticoL), 'flat', 'portico', STONE);
        decor.push(...colonnade(rect(-w + 5, h * .05, 8, porticoL), Math.max(6, Math.round(porticoL / 6))));
        add(rect(-templeW / 2 - 12, -h + 12, 14, 18), 'gable', 'curia', STONE_DARK);
        add(rect(0, h - 5, Math.min(w * 1.5, 120), 8), 'flat', 'tabernae', STONE);
        decor.push(...colonnade(rect(0, h - 5, Math.min(w * 1.5, 120), 8), Math.max(6, Math.round(Math.min(w * 1.5, 120) / 6))));
      } else {
        const stoaL = Math.min(150, w * 1.8);
        add(rect(0, -h + 6, stoaL, 11), 'flat', 'stoa', MARBLE);
        decor.push(...colonnade(rect(0, -h + 6, stoaL, 11), Math.max(8, Math.round(stoaL / 5))));
        const sideL = Math.min(110, h * 1.6);
        add(rect(-w + 6, -h + 12 + sideL / 2, 11, sideL), 'flat', 'stoa', MARBLE);
        decor.push(...colonnade(rect(-w + 6, -h + 12 + sideL / 2, 11, sideL), Math.max(6, Math.round(sideL / 5))));
        add(rect(w - 16, -h + 30, 24, 24), 'hip', 'bouleuterion', STONE);
        decor.push(...[6, 9].map(r => ellipseLine(w - 16, -h + 30, r, r, 20)));
        add(rect(w * .25, h * .2, 14, 22), 'gable', 'agora-temple', MARBLE);
        decor.push(...colonnade(rect(w * .25, h * .2, 14, 22), 4));
        decor.push(ellipseLine(-w * .1, h * .3, 2.5, 2.5, 12));
      }
      return {parts, decor, plaza: true};
    }
    if (kind === 'theatre' || kind === 'roman-theatre') {
      const R = Math.min(w, h * 1.7, 62), cx = 0, cy = Math.min(h - R * .3, R * .45);
      const greek = kind === 'theatre', a0 = greek ? Math.PI * .88 : Math.PI, a1 = greek ? Math.PI * 2.12 : Math.PI * 2;
      add(band(cx, cy, R * .3, R, a0, a1, 32), 'flat', 'cavea', STONE);
      add(greek ? ellipse(cx, cy, R * .3, R * .3, 28) : arc(cx, cy, R * .3, Math.PI, Math.PI * 2, 16), 'flat', 'orchestra', MARBLE);
      add(rect(cx, cy + R * (greek ? .42 : .1), R * (greek ? 1.0 : 2.0), R * .14), 'gable', 'scaena', STONE_DARK);
      for (let i = 1; i <= 7; i++) decor.push(arc(cx, cy, R * (.3 + .7 * i / 8), a0, a1, 32));
      for (let i = 0; i <= 8; i++) { const a = a0 + (a1 - a0) * i / 8; decor.push([[cx + Math.cos(a) * R * .32, cy + Math.sin(a) * R * .32], [cx + Math.cos(a) * R * .98, cy + Math.sin(a) * R * .98]]); }
      return {parts, decor};
    }
    if (kind === 'amphitheatre') {
      const rx = Math.min(w, 92), ry = Math.min(h, rx * .82);
      add(ellipse(0, 0, rx, ry, 48), 'flat', 'cavea', STONE);
      add(ellipse(0, 0, rx * .47, ry * .38, 40), 'flat', 'arena', SAND);
      for (let i = 1; i <= 5; i++) { const t = .47 + (1 - .47) * i / 6, s = .38 + (1 - .38) * i / 6; decor.push(ellipseLine(0, 0, rx * t, ry * s, 48)); }
      for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; decor.push([[Math.cos(a) * rx * .5, Math.sin(a) * ry * .41], [Math.cos(a) * rx * .98, Math.sin(a) * ry * .98]]); }
      return {parts, decor};
    }
    if (kind === 'baths') {
      const W = Math.min(w, 60), H = Math.min(h, 48);
      add(rect(0, -H * .35, W * 2, H * .9), 'flat', 'bath-block', STONE);
      add(ellipse(0, -H * .78, Math.min(W * .3, 16), Math.min(W * .3, 16), 28), 'dome', 'caldarium', STONE_DARK);
      add(rect(0, -H * .3, W * .55, H * .32), 'flat', 'frigidarium-pool', WATER);
      add(rect(-W * .68, -H * .35, W * .3, H * .4), 'flat', 'tepidarium', MARBLE);
      add(rect(W * .68, -H * .35, W * .3, H * .4), 'flat', 'tepidarium', MARBLE);
      add(rect(0, H * .48, W * 1.8, H * .08), 'flat', 'palaestra-portico', STONE);
      add(rect(-W * .95, H * .3, W * .1, H * .45), 'flat', 'palaestra-portico', STONE);
      add(rect(W * .95, H * .3, W * .1, H * .45), 'flat', 'palaestra-portico', STONE);
      add(rect(0, H * .25, W * .7, H * .18), 'flat', 'natatio', WATER);
      decor.push(...colonnade(rect(0, H * .48, W * 1.8, H * .08), 14));
      return {parts, decor};
    }
    if (kind === 'gymnasium') {
      const W = Math.min(w, 70), H = Math.min(h, 55);
      for (const [x, y, a, b] of [[0, -H + 5, W * 1.6, 9], [0, H * .2, W * 1.6, 9], [-W * .8 + 4, -H * .4 + 2, 9, H * 1.2 - 6], [W * .8 - 4, -H * .4 + 2, 9, H * 1.2 - 6]]) {
        add(rect(x, y, a, b), 'flat', 'peristyle', MARBLE);
        decor.push(...colonnade(rect(x, y, a, b), Math.max(5, Math.round(Math.max(a, b) / 5))));
      }
      add(rect(0, H * .72, W * 1.9, 10), 'flat', 'xystos', SAND);
      decor.push([[-W * .9, H * .72], [W * .9, H * .72]]);
      return {parts, decor};
    }
    if (kind === 'temple-precinct') {
      const W = Math.min(w, 34), H = Math.min(h, 46);
      add(rect(0, -H * .1, W * 1.1, H * 1.25), 'gable', 'temple-cella', MARBLE);
      decor.push(...colonnade(rect(0, -H * .1, W * 1.1, H * 1.25), 8, 1.2));
      add(rect(0, H * .75, W * .7, H * .14), 'flat', 'altar', STONE_DARK);
      return {parts, decor};
    }
    if (kind === 'gasworks') {
      const W = Math.min(w, 70), H = Math.min(h, 58), r = Math.min(20, W * .3, H * .38);
      const holders = W > 3.2 * r ? [-W + r + 4, -W + 3 * r + 10] : [-W + r + 4];
      for (const x of holders) {
        add(ellipse(x, -H + r + 4, r, r, 36), 'flat', 'gasholder', '#7d8c8a');
        decor.push(ellipseLine(x, -H + r + 4, r * .72, r * .72, 36), ellipseLine(x, -H + r + 4, r * .4, r * .4, 24));
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; decor.push([[x + Math.cos(a) * r * .4, -H + r + 4 + Math.sin(a) * r * .4], [x + Math.cos(a) * r, -H + r + 4 + Math.sin(a) * r]]); }
      }
      add(rect(W * .45, -H * .25, W * .9, 16), 'gable', 'retort-house', BRICK);
      add(rect(W * .45, H * .25, W * .9, H * .5), 'flat', 'coal-yard', COAL);
      add(rect(-W * .45, H * .55, 18, 12), 'gable', 'purifier-house', BRICK_LIGHT);
      return {parts, decor, chimneys: [[W * .9, -H * .25]]};
    }
    if (kind === 'roundhouse') {
      const R = Math.min(w, h * 1.6, 48);
      add(band(0, h * .35, R * .45, R, Math.PI * .95, Math.PI * 2.05, 24), 'flat', 'engine-stalls', BRICK);
      add(ellipse(0, h * .35, R * .16, R * .16, 20), 'flat', 'turntable', IRON);
      for (let i = 0; i <= 10; i++) { const a = Math.PI * .95 + Math.PI * 1.1 * i / 10; decor.push([[Math.cos(a) * R * .16, h * .35 + Math.sin(a) * R * .16], [Math.cos(a) * R * .98, h * .35 + Math.sin(a) * R * .98]]); }
      return {parts, decor};
    }
    if (kind === 'opera') {
      const W = Math.min(w, 38), H = Math.min(h, 52);
      add(rect(0, H * .3, W * 1.5, H * .7), 'hip', 'foyer', MARBLE);
      add(ellipse(0, -H * .2, W * .7, H * .42, 32), 'dome', 'auditorium', '#a7b6ad');
      add(rect(0, -H * .72, W * 1.6, H * .42), 'gable', 'fly-tower', STONE_DARK);
      return {parts, decor};
    }
    if (kind === 'hospital') {
      const W = Math.min(w, 70), H = Math.min(h, 55);
      add(rect(0, H * .8, W * 1.8, 12), 'gable', 'ward-corridor', BRICK_LIGHT);
      const count = Math.max(3, Math.min(6, Math.floor(W * 1.8 / 22)));
      for (let i = 0; i < count; i++) add(rect(-W * .9 + 11 + i * (W * 1.8 - 22) / Math.max(1, count - 1), H * .1, 11, H * 1.25), 'gable', 'pavilion-ward', BRICK_LIGHT);
      add(rect(0, -H + 8, 20, 14), 'hip', 'chapel', STONE);
      return {parts, decor};
    }
    if (kind === 'cemetery') {
      const W = Math.min(w, 110), H = Math.min(h, 90);
      add(rect(0, -H * .55, 14, 20), 'gable', 'cemetery-chapel', STONE);
      for (let x = -W + 8; x <= W - 8; x += 7) for (let y = -H + 8; y <= H - 6; y += 6) {
        if (Math.abs(x) < 8 || Math.abs(y + H * .55) < 14 && Math.abs(x) < 14) continue;
        decor.push([[x - 1.6, y], [x + 1.6, y]]);
      }
      decor.push([[0, -H + 2], [0, H - 2]], [[-W + 2, 0], [W - 2, 0]]);
      return {parts, decor, lawn: true};
    }
    if (kind === 'park') {
      // Landscape park: perimeter walk, an oval drive, crossing paths and a pond.
      decor.push(ellipseLine(0, 0, w * .62, h * .62, 48), [[-w + 3, 0], [w - 3, 0]], [[0, -h + 3], [0, h - 3]]);
      decor.push([[-w + 3, -h + 3], [w - 3, -h + 3], [w - 3, h - 3], [-w + 3, h - 3], [-w + 3, -h + 3]]);
      const pr = Math.min(w, h) * .2;
      parts.push({points: ellipse(w * .3, -h * .3, pr * 1.3, pr * .8, 28), roof: 'flat', feature: 'pond', fill: WATER});
      parts.push({points: ellipse(0, 0, 5, 5, 16), roof: 'flat', feature: 'bandstand', fill: MARBLE});
      return {parts, decor, lawn: true};
    }
    return {parts, decor};
  }

  /* Monuments each grammar raises, with siting preferences.
   * zone: 'core' near centre, 'edge' toward outskirts, 'industrial' inside freight district. */
  function monumentProgram(plan, {population, capital}) {
    if (!plan) return [];
    const large = population >= 9000;
    switch (plan.id) {
      case 'castrum': return [
        {kind: 'baths', label: '公共浴场', zone: 'core', radial: [.15, .6], minMetres: 50},
        {kind: 'temple-precinct', label: '神庙', zone: 'core', radial: [.1, .55], minMetres: 34},
        {kind: 'roman-theatre', label: '剧场', zone: 'mid', radial: [.35, .8], minMetres: 60},
        ...(large || capital ? [{kind: 'amphitheatre', label: '圆形竞技场', zone: 'edge', radial: [.55, 1.2], minMetres: 90, span: 2}] : []),
        ...(large ? [{kind: 'baths', label: '北浴场', zone: 'mid', radial: [.4, .9], minMetres: 50}] : [])
      ];
      case 'hippodamian': return [
        {kind: 'temple-precinct', label: '神庙圣域', zone: 'core', radial: [.1, .55], minMetres: 34},
        {kind: 'theatre', label: '剧场', zone: 'edge', radial: [.45, 1.1], minMetres: 60},
        {kind: 'gymnasium', label: '体育场', zone: 'edge', radial: [.5, 1.1], minMetres: 55},
        ...(large ? [{kind: 'baths', label: '浴场', zone: 'mid', radial: [.3, .8], minMetres: 50}] : [])
      ];
      case 'ensanche': case 'boulevard': case 'mill-town': return [
        {kind: 'gasworks', label: '煤气厂', zone: 'industrial', radial: [.3, 1.4], minMetres: 60},
        ...(plan.id !== 'mill-town' || large ? [{kind: 'opera', label: '大剧院', zone: 'ring', radial: [.2, .75], minMetres: 40}] : []),
        {kind: 'park', label: '市民公园', zone: 'mid', radial: [.45, .95], minMetres: 60, span: 2},
        {kind: 'hospital', label: '市立医院', zone: 'mid', radial: [.45, 1.1], minMetres: 55},
        {kind: 'cemetery', label: '公墓', zone: 'edge', radial: [.75, 1.4], minMetres: 70},
        ...(large ? [{kind: 'roundhouse', label: '机车库', zone: 'industrial', radial: [.3, 1.5], minMetres: 55}] : [])
      ];
      default: return [];
    }
  }

  /* Industrial-age building palettes: brick, slate, zinc. */
  const INDUSTRIAL_ROOFS = Object.freeze({
    core: null,
    bourgeois: ['#8f9ea2', '#9aa7a8', '#a6aeab', '#86979c', '#b3a89a'],
    workers: ['#9a6a58', '#a7735f', '#8f6352', '#b07f69', '#976c5c'],
    factory: ['#86625a', '#7d8483', '#957366', '#6f7b7c']
  });
  const CLASSICAL_ROOFS = Object.freeze(['#c08a6a', '#cc9a78', '#b67c60', '#d2a887', '#c48f72']);

  global.WorldAtlasCityEra = Object.freeze({
    eras: ERAS, eraLabel: ERA_LABEL, grammars: GRAMMARS,
    grammar, adjustProfile, apply, monument, monumentProgram, mix,
    palettes: {industrial: INDUSTRIAL_ROOFS, classical: CLASSICAL_ROOFS},
    colours: {STONE, STONE_DARK, MARBLE, SAND, WATER, BRICK, SLATE, IRON, GLASS, COAL, GREEN, LAWN}
  });
})(typeof window !== 'undefined' ? window : globalThis);
